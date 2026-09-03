import { useEffect, useState } from "react"

import {
  ArrowLeft,
  BrainCircuit,
  CheckCircle2,
  LoaderCircle,
  Pill,
  ShieldCheck,
} from "lucide-react"

import {
  useNavigate,
  useSearchParams,
} from "react-router-dom"

import MainLayout from "../../components/layout/MainLayout"

import AIRiskCard from "../../components/ai/AIRiskCard"

import {
  getMedicationSchedule,
} from "../../services/medications"

import {
  predictMedicationRisk,
} from "../../services/ai"


export default function NurseAI() {
  const navigate = useNavigate()

  const [searchParams] =
    useSearchParams()

  const scheduleId =
    searchParams.get("schedule")


  const [medication, setMedication] =
    useState(null)

  const [prediction, setPrediction] =
    useState(null)

  const [loading, setLoading] =
    useState(true)

  const [aiLoading, setAiLoading] =
    useState(false)

  const [error, setError] =
    useState("")


  useEffect(() => {
    async function loadAI() {
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
        const medicationData =
          await getMedicationSchedule(
            scheduleId,
          )

        setMedication(
          medicationData,
        )

        setAiLoading(true)

        const aiResponse =
          await predictMedicationRisk(
            Number(scheduleId),
          )

        setPrediction(
          aiResponse.prediction,
        )
      } catch (requestError) {
        setError(
          requestError?.response?.data
            ?.detail ||
            "Unable to generate AI risk assessment.",
        )
      } finally {
        setLoading(false)
        setAiLoading(false)
      }
    }

    loadAI()
  }, [scheduleId])


  if (loading) {
    return (
      <MainLayout title="AI Risk">

        <div className="flex min-h-[60vh] items-center justify-center">

          <div className="text-center">

            <LoaderCircle className="mx-auto h-9 w-9 animate-spin text-cyan-500" />

            <p className="mt-4 text-sm text-slate-500">
              Preparing AI risk assessment...
            </p>

          </div>

        </div>

      </MainLayout>
    )
  }


  return (
    <MainLayout title="AI Risk">

      <div className="mx-auto max-w-5xl space-y-6">

        {/* Back */}

        <button
          type="button"
          onClick={() =>
            navigate(
              scheduleId
                ? `/nurse/medications/${scheduleId}`
                : "/nurse/medications",
            )
          }
          className="inline-flex items-center gap-2 text-sm font-semibold text-slate-600 hover:text-slate-900"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to medication
        </button>


        {/* Header */}

        <div>

          <div className="flex items-center gap-3">

            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-cyan-50">
              <BrainCircuit className="h-6 w-6 text-cyan-600" />
            </div>

            <div>

              <p className="text-sm font-semibold text-cyan-600">
                Clinical Decision Support
              </p>

              <h1 className="text-3xl font-bold tracking-tight text-slate-900">
                AI Risk Assessment
              </h1>

            </div>

          </div>

          <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-500">
            Review AI-generated medication delay and
            missed-dose risk before administration.
          </p>

        </div>


        {/* Schedule */}

        {medication && (
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">

            <div className="flex items-center gap-4">

              <div className="rounded-xl bg-indigo-50 p-3">
                <Pill className="h-5 w-5 text-indigo-600" />
              </div>

              <div>

                <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                  Medication Schedule
                </p>

                <h2 className="mt-1 font-semibold text-slate-900">
                  Schedule #{medication.id}
                </h2>

                <p className="mt-1 text-sm text-slate-500">
                  Prescription Item #
                  {" "}
                  {medication.prescription_item_id}
                </p>

              </div>

              <div className="ml-auto">

                <span className="rounded-full border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-700">
                  {medication.status}
                </span>

              </div>

            </div>

          </div>
        )}


        {/* Error */}

        {error && (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-5">

            <p className="font-semibold text-red-900">
              AI assessment unavailable
            </p>

            <p className="mt-1 text-sm text-red-700">
              {error}
            </p>

          </div>
        )}


        {/* AI */}

        {!error && (
          <AIRiskCard
            prediction={prediction}
            loading={aiLoading}
          />
        )}


        {/* Clinical notice */}

        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">

          <div className="flex items-start gap-3">

            <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-slate-500" />

            <div>

              <p className="font-semibold text-slate-800">
                AI is decision support
              </p>

              <p className="mt-1 text-sm leading-6 text-slate-600">
                The AI prediction highlights potential
                medication-delay and missed-dose risks.
                Authorized clinical staff make the final
                medication decision.

              </p>

            </div>

          </div>

        </div>


        {/* Continue */}

        {prediction && (
          <div className="flex flex-col gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-5 sm:flex-row sm:items-center sm:justify-between">

            <div className="flex items-center gap-3">

              <div className="rounded-xl bg-emerald-100 p-3">
                <CheckCircle2 className="h-5 w-5 text-emerald-600" />
              </div>

              <div>

                <p className="font-semibold text-emerald-900">
                  AI assessment complete
                </p>

                <p className="text-sm text-emerald-700">
                  Continue to medication safety and
                  administration.
                </p>

              </div>

            </div>


            <button
              type="button"
              onClick={() =>
                navigate(
  `/nurse/medications/${scheduleId}/administration`,
)
              }
              className="rounded-xl bg-emerald-600 px-5 py-3 text-sm font-semibold text-white hover:bg-emerald-700"
            >
              Continue
            </button>

          </div>
        )}

      </div>

    </MainLayout>
  )
}