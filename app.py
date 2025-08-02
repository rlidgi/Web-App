from flask import Flask, request, render_template, redirect, url_for, session, flash, send_file, jsonify
from io import BytesIO
import PyPDF2
import pdfplumber
from werkzeug.utils import secure_filename
import mammoth
import logging
 # ...existing code...
import pdfplumber
from werkzeug.utils import secure_filename
import mammoth
import logging

# Import analytics module for tracking Facebook ad performance
from analytics import analytics

# Import newsletter system
from newsletter import NewsletterManager, NewsletterConfig

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

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

load_dotenv()
app.config['SECRET_KEY'] = os.getenv('FLASK_SECRET_KEY') or 'a-very-secret-random-key'

# Ensure HTTPS URLs in sitemap and external links
app.config['PREFERRED_URL_SCHEME'] = 'https'

# File upload configuration
app.config['MAX_CONTENT_LENGTH'] = 16 * 1024 * 1024  # 16MB max file size
app.config['UPLOAD_FOLDER'] = 'temp_uploads'

# Create upload folder if it doesn't exist
import os
if not os.path.exists(app.config['UPLOAD_FOLDER']):
    os.makedirs(app.config['UPLOAD_FOLDER'])



@app.before_request
def before_request():
    # Only redirect in production (not in debug mode)
    if not app.debug:
        forwarded_proto = request.headers.get('X-Forwarded-Proto', '').lower()
        app.logger.info(f"[HTTPS REDIRECT] scheme={request.scheme}, X-Forwarded-Proto={forwarded_proto}, port={request.environ.get('SERVER_PORT')}, url={request.url}")
        # Only redirect if X-Forwarded-Proto is present and is 'http'
        if forwarded_proto == 'http':
            app.logger.info("[HTTPS REDIRECT] Redirecting to HTTPS due to X-Forwarded-Proto == 'http'")
            url = request.url.replace('http://', 'https://', 1)
            return redirect(url, code=301)
        # If header is missing, only redirect if scheme is http and port is 80 (default HTTP)
        elif not forwarded_proto and request.scheme == 'http' and request.environ.get('SERVER_PORT') == '80':
            app.logger.info("[HTTPS REDIRECT] Redirecting to HTTPS due to scheme == 'http' and port == 80")
            url = request.url.replace('http://', 'https://', 1)
            return redirect(url, code=301)
        # Otherwise, do not redirect (prevents loop)

# Add security headers for HTTPS enforcement
@app.before_request
def before_request():
    if not app.debug:
        forwarded_proto = request.headers.get('X-Forwarded-Proto', '').lower()
        app.logger.info(f"[HTTPS REDIRECT] scheme={request.scheme}, X-Forwarded-Proto={forwarded_proto}, port={request.environ.get('SERVER_PORT')}, url={request.url}")
        # Only redirect if X-Forwarded-Proto is present and is 'http'
        if forwarded_proto == 'http':
            app.logger.info("[HTTPS REDIRECT] Redirecting to HTTPS due to X-Forwarded-Proto == 'http'")
            url = request.url.replace('http://', 'https://', 1)
            return redirect(url, code=301)
        # If header is missing, only redirect if scheme is http and port is 80 (default HTTP)
        elif not forwarded_proto and request.scheme == 'http' and request.environ.get('SERVER_PORT') == '80':
            app.logger.info("[HTTPS REDIRECT] Redirecting to HTTPS due to scheme == 'http' and port == 80")
            url = request.url.replace('http://', 'https://', 1)
            return redirect(url, code=301)
        # Otherwise, do not redirect (prevents loop)



# Google OAuth Configuration
GOOGLE_CLIENT_SECRET_FILE = os.path.join(os.path.dirname(__file__), "client_secret.json")

# Check if we have environment variables for Google OAuth (production)
if os.getenv('GOOGLE_CLIENT_ID') and os.getenv('GOOGLE_CLIENT_SECRET'):
    # Use environment variables (more secure for production)
    GOOGLE_CLIENT_ID = os.getenv('GOOGLE_CLIENT_ID')
    GOOGLE_CLIENT_SECRET = os.getenv('GOOGLE_CLIENT_SECRET')
    USE_ENV_CREDENTIALS = True
