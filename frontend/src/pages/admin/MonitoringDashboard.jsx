import {
  Activity,
  ArrowRight,
  BriefcaseBusiness,
  ChevronDown,
  ChevronUp,
  Clock3,
  Pill,
  Stethoscope,
  UserRound,
} from "lucide-react"

import { useEffect, useMemo, useState } from "react"

import MainLayout from "../../components/layout/MainLayout"

import {
  getDoctorWorkload,
  getNurseWorkload,
} from "../../services/admin"


// =========================================================
// HELPERS
// =========================================================

function formatDate(value) {
  if (!value) {
    return "—"
  }

  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return "—"
  }

  return date.toLocaleString()
}


// =========================================================
// STAFF CARD
// =========================================================

function StaffCard({
  person,
  type,
  onClick,
}) {
  const isNurse = type === "nurse"

  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full rounded-2xl border border-slate-200 bg-white p-5 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-cyan-300 hover:shadow-md"
    >

      <div className="flex items-center gap-4">

        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-cyan-50">

          {isNurse ? (
            <UserRound className="h-6 w-6 text-cyan-600" />
          ) : (
            <Stethoscope className="h-6 w-6 text-cyan-600" />
          )}

        </div>

        <div className="min-w-0 flex-1">

          <div className="flex flex-wrap items-center gap-2">

            <h3 className="font-bold text-slate-900">
              {person.full_name}
            </h3>

            <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-1 text-[10px] font-bold uppercase text-emerald-700">
              Active
            </span>

          </div>

          <p className="mt-1 text-xs text-slate-500">
            {isNurse ? "Nurse" : "Doctor"} ID: {person.id}
          </p>

        </div>

        <ArrowRight className="h-5 w-5 shrink-0 text-slate-400" />

      </div>

      <div className="mt-4 grid grid-cols-2 gap-3">

        <div className="rounded-xl bg-slate-50 p-3">

          <p className="text-xs text-slate-500">
            Patients
          </p>

          <p className="mt-1 text-2xl font-bold text-slate-900">
            {person.patient_count || 0}
          </p>

        </div>

        <div className="rounded-xl bg-slate-50 p-3">

          <p className="text-xs text-slate-500">
            Username
          </p>

          <p className="mt-1 truncate text-sm font-semibold text-slate-800">
            {person.username}
          </p>

        </div>

      </div>

    </button>
  )
}


// =========================================================
// PATIENT LIST
// =========================================================

function PatientList({
  person,
  type,
}) {
  const [openPatient, setOpenPatient] = useState(null)

  const patients = person?.patients || []

  return (
    <div className="mt-6">

      <div className="mb-4 flex items-center justify-between">

        <div>

          <p className="text-xs font-bold uppercase tracking-wider text-slate-400">
            Assigned Patients
          </p>

          <h3 className="mt-1 text-lg font-bold text-slate-900">
            {patients.length} patient
            {patients.length === 1 ? "" : "s"}
          </h3>

        </div>

      </div>

      {patients.length === 0 ? (

        <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center">

          <UserRound className="mx-auto h-8 w-8 text-slate-300" />

          <p className="mt-3 font-semibold text-slate-700">
            No active patients assigned
          </p>

          <p className="mt-1 text-sm text-slate-500">
            No current patient workload is recorded for this {type}.
          </p>

        </div>

      ) : (

        <div className="space-y-3">

          {patients.map((patient) => {

            const isOpen =
              openPatient === patient.patient_id

            return (
              <div
                key={
                  patient.assignment_id ||
                  patient.encounter_id ||
                  patient.patient_id
                }
                className="overflow-hidden rounded-2xl border border-slate-200 bg-white"
              >

                <button
                  type="button"
                  onClick={() =>
                    setOpenPatient(
                      isOpen
                        ? null
                        : patient.patient_id,
                    )
                  }
                  className="flex w-full items-center gap-4 p-4 text-left"
                >

                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100">

                    <UserRound className="h-5 w-5 text-slate-600" />

                  </div>

                  <div className="min-w-0 flex-1">

                    <p className="font-bold text-slate-900">
                      {patient.patient_name}
                    </p>

                    <p className="mt-1 text-xs text-slate-500">
                      {patient.patient_code}
                    </p>

                  </div>

                  {isOpen ? (
                    <ChevronUp className="h-5 w-5 text-slate-400" />
                  ) : (
                    <ChevronDown className="h-5 w-5 text-slate-400" />
                  )}

                </button>

                {isOpen && (

                  <div className="grid gap-3 border-t border-slate-100 bg-slate-50 p-4 md:grid-cols-3">

                    <div className="rounded-xl bg-white p-3">

                      <p className="text-xs text-slate-400">
                        Patient ID
                      </p>

                      <p className="mt-1 font-semibold text-slate-900">
                        {patient.patient_code}
                      </p>

                    </div>

                    <div className="rounded-xl bg-white p-3">

                      <p className="text-xs text-slate-400">
                        {type === "nurse"
                          ? "Assigned"
                          : "Encounter"}
                      </p>

                      <p className="mt-1 font-semibold text-slate-900">
                        {formatDate(
                          patient.assigned_at ||
                            patient.created_at,
                        )}
                      </p>

                    </div>

                    <div className="rounded-xl bg-white p-3">

                      <p className="text-xs text-slate-400">
                        Type
                      </p>

                      <p className="mt-1 font-semibold text-slate-900">
                        {patient.encounter_type ||
                          "Patient"}
                      </p>

                    </div>

                  </div>

                )}

              </div>
            )
          })}

        </div>

      )}

    </div>
  )
}


