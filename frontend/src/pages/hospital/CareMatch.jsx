import React, { useState } from "react"
import { useNavigate } from "react-router-dom"
import {
  Activity,
  AlertCircle,
  Calendar,
  CheckCircle2,
  Clock,
  DollarSign,
  FileText,
  Globe,
  GraduationCap,
  HeartPulse,
  Info,
  LoaderCircle,
  Phone,
  Search,
  Sparkles,
  Stethoscope,
  Thermometer,
  User,
  UserCheck,
} from "lucide-react"

import MainLayout from "../../components/layout/MainLayout"
import Card, { CardHeader } from "../../components/common/Card"
import Button from "../../components/common/Button"
import Badge from "../../components/common/Badge"
import api from "../../services/api"

const PROBLEMS = [
  "General Medicine — fever, weakness, general check-up",
  "Cardiology — heart, chest or blood pressure concerns",
  "Dermatology — skin, rash, itching or acne",
  "Orthopedics — bone, joint, knee or back pain",
  "Pediatrics — child or infant health",
  "Gynecology — women's health concerns",
  "Neurology — headache, migraine or nerve concerns",
  "ENT — ear, nose or throat concerns",
  "Ophthalmology — eye or vision concerns",
  "Gastroenterology — stomach or digestion concerns",
  "Pulmonology — cough, asthma or breathing concerns",
  "Endocrinology — diabetes or thyroid concerns",
  "Psychiatry — mental health concerns",
  "Urology — urinary or bladder concerns",
  "Nephrology — kidney concerns",
  "Dentistry — tooth, teeth or gum concerns",
  "Other / not sure",
]

function todayString() {
  const d = new Date()
  const month = String(d.getMonth() + 1).padStart(2, "0")
  const day = String(d.getDate()).padStart(2, "0")
  return `${d.getFullYear()}-${month}-${day}`
}

const emptyForm = () => ({
  first_name: "",
  last_name: "",
  date_of_birth: "",
  gender: "",
  weight_kg: "",
  mobile_number: "",
  email: "",
  address: "",
  emergency_contact_name: "",
  emergency_contact_number: "",
  emergency_contact_relationship: "",
  preferred_language: "",
  problem_category: "",
  symptom_duration: "",
  symptom_severity: "MODERATE",
  visit_notes: "",
  medical_history_notes: "",
  current_medication_notes: "",
  allergy_notes: "",
  blood_pressure: "",
  pulse: "",
  temperature_c: "",
  spo2_percent: "",
  height_cm: "",
  appointment_date: todayString(),
  appointment_time: "10:00",
})

