import axiosInstance from "./axiosInstance"
import { BankPayload } from "@/types/bank"

const normalizeBankResponse = (response: any) => {
  return {
    data:
      response.data?.content ??
      response.data?.data ??
      response.data?.result ??
      response.data,
    status: response.status,
  }
}

export const APICreateBank = async (data: BankPayload) => {
  try {
    const response = await axiosInstance.post("/banks/create", data)
    if (
      (response.status === 201 || response.status === 200) &&
      response.data.code === 200
    ) {
      return normalizeBankResponse(response)
    }
    return response
  } catch (err) {
    console.error("APICreateBank error:", err)
    throw err
  }
}

export const APIGetBanks = async (params?: Record<string, unknown>) => {
  try {
    const response = await axiosInstance.get("/banks", { params })
    if (
      (response.status === 201 || response.status === 200) &&
      response.data.code === 200
    ) {
      return normalizeBankResponse(response)
    }
    return response
  } catch (err) {
    console.error("APIGetBanks error:", err)
    throw err
  }
}

export const APIGetBankById = async (id: string) => {
  try {
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
  } catch (err) {
    console.error("APIGetBankById error:", err)
    throw err
  }
}

export const APIUpdateBank = async (id: string, data: BankPayload) => {
  try {
    const response = await axiosInstance.patch(`/banks/${id}`, data)
    if (
      (response.status === 201 || response.status === 200) &&
      response.data.code === 200
    ) {
      return normalizeBankResponse(response)
    }
    return response
  } catch (err) {
    console.error("APIUpdateBank error:", err)
    throw err
  }
}

export const APIDeleteBank = async (id: string) => {
  try {
    const response = await axiosInstance.delete(`/banks/${id}`)
    if (
      (response.status === 201 || response.status === 200) &&
      response.data.code === 200
    ) {
      return normalizeBankResponse(response)
    }
    return response
  } catch (err) {
    console.error("APIDeleteBank error:", err)
    throw err
  }
}
