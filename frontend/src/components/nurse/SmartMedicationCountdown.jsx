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
  X,
  XCircle,
  Zap,
} from "lucide-react"

import Card, { CardHeader } from "../common/Card"
import Button from "../common/Button"
import Badge from "../common/Badge"
import Loading from "../common/Loading"
import EmptyState from "../common/EmptyState"
import {
  getNurseMedications,
  getNursePatientDetail,
  administerMedication,
} from "../../services/medications"
import { verifyMedication } from "../../services/qr"
import { useAuth } from "../../context/AuthContext"

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
    hour12: true,
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

export function formatActualTime(isoString) {
  if (!isoString) return "—"
  try {
    const d = new Date(isoString)
    if (Number.isNaN(d.getTime())) return String(isoString)
    return new Intl.DateTimeFormat("en-IN", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    }).format(d)
  } catch {
    return String(isoString)
  }
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
      label: rawStatus === "HELD" ? "HELD" : rawStatus === "REFUSED" ? "REFUSED" : "NOT GIVEN",
      badgeVariant: rawStatus === "HELD" ? "neutral" : "danger",
      isActionable: false,
      isGiven: false,
      countdownPrimary: rawStatus === "HELD" ? "Held by Doctor Order" : "Dose Not Administered",
      countdownSecondary: schedule.notes || "Clinical recorded status",
      colorScheme: "slate",
    }
  }

  // 2. Administered medications
  if (["GIVEN", "GIVEN_ON_TIME", "GIVEN_LATE", "GIVEN_EARLY"].includes(rawStatus) || schedule?.actual_administration_time) {
    const isLate = rawStatus === "GIVEN_LATE"
    const isEarly = rawStatus === "GIVEN_EARLY"
    const label = isLate ? "GIVEN LATE" : isEarly ? "GIVEN EARLY" : "GIVEN ON TIME"
    return {
      status: "GIVEN",
      label: label,
      badgeVariant: isLate ? "warning" : isEarly ? "primary" : "success",
      isActionable: false,
      isGiven: true,
      countdownPrimary: "Administered",
      countdownSecondary: schedule.actual_administration_time
        ? `Recorded at ${formatActualTime(schedule.actual_administration_time)}`
        : "Administration confirmed",
      colorScheme: isLate ? "amber" : isEarly ? "sky" : "emerald",
    }
  }

  // 3. Unadministered schedules against live hospital policy (30m pre-dose / 60m grace / 240m missed)
  const targetDate = parseScheduleDate(schedule?.scheduled_date, schedule?.scheduled_time)
  if (!targetDate) {
    return {
      status: "UPCOMING",
      label: "SCHEDULED",
      badgeVariant: "neutral",
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
      label: "UPCOMING",
      badgeVariant: "neutral",
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
      label: "DUE",
      badgeVariant: "primary",
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
      label: "OVERDUE",
      badgeVariant: "warning",
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
    label: "MISSED",
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
// SMART MEDICATION COUNTDOWN & DAILY TRACKER COMPONENT
// ==============================================================================

export default function SmartMedicationCountdown({
  patientId,
  patientInfo,
  scheduleId,
  onReset,
}) {
  const navigate = useNavigate()
  const { user } = useAuth()

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [schedules, setSchedules] = useState([])
  const [patientDetails, setPatientDetails] = useState(patientInfo || null)
  const [selectedScheduleId, setSelectedScheduleId] = useState(
    scheduleId ? Number(scheduleId) : null
  )

  // Live 1-second ticker for real-time countdown updates
  const [now, setNow] = useState(() => new Date())

  // Date Filter mode: "TODAY" or "ALL"
  const [dateFilterMode, setDateFilterMode] = useState("TODAY")

  // Mark as Given Modal State
  const [administerModalSchedule, setAdministerModalSchedule] = useState(null)
  const [administerSubmitting, setAdministerSubmitting] = useState(false)
  const [administerError, setAdministerError] = useState("")
  const [administerNotes, setAdministerNotes] = useState("")
  const [administerOverrideReason, setAdministerOverrideReason] = useState("")
  const [actionSuccessMessage, setActionSuccessMessage] = useState("")

  useEffect(() => {
    const timer = setInterval(() => {
      setNow(new Date())
    }, 1000)
    return () => clearInterval(timer)
  }, [])

  // Today's hospital date strings
  const todayStr = useMemo(() => {
    const d = new Date()
    const year = d.getFullYear()
    const month = String(d.getMonth() + 1).padStart(2, "0")
    const day = String(d.getDate()).padStart(2, "0")
    return `${year}-${month}-${day}`
  }, [])

  const todayFormatted = useMemo(() => {
    return new Intl.DateTimeFormat("en-IN", {
      weekday: "long",
      day: "2-digit",
      month: "short",
      year: "numeric",
    }).format(new Date())
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

  // Split into today vs all
  const todaySchedules = useMemo(() => {
    return evaluatedSchedules.filter((s) => {
      const sDate = String(s.scheduled_date || "").split("T")[0]
      return sDate === todayStr
    })
  }, [evaluatedSchedules, todayStr])

  // Active list of schedules to display in the daily record
  const displayedSchedules = useMemo(() => {
    if (dateFilterMode === "TODAY" && todaySchedules.length > 0) {
      return todaySchedules
    }
    return evaluatedSchedules
  }, [dateFilterMode, todaySchedules, evaluatedSchedules])

  // Metrics for the displayed schedule set
  const metrics = useMemo(() => {
    const list = displayedSchedules
    return {
      total: list.length,
      given: list.filter((s) => s.evaluation.isGiven).length,
      due: list.filter((s) => s.evaluation.status === "DUE").length,
      upcoming: list.filter((s) => s.evaluation.status === "UPCOMING").length,
      overdue: list.filter((s) => s.evaluation.status === "OVERDUE").length,
      missed: list.filter((s) => s.evaluation.status === "MISSED").length,
    }
  }, [displayedSchedules])

  // Identify the most relevant next dose (Hero Countdown)
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
      // Prefer today's unadministered doses if available
      const todayUnadministered = unadministered.filter(
        (s) => String(s.scheduled_date || "").split("T")[0] === todayStr
      )
      const targetPool = todayUnadministered.length > 0 ? todayUnadministered : unadministered

      // Priority 1: Due, Overdue, or Missed doses
      const urgent = targetPool.filter((s) =>
        ["DUE", "OVERDUE", "MISSED"].includes(s.evaluation.status)
      )
      if (urgent.length > 0) {
        return urgent[0]
      }

      // Priority 2: Closest upcoming future dose
      return targetPool[0]
    }

    // Fallback: Show the first schedule
    return evaluatedSchedules[0]
  }, [evaluatedSchedules, selectedScheduleId, todayStr])

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

  // ============================================================================
  // MARK AS GIVEN ACTION HANDLERS
  // ============================================================================

  function openAdministerModal(schedule) {
    setAdministerModalSchedule(schedule)
    setAdministerError("")
    setAdministerNotes("")
    setAdministerOverrideReason("")
  }

  function closeAdministerModal() {
    if (administerSubmitting) return
    setAdministerModalSchedule(null)
    setAdministerError("")
  }

  async function handleConfirmAdminister() {
    if (!administerModalSchedule) return
    setAdministerSubmitting(true)
    setAdministerError("")

    const scheduleId = Number(administerModalSchedule.id)
    const isAssigned = administerModalSchedule.is_assigned !== false

    // Step 1: Medication-to-patient verification
    try {
      const vRes = await verifyMedication(patientId, scheduleId)
      if (vRes && vRes.valid === false) {
        setAdministerError(
          vRes.message || "Medication verification failed for this patient. Administration aborted."
        )
        setAdministerSubmitting(false)
        return
      }
    } catch (vErr) {
      console.warn("Medication verification notice:", vErr)
    }

    // Step 2: Covering nurse override validation
    if (!isAssigned && !administerOverrideReason.trim()) {
      setAdministerError(
        "This patient is assigned to another nurse. An override justification is required by hospital policy."
      )
      setAdministerSubmitting(false)
      return
    }

    // Step 3: Execute POST /api/nurse/medications/{schedule_id}/administer
    try {
      const payload = {
        status: "GIVEN",
        administered_at: new Date().toISOString(),
        notes: administerNotes.trim() || null,
        is_override: !isAssigned,
        override_reason: !isAssigned ? administerOverrideReason.trim() : null,
      }

      const result = await administerMedication(scheduleId, payload)

      const nowIso = result.administered_at || new Date().toISOString()
      const nurseDisplayName =
        result.administered_by_name ||
        result.nurse_name ||
        user?.full_name ||
        user?.username ||
        "Nurse"

      // Step 4: Optimistically update local schedule state immediately
      setSchedules((prev) =>
        prev.map((item) => {
          if (String(item.id || item._id) === String(scheduleId)) {
            return {
              ...item,
              status: result.status || "GIVEN",
              actual_administration_time: nowIso,
              administered_at: nowIso,
              administered_by: result.administered_by || user?.id,
              administered_by_name: nurseDisplayName,
              nurse_name: nurseDisplayName,
              notes: administerNotes.trim() || item.notes,
            }
          }
          return item
        })
      )

      // Step 5: Close modal & present confirmation toast
      setAdministerModalSchedule(null)
      const medName = administerModalSchedule.medicine_name
      const medDose = administerModalSchedule.dose || administerModalSchedule.strength || ""
      setActionSuccessMessage(
        `Successfully recorded ${medName} ${medDose} as GIVEN at ${formatActualTime(nowIso)} by ${nurseDisplayName}.`
      )

      setTimeout(() => {
        setActionSuccessMessage("")
      }, 7000)

      // Background synchronization
      getNurseMedications({ patient_id: patientId })
        .then((fresh) => {
          if (Array.isArray(fresh)) setSchedules(fresh)
        })
        .catch(() => null)
    } catch (err) {
      const errorMsg =
        err?.response?.data?.detail ||
        err?.message ||
        "Failed to record medication administration."
      setAdministerError(errorMsg)
    } finally {
      setAdministerSubmitting(false)
    }
  }

  // Loading state
  if (loading && schedules.length === 0) {
    return (
      <Card className="border-sky-200 bg-white/90 backdrop-blur-sm shadow-md">
        <div className="p-8 text-center space-y-4">
          <LoaderCircle className="w-10 h-10 animate-spin text-sky-600 mx-auto" />
          <h3 className="text-base font-bold text-slate-900">
            Synchronizing Patient Medication Schedules...
          </h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            Retrieving prescribed orders, frequency doses, and administration history for verified inpatient...
          </p>
        </div>
      </Card>
    )
  }

  // Error state
  if (error && schedules.length === 0) {
    return (
      <div className="p-6 bg-rose-50 border border-rose-300 rounded-3xl space-y-4 shadow-sm">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-rose-100 text-rose-700 flex items-center justify-center shrink-0">
            <XCircle className="w-6 h-6" />
          </div>
          <div className="space-y-1">
            <h3 className="text-base font-bold text-rose-950">
              Access Restricted or Patient Inactive
            </h3>
            <p className="text-xs text-rose-800 leading-relaxed font-medium">
              {error}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 pt-2 border-t border-rose-200">
          <Button variant="danger" size="sm" onClick={loadData}>
            Retry Synchronization
          </Button>
          {onReset && (
            <Button variant="outline" size="sm" onClick={onReset}>
              Scan Different Patient
            </Button>
          )}
        </div>
      </div>
    )
  }

  // Empty state
  if (schedules.length === 0) {
    return (
      <div className="space-y-4">
        {/* Patient Identity Bar */}
        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-center justify-between shadow-xs">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center shadow-xs">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-slate-900">{displayName}</h3>
                <span className="font-mono text-xs font-bold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded border border-emerald-300">
                  {displayCode}
                </span>
                <Badge variant="success" size="sm" dot>
                  QR Verified
                </Badge>
              </div>
              <p className="text-xs text-slate-600 font-medium">
                {displayLocation} · No active prescriptions found
              </p>
            </div>
          </div>
          {onReset && (
            <Button size="sm" variant="outline" icon={RotateCcw} onClick={onReset}>
              Scan Next
            </Button>
          )}
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

  const heroEval = primarySchedule ? primarySchedule.evaluation : null

  // Status visual themes
  const themeStyles = heroEval
    ? {
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
    : null

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
              {displayLocation} · Prescription Roster ({schedules.length} Total Scheduled Dose{schedules.length > 1 ? "s" : ""})
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
              Scan Next Patient
            </Button>
          )}
        </div>
      </div>

      {/* Success Notification Alert */}
      {actionSuccessMessage && (
        <div className="p-4 bg-emerald-600 text-white rounded-2xl shadow-md flex items-center justify-between gap-3 animate-in fade-in slide-in-from-top-2">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-white/20 flex items-center justify-center shrink-0">
              <CheckCircle2 className="w-5 h-5 text-white" />
            </div>
            <p className="text-sm font-bold">{actionSuccessMessage}</p>
          </div>
          <button
            onClick={() => setActionSuccessMessage("")}
            className="text-white/80 hover:text-white p-1"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* ===================================================
          2. SMART MEDICATION COUNTDOWN HERO CARD
      =================================================== */}
      {primarySchedule && heroEval && (
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

              {/* Actual administration details if given */}
              {heroEval.isGiven && (
                <div className="p-3.5 bg-emerald-100/80 rounded-2xl border border-emerald-300 text-xs text-emerald-950 flex items-center justify-between">
                  <div>
                    <span className="font-bold">Actual Administration: </span>
                    <span className="font-mono font-bold">
                      {formatActualTime(primarySchedule.actual_administration_time)}
                    </span>
                  </div>
                  <div>
                    <span className="font-bold">Administered by: </span>
                    <span className="font-semibold">
                      {primarySchedule.administered_by_name || primarySchedule.nurse_name || "Assigned Nurse"}
                    </span>
                  </div>
                </div>
              )}

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

              {/* Action Buttons on Hero Card */}
              <div className="flex flex-wrap items-center justify-center lg:justify-end gap-2.5 w-full">
                {heroEval.isActionable ? (
                  <>
                    <Button
                      variant="primary"
                      icon={CheckCircle2}
                      className="font-bold shadow-md bg-emerald-600 hover:bg-emerald-700 text-white"
                      onClick={() => openAdministerModal(primarySchedule)}
                    >
                      Mark as Given
                    </Button>
                    <Button
                      variant="outline"
                      icon={Pill}
                      onClick={() =>
                        navigate(
                          `/nurse/medications/${primarySchedule.id || primarySchedule._id}/administration`,
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
                      Checklist
                    </Button>
                  </>
                ) : (
                  <Button
                    variant="outline"
                    icon={CheckCircle2}
                    disabled
                    className="bg-emerald-50 text-emerald-700 border-emerald-300 font-bold"
                  >
                    Dose Administered
                  </Button>
                )}

                <Button
                  variant="outline"
                  icon={Eye}
                  onClick={() =>
                    navigate(`/nurse/medications/${primarySchedule.id}`)
                  }
                >
                  View Details
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ===================================================
          3. DAILY MEDICATION ADMINISTRATION RECORD
      =================================================== */}
      <Card>
        {/* Header with Today's Date and Filter Toggle */}
        <div className="p-6 border-b border-slate-200/90 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <Calendar className="w-5 h-5 text-sky-600" />
              <h3 className="text-lg font-bold text-slate-900">
                Daily Medication Record
              </h3>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              {todayFormatted} · Review scheduled doses for this hospital day and confirm physical administration.
            </p>
          </div>

          {/* View Filter Toggle */}
          <div className="flex items-center gap-2 bg-slate-100 p-1 rounded-xl self-start md:self-auto">
            <button
              onClick={() => setDateFilterMode("TODAY")}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                dateFilterMode === "TODAY"
                  ? "bg-white text-slate-900 shadow-xs"
                  : "text-slate-500 hover:text-slate-900"
              }`}
            >
              Today's Doses ({todaySchedules.length})
            </button>
            <button
              onClick={() => setDateFilterMode("ALL")}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                dateFilterMode === "ALL"
                  ? "bg-white text-slate-900 shadow-xs"
                  : "text-slate-500 hover:text-slate-900"
              }`}
            >
              All Doses ({evaluatedSchedules.length})
            </button>
          </div>
        </div>

        {/* 6 Responsive Summary Metric Cards */}
        <div className="p-6 bg-slate-50/60 border-b border-slate-200/70">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {/* Total */}
            <div className="p-3 bg-white rounded-2xl border border-slate-200/80 shadow-2xs">
              <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">
                Total Scheduled
              </span>
              <span className="text-xl font-extrabold text-slate-900 mt-0.5 block">
                {metrics.total}
              </span>
            </div>

            {/* Given */}
            <div className="p-3 bg-emerald-50/60 rounded-2xl border border-emerald-200 shadow-2xs">
              <span className="text-[10px] uppercase font-bold text-emerald-700 block tracking-wider">
                Doses Given
              </span>
              <span className="text-xl font-extrabold text-emerald-700 mt-0.5 block">
                {metrics.given}
              </span>
            </div>

            {/* Due */}
            <div className="p-3 bg-blue-50/60 rounded-2xl border border-blue-200 shadow-2xs">
              <span className="text-[10px] uppercase font-bold text-blue-700 block tracking-wider">
                Due Now
              </span>
              <span className="text-xl font-extrabold text-blue-700 mt-0.5 block">
                {metrics.due}
              </span>
            </div>

            {/* Upcoming */}
            <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200 shadow-2xs">
              <span className="text-[10px] uppercase font-bold text-slate-500 block tracking-wider">
                Upcoming
              </span>
              <span className="text-xl font-extrabold text-slate-700 mt-0.5 block">
                {metrics.upcoming}
              </span>
            </div>

            {/* Overdue */}
            <div className="p-3 bg-amber-50/60 rounded-2xl border border-amber-200 shadow-2xs">
              <span className="text-[10px] uppercase font-bold text-amber-700 block tracking-wider">
                Overdue
              </span>
              <span className="text-xl font-extrabold text-amber-700 mt-0.5 block">
                {metrics.overdue}
              </span>
            </div>

            {/* Missed */}
            <div className="p-3 bg-rose-50/60 rounded-2xl border border-rose-200 shadow-2xs">
              <span className="text-[10px] uppercase font-bold text-rose-700 block tracking-wider">
                Missed
              </span>
              <span className="text-xl font-extrabold text-rose-700 mt-0.5 block">
                {metrics.missed}
              </span>
            </div>
          </div>
        </div>

        {/* Schedule List / Table */}
        {displayedSchedules.length === 0 ? (
          <div className="p-12 text-center space-y-3">
            <Pill className="w-10 h-10 text-slate-300 mx-auto" />
            <h4 className="text-sm font-bold text-slate-700">
              No Doses Scheduled for Today ({todayFormatted})
            </h4>
            <p className="text-xs text-slate-400 max-w-sm mx-auto">
              There are {evaluatedSchedules.length} active scheduled doses ordered for other dates.
            </p>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setDateFilterMode("ALL")}
            >
              View All Active Scheduled Dates
            </Button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/70 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  <th className="py-3 px-4">Medication & Strength</th>
                  <th className="py-3 px-4">Prescribed Dose</th>
                  <th className="py-3 px-4">Route</th>
                  <th className="py-3 px-4">Scheduled Date & Time</th>
                  <th className="py-3 px-4">Status & Live Timing</th>
                  <th className="py-3 px-4">Actual Administration</th>
                  <th className="py-3 px-4 text-right">Bedside Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {displayedSchedules.map((sched) => {
                  const ev = sched.evaluation
                  const isCurrentHero =
                    primarySchedule && Number(sched.id) === Number(primarySchedule.id)

                  // Map badge variant according to prompt
                  // GIVEN: Green, DUE: Blue, UPCOMING: Neutral, OVERDUE: Orange, MISSED: Red, HELD: Grey, REFUSED/NOT_GIVEN: Red/neutral
                  let statusBadgeClass = "bg-slate-100 text-slate-700 border-slate-300"
                  if (ev.status === "GIVEN") {
                    statusBadgeClass = "bg-emerald-100 text-emerald-800 border-emerald-300 font-bold"
                  } else if (ev.status === "DUE") {
                    statusBadgeClass = "bg-blue-100 text-blue-800 border-blue-300 font-bold animate-pulse"
                  } else if (ev.status === "OVERDUE") {
                    statusBadgeClass = "bg-amber-100 text-amber-800 border-amber-300 font-bold"
                  } else if (ev.status === "MISSED") {
                    statusBadgeClass = "bg-rose-100 text-rose-800 border-rose-300 font-bold"
                  } else if (ev.status === "HELD") {
                    statusBadgeClass = "bg-slate-200 text-slate-700 border-slate-300 font-medium"
                  } else if (["REFUSED", "NOT_GIVEN"].includes(ev.status)) {
                    statusBadgeClass = "bg-rose-50 text-rose-700 border-rose-200 font-medium"
                  }

                  return (
                    <tr
                      key={sched.id}
                      className={`transition-colors ${
                        isCurrentHero
                          ? "bg-sky-50/50"
                          : "hover:bg-slate-50/70"
                      }`}
                    >
                      {/* Name */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <div className="flex items-center gap-2.5">
                          <div
                            className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs shrink-0 ${
                              ev.isGiven
                                ? "bg-emerald-600 text-white"
                                : isCurrentHero
                                ? "bg-sky-600 text-white font-bold"
                                : "bg-slate-100 text-slate-600"
                            }`}
                          >
                            <Pill className="w-4 h-4" />
                          </div>
                          <div>
                            <div className="font-bold text-slate-900 flex items-center gap-1.5">
                              {sched.medicine_name}
                              {sched.strength && (
                                <span className="text-xs font-semibold text-slate-500">
                                  {sched.strength}
                                </span>
                              )}
                              {isCurrentHero && (
                                <span className="text-[10px] font-black uppercase text-sky-700 bg-sky-100 px-1.5 py-0.2 rounded">
                                  Current Focus
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
                      <td className="py-3.5 px-4 whitespace-nowrap text-slate-600 text-xs font-semibold">
                        {sched.route || "Oral"}
                      </td>

                      {/* Scheduled Date & Time */}
                      <td className="py-3.5 px-4 whitespace-nowrap text-xs font-mono text-slate-700">
                        <div className="font-bold">{formatTime(sched.scheduled_time)}</div>
                        <div className="text-[11px] text-slate-400">
                          {formatDate(sched.scheduled_date)}
                        </div>
                      </td>

                      {/* Status */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <div className="space-y-1">
                          <span
                            className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs border ${statusBadgeClass}`}
                          >
                            {ev.status === "GIVEN" && <CheckCircle2 className="w-3 h-3" />}
                            {ev.status === "DUE" && <Clock className="w-3 h-3" />}
                            {ev.status === "OVERDUE" && <AlertTriangle className="w-3 h-3" />}
                            {ev.status === "MISSED" && <ShieldAlert className="w-3 h-3" />}
                            {ev.label}
                          </span>
                          <div className="text-[11px] text-slate-500">
                            {ev.countdownPrimary}
                          </div>
                        </div>
                      </td>

                      {/* Actual Administration */}
                      <td className="py-3.5 px-4 whitespace-nowrap text-xs">
                        {ev.isGiven ? (
                          <div className="space-y-0.5">
                            <div className="font-bold text-emerald-800 flex items-center gap-1">
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                              <span>{formatActualTime(sched.actual_administration_time)}</span>
                            </div>
                            <div className="text-[11px] text-slate-500">
                              by {sched.administered_by_name || sched.nurse_name || "Assigned Nurse"}
                            </div>
                          </div>
                        ) : (
                          <span className="text-slate-400 font-mono">—</span>
                        )}
                      </td>

                      {/* Action */}
                      <td className="py-3.5 px-4 whitespace-nowrap text-right">
                        <div className="flex items-center justify-end gap-2">
                          {ev.isActionable ? (
                            <>
                              <Button
                                size="xs"
                                variant="primary"
                                icon={CheckCircle2}
                                className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold"
                                onClick={() => openAdministerModal(sched)}
                              >
                                Mark as Given
                              </Button>
                              <Button
                                size="xs"
                                variant="outline"
                                onClick={() =>
                                  navigate(
                                    `/nurse/medications/${sched.id || sched._id}/administration`,
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
                                Checklist
                              </Button>
                            </>
                          ) : ev.isGiven ? (
                            <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-700 bg-emerald-50 px-2 py-1 rounded-lg border border-emerald-200">
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              Administered
                            </span>
                          ) : (
                            <span className="text-xs text-slate-400 font-medium italic">
                              Clinical Hold
                            </span>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* ===================================================
          4. CONFIRMATION MODAL: MARK AS GIVEN
      =================================================== */}
      {administerModalSchedule && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 space-y-5 animate-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="flex items-start justify-between gap-3 border-b border-slate-100 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                  <CheckCircle2 className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-slate-900">
                    Confirm Medication Administration
                  </h3>
                  <p className="text-xs text-slate-500">
                    Bedside verification & permanent clinical record
                  </p>
                </div>
              </div>
              <button
                disabled={administerSubmitting}
                onClick={closeAdministerModal}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Confirmation Question Highlight */}
            <div className="p-4 bg-sky-50 border border-sky-200 rounded-2xl space-y-1">
              <span className="text-xs font-bold uppercase tracking-wider text-sky-800">
                Bedside Confirmation
              </span>
              <p className="text-sm font-extrabold text-slate-900 leading-snug">
                Have you physically administered this prescribed medication to the verified patient?
              </p>
            </div>

            {/* Error Message Alert */}
            {administerError && (
              <div className="p-3.5 bg-rose-50 border border-rose-300 rounded-2xl flex items-start gap-2.5 text-xs text-rose-800">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                <span className="font-semibold leading-relaxed">{administerError}</span>
              </div>
            )}

            {/* Dose Summary Box */}
            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200/80 space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-slate-500 font-medium">Patient:</span>
                <span className="font-bold text-slate-900">
                  {displayName} ({displayCode})
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500 font-medium">Location:</span>
                <span className="font-semibold text-slate-700">{displayLocation}</span>
              </div>
              <div className="flex items-center justify-between border-t border-slate-200/60 pt-2">
                <span className="text-slate-500 font-medium">Medication:</span>
                <span className="font-bold text-slate-900">
                  {administerModalSchedule.medicine_name}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500 font-medium">Prescribed Dose:</span>
                <span className="font-mono font-bold text-slate-900">
                  {administerModalSchedule.dose || administerModalSchedule.strength || "—"}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500 font-medium">Route:</span>
                <span className="font-semibold text-slate-900">
                  {administerModalSchedule.route || "Oral"}
                </span>
              </div>
              <div className="flex items-center justify-between border-t border-slate-200/60 pt-2">
                <span className="text-slate-500 font-medium">Scheduled Time:</span>
                <span className="font-mono font-bold text-slate-900">
                  {formatTime(administerModalSchedule.scheduled_time)} · {formatDate(administerModalSchedule.scheduled_date)}
                </span>
              </div>
            </div>

            {/* Optional Bedside Notes */}
            <div className="space-y-1">
              <label className="block text-xs font-bold text-slate-700">
                Clinical Administration Notes <span className="text-slate-400 font-normal">(Optional)</span>
              </label>
              <input
                type="text"
                disabled={administerSubmitting}
                value={administerNotes}
                onChange={(e) => setAdministerNotes(e.target.value)}
                placeholder="e.g. Administered with water, patient tolerated well"
                className="w-full text-xs rounded-xl border border-slate-300 p-2.5 focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
              />
            </div>

            {/* Covering Nurse Override Justification (if unassigned) */}
            {administerModalSchedule.is_assigned === false && (
              <div className="space-y-1 p-3 bg-amber-50 border border-amber-200 rounded-2xl">
                <div className="flex items-center gap-1.5 text-xs font-bold text-amber-900">
                  <ShieldAlert className="w-4 h-4 text-amber-600" />
                  <span>Covering Nurse Override Justification Required</span>
                </div>
                <p className="text-[11px] text-amber-700">
                  This patient is assigned to {administerModalSchedule.assigned_nurse_name || "another nurse"}.
                </p>
                <input
                  type="text"
                  required
                  disabled={administerSubmitting}
                  value={administerOverrideReason}
                  onChange={(e) => setAdministerOverrideReason(e.target.value)}
                  placeholder="e.g. Covering break, primary nurse assisting emergency"
                  className="w-full text-xs rounded-xl border border-amber-300 p-2.5 bg-white focus:ring-2 focus:ring-amber-500 focus:outline-hidden mt-1"
                />
              </div>
            )}

            {/* Modal Actions */}
            <div className="flex items-center justify-end gap-3 pt-2">
              <Button
                variant="outline"
                size="sm"
                disabled={administerSubmitting}
                onClick={closeAdministerModal}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                size="sm"
                icon={CheckCircle2}
                loading={administerSubmitting}
                onClick={handleConfirmAdminister}
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold"
              >
                Confirm Administration
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
