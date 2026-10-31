with open("backend/app/routes/carematch.py", "r", encoding="utf-8") as f:
    code = f.read()

old_carematch_patient = '''    if patient is None:
        raise HTTPException(
            status_code=404,
            detail="Patient not found.",
        )'''

new_carematch_patient = '''    if patient is None:
        raise HTTPException(
            status_code=404,
            detail="Patient not found.",
        )

    if not (patient.get("is_active") in (True, 1)) or patient.get("lifecycle_status") == "DISCHARGED":
        raise HTTPException(
            status_code=400,
            detail="Cannot book an appointment for a discharged or inactive patient.",
        )'''

assert old_carematch_patient in code, "old_carematch_patient not found in carematch.py"
code = code.replace(old_carematch_patient, new_carematch_patient, 1)

with open("backend/app/routes/carematch.py", "w", encoding="utf-8") as f:
    f.write(code)
print("carematch.py patched successfully")

