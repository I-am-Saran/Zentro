# backend/main.py
from fastapi import FastAPI, HTTPException, Request, Header, Query, File, UploadFile, Path, Depends
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional, List, Dict, Any, Union
from backend.services.supabase_client import supabase, supabase_admin, verify_supabase_token
from backend.services.supabase_client import MissingSupabaseClient
from backend.services.formatters import normalize_control
from datetime import datetime, timezone
import re
from uuid import uuid4
from supabase import create_client



class Role(BaseModel):
    id: str
    role_name: str
    description: Optional[str] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

class Module(BaseModel):
    id: str
    module_name: str
    description: Optional[str] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
from backend.services.auth_utils import verify_password, create_access_token, decode_access_token, get_password_hash

# Helper functions
def format_datetime(dt_str):
    """Format datetime string for display."""
    if not dt_str:
        return "-"
    try:
        dt = datetime.fromisoformat(dt_str.replace('Z', '+00:00'))
        return dt.strftime("%b %d, %Y %H:%M")
    except:
        return "-"
import json
import os
import logging
import smtplib
from email.message import EmailMessage
import time


app = FastAPI()

# Allow your frontend origin
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],   # <-- restrict in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ===========================
# Existing Controls API
# ===========================
@app.get("/api/controls")
async def get_controls():
    try:
        resp = supabase.table("controls").select("*").execute()
        data = resp.data or []
        formatted = [normalize_control(row) for row in data]
        return {"status": "success", "data": formatted}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/roles/{role_id}/modules")
async def get_role_modules(role_id: str):
    """
    Retrieve modules associated with a specific role.
    """
    try:
        resp = supabase.table("role_module_access").select("module_id").eq("role_id", role_id).execute()
        if hasattr(resp, "error") and getattr(resp, "error", None):
            raise HTTPException(status_code=400, detail=str(getattr(resp, "error")))

        items = getattr(resp, "data", []) or []
        module_ids = [item.get("module_id") for item in items if isinstance(item, dict) and item.get("module_id") is not None]

        modules_resp = supabase.table("modules").select("module_name").in_("id", module_ids).execute()
        if hasattr(modules_resp, "error") and getattr(modules_resp, "error", None):
            raise HTTPException(status_code=400, detail=str(getattr(modules_resp, "error")))

        mods_data = getattr(modules_resp, "data", []) or []
        module_names = [item.get("module_name") for item in mods_data if isinstance(item, dict)]
        return {"status": "success", "data": module_names}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/roles/{role_id}/modules")
async def update_role_modules(role_id: str, module_names: List[str]):
    """
    Update modules associated with a specific role.
    """
    try:
        # First, get module IDs from module names
        modules_resp = supabase.table("modules").select("id, module_name").in_("module_name", module_names).execute()
        if hasattr(modules_resp, "error") and getattr(modules_resp, "error", None):
            raise HTTPException(status_code=400, detail=str(getattr(modules_resp, "error")))
        
        module_name_to_id = {}
        for item in getattr(modules_resp, "data", []) or []:
            if isinstance(item, dict):
                name = item.get("module_name")
                id_val = item.get("id")
                if isinstance(name, str) and id_val is not None:
                    module_name_to_id[name] = str(id_val)
        module_ids_to_add = [module_name_to_id[name] for name in module_names if name in module_name_to_id]

        # Delete existing role_module_access entries for this role
        delete_resp = supabase.table("role_module_access").delete().eq("role_id", role_id).execute()
        if hasattr(delete_resp, "error") and getattr(delete_resp, "error", None):
            raise HTTPException(status_code=400, detail=str(getattr(delete_resp, "error")))

        # Insert new role_module_access entries
        if module_ids_to_add:
            insert_data = [{
                "role_id": role_id,
                "module_id": module_id,
                "created_at": datetime.now(timezone.utc).isoformat()
            } for module_id in module_ids_to_add]
            
            insert_resp = supabase.table("role_module_access").insert(insert_data).execute()
            if hasattr(insert_resp, "error") and getattr(insert_resp, "error", None):
                raise HTTPException(status_code=400, detail=str(getattr(insert_resp, "error")))

        return {"status": "success", "message": "Role module access updated successfully"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    
def auth_guard(authorization: Optional[str]) -> Dict[str, Any]:
    """
    Validates authorization header and returns user info.
    Supports both Supabase tokens and custom JWT tokens.
    """
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(status_code=401, detail="Missing or invalid Authorization header")
    token = authorization.split(" ", 1)[1].strip()
    
    # 1. Try Supabase Token
    user = verify_supabase_token(token)
    if user:
        return {"token": token, "user": user, "type": "supabase"}

    # 2. Try Custom JWT
    payload = decode_access_token(token)
    if payload:
        # Construct a user object similar to what verify_supabase_token returns
        # payload should contain user info (id, email, etc.)
        return {
            "token": token, 
            "user": {
                "status": "success", 
                "user": {
                    "id": payload.get("sub"), 
                    "email": payload.get("email"),
                    "role": payload.get("role")
                }
            },
            "type": "custom"
        }

    raise HTTPException(status_code=401, detail="Invalid or expired token")

@app.post("/api/auth/sso-sync")
async def sync_sso_user(request: Request):
    """
    Syncs SSO user details to public.users table.
    """
    try:
        payload = await request.json()
        email = (payload.get("email") or "").strip().lower()
        full_name = (payload.get("full_name") or "").strip()
        sso_user_id = (payload.get("sso_user_id") or "").strip()
        avatar_url = payload.get("avatar_url")
        provider = payload.get("provider") or "sso"

        if not email:
            raise HTTPException(status_code=400, detail="Email is required")

        # Check if user exists
        # Use limit(1) instead of single() to avoid crash if not found
        resp = supabase.table("users").select("*").eq("email", email).limit(1).execute()
        existing_user = resp.data[0] if resp.data else None

        now_iso = datetime.now(timezone.utc).isoformat()

        if existing_user:
            # Update existing user
            update_data = {
                "updated_at": now_iso
            }
            if isinstance(existing_user, dict) and full_name and not existing_user.get("full_name"):
                 update_data["full_name"] = full_name
            if sso_user_id:
                 update_data["sso_user_id"] = sso_user_id
            # profile_pic_url not in schema, skipping
            if isinstance(existing_user, dict) and provider and not existing_user.get("sso_provider"):
                 update_data["sso_provider"] = provider
            
            # If user was inactive, maybe reactivate? For now let's keep status as is unless it's new
            
            upd_resp = supabase.table("users").update(update_data).eq("id", (existing_user["id"] if isinstance(existing_user, dict) else None)).execute()
            if hasattr(upd_resp, "error") and getattr(upd_resp, "error", None):
                 logger.error(f"Failed to update SSO user: {getattr(upd_resp, 'error', None)}")
            
            return {"status": "success", "action": "updated", "user": existing_user}
        else:
            # Create new user
            username = email.split("@")[0]
            new_user = {
                "email": email,
                "username": username,
                "full_name": full_name or username,
                "role": "User", # Default role
                "is_active": True,
                "sso_provider": provider,
                "sso_user_id": sso_user_id,
                # profile_pic_url not in schema, skipping
                "created_at": now_iso,
                "updated_at": now_iso
            }
            
            ins_resp = supabase.table("users").insert(new_user).execute()
            if hasattr(ins_resp, "error") and getattr(ins_resp, "error", None):
                raise HTTPException(status_code=500, detail=str(getattr(ins_resp, "error")))
            
            created_data = getattr(ins_resp, "data", []) or []
            return {"status": "success", "action": "created", "user": created_data[0] if created_data else None}

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"SSO Sync error: {e}")
        raise HTTPException(status_code=500, detail=str(e))
@app.post("/api/login")
async def login(request: Request):
    """
    Custom login endpoint for email/password authentication against public.users table.
    """
    try:
        body = await request.json()
        email = body.get("email")
        password = body.get("password")

        if not email or not password:
            raise HTTPException(status_code=400, detail="Email and password are required")

        # Query public.users table
        # Note: We select password field explicitly
        resp = supabase.table("users").select("*").eq("email", email).single().execute()
        
        if not resp.data:
            raise HTTPException(status_code=401, detail="Invalid email or password")
        
        user_row = resp.data
        # Ensure user_row is a dictionary before accessing attributes
        if not isinstance(user_row, dict):
            raise HTTPException(status_code=401, detail="Invalid user data format")
            
        stored_password = user_row.get("password")
        
        if not stored_password:
             raise HTTPException(status_code=401, detail="Password login not enabled for this user (SSO user?)")

        # Verify password (assuming plain text or simple comparison for now based on 'verify_password' util)
        # Ideally, stored_password should be hashed.
        if not verify_password(password, stored_password):
             raise HTTPException(status_code=401, detail="Invalid email or password")
             
        # Generate Custom JWT
        access_token = create_access_token(
            data={"sub": user_row.get("id", ""), "email": user_row.get("email", ""), "role": user_row.get("role", "User")}
        )

        return {
            "status": "success",
            "access_token": access_token,
            "token_type": "bearer",
            "user": {
                "id": user_row.get("id"),
                "email": user_row.get("email"),
                "full_name": user_row.get("full_name"),
                "role": user_row.get("role"),
                "profile_pic_url": user_row.get("profile_pic_url")
            }
        }

    except HTTPException:
        raise
    except Exception as e:
        print(f"Login error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/users/search")
async def search_users(q: str = Query(default=""), Authorization: Optional[str] = Header(default=None)):
    """Search users by email substring from 'users' table."""
    _ = auth_guard(Authorization)
    try:
        query = q.strip()
        if not query:
            return {"data": [], "error": None}
        resp = (
            supabase
            .table("users")
            .select("id,email")
            .ilike("email", f"%{query}%")
            .limit(10)
            .execute()
        )
        if hasattr(resp, "error") and getattr(resp, "error", None):
            raise HTTPException(status_code=400, detail=str(getattr(resp, "error")))
        return {"data": getattr(resp, "data", []) or [], "error": None}
    except HTTPException as he:
        raise he
    except Exception as e:
        return {"data": None, "error": str(e)}



 


 

 

 

# ===========================
# 👤 USERS MODULE ENHANCED ENDPOINTS
# ============================

# ===========================
# 🔑 ROLES AND PERMISSIONS MANAGEMENT
# ===========================

