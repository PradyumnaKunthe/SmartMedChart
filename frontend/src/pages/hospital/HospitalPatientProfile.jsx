import { useEffect, useState } from "react"
import { useNavigate, useParams } from "react-router-dom"
import {
  ArrowLeft,
  UserRound,
  CalendarDays,
  Weight,
  BedDouble,
  CheckCircle2,
  Stethoscope,
  AlertCircle,
  Receipt,
} from "lucide-react"

import MainLayout from "../../components/MainLayout"
import api from "../../services/api"

export default function HospitalPatientProfile() {
  const { patientId } = useParams()
  const navigate = useNavigate()

  const [patient, setPatient] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  useEffect(() => {
    async function loadPatient() {
      try {
        setLoading(true)
        setError("")

        const response = await api.get(
          `/api/hospital/patients/${patientId}`,
        )

        const patientData =
          response.data?.patient ?? response.data

        setPatient(patientData)
      } catch (requestError) {
        console.error(
          "Hospital patient load error:",
          requestError,
        )

        setError(
          requestError?.response?.data?.detail ||
            "Unable to load patient information.",
        )
      } finally {
        setLoading(false)
      }
    }

    if (patientId) {
      loadPatient()
    }
  }, [patientId])

  function formatDate(value) {
    if (!value) {
      return "Not available"
    }

    try {
      return new Date(value).toLocaleDateString(
        "en-IN",
        {
          day: "2-digit",
          month: "short",
          year: "numeric",
        },
      )
    } catch {
      return value
    }
  }

  function display(value, fallback = "Not available") {
    if (
      value === null ||
      value === undefined ||
      value === ""
    ) {
      return fallback
    }

    return value
  }

  if (loading) {
    return (
      <MainLayout title="Patient Profile">
        <div className="flex min-h-[60vh] items-center justify-center">
          <div className="text-sm font-medium text-slate-500">
            Loading patient information...
          </div>
        </div>
      </MainLayout>
    )
  }

  if (error) {
    return (
      <MainLayout title="Patient Profile">
        <div className="mx-auto max-w-4xl">
          <button
            type="button"
            onClick={() =>
              navigate("/hospital/dashboard")
            }
            className="mb-6 inline-flex items-center gap-2 text-sm font-semibold text-slate-500 transition hover:text-slate-900"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Hospital Dashboard
          </button>

          <div className="rounded-2xl border border-red-200 bg-red-50 p-6">
            <div className="flex items-center gap-3">
              <AlertCircle className="h-5 w-5 text-red-600" />

              <div>
                <h2 className="font-semibold text-red-900">
                  Unable to load patient
                </h2>

                <p className="mt-1 text-sm text-red-700">
                  {error}
                </p>
              </div>
            </div>
          </div>
        </div>
      </MainLayout>
    )
  }

  if (!patient) {
    return (
      <MainLayout title="Patient Profile">
        <div className="mx-auto max-w-4xl">
          <button
            type="button"
            onClick={() =>
              navigate("/hospital/dashboard")
            }
            className="mb-6 inline-flex items-center gap-2 text-sm font-semibold text-slate-500"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Hospital Dashboard
          </button>

          <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center">
            <p className="font-semibold text-slate-900">
              Patient not found
            </p>
          </div>
        </div>
      </MainLayout>
    )
  }

  const fullName =
    patient.full_name ||
    `${patient.first_name || ""} ${
      patient.last_name || ""
    }`.trim()

  const wardName =
    patient.ward?.name ||
    patient.ward_name ||
    (patient.ward_id
      ? `Ward #${patient.ward_id}`
      : "Not assigned")

  const bedName =
    patient.bed?.bed_number ||
    patient.bed_number ||
    (patient.bed_id
      ? `Bed #${patient.bed_id}`
      : "Not assigned")

  const doctorName =
    patient.doctor?.full_name ||
    patient.encounter?.doctor_name ||
    "Not assigned"

  const doctorId =
    patient.doctor?.id ||
    patient.encounter?.doctor_id ||
    null

  const isActive = Boolean(patient.is_active)
  const qrActive = Boolean(patient.qr_is_active)

  return (
    <MainLayout title="Patient Profile">
      <div className="mx-auto max-w-6xl space-y-6">
        {/* BACK */}
        <button
          type="button"
          onClick={() =>
            navigate("/hospital/dashboard")
          }
          className="inline-flex items-center gap-2 text-sm font-semibold text-slate-500 transition hover:text-slate-900"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Hospital Dashboard
        </button>

        {/* HEADER */}
        <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
          <div className="bg-slate-950 px-8 py-8 text-white">
            <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
              <div className="flex items-center gap-5">
                <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-cyan-500/10 ring-1 ring-cyan-400/20">
                  <UserRound className="h-10 w-10 text-cyan-400" />
                </div>

                <div>
                  <p className="text-sm font-medium text-cyan-300">
                    Patient Record
                  </p>

                  <h1 className="mt-1 text-3xl font-bold">
                    {display(fullName)}
                  </h1>

                  <p className="mt-2 text-sm text-slate-300">
                    Patient ID:{" "}
                    <span className="font-semibold text-white">
                      {display(patient.patient_id)}
                    </span>
                  </p>
                </div>
              </div>

              <div
                className={`inline-flex w-fit items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold ${
                  isActive
                    ? "bg-emerald-400/10 text-emerald-300 ring-1 ring-emerald-400/20"
                    : "bg-red-400/10 text-red-300 ring-1 ring-red-400/20"
                }`}
              >
                <CheckCircle2 className="h-4 w-4" />
                {isActive ? "ACTIVE" : "DISCHARGED"}
              </div>
            </div>
          </div>

          <div className="grid gap-4 p-6 md:grid-cols-4">
            {/* DOB */}
            <div className="rounded-2xl bg-slate-50 p-5">
              <div className="flex items-center gap-2 text-sm font-medium text-slate-400">
                <CalendarDays className="h-4 w-4 text-cyan-500" />
                DATE OF BIRTH
              </div>

              <p className="mt-3 text-lg font-bold text-slate-900">
                {formatDate(patient.date_of_birth)}
              </p>
            </div>

            {/* GENDER */}
            <div className="rounded-2xl bg-slate-50 p-5">
              <p className="text-sm font-medium text-slate-400">
                GENDER
              </p>

              <p className="mt-3 text-lg font-bold text-slate-900">
                {display(patient.gender)}
              </p>
            </div>

            {/* WEIGHT */}
            <div className="rounded-2xl bg-slate-50 p-5">
              <div className="flex items-center gap-2 text-sm font-medium text-slate-400">
                <Weight className="h-4 w-4 text-cyan-500" />
                WEIGHT
              </div>

              <p className="mt-3 text-lg font-bold text-slate-900">
                {patient.weight_kg !== null &&
                patient.weight_kg !== undefined
                  ? `${patient.weight_kg} kg`
                  : "Not available"}
              </p>
            </div>

            {/* DATABASE ID */}
            <div className="rounded-2xl bg-slate-50 p-5">
              <p className="text-sm font-medium text-slate-400">
                DATABASE ID
              </p>

              <p className="mt-3 text-lg font-bold text-slate-900">
                #{display(patient.id, "—")}
              </p>
            </div>
          </div>
        </section>

        {/* HOSPITAL LOCATION */}
        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-6 flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-cyan-50">
              <BedDouble className="h-6 w-6 text-cyan-600" />
            </div>

            <div>
              <h2 className="text-xl font-bold text-slate-900">
                Hospital Location
              </h2>

              <p className="text-sm text-slate-500">
                Current ward and bed information.
              </p>
            </div>
          </div>

          <div className="grid gap-5 md:grid-cols-2">
            {/* WARD */}
            <div className="rounded-2xl border border-slate-200 p-5">
              <p className="text-sm font-medium text-slate-400">
                WARD
              </p>

              <p className="mt-2 text-xl font-bold text-slate-900">
                {wardName}
              </p>

              {patient.ward?.code && (
                <p className="mt-1 text-sm text-slate-500">
                  Code: {patient.ward.code}
                </p>
              )}

              {patient.ward_id && (
                <p className="mt-1 text-xs text-slate-400">
                  Ward ID: {patient.ward_id}
                </p>
              )}
            </div>

            {/* BED */}
            <div className="rounded-2xl border border-slate-200 p-5">
              <p className="text-sm font-medium text-slate-400">
                BED
              </p>

              <p className="mt-2 text-xl font-bold text-slate-900">
                {bedName}
              </p>

              {patient.bed_id && (
                <p className="mt-1 text-xs text-slate-400">
                  Bed ID: {patient.bed_id}
                </p>
              )}

              {patient.b?.is_occupied !== undefined && (
                <p className="mt-2 text-sm font-medium text-amber-600">
                  {patient.b?.is_occupied
                    ? "Currently occupied"
                    : "Available"}
                </p>
              )}
            </div>
          </div>
        </section>

        {/* STATUS */}
        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-6 flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-50">
              <CheckCircle2 className="h-6 w-6 text-emerald-600" />
            </div>

            <div>
              <h2 className="text-xl font-bold text-slate-900">
                Patient Status
              </h2>

              <p className="text-sm text-slate-500">
                Current record and QR status.
              </p>
            </div>
          </div>

          <div className="grid gap-5 md:grid-cols-2">
            <div className="rounded-2xl bg-slate-50 p-5">
              <p className="text-sm font-medium text-slate-400">
                PATIENT RECORD
              </p>

              <p
                className={`mt-2 text-lg font-bold ${
                  isActive
                    ? "text-emerald-700"
                    : "text-red-700"
                }`}
              >
                {isActive ? "Active" : "Discharged"}
              </p>
            </div>

            <div className="rounded-2xl bg-slate-50 p-5">
              <p className="text-sm font-medium text-slate-400">
                QR STATUS
              </p>

              <p
                className={`mt-2 text-lg font-bold ${
                  qrActive
                    ? "text-emerald-700"
                    : "text-slate-700"
                }`}
              >
                {qrActive ? "Active" : "Inactive"}
              </p>
            </div>
          </div>
        </section>

        {/* CLINICAL ASSIGNMENT */}
        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-6 flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-violet-50">
              <Stethoscope className="h-6 w-6 text-violet-600" />
            </div>

            <div>
              <h2 className="text-xl font-bold text-slate-900">
                Clinical Assignment
              </h2>

              <p className="text-sm text-slate-500">
                Doctor associated with the current encounter.
              </p>
            </div>
          </div>

          <div className="rounded-2xl bg-slate-50 p-5">
            <p className="text-sm font-medium text-slate-400">
              ATTENDING DOCTOR
            </p>

            <p className="mt-2 text-xl font-bold text-slate-900">
              {doctorName}
            </p>

            {doctorId && (
              <p className="mt-1 text-sm text-slate-500">
                Doctor ID: {doctorId}
              </p>
            )}
          </div>

          {patient.encounter && (
            <div className="mt-5 grid gap-5 md:grid-cols-3">
              <div className="rounded-2xl border border-slate-200 p-4">
                <p className="text-xs font-medium text-slate-400">
                  ENCOUNTER TYPE
                </p>

                <p className="mt-2 font-bold text-slate-900">
                  {display(
                    patient.encounter.encounter_type,
                  )}
                </p>
              </div>

              <div className="rounded-2xl border border-slate-200 p-4">
                <p className="text-xs font-medium text-slate-400">
                  ENCOUNTER STATUS
                </p>

                <p className="mt-2 font-bold text-slate-900">
                  {display(
                    patient.encounter.status,
                  )}
                </p>
              </div>

              <div className="rounded-2xl border border-slate-200 p-4">
                <p className="text-xs font-medium text-slate-400">
                  ADMITTED AT
                </p>

                <p className="mt-2 font-bold text-slate-900">
                  {formatDate(
                    patient.encounter.admitted_at,
                  )}
                </p>
              </div>
            </div>
          )}
        </section>

        {/* BILLING */}
        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-6 flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-amber-50">
              <Receipt className="h-6 w-6 text-amber-600" />
            </div>

            <div>
              <h2 className="text-xl font-bold text-slate-900">
                Billing
              </h2>

              <p className="text-sm text-slate-500">
                Current patient billing information.
              </p>
            </div>
          </div>

          <div className="grid gap-5 md:grid-cols-3">
            <div className="rounded-2xl bg-slate-50 p-5">
              <p className="text-sm font-medium text-slate-400">
                BILL STATUS
              </p>

              <p className="mt-2 text-lg font-bold text-slate-900">
                {display(
                  patient.billing?.bill_status,
                  "Not available",
                )}
              </p>
            </div>

            <div className="rounded-2xl bg-slate-50 p-5">
              <p className="text-sm font-medium text-slate-400">
                BILL AMOUNT
              </p>

              <p className="mt-2 text-lg font-bold text-slate-900">
                {patient.billing?.bill_amount !==
                null &&
                patient.billing?.bill_amount !==
                  undefined
                  ? `₹${patient.billing.bill_amount}`
                  : "Not available"}
              </p>
            </div>

            <div className="rounded-2xl bg-slate-50 p-5">
              <p className="text-sm font-medium text-slate-400">
                PAID AT
              </p>

              <p className="mt-2 text-lg font-bold text-slate-900">
                {patient.billing?.paid_at
                  ? formatDate(
                      patient.billing.paid_at,
                    )
                  : "Not paid"}
              </p>
            </div>
          </div>
        </section>
      </div>
    </MainLayout>
  )
}