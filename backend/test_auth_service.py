from app.database import SessionLocal
from app.security import decode_access_token
from app.services.auth_service import (
    authenticate_user,
    create_user_access_token,
)


db = SessionLocal()

try:
    user = authenticate_user(
        db=db,
        username="login_test_nurse",
        password="TestPassword123!",
    )

    assert user is not None
    assert user.username == "login_test_nurse"

    print("Authentication successful.")
    print("User ID:", user.id)
    print("Username:", user.username)

    token = create_user_access_token(user)

    print("\nJWT created:")
    print(token)

    payload = decode_access_token(token)

    print("\nDecoded token:")
    print(payload)

    assert payload["sub"] == str(user.id)

    print("\nAuthentication service test passed successfully.")

finally:
    db.close()