// =========================================================
// WORKLOAD SECTION
// =========================================================

function WorkloadSection({
  title,
  subtitle,
  icon: Icon,
  people,
  type,
  open,
  setOpen,
  selectedPerson,
  setSelectedPerson,
}) {
  const totalPatients = useMemo(
    () =>
      people.reduce(
        (total, person) =>
          total +
          Number(person.patient_count || 0),
        0,
      ),
    [people],
  )

  return (

    <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">

      {/* =================================================
          HEADER
      ================================================= */}

      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full p-6 text-left transition hover:bg-slate-50"
      >

        <div className="flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">

          <div className="flex items-center gap-4">

            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-cyan-50">

              <Icon className="h-7 w-7 text-cyan-600" />

            </div>

            <div>

              <h2 className="text-2xl font-bold text-slate-900">
                {title}
              </h2>

              <p className="mt-1 text-sm text-slate-500">
                {subtitle}
              </p>

            </div>

          </div>

          <div className="flex items-center gap-3">

            <div className="rounded-xl bg-slate-50 px-4 py-3">

              <p className="text-xs text-slate-500">
                Registered
              </p>

              <p className="text-xl font-bold text-slate-900">
                {people.length}
              </p>

            </div>

            <div className="rounded-xl bg-slate-50 px-4 py-3">

              <p className="text-xs text-slate-500">
                Patients
              </p>

              <p className="text-xl font-bold text-slate-900">
                {totalPatients}
              </p>

            </div>

            <div className="rounded-xl border border-cyan-200 bg-cyan-50 p-3">

              {open ? (
                <ChevronUp className="h-5 w-5 text-cyan-700" />
              ) : (
                <ChevronDown className="h-5 w-5 text-cyan-700" />
              )}

            </div>

          </div>

        </div>

      </button>


      {/* =================================================
          OPEN STAFF LIST
      ================================================= */}

      {open && (

        <div className="border-t border-slate-200 bg-slate-50/60 p-5">

          <div className="grid gap-4 xl:grid-cols-2">

            <div
              className={
                selectedPerson
                  ? "xl:col-span-1"
                  : "xl:col-span-2"
              }
            >

              <p className="mb-3 text-xs font-bold uppercase tracking-wider text-slate-400">
                Registered {type === "nurse" ? "Nurses" : "Doctors"}
              </p>

              <div className="space-y-3">

                {people.map((person) => (

                  <StaffCard
                    key={person.id}
                    person={person}
                    type={type}
                    onClick={() =>
                      setSelectedPerson(person)
                    }
                  />

                ))}

              </div>

            </div>


            {/* =================================================
                SELECTED PERSON
            ================================================= */}

            {selectedPerson && (

              <div className="rounded-3xl border border-slate-200 bg-white p-5">

                <div className="flex items-center justify-between gap-3">

                  <div>

                    <p className="text-xs font-bold uppercase tracking-wider text-cyan-600">
                      {type === "nurse"
                        ? "Nurse Workload"
                        : "Doctor Workload"}
                    </p>

                    <h3 className="mt-1 text-xl font-bold text-slate-900">
                      {selectedPerson.full_name}
                    </h3>

                    <p className="mt-1 text-sm text-slate-500">
                      {type === "nurse"
                        ? "Assigned patients and activity"
                        : "Patients linked to active encounters"}
                    </p>

                  </div>

                  <button
                    type="button"
                    onClick={() =>
                      setSelectedPerson(null)
                    }
                    className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                  >
                    Close
                  </button>

                </div>


                <div className="mt-5 grid grid-cols-2 gap-3">

                  <div className="rounded-2xl bg-slate-50 p-4">

                    <p className="text-xs text-slate-500">
                      Patients
                    </p>

                    <p className="mt-1 text-3xl font-bold text-slate-900">
                      {selectedPerson.patient_count || 0}
                    </p>

                  </div>

                  <div className="rounded-2xl bg-slate-50 p-4">

                    <p className="text-xs text-slate-500">
                      Staff ID
                    </p>

                    <p className="mt-1 text-3xl font-bold text-slate-900">
                      {selectedPerson.id}
                    </p>

                  </div>

                </div>


                <PatientList
                  person={selectedPerson}
                  type={type}
                />

              </div>

            )}

          </div>

        </div>

      )}

    </section>
  )
}


