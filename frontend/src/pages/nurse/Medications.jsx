import { useEffect, useMemo, useState } from "react"
import { useNavigate } from "react-router-dom"

import {
  CalendarDays,
  ChevronDown,
  ChevronRight,
  Clock3,
  Filter,
  LoaderCircle,
  Pill,
  RefreshCw,
  Search,
  UserRound,
} from "lucide-react"

import MainLayout from "../../components/layout/MainLayout"
import { getNurseMedications } from "../../services/medications"
import { hideTestPatients } from "../../utils/patientFilter"

// =====================================================
// HELPERS
// =====================================================

function formatDate(dateString) {
  if (!dateString) {
    return "N/A"
  }

  const date = new Date(`${dateString}T00:00:00`)

  if (Number.isNaN(date.getTime())) {
    return dateString
  }

  return date.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  })
}

function formatTime(timeString) {
  if (!timeString) {
    return "N/A"
  }

  const value = String(timeString).slice(0, 5)
  const [hours, minutes] = value.split(":").map(Number)

  if (
    Number.isNaN(hours) ||
    Number.isNaN(minutes)
  ) {
    return timeString
  }

  const date = new Date()

  date.setHours(
    hours,
    minutes,
    0,
    0,
  )

  return date.toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
  })
}

function normalizeStatus(status) {
  return String(status || "")
    .trim()
    .toUpperCase()
    .replace(/_/g, " ")
}

function statusClasses(status) {
  const normalizedStatus =
    normalizeStatus(status)

  if (normalizedStatus === "GIVEN") {
    return "bg-green-100 text-green-700 border-green-200"
  }

  if (normalizedStatus === "DELAYED") {
    return "bg-orange-100 text-orange-700 border-orange-200"
  }

  if (normalizedStatus === "HELD") {
    return "bg-yellow-100 text-yellow-700 border-yellow-200"
  }

  if (
    normalizedStatus === "REFUSED" ||
    normalizedStatus === "NOT GIVEN"
  ) {
    return "bg-red-100 text-red-700 border-red-200"
  }

  if (normalizedStatus === "UPCOMING") {
    return "bg-blue-100 text-blue-700 border-blue-200"
  }

  return "bg-slate-100 text-slate-700 border-slate-200"
}

function getMedicationName(medication) {
  return (
    medication.medicine_name ??
    medication.medication_name ??
    medication.medicine ??
    medication.drug_name ??
    medication.name ??
    `Medication #${
      medication.prescription_item_id ??
      medication.id
    }`
  )
}

function getFrequency(medication) {
  return (
    medication.frequency ??
    medication.dosage_frequency ??
    medication.frequency_label ??
    "Scheduled medication"
  )
}

function getDosage(medication) {
  return (
    medication.dosage ??
    medication.dose ??
    medication.dose_amount ??
    null
  )
}

function getRoute(medication) {
  return (
    medication.route ??
    medication.administration_route ??
    null
  )
}

// =====================================================
// GROUP DATA
//
// Patient
//   -> Medicine
//       -> All timings
// =====================================================

