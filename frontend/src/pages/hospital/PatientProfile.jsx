import React, { useEffect, useState } from "react"
import { useNavigate, useParams } from "react-router-dom"
import {
  Activity,
  AlertCircle,
  ArrowLeft,
  Calendar,
  CheckCircle2,
  Clock,
  HeartPulse,
  Home,
  Mail,
  Phone,
  QrCode,
  ShieldAlert,
  Stethoscope,
  Thermometer,
  User,
  Users,
  Weight,
} from "lucide-react"

import MainLayout from "../../components/layout/MainLayout"
import Card, { CardHeader } from "../../components/common/Card"
import Button from "../../components/common/Button"
import Badge from "../../components/common/Badge"
import Loading from "../../components/common/Loading"
import api from "../../services/api"

function formatDate(value) {
  if (!value) return "Not available"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "Not available"
  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(date)
}

function display(val, fallback = "—") {
  if (val === null || val === undefined || val === "") return fallback
  return val
}

export default function HospitalPatientProfile() {
  const { patientId } = useParams()
  const navigate = useNavigate()

  const [patient, setPatient] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  useEffect(() => {
    async function loadPatient() {
      if (!patientId) {
        setError("Patient ID is missing.")
        setLoading(false)
        return
      }

      setLoading(true)
      setError("")

      try {
        const response = await api.get(`/api/hospital/patients/${patientId}`)
        const data = response.data?.patient ?? response.data
        setPatient(data)
      } catch (err) {
        setError(
          err?.response?.data?.detail || "Unable to load patient information."
        )
      } finally {
        setLoading(false)
      }
    }

    loadPatient()
  }, [patientId])

  if (loading) {
    return (
      <MainLayout title="Patient Profile">
        <Loading message="Loading patient chart and hospital records..." />
      </MainLayout>
    )
  }

  if (error || !patient) {
    return (
      <MainLayout title="Patient Profile">
        <div className="max-w-2xl mx-auto space-y-4">
          <Button
            variant="ghost"
            icon={ArrowLeft}
            onClick={() => navigate("/hospital/dashboard")}
          >
            Back to Hospital Dashboard
          </Button>
          <div className="p-6 bg-rose-50 border border-rose-200 rounded-3xl text-rose-700 space-y-2">
            <h3 className="font-bold text-rose-900">Patient could not be loaded</h3>
            <p className="text-sm">{error || "Patient record was not found."}</p>
          </div>
        </div>
      </MainLayout>
    )
  }

  const initials = `${patient.first_name?.charAt(0) || ""}${
    patient.last_name?.charAt(0) || ""
  }`.toUpperCase()

  return (
    <MainLayout
      title="Patient Admission Record"
      subtitle={`Patient #${patient.patient_id} · Detailed demographic and clinical encounter summary`}
    >
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Navigation & Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <Button
            variant="ghost"
            icon={ArrowLeft}
            onClick={() => navigate("/hospital/dashboard")}
          >
            Back to Dashboard
          </Button>

          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              icon={QrCode}
              onClick={() => navigate(`/admin/patient-qr?patient=${patient.id || patient.patient_id}`)}
            >
              View / Print QR Badge
            </Button>
            <Badge
              variant={patient.is_active ? "success" : "neutral"}
              size="md"
              dot={Boolean(patient.is_active)}
            >
              {patient.is_active ? "Active Inpatient" : "Discharged"}
            </Badge>
          </div>
        </div>

        {/* Patient Identity Header Banner */}
        <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-sky-500 to-indigo-600 text-white flex items-center justify-center font-black text-xl shadow-md">
              {initials || "P"}
            </div>
            <div>
              <div className="flex items-center gap-2.5">
                <h1 className="text-2xl font-bold text-slate-900">
                  {patient.first_name} {patient.last_name}
                </h1>
                <span className="font-mono text-xs font-bold text-sky-700 bg-sky-50 px-2.5 py-1 rounded-lg border border-sky-200">
                  #{patient.patient_id}
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500 mt-1">
                <span>DOB: <strong>{formatDate(patient.date_of_birth)}</strong></span>
                <span>•</span>
                <span>Gender: <strong>{display(patient.gender)}</strong></span>
                <span>•</span>
                <span>Weight: <strong>{patient.weight_kg ? `${patient.weight_kg} kg` : "—"}</strong></span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {patient.bed_number ? (
              <div className="px-4 py-2.5 bg-emerald-50 border border-emerald-200 rounded-xl text-center">
                <div className="text-[10px] font-bold uppercase tracking-wider text-emerald-700">
                  Assigned Bed
                </div>
                <div className="text-sm font-bold text-emerald-950">
                  {patient.ward_name || "Ward"} · Bed {patient.bed_number}
                </div>
              </div>
            ) : (
              <Badge variant="neutral" size="md">
                Outpatient / Unassigned Bed
              </Badge>
            )}
          </div>
        </div>

        {/* Demographics & Contact Information */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card>
            <CardHeader
              title="Contact Information"
              subtitle="Registered phone numbers and residential address"
            />
            <div className="p-6 space-y-3.5 text-sm">
              <div className="flex items-start gap-3">
                <Phone className="w-4 h-4 text-slate-400 mt-0.5 shrink-0" />
                <div>
                  <div className="text-xs text-slate-500">Mobile Phone</div>
                  <div className="font-semibold text-slate-800">
                    {display(patient.mobile_number)}
                  </div>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <Mail className="w-4 h-4 text-slate-400 mt-0.5 shrink-0" />
                <div>
                  <div className="text-xs text-slate-500">Email Address</div>
                  <div className="font-semibold text-slate-800">
                    {display(patient.email)}
                  </div>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <Home className="w-4 h-4 text-slate-400 mt-0.5 shrink-0" />
                <div>
                  <div className="text-xs text-slate-500">Residential Address</div>
                  <div className="font-semibold text-slate-800">
                    {display(patient.address)}
                  </div>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <User className="w-4 h-4 text-slate-400 mt-0.5 shrink-0" />
                <div>
                  <div className="text-xs text-slate-500">Preferred Language</div>
                  <div className="font-semibold text-slate-800">
                    {display(patient.preferred_language, "English")}
                  </div>
                </div>
              </div>
            </div>
          </Card>

          <Card>
            <CardHeader
              title="Emergency Contact"
              subtitle="Next of kin or designated primary contact"
            />
            <div className="p-6 space-y-3.5 text-sm">
              <div className="flex items-start gap-3">
                <Users className="w-4 h-4 text-slate-400 mt-0.5 shrink-0" />
                <div>
                  <div className="text-xs text-slate-500">Contact Name</div>
                  <div className="font-semibold text-slate-800">
                    {display(patient.emergency_contact_name)}
                  </div>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <Phone className="w-4 h-4 text-slate-400 mt-0.5 shrink-0" />
                <div>
                  <div className="text-xs text-slate-500">Contact Number</div>
                  <div className="font-semibold text-slate-800">
                    {display(patient.emergency_contact_number)}
                  </div>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <HeartPulse className="w-4 h-4 text-slate-400 mt-0.5 shrink-0" />
                <div>
                  <div className="text-xs text-slate-500">Relationship</div>
                  <div className="font-semibold text-slate-800">
                    {display(patient.emergency_contact_relationship)}
                  </div>
                </div>
              </div>
            </div>
          </Card>
        </div>

        {/* Clinical History & Visit Notes */}
        <Card>
          <CardHeader
            title="Clinical Intake & Encounter Notes"
            subtitle="Presenting complaints, allergies, and medical history recorded at admission"
          />
          <div className="p-6 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-4 bg-slate-50 border border-slate-200/80 rounded-2xl space-y-1">
                <div className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  Problem Category
                </div>
                <div className="text-sm font-bold text-slate-900">
                  {display(patient.problem_category)}
                </div>
              </div>

              <div className="p-4 bg-slate-50 border border-slate-200/80 rounded-2xl space-y-1">
                <div className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  Chief Complaint
                </div>
                <div className="text-sm font-semibold text-slate-900">
                  {display(patient.chief_complaint || patient.visit_notes)}
                </div>
              </div>
            </div>

            {patient.medical_history_notes && (
              <div className="p-4 bg-slate-50 border border-slate-200/80 rounded-2xl space-y-1">
                <div className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  Medical History
                </div>
                <p className="text-sm text-slate-700 leading-relaxed">
                  {patient.medical_history_notes}
                </p>
              </div>
            )}

            {patient.allergy_notes && (
              <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl space-y-1">
                <div className="text-xs font-bold uppercase tracking-wider text-rose-800 flex items-center gap-1.5">
                  <ShieldAlert className="w-3.5 h-3.5 text-rose-600" /> Documented Allergies
                </div>
                <p className="text-sm text-rose-950 font-semibold leading-relaxed">
                  {patient.allergy_notes}
                </p>
              </div>
            )}
          </div>
        </Card>
      </div>
    </MainLayout>
  )
}