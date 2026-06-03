import type { AxiosResponse } from "axios"
import axiosInstance from "./axiosInstance"
import type { InvoiceApiRow } from "@/types/invoice"
import { fetchAllPages } from "@/utils/pagination"

export type SaleTransactionListParams = {
  page?: number
  limit?: number
  startDate?: string
  endDate?: string
  invoiceStatus?: string
  isPaid?: boolean
  agencyId?: string
  employeeId?: string
  departmentId?: string
  bankId?: string
}

export type SaleTransactionReportExportParams = {
  startDate?: string
  endDate?: string
  invoiceStatus?: string
  isPaid?: boolean
  agencyId?: string
  employeeId?: string
  departmentId?: string
  bankId?: string
}

export type SaleTransactionPayload = Partial<
  Omit<InvoiceApiRow, "exportInvoiceData" | "paymentStatus">
> & {
  exportInvoiceData?: Record<string, unknown>
}

export type UpdateSaleTransactionBankPayload = {
  amountCollected: number
  bankId: string
}

type ApiEnvelope<T> = {
  content?: T
  data?: T
  result?: T
}

type NormalizedResponse<T> = {
  data: T
  status: number
}

const normalizeResponse = <T>(
  response: AxiosResponse<ApiEnvelope<T> | T>
): NormalizedResponse<T> => {
  const body = response.data

  if (body && typeof body === "object") {
    const envelope = body as ApiEnvelope<T>

    return {
      data: envelope.content ?? envelope.data ?? envelope.result ?? (body as T),
      status: response.status,
    }
  }

  return {
    data: body as T,
    status: response.status,
  }
}

const cleanParams = (params?: SaleTransactionReportExportParams) => {
  return Object.fromEntries(
    Object.entries(params || {}).filter(([, value]) => {
      return value !== undefined && value !== null && value !== ""
    })
  )
}

// PATCH uses a narrower DTO than create. Keep this aligned with UpdateTransactionDto.
const SALE_TRANSACTION_UPDATE_FIELDS = [
  "inv_invoiceIssuedDate",
  "inv_currencyCode",
  "inv_exchangeRate",
  "so_benh_an",
  "inv_buyerDisplayName",
  "inv_buyerLegalName",
  "inv_buyerTaxCode",
  "inv_buyerAddressLine",
  "inv_buyerEmail",
  "inv_buyerBankAccount",
  "inv_buyerBankName",
  "inv_paymentMethodName",
  "inv_discountAmount",
  "inv_TotalAmountWithoutVAT",
  "inv_vatAmount",
  "inv_TotalAmount",
  "key_api",
  "cccdan",
  "so_hchieu",
  "mdvqhnsach_nmua",
  "ma_ch",
  "ten_ch",
  "inv_quantity",
  "inv_discountPercentage",
  "agencyId",
  "employeeId",
  "amountCollected",
  "items",
] as const satisfies readonly (keyof SaleTransactionPayload)[]

type SaleTransactionUpdateField =
  (typeof SALE_TRANSACTION_UPDATE_FIELDS)[number]

type UpdateSaleTransactionPayload = Pick<
  SaleTransactionPayload,
  SaleTransactionUpdateField
>

const buildUpdateSaleTransactionPayload = (
  data: SaleTransactionPayload
): UpdateSaleTransactionPayload => {
  return Object.fromEntries(
    SALE_TRANSACTION_UPDATE_FIELDS.filter(
      (field) => data[field] !== undefined
    ).map((field) => [field, data[field]])
  ) as UpdateSaleTransactionPayload
}

const APICreateSaleTransaction = async (data: SaleTransactionPayload) => {
  const response = await axiosInstance.post("/sale-transaction/create", data)

  if (response.status >= 200 && response.status < 300) {
    return normalizeResponse<InvoiceApiRow>(response)
  }

  return response
}

const APIGetSaleTransactions = async (params?: SaleTransactionListParams) => {
  const response = await axiosInstance.get("/sale-transaction", { params })

  if (response.status >= 200 && response.status < 300) {
    return normalizeResponse<InvoiceApiRow[]>(response)
  }

  return response
}

const APIGetAllSaleTransactions = async (
  params?: SaleTransactionListParams
) => {
  const data = await fetchAllPages<InvoiceApiRow, SaleTransactionListParams>(
    APIGetSaleTransactions,
    params
  )

  return { data, status: 200 }
}

