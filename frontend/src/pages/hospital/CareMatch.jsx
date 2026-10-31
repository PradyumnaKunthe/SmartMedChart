
import { useState } from "react"
import {
  Activity,
  AlertCircle,
  CalendarClock,
  CheckCircle2,
  ClipboardList,
  LoaderCircle,
  SearchCheck,
  Stethoscope,
  UserRound,
} from "lucide-react"

import MainLayout from "../../components/layout/MainLayout"
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

  // Appointment
  appointment_date: todayString(),
  appointment_time: "",
})

const inputClass =
  "mt-1 w-full rounded-xl border border-slate-200 bg-white px-3.5 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100 disabled:bg-slate-100"

function Field({ label, children }) {
  return (
    <label className="block text-sm font-semibold text-slate-700">
      {label}
      {children}
    </label>
  )
}

function SectionTitle({ number, title, subtitle, icon }) {
  return (
    <div className="flex items-start gap-3 border-b border-slate-100 pb-4">
      <div className="rounded-xl bg-indigo-50 p-2.5 text-indigo-700">
        {icon}
      </div>
      <div>
        <p className="text-xs font-bold uppercase tracking-widest text-indigo-600">
          Step {number}
        </p>
        <h2 className="mt-1 text-lg font-bold text-slate-900">{title}</h2>
        <p className="mt-1 text-sm leading-5 text-slate-500">{subtitle}</p>
      </div>
    </div>
  )
}

