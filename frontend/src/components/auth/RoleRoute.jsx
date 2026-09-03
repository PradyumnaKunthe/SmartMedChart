import {
  Navigate,
} from "react-router-dom"

import {
  useAuth,
} from "../../context/AuthContext"


export default function RoleRoute({
  allowedRoles,
  children,
}) {
  const {
    user,
    loading,
  } = useAuth()


  if (loading) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center">
        <div className="rounded-2xl bg-white px-6 py-5 shadow-sm">

          <p className="text-sm font-semibold text-slate-700">
            Loading SmartMedChart...
          </p>

        </div>
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


  const currentRole =
    typeof user.role === "string"
      ? user.role
          .trim()
          .toLowerCase()
      : ""


  const normalizedRoles =
    allowedRoles.map(
      (role) =>
        role
          .trim()
          .toLowerCase(),
    )


  if (
    !normalizedRoles.includes(
      currentRole,
    )
  ) {
    if (
      currentRole === "nurse"
    ) {
      return (
        <Navigate
          to="/nurse/dashboard"
          replace
        />
      )
    }


    if (
      currentRole === "doctor"
    ) {
      return (
        <Navigate
          to="/doctor/dashboard"
          replace
        />
      )
    }


    if (
      currentRole === "admin" ||
      currentRole ===
        "administrator"
    ) {
      return (
        <Navigate
          to="/admin/dashboard"
          replace
        />
      )
    }


    return (
      <Navigate
        to="/login"
        replace
      />
    )
  }


  return children
}