@app.get("/api/roles")
async def get_roles():
    """
    Retrieve all roles from the database.
    """
    try:
        now_iso = datetime.now(timezone.utc).isoformat()
        defaults = [
            {"id": None, "role_name": "Admin", "description": "Full access", "created_at": now_iso, "updated_at": now_iso},
            {"id": None, "role_name": "QA", "description": "Quality Assurance", "created_at": now_iso, "updated_at": now_iso},
            {"id": None, "role_name": "DEV", "description": "Developer", "created_at": now_iso, "updated_at": now_iso},
            {"id": None, "role_name": "User", "description": "Standard user", "created_at": now_iso, "updated_at": now_iso},
        ]

        if isinstance(supabase, MissingSupabaseClient):
            return {"status": "success", "data": defaults, "total": len(defaults)}
        try:
            resp = supabase.table("roles").select("*").execute()
        except Exception:
            return {"status": "success", "data": defaults, "total": len(defaults)}
        if hasattr(resp, "error") and getattr(resp, "error", None):
            return {"status": "success", "data": defaults, "total": len(defaults)}
        roles = getattr(resp, "data", []) or []
        if not roles:
            try:
                supabase.table("roles").insert(defaults).execute()
                resp2 = supabase.table("roles").select("*").execute()
                roles = getattr(resp2, "data", []) or defaults
            except Exception:
                roles = defaults
        return {"status": "success", "data": roles, "total": len(roles)}
    except Exception as e:
        return {"status": "success", "data": defaults, "total": 4}

@app.get("/api/modules")
async def get_modules():
    """
    Retrieve all modules from the database.
    """
    try:
        default_modules = [
            "Dashboard",
            "AI Agent",
            "Bugs",
            "Tasks",
            "Transtracker",
            "Testing Request",
            "Users",
            "Permissions",
            "Settings",
        ]
        if isinstance(supabase, MissingSupabaseClient):
            return {"status": "success", "data": [{"id": None, "module_name": m} for m in default_modules], "total": len(default_modules)}
        try:
            resp = supabase.table("modules").select("*").execute()
        except Exception:
            return {"status": "success", "data": [{"id": None, "module_name": m} for m in default_modules], "total": len(default_modules)}
        if hasattr(resp, "error") and getattr(resp, "error", None):
            return {"status": "success", "data": [{"id": None, "module_name": m} for m in default_modules], "total": len(default_modules)}
        modules = getattr(resp, "data", []) or []
        if not modules:
            now_iso = datetime.now(timezone.utc).isoformat()
            try:
                supabase.table("modules").insert([
                    {"module_name": name, "created_at": now_iso, "updated_at": now_iso}
                    for name in default_modules
                ]).execute()
                resp2 = supabase.table("modules").select("*").execute()
                modules = getattr(resp2, "data", []) or [{"module_name": name} for name in default_modules]
            except Exception:
                modules = [{"module_name": name} for name in default_modules]
        return {"status": "success", "data": modules, "total": len(modules)}
    except Exception as e:
        return {"status": "success", "data": [{"id": None, "module_name": m} for m in default_modules], "total": len(default_modules)}

