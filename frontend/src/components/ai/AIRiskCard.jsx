import {
  AlertTriangle,
  BrainCircuit,
  CheckCircle2,
  Clock3,
  Info,
  LoaderCircle,
  ShieldAlert,
} from "lucide-react"


function getRiskClasses(level) {
  switch (level) {
    case "HIGH":
      return {
        container:
          "border-red-200 bg-red-50",
        icon:
          "bg-red-100 text-red-600",
        title:
          "text-red-900",
        value:
          "text-red-700",
      }

    case "MEDIUM":
      return {
        container:
          "border-amber-200 bg-amber-50",
        icon:
          "bg-amber-100 text-amber-600",
        title:
          "text-amber-900",
        value:
          "text-amber-700",
      }

    case "LOW":
    default:
      return {
        container:
          "border-emerald-200 bg-emerald-50",
        icon:
          "bg-emerald-100 text-emerald-600",
        title:
          "text-emerald-900",
        value:
          "text-emerald-700",
      }
  }
}


function RiskBadge({ level }) {
  const classes =
    getRiskClasses(level)

  return (
    <span
      className={[
        "rounded-full border px-3 py-1 text-xs font-bold",
        classes.container,
        classes.value,
      ].join(" ")}
    >
      {level || "UNKNOWN"}
    </span>
  )
}


function RiskPanel({
  title,
  probability,
  level,
  prediction,
  reasons,
}) {
  const classes =
    getRiskClasses(level)

  const percentage =
    typeof probability === "number"
      ? (probability * 100).toFixed(2)
      : "0.00"

  const Icon =
    level === "HIGH"
      ? ShieldAlert
      : level === "MEDIUM"
        ? AlertTriangle
        : CheckCircle2

  return (
    <div
      className={[
        "rounded-2xl border p-5",
        classes.container,
      ].join(" ")}
    >

      <div className="flex items-start justify-between gap-4">

        <div className="flex items-center gap-3">

          <div
            className={[
              "rounded-xl p-3",
              classes.icon,
            ].join(" ")}
          >
            <Icon className="h-5 w-5" />
          </div>

          <div>
            <p className="text-sm font-medium text-slate-500">
              {title}
            </p>

            <p
              className={[
                "mt-1 text-2xl font-bold",
                classes.value,
              ].join(" ")}
            >
              {percentage}%
            </p>
          </div>

        </div>

        <RiskBadge level={level} />

      </div>


      <div className="mt-4 rounded-xl bg-white/70 p-3">

        <p className="text-sm font-semibold text-slate-800">
          {prediction || "Prediction unavailable"}
        </p>

      </div>


      <div className="mt-5">

        <div className="mb-3 flex items-center gap-2">

          <Info className="h-4 w-4 text-slate-500" />

          <p className="text-sm font-semibold text-slate-700">
            Why?
          </p>

        </div>


        {Array.isArray(reasons) &&
        reasons.length > 0 ? (
          <div className="space-y-2">

            {reasons.map(
              (reason, index) => (
                <div
                  key={`${reason}-${index}`}
                  className="flex gap-2"
                >

                  <span
                    className={[
                      "mt-2 h-1.5 w-1.5 shrink-0 rounded-full",
                      level === "HIGH"
                        ? "bg-red-500"
                        : level === "MEDIUM"
                          ? "bg-amber-500"
                          : "bg-emerald-500",
                    ].join(" ")}
                  />

                  <p className="text-sm leading-6 text-slate-600">
                    {reason}
                  </p>

                </div>
              ),
            )}

          </div>
        ) : (
          <p className="text-sm text-slate-500">
            No contributing factors were reported.
          </p>
        )}

      </div>

    </div>
  )
}


export default function AIRiskCard({
  prediction,
  loading = false,
  error = "",
}) {
  if (loading) {
    return (
      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">

        <div className="flex items-center gap-3">

          <div className="rounded-xl bg-cyan-50 p-3">
            <BrainCircuit className="h-5 w-5 text-cyan-600" />
          </div>

          <div>
            <h2 className="font-semibold text-slate-900">
              AI Risk Assessment
            </h2>

            <p className="text-sm text-slate-500">
              Analyzing medication risk...
            </p>
          </div>

        </div>


        <div className="mt-8 flex items-center justify-center py-8">

          <div className="text-center">

            <LoaderCircle className="mx-auto h-8 w-8 animate-spin text-cyan-500" />

            <p className="mt-3 text-sm text-slate-500">
              Generating AI prediction...
            </p>

          </div>

        </div>

      </div>
    )
  }


  if (error) {
    return (
      <div className="rounded-3xl border border-red-200 bg-red-50 p-6">

        <div className="flex items-start gap-3">

          <AlertTriangle className="mt-0.5 h-5 w-5 text-red-600" />

          <div>

            <h2 className="font-semibold text-red-900">
              AI assessment unavailable
            </h2>

            <p className="mt-1 text-sm leading-6 text-red-700">
              {error}
            </p>

          </div>

        </div>

      </div>
    )
  }


  if (!prediction) {
    return null
  }


  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">

        <div className="flex items-center gap-3">

          <div className="rounded-xl bg-cyan-50 p-3">
            <BrainCircuit className="h-5 w-5 text-cyan-600" />
          </div>

          <div>
            <p className="text-sm font-semibold text-cyan-600">
              AI Safety Support
            </p>

            <h2 className="text-xl font-bold text-slate-900">
              Medication Risk Assessment
            </h2>

            <p className="mt-1 text-sm text-slate-500">
              AI provides risk signals to support
              medication workflow review.
            </p>
          </div>

        </div>


        <div className="inline-flex items-center gap-2 rounded-xl bg-slate-50 px-3 py-2">

          <Clock3 className="h-4 w-4 text-slate-400" />

          <span className="text-xs font-medium text-slate-500">
            Prediction generated
          </span>

        </div>

      </div>


      <div className="mt-6 grid gap-5 lg:grid-cols-2">

        <RiskPanel
          title="Delay Risk"
          probability={
            prediction.delay_probability
          }
          level={
            prediction.delay_risk_level
          }
          prediction={
            prediction.delay_prediction
          }
          reasons={
            prediction.delay_reasons
          }
        />


        <RiskPanel
          title="Missed-Dose Risk"
          probability={
            prediction.missed_probability
          }
          level={
            prediction.missed_risk_level
          }
          prediction={
            prediction.missed_prediction
          }
          reasons={
            prediction.missed_reasons
          }
        />

      </div>


      <div className="mt-5 flex items-start gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4">

        <Info className="mt-0.5 h-5 w-5 shrink-0 text-slate-500" />

        <p className="text-xs leading-5 text-slate-600">
          AI output is decision support. Authorized
          clinical staff remain responsible for the final
          medication decision.
        </p>

      </div>

    </div>
  )
}