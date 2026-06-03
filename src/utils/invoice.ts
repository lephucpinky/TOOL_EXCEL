import { Bank } from "@/types/bank"
import {
  InvoiceApiRow,
  InvoicePaymentStatus,
  InvoiceStatus,
} from "@/types/invoice"
import { ReceiptInvoiceConfig } from "@/types/receiptInvoice"

export const FIXED_RECEIPT_INVOICE_CONFIG: ReceiptInvoiceConfig = {
  _id: "fixed-receipt-config-1c26mzz",
  inv_invoiceSeries: "1C26MZZ",
  tax_code: "0106026495-999",
  description: "MST: 0106026495-999",
}

export function getFixedReceiptInvoiceConfig(): ReceiptInvoiceConfig {
  return { ...FIXED_RECEIPT_INVOICE_CONFIG }
}

export function getFixedReceiptInvoiceConfigs(): ReceiptInvoiceConfig[] {
  return [getFixedReceiptInvoiceConfig()]
}

export const inputClass =
  "h-8 w-full rounded border border-slate-300 bg-white px-2 text-[13px] text-slate-800 outline-none focus:border-indigo-500 disabled:bg-slate-100"

export function toNumber(value: unknown) {
  const numberValue = Number(value)
  return Number.isFinite(numberValue) ? numberValue : 0
}

export function formatMoney(value: unknown) {
  return new Intl.NumberFormat("vi-VN").format(toNumber(value))
}

export function roundInvoiceMoney(value: unknown) {
  const numberValue = Number(value)
  if (!Number.isFinite(numberValue)) return 0

  return Math.round(numberValue * 100) / 100
}

export function getId(value: any) {
  if (!value) return ""
  if (typeof value === "string") return value
  return value._id || value.id || ""
}

export function resolveOption<T extends { _id?: string }>(
  list: T[],
  value: any
): T | null {
  if (!value) return null

  if (typeof value === "object") {
    return value as T
  }

  const id = getId(value)

  if (!id) return null

  return list.find((item) => item._id === id) || null
}

export function mergeOptions<T extends { _id?: string }>(
  base: T[],
  selectedItems: Array<T | null | undefined>
) {
  const result: T[] = []
  const seen = new Set<string>()

  selectedItems.forEach((item) => {
    const id = getId(item)
    if (!id || seen.has(id)) return

    seen.add(id)
    result.push(item as T)
  })

  base.forEach((item) => {
    const id = getId(item)
    if (!id || seen.has(id)) return

    seen.add(id)
    result.push(item)
  })

  return result
}

export function createItemId() {
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`
}

export function normalizeDateInput(value?: string) {
  if (!value) return ""

  const textValue = String(value).trim()

  const yyyymmdd = textValue.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/)
  if (yyyymmdd) {
    const year = yyyymmdd[1]
    const month = yyyymmdd[2].padStart(2, "0")
    const day = yyyymmdd[3].padStart(2, "0")

    return `${year}-${month}-${day}`
  }

  const slashDate = textValue.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/)
  if (slashDate) {
    const first = Number(slashDate[1])
    const second = Number(slashDate[2])
    const year = slashDate[3]

    let day = first
    let month = second

    if (first <= 12 && second > 12) {
      month = first
      day = second
    }

    return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(
      2,
      "0"
    )}`
  }

  const date = new Date(textValue)
  if (!Number.isNaN(date.getTime())) {
    return date.toISOString().slice(0, 10)
  }

  return ""
}

