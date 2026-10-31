import React, { useEffect, useState } from "react"
import { useNavigate, useSearchParams } from "react-router-dom"
import {
  AlertTriangle,
  ArrowLeft,
  Calendar,
  CheckCircle2,
  Clock,
  Edit3,
  FileText,
  Info,
  Pill,
  Plus,
  Save,
  ShieldAlert,
  Trash2,
  User,
  Zap,
} from "lucide-react"

import MainLayout from "../../components/layout/MainLayout"
import Card, { CardHeader } from "../../components/common/Card"
import Button from "../../components/common/Button"
import Badge from "../../components/common/Badge"
import Loading from "../../components/common/Loading"
import Modal from "../../components/common/Modal"
import {
  createPatientAllergy,
  createPrescription,
  deletePatientAllergy,
  getDoctorMedicines,
  getDoctorPatient,
  getPatientAllergies,
  updatePatientAllergy,
} from "../../services/doctor"

const FREQUENCIES = [
  { value: "ONCE_DAILY", label: "Once Daily (QD)" },
  { value: "TWICE_DAILY", label: "Twice Daily (BID)" },
  { value: "EVERY_8_HOURS", label: "Every 8 Hours (TID)" },
  { value: "EVERY_6_HOURS", label: "Every 6 Hours (QID)" },
]

const SEVERITIES = [
  { value: "LOW", label: "Low", variant: "neutral" },
  { value: "MODERATE", label: "Moderate", variant: "warning" },
  { value: "HIGH", label: "High", variant: "danger" },
  { value: "SEVERE", label: "Severe / Anaphylactic", variant: "danger" },
]

