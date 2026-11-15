"""
routes/auth.py
---------------
Authentication routes for user registration, login, and token management.
"""

import logging
from fastapi import APIRouter, HTTPException, status, Depends, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from datetime import timedelta
from schemas.models import (
    UserRegister, UserLogin, Token, UserResponse, ErrorResponse
)
from services.auth_service import (
    register_user, authenticate_user, create_access_token, 
    verify_token, get_user_by_id, ACCESS_TOKEN_EXPIRE_MINUTES
)
from logger import api_log
from slowapi import Limiter
from slowapi.util import get_remote_address

log = logging.getLogger("h2os.auth")
router = APIRouter(prefix="/api/v1/auth", tags=["Authentication"])
security = HTTPBearer()
limiter = Limiter(key_func=get_remote_address)


async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    """Dependency to get current authenticated user."""
    token = credentials.credentials
    payload = verify_token(token)
    
    if payload is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    user_id = payload.get("sub")
    if user_id is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    user = get_user_by_id(int(user_id))
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    return user


@router.post(
    "/register",
    response_model=Token,
    responses={
        400: {"model": ErrorResponse},
        409: {"model": ErrorResponse},
        429: {"model": ErrorResponse},
    },
)
@limiter.limit("5/minute")  # Prevent registration spam
def register(request: Request, user_data: UserRegister):
    """
    Register a new user and return access token.
    
    - **email**: User email address (must be unique)
    - **password**: User password (min 6 characters)
    - **confirm_password**: Must match password
    """
    # Validate passwords match
    if user_data.password != user_data.confirm_password:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Passwords do not match"
        )
    
    # Password validation is now handled by Pydantic validators
    # Enhanced validation includes length, complexity, and sanitization
    
    # Register user
    user = register_user(user_data.email, user_data.password)
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Email already registered"
        )
    
    # Create access token
    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": str(user["id"]), "email": user["email"]},
        expires_delta=access_token_expires
    )
    
    req_data = user_data.model_dump()
    req_data.pop("password", None)
    req_data.pop("confirm_password", None)
    
    res = {
        "access_token": access_token,
        "token_type": "bearer",
        "user": user
    }
    
    api_log("POST", "/api/v1/auth/register", req_data, res)
    return res


@router.post(
    "/login",
    response_model=Token,
    responses={
        401: {"model": ErrorResponse},
        429: {"model": ErrorResponse},
    },
)
@limiter.limit("10/minute")  # Prevent brute force attacks
def login(request: Request, user_data: UserLogin):
    """
    Authenticate user and return access token.
    
    - **email**: User email address
    - **password**: User password
    """
    user = authenticate_user(user_data.email, user_data.password)
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    # Create access token
    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": str(user["id"]), "email": user["email"]},
        expires_delta=access_token_expires
    )
    
    req_data = user_data.model_dump()
    req_data.pop("password", None)
    
    res = {
        "access_token": access_token,
        "token_type": "bearer",
        "user": user
    }
    
    api_log("POST", "/api/v1/auth/login", req_data, res)
    return res


@router.get(
    "/me",
    response_model=UserResponse,
    responses={
        401: {"model": ErrorResponse},
    },
)
def get_me(current_user: dict = Depends(get_current_user)):
    """
    Get current authenticated user information.
    """
    api_log("GET", "/api/v1/auth/me", None, current_user)
    return current_user


@router.post(
    "/logout",
    responses={
        200: {"description": "Successfully logged out"},
    },
)
def logout():
    """
    Logout user (client-side token removal).
    """
    api_log("POST", "/api/v1/auth/logout", None, {"message": "Logged out successfully"})
    return {"message": "Logged out successfully"}
