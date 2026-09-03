import {
  AlertTriangle,
  Ban,
  CheckCircle2,
  CirclePause,
  Clock3,
  LoaderCircle,
  XCircle,
} from "lucide-react"

import { useState } from "react"

import {
  administerMedication,
} from "../../services/medications"


const ACTIONS = [
  {
    value: "GIVEN",
    label: "Give Medication",
    description:
      "Medication was administered successfully.",
    icon: CheckCircle2,
    classes:
      "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100",
  },
  {
    value: "DELAYED",
    label: "Mark Delayed",
    description:
      "Medication could not be given at the scheduled time.",
    icon: Clock3,
    classes:
      "border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100",
  },
  {
    value: "HELD",
    label: "Hold Medication",
    description:
      "Medication is being held.",
    icon: CirclePause,
    classes:
      "border-orange-200 bg-orange-50 text-orange-700 hover:bg-orange-100",
  },
  {
    value: "REFUSED",
    label: "Patient Refused",
    description:
      "Patient refused the medication.",
    icon: XCircle,
    classes:
      "border-red-200 bg-red-50 text-red-700 hover:bg-red-100",
  },
  {
    value: "NOT_GIVEN",
    label: "Not Given",
    description:
      "Medication was not administered.",
    icon: Ban,
    classes:
      "border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100",
  },
]


export default function AdministrationActions({
  scheduleId,
  disabled = false,
  onSuccess,
  onError,
}) {
  const [selectedStatus, setSelectedStatus] =
    useState(null)

  const [notes, setNotes] =
    useState("")

  const [submitting, setSubmitting] =
    useState(false)

  const [error, setError] =
    useState("")


  function selectAction(status) {
    if (disabled || submitting) {
      return
    }

    setSelectedStatus(status)
    setError("")
  }


  function cancelSelection() {
    if (submitting) {
      return
    }

    setSelectedStatus(null)
    setNotes("")
    setError("")
  }


  async function handleSubmit(event) {
    event.preventDefault()

    if (!selectedStatus) {
      setError(
        "Please select a medication outcome.",
      )

      return
    }

    setSubmitting(true)
    setError("")

    try {
      const result =
        await administerMedication(
          Number(scheduleId),
          {
            status: selectedStatus,
            administered_at:
              new Date().toISOString(),
            notes:
              notes.trim() || null,
          },
        )

      onSuccess?.(result)

      setSelectedStatus(null)
      setNotes("")

    } catch (requestError) {
      const message =
        requestError?.response?.data?.detail ||
        "Unable to record medication administration."

      setError(message)

      onError?.(message)

    } finally {
      setSubmitting(false)
    }
  }


  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">

      <div className="mb-6">

        <p className="text-sm font-semibold text-cyan-600">
          Administration
        </p>

        <h2 className="mt-1 text-xl font-bold text-slate-900">
          Record Medication Outcome
        </h2>

        <p className="mt-2 text-sm leading-6 text-slate-500">
          Select what happened with this scheduled
          medication dose.
        </p>

      </div>


      {/* Actions */}

      {!selectedStatus && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">

          {ACTIONS.map((action) => {
            const Icon = action.icon

            return (
              <button
                key={action.value}
                type="button"
                disabled={
                  disabled ||
                  submitting
                }
                onClick={() =>
                  selectAction(
                    action.value,
                  )
                }
                className={[
                  "rounded-2xl border p-4 text-left transition",
                  action.classes,
                  disabled
                    ? "cursor-not-allowed opacity-50"
                    : "",
                ].join(" ")}
              >

                <Icon className="h-6 w-6" />

                <p className="mt-3 text-sm font-semibold">
                  {action.label}
                </p>

                <p className="mt-1 text-xs leading-5 opacity-75">
                  {action.description}
                </p>

              </button>
            )
          })}

        </div>
      )}


      {/* Confirmation form */}

      {selectedStatus && (
        <form
          onSubmit={handleSubmit}
          className="space-y-5"
        >

          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">

            <div className="flex items-start gap-3">

              <AlertTriangle className="mt-0.5 h-5 w-5 text-amber-600" />

              <div>

                <p className="font-semibold text-slate-900">
                  Confirm outcome
                </p>

                <p className="mt-1 text-sm text-slate-600">
                  You selected:
                  {" "}
                  <span className="font-semibold">
                    {selectedStatus.replace(
                      "_",
                      " ",
                    )}
                  </span>
                </p>

              </div>

            </div>

          </div>


          {/* Notes */}

          <div>

            <label
              htmlFor="administration-notes"
              className="mb-2 block text-sm font-semibold text-slate-700"
            >
              Notes
              <span className="ml-1 font-normal text-slate-400">
                (optional)
              </span>
            </label>

            <textarea
              id="administration-notes"
              value={notes}
              onChange={(event) =>
                setNotes(
                  event.target.value,
                )
              }
              rows={4}
              placeholder="Add administration notes..."
              disabled={submitting}
              className="w-full resize-none rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-cyan-400 focus:ring-4 focus:ring-cyan-400/10 disabled:opacity-50"
            />

          </div>


          {error && (
            <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
              {error}
            </div>
          )}


          {/* Buttons */}

          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">

            <button
              type="button"
              onClick={cancelSelection}
              disabled={submitting}
              className="rounded-xl border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
            >
              Cancel
            </button>


            <button
              type="submit"
              disabled={submitting}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
            >

              {submitting && (
                <LoaderCircle className="h-4 w-4 animate-spin" />
              )}

              {submitting
                ? "Saving..."
                : "Confirm & Record"}

            </button>

          </div>

        </form>
      )}

    </div>
  )
}