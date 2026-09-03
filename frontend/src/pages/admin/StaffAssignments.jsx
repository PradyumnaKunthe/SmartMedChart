import {
  CheckCircle2,
  ClipboardList,
  Loader2,
  UserPlus,
  Users,
  UserRound,
  XCircle,
} from "lucide-react"

import {
  useEffect,
  useState,
} from "react"

import MainLayout from "../../components/layout/MainLayout"

import {
  assignPatientToNurse,
  createStaff,
  getAdminAssignments,
  getAdminNurses,
  getAdminPatients,
  removePatientAssignment,
} from "../../services/admin"


function Message({
  type,
  children,
}) {
  if (!children) {
    return null
  }

  const success =
    type === "success"

  return (
    <div
      className={[
        "flex items-start gap-2 rounded-xl border px-4 py-3 text-sm",
        success
          ? "border-emerald-200 bg-emerald-50 text-emerald-700"
          : "border-red-200 bg-red-50 text-red-700",
      ].join(" ")}
    >
      {success ? (
        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
      ) : (
        <XCircle className="mt-0.5 h-4 w-4 shrink-0" />
      )}

      <span>{children}</span>
    </div>
  )
}


function LoadingRow() {
  return (
    <div className="flex items-center justify-center py-12 text-sm text-slate-500">
      <Loader2 className="mr-2 h-5 w-5 animate-spin" />
      Loading...
    </div>
  )
}


