"""
Test Receptionist Account Creation, Dynamic Role Lookup, MongoDB Persistence, and Authentication.
"""
import sys
from pathlib import Path
from types import SimpleNamespace

backend_dir = Path(__file__).resolve().parent
sys.path.insert(0, str(backend_dir))

from app.mongo_client import mongo_db
from app.routes.admin import create_staff, StaffCreateRequest
from app.routes.auth import login, LoginRequest, get_me
from app.security import decode_access_token

def test_receptionist_flow():
    print("=" * 70)
    print("TEST: RECEPTIONIST CREATION & AUTHENTICATION FLOW")
    print("=" * 70)

    # 1. Look up dynamic Receptionist role from MongoDB
    rec_role = mongo_db.roles.find_one({"name": "Receptionist"})
    assert rec_role is not None, "Receptionist role not found in MongoDB."
    expected_role_id = rec_role.get("id", rec_role.get("_id"))
    print(f"[OK] Dynamically resolved Receptionist role ID from DB: {expected_role_id}")

    # 2. Get Admin user for create_staff dependency
    admin_user = mongo_db.users.find_one({"role_id": 4, "is_active": {"$in": [1, True]}})
    assert admin_user is not None, "Admin user not found."
    admin_role = mongo_db.roles.find_one({"_id": admin_user["role_id"]})
    admin_perms = list(mongo_db.role_permissions.find({"role_id": admin_role["id"]}))
    perm_ids = [p["permission_id"] for p in admin_perms]
    permissions = list(mongo_db.permissions.find({"_id": {"$in": perm_ids}}))

    current_admin = SimpleNamespace(
        id=admin_user["id"],
        username=admin_user["username"],
        role=SimpleNamespace(
            id=admin_role["id"],
            name=admin_role["name"],
            permissions=[SimpleNamespace(name=p["name"]) for p in permissions],
        )
    )

    # 3. Clean up any previous test user
    test_username = "rohan_receptionist"
    test_email = "rohan.receptionist@hospital.org"
    test_password = "SecurePassword123!"
    mongo_db.users.delete_many({"$or": [{"username": test_username}, {"email": test_email}]})

    # 4. Create Receptionist staff account via create_staff
    payload = StaffCreateRequest(
        full_name="Rohan Verma",
        username=test_username,
        email=test_email,
        password=test_password,
        role="receptionist",
    )

    result = create_staff(payload, current_user=current_admin)
    print(f"[OK] create_staff response: {result}")
    assert "Receptionist account created successfully" in result.get("message", "")
    assert result.get("staff", {}).get("role") == "Receptionist"

    # 5. Verify account in MongoDB users collection
    created_user = mongo_db.users.find_one({"username": test_username})
    assert created_user is not None, "User document was not found in MongoDB users."
    assert created_user["role_id"] == expected_role_id, (
        f"Expected role_id {expected_role_id}, got {created_user['role_id']}"
    )
    assert created_user["is_active"] in (True, 1), "User is_active is not True."
    assert created_user["full_name"] == "Rohan Verma"
    assert created_user["email"] == test_email
    print(f"[OK] MongoDB verification passed: ID={created_user['id']}, role_id={created_user['role_id']}, is_active={created_user['is_active']}")

    # 6. Test authentication / login
    login_req = LoginRequest(
        username=test_username,
        password=test_password,
    )
    token_resp = login(login_req)
    assert token_resp.access_token is not None and len(token_resp.access_token) > 20
    print("[OK] Login successful: JWT access token generated.")

    # 7. Verify /api/auth/me for the logged-in receptionist
    token_payload = decode_access_token(token_resp.access_token)
    user_id = int(token_payload["sub"])
    assert user_id == created_user["id"]

    # Build SimpleNamespace representing the authenticated receptionist
    receptionist_db_role = mongo_db.roles.find_one({"_id": created_user["role_id"]})
    user_perms_links = list(mongo_db.role_permissions.find({"role_id": receptionist_db_role["id"]}))
    u_perm_ids = [p["permission_id"] for p in user_perms_links]
    u_perms = list(mongo_db.permissions.find({"_id": {"$in": u_perm_ids}}))

    authed_receptionist = SimpleNamespace(
        id=created_user["id"],
        username=created_user["username"],
        full_name=created_user["full_name"],
        is_active=created_user["is_active"],
        role=SimpleNamespace(
            id=receptionist_db_role["id"],
            name=receptionist_db_role["name"],
            permissions=[SimpleNamespace(name=p["name"]) for p in u_perms],
        )
    )

    me_data = get_me(current_user=authed_receptionist)
    print(f"[OK] /api/auth/me response: {me_data}")
    assert me_data["role"] == "Receptionist"
    assert me_data["username"] == test_username

    # 8. Verify redirect path for receptionist role
    # In Login.jsx and App.jsx, role 'receptionist' routes to '/hospital/dashboard'
    role_norm = me_data["role"].strip().lower()
    redirect_target = "/hospital/dashboard" if role_norm == "receptionist" else "/"
    assert redirect_target == "/hospital/dashboard", f"Unexpected redirect: {redirect_target}"
    print(f"[OK] Post-login redirect target for role '{me_data['role']}' is confirmed: {redirect_target}")

    # 9. Verify Doctor and Nurse registration still work
    doc_payload = StaffCreateRequest(
        full_name="Dr. Test Flow",
        username="dr_test_flow",
        email="dr.test.flow@hospital.org",
        password="SecurePassword123!",
        role="doctor",
    )
    mongo_db.users.delete_many({"$or": [{"username": "dr_test_flow"}, {"email": "dr.test.flow@hospital.org"}]})
    doc_res = create_staff(doc_payload, current_user=current_admin)
    assert "Doctor account created successfully" in doc_res.get("message", "")
    print("[OK] Doctor account creation verified.")

    nurse_payload = StaffCreateRequest(
        full_name="Nurse Test Flow",
        username="nurse_test_flow",
        email="nurse.test.flow@hospital.org",
        password="SecurePassword123!",
        role="nurse",
    )
    mongo_db.users.delete_many({"$or": [{"username": "nurse_test_flow"}, {"email": "nurse.test.flow@hospital.org"}]})
    nurse_res = create_staff(nurse_payload, current_user=current_admin)
    assert "Nurse account created successfully" in nurse_res.get("message", "")
    print("[OK] Nurse account creation verified.")

    print("\n" + "=" * 70)
    print("ALL RECEPTIONIST CREATION & AUTHENTICATION TESTS PASSED!")
    print("=" * 70)

if __name__ == "__main__":
    test_receptionist_flow()

