import {
  CheckCircle2,
  ClipboardList,
  Loader2,
  Stethoscope,
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
  assignPatientToDoctor,
  assignPatientToNurse,
  createStaff,
  getAdminAssignments,
  getAdminDoctors,
  getAdminNurses,
  getAdminPatients,
  getDoctorAssignments,
  removePatientAssignment,
  removePatientFromDoctor,
} from "../../services/admin"


// =========================================================
// MESSAGE
// =========================================================

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


// =========================================================
// LOADING
// =========================================================

function LoadingRow() {
  return (
    <div className="flex items-center justify-center py-12 text-sm text-slate-500">
      <Loader2 className="mr-2 h-5 w-5 animate-spin" />
      Loading...
    </div>
  )
}


// =========================================================
// MAIN
// =========================================================

export default function StaffAssignments() {

  // =======================================================
  // STAFF / PATIENT DATA
  // =======================================================

  const [
    nurses,
    setNurses,
  ] = useState([])

  const [
    doctors,
    setDoctors,
  ] = useState([])

  const [
    patients,
    setPatients,
  ] = useState([])

  // =======================================================
  // ASSIGNMENT DATA
  // =======================================================

  const [
    assignments,
    setAssignments,
  ] = useState([])

  const [
    doctorAssignments,
    setDoctorAssignments,
  ] = useState([])

  // =======================================================
  // GENERAL LOADING
  // =======================================================

  const [
    loading,
    setLoading,
  ] = useState(true)

  // =======================================================
  // CREATE STAFF
  // =======================================================

  const [
    savingStaff,
    setSavingStaff,
  ] = useState(false)

  // =======================================================
  // NURSE ASSIGNMENT
  // =======================================================

  const [
    assigning,
    setAssigning,
  ] = useState(false)

  const [
    removingId,
    setRemovingId,
  ] = useState(null)

  // =======================================================
  // DOCTOR ASSIGNMENT
  // =======================================================

  const [
    doctorAssigning,
    setDoctorAssigning,
  ] = useState(false)

  const [
    doctorRemovingId,
    setDoctorRemovingId,
  ] = useState(null)

  // =======================================================
  // STAFF FORM
  // =======================================================

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

  // =======================================================
  // NURSE ASSIGNMENT FORM
  // =======================================================

  const [
    assignmentForm,
    setAssignmentForm,
  ] = useState({
    nurse_id: "",
    patient_id: "",
  })

  // =======================================================
  // DOCTOR ASSIGNMENT FORM
  // =======================================================

  const [
    doctorAssignmentForm,
    setDoctorAssignmentForm,
  ] = useState({
    doctor_id: "",
    patient_id: "",
  })

  // =======================================================
  // MESSAGES
  // =======================================================

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

  const [
    doctorAssignmentSuccess,
    setDoctorAssignmentSuccess,
  ] = useState("")

  const [
    doctorAssignmentError,
    setDoctorAssignmentError,
  ] = useState("")


  // =========================================================
  // LOAD EVERYTHING
  // =========================================================

  async function loadData() {
    setLoading(true)

    try {

      const [
        nursesResult,
        doctorsResult,
        patientsResult,
        assignmentsResult,
        doctorAssignmentsResult,
      ] = await Promise.all([
        getAdminNurses(),
        getAdminDoctors(),
        getAdminPatients(),
        getAdminAssignments(),
        getDoctorAssignments(),
      ])

      // -----------------------------------------------------
      // Nurses
      // -----------------------------------------------------

      const loadedNurses =
        Array.isArray(
          nursesResult?.nurses,
        )
          ? nursesResult.nurses
          : []

      // -----------------------------------------------------
      // Doctors
      // -----------------------------------------------------

      const loadedDoctors =
        Array.isArray(
          doctorsResult?.doctors,
        )
          ? doctorsResult.doctors
          : []

      // -----------------------------------------------------
      // Patients
      // -----------------------------------------------------

      const loadedPatients =
        Array.isArray(
          patientsResult?.patients,
        )
          ? patientsResult.patients
          : []

      // -----------------------------------------------------
      // Nurse assignments
      // -----------------------------------------------------

      const loadedAssignments =
        Array.isArray(
          assignmentsResult?.assignments,
        )
          ? assignmentsResult.assignments
          : []

      // -----------------------------------------------------
      // Doctor assignments
      // -----------------------------------------------------

      const loadedDoctorAssignments =
        Array.isArray(
          doctorAssignmentsResult?.assignments,
        )
          ? doctorAssignmentsResult.assignments
          : []

      setNurses(
        loadedNurses,
      )

      setDoctors(
        loadedDoctors,
      )

      setPatients(
        loadedPatients,
      )

      setAssignments(
        loadedAssignments,
      )

      setDoctorAssignments(
        loadedDoctorAssignments,
      )

      // -----------------------------------------------------
      // Set default nurse assignment values
      // -----------------------------------------------------

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

      // -----------------------------------------------------
      // Set default doctor assignment values
      // -----------------------------------------------------

      setDoctorAssignmentForm(
        (current) => ({
          ...current,

          doctor_id:
            current.doctor_id ||
            loadedDoctors[0]?.id?.toString() ||
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
          "Unable to load staff, doctors and patient data.",
      )

      setDoctorAssignmentError(
        error?.response?.data?.detail ||
          "Unable to load staff, doctors and patient data.",
      )

    } finally {

      setLoading(false)

    }
  }


  // =========================================================
  // INITIAL LOAD
  // =========================================================

  useEffect(() => {
    loadData()
  }, [])


  // =========================================================
  // STAFF FIELD
  // =========================================================

  function updateStaffField(event) {

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


  // =========================================================
  // NURSE ASSIGNMENT FIELD
  // =========================================================

  function updateAssignmentField(event) {

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


  // =========================================================
  // DOCTOR ASSIGNMENT FIELD
  // =========================================================

  function updateDoctorAssignmentField(event) {

    const {
      name,
      value,
    } = event.target

    setDoctorAssignmentForm(
      (current) => ({
        ...current,
        [name]: value,
      }),
    )
  }


  // =========================================================
  // CREATE STAFF
  // =========================================================

  async function handleCreateStaff(event) {

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


  // =========================================================
  // ASSIGN PATIENT TO NURSE
  // =========================================================

  async function handleAssignment(event) {

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
          "Patient assigned to nurse successfully.",
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
        "Nurse assignment error:",
        error,
      )

      setAssignmentError(
        error?.response?.data?.detail ||
          "Unable to assign patient to nurse.",
      )

    } finally {

      setAssigning(false)

    }
  }


  // =========================================================
  // REMOVE NURSE ASSIGNMENT
  // =========================================================

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
          "Nurse assignment removed successfully.",
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
        "Remove nurse assignment error:",
        error,
      )

      setAssignmentError(
        error?.response?.data?.detail ||
          "Unable to remove nurse assignment.",
      )

    } finally {

      setRemovingId(null)

    }
  }


  // =========================================================
  // ASSIGN PATIENT TO DOCTOR
  // =========================================================

  async function handleAssignDoctor(event) {

    event.preventDefault()

    setDoctorAssignmentSuccess("")
    setDoctorAssignmentError("")

    if (
      !doctorAssignmentForm.doctor_id ||
      !doctorAssignmentForm.patient_id
    ) {

      setDoctorAssignmentError(
        "Please select both a doctor and a patient.",
      )

      return
    }

    setDoctorAssigning(true)

    try {

      const result =
        await assignPatientToDoctor(
          doctorAssignmentForm.doctor_id,
          doctorAssignmentForm.patient_id,
        )

      setDoctorAssignmentSuccess(
        result?.message ||
          "Patient assigned to doctor successfully.",
      )

      // ---------------------------------------------------
      // Refresh doctor assignments
      // ---------------------------------------------------

      const refreshed =
        await getDoctorAssignments()

      setDoctorAssignments(
        Array.isArray(
          refreshed?.assignments,
        )
          ? refreshed.assignments
          : [],
      )

    } catch (error) {

      console.error(
        "Doctor assignment error:",
        error,
      )

      setDoctorAssignmentError(
        error?.response?.data?.detail ||
          "Unable to assign patient to doctor.",
      )

    } finally {

      setDoctorAssigning(false)

    }
  }


  // =========================================================
  // REMOVE DOCTOR ASSIGNMENT
  // =========================================================

  async function handleRemoveDoctorAssignment(
    encounterId,
  ) {

    setDoctorRemovingId(
      encounterId,
    )

    setDoctorAssignmentSuccess("")
    setDoctorAssignmentError("")

    try {

      const result =
        await removePatientFromDoctor(
          encounterId,
        )

      setDoctorAssignmentSuccess(
        result?.message ||
          "Doctor assignment removed successfully.",
      )

      const refreshed =
        await getDoctorAssignments()

      setDoctorAssignments(
        Array.isArray(
          refreshed?.assignments,
        )
          ? refreshed.assignments
          : [],
      )

    } catch (error) {

      console.error(
        "Remove doctor assignment error:",
        error,
      )

      setDoctorAssignmentError(
        error?.response?.data?.detail ||
          "Unable to remove doctor assignment.",
      )

    } finally {

      setDoctorRemovingId(
        null,
      )

    }
  }


  // =========================================================
  // RETURN
  // =========================================================

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
                  Create clinical staff accounts and control
                  which patients each nurse or doctor can access.
                </p>

              </div>

              <div className="flex items-center gap-2 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-4 py-2 text-xs font-bold uppercase tracking-wide text-emerald-400">

                <span className="h-2 w-2 rounded-full bg-emerald-400" />

                Access Control Active

              </div>

            </div>

          </div>

        </section>


        {/* =================================================
            LOADING
        ================================================= */}

        {loading ? (

          <LoadingRow />

        ) : (

          <>

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
                      Add Staff Account
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


                <div className="grid gap-4 md:grid-cols-3">

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

                      <option value="receptionist">
                        Receptionist
                      </option>

                      <option value="doctor">
                        Doctor
                      </option>
                      

                    </select>

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
                ASSIGNMENT FORMS
            ================================================= */}

            <div className="grid gap-6 xl:grid-cols-2">

              {/* =================================================
                  NURSE ASSIGNMENT
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
                      Access Rule
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
                      : "Assign Patient to Nurse"
                    }

                  </button>

                </form>

              </section>


              {/* =================================================
                  DOCTOR ASSIGNMENT
              ================================================= */}

              <section className="rounded-3xl border border-slate-200 bg-white shadow-sm">

                <div className="border-b border-slate-100 p-6">

                  <div className="flex items-center gap-3">

                    <div className="rounded-xl bg-cyan-50 p-3">

                      <Stethoscope className="h-5 w-5 text-cyan-600" />

                    </div>

                    <div>

                      <h2 className="text-lg font-bold text-slate-900">
                        Assign Patient to Doctor
                      </h2>

                      <p className="text-sm text-slate-500">
                        Control which patients the doctor can access.
                      </p>

                    </div>

                  </div>

                </div>


                <form
                  onSubmit={
                    handleAssignDoctor
                  }
                  className="space-y-5 p-6"
                >

                  <Message
                    type="success"
                  >
                    {doctorAssignmentSuccess}
                  </Message>

                  <Message
                    type="error"
                  >
                    {doctorAssignmentError}
                  </Message>


                  <div>

                    <label className="mb-2 block text-sm font-semibold text-slate-700">
                      Doctor
                    </label>

                    <select
                      name="doctor_id"
                      value={
                        doctorAssignmentForm.doctor_id
                      }
                      onChange={
                        updateDoctorAssignmentField
                      }
                      className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-cyan-400 focus:ring-4 focus:ring-cyan-400/10"
                    >

                      <option value="">
                        Select doctor
                      </option>

                      {doctors.map(
                        (doctor) => (
                          <option
                            key={
                              doctor.id
                            }
                            value={
                              doctor.id
                            }
                          >
                            {doctor.full_name}
                            {" · "}
                            @{doctor.username}
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
                        doctorAssignmentForm.patient_id
                      }
                      onChange={
                        updateDoctorAssignmentField
                      }
                      className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-cyan-400 focus:ring-4 focus:ring-cyan-400/10"
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


                  <div className="rounded-2xl border border-cyan-100 bg-cyan-50 p-4">

                    <p className="text-xs font-bold uppercase tracking-wide text-cyan-700">
                      Access Rule
                    </p>

                    <p className="mt-1 text-sm leading-6 text-cyan-900">
                      The selected doctor will be able to access
                      clinical information for this patient.
                    </p>

                  </div>


                  <button
                    type="submit"
                    disabled={
                      doctorAssigning ||
                      !doctors.length ||
                      !patients.length
                    }
                    className="flex w-full items-center justify-center gap-2 rounded-xl bg-cyan-600 px-4 py-3 text-sm font-bold text-white transition hover:bg-cyan-700 disabled:cursor-not-allowed disabled:opacity-60"
                  >

                    {doctorAssigning && (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    )}

                    {doctorAssigning
                      ? "Assigning..."
                      : "Assign Patient to Doctor"
                    }

                  </button>

                </form>

              </section>

            </div>


            {/* =================================================
                CURRENT NURSE ASSIGNMENTS
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
                        Current Nurse Assignments
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
                    No nurse assignments yet
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


            {/* =================================================
                CURRENT DOCTOR ASSIGNMENTS
            ================================================= */}

            <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">

              <div className="border-b border-slate-100 p-6">

                <div className="flex items-center justify-between gap-4">

                  <div className="flex items-center gap-3">

                    <div className="rounded-xl bg-cyan-50 p-3">

                      <Stethoscope className="h-5 w-5 text-cyan-600" />

                    </div>

                    <div>

                      <h2 className="text-lg font-bold text-slate-900">
                        Current Doctor Assignments
                      </h2>

                      <p className="text-sm text-slate-500">
                        Active doctor-to-patient clinical assignments.
                      </p>

                    </div>

                  </div>

                  <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-bold text-slate-700">
                    {doctorAssignments.length} active
                  </div>

                </div>

              </div>


              {doctorAssignments.length === 0 ? (

                <div className="px-6 py-14 text-center">

                  <Stethoscope className="mx-auto h-10 w-10 text-slate-300" />

                  <p className="mt-4 text-sm font-semibold text-slate-700">
                    No doctor assignments yet
                  </p>

                  <p className="mt-1 text-sm text-slate-500">
                    Assign a patient to a doctor using the form above.
                  </p>

                </div>

              ) : (

                <div className="overflow-x-auto">

                  <table className="min-w-[850px] w-full">

                    <thead className="border-b border-slate-100 bg-slate-50">

                      <tr>

                        <th className="px-6 py-3 text-left text-xs font-bold uppercase tracking-wide text-slate-400">
                          Doctor
                        </th>

                        <th className="px-6 py-3 text-left text-xs font-bold uppercase tracking-wide text-slate-400">
                          Patient
                        </th>

                        <th className="px-6 py-3 text-left text-xs font-bold uppercase tracking-wide text-slate-400">
                          Patient Code
                        </th>

                        <th className="px-6 py-3 text-left text-xs font-bold uppercase tracking-wide text-slate-400">
                          Encounter
                        </th>

                        <th className="px-6 py-3 text-left text-xs font-bold uppercase tracking-wide text-slate-400">
                          Action
                        </th>

                      </tr>

                    </thead>


                    <tbody className="divide-y divide-slate-100">

                      {doctorAssignments.map(
                        (assignment) => (

                          <tr
                            key={
                              assignment.id
                            }
                            className="hover:bg-slate-50"
                          >

                            <td className="px-6 py-4">

                              <p className="font-semibold text-slate-800">
                                {assignment.doctor_name}
                              </p>

                              <p className="mt-1 text-xs text-slate-400">
                                @{assignment.doctor_username}
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

                              <span className="rounded-lg bg-cyan-50 px-2.5 py-1.5 text-xs font-bold text-cyan-700">
                                {assignment.encounter_type ||
                                  "ACTIVE"}
                              </span>

                            </td>


                            <td className="px-6 py-4">

                              <button
                                type="button"
                                disabled={
                                  doctorRemovingId ===
                                  assignment.id
                                }
                                onClick={() =>
                                  handleRemoveDoctorAssignment(
                                    assignment.id,
                                  )
                                }
                                className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-bold text-red-700 transition hover:bg-red-100 disabled:opacity-60"
                              >

                                {doctorRemovingId ===
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