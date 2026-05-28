import axiosInstance from "./axiosInstance"
import { ChangePasswordPayload, LoginPayload } from "@/types/auth"

const APILogin = async (data: LoginPayload) => {
  try {
    const response = await axiosInstance.post("/auth/login", data)

    return response.data.content
  } catch (err) {
    console.error("Error during login:", err)
    throw err
  }
}

const APIChangePassword = async (data: ChangePasswordPayload) => {
  try {
    const response = await axiosInstance.put("/auth/change-password", data)

    return response.data?.content ?? response.data
  } catch (err) {
    console.error("Error during change password:", err)
    throw err
  }
}

export { APILogin, APIChangePassword }
