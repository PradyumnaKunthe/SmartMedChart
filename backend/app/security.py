import os
from pathlib import Path
from datetime import datetime, timedelta, timezone
from types import SimpleNamespace

from dotenv import load_dotenv
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError, jwt
from pwdlib import PasswordHash

from app.mongo_client import mongo_db


# Load backend environment variables
ENV_FILE = Path(__file__).resolve().parents[1] / ".env"
load_dotenv(ENV_FILE)

JWT_SECRET_KEY = os.getenv("JWT_SECRET_KEY")
JWT_ALGORITHM = os.getenv("JWT_ALGORITHM", "HS256")

JWT_ACCESS_TOKEN_EXPIRE_MINUTES = int(
    os.getenv("JWT_ACCESS_TOKEN_EXPIRE_MINUTES", "30")
)

if not JWT_SECRET_KEY:
    raise RuntimeError("JWT_SECRET_KEY is not configured.")

password_hash = PasswordHash.recommended()

bearer_scheme = HTTPBearer()


# ==============================
# PASSWORD FUNCTIONS
# ==============================

def hash_password(password: str) -> str:
    return password_hash.hash(password)


def verify_password(
    plain_password: str,
    hashed_password: str
) -> bool:
    return password_hash.verify(
        plain_password,
        hashed_password
    )


# ==============================
# JWT FUNCTIONS
# ==============================

def create_access_token(
    subject: str,
    expires_minutes: int | None = None
) -> str:

    if expires_minutes is None:
        expires_minutes = JWT_ACCESS_TOKEN_EXPIRE_MINUTES

    now = datetime.now(timezone.utc)
    expire = now + timedelta(minutes=expires_minutes)

    payload = {
        "sub": subject,
        "iat": now,
        "exp": expire
    }

    return jwt.encode(
        payload,
        JWT_SECRET_KEY,
        algorithm=JWT_ALGORITHM
    )


def decode_access_token(token: str) -> dict:
    try:
        return jwt.decode(
            token,
            JWT_SECRET_KEY,
            algorithms=[JWT_ALGORITHM]
        )
    except JWTError as exc:
        raise ValueError(
            "Invalid or expired access token."
        ) from exc


# ==============================
# LOAD USER FROM MONGODB
# ==============================

def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(
        bearer_scheme
    )
):
    token = credentials.credentials

    try:
        payload = decode_access_token(token)
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=str(exc),
            headers={"WWW-Authenticate": "Bearer"}
        ) from exc

    subject = payload.get("sub")

    if subject is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token does not contain a user identifier."
        )

    try:
        user_id = int(subject)
    except (TypeError, ValueError) as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid user identifier."
        ) from exc

    # Find user in MongoDB
    user = mongo_db.users.find_one({
        "_id": user_id,
        "is_active": {"$in": [1, True]}
    })

    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found or inactive."
        )

    # Find user's role
    role = mongo_db.roles.find_one({
        "_id": user["role_id"]
    })

    if role is None:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User role not found."
        )

    # Find permissions assigned to role
    role_permissions = list(
        mongo_db.role_permissions.find({
            "role_id": role["id"]
        })
    )

    permission_ids = [
        item["permission_id"]
        for item in role_permissions
    ]

    permissions = list(
        mongo_db.permissions.find({
            "_id": {"$in": permission_ids}
        })
    )

    # Build role object
    role_object = SimpleNamespace(
        id=role["id"],
        name=role["name"],
        permissions=[
            SimpleNamespace(name=p["name"])
            for p in permissions
        ]
    )

    # Build user object
    user_data = {
        key: value
        for key, value in user.items()
        if key != "_id"
    }

    user_data["role"] = role_object

    return SimpleNamespace(**user_data)


# ==============================
# ROLE AUTHORIZATION
# ==============================

def require_role(required_role: str):

    def role_dependency(
        current_user=Depends(get_current_user)
    ):

        if current_user.role.name != required_role:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Insufficient role permissions."
            )

        return current_user

    return role_dependency


# ==============================
# PERMISSION AUTHORIZATION
# ==============================

def require_permission(required_permission: str):

    def permission_dependency(
        current_user=Depends(get_current_user)
    ):

        permission_names = {
            permission.name
            for permission in current_user.role.permissions
        }

        if required_permission not in permission_names:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Insufficient permissions."
            )

        return current_user

    return permission_dependency