export default function CareMatch() {
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
    (doctor) => String(doctor.doctor_id) === String(selectedDoctorId),
  )

  function updateField(event) {
    const { name, value } = event.target

    setForm((current) => ({ ...current, [name]: value }))
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
    form.symptom_duration
      ? `Symptom duration: ${form.symptom_duration}`
      : "",
    form.symptom_severity
      ? `Reported severity: ${form.symptom_severity}`
      : "",
  ]
    .filter(Boolean)
    .join(". ")
}

  async function recommendDoctors() {
    if (!form.problem_category) {
      setError("Select the patient's main problem first.")
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

      if (list.length) {
        setSelectedDoctorId(String(list[0].doctor_id))
        setNotice(
          "Review the available doctors and choose the appropriate doctor. Suggestions are based on profile keywords, not a diagnosis.",
        )
      } else {
        setNotice(
          response.data?.message ||
          "No matching available doctor profiles were found. Ask an administrator to update doctor profiles.",
        )
      }
    } catch (requestError) {
      setError(
        requestError?.response?.data?.detail ||
        "Could not find doctor suggestions. Check the backend connection and CareMatch API.",
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
        `Patient ${registration.patient.patient_id} has already been registered, but the appointment could not be saved. ${requestError?.response?.data?.detail || "Check the backend and MongoDB, then retry."}`,
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
      setError("Enter the patient's first and last name.")
      return
    }

    if (!form.problem_category) {
      setError("Select the patient's main problem.")
      return
    }

    if (!selectedDoctor) {
      setError("Select a suggested doctor before registering the patient.")
      return
    }

    if (!form.appointment_date || !form.appointment_time) {
      setError("Choose an appointment date and time.")
      return
    }

    if (form.appointment_date < todayString()) {
      setError("The appointment date cannot be in the past.")
      return
    }

    setSubmitting(true)

    try {
            // Prepare optional clinical observations
      const clinicalObservations = {
        blood_pressure: form.blood_pressure.trim() || undefined,
        pulse: form.pulse ? Number(form.pulse) : undefined,
        temperature_c: form.temperature_c
          ? Number(form.temperature_c)
          : undefined,
        spo2_percent: form.spo2_percent
          ? Number(form.spo2_percent)
          : undefined,
        height_cm: form.height_cm
          ? Number(form.height_cm)
          : undefined,
      }

      // Remove empty observation values
      const filteredObservations = Object.fromEntries(
        Object.entries(clinicalObservations).filter(
          ([, value]) => value !== undefined
        )
      )

      const patientResponse = await api.post("/api/hospital/patients", {
        // Basic information
        first_name: form.first_name.trim(),
        last_name: form.last_name.trim(),
        date_of_birth: form.date_of_birth || null,
        gender: form.gender || null,
        weight_kg: form.weight_kg ? Number(form.weight_kg) : null,

        // Contact information
        mobile_number: form.mobile_number.trim() || null,
        email: form.email.trim() || null,
        address: form.address.trim() || null,

        // Emergency contact
        emergency_contact_name:
          form.emergency_contact_name.trim() || null,
        emergency_contact_number:
          form.emergency_contact_number.trim() || null,
        emergency_contact_relationship:
          form.emergency_contact_relationship.trim() || null,

        // Preferred language
        preferred_language:
          form.preferred_language.trim() || null,

        // Patient visit information
        problem_category: form.problem_category || null,
        chief_complaint: form.problem_category || null,
        symptom_duration: form.symptom_duration.trim() || null,
        symptom_severity: form.symptom_severity || null,
        visit_notes: form.visit_notes.trim() || null,
        medical_history_notes:
          form.medical_history_notes.trim() || null,
        current_medication_notes:
          form.current_medication_notes.trim() || null,
        allergy_notes: form.allergy_notes.trim() || null,

        // Clinical observations (optional)
        clinical_observations:
          Object.keys(filteredObservations).length > 0
            ? filteredObservations
            : null,

        // Doctor and admission
        doctor_id: Number(selectedDoctor.doctor_id),
        is_admitted: false,
        ward_id: null,
        bed_id: null,
      })

      const patient = patientResponse.data?.patient
      const encounter = patientResponse.data?.encounter

      if (!patient?.id || !encounter?.id) {
        setError(
          "The patient API did not return both the patient and encounter IDs. Check its response before trying again to avoid duplicate records.",
        )
        return
      }

      const registration = {
        patient,
        encounter,
        doctor_id: Number(selectedDoctor.doctor_id),
        doctor_name: selectedDoctor.full_name,
        visit_reason: getVisitReason(),
        appointment_date: form.appointment_date,
        appointment_time: form.appointment_time,
      }

      setPendingRegistration(registration)
      await saveAppointment(registration)
    } catch (requestError) {
      setError(
        requestError?.response?.data?.detail ||
        "Patient registration failed. Check the server message before trying again.",
      )
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <MainLayout title="Receptionist Counter">
      <div className="mx-auto max-w-7xl space-y-6 pb-8">

        <header className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-950 via-indigo-950 to-indigo-800 p-6 text-white shadow-lg sm:p-8">
          <div className="absolute -right-12 -top-20 h-64 w-64 rounded-full border-[35px] border-white/5" />
          <div className="relative flex flex-col justify-between gap-6 md:flex-row md:items-center">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-xs font-semibold text-indigo-100">
                <Activity size={14} />
                SMARTMEDCHART · CAREMATCH
              </div>
              <h1 className="mt-4 text-3xl font-bold tracking-tight sm:text-4xl">
                Receptionist Counter
              </h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-indigo-100">
                Register a patient, select their main concern, and review available doctors
                matched against their configured specializations and expertise.
              </p>
            </div>
            <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-2xl border border-white/15 bg-white/10">
              <Stethoscope size={38} />
            </div>
          </div>
        </header>

        {error && (
          <div role="alert" className="flex gap-3 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">
            <AlertCircle size={19} className="mt-0.5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {notice && !error && (
          <div role="status" className="rounded-2xl border border-indigo-100 bg-indigo-50 p-4 text-sm text-indigo-900">
            {notice}
          </div>
        )}

        {success && (
          <div role="status" className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5">
            <div className="flex items-start gap-3">
              <CheckCircle2 className="mt-0.5 shrink-0 text-emerald-700" size={24} />
              <div>
                <h2 className="font-bold text-emerald-950">Registration complete</h2>
                <p className="mt-1 text-sm text-emerald-900">
                  Patient ID: <strong>{success.patient.patient_id}</strong>
                </p>
                <p className="mt-1 text-sm text-emerald-900">
                  Selected doctor: <strong>{success.doctorName}</strong>
                </p>
                {success.appointment && (
                  <p className="mt-1 text-sm text-emerald-900">
                    Appointment: {success.appointment.appointment_date} at {success.appointment.appointment_time}
                  </p>
                )}
              </div>
            </div>
          </div>
        )}

        {pendingRegistration && !success && (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
            Patient <strong>{pendingRegistration.patient.patient_id}</strong> already exists.
            Retry saving the appointment below; this will not create another patient record.
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">

          <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
            <SectionTitle
              number="01"
              title="Patient information"
              subtitle="Enter the patient's basic details."
              icon={<UserRound size={22} />}
            />

            <div className="mt-6 grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
              <Field label="First name *">
                <input className={inputClass} name="first_name" value={form.first_name} onChange={updateField} required disabled={Boolean(pendingRegistration)} placeholder="Enter first name" />
              </Field>

              <Field label="Last name *">
                <input className={inputClass} name="last_name" value={form.last_name} onChange={updateField} required disabled={Boolean(pendingRegistration)} placeholder="Enter last name" />
              </Field>

              <Field label="Date of birth">
                <input className={inputClass} type="date" name="date_of_birth" value={form.date_of_birth} onChange={updateField} disabled={Boolean(pendingRegistration)} />
              </Field>

              <Field label="Gender">
                <select className={inputClass} name="gender" value={form.gender} onChange={updateField} disabled={Boolean(pendingRegistration)}>
                  <option value="">Select gender</option>
                  <option value="Female">Female</option>
                  <option value="Male">Male</option>
                  <option value="Other">Other</option>
                  <option value="Prefer not to say">Prefer not to say</option>
                </select>
              </Field>

              <Field label="Weight (kg)">
                <input className={inputClass} type="number" min="0.1" max="500" step="0.1" name="weight_kg" value={form.weight_kg} onChange={updateField} disabled={Boolean(pendingRegistration)} placeholder="Optional" />
              </Field>
            </div>
                        {/* CONTACT INFORMATION */}
            <div className="mt-8 border-t border-slate-100 pt-6">
              <h3 className="mb-4 font-semibold text-slate-900">
                Contact & Emergency Information
              </h3>

              <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">

                <Field label="Mobile number">
                  <input
                    className={inputClass}
                    type="tel"
                    name="mobile_number"
                    value={form.mobile_number}
                    onChange={updateField}
                    disabled={Boolean(pendingRegistration)}
                    maxLength={25}
                    placeholder="Patient mobile number"
                  />
                </Field>

                <Field label="Email address">
                  <input
                    className={inputClass}
                    type="email"
                    name="email"
                    value={form.email}
                    onChange={updateField}
                    disabled={Boolean(pendingRegistration)}
                    maxLength={255}
                    placeholder="patient@example.com"
                  />
                </Field>

                <Field label="Preferred language">
                  <input
                    className={inputClass}
                    name="preferred_language"
                    value={form.preferred_language}
                    onChange={updateField}
                    disabled={Boolean(pendingRegistration)}
                    maxLength={60}
                    placeholder="e.g. Marathi, Hindi, English"
                  />
                </Field>

                <Field label="Emergency contact name">
                  <input
                    className={inputClass}
                    name="emergency_contact_name"
                    value={form.emergency_contact_name}
                    onChange={updateField}
                    disabled={Boolean(pendingRegistration)}
                    maxLength={150}
                    placeholder="Emergency contact person's name"
                  />
                </Field>

                <Field label="Emergency contact number">
                  <input
                    className={inputClass}
                    type="tel"
                    name="emergency_contact_number"
                    value={form.emergency_contact_number}
                    onChange={updateField}
                    disabled={Boolean(pendingRegistration)}
                    maxLength={25}
                    placeholder="Emergency mobile number"
                  />
                </Field>

                <Field label="Relationship with patient">
                  <input
                    className={inputClass}
                    name="emergency_contact_relationship"
                    value={form.emergency_contact_relationship}
                    onChange={updateField}
                    disabled={Boolean(pendingRegistration)}
                    maxLength={60}
                    placeholder="e.g. Father, Mother, Spouse"
                  />
                </Field>

                <div className="sm:col-span-2 xl:col-span-3">
                  <Field label="Residential address">
                    <textarea
                      className={inputClass}
                      name="address"
                      value={form.address}
                      onChange={updateField}
                      disabled={Boolean(pendingRegistration)}
                      rows={3}
                      placeholder="Enter patient's complete address"
                    />
                  </Field>
                </div>

              </div>
            </div>
          </section>

          <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
            <SectionTitle
              number="02"
              title="Main problem or reason for visit"
              subtitle="Choose the closest category. This supports doctor matching, not diagnosis."
              icon={<ClipboardList size={22} />}
            />

            <div className="mt-6 grid gap-5 md:grid-cols-2">
              <Field label="Problem category *">
                <select className={inputClass} name="problem_category" value={form.problem_category} onChange={updateField} required disabled={Boolean(pendingRegistration)}>
                  <option value="">Select the main problem</option>
                  {PROBLEMS.map((problem) => (
                    <option key={problem} value={problem}>{problem}</option>
                  ))}
                </select>
              </Field>

              <Field label="Additional details (optional)">
                <textarea className={inputClass} name="visit_notes" value={form.visit_notes} onChange={updateField} rows={3} maxLength={1200} disabled={Boolean(pendingRegistration)} placeholder="Briefly record the concern reported by the patient..." />
              </Field>
            </div>
                        {/* SYMPTOMS AND MEDICAL HISTORY */}
            <div className="mt-8 border-t border-slate-100 pt-6">
              <h3 className="mb-4 font-semibold text-slate-900">
                Symptoms & Medical Background
              </h3>

              <div className="grid gap-5 sm:grid-cols-2">

                <Field label="How long has the patient had these symptoms?">
                  <input
                    className={inputClass}
                    name="symptom_duration"
                    value={form.symptom_duration}
                    onChange={updateField}
                    disabled={Boolean(pendingRegistration)}
                    maxLength={100}
                    placeholder="e.g. 3 days, 2 weeks"
                  />
                </Field>

                <Field label="Symptom severity">
                  <select
                    className={inputClass}
                    name="symptom_severity"
                    value={form.symptom_severity}
                    onChange={updateField}
                    disabled={Boolean(pendingRegistration)}
                  >
                    <option value="">Not specified</option>
                    <option value="Mild">Mild</option>
                    <option value="Moderate">Moderate</option>
                    <option value="Severe">Severe</option>
                  </select>
                </Field>

                <Field label="Previous medical history">
                  <textarea
                    className={inputClass}
                    name="medical_history_notes"
                    value={form.medical_history_notes}
                    onChange={updateField}
                    disabled={Boolean(pendingRegistration)}
                    rows={3}
                    placeholder="Previous illnesses, conditions or surgeries..."
                  />
                </Field>

                <Field label="Current medications">
                  <textarea
                    className={inputClass}
                    name="current_medication_notes"
                    value={form.current_medication_notes}
                    onChange={updateField}
                    disabled={Boolean(pendingRegistration)}
                    rows={3}
                    placeholder="Medicines currently being taken..."
                  />
                </Field>

                <div className="sm:col-span-2">
                  <Field label="Known allergies">
                    <textarea
                      className={inputClass}
                      name="allergy_notes"
                      value={form.allergy_notes}
                      onChange={updateField}
                      disabled={Boolean(pendingRegistration)}
                      rows={2}
                      placeholder="Medicine, food or other known allergies. Enter 'Not known' if appropriate."
                    />
                  </Field>
                </div>

              </div>
            </div>

            {/* OPTIONAL CLINICAL OBSERVATIONS */}
            <div className="mt-8 border-t border-slate-100 pt-6">
              <div className="mb-4">
                <h3 className="font-semibold text-slate-900">
                  Clinical Observations
                </h3>
                <p className="mt-1 text-sm text-slate-500">
                  Optional measurements. Leave blank when unavailable.
                  Enter verified measurements only.
                </p>
              </div>

              <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">

                <Field label="Blood pressure (mmHg)">
                  <input
                    className={inputClass}
                    name="blood_pressure"
                    value={form.blood_pressure}
                    onChange={updateField}
                    disabled={Boolean(pendingRegistration)}
                    placeholder="e.g. 120/80"
                  />
                </Field>

                <Field label="Pulse (bpm)">
                  <input
                    className={inputClass}
                    type="number"
                    min="0"
                    max="300"
                    name="pulse"
                    value={form.pulse}
                    onChange={updateField}
                    disabled={Boolean(pendingRegistration)}
                    placeholder="Optional"
                  />
                </Field>

                <Field label="Temperature (°C)">
                  <input
                    className={inputClass}
                    type="number"
                    min="25"
                    max="45"
                    step="0.1"
                    name="temperature_c"
                    value={form.temperature_c}
                    onChange={updateField}
                    disabled={Boolean(pendingRegistration)}
                    placeholder="Optional"
                  />
                </Field>

                <Field label="SpO₂ (%)">
                  <input
                    className={inputClass}
                    type="number"
                    min="0"
                    max="100"
                    step="1"
                    name="spo2_percent"
                    value={form.spo2_percent}
                    onChange={updateField}
                    disabled={Boolean(pendingRegistration)}
                    placeholder="Optional"
                  />
                </Field>

                <Field label="Height (cm)">
                  <input
                    className={inputClass}
                    type="number"
                    min="30"
                    max="250"
                    step="0.1"
                    name="height_cm"
                    value={form.height_cm}
                    onChange={updateField}
                    disabled={Boolean(pendingRegistration)}
                    placeholder="Optional"
                  />
                </Field>

              </div>
            </div>

            <div className="mt-5 flex flex-col gap-3 rounded-2xl bg-slate-50 p-4 sm:flex-row sm:items-center sm:justify-between">
              <p className="max-w-2xl text-xs leading-5 text-slate-600">
                For severe or emergency symptoms, follow hospital emergency protocol rather than relying on automated suggestions.
              </p>

              <button type="button" onClick={recommendDoctors} disabled={searching || !form.problem_category || Boolean(pendingRegistration)} className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-indigo-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60">
                {searching ? <LoaderCircle className="animate-spin" size={18} /> : <SearchCheck size={18} />}
                {searching ? "Finding doctors..." : "Recommend doctors"}
              </button>
            </div>
          </section>

          <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
            <SectionTitle
              number="03"
              title="Available doctor suggestions"
              subtitle="Review each suggestion and select the attending doctor."
              icon={<Stethoscope size={22} />}
            />

            {!recommendations.length ? (
              <div className="mt-5 rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center">
                <Stethoscope className="mx-auto text-slate-400" size={34} />
                <p className="mt-3 font-semibold text-slate-800">Doctor suggestions will appear here</p>
                <p className="mt-1 text-sm text-slate-500">Select a problem category and click “Recommend doctors”.</p>
              </div>
            ) : (
              <div className="mt-5 grid gap-4 lg:grid-cols-2">
                {recommendations.map((doctor) => {
                  const isSelected = String(doctor.doctor_id) === String(selectedDoctorId)
                  const qualifications = Array.isArray(doctor.qualifications)
                    ? doctor.qualifications.join(" · ")
                    : doctor.qualifications || "Qualifications not listed"
                  const expertise = doctor.expertise_keywords || doctor.expertise_areas || []
                  const experience = doctor.experience_years ?? doctor.years_experience ?? 0

                  return (
                    <button
                      type="button"
                      key={doctor.doctor_id}
                      disabled={Boolean(pendingRegistration)}
                      onClick={() => setSelectedDoctorId(String(doctor.doctor_id))}
                      className={`rounded-2xl border p-5 text-left transition ${
                        isSelected
                          ? "border-indigo-400 bg-indigo-50 ring-2 ring-indigo-100"
                          : "border-slate-200 bg-white hover:border-indigo-200 hover:bg-slate-50"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-start gap-3">
                          <div className="rounded-xl bg-indigo-100 p-3 text-indigo-700">
                            <Stethoscope size={22} />
                          </div>
                          <div>
                            <h3 className="font-bold text-slate-900">{doctor.full_name}</h3>
                            <p className="mt-1 text-xs text-slate-500">{qualifications}</p>
                          </div>
                        </div>
                        <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-bold text-emerald-800">
                          {doctor.match_score ?? 0}% match
                        </span>
                      </div>

                      <p className="mt-4 text-sm font-semibold text-slate-800">
                        {(doctor.specializations || []).join(", ") || "Specialization not listed"}
                      </p>

                      {expertise.length > 0 && (
                        <p className="mt-2 text-sm text-slate-600">
                          Expertise: {expertise.join(", ")}
                        </p>
                      )}

                      <p className="mt-2 text-sm text-slate-600">
                        Experience: {experience} years
                        {doctor.consultation_fee != null ? ` · Fee ₹${doctor.consultation_fee}` : ""}
                      </p>
                        {doctor.language_match && (
                        <p className="mt-2 text-sm font-medium text-emerald-700">
                          ✓ Supports patient's preferred language
                        </p>
                      )}

                      {doctor.match_reasons?.length > 0 && (
                        <p className="mt-3 text-xs text-indigo-700">
                          Matching terms: {doctor.match_reasons.join(", ")}
                        </p>
                      )}

                      <span className={`mt-4 inline-flex rounded-lg px-3 py-2 text-xs font-bold ${
                        isSelected ? "bg-indigo-600 text-white" : "bg-white text-slate-700 ring-1 ring-slate-200"
                      }`}>
                        {isSelected ? "✓ Selected" : "Select this doctor"}
                      </span>
                    </button>
                  )
                })}
              </div>
            )}
          </section>

          <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
            <SectionTitle
              number="04"
              title="Appointment details"
              subtitle="Choose a date and time for the selected doctor."
              icon={<CalendarClock size={22} />}
            />

            <div className="mt-6 grid gap-5 sm:grid-cols-2">
              <Field label="Appointment date *">
                <input className={inputClass} type="date" name="appointment_date" min={todayString()} value={form.appointment_date} onChange={updateField} required />
              </Field>

              <Field label="Appointment time *">
                <input className={inputClass} type="time" name="appointment_time" value={form.appointment_time} onChange={updateField} required />
              </Field>
            </div>

            {selectedDoctor && (
              <div className="mt-5 rounded-2xl border border-indigo-100 bg-indigo-50 p-4 text-sm text-indigo-950">
                Selected doctor: <strong>{selectedDoctor.full_name}</strong>
              </div>
            )}
          </section>

          <div className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs leading-5 text-slate-500">
              Please verify the information before submitting. Do not create duplicate patient records if an appointment-saving error occurs.
            </p>

            <button type="submit" disabled={submitting || (!pendingRegistration && !selectedDoctor)} className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-emerald-600 px-6 py-3.5 text-sm font-bold text-white shadow-sm transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60">
              {submitting ? <LoaderCircle className="animate-spin" size={18} /> : pendingRegistration ? <CalendarClock size={18} /> : <CheckCircle2 size={18} />}
              {submitting ? "Saving..." : pendingRegistration ? "Retry appointment saving" : "Register patient & book"}
            </button>
          </div>
        </form>
      </div>
    </MainLayout>
  )
}