else:
    # Use file-based credentials (for development)
    USE_ENV_CREDENTIALS = False

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
    
    if USE_ENV_CREDENTIALS:
        # Use environment variables for credentials
        from google_auth_oauthlib.flow import Flow
        client_config = {
            "web": {
                "client_id": GOOGLE_CLIENT_ID,
                "client_secret": GOOGLE_CLIENT_SECRET,
                "auth_uri": "https://accounts.google.com/o/oauth2/auth",
                "token_uri": "https://oauth2.googleapis.com/token",
                "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs",
                "redirect_uris": [url_for("google_callback", _external=True)]
            }
        }
        flow = Flow.from_client_config(
            client_config,
            scopes=GOOGLE_SCOPES,
            redirect_uri=url_for("google_callback", _external=True)
        )
    else:
        # Use file-based credentials
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
    
    if USE_ENV_CREDENTIALS:
        # Use environment variables for credentials
        client_config = {
            "web": {
                "client_id": GOOGLE_CLIENT_ID,
                "client_secret": GOOGLE_CLIENT_SECRET,
                "auth_uri": "https://accounts.google.com/o/oauth2/auth",
                "token_uri": "https://oauth2.googleapis.com/token",
                "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs",
                "redirect_uris": [url_for("google_callback", _external=True)]
            }
        }
        flow = Flow.from_client_config(
            client_config,
            scopes=GOOGLE_SCOPES,
            state=session["state"],
            redirect_uri=url_for("google_callback", _external=True)
        )
    else:
        # Use file-based credentials
        flow = Flow.from_client_secrets_file(
            GOOGLE_CLIENT_SECRET_FILE,
            scopes=GOOGLE_SCOPES,
            state=session["state"],
            redirect_uri=url_for("google_callback", _external=True)
        )

    flow.fetch_token(authorization_response=request.url)
    credentials = flow.credentials
    
    # Add clock skew tolerance for token verification with retry logic
    import time
    max_retries = 3
    for attempt in range(max_retries):
        try:
            user_info = google.oauth2.id_token.verify_oauth2_token(
                credentials.id_token, 
                google.auth.transport.requests.Request(),
                clock_skew_in_seconds=30  # Allow 30 seconds clock skew
            )
            break  # Success, exit retry loop
        except google.auth.exceptions.InvalidValue as e:
            if "Token used too early" in str(e) and attempt < max_retries - 1:
                # Wait 2 seconds and retry
                time.sleep(2)
                continue
            else:
                raise  # Re-raise if not a timing issue or max retries reached
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


def revised_resume_formatted(revised_resume):
    
    prompt2 = f"Please format the following resume for better readability:\n\n{revised_resume}"
    response2 = client.chat.completions.create(
                model="gpt-4",
                messages=[{"role": "user", "content": prompt2}]
            )
    return response2.choices[0].message.content


def revised_resume_template(revised_resume):
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

@app.route("/")
def index():
    # Track the visit with source attribution (only if not already tracked)
    if 'visit_tracked' not in session:
        source_info = analytics.track_visit(request)
        session['visit_tracked'] = True
        session['traffic_source'] = source_info
        app.logger.info(f"Homepage visit tracked from server-side: {source_info.get('type', 'unknown')}")
    else:
        # Use existing traffic source from session
        source_info = session.get('traffic_source', {'type': 'organic'})
        app.logger.info("Homepage visit already tracked in session, skipping duplicate")
    
    current_year = datetime.now().year
    return render_template("index.html", year=current_year)



@app.route("/results", methods=["POST"])
#login_required
def results_route():
    print("=== results_route called ===")
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
        
        # Track conversion (resume submission)
        conversion_info = analytics.track_conversion(session, "resume_submission")
        print(f"=== CONVERSION TRACKED ===")
        print(f"Conversion info: {conversion_info}")
        
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

@app.route("/templates")
def templates():
    client_templates=OpenAI()
    prompt= f'''Please create a python dictionary with the section names of the provided resume 
    as keys and the associated content as values.'''
    try:
            response = client.chat.completions.create(
                model="gpt-4",
                messages=[{"role": "user", "content": prompt}]
            )
    except Exception as e:
            print(f"OpenAI API Error: {str(e)}")
            raise ValueError("Failed to connect to OpenAI API. Please try again later.")

    resume_data = response.choices[0].message.content
    resume_data = request.json.get('resume_data')

    return render_template('resume_template.html', resume=resume_data)


