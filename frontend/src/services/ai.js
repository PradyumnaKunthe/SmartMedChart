import api from "./api"


export async function predictMedicationRisk(
  scheduleId,
) {
  const response = await api.post(
    `/api/ai/schedules/${scheduleId}/predict`,
  )

  return response.data
}


export async function getAIPredictions() {
  const response = await api.get(
    "/api/ai/predictions",
  )

  return response.data
}


export async function getHighRiskPredictions() {
  const response = await api.get(
    "/api/ai/predictions/high-risk",
  )

  return response.data
}