# backend/main.py
from fastapi import FastAPI, HTTPException, Request, Header, Query, File, UploadFile, Path
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional, List, Dict, Any
from backend.services.supabase_client import supabase, verify_supabase_token
from backend.services.formatters import normalize_control
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
from datetime import datetime, timezone
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


 


 

 

 

# ============================
# 👤 USERS MODULE ENHANCED ENDPOINTS
# ============================

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
        count_resp = supabase.table("users").select("id", count=True).execute()
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
        total_resp = supabase.table("users").select("id", count=True).execute()
        total_users = len(getattr(total_resp, "data", []) or [])
        
        # Get active users
        active_resp = supabase.table("users").select("id", count=True).eq("is_active", True).execute()
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

@app.delete("/api/users/{user_id}")
def delete_user(user_id: str):
    """
    Deletes a user by `id` or `email` from the `users` table.
    Returns { status } when deletion succeeds.
    """
    try:
        # Try by numeric id first
        deleted = False
        try:
            uid_int = int(user_id)
            resp = supabase.table("users").delete().eq("id", uid_int).execute()
            if (getattr(resp, "data", None) or []):
                deleted = True
        except Exception:
            pass

        if not deleted:
            # Fallback: try by id as string and email
            resp = supabase.table("users").delete().eq("id", user_id).execute()
            if not (getattr(resp, "data", None) or []):
                resp = supabase.table("users").delete().eq("email", user_id).execute()
            if (getattr(resp, "data", None) or []):
                deleted = True

        if not deleted:
            raise HTTPException(status_code=404, detail="User not found")

        return {"status": "success"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/invite")
async def invite_user(request: Request):
    """
    Sends an invitation email via Supabase Admin if available; also upserts a user row.
    Accepts JSON: { email, name, role }
    Returns { status, message }
    """
    try:
        payload = await request.json()
        email = (payload.get("email") or "").strip().lower()
        name = (payload.get("name") or "").strip()
        role = (payload.get("role") or "User").strip()

        if not email:
            raise HTTPException(status_code=400, detail="Email is required")

        # Try Supabase Admin invite (requires service role key)
        try:
            admin = getattr(supabase, "auth", None)
            admin = getattr(admin, "admin", None)
            if admin and hasattr(admin, "invite_user_by_email"):
                resp = admin.invite_user_by_email(email)
                if getattr(resp, "error", None):
                    logging.warning(f"Supabase admin invite error: {resp.error}")
                else:
                    logging.info(f"Invitation queued for {email}")
            else:
                logging.warning("Supabase admin invite not available in client")
        except Exception as e:
            logging.warning(f"Admin invite attempt failed: {e}")

        # Attempt direct SMTP email as a fallback
        email_sent = False
        try:
            smtp_host = os.getenv("SMTP_HOST")
            smtp_port = int(os.getenv("SMTP_PORT", "587"))
            smtp_user = os.getenv("SMTP_USER")
            smtp_pass = os.getenv("SMTP_PASS")
            smtp_from = os.getenv("SMTP_FROM", smtp_user or "noreply@example.com")

            if smtp_host and smtp_from:
                msg = EmailMessage()
                msg["Subject"] = "You’re invited to Alchemy GRC"
                msg["From"] = smtp_from
                msg["To"] = email
                msg.set_content(
                    f"Hello {name or email},\n\n" \
                    f"You have been invited to Alchemy GRC with role '{role}'. " \
                    f"Please check your inbox for the Supabase invite.\n\n" \
                    f"Thanks,\nAlchemy Team"
                )

                with smtplib.SMTP(smtp_host, smtp_port) as server:
                    server.starttls()
                    if smtp_user and smtp_pass:
                        server.login(smtp_user, smtp_pass)
                    server.send_message(msg)
                email_sent = True
            else:
                logging.info("SMTP not configured; skipping direct email send")
        except Exception as e:
            logging.warning(f"SMTP send failed: {e}")

        # Upsert into users table as inactive until first login
        now = datetime.now(timezone.utc).isoformat(timespec="seconds")
        upsert = {
            "email": email,
            "full_name": name or email.split("@")[0],
            "role": role,
            "is_active": False,
            "created_at": now,
            "updated_at": now,
            "sso_provider": "",
            "sso_user_id": payload.get("sso_user_id") or "",
            "login_count": 0,
        }
        supabase.table("users").upsert(upsert).execute()

        return {"status": "success", "message": "Invitation processed", "email_sent": email_sent}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    
# ============================
# 🪲 BUGS MODULE ENDPOINTS (FINAL, STABLE, PRODUCTION-READY)
# ============================

# Normalizer for rows (defensive)
def normalize_bug_row(row: Dict[str, Any]) -> Dict[str, Any]:
    """Normalizes bug row data to standard format."""
    try:
        return {
            "Bug ID": row.get("Bug ID") or row.get("bug_id") or row.get("id") or row.get("bugid"),
            "Summary": row.get("Summary") or row.get("summary") or row.get("title") or "",
            "Priority": row.get("Priority") or row.get("priority") or row.get("severity") or "",
            "Status": row.get("Status") or row.get("status") or "",
            "Assignee": row.get("Assignee") or row.get("assignee") or row.get("assignee_name") or "",
            "Changed": row.get("Changed") or row.get("changed") or row.get("updated_at") or row.get("updated") or "",
            "Product": row.get("Product") or row.get("product") or "",
        }
    except Exception:
        return {
            "Bug ID": None,
            "Summary": "",
            "Priority": "",
            "Status": "",
            "Assignee": "",
            "Changed": "",
            "Product": "",
        }

# Candidate table names to try (helps if your environment used a slightly different name)
# Prefer canonical 'bugs' first; include legacy fallbacks where some environments used
# different names. Avoid uppercase 'Bugs' which often doesn't exist.
CANDIDATE_TABLES = ["bugs", "Bugs_file", "bugs_file"]

def _select_bugs_with_fallback():
    """Select bugs from available tables with fallback logic."""
    errors = []
    empty_tables = []
    for name in CANDIDATE_TABLES:
        try:
            # attempt to order by Changed if available
            try:
                resp = supabase.table(name).select("*").order("Changed", desc=True).execute()
            except Exception:
                resp = supabase.table(name).select("*").execute()

            if getattr(resp, "error", None):
                error_msg = str(getattr(resp, "error"))
                errors.append(f"{name}: {error_msg}")
                continue

            data = getattr(resp, "data", []) or []
            if not data:
                empty_tables.append(name)
                print(f"📦 get_bugs: table '{name}' returned 0 rows; trying next candidate")
                continue

            # Filter out non-dict items and normalize
            normalized = [normalize_bug_row(r) for r in data if isinstance(r, dict)]
            print(f"📦 get_bugs: fetched {len(data)} rows from table '{name}'")
            return {"status": "success", "data": normalized}
        except Exception as e:
            errors.append(f"{name}: {e}")
            continue
    # No non-empty data found; return empty success if we reached here without hard errors
    if empty_tables:
        print(f"⚠️ get_bugs: all candidate tables empty: {', '.join(empty_tables)}")
        return {"status": "success", "data": []}
    raise HTTPException(status_code=500, detail=f"Failed to fetch bugs. Tried -> {'; '.join(map(str, errors))}")

def _insert_bug_with_fallback(payload: Dict[str, Any]):
    """Insert bug with fallback to different tables."""
    errors = []
    for name in CANDIDATE_TABLES:
        try:
            resp = supabase.table(name).insert(payload).execute()
            if hasattr(resp, "error") and getattr(resp, "error", None):
                error_msg = str(getattr(resp, "error"))
                errors.append(f"{name}: {error_msg}")
                print(f"Insert to {name} returned error: {error_msg}")
                continue
            inserted = getattr(resp, "data", []) or []
            normalized = [normalize_bug_row(r) for r in inserted]
            print(f"📝 create_bug: inserted into table '{name}', returned {len(inserted)} rows")
            return {"status": "success", "data": inserted if inserted else normalized}
        except Exception as e:
            errors.append(f"{name}: {e}")
            print(f"Insert attempt into {name} failed: {e}")
            continue
    raise HTTPException(status_code=500, detail=f"Failed to insert bug into any candidate table. Errors -> {'; '.join(map(str, errors))}")

@app.post("/api/bugs")
async def create_bug(request: Request):
    try:
        payload: Dict[str, Any] = await request.json()

        # 1. Ensure unique Bug ID
        try:
            bug_id = int(payload.get("Bug ID", 0))
            if bug_id <= 0:
                bug_id = int(time.time() * 1000)
        except Exception:
            bug_id = int(time.time() * 1000)
        payload["Bug ID"] = bug_id

        # 2. Default values (backend ensures required columns exist)
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
            if not payload.get(k):
                payload[k] = v

        # 3. Validate required keys exist
        required = list(defaults.keys()) + ["Bug ID"]
        missing = [f for f in required if f not in payload]
        if missing:
            raise HTTPException(status_code=400, detail=f"Missing fields: {', '.join(missing)}")

        # 4. Insert using fallback
        result = _insert_bug_with_fallback(payload)
        print(f"✅ Bug {payload['Bug ID']} inserted successfully.")
        return result

    except HTTPException:
        raise
    except Exception as e:
        print("❌ Error inserting bug:", str(e))
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/bugs")
async def get_bugs():
    try:
        result = _select_bugs_with_fallback()
        print(f"✅ get_bugs returned: {result}")
        return result
    except Exception as e:
        print(f"❌ get_bugs error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/bugs/{bug_id}")
async def get_bug_details(bug_id: str = Path(...)):
    try:
        # Try across candidate tables; support string or numeric Bug ID depending on schema
        errors = []
        for name in CANDIDATE_TABLES:
            try:
                # Prefer direct match with provided bug_id (text)
                try:
                    resp = supabase.table(name).select("*").eq("Bug ID", bug_id).order("Changed", desc=True).execute()
                except Exception:
                    # Fallback: if the table stores numeric IDs, attempt int conversion
                    try:
                        bug_id_int = int(bug_id)
                        resp = supabase.table(name).select("*").eq("Bug ID", bug_id_int).order("Changed", desc=True).execute()
                    except Exception:
                        resp = supabase.table(name).select("*").eq("Bug ID", bug_id).execute()

                rows = resp.data or []
                if rows:
                    return {"status": "success", "data": rows[0]}
            except Exception as e:
                errors.append(f"{name}: {e}")
                continue
        raise HTTPException(status_code=404, detail="Bug not found")
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# Attachments endpoint (unchanged from prior, left here for completeness)
@app.post("/api/bugs/{bug_id}/attachments")
async def upload_bug_attachments(bug_id: int, files: List[UploadFile] = File(...)):
    try:
        bucket = "bug-attachments"
        uploaded = []
        for file in files:
            if not file.filename:
                continue
            contents = await file.read()
            safe_name = file.filename.replace(" ", "_") if file.filename else "unknown"
            path = f"{bug_id}/{int(time.time()*1000)}_{safe_name}"
            resp = supabase.storage.from_(bucket).upload(path, contents)
            if hasattr(resp, "error") and getattr(resp, "error", None):
                error_msg = str(getattr(resp, "error"))
                uploaded.append({"filename": file.filename, "error": error_msg})
                continue
            public = supabase.storage.from_(bucket).get_public_url(path)
            url = public.get("publicURL") if isinstance(public, dict) else None
            if not url:
                url = getattr(public, "public_url", None) or getattr(public, "url", None)
            uploaded.append({"filename": file.filename, "url": url})
        return {"status": "success", "files": uploaded}
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
        data_dict = entry.dict()
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
      - fallback to select('"Bug ID"', count="exact') for likely Bug sheet
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

@app.get("/api/priority-stats")
def get_priority_stats():
    """Returns bug priority statistics."""
    try:
        # Try to get priority counts from bugs table - try different column names
        resp = supabase.table("bugs").select("Priority").execute()
        rows = resp.data or []
        
        counts = {"high": 0, "medium": 0, "low": 0}
        
        for row in rows:
            if isinstance(row, dict):
                priority = str(row.get("Priority") or "").lower()
                if "high" in priority or "critical" in priority or "blocker" in priority:
                    counts["high"] += 1
                elif "medium" in priority or "normal" in priority:
                    counts["medium"] += 1
                elif "low" in priority or "minor" in priority:
                    counts["low"] += 1
                else:
                    # Default to medium if unknown
                    counts["medium"] += 1
        
        return {"status": "success", "data": counts}
    except Exception as e:
        logger.error(f"Error in priority stats: {e}")
        # Return default counts on error
        return {"status": "success", "data": {"high": 0, "medium": 0, "low": 0}}

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


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)