function buildPatientGroups(medications) {
  const patients = new Map()

  medications.forEach((medication) => {
    const patientId =
      medication.patient_id ?? null

    const patientCode =
      medication.patient_code ?? null

    const patientKey =
      patientCode ||
      patientId ||
      medication.patient_name ||
      "UNKNOWN-PATIENT"

    // -------------------------------------------------
    // Create patient only once
    // -------------------------------------------------

    if (!patients.has(patientKey)) {
      patients.set(patientKey, {
        patient_id: patientId,

        patient_name:
          medication.patient_name ||
          "Unknown Patient",

        patient_code:
          patientCode ||
          "No patient ID",

        medications: new Map(),
      })
    }

    const patient =
      patients.get(patientKey)

    // -------------------------------------------------
    // One prescription item = one medicine/order
    // -------------------------------------------------

    const medicineKey =
      medication.prescription_item_id ??
      `${getMedicationName(medication)}-${medication.id}`

    if (
      !patient.medications.has(
        medicineKey,
      )
    ) {
      patient.medications.set(
        medicineKey,
        {
          medicine_name:
            getMedicationName(
              medication,
            ),

          frequency:
            getFrequency(
              medication,
            ),

          dosage:
            getDosage(
              medication,
            ),

          route:
            getRoute(
              medication,
            ),

          is_stat:
            Boolean(
              medication.is_stat,
            ),

          schedules: [],
        },
      )
    }

    const medicine =
      patient.medications.get(
        medicineKey,
      )

    // -------------------------------------------------
    // Keep STAT at medicine level
    // -------------------------------------------------

    if (
      Boolean(
        medication.is_stat,
      )
    ) {
      medicine.is_stat = true
    }

    // -------------------------------------------------
    // Add timing
    // -------------------------------------------------

    medicine.schedules.push(
      medication,
    )
  })

  // ---------------------------------------------------
  // Convert Maps to arrays
  // ---------------------------------------------------

  return Array.from(
    patients.values(),
  ).map((patient) => ({
    ...patient,

    medications:
      Array.from(
        patient.medications.values(),
      ),
  }))
}

// =====================================================
// MAIN COMPONENT
// =====================================================

