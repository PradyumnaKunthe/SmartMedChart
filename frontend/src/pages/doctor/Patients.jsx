import {
  ArrowRight,
  ArrowUpDown,
  Building2,
  Calendar,
  CheckCircle2,
  Filter,
  LayoutGrid,
  List,
  LoaderCircle,
  Plus,
  RefreshCw,
  Search,
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
import Pagination from "../../components/common/Pagination"
import StatCard from "../../components/dashboard/StatCard"

import {
  getDoctorPatients,
} from "../../services/doctor"
import { hideTestPatients } from "../../utils/patientFilter"

export default function Patients() {
  const navigate = useNavigate()

  const [patients, setPatients] = useState([])
  const [search, setSearch] = useState("")
  const [filterStatus, setFilterStatus] = useState("all") // 'all', 'active', 'discharged'
  const [sortBy, setSortBy] = useState("name_asc") // 'name_asc', 'name_desc', 'id_asc'
  const [viewMode, setViewMode] = useState("table") // 'table', 'grid'
  const [currentPage, setCurrentPage] = useState(1)
  const pageSize = 10

  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState("")

  async function loadPatients(currentSearch = "", isManual = false) {
    if (isManual) setRefreshing(true)
    else setLoading(true)
    setError("")

    try {
      const data = await getDoctorPatients(currentSearch)
      const raw = Array.isArray(data) ? data : []
      setPatients(hideTestPatients(raw))
    } catch (requestError) {
      setError(
        requestError?.response?.data?.detail ||
          "Unable to load patient records. Check server connection.",
      )
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => {
    loadPatients("")
  }, [])

  // Filtering & Sorting
  const filteredPatients = useMemo(() => {
    let list = patients

    if (filterStatus === "active") {
      list = list.filter((p) => p.is_active)
    } else if (filterStatus === "discharged") {
      list = list.filter((p) => !p.is_active)
    }

    if (search.trim()) {
      const q = search.trim().toLowerCase()
      list = list.filter(
        (p) =>
          (p.first_name || "").toLowerCase().includes(q) ||
          (p.last_name || "").toLowerCase().includes(q) ||
          (p.patient_id || "").toLowerCase().includes(q) ||
          (p.full_name || "").toLowerCase().includes(q) ||
          String(p.id || "").includes(q),
      )
    }

    return [...list].sort((a, b) => {
      const nameA = a.full_name || `${a.first_name || ""} ${a.last_name || ""}`.trim()
      const nameB = b.full_name || `${b.first_name || ""} ${b.last_name || ""}`.trim()

      if (sortBy === "name_asc") return nameA.localeCompare(nameB)
      if (sortBy === "name_desc") return nameB.localeCompare(nameA)
      if (sortBy === "id_asc") return (a.patient_id || "").localeCompare(b.patient_id || "")
      return 0
    })
  }, [patients, filterStatus, search, sortBy])

  // Pagination slice
  const paginatedPatients = useMemo(() => {
    const start = (currentPage - 1) * pageSize
    return filteredPatients.slice(start, start + pageSize)
  }, [filteredPatients, currentPage, pageSize])

  const totalPages = Math.ceil(filteredPatients.length / pageSize) || 1

  const activeCount = useMemo(() => patients.filter((p) => p.is_active).length, [patients])
  const dischargedCount = Math.max(0, patients.length - activeCount)

  if (loading) {
    return (
      <MainLayout
        title="Patients Directory"
        subtitle="Doctor clinical roster & inpatient medical charts"
      >
        <Loading
          fullScreen
          message="Loading Patients Directory..."
          subtext="Fetching assigned clinical records and patient charts"
        />
      </MainLayout>
    )
  }

  return (
    <MainLayout
      title="Patients Directory"
      subtitle="Comprehensive clinical roster of assigned inpatients and medical records"
    >
      <div className="space-y-6 sm:space-y-8">
        {/* Top Header Actions */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="flex h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
              <p className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Doctor Station
              </p>
            </div>
            <h2 className="font-heading text-2xl font-extrabold text-slate-900 mt-1">
              Patient Medical Charts
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
            title="Patient Directory Error"
            message={error}
            onRetry={() => loadPatients(search, true)}
          />
        )}

        {/* Aggregate KPI Stat Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <StatCard
            title="Total Assigned Patients"
            value={patients.length}
            description="All active and past records"
            icon={Users}
            variant="sky"
          />
          <StatCard
            title="Active Inpatients"
            value={activeCount}
            description="Currently in active care"
            icon={UserRound}
            variant="emerald"
            badge="In Hospital"
          />
          <StatCard
            title="Discharged Records"
            value={dischargedCount}
            description="Treatment concluded"
            icon={CheckCircle2}
            variant="neutral"
          />
        </div>

        {/* Search, Filter & View Controls */}
        <div className="rounded-2xl border border-slate-200/90 bg-white p-4 shadow-xs space-y-3">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
            {/* Search Input */}
            <div className="relative w-full sm:flex-1 max-w-md">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value)
                  setCurrentPage(1)
                }}
                placeholder="Search patient name, ID, or database ID..."
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

            {/* View Mode Toggle & Sort */}
            <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-end">
              <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl">
                <button
                  type="button"
                  onClick={() => setViewMode("table")}
                  className={`flex h-8 w-8 items-center justify-center rounded-lg transition ${
                    viewMode === "table"
                      ? "bg-white text-slate-900 shadow-xs"
                      : "text-slate-500 hover:text-slate-800"
                  }`}
                  title="Table view"
                >
                  <List className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode("grid")}
                  className={`flex h-8 w-8 items-center justify-center rounded-lg transition ${
                    viewMode === "grid"
                      ? "bg-white text-slate-900 shadow-xs"
                      : "text-slate-500 hover:text-slate-800"
                  }`}
                  title="Grid card view"
                >
                  <LayoutGrid className="h-4 w-4" />
                </button>
              </div>

              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 outline-none focus:border-sky-500"
              >
                <option value="name_asc">Name (A → Z)</option>
                <option value="name_desc">Name (Z → A)</option>
                <option value="id_asc">Patient ID</option>
              </select>
            </div>
          </div>

          {/* Status Filter Pills */}
          <div className="flex items-center gap-1.5 pt-2 border-t border-slate-100">
            <span className="text-xs text-slate-400 font-semibold mr-1">Status:</span>
            <button
              type="button"
              onClick={() => {
                setFilterStatus("all")
                setCurrentPage(1)
              }}
              className={`px-3 py-1 rounded-xl text-xs font-bold transition ${
                filterStatus === "all"
                  ? "bg-slate-900 text-white shadow-xs"
                  : "text-slate-600 hover:bg-slate-100"
              }`}
            >
              All ({patients.length})
            </button>
            <button
              type="button"
              onClick={() => {
                setFilterStatus("active")
                setCurrentPage(1)
              }}
              className={`px-3 py-1 rounded-xl text-xs font-bold transition ${
                filterStatus === "active"
                  ? "bg-emerald-600 text-white shadow-xs"
                  : "text-slate-600 hover:bg-slate-100"
              }`}
            >
              Active Inpatients ({activeCount})
            </button>
            <button
              type="button"
              onClick={() => {
                setFilterStatus("discharged")
                setCurrentPage(1)
              }}
              className={`px-3 py-1 rounded-xl text-xs font-bold transition ${
                filterStatus === "discharged"
                  ? "bg-slate-700 text-white shadow-xs"
                  : "text-slate-600 hover:bg-slate-100"
              }`}
            >
              Discharged ({dischargedCount})
            </button>
          </div>
        </div>

        {/* Patient List Content */}
        {filteredPatients.length === 0 ? (
          <EmptyState
            icon={Users}
            title="No Patients Found"
            description={
              search
                ? `No patient records match "${search}". Try searching for another name or ID.`
                : "No patient records match the selected status filter."
            }
            actionLabel={search ? "Clear Search" : undefined}
            onAction={search ? () => setSearch("") : undefined}
          />
        ) : viewMode === "table" ? (
          /* Table View */
          <div className="rounded-2xl border border-slate-200/90 bg-white shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50/80 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                    <th className="py-3.5 px-4">Patient Profile</th>
                    <th className="py-3.5 px-4">Patient ID</th>
                    <th className="py-3.5 px-4">Bed / Ward</th>
                    <th className="py-3.5 px-4">Care Status</th>
                    <th className="py-3.5 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {paginatedPatients.map((patient) => {
                    const first = patient.first_name || ""
                    const last = patient.last_name || ""
                    const fullName =
                      patient.full_name || `${first} ${last}`.trim() || "Inpatient"
                    const initials =
                      `${first.charAt(0)}${last.charAt(0)}`.toUpperCase() || "P"

                    return (
                      <tr
                        key={patient.id}
                        className="transition-colors hover:bg-slate-50/70"
                      >
                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-3">
                            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-sky-50 font-bold text-xs text-sky-700 border border-sky-100">
                              {initials}
                            </div>
                            <div className="min-w-0">
                              <p className="font-heading font-bold text-slate-900 text-sm truncate">
                                {fullName}
                              </p>
                              <p className="text-[11px] text-slate-400 mt-0.5">
                                DB ID: {patient.id}
                              </p>
                            </div>
                          </div>
                        </td>

                        <td className="py-3.5 px-4 font-mono font-bold text-slate-800 text-xs">
                          {patient.patient_id}
                        </td>

                        <td className="py-3.5 px-4">
                          <p className="font-semibold text-slate-800 flex items-center gap-1.5">
                            <Building2 className="h-3.5 w-3.5 text-slate-400" />
                            {patient.bed_id ? `Bed ${patient.bed_id}` : "Unassigned"}
                          </p>
                        </td>

                        <td className="py-3.5 px-4">
                          <Badge
                            variant={patient.is_active ? "success" : "neutral"}
                            size="sm"
                            dot
                          >
                            {patient.is_active ? "Active Inpatient" : "Discharged"}
                          </Badge>
                        </td>

                        <td className="py-3.5 px-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <Button
                              variant="secondary"
                              size="sm"
                              icon={Plus}
                              onClick={() =>
                                navigate(`/doctor/prescriptions/create?patient=${patient.id}`)
                              }
                            >
                              Rx
                            </Button>
                            <Button
                              variant="primary"
                              size="sm"
                              iconRight={ArrowRight}
                              onClick={() =>
                                navigate(`/doctor/patients/${patient.id}`)
                              }
                            >
                              Open Chart
                            </Button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            <div className="p-4 bg-slate-50/50">
              <Pagination
                currentPage={currentPage}
                totalPages={totalPages}
                totalItems={filteredPatients.length}
                pageSize={pageSize}
                onPageChange={(p) => setCurrentPage(p)}
              />
            </div>
          </div>
        ) : (
          /* Grid View */
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {paginatedPatients.map((patient) => {
                const first = patient.first_name || ""
                const last = patient.last_name || ""
                const fullName =
                  patient.full_name || `${first} ${last}`.trim() || "Inpatient"
                const initials =
                  `${first.charAt(0)}${last.charAt(0)}`.toUpperCase() || "P"

                return (
                  <div
                    key={patient.id}
                    className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-xs transition hover:border-sky-300 hover:shadow-md"
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
                      <span className="text-slate-400">
                        Bed: {patient.bed_id ? `Bed ${patient.bed_id}` : "Unassigned"}
                      </span>

                      <div className="flex items-center gap-1.5">
                        <Button
                          variant="secondary"
                          size="sm"
                          icon={Plus}
                          onClick={() =>
                            navigate(`/doctor/prescriptions/create?patient=${patient.id}`)
                          }
                        >
                          Rx
                        </Button>
                        <Button
                          variant="primary"
                          size="sm"
                          iconRight={ArrowRight}
                          onClick={() =>
                            navigate(`/doctor/patients/${patient.id}`)
                          }
                        >
                          Chart
                        </Button>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>

            <Pagination
              currentPage={currentPage}
              totalPages={totalPages}
              totalItems={filteredPatients.length}
              pageSize={pageSize}
              onPageChange={(p) => setCurrentPage(p)}
            />
          </div>
        )}
      </div>
    </MainLayout>
  )
}