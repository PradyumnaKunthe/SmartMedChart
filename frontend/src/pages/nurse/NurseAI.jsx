import React, { useEffect, useState } from "react"
import { useNavigate, useSearchParams } from "react-router-dom"
import {
  AlertTriangle,
  ArrowLeft,
  BrainCircuit,
  Calendar,
  CheckCircle2,
  Clock,
  Eye,
  Info,
  Pill,
  QrCode,
  RefreshCw,
  ShieldAlert,
  Sparkles,
  User,
  Zap,
} from "lucide-react"

import MainLayout from "../../components/layout/MainLayout"
import Card, { CardHeader } from "../../components/common/Card"
import Button from "../../components/common/Button"
import Badge from "../../components/common/Badge"
import Loading from "../../components/common/Loading"
import EmptyState from "../../components/common/EmptyState"
import { getMedicationSchedule } from "../../services/medications"
import { getHighRiskPredictions, predictMedicationRisk } from "../../services/ai"

export default function NurseAI() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const scheduleId = searchParams.get("schedule")

  const [medication, setMedication] = useState(null)
  const [prediction, setPrediction] = useState(null)
  const [highRiskList, setHighRiskList] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  async function loadData() {
    setLoading(true)
    setError("")

    try {
      if (scheduleId) {
        const [medData, aiRes] = await Promise.all([
          getMedicationSchedule(scheduleId),
          predictMedicationRisk(Number(scheduleId)),
        ])
        setMedication(medData)
        setPrediction(aiRes?.prediction || aiRes)
      } else {
        const highRiskData = await getHighRiskPredictions()
        setHighRiskList(Array.isArray(highRiskData) ? highRiskData : [])
      }
    } catch (err) {
      setError(
        err?.response?.data?.detail || "Unable to retrieve clinical risk intelligence."
      )
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [scheduleId])

  if (loading) {
    return (
      <MainLayout title="Nurse AI Risk Intelligence">
        <Loading message="Synthesizing administration risk scores and delay factors..." />
      </MainLayout>
    )
  }

  return (
    <MainLayout
      title="Nurse AI Risk Intelligence"
      subtitle="Real-time predictive analytics to avert medication delays and ensure timely rounds"
    >
      <div className="space-y-6">
        {/* Navigation & Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <Button
            variant="ghost"
            icon={ArrowLeft}
            onClick={() =>
              navigate(scheduleId ? `/nurse/medications/${scheduleId}` : "/nurse/dashboard")
            }
          >
            {scheduleId ? "Back to Dose Details" : "Back to Nurse Dashboard"}
          </Button>

          <Button variant="outline" icon={RefreshCw} onClick={loadData}>
            Refresh Intelligence
          </Button>
        </div>

        {/* Global Error Banner */}
        {error && (
          <div className="flex items-center gap-3 p-4 bg-rose-50 border border-rose-200 rounded-2xl text-rose-700 text-sm">
            <AlertTriangle className="w-5 h-5 shrink-0 text-rose-600" />
            <div className="flex-1 font-medium">{error}</div>
            <Button size="sm" variant="outline" onClick={loadData}>
              Retry
            </Button>
          </div>
        )}

        {/* SINGLE SCHEDULE DEEP DIVE */}
        {scheduleId && medication && prediction ? (
          <div className="space-y-6">
            {/* Top Score Banner */}
            <div className="bg-gradient-to-r from-sky-900 via-indigo-900 to-slate-900 rounded-3xl p-6 lg:p-8 text-white shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-6">
              <div className="space-y-2">
                <div className="inline-flex items-center gap-2 px-3 py-1 bg-white/10 backdrop-blur-md rounded-full text-xs font-semibold text-sky-200">
                  <BrainCircuit className="w-3.5 h-3.5" /> Predictive Nursing Intelligence
                </div>
                <h2 className="text-2xl font-bold tracking-tight">
                  Risk Analysis: {medication.medicine_name || medication.medication_name}
                </h2>
                <p className="text-slate-300 text-sm max-w-xl">
                  Evaluated against historical ward administration timing, patient
                  demographics, and regimen complexity.
                </p>
              </div>

              <div className="flex items-center gap-4 bg-white/10 backdrop-blur-md border border-white/15 rounded-2xl p-4 shrink-0">
                <div className="text-right">
                  <div className="text-[11px] font-bold uppercase tracking-wider text-slate-300">
                    Delay Risk Level
                  </div>
                  <div className="text-xl font-extrabold text-white">
                    {prediction.risk_level || "EVALUATING"}
                  </div>
                </div>
                <div
                  className={`w-12 h-12 rounded-xl flex items-center justify-center font-black text-lg ${
                    prediction.risk_level === "HIGH"
                      ? "bg-rose-500 text-white"
                      : prediction.risk_level === "MEDIUM"
                      ? "bg-amber-500 text-white"
                      : "bg-emerald-500 text-white"
                  }`}
                >
                  {prediction.risk_level === "HIGH" ? (
                    <AlertTriangle className="w-6 h-6" />
                  ) : (
                    <CheckCircle2 className="w-6 h-6" />
                  )}
                </div>
              </div>
            </div>

            {/* Probability Gauges */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Delay Probability Gauge */}
              <Card>
                <CardHeader
                  title="Delay Probability"
                  subtitle="Likelihood of dose being administered >30 min past schedule"
                />
                <div className="p-6 space-y-4">
                  <div className="flex items-baseline justify-between">
                    <span className="text-4xl font-extrabold text-slate-900">
                      {Math.round((prediction.delay_probability || 0) * 100)}%
                    </span>
                    <Badge
                      variant={
                        (prediction.delay_probability || 0) > 0.5 ? "danger" : "success"
                      }
                      size="md"
                    >
                      {(prediction.delay_probability || 0) > 0.5
                        ? "Elevated Risk"
                        : "Nominal Risk"}
                    </Badge>
                  </div>

                  {/* Progress bar */}
                  <div className="w-full bg-slate-100 rounded-full h-3 overflow-hidden">
                    <div
                      className={`h-full transition-all duration-500 rounded-full ${
                        (prediction.delay_probability || 0) > 0.5
                          ? "bg-rose-500"
                          : (prediction.delay_probability || 0) > 0.25
                          ? "bg-amber-500"
                          : "bg-emerald-500"
                      }`}
                      style={{
                        width: `${Math.min(
                          100,
                          Math.max(5, (prediction.delay_probability || 0) * 100)
                        )}%`,
                      }}
                    />
                  </div>
                  <p className="text-xs text-slate-500">
                    Proactive mitigation recommended if scheduled window overlaps shift changeover.
                  </p>
                </div>
              </Card>

              {/* Missed Dose Risk Gauge */}
              <Card>
                <CardHeader
                  title="Missed / Omitted Dose Risk"
                  subtitle="Probability of complete dose omission or patient refusal"
                />
                <div className="p-6 space-y-4">
                  <div className="flex items-baseline justify-between">
                    <span className="text-4xl font-extrabold text-slate-900">
                      {Math.round((prediction.missed_probability || 0.08) * 100)}%
                    </span>
                    <Badge
                      variant={
                        (prediction.missed_probability || 0) > 0.3 ? "warning" : "success"
                      }
                      size="md"
                    >
                      {(prediction.missed_probability || 0) > 0.3
                        ? "Attention Required"
                        : "Within Safety Margin"}
                    </Badge>
                  </div>

                  <div className="w-full bg-slate-100 rounded-full h-3 overflow-hidden">
                    <div
                      className="h-full bg-sky-500 rounded-full transition-all duration-500"
                      style={{
                        width: `${Math.min(
                          100,
                          Math.max(5, (prediction.missed_probability || 0.08) * 100)
                        )}%`,
                      }}
                    />
                  </div>
                  <p className="text-xs text-slate-500">
                    Cross-reference patient compliance notes and bedside dietary constraints.
                  </p>
                </div>
              </Card>
            </div>

            {/* Contributing Factors & Recommendations */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card>
                <CardHeader
                  title="Identified Contributing Factors"
                  subtitle="Key signals contributing to the calculated risk score"
                />
                <div className="p-6">
                  {prediction.contributing_factors &&
                  prediction.contributing_factors.length > 0 ? (
                    <div className="space-y-2">
                      {prediction.contributing_factors.map((factor, idx) => (
                        <div
                          key={idx}
                          className="flex items-center gap-2.5 p-3 rounded-xl bg-slate-50 border border-slate-200/80 text-xs font-semibold text-slate-700"
                        >
                          <span className="w-2 h-2 rounded-full bg-sky-500" />
                          <span>{factor}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-slate-500 italic">
                      No adverse risk factors flagged for this administration event.
                    </p>
                  )}
                </div>
              </Card>

              <Card>
                <CardHeader
                  title="Clinical Nursing Recommendations"
                  subtitle="Suggested best practices for bedside rounds"
                />
                <div className="p-6 space-y-3">
                  <div className="p-4 bg-sky-50 border border-sky-200/80 rounded-2xl text-xs text-sky-950 font-medium leading-relaxed">
                    {prediction.recommendations ||
                      "Verify patient wristband barcode, confirm allergy clearance, and pre-prepare medication cup 10 minutes prior to scheduled administration time."}
                  </div>

                  <div className="flex items-center justify-end gap-2 pt-2">
                    <Button
                      variant="primary"
                      icon={QrCode}
                      onClick={() => navigate(`/nurse/scanner?schedule=${scheduleId}`)}
                    >
                      Scan Wristband & Administer Now
                    </Button>
                  </div>
                </div>
              </Card>
            </div>
          </div>
        ) : (
          /* HIGH-RISK SURVEILLANCE BOARD (When no specific schedule is selected) */
          <div className="space-y-4">
            <div className="p-5 bg-gradient-to-r from-sky-500/10 via-indigo-500/5 to-transparent border-l-4 border-sky-500 rounded-r-2xl">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-sky-600" /> Ward-Wide High-Risk Schedule Surveillance
              </h3>
              <p className="text-xs text-slate-600 mt-1">
                The AI model proactively scans pending medication schedules across all
                assigned inpatients to highlight regimens with high delay risk.
              </p>
            </div>

            {highRiskList.length === 0 ? (
              <EmptyState
                icon={CheckCircle2}
                title="All Schedules Clear"
                description="No high-risk medication schedules currently flagged on this nursing shift."
                actionLabel="View Medication Queue"
                onAction={() => navigate("/nurse/medications")}
              />
            ) : (
              <Card>
                <div className="divide-y divide-slate-100">
                  {highRiskList.map((item, idx) => (
                    <div
                      key={idx}
                      className="p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:bg-slate-50/70 transition-colors"
                    >
                      <div className="flex items-start gap-3.5">
                        <div className="w-10 h-10 rounded-xl bg-rose-100 text-rose-700 flex items-center justify-center shrink-0">
                          <AlertTriangle className="w-5 h-5" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h4 className="text-sm font-bold text-slate-900">
                              Schedule #{item.schedule_id || item.id}
                            </h4>
                            <Badge variant="danger" size="sm">
                              {item.risk_level || "HIGH RISK"}
                            </Badge>
                          </div>
                          <p className="text-xs text-slate-600 mt-1">
                            {item.reason || item.recommendations || "Potential administration delay flagged."}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <Button
                          size="sm"
                          variant="primary"
                          icon={Eye}
                          onClick={() =>
                            navigate(`/nurse/ai?schedule=${item.schedule_id || item.id}`)
                          }
                        >
                          Inspect Risk Details
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            )}
          </div>
        )}
      </div>
    </MainLayout>
  )
}