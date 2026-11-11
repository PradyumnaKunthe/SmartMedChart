import { useState } from "react"
import {
  Activity,
  ArrowRight,
  Building2,
  CheckCircle2,
  ChevronDown,
  Eye,
  EyeOff,
  HeartPulse,
  LockKeyhole,
  Shield,
  ShieldCheck,
  Sparkles,
  Stethoscope,
  UserRound,
} from "lucide-react"
import { useNavigate } from "react-router-dom"
import { useAuth } from "../context/AuthContext"
import { getApiErrorMessage } from "../services/api"

const ROLE_OPTIONS = [
  {
    value: "admin",
    label: "Admin",
    description: "Manage staff, wards, and hospital operations.",
    Icon: Shield,
  },
  {
    value: "doctor",
    label: "Doctor",
    description: "Access your clinical workspace and patient care tools.",
    Icon: Stethoscope,
  },
  {
    value: "nurse",
    label: "Nurse",
    description: "Open assigned patients and medication workflows.",
    Icon: HeartPulse,
  },
  {
    value: "hospital",
    label: "Hospital Staff",
    description: "Manage patient admissions and hospital records.",
    Icon: Building2,
  },
  {
    value: "receptionist",
    label: "Receptionist",
    description: "Manage patient check-ins and administrative tasks.",
    Icon: UserRound,
  }
]

function normalizeRole(role) {
  return typeof role === "string" ? role.trim().toLowerCase() : ""
}

function roleMatchesSelection(selectedRole, actualRole) {
  if (selectedRole === "admin") {
    return actualRole === "admin" || actualRole === "administrator"
  }

  if (selectedRole === "hospital") {
    return actualRole === "hospital" || actualRole === "hospital_staff"
  }

  return selectedRole === actualRole
}

