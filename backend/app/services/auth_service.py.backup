from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import User
from app.security import create_access_token, verify_password


def authenticate_user(
    db: Session,
    username: str,
    password: str,
) -> User | None:
    """
    Find a user and verify the supplied password.
    Returns the user if authentication succeeds.
    """

    user = db.scalar(
        select(User).where(
            User.username == username,
            User.is_active.is_(True),
        )
    )

    if user is None:
        return None

    if not verify_password(
        password,
        user.password_hash,
    ):
        return None

    return user


def create_user_access_token(user: User) -> str:
    """
    Create a JWT containing the authenticated user's ID.
    """

    return create_access_token(
        subject=str(user.id),
    )