import React, { useEffect, useState } from "react"
import { useNavigate, useParams } from "react-router-dom"
import {
  AlertTriangle,
  ArrowLeft,
  BrainCircuit,
  Calendar,
  CheckCircle2,
  Clock,
  ExternalLink,
  FileText,
  Info,
  Pill,
  QrCode,
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
import { getMedicationSchedule } from "../../services/medications"

function normalizeStatus(status) {
  return String(status || "").trim().toUpperCase().replace(/_/g, " ")
}

function getStatusBadgeVariant(status) {
  switch (normalizeStatus(status)) {
    case "GIVEN":
      return "success"
    case "DELAYED":
      return "warning"
    case "HELD":
      return "neutral"
    case "REFUSED":
    case "NOT GIVEN":
      return "danger"
    default:
      return "primary"
  }
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

function formatDate(dateString) {
  if (!dateString) return "—"
  const date = new Date(`${dateString}T00:00:00`)
  if (Number.isNaN(date.getTime())) return dateString
  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(date)
}

export default function MedicationDetails() {
  const { scheduleId } = useParams()
  const navigate = useNavigate()

  const [medication, setMedication] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  useEffect(() => {
    async function loadData() {
      if (!scheduleId) return
      setLoading(true)
      setError("")
      try {
        const data = await getMedicationSchedule(scheduleId)
        setMedication(data)
      } catch (err) {
        setError(
          err?.response?.data?.detail || "Unable to retrieve medication schedule."
        )
      } finally {
        setLoading(false)
      }
    }
    loadData()
  }, [scheduleId])

  if (loading) {
    return (
      <MainLayout title="Medication Details">
        <Loading message="Loading scheduled dose details and clinical safety parameters..." />
      </MainLayout>
    )
  }

  if (error || !medication) {
    return (
      <MainLayout title="Medication Details">
        <div className="max-w-2xl mx-auto space-y-4">
          <Button variant="ghost" icon={ArrowLeft} onClick={() => navigate("/nurse/medications")}>
            Back to Medication Queue
          </Button>
          <div className="p-6 bg-rose-50 border border-rose-200 rounded-3xl text-rose-700 space-y-2">
            <h3 className="font-bold text-rose-900">Unable to load medication</h3>
            <p className="text-sm">{error || "Schedule not found."}</p>
          </div>
        </div>
      </MainLayout>
    )
  }

  const isGiven = normalizeStatus(medication.status) === "GIVEN"
  const isUpcoming = normalizeStatus(medication.status) === "UPCOMING"

  return (
    <MainLayout
      title="Scheduled Dose Details"
      subtitle={`Schedule #${scheduleId} · Review parameters before bedside administration`}
    >
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Navigation & Status Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <Button
            variant="ghost"
            icon={ArrowLeft}
            onClick={() => navigate("/nurse/medications")}
          >
            Back to Queue
          </Button>

          <div className="flex items-center gap-3">
            <Badge variant={getStatusBadgeVariant(medication.status)} size="md">
              Status: {normalizeStatus(medication.status)}
            </Badge>

            {medication.is_stat && (
              <Badge variant="warning" size="md">
                <Zap className="w-3.5 h-3.5 mr-1 fill-current" /> STAT Priority
              </Badge>
            )}
          </div>
        </div>

        {/* Clinical Summary Banner */}
        <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex items-start gap-4">
            <div className="w-14 h-14 rounded-2xl bg-sky-100 text-sky-700 flex items-center justify-center shrink-0 shadow-xs">
              <Pill className="w-7 h-7" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-bold text-slate-900">
                  {medication.medicine_name || medication.medication_name}
                </h1>
              </div>
              <p className="text-slate-600 font-medium text-sm mt-0.5">
                Dose: <strong className="text-slate-900">{medication.dosage || medication.dose}</strong> · Route:{" "}
                <strong className="text-slate-900">{medication.route || "Oral"}</strong>
              </p>
              <div className="flex items-center gap-3 text-xs text-slate-500 mt-2">
                <span className="flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5 text-slate-400" />
                  Scheduled: {formatTime(medication.scheduled_time)}
                </span>
                <span>•</span>
                <span className="flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5 text-slate-400" />
                  {formatDate(medication.scheduled_date)}
                </span>
              </div>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-2 shrink-0">
            {isUpcoming && (
              <Button
                variant="primary"
                icon={QrCode}
                onClick={() => navigate(`/nurse/scanner?schedule=${scheduleId}`)}
              >
                Scan Wristband & Administer
              </Button>
            )}

            <Button
              variant="outline"
              icon={BrainCircuit}
              onClick={() => navigate(`/nurse/ai?schedule=${scheduleId}`)}
            >
              AI Risk Analysis
            </Button>
          </div>
        </div>

        {/* Administration Status / History (if administered) */}
        {isGiven && (
          <div className="p-5 bg-emerald-50/70 border border-emerald-200 rounded-2xl flex items-start gap-3">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
            <div>
              <h4 className="text-sm font-bold text-emerald-950">
                Administration Recorded
              </h4>
              <p className="text-xs text-emerald-800 mt-0.5">
                Administered at:{" "}
                <strong>
                  {medication.actual_administration_time
                    ? new Date(medication.actual_administration_time).toLocaleString("en-IN")
                    : "Logged on record"}
                </strong>
              </p>
              {medication.notes && (
                <p className="text-xs text-emerald-900 bg-emerald-100/60 p-2.5 rounded-xl mt-2 font-medium">
                  Nurse Notes: {medication.notes}
                </p>
              )}
            </div>
          </div>
        )}

        {/* 5-Rights Safety Verification Checklist */}
        <Card>
          <CardHeader
            title="Bedside Safety Verification (Five-Rights)"
            subtitle="Verify each clinical parameter against patient wristband prior to dose release"
          />
          <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 bg-slate-50 border border-slate-200/80 rounded-2xl space-y-1">
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-500">
                <User className="w-3.5 h-3.5 text-sky-600" /> 1. Right Patient
              </div>
              <div className="text-base font-bold text-slate-900">
                {medication.patient_name || "Assigned Patient"}
              </div>
              <div className="text-xs font-mono text-slate-600">
                Patient Code: {medication.patient_code || `#${medication.patient_id}`}
              </div>
            </div>

            <div className="p-4 bg-slate-50 border border-slate-200/80 rounded-2xl space-y-1">
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-500">
                <Pill className="w-3.5 h-3.5 text-sky-600" /> 2. Right Drug
              </div>
              <div className="text-base font-bold text-slate-900">
                {medication.medicine_name || medication.medication_name}
              </div>
              <div className="text-xs text-slate-600">
                Rx Item #{medication.prescription_item_id || medication.id}
              </div>
            </div>

            <div className="p-4 bg-slate-50 border border-slate-200/80 rounded-2xl space-y-1">
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-500">
                <CheckCircle2 className="w-3.5 h-3.5 text-sky-600" /> 3. Right Dose
              </div>
              <div className="text-base font-bold text-slate-900">
                {medication.dosage || medication.dose || "Dose specified"}
              </div>
              <div className="text-xs text-slate-600">
                Standard therapeutic window
              </div>
            </div>

            <div className="p-4 bg-slate-50 border border-slate-200/80 rounded-2xl space-y-1">
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-500">
                <ShieldCheck className="w-3.5 h-3.5 text-sky-600" /> 4. Right Route
              </div>
              <div className="text-base font-bold text-slate-900">
                {medication.route || "Oral"}
              </div>
              <div className="text-xs text-slate-600">
                Follow clinical protocol for this route
              </div>
            </div>

            <div className="p-4 bg-slate-50 border border-slate-200/80 rounded-2xl space-y-1 md:col-span-2">
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-500">
                <Clock className="w-3.5 h-3.5 text-sky-600" /> 5. Right Time
              </div>
              <div className="text-base font-bold text-slate-900">
                {formatTime(medication.scheduled_time)} · {formatDate(medication.scheduled_date)}
              </div>
              <div className="text-xs text-slate-600">
                Frequency: {medication.frequency || "As Prescribed"}
              </div>
            </div>
          </div>
        </Card>

        {/* Administration Instructions */}
        {medication.instructions && (
          <div className="p-5 bg-sky-50/70 border border-sky-200 rounded-2xl space-y-2">
            <h4 className="text-xs font-bold uppercase tracking-wider text-sky-900 flex items-center gap-1.5">
              <FileText className="w-4 h-4 text-sky-600" /> Physician Administration Instructions
            </h4>
            <p className="text-sm text-sky-950 font-medium leading-relaxed">
              {medication.instructions}
            </p>
          </div>
        )}

        {/* Direct Action Footer */}
        <div className="flex items-center justify-end gap-3 pt-4">
          <Button
            variant="outline"
            onClick={() => navigate("/nurse/medications")}
          >
            Back to Queue
          </Button>

          <Button
            variant="primary"
            icon={CheckCircle2}
            onClick={() => navigate(`/nurse/medications/${scheduleId}/administration`)}
          >
            Open Administration Workflow
          </Button>
        </div>
      </div>
    </MainLayout>
  )
}