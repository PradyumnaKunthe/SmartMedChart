"""
SmartMedChart - Comprehensive CareMatch E2E Verification Script
Tests Doctor Profile persistence, recommendation algorithms, emergency detection,
and patient registration with active encounter linking.
"""

import sys
from pathlib import Path
from types import SimpleNamespace
from datetime import datetime

# Setup paths
backend_dir = Path(__file__).resolve().parent
sys.path.insert(0, str(backend_dir))

from app.mongo_client import mongo_db
from app.routes.carematch import (
    DoctorProfileRequest,
    save_doctor_profile,
    get_carematch_doctors,
    recommend_doctors,
)
from app.routes.hospital import (
    create_hospital_patient,
    PatientRegistrationRequest,
)

def run_tests():
    print("=" * 70)
    print("SMARTMEDCHART CAREMATCH SYSTEM COMPREHENSIVE VERIFICATION")
    print("=" * 70)

    # 1. SETUP ACTORS (Admin, Receptionist, Doctors)
    admin_user = mongo_db.users.find_one({"role_id": 4, "is_active": {"$in": [1, True]}})
    if not admin_user:
        raise RuntimeError("No active admin user found.")

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

    receptionist_role = mongo_db.roles.find_one({"name": "Receptionist"})
    rec_perms = list(mongo_db.role_permissions.find({"role_id": receptionist_role["id"]}))
    rec_perm_ids = [p["permission_id"] for p in rec_perms]
    rec_permissions = list(mongo_db.permissions.find({"_id": {"$in": rec_perm_ids}}))

    current_receptionist = SimpleNamespace(
        id=999,
        username="test_receptionist",
        role=SimpleNamespace(
            id=receptionist_role["id"],
            name=receptionist_role["name"],
            permissions=[SimpleNamespace(name=p["name"]) for p in rec_permissions],
        )
    )

    print(f"[OK] Admin User: {current_admin.username}")
    print(f"[OK] Receptionist Permissions: {[p.name for p in current_receptionist.role.permissions]}")

    # Ensure at least 2 active doctors exist
    doctor_role = mongo_db.roles.find_one({"name": "Doctor"})
    doctors = list(mongo_db.users.find({"role_id": doctor_role["id"], "is_active": {"$in": [1, True]}}))
    if len(doctors) < 2:
        raise RuntimeError("At least 2 active doctors required for CareMatch testing.")

    doc_a = doctors[0]
    doc_b = doctors[1]
    doc_a_id = doc_a.get("id", doc_a.get("_id"))
    doc_b_id = doc_b.get("id", doc_b.get("_id"))

    print(f"[OK] Doctor A: {doc_a['full_name']} (ID: {doc_a_id})")
    print(f"[OK] Doctor B: {doc_b['full_name']} (ID: {doc_b_id})")

    # =========================================================================
    # PART 1: DOCTOR PROFILE TESTS
    # =========================================================================
    print("\n--- TEST GROUP 1: DOCTOR PROFILES & PERSISTENCE ---")

    # Test 1.1: Save Doctor A with Cardiology + Chest Pain
    doc_a_profile_req = DoctorProfileRequest(
        qualifications=["MBBS", "MD", "DM"],
        specializations=["Cardiology", "Cardiothoracic Surgery"],
        experience_years=12,
        expertise_keywords=["Chest Pain", "Palpitations", "High Blood Pressure", "Angina"],
        languages=["English", "Hindi", "Marathi"],
        consultation_fee=800.0,
        available_days=["Monday", "Wednesday", "Friday"],
        is_available=True,
    )

    res_a = save_doctor_profile(doc_a_id, doc_a_profile_req, current_user=current_admin)
    assert res_a["message"] == "Doctor profile saved successfully."
    print("Test 1.1 Passed: Saved Doctor A Profile (Cardiology)")

    # Test 1.2: Verify MongoDB Persistence for Doctor A
    saved_a = mongo_db.doctor_profiles.find_one({"doctor_id": doc_a_id})
    assert saved_a is not None
    assert set(saved_a["specializations"]) == {"Cardiology", "Cardiothoracic Surgery"}
    assert set(saved_a["expertise_keywords"]) == {"Chest Pain", "Palpitations", "High Blood Pressure", "Angina"}
    assert set(saved_a["languages"]) == {"English", "Hindi", "Marathi"}
    assert set(saved_a["available_days"]) == {"Monday", "Wednesday", "Friday"}
    assert saved_a["experience_years"] == 12
    assert saved_a["consultation_fee"] == 800.0
    assert saved_a["is_available"] is True
    print("Test 1.2 Passed: Doctor A profile verified in MongoDB doctor_profiles")

    # Test 1.3: Save Doctor B with Pediatrics + Child Health
    doc_b_profile_req = DoctorProfileRequest(
        qualifications=["MBBS", "MD"],
        specializations=["Pediatrics", "Neonatology"],
        experience_years=8,
        expertise_keywords=["Child Health", "Vaccination", "Growth and Development", "Fever"],
        languages=["English", "Hindi"],
        consultation_fee=600.0,
        available_days=["Tuesday", "Thursday", "Saturday"],
        is_available=True,
    )

    res_b = save_doctor_profile(doc_b_id, doc_b_profile_req, current_user=current_admin)
    assert res_b["message"] == "Doctor profile saved successfully."
    print("Test 1.3 Passed: Saved Doctor B Profile (Pediatrics)")

    # Test 1.4: Verify Profiles Remain Separate and Neither Overwrites the Other
    saved_a_check = mongo_db.doctor_profiles.find_one({"doctor_id": doc_a_id})
    saved_b_check = mongo_db.doctor_profiles.find_one({"doctor_id": doc_b_id})
    assert set(saved_a_check["specializations"]) == {"Cardiology", "Cardiothoracic Surgery"}
    assert set(saved_b_check["specializations"]) == {"Pediatrics", "Neonatology"}
    assert saved_a_check["doctor_id"] != saved_b_check["doctor_id"]
    print("Test 1.4 Passed: Doctor profiles remain strictly separate without cross-overwrite")

    # Test 1.5: Toggle Doctor A availability off then on
    toggle_req_off = DoctorProfileRequest(
        qualifications=["MBBS", "MD", "DM"],
        specializations=["Cardiology"],
        experience_years=12,
        expertise_keywords=["Chest Pain"],
        languages=["English"],
        consultation_fee=800.0,
        available_days=["Monday"],
        is_available=False,
    )
    save_doctor_profile(doc_a_id, toggle_req_off, current_user=current_admin)
    check_off = mongo_db.doctor_profiles.find_one({"doctor_id": doc_a_id})
    assert check_off["is_available"] is False
    print("Test 1.5 Passed: Availability toggle to False persisted in MongoDB")

    # Re-enable Doctor A availability
    save_doctor_profile(doc_a_id, doc_a_profile_req, current_user=current_admin)
    check_on = mongo_db.doctor_profiles.find_one({"doctor_id": doc_a_id})
    assert check_on["is_available"] is True
    print("Test 1.6 Passed: Availability toggle to True persisted in MongoDB")

    # =========================================================================
    # PART 2: RECOMMENDATION ENGINE TESTS
    # =========================================================================
    print("\n--- TEST GROUP 2: CAREMATCH RECOMMENDATION ALGORITHM ---")

    # Test 2.1: Receptionist searches "chest pain" -> Cardiology Doctor ranks above Pediatrics
    rec_chest = recommend_doctors(
        {
            "problem_category": "CARDIOLOGY",
            "chief_complaint": "Severe chest pain and palpitations",
            "preferred_language": "Hindi",
        },
        current_user=current_receptionist,
    )
    assert rec_chest["count"] >= 1
    top_doc = rec_chest["recommendations"][0]
    assert top_doc["doctor_id"] == doc_a_id
    assert "Cardiology" in top_doc["specializations"]
    assert top_doc["match_score"] > 60
    assert any("Specialist" in r for r in top_doc["match_reasons"])
    assert any("Chest Pain" in r for r in top_doc["match_reasons"])
    print(f"Test 2.1 Passed: 'Chest pain' ranked Doctor A (Cardiology) #1 with score {top_doc['match_score']}%")

    # Test 2.2: Receptionist searches child health -> Pediatrics Doctor ranks above Cardiology
    rec_child = recommend_doctors(
        {
            "problem_category": "PEDIATRICS",
            "chief_complaint": "Toddler fever, vaccination delay, and cough",
            "preferred_language": "English",
        },
        current_user=current_receptionist,
    )
    assert rec_child["count"] >= 1
    top_child_doc = rec_child["recommendations"][0]
    assert top_child_doc["doctor_id"] == doc_b_id
    assert "Pediatrics" in top_child_doc["specializations"]
    assert top_child_doc["match_score"] > 60
    assert any("Pediatrics" in r for r in top_child_doc["match_reasons"])
    print(f"Test 2.2 Passed: Child complaint ranked Doctor B (Pediatrics) #1 with score {top_child_doc['match_score']}%")

    # Test 2.3: Changing complaint updates recommendations automatically
    rec_switch = recommend_doctors(
        {
            "problem_category": "CARDIOLOGY",
            "chief_complaint": "Angina and high blood pressure",
        },
        current_user=current_receptionist,
    )
    assert rec_switch["recommendations"][0]["doctor_id"] == doc_a_id
    print("Test 2.3 Passed: Complaint switch immediately returns Cardiology specialist")

    # Test 2.4: Unavailable doctor is excluded
    mongo_db.doctor_profiles.update_one({"doctor_id": doc_a_id}, {"$set": {"is_available": False}})
    rec_unavailable = recommend_doctors(
        {
            "problem_category": "CARDIOLOGY",
            "chief_complaint": "Chest pain",
        },
        current_user=current_receptionist,
    )
    matching_ids = [r["doctor_id"] for r in rec_unavailable["recommendations"]]
    assert doc_a_id not in matching_ids
    print("Test 2.4 Passed: Doctor A with is_available=False was strictly excluded from recommendations")
    # Restore Doctor A availability
    mongo_db.doctor_profiles.update_one({"doctor_id": doc_a_id}, {"$set": {"is_available": True}})

    # Test 2.5: Doctor without configured profile is not falsely recommended
    # If a doctor has no profile in doctor_profiles, they must not appear
    unconfigured_doc = mongo_db.users.find_one({"role_id": doctor_role["id"], "_id": {"$nin": [doc_a_id, doc_b_id]}})
    if unconfigured_doc:
        unconf_id = unconfigured_doc.get("id", unconfigured_doc.get("_id"))
        mongo_db.doctor_profiles.delete_one({"doctor_id": unconf_id})
        rec_check = recommend_doctors(
            {"problem_category": "CARDIOLOGY", "chief_complaint": "Chest pain"},
            current_user=current_receptionist,
        )
        rec_ids = [r["doctor_id"] for r in rec_check["recommendations"]]
        assert unconf_id not in rec_ids
        print(f"Test 2.5 Passed: Unconfigured Doctor ID {unconf_id} was not recommended")
    else:
        print("Test 2.5 Skipped: No third doctor account present")

    # Test 2.6: No match fallback message
    rec_no_match = recommend_doctors(
        {
            "problem_category": "DENTISTRY",
            "chief_complaint": "Root canal and severe tooth cavity",
        },
        current_user=current_receptionist,
    )
    assert rec_no_match["count"] == 0
    assert "No matching specialists found" in rec_no_match["message"]
    print("Test 2.6 Passed: Unmatched specialty returns 0 recommendations with fallback guidance")

    # Test 2.7: Emergency escalation detection
    rec_emergency = recommend_doctors(
        {
            "problem_category": "CARDIOLOGY",
            "chief_complaint": "Crushing chest pain radiating to arm and difficulty breathing",
            "symptom_severity": "SEVERE",
        },
        current_user=current_receptionist,
    )
    assert rec_emergency["emergency_escalation"] is True
    assert rec_emergency["emergency_warning"] is not None
    assert "CRITICAL CLINICAL ALERT" in rec_emergency["emergency_warning"]
    print(f"Test 2.7 Passed: Emergency symptoms triggered clinical escalation warning")

    # =========================================================================
    # PART 3: END-TO-END PATIENT REGISTRATION & ENCOUNTER LINKING
    # =========================================================================
    print("\n--- TEST GROUP 3: PATIENT REGISTRATION & ENCOUNTER LINKING ---")

    # Clean previous test patient if exists
    test_mobile = "9988776655"
    mongo_db.patients.delete_many({"mobile_number": test_mobile})

    # Register patient with Doctor A confirmed
    reg_payload = PatientRegistrationRequest(
        first_name="VIKRAM",
        last_name="MALHOTRA",
        full_name="VIKRAM MALHOTRA",
        age=48,
        gender="MALE",
        mobile_number=test_mobile,
        problem_category="CARDIOLOGY",
        chief_complaint="CHEST PAIN AND SHORTNESS OF BREATH",
        symptom_duration="3 DAYS",
        symptom_severity="MODERATE",
        preferred_language="HINDI",
        doctor_id=doc_a_id,
        is_admitted=False,
    )

    reg_res = create_hospital_patient(reg_payload, current_user=current_receptionist)
    assert "patient" in reg_res
    patient_data = reg_res["patient"]
    new_patient_id = patient_data["id"]

    print(f"Test 3.1 Passed: Patient Vikram Malhotra registered with ID {new_patient_id}")

    # Check MongoDB patients collection
    db_patient = mongo_db.patients.find_one({"_id": new_patient_id})
    assert db_patient is not None
    assert db_patient["first_name"] == "VIKRAM"
    assert db_patient["last_name"] == "MALHOTRA"
    assert db_patient["is_active"] is True
    assert db_patient["qr_token"] is not None
    print(f"Test 3.2 Passed: Patient record verified in MongoDB patients (QR: {db_patient['qr_token'][:10]}...)")

    # Check MongoDB encounters collection
    db_encounter = mongo_db.encounters.find_one({"patient_id": new_patient_id})
    assert db_encounter is not None
    assert db_encounter["doctor_id"] == doc_a_id
    assert db_encounter["status"] == "ACTIVE"
    assert db_encounter["encounter_type"] == "OPD"
    assert "CHEST PAIN" in db_encounter["chief_complaint"]
    print(f"Test 3.3 Passed: Active encounter verified in MongoDB encounters with exact doctor_id={db_encounter['doctor_id']}")

    print("\n" + "=" * 70)
    print("ALL 10 MANDATORY TEST CASES PASSED SUCCESSFULLY!")
    print("=" * 70)

if __name__ == "__main__":
    run_tests()

