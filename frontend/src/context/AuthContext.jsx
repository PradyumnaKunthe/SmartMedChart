import {
  createContext,
  useContext,
  useEffect,
  useState,
} from "react"

import {
  getCurrentUser,
  login as loginRequest,
} from "../services/auth"
import { isTokenExpired } from "../services/api"

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  async function restoreSession() {
    const token = localStorage.getItem("smartmedchart_token")

    if (!token || isTokenExpired(token)) {
      if (token && isTokenExpired(token)) {
        localStorage.removeItem("smartmedchart_token")
        localStorage.removeItem("smartmedchart_user")
      }
      setUser(null)
      setLoading(false)
      return
    }

    try {
      const currentUser = await getCurrentUser()
      setUser(currentUser)
      localStorage.setItem("smartmedchart_user", JSON.stringify(currentUser))
    } catch (error) {
      console.error("Session restore failed:", error)
      localStorage.removeItem("smartmedchart_token")
      localStorage.removeItem("smartmedchart_user")
      setUser(null)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    restoreSession()

    function handleAuthExpired() {
      setUser(null)
    }

    window.addEventListener("smartmedchart:auth-expired", handleAuthExpired)
    return () => {
      window.removeEventListener("smartmedchart:auth-expired", handleAuthExpired)
    }
  }, [])

  async function login(username, password) {
    const loginData = await loginRequest(username, password)

    if (!loginData?.access_token) {
      throw new Error("Login succeeded but no access token was returned.")
    }

    localStorage.setItem("smartmedchart_token", loginData.access_token)

    /*
     * Ask backend who actually logged in.
     * This is the source of truth for the role.
     */
    const currentUser = await getCurrentUser()
    setUser(currentUser)
    localStorage.setItem("smartmedchart_user", JSON.stringify(currentUser))
    return currentUser
  }

  function logout() {
    localStorage.removeItem("smartmedchart_token")
    localStorage.removeItem("smartmedchart_user")
    setUser(null)
  }

  const value = {
    user,
    loading,
    isAuthenticated: Boolean(user),
    login,
    logout,
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error("useAuth must be used inside AuthProvider")
  }
  return context
}
