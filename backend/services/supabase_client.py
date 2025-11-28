import os
from typing import Optional
from dotenv import load_dotenv
from supabase import create_client, Client

# Load environment variables from .env file in the backend directory
load_dotenv()

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")

if not SUPABASE_URL or not SUPABASE_KEY:
    raise Exception("Missing SUPABASE_URL or SUPABASE_KEY environment variables. Check your .env file.")

supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)


def verify_supabase_token(authorization_header: Optional[str] = None):
    """Lightweight token verification helper for Supabase auth.

    Returns a dict with user info if a valid session exists; otherwise None.
    """
    try:
        if authorization_header and authorization_header.lower().startswith("bearer "):
            _token = authorization_header.split(" ", 1)[1].strip()
        session = supabase.auth.get_session()
        if session and getattr(session, "user", None):
            return {
                "status": "success",
                "user": {
                    "id": getattr(session.user, "id", None),
                    "email": getattr(session.user, "email", None),
                },
            }
        return None
    except Exception:
        return None