export function numberToVietnamese(value: number) {
  const number = Math.round(Number.isFinite(value) ? value : 0)

  if (number === 0) return "Không đồng"

  const digitText = [
    "không",
    "một",
    "hai",
    "ba",
    "bốn",
    "năm",
    "sáu",
    "bảy",
    "tám",
    "chín",
  ]

  const unitText = ["", "nghìn", "triệu", "tỷ"]

  function readThreeDigits(num: number, full: boolean) {
    const hundred = Math.floor(num / 100)
    const ten = Math.floor((num % 100) / 10)
    const unit = num % 10
    let result = ""

    if (hundred > 0 || full) {
      result += `${digitText[hundred]} trăm`
      if (ten === 0 && unit > 0) result += " lẻ"
    }

    if (ten > 1) {
      result += `${result ? " " : ""}${digitText[ten]} mươi`
      if (unit === 1) result += " một"
      else if (unit === 5) result += " lăm"
      else if (unit > 0) result += ` ${digitText[unit]}`
    } else if (ten === 1) {
      result += `${result ? " " : ""}mười`
      if (unit === 5) result += " lăm"
      else if (unit > 0) result += ` ${digitText[unit]}`
    } else if (unit > 0) {
      result += `${result ? " " : ""}${digitText[unit]}`
    }

    return result
  }

  const groups: number[] = []
  let temp = number

  while (temp > 0) {
    groups.push(temp % 1000)
    temp = Math.floor(temp / 1000)
  }

  const parts: string[] = []

  for (let i = groups.length - 1; i >= 0; i--) {
    const group = groups[i]
    if (group === 0) continue

    const full = i < groups.length - 1 && group < 100
    const text = readThreeDigits(group, full)
    const unit = unitText[i] ?? ""

    parts.push(`${text}${unit ? ` ${unit}` : ""}`)
  }

  const sentence = parts.join(" ").replace(/\s+/g, " ").trim()
  return `${sentence.charAt(0).toUpperCase()}${sentence.slice(1)} đồng`
}

export function getInvoiceExportData(value: any) {
  return (
    value?.content?.data ||
    value?.content ||
    value?.data?.data ||
    value?.data ||
    value?.response?.data?.content?.data ||
    value?.response?.data?.content ||
    value?.response?.data?.data?.data ||
    value?.response?.data?.data ||
    value?.response?.data ||
    value?.exportInvoiceData?.data ||
    value?.exportInvoiceData ||
    value ||
    null
  )
}

export function getExportInvoiceId(invoice?: InvoiceApiRow | null) {
  if (!invoice) return ""

  const row = getInvoiceExportData(invoice)

  return String(
    row?.inv_invoiceCreatedId ||
      row?.id ||
      row?.hoadon68_id ||
      row?.inv_invoiceAuth_id ||
      row?.inv_originalId ||
      (invoice as any)?.inv_invoiceCreatedId ||
      (invoice as any)?.id ||
      (invoice as any)?.hoadon68_id ||
      (invoice as any)?.inv_invoiceAuth_id ||
      (invoice as any)?.inv_originalId ||
      row?.exportInvoiceData?.id ||
      row?.exportInvoiceData?.data?.id ||
      row?.data?.id ||
      ""
  ).trim()
}

const ISSUING_STATUS_SET = new Set([
  "ISSUING",
  "PROCESSING",
  "PENDING",
  "IN_PROGRESS",
  "INPROGRESS",
  "QUEUED",
  "ACTIVE",
  "WAITING",
  "DELAYED",
  "RUNNING",
])

const ISSUED_STATUS_SET = new Set([
  "ISSUED",
  "SUCCESS",
  "SUCCEEDED",
  "COMPLETED",
  "DONE",
])

const FAILED_STATUS_SET = new Set(["FAILED", "FAIL", "ERROR", "REJECTED"])
const CANCELLED_STATUS_SET = new Set(["CANCELLED", "CANCELED", "VOID"])

export type InvoiceStatusValue = InvoiceStatus

export function normalizeInvoiceStatusValue(
  value?: unknown
): InvoiceStatusValue | null {
  const status = String(value || "")
    .trim()
    .toUpperCase()

  if (!status) return null
  if (CANCELLED_STATUS_SET.has(status)) return InvoiceStatus.CANCELLED
  if (ISSUED_STATUS_SET.has(status)) return InvoiceStatus.ISSUED
  if (ISSUING_STATUS_SET.has(status)) return InvoiceStatus.ISSUING
  if (FAILED_STATUS_SET.has(status)) return InvoiceStatus.FAILED
  if (status === InvoiceStatus.DRAFT) return InvoiceStatus.DRAFT

  return null
}

