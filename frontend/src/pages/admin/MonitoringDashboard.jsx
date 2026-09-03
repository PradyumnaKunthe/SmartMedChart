import {
  Activity,
  AlertTriangle,
  BarChart3,
  BrainCircuit,
  CheckCircle2,
  ChevronRight,
  Clock3,
  Database,
  FileClock,
  LoaderCircle,
  Pill,
  RefreshCw,
  Server,
  ShieldAlert,
  ShieldCheck,
  UserRound,
  XCircle,
} from "lucide-react"

import {
  Fragment,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react"

import MainLayout from "../../components/layout/MainLayout"

import {
  getAdministrationMonitoring,
  getAIMonitoring,
  getMedicationSummary,
  getMonitoringSchedules,
  getSafetyMonitoring,
} from "../../services/dashboard"
import { hideTestPatients, isTestPatient } from "../../utils/patientFilter"

// =========================================================
// HELPERS
// =========================================================

function normalize(value) {
  return String(
    value ?? "",
  ).toUpperCase()
}


function prettyStatus(value) {
  return normalize(value)
    .replaceAll("_", " ")
}


function formatDate(value) {
  if (!value) {
    return "—"
  }

  const date = new Date(
    `${value}T00:00:00`,
  )

  if (
    Number.isNaN(
      date.getTime(),
    )
  ) {
    return value
  }

  return new Intl.DateTimeFormat(
    "en-IN",
    {
      day: "2-digit",
      month: "short",
      year: "numeric",
    },
  ).format(date)
}


function formatTime(value) {
  if (!value) {
    return "—"
  }

  const [
    hour,
    minute,
  ] = value.split(":")

  const date = new Date()

  date.setHours(
    Number(hour),
    Number(minute),
    0,
    0,
  )

  return new Intl.DateTimeFormat(
    "en-IN",
    {
      hour: "2-digit",
      minute: "2-digit",
    },
  ).format(date)
}


function formatDateTime(
  value,
) {
  if (!value) {
    return "—"
  }

  const date = new Date(
    value,
  )

  if (
    Number.isNaN(
      date.getTime(),
    )
  ) {
    return value
  }

  return new Intl.DateTimeFormat(
    "en-IN",
    {
      dateStyle: "medium",
      timeStyle: "short",
    },
  ).format(date)
}


// =========================================================
// STATUS BADGE
// =========================================================

function StatusBadge({
  status,
}) {
  const value =
    normalize(status)


  let classes =
    "border-slate-200 bg-slate-100 text-slate-600"


  if (value === "GIVEN") {
    classes =
      "border-emerald-200 bg-emerald-50 text-emerald-700"
  }

  if (value === "UPCOMING") {
    classes =
      "border-cyan-200 bg-cyan-50 text-cyan-700"
  }

  if (value === "DELAYED") {
    classes =
      "border-amber-200 bg-amber-50 text-amber-700"
  }

  if (value === "HELD") {
    classes =
      "border-orange-200 bg-orange-50 text-orange-700"
  }

  if (
    value === "REFUSED" ||
    value === "NOT_GIVEN"
  ) {
    classes =
      "border-red-200 bg-red-50 text-red-700"
  }

  if (value === "HIGH") {
    classes =
      "border-red-200 bg-red-50 text-red-700"
  }

  if (value === "MEDIUM") {
    classes =
      "border-amber-200 bg-amber-50 text-amber-700"
  }

  if (value === "LOW") {
    classes =
      "border-emerald-200 bg-emerald-50 text-emerald-700"
  }


  return (
    <span
      className={[
        "inline-flex whitespace-nowrap rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide",
        classes,
      ].join(" ")}
    >
      {prettyStatus(value)}
    </span>
  )
}


// =========================================================
// METRIC CARD
// =========================================================

function MetricCard({
  label,
  value,
  icon: Icon,
  tone = "slate",
  helper = "",
}) {
  const tones = {
    cyan:
      "border-cyan-100 bg-cyan-50 text-cyan-600",

    emerald:
      "border-emerald-100 bg-emerald-50 text-emerald-600",

    amber:
      "border-amber-100 bg-amber-50 text-amber-600",

    red:
      "border-red-100 bg-red-50 text-red-600",

    orange:
      "border-orange-100 bg-orange-50 text-orange-600",

    violet:
      "border-violet-100 bg-violet-50 text-violet-600",

    indigo:
      "border-indigo-100 bg-indigo-50 text-indigo-600",

    slate:
      "border-slate-100 bg-slate-50 text-slate-600",
  }


  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:shadow-md sm:p-5">

      <div className="flex items-start justify-between gap-3">

        <div className="min-w-0">

          <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400 sm:text-xs">
            {label}
          </p>


          <p className="mt-2 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
            {value ?? 0}
          </p>


          {helper && (
            <p className="mt-1 text-[11px] leading-5 text-slate-500 sm:text-xs">
              {helper}
            </p>
          )}

        </div>


        <div
          className={[
            "shrink-0 rounded-xl border p-2.5",
            tones[tone] ||
              tones.slate,
          ].join(" ")}
        >
          <Icon className="h-5 w-5" />
        </div>

      </div>

    </div>
  )
}


// =========================================================
// SECTION HEADER
// =========================================================

function SectionHeader({
  icon: Icon,
  title,
  subtitle,
}) {
  return (
    <div className="flex min-w-0 items-center gap-3">

      <div className="shrink-0 rounded-xl bg-slate-100 p-2.5">

        <Icon className="h-5 w-5 text-slate-700" />

      </div>


      <div className="min-w-0">

        <h2 className="truncate font-semibold text-slate-900">
          {title}
        </h2>

        <p className="mt-0.5 truncate text-xs text-slate-500 sm:text-sm">
          {subtitle}
        </p>

      </div>

    </div>
  )
}


// =========================================================
// SYSTEM INDICATOR
// =========================================================

