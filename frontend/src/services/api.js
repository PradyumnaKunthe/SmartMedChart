import axios from "axios"

/**
 * Checks whether a JWT token string is structurally expired.
 * Buffers by 5 seconds to prevent race conditions.
 */
export function isTokenExpired(token) {
  if (!token || typeof token !== "string") return true
  try {
    const parts = token.split(".")
    if (parts.length !== 3) return true
    const base64Url = parts[1]
    const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/")
    const payloadStr = decodeURIComponent(
      atob(base64)
        .split("")
        .map((c) => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2))
        .join("")
    )
    const payload = JSON.parse(payloadStr)
    if (!payload.exp) return false
    return Date.now() >= payload.exp * 1000 - 5000
  } catch {
    return false
  }
}

// Environment-driven base URL configuration:
// - In Production (Vercel): points to deployed Render backend (e.g. https://smartmedchart-backend.onrender.com)
// - In Local Development: empty string fallback utilizes Vite local proxy (/api -> http://127.0.0.1:8000)
const rawBaseURL = import.meta.env.VITE_API_BASE_URL || ""
const apiBaseURL = typeof rawBaseURL === "string" ? rawBaseURL.trim().replace(/\/+$/, "") : ""

const api = axios.create({
  baseURL: apiBaseURL,
  headers: {
    "Content-Type": "application/json",
  },
})

// Request Interceptor: Attach Bearer token and check expiration
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem("smartmedchart_token")
    const isLoginRequest = config.url && config.url.includes("/api/auth/login")

    if (token) {
      if (!isLoginRequest && isTokenExpired(token)) {
        // Clear stale expired credentials
        localStorage.removeItem("smartmedchart_token")
        localStorage.removeItem("smartmedchart_user")
        window.dispatchEvent(
          new CustomEvent("smartmedchart:auth-expired", {
            detail: {
              status: 401,
              message: "Invalid or expired access token.",
              url: config.url,
            },
          })
        )
      } else {
        config.headers.Authorization = `Bearer ${token}`
      }
    }

    return config
  },
  (error) => Promise.reject(error),
)

// Response Interceptor: Handle 401 Unauthorized / Token Expiration
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      const isLoginRequest = error.config?.url && error.config.url.includes("/api/auth/login")
      if (!isLoginRequest) {
        localStorage.removeItem("smartmedchart_token")
        localStorage.removeItem("smartmedchart_user")
        window.dispatchEvent(
          new CustomEvent("smartmedchart:auth-expired", {
            detail: {
              status: 401,
              message: error.response?.data?.detail || "Invalid or expired access token.",
              url: error.config?.url,
            },
          })
        )
      }
    }
    return Promise.reject(error)
  },
)

export default api
