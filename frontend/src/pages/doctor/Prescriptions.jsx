import {
  ArrowRight,
  ClipboardList,
  Edit3,
  FilePlus,
  Filter,
  Pill,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
  Stethoscope,
  UserRound,
  Users,
  X,
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
import Badge from "../../components/common/Badge"
import Button from "../../components/common/Button"
import Card, { CardHeader } from "../../components/common/Card"
import EmptyState from "../../components/common/EmptyState"
import ErrorState from "../../components/common/ErrorState"
import Loading from "../../components/common/Loading"
import StatCard from "../../components/dashboard/StatCard"

import {
  getDoctorPatients,
} from "../../services/doctor"
import { hideTestPatients } from "../../utils/patientFilter"

export default function Prescriptions() {
  const navigate = useNavigate()

  const [search, setSearch] = useState("")
  const [patients, setPatients] = useState([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState("")

  async function loadPatients(currentSearch = "", isManual = false) {
    if (isManual) setRefreshing(true)
    else setLoading(true)
    setError("")

    try {
      const data = await getDoctorPatients(currentSearch.trim())
      const raw = Array.isArray(data) ? data : []
      setPatients(hideTestPatients(raw))
    } catch (requestError) {
      setError(
        requestError?.response?.data?.detail ||
          "Unable to load assigned patients.",
      )
      setPatients([])
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => {
    loadPatients("")
  }, [])

  const filteredPatients = useMemo(() => {
    if (!search.trim()) return patients
    const q = search.trim().toLowerCase()
    return patients.filter((p) => {
      const fullName = p.full_name || `${p.first_name || ""} ${p.last_name || ""}`
      return (
        fullName.toLowerCase().includes(q) ||
        (p.patient_id || "").toLowerCase().includes(q)
      )
    })
  }, [patients, search])

  const activePatients = useMemo(() => patients.filter((p) => p.is_active).length, [patients])

  if (loading) {
    return (
      <MainLayout
        title="Electronic Prescriptions"
        subtitle="Manage patient medication orders & electronic charts"
      >
        <Loading
          fullScreen
          message="Loading Prescriptions Hub..."
          subtext="Fetching clinical patient rosters and order directories"
        />
      </MainLayout>
    )
  }

  return (
    <MainLayout
      title="Electronic Prescriptions"
      subtitle="Issue new multi-medicine orders, review active regimens, and update clinical stop orders"
    >
      <div className="space-y-6 sm:space-y-8">
        {/* Top Header Actions */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="flex h-2 w-2 rounded-full bg-indigo-500 animate-pulse" />
              <p className="text-xs font-bold uppercase tracking-wider text-slate-500">
                CPOE Medication Portal
              </p>
            </div>
            <h2 className="font-heading text-2xl font-extrabold text-slate-900 mt-1">
              Prescription Order Directory
            </h2>
          </div>

          <div className="flex items-center gap-2.5">
            <Button
              variant="secondary"
              size="sm"
              icon={RefreshCw}
              loading={refreshing}
              onClick={() => loadPatients(search, true)}
            >
              Refresh
            </Button>
            <Button
              variant="primary"
              size="sm"
              icon={Plus}
              onClick={() => navigate("/doctor/prescriptions/create")}
            >
              New Prescription
            </Button>
          </div>
        </div>

        {error && (
          <ErrorState
            title="Prescriptions Service Issue"
            message={error}
            onRetry={() => loadPatients(search, true)}
          />
        )}

        {/* KPI Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <StatCard
            title="Assigned Inpatients"
            value={patients.length}
            description="Under primary care"
            icon={Users}
            variant="sky"
          />
          <StatCard
            title="Active Inpatient Charts"
            value={activePatients}
            description="Eligible for new Rx orders"
            icon={UserRound}
            variant="emerald"
            badge="In Care"
          />
          <StatCard
            title="Allergy Protection"
            value="Enabled"
            description="Automatic cross-checking on submission"
            icon={ShieldCheck}
            variant="indigo"
          />
        </div>

        {/* Search Bar */}
        <div className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200/90 bg-white p-3 shadow-xs">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search patient by name or ID to issue or review prescriptions..."
              className="w-full rounded-xl border border-slate-200 bg-slate-50/70 py-2.5 pl-9 pr-8 text-xs font-medium text-slate-900 outline-none transition focus:border-sky-500 focus:bg-white focus:ring-2 focus:ring-sky-100"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
          <span className="text-xs text-slate-400 font-semibold px-2">
            {filteredPatients.length} patients
          </span>
        </div>

        {/* Patient Cards for Prescription Action */}
        {filteredPatients.length === 0 ? (
          <EmptyState
            icon={ClipboardList}
            title="No Patient Records Found"
            description={
              search
                ? `No patient matches "${search}".`
                : "No assigned patients available."
            }
          />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredPatients.map((patient) => {
              const fullName =
                patient.full_name ||
                `${patient.first_name || ""} ${patient.last_name || ""}`.trim() ||
                "Inpatient"

              const initials = fullName
                .split(" ")
                .map((w) => w[0])
                .join("")
                .slice(0, 2)
                .toUpperCase()

              return (
                <div
                  key={patient.id}
                  className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-xs transition hover:border-sky-300 hover:shadow-md flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-indigo-50 font-bold text-xs text-indigo-700 border border-indigo-100">
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

                    <div className="mt-4 pt-3 border-t border-slate-100 text-xs text-slate-500">
                      <span>Bed Location: </span>
                      <span className="font-semibold text-slate-800">
                        {patient.bed_id ? `Bed ${patient.bed_id}` : "Outpatient"}
                      </span>
                    </div>
                  </div>

                  <div className="mt-5 pt-3 border-t border-slate-100 flex items-center gap-2">
                    <Button
                      variant="primary"
                      size="sm"
                      icon={Plus}
                      onClick={() =>
                        navigate(`/doctor/prescriptions/create?patient=${patient.id}`)
                      }
                      className="flex-1"
                    >
                      New Rx
                    </Button>
                    <Button
                      variant="secondary"
                      size="sm"
                      iconRight={ArrowRight}
                      onClick={() =>
                        navigate(`/doctor/patients/${patient.id}`)
                      }
                      className="flex-1"
                    >
                      Review Regimens
                    </Button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </MainLayout>
  )
}