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