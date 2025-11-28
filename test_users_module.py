#!/usr/bin/env python3
"""Test script for enhanced Users module endpoints."""

import requests
import json

def test_users_endpoints():
    base_url = "http://127.0.0.1:8000"
    
    print("🧪 Testing Enhanced Users Module Endpoints")
    print("=" * 50)
    
    # Test 1: Get users with filters
    print("\n1️⃣ Testing /api/users with filters...")
    try:
        params = {
            "search": "john",
            "role": "DEV",
            "status": "active",
            "page": 1,
            "limit": 10
        }
        response = requests.get(f"{base_url}/api/users", params=params)
        print(f"   Status: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            users = data.get("data", [])
            pagination = data.get("pagination", {})
            print(f"   Users found: {len(users)}")
            print(f"   Pagination: {pagination}")
            if users:
                print(f"   First user: {users[0].get('display_name', 'N/A')} ({users[0].get('email', 'N/A')})")
        else:
            print(f"   Error: {response.text}")
    except Exception as e:
        print(f"   Error: {e}")
    
    # Test 2: Get user statistics
    print("\n2️⃣ Testing /api/users/stats...")
    try:
        response = requests.get(f"{base_url}/api/users/stats")
        print(f"   Status: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            stats = data.get("data", {})
            print(f"   Total users: {stats.get('total_users', 0)}")
            print(f"   Active users: {stats.get('active_users', 0)}")
            print(f"   Role distribution: {stats.get('role_distribution', {})}")
            print(f"   Account types: {stats.get('account_types', {})}")
        else:
            print(f"   Error: {response.text}")
    except Exception as e:
        print(f"   Error: {e}")
    
    # Test 3: Create a new user
    print("\n3️⃣ Testing user creation...")
    try:
        new_user = {
            "username": "testuser123",
            "full_name": "Test User",
            "email": "testuser123@example.com",
            "password": "Test@123456",
            "role": "QA",
            "department": "IT",
            "phone_number": "1234567890",
            "is_active": True
        }
        
        response = requests.post(f"{base_url}/api/users", json=new_user)
        print(f"   Status: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            print(f"   User created successfully!")
            print(f"   User ID: {data.get('data', {}).get('id', 'N/A')}")
        else:
            print(f"   Error: {response.text}")
    except Exception as e:
        print(f"   Error: {e}")
    
    # Test 4: Send invitation
    print("\n4️⃣ Testing invitation sending...")
    try:
        invitation = {
            "full_name": "Invited User",
            "email": "inviteduser@example.com",
            "role": "Developer",
            "department": "QA"
        }
        
        response = requests.post(f"{base_url}/api/invite", json=invitation)
        print(f"   Status: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            print(f"   Invitation sent successfully!")
        else:
            print(f"   Error: {response.text}")
    except Exception as e:
        print(f"   Error: {e}")
    
    print("\n✅ Users module testing completed!")

if __name__ == "__main__":
    test_users_endpoints()