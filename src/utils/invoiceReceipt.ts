/* eslint-disable @typescript-eslint/no-explicit-any */

import { Bank } from "@/types/bank"
import {
  InvoiceApiRow,
  InvoicePaymentStatus,
  InvoiceStatus,
} from "@/types/invoice"
import { ReceiptInvoiceConfig } from "@/types/receiptInvoice"
import {
  FIXED_RECEIPT_INVOICE_CONFIG,
  getFixedReceiptInvoiceConfigs,
  getId,
  toNumber,
} from "./invoiceCore"

export function getExportInvoiceId(invoice?: InvoiceApiRow | null) {
  if (!invoice) return ""

  const row = invoice as any

  return String(
    row?.inv_invoiceCreatedId ||
      row?.hoadon68_id ||
      row?.inv_invoiceAuth_id ||
      row?.inv_originalId ||
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

export function canStartInvoiceExport(status?: InvoiceStatusValue | null) {
  return status === InvoiceStatus.DRAFT || status === InvoiceStatus.FAILED
}

export function getInvoiceStatus(
  invoice?: InvoiceApiRow | null
): InvoiceStatusValue {
  const normalizedStatus = normalizeInvoiceStatusValue(
    (invoice as any)?.invoiceStatus
  )

  if (normalizedStatus) return normalizedStatus

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

  return String(row?.tax_code || fallbackTaxCode || "").trim()
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
function getPdfFileBaseUrl() {
  const apiUrl = String(process.env.NEXT_PUBLIC_API_URL || "").trim()

  if (!apiUrl) return ""

  try {
    return new URL(apiUrl).origin
  } catch {
    return apiUrl.replace(/\/api\/?$/i, "").replace(/\/+$/, "")
  }
}

function buildPdfFileUrlFromApiBase(filePath: string) {
  const normalizedPath = `/${filePath.replace(/^\/+/, "")}`
  const baseUrl = getPdfFileBaseUrl()

  return baseUrl ? `${baseUrl}${normalizedPath}` : normalizedPath
}

export function buildPdfFileUrl(filePath: string) {
  const rawFilePath = String(filePath || "").trim()

  if (!rawFilePath) return ""

  if (/^https?:\/\//i.test(rawFilePath)) {
    return rawFilePath
  }

  if (/^\/?files\//i.test(rawFilePath)) {
    return buildPdfFileUrlFromApiBase(rawFilePath)
  }

  return `/${rawFilePath.replace(/^\//, "")}`
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