export default function Medications() {
  const navigate = useNavigate()

  const [
    medications,
    setMedications,
  ] = useState([])

  const [
    search,
    setSearch,
  ] = useState("")

  const [
    statusFilter,
    setStatusFilter,
  ] = useState("ALL")

  const [
    loading,
    setLoading,
  ] = useState(true)

  const [
    error,
    setError,
  ] = useState("")

  // ===================================================
  // COLLAPSED PATIENTS
  // ===================================================

  const [
    collapsedPatients,
    setCollapsedPatients,
  ] = useState(
    new Set(),
  )

  // ===================================================
  // LOAD MEDICATIONS
  // ===================================================

  async function loadMedications() {
    try {
      setLoading(true)
      setError("")

      const data =
        await getNurseMedications()

      const visible =
        hideTestPatients(
          Array.isArray(data)
            ? data
            : [],
        )

      setMedications(visible)
    } catch (err) {
      console.error(
        "Failed to load medications:",
        err,
      )

      setError(
        err?.response?.data
          ?.detail ||
          err?.message ||
          "Failed to load medication data.",
      )
    } finally {
      setLoading(false)
    }
  }

  // ===================================================
  // INITIAL LOAD
  // ===================================================

  useEffect(() => {
    loadMedications()
  }, [])

  // ===================================================
  // TOGGLE PATIENT
  // ===================================================

  function togglePatient(patientKey) {
    setCollapsedPatients(
      (previous) => {
        const next = new Set(
          previous,
        )

        if (next.has(patientKey)) {
          next.delete(patientKey)
        } else {
          next.add(patientKey)
        }

        return next
      },
    )
  }

  // ===================================================
  // FILTERED MEDICATIONS
  // ===================================================

  const filteredMedications =
    useMemo(() => {
      const query =
        search
          .trim()
          .toLowerCase()

      return medications.filter(
        (medication) => {
          const normalizedStatus =
            normalizeStatus(
              medication.status,
            )

          const matchesStatus =
            statusFilter === "ALL" ||
            normalizedStatus ===
              statusFilter

          const searchableText = [
            medication.id,
            medication.patient_id,
            medication.patient_name,
            medication.patient_code,
            medication.prescription_item_id,
            medication.status,
            medication.scheduled_date,
            medication.scheduled_time,
            medication.medicine_name,
            medication.medication_name,
            medication.medicine,
            medication.drug_name,
            medication.frequency,
            medication.dose,
            medication.route,
          ]
            .join(" ")
            .toLowerCase()

          const matchesSearch =
            !query ||
            searchableText.includes(
              query,
            )

          return (
            matchesStatus &&
            matchesSearch
          )
        },
      )
    }, [
      medications,
      search,
      statusFilter,
    ])

  // ===================================================
  // GROUP PATIENTS
  // ===================================================

  const patientGroups =
    useMemo(
      () =>
        buildPatientGroups(
          filteredMedications,
        ),
      [filteredMedications],
    )

  // ===================================================
  // COUNTS
  // ===================================================

  const counts =
    useMemo(() => {
      const uniquePatients =
        new Set(
          medications.map(
            (item) =>
              item.patient_code ??
              item.patient_id ??
              item.patient_name,
          ),
        ).size

      const statPrescriptionItems =
        new Set()

      medications.forEach(
        (medication) => {
          if (
            Boolean(
              medication.is_stat,
            ) &&
            medication.prescription_item_id
          ) {
            statPrescriptionItems.add(
              medication.prescription_item_id,
            )
          }
        },
      )

      return {
        patients:
          uniquePatients,

        schedules:
          medications.length,

        statMedicines:
          statPrescriptionItems.size,

        upcoming:
          medications.filter(
            (item) =>
              normalizeStatus(
                item.status,
              ) === "UPCOMING",
          ).length,

        given:
          medications.filter(
            (item) =>
              normalizeStatus(
                item.status,
              ) === "GIVEN",
          ).length,

        delayed:
          medications.filter(
            (item) =>
              normalizeStatus(
                item.status,
              ) === "DELAYED",
          ).length,

        held:
          medications.filter(
            (item) =>
              normalizeStatus(
                item.status,
              ) === "HELD",
          ).length,

        refused:
          medications.filter(
            (item) =>
              normalizeStatus(
                item.status,
              ) === "REFUSED",
          ).length,

        notGiven:
          medications.filter(
            (item) =>
              normalizeStatus(
                item.status,
              ) === "NOT GIVEN",
          ).length,
      }
    }, [medications])

  // ===================================================
  // UI
  // ===================================================

  return (
    <MainLayout>
      <div className="space-y-6 p-4 md:p-6">

        {/* =================================================
            HEADER
        ================================================= */}

        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">

          <div>
            <p className="text-sm font-semibold text-blue-600">
              Nurse Portal
            </p>

            <h1 className="mt-1 text-3xl font-bold text-slate-900">
              Medications
            </h1>

            <p className="mt-2 max-w-3xl text-sm text-slate-500">
              Each patient is displayed once.
              Medicines are grouped under the
              patient, and all timings for the
              same medicine are shown together.
            </p>
          </div>

          <button
            type="button"
            onClick={loadMedications}
            disabled={loading}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? (
              <LoaderCircle
                size={18}
                className="animate-spin"
              />
            ) : (
              <RefreshCw
                size={18}
              />
            )}

            Refresh
          </button>
        </div>

        {/* =================================================
            ERROR
        ================================================= */}

        {error && (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {error}
          </div>
        )}

        {/* =================================================
            SUMMARY
        ================================================= */}

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">

          {/* PATIENTS */}

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center gap-3">

              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-100 text-blue-700">
                <UserRound size={22} />
              </div>

              <div>
                <p className="text-sm text-slate-500">
                  Patients
                </p>

                <p className="text-2xl font-bold text-slate-900">
                  {counts.patients}
                </p>
              </div>

            </div>
          </div>

          {/* SCHEDULES */}

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center gap-3">

              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-purple-100 text-purple-700">
                <Pill size={22} />
              </div>

              <div>
                <p className="text-sm text-slate-500">
                  Schedules
                </p>

                <p className="text-2xl font-bold text-slate-900">
                  {counts.schedules}
                </p>
              </div>

            </div>
          </div>

          {/* UPCOMING */}

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center gap-3">

              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-100 text-blue-700">
                <Clock3 size={22} />
              </div>

              <div>
                <p className="text-sm text-slate-500">
                  Upcoming
                </p>

                <p className="text-2xl font-bold text-slate-900">
                  {counts.upcoming}
                </p>
              </div>

            </div>
          </div>

          {/* GIVEN */}

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center gap-3">

              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-green-100 text-green-700">
                <Pill size={22} />
              </div>

              <div>
                <p className="text-sm text-slate-500">
                  Given
                </p>

                <p className="text-2xl font-bold text-slate-900">
                  {counts.given}
                </p>
              </div>

            </div>
          </div>

          {/* STAT */}

          <div className="rounded-2xl border border-red-200 bg-red-50 p-5 shadow-sm">
            <div className="flex items-center gap-3">

              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-red-100 text-red-700">
                <Pill size={22} />
              </div>

              <div>
                <p className="text-sm text-red-600">
                  STAT Medicines
                </p>

                <p className="text-2xl font-bold text-red-800">
                  {counts.statMedicines}
                </p>
              </div>

            </div>
          </div>

        </div>

        {/* =================================================
            FILTERS
        ================================================= */}

        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">

          <div className="flex flex-col gap-3 lg:flex-row">

            {/* SEARCH */}

            <div className="relative flex-1">

              <Search
                size={18}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
              />

              <input
                type="text"
                value={search}
                onChange={(event) =>
                  setSearch(
                    event.target.value,
                  )
                }
                placeholder="Search patient, patient ID, medicine, schedule..."
                className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-10 pr-4 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-blue-400 focus:bg-white focus:ring-2 focus:ring-blue-100"
              />

            </div>

            {/* STATUS */}

            <div className="relative min-w-[190px]">

              <Filter
                size={17}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
              />

              <select
                value={statusFilter}
                onChange={(event) =>
                  setStatusFilter(
                    event.target.value,
                  )
                }
                className="w-full appearance-none rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-10 pr-10 text-sm font-medium text-slate-700 outline-none focus:border-blue-400 focus:bg-white focus:ring-2 focus:ring-blue-100"
              >
                <option value="ALL">
                  All Status
                </option>

                <option value="UPCOMING">
                  Upcoming
                </option>

                <option value="GIVEN">
                  Given
                </option>

                <option value="DELAYED">
                  Delayed
                </option>

                <option value="HELD">
                  Held
                </option>

                <option value="REFUSED">
                  Refused
                </option>

                <option value="NOT GIVEN">
                  Not Given
                </option>
              </select>

              <ChevronDown
                size={17}
                className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400"
              />

            </div>

          </div>

        </div>

        {/* =================================================
            PATIENT RESULTS
        ================================================= */}

        {loading ? (

          <div className="flex min-h-[300px] items-center justify-center rounded-2xl border border-slate-200 bg-white">

            <div className="flex items-center gap-3 text-slate-500">

              <LoaderCircle
                size={22}
                className="animate-spin"
              />

              Loading medications...

            </div>

          </div>

        ) : patientGroups.length === 0 ? (

          <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center">

            <Search
              size={42}
              className="mx-auto text-slate-300"
            />

            <h2 className="mt-4 text-lg font-semibold text-slate-800">
              No matching records
            </h2>

            <p className="mt-2 text-sm text-slate-500">
              Try changing the search text
              or status filter.
            </p>

          </div>

        ) : (

          <div className="space-y-6">

            {patientGroups.map(
              (patient) => {
                const patientKey =
                  patient.patient_code ||
                  patient.patient_id ||
                  patient.patient_name

                const isCollapsed =
                  collapsedPatients.has(
                    patientKey,
                  )

                const totalSchedules =
                  patient.medications.reduce(
                    (
                      total,
                      medicine,
                    ) =>
                      total +
                      medicine.schedules
                        .length,
                    0,
                  )

                return (
                  <section
                    key={patientKey}
                    className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"
                  >

                    {/* =====================================
                        PATIENT HEADER
                    ===================================== */}

                    <div className="border-b border-slate-200 bg-slate-50 p-5">

                      <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">

                        {/* PATIENT INFO */}

                        <div className="flex items-start gap-4">

                          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-blue-100 text-blue-700">
                            <UserRound
                              size={24}
                            />
                          </div>

                          <div>

                            <h2 className="text-xl font-bold text-slate-900">
                              {
                                patient.patient_name
                              }
                            </h2>

                            <div className="mt-1 flex flex-wrap gap-x-5 gap-y-1 text-sm text-slate-500">

                              <span>
                                Patient ID:{" "}

                                <strong className="text-slate-700">
                                  {
                                    patient.patient_code
                                  }
                                </strong>
                              </span>

                              {patient.patient_id && (
                                <span>
                                  Database ID:{" "}

                                  <strong className="text-slate-700">
                                    {
                                      patient.patient_id
                                    }
                                  </strong>
                                </span>
                              )}

                            </div>

                          </div>

                        </div>

                        {/* PATIENT ACTIONS */}

                        <div className="flex flex-wrap items-center gap-3">

                          {/* MEDICINES COUNT */}

                          <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-center">

                            <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
                              Medicines
                            </p>

                            <p className="mt-1 text-2xl font-bold text-slate-900">
                              {
                                patient.medications.length
                              }
                            </p>

                          </div>

                          {/* SCHEDULE COUNT */}

                          <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-center">

                            <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
                              Schedules
                            </p>

                            <p className="mt-1 text-2xl font-bold text-slate-900">
                              {
                                totalSchedules
                              }
                            </p>

                          </div>

                          {/* WRAP UP BUTTON */}

                          <button
                            type="button"
                            onClick={() =>
                              togglePatient(
                                patientKey,
                              )
                            }
                            className={`inline-flex items-center justify-center gap-2 rounded-xl border px-4 py-3 text-sm font-semibold transition ${
                              isCollapsed
                                ? "border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100"
                                : "border-slate-300 bg-white text-slate-700 hover:bg-slate-100"
                            }`}
                          >

                            {isCollapsed ? (
                              <>
                                Expand
                                <ChevronDown
                                  size={18}
                                />
                              </>
                            ) : (
                              <>
                                Wrap Up
                                <ChevronRight
                                  size={18}
                                />
                              </>
                            )}

                          </button>

                        </div>

                      </div>

                    </div>

                    {/* =====================================
                        MEDICATION CONTENT

                        Hidden when wrapped up
                    ===================================== */}

                    {!isCollapsed && (

                      <div className="space-y-5 p-5">

                        {patient.medications.map(
                          (
                            medicine,
                            medicineIndex,
                          ) => (

                            <div
                              key={`${patientKey}-${medicine.medicine_name}-${medicineIndex}`}
                              className="rounded-2xl border border-slate-200 p-5"
                            >

                              {/* =================================
                                  MEDICINE HEADER
                              ================================= */}

                              <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">

                                <div className="flex items-start gap-3">

                                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-purple-100 text-purple-700">
                                    <Pill
                                      size={20}
                                    />
                                  </div>

                                  <div>

                                    {/* MEDICINE NAME + STAT */}

                                    <div className="flex flex-wrap items-center gap-2">

                                      <h3 className="text-lg font-bold text-slate-900">
                                        {
                                          medicine.medicine_name
                                        }
                                      </h3>

                                      {medicine.is_stat && (
                                        <span className="inline-flex rounded-full border border-red-200 bg-red-50 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-red-700">
                                          STAT
                                        </span>
                                      )}

                                    </div>

                                    {/* MEDICINE DETAILS */}

                                    <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm text-slate-500">

                                      <span>
                                        Frequency:{" "}

                                        <strong className="text-slate-700">
                                          {
                                            medicine.frequency
                                          }
                                        </strong>
                                      </span>

                                      {medicine.dosage && (
                                        <span>
                                          Dose:{" "}

                                          <strong className="text-slate-700">
                                            {
                                              medicine.dosage
                                            }
                                          </strong>
                                        </span>
                                      )}

                                      {medicine.route && (
                                        <span>
                                          Route:{" "}

                                          <strong className="text-slate-700">
                                            {
                                              medicine.route
                                            }
                                          </strong>
                                        </span>
                                      )}

                                    </div>

                                  </div>

                                </div>

                                {/* TIMING COUNT */}

                                <span className="self-start rounded-full bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-600">
                                  {
                                    medicine.schedules
                                      .length
                                  }{" "}
                                  timing
                                  {
                                    medicine
                                      .schedules
                                      .length !==
                                    1
                                      ? "s"
                                      : ""
                                  }
                                </span>

                              </div>

                              {/* =================================
                                  TIMINGS
                              ================================= */}

                              <div className="mt-5 overflow-x-auto">

                                <div className="min-w-[700px] overflow-hidden rounded-xl border border-slate-200">

                                  {/* TABLE HEADER */}

                                  <div className="grid grid-cols-[110px_160px_130px_1fr_120px] border-b border-slate-200 bg-slate-50 px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500">

                                    <div>
                                      Time
                                    </div>

                                    <div>
                                      Date
                                    </div>

                                    <div>
                                      Status
                                    </div>

                                    <div>
                                      Details
                                    </div>

                                    <div className="text-right">
                                      Action
                                    </div>

                                  </div>

                                  {/* TIMING ROWS */}

                                  <div className="divide-y divide-slate-200">

                                    {medicine.schedules.map(
                                      (
                                        schedule,
                                      ) => (

                                        <div
                                          key={
                                            schedule.id
                                          }
                                          className="grid grid-cols-[110px_160px_130px_1fr_120px] items-center px-4 py-4"
                                        >

                                          {/* TIME */}

                                          <div className="flex items-center gap-2 text-sm font-semibold text-slate-800">

                                            <Clock3
                                              size={
                                                16
                                              }
                                              className="text-slate-400"
                                            />

                                            {
                                              formatTime(
                                                schedule.scheduled_time,
                                              )
                                            }

                                          </div>

                                          {/* DATE */}

                                          <div className="flex items-center gap-2 text-sm text-slate-600">

                                            <CalendarDays
                                              size={
                                                16
                                              }
                                              className="text-slate-400"
                                            />

                                            {
                                              formatDate(
                                                schedule.scheduled_date,
                                              )
                                            }

                                          </div>

                                          {/* STATUS */}

                                          <div>

                                            <span
                                              className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${statusClasses(
                                                schedule.status,
                                              )}`}
                                            >
                                              {
                                                normalizeStatus(
                                                  schedule.status,
                                                ) ||
                                                "UNKNOWN"
                                              }
                                            </span>

                                          </div>

                                          {/* DETAILS */}

                                          <div className="text-sm text-slate-500">

                                            <span>
                                              Schedule #
                                              {
                                                schedule.id
                                              }
                                            </span>

                                            <span className="mx-2">
                                              •
                                            </span>

                                            <span>
                                              Prescription Item #
                                              {
                                                schedule.prescription_item_id
                                              }
                                            </span>

                                            {schedule.actual_administration_time && (
                                              <span className="ml-2">
                                                • Administered
                                              </span>
                                            )}

                                          </div>

                                          {/* ACTION */}

                                          <div className="flex justify-end">

                                            <button
                                              type="button"
                                              onClick={() =>
                                                navigate(
                                                  `/nurse/medications/${schedule.id}`,
                                                )
                                              }
                                              className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-3 py-2 text-xs font-semibold text-white transition hover:bg-slate-800"
                                            >
                                              View

                                              <ChevronRight
                                                size={
                                                  15
                                                }
                                              />
                                            </button>

                                          </div>

                                        </div>

                                      ),
                                    )}

                                  </div>

                                </div>

                              </div>

                            </div>

                          ),
                        )}

                      </div>

                    )}

                  </section>
                )
              },
            )}

          </div>

        )}

        {/* =================================================
            INFORMATION
        ================================================= */}

        <div className="rounded-2xl border border-blue-100 bg-blue-50 p-5">

          <div className="flex items-start gap-3">

            <Pill
              size={21}
              className="mt-0.5 shrink-0 text-blue-600"
            />

            <div>

              <h3 className="font-semibold text-blue-900">
                Medication display logic
              </h3>

              <p className="mt-1 text-sm leading-6 text-blue-800">
                One patient is displayed once.
                Each medicine is displayed once.
                All timings for that medicine are
                shown underneath it. STAT is shown
                once at the medicine level. Use
                Wrap Up to collapse a patient's
                medication information and Expand
                to view it again.
              </p>

            </div>

          </div>

        </div>

      </div>
    </MainLayout>
  )
}