@app.route("/subscribe", methods=["POST"])
def subscribe():
    email = request.form.get("email")
    referrer = request.referrer or url_for("index")
    
    if email:
        try:
            # Create subscribers.csv if it doesn't exist
            import os
            if not os.path.exists("subscribers.csv"):
                with open("subscribers.csv", "w") as f:
                    f.write("email\n")  # Header row
            
            # Check if email already exists
            existing_emails = []
            try:
                with open("subscribers.csv", "r") as f:
                    existing_emails = [line.strip().lower() for line in f.readlines()]
            except FileNotFoundError:
                pass
            
            if email.lower() in existing_emails:
                flash("You're already subscribed to our newsletter!", "info")
            else:
                with open("subscribers.csv", "a") as f:
                    f.write(email + "\n")
                flash("Thank you for subscribing! You'll receive our latest resume tips and career advice.", "success")
            
            # Smart redirect based on referrer
            if "/blog" in referrer:
                return redirect(url_for("blog"))
            elif "/thank_you" in referrer:
                return redirect(url_for("thank_you"))
            else:
                return redirect(url_for("thank_you"))
        except Exception as e:
            flash("Something went wrong. Please try again later.", "danger")
            print(f"Subscription error: {str(e)}")
            return redirect(referrer)
    else:
        flash("Please enter a valid email address.", "danger")
        return redirect(referrer)

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

@app.route("/analytics")
@login_required
def view_analytics():
    """Admin dashboard for viewing Facebook ad performance and site analytics."""
    if not current_user.is_authenticated:
        flash("You need to log in to view this page.", "danger")
        return redirect(url_for("login"))

    # Check if the user is an admin
    if not getattr(current_user, "is_admin", False):
        flash("You do not have permission to view this page.", "danger")
        return redirect(url_for("index"))

    # Get comprehensive analytics data
    analytics_data = analytics.get_full_analytics()
    
    return render_template("analytics.html", analytics=analytics_data)

@app.route("/api/track", methods=["POST"])
def track_conversion():
    """API endpoint for tracking conversions and events from Facebook ads."""
    try:
        # Check if this is a duplicate tracking call in the same session
        if 'visit_tracked' in session:
            # Just track the conversion/event without counting as a new visit
            source_info = session.get('traffic_source', {'type': 'unknown'})
            app.logger.info("Facebook tracking call - visit already tracked, skipping duplicate")
        else:
            # Track the visit/conversion (first time)
            source_info = analytics.track_visit(request)
            session['visit_tracked'] = True
            session['traffic_source'] = source_info
            app.logger.info(f"Facebook tracking - new visit tracked: {source_info.get('type', 'unknown')}")
        
        # Return JSON response for AJAX calls
        return {
            "status": "success",
            "source_type": source_info.get("type", "unknown"),
            "campaign": source_info.get("campaign", "unknown"),
            "message": "Event tracked successfully"
        }, 200
    except Exception as e:
        return {
            "status": "error",
            "message": str(e)
        }, 500

@app.route("/api/track_visit", methods=["POST"])
def track_visit():
    """API endpoint for tracking legitimate page visits (bot-filtered)."""
    try:
        # Check if visit already tracked in this session to prevent double counting
        if 'visit_tracked' in session:
            app.logger.info("Visit already tracked in session, skipping duplicate API tracking")
            return {
                "status": "success",
                "message": "Visit already tracked in session",
                "duplicate_prevented": True
            }, 200
        
        # Get JSON data from request
        data = request.get_json()
        
        if not data:
            return {"status": "error", "message": "No data provided"}, 400
        
        # Additional server-side bot detection
        user_agent = request.headers.get('User-Agent', '').lower()
        bot_indicators = [
            'bot', 'crawl', 'spider', 'scraper', 'curl', 'wget', 'python',
            'java', 'php', 'ruby', 'go-http', 'apache', 'nginx'
        ]
        
        # Check if request looks automated
        if any(indicator in user_agent for indicator in bot_indicators):
            return {"status": "ignored", "message": "Bot detected"}, 200
        
        # Check for required browser headers that bots often miss
        if not request.headers.get('Accept-Language'):
            return {"status": "ignored", "message": "Missing browser headers"}, 200
        
        # Track the legitimate visit using existing analytics
        source_info = analytics.track_visit(request)
        session['visit_tracked'] = True
        session['traffic_source'] = source_info
        
        # Log the visit for debugging
        app.logger.info(f"API visit tracked: {data.get('page', 'unknown')} from {request.remote_addr} - {source_info.get('type', 'unknown')}")
        
        return {
            "status": "success",
            "source_type": source_info.get("type", "unknown"),
            "message": "Visit tracked successfully"
        }, 200
        
    except Exception as e:
        logger.error(f"Error tracking visit: {str(e)}")
        return {
            "status": "error",
            "message": "Internal server error"
        }, 500

