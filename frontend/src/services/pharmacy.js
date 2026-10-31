import api from "./api"

export async function getPharmacyStats() {
  const response = await api.get("/api/pharmacy/stats")
  return response.data
}

export async function getPharmacyMedicines(params = {}) {
  const response = await api.get("/api/pharmacy/medicines", { params })
  return response.data
}

export async function createPharmacyMedicine(data) {
  const response = await api.post("/api/pharmacy/medicines", data)
  return response.data
}

export async function updatePharmacyMedicine(medicineId, data) {
  const response = await api.put(`/api/pharmacy/medicines/${medicineId}`, data)
  return response.data
}

export async function archivePharmacyMedicine(medicineId) {
  const response = await api.delete(`/api/pharmacy/medicines/${medicineId}`)
  return response.data
}

export async function getMedicineBatches(medicineId) {
  const response = await api.get(`/api/pharmacy/medicines/${medicineId}/batches`)
  return response.data
}

export async function addMedicineBatch(medicineId, data) {
  const response = await api.post(
    `/api/pharmacy/medicines/${medicineId}/batches`,
    data
  )
  return response.data
}

export async function dispenseMedicine(data) {
  const response = await api.post("/api/pharmacy/dispense", data)
  return response.data
}

export async function getStockTransactions(params = {}) {
  const response = await api.get("/api/pharmacy/stock-transactions", { params })
  return response.data
}

export async function getUsageReports() {
  const response = await api.get("/api/pharmacy/reports/usage")
  return response.data
}

export async function getLowStockAlerts() {
  const response = await api.get("/api/pharmacy/alerts/low-stock")
  return response.data
}

export async function getExpiryAlerts() {
  const response = await api.get("/api/pharmacy/alerts/expiry")
  return response.data
}

