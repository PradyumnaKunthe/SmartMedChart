import {
  Navigate,
  useLocation,
} from "react-router-dom"

import {
  useAuth,
} from "../../context/AuthContext"


export default function ProtectedRoute({
  children,
}) {
  const {
    user,
    loading,
  } = useAuth()

  const location =
    useLocation()


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
        state={{
          from: location,
        }}
      />
    )
  }


  return children
}