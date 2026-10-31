with open("frontend/src/pages/doctor/CreatePrescription.jsx", "r", encoding="utf-8") as f:
    code = f.read()

# 1. Fix Temporal Dead Zone in CreatePrescription.jsx
old_tdz_block = '''  const freqMultiplier =
    form.frequency === "EVERY_6_HOURS"
      ? 4
      : form.frequency === "EVERY_8_HOURS"
      ? 3
      : form.frequency === "TWICE_DAILY"
      ? 2
      : 1
  const estimatedDoses = Math.max(1, Number(form.duration_days || 1)) * freqMultiplier

  const [form, setForm] = useState({
    medicine_id: "",
    dose: "",
    route: "Oral",
    frequency: "ONCE_DAILY",
    duration_days: 7,
    start_date: new Date().toISOString().split("T")[0],
    start_time: "08:00",
    is_stat: false,
    instructions: "",
    notes: "",
  })'''

new_tdz_block = '''  const [form, setForm] = useState({
    medicine_id: "",
    dose: "",
    route: "Oral",
    frequency: "ONCE_DAILY",
    duration_days: 7,
    start_date: new Date().toISOString().split("T")[0],
    start_time: "08:00",
    is_stat: false,
    instructions: "",
    notes: "",
  })

  const freqMultiplier =
    form.frequency === "EVERY_6_HOURS"
      ? 4
      : form.frequency === "EVERY_8_HOURS"
      ? 3
      : form.frequency === "TWICE_DAILY"
      ? 2
      : 1
  const estimatedDoses = Math.max(1, Number(form.duration_days || 1)) * freqMultiplier'''

assert old_tdz_block in code, "old_tdz_block not found in CreatePrescription.jsx"
code = code.replace(old_tdz_block, new_tdz_block, 1)

# Ensure back button uses selectedPatientId || patientId
old_back_btn = '''            onClick={() =>
              navigate(patientId ? `/doctor/patients/${patientId}` : "/doctor/patients")
            }'''

new_back_btn = '''            onClick={() => {
              const backPid = selectedPatientId || patientId || patient?.id
              navigate(backPid ? `/doctor/patients/${backPid}` : "/doctor/patients")
            }}'''

if old_back_btn in code:
    code = code.replace(old_back_btn, new_back_btn, 1)

with open("frontend/src/pages/doctor/CreatePrescription.jsx", "w", encoding="utf-8") as f:
    f.write(code)
print("CreatePrescription.jsx TDZ fixed successfully")

# 2. Update PatientProfile.jsx handleCreatePrescription
with open("frontend/src/pages/doctor/PatientProfile.jsx", "r", encoding="utf-8") as f:
    p_code = f.read()

old_handle_create = '''  function handleCreatePrescription() {
    navigate(`/doctor/prescriptions/create?patient=${patient?.id || patientId}`)
  }'''

new_handle_create = '''  function handleCreatePrescription() {
    if (patient && (!patient.is_active || patient.lifecycle_status === "DISCHARGED")) {
      alert("Cannot create prescription for a discharged patient.")
      return
    }
    const targetId = patient?.id || patientId
    navigate(`/doctor/prescriptions/create?patient=${targetId}`)
  }'''

assert old_handle_create in p_code, "old_handle_create not found in PatientProfile.jsx"
p_code = p_code.replace(old_handle_create, new_handle_create, 1)

with open("frontend/src/pages/doctor/PatientProfile.jsx", "w", encoding="utf-8") as f:
    f.write(p_code)
print("PatientProfile.jsx handleCreatePrescription updated successfully")

