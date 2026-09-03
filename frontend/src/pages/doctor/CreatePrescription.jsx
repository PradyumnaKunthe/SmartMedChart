import {
  AlertTriangle,
  ArrowLeft,
  CalendarDays,
  CheckCircle2,
  ClipboardPlus,
  Edit3,
  LoaderCircle,
  Pill,
  Plus,
  Save,
  ShieldAlert,
  Trash2,
  X,
} from "lucide-react"

import {
  useEffect,
  useState,
} from "react"

import {
  useNavigate,
  useSearchParams,
} from "react-router-dom"

import MainLayout from "../../components/layout/MainLayout"

import {
  createPatientAllergy,
  createPrescription,
  deletePatientAllergy,
  getDoctorMedicines,
  getDoctorPatient,
  getPatientAllergies,
  updatePatientAllergy,
} from "../../services/doctor"


const FREQUENCIES = [
  "ONCE_DAILY",
  "TWICE_DAILY",
  "EVERY_8_HOURS",
  "EVERY_6_HOURS",
]

const SEVERITIES = [
  "LOW",
  "MODERATE",
  "HIGH",
  "SEVERE",
]


function severityClasses(severity) {
  switch (String(severity || "").toUpperCase()) {
    case "SEVERE":
      return "border-red-300 bg-red-100 text-red-800"

    case "HIGH":
      return "border-red-200 bg-red-50 text-red-700"

    case "MODERATE":
      return "border-amber-200 bg-amber-50 text-amber-700"

    case "LOW":
      return "border-slate-200 bg-slate-100 text-slate-600"

    default:
      return "border-slate-200 bg-slate-100 text-slate-600"
  }
}


