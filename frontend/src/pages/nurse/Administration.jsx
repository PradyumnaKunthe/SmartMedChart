import {
  ArrowLeft,
  CheckCircle2,
  LoaderCircle,
  Pill,
  ShieldCheck,
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

import AdministrationActions from "../../components/nurse/AdministrationActions"

import {
  getMedicationSchedule,
} from "../../services/medications"

import {
  predictMedicationRisk,
} from "../../services/ai"

import {
  checkMedicationSafety,
} from "../../services/safety"


function statusClasses(status) {
  switch (status) {
    case "GIVEN":
      return "bg-emerald-50 text-emerald-700 border-emerald-200"

    case "DELAYED":
      return "bg-amber-50 text-amber-700 border-amber-200"

    case "HELD":
      return "bg-orange-50 text-orange-700 border-orange-200"

    case "REFUSED":
      return "bg-red-50 text-red-700 border-red-200"

    case "NOT_GIVEN":
      return "bg-rose-50 text-rose-700 border-rose-200"

    default:
      return "bg-blue-50 text-blue-700 border-blue-200"
  }
}


export default function Administration() {
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
    prediction,
    setPrediction,
  ] = useState(null)

  const [
    safety,
    setSafety,
  ] = useState(null)

  const [
    loading,
    setLoading,
  ] = useState(true)

  const [
    error,
    setError,
  ] = useState("")

  const [
    success,
    setSuccess,
  ] = useState(null)


  useEffect(() => {
    async function loadAdministrationData() {
      setLoading(true)
      setError("")

      try {
        const medicationData =
          await getMedicationSchedule(
            scheduleId,
          )

        setMedication(
          medicationData,
        )

        const [
          aiResponse,
          safetyResponse,
        ] = await Promise.all([
          predictMedicationRisk(
            Number(scheduleId),
          ),
          checkMedicationSafety(
            Number(scheduleId),
          ),
        ])

        setPrediction(
          aiResponse.prediction,
        )

        setSafety(
          safetyResponse,
        )

      } catch (requestError) {
        setError(
          requestError?.response?.data
            ?.detail ||
            "Unable to prepare medication administration.",
        )
      } finally {
        setLoading(false)
      }
    }

    if (scheduleId) {
      loadAdministrationData()
    }
  }, [scheduleId])


  function handleAdministrationSuccess(
    result,
  ) {
    setSuccess(result)

    setMedication(
      (previous) => ({
        ...previous,
        status: result.status,
        actual_administration_time:
          result.administered_at,
        administered_by:
          result.administered_by,
      }),
    )
  }


  if (loading) {
    return (
      <MainLayout title="Administration">

        <div className="flex min-h-[60vh] items-center justify-center">

          <div className="text-center">

            <LoaderCircle className="mx-auto h-9 w-9 animate-spin text-cyan-500" />

            <p className="mt-4 text-sm text-slate-500">
              Preparing administration workflow...
            </p>

          </div>

        </div>

      </MainLayout>
    )
  }


  if (error || !medication) {
    return (
      <MainLayout title="Administration">

        <div className="mx-auto max-w-2xl">

          <button
            type="button"
            onClick={() =>
              navigate(
                `/nurse/medications/${scheduleId}`,
              )
            }
            className="mb-5 inline-flex items-center gap-2 text-sm font-semibold text-slate-600 hover:text-slate-900"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to medication
          </button>


          <div className="rounded-2xl border border-red-200 bg-red-50 p-6">

            <h2 className="font-semibold text-red-900">
              Administration unavailable
            </h2>

            <p className="mt-2 text-sm leading-6 text-red-700">
              {error ||
                "Medication schedule not found."}
            </p>

          </div>

        </div>

      </MainLayout>
    )
  }


  const alreadyAdministered =
    [
      "GIVEN",
      "DELAYED",
      "HELD",
      "REFUSED",
      "NOT_GIVEN",
    ].includes(
      medication.status,
    )


  return (
    <MainLayout title="Administration">

      <div className="mx-auto max-w-5xl space-y-6">

        {/* Back */}

        <button
          type="button"
          onClick={() =>
            navigate(
              `/nurse/medications/${scheduleId}`,
            )
          }
          className="inline-flex items-center gap-2 text-sm font-semibold text-slate-600 hover:text-slate-900"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to medication
        </button>


        {/* Header */}

        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">

          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">

            <div className="flex items-center gap-4">

              <div className="rounded-2xl bg-cyan-50 p-4">
                <Pill className="h-7 w-7 text-cyan-600" />
              </div>

              <div>

                <p className="text-sm font-semibold text-cyan-600">
                  Medication Administration
                </p>

                <h1 className="mt-1 text-2xl font-bold text-slate-900">
                  Schedule #{medication.id}
                </h1>

                <p className="mt-1 text-sm text-slate-500">
                  Prescription Item #
                  {medication.prescription_item_id}
                </p>

              </div>

            </div>


            <span
              className={[
                "w-fit rounded-full border px-3 py-1.5 text-sm font-semibold",
                statusClasses(
                  medication.status,
                ),
              ].join(" ")}
            >
              {medication.status}
            </span>

          </div>

        </div>


        {/* Success */}

        {success && (
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5">

            <div className="flex items-start gap-3">

              <div className="rounded-xl bg-emerald-100 p-3">
                <CheckCircle2 className="h-5 w-5 text-emerald-600" />
              </div>

              <div>

                <p className="font-semibold text-emerald-900">
                  Administration recorded successfully
                </p>

                <p className="mt-1 text-sm text-emerald-700">
                  Schedule #{success.schedule_id}
                  {" "}
                  is now marked as{" "}
                  <strong>
                    {success.status}
                  </strong>.
                </p>

              </div>

            </div>

          </div>
        )}


        {/* Safety summary */}

        {safety && (
          <div
            className={[
              "rounded-3xl border p-6",
              safety.safe
                ? "border-emerald-200 bg-emerald-50"
                : "border-red-200 bg-red-50",
            ].join(" ")}
          >

            <div className="flex items-start gap-4">

              <div
                className={[
                  "rounded-xl p-3",
                  safety.safe
                    ? "bg-emerald-100"
                    : "bg-red-100",
                ].join(" ")}
              >
                <ShieldCheck
                  className={[
                    "h-6 w-6",
                    safety.safe
                      ? "text-emerald-600"
                      : "text-red-600",
                  ].join(" ")}
                />
              </div>


              <div className="flex-1">

                <p
                  className={[
                    "text-sm font-semibold",
                    safety.safe
                      ? "text-emerald-700"
                      : "text-red-700",
                  ].join(" ")}
                >
                  Medication Safety
                </p>

                <h2
                  className={[
                    "mt-1 text-xl font-bold",
                    safety.safe
                      ? "text-emerald-900"
                      : "text-red-900",
                  ].join(" ")}
                >
                  {safety.safe
                    ? "No safety conflicts detected"
                    : "Safety review required"}
                </h2>

                <p
                  className={[
                    "mt-2 text-sm leading-6",
                    safety.safe
                      ? "text-emerald-700"
                      : "text-red-700",
                  ].join(" ")}
                >
                  {safety.message}
                </p>


                {!safety.safe &&
                  safety.warnings?.length > 0 && (
                    <div className="mt-4 space-y-2">

                      {safety.warnings.map(
                        (warning, index) => (
                          <div
                            key={`${warning.type}-${index}`}
                            className="rounded-xl bg-white/70 p-3"
                          >
                            <p className="text-sm font-semibold text-red-900">
                              {warning.message}
                            </p>

                            <p className="mt-1 text-xs leading-5 text-red-700">
                              {warning.reason}
                            </p>
                          </div>
                        ),
                      )}

                    </div>
                  )}

              </div>

            </div>

          </div>
        )}


        {/* AI summary */}

        {prediction && (
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">

            <div className="flex items-center justify-between">

              <div>
                <p className="text-sm font-semibold text-slate-700">
                  AI Risk Summary
                </p>

                <p className="mt-1 text-sm text-slate-500">
                  Decision-support information for this dose.
                </p>
              </div>

              <div className="flex gap-2">

                <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
                  Delay{" "}
                  {(
                    prediction.delay_probability *
                    100
                  ).toFixed(1)}
                  %
                </span>

                <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
                  Missed{" "}
                  {(
                    prediction.missed_probability *
                    100
                  ).toFixed(1)}
                  %
                </span>

              </div>

            </div>

          </div>
        )}


        {/* Administration actions */}

        {alreadyAdministered ? (
          <div className="rounded-3xl border border-slate-200 bg-slate-50 p-6">

            <div className="flex items-start gap-3">

              <CheckCircle2 className="mt-0.5 h-5 w-5 text-slate-500" />

              <div>

                <h2 className="font-semibold text-slate-800">
                  Administration already recorded
                </h2>

                <p className="mt-1 text-sm leading-6 text-slate-500">
                  This scheduled dose has already been
                  assigned an administration outcome and
                  cannot be recorded again.
                </p>

              </div>

            </div>

          </div>
        ) : !safety?.safe ? (
          <div className="rounded-3xl border border-red-200 bg-red-50 p-6">

            <div className="flex items-start gap-3">

              <ShieldCheck className="mt-0.5 h-5 w-5 text-red-600" />

              <div>

                <h2 className="font-semibold text-red-900">
                  Administration blocked
                </h2>

                <p className="mt-1 text-sm leading-6 text-red-700">
                  The Safety Engine returned a warning.
                  Resolve the safety issue through the
                  appropriate clinical workflow before
                  recording administration.
                </p>

              </div>

            </div>

          </div>
        ) : (
          <AdministrationActions
            scheduleId={scheduleId}
            onSuccess={
              handleAdministrationSuccess
            }
          />
        )}

      </div>

    </MainLayout>
  )
}