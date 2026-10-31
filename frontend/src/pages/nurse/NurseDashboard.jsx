import React, { useEffect, useMemo, useState } from "react"
import { useNavigate } from "react-router-dom"
import {
  AlertTriangle,
  CalendarClock,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Clock,
  Filter,
  Pill,
  QrCode,
  RefreshCw,
  Search,
  ShieldAlert,
  Sparkles,
  User,
  Users,
  Zap,
} from "lucide-react"

import MainLayout from "../../components/layout/MainLayout"
import Card, { CardHeader } from "../../components/common/Card"
import Button from "../../components/common/Button"
import Badge from "../../components/common/Badge"
import Loading from "../../components/common/Loading"
import EmptyState from "../../components/common/EmptyState"
import StatCard from "../../components/dashboard/StatCard"
import Modal from "../../components/common/Modal"
import { getNurseMedications, getNurseMedicationHistory } from "../../services/medications"
import { hideTestPatients } from "../../utils/patientFilter"
import { Clock3, History, ShieldCheck } from "lucide-react"

function normalizeStatus(status) {
  return String(status || "").trim().toUpperCase().replace(/_/g, " ")
}

function getStatusBadgeVariant(status) {
  const norm = String(status || "").toUpperCase().replace(/ /g, "_")
  switch (norm) {
    case "GIVEN":
    case "GIVEN_ON_TIME":
      return "success"
    case "GIVEN_LATE":
    case "DELAYED":
      return "warning"
    case "DUE":
      return "primary"
    case "OVERDUE":
    case "MISSED":
      return "danger"
    case "HELD":
      return "neutral"
    case "REFUSED":
      return "danger"
    case "NOT_GIVEN":
      return "neutral"
    case "UPCOMING":
    default:
      return "neutral"
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
    month: "short",
  }).format(date)
}

function buildPatientGroups(medications) {
  const map = new Map()

  medications.forEach((med) => {
    const patientId = med.patient_id ?? null
    const patientCode = med.patient_code ?? null
    const patientKey =
      patientCode || patientId || med.patient_name || "UNKNOWN-PATIENT"

    if (!map.has(patientKey)) {
      map.set(patientKey, {
        patient_id: patientId,
        patient_code: patientCode || "N/A",
        patient_name: med.patient_name || "Unknown Inpatient",
        medications: new Map(),
      })
    }

    const patient = map.get(patientKey)
    const medKey =
      med.prescription_item_id ??
      `${med.medicine_name || med.medication_name || "Med"}-${med.id}`

    if (!patient.medications.has(medKey)) {
      patient.medications.set(medKey, {
        medicine_name:
          med.medicine_name || med.medication_name || med.drug_name || "Medication",
        dose: med.dosage || med.dose || "Dose unstated",
        route: med.route || "Oral",
        frequency: med.frequency || "Daily",
        is_stat: Boolean(med.is_stat),
        schedules: [],
      })
    }

    const medicine = patient.medications.get(medKey)
    if (Boolean(med.is_stat)) {
      medicine.is_stat = true
    }
    medicine.schedules.push(med)
  })

  return Array.from(map.values()).map((p) => ({
    ...p,
    medications: Array.from(p.medications.values()),
  }))
}