@app.route("/api/visit_count", methods=["GET"])
def get_visit_count():
    """API endpoint to retrieve current visit count."""
    try:
        # Get analytics data
        analytics_data = analytics.get_full_analytics()
        
        # Extract summary data
        summary = analytics_data.get('summary', {})
        
        return {
            "status": "success",
            "data": {
                "total_visits": summary.get('total_visits', 0),
                "facebook_ad_visits": summary.get('facebook_ad_visits', 0),
                "organic_visits": summary.get('organic_visits', 0),
                "total_conversions": summary.get('total_conversions', 0),
                "facebook_ad_conversions": summary.get('facebook_ad_conversions', 0),
                "last_updated": summary.get('last_updated', 'unknown')
            }
        }, 200
        
    except Exception as e:
        logger.error(f"Error retrieving visit count: {str(e)}")
        return {
            "status": "error", 
            "message": "Failed to retrieve visit count"
        }, 500

@app.route("/admin/stats")
@login_required
def admin_stats():
    """Admin page to view visit statistics."""
    if not current_user.is_authenticated:
        flash("You need to log in to view this page.", "danger")
        return redirect(url_for("login"))

    # Check if the user is an admin
    if not getattr(current_user, "is_admin", False):
        flash("You do not have permission to view this page.", "danger")
        return redirect(url_for("index"))

    try:
        # Get comprehensive analytics data
        analytics_data = analytics.get_full_analytics()
        
        # Debug logging to help troubleshoot
        app.logger.info(f"Analytics data structure: {type(analytics_data)}")
        if isinstance(analytics_data, dict) and 'summary' in analytics_data:
            app.logger.info(f"Summary data: {analytics_data['summary']}")
        else:
            app.logger.warning(f"Unexpected analytics data structure: {analytics_data}")
        
        return render_template("admin_stats.html", 
                             analytics=analytics_data, 
                             user=current_user)
    except Exception as e:
        app.logger.error(f"Error loading statistics: {str(e)}")
        flash(f"Error loading statistics: {str(e)}", "danger")
        return redirect(url_for("index"))


# Health check endpoint for Azure App Service
@app.route('/path/health', methods=['GET'])
@app.route('/health', methods=['GET'])
def health_check():
    """Health check endpoint for Azure App Service monitoring"""
    return jsonify({
        'status': 'healthy',
        'timestamp': datetime.now().isoformat(),
        'service': 'resumatic'
    }), 200


from flask import Response 
 



