from flask import Flask, request, render_template, redirect, url_for, session, flash, send_file, jsonify, Response
from io import BytesIO
import PyPDF2
import pdfplumber
from werkzeug.utils import secure_filename
from werkzeug.security import generate_password_hash, check_password_hash
import mammoth
import logging
 # ...existing code...
import pdfplumber
from werkzeug.utils import secure_filename
from werkzeug.security import generate_password_hash, check_password_hash
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
from typing import Optional
import openai
import os
import json
from docx import Document
from azure.data.tables import TableServiceClient
from azure.identity import DefaultAzureCredential
from urllib.parse import urlparse, urljoin

app = Flask(__name__)


#####################
# ---- Make `current_user` available in all Jinja templates ----
try:
    from flask_login import LoginManager, current_user as flask_login_current_user, AnonymousUserMixin

    login_manager = LoginManager()
    login_manager.init_app(app)

    @app.context_processor
    def inject_current_user():
        # This exposes the real Flask-Login current_user to Jinja
        return dict(current_user=flask_login_current_user)

except Exception:
    # Flask-Login not installed/configured: provide a safe dummy
    class _Anon:
        is_authenticated = False
    @app.context_processor
    def inject_current_user():
        return dict(current_user=_Anon())



################################





# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

load_dotenv()
app.config['SECRET_KEY'] = os.getenv('FLASK_SECRET_KEY') or 'a-very-secret-random-key'

# ---- Server-side sessions (prevents oversized cookie session issues) ----
# Without this, Flask stores the entire `session` in a signed cookie (~4KB limit).
# We now store larger structures (e.g., template_data.structured_resume), which can
# cause session updates to silently fail and show stale data after submitting a new resume.
try:
    from flask_session import Session

    app.config.setdefault("SESSION_TYPE", os.getenv("SESSION_TYPE", "filesystem"))
    app.config.setdefault("SESSION_PERMANENT", False)
    app.config.setdefault("SESSION_USE_SIGNER", True)
    app.config.setdefault("SESSION_COOKIE_HTTPONLY", True)
    app.config.setdefault("SESSION_COOKIE_SAMESITE", "Lax")
    app.config.setdefault("SESSION_REFRESH_EACH_REQUEST", False)

    if app.config["SESSION_TYPE"] == "filesystem":
        session_dir = os.path.join(app.root_path, "flask_session")
        os.makedirs(session_dir, exist_ok=True)
        app.config.setdefault("SESSION_FILE_DIR", session_dir)

    Session(app)
    logger.info(f"Server-side sessions enabled (SESSION_TYPE={app.config['SESSION_TYPE']})")
except Exception as e:
    try:
        logger.warning(f"Flask-Session not enabled; falling back to cookie sessions: {str(e)}")
    except Exception:
        pass


def _is_safe_next_url(target: str) -> bool:
    """Allow only same-host redirects (prefer relative paths) to avoid open redirects."""
    try:
        if not target:
            return False
        # Disallow scheme-relative URLs
        if target.startswith("//"):
            return False
        # Relative path is OK
        if target.startswith("/"):
            return True
        # Otherwise require same host
        ref_url = urlparse(request.host_url)
        test_url = urlparse(urljoin(request.host_url, target))
        return test_url.scheme in ("http", "https") and ref_url.netloc == test_url.netloc
    except Exception:
        return False


def _set_auth_next_from_request() -> None:
    """Capture ?next=... into session for use after login/oauth completes."""
    try:
        nxt = request.args.get("next", "").strip()
        if nxt and _is_safe_next_url(nxt):
            session["auth_next"] = nxt
    except Exception:
        pass


def _pop_auth_next() -> Optional[str]:
    """Pop a safe next URL from session, if any."""
    try:
        nxt = session.pop("auth_next", None)
        if nxt and _is_safe_next_url(nxt):
            return nxt
    except Exception:
        pass
    return None

# Ensure HTTPS URLs in sitemap and external links
app.config['PREFERRED_URL_SCHEME'] = 'https'

# File upload configuration
app.config['MAX_CONTENT_LENGTH'] = 16 * 1024 * 1024  # 16MB max file size
app.config['UPLOAD_FOLDER'] = 'temp_uploads'

# Create upload folder if it doesn't exist
import os
if not os.path.exists(app.config['UPLOAD_FOLDER']):
    os.makedirs(app.config['UPLOAD_FOLDER'])



def _append_google_signup_csv(user_id: str, name: str, email: str, created_at_iso: str) -> None:
    """Append a record of a new Google signup to google_signups.csv.

    Columns: timestamp_iso, user_id, name, email
    """
    try:
        import csv
        filename = 'google_signups.csv'
        file_exists = os.path.exists(filename)
        with open(filename, 'a', newline='', encoding='utf-8') as f:
            writer = csv.writer(f)
            if not file_exists:
                writer.writerow(['timestamp_iso', 'user_id', 'name', 'email'])
            writer.writerow([created_at_iso or datetime.now(timezone.utc).isoformat(), user_id or '', name or '', (email or '').strip().lower()])
    except Exception as e:
        logger.error(f"Failed to append google signup CSV: {str(e)}")



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

# Password reset tokens storage
RESET_TOKENS_FILE = "reset_tokens.json"
RESET_TOKEN_EXPIRY_HOURS = 24  # Tokens expire after 24 hours



