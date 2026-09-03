import {
  ArrowLeft,
  CalendarDays,
  CheckCircle2,
  ClipboardEdit,
  LoaderCircle,
  Pill,
  Save,
} from "lucide-react"

import {
  useEffect,
  useState,
} from "react"

import {
  useNavigate,
  useParams,
  useSearchParams,
} from "react-router-dom"

import MainLayout from "../../components/layout/MainLayout"

import {
  getDoctorMedicines,
  getPrescriptionHistory,
  updatePrescription,
} from "../../services/doctor"


const FREQUENCIES = [
  "ONCE_DAILY",
  "TWICE_DAILY",
  "EVERY_8_HOURS",
  "EVERY_6_HOURS",
]


export default function EditPrescription() {
  const {
    prescriptionId,
  } = useParams()

  const [
    searchParams,
  ] = useSearchParams()

  const patientId =
    searchParams.get("patient")


  const navigate =
    useNavigate()


  const [
    prescription,
    setPrescription,
  ] = useState(null)

  const [
    medicines,
    setMedicines,
  ] = useState([])

  const [
    form,
    setForm,
  ] = useState({
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

  const [
    loading,
    setLoading,
  ] = useState(true)

  const [
    submitting,
    setSubmitting,
  ] = useState(false)

  const [
    error,
    setError,
  ] = useState("")

  const [
    success,
    setSuccess,
  ] = useState(null)


  // ====================================================
  // LOAD PRESCRIPTION
  // ====================================================

  useEffect(() => {
    async function loadData() {
      if (!patientId) {
        setError(
          "No patient was provided for this prescription.",
        )

        setLoading(false)
        return
      }

      setLoading(true)
      setError("")

      try {
        const [
          medicineData,
          historyData,
        ] = await Promise.all([
          getDoctorMedicines(),
          getPrescriptionHistory(
            patientId,
          ),
        ])


        const medicineList =
          Array.isArray(
            medicineData,
          )
            ? medicineData
            : []


        setMedicines(
          medicineList,
        )


        const prescriptionList =
          Array.isArray(
            historyData,
          )
            ? historyData
            : []


        const currentPrescription =
          prescriptionList.find(
            (item) =>
              String(
                item.prescription_id,
              ) ===
              String(
                prescriptionId,
              ),
          )


        if (!currentPrescription) {
          throw new Error(
            "Prescription not found.",
          )
        }


        if (
          currentPrescription
            .prescription_status !==
          "ACTIVE"
        ) {
          throw new Error(
            "Only active prescriptions can be edited.",
          )
        }


        setPrescription(
          currentPrescription,
        )


        setForm({
          medicine_id:
            String(
              currentPrescription.medicine_id,
            ),

          dose:
            currentPrescription.dose ||
            "",

          route:
            currentPrescription.route ||
            "",

          frequency:
            currentPrescription.frequency ||
            "ONCE_DAILY",

          duration_days:
            currentPrescription.duration_days ||
            1,

          start_date:
            currentPrescription.start_date ||
            "",

          start_time:
            currentPrescription.start_time
              ? currentPrescription.start_time.slice(
                  0,
                  5,
                )
              : "",

          is_stat:
            Boolean(
              currentPrescription.is_stat,
            ),

          instructions:
            currentPrescription.instructions ||
            "",

          notes:
            currentPrescription.prescription_notes ||
            "",
        })

      } catch (requestError) {
        setError(
          requestError?.response?.data?.detail ||
            requestError?.message ||
            "Unable to load prescription.",
        )
      } finally {
        setLoading(false)
      }
    }


    loadData()
  }, [
    patientId,
    prescriptionId,
  ])


  // ====================================================
  // FORM CHANGE
  // ====================================================

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


  // ====================================================
  // SUBMIT
  // ====================================================

  async function handleSubmit(
    event,
  ) {
    event.preventDefault()

    setSubmitting(true)
    setError("")
    setSuccess(null)

    try {
      const payload = {
        medicine_id:
          Number(
            form.medicine_id,
          ),

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
          Boolean(
            form.is_stat,
          ),

        instructions:
          form.instructions.trim() ||
          null,

        notes:
          form.notes.trim() ||
          null,
      }


      const result =
        await updatePrescription(
          Number(
            prescriptionId,
          ),
          payload,
        )


      setSuccess(
        result,
      )

    } catch (requestError) {
      setError(
        requestError?.response?.data?.detail ||
          "Unable to update prescription.",
      )
    } finally {
      setSubmitting(false)
    }
  }


  // ====================================================
  // LOADING
  // ====================================================

  if (loading) {
    return (
      <MainLayout title="Edit Prescription">

        <div className="flex min-h-[60vh] items-center justify-center">

          <div className="text-center">

            <LoaderCircle className="mx-auto h-9 w-9 animate-spin text-cyan-500" />

            <p className="mt-4 text-sm text-slate-500">
              Loading prescription...
            </p>

          </div>

        </div>

      </MainLayout>
    )
  }


  // ====================================================
  // ERROR
  // ====================================================

  if (error && !prescription) {
    return (
      <MainLayout title="Edit Prescription">

        <div className="mx-auto max-w-2xl">

          <button
            type="button"
            onClick={() =>
              navigate(
                patientId
                  ? `/doctor/patients/${patientId}`
                  : "/doctor/patients",
              )
            }
            className="mb-5 inline-flex items-center gap-2 text-sm font-semibold text-slate-600 hover:text-slate-900"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to patient
          </button>


          <div className="rounded-2xl border border-red-200 bg-red-50 p-6">

            <h2 className="font-semibold text-red-900">
              Unable to edit prescription
            </h2>

            <p className="mt-2 text-sm leading-6 text-red-700">
              {error}
            </p>

          </div>

        </div>

      </MainLayout>
    )
  }


  return (
    <MainLayout title="Edit Prescription">

      <div className="mx-auto max-w-4xl space-y-6">

        {/* Back */}

        <button
          type="button"
          onClick={() =>
            navigate(
              `/doctor/patients/${patientId}`,
            )
          }
          className="inline-flex items-center gap-2 text-sm font-semibold text-slate-600 hover:text-slate-900"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to patient
        </button>


        {/* Header */}

        <div>

          <div className="flex items-center gap-3">

            <div className="rounded-xl bg-indigo-50 p-3">
              <ClipboardEdit className="h-6 w-6 text-indigo-600" />
            </div>

            <div>

              <p className="text-sm font-semibold text-indigo-600">
                Doctor Workspace
              </p>

              <h1 className="text-3xl font-bold tracking-tight text-slate-900">
                Edit Prescription
              </h1>

            </div>

          </div>


          {prescription && (
            <p className="mt-3 text-sm text-slate-500">
              Prescription #
              {prescription.prescription_id}
              {" · "}
              {prescription.medicine_name}
            </p>
          )}

        </div>


        {/* Error */}

        {error && (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm leading-6 text-red-700">
            {error}
          </div>
        )}


        {/* Success */}

        {success && (
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5">

            <div className="flex items-start gap-3">

              <div className="rounded-xl bg-emerald-100 p-3">
                <CheckCircle2 className="h-5 w-5 text-emerald-600" />
              </div>

              <div>

                <p className="font-semibold text-emerald-900">
                  Prescription updated successfully
                </p>

                <p className="mt-1 text-sm leading-6 text-emerald-700">
                  The prescription was updated and
                  medication schedules were regenerated
                  where appropriate.
                </p>

              </div>

            </div>


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
        )}


        {/* Form */}

        {!success && (
          <form
            onSubmit={handleSubmit}
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
                          key={medicine.id}
                          value={medicine.id}
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


              {/* Dose / Route */}

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
                    value={form.dose}
                    onChange={
                      handleChange
                    }
                    required
                    maxLength={100}
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
                    value={form.route}
                    onChange={
                      handleChange
                    }
                    required
                    maxLength={50}
                    className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-800 outline-none focus:border-cyan-400 focus:ring-4 focus:ring-cyan-400/10"
                  />

                </div>

              </div>


              {/* Frequency / Duration */}

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
                          key={frequency}
                          value={frequency}
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


              {/* Start date / time */}

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

              <label className="flex cursor-pointer gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4">

                <input
                  type="checkbox"
                  name="is_stat"
                  checked={
                    form.is_stat
                  }
                  onChange={
                    handleChange
                  }
                  className="mt-1 h-4 w-4"
                />

                <span>

                  <span className="block text-sm font-semibold text-slate-800">
                    STAT medication
                  </span>

                  <span className="mt-1 block text-xs text-slate-500">
                    Mark as urgent/immediate medication.
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
                  className="w-full resize-none rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-800 outline-none focus:border-cyan-400 focus:ring-4 focus:ring-cyan-400/10"
                />

              </div>


              {/* Buttons */}

              <div className="flex flex-col-reverse gap-3 border-t border-slate-100 pt-6 sm:flex-row sm:justify-end">

                <button
                  type="button"
                  onClick={() =>
                    navigate(
                      `/doctor/patients/${patientId}`,
                    )
                  }
                  disabled={submitting}
                  className="rounded-xl border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                >
                  Cancel
                </button>


                <button
                  type="submit"
                  disabled={submitting}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-cyan-600 px-5 py-3 text-sm font-semibold text-white hover:bg-cyan-700 disabled:cursor-not-allowed disabled:opacity-50"
                >

                  {submitting ? (
                    <LoaderCircle className="h-5 w-5 animate-spin" />
                  ) : (
                    <Save className="h-5 w-5" />
                  )}

                  {submitting
                    ? "Saving..."
                    : "Save Changes"}

                </button>

              </div>

            </div>

          </form>
        )}

      </div>

    </MainLayout>
  )
}