@app.route('/sitemap.xml', methods=['GET'])
def sitemap():
    """Generate dynamic sitemap with only public pages"""
    pages = []
    lastmod = datetime.now().date().isoformat()

    # Define allowed public endpoints
    public_endpoints = {
        'index': {'priority': '1.0', 'changefreq': 'daily'},
        'about': {'priority': '0.8', 'changefreq': 'monthly'},
        'blog': {'priority': '0.9', 'changefreq': 'weekly'},
        'templates': {'priority': '0.8', 'changefreq': 'monthly'},
        'counter': {'priority': '0.5', 'changefreq': 'daily'},
        'login': {'priority': '0.6', 'changefreq': 'monthly'},
        'signup': {'priority': '0.6', 'changefreq': 'monthly'},
        'privacy': {'priority': '0.3', 'changefreq': 'yearly'},
        'terms_privacy': {'priority': '0.3', 'changefreq': 'yearly'},
        'thank_you': {'priority': '0.4', 'changefreq': 'monthly'},
        'unsubscribe': {'priority': '0.2', 'changefreq': 'yearly'},
    }

    # Add static pages
    for endpoint, config in public_endpoints.items():
        try:
            url = url_for(endpoint, _external=True, _scheme='https')
            pages.append(f"""
                <url>
                    <loc>{url}</loc>
                    <lastmod>{lastmod}</lastmod>
                    <changefreq>{config['changefreq']}</changefreq>
                    <priority>{config['priority']}</priority>
                </url>""")
        except Exception:
            # Skip if endpoint doesn't exist
            continue

    # Add blog posts (assuming they follow the pattern /blog/<post>)
    blog_posts = [
        'toptenmistakes',
        'ats-optimization', 
        'Resume-objective',
        'no-experience',
        'Power-words',
        'resume-format-2025',
        'tailorresumejob'
    ]
    
    for post in blog_posts:
        try:
            url = url_for('blog_post', post=post, _external=True, _scheme='https')
            pages.append(f"""
                <url>
                    <loc>{url}</loc>
                    <lastmod>{lastmod}</lastmod>
                    <changefreq>monthly</changefreq>
                    <priority>0.8</priority>
                </url>""")
        except Exception:
            continue

    sitemap_xml = f"""<?xml version="1.0" encoding="UTF-8"?>
    <urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
        {''.join(pages)}
    </urlset>"""

    response = Response(sitemap_xml, mimetype='application/xml')
    response.headers['Cache-Control'] = 'public, max-age=86400'  # Cache for 24 hours
    return response


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
    """Extract text from uploaded file (PDF or DOCX), using fallback for complex Word docs."""
    try:
        filename = secure_filename(file.filename)
        file_extension = filename.lower().split('.')[-1]
        print(f"Processing file: {filename}, extension: {file_extension}")

        if file_extension == 'pdf':
            text = ""
            try:
                with pdfplumber.open(file) as pdf:
                    print(f"PDF has {len(pdf.pages)} pages")
                    for page_num, page in enumerate(pdf.pages):
                        page_text = page.extract_text()
                        if page_text:
                            text += page_text + "\n"
                            print(f"Page {page_num + 1}: {len(page_text)} characters extracted")
            except Exception as e:
                print(f"pdfplumber failed: {str(e)}, trying PyPDF2")
                file.seek(0)
                pdf_reader = PyPDF2.PdfReader(file)
                for page_num, page in enumerate(pdf_reader.pages):
                    page_text = page.extract_text()
                    text += page_text + "\n"
                    print(f"Page {page_num + 1}: {len(page_text)} characters extracted")

            print(f"Total PDF text extracted: {len(text)} characters")
            return text.strip()

        elif file_extension == 'docx':
            
            
            # Try python-docx first
            try:
                doc = Document(file)
                text = ""
                # Create a BytesIO copy for reuse  
                file.seek(0)
                docx_buffer = BytesIO(file.read())
                for para_num, paragraph in enumerate(doc.paragraphs):
                    text += paragraph.text + "\n"
            
                print(f"Total DOC text extracted: {len(text)} characters")

                # Fallback if too little text
                if len(text.strip()) < 75:
                    print("Text too short, falling back to mammoth...")
                    docx_buffer.seek(0)
                    result = mammoth.extract_raw_text(docx_buffer)
                    text = result.value
                    print(f"Text extracted using mammoth: {len(text)} characters")
            except Exception as e:
                print(f"python-docx failed: {str(e)}, trying mammoth as fallback")
                docx_buffer.seek(0)
                result = mammoth.extract_raw_text(docx_buffer)
                text = result.value
                print(f"Text extracted using mammoth: {len(text)} characters")

            return text.strip()

        else:
            raise ValueError(f"Unsupported file format: {file_extension}")

    except Exception as e:
        print(f"Error extracting text from file: {str(e)}")
        import traceback
        traceback.print_exc()
        raise ValueError(f"Failed to extract text from file: {str(e)}")

@app.route('/increment_counter', methods=['POST'])
def increment_counter():
    """API endpoint to increment resume counter (conversion tracking)"""
    try:
        # Use analytics module to track conversion
        conversion_result = analytics.track_conversion(session, "resume_submission")
        
        if conversion_result.get("status") == "success":
            # Get updated total conversions count
            analytics_data = analytics.get_full_analytics()
            count = analytics_data.get('summary', {}).get('total_conversions', 0)
            return {"success": True, "count": count}
        else:
            return {"success": False, "error": "Failed to track conversion"}, 500
            
    except Exception as e:
        return {"success": False, "error": str(e)}, 500

@app.route('/counter')
def counter_page():
    """Display counter page"""
    try:
        # Use the analytics module to get the total conversion count
        analytics_data = analytics.get_full_analytics()
        count = analytics_data.get('summary', {}).get('total_conversions', 0)
        
        # Fallback to legacy counter.json format if analytics doesn't work
        if count == 0:
            counter_file = 'counter.json'
            if os.path.exists(counter_file):
                with open(counter_file, 'r') as f:
                    data = json.load(f)
                    # Try new format first (total_conversions), then legacy format (count)
                    count = data.get('total_conversions', data.get('count', 0))
        
        return render_template('counter.html', count=count)
    except Exception as e:
        # Log the error for debugging
        print(f"Counter page error: {str(e)}")
        return render_template('counter.html', count=0)

@app.route('/robots.txt')
def robots_txt():
    """Serve robots.txt file"""
    try:
        response = send_file('robots.txt', mimetype='text/plain')
        if not app.debug:
            response.headers['Strict-Transport-Security'] = 'max-age=31536000; includeSubDomains'
            response.headers['Cache-Control'] = 'public, max-age=86400'  # Cache for 24 hours
        return response
    except Exception as e:
        # Fallback content if file is not found
        content = """User-agent: *
Allow: /
Disallow: /admin/
Disallow: /private/

Sitemap: https://resumaticai.com/sitemap.xml
Host: https://resumaticai.com"""
        response = Response(content, mimetype='text/plain')
        if not app.debug:
            response.headers['Strict-Transport-Security'] = 'max-age=31536000; includeSubDomains'
        return response

