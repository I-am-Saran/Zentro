#!/usr/bin/env python3
"""
Test script to verify user creation and deletion functionality with unique email
"""

import requests
import json
import uuid

def test_create_user_unique():
    """Test creating a new user with unique email"""
    print("🧪 Testing user creation with unique email...")
    
    # Generate unique email
    unique_id = str(uuid.uuid4())[:8]
    email = f"testuser_{unique_id}@example.com"
    
    url = "http://localhost:8000/api/users"
    payload = {
        "username": f"testuser_{unique_id}",
        "full_name": f"Test User {unique_id}",
        "email": email,
        "password": "TestPassword123",
        "role": "User",
        "department": "IT",
        "phone_number": "+1234567890",
        "is_active": True
    }
    
    print(f"Creating user with email: {email}")
    
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

if __name__ == "__main__":
    print("🚀 Starting User Operations Test with Unique Email")
    print("=" * 60)
    
    # Test 1: Create a new user with unique email
    user_id = test_create_user_unique()
    print()
    
    # Test 2: Delete the user if creation was successful
    if user_id:
        if test_delete_user(user_id):
            print("\n✅ Both user creation and deletion are working correctly!")
        else:
            print("\n❌ User creation worked but deletion failed!")
    else:
        print("\n❌ User creation failed!")
    
    print("\n" + "=" * 60)
    print("🎯 Test completed!")