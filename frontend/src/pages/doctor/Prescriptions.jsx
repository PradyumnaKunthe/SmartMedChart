import {
  AlertTriangle,
  ArrowRight,
  ClipboardList,
  Edit3,
  LoaderCircle,
  Pill,
  Search,
  StopCircle,
} from "lucide-react"

import {
  useEffect,
  useState,
} from "react"

import {
  useNavigate,
} from "react-router-dom"

import MainLayout from "../../components/layout/MainLayout"

import {
  getDoctorPatients,
} from "../../services/doctor"


export default function Prescriptions() {
  const navigate = useNavigate()

  const [
    search,
    setSearch,
  ] = useState("")

  const [
    patients,
    setPatients,
  ] = useState([])

  const [
    loadingPatients,
    setLoadingPatients,
  ] = useState(true)

  const [
    error,
    setError,
  ] = useState("")


  // =====================================================
  // LOAD PATIENTS
  // =====================================================

  async function loadPatients(
    currentSearch = "",
  ) {
    setLoadingPatients(true)
    setError("")

    try {
      const data =
        await getDoctorPatients(
          currentSearch.trim(),
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

      setPatients([])

    } finally {
      setLoadingPatients(false)
    }
  }


  // =====================================================
  // INITIAL LOAD
  // =====================================================

  useEffect(() => {
    loadPatients("")
  }, [])


  // =====================================================
  // SEARCH
  // =====================================================

  function handleSearch(
    event,
  ) {
    event.preventDefault()

    loadPatients(search)
  }


  // =====================================================
  // OPEN PATIENT
  // =====================================================

  function openPatient(
    patientId,
  ) {
    navigate(
      `/doctor/patients/${patientId}`,
    )
  }


  return (
    <MainLayout title="Prescriptions">

      <div className="w-full min-w-0 space-y-6">


        {/* =================================================
            HEADER
        ================================================= */}

        <div className="min-w-0">

          <p className="text-sm font-semibold text-cyan-600">
            Doctor Workspace
          </p>


          <h1 className="mt-1 text-3xl font-bold tracking-tight text-slate-900">
            Prescriptions
          </h1>


          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">
            Select a patient to review their prescriptions,
            medications, and clinical information.
          </p>

        </div>


        {/* =================================================
            SEARCH
        ================================================= */}

        <form
          onSubmit={handleSearch}
          className="w-full rounded-3xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5"
        >

          <div className="flex w-full flex-col gap-3 md:flex-row">

            <div className="relative min-w-0 flex-1">

              <Search className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />

              <input
                type="search"
                value={search}
                onChange={(event) =>
                  setSearch(
                    event.target.value,
                  )
                }
                placeholder="Search patient ID or name..."
                className="w-full rounded-xl border border-slate-200 bg-slate-50 py-3 pl-10 pr-4 text-sm text-slate-800 outline-none transition focus:border-cyan-400 focus:ring-4 focus:ring-cyan-400/10"
              />

            </div>


            <button
              type="submit"
              disabled={loadingPatients}
              className="inline-flex min-w-[110px] items-center justify-center gap-2 rounded-xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
            >

              <Search className="h-4 w-4" />

              Search

            </button>

          </div>

        </form>


        {/* =================================================
            ERROR
        ================================================= */}

        {error && (

          <div className="w-full rounded-2xl border border-red-200 bg-red-50 p-4">

            <div className="flex items-start gap-3">

              <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-red-600" />

              <p className="min-w-0 text-sm leading-6 text-red-700">
                {error}
              </p>

            </div>

          </div>

        )}


        {/* =================================================
            PATIENT LIST
        ================================================= */}

        <section className="w-full min-w-0 overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">

          {/* Section Header */}

          <div className="border-b border-slate-100 p-5 sm:p-6">

            <div className="flex min-w-0 items-center gap-3">

              <div className="shrink-0 rounded-xl bg-cyan-50 p-3">

                <ClipboardList className="h-5 w-5 text-cyan-600" />

              </div>


              <div className="min-w-0">

                <h2 className="font-semibold text-slate-900">
                  Select Patient
                </h2>

                <p className="mt-1 text-sm text-slate-500">
                  Choose a patient to open their clinical profile.
                </p>

              </div>

            </div>

          </div>


          {/* Patient Content */}

          <div className="p-4 sm:p-6">

            {loadingPatients ? (

              <div className="py-12 text-center">

                <LoaderCircle className="mx-auto h-8 w-8 animate-spin text-cyan-500" />

                <p className="mt-3 text-sm text-slate-500">
                  Loading patients...
                </p>

              </div>

            ) : patients.length === 0 ? (

              <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-8 text-center">

                <Pill className="mx-auto h-9 w-9 text-slate-300" />

                <p className="mt-3 font-semibold text-slate-700">
                  No patients found
                </p>

                <p className="mt-1 text-sm text-slate-500">
                  Try searching using another patient ID or name.
                </p>

              </div>

            ) : (

              <div className="grid min-w-0 gap-3">

                {patients.map(
                  (patient) => (

                    <div
                      key={patient.id}
                      className="group w-full min-w-0 rounded-2xl border border-slate-200 bg-white p-4 transition hover:border-cyan-200 hover:bg-slate-50 hover:shadow-sm sm:p-5"
                    >

                      <div className="flex min-w-0 flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">


                        {/* Patient Information */}

                        <div className="flex min-w-0 items-center gap-4">

                          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-sm font-bold text-slate-700">

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


                            <p className="mt-1 break-all text-sm text-slate-500">
                              Patient ID:{" "}
                              {patient.patient_id}
                            </p>


                            <p className="mt-1 text-xs text-slate-400">
                              Record ID: #{patient.id}
                            </p>

                          </div>

                        </div>


                        {/* Action */}

                        <button
                          type="button"
                          onClick={() =>
                            openPatient(
                              patient.id,
                            )
                          }
                          className="inline-flex w-full shrink-0 items-center justify-center gap-2 rounded-xl bg-cyan-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-cyan-700 sm:w-auto"
                        >

                          View Prescriptions

                          <ArrowRight className="h-4 w-4" />

                        </button>

                      </div>

                    </div>

                  ),
                )}

              </div>

            )}

          </div>

        </section>


        {/* =================================================
            INFORMATION
        ================================================= */}

        <section className="w-full rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">

          <div className="flex items-start gap-3">

            <div className="rounded-xl bg-indigo-50 p-3">

              <ClipboardList className="h-5 w-5 text-indigo-600" />

            </div>


            <div className="min-w-0">

              <p className="text-sm font-semibold text-slate-800">
                Prescription Management
              </p>


              <p className="mt-1 text-sm leading-6 text-slate-500">
                Select a patient to view their current medications,
                prescription history, and available prescription
                management actions.
              </p>

            </div>

          </div>

        </section>


      </div>

    </MainLayout>
  )
}