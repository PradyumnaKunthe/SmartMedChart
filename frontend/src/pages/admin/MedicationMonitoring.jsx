import React, { useEffect, useMemo, useState } from "react"
import {
  Activity,
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  Award,
  Bell,
  Building2,
  Calendar,
  CheckCircle2,
  ChevronDown,
  Clock,
  Clock3,
  ExternalLink,
  Eye,
  Filter,
  Info,
  Layers,
  Pill,
  QrCode,
  RefreshCw,
  Search,
  ShieldAlert,
  ShieldCheck,
  TrendingUp,
  User,
  UserCheck,
  Users,
  X,
  Zap,
} from "lucide-react"

import MainLayout from "../../components/layout/MainLayout"
import Card, { CardHeader } from "../../components/common/Card"
import StatCard from "../../components/dashboard/StatCard"
import Badge from "../../components/common/Badge"
import Button from "../../components/common/Button"
import Modal from "../../components/common/Modal"
import Loading from "../../components/common/Loading"
import EmptyState from "../../components/common/EmptyState"
import ErrorState from "../../components/common/ErrorState"
import {
  getMonitoringDashboard,
  getComplianceReports,
  getMonitoringAlerts,
  acknowledgeAlert,
  getHospitalPolicy,
} from "../../services/monitoring"

