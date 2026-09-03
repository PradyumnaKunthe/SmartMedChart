from sqlalchemy import select

from app.database import SessionLocal
from app.models import Permission, Role, RolePermission


db = SessionLocal()

try:
    roles = db.scalars(select(Role).order_by(Role.id)).all()
    permissions = db.scalars(select(Permission).order_by(Permission.id)).all()

    print("\nROLES")
    for role in roles:
        print(f"{role.id}: {role.name}")

    print("\nPERMISSIONS")
    for permission in permissions:
        print(f"{permission.id}: {permission.name}")

    print("\nROLE PERMISSIONS")
    mappings = db.scalars(select(RolePermission)).all()

    for mapping in mappings:
        role = db.get(Role, mapping.role_id)
        permission = db.get(Permission, mapping.permission_id)

        print(f"{role.name} -> {permission.name}")

finally:
    db.close()