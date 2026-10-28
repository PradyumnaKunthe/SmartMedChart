import { useEffect, useMemo, useState } from "react"
import {
  AlertCircle,
  CheckCircle2,
  CreditCard,
  History,
  Loader2,
  LogOut,
  RefreshCw,
  Search,
  ShieldCheck,
  UserRound,
  X,
} from "lucide-react"

import {
  dischargePatient,
  getPatientHistory,
  getPatientLifecycle,
  markPatientBillPaid,
  updatePatientBill,
} from "../../services/admin"


function formatDate(value) {
  if (!value) return "—"

  try {
    return new Date(value).toLocaleString()
  } catch {
    return String(value)
  }
}


function formatAmount(value) {
  if (value === null || value === undefined || value === "") {
    return "Not set"
  }

  const amount = Number(value)

  if (Number.isNaN(amount)) {
    return String(value)
  }

  return `₹${amount.toFixed(2)}`
}


function StatusBadge({ children, type = "default" }) {
  const styles = {
    active:
      "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
    discharged:
      "bg-slate-700/40 text-slate-300 border-slate-600",
    paid:
      "bg-cyan-500/10 text-cyan-400 border-cyan-500/20",
    pending:
      "bg-amber-500/10 text-amber-400 border-amber-500/20",
    default:
      "bg-slate-800 text-slate-300 border-slate-700",
  }

  return (
    <span
      className={[
        "inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold",
        styles[type] || styles.default,
      ].join(" ")}
    >
      {children}
    </span>
  )
}


