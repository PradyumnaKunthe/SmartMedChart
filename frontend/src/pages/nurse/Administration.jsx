import React, { useEffect, useState } from "react"
import { useNavigate, useParams } from "react-router-dom"
import {
  AlertTriangle,
  ArrowLeft,
  BrainCircuit,
  Calendar,
  CheckCircle2,
  Clock,
  Pill,
  ShieldAlert,
  ShieldCheck,
  User,
  Zap,
} from "lucide-react"

import MainLayout from "../../components/layout/MainLayout"
import Card, { CardHeader } from "../../components/common/Card"
import Button from "../../components/common/Button"
import Badge from "../../components/common/Badge"
import Loading from "../../components/common/Loading"
import AdministrationActions from "../../components/nurse/AdministrationActions"
import { getMedicationSchedule } from "../../services/medications"
import { predictMedicationRisk } from "../../services/ai"
import { checkMedicationSafety } from "../../services/safety"

function normalizeStatus(status) {
  return String(status || "").trim().toUpperCase().replace(/_/g, " ")
}

function formatApiError(err, fallback = "Unable to prepare medication administration.") {
  const detail = err?.response?.data?.detail
  if (typeof detail === "string") return detail
  if (Array.isArray(detail)) {
    return detail.map((e) => (typeof e === "string" ? e : e?.msg || JSON.stringify(e))).join("; ")
  }
  if (detail && typeof detail === "object") {
    return detail.message || JSON.stringify(detail)
  }
  return err?.message || fallback
}

