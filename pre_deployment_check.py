#!/usr/bin/env python3
"""
Pre-Deployment Safety Check
Run this script before every deployment to ensure data safety
"""

import os
import sys
from deployment_backup import DeploymentBackupManager
import json

def check_critical_files():
    """Check if critical files exist and are readable"""
    critical_files = [
        "counter.json",
        "users_data.json", 
        "users_data_local.json"
    ]
    
    print("🔍 Checking critical files...")
    
    file_status = {}
    for file_name in critical_files:
        if os.path.exists(file_name):
            try:
                with open(file_name, 'r') as f:
                    data = json.load(f)
                file_status[file_name] = {
                    "exists": True,
                    "readable": True,
                    "size": os.path.getsize(file_name)
                }
                print(f"  ✅ {file_name} - {file_status[file_name]['size']} bytes")
            except Exception as e:
                file_status[file_name] = {
                    "exists": True,
                    "readable": False,
                    "error": str(e)
                }
                print(f"  ❌ {file_name} - Error reading: {str(e)}")
        else:
            file_status[file_name] = {"exists": False}
            print(f"  ⚠️  {file_name} - Not found")
    
    return file_status

def check_analytics_data():
    """Check analytics data and display current stats"""
    if os.path.exists("counter.json"):
        try:
            with open("counter.json", 'r') as f:
                data = json.load(f)
            
            print("\n📊 Current Analytics Data:")
            print(f"  Total Visits: {data.get('total_visits', 0)}")
            print(f"  Facebook Ad Visits: {data.get('facebook_ad_visits', 0)}")
            print(f"  Organic Visits: {data.get('organic_visits', 0)}")
            print(f"  Total Conversions: {data.get('total_conversions', 0)}")
            print(f"  Last Updated: {data.get('last_updated', 'Unknown')}")
            
            # Calculate daily stats summary
            daily_stats = data.get('daily_stats', {})
            if daily_stats:
                total_days = len(daily_stats)
                print(f"  Historical Data: {total_days} days of records")
            
            return True
        except Exception as e:
            print(f"\n❌ Error reading analytics data: {str(e)}")
            return False
    else:
        print("\n⚠️  No analytics data found (counter.json missing)")
        return False

def main():
    """Main pre-deployment check"""
    print("🚀 PRE-DEPLOYMENT SAFETY CHECK")
    print("=" * 50)
    
    # Check critical files
    file_status = check_critical_files()
    
    # Check analytics data
    analytics_ok = check_analytics_data()
    
    # Check if backup system is available
    print("\n🛡️  Backup System Check:")
    try:
        backup_manager = DeploymentBackupManager()
        backups = backup_manager.list_backups()
        print(f"  ✅ Backup system ready")
        print(f"  📁 Existing backups: {len(backups)}")
        if backups:
            latest = backups[0]
            print(f"  🕒 Latest backup: {latest['timestamp']}")
    except Exception as e:
        print(f"  ❌ Backup system error: {str(e)}")
        return False
    
    # Summary and recommendations
    print("\n🎯 DEPLOYMENT READINESS:")
    
    critical_files_ok = all(f.get("exists", False) and f.get("readable", False) 
                           for f in file_status.values())
    
    if critical_files_ok and analytics_ok:
        print("  ✅ All critical data is present and readable")
        print("  ✅ Analytics data is available")
        
        print("\n🔥 READY TO DEPLOY!")
        print("\n📋 Recommended next steps:")
        print("  1. Run: python deployment_backup.py backup")
        print("  2. Proceed with your deployment")
        print("  3. After deployment, verify /admin/stats page")
        
        return True
    else:
        print("  ❌ Critical issues found!")
        print("\n🚫 NOT READY TO DEPLOY!")
        print("\n📋 Issues to fix:")
        
        for file_name, status in file_status.items():
            if not status.get("exists", False):
                print(f"  - Missing file: {file_name}")
            elif not status.get("readable", False):
                print(f"  - Corrupted file: {file_name}")
        
        if not analytics_ok:
            print("  - Analytics data is corrupted or missing")
        
        return False

if __name__ == "__main__":
    success = main()
    
    if not success:
        sys.exit(1)  # Exit with error code if not ready
    
    print("\nPress Enter to continue...")
    input()
