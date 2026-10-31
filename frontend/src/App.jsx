import {
  Navigate,
  Route,
  Routes,
} from "react-router-dom"

import {
  useAuth,
} from "./context/AuthContext"

// =====================================================
// AUTH
// =====================================================

import Login from "./pages/Login"

// =====================================================
// ADMIN
// =====================================================

import MonitoringDashboard from "./pages/admin/MonitoringDashboard"
import StaffAssignments from "./pages/admin/StaffAssignments"
import PatientQR from "./pages/admin/PatientQR"
import PatientManagement from "./pages/admin/PatientManagement"
import WardBedManagement from "./pages/admin/WardBedManagement"
import DoctorProfiles from "./pages/admin/DoctorProfiles";
import MedicationMonitoring from "./pages/admin/MedicationMonitoring";
// =====================================================
// NURSE
// =====================================================

import NurseDashboard from "./pages/nurse/NurseDashboard"
import Medications from "./pages/nurse/Medications"
import MedicationDetails from "./pages/nurse/MedicationDetails"
import QRScanner from "./pages/nurse/QRScanner"
import NurseAI from "./pages/nurse/NurseAI"
import Administration from "./pages/nurse/Administration"

// =====================================================
// DOCTOR
// =====================================================

import DoctorDashboard from "./pages/doctor/DoctorDashboard"
import Patients from "./pages/doctor/Patients"
import PatientProfile from "./pages/doctor/PatientProfile"
import CreatePrescription from "./pages/doctor/CreatePrescription"
import EditPrescription from "./pages/doctor/EditPrescription"
import Prescriptions from "./pages/doctor/Prescriptions"
import DoctorAI from "./pages/doctor/DoctorAI"

// =====================================================
// HOSPITAL
// =====================================================

import AddPatient from "./pages/hospital/AddPatient"
import HospitalDashboard from "./pages/hospital/HospitalDashboard"
import HospitalPatientProfile from "./pages/hospital/PatientProfile"
import CareMatch from "./pages/hospital/CareMatch"
// =====================================================
// PROTECTED ROUTE
// =====================================================

function ProtectedRoute({
  children,
}) {
  const {
    user,
    loading,
  } = useAuth()

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950 text-white">
        Loading SmartMedChart...
      </div>
    )
  }

  if (!user) {
    return (
      <Navigate
        to="/login"
        replace
      />
    )
  }

  return children
}

// =====================================================
// ROLE ROUTE
// =====================================================

function RoleRoute({
  allowedRoles,
  children,
}) {
  const {
    user,
  } = useAuth()

  const role =
    typeof user?.role === "string"
      ? user.role
          .trim()
          .toLowerCase()
      : ""

  if (!allowedRoles.includes(role)) {
    return (
      <Navigate
        to="/"
        replace
      />
    )
  }

  return children
}

// =====================================================
// HOME REDIRECT
// =====================================================

function HomeRedirect() {
  const {
    user,
  } = useAuth()

  if (!user) {
    return (
      <Navigate
        to="/login"
        replace
      />
    )
  }

  const role =
    typeof user.role === "string"
      ? user.role
          .trim()
          .toLowerCase()
      : ""

  if (role === "nurse") {
    return (
      <Navigate
        to="/nurse/dashboard"
        replace
      />
    )
  }

  if (role === "doctor") {
    return (
      <Navigate
        to="/doctor/dashboard"
        replace
      />
    )
  }

  if (
    role === "admin" ||
    role === "administrator"
  ) {
    return (
      <Navigate
        to="/admin/dashboard"
        replace
      />
    )
  }

  if (
  role === "hospital" ||
  role === "hospital_staff" ||
  role === "receptionist"
) {
    return (
      <Navigate
        to="/hospital/dashboard"
        replace
      />
    )
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-100 p-6">
      <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <h1 className="text-2xl font-bold text-slate-900">
          SmartMedChart
        </h1>

        <p className="mt-3 text-slate-600">
          Logged in, but no dashboard is configured
          for this role.
        </p>

        <pre className="mt-4 rounded-lg bg-slate-100 p-4 text-sm">
          {JSON.stringify(
            user,
            null,
            2,
          )}
        </pre>
      </div>
    </div>
  )
}

