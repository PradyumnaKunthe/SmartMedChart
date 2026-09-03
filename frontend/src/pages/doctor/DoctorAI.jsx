import {
  AlertTriangle,
  ArrowLeft,
  BrainCircuit,
  CheckCircle2,
  LoaderCircle,
  ShieldCheck,
  TrendingDown,
  TrendingUp,
} from "lucide-react"

import {
  useEffect,
  useState,
} from "react"

import {
  useNavigate,
  useSearchParams,
} from "react-router-dom"

import MainLayout from "../../components/layout/MainLayout"

import {
  predictMedicationRisk,
} from "../../services/ai"

import {
  checkMedicationSafety,
} from "../../services/safety"

import {
  getDoctorPatient,
} from "../../services/doctor"


function riskClasses(level) {
  switch (
    String(level || "").toUpperCase()
  ) {
    case "HIGH":
      return {
        badge:
          "border-red-200 bg-red-50 text-red-700",
        panel:
          "border-red-200 bg-red-50/60",
        text:
          "text-red-900",
      }

    case "MEDIUM":
      return {
        badge:
          "border-amber-200 bg-amber-50 text-amber-700",
        panel:
          "border-amber-200 bg-amber-50/60",
        text:
          "text-amber-900",
      }

    default:
      return {
        badge:
          "border-emerald-200 bg-emerald-50 text-emerald-700",
        panel:
          "border-emerald-200 bg-emerald-50/60",
        text:
          "text-emerald-900",
      }
  }
}


function riskPercent(value) {
  const number =
    Number(value)

  if (!Number.isFinite(number)) {
    return 0
  }

  return Math.max(
    0,
    Math.min(
      100,
      number * 100,
    ),
  )
}


