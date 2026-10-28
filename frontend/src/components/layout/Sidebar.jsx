import {
  Activity,
  BrainCircuit,
  Building2,
  ClipboardList,
  LayoutDashboard,
  LogOut,
  QrCode,
  UserPlus,
  UserRound,
  Users,
  UsersRound,
  Stethoscope,
} from "lucide-react"

import { NavLink } from "react-router-dom"

import { useAuth } from "../../context/AuthContext"


export default function Sidebar() {
  const { user, logout } = useAuth()

  const role =
    typeof user?.role === "string"
      ? user.role
          .trim()
          .toLowerCase()
      : ""

  const navigation = []


  // =====================================================
  // NURSE
  // =====================================================

  if (role === "nurse") {
    navigation.push(
      {
        label: "Dashboard",
        icon: LayoutDashboard,
        path: "/nurse/dashboard",
      },
      {
        label: "Medications",
        icon: ClipboardList,
        path: "/nurse/medications",
      },
      {
        label: "QR Scanner",
        icon: QrCode,
        path: "/nurse/qr",
      },
      {
        label: "AI Risk",
        icon: BrainCircuit,
        path: "/nurse/ai",
      },
    )
  }


  // =====================================================
  // DOCTOR
  // =====================================================

  if (role === "doctor") {
    navigation.push(
      {
        label: "Dashboard",
        icon: LayoutDashboard,
        path: "/doctor/dashboard",
      },
      {
        label: "Patients",
        icon: UserRound,
        path: "/doctor/patients",
      },
      {
        label: "Prescriptions",
        icon: ClipboardList,
        path: "/doctor/prescriptions",
      },
      {
        label: "AI Risk",
        icon: BrainCircuit,
        path: "/doctor/ai",
      },
    )
  }


  // =====================================================
  // ADMIN
  // =====================================================

  if (
    role === "admin" ||
    role === "administrator"
  ) {
    navigation.push(
      {
        label: "Dashboard",
        icon: LayoutDashboard,
        path: "/admin/dashboard",
      },
      {
        label: "Staff & Assignments",
        icon: Users,
        path: "/admin/staff",
      },
      {
        label: "CareMatch",
        icon: Stethoscope,
        path: "/admin/doctor-profiles",
      },
      {
        label: "Patient Management",
        icon: UsersRound,
        path: "/admin/patients",
      },
      {
        label: "Ward & Beds",
        icon: Building2,
        path: "/admin/ward-bed-management",
      },
      {
        label: "Patient QR",
        icon: QrCode,
        path: "/admin/qr",
      },
      {
        label: "Hospital Portal",
        icon: Building2,
        path: "/hospital/dashboard",
      },
    )
  }


  // =====================================================
  // HOSPITAL STAFF
  // =====================================================

  if (
    role === "hospital" ||
    role === "hospital_staff"
  ) {
    navigation.push(
      {
        label: "Hospital Dashboard",
        icon: LayoutDashboard,
        path: "/hospital/dashboard",
      },
      {
        label: "Register Patient",
        icon: UserPlus,
        path: "/hospital/patients/new",
      },
    )
  }


  return (
    <aside className="hidden w-64 shrink-0 flex-col border-r border-slate-800 bg-slate-950 lg:flex">

      {/* =================================================
          Logo
      ================================================= */}

      <div className="flex h-20 items-center gap-3 border-b border-slate-800 px-6">

        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-cyan-500/10">
          <Activity className="h-6 w-6 text-cyan-400" />
        </div>

        <div>

          <h1 className="font-bold text-white">
            SmartMedChart
          </h1>

          <p className="text-xs text-slate-500">
            Clinical Intelligence
          </p>

        </div>

      </div>


      {/* =================================================
          Navigation
      ================================================= */}

      <div className="flex-1 px-4 py-6">

        <p className="mb-3 px-3 text-xs font-semibold uppercase tracking-wider text-slate-500">
          Navigation
        </p>

        <nav className="space-y-1">

          {navigation.map((item) => {

            const Icon = item.icon

            return (
              <NavLink
                key={item.path}
                to={item.path}
                className={({ isActive }) =>
                  [
                    "flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium transition",
                    isActive
                      ? "bg-cyan-500/10 text-cyan-400"
                      : "text-slate-300 hover:bg-slate-800 hover:text-white",
                  ].join(" ")
                }
              >

                <Icon className="h-5 w-5" />

                {item.label}

              </NavLink>
            )

          })}

        </nav>

      </div>


      {/* =================================================
          User
      ================================================= */}

      <div className="border-t border-slate-800 p-4">

        <div className="mb-3 rounded-xl bg-slate-900 p-3">

          <p className="truncate text-sm font-medium text-white">
            {user?.full_name || user?.username}
          </p>

          <p className="mt-1 text-xs capitalize text-slate-500">
            {role}
          </p>

        </div>

        <button
          onClick={logout}
          className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium text-slate-400 transition hover:bg-red-500/10 hover:text-red-300"
        >

          <LogOut className="h-5 w-5" />

          Logout

        </button>

      </div>

    </aside>
  )
}