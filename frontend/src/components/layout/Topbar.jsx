import {
  Bell,
  Menu,
} from "lucide-react"

import {
  useAuth,
} from "../../context/AuthContext"


export default function Topbar({
  onMenuClick,
  title = "Dashboard",
}) {
  const {
    user,
  } = useAuth()


  const displayName =
    user?.full_name ||
    user?.username ||
    "User"


  const role =
    typeof user?.role === "string"
      ? user.role
          .trim()
          .toLowerCase()
      : "user"


  return (
    <header className="sticky top-0 z-30 flex h-20 items-center justify-between border-b border-slate-200 bg-white/95 px-4 backdrop-blur sm:px-6 lg:px-8">

      {/* Left */}

      <div className="flex min-w-0 items-center gap-3">

        <button
          type="button"
          onClick={
            onMenuClick
          }
          className="rounded-xl p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-800 lg:hidden"
          aria-label="Open navigation"
        >

          <Menu className="h-6 w-6" />

        </button>


        <div className="min-w-0">

          <p className="hidden text-xs font-semibold uppercase tracking-wider text-cyan-600 sm:block">
            SmartMedChart
          </p>

          <h2 className="truncate text-xl font-bold text-slate-900 sm:text-2xl">
            {title}
          </h2>

        </div>

      </div>


      {/* Right */}

      <div className="flex items-center gap-3">

        <button
          type="button"
          className="relative rounded-xl p-2.5 text-slate-500 transition hover:bg-slate-100 hover:text-slate-800"
          aria-label="Notifications"
        >

          <Bell className="h-5 w-5" />

          <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-red-500 ring-2 ring-white" />

        </button>


        <div className="hidden h-8 w-px bg-slate-200 sm:block" />


        <div className="hidden text-right sm:block">

          <p className="max-w-[180px] truncate text-sm font-semibold text-slate-900">
            {displayName}
          </p>

          <p className="text-xs capitalize text-slate-500">
            {role}
          </p>

        </div>


        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-cyan-100 text-sm font-bold text-cyan-700">

          {displayName
            .charAt(0)
            .toUpperCase()}

        </div>

      </div>

    </header>
  )
}