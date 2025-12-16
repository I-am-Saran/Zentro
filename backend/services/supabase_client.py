import os
from typing import Optional
from dotenv import load_dotenv
from supabase import create_client, Client

load_dotenv()

SUPABASE_URL = os.getenv("SUPABASE_URL") or os.getenv("VITE_SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY") or os.getenv("VITE_SUPABASE_ANON_KEY")
SUPABASE_SERVICE_ROLE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")

class MissingSupabaseClient:
    def __getattr__(self, _):
        raise Exception("Supabase is not configured. Set SUPABASE_URL and SUPABASE_KEY environment variables.")

supabase: Client | MissingSupabaseClient
supabase_admin: Optional[Client] = None

if SUPABASE_URL and SUPABASE_KEY:
    supabase = create_client(SUPABASE_URL, SUPABASE_KEY)
    if SUPABASE_SERVICE_ROLE_KEY:
        supabase_admin = create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
else:
    supabase = MissingSupabaseClient()
    supabase_admin = None

def verify_supabase_token(authorization_header: Optional[str] = None):
    try:
        if isinstance(supabase, MissingSupabaseClient):
            return None
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
