from flask import Flask, request, render_template, redirect, url_for, session, flash, send_file
from io import BytesIO
import PyPDF2
import pdfplumber
from werkzeug.utils import secure_filename


from google_auth_oauthlib.flow import Flow
import google.auth.transport.requests
import google.oauth2.credentials
import google.oauth2.id_token

from flask_dance.contrib.facebook import make_facebook_blueprint, facebook
from flask_login import LoginManager, login_required, login_user, logout_user, UserMixin, current_user
from dotenv import load_dotenv
from datetime import datetime, timezone
import openai
import os
import json
from docx import Document
from azure.data.tables import TableServiceClient
from azure.identity import DefaultAzureCredential

app = Flask(__name__)

load_dotenv()
app.config['SECRET_KEY'] = os.getenv('FLASK_SECRET_KEY') or 'a-very-secret-random-key'

# File upload configuration
app.config['MAX_CONTENT_LENGTH'] = 16 * 1024 * 1024  # 16MB max file size
app.config['UPLOAD_FOLDER'] = 'temp_uploads'

# Create upload folder if it doesn't exist
import os
if not os.path.exists(app.config['UPLOAD_FOLDER']):
    os.makedirs(app.config['UPLOAD_FOLDER'])


# Only allow insecure transport for local development (debug mode)
#if app.debug:
    #os.environ['OAUTHLIB_INSECURE_TRANSPORT'] = '1'
# In production, rely on the .env file (should be 0 or unset)

openai.api_key = os.getenv("OPENAI_API_KEY")



GOOGLE_CLIENT_SECRET_FILE = os.path.join(os.path.dirname(__file__), "client_secret.json")
GOOGLE_SCOPES = [
    "https://www.googleapis.com/auth/userinfo.email",
    "https://www.googleapis.com/auth/userinfo.profile", 
    "openid"
]


facebook_bp = make_facebook_blueprint(
    client_id=os.getenv("FACEBOOK_APP_ID"),
    client_secret=os.getenv("FACEBOOK_APP_SECRET"),
    scope="email",
    redirect_to="facebook_callback",  # must be HTTPS
)


app.register_blueprint(facebook_bp, url_prefix="/login")  # MUST be before the route below


# Flask-Login
login_manager = LoginManager(app)
login_manager.login_view = "login"

# Define a list of admin email addresses
ADMIN_EMAILS = ["yaronyaronlid@gmail.com"]

# User storage file
USERS_FILE = "users_data.json"

class User(UserMixin):
    def __init__(self, id, name, email, is_new=False, created_at=None):
        self.id = id
        self.name = name
        self.email = email
        self.is_new = is_new
        self.created_at = created_at or datetime.now(timezone.utc).isoformat()
        # Determine if the user is an admin based on their email
        self.is_admin = email in ADMIN_EMAILS
    
    def to_dict(self):
        """Convert user to dictionary for JSON storage"""
        return {
            'id': self.id,
            'name': self.name,
            'email': self.email,
            'created_at': self.created_at,
            'is_admin': self.is_admin
        }
    
    @classmethod
    def from_dict(cls, data):
        """Create user from dictionary"""
        user = cls(
            id=data['id'],
            name=data['name'],
            email=data['email'],
            created_at=data.get('created_at')
        )
        return user

def load_users():
    """Load users from JSON file"""
    try:
        if os.path.exists(USERS_FILE):
            with open(USERS_FILE, 'r', encoding='utf-8') as f:
                users_data = json.load(f)
                return {user_id: User.from_dict(user_data) for user_id, user_data in users_data.items()}
        return {}
    except Exception as e:
        print(f"Error loading users: {e}")
        return {}

def save_users():
    """Save users to JSON file"""
    try:
        users_data = {user_id: user.to_dict() for user_id, user in users.items()}
        with open(USERS_FILE, 'w', encoding='utf-8') as f:
            json.dump(users_data, f, indent=2, ensure_ascii=False)
        print(f"✅ Saved {len(users)} users to persistent storage")
    except Exception as e:
        print(f"Error saving users: {e}")

def add_user(user):
    """Add a user and save to persistent storage"""
    users[user.id] = user
    save_users()
    print(f"✅ Added user: {user.name} ({user.email})")

# Load existing users on startup
users = load_users()
print(f"📊 Loaded {len(users)} users from persistent storage")

@login_manager.user_loader
def load_user(user_id):
    return users.get(user_id)

@app.route("/login")
def login():
    if current_user.is_authenticated:
        return redirect(url_for('index'))
    return render_template("login.html")