export function isInvoiceExportIssuing(value?: any) {
  if (!value || getExportInvoiceId(value as InvoiceApiRow | null)) return false

  const exportData = getInvoiceExportData(value)
  const status = normalizeInvoiceStatusValue(
    exportData?.invoiceStatus ||
      exportData?.info ||
      exportData?.status ||
      value?.invoiceStatus ||
      value?.status
  )
  const code = Number(
    exportData?.code ??
      exportData?.statusCode ??
      value?.code ??
      value?.statusCode ??
      NaN
  )

  return Boolean(
    status === InvoiceStatus.ISSUING ||
      code === 202 ||
      exportData?.jobId ||
      value?.jobId
  )
}

export const isInvoiceExportProcessing = isInvoiceExportIssuing

export function canStartInvoiceExport(status?: InvoiceStatusValue | null) {
  return status === InvoiceStatus.DRAFT || status === InvoiceStatus.FAILED
}

export function getInvoiceStatus(
  invoice?: InvoiceApiRow | null
): InvoiceStatusValue {
  const exportData = getInvoiceExportData(invoice)
  const normalizedStatuses = [
    (invoice as any)?.invoiceStatus,
    exportData?.invoiceStatus,
    exportData?.info,
    exportData?.status,
  ]
    .map(normalizeInvoiceStatusValue)
    .filter((status): status is InvoiceStatusValue => Boolean(status))
  const normalizedStatus =
    normalizedStatuses.find(
      (status) =>
        status === InvoiceStatus.CANCELLED || status === InvoiceStatus.FAILED
    ) ||
    normalizedStatuses[0] ||
    null

  if (
    normalizedStatus === InvoiceStatus.CANCELLED ||
    normalizedStatus === InvoiceStatus.FAILED
  ) {
    return normalizedStatus
  }

  if (getExportInvoiceId(invoice)) return InvoiceStatus.ISSUED
  if (normalizedStatus) return normalizedStatus
  if (isInvoiceExportIssuing(invoice)) return InvoiceStatus.ISSUING

  return InvoiceStatus.DRAFT
}

export const invoiceStatusLabel: Record<InvoiceStatusValue, string> = {
  [InvoiceStatus.DRAFT]: "Nháp",
  [InvoiceStatus.ISSUING]: "Đang xuất hóa đơn",
  [InvoiceStatus.ISSUED]: "Đã xuất hóa đơn",
  [InvoiceStatus.FAILED]: "Xuất thất bại",
  [InvoiceStatus.CANCELLED]: "Đã hủy",
}

export const invoiceStatusClass: Record<InvoiceStatusValue, string> = {
  [InvoiceStatus.DRAFT]: "border-amber-200 bg-amber-50 text-amber-700",
  [InvoiceStatus.ISSUING]: "border-blue-200 bg-blue-50 text-blue-700",
  [InvoiceStatus.ISSUED]: "border-emerald-200 bg-emerald-50 text-emerald-700",
  [InvoiceStatus.FAILED]: "border-rose-200 bg-rose-50 text-rose-700",
  [InvoiceStatus.CANCELLED]: "border-red-200 bg-red-50 text-red-700",
}

// Chuẩn hóa response nhiều dạng từ service về đúng mảng InvoiceApiRow.
export function normalizeSaleTransactionList(response: any): InvoiceApiRow[] {
  const raw = response?.data ?? []

  const list = Array.isArray(raw)
    ? raw
    : Array.isArray(raw?.items)
      ? raw.items
      : Array.isArray(raw?.docs)
        ? raw.docs
        : Array.isArray(raw?.results)
          ? raw.results
          : Array.isArray(raw?.saleTransactions)
            ? raw.saleTransactions
            : Array.isArray(raw?.transactions)
              ? raw.transactions
              : []

  return list.filter((item: any) => item?._id)
}