export default function CreatePrescription() {
  const navigate = useNavigate()

  const [searchParams] =
    useSearchParams()

  const patientId =
    searchParams.get("patient")


  const [patient, setPatient] =
    useState(null)

  const [medicines, setMedicines] =
    useState([])

  const [allergies, setAllergies] =
    useState([])

  const [loading, setLoading] =
    useState(true)

  const [submitting, setSubmitting] =
    useState(false)

  const [error, setError] =
    useState("")

  const [success, setSuccess] =
    useState(null)


  const [allergyModalOpen, setAllergyModalOpen] =
    useState(false)

  const [editingAllergy, setEditingAllergy] =
    useState(null)

  const [savingAllergy, setSavingAllergy] =
    useState(false)

  const [deletingAllergyId, setDeletingAllergyId] =
    useState(null)

  const [allergyError, setAllergyError] =
    useState("")

  const [allergyForm, setAllergyForm] =
    useState({
      allergen: "",
      reaction: "",
      severity: "MODERATE",
      notes: "",
    })


  const [form, setForm] =
    useState({
      medicine_id: "",
      dose: "",
      route: "",
      frequency: "ONCE_DAILY",
      duration_days: 1,
      start_date: "",
      start_time: "",
      is_stat: false,
      instructions: "",
      notes: "",
    })


  // =========================================================
  // LOAD PATIENT / MEDICINES / ALLERGIES
  // =========================================================

  useEffect(() => {
    async function loadData() {
      if (!patientId) {
        setError(
          "No patient was selected.",
        )

        setLoading(false)
        return
      }

      setLoading(true)
      setError("")

      try {
        const [
          patientData,
          medicineData,
          allergyData,
        ] = await Promise.all([
          getDoctorPatient(
            patientId,
          ),

          getDoctorMedicines(),

          getPatientAllergies(
            patientId,
          ),
        ])

        setPatient(
          patientData,
        )

        setMedicines(
          Array.isArray(
            medicineData,
          )
            ? medicineData
            : [],
        )

        setAllergies(
          Array.isArray(
            allergyData,
          )
            ? allergyData
            : [],
        )

      } catch (requestError) {
        setError(
          requestError?.response?.data?.detail ||
            "Unable to load prescription data.",
        )
      } finally {
        setLoading(false)
      }
    }

    loadData()
  }, [patientId])


  // =========================================================
  // PRESCRIPTION FORM
  // =========================================================

  function handleChange(
    event,
  ) {
    const {
      name,
      value,
      type,
      checked,
    } = event.target

    setForm(
      (previous) => ({
        ...previous,
        [name]:
          type === "checkbox"
            ? checked
            : value,
      }),
    )
  }


  // =========================================================
  // ALLERGY FORM
  // =========================================================

  function handleAllergyChange(
    event,
  ) {
    const {
      name,
      value,
    } = event.target

    setAllergyForm(
      (previous) => ({
        ...previous,
        [name]: value,
      }),
    )
  }


  function openAddAllergy() {
    setEditingAllergy(null)

    setAllergyForm({
      allergen: "",
      reaction: "",
      severity: "MODERATE",
      notes: "",
    })

    setAllergyError("")
    setAllergyModalOpen(true)
  }


  function openEditAllergy(
    allergy,
  ) {
    setEditingAllergy(
      allergy,
    )

    setAllergyForm({
      allergen:
        allergy.allergen || "",

      reaction:
        allergy.reaction || "",

      severity:
        allergy.severity ||
        "MODERATE",

      notes:
        allergy.notes || "",
    })

    setAllergyError("")
    setAllergyModalOpen(true)
  }


  function closeAllergyModal() {
    if (savingAllergy) {
      return
    }

    setAllergyModalOpen(false)
    setEditingAllergy(null)
    setAllergyError("")
  }


  async function handleSaveAllergy(
    event,
  ) {
    event.preventDefault()

    setAllergyError("")

    if (
      !allergyForm.allergen.trim()
    ) {
      setAllergyError(
        "Please enter the allergen.",
      )

      return
    }

    setSavingAllergy(true)

    try {
      let result

      const payload = {
        allergen:
          allergyForm.allergen.trim(),

        reaction:
          allergyForm.reaction.trim() ||
          null,

        severity:
          allergyForm.severity || null,

        notes:
          allergyForm.notes.trim() ||
          null,
      }

      if (editingAllergy) {
        result =
          await updatePatientAllergy(
            patientId,
            editingAllergy.id,
            payload,
          )

        setAllergies(
          (previous) =>
            previous.map(
              (item) =>
                item.id ===
                editingAllergy.id
                  ? result
                  : item,
            ),
        )
      } else {
        result =
          await createPatientAllergy(
            patientId,
            payload,
          )

        setAllergies(
          (previous) => [
            ...previous,
            result,
          ],
        )
      }

      closeAllergyModal()

    } catch (requestError) {
      setAllergyError(
        requestError?.response?.data?.detail ||
          "Unable to save allergy.",
      )
    } finally {
      setSavingAllergy(false)
    }
  }


  async function handleDeleteAllergy(
    allergy,
  ) {
    const confirmed =
      window.confirm(
        `Remove the allergy "${allergy.allergen}" from this patient record?`,
      )

    if (!confirmed) {
      return
    }

    setDeletingAllergyId(
      allergy.id,
    )

    setError("")

    try {
      await deletePatientAllergy(
        patientId,
        allergy.id,
      )

      setAllergies(
        (previous) =>
          previous.filter(
            (item) =>
              item.id !== allergy.id,
          ),
      )
    } catch (requestError) {
      setError(
        requestError?.response?.data?.detail ||
          "Unable to remove allergy.",
      )
    } finally {
      setDeletingAllergyId(null)
    }
  }


  // =========================================================
  // CREATE PRESCRIPTION
  // =========================================================

  async function handleSubmit(
    event,
  ) {
    event.preventDefault()

    setSubmitting(true)
    setError("")
    setSuccess(null)

    try {
      const payload = {
        patient_id:
          Number(patientId),

        medicine_id:
          Number(form.medicine_id),

        dose:
          form.dose.trim(),

        route:
          form.route.trim(),

        frequency:
          form.frequency,

        duration_days:
          Number(
            form.duration_days,
          ),

        start_date:
          form.start_date,

        start_time:
          form.start_time,

        is_stat:
          Boolean(form.is_stat),

        instructions:
          form.instructions.trim() ||
          null,

        notes:
          form.notes.trim() ||
          null,
      }

      const result =
        await createPrescription(
          payload,
        )

      setSuccess(result)

      setForm(
        (previous) => ({
          ...previous,
          medicine_id: "",
          dose: "",
          route: "",
          frequency:
            "ONCE_DAILY",
          duration_days: 1,
          start_date: "",
          start_time: "",
          is_stat: false,
          instructions: "",
          notes: "",
        }),
      )

    } catch (requestError) {
      setError(
        requestError?.response?.data?.detail ||
          "Unable to create prescription.",
      )
    } finally {
      setSubmitting(false)
    }
  }


  // =========================================================
  // LOADING
  // =========================================================

  if (loading) {
    return (
      <MainLayout title="Create Prescription">

        <div className="flex min-h-[60vh] items-center justify-center">

          <div className="text-center">

            <LoaderCircle className="mx-auto h-9 w-9 animate-spin text-cyan-500" />

            <p className="mt-4 text-sm text-slate-500">
              Loading prescription form...
            </p>

          </div>

        </div>

      </MainLayout>
    )
  }


  // =========================================================
  // MAIN UI
  // =========================================================

  return (
    <MainLayout title="Create Prescription">

      <div className="mx-auto max-w-5xl space-y-6">

        {/* =================================================
            BACK
        ================================================= */}

        <button
          type="button"
          onClick={() =>
            navigate(
              patientId
                ? `/doctor/patients/${patientId}`
                : "/doctor/patients",
            )
          }
          className="inline-flex items-center gap-2 text-sm font-semibold text-slate-600 transition hover:text-slate-900"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to patient
        </button>


        {/* =================================================
            HEADER
        ================================================= */}

        <section className="rounded-3xl bg-slate-950 p-6 text-white shadow-xl lg:p-8">

          <div className="flex items-start gap-4">

            <div className="rounded-2xl bg-cyan-500/10 p-3">

              <ClipboardPlus className="h-7 w-7 text-cyan-400" />

            </div>

            <div>

              <p className="text-xs font-bold uppercase tracking-[0.2em] text-cyan-400">
                Doctor Workspace
              </p>

              <h1 className="mt-1 text-3xl font-bold">
                Create Prescription
              </h1>

              {patient && (
                <p className="mt-3 text-sm text-slate-400">

                  Patient:{" "}

                  <span className="font-semibold text-white">
                    {patient.first_name}{" "}
                    {patient.last_name}
                  </span>

                  {" · "}

                  ID:{" "}

                  <span className="font-semibold text-slate-300">
                    {patient.patient_id}
                  </span>

                </p>
              )}

            </div>

          </div>

        </section>


        {/* =================================================
            ERROR
        ================================================= */}

        {error && (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-4">

            <div className="flex items-start gap-3">

              <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-red-600" />

              <p className="text-sm leading-6 text-red-700">
                {error}
              </p>

            </div>

          </div>
        )}


        {/* =================================================
            PATIENT SAFETY / ALLERGIES
        ================================================= */}

        <section className="overflow-hidden rounded-3xl border border-red-200 bg-white shadow-sm">

          <div className="border-b border-red-100 bg-red-50/70 p-6">

            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">

              <div className="flex items-center gap-3">

                <div className="rounded-xl bg-red-100 p-3">
                  <ShieldAlert className="h-6 w-6 text-red-600" />
                </div>

                <div>

                  <h2 className="text-lg font-bold text-red-950">
                    Patient Safety
                  </h2>

                  <p className="text-sm text-red-700">
                    Known allergies and clinical warnings
                  </p>

                </div>

              </div>


              <button
                type="button"
                onClick={
                  openAddAllergy
                }
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-red-600 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-red-700"
              >

                <Plus className="h-4 w-4" />

                Add Allergy

              </button>

            </div>

          </div>


          <div className="p-6">

            {allergies.length === 0 ? (

              <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-6 text-center">

                <ShieldAlert className="mx-auto h-8 w-8 text-slate-300" />

                <p className="mt-3 text-sm font-semibold text-slate-700">
                  No allergies recorded
                </p>

                <p className="mt-1 text-xs leading-5 text-slate-500">
                  Add any known patient allergy before prescribing medication.
                </p>

              </div>

            ) : (

              <div className="space-y-3">

                {allergies.map(
                  (allergy) => (

                    <div
                      key={allergy.id}
                      className={[
                        "rounded-2xl border p-4",
                        allergy.severity === "SEVERE" ||
                        allergy.severity === "HIGH"
                          ? "border-red-200 bg-red-50/60"
                          : "border-slate-200 bg-slate-50",
                      ].join(" ")}
                    >

                      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">

                        <div className="flex gap-3">

                          <div className="mt-0.5">

                            <AlertTriangle
                              className={
                                allergy.severity === "SEVERE" ||
                                allergy.severity === "HIGH"
                                  ? "h-5 w-5 text-red-600"
                                  : "h-5 w-5 text-amber-500"
                              }
                            />

                          </div>

                          <div>

                            <div className="flex flex-wrap items-center gap-2">

                              <h3 className="font-bold text-slate-900">
                                {allergy.allergen}
                              </h3>

                              {allergy.severity && (
                                <span
                                  className={[
                                    "rounded-full border px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-wide",
                                    severityClasses(
                                      allergy.severity,
                                    ),
                                  ].join(" ")}
                                >
                                  {allergy.severity}
                                </span>
                              )}

                            </div>


                            {allergy.reaction && (
                              <p className="mt-2 text-sm text-slate-600">
                                <span className="font-semibold">
                                  Reaction:
                                </span>{" "}
                                {allergy.reaction}
                              </p>
                            )}


                            {allergy.notes && (
                              <p className="mt-2 rounded-xl bg-white/70 p-3 text-sm leading-5 text-slate-600">
                                {allergy.notes}
                              </p>
                            )}

                          </div>

                        </div>


                        <div className="flex shrink-0 gap-2">

                          <button
                            type="button"
                            onClick={() =>
                              openEditAllergy(
                                allergy,
                              )
                            }
                            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50"
                          >

                            <Edit3 className="h-3.5 w-3.5" />

                            Edit

                          </button>


                          <button
                            type="button"
                            disabled={
                              deletingAllergyId ===
                              allergy.id
                            }
                            onClick={() =>
                              handleDeleteAllergy(
                                allergy,
                              )
                            }
                            className="inline-flex items-center gap-1.5 rounded-xl border border-red-200 bg-white px-3 py-2 text-xs font-bold text-red-700 hover:bg-red-50 disabled:opacity-50"
                          >

                            {deletingAllergyId ===
                            allergy.id ? (
                              <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <Trash2 className="h-3.5 w-3.5" />
                            )}

                            Remove

                          </button>

                        </div>

                      </div>

                    </div>

                  ),
                )}

              </div>

            )}

          </div>

        </section>


        {/* =================================================
            SUCCESS
        ================================================= */}

        {success && (
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5">

            <div className="flex items-start gap-3">

              <div className="rounded-xl bg-emerald-100 p-3">
                <CheckCircle2 className="h-5 w-5 text-emerald-600" />
              </div>

              <div>

                <p className="font-semibold text-emerald-900">
                  Prescription created successfully
                </p>

                <p className="mt-1 text-sm text-emerald-700">

                  Prescription #
                  {success.prescription_id}
                  {" "}was created and{" "}
                  {success.schedule_count}
                  {" "}medication schedule(s) were generated.

                </p>

                <button
                  type="button"
                  onClick={() =>
                    navigate(
                      `/doctor/patients/${patientId}`,
                    )
                  }
                  className="mt-4 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700"
                >
                  Return to Patient
                </button>

              </div>

            </div>

          </div>
        )}


        {/* =================================================
            PRESCRIPTION FORM
        ================================================= */}

        {!success && (
          <form
            onSubmit={
              handleSubmit
            }
            className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm"
          >

            <div className="space-y-6">

              {/* Medicine */}

              <div>

                <label
                  htmlFor="medicine_id"
                  className="mb-2 block text-sm font-semibold text-slate-700"
                >
                  Medicine
                </label>

                <div className="relative">

                  <Pill className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />

                  <select
                    id="medicine_id"
                    name="medicine_id"
                    value={
                      form.medicine_id
                    }
                    onChange={
                      handleChange
                    }
                    required
                    className="w-full appearance-none rounded-xl border border-slate-200 bg-white py-3 pl-10 pr-4 text-sm text-slate-800 outline-none focus:border-cyan-400 focus:ring-4 focus:ring-cyan-400/10"
                  >

                    <option value="">
                      Select a medicine
                    </option>

                    {medicines.map(
                      (medicine) => (
                        <option
                          key={
                            medicine.id
                          }
                          value={
                            medicine.id
                          }
                        >
                          {medicine.name}
                          {medicine.strength
                            ? ` · ${medicine.strength}`
                            : ""}
                        </option>
                      ),
                    )}

                  </select>

                </div>

              </div>


              {/* Dose + Route */}

              <div className="grid gap-5 md:grid-cols-2">

                <div>

                  <label
                    htmlFor="dose"
                    className="mb-2 block text-sm font-semibold text-slate-700"
                  >
                    Dose
                  </label>

                  <input
                    id="dose"
                    name="dose"
                    value={
                      form.dose
                    }
                    onChange={
                      handleChange
                    }
                    required
                    maxLength={100}
                    placeholder="e.g. 500 mg"
                    className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-800 outline-none focus:border-cyan-400 focus:ring-4 focus:ring-cyan-400/10"
                  />

                </div>


                <div>

                  <label
                    htmlFor="route"
                    className="mb-2 block text-sm font-semibold text-slate-700"
                  >
                    Route
                  </label>

                  <input
                    id="route"
                    name="route"
                    value={
                      form.route
                    }
                    onChange={
                      handleChange
                    }
                    required
                    maxLength={50}
                    placeholder="e.g. Oral"
                    className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-800 outline-none focus:border-cyan-400 focus:ring-4 focus:ring-cyan-400/10"
                  />

                </div>

              </div>


              {/* Frequency + Duration */}

              <div className="grid gap-5 md:grid-cols-2">

                <div>

                  <label
                    htmlFor="frequency"
                    className="mb-2 block text-sm font-semibold text-slate-700"
                  >
                    Frequency
                  </label>

                  <select
                    id="frequency"
                    name="frequency"
                    value={
                      form.frequency
                    }
                    onChange={
                      handleChange
                    }
                    required
                    className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-800 outline-none focus:border-cyan-400 focus:ring-4 focus:ring-cyan-400/10"
                  >

                    {FREQUENCIES.map(
                      (frequency) => (
                        <option
                          key={
                            frequency
                          }
                          value={
                            frequency
                          }
                        >
                          {frequency.replace(
                            /_/g,
                            " ",
                          )}
                        </option>
                      ),
                    )}

                  </select>

                </div>


                <div>

                  <label
                    htmlFor="duration_days"
                    className="mb-2 block text-sm font-semibold text-slate-700"
                  >
                    Duration (days)
                  </label>

                  <input
                    id="duration_days"
                    name="duration_days"
                    type="number"
                    min="1"
                    max="365"
                    value={
                      form.duration_days
                    }
                    onChange={
                      handleChange
                    }
                    required
                    className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-800 outline-none focus:border-cyan-400 focus:ring-4 focus:ring-cyan-400/10"
                  />

                </div>

              </div>


              {/* Date + Time */}

              <div className="grid gap-5 md:grid-cols-2">

                <div>

                  <label
                    htmlFor="start_date"
                    className="mb-2 block text-sm font-semibold text-slate-700"
                  >
                    Start Date
                  </label>

                  <div className="relative">

                    <CalendarDays className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />

                    <input
                      id="start_date"
                      name="start_date"
                      type="date"
                      value={
                        form.start_date
                      }
                      onChange={
                        handleChange
                      }
                      required
                      className="w-full rounded-xl border border-slate-200 bg-white py-3 pl-10 pr-4 text-sm text-slate-800 outline-none focus:border-cyan-400 focus:ring-4 focus:ring-cyan-400/10"
                    />

                  </div>

                </div>


                <div>

                  <label
                    htmlFor="start_time"
                    className="mb-2 block text-sm font-semibold text-slate-700"
                  >
                    Start Time
                  </label>

                  <input
                    id="start_time"
                    name="start_time"
                    type="time"
                    value={
                      form.start_time
                    }
                    onChange={
                      handleChange
                    }
                    required
                    className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-800 outline-none focus:border-cyan-400 focus:ring-4 focus:ring-cyan-400/10"
                  />

                </div>

              </div>


              {/* STAT */}

              <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4">

                <input
                  type="checkbox"
                  name="is_stat"
                  checked={
                    form.is_stat
                  }
                  onChange={
                    handleChange
                  }
                  className="mt-1 h-4 w-4 rounded border-slate-300 text-cyan-600 focus:ring-cyan-500"
                />

                <span>

                  <span className="block text-sm font-semibold text-slate-800">
                    STAT medication
                  </span>

                  <span className="mt-1 block text-xs leading-5 text-slate-500">
                    Mark this medication as urgent/immediate.
                  </span>

                </span>

              </label>


              {/* Instructions */}

              <div>

                <label
                  htmlFor="instructions"
                  className="mb-2 block text-sm font-semibold text-slate-700"
                >
                  Instructions
                </label>

                <textarea
                  id="instructions"
                  name="instructions"
                  rows={3}
                  maxLength={1000}
                  value={
                    form.instructions
                  }
                  onChange={
                    handleChange
                  }
                  placeholder="e.g. Take after food."
                  className="w-full resize-none rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-800 outline-none focus:border-cyan-400 focus:ring-4 focus:ring-cyan-400/10"
                />

              </div>


              {/* Notes */}

              <div>

                <label
                  htmlFor="notes"
                  className="mb-2 block text-sm font-semibold text-slate-700"
                >
                  Prescription Notes
                </label>

                <textarea
                  id="notes"
                  name="notes"
                  rows={3}
                  maxLength={2000}
                  value={
                    form.notes
                  }
                  onChange={
                    handleChange
                  }
                  placeholder="Additional clinical notes..."
                  className="w-full resize-none rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-800 outline-none focus:border-cyan-400 focus:ring-4 focus:ring-cyan-400/10"
                />

              </div>


              {/* Submit */}

              <div className="flex flex-col-reverse gap-3 border-t border-slate-100 pt-6 sm:flex-row sm:justify-end">

                <button
                  type="button"
                  onClick={() =>
                    navigate(
                      `/doctor/patients/${patientId}`,
                    )
                  }
                  disabled={
                    submitting
                  }
                  className="rounded-xl border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                >
                  Cancel
                </button>


                <button
                  type="submit"
                  disabled={
                    submitting ||
                    medicines.length === 0
                  }
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-cyan-600 px-5 py-3 text-sm font-semibold text-white shadow-sm hover:bg-cyan-700 disabled:cursor-not-allowed disabled:opacity-50"
                >

                  {submitting ? (
                    <LoaderCircle className="h-5 w-5 animate-spin" />
                  ) : (
                    <Save className="h-5 w-5" />
                  )}

                  {submitting
                    ? "Creating..."
                    : "Create Prescription"}

                </button>

              </div>

            </div>

          </form>
        )}

      </div>


      {/* =====================================================
          ALLERGY MODAL
      ===================================================== */}

      {allergyModalOpen && (

        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm">

          <div className="w-full max-w-lg overflow-hidden rounded-3xl bg-white shadow-2xl">

            <div className="flex items-center justify-between border-b border-slate-100 p-6">

              <div>

                <div className="flex items-center gap-2">

                  <div className="rounded-xl bg-red-50 p-2">

                    <ShieldAlert className="h-5 w-5 text-red-600" />

                  </div>

                  <h2 className="text-lg font-bold text-slate-900">

                    {editingAllergy
                      ? "Edit Allergy"
                      : "Add Patient Allergy"}

                  </h2>

                </div>

                <p className="mt-1 text-sm text-slate-500">
                  Record a known allergy for this patient.
                </p>

              </div>


              <button
                type="button"
                onClick={
                  closeAllergyModal
                }
                disabled={
                  savingAllergy
                }
                className="rounded-xl p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700 disabled:opacity-50"
              >

                <X className="h-5 w-5" />

              </button>

            </div>


            <form
              onSubmit={
                handleSaveAllergy
              }
              className="space-y-5 p-6"
            >

              {allergyError && (
                <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                  {allergyError}
                </div>
              )}


              <div>

                <label
                  htmlFor="allergen"
                  className="mb-2 block text-sm font-semibold text-slate-700"
                >
                  Allergen
                </label>

                <input
                  id="allergen"
                  name="allergen"
                  value={
                    allergyForm.allergen
                  }
                  onChange={
                    handleAllergyChange
                  }
                  required
                  maxLength={150}
                  placeholder="e.g. Penicillin"
                  className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-red-400 focus:ring-4 focus:ring-red-400/10"
                />

              </div>


              <div>

                <label
                  htmlFor="reaction"
                  className="mb-2 block text-sm font-semibold text-slate-700"
                >
                  Reaction
                </label>

                <input
                  id="reaction"
                  name="reaction"
                  value={
                    allergyForm.reaction
                  }
                  onChange={
                    handleAllergyChange
                  }
                  maxLength={255}
                  placeholder="e.g. Rash, swelling, difficulty breathing"
                  className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-red-400 focus:ring-4 focus:ring-red-400/10"
                />

              </div>


              <div>

                <label
                  htmlFor="severity"
                  className="mb-2 block text-sm font-semibold text-slate-700"
                >
                  Severity
                </label>

                <select
                  id="severity"
                  name="severity"
                  value={
                    allergyForm.severity
                  }
                  onChange={
                    handleAllergyChange
                  }
                  className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-red-400 focus:ring-4 focus:ring-red-400/10"
                >

                  {SEVERITIES.map(
                    (severity) => (
                      <option
                        key={
                          severity
                        }
                        value={
                          severity
                        }
                      >
                        {severity}
                      </option>
                    ),
                  )}

                </select>

              </div>


              <div>

                <label
                  htmlFor="notes"
                  className="mb-2 block text-sm font-semibold text-slate-700"
                >
                  Clinical Notes
                </label>

                <textarea
                  id="allergy-notes"
                  name="notes"
                  rows={4}
                  maxLength={2000}
                  value={
                    allergyForm.notes
                  }
                  onChange={
                    handleAllergyChange
                  }
                  placeholder="Additional information about this allergy..."
                  className="w-full resize-none rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-red-400 focus:ring-4 focus:ring-red-400/10"
                />

              </div>


              <div className="flex flex-col-reverse gap-3 border-t border-slate-100 pt-5 sm:flex-row sm:justify-end">

                <button
                  type="button"
                  onClick={
                    closeAllergyModal
                  }
                  disabled={
                    savingAllergy
                  }
                  className="rounded-xl border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                >
                  Cancel
                </button>


                <button
                  type="submit"
                  disabled={
                    savingAllergy
                  }
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-red-600 px-5 py-3 text-sm font-bold text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
                >

                  {savingAllergy && (
                    <LoaderCircle className="h-4 w-4 animate-spin" />
                  )}

                  {savingAllergy
                    ? "Saving..."
                    : editingAllergy
                      ? "Update Allergy"
                      : "Save Allergy"}

                </button>

              </div>

            </form>

          </div>

        </div>

      )}

    </MainLayout>
  )
}