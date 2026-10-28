import {
  ArrowLeft,
  BedDouble,
  CalendarDays,
  CheckCircle2,
  LoaderCircle,
  Stethoscope,
  UserRound,
  Weight,
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
import api from "../../services/api"


// =========================================================
// FORMAT DATE
// =========================================================

function formatDate(value) {
  if (!value) {
    return "Not available"
  }

  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return "Not available"
  }

  return new Intl.DateTimeFormat(
    "en-IN",
    {
      day: "2-digit",
      month: "short",
      year: "numeric",
    },
  ).format(date)
}


// =========================================================
// MAIN
// =========================================================

export default function HospitalPatientProfile() {

  const {
    patientId,
  } = useParams()

  const navigate =
    useNavigate()


  const [
    patient,
    setPatient,
  ] = useState(null)

  const [
    loading,
    setLoading,
  ] = useState(true)

  const [
    error,
    setError,
  ] = useState("")


  // =======================================================
  // LOAD PATIENT
  // =======================================================

  useEffect(() => {

    async function loadPatient() {

      if (!patientId) {
        setError(
          "Patient ID is missing.",
        )

        setLoading(false)

        return
      }

      setLoading(true)
      setError("")

      try {

        const response =
          await api.get(
            `/api/hospital/patients/${patientId}`,
          )

        setPatient(
          response.data,
        )

      } catch (requestError) {

        console.error(
          "Load hospital patient error:",
          requestError,
        )

        setError(
          requestError?.response?.data?.detail ||
            "Unable to load patient information.",
        )

      } finally {

        setLoading(false)

      }
    }

    loadPatient()

  }, [patientId])


  // =======================================================
  // LOADING
  // =======================================================

  if (loading) {

    return (
      <MainLayout title="Patient Profile">

        <div className="flex min-h-[60vh] items-center justify-center">

          <div className="text-center">

            <LoaderCircle className="mx-auto h-10 w-10 animate-spin text-cyan-600" />

            <p className="mt-4 font-semibold text-slate-800">
              Loading patient information...
            </p>

          </div>

        </div>

      </MainLayout>
    )
  }


  // =======================================================
  // ERROR
  // =======================================================

  if (error || !patient) {

    return (
      <MainLayout title="Patient Profile">

        <div className="mx-auto max-w-2xl">

          <button
            type="button"
            onClick={() =>
              navigate(
                "/hospital/dashboard",
              )
            }
            className="mb-5 inline-flex items-center gap-2 text-sm font-semibold text-slate-500 hover:text-slate-900"
          >
            <ArrowLeft className="h-4 w-4" />

            Back to Hospital Dashboard
          </button>


          <div className="rounded-3xl border border-red-200 bg-red-50 p-6">

            <p className="font-semibold text-red-900">
              Patient could not be loaded
            </p>

            <p className="mt-2 text-sm leading-6 text-red-700">
              {error ||
                "Patient record was not found."}
            </p>

          </div>

        </div>

      </MainLayout>
    )
  }


  // =======================================================
  // RENDER
  // =======================================================

  return (
    <MainLayout title="Patient Profile">

      <div className="mx-auto max-w-6xl space-y-6">


        {/* =================================================
            BACK
        ================================================= */}

        <button
          type="button"
          onClick={() =>
            navigate(
              "/hospital/dashboard",
            )
          }
          className="inline-flex items-center gap-2 text-sm font-semibold text-slate-500 hover:text-slate-900"
        >
          <ArrowLeft className="h-4 w-4" />

          Back to Hospital Dashboard
        </button>


        {/* =================================================
            HEADER
        ================================================= */}

        <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">

          <div className="bg-slate-950 p-6 text-white md:p-8">

            <div className="flex flex-col gap-5 md:flex-row md:items-center">

              <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-cyan-500/10">

                <UserRound className="h-8 w-8 text-cyan-400" />

              </div>


              <div className="min-w-0 flex-1">

                <div className="flex flex-wrap items-center gap-3">

                  <h1 className="text-2xl font-bold md:text-3xl">
                    {patient.first_name}{" "}
                    {patient.last_name}
                  </h1>


                  {patient.is_active && (

                    <span className="rounded-full border border-emerald-400/30 bg-emerald-400/10 px-3 py-1 text-xs font-bold text-emerald-300">
                      ACTIVE
                    </span>

                  )}

                </div>


                <p className="mt-2 text-sm text-slate-400">
                  Patient ID:
                  {" "}
                  <span className="font-semibold text-slate-200">
                    {patient.patient_id}
                  </span>
                </p>

              </div>

            </div>

          </div>


          {/* =================================================
              BASIC INFORMATION
          ================================================= */}

          <div className="grid gap-4 p-6 md:grid-cols-2 xl:grid-cols-4">

            <div className="rounded-2xl bg-slate-50 p-4">

              <div className="flex items-center gap-2">

                <CalendarDays className="h-4 w-4 text-cyan-600" />

                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                  Date of Birth
                </p>

              </div>

              <p className="mt-2 font-semibold text-slate-900">
                {formatDate(
                  patient.date_of_birth,
                )}
              </p>

            </div>


            <div className="rounded-2xl bg-slate-50 p-4">

              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                Gender
              </p>

              <p className="mt-2 font-semibold text-slate-900">
                {patient.gender ||
                  "Not available"}
              </p>

            </div>


            <div className="rounded-2xl bg-slate-50 p-4">

              <div className="flex items-center gap-2">

                <Weight className="h-4 w-4 text-cyan-600" />

                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                  Weight
                </p>

              </div>

              <p className="mt-2 font-semibold text-slate-900">
                {patient.weight_kg != null
                  ? `${patient.weight_kg} kg`
                  : "Not available"}
              </p>

            </div>


            <div className="rounded-2xl bg-slate-50 p-4">

              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                Database ID
              </p>

              <p className="mt-2 font-semibold text-slate-900">
                #{patient.id}
              </p>

            </div>

          </div>

        </section>


        {/* =================================================
            HOSPITAL LOCATION
        ================================================= */}

        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">

          <div className="flex items-center gap-3">

            <div className="rounded-xl bg-cyan-50 p-3">

              <BedDouble className="h-5 w-5 text-cyan-600" />

            </div>

            <div>

              <h2 className="text-lg font-bold text-slate-900">
                Hospital Location
              </h2>

              <p className="text-sm text-slate-500">
                Current ward and bed information.
              </p>

            </div>

          </div>


          <div className="mt-5 grid gap-4 md:grid-cols-2">

            <div className="rounded-2xl border border-slate-200 p-4">

              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                Ward ID
              </p>

              <p className="mt-2 text-xl font-bold text-slate-900">
                {patient.ward_id ??
                  "Not assigned"}
              </p>

            </div>


            <div className="rounded-2xl border border-slate-200 p-4">

              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                Bed ID
              </p>

              <p className="mt-2 text-xl font-bold text-slate-900">
                {patient.bed_id ??
                  "Not assigned"}
              </p>

            </div>

          </div>

        </section>


        {/* =================================================
            STATUS
        ================================================= */}

        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">

          <div className="flex items-center gap-3">

            <div className="rounded-xl bg-emerald-50 p-3">

              <CheckCircle2 className="h-5 w-5 text-emerald-600" />

            </div>

            <div>

              <h2 className="text-lg font-bold text-slate-900">
                Patient Status
              </h2>

              <p className="text-sm text-slate-500">
                Current record and QR status.
              </p>

            </div>

          </div>


          <div className="mt-5 grid gap-4 md:grid-cols-2">

            <div className="rounded-2xl bg-slate-50 p-4">

              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                Patient Record
              </p>

              <p className="mt-2 font-bold text-slate-900">
                {patient.is_active
                  ? "Active"
                  : "Discharged"}
              </p>

            </div>


            <div className="rounded-2xl bg-slate-50 p-4">

              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                QR Status
              </p>

              <p className="mt-2 font-bold text-slate-900">
                {patient.qr_is_active
                  ? "Active"
                  : "Inactive"}
              </p>

            </div>

          </div>

        </section>


        {/* =================================================
            DOCTOR
        ================================================= */}

        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">

          <div className="flex items-center gap-3">

            <div className="rounded-xl bg-violet-50 p-3">

              <Stethoscope className="h-5 w-5 text-violet-600" />

            </div>

            <div>

              <h2 className="text-lg font-bold text-slate-900">
                Clinical Assignment
              </h2>

              <p className="text-sm text-slate-500">
                Doctor associated with the current encounter.
              </p>

            </div>

          </div>


          <div className="mt-5 rounded-2xl bg-slate-50 p-4">

            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
              Doctor ID
            </p>

            <p className="mt-2 font-bold text-slate-900">
              {patient.doctor_id ??
                "Not assigned"}
            </p>

          </div>

        </section>

      </div>

    </MainLayout>
  )
}