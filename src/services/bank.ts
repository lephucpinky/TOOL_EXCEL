import axiosInstance from "./axiosInstance"
import { BankPayload } from "@/types/bank"

const normalizeBankResponse = (response: any) => {
  const body = response.data

  return {
    data: body?.content ?? body?.data ?? body?.result ?? body,
    status: response.status,
    total: body?.total ?? body?.content?.total ?? body?.data?.total,
    page: body?.page ?? body?.content?.page ?? body?.data?.page,
    limit: body?.limit ?? body?.content?.limit ?? body?.data?.limit,
    totalPages:
      body?.totalPages ?? body?.content?.totalPages ?? body?.data?.totalPages,
  }
}

export const APICreateBank = async (data: BankPayload) => {
  const response = await axiosInstance.post("/banks/create", data)
  if (
    (response.status === 201 || response.status === 200) &&
    response.data.code === 200
  ) {
    return normalizeBankResponse(response)
  }
  return response
}

export const APIGetBanks = async (params?: Record<string, unknown>) => {
  const response = await axiosInstance.get("/banks", { params })
  if (
    (response.status === 201 || response.status === 200) &&
    response.data.code === 200
  ) {
    return normalizeBankResponse(response)
  }
  return response
}

export const APIGetBankById = async (id: string) => {
  const response = await axiosInstance.get(`/banks/${id}`, {
    headers: {
      "Cache-Control": "no-cache",
      Pragma: "no-cache",
    },
    params: {
      _t: Date.now(),
    },
  })
  if (
    (response.status === 201 || response.status === 200) &&
    response.data.code === 200
  ) {
    return normalizeBankResponse(response)
  }
  return response
}

export const APIUpdateBank = async (id: string, data: BankPayload) => {
  const response = await axiosInstance.patch(`/banks/${id}`, data)
  if (
    (response.status === 201 || response.status === 200) &&
    response.data.code === 200
  ) {
    return normalizeBankResponse(response)
  }
  return response
}

export const APIDeleteBank = async (id: string) => {
  const response = await axiosInstance.delete(`/banks/${id}`)
  if (
    (response.status === 201 || response.status === 200) &&
    response.data.code === 200
  ) {
    return normalizeBankResponse(response)
  }
  return response
}
