import {
  Download,
  Printer,
  QrCode,
  RefreshCw,
  Search,
  ShieldCheck,
  UserRound,
  X,
} from "lucide-react"

import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react"

import {
  QRCodeCanvas,
} from "qrcode.react"

import MainLayout from "../../components/layout/MainLayout"
import Badge from "../../components/common/Badge"
import Button from "../../components/common/Button"
import EmptyState from "../../components/common/EmptyState"
import ErrorState from "../../components/common/ErrorState"
import Loading from "../../components/common/Loading"
import Modal from "../../components/common/Modal"
import StatCard from "../../components/dashboard/StatCard"

import {
  getAdminPatients,
  generatePatientQR,
} from "../../services/admin"

import {
  hideTestPatients,
} from "../../utils/patientFilter"

export default function PatientQR() {
  const [patients, setPatients] = useState([])
  const [search, setSearch] = useState("")
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [generatingId, setGeneratingId] = useState(null)
  const [error, setError] = useState("")
  const [generatedQR, setGeneratedQR] = useState(null)

  const qrCanvasRef = useRef(null)

  async function loadPatients(isManual = false) {
    if (isManual) setRefreshing(true)
    else setLoading(true)
    setError("")

    try {
      const response = await getAdminPatients()
      const rawPatients = Array.isArray(response)
        ? response
        : Array.isArray(response?.patients)
        ? response.patients
        : []

      setPatients(hideTestPatients(rawPatients))
    } catch (requestError) {
      console.error("Unable to load patients:", requestError)
      setError(
        requestError?.response?.data?.detail ||
          requestError?.message ||
          "Unable to load patient QR registry.",
      )
      setPatients([])
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => {
    loadPatients()
  }, [])

  const filteredPatients = useMemo(() => {
    const query = search.trim().toLowerCase()
    if (!query) return patients

    return patients.filter((patient) => {
      const fullName =
        patient.full_name ||
        `${patient.first_name || ""} ${patient.last_name || ""}`

      return (
        String(fullName).toLowerCase().includes(query) ||
        String(patient.patient_id || "").toLowerCase().includes(query)
      )
    })
  }, [patients, search])

  async function handleGenerateQR(patient) {
    setGeneratingId(patient.id)
    setError("")
    setGeneratedQR(null)

    try {
      const result = await generatePatientQR(patient.id)
      setGeneratedQR({
        ...result,
        patient,
      })
    } catch (requestError) {
      console.error("QR generation failed:", requestError)
      setError(
        requestError?.response?.data?.detail ||
          requestError?.message ||
          "Unable to generate patient QR badge.",
      )
    } finally {
      setGeneratingId(null)
    }
  }

  function downloadQR() {
    const canvas = qrCanvasRef.current
    if (!canvas) {
      setError("QR image canvas is not available.")
      return
    }

    const image = canvas.toDataURL("image/png")
    const patient = generatedQR?.patient
    const patientName =
      patient?.full_name ||
      `${patient?.first_name || "patient"} ${patient?.last_name || ""}`

    const link = document.createElement("a")
    link.href = image
    link.download = `${patientName
      .trim()
      .replace(/\s+/g, "_")
      .toLowerCase()}_patient_qr.png`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  function handlePrint() {
    window.print()
  }

  if (loading) {
    return (
      <MainLayout
        title="Patient QR System"
        subtitle="Cryptographically verified wristband QR tokens"
      >
        <Loading
          fullScreen
          message="Loading Patient QR Registry..."
          subtext="Preparing wristband tokens and identity verification codes"
        />
      </MainLayout>
    )
  }

  const activeQRPatientsCount = patients.filter((p) => p.qr_is_active || p.qr_token).length

  return (
    <MainLayout
      title="Patient QR Wristband System"
      subtitle="Issue and verify cryptographically secured clinical barcode wristbands for 5-Rights medication safety"
    >
      <div className="space-y-6 sm:space-y-8">
        {/* Top Header & Actions */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="flex h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
              <p className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Patient Safety & Identification
              </p>
            </div>
            <h2 className="font-heading text-2xl font-extrabold text-slate-900 mt-1">
              QR Wristband Generator
            </h2>
          </div>

          <div className="flex items-center gap-3">
            <Button
              variant="secondary"
              size="sm"
              icon={RefreshCw}
              loading={refreshing}
              onClick={() => loadPatients(true)}
            >
              Refresh
            </Button>
          </div>
        </div>

        {error && (
          <ErrorState
            title="QR Generation Issue"
            message={error}
            onRetry={() => loadPatients(true)}
          />
        )}

        {/* KPI Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <StatCard
            title="Total Registered Inpatients"
            value={patients.length}
            description="Eligible for wristband badge"
            icon={UserRound}
            variant="sky"
          />
          <StatCard
            title="Active QR Wristbands"
            value={activeQRPatientsCount}
            description="Verified tokens in circulation"
            icon={QrCode}
            variant="emerald"
            badge="Active"
          />
          <StatCard
            title="Verification Protocol"
            value="5-Rights"
            description="Patient, Med, Dose, Route, Time"
            icon={ShieldCheck}
            variant="indigo"
          />
        </div>

        {/* Search Bar */}
        <div className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200/90 bg-white p-3 shadow-xs">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search patients by name or ID to generate QR wristband..."
              className="w-full rounded-xl border border-slate-200 bg-slate-50/70 py-2.5 pl-9 pr-8 text-xs font-medium text-slate-900 outline-none transition focus:border-sky-500 focus:bg-white focus:ring-2 focus:ring-sky-100"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
          <span className="text-xs text-slate-400 font-semibold px-2">
            {filteredPatients.length} found
          </span>
        </div>

        {/* Patient Grid */}
        {filteredPatients.length === 0 ? (
          <EmptyState
            icon={QrCode}
            title="No Patients Found"
            description={
              search
                ? `No patient records match "${search}".`
                : "No patients are registered in the system."
            }
          />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredPatients.map((patient) => {
              const fullName =
                patient.full_name ||
                `${patient.first_name || ""} ${patient.last_name || ""}`.trim() ||
                "Inpatient"

              const initials = fullName
                .split(" ")
                .map((w) => w[0])
                .join("")
                .slice(0, 2)
                .toUpperCase()

              const isGenerating = generatingId === patient.id

              return (
                <div
                  key={patient.id}
                  className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-xs transition hover:border-sky-300 hover:shadow-md"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-sky-50 font-bold text-xs text-sky-700 border border-sky-100">
                        {initials}
                      </div>
                      <div className="min-w-0">
                        <h4 className="font-heading font-bold text-slate-900 text-sm truncate">
                          {fullName}
                        </h4>
                        <p className="text-xs text-slate-500 mt-0.5">
                          ID: <span className="font-semibold text-slate-700">{patient.patient_id}</span>
                        </p>
                      </div>
                    </div>

                    <Badge
                      variant={patient.is_active ? "success" : "neutral"}
                      size="sm"
                    >
                      {patient.is_active ? "Active" : "Discharged"}
                    </Badge>
                  </div>

                  <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
                    <span className="text-[11px] text-slate-400">
                      Bed: {patient.bed_id ? `Bed ${patient.bed_id}` : "Unassigned"}
                    </span>

                    <Button
                      variant="primary"
                      size="sm"
                      icon={QrCode}
                      loading={isGenerating}
                      onClick={() => handleGenerateQR(patient)}
                    >
                      Generate QR
                    </Button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* QR Badge Modal */}
      <Modal
        open={Boolean(generatedQR)}
        onClose={() => setGeneratedQR(null)}
        title="Patient Wristband QR Badge"
        subtitle="Official hospital identification token for bedside verification"
        maxWidth="max-w-md"
      >
        {generatedQR && (
          <div className="space-y-5 text-center">
            {/* ID Card Styled Container */}
            <div className="rounded-3xl border-2 border-dashed border-sky-300 bg-gradient-to-b from-sky-50/60 to-white p-6 shadow-xs">
              <div className="flex items-center justify-center gap-2 mb-3">
                <span className="h-2 w-2 rounded-full bg-emerald-500" />
                <span className="text-xs font-extrabold uppercase tracking-widest text-sky-700">
                  SmartMedChart Hospital System
                </span>
              </div>

              {/* QR Code Canvas */}
              <div className="mx-auto flex h-48 w-48 items-center justify-center rounded-2xl bg-white p-3 shadow-md border border-slate-200">
                <QRCodeCanvas
                  ref={qrCanvasRef}
                  value={generatedQR.qr_token || generatedQR.token || ""}
                  size={168}
                  level="H"
                  includeMargin={false}
                />
              </div>

              <div className="mt-4">
                <h3 className="font-heading text-lg font-extrabold text-slate-900">
                  {generatedQR.patient?.full_name ||
                    `${generatedQR.patient?.first_name || ""} ${generatedQR.patient?.last_name || ""}`}
                </h3>
                <p className="text-xs font-semibold text-slate-500 mt-0.5">
                  Patient Code: <span className="text-slate-800">{generatedQR.patient?.patient_id}</span>
                </p>
                <p className="text-[11px] text-slate-400 mt-1 font-mono truncate px-4">
                  Token: {generatedQR.qr_token?.slice(0, 18)}...
                </p>
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-center gap-2 pt-2">
              <Button
                variant="secondary"
                size="sm"
                icon={Printer}
                onClick={handlePrint}
              >
                Print Badge
              </Button>
              <Button
                variant="primary"
                size="sm"
                icon={Download}
                onClick={downloadQR}
              >
                Download PNG
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </MainLayout>
  )
}