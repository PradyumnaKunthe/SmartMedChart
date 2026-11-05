import React, { useEffect, useMemo, useState } from "react"
import { useNavigate } from "react-router-dom"
import {
  Activity,
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  Calendar,
  CheckCircle2,
  Clock,
  Eye,
  FileText,
  HeartPulse,
  Info,
  LoaderCircle,
  Pill,
  QrCode,
  RefreshCw,
  RotateCcw,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  User,
  XCircle,
  Zap,
} from "lucide-react"

import Card, { CardHeader } from "../common/Card"
import Button from "../common/Button"
import Badge from "../common/Badge"
import Loading from "../common/Loading"
import EmptyState from "../common/EmptyState"
import { getNurseMedications, getNursePatientDetail } from "../../services/medications"

// ==============================================================================
// DATE & TIME HELPERS
// ==============================================================================

export function parseScheduleDate(datePart, timePart) {
  if (!datePart) return null
  const dStr = String(datePart).split("T")[0].trim()
  let tStr = "08:00:00"
  if (timePart) {
    const cleanTime = String(timePart).split(".")[0].trim()
    const parts = cleanTime.split(":")
    const hh = parts[0]?.padStart(2, "0") || "08"
    const mm = parts[1]?.padStart(2, "0") || "00"
    const ss = parts[2]?.padStart(2, "0") || "00"
    tStr = `${hh}:${mm}:${ss}`
  }
  const [y, m, d] = dStr.split("-").map(Number)
  const [hh, mm, ss] = tStr.split(":").map(Number)
  if (Number.isNaN(y) || Number.isNaN(m) || Number.isNaN(d)) return null
  return new Date(y, m - 1, d, hh, mm, ss)
}

export function formatTime(timeString) {
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

export function formatDate(dateString) {
  if (!dateString) return "—"
  const date = new Date(`${dateString}T00:00:00`)
  if (Number.isNaN(date.getTime())) return dateString
  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
  }).format(date)
}

export function formatDurationDetailed(totalSeconds) {
  const absSec = Math.max(0, Math.floor(Math.abs(totalSeconds)))
  const hours = Math.floor(absSec / 3600)
  const minutes = Math.floor((absSec % 3600) / 60)
  const seconds = absSec % 60

  if (hours > 0) {
    return `${hours.toString().padStart(2, "0")}h ${minutes.toString().padStart(2, "0")}m ${seconds.toString().padStart(2, "0")}s`
  }
  if (minutes > 0) {
    return `${minutes}m ${seconds.toString().padStart(2, "0")}s`
  }
  return `${seconds}s`
}

export function formatDurationWords(totalSeconds) {
  const absSec = Math.max(0, Math.floor(Math.abs(totalSeconds)))
  const hours = Math.floor(absSec / 3600)
  const minutes = Math.floor((absSec % 3600) / 60)

  if (hours > 0) {
    return `${hours} hour${hours > 1 ? "s" : ""} ${minutes} minute${minutes !== 1 ? "s" : ""}`
  }
  return `${minutes} minute${minutes !== 1 ? "s" : ""}`
}

// ==============================================================================
// CLINICAL MONITORING STATUS EVALUATOR
// ==============================================================================