// =========================================================
// MAIN PAGE
// =========================================================

export default function MonitoringDashboard() {

  const [nurses, setNurses] = useState([])

  const [doctors, setDoctors] = useState([])

  const [loading, setLoading] = useState(true)

  const [error, setError] = useState("")

  const [nurseOpen, setNurseOpen] = useState(false)

  const [doctorOpen, setDoctorOpen] = useState(false)

  const [selectedNurse, setSelectedNurse] = useState(null)

  const [selectedDoctor, setSelectedDoctor] = useState(null)


  async function loadWorkload() {

    setLoading(true)
    setError("")

    try {

      const [
        nurseResponse,
        doctorResponse,
      ] = await Promise.all([
        getNurseWorkload(),
        getDoctorWorkload(),
      ])

      setNurses(
        Array.isArray(nurseResponse?.nurses)
          ? nurseResponse.nurses
          : [],
      )

      setDoctors(
        Array.isArray(doctorResponse?.doctors)
          ? doctorResponse.doctors
          : [],
      )

    } catch (requestError) {

      console.error(
        "Workload loading error:",
        requestError,
      )

      setError(
        requestError?.response?.data?.detail ||
          "Unable to load staff workload.",
      )

    } finally {

      setLoading(false)

    }
  }


  useEffect(() => {
    loadWorkload()
  }, [])


  if (loading) {
    return (
      <MainLayout title="Staff Workload">

        <div className="flex min-h-[60vh] items-center justify-center">

          <div className="text-center">

            <Activity className="mx-auto h-10 w-10 animate-pulse text-cyan-600" />

            <p className="mt-4 font-semibold text-slate-800">
              Loading staff workload...
            </p>

            <p className="mt-1 text-sm text-slate-500">
              Loading registered nurses, doctors and patients.
            </p>

          </div>

        </div>

      </MainLayout>
    )
  }


  return (
    <MainLayout title="Staff Workload">

      <div className="mx-auto max-w-7xl space-y-6">

        {/* =================================================
            HEADER
        ================================================= */}

        <section className="rounded-3xl border border-slate-800 bg-slate-950 p-6 text-white">

          <div className="flex items-center gap-4">

            <div className="rounded-2xl bg-cyan-500/10 p-3">

              <BriefcaseBusiness className="h-7 w-7 text-cyan-400" />

            </div>

            <div>

              <p className="text-xs font-bold uppercase tracking-[0.18em] text-cyan-400">
                SMARTMEDCHART
              </p>

              <h1 className="mt-1 text-2xl font-bold">
                Staff Workload
              </h1>

              <p className="mt-2 text-sm text-slate-400">
                Review registered staff and their current patient workload.
              </p>

            </div>

          </div>

        </section>


        {/* =================================================
            ERROR
        ================================================= */}

        {error && (

          <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-700">
            {error}
          </div>

        )}


        {/* =================================================
            NURSE WORKLOAD
        ================================================= */}

        <WorkloadSection
          title="Nurse Workload"
          subtitle="Registered nurses and their assigned patients"
          icon={UserRound}
          people={nurses}
          type="nurse"
          open={nurseOpen}
          setOpen={(value) => {
            setNurseOpen(value)

            if (!value) {
              setSelectedNurse(null)
            }
          }}
          selectedPerson={selectedNurse}
          setSelectedPerson={setSelectedNurse}
        />


        {/* =================================================
            DOCTOR WORKLOAD
        ================================================= */}

        <WorkloadSection
          title="Doctor Workload"
          subtitle="Registered doctors and patients under active encounters"
          icon={Stethoscope}
          people={doctors}
          type="doctor"
          open={doctorOpen}
          setOpen={(value) => {
            setDoctorOpen(value)

            if (!value) {
              setSelectedDoctor(null)
            }
          }}
          selectedPerson={selectedDoctor}
          setSelectedPerson={setSelectedDoctor}
        />

      </div>

    </MainLayout>
  )
}