@app.route('/sitemap-static.xml')
def sitemap_static():
    """Serve static sitemap.xml file as backup"""
    try:
        response = send_file('sitemap.xml', mimetype='application/xml')
        response.headers['Cache-Control'] = 'public, max-age=86400'  # Cache for 24 hours
        return response
    except Exception as e:
        # Fallback to dynamic sitemap
        return redirect(url_for('sitemap'))

@app.route('/ads.txt')
def ads_txt():
    """Serve ads.txt file"""
    response = send_file('ads.txt', mimetype='text/plain')
    if not app.debug:
        response.headers['Strict-Transport-Security'] = 'max-age=31536000; includeSubDomains'
        response.headers['Cache-Control'] = 'public, max-age=86400'
    return response

@app.route('/llms.txt')
def llms_txt():
    """Serve llms.txt file"""
    response = send_file('llms.txt', mimetype='text/plain')
    # Add security headers to ensure HTTPS preference
    if not app.debug:
        response.headers['Strict-Transport-Security'] = 'max-age=31536000; includeSubDomains'
        response.headers['Cache-Control'] = 'public, max-age=86400'
    return response

@app.route('/subscribers')
@login_required
def subscribers():
    """Show subscribers page with actual subscriber data"""
    # Check if the user is an admin
    if not getattr(current_user, "is_admin", False):
        flash("You do not have permission to view this page.", "danger")
        return redirect(url_for("index"))
    
    try:
        subscriber_list = []
        subscriber_count = 0
        
        # Read subscribers from CSV file
        if os.path.exists("subscribers.csv"):
            with open("subscribers.csv", "r") as f:
                lines = f.readlines()
                # Skip header row if present
                for line in lines[1:] if lines and lines[0].strip().lower() == 'email' else lines:
                    email = line.strip()
                    if email:  # Only add non-empty emails
                        subscriber_list.append({
                            'email': email,
                            'date_added': 'Unknown'  # CSV doesn't store dates
                        })
                        subscriber_count += 1
        
        # Sort subscribers alphabetically
        subscriber_list.sort(key=lambda x: x['email'].lower())
        
        return render_template('subscribers.html', 
                             subscribers=subscriber_list, 
                             total_count=subscriber_count,
                             user=current_user)
    except Exception as e:
        flash(f"Error loading subscribers: {str(e)}", "danger")
        return render_template('subscribers.html', 
                             subscribers=[], 
                             total_count=0,
                             user=current_user)

@app.route('/signup')
def signup():
    """Show signup page"""
    return render_template('signup.html')

# Newsletter Management Routes
@app.route('/admin/newsletter')
@login_required
def newsletter_admin():
    """Newsletter administration dashboard"""
    if not current_user.is_authenticated:
        flash("You need to log in to view this page.", "danger")
        return redirect(url_for("login"))

    # Check if the user is an admin
    if not getattr(current_user, "is_admin", False):
        flash("You do not have permission to view this page.", "danger")
        return redirect(url_for("index"))

    try:
        # Get newsletter archives
        newsletter_files = []
        if os.path.exists("newsletters"):
            for filename in os.listdir("newsletters"):
                if filename.endswith(".json"):
                    try:
                        with open(os.path.join("newsletters", filename), "r") as f:
                            data = json.load(f)
                        newsletter_files.append({
                            "filename": filename,
                            "month": data.get("month"),
                            "year": data.get("year"),
                            "subject": data.get("subject"),
                            "generated_at": data.get("generated_at"),
                            "send_stats": data.get("send_stats", {})
                        })
                    except Exception as e:
                        logger.error(f"Error reading newsletter file {filename}: {str(e)}")

        # Sort by year and month (newest first)
        newsletter_files.sort(key=lambda x: (x.get("year", 0), x.get("month", "")), reverse=True)

        # Get subscriber count
        subscriber_count = 0
        if os.path.exists("subscribers.csv"):
            with open("subscribers.csv", "r") as f:
                lines = f.readlines()
                subscriber_count = len([line for line in lines[1:] if line.strip()]) if lines else 0

        return render_template('newsletter_admin.html', 
                             newsletters=newsletter_files, 
                             subscriber_count=subscriber_count,
                             user=current_user)
    except Exception as e:
        flash(f"Error loading newsletter dashboard: {str(e)}", "danger")
        return redirect(url_for("admin_stats"))

