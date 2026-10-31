import React, { useState } from "react"
import {
  AlertTriangle,
  Ban,
  CheckCircle2,
  CirclePause,
  Clock,
  LoaderCircle,
  Save,
  XCircle,
} from "lucide-react"
import Button from "../common/Button"
import { administerMedication } from "../../services/medications"

const ACTIONS = [
  {
    value: "GIVEN",
    label: "Administered (Given)",
    description: "Medication successfully verified and administered to the patient.",
    icon: CheckCircle2,
    badgeColor: "bg-emerald-500",
    activeClass: "border-emerald-500 bg-emerald-50/70 text-emerald-950 ring-2 ring-emerald-500/20",
    iconClass: "text-emerald-600 bg-emerald-100",
  },
  {
    value: "DELAYED",
    label: "Mark Delayed",
    description: "Dose delayed due to bedside testing, clinical procedure or patient unavailability.",
    icon: Clock,
    badgeColor: "bg-amber-500",
    activeClass: "border-amber-500 bg-amber-50/70 text-amber-950 ring-2 ring-amber-500/20",
    iconClass: "text-amber-600 bg-amber-100",
  },
  {
    value: "HELD",
    label: "Hold Medication",
    description: "Clinical hold per physician instructions or vital signs anomaly.",
    icon: CirclePause,
    badgeColor: "bg-orange-500",
    activeClass: "border-orange-500 bg-orange-50/70 text-orange-950 ring-2 ring-orange-500/20",
    iconClass: "text-orange-600 bg-orange-100",
  },
  {
    value: "REFUSED",
    label: "Patient Refused",
    description: "Patient declined medication after clinical explanation.",
    icon: XCircle,
    badgeColor: "bg-rose-500",
    activeClass: "border-rose-500 bg-rose-50/70 text-rose-950 ring-2 ring-rose-500/20",
    iconClass: "text-rose-600 bg-rose-100",
  },
  {
    value: "NOT_GIVEN",
    label: "Not Given / Contraindicated",
    description: "Dose omitted due to acute contraindication or change in care plan.",
    icon: Ban,
    badgeColor: "bg-red-500",
    activeClass: "border-red-500 bg-red-50/70 text-red-950 ring-2 ring-red-500/20",
    iconClass: "text-red-600 bg-red-100",
  },
]

export default function AdministrationActions({
  scheduleId,
  isAssigned = true,
  assignedNurseName = "",
  disabled = false,
  onSuccess,
  onError,
}) {
  const [selectedStatus, setSelectedStatus] = useState("GIVEN")
  const [notes, setNotes] = useState("")
  const [overrideReason, setOverrideReason] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState("")

  async function handleSubmit(event) {
    event.preventDefault()
    if (!selectedStatus) {
      setError("Please select a clinical outcome status.")
      return
    }

    if (!isAssigned && !overrideReason.trim()) {
      setError("An administrative override justification is required when administering for another nurse.")
      return
    }

    setSubmitting(true)
    setError("")

    try {
      const payload = {
        status: selectedStatus,
        administered_at: new Date().toISOString(),
        notes: notes.trim() || null,
        is_override: !isAssigned,
        override_reason: !isAssigned ? overrideReason.trim() : null,
      }

      const result = await administerMedication(Number(scheduleId), payload)
      onSuccess?.(result)
    } catch (requestError) {
      const message =
        requestError?.response?.data?.detail ||
        requestError?.message ||
        "Unable to record administration."
      setError(message)
      onError?.(message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <div className="flex items-center gap-3 p-4 bg-rose-50 border border-rose-200 rounded-2xl text-rose-700 text-sm">
          <AlertTriangle className="w-5 h-5 shrink-0 text-rose-600" />
          <div className="flex-1 font-medium">{error}</div>
        </div>
      )}

      {/* Outcome Options */}
      <div className="space-y-3">
        <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
          Select Administration Outcome <span className="text-rose-500">*</span>
        </label>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {ACTIONS.map((action) => {
            const isSelected = selectedStatus === action.value
            const Icon = action.icon

            return (
              <div
                key={action.value}
                onClick={() => !disabled && !submitting && setSelectedStatus(action.value)}
                className={`p-4 rounded-2xl border transition-all cursor-pointer select-none flex items-start gap-3.5 ${
                  isSelected
                    ? action.activeClass
                    : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/50"
                } ${disabled ? "opacity-50 pointer-events-none" : ""}`}
              >
                <div
                  className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                    action.iconClass
                  }`}
                >
                  <Icon className="w-5 h-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-bold text-slate-900">
                      {action.label}
                    </h4>
                    {isSelected && (
                      <span className={`w-2.5 h-2.5 rounded-full ${action.badgeColor}`} />
                    )}
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">
                    {action.description}
                  </p>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Covering Nurse Assignment Override Warning & Justification */}
      {!isAssigned && (
        <div className="p-4 bg-amber-50/90 border border-amber-300 rounded-2xl space-y-3">
          <div className="flex items-start gap-2.5 text-amber-900">
            <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <h4 className="font-bold text-sm">Covering Nurse / Assignment Override Required</h4>
              <p className="text-xs text-amber-800 mt-0.5 leading-relaxed">
                You are currently administering medication for a patient assigned to{" "}
                <strong>{assignedNurseName || "another nurse"}</strong>. Per hospital accountability
                policy, please document your clinical override justification. The patient's primary
                assignment will be preserved.
              </p>
            </div>
          </div>

          <div>
            <label
              htmlFor="override_reason"
              className="block text-[11px] font-bold text-amber-950 uppercase tracking-wider mb-1.5"
            >
              Override Justification <span className="text-rose-600">*</span>
            </label>
            <input
              id="override_reason"
              type="text"
              required
              value={overrideReason}
              onChange={(e) => setOverrideReason(e.target.value)}
              placeholder="e.g. Primary nurse responding to code blue / break cross-coverage authorized"
              className="w-full bg-white border border-amber-300 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 placeholder-amber-400/80 focus:outline-none focus:ring-2 focus:ring-amber-500/30"
            />
          </div>
        </div>
      )}

      {/* Nurse Clinical Notes */}
      <div>
        <label
          htmlFor="admin_notes"
          className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2"
        >
          Nurse Administration Notes (Optional)
        </label>
        <textarea
          id="admin_notes"
          rows={3}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="e.g. Patient tolerated medication well with sips of water. BP checked: 122/78 mmHg."
          className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-4 text-sm text-slate-800 placeholder-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 transition-all resize-none"
        />
      </div>

      {/* Submit Button */}
      <div className="flex items-center justify-end gap-3 pt-2">
        <Button
          type="submit"
          variant="primary"
          icon={Save}
          loading={submitting}
          disabled={disabled || !selectedStatus}
          className="px-6 py-3 text-base shadow-md font-bold"
        >
          Record Administration & Update EMR
        </Button>
      </div>
    </form>
  )
}