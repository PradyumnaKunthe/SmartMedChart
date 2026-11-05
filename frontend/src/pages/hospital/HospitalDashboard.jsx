import React, { useEffect, useMemo, useState } from "react"
import { useNavigate } from "react-router-dom"
import {
  Activity,
  ArrowUpDown,
  Eye,
  RefreshCw,
  Search,
  Sparkles,
  UserPlus,
  Users,
} from "lucide-react"

import MainLayout from "../../components/layout/MainLayout"
import Card from "../../components/common/Card"
import Button from "../../components/common/Button"
import Badge from "../../components/common/Badge"
import Loading from "../../components/common/Loading"
import EmptyState from "../../components/common/EmptyState"
import Pagination from "../../components/common/Pagination"
import StatCard from "../../components/dashboard/StatCard"
import api from "../../services/api"
import { hideTestPatients } from "../../utils/patientFilter"

function formatDate(value) {
  if (!value) return "—"
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return "—"
  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(parsed)
}

const ITEMS_PER_PAGE = 10

export default function HospitalDashboard() {
  const navigate = useNavigate()

  const [patients, setPatients] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  // Search & Filter & Sort
  const [search, setSearch] = useState("")
  const [sortBy, setSortBy] = useState("name") // name, id, dob
  const [sortOrder, setSortOrder] = useState("asc")
  const [currentPage, setCurrentPage] = useState(1)

  async function loadPatients() {
    setLoading(true)
    setError("")
    try {
      const response = await api.get("/api/hospital/patients")
      const list = Array.isArray(response.data?.patients)
        ? response.data.patients
        : Array.isArray(response.data)
        ? response.data
        : []
      const activeList = list.filter((p) => Boolean(p.is_active) && p.lifecycle_status !== "DISCHARGED")
      setPatients(hideTestPatients(activeList))
    } catch (err) {
      setError(
        err?.response?.data?.detail || "Unable to load hospital patient directory."
      )
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadPatients()
  }, [])

  // KPI Metrics
  const metrics = useMemo(() => {
    const active = patients.filter((p) => Boolean(p.is_active) && p.lifecycle_status !== "DISCHARGED").length
    const withBed = patients.filter((p) => Boolean(p.bed_id)).length
    return { active, withBed }
  }, [patients])

  // Filtering & Sorting
  const filteredPatients = useMemo(() => {
    let result = [...patients]

    if (search.trim()) {
      const term = search.toLowerCase()
      result = result.filter(
        (p) =>
          (p.first_name && p.first_name.toLowerCase().includes(term)) ||
          (p.last_name && p.last_name.toLowerCase().includes(term)) ||
          (p.patient_id && String(p.patient_id).toLowerCase().includes(term)) ||
          (p.mobile_number && p.mobile_number.includes(term))
      )
    }

    result = result.filter((p) => Boolean(p.is_active) && p.lifecycle_status !== "DISCHARGED")

    result.sort((a, b) => {
      let comp = 0
      if (sortBy === "name") {
        const nameA = `${a.first_name || ""} ${a.last_name || ""}`.trim()
        const nameB = `${b.first_name || ""} ${b.last_name || ""}`.trim()
        comp = nameA.localeCompare(nameB)
      } else if (sortBy === "id") {
        comp = String(a.patient_id || "").localeCompare(String(b.patient_id || ""))
      } else if (sortBy === "dob") {
        comp = String(a.date_of_birth || "").localeCompare(String(b.date_of_birth || ""))
      }
      return sortOrder === "asc" ? comp : -comp
    })

    return result
  }, [patients, search, sortBy, sortOrder])

  const totalPages = Math.ceil(filteredPatients.length / ITEMS_PER_PAGE) || 1
  const paginatedPatients = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE
    return filteredPatients.slice(start, start + ITEMS_PER_PAGE)
  }, [filteredPatients, currentPage])

  function handleSort(field) {
    if (sortBy === field) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc")
    } else {
      setSortBy(field)
      setSortOrder("asc")
    }
  }

  return (
    <MainLayout
      title="Hospital Reception & Admission"
      subtitle="Central patient admission registry, CareMatch triage, and inpatient status roster"
    >
      <div className="space-y-6">
        {/* Welcome & Quick Actions Header */}
        <div className="relative overflow-hidden bg-gradient-to-r from-sky-600 via-sky-700 to-indigo-800 rounded-3xl p-6 lg:p-8 text-white shadow-xl">
          <div className="absolute top-0 right-0 -mt-10 -mr-10 w-64 h-64 bg-white/10 rounded-full blur-2xl pointer-events-none" />
          <div className="relative z-10 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
            <div className="space-y-2 max-w-2xl">
              <div className="inline-flex items-center gap-2 px-3 py-1 bg-white/15 backdrop-blur-md rounded-full text-xs font-semibold text-sky-100">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                Hospital Intake & Bed Allocation Desk
              </div>
              <h1 className="text-2xl lg:text-3xl font-extrabold tracking-tight">
                Patient Management & Triage
              </h1>
              <p className="text-sky-100/90 text-sm leading-relaxed">
                Admit new inpatients, run AI-assisted CareMatch doctor recommendations, and
                monitor active ward bed occupancy.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <Button
                variant="secondary"
                icon={UserPlus}
                className="bg-white text-sky-900 hover:bg-sky-50 border border-sky-200/80 shadow-md font-bold text-sm"
                onClick={() => navigate("/hospital/patients/new")}
              >
                Register Patient
              </Button>
              <Button
                variant="outline"
                icon={Sparkles}
                className="border-white/30 text-white hover:bg-white/10 backdrop-blur-sm"
                onClick={() => navigate("/hospital/carematch")}
              >
                CareMatch Doctor AI
              </Button>
              <Button
                variant="outline"
                icon={RefreshCw}
                className="border-white/30 text-white hover:bg-white/10 backdrop-blur-sm"
                loading={loading}
                onClick={loadPatients}
              >
                Refresh
              </Button>
            </div>
          </div>
        </div>

        {/* Global Error Alert */}
        {error && (
          <div className="flex items-center gap-3 p-4 bg-rose-50 border border-rose-200 rounded-2xl text-rose-700 text-sm">
            <div className="flex-1 font-medium">{error}</div>
            <Button size="sm" variant="outline" onClick={loadPatients}>
              Retry
            </Button>
          </div>
        )}

        {/* KPI Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <StatCard
            title="Active Inpatients"
            value={metrics.active}
            subtitle="Currently in Hospital Care"
            icon={Activity}
            color="emerald"
          />
          <StatCard
            title="Assigned Ward Beds"
            value={metrics.withBed}
            subtitle="Occupied Ward Beds"
            icon={Users}
            color="sky"
          />
        </div>

        {/* Search & Filter Bar */}
        <Card>
          <div className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-3">
            {/* Search Input */}
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search patient name, ID or mobile..."
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value)
                  setCurrentPage(1)
                }}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-10 pr-4 py-2 text-sm text-slate-800 placeholder-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 transition-all"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => {
                    setSearch("")
                    setCurrentPage(1)
                  }}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400 hover:text-slate-600"
                >
                  Clear
                </button>
              )}
            </div>

            {/* Active Inpatients Count Pill */}
            <div className="flex items-center gap-2">
              <span className="px-3.5 py-1.5 rounded-xl text-xs font-bold bg-sky-600 text-white shadow-xs">
                Active Inpatients ({filteredPatients.length})
              </span>
            </div>
          </div>
        </Card>

        {/* Patient Table */}
        <Card>
          {loading ? (
            <Loading message="Loading patient records from hospital directory..." />
          ) : filteredPatients.length === 0 ? (
            <EmptyState
              icon={Users}
              title={search.trim() ? "No Matching Patients" : "No Patients Found"}
              description={
                search.trim()
                  ? "No registered active patients matched your search criteria."
                  : "There are currently no active inpatients in the hospital directory."
              }
              actionLabel={search.trim() ? "Clear Search" : "Register Patient"}
              onAction={() => {
                if (search.trim()) {
                  setSearch("")
                  setCurrentPage(1)
                } else {
                  navigate("/hospital/patients/new")
                }
              }}
            />
          ) : (
            <div>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50/70 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                      <th
                        className="py-3 px-4 cursor-pointer hover:text-slate-800 select-none"
                        onClick={() => handleSort("name")}
                      >
                        <div className="flex items-center gap-1">
                          <span>Patient Name</span>
                          <ArrowUpDown className="w-3 h-3 text-slate-400" />
                        </div>
                      </th>
                      <th
                        className="py-3 px-4 cursor-pointer hover:text-slate-800 select-none"
                        onClick={() => handleSort("id")}
                      >
                        <div className="flex items-center gap-1">
                          <span>Patient ID</span>
                          <ArrowUpDown className="w-3 h-3 text-slate-400" />
                        </div>
                      </th>
                      <th
                        className="py-3 px-4 cursor-pointer hover:text-slate-800 select-none"
                        onClick={() => handleSort("dob")}
                      >
                        <div className="flex items-center gap-1">
                          <span>Date of Birth</span>
                          <ArrowUpDown className="w-3 h-3 text-slate-400" />
                        </div>
                      </th>
                      <th className="py-3 px-4">Contact Info</th>
                      <th className="py-3 px-4">Status</th>
                      <th className="py-3 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-sm">
                    {paginatedPatients.map((patient) => {
                      const initials = `${patient.first_name?.charAt(0) || ""}${
                        patient.last_name?.charAt(0) || ""
                      }`.toUpperCase()

                      return (
                        <tr
                          key={patient.id || patient.patient_id}
                          className="hover:bg-slate-50/80 transition-colors"
                        >
                          {/* Name & Avatar */}
                          <td className="py-3.5 px-4 whitespace-nowrap">
                            <div className="flex items-center gap-3">
                              <div className="w-9 h-9 rounded-xl bg-sky-100 text-sky-700 flex items-center justify-center text-xs font-bold shrink-0">
                                {initials || "P"}
                              </div>
                              <div>
                                <div className="font-bold text-slate-900">
                                  {patient.first_name} {patient.last_name}
                                </div>
                                <div className="text-xs text-slate-500">
                                  {patient.gender || "Gender unstated"}
                                </div>
                              </div>
                            </div>
                          </td>

                          {/* Patient ID */}
                          <td className="py-3.5 px-4 whitespace-nowrap">
                            <span className="font-mono text-xs font-semibold text-sky-700 bg-sky-50 px-2.5 py-1 rounded-lg border border-sky-200/80">
                              {patient.patient_id}
                            </span>
                          </td>

                          {/* DOB */}
                          <td className="py-3.5 px-4 whitespace-nowrap text-slate-600 text-xs">
                            {formatDate(patient.date_of_birth)}
                          </td>

                          {/* Contact */}
                          <td className="py-3.5 px-4 whitespace-nowrap text-xs text-slate-600">
                            <div>{patient.mobile_number || "No phone listed"}</div>
                            {patient.email && (
                              <div className="text-slate-400 truncate max-w-xs">
                                {patient.email}
                              </div>
                            )}
                          </td>

                          {/* Status */}
                          <td className="py-3.5 px-4 whitespace-nowrap">
                            <Badge
                              variant="success"
                              size="sm"
                              dot
                            >
                              Active Inpatient
                            </Badge>
                          </td>

                          {/* Actions */}
                          <td className="py-3.5 px-4 whitespace-nowrap text-right">
                            <Button
                              size="sm"
                              variant="outline"
                              icon={Eye}
                              onClick={() =>
                                navigate(`/hospital/patients/${patient.id || patient.patient_id}`)
                              }
                            >
                              View Profile
                            </Button>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="p-4 border-t border-slate-100 flex items-center justify-between">
                  <span className="text-xs text-slate-500">
                    Showing {(currentPage - 1) * ITEMS_PER_PAGE + 1} to{" "}
                    {Math.min(currentPage * ITEMS_PER_PAGE, filteredPatients.length)} of{" "}
                    {filteredPatients.length} patients
                  </span>
                  <Pagination
                    currentPage={currentPage}
                    totalPages={totalPages}
                    onPageChange={setCurrentPage}
                  />
                </div>
              )}
            </div>
          )}
        </Card>
      </div>
    </MainLayout>
  )
}
