import {
  Activity,
  AlertTriangle,
  ArrowRight,
  BrainCircuit,
  Calendar,
  CheckCircle2,
  ClipboardList,
  FileText,
  LoaderCircle,
  Pill,
  Plus,
  RefreshCw,
  Search,
  ShieldAlert,
  ShieldCheck,
  Stethoscope,
  TrendingUp,
  UserCheck,
  UserRound,
  Users,
} from "lucide-react"

import {
  useEffect,
  useMemo,
  useState,
} from "react"

import {
  useNavigate,
} from "react-router-dom"

import MainLayout from "../../components/layout/MainLayout"
import StatCard from "../../components/dashboard/StatCard"
import Badge from "../../components/common/Badge"
import Button from "../../components/common/Button"
import Card, { CardHeader } from "../../components/common/Card"
import EmptyState from "../../components/common/EmptyState"
import ErrorState from "../../components/common/ErrorState"
import Loading from "../../components/common/Loading"

import {
  getDoctorPatients,
} from "../../services/doctor"
import { hideTestPatients } from "../../utils/patientFilter"
import { useAuth } from "../../context/AuthContext"

export default function DoctorDashboard() {
  const navigate = useNavigate()
  const { user } = useAuth()

  const [patients, setPatients] = useState([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState("")

  async function loadPatients(isManual = false) {
    if (isManual) setRefreshing(true)
    else setLoading(true)
    setError("")

    try {
      const data = await getDoctorPatients()
      const visiblePatients = hideTestPatients(Array.isArray(data) ? data : [])
      setPatients(visiblePatients)
    } catch (requestError) {
      setError(
        requestError?.response?.data?.detail ||
          requestError?.message ||
          "Unable to load assigned patients.",
      )
      setPatients([])
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => {
    loadPatients()
  }, [])

  const activePatients = useMemo(
    () => patients.filter((patient) => patient.is_active).length,
    [patients],
  )

  const inactivePatients = Math.max(0, patients.length - activePatients)
  const recentPatients = useMemo(() => patients.slice(0, 6), [patients])

  const doctorName = user?.full_name || user?.username || "Doctor"

  if (loading) {
    return (
      <MainLayout
        title="Doctor Dashboard"
        subtitle="Clinical workspace & inpatient charts"
      >
        <Loading
          fullScreen
          message="Loading Clinical Workspace..."
          subtext="Fetching assigned patients, encounters, and active medication charts"
        />
      </MainLayout>
    )
  }

  return (
    <MainLayout
      title="Doctor Clinical Workspace"
      subtitle={`Welcome back, Dr. ${doctorName} · Inpatient records and active medication charts`}
    >
      <div className="space-y-6 sm:space-y-8">
        {/* Welcome Clinical Banner */}
        <div className="relative overflow-hidden rounded-3xl border border-sky-100 bg-gradient-to-r from-sky-500 via-sky-600 to-indigo-600 p-6 sm:p-8 text-white shadow-md shadow-sky-600/10">
          <div className="relative z-10 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
            <div className="space-y-2 max-w-2xl">
              <div className="inline-flex items-center gap-2 rounded-full bg-white/20 px-3 py-1 text-xs font-bold uppercase tracking-wider backdrop-blur-xs">
                <Stethoscope className="h-3.5 w-3.5" />
                <span>Physician Station</span>
              </div>
              <h2 className="font-heading text-2xl sm:text-3xl font-extrabold tracking-tight">
                Good day, Dr. {doctorName}
              </h2>
              <p className="text-sm text-sky-100 leading-relaxed">
                You have <span className="font-bold text-white">{activePatients} active inpatients</span> under your primary care. Review recent vitals, create new electronic prescriptions, or run AI safety analysis below.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <Button
                variant="secondary"
                size="md"
                icon={RefreshCw}
                loading={refreshing}
                onClick={() => loadPatients(true)}
                className="bg-white/95 text-sky-900 hover:bg-white border-0 shadow-sm"
              >
                Sync Records
              </Button>
              <Button
                variant="primary"
                size="md"
                icon={Plus}
                onClick={() => navigate("/doctor/prescriptions/create")}
                className="bg-sky-950 text-white hover:bg-slate-900 border-0 shadow-md"
              >
                New Prescription
              </Button>
            </div>
          </div>

          {/* Decorative Background Circles */}
          <div className="absolute -right-10 -bottom-10 h-64 w-64 rounded-full bg-white/10 blur-2xl pointer-events-none" />
          <div className="absolute right-40 -top-10 h-48 w-48 rounded-full bg-indigo-400/20 blur-xl pointer-events-none" />
        </div>

        {error && (
          <ErrorState
            title="Unable to load doctor workspace"
            message={error}
            onRetry={() => loadPatients(true)}
          />
        )}

        {/* Clinical KPI Metric Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            title="Total Assigned"
            value={patients.length}
            description="Patient encounters on record"
            icon={Users}
            variant="sky"
            onClick={() => navigate("/doctor/patients")}
          />
          <StatCard
            title="Active Inpatients"
            value={activePatients}
            description="Currently in ward beds"
            icon={UserRound}
            variant="emerald"
            badge="Active Care"
            onClick={() => navigate("/doctor/patients")}
          />
          <StatCard
            title="Discharged Records"
            value={inactivePatients}
            description="Historical patient cases"
            icon={CheckCircle2}
            variant="neutral"
          />
          <StatCard
            title="AI Safety Protocol"
            value="Active"
            description="Continuous risk & allergy scanning"
            icon={ShieldCheck}
            variant="indigo"
            badge="Protected"
            onClick={() => navigate("/doctor/ai")}
          />
        </div>

        {/* Quick Clinical Shortcuts */}
        <div>
          <h3 className="font-heading text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
            <span>Clinical Tools & Workflows</span>
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Patients Directory */}
            <div
              onClick={() => navigate("/doctor/patients")}
              className="group cursor-pointer rounded-2xl border border-slate-200/90 bg-white p-5 shadow-xs transition-all duration-200 hover:-translate-y-1 hover:border-sky-300 hover:shadow-md"
            >
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-sky-50 text-sky-600 group-hover:bg-sky-600 group-hover:text-white transition-colors duration-200 shadow-xs">
                <Users className="h-6 w-6" />
              </div>
              <h4 className="font-heading font-bold text-slate-900 text-base mt-4 group-hover:text-sky-700 transition-colors">
                Patients Directory
              </h4>
              <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                Filter inpatients, inspect medical histories, and review vital signs.
              </p>
              <span className="mt-4 inline-flex items-center gap-1 text-xs font-bold text-sky-600 group-hover:translate-x-1 transition-transform">
                Open Directory →
              </span>
            </div>

            {/* Prescriptions */}
            <div
              onClick={() => navigate("/doctor/prescriptions")}
              className="group cursor-pointer rounded-2xl border border-slate-200/90 bg-white p-5 shadow-xs transition-all duration-200 hover:-translate-y-1 hover:border-indigo-300 hover:shadow-md"
            >
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600 group-hover:bg-indigo-600 group-hover:text-white transition-colors duration-200 shadow-xs">
                <ClipboardList className="h-6 w-6" />
              </div>
              <h4 className="font-heading font-bold text-slate-900 text-base mt-4 group-hover:text-indigo-700 transition-colors">
                Prescriptions
              </h4>
              <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                Review active patient prescriptions, dosage schedules, and stop orders.
              </p>
              <span className="mt-4 inline-flex items-center gap-1 text-xs font-bold text-indigo-600 group-hover:translate-x-1 transition-transform">
                Manage Orders →
              </span>
            </div>

            {/* AI Risk Monitor */}
            <div
              onClick={() => navigate("/doctor/ai")}
              className="group cursor-pointer rounded-2xl border border-slate-200/90 bg-white p-5 shadow-xs transition-all duration-200 hover:-translate-y-1 hover:border-purple-300 hover:shadow-md"
            >
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-purple-50 text-purple-600 group-hover:bg-purple-600 group-hover:text-white transition-colors duration-200 shadow-xs">
                <BrainCircuit className="h-6 w-6" />
              </div>
              <h4 className="font-heading font-bold text-slate-900 text-base mt-4 group-hover:text-purple-700 transition-colors">
                AI Clinical Insights
              </h4>
              <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                Predict medication delay and missed dose probabilities using AI models.
              </p>
              <span className="mt-4 inline-flex items-center gap-1 text-xs font-bold text-purple-600 group-hover:translate-x-1 transition-transform">
                Analyze Risks →
              </span>
            </div>

            {/* New Prescription Form */}
            <div
              onClick={() => navigate("/doctor/prescriptions/create")}
              className="group cursor-pointer rounded-2xl border border-slate-200/90 bg-white p-5 shadow-xs transition-all duration-200 hover:-translate-y-1 hover:border-emerald-300 hover:shadow-md"
            >
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600 group-hover:bg-emerald-600 group-hover:text-white transition-colors duration-200 shadow-xs">
                <Plus className="h-6 w-6" />
              </div>
              <h4 className="font-heading font-bold text-slate-900 text-base mt-4 group-hover:text-emerald-700 transition-colors">
                Write Prescription
              </h4>
              <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                Add multi-medicine orders with automated allergy conflict detection.
              </p>
              <span className="mt-4 inline-flex items-center gap-1 text-xs font-bold text-emerald-600 group-hover:translate-x-1 transition-transform">
                New Rx Order →
              </span>
            </div>
          </div>
        </div>

        {/* Recent Inpatients Section */}
        <div className="rounded-3xl border border-slate-200/90 bg-white p-6 shadow-xs">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-5 border-b border-slate-100">
            <div>
              <h3 className="font-heading text-lg font-bold text-slate-900">
                Recent Inpatients Under Care
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Quick access to recent patient medical charts and drug schedules
              </p>
            </div>

            <Button
              variant="secondary"
              size="sm"
              icon={ArrowRight}
              onClick={() => navigate("/doctor/patients")}
            >
              View Full Patient List
            </Button>
          </div>

          {recentPatients.length === 0 ? (
            <div className="py-10">
              <EmptyState
                icon={Users}
                title="No Inpatients Assigned"
                description="Currently no patients are linked to your doctor ID. Ask your hospital administrator to assign patients to your roster."
              />
            </div>
          ) : (
            <div className="mt-5 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {recentPatients.map((patient) => {
                const first = patient.first_name || ""
                const last = patient.last_name || ""
                const fullName = patient.full_name || `${first} ${last}`.trim() || "Inpatient"
                const initials = `${first.charAt(0)}${last.charAt(0)}`.toUpperCase() || "P"

                return (
                  <div
                    key={patient.id}
                    className="rounded-2xl border border-slate-200/90 bg-white p-4.5 transition-all duration-200 hover:border-sky-300 hover:shadow-sm"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-sky-50 font-bold text-xs text-sky-700 border border-sky-100">
                          {initials}
                        </div>
                        <div className="min-w-0">
                          <h4 className="font-heading font-bold text-slate-900 text-sm truncate">
                            {fullName}
                          </h4>
                          <p className="text-xs text-slate-500 mt-0.5">
                            ID: <span className="font-semibold text-slate-700">{patient.patient_id}</span>
                          </p>
                        </div>
                      </div>

                      <Badge
                        variant={patient.is_active ? "success" : "neutral"}
                        size="sm"
                        dot
                      >
                        {patient.is_active ? "Active" : "Discharged"}
                      </Badge>
                    </div>

                    <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
                      <span className="text-slate-400 font-medium">
                        Bed: {patient.bed_id ? `Bed ${patient.bed_id}` : "Unassigned"}
                      </span>

                      <button
                        type="button"
                        onClick={() => navigate(`/doctor/patients/${patient.id}`)}
                        className="inline-flex items-center gap-1 font-bold text-sky-600 hover:text-sky-700 transition"
                      >
                        View Chart
                        <ArrowRight className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </MainLayout>
  )
}