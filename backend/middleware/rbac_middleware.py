# src/middleware/rbac_middleware.py
import functools
from typing import Optional, List, Union, Any
from fastapi import HTTPException, Depends, Header, Request
from backend.services.supabase_client import supabase
import logging

logger = logging.getLogger(__name__)

def get_current_user_from_request(request: Request) -> dict:
    """Extract and verify user from request headers"""
    auth_header = request.headers.get("authorization")
    logger.info(f"get_current_user_from_request: Found authorization header: {auth_header[:30] if auth_header else None}...")
    
    if not auth_header or not auth_header.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Invalid authorization header")
    
    try:
        # Manually verify the token
        current_user = verify_supabase_token(auth_header)
        logger.info(f"get_current_user_from_request: Manually verified user: {current_user.get('user_id') if current_user else None}")
        return current_user
    except Exception as e:
        logger.error(f"get_current_user_from_request: Token verification failed: {e}")
        raise HTTPException(status_code=401, detail="Invalid token")

def verify_supabase_token(authorization: Optional[str] = Header(None)) -> dict:
    """Verify Supabase JWT token and return user data."""
    logger.info(f"verify_supabase_token called with authorization: {authorization[:20] if authorization else None}...")
    
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Invalid authorization header")
    
    try:
        token = authorization.split(" ")[1]
        logger.info(f"Token extracted: {token[:20]}...")
        
        # First, try to decode the token to get basic info
        from backend.services.auth_utils import decode_access_token
        decoded_token = decode_access_token(token)
        
        if not decoded_token:
            raise HTTPException(status_code=401, detail="Invalid or expired token")
        
        logger.info(f"Decoded token role: {decoded_token.get('role')}")
        logger.info(f"Decoded token sub: {decoded_token.get('sub')}")
        
        # Try to verify with Supabase, but fallback to token data if that fails
        try:
            auth_response = supabase.auth.get_user(token)
            if auth_response and hasattr(auth_response, 'user') and auth_response.user:
                result = {
                    "user": auth_response.user,
                    "user_id": auth_response.user.id,
                    "role": decoded_token.get("role")
                }
                logger.info(f"verify_supabase_token returning: user_id={result['user_id']}, role={result['role']}")
                return result
        except Exception as supabase_error:
            logger.warning(f"Supabase auth verification failed (falling back to token data): {supabase_error}")
        
        # Fallback: Use token data directly
        # For role-based access, we can trust the token role if it's present
        user_id = decoded_token.get('sub') or decoded_token.get('user_id')
        if user_id:
            result = {
                "user_id": user_id,
                "role": decoded_token.get("role"),
                "email": decoded_token.get("email"),
                "token_data": decoded_token  # Include full token data for debugging
            }
            logger.info(f"verify_supabase_token fallback returning: user_id={result['user_id']}, role={result['role']}")
            return result
        
        raise HTTPException(status_code=401, detail="Invalid token: no user ID found")
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Token verification failed: {e}")
        raise HTTPException(status_code=401, detail="Invalid or expired token")

def check_user_permission(user_id: str, permission_code: str) -> bool:
    """
    Check if a user has a specific permission using the PostgreSQL function.
    This checks both role-based permissions and user-specific overrides.
    """
    try:
        result = supabase.rpc("check_user_permission", {
            "p_user_id": user_id,
            "p_permission_code": permission_code
        }).execute()
        
        if result.data and isinstance(result.data, list) and len(result.data) > 0:
            first_item = result.data[0]
            if isinstance(first_item, dict) and "check_user_permission" in first_item:
                return bool(first_item.get("check_user_permission"))
        return False
    except Exception as e:
        logger.error(f"Permission check failed for user {user_id}, permission {permission_code}: {e}")
        return False

def get_user_role(user_data: Optional[dict]) -> Optional[str]:
    """Get the user's role name from the user data."""
    logger.info(f"get_user_role called with user_data: {user_data}")
    if not user_data:
        return None
    try:
        # Try to get role from current_user data first
        if isinstance(user_data, dict):
            role = user_data.get("role")
            logger.info(f"Role from user_data: {role}")
            if role:
                return role
            
            # If role not in user_data, try to get user_id and query database
            user_id = user_data.get("user_id") or (user_data.get("user", {}).get("id") if isinstance(user_data.get("user"), dict) else None)
            logger.info(f"User ID extracted: {user_id}")
            if user_id:
                user_response = supabase.table("users").select("role").eq("id", user_id).execute()
                logger.info(f"Database query result: {user_response.data}")
                if user_response.data and isinstance(user_response.data, list) and len(user_response.data) > 0:
                    role_data = user_response.data[0]
                    if isinstance(role_data, dict):
                        role_value = role_data.get("role")
                        return str(role_value) if role_value is not None else None
            
            # If no user_id but we have token_data, try to extract role from token
            token_data = user_data.get("token_data")
            if token_data and isinstance(token_data, dict):
                token_role = token_data.get("role")
                logger.info(f"Role from token_data: {token_role}")
                if token_role:
                    return token_role
        
        logger.info("No role found, returning None")
        return None
    except Exception as e:
        logger.error(f"Failed to get user role for user data {user_data}: {e}")
        return None

