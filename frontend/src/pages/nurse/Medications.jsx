import React, { useEffect, useMemo, useState } from "react"
import { useNavigate } from "react-router-dom"
import {
  AlertTriangle,
  ArrowUpDown,
  Calendar,
  CheckCircle2,
  Clock,
  Eye,
  Filter,
  Pill,
  QrCode,
  RefreshCw,
  Search,
  ShieldAlert,
  User,
  Zap,
} from "lucide-react"

import MainLayout from "../../components/layout/MainLayout"
import Card, { CardHeader } from "../../components/common/Card"
import Button from "../../components/common/Button"
import Badge from "../../components/common/Badge"
import Loading from "../../components/common/Loading"
import EmptyState from "../../components/common/EmptyState"
import Pagination from "../../components/common/Pagination"
import { getNurseMedications } from "../../services/medications"
import { hideTestPatients } from "../../utils/patientFilter"

function normalizeStatus(status) {
  return String(status || "").trim().toUpperCase().replace(/_/g, " ")
}

function getStatusBadgeVariant(status) {
  switch (normalizeStatus(status)) {
    case "GIVEN":
      return "success"
    case "DELAYED":
      return "warning"
    case "HELD":
      return "neutral"
    case "REFUSED":
    case "NOT GIVEN":
      return "danger"
    default:
      return "primary"
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

const ITEMS_PER_PAGE = 10

export default function Medications() {
  const navigate = useNavigate()

  const [medications, setMedications] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  // Filter & Search & Sort
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState("ALL")
  const [sortBy, setSortBy] = useState("time") // "time", "patient", "status"
  const [sortOrder, setSortOrder] = useState("asc")
  const [currentPage, setCurrentPage] = useState(1)

  async function loadMedications() {
    setLoading(true)
    setError("")
    try {
      const response = await getNurseMedications()
      const data = Array.isArray(response) ? response : []
      setMedications(hideTestPatients(data))
    } catch (err) {
      setError(
        err?.response?.data?.detail || "Unable to load medication schedule queue."
      )
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadMedications()
  }, [])

  // Filter and sort
  const filteredMedications = useMemo(() => {
    let result = [...medications]

    // Search term
    if (search.trim()) {
      const term = search.toLowerCase()
      result = result.filter(
        (m) =>
          (m.patient_name && m.patient_name.toLowerCase().includes(term)) ||
          (m.patient_code && m.patient_code.toLowerCase().includes(term)) ||
          (m.medicine_name && m.medicine_name.toLowerCase().includes(term)) ||
          (m.dosage && m.dosage.toLowerCase().includes(term))
      )
    }

    // Status filter
    if (statusFilter !== "ALL") {
      result = result.filter((m) => {
        const s = normalizeStatus(m.status)
        if (statusFilter === "UPCOMING") return s === "UPCOMING"
        if (statusFilter === "GIVEN") return s === "GIVEN"
        if (statusFilter === "DELAYED") return s === "DELAYED"
        if (statusFilter === "STAT") return Boolean(m.is_stat)
        if (statusFilter === "ATTENTION")
          return s === "DELAYED" || s === "HELD" || s === "REFUSED" || s === "NOT GIVEN"
        return true
      })
    }

    // Sort
    result.sort((a, b) => {
      let comparison = 0
      if (sortBy === "patient") {
        comparison = (a.patient_name || "").localeCompare(b.patient_name || "")
      } else if (sortBy === "status") {
        comparison = (a.status || "").localeCompare(b.status || "")
      } else {
        // Default: time
        const timeA = `${a.scheduled_date || ""} ${a.scheduled_time || ""}`
        const timeB = `${b.scheduled_date || ""} ${b.scheduled_time || ""}`
        comparison = timeA.localeCompare(timeB)
      }
      return sortOrder === "asc" ? comparison : -comparison
    })

    return result
  }, [medications, search, statusFilter, sortBy, sortOrder])

  // Pagination
  const totalPages = Math.ceil(filteredMedications.length / ITEMS_PER_PAGE) || 1
  const paginatedMedications = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE
    return filteredMedications.slice(start, start + ITEMS_PER_PAGE)
  }, [filteredMedications, currentPage])

  function handleSort(key) {
    if (sortBy === key) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc")
    } else {
      setSortBy(key)
      setSortOrder("asc")
    }
  }

  return (
    <MainLayout
      title="Medication Administration Queue"
      subtitle="Comprehensive roster of inpatient scheduled doses, timing, and administration outcomes"
    >
      <div className="space-y-6">
        {/* Top Action Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Badge variant="primary" size="md">
              Total Queue: {medications.length} Doses
            </Badge>
            <Badge variant="success" size="md">
              Given: {medications.filter((m) => normalizeStatus(m.status) === "GIVEN").length}
            </Badge>
          </div>

          <div className="flex items-center gap-3">
            <Button
              variant="primary"
              icon={QrCode}
              onClick={() => navigate("/nurse/scanner")}
            >
              Verify Patient Wristband
            </Button>
            <Button
              variant="outline"
              icon={RefreshCw}
              loading={loading}
              onClick={loadMedications}
            >
              Refresh
            </Button>
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

        {/* Filter and Search Panel */}
        <Card>
          <div className="p-4 space-y-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
              {/* Search */}
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search by patient, medication name, or ID..."
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

              {/* Status Filter Buttons */}
              <div className="flex flex-wrap items-center gap-1.5">
                {[
                  { id: "ALL", label: "All" },
                  { id: "UPCOMING", label: "Upcoming" },
                  { id: "STAT", label: "STAT Urgent" },
                  { id: "ATTENTION", label: "Attention" },
                  { id: "GIVEN", label: "Administered" },
                ].map((tab) => {
                  const active = statusFilter === tab.id
                  return (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => {
                        setStatusFilter(tab.id)
                        setCurrentPage(1)
                      }}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                        active
                          ? "bg-sky-600 text-white shadow-xs"
                          : "bg-slate-100 text-slate-600 hover:bg-slate-200/70"
                      }`}
                    >
                      {tab.label}
                    </button>
                  )
                })}
              </div>
            </div>
          </div>
        </Card>

        {/* Medication Table */}
        <Card>
          {loading ? (
            <Loading message="Loading medication schedule roster..." />
          ) : filteredMedications.length === 0 ? (
            <EmptyState
              icon={Pill}
              title="No Medication Schedules Found"
              description="No active dosing schedules matched your current search or status filter."
              actionLabel="Reset Filters"
              onAction={() => {
                setSearch("")
                setStatusFilter("ALL")
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
                        onClick={() => handleSort("time")}
                      >
                        <div className="flex items-center gap-1">
                          <span>Scheduled Time</span>
                          <ArrowUpDown className="w-3 h-3 text-slate-400" />
                        </div>
                      </th>
                      <th
                        className="py-3 px-4 cursor-pointer hover:text-slate-800 select-none"
                        onClick={() => handleSort("patient")}
                      >
                        <div className="flex items-center gap-1">
                          <span>Patient</span>
                          <ArrowUpDown className="w-3 h-3 text-slate-400" />
                        </div>
                      </th>
                      <th className="py-3 px-4">Medication & Dose</th>
                      <th className="py-3 px-4">Route & Frequency</th>
                      <th
                        className="py-3 px-4 cursor-pointer hover:text-slate-800 select-none"
                        onClick={() => handleSort("status")}
                      >
                        <div className="flex items-center gap-1">
                          <span>Status</span>
                          <ArrowUpDown className="w-3 h-3 text-slate-400" />
                        </div>
                      </th>
                      <th className="py-3 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-sm">
                    {paginatedMedications.map((item) => {
                      const isUpcoming = normalizeStatus(item.status) === "UPCOMING"
                      return (
                        <tr
                          key={item.id}
                          className="hover:bg-slate-50/80 transition-colors"
                        >
                          {/* Scheduled Time */}
                          <td className="py-3.5 px-4 whitespace-nowrap">
                            <div className="flex items-center gap-2">
                              <Clock className="w-4 h-4 text-sky-600" />
                              <div>
                                <div className="font-bold text-slate-900">
                                  {formatTime(item.scheduled_time)}
                                </div>
                                <div className="text-[11px] text-slate-500">
                                  {formatDate(item.scheduled_date)}
                                </div>
                              </div>
                            </div>
                          </td>

                          {/* Patient */}
                          <td className="py-3.5 px-4 whitespace-nowrap">
                            <div className="flex items-center gap-2">
                              <div className="w-8 h-8 rounded-lg bg-sky-100 text-sky-700 flex items-center justify-center text-xs font-bold shrink-0">
                                <User className="w-4 h-4" />
                              </div>
                              <div>
                                <div className="font-semibold text-slate-900">
                                  {item.patient_name || "Unknown"}
                                </div>
                                <div className="text-[11px] font-mono text-slate-500">
                                  {item.patient_code || `#${item.patient_id}`}
                                </div>
                              </div>
                            </div>
                          </td>

                          {/* Medication */}
                          <td className="py-3.5 px-4">
                            <div className="flex items-center gap-2">
                              <div>
                                <div className="font-bold text-slate-900 flex items-center gap-1.5">
                                  <span>{item.medicine_name || item.name}</span>
                                  {item.is_stat && (
                                    <Badge variant="warning" size="sm">
                                      <Zap className="w-3 h-3 mr-0.5 fill-current" /> STAT
                                    </Badge>
                                  )}
                                </div>
                                <div className="text-xs text-slate-500 font-medium">
                                  {item.dosage || item.dose || "Standard dose"}
                                </div>
                              </div>
                            </div>
                          </td>

                          {/* Route & Frequency */}
                          <td className="py-3.5 px-4 whitespace-nowrap">
                            <div className="text-xs text-slate-700 font-semibold">
                              {item.route || "Oral"}
                            </div>
                            <div className="text-[11px] text-slate-500">
                              {item.frequency || "Daily"}
                            </div>
                          </td>

                          {/* Status */}
                          <td className="py-3.5 px-4 whitespace-nowrap">
                            <Badge
                              variant={getStatusBadgeVariant(item.status)}
                              size="sm"
                            >
                              {normalizeStatus(item.status)}
                            </Badge>
                          </td>

                          {/* Actions */}
                          <td className="py-3.5 px-4 whitespace-nowrap text-right">
                            <div className="flex items-center justify-end gap-2">
                              <Button
                                size="sm"
                                variant={isUpcoming ? "primary" : "outline"}
                                icon={isUpcoming ? QrCode : Eye}
                                onClick={() => navigate(`/nurse/medications/${item.id}`)}
                              >
                                {isUpcoming ? "Administer" : "Details"}
                              </Button>
                            </div>
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
                    {Math.min(currentPage * ITEMS_PER_PAGE, filteredMedications.length)} of{" "}
                    {filteredMedications.length} medication schedules
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