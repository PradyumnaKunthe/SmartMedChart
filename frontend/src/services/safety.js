import api from "./api"


export async function checkMedicationSafety(
  scheduleId,
) {
  const response = await api.get(
    `/api/safety/medications/${scheduleId}`,
  )

  return response.data
}
