import {
  useEffect,
  useState,
} from "react"

import {
  useNavigate,
  useParams,
} from "react-router-dom"

import {
  AlertTriangle,
  ArrowLeft,
  CalendarClock,
  CheckCircle2,
  ChevronRight,
  Clock3,
  LoaderCircle,
  Pill,
  ShieldCheck,
  UserCheck,
} from "lucide-react"

import MainLayout from "../../components/layout/MainLayout"

import {
  getMedicationSchedule,
} from "../../services/medications"


// =========================================================
// DATE
// =========================================================

function formatDate(
  dateString,
) {
  if (!dateString) {
    return "—"
  }

  const date = new Date(
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
      month: "long",
      year: "numeric",
    },
  ).format(date)
}


// =========================================================
// TIME
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
  ] = timeString.split(":")

  const date = new Date()

  date.setHours(
    Number(hour),
    Number(minute),
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

function getStatusClasses(
  status,
) {
  switch (
    String(
      status || "",
    ).toUpperCase()
  ) {
    case "GIVEN":
      return "border-emerald-200 bg-emerald-50 text-emerald-700"

    case "DELAYED":
      return "border-amber-200 bg-amber-50 text-amber-700"

    case "HELD":
      return "border-orange-200 bg-orange-50 text-orange-700"

    case "REFUSED":
      return "border-red-200 bg-red-50 text-red-700"

    case "NOT_GIVEN":
      return "border-rose-200 bg-rose-50 text-rose-700"

    case "UPCOMING":
    default:
      return "border-blue-200 bg-blue-50 text-blue-700"
  }
}


// =========================================================
// STATUS TEXT
// =========================================================

function prettyStatus(
  status,
) {
  return String(
    status || "UNKNOWN",
  )
    .toUpperCase()
    .replaceAll(
      "_",
      " ",
    )
}


// =========================================================
// INFORMATION CARD
// =========================================================

function InfoCard({
  icon: Icon,
  label,
  value,
  helper = "",
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">

      <div className="flex items-start gap-3">

        <div className="shrink-0 rounded-xl bg-slate-50 p-2.5">

          <Icon className="h-5 w-5 text-slate-600" />

        </div>


        <div className="min-w-0">

          <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">
            {label}
          </p>


          <p className="mt-1 break-words text-sm font-bold text-slate-900 sm:text-base">
            {value}
          </p>


          {helper && (
            <p className="mt-1 text-xs leading-5 text-slate-500">
              {helper}
            </p>
          )}

        </div>

      </div>

    </div>
  )
}


// =========================================================
// WORKFLOW STEP
// =========================================================

function WorkflowStep({
  number,
  icon: Icon,
  title,
  description,
  active = false,
  completed = false,
}) {
  return (
    <div
      className={[
        "rounded-2xl border p-4 transition",
        completed
          ? "border-emerald-200 bg-emerald-50"
          : active
            ? "border-cyan-200 bg-cyan-50"
            : "border-slate-200 bg-white",
      ].join(" ")}
    >

      <div className="flex items-start gap-3">

        <div
          className={[
            "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-xs font-bold",
            completed
              ? "bg-emerald-600 text-white"
              : active
                ? "bg-cyan-600 text-white"
                : "bg-slate-100 text-slate-500",
          ].join(" ")}
        >
          {completed ? (
            <CheckCircle2 className="h-4 w-4" />
          ) : (
            number
          )}
        </div>


        <div className="min-w-0">

          <p className="text-xs font-bold uppercase tracking-wider text-slate-400">
            Step {number}
          </p>


          <h3 className="mt-1 font-semibold text-slate-900">
            {title}
          </h3>


          <p className="mt-1 text-xs leading-5 text-slate-500">
            {description}
          </p>

        </div>

      </div>

    </div>
  )
}


// =========================================================
// MAIN
// =========================================================

export default function MedicationDetails() {
  const {
    scheduleId,
  } = useParams()


  const navigate =
    useNavigate()


  const [
    medication,
    setMedication,
  ] = useState(null)


  const [
    loading,
    setLoading,
  ] = useState(true)


  const [
    error,
    setError,
  ] = useState("")


  // =======================================================
  // LOAD MEDICATION
  // =======================================================

  useEffect(() => {
    async function loadMedication() {
      setLoading(true)
      setError("")

      try {
        const data =
          await getMedicationSchedule(
            scheduleId,
          )

        setMedication(
          data,
        )

      } catch (
        requestError
      ) {
        setError(
          requestError?.response?.data?.detail ||
            requestError?.message ||
            "Unable to load medication schedule.",
        )
      } finally {
        setLoading(false)
      }
    }


    if (scheduleId) {
      loadMedication()
    }
  }, [
    scheduleId,
  ])


  // =======================================================
  // QR
  // =======================================================

  function openQRVerification() {
    navigate(
      `/nurse/qr?schedule=${scheduleId}`,
    )
  }


  // =======================================================
  // LOADING
  // =======================================================

  if (loading) {
    return (
      <MainLayout title="Medication Details">

        <div className="flex min-h-[65vh] items-center justify-center">

          <div className="text-center">

            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-cyan-50">

              <LoaderCircle className="h-7 w-7 animate-spin text-cyan-600" />

            </div>


            <p className="mt-4 text-sm font-semibold text-slate-800">
              Loading medication schedule...
            </p>


            <p className="mt-1 text-xs text-slate-500">
              Retrieving the latest medication information.
            </p>

          </div>

        </div>

      </MainLayout>
    )
  }


  // =======================================================
  // ERROR
  // =======================================================

  if (
    error ||
    !medication
  ) {
    return (
      <MainLayout title="Medication Details">

        <div className="mx-auto max-w-2xl">

          <button
            type="button"
            onClick={() =>
              navigate(
                "/nurse/medications",
              )
            }
            className="mb-5 inline-flex items-center gap-2 rounded-xl px-1 py-2 text-sm font-semibold text-slate-600 transition hover:text-slate-900"
          >

            <ArrowLeft className="h-4 w-4" />

            Back to medications

          </button>


          <div className="rounded-3xl border border-red-200 bg-red-50 p-6 sm:p-8">

            <div className="flex items-start gap-4">

              <div className="rounded-xl bg-red-100 p-3">

                <AlertTriangle className="h-5 w-5 text-red-600" />

              </div>


              <div>

                <h2 className="font-semibold text-red-900">
                  Medication schedule unavailable
                </h2>


                <p className="mt-2 text-sm leading-6 text-red-700">
                  {error ||
                    "The requested medication schedule could not be found."}
                </p>


                <button
                  type="button"
                  onClick={() =>
                    navigate(
                      "/nurse/medications",
                    )
                  }
                  className="mt-5 rounded-xl bg-red-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-red-700"
                >
                  Return to medications
                </button>

              </div>

            </div>

          </div>

        </div>

      </MainLayout>
    )
  }


  // =======================================================
  // DERIVED VALUES
  // =======================================================

  const status =
    String(
      medication.status ||
        "UNKNOWN",
    ).toUpperCase()


  const alreadyAdministered =
    status === "GIVEN" ||
    Boolean(
      medication.actual_administration_time,
    )


  const isPending =
    status === "UPCOMING"


  const isAttentionRequired =
    status === "DELAYED" ||
    status === "HELD" ||
    status === "REFUSED" ||
    status === "NOT_GIVEN"


  // =======================================================
  // PAGE
  // =======================================================

  return (
    <MainLayout title="Medication Details">

      <div className="mx-auto max-w-6xl space-y-5 sm:space-y-6">

        {/* =================================================
            BACK
        ================================================= */}

        <button
          type="button"
          onClick={() =>
            navigate(
              "/nurse/medications",
            )
          }
          className="inline-flex items-center gap-2 rounded-xl px-1 py-2 text-sm font-semibold text-slate-600 transition hover:text-slate-900"
        >

          <ArrowLeft className="h-4 w-4" />

          Back to medications

        </button>


        {/* =================================================
            MAIN MEDICATION HEADER
        ================================================= */}

        <section className="overflow-hidden rounded-3xl border border-slate-800 bg-slate-950 text-white shadow-lg">

          <div className="p-5 sm:p-6 lg:p-7">

            <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">

              <div className="flex min-w-0 items-center gap-4">

                <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-cyan-500/10">

                  <Pill className="h-7 w-7 text-cyan-400" />

                </div>


                <div className="min-w-0">

                  <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-cyan-400 sm:text-xs">
                    Medication Schedule
                  </p>


                  <h1 className="mt-1 truncate text-2xl font-bold sm:text-3xl">
                    Schedule #{medication.id}
                  </h1>


                  <p className="mt-1 text-xs text-slate-400 sm:text-sm">
                    Prescription Item #
                    {" "}
                    {medication.prescription_item_id}
                  </p>

                </div>

              </div>


              <span
                className={[
                  "inline-flex w-fit items-center rounded-full border px-4 py-2 text-xs font-bold uppercase tracking-wide",
                  status === "GIVEN"
                    ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
                    : status === "DELAYED"
                      ? "border-amber-500/30 bg-amber-500/10 text-amber-400"
                      : status === "HELD"
                        ? "border-orange-500/30 bg-orange-500/10 text-orange-400"
                        : status === "REFUSED" ||
                            status ===
                              "NOT_GIVEN"
                          ? "border-red-500/30 bg-red-500/10 text-red-400"
                          : "border-cyan-500/30 bg-cyan-500/10 text-cyan-400",
                ].join(" ")}
              >
                {prettyStatus(
                  status,
                )}
              </span>

            </div>


            <div className="mt-6 grid gap-3 border-t border-slate-800 pt-5 sm:grid-cols-2">

              <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-3">

                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                  Scheduled Date
                </p>

                <p className="mt-1 text-sm font-semibold text-white">
                  {formatDate(
                    medication.scheduled_date,
                  )}
                </p>

              </div>


              <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-3">

                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                  Scheduled Time
                </p>

                <p className="mt-1 text-sm font-semibold text-white">
                  {formatTime(
                    medication.scheduled_time,
                  )}
                </p>

              </div>

            </div>

          </div>

        </section>


        {/* =================================================
            ATTENTION
        ================================================= */}

        {isAttentionRequired && (
          <section className="rounded-2xl border border-amber-200 bg-amber-50 p-4">

            <div className="flex items-start gap-3">

              <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />


              <div>

                <p className="text-sm font-semibold text-amber-900">
                  Medication status requires attention
                </p>


                <p className="mt-1 text-sm leading-6 text-amber-800">
                  This schedule is currently marked as{" "}
                  <strong>
                    {prettyStatus(
                      status,
                    )}
                  </strong>
                  . Review the medication record before taking further action.
                </p>

              </div>

            </div>

          </section>
        )}


        {/* =================================================
            SCHEDULE INFORMATION
        ================================================= */}

        <section>

          <div className="mb-4">

            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-cyan-600">
              Clinical Data
            </p>


            <h2 className="mt-1 text-lg font-semibold text-slate-900 sm:text-xl">
              Schedule Information
            </h2>

          </div>


          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">

            <InfoCard
              icon={CalendarClock}
              label="Scheduled Date"
              value={formatDate(
                medication.scheduled_date,
              )}
            />


            <InfoCard
              icon={Clock3}
              label="Scheduled Time"
              value={formatTime(
                medication.scheduled_time,
              )}
            />


            <InfoCard
              icon={Pill}
              label="Prescription Item"
              value={`#${medication.prescription_item_id}`}
            />

          </div>

        </section>


        {/* =================================================
            ADMINISTRATION
        ================================================= */}

        <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">

          <div className="flex items-center gap-3">

            <div className="rounded-xl bg-slate-100 p-2.5">

              <CheckCircle2 className="h-5 w-5 text-slate-600" />

            </div>


            <div>

              <h2 className="font-semibold text-slate-900">
                Administration Record
              </h2>


              <p className="text-sm text-slate-500">
                Current medication administration information
              </p>

            </div>

          </div>


          <div className="mt-5 grid gap-3 sm:grid-cols-2">

            <InfoCard
              icon={UserCheck}
              label="Administered By"
              value={
                medication.administered_by ??
                "Not administered"
              }
              helper={
                medication.administered_by
                  ? "Authenticated user ID"
                  : "No administrator recorded"
              }
            />


            <InfoCard
              icon={Clock3}
              label="Administration Time"
              value={
                medication.actual_administration_time
                  ? formatDateTime(
                      medication.actual_administration_time,
                    )
                  : "Not administered"
              }
            />

          </div>


          {medication.notes && (
            <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">

              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Notes
              </p>


              <p className="mt-2 text-sm leading-6 text-slate-700">
                {medication.notes}
              </p>

            </div>
          )}

        </section>


        {/* =================================================
            SAFE ADMINISTRATION WORKFLOW
        ================================================= */}

        <section className="overflow-hidden rounded-3xl border border-cyan-100 bg-gradient-to-br from-cyan-50 via-white to-white shadow-sm">

          <div className="p-5 sm:p-6 lg:p-7">

            <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">

              <div className="flex min-w-0 items-start gap-4">

                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-cyan-100">

                  <ShieldCheck className="h-6 w-6 text-cyan-700" />

                </div>


                <div className="min-w-0">

                  <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-cyan-700">
                    Safe Administration
                  </p>


                  <h2 className="mt-1 text-xl font-bold text-slate-900">
                    Verify before administering
                  </h2>


                  <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
                    Patient identity and medication identity must be verified
                    before administration can proceed.
                  </p>

                </div>

              </div>


              {isPending && (
                <button
                  type="button"
                  onClick={
                    openQRVerification
                  }
                  className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-cyan-600 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-cyan-700 focus:outline-none focus:ring-4 focus:ring-cyan-500/20 sm:w-auto"
                >

                  <ShieldCheck className="h-5 w-5" />

                  Verify Patient & Medication

                  <ChevronRight className="h-4 w-4" />

                </button>
              )}

            </div>


            {/* Already administered */}

            {alreadyAdministered && (
              <div className="mt-5 rounded-2xl border border-emerald-200 bg-emerald-50 p-4">

                <div className="flex items-start gap-3">

                  <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />


                  <div>

                    <p className="font-semibold text-emerald-900">
                      Medication already administered
                    </p>


                    <p className="mt-1 text-sm leading-6 text-emerald-700">
                      This medication schedule has an administration record
                      and does not require another administration.
                    </p>

                  </div>

                </div>

              </div>
            )}


            {/* Workflow */}

            {!alreadyAdministered && (
              <div className="mt-6 grid gap-3 md:grid-cols-3">

                <WorkflowStep
                  number="1"
                  icon={UserCheck}
                  title="Patient QR"
                  description="Scan and verify patient identity."
                  active
                />


                <WorkflowStep
                  number="2"
                  icon={Pill}
                  title="Medication Check"
                  description="Confirm this medication belongs to the verified patient."
                />


                <WorkflowStep
                  number="3"
                  icon={ShieldCheck}
                  title="Risk & Administration"
                  description="Review clinical checks and record the outcome."
                />

              </div>
            )}

          </div>

        </section>

      </div>

    </MainLayout>
  )
}


// =========================================================
// DATE/TIME
// =========================================================

function formatDateTime(
  value,
) {
  if (!value) {
    return "—"
  }

  const date = new Date(
    value,
  )

  if (
    Number.isNaN(
      date.getTime(),
    )
  ) {
    return value
  }

  return new Intl.DateTimeFormat(
    "en-IN",
    {
      dateStyle: "medium",
      timeStyle: "short",
    },
  ).format(date)
}