@app.route('/admin/newsletter/generate', methods=['POST'])
@login_required
def generate_newsletter():
    """Generate a new newsletter"""
    if not getattr(current_user, "is_admin", False):
        flash("You do not have permission to access this feature.", "danger")
        return redirect(url_for("index"))

    try:
        # Get form data
        month = request.form.get('month')
        year_str = request.form.get('year')
        custom_topics_str = request.form.get('custom_topics', '').strip()
        preview_only = request.form.get('preview_only') == 'on'

        # Validate inputs
        if not month or not year_str:
            flash("Please select both month and year.", "danger")
            return redirect(url_for('newsletter_admin'))

        try:
            year = int(year_str)
        except ValueError:
            flash("Invalid year provided.", "danger")
            return redirect(url_for('newsletter_admin'))

        # Parse custom topics
        custom_topics = None
        if custom_topics_str:
            custom_topics = [topic.strip() for topic in custom_topics_str.split(',') if topic.strip()]

        # Initialize newsletter manager
        newsletter_manager = NewsletterManager()

        # Generate newsletter
        result = newsletter_manager.create_and_send_newsletter(
            month=month,
            year=year,
            custom_topics=custom_topics,
            preview_only=preview_only
        )

        if preview_only:
            flash(f"Newsletter preview generated for {month} {year}! Check the archives to view it.", "success")
        else:
            send_stats = result.get('send_stats', {})
            flash(f"Newsletter sent! {send_stats.get('sent', 0)} emails sent successfully, {send_stats.get('failed', 0)} failed.", "success")

        return redirect(url_for('newsletter_admin'))

    except Exception as e:
        logger.error(f"Error generating newsletter: {str(e)}")
        flash(f"Error generating newsletter: {str(e)}", "danger")
        return redirect(url_for('newsletter_admin'))

@app.route('/admin/newsletter/preview/<path:filename>')
@login_required
def preview_newsletter(filename):
    """Preview a newsletter"""
    if not getattr(current_user, "is_admin", False):
        flash("You do not have permission to access this feature.", "danger")
        return redirect(url_for("index"))

    try:
        # Security check - ensure filename is safe
        safe_filename = secure_filename(filename)
        if not safe_filename.endswith('.html'):
            safe_filename += '.html'

        filepath = os.path.join("newsletters", safe_filename)
        
        if not os.path.exists(filepath):
            flash("Newsletter not found.", "danger")
            return redirect(url_for('newsletter_admin'))

        return send_file(filepath)

    except Exception as e:
        logger.error(f"Error previewing newsletter: {str(e)}")
        flash("Error loading newsletter preview.", "danger")
        return redirect(url_for('newsletter_admin'))

@app.route('/admin/newsletter/send/<path:filename>', methods=['POST'])
@login_required
def send_existing_newsletter(filename):
    """Send an existing newsletter"""
    if not getattr(current_user, "is_admin", False):
        flash("You do not have permission to access this feature.", "danger")
        return redirect(url_for("index"))

    try:
        # Security check
        safe_filename = secure_filename(filename)
        if not safe_filename.endswith('.json'):
            safe_filename += '.json'

        filepath = os.path.join("newsletters", safe_filename)
        
        if not os.path.exists(filepath):
            flash("Newsletter not found.", "danger")
            return redirect(url_for('newsletter_admin'))

        # Load newsletter data
        with open(filepath, "r") as f:
            newsletter_data = json.load(f)

        # Initialize newsletter manager and send
        newsletter_manager = NewsletterManager()
        send_stats = newsletter_manager.sender.send_newsletter(
            subject=newsletter_data["subject"],
            html_content=newsletter_data["html_content"],
            text_content=newsletter_data["text_content"]
        )

        # Update the newsletter file with send stats
        newsletter_data["send_stats"] = send_stats
        newsletter_data["last_sent"] = datetime.now(timezone.utc).isoformat()
        
        with open(filepath, "w") as f:
            json.dump(newsletter_data, f, indent=2)

        flash(f"Newsletter sent! {send_stats.get('sent', 0)} emails sent successfully, {send_stats.get('failed', 0)} failed.", "success")

    except Exception as e:
        logger.error(f"Error sending newsletter: {str(e)}")
        flash(f"Error sending newsletter: {str(e)}", "danger")

    return redirect(url_for('newsletter_admin'))

