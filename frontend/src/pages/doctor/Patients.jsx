import {
  useEffect,
  useState,
} from "react"

import {
  ArrowRight,
  LoaderCircle,
  RefreshCw,
  Search,
  Users,
} from "lucide-react"

import {
  useNavigate,
} from "react-router-dom"

import MainLayout from "../../components/layout/MainLayout"

import {
  getDoctorPatients,
} from "../../services/doctor"


export default function Patients() {
  const navigate = useNavigate()

  const [search, setSearch] =
    useState("")

  const [patients, setPatients] =
    useState([])

  const [loading, setLoading] =
    useState(true)

  const [error, setError] =
    useState("")


  async function loadPatients(
    currentSearch = search,
  ) {
    setLoading(true)
    setError("")

    try {
      const data =
        await getDoctorPatients(
          currentSearch,
        )

      setPatients(
        Array.isArray(data)
          ? data
          : [],
      )
    } catch (requestError) {
      setError(
        requestError?.response?.data?.detail ||
          "Unable to load patients.",
      )
    } finally {
      setLoading(false)
    }
  }


  useEffect(() => {
    loadPatients("")
  }, [])


  function handleSubmit(event) {
    event.preventDefault()

    loadPatients(search)
  }


  return (
    <MainLayout title="Patients">

      <div className="space-y-6">

        {/* Header */}

        <div>

          <p className="text-sm font-semibold text-cyan-600">
            Doctor Workspace
          </p>

          <h1 className="mt-1 text-3xl font-bold tracking-tight text-slate-900">
            Patients
          </h1>

          <p className="mt-2 text-sm leading-6 text-slate-500">
            Search active patients by patient ID,
            first name, or last name.
          </p>

        </div>


        {/* Search */}

        <form
          onSubmit={handleSubmit}
          className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
        >

          <div className="flex flex-col gap-3 sm:flex-row">

            <div className="relative flex-1">

              <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />

              <input
                type="search"
                value={search}
                onChange={(event) =>
                  setSearch(
                    event.target.value,
                  )
                }
                placeholder="Search patient ID or name..."
                className="w-full rounded-xl border border-slate-200 bg-slate-50 py-3 pl-10 pr-4 text-sm outline-none focus:border-cyan-400 focus:ring-4 focus:ring-cyan-400/10"
              />

            </div>


            <button
              type="submit"
              disabled={loading}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
            >
              <Search className="h-4 w-4" />
              Search
            </button>


            <button
              type="button"
              onClick={() =>
                loadPatients(search)
              }
              disabled={loading}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            >
              <RefreshCw
                className={
                  loading
                    ? "h-4 w-4 animate-spin"
                    : "h-4 w-4"
                }
              />
            </button>

          </div>

        </form>


        {/* Error */}

        {error && (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {error}
          </div>
        )}


        {/* Count */}

        <div className="flex items-center justify-between">

          <div>

            <h2 className="font-semibold text-slate-900">
              Patient List
            </h2>

            <p className="text-sm text-slate-500">
              {patients.length} patient
              {patients.length === 1
                ? ""
                : "s"} found
            </p>

          </div>

        </div>


        {/* Patients */}

        {loading ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center">

            <LoaderCircle className="mx-auto h-8 w-8 animate-spin text-cyan-500" />

            <p className="mt-3 text-sm text-slate-500">
              Loading patients...
            </p>

          </div>
        ) : patients.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center">

            <Users className="mx-auto h-10 w-10 text-slate-300" />

            <p className="mt-4 font-semibold text-slate-700">
              No patients found
            </p>

            <p className="mt-1 text-sm text-slate-500">
              Try another patient ID or name.
            </p>

          </div>
        ) : (
          <div className="grid gap-3">

            {patients.map(
              (patient) => (
                <button
                  key={patient.id}
                  type="button"
                  onClick={() =>
                    navigate(
                      `/doctor/patients/${patient.id}`,
                    )
                  }
                  className="group flex w-full items-center justify-between rounded-2xl border border-slate-200 bg-white p-5 text-left shadow-sm transition hover:border-cyan-200 hover:shadow-md"
                >

                  <div className="flex min-w-0 items-center gap-4">

                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-cyan-50 text-sm font-bold text-cyan-700">
                      {patient.first_name
                        ?.charAt(0)
                        .toUpperCase()}
                      {patient.last_name
                        ?.charAt(0)
                        .toUpperCase()}
                    </div>


                    <div className="min-w-0">

                      <p className="truncate font-semibold text-slate-900">
                        {patient.first_name}{" "}
                        {patient.last_name}
                      </p>

                      <p className="mt-1 text-sm text-slate-500">
                        Patient ID:{" "}
                        {patient.patient_id}
                      </p>

                      <p className="mt-1 text-xs text-slate-400">
                        Database ID: {patient.id}
                      </p>

                    </div>

                  </div>


                  <ArrowRight className="h-5 w-5 shrink-0 text-slate-300 transition group-hover:translate-x-1 group-hover:text-cyan-500" />

                </button>
              ),
            )}

          </div>
        )}

      </div>

    </MainLayout>
  )
}