class User(UserMixin):
    def __init__(self, id, name, email, password_hash=None, is_new=False, created_at=None):
        self.id = id
        self.name = name
        self.email = email
        self.password_hash = password_hash
        self.is_new = is_new
        self.created_at = created_at or datetime.now(timezone.utc).isoformat()
        # Determine if the user is an admin based on their email
        self.is_admin = email in ADMIN_EMAILS
    
    def set_password(self, password):
        """Hash and set password"""
        self.password_hash = generate_password_hash(password)
    
    def check_password(self, password):
        """Check if provided password matches hash"""
        if not self.password_hash:
            return False
        return check_password_hash(self.password_hash, password)
    
    def to_dict(self):
        """Convert user to dictionary for JSON storage"""
        return {
            'id': self.id,
            'name': self.name,
            'email': self.email,
            'password_hash': self.password_hash,
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
            password_hash=data.get('password_hash'),
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
        print(f"Saved {len(users)} users to persistent storage")
    except Exception as e:
        print(f"Error saving users: {e}")



def add_user(user):
    """Add a user and save to persistent storage"""
    users[user.id] = user
    save_users()
    print(f"Added user: {user.name} ({user.email})")

# Load existing users on startup
users = load_users()
print(f"Loaded {len(users)} users from persistent storage")



@login_manager.user_loader
def load_user(user_id):
    return users.get(user_id)

@app.route("/login", methods=['GET', 'POST'])
def login():
    if current_user.is_authenticated:
        # If already logged in and a next is provided, honor it.
        _set_auth_next_from_request()
        nxt = _pop_auth_next()
        return redirect(nxt or url_for('index'))

    # Clear any lingering flash messages
    session.pop('_flashes', None)

    # Capture intended return URL for post-auth redirect
    _set_auth_next_from_request()

    if request.method == 'POST':
        action = request.form.get('action')
        
        if action == 'login':
            # Handle email/password login
            email = request.form.get('email', '').strip().lower()
            password = request.form.get('password', '')
            
            if not email or not password:
                flash('Please enter both email and password.', 'danger')
                return render_template("login.html")
            
            # Find user by email
            user = None
            for user_id, u in users.items():
                if u.email.lower() == email:
                    user = u
                    break
            
            if user and user.password_hash and user.check_password(password):
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
                flash('You have been successfully logged in!', 'success')
                nxt = _pop_auth_next()
                return redirect(nxt or url_for('my_revisions'))
            else:
                flash('Invalid email or password.', 'danger')
                return render_template("login.html")
        
        elif action == 'register':
            # Handle email/password registration
            name = request.form.get('name', '').strip()
            email = request.form.get('email', '').strip().lower()
            password = request.form.get('password', '')
            confirm_password = request.form.get('confirm_password', '')
            
            # Validation
            if not name or not email or not password:
                flash('Please fill in all fields.', 'danger')
                return render_template("login.html")
            
            if len(password) < 8:
                flash('Password must be at least 8 characters long.', 'danger')
                return render_template("login.html")
            
            if password != confirm_password:
                flash('Passwords do not match.', 'danger')
                return render_template("login.html")
            
            # Check if email already exists
            for user_id, u in users.items():
                if u.email.lower() == email:
                    flash('An account with this email already exists. Please login instead.', 'danger')
                    return render_template("login.html")
            
            # Create new user
            import uuid
            user_id = f"email_{uuid.uuid4().hex[:16]}"
            user = User(user_id, name, email, is_new=True)
            user.set_password(password)
            add_user(user)
            
            # Persist profile to Azure Users table
            try:
                upsert_user_profile_azure(user)
            except Exception:
                pass
            
            login_user(user)
            flash('Account created successfully! Welcome to ResumaticAI!', 'success')
            
            # Save pending revision if it exists
            pending = session.pop('pending_revision', None)
            if pending:
                save_resume_revision(
                    user.id,
                    str(uuid.uuid4()),
                    pending['revised_resume'],
                    feedback=pending.get('feedback'),
                    original_resume=pending.get('original_resume')
                )
            
            nxt = _pop_auth_next()
            return redirect(nxt or url_for('my_revisions'))

    return render_template("login.html")

# Password Reset Functions
def load_reset_tokens():
    """Load reset tokens from JSON file"""
    try:
        if os.path.exists(RESET_TOKENS_FILE):
            with open(RESET_TOKENS_FILE, 'r', encoding='utf-8') as f:
                return json.load(f)
        return {}
    except Exception as e:
        logger.error(f"Error loading reset tokens: {e}")
        return {}

def save_reset_tokens(tokens):
    """Save reset tokens to JSON file"""
    try:
        with open(RESET_TOKENS_FILE, 'w', encoding='utf-8') as f:
            json.dump(tokens, f, indent=2, ensure_ascii=False)
    except Exception as e:
        logger.error(f"Error saving reset tokens: {e}")

def generate_reset_token():
    """Generate a secure random token for password reset"""
    import secrets
    return secrets.token_urlsafe(32)

def send_password_reset_email(email, token, user_name):
    """Send password reset email to user"""
    try:
        _load_email_config_if_missing()
        import smtplib
        from email.mime.text import MIMEText
        from email.mime.multipart import MIMEMultipart
        
        smtp_server = os.getenv('SMTP_SERVER', 'smtp.gmail.com')
        smtp_port = int(os.getenv('SMTP_PORT', '587'))
        auth_email = os.getenv('NEWSLETTER_EMAIL', '').strip()
        auth_password = os.getenv('NEWSLETTER_PASSWORD', '').strip().replace(' ', '')
        
        if not auth_email or not auth_password:
            raise ValueError('Email credentials not configured. Set NEWSLETTER_EMAIL and NEWSLETTER_PASSWORD.')
        
        # Generate reset URL
        reset_url = url_for('reset_password', token=token, _external=True)
        
        # Create email
        subject = 'Reset Your Password - ResumaticAI'
        html_body = f"""
        <html>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
            <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
                <h2 style="color: #2563eb;">Reset Your Password</h2>
                <p>Hello {user_name},</p>
                <p>We received a request to reset your password for your ResumaticAI account.</p>
                <p>Click the button below to reset your password:</p>
                <div style="margin: 30px 0;">
                    <a href="{reset_url}" style="background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block;">Reset Password</a>
                </div>
                <p>Or copy and paste this link into your browser:</p>
                <p style="word-break: break-all; color: #666;">{reset_url}</p>
                <p>This link will expire in 24 hours.</p>
                <p>If you didn't request a password reset, please ignore this email.</p>
                <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
                <p style="color: #666; font-size: 12px;">ResumaticAI Team</p>
            </div>
        </body>
        </html>
        """
        
        text_body = f"""
Reset Your Password - ResumaticAI

Hello {user_name},

We received a request to reset your password for your ResumaticAI account.

Click the link below to reset your password:
{reset_url}

This link will expire in 24 hours.

If you didn't request a password reset, please ignore this email.

ResumaticAI Team
        """
        
        msg = MIMEMultipart('alternative')
        msg['Subject'] = subject
        msg['From'] = f"ResumaticAI <{auth_email}>"
        msg['To'] = email
        
        msg.attach(MIMEText(text_body, 'plain'))
        msg.attach(MIMEText(html_body, 'html'))
        
        server = smtplib.SMTP(smtp_server, smtp_port)
        server.starttls()
        server.login(auth_email, auth_password)
        server.send_message(msg)
        server.quit()
        
        logger.info(f"Password reset email sent to {email}")
        return True
    except Exception as e:
        logger.error(f"Error sending password reset email: {str(e)}")
        return False

@app.route("/forgot-password", methods=['GET', 'POST'])
def forgot_password():
    """Handle forgot password requests"""
    if current_user.is_authenticated:
        return redirect(url_for('index'))
    
    if request.method == 'POST':
        email = request.form.get('email', '').strip().lower()
        
        if not email:
            flash('Please enter your email address.', 'danger')
            return render_template("forgot_password.html")
        
        # Find user by email
        user = None
        for user_id, u in users.items():
            if u.email.lower() == email:
                user = u
                break
        
        # Always show success message (security: don't reveal if email exists)
        flash('If an account exists with that email, a password reset link has been sent.', 'success')
        
        if user and user.password_hash:  # Only send if user has password (email signup)
            # Generate reset token
            token = generate_reset_token()
            expiry_time = datetime.now(timezone.utc).timestamp() + (RESET_TOKEN_EXPIRY_HOURS * 3600)
            
            # Save token
            tokens = load_reset_tokens()
            tokens[token] = {
                'user_id': user.id,
                'email': user.email,
                'expires_at': expiry_time
            }
            save_reset_tokens(tokens)
            
            # Send email
            send_password_reset_email(user.email, token, user.name)
        
        return redirect(url_for('login'))
    
    return render_template("forgot_password.html")

@app.route("/reset-password/<token>", methods=['GET', 'POST'])
def reset_password(token):
    """Handle password reset with token"""
    if current_user.is_authenticated:
        return redirect(url_for('index'))
    
    # Load tokens
    tokens = load_reset_tokens()
    
    if token not in tokens:
        flash('Invalid or expired reset link. Please request a new password reset.', 'danger')
        return redirect(url_for('forgot_password'))
    
    token_data = tokens[token]
    current_time = datetime.now(timezone.utc).timestamp()
    
    # Check if token expired
    if current_time > token_data['expires_at']:
        # Remove expired token
        del tokens[token]
        save_reset_tokens(tokens)
        flash('This reset link has expired. Please request a new password reset.', 'danger')
        return redirect(url_for('forgot_password'))
    
    if request.method == 'POST':
        password = request.form.get('password', '')
        confirm_password = request.form.get('confirm_password', '')
        
        # Validation
        if not password or not confirm_password:
            flash('Please fill in both password fields.', 'danger')
            return render_template("reset_password.html", token=token, valid=True)
        
        if len(password) < 8:
            flash('Password must be at least 8 characters long.', 'danger')
            return render_template("reset_password.html", token=token, valid=True)
        
        if password != confirm_password:
            flash('Passwords do not match.', 'danger')
            return render_template("reset_password.html", token=token, valid=True)
        
        # Get user and update password
        user_id = token_data['user_id']
        user = users.get(user_id)
        
        if user:
            user.set_password(password)
            add_user(user)  # Save updated password
            
            # Remove used token
            del tokens[token]
            save_reset_tokens(tokens)
            
            flash('Your password has been reset successfully! Please login with your new password.', 'success')
            return redirect(url_for('login'))
        else:
            flash('User not found. Please contact support.', 'danger')
            return redirect(url_for('login'))
    
    return render_template("reset_password.html", token=token, valid=True)

@app.route("/logout")
@login_required
def logout():
    # Clear any OAuth tokens or state
    session.pop('state', None)
    session.pop('google_oauth_token', None)
    session.pop('facebook_oauth_token', None)
    session.pop('pending_revision', None)
    # Clear full session
    session.clear()
    # Log out the user
    logout_user()
    flash('You have been successfully logged out.', 'success')
    return redirect(url_for('index'))


@app.route("/login/google")
def google_login():
    # Clear any lingering flash messages
    session.pop('_flashes', None)

    if current_user.is_authenticated:
        return redirect(url_for('index'))

    # Capture intended return URL for post-auth redirect
    _set_auth_next_from_request()
    
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
        nxt = _pop_auth_next()
        return redirect(nxt or url_for('my_revisions'))
    
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
    # Record only first-time Google signups
    try:
        if is_new and str(user_id).isdigit():
            _append_google_signup_csv(user.id, user.name, user.email, user.created_at)
    except Exception:
        pass
    # Persist profile to Azure Users table
    try:
        upsert_user_profile_azure(user)
    except Exception:
        pass
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
    nxt = _pop_auth_next()
    return redirect(nxt or url_for('my_revisions'))
    

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
    # Persist profile to Azure Users table
    try:
        upsert_user_profile_azure(user)
    except Exception:
        pass
    login_user(user)
    nxt = _pop_auth_next()
    return redirect(nxt or url_for("index"))





from openai import OpenAI

def revise_resume(resume_text, job_description=None):
    try:
        # Initialize the client inside the function to avoid blocking startup
        # Explicitly pass API key to handle Azure environment
        api_key = os.getenv('OPENAI_API_KEY')
        if not api_key:
            raise ValueError("OPENAI_API_KEY environment variable not set")
        
        # Configure timeout and other parameters for Azure reliability
        client = OpenAI(
            api_key=api_key,
            timeout=60.0,  # 60 second timeout
            max_retries=3  # Retry up to 3 times on transient errors
        )

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
            error_msg = str(e)
            print(f"OpenAI API Error: {error_msg}")
            logger.error(f"OpenAI API Error details: {type(e).__name__}: {error_msg}")
            # Re-raise with more details for debugging
            raise ValueError(f"Failed to connect to OpenAI API: {error_msg}")

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
    scroll_to_form = (request.args.get('scroll_to_form', '').lower() == 'true')
    return render_template("index.html", year=current_year, user=current_user, scroll_to_form=scroll_to_form)


@app.route("/start")
def start():
    current_year = datetime.now().year
    return render_template("start.html", year=current_year, user=current_user)



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
                    if not resume_text or not resume_text.strip():
                        logger.warning("Uploaded file parsed but contained no extractable text")
                        flash("The text could not be extracted from the file possibly due to its formatting. Another option is to copy the resume text and paste it in the provided text area.", 'danger')
                        return redirect(url_for('index', scroll_to_form='true'))
                except Exception as e:
                    logger.error(f"Upload processing failed: {str(e)}")
                    flash("Your file could not be processed possibly due to its formatting. Another option is to copy  the resume text and paste it in the provided text area.", 'danger')
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
        
        # Store data in session and redirect (Post/Redirect/Get) to prevent resubmission on back
        # IMPORTANT: clear template_data so the template viewer/PDF uses the new submission
        session.pop('template_data', None)
        session['results_data'] = {
            'original_resume': resume_text,
            'revised_resume': revised_resume,
            'feedback': feedback,
            'job_description': job_description,
        }
        session.modified = True
        return redirect(url_for('results_get'))
    except Exception as e:
        import traceback
        print("=== ERROR IN revise_resume_route ===")
        print(f"Error type: {type(e).__name__}")
        print(f"Error message: {str(e)}")
        traceback.print_exc()
        print("=== END ERROR DEBUG ===")
        flash(f"Error: {str(e)}", 'danger')
        return redirect(url_for('index'))




@app.route("/results", methods=["GET"])
def results_get():
    data = session.get('results_data', None)
    if not data:
        # Fallbacks so "Back to Results" from the template viewer doesn't dump users on the homepage.
        # 1) If we still have template_data (set when a template is selected), render results from it.
        td = session.get('template_data') or {}
        if isinstance(td, dict) and td.get('revised_resume'):
            data = {
                'original_resume': td.get('original_resume', ''),
                'revised_resume': td.get('revised_resume', ''),
                'feedback': td.get('feedback', {}) or {},
                'job_description': td.get('job_description', '') or '',
            }
        else:
            # 2) Anonymous users: pending_revision holds the revised resume + feedback
            pending = session.get('pending_revision') or {}
            if isinstance(pending, dict) and pending.get('revised_resume'):
                data = {
                    'original_resume': pending.get('original_resume', ''),
                    'revised_resume': pending.get('revised_resume', ''),
                    'feedback': pending.get('feedback', {}) or {},
                    'job_description': '',
                }
            else:
                # 3) Logged-in users: fall back to latest saved revision
                try:
                    if current_user.is_authenticated:
                        revs = get_user_revisions(current_user.id)
                        if revs and isinstance(revs, list):
                            rev0 = revs[0]
                            data = {
                                'original_resume': rev0.get('original_resume', ''),
                                'revised_resume': rev0.get('resume_content', ''),
                                'feedback': rev0.get('feedback', {}) or {},
                                'job_description': '',
                            }
                except Exception:
                    data = None

        if not data:
            # No data to show; notify and send the user to the homepage
            flash("Your file could not be processed (possibly due to formatting). Please copy the resume text and paste it into the provided text area.", 'danger')
            return redirect(url_for('index'))
    # Keep data in session for template selection
    # session.pop would remove it, so we use session.get and keep it available
    resp = app.make_response(render_template(
        "result.html",
        original_resume=data.get('original_resume', ''),
        revised_resume=data.get('revised_resume', ''),
        feedback=data.get('feedback', {}),
        job_description=data.get('job_description', ''),
        error=None
    ))
    # Prevent the browser from caching a previous results page
    resp.headers["Cache-Control"] = "no-store, no-cache, must-revalidate, max-age=0"
    resp.headers["Pragma"] = "no-cache"
    resp.headers["Expires"] = "0"
    return resp

@app.route("/api/parse-resume-for-template", methods=["POST"])
def parse_resume_for_template():
    """Parse resume and store structured data in session for template viewing"""
    try:
        data = request.get_json()
        template_name = data.get('template', 'modern')
        
        # Validate template name
        valid_templates = ['modern', 'professional', 'minimal', 'creative']
        if template_name not in valid_templates:
            return jsonify({"success": False, "error": "Invalid template name"}), 400
        
        revised_resume = ""
        original_resume = ""
        feedback = {}
        job_description = ""

        # 1) Preferred: results_data from the immediate /results flow
        results_data = session.get('results_data') or {}
        if isinstance(results_data, dict):
            revised_resume = (results_data.get('revised_resume') or "").strip()
            original_resume = (results_data.get('original_resume') or "").strip()
            feedback = results_data.get('feedback', {}) or {}
            job_description = (results_data.get('job_description') or "").strip()

        # 2) Fallback: pending_revision (for anonymous users, stored at submission time)
        if not revised_resume:
            pending = session.get('pending_revision') or {}
            if isinstance(pending, dict):
                revised_resume = (pending.get('revised_resume') or "").strip()
                original_resume = (pending.get('original_resume') or "").strip()
                feedback = pending.get('feedback', {}) or {}

        # 3) Fallback: logged-in user’s latest saved revision
        if not revised_resume:
            try:
                if current_user.is_authenticated:
                    revs = get_user_revisions(current_user.id)
                    if revs and isinstance(revs, list):
                        revised_resume = (revs[0].get('resume_content') or "").strip()
                        original_resume = (revs[0].get('original_resume') or "").strip()
                        feedback = revs[0].get('feedback', {}) or {}
            except Exception:
                revised_resume = ""

        if not revised_resume:
            return jsonify({
                "success": False,
                "error": "Resume data not found. Please generate a resume (or open a saved revision) before viewing templates."
            }), 404
        
        # Parse resume to get structured data
        parsed_result = parse_resume(revised_resume)
        structured_resume = parsed_result.get('resume', {})
        
        # Store in session for template viewer
        session['template_data'] = {
            'structured_resume': structured_resume,
            'template_name': template_name,
            # Keep text for navigation back to /results (comparison view)
            'original_resume': original_resume,
            'revised_resume': revised_resume,
            'feedback': feedback,
            'job_description': job_description,
        }
        
        return jsonify({
            "success": True,
            "template": template_name
        })
        
    except Exception as e:
        logger.error(f"Error parsing resume for template: {str(e)}")
        import traceback
        traceback.print_exc()
        return jsonify({"success": False, "error": str(e)}), 500

@app.route("/api/template-data", methods=["GET"])
def get_template_data():
    """Get structured resume data for template viewer"""
    requested_template = (request.args.get("template") or "").strip() or None

    def _get_revised_resume_from_anywhere() -> str:
        # 1) Immediate /results flow
        rd = session.get("results_data") or {}
        if isinstance(rd, dict):
            rr = (rd.get("revised_resume") or "").strip()
            if rr:
                return rr

        # 2) Anonymous flow stored at submission
        pr = session.get("pending_revision") or {}
        if isinstance(pr, dict):
            rr = (pr.get("revised_resume") or "").strip()
            if rr:
                return rr

        # 3) Logged-in user’s latest saved revision
        try:
            if current_user.is_authenticated:
                revs = get_user_revisions(current_user.id)
                if revs and isinstance(revs, list):
                    rr = (revs[0].get("resume_content") or "").strip()
                    if rr:
                        return rr
        except Exception:
            pass

        return ""

    def _ensure_template_data(template_name: str) -> dict | None:
        td = session.get("template_data")
        if isinstance(td, dict) and td.get("structured_resume"):
            # If caller asked for a different template name, update it.
            if template_name and td.get("template_name") != template_name:
                td["template_name"] = template_name
                session["template_data"] = td
            return td

        revised_resume = _get_revised_resume_from_anywhere()
        if not revised_resume:
            return None

        parsed_result = parse_resume(revised_resume)
        structured_resume = parsed_result.get("resume", {}) if isinstance(parsed_result, dict) else {}
        if not structured_resume:
            return None

        td = {
            "structured_resume": structured_resume,
            "template_name": template_name,
            "revised_resume": revised_resume,
        }
        session["template_data"] = td
        return td

    template_data = session.get('template_data')
    if not template_data:
        template_data = _ensure_template_data(requested_template or "modern")
        if not template_data:
            return jsonify({
                "error": "Template data not found. Please generate a resume (or open a saved revision) before viewing templates."
            }), 404
    
    return jsonify({
        "success": True,
        "resume": template_data['structured_resume'],
        "template": template_data['template_name'],
        "revised_resume": template_data.get('revised_resume', '')
    })


def _get_template_pdf_response(template_name_override=None):
    """
    Build and return an inline PDF response for the current session's template resume.
    Shared by the /api/template-pdf routes.
    """
    # Ensure template_data exists even on refresh/deep-link (avoid relying on prior /api/template-data call)
    template_data = session.get("template_data")
    if not template_data:
        # Reuse the same logic as /api/template-data by calling it internally.
        # (Avoid duplicating parsing logic here.)
        try:
            # best-effort: try to populate template_data
            requested = (template_name_override or "modern").strip()
            # Inline reconstruction similar to get_template_data()
            rd = session.get("results_data") or {}
            pr = session.get("pending_revision") or {}
            revised_resume = ""
            if isinstance(rd, dict):
                revised_resume = (rd.get("revised_resume") or "").strip()
            if not revised_resume and isinstance(pr, dict):
                revised_resume = (pr.get("revised_resume") or "").strip()
            if not revised_resume:
                if current_user.is_authenticated:
                    revs = get_user_revisions(current_user.id)
                    if revs and isinstance(revs, list):
                        revised_resume = (revs[0].get("resume_content") or "").strip()
            if not revised_resume:
                return "Template data not found. Please generate a resume first.", 404

            parsed_result = parse_resume(revised_resume)
            structured_resume = parsed_result.get("resume", {}) if isinstance(parsed_result, dict) else {}
            if not structured_resume:
                return "Template data not found. Please generate a resume first.", 404

            template_data = {
                "structured_resume": structured_resume,
                "template_name": requested,
                "revised_resume": revised_resume,
            }
            session["template_data"] = template_data
        except Exception:
            return "Template data not found. Please generate a resume first.", 404

    structured = template_data.get("structured_resume") or {}
    template_name = (template_name_override or template_data.get("template_name") or "resume").strip()

    # Prefer: render the actual React resume and print it to PDF using headless Chromium.
    # This preserves colors, fonts, and layout (print_background=True) and matches the site.
    #
    # We also auto-fit to ONE Letter page by applying print-only "compaction" + zoom scaling.
    # Use:
    # - ?simple=1  => force the legacy ReportLab output
    # - ?onepage=0 => allow natural pagination
    if (request.args.get("simple") or "").strip().lower() not in ("1", "true", "yes"):
        try:
            from urllib.parse import urljoin
            from playwright.sync_api import sync_playwright

            host = request.host.split(":")[0]
            base_url = request.host_url  # includes trailing slash
            # Standalone view is white background + just the resume content.
            resume_url = urljoin(
                base_url,
                f"/react/template-viewer/{template_name}?standalone=1"
            )

            # Forward cookies (critical: template data is session-backed)
            cookie_list = []
            for k, v in (request.cookies or {}).items():
                cookie_list.append({
                    "name": k,
                    "value": v,
                    "domain": host,
                    "path": "/",
                })

            # CSS px are 96 per inch. Letter = 8.5x11 => 816x1056 CSS px.
            page_w_px = 816
            page_h_px = 1056

            # Print margins for the resume content (do NOT use padding).
            # These margins apply to the resume root container so the content isn't flush to the page edge.
            margin_top_in = 0.25
            margin_side_in = 0.25
            mt_px = int(round(margin_top_in * 96))
            mx_px = int(round(margin_side_in * 96))

            avail_w = page_w_px - (2 * mx_px)
            avail_h = page_h_px - mt_px

            one_page = (request.args.get("onepage") or "").strip().lower() not in ("0", "false", "no")

            fit_css = f"""
              /* Force a deterministic print canvas */
              @page {{ size: letter; margin: 0 !important; }}
              html, body {{
                width: {page_w_px}px !important;
                height: {page_h_px}px !important;
                margin: 0 !important;
                padding: 0 !important;
                background: #fff !important;
                -webkit-print-color-adjust: exact !important;
                print-color-adjust: exact !important;
                overflow: hidden !important;
              }}
              #templatePrintRoot {{
                box-sizing: border-box !important;
                width: {avail_w}px !important;
                max-width: {avail_w}px !important;
                margin: {mt_px}px {mx_px}px 0 {mx_px}px !important;
                padding: 0 !important;
              }}
              /* Templates often center/limit width. Remove those constraints for PDF. */
              #templatePrintRoot .mx-auto {{ margin-left: 0 !important; margin-right: 0 !important; }}
              #templatePrintRoot .max-w-3xl,
              #templatePrintRoot .max-w-4xl,
              #templatePrintRoot .max-w-5xl,
              #templatePrintRoot .max-w-6xl,
              #templatePrintRoot .max-w-7xl {{ max-width: none !important; width: 100% !important; }}
              /* Remove visual-only chrome that wastes space */
              #templatePrintRoot * {{
                -webkit-print-color-adjust: exact !important;
                print-color-adjust: exact !important;
              }}
              #templatePrintRoot .shadow,
              #templatePrintRoot .shadow-sm,
              #templatePrintRoot .shadow-md,
              #templatePrintRoot .shadow-lg,
              #templatePrintRoot .shadow-xl {{
                box-shadow: none !important;
              }}
              /* Many templates use rounded corners; flatten for print to maximize usable area */
              #templatePrintRoot .rounded,
              #templatePrintRoot .rounded-lg,
              #templatePrintRoot .rounded-xl,
              #templatePrintRoot .rounded-2xl {{
                border-radius: 0 !important;
              }}

              /* Compaction presets: progressively reduce padding/spacing/font sizes */
              :root[data-pdf-compact="1"] #templatePrintRoot .p-12 {{ padding: 32px !important; }}
              :root[data-pdf-compact="1"] #templatePrintRoot .p-8 {{ padding: 22px !important; }}
              :root[data-pdf-compact="1"] #templatePrintRoot .space-y-10 > :not([hidden]) ~ :not([hidden]) {{ margin-top: 22px !important; }}
              :root[data-pdf-compact="1"] #templatePrintRoot .space-y-8 > :not([hidden]) ~ :not([hidden]) {{ margin-top: 16px !important; }}
              :root[data-pdf-compact="1"] #templatePrintRoot .mb-8 {{ margin-bottom: 18px !important; }}

              :root[data-pdf-compact="2"] #templatePrintRoot .p-12 {{ padding: 26px !important; }}
              :root[data-pdf-compact="2"] #templatePrintRoot .p-8 {{ padding: 18px !important; }}
              :root[data-pdf-compact="2"] #templatePrintRoot .p-5 {{ padding: 14px !important; }}
              :root[data-pdf-compact="2"] #templatePrintRoot .p-4 {{ padding: 12px !important; }}
              :root[data-pdf-compact="2"] #templatePrintRoot .space-y-10 > :not([hidden]) ~ :not([hidden]) {{ margin-top: 18px !important; }}
              :root[data-pdf-compact="2"] #templatePrintRoot .space-y-8 > :not([hidden]) ~ :not([hidden]) {{ margin-top: 12px !important; }}
              :root[data-pdf-compact="2"] #templatePrintRoot .mb-8 {{ margin-bottom: 14px !important; }}
              :root[data-pdf-compact="2"] #templatePrintRoot .mb-6 {{ margin-bottom: 12px !important; }}
              :root[data-pdf-compact="2"] #templatePrintRoot .text-5xl {{ font-size: 40px !important; }}
              :root[data-pdf-compact="2"] #templatePrintRoot .text-4xl {{ font-size: 32px !important; }}
              :root[data-pdf-compact="2"] #templatePrintRoot .text-xl {{ font-size: 18px !important; }}
              :root[data-pdf-compact="2"] #templatePrintRoot .text-lg {{ font-size: 16px !important; }}

              :root[data-pdf-compact="3"] #templatePrintRoot .p-12 {{ padding: 20px !important; }}
              :root[data-pdf-compact="3"] #templatePrintRoot .p-8 {{ padding: 14px !important; }}
              :root[data-pdf-compact="3"] #templatePrintRoot .p-5 {{ padding: 12px !important; }}
              :root[data-pdf-compact="3"] #templatePrintRoot .p-4 {{ padding: 10px !important; }}
              :root[data-pdf-compact="3"] #templatePrintRoot .space-y-10 > :not([hidden]) ~ :not([hidden]) {{ margin-top: 12px !important; }}
              :root[data-pdf-compact="3"] #templatePrintRoot .space-y-8 > :not([hidden]) ~ :not([hidden]) {{ margin-top: 10px !important; }}
              :root[data-pdf-compact="3"] #templatePrintRoot .space-y-6 > :not([hidden]) ~ :not([hidden]) {{ margin-top: 8px !important; }}
              :root[data-pdf-compact="3"] #templatePrintRoot .mb-8 {{ margin-bottom: 10px !important; }}
              :root[data-pdf-compact="3"] #templatePrintRoot .mb-6 {{ margin-bottom: 9px !important; }}
              :root[data-pdf-compact="3"] #templatePrintRoot .mb-5 {{ margin-bottom: 8px !important; }}
              :root[data-pdf-compact="3"] #templatePrintRoot .text-5xl {{ font-size: 34px !important; }}
              :root[data-pdf-compact="3"] #templatePrintRoot .text-4xl {{ font-size: 28px !important; }}
              :root[data-pdf-compact="3"] #templatePrintRoot .text-2xl {{ font-size: 20px !important; }}
              :root[data-pdf-compact="3"] #templatePrintRoot .text-xl {{ font-size: 16px !important; }}
              :root[data-pdf-compact="3"] #templatePrintRoot .text-lg {{ font-size: 15px !important; }}
              :root[data-pdf-compact="3"] #templatePrintRoot .leading-loose {{ line-height: 1.35 !important; }}
              :root[data-pdf-compact="3"] #templatePrintRoot .leading-relaxed {{ line-height: 1.30 !important; }}

              :root[data-pdf-compact="4"] #templatePrintRoot .p-12 {{ padding: 16px !important; }}
              :root[data-pdf-compact="4"] #templatePrintRoot .p-8 {{ padding: 12px !important; }}
              :root[data-pdf-compact="4"] #templatePrintRoot .p-5 {{ padding: 10px !important; }}
              :root[data-pdf-compact="4"] #templatePrintRoot .p-4 {{ padding: 8px !important; }}
              :root[data-pdf-compact="4"] #templatePrintRoot .space-y-10 > :not([hidden]) ~ :not([hidden]) {{ margin-top: 10px !important; }}
              :root[data-pdf-compact="4"] #templatePrintRoot .space-y-8 > :not([hidden]) ~ :not([hidden]) {{ margin-top: 8px !important; }}
              :root[data-pdf-compact="4"] #templatePrintRoot .space-y-6 > :not([hidden]) ~ :not([hidden]) {{ margin-top: 7px !important; }}
              :root[data-pdf-compact="4"] #templatePrintRoot .mb-8 {{ margin-bottom: 8px !important; }}
              :root[data-pdf-compact="4"] #templatePrintRoot .mb-6 {{ margin-bottom: 7px !important; }}
              :root[data-pdf-compact="4"] #templatePrintRoot .mb-5 {{ margin-bottom: 6px !important; }}
              :root[data-pdf-compact="4"] #templatePrintRoot .text-5xl {{ font-size: 30px !important; }}
              :root[data-pdf-compact="4"] #templatePrintRoot .text-4xl {{ font-size: 24px !important; }}
              :root[data-pdf-compact="4"] #templatePrintRoot .text-2xl {{ font-size: 18px !important; }}
              :root[data-pdf-compact="4"] #templatePrintRoot .text-xl {{ font-size: 15px !important; }}
              :root[data-pdf-compact="4"] #templatePrintRoot .text-lg {{ font-size: 14px !important; }}
              :root[data-pdf-compact="4"] #templatePrintRoot .leading-loose {{ line-height: 1.25 !important; }}
              :root[data-pdf-compact="4"] #templatePrintRoot .leading-relaxed {{ line-height: 1.22 !important; }}

              /* Level 5: very aggressive (still tries to preserve look) */
              :root[data-pdf-compact="5"] #templatePrintRoot .p-12 {{ padding: 12px !important; }}
              :root[data-pdf-compact="5"] #templatePrintRoot .p-8 {{ padding: 10px !important; }}
              :root[data-pdf-compact="5"] #templatePrintRoot .p-5 {{ padding: 8px !important; }}
              :root[data-pdf-compact="5"] #templatePrintRoot .p-4 {{ padding: 6px !important; }}
              :root[data-pdf-compact="5"] #templatePrintRoot .space-y-10 > :not([hidden]) ~ :not([hidden]) {{ margin-top: 8px !important; }}
              :root[data-pdf-compact="5"] #templatePrintRoot .space-y-8 > :not([hidden]) ~ :not([hidden]) {{ margin-top: 7px !important; }}
              :root[data-pdf-compact="5"] #templatePrintRoot .space-y-6 > :not([hidden]) ~ :not([hidden]) {{ margin-top: 6px !important; }}
              :root[data-pdf-compact="5"] #templatePrintRoot .mb-8 {{ margin-bottom: 6px !important; }}
              :root[data-pdf-compact="5"] #templatePrintRoot .mb-6 {{ margin-bottom: 6px !important; }}
              :root[data-pdf-compact="5"] #templatePrintRoot .mb-5 {{ margin-bottom: 5px !important; }}
              :root[data-pdf-compact="5"] #templatePrintRoot .text-5xl {{ font-size: 26px !important; }}
              :root[data-pdf-compact="5"] #templatePrintRoot .text-4xl {{ font-size: 22px !important; }}
              :root[data-pdf-compact="5"] #templatePrintRoot .text-2xl {{ font-size: 16px !important; }}
              :root[data-pdf-compact="5"] #templatePrintRoot .text-xl {{ font-size: 14px !important; }}
              :root[data-pdf-compact="5"] #templatePrintRoot .text-lg {{ font-size: 13px !important; }}
              :root[data-pdf-compact="5"] #templatePrintRoot .text-base {{ font-size: 12.5px !important; }}
              :root[data-pdf-compact="5"] #templatePrintRoot .text-sm {{ font-size: 11.5px !important; }}
              :root[data-pdf-compact="5"] #templatePrintRoot .leading-loose {{ line-height: 1.18 !important; }}
              :root[data-pdf-compact="5"] #templatePrintRoot .leading-relaxed {{ line-height: 1.16 !important; }}

              /* Level 6: last resort before vertical squeeze */
              :root[data-pdf-compact="6"] #templatePrintRoot .p-12 {{ padding: 10px !important; }}
              :root[data-pdf-compact="6"] #templatePrintRoot .p-8 {{ padding: 8px !important; }}
              :root[data-pdf-compact="6"] #templatePrintRoot .p-5 {{ padding: 7px !important; }}
              :root[data-pdf-compact="6"] #templatePrintRoot .p-4 {{ padding: 5px !important; }}
              :root[data-pdf-compact="6"] #templatePrintRoot .space-y-10 > :not([hidden]) ~ :not([hidden]) {{ margin-top: 6px !important; }}
              :root[data-pdf-compact="6"] #templatePrintRoot .space-y-8 > :not([hidden]) ~ :not([hidden]) {{ margin-top: 6px !important; }}
              :root[data-pdf-compact="6"] #templatePrintRoot .space-y-6 > :not([hidden]) ~ :not([hidden]) {{ margin-top: 5px !important; }}
              :root[data-pdf-compact="6"] #templatePrintRoot .mb-8 {{ margin-bottom: 5px !important; }}
              :root[data-pdf-compact="6"] #templatePrintRoot .mb-6 {{ margin-bottom: 5px !important; }}
              :root[data-pdf-compact="6"] #templatePrintRoot .mb-5 {{ margin-bottom: 4px !important; }}
              :root[data-pdf-compact="6"] #templatePrintRoot .text-5xl {{ font-size: 24px !important; }}
              :root[data-pdf-compact="6"] #templatePrintRoot .text-4xl {{ font-size: 20px !important; }}
              :root[data-pdf-compact="6"] #templatePrintRoot .text-2xl {{ font-size: 15px !important; }}
              :root[data-pdf-compact="6"] #templatePrintRoot .text-xl {{ font-size: 13px !important; }}
              :root[data-pdf-compact="6"] #templatePrintRoot .text-lg {{ font-size: 12.5px !important; }}
              :root[data-pdf-compact="6"] #templatePrintRoot .text-base {{ font-size: 12px !important; }}
              :root[data-pdf-compact="6"] #templatePrintRoot .text-sm {{ font-size: 11px !important; }}
              :root[data-pdf-compact="6"] #templatePrintRoot .leading-loose {{ line-height: 1.12 !important; }}
              :root[data-pdf-compact="6"] #templatePrintRoot .leading-relaxed {{ line-height: 1.12 !important; }}
            """

            with sync_playwright() as p:
                browser = p.chromium.launch()
                ctx = browser.new_context(viewport={"width": page_w_px, "height": page_h_px})
                if cookie_list:
                    ctx.add_cookies(cookie_list)
                page = ctx.new_page()
                page.goto(resume_url, wait_until="networkidle", timeout=60_000)
                page.wait_for_selector("#templatePrintRoot", timeout=60_000)
                page.emulate_media(media="print")
                page.add_style_tag(content=fit_css)

                if one_page:
                    fit_result = page.evaluate(
                        """({availW, availH}) => {
                          const rootWrap = document.getElementById('templatePrintRoot');
                          const root = rootWrap?.firstElementChild;
                          if (!rootWrap || !root) return null;

                          // Ensure stable layout
                          rootWrap.style.overflow = 'hidden';
                          root.style.zoom = '1';
                          root.style.transform = '';
                          root.style.transformOrigin = 'top left';
                          document.documentElement.dataset.pdfCompact = '0';

                          const levels = ['0','1','2','3','4','5','6'];
                          // Prefer: minimal distortion. We choose the level that yields the highest required sy (closest to 1).
                          let best = { level: '0', zoom: 1, sy: 1, reqSy: 1, w: 0, h: 0, fits: false };

                          for (const level of levels) {
                            document.documentElement.dataset.pdfCompact = level;
                            root.style.zoom = '1';
                            root.style.transform = '';
                            // force reflow
                            root.getBoundingClientRect();

                            let rect = root.getBoundingClientRect();
                            const w0 = Math.max(1, rect.width);
                            const h0 = Math.max(1, rect.height);
                            // Always fill width (avoid left/right whitespace).
                            let zoom = Math.min(1, (availW / w0) * 0.999);
                            zoom = Math.max(0.45, zoom);
                            root.style.zoom = String(zoom);

                            rect = root.getBoundingClientRect();
                            const reqSy = Math.min(1, (availH / Math.max(1, rect.height)) * 0.999);
                            const sy = reqSy; // Always fit (may be < 1 for very long resumes)
                            if (sy < 1) {
                              root.style.transform = `scale(1, ${sy})`;
                              rect = root.getBoundingClientRect();
                            }

                            const fits = rect.width <= availW + 1 && rect.height <= availH + 1;
                            // Prefer: higher reqSy (less squeeze), then higher zoom (bigger).
                            const better =
                              (reqSy > best.reqSy + 1e-6) ||
                              (Math.abs(reqSy - best.reqSy) < 1e-6 && zoom > best.zoom + 1e-6);
                            if (better) best = { level, zoom, sy, reqSy, w: rect.width, h: rect.height, fits };
                            // If we reach a "good enough" fit with minimal squeeze, stop early.
                            if (fits && reqSy >= 0.92) return best;
                          }

                          // Use best attempt if nothing fit perfectly (should be rare)
                          document.documentElement.dataset.pdfCompact = best.level;
                          root.style.zoom = String(best.zoom);
                          root.style.transform = best.sy !== 1 ? `scale(1, ${best.sy})` : '';
                          const rect2 = root.getBoundingClientRect();
                          const fits2 = rect2.width <= availW + 1 && rect2.height <= availH + 1;
                          return { ...best, w: rect2.width, h: rect2.height, fits: fits2 };
                        }""",
                        {"availW": avail_w, "availH": avail_h},
                    )
                    # Always force a 1-page fit by construction (zoom + sy). If the browser still reports overflow
                    # due to rounding, reduce sy slightly.
                    if isinstance(fit_result, dict) and not fit_result.get("fits"):
                        page.evaluate(
                            """() => {
                              const rootWrap = document.getElementById('templatePrintRoot');
                              const root = rootWrap?.firstElementChild;
                              if (!root) return;
                              const cur = (root.style.transform || '').match(/scale\\(1,\\s*([0-9.]+)\\)/);
                              if (!cur) return;
                              const sy = Math.max(0.5, parseFloat(cur[1]) * 0.995);
                              root.style.transform = `scale(1, ${sy})`;
                            }"""
                        )

                pdf_bytes = page.pdf(
                    format="Letter",
                    print_background=True,
                    margin={"top": "0", "right": "0", "bottom": "0", "left": "0"},
                    prefer_css_page_size=True,
                )
                browser.close()

            buf = BytesIO(pdf_bytes)
            buf.seek(0)
            filename = f"{template_name or 'resume'}.pdf"
            resp = send_file(buf, mimetype="application/pdf", as_attachment=False, download_name=filename)
            resp.headers["Content-Disposition"] = f'inline; filename="{filename}"'
            resp.headers["X-Content-Type-Options"] = "nosniff"
            resp.headers["X-PDF-Engine"] = "playwright-chromium"
            return resp
        except Exception as e:
            try:
                logger.error(f"Playwright PDF render failed: {str(e)}")
            except Exception:
                pass
            return (
                "High-fidelity PDF rendering failed. "
                f"Details: {str(e)}\n\n"
                "If you want the basic black-and-white PDF, open this URL with '?simple=1'.",
                500,
            )

    # Try to generate a proper PDF with ReportLab.
    try:
        from reportlab.lib.pagesizes import letter
        from reportlab.lib.units import inch
        from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
        from reportlab.lib.enums import TA_CENTER
        from reportlab.lib import colors
        from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, ListFlowable, ListItem
    except Exception:
        return (
            "PDF export is not available because the server PDF dependency is missing. "
            "Install 'reportlab' and restart the server.",
            500,
        )

    def s(v):
        return (v or "").strip() if isinstance(v, str) else (str(v).strip() if v is not None else "")

    name = s(structured.get("name"))
    email = s(structured.get("email"))
    phone = s(structured.get("phone"))
    location = s(structured.get("location"))
    summary = s(structured.get("summary"))

    experience = structured.get("experience") or []
    education = structured.get("education") or []
    projects = structured.get("projects") or []
    certifications = structured.get("certifications") or []
    skills = structured.get("skills") or []
    custom_sections = structured.get("custom_sections") or []

    buf = BytesIO()
    doc = SimpleDocTemplate(
        buf,
        pagesize=letter,
        leftMargin=0.65 * inch,
        rightMargin=0.65 * inch,
        topMargin=0.6 * inch,
        bottomMargin=0.6 * inch,
        title=(name or "Resume"),
        author=(name or ""),
    )

    styles = getSampleStyleSheet()
    styles.add(ParagraphStyle(name="HeaderName", parent=styles["Title"], alignment=TA_CENTER, spaceAfter=6))
    styles.add(ParagraphStyle(name="HeaderMeta", parent=styles["Normal"], alignment=TA_CENTER, textColor=colors.grey))
    styles.add(ParagraphStyle(name="SectionHeading", parent=styles["Heading2"], spaceBefore=14, spaceAfter=6))
    styles.add(ParagraphStyle(name="ItemTitle", parent=styles["Heading4"], spaceBefore=4, spaceAfter=2))
    styles.add(ParagraphStyle(name="Small", parent=styles["Normal"], fontSize=9, leading=11))

    def join_meta(parts):
        parts = [p for p in parts if p]
        return "  •  ".join(parts)

    story = []

    # Header
    story.append(Paragraph(name or "Resume", styles["HeaderName"]))
    meta = join_meta([email, phone, location])
    if meta:
        story.append(Paragraph(meta, styles["HeaderMeta"]))
    story.append(Spacer(1, 10))

    # Summary
    if summary:
        story.append(Paragraph("Summary", styles["SectionHeading"]))
        story.append(Paragraph(summary.replace("\n", "<br/>"), styles["Normal"]))

    # Experience
    if isinstance(experience, list) and experience:
        story.append(Paragraph("Experience", styles["SectionHeading"]))
        for item in experience:
            if not isinstance(item, dict):
                continue
            title = s(item.get("title"))
            company = s(item.get("company"))
            duration = s(item.get("duration"))
            heading = " — ".join([p for p in [title, company] if p])
            if duration:
                heading = f"{heading} ({duration})" if heading else duration
            if heading:
                story.append(Paragraph(heading, styles["ItemTitle"]))

            desc = s(item.get("description"))
            if desc:
                bullets = [b.strip("• \t") for b in desc.splitlines() if b.strip()]
                if len(bullets) > 1:
                    story.append(
                        ListFlowable(
                            [ListItem(Paragraph(b, styles["Normal"]), leftIndent=12) for b in bullets],
                            bulletType="bullet",
                            leftIndent=14,
                            bulletFontName="Helvetica",
                            bulletFontSize=9,
                        )
                    )
                else:
                    story.append(Paragraph(desc.replace("\n", "<br/>"), styles["Normal"]))

    # Education
    if isinstance(education, list) and education:
        story.append(Paragraph("Education", styles["SectionHeading"]))
        for item in education:
            if not isinstance(item, dict):
                continue
            degree = s(item.get("degree"))
            inst = s(item.get("institution"))
            year = s(item.get("year"))
            details = s(item.get("details"))

            heading = " — ".join([p for p in [degree, inst] if p])
            if year:
                heading = f"{heading} ({year})" if heading else year
            if heading:
                story.append(Paragraph(heading, styles["ItemTitle"]))
            if details:
                story.append(Paragraph(details.replace("\n", "<br/>"), styles["Normal"]))

    # Projects
    if isinstance(projects, list) and projects:
        story.append(Paragraph("Projects", styles["SectionHeading"]))
        for item in projects:
            if not isinstance(item, dict):
                continue
            title = s(item.get("title"))
            desc = s(item.get("description"))
            if title:
                story.append(Paragraph(title, styles["ItemTitle"]))
            if desc:
                story.append(Paragraph(desc.replace("\n", "<br/>"), styles["Normal"]))

    # Skills
    if isinstance(skills, list) and skills:
        story.append(Paragraph("Skills", styles["SectionHeading"]))
        story.append(Paragraph(", ".join([s(x) for x in skills if s(x)]), styles["Normal"]))

    # Certifications
    if isinstance(certifications, list) and certifications:
        story.append(Paragraph("Certifications", styles["SectionHeading"]))
        story.append(
            ListFlowable(
                [ListItem(Paragraph(s(c), styles["Normal"]), leftIndent=12) for c in certifications if s(c)],
                bulletType="bullet",
                leftIndent=14,
                bulletFontName="Helvetica",
                bulletFontSize=9,
            )
        )

    # Custom sections
    if isinstance(custom_sections, list) and custom_sections:
        for sec in custom_sections:
            if not isinstance(sec, dict):
                continue
            heading = s(sec.get("heading"))
            if not heading:
                continue
            story.append(Paragraph(heading, styles["SectionHeading"]))
            items = sec.get("items") or []
            for it in items:
                if not isinstance(it, dict):
                    continue
                t = s(it.get("title"))
                sub = s(it.get("subtitle"))
                date = s(it.get("date"))
                content = s(it.get("content"))
                line = " — ".join([p for p in [t, sub] if p])
                if date:
                    line = f"{line} ({date})" if line else date
                if line:
                    story.append(Paragraph(line, styles["ItemTitle"]))
                if content:
                    story.append(Paragraph(content.replace("\n", "<br/>"), styles["Normal"]))

    # Always build at least something
    if not story:
        story = [Paragraph("No resume content found.", styles["Normal"])]

    doc.build(story)
    buf.seek(0)

    filename = f"{template_name or 'resume'}.pdf"
    resp = send_file(buf, mimetype="application/pdf", as_attachment=False, download_name=filename)
    resp.headers["Content-Disposition"] = f'inline; filename="{filename}"'
    resp.headers["X-Content-Type-Options"] = "nosniff"
    resp.headers["X-PDF-Engine"] = "reportlab"
    return resp


@app.get("/api/template-pdf")
def get_template_pdf():
    """
    Return an inline PDF for the currently-viewed template resume.

    This is intentionally server-generated (real application/pdf) so the user can open it
    in a new tab without relying on the client-side "Save as PDF"/print-dialog flow.
    """
    return _get_template_pdf_response(request.args.get("template"))


@app.get("/api/template-pdf/<template_name>.pdf")
def get_template_pdf_named(template_name):
    """
    Same as /api/template-pdf, but with a .pdf URL for maximum compatibility.
    """
    return _get_template_pdf_response(template_name)

@app.route("/termsprivacy")
def termsprivacy():
    return redirect(url_for('terms_privacy'), code=301)

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

# Blog post metadata for SEO optimization
BLOG_POSTS_METADATA = {
    'ats-optimization': {
        'title': 'How to Beat the ATS in 2025 | ResumaticAI',
        'meta_description': 'Master the art of creating ATS-friendly resumes with our comprehensive guide. Learn how Applicant Tracking Systems work and discover proven strategies to ensure your resume gets past automated screening.',
        'keywords': 'ATS optimization, applicant tracking system, resume keywords, ATS friendly resume, job application tips, resume writing',
        'og_title': 'How to Beat the ATS in 2025 - Complete Guide',
        'og_description': 'Learn proven strategies to create ATS-friendly resumes that pass automated screening systems and get you more job interviews.',
        'og_image': 'https://resumaticai.com/static/images/robot.png'
    },
    'Resume-objective': {
        'title': 'Resume Summary vs. Objective: Which Should You Use in 2025? | ResumaticAI',
        'meta_description': 'Learn the key differences between resume summaries and objectives, and discover which one will help you land more interviews in 2025.',
        'keywords': 'resume summary, resume objective, resume writing tips, career advice, job application, resume format',
        'og_title': 'Resume Summary vs. Objective: 2025 Guide',
        'og_description': 'Discover whether to use a resume summary or objective statement in 2025 to maximize your interview chances.',
        'og_image': 'https://resumaticai.com/static/images/vs.png'
    },
    'Power-words': {
        'title': 'Power Words to Use in Your Resume (And Ones to Avoid) | ResumaticAI',
        'meta_description': 'Discover the most impactful words to use in your resume and learn which overused phrases to avoid to make your application stand out.',
        'keywords': 'resume power words, action verbs, resume writing, job application, career tips, resume optimization',
        'og_title': 'Resume Power Words: What to Use and Avoid',
        'og_description': 'Learn which words will make your resume stand out and which ones to avoid for better job application success.',
        'og_image': 'https://resumaticai.com/static/images/power.jpg'
    },
    'no-experience': {
        'title': 'How to Write a Resume With No Work Experience | ResumaticAI',
        'meta_description': 'Get expert tips on creating a compelling resume when you\'re just starting out, with strategies to highlight your skills and potential.',
        'keywords': 'resume no experience, first resume, entry level resume, student resume, career starter, resume writing',
        'og_title': 'Resume Writing for Beginners: No Experience Needed',
        'og_description': 'Create a compelling resume even without work experience using our expert strategies and tips.',
        'og_image': 'https://resumaticai.com/static/images/noexperience.jpg'
    },
    'resume-format-2025': {
        'title': 'Best Resume Formats for 2025 (With Examples) | ResumaticAI',
        'meta_description': 'Explore the most effective resume formats for 2025, complete with real examples and guidelines for different career stages.',
        'keywords': 'resume format 2025, resume templates, resume examples, resume layout, career stages, resume design',
        'og_title': 'Best Resume Formats for 2025: Complete Guide',
        'og_description': 'Choose the perfect resume format for 2025 with our comprehensive guide and real examples.',
        'og_image': 'https://resumaticai.com/static/images/format.webp'
    },
    'resume-format-2026': {
        'title': 'Best Resume Formats for 2026 (With Examples) | ResumaticAI',
        'meta_description': 'See the best resume formats for 2026 with ATS-friendly examples. Learn when to use reverse-chronological vs. combination formats, how to structure skills, and whether to use PDF or DOCX.',
        'keywords': 'resume format 2026, resume templates, resume examples, resume layout, career stages, resume design',
        'og_title': 'Best Resume Formats for 2026: Complete Guide',
        'og_description': 'ATS-friendly resume formats, layout rules, and examples for 2026.',
        'og_image': 'https://resumaticai.com/static/images/format.webp'
    },
    'toptenmistakes': {
        'title': 'Top 10 Resume Mistakes to Avoid in 2025 | ResumaticAI',
        'meta_description': 'Learn the most common resume mistakes that can cost you job opportunities and how to avoid them in 2025.',
        'keywords': 'resume mistakes, resume errors, job application tips, resume writing, career advice, avoid resume mistakes',
        'og_title': 'Top 10 Resume Mistakes to Avoid in 2025',
        'og_description': 'Don\'t let these common resume mistakes cost you job opportunities. Learn how to avoid them.',
        'og_image': 'https://resumaticai.com/static/images/robot.png'
    },
    'tailorresumejob': {
        'title': 'How to Tailor Your Resume for Each Job Application | ResumaticAI',
        'meta_description': 'Learn proven strategies to customize your resume for each job application to increase your chances of getting interviews and job offers.',
        'keywords': 'tailor resume, customize resume, job application, resume customization, targeted resume, job-specific resume',
        'og_title': 'How to Tailor Your Resume for Each Job Application',
        'og_description': 'Master the art of customizing your resume for each job to maximize your interview chances and career success.',
        'og_image': 'https://resumaticai.com/static/images/robot.png'
    }
}

@app.route("/blog/<post>")
def blog_post(post):
    current_year = datetime.now().year

    # Canonicalize blog slugs to prevent 500s from template mismatches
    # Accept underscores/case-insensitive inputs and redirect to canonical slugs
    canonical_slug_map = {
        # key: normalized (lowercase, hyphens) -> value: canonical file/slug
        "toptenmistakes": "toptenmistakes",
        "ats-optimization": "ats-optimization",
        "resume-objective": "Resume-objective",
        "resume-summary-examples": "Resume-objective",
        "no-experience": "no-experience",
        "power-words": "Power-words",
    "resume-format-2025": "resume-format-2026",
    "resume-format-2026": "resume-format-2026",
        "tailorresumejob": "tailorresumejob",
    }

    requested_slug = post.strip()
    normalized_slug = requested_slug.replace("_", "-").lower()

    if normalized_slug in canonical_slug_map:
        canonical_slug = canonical_slug_map[normalized_slug]
        # Redirect variants to the canonical version for SEO consistency
        if requested_slug != canonical_slug:
            return redirect(url_for("blog_post", post=canonical_slug), code=301)
    else:
        # Unknown slug -> 404 instead of template error 500
        from flask import abort
        abort(404)

    # Get metadata for the blog post using the canonical slug
    post_metadata = BLOG_POSTS_METADATA.get(canonical_slug, {})

    try:
        return render_template(
            f"{canonical_slug}.html",
            year=current_year,
            user=current_user if current_user.is_authenticated else None,
            post_metadata=post_metadata,
        )
    except TemplateNotFound:
        # Fallback: if 2026 slug is requested but template file not present, use 2025 template
        file_slug = canonical_slug
        if canonical_slug == 'resume-format-2026':
            file_slug = 'resume-format-2025'
        return render_template(
            f"{file_slug}.html",
            year=current_year,
            user=current_user if current_user.is_authenticated else None,
            post_metadata=post_metadata,
        )

@app.route("/templates")
def templates():
    # Explicitly pass API key to handle Azure environment
    api_key = os.getenv('OPENAI_API_KEY')
    if not api_key:
        raise ValueError("OPENAI_API_KEY environment variable not set")
    
    # Configure timeout and retry for Azure reliability
    client_templates = OpenAI(
        api_key=api_key,
        timeout=60.0,
        max_retries=3
    )
    prompt= f'''Please create a python dictionary with the section names of the provided resume 
    as keys and the associated content as values.'''
    try:
            response = client_templates.chat.completions.create(
                model="gpt-4",
                messages=[{"role": "user", "content": prompt}]
            )
    except Exception as e:
            error_msg = str(e)
            print(f"OpenAI API Error: {error_msg}")
            logger.error(f"OpenAI API Error details: {type(e).__name__}: {error_msg}")
            raise ValueError(f"Failed to connect to OpenAI API: {error_msg}")

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
        # Load recent feedback submissions from CSV (if present)
        feedback_rows = []
        try:
            import csv
            feedback_path = 'download_feedback.csv'
            if os.path.exists(feedback_path):
                with open(feedback_path, 'r', encoding='utf-8', newline='') as f:
                    reader = csv.DictReader(f)
                    for row in reader:
                        feedback_rows.append({
                            'timestamp_iso': row.get('timestamp_iso', ''),
                            'user_id': row.get('user_id', ''),
                            'user_email': row.get('user_email', ''),
                            'rating': row.get('rating', ''),
                            'comment': row.get('comment', ''),
                            'comparison': row.get('comparison', ''),
                        })
                # Keep only the last 100, newest first
                feedback_rows = feedback_rows[-100:][::-1]
        except Exception as e:
            app.logger.warning(f"Failed to read download_feedback.csv: {str(e)}")
        
        # Debug logging to help troubleshoot
        app.logger.info(f"Analytics data structure: {type(analytics_data)}")
        if isinstance(analytics_data, dict) and 'summary' in analytics_data:
            app.logger.info(f"Summary data: {analytics_data['summary']}")
        else:
            app.logger.warning(f"Unexpected analytics data structure: {analytics_data}")
        
        return render_template("admin_stats.html", 
                             analytics=analytics_data, 
                             user=current_user,
                             feedback_rows=feedback_rows)
    except Exception as e:
        app.logger.error(f"Error loading statistics: {str(e)}")
        flash(f"Error loading statistics: {str(e)}", "danger")
        return redirect(url_for("index"))

@app.route('/admin/feedback.csv')
@login_required
def admin_feedback_csv():
    """Download raw feedback CSV (admin only)."""
    if not getattr(current_user, "is_admin", False):
        return jsonify({"error": "Forbidden"}), 403
    try:
        path = 'download_feedback.csv'
        if not os.path.exists(path):
            # Return an empty CSV with header for convenience
            from io import StringIO, BytesIO
            buf = StringIO("timestamp_iso,user_id,user_email,rating,comment,comparison\n")
            data = buf.getvalue().encode('utf-8')
            bio = BytesIO(data)
            bio.seek(0)
            return send_file(bio, mimetype='text/csv', as_attachment=True, download_name='download_feedback.csv')
        return send_file(path, mimetype='text/csv', as_attachment=True, download_name='download_feedback.csv')
    except Exception as e:
        app.logger.error(f"Failed to serve feedback CSV: {str(e)}")
        return jsonify({"error": "Internal server error"}), 500


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
        'contact': {'priority': '0.7', 'changefreq': 'monthly'},
        'privacy': {'priority': '0.3', 'changefreq': 'yearly'},
        'terms_privacy': {'priority': '0.3', 'changefreq': 'yearly'},
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
        'resume-format-2026',
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
    # If not authenticated, redirect to login to ensure gated downloads
    try:
        if not current_user.is_authenticated:
            return redirect(url_for('login'))
    except Exception:
        # In case flask-login context isn't available, fall back to login route
        return redirect(url_for('login'))
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


@app.route('/api/feedback/download', methods=['POST'])
@login_required
def feedback_download_api():
    """Collect quick feedback after a logged-in user clicks to download a resume."""
    try:
        data = request.get_json(silent=True) or {}
        rating = str(data.get('rating', '')).strip()
        comment = str(data.get('comment', '')).strip()
        comparison = str(data.get('comparison', '')).strip()
        # Persist minimally to CSV; avoids DB schema work
        import csv
        from datetime import datetime, timezone
        filename = 'download_feedback.csv'
        file_exists = os.path.exists(filename)
        with open(filename, 'a', newline='', encoding='utf-8') as f:
            writer = csv.writer(f)
            if not file_exists:
                writer.writerow(['timestamp_iso', 'user_id', 'user_email', 'rating', 'comment', 'comparison'])
            writer.writerow([
                datetime.now(timezone.utc).isoformat(),
                getattr(current_user, 'id', ''),
                getattr(current_user, 'email', ''),
                rating,
                comment[:500],
                comparison
            ])
        return jsonify({'status': 'ok'}), 200
    except Exception as e:
        logger.error(f"feedback_download_api error: {str(e)}")
        return jsonify({'status': 'error'}), 500

# Azure Table Storage setup
AZURE_TABLE_NAME = os.getenv('AZURE_TABLE_NAME', 'ResumeRevisions')
AZURE_STORAGE_ACCOUNT = os.getenv('AZURE_STORAGE_ACCOUNT')

def get_table_client(table_name: str = None):
    connection_string = os.getenv('AZURE_STORAGE_CONNECTION_STRING')
    if connection_string:
        service = TableServiceClient.from_connection_string(conn_str=connection_string)
    else:
        credential = DefaultAzureCredential()
        service = TableServiceClient(endpoint=f"https://{AZURE_STORAGE_ACCOUNT}.table.core.windows.net", credential=credential)
    table_client = service.get_table_client(table_name or AZURE_TABLE_NAME)
    try:
        table_client.create_table()
    except Exception:
        pass  # Table may already exist
    return table_client

# Azure Users table helpers
AZURE_USERS_TABLE = os.getenv('AZURE_USERS_TABLE', 'Users')

def get_users_table_client():
    return get_table_client(AZURE_USERS_TABLE)

def upsert_user_profile_azure(user_obj: 'User') -> None:
    try:
        table_client = get_users_table_client()
        provider = "google" if str(user_obj.id).isdigit() else ("facebook" if str(user_obj.id).startswith("facebook_") else "other")
        entity = {
            'PartitionKey': str(user_obj.id),
            'RowKey': 'profile',
            'name': user_obj.name or '',
            'email': user_obj.email or '',
            'created_at': user_obj.created_at,
            'is_admin': bool(getattr(user_obj, 'is_admin', False)),
            'provider': provider,
        }
        table_client.upsert_entity(entity)
    except Exception as e:
        logger.error(f"Failed to upsert user profile to Azure: {str(e)}")

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

#############################################
# Admin: Registered Users from Azure Revisions
#############################################

def _collect_registered_users(table_override: str = None):
    """Collect distinct users from Azure Table revisions with counts and basic profile."""
    table_client = get_table_client(table_override)
    counts = {}
    # Ensure we iterate through all pages
    pager = table_client.list_entities(select=["PartitionKey"])
    for entity in pager:
        uid = entity.get("PartitionKey")
        if not uid:
            continue
        counts[uid] = counts.get(uid, 0) + 1

    results = []
    for uid, n in counts.items():
        user_obj = users.get(uid)
        email = getattr(user_obj, "email", "") if user_obj else ""
        name = getattr(user_obj, "name", "") if user_obj else ""
        provider = "google" if str(uid).isdigit() else ("facebook" if str(uid).startswith("facebook_") else "other")
        results.append({
            "id": uid,
            "email": email,
            "name": name,
            "provider": provider,
            "revisions": n,
        })

    results.sort(key=lambda x: x["revisions"], reverse=True)
    return results

@app.route('/admin/registered_users.json')
@login_required
def registered_users_json():
    if not getattr(current_user, "is_admin", False):
        return jsonify({"error": "Forbidden"}), 403
    data = _collect_registered_users(request.args.get('table') or None)
    return jsonify({"users": data})

@app.route('/admin/registered_users')
@login_required
def registered_users_view():
    if not getattr(current_user, "is_admin", False):
        flash("You do not have permission to view this page.", "danger")
        return redirect(url_for("index"))
    data = _collect_registered_users()
    return render_template('admin_registered_users.html', users=data)

@app.route('/admin/registered_users.csv')
@login_required
def registered_users_csv():
    if not getattr(current_user, "is_admin", False):
        return jsonify({"error": "Forbidden"}), 403
    rows = _collect_registered_users(request.args.get('table') or None)
    # Build CSV in-memory
    lines = ["id,name,email,provider,revisions"]
    for r in rows:
        # naive CSV escaping for commas and quotes
        def esc(v):
            s = str(v or "")
            if any(c in s for c in [',','"','\n','\r']):
                s = '"' + s.replace('"','""') + '"'
            return s
        line = ",".join([esc(r["id"]), esc(r["name"]), esc(r["email"]), esc(r["provider"]), str(r["revisions"])])
        lines.append(line)
    csv_data = "\n".join(lines) + "\n"
    return Response(csv_data, mimetype='text/csv', headers={
        'Content-Disposition': 'attachment; filename=registered_users.csv'
    })

@app.route('/admin/google_emails.json')
@login_required
def google_emails_json():
    if not getattr(current_user, "is_admin", False):
        return jsonify({"error": "Forbidden"}), 403
    # Read directly from persistent users file to include all registered users
    try:
        data = {}
        if os.path.exists(USERS_FILE):
            with open(USERS_FILE, 'r', encoding='utf-8') as f:
                data = json.load(f)
        emails = sorted({
            (u.get('email') or '').strip().lower()
            for u in data.values()
            if u and u.get('email') and str(u.get('id', '')).isdigit()
        })
        return jsonify({"count": len(emails), "emails": emails})
    except Exception as e:
        logger.error(f"google_emails_json error: {str(e)}")
        return jsonify({"error": "Internal server error"}), 500

@app.route('/admin/google_emails.csv')
@login_required
def google_emails_csv():
    if not getattr(current_user, "is_admin", False):
        return jsonify({"error": "Forbidden"}), 403
    # Read directly from persistent users file to include all registered users
    try:
        data = {}
        if os.path.exists(USERS_FILE):
            with open(USERS_FILE, 'r', encoding='utf-8') as f:
                data = json.load(f)
        emails = sorted({
            (u.get('email') or '').strip().lower()
            for u in data.values()
            if u and u.get('email') and str(u.get('id', '')).isdigit()
        })
        csv_data = "email\n" + "\n".join(emails) + "\n"
        return Response(csv_data, mimetype='text/csv', headers={
            'Content-Disposition': 'attachment; filename=google_emails.csv'
        })
    except Exception as e:
        logger.error(f"google_emails_csv error: {str(e)}")
        return jsonify({"error": "Internal server error"}), 500

# Admin: Users from Azure Users table
@app.route('/admin/users_azure.json')
@login_required
def users_azure_json():
    if not getattr(current_user, "is_admin", False):
        return jsonify({"error": "Forbidden"}), 403
    provider_filter = (request.args.get('provider') or '').strip().lower()
    try:
        table_client = get_users_table_client()
        users_list = []
        for e in table_client.list_entities():
            if e.get('RowKey') != 'profile':
                continue
            provider = (e.get('provider') or '').lower()
            if provider_filter and provider != provider_filter:
                continue
            users_list.append({
                'id': e.get('PartitionKey'),
                'name': e.get('name') or '',
                'email': e.get('email') or '',
                'provider': provider or 'other',
                'created_at': e.get('created_at') or '',
                'is_admin': bool(e.get('is_admin', False)),
            })
        # Sort by created_at desc if present
        from datetime import datetime
        def parse_dt(s):
            try:
                return datetime.fromisoformat(s)
            except Exception:
                return datetime.min
        users_list.sort(key=lambda x: parse_dt(x.get('created_at') or ''), reverse=True)
        return jsonify({"count": len(users_list), "users": users_list})
    except Exception as e:
        logger.error(f"users_azure_json error: {str(e)}")
        return jsonify({"error": "Internal server error"}), 500

@app.route('/admin/users_azure.csv')
@login_required
def users_azure_csv():
    if not getattr(current_user, "is_admin", False):
        return jsonify({"error": "Forbidden"}), 403
    provider_filter = (request.args.get('provider') or '').strip().lower()
    try:
        table_client = get_users_table_client()
        rows = []
        for e in table_client.list_entities():
            if e.get('RowKey') != 'profile':
                continue
            provider = (e.get('provider') or '').lower()
            if provider_filter and provider != provider_filter:
                continue
            rows.append({
                'id': e.get('PartitionKey'),
                'name': e.get('name') or '',
                'email': e.get('email') or '',
                'provider': provider or 'other',
                'created_at': e.get('created_at') or '',
                'is_admin': 'true' if e.get('is_admin', False) else 'false',
            })
        def esc(v):
            s = str(v or "")
            if any(c in s for c in [',','"','\n','\r']):
                s = '"' + s.replace('"','""') + '"'
            return s
        header = ['id','name','email','provider','created_at','is_admin']
        lines = [','.join(header)]
        for r in rows:
            lines.append(','.join([esc(r[h]) for h in header]))
        csv_data = "\n".join(lines) + "\n"
        return Response(csv_data, mimetype='text/csv', headers={
            'Content-Disposition': 'attachment; filename=users_azure.csv'
        })
    except Exception as e:
        logger.error(f"users_azure_csv error: {str(e)}")
        return jsonify({"error": "Internal server error"}), 500

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

@app.route('/counter.html')
def counter_html_legacy():
    """Redirect old /counter.html URL to the canonical /counter route."""
    return redirect(url_for('counter_page'), code=301)

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


def _load_email_config_if_missing() -> None:
    """Load/override SMTP creds from newsletter_config.txt into environment."""
    import os
    try:
        if os.path.exists('newsletter_config.txt'):
            with open('newsletter_config.txt', 'r', encoding='utf-8') as f:
                for line in f:
                    line = line.strip()
                    if not line or line.startswith('#'):
                        continue
                    if '=' in line:
                        key, val = line.split('=', 1)
                        key = key.strip()
                        val = val.strip()
                        if key in ('NEWSLETTER_EMAIL', 'NEWSLETTER_PASSWORD', 'SMTP_SERVER', 'SMTP_PORT', 'CONTACT_RECIPIENT') and val:
                            os.environ[key] = val
    except Exception as e:
        logger.error(f"Failed to load newsletter_config.txt: {str(e)}")

# Contact form email helper
def send_contact_email(name: str, sender_email: str, message: str) -> None:
    """Send contact form submission to the site owner via SMTP.

    Uses NEWSLETTER_EMAIL/NEWSLETTER_PASSWORD for SMTP auth to avoid duplicating config.
    Recipient defaults to CONTACT_RECIPIENT or the site owner's email.
    """
    import os
    import smtplib
    from email.mime.text import MIMEText
    from email.mime.multipart import MIMEMultipart

    _load_email_config_if_missing()
    smtp_server = os.getenv('SMTP_SERVER', 'smtp.gmail.com')
    smtp_port = int(os.getenv('SMTP_PORT', '587'))
    auth_email = os.getenv('NEWSLETTER_EMAIL', '').strip()
    auth_password = os.getenv('NEWSLETTER_PASSWORD', '').strip().replace(' ', '')
    recipient = os.getenv('CONTACT_RECIPIENT', 'yaronyaronlid@gmail.com').strip()

    if not auth_email or not auth_password:
        raise ValueError('Email credentials not configured. Set NEWSLETTER_EMAIL and NEWSLETTER_PASSWORD.')

    subject = 'New Contact Form Submission - ResumaticAI'
    text_body = (
        f"You have a new contact form submission from ResumaticAI.\n\n"
        f"Name: {name or 'N/A'}\n"
        f"Email: {sender_email or 'N/A'}\n\n"
        f"Message:\n{message or ''}\n"
    )

    msg = MIMEMultipart('alternative')
    msg['Subject'] = subject
    msg['From'] = auth_email
    msg['To'] = recipient
    # Prefer plain text; add Reply-To for easy response
    msg.add_header('Reply-To', sender_email or auth_email)
    msg.attach(MIMEText(text_body, 'plain', 'utf-8'))

    server = smtplib.SMTP(smtp_server, smtp_port)
    server.starttls()
    server.login(auth_email, auth_password)
    server.send_message(msg)
    server.quit()


def save_contact_message(name: str, sender_email: str, message: str) -> None:
    """Persist contact messages locally if email delivery fails."""
    import csv
    from datetime import datetime
    filename = 'contact_messages.csv'
    try:
        file_exists = os.path.exists(filename)
        with open(filename, 'a', newline='', encoding='utf-8') as f:
            writer = csv.writer(f)
            if not file_exists:
                writer.writerow(['timestamp_iso', 'name', 'email', 'message'])
            writer.writerow([datetime.utcnow().isoformat(), name or '', sender_email or '', message or ''])
    except Exception as e:
        logger.error(f'Failed to save contact message fallback: {str(e)}')

# Contact form route
@app.route('/contact', methods=['GET', 'POST'])
def contact():
    if request.method == 'POST':
        name = request.form.get('name')
        email = request.form.get('email')
        message = request.form.get('message')
        website = request.form.get('website', '')  # honeypot
        try:
            # Basic spam checks: honeypot must be empty, submission must not be too fast (<2s)
            ts_str = request.form.get('_ts', '0')
            try:
                form_ts = int(ts_str)
            except ValueError:
                form_ts = 0
            import time
            now_s = int(time.time())
            # Lower threshold to reduce false positives from autofill
            too_fast = (now_s - form_ts) < 1 if form_ts else False

            if website.strip() or too_fast:
                logger.info('Contact form blocked by spam checks (honeypot/timing).')
                flash('Thank you for contacting us!', 'success')
                return render_template('contact.html', form_ts=int(time.time()))

            send_contact_email(name, email, message)
            flash('Thank you for contacting us! Your message has been sent.', 'success')
        except Exception as e:
            logger.error(f"Contact form email failed: {str(e)}")
            # Fallback: persist the message so it's not lost
            try:
                save_contact_message(name, email, message)
                flash('Thank you for contacting us! We received your message.', 'info')
            except Exception:
                flash('We could not send your message due to a server error. Please try again later.', 'danger')
        return render_template('contact.html', form_ts=int(time.time()))
    # GET: set initial timestamp
    import time
    return render_template('contact.html', form_ts=int(time.time()))

# Offline page route
@app.route('/offline.html')
def offline():
    """Offline page for PWA functionality"""
    return render_template('offline.html')

# 410 Gone for legacy/old thin URLs
@app.route('/index_old')
@app.route('/index_old.html')
@app.route('/indexfiver')
@app.route('/indexfiver.html')
@app.route('/templates.html')
def gone_legacy_urls():
    return Response('This URL has been permanently removed.', status=410, mimetype='text/plain')

# Minimal site search endpoint to support Sitelinks SearchBox
@app.route('/search')
def site_search():
    query = request.args.get('q', '').strip()
    # Simple, non-indexable helper page for users and bots
    html = f"""<!DOCTYPE html>
<html lang=\"en\"><head><meta charset=\"utf-8\">\n<meta name=\"robots\" content=\"noindex, nofollow\">\n<title>Search | ResumaticAI</title></head>
<body style=\"font-family: system-ui, -apple-system, Segoe UI, Roboto, sans-serif; padding: 24px;\">\n<h1>Search</h1>\n<p>Showing results for: <strong>{query}</strong></p>\n<p>We don't have on-site search yet. Try exploring our <a href=\"/blog\">blog</a> or the <a href=\"/\">homepage</a>.</p>\n</body></html>"""
    return Response(html, mimetype='text/html')

# Explicitly set X-Robots-Tag for low-value or transactional routes
@app.after_request
def add_robots_headers(response):
    try:
        noindex_endpoints = {
            'results_route',
            'login',
            'signup',
            'thank_you',
            'unsubscribe',
            'counter_page',
            'counter_html_legacy',
        }
        noindex_paths = {
            '/results',
            '/login',
            '/signup',
            '/thank_you',
            '/unsubscribe',
            '/counter',
            '/counter.html',
        }
        if (request.endpoint in noindex_endpoints) or (request.path in noindex_paths):
            response.headers['X-Robots-Tag'] = 'noindex, nofollow'
    except Exception:
        pass
    return response




#########################################################
#################TEMPLATES
'''
# --- imports (single set) ---
from flask import Flask, render_template, request, send_file, abort, url_for, redirect, jsonify
from io import BytesIO
import os



# Optional: nicer DOCX output if available
try:
    from docx import Document
except Exception:
    Document = None

# ---- Template registry (IDs match the gallery data) ----
TEMPLATES = {
    "modern-citrus": {"name": "Modern Citrus", "style": "Modern"},
    "modern-slate": {"name": "Modern Slate", "style": "Modern"},
    "modern-aurora": {"name": "Modern Aurora", "style": "Modern"},
    "classic-elegant": {"name": "Classic Elegant", "style": "Classic"},
    "classic-simplicity": {"name": "Classic Simplicity", "style": "Classic"},
    "classic-structure": {"name": "Classic Structure", "style": "Classic"},
    "creative-pastel": {"name": "Creative Pastel", "style": "Creative"},
    "creative-neo": {"name": "Creative Neo", "style": "Creative"},
    "creative-spark": {"name": "Creative Spark", "style": "Creative"},
}

def get_template_or_404(tid: str):
    t = TEMPLATES.get(tid)
    if not t:
        abort(404, f"Unknown template id: {tid}")
    return t

# ---- Pages ----
@app.route("/resume-templates", endpoint="resume_templates")
def resume_templates_view():
    return render_template("resume_templates.html")

@app.route("/builder", endpoint="resume_builder")
def resume_builder():
    tpl = request.args.get("template", "")
    t = TEMPLATES.get(tpl)
    return render_template("builder.html", template_id=tpl, template_meta=t)

# Optional alias if old links use /app/builder
@app.route("/app/builder", endpoint="resume_builder_alias")
def resume_builder_alias():
    qs = request.query_string.decode("utf-8")
    target = url_for("resume_builder")
    return redirect(f"{target}?{qs}" if qs else target, code=302)

# ---- Minimal export endpoints ----
@app.post("/export/docx")
def export_docx():
    data = request.get_json(force=True)
    tpl_id = data.get("template")
    t = get_template_or_404(tpl_id)

    name = data.get("name", "")
    title = data.get("title", "")
    summary = data.get("summary", "")
    exp = data.get("experience", []) or []
    skills = data.get("skills", []) or []

    bio = BytesIO()
    if Document:
        doc = Document()
        doc.add_heading(name or "Your Name", 0)
        if title:
            doc.add_paragraph(title)
        doc.add_paragraph(f"Template: {t['name']} ({t['style']})")
        doc.add_heading("Summary", level=1)
        doc.add_paragraph(summary or "")
        doc.add_heading("Experience", level=1)
        for item in exp:
            p = doc.add_paragraph()
            p.add_run(item.get("role", "Role")).bold = True
            company = item.get("company", "Company")
            years = item.get("years", "")
            p.add_run(f" — {company}" + (f" ({years})" if years else ""))
            for b in item.get("bullets", []):
                doc.add_paragraph(b, style="List Bullet")
        if skills:
            doc.add_heading("Skills", level=1)
            doc.add_paragraph(", ".join(skills))
        doc.save(bio)
    else:
        bio.write(
            f"{name}\n{title}\nTemplate: {t['name']} ({t['style']})\n\nSummary:\n{summary}\n".encode("utf-8")
        )
    bio.seek(0)
    return send_file(
        bio,
        as_attachment=True,
        download_name=f"{tpl_id}.docx",
        mimetype="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    )

@app.post("/export/pdf")
def export_pdf():
    # Tiny placeholder PDF. For production: WeasyPrint / wkhtmltopdf / ReportLab.
    data = request.get_json(force=True)
    tpl_id = data.get("template")
    t = get_template_or_404(tpl_id)
    name = data.get("name", "")
    title = data.get("title", "")
    text = f"{name} — {title} | {t['name']} ({t['style']})".replace("\\", "\\\\").replace("(", "\\(").replace(")", "\\)")

    buf = BytesIO()
    buf.write(b"%PDF-1.4\n%\xe2\xe3\xcf\xd3\n")
    objs = []
    objs.append("1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n")
    objs.append("2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n")
    objs.append("3 0 obj\n<< /Type /Page /Parent 2 0 R /Resources << /Font << /F1 5 0 R >> >> /MediaBox [0 0 612 792] /Contents 4 0 R >>\nendobj\n")
    stream = f"BT /F1 18 Tf 72 720 Td ({text}) Tj ET"
    objs.append(f"4 0 obj\n<< /Length {len(stream)} >>\nstream\n{stream}\nendstream\nendobj\n")
    objs.append("5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n")

    offsets = []
    for o in objs:
        offsets.append(buf.tell())
        buf.write(o.encode("utf-8"))
    xref = buf.tell()
    buf.write(f"xref\n0 {len(objs)+1}\n".encode("utf-8"))
    buf.write(b"0000000000 65535 f \n")
    for off in offsets:
        buf.write(f"{off:010d} 00000 n \n".encode("utf-8"))
    buf.write(f"trailer\n<< /Size {len(objs)+1} /Root 1 0 R >>\nstartxref\n{xref}\n%%EOF".encode("utf-8"))
    buf.seek(0)
    return send_file(buf, as_attachment=True, download_name=f"{tpl_id}.pdf", mimetype="application/pdf")

from jinja2 import TemplateNotFound
import os

@app.route("/", endpoint="home")
def home():
    # Serve index.html if present; otherwise fall back to the gallery
    try:
        return render_template("index.html")
    except TemplateNotFound:
        return redirect(url_for("resume_templates"))

##########################################
'''
from flask import send_from_directory
import os

import os

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
FILE_PATH = os.path.join(BASE_DIR, '610528eb-2434-4e0c-b4c5-1f54f21877ea.html')


@app.route('/610528eb-2434-4e0c-b4c5-1f54f21877ea.html')
def serve_file():
    return send_from_directory(
        directory=BASE_DIR,
        path='610528eb-2434-4e0c-b4c5-1f54f21877ea.html'
    )




import os
from flask import send_file

@app.route("/react")
@app.route("/react/<path:subpath>")
def react_app(subpath=None):
    return send_file(os.path.join("static", "react", "index.html"))




# Schema definitions
RESUME_STRUCTURE_SCHEMA = """
{
    "name": "string",
    "email": "string",
    "phone": "string",
    "location": "string",
    "summary": "string",
    "experience": [
        {
            "title": "string",
            "company": "string",
            "duration": "string",
            "description": "string (bullet points as newline separated text)"
        }
    ],
    "education": [
        {
            "degree": "string",
            "institution": "string",
            "year": "string"
        }
    ],
    "projects": [
        {
            "title": "string",
            "description": "string",
            "technologies": "string (comma separated)",
            "link": "string (optional)"
        }
    ],
    "certifications": [
        {
            "name": "string",
            "issuer": "string",
            "year": "string"
        }
    ],
    "skills": ["string"],
    "custom_sections": [
        {
            "heading": "string (The original section title, e.g. 'Publications', 'Volunteering', 'Awards')",
            "items": [
                {
                    "title": "string (e.g. Award Name or Role)",
                    "subtitle": "string (e.g. Organization or Event)",
                    "date": "string (optional)",
                    "content": "string (Description or details)"
                }
            ]
        }
    ]
}
"""


def parse_resume(revised_resume):
    try:
        # Initialize the client inside the function to avoid blocking startup
        # Explicitly pass API key to handle Azure environment
        api_key = os.getenv('OPENAI_API_KEY')
        if not api_key:
            raise ValueError("OPENAI_API_KEY environment variable not set")
        
        # Configure timeout and other parameters for Azure reliability
        client = OpenAI(
            api_key=api_key,
            timeout=60.0,  # 60 second timeout
            max_retries=3  # Retry up to 3 times on transient errors
        )
        
        parsing_prompt = f"""
You are a data extraction engine. 
Extract structured data from the following RESUME TEXT into the specified JSON format.

Resume Text:
\"\"\"{revised_resume}\"\"\"

Output Format:
{RESUME_STRUCTURE_SCHEMA}
        
Rules:
1. Extract the content exactly as written in the source text.
2. Map standard sections to standard fields.
3. Map non-standard sections to 'custom_sections'.
4. Return ONLY valid JSON.
"""
        parsing_response = client.chat.completions.create(
            model="gpt-4o", 
            messages=[
                {"role": "system", "content": "You are a data extraction engine. Output only valid JSON."},
                {"role": "user", "content": parsing_prompt}
            ],
            response_format={"type": "json_object"}
        )

        parsing_content = parsing_response.choices[0].message.content
        
        # Remove markdown backticks if present (similar to revise_resume function)
        if parsing_content.startswith("```"):
            import re
            parsing_content = re.sub(r"^```(?:json)?\n", "", parsing_content)
            parsing_content = re.sub(r"\n```$", "", parsing_content)
            
        try:
            structured_resume = json.loads(parsing_content)
        except json.JSONDecodeError as e:
            logging.error(f"JSON Parse Error in parse_resume: {str(e)}")
            logging.error(f"Raw parsing content: {parsing_content[:500]}...")
            raise ValueError(f"Failed to parse resume structure: {str(e)}")
        return {"resume": structured_resume}
    except Exception as e:
        logging.error(f"Error in parse_resume: {str(e)}")
        import traceback
        traceback.print_exc()
        raise
           


if __name__ == "__main__":
    app.run(debug=True, host='127.0.0.1', port=5000)

