import {
  ArrowLeft,
  CalendarDays,
  CheckCircle2,
  ClipboardPlus,
  LoaderCircle,
  UserPlus,
  Weight,
} from "lucide-react"

import { useState } from "react"
import { useNavigate } from "react-router-dom"

import MainLayout from "../../components/layout/MainLayout"
import api from "../../services/api"


export default function AddPatient() {
  const navigate = useNavigate()

  const [form, setForm] = useState({
    patient_id: "",
    first_name: "",
    last_name: "",
    date_of_birth: "",
    gender: "",
    weight_kg: "",
    ward_id: "",
    bed_id: "",
    is_active: true,
  })

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [successPatient, setSuccessPatient] = useState(null)


  // =====================================================
  // Handle input changes
  // =====================================================

  function handleChange(event) {
    const { name, value, type, checked } =
      event.target

    setForm((current) => ({
      ...current,
      [name]:
        type === "checkbox"
          ? checked
          : value,
    }))
  }


  // =====================================================
  // Submit patient
  // =====================================================

  async function handleSubmit(event) {
    event.preventDefault()

    setError("")
    setSuccessPatient(null)


    // Basic validation
    if (
      !form.patient_id.trim() ||
      !form.first_name.trim() ||
      !form.last_name.trim()
    ) {
      setError(
        "Patient ID, first name, and last name are required."
      )
      return
    }


    setLoading(true)


    try {
      const payload = {
        patient_id: form.patient_id.trim(),
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

        ward_id:
          form.ward_id
            ? Number(form.ward_id)
            : null,

        bed_id:
          form.bed_id
            ? Number(form.bed_id)
            : null,

        is_active: form.is_active,
      }


      const response = await api.post(
        "/api/hospital/patients",
        payload
      )


      const createdPatient =
        response.data?.patient


      setSuccessPatient(
        createdPatient || null
      )


      // Reset form after success
      setForm({
        patient_id: "",
        first_name: "",
        last_name: "",
        date_of_birth: "",
        gender: "",
        weight_kg: "",
        ward_id: "",
        bed_id: "",
        is_active: true,
      })

    } catch (requestError) {
      console.error(
        "Create hospital patient error:",
        requestError
      )

      setError(
        requestError?.response?.data?.detail ||
          "Unable to create the patient record."
      )
    } finally {
      setLoading(false)
    }
  }


  // =====================================================
  // Cancel
  // =====================================================

  function handleCancel() {
    navigate("/hospital/dashboard")
  }


  // =====================================================
  // Render
  // =====================================================

  return (
    <MainLayout title="Register Patient">

      <div className="mx-auto max-w-5xl space-y-6">

        {/* =================================================
            Header
        ================================================= */}

        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">

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
              SmartMedChart database. The record will
              become available to authorized clinical
              workspaces.
            </p>

          </div>

        </div>


        {/* =================================================
            Error
        ================================================= */}

        {error && (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-4">

            <div className="flex items-start gap-3">

              <div className="rounded-xl bg-red-100 p-2">
                <ClipboardPlus className="h-5 w-5 text-red-600" />
              </div>

              <div>

                <p className="font-semibold text-red-800">
                  Patient registration failed
                </p>

                <p className="mt-1 text-sm text-red-700">
                  {error}
                </p>

              </div>

            </div>

          </div>
        )}


        {/* =================================================
            Success
        ================================================= */}

        {successPatient && (
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5">

            <div className="flex items-start gap-3">

              <div className="rounded-xl bg-emerald-100 p-2">
                <CheckCircle2 className="h-5 w-5 text-emerald-600" />
              </div>

              <div className="flex-1">

                <p className="font-semibold text-emerald-900">
                  Patient registered successfully
                </p>

                <p className="mt-1 text-sm text-emerald-800">
                  The patient has been saved to the
                  SmartMedChart shared database.
                </p>

                <div className="mt-4 grid gap-3 sm:grid-cols-3">

                  <div className="rounded-xl bg-white/80 p-3">

                    <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                      Patient
                    </p>

                    <p className="mt-1 font-semibold text-slate-900">
                      {successPatient.first_name}{" "}
                      {successPatient.last_name}
                    </p>

                  </div>


                  <div className="rounded-xl bg-white/80 p-3">

                    <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                      Patient ID
                    </p>

                    <p className="mt-1 font-semibold text-cyan-700">
                      {successPatient.patient_id}
                    </p>

                  </div>


                  <div className="rounded-xl bg-white/80 p-3">

                    <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                      Database ID
                    </p>

                    <p className="mt-1 font-semibold text-slate-900">
                      #{successPatient.id}
                    </p>

                  </div>

                </div>


                <div className="mt-4 flex flex-wrap gap-2">

                  <button
                    type="button"
                    onClick={() =>
                      navigate(
                        "/hospital/dashboard"
                      )
                    }
                    className="rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-700"
                  >
                    View Hospital Patients
                  </button>

                </div>

              </div>

            </div>

          </div>
        )}


        {/* =================================================
            Patient Form
        ================================================= */}

        <form
          onSubmit={handleSubmit}
          className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm"
        >

          {/* Form heading */}

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
                  Enter the hospital-provided patient
                  details below.
                </p>

              </div>

            </div>

          </div>


          <div className="space-y-8 p-5 md:p-6">

            {/* =================================================
                Basic Information
            ================================================= */}

            <section>

              <div className="mb-4">

                <h3 className="font-semibold text-slate-900">
                  Basic Information
                </h3>

                <p className="mt-1 text-sm text-slate-500">
                  Identity information for the patient.
                </p>

              </div>


              <div className="grid gap-5 md:grid-cols-2">

                {/* Patient ID */}

                <div>

                  <label
                    htmlFor="patient_id"
                    className="mb-2 block text-sm font-semibold text-slate-700"
                  >
                    Patient ID
                    <span className="ml-1 text-red-500">
                      *
                    </span>
                  </label>

                  <input
                    id="patient_id"
                    name="patient_id"
                    value={form.patient_id}
                    onChange={handleChange}
                    placeholder="e.g. SMH-PUN-260202"
                    required
                    maxLength={30}
                    className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition placeholder:text-slate-400 focus:border-cyan-400 focus:ring-2 focus:ring-cyan-100"
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
                    className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-cyan-400 focus:ring-2 focus:ring-cyan-100"
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


                {/* First name */}

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
                    className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition placeholder:text-slate-400 focus:border-cyan-400 focus:ring-2 focus:ring-cyan-100"
                  />

                </div>


                {/* Last name */}

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
                    className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition placeholder:text-slate-400 focus:border-cyan-400 focus:ring-2 focus:ring-cyan-100"
                  />

                </div>


                {/* Date of birth */}

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
                    className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-cyan-400 focus:ring-2 focus:ring-cyan-100"
                  />

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
                    className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition placeholder:text-slate-400 focus:border-cyan-400 focus:ring-2 focus:ring-cyan-100"
                  />

                </div>

              </div>

            </section>


            {/* =================================================
                Hospital Location
            ================================================= */}

            <section className="border-t border-slate-100 pt-8">

              <div className="mb-4">

                <h3 className="font-semibold text-slate-900">
                  Hospital Location
                </h3>

                <p className="mt-1 text-sm text-slate-500">
                  Ward and bed information for this patient.
                </p>

              </div>


              <div className="grid gap-5 md:grid-cols-2">

                {/* Ward */}

                <div>

                  <label
                    htmlFor="ward_id"
                    className="mb-2 block text-sm font-semibold text-slate-700"
                  >
                    Ward ID
                  </label>

                  <input
                    id="ward_id"
                    name="ward_id"
                    type="number"
                    min="1"
                    value={form.ward_id}
                    onChange={handleChange}
                    placeholder="e.g. 1"
                    className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition placeholder:text-slate-400 focus:border-cyan-400 focus:ring-2 focus:ring-cyan-100"
                  />

                </div>


                {/* Bed */}

                <div>

                  <label
                    htmlFor="bed_id"
                    className="mb-2 block text-sm font-semibold text-slate-700"
                  >
                    Bed ID
                  </label>

                  <input
                    id="bed_id"
                    name="bed_id"
                    type="number"
                    min="1"
                    value={form.bed_id}
                    onChange={handleChange}
                    placeholder="e.g. 4"
                    className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition placeholder:text-slate-400 focus:border-cyan-400 focus:ring-2 focus:ring-cyan-100"
                  />

                </div>

              </div>

            </section>


            {/* =================================================
                Active Status
            ================================================= */}

            <section className="border-t border-slate-100 pt-8">

              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">

                <label className="flex cursor-pointer items-start gap-3">

                  <input
                    type="checkbox"
                    name="is_active"
                    checked={form.is_active}
                    onChange={handleChange}
                    className="mt-1 h-4 w-4 rounded border-slate-300 text-cyan-600 focus:ring-cyan-500"
                  />

                  <span>

                    <span className="block text-sm font-semibold text-slate-800">
                      Active patient record
                    </span>

                    <span className="mt-1 block text-sm text-slate-500">
                      Active patients are available to authorized
                      clinical workflows.
                    </span>

                  </span>

                </label>

              </div>

            </section>

          </div>


          {/* =================================================
              Form Actions
          ================================================= */}

          <div className="flex flex-col-reverse gap-3 border-t border-slate-200 bg-slate-50 p-5 sm:flex-row sm:justify-end md:p-6">

            <button
              type="button"
              onClick={handleCancel}
              disabled={loading}
              className="rounded-xl border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-100 disabled:opacity-50"
            >
              Cancel
            </button>


            <button
              type="submit"
              disabled={loading}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-cyan-600 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-cyan-700 disabled:cursor-not-allowed disabled:opacity-60"
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
            Information
        ================================================= */}

        <div className="rounded-2xl border border-cyan-100 bg-cyan-50 p-5">

          <div className="flex items-start gap-3">

            <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-cyan-700" />

            <div>

              <p className="font-semibold text-cyan-900">
                Shared database
              </p>

              <p className="mt-1 text-sm leading-6 text-cyan-800">
                This form does not store patient information
                only in the frontend. It sends the information
                to the SmartMedChart backend, where the patient
                record is stored in the shared database.
              </p>

            </div>

          </div>

        </div>

      </div>

    </MainLayout>
  )
}