export function evaluateScheduleMonitoring(schedule, now = new Date()) {
  const rawStatus = String(schedule?.status || "").toUpperCase().trim()

  // 1. Non-administration clinical outcomes
  if (["HELD", "REFUSED", "NOT_GIVEN"].includes(rawStatus)) {
    return {
      status: rawStatus,
      label: rawStatus === "HELD" ? "MEDICATION HELD" : rawStatus === "REFUSED" ? "PATIENT REFUSED" : "NOT GIVEN",
      badgeVariant: "neutral",
      isActionable: false,
      isGiven: false,
      countdownPrimary: rawStatus === "HELD" ? "Held by Doctor Order" : "Dose Not Administered",
      countdownSecondary: schedule.notes || "Clinical recorded status",
      colorScheme: "slate",
    }
  }

  // 2. Administered medications
  if (["GIVEN", "GIVEN_ON_TIME", "GIVEN_LATE"].includes(rawStatus) || schedule?.actual_administration_time) {
    const isLate = rawStatus === "GIVEN_LATE"
    return {
      status: rawStatus || "GIVEN",
      label: isLate ? "GIVEN LATE" : "GIVEN ON TIME",
      badgeVariant: "success",
      isActionable: false,
      isGiven: true,
      countdownPrimary: "Administered",
      countdownSecondary: schedule.actual_administration_time
        ? `Recorded at ${schedule.actual_administration_time.slice(11, 16) || schedule.actual_administration_time}`
        : "Administration confirmed",
      colorScheme: "emerald",
    }
  }

  // 3. Unadministered schedules against live hospital policy (30m pre-dose / 60m grace / 240m missed)
  const targetDate = parseScheduleDate(schedule?.scheduled_date, schedule?.scheduled_time)
  if (!targetDate) {
    return {
      status: "UPCOMING",
      label: "SCHEDULED",
      badgeVariant: "primary",
      isActionable: true,
      isGiven: false,
      countdownPrimary: "Date Pending",
      countdownSecondary: "Schedule timestamp pending confirmation",
      colorScheme: "sky",
    }
  }

  const diffMs = targetDate.getTime() - now.getTime()
  const diffMinutes = diffMs / 60000.0 // positive = future, negative = past
  const diffSeconds = Math.floor(diffMs / 1000)

  // UPCOMING: outside the 30-min pre-dose window
  if (diffMinutes > 30) {
    const remainingWords = formatDurationWords(diffSeconds)
    return {
      status: "UPCOMING",
      label: "UPCOMING DOSE",
      badgeVariant: "primary",
      isActionable: true,
      isGiven: false,
      countdownPrimary: `${remainingWords} remaining`,
      countdownDetailed: formatDurationDetailed(diffSeconds),
      countdownSecondary: `Scheduled for ${formatTime(schedule.scheduled_time)} · ${formatDate(schedule.scheduled_date)}`,
      colorScheme: "sky",
      targetDate,
      diffMinutes,
      diffSeconds,
    }
  }

  // DUE NOW: within administration window (-60m <= diffMinutes <= 30m)
  if (diffMinutes <= 30 && diffMinutes >= -60) {
    const inFuture = diffSeconds > 0
    return {
      status: "DUE",
      label: "DUE NOW · ADMINISTRATION WINDOW OPEN",
      badgeVariant: "warning",
      isActionable: true,
      isGiven: false,
      countdownPrimary: inFuture ? `Due in ${formatDurationDetailed(diffSeconds)}` : "Due Now",
      countdownDetailed: inFuture ? formatDurationDetailed(diffSeconds) : `${Math.abs(Math.floor(diffMinutes))}m since scheduled`,
      countdownSecondary: inFuture
        ? `Within 30-minute pre-dose window · Scheduled at ${formatTime(schedule.scheduled_time)}`
        : `Scheduled at ${formatTime(schedule.scheduled_time)} · ${Math.max(0, Math.floor(60 + diffMinutes))}m remaining in window`,
      colorScheme: "amber",
      targetDate,
      diffMinutes,
      diffSeconds,
    }
  }

  // OVERDUE: past 60-min grace window, but under 240-min cutoff
  if (diffMinutes < -60 && diffMinutes >= -240) {
    const elapsedSeconds = Math.abs(diffSeconds)
    return {
      status: "OVERDUE",
      label: "OVERDUE DOSE",
      badgeVariant: "danger",
      isActionable: true,
      isGiven: false,
      countdownPrimary: `Overdue by ${formatDurationWords(elapsedSeconds)}`,
      countdownDetailed: `+${formatDurationDetailed(elapsedSeconds)}`,
      countdownSecondary: `Scheduled time passed (${formatTime(schedule.scheduled_time)}) · Prompt bedside administration required`,
      colorScheme: "rose",
      targetDate,
      diffMinutes,
      diffSeconds,
    }
  }

  // MISSED: exceeded 240-min cutoff
  const elapsedSeconds = Math.abs(diffSeconds)
  return {
    status: "MISSED",
    label: "MISSED DOSE — CLINICAL REVIEW REQUIRED",
    badgeVariant: "danger",
    isActionable: true,
    isGiven: false,
    countdownPrimary: "Missed — requires review",
    countdownDetailed: `+${formatDurationDetailed(elapsedSeconds)}`,
    countdownSecondary: `Dose exceeded 4-hour window (${formatTime(schedule.scheduled_time)}) · Clinical review required prior to giving`,
    colorScheme: "rose",
    targetDate,
    diffMinutes,
    diffSeconds,
  }
}