export default function DoctorAI() {
  const navigate =
    useNavigate()

  const [
    searchParams,
  ] = useSearchParams()


  const scheduleId =
    searchParams.get("schedule")

  const patientId =
    searchParams.get("patient")


  const [
    patient,
    setPatient,
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


  useEffect(() => {
    async function loadData() {
      if (!scheduleId) {
        setError(
          "No medication schedule was selected.",
        )

        setLoading(false)
        return
      }


      setLoading(true)
      setError("")


      try {
        const requests = [
          predictMedicationRisk(
            Number(scheduleId),
          ),

          checkMedicationSafety(
            Number(scheduleId),
          ),
        ]


        if (patientId) {
          requests.push(
            getDoctorPatient(
              Number(patientId),
            ),
          )
        }


        const results =
          await Promise.all(
            requests,
          )


        const aiResponse =
          results[0]

        const safetyResponse =
          results[1]

        setPrediction(
          aiResponse?.prediction ||
            null,
        )

        setSafety(
          safetyResponse ||
            null,
        )


        if (patientId) {
          setPatient(
            results[2] ||
              null,
          )
        }

      } catch (requestError) {
        setError(
          requestError?.response?.data?.detail ||
            "Unable to load AI and safety information.",
        )
      } finally {
        setLoading(false)
      }
    }


    loadData()
  }, [
    scheduleId,
    patientId,
  ])


  if (loading) {
    return (
      <MainLayout title="AI & Safety Review">

        <div className="flex min-h-[60vh] items-center justify-center">

          <div className="text-center">

            <LoaderCircle className="mx-auto h-9 w-9 animate-spin text-cyan-500" />

            <p className="mt-4 text-sm text-slate-500">
              Preparing AI and safety review...
            </p>

          </div>

        </div>

      </MainLayout>
    )
  }


  if (error) {
    return (
      <MainLayout title="AI & Safety Review">

        <div className="mx-auto max-w-2xl">

          <button
            type="button"
            onClick={() =>
              patientId
                ? navigate(
                    `/doctor/patients/${patientId}`,
                  )
                : navigate(
                    "/doctor/patients",
                  )
            }
            className="mb-5 inline-flex items-center gap-2 text-sm font-semibold text-slate-600 hover:text-slate-900"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </button>


          <div className="rounded-2xl border border-red-200 bg-red-50 p-6">

            <div className="flex items-start gap-3">

              <AlertTriangle className="mt-0.5 h-5 w-5 text-red-600" />

              <div>

                <h2 className="font-semibold text-red-900">
                  Review unavailable
                </h2>

                <p className="mt-2 text-sm leading-6 text-red-700">
                  {error}
                </p>

              </div>

            </div>

          </div>

        </div>

      </MainLayout>
    )
  }


  const delayRisk =
    riskPercent(
      prediction?.delay_probability,
    )

  const missedRisk =
    riskPercent(
      prediction?.missed_probability,
    )


  const delayStyles =
    riskClasses(
      prediction?.delay_risk_level,
    )

  const missedStyles =
    riskClasses(
      prediction?.missed_risk_level,
    )


  return (
    <MainLayout title="AI & Safety Review">

      <div className="mx-auto max-w-6xl space-y-6">

        {/* Back */}

        <button
          type="button"
          onClick={() =>
            patientId
              ? navigate(
                  `/doctor/patients/${patientId}`,
                )
              : navigate(
                  "/doctor/patients",
                )
          }
          className="inline-flex items-center gap-2 text-sm font-semibold text-slate-600 hover:text-slate-900"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </button>


        {/* Header */}

        <div>

          <div className="flex items-center gap-3">

            <div className="rounded-2xl bg-violet-50 p-4">
              <BrainCircuit className="h-7 w-7 text-violet-600" />
            </div>

            <div>

              <p className="text-sm font-semibold text-violet-600">
                Clinical Decision Support
              </p>

              <h1 className="text-3xl font-bold tracking-tight text-slate-900">
                AI & Safety Review
              </h1>

            </div>

          </div>


          <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-500">
            Review medication safety warnings and AI-generated
            risk information before making a clinical decision.
          </p>

        </div>


        {/* Patient */}

        {patient && (
          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">

            <div className="flex items-center gap-4">

              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-cyan-50 font-bold text-cyan-700">

                {patient.first_name
                  ?.charAt(0)
                  .toUpperCase()}

                {patient.last_name
                  ?.charAt(0)
                  .toUpperCase()}

              </div>


              <div>

                <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                  Patient
                </p>

                <h2 className="mt-1 text-xl font-bold text-slate-900">
                  {patient.first_name}{" "}
                  {patient.last_name}
                </h2>

                <p className="mt-1 text-sm text-slate-500">
                  Patient ID:{" "}
                  {patient.patient_id}
                </p>

              </div>

            </div>

          </div>
        )}


        {/* Safety */}

        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">

          <div className="flex items-start gap-4">

            <div
              className={[
                "rounded-xl p-3",
                safety?.safe
                  ? "bg-emerald-100"
                  : "bg-red-100",
              ].join(" ")}
            >

              {safety?.safe ? (
                <CheckCircle2 className="h-6 w-6 text-emerald-600" />
              ) : (
                <ShieldCheck className="h-6 w-6 text-red-600" />
              )}

            </div>


            <div className="flex-1">

              <p className="text-sm font-semibold text-slate-500">
                Medication Safety
              </p>

              <div className="mt-1 flex flex-wrap items-center gap-3">

                <h2
                  className={[
                    "text-xl font-bold",
                    safety?.safe
                      ? "text-emerald-900"
                      : "text-red-900",
                  ].join(" ")}
                >
                  {safety?.safe
                    ? "No Safety Conflicts Detected"
                    : "Safety Review Required"}
                </h2>


                {safety && (
                  <span
                    className={[
                      "rounded-full border px-3 py-1 text-xs font-bold",
                      safety.safe
                        ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                        : "border-red-200 bg-red-50 text-red-700",
                    ].join(" ")}
                  >
                    {safety.severity}
                  </span>
                )}

              </div>


              <p className="mt-2 text-sm leading-6 text-slate-600">
                {safety?.message}
              </p>


              {safety?.warnings?.length > 0 && (
                <div className="mt-5 space-y-3">

                  {safety.warnings.map(
                    (warning, index) => (
                      <div
                        key={`${warning.type}-${index}`}
                        className="rounded-2xl border border-red-200 bg-red-50 p-4"
                      >

                        <div className="flex items-start gap-3">

                          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-red-600" />

                          <div>

                            <p className="font-semibold text-red-900">
                              {warning.message}
                            </p>

                            <p className="mt-1 text-sm leading-6 text-red-700">
                              {warning.reason}
                            </p>


                            {warning.reaction && (
                              <p className="mt-2 text-xs text-red-700">
                                Recorded reaction:{" "}
                                {warning.reaction}
                              </p>
                            )}

                          </div>

                        </div>

                      </div>
                    ),
                  )}

                </div>
              )}

            </div>

          </div>

        </section>


        {/* AI */}

        <section>

          <div className="mb-4">

            <div className="flex items-center gap-3">

              <BrainCircuit className="h-5 w-5 text-violet-600" />

              <div>

                <h2 className="text-xl font-semibold text-slate-900">
                  AI Risk Assessment
                </h2>

                <p className="mt-1 text-sm text-slate-500">
                  Estimated risk for this medication schedule.
                </p>

              </div>

            </div>

          </div>


          <div className="grid gap-5 lg:grid-cols-2">

            {/* Delay */}

            <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">

              <div className="flex items-start justify-between">

                <div>

                  <p className="text-sm font-semibold text-slate-500">
                    Delay Risk
                  </p>

                  <p className="mt-2 text-4xl font-bold text-slate-900">
                    {delayRisk.toFixed(1)}%
                  </p>

                </div>


                <div className="rounded-xl bg-violet-50 p-3">

                  {delayRisk >= 50 ? (
                    <TrendingUp className="h-5 w-5 text-violet-600" />
                  ) : (
                    <TrendingDown className="h-5 w-5 text-violet-600" />
                  )}

                </div>

              </div>


              <div className="mt-5 h-3 overflow-hidden rounded-full bg-slate-100">

                <div
                  className="h-full rounded-full bg-violet-500 transition-all"
                  style={{
                    width: `${delayRisk}%`,
                  }}
                />

              </div>


              <div className="mt-4">

                <span
                  className={[
                    "rounded-full border px-3 py-1 text-xs font-bold",
                    delayStyles.badge,
                  ].join(" ")}
                >
                  {
                    prediction?.delay_risk_level ||
                    "UNKNOWN"
                  }
                </span>

                <p className="mt-3 text-sm text-slate-600">
                  {
                    prediction?.delay_prediction ||
                    "No prediction available."
                  }
                </p>

              </div>


              {prediction?.delay_reasons?.length > 0 && (
                <div className="mt-5">

                  <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                    Contributing factors
                  </p>

                  <div className="mt-3 space-y-2">

                    {prediction.delay_reasons.map(
                      (reason, index) => (
                        <div
                          key={index}
                          className="rounded-xl bg-slate-50 px-3 py-2 text-sm text-slate-600"
                        >
                          {reason}
                        </div>
                      ),
                    )}

                  </div>

                </div>
              )}

            </div>


            {/* Missed */}

            <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">

              <div className="flex items-start justify-between">

                <div>

                  <p className="text-sm font-semibold text-slate-500">
                    Missed-Dose Risk
                  </p>

                  <p className="mt-2 text-4xl font-bold text-slate-900">
                    {missedRisk.toFixed(1)}%
                  </p>

                </div>


                <div className="rounded-xl bg-indigo-50 p-3">

                  {missedRisk >= 50 ? (
                    <TrendingUp className="h-5 w-5 text-indigo-600" />
                  ) : (
                    <TrendingDown className="h-5 w-5 text-indigo-600" />
                  )}

                </div>

              </div>


              <div className="mt-5 h-3 overflow-hidden rounded-full bg-slate-100">

                <div
                  className="h-full rounded-full bg-indigo-500 transition-all"
                  style={{
                    width: `${missedRisk}%`,
                  }}
                />

              </div>


              <div className="mt-4">

                <span
                  className={[
                    "rounded-full border px-3 py-1 text-xs font-bold",
                    missedStyles.badge,
                  ].join(" ")}
                >
                  {
                    prediction?.missed_risk_level ||
                    "UNKNOWN"
                  }
                </span>

                <p className="mt-3 text-sm text-slate-600">
                  {
                    prediction?.missed_prediction ||
                    "No prediction available."
                  }
                </p>

              </div>


              {prediction?.missed_reasons?.length > 0 && (
                <div className="mt-5">

                  <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                    Contributing factors
                  </p>

                  <div className="mt-3 space-y-2">

                    {prediction.missed_reasons.map(
                      (reason, index) => (
                        <div
                          key={index}
                          className="rounded-xl bg-slate-50 px-3 py-2 text-sm text-slate-600"
                        >
                          {reason}
                        </div>
                      ),
                    )}

                  </div>

                </div>
              )}

            </div>

          </div>

        </section>


        {/* Clinical note */}

        <div className="rounded-2xl border border-violet-100 bg-violet-50 p-5">

          <div className="flex items-start gap-3">

            <BrainCircuit className="mt-0.5 h-5 w-5 shrink-0 text-violet-600" />

            <div>

              <p className="font-semibold text-violet-900">
                Decision-support notice
              </p>

              <p className="mt-1 text-sm leading-6 text-violet-700">
                AI risk scores and automated safety checks are
                decision-support information. Clinical decisions
                remain with the authorized healthcare professional.
              </p>

            </div>

          </div>

        </div>


      </div>

    </MainLayout>
  )
}