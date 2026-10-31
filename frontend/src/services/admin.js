import api from "./api"


// =========================================================
// STAFF MANAGEMENT
// =========================================================

export async function getAdminStaff() {
  const response = await api.get("/api/admin/staff")
  return response.data
}


export async function getAdminNurses() {
  const response = await api.get("/api/admin/nurses")
  return response.data
}


export async function getAdminDoctors() {
  const response = await api.get("/api/admin/doctors")
  return response.data
}


export async function createAdminStaff(payload) {
  const response = await api.post(
    "/api/admin/staff",
    payload,
  )

  return response.data
}


// Compatibility aliases
export const getStaff = getAdminStaff
export const getNurses = getAdminNurses
export const getDoctors = getAdminDoctors
export const createStaff = createAdminStaff


// =========================================================
// PATIENT MANAGEMENT
// =========================================================

export async function getAdminPatients(params = {}) {
  const response = await api.get(
    "/api/admin/patients",
    {
      params,
    },
  )

  return response.data
}


// =========================================================
// NURSE-PATIENT ASSIGNMENTS
// =========================================================

export async function getAdminAssignments(params = {}) {
  const response = await api.get(
    "/api/admin/assignments",
    {
      params,
    },
  )

  return response.data
}


export async function createAdminAssignment(
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
export const assignPatientToNurse =
  createAdminAssignment


export async function deleteAdminAssignment(
  assignmentId,
) {
  const response = await api.delete(
    `/api/admin/assignments/${assignmentId}`,
  )

  return response.data
}
export const removePatientAssignment =
  deleteAdminAssignment

// Compatibility aliases
export const getAssignments = getAdminAssignments
export const createAssignment = createAdminAssignment
export const deleteAssignment = deleteAdminAssignment


// =========================================================
// PATIENT LIFECYCLE
// =========================================================

export async function getPatientLifecycle() {
  const response = await api.get(
    "/api/admin/patients/lifecycle",
  )

  return response.data
}


export async function createPatientBilling(
  patientId,
  payload,
) {
  const response = await api.post(
    `/api/admin/patients/${patientId}/billing`,
    payload,
  )

  return response.data
}
export const updatePatientBill =
  createPatientBilling


export async function markPatientBillingPaid(
  patientId,
  payload = {},
) {
  const response = await api.post(
    `/api/admin/patients/${patientId}/billing/paid`,
    payload,
  )

  return response.data
}
export const markPatientBillPaid =
  markPatientBillingPaid


export async function dischargePatient(
  patientId,
  payload = {},
) {
  const body =
    typeof payload === "string"
      ? { discharge_reason: payload }
      : payload || {}
  const response = await api.post(
    `/api/admin/patients/${patientId}/discharge`,
    body,
  )

  return response.data
}


export async function getPatientHistory(
  patientId,
) {
  const response = await api.get(
    `/api/admin/patients/${patientId}/history`,
  )

  return response.data
}


// Compatibility aliases
export const getAdminPatientLifecycle =
  getPatientLifecycle

export const billPatient =
  createPatientBilling

export const markBillingPaid =
  markPatientBillingPaid

export const dischargeAdminPatient =
  dischargePatient

export const getAdminPatientHistory =
  getPatientHistory


// =========================================================
// WARD MANAGEMENT
// =========================================================


export async function getWards() {
  const response = await api.get(
    "/api/admin/wards",
  )

  return response.data
}


export async function getRegistrationWards() {
  const response = await api.get("/api/hospital/wards")
  return response.data
}

export async function getRegistrationWardBeds(wardId) {
  const response = await api.get(
    `/api/hospital/wards/${wardId}/beds`
  )
  return response.data
}



export async function createWard(
  name,
  code,
  description = "",
) {
  const response = await api.post(
    "/api/admin/wards",
    {
      name,
      code,
      description,
    },
  )

  return response.data
}


// =========================================================
// BED MANAGEMENT
// =========================================================


export async function getWardBeds(wardId) {
  const response = await api.get(
    `/api/admin/wards/${wardId}/beds`,
  )

  return response.data
}



export async function createBed(
  wardId,
  bedNumber,
) {
  const response = await api.post(
    `/api/admin/wards/${wardId}/beds`,
    {
      bed_number: bedNumber,
    },
  )

  return response.data
}


export async function deactivateBed(
  wardId,
  bedId,
) {
  const response = await api.delete(
    `/api/admin/wards/${wardId}/beds/${bedId}`,
  )

  return response.data
}


// =========================================================
// PATIENT BED ASSIGNMENT
// =========================================================

export async function assignPatientBed(
  patientId,
  wardId,
  bedId,
) {
  const response = await api.post(
    `/api/admin/patients/${patientId}/assign-bed`,
    {
      ward_id: Number(wardId),
      bed_id: Number(bedId),
    },
  )

  return response.data
}


export async function releasePatientBed(
  patientId,
) {
  const response = await api.post(
    `/api/admin/patients/${patientId}/release-bed`,
  )

  return response.data
}


// Compatibility aliases
export const assignBed = assignPatientBed
export const releaseBed = releasePatientBed


// =========================================================
// PATIENT QR
// =========================================================

export async function generatePatientQR(
  patientId,
) {
  const response = await api.post(
    `/api/qr/patients/${patientId}/generate`,
  )

  return response.data
}


// Compatibility aliases
export const generatePatientQr =
  generatePatientQR


// =========================================================
// HOSPITAL DOCTORS
// =========================================================
// Doctors shown in Add Patient are loaded from
// active registered Doctor accounts.

export async function getHospitalDoctors() {
  const response = await api.get(
    "/api/hospital/doctors",
  )

  return response.data
}


// =========================================================
// MONITORING
// =========================================================

export async function getMonitoringSchedules(
  params = {},
) {
  const response = await api.get(
    "/api/dashboard/monitoring/schedules",
    {
      params,
    },
  )

  return response.data
}


export async function getMonitoringAdministrations(
  params = {},
) {
  const response = await api.get(
    "/api/dashboard/monitoring/administrations",
    {
      params,
    },
  )

  return response.data
}


// =========================================================
// DEFAULT EXPORT
// =========================================================

const adminService = {
  getAdminStaff,
  getAdminNurses,
  getAdminDoctors,
  createAdminStaff,

  getAdminPatients,

  getAdminAssignments,
  createAdminAssignment,
  deleteAdminAssignment,

  getPatientLifecycle,
  createPatientBilling,
  markPatientBillingPaid,
  dischargePatient,
  getPatientHistory,

  getWards,
  createWard,

  getWardBeds,
  createBed,
  deactivateBed,

  assignPatientBed,
  releasePatientBed,

  generatePatientQR,

  getHospitalDoctors,

  getMonitoringSchedules,
  getMonitoringAdministrations,
}

export default adminService
export async function getNurseWorkload() {
  const response = await api.get(
    "/api/admin/workload/nurses",
  )

  return response.data
}


export async function getDoctorWorkload() {
  const response = await api.get(
    "/api/admin/workload/doctors",
  )

  return response.data
}
// =========================================================
// DOCTOR-PATIENT ASSIGNMENTS
// =========================================================

export async function getDoctorAssignments() {
  const response = await api.get(
    "/api/admin/doctor-assignments",
  )

  return response.data
}


export async function assignPatientToDoctor(
  doctorId,
  patientId,
) {
  const response = await api.post(
    "/api/admin/doctor-assignments",
    {
      doctor_id: Number(doctorId),
      patient_id: Number(patientId),
    },
  )

  return response.data
}


export async function removePatientFromDoctor(
  encounterId,
) {
  const response = await api.delete(
    `/api/admin/doctor-assignments/${encounterId}`,
  )

  return response.data
}
// =====================================================
// CAREMATCH — DOCTOR PROFILES
// =====================================================

export const getCareMatchDoctors = async () => {
  const response = await api.get("/api/carematch/admin/doctors");
  return response.data;
};

export const saveCareMatchDoctorProfile = async (doctorId, payload) => {
  const response = await api.put(
    `/api/carematch/admin/doctors/${doctorId}/profile`,
    payload
  );

  return response.data;
};
// Add CareMatch functions to the default service object
adminService.getCareMatchDoctors = getCareMatchDoctors;
adminService.saveCareMatchDoctorProfile = saveCareMatchDoctorProfile;

export async function readmitPatient(patientId, data = {}) {
  const response = await api.post(`/api/admin/patients/${patientId}/readmit`, data)
  return response.data
}