// ==============================================================================
// SMART MEDICATION COUNTDOWN COMPONENT
// ==============================================================================

export default function SmartMedicationCountdown({
  patientId,
  patientInfo,
  scheduleId,
  onReset,
}) {
  const navigate = useNavigate()

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [schedules, setSchedules] = useState([])
  const [patientDetails, setPatientDetails] = useState(patientInfo || null)
  const [selectedScheduleId, setSelectedScheduleId] = useState(
    scheduleId ? Number(scheduleId) : null
  )

  // Live 1-second ticker for real-time countdown updates
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const timer = setInterval(() => {
      setNow(new Date())
    }, 1000)
    return () => clearInterval(timer)
  }, [])

  // Fetch patient medication schedules & details
  async function loadData() {
    if (!patientId) return
    setLoading(true)
    setError("")

    try {
      const [medsData, patientData] = await Promise.all([
        getNurseMedications({ patient_id: patientId }),
        !patientDetails ? getNursePatientDetail(patientId).catch(() => null) : Promise.resolve(null),
      ])

      const list = Array.isArray(medsData) ? medsData : []
      setSchedules(list)

      if (patientData) {
        setPatientDetails((prev) => ({
          ...prev,
          patient_name: patientData.patient_name || patientData.first_name,
          patient_code: patientData.patient_code || patientData.patient_id,
          ward_name: patientData.ward_name,
          bed_number: patientData.bed_number,
          primary_doctor: patientData.primary_doctor,
        }))
      }
    } catch (err) {
      setError(
        err?.response?.data?.detail ||
          err?.message ||
          "Unable to retrieve active medication schedules for this patient."
      )
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [patientId])

  // Evaluate all schedules with live timestamp
  const evaluatedSchedules = useMemo(() => {
    return schedules.map((sched) => {
      const evalResult = evaluateScheduleMonitoring(sched, now)
      return {
        ...sched,
        evaluation: evalResult,
      }
    })
  }, [schedules, now])

  // Identify the most relevant next dose
  const primarySchedule = useMemo(() => {
    if (evaluatedSchedules.length === 0) return null

    // If an explicit schedule was focused by the user or URL
    if (selectedScheduleId) {
      const found = evaluatedSchedules.find(
        (s) => Number(s.id) === Number(selectedScheduleId)
      )
      if (found) return found
    }

    // Separate unadministered from recorded
    const unadministered = evaluatedSchedules.filter(
      (s) => s.evaluation.isActionable
    )

    if (unadministered.length > 0) {
      // Priority 1: Due, Overdue, or Missed doses (earliest scheduled first)
      const urgent = unadministered.filter((s) =>
        ["DUE", "OVERDUE", "MISSED"].includes(s.evaluation.status)
      )
      if (urgent.length > 0) {
        return urgent[0]
      }

      // Priority 2: Closest upcoming future dose
      return unadministered[0]
    }

    // Fallback: Show the first schedule (even if given/completed)
    return evaluatedSchedules[0]
  }, [evaluatedSchedules, selectedScheduleId])

  // Remaining schedules list (other than the primary hero dose)
  const remainingSchedules = useMemo(() => {
    if (!primarySchedule) return []
    return evaluatedSchedules.filter((s) => Number(s.id) !== Number(primarySchedule.id))
  }, [evaluatedSchedules, primarySchedule])

  // Formatted names & IDs
  const displayName =
    patientDetails?.patient_name ||
    primarySchedule?.patient_name ||
    `Patient #${patientId}`
  const displayCode =
    patientDetails?.patient_code ||
    primarySchedule?.patient_code ||
    `PID-${patientId}`
  const displayLocation =
    patientDetails?.ward_name && patientDetails?.bed_number
      ? `${patientDetails.ward_name} · Bed ${patientDetails.bed_number}`
      : primarySchedule?.assigned_nurse_name
      ? `Assigned: ${primarySchedule.assigned_nurse_name}`
      : "Inpatient Ward"

  // Loading state
  if (loading && schedules.length === 0) {
    return (
      <Card className="border-sky-200 bg-white/90 backdrop-blur-sm shadow-md">
        <div className="p-8 text-center space-y-4">
          <LoaderCircle className="w-10 h-10 animate-spin text-sky-600 mx-auto" />
          <div>
            <h3 className="text-base font-bold text-slate-900">
              Loading Smart Medication Schedules...
            </h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1">
              Synchronizing active prescriptions and calculating real-time administration countdown...
            </p>
          </div>
        </div>
      </Card>
    )
  }

  // Error state
  if (error && schedules.length === 0) {
    return (
      <Card className="border-rose-200 bg-rose-50/60 p-6 space-y-4">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-rose-100 text-rose-700 flex items-center justify-center shrink-0">
            <XCircle className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-base font-bold text-rose-950">
              Medication Schedule Retrieval Error
            </h3>
            <p className="text-xs text-rose-800 mt-1">{error}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 pt-2 border-t border-rose-200">
          <Button size="sm" variant="primary" onClick={loadData}>
            Retry Sync
          </Button>
          {onReset && (
            <Button size="sm" variant="outline" onClick={onReset}>
              Scan Another Patient
            </Button>
          )}
        </div>
      </Card>
    )
  }

  // Empty state: No schedules for this patient
  if (schedules.length === 0) {
    return (
      <div className="space-y-4">
        {/* Patient Identity Confirmation Header */}
        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-emerald-600 text-white flex items-center justify-center shadow-xs">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h4 className="text-sm font-bold text-slate-900">{displayName}</h4>
                <span className="font-mono text-xs font-bold text-emerald-800 bg-emerald-100/80 px-2 py-0.5 rounded">
                  {displayCode}
                </span>
              </div>
              <p className="text-xs text-emerald-800 font-medium mt-0.5">
                Wristband QR Identity Confirmed · {displayLocation}
              </p>
            </div>
          </div>
          <Badge variant="success" size="sm" dot>
            Verified Bedside
          </Badge>
        </div>

        <Card>
          <EmptyState
            icon={Pill}
            title="No Active Medication Schedules"
            description="This patient currently has no active, upcoming, or pending medication schedules in the hospital EMR system. Please check with the attending physician if a new prescription order is expected."
            actionLabel="Return to Nurse Station"
            onAction={() => navigate("/nurse/dashboard")}
          />
        </Card>
      </div>
    )
  }

  const heroEval = primarySchedule.evaluation

  // Status visual themes
  const themeStyles = {
    sky: {
      heroBg: "bg-gradient-to-br from-sky-50 via-white to-sky-100/60 border-sky-300",
      accentBadge: "bg-sky-600 text-white",
      timerText: "text-sky-950",
      digitsBorder: "border-sky-200 bg-sky-50/80 text-sky-900",
    },
    amber: {
      heroBg: "bg-gradient-to-br from-amber-50 via-white to-amber-100/70 border-amber-300 shadow-amber-500/10",
      accentBadge: "bg-amber-600 text-white animate-pulse",
      timerText: "text-amber-950",
      digitsBorder: "border-amber-200 bg-amber-50/90 text-amber-900",
    },
    rose: {
      heroBg: "bg-gradient-to-br from-rose-50 via-white to-rose-100/70 border-rose-300 shadow-rose-500/10",
      accentBadge: "bg-rose-600 text-white",
      timerText: "text-rose-950",
      digitsBorder: "border-rose-200 bg-rose-50/90 text-rose-900",
    },
    emerald: {
      heroBg: "bg-gradient-to-br from-emerald-50 via-white to-emerald-100/60 border-emerald-300",
      accentBadge: "bg-emerald-600 text-white",
      timerText: "text-emerald-950",
      digitsBorder: "border-emerald-200 bg-emerald-50/80 text-emerald-900",
    },
    slate: {
      heroBg: "bg-gradient-to-br from-slate-50 via-white to-slate-100/60 border-slate-300",
      accentBadge: "bg-slate-600 text-white",
      timerText: "text-slate-950",
      digitsBorder: "border-slate-200 bg-slate-50 text-slate-800",
    },
  }[heroEval.colorScheme || "sky"]

  return (
    <div className="space-y-6">
      {/* ===================================================
          1. PATIENT IDENTITY & QR CONFIRMATION BAR
      =================================================== */}
      <div className="p-4 bg-emerald-50 border border-emerald-200/90 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
        <div className="flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center shadow-xs shrink-0">
            <CheckCircle2 className="w-6 h-6" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-base font-extrabold text-slate-900">
                {displayName}
              </h3>
              <span className="font-mono text-xs font-bold text-emerald-800 bg-emerald-100/80 px-2.5 py-0.5 rounded-lg border border-emerald-300/60">
                {displayCode}
              </span>
              <Badge variant="success" size="sm" dot>
                Bedside QR Verified
              </Badge>
            </div>
            <p className="text-xs text-slate-600 font-medium mt-0.5">
              {displayLocation} · Prescription Roster ({schedules.length} Scheduled Dose{schedules.length > 1 ? "s" : ""})
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Button
            size="sm"
            variant="outline"
            icon={RefreshCw}
            loading={loading}
            onClick={loadData}
            className="text-xs bg-white"
          >
            Refresh
          </Button>
          {onReset && (
            <Button
              size="sm"
              variant="outline"
              icon={RotateCcw}
              onClick={onReset}
              className="text-xs bg-white"
            >
              Scan Next
            </Button>
          )}
        </div>
      </div>

      {/* ===================================================
          2. SMART MEDICATION COUNTDOWN HERO CARD
      =================================================== */}
      <div
        className={`relative overflow-hidden rounded-3xl border-2 p-6 lg:p-8 shadow-lg transition-all ${themeStyles.heroBg}`}
      >
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
          {/* Left: Medication Info & Clinical Details */}
          <div className="space-y-4 max-w-xl">
            {/* Feature Label Pill */}
            <div className="flex flex-wrap items-center gap-2">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-white/80 backdrop-blur-sm border border-slate-200/80 rounded-full text-xs font-bold text-slate-800 shadow-2xs">
                <Sparkles className="w-3.5 h-3.5 text-sky-600" />
                Smart Medication Countdown
              </div>

              {/* Status Badge */}
              <span
                className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-black tracking-wide uppercase shadow-2xs ${themeStyles.accentBadge}`}
              >
                {heroEval.status === "DUE" && <Clock className="w-3.5 h-3.5 animate-spin" />}
                {heroEval.status === "OVERDUE" && <AlertTriangle className="w-3.5 h-3.5" />}
                {heroEval.status === "MISSED" && <ShieldAlert className="w-3.5 h-3.5" />}
                {heroEval.status === "GIVEN" && <CheckCircle2 className="w-3.5 h-3.5" />}
                {heroEval.label}
              </span>

              {primarySchedule.is_stat && (
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-500 text-white">
                  STAT DOSE
                </span>
              )}
            </div>

            {/* Medicine Name & Strength */}
            <div>
              <h2 className="text-2xl lg:text-3xl font-black text-slate-900 tracking-tight">
                {primarySchedule.medicine_name}
              </h2>
              {primarySchedule.generic_name && (
                <p className="text-sm font-medium text-slate-500 mt-0.5">
                  Generic: {primarySchedule.generic_name}
                </p>
              )}
            </div>

            {/* Prescribed Specifications Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-2">
              <div className="p-3 bg-white/80 rounded-2xl border border-slate-200/70 shadow-2xs">
                <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">
                  Prescribed Dose
                </span>
                <span className="text-sm font-extrabold text-slate-900 mt-0.5 block">
                  {primarySchedule.dose || primarySchedule.strength || "—"}
                </span>
              </div>

              <div className="p-3 bg-white/80 rounded-2xl border border-slate-200/70 shadow-2xs">
                <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">
                  Route
                </span>
                <span className="text-sm font-extrabold text-slate-900 mt-0.5 block">
                  {primarySchedule.route || "Oral"}
                </span>
              </div>

              <div className="p-3 bg-white/80 rounded-2xl border border-slate-200/70 shadow-2xs">
                <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">
                  Scheduled Time
                </span>
                <span className="text-sm font-extrabold text-slate-900 mt-0.5 block font-mono">
                  {formatTime(primarySchedule.scheduled_time)}
                </span>
              </div>

              <div className="p-3 bg-white/80 rounded-2xl border border-slate-200/70 shadow-2xs">
                <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">
                  Scheduled Date
                </span>
                <span className="text-sm font-extrabold text-slate-900 mt-0.5 block">
                  {formatDate(primarySchedule.scheduled_date)}
                </span>
              </div>
            </div>

            {/* Clinical Instructions / Notes */}
            {primarySchedule.instructions && (
              <div className="p-3 bg-white/60 rounded-xl border border-slate-200/60 text-xs text-slate-700 flex items-start gap-2">
                <Info className="w-4 h-4 text-sky-600 mt-0.5 shrink-0" />
                <span>
                  <strong>Instructions:</strong> {primarySchedule.instructions}
                </span>
              </div>
            )}
          </div>

          {/* Right: Big Countdown Counter & Bedside Action */}
          <div className="flex flex-col items-center lg:items-end justify-center text-center lg:text-right space-y-4 shrink-0">
            {/* Live Countdown Display Box */}
            <div className="bg-white/90 backdrop-blur-md rounded-3xl p-5 sm:p-6 border border-slate-200/90 shadow-md min-w-[280px] sm:min-w-[320px]">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block">
                Time Until Administration
              </span>

              {/* Large Hero Countdown Text */}
              <div className="my-2">
                <div className={`text-2xl sm:text-3xl font-black tracking-tight ${themeStyles.timerText}`}>
                  {heroEval.countdownPrimary}
                </div>
                {heroEval.countdownDetailed && (
                  <div className="font-mono text-xs font-bold text-slate-500 mt-0.5">
                    Live Timer: {heroEval.countdownDetailed}
                  </div>
                )}
              </div>

              <p className="text-xs text-slate-500 max-w-xs mx-auto lg:ml-auto leading-relaxed">
                {heroEval.countdownSecondary}
              </p>

              {/* Five Rights Safety Reminder Indicator */}
              <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-center gap-1.5 text-[11px] font-semibold text-emerald-700">
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
                <span>Enforcing Five-Rights Bedside Safety</span>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-wrap items-center justify-center lg:justify-end gap-2.5 w-full">
              {heroEval.isActionable ? (
                <Button
                  variant="primary"
                  icon={Pill}
                  className="font-bold shadow-md bg-sky-600 hover:bg-sky-700 text-white"
                  onClick={() =>
                    navigate(
                      `/nurse/medications/${primarySchedule.id}/administration`,
                      {
                        state: {
                          patientId,
                          patientName: displayName,
                          patientCode: displayCode,
                          verifiedViaQr: true,
                        },
                      }
                    )
                  }
                >
                  Proceed to Administer Dose
                </Button>
              ) : (
                <Button
                  variant="outline"
                  icon={CheckCircle2}
                  disabled
                  className="bg-slate-100 text-slate-500 font-bold"
                >
                  Dose Already Recorded
                </Button>
              )}

              <Button
                variant="outline"
                icon={Eye}
                onClick={() =>
                  navigate(`/nurse/medications/${primarySchedule.id}`)
                }
              >
                View Full Details
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* ===================================================
          3. ALL SCHEDULED MEDICATIONS ROSTER (FOR MULTIPLE DOSES)
      =================================================== */}
      {schedules.length > 1 && (
        <Card>
          <CardHeader
            title="Complete Prescription Schedule for Scanned Inpatient"
            subtitle={`All ${schedules.length} ordered doses for ${displayName}. Click any dose to focus countdown.`}
          />
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/70 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  <th className="py-3 px-4">Medication & Strength</th>
                  <th className="py-3 px-4">Prescribed Dose</th>
                  <th className="py-3 px-4">Route</th>
                  <th className="py-3 px-4">Scheduled For</th>
                  <th className="py-3 px-4">Timing & Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {evaluatedSchedules.map((sched) => {
                  const ev = sched.evaluation
                  const isCurrentHero = Number(sched.id) === Number(primarySchedule.id)

                  return (
                    <tr
                      key={sched.id}
                      className={`transition-colors ${
                        isCurrentHero
                          ? "bg-sky-50/60 font-semibold"
                          : "hover:bg-slate-50/70"
                      }`}
                    >
                      {/* Name */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <div className="flex items-center gap-2.5">
                          <div
                            className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs shrink-0 ${
                              isCurrentHero
                                ? "bg-sky-600 text-white font-bold"
                                : "bg-slate-100 text-slate-600"
                            }`}
                          >
                            <Pill className="w-4 h-4" />
                          </div>
                          <div>
                            <div className="font-bold text-slate-900 flex items-center gap-1.5">
                              {sched.medicine_name}
                              {isCurrentHero && (
                                <span className="text-[10px] font-black uppercase text-sky-700 bg-sky-100 px-1.5 py-0.2 rounded">
                                  Focus
                                </span>
                              )}
                            </div>
                            <div className="text-xs text-slate-500">
                              {sched.generic_name || sched.dosage_form || "Tablet"}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Dose */}
                      <td className="py-3.5 px-4 whitespace-nowrap font-medium text-slate-700">
                        {sched.dose || sched.strength || "—"}
                      </td>

                      {/* Route */}
                      <td className="py-3.5 px-4 whitespace-nowrap text-slate-600 text-xs">
                        {sched.route || "Oral"}
                      </td>

                      {/* Scheduled Time */}
                      <td className="py-3.5 px-4 whitespace-nowrap text-xs font-mono text-slate-700">
                        <div>{formatTime(sched.scheduled_time)}</div>
                        <div className="text-[11px] text-slate-400">
                          {formatDate(sched.scheduled_date)}
                        </div>
                      </td>

                      {/* Status & Live Timing */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <div className="space-y-1">
                          <Badge variant={ev.badgeVariant} size="sm">
                            {ev.label}
                          </Badge>
                          <div className="text-[11px] text-slate-500">
                            {ev.countdownPrimary}
                          </div>
                        </div>
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-4 whitespace-nowrap text-right">
                        <div className="flex items-center justify-end gap-2">
                          {!isCurrentHero && (
                            <Button
                              size="xs"
                              variant="outline"
                              onClick={() => setSelectedScheduleId(Number(sched.id))}
                            >
                              Inspect
                            </Button>
                          )}
                          {ev.isActionable && (
                            <Button
                              size="xs"
                              variant="primary"
                              onClick={() =>
                                navigate(
                                  `/nurse/medications/${sched.id}/administration`,
                                  {
                                    state: {
                                      patientId,
                                      patientName: displayName,
                                      patientCode: displayCode,
                                      verifiedViaQr: true,
                                    },
                                  }
                                )
                              }
                            >
                              Administer
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  )
}