// =====================================================
// APP
// =====================================================

export default function App() {
  return (
    <Routes>

      {/* =================================================
          AUTH
      ================================================= */}

      <Route
        path="/login"
        element={
          <Login />
        }
      />

      <Route
        path="/"
        element={
          <HomeRedirect />
        }
      />


      {/* =================================================
          DOCTOR
      ================================================= */}

      <Route
        path="/doctor/dashboard"
        element={
          <ProtectedRoute>
            <RoleRoute
              allowedRoles={[
                "doctor",
              ]}
            >
              <DoctorDashboard />
            </RoleRoute>
          </ProtectedRoute>
        }
      />

      <Route
        path="/doctor/patients"
        element={
          <ProtectedRoute>
            <RoleRoute
              allowedRoles={[
                "doctor",
              ]}
            >
              <Patients />
            </RoleRoute>
          </ProtectedRoute>
        }
      />

      <Route
        path="/doctor/patients/:patientId"
        element={
          <ProtectedRoute>
            <RoleRoute
              allowedRoles={[
                "doctor",
              ]}
            >
              <PatientProfile />
            </RoleRoute>
          </ProtectedRoute>
        }
      />

      <Route
        path="/doctor/prescriptions"
        element={
          <ProtectedRoute>
            <RoleRoute
              allowedRoles={[
                "doctor",
              ]}
            >
              <Prescriptions />
            </RoleRoute>
          </ProtectedRoute>
        }
      />

      <Route
        path="/doctor/prescriptions/create"
        element={
          <ProtectedRoute>
            <RoleRoute
              allowedRoles={[
                "doctor",
              ]}
            >
              <CreatePrescription />
            </RoleRoute>
          </ProtectedRoute>
        }
      />

      <Route
        path="/doctor/prescriptions/:prescriptionId/edit"
        element={
          <ProtectedRoute>
            <RoleRoute
              allowedRoles={[
                "doctor",
              ]}
            >
              <EditPrescription />
            </RoleRoute>
          </ProtectedRoute>
        }
      />

      <Route
        path="/doctor/ai"
        element={
          <ProtectedRoute>
            <RoleRoute
              allowedRoles={[
                "doctor",
              ]}
            >
              <DoctorAI />
            </RoleRoute>
          </ProtectedRoute>
        }
      />


      {/* =================================================
          NURSE
      ================================================= */}

      <Route
        path="/nurse/dashboard"
        element={
          <ProtectedRoute>
            <RoleRoute
              allowedRoles={[
                "nurse",
              ]}
            >
              <NurseDashboard />
            </RoleRoute>
          </ProtectedRoute>
        }
      />

      <Route
        path="/nurse/medications"
        element={
          <ProtectedRoute>
            <RoleRoute
              allowedRoles={[
                "nurse",
              ]}
            >
              <Medications />
            </RoleRoute>
          </ProtectedRoute>
        }
      />

      <Route
        path="/nurse/medications/:scheduleId"
        element={
          <ProtectedRoute>
            <RoleRoute
              allowedRoles={[
                "nurse",
              ]}
            >
              <MedicationDetails />
            </RoleRoute>
          </ProtectedRoute>
        }
      />

      <Route
        path="/nurse/qr"
        element={
          <ProtectedRoute>
            <RoleRoute
              allowedRoles={[
                "nurse",
              ]}
            >
              <QRScanner />
            </RoleRoute>
          </ProtectedRoute>
        }
      />

      <Route
        path="/nurse/ai"
        element={
          <ProtectedRoute>
            <RoleRoute
              allowedRoles={[
                "nurse",
              ]}
            >
              <NurseAI />
            </RoleRoute>
          </ProtectedRoute>
        }
      />

      <Route
        path="/nurse/medications/:scheduleId/administration"
        element={
          <ProtectedRoute>
            <RoleRoute
              allowedRoles={[
                "nurse",
              ]}
            >
              <Administration />
            </RoleRoute>
          </ProtectedRoute>
        }
      />


      {/* =================================================
          ADMIN
      ================================================= */}

      <Route
        path="/admin/dashboard"
        element={
          <ProtectedRoute>
            <RoleRoute
              allowedRoles={[
                "admin",
                "administrator",
              ]}
            >
              <MonitoringDashboard />
            </RoleRoute>
          </ProtectedRoute>
        }
      />

      <Route
        path="/admin/medication-monitoring"
        element={
          <ProtectedRoute>
            <RoleRoute
              allowedRoles={[
                "admin",
                "administrator",
              ]}
            >
              <MedicationMonitoring />
            </RoleRoute>
          </ProtectedRoute>
        }
      />

      <Route
        path="/admin/staff"
        element={
          <ProtectedRoute>
            <RoleRoute
              allowedRoles={[
                "admin",
                "administrator",
              ]}
            >
              <StaffAssignments />
            </RoleRoute>
          </ProtectedRoute>
        }
      />

      <Route
        path="/admin/qr"
        element={
          <ProtectedRoute>
            <RoleRoute
              allowedRoles={[
                "admin",
                "administrator",
              ]}
            >
              <PatientQR />
            </RoleRoute>
          </ProtectedRoute>
        }
      />

      <Route
        path="/admin/patients"
        element={
          <ProtectedRoute>
            <RoleRoute
              allowedRoles={[
                "admin",
                "administrator",
              ]}
            >
              <PatientManagement />
            </RoleRoute>
          </ProtectedRoute>
        }
      />

      <Route
        path="/admin/ward-bed-management"
        element={
          <ProtectedRoute>
            <RoleRoute
              allowedRoles={[
                "admin",
                "administrator",
              ]}
            >
              <WardBedManagement />
            </RoleRoute>
          </ProtectedRoute>
        }
      />
      <Route
  path="/admin/doctor-profiles"
  element={
    <ProtectedRoute>
      <RoleRoute
        allowedRoles={[
          "admin",
          "administrator",
        ]}
      >
        <DoctorProfiles />
      </RoleRoute>
    </ProtectedRoute>
  }
      />


      {/* =================================================
          HOSPITAL PORTAL
      ================================================= */}
      <Route
        path="/receptionist/counter"
        element={
          <ProtectedRoute>
            <RoleRoute allowedRoles={["receptionist"]}>
              <CareMatch />
            </RoleRoute>
          </ProtectedRoute>
        }
      />
      <Route
        path="/hospital/dashboard"
        element={
          <ProtectedRoute>
            <RoleRoute
             allowedRoles={[
              "admin",
              "administrator",
              "hospital",
              "hospital_staff",
              "receptionist",
            ]}
            >
              <HospitalDashboard />
            </RoleRoute>
          </ProtectedRoute>
        }
      />

      <Route
        path="/hospital/patients/new"
        element={
          <ProtectedRoute>
            <RoleRoute
              allowedRoles={[
                "admin",
                "administrator",
                "hospital",
                "hospital_staff",
                "receptionist",
              ]}
            >
              <AddPatient />
            </RoleRoute>
          </ProtectedRoute>
        }
      />

      {/* Specific hospital patient page */}
      <Route
        path="/hospital/patients/:patientId"
        element={
          <ProtectedRoute>
            <RoleRoute
              allowedRoles={[
                "admin",
                "administrator",
                "hospital",
                "hospital_staff",
              ]}
            >
              <HospitalPatientProfile />
            </RoleRoute>
          </ProtectedRoute>
        }
      />


      {/* =================================================
          FALLBACK
      ================================================= */}

      <Route
        path="*"
        element={
          <Navigate
            to="/"
            replace
          />
        }
      />

    </Routes>
  )
}