export default function StaffAssignments() {
  const [
    nurses,
    setNurses,
  ] = useState([])

  const [
    patients,
    setPatients,
  ] = useState([])

  const [
    assignments,
    setAssignments,
  ] = useState([])

  const [
    loading,
    setLoading,
  ] = useState(true)

  const [
    savingStaff,
    setSavingStaff,
  ] = useState(false)

  const [
    assigning,
    setAssigning,
  ] = useState(false)

  const [
    removingId,
    setRemovingId,
  ] = useState(null)


  const [
    staffForm,
    setStaffForm,
  ] = useState({
    full_name: "",
    username: "",
    email: "",
    password: "",
    role: "nurse",
  })


  const [
    assignmentForm,
    setAssignmentForm,
  ] = useState({
    nurse_id: "",
    patient_id: "",
  })


  const [
    staffSuccess,
    setStaffSuccess,
  ] = useState("")

  const [
    staffError,
    setStaffError,
  ] = useState("")

  const [
    assignmentSuccess,
    setAssignmentSuccess,
  ] = useState("")

  const [
    assignmentError,
    setAssignmentError,
  ] = useState("")


  async function loadData() {
    setLoading(true)

    try {
      const [
        nursesResult,
        patientsResult,
        assignmentsResult,
      ] = await Promise.all([
        getAdminNurses(),
        getAdminPatients(),
        getAdminAssignments(),
      ])

      const loadedNurses =
        Array.isArray(
          nursesResult?.nurses,
        )
          ? nursesResult.nurses
          : []

      const loadedPatients =
        Array.isArray(
          patientsResult?.patients,
        )
          ? patientsResult.patients
          : []

      const loadedAssignments =
        Array.isArray(
          assignmentsResult?.assignments,
        )
          ? assignmentsResult.assignments
          : []

      setNurses(
        loadedNurses,
      )

      setPatients(
        loadedPatients,
      )

      setAssignments(
        loadedAssignments,
      )

      setAssignmentForm(
        (current) => ({
          ...current,
          nurse_id:
            current.nurse_id ||
            loadedNurses[0]?.id?.toString() ||
            "",
          patient_id:
            current.patient_id ||
            loadedPatients[0]?.id?.toString() ||
            "",
        }),
      )

    } catch (error) {
      console.error(
        "Failed to load admin assignment data:",
        error,
      )

      setAssignmentError(
        error?.response?.data?.detail ||
          "Unable to load staff and patient data.",
      )
    } finally {
      setLoading(false)
    }
  }


  useEffect(() => {
    loadData()
  }, [])


  function updateStaffField(
    event,
  ) {
    const {
      name,
      value,
    } = event.target

    setStaffForm(
      (current) => ({
        ...current,
        [name]: value,
      }),
    )
  }


  function updateAssignmentField(
    event,
  ) {
    const {
      name,
      value,
    } = event.target

    setAssignmentForm(
      (current) => ({
        ...current,
        [name]: value,
      }),
    )
  }


  async function handleCreateStaff(
    event,
  ) {
    event.preventDefault()

    setStaffSuccess("")
    setStaffError("")

    if (
      !staffForm.full_name.trim() ||
      !staffForm.username.trim() ||
      !staffForm.email.trim() ||
      !staffForm.password
    ) {
      setStaffError(
        "Please fill in all staff fields.",
      )

      return
    }

    setSavingStaff(true)

    try {
      const result =
        await createStaff(
          staffForm,
        )

      setStaffSuccess(
        result?.message ||
          "Staff account created successfully.",
      )

      setStaffForm({
        full_name: "",
        username: "",
        email: "",
        password: "",
        role: "nurse",
      })

      await loadData()

    } catch (error) {
      console.error(
        "Create staff error:",
        error,
      )

      setStaffError(
        error?.response?.data?.detail ||
          "Unable to create staff account.",
      )
    } finally {
      setSavingStaff(false)
    }
  }


  async function handleAssignment(
    event,
  ) {
    event.preventDefault()

    setAssignmentSuccess("")
    setAssignmentError("")

    if (
      !assignmentForm.nurse_id ||
      !assignmentForm.patient_id
    ) {
      setAssignmentError(
        "Please select both a nurse and a patient.",
      )

      return
    }

    setAssigning(true)

    try {
      const result =
        await assignPatientToNurse(
          assignmentForm.nurse_id,
          assignmentForm.patient_id,
        )

      setAssignmentSuccess(
        result?.message ||
          "Patient assigned successfully.",
      )

      const refreshed =
        await getAdminAssignments()

      setAssignments(
        Array.isArray(
          refreshed?.assignments,
        )
          ? refreshed.assignments
          : [],
      )

    } catch (error) {
      console.error(
        "Assignment error:",
        error,
      )

      setAssignmentError(
        error?.response?.data?.detail ||
          "Unable to assign patient.",
      )
    } finally {
      setAssigning(false)
    }
  }


  async function handleRemoveAssignment(
    assignmentId,
  ) {
    setRemovingId(
      assignmentId,
    )

    setAssignmentSuccess("")
    setAssignmentError("")

    try {
      const result =
        await removePatientAssignment(
          assignmentId,
        )

      setAssignmentSuccess(
        result?.message ||
          "Assignment removed successfully.",
      )

      const refreshed =
        await getAdminAssignments()

      setAssignments(
        Array.isArray(
          refreshed?.assignments,
        )
          ? refreshed.assignments
          : [],
      )

    } catch (error) {
      console.error(
        "Remove assignment error:",
        error,
      )

      setAssignmentError(
        error?.response?.data?.detail ||
          "Unable to remove assignment.",
      )
    } finally {
      setRemovingId(null)
    }
  }


  const assignedPairKeys =
    new Set(
      assignments.map(
        (assignment) =>
          `${assignment.nurse_id}-${assignment.patient_id}`,
      ),
    )


  return (
    <MainLayout title="Staff & Assignments">

      <div className="space-y-6">

        {/* =================================================
            HEADER
        ================================================= */}

        <section className="overflow-hidden rounded-3xl bg-slate-950 text-white shadow-xl">

          <div className="p-6 lg:p-8">

            <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">

              <div>

                <div className="flex items-center gap-3">

                  <div className="rounded-2xl bg-cyan-500/10 p-3">
                    <Users className="h-6 w-6 text-cyan-400" />
                  </div>

                  <div>

                    <p className="text-xs font-bold uppercase tracking-[0.2em] text-cyan-400">
                      SmartMedChart
                    </p>

                    <h1 className="mt-1 text-2xl font-bold">
                      Staff & Patient Assignments
                    </h1>

                  </div>

                </div>

                <p className="mt-4 max-w-3xl text-sm leading-6 text-slate-400">
                  Create clinical staff accounts and control which
                  patients each nurse can access.
                </p>

              </div>

              <div className="flex items-center gap-2 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-4 py-2 text-xs font-bold uppercase tracking-wide text-emerald-400">
                <span className="h-2 w-2 rounded-full bg-emerald-400" />
                Access Control Active
              </div>

            </div>

          </div>

        </section>


        {loading ? (
          <LoadingRow />
        ) : (
          <>

            {/* =================================================
                ADD STAFF + ASSIGN PATIENT
            ================================================= */}

            <div className="grid gap-6 xl:grid-cols-2">

              {/* =================================================
                  CREATE STAFF
              ================================================= */}

              <section className="rounded-3xl border border-slate-200 bg-white shadow-sm">

                <div className="border-b border-slate-100 p-6">

                  <div className="flex items-center gap-3">

                    <div className="rounded-xl bg-cyan-50 p-3">
                      <UserPlus className="h-5 w-5 text-cyan-600" />
                    </div>

                    <div>

                      <h2 className="text-lg font-bold text-slate-900">
                        Add Doctor or Nurse
                      </h2>

                      <p className="text-sm text-slate-500">
                        Create a new clinical staff account.
                      </p>

                    </div>

                  </div>

                </div>


                <form
                  onSubmit={
                    handleCreateStaff
                  }
                  className="space-y-5 p-6"
                >

                  <Message
                    type="success"
                  >
                    {staffSuccess}
                  </Message>

                  <Message
                    type="error"
                  >
                    {staffError}
                  </Message>


                  <div>

                    <label className="mb-2 block text-sm font-semibold text-slate-700">
                      Full Name
                    </label>

                    <input
                      name="full_name"
                      value={
                        staffForm.full_name
                      }
                      onChange={
                        updateStaffField
                      }
                      placeholder="e.g. Priya Sharma"
                      className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-cyan-400 focus:ring-4 focus:ring-cyan-400/10"
                    />

                  </div>


                  <div className="grid gap-4 sm:grid-cols-2">

                    <div>

                      <label className="mb-2 block text-sm font-semibold text-slate-700">
                        Username
                      </label>

                      <input
                        name="username"
                        value={
                          staffForm.username
                        }
                        onChange={
                          updateStaffField
                        }
                        placeholder="priya_nurse"
                        className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-cyan-400 focus:ring-4 focus:ring-cyan-400/10"
                      />

                    </div>


                    <div>

                      <label className="mb-2 block text-sm font-semibold text-slate-700">
                        Role
                      </label>

                      <select
                        name="role"
                        value={
                          staffForm.role
                        }
                        onChange={
                          updateStaffField
                        }
                        className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-cyan-400 focus:ring-4 focus:ring-cyan-400/10"
                      >

                        <option value="nurse">
                          Nurse
                        </option>

                        <option value="doctor">
                          Doctor
                        </option>

                      </select>

                    </div>

                  </div>


                  <div>

                    <label className="mb-2 block text-sm font-semibold text-slate-700">
                      Email
                    </label>

                    <input
                      type="email"
                      name="email"
                      value={
                        staffForm.email
                      }
                      onChange={
                        updateStaffField
                      }
                      placeholder="staff@smartmedchart.com"
                      className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-cyan-400 focus:ring-4 focus:ring-cyan-400/10"
                    />

                  </div>


                  <div>

                    <label className="mb-2 block text-sm font-semibold text-slate-700">
                      Password
                    </label>

                    <input
                      type="password"
                      name="password"
                      value={
                        staffForm.password
                      }
                      onChange={
                        updateStaffField
                      }
                      placeholder="Minimum 8 characters"
                      className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-cyan-400 focus:ring-4 focus:ring-cyan-400/10"
                    />

                  </div>


                  <button
                    type="submit"
                    disabled={
                      savingStaff
                    }
                    className="flex w-full items-center justify-center gap-2 rounded-xl bg-slate-950 px-4 py-3 text-sm font-bold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                  >

                    {savingStaff && (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    )}

                    {savingStaff
                      ? "Creating..."
                      : `Create ${
                          staffForm.role ===
                          "doctor"
                            ? "Doctor"
                            : "Nurse"
                        }`
                    }

                  </button>

                </form>

              </section>


              {/* =================================================
                  ASSIGN PATIENT
              ================================================= */}

              <section className="rounded-3xl border border-slate-200 bg-white shadow-sm">

                <div className="border-b border-slate-100 p-6">

                  <div className="flex items-center gap-3">

                    <div className="rounded-xl bg-violet-50 p-3">
                      <ClipboardList className="h-5 w-5 text-violet-600" />
                    </div>

                    <div>

                      <h2 className="text-lg font-bold text-slate-900">
                        Assign Patient to Nurse
                      </h2>

                      <p className="text-sm text-slate-500">
                        Control which patients the nurse can access.
                      </p>

                    </div>

                  </div>

                </div>


                <form
                  onSubmit={
                    handleAssignment
                  }
                  className="space-y-5 p-6"
                >

                  <Message
                    type="success"
                  >
                    {assignmentSuccess}
                  </Message>

                  <Message
                    type="error"
                  >
                    {assignmentError}
                  </Message>


                  <div>

                    <label className="mb-2 block text-sm font-semibold text-slate-700">
                      Nurse
                    </label>

                    <select
                      name="nurse_id"
                      value={
                        assignmentForm.nurse_id
                      }
                      onChange={
                        updateAssignmentField
                      }
                      className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-violet-400 focus:ring-4 focus:ring-violet-400/10"
                    >

                      <option value="">
                        Select nurse
                      </option>

                      {nurses.map(
                        (nurse) => (
                          <option
                            key={
                              nurse.id
                            }
                            value={
                              nurse.id
                            }
                          >
                            {nurse.full_name}
                            {" · "}
                            @{nurse.username}
                          </option>
                        ),
                      )}

                    </select>

                  </div>


                  <div>

                    <label className="mb-2 block text-sm font-semibold text-slate-700">
                      Patient
                    </label>

                    <select
                      name="patient_id"
                      value={
                        assignmentForm.patient_id
                      }
                      onChange={
                        updateAssignmentField
                      }
                      className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-violet-400 focus:ring-4 focus:ring-violet-400/10"
                    >

                      <option value="">
                        Select patient
                      </option>

                      {patients.map(
                        (patient) => (
                          <option
                            key={
                              patient.id
                            }
                            value={
                              patient.id
                            }
                          >
                            {patient.full_name}
                            {" · "}
                            {patient.patient_id}
                          </option>
                        ),
                      )}

                    </select>

                  </div>


                  <div className="rounded-2xl border border-violet-100 bg-violet-50 p-4">

                    <p className="text-xs font-bold uppercase tracking-wide text-violet-700">
                      Access rule
                    </p>

                    <p className="mt-1 text-sm leading-6 text-violet-900">
                      The selected nurse will be able to access
                      medication and QR workflows only for this patient.
                    </p>

                  </div>


                  <button
                    type="submit"
                    disabled={
                      assigning ||
                      !nurses.length ||
                      !patients.length
                    }
                    className="flex w-full items-center justify-center gap-2 rounded-xl bg-violet-600 px-4 py-3 text-sm font-bold text-white transition hover:bg-violet-700 disabled:cursor-not-allowed disabled:opacity-60"
                  >

                    {assigning && (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    )}

                    {assigning
                      ? "Assigning..."
                      : "Assign Patient"
                    }

                  </button>

                </form>

              </section>

            </div>


            {/* =================================================
                CURRENT ASSIGNMENTS
            ================================================= */}

            <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">

              <div className="border-b border-slate-100 p-6">

                <div className="flex items-center justify-between gap-4">

                  <div className="flex items-center gap-3">

                    <div className="rounded-xl bg-emerald-50 p-3">
                      <UserRound className="h-5 w-5 text-emerald-600" />
                    </div>

                    <div>

                      <h2 className="text-lg font-bold text-slate-900">
                        Current Patient Assignments
                      </h2>

                      <p className="text-sm text-slate-500">
                        Active nurse-to-patient access mappings.
                      </p>

                    </div>

                  </div>

                  <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-bold text-slate-700">
                    {assignments.length} active
                  </div>

                </div>

              </div>


              {assignments.length === 0 ? (

                <div className="px-6 py-14 text-center">

                  <Users className="mx-auto h-10 w-10 text-slate-300" />

                  <p className="mt-4 text-sm font-semibold text-slate-700">
                    No patient assignments yet
                  </p>

                  <p className="mt-1 text-sm text-slate-500">
                    Assign a patient to a nurse using the form above.
                  </p>

                </div>

              ) : (

                <div className="overflow-x-auto">

                  <table className="min-w-[750px] w-full">

                    <thead className="border-b border-slate-100 bg-slate-50">

                      <tr>

                        <th className="px-6 py-3 text-left text-xs font-bold uppercase tracking-wide text-slate-400">
                          Nurse
                        </th>

                        <th className="px-6 py-3 text-left text-xs font-bold uppercase tracking-wide text-slate-400">
                          Patient
                        </th>

                        <th className="px-6 py-3 text-left text-xs font-bold uppercase tracking-wide text-slate-400">
                          Patient Code
                        </th>

                        <th className="px-6 py-3 text-left text-xs font-bold uppercase tracking-wide text-slate-400">
                          Action
                        </th>

                      </tr>

                    </thead>


                    <tbody className="divide-y divide-slate-100">

                      {assignments.map(
                        (assignment) => (
                          <tr
                            key={
                              assignment.id
                            }
                            className="hover:bg-slate-50"
                          >

                            <td className="px-6 py-4">

                              <p className="font-semibold text-slate-800">
                                {assignment.nurse_name}
                              </p>

                              <p className="mt-1 text-xs text-slate-400">
                                @{assignment.nurse_username}
                              </p>

                            </td>


                            <td className="px-6 py-4">

                              <p className="font-semibold text-slate-800">
                                {assignment.patient_name}
                              </p>

                            </td>


                            <td className="px-6 py-4">

                              <span className="rounded-lg bg-slate-100 px-2.5 py-1.5 text-xs font-bold text-slate-600">
                                {assignment.patient_code}
                              </span>

                            </td>


                            <td className="px-6 py-4">

                              <button
                                type="button"
                                disabled={
                                  removingId ===
                                  assignment.id
                                }
                                onClick={() =>
                                  handleRemoveAssignment(
                                    assignment.id,
                                  )
                                }
                                className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-bold text-red-700 transition hover:bg-red-100 disabled:opacity-60"
                              >

                                {removingId ===
                                assignment.id
                                  ? "Removing..."
                                  : "Remove"
                                }

                              </button>

                            </td>

                          </tr>
                        ),
                      )}

                    </tbody>

                  </table>

                </div>

              )}

            </section>

          </>
        )}

      </div>

    </MainLayout>
  )
}