export default function Login() {
  const { login } = useAuth()
  const navigate = useNavigate()

  const [selectedRole, setSelectedRole] = useState("")
  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)

  const selectedRoleInfo = ROLE_OPTIONS.find((role) => role.value === selectedRole)
  const SelectedRoleIcon = selectedRoleInfo?.Icon

  async function handleSubmit(event) {
    event.preventDefault()
    setError("")

    if (!selectedRole) {
      setError("Please select your role before signing in.")
      return
    }

    const cleanUsername = username.trim()
    if (!cleanUsername) {
      setError("Please enter your username.")
      return
    }

    if (cleanUsername.length < 3) {
      setError("Username must contain at least 3 characters.")
      return
    }

    if (!password) {
      setError("Please enter your password.")
      return
    }

    if (password.length < 8) {
      setError("Password must contain at least 8 characters.")
      return
    }

    setLoading(true)

    try {
      // Keep the existing AuthContext/backend authentication flow.
      const currentUser = await login(cleanUsername, password)
      const actualRole = normalizeRole(currentUser?.role)

      if (!roleMatchesSelection(selectedRole, actualRole)) {
        setError(
          `Role mismatch. This account is registered as "${currentUser?.role || "Unknown"}". Please select the correct role.`,
        )
        return
      }

      if (actualRole === "nurse") {
        navigate("/nurse/dashboard", { replace: true })
        return
      }

      if (actualRole === "doctor") {
        navigate("/doctor/dashboard", { replace: true })
        return
      }
      if (actualRole === "receptionist") {
        navigate("/hospital/dashboard", {
        replace: true,
     })

        return
      }

      if (actualRole === "admin" || actualRole === "administrator") {
        navigate("/admin/dashboard", { replace: true })
        return
      }

      if (actualRole === "hospital" || actualRole === "hospital_staff") {
        navigate("/hospital/dashboard", { replace: true })
        return
      }

      setError("Your account does not have a valid application role.")
    } catch (requestError) {
      setError(
        getApiErrorMessage(requestError, "Unable to sign in. Please check your credentials.")
      )
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#2639bd] p-3 sm:p-6 lg:p-8">
      {/* Soft decorative background glows */}
      <div aria-hidden="true" className="pointer-events-none absolute -left-36 -top-40 h-[28rem] w-[28rem] rounded-full bg-cyan-300/15 blur-3xl" />
      <div aria-hidden="true" className="pointer-events-none absolute -bottom-48 -right-28 h-[34rem] w-[34rem] rounded-full bg-indigo-300/20 blur-3xl" />

      <section className="relative grid w-full max-w-[1180px] overflow-hidden rounded-[26px] bg-white shadow-[0_35px_100px_rgba(4,10,57,0.34)] sm:rounded-[34px] lg:min-h-[680px] lg:grid-cols-[0.92fr_1.08fr]">
        {/* Login form */}
        <div className="flex min-w-0 flex-col justify-center px-6 py-8 sm:px-10 sm:py-10 lg:px-12 lg:py-12 xl:px-16">
          <div className="mb-8 flex items-center gap-3">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#eef2ff] text-[#2639bd] ring-1 ring-indigo-100">
              <Activity className="h-6 w-6" strokeWidth={2.5} />
            </div>
            <div>
              <p className="text-sm font-extrabold tracking-tight text-slate-900 sm:text-base">SmartMedChart</p>
              <p className="mt-0.5 text-xs font-medium text-slate-500">Intelligent medication management</p>
            </div>
          </div>

          <div className="mb-7">
            <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-[#edf4ff] px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.13em] text-[#2639bd]">
              <ShieldCheck className="h-4 w-4" /> Secure clinical access
            </div>
            <h1 className="text-3xl font-bold tracking-tight text-slate-950 sm:text-[2.15rem]">Welcome back</h1>
            <p className="mt-2 max-w-sm text-sm leading-6 text-slate-500">
              Sign in to continue to your clinical workspace.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="role" className="mb-2 block text-sm font-semibold text-slate-700">
                Login as
              </label>
              <div className="relative">
                <Shield className="pointer-events-none absolute left-3.5 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-slate-400" />
                <select
                  id="role"
                  value={selectedRole}
                  onChange={(event) => {
                    setSelectedRole(event.target.value)
                    setError("")
                  }}
                  required
                  disabled={loading}
                  className="w-full appearance-none rounded-xl border border-slate-200 bg-slate-50 py-3.5 pl-11 pr-11 text-sm font-medium text-slate-800 outline-none transition hover:border-indigo-200 focus:border-indigo-500 focus:bg-white focus:ring-4 focus:ring-indigo-100 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <option value="" disabled>Select your role</option>
                  {ROLE_OPTIONS.map((role) => (
                    <option key={role.value} value={role.value}>
                      {role.label}
                    </option>
                  ))}
                </select>
                <ChevronDown className="pointer-events-none absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              </div>
            </div>

            {selectedRoleInfo && (
              <div className="flex items-center gap-3 rounded-xl border border-indigo-100 bg-indigo-50/70 px-3.5 py-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white text-indigo-600 shadow-sm ring-1 ring-indigo-100">
                  {SelectedRoleIcon && <SelectedRoleIcon className="h-5 w-5" />}
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-bold text-slate-800">{selectedRoleInfo.label} workspace</p>
                  <p className="mt-0.5 text-xs leading-5 text-slate-500">{selectedRoleInfo.description}</p>
                </div>
              </div>
            )}

            <div>
              <label htmlFor="username" className="mb-2 block text-sm font-semibold text-slate-700">
                Username
              </label>
              <div className="relative">
                <UserRound className="pointer-events-none absolute left-3.5 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-slate-400" />
                <input
                  id="username"
                  name="username"
                  type="text"
                  value={username}
                  onChange={(event) => {
                    setUsername(event.target.value)
                    setError("")
                  }}
                  required
                  autoComplete="username"
                  disabled={loading}
                  placeholder="Enter your username"
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 py-3.5 pl-11 pr-4 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 hover:border-indigo-200 focus:border-indigo-500 focus:bg-white focus:ring-4 focus:ring-indigo-100 disabled:cursor-not-allowed disabled:opacity-60"
                />
              </div>
            </div>

            <div>
              <label htmlFor="password" className="mb-2 block text-sm font-semibold text-slate-700">
                Password
              </label>
              <div className="relative">
                <LockKeyhole className="pointer-events-none absolute left-3.5 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-slate-400" />
                <input
                  id="password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(event) => {
                    setPassword(event.target.value)
                    setError("")
                  }}
                  required
                  autoComplete="current-password"
                  disabled={loading}
                  placeholder="Enter your password"
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 py-3.5 pl-11 pr-12 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 hover:border-indigo-200 focus:border-indigo-500 focus:bg-white focus:ring-4 focus:ring-indigo-100 disabled:cursor-not-allowed disabled:opacity-60"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((previous) => !previous)}
                  disabled={loading}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-lg p-2 text-slate-400 transition hover:bg-indigo-50 hover:text-indigo-600 disabled:cursor-not-allowed"
                >
                  {showPassword ? <EyeOff className="h-[18px] w-[18px]" /> : <Eye className="h-[18px] w-[18px]" />}
                </button>
              </div>
            </div>

            {error && (
              <div role="alert" className="flex items-start gap-2.5 rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-3 text-sm leading-5 text-rose-700">
                <Shield className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={loading || !selectedRole || !username.trim() || !password}
              className="group flex w-full items-center justify-center gap-2 rounded-xl bg-[#2639bd] px-4 py-3.5 text-sm font-bold text-white shadow-lg shadow-indigo-900/15 transition hover:-translate-y-0.5 hover:bg-[#1f2fa4] hover:shadow-xl focus:outline-none focus:ring-4 focus:ring-indigo-200 disabled:cursor-not-allowed disabled:opacity-55 disabled:hover:translate-y-0"
            >
              {loading ? (
                <>
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/35 border-t-white" />
                  Signing in...
                </>
              ) : (
                <>
                  Sign in securely
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                </>
              )}
            </button>
          </form>

          <div className="mt-7 flex items-center justify-center gap-2 text-center text-xs text-slate-400">
            <ShieldCheck className="h-4 w-4 text-emerald-600" />
            <span>Protected, role-based clinical access</span>
          </div>
        </div>

        {/* Abstract blue visual panel inspired by the supplied reference */}
        <aside className="relative hidden min-h-[680px] overflow-hidden bg-[#071451] lg:block">
          <svg
            aria-hidden="true"
            className="absolute inset-0 h-full w-full"
            viewBox="0 0 620 900"
            preserveAspectRatio="xMidYMid slice"
          >
            <defs>
              <linearGradient id="panelBase" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#09164f" />
                <stop offset="48%" stopColor="#172da8" />
                <stop offset="100%" stopColor="#080d3a" />
              </linearGradient>
              <linearGradient id="panelWave" x1="0" y1="0" x2="0.9" y2="1">
                <stop offset="0%" stopColor="#a5b4fc" />
                <stop offset="35%" stopColor="#6366f1" />
                <stop offset="72%" stopColor="#3449de" />
                <stop offset="100%" stopColor="#0b1765" />
              </linearGradient>
              <linearGradient id="panelHighlight" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#e0e7ff" stopOpacity="0.96" />
                <stop offset="50%" stopColor="#818cf8" stopOpacity="0.65" />
                <stop offset="100%" stopColor="#312e81" stopOpacity="0.1" />
              </linearGradient>
              <radialGradient id="panelGlow" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor="#60a5fa" stopOpacity="0.6" />
                <stop offset="100%" stopColor="#60a5fa" stopOpacity="0" />
              </radialGradient>
            </defs>
            <rect width="620" height="900" fill="url(#panelBase)" />
            <ellipse cx="510" cy="260" rx="390" ry="390" fill="url(#panelGlow)" />
            <path d="M180 -70 C360 -10 360 150 450 260 C500 320 610 340 690 260 L690 -70 Z" fill="#161f8b" opacity="0.85" />
            <path d="M250 -60 C420 25 315 190 410 275 C470 330 540 300 650 210 L650 -60 Z" fill="url(#panelWave)" />
            <path d="M390 -50 C470 50 425 170 495 260 C530 305 595 310 660 278 L660 -50 Z" fill="url(#panelHighlight)" />
            <path d="M-60 480 C95 390 170 475 242 555 C322 645 380 600 455 550 C535 497 605 525 680 590 L680 940 L-60 940 Z" fill="#101d78" opacity="0.9" />
            <path d="M-50 600 C70 485 160 530 250 610 C335 686 390 660 470 605 C555 545 615 590 675 645 L675 940 L-50 940 Z" fill="url(#panelWave)" opacity="0.86" />
            <path d="M-50 720 C75 620 160 655 252 730 C350 808 410 755 490 714 C560 680 625 710 675 750 L675 940 L-50 940 Z" fill="#080f49" opacity="0.7" />
          </svg>

          <div aria-hidden="true" className="absolute -right-24 top-44 h-72 w-72 rounded-full border border-white/10 bg-white/5 blur-sm" />
          <div aria-hidden="true" className="absolute bottom-20 left-12 h-40 w-40 rounded-full border border-cyan-100/15 bg-cyan-300/10 blur-xl" />

          <div className="relative z-10 flex min-h-[680px] flex-col justify-between p-10 xl:p-14">
            <div className="inline-flex w-fit items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3.5 py-2 text-[10px] font-bold uppercase tracking-[0.18em] text-indigo-50 backdrop-blur-md">
              <span className="h-2 w-2 rounded-full bg-emerald-300 shadow-[0_0_12px_rgba(110,231,183,0.85)]" />
              Clinical operations platform
            </div>

            <div className="max-w-md pb-3 text-white">
              <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-2xl border border-white/20 bg-white/10 shadow-xl backdrop-blur-md">
                <HeartPulse className="h-7 w-7 text-cyan-200" />
              </div>
              <p className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-indigo-100/80">
                <Sparkles className="h-4 w-4" /> Connected care
              </p>
              <h2 className="text-4xl font-semibold leading-[1.12] tracking-tight xl:text-5xl">
                Every detail.
                <br />
                Better connected.
              </h2>
              <p className="mt-5 max-w-sm text-sm leading-7 text-indigo-100/80 xl:text-base">
                Bring people, medication workflows, and patient information together in one secure clinical workspace.
              </p>

              <div className="mt-8 space-y-3">
                {[
                  "Role-based access for clinical teams",
                  "Medication workflows in one place",
                  "Clearer patient-care coordination",
                ].map((item) => (
                  <div key={item} className="flex items-center gap-3 text-sm text-white/90">
                    <CheckCircle2 className="h-[18px] w-[18px] shrink-0 text-cyan-200" />
                    <span>{item}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-between gap-4 border-t border-white/15 pt-5 text-xs text-indigo-100/70">
              <span className="flex items-center gap-2"><ShieldCheck className="h-4 w-4" /> SmartMedChart security</span>
              <span>Care with clarity</span>
            </div>
          </div>
        </aside>
      </section>
    </main>
  )
}