export default function NurseDashboard() {
  const navigate = useNavigate()

  const [medications, setMedications] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [search, setSearch] = useState("")
  const [filterTab, setFilterTab] = useState("ALL") // ALL, DUE, OVERDUE, UPCOMING, STAT, ATTENTION, GIVEN
  const [expandedPatients, setExpandedPatients] = useState(new Set())
  const [showHistoryModal, setShowHistoryModal] = useState(false)
  const [historyList, setHistoryList] = useState([])
  const [historyLoading, setHistoryLoading] = useState(false)

  async function loadMedications() {
    setLoading(true)
    setError("")
    try {
      const response = await getNurseMedications()
      const data = Array.isArray(response) ? response : []
      const filtered = hideTestPatients(data)
      setMedications(filtered)

      // Auto-expand the first 2 patients for nurse convenience
      const groups = buildPatientGroups(filtered)
      if (groups.length > 0) {
        setExpandedPatients(new Set(groups.slice(0, 2).map((g) => g.patient_code)))
      }
    } catch (err) {
      setError(
        err?.response?.data?.detail || "Unable to retrieve nurse medication queue."
      )
    } finally {
      setLoading(false)
    }
  }

  async function loadHistory() {
    setHistoryLoading(true)
    try {
      const data = await getNurseMedicationHistory(50)
      setHistoryList(Array.isArray(data) ? data : [])
    } catch (err) {
      console.error("Failed to load history:", err)
    } finally {
      setHistoryLoading(false)
    }
  }

  useEffect(() => {
    loadMedications()
  }, [])

  function togglePatient(key) {
    setExpandedPatients((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  function expandAll() {
    setExpandedPatients(new Set(filteredGroups.map((g) => g.patient_code)))
  }

  function collapseAll() {
    setExpandedPatients(new Set())
  }

  // Aggregate Metrics
  const metrics = useMemo(() => {
    const total = medications.length
    const given = medications.filter((m) => {
      const s = String(m.monitoring_status || m.status || "").toUpperCase()
      return s === "GIVEN" || s === "GIVEN_ON_TIME" || s === "GIVEN_LATE"
    }).length
    const due = medications.filter(
      (m) => String(m.monitoring_status || "").toUpperCase() === "DUE"
    ).length
    const overdue = medications.filter((m) => {
      const s = String(m.monitoring_status || "").toUpperCase()
      return s === "OVERDUE" || s === "MISSED"
    }).length
    const upcoming = medications.filter((m) => {
      const s = String(m.monitoring_status || m.status || "").toUpperCase()
      return s === "UPCOMING"
    }).length
    const attention = medications.filter((m) => {
      const s = String(m.monitoring_status || m.status || "").toUpperCase()
      return (
        s === "DELAYED" ||
        s === "HELD" ||
        s === "REFUSED" ||
        s === "NOT_GIVEN" ||
        s === "NOT GIVEN" ||
        s === "OVERDUE" ||
        s === "MISSED"
      )
    }).length
    const statDoses = medications.filter((m) => Boolean(m.is_stat)).length
    const uniquePatients = new Set(
      medications.map((m) => m.patient_code || m.patient_id || m.patient_name)
    ).size

    return { total, given, due, overdue, upcoming, attention, statDoses, uniquePatients }
  }, [medications])

  // Filter and Search
  const filteredGroups = useMemo(() => {
    let result = buildPatientGroups(medications)

    // Search filter
    if (search.trim()) {
      const term = search.toLowerCase()
      result = result
        .map((patient) => {
          const matchPatient =
            patient.patient_name.toLowerCase().includes(term) ||
            patient.patient_code.toLowerCase().includes(term)

          const matchedMeds = patient.medications.filter((m) =>
            m.medicine_name.toLowerCase().includes(term)
          )

          if (matchPatient) return patient
          if (matchedMeds.length > 0) {
            return { ...patient, medications: matchedMeds }
          }
          return null
        })
        .filter(Boolean)
    }

    // Status Tab Filter
    if (filterTab !== "ALL") {
      result = result
        .map((patient) => {
          const matchedMeds = patient.medications
            .map((med) => {
              const matchedSchedules = med.schedules.filter((s) => {
                const mon = String(s.monitoring_status || "").toUpperCase()
                const st = normalizeStatus(s.status)
                if (filterTab === "DUE") return mon === "DUE"
                if (filterTab === "OVERDUE") return mon === "OVERDUE" || mon === "MISSED"
                if (filterTab === "UPCOMING") return mon === "UPCOMING" || st === "UPCOMING"
                if (filterTab === "STAT") return Boolean(s.is_stat)
                if (filterTab === "GIVEN") return mon.startsWith("GIVEN") || st === "GIVEN"
                if (filterTab === "ATTENTION")
                  return (
                    mon === "OVERDUE" ||
                    mon === "MISSED" ||
                    mon === "HELD" ||
                    mon === "REFUSED" ||
                    mon === "NOT_GIVEN" ||
                    st === "DELAYED" ||
                    st === "HELD" ||
                    st === "REFUSED" ||
                    st === "NOT GIVEN"
                  )
                return true
              })

              return matchedSchedules.length > 0
                ? { ...med, schedules: matchedSchedules }
                : null
            })
            .filter(Boolean)

          return matchedMeds.length > 0 ? { ...patient, medications: matchedMeds } : null
        })
        .filter(Boolean)
    }

    return result
  }, [medications, search, filterTab])

  return (
    <MainLayout
      title="Nurse Station"
      subtitle="Bedside medication administration rounds and patient safety tracking"
    >
      <div className="space-y-6">
        {/* Welcome & Quick Action Banner */}
        <div className="relative overflow-hidden bg-gradient-to-r from-sky-600 via-sky-700 to-indigo-800 rounded-3xl p-6 lg:p-8 text-white shadow-xl">
          <div className="absolute top-0 right-0 -mt-10 -mr-10 w-64 h-64 bg-white/10 rounded-full blur-2xl pointer-events-none" />
          <div className="relative z-10 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
            <div className="space-y-2 max-w-2xl">
              <div className="inline-flex items-center gap-2 px-3 py-1 bg-white/15 backdrop-blur-md rounded-full text-xs font-semibold text-sky-100">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                Active Shift · Ward Inpatient Medication Administration
              </div>
              <h1 className="text-2xl lg:text-3xl font-extrabold tracking-tight">
                Bedside Clinical Administration
              </h1>
              <p className="text-sky-100/90 text-sm leading-relaxed">
                Scan patient wristbands with QR verification, enforce Five-Rights safety
                checks, and record timely medication administration.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <Button
                variant="primary"
                icon={QrCode}
                className="bg-white text-sky-900 hover:bg-sky-50 shadow-md border-0 font-bold"
                onClick={() => navigate("/nurse/scanner")}
              >
                Scan Wristband QR
              </Button>
              <Button
                variant="outline"
                icon={History}
                className="border-white/30 text-white hover:bg-white/10 backdrop-blur-sm"
                onClick={() => {
                  setShowHistoryModal(true)
                  loadHistory()
                }}
              >
                Administration History
              </Button>
              <Button
                variant="outline"
                icon={RefreshCw}
                className="border-white/30 text-white hover:bg-white/10 backdrop-blur-sm"
                loading={loading}
                onClick={loadMedications}
              >
                Refresh Queue
              </Button>
            </div>
          </div>
        </div>

        {/* Global Error Banner */}
        {error && (
          <div className="flex items-center gap-3 p-4 bg-rose-50 border border-rose-200 rounded-2xl text-rose-700 text-sm">
            <AlertTriangle className="w-5 h-5 shrink-0 text-rose-600" />
            <div className="flex-1 font-medium">{error}</div>
            <Button size="sm" variant="outline" onClick={loadMedications}>
              Retry
            </Button>
          </div>
        )}

        {/* Overdue Notification Banner */}
        {metrics.overdue > 0 && (
          <div className="p-4 bg-gradient-to-r from-rose-500/15 via-rose-500/5 to-transparent border-l-4 border-rose-600 rounded-r-2xl flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-rose-600 text-white flex items-center justify-center shadow-sm">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-slate-900">
                  {metrics.overdue} Overdue / Missed Medication Dose(s) Alert
                </h4>
                <p className="text-xs text-slate-600">
                  Scheduled administration window has elapsed. Please administer or document clinical rationale.
                </p>
              </div>
            </div>
            <Button
              size="sm"
              variant="danger"
              onClick={() => setFilterTab("OVERDUE")}
            >
              View Overdue Doses
            </Button>
          </div>
        )}

        {/* STAT Urgency Alert Banner (if any) */}
        {metrics.statDoses > 0 && (
          <div className="p-4 bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-transparent border-l-4 border-amber-500 rounded-r-2xl flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-amber-500 text-white flex items-center justify-center shadow-sm">
                <Zap className="w-5 h-5 fill-current" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-slate-900">
                  {metrics.statDoses} Priority / STAT Doses Pending
                </h4>
                <p className="text-xs text-slate-600">
                  Urgent physician orders requiring immediate administration.
                </p>
              </div>
            </div>
            <Button
              size="sm"
              variant="outline"
              className="border-amber-300 text-amber-900 hover:bg-amber-100/50"
              onClick={() => setFilterTab("STAT")}
            >
              Filter STAT Doses
            </Button>
          </div>
        )}

        {/* KPI Metrics Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-6 gap-3">
          <StatCard
            title="Assigned Patients"
            value={metrics.uniquePatients}
            subtitle="Active Inpatients"
            icon={Users}
            color="sky"
          />
          <StatCard
            title="Scheduled Doses"
            value={metrics.total}
            subtitle="Total doses today"
            icon={Pill}
            color="indigo"
          />
          <StatCard
            title="Due Now"
            value={metrics.due}
            subtitle="Active window"
            icon={Clock3}
            color={metrics.due > 0 ? "sky" : "slate"}
          />
          <StatCard
            title="Overdue Doses"
            value={metrics.overdue}
            subtitle="Past grace window"
            icon={AlertTriangle}
            color={metrics.overdue > 0 ? "rose" : "slate"}
          />
          <StatCard
            title="Administered"
            value={metrics.given}
            subtitle="Completed doses"
            icon={CheckCircle2}
            color="emerald"
          />
          <StatCard
            title="Action Needed"
            value={metrics.attention}
            subtitle="Delayed / Held / Refused"
            icon={ShieldAlert}
            color={metrics.attention > 0 ? "amber" : "slate"}
          />
        </div>

        {/* Patient Queue Controls */}
        <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-sm space-y-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
            {/* Search Input */}
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search by patient name, ID, or medicine..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-10 pr-4 py-2 text-sm text-slate-800 placeholder-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 transition-all"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400 hover:text-slate-600"
                >
                  Clear
                </button>
              )}
            </div>

            {/* Quick Expand/Collapse */}
            <div className="flex items-center gap-2 shrink-0">
              <Button size="sm" variant="ghost" onClick={expandAll}>
                Expand All
              </Button>
              <span className="text-slate-200">|</span>
              <Button size="sm" variant="ghost" onClick={collapseAll}>
                Collapse All
              </Button>
            </div>
          </div>

          {/* Status Tabs */}
          <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-100">
            <span className="text-xs font-semibold text-slate-400 mr-1 flex items-center gap-1">
              <Filter className="w-3.5 h-3.5" /> Rounds Filter:
            </span>
            {[
              { id: "ALL", label: "All Schedules", count: metrics.total },
              { id: "DUE", label: "Due Now", count: metrics.due },
              { id: "OVERDUE", label: "Overdue / Missed", count: metrics.overdue },
              { id: "UPCOMING", label: "Upcoming", count: metrics.upcoming },
              { id: "STAT", label: "STAT Urgent", count: metrics.statDoses },
              { id: "ATTENTION", label: "Attention Needed", count: metrics.attention },
              { id: "GIVEN", label: "Administered", count: metrics.given },
            ].map((tab) => {
              const active = filterTab === tab.id
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setFilterTab(tab.id)}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                    active
                      ? "bg-sky-600 text-white shadow-sm"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200/70"
                  }`}
                >
                  <span>{tab.label}</span>
                  <span
                    className={`px-1.5 py-0.5 rounded-full text-[10px] ${
                      active ? "bg-white/20 text-white" : "bg-white text-slate-700"
                    }`}
                  >
                    {tab.count}
                  </span>
                </button>
              )
            })}
          </div>
        </div>

        {/* Medication Patient Queue List */}
        {loading ? (
          <Loading message="Loading assigned patient schedules and verification orders..." />
        ) : filteredGroups.length === 0 ? (
          <EmptyState
            icon={Pill}
            title="No Medication Schedules Found"
            description={
              search || filterTab !== "ALL"
                ? "No patients match your current search and filter criteria."
                : "No active medication administration schedules are currently queued for your shift."
            }
            actionLabel={search || filterTab !== "ALL" ? "Clear Filters" : "Refresh Queue"}
            onAction={() => {
              setSearch("")
              setFilterTab("ALL")
              loadMedications()
            }}
          />
        ) : (
          <div className="space-y-4">
            {filteredGroups.map((patient) => {
              const isExpanded = expandedPatients.has(patient.patient_code)
              const totalDoses = patient.medications.reduce(
                (acc, m) => acc + m.schedules.length,
                0
              )
              const hasStat = patient.medications.some((m) => m.is_stat)

              return (
                <div
                  key={patient.patient_code}
                  className="bg-white border border-slate-200/90 rounded-2xl overflow-hidden shadow-sm transition-all hover:border-slate-300"
                >
                  {/* Patient Accordion Header */}
                  <div
                    onClick={() => togglePatient(patient.patient_code)}
                    className="p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 cursor-pointer select-none bg-slate-50/60 hover:bg-slate-50 transition-colors"
                  >
                    <div className="flex items-center gap-3.5">
                      <div className="w-11 h-11 rounded-2xl bg-sky-100 text-sky-700 flex items-center justify-center font-bold text-sm shadow-xs shrink-0">
                        <User className="w-5 h-5" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="text-base font-bold text-slate-900">
                            {patient.patient_name}
                          </h3>
                          {hasStat && (
                            <Badge variant="warning" size="sm">
                              STAT ORDER
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-3 text-xs text-slate-500 mt-0.5">
                          <span>
                            ID:{" "}
                            <strong className="text-slate-700 font-mono">
                              {patient.patient_code}
                            </strong>
                          </span>
                          <span>•</span>
                          <span>
                            <strong>{patient.medications.length}</strong> Prescribed Drug(s)
                          </span>
                          <span>•</span>
                          <span>
                            <strong>{totalDoses}</strong> Scheduled Dose(s)
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <Button
                        size="sm"
                        variant="primary"
                        icon={QrCode}
                        onClick={(e) => {
                          e.stopPropagation()
                          navigate(`/nurse/scanner?patient=${patient.patient_id}`)
                        }}
                      >
                        Verify Wristband
                      </Button>

                      <div className="w-8 h-8 rounded-xl bg-white border border-slate-200 flex items-center justify-center text-slate-500">
                        <ChevronDown
                          className={`w-4 h-4 transition-transform duration-200 ${
                            isExpanded ? "rotate-180" : ""
                          }`}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Expanded Medication List */}
                  {isExpanded && (
                    <div className="p-5 border-t border-slate-100 space-y-4 bg-white">
                      {patient.medications.map((med, idx) => (
                        <div
                          key={idx}
                          className="rounded-2xl border border-slate-200/80 bg-slate-50/30 p-4 space-y-3"
                        >
                          {/* Medicine Header */}
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
                            <div className="flex items-center gap-2.5">
                              <div className="w-8 h-8 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center">
                                <Pill className="w-4 h-4" />
                              </div>
                              <div>
                                <h4 className="text-sm font-bold text-slate-900">
                                  {med.medicine_name}
                                </h4>
                                <p className="text-xs text-slate-500">
                                  {med.dose} · {med.route} · {med.frequency}
                                </p>
                              </div>
                            </div>

                            {med.is_stat && (
                              <Badge variant="warning" size="sm">
                                <Zap className="w-3 h-3 mr-1 fill-current" /> STAT
                              </Badge>
                            )}
                          </div>

                          {/* Dosing Schedule Items */}
                          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 pt-1">
                            {med.schedules.map((schedule) => (
                              <div
                                key={schedule.id}
                                className="bg-white border border-slate-200 rounded-xl p-3.5 shadow-2xs flex items-center justify-between gap-3 hover:border-sky-300 transition-all"
                              >
                                <div className="space-y-1">
                                  <div className="flex items-center gap-1.5 text-xs text-slate-600">
                                    <Clock className="w-3.5 h-3.5 text-slate-400" />
                                    <span className="font-bold text-slate-900">
                                      {formatTime(schedule.scheduled_time)}
                                    </span>
                                    <span className="text-slate-400">·</span>
                                    <span>{formatDate(schedule.scheduled_date)}</span>
                                  </div>
                                  <div className="flex flex-wrap items-center gap-1.5">
                                    <Badge
                                      variant={getStatusBadgeVariant(
                                        schedule.monitoring_status || schedule.status,
                                      )}
                                      size="sm"
                                    >
                                      {normalizeStatus(
                                        schedule.monitoring_status || schedule.status,
                                      )}
                                    </Badge>
                                    {schedule.delay_minutes > 0 &&
                                      (schedule.monitoring_status === "GIVEN_LATE" ||
                                        schedule.monitoring_status === "OVERDUE" ||
                                        schedule.monitoring_status === "MISSED") && (
                                        <span className="text-[10px] font-bold text-rose-600">
                                          +{schedule.delay_minutes}m late
                                        </span>
                                      )}
                                    {schedule.is_assigned === false && (
                                      <span className="text-[9px] font-bold bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded">
                                        Covering RN
                                      </span>
                                    )}
                                  </div>
                                </div>

                                <Button
                                  size="sm"
                                  variant={
                                    schedule.monitoring_status === "DUE" ||
                                    schedule.monitoring_status === "OVERDUE" ||
                                    normalizeStatus(schedule.status) === "UPCOMING"
                                      ? "primary"
                                      : "outline"
                                  }
                                  onClick={() =>
                                    navigate(`/nurse/medications/${schedule.id}`)
                                  }
                                >
                                  {schedule.monitoring_status === "DUE" ||
                                  schedule.monitoring_status === "OVERDUE" ||
                                  normalizeStatus(schedule.status) === "UPCOMING"
                                    ? "Administer"
                                    : "View"}
                                </Button>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}

        {/* MODAL: Shift Medication Administration History */}
        <Modal
          open={showHistoryModal}
          onClose={() => setShowHistoryModal(false)}
          title="Shift Medication Administration History"
          subtitle="Recent bedside administrations recorded during your current active session"
          maxWidth="max-w-4xl"
        >
          {historyLoading ? (
            <div className="p-8">
              <Loading message="Fetching recent shift administrations..." />
            </div>
          ) : historyList.length === 0 ? (
            <div className="p-8 text-center text-slate-500 text-sm">
              No medication administrations recorded yet in this shift.
            </div>
          ) : (
            <div className="overflow-x-auto text-xs">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold text-slate-500 uppercase">
                    <th className="p-3">Time</th>
                    <th className="p-3">Patient</th>
                    <th className="p-3">Medication</th>
                    <th className="p-3">Status</th>
                    <th className="p-3">Accountability</th>
                    <th className="p-3">Notes</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {historyList.map((item) => (
                    <tr key={item.id} className="hover:bg-slate-50">
                      <td className="p-3 font-semibold text-slate-700 whitespace-nowrap">
                        {item.administered_at
                          ? new Date(item.administered_at).toLocaleTimeString([], {
                              hour: "2-digit",
                              minute: "2-digit",
                            })
                          : "—"}
                      </td>
                      <td className="p-3">
                        <div className="font-bold text-slate-900">
                          {item.patient_name || `#${item.patient_id}`}
                        </div>
                        <div className="text-[10px] text-slate-400 font-mono">
                          {item.patient_code}
                        </div>
                      </td>
                      <td className="p-3">
                        <div className="font-bold text-slate-900">{item.medicine_name}</div>
                        <div className="text-[10px] text-slate-500">{item.dosage}</div>
                      </td>
                      <td className="p-3">
                        <Badge variant={getStatusBadgeVariant(item.status)} size="sm">
                          {item.status}
                        </Badge>
                      </td>
                      <td className="p-3">
                        <div className="font-medium text-slate-800">{item.nurse_name}</div>
                        {item.is_override && (
                          <span className="inline-block mt-0.5 text-[9px] font-bold bg-amber-100 text-amber-800 px-1 py-0.2 rounded">
                            OVERRIDE: {item.override_reason || "Covering Nurse"}
                          </span>
                        )}
                      </td>
                      <td className="p-3 text-slate-600 max-w-xs truncate">
                        {item.notes || "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Modal>
      </div>
    </MainLayout>
  )
}