function SystemIndicator({
  icon: Icon,
  label,
  value,
  tone = "green",
}) {
  const tones = {
    green:
      "text-emerald-400",

    cyan:
      "text-cyan-400",

    amber:
      "text-amber-400",

    red:
      "text-red-400",
  }


  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/80 p-3">

      <div className="flex items-center gap-2">

        <Icon
          className={[
            "h-4 w-4",
            tones[tone] ||
              tones.green,
          ].join(" ")}
        />


        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 sm:text-xs">
          {label}
        </span>


        <span
          className={[
            "ml-auto text-[10px] font-bold uppercase sm:text-xs",
            tones[tone] ||
              tones.green,
          ].join(" ")}
        >
          {value}
        </span>

      </div>

    </div>
  )
}


// =========================================================
// MAIN
// =========================================================

export default function MonitoringDashboard() {
  const [
    summary,
    setSummary,
  ] = useState(null)


  const [
    schedules,
    setSchedules,
  ] = useState([])


  const [
    aiData,
    setAiData,
  ] = useState(null)


  const [
    administrationData,
    setAdministrationData,
  ] = useState(null)


  const [
    safetyData,
    setSafetyData,
  ] = useState(null)


  const [
    loading,
    setLoading,
  ] = useState(true)


  const [
    refreshing,
    setRefreshing,
  ] = useState(false)


  const [
    error,
    setError,
  ] = useState("")


  const [
    statusFilter,
    setStatusFilter,
  ] = useState("")


  const [
    activeTab,
    setActiveTab,
  ] = useState(
    "schedules",
  )


  // =======================================================
  // LOAD DATA
  // =======================================================

  const loadDashboard =
    useCallback(
      async (
        isRefresh = false,
      ) => {
        if (isRefresh) {
          setRefreshing(true)
        } else {
          setLoading(true)
        }


        setError("")


        try {
          const [
            summaryResult,
            scheduleResult,
            aiResult,
            administrationResult,
            safetyResult,
          ] = await Promise.all([
            getMedicationSummary(),

            getMonitoringSchedules({
              status:
                statusFilter,
              limit: 100,
            }),

            getAIMonitoring(
              100,
            ),

            getAdministrationMonitoring(
              100,
            ),

            getSafetyMonitoring(
              100,
            ),
          ])


          const allSchedules = Array.isArray(
            scheduleResult?.schedules,
          )
            ? scheduleResult.schedules
            : []

          const visibleSchedules = hideTestPatients(
            allSchedules,
          )

          const hiddenScheduleIds = new Set(
            allSchedules
              .filter((schedule) => isTestPatient(schedule))
              .map((schedule) => Number(schedule.schedule_id))
              .filter((id) => Number.isFinite(id)),
          )

          const allPredictions = Array.isArray(
            aiResult?.predictions,
          )
            ? aiResult.predictions
            : []

          const visiblePredictions = hideTestPatients(
            allPredictions,
          )

          const allAdministrations = Array.isArray(
            administrationResult?.administrations,
          )
            ? administrationResult.administrations
            : []

          const visibleAdministrations = hideTestPatients(
            allAdministrations,
          )

          const allSafetyChecks = Array.isArray(
            safetyResult?.checks,
          )
            ? safetyResult.checks
            : []

          const visibleSafetyChecks = allSafetyChecks.filter(
            (check) =>
              !hiddenScheduleIds.has(
                Number(check.schedule_id),
              ),
          )

          const normalizeStatus = (value) =>
            String(value || "")
              .trim()
              .toUpperCase()
              .replace(/_/g, " ")

          const visibleSummary = {
            ...(summaryResult?.summary || {}),
            total: visibleSchedules.length,
            given: visibleSchedules.filter(
              (item) =>
                normalizeStatus(item.status) === "GIVEN",
            ).length,
            upcoming: visibleSchedules.filter(
              (item) =>
                normalizeStatus(item.status) === "UPCOMING",
            ).length,
            delayed: visibleSchedules.filter(
              (item) =>
                normalizeStatus(item.status) === "DELAYED",
            ).length,
            held: visibleSchedules.filter(
              (item) =>
                normalizeStatus(item.status) === "HELD",
            ).length,
            refused: visibleSchedules.filter(
              (item) =>
                normalizeStatus(item.status) === "REFUSED",
            ).length,
            not_given: visibleSchedules.filter(
              (item) =>
                normalizeStatus(item.status) === "NOT GIVEN",
            ).length,
            stat: visibleSchedules.filter(
              (item) => Boolean(item.is_stat),
            ).length,
          }

          const now = new Date()
          const todayIso = [
            now.getFullYear(),
            String(now.getMonth() + 1).padStart(2, "0"),
            String(now.getDate()).padStart(2, "0"),
          ].join("-")

          const visibleTodaySchedules = visibleSchedules.filter(
            (item) =>
              String(item.scheduled_date || "") === todayIso,
          )

          const visibleToday = {
            total: visibleTodaySchedules.length,
            given: visibleTodaySchedules.filter(
              (item) =>
                normalizeStatus(item.status) === "GIVEN",
            ).length,
            upcoming: visibleTodaySchedules.filter(
              (item) =>
                normalizeStatus(item.status) === "UPCOMING",
            ).length,
            delayed: visibleTodaySchedules.filter(
              (item) =>
                normalizeStatus(item.status) === "DELAYED",
            ).length,
          }

          const visibleRiskSummary = visiblePredictions.reduce(
            (counts, prediction) => {
              const delayLevel = String(
                prediction.delay_risk_level || "",
              ).toLowerCase()

              const missedLevel = String(
                prediction.missed_risk_level || "",
              ).toLowerCase()

              const levels = [
                delayLevel,
                missedLevel,
              ]

              if (levels.includes("high")) {
                counts.high += 1
              } else if (levels.includes("medium")) {
                counts.medium += 1
              } else if (levels.includes("low")) {
                counts.low += 1
              }

              return counts
            },
            { high: 0, medium: 0, low: 0 },
          )

          const visibleSafetySummary =
            visibleSafetyChecks.reduce(
              (counts, check) => {
                if (check.safe) {
                  counts.safe += 1
                  return counts
                }

                const severity = normalizeStatus(
                  check.severity,
                )

                if (
                  severity === "CRITICAL" ||
                  severity === "HIGH"
                ) {
                  counts.critical += 1
                } else {
                  counts.warnings += 1
                }

                return counts
              },
              {
                safe: 0,
                warnings: 0,
                critical: 0,
              },
            )

          setSchedules(visibleSchedules)

          setAiData({
            ...(aiResult || {}),
            count: visiblePredictions.length,
            predictions: visiblePredictions,
            risk_summary: visibleRiskSummary,
          })

          setAdministrationData({
            ...(administrationResult || {}),
            administrations: visibleAdministrations,
          })

          setSafetyData({
            ...(safetyResult || {}),
            checks: visibleSafetyChecks,
            summary: visibleSafetySummary,
          })

          setSummary({
            ...(summaryResult || {}),
            summary: visibleSummary,
            today: visibleToday,
          })

        } catch (
          requestError
        ) {
          setError(
            requestError?.response?.data?.detail ||
              requestError?.message ||
              "Unable to load monitoring data.",
          )
        } finally {
          setLoading(false)
          setRefreshing(false)
        }
      },
      [
        statusFilter,
      ],
    )


  useEffect(() => {
    loadDashboard(false)
  }, [
    loadDashboard,
  ])


  // =======================================================
  // DATA
  // =======================================================

  const summaryData =
    summary?.summary || {}


  const todayData =
    summary?.today || {}


  const aiPredictions =
    aiData?.predictions || []


  const administrations =
    administrationData?.administrations ||
    []


  const safetyChecks =
    safetyData?.checks || []


  // =======================================================
  // GROUP SCHEDULES BY PATIENT
  // =======================================================
  // One patient can have many medication schedule records.
  // Keep all dose records, but visually group them so the
  // next patient appears only after the current patient's
  // schedules are complete.
  const groupedSchedules = useMemo(() => {
    const groups = new Map()

    schedules.forEach((schedule) => {
      const patientKey =
        schedule.patient_code ||
        schedule.patient_id ||
        schedule.patient_name ||
        `schedule-${schedule.schedule_id}`

      if (!groups.has(patientKey)) {
        groups.set(patientKey, {
          patient_id: schedule.patient_id,
          patient_code: schedule.patient_code,
          patient_name: schedule.patient_name,
          schedules: [],
        })
      }

      groups.get(patientKey).schedules.push(schedule)
    })

    return Array.from(groups.values())
  }, [schedules])


  const riskCounts = {
    high:
      aiData?.risk_summary?.high ||
      0,

    medium:
      aiData?.risk_summary?.medium ||
      0,

    low:
      aiData?.risk_summary?.low ||
      0,
  }


  const totalSchedules =
    Number(
      summaryData.total ||
      0,
    )


  const distribution =
    useMemo(
      () => [
        {
          label: "Given",
          value:
            Number(
              summaryData.given ||
              0,
            ),
          tone:
            "bg-emerald-500",
        },

        {
          label: "Upcoming",
          value:
            Number(
              summaryData.upcoming ||
              0,
            ),
          tone:
            "bg-cyan-500",
        },

        {
          label: "Delayed",
          value:
            Number(
              summaryData.delayed ||
              0,
            ),
          tone:
            "bg-amber-500",
        },

        {
          label: "Held",
          value:
            Number(
              summaryData.held ||
              0,
            ),
          tone:
            "bg-orange-500",
        },

        {
          label: "Refused",
          value:
            Number(
              summaryData.refused ||
              0,
            ),
          tone:
            "bg-red-500",
        },

        {
          label: "Not Given",
          value:
            Number(
              summaryData.not_given ||
              0,
            ),
          tone:
            "bg-rose-500",
        },
      ],
      [
        summaryData,
      ],
    )


  // =======================================================
  // LOADING
  // =======================================================

  if (loading) {
    return (
      <MainLayout title="Clinical Monitoring">

        <div className="flex min-h-[70vh] items-center justify-center">

          <div className="text-center">

            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-950">

              <Activity className="h-7 w-7 animate-pulse text-cyan-400" />

            </div>


            <p className="mt-5 text-sm font-semibold text-slate-800">
              Initializing clinical monitoring center
            </p>


            <p className="mt-1 max-w-sm text-xs leading-5 text-slate-500">
              Loading medication schedules, AI predictions,
              medication safety, and administration data.
            </p>

          </div>

        </div>

      </MainLayout>
    )
  }


  // =======================================================
  // MAIN UI
  // =======================================================

  return (
    <MainLayout title="Clinical Monitoring">

      <div className="space-y-6">

        {/* =================================================
            TECHNICAL HEADER
        ================================================= */}

        <section className="overflow-hidden rounded-3xl border border-slate-800 bg-slate-950 text-white shadow-xl">

          <div className="p-5 sm:p-6 lg:p-7">

            <div className="flex flex-col gap-6 xl:flex-row xl:items-start xl:justify-between">

              <div className="min-w-0">

                <div className="flex items-center gap-3">

                  <div className="rounded-xl bg-cyan-500/10 p-3">

                    <Activity className="h-6 w-6 text-cyan-400" />

                  </div>


                  <div className="min-w-0">

                    <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-cyan-400 sm:text-xs">
                      SMARTMEDCHART
                    </p>


                    <h1 className="mt-1 text-xl font-bold tracking-tight sm:text-2xl">
                      Clinical Monitoring Center
                    </h1>

                  </div>

                </div>


                <p className="mt-4 max-w-3xl text-xs leading-6 text-slate-400 sm:text-sm">
                  Centralized technical monitoring of medication
                  operations, AI risk predictions, medication safety,
                  and administration activity.
                </p>

              </div>


              <div className="flex flex-wrap items-center gap-2">

                <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-2 text-[10px] font-bold uppercase tracking-wide text-emerald-400 sm:text-xs">

                  <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-400" />

                  LIVE

                </div>


                <button
                  type="button"
                  onClick={() =>
                    loadDashboard(
                      true,
                    )
                  }
                  disabled={
                    refreshing
                  }
                  className="inline-flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-900 px-3 py-2.5 text-xs font-semibold text-slate-200 transition hover:bg-slate-800 disabled:opacity-50 sm:px-4 sm:text-sm"
                >

                  <RefreshCw
                    className={
                      refreshing
                        ? "h-4 w-4 animate-spin"
                        : "h-4 w-4"
                    }
                  />

                  Refresh

                </button>

              </div>

            </div>


            {/* System indicators */}

            <div className="mt-6 grid grid-cols-1 gap-2 border-t border-slate-800 pt-5 sm:grid-cols-2 lg:grid-cols-5">

              <SystemIndicator
                icon={Server}
                label="API"
                value="ONLINE"
              />


              <SystemIndicator
                icon={Database}
                label="DATABASE"
                value="CONNECTED"
              />


              <SystemIndicator
                icon={BrainCircuit}
                label="AI ENGINE"
                value="ACTIVE"
                tone="cyan"
              />


              <SystemIndicator
                icon={ShieldCheck}
                label="SAFETY"
                value="ACTIVE"
              />


              <SystemIndicator
                icon={Clock3}
                label="SCHEDULES"
                value={
                  `${totalSchedules}`
                }
                tone="cyan"
              />

            </div>

          </div>

        </section>


        {/* =================================================
            ERROR
        ================================================= */}

        {error && (
          <section className="rounded-2xl border border-red-200 bg-red-50 p-4">

            <div className="flex items-start gap-3">

              <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-red-600" />


              <div>

                <p className="text-sm font-semibold text-red-900">
                  Monitoring data error
                </p>


                <p className="mt-1 text-sm leading-6 text-red-700">
                  {error}
                </p>

              </div>

            </div>

          </section>
        )}


        {/* =================================================
            KPI GRID
        ================================================= */}

        <section>

          <div className="mb-4">

            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-cyan-600">
              Operational Metrics
            </p>

            <h2 className="mt-1 text-lg font-semibold text-slate-900 sm:text-xl">
              Medication Control
            </h2>

          </div>


          <div className="grid grid-cols-2 gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-4 xl:grid-cols-8">

            <MetricCard
              label="Total"
              value={
                summaryData.total
              }
              icon={Pill}
              tone="cyan"
              helper="All schedules"
            />


            <MetricCard
              label="Given"
              value={
                summaryData.given
              }
              icon={CheckCircle2}
              tone="emerald"
              helper="Completed"
            />


            <MetricCard
              label="Upcoming"
              value={
                summaryData.upcoming
              }
              icon={Clock3}
              tone="cyan"
              helper="Pending"
            />


            <MetricCard
              label="Delayed"
              value={
                summaryData.delayed
              }
              icon={Clock3}
              tone="amber"
              helper="Attention"
            />


            <MetricCard
              label="Held"
              value={
                summaryData.held
              }
              icon={ShieldAlert}
              tone="orange"
              helper="Clinical hold"
            />


            <MetricCard
              label="Refused"
              value={
                summaryData.refused
              }
              icon={XCircle}
              tone="red"
              helper="Patient refused"
            />


            <MetricCard
              label="Not Given"
              value={
                summaryData.not_given
              }
              icon={AlertTriangle}
              tone="red"
              helper="Unadministered"
            />


            <MetricCard
              label="STAT"
              value={
                summaryData.stat
              }
              icon={Activity}
              tone="violet"
              helper="Urgent doses"
            />

          </div>

        </section>


        {/* =================================================
            TODAY + AI
        ================================================= */}

        <section className="grid gap-5 xl:grid-cols-2">

          {/* TODAY */}

          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">

            <SectionHeader
              icon={CalendarIcon}
              title="Today's Activity"
              subtitle="Medication schedule activity for today"
            />


            <div className="mt-5 grid grid-cols-2 gap-3">

              <MetricCard
                label="Scheduled"
                value={
                  todayData.total
                }
                icon={CalendarIcon}
                tone="cyan"
              />


              <MetricCard
                label="Given"
                value={
                  todayData.given
                }
                icon={CheckCircle2}
                tone="emerald"
              />


              <MetricCard
                label="Upcoming"
                value={
                  todayData.upcoming
                }
                icon={Clock3}
                tone="cyan"
              />


              <MetricCard
                label="Delayed"
                value={
                  todayData.delayed
                }
                icon={Clock3}
                tone="amber"
              />

            </div>

          </div>


          {/* AI */}

          <div className="rounded-3xl border border-violet-100 bg-white p-5 shadow-sm sm:p-6">

            <SectionHeader
              icon={BrainCircuit}
              title="AI Risk Monitor"
              subtitle="Stored medication risk predictions"
            />


            <div className="mt-5 grid grid-cols-3 gap-3">

              <MetricCard
                label="High"
                value={
                  riskCounts.high
                }
                icon={AlertTriangle}
                tone="red"
              />


              <MetricCard
                label="Medium"
                value={
                  riskCounts.medium
                }
                icon={AlertTriangle}
                tone="amber"
              />


              <MetricCard
                label="Low"
                value={
                  riskCounts.low
                }
                icon={CheckCircle2}
                tone="emerald"
              />

            </div>


            <div className="mt-4 rounded-2xl border border-violet-100 bg-violet-50/60 p-4">

              <div className="flex items-start gap-3">

                <BrainCircuit className="mt-0.5 h-5 w-5 text-violet-600" />


                <div>

                  <p className="text-sm font-semibold text-violet-900">
                    Prediction records
                  </p>


                  <p className="mt-1 text-xs leading-5 text-violet-700">
                    {aiData?.count || 0}
                    {" "}
                    stored AI prediction records available for monitoring.
                  </p>

                </div>

              </div>

            </div>

          </div>

        </section>


        {/* =================================================
            DISTRIBUTION
        ================================================= */}

        <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">

          <SectionHeader
            icon={BarChart3}
            title="Medication Status Distribution"
            subtitle="Relative distribution across all medication schedules"
          />


          <div className="mt-6 space-y-4">

            {distribution.map(
              (item) => {

                const percentage =
                  totalSchedules >
                  0
                    ? (
                        (
                          item.value /
                          totalSchedules
                        ) *
                        100
                      )
                    : 0


                return (
                  <div
                    key={
                      item.label
                    }
                  >

                    <div className="mb-1.5 flex items-center justify-between gap-3">

                      <span className="text-sm font-medium text-slate-700">
                        {item.label}
                      </span>


                      <span className="text-xs font-bold tabular-nums text-slate-500">
                        {item.value}
                        {" · "}
                        {percentage.toFixed(
                          1,
                        )}
                        %
                      </span>

                    </div>


                    <div className="h-2.5 overflow-hidden rounded-full bg-slate-100">

                      <div
                        className={[
                          "h-full rounded-full transition-all duration-500",
                          item.tone,
                        ].join(" ")}
                        style={{
                          width:
                            `${Math.min(
                              100,
                              percentage,
                            )}%`,
                        }}
                      />

                    </div>

                  </div>
                )
              },
            )}

          </div>

        </section>


        {/* =================================================
            TAB BAR
        ================================================= */}

        <section className="sticky top-[80px] z-20 -mx-1 rounded-2xl border border-slate-200 bg-white/95 p-2 shadow-sm backdrop-blur">

          <div className="flex gap-1 overflow-x-auto">

            {[
              {
                id:
                  "schedules",
                label:
                  "Schedules",
                icon:
                  Pill,
              },

              {
                id:
                  "ai",
                label:
                  "AI Monitor",
                icon:
                  BrainCircuit,
              },

              {
                id:
                  "safety",
                label:
                  "Safety",
                icon:
                  ShieldCheck,
              },

              {
                id:
                  "administrations",
                label:
                  "Administration",
                icon:
                  FileClock,
              },
            ].map(
              (tab) => {

                const Icon =
                  tab.icon


                return (
                  <button
                    key={
                      tab.id
                    }
                    type="button"
                    onClick={() =>
                      setActiveTab(
                        tab.id,
                      )
                    }
                    className={[
                      "inline-flex shrink-0 items-center gap-2 rounded-xl px-3 py-2.5 text-xs font-semibold transition sm:px-4 sm:text-sm",
                      activeTab ===
                      tab.id
                        ? "bg-slate-950 text-white shadow-sm"
                        : "text-slate-600 hover:bg-slate-100",
                    ].join(" ")}
                  >

                    <Icon className="h-4 w-4" />

                    {tab.label}

                  </button>
                )
              },
            )}

          </div>

        </section>


        {/* =================================================
            SCHEDULE MONITOR
        ================================================= */}

        {activeTab ===
          "schedules" && (
          <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">

            <div className="border-b border-slate-100 p-5 sm:p-6">

              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">

                <SectionHeader
                  icon={Pill}
                  title="Medication Schedule Monitor"
                  subtitle={`${schedules.length} schedule records loaded`}
                />


                <select
                  value={
                    statusFilter
                  }
                  onChange={(
                    event,
                  ) =>
                    setStatusFilter(
                      event.target.value,
                    )
                  }
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-medium text-slate-700 outline-none transition focus:border-cyan-400 focus:ring-4 focus:ring-cyan-400/10 sm:w-auto"
                >

                  <option value="">
                    All statuses
                  </option>

                  <option value="UPCOMING">
                    Upcoming
                  </option>

                  <option value="GIVEN">
                    Given
                  </option>

                  <option value="DELAYED">
                    Delayed
                  </option>

                  <option value="HELD">
                    Held
                  </option>

                  <option value="REFUSED">
                    Refused
                  </option>

                  <option value="NOT_GIVEN">
                    Not Given
                  </option>

                </select>

              </div>

            </div>


            <div className="overflow-x-auto">

              <table className="min-w-[1150px] w-full">

                <thead className="border-b border-slate-100 bg-slate-50">

                  <tr>

                    {[
                      "Schedule",
                      "Patient",
                      "Medicine",
                      "Prescription",
                      "Scheduled",
                      "Status",
                      "Administration",
                    ].map(
                      (
                        heading,
                      ) => (
                        <th
                          key={
                            heading
                          }
                          className="whitespace-nowrap px-5 py-3 text-left text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400"
                        >
                          {heading}
                        </th>
                      ),
                    )}

                  </tr>

                </thead>


                <tbody className="divide-y divide-slate-100">

                  {groupedSchedules.length === 0 ? (
                    <tr>

                      <td
                        colSpan={7}
                        className="px-5 py-14 text-center"
                      >

                        <Pill className="mx-auto h-8 w-8 text-slate-300" />

                        <p className="mt-3 text-sm font-semibold text-slate-700">
                          No schedule records
                        </p>

                        <p className="mt-1 text-xs text-slate-500">
                          No schedules match the selected filter.
                        </p>

                      </td>

                    </tr>
                  ) : (
                    groupedSchedules.map((patientGroup) => (
                      <Fragment
                        key={
                          patientGroup.patient_code ||
                          patientGroup.patient_id ||
                          patientGroup.patient_name
                        }
                      >

                        {/* PATIENT GROUP HEADER */}
                        <tr className="bg-slate-50">

                          <td
                            colSpan={7}
                            className="px-5 py-4"
                          >

                            <div className="flex flex-wrap items-center gap-4">

                              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-cyan-100">
                                <UserRound className="h-5 w-5 text-cyan-700" />
                              </div>

                              <div className="min-w-0">

                                <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">
                                  Patient
                                </p>

                                <p className="mt-0.5 text-base font-bold text-slate-900">
                                  {patientGroup.patient_name ||
                                    "Unknown patient"}
                                </p>

                                <p className="mt-0.5 text-xs text-slate-500">
                                  {patientGroup.patient_code ||
                                    patientGroup.patient_id ||
                                    "No patient code"}
                                </p>

                              </div>

                              <div className="ml-auto rounded-xl border border-cyan-200 bg-cyan-50 px-3 py-2 text-right">

                                <p className="text-[10px] font-bold uppercase tracking-wide text-cyan-600">
                                  Medication schedules
                                </p>

                                <p className="text-lg font-bold text-cyan-800">
                                  {patientGroup.schedules.length}
                                </p>

                              </div>

                            </div>

                          </td>

                        </tr>


                        {/* PATIENT SCHEDULES */}
                        {patientGroup.schedules.map((schedule) => (
                          <tr
                            key={schedule.schedule_id}
                            className="transition hover:bg-slate-50"
                          >

                            {/* Schedule */}
                            <td className="px-5 py-4">

                              <p className="font-bold tabular-nums text-slate-900">
                                #{schedule.schedule_id}
                              </p>

                              <p className="mt-1 text-[11px] text-slate-400">
                                Item #{schedule.prescription_item_id}
                              </p>

                            </td>


                            {/* Patient */}
                            <td className="px-5 py-4">

                              <span className="text-xs font-medium text-slate-400">
                                Same patient
                              </span>

                            </td>


                            {/* Medicine */}
                            <td className="px-5 py-4">

                              <p className="font-semibold text-slate-800">
                                {schedule.medicine_name}
                              </p>

                              <p className="mt-1 text-xs text-slate-400">
                                {schedule.dose}
                                {" · "}
                                {schedule.route}
                              </p>

                            </td>


                            {/* Prescription */}
                            <td className="px-5 py-4">

                              <p className="text-sm font-medium text-slate-700">
                                #{schedule.prescription_id}
                              </p>

                              <p className="mt-1 text-xs text-slate-400">
                                {schedule.frequency}
                              </p>

                            </td>


                            {/* Scheduled */}
                            <td className="px-5 py-4">

                              <p className="text-sm font-semibold text-slate-800">
                                {formatDate(
                                  schedule.scheduled_date,
                                )}
                              </p>

                              <p className="mt-1 text-xs text-slate-400">
                                {formatTime(
                                  schedule.scheduled_time,
                                )}
                              </p>

                            </td>


                            {/* Status */}
                            <td className="px-5 py-4">

                              <div className="flex flex-wrap items-center gap-2">

                                <StatusBadge
                                  status={schedule.status}
                                />

                                {schedule.is_stat && (
                                  <span className="rounded-full border border-red-200 bg-red-50 px-2.5 py-1 text-[10px] font-bold text-red-700">
                                    STAT
                                  </span>
                                )}

                              </div>

                            </td>


                            {/* Administration */}
                            <td className="px-5 py-4">

                              {schedule.actual_administration_time ? (
                                <div>

                                  <p className="text-sm font-medium text-slate-700">
                                    {formatDateTime(
                                      schedule.actual_administration_time,
                                    )}
                                  </p>

                                  <p className="mt-1 text-xs text-slate-400">
                                    {schedule.administered_by_username ||
                                      schedule.administered_by ||
                                      "User unavailable"}
                                  </p>

                                </div>
                              ) : (
                                <span className="text-xs text-slate-400">
                                  Not administered
                                </span>
                              )}

                            </td>

                          </tr>
                        ))}

                      </Fragment>
                    ))
                  )}

                </tbody>

              </table>

            </div>

          </section>
        )}


        {/* =================================================
            AI MONITOR
        ================================================= */}

        {activeTab ===
          "ai" && (
          <section className="overflow-hidden rounded-3xl border border-violet-100 bg-white shadow-sm">

            <div className="border-b border-violet-100 p-5 sm:p-6">

              <SectionHeader
                icon={BrainCircuit}
                title="AI Prediction Monitor"
                subtitle={`${aiPredictions.length} prediction records loaded`}
              />

            </div>


            <div className="overflow-x-auto">

              <table className="min-w-[1100px] w-full">

                <thead className="border-b border-violet-100 bg-violet-50/60">

                  <tr>

                    {[
                      "Prediction",
                      "Schedule",
                      "Patient",
                      "Medicine",
                      "Delay Risk",
                      "Missed Risk",
                    ].map(
                      (
                        heading,
                      ) => (
                        <th
                          key={
                            heading
                          }
                          className="whitespace-nowrap px-5 py-3 text-left text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400"
                        >
                          {heading}
                        </th>
                      ),
                    )}

                  </tr>

                </thead>


                <tbody className="divide-y divide-slate-100">

                  {aiPredictions.length ===
                  0 ? (
                    <tr>

                      <td
                        colSpan={6}
                        className="px-5 py-14 text-center"
                      >

                        <BrainCircuit className="mx-auto h-8 w-8 text-slate-300" />

                        <p className="mt-3 text-sm font-semibold text-slate-700">
                          No AI predictions
                        </p>

                        <p className="mt-1 text-xs text-slate-500">
                          No stored AI predictions are available.
                        </p>

                      </td>

                    </tr>
                  ) : (
                    aiPredictions.map(
                      (prediction) => (
                        <tr
                          key={
                            prediction.prediction_id
                          }
                          className="hover:bg-violet-50/20"
                        >

                          <td className="px-5 py-4">

                            <p className="font-bold text-slate-900">
                              #
                              {
                                prediction.prediction_id
                              }
                            </p>

                          </td>


                          <td className="px-5 py-4">

                            <p className="font-semibold text-slate-800">
                              #
                              {
                                prediction.schedule_id
                              }
                            </p>

                            <p className="mt-1 text-xs text-slate-400">
                              {formatDate(
                                prediction.scheduled_date,
                              )}
                              {" · "}
                              {formatTime(
                                prediction.scheduled_time,
                              )}
                            </p>

                          </td>


                          <td className="px-5 py-4">

                            <p className="font-semibold text-slate-800">
                              {
                                prediction.patient_name
                              }
                            </p>

                            <p className="mt-1 text-xs text-slate-400">
                              {
                                prediction.patient_code
                              }
                            </p>

                          </td>


                          <td className="px-5 py-4 text-sm font-medium text-slate-800">
                            {
                              prediction.medicine_name
                            }
                          </td>


                          <RiskCell
                            label={
                              prediction.delay_risk_percent
                            }
                            level={
                              prediction.delay_risk_level
                            }
                            percent={
                              prediction.delay_risk_percent
                            }
                            bar="bg-violet-500"
                          />


                          <RiskCell
                            label={
                              prediction.missed_risk_percent
                            }
                            level={
                              prediction.missed_risk_level
                            }
                            percent={
                              prediction.missed_risk_percent
                            }
                            bar="bg-indigo-500"
                          />

                        </tr>
                      ),
                    )
                  )}

                </tbody>

              </table>

            </div>

          </section>
        )}


        {/* =================================================
            SAFETY
        ================================================= */}

        {activeTab ===
          "safety" && (
          <section className="overflow-hidden rounded-3xl border border-red-100 bg-white shadow-sm">

            <div className="border-b border-red-100 p-5 sm:p-6">

              <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">

                <SectionHeader
                  icon={ShieldCheck}
                  title="Medication Safety Monitor"
                  subtitle={`${safetyChecks.length} safety checks processed`}
                />


                <div className="grid grid-cols-3 gap-2">

                  <MiniCounter
                    label="Safe"
                    value={
                      safetyData?.summary?.safe ||
                      0
                    }
                    classes="border-emerald-200 bg-emerald-50 text-emerald-700"
                  />


                  <MiniCounter
                    label="Warnings"
                    value={
                      safetyData?.summary?.warnings ||
                      0
                    }
                    classes="border-amber-200 bg-amber-50 text-amber-700"
                  />


                  <MiniCounter
                    label="Critical"
                    value={
                      safetyData?.summary?.critical ||
                      0
                    }
                    classes="border-red-200 bg-red-50 text-red-700"
                  />

                </div>

              </div>

            </div>


            <div className="overflow-x-auto">

              <table className="min-w-[1050px] w-full">

                <thead className="border-b border-red-100 bg-red-50/40">

                  <tr>

                    {[
                      "Schedule",
                      "Patient",
                      "Medicine",
                      "Severity",
                      "Warnings",
                    ].map(
                      (
                        heading,
                      ) => (
                        <th
                          key={
                            heading
                          }
                          className="whitespace-nowrap px-5 py-3 text-left text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400"
                        >
                          {heading}
                        </th>
                      ),
                    )}

                  </tr>

                </thead>


                <tbody className="divide-y divide-slate-100">

                  {safetyChecks.length ===
                  0 ? (
                    <tr>

                      <td
                        colSpan={5}
                        className="px-5 py-14 text-center"
                      >

                        <ShieldCheck className="mx-auto h-8 w-8 text-slate-300" />

                        <p className="mt-3 text-sm font-semibold text-slate-700">
                          No safety results
                        </p>

                      </td>

                    </tr>
                  ) : (
                    safetyChecks.map(
                      (
                        check,
                        index,
                      ) => (
                        <tr
                          key={`${check.schedule_id}-${check.medicine_id}-${index}`}
                          className="hover:bg-red-50/10"
                        >

                          <td className="px-5 py-4">

                            <p className="font-bold text-slate-900">
                              #
                              {
                                check.schedule_id
                              }
                            </p>

                          </td>


                          <td className="px-5 py-4">

                            <p className="font-medium text-slate-800">
                              Patient #
                              {
                                check.patient_id
                              }
                            </p>

                          </td>


                          <td className="px-5 py-4">

                            <p className="font-semibold text-slate-800">
                              {
                                check.medicine_name ||
                                "Unknown medicine"
                              }
                            </p>

                            <p className="mt-1 text-xs text-slate-400">
                              Medicine ID:{" "}
                              {
                                check.medicine_id
                              }
                            </p>

                          </td>


                          <td className="px-5 py-4">

                            {check.safe ? (
                              <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-[10px] font-bold text-emerald-700">

                                <CheckCircle2 className="h-3.5 w-3.5" />

                                SAFE

                              </span>
                            ) : (
                              <StatusBadge
                                status={
                                  check.severity
                                }
                              />
                            )}

                          </td>


                          <td className="px-5 py-4">

                            <div className="min-w-[280px]">

                              <p className="text-sm font-bold text-slate-800">
                                {
                                  check.warning_count ||
                                  0
                                }{" "}
                                warning
                                {
                                  check.warning_count ===
                                  1
                                    ? ""
                                    : "s"
                                }
                              </p>


                              {Array.isArray(
                                check.warnings,
                              ) &&
                                check.warnings.length >
                                  0 && (
                                  <div className="mt-2 space-y-2">

                                    {check.warnings
                                      .slice(
                                        0,
                                        3,
                                      )
                                      .map(
                                        (
                                          warning,
                                          warningIndex,
                                        ) => (
                                          <div
                                            key={
                                              warningIndex
                                            }
                                            className="rounded-xl border border-red-100 bg-red-50 p-3"
                                          >

                                            <div className="flex items-start gap-2">

                                              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-red-600" />


                                              <p className="text-xs leading-5 text-red-700">

                                                {typeof warning ===
                                                "string"
                                                  ? warning
                                                  : warning.message ||
                                                    warning.reason ||
                                                    "Safety warning"}

                                              </p>

                                            </div>

                                          </div>
                                        ),
                                      )}

                                  </div>
                                )}

                            </div>

                          </td>

                        </tr>
                      ),
                    )
                  )}

                </tbody>

              </table>

            </div>

          </section>
        )}


        {/* =================================================
            ADMINISTRATION
        ================================================= */}

        {activeTab ===
          "administrations" && (
          <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">

            <div className="border-b border-slate-100 p-5 sm:p-6">

              <SectionHeader
                icon={FileClock}
                title="Medication Administration Audit"
                subtitle={`${administrations.length} administration records loaded`}
              />

            </div>


            <div className="overflow-x-auto">

              <table className="min-w-[1150px] w-full">

                <thead className="border-b border-slate-100 bg-slate-50">

                  <tr>

                    {[
                      "Administration",
                      "Schedule",
                      "Patient",
                      "Medicine",
                      "Status",
                      "Administered By",
                      "Actual Time",
                    ].map(
                      (
                        heading,
                      ) => (
                        <th
                          key={
                            heading
                          }
                          className="whitespace-nowrap px-5 py-3 text-left text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400"
                        >
                          {heading}
                        </th>
                      ),
                    )}

                  </tr>

                </thead>


                <tbody className="divide-y divide-slate-100">

                  {administrations.length ===
                  0 ? (
                    <tr>

                      <td
                        colSpan={7}
                        className="px-5 py-14 text-center"
                      >

                        <FileClock className="mx-auto h-8 w-8 text-slate-300" />

                        <p className="mt-3 text-sm font-semibold text-slate-700">
                          No administration records
                        </p>

                        <p className="mt-1 text-xs text-slate-500">
                          No administration events are currently available.
                        </p>

                      </td>

                    </tr>
                  ) : (
                    administrations.map(
                      (record) => (
                        <tr
                          key={
                            record.administration_id
                          }
                          className="hover:bg-slate-50"
                        >

                          <td className="px-5 py-4">

                            <p className="font-bold tabular-nums text-slate-900">
                              #
                              {
                                record.administration_id
                              }
                            </p>

                          </td>


                          <td className="px-5 py-4">

                            <p className="font-semibold text-slate-800">
                              #
                              {
                                record.schedule_id
                              }
                            </p>

                            <p className="mt-1 text-xs text-slate-400">
                              {formatDate(
                                record.scheduled_date,
                              )}
                              {" · "}
                              {formatTime(
                                record.scheduled_time,
                              )}
                            </p>

                          </td>


                          <td className="px-5 py-4">

                            <p className="font-semibold text-slate-800">
                              {
                                record.patient_name
                              }
                            </p>

                            <p className="mt-1 text-xs text-slate-400">
                              {
                                record.patient_code
                              }
                            </p>

                          </td>


                          <td className="px-5 py-4 text-sm font-semibold text-slate-800">
                            {
                              record.medicine_name
                            }
                          </td>


                          <td className="px-5 py-4">

                            <StatusBadge
                              status={
                                record.status
                              }
                            />

                          </td>


                          <td className="px-5 py-4">

                            <div className="flex items-center gap-2">

                              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-cyan-50">

                                <UserRound className="h-4 w-4 text-cyan-600" />

                              </div>


                              <div>

                                <p className="text-sm font-medium text-slate-800">
                                  {
                                    record.administered_by_username ||
                                    record.administered_by ||
                                    "Unknown"
                                  }
                                </p>


                                <p className="text-[11px] text-slate-400">
                                  User ID:{" "}
                                  {
                                    record.administered_by ??
                                    "—"
                                  }
                                </p>

                              </div>

                            </div>

                          </td>


                          <td className="px-5 py-4 text-sm text-slate-600">
                            {
                              formatDateTime(
                                record.administered_at,
                              )
                            }
                          </td>

                        </tr>
                      ),
                    )
                  )}

                </tbody>

              </table>

            </div>

          </section>
        )}


        {/* =================================================
            DATA SOURCE
        ================================================= */}

        <section className="rounded-2xl border border-slate-200 bg-slate-50 p-4 sm:p-5">

          <div className="flex items-start gap-3">

            <Database className="mt-0.5 h-5 w-5 shrink-0 text-slate-500" />


            <div className="min-w-0">

              <p className="text-sm font-semibold text-slate-800">
                Monitoring data source
              </p>


              <p className="mt-1 text-xs leading-5 text-slate-500">
                Operational values shown above are loaded from
                SmartMedChart monitoring APIs and current database
                records. The dashboard does not fabricate medication,
                AI, safety, or administration results.
              </p>

            </div>

          </div>

        </section>

      </div>

    </MainLayout>
  )
}


