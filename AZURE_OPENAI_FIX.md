# Azure OpenAI API Key Configuration Fix

## Problem
The OpenAI API error "Failed to connect to OpenAI API. Please try again later." was occurring only on Azure deployment because the `OPENAI_API_KEY` environment variable was not being properly passed to the OpenAI client.

**Root Cause**: The OpenAI client was being initialized without explicitly passing the API key. While this works locally (where `load_dotenv()` loads from `.env`), it fails on Azure because:
1. Azure doesn't automatically read `.env` files
2. The OpenAI Python SDK needs the API key explicitly set or available in the environment

## Solution Implemented

### Code Changes
Updated three locations in your codebase to explicitly pass the API key to OpenAI clients:

1. **app.py - `revise_resume()` function (line ~446)**
   ```python
   api_key = os.getenv('OPENAI_API_KEY')
   if not api_key:
       raise ValueError("OPENAI_API_KEY environment variable not set")
   client = OpenAI(api_key=api_key)
   ```

2. **app.py - `/templates` route (line ~827)**
   ```python
   api_key = os.getenv('OPENAI_API_KEY')
   if not api_key:
       raise ValueError("OPENAI_API_KEY environment variable not set")
   client_templates = OpenAI(api_key=api_key)
   ```

3. **newsletter.py - `NewsletterGenerator.__init__()` (line ~37)**
   ```python
   api_key = os.getenv('OPENAI_API_KEY')
   if not api_key:
       raise ValueError("OPENAI_API_KEY environment variable not set")
   self.client = OpenAI(api_key=api_key)
   ```

## How to Configure on Azure

### Option 1: Azure App Service Configuration (Recommended)
1. Go to your Azure App Service in the Azure Portal
2. Navigate to **Settings > Configuration**
3. Click **+ New application setting**
4. Add the following:
   - **Name**: `OPENAI_API_KEY`
   - **Value**: Your actual OpenAI API key (from `.env`)
   - **Deployment slot setting** (optional): Check if you want this only for production
5. Click **OK** and then **Save**
6. The app will automatically restart and load the new environment variable

### Option 2: Using Azure CLI
```powershell
az webapp config appsettings set --resource-group <resource-group> --name <app-service-name> --settings OPENAI_API_KEY="your-api-key-here"
```

### Option 3: Using Azure Resource Manager (ARM) Template
Add to your template:
```json
{
  "type": "Microsoft.Web/sites/config",
  "apiVersion": "2021-02-01",
  "name": "[concat(parameters('appServiceName'), '/web')]",
  "properties": {
    "appSettings": [
      {
        "name": "OPENAI_API_KEY",
        "value": "[parameters('openaiApiKey')]"
      }
    ]
  }
}
```

## Verification Steps

1. **Local Testing**
   - Ensure `.env` file has `OPENAI_API_KEY` set
   - Run `python app.py` and test resume submission
   - Should work as before

2. **Azure Testing**
   - Set the environment variable in Azure App Service
   - Deploy the updated code
   - Test the resume submission feature
   - Error message should now display more specific details if API key is missing

## Security Notes ⚠️

**IMPORTANT**: Your `.env` file contains the actual API key. Make sure:
1. ✅ `.env` is in `.gitignore` (never commit it)
2. ✅ Don't share your API key with anyone
3. ✅ Rotate your API key if it's been exposed
4. ✅ In production, use Azure Key Vault instead of plain text environment variables:
   - Store the key in Azure Key Vault
   - Use Managed Identity to access it from the app
   - Reference it in App Configuration

### Azure Key Vault Setup (Advanced)
```powershell
# Create a Key Vault secret
az keyvault secret set --vault-name <vault-name> --name "openai-api-key" --value "your-api-key"

# Grant access using Managed Identity
az keyvault set-policy --name <vault-name> --object-id <managed-identity-object-id> --secret-permissions get
```

## Testing the Fix

After deploying to Azure with the environment variable set, test by:
1. Opening your Azure-deployed app
2. Going to the resume builder/submission page
3. Uploading a resume
4. Submitting for optimization
5. Should now process without the OpenAI connection error

## Rollback (if needed)
If you need to revert these changes, the original code used:
```python
client = OpenAI()  # No explicit API key
```

But this won't work on Azure without the environment variable properly configured.

## Additional Debugging

If you still encounter issues after setting the environment variable:

1. **Check Azure logs**:
   ```powershell
   az webapp log tail --resource-group <resource-group> --name <app-service-name>
   ```

2. **Verify environment variable is set**:
   Add a debug route to your app (temporary):
   ```python
   @app.route('/debug/env')
   def debug_env():
       key = os.getenv('OPENAI_API_KEY')
       return {
           'openai_key_present': bool(key),
           'key_length': len(key) if key else 0
       }
   ```

3. **Check API key validity**:
   Test with a simple curl command to OpenAI API with your key to ensure it's correct and hasn't expired.

---
**Last Updated**: December 3, 2025
**Status**: ✅ Code fixes implemented - awaiting Azure environment variable configuration
