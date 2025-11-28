#!/usr/bin/env python3
"""
Test script to verify user creation and deletion functionality
"""

import requests
import json

def test_create_user():
    """Test creating a new user"""
    print("🧪 Testing user creation...")
    
    url = "http://localhost:8000/api/users"
    payload = {
        "username": "testuser123",
        "full_name": "Test User 123",
        "email": "testuser123@example.com",
        "password": "TestPassword123",
        "role": "User",
        "department": "IT",
        "phone_number": "+1234567890",
        "is_active": True
    }
    
    try:
        response = requests.post(url, json=payload)
        print(f"Status Code: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            print("✅ User created successfully!")
            print(f"Response: {json.dumps(data, indent=2)}")
            return data.get('data', {}).get('id')
        else:
            print(f"❌ Failed to create user")
            print(f"Response: {response.text}")
            return None
            
    except Exception as e:
        print(f"❌ Error creating user: {e}")
        return None

def test_delete_user(user_id):
    """Test deleting a user"""
    print(f"🧪 Testing user deletion for ID: {user_id}...")
    
    url = f"http://localhost:8000/api/users/{user_id}"
    
    try:
        response = requests.delete(url)
        print(f"Status Code: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            print("✅ User deleted successfully!")
            print(f"Response: {json.dumps(data, indent=2)}")
            return True
        else:
            print(f"❌ Failed to delete user")
            print(f"Response: {response.text}")
            return False
            
    except Exception as e:
        print(f"❌ Error deleting user: {e}")
        return False

def test_get_users():
    """Test getting users to verify operations"""
    print("🧪 Testing get users...")
    
    url = "http://localhost:8000/api/users"
    
    try:
        response = requests.get(url)
        print(f"Status Code: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            users = data.get('data', [])
            print(f"✅ Found {len(users)} users")
            for user in users:
                print(f"  - {user.get('username')} ({user.get('email')}) - ID: {user.get('id')}")
            return users
        else:
            print(f"❌ Failed to get users")
            print(f"Response: {response.text}")
            return []
            
    except Exception as e:
        print(f"❌ Error getting users: {e}")
        return []

if __name__ == "__main__":
    print("🚀 Starting User Operations Test")
    print("=" * 50)
    
    # Test 1: Get current users
    users = test_get_users()
    print()
    
    # Test 2: Create a new user
    user_id = test_create_user()
    print()
    
    # Test 3: Verify user was created
    if user_id:
        print("🔍 Verifying user creation...")
        users_after = test_get_users()
        if len(users_after) > len(users):
            print("✅ User creation verified!")
        else:
            print("⚠️  User creation may have failed")
        print()
        
        # Test 4: Delete the user
        if test_delete_user(user_id):
            print()
            print("🔍 Verifying user deletion...")
            users_final = test_get_users()
            if len(users_final) == len(users):
                print("✅ User deletion verified!")
            else:
                print("⚠️  User deletion may have failed")
    
    print("\n" + "=" * 50)
    print("🎯 Test completed!")