@app.route("/logout")
@login_required
def logout():
    session.clear()
    logout_user()
    return redirect(url_for("index"))


@app.route("/login/google")
def google_login():
    if current_user.is_authenticated:
        return redirect(url_for('index'))
    flow = Flow.from_client_secrets_file(
        GOOGLE_CLIENT_SECRET_FILE,
        scopes=GOOGLE_SCOPES,
        redirect_uri=url_for("google_callback", _external=True)
    )
    auth_url, state = flow.authorization_url(
        access_type="offline",
        include_granted_scopes="true",
        prompt="select_account"  # 👈 This line is important
    )
    session["state"] = state
    return redirect(auth_url)





# Google OAuth Callback
@app.route("/login/google/authorized")
def google_callback():
    if current_user.is_authenticated:
        return redirect(url_for('my_revisions'))
    flow = Flow.from_client_secrets_file(
        GOOGLE_CLIENT_SECRET_FILE,
        scopes=GOOGLE_SCOPES,
        state=session["state"],
        redirect_uri=url_for("google_callback", _external=True)
    )

    flow.fetch_token(authorization_response=request.url)
    credentials = flow.credentials
    user_info = google.oauth2.id_token.verify_oauth2_token(
        credentials.id_token, google.auth.transport.requests.Request()
    )
    user_id = user_info["sub"]
    is_new = user_id not in users
    user = User(user_id, user_info["name"], user_info.get("email", ""), is_new=is_new)
    add_user(user)  # Use add_user to save persistently
    login_user(user)
    # Save pending revision if it exists
    pending = session.pop('pending_revision', None)
    if pending:
        import uuid
        save_resume_revision(
            user.id,
            str(uuid.uuid4()),
            pending['revised_resume'],
            feedback=pending.get('feedback'),
            original_resume=pending.get('original_resume')
        )
    return redirect(url_for('my_revisions'))
    

@app.route("/login/facebook/authorized")
def facebook_callback():
    if not facebook.authorized:
        flash("Facebook login failed.", "danger")
        return redirect(url_for("login"))
    resp = facebook.get("/me?fields=id,name,email")
    if not resp.ok:
        flash("Failed to fetch Facebook user info.", "danger")
        return redirect(url_for("login"))

    fb_info = resp.json()
    user_id = f"facebook_{fb_info['id']}"
    is_new = user_id not in users
    user = User(user_id, fb_info["name"], fb_info.get("email", ""), is_new=is_new)
    add_user(user)  # Use add_user to save persistently
    login_user(user)
    return redirect(url_for("index"))


from openai import OpenAI
client = OpenAI()

def revise_resume(resume_text, job_description=None):
    try:
        # Initialize the client inside the function to avoid blocking startup
        client = OpenAI()

        # Build the prompt with optional job description
        job_desc_section = ""
        if job_description:
            job_desc_section = f"""
Job Description to tailor the resume towards:
\"\"\"{job_description}\"\"\"
"""

        prompt = f"""You are a resume optimization expert. Analyze the following resume and provide a comprehensive revision.

Resume to analyze:
\"\"\"{resume_text}\"\"\"{job_desc_section}

Provide your response in the following JSON format ONLY (no markdown, no additional text):
{{
  "revised_resume": "The complete revised version of the resume with improved clarity, structure, and professional tone",
  "feedback": {{
    "overall_score": <number between 0-100>,
    "subscores": {{
      "Content": <number between 0-100>,
      "Format": <number between 0-100>,
      "Optimization": <number between 0-100>,
      "Best Practices": <number between 0-100>,
      "Application Readiness": <number between 0-100>
    }},
    "improvement_items": [
      {{
        "category": "<category name>",
        "message": "<improvement suggestion>",
        "severity": "<error|warning|suggestion>",
        "example_lines": "<relevant example from resume>"
      }}
    ]
  }}
}}

Focus on:
1. Improving clarity, structure, and professional tone
2. Enhancing impact of achievements and experiences
3. Optimizing for ATS systems
4. Maintaining consistency in formatting
5. Adding missing elements that would strengthen the resume

Respond with ONLY the JSON object, no markdown formatting or additional text."""

        try:
            response = client.chat.completions.create(
                model="gpt-4",
                messages=[{"role": "user", "content": prompt}]
            )
        except Exception as e:
            print(f"OpenAI API Error: {str(e)}")
            raise ValueError("Failed to connect to OpenAI API. Please try again later.")

        raw_content = response.choices[0].message.content
        print("=== GPT RESPONSE ===")
        print(raw_content)

        # Remove markdown backticks if present
        if raw_content.startswith("```"):
            import re
            raw_content = re.sub(r"^```(?:json)?\n", "", raw_content)
            raw_content = re.sub(r"\n```$", "", raw_content)

        try:
            data = json.loads(raw_content)
            if "revised_resume" not in data or "feedback" not in data:
                raise ValueError("Missing required keys in JSON response")
            return data["revised_resume"], data["feedback"]
        except json.JSONDecodeError as e:
            print(f"JSON parsing error: {str(e)}")
            print(f"Raw content: {raw_content}")
            raise ValueError("Invalid response format from OpenAI. Please try again.")
        except KeyError as e:
            print(f"Missing key in response: {str(e)}")
            raise ValueError("Incomplete response from OpenAI. Please try again.")

    except Exception as e:
        print("=== ERROR OCCURRED ===")
        import traceback
        traceback.print_exc()
        raise

