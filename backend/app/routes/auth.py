from fastapi import APIRouter, Depends, HTTPException

from app.security import (
    get_current_user,
    require_permission,
    require_role,
)

from app.schemas.auth import LoginRequest, TokenResponse

from app.services.auth_service import (
    authenticate_user,
    create_user_access_token,
)


router = APIRouter(
    prefix="/api/auth",
    tags=["Authentication"],
)


@router.post("/login", response_model=TokenResponse)
def login(request: LoginRequest):

    user = authenticate_user(
        username=request.username,
        password=request.password,
    )

    if user is None:
        raise HTTPException(
            status_code=401,
            detail="Invalid username or password.",
        )

    access_token = create_user_access_token(user)

    return TokenResponse(
        access_token=access_token,
        token_type="bearer",
    )


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
    current_user=Depends(require_role("Nurse")),
):
    return {
        "message": "Nurse role access granted.",
        "user_id": current_user.id,
        "username": current_user.username,
        "role": current_user.role.name,
    }


@router.get("/medication-admin-test")
def medication_admin_test(
    current_user=Depends(
        require_permission("ADMINISTER_MEDICATION")
    ),
):
    return {
        "message": "Medication administration permission granted.",
        "user_id": current_user.id,
        "username": current_user.username,
        "role": current_user.role.name,
    }