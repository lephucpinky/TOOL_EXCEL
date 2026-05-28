import axiosInstance from "./axiosInstance"

import type { CreateUserPayload, UpdateUserPayload } from "@/types/user"

function normalizeResponse(response: any) {
  return {
    data: response.data?.content ?? response.data?.data ?? response.data,
    status: response.status,
  }
}

const APICreateUser = async (data: CreateUserPayload) => {
  try {
    const response = await axiosInstance.post("/users/create", data)

    return normalizeResponse(response)
  } catch (err) {
    console.error("Error during create user:", err)
    throw err
  }
}

const APIGetUsers = async (params?: any) => {
  try {
    const response = await axiosInstance.get("/users", { params })

    return normalizeResponse(response)
  } catch (err) {
    console.error("Error during get users:", err)
    throw err
  }
}

const APIGetUserById = async (id: string) => {
  try {
    const response = await axiosInstance.get(`/users/${id}`)

    return normalizeResponse(response)
  } catch (err) {
    console.error("Error during get user by id:", err)
    throw err
  }
}

const APIUpdateUser = async (id: string, data: UpdateUserPayload) => {
  try {
    const response = await axiosInstance.patch(`/users/${id}`, data)

    return normalizeResponse(response)
  } catch (err) {
    console.error("Error during update user:", err)
    throw err
  }
}

const APIDeleteUser = async (id: string) => {
  try {
    const response = await axiosInstance.delete(`/users/${id}`)

    return normalizeResponse(response)
  } catch (err) {
    console.error("Error during delete user:", err)
    throw err
  }
}

export {
  APICreateUser,
  APIGetUsers,
  APIGetUserById,
  APIUpdateUser,
  APIDeleteUser,
}
