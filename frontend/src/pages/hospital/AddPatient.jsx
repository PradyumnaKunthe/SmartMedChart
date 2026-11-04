import React, { useEffect, useMemo, useRef, useState } from "react"
import { useNavigate } from "react-router-dom"
import {
  Activity,
  AlertCircle,
  ArrowLeft,
  Calendar,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  FileText,
  HeartPulse,
  Info,
  LoaderCircle,
  Phone,
  Plus,
  RefreshCw,
  Search,
  ShieldAlert,
  Sparkles,
  Stethoscope,
  Thermometer,
  User,
  UserCheck,
  UserPlus,
  Weight,
} from "lucide-react"

import MainLayout from "../../components/layout/MainLayout"
import Card, { CardHeader } from "../../components/common/Card"
import Button from "../../components/common/Button"
import Badge from "../../components/common/Badge"
import api from "../../services/api"
import { createHospitalPatient, getHospitalDoctors } from "../../services/hospital"

const PROBLEM_CATEGORIES = [
  "GENERAL MEDICINE",
  "CARDIOLOGY",
  "DERMATOLOGY",
  "ORTHOPEDICS",
  "PEDIATRICS",
  "GYNECOLOGY",
  "NEUROLOGY",
  "ENT",
  "OPHTHALMOLOGY",
  "GASTROENTEROLOGY",
  "PULMONOLOGY",
  "ENDOCRINOLOGY",
  "PSYCHIATRY",
  "UROLOGY",
  "NEPHROLOGY",
  "DENTISTRY",
  "OTHER / NOT SURE",
]

const SEVERITY_LEVELS = ["MILD", "MODERATE", "SEVERE"]

const GENDER_OPTIONS = ["MALE", "FEMALE", "OTHER"]

