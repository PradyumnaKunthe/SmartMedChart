import api from "./api"

/**
 * Load active doctors available for hospital patient intake.
 */
export async function getHospitalDoctors() {
  const response = await api.get("/api/hospital/doctors")
  return response.data
}

/**
 * Register a patient and create the initial encounter, billing record,
 * and patient QR token through the backend workflow.
 */
export async function createHospitalPatient(payload) {
  const response = await api.post("/api/hospital/patients", payload)
  return response.data
}
