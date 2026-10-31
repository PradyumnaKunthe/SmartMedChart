from types import SimpleNamespace

from app.mongo_client import mongo_db
from app.security import create_access_token, verify_password


def authenticate_user(db=None, username="", password=""):
    user = mongo_db.users.find_one({
        "username": username,
        "is_active": {"$in": [1, True]}
    })

    if not user:
        return None

    if not verify_password(password, user["password_hash"]):
        return None

    role = mongo_db.roles.find_one({
        "id": user["role_id"]
    })

    if not role:
        return None

    role_permissions = list(
        mongo_db.role_permissions.find({
            "role_id": role["id"]
        })
    )

    permission_ids = [
        item["permission_id"] for item in role_permissions
    ]

    permissions = list(
        mongo_db.permissions.find({
            "id": {"$in": permission_ids}
        })
    )

    role_object = SimpleNamespace(
        id=role["id"],
        name=role["name"],
        permissions=[
            SimpleNamespace(name=p["name"])
            for p in permissions
        ]
    )

    user_data = {
        key: value
        for key, value in user.items()
        if key != "_id"
    }

    user_data["role"] = role_object

    return SimpleNamespace(**user_data)


def create_user_access_token(user):
    return create_access_token(
        subject=str(user.id)
    )