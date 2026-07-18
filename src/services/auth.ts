import axiosInstance from "./axiosInstance"
import { ChangePasswordPayload, LoginPayload } from "@/types/auth"

const APILogin = async (data: LoginPayload) => {
  const response = await axiosInstance.post("/auth/login", data)

  return response.data.content
}

const APIChangePassword = async (data: ChangePasswordPayload) => {
  const response = await axiosInstance.put("/auth/change-password", data)

  return response.data?.content ?? response.data
}

export { APILogin, APIChangePassword }
