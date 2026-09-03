from sqlalchemy import select

from app.database import SessionLocal
from app.models import Role, User
from app.security import hash_password


db = SessionLocal()

try:
    role = db.scalar(
        select(Role).where(Role.name == "Nurse")
    )

    if role is None:
        raise RuntimeError("Nurse role was not found.")

    username = "login_test_nurse"
    email = "login_test_nurse@example.com"
    password = "TestPassword123!"

    existing_user = db.scalar(
        select(User).where(User.username == username)
    )

    if existing_user is not None:
        print("Test nurse already exists.")
        print("User ID:", existing_user.id)
    else:
        user = User(
            username=username,
            email=email,
            password_hash=hash_password(password),
            full_name="Login Test Nurse",
            role_id=role.id,
            is_active=True,
        )

        db.add(user)
        db.commit()
        db.refresh(user)

        print("Test nurse created successfully.")
        print("User ID:", user.id)
        print("Username:", username)
        print("Password:", password)

finally:
    db.close()