#!/usr/bin/env python3
"""
Test script to check if the admin_users route is accessible
"""
import requests
import sys

def test_admin_route():
    print("🔍 Testing admin_users route accessibility...")
    
    try:
        # Test the route
        url = "http://127.0.0.1:5000/admin_users"
        print(f"📡 Requesting: {url}")
        
        response = requests.get(url, timeout=10)
        
        print(f"📊 Status Code: {response.status_code}")
        print(f"📋 Headers: {dict(response.headers)}")
        
        if response.status_code == 200:
            print("✅ Route is accessible!")
            print(f"📄 Content length: {len(response.text)} characters")
        elif response.status_code == 302:
            print("🔀 Route exists but redirecting (likely to login)")
            print(f"🔗 Redirect to: {response.headers.get('Location', 'Unknown')}")
        elif response.status_code == 404:
            print("❌ Route not found - this is the issue!")
        elif response.status_code == 403:
            print("🔒 Route exists but access denied")
        elif response.status_code == 500:
            print("💥 Server error - check Flask logs")
            print(f"📝 Error content: {response.text[:500]}")
        else:
            print(f"ℹ️ Unexpected status: {response.status_code}")
            print(f"📝 Response: {response.text[:200]}")
            
    except requests.exceptions.ConnectionError:
        print("❌ Could not connect to Flask app")
        print("💡 Make sure Flask is running: python app.py")
    except requests.exceptions.Timeout:
        print("⏰ Request timed out")
    except Exception as e:
        print(f"❌ Error: {e}")

def test_basic_routes():
    print("\n🌐 Testing basic routes...")
    
    basic_routes = [
        "http://127.0.0.1:5000/",
        "http://127.0.0.1:5000/users",
        "http://127.0.0.1:5000/login"
    ]
    
    for url in basic_routes:
        try:
            response = requests.get(url, timeout=5)
            print(f"  {url} -> {response.status_code}")
        except:
            print(f"  {url} -> ERROR")

if __name__ == "__main__":
    test_admin_route()
    test_basic_routes()
