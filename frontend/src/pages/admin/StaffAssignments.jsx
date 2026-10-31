import {
  AlertCircle,
  Building2,
  CheckCircle2,
  ChevronDown,
  ClipboardList,
  Filter,
  Loader2,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
  Stethoscope,
  Trash2,
  UserCheck,
  UserPlus,
  UserRound,
  Users,
  X,
  XCircle,
} from "lucide-react"

import { useEffect, useMemo, useState } from "react"
import MainLayout from "../../components/layout/MainLayout"
import Badge from "../../components/common/Badge"
import Button from "../../components/common/Button"
import Card, { CardHeader } from "../../components/common/Card"
import EmptyState from "../../components/common/EmptyState"
import ErrorState from "../../components/common/ErrorState"
import Loading from "../../components/common/Loading"
import Modal from "../../components/common/Modal"
import Pagination from "../../components/common/Pagination"
import StatCard from "../../components/dashboard/StatCard"

import {
  assignPatientToDoctor,
  assignPatientToNurse,
  createStaff,
  getAdminAssignments,
  getAdminDoctors,
  getAdminNurses,
  getAdminPatients,
  getDoctorAssignments,
  removePatientAssignment,
  removePatientFromDoctor,
} from "../../services/admin"

export default function StaffAssignments() {
  const [activeTab, setActiveTab] = useState("assignments") // 'assignments', 'assign_new', 'add_staff'
  const [subTab, setSubTab] = useState("all") // 'all', 'doctors', 'nurses'
  const [search, setSearch] = useState("")

  // Data
  const [nurses, setNurses] = useState([])
  const [doctors, setDoctors] = useState([])
  const [patients, setPatients] = useState([])
  const [assignments, setAssignments] = useState([])
  const [doctorAssignments, setDoctorAssignments] = useState([])

  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState("")

  // Form states
  const [savingStaff, setSavingStaff] = useState(false)
  const [assigningNurse, setAssigningNurse] = useState(false)
  const [assigningDoctor, setAssigningDoctor] = useState(false)
  const [removingId, setRemovingId] = useState(null)
  const [doctorRemovingId, setDoctorRemovingId] = useState(null)

  // Forms
  const [staffForm, setStaffForm] = useState({
    full_name: "",
    username: "",
    email: "",
    password: "",
    role: "nurse",
  })

  const [assignmentForm, setAssignmentForm] = useState({
    nurse_id: "",
    patient_id: "",
  })

  const [doctorAssignmentForm, setDoctorAssignmentForm] = useState({
    doctor_id: "",
    patient_id: "",
  })

  // Notifications
  const [successMessage, setSuccessMessage] = useState("")
  const [errorMessage, setErrorMessage] = useState("")

  async function loadData(isManual = false) {
    if (isManual) setRefreshing(true)
    else setLoading(true)
    setError("")

    try {
      const [
        nurseData,
        doctorData,
        patientData,
        nurseAssignmentsData,
        doctorAssignmentsData,
      ] = await Promise.all([
        getAdminNurses(),
        getAdminDoctors(),
        getAdminPatients(),
        getAdminAssignments(),
        getDoctorAssignments(),
      ])

      setNurses(Array.isArray(nurseData?.nurses) ? nurseData.nurses : [])
      setDoctors(Array.isArray(doctorData?.doctors) ? doctorData.doctors : [])
      setPatients(Array.isArray(patientData?.patients) ? patientData.patients : [])
      setAssignments(
        Array.isArray(nurseAssignmentsData?.assignments)
          ? nurseAssignmentsData.assignments
          : [],
      )
      setDoctorAssignments(
        Array.isArray(doctorAssignmentsData?.assignments)
          ? doctorAssignmentsData.assignments
          : [],
      )
    } catch (err) {
      console.error("Load assignments error:", err)
      setError(
        err?.response?.data?.detail ||
          "Unable to load staff and assignments data.",
      )
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  // Create Staff
  async function handleCreateStaff(e) {
    e.preventDefault()
    setSavingStaff(true)
    setSuccessMessage("")
    setErrorMessage("")

    try {
      const result = await createStaff(
        staffForm.full_name.trim(),
        staffForm.username.trim(),
        staffForm.email.trim(),
        staffForm.password,
        staffForm.role,
      )

      setSuccessMessage(result?.message || "Staff account created successfully.")
      setStaffForm({
        full_name: "",
        username: "",
        email: "",
        password: "",
        role: "nurse",
      })

      // Reload
      await loadData(true)
      setActiveTab("assignments")
    } catch (err) {
      setErrorMessage(err?.response?.data?.detail || "Unable to create staff.")
    } finally {
      setSavingStaff(false)
    }
  }

  // Assign Nurse
  async function handleAssignNurse(e) {
    e.preventDefault()
    if (!assignmentForm.nurse_id || !assignmentForm.patient_id) {
      setErrorMessage("Select both a nurse and a patient.")
      return
    }

    setAssigningNurse(true)
    setSuccessMessage("")
    setErrorMessage("")

    try {
      const result = await assignPatientToNurse(
        assignmentForm.nurse_id,
        assignmentForm.patient_id,
      )

      setSuccessMessage(result?.message || "Patient successfully assigned to nurse.")
      setAssignmentForm({ nurse_id: "", patient_id: "" })
      await loadData(true)
      setActiveTab("assignments")
    } catch (err) {
      setErrorMessage(err?.response?.data?.detail || "Unable to assign nurse.")
    } finally {
      setAssigningNurse(false)
    }
  }

  // Assign Doctor
  async function handleAssignDoctor(e) {
    e.preventDefault()
    if (!doctorAssignmentForm.doctor_id || !doctorAssignmentForm.patient_id) {
      setErrorMessage("Select both an attending doctor and a patient.")
      return
    }

    setAssigningDoctor(true)
    setSuccessMessage("")
    setErrorMessage("")

    try {
      const result = await assignPatientToDoctor(
        doctorAssignmentForm.doctor_id,
        doctorAssignmentForm.patient_id,
      )

      setSuccessMessage(result?.message || "Patient successfully assigned to doctor.")
      setDoctorAssignmentForm({ doctor_id: "", patient_id: "" })
      await loadData(true)
      setActiveTab("assignments")
    } catch (err) {
      setErrorMessage(err?.response?.data?.detail || "Unable to assign doctor.")
    } finally {
      setAssigningDoctor(false)
    }
  }

  // Remove Nurse Assignment
  async function handleRemoveNurseAssignment(assignmentId) {
    if (!window.confirm("Remove this nurse patient assignment?")) return
    setRemovingId(assignmentId)

    try {
      await removePatientAssignment(assignmentId)
      setSuccessMessage("Nurse assignment removed.")
      await loadData(true)
    } catch (err) {
      alert(err?.response?.data?.detail || "Unable to remove assignment.")
    } finally {
      setRemovingId(null)
    }
  }

  // Remove Doctor Assignment
  async function handleRemoveDoctorAssignment(encounterId) {
    if (!window.confirm("Remove this doctor patient assignment?")) return
    setDoctorRemovingId(encounterId)

    try {
      await removePatientFromDoctor(encounterId)
      setSuccessMessage("Doctor encounter assignment removed.")
      await loadData(true)
    } catch (err) {
      alert(err?.response?.data?.detail || "Unable to remove doctor assignment.")
    } finally {
      setDoctorRemovingId(null)
    }
  }

  // Filtered lists
  const filteredNurseAssignments = useMemo(() => {
    if (!search.trim()) return assignments
    const q = search.toLowerCase()
    return assignments.filter(
      (a) =>
        (a.nurse_name || "").toLowerCase().includes(q) ||
        (a.patient_name || "").toLowerCase().includes(q) ||
        (a.patient_id || "").toLowerCase().includes(q),
    )
  }, [assignments, search])

  const filteredDoctorAssignments = useMemo(() => {
    if (!search.trim()) return doctorAssignments
    const q = search.toLowerCase()
    return doctorAssignments.filter(
      (a) =>
        (a.doctor_name || "").toLowerCase().includes(q) ||
        (a.patient_name || "").toLowerCase().includes(q) ||
        (a.patient_id || "").toLowerCase().includes(q),
    )
  }, [doctorAssignments, search])

  if (loading) {
    return (
      <MainLayout
        title="Staff & Patient Assignments"
        subtitle="Clinical role administration & patient encounter assignments"
      >
        <Loading
          fullScreen
          message="Loading Staff & Care Assignments..."
          subtext="Fetching clinical rosters, active assignments and patient rosters"
        />
      </MainLayout>
    )
  }

  return (
    <MainLayout
      title="Staff & Patient Assignments"
      subtitle="Coordinate clinical doctor encounters, nurse shift allocations, and staff provisioning"
    >
      <div className="space-y-6 sm:space-y-8">
        {/* Top Header Actions */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="flex h-2 w-2 rounded-full bg-sky-500 animate-pulse" />
              <p className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Administration Portal
              </p>
            </div>
            <h2 className="font-heading text-2xl font-extrabold text-slate-900 mt-1">
              Clinical Team & Care Allocations
            </h2>
          </div>

          <div className="flex items-center gap-2.5">
            <Button
              variant="secondary"
              size="sm"
              icon={RefreshCw}
              loading={refreshing}
              onClick={() => loadData(true)}
            >
              Refresh
            </Button>
            <Button
              variant={activeTab === "assign_new" ? "primary" : "secondary"}
              size="sm"
              icon={UserCheck}
              onClick={() => setActiveTab("assign_new")}
            >
              Assign Patient
            </Button>
            <Button
              variant={activeTab === "add_staff" ? "primary" : "secondary"}
              size="sm"
              icon={UserPlus}
              onClick={() => setActiveTab("add_staff")}
            >
              New Staff Account
            </Button>
          </div>
        </div>

        {/* Global Notifications */}
        {successMessage && (
          <div className="flex items-center justify-between gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs font-semibold text-emerald-800 animate-fade-in">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
              <span>{successMessage}</span>
            </div>
            <button
              type="button"
              onClick={() => setSuccessMessage("")}
              className="text-emerald-600 hover:text-emerald-900"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        {errorMessage && (
          <div className="flex items-center justify-between gap-3 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs font-semibold text-rose-800 animate-fade-in">
            <div className="flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-rose-600 shrink-0" />
              <span>{errorMessage}</span>
            </div>
            <button
              type="button"
              onClick={() => setErrorMessage("")}
              className="text-rose-600 hover:text-rose-900"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        {error && (
          <ErrorState
            title="Assignment Service Issue"
            message={error}
            onRetry={() => loadData(true)}
          />
        )}

        {/* Aggregate KPI Stat Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            title="Registered Doctors"
            value={doctors.length}
            description="Attending physicians"
            icon={Stethoscope}
            variant="sky"
          />
          <StatCard
            title="Registered Nurses"
            value={nurses.length}
            description="Ward care nurses"
            icon={UserRound}
            variant="emerald"
          />
          <StatCard
            title="Doctor Encounters"
            value={doctorAssignments.length}
            description="Active doctor patient cases"
            icon={ClipboardList}
            variant="indigo"
          />
          <StatCard
            title="Nurse Assignments"
            value={assignments.length}
            description="Active shift care links"
            icon={UserCheck}
            variant="amber"
          />
        </div>

        {/* Navigation Tabs */}
        <div className="border-b border-slate-200">
          <div className="flex items-center gap-6 text-sm font-bold">
            <button
              type="button"
              onClick={() => setActiveTab("assignments")}
              className={`pb-3 border-b-2 transition-colors ${
                activeTab === "assignments"
                  ? "border-sky-600 text-sky-600"
                  : "border-transparent text-slate-500 hover:text-slate-800"
              }`}
            >
              Active Assignments ({assignments.length + doctorAssignments.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("assign_new")}
              className={`pb-3 border-b-2 transition-colors ${
                activeTab === "assign_new"
                  ? "border-sky-600 text-sky-600"
                  : "border-transparent text-slate-500 hover:text-slate-800"
              }`}
            >
              Assign Patient to Staff
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("add_staff")}
              className={`pb-3 border-b-2 transition-colors ${
                activeTab === "add_staff"
                  ? "border-sky-600 text-sky-600"
                  : "border-transparent text-slate-500 hover:text-slate-800"
              }`}
            >
              Create Staff Account
            </button>
          </div>
        </div>

        {/* TAB 1: ASSIGNMENTS BOARD */}
        {activeTab === "assignments" && (
          <div className="space-y-6">
            {/* Filter toolbar */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 rounded-2xl border border-slate-200/90 bg-white p-3 shadow-xs">
              <div className="flex items-center gap-1.5 w-full sm:w-auto">
                <button
                  type="button"
                  onClick={() => setSubTab("all")}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition ${
                    subTab === "all"
                      ? "bg-slate-900 text-white shadow-xs"
                      : "text-slate-600 hover:bg-slate-100"
                  }`}
                >
                  All ({assignments.length + doctorAssignments.length})
                </button>
                <button
                  type="button"
                  onClick={() => setSubTab("doctors")}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition ${
                    subTab === "doctors"
                      ? "bg-sky-600 text-white shadow-xs"
                      : "text-slate-600 hover:bg-slate-100"
                  }`}
                >
                  Doctor Encounters ({doctorAssignments.length})
                </button>
                <button
                  type="button"
                  onClick={() => setSubTab("nurses")}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition ${
                    subTab === "nurses"
                      ? "bg-emerald-600 text-white shadow-xs"
                      : "text-slate-600 hover:bg-slate-100"
                  }`}
                >
                  Nurse Allocations ({assignments.length})
                </button>
              </div>

              <div className="relative w-full sm:w-72">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Filter by staff or patient..."
                  className="w-full rounded-xl border border-slate-200 bg-slate-50/70 py-2 pl-9 pr-8 text-xs font-medium text-slate-900 outline-none transition focus:border-sky-500 focus:bg-white focus:ring-2 focus:ring-sky-100"
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
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Doctor Assignments Column */}
              {(subTab === "all" || subTab === "doctors") && (
                <div className={`space-y-3 ${subTab === "doctors" ? "lg:col-span-2" : ""}`}>
                  <div className="flex items-center justify-between pb-2 border-b border-slate-200">
                    <div className="flex items-center gap-2">
                      <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-sky-50 text-sky-600">
                        <Stethoscope className="h-4 w-4" />
                      </div>
                      <h3 className="font-heading text-base font-bold text-slate-900">
                        Doctor Patient Encounters
                      </h3>
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-bold text-slate-600">
                        {filteredDoctorAssignments.length}
                      </span>
                    </div>
                  </div>

                  {filteredDoctorAssignments.length === 0 ? (
                    <EmptyState
                      icon={Stethoscope}
                      title="No Doctor Assignments"
                      description="No active doctor encounters match your query."
                    />
                  ) : (
                    <div className="space-y-3">
                      {filteredDoctorAssignments.map((a) => (
                        <div
                          key={a.encounter_id || a.id}
                          className="rounded-2xl border border-slate-200/90 bg-white p-4 shadow-xs flex items-center justify-between gap-3 hover:border-sky-300 transition"
                        >
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <Badge variant="primary" size="sm">
                                Dr. {a.doctor_name}
                              </Badge>
                              <span className="text-xs text-slate-400">→</span>
                              <span className="font-heading font-bold text-slate-900 text-sm truncate">
                                {a.patient_name}
                              </span>
                            </div>
                            <p className="text-xs text-slate-500 mt-1">
                              Patient ID: <span className="font-semibold text-slate-700">{a.patient_id}</span>
                              {a.encounter_type && ` · Encounter: ${a.encounter_type}`}
                            </p>
                          </div>

                          <Button
                            variant="ghost"
                            size="sm"
                            icon={Trash2}
                            loading={doctorRemovingId === (a.encounter_id || a.id)}
                            onClick={() => handleRemoveDoctorAssignment(a.encounter_id || a.id)}
                            className="text-slate-400 hover:text-rose-600"
                            title="Remove Doctor Assignment"
                          >
                            Unassign
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Nurse Assignments Column */}
              {(subTab === "all" || subTab === "nurses") && (
                <div className={`space-y-3 ${subTab === "nurses" ? "lg:col-span-2" : ""}`}>
                  <div className="flex items-center justify-between pb-2 border-b border-slate-200">
                    <div className="flex items-center gap-2">
                      <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600">
                        <UserRound className="h-4 w-4" />
                      </div>
                      <h3 className="font-heading text-base font-bold text-slate-900">
                        Nurse Patient Allocations
                      </h3>
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-bold text-slate-600">
                        {filteredNurseAssignments.length}
                      </span>
                    </div>
                  </div>

                  {filteredNurseAssignments.length === 0 ? (
                    <EmptyState
                      icon={UserRound}
                      title="No Nurse Assignments"
                      description="No active nurse care assignments match your query."
                    />
                  ) : (
                    <div className="space-y-3">
                      {filteredNurseAssignments.map((a) => (
                        <div
                          key={a.assignment_id || a.id}
                          className="rounded-2xl border border-slate-200/90 bg-white p-4 shadow-xs flex items-center justify-between gap-3 hover:border-emerald-300 transition"
                        >
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <Badge variant="success" size="sm">
                                Nurse: {a.nurse_name}
                              </Badge>
                              <span className="text-xs text-slate-400">→</span>
                              <span className="font-heading font-bold text-slate-900 text-sm truncate">
                                {a.patient_name}
                              </span>
                            </div>
                            <p className="text-xs text-slate-500 mt-1">
                              Patient ID: <span className="font-semibold text-slate-700">{a.patient_id}</span>
                            </p>
                          </div>

                          <Button
                            variant="ghost"
                            size="sm"
                            icon={Trash2}
                            loading={removingId === (a.assignment_id || a.id)}
                            onClick={() => handleRemoveNurseAssignment(a.assignment_id || a.id)}
                            className="text-slate-400 hover:text-rose-600"
                            title="Remove Nurse Assignment"
                          >
                            Unassign
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 2: ASSIGN PATIENT TO STAFF */}
        {activeTab === "assign_new" && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-fade-in">
            {/* Assign to Doctor */}
            <div className="rounded-3xl border border-slate-200/90 bg-white p-6 shadow-xs">
              <div className="flex items-center gap-3 pb-4 border-b border-slate-100">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-sky-50 text-sky-600">
                  <Stethoscope className="h-6 w-6" />
                </div>
                <div>
                  <h3 className="font-heading text-lg font-bold text-slate-900">
                    Assign Patient to Doctor
                  </h3>
                  <p className="text-xs text-slate-500">
                    Creates an active clinical encounter with the attending physician
                  </p>
                </div>
              </div>

              <form onSubmit={handleAssignDoctor} className="mt-5 space-y-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                    Attending Doctor *
                  </label>
                  <select
                    required
                    value={doctorAssignmentForm.doctor_id}
                    onChange={(e) =>
                      setDoctorAssignmentForm({
                        ...doctorAssignmentForm,
                        doctor_id: e.target.value,
                      })
                    }
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-xs font-semibold text-slate-900 outline-none focus:border-sky-500 focus:bg-white focus:ring-2 focus:ring-sky-100"
                  >
                    <option value="">Select a Doctor...</option>
                    {doctors.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.full_name} (@{d.username})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                    Target Patient *
                  </label>
                  <select
                    required
                    value={doctorAssignmentForm.patient_id}
                    onChange={(e) =>
                      setDoctorAssignmentForm({
                        ...doctorAssignmentForm,
                        patient_id: e.target.value,
                      })
                    }
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-xs font-semibold text-slate-900 outline-none focus:border-sky-500 focus:bg-white focus:ring-2 focus:ring-sky-100"
                  >
                    <option value="">Select a Patient...</option>
                    {patients.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.full_name} ({p.patient_id})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="pt-2">
                  <Button
                    type="submit"
                    variant="primary"
                    size="md"
                    className="w-full"
                    loading={assigningDoctor}
                    icon={CheckCircle2}
                  >
                    Assign to Doctor
                  </Button>
                </div>
              </form>
            </div>

            {/* Assign to Nurse */}
            <div className="rounded-3xl border border-slate-200/90 bg-white p-6 shadow-xs">
              <div className="flex items-center gap-3 pb-4 border-b border-slate-100">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
                  <UserRound className="h-6 w-6" />
                </div>
                <div>
                  <h3 className="font-heading text-lg font-bold text-slate-900">
                    Assign Patient to Nurse
                  </h3>
                  <p className="text-xs text-slate-500">
                    Grants access to medication administration and QR verification
                  </p>
                </div>
              </div>

              <form onSubmit={handleAssignNurse} className="mt-5 space-y-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                    Assigned Nurse *
                  </label>
                  <select
                    required
                    value={assignmentForm.nurse_id}
                    onChange={(e) =>
                      setAssignmentForm({
                        ...assignmentForm,
                        nurse_id: e.target.value,
                      })
                    }
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-xs font-semibold text-slate-900 outline-none focus:border-emerald-500 focus:bg-white focus:ring-2 focus:ring-emerald-100"
                  >
                    <option value="">Select a Nurse...</option>
                    {nurses.map((n) => (
                      <option key={n.id} value={n.id}>
                        {n.full_name} (@{n.username})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                    Target Patient *
                  </label>
                  <select
                    required
                    value={assignmentForm.patient_id}
                    onChange={(e) =>
                      setAssignmentForm({
                        ...assignmentForm,
                        patient_id: e.target.value,
                      })
                    }
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-xs font-semibold text-slate-900 outline-none focus:border-emerald-500 focus:bg-white focus:ring-2 focus:ring-emerald-100"
                  >
                    <option value="">Select a Patient...</option>
                    {patients.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.full_name} ({p.patient_id})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="pt-2">
                  <Button
                    type="submit"
                    variant="success"
                    size="md"
                    className="w-full"
                    loading={assigningNurse}
                    icon={CheckCircle2}
                  >
                    Assign to Nurse
                  </Button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* TAB 3: CREATE STAFF ACCOUNT */}
        {activeTab === "add_staff" && (
          <div className="max-w-xl mx-auto rounded-3xl border border-slate-200/90 bg-white p-6 sm:p-8 shadow-xs animate-fade-in">
            <div className="flex items-center gap-3.5 pb-5 border-b border-slate-100">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-tr from-sky-600 to-sky-400 text-white shadow-xs">
                <UserPlus className="h-6 w-6" />
              </div>
              <div>
                <h3 className="font-heading text-xl font-extrabold text-slate-900">
                  Provision Clinical Staff Account
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Create credentials for hospital doctors, nurses, or clinical personnel
                </p>
              </div>
            </div>

            <form onSubmit={handleCreateStaff} className="mt-6 space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                  Full Legal Name *
                </label>
                <input
                  type="text"
                  required
                  value={staffForm.full_name}
                  onChange={(e) => setStaffForm({ ...staffForm, full_name: e.target.value })}
                  placeholder="e.g. Dr. Priya Sharma, Nurse Ananya Sen"
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-xs font-semibold text-slate-900 outline-none focus:border-sky-500 focus:bg-white focus:ring-2 focus:ring-sky-100"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                    Username *
                  </label>
                  <input
                    type="text"
                    required
                    value={staffForm.username}
                    onChange={(e) => setStaffForm({ ...staffForm, username: e.target.value })}
                    placeholder="e.g. psharma"
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-xs font-semibold text-slate-900 outline-none focus:border-sky-500 focus:bg-white focus:ring-2 focus:ring-sky-100"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                    Clinical Role *
                  </label>
                  <select
                    required
                    value={staffForm.role}
                    onChange={(e) => setStaffForm({ ...staffForm, role: e.target.value })}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-xs font-semibold text-slate-900 outline-none focus:border-sky-500 focus:bg-white focus:ring-2 focus:ring-sky-100"
                  >
                    <option value="nurse">Nurse</option>
                    <option value="doctor">Doctor</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                  Email Address *
                </label>
                <input
                  type="email"
                  required
                  value={staffForm.email}
                  onChange={(e) => setStaffForm({ ...staffForm, email: e.target.value })}
                  placeholder="e.g. priya.sharma@hospital.org"
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-xs font-semibold text-slate-900 outline-none focus:border-sky-500 focus:bg-white focus:ring-2 focus:ring-sky-100"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                  Temporary Password *
                </label>
                <input
                  type="password"
                  required
                  minLength={6}
                  value={staffForm.password}
                  onChange={(e) => setStaffForm({ ...staffForm, password: e.target.value })}
                  placeholder="Minimum 6 characters"
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-xs font-semibold text-slate-900 outline-none focus:border-sky-500 focus:bg-white focus:ring-2 focus:ring-sky-100"
                />
              </div>

              <div className="pt-3 border-t border-slate-100">
                <Button
                  type="submit"
                  variant="primary"
                  size="md"
                  className="w-full"
                  loading={savingStaff}
                  icon={UserPlus}
                >
                  Create Clinical Account
                </Button>
              </div>
            </form>
          </div>
        )}
      </div>
    </MainLayout>
  )
}