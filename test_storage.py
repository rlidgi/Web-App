#!/usr/bin/env python3
"""
Test Persistent User Storage
This script tests if the user storage system is working correctly.
"""

import sys
import os
import json

# Add the current directory to Python path to import from app.py
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

try:
    from app import User, load_users, save_users, add_user, users, USERS_FILE
    print("✅ Successfully imported user functions from app.py")
except ImportError as e:
    print(f"❌ Failed to import: {e}")
    sys.exit(1)

def test_persistent_storage():
    """Test the persistent storage functionality"""
    print("\n🧪 Testing Persistent User Storage...")
    
    # Check if users file exists
    if os.path.exists(USERS_FILE):
        print(f"📄 Users file exists: {USERS_FILE}")
        try:
            with open(USERS_FILE, 'r') as f:
                data = json.load(f)
                print(f"📊 Current users in file: {len(data)}")
        except Exception as e:
            print(f"⚠️  Error reading users file: {e}")
    else:
        print(f"📄 Users file doesn't exist yet: {USERS_FILE}")
    
    # Test loading users
    try:
        loaded_users = load_users()
        print(f"✅ Loaded {len(loaded_users)} users successfully")
    except Exception as e:
        print(f"❌ Error loading users: {e}")
        return False
    
    # Test adding a user
    try:
        test_user = User(
            id="test_user_123",
            name="Test User",
            email="test@example.com"
        )
        
        # Save to memory and file
        add_user(test_user)
        print("✅ Successfully added test user")
        
        # Verify it was saved to file
        if os.path.exists(USERS_FILE):
            with open(USERS_FILE, 'r') as f:
                data = json.load(f)
                if "test_user_123" in data:
                    print("✅ Test user found in persistent storage")
                    
                    # Clean up test user
                    if "test_user_123" in users:
                        del users["test_user_123"]
                        save_users()
                        print("🧹 Cleaned up test user")
                else:
                    print("❌ Test user not found in persistent storage")
                    return False
        
        return True
        
    except Exception as e:
        print(f"❌ Error testing user storage: {e}")
        return False

def show_current_users():
    """Show all current users"""
    print(f"\n👥 Current Users ({len(users)} total):")
    print("-" * 50)
    
    if not users:
        print("No users currently registered")
        return
    
    for user_id, user in users.items():
        print(f"Name: {user.name}")
        print(f"Email: {user.email}")
        print(f"ID: {user_id}")
        print(f"Created: {user.created_at}")
        print(f"Admin: {user.is_admin}")
        print("-" * 50)

if __name__ == "__main__":
    print("🔧 Persistent Storage Test Tool")
    
    # Run tests
    if test_persistent_storage():
        print("\n✅ All tests passed! Persistent storage is working correctly.")
    else:
        print("\n❌ Tests failed! There may be an issue with persistent storage.")
    
    # Show current users
    show_current_users()
    
    print(f"\n📁 User data file location: {os.path.abspath(USERS_FILE)}")
    print("💡 This file will persist between app restarts!")
