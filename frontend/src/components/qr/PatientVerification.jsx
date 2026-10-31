import React, { useCallback, useEffect, useState } from "react"
import {
  Camera,
  CheckCircle2,
  FileText,
  KeyRound,
  LoaderCircle,
  QrCode,
  RotateCcw,
  Search,
  ShieldCheck,
  User,
  Users,
} from "lucide-react"

import QRCodeScanner from "./QRCodeScanner"
import QRResult from "./QRResult"
import Button from "../common/Button"
import { verifyPatientQR } from "../../services/qr"
import { getNursePatients } from "../../services/medications"

export default function PatientVerification({ onVerified }) {
  const [result, setResult] = useState(null)
  const [verifying, setVerifying] = useState(false)
  const [activeMode, setActiveMode] = useState("camera") // "camera", "manual", "assigned"
  const [manualToken, setManualToken] = useState("")
  const [assignedPatients, setAssignedPatients] = useState([])
  const [loadingPatients, setLoadingPatients] = useState(false)

  // Load assigned patients for quick fallback verification
  useEffect(() => {
    async function fetchPatients() {
      setLoadingPatients(true)
      try {
        const data = await getNursePatients()
        setAssignedPatients(Array.isArray(data) ? data : [])
      } catch (err) {
        // Fallback gracefully
      } finally {
        setLoadingPatients(false)
      }
    }
    fetchPatients()
  }, [])

  // =======================================================
  // VERIFY TOKEN
  // =======================================================
  const verifyToken = useCallback(
    async (qrToken) => {
      const token = String(qrToken || "").trim()
      if (!token) return

      setVerifying(true)
      setResult(null)

      try {
        const response = await verifyPatientQR(token)
        setResult(response)

        if (response.valid && response.patient_id) {
          onVerified?.(response.patient_id, response)
        }
      } catch (requestError) {
        setResult({
          valid: false,
          patient_id: null,
          message:
            requestError?.response?.data?.detail ||
            requestError?.message ||
            "Unable to verify patient QR token with hospital EMR.",
        })
      } finally {
        setVerifying(false)
      }
    },
    [onVerified],
  )

  function handleManualSubmit(e) {
    e.preventDefault()
    if (!manualToken.trim()) return
    verifyToken(manualToken.trim())
  }

  function resetVerification() {
    setResult(null)
    setVerifying(false)
    setManualToken("")
  }

  return (
    <div className="space-y-5">
      {/* Verification Mode Selector */}
      <div className="flex items-center gap-1.5 p-1 bg-slate-100 rounded-2xl w-fit">
        <button
          type="button"
          onClick={() => {
            setActiveMode("camera")
            resetVerification()
          }}
          className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
            activeMode === "camera"
              ? "bg-white text-slate-900 shadow-xs"
              : "text-slate-600 hover:text-slate-900"
          }`}
        >
          <Camera className="w-3.5 h-3.5 text-sky-600" />
          <span>Camera Scanner</span>
        </button>

        <button
          type="button"
          onClick={() => {
            setActiveMode("manual")
            resetVerification()
          }}
          className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
            activeMode === "manual"
              ? "bg-white text-slate-900 shadow-xs"
              : "text-slate-600 hover:text-slate-900"
          }`}
        >
          <KeyRound className="w-3.5 h-3.5 text-indigo-600" />
          <span>Manual QR Token Input</span>
        </button>

        <button
          type="button"
          onClick={() => {
            setActiveMode("assigned")
            resetVerification()
          }}
          className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
            activeMode === "assigned"
              ? "bg-white text-slate-900 shadow-xs"
              : "text-slate-600 hover:text-slate-900"
          }`}
        >
          <Users className="w-3.5 h-3.5 text-emerald-600" />
          <span>Assigned Inpatients ({assignedPatients.length})</span>
        </button>
      </div>

      {/* Verifying Loader */}
      {verifying && (
        <div className="p-8 bg-white border border-slate-200 rounded-3xl text-center space-y-3">
          <LoaderCircle className="w-10 h-10 animate-spin text-sky-600 mx-auto" />
          <h3 className="text-base font-bold text-slate-900">
            Validating Patient Wristband Token...
          </h3>
          <p className="text-xs text-slate-500">
            Checking hospital identity records and active nurse-patient assignment...
          </p>
        </div>
      )}

      {/* Verification Result Banner */}
      {result && (
        <div className="space-y-3">
          <QRResult result={result} />
          {!result.valid && (
            <div className="flex justify-end">
              <Button
                variant="outline"
                size="sm"
                icon={RotateCcw}
                onClick={resetVerification}
              >
                Scan or Enter Again
              </Button>
            </div>
          )}
        </div>
      )}

      {/* MODE 1: Camera Scanner */}
      {activeMode === "camera" && !verifying && !result && (
        <div className="space-y-4">
          <QRCodeScanner onScanSuccess={verifyToken} />
        </div>
      )}

      {/* MODE 2: Manual QR Token Input Fallback */}
      {activeMode === "manual" && !verifying && !result && (
        <div className="p-6 bg-white border border-slate-200 rounded-3xl shadow-xs space-y-4">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
              <KeyRound className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">
                Manual Wristband Token Verification
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                If the bedside camera cannot read a damaged or curved barcode, enter the
                alphanumeric token printed on the patient's wristband.
              </p>
            </div>
          </div>

          <form onSubmit={handleManualSubmit} className="space-y-4 pt-2">
            <div>
              <label
                htmlFor="manual_token_input"
                className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5"
              >
                Patient QR Token String <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <QrCode className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  id="manual_token_input"
                  type="text"
                  required
                  value={manualToken}
                  onChange={(e) => setManualToken(e.target.value)}
                  placeholder="e.g. WxKSvxEBOgK6C9UNgbV8-duneJK_cM09-FIvpTSHnjw"
                  className="w-full bg-slate-50 border border-slate-200 rounded-2xl pl-10 pr-4 py-3 text-sm text-slate-900 font-mono placeholder-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 transition"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <Button
                type="submit"
                variant="primary"
                disabled={!manualToken.trim()}
                icon={CheckCircle2}
              >
                Verify Token with EMR
              </Button>
            </div>
          </form>
        </div>
      )}

      {/* MODE 3: Assigned Inpatient Quick Selection */}
      {activeMode === "assigned" && !verifying && !result && (
        <div className="p-6 bg-white border border-slate-200 rounded-3xl shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-slate-900">
                Your Assigned Inpatients
              </h3>
              <p className="text-xs text-slate-500">
                Direct bedside wristband verification for assigned patients
              </p>
            </div>
            <span className="text-xs font-bold text-slate-500">
              {assignedPatients.length} Active
            </span>
          </div>

          {loadingPatients ? (
            <div className="p-6 text-center text-xs text-slate-400">
              Loading assigned patients...
            </div>
          ) : assignedPatients.length === 0 ? (
            <div className="p-6 text-center text-xs text-slate-400">
              No active patients currently assigned to your shift.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2">
              {assignedPatients.map((patient) => (
                <div
                  key={patient.id}
                  className="p-4 rounded-2xl border border-slate-200 bg-slate-50/70 hover:bg-slate-100/70 flex items-center justify-between gap-3 transition"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-sky-100 text-sky-700 flex items-center justify-center shrink-0">
                      <User className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-slate-900">
                        {patient.patient_name || `${patient.first_name} ${patient.last_name}`}
                      </h4>
                      <p className="text-[11px] text-slate-500 font-mono">
                        {patient.patient_code} · {patient.ward_name} (Bed {patient.bed_number})
                      </p>
                    </div>
                  </div>

                  {patient.qr_token ? (
                    <Button
                      size="sm"
                      variant="primary"
                      onClick={() => verifyToken(patient.qr_token)}
                    >
                      Verify Wristband
                    </Button>
                  ) : (
                    <span className="text-[10px] text-amber-700 bg-amber-50 px-2 py-1 rounded-lg border border-amber-200">
                      QR Pending
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}