export function formatReceiptConfigLabel(config: ReceiptInvoiceConfig) {
  const invoiceSeries = String(config.inv_invoiceSeries || "").trim()
  const description = String(config.description || "").trim()

  if (invoiceSeries && description) {
    return `${invoiceSeries} - ${description}`
  }

  return invoiceSeries || description || "Cấu hình hóa đơn chưa hoàn chỉnh"
}

export function getInvoiceSellerTaxCode(
  invoice: InvoiceApiRow,
  fallbackTaxCode = ""
) {
  const row = invoice as any

  return String(
    row?.exportInvoiceData?.tax_code ||
      row?.exportInvoiceData?.data?.tax_code ||
      row?.content?.tax_code ||
      row?.tax_code ||
      fallbackTaxCode ||
      ""
  ).trim()
}

export function isInvoiceMatchedReceiptConfig(
  invoice: InvoiceApiRow,
  config?: ReceiptInvoiceConfig | null
) {
  if (!config) return true

  const invoiceSeries = String(invoice.inv_invoiceSeries || "").trim()
  const invoiceTaxCode = getInvoiceSellerTaxCode(invoice)
  const configSeries = String(config.inv_invoiceSeries || "").trim()
  const configTaxCode = String(config.tax_code || "").trim()

  const sameSeries = configSeries && invoiceSeries === configSeries
  const sameTaxCode = configTaxCode && invoiceTaxCode === configTaxCode

  if (configSeries && invoiceSeries) {
    return Boolean(
      sameSeries && (!configTaxCode || !invoiceTaxCode || sameTaxCode)
    )
  }

  return Boolean(sameTaxCode)
}

export function findReceiptConfigByValue(
  receiptConfigs: ReceiptInvoiceConfig[],
  value: string
) {
  if (!value) return null

  return (
    receiptConfigs.find(
      (config, index) => getReceiptConfigOptionValue(config, index) === value
    ) || null
  )
}

export function normalizeReceiptInvoiceList(
  _response: any
): ReceiptInvoiceConfig[] {
  return getFixedReceiptInvoiceConfigs()
}

export function normalizeBankList(response: any): Bank[] {
  const raw = response?.data ?? []

  const list = Array.isArray(raw)
    ? raw
    : Array.isArray(raw?.items)
      ? raw.items
      : Array.isArray(raw?.docs)
        ? raw.docs
        : Array.isArray(raw?.results)
          ? raw.results
          : Array.isArray(raw?.banks)
            ? raw.banks
            : raw
              ? [raw]
              : []

  return list.filter((item: any) => item?._id)
}

export function getReceiptConfigOptionValue(
  config: ReceiptInvoiceConfig,
  index: number
) {
  return (
    getId(config) ||
    [config.inv_invoiceSeries, config.tax_code].filter(Boolean).join("::") ||
    `receipt-config-${index}`
  )
}

export function getFixedReceiptConfigOptionValue() {
  return getReceiptConfigOptionValue(FIXED_RECEIPT_INVOICE_CONFIG, 0)
}
export function buildPdfFileUrl(filePath: string) {
  if (!filePath) return ""

  if (/^https?:\/\//i.test(filePath)) {
    return filePath
  }

  return `/${filePath.replace(/^\//, "")}`
}

export function formatPaymentAmountInput(value: any) {
  const numberValue = toNumber(value)

  if (numberValue <= 0) return ""

  return new Intl.NumberFormat("vi-VN").format(numberValue)
}

export function parsePaymentAmountInput(value: string) {
  const digits = String(value || "").replace(/[^\d]/g, "")

  return digits ? Number(digits) : 0
}