function formatTime(timeString) {
  if (!timeString) return "—"
  const [hour, minute] = String(timeString).slice(0, 5).split(":").map(Number)
  if (Number.isNaN(hour) || Number.isNaN(minute)) return timeString
  const date = new Date()
  date.setHours(hour, minute, 0, 0)
  return new Intl.DateTimeFormat("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(date)
}

export default function Administration() {
  const { scheduleId } = useParams()
  const navigate = useNavigate()

  const [medication, setMedication] = useState(null)
  const [prediction, setPrediction] = useState(null)
  const [safety, setSafety] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState(null)

  useEffect(() => {
    async function loadData() {
      if (!scheduleId) return
      setLoading(true)
      setError("")

      try {
        const medData = await getMedicationSchedule(scheduleId)
        setMedication(medData)

        // Fetch AI risk & safety in parallel with graceful fallbacks
        try {
          const [aiRes, safetyRes] = await Promise.all([
            predictMedicationRisk(scheduleId).catch(() => null),
            checkMedicationSafety(scheduleId).catch(() => null),
          ])
          if (aiRes?.prediction) setPrediction(aiRes.prediction)
          if (safetyRes) setSafety(safetyRes)
        } catch {
          // AI and safety are advisory; do not block administration if unavailable
        }
      } catch (err) {
        setError(formatApiError(err, "Unable to prepare medication administration."))
      } finally {
        setLoading(false)
      }
    }

    loadData()
  }, [scheduleId])

  if (loading) {
    return (
      <MainLayout title="Bedside Administration">
        <Loading message="Validating patient EMR and safety protocols..." />
      </MainLayout>
    )
  }

  if (error || !medication) {
    return (
      <MainLayout title="Bedside Administration">
        <div className="max-w-2xl mx-auto space-y-4">
          <Button variant="ghost" icon={ArrowLeft} onClick={() => navigate("/nurse/medications")}>
            Back to Queue
          </Button>
          <div className="p-6 bg-rose-50 border border-rose-200 rounded-3xl text-rose-700 space-y-2">
            <h3 className="font-bold text-rose-900">Unable to load medication</h3>
            <p className="text-sm font-medium">{error || "Medication record not found in system."}</p>
          </div>
        </div>
      </MainLayout>
    )
  }

  return (
    <MainLayout
      title="Bedside Administration"
      subtitle={`Dose #${scheduleId} · Verify patient wristband & confirm administration`}
    >
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Navigation */}
        <div className="flex items-center justify-between">
          <Button
            variant="ghost"
            icon={ArrowLeft}
            onClick={() => navigate(`/nurse/medications/${scheduleId}`)}
          >
            Back to Schedule Details
          </Button>

          <Badge variant="primary" size="md">
            Schedule #{scheduleId}
          </Badge>
        </div>

        {/* Success State */}
        {success ? (
          <div className="p-8 bg-gradient-to-br from-emerald-50 to-teal-50 border border-emerald-200 rounded-3xl text-center space-y-4 shadow-sm">
            <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-2xl flex items-center justify-center mx-auto shadow-sm">
              <CheckCircle2 className="w-10 h-10" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-slate-900">
                Administration Successfully Logged
              </h2>
              <p className="text-sm text-slate-600 mt-1.5 max-w-md mx-auto">
                Status has been recorded as{" "}
                <strong
                  className={`font-bold uppercase ${
                    success.status === "GIVEN_ON_TIME"
                      ? "text-emerald-700"
                      : success.status === "GIVEN_LATE"
                      ? "text-amber-700"
                      : success.status === "GIVEN_EARLY"
                      ? "text-sky-700"
                      : "text-slate-800"
                  }`}
                >
                  {normalizeStatus(success.status) || "COMPLETED"}
                </strong>
                . Patient EMR and shift nursing log have been updated in real-time.
              </p>
              {success.actual_administration_time && (
                <div className="mt-3 p-3 bg-white/70 border border-emerald-200/60 rounded-xl inline-block text-xs text-slate-700 space-y-1">
                  <div>
                    <strong>Administration Time:</strong>{" "}
                    {new Date(success.actual_administration_time).toLocaleTimeString("en-IN", {
                      timeZone: "Asia/Kolkata",
                      hour: "2-digit",
                      minute: "2-digit",
                      second: "2-digit",
                    })}{" "}
                    IST
                    {typeof success.delay_minutes === "number" && success.delay_minutes > 0
                      ? ` (${Math.round(success.delay_minutes)}m delay)`
                      : ""}
                  </div>
                  {(success.administered_by_name || success.nurse_name) && (
                    <div>
                      <strong>Administering Nurse:</strong>{" "}
                      {success.administered_by_name || success.nurse_name}
                    </div>
                  )}
                </div>
              )}
            </div>
            <div className="flex items-center justify-center gap-3 pt-3">
              <Button
                variant="primary"
                onClick={() => navigate("/nurse/medications")}
                className="px-6 py-2.5"
              >
                Return to Medication Queue
              </Button>
              <Button
                variant="outline"
                onClick={() => navigate("/nurse/dashboard")}
              >
                Go to Nurse Dashboard
              </Button>
            </div>
          </div>
        ) : (
          <>
            {/* Medication & Patient Profile Summary Card */}
            <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm space-y-4">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 pb-4">
                <div className="flex items-center gap-3.5">
                  <div className="w-12 h-12 rounded-2xl bg-sky-100 text-sky-700 flex items-center justify-center shadow-xs">
                    <User className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-slate-900">
                      {medication.patient_name || "Inpatient"}
                    </h3>
                    <p className="text-xs text-slate-500 font-mono">
                      Patient Code: {medication.patient_code || `#${medication.patient_id}`}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <div className="px-3.5 py-1.5 bg-slate-100 rounded-xl text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-slate-500" />
                    Scheduled: {formatTime(medication.scheduled_time)}
                  </div>
                  {medication.is_stat && (
                    <Badge variant="warning" size="sm">
                      <Zap className="w-3 h-3 mr-1 fill-current" /> STAT
                    </Badge>
                  )}
                </div>
              </div>

              {/* Medicine Highlight */}
              <div className="p-4 bg-sky-50/60 border border-sky-200/80 rounded-2xl flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-sky-600 text-white flex items-center justify-center shadow-xs">
                    <Pill className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-base font-bold text-slate-900">
                      {medication.medicine_name || medication.medication_name}
                    </h4>
                    <p className="text-xs text-slate-600">
                      Dose: <strong className="text-slate-900">{medication.dosage || medication.dose}</strong> · Route:{" "}
                      <strong className="text-slate-900">{medication.route || "Oral"}</strong>
                    </p>
                  </div>
                </div>
                <div className="text-right text-xs text-slate-500 hidden sm:block">
                  <div>Frequency: <span className="font-semibold text-slate-800">{medication.frequency || "Daily"}</span></div>
                </div>
              </div>

              {/* Instructions */}
              {medication.instructions && (
                <div className="p-3 bg-amber-50/70 border border-amber-200 rounded-xl text-xs text-amber-900 font-medium">
                  <strong>Special Instructions:</strong> {medication.instructions}
                </div>
              )}
            </div>

            {/* AI Risk & Safety Advisory (if available) */}
            {prediction && (
              <div className="p-4 bg-gradient-to-r from-indigo-50 to-sky-50 border border-indigo-200 rounded-2xl flex items-start gap-3">
                <BrainCircuit className="w-5 h-5 text-indigo-600 shrink-0 mt-0.5" />
                <div className="text-xs space-y-1">
                  <div className="font-bold text-indigo-950 flex items-center gap-2">
                    <span>AI Clinical Risk Intelligence</span>
                    <Badge
                      variant={
                        prediction.risk_level === "HIGH"
                          ? "danger"
                          : prediction.risk_level === "MEDIUM"
                          ? "warning"
                          : "success"
                      }
                      size="sm"
                    >
                      {prediction.risk_level || "LOW"} RISK
                    </Badge>
                  </div>
                  <p className="text-indigo-900/80">
                    Calculated Delay Probability:{" "}
                    <strong>
                      {Math.round((prediction.delay_probability || 0) * 100)}%
                    </strong>
                    . {prediction.recommendations || "Proceed with standard bedside verification protocol."}
                  </p>
                </div>
              </div>
            )}

            {/* Administration Outcome Form */}
            <Card>
              <CardHeader
                title="Record Clinical Outcome"
                subtitle="Select the bedside administration status and enter optional shift observations"
              />
              <div className="p-6">
                <AdministrationActions
                  scheduleId={scheduleId}
                  isAssigned={medication.is_assigned ?? true}
                  assignedNurseName={medication.assigned_nurse_name ?? ""}
                  onSuccess={(res) => setSuccess(res)}
                  onError={(err) => setError(err)}
                />
              </div>
            </Card>
          </>
        )}
      </div>
    </MainLayout>
  )
}