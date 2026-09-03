import {
  AlertTriangle,
  ArrowLeft,
  CalendarDays,
  ClipboardList,
  Edit3,
  LoaderCircle,
  Pill,
  Plus,
  RefreshCw,
  ShieldAlert,
  UserRound,
  XCircle,
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

import {
  getDoctorPatient,
  getPatientAllergies,
  getCurrentMedications,
  getPrescriptionHistory,
  stopPrescription,
} from "../../services/doctor"


export default function PatientProfile() {
  const {
    patientId,
  } = useParams()

  const navigate =
    useNavigate()


  const [patient, setPatient] =
    useState(null)

  const [allergies, setAllergies] =
    useState([])

  const [medications, setMedications] =
    useState([])

  const [prescriptions, setPrescriptions] =
    useState([])

  const [loading, setLoading] =
    useState(true)

  const [refreshing, setRefreshing] =
    useState(false)

  const [error, setError] =
    useState("")

  const [successMessage, setSuccessMessage] =
    useState("")

  const [stoppingId, setStoppingId] =
    useState(null)


  // =====================================================
  // LOAD PATIENT PROFILE
  // =====================================================

  async function loadProfile(
    showFullLoading = true,
  ) {
    if (!patientId) {
      setError(
        "Patient ID is missing.",
      )
      setLoading(false)
      return
    }

    if (showFullLoading) {
      setLoading(true)
    } else {
      setRefreshing(true)
    }

    setError("")

    try {
      const [
        patientData,
        allergyData,
        medicationData,
        prescriptionData,
      ] = await Promise.all([
        getDoctorPatient(
          patientId,
        ),

        getPatientAllergies(
          patientId,
        ),

        getCurrentMedications(
          patientId,
        ),

        getPrescriptionHistory(
          patientId,
        ),
      ])


      setPatient(
        patientData,
      )

      setAllergies(
        Array.isArray(
          allergyData,
        )
          ? allergyData
          : [],
      )

      setMedications(
        Array.isArray(
          medicationData,
        )
          ? medicationData
          : [],
      )

      setPrescriptions(
        Array.isArray(
          prescriptionData,
        )
          ? prescriptionData
          : [],
      )

    } catch (requestError) {
      setError(
        requestError?.response?.data?.detail ||
          "Unable to load patient profile.",
      )
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }


  useEffect(() => {
    loadProfile(true)
  }, [patientId])


  // =====================================================
  // CREATE PRESCRIPTION
  // =====================================================

  function handleCreatePrescription() {
    navigate(
      `/doctor/prescriptions/create?patient=${patient.id}`,
    )
  }


  // =====================================================
  // EDIT PRESCRIPTION
  // =====================================================

  function handleEditPrescription(
    prescription,
  ) {
    navigate(
      `/doctor/prescriptions/${prescription.prescription_id}/edit?patient=${patient.id}`,
    )
  }


  // =====================================================
  // STOP PRESCRIPTION
  // =====================================================

  async function handleStopPrescription(
    prescriptionId,
  ) {
    const confirmed =
      window.confirm(
        "Stop this prescription?\n\nThe active prescription will be stopped and future unadministered medication schedules will be removed. Historical administration records will be preserved.",
      )


    if (!confirmed) {
      return
    }


    setStoppingId(
      prescriptionId,
    )

    setError("")
    setSuccessMessage("")


    try {
      const result =
        await stopPrescription(
          prescriptionId,
        )


      setSuccessMessage(
        result?.message ||
          "Prescription stopped successfully.",
      )


      await loadProfile(false)

    } catch (requestError) {
      setError(
        requestError?.response?.data?.detail ||
          "Unable to stop prescription.",
      )
    } finally {
      setStoppingId(null)
    }
  }


  // =====================================================
  // LOADING STATE
  // =====================================================

  if (loading) {
    return (
      <MainLayout title="Patient Profile">

        <div className="flex min-h-[65vh] items-center justify-center">

          <div className="text-center">

            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-cyan-50">

              <LoaderCircle className="h-7 w-7 animate-spin text-cyan-600" />

            </div>

            <p className="mt-4 text-sm font-medium text-slate-700">
              Loading patient profile...
            </p>

            <p className="mt-1 text-xs text-slate-400">
              Fetching patient, medication, allergy,
              and prescription information.
            </p>

          </div>

        </div>

      </MainLayout>
    )
  }


  // =====================================================
  // ERROR / PATIENT NOT FOUND
  // =====================================================

  if (!patient) {
    return (
      <MainLayout title="Patient Profile">

        <div className="mx-auto max-w-2xl">

          <button
            type="button"
            onClick={() =>
              navigate(
                "/doctor/patients",
              )
            }
            className="mb-5 inline-flex items-center gap-2 text-sm font-semibold text-slate-600 transition hover:text-slate-900"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to patients
          </button>


          <div className="rounded-3xl border border-red-200 bg-red-50 p-6">

            <div className="flex items-start gap-3">

              <AlertTriangle className="mt-0.5 h-5 w-5 text-red-600" />

              <div>

                <h2 className="font-semibold text-red-900">
                  Patient unavailable
                </h2>

                <p className="mt-2 text-sm leading-6 text-red-700">
                  {error ||
                    "Patient could not be loaded."}
                </p>

              </div>

            </div>

          </div>

        </div>

      </MainLayout>
    )
  }


  // =====================================================
  // MAIN UI
  // =====================================================

  return (
    <MainLayout title="Patient Profile">

      <div className="mx-auto max-w-7xl space-y-6">

        {/* =================================================
            BACK + REFRESH
        ================================================= */}

        <div className="flex items-center justify-between gap-4">

          <button
            type="button"
            onClick={() =>
              navigate(
                "/doctor/patients",
              )
            }
            className="inline-flex items-center gap-2 text-sm font-semibold text-slate-600 transition hover:text-slate-900"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to patients
          </button>


          <button
            type="button"
            onClick={() =>
              loadProfile(false)
            }
            disabled={refreshing}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
          >

            <RefreshCw
              className={
                refreshing
                  ? "h-4 w-4 animate-spin"
                  : "h-4 w-4"
              }
            />

            Refresh

          </button>

        </div>


        {/* =================================================
            ERROR
        ================================================= */}

        {error && (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-4">

            <div className="flex items-start gap-3">

              <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-red-600" />

              <div>

                <p className="text-sm font-semibold text-red-900">
                  Something went wrong
                </p>

                <p className="mt-1 text-sm leading-6 text-red-700">
                  {error}
                </p>

              </div>

            </div>

          </div>
        )}


        {/* =================================================
            SUCCESS
        ================================================= */}

        {successMessage && (
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">

            <div className="flex items-start gap-3">

              <div className="rounded-xl bg-emerald-100 p-2">

                <ShieldAlert className="h-5 w-5 text-emerald-600" />

              </div>

              <div>

                <p className="text-sm font-semibold text-emerald-900">
                  Action completed
                </p>

                <p className="mt-1 text-sm text-emerald-700">
                  {successMessage}
                </p>

              </div>

            </div>

          </div>
        )}


        {/* =================================================
            PATIENT HEADER
        ================================================= */}

        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">

          <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">

            <div className="flex items-center gap-4">

              <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-cyan-50 text-lg font-bold text-cyan-700">

                {patient.first_name
                  ?.charAt(0)
                  .toUpperCase()}

                {patient.last_name
                  ?.charAt(0)
                  .toUpperCase()}

              </div>


              <div>

                <div className="flex flex-wrap items-center gap-2">

                  <p className="text-sm font-semibold text-cyan-600">
                    Patient Profile
                  </p>

                  {patient.is_active && (
                    <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[11px] font-bold text-emerald-700">
                      ACTIVE
                    </span>
                  )}

                </div>


                <h1 className="mt-1 text-3xl font-bold tracking-tight text-slate-900">

                  {patient.first_name}{" "}
                  {patient.last_name}

                </h1>


                <p className="mt-1 text-sm text-slate-500">

                  Patient ID:{" "}

                  <span className="font-semibold text-slate-700">
                    {patient.patient_id}
                  </span>

                </p>

              </div>

            </div>


            <button
              type="button"
              onClick={
                handleCreatePrescription
              }
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-cyan-600 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-cyan-700"
            >
              <Plus className="h-5 w-5" />
              Create Prescription
            </button>

          </div>


          {/* Patient metadata */}

          <div className="mt-7 grid gap-4 border-t border-slate-100 pt-6 sm:grid-cols-2 lg:grid-cols-4">

            <div className="rounded-2xl bg-slate-50 p-4">

              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                Date of Birth
              </p>

              <p className="mt-1 font-semibold text-slate-800">
                {patient.date_of_birth ||
                  "Not available"}
              </p>

            </div>


            <div className="rounded-2xl bg-slate-50 p-4">

              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                Gender
              </p>

              <p className="mt-1 font-semibold text-slate-800">
                {patient.gender ||
                  "Not available"}
              </p>

            </div>


            <div className="rounded-2xl bg-slate-50 p-4">

              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                Weight
              </p>

              <p className="mt-1 font-semibold text-slate-800">
                {patient.weight_kg
                  ? `${patient.weight_kg} kg`
                  : "Not available"}
              </p>

            </div>


            <div className="rounded-2xl bg-slate-50 p-4">

              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                Patient Record
              </p>

              <p
                className={
                  patient.is_active
                    ? "mt-1 font-semibold text-emerald-700"
                    : "mt-1 font-semibold text-red-700"
                }
              >
                {patient.is_active
                  ? "ACTIVE"
                  : "INACTIVE"}
              </p>

            </div>

          </div>

        </section>


        {/* =================================================
            SUMMARY CARDS
        ================================================= */}

        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">

          <div className="rounded-2xl border border-red-100 bg-white p-5 shadow-sm">

            <div className="flex items-center justify-between">

              <div className="rounded-xl bg-red-50 p-3">
                <ShieldAlert className="h-5 w-5 text-red-600" />
              </div>

              <span className="text-xs font-semibold text-slate-400">
                Safety
              </span>

            </div>

            <p className="mt-4 text-sm text-slate-500">
              Allergies
            </p>

            <p className="mt-1 text-3xl font-bold text-slate-900">
              {allergies.length}
            </p>

          </div>


          <div className="rounded-2xl border border-indigo-100 bg-white p-5 shadow-sm">

            <div className="flex items-center justify-between">

              <div className="rounded-xl bg-indigo-50 p-3">
                <Pill className="h-5 w-5 text-indigo-600" />
              </div>

              <span className="text-xs font-semibold text-slate-400">
                Active
              </span>

            </div>

            <p className="mt-4 text-sm text-slate-500">
              Current Medications
            </p>

            <p className="mt-1 text-3xl font-bold text-slate-900">
              {medications.length}
            </p>

          </div>


          <div className="rounded-2xl border border-cyan-100 bg-white p-5 shadow-sm">

            <div className="flex items-center justify-between">

              <div className="rounded-xl bg-cyan-50 p-3">
                <ClipboardList className="h-5 w-5 text-cyan-600" />
              </div>

              <span className="text-xs font-semibold text-slate-400">
                History
              </span>

            </div>

            <p className="mt-4 text-sm text-slate-500">
              Prescriptions
            </p>

            <p className="mt-1 text-3xl font-bold text-slate-900">
              {prescriptions.length}
            </p>

          </div>


          <div className="rounded-2xl border border-emerald-100 bg-white p-5 shadow-sm">

            <div className="flex items-center justify-between">

              <div className="rounded-xl bg-emerald-50 p-3">
                <UserRound className="h-5 w-5 text-emerald-600" />
              </div>

              <span className="text-xs font-semibold text-slate-400">
                Status
              </span>

            </div>

            <p className="mt-4 text-sm text-slate-500">
              Patient Record
            </p>

            <p className="mt-1 text-lg font-bold text-emerald-700">
              {patient.is_active
                ? "Active"
                : "Inactive"}
            </p>

          </div>

        </section>


        {/* =================================================
            ALLERGIES
        ================================================= */}

        <section className="rounded-3xl border border-red-100 bg-white p-6 shadow-sm">

          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">

            <div className="flex items-center gap-3">

              <div className="rounded-xl bg-red-50 p-3">
                <AlertTriangle className="h-5 w-5 text-red-600" />
              </div>

              <div>

                <h2 className="font-semibold text-slate-900">
                  Allergies
                </h2>

                <p className="text-sm text-slate-500">
                  Recorded patient allergies
                </p>

              </div>

            </div>

          </div>


          <div className="mt-5">

            {allergies.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-6">

                <p className="text-sm font-medium text-slate-700">
                  No allergies recorded.
                </p>

                <p className="mt-1 text-xs text-slate-500">
                  No allergy records were returned for this patient.
                </p>

              </div>
            ) : (
              <div className="grid gap-3 md:grid-cols-2">

                {allergies.map(
                  (allergy) => (
                    <div
                      key={allergy.id}
                      className="rounded-2xl border border-red-100 bg-red-50/60 p-5"
                    >

                      <div className="flex items-start justify-between gap-4">

                        <div>

                          <p className="text-sm font-bold text-red-900">
                            {allergy.allergen}
                          </p>

                          {allergy.reaction && (
                            <p className="mt-2 text-sm text-red-700">
                              Reaction:{" "}
                              {allergy.reaction}
                            </p>
                          )}

                        </div>


                        {allergy.severity && (
                          <span className="shrink-0 rounded-full border border-red-200 bg-white px-3 py-1 text-[11px] font-bold text-red-700">
                            {allergy.severity}
                          </span>
                        )}

                      </div>


                      {allergy.notes && (
                        <p className="mt-3 rounded-xl bg-white/70 p-3 text-sm text-slate-600">
                          {allergy.notes}
                        </p>
                      )}

                    </div>
                  ),
                )}

              </div>
            )}

          </div>

        </section>


        {/* =================================================
            CURRENT MEDICATIONS
        ================================================= */}

        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">

          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">

            <div className="flex items-center gap-3">

              <div className="rounded-xl bg-indigo-50 p-3">
                <Pill className="h-5 w-5 text-indigo-600" />
              </div>

              <div>

                <h2 className="font-semibold text-slate-900">
                  Current Medications
                </h2>

                <p className="text-sm text-slate-500">
                  Active prescribed medications
                </p>

              </div>

            </div>


            <button
              type="button"
              onClick={
                handleCreatePrescription
              }
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-cyan-200 bg-cyan-50 px-4 py-2.5 text-sm font-semibold text-cyan-700 transition hover:bg-cyan-100"
            >
              <Plus className="h-4 w-4" />
              New Prescription
            </button>

          </div>


          <div className="mt-5">

            {medications.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-6">

                <p className="text-sm font-medium text-slate-700">
                  No active medications found.
                </p>

              </div>
            ) : (
              <div className="space-y-3">

                {medications.map(
                  (medication) => (
                    <div
                      key={
                        medication.prescription_item_id
                      }
                      className="rounded-2xl border border-slate-200 p-5 transition hover:border-indigo-100"
                    >

                      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">

                        <div>

                          <h3 className="font-semibold text-slate-900">
                            {medication.medicine_name}
                          </h3>

                          <p className="mt-1 text-sm text-slate-500">
                            {medication.generic_name ||
                              "Generic name unavailable"}

                            {medication.strength
                              ? ` · ${medication.strength}`
                              : ""}

                          </p>

                        </div>


                        {medication.is_stat && (
                          <span className="w-fit rounded-full border border-red-200 bg-red-50 px-3 py-1 text-xs font-bold text-red-700">
                            STAT
                          </span>
                        )}

                      </div>


                      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">

                        <div>

                          <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                            Dose
                          </p>

                          <p className="mt-1 text-sm font-medium text-slate-800">
                            {medication.dose}
                          </p>

                        </div>


                        <div>

                          <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                            Route
                          </p>

                          <p className="mt-1 text-sm font-medium text-slate-800">
                            {medication.route}
                          </p>

                        </div>


                        <div>

                          <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                            Frequency
                          </p>

                          <p className="mt-1 text-sm font-medium text-slate-800">
                            {medication.frequency}
                          </p>

                        </div>


                        <div>

                          <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                            Duration
                          </p>

                          <p className="mt-1 text-sm font-medium text-slate-800">
                            {medication.duration_days} days
                          </p>

                        </div>

                      </div>


                      {medication.instructions && (
                        <div className="mt-4 rounded-xl bg-slate-50 p-4">

                          <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                            Instructions
                          </p>

                          <p className="mt-1 text-sm leading-6 text-slate-600">
                            {medication.instructions}
                          </p>

                        </div>
                      )}

                    </div>
                  ),
                )}

              </div>
            )}

          </div>

        </section>


        {/* =================================================
            PRESCRIPTION HISTORY
        ================================================= */}

        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">

          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">

            <div className="flex items-center gap-3">

              <div className="rounded-xl bg-cyan-50 p-3">
                <CalendarDays className="h-5 w-5 text-cyan-600" />
              </div>

              <div>

                <h2 className="font-semibold text-slate-900">
                  Prescription History
                </h2>

                <p className="text-sm text-slate-500">
                  Active and stopped prescriptions
                </p>

              </div>

            </div>


            <span className="text-xs font-semibold text-slate-400">
              {prescriptions.length} record
              {prescriptions.length === 1
                ? ""
                : "s"}
            </span>

          </div>


          <div className="mt-5">

            {prescriptions.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-6">

                <p className="text-sm font-medium text-slate-700">
                  No prescription history found.
                </p>

              </div>
            ) : (
              <div className="space-y-4">

                {prescriptions.map(
                  (prescription) => {
                    const isActive =
                      String(
                        prescription.prescription_status,
                      ).toUpperCase() ===
                      "ACTIVE"


                    return (
                      <div
                        key={`${prescription.prescription_id}-${prescription.prescription_item_id}`}
                        className="rounded-2xl border border-slate-200 p-5"
                      >

                        {/* Title */}

                        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">

                          <div>

                            <p className="font-semibold text-slate-900">
                              {prescription.medicine_name}
                            </p>

                            <p className="mt-1 text-xs text-slate-500">
                              Prescription #
                              {prescription.prescription_id}
                            </p>

                          </div>


                          <div className="flex flex-wrap gap-2">

                            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
                              {prescription.prescription_status}
                            </span>

                            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
                              {prescription.item_status}
                            </span>

                            {prescription.is_stat && (
                              <span className="rounded-full bg-red-50 px-3 py-1 text-xs font-bold text-red-700">
                                STAT
                              </span>
                            )}

                          </div>

                        </div>


                        {/* Prescription details */}

                        <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">

                          <div>

                            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                              Dose
                            </p>

                            <p className="mt-1 text-sm font-medium text-slate-800">
                              {prescription.dose}
                            </p>

                          </div>


                          <div>

                            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                              Route
                            </p>

                            <p className="mt-1 text-sm font-medium text-slate-800">
                              {prescription.route}
                            </p>

                          </div>


                          <div>

                            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                              Frequency
                            </p>

                            <p className="mt-1 text-sm font-medium text-slate-800">
                              {prescription.frequency}
                            </p>

                          </div>


                          <div>

                            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                              Duration
                            </p>

                            <p className="mt-1 text-sm font-medium text-slate-800">
                              {prescription.duration_days} days
                            </p>

                          </div>

                        </div>


                        <div className="mt-4 grid gap-4 sm:grid-cols-2">

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

                        </div>


                        {/* Instructions */}

                        {prescription.instructions && (
                          <div className="mt-4 rounded-xl bg-slate-50 p-4">

                            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                              Instructions
                            </p>

                            <p className="mt-1 text-sm leading-6 text-slate-600">
                              {
                                prescription.instructions
                              }
                            </p>

                          </div>
                        )}


                        {/* Notes */}

                        {prescription.prescription_notes && (
                          <div className="mt-3 rounded-xl border border-slate-100 bg-white p-4">

                            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                              Prescription Notes
                            </p>

                            <p className="mt-1 text-sm leading-6 text-slate-600">
                              {
                                prescription.prescription_notes
                              }
                            </p>

                          </div>
                        )}


                        {/* Actions */}

                        {isActive && (
                          <div className="mt-5 flex flex-wrap gap-2 border-t border-slate-100 pt-4">

                            <button
                              type="button"
                              onClick={() =>
                                handleEditPrescription(
                                  prescription,
                                )
                              }
                              className="inline-flex items-center gap-2 rounded-xl border border-indigo-200 bg-indigo-50 px-4 py-2.5 text-sm font-semibold text-indigo-700 transition hover:bg-indigo-100"
                            >
                              <Edit3 className="h-4 w-4" />
                              Edit
                            </button>


                            <button
                              type="button"
                              onClick={() =>
                                handleStopPrescription(
                                  prescription.prescription_id,
                                )
                              }
                              disabled={
                                stoppingId ===
                                prescription.prescription_id
                              }
                              className="inline-flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-sm font-semibold text-red-700 transition hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-50"
                            >

                              {stoppingId ===
                              prescription.prescription_id ? (
                                <LoaderCircle className="h-4 w-4 animate-spin" />
                              ) : (
                                <XCircle className="h-4 w-4" />
                              )}

                              {stoppingId ===
                              prescription.prescription_id
                                ? "Stopping..."
                                : "Stop Prescription"}

                            </button>

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

      </div>

    </MainLayout>
  )
}