@app.route("/")
def index():
    current_year = datetime.now().year
    return render_template("index.html", year=current_year)

@app.route("/revise_resume", methods=["POST"])
#login_required
def revise_resume_route():
    print("=== revise_resume_route called ===")
    try:
        resume_text = ""
        
        # Check if file was uploaded
        if 'resumeFile' in request.files:
            file = request.files['resumeFile']
            if file and file.filename:
                print(f"Processing uploaded file: {file.filename}")
                try:
                    resume_text = extract_text_from_file(file)
                    print(f"Extracted text length: {len(resume_text)}")
                except Exception as e:
                    flash(f"Error processing uploaded file: {str(e)}", 'danger')
                    return redirect(url_for('index', scroll_to_form='true'))
        
        # If no file uploaded, check for text input  
        if not resume_text:
            resume_text = request.form.get("resume", "").strip()
        
        # Validate that we have resume content
        if not resume_text:
            flash("Please upload a resume file or paste your resume content", 'danger')
            return redirect(url_for('index', scroll_to_form='true'))
        
        # Get job description (optional)
        job_description = request.form.get("jobDescription", "").strip()
        
        # Process the resume
        print(f"Resume text preview (first 200 chars): {resume_text[:200]}...")
        print(f"Job description preview: {job_description[:100] if job_description else 'None'}...")
        revised_resume, feedback = revise_resume(resume_text, job_description)
        print("=== FEEDBACK DATA ===")
        print(f"Feedback type: {type(feedback)}")
        print(json.dumps(feedback, indent=2))
        
        # Create downloadable document
        os.makedirs("static/resumes", exist_ok=True)
        docx_path = os.path.join("static", "resumes", "revised_resume.docx")
        doc = Document()
        for line in revised_resume.splitlines():
            doc.add_paragraph(line)
        doc.save(docx_path)
        
        # Save to user account if authenticated
        if current_user.is_authenticated:
            import uuid
            save_resume_revision(
                current_user.id,
                str(uuid.uuid4()),
                revised_resume,
                feedback=feedback,
                original_resume=resume_text
            )
        else:
            # Store revision in session for post-signup saving
            session['pending_revision'] = {
                'revised_resume': revised_resume,
                'feedback': feedback,
                'original_resume': resume_text
            }
        return render_template("result.html", 
                                original_resume=resume_text, 
                                revised_resume=revised_resume, 
                                feedback=feedback, 
                                job_description=job_description,
                                error=None)
    except Exception as e:
        import traceback
        print("=== ERROR IN revise_resume_route ===")
        print(f"Error type: {type(e).__name__}")
        print(f"Error message: {str(e)}")
        traceback.print_exc()
        print("=== END ERROR DEBUG ===")
        flash(f"Error: {str(e)}", 'danger')
        return redirect(url_for('index'))

@app.route("/terms_privacy")
def terms_privacy():
    return render_template("terms_privacy.html")

@app.route("/privacy")
def privacy():
    return render_template("privacy.html")



@app.route("/about")
def about():
    current_year = datetime.now().year
    return render_template("about.html", year=current_year, user=current_user if current_user.is_authenticated else None)

@app.route("/blog")
def blog():
    current_year = datetime.now().year
    return render_template("blog.html", year=current_year, user=current_user if current_user.is_authenticated else None)

@app.route("/blog/<post>")
def blog_post(post):
    current_year = datetime.now().year
    return render_template(f"{post}.html", year=current_year, user=current_user if current_user.is_authenticated else None)

