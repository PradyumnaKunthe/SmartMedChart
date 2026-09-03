import {
  Activity,
  AlertTriangle,
  BrainCircuit,
  ClipboardList,
  LoaderCircle,
  RefreshCw,
  ShieldCheck,
  UserRound,
  Users,
} from "lucide-react"

import {
  useEffect,
  useMemo,
  useState,
} from "react"

import {
  useNavigate,
} from "react-router-dom"

import MainLayout from "../../components/layout/MainLayout"

import {
  getDoctorPatients,
} from "../../services/doctor"
import { hideTestPatients } from "../../utils/patientFilter"


// =========================================================
// STAT CARD
// =========================================================

function StatCard({
  title,
  value,
  description,
  icon: Icon,
  iconClasses,
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">

      <div className="flex items-start justify-between gap-3">

        <div className="min-w-0">

          <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 sm:text-sm sm:normal-case sm:tracking-normal sm:text-slate-500">
            {title}
          </p>

          <p className="mt-2 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
            {value}
          </p>

          <p className="mt-2 text-xs leading-5 text-slate-500 sm:text-sm">
            {description}
          </p>

        </div>


        <div
          className={[
            "shrink-0 rounded-xl p-2.5 sm:p-3",
            iconClasses,
          ].join(" ")}
        >
          <Icon className="h-5 w-5" />
        </div>

      </div>

    </div>
  )
}


// =========================================================
// QUICK ACTION
// =========================================================

function QuickAction({
  icon: Icon,
  title,
  description,
  onClick,
  iconClasses,
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group rounded-2xl border border-slate-200 bg-white p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-md sm:p-5"
    >

      <div
        className={[
          "w-fit rounded-xl p-3",
          iconClasses,
        ].join(" ")}
      >
        <Icon className="h-5 w-5" />
      </div>


      <h3 className="mt-4 font-semibold text-slate-900">
        {title}
      </h3>


      <p className="mt-1 text-sm leading-5 text-slate-500">
        {description}
      </p>


      <span className="mt-4 inline-block text-xs font-bold text-slate-400 transition group-hover:text-cyan-600">
        Open →
      </span>

    </button>
  )
}


// =========================================================
// PATIENT CARD
// =========================================================

function PatientCard({
  patient,
  onClick,
}) {
  const first =
    patient.first_name || ""

  const last =
    patient.last_name || ""

  const initials =
    `${first.charAt(0)}${last.charAt(0)}`
      .toUpperCase()


  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full rounded-2xl border border-slate-200 bg-white p-4 text-left shadow-sm transition hover:border-cyan-200 hover:shadow-md sm:p-5"
    >

      <div className="flex items-center gap-3 sm:gap-4">

        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-cyan-50 text-sm font-bold text-cyan-700 sm:h-12 sm:w-12">

          {initials || "P"}

        </div>


        <div className="min-w-0 flex-1">

          <div className="flex items-center gap-2">

            <p className="truncate font-semibold text-slate-900">
              {first} {last}
            </p>

            {patient.is_active && (
              <span className="hidden shrink-0 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700 sm:inline-block">
                ACTIVE
              </span>
            )}

          </div>


          <p className="mt-1 text-sm text-slate-500">
            Patient ID:{" "}
            <span className="font-medium text-slate-700">
              {patient.patient_id}
            </span>
          </p>

        </div>


        <span className="shrink-0 text-sm font-semibold text-cyan-600">
          View
        </span>

      </div>

    </button>
  )
}


// =========================================================
// MAIN DASHBOARD
// =========================================================

