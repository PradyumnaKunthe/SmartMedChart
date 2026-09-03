import {
  useCallback,
  useState,
} from "react"

import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  ChevronRight,
  LoaderCircle,
  Pill,
  QrCode,
  ShieldCheck,
  XCircle,
} from "lucide-react"

import {
  useNavigate,
  useSearchParams,
} from "react-router-dom"

import MainLayout from "../../components/layout/MainLayout"

import PatientVerification from "../../components/qr/PatientVerification"

import {
  verifyMedication,
} from "../../services/qr"


// =========================================================
// MAIN
// =========================================================

export default function QRScanner() {
  const navigate =
    useNavigate()

  const [
    searchParams,
  ] = useSearchParams()

  const scheduleId =
    searchParams.get(
      "schedule",
    )

  const [
    patientId,
    setPatientId,
  ] = useState(null)

  const [
    medicationResult,
    setMedicationResult,
  ] = useState(null)

  const [
    verifyingMedication,
    setVerifyingMedication,
  ] = useState(false)


  // =======================================================
  // PATIENT VERIFIED
  // =======================================================

  const handlePatientVerified =
    useCallback(
      async (
        verifiedPatientId,
      ) => {
        setPatientId(
          verifiedPatientId,
        )

        setMedicationResult(
          null,
        )

        // A schedule is required for medication verification.
        if (!scheduleId) {
          setMedicationResult({
            valid: false,
            patient_id:
              verifiedPatientId,
            medication_schedule_id:
              null,
            message:
              "No medication schedule was selected. Return to Medications and choose a scheduled dose first.",
          })

          return
        }

        setVerifyingMedication(
          true,
        )

        try {
          const response =
            await verifyMedication(
              verifiedPatientId,
              Number(
                scheduleId,
              ),
            )

          setMedicationResult(
            response,
          )

          // IMPORTANT:
          // Only continue after the backend confirms that
          // the selected medication belongs to this patient.
          if (response.valid) {
            navigate(
              `/nurse/administration/${scheduleId}`,
              {
                replace: true,
              },
            )
          }

        } catch (
          requestError
        ) {
          const message =
            requestError?.response?.data
              ?.detail ||
            requestError?.message ||
            "Unable to verify medication."

          setMedicationResult({
            valid: false,
            patient_id:
              verifiedPatientId,
            medication_schedule_id:
              Number(
                scheduleId,
              ),
            message,
          })

        } finally {
          setVerifyingMedication(
            false,
          )
        }
      },
      [
        navigate,
        scheduleId,
      ],
    )


  // =======================================================
  // BACK
  // =======================================================

  function goBack() {
    navigate(
      scheduleId
        ? `/nurse/medications/${scheduleId}`
        : "/nurse/medications",
    )
  }


  // =======================================================
  // RETURN
  // =======================================================

  return (
    <MainLayout title="QR Verification">

      <div className="mx-auto max-w-5xl space-y-5 sm:space-y-6">

        {/* =================================================
            BACK
        ================================================= */}

        <button
          type="button"
          onClick={
            goBack
          }
          className="inline-flex items-center gap-2 rounded-xl px-1 py-2 text-sm font-semibold text-slate-600 transition hover:text-slate-900"
        >
          <ArrowLeft className="h-4 w-4" />

          Back to medication
        </button>


        {/* =================================================
            PHONE-FIRST HEADER
        ================================================= */}

        <section className="overflow-hidden rounded-3xl border border-slate-800 bg-slate-950 text-white shadow-lg">

          <div className="p-5 sm:p-6 lg:p-7">

            <div className="flex items-start gap-4">

              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-cyan-500/10">
                <QrCode className="h-6 w-6 text-cyan-400" />
              </div>

              <div className="min-w-0">

                <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-cyan-400 sm:text-xs">
                  Secure Verification
                </p>

                <h1 className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">
                  Patient Verification
                </h1>

                <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">
                  Scan the patient QR code, verify identity,
                  and confirm the selected medication before
                  administration.
                </p>

              </div>

            </div>


            {/* Security strip */}

            <div className="mt-5 grid gap-2 border-t border-slate-800 pt-5 sm:grid-cols-3">

              <SecurityItem
                number="01"
                label="Patient Identity"
                active={!patientId}
                complete={
                  Boolean(
                    patientId,
                  )
                }
              />

              <SecurityItem
                number="02"
                label="Medication Match"
                active={
                  Boolean(
                    patientId,
                  ) &&
                  !medicationResult
                }
                complete={
                  medicationResult?.valid ===
                  true
                }
              />

              <SecurityItem
                number="03"
                label="Administration"
                active={
                  medicationResult?.valid ===
                  true
                }
              />

            </div>

          </div>

        </section>


        {/* =================================================
            SELECTED SCHEDULE
        ================================================= */}

        {scheduleId ? (

          <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">

            <div className="flex items-start gap-3">

              <div className="shrink-0 rounded-xl bg-indigo-50 p-3">
                <Pill className="h-5 w-5 text-indigo-600" />
              </div>

              <div className="min-w-0">

                <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">
                  Selected Medication
                </p>

                <p className="mt-1 text-base font-bold text-slate-900 sm:text-lg">
                  Schedule #{scheduleId}
                </p>

                <p className="mt-1 text-sm leading-5 text-slate-500">
                  This exact medication schedule will be checked
                  against the scanned patient.
                </p>

              </div>

            </div>

          </section>

        ) : (

          <section className="rounded-2xl border border-amber-200 bg-amber-50 p-4 sm:p-5">

            <div className="flex items-start gap-3">

              <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />

              <div className="min-w-0">

                <p className="text-sm font-semibold text-amber-900">
                  No medication selected
                </p>

                <p className="mt-1 text-sm leading-6 text-amber-800">
                  You can verify a patient QR code, but medication
                  verification requires a selected medication schedule.
                </p>

                <button
                  type="button"
                  onClick={() =>
                    navigate(
                      "/nurse/medications",
                    )
                  }
                  className="mt-4 inline-flex items-center gap-2 rounded-xl bg-amber-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-amber-700"
                >
                  Select medication

                  <ChevronRight className="h-4 w-4" />
                </button>

              </div>

            </div>

          </section>
        )}


        {/* =================================================
            PATIENT SCANNER
        ================================================= */}

        {!patientId && (

          <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">

            <div className="mb-5">

              <div className="flex items-center gap-3">

                <div className="rounded-xl bg-cyan-50 p-2.5">
                  <QrCode className="h-5 w-5 text-cyan-600" />
                </div>

                <div>

                  <h2 className="font-semibold text-slate-900">
                    Scan Patient QR
                  </h2>

                  <p className="text-xs text-slate-500 sm:text-sm">
                    Position the patient's QR code inside the scanner.
                  </p>

                </div>

              </div>

            </div>


            <div className="mx-auto w-full max-w-md">

              <PatientVerification
                onVerified={
                  handlePatientVerified
                }
              />

            </div>


            <div className="mt-5 rounded-2xl border border-cyan-100 bg-cyan-50/60 p-4">

              <div className="flex items-start gap-3">

                <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-cyan-700" />

                <div>

                  <p className="text-xs font-semibold text-cyan-900">
                    Verification required
                  </p>

                  <p className="mt-1 text-xs leading-5 text-cyan-800">
                    Do not proceed with medication administration
                    until the patient identity and medication match
                    are confirmed by the backend.
                  </p>

                </div>

              </div>

            </div>

          </section>

        )}


        {/* =================================================
            PATIENT VERIFIED
        ================================================= */}

        {patientId && (

          <section className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 sm:p-5">

            <div className="flex items-start gap-3">

              <div className="rounded-xl bg-emerald-100 p-3">
                <CheckCircle2 className="h-5 w-5 text-emerald-600" />
              </div>

              <div className="min-w-0">

                <p className="text-xs font-bold uppercase tracking-wider text-emerald-600">
                  Patient Verification
                </p>

                <p className="mt-1 text-base font-bold text-emerald-900">
                  Patient #{patientId} verified
                </p>

                <p className="mt-1 text-sm leading-5 text-emerald-700">
                  Patient identity has been successfully verified
                  using the QR workflow.
                </p>

              </div>

            </div>

          </section>

        )}


        {/* =================================================
            MEDICATION VERIFICATION
        ================================================= */}

        {patientId && scheduleId && (

          <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">

            <div className="flex items-start gap-3">

              <div className="shrink-0 rounded-xl bg-indigo-50 p-3">
                <Pill className="h-5 w-5 text-indigo-600" />
              </div>

              <div className="min-w-0">

                <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-indigo-600">
                  Step 2
                </p>

                <h2 className="mt-1 text-lg font-bold text-slate-900">
                  Medication Verification
                </h2>

                <p className="mt-1 text-sm text-slate-500">
                  Patient #{patientId}
                  {" · "}
                  Schedule #{scheduleId}
                </p>

              </div>

            </div>


            {/* Verifying */}

            {verifyingMedication && (

              <div className="mt-5 rounded-2xl border border-indigo-100 bg-indigo-50 p-4">

                <div className="flex items-center gap-3">

                  <LoaderCircle className="h-5 w-5 animate-spin text-indigo-600" />

                  <div>

                    <p className="text-sm font-semibold text-indigo-900">
                      Verifying medication...
                    </p>

                    <p className="mt-1 text-xs leading-5 text-indigo-700">
                      Checking patient, prescription, medicine,
                      and schedule.
                    </p>

                  </div>

                </div>

              </div>

            )}


            {/* Result */}

            {medicationResult && (

              <div
                className={[
                  "mt-5 rounded-2xl border p-4 sm:p-5",
                  medicationResult.valid
                    ? "border-emerald-200 bg-emerald-50"
                    : "border-red-200 bg-red-50",
                ].join(" ")}
              >

                <div className="flex items-start gap-3">

                  {medicationResult.valid ? (

                    <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />

                  ) : (

                    <XCircle className="mt-0.5 h-5 w-5 shrink-0 text-red-600" />

                  )}

                  <div className="min-w-0">

                    <p
                      className={[
                        "font-semibold",
                        medicationResult.valid
                          ? "text-emerald-900"
                          : "text-red-900",
                      ].join(" ")}
                    >
                      {medicationResult.valid
                        ? "Medication Verified"
                        : "Medication Verification Failed"}
                    </p>

                    <p
                      className={[
                        "mt-1 text-sm leading-6",
                        medicationResult.valid
                          ? "text-emerald-700"
                          : "text-red-700",
                      ].join(" ")}
                    >
                      {
                        medicationResult.message
                      }
                    </p>


                    {medicationResult.valid &&
                      medicationResult.medicine_name && (

                        <div className="mt-4 rounded-xl border border-emerald-100 bg-white/80 p-3">

                          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                            Verified Medicine
                          </p>

                          <p className="mt-1 text-sm font-bold text-emerald-900">
                            {
                              medicationResult.medicine_name
                            }
                          </p>

                        </div>

                      )}

                  </div>

                </div>


                {/* Manual fallback / explicit administration button.
                    Normally successful verification navigates automatically,
                    but this button remains available if navigation is delayed. */}

                {medicationResult.valid && (

                  <button
                    type="button"
                    onClick={() =>
                      navigate(
                        `/nurse/administration/${scheduleId}`,
                        {
                          replace: true,
                        },
                      )
                    }
                    className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-emerald-700 sm:w-auto"
                  >
                    Proceed to Administration

                    <ChevronRight className="h-4 w-4" />
                  </button>

                )}

              </div>

            )}

          </section>

        )}


        {/* =================================================
            PROCESS EXPLANATION
        ================================================= */}

        <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">

          <div className="mb-5">

            <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-slate-400">
              Clinical Workflow
            </p>

            <h2 className="mt-1 text-lg font-bold text-slate-900">
              Verification sequence
            </h2>

          </div>


          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">

            <WorkflowCard
              number="01"
              title="Patient"
              description="Verify the patient's identity using the QR code."
              tone="cyan"
              complete={
                Boolean(
                  patientId,
                )
              }
            />

            <WorkflowCard
              number="02"
              title="Medication"
              description="Match the selected medication schedule to the verified patient."
              tone="indigo"
              complete={
                medicationResult?.valid ===
                true
              }
            />

            <WorkflowCard
              number="03"
              title="Administration"
              description="Record the actual medication outcome after verification."
              tone="emerald"
              complete={false}
            />

          </div>

        </section>

      </div>

    </MainLayout>
  )
}


