import {
  Bell,
  Calendar,
  Clock,
  Menu,
  ShieldCheck,
  User,
} from "lucide-react"
import { useAuth } from "../../context/AuthContext"

export default function Topbar({
  onMenuClick,
  title = "Dashboard",
  subtitle,
}) {
  const { user } = useAuth()

  const displayName =
    user?.full_name ||
    user?.username ||
    "Staff Member"

  const role =
    typeof user?.role === "string"
      ? user.role.trim().toLowerCase()
      : "user"

  const initials = displayName
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase() || "SM"

  const todayFormatted = new Intl.DateTimeFormat("en-IN", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date())

  return (
    <header className="sticky top-0 z-30 flex h-20 items-center justify-between border-b border-slate-200/80 bg-white/95 px-4 backdrop-blur-md sm:px-6 lg:px-8 shadow-[0_1px_2px_0_rgba(15,23,42,0.02)]">
      {/* Left: Mobile Menu & Page Title */}
      <div className="flex min-w-0 items-center gap-3.5">
        <button
          type="button"
          onClick={onMenuClick}
          className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 transition hover:bg-slate-50 hover:text-slate-900 lg:hidden"
          aria-label="Open navigation menu"
        >
          <Menu className="h-5 w-5" />
        </button>

        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h1 className="font-heading truncate text-lg font-bold text-slate-900 sm:text-2xl">
              {title}
            </h1>
          </div>
          {subtitle ? (
            <p className="hidden text-xs text-slate-500 sm:block">{subtitle}</p>
          ) : (
            <p className="hidden text-xs text-slate-400 font-medium sm:block">
              SmartMedChart Clinical Management Portal
            </p>
          )}
        </div>
      </div>

      {/* Right: Date, Notifications, User Capsule */}
      <div className="flex items-center gap-2.5 sm:gap-4">
        {/* Date indicator */}
        <div className="hidden items-center gap-1.5 rounded-xl border border-slate-200/80 bg-slate-50/80 px-3 py-1.5 text-xs font-semibold text-slate-600 md:flex">
          <Calendar className="h-3.5 w-3.5 text-sky-600" />
          <span>{todayFormatted}</span>
        </div>

        {/* Notifications */}
        <button
          type="button"
          className="relative flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200/80 bg-white text-slate-500 transition hover:bg-slate-50 hover:text-slate-800"
          aria-label="System Notifications"
        >
          <Bell className="h-4.5 w-4.5" />
          <span className="absolute top-2 right-2 flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-sky-400 opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-sky-500 ring-2 ring-white" />
          </span>
        </button>

        <div className="h-6 w-px bg-slate-200" />

        {/* User Pill */}
        <div className="flex items-center gap-3 rounded-2xl border border-slate-200/80 bg-white p-1.5 pr-3 shadow-xs">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-tr from-sky-600 to-sky-400 text-xs font-bold text-white shadow-xs">
            {initials}
          </div>

          <div className="hidden text-left sm:block">
            <p className="max-w-[140px] truncate text-xs font-bold text-slate-900 leading-tight">
              {displayName}
            </p>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-sky-600">
              {role}
            </p>
          </div>
        </div>
      </div>
    </header>
  )
}