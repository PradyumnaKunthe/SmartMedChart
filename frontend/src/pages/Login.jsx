import { useState } from "react"

import {
  Activity,
  LockKeyhole,
  User,
  Eye,
  EyeOff,
  ShieldCheck,
  Stethoscope,
  HeartPulse,
  Shield,
} from "lucide-react"

import {
  useNavigate,
} from "react-router-dom"

import {
  useAuth,
} from "../context/AuthContext"


export default function Login() {
  const { login } = useAuth()
  const navigate = useNavigate()

  const [
    selectedRole,
    setSelectedRole,
  ] = useState("")

  const [
    username,
    setUsername,
  ] = useState("")

  const [
    password,
    setPassword,
  ] = useState("")

  const [
    showPassword,
    setShowPassword,
  ] = useState(false)

  const [
    error,
    setError,
  ] = useState("")

  const [
    loading,
    setLoading,
  ] = useState(false)


  // =========================================================
  // LOGIN
  // =========================================================

  async function handleSubmit(event) {
    event.preventDefault()

    setError("")

    // -------------------------------------------------------
    // Validate role selection first
    // -------------------------------------------------------

    if (!selectedRole) {
      setError(
        "Please select your role before signing in.",
      )

      return
    }

    if (!username.trim()) {
      setError(
        "Please enter your username.",
      )

      return
    }

    if (!password) {
      setError(
        "Please enter your password.",
      )

      return
    }

    setLoading(true)

    try {
      // -----------------------------------------------------
      // Login through backend
      // -----------------------------------------------------

      const currentUser = await login(
        username.trim(),
        password,
      )

      // -----------------------------------------------------
      // Get actual role returned by backend
      // -----------------------------------------------------

      const actualRole =
        typeof currentUser?.role === "string"
          ? currentUser.role
              .trim()
              .toLowerCase()
          : ""

      // -----------------------------------------------------
      // Compare selected role with actual account role
      // -----------------------------------------------------

      const normalizedSelectedRole =
        selectedRole
          .trim()
          .toLowerCase()

      const roleMatches =
        (
          normalizedSelectedRole === "admin" &&
          (
            actualRole === "admin" ||
            actualRole === "administrator"
          )
        ) ||
        actualRole ===
          normalizedSelectedRole

      if (!roleMatches) {
        setError(
          `Role mismatch. This account is registered as "${
            currentUser?.role || "Unknown"
          }". Please select the correct role.`,
        )

        return
      }

      // -----------------------------------------------------
      // Redirect according to authenticated backend role
      // -----------------------------------------------------

      if (actualRole === "nurse") {
        navigate(
          "/nurse/dashboard",
          {
            replace: true,
          },
        )

        return
      }

      if (actualRole === "doctor") {
        navigate(
          "/doctor/dashboard",
          {
            replace: true,
          },
        )

        return
      }

      if (
        actualRole === "admin" ||
        actualRole === "administrator"
      ) {
        navigate(
          "/admin/dashboard",
          {
            replace: true,
          },
        )

        return
      }

      setError(
        "Your account does not have a valid application role.",
      )

    } catch (
      requestError
    ) {
      const detail =
        requestError?.response?.data?.detail

      if (Array.isArray(detail)) {
        setError(
          detail
            .map(
              (item) =>
                item?.msg ||
                "Invalid login data.",
            )
            .join(", "),
        )
      } else if (
        typeof detail === "string"
      ) {
        setError(detail)
      } else if (
        requestError?.request &&
        !requestError?.response
      ) {
        setError(
          "Cannot connect to SmartMedChart server. Make sure the backend is running.",
        )
      } else {
        setError(
          "Unable to sign in. Please check your credentials.",
        )
      }

    } finally {
      setLoading(false)
    }
  }


  // =========================================================
  // RETURN
  // =========================================================

  return (
    <div className="min-h-screen bg-slate-950 px-4 py-8 sm:px-6 lg:px-8">

      <div className="mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-md items-center justify-center">

        <div className="w-full">

          {/* =================================================
              BRAND
          ================================================= */}

          <div className="mb-8 text-center">

            <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl border border-cyan-400/20 bg-cyan-500/10 shadow-lg shadow-cyan-500/5">

              <Activity className="h-8 w-8 text-cyan-400" />

            </div>

            <h1 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
              SmartMedChart
            </h1>

            <p className="mt-2 text-sm text-slate-400 sm:text-base">
              Intelligent medication management
            </p>

          </div>


          {/* =================================================
              LOGIN CARD
          ================================================= */}

          <div className="rounded-3xl border border-slate-800 bg-slate-900/95 p-6 shadow-2xl shadow-black/30 backdrop-blur sm:p-8">

            {/* Header */}

            <div className="mb-8">

              <div className="mb-4 flex items-center gap-2 text-cyan-400">

                <ShieldCheck className="h-5 w-5" />

                <span className="text-xs font-semibold uppercase tracking-widest">
                  Secure Access
                </span>

              </div>

              <h2 className="text-2xl font-semibold text-white">
                Welcome back
              </h2>

              <p className="mt-1 text-sm text-slate-400">
                Sign in to continue to your clinical workspace.
              </p>

            </div>


            {/* =================================================
                FORM
            ================================================= */}

            <form
              onSubmit={handleSubmit}
              className="space-y-5"
            >

              {/* =================================================
                  LOGIN AS
              ================================================= */}

              <div>

                <label
                  htmlFor="role"
                  className="mb-2 block text-sm font-medium text-slate-300"
                >
                  Login As
                </label>

                <div className="relative">

                  <Shield
                    className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-500"
                  />

                  <select
                    id="role"
                    value={selectedRole}
                    onChange={(event) => {
                      setSelectedRole(
                        event.target.value,
                      )

                      setError("")
                    }}
                    required
                    disabled={loading}
                    className="w-full appearance-none rounded-xl border border-slate-700 bg-slate-800 py-3.5 pl-11 pr-10 text-sm text-white outline-none transition hover:border-slate-600 focus:border-cyan-400 focus:ring-4 focus:ring-cyan-400/10 disabled:cursor-not-allowed disabled:opacity-60"
                  >

                    <option
                      value=""
                      disabled
                      className="bg-slate-800 text-slate-400"
                    >
                      Select your role
                    </option>

                    <option
                      value="doctor"
                      className="bg-slate-800 text-white"
                    >
                      Doctor
                    </option>

                    <option
                      value="nurse"
                      className="bg-slate-800 text-white"
                    >
                      Nurse
                    </option>

                    <option
                      value="admin"
                      className="bg-slate-800 text-white"
                    >
                      Admin
                    </option>

                  </select>

                  <div className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-500">
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="m6 9 6 6 6-6" />
                    </svg>
                  </div>

                </div>

              </div>


              {/* =================================================
                  ROLE INFORMATION
              ================================================= */}

              {selectedRole && (

                <div className="rounded-2xl border border-cyan-400/10 bg-cyan-500/5 p-4">

                  <div className="flex items-start gap-3">

                    {selectedRole === "doctor" && (
                      <div className="rounded-xl bg-blue-500/10 p-2.5">
                        <Stethoscope className="h-5 w-5 text-blue-400" />
                      </div>
                    )}

                    {selectedRole === "nurse" && (
                      <div className="rounded-xl bg-emerald-500/10 p-2.5">
                        <HeartPulse className="h-5 w-5 text-emerald-400" />
                      </div>
                    )}

                    {selectedRole === "admin" && (
                      <div className="rounded-xl bg-violet-500/10 p-2.5">
                        <Shield className="h-5 w-5 text-violet-400" />
                      </div>
                    )}

                    <div>

                      <p className="text-sm font-semibold capitalize text-white">
                        {selectedRole} access
                      </p>

                      <p className="mt-1 text-xs leading-5 text-slate-400">
                        Sign in using your registered{" "}
                        {selectedRole} account.
                      </p>

                    </div>

                  </div>

                </div>

              )}


              {/* =================================================
                  USERNAME
              ================================================= */}

              <div>

                <label
                  htmlFor="username"
                  className="mb-2 block text-sm font-medium text-slate-300"
                >
                  Username
                </label>

                <div className="relative">

                  <User
                    className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-500"
                  />

                  <input
                    id="username"
                    type="text"
                    value={username}
                    onChange={(event) => {
                      setUsername(
                        event.target.value,
                      )

                      setError("")
                    }}
                    required
                    autoComplete="username"
                    disabled={loading}
                    placeholder="Enter username"
                    className="w-full rounded-xl border border-slate-700 bg-slate-800 py-3.5 pl-11 pr-4 text-sm text-white outline-none transition placeholder:text-slate-500 hover:border-slate-600 focus:border-cyan-400 focus:ring-4 focus:ring-cyan-400/10 disabled:cursor-not-allowed disabled:opacity-60"
                  />

                </div>

              </div>


              {/* =================================================
                  PASSWORD
              ================================================= */}

              <div>

                <label
                  htmlFor="password"
                  className="mb-2 block text-sm font-medium text-slate-300"
                >
                  Password
                </label>

                <div className="relative">

                  <LockKeyhole
                    className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-500"
                  />

                  <input
                    id="password"
                    type={
                      showPassword
                        ? "text"
                        : "password"
                    }
                    value={password}
                    onChange={(event) => {
                      setPassword(
                        event.target.value,
                      )

                      setError("")
                    }}
                    required
                    autoComplete="current-password"
                    disabled={loading}
                    placeholder="Enter password"
                    className="w-full rounded-xl border border-slate-700 bg-slate-800 py-3.5 pl-11 pr-12 text-sm text-white outline-none transition placeholder:text-slate-500 hover:border-slate-600 focus:border-cyan-400 focus:ring-4 focus:ring-cyan-400/10 disabled:cursor-not-allowed disabled:opacity-60"
                  />

                  <button
                    type="button"
                    onClick={() =>
                      setShowPassword(
                        (previous) =>
                          !previous,
                      )
                    }
                    disabled={loading}
                    aria-label={
                      showPassword
                        ? "Hide password"
                        : "Show password"
                    }
                    className="absolute right-3 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-slate-500 transition hover:bg-slate-700 hover:text-slate-300 disabled:cursor-not-allowed"
                  >

                    {showPassword ? (
                      <EyeOff className="h-5 w-5" />
                    ) : (
                      <Eye className="h-5 w-5" />
                    )}

                  </button>

                </div>

              </div>


              {/* =================================================
                  ERROR
              ================================================= */}

              {error && (

                <div
                  role="alert"
                  className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm leading-6 text-red-300"
                >
                  {error}
                </div>

              )}


              {/* =================================================
                  SUBMIT
              ================================================= */}

              <button
                type="submit"
                disabled={
                  loading ||
                  !selectedRole ||
                  !username.trim() ||
                  !password
                }
                className="flex w-full items-center justify-center rounded-xl bg-cyan-500 px-4 py-3.5 text-sm font-semibold text-slate-950 shadow-lg shadow-cyan-500/10 transition hover:bg-cyan-400 focus:outline-none focus:ring-4 focus:ring-cyan-400/20 disabled:cursor-not-allowed disabled:opacity-50"
              >

                {loading ? (
                  <>
                    <span className="mr-2 h-5 w-5 animate-spin rounded-full border-2 border-slate-950/30 border-t-slate-950" />
                    Signing in...
                  </>
                ) : (
                  "Sign In"
                )}

              </button>

            </form>

          </div>


          {/* =================================================
              FOOTER
          ================================================= */}

          <div className="mt-6 flex items-center justify-center gap-2 text-center text-xs text-slate-500">

            <ShieldCheck className="h-4 w-4" />

            <span>
              Secure clinical medication management
            </span>

          </div>

        </div>

      </div>

    </div>
  )
}