import axiosInstance from "./axiosInstance"

import type { UserAccount, UserRole } from "@/types/user"

type ApiResponse<T> = {
  data: T
  status: number
  total?: number
  page?: number
  limit?: number
  totalPages?: number
}

function normalizeResponse<T>(response: any): ApiResponse<T> {
  const body = response.data

  return {
    data: body?.content ?? body?.data ?? body,
    status: response.status,
    total: body?.total ?? body?.content?.total ?? body?.data?.total,
    page: body?.page ?? body?.content?.page ?? body?.data?.page,
    limit: body?.limit ?? body?.content?.limit ?? body?.data?.limit,
    totalPages:
      body?.totalPages ?? body?.content?.totalPages ?? body?.data?.totalPages,
  }
}

const APICreateUser = async (data: { username: string; password: string }) => {
  const response = await axiosInstance.post("/users/create", data)

  return normalizeResponse<UserAccount>(response)
}

const APIGetUsers = async (params?: {
  page?: number
  limit?: number
  keyword?: string
  role?: UserRole
}) => {
  const response = await axiosInstance.get("/users", { params })

  return normalizeResponse<UserAccount[]>(response)
}

const APIGetUserById = async (id: string) => {
  const response = await axiosInstance.get(`/users/${id}`)

  return normalizeResponse<UserAccount>(response)
}

const APIUpdateUser = async (
  id: string,
  data: {
    username?: string
    password?: string
    role?: UserRole
    isActive?: boolean
  }
) => {
  const response = await axiosInstance.patch(`/users/${id}`, data)

  return normalizeResponse<UserAccount>(response)
}

const APIDeleteUser = async (id: string) => {
  const response = await axiosInstance.delete(`/users/${id}`)

  return normalizeResponse<unknown>(response)
}

export {
  APICreateUser,
  APIGetUsers,
  APIGetUserById,
  APIUpdateUser,
  APIDeleteUser,
}
