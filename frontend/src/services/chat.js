import api from "./api"

export async function sendChatMessage(message) {
  const response = await api.post(
    "/api/chat",
    {
      message,
    },
  )

  return response.data
}