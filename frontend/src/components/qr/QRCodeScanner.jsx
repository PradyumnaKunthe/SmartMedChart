import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react"

import {
  Camera,
  CheckCircle2,
  RefreshCw,
  ScanLine,
  Smartphone,
} from "lucide-react"

import {
  Html5Qrcode,
  Html5QrcodeSupportedFormats,
} from "html5-qrcode"


export default function QRCodeScanner({
  onScanSuccess,
}) {
  const scannerRef =
    useRef(null)

  const mountedRef =
    useRef(true)

  const scanningRef =
    useRef(false)

  const scanHandledRef =
    useRef(false)


  const [
    status,
    setStatus,
  ] = useState("starting")


  const [
    error,
    setError,
  ] = useState("")


  // =======================================================
  // STOP SCANNER
  // =======================================================

  const stopScanner =
    useCallback(
      async () => {
        const scanner =
          scannerRef.current


        if (!scanner) {
          return
        }


        try {
          if (
            scanningRef.current
          ) {
            await scanner.stop()
          }
        } catch {
          // Scanner may already be stopped.
        }


        try {
          await scanner.clear()
        } catch {
          // Ignore cleanup errors.
        }


        scanningRef.current =
          false

        scannerRef.current =
          null
      },
      [],
    )


  // =======================================================
  // START SCANNER
  // =======================================================

  const startScanner =
    useCallback(
      async () => {
        if (
          !mountedRef.current
        ) {
          return
        }


        setStatus(
          "starting",
        )

        setError("")

        scanHandledRef.current =
          false


        await stopScanner()


        let scanner = null


        try {
          scanner =
            new Html5Qrcode(
              "smartmedchart-qr-reader",
            )


          scannerRef.current =
            scanner


          const config = {
            fps: 10,

            qrbox: (
              viewfinderWidth,
              viewfinderHeight,
            ) => {
              const smallest =
                Math.min(
                  viewfinderWidth,
                  viewfinderHeight,
                )


              const size =
                Math.max(
                  180,
                  Math.min(
                    280,
                    Math.floor(
                      smallest *
                        0.68,
                    ),
                  ),
                )


              return {
                width:
                  size,
                height:
                  size,
              }
            },

            aspectRatio: 1,

            formatsToSupport: [
              Html5QrcodeSupportedFormats.QR_CODE,
            ],

            disableFlip: false,
          }


          // First attempt: rear camera.

          try {
            await scanner.start(
              {
                facingMode: {
                  exact:
                    "environment",
                },
              },

              config,

              async (
                decodedText,
              ) => {
                if (
                  !mountedRef.current ||
                  scanHandledRef.current
                ) {
                  return
                }


                scanHandledRef.current =
                  true


                setStatus(
                  "success",
                )


                scanningRef.current =
                  false


                try {
                  await scanner.stop()
                } catch {
                  // Ignore.
                }


                onScanSuccess(
                  decodedText,
                )
              },

              () => {
                // Normal scan-frame failure.
              },
            )

          } catch (
            exactCameraError
          ) {

            // Second attempt: normal environment camera.

            try {
              await scanner.clear()
            } catch {
              // Ignore.
            }


            scanner =
              new Html5Qrcode(
                "smartmedchart-qr-reader",
              )


            scannerRef.current =
              scanner


            await scanner.start(
              {
                facingMode:
                  "environment",
              },

              config,

              async (
                decodedText,
              ) => {
                if (
                  !mountedRef.current ||
                  scanHandledRef.current
                ) {
                  return
                }


                scanHandledRef.current =
                  true


                setStatus(
                  "success",
                )


                scanningRef.current =
                  false


                try {
                  await scanner.stop()
                } catch {
                  // Ignore.
                }


                onScanSuccess(
                  decodedText,
                )
              },

              () => {},
            )

          }


          scanningRef.current =
            true


          if (
            mountedRef.current
          ) {
            setStatus(
              "scanning",
            )
          }

        } catch (
          scannerError
        ) {
          scanningRef.current =
            false


          if (
            mountedRef.current
          ) {
            setStatus(
              "error",
            )


            const message =
              scannerError?.message ||
              "Unable to access the device camera."


            setError(
              getCameraErrorMessage(
                message,
              ),
            )
          }
        }
      },
      [
        onScanSuccess,
        stopScanner,
      ],
    )


  // =======================================================
  // INITIALIZE / CLEANUP
  // =======================================================

  useEffect(() => {
    mountedRef.current =
      true


    const timeoutId =
      window.setTimeout(
        () => {
          startScanner()
        },
        100,
      )


    return () => {
      mountedRef.current =
        false


      window.clearTimeout(
        timeoutId,
      )


      stopScanner()
    }
  }, [
    startScanner,
    stopScanner,
  ])


  // =======================================================
  // RETRY
  // =======================================================

  async function retryScanner() {
    await startScanner()
  }


  // =======================================================
  // UI
  // =======================================================

  return (
    <div className="w-full overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">

      {/* =================================================
          HEADER
      ================================================= */}

      <div className="p-4 sm:p-5">

        <div className="flex items-start justify-between gap-3">

          <div className="flex min-w-0 items-start gap-3">

            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-cyan-50">

              <Camera className="h-5 w-5 text-cyan-600" />

            </div>


            <div className="min-w-0">

              <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-cyan-600">
                Camera Scanner
              </p>


              <h2 className="mt-1 text-base font-bold text-slate-900 sm:text-lg">
                Scan Patient QR
              </h2>


              <p className="mt-1 text-xs leading-5 text-slate-500 sm:text-sm">
                Point the rear camera at the patient's QR code.
              </p>

            </div>

          </div>


          <ScanLine className="h-5 w-5 shrink-0 text-slate-300" />

        </div>

      </div>


      {/* =================================================
          SCANNER
      ================================================= */}

      <div className="relative bg-slate-950">

        {/* Actual html5-qrcode target */}

        <div
          id="smartmedchart-qr-reader"
          className="min-h-[320px] w-full sm:min-h-[420px]"
        />


        {/* Starting */}

        {status ===
          "starting" && (
          <div className="absolute inset-0 flex items-center justify-center bg-slate-950 px-5">

            <div className="max-w-xs text-center">

              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-cyan-500/10">

                <div className="h-7 w-7 animate-spin rounded-full border-4 border-slate-700 border-t-cyan-400" />

              </div>


              <p className="mt-4 text-sm font-semibold text-white">
                Starting camera...
              </p>


              <p className="mt-1 text-xs leading-5 text-slate-400">
                Allow camera access when your browser asks.
              </p>

            </div>

          </div>
        )}


        {/* Scanning overlay */}

        {status ===
          "scanning" && (
          <>
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center">

              <div className="relative h-56 w-56 max-w-[68vw] max-h-[68vw] rounded-3xl border-2 border-cyan-400/80 shadow-[0_0_0_9999px_rgba(0,0,0,0.38)]">

                <span className="absolute -left-1 -top-1 h-6 w-6 border-l-4 border-t-4 border-cyan-300" />

                <span className="absolute -right-1 -top-1 h-6 w-6 border-r-4 border-t-4 border-cyan-300" />

                <span className="absolute -bottom-1 -left-1 h-6 w-6 border-b-4 border-l-4 border-cyan-300" />

                <span className="absolute -bottom-1 -right-1 h-6 w-6 border-b-4 border-r-4 border-cyan-300" />

                <div className="absolute left-2 right-2 top-1/2 h-px -translate-y-1/2 animate-pulse bg-cyan-400/80" />

              </div>

            </div>


            <div className="pointer-events-none absolute left-1/2 top-4 -translate-x-1/2">

              <div className="flex items-center gap-2 rounded-full border border-emerald-400/20 bg-emerald-500/90 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wide text-white shadow-lg sm:text-xs">

                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white" />

                Camera Ready

              </div>

            </div>

          </>
        )}


        {/* Success */}

        {status ===
          "success" && (
          <div className="absolute inset-0 flex items-center justify-center bg-emerald-950/90 px-5">

            <div className="text-center">

              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500 shadow-lg">

                <CheckCircle2 className="h-8 w-8 text-white" />

              </div>


              <p className="mt-4 text-base font-bold text-white sm:text-lg">
                QR Code Detected
              </p>


              <p className="mt-1 text-xs text-emerald-200 sm:text-sm">
                Verifying patient identity...
              </p>

            </div>

          </div>
        )}

      </div>


      {/* =================================================
          STATUS / INSTRUCTIONS
      ================================================= */}

      <div className="p-4 sm:p-5">

        {status ===
          "scanning" && (
          <div className="space-y-3">

            <div className="flex items-start gap-3 rounded-2xl border border-cyan-100 bg-cyan-50/70 p-4">

              <Smartphone className="mt-0.5 h-5 w-5 shrink-0 text-cyan-700" />


              <div>

                <p className="text-sm font-semibold text-cyan-900">
                  Phone scanning
                </p>


                <p className="mt-1 text-xs leading-5 text-cyan-800">
                  Use the rear camera. Keep the QR code centered,
                  clearly visible, and steady until detected.
                </p>

              </div>

            </div>


            <div className="grid gap-2 sm:grid-cols-3">

              <Tip
                number="1"
                title="Good lighting"
                text="Avoid strong glare or very dark areas."
              />


              <Tip
                number="2"
                title="Center the code"
                text="Keep the complete QR code visible."
              />


              <Tip
                number="3"
                title="Hold steady"
                text="Wait briefly for automatic detection."
              />

            </div>

          </div>
        )}


        {status ===
          "error" && (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-4">

            <div className="flex items-start gap-3">

              <div className="shrink-0 rounded-xl bg-red-100 p-2.5">

                <Camera className="h-5 w-5 text-red-600" />

              </div>


              <div className="min-w-0">

                <p className="text-sm font-semibold text-red-900">
                  Camera scanner unavailable
                </p>


                <p className="mt-1 text-xs leading-5 text-red-700 sm:text-sm">
                  {error ||
                    "The camera could not be started."}
                </p>


                <button
                  type="button"
                  onClick={
                    retryScanner
                  }
                  className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-red-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-red-700 sm:w-auto"
                >

                  <RefreshCw className="h-4 w-4" />

                  Try Camera Again

                </button>

              </div>

            </div>

          </div>
        )}


        {status ===
          "success" && (
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">

            <div className="flex items-center gap-3">

              <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600" />


              <div>

                <p className="text-sm font-semibold text-emerald-900">
                  QR code detected
                </p>


                <p className="mt-1 text-xs text-emerald-700">
                  Please wait while patient verification completes.
                </p>

              </div>

            </div>

          </div>
        )}

      </div>

    </div>
  )
}


// =========================================================
// CAMERA ERROR MESSAGE
// =========================================================

function getCameraErrorMessage(
  message,
) {
  const text =
    String(
      message || "",
    ).toLowerCase()


  if (
    text.includes(
      "permission",
    ) ||
    text.includes(
      "notallowed",
    )
  ) {
    return "Camera permission was denied. Allow camera access in your browser settings and try again."
  }


  if (
    text.includes(
      "notfound",
    ) ||
    text.includes(
      "device",
    )
  ) {
    return "No usable camera was detected on this device."
  }


  if (
    text.includes(
      "secure",
    ) ||
    text.includes(
      "https",
    )
  ) {
    return "Camera access requires a secure browser context such as HTTPS or localhost."
  }


  return message ||
    "Unable to access the device camera."
}


// =========================================================
// TIP
// =========================================================

function Tip({
  number,
  title,
  text,
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">

      <div className="flex items-center gap-2">

        <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-slate-900 text-[10px] font-bold text-white">
          {number}
        </span>


        <p className="text-xs font-semibold text-slate-700">
          {title}
        </p>

      </div>


      <p className="mt-2 text-[11px] leading-5 text-slate-500">
        {text}
      </p>

    </div>
  )
}