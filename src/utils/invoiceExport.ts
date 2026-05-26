import { InvoiceApiRow, InvoiceStatus } from "@/types/invoice"
import {
  getExportInvoiceId,
  getInvoiceExportData,
  getInvoiceStatus,
} from "./invoice"

export type InvoiceExportContext = {
  saleTransactionId: string
  invoiceSeries: string
  taxCode: string
  invoiceIssuedDate?: string
}

export type InvoiceExportResolution = {
  status: InvoiceStatus.ISSUED | InvoiceStatus.ISSUING | InvoiceStatus.FAILED
  exportData: Record<string, any>
  exportInvoiceId: string
  message: string
}

function normalizeMessage(message: unknown) {
  return String(message || "").trim()
}

function normalizeSearchText(value: unknown) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
}

function getInvoiceExportStatusCode(source: any) {
  const candidates = [
    source?.statusCode,
    source?.code,
    source?.response?.status,
    source?.response?.data?.statusCode,
    source?.response?.data?.code,
    source?.data?.statusCode,
    source?.data?.code,
  ]

  for (const candidate of candidates) {
    const value = Number(candidate)

    if (Number.isFinite(value)) {
      return value
    }
  }

  return null
}

function buildExportData(value: any, context: InvoiceExportContext) {
  const source =
    value && typeof value === "object" && !Array.isArray(value) ? value : {}

  return {
    ...source,
    saleTransactionId:
      source.saleTransactionId ||
      source.transactionId ||
      context.saleTransactionId,
    inv_invoiceSeries: String(
      source.inv_invoiceSeries || context.invoiceSeries || ""
    ).trim(),
    tax_code: String(source.tax_code || context.taxCode || "").trim(),
  }
}

export function getInvoiceExportMessage(source: any, fallback: string) {
  return (
    normalizeMessage(source?.message) ||
    normalizeMessage(source?.error) ||
    normalizeMessage(source?.data?.message) ||
    normalizeMessage(source?.data?.error) ||
    normalizeMessage(source?.response?.data?.message) ||
    normalizeMessage(source?.response?.data?.error) ||
    fallback
  )
}

export function isInvoiceAlreadyBeingIssuedError(error: any) {
  const message = normalizeSearchText(getInvoiceExportMessage(error, ""))

  return Boolean(
    message &&
      (message.includes("already being issued") ||
        message.includes("dang duoc xuat") ||
        message.includes("dang xuat hoa don") ||
        message.includes("dang duoc phat hanh") ||
        message.includes("dang phat hanh"))
  )
}

export function isInvoiceExportRateLimitedError(error: any) {
  if (getInvoiceExportStatusCode(error) === 429) {
    return true
  }

  const message = normalizeSearchText(getInvoiceExportMessage(error, ""))

  return Boolean(message && message.includes("too many requests"))
}

export function getInvoiceExportRateLimitedMessage(
  error: any,
  fallback: string
) {
  const message = getInvoiceExportMessage(error, "")
  const normalizedMessage = normalizeSearchText(message)

  if (!message || normalizedMessage.includes("too many requests")) {
    return fallback
  }

  return message
}