function PatientRow({
  patient,
  onRefresh,
  onHistory,
}) {
  const [showBillEditor, setShowBillEditor] = useState(false)
  const [billAmount, setBillAmount] = useState(
    patient.billing?.bill_amount ?? "",
  )
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState("")

  const billStatus =
    patient.billing?.bill_status || "PENDING"

  const isPaid = billStatus === "PAID"
  const isActive = patient.is_active

  async function handleSaveBill() {
    setBusy(true)
    setMessage("")

    try {
      await updatePatientBill(
        patient.id,
        billAmount === ""
          ? null
          : Number(billAmount),
      )

      setMessage("Bill updated.")
      setShowBillEditor(false)
      await onRefresh()
    } catch (error) {
      setMessage(
        error?.response?.data?.detail ||
          "Unable to update bill.",
      )
    } finally {
      setBusy(false)
    }
  }


  async function handleMarkPaid() {
    if (
      !window.confirm(
        `Mark the bill for ${patient.full_name} as PAID?`,
      )
    ) {
      return
    }

    setBusy(true)
    setMessage("")

    try {
      await markPatientBillPaid(patient.id)

      setMessage("Bill marked as paid.")
      await onRefresh()
    } catch (error) {
      setMessage(
        error?.response?.data?.detail ||
          "Unable to mark bill as paid.",
      )
    } finally {
      setBusy(false)
    }
  }


  async function handleDischarge() {
    const reason = window.prompt(
      `Discharge reason for ${patient.full_name}:`,
      "Treatment completed",
    )

    if (reason === null) {
      return
    }

    setBusy(true)
    setMessage("")

    try {
      await dischargePatient(
        patient.id,
        reason,
      )

      setMessage(
        "Patient discharged successfully.",
      )

      await onRefresh()
    } catch (error) {
      setMessage(
        error?.response?.data?.detail ||
          "Unable to discharge patient.",
      )
    } finally {
      setBusy(false)
    }
  }


  return (
    <div className="border-b border-slate-800 px-5 py-5 last:border-b-0">
      <div className="flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-semibold text-white">
              {patient.full_name}
            </h3>

            <StatusBadge
              type={
                isActive
                  ? "active"
                  : "discharged"
              }
            >
              {isActive
                ? "ACTIVE"
                : "DISCHARGED"}
            </StatusBadge>
          </div>

          <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-sm text-slate-400">
            <span>
              Patient ID:
              <span className="ml-1 text-slate-200">
                {patient.patient_id}
              </span>
            </span>

            <span>
              DB ID:
              <span className="ml-1 text-slate-200">
                {patient.id}
              </span>
            </span>

            <span>
              QR:
              <span
                className={
                  patient.qr_is_active
                    ? "ml-1 text-emerald-400"
                    : "ml-1 text-slate-500"
                }
              >
                {patient.qr_is_active
                  ? "Active"
                  : "Disabled"}
              </span>
            </span>
          </div>

          <div className="mt-3 grid gap-2 text-sm md:grid-cols-3">
            <div className="rounded-lg bg-slate-900 px-3 py-2">
              <p className="text-xs uppercase tracking-wide text-slate-500">
                Billing
              </p>

              <div className="mt-1 flex items-center gap-2">
                <StatusBadge
                  type={
                    isPaid
                      ? "paid"
                      : "pending"
                  }
                >
                  {billStatus}
                </StatusBadge>

                <span className="text-slate-300">
                  {formatAmount(
                    patient.billing?.bill_amount,
                  )}
                </span>
              </div>
            </div>

            <div className="rounded-lg bg-slate-900 px-3 py-2">
              <p className="text-xs uppercase tracking-wide text-slate-500">
                Encounter
              </p>

              <p className="mt-1 text-slate-200">
                {patient.active_encounter?.encounter_type ||
                  "No active encounter"}
              </p>
            </div>

            <div className="rounded-lg bg-slate-900 px-3 py-2">
              <p className="text-xs uppercase tracking-wide text-slate-500">
                Bed
              </p>

              <p className="mt-1 text-slate-200">
                {patient.bed_id
                  ? `Bed ${patient.bed_id}`
                  : "Not admitted"}
              </p>
            </div>
          </div>

          {message && (
            <p className="mt-3 text-sm text-cyan-400">
              {message}
            </p>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">

          <button
            type="button"
            onClick={() => onHistory(patient)}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-700 px-3 py-2 text-sm font-medium text-slate-200 transition hover:bg-slate-800"
          >
            <History className="h-4 w-4" />
            History
          </button>

          {isActive && !isPaid && (
            <>
              <button
                type="button"
                onClick={() =>
                  setShowBillEditor(
                    (value) => !value,
                  )
                }
                disabled={busy}
                className="inline-flex items-center gap-2 rounded-lg border border-slate-700 px-3 py-2 text-sm font-medium text-slate-200 transition hover:bg-slate-800 disabled:opacity-50"
              >
                <CreditCard className="h-4 w-4" />
                Bill
              </button>

              <button
                type="button"
                onClick={handleMarkPaid}
                disabled={busy}
                className="inline-flex items-center gap-2 rounded-lg bg-cyan-500 px-3 py-2 text-sm font-semibold text-slate-950 transition hover:bg-cyan-400 disabled:opacity-50"
              >
                {busy ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <CheckCircle2 className="h-4 w-4" />
                )}

                Mark Bill Paid
              </button>
            </>
          )}

          {isActive && isPaid && (
            <button
              type="button"
              onClick={handleDischarge}
              disabled={busy}
              className="inline-flex items-center gap-2 rounded-lg bg-rose-500 px-3 py-2 text-sm font-semibold text-white transition hover:bg-rose-400 disabled:opacity-50"
            >
              {busy ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <LogOut className="h-4 w-4" />
              )}

              Discharge Patient
            </button>
          )}
        </div>
      </div>

      {showBillEditor && (
        <div className="mt-4 rounded-xl border border-slate-700 bg-slate-900 p-4">
          <div className="grid gap-3 md:grid-cols-[1fr_auto_auto] md:items-end">
            <label className="block">
              <span className="mb-2 block text-sm font-medium text-slate-300">
                Bill Amount (₹)
              </span>

              <input
                type="number"
                min="0"
                step="0.01"
                value={billAmount}
                onChange={(event) =>
                  setBillAmount(
                    event.target.value,
                  )
                }
                className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-white outline-none focus:border-cyan-400"
                placeholder="Enter bill amount"
              />
            </label>

            <button
              type="button"
              onClick={handleSaveBill}
              disabled={busy}
              className="rounded-lg bg-cyan-500 px-4 py-2 text-sm font-semibold text-slate-950 disabled:opacity-50"
            >
              Save Bill
            </button>

            <button
              type="button"
              onClick={() =>
                setShowBillEditor(false)
              }
              className="rounded-lg border border-slate-700 px-4 py-2 text-sm font-medium text-slate-300 hover:bg-slate-800"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  )
}


export default function PatientManagement() {
  const [data, setData] = useState({
    active: [],
    discharged: [],
    counts: {
      active: 0,
      discharged: 0,
    },
  })

  const [tab, setTab] = useState("active")
  const [search, setSearch] = useState("")
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [historyPatient, setHistoryPatient] =
    useState(null)
  const [history, setHistory] = useState(null)
  const [historyLoading, setHistoryLoading] =
    useState(false)


  async function loadPatients() {
    setLoading(true)
    setError("")

    try {
      const result =
        await getPatientLifecycle()

      setData(result)
    } catch (err) {
      setError(
        err?.response?.data?.detail ||
          "Unable to load Patient Management.",
      )
    } finally {
      setLoading(false)
    }
  }


  useEffect(() => {
    loadPatients()
  }, [])


  const patients = useMemo(() => {
    const source =
      tab === "active"
        ? data.active
        : data.discharged

    const value = search
      .trim()
      .toLowerCase()

    if (!value) {
      return source
    }

    return source.filter(
      (patient) =>
        patient.patient_id
          ?.toLowerCase()
          .includes(value) ||
        patient.full_name
          ?.toLowerCase()
          .includes(value),
    )
  }, [
    data,
    tab,
    search,
  ])


  async function openHistory(patient) {
    setHistoryPatient(patient)
    setHistory(null)
    setHistoryLoading(true)

    try {
      const result =
        await getPatientHistory(
          patient.id,
        )

      setHistory(result)
    } catch (err) {
      setError(
        err?.response?.data?.detail ||
          "Unable to load patient history.",
      )
    } finally {
      setHistoryLoading(false)
    }
  }


  return (
    <div className="min-h-screen bg-slate-950 px-6 py-8 text-white">
      <div className="mx-auto max-w-7xl">

        {/* Header */}
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-cyan-500/10">
                <UserRound className="h-6 w-6 text-cyan-400" />
              </div>

              <div>
                <h1 className="text-3xl font-bold tracking-tight">
                  Patient Management
                </h1>

                <p className="mt-1 text-sm text-slate-400">
                  Manage active patients, billing,
                  discharge and history.
                </p>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={loadPatients}
            disabled={loading}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-700 px-4 py-2.5 text-sm font-medium text-slate-200 transition hover:bg-slate-800 disabled:opacity-50"
          >
            <RefreshCw
              className={[
                "h-4 w-4",
                loading
                  ? "animate-spin"
                  : "",
              ].join(" ")}
            />

            Refresh
          </button>
        </div>


        {/* Summary cards */}
        <div className="mt-8 grid gap-4 md:grid-cols-2">
          <button
            type="button"
            onClick={() => setTab("active")}
            className={[
              "rounded-2xl border p-5 text-left transition",
              tab === "active"
                ? "border-cyan-500/40 bg-cyan-500/5"
                : "border-slate-800 bg-slate-900 hover:border-slate-700",
            ].join(" ")}
          >
            <p className="text-sm text-slate-400">
              Active Patients
            </p>

            <p className="mt-2 text-3xl font-bold text-white">
              {data.counts.active}
            </p>

            <p className="mt-1 text-xs text-emerald-400">
              Currently in active workflows
            </p>
          </button>

          <button
            type="button"
            onClick={() => setTab("discharged")}
            className={[
              "rounded-2xl border p-5 text-left transition",
              tab === "discharged"
                ? "border-cyan-500/40 bg-cyan-500/5"
                : "border-slate-800 bg-slate-900 hover:border-slate-700",
            ].join(" ")}
          >
            <p className="text-sm text-slate-400">
              Discharged Patients
            </p>

            <p className="mt-2 text-3xl font-bold text-white">
              {data.counts.discharged}
            </p>

            <p className="mt-1 text-xs text-slate-400">
              Historical records retained
            </p>
          </button>
        </div>


        {/* Search + tabs */}
        <div className="mt-6 rounded-2xl border border-slate-800 bg-slate-900 p-4">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">

            <div className="flex rounded-xl bg-slate-950 p-1">
              <button
                type="button"
                onClick={() => setTab("active")}
                className={[
                  "rounded-lg px-4 py-2 text-sm font-semibold transition",
                  tab === "active"
                    ? "bg-cyan-500 text-slate-950"
                    : "text-slate-400 hover:text-white",
                ].join(" ")}
              >
                Active
              </button>

              <button
                type="button"
                onClick={() => setTab("discharged")}
                className={[
                  "rounded-lg px-4 py-2 text-sm font-semibold transition",
                  tab === "discharged"
                    ? "bg-cyan-500 text-slate-950"
                    : "text-slate-400 hover:text-white",
                ].join(" ")}
              >
                Discharged
              </button>
            </div>


            <div className="relative w-full lg:max-w-md">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />

              <input
                value={search}
                onChange={(event) =>
                  setSearch(
                    event.target.value,
                  )
                }
                placeholder="Search Patient ID or name..."
                className="w-full rounded-xl border border-slate-700 bg-slate-950 py-2.5 pl-10 pr-4 text-sm text-white outline-none placeholder:text-slate-600 focus:border-cyan-400"
              />
            </div>
          </div>
        </div>


        {/* Error */}
        {error && (
          <div className="mt-6 flex items-start gap-3 rounded-xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-300">
            <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />

            <div className="flex-1">
              {error}
            </div>

            <button
              type="button"
              onClick={() => setError("")}
              className="text-red-300/70 hover:text-red-200"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )}


        {/* Patient list */}
        <div className="mt-6 overflow-hidden rounded-2xl border border-slate-800 bg-slate-900">
          {loading ? (
            <div className="flex min-h-72 items-center justify-center text-slate-400">
              <div className="flex items-center gap-3">
                <Loader2 className="h-5 w-5 animate-spin text-cyan-400" />
                Loading patients...
              </div>
            </div>
          ) : patients.length === 0 ? (
            <div className="flex min-h-72 flex-col items-center justify-center px-6 text-center">
              <UserRound className="h-12 w-12 text-slate-700" />

              <h2 className="mt-4 text-lg font-semibold text-slate-200">
                No patients found
              </h2>

              <p className="mt-1 text-sm text-slate-500">
                No {tab} patients match your search.
              </p>
            </div>
          ) : (
            patients.map((patient) => (
              <PatientRow
                key={patient.id}
                patient={patient}
                onRefresh={loadPatients}
                onHistory={openHistory}
              />
            ))
          )}
        </div>
      </div>


      {/* History modal */}
      {historyPatient && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="max-h-[90vh] w-full max-w-4xl overflow-hidden rounded-2xl border border-slate-700 bg-slate-950 shadow-2xl">

            <div className="flex items-center justify-between border-b border-slate-800 px-6 py-4">
              <div>
                <h2 className="text-xl font-bold text-white">
                  Patient History
                </h2>

                <p className="mt-1 text-sm text-slate-400">
                  {historyPatient.full_name}
                  {" • "}
                  {historyPatient.patient_id}
                </p>
              </div>

              <button
                type="button"
                onClick={() => {
                  setHistoryPatient(null)
                  setHistory(null)
                }}
                className="rounded-lg p-2 text-slate-400 hover:bg-slate-800 hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>


            <div className="max-h-[calc(90vh-80px)] overflow-y-auto p-6">
              {historyLoading ? (
                <div className="flex min-h-48 items-center justify-center text-slate-400">
                  <div className="flex items-center gap-3">
                    <Loader2 className="h-5 w-5 animate-spin text-cyan-400" />
                    Loading history...
                  </div>
                </div>
              ) : history ? (
                <div className="space-y-6">

                  <div className="grid gap-4 md:grid-cols-3">
                    <div className="rounded-xl border border-slate-800 bg-slate-900 p-4">
                      <p className="text-xs uppercase tracking-wide text-slate-500">
                        Current State
                      </p>

                      <div className="mt-2">
                        <StatusBadge
                          type={
                            history.patient.is_active
                              ? "active"
                              : "discharged"
                          }
                        >
                          {history.patient.is_active
                            ? "ACTIVE"
                            : "DISCHARGED"}
                        </StatusBadge>
                      </div>
                    </div>

                    <div className="rounded-xl border border-slate-800 bg-slate-900 p-4">
                      <p className="text-xs uppercase tracking-wide text-slate-500">
                        Billing
                      </p>

                      <p className="mt-2 text-lg font-semibold text-white">
                        {history.billing.bill_status}
                      </p>

                      <p className="mt-1 text-sm text-slate-400">
                        {formatAmount(
                          history.billing.bill_amount,
                        )}
                      </p>
                    </div>

                    <div className="rounded-xl border border-slate-800 bg-slate-900 p-4">
                      <p className="text-xs uppercase tracking-wide text-slate-500">
                        QR
                      </p>

                      <p className="mt-2 text-lg font-semibold text-white">
                        {history.patient.qr_is_active
                          ? "Active"
                          : "Disabled"}
                      </p>
                    </div>
                  </div>


                  <section>
                    <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-400">
                      Encounters
                    </h3>

                    <div className="space-y-2">
                      {history.encounters?.length ? (
                        history.encounters.map(
                          (encounter) => (
                            <div
                              key={encounter.id}
                              className="rounded-xl border border-slate-800 bg-slate-900 p-4"
                            >
                              <div className="flex flex-wrap items-center justify-between gap-2">
                                <div>
                                  <p className="font-semibold text-white">
                                    {encounter.encounter_type}
                                  </p>

                                  <p className="mt-1 text-sm text-slate-400">
                                    Created{" "}
                                    {formatDate(
                                      encounter.created_at,
                                    )}
                                  </p>
                                </div>

                                <StatusBadge
                                  type={
                                    encounter.status ===
                                    "ACTIVE"
                                      ? "active"
                                      : "discharged"
                                  }
                                >
                                  {encounter.status}
                                </StatusBadge>
                              </div>

                              {encounter.discharged_at && (
                                <div className="mt-3 text-sm text-slate-400">
                                  Discharged:{" "}
                                  {formatDate(
                                    encounter.discharged_at,
                                  )}

                                  {encounter.discharge_reason && (
                                    <>
                                      {" • "}
                                      Reason:{" "}
                                      <span className="text-slate-300">
                                        {
                                          encounter.discharge_reason
                                        }
                                      </span>
                                    </>
                                  )}
                                </div>
                              )}
                            </div>
                          ),
                        )
                      ) : (
                        <p className="text-sm text-slate-500">
                          No encounter history.
                        </p>
                      )}
                    </div>
                  </section>


                  <section>
                    <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-400">
                      Nurse Assignment History
                    </h3>

                    <div className="space-y-2">
                      {history.nurse_assignments?.length ? (
                        history.nurse_assignments.map(
                          (assignment) => (
                            <div
                              key={assignment.id}
                              className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-800 bg-slate-900 p-4"
                            >
                              <div>
                                <p className="font-semibold text-white">
                                  {assignment.nurse_name ||
                                    "Unknown nurse"}
                                </p>

                                <p className="mt-1 text-sm text-slate-400">
                                  Assigned{" "}
                                  {formatDate(
                                    assignment.assigned_at,
                                  )}
                                </p>
                              </div>

                              <StatusBadge
                                type={
                                  assignment.is_active
                                    ? "active"
                                    : "discharged"
                                }
                              >
                                {assignment.is_active
                                  ? "ACTIVE"
                                  : "CLOSED"}
                              </StatusBadge>
                            </div>
                          ),
                        )
                      ) : (
                        <p className="text-sm text-slate-500">
                          No nurse assignment history.
                        </p>
                      )}
                    </div>
                  </section>


                  <div className="rounded-xl border border-cyan-500/20 bg-cyan-500/5 p-4">
                    <div className="flex gap-3">
                      <ShieldCheck className="h-5 w-5 shrink-0 text-cyan-400" />

                      <div>
                        <p className="font-semibold text-cyan-300">
                          Historical record preserved
                        </p>

                        <p className="mt-1 text-sm leading-6 text-slate-400">
                          Discharge changes the patient's
                          operational status without deleting
                          the patient record, encounter history,
                          billing information, or assignment
                          history.
                        </p>
                      </div>
                    </div>
                  </div>

                </div>
              ) : null}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}