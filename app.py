from flask import Flask, request, render_template, redirect, url_for, session, flash

from google_auth_oauthlib.flow import Flow
import google.auth.transport.requests
import google.oauth2.credentials
import google.oauth2.id_token

from flask_dance.contrib.facebook import make_facebook_blueprint, facebook
from flask_login import LoginManager, login_required, login_user, logout_user, UserMixin, current_user
from dotenv import load_dotenv
from datetime import datetime
import openai
import os
import json

app = Flask(__name__)

load_dotenv()
app.config['SECRET_KEY'] = os.getenv('FLASK_SECRET_KEY') or 'a-very-secret-random-key'
os.environ['OAUTHLIB_INSECURE_TRANSPORT'] = '1'

openai.api_key = os.getenv("OPENAI_API_KEY")
giphy_api_key = os.getenv("GIPHY_API_KEY")



GOOGLE_CLIENT_SECRET_FILE = os.path.join(os.path.dirname(__file__), "client_secret.json")
GOOGLE_SCOPES = [
    "https://www.googleapis.com/auth/userinfo.email",
    "https://www.googleapis.com/auth/userinfo.profile", 
    "openid"
]


facebook_bp = make_facebook_blueprint(
    client_id=os.getenv("FACEBOOK_APP_ID"),
    client_secret=os.getenv("FACEBOOK_APP_SECRET"),
    scope=["email"],
    redirect_url="/login/facebook/authorized"
)
app.register_blueprint(facebook_bp, url_prefix="/login")

# Flask-Login
login_manager = LoginManager(app)
login_manager.login_view = "login"

# Define a list of admin email addresses
ADMIN_EMAILS = ["yaronyaronlid@gmail.com"]

class User(UserMixin):
    def __init__(self, id, name, email, is_new=False):
        self.id = id
        self.name = name
        self.email = email
        self.is_new = is_new
        # Determine if the user is an admin based on their email
        self.is_admin = email in ADMIN_EMAILS

users = {}

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
        return redirect(url_for('index'))
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
    users[user.id] = user
    login_user(user)
    return redirect(url_for('index'))
    


@app.route("/login/facebook/authorized")
def facebook_authorized():
    if not facebook.authorized:
        return redirect(url_for("facebook.login"))
    resp = facebook.get("/me?fields=id,name,email")
    if resp.ok:
        user_info = resp.json()
        user_id = user_info["id"]
        is_new = user_id not in users
        user = User(user_id, user_info["name"], user_info.get("email", ""), is_new=is_new)
        users[user.id] = user
        login_user(user)
    return redirect(url_for("index"))

from openai import OpenAI
client = OpenAI()

def revise_resume(resume_text):
    try:
        # Initialize the client inside the function to avoid blocking startup
        client = OpenAI()

        prompt = f"""You are a resume optimization expert. Analyze the following resume and provide a comprehensive revision.

Resume to analyze:
\"\"\"{resume_text}\"\"\"

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
    return render_template("index.html", year=current_year, giphy_api_key=giphy_api_key, scroll_to_form=current_user.is_authenticated, user=current_user if current_user.is_authenticated else None)

@app.route("/revise_resume", methods=["POST"])
@login_required
def revise_resume_route():
    print("=== revise_resume_route called ===")
    
    try:
        resume_text = request.form.get("resume", "").strip()
        if not resume_text:
            flash("Please enter your resume content", 'danger')
            return redirect(url_for('index'))
            
        revised_resume, feedback = revise_resume(resume_text)
        print("=== FEEDBACK DATA ===")
        print(json.dumps(feedback, indent=2))
        return render_template("result.html", original_resume=resume_text, revised_resume=revised_resume, feedback=feedback, error=None, user=current_user if current_user.is_authenticated else None)
    except Exception as e:
        import traceback
        traceback.print_exc()

        flash("Oops! Something went wrong. Please try again", 'danger')
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
        flash("Thank you! Your free checklist is on the way.", "success")
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


if __name__ == "__main__":
    app.run(debug=True, host='127.0.0.1', port=5000)


