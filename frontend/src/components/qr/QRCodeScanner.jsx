import React, { useCallback, useEffect, useRef, useState } from "react"
import {
  Camera,
  CheckCircle2,
  FlipHorizontal,
  RefreshCw,
  ScanLine,
  Smartphone,
  Video,
} from "lucide-react"
import { Html5Qrcode, Html5QrcodeSupportedFormats } from "html5-qrcode"

export default function QRCodeScanner({ onScanSuccess }) {
  const scannerRef = useRef(null)
  const mountedRef = useRef(true)
  const scanningRef = useRef(false)
  const scanHandledRef = useRef(false)

  const [status, setStatus] = useState("starting") // "starting", "scanning", "success", "error"
  const [error, setError] = useState("")
  const [cameras, setCameras] = useState([])
  const [selectedCameraId, setSelectedCameraId] = useState("")

  // =======================================================
  // STOP SCANNER
  // =======================================================
  const stopScanner = useCallback(async () => {
    const scanner = scannerRef.current
    if (!scanner) return

    try {
      if (scanningRef.current && scanner.isScanning) {
        await scanner.stop()
      }
    } catch {
      // Scanner might already be stopped
    }

    try {
      await scanner.clear()
    } catch {
      // Ignore clear errors
    }

    scanningRef.current = false
    scannerRef.current = null
  }, [])

  // =======================================================
  // START SCANNER WITH MULTI-CAMERA CASCADE
  // =======================================================
  const startScanner = useCallback(
    async (preferredCameraId = "") => {
      if (!mountedRef.current) return

      setStatus("starting")
      setError("")
      scanHandledRef.current = false

      // Check browser environment support
      if (
        typeof window === "undefined" ||
        !navigator?.mediaDevices?.getUserMedia
      ) {
        setStatus("error")
        setError(
          "Camera access is not supported by your browser environment or requires a secure HTTPS/localhost connection.",
        )
        return
      }

      await stopScanner()

      // Enumerate available video input devices
      let availableCameras = []
      try {
        availableCameras = await Html5Qrcode.getCameras()
        if (mountedRef.current) {
          setCameras(availableCameras)
          if (!preferredCameraId && availableCameras.length > 0) {
            // Prefer rear/environment camera if label indicates it
            const rearCamera = availableCameras.find(
              (c) =>
                c.label?.toLowerCase().includes("back") ||
                c.label?.toLowerCase().includes("rear") ||
                c.label?.toLowerCase().includes("environment"),
            )
            preferredCameraId = rearCamera ? rearCamera.id : availableCameras[0].id
            setSelectedCameraId(preferredCameraId)
          }
        }
      } catch (enumErr) {
        console.warn("Camera enumeration warning:", enumErr)
      }

      // Prepare DOM element
      const elementId = "smartmedchart-qr-reader"
      const el = document.getElementById(elementId)
      if (!el) {
        if (mountedRef.current) {
          setStatus("error")
          setError("Scanner viewport element not mounted.")
        }
        return
      }

      const scanner = new Html5Qrcode(elementId)
      scannerRef.current = scanner

      const config = {
        fps: 12,
        qrbox: (viewfinderWidth, viewfinderHeight) => {
          const smallest = Math.min(viewfinderWidth, viewfinderHeight)
          const size = Math.max(180, Math.min(280, Math.floor(smallest * 0.72)))
          return { width: size, height: size }
        },
        aspectRatio: 1,
        formatsToSupport: [Html5QrcodeSupportedFormats.QR_CODE],
        disableFlip: false,
      }

      const onScan = async (decodedText) => {
        if (!mountedRef.current || scanHandledRef.current) return
        scanHandledRef.current = true
        setStatus("success")
        scanningRef.current = false

        try {
          await scanner.stop()
        } catch {
          // Ignore
        }

        onScanSuccess?.(decodedText)
      }

      const onFrameError = () => {
        // Normal scan-frame retry
      }

      // Camera Cascade Attempt List
      const cameraAttempts = []
      if (preferredCameraId) {
        cameraAttempts.push(preferredCameraId)
      }
      // Environment camera (rear on mobile) - relaxed ideal, NOT strict exact
      cameraAttempts.push({ facingMode: "environment" })
      // User camera (front / webcams)
      cameraAttempts.push({ facingMode: "user" })
      // First available enumerated camera ID
      if (availableCameras.length > 0) {
        cameraAttempts.push(availableCameras[0].id)
      }

      let started = false
      let lastError = null

      for (const cameraConfig of cameraAttempts) {
        if (!mountedRef.current) return
        try {
          await scanner.start(cameraConfig, config, onScan, onFrameError)
          started = true
          scanningRef.current = true
          if (mountedRef.current) {
            setStatus("scanning")
          }
          break
        } catch (attemptErr) {
          lastError = attemptErr
          // Try next camera mode
        }
      }

      if (!started && mountedRef.current) {
        setStatus("error")
        const msg = String(lastError?.message || lastError || "").toLowerCase()
        if (
          msg.includes("permission") ||
          msg.includes("denied") ||
          msg.includes("notallowed")
        ) {
          setError(
            "Camera permission was denied. Please allow camera access in your browser settings (click the lock/camera icon in the address bar) and retry.",
          )
        } else if (msg.includes("notfound") || msg.includes("device")) {
          setError(
            "No active camera was detected on this device. Please connect a webcam or use a mobile device.",
          )
        } else if (msg.includes("readable") || msg.includes("could not start")) {
          setError(
            "The camera is currently in use by another application or video call. Close other apps and retry.",
          )
        } else {
          setError(
            lastError?.message ||
              "Unable to open camera stream. Please verify camera permissions or use manual QR token input.",
          )
        }
      }
    },
    [onScanSuccess, stopScanner],
  )

  // =======================================================
  // INITIALIZE / CLEANUP
  // =======================================================
  useEffect(() => {
    mountedRef.current = true
    const timeoutId = window.setTimeout(() => {
      startScanner()
    }, 120)

    return () => {
      mountedRef.current = false
      window.clearTimeout(timeoutId)
      stopScanner()
    }
  }, [startScanner, stopScanner])

  // Switch Camera
  async function handleCameraChange(cameraId) {
    setSelectedCameraId(cameraId)
    await startScanner(cameraId)
  }

  return (
    <div className="w-full overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
      {/* Header with Camera Controls */}
      <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-sky-50 text-sky-600">
            <Camera className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900">Bedside Camera Scanner</h3>
            <p className="text-xs text-slate-500">
              Align patient wristband barcode or QR token
            </p>
          </div>
        </div>

        {/* Camera Switcher Dropdown (if multiple cameras available) */}
        {cameras.length > 1 && (
          <div className="flex items-center gap-1.5">
            <select
              value={selectedCameraId}
              onChange={(e) => handleCameraChange(e.target.value)}
              className="bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1 text-xs text-slate-700 font-medium focus:outline-none focus:ring-2 focus:ring-sky-500/20"
            >
              {cameras.map((cam, idx) => (
                <option key={cam.id} value={cam.id}>
                  {cam.label || `Camera ${idx + 1}`}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Camera Viewport */}
      <div className="relative bg-slate-950 flex items-center justify-center min-h-[320px] sm:min-h-[380px]">
        {/* html5-qrcode target container */}
        <div
          id="smartmedchart-qr-reader"
          className="w-full h-full min-h-[320px] sm:min-h-[380px]"
        />

        {/* Starting / Loading Overlay */}
        {status === "starting" && (
          <div className="absolute inset-0 flex items-center justify-center bg-slate-950/90 px-5 z-10">
            <div className="text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-sky-500/10 mb-3">
                <RefreshCw className="h-6 w-6 animate-spin text-sky-400" />
              </div>
              <p className="text-sm font-bold text-white">Opening Bedside Camera...</p>
              <p className="text-xs text-slate-400 mt-1 max-w-xs">
                Requesting camera stream. Allow browser permissions if prompted.
              </p>
            </div>
          </div>
        )}

        {/* Scanning Reticle Overlay */}
        {status === "scanning" && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center z-10">
            <div className="relative h-56 w-56 max-w-[70vw] max-h-[70vw] rounded-3xl border-2 border-sky-400/80 shadow-[0_0_0_9999px_rgba(0,0,0,0.35)]">
              <span className="absolute -left-1 -top-1 h-6 w-6 border-l-4 border-t-4 border-sky-300" />
              <span className="absolute -right-1 -top-1 h-6 w-6 border-r-4 border-t-4 border-sky-300" />
              <span className="absolute -bottom-1 -left-1 h-6 w-6 border-b-4 border-l-4 border-sky-300" />
              <span className="absolute -bottom-1 -right-1 h-6 w-6 border-b-4 border-r-4 border-sky-300" />
              <div className="absolute left-2 right-2 top-1/2 h-px -translate-y-1/2 animate-pulse bg-sky-400" />
            </div>

            <div className="absolute top-4 left-1/2 -translate-x-1/2 flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/90 text-white text-[10px] font-bold uppercase tracking-wider shadow-md">
              <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
              Live Camera Feed Active
            </div>
          </div>
        )}

        {/* Success Overlay */}
        {status === "success" && (
          <div className="absolute inset-0 flex items-center justify-center bg-emerald-950/90 px-5 z-20">
            <div className="text-center">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-500 text-white mb-3 shadow-lg">
                <CheckCircle2 className="h-8 w-8" />
              </div>
              <p className="text-base font-bold text-white">QR Code Detected</p>
              <p className="text-xs text-emerald-200 mt-0.5">
                Verifying token against hospital EMR...
              </p>
            </div>
          </div>
        )}

        {/* Error Overlay */}
        {status === "error" && (
          <div className="absolute inset-0 flex items-center justify-center bg-slate-900 p-6 z-20">
            <div className="max-w-md text-center space-y-3">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-rose-500/20 text-rose-400">
                <Camera className="h-6 w-6" />
              </div>
              <h4 className="text-sm font-bold text-white">Camera Access Notice</h4>
              <p className="text-xs text-slate-300 leading-relaxed">{error}</p>
              <button
                type="button"
                onClick={() => startScanner(selectedCameraId)}
                className="mt-2 inline-flex items-center gap-1.5 px-4 py-2 bg-sky-600 hover:bg-sky-500 text-white rounded-xl text-xs font-bold transition shadow-sm"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                Retry Camera
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Footer Scanning Tips */}
      <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
        <div className="flex items-center gap-2">
          <Smartphone className="w-4 h-4 text-sky-600" />
          <span>Keep wristband 15–25 cm away under steady lighting</span>
        </div>
        <button
          type="button"
          onClick={() => startScanner(selectedCameraId)}
          className="text-sky-600 hover:text-sky-700 font-semibold flex items-center gap-1"
        >
          <RefreshCw className="w-3 h-3" /> Reconnect
        </button>
      </div>
    </div>
  )
}