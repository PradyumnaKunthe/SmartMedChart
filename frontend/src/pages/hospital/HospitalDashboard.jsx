import {
  Activity,
  ArrowLeft,
  CalendarDays,
  LoaderCircle,
  Plus,
  RefreshCw,
  Search,
  UserRound,
  Users,
} from "lucide-react"

import {
  useEffect,
  useState,
} from "react"

import {
  useNavigate,
} from "react-router-dom"

import MainLayout from "../../components/layout/MainLayout"
import api from "../../services/api"


function formatDate(value) {
  if (!value) {
    return "Not available"
  }

  const parsed = new Date(value)

  if (Number.isNaN(parsed.getTime())) {
    return "Not available"
  }

  return new Intl.DateTimeFormat(
    "en-IN",
    {
      day: "2-digit",
      month: "short",
      year: "numeric",
    },
  ).format(parsed)
}


function PatientRow({
  patient,
  onView,
}) {
  const initials =
    `${patient.first_name?.charAt(0) || ""}${patient.last_name?.charAt(0) || ""}`
      .toUpperCase()

  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-cyan-200 hover:shadow-md sm:flex-row sm:items-center sm:justify-between">

      <div className="flex min-w-0 items-center gap-4">

        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-cyan-50 text-sm font-bold text-cyan-700">
          {initials || "P"}
        </div>

        <div className="min-w-0">

          <div className="flex flex-wrap items-center gap-2">

            <p className="truncate font-semibold text-slate-900">
              {patient.first_name}{" "}
              {patient.last_name}
            </p>

            {patient.is_active && (
              <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-bold text-emerald-700">
                ACTIVE
              </span>
            )}

          </div>

          <p className="mt-1 text-sm text-slate-500">
            Patient ID:{" "}
            <span className="font-semibold text-slate-700">
              {patient.patient_id}
            </span>
          </p>

          <p className="mt-1 text-xs text-slate-400">
            DOB:{" "}
            {formatDate(
              patient.date_of_birth,
            )}
          </p>

        </div>

      </div>


      <button
        type="button"
        onClick={() =>
          onView(patient)
        }
        className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-cyan-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-cyan-700"
      >
        View Patient
      </button>

    </div>
  )
}