def require_permission(permission_code: str):
    """
    Decorator/middleware that requires a specific permission to access an endpoint.
    
    Usage:
    @app.get("/api/admin/users")
    @require_permission("users.read")
    async def get_users(current_user: dict = Depends(verify_supabase_token)):
        # This endpoint is only accessible to users with 'users.read' permission
        return {"users": []}
    """
    def decorator(func):
        @functools.wraps(func)
        async def wrapper(*args, **kwargs):
            # Get the current user from the function arguments
            current_user = kwargs.get('current_user') or kwargs.get('authorization')
            
            # If current_user is not in kwargs, try to get it from a dependency
            if not current_user:
                # Try to find the user data in the function signature
                import inspect
                sig = inspect.signature(func)
                for param_name, param in sig.parameters.items():
                    if param_name in ['current_user', 'user', 'authorization']:
                        # This should be handled by FastAPI's dependency injection
                        break
                else:
                    raise HTTPException(
                        status_code=500, 
                        detail="require_permission decorator requires current_user parameter"
                    )
            
            # Extract user_id from current_user data
            if isinstance(current_user, dict):
                user_id = current_user.get("user_id") or (current_user.get("user", {}).get("id") if isinstance(current_user.get("user"), dict) else None)
            else:
                # Assume it's already the user_id string
                user_id = str(current_user)
            
            if not user_id:
                raise HTTPException(status_code=401, detail="User ID not found")
            
            # Check permission
            if not check_user_permission(user_id, permission_code):
                user_role = get_user_role(current_user) if current_user else None
                raise HTTPException(
                    status_code=403, 
                    detail=f"Insufficient permissions. Required: {permission_code}. Current role: {user_role or 'Unknown'}"
                )
            
            # User has permission, proceed with the function
            return await func(*args, **kwargs)
        
        return wrapper
    return decorator

def require_any_permission(permission_codes: List[str]):
    """
    Require any one of the specified permissions.
    
    Usage:
    @require_any_permission(["users.read", "admin.read"])
    async def get_users(current_user: dict = Depends(verify_supabase_token)):
        # Accessible to users with either 'users.read' OR 'admin.read'
        return {"users": []}
    """
    def decorator(func):
        @functools.wraps(func)
        async def wrapper(*args, **kwargs):
            current_user = kwargs.get('current_user') or kwargs.get('authorization')
            
            if isinstance(current_user, dict):
                user_id = current_user.get("user_id") or current_user.get("user", {}).get("id")
            else:
                user_id = str(current_user)
            
            if not user_id:
                raise HTTPException(status_code=401, detail="User ID not found")
            
            # Check if user has any of the required permissions
            has_permission = False
            for permission_code in permission_codes:
                if check_user_permission(user_id, permission_code):
                    has_permission = True
                    break
            
            if not has_permission:
                user_role = get_user_role(current_user) if current_user else None
                raise HTTPException(
                    status_code=403, 
                    detail=f"Insufficient permissions. Required any of: {', '.join(permission_codes)}. Current role: {user_role or 'Unknown'}"
                )
            
            return await func(*args, **kwargs)
        
        return wrapper
    return decorator

def require_all_permissions(permission_codes: List[str]):
    """
    Require all of the specified permissions.
    
    Usage:
    @require_all_permissions(["users.read", "users.write"])
    async def manage_users(current_user: dict = Depends(verify_supabase_token)):
        # Only accessible to users with BOTH 'users.read' AND 'users.write'
        return {"users": []}
    """
    def decorator(func):
        @functools.wraps(func)
        async def wrapper(*args, **kwargs):
            current_user = kwargs.get('current_user') or kwargs.get('authorization')
            
            if isinstance(current_user, dict):
                user_id = current_user.get("user_id") or current_user.get("user", {}).get("id")
            else:
                user_id = str(current_user)
            
            if not user_id:
                raise HTTPException(status_code=401, detail="User ID not found")
            
            # Check if user has all required permissions
            missing_permissions = []
            for permission_code in permission_codes:
                if not check_user_permission(user_id, permission_code):
                    missing_permissions.append(permission_code)
            
            if missing_permissions:
                user_role = get_user_role(current_user) if current_user else None
                raise HTTPException(
                    status_code=403, 
                    detail=f"Insufficient permissions. Missing: {', '.join(missing_permissions)}. Current role: {user_role or 'Unknown'}"
                )
            
            return await func(*args, **kwargs)
        
        return wrapper
    return decorator