export function getInvoiceAmountCollected(invoice?: InvoiceApiRow | null) {
  if (!invoice) return 0

  const amountCollected = toNumber((invoice as any).amountCollected)
  if (amountCollected > 0) return amountCollected

  const paidAmount = toNumber((invoice as any).paidAmount)
  if (paidAmount > 0) return paidAmount

  const totalAmount = toNumber(invoice.inv_TotalAmount)
  if (
    totalAmount > 0 &&
    (invoice.isPaid === true ||
      invoice.paymentStatus === InvoicePaymentStatus.PAID)
  ) {
    return totalAmount
  }

  return 0
}

export function getInvoiceRemainingAmount(invoice?: InvoiceApiRow | null) {
  if (!invoice) return 0

  const totalAmount = toNumber(invoice.inv_TotalAmount)
  const amountCollected = getInvoiceAmountCollected(invoice)

  return Math.max(totalAmount - amountCollected, 0)
}

export function normalizeSaleTransactionDetail(
  response: any
): InvoiceApiRow | null {
  const detail = response?.data ?? null

  return detail?._id ? detail : null
}

function preferDisplayValue(
  serverValue: any,
  clientValue: any,
  fallbackValue?: any
) {
  if (serverValue && typeof serverValue === "object") return serverValue
  if (clientValue && typeof clientValue === "object") return clientValue
  return serverValue ?? clientValue ?? fallbackValue
}

function preferClientDisplayValue(
  serverValue: any,
  clientValue: any,
  fallbackValue?: any
) {
  if (clientValue && typeof clientValue === "object") return clientValue
  if (fallbackValue && typeof fallbackValue === "object") return fallbackValue
  if (serverValue && typeof serverValue === "object") return serverValue
  return clientValue ?? fallbackValue ?? serverValue
}

function buildClientItems(payload: any) {
  const items = Array.isArray(payload?.items) ? payload.items : []

  return items.map((item: any) => ({
    productId: item.product || item.productId || null,
    product: item.product || item.productId || null,
    quantity: toNumber(item.quantity ?? item.inv_quantity ?? 0),
    inv_quantity: toNumber(item.inv_quantity ?? item.quantity ?? 0),
    revenue: toNumber(item.revenue),
    capitalPrice: toNumber(item.capitalPrice),
    totalSalary: toNumber(item.totalSalary),
    accountingAccountCode: Number(item.accountingAccountCode || 0),
  }))
}

