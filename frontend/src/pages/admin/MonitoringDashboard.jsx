import {
  Activity,
  AlertTriangle,
  ArrowRight,
  BriefcaseBusiness,
  Building2,
  Calendar,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock3,
  Filter,
  RefreshCw,
  Search,
  ShieldCheck,
  Stethoscope,
  TrendingUp,
  UserCheck,
  UserRound,
  Users,
  X,
} from "lucide-react"
import { useEffect, useMemo, useState } from "react"
import MainLayout from "../../components/layout/MainLayout"
import StatCard from "../../components/dashboard/StatCard"
import Badge from "../../components/common/Badge"
import Button from "../../components/common/Button"
import Card, { CardHeader } from "../../components/common/Card"
import EmptyState from "../../components/common/EmptyState"
import ErrorState from "../../components/common/ErrorState"
import Loading from "../../components/common/Loading"
import {
  getDoctorWorkload,
  getNurseWorkload,
} from "../../services/admin"

// =========================================================
// HELPERS
// =========================================================

function formatDate(value) {
  if (!value) return "—"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "—"
  return new Intl.DateTimeFormat("en-IN", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date)
}

function getWorkloadStatus(count) {
  if (count === 0) return { label: "Idle / Available", variant: "neutral" }
  if (count <= 3) return { label: "Balanced", variant: "success" }
  if (count <= 6) return { label: "Moderate", variant: "warning" }
  return { label: "Heavy Workload", variant: "danger" }
}

// =========================================================
// STAFF CARD
// =========================================================

function StaffCard({ person, type, isSelected, onClick }) {
  const isNurse = type === "nurse"
  const patientCount = Number(person.patient_count || 0)
  const status = getWorkloadStatus(patientCount)

  const initials = (person.full_name || person.username || "U")
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase()

  return (
    <button
      type="button"
      onClick={onClick}
      className={`group w-full rounded-2xl border p-4.5 text-left transition-all duration-200 ${
        isSelected
          ? "border-sky-500 bg-sky-50/60 shadow-md ring-2 ring-sky-200/60"
          : "border-slate-200/90 bg-white hover:-translate-y-0.5 hover:border-sky-300 hover:shadow-md"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div
            className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl font-bold text-xs ${
              isNurse
                ? "bg-emerald-50 text-emerald-700 border border-emerald-100"
                : "bg-sky-50 text-sky-700 border border-sky-100"
            }`}
          >
            {initials}
          </div>

          <div className="min-w-0">
            <h4 className="font-heading font-bold text-slate-900 text-sm truncate group-hover:text-sky-700 transition-colors">
              {person.full_name}
            </h4>
            <p className="text-xs text-slate-400 truncate mt-0.5">
              ID: <span className="font-medium text-slate-600">{person.id}</span> · @{person.username}
            </p>
          </div>
        </div>

        <Badge variant={status.variant} size="sm">
          {status.label}
        </Badge>
      </div>

      <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
        <div className="flex items-center gap-1.5 text-slate-500 font-medium">
          <UserRound className="h-3.5 w-3.5 text-slate-400" />
          <span>Assigned Patients:</span>
          <span className="font-heading font-extrabold text-slate-900 text-sm">
            {patientCount}
          </span>
        </div>

        <span className="inline-flex items-center gap-1 font-semibold text-sky-600 group-hover:translate-x-0.5 transition-transform text-xs">
          View Patients
          <ArrowRight className="h-3.5 w-3.5" />
        </span>
      </div>
    </button>
  )
}

// =========================================================
// PATIENT LIST DRILLDOWN
// =========================================================

