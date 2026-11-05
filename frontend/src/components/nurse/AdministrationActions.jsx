import React, { useState } from "react"
import {
  AlertTriangle,
  Ban,
  CheckCircle2,
  CirclePause,
  ChevronDown,
  ChevronUp,
  Save,
  ShieldAlert,
  Sparkles,
  XCircle,
} from "lucide-react"
import Button from "../common/Button"
import { administerMedication } from "../../services/medications"

function formatApiError(err, fallback = "Unable to record medication administration.") {
  const detail = err?.response?.data?.detail
  if (typeof detail === "string") return detail
  if (Array.isArray(detail)) {
    return detail.map((e) => (typeof e === "string" ? e : e?.msg || JSON.stringify(e))).join("; ")
  }
  if (detail && typeof detail === "object") {
    return detail.message || JSON.stringify(detail)
  }
  return err?.message || fallback
}

const CLINICAL_EXCEPTIONS = [
  {
    value: "HELD",
    label: "Hold Medication",
    description: "Clinical hold per physician instructions, abnormal vitals, or pre-procedure fasting.",
    icon: CirclePause,
    badgeColor: "bg-amber-500",
    activeClass: "border-amber-500 bg-amber-50/70 text-amber-950 ring-2 ring-amber-500/20",
    iconClass: "text-amber-600 bg-amber-100",
  },
  {
    value: "REFUSED",
    label: "Patient Refused",
    description: "Patient declined medication after full clinical explanation and discussion.",
    icon: XCircle,
    badgeColor: "bg-rose-500",
    activeClass: "border-rose-500 bg-rose-50/70 text-rose-950 ring-2 ring-rose-500/20",
    iconClass: "text-rose-600 bg-rose-100",
  },
  {
    value: "NOT_GIVEN",
    label: "Not Given / Contraindicated",
    description: "Dose omitted due to acute clinical contraindication, allergy concern, or changed order.",
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
  const [outcomeMode, setOutcomeMode] = useState("GIVEN") // "GIVEN" or "EXCEPTION"
  const [selectedException, setSelectedException] = useState("HELD")
  const [showExceptions, setShowExceptions] = useState(false)
  const [notes, setNotes] = useState("")
  const [overrideReason, setOverrideReason] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState("")

  const effectiveStatus = outcomeMode === "GIVEN" ? "GIVEN" : selectedException

  async function handleSubmit(event) {
    event.preventDefault()
    if (!effectiveStatus) {
      setError("Please select a valid administration outcome.")
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
        status: effectiveStatus,
        notes: notes.trim() || null,
        is_override: !isAssigned,
        override_reason: !isAssigned ? overrideReason.trim() : null,
      }

      // Preserve scheduleId format (works with numeric, string, or ObjectId)
      const result = await administerMedication(scheduleId, payload)
      onSuccess?.(result)
    } catch (requestError) {
      const message = formatApiError(requestError, "Unable to record medication administration.")
      setError(message)
      onError?.(message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <div className="flex items-center gap-3 p-4 bg-rose-50 border border-rose-200 rounded-2xl text-rose-700 text-sm shadow-xs">
          <AlertTriangle className="w-5 h-5 shrink-0 text-rose-600" />
          <div className="flex-1 font-medium">{error}</div>
        </div>
      )}

      {/* Primary Action: Mark as Given (Automatic Timing Evaluation) */}
      <div className="space-y-3">
        <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
          Bedside Administration Action <span className="text-rose-500">*</span>
        </label>

        {/* Primary Given Card */}
        <div
          onClick={() => {
            if (!disabled && !submitting) {
              setOutcomeMode("GIVEN")
            }
          }}
          className={`p-5 rounded-2xl border transition-all cursor-pointer select-none flex items-start gap-4 ${
            outcomeMode === "GIVEN"
              ? "border-emerald-500 bg-emerald-50/80 text-emerald-950 ring-2 ring-emerald-500/20 shadow-sm"
              : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/50"
          } ${disabled ? "opacity-50 pointer-events-none" : ""}`}
        >
          <div
            className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 shadow-xs ${
              outcomeMode === "GIVEN"
                ? "bg-emerald-600 text-white"
                : "bg-slate-100 text-slate-600"
            }`}
          >
            <CheckCircle2 className="w-6 h-6" />
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between">
              <h4 className="text-base font-bold text-slate-900">
                Mark as Given (Administered)
              </h4>
              {outcomeMode === "GIVEN" && (
                <span className="px-2.5 py-0.5 bg-emerald-600 text-white text-[11px] font-bold rounded-full uppercase tracking-wider">
                  Active Selection
                </span>
              )}
            </div>
            <p className="text-xs text-slate-600 mt-1 leading-relaxed">
              Medication physically administered to verified patient at bedside. The hospital server clock
              will record the authoritative administration timestamp and automatically classify on-time
              compliance per hospital policy.
            </p>
            <div className="flex items-center gap-2 mt-2 text-[11px] text-emerald-800 font-medium">
              <Sparkles className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
              <span>Automatic compliance classification (On-time grace: 30m before / 60m after)</span>
            </div>
          </div>
        </div>

        {/* Secondary: Clinical Exceptions Section (Collapsible) */}
        <div className="border border-slate-200 rounded-2xl bg-white overflow-hidden shadow-xs">
          <button
            type="button"
            onClick={() => {
              setShowExceptions((prev) => !prev)
              if (!showExceptions && outcomeMode === "GIVEN") {
                // If opening exceptions, don't auto-switch unless user clicks an option
              }
            }}
            className="w-full px-5 py-3.5 flex items-center justify-between text-left hover:bg-slate-50 transition-colors"
          >
            <div className="flex items-center gap-2.5">
              <ShieldAlert className="w-4 h-4 text-slate-500" />
              <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                Clinical Non-Administration Exceptions (Hold / Refuse / Not Given)
              </span>
              {outcomeMode === "EXCEPTION" && (
                <span className="px-2 py-0.5 bg-amber-100 text-amber-800 text-[10px] font-bold rounded-md uppercase">
                  {selectedException} Selected
                </span>
              )}
            </div>
            {showExceptions ? (
              <ChevronUp className="w-4 h-4 text-slate-400" />
            ) : (
              <ChevronDown className="w-4 h-4 text-slate-400" />
            )}
          </button>

          {(showExceptions || outcomeMode === "EXCEPTION") && (
            <div className="p-4 pt-0 border-t border-slate-100 space-y-2.5">
              <p className="text-[11px] text-slate-500 mt-2 mb-1">
                Select only if the prescribed medicine was intentionally NOT administered to the patient:
              </p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
                {CLINICAL_EXCEPTIONS.map((action) => {
                  const isSelected = outcomeMode === "EXCEPTION" && selectedException === action.value
                  const Icon = action.icon

                  return (
                    <div
                      key={action.value}
                      onClick={() => {
                        if (!disabled && !submitting) {
                          setOutcomeMode("EXCEPTION")
                          setSelectedException(action.value)
                        }
                      }}
                      className={`p-3.5 rounded-xl border transition-all cursor-pointer select-none flex flex-col justify-between ${
                        isSelected
                          ? action.activeClass
                          : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/50"
                      } ${disabled ? "opacity-50 pointer-events-none" : ""}`}
                    >
                      <div className="flex items-center gap-2.5">
                        <div
                          className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                            action.iconClass
                          }`}
                        >
                          <Icon className="w-4 h-4" />
                        </div>
                        <div className="font-bold text-xs text-slate-900 leading-tight">
                          {action.label}
                        </div>
                      </div>
                      <p className="text-[11px] text-slate-500 mt-2 leading-relaxed">
                        {action.description}
                      </p>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Covering Nurse Assignment Override Warning & Justification */}
      {!isAssigned && (
        <div className="p-4 bg-amber-50/90 border border-amber-300 rounded-2xl space-y-3 shadow-xs">
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
          placeholder="e.g. Patient tolerated oral dose well with water. Post-administration vitals checked: BP 120/78, Pulse 72."
          className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-4 text-sm text-slate-800 placeholder-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 transition-all resize-none shadow-xs"
        />
      </div>

      {/* Submit Button */}
      <div className="flex items-center justify-end gap-3 pt-2">
        <Button
          type="submit"
          variant={outcomeMode === "GIVEN" ? "primary" : "secondary"}
          icon={outcomeMode === "GIVEN" ? CheckCircle2 : Save}
          loading={submitting}
          disabled={disabled || !effectiveStatus}
          className={`px-7 py-3 text-base shadow-md font-bold ${
            outcomeMode === "GIVEN"
              ? "bg-emerald-600 hover:bg-emerald-700 text-white"
              : outcomeMode === "EXCEPTION" && selectedException === "HELD"
              ? "bg-amber-600 hover:bg-amber-700 text-white"
              : outcomeMode === "EXCEPTION" && selectedException === "REFUSED"
              ? "bg-rose-600 hover:bg-rose-700 text-white"
              : ""
          }`}
        >
          {outcomeMode === "GIVEN"
            ? "Confirm / Mark as Given"
            : outcomeMode === "EXCEPTION" && selectedException === "HELD"
            ? "Confirm Clinical Hold"
            : outcomeMode === "EXCEPTION" && selectedException === "REFUSED"
            ? "Record Patient Refusal"
            : "Record Not Given"}
        </Button>
      </div>
    </form>
  )
}
