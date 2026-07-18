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
  reportType?: "unpaid" | "draft_paid"
}

export type SaleTransactionPayload = Partial<
  Omit<InvoiceApiRow, "paymentStatus">
>

export type UpdateSaleTransactionBankPayload = {
  amountCollected: number
  bankId: string
}

export type SaleTransactionItemResponse = {
  data: InvoiceApiRow | null
  status: number
}

export type SaleTransactionRowsResponse = {
  data: InvoiceApiRow[]
  status: number
}

export type SaleTransactionListResponse = SaleTransactionRowsResponse & {
  total: number
  page: number
  limit: number
  totalPages: number
}

export type SaleTransactionStatsResponse = {
  data: Record<string, unknown>
  status: number
}

type SaleTransactionListBody = {
  content?: unknown
  data?: unknown
  result?: unknown
  items?: unknown
  docs?: unknown
  results?: unknown
  saleTransactions?: unknown
  transactions?: unknown
  total?: unknown
  totalItems?: unknown
  count?: unknown
  page?: unknown
  currentPage?: unknown
  limit?: unknown
  pageSize?: unknown
  perPage?: unknown
  totalPages?: unknown
  pages?: unknown
  lastPage?: unknown
}

type SaleTransactionItemBody = Partial<InvoiceApiRow> & {
  content?: unknown
  data?: unknown
  result?: unknown
}

const isRecord = (value: unknown): value is Record<string, unknown> => {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value)
}

const isInvoiceRow = (value: unknown): value is InvoiceApiRow => {
  return (
    isRecord(value) && typeof value._id === "string" && value._id.trim() !== ""
  )
}

const readNumberMeta = (
  sources: unknown[],
  keys: string[],
  fallback: number
) => {
  for (const source of sources) {
    if (!isRecord(source)) continue

    for (const key of keys) {
      const value = Number(source[key])

      if (Number.isFinite(value)) return value
    }
  }

  return fallback
}

const readInvoiceRows = (value: unknown): InvoiceApiRow[] => {
  if (Array.isArray(value)) return value.filter(isInvoiceRow)
  if (!isRecord(value)) return []

  for (const key of [
    "items",
    "docs",
    "results",
    "saleTransactions",
    "transactions",
    "data",
  ]) {
    const rows = value[key]

    if (Array.isArray(rows)) return rows.filter(isInvoiceRow)
  }

  return isInvoiceRow(value) ? [value] : []
}

const readListData = (
  body: SaleTransactionListBody | InvoiceApiRow[] | unknown
) => {
  if (!isRecord(body)) return readInvoiceRows(body)

  for (const key of ["content", "data", "result"]) {
    const rows = readInvoiceRows(body[key])

    if (rows.length) return rows
  }

  return readInvoiceRows(body)
}

const readInvoiceRow = (body: SaleTransactionItemBody | unknown) => {
  if (!isRecord(body)) return null

  for (const key of ["content", "data", "result"]) {
    const row = body[key]

    if (isInvoiceRow(row)) return row
  }

  return isInvoiceRow(body) ? body : null
}

const readRecordData = (body: unknown): Record<string, unknown> => {
  if (!isRecord(body)) return {}

  for (const key of ["content", "data", "result"]) {
    const value = body[key]

    if (isRecord(value)) return value
  }

  return body
}