export function hydrateSaleTransactionDetail(
  detail: InvoiceApiRow,
  payload?: any,
  fallback?: InvoiceApiRow | null
): InvoiceApiRow {
  // Backend có thể trả id thay vì object, nên giữ lại dữ liệu hiển thị đã có ở client.
  const clientSnapshot = payload?.__clientSnapshot || {}
  const clientPayment = payload?.__clientPayment || {}
  const clientItems = buildClientItems(payload)

  const mergedItems =
    Array.isArray(detail?.items) && detail.items.length
      ? detail.items.map((item: any, index: number) => {
          const clientItem = clientItems[index]
          const fallbackItem = fallback?.items?.[index] as any

          return {
            ...item,
            productId: preferDisplayValue(
              item?.productId,
              clientItem?.productId,
              fallbackItem?.productId
            ),
            product: preferDisplayValue(
              item?.product,
              clientItem?.product,
              fallbackItem?.product
            ),
            quantity:
              item?.quantity ??
              item?.inv_quantity ??
              clientItem?.quantity ??
              fallbackItem?.quantity,
            inv_quantity:
              item?.inv_quantity ??
              item?.quantity ??
              clientItem?.inv_quantity ??
              fallbackItem?.inv_quantity,
          }
        })
      : clientItems.length
        ? clientItems
        : fallback?.items || []

  const totalItemQuantity = mergedItems.reduce((sum: number, item: any) => {
    return sum + toNumber(item?.inv_quantity ?? item?.quantity ?? 0)
  }, 0)

  const detailTotalAmount = toNumber(detail.inv_TotalAmount)
  const payloadTotalAmount = toNumber(payload?.inv_TotalAmount)
  const fallbackTotalAmount = toNumber(fallback?.inv_TotalAmount)

  // Detail API có trường hợp trả inv_TotalAmount = 0 khi xem chi tiết,
  // nên ưu tiên số > 0 để không làm mất tổng tiền thật trên bảng.
  const totalAmount =
    detailTotalAmount > 0
      ? detailTotalAmount
      : payloadTotalAmount > 0
        ? payloadTotalAmount
        : fallbackTotalAmount

  const detailAmountCollected = toNumber(detail.amountCollected)
  const detailPaidAmount = toNumber(detail.paidAmount)
  const clientAmountCollected = toNumber(clientPayment.amountCollected)
  const clientPaidAmount = toNumber(clientPayment.paidAmount)
  const payloadAmountCollected = toNumber(payload?.amountCollected)
  const payloadPaidAmount = toNumber(payload?.paidAmount)
  const fallbackAmountCollected = toNumber(fallback?.amountCollected)
  const fallbackPaidAmount = toNumber(fallback?.paidAmount)

  const amountCollected =
    detailAmountCollected > 0
      ? detailAmountCollected
      : detailPaidAmount > 0
        ? detailPaidAmount
        : clientAmountCollected > 0
          ? clientAmountCollected
          : clientPaidAmount > 0
            ? clientPaidAmount
            : payloadAmountCollected > 0
              ? payloadAmountCollected
              : payloadPaidAmount > 0
                ? payloadPaidAmount
                : fallbackAmountCollected > 0
                  ? fallbackAmountCollected
                  : fallbackPaidAmount > 0
                    ? fallbackPaidAmount
                    : totalAmount > 0 &&
                        (detail.isPaid === true ||
                          detail.paymentStatus === InvoicePaymentStatus.PAID ||
                          fallback?.isPaid === true ||
                          fallback?.paymentStatus ===
                            InvoicePaymentStatus.PAID)
                      ? totalAmount
                      : 0

  const remainingAmount = Math.max(totalAmount - amountCollected, 0)
  const paymentStatus =
    totalAmount > 0 && amountCollected >= totalAmount
      ? InvoicePaymentStatus.PAID
      : amountCollected > 0
        ? InvoicePaymentStatus.PARTIAL
        : InvoicePaymentStatus.UNPAID

  return {
    ...(fallback || {}),
    ...detail,
    // activationDate:
    //   detail.activationDate ??
    //   payload?.activationDate ??
    //   fallback?.activationDate,
    agencyId: preferDisplayValue(
      detail.agencyId,
      clientSnapshot.agency,
      fallback?.agencyId
    ),
    departmentId: preferClientDisplayValue(
      detail.departmentId,
      clientSnapshot.department,
      fallback?.departmentId
    ),
    employeeId: preferDisplayValue(
      detail.employeeId,
      clientSnapshot.employee,
      fallback?.employeeId
    ),
    bankId: preferDisplayValue(
      detail.bankId,
      clientSnapshot.bank,
      fallback?.bankId
    ),
    inv_buyerBankName:
      detail.inv_buyerBankName ||
      clientSnapshot.bank?.inv_buyerBankName ||
      fallback?.inv_buyerBankName ||
      payload?.inv_buyerBankName ||
      "",
    inv_quantity: toNumber(
      detail.inv_quantity ??
        payload?.inv_quantity ??
        fallback?.inv_quantity ??
        totalItemQuantity
    ),
    items: mergedItems,
    isPaid:
      detail.isPaid ??
      clientPayment.isPaid ??
      fallback?.isPaid ??
      (totalAmount > 0 && amountCollected >= totalAmount),
    paymentStatus,

    amountCollected,

    // Giữ paidAmount như field mirror để những form cũ không bị vỡ UI,
    // nhưng toàn bộ logic tính toán chỉ đọc amountCollected.
    paidAmount: amountCollected,

    remainingAmount,

    paidDate:
      detail.paidDate ?? clientPayment.paidDate ?? fallback?.paidDate ?? "",

    paymentDate:
      detail.paymentDate ??
      clientPayment.paymentDate ??
      fallback?.paymentDate ??
      "",
  }
}