// =========================================================
// SECURITY ITEM
// =========================================================

function SecurityItem({
  number,
  label,
  active = false,
  complete = false,
}) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/80 p-3">

      <div className="flex items-center gap-2">

        <div
          className={[
            "flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-[10px] font-bold",
            complete
              ? "bg-emerald-500 text-white"
              : active
                ? "bg-cyan-500 text-slate-950"
                : "bg-slate-800 text-slate-500",
          ].join(" ")}
        >

          {complete ? (
            <CheckCircle2 className="h-3.5 w-3.5" />
          ) : (
            number
          )}

        </div>

        <span
          className={[
            "text-[10px] font-bold uppercase tracking-wide",
            complete
              ? "text-emerald-400"
              : active
                ? "text-cyan-400"
                : "text-slate-500",
          ].join(" ")}
        >
          {label}
        </span>

      </div>

    </div>
  )
}


// =========================================================
// WORKFLOW CARD
// =========================================================

function WorkflowCard({
  number,
  title,
  description,
  tone,
  complete = false,
}) {
  const tones = {
    cyan:
      "border-cyan-100 bg-cyan-50 text-cyan-700",

    indigo:
      "border-indigo-100 bg-indigo-50 text-indigo-700",

    violet:
      "border-violet-100 bg-violet-50 text-violet-700",

    emerald:
      "border-emerald-100 bg-emerald-50 text-emerald-700",
  }

  return (
    <div
      className={[
        "rounded-2xl border p-4",
        tones[tone] ||
          tones.cyan,
      ].join(" ")}
    >

      <div className="flex items-center justify-between">

        <span className="text-xs font-bold">
          {number}
        </span>

        {complete && (
          <CheckCircle2 className="h-4 w-4 text-emerald-600" />
        )}

      </div>

      <p className="mt-3 font-semibold text-slate-900">
        {title}
      </p>

      <p className="mt-1 text-xs leading-5 text-slate-500">
        {description}
      </p>

    </div>
  )
}