export default function DoctorDashboard() {
  const navigate =
    useNavigate()


  const [
    patients,
    setPatients,
  ] = useState([])


  const [
    loading,
    setLoading,
  ] = useState(true)


  const [
    error,
    setError,
  ] = useState("")


  // =======================================================
  // LOAD PATIENTS
  // =======================================================

  async function loadPatients() {
    setLoading(true)
    setError("")

    try {
      const data =
        await getDoctorPatients()

      const visiblePatients = hideTestPatients(
  Array.isArray(data) ? data : [],
)

setPatients(visiblePatients)

    } catch (requestError) {
      setError(
        requestError?.response?.data?.detail ||
          requestError?.message ||
          "Unable to load patients.",
      )

      setPatients([])

    } finally {
      setLoading(false)
    }
  }


  useEffect(() => {
    loadPatients()
  }, [])


  // =======================================================
  // METRICS
  // =======================================================

  const activePatients =
    useMemo(
      () =>
        patients.filter(
          (patient) =>
            patient.is_active,
        ).length,
      [patients],
    )


  const inactivePatients =
    Math.max(
      0,
      patients.length -
        activePatients,
    )


  // =======================================================
  // UI
  // =======================================================

  return (
    <MainLayout title="Doctor Dashboard">

      <div className="space-y-6 sm:space-y-8">

        {/* =================================================
            HERO HEADER
        ================================================= */}

        <section className="overflow-hidden rounded-3xl border border-slate-800 bg-slate-950 p-5 text-white shadow-lg sm:p-6 lg:p-7">

          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">

            <div className="min-w-0">

              <div className="flex items-center gap-3">

                <div className="rounded-xl bg-cyan-500/10 p-3">

                  <Activity className="h-6 w-6 text-cyan-400" />

                </div>


                <div>

                  <p className="text-xs font-bold uppercase tracking-[0.18em] text-cyan-400">
                    Clinical Workspace
                  </p>

                  <h1 className="mt-1 text-2xl font-bold sm:text-3xl">
                    Doctor Dashboard
                  </h1>

                </div>

              </div>


              <p className="mt-4 max-w-2xl text-sm leading-6 text-slate-400">
                Review patient records, manage prescriptions,
                and access medication risk and safety tools.
              </p>

            </div>


            <button
              type="button"
              onClick={
                loadPatients
              }
              disabled={loading}
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-slate-700 bg-slate-900 px-4 py-3 text-sm font-semibold text-slate-200 transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
            >

              <RefreshCw
                className={
                  loading
                    ? "h-4 w-4 animate-spin"
                    : "h-4 w-4"
                }
              />

              Refresh Patients

            </button>

          </div>


          {/* Technical status */}

          <div className="mt-6 grid gap-3 border-t border-slate-800 pt-5 sm:grid-cols-2 lg:grid-cols-3">

            <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-3">

              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                Patient API
              </p>

              <div className="mt-1 flex items-center gap-2">

                <span className="h-2 w-2 rounded-full bg-emerald-400" />

                <span className="text-sm font-semibold text-emerald-400">
                  CONNECTED
                </span>

              </div>

            </div>


            <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-3">

              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                Patient Records
              </p>

              <p className="mt-1 text-sm font-semibold text-white">
                {patients.length} loaded
              </p>

            </div>


            <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-3">

              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                Workspace
              </p>

              <p className="mt-1 text-sm font-semibold text-cyan-400">
                DOCTOR
              </p>

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

              <div>

                <p className="text-sm font-semibold text-red-900">
                  Patient data unavailable
                </p>

                <p className="mt-1 text-sm leading-6 text-red-700">
                  {error}
                </p>

              </div>

            </div>

          </div>
        )}


        {/* =================================================
            PATIENT METRICS
        ================================================= */}

        <section>

          <div className="mb-4">

            <h2 className="text-lg font-semibold text-slate-900 sm:text-xl">
              Patient Overview
            </h2>

            <p className="mt-1 text-sm text-slate-500">
              Current patient records available to the Doctor workspace.
            </p>

          </div>


          <div className="grid grid-cols-2 gap-3 sm:grid-cols-2 sm:gap-4 xl:grid-cols-4">

            <StatCard
              title="Patients"
              value={
                patients.length
              }
              description="Patient records returned by the backend"
              icon={Users}
              iconClasses="bg-cyan-50 text-cyan-600"
            />


            <StatCard
              title="Active"
              value={
                activePatients
              }
              description="Currently active patient records"
              icon={UserRound}
              iconClasses="bg-emerald-50 text-emerald-600"
            />


            <StatCard
              title="Inactive"
              value={
                inactivePatients
              }
              description="Inactive records in the returned set"
              icon={Users}
              iconClasses="bg-slate-100 text-slate-600"
            />


            <StatCard
              title="Clinical Tools"
              value="4"
              description="Patients, prescriptions, AI, and safety"
              icon={ShieldCheck}
              iconClasses="bg-violet-50 text-violet-600"
            />

          </div>

        </section>


        {/* =================================================
            QUICK ACTIONS
        ================================================= */}

        <section>

          <div className="mb-4">

            <h2 className="text-lg font-semibold text-slate-900 sm:text-xl">
              Clinical Shortcuts
            </h2>

            <p className="mt-1 text-sm text-slate-500">
              Open frequently used Doctor workflows.
            </p>

          </div>


          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">

            <QuickAction
              icon={Users}
              title="Patients"
              description="Search and open patient records."
              onClick={() =>
                navigate(
                  "/doctor/patients",
                )
              }
              iconClasses="bg-cyan-50 text-cyan-600"
            />


            <QuickAction
              icon={ClipboardList}
              title="Prescriptions"
              description="Review and manage patient prescriptions."
              onClick={() =>
                navigate(
                  "/doctor/prescriptions",
                )
              }
              iconClasses="bg-indigo-50 text-indigo-600"
            />


            <QuickAction
              icon={BrainCircuit}
              title="AI Risk"
              description="Review medication risk predictions."
              onClick={() =>
                navigate(
                  "/doctor/ai",
                )
              }
              iconClasses="bg-violet-50 text-violet-600"
            />


            <QuickAction
              icon={ShieldCheck}
              title="Safety"
              description="Review medication safety information."
              onClick={() =>
                navigate(
                  "/doctor/prescriptions",
                )
              }
              iconClasses="bg-emerald-50 text-emerald-600"
            />

          </div>

        </section>


        {/* =================================================
            PATIENT LIST
        ================================================= */}

        <section>

          <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">

            <div>

              <h2 className="text-lg font-semibold text-slate-900 sm:text-xl">
                Recent Patients
              </h2>

              <p className="mt-1 text-sm text-slate-500">
                Select a patient to open their clinical profile.
              </p>

            </div>


            <button
              type="button"
              onClick={() =>
                navigate(
                  "/doctor/patients",
                )
              }
              className="w-fit text-sm font-semibold text-cyan-600 hover:text-cyan-700"
            >
              View all patients →
            </button>

          </div>


          {loading ? (

            <div className="rounded-3xl border border-slate-200 bg-white p-10 text-center shadow-sm sm:p-14">

              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-cyan-50">

                <LoaderCircle className="h-7 w-7 animate-spin text-cyan-600" />

              </div>


              <p className="mt-4 text-sm font-semibold text-slate-800">
                Loading patient records...
              </p>


              <p className="mt-1 text-xs text-slate-500">
                Fetching the latest available patients.
              </p>

            </div>

          ) : patients.length === 0 ? (

            <div className="rounded-3xl border border-dashed border-slate-300 bg-white p-10 text-center shadow-sm sm:p-14">

              <Users className="mx-auto h-10 w-10 text-slate-300" />

              <p className="mt-4 font-semibold text-slate-700">
                No patients found
              </p>

              <p className="mt-1 text-sm text-slate-500">
                There are currently no active patients in the returned dataset.
              </p>

              <button
                type="button"
                onClick={
                  loadPatients
                }
                className="mt-5 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800"
              >
                Retry
              </button>

            </div>

          ) : (

            <div className="grid gap-3 lg:grid-cols-2">

              {patients
                .slice(
                  0,
                  6,
                )
                .map(
                  (patient) => (
                    <PatientCard
                      key={
                        patient.id
                      }
                      patient={
                        patient
                      }
                      onClick={() =>
                        navigate(
                          `/doctor/patients/${patient.id}`,
                        )
                      }
                    />
                  ),
                )}

            </div>

          )}

        </section>


        {/* =================================================
            WORKFLOW INFO
        ================================================= */}

        <section className="rounded-3xl border border-slate-200 bg-slate-50 p-5 sm:p-6">

          <div className="flex items-start gap-3">

            <Activity className="mt-0.5 h-5 w-5 shrink-0 text-cyan-600" />

            <div>

              <p className="text-sm font-semibold text-slate-800">
                Doctor clinical workflow
              </p>

              <p className="mt-1 text-sm leading-6 text-slate-500">
                Open a patient to review allergies, current medications,
                prescription history, and prescription management tools.
                Medication schedules can then be selected for AI and safety review.
              </p>

            </div>

          </div>

        </section>

      </div>

    </MainLayout>
  )
}