from fastapi import APIRouter, Depends, HTTPException, Request

from app.security import (
    get_current_user,
    require_permission,
    require_role,
    revoke_token,
)

from app.schemas.auth import LoginRequest, TokenResponse

from app.services.auth_service import (
    authenticate_user,
    create_user_access_token,
)
from app.services.rate_limiter import login_rate_limiter


router = APIRouter(
    prefix="/api/auth",
    tags=["Authentication"],
)


@router.post("/login", response_model=TokenResponse)
def login(request: LoginRequest, http_request: Request):
    client_ip = http_request.client.host if http_request.client else "unknown"
    rate_key = f"{client_ip}:{request.username.lower()}"

    if login_rate_limiter.is_rate_limited(rate_key):
        raise HTTPException(
            status_code=429,
            detail="Too many failed login attempts. Please wait 5 minutes before trying again.",
        )

    user = authenticate_user(
        username=request.username,
        password=request.password,
    )

    if user is None:
        login_rate_limiter.record_failure(rate_key)
        raise HTTPException(
            status_code=401,
            detail="Invalid username or password.",
        )

    login_rate_limiter.record_success(rate_key)
    access_token = create_user_access_token(user)

    return TokenResponse(
        access_token=access_token,
        token_type="bearer",
    )


@router.post("/logout")
def logout(
    http_request: Request,
    current_user=Depends(get_current_user),
):
    """
    Revoke current user's session token and blacklist its JTI server-side.
    """
    auth_header = http_request.headers.get("Authorization") or ""
    parts = auth_header.split()
    if len(parts) == 2 and parts[0].lower() == "bearer":
        token = parts[1]
        revoke_token(token)
    return {"message": "Logged out successfully."}


@router.get("/me")
def get_me(current_user=Depends(get_current_user)):
    return {
        "id": current_user.id,
        "username": current_user.username,
        "full_name": current_user.full_name,
        "role": current_user.role.name,
        "is_active": current_user.is_active,
    }


@router.get("/nurse-test")
def nurse_test(
    current_user=Depends(require_permission("MANAGE_SYSTEM")),
):
    return {
        "message": "Nurse test endpoint accessed with system management privileges.",
        "user_id": current_user.id,
        "username": current_user.username,
        "role": current_user.role.name,
    }


@router.get("/medication-admin-test")
def medication_admin_test(
    current_user=Depends(require_permission("MANAGE_SYSTEM")),
):
    return {
        "message": "Medication admin test endpoint accessed with system management privileges.",
        "user_id": current_user.id,
        "username": current_user.username,
        "role": current_user.role.name,
    }