@app.route('/api/newsletter/test', methods=['POST'])
@login_required
def test_newsletter_config():
    """Test newsletter configuration (SMTP settings)"""
    if not getattr(current_user, "is_admin", False):
        return jsonify({"status": "error", "message": "Unauthorized"}), 403

    try:
        config = NewsletterConfig()
        
        # Check if credentials are configured
        if not config.sender_email or not config.sender_password:
            return jsonify({
                "status": "error", 
                "message": "Email credentials not configured. Please add NEWSLETTER_EMAIL and NEWSLETTER_PASSWORD to your .env file."
            }), 400

        # Log the configuration for debugging (without password)
        logger.info(f"Testing email config - Email: {config.sender_email}, SMTP: {config.smtp_server}:{config.smtp_port}")

        # Test SMTP connection
        import smtplib
        server = smtplib.SMTP(config.smtp_server, config.smtp_port)
        server.starttls()
        server.login(config.sender_email, config.sender_password)
        server.quit()

        return jsonify({
            "status": "success", 
            "message": f"Email configuration is working correctly! Connected to {config.smtp_server} with {config.sender_email}"
        })

    except smtplib.SMTPAuthenticationError as e:
        error_msg = str(e)
        if "Username and Password not accepted" in error_msg:
            return jsonify({
                "status": "error", 
                "message": "Authentication failed. For Gmail, make sure you're using an App Password, not your regular password. See newsletter_config.txt for setup instructions."
            }), 400
        else:
            return jsonify({
                "status": "error", 
                "message": f"SMTP Authentication Error: {error_msg}"
            }), 400
    except smtplib.SMTPException as e:
        return jsonify({
            "status": "error", 
            "message": f"SMTP Error: {str(e)}"
        }), 400
    except Exception as e:
        logger.error(f"Newsletter config test error: {str(e)}")
        return jsonify({
            "status": "error", 
            "message": f"Configuration error: {str(e)}"
        }), 400

@app.route('/api/newsletter/debug', methods=['POST'])
@login_required
def debug_newsletter_config():
    """Debug newsletter configuration"""
    if not getattr(current_user, "is_admin", False):
        return jsonify({"status": "error", "message": "Unauthorized"}), 403

    try:
        config = NewsletterConfig()
        
        debug_info = {
            "email_configured": bool(config.sender_email),
            "password_configured": bool(config.sender_password),
            "email_value": config.sender_email if config.sender_email else "Not set",
            "smtp_server": config.smtp_server,
            "smtp_port": config.smtp_port,
            "env_vars": {
                "NEWSLETTER_EMAIL": "Set" if os.getenv("NEWSLETTER_EMAIL") else "Not set",
                "NEWSLETTER_PASSWORD": "Set" if os.getenv("NEWSLETTER_PASSWORD") else "Not set"
            }
        }
        
        return jsonify({"status": "success", "debug_info": debug_info})

    except Exception as e:
        return jsonify({"status": "error", "message": f"Debug error: {str(e)}"}), 400

@app.route('/unsubscribe')
def unsubscribe():
    """Unsubscribe page for newsletter"""
    return render_template('unsubscribe.html')

@app.route('/unsubscribe', methods=['POST'])
def unsubscribe_post():
    """Process unsubscribe request"""
    email = request.form.get('email', '').strip().lower()
    
    if not email:
        flash("Please enter your email address.", "danger")
        return redirect(url_for('unsubscribe'))
    
    try:
        # Read current subscribers
        subscribers = []
        if os.path.exists("subscribers.csv"):
            with open("subscribers.csv", "r") as f:
                subscribers = [line.strip().lower() for line in f.readlines()]
        
        # Check if email exists
        if email not in subscribers:
            flash("Email address not found in our subscriber list.", "info")
            return redirect(url_for('unsubscribe'))
        
        # Remove email from list
        updated_subscribers = [sub for sub in subscribers if sub != email and sub != 'email']
        
        # Write back to file
        with open("subscribers.csv", "w") as f:
            f.write("email\n")  # Header
            for subscriber in updated_subscribers:
                if subscriber:  # Skip empty lines
                    f.write(subscriber + "\n")
        
        flash("You have been successfully unsubscribed from our newsletter.", "success")
        
    except Exception as e:
        logger.error(f"Error unsubscribing email: {str(e)}")
        flash("An error occurred. Please try again later.", "danger")
    
    return redirect(url_for('unsubscribe'))



    # Access all users
for user_id, user_obj in users.items():
    print(f"User: {user_obj.name}, Email: {user_obj.email}")


# Contact form route
@app.route('/contact', methods=['GET', 'POST'])
def contact():
    if request.method == 'POST':
        name = request.form.get('name')
        email = request.form.get('email')
        message = request.form.get('message')
        # Here you can add logic to send an email, save to database, etc.
        flash('Thank you for contacting us! We will get back to you soon.', 'success')
        return render_template('contact.html')
    return render_template('contact.html')

if __name__ == "__main__":
    app.run(debug=True, host='127.0.0.1', port=5000)

