import React, { useCallback, useState } from "react"
import { useLocation, useNavigate, useSearchParams } from "react-router-dom"
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  ChevronRight,
  Clock,
  LoaderCircle,
  Pill,
  QrCode,
  ShieldCheck,
  User,
  XCircle,
} from "lucide-react"

import MainLayout from "../../components/layout/MainLayout"
import Card, { CardHeader } from "../../components/common/Card"
import Button from "../../components/common/Button"
import Badge from "../../components/common/Badge"
import PatientVerification from "../../components/qr/PatientVerification"
import { verifyMedication } from "../../services/qr"

export default function QRScanner() {
  const navigate = useNavigate()
  const location = useLocation()
  const [searchParams] = useSearchParams()
  const scheduleId = searchParams.get("schedule")
  const targetPatientId = searchParams.get("patient") || location.state?.patientId || null
  const targetPatientName = location.state?.patientName || null
  const targetPatientCode = location.state?.patientCode || null

  const [patientId, setPatientId] = useState(null)
  const [medicationResult, setMedicationResult] = useState(null)
  const [verifyingMedication, setVerifyingMedication] = useState(false)

  const handlePatientVerified = useCallback(
    async (verifiedPatientId) => {
      setPatientId(verifiedPatientId)
      setMedicationResult(null)

      if (targetPatientId && String(verifiedPatientId) !== String(targetPatientId)) {
        setMedicationResult({
          valid: false,
          patient_id: verifiedPatientId,
          medication_schedule_id: scheduleId ? Number(scheduleId) : null,
          message: `Scanned patient ID (${verifiedPatientId}) does not match expected patient (${targetPatientName || targetPatientId}). Verification aborted for patient safety.`,
        })
        return
      }

      if (!scheduleId) {
        setMedicationResult({
          valid: true,
          patient_id: verifiedPatientId,
          medication_schedule_id: null,
          message:
            "Patient identity verified successfully. The patient is confirmed as eligible for bedside care and rounds.",
        })
        return
      }

      setVerifyingMedication(true)
      try {
        const response = await verifyMedication(
          verifiedPatientId,
          Number(scheduleId)
        )
        setMedicationResult(response)

        // If verified by the backend, route directly to administration
        if (response.valid) {
          setTimeout(() => {
            navigate(`/nurse/medications/${scheduleId}/administration`, {
              replace: true,
            })
          }, 800)
        }
      } catch (requestError) {
        const message =
          requestError?.response?.data?.detail ||
          requestError?.message ||
          "Unable to verify that this medication is prescribed to the scanned patient."
        setMedicationResult({
          valid: false,
          patient_id: verifiedPatientId,
          medication_schedule_id: Number(scheduleId),
          message,
        })
      } finally {
        setVerifyingMedication(false)
      }
    },
    [navigate, scheduleId, targetPatientId, targetPatientName]
  )

  function goBack() {
    if (scheduleId) {
      navigate(`/nurse/medications/${scheduleId}`)
    } else {
      navigate("/nurse/dashboard")
    }
  }

  return (
    <MainLayout
      title="Bedside Patient Verification"
      subtitle="Scan patient wristband to enforce Five-Rights safety checks and prevent medication errors"
    >
      <div className="mx-auto max-w-4xl space-y-6">
        {/* Navigation */}
        <div className="flex items-center justify-between">
          <Button variant="ghost" icon={ArrowLeft} onClick={goBack}>
            {scheduleId ? "Back to Medication Details" : "Back to Medication Queue"}
          </Button>

          {scheduleId && (
            <Badge variant="primary" size="md">
              Verifying Dose Schedule #{scheduleId}
            </Badge>
          )}
        </div>

        {/* 3-Step Verification Stepper */}
        <div className="bg-white border border-slate-200/90 rounded-2xl p-4 shadow-sm">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {/* Step 1 */}
            <div
              className={`p-3 rounded-xl border flex items-center gap-3 ${
                !patientId
                  ? "border-sky-500 bg-sky-50 text-sky-950 font-bold"
                  : "border-emerald-200 bg-emerald-50 text-emerald-900"
              }`}
            >
              <div
                className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold ${
                  patientId
                    ? "bg-emerald-600 text-white"
                    : "bg-sky-600 text-white"
                }`}
              >
                {patientId ? <CheckCircle2 className="w-4 h-4" /> : "1"}
              </div>
              <div className="min-w-0">
                <div className="text-xs font-bold">1. Wristband QR Scan</div>
                <div className="text-[11px] text-slate-500 truncate">
                  {patientId ? "Identity confirmed" : "Position camera"}
                </div>
              </div>
            </div>

            {/* Step 2 */}
            <div
              className={`p-3 rounded-xl border flex items-center gap-3 ${
                patientId && !medicationResult?.valid
                  ? "border-sky-500 bg-sky-50 text-sky-950 font-bold"
                  : medicationResult?.valid
                  ? "border-emerald-200 bg-emerald-50 text-emerald-900"
                  : "border-slate-200 bg-slate-50 text-slate-500"
              }`}
            >
              <div
                className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold ${
                  medicationResult?.valid
                    ? "bg-emerald-600 text-white"
                    : patientId
                    ? "bg-sky-600 text-white"
                    : "bg-slate-200 text-slate-600"
                }`}
              >
                {medicationResult?.valid ? <CheckCircle2 className="w-4 h-4" /> : "2"}
              </div>
              <div className="min-w-0">
                <div className="text-xs font-bold">2. Rx Cross-Match</div>
                <div className="text-[11px] text-slate-500 truncate">
                  {medicationResult?.valid
                    ? "Order matched"
                    : "Validating dose"}
                </div>
              </div>
            </div>

            {/* Step 3 */}
            <div
              className={`p-3 rounded-xl border flex items-center gap-3 ${
                medicationResult?.valid
                  ? "border-sky-500 bg-sky-50 text-sky-950 font-bold"
                  : "border-slate-200 bg-slate-50 text-slate-500"
              }`}
            >
              <div
                className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold ${
                  medicationResult?.valid
                    ? "bg-sky-600 text-white"
                    : "bg-slate-200 text-slate-600"
                }`}
              >
                3
              </div>
              <div className="min-w-0">
                <div className="text-xs font-bold">3. Administer Dose</div>
                <div className="text-[11px] text-slate-500 truncate">
                  {medicationResult?.valid ? "Ready to record" : "Awaiting match"}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Target Patient Context */}
        {targetPatientId && (
          <div className="p-4 bg-sky-50/70 border border-sky-200 rounded-2xl flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-sky-600 text-white flex items-center justify-center shadow-xs">
                <User className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-slate-900">
                  Target Inpatient: {targetPatientName || `Patient #${targetPatientId}`}
                  {targetPatientCode ? ` (${targetPatientCode})` : ""}
                </h4>
                <p className="text-xs text-slate-600">
                  Scan patient wristband to complete bedside identification and verify shift assignment.
                </p>
              </div>
            </div>
            <Badge variant="primary" size="sm">
              Shift Assignment
            </Badge>
          </div>
        )}

        {/* Selected Dose Context (if scheduleId exists) */}
        {scheduleId && (
          <div className="p-4 bg-sky-50/70 border border-sky-200 rounded-2xl flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-sky-600 text-white flex items-center justify-center shadow-xs">
                <Pill className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-slate-900">
                  Target Scheduled Dose #{scheduleId}
                </h4>
                <p className="text-xs text-slate-600">
                  Scanning must confirm patient identity before medication can be released.
                </p>
              </div>
            </div>
            <Badge variant="primary" size="sm">
              Required Match
            </Badge>
          </div>
        )}

        {/* Medication Verification Loading State */}
        {verifyingMedication && (
          <div className="p-8 bg-white border border-slate-200 rounded-3xl text-center space-y-3">
            <LoaderCircle className="w-10 h-10 animate-spin text-sky-600 mx-auto" />
            <h3 className="text-base font-bold text-slate-900">
              Cross-Verifying Medication Order...
            </h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              Checking pharmacy prescription item against scanned patient identity records...
            </p>
          </div>
        )}

        {/* Mismatch / Error State */}
        {medicationResult && !medicationResult.valid && (
          <div className="p-6 bg-rose-50 border border-rose-300 rounded-3xl space-y-3 shadow-xs">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-rose-100 text-rose-700 flex items-center justify-center shrink-0">
                <XCircle className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <h3 className="text-base font-bold text-rose-950">
                  CRITICAL: Verification Safety Alert
                </h3>
                <p className="text-xs text-rose-800 leading-relaxed font-medium">
                  {medicationResult.message ||
                    "This medication is NOT prescribed to the scanned patient. DO NOT administer."}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 pt-2 border-t border-rose-200">
              <Button
                variant="danger"
                size="sm"
                onClick={() => {
                  setPatientId(null)
                  setMedicationResult(null)
                }}
              >
                Scan Again
              </Button>
              <Button variant="outline" size="sm" onClick={goBack}>
                Return to Queue
              </Button>
            </div>
          </div>
        )}

        {/* Match Success State (if no auto-redirect or general scan) */}
        {medicationResult && medicationResult.valid && !scheduleId && (
          <div className="p-6 bg-emerald-50 border border-emerald-200 rounded-3xl space-y-3 shadow-xs">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-emerald-950">
                  Patient Identity Confirmed
                </h3>
                <p className="text-xs text-emerald-800 mt-1">
                  Patient ID:{" "}
                  <strong className="font-mono text-emerald-900">
                    {medicationResult.patient_id}
                  </strong>
                </p>
                <p className="text-xs text-slate-600 mt-1">
                  {medicationResult.message}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 pt-2 border-t border-emerald-200">
              <Button
                variant="primary"
                size="sm"
                onClick={() => navigate("/nurse/dashboard")}
              >
                Return to Nurse Station
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigate("/nurse/medications")}
              >
                View Medication Queue
              </Button>
            </div>
          </div>
        )}

        {/* Patient QR Scanner Component */}
        {!patientId && (
          <Card>
            <CardHeader
              title="Bedside Optical QR Scanner"
              subtitle="Center the patient wristband barcode or QR token within the reticle frame"
            />
            <div className="p-6">
              <PatientVerification onVerified={handlePatientVerified} />
            </div>
          </Card>
        )}
      </div>
    </MainLayout>
  )
}