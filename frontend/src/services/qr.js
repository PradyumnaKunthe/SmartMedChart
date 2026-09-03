import api from "./api"


export async function verifyPatientQR(qrToken) {
  const response = await api.post(
    "/api/nurse/qr/verify",
    {
      qr_token: qrToken,
    },
  )

  return response.data
}


export async function verifyMedication(
  patientId,
  medicationScheduleId,
) {
  const response = await api.post(
    "/api/nurse/qr/verify-medication",
    {
      patient_id: patientId,
      medication_schedule_id:
        medicationScheduleId,
    },
  )

  return response.data
}