def require_role(role_name: str):
    """
    Require a specific role (Admin, QA, DEV, User, etc.).
    This is simpler than permission-based access but less granular.
    
    Usage:
    @require_role("Admin")
    async def admin_endpoint(current_user: dict = Depends(verify_supabase_token)):
        # Only accessible to Admin role users
        return {"admin_data": []}
    """
    def decorator(func):
        @functools.wraps(func)
        async def wrapper(*args, request: Optional[Request] = None, **kwargs) -> Any:
            # Since FastAPI dependency injection passes None for current_user in decorators,
            # we need to manually verify the token using the authorization header
            
            # First, try to get current_user from kwargs (FastAPI dependency injection)
            current_user = kwargs.get('current_user') or kwargs.get('authorization')
            logger.info(f"require_role: Initial current_user from kwargs: {current_user}")
            
            # If current_user is None, we need to manually extract from request
            if current_user is None and request:
                logger.info("require_role: current_user is None, attempting manual extraction from request")
                
                try:
                    current_user = get_current_user_from_request(request)
                    logger.info(f"require_role: Successfully extracted user from request: {current_user.get('user_id') if current_user else None}")
                except HTTPException as e:
                    logger.error(f"require_role: Failed to get user from request: {e}")
                    raise
            elif current_user is None:
                logger.error("require_role: current_user is None and no request object available")
            
            if isinstance(current_user, dict):
                user_id = current_user.get("user_id") or current_user.get("user", {}).get("id")
            else:
                user_id = str(current_user) if current_user else None
            
            if not user_id:
                raise HTTPException(status_code=401, detail="User ID not found")
            
            user_role = get_user_role(current_user) if current_user else None
            if user_role != role_name:
                raise HTTPException(
                    status_code=403, 
                    detail=f"Insufficient role. Required: {role_name}. Current role: {user_role or 'Unknown'}"
                )
            
            return await func(*args, **kwargs)
        
        return wrapper
    return decorator

def require_any_role(role_names: List[str]):
    """
    Require any one of the specified roles.
    
    Usage:
    @require_any_role(["Admin", "QA"])
    async def qa_or_admin_endpoint(current_user: dict = Depends(verify_supabase_token)):
        # Accessible to users with either Admin OR QA role
        return {"data": []}
    """
    def decorator(func):
        @functools.wraps(func)
        async def wrapper(*args, **kwargs):
            logger.info(f"require_any_role wrapper called with args: {args}, kwargs: {kwargs}")
            
            # Debug: log the types and attributes of all args and kwargs
            for i, arg in enumerate(args):
                logger.info(f"Arg {i}: type={type(arg)}, hasattr headers: {hasattr(arg, 'headers')}")
                if hasattr(arg, 'headers'):
                    logger.info(f"Arg {i} headers: {getattr(arg, 'headers', None)}")
            
            for key, value in kwargs.items():
                logger.info(f"Kwarg {key}: type={type(value)}, hasattr headers: {hasattr(value, 'headers')}")
                if hasattr(value, 'headers'):
                    logger.info(f"Kwarg {key} headers: {getattr(value, 'headers', None)}")
            
            # Since FastAPI dependency injection passes None for current_user in decorators,
            # we need to manually verify the token using the authorization header
            
            # First, try to get current_user from kwargs (FastAPI dependency injection)
            current_user = kwargs.get('current_user') or kwargs.get('authorization')
            logger.info(f"Initial current_user from kwargs: {current_user}")
            
            # If current_user is None, we need to manually extract from request
            if current_user is None:
                logger.info("current_user is None, attempting manual extraction from request")
                
                # Try to get the authorization header from the function's dependency injection
                # We need to manually call verify_supabase_token with the authorization header
                # Since this is a decorator, we need to extract the header from the request context
                
                # Look for any argument that might be a request or have headers
                auth_header = None
                for arg in args:
                    if hasattr(arg, 'headers') and hasattr(arg.headers, 'get'):
                        auth_header = arg.headers.get('authorization')
                        logger.info(f"Found auth header in arg: {auth_header[:30] if auth_header else None}")
                        if auth_header:
                            break
                
                if auth_header is None:
                    for key, value in kwargs.items():
                        if hasattr(value, 'headers') and hasattr(value.headers, 'get'):
                            auth_header = value.headers.get('authorization')
                            logger.info(f"Found auth header in kwarg {key}: {auth_header[:30] if auth_header else None}")
                            if auth_header:
                                break
                
                # If we found an authorization header, verify the token
                if auth_header and auth_header.startswith('Bearer '):
                    try:
                        current_user = verify_supabase_token(auth_header)
                        logger.info(f"Successfully extracted user from authorization header: {current_user.get('user_id') if current_user else None}")
                    except HTTPException as e:
                        logger.error(f"Failed to verify token: {e}")
                        raise
                else:
                    logger.error("No authorization header found in request")
            
            logger.info(f"Final current_user: {current_user}")
            
            if isinstance(current_user, dict):
                user_id = current_user.get("user_id") or current_user.get("user", {}).get("id")
            else:
                user_id = str(current_user) if current_user else None
            
            logger.info(f"Extracted user_id: {user_id}")
            
            if not user_id:
                raise HTTPException(status_code=401, detail="User ID not found")
            
            user_role = get_user_role(current_user)
            logger.info(f"User role from get_user_role: {user_role}")
            
            if user_role not in role_names:
                raise HTTPException(
                    status_code=403, 
                    detail=f"Insufficient role. Required any of: {', '.join(role_names)}. Current role: {user_role or 'Unknown'}"
                )
            
            return await func(*args, **kwargs)
        
        return wrapper
    return decorator