export default function CareMatch() {
  const navigate = useNavigate()
  const [form, setForm] = useState(emptyForm)
  const [recommendations, setRecommendations] = useState([])
  const [selectedDoctorId, setSelectedDoctorId] = useState("")
  const [searching, setSearching] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState("")
  const [notice, setNotice] = useState("")
  const [success, setSuccess] = useState(null)
  const [pendingRegistration, setPendingRegistration] = useState(null)

  const selectedDoctor = recommendations.find(
    (doc) => String(doc.doctor_id) === String(selectedDoctorId)
  )

  function updateField(event) {
    const { name, value } = event.target
    setForm((curr) => ({ ...curr, [name]: value }))
    setError("")
    setNotice("")
    setSuccess(null)

    if (name === "problem_category" || name === "visit_notes") {
      setRecommendations([])
      setSelectedDoctorId("")
    }
  }

  function getVisitReason() {
    return [
      form.problem_category,
      form.visit_notes.trim(),
      form.symptom_duration ? `Symptom duration: ${form.symptom_duration}` : "",
      form.symptom_severity ? `Reported severity: ${form.symptom_severity}` : "",
    ]
      .filter(Boolean)
      .join(". ")
  }

  async function recommendDoctors() {
    if (!form.problem_category) {
      setError("Please select the patient's primary medical problem category first.")
      return
    }

    setSearching(true)
    setError("")
    setNotice("")
    setRecommendations([])
    setSelectedDoctorId("")

    try {
      const response = await api.post("/api/carematch/recommendations", {
        visit_reason: getVisitReason(),
        preferred_language: form.preferred_language.trim(),
      })

      const list = Array.isArray(response.data?.recommendations)
        ? response.data.recommendations
        : []

      setRecommendations(list)

      if (list.length > 0) {
        setSelectedDoctorId(String(list[0].doctor_id))
        setNotice(
          "CareMatch AI identified the following matching specialists based on symptoms, specialty, and language proficiency."
        )
      } else {
        setNotice(
          response.data?.message ||
            "No matching active doctor profiles were found for this category. Administrators can configure physician specialties in Doctor Profiles."
        )
      }
    } catch (requestError) {
      setError(
        requestError?.response?.data?.detail ||
          "Could not retrieve CareMatch recommendations. Please verify network connection."
      )
    } finally {
      setSearching(false)
    }
  }

  async function saveAppointment(registration) {
    try {
      const response = await api.post("/api/carematch/appointments", {
        patient_id: registration.patient.id,
        encounter_id: registration.encounter.id,
        doctor_id: registration.doctor_id,
        visit_reason: registration.visit_reason,
        appointment_date: registration.appointment_date,
        appointment_time: registration.appointment_time,
      })

      setSuccess({
        patient: registration.patient,
        doctorName: registration.doctor_name,
        appointment: response.data?.appointment,
      })

      setPendingRegistration(null)
      setForm(emptyForm())
      setRecommendations([])
      setSelectedDoctorId("")
      setNotice("")
      return true
    } catch (requestError) {
      setPendingRegistration(registration)
      setError(
        `Patient ${registration.patient.patient_id} was registered, but appointment booking failed. ${
          requestError?.response?.data?.detail || "Please retry."
        }`
      )
      return false
    }
  }

  async function handleSubmit(event) {
    event.preventDefault()
    setError("")
    setSuccess(null)

    if (pendingRegistration) {
      setSubmitting(true)
      await saveAppointment(pendingRegistration)
      setSubmitting(false)
      return
    }

    if (!form.first_name.trim() || !form.last_name.trim()) {
      setError("Please enter the patient's first and last name.")
      return
    }

    if (!form.problem_category) {
      setError("Please select the patient's primary medical problem category.")
      return
    }

    if (!selectedDoctor) {
      setError("Please run CareMatch and select a recommended physician.")
      return
    }

    if (!form.appointment_date || !form.appointment_time) {
      setError("Please specify the appointment date and consultation time.")
      return
    }

    if (form.appointment_date < todayString()) {
      setError("The consultation date cannot be in the past.")
      return
    }

    setSubmitting(true)

    try {
      const clinicalObservations = {
        blood_pressure: form.blood_pressure.trim() || undefined,
        pulse: form.pulse ? Number(form.pulse) : undefined,
        temperature_c: form.temperature_c ? Number(form.temperature_c) : undefined,
        spo2_percent: form.spo2_percent ? Number(form.spo2_percent) : undefined,
        height_cm: form.height_cm ? Number(form.height_cm) : undefined,
      }

      const filteredObservations = Object.fromEntries(
        Object.entries(clinicalObservations).filter(([, v]) => v !== undefined)
      )

      const patientResponse = await api.post("/api/hospital/patients", {
        first_name: form.first_name.trim(),
        last_name: form.last_name.trim(),
        date_of_birth: form.date_of_birth || null,
        gender: form.gender || null,
        weight_kg: form.weight_kg ? Number(form.weight_kg) : null,
        mobile_number: form.mobile_number.trim() || null,
        email: form.email.trim() || null,
        address: form.address.trim() || null,
        emergency_contact_name: form.emergency_contact_name.trim() || null,
        emergency_contact_number: form.emergency_contact_number.trim() || null,
        emergency_contact_relationship:
          form.emergency_contact_relationship.trim() || null,
        preferred_language: form.preferred_language.trim() || null,
        problem_category: form.problem_category,
        chief_complaint: form.visit_notes.trim() || form.problem_category,
        symptom_duration: form.symptom_duration.trim() || null,
        symptom_severity: form.symptom_severity || null,
        visit_notes: form.visit_notes.trim() || null,
        medical_history_notes: form.medical_history_notes.trim() || null,
        current_medication_notes: form.current_medication_notes.trim() || null,
        allergy_notes: form.allergy_notes.trim() || null,
        clinical_observations: filteredObservations,
        doctor_id: selectedDoctor.doctor_id,
        admit_patient: false,
      })

      const registration = {
        patient: patientResponse.data?.patient,
        encounter: patientResponse.data?.encounter,
        doctor_id: selectedDoctor.doctor_id,
        doctor_name: selectedDoctor.doctor_name,
        visit_reason: getVisitReason(),
        appointment_date: form.appointment_date,
        appointment_time: form.appointment_time,
      }

      await saveAppointment(registration)
    } catch (requestError) {
      setError(
        requestError?.response?.data?.detail ||
          "Failed to register patient and schedule appointment. Please check values and retry."
      )
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <MainLayout
      title="CareMatch AI Doctor Triage"
      subtitle="Intelligent physician matchmaking engine aligning patient symptoms with medical specialties"
    >
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Banner */}
        <div className="relative overflow-hidden bg-gradient-to-r from-sky-600 via-indigo-600 to-purple-800 rounded-3xl p-6 lg:p-8 text-white shadow-xl">
          <div className="absolute top-0 right-0 -mt-10 -mr-10 w-64 h-64 bg-white/10 rounded-full blur-2xl pointer-events-none" />
          <div className="relative z-10 max-w-2xl space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-white/15 backdrop-blur-md rounded-full text-xs font-semibold text-sky-100">
              <Sparkles className="w-3.5 h-3.5 text-sky-200" />
              CareMatch AI · Algorithmic Physician Matchmaking
            </div>
            <h1 className="text-2xl lg:text-3xl font-extrabold tracking-tight">
              Doctor Recommendation & Intake Wizard
            </h1>
            <p className="text-sky-100/90 text-sm leading-relaxed">
              Analyze chief complaints, clinical symptom severity, and language
              preferences to recommend the optimal attending doctor with transparent match
              scoring.
            </p>
          </div>
        </div>

        {/* Global Error Alert */}
        {error && (
          <div className="flex items-center gap-3 p-4 bg-rose-50 border border-rose-200 rounded-2xl text-rose-700 text-sm">
            <AlertCircle className="w-5 h-5 shrink-0 text-rose-600" />
            <div className="flex-1 font-medium">{error}</div>
          </div>
        )}

        {/* Success Modal / Banner */}
        {success && (
          <div className="p-8 bg-gradient-to-br from-emerald-50 to-teal-50 border border-emerald-200 rounded-3xl text-center space-y-4 shadow-sm">
            <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-2xl flex items-center justify-center mx-auto shadow-sm">
              <CheckCircle2 className="w-10 h-10" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-slate-900">
                Patient Registered & Appointment Scheduled!
              </h2>
              <p className="text-sm text-slate-600 mt-1 max-w-md mx-auto">
                Patient #{success.patient?.patient_id} ({success.patient?.first_name}{" "}
                {success.patient?.last_name}) is registered. Consultation booked with{" "}
                <strong className="text-slate-900">{success.doctorName}</strong> on{" "}
                <strong className="text-emerald-700">
                  {success.appointment?.appointment_date} at{" "}
                  {success.appointment?.appointment_time}
                </strong>
                .
              </p>
            </div>
            <div className="flex items-center justify-center gap-3 pt-3">
              <Button
                variant="primary"
                onClick={() => navigate(`/hospital/patients/${success.patient?.id}`)}
              >
                View Patient Chart
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  setSuccess(null)
                  setForm(emptyForm())
                }}
              >
                Intake Another Patient
              </Button>
            </div>
          </div>
        )}

        {/* Intake Wizard Form */}
        {!success && (
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Step 1: Patient Identity & Contact */}
            <Card>
              <CardHeader
                title="1. Patient Demographics & Contact"
                subtitle="Enter personal identification, phone number, and preferred language"
              />
              <div className="p-6 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                      First Name <span className="text-rose-500">*</span>
                    </label>
                    <input
                      name="first_name"
                      type="text"
                      required
                      placeholder="e.g. Rahul"
                      value={form.first_name}
                      onChange={updateField}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                      Last Name <span className="text-rose-500">*</span>
                    </label>
                    <input
                      name="last_name"
                      type="text"
                      required
                      placeholder="e.g. Sharma"
                      value={form.last_name}
                      onChange={updateField}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                      Date of Birth
                    </label>
                    <input
                      name="date_of_birth"
                      type="date"
                      value={form.date_of_birth}
                      onChange={updateField}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                      Gender
                    </label>
                    <select
                      name="gender"
                      value={form.gender}
                      onChange={updateField}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500"
                    >
                      <option value="">Select Gender</option>
                      <option value="Male">Male</option>
                      <option value="Female">Female</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                      Preferred Language
                    </label>
                    <input
                      name="preferred_language"
                      type="text"
                      placeholder="e.g. English, Hindi, Marathi"
                      value={form.preferred_language}
                      onChange={updateField}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                      Mobile Number
                    </label>
                    <input
                      name="mobile_number"
                      type="tel"
                      placeholder="e.g. +91 98765 43210"
                      value={form.mobile_number}
                      onChange={updateField}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                      Email Address
                    </label>
                    <input
                      name="email"
                      type="email"
                      placeholder="e.g. patient@example.com"
                      value={form.email}
                      onChange={updateField}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500"
                    />
                  </div>
                </div>
              </div>
            </Card>

            {/* Step 2: Clinical Symptoms & Observations */}
            <Card>
              <CardHeader
                title="2. Clinical Symptoms & Chief Complaint"
                subtitle="Select the primary specialty category and describe current issues"
              />
              <div className="p-6 space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Problem Category <span className="text-rose-500">*</span>
                  </label>
                  <select
                    name="problem_category"
                    required
                    value={form.problem_category}
                    onChange={updateField}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 font-medium"
                  >
                    <option value="">Select Primary Problem Category</option>
                    {PROBLEMS.map((prob) => (
                      <option key={prob} value={prob}>
                        {prob}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                      Symptom Duration
                    </label>
                    <input
                      name="symptom_duration"
                      type="text"
                      placeholder="e.g. 3 days, 2 weeks"
                      value={form.symptom_duration}
                      onChange={updateField}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                      Severity Level
                    </label>
                    <select
                      name="symptom_severity"
                      value={form.symptom_severity}
                      onChange={updateField}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500"
                    >
                      <option value="MILD">Mild - Routine consultation</option>
                      <option value="MODERATE">Moderate - Noticeable discomfort</option>
                      <option value="SEVERE">Severe - Urgent physician evaluation</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Chief Complaint & Symptom Notes
                  </label>
                  <textarea
                    name="visit_notes"
                    rows={2}
                    placeholder="Describe specific symptoms, onset, pain level, or medical concerns..."
                    value={form.visit_notes}
                    onChange={updateField}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 resize-none"
                  />
                </div>

                {/* Trigger CareMatch Doctor Recommendations Button */}
                <div className="pt-2 flex justify-end">
                  <Button
                    type="button"
                    variant="primary"
                    icon={Sparkles}
                    loading={searching}
                    disabled={!form.problem_category}
                    onClick={recommendDoctors}
                    className="px-6 py-2.5 shadow-sm font-bold"
                  >
                    Find Matching Doctors with CareMatch AI
                  </Button>
                </div>
              </div>
            </Card>

            {/* Step 3: CareMatch Doctor Recommendations */}
            <Card>
              <CardHeader
                title="3. Recommended Doctors"
                subtitle="Specialists matching problem category and language preference"
              />
              <div className="p-6 space-y-4">
                {notice && (
                  <div className="p-3.5 bg-sky-50 border border-sky-200 rounded-xl text-xs text-sky-900 flex items-start gap-2">
                    <Info className="w-4 h-4 text-sky-600 shrink-0 mt-0.5" />
                    <span>{notice}</span>
                  </div>
                )}

                {recommendations.length === 0 ? (
                  <div className="p-8 border border-dashed border-slate-200 rounded-2xl text-center space-y-2 bg-slate-50/50">
                    <Stethoscope className="w-10 h-10 text-slate-300 mx-auto" />
                    <h4 className="text-sm font-bold text-slate-700">
                      No Doctor Selected Yet
                    </h4>
                    <p className="text-xs text-slate-500 max-w-sm mx-auto">
                      Click the "Find Matching Doctors" button above to generate AI-tailored
                      physician recommendations.
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {recommendations.map((doctor) => {
                      const isSelected = String(doctor.doctor_id) === String(selectedDoctorId)
                      const matchPct = Math.round(Number(doctor.match_score || 0.85) * 100)

                      return (
                        <div
                          key={doctor.doctor_id}
                          onClick={() => setSelectedDoctorId(String(doctor.doctor_id))}
                          className={`p-5 rounded-2xl border transition-all cursor-pointer select-none space-y-3 ${
                            isSelected
                              ? "border-sky-500 bg-sky-50/60 ring-2 ring-sky-500/20 shadow-md"
                              : "border-slate-200 bg-white hover:border-slate-300 hover:shadow-xs"
                          }`}
                        >
                          {/* Doctor Header */}
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex items-center gap-3">
                              <div className="w-11 h-11 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold text-sm shrink-0">
                                <Stethoscope className="w-5 h-5" />
                              </div>
                              <div>
                                <h4 className="text-sm font-bold text-slate-900">
                                  {doctor.doctor_name}
                                </h4>
                                <p className="text-xs text-slate-500 font-medium">
                                  {doctor.department || "Clinical Medicine"}
                                </p>
                              </div>
                            </div>

                            <div className="text-right">
                              <Badge
                                variant={
                                  matchPct >= 80
                                    ? "success"
                                    : matchPct >= 60
                                    ? "primary"
                                    : "neutral"
                                }
                                size="sm"
                              >
                                {matchPct}% Match
                              </Badge>
                            </div>
                          </div>

                          {/* Specialty & Details */}
                          <div className="space-y-1.5 text-xs text-slate-600 border-t border-slate-100 pt-3">
                            {doctor.specialization && (
                              <div className="flex items-center gap-1.5 font-semibold text-slate-800">
                                <GraduationCap className="w-3.5 h-3.5 text-slate-400" />
                                <span>{doctor.specialization}</span>
                              </div>
                            )}

                            <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1">
                              {doctor.languages_spoken && (
                                <span className="flex items-center gap-1">
                                  <Globe className="w-3 h-3 text-slate-400" />
                                  {doctor.languages_spoken}
                                </span>
                              )}
                              {doctor.consultation_fee && (
                                <span className="font-bold text-slate-800">
                                  Fee: ₹{doctor.consultation_fee}
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Selected Radio Indicator */}
                          <div className="pt-2 flex items-center justify-between border-t border-slate-100">
                            <span className="text-[11px] text-slate-400">
                              {isSelected ? "Selected Physician" : "Click to select"}
                            </span>
                            <div
                              className={`w-5 h-5 rounded-full border flex items-center justify-center ${
                                isSelected
                                  ? "border-sky-600 bg-sky-600 text-white"
                                  : "border-slate-300 bg-white"
                              }`}
                            >
                              {isSelected && <CheckCircle2 className="w-3.5 h-3.5" />}
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            </Card>

            {/* Step 4: Appointment Booking & Intake Finalization */}
            <Card>
              <CardHeader
                title="4. Schedule Consultation & Confirm Intake"
                subtitle="Select appointment date, time, and register patient in hospital database"
              />
              <div className="p-6 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                      Consultation Date <span className="text-rose-500">*</span>
                    </label>
                    <input
                      name="appointment_date"
                      type="date"
                      required
                      min={todayString()}
                      value={form.appointment_date}
                      onChange={updateField}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                      Consultation Time Slot <span className="text-rose-500">*</span>
                    </label>
                    <input
                      name="appointment_time"
                      type="time"
                      required
                      value={form.appointment_time}
                      onChange={updateField}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500"
                    />
                  </div>
                </div>

                {/* Selected Doctor Confirmation Banner */}
                {selectedDoctor && (
                  <div className="p-4 bg-emerald-50/70 border border-emerald-200 rounded-2xl flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl bg-emerald-600 text-white flex items-center justify-center">
                        <CheckCircle2 className="w-5 h-5" />
                      </div>
                      <div>
                        <div className="text-xs font-bold text-emerald-950 uppercase tracking-wider">
                          Ready to Book
                        </div>
                        <div className="text-sm font-bold text-slate-900">
                          {selectedDoctor.doctor_name} ({selectedDoctor.department || "Specialist"})
                        </div>
                      </div>
                    </div>
                    <Badge variant="success" size="sm">
                      Confirmed Doctor
                    </Badge>
                  </div>
                )}

                <div className="pt-4 flex items-center justify-end gap-3 border-t border-slate-100">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => navigate("/hospital/dashboard")}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    variant="primary"
                    icon={CheckCircle2}
                    loading={submitting}
                    disabled={!selectedDoctor || !form.first_name || !form.last_name}
                    className="px-6 py-2.5 font-bold shadow-md"
                  >
                    Confirm Intake & Book Appointment
                  </Button>
                </div>
              </div>
            </Card>
          </form>
        )}
      </div>
    </MainLayout>
  )
}
