import {
  Activity,
  Pill,
  BrainCircuit,
  Building2,
  CalendarCheck,
  ClipboardList,
  History,
  LayoutDashboard,
  LogOut,
  QrCode,
  ShieldCheck,
  Stethoscope,
  UserPlus,
  UserRound,
  Users,
  UsersRound,
} from "lucide-react"
import { NavLink } from "react-router-dom"
import { useAuth } from "../../context/AuthContext"

export default function Sidebar() {
  const { user, logout } = useAuth()

  const role =
    typeof user?.role === "string"
      ? user.role.trim().toLowerCase()
      : ""

  const navigation = []

  // =====================================================
  // NURSE
  // =====================================================
  if (role === "nurse") {
    navigation.push(
      {
        label: "Nurse Dashboard",
        icon: LayoutDashboard,
        path: "/nurse/dashboard",
        badge: "Live",
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
        label: "AI Risk Monitor",
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
        label: "Clinical Dashboard",
        icon: LayoutDashboard,
        path: "/doctor/dashboard",
      },
      {
        label: "Patients Directory",
        icon: UserRound,
        path: "/doctor/patients",
      },
      {
        label: "ON ROUND",
        icon: Stethoscope,
        path: "/doctor/on-round",
        badge: "Live",
      },
      {
        label: "Prescriptions",
        icon: ClipboardList,
        path: "/doctor/prescriptions",
      },
      {
        label: "AI Clinical Insights",
        icon: BrainCircuit,
        path: "/doctor/ai",
      },
    )
  }

  // =====================================================
  // PHARMACIST
  // =====================================================
  if (role === "pharmacist") {
    navigation.push({
      label: "Pharmacy Management",
      icon: Pill,
      path: "/admin/pharmacy",
    })
  }

  // =====================================================
  // ADMIN
  // =====================================================
  if (role === "admin" || role === "administrator") {
    navigation.push(
      {
        label: "Executive Dashboard",
        icon: LayoutDashboard,
        path: "/admin/dashboard",
      },
      {
        label: "Medication Monitoring",
        icon: Activity,
        path: "/admin/medication-monitoring",
        badge: "Live",
      },
      {
        label: "Pharmacy Management",
        icon: Pill,
        path: "/admin/pharmacy",
      },

      {
        label: "Staff & Workload",
        icon: Users,
        path: "/admin/staff",
      },
      {
        label: "Patient Intake & CareMatch",
        icon: UserPlus,
        path: "/hospital/patients/new",
      },
      {
        label: "CareMatch Doctors",
        icon: Stethoscope,
        path: "/admin/doctor-profiles",
      },
      {
        label: "Patient Management",
        icon: UsersRound,
        path: "/admin/patients",
      },
      {
        label: "Discharged Patients",
        icon: History,
        path: "/admin/patients/discharged",
      },
      {
        label: "Ward & Bed Ops",
        icon: Building2,
        path: "/admin/ward-bed-management",
      },
      {
        label: "Patient QR Generator",
        icon: QrCode,
        path: "/admin/qr",
      },
    )
  }

  // =====================================================
  // HOSPITAL STAFF / RECEPTIONIST
  // =====================================================
  if (
    role === "hospital" ||
    role === "hospital_staff" ||
    role === "receptionist"
  ) {
    navigation.push(
      {
        label: "Hospital Dashboard",
        icon: LayoutDashboard,
        path: "/hospital/dashboard",
      },
      {
        label: "Patient Intake & CareMatch",
        icon: UserPlus,
        path: "/hospital/patients/new",
      },
    )
  }

  const displayName = user?.full_name || user?.username || "Staff Member"
  const initials = displayName
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase() || "SM"

  return (
    <aside className="hidden w-64 shrink-0 flex-col border-r border-slate-200/90 bg-white lg:flex shadow-[1px_0_4px_0_rgba(15,23,42,0.02)]">
      {/* Brand Header */}
      <div className="flex h-20 items-center gap-3 border-b border-slate-100 px-6">
        <div className="relative flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-tr from-sky-600 to-sky-400 text-white shadow-md shadow-sky-500/20">
          <Activity className="h-6 w-6 stroke-[2.25]" />
          <span className="absolute -top-0.5 -right-0.5 flex h-3 w-3">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex h-3 w-3 rounded-full bg-emerald-500 border-2 border-white" />
          </span>
        </div>

        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <h1 className="font-heading font-extrabold text-slate-900 text-base tracking-tight">
              SmartMed<span className="text-sky-600">Chart</span>
            </h1>
          </div>
          <p className="text-[11px] font-medium text-slate-400 tracking-wide">
            Clinical SaaS v2.0
          </p>
        </div>
      </div>

      {/* Navigation Section */}
      <div className="flex-1 overflow-y-auto px-3.5 py-6">
        <div className="px-3 mb-2 flex items-center justify-between">
          <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
            Navigation Menu
          </p>
          <span className="text-[10px] font-semibold text-slate-400 capitalize px-2 py-0.5 rounded-md bg-slate-50 border border-slate-200/60">
            {role}
          </span>
        </div>

        <nav className="space-y-1">
          {navigation.map((item) => {
            const Icon = item.icon
            return (
              <NavLink
                key={item.path}
                to={item.path}
                className={({ isActive }) =>
                  [
                    "group relative flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-semibold transition-all duration-150",
                    isActive
                      ? "bg-sky-50 text-sky-700 shadow-sm shadow-sky-100 font-bold"
                      : "text-slate-600 hover:bg-slate-50 hover:text-slate-900",
                  ].join(" ")
                }
              >
                {({ isActive }) => (
                  <>
                    <Icon
                      className={`h-4.5 w-4.5 transition-colors ${
                        isActive
                          ? "text-sky-600 stroke-[2.25]"
                          : "text-slate-400 group-hover:text-slate-600"
                      }`}
                    />
                    <span className="flex-1 truncate">{item.label}</span>
                    {item.badge && (
                      <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800">
                        {item.badge}
                      </span>
                    )}
                    {isActive && (
                      <span className="absolute right-0 top-1/2 -translate-y-1/2 h-6 w-1 rounded-l-full bg-sky-600" />
                    )}
                  </>
                )}
              </NavLink>
            )
          })}
        </nav>
      </div>

      {/* User Footer */}
      <div className="border-t border-slate-100 p-4 bg-slate-50/50">
        <div className="mb-3 flex items-center gap-3 rounded-2xl border border-slate-200/70 bg-white p-3 shadow-xs">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-tr from-sky-600 to-sky-400 text-xs font-bold text-white shadow-xs">
            {initials}
          </div>

          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-bold text-slate-800">
              {displayName}
            </p>
            <p className="text-[11px] font-medium capitalize text-slate-400 flex items-center gap-1">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 inline-block" />
              {role}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={logout}
          className="flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 shadow-xs transition hover:bg-rose-50 hover:border-rose-200 hover:text-rose-700 active:bg-rose-100"
        >
          <LogOut className="h-4 w-4" />
          <span>Sign Out</span>
        </button>
      </div>
    </aside>
  )
}