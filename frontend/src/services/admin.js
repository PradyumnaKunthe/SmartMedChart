import api from "./api"


// =========================================================
// STAFF
// =========================================================

export async function getAdminStaff() {
  const response = await api.get(
    "/api/admin/staff",
  )

  return response.data
}


export async function getAdminNurses() {
  const response = await api.get(
    "/api/admin/nurses",
  )

  return response.data
}


export async function getAdminDoctors() {
  const response = await api.get(
    "/api/admin/doctors",
  )

  return response.data
}


export async function createStaff(data) {
  const response = await api.post(
    "/api/admin/staff",
    data,
  )

  return response.data
}


// =========================================================
// PATIENTS
// =========================================================

export async function getAdminPatients() {
  const response = await api.get(
    "/api/admin/patients",
  )

  return response.data
}


// =========================================================
// ASSIGNMENTS
// =========================================================

export async function getAdminAssignments() {
  const response = await api.get(
    "/api/admin/assignments",
  )

  return response.data
}


export async function assignPatientToNurse(
  nurseId,
  patientId,
) {
  const response = await api.post(
    "/api/admin/assignments",
    {
      nurse_id: Number(nurseId),
      patient_id: Number(patientId),
    },
  )

  return response.data
}


export async function removePatientAssignment(
  assignmentId,
) {
  const response = await api.delete(
    `/api/admin/assignments/${assignmentId}`,
  )

  return response.data
}