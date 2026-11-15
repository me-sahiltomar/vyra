"""
services/auth_service.py
------------------------
Authentication service for user management, password hashing, and JWT tokens.
"""

import time
from datetime import datetime, timedelta
from typing import Optional, Dict, Any
from passlib.context import CryptContext
from jose import JWTError, jwt
from services.db import db_connection
from config import SECRET_KEY

# JWT Configuration
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 30

# Password hashing context
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify a password against its hash."""
    return pwd_context.verify(plain_password, hashed_password)


def get_password_hash(password: str) -> str:
    """Generate password hash."""
    return pwd_context.hash(password)


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    """Create JWT access token."""
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt


def verify_token(token: str) -> Optional[Dict[str, Any]]:
    """Verify JWT token and return payload."""
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        return payload
    except JWTError:
        return None


def register_user(email: str, password: str) -> Optional[Dict[str, Any]]:
    """Register a new user."""
    # Check if user already exists
    with db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT id FROM users WHERE email = ?", (email,))
        if cursor.fetchone():
            return None  # User already exists
        
        # Create new user
        password_hash = get_password_hash(password)
        created_at = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
        
        cursor.execute(
            "INSERT INTO users (email, password_hash, created_at) VALUES (?, ?, ?)",
            (email, password_hash, created_at)
        )
        conn.commit()
        
        # Get user data
        cursor.execute("SELECT id, email, created_at FROM users WHERE email = ?", (email,))
        user = cursor.fetchone()
        
        return dict(user)


def authenticate_user(email: str, password: str) -> Optional[Dict[str, Any]]:
    """Authenticate user with email and password."""
    with db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT id, email, password_hash FROM users WHERE email = ?", (email,))
        user = cursor.fetchone()
        
        if not user:
            return None
        
        if not verify_password(password, user["password_hash"]):
            return None
        
        # Update last login
        last_login = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
        cursor.execute("UPDATE users SET last_login = ? WHERE id = ?", (last_login, user["id"]))
        conn.commit()
        
        return {
            "id": user["id"],
            "email": user["email"],
            "last_login": last_login
        }


def get_user_by_id(user_id: int) -> Optional[Dict[str, Any]]:
    """Get user by ID."""
    with db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute(
            "SELECT id, email, created_at, last_login FROM users WHERE id = ?",
            (user_id,)
        )
        user = cursor.fetchone()
        return dict(user) if user else None
