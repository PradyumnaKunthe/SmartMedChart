import { useEffect, useMemo, useState } from "react"
import { useNavigate } from "react-router-dom"

import {
  AlertTriangle,
  CalendarClock,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Clock3,
  LoaderCircle,
  Pill,
  RefreshCw,
  ShieldAlert,
  UserRound,
  XCircle,
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

function getStatusClasses(status) {
  const normalized = normalizeStatus(status)

  if (normalized === "GIVEN") {
    return "bg-green-100 text-green-700 border-green-200"
  }

  if (normalized === "DELAYED") {
    return "bg-orange-100 text-orange-700 border-orange-200"
  }

  if (normalized === "HELD") {
    return "bg-yellow-100 text-yellow-700 border-yellow-200"
  }

  if (
    normalized === "REFUSED" ||
    normalized === "NOT GIVEN"
  ) {
    return "bg-red-100 text-red-700 border-red-200"
  }

  if (normalized === "UPCOMING") {
    return "bg-blue-100 text-blue-700 border-blue-200"
  }

  return "bg-slate-100 text-slate-700 border-slate-200"
}

function getStatusIcon(status) {
  const normalized = normalizeStatus(status)

  if (normalized === "GIVEN") {
    return CheckCircle2
  }

  if (
    normalized === "REFUSED" ||
    normalized === "NOT GIVEN"
  ) {
    return XCircle
  }

  if (
    normalized === "DELAYED" ||
    normalized === "HELD"
  ) {
    return AlertTriangle
  }

  return Clock3
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
// STAT CARD
// =====================================================

function StatCard({
  title,
  value,
  description,
  icon: Icon,
  iconClasses,
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-4">

        <div>
          <p className="text-sm font-medium text-slate-500">
            {title}
          </p>

          <p className="mt-2 text-3xl font-bold text-slate-900">
            {value}
          </p>

          {description && (
            <p className="mt-1 text-xs text-slate-500">
              {description}
            </p>
          )}
        </div>

        <div
          className={`flex h-11 w-11 items-center justify-center rounded-xl ${iconClasses}`}
        >
          <Icon size={22} />
        </div>

      </div>
    </div>
  )
}

// =====================================================
// SCHEDULE ROW
// =====================================================

function ScheduleRow({
  medication,
  onOpen,
}) {
  const status = normalizeStatus(
    medication.status,
  )

  const StatusIcon =
    getStatusIcon(status)

  const dosage =
    getDosage(medication)

  const route =
    getRoute(medication)

  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">

      <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">

        {/* DETAILS */}

        <div className="min-w-0 flex-1">

          <div className="flex flex-wrap items-center gap-2">

            <span
              className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-semibold ${getStatusClasses(
                status,
              )}`}
            >
              <StatusIcon size={13} />

              {status || "UNKNOWN"}
            </span>

          </div>

          <div className="mt-3 flex flex-wrap items-center gap-x-6 gap-y-2">

            {/* DATE */}

            <div>

              <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
                Date
              </p>

              <p className="mt-1 flex items-center gap-2 text-sm font-semibold text-slate-800">

                <CalendarClock size={15} />

                {formatDate(
                  medication.scheduled_date,
                )}

              </p>

            </div>

            {/* TIME */}

            <div>

              <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
                Time
              </p>

              <p className="mt-1 flex items-center gap-2 text-sm font-semibold text-slate-800">

                <Clock3 size={15} />

                {formatTime(
                  medication.scheduled_time,
                )}

              </p>

            </div>

            {/* SCHEDULE ID */}

            <div>

              <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
                Schedule ID
              </p>

              <p className="mt-1 text-sm font-semibold text-slate-800">
                #{medication.id}
              </p>

            </div>

          </div>

          {/* EXTRA DETAILS */}

          <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-500">

            <span className="rounded-lg bg-white px-2.5 py-1.5">
              Frequency:{" "}
              {getFrequency(
                medication,
              )}
            </span>

            {dosage && (
              <span className="rounded-lg bg-white px-2.5 py-1.5">
                Dose: {dosage}
              </span>
            )}

            {route && (
              <span className="rounded-lg bg-white px-2.5 py-1.5">
                Route: {route}
              </span>
            )}

            <span className="rounded-lg bg-white px-2.5 py-1.5">
              Prescription Item:{" "}
              {medication.prescription_item_id ??
                "N/A"}
            </span>

          </div>

        </div>

        {/* OPEN BUTTON */}

        <button
          type="button"
          onClick={() =>
            onOpen(medication.id)
          }
          className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800"
        >
          Open

          <ChevronRight
            size={17}
          />
        </button>

      </div>
    </div>
  )
}

// =====================================================
// GROUP DATA
//
// Patient
//   -> Medicine
//       -> All timings
// =====================================================

function buildPatientGroups(
  medications,
) {
  const patients = new Map()

  medications.forEach(
    (medication) => {
      const patientId =
        medication.patient_id ??
        null

      const patientCode =
        medication.patient_code ??
        null

      const patientKey =
        patientCode ||
        patientId ||
        medication.patient_name ||
        "UNKNOWN-PATIENT"

      // -----------------------------------------------
      // PATIENT
      // -----------------------------------------------

      if (!patients.has(patientKey)) {
        patients.set(
          patientKey,
          {
            patient_id:
              patientId,

            patient_name:
              medication.patient_name ||
              "Unknown Patient",

            patient_code:
              patientCode ||
              "No patient ID",

            medications:
              new Map(),
          },
        )
      }

      const patient =
        patients.get(
          patientKey,
        )

      // -----------------------------------------------
      // MEDICINE
      // -----------------------------------------------

      const medicineKey =
        medication.prescription_item_id ??
        `${getMedicationName(
          medication,
        )}-${medication.id}`

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

      // -----------------------------------------------
      // STAT
      // -----------------------------------------------

      if (
        Boolean(
          medication.is_stat,
        )
      ) {
        medicine.is_stat = true
      }

      // -----------------------------------------------
      // TIMING
      // -----------------------------------------------

      medicine.schedules.push(
        medication,
      )
    },
  )

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

export default function NurseDashboard() {
  const navigate =
    useNavigate()

  const [
    medications,
    setMedications,
  ] = useState([])

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
  // LOAD DATA
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

      setMedications(
        visible,
      )
    } catch (err) {
      console.error(
        "Failed to load nurse medications:",
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
  // WRAP / EXPAND PATIENT
  // ===================================================

  function togglePatient(
    patientKey,
  ) {
    setCollapsedPatients(
      (previous) => {
        const next =
          new Set(previous)

        if (
          next.has(
            patientKey,
          )
        ) {
          next.delete(
            patientKey,
          )
        } else {
          next.add(
            patientKey,
          )
        }

        return next
      },
    )
  }

  // ===================================================
  // METRICS
  // ===================================================

  const metrics =
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

      const given =
        medications.filter(
          (item) =>
            normalizeStatus(
              item.status,
            ) === "GIVEN",
        ).length

      const upcoming =
        medications.filter(
          (item) =>
            normalizeStatus(
              item.status,
            ) === "UPCOMING",
        ).length

      const delayed =
        medications.filter(
          (item) =>
            normalizeStatus(
              item.status,
            ) === "DELAYED",
        ).length

      const held =
        medications.filter(
          (item) =>
            normalizeStatus(
              item.status,
            ) === "HELD",
        ).length

      const refused =
        medications.filter(
          (item) =>
            normalizeStatus(
              item.status,
            ) === "REFUSED",
        ).length

      const notGiven =
        medications.filter(
          (item) =>
            normalizeStatus(
              item.status,
            ) === "NOT GIVEN",
        ).length

      return {
        uniquePatients,

        totalSchedules:
          medications.length,

        given,

        upcoming,

        delayed,

        held,

        refused,

        notGiven,

        attention:
          delayed +
          held +
          refused +
          notGiven,
      }
    }, [medications])

  // ===================================================
  // PATIENT GROUPS
  // ===================================================

  const patientGroups =
    useMemo(
      () =>
        buildPatientGroups(
          medications,
        ),
      [medications],
    )

  // ===================================================
  // OPEN MEDICATION
  // ===================================================

  function openMedication(
    scheduleId,
  ) {
    navigate(
      `/nurse/medications/${scheduleId}`,
    )
  }

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
              Medication Dashboard
            </h1>

            <p className="mt-2 max-w-3xl text-sm text-slate-500">
              Each patient is shown once.
              Medicines are grouped underneath
              the patient, with all medication
              timings displayed together.
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
            KPI CARDS
        ================================================= */}

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">

          <StatCard
            title="Patients"
            value={
              metrics.uniquePatients
            }
            description="Visible patients"
            icon={
              UserRound
            }
            iconClasses="bg-blue-100 text-blue-700"
          />

          <StatCard
            title="Schedules"
            value={
              metrics.totalSchedules
            }
            description="Individual dose timings"
            icon={Pill}
            iconClasses="bg-purple-100 text-purple-700"
          />

          <StatCard
            title="Upcoming"
            value={
              metrics.upcoming
            }
            description="Waiting for administration"
            icon={Clock3}
            iconClasses="bg-cyan-100 text-cyan-700"
          />

          <StatCard
            title="Given"
            value={
              metrics.given
            }
            description="Successfully administered"
            icon={CheckCircle2}
            iconClasses="bg-green-100 text-green-700"
          />

          <StatCard
            title="Attention"
            value={
              metrics.attention
            }
            description="Delayed, held or refused"
            icon={ShieldAlert}
            iconClasses="bg-orange-100 text-orange-700"
          />

        </div>

        {/* =================================================
            PATIENTS
        ================================================= */}

        <div className="space-y-6">

          {loading ? (

            <div className="flex min-h-[250px] items-center justify-center rounded-2xl border border-slate-200 bg-white">

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

              <Pill
                size={40}
                className="mx-auto text-slate-300"
              />

              <h2 className="mt-4 text-lg font-semibold text-slate-800">
                No medication data
              </h2>

              <p className="mt-2 text-sm text-slate-500">
                No visible patient medication
                schedules are available.
              </p>

            </div>

          ) : (

            patientGroups.map(
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

                    {/* =========================================
                        PATIENT HEADER
                    ========================================= */}

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

                        {/* ACTIONS */}

                        <div className="flex flex-wrap items-center gap-3">

                          {/* MEDICINES */}

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

                          {/* SCHEDULES */}

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

                          {/* WRAP UP */}

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

                    {/* =========================================
                        MEDICATION CONTENT

                        Hidden when wrapped up
                    ========================================= */}

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

                                    {/* MEDICINE INFO */}

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
                                    medicine.schedules.length
                                  }{" "}

                                  timing
                                  {
                                    medicine.schedules.length !==
                                    1
                                      ? "s"
                                      : ""
                                  }

                                </span>

                              </div>

                              {/* =================================
                                  ALL TIMINGS
                              ================================= */}

                              <div className="mt-5 space-y-3">

                                {medicine.schedules.map(
                                  (schedule) => (

                                    <ScheduleRow
                                      key={
                                        schedule.id
                                      }
                                      medication={
                                        schedule
                                      }
                                      onOpen={
                                        openMedication
                                      }
                                    />

                                  ),
                                )}

                              </div>

                            </div>

                          ),
                        )}

                      </div>

                    )}

                  </section>
                )
              },
            )

          )}

        </div>

        {/* =================================================
            QUICK ACTIONS
        ================================================= */}

        <div className="grid gap-4 md:grid-cols-2">

          <button
            type="button"
            onClick={() =>
              navigate(
                "/nurse/medications",
              )
            }
            className="rounded-2xl border border-slate-200 bg-white p-5 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
          >

            <div className="flex items-center justify-between">

              <div>

                <p className="text-lg font-bold text-slate-900">
                  Medication Management
                </p>

                <p className="mt-1 text-sm text-slate-500">
                  View all patients and their
                  grouped medication schedules.
                </p>

              </div>

              <ChevronRight
                size={22}
                className="text-slate-400"
              />

            </div>

          </button>

          <button
            type="button"
            onClick={() =>
              navigate(
                "/nurse/qr-scanner",
              )
            }
            className="rounded-2xl border border-slate-200 bg-white p-5 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
          >

            <div className="flex items-center justify-between">

              <div>

                <p className="text-lg font-bold text-slate-900">
                  QR Verification
                </p>

                <p className="mt-1 text-sm text-slate-500">
                  Verify patient and medication
                  before administration.
                </p>

              </div>

              <ChevronRight
                size={22}
                className="text-slate-400"
              />

            </div>

          </button>

        </div>

        {/* =================================================
            STATUS SUMMARY
        ================================================= */}

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">

          <h2 className="text-lg font-bold text-slate-900">
            Status Summary
          </h2>

          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">

            <div className="rounded-xl bg-green-50 p-4">

              <p className="text-xs font-semibold uppercase tracking-wide text-green-600">
                Given
              </p>

              <p className="mt-1 text-2xl font-bold text-green-800">
                {metrics.given}
              </p>

            </div>

            <div className="rounded-xl bg-blue-50 p-4">

              <p className="text-xs font-semibold uppercase tracking-wide text-blue-600">
                Upcoming
              </p>

              <p className="mt-1 text-2xl font-bold text-blue-800">
                {metrics.upcoming}
              </p>

            </div>

            <div className="rounded-xl bg-orange-50 p-4">

              <p className="text-xs font-semibold uppercase tracking-wide text-orange-600">
                Delayed
              </p>

              <p className="mt-1 text-2xl font-bold text-orange-800">
                {metrics.delayed}
              </p>

            </div>

            <div className="rounded-xl bg-red-50 p-4">

              <p className="text-xs font-semibold uppercase tracking-wide text-red-600">
                Refused / Not Given
              </p>

              <p className="mt-1 text-2xl font-bold text-red-800">
                {metrics.refused +
                  metrics.notGiven}
              </p>

            </div>

          </div>

        </div>

      </div>

    </MainLayout>
  )
}