@app.route("/subscribe", methods=["POST"])
def subscribe():
    email = request.form.get("email")
    if email:
        with open("subscribers.csv", "a") as f:
            f.write(email + "\n")
        flash("Thank you!", "success")
        return redirect(url_for("thank_you"))
    else:
        flash("Please enter a valid email address.", "danger")
        return redirect(url_for("index"))

@app.route("/thank_you")
def thank_you():
    return render_template("thank_you.html")

@app.route("/users")
@login_required
def view_users():
    if not current_user.is_authenticated:
        flash("You need to log in to view this page.", "danger")
        return redirect(url_for("login"))

    # Check if the user is an admin
    if not getattr(current_user, "is_admin", False):
        flash("You do not have permission to view this page.", "danger")
        return redirect(url_for("index"))

    return render_template("users.html", users=users.values())




from flask import Response 
 



@app.route('/sitemap.xml', methods=['GET'])
def sitemap():
    pages = []
    lastmod = datetime.now().date().isoformat()

    # Static routes
    for rule in app.url_map.iter_rules():
        if "GET" in rule.methods and len(rule.arguments) == 0:
            url = url_for(rule.endpoint, _external=True)
            pages.append(
                f"""
                <url>
                    <loc>{url}</loc>
                    <lastmod>{lastmod}</lastmod>
                    <changefreq>monthly</changefreq>
                    <priority>0.8</priority>
                </url>
                """
            )

    sitemap_xml = f"""<?xml version="1.0" encoding="UTF-8"?>
    <urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
        {''.join(pages)}
    </urlset>"""

    return Response(sitemap_xml, mimetype='application/xml')


