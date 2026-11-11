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

// Response Interceptor: Handle 401 Unauthorized / Token Expiration & Safe Error Formatting
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

    // Safeguard: Ensure error.response.data.detail is always formatted as a string
    // to prevent React from crashing when rendering FastAPI 422 validation error arrays.
    if (error.response?.data?.detail && typeof error.response.data.detail !== "string") {
      error.response.data.rawDetail = error.response.data.detail
      error.response.data.detail = getApiErrorMessage(error)
    }

    return Promise.reject(error)
  },
)

/**
 * Safely extracts a clean, human-readable string from any API error or Axios response.
 * Handles FastAPI 422 arrays of validation objects, { detail: "..." }, { detail: [...] }, network errors, etc.
 * Never returns raw objects or arrays of objects, preventing React child rendering crashes.
 */
export function getApiErrorMessage(error, fallback = "An unexpected error occurred.") {
  if (!error) return fallback

  const statusCode = error?.response?.status

  // Provide human-friendly default messages for common HTTP security codes
  if (statusCode === 401 && !error?.response?.data?.detail) {
    return "Your session has expired. Please sign in again."
  }
  if (statusCode === 403 && !error?.response?.data?.detail) {
    return "You do not have permission to perform this action."
  }
  if (statusCode === 413) {
    return "The submitted request payload is too large (maximum 5MB allowed)."
  }
  if (statusCode === 429) {
    return error?.response?.data?.detail || "Too many attempts. Please wait before trying again."
  }

  const responseData = error?.response?.data
  const detail = responseData?.detail ?? responseData?.message ?? error?.message

  if (!detail) {
    if (error?.request && !error?.response) {
      return "Cannot connect to SmartMedChart server. Please check your network connection."
    }
    return fallback
  }

  if (typeof detail === "string") {
    return detail.trim() || fallback
  }

  if (Array.isArray(detail)) {
    const messages = detail
      .map((item) => {
        if (!item) return ""
        if (typeof item === "string") return item.trim()
        if (typeof item === "object") {
          // FastAPI validation shape: { loc: ["body", "field"], msg: "...", type: "..." }
          const field = Array.isArray(item.loc)
            ? item.loc.filter((part) => part !== "body" && part !== "query").join(" ")
            : ""
          const msg = item.msg || item.message || "Invalid input"
          return field ? `${field}: ${msg}` : msg
        }
        return String(item)
      })
      .filter(Boolean)

    if (messages.length > 0) {
      return messages.join(". ")
    }
  }

  if (typeof detail === "object") {
    if (detail.msg) return String(detail.msg)
    if (detail.message) return String(detail.message)
    try {
      return JSON.stringify(detail)
    } catch {
      return fallback
    }
  }

  return String(detail)
}

/**
 * Standard client-side validation helpers
 */
const EMAIL_REGEX = /^[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+$/
const INDIAN_MOBILE_REGEX = /^(?:\+91|91|0)?([6-9]\d{9})$/

export function validateEmail(email) {
  if (!email || typeof email !== "string") return "Email address is required."
  const trimmed = email.trim()
  if (!trimmed) return "Email address is required."
  if (trimmed.length > 255) return "Email address cannot exceed 255 characters."
  if (!EMAIL_REGEX.test(trimmed) || trimmed.includes("..") || trimmed.endsWith(".")) {
    return "Please enter a valid email address."
  }
  return null
}

export function validateMobile(mobile, required = false) {
  if (!mobile || typeof mobile !== "string") {
    return required ? "Mobile number is required." : null
  }
  const cleaned = mobile.trim()
  if (!cleaned) return required ? "Mobile number is required." : null

  if (/[a-zA-Z]/.test(cleaned)) {
    return "Mobile number format is invalid. Alphabetic characters are not permitted."
  }
  const digitsAndPlus = cleaned.replace(/[\s\-().]/g, "")
  if (!INDIAN_MOBILE_REGEX.test(digitsAndPlus) && !/^\+?[1-9]\d{7,14}$/.test(digitsAndPlus)) {
    return "Mobile number format is invalid. Please provide a valid 10-digit mobile number."
  }
  return null
}

export function validatePassword(password) {
  if (!password || typeof password !== "string") {
    return "Password must contain at least 8 characters."
  }
  if (password.length < 8) {
    return "Password must contain at least 8 characters."
  }
  if (password.length > 128) {
    return "Password cannot exceed 128 characters."
  }
  if (!password.trim()) {
    return "Password cannot consist entirely of whitespace."
  }
  return null
}

export function validateRequired(value, fieldName = "Field") {
  if (value === null || value === undefined) return `${fieldName} is required.`
  if (typeof value === "string" && !value.trim()) return `${fieldName} is required.`
  return null
}

export default api