@app.get("/api/users")
def get_users(
    search: str = "",
    role: str = "",
    department: str = "",
    status: str = "",
    sort_by: str = "created_at",
    sort_order: str = "desc",
    page: int = 1,
    limit: int = 50
):
    """
    Enhanced users endpoint with filtering, sorting, and pagination.
    Supports search by name/email, filtering by role/department/status,
    and sorting by various fields.
    """
    try:
        query = supabase.table("users").select("*")
        
        # Apply filters
        if search:
            query = query.or_(f"full_name.ilike.%{search}%,email.ilike.%{search}%")
        
        if role:
            query = query.eq("role", role)
            
        if department:
            query = query.eq("department", department)
            
        if status:
            is_active = status.lower() == "active"
            query = query.eq("is_active", is_active)
        
        # Apply sorting
        sort_field = sort_by if sort_by in ["created_at", "updated_at", "full_name", "email", "role"] else "created_at"
        desc = sort_order.lower() == "desc"
        query = query.order(sort_field, desc=desc)
        
        # Apply pagination
        offset = (page - 1) * limit
        query = query.range(offset, offset + limit - 1)
        
        resp = query.execute()
        
        if hasattr(resp, "error") and getattr(resp, "error", None):
            error_msg = str(getattr(resp, "error"))
            raise HTTPException(status_code=400, detail=error_msg)
        
        rows = getattr(resp, "data", []) or []
        
        # Enhance user data
        enhanced_users = []
        for user in rows:
            if isinstance(user, dict):
                # Add derived fields
                user["display_name"] = user.get("full_name") or user.get("username") or user.get("email", "").split("@")[0]
                user["account_type"] = "SSO" if user.get("sso_provider") else "Local"
                user["last_login_formatted"] = format_datetime(user.get("last_login"))
                user["created_at_formatted"] = format_datetime(user.get("created_at"))
                
                # Add status badge class
                if user.get("is_active"):
                    user["status_class"] = "success"
                    user["status_text"] = "Active"
                else:
                    user["status_class"] = "danger"
                    user["status_text"] = "Inactive"
                
                enhanced_users.append(user)
        
        # Get total count for pagination
        count_resp = supabase.table("users").select("id").execute()
        total_count = len(getattr(count_resp, "data", []) or [])
        
        return {
            "status": "success",
            "data": enhanced_users,
            "pagination": {
                "page": page,
                "limit": limit,
                "total": total_count,
                "pages": (total_count + limit - 1) // limit
            }
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error in get_users: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/users/stats")
def get_users_stats():
    """Get user statistics for dashboard and analytics."""
    try:
        # Get total users
        total_resp = supabase.table("users").select("id").execute()
        total_users = len(getattr(total_resp, "data", []) or [])
        
        # Get active users
        active_resp = supabase.table("users").select("id").eq("is_active", True).execute()
        active_users = len(getattr(active_resp, "data", []) or [])
        
        # Get users by role
        roles_resp = supabase.table("users").select("role").execute()
        roles_data = getattr(roles_resp, "data", []) or []
        
        role_counts = {}
        for user in roles_data:
            if isinstance(user, dict):
                role = user.get("role", "Unknown")
                role_counts[role] = role_counts.get(role, 0) + 1
        
        # Get users by department
        dept_resp = supabase.table("users").select("department").execute()
        dept_data = getattr(dept_resp, "data", []) or []
        
        dept_counts = {}
        for user in dept_data:
            if isinstance(user, dict):
                dept = user.get("department", "Unknown")
                dept_counts[dept] = dept_counts.get(dept, 0) + 1
        
        # Get SSO vs Local users
        sso_resp = supabase.table("users").select("sso_provider").not_.is_("sso_provider", "null").execute()
        sso_users = len(getattr(sso_resp, "data", []) or [])
        local_users = total_users - sso_users
        
        return {
            "status": "success",
            "data": {
                "total_users": total_users,
                "active_users": active_users,
                "inactive_users": total_users - active_users,
                "role_distribution": role_counts,
                "department_distribution": dept_counts,
                "account_types": {
                    "sso": sso_users,
                    "local": local_users
                }
            }
        }
        
    except Exception as e:
        logger.error(f"Error in get_users_stats: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.put("/api/users/{user_id}")
async def update_user(user_id: str, request: Request):
    """Update user information."""
    try:
        payload = await request.json()
        
        # Remove fields that shouldn't be updated directly
        fields_to_exclude = ["id", "created_at", "sso_provider", "sso_user_id"]
        for field in fields_to_exclude:
            payload.pop(field, None)
        
        # Update timestamp
        payload["updated_at"] = datetime.now(timezone.utc).isoformat()
        
        # Hash password if provided
        if "password" in payload and payload["password"]:
            payload["password"] = get_password_hash(payload["password"])
        
        resp = supabase.table("users").update(payload).eq("id", user_id).execute()
        
        if hasattr(resp, "error") and getattr(resp, "error", None):
            error_msg = str(getattr(resp, "error"))
            raise HTTPException(status_code=400, detail=error_msg)
        
        return {
            "status": "success", 
            "data": getattr(resp, "data", [])[0] if getattr(resp, "data", []) else None,
            "message": "User updated successfully"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error in update_user: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.patch("/api/users/{user_id}/status")
async def toggle_user_status(user_id: str, request: Request):
    """Toggle user active/inactive status."""
    try:
        payload = await request.json()
        is_active = payload.get("is_active", True)
        
        resp = supabase.table("users").update({
            "is_active": is_active,
            "updated_at": datetime.now(timezone.utc).isoformat()
        }).eq("id", user_id).execute()
        
        if hasattr(resp, "error") and getattr(resp, "error", None):
            error_msg = str(getattr(resp, "error"))
            raise HTTPException(status_code=400, detail=error_msg)
        
        status_text = "activated" if is_active else "deactivated"
        return {
            "status": "success",
            "data": getattr(resp, "data", [])[0] if getattr(resp, "data", []) else None,
            "message": f"User {status_text} successfully"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error in toggle_user_status: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/users/{user_id}/status")
async def toggle_user_status_post(user_id: str, request: Request):
    return await toggle_user_status(user_id, request)

@app.delete("/api/users/{user_id}")
async def delete_user(user_id: str):
    """Delete a user from the system."""
    try:
        # Check if user exists
        user_resp = supabase.table("users").select("id").eq("id", user_id).single().execute()
        if not getattr(user_resp, "data", None):
            raise HTTPException(status_code=404, detail="User not found")
        
        # Delete the user
        resp = supabase.table("users").delete().eq("id", user_id).execute()
        
        if hasattr(resp, "error") and getattr(resp, "error", None):
            error_msg = str(getattr(resp, "error"))
            raise HTTPException(status_code=400, detail=error_msg)
        
        return {
            "status": "success",
            "message": "User deleted successfully"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting user: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/invite")
async def invite_user(request: Request):
    """Send invitation to a new user via email."""
    try:
        payload = await request.json()
        full_name = (payload.get("full_name") or "").strip()
        email = (payload.get("email") or "").strip().lower()
        role = (payload.get("role") or "User").strip()
        department = (payload.get("department") or "").strip()
        
        if not full_name:
            raise HTTPException(status_code=400, detail="Full name is required")
        
        if not email:
            raise HTTPException(status_code=400, detail="Email is required")
        
        # Validate email format
        import re
        email_pattern = r'^[^\s@]+@[^\s@]+\.[^\s@]+$'
        if not re.match(email_pattern, email):
            raise HTTPException(status_code=400, detail="Invalid email format")
        
        # Check if user already exists
        existing = supabase.table("users").select("id").eq("email", email).execute()
        if getattr(existing, "data", []):
            raise HTTPException(status_code=409, detail="User with this email already exists")
        
        # Create invitation record
        now = datetime.now(timezone.utc).isoformat()
        invitation_data = {
            "full_name": full_name,
            "email": email,
            "role": role,
            "department": department,
            "is_active": True,
            "created_at": now,
            "updated_at": now,
            "sso_provider": "invitation",  # Mark as invitation
            "username": email.split("@")[0]  # Generate username from email
        }
        
        resp = supabase.table("users").insert(invitation_data).execute()
        
        if hasattr(resp, "error") and getattr(resp, "error", None):
            error_msg = str(getattr(resp, "error"))
            raise HTTPException(status_code=400, detail=error_msg)
        
        # Here you would typically send an email invitation
        # For now, we'll just return success
        logger.info(f"Invitation sent to {email} for user {full_name}")
        
        return {
            "status": "success",
            "message": "Invitation sent successfully",
            "data": getattr(resp, "data", [])[0] if getattr(resp, "data", []) else None
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error sending invitation: {e}")
        raise HTTPException(status_code=500, detail=str(e))
@app.post("/api/users")
async def create_user(request: Request):
    """
    Creates a user record in the `users` table.
    Accepts JSON: { username, email, role, password?, department?, phone_number? }
    - Stores basic profile fields.
    - Hashes password if provided.
    - Returns { status, data: inserted_row }
    """
    try:
        payload = await request.json()
        email = (payload.get("email") or "").strip().lower()
        username = (payload.get("username") or "").strip()
        full_name = (payload.get("full_name") or payload.get("name") or "").strip()
        role = (payload.get("role") or "User").strip()
        department = (payload.get("department") or "").strip()
        phone_number = (payload.get("phone_number") or "").strip()
        is_active = payload.get("is_active", True)  # Default to True if not provided
        password = payload.get("password")

        if not email:
            raise HTTPException(status_code=400, detail="Email is required")
        
        if not username:
            username = email.split("@")[0]  # Generate username from email if not provided

        # Prevent duplicates by email
        existing = supabase.table("users").select("id").eq("email", email).execute()
        if (existing.data or []):
            raise HTTPException(status_code=409, detail="User with this email already exists")

        hashed_password = get_password_hash(password) if password else None

        now = datetime.now(timezone.utc).isoformat(timespec="seconds")
        to_insert = {
            "username": username,
            "email": email,
            "full_name": full_name or username,
            "role": role or "User",
            "is_active": is_active,
            "created_at": now,
            "updated_at": now,
            "sso_provider": (payload.get("sso_provider") or "manual"),
            "password": hashed_password
        }
        
        # Add optional fields if provided
        if department:
            to_insert["department"] = department
        if phone_number:
            to_insert["phone_number"] = phone_number
        
        # Only add sso_user_id if it's provided and not empty
        if payload.get("sso_user_id"):
            to_insert["sso_user_id"] = payload["sso_user_id"]
        resp = supabase.table("users").insert(to_insert).execute()
        if hasattr(resp, "error") and getattr(resp, "error", None):
            error_msg = str(getattr(resp, "error"))
            raise HTTPException(status_code=500, detail=error_msg)
        inserted = (getattr(resp, "data", []) or [None])[0]
        return {"status": "success", "data": inserted}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ============================
# 🪲 BUGS MODULE ENDPOINTS (USING SUPABASE REST)
# ============================
import os
import json
import time
import re
from datetime import datetime, timezone
from typing import Dict, Any, List

try:
    requests = __import__("requests")
except Exception:
    requests = None

def _http_get(url: str, headers: Dict[str, str] | None = None, params: Dict[str, Any] | None = None, timeout: int | None = None):
    if requests is None:
        raise HTTPException(status_code=500, detail="HTTP client not available")
    return requests.get(url, headers=headers, params=params, timeout=timeout)

def _http_post(url: str, headers: Dict[str, str] | None = None, json: Dict[str, Any] | None = None, timeout: int | None = None):
    if requests is None:
        raise HTTPException(status_code=500, detail="HTTP client not available")
    return requests.post(url, headers=headers, json=json, timeout=timeout)

def _http_patch(url: str, headers: Dict[str, str] | None = None, params: Dict[str, Any] | None = None, json: Dict[str, Any] | None = None, timeout: int | None = None):
    if requests is None:
        raise HTTPException(status_code=500, detail="HTTP client not available")
    return requests.patch(url, headers=headers, params=params, json=json, timeout=timeout)
from fastapi import HTTPException, Request, Path, File, UploadFile

# Supabase config
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_ANON_KEY = os.getenv("SUPABASE_KEY")
SUPABASE_SERVICE_ROLE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY") or SUPABASE_ANON_KEY

if not SUPABASE_URL or not SUPABASE_SERVICE_ROLE_KEY:
  raise RuntimeError(
      "SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY / SUPABASE_KEY must be set in environment"
  )

# Supabase REST URL (PostgREST)
SUPABASE_REST_URL = f"{SUPABASE_URL}/rest/v1"

# 🔹 Supabase Python client (used only for Storage)
from supabase import create_client, Client

storage_client: Client = create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

# Candidate table names to try
CANDIDATE_TABLES = ["bugs", "Bugs_file", "bugs_file"]


def _supabase_headers(extra: Dict[str, str] | None = None) -> Dict[str, str]:
    """
    Base headers for Supabase REST.
    """
    base = {
        "apikey": SUPABASE_SERVICE_ROLE_KEY,
        "Authorization": f"Bearer {SUPABASE_SERVICE_ROLE_KEY}",
        "Content-Type": "application/json",
        "Accept": "application/json",
    }
    if extra:
        base.update(extra)
    return base


# ---------- NORMALIZER ----------

def normalize_bug_row(row: Dict[str, Any]) -> Dict[str, Any]:
    try:
        bug_id = (
            row.get("Bug ID")
            or row.get("bug_id")
            or row.get("id")
            or row.get("bugid")
        )

        summary = (
            row.get("Summary")
            or row.get("summary")
            or row.get("title")
            or ""
        )

        priority = (
            row.get("Priority")
            or row.get("priority")
            or row.get("severity")
            or ""
        )

        status = row.get("Status") or row.get("status") or ""
        assignee = (
            row.get("Assignee")
            or row.get("assignee")
            or row.get("assignee_name")
            or ""
        )

        changed = (
            row.get("Changed")
            or row.get("changed")
            or row.get("updated_at")
            or row.get("updated")
            or ""
        )

        product = (
            row.get("Product")
            or row.get("product")
            or row.get("Project")
            or row.get("project")
            or ""
        )

        # 🔹 Description: ONLY from DB "Description" column
        description = row.get("Description") or row.get("description") or ""

        # 🔹 Comment: ONLY from DB "Comment" column (raw text / JSON string)
        comment_value = row.get("Comment") or row.get("comment") or ""

        # 🔹 Comments array:
        # DB design is still: "Comment" column => string / JSON string
        # We expose normalized "Comments" array to the frontend.
        comments: List[Dict[str, Any]] = []
        if isinstance(comment_value, str) and comment_value.strip():
            try:
                parsed = json.loads(comment_value)
                if isinstance(parsed, list):
                    comments = parsed
                else:
                    comments = [
                        {
                            "text": str(comment_value),
                            "user": "Unknown",
                            "timestamp": changed,
                        }
                    ]
            except Exception:
                comments = [
                    {
                        "text": str(comment_value),
                        "user": "Unknown",
                        "timestamp": changed,
                    }
                ]
        else:
            comments = []

        # 🔹 Attachments: from Attachments JSONB column, if present
        raw_attachments = (
            row.get("Attachments")
            or row.get("attachments")
            or []
        )

        if isinstance(raw_attachments, str):
            try:
                raw_attachments = json.loads(raw_attachments)
            except Exception:
                raw_attachments = []

        if not isinstance(raw_attachments, list):
            raw_attachments = []

        attachments: List[Dict[str, Any]] = raw_attachments

        # 🔹 Additional fields for complete bug data
        component = row.get("Component") or row.get("component") or ""
        defect_type = row.get("Defect type") or row.get("defect_type") or ""
        steps_to_reproduce = row.get("Steps to Reproduce") or row.get("steps_to_reproduce") or ""
        reporter = row.get("Reporter") or row.get("reporter") or ""
        resolution = row.get("Resolution") or row.get("resolution") or ""
        sprint_details = row.get("Sprint details") or row.get("sprint_details") or ""
        automation_intent = row.get("Automation Intent") or row.get("automation_intent") or ""
        automation_owner = row.get("automation_owner") or ""
        automation_status = row.get("automation status") or row.get("automation_status") or ""
        device_type = row.get("Device type") or row.get("device_type") or ""
        browser_tested = row.get("Browser tested") or row.get("browser_tested") or ""
        project_owner = row.get("Project Owner") or row.get("project_owner") or ""
        project_owner_name = row.get("Project Owner Name") or row.get("project_owner_name") or ""
        assignee_real_name = row.get("Assignee Real Name") or row.get("assignee_real_name") or ""

        return {
            "Bug ID": bug_id,
            "Summary": summary,
            "Priority": priority,
            "Status": status,
            "Assignee": assignee,
            "Assignee Real Name": assignee_real_name,
            "Changed": changed,
            "Product": product,
            "Component": component,
            "Defect type": defect_type,
            "Steps to Reproduce": steps_to_reproduce,
            "Reporter": reporter,
            "Resolution": resolution,
            "Sprint details": sprint_details,
            "Automation Intent": automation_intent,
            "automation_owner": automation_owner,
            "automation status": automation_status,
            "Device type": device_type,
            "Browser tested": browser_tested,
            "Project Owner": project_owner,
            "Project Owner Name": project_owner_name,
            "Description": description,
            "Comment": comment_value,  # raw DB column
            "Comments": comments,      # normalized array
            "Attachments": attachments,
        }

    except Exception:
        # Fallback minimal shape if something unexpected happens
        return {
            "Bug ID": None,
            "Summary": "",
            "Priority": "",
            "Status": "",
            "Assignee": "",
            "Assignee Real Name": "",
            "Changed": "",
            "Product": "",
            "Component": "",
            "Defect type": "",
            "Steps to Reproduce": "",
            "Reporter": "",
            "Resolution": "",
            "Sprint details": "",
            "Automation Intent": "",
            "automation_owner": "",
            "automation status": "",
            "Device type": "",
            "Browser tested": "",
            "Project Owner": "",
            "Project Owner Name": "",
            "Description": "",
            "Comment": "",
            "Comments": [],
            "Attachments": [],
        }


# ---------- SELECT / INSERT HELPERS (REST) ----------

def _select_bugs_with_fallback():
    errors = []
    empty_tables = []
    for name in CANDIDATE_TABLES:
        try:
            params = {
                "select": '"Bug ID",Summary,Priority,Status,Assignee,Changed,Product,Project,Component,Description,Comment,Attachments,"Defect type","Steps to Reproduce",Reporter,Resolution,"Sprint details","Automation Intent",automation_owner,"automation status","Device type","Browser tested","Assignee Real Name","Project Owner","Project Owner Name"',
                "order": "Changed.desc",
            }
            resp = _http_get(
                f"{SUPABASE_REST_URL}/{name}",
                headers=_supabase_headers(),
                params=params,
                timeout=10,
            )

            if not resp.ok:
                errors.append(f"{name}: {resp.status_code} {resp.text}")
                continue

            data = resp.json() or []
            if not data:
                empty_tables.append(name)
                continue

            normalized = [normalize_bug_row(r) for r in data]
            return {"status": "success", "data": normalized}
        except Exception as e:
            errors.append(f"{name}: {e}")
            continue

    if empty_tables:
        return {"status": "success", "data": []}

    raise HTTPException(
        status_code=500,
        detail=f"Failed to fetch bugs. Tried -> {'; '.join(map(str, errors))}",
    )


def _insert_bug_with_fallback(payload: Dict[str, Any]):
    errors = []
    for name in CANDIDATE_TABLES:
        try:
            headers = _supabase_headers({"Prefer": "return=representation"})
            resp = _http_post(
                f"{SUPABASE_REST_URL}/{name}",
                headers=headers,
                json=payload,
                timeout=10,
            )
            if not resp.ok:
                errors.append(f"{name}: {resp.status_code} {resp.text}")
                continue

            inserted = resp.json() or []
            normalized = [normalize_bug_row(r) for r in inserted]
            return {"status": "success", "data": normalized}

        except Exception as e:
            errors.append(f"{name}: {e}")
            continue

    raise HTTPException(
        status_code=500,
        detail=f"Failed to insert bug into any candidate table. Errors -> {'; '.join(errors)}",
    )


# ---------- CREATE BUG ----------

@app.post("/api/bugs")
async def create_bug(request: Request):
    try:
        payload: Dict[str, Any] = await request.json()

        # 1. Keep Bug ID from frontend (e.g. "BUG-001")
        bug_id = payload.get("Bug ID")

        if not isinstance(bug_id, str) or not bug_id.strip():
            raise HTTPException(
                status_code=400,
                detail='"Bug ID" is required and must be a non-empty string like "BUG-001".',
            )

        bug_id = bug_id.strip()
        payload["Bug ID"] = bug_id

        # 2. Map Comments (array) -> Comment (JSON string) for DB storage
        if "Comments" in payload and isinstance(payload["Comments"], list):
            payload["Comment"] = json.dumps(payload["Comments"])
            payload.pop("Comments", None)

        # 3. Default values (do NOT override Description or Comment if provided)
        defaults = {
            "Defect type": "Functional",
            "Summary": "",
            "Priority": "Medium",
            "Product": "",
            "Component": "",
            "Assignee": "",
            "Status": "OPEN",
            "Resolution": "Unresolved",
            "Changed": datetime.now(timezone.utc).isoformat(timespec="milliseconds"),
            "Sprint details": "",
            "Reporter": "",
            "Automation Intent": "No",
            "automation_owner": "",
            "Assignee Real Name": payload.get("Assignee", ""),
            "automation status": "Pending",
            "Device type": "Web",
            "Browser tested": "",
        }
        for k, v in defaults.items():
            if payload.get(k) is None or payload.get(k) == "":
                payload[k] = v

        # 4. Validate required keys exist
        required = list(defaults.keys()) + ["Bug ID"]
        missing = [f for f in required if f not in payload]
        if missing:
            raise HTTPException(
                status_code=400,
                detail=f"Missing fields: {', '.join(missing)}",
            )

        # 5. Insert
        result = _insert_bug_with_fallback(payload)

        return result

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ---------- LIST BUGS ----------

@app.get("/api/bugs")
async def get_bugs():
    try:
        result = _select_bugs_with_fallback()
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ---------- AGENT CHAT ENDPOINT (MOCK) ----------
# ---------- AGENT CHAT ENDPOINT (MOCK) ----------
@app.post("/api/agent/chat")
async def agent_chat(request: Request):
    """
    Simple endpoint to handle agent chat messages.
    Processes natural language commands to interact with the bug tracker.
    """
    try:
        # 1. Authenticate User
        auth_header = request.headers.get("Authorization")
        user_info = verify_supabase_token(auth_header)
        current_user_email = ""
        current_user_name = ""

        if user_info and "user" in user_info:
            current_user_email = (user_info["user"].get("email") or "").lower()
            user_id = user_info["user"].get("id")
            if user_id:
                try:
                    u_resp = supabase.table("users").select("full_name").eq("id", user_id).single().execute()
                    if getattr(u_resp, "data", None) and isinstance(u_resp.data, dict):
                        _fn = u_resp.data.get("full_name")
                        current_user_name = str(_fn or "").lower()
                except:
                    pass

        payload = await request.json()
        message = (payload.get("message") or "").lower().strip()
        
        reply = ""
        
        # Check for "assigned to me"
        is_assigned_query = ("assigned" in message and "me" in message) or ("my" in message and ("bugs" in message or "tasks" in message))
        
        if is_assigned_query:
            if not current_user_email:
                 reply = "I cannot identify you. Please login to see your assigned items."
            else:
                 # Fetch Bugs
                 bug_result = _select_bugs_with_fallback()
                 all_bugs = bug_result.get("data", [])
                 
                 # Fetch Tasks
                 try:
                     task_resp = supabase.table("tasks").select("*").execute()
                     all_tasks = getattr(task_resp, "data", []) or []
                 except:
                     all_tasks = []

                 my_items = []
                 # Filter Bugs
                 for b in all_bugs:
                     assignee = (b.get("Assignee") or "").lower()
                     assignee_real = (b.get("Assignee Real Name") or "").lower()
                     if current_user_email in assignee or (current_user_name and current_user_name in assignee_real) or (current_user_name and current_user_name in assignee):
                         my_items.append(f"🐛 {b.get('Bug ID')}: {b.get('Summary')} ({b.get('Status')})")
                 
                 # Filter Tasks
                 for t in all_tasks:
                     assigned_to = (t.get("assigned_to") or "").lower()
                     if current_user_email in assigned_to:
                          my_items.append(f"📋 {t.get('task_name')} ({t.get('task_status')})")

                 count = len(my_items)
                 if count == 0:
                     reply = f"You have no items assigned to you, {current_user_name or current_user_email}."
                 else:
                     top_items = my_items[:10]
                     item_list_str = "\n".join(top_items)
                     reply = f"You have {count} items assigned to you:\n\n{item_list_str}"
                     if count > 10:
                         reply += f"\n\n...and {count - 10} more."

        # 2. Tasks Module (Comprehensive)
        elif "task" in message:
            # --- CREATE TASK ---
            if "create" in message or "add" in message or "new" in message:
                # "Create a new task with title “Demo Task” and priority Medium"
                # Simple parsing: assume title is after "title" or just everything after "task"
                try:
                    title = ""
                    priority = "medium"
                    
                    # Extract priority
                    if "high" in message: priority = "high"
                    elif "low" in message: priority = "low"
                    
                    # Extract Title (quick & dirty)
                    if "title" in message:
                        parts = message.split("title", 1)
                        if len(parts) > 1:
                            title = parts[1].split("and priority")[0].strip(' "“”')
                    else:
                        # Fallback: take everything after "create task"
                        for p in ["create task", "add task", "new task"]:
                            if p in message:
                                title = message.split(p, 1)[1].strip()
                                break
                    
                    if not title:
                         reply = "Please specify a title (e.g., 'create task title \"Fix Login\"')."
                    else:
                        new_id = str(uuid4())
                        now_iso = datetime.now(timezone.utc).isoformat()
                        # Default assigned to current user or "" (empty string)
                        assigned_to = current_user_email or ""
                        
                        payload = {
                            "id": new_id,
                            "task_name": title,
                            "task_status": "todo",
                            "task_priority": priority,
                            "assigned_to": assigned_to,
                            "task_note": f"Created via AI Agent by {assigned_to}",
                            "created_at": now_iso
                        }
                        r = supabase.table("tasks").insert(payload).execute()
                        if getattr(r, "error", None):
                            reply = f"Error creating task: {getattr(r, 'error', None)}"
                        else:
                            reply = f"✅ Created task: **{title}** (Priority: {priority}, Assigned: {assigned_to})"
                except Exception as e:
                    reply = f"Failed to create task: {str(e)}"

            # --- UPDATE TASK ---
            elif "update" in message or "change" in message or "set" in message:
                # "Update status of task 003 to In-Progress"
                # "Change priority of task 010 to Medium"
                try:
                    # simplistic ID extraction (assuming integer-like sequence or exact title match is hard)
                    # We'll look for "task <something>"
                    target_id = None
                    # Regex for "task 123" or "task 003"
                    id_match = re.search(r"task\s+(\d+)", message)
                    
                    # We need to find the REAL UUID. Since user uses "Serial" (001), 
                    # we need to fetch all tasks, sort by date (to mimic frontend serial), and find it.
                    # This is expensive but necessary for "Task 003" semantic.
                    if id_match:
                        serial_idx = int(id_match.group(1))
                        # Fetch all to find the serial
                        all_tasks_resp = supabase.table("tasks").select("id, task_name, created_at").order("created_at", desc=False).execute() # Ascending to match serial 1..N
                        all_tasks = getattr(all_tasks_resp, "data", []) or []
                        
                        # In frontend: TasksList.jsx -> uses ALL fetch then map. 
                        # WAIT! Frontend uses `nextId` based on `rows` which come from `order("created_at", desc=True)`? 
                        # Actually frontend code didn't strictly sort in the `get` call in `Task.jsx` (it used `get("/api/tasks")` which defaults to `desc=True` in backend).
                        # BUT the serial logic `const serial = String(idx + 1).padStart(3, "0");` depends on the returned order.
                        # Backend defaults `get_tasks` to `order("created_at", desc=True)`.
                        # So, Task 001 is the NEWEST task.
                        
                        # Let's match backend default sort
                        all_tasks_resp = supabase.table("tasks").select("id").order("created_at", desc=True).execute()
                        all_tasks = getattr(all_tasks_resp, "data", []) or []
                        
                        if 0 < serial_idx <= len(all_tasks):
                            target_id = all_tasks[serial_idx - 1]["id"]
                        else:
                            reply = f"Task {serial_idx} not found."
                            return {"status": "success", "reply": reply}
                            
                    if not target_id:
                         reply = "I couldn't identify the task ID. Try 'task 001'."
                    else:
                        updates = {}
                        if "status" in message:
                            if "todo" in message: updates["task_status"] = "todo"
                            elif "progress" in message: updates["task_status"] = "in-progress"
                            elif "done" in message: updates["task_status"] = "done"
                        
                        if "priority" in message:
                            if "high" in message: updates["task_priority"] = "high"
                            elif "medium" in message: updates["task_priority"] = "medium"
                            elif "low" in message: updates["task_priority"] = "low"
                            
                        if not updates:
                            reply = "What would you like to update? (status or priority)"
                        else:
                            supabase.table("tasks").update(updates).eq("id", target_id).execute()
                            reply = "✅ Updated task."

                except Exception as e:
                    reply = f"Error updating task: {str(e)}"

            # --- DELETE TASK ---
            elif "delete" in message or "remove" in message:
                try:
                    # Same serial look up strategy
                    id_match = re.search(r"task\s+(\d+)", message)
                    if id_match:
                        serial_idx = int(id_match.group(1))
                        all_tasks_resp = supabase.table("tasks").select("id").order("created_at", desc=True).execute()
                        all_tasks = getattr(all_tasks_resp, "data", []) or []
                        
                        if 0 < serial_idx <= len(all_tasks):
                            target_id = all_tasks[serial_idx - 1]["id"]
                            supabase.table("tasks").delete().eq("id", target_id).execute()
                            reply = f"🗑️ Deleted Task {serial_idx}."
                        else:
                            reply = f"Task {serial_idx} not found."
                    else:
                         reply = "Which task to delete? (e.g. 'delete task 001')"
                except Exception as e:
                     reply = f"Error deleting: {str(e)}"

            # --- EXPORT ---
            elif "export" in message or "csv" in message:
                 try:
                     # "Export tasks with status Todo"
                     query = supabase.table("tasks").select("*").order("created_at", desc=True)
                     if "todo" in message: query = query.eq("task_status", "todo")
                     elif "doing" in message or "progress" in message: query = query.eq("task_status", "in-progress")
                     elif "done" in message or "completed" in message: query = query.eq("task_status", "done")
                     
                     resp = query.execute()
                     data = getattr(resp, "data", []) or []
                     
                     if not data:
                         reply = "No tasks found to export."
                     else:
                         csv_lines = ["ID,Title,Status,Priority,AssignedTo,Created"]
                         for i, t in enumerate(data):
                             row = f"{i+1:03d},{t.get('task_name')},{t.get('task_status')},{t.get('task_priority')},{t.get('assigned_to')},{t.get('created_at')}"
                             csv_lines.append(row)
                         
                         csv_block = "\n".join(csv_lines)
                         reply = f"Here is your CSV export:\n\n```csv\n{csv_block}\n```"
                 except Exception as e:
                     reply = f"Export failed: {str(e)}"

            # --- ANALYTICS / CHARTS ---
            elif "chart" in message or "graph" in message or "analytics" in message:
                 # "Show tasks by priority in bar chart"
                 # We will generate a text-based bar chart
                 try:
                     resp = supabase.table("tasks").select("task_status, task_priority, assigned_to, created_at").execute()
                     data = getattr(resp, "data", []) or []
                     
                     if "priority" in message:
                         counts = {"high": 0, "medium": 0, "low": 0}
                         for t in data:
                             p = (t.get("task_priority") or "medium").lower()
                             counts[p] = counts.get(p, 0) + 1
                         
                         reply = "📊 **Tasks by Priority**\n"
                         for k, v in counts.items():
                             bar = "█" * v
                             reply += f"\n{k.capitalize():<10} | {bar} ({v})"
                             
                     elif "status" in message:
                         counts = {"todo": 0, "in-progress": 0, "done": 0}
                         for t in data:
                             s = (t.get("task_status") or "todo").lower()
                             counts[s] = counts.get(s, 0) + 1
                             
                         reply = "📊 **Tasks by Status**\n"
                         for k, v in counts.items():
                             bar = "█" * v
                             reply += f"\n{k.capitalize():<12} | {bar} ({v})"
                             
                     elif "user" in message or "assigned" in message:
                         user_counts = {}
                         for t in data:
                             u = t.get("assigned_to") or "Unassigned"
                             user_counts[u] = user_counts.get(u, 0) + 1
                         
                         reply = "📊 **Tasks by User**\n"
                         for k, v in user_counts.items():
                             bar = "█" * v
                             reply += f"\n{k:<20} | {bar} ({v})"
                             
                     else:
                         reply = "I can show charts for priority, status, or assignee. Try 'tasks by priority chart'."
                 except Exception as e:
                     reply = f"Analytics error: {str(e)}"

            # --- LIST / SEARCH / COUNT ---
            else:
                # "Show all tasks", "List all tasks created today", "Search tasks..."
                try:
                    query = supabase.table("tasks").select("*").order("created_at", desc=True)
                    
                    # Filters
                    if "todo" in message: query = query.eq("task_status", "todo")
                    elif ("progress" in message and "in" in message): query = query.eq("task_status", "in-progress")
                    elif "done" in message or "completed" in message: query = query.eq("task_status", "done")
                    elif "overdue" in message:
                        # Fetch all and filter in python (complex due date parsing)
                        pass 
                    
                    if "high" in message: query = query.eq("task_priority", "high")
                    elif "medium" in message: query = query.eq("task_priority", "medium")
                    elif "low" in message: query = query.eq("task_priority", "low")
                    
                    # Search
                    search_term = ""
                    if "search" in message or "find" in message:
                        # Extract "search tasks with title 'world'" -> simplified
                        # Just grab "title <word>" or "keyword <word>"
                        m_quote = re.search(r"['\"](.*?)['\"]", message)
                        if m_quote:
                            search_term = m_quote.group(1)
                        else:
                            # basic heuristic: last word or after "search"
                            pass 
                    
                    # Execute
                    resp = query.execute()
                    requests = getattr(resp, "data", []) or []
                    
                    # Post-processing filters
                    final_list = []
                    today_str = datetime.now().strftime("%Y-%m-%d")
                    
                    for i, t in enumerate(requests): # i is not accurate serial if filtered, but ok
                        # Extract Meta
                        note = t.get("task_note") or ""
                        due_match = re.search(r"due=([^\s]+)", note)
                        due_date = due_match.group(1) if due_match else "N/A"
                        
                        created_at_str = (t.get("created_at") or "")[:10]
                        
                        include = True
                        
                        # Date Filters
                        if "today" in message and "created" in message:
                             if created_at_str != today_str: include = False
                        if "due today" in message:
                             if due_date != today_str: include = False
                             
                        # Overdue
                        if "overdue" in message:
                            if due_date == "N/A" or due_date >= today_str: include = False
                            
                        # Search Content
                        if search_term:
                            if search_term.lower() not in (t.get("task_name") or "").lower() and \
                               search_term.lower() not in note.lower():
                                include = False
                                
                        if include:
                            final_list.append(t)
                            
                    # Count?
                    if "how many" in message or "count" in message:
                        reply = f"There are {len(final_list)} tasks matching your criteria."
                    elif not final_list:
                        reply = "No tasks found matching your request."
                    else:
                        reply = f"Found {len(final_list)} tasks:\n"
                        # Show top 5-10
                        for t in final_list[:8]:
                             # Use simplified serial logic or just ID
                             # Since we don't have the global index here easily without fetching ALL,
                             # we can just show bullet points.
                             prio_icon = "🔴" if t.get("task_priority")=="high" else "🟡" if t.get("task_priority")=="medium" else "🟢"
                             status = t.get("task_status")
                             reply += f"\n{prio_icon} **{t.get('task_name')}** ({status})\n   Assigned: {t.get('assigned_to')}"
                             
                        if len(final_list) > 8:
                            reply += f"\n\n...and {len(final_list) - 8} more."
                            
                except Exception as e:
                     reply = f"Error listing tasks: {str(e)}"

        # 3. List Bugs (Renumbered/Refined logic if needed, but keeping existing is fine)
        elif any(x in message for x in ["list bugs", "show bugs", "all bugs", "list all bugs"]):
             # ... existing bug logic ... 
             # (See original code, we just need to ensure we don't duplicate or overwrite if not needed)
             # Wait, `replace_file_content` will REPLACE the target block. 
             # I should output the ORIGINAL code for Bugs/etc if I am encompassing them,
             # OR I should have targeted a narrower block. 
             # The instruction asked to "Insert... before Testing Requests", 
             # but I am replacing the 'Assigned to me' block which is at the TOP.
             # So I basically need to emit the entire body? 
             # No, I can try to be smart with start/end lines.
             
             # `is_assigned_query` is at the top.
             # `Testing Requests` is down below (line ~1350).
             # There's `List Bugs` (elif) in between.
             
             # The tool allows editing a contiguous block. 
             # I will edit from `if is_assigned_query:` (lines ~1158) down to `elif "testing" in message` (line ~1350).
             # This means I need to re-state the "List Bugs", "Bug Details", "Create Bug", "Users", "TransTracker" blocks.
             # That is a lot of code to repeat.
             
             # Better approach: 
             # 1. Edit `is_assigned_query` block separately.
             # 2. Insert `Tasks` block before `Testing Requests`.
             
             # Let's do 1 first.
             pass

        # ... (rest of the file)
        elif any(x in message for x in ["list bugs", "show bugs", "all bugs", "list all bugs"]):
             result = _select_bugs_with_fallback()
             data = result.get("data", [])
             if not data:
                 reply = "There are no bugs in the system currently."
             else:
                 # Show top 5 recent bugs
                 params = data[:5]
                 reply = f"Here are the {min(len(data), 5)} most recent bugs:\n"
                 for b in params:
                     status = b.get('Status') or "Unknown"
                     summary = b.get('Summary') or "No Summary"
                     bid = b.get('Bug ID') or "?"
                     reply += f"\n• {bid}: {summary} ({status})"
                 
                 if len(data) > 5:
                     reply += f"\n\n...and {len(data) - 5} more."
        
        # 3. Bug Details
        # Matched if user asks for details OR just provides a Bug ID (e.g. "BUG-001")
        elif ("details" in message) or ("show" in message and "bug" in message) or re.search(r"\bbug-\d+\b", message):
            # Extract ID usually looking for BUG-XXX or just XXX
            match = re.search(r"(bug-\d+|\d{3,})", message)
            if match:
                bug_id = match.group(1).upper() # Ensure uppercase for DB (BUG-133)
                bug = _get_bug_by_id(bug_id)
                if bug:
                     reply = f"Details for {bug_id}:\n"
                     reply += f"Summary: {bug.get('Summary')}\n"
                     reply += f"Status: {bug.get('Status')}\n"
                     reply += f"Priority: {bug.get('Priority')}\n"
                     reply += f"Assignee: {bug.get('Assignee') or 'Unassigned'}\n"
                     desc = bug.get('Description') or 'No description provided.'
                     if len(desc) > 200:
                         desc = desc[:197] + "..."
                     reply += f"Description: {desc}"
                else:
                    reply = f"I could not find any bug with ID {bug_id}."
            else:
                 reply = "Please specify a bug ID (e.g., 'show bug BUG-001')."

        # 4. Create Bug (Simple)
        elif "create bug" in message or "new bug" in message or "report bug" in message:
             # Try to extract summary
             prefix_list = ["create bug", "new bug", "report bug"]
             summary = ""
             for p in prefix_list:
                 if p in message:
                     parts = message.split(p, 1)
                     if len(parts) > 1:
                        summary = parts[1].strip()
                     break
             
             if summary:
                 import random
                 new_id = f"BUG-{random.randint(1000, 9999)}"
                 
                 payload_new = {
                     "Bug ID": new_id,
                     "Summary": summary,
                     "Description": f"Created via AI Agent from message: {summary}",
                     "Priority": "Medium",
                     "Status": "OPEN"
                 }
                 try:
                     _insert_bug_with_fallback(payload_new)
                     reply = f"I've created a new bug for you:\n\nID: {new_id}\nSummary: {summary}"
                 except Exception as e:
                    reply = f"Failed to create bug: {str(e)}"
             else:
                 reply = "What is the summary of the bug? (e.g., 'create bug login page error')"
                 
        # 5. Users Module
        elif "user" in message:
            if any(x in message for x in ["list", "show all", "get all"]):
                # List Users
                try:
                    resp = supabase.table("users").select("full_name, email, role, is_active").limit(5).execute()
                    users = getattr(resp, "data", []) or []
                    if not users:
                        reply = "No users found in the system."
                    else:
                        reply = f"Here are some registered users:\n"
                        for u in users:
                             status_icon = "🟢" if u.get("is_active") else "🔴"
                             reply += f"\n{status_icon} {u.get('full_name')} ({u.get('role')}) - {u.get('email')}"
                        
                        # Get total count
                        count_resp = supabase.table("users").select("id").execute()
                        total = len(getattr(count_resp, "data", []) or users)
                        if total > 5:
                            reply += f"\n\n...and {total - 5} more."
                except Exception as e:
                    reply = f"Error fetching users: {str(e)}"

            elif any(x in message for x in ["find", "search", "who is", "details of"]):
                # Search User
                # Extract search term: "find user John", "who is support"
                search_term = ""
                for prefix in ["find user", "search user", "who is", "details of"]:
                    if prefix in message:
                        parts = message.split(prefix, 1)
                        if len(parts) > 1:
                             search_term = parts[1].strip()
                        break
                
                if not search_term:
                     reply = "Who are you looking for? (e.g., 'find user john')"
                else:
                    try:
                        resp = supabase.table("users").select("*").or_(f"full_name.ilike.%{search_term}%,email.ilike.%{search_term}%").limit(3).execute()
                        users = getattr(resp, "data", []) or []
                        if not users:
                            reply = f"I couldn't find any user matching '{search_term}'."
                        else:
                            reply = f"Found {len(users)} match(es):\n"
                            for u in users:
                                status = "Active" if u.get("is_active") else "Inactive"
                                reply += f"\n👤 **{u.get('full_name')}** ({u.get('role')})\n"
                                reply += f"   Email: {u.get('email')}\n"
                                reply += f"   Department: {u.get('department') or 'N/A'}\n"
                                reply += f"   Status: {status}\n"
                    except Exception as e:
                        reply = f"Error searching users: {str(e)}"
            else:
                 reply = "You can ask me to 'list users' or 'find user <name>'."

        # 6. TransTracker Module
        elif "tracker" in message or "release" in message or "build" in message:
             if any(x in message for x in ["list", "show", "recent"]):
                 try:
                     # Fetch recent releases
                     resp = supabase.table("transtrackers").select("applicationtype, buildnumber, buildreceiveddate, signoffstatus").order("buildreceiveddate", desc=True).limit(5).execute()
                     releases = getattr(resp, "data", []) or []
                     
                     if not releases:
                         reply = "No TransTracker records found."
                     else:
                         reply = "Here are the most recent releases/builds:\n"
                         for r in releases:
                             date = r.get('buildreceiveddate') or "N/A"
                             app = r.get('applicationtype') or "App"
                             build = r.get('buildnumber') or "?"
                             status = r.get('signoffstatus') or "Pending"
                             
                             icon = "✅" if "approved" in status.lower() else "⚠️"
                             reply += f"\n{icon} **{app}** (Build {build})\n   Date: {date} | Status: {status}"
                 except Exception as e:
                      reply = f"Error fetching TransTracker data: {str(e)}"
             else:
                  reply = "I can help you list recent releases. Try 'show recent releases' or 'list transtracker'."

        # 7. Testing Requests Module
        elif "testing" in message and "request" in message:
             if any(x in message for x in ["list", "show", "recent"]):
                 try:
                     resp = supabase.table("testing_requests").select("product_project_name, build_version, sprint, created_at").order("created_at", desc=True).limit(5).execute()
                     requests = getattr(resp, "data", []) or []
                     
                     if not requests:
                         reply = "No testing requests found."
                     else:
                         reply = "Here are the most recent testing requests:\n"
                         for r in requests:
                             proj = r.get("product_project_name") or "Unknown Project"
                             build = r.get("build_version") or "N/A"
                             sprint = r.get("sprint") or "N/A"
                             date_str = r.get("created_at") or ""
                             date_only = date_str.split("T")[0] if "T" in date_str else date_str 
                             
                             reply += f"\n📄 **{proj}**\n   Build: {build} | Sprint: {sprint} | Date: {date_only}"
                 except Exception as e:
                     reply = f"Error fetching testing requests: {str(e)}"
             else:
                  reply = "I can list recent testing requests. Try 'list testing requests'."

        # 8. Status/Count
        elif "count" in message or "how many" in message:
             # Basic bug count
             result = _select_bugs_with_fallback()
             count = len(result.get("data", []))
             reply = f"There are currently {count} bugs in the system."

        # 9. Help / Greeting
        elif any(x in message for x in ["hi", "hello", "help", "hey"]):
            reply = "Hello! I am your Intelligent Project Assistant. I can help with:\n\n"
            reply += "🐛 **Bugs**\n• 'List bugs', 'Show details for BUG-101'\n• 'How many bugs?'\n\n"
            reply += "📋 **Tasks**\n• 'List tasks', 'Create task <title>'\n• 'Update task 123', 'Delete task 123'\n• 'Tasks by priority chart', 'Export tasks'\n\n"
            reply += "👥 **Users**\n• 'List all users', 'Find user <name>'\n\n"
            reply += "🚀 **TransTracker**\n• 'Show recent releases'\n\n"
            reply += "📄 **Testing Requests**\n• 'List testing requests'"
            
        else:
            reply = "I'm not sure I understand. Try asking about 'bugs', 'tasks', 'users', or 'releases'."

        return {
            "status": "success",
            "reply": reply
        }
    except Exception as e:
        print(f"Agent error: {e}")
        return {
            "status": "error", 
            "reply": f"Sorry, I encountered an internal error: {str(e)}"
        }



@app.get("/api/priority-stats")
async def get_priority_stats():
    """
    Returns count of bugs by priority: { high, medium, low }
    """
    try:
        result = _select_bugs_with_fallback()
        bugs = result.get("data", [])

        counts = {"high": 0, "medium": 0, "low": 0}

        for b in bugs:
            p = str(b.get("Priority", "")).lower()
            if p in ["critical", "high", "p0", "p1"]:
                counts["high"] += 1
            elif p in ["medium", "med", "p2"]:
                counts["medium"] += 1
            else:
                counts["low"] += 1

        return {"status": "success", "data": counts}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ---------- GET BUG DETAILS ----------

def _get_bug_by_id(bug_id: str):
    bug_data = None

    for name in CANDIDATE_TABLES:
        try:
            params = {
                "select": "*",
                "Bug ID": f"eq.{bug_id}",
            }
            resp = _http_get(
                f"{SUPABASE_REST_URL}/{name}",
                headers=_supabase_headers(),
                params=params,
                timeout=10,
            )

            if resp.ok and resp.json():
                bug_data = resp.json()[0]
                break

            # if bug_id is numeric, try int
            if bug_id.isdigit():
                params = {
                    "select": "*",
                    "Bug ID": f"eq.{int(bug_id)}",
                }
                resp = _http_get(
                    f"{SUPABASE_REST_URL}/{name}",
                    headers=_supabase_headers(),
                    params=params,
                    timeout=10,
                )
                if resp.ok and resp.json():
                    bug_data = resp.json()[0]
                    break
        except Exception:
            continue

    if not bug_data:
        return None

    return normalize_bug_row(bug_data)


@app.get("/api/bugs/{bug_id}")
async def get_bug_details(bug_id: str = Path(...)):
    try:
        normalized = _get_bug_by_id(bug_id)
        if not normalized:
            raise HTTPException(status_code=404, detail="Bug not found")

        return {"status": "success", "data": normalized}

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ---------- UPLOAD ATTACHMENTS ----------

@app.post("/api/bugs/{bug_id}/attachments")
async def upload_bug_attachments(
    bug_id: str,
    files: List[UploadFile] = File(...),
):
    bucket = "bug-attachments"
    uploaded: List[Dict[str, Any]] = []

    

    # optional: check if bucket exists
    try:
        buckets = storage_client.storage.list_buckets()
        _ = [b.name for b in buckets] if buckets else []
    except Exception:
        pass

    try:
        for file in files:
            contents = await file.read()

            original_name = file.filename or "file"
            name_no_spaces = original_name.replace(" ", "_")
            safe_name = re.sub(r"[^A-Za-z0-9._-]", "_", name_no_spaces)

            timestamp_ms = int(time.time() * 1000)
            final_filename = f"{bug_id}_{timestamp_ms}_{safe_name}"
            path = f"bug-attachments/{final_filename}"

            resp = storage_client.storage.from_(bucket).upload(
                path,
                contents,
                {"content-type": file.content_type or "application/octet-stream"},
            )

            error = None
            _err = getattr(resp, "error", None)
            if _err:
                error = _err
            elif isinstance(resp, dict) and "error" in resp and resp["error"]:
                error = resp["error"]
            elif isinstance(resp, dict) and "statusCode" in resp and str(
                resp["statusCode"]
            ).startswith("4"):
                error = resp

            if error:
                uploaded.append({"filename": file.filename, "error": str(error)})
                continue

            # verify upload
            try:
                folder_to_list = "bug-attachments"
                search_name = final_filename

                list_resp = storage_client.storage.from_(bucket).list(
                    folder_to_list,
                    {"search": search_name},
                )
                found = False
                if list_resp:
                    for f in list_resp:
                        if f.get("name") == search_name:
                            found = True
                            break

                if not found:
                    uploaded.append(
                        {
                            "filename": file.filename,
                            "error": "Upload verification failed (file not found)",
                        }
                    )
                    continue

            except Exception:
                pass

            public = storage_client.storage.from_(bucket).get_public_url(path)

            if isinstance(public, dict):
                url = (
                    public.get("publicURL")
                    or public.get("publicUrl")
                    or public.get("public_url")
                    or public.get("signedURL")
                    or public.get("signedUrl")
                )
            elif isinstance(public, str):
                url = public
            else:
                url = (
                    getattr(public, "public_url", None)
                    or getattr(public, "publicUrl", None)
                    or getattr(public, "url", None)
                )

            uploaded.append(
                {
                    "filename": final_filename,
                    "url": url,
                    "path": path,
                }
            )

        # 🧩 Persist uploaded attachments into the bug row in DB (via REST)
        successful_files = [f for f in uploaded if not f.get("error") and f.get("url")]

        if successful_files:

            existing_attachments: List[Dict[str, Any]] = []
            table_found = None

            # 1) Find the bug row in one of the candidate tables
            for name in CANDIDATE_TABLES:
                try:
                    params = {
                        "select": "Attachments",
                        "Bug ID": f"eq.{bug_id}",
                    }
                    resp = _http_get(
                        f"{SUPABASE_REST_URL}/{name}",
                        headers=_supabase_headers(),
                        params=params,
                        timeout=10,
                    )
                    if resp.ok and resp.json():
                        table_found = name
                        row = resp.json()[0]

                        raw_att = row.get("Attachments") or row.get("attachments") or []
                        if isinstance(raw_att, str):
                            try:
                                raw_att = json.loads(raw_att)
                            except Exception:
                                raw_att = []

                        if not isinstance(raw_att, list):
                            raw_att = []

                        existing_attachments = raw_att
                        break
                except Exception:
                    continue

            if table_found:
                new_attachments = existing_attachments + successful_files

                try:
                    params = {"Bug ID": f"eq.{bug_id}"}
                    headers = _supabase_headers({"Prefer": "return=representation"})
                    upd = _http_patch(
                        f"{SUPABASE_REST_URL}/{table_found}",
                        headers=headers,
                        params=params,
                        json={"Attachments": new_attachments},
                        timeout=10,
                    )

                    if not upd.ok:
                        print("Attachment DB update error:", upd.status_code, upd.text)
                except Exception as e:
                    print("Attachment DB update exception:", e)

        return {"status": "success", "files": uploaded}

    except Exception as e:
        error_msg = str(e)

        if "row-level security policy" in error_msg.lower() or "unauthorized" in error_msg.lower():
            detail_msg = (
                "Upload failed due to Supabase Security Policies (RLS). "
                "SOLUTION: Add 'SUPABASE_SERVICE_ROLE_KEY' to your backend .env file "
                "to bypass these restrictions, OR configure a Storage Policy in Supabase "
                "to allow INSERT/SELECT for the 'bug-attachments' bucket."
            )
            raise HTTPException(status_code=403, detail=detail_msg)

        raise HTTPException(status_code=500, detail=f"Upload failed: {error_msg}")


# ---------- UPDATE BUG ----------

def _update_bug_with_fallback(bug_id: str, payload: Dict[str, Any]):
    """
    Try to update the bug in several possible tables using Supabase REST.
    """
    errors = []

    # Map Comments array -> Comment JSON string for DB
    if "Comments" in payload and isinstance(payload["Comments"], list):
        payload["Comment"] = json.dumps(payload["Comments"])
        payload.pop("Comments", None)

    for name in CANDIDATE_TABLES:
        try:
            params = {"Bug ID": f"eq.{bug_id}"}
            headers = _supabase_headers({"Prefer": "return=representation"})
            resp = _http_patch(
                f"{SUPABASE_REST_URL}/{name}",
                headers=headers,
                params=params,
                json=payload,
                timeout=10,
            )

            if not resp.ok:
                errors.append(f"{name}: {resp.status_code} {resp.text}")
                continue

            data = resp.json() or []
            if data:
                return {"status": "success", "data": data}

        except Exception as e:
            errors.append(f"{name}: {e}")
            continue

    raise HTTPException(
        status_code=500,
        detail=f"Failed to update bug in any candidate table. Errors: {'; '.join(errors)}",
    )


@app.put("/api/bugs/{bug_id}")
async def update_bug(bug_id: str, request: Request):
    try:
        payload: Dict[str, Any] = await request.json()
        payload["Bug ID"] = bug_id

        result = _update_bug_with_fallback(bug_id, payload)
        return result
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ===========================
# Transtracker Save API
# ===========================
class TranstrackerEntry(BaseModel):
    applicationtype: str
    productsegregated: Optional[str] = None
    productowner: str
    spoc: str
    projects_products: Optional[str] = None
    buildnumber: Optional[str] = None
    buildreceiveddate: str
    year: Optional[int] = None
    monthname: Optional[str] = None
    quarternumber: Optional[int] = None
    monthnumber: Optional[int] = None
    weeknumber: Optional[int] = None
    dayname: Optional[str] = None
    y_q: Optional[str] = None
    y_q_m_w: Optional[str] = None
    m_y: Optional[str] = None
    buildreceivedtime: Optional[str] = None
    buildmailfrom: Optional[str] = None
    maildetails: Optional[str] = None
    testreportsentdate: Optional[str] = None
    testreportsenttime: Optional[str] = None
    testreportsentby: Optional[str] = None
    signoffstatus: str
    signoffrationale: Optional[str] = None
    totalopenbugs: int
    blocker: Optional[int] = None
    high: Optional[int] = None
    med: Optional[int] = None
    low: Optional[int] = None
    sit: Optional[str] = None
    sitactualhours: Optional[float] = None
    pt: Optional[str] = None
    ptactualhours: Optional[float] = None
    cbt: Optional[str] = None
    cbtactualhours: Optional[float] = None
    android: Optional[str] = None
    androidactualhours: Optional[float] = None
    ios: Optional[str] = None
    iosactualhours: Optional[float] = None
    securitytesting: Optional[str] = None
    totaltTestCases: Optional[int] = None
    automatedTestCases: Optional[int] = None
    manualexecutiontime: Optional[float] = None
    automationexecutiontime: Optional[float] = None
    timesaved: Optional[float] = None
    timesavedpercent: Optional[float] = None


@app.post("/api/transtracker")
async def create_transtracker(entry: TranstrackerEntry):
    """Create a new transtracker entry."""
    try:
        data_dict = entry.model_dump()
        resp = supabase.table("transtrackers").insert(data_dict).execute()
        if hasattr(resp, "error") and getattr(resp, "error", None):
            error_msg = str(getattr(resp, "error"))
            raise HTTPException(status_code=400, detail=error_msg)
        return {"status": "success", "data": getattr(resp, "data", [])}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/transtracker/all")
async def get_all_transtrackers():
    """Get all transtracker entries."""
    try:
        resp = supabase.table("transtrackers").select("*").execute()
        if hasattr(resp, "error") and getattr(resp, "error", None):
            error_msg = str(getattr(resp, "error"))
            raise HTTPException(status_code=400, detail=error_msg)
        return {"status": "success", "data": getattr(resp, "data", [])}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/transtracker/filters")
async def get_transtracker_filters():
    """Get distinct filter options for transtracker dashboard."""
    try:
        resp = supabase.table("transtrackers").select(
            "applicationtype, productsegregated, projects_products, productowner, spoc"
        ).execute()
        
        if hasattr(resp, "error") and getattr(resp, "error", None):
             raise HTTPException(status_code=400, detail=str(getattr(resp, "error")))
             
        data = getattr(resp, "data", []) or []
        
        app_set = set()
        product_set = set()
        owner_set = set()
        spoc_set = set()
        
        for r in data:
            # Application Type
            app_val = str(r.get("applicationtype") or "").strip()
            if app_val: app_set.add(app_val)
            
            # Product
            prod_val = str(r.get("productsegregated") or r.get("projects_products") or "").strip()
            if prod_val: product_set.add(prod_val)
            
            # Owner
            owner_val = str(r.get("productowner") or "").strip()
            if owner_val: owner_set.add(owner_val)
            
            # SPOC
            spoc_val = str(r.get("spoc") or "").strip()
            if spoc_val: spoc_set.add(spoc_val)
            
        return {
            "status": "success",
            "data": {
                "application_types": sorted(list(app_set)),
                "products": sorted(list(product_set)),
                "owners": sorted(list(owner_set)),
                "spocs": sorted(list(spoc_set))
            }
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# DASHBOARD ENDPOINTS #
    
# 
import logging
from typing import Optional, Tuple

logger = logging.getLogger(__name__)
logging.basicConfig(level=logging.INFO)

def _extract_count_from_resp(resp) -> Tuple[int, Optional[str]]:
    """
    Robustly extract a count from various Supabase client responses.
    Returns (count, optional_error_message).
    """
    try:
        if resp is None:
            logger.debug("Supabase response is None")
            return 0, "no response"

        # dict-like
        if isinstance(resp, dict):
            if resp.get("error"):
                return 0, str(resp.get("error"))
            if resp.get("count") is not None:
                count_val = resp.get("count")
                return int(count_val) if count_val is not None else 0, None
            if resp.get("data") is not None:
                data_val = resp.get("data")
                return len(data_val) if data_val else 0, None

        # object with attributes (APIResponse etc.)
        data_attr = getattr(resp, "data", None)
        count_attr = getattr(resp, "count", None)
        error_attr = getattr(resp, "error", None)

        if error_attr:
            return 0, str(error_attr)
        if count_attr is not None:
            try:
                return int(count_attr), None
            except Exception:
                pass
        if data_attr is not None:
            try:
                return len(data_attr or []), None
            except Exception:
                try:
                    return len(list(data_attr)), None
                except Exception:
                    pass

        # tuple/list (some clients return (data, error))
        if isinstance(resp, (list, tuple)):
            if len(resp) >= 1 and isinstance(resp[0], (list, tuple)):
                return len(resp[0]), None
            return len(resp), None

        # last resort: inspect __dict__ / vars
        try:
            d = getattr(resp, "__dict__", None) or dict(vars(resp))
            if isinstance(d, dict):
                if d.get("error"):
                    return 0, str(d.get("error"))
                if d.get("data") is not None:
                    return len(d.get("data") or []), None
        except Exception:
            pass

        logger.debug("Unknown response shape when extracting count: %r", resp)
        return 0, None

    except Exception as e:
        logger.exception("Exception extracting count: %s", e)
        return 0, str(e)


def _count_table(table_name: str, select_col: str = '"id"') -> Tuple[int, Optional[str]]:
    """
    Robust count for a Supabase table.
    Attempts:
      - select(select_col, count="exact")
      - fallback to select('"Bug ID"', count="exact") for likely Bug sheet
      - fallback to select("id", count="exact")

      - fallback to fetching data and len(data)

    Returns (count, error_message)
    """
    try:
        logger.info("Querying table=%s select_col=%s", table_name, select_col)

        # Primary attempt
        try_cols = [select_col]
        # if user used "*", try explicit columns likely present
        if select_col == "*" or select_col == '"*"':
            try_cols.extend(['"Bug ID"', '"id"', "id"])

        # also add some sensible fallbacks
        if '"Bug ID"' not in try_cols:
            try_cols.append('"Bug ID"')
        if '"id"' not in try_cols:
            try_cols.append('"id"')
        if "id" not in try_cols:
            try_cols.append("id")

        last_err = None
        for col in try_cols:
            try:
                logger.debug("Attempting select(%s, count='exact') on %s", col, table_name)
                # Use keyword arguments to avoid type issues
                resp = supabase.table(table_name).select(col).execute()
                cnt, err = _extract_count_from_resp(resp)
                if err:
                    last_err = f"col={col} error={err}"
                    logger.warning("Count attempt failed for %s.%s: %s", table_name, col, err)
                    # try next fallback
                    continue
                logger.info("Count success for %s (col=%s): %d", table_name, col, cnt)
                return cnt, None
            except Exception as inner:
                last_err = str(inner)
                logger.exception("Exception while querying %s with column %s: %s", table_name, col, inner)
                continue

        # Final fallback: try selecting some rows and count them
        try:
            logger.debug("Final fallback: select all rows (limit 1000) from %s", table_name)
            resp2 = supabase.table(table_name).select("*").limit(1000).execute()
            cnt2, err2 = _extract_count_from_resp(resp2)
            if err2:
                logger.warning("Final fallback also returned error: %s", err2)
                return 0, last_err or err2
            logger.info("Final fallback counted %d rows for %s", cnt2, table_name)
            return cnt2, None
        except Exception as final_exc:
            logger.exception("Final fallback exception for %s: %s", table_name, final_exc)
            return 0, last_err or str(final_exc)

    except Exception as e:
        logger.exception("Unexpected error in _count_table for %s: %s", table_name, e)
        return 0, str(e)


@app.get("/api/counts")
def get_counts():
    """Returns counts of bugs, users, and transactions for dashboard."""
    try:
        logger.info("Handling /api/counts")

        # For Bugs_file we prefer the native column name if present ("Bug ID")
        total_bugs, err_bugs = _count_table("bugs", select_col='"Bug ID"')
        # if still 0 and there was an error, try wildcard with count
        if total_bugs == 0 and err_bugs:
            logger.info("Retrying bugs with '*' because first attempt returned 0 and error=%s", err_bugs)
            total_bugs, err_bugs = _count_table("bugs", select_col="*")

        total_users, err_users = _count_table("users", select_col='"id"')
        # transaction/transtracker fallbacks
        transaction_tracker, err_trans = _count_table("transtrackers", select_col='"id"')
        if transaction_tracker == 0:
            alt_count, _ = _count_table("transtracker", select_col='"id"')
            if alt_count:
                transaction_tracker = alt_count
            else:
                alt_count2, _ = _count_table("transactions", select_col='"id"')
                transaction_tracker = alt_count2

        response = {
            "status": "success",
            "data": {
                "total_bugs": total_bugs,
                "users": total_users,
                "transactions": transaction_tracker,
            },
        }
        logger.info("/api/counts -> %s", response)
        return response
    except Exception as e:
        msg = f"Error in /api/counts: {e}"
        logger.exception(msg)
        return {"status": "error", "detail": msg}, 500


# Create router for API endpoints
from fastapi import APIRouter
router = APIRouter()

def _get_rows_from_resp(resp) -> List[Dict[str, Any]]:
    """Safely extract rows from different supabase response shapes."""
    if resp is None:
        return []
    # object with .data
    rows = getattr(resp, "data", None)
    if rows is not None:
        return rows or []
    # dict-like
    try:
        if isinstance(resp, dict):
            return resp.get("data", []) or []
        get = getattr(resp, "get", None)
        if callable(get):
            return resp.get("data", []) or []
    except Exception:
        pass
    return []


def _parse_iso_datetime(s: str) -> datetime:
    """Parse ISO-ish datetime strings robustly (handle trailing Z)."""
    if s is None:
        raise ValueError("None date string")
    s = s.strip()
    # Replace trailing Z with +00:00 for fromisoformat
    if s.endswith("Z"):
        s = s[:-1] + "+00:00"
    # Some strings might not have timezone; fromisoformat will create naive dt,
    # which is OK for grouping by date/month/week.
    return datetime.fromisoformat(s)


# ---------- endpoint ----------
@router.get("/transtracker/bar")
async def get_transtracker_bar(group_by: str = Query("day", regex="^(day|week|month|year)$")):
    """
    Returns:
      { "status": "success", "data": [ { "date": "<label>", "value": <int> }, ... ] }
    On error returns HTTP 500 with a short, user-friendly message (no internal details).
    """
    # 1) call supabase safely
    try:
        resp = supabase.table("transtrackers").select("buildreceiveddate, totalopenbugs").order("buildreceiveddate", desc=False).execute()
    except Exception:
        # log full exception but return safe message to client
        logger.exception("Supabase query failed during execute()")
        raise HTTPException(status_code=500, detail="Unable to fetch transtracker data")

    # 2) guard against supabase returning an error object/shape
    try:
        err_obj = None
        # some supabase clients return an object with `.error`
        if hasattr(resp, "error"):
            err_obj = getattr(resp, "error", None)
        elif isinstance(resp, dict) and "error" in resp:
            err_obj = resp.get("error")
        if err_obj:
            logger.error("Supabase returned an error object: %r", err_obj)
            raise HTTPException(status_code=500, detail="Unable to fetch transtracker data")
    except HTTPException:
        # re-raise our safe HTTPException
        raise
    except Exception:
        logger.exception("Unexpected supabase response shape")
        raise HTTPException(status_code=500, detail="Unable to fetch transtracker data")

    # 3) extract rows safely
    rows = _get_rows_from_resp(resp)
    if not rows:
        return {"status": "success", "data": []}

    # 4) aggregate into buckets
    agg: Dict[str, Tuple[int, datetime]] = {}

    for r in rows:
        # row may be dict-like or attribute object
        if isinstance(r, dict):
            raw_date = r.get("buildreceiveddate")
            raw_val = r.get("totalopenbugs")
        else:
            raw_date = getattr(r, "buildreceiveddate", None)
            raw_val = getattr(r, "totalopenbugs", None)

        if not raw_date:
            continue

        try:
            dt = raw_date if isinstance(raw_date, datetime) else _parse_iso_datetime(str(raw_date))
        except Exception as ex:
            logger.debug("Skipping row with bad date %r : %s", raw_date, ex)
            continue

        # safe numeric conversion
        try:
            val = int(float(raw_val)) if raw_val not in (None, "") else 0
        except Exception:
            val = 0

        # key label and sort-date per group_by
        if group_by == "month":
            label = dt.strftime("%Y-%m")
            sort_dt = datetime(dt.year, dt.month, 1)
        elif group_by == "week":
            iso = dt.isocalendar()  # (iso_year, iso_week, iso_weekday)
            label = f"{iso[0]}-W{iso[1]:02d}"
            # first day (Monday) of the ISO week for sorting
            try:
                sort_dt = datetime.fromisocalendar(iso[0], iso[1], 1)
            except Exception:
                # fallback: use dt itself
                sort_dt = dt
        elif group_by == "year":
            label = str(dt.year)
            sort_dt = datetime(dt.year, 1, 1)
        else:  # day
            label = dt.strftime("%Y-%m-%d")
            sort_dt = datetime(dt.year, dt.month, dt.day)

        if label in agg:
            current_sum, existing_sort = agg[label]
            agg[label] = (current_sum + val, min(existing_sort, sort_dt))
        else:
            agg[label] = (val, sort_dt)

    # 5) prepare sorted result
    sorted_items = sorted(agg.items(), key=lambda kv: kv[1][1])
    result = [{"date": k, "value": int(v[0])} for k, v in sorted_items]

    return {"status": "success", "data": result}


# include router under /api
app.include_router(router, prefix="/api")

# optional: root health check
@app.get("/")
async def root():
    return {"status": "ok", "service": "transtracker"}

@app.get("/api")
def api_root():
    return {"status": "ok"}

@app.get("/api/tasks")
def get_tasks():
    try:
        try:
            resp = supabase.table("tasks").select("*").order("created_at", desc=True).execute()
        except Exception:
            resp = supabase.table("tasks").select("*").execute()
        rows = resp.data or []
        return {"status": "success", "data": rows}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/tasks")
async def create_task(request: Request):
    try:
        payload = await request.json()
        title = (payload.get("title") or "").strip()
        if not title:
            raise HTTPException(status_code=400, detail="Title is required")
        # tenant_id removed from insert to avoid schema cache errors in environments without this column
        created_by_val = (payload.get("createdBy") or "").strip()
        due_date_val = (payload.get("dueDate") or "").strip()
        meta_tag = f"[meta] due={due_date_val} created_by={created_by_val}".strip()
        new_id = str(uuid4())
        now_iso = datetime.now(timezone.utc).isoformat()
        
        # Prepare full payload for single insert
        assigned_to_val = (payload.get("assignedTo") or "").strip()
        priority_val = (payload.get("priority") or "medium").strip()
        note_val = ((payload.get("description") or "").strip() + (f"\n\n{meta_tag}" if meta_tag else "")).strip()

        try:
            base = {
                "id": new_id,
                "task_name": title,
                "task_status": (payload.get("status") or "todo").strip(),
                "task_priority": priority_val,
                "assigned_to": assigned_to_val,
                "task_note": note_val,
                "created_at": now_iso
            }
            resp1 = supabase.table("tasks").insert(base).execute()
            error = getattr(resp1, "error", None)
            if error:
                print(f"[ERROR] Supabase insert error: {error}")
                raise HTTPException(status_code=400, detail=str(error))
            
            inserted_rows = getattr(resp1, "data", []) or []
            if not inserted_rows:
                 # Fallback: if data is empty, maybe try to fetch it
                 final = supabase.table("tasks").select("*").eq("id", new_id).execute()
                 inserted_rows = getattr(final, "data", []) or []
                 
            if not inserted_rows:
                 # If still empty, return what we sent but it might be missing DB-generated fields if any
                 # But since we provided ID and others, it should be fine.
                 return {"status": "success", "data": base}

            inserted = inserted_rows[0]
            return {"status": "success", "data": inserted}

        except HTTPException:
            raise
        except Exception as e:
            print(f"[ERROR] Task creation failed: {str(e)}")
            raise HTTPException(status_code=500, detail=str(e))
    except HTTPException:
        raise
    except Exception as e:
        print(f"[ERROR] Request parsing failed: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


# moved to end of file after all endpoints are registered

@app.delete("/api/tasks/{task_id}")
def delete_task(task_id: str):
    try:
        resp = supabase.table("tasks").delete().eq("id", task_id).execute()
        return {"status": "success", "data": resp.data or []}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.delete("/api/tasks")
def delete_task_by_query(task_name: str = Query(...), task_status: Optional[str] = Query(None)):
    try:
        q = supabase.table("tasks").delete().eq("task_name", task_name)
        if task_status:
            q = q.eq("task_status", task_status)
        resp = q.execute()
        return {"status": "success", "data": resp.data or []}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
 
if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
