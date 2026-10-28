import {
  useEffect,
  useMemo,
  useState,
} from "react"

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

import {
  useNavigate,
} from "react-router-dom"

import MainLayout from "../../components/layout/MainLayout"

import {
  getNurseMedications,
} from "../../services/medications"

import {
  hideTestPatients,
} from "../../utils/patientFilter"


// =========================================================
// DATE FORMAT
// =========================================================

function formatDate(
  dateString,
) {
  if (!dateString) {
    return "—"
  }

  const date =
    new Date(
      `${dateString}T00:00:00`,
    )

  if (
    Number.isNaN(
      date.getTime(),
    )
  ) {
    return dateString
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
// TIME FORMAT
// =========================================================

function formatTime(
  timeString,
) {
  if (!timeString) {
    return "—"
  }

  const [
    hour,
    minute,
  ] =
    String(timeString)
      .slice(0, 5)
      .split(":")
      .map(Number)

  if (
    Number.isNaN(hour) ||
    Number.isNaN(minute)
  ) {
    return timeString
  }

  const date =
    new Date()

  date.setHours(
    hour,
    minute,
    0,
    0,
  )

  return new Intl.DateTimeFormat(
    "en-IN",
    {
      hour: "2-digit",
      minute: "2-digit",
    },
  ).format(date)
}


// =========================================================
// STATUS
// =========================================================

function normalizeStatus(
  status,
) {
  return String(
    status || "",
  )
    .trim()
    .toUpperCase()
    .replace(
      /_/g,
      " ",
    )
}


function getStatusClasses(
  status,
) {
  switch (
    normalizeStatus(
      status,
    )
  ) {
    case "GIVEN":
      return "border-emerald-200 bg-emerald-50 text-emerald-700"

    case "DELAYED":
      return "border-amber-200 bg-amber-50 text-amber-700"

    case "HELD":
      return "border-orange-200 bg-orange-50 text-orange-700"

    case "REFUSED":
      return "border-red-200 bg-red-50 text-red-700"

    case "NOT GIVEN":
      return "border-rose-200 bg-rose-50 text-rose-700"

    case "UPCOMING":
    default:
      return "border-blue-200 bg-blue-50 text-blue-700"
  }
}


function getStatusIcon(
  status,
) {
  switch (
    normalizeStatus(
      status,
    )
  ) {
    case "GIVEN":
      return CheckCircle2

    case "DELAYED":
      return Clock3

    case "HELD":
      return AlertTriangle

    case "REFUSED":
    case "NOT GIVEN":
      return XCircle

    case "UPCOMING":
    default:
      return CalendarClock
  }
}


// =========================================================
// MEDICINE HELPERS
// =========================================================

function getMedicationName(
  medication,
) {
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


function getFrequency(
  medication,
) {
  return (
    medication.frequency ??
    medication.dosage_frequency ??
    medication.frequency_label ??
    "Scheduled medication"
  )
}


function getDosage(
  medication,
) {
  return (
    medication.dosage ??
    medication.dose ??
    medication.dose_amount ??
    null
  )
}


function getRoute(
  medication,
) {
  return (
    medication.route ??
    medication.administration_route ??
    null
  )
}


// =========================================================
// GROUP MEDICATIONS BY PATIENT
//
// Patient
//   -> Medicine
//       -> Schedule timings
// =========================================================

function buildPatientGroups(
  medications,
) {
  const patients =
    new Map()


  medications.forEach(
    (
      medication,
    ) => {
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


      // ---------------------------------------------------
      // Create patient
      // ---------------------------------------------------

      if (
        !patients.has(
          patientKey,
        )
      ) {
        patients.set(
          patientKey,
          {
            patient_id:
              patientId,

            patient_code:
              patientCode ||
              "No patient ID",

            patient_name:
              medication.patient_name ||
              "Unknown Patient",

            medications:
              new Map(),
          },
        )
      }


      const patient =
        patients.get(
          patientKey,
        )


      // ---------------------------------------------------
      // Medicine key
      // ---------------------------------------------------

      const medicineKey =
        medication.prescription_item_id ??
        `${getMedicationName(
          medication,
        )}-${medication.id}`


      // ---------------------------------------------------
      // Create medicine
      // ---------------------------------------------------

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


      // ---------------------------------------------------
      // STAT at medicine level
      // ---------------------------------------------------

      if (
        Boolean(
          medication.is_stat,
        )
      ) {
        medicine.is_stat = true
      }


      // ---------------------------------------------------
      // Add schedule
      // ---------------------------------------------------

      medicine.schedules.push(
        medication,
      )
    },
  )


  return Array.from(
    patients.values(),
  ).map(
    (
      patient,
    ) => ({
      ...patient,

      medications:
        Array.from(
          patient.medications.values(),
        ),
    }),
  )
}


// =========================================================
// STAT CARD
// =========================================================

function StatCard({
  title,
  value,
  description,
  icon: Icon,
  iconClasses =
    "bg-slate-100 text-slate-600",
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
// SCHEDULE ROW
// =========================================================

function ScheduleRow({
  schedule,
  onOpen,
}) {
  const StatusIcon =
    getStatusIcon(
      schedule.status,
    )

  const status =
    normalizeStatus(
      schedule.status,
    )

  const hasAdministration =
    Boolean(
      schedule.actual_administration_time,
    )


  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">

      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">


        {/* =================================================
            SCHEDULE INFORMATION
        ================================================= */}

        <div className="grid min-w-0 gap-3 sm:grid-cols-2 lg:flex lg:flex-wrap lg:items-center lg:gap-x-7 lg:gap-y-2">

          {/* TIME */}

          <div>

            <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
              Time
            </p>

            <div className="mt-1 flex items-center gap-2 text-sm font-semibold text-slate-800">

              <Clock3
                className="h-4 w-4 text-slate-400"
              />

              {formatTime(
                schedule.scheduled_time,
              )}

            </div>

          </div>


          {/* DATE */}

          <div>

            <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
              Date
            </p>

            <div className="mt-1 flex items-center gap-2 text-sm font-medium text-slate-700">

              <CalendarClock
                className="h-4 w-4 text-slate-400"
              />

              {formatDate(
                schedule.scheduled_date,
              )}

            </div>

          </div>


          {/* STATUS */}

          <div>

            <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
              Status
            </p>

            <span
              className={[
                "mt-1 inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold",
                getStatusClasses(
                  schedule.status,
                ),
              ].join(" ")}
            >

              <StatusIcon className="h-3.5 w-3.5" />

              {
                status ||
                "UNKNOWN"
              }

            </span>

          </div>


          {/* SCHEDULE ID */}

          <div>

            <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
              Schedule
            </p>

            <p className="mt-1 text-sm font-semibold text-slate-700">
              #{schedule.id}
            </p>

          </div>


          {/* PRESCRIPTION ITEM */}

          <div>

            <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
              Prescription Item
            </p>

            <p className="mt-1 text-sm font-semibold text-slate-700">
              #{schedule.prescription_item_id}
            </p>

          </div>

        </div>


        {/* =================================================
            ADMINISTRATION / ACTION
        ================================================= */}

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center lg:shrink-0">

          {hasAdministration && (

            <div className="rounded-xl bg-emerald-50 px-3 py-2">

              <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-600">
                Administered
              </p>

              <p className="mt-1 text-xs font-semibold text-emerald-800">
                {new Date(
                  schedule.actual_administration_time,
                ).toLocaleString(
                  "en-IN",
                  {
                    dateStyle:
                      "medium",
                    timeStyle:
                      "short",
                  },
                )}
              </p>

            </div>

          )}


          <button
            type="button"
            onClick={() =>
              onOpen(
                schedule.id,
              )
            }
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800 sm:w-auto"
          >

            Open

            <ChevronRight
              className="h-4 w-4"
            />

          </button>

        </div>

      </div>


      {/* =================================================
          STATUS MESSAGE
      ================================================= */}

      <div className="mt-3">

        {status === "UPCOMING" && (

          <span className="inline-flex rounded-lg bg-blue-50 px-2.5 py-1.5 text-xs font-medium text-blue-700">
            Ready for medication workflow
          </span>

        )}

        {status === "GIVEN" && (

          <span className="inline-flex rounded-lg bg-emerald-50 px-2.5 py-1.5 text-xs font-medium text-emerald-700">
            Administration recorded
          </span>

        )}

        {status === "DELAYED" && (

          <span className="inline-flex rounded-lg bg-amber-50 px-2.5 py-1.5 text-xs font-medium text-amber-700">
            Attention required
          </span>

        )}

        {(status === "REFUSED" ||
          status === "NOT GIVEN") && (

          <span className="inline-flex rounded-lg bg-red-50 px-2.5 py-1.5 text-xs font-medium text-red-700">
            Medication outcome requires review
          </span>

        )}

      </div>

    </div>
  )
}


// =========================================================
// MEDICINE CARD
// =========================================================

function MedicineCard({
  medicine,
  onOpen,
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5">

      {/* =================================================
          MEDICINE HEADER
      ================================================= */}

      <div className="flex min-w-0 flex-col gap-3 md:flex-row md:items-start md:justify-between">

        <div className="flex min-w-0 items-start gap-3">

          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-purple-50 text-purple-700">

            <Pill
              className="h-5 w-5"
            />

          </div>


          <div className="min-w-0">

            <div className="flex flex-wrap items-center gap-2">

              <h3 className="break-words text-base font-bold text-slate-900 sm:text-lg">
                {
                  medicine.medicine_name
                }
              </h3>


              {medicine.is_stat && (

                <span className="rounded-full border border-red-200 bg-red-50 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-red-700">
                  STAT
                </span>

              )}

            </div>


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


        <span className="self-start rounded-full bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-600">

          {medicine.schedules.length}{" "}
          {medicine.schedules.length === 1
            ? "timing"
            : "timings"}

        </span>

      </div>


      {/* =================================================
          SCHEDULES
      ================================================= */}

      <div className="mt-4 space-y-3">

        {medicine.schedules.map(
          (
            schedule,
          ) => (

            <ScheduleRow
              key={
                schedule.id
              }
              schedule={
                schedule
              }
              onOpen={
                onOpen
              }
            />

          ),
        )}

      </div>

    </div>
  )
}


// =========================================================
// MAIN DASHBOARD
// =========================================================

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


  // =======================================================
  // PATIENT COLLAPSE STATE
  // =======================================================

  const [
    collapsedPatients,
    setCollapsedPatients,
  ] = useState(
    new Set(),
  )


  // =======================================================
  // LOAD DATA
  // =======================================================

  async function loadMedications() {
    setLoading(true)
    setError("")

    try {
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


      // ===================================================
      // COLLAPSE ALL PATIENTS BY DEFAULT
      // ===================================================

      const patientKeys =
        new Set(
          visible.map(
            (item) =>
              item.patient_code ??
              item.patient_id ??
              item.patient_name ??
              "UNKNOWN-PATIENT",
          ),
        )


      setCollapsedPatients(
        patientKeys,
      )

    } catch (
      requestError
    ) {
      console.error(
        "Failed to load nurse dashboard:",
        requestError,
      )

      setError(
        requestError?.response
          ?.data?.detail ||
          requestError?.message ||
          "Unable to load medication schedules.",
      )

      setMedications([])

    } finally {
      setLoading(false)
    }
  }


  // =======================================================
  // INITIAL LOAD
  // =======================================================

  useEffect(
    () => {
      loadMedications()
    },
    [],
  )


  // =======================================================
  // TOGGLE PATIENT
  // =======================================================

  function togglePatient(
    patientKey,
  ) {
    setCollapsedPatients(
      (
        previous,
      ) => {
        const next =
          new Set(
            previous,
          )


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


  // =======================================================
  // PATIENT GROUPS
  // =======================================================

  const patientGroups =
    useMemo(
      () =>
        buildPatientGroups(
          medications,
        ),
      [
        medications,
      ],
    )


  // =======================================================
  // METRICS
  // =======================================================

  const metrics =
    useMemo(
      () => {
        const total =
          medications.length


        const given =
          medications.filter(
            (item) =>
              normalizeStatus(
                item.status,
              ) === "GIVEN",
          ).length


        const delayed =
          medications.filter(
            (item) =>
              normalizeStatus(
                item.status,
              ) === "DELAYED",
          ).length


        const upcoming =
          medications.filter(
            (item) =>
              normalizeStatus(
                item.status,
              ) === "UPCOMING",
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


        const uniquePatients =
          new Set(
            medications.map(
              (item) =>
                item.patient_code ??
                item.patient_id ??
                item.patient_name,
            ),
          ).size


        return {
          total,
          given,
          delayed,
          upcoming,
          held,
          refused,
          notGiven,
          uniquePatients,
        }
      },
      [
        medications,
      ],
    )


  // =======================================================
  // OPEN MEDICATION
  // =======================================================

  function openMedication(
    scheduleId,
  ) {
    navigate(
      `/nurse/medications/${scheduleId}`,
    )
  }


  // =======================================================
  // RETURN
  // =======================================================

  return (
    <MainLayout title="Nurse Dashboard">

      <div className="w-full min-w-0 space-y-6 sm:space-y-8">


        {/* =================================================
            HEADER
        ================================================= */}

        <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">

          <div className="flex min-w-0 flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">

            <div className="min-w-0">

              <p className="text-sm font-semibold text-cyan-600">
                Medication Operations
              </p>


              <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
                Nurse Dashboard
              </h1>


              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
                Monitor medication schedules by patient.
                Patient records are collapsed by default so
                you can quickly locate the patient you need.
              </p>

            </div>


            <button
              type="button"
              onClick={
                loadMedications
              }
              disabled={
                loading
              }
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
            >

              <RefreshCw
                className={[
                  "h-4 w-4",
                  loading
                    ? "animate-spin"
                    : "",
                ].join(" ")}
              />

              Refresh

            </button>

          </div>

        </section>


        {/* =================================================
            ERROR
        ================================================= */}

        {error && (

          <div className="rounded-2xl border border-red-200 bg-red-50 p-4">

            <div className="flex items-start gap-3">

              <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-red-600" />


              <div className="min-w-0">

                <p className="text-sm font-semibold text-red-900">
                  Unable to load medication schedules
                </p>


                <p className="mt-1 text-sm leading-6 text-red-700">
                  {error}
                </p>

              </div>

            </div>

          </div>

        )}


        {/* =================================================
            STATISTICS
        ================================================= */}

        <section>

          <div className="mb-4">

            <h2 className="text-lg font-semibold text-slate-900 sm:text-xl">
              Medication Overview
            </h2>


            <p className="mt-1 text-sm text-slate-500">
              Current medication schedule status
            </p>

          </div>


          <div className="grid grid-cols-2 gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-3 xl:grid-cols-5">


            <StatCard
              title="Patients"
              value={
                metrics.uniquePatients
              }
              description="Patients in your queue"
              icon={
                UserRound
              }
              iconClasses="bg-blue-50 text-blue-600"
            />


            <StatCard
              title="Schedules"
              value={
                metrics.total
              }
              description="Medication schedules"
              icon={
                Pill
              }
              iconClasses="bg-cyan-50 text-cyan-600"
            />


            <StatCard
              title="Upcoming"
              value={
                metrics.upcoming
              }
              description="Awaiting administration"
              icon={
                CalendarClock
              }
              iconClasses="bg-blue-50 text-blue-600"
            />


            <StatCard
              title="Given"
              value={
                metrics.given
              }
              description="Administration recorded"
              icon={
                CheckCircle2
              }
              iconClasses="bg-emerald-50 text-emerald-600"
            />


            <StatCard
              title="Attention"
              value={
                metrics.delayed +
                metrics.held +
                metrics.refused +
                metrics.notGiven
              }
              description="Delayed, held or refused"
              icon={
                ShieldAlert
              }
              iconClasses="bg-amber-50 text-amber-600"
            />

          </div>

        </section>


        {/* =================================================
            PATIENT QUEUE
        ================================================= */}

        <section>

          <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">

            <div>

              <h2 className="text-lg font-semibold text-slate-900 sm:text-xl">
                Patient Queue
              </h2>


              <p className="mt-1 text-sm leading-6 text-slate-500">
                Patients are collapsed by default.
                Expand a patient to view medicines and
                scheduled doses.
              </p>

            </div>


            {!loading &&
              patientGroups.length >
                0 && (

              <span className="w-fit rounded-full bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-600">

                {
                  patientGroups.length
                }{" "}

                {patientGroups.length ===
                1
                  ? "patient"
                  : "patients"}

              </span>

            )}

          </div>


          {/* =================================================
              LOADING
          ================================================= */}

          {loading ? (

            <div className="rounded-3xl border border-slate-200 bg-white p-10 text-center shadow-sm sm:p-14">

              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-cyan-50">

                <LoaderCircle className="h-7 w-7 animate-spin text-cyan-600" />

              </div>


              <p className="mt-4 text-sm font-semibold text-slate-800">
                Loading medication schedules...
              </p>


              <p className="mt-1 text-xs text-slate-500">
                Fetching the latest clinical medication queue.
              </p>

            </div>

          ) : patientGroups.length ===
            0 ? (

            <div className="rounded-3xl border border-dashed border-slate-300 bg-white p-10 text-center shadow-sm sm:p-14">

              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100">

                <Pill className="h-7 w-7 text-slate-300" />

              </div>


              <h3 className="mt-4 font-semibold text-slate-800">
                No medication schedules found
              </h3>


              <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-500">
                There are currently no medication schedules
                available for this nurse.
              </p>

            </div>

          ) : (

            <div className="space-y-3">


              {patientGroups.map(
                (
                  patient,
                ) => {

                  const patientKey =
                    patient.patient_code ||
                    patient.patient_id ||
                    patient.patient_name ||
                    "UNKNOWN-PATIENT"


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


                  const patientStatuses =
                    patient.medications.flatMap(
                      (
                        medicine,
                      ) =>
                        medicine.schedules.map(
                          (
                            schedule,
                          ) =>
                            normalizeStatus(
                              schedule.status,
                            ),
                        ),
                    )


                  const attentionCount =
                    patientStatuses.filter(
                      (
                        status,
                      ) =>
                        status ===
                          "DELAYED" ||
                        status ===
                          "HELD" ||
                        status ===
                          "REFUSED" ||
                        status ===
                          "NOT GIVEN",
                    ).length


                  const givenCount =
                    patientStatuses.filter(
                      (
                        status,
                      ) =>
                        status ===
                        "GIVEN",
                    ).length


                  return (

                    <section
                      key={
                        patientKey
                      }
                      className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"
                    >


                      {/* =================================================
                          PATIENT HEADER
                      ================================================= */}

                      <div className="bg-slate-50 p-4 sm:p-5">

                        <div className="flex min-w-0 flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">


                          {/* PATIENT INFO */}

                          <div className="flex min-w-0 items-center gap-4">

                            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-blue-100 text-blue-700">

                              <UserRound
                                size={24}
                              />

                            </div>


                            <div className="min-w-0">

                              <h2 className="truncate text-lg font-bold text-slate-900 sm:text-xl">
                                {
                                  patient.patient_name
                                }
                              </h2>


                              <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm text-slate-500">

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
                                    Record ID:{" "}

                                    <strong className="text-slate-700">
                                      #
                                      {
                                        patient.patient_id
                                      }
                                    </strong>
                                  </span>

                                )}

                              </div>

                            </div>

                          </div>


                          {/* PATIENT CONTROLS */}

                          <div className="flex flex-wrap items-center gap-2 sm:gap-3">


                            {/* MEDICINES */}

                            <div className="min-w-[95px] rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-center">

                              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                                Medicines
                              </p>


                              <p className="mt-1 text-xl font-bold text-slate-900">
                                {
                                  patient.medications.length
                                }
                              </p>

                            </div>


                            {/* SCHEDULES */}

                            <div className="min-w-[95px] rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-center">

                              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                                Schedules
                              </p>


                              <p className="mt-1 text-xl font-bold text-slate-900">
                                {
                                  totalSchedules
                                }
                              </p>

                            </div>


                            {/* GIVEN */}

                            <div className="min-w-[80px] rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-center">

                              <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-600">
                                Given
                              </p>


                              <p className="mt-1 text-xl font-bold text-emerald-700">
                                {
                                  givenCount
                                }
                              </p>

                            </div>


                            {/* ATTENTION */}

                            {attentionCount >
                              0 && (

                              <div className="min-w-[90px] rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-center">

                                <p className="text-[10px] font-bold uppercase tracking-wider text-amber-600">
                                  Attention
                                </p>


                                <p className="mt-1 text-xl font-bold text-amber-700">
                                  {
                                    attentionCount
                                  }
                                </p>

                              </div>

                            )}


                            {/* EXPAND / WRAP */}

                            <button
                              type="button"
                              onClick={() =>
                                togglePatient(
                                  patientKey,
                                )
                              }
                              aria-expanded={
                                !isCollapsed
                              }
                              className={[
                                "inline-flex min-w-[120px] items-center justify-center gap-2 rounded-xl border px-4 py-3 text-sm font-semibold transition",
                                isCollapsed
                                  ? "border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100"
                                  : "border-slate-300 bg-white text-slate-700 hover:bg-slate-100",
                              ].join(" ")}
                            >

                              {isCollapsed ? (
                                <>
                                  Expand

                                  <ChevronDown
                                    size={
                                      18
                                    }
                                  />

                                </>
                              ) : (
                                <>
                                  Wrap Up

                                  <ChevronRight
                                    size={
                                      18
                                    }
                                  />

                                </>
                              )}

                            </button>

                          </div>

                        </div>

                      </div>


                      {/* =================================================
                          PATIENT CONTENT
                      ================================================= */}

                      {!isCollapsed && (

                        <div className="border-t border-slate-200 bg-white p-4 sm:p-5">

                          <div className="space-y-4">

                            {patient.medications.map(
                              (
                                medicine,
                                index,
                              ) => (

                                <MedicineCard
                                  key={`${patientKey}-${medicine.medicine_name}-${index}`}
                                  medicine={
                                    medicine
                                  }
                                  onOpen={
                                    openMedication
                                  }
                                />

                              ),
                            )}

                          </div>

                        </div>

                      )}

                    </section>

                  )
                },
              )}

            </div>

          )}

        </section>


        {/* =================================================
            ADMINISTRATION SUMMARY
        ================================================= */}

        <section className="grid gap-5 lg:grid-cols-2">


          {/* =================================================
              ADMINISTRATION SUMMARY
          ================================================= */}

          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">

            <div>

              <h2 className="text-lg font-semibold text-slate-900">
                Administration Summary
              </h2>


              <p className="mt-1 text-sm text-slate-500">
                Current medication status distribution
              </p>

            </div>


            <div className="mt-6 space-y-4">

              {[
                {
                  label:
                    "Given",
                  value:
                    metrics.given,
                  className:
                    "bg-emerald-500",
                },

                {
                  label:
                    "Upcoming",
                  value:
                    metrics.upcoming,
                  className:
                    "bg-blue-500",
                },

                {
                  label:
                    "Delayed",
                  value:
                    metrics.delayed,
                  className:
                    "bg-amber-500",
                },

                {
                  label:
                    "Held",
                  value:
                    metrics.held,
                  className:
                    "bg-orange-500",
                },

                {
                  label:
                    "Refused",
                  value:
                    metrics.refused,
                  className:
                    "bg-red-500",
                },

                {
                  label:
                    "Not Given",
                  value:
                    metrics.notGiven,
                  className:
                    "bg-rose-500",
                },
              ].map(
                (
                  item,
                ) => {

                  const percentage =
                    metrics.total >
                    0
                      ? (
                          (
                            item.value /
                            metrics.total
                          ) *
                          100
                        )
                      : 0


                  return (

                    <div
                      key={
                        item.label
                      }
                    >

                      <div className="mb-1.5 flex items-center justify-between gap-3 text-sm">

                        <span className="font-medium text-slate-700">
                          {
                            item.label
                          }
                        </span>


                        <span className="shrink-0 font-semibold text-slate-500">

                          {
                            item.value
                          }

                          {" · "}

                          {
                            percentage.toFixed(
                              0,
                            )
                          }
                          %

                        </span>

                      </div>


                      <div className="h-2.5 overflow-hidden rounded-full bg-slate-100">

                        <div
                          className={[
                            "h-full rounded-full transition-all duration-500",
                            item.className,
                          ].join(" ")}
                          style={{
                            width: `${percentage}%`,
                          }}
                        />

                      </div>

                    </div>

                  )
                },
              )}

            </div>

          </div>


          {/* =================================================
              QUICK ACTIONS
          ================================================= */}

          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">

            <div>

              <h2 className="text-lg font-semibold text-slate-900">
                Quick Actions
              </h2>


              <p className="mt-1 text-sm text-slate-500">
                Continue the medication workflow
              </p>

            </div>


            <div className="mt-6 grid gap-3 sm:grid-cols-2">


              {/* MEDICATIONS */}

              <button
                type="button"
                onClick={() =>
                  navigate(
                    "/nurse/medications",
                  )
                }
                className="rounded-2xl border border-slate-200 p-4 text-left transition hover:border-cyan-300 hover:bg-cyan-50"
              >

                <Pill className="h-5 w-5 text-cyan-600" />


                <p className="mt-3 font-semibold text-slate-800">
                  View medications
                </p>


                <p className="mt-1 text-xs leading-5 text-slate-500">
                  Open the full medication queue and details.
                </p>

              </button>


              {/* QR */}

              <button
                type="button"
                onClick={() =>
                  navigate(
                    "/nurse/qr",
                  )
                }
                className="rounded-2xl border border-slate-200 p-4 text-left transition hover:border-violet-300 hover:bg-violet-50"
              >

                <CalendarClock className="h-5 w-5 text-violet-600" />


                <p className="mt-3 font-semibold text-slate-800">
                  QR verification
                </p>


                <p className="mt-1 text-xs leading-5 text-slate-500">
                  Verify patient and medication before administration.
                </p>

              </button>


              {/* AI */}

              <button
                type="button"
                onClick={() =>
                  navigate(
                    "/nurse/ai",
                  )
                }
                className="rounded-2xl border border-slate-200 p-4 text-left transition hover:border-indigo-300 hover:bg-indigo-50"
              >

                <ShieldAlert className="h-5 w-5 text-indigo-600" />


                <p className="mt-3 font-semibold text-slate-800">
                  AI Risk
                </p>


                <p className="mt-1 text-xs leading-5 text-slate-500">
                  Review medication risk predictions.
                </p>

              </button>


              {/* REFRESH */}

              <button
                type="button"
                onClick={
                  loadMedications
                }
                disabled={
                  loading
                }
                className="rounded-2xl border border-slate-200 p-4 text-left transition hover:border-emerald-300 hover:bg-emerald-50 disabled:cursor-not-allowed disabled:opacity-50"
              >

                <RefreshCw
                  className={[
                    "h-5 w-5 text-emerald-600",
                    loading
                      ? "animate-spin"
                      : "",
                  ].join(" ")}
                />


                <p className="mt-3 font-semibold text-slate-800">
                  Refresh data
                </p>


                <p className="mt-1 text-xs leading-5 text-slate-500">
                  Fetch the latest medication schedules.
                </p>

              </button>

            </div>

          </div>

        </section>


        {/* =================================================
            INFORMATION
        ================================================= */}

        <div className="rounded-2xl border border-blue-100 bg-blue-50 p-5">

          <div className="flex items-start gap-3">

            <UserRound
              size={21}
              className="mt-0.5 shrink-0 text-blue-600"
            />


            <div>

              <h3 className="font-semibold text-blue-900">
                Patient-focused dashboard
              </h3>


              <p className="mt-1 text-sm leading-6 text-blue-800">
                Patients are collapsed by default to keep the
                dashboard compact. Expand only the patient
                you are currently handling, then use Wrap Up
                when finished.
              </p>

            </div>

          </div>

        </div>


      </div>

    </MainLayout>
  )
}