import api from "./api"

export async function login(
  username,
  password,
) {
  const response = await api.post(
    "/api/auth/login",
    {
      username,
      password,
    },
  )

  return response.data
}

export async function getCurrentUser() {
  const response = await api.get(
    "/api/auth/me",
  )

  return response.data
}