import axios from "axios"


const api = axios.create({
  baseURL: "http://127.0.0.1:8000",

  headers: {
    "Content-Type": "application/json",
  },
})


/*
 * Add JWT token to every protected request.
 */
api.interceptors.request.use(
  (config) => {
    const token =
      localStorage.getItem(
        "smartmedchart_token",
      )

    if (token) {
      config.headers.Authorization =
        `Bearer ${token}`
    }

    return config
  },

  (error) => {
    return Promise.reject(error)
  },
)


/*
 * Handle authentication failures.
 */
api.interceptors.response.use(
  (response) => {
    return response
  },

  (error) => {
    if (
      error.response?.status === 401
    ) {
      localStorage.removeItem(
        "smartmedchart_token",
      )

      localStorage.removeItem(
        "smartmedchart_user",
      )
    }

    return Promise.reject(error)
  },
)


export default api