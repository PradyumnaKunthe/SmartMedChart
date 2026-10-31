import {
  Activity,
  AlertCircle,
  AlertTriangle,
  ArrowLeft,
  BrainCircuit,
  Building2,
  CalendarDays,
  CheckCircle2,
  Clock,
  ClipboardList,
  Edit3,
  FileText,
  LoaderCircle,
  Pill,
  Plus,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  StopCircle,
  UserRound,
  XCircle,
} from "lucide-react"

import {
  useEffect,
  useState,
} from "react"

import {
  useNavigate,
  useParams,
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
  getDoctorPatient,
  getPatientAllergies,
  getCurrentMedications,
  getPrescriptionHistory,
  stopPrescription,
} from "../../services/doctor"

function formatDate(value) {
  if (!value) return "—"
  try {
    const d = new Date(value)
    if (Number.isNaN(d.getTime())) return String(value)
    return new Intl.DateTimeFormat("en-IN", {
      month: "short",
      day: "numeric",
      year: "numeric",
    }).format(d)
  } catch {
    return String(value)
  }
}

function getSeverityBadge(severity) {
  const s = String(severity || "").toUpperCase()
  if (s === "SEVERE" || s === "HIGH") return "danger"
  if (s === "MODERATE") return "warning"
  return "neutral"
}

