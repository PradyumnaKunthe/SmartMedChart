import React, { useCallback, useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import {
  Activity,
  AlertCircle,
  AlertTriangle,
  Building2,
  Calendar,
  CheckCircle2,
  ChevronRight,
  Clock,
  FileText,
  Pill,
  Plus,
  QrCode,
  RefreshCw,
  Save,
  Search,
  ShieldAlert,
  ShieldCheck,
  Stethoscope,
  TrendingUp,
  User,
  Users,
} from "lucide-react"

import MainLayout from "../../components/layout/MainLayout"
import Card, { CardHeader } from "../../components/common/Card"
import Button from "../../components/common/Button"
import Badge from "../../components/common/Badge"
import Loading from "../../components/common/Loading"
import EmptyState from "../../components/common/EmptyState"
import ErrorState from "../../components/common/ErrorState"
import QRCodeScanner from "../../components/qr/QRCodeScanner"

import {
  getDoctorRoundPatients,
  verifyDoctorRoundQR,
  saveDoctorRoundAssessment,
  getDoctorPatientAssessments,
} from "../../services/doctor"

function formatDate(value) {
  if (!value) return "—"
  try {
    const d = new Date(value)
    if (Number.isNaN(d.getTime())) return String(value)
    return new Intl.DateTimeFormat("en-IN", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(d)
  } catch {
    return String(value)
  }
}

export default function DoctorOnRound() {
  const navigate = useNavigate()

  // Round Roster & State
  const [patients, setPatients] = useState([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState("")
  const [successMsg, setSuccessMsg] = useState("")

  // Verification mode: "scan" | "manual"
  const [mode, setMode] = useState("scan")
  const [manualToken, setManualToken] = useState("")
  const [verifying, setVerifying] = useState(false)

  // Verified / Selected Patient context
  const [selectedPatient, setSelectedPatient] = useState(null)
  const [patientHistory, setPatientHistory] = useState([])
  const [loadingHistory, setLoadingHistory] = useState(false)

  // Recovery Assessment Form state
  const [improvementPercentage, setImprovementPercentage] = useState(70)
  const [clinicalNotes, setClinicalNotes] = useState("")
  const [submittingAssessment, setSubmittingAssessment] = useState(false)
  const [assessmentSuccess, setAssessmentSuccess] = useState(null)

  // Load round roster
  const loadRoster = useCallback(async (isManual = false) => {
    if (isManual) setRefreshing(true)
    else setLoading(true)
    setError("")

    try {
      const data = await getDoctorRoundPatients()
      setPatients(Array.isArray(data) ? data : [])
    } catch (err) {
      setError(err?.response?.data?.detail || "Unable to load round patients roster.")
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    loadRoster()
  }, [loadRoster])

  // Handle patient verification via token
  const handleVerifyToken = async (token) => {
    if (!token || !token.trim()) return
    setVerifying(true)
    setError("")
    setSuccessMsg("")
    setAssessmentSuccess(null)

    try {
      const res = await verifyDoctorRoundQR(token.trim())
      if (res.valid && res.patient) {
        setSelectedPatient(res.patient)
        setSuccessMsg(res.message || "Patient verified for ward round.")
        // Pre-fill improvement percentage with last known or sensible default
        const lastPct = res.patient.last_assessment?.improvement_percentage
        setImprovementPercentage(lastPct !== undefined ? lastPct : 70)
        setClinicalNotes("")

        // Load historical assessments
        loadPatientAssessments(res.patient.id)
      } else {
        setError(res.message || "Verification failed. Patient is not assigned to your active roster.")
        setSelectedPatient(null)
      }
    } catch (err) {
      setError(err?.response?.data?.detail || "Error verifying patient wristband QR.")
      setSelectedPatient(null)
    } finally {
      setVerifying(false)
    }
  }

  // Handle QR camera scan
  const handleScanSuccess = (decodedText) => {
    handleVerifyToken(decodedText)
  }

  // Select patient manually from roster
  const handleSelectPatient = async (p) => {
    if (!p) return
    if (p.qr_token) {
      handleVerifyToken(p.qr_token)
    } else {
      // Direct load
      setVerifying(true)
      try {
        const dummyToken = `PAT-VERIFY-${p.id}`
        // Verify via token or fetch assessments
        setSelectedPatient({
          id: p.id,
          patient_id: p.patient_id,
          full_name: p.full_name,
          gender: p.gender,
          date_of_birth: p.date_of_birth,
          ward_id: p.ward_id,
          ward_name: p.ward_name,
          bed_id: p.bed_id,
          bed_number: p.bed_number,
          admission_date: p.admitted_at,
          chief_complaint: p.chief_complaint,
          allergies: [],
          active_prescriptions: [],
          upcoming_schedules: [],
          last_assessment: p.last_assessment,
        })
        const lastPct = p.last_assessment?.improvement_percentage
        setImprovementPercentage(lastPct !== undefined ? lastPct : 70)
        setClinicalNotes("")
        loadPatientAssessments(p.id)
      } finally {
        setVerifying(false)
      }
    }
  }

  // Load chronological assessments for the selected patient
  const loadPatientAssessments = async (pId) => {
    setLoadingHistory(true)
    try {
      const list = await getDoctorPatientAssessments(pId)
      setPatientHistory(Array.isArray(list) ? list : [])
    } catch {
      setPatientHistory([])
    } finally {
      setLoadingHistory(false)
    }
  }

  // Submit recovery assessment
  const handleSubmitAssessment = async (e) => {
    e.preventDefault()
    if (!selectedPatient) return

    setSubmittingAssessment(true)
    setError("")
    setAssessmentSuccess(null)

    try {
      const payload = {
        patient_id: Number(selectedPatient.id),
        improvement_percentage: Number(improvementPercentage),
        clinical_notes: clinicalNotes.trim() || null,
      }

      const res = await saveDoctorRoundAssessment(payload)
      setAssessmentSuccess(res.assessment)
      setSuccessMsg("Recovery assessment recorded successfully!")

      // Refresh assessments history & roster
      await Promise.all([
        loadPatientAssessments(selectedPatient.id),
        loadRoster(true),
      ])
    } catch (err) {
      setError(err?.response?.data?.detail || "Unable to save recovery assessment.")
    } finally {
      setSubmittingAssessment(false)
    }
  }

  if (loading) {
    return (
      <MainLayout
        title="Doctor On-Round Workspace"
        subtitle="Bedside patient verification, recovery assessment & clinical progress tracking"
      >
        <Loading message="Loading doctor on-round patient roster..." />
      </MainLayout>
    )
  }

  return (
    <MainLayout
      title="Doctor On-Round Workspace"
      subtitle="Bedside patient verification, recovery assessment & clinical progress tracking"
    >
      <div className="mx-auto max-w-6xl space-y-6">
        {/* Top Control Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="flex h-3 w-3 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
            </span>
            <span className="text-xs font-bold uppercase tracking-wider text-slate-600">
              Active Round Session · {patients.length} Inpatient{patients.length !== 1 ? "s" : ""} on Roster
            </span>
          </div>

          <div className="flex items-center gap-3">
            <Button
              variant="secondary"
              size="sm"
              icon={RefreshCw}
              loading={refreshing}
              onClick={() => loadRoster(true)}
            >
              Sync Roster
            </Button>
          </div>
        </div>

        {/* Global Error Banner */}
        {error && (
          <div className="flex items-center justify-between gap-3 p-4 bg-rose-50 border border-rose-200 rounded-2xl text-rose-700 text-sm">
            <div className="flex items-center gap-3">
              <AlertTriangle className="w-5 h-5 shrink-0 text-rose-600" />
              <span>{error}</span>
            </div>
            <button
              type="button"
              onClick={() => setError("")}
              className="text-rose-500 hover:text-rose-800 text-xs font-bold"
            >
              ✕
            </button>
          </div>
        )}

        {/* Success Banner */}
        {successMsg && (
          <div className="flex items-center justify-between gap-3 p-4 bg-emerald-50 border border-emerald-200 rounded-2xl text-emerald-800 text-sm">
            <div className="flex items-center gap-2.5">
              <CheckCircle2 className="w-5 h-5 shrink-0 text-emerald-600" />
              <span>{successMsg}</span>
            </div>
            <button
              type="button"
              onClick={() => setSuccessMsg("")}
              className="text-emerald-600 hover:text-emerald-900 text-xs font-bold"
            >
              ✕
            </button>
          </div>
        )}

        {/* PATIENT VERIFICATION CARD */}
        <Card>
          <CardHeader
            title="BEDSIDE PATIENT IDENTIFICATION"
            subtitle="Scan the patient's wristband QR code or manually select from your assigned roster"
          />
          <div className="p-6 space-y-6">
            {/* Mode Switcher */}
            <div className="flex items-center gap-2 border-b border-slate-100 pb-4">
              <button
                type="button"
                onClick={() => setMode("scan")}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                  mode === "scan"
                    ? "bg-sky-600 text-white shadow-xs"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                <QrCode className="w-4 h-4" />
                <span>Wristband QR Scanner</span>
              </button>

              <button
                type="button"
                onClick={() => setMode("manual")}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                  mode === "manual"
                    ? "bg-sky-600 text-white shadow-xs"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                <Users className="w-4 h-4" />
                <span>Select from Assigned Roster ({patients.length})</span>
              </button>
            </div>

            {/* Mode 1: Camera Scanner */}
            {mode === "scan" && (
              <div className="space-y-4">
                <div className="max-w-md mx-auto">
                  <QRCodeScanner onScanSuccess={handleScanSuccess} />
                </div>
                <div className="text-center text-xs text-slate-400">
                  Align camera with the patient wristband QR code to auto-verify bedside assignment
                </div>

                {/* Manual Token Fallback */}
                <div className="pt-2 max-w-md mx-auto flex items-center gap-2">
                  <input
                    type="text"
                    placeholder="Or enter QR token string directly..."
                    value={manualToken}
                    onChange={(e) => setManualToken(e.target.value)}
                    className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-xs text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 font-mono"
                  />
                  <Button
                    variant="primary"
                    size="sm"
                    loading={verifying}
                    disabled={!manualToken.trim()}
                    onClick={() => handleVerifyToken(manualToken)}
                  >
                    Verify
                  </Button>
                </div>
              </div>
            )}

            {/* Mode 2: Roster Manual Selection */}
            {mode === "manual" && (
              <div className="space-y-3">
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Select Active Inpatient
                </label>
                {patients.length === 0 ? (
                  <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-500">
                    No active inpatients are assigned to your care right now.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                    {patients.map((p) => {
                      const isCur = selectedPatient?.id === p.id
                      return (
                        <div
                          key={p.id}
                          onClick={() => handleSelectPatient(p)}
                          className={`p-4 rounded-2xl border cursor-pointer transition-all duration-150 ${
                            isCur
                              ? "border-sky-500 bg-sky-50/50 shadow-sm"
                              : "border-slate-200 bg-white hover:border-sky-300 hover:shadow-xs"
                          }`}
                        >
                          <div className="flex items-start justify-between">
                            <span className="font-heading font-bold text-sm text-slate-900">
                              {p.full_name}
                            </span>
                            <Badge variant={isCur ? "primary" : "neutral"} size="sm">
                              #{p.patient_id}
                            </Badge>
                          </div>
                          <p className="text-xs text-slate-500 mt-1">
                            {p.ward_name || "Ward"} · Bed {p.bed_number || "Unassigned"}
                          </p>
                          <div className="mt-2 pt-2 border-t border-slate-100 flex items-center justify-between text-[11px]">
                            <span className="text-slate-400">Last Round:</span>
                            <span className="font-bold text-emerald-600">
                              {p.last_assessment
                                ? `${p.last_assessment.improvement_percentage}%`
                                : "Unassessed"}
                            </span>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        </Card>

        {/* VERIFIED PATIENT CLINICAL SUMMARY & ON-ROUND ASSESSMENT */}
        {selectedPatient && (
          <div className="space-y-6 animate-fade-in">
            {/* Patient Header Banner */}
            <div className="rounded-3xl border border-sky-200 bg-gradient-to-r from-sky-50 to-indigo-50/40 p-6 shadow-xs">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-sky-600 text-white font-bold text-lg shadow-sm">
                    {selectedPatient.full_name?.charAt(0) || "P"}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-heading text-xl font-black text-slate-900">
                        {selectedPatient.full_name}
                      </h3>
                      <Badge variant="success" size="sm">
                        Active Inpatient
                      </Badge>
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-slate-600">
                      <span>ID: <strong className="text-slate-800">#{selectedPatient.patient_id}</strong></span>
                      <span>·</span>
                      <span>Gender: <strong className="capitalize">{selectedPatient.gender || "—"}</strong></span>
                      <span>·</span>
                      <span>Bed: <strong>{selectedPatient.bed_number ? `Bed ${selectedPatient.bed_number}` : "Unassigned"}</strong></span>
                      {selectedPatient.ward_name && (
                        <>
                          <span>·</span>
                          <span>Ward: <strong>{selectedPatient.ward_name}</strong></span>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    icon={FileText}
                    onClick={() => navigate(`/doctor/patients/${selectedPatient.id}`)}
                  >
                    Open Full Chart
                  </Button>
                </div>
              </div>

              {/* Chief complaint & Admission strip */}
              <div className="mt-4 pt-4 border-t border-sky-100 grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                <div className="rounded-xl bg-white/80 p-2.5 border border-sky-100/60">
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">
                    Chief Complaint / Symptoms
                  </span>
                  <span className="font-semibold text-slate-800 mt-0.5 block truncate">
                    {selectedPatient.chief_complaint || "Acute Inpatient Care"}
                  </span>
                </div>

                <div className="rounded-xl bg-white/80 p-2.5 border border-sky-100/60">
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">
                    Admission Date
                  </span>
                  <span className="font-semibold text-slate-800 mt-0.5 block">
                    {formatDate(selectedPatient.admission_date)}
                  </span>
                </div>

                <div className="rounded-xl bg-white/80 p-2.5 border border-sky-100/60">
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">
                    Documented Allergies
                  </span>
                  <span className="font-semibold text-rose-600 mt-0.5 block">
                    {selectedPatient.allergies?.length > 0
                      ? selectedPatient.allergies.map((a) => a.allergen).join(", ")
                      : "No Known Drug Allergies (NKDA)"}
                  </span>
                </div>
              </div>
            </div>

            {/* RECOVERY ASSESSMENT FORM */}
            <form onSubmit={handleSubmitAssessment}>
              <Card>
                <CardHeader
                  title="PATIENT RECOVERY ASSESSMENT"
                  subtitle="Record the bedside clinical recovery score (0% – 100%) and physician examination notes"
                />
                <div className="p-6 space-y-6">
                  {/* Slider & Readout */}
                  <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-5 space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <label className="text-xs font-bold uppercase tracking-wider text-slate-700">
                          Current Patient Recovery / Improvement Percentage
                        </label>
                        <p className="text-xs text-slate-500 mt-0.5">
                          Slide to reflect patient's clinical improvement trajectory
                        </p>
                      </div>

                      <div className="flex items-center gap-2">
                        <span
                          className={`font-heading text-3xl font-black ${
                            improvementPercentage >= 75
                              ? "text-emerald-600"
                              : improvementPercentage >= 50
                              ? "text-sky-600"
                              : improvementPercentage >= 25
                              ? "text-amber-600"
                              : "text-rose-600"
                          }`}
                        >
                          {improvementPercentage}%
                        </span>
                      </div>
                    </div>

                    {/* Range slider */}
                    <input
                      type="range"
                      min="0"
                      max="100"
                      step="5"
                      value={improvementPercentage}
                      onChange={(e) => setImprovementPercentage(Number(e.target.value))}
                      className="w-full h-3 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-emerald-600"
                    />

                    {/* Quick Preset Pills */}
                    <div className="flex flex-wrap items-center gap-2 pt-1">
                      {[
                        { val: 10, label: "10% Critical" },
                        { val: 25, label: "25% Minimal" },
                        { val: 50, label: "50% Moderate" },
                        { val: 75, label: "75% Substantial" },
                        { val: 90, label: "90% Near Recovery" },
                        { val: 100, label: "100% Full Recovery" },
                      ].map((preset) => (
                        <button
                          key={preset.val}
                          type="button"
                          onClick={() => setImprovementPercentage(preset.val)}
                          className={`px-3 py-1 rounded-lg text-xs font-bold transition-colors ${
                            improvementPercentage === preset.val
                              ? "bg-slate-900 text-white shadow-xs"
                              : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-100"
                          }`}
                        >
                          {preset.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Clinical Round Notes */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                      Physician Round Notes & Observations
                    </label>
                    <textarea
                      rows={3}
                      placeholder="e.g. Patient afebrile for 24h, cough subsided, lungs clear to auscultation. Tolerating oral intake well..."
                      value={clinicalNotes}
                      onChange={(e) => setClinicalNotes(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500"
                    />
                  </div>

                  {/* Submission Row */}
                  <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                    <span className="text-xs text-slate-400">
                      Auto-stamped with authenticated doctor credentials and UTC timestamp
                    </span>

                    <Button
                      type="submit"
                      variant="primary"
                      icon={Save}
                      loading={submittingAssessment}
                    >
                      Save Round Assessment
                    </Button>
                  </div>
                </div>
              </Card>
            </form>

            {/* PATIENT RECOVERY PROGRESS CHART */}
            <Card>
              <CardHeader
                title="PATIENT RECOVERY PROGRESS GRAPH (0% – 100%)"
                subtitle="Historical recovery trajectory logged across ward rounds"
              />
              <div className="p-6">
                {patientHistory.length === 0 ? (
                  <EmptyState
                    icon={TrendingUp}
                    title="No Historical Assessments Recorded"
                    description="Submit the round assessment above to plot the first recovery point."
                  />
                ) : (
                  <div className="space-y-6">
                    {/* SVG Chart */}
                    <div className="w-full overflow-x-auto">
                      <div className="min-w-[500px]">
                        <svg
                          viewBox="0 0 650 200"
                          className="w-full h-48 select-none"
                        >
                          <defs>
                            <linearGradient id="onRoundGrad" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="0%" stopColor="#10b981" stopOpacity="0.25" />
                              <stop offset="100%" stopColor="#10b981" stopOpacity="0.0" />
                            </linearGradient>
                          </defs>

                          {/* Y-axis lines */}
                          {[100, 75, 50, 25, 0].map((val) => {
                            const y = 20 + ((100 - val) / 100) * 140
                            return (
                              <g key={val}>
                                <line
                                  x1="50"
                                  y1={y}
                                  x2="620"
                                  y2={y}
                                  stroke="#f1f5f9"
                                  strokeDasharray={val === 0 ? "none" : "3,3"}
                                  strokeWidth="1"
                                />
                                <text
                                  x="40"
                                  y={y + 4}
                                  textAnchor="end"
                                  fontSize="10"
                                  fill="#94a3b8"
                                  fontWeight="bold"
                                >
                                  {val}%
                                </text>
                              </g>
                            )
                          })}

                          {/* Render Curve */}
                          {(() => {
                            const padX = 70
                            const usableW = 530
                            const count = patientHistory.length
                            const pts = patientHistory.map((a, i) => {
                              const x = count === 1 ? padX + usableW / 2 : padX + (i / (count - 1)) * usableW
                              const pct = Math.max(0, Math.min(100, a.improvement_percentage))
                              const y = 20 + ((100 - pct) / 100) * 140
                              return { x, y, pct, date: a.created_at }
                            })

                            const pointsStr = pts.map((p) => `${p.x},${p.y}`).join(" ")
                            const areaStr = `${pointsStr} ${pts[pts.length - 1].x},160 ${pts[0].x},160`

                            return (
                              <g>
                                <polygon points={areaStr} fill="url(#onRoundGrad)" />
                                <polyline
                                  fill="none"
                                  stroke="#10b981"
                                  strokeWidth="3"
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  points={pointsStr}
                                />
                                {pts.map((p, idx) => (
                                  <g key={idx}>
                                    <circle
                                      cx={p.x}
                                      cy={p.y}
                                      r="5"
                                      fill="#ffffff"
                                      stroke="#10b981"
                                      strokeWidth="3"
                                    />
                                    <text
                                      x={p.x}
                                      y={p.y - 10}
                                      textAnchor="middle"
                                      fontSize="11"
                                      fontWeight="bold"
                                      fill="#065f46"
                                    >
                                      {p.pct}%
                                    </text>
                                  </g>
                                ))}
                              </g>
                            )
                          })()}
                        </svg>
                      </div>
                    </div>

                    {/* Historical Timeline Cards */}
                    <div className="space-y-3">
                      <span className="text-xs font-bold uppercase tracking-wider text-slate-400 block">
                        Assessment Log Timeline ({patientHistory.length})
                      </span>
                      {[...patientHistory].reverse().map((item, idx) => (
                        <div
                          key={item.id || idx}
                          className="p-3.5 rounded-2xl border border-slate-200/70 bg-slate-50/50 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-xs"
                        >
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-slate-900">
                                Assessment #{item.id || idx + 1}
                              </span>
                              <span className="text-slate-400">·</span>
                              <span className="text-slate-500 font-medium">
                                By {item.doctor_name || "Attending Physician"}
                              </span>
                              <span className="text-slate-400">·</span>
                              <span className="text-slate-400">{formatDate(item.created_at)}</span>
                            </div>
                            {item.clinical_notes && (
                              <p className="text-slate-700 bg-white p-2 rounded-xl border border-slate-200/60 mt-1">
                                {item.clinical_notes}
                              </p>
                            )}
                          </div>

                          <div>
                            <Badge
                              variant={
                                item.improvement_percentage >= 75
                                  ? "success"
                                  : item.improvement_percentage >= 50
                                  ? "info"
                                  : item.improvement_percentage >= 25
                                  ? "warning"
                                  : "danger"
                              }
                              size="sm"
                            >
                              {item.improvement_percentage}% Recovery
                            </Badge>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </Card>
          </div>
        )}

        {/* ACTIVE INPATIENT ROUND ROSTER TABLE */}
        <Card>
          <CardHeader
            title="ACTIVE INPATIENT ROUND ROSTER"
            subtitle="All active patients currently assigned to your clinical roster for bedside evaluation"
          />
          <div className="p-6">
            {patients.length === 0 ? (
              <EmptyState
                icon={Users}
                title="No Inpatients On Roster"
                description="Currently no patients are linked to your doctor ID. Ask your hospital administrator to assign patients to your roster."
              />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-slate-200 text-slate-400 uppercase font-bold text-[10px] tracking-wider">
                      <th className="pb-3">Patient</th>
                      <th className="pb-3">Ward / Bed</th>
                      <th className="pb-3">Admission</th>
                      <th className="pb-3">Chief Complaint</th>
                      <th className="pb-3">Last Assessment</th>
                      <th className="pb-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {patients.map((p) => {
                      const isSel = selectedPatient?.id === p.id
                      return (
                        <tr
                          key={p.id}
                          className={`transition hover:bg-slate-50/80 ${
                            isSel ? "bg-sky-50/40" : ""
                          }`}
                        >
                          <td className="py-3.5 pr-3">
                            <div className="font-bold text-slate-900 text-sm">
                              {p.full_name}
                            </div>
                            <span className="text-[11px] font-mono text-slate-400">
                              #{p.patient_id}
                            </span>
                          </td>

                          <td className="py-3.5 pr-3">
                            <span className="font-semibold text-slate-800">
                              {p.ward_name || "Ward"}
                            </span>
                            <span className="text-slate-400 block text-[11px]">
                              {p.bed_number ? `Bed ${p.bed_number}` : "No bed assigned"}
                            </span>
                          </td>

                          <td className="py-3.5 pr-3 text-slate-600">
                            {formatDate(p.admitted_at)}
                          </td>

                          <td className="py-3.5 pr-3 max-w-[200px] truncate text-slate-700">
                            {p.chief_complaint || "—"}
                          </td>

                          <td className="py-3.5 pr-3">
                            {p.last_assessment ? (
                              <div>
                                <Badge
                                  variant={
                                    p.last_assessment.improvement_percentage >= 75
                                      ? "success"
                                      : p.last_assessment.improvement_percentage >= 50
                                      ? "info"
                                      : "warning"
                                  }
                                  size="sm"
                                >
                                  {p.last_assessment.improvement_percentage}% Recovery
                                </Badge>
                                <span className="text-[10px] text-slate-400 block mt-0.5">
                                  {formatDate(p.last_assessment.created_at).split(",")[0]}
                                </span>
                              </div>
                            ) : (
                              <Badge variant="neutral" size="sm">
                                Not Assessed
                              </Badge>
                            )}
                          </td>

                          <td className="py-3.5 text-right space-x-2">
                            <Button
                              variant="secondary"
                              size="xs"
                              icon={Stethoscope}
                              onClick={() => handleSelectPatient(p)}
                            >
                              Assess
                            </Button>
                            <Button
                              variant="ghost"
                              size="xs"
                              onClick={() => navigate(`/doctor/patients/${p.id}`)}
                            >
                              Chart →
                            </Button>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </Card>
      </div>
    </MainLayout>
  )
}

