import axiosInstance from "./axiosInstance"
import { LoginPayload } from "@/types/auth"

const APILogin = async (data: LoginPayload) => {
  try {
    const response = await axiosInstance.post("/auth/login", data)

    return response.data.content
  } catch (err) {
    console.error("Error during login:", err)
    throw err
  }
}

export { APILogin }
