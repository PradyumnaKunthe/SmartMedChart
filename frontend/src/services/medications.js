import api from "./api"


export async function getNurseMedications(params = {}) {
  const response = await api.get(
    "/api/nurse/medications",
    { params },
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

export async function holdMedication(
  scheduleId,
  data,
) {
  const response = await api.post(
    `/api/nurse/medications/${scheduleId}/hold`,
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

// 5-minute pre-dose nurse notifications
export async function getNurseNotifications(params = {}) {
  const response = await api.get("/api/nurse/notifications", { params })
  return response.data
}

export async function acknowledgeNurseNotification(notificationId) {
  const response = await api.post(`/api/nurse/notifications/${notificationId}/acknowledge`)
  return response.data
}

export async function readNurseNotification(notificationId) {
  const response = await api.post(`/api/nurse/notifications/${notificationId}/read`)
  return response.data
}

export async function getNurseNotificationsHistory(limit = 100) {
  const response = await api.get(`/api/nurse/notifications/history?limit=${limit}`)
  return response.data
}
