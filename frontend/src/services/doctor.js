import api from "./api"


// ======================================================
// PATIENTS
// ======================================================

export async function getDoctorPatients(
  search = "",
) {
  const params = {}

  if (search.trim()) {
    params.search = search.trim()
  }

  const response = await api.get(
    "/api/doctor/patients",
    {
      params,
    },
  )

  return response.data
}


export async function getDoctorPatient(
  patientId,
) {
  const response = await api.get(
    `/api/doctor/patients/${patientId}`,
  )

  return response.data
}


// ======================================================
// PATIENT ALLERGIES
// ======================================================

export async function getPatientAllergies(
  patientId,
) {
  const response = await api.get(
    `/api/doctor/patients/${patientId}/allergies`,
  )

  return response.data
}


// ======================================================
// CURRENT MEDICATIONS
// ======================================================

export async function getCurrentMedications(
  patientId,
) {
  const response = await api.get(
    `/api/doctor/patients/${patientId}/medications`,
  )

  return response.data
}


// ======================================================
// PRESCRIPTION HISTORY
// ======================================================

export async function getPrescriptionHistory(
  patientId,
) {
  const response = await api.get(
    `/api/doctor/patients/${patientId}/prescriptions`,
  )

  return response.data
}


// ======================================================
// MEDICINE CATALOGUE
// ======================================================

export async function getDoctorMedicines() {
  const response = await api.get(
    "/api/doctor/medicines",
  )

  return response.data
}


// ======================================================
// CREATE PRESCRIPTION
// ======================================================

export async function createPrescription(
  data,
) {
  const response = await api.post(
    "/api/doctor/prescriptions",
    data,
  )

  return response.data
}


// ======================================================
// UPDATE PRESCRIPTION
// ======================================================

export async function updatePrescription(
  prescriptionId,
  data,
) {
  const response = await api.put(
    `/api/doctor/prescriptions/${prescriptionId}`,
    data,
  )

  return response.data
}


// ======================================================
// STOP PRESCRIPTION
// ======================================================

export async function stopPrescription(
  prescriptionId,
) {
  const response = await api.post(
    `/api/doctor/prescriptions/${prescriptionId}/stop`,
  )

  return response.data
}
export async function getPatientMedicationSchedules(
  patientId,
) {
  const response = await api.get(
    `/api/doctor/patients/${patientId}/medication-schedules`,
  )

  return response.data
}
export async function createPatientAllergy(
  patientId,
  data,
) {
  const response = await api.post(
    `/api/doctor/patients/${patientId}/allergies`,
    data,
  )

  return response.data
}


export async function updatePatientAllergy(
  patientId,
  allergyId,
  data,
) {
  const response = await api.put(
    `/api/doctor/patients/${patientId}/allergies/${allergyId}`,
    data,
  )

  return response.data
}


export async function deletePatientAllergy(
  patientId,
  allergyId,
) {
  const response = await api.delete(
    `/api/doctor/patients/${patientId}/allergies/${allergyId}`,
  )

  return response.data
}

// ======================================================
// DOCTOR ON-ROUND SYSTEM
// ======================================================

export async function verifyDoctorRoundQR(qrToken) {
  const response = await api.post("/api/doctor/rounds/verify-qr", {
    qr_token: qrToken,
  })
  return response.data
}

export async function getDoctorRoundPatients() {
  const response = await api.get("/api/doctor/rounds/patients")
  return response.data
}

export async function saveDoctorRoundAssessment(data) {
  const response = await api.post("/api/doctor/rounds/assessments", data)
  return response.data
}

export async function getDoctorPatientAssessments(patientId) {
  const response = await api.get(`/api/doctor/patients/${patientId}/assessments`)
  return response.data
}

// ======================================================
// HOSPITAL WARDS & BEDS FOR INPATIENT ADMISSION
// ======================================================

export async function getDoctorWards() {
  const response = await api.get("/api/doctor/wards")
  return response.data
}

export async function getDoctorWardBeds(wardId, patientId = null) {
  const params = {}
  if (patientId) {
    params.patient_id = patientId
  }
  const response = await api.get(`/api/doctor/wards/${wardId}/beds`, { params })
  return response.data
}
