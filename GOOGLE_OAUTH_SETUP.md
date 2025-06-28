# Google OAuth Setup Guide

## Problem
Your app is showing a `FileNotFoundError` for `client_secret.json` because the Google OAuth credentials file is missing.

## Solution

### Step 1: Get Google OAuth Credentials

1. **Go to Google Cloud Console**: https://console.cloud.google.com/
2. **Select your project** (or create one if you haven't)
3. **Enable Google+ API**:
   - Go to "APIs & Services" → "Library"
   - Search for "Google+ API" and enable it
4. **Create OAuth 2.0 credentials**:
   - Go to "APIs & Services" → "Credentials"
   - Click "Create Credentials" → "OAuth 2.0 Client IDs"
   - Choose "Web application"
   - Add authorized redirect URIs:
     - `http://localhost:5000/login/google/authorized` (for local development)
     - `https://resumaticai.com/login/google/authorized` (for production)
   - Click "Create"

### Step 2: Download and Configure Credentials

1. **Download the JSON file** from Google Cloud Console
2. **Rename it to `client_secret.json`**
3. **Place it in your project root directory** (same level as `app.py`)
4. **Replace the placeholder values** in the file with your actual credentials

### Step 3: For Production (Azure) - Use Environment Variables

For better security in production, set these environment variables in your Azure App Service:

1. Go to Azure Portal → Your App Service → Configuration → Application settings
2. Add these environment variables:
   - `GOOGLE_CLIENT_ID`: Your Google OAuth client ID
   - `GOOGLE_CLIENT_SECRET`: Your Google OAuth client secret

### Step 4: Test the Setup

1. **Local Development**: Run your Flask app and try Google login
2. **Production**: Deploy to Azure and test Google login

## Security Notes

- ✅ `client_secret.json` is now in `.gitignore` (won't be committed to version control)
- ✅ The app supports both file-based (development) and environment variable-based (production) credentials
- ⚠️ Never share your client secret publicly
- ⚠️ Keep your credentials secure

## Troubleshooting

If you still get errors:
1. Make sure `client_secret.json` is in the correct location
2. Verify the JSON format is correct
3. Check that your redirect URIs match exactly
4. Ensure the Google+ API is enabled in your Google Cloud project 