export default function PatientProfile() {
  const { patientId } = useParams()
  const navigate = useNavigate()

  const [patient, setPatient] = useState(null)
  const [allergies, setAllergies] = useState([])
  const [medications, setMedications] = useState([])
  const [prescriptions, setPrescriptions] = useState([])

  const [activeTab, setActiveTab] = useState("medications") // 'medications', 'prescriptions', 'allergies', 'summary'
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState("")
  const [successMessage, setSuccessMessage] = useState("")
  const [stoppingId, setStoppingId] = useState(null)

  async function loadProfile(showFullLoading = true) {
    if (!patientId) {
      setError("Patient ID is missing.")
      setLoading(false)
      return
    }

    if (showFullLoading) setLoading(true)
    else setRefreshing(true)
    setError("")

    try {
      const [patientData, allergyData, medicationData, prescriptionData] =
        await Promise.all([
          getDoctorPatient(patientId),
          getPatientAllergies(patientId),
          getCurrentMedications(patientId),
          getPrescriptionHistory(patientId),
        ])

      setPatient(patientData)
      setAllergies(Array.isArray(allergyData) ? allergyData : [])
      setMedications(Array.isArray(medicationData) ? medicationData : [])
      setPrescriptions(Array.isArray(prescriptionData) ? prescriptionData : [])
    } catch (requestError) {
      setError(
        requestError?.response?.data?.detail ||
          "Unable to load patient profile data.",
      )
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => {
    loadProfile(true)
  }, [patientId])

  function handleCreatePrescription() {
    navigate(`/doctor/prescriptions/create?patient=${patient.id}`)
  }

  function handleEditPrescription(prescription) {
    navigate(
      `/doctor/prescriptions/${prescription.prescription_id}/edit?patient=${patient.id}`,
    )
  }

  async function handleStopPrescription(prescriptionId) {
    const confirmed = window.confirm(
      "Stop this prescription order?\n\nThis will cancel remaining unadministered medication doses while preserving past administration logs.",
    )

    if (!confirmed) return

    setStoppingId(prescriptionId)
    setError("")
    setSuccessMessage("")

    try {
      const result = await stopPrescription(prescriptionId)
      setSuccessMessage(result?.message || "Prescription stopped successfully.")
      await loadProfile(false)
    } catch (requestError) {
      setError(
        requestError?.response?.data?.detail || "Unable to stop prescription.",
      )
    } finally {
      setStoppingId(null)
    }
  }

  if (loading) {
    return (
      <MainLayout
        title="Patient Medical Chart"
        subtitle="Clinical record & administration history"
      >
        <Loading
          fullScreen
          message="Loading Patient Medical Chart..."
          subtext="Fetching active prescriptions, allergies, and dosing schedules"
        />
      </MainLayout>
    )
  }

  if (!patient) {
    return (
      <MainLayout title="Patient Medical Chart">
        <div className="max-w-xl mx-auto space-y-4">
          <Button
            variant="ghost"
            size="sm"
            icon={ArrowLeft}
            onClick={() => navigate("/doctor/patients")}
          >
            Back to Patients
          </Button>
          <ErrorState
            title="Patient Chart Unavailable"
            message={error || "Patient record could not be found."}
            onRetry={() => loadProfile(true)}
          />
        </div>
      </MainLayout>
    )
  }

  const fullName =
    patient.full_name ||
    `${patient.first_name || ""} ${patient.last_name || ""}`.trim() ||
    "Inpatient"

  const initials =
    `${patient.first_name?.charAt(0) || ""}${patient.last_name?.charAt(0) || ""}`.toUpperCase() ||
    "P"

  return (
    <MainLayout
      title={`Patient Chart: ${fullName}`}
      subtitle={`Patient ID: ${patient.patient_id} · Clinical history, active regimens & safety alerts`}
    >
      <div className="space-y-6 sm:space-y-8">
        {/* Navigation Breadcrumb & Refresh */}
        <div className="flex items-center justify-between gap-4">
          <Button
            variant="ghost"
            size="sm"
            icon={ArrowLeft}
            onClick={() => navigate("/doctor/patients")}
          >
            Back to Patients Directory
          </Button>

          <div className="flex items-center gap-2.5">
            <Button
              variant="secondary"
              size="sm"
              icon={RefreshCw}
              loading={refreshing}
              onClick={() => loadProfile(false)}
            >
              Sync Chart
            </Button>
            <Button
              variant="primary"
              size="sm"
              icon={Plus}
              onClick={handleCreatePrescription}
            >
              Write Prescription
            </Button>
          </div>
        </div>

        {/* Global Feedback Notifications */}
        {error && (
          <ErrorState
            title="Clinical Action Error"
            message={error}
            onRetry={() => loadProfile(false)}
          />
        )}

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
              ✕
            </button>
          </div>
        )}

        {/* Patient Hero Card */}
        <div className="rounded-3xl border border-slate-200/90 bg-white p-6 sm:p-7 shadow-xs">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6 pb-6 border-b border-slate-100">
            <div className="flex items-center gap-4 min-w-0">
              <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-tr from-sky-600 to-sky-400 font-extrabold text-xl text-white shadow-sm">
                {initials}
              </div>

              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="font-heading text-2xl font-extrabold text-slate-900 truncate">
                    {fullName}
                  </h2>
                  <Badge
                    variant={patient.is_active ? "success" : "neutral"}
                    size="sm"
                    dot
                  >
                    {patient.is_active ? "Active Inpatient" : "Discharged"}
                  </Badge>
                  {allergies.length > 0 && (
                    <Badge variant="danger" size="sm">
                      {allergies.length} Drug {allergies.length === 1 ? "Allergy" : "Allergies"}
                    </Badge>
                  )}
                </div>

                <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500">
                  <span>
                    Patient ID: <span className="font-bold text-slate-800">{patient.patient_id}</span>
                  </span>
                  <span>·</span>
                  <span>
                    Database ID: <span className="font-medium text-slate-700">{patient.id}</span>
                  </span>
                  <span>·</span>
                  <span className="flex items-center gap-1 font-semibold text-slate-700">
                    <Building2 className="h-3.5 w-3.5 text-slate-400" />
                    {patient.bed_id ? `Bed ${patient.bed_id}` : "No Ward Bed Assigned"}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2.5">
              <Button
                variant="outline"
                size="sm"
                icon={BrainCircuit}
                onClick={() => navigate(`/doctor/ai`)}
              >
                AI Risk Model
              </Button>
              <Button
                variant="primary"
                size="sm"
                icon={Plus}
                onClick={handleCreatePrescription}
              >
                New Prescription Order
              </Button>
            </div>
          </div>

          {/* Vitals & Demographics Strip */}
          <div className="mt-6 grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
            <div className="rounded-2xl bg-slate-50/80 p-3.5 border border-slate-100">
              <span className="text-[10px] uppercase font-bold text-slate-400 block">
                Date of Birth / Age
              </span>
              <span className="font-heading font-bold text-slate-800 text-sm mt-1 block">
                {patient.date_of_birth ? formatDate(patient.date_of_birth) : "Not recorded"}
              </span>
            </div>

            <div className="rounded-2xl bg-slate-50/80 p-3.5 border border-slate-100">
              <span className="text-[10px] uppercase font-bold text-slate-400 block">
                Biological Gender
              </span>
              <span className="font-heading font-bold text-slate-800 text-sm mt-1 block capitalize">
                {patient.gender || "Not recorded"}
              </span>
            </div>

            <div className="rounded-2xl bg-slate-50/80 p-3.5 border border-slate-100">
              <span className="text-[10px] uppercase font-bold text-slate-400 block">
                Patient Body Weight
              </span>
              <span className="font-heading font-bold text-slate-800 text-sm mt-1 block">
                {patient.weight_kg ? `${patient.weight_kg} kg` : "Not recorded"}
              </span>
            </div>

            <div className="rounded-2xl bg-slate-50/80 p-3.5 border border-slate-100">
              <span className="text-[10px] uppercase font-bold text-slate-400 block">
                Bedside QR Token
              </span>
              <span className="font-heading font-bold text-slate-800 text-sm mt-1 block flex items-center gap-1.5">
                <span
                  className={`h-2 w-2 rounded-full ${
                    patient.qr_is_active ? "bg-emerald-500" : "bg-slate-300"
                  }`}
                />
                {patient.qr_is_active ? "Active Wristband" : "Not Active"}
              </span>
            </div>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="border-b border-slate-200">
          <div className="flex items-center gap-6 text-sm font-bold">
            <button
              type="button"
              onClick={() => setActiveTab("medications")}
              className={`pb-3.5 border-b-2 transition-colors flex items-center gap-2 ${
                activeTab === "medications"
                  ? "border-sky-600 text-sky-600"
                  : "border-transparent text-slate-500 hover:text-slate-800"
              }`}
            >
              <Pill className="h-4 w-4" />
              <span>Current Medications ({medications.length})</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("prescriptions")}
              className={`pb-3.5 border-b-2 transition-colors flex items-center gap-2 ${
                activeTab === "prescriptions"
                  ? "border-sky-600 text-sky-600"
                  : "border-transparent text-slate-500 hover:text-slate-800"
              }`}
            >
              <ClipboardList className="h-4 w-4" />
              <span>Prescriptions Order History ({prescriptions.length})</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("allergies")}
              className={`pb-3.5 border-b-2 transition-colors flex items-center gap-2 ${
                activeTab === "allergies"
                  ? "border-rose-600 text-rose-600"
                  : "border-transparent text-slate-500 hover:text-slate-800"
              }`}
            >
              <ShieldAlert className="h-4 w-4" />
              <span>Drug Allergies & Alerts ({allergies.length})</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("summary")}
              className={`pb-3.5 border-b-2 transition-colors flex items-center gap-2 ${
                activeTab === "summary"
                  ? "border-sky-600 text-sky-600"
                  : "border-transparent text-slate-500 hover:text-slate-800"
              }`}
            >
              <FileText className="h-4 w-4" />
              <span>Clinical Summary</span>
            </button>
          </div>
        </div>

        {/* TAB 1: CURRENT MEDICATIONS */}
        {activeTab === "medications" && (
          <div className="space-y-4 animate-fade-in">
            <div className="flex items-center justify-between">
              <h3 className="font-heading text-lg font-bold text-slate-900">
                Active Medication Dosing Schedules
              </h3>
              <p className="text-xs text-slate-500">
                Live nurse administration queue for this patient
              </p>
            </div>

            {medications.length === 0 ? (
              <EmptyState
                icon={Pill}
                title="No Active Medications"
                description="This patient currently has no active medication schedules ordered."
                actionLabel="Write New Prescription"
                actionIcon={Plus}
                onAction={handleCreatePrescription}
              />
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {medications.map((med, index) => {
                  const scheduleStatus = med.status || "SCHEDULED"
                  const isGiven = scheduleStatus === "GIVEN"
                  const isDelayed = scheduleStatus === "DELAYED"

                  return (
                    <div
                      key={med.schedule_id || index}
                      className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-xs transition hover:border-sky-300"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-sky-50 text-sky-600 font-bold">
                            <Pill className="h-5 w-5" />
                          </div>
                          <div>
                            <h4 className="font-heading font-extrabold text-slate-900 text-base">
                              {med.medicine_name}
                            </h4>
                            <p className="text-xs text-slate-500 mt-0.5">
                              {med.dosage} · Route: {med.route || "Oral"} · {med.frequency}
                            </p>
                          </div>
                        </div>

                        <Badge
                          variant={isGiven ? "success" : isDelayed ? "warning" : "primary"}
                          size="sm"
                          dot
                        >
                          {scheduleStatus}
                        </Badge>
                      </div>

                      <div className="mt-4 pt-3 border-t border-slate-100 grid grid-cols-2 gap-2 text-xs">
                        <div className="rounded-xl bg-slate-50 p-2.5">
                          <span className="text-[10px] uppercase font-bold text-slate-400 block">
                            Scheduled Time
                          </span>
                          <span className="font-bold text-slate-800 text-xs mt-0.5 block flex items-center gap-1">
                            <Clock className="h-3 w-3 text-slate-400" />
                            {med.scheduled_time || "As Directed"}
                          </span>
                        </div>
                        <div className="rounded-xl bg-slate-50 p-2.5">
                          <span className="text-[10px] uppercase font-bold text-slate-400 block">
                            Dose Date
                          </span>
                          <span className="font-bold text-slate-800 text-xs mt-0.5 block">
                            {formatDate(med.scheduled_date)}
                          </span>
                        </div>
                      </div>

                      {med.instructions && (
                        <p className="mt-3 text-xs text-slate-500 bg-slate-50/60 p-2.5 rounded-xl border border-slate-100">
                          <span className="font-semibold text-slate-700">Instructions: </span>
                          {med.instructions}
                        </p>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {/* TAB 2: PRESCRIPTIONS ORDER HISTORY */}
        {activeTab === "prescriptions" && (
          <div className="space-y-4 animate-fade-in">
            <div className="flex items-center justify-between">
              <h3 className="font-heading text-lg font-bold text-slate-900">
                Prescription Orders History
              </h3>
              <Button
                variant="primary"
                size="sm"
                icon={Plus}
                onClick={handleCreatePrescription}
              >
                New Order
              </Button>
            </div>

            {prescriptions.length === 0 ? (
              <EmptyState
                icon={ClipboardList}
                title="No Prescriptions Issued"
                description="No electronic prescriptions have been recorded for this patient yet."
                actionLabel="Write First Prescription"
                actionIcon={Plus}
                onAction={handleCreatePrescription}
              />
            ) : (
              <div className="space-y-4">
                {prescriptions.map((rx) => {
                  const isActiveRx = rx.is_active !== false
                  const items = Array.isArray(rx.items) ? rx.items : []
                  const isStopping = stoppingId === rx.prescription_id

                  return (
                    <div
                      key={rx.prescription_id}
                      className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-xs transition hover:border-sky-300"
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-slate-100">
                        <div className="flex items-center gap-3">
                          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 font-bold">
                            <ClipboardList className="h-5 w-5" />
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-mono text-xs font-bold text-slate-600">
                                #{rx.prescription_id}
                              </span>
                              <Badge
                                variant={isActiveRx ? "success" : "neutral"}
                                size="sm"
                                dot
                              >
                                {isActiveRx ? "Active Prescription" : "Stopped / Inactive"}
                              </Badge>
                            </div>
                            <p className="text-xs text-slate-400 mt-0.5">
                              Ordered on {formatDate(rx.start_date || rx.created_at)} · Doctor ID: {rx.doctor_id}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          {isActiveRx && (
                            <>
                              <Button
                                variant="secondary"
                                size="sm"
                                icon={Edit3}
                                onClick={() => handleEditPrescription(rx)}
                              >
                                Edit Rx
                              </Button>
                              <Button
                                variant="danger"
                                size="sm"
                                icon={StopCircle}
                                loading={isStopping}
                                onClick={() => handleStopPrescription(rx.prescription_id)}
                              >
                                Stop Regimen
                              </Button>
                            </>
                          )}
                        </div>
                      </div>

                      {/* Items */}
                      <div className="mt-4">
                        <span className="text-[10px] uppercase font-bold text-slate-400 block mb-2">
                          Prescribed Medication Items ({items.length})
                        </span>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                          {items.map((item, idx) => (
                            <div
                              key={item.id || idx}
                              className="rounded-xl bg-slate-50/80 p-3 border border-slate-100 flex items-center justify-between text-xs"
                            >
                              <div>
                                <p className="font-bold text-slate-900">
                                  {item.medicine_name}
                                </p>
                                <p className="text-slate-500 text-[11px] mt-0.5">
                                  {item.dosage} · Route: {item.route || "Oral"} · {item.frequency}
                                </p>
                              </div>
                              <span className="text-[11px] font-semibold text-slate-500">
                                {item.duration_days} days
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>

                      {rx.notes && (
                        <p className="mt-3 text-xs text-slate-600 bg-sky-50/50 p-2.5 rounded-xl border border-sky-100">
                          <span className="font-semibold text-sky-800">Doctor Notes: </span>
                          {rx.notes}
                        </p>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {/* TAB 3: ALLERGIES & ALERTS */}
        {activeTab === "allergies" && (
          <div className="space-y-4 animate-fade-in">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-heading text-lg font-bold text-slate-900">
                  Known Drug & Substance Allergies
                </h3>
                <p className="text-xs text-slate-500">
                  Automatic conflict checks are performed whenever prescribing for this patient
                </p>
              </div>

              <Button
                variant="outline"
                size="sm"
                icon={Plus}
                onClick={handleCreatePrescription}
              >
                Add via Prescription Form
              </Button>
            </div>

            {allergies.length === 0 ? (
              <div className="rounded-3xl border border-emerald-200/80 bg-emerald-50/40 p-8 text-center">
                <CheckCircle2 className="h-10 w-10 text-emerald-600 mx-auto" />
                <h4 className="font-heading font-bold text-emerald-900 text-base mt-3">
                  No Known Drug Allergies (NKDA)
                </h4>
                <p className="text-xs text-emerald-700 mt-1 max-w-sm mx-auto">
                  No hypersensitivities or allergic reactions have been logged on this patient chart.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {allergies.map((allergy, index) => {
                  const severityVariant = getSeverityBadge(allergy.severity)
                  return (
                    <div
                      key={allergy.id || index}
                      className="rounded-2xl border border-rose-200 bg-rose-50/30 p-5 shadow-xs"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-rose-100 text-rose-700">
                            <ShieldAlert className="h-5 w-5" />
                          </div>
                          <div>
                            <h4 className="font-heading font-extrabold text-slate-900 text-base">
                              {allergy.allergen}
                            </h4>
                            <p className="text-xs text-slate-500">
                              Substance / Drug Class
                            </p>
                          </div>
                        </div>

                        <Badge variant={severityVariant} size="sm">
                          {allergy.severity || "Reported"}
                        </Badge>
                      </div>

                      {allergy.reaction && (
                        <p className="mt-3 text-xs text-slate-700 bg-white p-2.5 rounded-xl border border-rose-100">
                          <span className="font-semibold text-rose-900">Reaction / Symptoms: </span>
                          {allergy.reaction}
                        </p>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {/* TAB 4: CLINICAL SUMMARY */}
        {activeTab === "summary" && (
          <div className="rounded-3xl border border-slate-200/90 bg-white p-6 sm:p-8 shadow-xs space-y-6 animate-fade-in">
            <h3 className="font-heading text-lg font-bold text-slate-900 pb-3 border-b border-slate-100">
              Admission Encounter & Inpatient Profile
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 text-xs">
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100 space-y-1">
                <span className="text-[10px] uppercase font-bold text-slate-400">
                  Full Legal Name
                </span>
                <p className="font-bold text-slate-900 text-sm">{fullName}</p>
              </div>

              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100 space-y-1">
                <span className="text-[10px] uppercase font-bold text-slate-400">
                  Patient Health Identifier
                </span>
                <p className="font-mono font-bold text-slate-900 text-sm">{patient.patient_id}</p>
              </div>

              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100 space-y-1">
                <span className="text-[10px] uppercase font-bold text-slate-400">
                  Internal Database UUID
                </span>
                <p className="font-mono text-slate-700 text-xs">{patient.id}</p>
              </div>

              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100 space-y-1">
                <span className="text-[10px] uppercase font-bold text-slate-400">
                  Ward & Bed Allocation
                </span>
                <p className="font-bold text-slate-900 text-sm">
                  {patient.bed_id ? `Bed ${patient.bed_id}` : "Not currently admitted"}
                </p>
              </div>

              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100 space-y-1">
                <span className="text-[10px] uppercase font-bold text-slate-400">
                  Clinical Care Status
                </span>
                <p className="font-bold text-emerald-700 text-sm">
                  {patient.is_active ? "Active Inpatient Case" : "Discharged Record"}
                </p>
              </div>

              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100 space-y-1">
                <span className="text-[10px] uppercase font-bold text-slate-400">
                  Allergy Registry Count
                </span>
                <p className="font-bold text-slate-900 text-sm">
                  {allergies.length} Drug Allergies Recorded
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </MainLayout>
  )
}