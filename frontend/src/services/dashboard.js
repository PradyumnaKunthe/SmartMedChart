import api from "./api"


// =====================================================
// MEDICATION SUMMARY
// =====================================================

export async function getMedicationSummary() {
  const response = await api.get(
    "/api/dashboard/medication-summary",
  )

  return response.data
}


// =====================================================
// SCHEDULE MONITORING
// =====================================================

export async function getMonitoringSchedules({
  status = "",
  limit = 100,
} = {}) {
  const params = {
    limit,
  }

  if (status) {
    params.status = status
  }

  const response = await api.get(
    "/api/dashboard/monitoring/schedules",
    {
      params,
    },
  )

  return response.data
}


// =====================================================
// AI MONITORING
// =====================================================

export async function getAIMonitoring(
  limit = 100,
) {
  const response = await api.get(
    "/api/dashboard/monitoring/ai",
    {
      params: {
        limit,
      },
    },
  )

  return response.data
}


// =====================================================
// ADMINISTRATION MONITORING
// =====================================================

export async function getAdministrationMonitoring(
  limit = 100,
) {
  const response = await api.get(
    "/api/dashboard/monitoring/administrations",
    {
      params: {
        limit,
      },
    },
  )

  return response.data
}


// =====================================================
// SAFETY MONITORING
// =====================================================

export async function getSafetyMonitoring(
  limit = 100,
) {
  const response = await api.get(
    "/api/dashboard/monitoring/safety",
    {
      params: {
        limit,
      },
    },
  )

  return response.data
}