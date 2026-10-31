import api from "./api"


export async function getNurseMedications() {
  const response = await api.get(
    "/api/nurse/medications",
  )

  return response.data
}


export async function getMedicationSchedule(
  scheduleId,
) {
  const response = await api.get(
    `/api/nurse/medications/${scheduleId}`,
  )

  return response.data
}


export async function administerMedication(
  scheduleId,
  data,
) {
  const response = await api.post(
    `/api/nurse/medications/${scheduleId}/administer`,
    data,
  )

  return response.data
}

export async function getNurseMedicationHistory(limit = 50) {
  const response = await api.get(`/api/nurse/history?limit=${limit}`)
  return response.data
}

export async function getNursePatients() {
  const response = await api.get("/api/nurse/patients")
  return response.data
}

export async function getNursePatientDetail(patientId) {
  const response = await api.get(`/api/nurse/patients/${patientId}`)
  return response.data
}