// =========================================================
// RISK CELL
// =========================================================

function RiskCell({
  label,
  level,
  percent,
  bar,
}) {
  const numeric =
    Math.max(
      0,
      Math.min(
        100,
        Number(percent) ||
          0,
      ),
    )


  return (
    <td className="px-5 py-4">

      <p className="font-bold tabular-nums text-slate-800">
        {Number(percent || 0).toFixed(2)}%
      </p>


      <div className="mt-2 h-2 w-28 overflow-hidden rounded-full bg-slate-100">

        <div
          className={[
            "h-full rounded-full transition-all",
            bar,
          ].join(" ")}
          style={{
            width:
              `${numeric}%`,
          }}
        />

      </div>


      <div className="mt-2">

        <StatusBadge
          status={
            level
          }
        />

      </div>

    </td>
  )
}


// =========================================================
// MINI COUNTER
// =========================================================

function MiniCounter({
  label,
  value,
  classes,
}) {
  return (
    <div
      className={[
        "min-w-[76px] rounded-xl border px-3 py-2 text-center",
        classes,
      ].join(" ")}
    >

      <p className="text-[10px] font-bold uppercase tracking-wide">
        {label}
      </p>


      <p className="mt-0.5 text-lg font-bold">
        {value}
      </p>

    </div>
  )
}


// =========================================================
// CALENDAR ICON
// =========================================================

function CalendarIcon(
  props,
) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <rect
        x="3"
        y="4"
        width="18"
        height="17"
        rx="2"
      />

      <path d="M16 2v4" />
      <path d="M8 2v4" />
      <path d="M3 10h18" />
    </svg>
  )
}