from sqlalchemy import select

from app.database import SessionLocal
from app.models import Permission, Role, RolePermission


ROLES = [
    {
        "name": "Doctor",
        "description": "Can prescribe and manage patient medications.",
    },
    {
        "name": "Nurse",
        "description": "Can view medication tasks and record medication administration.",
    },
    {
        "name": "Pharmacist",
        "description": "Can perform relevant medicine and pharmacy activities.",
    },
    {
        "name": "Administrator",
        "description": "Can manage users, permissions, reports, and system settings.",
    },
]


PERMISSIONS = [
    ("VIEW_PATIENT", "View patient information"),
    ("CREATE_PRESCRIPTION", "Create a medication prescription"),
    ("EDIT_PRESCRIPTION", "Modify an existing prescription"),
    ("STOP_PRESCRIPTION", "Stop an active prescription"),
    ("VIEW_MEDICATION_HISTORY", "View medication administration history"),
    ("VIEW_MEDICATION_SCHEDULE", "View medication schedules"),
    ("VERIFY_QR", "Verify a patient using QR"),
    ("ADMINISTER_MEDICATION", "Record medication administration"),
    ("VIEW_PRESCRIPTION", "View prescriptions"),
    ("MANAGE_MEDICINE", "Manage medicine information"),
    ("MANAGE_INVENTORY", "Manage medicine inventory"),
    ("MANAGE_USERS", "Create and manage users"),
    ("MANAGE_ROLES", "Manage user roles"),
    ("MANAGE_PERMISSIONS", "Manage permissions"),
    ("VIEW_REPORTS", "View hospital reports"),
    ("VIEW_AUDIT_LOG", "View audit logs"),
    ("MANAGE_SYSTEM", "Manage system settings"),
]


ROLE_PERMISSIONS = {
    "Doctor": [
        "VIEW_PATIENT",
        "CREATE_PRESCRIPTION",
        "EDIT_PRESCRIPTION",
        "STOP_PRESCRIPTION",
        "VIEW_MEDICATION_HISTORY",
    ],
    "Nurse": [
        "VIEW_PATIENT",
        "VIEW_MEDICATION_SCHEDULE",
        "VERIFY_QR",
        "ADMINISTER_MEDICATION",
        "VIEW_MEDICATION_HISTORY",
    ],
    "Pharmacist": [
        "VIEW_PATIENT",
        "VIEW_PRESCRIPTION",
        "MANAGE_MEDICINE",
        "MANAGE_INVENTORY",
    ],
    "Administrator": [
        "VIEW_PATIENT",
        "MANAGE_USERS",
        "MANAGE_ROLES",
        "MANAGE_PERMISSIONS",
        "VIEW_REPORTS",
        "VIEW_AUDIT_LOG",
        "MANAGE_SYSTEM",
    ],
}


def seed_database() -> None:
    db = SessionLocal()

    try:
        permission_objects = {}

        # Create permissions if they don't already exist.
        for name, description in PERMISSIONS:
            permission = db.scalar(
                select(Permission).where(Permission.name == name)
            )

            if permission is None:
                permission = Permission(
                    name=name,
                    description=description,
                )
                db.add(permission)

            permission_objects[name] = permission

        db.flush()

        # Create roles and connect permissions.
        for role_data in ROLES:
            role = db.scalar(
                select(Role).where(Role.name == role_data["name"])
            )

            if role is None:
                role = Role(
                    name=role_data["name"],
                    description=role_data["description"],
                )
                db.add(role)
                db.flush()

            for permission_name in ROLE_PERMISSIONS[role.name]:
                permission = permission_objects[permission_name]

                already_exists = db.scalar(
                    select(RolePermission).where(
                        RolePermission.role_id == role.id,
                        RolePermission.permission_id == permission.id,
                    )
                )

                if already_exists is None:
                    db.add(
                        RolePermission(
                            role_id=role.id,
                            permission_id=permission.id,
                        )
                    )

        db.commit()

        print("Database seeding completed successfully.")

    except Exception:
        db.rollback()
        raise

    finally:
        db.close()


if __name__ == "__main__":
    seed_database()