function formatDateTime(isoString) {
  if (!isoString) return "—"
  const date = new Date(isoString)
  if (Number.isNaN(date.getTime())) return isoString
  return new Intl.DateTimeFormat("en-IN", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date)
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

function getMonitoringBadge(status) {
  const norm = String(status || "").toUpperCase()
  switch (norm) {
    case "GIVEN_ON_TIME":
      return { variant: "success", label: "On Time", icon: CheckCircle2 }
    case "GIVEN_LATE":
      return { variant: "warning", label: "Given Late", icon: Clock }
    case "DUE":
      return { variant: "primary", label: "Due Now", icon: Clock3 }
    case "OVERDUE":
      return { variant: "danger", label: "Overdue", icon: AlertTriangle }
    case "MISSED":
      return { variant: "danger", label: "Missed Dose", icon: AlertCircle }
    case "HELD":
      return { variant: "neutral", label: "Held by MD/RN", icon: Info }
    case "REFUSED":
      return { variant: "danger", label: "Patient Refused", icon: X }
    case "NOT_GIVEN":
      return { variant: "neutral", label: "Not Administered", icon: X }
    case "UPCOMING":
    default:
      return { variant: "neutral", label: "Upcoming", icon: Clock3 }
  }
}

export default function MedicationMonitoring() {
  const [activeTab, setActiveTab] = useState("roster") // "roster", "alerts", "reports"
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [refreshing, setRefreshing] = useState(false)

  // Dashboard Data
  const [summary, setSummary] = useState({
    total_schedules: 0,
    upcoming: 0,
    due: 0,
    given_on_time: 0,
    given_late: 0,
    overdue: 0,
    missed: 0,
    held: 0,
    refused: 0,
    not_given: 0,
    override_administrations: 0,
    on_time_rate: 0,
    compliance_rate: 0,
  })
  const [items, setItems] = useState([])
  const [filterOptions, setFilterOptions] = useState({ wards: [], nurses: [], patients: [] })
  const [activeAlertsCount, setActiveAlertsCount] = useState(0)
  const [policy, setPolicy] = useState(null)

  // Reports Data
  const [reports, setReports] = useState(null)
  const [reportsLoading, setReportsLoading] = useState(false)

  // Alerts Data
  const [alerts, setAlerts] = useState([])
  const [alertsLoading, setAlertsLoading] = useState(false)
  const [alertFilter, setAlertFilter] = useState("active") // "active", "acknowledged", "all"
  const [selectedAlertForAck, setSelectedAlertForAck] = useState(null)
  const [ackNote, setAckNote] = useState("")
  const [ackSubmitting, setAckSubmitting] = useState(false)

  // Override Detail Modal
  const [selectedOverrideItem, setSelectedOverrideItem] = useState(null)

  // Policy Modal
  const [showPolicyModal, setShowPolicyModal] = useState(false)

  // Filter States
  const [filterDate, setFilterDate] = useState(new Date().toISOString().slice(0, 10))
  const [filterSearch, setFilterSearch] = useState("")
  const [filterWard, setFilterWard] = useState("")
  const [filterNurse, setFilterNurse] = useState("")
  const [filterStatus, setFilterStatus] = useState("ALL")

  async function loadDashboardData() {
    try {
      setRefreshing(true)
      const params = {}
      if (filterDate) params.date = filterDate
      if (filterWard) params.ward = filterWard
      if (filterNurse) params.nurse_id = filterNurse
      if (filterStatus && filterStatus !== "ALL") params.status = filterStatus

      const data = await getMonitoringDashboard(params)
      setSummary(data.summary || {})
      setItems(data.items || [])
      setFilterOptions(data.filter_options || { wards: [], nurses: [], patients: [] })
      setActiveAlertsCount(data.active_alerts_count || 0)
      setPolicy(data.policy)
      setError("")
    } catch (err) {
      setError(err?.response?.data?.detail || "Failed to load medication monitoring dashboard.")
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  async function loadReportsData() {
    setReportsLoading(true)
    try {
      const data = await getComplianceReports()
      setReports(data)
    } catch (err) {
      console.error("Failed to load reports:", err)
    } finally {
      setReportsLoading(false)
    }
  }

  async function loadAlertsData() {
    setAlertsLoading(true)
    try {
      const params = {}
      if (alertFilter === "active") params.acknowledged = false
      if (alertFilter === "acknowledged") params.acknowledged = true
      const data = await getMonitoringAlerts(params)
      setAlerts(Array.isArray(data) ? data : [])
    } catch (err) {
      console.error("Failed to load alerts:", err)
    } finally {
      setAlertsLoading(false)
    }
  }

  useEffect(() => {
    loadDashboardData()
  }, [filterDate, filterWard, filterNurse, filterStatus])

  useEffect(() => {
    if (activeTab === "reports") {
      loadReportsData()
    } else if (activeTab === "alerts") {
      loadAlertsData()
    }
  }, [activeTab, alertFilter])

  // Client-side text search over patient name / code / medicine
  const filteredItems = useMemo(() => {
    if (!filterSearch.trim()) return items
    const q = filterSearch.toLowerCase()
    return items.filter(
      (it) =>
        (it.patient_name || "").toLowerCase().includes(q) ||
        (it.patient_code || "").toLowerCase().includes(q) ||
        (it.medicine_name || "").toLowerCase().includes(q) ||
        (it.ward || "").toLowerCase().includes(q) ||
        (it.nurse_name || "").toLowerCase().includes(q),
    )
  }, [items, filterSearch])

  async function handleAcknowledgeAlert() {
    if (!selectedAlertForAck) return
    setAckSubmitting(true)
    try {
      await acknowledgeAlert(selectedAlertForAck.id, { notes: ackNote.trim() || null })
      setSelectedAlertForAck(null)
      setAckNote("")
      loadAlertsData()
      loadDashboardData()
    } catch (err) {
      alert(err?.response?.data?.detail || "Failed to acknowledge alert.")
    } finally {
      setAckSubmitting(false)
    }
  }

  return (
    <MainLayout
      title="Medication Administration Monitoring"
      subtitle="Supervise bedside dose compliance, track administration delays, and audit nurse accountability"
    >
      <div className="space-y-6">
        {/* Top Action Bar */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-white border border-slate-200 rounded-3xl p-4 shadow-xs">
          {/* Navigation Pills */}
          <div className="flex items-center gap-1.5 p-1 bg-slate-100/80 rounded-2xl">
            <button
              onClick={() => setActiveTab("roster")}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                activeTab === "roster"
                  ? "bg-white text-slate-900 shadow-xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <div className="flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5" />
                <span>Dose Roster & Tracking</span>
                <span className="ml-1 px-1.5 py-0.5 rounded-full bg-slate-200 text-slate-700 text-[10px]">
                  {filteredItems.length}
                </span>
              </div>
            </button>

            <button
              onClick={() => setActiveTab("alerts")}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                activeTab === "alerts"
                  ? "bg-white text-slate-900 shadow-xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <div className="flex items-center gap-1.5">
                <Bell className="w-3.5 h-3.5" />
                <span>Overdue & Missed Alerts</span>
                {activeAlertsCount > 0 && (
                  <span className="ml-1 px-1.5 py-0.5 rounded-full bg-rose-500 text-white text-[10px] animate-pulse">
                    {activeAlertsCount}
                  </span>
                )}
              </div>
            </button>

            <button
              onClick={() => setActiveTab("reports")}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                activeTab === "reports"
                  ? "bg-white text-slate-900 shadow-xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <div className="flex items-center gap-1.5">
                <TrendingUp className="w-3.5 h-3.5" />
                <span>Compliance Analytics</span>
              </div>
            </button>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              icon={Info}
              onClick={() => setShowPolicyModal(true)}
              className="text-xs"
            >
              Hospital Policy
            </Button>
            <Button
              variant="outline"
              size="sm"
              icon={RefreshCw}
              loading={refreshing}
              onClick={() => {
                loadDashboardData()
                if (activeTab === "reports") loadReportsData()
                if (activeTab === "alerts") loadAlertsData()
              }}
              className="text-xs"
            >
              Sync
            </Button>
          </div>
        </div>

        {/* Active Alert Banner (if any overdue/missed alerts) */}
        {activeAlertsCount > 0 && activeTab !== "alerts" && (
          <div className="p-4 bg-gradient-to-r from-rose-50 to-amber-50 border border-rose-200 rounded-3xl flex items-center justify-between gap-4 shadow-xs">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-rose-500 text-white flex items-center justify-center shrink-0">
                <AlertCircle className="w-5 h-5 animate-bounce" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-rose-950">
                  {activeAlertsCount} Unacknowledged Clinical Administration Alerts
                </h4>
                <p className="text-xs text-rose-800">
                  Patients have overdue or missed doses that require supervisory review and clinical acknowledgement.
                </p>
              </div>
            </div>
            <Button
              variant="danger"
              size="sm"
              onClick={() => setActiveTab("alerts")}
              icon={ArrowRight}
              className="shrink-0 text-xs"
            >
              Review Alerts
            </Button>
          </div>
        )}

        {/* Monitoring Metrics Overview Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3">
          <div className="bg-white border border-slate-200 rounded-2xl p-3 shadow-xs">
            <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
              Total Doses
            </div>
            <div className="text-2xl font-black text-slate-900 mt-1">
              {summary.total_schedules || 0}
            </div>
            <div className="text-[10px] text-slate-400 mt-0.5">Scheduled for day</div>
          </div>

          <div className="bg-white border border-emerald-200 rounded-2xl p-3 shadow-xs bg-emerald-50/20">
            <div className="text-[11px] font-bold uppercase tracking-wider text-emerald-700">
              On-Time
            </div>
            <div className="text-2xl font-black text-emerald-700 mt-1">
              {summary.given_on_time || 0}
            </div>
            <div className="text-[10px] text-emerald-600 font-bold mt-0.5">
              {summary.on_time_rate || 0}% Rate
            </div>
          </div>

          <div className="bg-white border border-amber-200 rounded-2xl p-3 shadow-xs bg-amber-50/20">
            <div className="text-[11px] font-bold uppercase tracking-wider text-amber-700">
              Given Late
            </div>
            <div className="text-2xl font-black text-amber-700 mt-1">
              {summary.given_late || 0}
            </div>
            <div className="text-[10px] text-amber-600 mt-0.5">Delayed admin</div>
          </div>

          <div className="bg-white border border-rose-300 rounded-2xl p-3 shadow-xs bg-rose-50/30">
            <div className="text-[11px] font-bold uppercase tracking-wider text-rose-700">
              Overdue
            </div>
            <div className="text-2xl font-black text-rose-700 mt-1">
              {summary.overdue || 0}
            </div>
            <div className="text-[10px] text-rose-600 font-bold mt-0.5">Requires action</div>
          </div>

          <div className="bg-white border border-red-300 rounded-2xl p-3 shadow-xs bg-red-50/40">
            <div className="text-[11px] font-bold uppercase tracking-wider text-red-900">
              Missed
            </div>
            <div className="text-2xl font-black text-red-900 mt-1">
              {summary.missed || 0}
            </div>
            <div className="text-[10px] text-red-700 mt-0.5">Past deadline</div>
          </div>

          <div className="bg-white border border-sky-200 rounded-2xl p-3 shadow-xs bg-sky-50/20">
            <div className="text-[11px] font-bold uppercase tracking-wider text-sky-700">
              Due Now
            </div>
            <div className="text-2xl font-black text-sky-700 mt-1">
              {summary.due || 0}
            </div>
            <div className="text-[10px] text-sky-600 mt-0.5">Active window</div>
          </div>

          <div className="bg-white border border-purple-200 rounded-2xl p-3 shadow-xs bg-purple-50/20">
            <div className="text-[11px] font-bold uppercase tracking-wider text-purple-700">
              Held / Refused
            </div>
            <div className="text-2xl font-black text-purple-700 mt-1">
              {(summary.held || 0) + (summary.refused || 0) + (summary.not_given || 0)}
            </div>
            <div className="text-[10px] text-purple-600 mt-0.5">Clinical reason</div>
          </div>

          <div className="bg-white border border-indigo-200 rounded-2xl p-3 shadow-xs bg-indigo-50/20">
            <div className="text-[11px] font-bold uppercase tracking-wider text-indigo-700">
              Overrides
            </div>
            <div className="text-2xl font-black text-indigo-700 mt-1">
              {summary.override_administrations || 0}
            </div>
            <div className="text-[10px] text-indigo-600 mt-0.5">Covering nurse</div>
          </div>
        </div>

        {/* TAB 1: DOSE ROSTER & TRACKING */}
        {activeTab === "roster" && (
          <div className="space-y-4">
            {/* Filter Bar */}
            <div className="bg-white border border-slate-200 rounded-3xl p-4 shadow-xs space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
                {/* Search */}
                <div className="relative">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={filterSearch}
                    onChange={(e) => setFilterSearch(e.target.value)}
                    placeholder="Search patient, code, drug..."
                    className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 placeholder-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-500/20"
                  />
                </div>

                {/* Date */}
                <div className="relative">
                  <Calendar className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="date"
                    value={filterDate}
                    onChange={(e) => setFilterDate(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-500/20"
                  />
                </div>

                {/* Ward */}
                <div className="relative">
                  <Building2 className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <select
                    value={filterWard}
                    onChange={(e) => setFilterWard(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-500/20"
                  >
                    <option value="">All Wards & Units</option>
                    {filterOptions.wards?.map((w) => (
                      <option key={w} value={w}>
                        {w}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Nurse */}
                <div className="relative">
                  <User className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <select
                    value={filterNurse}
                    onChange={(e) => setFilterNurse(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-500/20"
                  >
                    <option value="">All Nurses</option>
                    {filterOptions.nurses?.map((n) => (
                      <option key={n.id} value={n.id}>
                        {n.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Status Filter Chips */}
              <div className="flex flex-wrap items-center gap-1.5 pt-1 border-t border-slate-100">
                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mr-1">
                  Status:
                </span>
                {[
                  { id: "ALL", label: "All Doses" },
                  { id: "DUE", label: "Due Now" },
                  { id: "OVERDUE", label: "Overdue" },
                  { id: "MISSED", label: "Missed" },
                  { id: "GIVEN_ON_TIME", label: "Given On Time" },
                  { id: "GIVEN_LATE", label: "Given Late" },
                  { id: "HELD", label: "Held / Refused" },
                  { id: "UPCOMING", label: "Upcoming" },
                ].map((s) => (
                  <button
                    key={s.id}
                    onClick={() => setFilterStatus(s.id)}
                    className={`px-3 py-1 rounded-xl text-xs font-bold transition-all ${
                      filterStatus === s.id
                        ? "bg-slate-900 text-white shadow-xs"
                        : "bg-slate-100 text-slate-600 hover:bg-slate-200/80"
                    }`}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Roster Table */}
            <div className="bg-white border border-slate-200 rounded-3xl overflow-hidden shadow-xs">
              {loading ? (
                <div className="p-12">
                  <Loading message="Syncing dose schedules and administration timestamps..." />
                </div>
              ) : filteredItems.length === 0 ? (
                <div className="p-12">
                  <EmptyState
                    title="No Medication Doses Found"
                    description="No doses match the selected date, ward, nurse, or monitoring status filters."
                    action={
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setFilterSearch("")
                          setFilterWard("")
                          setFilterNurse("")
                          setFilterStatus("ALL")
                        }}
                      >
                        Reset Filters
                      </Button>
                    }
                  />
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50/80 border-b border-slate-200 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                        <th className="py-3.5 px-4">Scheduled Dose</th>
                        <th className="py-3.5 px-4">Patient & Location</th>
                        <th className="py-3.5 px-4">Monitoring Status</th>
                        <th className="py-3.5 px-4">Administered Time</th>
                        <th className="py-3.5 px-4">Administered By</th>
                        <th className="py-3.5 px-4">Assigned Nurse</th>
                        <th className="py-3.5 px-4">Verification & Notes</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-xs">
                      {filteredItems.map((item) => {
                        const badge = getMonitoringBadge(item.monitoring_status)
                        const Icon = badge.icon
                        const isLate =
                          item.monitoring_status === "GIVEN_LATE" ||
                          item.monitoring_status === "OVERDUE" ||
                          item.monitoring_status === "MISSED"

                        return (
                          <tr
                            key={item.schedule_id}
                            className="hover:bg-slate-50/70 transition-colors"
                          >
                            {/* Dose Info */}
                            <td className="py-3 px-4">
                              <div className="flex items-center gap-2.5">
                                <div className="w-8 h-8 rounded-xl bg-sky-100 text-sky-700 flex items-center justify-center shrink-0">
                                  <Pill className="w-4 h-4" />
                                </div>
                                <div>
                                  <div className="font-bold text-slate-900 flex items-center gap-1.5">
                                    <span>{item.medicine_name}</span>
                                    {item.is_stat && (
                                      <span className="px-1.5 py-0.2 rounded bg-amber-100 text-amber-800 text-[9px] font-extrabold uppercase">
                                        STAT
                                      </span>
                                    )}
                                  </div>
                                  <div className="text-[11px] text-slate-500">
                                    {item.dosage} · {item.route || "Oral"} · Scheduled:{" "}
                                    <strong className="text-slate-800">
                                      {formatTime(item.scheduled_time)}
                                    </strong>
                                  </div>
                                </div>
                              </div>
                            </td>

                            {/* Patient & Ward */}
                            <td className="py-3 px-4">
                              <div className="font-bold text-slate-900">
                                {item.patient_name || "Unknown Patient"}
                              </div>
                              <div className="text-[11px] text-slate-500 font-mono">
                                {item.patient_code} · {item.ward || "General Ward"} · Bed{" "}
                                {item.bed_number || "—"}
                              </div>
                            </td>

                            {/* Monitoring Status Badge */}
                            <td className="py-3 px-4">
                              <div className="space-y-1">
                                <Badge variant={badge.variant} size="sm">
                                  <Icon className="w-3 h-3 mr-1" />
                                  {badge.label}
                                </Badge>
                                {item.delay_minutes > 0 && isLate && (
                                  <div className="text-[10px] font-bold text-rose-600 flex items-center gap-1">
                                    <Clock className="w-3 h-3" />+{item.delay_minutes} min delay
                                  </div>
                                )}
                              </div>
                            </td>

                            {/* Actual Time */}
                            <td className="py-3 px-4">
                              {item.administered_at ? (
                                <div>
                                  <div className="font-bold text-slate-800">
                                    {formatDateTime(item.administered_at)}
                                  </div>
                                  <div className="text-[10px] text-slate-400">Recorded in EMR</div>
                                </div>
                              ) : (
                                <span className="text-slate-400 italic">Not Administered</span>
                              )}
                            </td>

                            {/* Administered Nurse & Override Tag */}
                            <td className="py-3 px-4">
                              {item.administered_by ? (
                                <div className="space-y-1">
                                  <div className="font-bold text-slate-900 flex items-center gap-1">
                                    <UserCheck className="w-3.5 h-3.5 text-emerald-600" />
                                    <span>{item.nurse_name || `Nurse #${item.administered_by}`}</span>
                                  </div>

                                  {item.is_override && (
                                    <button
                                      onClick={() => setSelectedOverrideItem(item)}
                                      className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-amber-100 text-amber-900 text-[10px] font-bold hover:bg-amber-200 transition"
                                      title="View Assignment Override Justification"
                                    >
                                      <span>OVERRIDE</span>
                                      <Info className="w-2.5 h-2.5" />
                                    </button>
                                  )}
                                </div>
                              ) : (
                                <span className="text-slate-400 italic">—</span>
                              )}
                            </td>

                            {/* Assigned Nurse */}
                            <td className="py-3 px-4">
                              <div className="text-slate-700">
                                {item.assigned_nurse_name ? (
                                  <span className="font-medium">{item.assigned_nurse_name}</span>
                                ) : (
                                  <span className="text-slate-400 italic">Unassigned</span>
                                )}
                              </div>
                            </td>

                            {/* QR & Clinical Notes */}
                            <td className="py-3 px-4">
                              <div className="space-y-0.5">
                                <div className="flex items-center gap-1">
                                  {item.qr_verified ? (
                                    <span className="inline-flex items-center gap-0.5 text-[10px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                                      <QrCode className="w-2.5 h-2.5" /> QR Verified
                                    </span>
                                  ) : (
                                    <span className="text-[10px] text-slate-400">
                                      Manual / Pre-admin
                                    </span>
                                  )}
                                </div>
                                {item.notes && (
                                  <div
                                    className="text-[11px] text-slate-600 truncate max-w-xs"
                                    title={item.notes}
                                  >
                                    "{item.notes}"
                                  </div>
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
            </div>
          </div>
        )}

        {/* TAB 2: SUPERVISOR ALERTS & REVIEW */}
        {activeTab === "alerts" && (
          <div className="space-y-4">
            {/* Alert Filter Pill Bar */}
            <div className="flex items-center justify-between bg-white border border-slate-200 rounded-3xl p-4 shadow-xs">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider mr-2">
                  Show:
                </span>
                {[
                  { id: "active", label: "Active Unacknowledged" },
                  { id: "acknowledged", label: "Acknowledged Archive" },
                  { id: "all", label: "All Alerts" },
                ].map((af) => (
                  <button
                    key={af.id}
                    onClick={() => setAlertFilter(af.id)}
                    className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
                      alertFilter === af.id
                        ? "bg-slate-900 text-white shadow-xs"
                        : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                    }`}
                  >
                    {af.label}
                  </button>
                ))}
              </div>

              <div className="text-xs text-slate-500">
                {alerts.length} {alertFilter} alert(s)
              </div>
            </div>

            {alertsLoading ? (
              <div className="bg-white border border-slate-200 rounded-3xl p-12 shadow-xs">
                <Loading message="Scanning hospital medication alert logs..." />
              </div>
            ) : alerts.length === 0 ? (
              <div className="bg-white border border-slate-200 rounded-3xl p-12 shadow-xs">
                <EmptyState
                  title="No Clinical Administration Alerts"
                  description="All scheduled doses are currently administered within hospital windows or acknowledged."
                />
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {alerts.map((al) => {
                  const isCritical = al.severity === "CRITICAL" || al.alert_type === "MISSED"

                  return (
                    <div
                      key={al.id}
                      className={`p-5 rounded-3xl border transition-all shadow-xs ${
                        isCritical
                          ? "bg-rose-50/40 border-rose-200"
                          : "bg-amber-50/40 border-amber-200"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-start gap-3">
                          <div
                            className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 ${
                              isCritical ? "bg-rose-500 text-white" : "bg-amber-500 text-white"
                            }`}
                          >
                            {isCritical ? (
                              <AlertCircle className="w-5 h-5" />
                            ) : (
                              <AlertTriangle className="w-5 h-5" />
                            )}
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <span
                                className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full ${
                                  isCritical
                                    ? "bg-rose-200 text-rose-900"
                                    : "bg-amber-200 text-amber-900"
                                }`}
                              >
                                {al.alert_type} ALERT
                              </span>
                              <span className="text-xs text-slate-500 font-mono">
                                #{al.id} · {al.ward || "General Ward"}
                              </span>
                            </div>
                            <h4 className="text-base font-bold text-slate-900 mt-1">
                              {al.medicine_name} — {al.patient_name}
                            </h4>
                            <p className="text-xs text-slate-600 mt-0.5">
                              Scheduled for {formatTime(al.scheduled_time)}. Dose is currently{" "}
                              <strong className="text-rose-700">+{al.delay_minutes} min</strong> past
                              window.
                            </p>
                          </div>
                        </div>

                        {al.acknowledged ? (
                          <span className="px-2.5 py-1 rounded-xl bg-emerald-100 text-emerald-800 text-[10px] font-bold shrink-0 flex items-center gap-1">
                            <CheckCircle2 className="w-3 h-3" /> Acknowledged
                          </span>
                        ) : (
                          <Button
                            variant="danger"
                            size="sm"
                            onClick={() => {
                              setSelectedAlertForAck(al)
                              setAckNote("")
                            }}
                            className="text-xs shrink-0"
                          >
                            Acknowledge
                          </Button>
                        )}
                      </div>

                      {/* Acknowledgement Footnote */}
                      {al.acknowledged && (
                        <div className="mt-3 pt-3 border-t border-slate-200/80 text-[11px] text-slate-500 flex items-center justify-between">
                          <span>
                            Reviewed by <strong>{al.acknowledged_by || "Supervisor"}</strong> on{" "}
                            {formatDateTime(al.acknowledged_at)}
                          </span>
                          {al.notes && (
                            <span className="italic text-slate-600">"{al.notes}"</span>
                          )}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {/* TAB 3: COMPLIANCE ANALYTICS & REPORTS */}
        {activeTab === "reports" && (
          <div className="space-y-6">
            {reportsLoading ? (
              <div className="bg-white border border-slate-200 rounded-3xl p-12 shadow-xs">
                <Loading message="Aggregating hospital compliance and nurse accountability statistics..." />
              </div>
            ) : reports ? (
              <>
                {/* Compliance Big Metrics */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div className="bg-white border border-emerald-200 rounded-3xl p-6 shadow-xs flex items-center gap-4">
                    <div className="w-14 h-14 rounded-2xl bg-emerald-100 text-emerald-600 flex items-center justify-center shrink-0">
                      <Award className="w-8 h-8" />
                    </div>
                    <div>
                      <div className="text-xs font-bold uppercase tracking-wider text-slate-500">
                        Overall On-Time Rate
                      </div>
                      <div className="text-3xl font-black text-emerald-700 mt-1">
                        {reports.compliance_summary?.on_time_percentage || 0}%
                      </div>
                      <div className="text-xs text-slate-500 mt-0.5">
                        {reports.compliance_summary?.given_on_time || 0} of{" "}
                        {reports.compliance_summary?.total_administered || 0} doses
                      </div>
                    </div>
                  </div>

                  <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-xs flex items-center gap-4">
                    <div className="w-14 h-14 rounded-2xl bg-sky-100 text-sky-600 flex items-center justify-center shrink-0">
                      <ShieldCheck className="w-8 h-8" />
                    </div>
                    <div>
                      <div className="text-xs font-bold uppercase tracking-wider text-slate-500">
                        Clinical Compliance
                      </div>
                      <div className="text-3xl font-black text-slate-900 mt-1">
                        {reports.compliance_summary?.compliance_percentage || 0}%
                      </div>
                      <div className="text-xs text-slate-500 mt-0.5">
                        Accounts for held/refused doses
                      </div>
                    </div>
                  </div>

                  <div className="bg-white border border-amber-200 rounded-3xl p-6 shadow-xs flex items-center gap-4">
                    <div className="w-14 h-14 rounded-2xl bg-amber-100 text-amber-600 flex items-center justify-center shrink-0">
                      <Clock className="w-8 h-8" />
                    </div>
                    <div>
                      <div className="text-xs font-bold uppercase tracking-wider text-slate-500">
                        Delayed Administrations
                      </div>
                      <div className="text-3xl font-black text-amber-700 mt-1">
                        {reports.compliance_summary?.given_late || 0}
                      </div>
                      <div className="text-xs text-slate-500 mt-0.5">Exceeded grace window</div>
                    </div>
                  </div>

                  <div className="bg-white border border-indigo-200 rounded-3xl p-6 shadow-xs flex items-center gap-4">
                    <div className="w-14 h-14 rounded-2xl bg-indigo-100 text-indigo-600 flex items-center justify-center shrink-0">
                      <Users className="w-8 h-8" />
                    </div>
                    <div>
                      <div className="text-xs font-bold uppercase tracking-wider text-slate-500">
                        Assignment Overrides
                      </div>
                      <div className="text-3xl font-black text-indigo-700 mt-1">
                        {reports.compliance_summary?.total_overrides || 0}
                      </div>
                      <div className="text-xs text-slate-500 mt-0.5">Cross-nurse coverage</div>
                    </div>
                  </div>
                </div>

                {/* Two Column Tables: By Nurse and By Ward */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Nurse Accountability Table */}
                  <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-xs space-y-4">
                    <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                      <div>
                        <h3 className="font-bold text-base text-slate-900">
                          Medication Administration by Nurse
                        </h3>
                        <p className="text-xs text-slate-500">
                          Accountability logs per administering clinical staff
                        </p>
                      </div>
                      <Badge variant="primary" size="sm">
                        {reports.by_nurse?.length || 0} Nurses
                      </Badge>
                    </div>

                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse text-xs">
                        <thead>
                          <tr className="bg-slate-50 text-[11px] font-bold text-slate-500 uppercase">
                            <th className="p-3">Nurse Name</th>
                            <th className="p-3">Total Admin</th>
                            <th className="p-3">On-Time</th>
                            <th className="p-3">Late</th>
                            <th className="p-3">Overrides</th>
                            <th className="p-3 text-right">On-Time %</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {reports.by_nurse?.map((nr) => (
                            <tr key={nr.nurse_id} className="hover:bg-slate-50">
                              <td className="p-3 font-bold text-slate-900">{nr.nurse_name}</td>
                              <td className="p-3 font-semibold">{nr.total_administrations}</td>
                              <td className="p-3 text-emerald-700 font-bold">{nr.on_time}</td>
                              <td className="p-3 text-amber-700">{nr.late}</td>
                              <td className="p-3 text-indigo-700">
                                {nr.overrides_conducted > 0 ? (
                                  <span className="font-bold">{nr.overrides_conducted}</span>
                                ) : (
                                  "—"
                                )}
                              </td>
                              <td className="p-3 text-right">
                                <span className="font-bold text-slate-900">{nr.on_time_rate}%</span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Ward-wise Medication Compliance Table */}
                  <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-xs space-y-4">
                    <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                      <div>
                        <h3 className="font-bold text-base text-slate-900">
                          Ward-wise Medication Compliance
                        </h3>
                        <p className="text-xs text-slate-500">
                          Adherence breakdown by department / inpatient unit
                        </p>
                      </div>
                      <Badge variant="neutral" size="sm">
                        {reports.by_ward?.length || 0} Wards
                      </Badge>
                    </div>

                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse text-xs">
                        <thead>
                          <tr className="bg-slate-50 text-[11px] font-bold text-slate-500 uppercase">
                            <th className="p-3">Ward / Unit</th>
                            <th className="p-3">Scheduled</th>
                            <th className="p-3">On-Time</th>
                            <th className="p-3">Late</th>
                            <th className="p-3">Missed</th>
                            <th className="p-3 text-right">Compliance %</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {reports.by_ward?.map((wr) => (
                            <tr key={wr.ward} className="hover:bg-slate-50">
                              <td className="p-3 font-bold text-slate-900">{wr.ward}</td>
                              <td className="p-3 font-semibold">{wr.total_scheduled}</td>
                              <td className="p-3 text-emerald-700 font-bold">{wr.on_time}</td>
                              <td className="p-3 text-amber-700">{wr.late}</td>
                              <td className="p-3 text-rose-700 font-bold">{wr.missed}</td>
                              <td className="p-3 text-right">
                                <span className="font-bold text-slate-900">
                                  {wr.compliance_rate}%
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>

                {/* Audit Disclaimer Banner */}
                <div className="p-4 bg-slate-100 border border-slate-200 rounded-2xl flex items-start gap-3 text-xs text-slate-600">
                  <Info className="w-5 h-5 text-slate-400 shrink-0 mt-0.5" />
                  <div>
                    <strong className="text-slate-800">Clinical Audit Notice:</strong>{" "}
                    {reports.audit_disclaimer ||
                      "These statistics are generated from system logs for administrative workflow auditing. They do not constitute conclusive clinical performance evaluation without medical director review."}
                  </div>
                </div>
              </>
            ) : null}
          </div>
        )}

        {/* MODAL: Supervisor Alert Acknowledgement */}
        <Modal
          open={Boolean(selectedAlertForAck)}
          onClose={() => setSelectedAlertForAck(null)}
          title="Supervisor Alert Acknowledgement"
          subtitle={`Resolve alert #${selectedAlertForAck?.id} for ${selectedAlertForAck?.patient_name}`}
        >
          {selectedAlertForAck && (
            <div className="space-y-4">
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl text-xs space-y-1.5">
                <div>
                  <strong>Prescribed Drug:</strong> {selectedAlertForAck.medicine_name}
                </div>
                <div>
                  <strong>Patient:</strong> {selectedAlertForAck.patient_name} (
                  {selectedAlertForAck.ward})
                </div>
                <div>
                  <strong>Scheduled Dose:</strong> {formatTime(selectedAlertForAck.scheduled_time)}
                </div>
                <div>
                  <strong>Delay:</strong>{" "}
                  <span className="font-bold text-rose-600">
                    +{selectedAlertForAck.delay_minutes} minutes
                  </span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                  Clinical Action / Supervisory Resolution Notes
                </label>
                <textarea
                  rows={3}
                  value={ackNote}
                  onChange={(e) => setAckNote(e.target.value)}
                  placeholder="e.g. Spoke with bedside nurse; dose administered following emergency CT scan; order adjusted."
                  className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-3 text-xs text-slate-800 placeholder-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-500/20 resize-none"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setSelectedAlertForAck(null)}
                >
                  Cancel
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                  loading={ackSubmitting}
                  onClick={handleAcknowledgeAlert}
                >
                  Confirm Acknowledgement
                </Button>
              </div>
            </div>
          )}
        </Modal>

        {/* MODAL: Assignment Override Audit Details */}
        <Modal
          open={Boolean(selectedOverrideItem)}
          onClose={() => setSelectedOverrideItem(null)}
          title="Nurse Assignment Override Audit"
          subtitle={`Dose #${selectedOverrideItem?.schedule_id} · Covering Nurse Event Log`}
        >
          {selectedOverrideItem && (
            <div className="space-y-4 text-xs">
              <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl text-amber-950 space-y-2">
                <div className="flex items-center gap-2 font-bold text-sm text-amber-900">
                  <ShieldAlert className="w-4 h-4 text-amber-700" />
                  <span>Cross-Nurse Coverage Event</span>
                </div>
                <p>
                  This dose was administered by an authorized nurse who was not the primary nurse
                  assigned to this patient. The original patient assignment remains intact in the
                  system.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3 p-4 bg-slate-50 border border-slate-200 rounded-2xl">
                <div>
                  <span className="text-slate-400 text-[10px] uppercase font-bold">
                    Administering Nurse
                  </span>
                  <div className="font-bold text-slate-900 mt-0.5">
                    {selectedOverrideItem.nurse_name ||
                      `Nurse ID #${selectedOverrideItem.administered_by}`}
                  </div>
                </div>
                <div>
                  <span className="text-slate-400 text-[10px] uppercase font-bold">
                    Originally Assigned Nurse
                  </span>
                  <div className="font-bold text-slate-900 mt-0.5">
                    {selectedOverrideItem.assigned_nurse_name ||
                      `Nurse ID #${selectedOverrideItem.assigned_nurse_id}` ||
                      "Unassigned"}
                  </div>
                </div>
              </div>

              <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-1">
                <span className="text-slate-400 text-[10px] uppercase font-bold">
                  Documented Override Justification
                </span>
                <p className="font-medium text-slate-800 text-sm">
                  "{selectedOverrideItem.override_reason || "No explicit reason logged."}"
                </p>
              </div>

              <div className="flex justify-end pt-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setSelectedOverrideItem(null)}
                >
                  Close Audit View
                </Button>
              </div>
            </div>
          )}
        </Modal>

        {/* MODAL: Hospital Window Policy */}
        <Modal
          open={showPolicyModal}
          onClose={() => setShowPolicyModal(false)}
          title="Hospital Medication Administration Policy"
          subtitle="Configured clinical timeframes for administration compliance"
        >
          <div className="space-y-4 text-xs">
            <p className="text-slate-600">
              The Medication Administration Monitoring system automatically determines dose status
              by comparing the scheduled administration time against actual timestamps using the
              following institutional policy:
            </p>

            <div className="space-y-2.5">
              <div className="p-3.5 bg-emerald-50/70 border border-emerald-200 rounded-2xl flex items-start gap-3">
                <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                <div>
                  <strong className="text-emerald-950 font-bold block text-sm">
                    Approved Administration Window (On-Time)
                  </strong>
                  <span className="text-emerald-900/80">
                    From <strong>{policy?.grace_period_before_minutes ?? 30} minutes before</strong> to{" "}
                    <strong>{policy?.grace_period_after_minutes ?? 60} minutes after</strong> the scheduled
                    administration time.
                  </span>
                </div>
              </div>

              <div className="p-3.5 bg-amber-50/70 border border-amber-200 rounded-2xl flex items-start gap-3">
                <Clock className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <strong className="text-amber-950 font-bold block text-sm">
                    Delayed / Late Administration
                  </strong>
                  <span className="text-amber-900/80">
                    Administered after the {policy?.grace_period_after_minutes ?? 60}-minute grace
                    period, but before the missed cutoff deadline.
                  </span>
                </div>
              </div>

              <div className="p-3.5 bg-rose-50/70 border border-rose-200 rounded-2xl flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
                <div>
                  <strong className="text-rose-950 font-bold block text-sm">
                    Missed Dose Cutoff
                  </strong>
                  <span className="text-rose-900/80">
                    Past <strong>{policy?.missed_dose_cutoff_minutes ?? 240} minutes (4 hours)</strong>{" "}
                    without administration. Automatically marked as missed and generates a critical
                    alert.
                  </span>
                </div>
              </div>

              <div className="p-3.5 bg-indigo-50/70 border border-indigo-200 rounded-2xl flex items-start gap-3">
                <ShieldCheck className="w-5 h-5 text-indigo-600 shrink-0 mt-0.5" />
                <div>
                  <strong className="text-indigo-950 font-bold block text-sm">
                    Covering Nurse Accountability
                  </strong>
                  <span className="text-indigo-900/80">
                    Any nurse administering medication to a patient assigned to another nurse must
                    document a clinical override reason. Both nurse identities are permanently
                    logged.
                  </span>
                </div>
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <Button
                variant="primary"
                size="sm"
                onClick={() => setShowPolicyModal(false)}
              >
                Close Policy View
              </Button>
            </div>
          </div>
        </Modal>
      </div>
    </MainLayout>
  )
}
