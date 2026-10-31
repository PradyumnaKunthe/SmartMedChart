import {
  ArrowLeft,
  BedDouble,
  CalendarDays,
  CheckCircle2,
  ClipboardPlus,
  LoaderCircle,
  Stethoscope,
  UserPlus,
  Weight,
} from "lucide-react"

import { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"

import MainLayout from "../../components/layout/MainLayout"
import api from "../../services/api"
import {
  getHospitalDoctors,
} from "../../services/admin"


const PROBLEM_CATEGORIES = [
  "General Medicine",
  "Cardiology",
  "Dermatology",
  "Orthopedics",
  "Pediatrics",
  "Gynecology",
  "Neurology",
  "ENT",
  "Ophthalmology",
  "Gastroenterology",
  "Pulmonology",
  "Endocrinology",
  "Psychiatry",
  "Urology",
  "Nephrology",
  "Dentistry",
  "Other / not sure",
]

// =========================================================
// MAIN
// =========================================================

export default function AddPatient() {
  const navigate = useNavigate()

  // =======================================================
  // FORM
  // =======================================================

  const [form, setForm] = useState({
    // Basic information
    first_name: "",
    last_name: "",
    date_of_birth: "",
    gender: "",
    weight_kg: "",

    // Contact information
    mobile_number: "",
    email: "",
    address: "",
    emergency_contact_name: "",
    emergency_contact_number: "",
    emergency_contact_relationship: "",
    preferred_language: "",

    // Visit information
    problem_category: "",
    chief_complaint: "",
    symptom_duration: "",
    symptom_severity: "",
    visit_notes: "",
    medical_history_notes: "",
    current_medication_notes: "",
    allergy_notes: "",

    // Optional clinical observations
    blood_pressure: "",
    pulse: "",
    temperature_c: "",
    spo2_percent: "",
    height_cm: "",

    // Doctor and admission
    doctor_id: "",
    admit_patient: false,
    ward_id: "",
    bed_id: "",
  })

  // =======================================================
  // UI STATE
  // =======================================================

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [successPatient, setSuccessPatient] = useState(null)

  // =======================================================
  // DOCTOR STATE
  // =======================================================

  const [doctors, setDoctors] = useState([])
  const [doctorsLoading, setDoctorsLoading] = useState(false)
  const [recommendedDoctors, setRecommendedDoctors] = useState([])
  const [recommendationLoading, setRecommendationLoading] = useState(false)
  const [recommendationMessage, setRecommendationMessage] = useState("")
  const [recommendationError, setRecommendationError] = useState(false)

  // =======================================================
  // WARD / BED STATE
  // =======================================================

  const [wards, setWards] = useState([])
  const [beds, setBeds] = useState([])

  const [wardsLoading, setWardsLoading] = useState(false)
  const [bedsLoading, setBedsLoading] = useState(false)

  // =======================================================
  // LOAD DOCTORS
  // =======================================================

  async function loadDoctors() {
    setDoctorsLoading(true)
    setError("")

    try {
      const response = await getHospitalDoctors()

      const doctorList = Array.isArray(response?.doctors)
        ? response.doctors
        : []

      setDoctors(doctorList)

    } catch (requestError) {
      console.error(
        "Load doctors error:",
        requestError,
      )

      setDoctors([])

      setError(
        requestError?.response?.data?.detail ||
          "Unable to load registered doctors.",
      )

    } finally {
      setDoctorsLoading(false)
    }
  }

  // =======================================================
  // LOAD WARDS
  // =======================================================

  async function loadWards() {
    setWardsLoading(true)

    try {
      const response = await api.get("/api/hospital/wards")

      setWards(
        Array.isArray(response.data?.wards)
          ? response.data.wards
          : [],
      )

    } catch (requestError) {
      console.error(
        "Load wards error:",
        requestError,
      )

      setError(
        requestError?.response?.data?.detail ||
          "Unable to load hospital wards.",
      )

    } finally {
      setWardsLoading(false)
    }
  }

  // =======================================================
  // LOAD BEDS
  // =======================================================

  async function loadBeds(wardId) {
    if (!wardId) {
      setBeds([])
      return
    }

    setBedsLoading(true)

    try {
      const response = await api.get(
        `/api/hospital/wards/${wardId}/beds`,
      )

      const availableBeds =
        Array.isArray(response.data?.beds)
          ? response.data.beds.filter(
              (bed) =>
                bed.is_active &&
                !bed.is_occupied,
            )
          : []

      setBeds(availableBeds)

    } catch (requestError) {
      console.error(
        "Load beds error:",
        requestError,
      )

      setBeds([])

      setError(
        requestError?.response?.data?.detail ||
          "Unable to load beds for this ward.",
      )

    } finally {
      setBedsLoading(false)
    }
  }

  // =======================================================
  // RECOMMEND DOCTORS FROM THE PATIENT'S REPORTED CONCERN
  // =======================================================

  async function recommendDoctors() {
    const visitReason = [
      form.problem_category,
      form.chief_complaint.trim(),
      form.symptom_duration.trim()
        ? `Duration: ${form.symptom_duration.trim()}`
        : "",
      form.symptom_severity
        ? `Reported severity: ${form.symptom_severity}`
        : "",
      form.visit_notes.trim(),
    ]
      .filter(Boolean)
      .join(" | ")
      .slice(0, 1500)

    if (!visitReason) {
      setRecommendedDoctors([])
      setRecommendationError(true)
      setRecommendationMessage(
        "Select a main problem or enter the chief complaint before requesting doctor suggestions.",
      )
      return
    }

    setRecommendationLoading(true)
    setRecommendationError(false)
    setRecommendationMessage("")
    setRecommendedDoctors([])

    try {
      const response = await api.post(
        "/api/carematch/recommendations",
        { visit_reason: visitReason },
      )

      const suggestions = Array.isArray(
        response.data?.recommendations,
      )
        ? response.data.recommendations
        : []

      setRecommendedDoctors(suggestions)
      setRecommendationMessage(
        response.data?.message ||
          (suggestions.length > 0
            ? `${suggestions.length} available doctor suggestion(s) found.`
            : "No available doctor profiles matched this request. Ask the administrator to configure doctor profiles."),
      )
      setRecommendationError(suggestions.length === 0)

    } catch (requestError) {
      console.error("Doctor recommendation error:", requestError)
      setRecommendedDoctors([])
      setRecommendationError(true)
      setRecommendationMessage(
        requestError?.response?.data?.detail ||
          "Unable to retrieve doctor suggestions. Check your registration permission and try again.",
      )

    } finally {
      setRecommendationLoading(false)
    }
  }

  function chooseRecommendedDoctor(doctor) {
    const doctorId = String(doctor.doctor_id)

    setForm((current) => ({
      ...current,
      doctor_id: doctorId,
    }))

    setRecommendationError(false)
    setRecommendationMessage(
      `${doctor.full_name} selected as the attending doctor.`,
    )
  }

  // =======================================================
  // INITIAL LOAD
  // =======================================================

  useEffect(() => {
    loadDoctors()
    loadWards()
  }, [])

  // =======================================================
  // HANDLE INPUT
  // =======================================================

  function handleChange(event) {
    const {
      name,
      value,
      type,
      checked,
    } = event.target

    setError("")

    setForm((current) => ({
      ...current,
      [name]:
        type === "checkbox"
          ? checked
          : value,
    }))

    if ([
      "problem_category",
      "chief_complaint",
      "symptom_duration",
      "symptom_severity",
      "visit_notes",
    ].includes(name)) {
      setRecommendedDoctors([])
      setRecommendationMessage("")
      setRecommendationError(false)
      setForm((current) => ({
        ...current,
        doctor_id: "",
      }))
    }

    // -----------------------------------------------------
    // Disable admission
    // -----------------------------------------------------

    if (
      name === "admit_patient" &&
      !checked
    ) {
      setForm((current) => ({
        ...current,
        admit_patient: false,
        ward_id: "",
        bed_id: "",
      }))

      setBeds([])
    }

    // -----------------------------------------------------
    // Ward changed
    // -----------------------------------------------------

    if (name === "ward_id") {
      setForm((current) => ({
        ...current,
        ward_id: value,
        bed_id: "",
      }))

      loadBeds(value)
    }
  }

  // =======================================================
  // SUBMIT
  // =======================================================

  async function handleSubmit(event) {
    event.preventDefault()

    setError("")
    setSuccessPatient(null)

    // -----------------------------------------------------
    // Name validation
    // -----------------------------------------------------

    if (
      !form.first_name.trim() ||
      !form.last_name.trim()
    ) {
      setError(
        "First name and last name are required.",
      )
      return
    }

    // -----------------------------------------------------
    // Doctor validation
    // -----------------------------------------------------

    if (!form.doctor_id) {
      setError(
        "Please select an attending doctor.",
      )
      return
    }

    const selectedDoctor = doctors.find(
      (doctor) =>
        String(doctor.id) ===
        String(form.doctor_id),
    )

    if (!selectedDoctor) {
      setError(
        "The selected doctor is no longer available. Please select an active registered doctor.",
      )
      return
    }

    // -----------------------------------------------------
    // Admission validation
    // -----------------------------------------------------

    if (form.admit_patient) {
      if (!form.ward_id) {
        setError(
          "Please select a ward for admission.",
        )
        return
      }

      if (!form.bed_id) {
        setError(
          "Please select an available bed.",
        )
        return
      }
    }

    setLoading(true)

    try {
      const filteredObservations = Object.fromEntries(
        Object.entries({
          blood_pressure: form.blood_pressure.trim(),
          pulse: form.pulse.trim(),
          temperature_c: form.temperature_c.trim(),
          spo2_percent: form.spo2_percent.trim(),
          height_cm: form.height_cm.trim(),
        }).filter(([, value]) => value !== ""),
      )

      const payload = {
        first_name: form.first_name.trim(),

        last_name: form.last_name.trim(),

        date_of_birth:
          form.date_of_birth || null,

        gender:
          form.gender.trim() || null,

        weight_kg:
          form.weight_kg
            ? Number(form.weight_kg)
            : null,

        // Contact information
        mobile_number: form.mobile_number.trim() || null,
        email: form.email.trim() || null,
        address: form.address.trim() || null,
        emergency_contact_name:
          form.emergency_contact_name.trim() || null,
        emergency_contact_number:
          form.emergency_contact_number.trim() || null,
        emergency_contact_relationship:
          form.emergency_contact_relationship.trim() || null,
        preferred_language:
          form.preferred_language.trim() || null,

        // Visit information
        problem_category: form.problem_category || null,
        chief_complaint:
          form.chief_complaint.trim() || form.problem_category || null,
        symptom_duration: form.symptom_duration.trim() || null,
        symptom_severity: form.symptom_severity || null,
        visit_notes: form.visit_notes.trim() || null,
        medical_history_notes:
          form.medical_history_notes.trim() || null,
        current_medication_notes:
          form.current_medication_notes.trim() || null,
        allergy_notes: form.allergy_notes.trim() || null,

        // Optional clinical observations
        clinical_observations:
          Object.keys(filteredObservations).length > 0
            ? filteredObservations
            : null,

        doctor_id:
          Number(form.doctor_id),

        is_admitted:
          Boolean(form.admit_patient),

        ward_id:
          form.admit_patient &&
          form.ward_id
            ? Number(form.ward_id)
            : null,

        bed_id:
          form.admit_patient &&
          form.bed_id
            ? Number(form.bed_id)
            : null,
      }

      const response = await api.post(
        "/api/hospital/patients",
        payload,
      )

      const createdPatient =
        response.data?.patient

      setSuccessPatient(
        createdPatient || null,
      )

      // ---------------------------------------------------
      // Reset
      // ---------------------------------------------------

      setForm({
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
        chief_complaint: "",
        symptom_duration: "",
        symptom_severity: "",
        visit_notes: "",
        medical_history_notes: "",
        current_medication_notes: "",
        allergy_notes: "",
        blood_pressure: "",
        pulse: "",
        temperature_c: "",
        spo2_percent: "",
        height_cm: "",
        doctor_id: "",
        admit_patient: false,
        ward_id: "",
        bed_id: "",
      })

      setBeds([])
      setRecommendedDoctors([])
      setRecommendationMessage("")
      setRecommendationError(false)

    } catch (requestError) {
      console.error(
        "Create hospital patient error:",
        requestError,
      )

      setError(
        requestError?.response?.data?.detail ||
          "Unable to create the patient record.",
      )

    } finally {
      setLoading(false)
    }
  }

  // =======================================================
  // CANCEL
  // =======================================================

  function handleCancel() {
    navigate("/hospital/dashboard")
  }

  // =======================================================
  // SELECTED WARD / BED
  // =======================================================

  const selectedWard = wards.find(
    (ward) =>
      String(ward.id) ===
      String(form.ward_id),
  )

  const selectedBed = beds.find(
    (bed) =>
      String(bed.id) ===
      String(form.bed_id),
  )

  // =======================================================
  // DOCTOR OPTIONS / SELECTED DOCTOR
  // =======================================================

  const doctorOptions = [...doctors]

  recommendedDoctors.forEach((recommendedDoctor) => {
    const alreadyLoaded = doctorOptions.some(
      (doctor) =>
        String(doctor.id) === String(recommendedDoctor.doctor_id),
    )

    if (!alreadyLoaded) {
      doctorOptions.push({
        id: recommendedDoctor.doctor_id,
        full_name: recommendedDoctor.full_name,
        username: "Recommended doctor",
      })
    }
  })

  const selectedDoctor = doctorOptions.find(
    (doctor) =>
      String(doctor.id) ===
      String(form.doctor_id),
  )

  // =======================================================
  // RENDER
  // =======================================================

  return (
    <MainLayout title="Register Patient">

      <div className="mx-auto max-w-5xl space-y-6">

        {/* =================================================
            HEADER
        ================================================= */}

        <div>

          <button
            type="button"
            onClick={handleCancel}
            className="mb-3 inline-flex items-center gap-2 text-sm font-semibold text-slate-500 transition hover:text-slate-900"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Hospital Dashboard
          </button>

          <p className="text-sm font-semibold text-cyan-600">
            Hospital Data Portal
          </p>

          <h1 className="mt-1 text-3xl font-bold tracking-tight text-slate-900">
            Register Patient
          </h1>

          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
            Create a patient record in the shared
            SmartMedChart database.
          </p>

        </div>

        {/* =================================================
            ERROR
        ================================================= */}

        {error && (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-4">

            <div className="flex items-start gap-3">

              <ClipboardPlus className="mt-0.5 h-5 w-5 shrink-0 text-red-600" />

              <div>

                <p className="font-semibold text-red-800">
                  Patient registration failed
                </p>

                <p className="mt-1 text-sm leading-6 text-red-700">
                  {error}
                </p>

              </div>

            </div>

          </div>
        )}

        {/* =================================================
            SUCCESS
        ================================================= */}

        {successPatient && (
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5 shadow-sm">

            <div className="flex items-start gap-3">

              <CheckCircle2 className="mt-0.5 h-6 w-6 shrink-0 text-emerald-600" />

              <div className="flex-1">

                <p className="font-semibold text-emerald-900">
                  Patient registered successfully
                </p>

                <p className="mt-1 text-sm text-emerald-800">
                  Patient ID:
                  {" "}
                  <span className="font-bold">
                    {successPatient.patient_id}
                  </span>
                </p>

                <div className="mt-4 flex flex-wrap gap-2">

                  <button
                    type="button"
                    onClick={() =>
                      navigate(
                        "/hospital/dashboard",
                      )
                    }
                    className="rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700"
                  >
                    View Patients
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      setSuccessPatient(null)
                    }
                    className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                  >
                    Register Another
                  </button>

                </div>

              </div>

            </div>

          </div>
        )}

        {/* =================================================
            FORM
        ================================================= */}

        <form
          onSubmit={handleSubmit}
          className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm"
        >

          {/* HEADER */}

          <div className="border-b border-slate-200 bg-slate-50 p-5 md:p-6">

            <div className="flex items-center gap-3">

              <div className="rounded-xl bg-cyan-100 p-3">
                <UserPlus className="h-5 w-5 text-cyan-700" />
              </div>

              <div>

                <h2 className="font-bold text-slate-900">
                  Patient Information
                </h2>

                <p className="mt-1 text-sm text-slate-500">
                  Enter patient and attending doctor details.
                </p>

              </div>

            </div>

          </div>

          <div className="space-y-8 p-5 md:p-6">

            {/* =================================================
                BASIC INFORMATION
            ================================================= */}

            <section>

              <div className="mb-4">

                <h3 className="font-semibold text-slate-900">
                  Basic Information
                </h3>

                <p className="mt-1 text-sm text-slate-500">
                  Identity and demographic information.
                </p>

              </div>

              <div className="grid gap-5 md:grid-cols-2">

                {/* Patient ID */}

                <div>

                  <label className="mb-2 block text-sm font-semibold text-slate-700">
                    Patient ID
                  </label>

                  <input
                    type="text"
                    value="Auto-generated"
                    disabled
                    className="w-full rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700"
                  />

                  <p className="mt-2 text-xs text-slate-500">
                    Assigned automatically after registration.
                  </p>

                </div>

                {/* First Name */}

                <div>

                  <label
                    htmlFor="first_name"
                    className="mb-2 block text-sm font-semibold text-slate-700"
                  >
                    First Name
                    <span className="ml-1 text-red-500">
                      *
                    </span>
                  </label>

                  <input
                    id="first_name"
                    name="first_name"
                    value={form.first_name}
                    onChange={handleChange}
                    placeholder="Enter first name"
                    required
                    maxLength={100}
                    className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-cyan-400 focus:ring-2 focus:ring-cyan-100"
                  />

                </div>

                {/* Last Name */}

                <div>

                  <label
                    htmlFor="last_name"
                    className="mb-2 block text-sm font-semibold text-slate-700"
                  >
                    Last Name
                    <span className="ml-1 text-red-500">
                      *
                    </span>
                  </label>

                  <input
                    id="last_name"
                    name="last_name"
                    value={form.last_name}
                    onChange={handleChange}
                    placeholder="Enter last name"
                    required
                    maxLength={100}
                    className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-cyan-400 focus:ring-2 focus:ring-cyan-100"
                  />

                </div>

                {/* Date */}

                <div>

                  <label
                    htmlFor="date_of_birth"
                    className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-700"
                  >
                    <CalendarDays className="h-4 w-4 text-slate-400" />
                    Date of Birth
                  </label>

                  <input
                    id="date_of_birth"
                    name="date_of_birth"
                    type="date"
                    value={form.date_of_birth}
                    onChange={handleChange}
                    className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-cyan-400 focus:ring-2 focus:ring-cyan-100"
                  />

                </div>

                {/* Gender */}

                <div>

                  <label
                    htmlFor="gender"
                    className="mb-2 block text-sm font-semibold text-slate-700"
                  >
                    Gender
                  </label>

                  <select
                    id="gender"
                    name="gender"
                    value={form.gender}
                    onChange={handleChange}
                    className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-cyan-400 focus:ring-2 focus:ring-cyan-100"
                  >

                    <option value="">
                      Select gender
                    </option>

                    <option value="Male">
                      Male
                    </option>

                    <option value="Female">
                      Female
                    </option>

                    <option value="Other">
                      Other
                    </option>

                  </select>

                </div>

                {/* Weight */}

                <div>

                  <label
                    htmlFor="weight_kg"
                    className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-700"
                  >
                    <Weight className="h-4 w-4 text-slate-400" />
                    Weight (kg)
                  </label>

                  <input
                    id="weight_kg"
                    name="weight_kg"
                    type="number"
                    min="0.1"
                    max="500"
                    step="0.1"
                    value={form.weight_kg}
                    onChange={handleChange}
                    placeholder="e.g. 72.5"
                    className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-cyan-400 focus:ring-2 focus:ring-cyan-100"
                  />

                </div>

                {/* =================================================
                    DOCTOR
                ================================================= */}

                <div className="md:col-span-2">

                  <label
                    htmlFor="doctor_id"
                    className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-700"
                  >

                    <Stethoscope className="h-4 w-4 text-cyan-600" />

                    Attending Doctor

                    <span className="text-red-500">
                      *
                    </span>

                  </label>

                  <select
                    id="doctor_id"
                    name="doctor_id"
                    value={form.doctor_id}
                    onChange={handleChange}
                    required
                    disabled={doctorsLoading}
                    className="w-full rounded-xl border border-cyan-200 bg-white px-4 py-3 text-sm outline-none focus:border-cyan-400 focus:ring-2 focus:ring-cyan-100 disabled:cursor-not-allowed disabled:bg-slate-100"
                  >

                    <option value="">
                      {doctorsLoading
                        ? "Loading registered doctors..."
                        : doctorOptions.length === 0
                          ? "No active doctors registered"
                          : "Select attending doctor"}
                    </option>

                    {doctorOptions.map(
                      (doctor) => (
                        <option
                          key={doctor.id}
                          value={doctor.id}
                        >
                          {doctor.full_name}
                          {" • "}
                          {doctor.username}
                        </option>
                      ),
                    )}

                  </select>

                  <p className="mt-2 text-xs text-slate-500">
                    Doctors are loaded automatically from
                    active Doctor accounts in Staff Management.
                  </p>

                  {selectedDoctor && (
                    <div className="mt-3 rounded-xl border border-cyan-200 bg-cyan-50 p-3">

                      <p className="text-xs font-bold uppercase tracking-wide text-cyan-700">
                        Selected Doctor
                      </p>

                      <p className="mt-1 font-semibold text-cyan-900">
                        {selectedDoctor.full_name}
                      </p>

                      <p className="mt-1 text-xs text-cyan-700">
                        Username:
                        {" "}
                        {selectedDoctor.username}
                      </p>

                    </div>
                  )}

                </div>

              </div>

            </section>

            {/* =================================================
                CONTACT INFORMATION
            ================================================= */}

            <section className="border-t border-slate-100 pt-8">

              <div className="mb-4">
                <h3 className="font-semibold text-slate-900">
                  Contact Information
                </h3>
                <p className="mt-1 text-sm text-slate-500">
                  Optional patient contact and emergency contact details.
                </p>
              </div>

              <div className="grid gap-5 md:grid-cols-2">

                <div>
                  <label htmlFor="mobile_number" className="mb-2 block text-sm font-semibold text-slate-700">
                    Mobile Number
                  </label>
                  <input
                    id="mobile_number"
                    name="mobile_number"
                    type="tel"
                    value={form.mobile_number}
                    onChange={handleChange}
                    maxLength={20}
                    placeholder="Enter mobile number"
                    className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-cyan-400 focus:ring-2 focus:ring-cyan-100"
                  />
                </div>

                <div>
                  <label htmlFor="email" className="mb-2 block text-sm font-semibold text-slate-700">
                    Email Address
                  </label>
                  <input
                    id="email"
                    name="email"
                    type="email"
                    value={form.email}
                    onChange={handleChange}
                    maxLength={255}
                    placeholder="patient@example.com"
                    className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-cyan-400 focus:ring-2 focus:ring-cyan-100"
                  />
                </div>

                <div className="md:col-span-2">
                  <label htmlFor="address" className="mb-2 block text-sm font-semibold text-slate-700">
                    Address
                  </label>
                  <textarea
                    id="address"
                    name="address"
                    rows={2}
                    value={form.address}
                    onChange={handleChange}
                    maxLength={1000}
                    placeholder="Enter patient's residential address"
                    className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-cyan-400 focus:ring-2 focus:ring-cyan-100"
                  />
                </div>

                <div>
                  <label htmlFor="emergency_contact_name" className="mb-2 block text-sm font-semibold text-slate-700">
                    Emergency Contact Name
                  </label>
                  <input
                    id="emergency_contact_name"
                    name="emergency_contact_name"
                    value={form.emergency_contact_name}
                    onChange={handleChange}
                    maxLength={150}
                    placeholder="Contact person's name"
                    className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-cyan-400 focus:ring-2 focus:ring-cyan-100"
                  />
                </div>

                <div>
                  <label htmlFor="emergency_contact_number" className="mb-2 block text-sm font-semibold text-slate-700">
                    Emergency Contact Number
                  </label>
                  <input
                    id="emergency_contact_number"
                    name="emergency_contact_number"
                    type="tel"
                    value={form.emergency_contact_number}
                    onChange={handleChange}
                    maxLength={20}
                    placeholder="Enter emergency contact number"
                    className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-cyan-400 focus:ring-2 focus:ring-cyan-100"
                  />
                </div>

                <div>
                  <label htmlFor="emergency_contact_relationship" className="mb-2 block text-sm font-semibold text-slate-700">
                    Relationship to Patient
                  </label>
                  <input
                    id="emergency_contact_relationship"
                    name="emergency_contact_relationship"
                    value={form.emergency_contact_relationship}
                    onChange={handleChange}
                    maxLength={80}
                    placeholder="e.g. Parent, spouse, sibling"
                    className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-cyan-400 focus:ring-2 focus:ring-cyan-100"
                  />
                </div>

                <div>
                  <label htmlFor="preferred_language" className="mb-2 block text-sm font-semibold text-slate-700">
                    Preferred Language
                  </label>
                  <input
                    id="preferred_language"
                    name="preferred_language"
                    value={form.preferred_language}
                    onChange={handleChange}
                    maxLength={80}
                    placeholder="e.g. Marathi, Hindi, English"
                    className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-cyan-400 focus:ring-2 focus:ring-cyan-100"
                  />
                </div>

              </div>
            </section>

            {/* =================================================
                VISIT INFORMATION
            ================================================= */}

            <section className="border-t border-slate-100 pt-8">

              <div className="mb-4">
                <h3 className="font-semibold text-slate-900">
                  Visit Information
                </h3>
                <p className="mt-1 text-sm text-slate-500">
                  Optional reason for visit, symptoms, and medical history.
                </p>
              </div>

              <div className="grid gap-5 md:grid-cols-2">

                <div>
                  <label htmlFor="problem_category" className="mb-2 block text-sm font-semibold text-slate-700">
                    Main Problem / Department
                  </label>
                  <select
                    id="problem_category"
                    name="problem_category"
                    value={form.problem_category}
                    onChange={handleChange}
                    className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-cyan-400 focus:ring-2 focus:ring-cyan-100"
                  >
                    <option value="">Select a problem or department</option>
                    {PROBLEM_CATEGORIES.map((category) => (
                      <option key={category} value={category}>{category}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label htmlFor="symptom_duration" className="mb-2 block text-sm font-semibold text-slate-700">
                    Symptom Duration
                  </label>
                  <input
                    id="symptom_duration"
                    name="symptom_duration"
                    value={form.symptom_duration}
                    onChange={handleChange}
                    maxLength={100}
                    placeholder="e.g. 3 days, 2 weeks"
                    className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-cyan-400 focus:ring-2 focus:ring-cyan-100"
                  />
                </div>

                <div>
                  <label htmlFor="symptom_severity" className="mb-2 block text-sm font-semibold text-slate-700">
                    Reported Symptom Severity
                  </label>
                  <select
                    id="symptom_severity"
                    name="symptom_severity"
                    value={form.symptom_severity}
                    onChange={handleChange}
                    className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-cyan-400 focus:ring-2 focus:ring-cyan-100"
                  >
                    <option value="">Not specified</option>
                    <option value="Mild">Mild</option>
                    <option value="Moderate">Moderate</option>
                    <option value="Severe">Severe</option>
                  </select>
                </div>

                <div>
                  <label htmlFor="chief_complaint" className="mb-2 block text-sm font-semibold text-slate-700">
                    Chief Complaint
                  </label>
                  <textarea
                    id="chief_complaint"
                    name="chief_complaint"
                    rows={2}
                    value={form.chief_complaint}
                    onChange={handleChange}
                    maxLength={1500}
                    placeholder="Describe the main reason for this visit"
                    className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-cyan-400 focus:ring-2 focus:ring-cyan-100"
                  />
                </div>

                <div className="md:col-span-2">
                  <label htmlFor="visit_notes" className="mb-2 block text-sm font-semibold text-slate-700">
                    Visit Notes
                  </label>
                  <textarea
                    id="visit_notes"
                    name="visit_notes"
                    rows={3}
                    value={form.visit_notes}
                    onChange={handleChange}
                    maxLength={3000}
                    placeholder="Add any relevant details shared by the patient"
                    className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-cyan-400 focus:ring-2 focus:ring-cyan-100"
                  />
                </div>

                <div>
                  <label htmlFor="medical_history_notes" className="mb-2 block text-sm font-semibold text-slate-700">
                    Previous Medical History
                  </label>
                  <textarea
                    id="medical_history_notes"
                    name="medical_history_notes"
                    rows={3}
                    value={form.medical_history_notes}
                    onChange={handleChange}
                    maxLength={3000}
                    placeholder="Previous conditions or relevant history (optional)"
                    className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-cyan-400 focus:ring-2 focus:ring-cyan-100"
                  />
                </div>

                <div>
                  <label htmlFor="current_medication_notes" className="mb-2 block text-sm font-semibold text-slate-700">
                    Current Medications
                  </label>
                  <textarea
                    id="current_medication_notes"
                    name="current_medication_notes"
                    rows={3}
                    value={form.current_medication_notes}
                    onChange={handleChange}
                    maxLength={3000}
                    placeholder="List medicines currently taken, if provided"
                    className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-cyan-400 focus:ring-2 focus:ring-cyan-100"
                  />
                </div>

                <div className="md:col-span-2">
                  <label htmlFor="allergy_notes" className="mb-2 block text-sm font-semibold text-slate-700">
                    Allergies
                  </label>
                  <textarea
                    id="allergy_notes"
                    name="allergy_notes"
                    rows={2}
                    value={form.allergy_notes}
                    onChange={handleChange}
                    maxLength={2000}
                    placeholder="Known allergies or 'Not reported' (optional)"
                    className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-cyan-400 focus:ring-2 focus:ring-cyan-100"
                  />
                </div>

              </div>

              {/* DOCTOR RECOMMENDATIONS */}
              <div className="mt-6 rounded-2xl border border-cyan-200 bg-cyan-50/50 p-4 md:p-5">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h4 className="font-semibold text-slate-900">
                      Doctor Recommendations
                    </h4>
                    <p className="mt-1 text-sm text-slate-600">
                      Find available doctors using the selected problem and the doctor's configured specialties and expertise.
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={recommendDoctors}
                    disabled={recommendationLoading || doctorsLoading}
                    className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-cyan-700 px-4 py-3 text-sm font-semibold text-white transition hover:bg-cyan-800 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {recommendationLoading ? (
                      <>
                        <LoaderCircle className="h-4 w-4 animate-spin" />
                        Finding doctors...
                      </>
                    ) : (
                      <>
                        <Stethoscope className="h-4 w-4" />
                        Find Recommended Doctors
                      </>
                    )}
                  </button>
                </div>

                {recommendationMessage && (
                  <p
                    role={recommendationError ? "alert" : "status"}
                    className={`mt-3 rounded-xl p-3 text-sm ${
                      recommendationError
                        ? "border border-amber-200 bg-amber-50 text-amber-800"
                        : "border border-emerald-200 bg-emerald-50 text-emerald-800"
                    }`}
                  >
                    {recommendationMessage}
                  </p>
                )}

                {recommendedDoctors.length > 0 && (
                  <div className="mt-4 grid gap-3 lg:grid-cols-2">
                    {recommendedDoctors.map((doctor) => {
                      const isSelected =
                        String(form.doctor_id) === String(doctor.doctor_id)
                      const specializations = Array.isArray(doctor.specializations)
                        ? doctor.specializations
                        : []
                      const languages = Array.isArray(doctor.languages)
                        ? doctor.languages
                        : []
                      const matchReasons = Array.isArray(doctor.match_reasons)
                        ? doctor.match_reasons
                        : []

                      return (
                        <article
                          key={doctor.doctor_id}
                          className={`rounded-xl border p-4 ${
                            isSelected
                              ? "border-cyan-400 bg-white ring-2 ring-cyan-100"
                              : "border-slate-200 bg-white"
                          }`}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <h5 className="font-semibold text-slate-900">
                                {doctor.full_name}
                              </h5>
                              {doctor.qualifications && (
                                <p className="mt-1 text-xs text-slate-500">
                                  {doctor.qualifications}
                                </p>
                              )}
                            </div>
                            <span className="shrink-0 rounded-full bg-cyan-100 px-2.5 py-1 text-xs font-bold text-cyan-800">
                              {Number(doctor.match_score) || 0}% keyword match
                            </span>
                          </div>

                          <div className="mt-3 space-y-1 text-sm text-slate-600">
                            <p>
                              <span className="font-semibold text-slate-700">Specialties: </span>
                              {specializations.length > 0
                                ? specializations.join(", ")
                                : "Not listed"}
                            </p>
                            {Number(doctor.experience_years) > 0 && (
                              <p>
                                <span className="font-semibold text-slate-700">Experience: </span>
                                {doctor.experience_years} years
                              </p>
                            )}
                            {languages.length > 0 && (
                              <p>
                                <span className="font-semibold text-slate-700">Languages: </span>
                                {languages.join(", ")}
                              </p>
                            )}
                          </div>

                          {matchReasons.length > 0 && (
                            <div className="mt-3 flex flex-wrap gap-1.5">
                              {matchReasons.map((reason, index) => (
                                <span
                                  key={`${doctor.doctor_id}-${index}`}
                                  className="rounded-full bg-slate-100 px-2.5 py-1 text-xs text-slate-600"
                                >
                                  {reason}
                                </span>
                              ))}
                            </div>
                          )}

                          <button
                            type="button"
                            onClick={() => chooseRecommendedDoctor(doctor)}
                            className={`mt-4 w-full rounded-lg px-3 py-2.5 text-sm font-semibold transition ${
                              isSelected
                                ? "bg-emerald-100 text-emerald-800"
                                : "bg-cyan-700 text-white hover:bg-cyan-800"
                            }`}
                          >
                            {isSelected ? "Selected Attending Doctor" : "Choose This Doctor"}
                          </button>
                        </article>
                      )
                    })}
                  </div>
                )}

                <p className="mt-3 text-xs leading-5 text-slate-500">
                  Recommendations are based on profile keyword overlap. The match percentage is not a diagnosis or a measure of clinical suitability. Confirm the appropriate doctor before registration.
                </p>
              </div>
            </section>

            {/* =================================================
                OPTIONAL CLINICAL OBSERVATIONS
            ================================================= */}

            <section className="border-t border-slate-100 pt-8">

              <div className="mb-4">
                <h3 className="font-semibold text-slate-900">
                  Clinical Observations (Optional)
                </h3>
                <p className="mt-1 text-sm text-slate-500">
                  Enter measurements only when they are available. These fields are not required for registration.
                </p>
              </div>

              <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">

                <div>
                  <label htmlFor="blood_pressure" className="mb-2 block text-sm font-semibold text-slate-700">
                    Blood Pressure
                  </label>
                  <input
                    id="blood_pressure"
                    name="blood_pressure"
                    value={form.blood_pressure}
                    onChange={handleChange}
                    maxLength={30}
                    placeholder="e.g. 120/80 mmHg"
                    className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-cyan-400 focus:ring-2 focus:ring-cyan-100"
                  />
                </div>

                <div>
                  <label htmlFor="pulse" className="mb-2 block text-sm font-semibold text-slate-700">
                    Pulse (bpm)
                  </label>
                  <input
                    id="pulse"
                    name="pulse"
                    type="number"
                    min="0"
                    max="300"
                    value={form.pulse}
                    onChange={handleChange}
                    placeholder="e.g. 72"
                    className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-cyan-400 focus:ring-2 focus:ring-cyan-100"
                  />
                </div>

                <div>
                  <label htmlFor="temperature_c" className="mb-2 block text-sm font-semibold text-slate-700">
                    Temperature (°C)
                  </label>
                  <input
                    id="temperature_c"
                    name="temperature_c"
                    type="number"
                    min="25"
                    max="45"
                    step="0.1"
                    value={form.temperature_c}
                    onChange={handleChange}
                    placeholder="e.g. 36.8"
                    className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-cyan-400 focus:ring-2 focus:ring-cyan-100"
                  />
                </div>

                <div>
                  <label htmlFor="spo2_percent" className="mb-2 block text-sm font-semibold text-slate-700">
                    SpO₂ (%)
                  </label>
                  <input
                    id="spo2_percent"
                    name="spo2_percent"
                    type="number"
                    min="0"
                    max="100"
                    value={form.spo2_percent}
                    onChange={handleChange}
                    placeholder="e.g. 98"
                    className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-cyan-400 focus:ring-2 focus:ring-cyan-100"
                  />
                </div>

                <div>
                  <label htmlFor="height_cm" className="mb-2 block text-sm font-semibold text-slate-700">
                    Height (cm)
                  </label>
                  <input
                    id="height_cm"
                    name="height_cm"
                    type="number"
                    min="1"
                    max="300"
                    step="0.1"
                    value={form.height_cm}
                    onChange={handleChange}
                    placeholder="e.g. 170"
                    className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-cyan-400 focus:ring-2 focus:ring-cyan-100"
                  />
                </div>

              </div>
            </section>

            {/* =================================================
                ADMISSION
            ================================================= */}

            <section className="border-t border-slate-100 pt-8">

              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">

                <label className="flex cursor-pointer items-start gap-3">

                  <input
                    type="checkbox"
                    name="admit_patient"
                    checked={form.admit_patient}
                    onChange={handleChange}
                    className="mt-1 h-4 w-4 rounded border-slate-300 text-cyan-600 focus:ring-cyan-500"
                  />

                  <span>

                    <span className="block text-sm font-semibold text-slate-800">
                      Admit Patient
                    </span>

                    <span className="mt-1 block text-sm leading-5 text-slate-500">
                      Select this option to assign the patient
                      to a real ward and available bed.
                    </span>

                  </span>

                </label>

              </div>

              {/* Ward / Bed */}

              {form.admit_patient && (

                <div className="mt-5 rounded-2xl border border-cyan-100 bg-cyan-50/40 p-5">

                  <div className="mb-5 flex items-center gap-3">

                    <div className="rounded-xl bg-cyan-100 p-2">

                      <BedDouble className="h-5 w-5 text-cyan-700" />

                    </div>

                    <div>

                      <h3 className="font-semibold text-slate-900">
                        Hospital Location
                      </h3>

                      <p className="mt-1 text-sm text-slate-500">
                        Select the ward first, then choose
                        an available bed.
                      </p>

                    </div>

                  </div>

                  <div className="grid gap-5 md:grid-cols-2">

                    {/* Ward */}

                    <div>

                      <label
                        htmlFor="ward_id"
                        className="mb-2 block text-sm font-semibold text-slate-700"
                      >
                        Ward
                        <span className="ml-1 text-red-500">
                          *
                        </span>
                      </label>

                      <select
                        id="ward_id"
                        name="ward_id"
                        value={form.ward_id}
                        onChange={handleChange}
                        required
                        disabled={wardsLoading}
                        className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-cyan-400 focus:ring-2 focus:ring-cyan-100 disabled:bg-slate-100"
                      >

                        <option value="">
                          {wardsLoading
                            ? "Loading wards..."
                            : "Select a ward"}
                        </option>

                        {wards.map(
                          (ward) => (
                            <option
                              key={ward.id}
                              value={ward.id}
                              disabled={
                                Number(
                                  ward.available_beds,
                                ) === 0
                              }
                            >
                              {ward.name}
                              {" • "}
                              {ward.available_beds}
                              {" available"}
                            </option>
                          ),
                        )}

                      </select>

                    </div>

                    {/* Bed */}

                    <div>

                      <label
                        htmlFor="bed_id"
                        className="mb-2 block text-sm font-semibold text-slate-700"
                      >
                        Available Bed
                        <span className="ml-1 text-red-500">
                          *
                        </span>
                      </label>

                      <select
                        id="bed_id"
                        name="bed_id"
                        value={form.bed_id}
                        onChange={handleChange}
                        required
                        disabled={
                          !form.ward_id ||
                          bedsLoading
                        }
                        className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-cyan-400 focus:ring-2 focus:ring-cyan-100 disabled:bg-slate-100"
                      >

                        <option value="">
                          {!form.ward_id
                            ? "Select ward first"
                            : bedsLoading
                              ? "Loading beds..."
                              : beds.length === 0
                                ? "No available beds"
                                : "Select available bed"}
                        </option>

                        {beds.map(
                          (bed) => (
                            <option
                              key={bed.id}
                              value={bed.id}
                            >
                              {bed.bed_number}
                              {" • "}
                              Available
                            </option>
                          ),
                        )}

                      </select>

                    </div>

                  </div>

                  {/* Selected location */}

                  {selectedWard && selectedBed && (

                    <div className="mt-5 rounded-xl border border-emerald-200 bg-emerald-50 p-4">

                      <p className="text-xs font-bold uppercase tracking-wide text-emerald-700">
                        Selected Location
                      </p>

                      <p className="mt-1 font-semibold text-emerald-900">
                        {selectedWard.name}
                        {" • "}
                        {selectedBed.bed_number}
                      </p>

                    </div>

                  )}

                </div>
              )}

            </section>

          </div>

          {/* =================================================
              ACTIONS
          ================================================= */}

          <div className="flex flex-col-reverse gap-3 border-t border-slate-200 bg-slate-50 p-5 sm:flex-row sm:justify-end md:p-6">

            <button
              type="button"
              onClick={handleCancel}
              disabled={loading}
              className="rounded-xl border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-50"
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={
                loading ||
                doctorsLoading ||
                doctors.length === 0
              }
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-cyan-600 px-5 py-3 text-sm font-semibold text-white hover:bg-cyan-700 disabled:cursor-not-allowed disabled:opacity-60"
            >

              {loading ? (
                <>
                  <LoaderCircle className="h-4 w-4 animate-spin" />
                  Registering...
                </>
              ) : (
                <>
                  <UserPlus className="h-4 w-4" />
                  Register Patient
                </>
              )}

            </button>

          </div>

        </form>

        {/* =================================================
            FOOTER
        ================================================= */}

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">

          <p className="text-sm font-semibold text-slate-800">
            Patient registration
          </p>

          <p className="mt-1 text-sm leading-6 text-slate-500">
            Patient records are stored in the SmartMedChart
            shared database and are available to authorized
            clinical users.
          </p>

        </div>

      </div>

    </MainLayout>
  )
}