export default function CreatePrescription() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const patientId = searchParams.get("patient")

  const [patient, setPatient] = useState(null)
  const [medicines, setMedicines] = useState([])
  const [allergies, setAllergies] = useState([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState(null)

  // Allergy modal state
  const [allergyModalOpen, setAllergyModalOpen] = useState(false)
  const [editingAllergy, setEditingAllergy] = useState(null)
  const [savingAllergy, setSavingAllergy] = useState(false)
  const [deletingAllergyId, setDeletingAllergyId] = useState(null)
  const [allergyError, setAllergyError] = useState("")
  const [allergyForm, setAllergyForm] = useState({
    allergen: "",
    reaction: "",
    severity: "MODERATE",
    notes: "",
  })

  // Prescription Form
  const [form, setForm] = useState({
    medicine_id: "",
    dose: "",
    route: "Oral",
    frequency: "ONCE_DAILY",
    duration_days: 7,
    start_date: new Date().toISOString().split("T")[0],
    start_time: "08:00",
    is_stat: false,
    instructions: "",
    notes: "",
  })

  useEffect(() => {
    async function loadData() {
      if (!patientId) {
        setError("No patient was selected.")
        setLoading(false)
        return
      }

      setLoading(true)
      setError("")

      try {
        const [patientData, medicineData, allergyData] = await Promise.all([
          getDoctorPatient(patientId),
          getDoctorMedicines(),
          getPatientAllergies(patientId),
        ])

        setPatient(patientData)
        setMedicines(Array.isArray(medicineData) ? medicineData : [])
        setAllergies(Array.isArray(allergyData) ? allergyData : [])
      } catch (requestError) {
        setError(
          requestError?.response?.data?.detail || "Unable to load prescription data."
        )
      } finally {
        setLoading(false)
      }
    }

    loadData()
  }, [patientId])

  function handleChange(event) {
    const { name, value, type, checked } = event.target
    setForm((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }))
  }

  function handleAllergyChange(event) {
    const { name, value } = event.target
    setAllergyForm((prev) => ({ ...prev, [name]: value }))
  }

  function openAddAllergy() {
    setEditingAllergy(null)
    setAllergyForm({ allergen: "", reaction: "", severity: "MODERATE", notes: "" })
    setAllergyError("")
    setAllergyModalOpen(true)
  }

  function openEditAllergy(allergy) {
    setEditingAllergy(allergy)
    setAllergyForm({
      allergen: allergy.allergen || "",
      reaction: allergy.reaction || "",
      severity: allergy.severity || "MODERATE",
      notes: allergy.notes || "",
    })
    setAllergyError("")
    setAllergyModalOpen(true)
  }

  function closeAllergyModal() {
    if (savingAllergy) return
    setAllergyModalOpen(false)
    setEditingAllergy(null)
    setAllergyError("")
  }

  async function handleSaveAllergy(event) {
    event.preventDefault()
    setAllergyError("")

    if (!allergyForm.allergen.trim()) {
      setAllergyError("Please enter the allergen name.")
      return
    }

    setSavingAllergy(true)
    try {
      const payload = {
        allergen: allergyForm.allergen.trim(),
        reaction: allergyForm.reaction.trim() || null,
        severity: allergyForm.severity || null,
        notes: allergyForm.notes.trim() || null,
      }

      if (editingAllergy) {
        const result = await updatePatientAllergy(patientId, editingAllergy.id, payload)
        setAllergies((prev) =>
          prev.map((item) => (item.id === editingAllergy.id ? result : item))
        )
      } else {
        const result = await createPatientAllergy(patientId, payload)
        setAllergies((prev) => [...prev, result])
      }
      closeAllergyModal()
    } catch (requestError) {
      setAllergyError(
        requestError?.response?.data?.detail || "Unable to save allergy record."
      )
    } finally {
      setSavingAllergy(false)
    }
  }

  async function handleDeleteAllergy(allergy) {
    const confirmed = window.confirm(
      `Remove allergy "${allergy.allergen}" from patient record?`
    )
    if (!confirmed) return

    setDeletingAllergyId(allergy.id)
    try {
      await deletePatientAllergy(patientId, allergy.id)
      setAllergies((prev) => prev.filter((item) => item.id !== allergy.id))
    } catch (requestError) {
      setError(requestError?.response?.data?.detail || "Unable to remove allergy.")
    } finally {
      setDeletingAllergyId(null)
    }
  }

  // Cross-reference selected medicine with known allergies
  const selectedMedObj = medicines.find((m) => String(m.id) === String(form.medicine_id))
  const allergyConflict = selectedMedObj
    ? allergies.find(
        (a) =>
          a.allergen &&
          (selectedMedObj.name.toLowerCase().includes(a.allergen.toLowerCase()) ||
            a.allergen.toLowerCase().includes(selectedMedObj.name.toLowerCase()))
      )
    : null

  async function handleSubmit(event) {
    event.preventDefault()
    setSubmitting(true)
    setError("")
    setSuccess(null)

    try {
      const payload = {
        patient_id: Number(patientId),
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

      const result = await createPrescription(payload)
      setSuccess(result)
    } catch (requestError) {
      setError(
        requestError?.response?.data?.detail || "Unable to create prescription."
      )
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <MainLayout title="Create Prescription">
        <Loading message="Loading patient chart and formulary..." />
      </MainLayout>
    )
  }

  return (
    <MainLayout
      title="Create Prescription"
      subtitle="Issue an authorized medical prescription with automated schedule generation"
    >
      <div className="mx-auto max-w-5xl space-y-6">
        {/* Top Navigation */}
        <div className="flex items-center justify-between">
          <Button
            variant="ghost"
            icon={ArrowLeft}
            onClick={() =>
              navigate(patientId ? `/doctor/patients/${patientId}` : "/doctor/patients")
            }
          >
            Back to Patient Profile
          </Button>

          {patient && (
            <div className="flex items-center gap-2 text-xs text-slate-500 bg-white border border-slate-200/80 rounded-xl px-3 py-1.5 shadow-sm">
              <User className="w-3.5 h-3.5 text-sky-600" />
              <span>Patient:</span>
              <span className="font-semibold text-slate-800">
                {patient.first_name} {patient.last_name}
              </span>
              <span className="text-slate-300">|</span>
              <span className="font-mono text-sky-700">#{patient.patient_id}</span>
            </div>
          )}
        </div>

        {/* Global Error Banner */}
        {error && (
          <div className="flex items-center gap-3 p-4 bg-rose-50 border border-rose-200 rounded-2xl text-rose-700 text-sm">
            <AlertTriangle className="w-5 h-5 shrink-0 text-rose-600" />
            <div className="flex-1">{error}</div>
          </div>
        )}

        {/* Success State */}
        {success && (
          <div className="p-8 bg-gradient-to-br from-emerald-50 to-teal-50 border border-emerald-200 rounded-3xl text-center space-y-4">
            <div className="w-14 h-14 bg-emerald-100 text-emerald-600 rounded-2xl flex items-center justify-center mx-auto shadow-sm">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-900">
                Prescription Successfully Created
              </h2>
              <p className="text-sm text-slate-600 mt-1 max-w-md mx-auto">
                Prescription record #{success.prescription_id} has been registered and{" "}
                <strong className="text-emerald-700 font-bold">
                  {success.schedule_count} medication administration schedule(s)
                </strong>{" "}
                were automatically populated for nurse rounds.
              </p>
            </div>
            <div className="flex items-center justify-center gap-3 pt-2">
              <Button
                variant="primary"
                onClick={() => navigate(`/doctor/patients/${patientId}`)}
              >
                Return to Patient Chart
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  setSuccess(null)
                  setForm({
                    medicine_id: "",
                    dose: "",
                    route: "Oral",
                    frequency: "ONCE_DAILY",
                    duration_days: 7,
                    start_date: new Date().toISOString().split("T")[0],
                    start_time: "08:00",
                    is_stat: false,
                    instructions: "",
                    notes: "",
                  })
                }}
              >
                Add Another Medicine
              </Button>
            </div>
          </div>
        )}

        {/* Patient Allergies Banner */}
        {!success && (
          <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-600">
                  <ShieldAlert className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">
                    Patient Allergy Safety Review
                  </h3>
                  <p className="text-xs text-slate-500">
                    Review documented drug hypersensitivities before issuing new regimens
                  </p>
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                icon={Plus}
                onClick={openAddAllergy}
              >
                Add Allergy
              </Button>
            </div>

            {allergies.length === 0 ? (
              <div className="text-xs text-slate-500 bg-slate-50 rounded-xl p-3 border border-dashed border-slate-200 flex items-center gap-2">
                <Info className="w-4 h-4 text-slate-400 shrink-0" />
                <span>No known drug allergies (NKDA) recorded for this patient.</span>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {allergies.map((allergy) => (
                  <div
                    key={allergy.id}
                    className="p-3 rounded-xl border border-rose-100 bg-rose-50/50 flex items-start justify-between gap-2"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-slate-900">
                          {allergy.allergen}
                        </span>
                        <Badge
                          variant={
                            allergy.severity === "SEVERE" || allergy.severity === "HIGH"
                              ? "danger"
                              : "warning"
                          }
                          size="sm"
                        >
                          {allergy.severity || "MODERATE"}
                        </Badge>
                      </div>
                      {allergy.reaction && (
                        <p className="text-[11px] text-slate-600 mt-1">
                          Reaction: {allergy.reaction}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => openEditAllergy(allergy)}
                        className="p-1 text-slate-400 hover:text-slate-600 rounded"
                        title="Edit allergy"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        disabled={deletingAllergyId === allergy.id}
                        onClick={() => handleDeleteAllergy(allergy)}
                        className="p-1 text-rose-400 hover:text-rose-600 rounded"
                        title="Delete allergy"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Live Conflict Warning */}
            {allergyConflict && (
              <div className="p-4 bg-rose-500/10 border border-rose-300 rounded-xl text-rose-900 text-xs flex items-start gap-2.5 animate-pulse">
                <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
                <div>
                  <strong className="font-bold">CRITICAL SAFETY ALERT:</strong> Patient
                  has a documented allergy to{" "}
                  <span className="font-black underline">{allergyConflict.allergen}</span>{" "}
                  ({allergyConflict.severity || "Moderate"}), which conflicts with{" "}
                  <span className="font-black underline">{selectedMedObj.name}</span>.
                  Re-evaluate before prescribing!
                </div>
              </div>
            )}
          </div>
        )}

        {/* Prescription Form */}
        {!success && (
          <form onSubmit={handleSubmit} className="space-y-6">
            <Card>
              <CardHeader
                title="Prescription Details"
                subtitle="Select formulary item, dosing parameters, route and administration window"
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
                      placeholder="e.g. 500 mg, 10 ml, 1 tablet"
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
                      placeholder="e.g. Oral, IV, IM, Subcutaneous, Topical"
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
                      First Administration Date <span className="text-rose-500">*</span>
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

                {/* Urgent / STAT Checkbox */}
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
                        Designate for immediate bedside administration during rounds
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
                    placeholder="e.g. Take immediately after breakfast with a full glass of water. Monitor BP before administering."
                    value={form.instructions}
                    onChange={handleChange}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 transition-all resize-none"
                  />
                </div>

                {/* Clinical Notes */}
                <div>
                  <label
                    htmlFor="notes"
                    className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2"
                  >
                    Internal Physician Notes (Optional)
                  </label>
                  <textarea
                    id="notes"
                    name="notes"
                    rows={2}
                    placeholder="Confidential clinical rationale or reference notes..."
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
                  Authorize & Create Prescription
                </Button>
              </div>
            </Card>
          </form>
        )}

        {/* Allergy Modal */}
        <Modal
          isOpen={allergyModalOpen}
          onClose={closeAllergyModal}
          title={editingAllergy ? "Edit Patient Allergy" : "Add Patient Allergy"}
          size="md"
        >
          <form onSubmit={handleSaveAllergy} className="space-y-4">
            {allergyError && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700">
                {allergyError}
              </div>
            )}

            <div>
              <label
                htmlFor="allergen"
                className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5"
              >
                Allergen / Substance <span className="text-rose-500">*</span>
              </label>
              <input
                id="allergen"
                name="allergen"
                type="text"
                required
                placeholder="e.g. Penicillin, Sulfa drugs, Latex"
                value={allergyForm.allergen}
                onChange={handleAllergyChange}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-sm text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500"
              />
            </div>

            <div>
              <label
                htmlFor="severity"
                className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5"
              >
                Clinical Severity
              </label>
              <select
                id="severity"
                name="severity"
                value={allergyForm.severity}
                onChange={handleAllergyChange}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-sm text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500"
              >
                {SEVERITIES.map((sev) => (
                  <option key={sev.value} value={sev.value}>
                    {sev.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label
                htmlFor="reaction"
                className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5"
              >
                Observed Reaction
              </label>
              <input
                id="reaction"
                name="reaction"
                type="text"
                placeholder="e.g. Urticaria, Bronchospasm, Facial swelling"
                value={allergyForm.reaction}
                onChange={handleAllergyChange}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-sm text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500"
              />
            </div>

            <div>
              <label
                htmlFor="allergy_notes"
                className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5"
              >
                Safety Notes
              </label>
              <textarea
                id="allergy_notes"
                name="notes"
                rows={2}
                placeholder="Details on previous episodes..."
                value={allergyForm.notes}
                onChange={handleAllergyChange}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-sm text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 resize-none"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <Button type="button" variant="outline" size="sm" onClick={closeAllergyModal}>
                Cancel
              </Button>
              <Button
                type="submit"
                variant="primary"
                size="sm"
                loading={savingAllergy}
              >
                {editingAllergy ? "Save Changes" : "Record Allergy"}
              </Button>
            </div>
          </form>
        </Modal>
      </div>
    </MainLayout>
  )
}