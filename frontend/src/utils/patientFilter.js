// =====================================================
// SMARTMEDCHART PATIENT DISPLAY FILTER
// =====================================================
//
// IMPORTANT:
// This filter ONLY controls what is displayed.
//
// It does NOT delete anything from the database.
//
// We intentionally hide only the old test patients
// that were identified during development.
//
// Do NOT use the generic patient name because several
// records can have the same name.
//
// Do NOT use object.id because:
//   Patient.id      = patient database ID
//   Schedule.id     = medication schedule ID
// =====================================================


// -----------------------------------------------------
// Known old test/demo patient codes
// -----------------------------------------------------

const HIDDEN_PATIENT_CODES = [
  "TEST-ADMIN-001",
  "DUPLICATE-TEST-001",
  "DUPLICATE-TEST-25CCDE81",
  "TEST-SCHED-001",
  "STATUS-TEST-001",
]


// -----------------------------------------------------
// Known test-code patterns
// -----------------------------------------------------

const HIDDEN_PATIENT_ID_PATTERNS = [
  "TEST-",
  "DUPLICATE-",
  "STATUS-",
]


// -----------------------------------------------------
// Normalize text
// -----------------------------------------------------

function normalize(value) {
  return String(value ?? "")
    .trim()
    .toUpperCase()
}


// -----------------------------------------------------
// Get explicit patient code
// -----------------------------------------------------

function getPatientCode(patient) {
  if (!patient) {
    return ""
  }

  return normalize(
    patient.patient_code ??
    patient.patient_id ??
    patient.patient_code_id ??
    ""
  )
}


// -----------------------------------------------------
// Check whether record is an old test patient
// -----------------------------------------------------

export function isTestPatient(patient) {
  if (!patient) {
    return false
  }

  const patientCode =
    getPatientCode(patient)


  // ---------------------------------------------------
  // Exact matches
  // ---------------------------------------------------

  if (
    HIDDEN_PATIENT_CODES.includes(
      patientCode
    )
  ) {
    return true
  }


  // ---------------------------------------------------
  // TEST / DUPLICATE / STATUS patterns
  // ---------------------------------------------------

  const matchesPattern =
    HIDDEN_PATIENT_ID_PATTERNS.some(
      (pattern) =>
        patientCode.startsWith(pattern)
    )


  if (matchesPattern) {
    return true
  }


  return false
}


// -----------------------------------------------------
// Remove hidden patients
// -----------------------------------------------------

export function hideTestPatients(
  patients = []
) {
  if (!Array.isArray(patients)) {
    return []
  }

  return patients.filter(
    (patient) =>
      !isTestPatient(patient)
  )
}