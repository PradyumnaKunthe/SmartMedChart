import React, { useEffect, useState } from "react"
import { useNavigate, useParams, useSearchParams } from "react-router-dom"
import {
  AlertTriangle,
  ArrowLeft,
  Calendar,
  CheckCircle2,
  Clock,
  Edit,
  Pill,
  Save,
  User,
  Zap,
} from "lucide-react"

import MainLayout from "../../components/layout/MainLayout"
import Card, { CardHeader } from "../../components/common/Card"
import Button from "../../components/common/Button"
import Badge from "../../components/common/Badge"
import Loading from "../../components/common/Loading"
import {
  getDoctorMedicines,
  getPrescriptionHistory,
  updatePrescription,
} from "../../services/doctor"

const FREQUENCIES = [
  { value: "ONCE_DAILY", label: "Once Daily (QD)" },
  { value: "TWICE_DAILY", label: "Twice Daily (BID)" },
  { value: "EVERY_8_HOURS", label: "Every 8 Hours (TID)" },
  { value: "EVERY_6_HOURS", label: "Every 6 Hours (QID)" },
]

export default function EditPrescription() {
  const { prescriptionId } = useParams()
  const [searchParams] = useSearchParams()
  const patientId = searchParams.get("patient")
  const navigate = useNavigate()

  const [prescription, setPrescription] = useState(null)
  const [medicines, setMedicines] = useState([])
  const [form, setForm] = useState({
    medicine_id: "",
    dose: "",
    route: "",
    frequency: "ONCE_DAILY",
    duration_days: 1,
    start_date: "",
    start_time: "",
    is_stat: false,
    instructions: "",
    notes: "",
  })

  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState(null)

  useEffect(() => {
    async function loadData() {
      if (!prescriptionId) {
        setError("Prescription identifier is missing.")
        setLoading(false)
        return
      }

      setLoading(true)
      setError("")

      try {
        const [medicinesData, historyData] = await Promise.all([
          getDoctorMedicines(),
          patientId ? getPrescriptionHistory(patientId) : Promise.resolve([]),
        ])

        const medList = Array.isArray(medicinesData) ? medicinesData : []
        setMedicines(medList)

        const historyList = Array.isArray(historyData) ? historyData : []
        const currentPrescription = historyList.find(
          (item) => String(item.id) === String(prescriptionId)
        )

        if (!currentPrescription) {
          setError(`Prescription record #${prescriptionId} could not be located.`)
          setLoading(false)
          return
        }

        setPrescription(currentPrescription)

        const matchedMedicine = medList.find(
          (item) =>
            item.name &&
            currentPrescription.medicine_name &&
            item.name.toLowerCase() === currentPrescription.medicine_name.toLowerCase()
        )

        setForm({
          medicine_id: matchedMedicine?.id ? String(matchedMedicine.id) : "",
          dose: currentPrescription.dose || "",
          route: currentPrescription.route || "Oral",
          frequency: currentPrescription.frequency || "ONCE_DAILY",
          duration_days: currentPrescription.duration_days || 1,
          start_date: currentPrescription.start_date || "",
          start_time: currentPrescription.start_time
            ? currentPrescription.start_time.slice(0, 5)
            : "08:00",
          is_stat: Boolean(currentPrescription.is_stat),
          instructions: currentPrescription.instructions || "",
          notes: currentPrescription.prescription_notes || "",
        })
      } catch (requestError) {
        setError(
          requestError?.response?.data?.detail ||
            requestError?.message ||
            "Unable to load prescription."
        )
      } finally {
        setLoading(false)
      }
    }

    loadData()
  }, [patientId, prescriptionId])

  function handleChange(event) {
    const { name, value, type, checked } = event.target
    setForm((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }))
  }

  async function handleSubmit(event) {
    event.preventDefault()
    setSubmitting(true)
    setError("")
    setSuccess(null)

    try {
      const payload = {
        medicine_id: Number(form.medicine_id),
        dose: form.dose.trim(),
        route: form.route.trim(),
        frequency: form.frequency,
        duration_days: Number(form.duration_days),
        start_date: form.start_date,
        start_time: form.start_time,
        is_stat: Boolean(form.is_stat),
        instructions: form.instructions.trim() || null,
        notes: form.notes.trim() || null,
      }

      const result = await updatePrescription(prescriptionId, payload)
      setSuccess(result || { updated: true })
    } catch (requestError) {
      setError(
        requestError?.response?.data?.detail || "Unable to update prescription record."
      )
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <MainLayout title="Edit Prescription">
        <Loading message="Loading prescription details..." />
      </MainLayout>
    )
  }

  return (
    <MainLayout
      title="Edit Prescription"
      subtitle={`Prescription #${prescriptionId} · Modify dosing regimen and administration parameters`}
    >
      <div className="mx-auto max-w-4xl space-y-6">
        {/* Navigation & Header */}
        <div className="flex items-center justify-between">
          <Button
            variant="ghost"
            icon={ArrowLeft}
            onClick={() =>
              navigate(patientId ? `/doctor/patients/${patientId}` : "/doctor/patients")
            }
          >
            Back to Patient
          </Button>

          {prescription && (
            <Badge variant="primary" size="md">
              Current: {prescription.medicine_name} · {prescription.dose}
            </Badge>
          )}
        </div>

        {/* Error Alert */}
        {error && (
          <div className="flex items-center gap-3 p-4 bg-rose-50 border border-rose-200 rounded-2xl text-rose-700 text-sm">
            <AlertTriangle className="w-5 h-5 shrink-0 text-rose-600" />
            <div className="flex-1">{error}</div>
          </div>
        )}

        {/* Success Alert */}
        {success && (
          <div className="p-8 bg-gradient-to-br from-emerald-50 to-teal-50 border border-emerald-200 rounded-3xl text-center space-y-4">
            <div className="w-14 h-14 bg-emerald-100 text-emerald-600 rounded-2xl flex items-center justify-center mx-auto shadow-sm">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-900">
                Prescription Successfully Updated
              </h2>
              <p className="text-sm text-slate-600 mt-1 max-w-md mx-auto">
                Modifications have been applied to prescription #{prescriptionId}. Medication
                schedules have been regenerated to reflect updated dosing.
              </p>
            </div>
            <div className="pt-2">
              <Button
                variant="primary"
                onClick={() =>
                  navigate(patientId ? `/doctor/patients/${patientId}` : "/doctor/patients")
                }
              >
                Return to Patient Chart
              </Button>
            </div>
          </div>
        )}

        {/* Edit Form */}
        {!success && prescription && (
          <form onSubmit={handleSubmit}>
            <Card>
              <CardHeader
                title="Prescription Parameters"
                subtitle="Ensure dosing changes are validated against patient allergy history"
              />

              <div className="p-6 space-y-6">
                {/* Medicine Selection */}
                <div>
                  <label
                    htmlFor="medicine_id"
                    className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2"
                  >
                    Formulary Medicine <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <Pill className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <select
                      id="medicine_id"
                      name="medicine_id"
                      value={form.medicine_id}
                      onChange={handleChange}
                      required
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-10 pr-4 py-2.5 text-sm text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 transition-all font-medium"
                    >
                      <option value="">Select a medicine from pharmacy catalog</option>
                      {medicines.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.name} {m.strength ? `(${m.strength})` : ""} - {m.form || "Unit"}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Dose & Route */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label
                      htmlFor="dose"
                      className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2"
                    >
                      Dose <span className="text-rose-500">*</span>
                    </label>
                    <input
                      id="dose"
                      name="dose"
                      type="text"
                      placeholder="e.g. 500 mg, 10 ml"
                      value={form.dose}
                      onChange={handleChange}
                      required
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 transition-all"
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="route"
                      className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2"
                    >
                      Route <span className="text-rose-500">*</span>
                    </label>
                    <input
                      id="route"
                      name="route"
                      type="text"
                      placeholder="e.g. Oral, IV, IM"
                      value={form.route}
                      onChange={handleChange}
                      required
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 transition-all"
                    />
                  </div>
                </div>

                {/* Frequency & Duration */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label
                      htmlFor="frequency"
                      className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2"
                    >
                      Administration Frequency <span className="text-rose-500">*</span>
                    </label>
                    <select
                      id="frequency"
                      name="frequency"
                      value={form.frequency}
                      onChange={handleChange}
                      required
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 transition-all"
                    >
                      {FREQUENCIES.map((freq) => (
                        <option key={freq.value} value={freq.value}>
                          {freq.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label
                      htmlFor="duration_days"
                      className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2"
                    >
                      Duration (Days) <span className="text-rose-500">*</span>
                    </label>
                    <input
                      id="duration_days"
                      name="duration_days"
                      type="number"
                      min="1"
                      max="90"
                      value={form.duration_days}
                      onChange={handleChange}
                      required
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 transition-all"
                    />
                  </div>
                </div>

                {/* Start Date & Start Time */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label
                      htmlFor="start_date"
                      className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2"
                    >
                      Start Date <span className="text-rose-500">*</span>
                    </label>
                    <div className="relative">
                      <Calendar className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <input
                        id="start_date"
                        name="start_date"
                        type="date"
                        value={form.start_date}
                        onChange={handleChange}
                        required
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-10 pr-4 py-2.5 text-sm text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 transition-all"
                      />
                    </div>
                  </div>

                  <div>
                    <label
                      htmlFor="start_time"
                      className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2"
                    >
                      First Dose Time <span className="text-rose-500">*</span>
                    </label>
                    <div className="relative">
                      <Clock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <input
                        id="start_time"
                        name="start_time"
                        type="time"
                        value={form.start_time}
                        onChange={handleChange}
                        required
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-10 pr-4 py-2.5 text-sm text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 transition-all"
                      />
                    </div>
                  </div>
                </div>

                {/* Urgent / STAT Order Checkbox */}
                <div className="p-4 bg-amber-50/60 border border-amber-200 rounded-2xl flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
                      <Zap className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="text-sm font-bold text-amber-950">
                        Urgent / STAT Order
                      </div>
                      <div className="text-xs text-amber-800/80">
                        Priority medication scheduled for immediate bedside administration
                      </div>
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    id="is_stat"
                    name="is_stat"
                    checked={form.is_stat}
                    onChange={handleChange}
                    className="w-5 h-5 rounded text-amber-600 focus:ring-amber-500 border-amber-300"
                  />
                </div>

                {/* Instructions */}
                <div>
                  <label
                    htmlFor="instructions"
                    className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2"
                  >
                    Administration Instructions
                  </label>
                  <textarea
                    id="instructions"
                    name="instructions"
                    rows={2}
                    placeholder="Instructions for nurse or patient..."
                    value={form.instructions}
                    onChange={handleChange}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 transition-all resize-none"
                  />
                </div>

                {/* Notes */}
                <div>
                  <label
                    htmlFor="notes"
                    className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2"
                  >
                    Clinical Notes
                  </label>
                  <textarea
                    id="notes"
                    name="notes"
                    rows={2}
                    placeholder="Physician notes..."
                    value={form.notes}
                    onChange={handleChange}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 transition-all resize-none"
                  />
                </div>
              </div>

              {/* Action Buttons */}
              <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex items-center justify-end gap-3 rounded-b-2xl">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() =>
                    navigate(patientId ? `/doctor/patients/${patientId}` : "/doctor/patients")
                  }
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  icon={Save}
                  loading={submitting}
                  disabled={!form.medicine_id}
                >
                  Save Prescription Changes
                </Button>
              </div>
            </Card>
          </form>
        )}
      </div>
    </MainLayout>
  )
}