function PatientList({ person, type, onClose }) {
  const [openPatient, setOpenPatient] = useState(null)
  const patients = Array.isArray(person?.patients) ? person.patients : []
  const isNurse = type === "nurse"

  return (
    <div className="rounded-3xl border border-slate-200/90 bg-white p-5 sm:p-6 shadow-sm animate-fade-in">
      <div className="flex items-start justify-between gap-3 pb-4 border-b border-slate-100">
        <div className="flex items-center gap-3">
          <div
            className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl ${
              isNurse ? "bg-emerald-50 text-emerald-600" : "bg-sky-50 text-sky-600"
            }`}
          >
            {isNurse ? <UserRound className="h-6 w-6" /> : <Stethoscope className="h-6 w-6" />}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-sky-600">
                {isNurse ? "Nurse Workload Roster" : "Attending Doctor Workload"}
              </span>
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-bold text-slate-700">
                {patients.length} {patients.length === 1 ? "Patient" : "Patients"}
              </span>
            </div>
            <h3 className="font-heading text-xl font-extrabold text-slate-900 mt-0.5">
              {person.full_name}
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Staff ID: <span className="font-semibold text-slate-700">{person.id}</span> · Username: @{person.username}
            </p>
          </div>
        </div>

        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-slate-200 p-2 text-slate-400 hover:bg-slate-50 hover:text-slate-700 transition"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {patients.length === 0 ? (
        <div className="py-10">
          <EmptyState
            icon={UserCheck}
            title="No Active Patients Assigned"
            description={`Currently, there are no active patient encounters or medication schedules assigned to this ${type}.`}
          />
        </div>
      ) : (
        <div className="mt-5 space-y-3">
          <p className="text-xs font-bold uppercase tracking-wider text-slate-400">
            Active Assigned Inpatients ({patients.length})
          </p>

          <div className="grid gap-3 max-h-[500px] overflow-y-auto pr-1">
            {patients.map((patient, index) => {
              const patientName =
                patient.full_name ||
                patient.patient_name ||
                `${patient.first_name || ""} ${patient.last_name || ""}`.trim() ||
                "Patient"

              const patientCode =
                patient.patient_id || patient.patient_code || "Unknown ID"

              const patientKey =
                patient.assignment_id ??
                patient.encounter_id ??
                patient.id ??
                patientCode ??
                index

              const patientDate =
                patient.assigned_at ||
                patient.admitted_at ||
                patient.encounter_created_at ||
                patient.created_at

              const isOpen = openPatient === patientKey

              return (
                <div
                  key={patientKey}
                  className="rounded-2xl border border-slate-200/90 bg-white transition hover:border-slate-300"
                >
                  <button
                    type="button"
                    onClick={() => setOpenPatient(isOpen ? null : patientKey)}
                    className="flex w-full items-center justify-between p-4 text-left"
                  >
                    <div className="flex items-center gap-3.5 min-w-0">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-700 font-bold text-xs">
                        {patientName.charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <p className="font-heading font-bold text-slate-900 text-sm truncate">
                          {patientName}
                        </p>
                        <p className="text-xs text-slate-500 mt-0.5">
                          Patient Code: <span className="font-semibold text-slate-700">{patientCode}</span>
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2.5">
                      <span className="rounded-full bg-sky-50 px-2.5 py-1 text-[11px] font-semibold text-sky-700 border border-sky-100">
                        {patient.encounter_type || "Inpatient"}
                      </span>
                      {isOpen ? (
                        <ChevronUp className="h-4 w-4 text-slate-400" />
                      ) : (
                        <ChevronDown className="h-4 w-4 text-slate-400" />
                      )}
                    </div>
                  </button>

                  {isOpen && (
                    <div className="border-t border-slate-100 bg-slate-50/70 p-4 rounded-b-2xl grid gap-3 sm:grid-cols-3 text-xs">
                      <div className="rounded-xl bg-white p-3 border border-slate-100">
                        <span className="text-slate-400 uppercase font-semibold text-[10px] block">
                          Patient ID
                        </span>
                        <span className="font-bold text-slate-800 text-sm mt-0.5 block">
                          {patientCode}
                        </span>
                      </div>
                      <div className="rounded-xl bg-white p-3 border border-slate-100">
                        <span className="text-slate-400 uppercase font-semibold text-[10px] block">
                          {isNurse ? "Assigned Since" : "Encounter Registered"}
                        </span>
                        <span className="font-bold text-slate-800 text-sm mt-0.5 block">
                          {formatDate(patientDate)}
                        </span>
                      </div>
                      <div className="rounded-xl bg-white p-3 border border-slate-100">
                        <span className="text-slate-400 uppercase font-semibold text-[10px] block">
                          Status
                        </span>
                        <span className="font-bold text-emerald-700 text-sm mt-0.5 block">
                          Active Care
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

// =========================================================
// MAIN PAGE
// =========================================================

export default function MonitoringDashboard() {
  const [nurses, setNurses] = useState([])
  const [doctors, setDoctors] = useState([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState("")

  const [activeTab, setActiveTab] = useState("all") // 'all', 'doctors', 'nurses'
  const [searchTerm, setSearchTerm] = useState("")
  const [selectedNurse, setSelectedNurse] = useState(null)
  const [selectedDoctor, setSelectedDoctor] = useState(null)

  async function loadWorkload(isManualRefresh = false) {
    if (isManualRefresh) setRefreshing(true)
    else setLoading(true)
    setError("")

    try {
      const [nurseResponse, doctorResponse] = await Promise.all([
        getNurseWorkload(),
        getDoctorWorkload(),
      ])

      setNurses(
        Array.isArray(nurseResponse?.nurses) ? nurseResponse.nurses : [],
      )
      setDoctors(
        Array.isArray(doctorResponse?.doctors) ? doctorResponse.doctors : [],
      )
    } catch (requestError) {
      console.error("Workload loading error:", requestError)
      setError(
        requestError?.response?.data?.detail ||
          "Unable to load clinical staff workload data. Check server connectivity.",
      )
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => {
    loadWorkload()
  }, [])

  // Aggregate Metrics
  const totalNurses = nurses.length
  const totalDoctors = doctors.length
  const totalDoctorPatients = useMemo(
    () => doctors.reduce((sum, d) => sum + Number(d.patient_count || 0), 0),
    [doctors],
  )
  const totalNursePatients = useMemo(
    () => nurses.reduce((sum, n) => sum + Number(n.patient_count || 0), 0),
    [nurses],
  )
  const highWorkloadStaffCount = useMemo(() => {
    const heavyDocs = doctors.filter((d) => Number(d.patient_count || 0) >= 5).length
    const heavyNurses = nurses.filter((n) => Number(n.patient_count || 0) >= 5).length
    return heavyDocs + heavyNurses
  }, [doctors, nurses])

  // Filtering
  const filteredDoctors = useMemo(() => {
    if (!searchTerm.trim()) return doctors
    const q = searchTerm.toLowerCase()
    return doctors.filter(
      (d) =>
        (d.full_name || "").toLowerCase().includes(q) ||
        (d.username || "").toLowerCase().includes(q) ||
        String(d.id || "").includes(q),
    )
  }, [doctors, searchTerm])

  const filteredNurses = useMemo(() => {
    if (!searchTerm.trim()) return nurses
    const q = searchTerm.toLowerCase()
    return nurses.filter(
      (n) =>
        (n.full_name || "").toLowerCase().includes(q) ||
        (n.username || "").toLowerCase().includes(q) ||
        String(n.id || "").includes(q),
    )
  }, [nurses, searchTerm])

  if (loading) {
    return (
      <MainLayout
        title="Hospital Monitoring"
        subtitle="Live clinical staff workload & patient distribution"
      >
        <Loading
          fullScreen
          message="Loading Clinical Operations Center..."
          subtext="Fetching live workload metrics for doctors and nurses"
        />
      </MainLayout>
    )
  }

  return (
    <MainLayout
      title="Staff Workload & Monitoring"
      subtitle="Executive command center for hospital clinical load balancing"
    >
      <div className="space-y-6 sm:space-y-8">
        {/* Top Control Bar with Quick Refresh */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="flex h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
              <p className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Hospital Clinical Status: Active Monitoring
              </p>
            </div>
            <h2 className="font-heading text-2xl font-extrabold text-slate-900 mt-1">
              Staff Workload Overview
            </h2>
          </div>

          <div className="flex items-center gap-3">
            <Button
              variant="secondary"
              size="sm"
              icon={RefreshCw}
              loading={refreshing}
              onClick={() => loadWorkload(true)}
            >
              Refresh Data
            </Button>
          </div>
        </div>

        {error && (
          <ErrorState
            title="Workload Synchronization Issue"
            message={error}
            onRetry={() => loadWorkload(true)}
          />
        )}

        {/* Aggregate KPI Stat Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            title="Active Doctors"
            value={totalDoctors}
            description="Specialists & general physicians"
            icon={Stethoscope}
            variant="sky"
            badge="On Duty"
          />
          <StatCard
            title="Registered Nurses"
            value={totalNurses}
            description="Ward and triage clinical staff"
            icon={UserRound}
            variant="emerald"
            badge="Staffed"
          />
          <StatCard
            title="Doctor Encounters"
            value={totalDoctorPatients}
            description="Active clinical patient visits"
            icon={Activity}
            variant="indigo"
          />
          <StatCard
            title="High Load Alerts"
            value={highWorkloadStaffCount}
            description="Staff with ≥ 5 active patients"
            icon={AlertTriangle}
            variant={highWorkloadStaffCount > 0 ? "amber" : "emerald"}
            badge={highWorkloadStaffCount > 0 ? "Review Needed" : "Optimal"}
          />
        </div>

        {/* Filter and Search Bar */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 rounded-2xl border border-slate-200/90 bg-white p-3 shadow-xs">
          {/* Tabs */}
          <div className="flex items-center gap-1.5 w-full sm:w-auto">
            <button
              type="button"
              onClick={() => setActiveTab("all")}
              className={`flex-1 sm:flex-initial px-4 py-2 rounded-xl text-xs font-bold transition ${
                activeTab === "all"
                  ? "bg-slate-900 text-white shadow-xs"
                  : "text-slate-600 hover:bg-slate-100"
              }`}
            >
              All Staff ({totalDoctors + totalNurses})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("doctors")}
              className={`flex-1 sm:flex-initial px-4 py-2 rounded-xl text-xs font-bold transition ${
                activeTab === "doctors"
                  ? "bg-sky-600 text-white shadow-xs"
                  : "text-slate-600 hover:bg-slate-100"
              }`}
            >
              Doctors ({totalDoctors})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("nurses")}
              className={`flex-1 sm:flex-initial px-4 py-2 rounded-xl text-xs font-bold transition ${
                activeTab === "nurses"
                  ? "bg-emerald-600 text-white shadow-xs"
                  : "text-slate-600 hover:bg-slate-100"
              }`}
            >
              Nurses ({totalNurses})
            </button>
          </div>

          {/* Search Input */}
          <div className="relative w-full sm:w-72">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search staff name or ID..."
              className="w-full rounded-xl border border-slate-200 bg-slate-50/70 py-2 pl-9 pr-8 text-xs font-medium text-slate-900 outline-none transition focus:border-sky-500 focus:bg-white focus:ring-2 focus:ring-sky-100"
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Selected Staff Detail Drilldown Modal / View */}
        {(selectedNurse || selectedDoctor) && (
          <div className="mb-6">
            <PatientList
              person={selectedNurse || selectedDoctor}
              type={selectedNurse ? "nurse" : "doctor"}
              onClose={() => {
                setSelectedNurse(null)
                setSelectedDoctor(null)
              }}
            />
          </div>
        )}

        {/* Main Workload Sections */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Doctors Section */}
          {(activeTab === "all" || activeTab === "doctors") && (
            <div className={`space-y-3 ${activeTab === "doctors" ? "lg:col-span-2" : ""}`}>
              <div className="flex items-center justify-between pb-2 border-b border-slate-200">
                <div className="flex items-center gap-2">
                  <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-sky-50 text-sky-600">
                    <Stethoscope className="h-4 w-4" />
                  </div>
                  <h3 className="font-heading text-base font-bold text-slate-900">
                    Doctors Roster
                  </h3>
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-bold text-slate-600">
                    {filteredDoctors.length}
                  </span>
                </div>
                <span className="text-xs text-slate-400 font-medium">
                  {totalDoctorPatients} total encounters
                </span>
              </div>

              {filteredDoctors.length === 0 ? (
                <EmptyState
                  icon={Stethoscope}
                  title="No Doctors Found"
                  description={
                    searchTerm
                      ? `No doctor matches "${searchTerm}".`
                      : "No active doctors are currently registered."
                  }
                />
              ) : (
                <div
                  className={`grid gap-3 ${
                    activeTab === "doctors" ? "sm:grid-cols-2 xl:grid-cols-3" : "grid-cols-1"
                  }`}
                >
                  {filteredDoctors.map((doc) => (
                    <StaffCard
                      key={doc.id}
                      person={doc}
                      type="doctor"
                      isSelected={selectedDoctor?.id === doc.id}
                      onClick={() => {
                        setSelectedNurse(null)
                        setSelectedDoctor(selectedDoctor?.id === doc.id ? null : doc)
                      }}
                    />
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Nurses Section */}
          {(activeTab === "all" || activeTab === "nurses") && (
            <div className={`space-y-3 ${activeTab === "nurses" ? "lg:col-span-2" : ""}`}>
              <div className="flex items-center justify-between pb-2 border-b border-slate-200">
                <div className="flex items-center gap-2">
                  <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600">
                    <UserRound className="h-4 w-4" />
                  </div>
                  <h3 className="font-heading text-base font-bold text-slate-900">
                    Nurses Roster
                  </h3>
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-bold text-slate-600">
                    {filteredNurses.length}
                  </span>
                </div>
                <span className="text-xs text-slate-400 font-medium">
                  {totalNursePatients} assigned patients
                </span>
              </div>

              {filteredNurses.length === 0 ? (
                <EmptyState
                  icon={UserRound}
                  title="No Nurses Found"
                  description={
                    searchTerm
                      ? `No nurse matches "${searchTerm}".`
                      : "No active nurses are currently registered."
                  }
                />
              ) : (
                <div
                  className={`grid gap-3 ${
                    activeTab === "nurses" ? "sm:grid-cols-2 xl:grid-cols-3" : "grid-cols-1"
                  }`}
                >
                  {filteredNurses.map((nurse) => (
                    <StaffCard
                      key={nurse.id}
                      person={nurse}
                      type="nurse"
                      isSelected={selectedNurse?.id === nurse.id}
                      onClick={() => {
                        setSelectedDoctor(null)
                        setSelectedNurse(selectedNurse?.id === nurse.id ? null : nurse)
                      }}
                    />
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </MainLayout>
  )
}