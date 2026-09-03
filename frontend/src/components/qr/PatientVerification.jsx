import {
  useCallback,
  useState,
} from "react"

import {
  Camera,
  CheckCircle2,
  FlaskConical,
  LoaderCircle,
  RotateCcw,
  ShieldCheck,
  Smartphone,
} from "lucide-react"

import QRCodeScanner from "./QRCodeScanner"
import QRResult from "./QRResult"

import {
  verifyPatientQR,
} from "../../services/qr"


// =========================================================
// DEVELOPMENT TEST QR
// =========================================================
//
// Keep this while developing locally.
// Remove it before production deployment.
//

const TEST_PATIENT_QR_TOKEN =
  "WxKSvxEBOgK6C9UNgbV8-duneJK_cM09-FIvpTSHnjw"


// =========================================================
// MAIN COMPONENT
// =========================================================

export default function PatientVerification({
  onVerified,
}) {
  const [
    result,
    setResult,
  ] = useState(null)


  const [
    verifying,
    setVerifying,
  ] = useState(false)


  const [
    scannerMode,
    setScannerMode,
  ] = useState(true)


  // =======================================================
  // VERIFY TOKEN
  // =======================================================

  const verifyToken =
    useCallback(
      async (
        qrToken,
      ) => {
        if (!qrToken) {
          return
        }


        setVerifying(true)
        setResult(null)


        try {
          const response =
            await verifyPatientQR(
              qrToken,
            )


          setResult(
            response,
          )


          if (
            response.valid &&
            response.patient_id
          ) {
            onVerified?.(
              response.patient_id,
              response,
            )
          }

        } catch (
          requestError
        ) {
          setResult({
            valid: false,
            patient_id: null,
            message:
              requestError?.response?.data
                ?.detail ||
              requestError?.message ||
              "Unable to verify patient QR.",
          })

        } finally {
          setVerifying(false)
        }
      },
      [
        onVerified,
      ],
    )


  // =======================================================
  // TEST PATIENT
  // =======================================================

  async function useTestPatient() {
    setScannerMode(false)

    await verifyToken(
      TEST_PATIENT_QR_TOKEN,
    )
  }


  // =======================================================
  // USE CAMERA
  // =======================================================

  function useCamera() {
    setResult(null)
    setScannerMode(true)
  }


  // =======================================================
  // RESET
  // =======================================================

  function resetVerification() {
    setResult(null)
    setVerifying(false)
    setScannerMode(true)
  }


  // =======================================================
  // UI
  // =======================================================

  return (
    <div className="space-y-5">

      {/* =================================================
          HEADER
      ================================================= */}

      <div className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5">

        <div className="flex items-start gap-3">

          <div className="shrink-0 rounded-xl bg-cyan-50 p-3">

            <ShieldCheck className="h-5 w-5 text-cyan-600" />

          </div>


          <div className="min-w-0">

            <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-cyan-600">
              Identity Verification
            </p>


            <h2 className="mt-1 text-base font-bold text-slate-900 sm:text-lg">
              Verify Patient
            </h2>


            <p className="mt-1 text-sm leading-5 text-slate-500">
              Scan the patient's QR code before medication administration.
            </p>

          </div>

        </div>

      </div>


      {/* =================================================
          CAMERA MODE
      ================================================= */}

      {scannerMode &&
        !result &&
        !verifying && (

        <section className="overflow-hidden rounded-3xl border border-slate-200 bg-slate-950 shadow-sm">

          {/* Scanner heading */}

          <div className="p-4 sm:p-5">

            <div className="flex items-center justify-between gap-3">

              <div className="flex items-center gap-3">

                <div className="rounded-xl bg-cyan-500/10 p-2.5">

                  <Camera className="h-5 w-5 text-cyan-400" />

                </div>


                <div>

                  <p className="text-sm font-semibold text-white">
                    Scan QR Code
                  </p>

                  <p className="text-xs text-slate-400">
                    Position the code inside the scanner.
                  </p>

                </div>

              </div>


              <div className="flex items-center gap-1.5 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-1.5">

                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />

                <span className="text-[10px] font-bold uppercase tracking-wide text-emerald-400">
                  Camera
                </span>

              </div>

            </div>

          </div>


          {/* Actual scanner */}

          <div className="bg-black px-2 pb-2 sm:px-4 sm:pb-4">

            <div className="mx-auto w-full max-w-md overflow-hidden rounded-2xl">

              <QRCodeScanner
                onScanSuccess={
                  (decodedText) =>
                    verifyToken(
                      decodedText,
                    )
                }
              />

            </div>

          </div>


          {/* Camera instructions */}

          <div className="border-t border-slate-800 p-4 sm:p-5">

            <div className="grid gap-3 sm:grid-cols-3">

              <Instruction
                number="1"
                title="Allow camera"
                description="Grant camera access when your browser asks."
              />


              <Instruction
                number="2"
                title="Align QR"
                description="Keep the QR code centered and visible."
              />


              <Instruction
                number="3"
                title="Hold steady"
                description="Wait for automatic detection."
              />

            </div>

          </div>

        </section>
      )}


      {/* =================================================
          CAMERA / DEVICE TIP
      ================================================= */}

      {scannerMode &&
        !result &&
        !verifying && (

        <div className="rounded-2xl border border-cyan-100 bg-cyan-50/70 p-4">

          <div className="flex items-start gap-3">

            <Smartphone className="mt-0.5 h-5 w-5 shrink-0 text-cyan-700" />


            <div>

              <p className="text-xs font-bold uppercase tracking-wider text-cyan-700">
                Phone scanning
              </p>


              <p className="mt-1 text-sm leading-5 text-cyan-900">
                On a phone, use the rear camera and hold the QR code
                approximately 15–30 cm from the camera until it is detected.
              </p>

            </div>

          </div>

        </div>
      )}


      {/* =================================================
          DEVELOPMENT TEST
      ================================================= */}

      {!result &&
        !verifying && (

        <section className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-4 sm:p-5">

          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">

            <div className="flex items-start gap-3">

              <div className="shrink-0 rounded-xl bg-white p-2.5 shadow-sm">

                <FlaskConical className="h-5 w-5 text-slate-500" />

              </div>


              <div>

                <p className="text-sm font-semibold text-slate-800">
                  Development testing
                </p>


                <p className="mt-1 text-xs leading-5 text-slate-500">
                  No physical patient QR is required while testing locally.
                </p>

              </div>

            </div>


            <button
              type="button"
              onClick={
                useTestPatient
              }
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:border-cyan-300 hover:bg-cyan-50 hover:text-cyan-700 sm:w-auto"
            >

              <FlaskConical className="h-4 w-4" />

              Use Test Patient

            </button>

          </div>

        </section>
      )}


      {/* =================================================
          VERIFYING
      ================================================= */}

      {verifying && (

        <section className="rounded-3xl border border-indigo-100 bg-indigo-50 p-5 shadow-sm sm:p-6">

          <div className="flex items-center gap-4">

            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-indigo-100">

              <LoaderCircle className="h-6 w-6 animate-spin text-indigo-600" />

            </div>


            <div>

              <p className="font-semibold text-indigo-900">
                Verifying patient QR...
              </p>


              <p className="mt-1 text-sm leading-5 text-indigo-700">
                Checking the scanned token against the patient records.
              </p>

            </div>

          </div>

        </section>
      )}


      {/* =================================================
          RESULT
      ================================================= */}

      {result && (

        <section>

          <QRResult
            result={
              result
            }
            onContinue={
              result.valid
                ? () =>
                    onVerified?.(
                      result.patient_id,
                      result,
                    )
                : undefined
            }
          />


          {/* Successful verification */}

          {result.valid && (

            <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-4">

              <div className="flex items-start gap-3">

                <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />


                <div>

                  <p className="text-sm font-semibold text-emerald-900">
                    Patient identity confirmed
                  </p>


                  <p className="mt-1 text-sm leading-5 text-emerald-700">
                    Continue to medication verification.
                  </p>

                </div>

              </div>

            </div>
          )}


          {/* Failed verification */}

          {!result.valid && (

            <div className="mt-4 grid gap-2 sm:flex">

              <button
                type="button"
                onClick={
                  useCamera
                }
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 sm:w-auto"
              >

                <RotateCcw className="h-4 w-4" />

                Scan Again

              </button>


              <button
                type="button"
                onClick={
                  resetVerification
                }
                className="inline-flex w-full items-center justify-center rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50 sm:w-auto"
              >
                Reset
              </button>

            </div>
          )}

        </section>
      )}

    </div>
  )
}


// =========================================================
// INSTRUCTION
// =========================================================

function Instruction({
  number,
  title,
  description,
}) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/80 p-3">

      <div className="flex items-center gap-2">

        <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-slate-800 text-[10px] font-bold text-cyan-400">
          {number}
        </span>


        <p className="text-xs font-semibold text-slate-200">
          {title}
        </p>

      </div>


      <p className="mt-2 text-[11px] leading-5 text-slate-400">
        {description}
      </p>

    </div>
  )
}