export default function HospitalDashboard() {

  const navigate =
    useNavigate()

  const [
    patients,
    setPatients,
  ] = useState([])

  const [
    search,
    setSearch,
  ] = useState("")

  const [
    loading,
    setLoading,
  ] = useState(true)

  const [
    error,
    setError,
  ] = useState("")


  async function loadPatients(
    searchValue = "",
  ) {

    setLoading(true)
    setError("")

    try {

      const response =
        await api.get(
          "/api/hospital/patients",
          {
            params: {
              search:
                searchValue.trim() ||
                undefined,

              active_only: false,

              limit: 500,
            },
          },
        )

      const loaded =
        Array.isArray(
          response.data?.patients,
        )
          ? response.data.patients
          : []

      setPatients(
        loaded,
      )

    } catch (requestError) {

      console.error(
        "Load hospital patients error:",
        requestError,
      )

      setError(
        requestError?.response?.data?.detail ||
          "Unable to load hospital patients.",
      )

      setPatients([])

    } finally {

      setLoading(false)

    }
  }


  useEffect(() => {
    loadPatients("")
  }, [])


  function handleSearch(
    event,
  ) {

    event.preventDefault()

    loadPatients(search)

  }


  function handleViewPatient(
    patient,
  ) {

    navigate(
      `/hospital/patients/${patient.id}`,
    )

  }


  const activeCount =
    patients.filter(
      (patient) =>
        patient.is_active,
    ).length

  const inactiveCount =
    patients.filter(
      (patient) =>
        !patient.is_active,
    ).length


  return (
    <MainLayout title="Hospital Dashboard">

      <div className="mx-auto max-w-7xl space-y-6">


        {/* =================================================
            HEADER
        ================================================= */}

        <section className="overflow-hidden rounded-3xl border border-slate-800 bg-slate-950 p-6 text-white shadow-lg">

          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">

            <div>

              <div className="flex items-center gap-3">

                <div className="rounded-2xl bg-cyan-500/10 p-3">

                  <Activity className="h-6 w-6 text-cyan-400" />

                </div>

                <div>

                  <p className="text-xs font-bold uppercase tracking-[0.2em] text-cyan-400">
                    Hospital Data Portal
                  </p>

                  <h1 className="mt-1 text-2xl font-bold sm:text-3xl">
                    Hospital Dashboard
                  </h1>

                </div>

              </div>

              <p className="mt-4 max-w-2xl text-sm leading-6 text-slate-400">
                Register patients, search patient records,
                and open the complete information for the
                specific patient you select.
              </p>

            </div>


            <button
              type="button"
              onClick={() =>
                navigate(
                  "/hospital/patients/new",
                )
              }
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-cyan-600 px-5 py-3 text-sm font-bold text-white transition hover:bg-cyan-700"
            >

              <Plus className="h-4 w-4" />

              Register Patient

            </button>

          </div>

        </section>


        {/* =================================================
            ERROR
        ================================================= */}

        {error && (

          <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">

            {error}

          </div>

        )}


        {/* =================================================
            STATS
        ================================================= */}

        <section className="grid gap-4 sm:grid-cols-3">

          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">

            <div className="flex items-center gap-3">

              <div className="rounded-xl bg-cyan-50 p-3">

                <Users className="h-5 w-5 text-cyan-600" />

              </div>

              <div>

                <p className="text-xs font-bold uppercase tracking-wide text-slate-400">
                  Total Patients
                </p>

                <p className="mt-1 text-2xl font-bold text-slate-900">
                  {patients.length}
                </p>

              </div>

            </div>

          </div>


          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">

            <p className="text-xs font-bold uppercase tracking-wide text-slate-400">
              Active
            </p>

            <p className="mt-1 text-2xl font-bold text-emerald-600">
              {activeCount}
            </p>

          </div>


          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">

            <p className="text-xs font-bold uppercase tracking-wide text-slate-400">
              Inactive / Discharged
            </p>

            <p className="mt-1 text-2xl font-bold text-slate-700">
              {inactiveCount}
            </p>

          </div>

        </section>


        {/* =================================================
            SEARCH
        ================================================= */}

        <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">

          <form
            onSubmit={
              handleSearch
            }
            className="flex flex-col gap-3 md:flex-row"
          >

            <div className="relative flex-1">

              <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />

              <input
                value={search}
                onChange={(
                  event,
                ) =>
                  setSearch(
                    event.target.value,
                  )
                }
                placeholder="Search by patient ID or name..."
                className="w-full rounded-xl border border-slate-200 py-3 pl-12 pr-4 text-sm outline-none focus:border-cyan-400 focus:ring-4 focus:ring-cyan-400/10"
              />

            </div>


            <button
              type="submit"
              className="rounded-xl bg-slate-950 px-6 py-3 text-sm font-bold text-white transition hover:bg-slate-800"
            >
              Search
            </button>


            <button
              type="button"
              onClick={() =>
                loadPatients(search)
              }
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 px-5 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >

              <RefreshCw className="h-4 w-4" />

              Refresh

            </button>

          </form>

        </section>


        {/* =================================================
            PATIENT LIST
        ================================================= */}

        <section>

          <div className="mb-4">

            <p className="text-sm font-semibold text-cyan-600">
              Patient Records
            </p>

            <h2 className="mt-1 text-xl font-bold text-slate-900 sm:text-2xl">
              Registered Patients
            </h2>

            <p className="mt-1 text-sm text-slate-500">
              Click View Patient to open the exact record you selected.
            </p>

          </div>


          {loading ? (

            <div className="rounded-3xl border border-slate-200 bg-white p-12 text-center shadow-sm">

              <LoaderCircle className="mx-auto h-9 w-9 animate-spin text-cyan-600" />

              <p className="mt-4 text-sm font-semibold text-slate-700">
                Loading patients...
              </p>

            </div>

          ) : patients.length === 0 ? (

            <div className="rounded-3xl border border-dashed border-slate-300 bg-white p-12 text-center shadow-sm">

              <UserRound className="mx-auto h-10 w-10 text-slate-300" />

              <p className="mt-4 font-semibold text-slate-700">
                No patients found
              </p>

              <p className="mt-1 text-sm text-slate-500">
                Try another search or register a new patient.
              </p>

            </div>

          ) : (

            <div className="space-y-3">

              {patients.map(
                (patient) => (

                  <PatientRow
                    key={
                      patient.id
                    }
                    patient={
                      patient
                    }
                    onView={
                      handleViewPatient
                    }
                  />

                ),
              )}

            </div>

          )}

        </section>


        {/* =================================================
            BACK
        ================================================= */}

        <button
          type="button"
          onClick={() =>
            navigate("/")
          }
          className="inline-flex items-center gap-2 text-sm font-semibold text-slate-500 hover:text-slate-900"
        >

          <ArrowLeft className="h-4 w-4" />

          Back to Home

        </button>

      </div>

    </MainLayout>
  )
}