const APIGetSaleTransactionStats = async () => {
  const response = await axiosInstance.get("/sale-transaction/stats")

  if (response.status >= 200 && response.status < 300) {
    return normalizeResponse<Record<string, unknown>>(response)
  }

  return response
}

const APISearchSaleTransactionsByDateRange = async (params: {
  startDate: string
  endDate: string
}) => {
  const response = await axiosInstance.get(
    "/sale-transaction/search/date-range",
    { params }
  )

  if (response.status >= 200 && response.status < 300) {
    return normalizeResponse<InvoiceApiRow[]>(response)
  }

  return response
}

const APIGetSaleTransactionsByEmployee = async (employeeId: string) => {
  const response = await axiosInstance.get(
    `/sale-transaction/by-employee/${employeeId}`
  )

  if (response.status >= 200 && response.status < 300) {
    return normalizeResponse<InvoiceApiRow[]>(response)
  }

  return response
}

const APIGetSaleTransactionsByAgency = async (agencyId: string) => {
  const response = await axiosInstance.get(
    `/sale-transaction/by-agency/${agencyId}`
  )

  if (response.status >= 200 && response.status < 300) {
    return normalizeResponse<InvoiceApiRow[]>(response)
  }

  return response
}

const APIGetSaleTransactionsByDepartment = async (departmentId: string) => {
  const response = await axiosInstance.get(
    `/sale-transaction/by-department/${departmentId}`
  )

  if (response.status >= 200 && response.status < 300) {
    return normalizeResponse<InvoiceApiRow[]>(response)
  }

  return response
}

const APIGetSaleTransactionById = async (id: string) => {
  const response = await axiosInstance.get(`/sale-transaction/${id}`)

  if (response.status >= 200 && response.status < 300) {
    return normalizeResponse<InvoiceApiRow>(response)
  }

  return response
}

const APIUpdateSaleTransaction = async (
  id: string,
  data: SaleTransactionPayload
) => {
  const updatePayload = buildUpdateSaleTransactionPayload(data)

  const response = await axiosInstance.patch(
    `/sale-transaction/${id}`,
    updatePayload
  )

  if (response.status >= 200 && response.status < 300) {
    return normalizeResponse<InvoiceApiRow>(response)
  }

  return response
}

const APIUpdateSaleTransactionBank = async (
  id: string,
  payload: UpdateSaleTransactionBankPayload
) => {
  const response = await axiosInstance.patch(
    `/sale-transaction/${id}/mark-paid`,
    payload
  )

  if (response.status >= 200 && response.status < 300) {
    return normalizeResponse<InvoiceApiRow>(response)
  }

  return response
}

const APIDeleteSaleTransaction = async (id: string) => {
  const response = await axiosInstance.delete(`/sale-transaction/${id}`)

  if (response.status === 204) {
    return { data: null, status: 204 }
  }

  if (response.status >= 200 && response.status < 300) {
    return normalizeResponse<InvoiceApiRow | null>(response)
  }

  return response
}

const APIExportSaleTransactionReport = async (
  params?: SaleTransactionReportExportParams
) => {
  return axiosInstance.get("/sale-transaction/report/export", {
    params: cleanParams(params),
    responseType: "blob",
  })
}

const APISendSaleTransactionReceipt = async (id: string) => {
  const response = await axiosInstance.post(
    `/sale-transaction/${id}/send-receipt`
  )

  if (response.status >= 200 && response.status < 300) {
    return normalizeResponse<InvoiceApiRow>(response)
  }

  return response
}

export {
  APICreateSaleTransaction,
  APIGetSaleTransactions,
  APIGetAllSaleTransactions,
  APIGetSaleTransactionStats,
  APISearchSaleTransactionsByDateRange,
  APIGetSaleTransactionsByEmployee,
  APIGetSaleTransactionsByAgency,
  APIGetSaleTransactionsByDepartment,
  APIGetSaleTransactionById,
  APIUpdateSaleTransaction,
  APIUpdateSaleTransactionBank,
  APIDeleteSaleTransaction,
  APIExportSaleTransactionReport,
  APISendSaleTransactionReceipt,
}
