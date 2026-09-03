import {
  BrainCircuit,
  Building2,
  ClipboardList,
  LayoutDashboard,
  QrCode,
  UserPlus,
  UserRound,
  X,
} from "lucide-react"

import { NavLink } from "react-router-dom"

import { useAuth } from "../../context/AuthContext"


export default function MobileNav({
  open,
  onClose,
}) {
  const { user } = useAuth()

  const role =
    typeof user?.role === "string"
      ? user.role
          .trim()
          .toLowerCase()
      : ""

  let navigation = []


  // =====================================================
  // NURSE
  // =====================================================

  if (role === "nurse") {
    navigation = [
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
    ]
  }


  // =====================================================
  // DOCTOR
  // =====================================================

  if (role === "doctor") {
    navigation = [
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
    ]
  }


  // =====================================================
  // ADMIN
  // =====================================================

if (
  role === "admin" ||
  role === "administrator"
) {
  navigation = [
    {
      label: "Dashboard",
      icon: LayoutDashboard,
      path: "/admin/dashboard",
    },
    {
      label: "Hospital Portal",
      icon: Building2,
      path: "/hospital/dashboard",
    },
  ]
}

  // =====================================================
  // HOSPITAL STAFF
  // =====================================================

  if (
    role === "hospital" ||
    role === "hospital_staff"
  ) {
    navigation = [
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
    ]
  }


  return (
    <>
      {/* =================================================
          BACKDROP
      ================================================= */}

      {open && (
        <button
          type="button"
          aria-label="Close navigation"
          onClick={onClose}
          className="fixed inset-0 z-40 bg-slate-950/60 backdrop-blur-sm lg:hidden"
        />
      )}


      {/* =================================================
          MOBILE DRAWER
      ================================================= */}

      <aside
        className={[
          "fixed inset-y-0 left-0 z-50 flex w-72 flex-col border-r border-slate-800 bg-slate-950 shadow-2xl transition-transform duration-300 lg:hidden",
          open
            ? "translate-x-0"
            : "-translate-x-full",
        ].join(" ")}
      >

        {/* =================================================
            HEADER
        ================================================= */}

        <div className="flex h-20 items-center justify-between border-b border-slate-800 px-5">

          <div className="flex items-center gap-3">

            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-cyan-500/10">

              <LayoutDashboard className="h-5 w-5 text-cyan-400" />

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


          <button
            type="button"
            onClick={onClose}
            aria-label="Close menu"
            className="rounded-xl p-2 text-slate-400 transition hover:bg-slate-800 hover:text-white"
          >

            <X className="h-5 w-5" />

          </button>

        </div>


        {/* =================================================
            USER INFO
        ================================================= */}

        <div className="border-b border-slate-800 p-4">

          <div className="rounded-2xl bg-slate-900 p-4">

            <p className="truncate text-sm font-semibold text-white">
              {user?.full_name || user?.username}
            </p>

            <p className="mt-1 text-xs capitalize text-slate-500">
              {role}
            </p>

          </div>

        </div>


        {/* =================================================
            NAVIGATION
        ================================================= */}

        <div className="flex-1 overflow-y-auto px-4 py-6">

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
                  onClick={onClose}
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

                  <span>
                    {item.label}
                  </span>

                </NavLink>
              )

            })}

          </nav>

        </div>


        {/* =================================================
            FOOTER
        ================================================= */}

        <div className="border-t border-slate-800 p-4">

          <div className="rounded-xl border border-cyan-500/10 bg-cyan-500/5 p-3">

            <p className="text-xs font-semibold text-cyan-400">
              SmartMedChart
            </p>

            <p className="mt-1 text-xs leading-5 text-slate-500">
              Secure clinical medication management
              and hospital data coordination.
            </p>

          </div>

        </div>

      </aside>
    </>
  )
}