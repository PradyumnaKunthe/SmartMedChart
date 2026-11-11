import hashlib
import os
from pathlib import Path
from datetime import datetime, timedelta, timezone
from types import SimpleNamespace
import uuid

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
# Strictly pin algorithm to HS256 to prevent algorithm confusion/downgrade attacks
ALLOWED_JWT_ALGORITHMS = ["HS256"]
JWT_ALGORITHM = "HS256"

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
    """Hash password using pwdlib recommended hasher (Argon2 / bcrypt)."""
    return password_hash.hash(password)


def verify_password(
    plain_password: str,
    hashed_password: str
) -> bool:
    """Safely verify plain password against hashed password."""
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
    """Generate signed JWT access token with fixed HS256 algorithm and claims."""
    if expires_minutes is None:
        expires_minutes = JWT_ACCESS_TOKEN_EXPIRE_MINUTES

    now = datetime.now(timezone.utc)
    expire = now + timedelta(minutes=expires_minutes)
    jti = str(uuid.uuid4())

    payload = {
        "sub": str(subject),
        "iat": now,
        "exp": expire,
        "type": "access",
        "jti": jti,
    }

    return jwt.encode(
        payload,
        JWT_SECRET_KEY,
        algorithm=JWT_ALGORITHM
    )


def decode_access_token(token: str) -> dict:
    """Decode and validate JWT access token with pinned algorithm and type checks."""
    try:
        payload = jwt.decode(
            token,
            JWT_SECRET_KEY,
            algorithms=ALLOWED_JWT_ALGORITHMS
        )
    except JWTError as exc:
        raise ValueError(
            "Invalid or expired access token."
        ) from exc

    # Enforce token type if present to prevent token interchange
    token_type = payload.get("type")
    if token_type is not None and token_type != "access":
        raise ValueError("Invalid access token type.")

    return payload


def revoke_token(token: str) -> bool:
    """Revoke a JWT token by storing its jti and token hash in MongoDB until expiration."""
    try:
        payload = decode_access_token(token)
        jti = payload.get("jti")
        exp = payload.get("exp")
        sub = payload.get("sub")
        token_hash = hashlib.sha256(token.encode("utf-8")).hexdigest()
        revocation_key = jti or token_hash

        if isinstance(exp, (int, float)):
            exp_dt = datetime.fromtimestamp(exp, tz=timezone.utc)
        else:
            exp_dt = datetime.now(timezone.utc) + timedelta(minutes=JWT_ACCESS_TOKEN_EXPIRE_MINUTES)

        mongo_db.revoked_tokens.update_one(
            {"_id": revocation_key},
            {
                "$set": {
                    "_id": revocation_key,
                    "jti": jti,
                    "token_hash": token_hash,
                    "sub": sub,
                    "revoked_at": datetime.now(timezone.utc),
                    "expires_at": exp_dt,
                }
            },
            upsert=True,
        )
        return True
    except Exception:
        return False


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

    # Check server-side revocation list
    jti = payload.get("jti")
    token_hash = hashlib.sha256(token.encode("utf-8")).hexdigest()
    revocation_keys = [token_hash]
    if jti:
        revocation_keys.append(jti)

    try:
        revoked = mongo_db.revoked_tokens.find_one({
            "$or": [
                {"_id": {"$in": revocation_keys}},
                {"jti": jti} if jti else {"_id": token_hash},
                {"token_hash": token_hash},
            ]
        })
        if revoked:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Token has been revoked.",
                headers={"WWW-Authenticate": "Bearer"}
            )
    except HTTPException:
        raise
    except Exception:
        pass

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

    # Find active user in MongoDB
    user = mongo_db.users.find_one({
        "$or": [{"_id": user_id}, {"id": user_id}],
        "is_active": {"$in": [1, True, "1", "true", "True"]}
    })

    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found or inactive."
        )

    # Find user's role
    role = mongo_db.roles.find_one({
        "$or": [{"_id": user["role_id"]}, {"id": user["role_id"]}],
    })

    if role is None:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User role not found."
        )

    role_id = role.get("id", role.get("_id"))

    # Find permissions assigned to role
    role_permissions = list(
        mongo_db.role_permissions.find({
            "role_id": role_id
        })
    )

    permission_ids = [
        item["permission_id"]
        for item in role_permissions
    ]

    permissions = list(
        mongo_db.permissions.find({
            "$or": [
                {"_id": {"$in": permission_ids}},
                {"id": {"$in": permission_ids}},
            ]
        })
    )

    # Build role object
    role_object = SimpleNamespace(
        id=role_id,
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