const buildSaleTransactionListResponse = (
  body: SaleTransactionListBody | unknown,
  status: number,
  params?: SaleTransactionListParams
): SaleTransactionListResponse => {
  const data = readListData(body)
  const sources = isRecord(body)
    ? [body, body.content, body.data, body.result]
    : [body]
  const limit = Math.max(
    readNumberMeta(
      sources,
      ["limit", "pageSize", "perPage"],
      params?.limit ?? 10
    ),
    1
  )
  const total = Math.max(
    readNumberMeta(sources, ["total", "totalItems", "count"], data.length),
    0
  )

  return {
    data,
    status,
    total,
    page: Math.max(
      readNumberMeta(sources, ["page", "currentPage"], params?.page ?? 1),
      1
    ),
    limit,
    totalPages: Math.max(
      readNumberMeta(
        sources,
        ["totalPages", "pages", "lastPage"],
        Math.ceil(total / limit) || 1
      ),
      1
    ),
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
  "activationDate",
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
  "paidDate",
  "items",
] as const satisfies readonly (keyof SaleTransactionPayload)[]

const buildUpdateSaleTransactionPayload = (
  data: SaleTransactionPayload
): Partial<SaleTransactionPayload> => {
  const entries: Array<[string, unknown]> = []

  SALE_TRANSACTION_UPDATE_FIELDS.forEach((field) => {
    const value = data[field]

    if (value === undefined) return

    if (field !== "items") {
      entries.push([field, value])
      return
    }

    if (!Array.isArray(value)) return

    const items = value.flatMap((item) => {
      if (!isRecord(item)) return []

      const row = item
      const productValue = row.productId || row.product
      const productId =
        typeof productValue === "string"
          ? productValue
          : typeof productValue === "object" &&
              productValue !== null &&
              "_id" in productValue
            ? String(productValue._id || "")
            : ""

      if (!productId.trim()) return []

      const nextItem: Record<string, unknown> = { productId: productId.trim() }
      const quantity = Number(row.quantity ?? row.inv_quantity)
      const price = Number(row.price ?? row.unitPrice)
      const revenue = Number(row.revenue)
      const capitalPrice = Number(row.capitalPrice)
      const totalSalary = Number(row.totalSalary)
      const accountingAccountCode = Number(row.accountingAccountCode)

      if (Number.isFinite(quantity)) nextItem.quantity = quantity
      if (Number.isFinite(price)) nextItem.price = price
      if (Number.isFinite(revenue)) nextItem.revenue = revenue
      if (Number.isFinite(capitalPrice)) nextItem.capitalPrice = capitalPrice
      if (Number.isFinite(totalSalary)) nextItem.totalSalary = totalSalary
      if (Number.isFinite(accountingAccountCode)) {
        nextItem.accountingAccountCode = accountingAccountCode
      }

      return [nextItem]
    })

    if (items.length) {
      entries.push(["items", items])
    }
  })

  return Object.fromEntries(entries) as Partial<SaleTransactionPayload>
}

const APICreateSaleTransaction = async (
  data: SaleTransactionPayload
): Promise<SaleTransactionItemResponse> => {
  const response = await axiosInstance.post<
    SaleTransactionItemBody | InvoiceApiRow
  >("/sale-transaction/create", data)

  return {
    data: readInvoiceRow(response.data),
    status: response.status,
  }
}

const APIGetSaleTransactions = async (
  params?: SaleTransactionListParams
): Promise<SaleTransactionListResponse> => {
  const response = await axiosInstance.get<SaleTransactionListBody>(
    "/sale-transaction",
    { params }
  )

  return buildSaleTransactionListResponse(
    response.data,
    response.status,
    params
  )
}

const APIGetAllSaleTransactions = async (
  params?: SaleTransactionListParams
): Promise<SaleTransactionRowsResponse> => {
  const data = await fetchAllPages<InvoiceApiRow, SaleTransactionListParams>(
    APIGetSaleTransactions,
    params
  )

  return { data, status: 200 }
}

const APIGetSaleTransactionStats =
  async (): Promise<SaleTransactionStatsResponse> => {
    const response = await axiosInstance.get<unknown>("/sale-transaction/stats")

    return {
      data: readRecordData(response.data),
      status: response.status,
    }
  }

const APISearchSaleTransactionsByDateRange = async (params: {
  startDate: string
  endDate: string
}): Promise<SaleTransactionRowsResponse> => {
  const response = await axiosInstance.get<SaleTransactionListBody>(
    "/sale-transaction/search/date-range",
    { params }
  )

  return {
    data: readListData(response.data),
    status: response.status,
  }
}

const APIGetSaleTransactionsByEmployee = async (
  employeeId: string
): Promise<SaleTransactionRowsResponse> => {
  const response = await axiosInstance.get<SaleTransactionListBody>(
    `/sale-transaction/by-employee/${employeeId}`
  )

  return {
    data: readListData(response.data),
    status: response.status,
  }
}

const APIGetSaleTransactionsByAgency = async (
  agencyId: string
): Promise<SaleTransactionRowsResponse> => {
  const response = await axiosInstance.get<SaleTransactionListBody>(
    `/sale-transaction/by-agency/${agencyId}`
  )

  return {
    data: readListData(response.data),
    status: response.status,
  }
}

const APIGetSaleTransactionsByDepartment = async (
  departmentId: string
): Promise<SaleTransactionRowsResponse> => {
  const response = await axiosInstance.get<SaleTransactionListBody>(
    `/sale-transaction/by-department/${departmentId}`
  )

  return {
    data: readListData(response.data),
    status: response.status,
  }
}

const APIGetSaleTransactionById = async (
  id: string
): Promise<SaleTransactionItemResponse> => {
  const response = await axiosInstance.get<
    SaleTransactionItemBody | InvoiceApiRow
  >(`/sale-transaction/${id}`)

  return {
    data: readInvoiceRow(response.data),
    status: response.status,
  }
}

const APIUpdateSaleTransaction = async (
  id: string,
  data: SaleTransactionPayload
): Promise<SaleTransactionItemResponse> => {
  const updatePayload = buildUpdateSaleTransactionPayload(data)

  const response = await axiosInstance.patch<
    SaleTransactionItemBody | InvoiceApiRow
  >(`/sale-transaction/${id}`, updatePayload)

  return {
    data: readInvoiceRow(response.data),
    status: response.status,
  }
}

const APIUpdateSaleTransactionBank = async (
  id: string,
  payload: UpdateSaleTransactionBankPayload
): Promise<SaleTransactionItemResponse> => {
  const response = await axiosInstance.patch<
    SaleTransactionItemBody | InvoiceApiRow
  >(`/sale-transaction/${id}/mark-paid`, payload)

  return {
    data: readInvoiceRow(response.data),
    status: response.status,
  }
}

const APIDeleteSaleTransaction = async (
  id: string
): Promise<SaleTransactionItemResponse> => {
  const response = await axiosInstance.delete<
    SaleTransactionItemBody | InvoiceApiRow | null
  >(`/sale-transaction/${id}`)

  if (response.status === 204) {
    return { data: null, status: 204 }
  }

  return {
    data: readInvoiceRow(response.data),
    status: response.status,
  }
}

const APIExportSaleTransactionReport = async (
  params?: SaleTransactionReportExportParams
) => {
  return axiosInstance.get("/sale-transaction/report/export", {
    params: cleanParams(params),
    responseType: "blob",
  })
}

const APISendSaleTransactionReceipt = async (
  id: string
): Promise<SaleTransactionItemResponse> => {
  const response = await axiosInstance.post<
    SaleTransactionItemBody | InvoiceApiRow
  >(`/sale-transaction/${id}/send-receipt`)

  return {
    data: readInvoiceRow(response.data),
    status: response.status,
  }
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