export default function AddPatient() {
  const navigate = useNavigate()

  // =======================================================
  // FORM STATE
  // =======================================================
  const [form, setForm] = useState({
    // Essential Patient Information
    full_name: "",
    age: "",
    gender: "MALE",
    mobile_number: "",

    // Essential Medical Information
    problem_category: "",
    chief_complaint: "",
    symptom_duration: "",
    symptom_severity: "MODERATE",

    // Attending Doctor Assignment (Bed assignment handled solely by Doctor)
    doctor_id: "",

    // Additional Information (Collapsible)
    address: "",
    email: "",
    emergency_contact_name: "",
    emergency_contact_number: "",
    emergency_contact_relationship: "",
    preferred_language: "",
    medical_history_notes: "",
    current_medication_notes: "",
    allergy_notes: "",
    visit_notes: "",
    blood_pressure: "",
    pulse: "",
    temperature_c: "",
    spo2_percent: "",
    weight_kg: "",
    height_cm: "",
  })

  // Collapsible toggle
  const [showAdditionalInfo, setShowAdditionalInfo] = useState(false)

  // UI state
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [successPatient, setSuccessPatient] = useState(null)

  // Doctor state
  const [doctors, setDoctors] = useState([])
  const [doctorsLoading, setDoctorsLoading] = useState(false)
  const [recommendedDoctors, setRecommendedDoctors] = useState([])
  const [recommendationLoading, setRecommendationLoading] = useState(false)
  const [recommendationMessage, setRecommendationMessage] = useState("")
  const [recommendationError, setRecommendationError] = useState(false)

  // Ref to track last recommended search query to prevent duplicate requests
  const lastQueryRef = useRef("")

  // =======================================================
  // UPPERCASE INPUT HANDLER
  // =======================================================
  function handleFieldChange(field, rawValue) {
    let value = rawValue

    if (field === "email") {
      // Keep email strictly lowercase
      value = String(rawValue || "").toLowerCase()
    } else if (typeof rawValue === "string") {
      if (field === "age") {
        // Only positive integers for age
        value = rawValue.replace(/\D/g, "").slice(0, 3)
      } else if (field === "mobile_number" || field === "emergency_contact_number") {
        // Phone numbers
        value = rawValue.replace(/[^\d+ -]/g, "").slice(0, 20)
      } else if (field !== "doctor_id") {
        // Automatically uppercase all human-readable inputs
        value = rawValue.toUpperCase()
      }
    }

    setForm((prev) => ({
      ...prev,
      [field]: value,
    }))
    setError("")
  }

  // =======================================================
  // LOAD DOCTORS (Bed assignment handled solely by Doctor)
  // =======================================================
  async function loadDoctors() {
    setDoctorsLoading(true)
    try {
      const response = await getHospitalDoctors()
      const doctorList = Array.isArray(response?.doctors) ? response.doctors : []
      setDoctors(doctorList)
    } catch (err) {
      console.error("Load doctors error:", err)
      setDoctors([])
    } finally {
      setDoctorsLoading(false)
    }
  }

  useEffect(() => {
    loadDoctors()
  }, [])

  // =======================================================
  // CAREMATCH AUTOMATIC RECOMMENDATIONS
  // =======================================================
  const constructedVisitReason = useMemo(() => {
    const parts = [
      form.problem_category ? `CATEGORY: ${form.problem_category}` : "",
      form.chief_complaint.trim() ? `COMPLAINT: ${form.chief_complaint.trim()}` : "",
      form.symptom_duration.trim() ? `DURATION: ${form.symptom_duration.trim()}` : "",
      form.symptom_severity ? `SEVERITY: ${form.symptom_severity}` : "",
      form.visit_notes.trim() ? `NOTES: ${form.visit_notes.trim()}` : "",
    ].filter(Boolean)

    return parts.join(" | ").slice(0, 1500)
  }, [
    form.problem_category,
    form.chief_complaint,
    form.symptom_duration,
    form.symptom_severity,
    form.visit_notes,
  ])

  async function recommendDoctors() {
    if (!form.problem_category && !form.chief_complaint.trim()) {
      setRecommendedDoctors([])
      setRecommendationError(true)
      setRecommendationMessage("SELECT A PROBLEM CATEGORY OR ENTER CHIEF COMPLAINT TO FIND MATCHING DOCTORS.")
      return
    }

    const query = constructedVisitReason || form.problem_category || form.chief_complaint.trim()
    lastQueryRef.current = query

    setRecommendationLoading(true)
    setRecommendationError(false)
    setRecommendationMessage("")

    try {
      const response = await api.post("/api/carematch/recommendations", {
        visit_reason: query,
        problem_category: form.problem_category || undefined,
        chief_complaint: form.chief_complaint.trim() || undefined,
        preferred_language: form.preferred_language.trim() || undefined,
      })

      const suggestions = Array.isArray(response.data?.recommendations)
        ? response.data.recommendations
        : []

      setRecommendedDoctors(suggestions)

      if (suggestions.length > 0) {
        setRecommendationMessage(
          `${suggestions.length} MATCHING SPECIALIST(S) IDENTIFIED BY CAREMATCH AI.`
        )
        setRecommendationError(false)
        // If no doctor currently selected, auto-select the highest match
        if (!form.doctor_id) {
          setForm((prev) => ({
            ...prev,
            doctor_id: String(suggestions[0].doctor_id),
          }))
        }
      } else {
        setRecommendationMessage(
          response.data?.message ||
            "NO MATCHING SPECIALISTS FOUND FOR THIS COMPLAINT. YOU MAY SELECT AN AVAILABLE DOCTOR FROM THE ROSTER BELOW."
        )
        setRecommendationError(false)
      }
    } catch (requestError) {
      console.error("CareMatch recommendation error:", requestError)
      setRecommendedDoctors([])
      setRecommendationError(true)
      setRecommendationMessage(
        requestError?.response?.data?.detail ||
          "UNABLE TO RETRIEVE DOCTOR SUGGESTIONS. PLEASE SELECT ATTENDING DOCTOR MANUALLY."
      )
    } finally {
      setRecommendationLoading(false)
    }
  }

  // Automatic recommendation trigger with 400ms debounce
  useEffect(() => {
    if (!form.problem_category && !form.chief_complaint.trim()) {
      return
    }

    const query = constructedVisitReason || form.problem_category || form.chief_complaint.trim()
    if (query === lastQueryRef.current) {
      return
    }

    const timer = setTimeout(() => {
      recommendDoctors()
    }, 400)

    return () => clearTimeout(timer)
  }, [form.problem_category, form.chief_complaint, form.symptom_duration, form.symptom_severity])

  function selectDoctor(doctorId) {
    setForm((prev) => ({
      ...prev,
      doctor_id: String(doctorId),
    }))
    setError("")
  }

  // =======================================================
  // FORM SUBMISSION & REGISTRATION
  // =======================================================
  async function handleSubmit(event) {
    event.preventDefault()
    setError("")

    // Basic validation
    if (!form.full_name.trim()) {
      setError("PATIENT FULL NAME IS REQUIRED.")
      return
    }

    if (!form.age.trim()) {
      setError("PATIENT AGE IS REQUIRED.")
      return
    }

    if (!form.mobile_number.trim()) {
      setError("MOBILE NUMBER IS REQUIRED.")
      return
    }

    if (!form.problem_category) {
      setError("PLEASE SELECT A PRIMARY PROBLEM CATEGORY.")
      return
    }

    if (!form.chief_complaint.trim()) {
      setError("CHIEF COMPLAINT / PRESENTING SYMPTOMS ARE REQUIRED.")
      return
    }

    if (!form.doctor_id) {
      setError("PLEASE SELECT AN ATTENDING DOCTOR FOR THIS PATIENT.")
      return
    }

    setLoading(true)

    try {
      // Split full name into first and last name
      const nameParts = form.full_name.trim().split(/\s+/)
      const firstName = nameParts[0] || "PATIENT"
      const lastName = nameParts.slice(1).join(" ") || nameParts[0] || "PATIENT"

      // Approximate DOB from age if not explicitly provided
      const ageNum = parseInt(form.age, 10)
      const calculatedDob = !isNaN(ageNum) && ageNum > 0
        ? `${new Date().getFullYear() - ageNum}-01-01`
        : null

      // Collect clinical observations
      const observations = {}
      if (form.blood_pressure.trim()) observations.blood_pressure = form.blood_pressure.trim()
      if (form.pulse) observations.pulse = Number(form.pulse)
      if (form.temperature_c) observations.temperature_c = Number(form.temperature_c)
      if (form.spo2_percent) observations.spo2_percent = Number(form.spo2_percent)
      if (form.weight_kg) observations.weight_kg = Number(form.weight_kg)
      if (form.height_cm) observations.height_cm = Number(form.height_cm)

      const payload = {
        full_name: form.full_name.trim(),
        first_name: firstName,
        last_name: lastName,
        age: ageNum || null,
        date_of_birth: calculatedDob,
        gender: form.gender || null,
        weight_kg: form.weight_kg ? Number(form.weight_kg) : null,
        mobile_number: form.mobile_number.trim() || null,
        email: form.email.trim() || null,
        address: form.address.trim() || null,
        emergency_contact_name: form.emergency_contact_name.trim() || null,
        emergency_contact_number: form.emergency_contact_number.trim() || null,
        emergency_contact_relationship: form.emergency_contact_relationship.trim() || null,
        preferred_language: form.preferred_language.trim() || null,
        problem_category: form.problem_category,
        chief_complaint: form.chief_complaint.trim(),
        symptom_duration: form.symptom_duration.trim() || null,
        symptom_severity: form.symptom_severity || null,
        visit_notes: form.visit_notes.trim() || null,
        medical_history_notes: form.medical_history_notes.trim() || null,
        current_medication_notes: form.current_medication_notes.trim() || null,
        allergy_notes: form.allergy_notes.trim() || null,
        clinical_observations: Object.keys(observations).length > 0 ? observations : null,
        doctor_id: Number(form.doctor_id),
        is_admitted: false,
        ward_id: null,
        bed_id: null,
      }

      const response = await createHospitalPatient(payload)
      const createdPatient = response?.patient

      setSuccessPatient(createdPatient || { full_name: form.full_name })

      // Reset form
      setForm({
        full_name: "",
        age: "",
        gender: "MALE",
        mobile_number: "",
        problem_category: "",
        chief_complaint: "",
        symptom_duration: "",
        symptom_severity: "MODERATE",
        doctor_id: "",
        address: "",
        email: "",
        emergency_contact_name: "",
        emergency_contact_number: "",
        emergency_contact_relationship: "",
        preferred_language: "",
        medical_history_notes: "",
        current_medication_notes: "",
        allergy_notes: "",
        visit_notes: "",
        blood_pressure: "",
        pulse: "",
        temperature_c: "",
        spo2_percent: "",
        weight_kg: "",
        height_cm: "",
      })

      setShowAdditionalInfo(false)
      setRecommendedDoctors([])
      setRecommendationMessage("")
      lastQueryRef.current = ""
    } catch (requestError) {
      console.error("Create hospital patient error:", requestError)
      setError(
        requestError?.response?.data?.detail ||
          "UNABLE TO COMPLETE PATIENT REGISTRATION. PLEASE CHECK REQUIRED FIELDS AND TRY AGAIN."
      )
    } finally {
      setLoading(false)
    }
  }

  function handleCancel() {
    navigate("/hospital/dashboard")
  }

  // Combined doctor roster for manual selection
  const allDoctorOptions = useMemo(() => {
    const list = [...doctors]
    recommendedDoctors.forEach((rd) => {
      if (!list.some((d) => String(d.id || d._id) === String(rd.doctor_id))) {
        list.push({
          id: rd.doctor_id,
          full_name: rd.full_name,
        })
      }
    })
    return list
  }, [doctors, recommendedDoctors])

  const selectedDoctorObj = allDoctorOptions.find(
    (d) => String(d.id || d._id) === String(form.doctor_id)
  )

  // =======================================================
  // RENDER
  // =======================================================
  return (
    <MainLayout
      title="PATIENT INTAKE & CAREMATCH"
      subtitle="RAPID CLINICAL INTAKE, AI DOCTOR RECOMMENDATIONS, AND ADMISSION REGISTRATION"
    >
      <div className="mx-auto max-w-4xl space-y-6">
        {/* Navigation & Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <button
              type="button"
              onClick={handleCancel}
              className="mb-2 inline-flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-slate-800 transition uppercase tracking-wider"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              BACK TO HOSPITAL DASHBOARD
            </button>
            <h1 className="text-2xl font-black tracking-tight text-slate-900 uppercase">
              PATIENT INTAKE & CAREMATCH
            </h1>
            <p className="text-xs text-slate-500 uppercase tracking-wide mt-0.5">
              COMPLETE PATIENT DETAILS, MEDICAL COMPLAINT, SELECT RECOMMENDED DOCTOR AND REGISTER
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-[11px] font-bold px-3 py-1 rounded-full bg-sky-50 text-sky-800 border border-sky-200 uppercase tracking-wider">
              FAST-TRACK REGISTRATION
            </span>
          </div>
        </div>

        {/* Global Error Banner */}
        {error && (
          <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 shadow-xs">
            <div className="flex items-start gap-3">
              <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-rose-600" />
              <div>
                <p className="text-xs font-bold text-rose-900 uppercase tracking-wide">
                  REGISTRATION ERROR
                </p>
                <p className="mt-1 text-xs text-rose-800 uppercase tracking-wide font-medium">
                  {error}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Success Modal / Banner */}
        {successPatient && (
          <div className="rounded-3xl border border-emerald-200 bg-gradient-to-br from-emerald-50 to-teal-50/50 p-6 shadow-sm space-y-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-2xl bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-xs">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <div className="flex-1">
                <h3 className="text-base font-black text-emerald-950 uppercase tracking-wide">
                  PATIENT REGISTERED SUCCESSFULLY
                </h3>
                <p className="text-xs text-emerald-800 uppercase tracking-wide mt-1">
                  PATIENT HAS BEEN ENROLLED IN THE SMARTMEDCHART HOSPITAL EMR SYSTEM.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-white/80 backdrop-blur-sm rounded-2xl p-4 border border-emerald-100 text-xs">
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">PATIENT ID</span>
                <p className="font-mono font-bold text-slate-900">{successPatient.patient_id || "GENERATED"}</p>
              </div>
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">FULL NAME</span>
                <p className="font-bold text-slate-900 uppercase">{successPatient.full_name || successPatient.first_name}</p>
              </div>
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">CARE TYPE</span>
                <p className="font-bold text-slate-900 uppercase">{successPatient.bed_id ? "INPATIENT" : "OUTPATIENT (OPD)"}</p>
              </div>
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">QR STATUS</span>
                <p className="font-bold text-emerald-700 uppercase">ACTIVE & ASSIGNED</p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 pt-1">
              <Button
                variant="primary"
                size="sm"
                icon={Plus}
                onClick={() => setSuccessPatient(null)}
              >
                REGISTER ANOTHER PATIENT
              </Button>
              {successPatient.id && (
                <Button
                  variant="outline"
                  size="sm"
                  icon={FileText}
                  onClick={() => navigate(`/hospital/patients/${successPatient.id}`)}
                >
                  VIEW PATIENT PROFILE
                </Button>
              )}
              <Button
                variant="secondary"
                size="sm"
                onClick={() => navigate("/hospital/dashboard")}
              >
                RETURN TO DASHBOARD
              </Button>
            </div>
          </div>
        )}

        {/* Main Form */}
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* STEP 1: PATIENT ESSENTIAL DETAILS */}
          <Card>
            <CardHeader
              title="1. PATIENT INFORMATION"
              subtitle="ESSENTIAL PATIENT DEMOGRAPHICS REQUIRED FOR HOSPITAL IDENTIFICATION"
            />
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Full Name */}
                <div className="md:col-span-2">
                  <label
                    htmlFor="full_name"
                    className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5"
                  >
                    PATIENT FULL NAME <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <User className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      id="full_name"
                      type="text"
                      required
                      value={form.full_name}
                      onChange={(e) => handleFieldChange("full_name", e.target.value)}
                      placeholder="E.G. ANKUSH SINGH"
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-10 pr-4 py-2.5 text-sm text-slate-900 font-bold uppercase placeholder-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 transition"
                    />
                  </div>
                </div>

                {/* Age */}
                <div>
                  <label
                    htmlFor="age"
                    className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5"
                  >
                    AGE (YEARS) <span className="text-rose-500">*</span>
                  </label>
                  <input
                    id="age"
                    type="text"
                    required
                    value={form.age}
                    onChange={(e) => handleFieldChange("age", e.target.value)}
                    placeholder="E.G. 34"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-900 font-bold placeholder-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 transition"
                  />
                </div>

                {/* Gender */}
                <div>
                  <label
                    htmlFor="gender"
                    className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5"
                  >
                    GENDER <span className="text-rose-500">*</span>
                  </label>
                  <select
                    id="gender"
                    required
                    value={form.gender}
                    onChange={(e) => handleFieldChange("gender", e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-900 font-bold uppercase focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 transition"
                  >
                    {GENDER_OPTIONS.map((g) => (
                      <option key={g} value={g} className="uppercase font-bold">
                        {g}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Mobile Number */}
                <div className="md:col-span-2">
                  <label
                    htmlFor="mobile_number"
                    className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5"
                  >
                    MOBILE NUMBER <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <Phone className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      id="mobile_number"
                      type="text"
                      required
                      value={form.mobile_number}
                      onChange={(e) => handleFieldChange("mobile_number", e.target.value)}
                      placeholder="E.G. 9876543210"
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-10 pr-4 py-2.5 text-sm text-slate-900 font-bold placeholder-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 transition"
                    />
                  </div>
                </div>
              </div>
            </div>
          </Card>

          {/* STEP 2: MEDICAL COMPLAINT & SYMPTOMS */}
          <Card>
            <CardHeader
              title="2. MEDICAL INFORMATION & SYMPTOMS"
              subtitle="PRIMARY MEDICAL REASON FOR VISIT AND PRESENTING CLINICAL SYMPTOMS"
            />
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Problem Category */}
                <div className="md:col-span-2">
                  <label
                    htmlFor="problem_category"
                    className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5"
                  >
                    PROBLEM CATEGORY <span className="text-rose-500">*</span>
                  </label>
                  <select
                    id="problem_category"
                    required
                    value={form.problem_category}
                    onChange={(e) => handleFieldChange("problem_category", e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-900 font-bold uppercase focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 transition"
                  >
                    <option value="" disabled className="text-slate-400">
                      SELECT PRIMARY MEDICAL CATEGORY
                    </option>
                    {PROBLEM_CATEGORIES.map((cat) => (
                      <option key={cat} value={cat} className="uppercase font-bold">
                        {cat}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Chief Complaint / Symptoms */}
                <div className="md:col-span-2">
                  <label
                    htmlFor="chief_complaint"
                    className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5"
                  >
                    CHIEF COMPLAINT / SYMPTOMS <span className="text-rose-500">*</span>
                  </label>
                  <textarea
                    id="chief_complaint"
                    required
                    rows={2}
                    value={form.chief_complaint}
                    onChange={(e) => handleFieldChange("chief_complaint", e.target.value)}
                    placeholder="DESCRIBE PRESENTING COMPLAINTS AND SYMPTOMS (E.G. CHEST PAIN AND SHORTNESS OF BREATH)"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm text-slate-900 font-bold uppercase placeholder-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 transition leading-relaxed resize-none"
                  />
                </div>

                {/* Duration of Symptoms */}
                <div>
                  <label
                    htmlFor="symptom_duration"
                    className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5"
                  >
                    DURATION OF SYMPTOMS (OPTIONAL)
                  </label>
                  <div className="relative">
                    <Clock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      id="symptom_duration"
                      type="text"
                      value={form.symptom_duration}
                      onChange={(e) => handleFieldChange("symptom_duration", e.target.value)}
                      placeholder="E.G. 2 DAYS, 3 WEEKS"
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-10 pr-4 py-2.5 text-sm text-slate-900 font-bold uppercase placeholder-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 transition"
                    />
                  </div>
                </div>

                {/* Severity */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    SEVERITY LEVEL <span className="text-rose-500">*</span>
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {SEVERITY_LEVELS.map((sev) => {
                      const isSelected = form.symptom_severity === sev
                      return (
                        <button
                          key={sev}
                          type="button"
                          onClick={() => handleFieldChange("symptom_severity", sev)}
                          className={`py-2 px-3 rounded-xl text-xs font-bold border transition uppercase tracking-wider ${
                            isSelected
                              ? sev === "SEVERE"
                                ? "bg-rose-600 text-white border-rose-600 shadow-xs"
                                : sev === "MODERATE"
                                ? "bg-amber-600 text-white border-amber-600 shadow-xs"
                                : "bg-sky-600 text-white border-sky-600 shadow-xs"
                              : "bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100"
                          }`}
                        >
                          {sev}
                        </button>
                      )
                    })}
                  </div>
                </div>
              </div>
            </div>
          </Card>

          {/* COLLAPSIBLE SECTION: ADDITIONAL INFORMATION */}
          <div className="rounded-2xl border border-slate-200/90 bg-white overflow-hidden shadow-xs">
            <button
              type="button"
              onClick={() => setShowAdditionalInfo((prev) => !prev)}
              className="w-full p-4 flex items-center justify-between text-left hover:bg-slate-50 transition"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl bg-slate-100 text-slate-600 flex items-center justify-center font-bold">
                  {showAdditionalInfo ? (
                    <ChevronUp className="w-4 h-4" />
                  ) : (
                    <ChevronDown className="w-4 h-4" />
                  )}
                </div>
                <div>
                  <h4 className="text-xs font-extrabold text-slate-900 uppercase tracking-wider">
                    ADDITIONAL INFORMATION (OPTIONAL)
                  </h4>
                  <p className="text-[11px] text-slate-500 uppercase tracking-wide">
                    ADDRESS, EMAIL, EMERGENCY CONTACTS, DETAILED CLINICAL HISTORY & VITALS
                  </p>
                </div>
              </div>
              <span className="text-[11px] font-bold text-sky-700 px-3 py-1 bg-sky-50 rounded-lg uppercase tracking-wider">
                {showAdditionalInfo ? "COLLAPSE" : "+ EXPAND"}
              </span>
            </button>

            {showAdditionalInfo && (
              <div className="p-6 pt-2 border-t border-slate-100 space-y-5 bg-slate-50/30">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Address */}
                  <div className="md:col-span-2">
                    <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1">
                      RESIDENTIAL ADDRESS
                    </label>
                    <input
                      type="text"
                      value={form.address}
                      onChange={(e) => handleFieldChange("address", e.target.value)}
                      placeholder="E.G. 124 PARK AVENUE, NEW DELHI"
                      className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2 text-xs text-slate-900 font-bold uppercase placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500"
                    />
                  </div>

                  {/* Email (Normalized Lowercase) */}
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1">
                      EMAIL ADDRESS (NORMALIZED LOWERCASE)
                    </label>
                    <input
                      type="email"
                      value={form.email}
                      onChange={(e) => handleFieldChange("email", e.target.value)}
                      placeholder="patient@example.com"
                      className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2 text-xs text-slate-900 font-bold lowercase placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500"
                    />
                  </div>

                  {/* Preferred Language */}
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1">
                      PREFERRED LANGUAGE
                    </label>
                    <input
                      type="text"
                      value={form.preferred_language}
                      onChange={(e) => handleFieldChange("preferred_language", e.target.value)}
                      placeholder="E.G. ENGLISH, HINDI, MARATHI"
                      className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2 text-xs text-slate-900 font-bold uppercase placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500"
                    />
                  </div>

                  {/* Emergency Contact Name */}
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1">
                      EMERGENCY CONTACT NAME
                    </label>
                    <input
                      type="text"
                      value={form.emergency_contact_name}
                      onChange={(e) => handleFieldChange("emergency_contact_name", e.target.value)}
                      placeholder="E.G. SITA SHARMA"
                      className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2 text-xs text-slate-900 font-bold uppercase placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500"
                    />
                  </div>

                  {/* Emergency Contact Number */}
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1">
                      EMERGENCY CONTACT NUMBER
                    </label>
                    <input
                      type="text"
                      value={form.emergency_contact_number}
                      onChange={(e) => handleFieldChange("emergency_contact_number", e.target.value)}
                      placeholder="E.G. 9876543211"
                      className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2 text-xs text-slate-900 font-bold placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500"
                    />
                  </div>

                  {/* Emergency Relationship */}
                  <div className="md:col-span-2">
                    <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1">
                      EMERGENCY CONTACT RELATIONSHIP
                    </label>
                    <input
                      type="text"
                      value={form.emergency_contact_relationship}
                      onChange={(e) => handleFieldChange("emergency_contact_relationship", e.target.value)}
                      placeholder="E.G. SPOUSE, SIBLING, PARENT"
                      className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2 text-xs text-slate-900 font-bold uppercase placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500"
                    />
                  </div>

                  {/* Medical History */}
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1">
                      MEDICAL HISTORY NOTES
                    </label>
                    <textarea
                      rows={2}
                      value={form.medical_history_notes}
                      onChange={(e) => handleFieldChange("medical_history_notes", e.target.value)}
                      placeholder="E.G. TYPE 2 DIABETES, HYPERTENSION"
                      className="w-full bg-white border border-slate-200 rounded-xl p-2.5 text-xs text-slate-900 font-bold uppercase placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 resize-none"
                    />
                  </div>

                  {/* Current Medications */}
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1">
                      CURRENT MEDICATIONS
                    </label>
                    <textarea
                      rows={2}
                      value={form.current_medication_notes}
                      onChange={(e) => handleFieldChange("current_medication_notes", e.target.value)}
                      placeholder="E.G. METFORMIN 500MG, TELMISARTAN 40MG"
                      className="w-full bg-white border border-slate-200 rounded-xl p-2.5 text-xs text-slate-900 font-bold uppercase placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 resize-none"
                    />
                  </div>

                  {/* Known Allergies */}
                  <div className="md:col-span-2">
                    <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1">
                      KNOWN ALLERGIES
                    </label>
                    <textarea
                      rows={2}
                      value={form.allergy_notes}
                      onChange={(e) => handleFieldChange("allergy_notes", e.target.value)}
                      placeholder="E.G. PENICILLIN, NSAIDS, SULFA DRUGS"
                      className="w-full bg-white border border-slate-200 rounded-xl p-2.5 text-xs text-slate-900 font-bold uppercase placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 resize-none"
                    />
                  </div>
                </div>

                {/* Vitals Sub-grid */}
                <div className="pt-2 border-t border-slate-200/80">
                  <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2">
                    CLINICAL OBSERVATIONS & VITALS
                  </p>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2">
                    <div>
                      <span className="block text-[10px] font-bold text-slate-500 uppercase">BP</span>
                      <input
                        type="text"
                        value={form.blood_pressure}
                        onChange={(e) => handleFieldChange("blood_pressure", e.target.value)}
                        placeholder="120/80"
                        className="w-full bg-white border border-slate-200 rounded-lg p-1.5 text-xs font-bold text-slate-800 text-center uppercase"
                      />
                    </div>
                    <div>
                      <span className="block text-[10px] font-bold text-slate-500 uppercase">PULSE</span>
                      <input
                        type="number"
                        value={form.pulse}
                        onChange={(e) => handleFieldChange("pulse", e.target.value)}
                        placeholder="72"
                        className="w-full bg-white border border-slate-200 rounded-lg p-1.5 text-xs font-bold text-slate-800 text-center"
                      />
                    </div>
                    <div>
                      <span className="block text-[10px] font-bold text-slate-500 uppercase">TEMP (°C)</span>
                      <input
                        type="number"
                        step="0.1"
                        value={form.temperature_c}
                        onChange={(e) => handleFieldChange("temperature_c", e.target.value)}
                        placeholder="37.0"
                        className="w-full bg-white border border-slate-200 rounded-lg p-1.5 text-xs font-bold text-slate-800 text-center"
                      />
                    </div>
                    <div>
                      <span className="block text-[10px] font-bold text-slate-500 uppercase">SPO2 (%)</span>
                      <input
                        type="number"
                        value={form.spo2_percent}
                        onChange={(e) => handleFieldChange("spo2_percent", e.target.value)}
                        placeholder="98"
                        className="w-full bg-white border border-slate-200 rounded-lg p-1.5 text-xs font-bold text-slate-800 text-center"
                      />
                    </div>
                    <div>
                      <span className="block text-[10px] font-bold text-slate-500 uppercase">WEIGHT (KG)</span>
                      <input
                        type="number"
                        step="0.5"
                        value={form.weight_kg}
                        onChange={(e) => handleFieldChange("weight_kg", e.target.value)}
                        placeholder="70"
                        className="w-full bg-white border border-slate-200 rounded-lg p-1.5 text-xs font-bold text-slate-800 text-center"
                      />
                    </div>
                    <div>
                      <span className="block text-[10px] font-bold text-slate-500 uppercase">HEIGHT (CM)</span>
                      <input
                        type="number"
                        value={form.height_cm}
                        onChange={(e) => handleFieldChange("height_cm", e.target.value)}
                        placeholder="175"
                        className="w-full bg-white border border-slate-200 rounded-lg p-1.5 text-xs font-bold text-slate-800 text-center"
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* STEP 3: CAREMATCH DOCTOR RECOMMENDATIONS */}
          <Card>
            <CardHeader
              title="3. CAREMATCH DOCTOR RECOMMENDATIONS"
              subtitle="AUTOMATIC SPECIALIST MATCHING POWERED BY PATIENT SYMPTOMS & CLINICAL COMPLAINT"
            />
            <div className="p-6 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h4 className="text-xs font-extrabold text-slate-900 uppercase tracking-wider">
                    RECOMMENDED ATTENDING PHYSICIANS
                  </h4>
                  <p className="text-[11px] text-slate-500 uppercase tracking-wide">
                    MATCHING DOCTORS DERIVED FROM CLINICAL COMPLAINT & SPECIALTY TAXONOMY
                  </p>
                </div>

                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  icon={Sparkles}
                  loading={recommendationLoading}
                  onClick={recommendDoctors}
                  className="shrink-0"
                >
                  FIND RECOMMENDED DOCTORS
                </Button>
              </div>

              {/* Status / Notice */}
              {recommendationMessage && (
                <div
                  className={`p-3 rounded-xl text-xs uppercase tracking-wide font-bold flex items-center gap-2 ${
                    recommendationError
                      ? "bg-amber-50 text-amber-800 border border-amber-200"
                      : "bg-sky-50 text-sky-800 border border-sky-200"
                  }`}
                >
                  <Info className="w-4 h-4 shrink-0" />
                  <span>{recommendationMessage}</span>
                </div>
              )}

              {/* Recommendations Grid */}
              {recommendationLoading ? (
                <div className="p-8 text-center bg-slate-50 rounded-2xl border border-slate-200 space-y-2">
                  <LoaderCircle className="w-8 h-8 animate-spin text-sky-600 mx-auto" />
                  <p className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                    ANALYZING COMPLAINT & RETRIEVING DOCTOR RECOMMENDATIONS...
                  </p>
                </div>
              ) : recommendedDoctors.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
                  {recommendedDoctors.map((doc) => {
                    const isSelected = String(form.doctor_id) === String(doc.doctor_id)
                    const specializations = Array.isArray(doc.specializations)
                      ? doc.specializations
                      : []
                    const matchReasons = Array.isArray(doc.match_reasons)
                      ? doc.match_reasons
                      : []

                    return (
                      <div
                        key={doc.doctor_id}
                        onClick={() => selectDoctor(doc.doctor_id)}
                        className={`p-4 rounded-2xl border transition-all cursor-pointer relative space-y-3 ${
                          isSelected
                            ? "bg-sky-50/70 border-sky-500 ring-2 ring-sky-500/20 shadow-sm"
                            : "bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50/50"
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-3">
                            <div
                              className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-sm ${
                                isSelected
                                  ? "bg-sky-600 text-white"
                                  : "bg-slate-100 text-slate-700"
                              }`}
                            >
                              <Stethoscope className="w-5 h-5" />
                            </div>
                            <div>
                              <h5 className="text-sm font-black text-slate-900 uppercase">
                                DR. {doc.full_name}
                              </h5>
                              <p className="text-[11px] font-bold text-sky-700 uppercase">
                                {specializations.join(", ") || "GENERAL MEDICINE"}
                              </p>
                            </div>
                          </div>

                          <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800 uppercase tracking-wider">
                            {doc.match_score || 85}% MATCH
                          </span>
                        </div>

                        {/* Match Reason & Availability */}
                        <div className="text-[11px] text-slate-600 bg-slate-50 p-2.5 rounded-xl border border-slate-100 uppercase space-y-1.5">
                          <p className="font-bold text-slate-700 leading-snug">
                            REASON:{" "}
                            <span className="font-medium text-slate-600">
                              {matchReasons.length > 0
                                ? matchReasons.join(" · ")
                                : "MATCHES SELECTED PROBLEM CATEGORY"}
                            </span>
                          </p>
                          {doc.is_available !== false && (
                            <p className="font-bold text-emerald-700 flex items-center gap-1.5 pt-0.5 border-t border-slate-200/60">
                              <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block animate-pulse" />
                              AVAILABLE FOR IMMEDIATE CONSULTATION
                            </p>
                          )}
                        </div>

                        {/* Action / Select Button */}
                        <div className="flex justify-end pt-1">
                          {isSelected ? (
                            <span className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-sky-600 text-white text-xs font-bold uppercase tracking-wider shadow-xs">
                              <Check className="w-3.5 h-3.5" />
                              SELECTED ATTENDING DOCTOR
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-white border border-slate-300 text-slate-700 text-xs font-bold uppercase hover:bg-slate-50 tracking-wider">
                              ASSIGN DOCTOR
                            </span>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              ) : null}

              {/* Manual Selection Dropdown Fallback */}
              <div className="pt-2 border-t border-slate-100">
                <label
                  htmlFor="manual_doctor_select"
                  className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1.5"
                >
                  MANUAL ATTENDING DOCTOR SELECTION
                </label>
                <select
                  id="manual_doctor_select"
                  value={form.doctor_id}
                  onChange={(e) => selectDoctor(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-900 font-bold uppercase focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500"
                >
                  <option value="" disabled className="text-slate-400">
                    SELECT FROM ALL REGISTERED HOSPITAL DOCTORS
                  </option>
                  {allDoctorOptions.map((doc) => (
                    <option key={doc.id || doc._id} value={doc.id || doc._id} className="uppercase font-bold">
                      DR. {doc.full_name}
                    </option>
                  ))}
                </select>
                {selectedDoctorObj && (
                  <p className="text-[11px] font-bold text-emerald-700 mt-1 uppercase flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    ASSIGNED ATTENDING DOCTOR: DR. {selectedDoctorObj.full_name}
                  </p>
                )}
              </div>
            </div>
          </Card>

          {/* SUBMIT ACTIONS */}
          <div className="flex items-center justify-end gap-3 pt-2">
            <Button
              type="button"
              variant="secondary"
              onClick={handleCancel}
            >
              CANCEL
            </Button>

            <Button
              type="submit"
              variant="primary"
              size="lg"
              loading={loading}
              icon={UserCheck}
              className="px-8 font-black uppercase tracking-wider"
            >
              REGISTER PATIENT
            </Button>
          </div>
        </form>
      </div>
    </MainLayout>
  )
}
