# 1. Patch PatientProfile.jsx
with open("frontend/src/pages/doctor/PatientProfile.jsx", "r", encoding="utf-8") as f:
    code = f.read()

old_btn = '''            <Button
              variant="primary"
              size="sm"
              icon={Plus}
              onClick={handleCreatePrescription}
            >
              Write Prescription
            </Button>'''

new_btn = '''            <Button
              variant="primary"
              size="sm"
              icon={Plus}
              onClick={handleCreatePrescription}
            >
              Write New Prescription
            </Button>'''

assert old_btn in code, "old_btn not found in PatientProfile.jsx"
code = code.replace(old_btn, new_btn, 1)

with open("frontend/src/pages/doctor/PatientProfile.jsx", "w", encoding="utf-8") as f:
    f.write(code)
print("PatientProfile.jsx patched successfully")

# 2. Patch CreatePrescription.jsx
with open("frontend/src/pages/doctor/CreatePrescription.jsx", "r", encoding="utf-8") as f:
    c_code = f.read()

# Add formatApiError
old_top = '''const SEVERITIES = [
  { value: "LOW", label: "Low", variant: "neutral" },
  { value: "MODERATE", label: "Moderate", variant: "warning" },
  { value: "HIGH", label: "High", variant: "danger" },
  { value: "SEVERE", label: "Severe / Anaphylactic", variant: "danger" },
]'''

new_top = '''const SEVERITIES = [
  { value: "LOW", label: "Low", variant: "neutral" },
  { value: "MODERATE", label: "Moderate", variant: "warning" },
  { value: "HIGH", label: "High", variant: "danger" },
  { value: "SEVERE", label: "Severe / Anaphylactic", variant: "danger" },
]

function formatApiError(err, fallbackMessage) {
  const detail = err?.response?.data?.detail
  if (typeof detail === "string") return detail
  if (Array.isArray(detail)) {
    return detail
      .map((d) => d?.msg || d?.message || (typeof d === "object" ? JSON.stringify(d) : String(d)))
      .join("; ")
  }
  if (detail && typeof detail === "object") {
    return detail?.message || detail?.msg || JSON.stringify(detail)
  }
  return err?.message || fallbackMessage
}'''

assert old_top in c_code, "old_top not found in CreatePrescription.jsx"
c_code = c_code.replace(old_top, new_top, 1)

# loadData error
old_ld_err = '''      } catch (requestError) {
        setError(
          requestError?.response?.data?.detail || "Unable to load prescription data."
        )
      }'''

new_ld_err = '''      } catch (requestError) {
        setError(
          formatApiError(requestError, "Unable to load prescription data.")
        )
      }'''

assert old_ld_err in c_code, "old_ld_err not found"
c_code = c_code.replace(old_ld_err, new_ld_err, 1)

# handleSelectPatientChange error
old_sel_err = '''    } catch (err) {
      setError(err?.response?.data?.detail || "Unable to load selected patient.")
    }'''

new_sel_err = '''    } catch (err) {
      setError(formatApiError(err, "Unable to load selected patient."))
    }'''

assert old_sel_err in c_code, "old_sel_err not found"
c_code = c_code.replace(old_sel_err, new_sel_err, 1)

# handleSubmit
old_sub = '''    try {
      const payload = {
        patient_id: Number(targetPatientId),
        medicine_id: Number(form.medicine_id),
        dose: form.dose.trim(),
        route: form.route.trim(),
        frequency: form.frequency,
        duration_days: Number(form.duration_days),
        start_date: form.start_date,
        start_time: form.start_time,
        is_stat: Boolean(form.is_stat),
        instructions: form.instructions.trim() || null,
        notes: form.notes.trim() || null,
        admit_patient: admitNeeded === "YES",
        ward_id: admitNeeded === "YES" && selectedWard ? Number(selectedWard) : null,
        bed_id: admitNeeded === "YES" && selectedBed ? Number(selectedBed) : null,
      }

      const result = await createPrescription(payload)
      setSuccess(result)
    } catch (requestError) {
      setError(
        requestError?.response?.data?.detail || "Unable to create prescription."
      )
    } finally {
      setSubmitting(false)
    }'''

new_sub = '''    if (!form.medicine_id) {
      setError("Please select a medicine from the active pharmacy catalogue.")
      setSubmitting(false)
      return
    }

    if (!form.dose || !form.dose.trim()) {
      setError("Dosage is required (e.g., 500 mg).")
      setSubmitting(false)
      return
    }

    try {
      const payload = {
        patient_id: Number(targetPatientId),
        medicine_id: Number(form.medicine_id),
        dose: form.dose.trim(),
        route: form.route.trim(),
        frequency: form.frequency,
        duration_days: Number(form.duration_days),
        start_date: form.start_date,
        start_time: form.start_time,
        is_stat: Boolean(form.is_stat),
        instructions: form.instructions.trim() || null,
        notes: form.notes.trim() || null,
        admit_patient: admitNeeded === "YES",
        ward_id: admitNeeded === "YES" && selectedWard ? Number(selectedWard) : null,
        bed_id: admitNeeded === "YES" && selectedBed ? Number(selectedBed) : null,
      }

      const result = await createPrescription(payload)
      setSuccess(result)
    } catch (requestError) {
      setError(
        formatApiError(requestError, "Unable to create prescription.")
      )
    } finally {
      setSubmitting(false)
    }'''

assert old_sub in c_code, "old_sub not found"
c_code = c_code.replace(old_sub, new_sub, 1)

# Return to Patient Chart button in success card
old_ret_btn = '''              <Button
                variant="primary"
                onClick={() => navigate(`/doctor/patients/${patientId}`)}
              >
                Return to Patient Chart
              </Button>'''

new_ret_btn = '''              <Button
                variant="primary"
                onClick={() => {
                  const targetPid = selectedPatientId || patientId || patient?.id
                  navigate(targetPid ? `/doctor/patients/${targetPid}` : "/doctor/patients")
                }}
              >
                Return to Patient Chart
              </Button>'''

assert old_ret_btn in c_code, "old_ret_btn not found"
c_code = c_code.replace(old_ret_btn, new_ret_btn, 1)

with open("frontend/src/pages/doctor/CreatePrescription.jsx", "w", encoding="utf-8") as f:
    f.write(c_code)
print("CreatePrescription.jsx patched successfully")

