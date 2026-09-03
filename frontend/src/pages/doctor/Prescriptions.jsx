import {
  AlertTriangle,
  ArrowRight,
  BrainCircuit,
  CalendarDays,
  ClipboardList,
  Edit3,
  LoaderCircle,
  Pill,
  Search,
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
  getPrescriptionHistory,
  getPatientMedicationSchedules,
} from "../../services/doctor"


export default function Prescriptions() {
  const navigate =
    useNavigate()


  // =====================================================
  // SEARCH
  // =====================================================

  const [
    search,
    setSearch,
  ] = useState("")


  // =====================================================
  // PATIENTS
  // =====================================================

  const [
    patients,
    setPatients,
  ] = useState([])

  const [
    selectedPatient,
    setSelectedPatient,
  ] = useState(null)


  // =====================================================
  // PRESCRIPTIONS
  // =====================================================

  const [
    prescriptions,
    setPrescriptions,
  ] = useState([])


  // =====================================================
  // MEDICATION SCHEDULES
  // =====================================================

  const [
    schedules,
    setSchedules,
  ] = useState([])


  // =====================================================
  // LOADING
  // =====================================================

  const [
    loadingPatients,
    setLoadingPatients,
  ] = useState(true)


  const [
    loadingPatientData,
    setLoadingPatientData,
  ] = useState(false)


  // =====================================================
  // ERROR
  // =====================================================

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

      setPatients([])

    } finally {
      setLoadingPatients(false)
    }
  }


  // =====================================================
  // LOAD PRESCRIPTIONS + SCHEDULES
  // =====================================================

  async function loadPatientData(
    patient,
  ) {
    if (!patient) {
      return
    }

    setSelectedPatient(
      patient,
    )

    setLoadingPatientData(true)
    setError("")

    setPrescriptions([])
    setSchedules([])


    try {
      const [
        prescriptionData,
        scheduleData,
      ] = await Promise.all([
        getPrescriptionHistory(
          patient.id,
        ),

        getPatientMedicationSchedules(
          patient.id,
        ),
      ])


      setPrescriptions(
        Array.isArray(
          prescriptionData,
        )
          ? prescriptionData
          : [],
      )


      setSchedules(
        Array.isArray(
          scheduleData,
        )
          ? scheduleData
          : [],
      )

    } catch (requestError) {
      setError(
        requestError?.response?.data?.detail ||
          "Unable to load patient prescription data.",
      )

      setPrescriptions([])
      setSchedules([])

    } finally {
      setLoadingPatientData(false)
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

    loadPatients(
      search,
    )
  }


  // =====================================================
  // CREATE PRESCRIPTION
  // =====================================================

  function handleCreatePrescription() {
    if (!selectedPatient) {
      return
    }

    navigate(
      `/doctor/prescriptions/create?patient=${selectedPatient.id}`,
    )
  }


  // =====================================================
  // OPEN AI + SAFETY
  // =====================================================

  function openAISafetyReview(
    scheduleId,
  ) {
    if (!selectedPatient) {
      return
    }

    navigate(
      `/doctor/ai?patient=${selectedPatient.id}&schedule=${scheduleId}`,
    )
  }


  // =====================================================
  // FORMAT SCHEDULE STATUS
  // =====================================================

  function getStatusClasses(
    status,
  ) {
    const normalized =
      String(
        status || "",
      ).toUpperCase()


    if (
      normalized === "GIVEN"
    ) {
      return "border-emerald-200 bg-emerald-50 text-emerald-700"
    }


    if (
      normalized === "DELAYED"
    ) {
      return "border-amber-200 bg-amber-50 text-amber-700"
    }


    if (
      normalized === "HELD"
    ) {
      return "border-orange-200 bg-orange-50 text-orange-700"
    }


    if (
      normalized === "REFUSED"
    ) {
      return "border-red-200 bg-red-50 text-red-700"
    }


    if (
      normalized === "NOT_GIVEN"
    ) {
      return "border-red-200 bg-red-50 text-red-700"
    }


    return "border-slate-200 bg-slate-100 text-slate-600"
  }


  // =====================================================
  // LOADING PAGE
  // =====================================================

  if (loadingPatients) {
    return (
      <MainLayout title="Prescriptions">

        <div className="flex min-h-[65vh] items-center justify-center">

          <div className="text-center">

            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-cyan-50">

              <LoaderCircle className="h-7 w-7 animate-spin text-cyan-600" />

            </div>


            <p className="mt-4 text-sm font-semibold text-slate-700">
              Loading prescription workspace...
            </p>

          </div>

        </div>

      </MainLayout>
    )
  }


  return (
    <MainLayout title="Prescriptions">

      <div className="mx-auto max-w-7xl space-y-6">

        {/* =================================================
            HEADER
        ================================================= */}

        <div>

          <p className="text-sm font-semibold text-cyan-600">
            Doctor Workspace
          </p>


          <div className="mt-1 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">

            <div>

              <h1 className="text-3xl font-bold tracking-tight text-slate-900">
                Prescriptions
              </h1>

              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
                Select a patient to review prescriptions,
                medication schedules, and clinical risk information.
              </p>

            </div>

          </div>

        </div>


        {/* =================================================
            SEARCH
        ================================================= */}

        <form
          onSubmit={
            handleSearch
          }
          className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm"
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
                className="w-full rounded-xl border border-slate-200 bg-slate-50 py-3 pl-10 pr-4 text-sm text-slate-800 outline-none transition focus:border-cyan-400 focus:ring-4 focus:ring-cyan-400/10"
              />

            </div>


            <button
              type="submit"
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
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
            PATIENT SELECTOR
        ================================================= */}

        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">

          <div className="flex items-center gap-3">

            <div className="rounded-xl bg-cyan-50 p-3">

              <ClipboardList className="h-5 w-5 text-cyan-600" />

            </div>


            <div>

              <h2 className="font-semibold text-slate-900">
                Select Patient
              </h2>

              <p className="text-sm text-slate-500">
                Choose a patient to review their prescriptions.
              </p>

            </div>

          </div>


          <div className="mt-5">

            {patients.length === 0 ? (

              <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-8 text-center">

                <UserPlaceholder />

                <p className="mt-3 font-semibold text-slate-700">
                  No patients found
                </p>

                <p className="mt-1 text-sm text-slate-500">
                  Try another patient ID or name.
                </p>

              </div>

            ) : (

              <div className="space-y-2">

                {patients.map(
                  (patient) => {

                    const selected =
                      selectedPatient?.id ===
                      patient.id


                    return (
                      <button
                        key={patient.id}
                        type="button"
                        onClick={() =>
                          loadPatientData(
                            patient,
                          )
                        }
                        className={[
                          "flex w-full items-center justify-between rounded-2xl border p-4 text-left transition",
                          selected
                            ? "border-cyan-300 bg-cyan-50 ring-2 ring-cyan-100"
                            : "border-slate-200 hover:border-cyan-200 hover:bg-slate-50",
                        ].join(" ")}
                      >

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


                            <p className="mt-1 text-sm text-slate-500">

                              Patient ID:{" "}

                              {patient.patient_id}

                            </p>

                          </div>

                        </div>


                        <ArrowRight className="h-5 w-5 shrink-0 text-slate-300" />

                      </button>
                    )
                  },
                )}

              </div>
            )}

          </div>

        </section>


        {/* =================================================
            SELECTED PATIENT
        ================================================= */}

        {selectedPatient && (
          <>
            <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">

              <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">

                <div>

                  <p className="text-sm font-semibold text-cyan-600">
                    Selected Patient
                  </p>


                  <h2 className="mt-1 text-2xl font-bold text-slate-900">

                    {selectedPatient.first_name}{" "}
                    {selectedPatient.last_name}

                  </h2>


                  <p className="mt-1 text-sm text-slate-500">

                    Patient ID:{" "}

                    {selectedPatient.patient_id}

                  </p>

                </div>


                <div className="flex flex-wrap gap-2">

                  <button
                    type="button"
                    onClick={() =>
                      navigate(
                        `/doctor/patients/${selectedPatient.id}`,
                      )
                    }
                    className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                  >
                    Patient Profile
                  </button>


                  <button
                    type="button"
                    onClick={
                      handleCreatePrescription
                    }
                    className="rounded-xl bg-cyan-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-cyan-700"
                  >
                    + New Prescription
                  </button>

                </div>

              </div>

            </section>


            {/* =================================================
                LOADING PATIENT DATA
            ================================================= */}

            {loadingPatientData ? (

              <div className="rounded-3xl border border-slate-200 bg-white p-12 text-center shadow-sm">

                <LoaderCircle className="mx-auto h-8 w-8 animate-spin text-cyan-500" />

                <p className="mt-3 text-sm text-slate-500">
                  Loading prescriptions and schedules...
                </p>

              </div>

            ) : (
              <>
                {/* =========================================
                    PRESCRIPTION HISTORY
                ========================================== */}

                <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">

                  <div className="flex items-center gap-3">

                    <div className="rounded-xl bg-cyan-50 p-3">

                      <ClipboardList className="h-5 w-5 text-cyan-600" />

                    </div>


                    <div>

                      <h2 className="font-semibold text-slate-900">
                        Prescription History
                      </h2>

                      <p className="text-sm text-slate-500">
                        Active and stopped prescriptions.
                      </p>

                    </div>

                  </div>


                  <div className="mt-5">

                    {prescriptions.length === 0 ? (

                      <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-8 text-center">

                        <Pill className="mx-auto h-8 w-8 text-slate-300" />

                        <p className="mt-3 font-semibold text-slate-700">
                          No prescriptions found
                        </p>

                        <p className="mt-1 text-sm text-slate-500">
                          Create a prescription for this patient.
                        </p>

                      </div>

                    ) : (

                      <div className="space-y-3">

                        {prescriptions.map(
                          (prescription) => {

                            const active =
                              String(
                                prescription.prescription_status,
                              ).toUpperCase() ===
                              "ACTIVE"


                            return (
                              <div
                                key={`${prescription.prescription_id}-${prescription.prescription_item_id}`}
                                className="rounded-2xl border border-slate-200 p-5"
                              >

                                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">

                                  <div>

                                    <p className="font-semibold text-slate-900">
                                      {prescription.medicine_name}
                                    </p>


                                    <p className="mt-1 text-xs text-slate-500">
                                      Prescription #
                                      {prescription.prescription_id}
                                    </p>


                                    <div className="mt-3 flex flex-wrap gap-2">

                                      <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
                                        {prescription.dose}
                                      </span>


                                      <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
                                        {prescription.route}
                                      </span>


                                      <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
                                        {prescription.frequency}
                                      </span>


                                      <span
                                        className={
                                          active
                                            ? "rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700"
                                            : "rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600"
                                        }
                                      >
                                        {prescription.prescription_status}
                                      </span>


                                      {prescription.is_stat && (
                                        <span className="rounded-full bg-red-50 px-3 py-1 text-xs font-bold text-red-700">
                                          STAT
                                        </span>
                                      )}

                                    </div>

                                  </div>


                                  {active && (
                                    <button
                                      type="button"
                                      onClick={() =>
                                        navigate(
                                          `/doctor/prescriptions/${prescription.prescription_id}/edit?patient=${selectedPatient.id}`,
                                        )
                                      }
                                      className="inline-flex w-fit items-center gap-2 rounded-xl border border-indigo-200 bg-indigo-50 px-4 py-2.5 text-sm font-semibold text-indigo-700 hover:bg-indigo-100"
                                    >

                                      <Edit3 className="h-4 w-4" />

                                      Edit

                                    </button>
                                  )}

                                </div>


                                <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">

                                  <div>

                                    <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                                      Duration
                                    </p>

                                    <p className="mt-1 text-sm font-medium text-slate-800">
                                      {prescription.duration_days} days
                                    </p>

                                  </div>


                                  <div>

                                    <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                                      Start Date
                                    </p>

                                    <p className="mt-1 text-sm font-medium text-slate-800">
                                      {prescription.start_date}
                                    </p>

                                  </div>


                                  <div>

                                    <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                                      Start Time
                                    </p>

                                    <p className="mt-1 text-sm font-medium text-slate-800">
                                      {prescription.start_time}
                                    </p>

                                  </div>


                                  <div>

                                    <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                                      Item Status
                                    </p>

                                    <p className="mt-1 text-sm font-medium text-slate-800">
                                      {prescription.item_status}
                                    </p>

                                  </div>

                                </div>


                                {prescription.instructions && (
                                  <div className="mt-4 rounded-xl bg-slate-50 p-4">

                                    <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                                      Instructions
                                    </p>

                                    <p className="mt-1 text-sm leading-6 text-slate-600">
                                      {prescription.instructions}
                                    </p>

                                  </div>
                                )}

                              </div>
                            )
                          },
                        )}

                      </div>

                    )}

                  </div>

                </section>


                {/* =========================================
                    MEDICATION SCHEDULES
                ========================================== */}

                <section className="rounded-3xl border border-violet-100 bg-white p-6 shadow-sm">

                  <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">

                    <div className="flex items-center gap-3">

                      <div className="rounded-xl bg-violet-50 p-3">

                        <CalendarDays className="h-5 w-5 text-violet-600" />

                      </div>


                      <div>

                        <h2 className="font-semibold text-slate-900">
                          Medication Schedules
                        </h2>

                        <p className="text-sm text-slate-500">
                          Select a scheduled dose for AI and safety review.
                        </p>

                      </div>

                    </div>


                    <span className="rounded-full bg-violet-50 px-3 py-1 text-xs font-bold text-violet-700">
                      {schedules.length} schedule
                      {schedules.length === 1
                        ? ""
                        : "s"}
                    </span>

                  </div>


                  <div className="mt-5">

                    {schedules.length === 0 ? (

                      <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-8 text-center">

                        <CalendarDays className="mx-auto h-8 w-8 text-slate-300" />

                        <p className="mt-3 font-semibold text-slate-700">
                          No medication schedules found
                        </p>

                        <p className="mt-1 text-sm text-slate-500">
                          Create an active prescription to generate schedules.
                        </p>

                      </div>

                    ) : (

                      <div className="space-y-3">

                        {schedules.map(
                          (schedule) => {

                            const status =
                              String(
                                schedule.status || "",
                              ).toUpperCase()


                            const canReview =
                              status !== "CANCELLED"


                            return (
                              <div
                                key={
                                  schedule.id
                                }
                                className="rounded-2xl border border-slate-200 p-5 transition hover:border-violet-200"
                              >

                                <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">

                                  <div className="min-w-0">

                                    <div className="flex flex-wrap items-center gap-2">

                                      <p className="font-semibold text-slate-900">
                                        Schedule #
                                        {schedule.id}
                                      </p>


                                      <span
                                        className={[
                                          "rounded-full border px-3 py-1 text-xs font-bold",
                                          getStatusClasses(
                                            status,
                                          ),
                                        ].join(" ")}
                                      >
                                        {status}
                                      </span>

                                    </div>


                                    <div className="mt-3 grid gap-3 sm:grid-cols-2">

                                      <div>

                                        <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                                          Scheduled Date
                                        </p>

                                        <p className="mt-1 text-sm font-medium text-slate-800">
                                          {schedule.scheduled_date}
                                        </p>

                                      </div>


                                      <div>

                                        <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                                          Scheduled Time
                                        </p>

                                        <p className="mt-1 text-sm font-medium text-slate-800">
                                          {schedule.scheduled_time}
                                        </p>

                                      </div>

                                    </div>


                                    {schedule.actual_administration_time && (
                                      <p className="mt-3 text-xs text-slate-500">
                                        Administered:{" "}
                                        {schedule.actual_administration_time}
                                      </p>
                                    )}

                                  </div>


                                  {canReview && (
                                    <button
                                      type="button"
                                      onClick={() =>
                                        openAISafetyReview(
                                          schedule.id,
                                        )
                                      }
                                      className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-violet-700"
                                    >

                                      <BrainCircuit className="h-4 w-4" />

                                      AI & Safety Review

                                    </button>
                                  )}

                                </div>

                              </div>
                            )
                          },
                        )}

                      </div>

                    )}

                  </div>

                </section>

              </>
            )}

          </>
        )}

      </div>

    </MainLayout>
  )
}


/* =========================================================
   EMPTY STATE ICON
========================================================= */

function UserPlaceholder() {
  return (
    <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-400">
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        className="h-5 w-5"
        aria-hidden="true"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M15 19a4 4 0 00-8 0m4-8a3 3 0 100-6 3 3 0 000 6zm7 8a4 4 0 00-3-3.87M17 5a3 3 0 010 5.83"
        />
      </svg>
    </div>
  )
}