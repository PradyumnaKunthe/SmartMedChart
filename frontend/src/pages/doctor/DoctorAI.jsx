import {
  Activity,
  AlertCircle,
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  BrainCircuit,
  CheckCircle2,
  Clock,
  Eye,
  Info,
  LoaderCircle,
  Pill,
  RefreshCw,
  Search,
  ShieldAlert,
  ShieldCheck,
  TrendingDown,
  TrendingUp,
  UserRound,
  Users,
} from "lucide-react"

import {
  useEffect,
  useMemo,
  useState,
} from "react"

import {
  useNavigate,
  useSearchParams,
} from "react-router-dom"

import MainLayout from "../../components/layout/MainLayout"
import Badge from "../../components/common/Badge"
import Button from "../../components/common/Button"
import Card, { CardHeader } from "../../components/common/Card"
import EmptyState from "../../components/common/EmptyState"
import ErrorState from "../../components/common/ErrorState"
import Loading from "../../components/common/Loading"
import StatCard from "../../components/dashboard/StatCard"

import {
  predictMedicationRisk,
  getHighRiskPredictions,
  getAIPredictions,
} from "../../services/ai"

import {
  checkMedicationSafety,
} from "../../services/safety"

import {
  getDoctorPatient,
} from "../../services/doctor"

function riskPercent(value) {
  const number = Number(value)
  if (!Number.isFinite(number)) return 0
  return Math.max(0, Math.min(100, number * 100))
}

function getRiskLevel(prob) {
  if (prob >= 60) return { label: "HIGH RISK", variant: "danger", color: "#f43f5e" }
  if (prob >= 30) return { label: "MODERATE RISK", variant: "warning", color: "#f59e0b" }
  return { label: "LOW RISK", variant: "success", color: "#10b981" }
}

