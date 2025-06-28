# Persistent User Storage

## Overview
Your Flask app now uses **persistent storage** to ensure user data is never lost, even when the app restarts or is updated.

## How It Works

### 1. Storage Location
- User data is saved to: `users_data.json`
- This file is created automatically in your app's root directory
- The file persists between app restarts

### 2. Data Stored
For each user, the following information is permanently saved:
- **User ID** (Google/Facebook unique identifier)
- **Name** (from social login)
- **Email address**
- **Registration timestamp** (when they first signed up)
- **Admin status** (based on email address)

### 3. Automatic Operations
- **On App Startup**: Automatically loads all existing users from `users_data.json`
- **On User Registration**: Immediately saves new users to the file
- **On User Login**: No data loss, existing users are preserved

## Benefits

### ✅ **Data Persistence**
- User information survives app restarts
- No data loss during updates or deployments
- Complete registration history preserved

### ✅ **Admin Access**
- All registered users visible in `/users` admin panel
- Registration dates tracked
- User growth metrics available

### ✅ **Reliability**
- Automatic file backup of user data
- Error handling for file operations
- Graceful fallback if file is corrupted

## File Structure

### `users_data.json` Example:
```json
{
  "google_123456789": {
    "id": "google_123456789",
    "name": "John Doe",
    "email": "john.doe@gmail.com",
    "created_at": "2025-06-22T10:30:00+00:00",
    "is_admin": false
  },
  "facebook_987654321": {
    "id": "facebook_987654321", 
    "name": "Jane Smith",
    "email": "jane.smith@example.com",
    "created_at": "2025-06-22T11:15:00+00:00",
    "is_admin": false
  }
}
```

## Testing

### Manual Test
Run the test script to verify storage is working:
```bash
python test_storage.py
```

### What to Expect
1. **First Run**: Creates `users_data.json` file
2. **User Signup**: Automatically adds users to the file
3. **App Restart**: Loads all existing users on startup
4. **Admin Panel**: Shows all registered users with timestamps

## Security

### Data Protection
- File is stored locally on your server
- No sensitive authentication data stored
- Only basic profile information saved

### Access Control
- Only admin users can view user list
- User data only accessible through authenticated routes
- No public access to user information

## Maintenance

### Backup
- The `users_data.json` file should be included in your backups
- File is human-readable JSON format
- Can be manually edited if needed

### Monitoring
- App logs show user loading/saving operations
- Console messages indicate successful operations
- Error messages show if file operations fail

## Migration

If you had users before implementing persistent storage:
- Previous users in memory are now saved to file
- No existing user data is lost
- New users will be automatically added to persistent storage

---

**Your user data is now fully persistent and will never be lost!** 🎉
