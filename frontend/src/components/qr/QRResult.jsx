import {
  CheckCircle2,
  QrCode,
  XCircle,
} from "lucide-react"


export default function QRResult({
  result,
  onContinue,
}) {
  if (!result) {
    return null
  }

  const valid = result.valid


  return (
    <div
      className={[
        "rounded-3xl border p-6",
        valid
          ? "border-emerald-200 bg-emerald-50"
          : "border-red-200 bg-red-50",
      ].join(" ")}
    >

      <div className="flex items-start gap-4">

        <div
          className={[
            "rounded-xl p-3",
            valid
              ? "bg-emerald-100"
              : "bg-red-100",
          ].join(" ")}
        >
          {valid ? (
            <CheckCircle2 className="h-6 w-6 text-emerald-600" />
          ) : (
            <XCircle className="h-6 w-6 text-red-600" />
          )}
        </div>


        <div className="min-w-0 flex-1">

          <div className="flex items-center gap-2">

            <QrCode
              className={[
                "h-4 w-4",
                valid
                  ? "text-emerald-600"
                  : "text-red-600",
              ].join(" ")}
            />

            <h2
              className={[
                "font-semibold",
                valid
                  ? "text-emerald-900"
                  : "text-red-900",
              ].join(" ")}
            >
              {valid
                ? "Patient Verified"
                : "QR Verification Failed"}
            </h2>

          </div>


          <p
            className={[
              "mt-2 text-sm",
              valid
                ? "text-emerald-700"
                : "text-red-700",
            ].join(" ")}
          >
            {result.message}
          </p>


          {valid &&
            result.patient_id && (
              <p className="mt-3 text-sm font-semibold text-emerald-800">
                Patient ID: {result.patient_id}
              </p>
            )}


          {valid && onContinue && (
            <button
              type="button"
              onClick={onContinue}
              className="mt-5 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700"
            >
              Continue to Medication Verification
            </button>
          )}

        </div>

      </div>

    </div>
  )
}