export function resolveInvoiceExportResult(
  source: any,
  context: InvoiceExportContext
): InvoiceExportResolution {
  const exportData = buildExportData(getInvoiceExportData(source), context)
  const exportInvoiceId = getExportInvoiceId(exportData)
  const derivedStatus = getInvoiceStatus({
    _id: context.saleTransactionId,
    invoiceStatus:
      exportData?.invoiceStatus || exportData?.info || exportData?.status,
    exportInvoiceData: exportData,
    inv_invoiceCreatedId: exportInvoiceId || undefined,
    jobId: exportData?.jobId || null,
  } as InvoiceApiRow)

  if (exportInvoiceId || derivedStatus === InvoiceStatus.ISSUED) {
    return {
      status: InvoiceStatus.ISSUED,
      exportData: {
        ...exportData,
        id: exportInvoiceId || exportData?.id,
        inv_invoiceCreatedId:
          exportInvoiceId || exportData?.inv_invoiceCreatedId,
        invoiceStatus: InvoiceStatus.ISSUED,
      },
      exportInvoiceId,
      message: getInvoiceExportMessage(source, "Xuất hóa đơn thành công."),
    }
  }

  if (derivedStatus === InvoiceStatus.ISSUING) {
    return {
      status: InvoiceStatus.ISSUING,
      exportData: {
        ...exportData,
        invoiceStatus: InvoiceStatus.ISSUING,
      },
      exportInvoiceId: "",
      message: getInvoiceExportMessage(
        source,
        "Đã gửi yêu cầu xuất hóa đơn. Hệ thống đang xử lý."
      ),
    }
  }

  return {
    status: InvoiceStatus.FAILED,
    exportData: {
      ...exportData,
      invoiceStatus: InvoiceStatus.FAILED,
    },
    exportInvoiceId: "",
    message: getInvoiceExportMessage(source, "Xuất hóa đơn thất bại."),
  }
}

export function createAlreadyIssuingResolution(
  error: any,
  context: InvoiceExportContext
): InvoiceExportResolution {
  const exportData = buildExportData(
    getInvoiceExportData(error?.response?.data),
    context
  )

  return {
    status: InvoiceStatus.ISSUING,
    exportData: {
      ...exportData,
      invoiceStatus: InvoiceStatus.ISSUING,
      status: InvoiceStatus.ISSUING,
      info: InvoiceStatus.ISSUING,
    },
    exportInvoiceId: "",
    message: getInvoiceExportMessage(
      error,
      "Hóa đơn đang được phát hành. Vui lòng chờ hệ thống xử lý xong."
    ),
  }
}

export function createInvoiceExportFailureResolution(
  source: any,
  context: InvoiceExportContext,
  fallbackMessage = "Xuất hóa đơn thất bại."
): InvoiceExportResolution {
  const exportData = buildExportData(
    getInvoiceExportData(source?.response?.data || source?.data || source),
    context
  )

  return {
    status: InvoiceStatus.FAILED,
    exportData: {
      ...exportData,
      invoiceStatus: InvoiceStatus.FAILED,
      status: InvoiceStatus.FAILED,
      info: InvoiceStatus.FAILED,
    },
    exportInvoiceId: "",
    message: getInvoiceExportMessage(source, fallbackMessage),
  }
}

export function createRateLimitedResolution(
  error: any,
  context: InvoiceExportContext,
  fallbackMessage = "Hệ thống trả về 429 khi xuất hóa đơn."
): InvoiceExportResolution {
  const resolution = createInvoiceExportFailureResolution(
    error,
    context,
    getInvoiceExportRateLimitedMessage(error, fallbackMessage)
  )

  return {
    ...resolution,
    exportData: {
      ...resolution.exportData,
      code: 429,
      statusCode: 429,
    },
  }
}

export function applyInvoiceExportResolutionToRow(
  row: InvoiceApiRow,
  resolution: InvoiceExportResolution
): InvoiceApiRow {
  const mergedExportData = {
    ...(row.exportInvoiceData || {}),
    ...resolution.exportData,
    invoiceStatus: resolution.status,
  }

  return {
    ...row,
    inv_invoiceSeries:
      resolution.exportData?.inv_invoiceSeries || row.inv_invoiceSeries,
    inv_invoiceCreatedId:
      resolution.exportInvoiceId || row.inv_invoiceCreatedId || "",
    exportInvoiceData: mergedExportData,
    invoiceStatus: resolution.status,
    jobId:
      resolution.status === InvoiceStatus.ISSUING
        ? String(resolution.exportData?.jobId || row.jobId || "").trim() || null
        : null,
    updatedAt: new Date().toISOString(),
  }
}