@app.route("/download_resume_docx", methods=["POST"])
#@login_required
def download_resume_docx():
    revised_resume = request.form.get('resume')
    if not revised_resume:
        flash("No revised resume found for download.", 'danger')
        return redirect(url_for('index'))
    doc = Document()
    for line in revised_resume.splitlines():
        doc.add_paragraph(line)
    file_stream = BytesIO()
    doc.save(file_stream)
    file_stream.seek(0)
    return send_file(
        file_stream,
        as_attachment=True,
        download_name="revised_resume.docx",
        mimetype="application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    )


# Azure Table Storage setup
AZURE_TABLE_NAME = os.getenv('AZURE_TABLE_NAME', 'ResumeRevisions')
AZURE_STORAGE_ACCOUNT = os.getenv('AZURE_STORAGE_ACCOUNT')

def get_table_client():
    connection_string = os.getenv('AZURE_STORAGE_CONNECTION_STRING')
    if connection_string:
        service = TableServiceClient.from_connection_string(conn_str=connection_string)
    else:
        credential = DefaultAzureCredential()
        service = TableServiceClient(endpoint=f"https://{AZURE_STORAGE_ACCOUNT}.table.core.windows.net", credential=credential)
    table_client = service.get_table_client(AZURE_TABLE_NAME)
    try:
        table_client.create_table()
    except Exception:
        pass  # Table may already exist
    return table_client

# Save a revision to Azure Table Storage
def save_resume_revision(user_id, revision_id, resume_content, feedback=None, original_resume=None, notes=None):
    from datetime import datetime, timezone
    table_client = get_table_client()
    entity = {
        'PartitionKey': user_id,
        'RowKey': revision_id,
        'timestamp': datetime.now(timezone.utc).isoformat(),
        'resume_content': resume_content,
        'feedback': json.dumps(feedback) if feedback else '',
        'original_resume': original_resume or '',
        'notes': notes or ''
    }
    table_client.upsert_entity(entity)

# Get all revisions for a user
def get_user_revisions(user_id):
    table_client = get_table_client()
    entities = table_client.query_entities(f"PartitionKey eq '{user_id}'")
    revisions = []
    for e in entities:
        timestamp_str = e.get('timestamp')
        if not timestamp_str:
            timestamp_str = str(e.get('Timestamp')) if e.get('Timestamp') else None
        try:
            timestamp = datetime.fromisoformat(timestamp_str) if timestamp_str else None
            if timestamp and timestamp.tzinfo is None:
                timestamp = timestamp.replace(tzinfo=timezone.utc)
        except Exception:
            timestamp = None
        feedback = {}
        if e.get('feedback'):
            try:
                feedback = json.loads(e['feedback'])
            except Exception:
                feedback = {}
        revisions.append({
            'revision_id': e['RowKey'],
            'timestamp': timestamp,
            'resume_content': e.get('resume_content', ''),
            'feedback': feedback,
            'original_resume': e.get('original_resume', ''),
            'notes': e.get('notes', '')
        })
    utc_min = datetime.min.replace(tzinfo=timezone.utc)
    revisions.sort(key=lambda x: x['timestamp'] or utc_min, reverse=True)
    return revisions

# Route: My Revisions
@app.route('/my_revisions')
@login_required
def my_revisions():
    revisions = get_user_revisions(current_user.id)
    return render_template('my_revisions.html', revisions=revisions, user=current_user)

@app.route('/download_revision/<revision_id>')
@login_required
def download_revision(revision_id):
    revisions = get_user_revisions(current_user.id)
    rev = next((r for r in revisions if r['revision_id'] == revision_id), None)
    if not rev:
        flash('Revision not found.', 'danger')
        return redirect(url_for('my_revisions'))
    from io import BytesIO
    from docx import Document
    doc = Document()
    for line in rev['resume_content'].splitlines():
        doc.add_paragraph(line)
    file_stream = BytesIO()
    doc.save(file_stream)
    file_stream.seek(0)
    return send_file(
        file_stream,
        as_attachment=True,
        download_name=f"resume_revision_{revision_id}.docx",
        mimetype="application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    )

@app.route('/view_revision/<revision_id>')
@login_required
def view_revision(revision_id):
    revisions = get_user_revisions(current_user.id)
    rev = next((r for r in revisions if r['revision_id'] == revision_id), None)
    if not rev:
        flash('Revision not found.', 'danger')
        return redirect(url_for('my_revisions'))
    return render_template(
        'result.html',
        revised_resume=rev['resume_content'],
        feedback=rev.get('feedback', {}),
        original_resume=rev.get('original_resume', ''),
        user=current_user
    )

@app.route('/update_notes/<revision_id>', methods=['POST'])
@login_required
def update_notes(revision_id):
    try:
        notes = request.form.get('notes', '').strip()
        
        # Get the current revision to preserve existing data
        table_client = get_table_client()
        entity = table_client.get_entity(partition_key=current_user.id, row_key=revision_id)
        
        # Update only the notes field
        entity['notes'] = notes
        table_client.update_entity(entity)
        
        flash('Notes updated successfully!', 'success')
    except Exception as e:
        flash('Error updating notes. Please try again.', 'danger')
        
    return redirect(url_for('my_revisions'))

def extract_text_from_file(file):
    """Extract text from uploaded file (PDF, DOC, DOCX)."""
    try:
        filename = secure_filename(file.filename)
        file_extension = filename.lower().split('.')[-1]
        print(f"Processing file: {filename}, extension: {file_extension}")
        
        if file_extension == 'pdf':
            # Extract text from PDF
            text = ""
            try:
                # Try pdfplumber first (better for complex layouts)
                with pdfplumber.open(file) as pdf:
                    print(f"PDF has {len(pdf.pages)} pages")
                    for page_num, page in enumerate(pdf.pages):
                        page_text = page.extract_text()
                        if page_text:
                            text += page_text + "\n"
                            print(f"Page {page_num + 1}: {len(page_text)} characters extracted")
            except Exception as e:
                print(f"pdfplumber failed: {str(e)}, trying PyPDF2")
                # Fallback to PyPDF2
                file.seek(0)  # Reset file pointer
                pdf_reader = PyPDF2.PdfReader(file)
                for page_num, page in enumerate(pdf_reader.pages):
                    page_text = page.extract_text()
                    text += page_text + "\n"
                    print(f"Page {page_num + 1}: {len(page_text)} characters extracted")
            
            print(f"Total PDF text extracted: {len(text)} characters")
            return text.strip()
        
        elif file_extension in ['doc', 'docx']:
            # Extract text from Word document
            doc = Document(file)
            text = ""
            for para_num, paragraph in enumerate(doc.paragraphs):
                text += paragraph.text + "\n"
            
            print(f"Total DOC text extracted: {len(text)} characters")
            return text.strip()
        
        else:
            raise ValueError(f"Unsupported file format: {file_extension}")
    
    except Exception as e:
        print(f"Error extracting text from file: {str(e)}")
        import traceback
        traceback.print_exc()
        raise ValueError(f"Failed to extract text from file: {str(e)}")




    # Access all users
for user_id, user_obj in users.items():
    print(f"User: {user_obj.name}, Email: {user_obj.email}")

if __name__ == "__main__":
    app.run(debug=True, host='127.0.0.1', port=5000)


