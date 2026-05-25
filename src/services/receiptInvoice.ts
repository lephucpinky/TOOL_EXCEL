import type {
  ReceiptInvoiceConfig,
  ReceiptInvoicePayload,
} from "@/types/receiptInvoice"
import axiosInstance from "./axiosInstance"

const normalizeResponse = (response: any) => {
  return {
    data:
      response?.data?.content ??
      response?.data?.data ??
      response?.data?.result ??
      response?.data,
    status: response?.status,
  }
}

export const APIGetReceiptInvoices = async (
  params?: any
): Promise<{
  data: ReceiptInvoiceConfig[] | ReceiptInvoiceConfig
  status: number
}> => {
  try {
    const response = await axiosInstance.get("/receiptinvoices", { params })

    if (response.status >= 200 && response.status < 300) {
      return normalizeResponse(response)
    }

    return response
  } catch (err) {
    console.error("APIGetReceiptInvoices error:", err)
    throw err
  }
}

export const APIGetReceiptInvoiceById = async (
  id: string
): Promise<{
  data: ReceiptInvoiceConfig[] | ReceiptInvoiceConfig
  status: number
}> => {
  try {
    const response = await axiosInstance.get(`/receiptinvoices/${id}`)

    if (response.status >= 200 && response.status < 300) {
      return normalizeResponse(response)
    }

    return response
  } catch (err) {
    console.error("APIGetReceiptInvoiceById error:", err)
    throw err
  }
}

export const APICreateReceiptInvoice = async (
  payload: ReceiptInvoicePayload
): Promise<{
  data: ReceiptInvoiceConfig[] | ReceiptInvoiceConfig
  status: number
}> => {
  try {
    const response = await axiosInstance.post("/receiptinvoices/create", payload)

    if (response.status >= 200 && response.status < 300) {
      return normalizeResponse(response)
    }

    return response
  } catch (err) {
    console.error("APICreateReceiptInvoice error:", err)
    throw err
  }
}

export const APIUpdateReceiptInvoice = async (
  id: string,
  payload: ReceiptInvoicePayload
): Promise<{
  data: ReceiptInvoiceConfig[] | ReceiptInvoiceConfig
  status: number
}> => {
  try {
    const response = await axiosInstance.patch(`/receiptinvoices/${id}`, payload)

    if (response.status >= 200 && response.status < 300) {
      return normalizeResponse(response)
    }

    return response
  } catch (err) {
    console.error("APIUpdateReceiptInvoice error:", err)
    throw err
  }
}

export const APIDeleteReceiptInvoice = async (
  id: string
): Promise<{
  data: ReceiptInvoiceConfig[] | ReceiptInvoiceConfig | null
  status: number
}> => {
  try {
    const response = await axiosInstance.delete(`/receiptinvoices/${id}`)

    if (response.status === 204) {
      return { data: null, status: 204 }
    }

    if (response.status >= 200 && response.status < 300) {
      return normalizeResponse(response)
    }

    return response
  } catch (err) {
    console.error("APIDeleteReceiptInvoice error:", err)
    throw err
  }
}
