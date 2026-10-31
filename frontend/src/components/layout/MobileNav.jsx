import {
  Activity,
  BrainCircuit,
  Building2,
  CalendarCheck,
  ClipboardList,
  HeartPulse,
  LayoutDashboard,
  LogOut,
  QrCode,
  Stethoscope,
  UserPlus,
  UserRound,
  Users,
  UsersRound,
  X,
} from "lucide-react"
import { NavLink } from "react-router-dom"
import { useAuth } from "../../context/AuthContext"

export default function MobileNav({ open, onClose }) {
  const { user, logout } = useAuth()

  const role =
    typeof user?.role === "string"
      ? user.role.trim().toLowerCase()
      : ""

  let navigation = []

  // NURSE
  if (role === "nurse") {
    navigation = [
      {
        label: "Nurse Dashboard",
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
        label: "AI Risk Monitor",
        icon: BrainCircuit,
        path: "/nurse/ai",
      },
    ]
  }

  // DOCTOR
  if (role === "doctor") {
    navigation = [
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
        label: "Prescriptions",
        icon: ClipboardList,
        path: "/doctor/prescriptions",
      },
      {
        label: "AI Clinical Insights",
        icon: BrainCircuit,
        path: "/doctor/ai",
      },
    ]
  }

  // ADMIN
  if (role === "admin" || role === "administrator") {
    navigation = [
      {
        label: "Executive Dashboard",
        icon: LayoutDashboard,
        path: "/admin/dashboard",
      },
      {
        label: "Staff & Workload",
        icon: Users,
        path: "/admin/staff",
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
        label: "Ward & Bed Ops",
        icon: Building2,
        path: "/admin/ward-bed-management",
      },
      {
        label: "Patient QR Generator",
        icon: QrCode,
        path: "/admin/qr",
      },
      {
        label: "Hospital Portal",
        icon: HeartPulse,
        path: "/hospital/dashboard",
      },
    ]
  }

  // HOSPITAL STAFF / RECEPTIONIST
  if (
    role === "hospital" ||
    role === "hospital_staff" ||
    role === "receptionist"
  ) {
    navigation = [
      {
        label: "Hospital Dashboard",
        icon: LayoutDashboard,
        path: "/hospital/dashboard",
      },
      {
        label: "Admit / Register",
        icon: UserPlus,
        path: "/hospital/patients/new",
      },
      {
        label: "CareMatch Counter",
        icon: CalendarCheck,
        path: "/receptionist/counter",
      },
    ]
  }

  const displayName = user?.full_name || user?.username || "Staff Member"
  const initials = displayName
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase() || "SM"

  return (
    <>
      {/* Backdrop */}
      {open && (
        <button
          type="button"
          aria-label="Close navigation overlay"
          onClick={onClose}
          className="fixed inset-0 z-40 bg-slate-900/50 backdrop-blur-sm lg:hidden transition-opacity"
        />
      )}

      {/* Drawer */}
      <aside
        className={[
          "fixed inset-y-0 left-0 z-50 flex w-72 flex-col border-r border-slate-200 bg-white shadow-2xl transition-transform duration-300 lg:hidden",
          open ? "translate-x-0" : "-translate-x-full",
        ].join(" ")}
      >
        {/* Header */}
        <div className="flex h-20 items-center justify-between border-b border-slate-100 px-5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-tr from-sky-600 to-sky-400 text-white shadow-sm">
              <Activity className="h-5 w-5" />
            </div>
            <div>
              <h1 className="font-heading font-extrabold text-slate-900 text-sm tracking-tight">
                SmartMed<span className="text-sky-600">Chart</span>
              </h1>
              <p className="text-[10px] font-medium text-slate-400">
                Hospital System
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close menu"
            className="rounded-xl p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-800 transition"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* User Card */}
        <div className="border-b border-slate-100 p-4 bg-slate-50/50">
          <div className="flex items-center gap-3 rounded-2xl border border-slate-200/80 bg-white p-3 shadow-xs">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-tr from-sky-600 to-sky-400 text-xs font-bold text-white shadow-xs">
              {initials}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-bold text-slate-800">
                {displayName}
              </p>
              <p className="text-[11px] font-medium capitalize text-slate-400">
                {role}
              </p>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <div className="flex-1 overflow-y-auto px-3.5 py-4">
          <p className="mb-2 px-3 text-[10px] font-bold uppercase tracking-wider text-slate-400">
            Navigation Menu
          </p>

          <nav className="space-y-1">
            {navigation.map((item) => {
              const Icon = item.icon
              return (
                <NavLink
                  key={item.path}
                  to={item.path}
                  onClick={onClose}
                  className={({ isActive }) =>
                    [
                      "flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-semibold transition",
                      isActive
                        ? "bg-sky-50 text-sky-700 font-bold"
                        : "text-slate-600 hover:bg-slate-50 hover:text-slate-900",
                    ].join(" ")
                  }
                >
                  <Icon className="h-4.5 w-4.5 text-sky-600" />
                  <span className="truncate">{item.label}</span>
                </NavLink>
              )
            })}
          </nav>
        </div>

        {/* Logout */}
        <div className="border-t border-slate-100 p-4">
          <button
            type="button"
            onClick={() => {
              onClose()
              logout()
            }}
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-semibold text-slate-700 shadow-xs hover:bg-rose-50 hover:border-rose-200 hover:text-rose-700 transition"
          >
            <LogOut className="h-4 w-4" />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>
    </>
  )
}