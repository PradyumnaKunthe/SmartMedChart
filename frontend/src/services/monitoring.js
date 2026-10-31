import api from "./api"

export async function getMonitoringDashboard(params = {}) {
  const response = await api.get("/api/monitoring/dashboard", { params })
  return response.data
}

export async function getComplianceReports(params = {}) {
  const response = await api.get("/api/monitoring/reports", { params })
  return response.data
}

export async function getMonitoringAlerts(params = {}) {
  const response = await api.get("/api/monitoring/alerts", { params })
  return response.data
}

export async function acknowledgeAlert(alertId, data = {}) {
  const response = await api.post(`/api/monitoring/alerts/${alertId}/acknowledge`, data)
  return response.data
}

export async function getHospitalPolicy() {
  const response = await api.get("/api/monitoring/policy")
  return response.data
}

export async function updateHospitalPolicy(policy) {
  const response = await api.put("/api/monitoring/policy", policy)
  return response.data
}