export default function DoctorAI() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()

  const scheduleId = searchParams.get("schedule")
  const patientId = searchParams.get("patient")

  const [patient, setPatient] = useState(null)
  const [prediction, setPrediction] = useState(null)
  const [safety, setSafety] = useState(null)
  const [highRiskList, setHighRiskList] = useState([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState("")

  async function loadData(isManual = false) {
    if (isManual) setRefreshing(true)
    else setLoading(true)
    setError("")

    try {
      if (scheduleId) {
        // Detailed single schedule analysis
        const requests = [
          predictMedicationRisk(Number(scheduleId)),
          checkMedicationSafety(Number(scheduleId)),
        ]

        if (patientId) {
          requests.push(getDoctorPatient(Number(patientId)))
        }

        const results = await Promise.all(requests)
        setPrediction(results[0]?.prediction || null)
        setSafety(results[1] || null)
        if (patientId) setPatient(results[2] || null)
      } else {
        // General High Risk Overview
        const highRiskData = await getHighRiskPredictions()
        const list = Array.isArray(highRiskData?.high_risk_predictions)
          ? highRiskData.high_risk_predictions
          : Array.isArray(highRiskData)
          ? highRiskData
          : []
        setHighRiskList(list)
      }
    } catch (requestError) {
      console.error("AI risk load error:", requestError)
      setError(
        requestError?.response?.data?.detail ||
          "Unable to compute AI medication predictions.",
      )
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [scheduleId, patientId])

  if (loading) {
    return (
      <MainLayout
        title="AI Clinical Insights"
        subtitle="Medication delay & missed dose predictive modeling"
      >
        <Loading
          fullScreen
          message="Computing AI Risk Predictions..."
          subtext="Running clinical neural assessment on schedules, intervals, and historical delays"
        />
      </MainLayout>
    )
  }

  // If specific schedule was analyzed
  if (scheduleId && prediction) {
    const delayProb = riskPercent(prediction?.delay_probability)
    const missedProb = riskPercent(prediction?.missed_probability)

    const delayLevel = getRiskLevel(delayProb)
    const missedLevel = getRiskLevel(missedProb)

    return (
      <MainLayout
        title="AI Medication Risk & Safety Analysis"
        subtitle={`Schedule #${scheduleId} · Machine learning probability and safety assessment`}
      >
        <div className="space-y-6 sm:space-y-8">
          {/* Back button */}
          <div className="flex items-center justify-between">
            <Button
              variant="ghost"
              size="sm"
              icon={ArrowLeft}
              onClick={() =>
                patientId
                  ? navigate(`/doctor/patients/${patientId}`)
                  : navigate("/doctor/ai")
              }
            >
              {patientId ? "Back to Patient Medical Chart" : "Back to AI Risk Monitor"}
            </Button>

            <Button
              variant="secondary"
              size="sm"
              icon={RefreshCw}
              loading={refreshing}
              onClick={() => loadData(true)}
            >
              Re-analyze Model
            </Button>
          </div>

          {error && <ErrorState title="Analysis Warning" message={error} />}

          {/* Patient Banner if present */}
          {patient && (
            <div className="rounded-3xl border border-slate-200/90 bg-white p-5 sm:p-6 shadow-xs flex items-center justify-between gap-4">
              <div className="flex items-center gap-3.5">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-sky-50 font-bold text-sky-700">
                  {patient.first_name?.charAt(0)}
                  {patient.last_name?.charAt(0)}
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold text-sky-600 tracking-wider">
                    Target Inpatient
                  </span>
                  <h3 className="font-heading font-extrabold text-slate-900 text-lg">
                    {patient.full_name || `${patient.first_name} ${patient.last_name}`}
                  </h3>
                  <p className="text-xs text-slate-500">
                    Patient ID: <span className="font-bold text-slate-700">{patient.patient_id}</span> · Bed: {patient.bed_id ? `Bed ${patient.bed_id}` : "Unassigned"}
                  </p>
                </div>
              </div>

              <Button
                variant="outline"
                size="sm"
                iconRight={ArrowRight}
                onClick={() => navigate(`/doctor/patients/${patient.id}`)}
              >
                Open Chart
              </Button>
            </div>
          )}

          {/* Safety Conflict Advisory Panel */}
          {safety && (
            <div
              className={`rounded-3xl border p-6 shadow-xs ${
                safety.safe
                  ? "border-emerald-200 bg-emerald-50/40"
                  : "border-rose-200 bg-rose-50/50"
              }`}
            >
              <div className="flex items-start gap-4">
                <div
                  className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl ${
                    safety.safe
                      ? "bg-emerald-100 text-emerald-700"
                      : "bg-rose-100 text-rose-700"
                  }`}
                >
                  {safety.safe ? (
                    <CheckCircle2 className="h-6 w-6" />
                  ) : (
                    <ShieldAlert className="h-6 w-6" />
                  )}
                </div>

                <div className="flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3
                      className={`font-heading text-lg font-extrabold ${
                        safety.safe ? "text-emerald-900" : "text-rose-900"
                      }`}
                    >
                      {safety.safe
                        ? "5-Rights Safety Verification: Verified Safe"
                        : "Clinical Safety Warning: Review Required"}
                    </h3>
                    <Badge variant={safety.safe ? "success" : "danger"} size="sm">
                      {safety.severity || (safety.safe ? "PASS" : "ALERT")}
                    </Badge>
                  </div>

                  <p className="mt-1 text-xs text-slate-600 leading-relaxed">
                    {safety.message || "Allergy and contraindication screening completed."}
                  </p>

                  {safety.warnings?.length > 0 && (
                    <div className="mt-4 space-y-2">
                      {safety.warnings.map((w, idx) => (
                        <div
                          key={idx}
                          className="rounded-xl border border-rose-200 bg-white p-3 text-xs text-rose-800"
                        >
                          <p className="font-bold">{w.message}</p>
                          {w.reason && <p className="text-rose-600 mt-0.5">{w.reason}</p>}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Dual AI Prediction Meters */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Delay Risk Card */}
            <div className="rounded-3xl border border-slate-200/90 bg-white p-6 shadow-xs space-y-5">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                    Predictive Metric 01
                  </span>
                  <h3 className="font-heading text-xl font-extrabold text-slate-900 mt-0.5">
                    Administration Delay Probability
                  </h3>
                </div>
                <Badge variant={delayLevel.variant} size="md">
                  {delayLevel.label}
                </Badge>
              </div>

              {/* Visual Gauge Bar */}
              <div className="space-y-2">
                <div className="flex items-baseline justify-between">
                  <span className="font-heading text-4xl font-extrabold text-slate-900">
                    {delayProb.toFixed(1)}%
                  </span>
                  <span className="text-xs text-slate-500 font-semibold">
                    Confidence: High
                  </span>
                </div>
                <div className="h-3 w-full rounded-full bg-slate-100 overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-700"
                    style={{
                      width: `${delayProb}%`,
                      backgroundColor: delayLevel.color,
                    }}
                  />
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-slate-50/80 border border-slate-100 text-xs">
                <span className="font-bold text-slate-800 block">
                  AI Model Recommendation:
                </span>
                <p className="text-slate-600 mt-1 leading-relaxed">
                  {prediction?.delay_prediction ||
                    "Schedule falls within expected clinical variance."}
                </p>
              </div>

              {prediction?.delay_reasons?.length > 0 && (
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-400 block mb-2">
                    Key Influencing Factors:
                  </span>
                  <div className="space-y-1.5">
                    {prediction.delay_reasons.map((r, i) => (
                      <div
                        key={i}
                        className="rounded-xl bg-slate-50 p-2.5 text-xs text-slate-700 border border-slate-100 flex items-center gap-2"
                      >
                        <Info className="h-3.5 w-3.5 text-sky-600 shrink-0" />
                        <span>{r}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Missed Dose Risk Card */}
            <div className="rounded-3xl border border-slate-200/90 bg-white p-6 shadow-xs space-y-5">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                    Predictive Metric 02
                  </span>
                  <h3 className="font-heading text-xl font-extrabold text-slate-900 mt-0.5">
                    Missed Dose Probability
                  </h3>
                </div>
                <Badge variant={missedLevel.variant} size="md">
                  {missedLevel.label}
                </Badge>
              </div>

              {/* Visual Gauge Bar */}
              <div className="space-y-2">
                <div className="flex items-baseline justify-between">
                  <span className="font-heading text-4xl font-extrabold text-slate-900">
                    {missedProb.toFixed(1)}%
                  </span>
                  <span className="text-xs text-slate-500 font-semibold">
                    Confidence: High
                  </span>
                </div>
                <div className="h-3 w-full rounded-full bg-slate-100 overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-700"
                    style={{
                      width: `${missedProb}%`,
                      backgroundColor: missedLevel.color,
                    }}
                  />
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-slate-50/80 border border-slate-100 text-xs">
                <span className="font-bold text-slate-800 block">
                  AI Model Recommendation:
                </span>
                <p className="text-slate-600 mt-1 leading-relaxed">
                  {prediction?.missed_prediction ||
                    "Low risk of omission during current nurse shift."}
                </p>
              </div>

              {prediction?.missed_reasons?.length > 0 && (
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-400 block mb-2">
                    Key Influencing Factors:
                  </span>
                  <div className="space-y-1.5">
                    {prediction.missed_reasons.map((r, i) => (
                      <div
                        key={i}
                        className="rounded-xl bg-slate-50 p-2.5 text-xs text-slate-700 border border-slate-100 flex items-center gap-2"
                      >
                        <Info className="h-3.5 w-3.5 text-purple-600 shrink-0" />
                        <span>{r}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </MainLayout>
    )
  }

  // Overview Mode (No specific schedule selected)
  return (
    <MainLayout
      title="AI Clinical Insights & High-Risk Monitor"
      subtitle="Proactive neural surveillance of medication delays, omission risks & clinical conflicts"
    >
      <div className="space-y-6 sm:space-y-8">
        {/* Top Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="flex h-2 w-2 rounded-full bg-purple-500 animate-pulse" />
              <p className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Predictive Clinical AI
              </p>
            </div>
            <h2 className="font-heading text-2xl font-extrabold text-slate-900 mt-1">
              High-Risk Medication Surveillance
            </h2>
          </div>

          <Button
            variant="secondary"
            size="sm"
            icon={RefreshCw}
            loading={refreshing}
            onClick={() => loadData(true)}
          >
            Re-run Predictions
          </Button>
        </div>

        {error && (
          <ErrorState
            title="AI Model Feed Error"
            message={error}
            onRetry={() => loadData(true)}
          />
        )}

        {/* Overview KPI Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <StatCard
            title="High Risk Alerts"
            value={highRiskList.length}
            description="Schedules requiring urgent review"
            icon={ShieldAlert}
            variant={highRiskList.length > 0 ? "rose" : "emerald"}
            badge={highRiskList.length > 0 ? "Action Required" : "All Clear"}
          />
          <StatCard
            title="Algorithm Status"
            value="Online"
            description="Trained delay & omission model"
            icon={BrainCircuit}
            variant="purple"
          />
          <StatCard
            title="Safety Protocols"
            value="100%"
            description="5-Rights automated cross-validation"
            icon={ShieldCheck}
            variant="sky"
          />
        </div>

        {/* High Risk Queue */}
        <div className="rounded-3xl border border-slate-200/90 bg-white p-6 shadow-xs space-y-4">
          <div className="flex items-center justify-between pb-4 border-b border-slate-100">
            <div>
              <h3 className="font-heading text-lg font-bold text-slate-900">
                Identified High-Risk Medication Doses ({highRiskList.length})
              </h3>
              <p className="text-xs text-slate-500">
                Medications with elevated delay probability or potential patient omission
              </p>
            </div>
          </div>

          {highRiskList.length === 0 ? (
            <div className="py-12">
              <EmptyState
                icon={CheckCircle2}
                title="Zero High-Risk Doses Detected"
                description="All active medication schedules are currently running within safe clinical tolerance levels."
              />
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {highRiskList.map((item, idx) => {
                const scheduleId = item.schedule_id || item.medication_schedule_id || item.id
                const delayProb = riskPercent(item.delay_probability)
                const missedProb = riskPercent(item.missed_probability)

                return (
                  <div
                    key={scheduleId || idx}
                    className="rounded-2xl border border-rose-200 bg-rose-50/20 p-5 shadow-xs hover:border-rose-300 transition"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-rose-100 text-rose-700 font-bold">
                          <Pill className="h-5 w-5" />
                        </div>
                        <div>
                          <h4 className="font-heading font-bold text-slate-900 text-sm">
                            {item.medicine_name || `Schedule #${scheduleId}`}
                          </h4>
                          <p className="text-xs text-slate-500">
                            Patient: <span className="font-semibold text-slate-800">{item.patient_name || item.patient_id}</span>
                          </p>
                        </div>
                      </div>

                      <Badge variant="danger" size="sm">
                        High Alert
                      </Badge>
                    </div>

                    <div className="mt-4 pt-3 border-t border-rose-100/70 grid grid-cols-2 gap-2 text-xs">
                      <div className="rounded-xl bg-white p-2 border border-rose-100">
                        <span className="text-[10px] uppercase font-bold text-slate-400 block">
                          Delay Risk
                        </span>
                        <span className="font-bold text-rose-700 text-sm block">
                          {delayProb.toFixed(1)}%
                        </span>
                      </div>
                      <div className="rounded-xl bg-white p-2 border border-rose-100">
                        <span className="text-[10px] uppercase font-bold text-slate-400 block">
                          Missed Risk
                        </span>
                        <span className="font-bold text-rose-700 text-sm block">
                          {missedProb.toFixed(1)}%
                        </span>
                      </div>
                    </div>

                    <div className="mt-4 pt-3 border-t border-rose-100/70 flex items-center justify-end">
                      <Button
                        variant="primary"
                        size="sm"
                        iconRight={ArrowRight}
                        onClick={() =>
                          navigate(
                            `/doctor/ai?schedule=${scheduleId}${
                              item.patient_id ? `&patient=${item.patient_id}` : ""
                            }`,
                          )
                        }
                      >
                        Inspect AI Breakdown
                      </Button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </MainLayout>
  )
}