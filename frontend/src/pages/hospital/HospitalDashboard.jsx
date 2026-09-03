import {
  Activity,
  Bed,
  ClipboardPlus,
  Database,
  HeartPulse,
  RefreshCw,
  Search,
  ShieldCheck,
  UserPlus,
  Users,
} from "lucide-react"

import { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"

import MainLayout from "../../components/layout/MainLayout"
import api from "../../services/api"


export default function HospitalDashboard() {
  const navigate = useNavigate()

  const [dashboard, setDashboard] = useState(null)
  const [patients, setPatients] = useState([])
  const [search, setSearch] = useState("")

  const [loading, setLoading] = useState(true)
  const [searching, setSearching] = useState(false)
  const [error, setError] = useState("")


  // =======================================================
  // Load dashboard + patients
  // =======================================================

  async function loadHospitalData(searchValue = "") {
    try {
      setError("")

      if (searchValue) {
        setSearching(true)
      } else {
        setLoading(true)
      }

      const [
        dashboardResponse,
        patientsResponse,
      ] = await Promise.all([
        api.get("/api/hospital/dashboard"),
        api.get("/api/hospital/patients", {
          params: {
            search: searchValue || undefined,
            active_only: false,
            limit: 100,
          },
        }),
      ])

      setDashboard(
        dashboardResponse.data
      )

      setPatients(
        patientsResponse.data?.patients || []
      )
    } catch (requestError) {
      console.error(
        "Hospital dashboard error:",
        requestError
      )

      setError(
        requestError?.response?.data?.detail ||
          "Unable to load hospital data."
      )
    } finally {
      setLoading(false)
      setSearching(false)
    }
  }


  // =======================================================
  // Initial load
  // =======================================================

  useEffect(() => {
    loadHospitalData("")
  }, [])


  // =======================================================
  // Search
  // =======================================================

  async function handleSearch(event) {
    event.preventDefault()

    await loadHospitalData(
      search.trim()
    )
  }


  // =======================================================
  // Clear search
  // =======================================================

  async function handleClearSearch() {
    setSearch("")
    await loadHospitalData("")
  }


  // =======================================================
  // Refresh
  // =======================================================

  async function handleRefresh() {
    await loadHospitalData(
      search.trim()
    )
  }


  return (
    <MainLayout title="Hospital Portal">

      <div className="mx-auto max-w-7xl space-y-6">

        {/* =================================================
            Header
        ================================================= */}

        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">

          <div>

            <p className="text-sm font-semibold text-cyan-600">
              Hospital Data Portal
            </p>

            <h1 className="mt-1 text-3xl font-bold tracking-tight text-slate-900">
              Hospital Dashboard
            </h1>

            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">
              Manage hospital patient records and make
              clinical data available to the Doctor,
              Nurse, and Admin workspaces through the
              shared SmartMedChart database.
            </p>

          </div>


          <div className="flex flex-wrap gap-2">

            <button
              type="button"
              onClick={handleRefresh}
              disabled={loading || searching}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-slate-300 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <RefreshCw
                className={`h-4 w-4 ${
                  loading || searching
                    ? "animate-spin"
                    : ""
                }`}
              />

              Refresh
            </button>


            <button
              type="button"
              onClick={() =>
                navigate(
                  "/hospital/patients/new"
                )
              }
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-cyan-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-cyan-700"
            >
              <UserPlus className="h-4 w-4" />
              Add Patient
            </button>

          </div>

        </div>


        {/* =================================================
            Error
        ================================================= */}

        {error && (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-4">

            <div className="flex items-start gap-3">

              <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-red-600" />

              <div>

                <p className="font-semibold text-red-800">
                  Hospital data error
                </p>

                <p className="mt-1 text-sm text-red-700">
                  {error}
                </p>

              </div>

            </div>

          </div>
        )}


        {/* =================================================
            KPI Cards
        ================================================= */}

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">

          {/* Total */}

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">

            <div className="flex items-start justify-between">

              <div>

                <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                  Total Patients
                </p>

                <p className="mt-2 text-3xl font-bold text-slate-900">
                  {dashboard?.patients?.total ?? 0}
                </p>

              </div>

              <div className="rounded-xl bg-cyan-50 p-3">
                <Users className="h-5 w-5 text-cyan-600" />
              </div>

            </div>

            <p className="mt-3 text-xs text-slate-500">
              All patient records in the database
            </p>

          </div>


          {/* Active */}

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">

            <div className="flex items-start justify-between">

              <div>

                <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                  Active Patients
                </p>

                <p className="mt-2 text-3xl font-bold text-slate-900">
                  {dashboard?.patients?.active ?? 0}
                </p>

              </div>

              <div className="rounded-xl bg-emerald-50 p-3">
                <Activity className="h-5 w-5 text-emerald-600" />
              </div>

            </div>

            <p className="mt-3 text-xs text-slate-500">
              Currently active hospital records
            </p>

          </div>


          {/* Inactive */}

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">

            <div className="flex items-start justify-between">

              <div>

                <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                  Inactive Patients
                </p>

                <p className="mt-2 text-3xl font-bold text-slate-900">
                  {dashboard?.patients?.inactive ?? 0}
                </p>

              </div>

              <div className="rounded-xl bg-slate-100 p-3">
                <Database className="h-5 w-5 text-slate-600" />
              </div>

            </div>

            <p className="mt-3 text-xs text-slate-500">
              Inactive or archived records
            </p>

          </div>


          {/* Portal status */}

          <div className="rounded-2xl border border-slate-200 bg-slate-950 p-5 shadow-sm">

            <div className="flex items-start justify-between">

              <div>

                <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                  Portal Status
                </p>

                <p className="mt-2 text-2xl font-bold text-white">
                  {dashboard?.hospital?.status || "ACTIVE"}
                </p>

              </div>

              <div className="rounded-xl bg-emerald-400/10 p-3">
                <HeartPulse className="h-5 w-5 text-emerald-400" />
              </div>

            </div>

            <p className="mt-3 text-xs text-slate-400">
              Shared clinical database connected
            </p>

          </div>

        </div>


        {/* =================================================
            Quick actions
        ================================================= */}

        <div className="grid gap-4 md:grid-cols-3">

          <button
            type="button"
            onClick={() =>
              navigate(
                "/hospital/patients/new"
              )
            }
            className="group rounded-2xl border border-slate-200 bg-white p-5 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-cyan-300 hover:shadow-md"
          >

            <div className="flex items-center gap-4">

              <div className="rounded-xl bg-cyan-50 p-3">
                <UserPlus className="h-5 w-5 text-cyan-600" />
              </div>

              <div>

                <p className="font-semibold text-slate-900">
                  Register Patient
                </p>

                <p className="mt-1 text-sm text-slate-500">
                  Create a new patient record
                </p>

              </div>

            </div>

          </button>


          <button
            type="button"
            onClick={() =>
              document
                .getElementById(
                  "hospital-patient-list"
                )
                ?.scrollIntoView({
                  behavior: "smooth",
                })
            }
            className="group rounded-2xl border border-slate-200 bg-white p-5 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-cyan-300 hover:shadow-md"
          >

            <div className="flex items-center gap-4">

              <div className="rounded-xl bg-indigo-50 p-3">
                <Search className="h-5 w-5 text-indigo-600" />
              </div>

              <div>

                <p className="font-semibold text-slate-900">
                  Search Patients
                </p>

                <p className="mt-1 text-sm text-slate-500">
                  Find an existing hospital record
                </p>

              </div>

            </div>

          </button>


          <button
            type="button"
            onClick={() =>
              document
                .getElementById(
                  "hospital-patient-list"
                )
                ?.scrollIntoView({
                  behavior: "smooth",
                })
            }
            className="group rounded-2xl border border-slate-200 bg-white p-5 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-cyan-300 hover:shadow-md"
          >

            <div className="flex items-center gap-4">

              <div className="rounded-xl bg-amber-50 p-3">
                <ClipboardPlus className="h-5 w-5 text-amber-600" />
              </div>

              <div>

                <p className="font-semibold text-slate-900">
                  Clinical Records
                </p>

                <p className="mt-1 text-sm text-slate-500">
                  Manage shared patient information
                </p>

              </div>

            </div>

          </button>

        </div>


        {/* =================================================
            Patient List
        ================================================= */}

        <section
          id="hospital-patient-list"
          className="rounded-3xl border border-slate-200 bg-white shadow-sm"
        >

          <div className="border-b border-slate-200 p-5 md:p-6">

            <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">

              <div>

                <p className="text-sm font-semibold text-cyan-600">
                  Shared Patient Database
                </p>

                <h2 className="mt-1 text-xl font-bold text-slate-900">
                  Hospital Patients
                </h2>

                <p className="mt-1 text-sm text-slate-500">
                  These records are shared with authorized
                  SmartMedChart clinical interfaces.
                </p>

              </div>


              {/* Search */}

              <form
                onSubmit={handleSearch}
                className="flex w-full flex-col gap-2 sm:flex-row lg:max-w-xl"
              >

                <div className="relative flex-1">

                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />

                  <input
                    value={search}
                    onChange={(event) =>
                      setSearch(
                        event.target.value
                      )
                    }
                    placeholder="Search Patient ID, first name, or last name"
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-10 pr-4 text-sm outline-none transition focus:border-cyan-400 focus:bg-white focus:ring-2 focus:ring-cyan-100"
                  />

                </div>


                <button
                  type="submit"
                  disabled={searching}
                  className="rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:opacity-60"
                >
                  {searching
                    ? "Searching..."
                    : "Search"}
                </button>


                {search && (
                  <button
                    type="button"
                    onClick={handleClearSearch}
                    className="rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-sm font-semibold text-slate-600 transition hover:bg-slate-50"
                  >
                    Clear
                  </button>
                )}

              </form>

            </div>

          </div>


          {/* =================================================
              Loading
          ================================================= */}

          {loading && (
            <div className="p-10 text-center">

              <RefreshCw className="mx-auto h-7 w-7 animate-spin text-cyan-600" />

              <p className="mt-3 text-sm font-medium text-slate-600">
                Loading hospital patients...
              </p>

            </div>
          )}


          {/* =================================================
              Empty
          ================================================= */}

          {!loading && patients.length === 0 && (

            <div className="p-10 text-center">

              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100">

                <Users className="h-7 w-7 text-slate-400" />

              </div>

              <p className="mt-4 font-semibold text-slate-900">
                No patients found
              </p>

              <p className="mx-auto mt-1 max-w-md text-sm text-slate-500">
                {search
                  ? "No patient matched your search."
                  : "There are currently no patient records in the hospital database."}
              </p>

              {!search && (
                <button
                  type="button"
                  onClick={() =>
                    navigate(
                      "/hospital/patients/new"
                    )
                  }
                  className="mt-5 inline-flex items-center gap-2 rounded-xl bg-cyan-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-cyan-700"
                >
                  <UserPlus className="h-4 w-4" />
                  Register First Patient
                </button>
              )}

            </div>

          )}


          {/* =================================================
              Desktop / mobile patient list
          ================================================= */}

          {!loading && patients.length > 0 && (

            <div className="p-4 md:p-6">

              {/* Mobile cards */}

              <div className="space-y-3 md:hidden">

                {patients.map((patient) => (

                  <div
                    key={patient.id}
                    className="rounded-2xl border border-slate-200 bg-slate-50 p-4"
                  >

                    <div className="flex items-start justify-between gap-3">

                      <div>

                        <p className="font-semibold text-slate-900">
                          {patient.first_name}{" "}
                          {patient.last_name}
                        </p>

                        <p className="mt-1 text-xs font-medium text-cyan-700">
                          {patient.patient_id}
                        </p>

                      </div>

                      <span
                        className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                          patient.is_active
                            ? "bg-emerald-100 text-emerald-700"
                            : "bg-slate-200 text-slate-600"
                        }`}
                      >
                        {patient.is_active
                          ? "Active"
                          : "Inactive"}
                      </span>

                    </div>


                    <div className="mt-4 grid grid-cols-2 gap-3 text-sm">

                      <div>

                        <p className="text-xs text-slate-400">
                          Gender
                        </p>

                        <p className="mt-1 font-medium text-slate-700">
                          {patient.gender || "—"}
                        </p>

                      </div>


                      <div>

                        <p className="text-xs text-slate-400">
                          Weight
                        </p>

                        <p className="mt-1 font-medium text-slate-700">
                          {patient.weight_kg
                            ? `${patient.weight_kg} kg`
                            : "—"}
                        </p>

                      </div>


                      <div>

                        <p className="text-xs text-slate-400">
                          Ward
                        </p>

                        <p className="mt-1 font-medium text-slate-700">
                          {patient.ward_id || "—"}
                        </p>

                      </div>


                      <div>

                        <p className="text-xs text-slate-400">
                          Bed
                        </p>

                        <p className="mt-1 font-medium text-slate-700">
                          {patient.bed_id || "—"}
                        </p>

                      </div>

                    </div>


                    <div className="mt-4 flex gap-2">

                      <button
                        type="button"
                        onClick={() =>
                          navigate(
                            `/hospital/patients/${patient.id}`
                          )
                        }
                        className="flex-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                      >
                        View
                      </button>

                    </div>

                  </div>

                ))}

              </div>


              {/* Desktop table */}

              <div className="hidden overflow-x-auto md:block">

                <table className="w-full min-w-[850px] text-left">

                  <thead>

                    <tr className="border-b border-slate-200">

                      <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-slate-400">
                        Patient
                      </th>

                      <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-slate-400">
                        Patient ID
                      </th>

                      <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-slate-400">
                        Gender
                      </th>

                      <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-slate-400">
                        Weight
                      </th>

                      <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-slate-400">
                        Ward / Bed
                      </th>

                      <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-slate-400">
                        Status
                      </th>

                      <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-slate-400">
                        Action
                      </th>

                    </tr>

                  </thead>


                  <tbody className="divide-y divide-slate-100">

                    {patients.map((patient) => (

                      <tr
                        key={patient.id}
                        className="transition hover:bg-slate-50"
                      >

                        <td className="px-4 py-4">

                          <p className="font-semibold text-slate-900">
                            {patient.first_name}{" "}
                            {patient.last_name}
                          </p>

                        </td>


                        <td className="px-4 py-4">

                          <span className="rounded-lg bg-cyan-50 px-2.5 py-1 text-xs font-semibold text-cyan-700">
                            {patient.patient_id}
                          </span>

                        </td>


                        <td className="px-4 py-4 text-sm text-slate-600">
                          {patient.gender || "—"}
                        </td>


                        <td className="px-4 py-4 text-sm text-slate-600">
                          {patient.weight_kg
                            ? `${patient.weight_kg} kg`
                            : "—"}
                        </td>


                        <td className="px-4 py-4">

                          <div className="flex items-center gap-2 text-sm text-slate-600">

                            <Bed className="h-4 w-4 text-slate-400" />

                            <span>
                              {patient.ward_id || "—"}
                              {" / "}
                              {patient.bed_id || "—"}
                            </span>

                          </div>

                        </td>


                        <td className="px-4 py-4">

                          <span
                            className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                              patient.is_active
                                ? "bg-emerald-100 text-emerald-700"
                                : "bg-slate-100 text-slate-600"
                            }`}
                          >
                            {patient.is_active
                              ? "Active"
                              : "Inactive"}
                          </span>

                        </td>


                        <td className="px-4 py-4 text-right">

                          <button
                            type="button"
                            onClick={() =>
                              navigate(
                                `/hospital/patients/${patient.id}`
                              )
                            }
                            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                          >
                            View
                          </button>

                        </td>

                      </tr>

                    ))}

                  </tbody>

                </table>

              </div>

            </div>

          )}

        </section>


        {/* =================================================
            System Information
        ================================================= */}

        <div className="rounded-2xl border border-cyan-100 bg-cyan-50 p-5">

          <div className="flex items-start gap-3">

            <Database className="mt-0.5 h-5 w-5 text-cyan-700" />

            <div>

              <p className="font-semibold text-cyan-900">
                Shared clinical data architecture
              </p>

              <p className="mt-1 text-sm leading-6 text-cyan-800">
                Patient information entered through the
                Hospital Portal is stored in the same
                SmartMedChart database used by the authorized
                Doctor, Nurse, and Admin interfaces.
              </p>

            </div>

          </div>

        </div>

      </div>

    </MainLayout>
  )
}