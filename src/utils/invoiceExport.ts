import { InvoiceApiRow, InvoiceStatus } from "@/types/invoice"
import {
  getExportInvoiceId,
  getInvoiceExportData,
  getInvoiceStatus,
  invoiceStatusLabel,
  normalizeInvoiceStatusValue,
} from "./invoice"

export type InvoiceExportContext = {
  saleTransactionId: string
  invoiceSeries: string
  taxCode: string
  invoiceIssuedDate?: string
}

export type InvoiceExportResolution = {
  status:
    | InvoiceStatus.ISSUED
    | InvoiceStatus.ISSUING
    | InvoiceStatus.FAILED
    | InvoiceStatus.CANCELLED
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

function getInvoiceExportTextField(source: any, field: string) {
  const exportData = getInvoiceExportData(source)

  return normalizeMessage(
    exportData?.[field] ||
      source?.[field] ||
      source?.content?.[field] ||
      source?.content?.data?.[field] ||
      source?.data?.[field] ||
      source?.data?.data?.[field] ||
      source?.response?.data?.[field] ||
      source?.response?.data?.content?.[field] ||
      source?.response?.data?.content?.data?.[field] ||
      source?.response?.data?.data?.[field] ||
      source?.response?.data?.data?.data?.[field] ||
      source?.exportInvoiceData?.[field] ||
      source?.exportInvoiceData?.data?.[field]
  )
}

function getInvoiceExportFailureMessage(source: any, fallback: string) {
  const invoiceErrorMessage = getInvoiceExportTextField(
    source,
    "invoiceErrorMessage"
  )

  if (invoiceErrorMessage) return invoiceErrorMessage

  const message = getInvoiceExportMessage(source, "")

  if (
    message &&
    !normalizeSearchText(message).includes(
      "invoice job status fetched successfully"
    )
  ) {
    return message
  }

  return (
    getInvoiceExportTextField(source, "failedReason") ||
    getInvoiceExportTextField(source, "rawFailedReason") ||
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

function getBooleanFlag(value: unknown) {
  return value === true || String(value || "").toLowerCase() === "true"
}

function getInvoiceExportDerivedStatus(
  exportData: Record<string, any>,
  context: InvoiceExportContext,
  exportInvoiceId: string
) {
  if (
    getBooleanFlag(exportData?.isFailed) ||
    exportData?.invoiceErrorMessage ||
    exportData?.failedReason
  ) {
    return InvoiceStatus.FAILED
  }

  const explicitStatus = normalizeInvoiceStatusValue(exportData?.invoiceStatus)
  if (explicitStatus) return explicitStatus

  if (getBooleanFlag(exportData?.isProcessing)) {
    return InvoiceStatus.ISSUING
  }

  const jobStateStatus = normalizeInvoiceStatusValue(exportData?.jobState)
  if (jobStateStatus) return jobStateStatus

  if (getBooleanFlag(exportData?.isSuccess)) {
    return InvoiceStatus.ISSUED
  }

  if (exportData?.jobId && !exportInvoiceId) {
    return InvoiceStatus.ISSUING
  }

  return getInvoiceStatus({
    _id: context.saleTransactionId,
    invoiceStatus:
      exportData?.invoiceStatus || exportData?.info || exportData?.status,
    exportInvoiceData: exportData,
    inv_invoiceCreatedId: exportInvoiceId || undefined,
    jobId: exportData?.jobId || null,
  } as InvoiceApiRow)
}

export function getInvoiceExportJobId(source: any) {
  const exportData = getInvoiceExportData(source)

  return String(
    exportData?.jobId ||
      source?.jobId ||
      source?.content?.jobId ||
      source?.content?.data?.jobId ||
      source?.data?.jobId ||
      source?.data?.data?.jobId ||
      source?.exportInvoiceData?.jobId ||
      ""
  ).trim()
}

export type InvoiceJobStatusFetcher = (jobId: string) => Promise<any>

export function resolveInvoiceExportResult(
  source: any,
  context: InvoiceExportContext
): InvoiceExportResolution {
  const exportData = buildExportData(getInvoiceExportData(source), context)
  const exportInvoiceId = getExportInvoiceId(exportData)
  const derivedStatus = getInvoiceExportDerivedStatus(
    exportData,
    context,
    exportInvoiceId
  )

  if (
    derivedStatus === InvoiceStatus.FAILED ||
    derivedStatus === InvoiceStatus.CANCELLED
  ) {
    return {
      status: derivedStatus,
      exportData: {
        ...exportData,
        invoiceStatus: derivedStatus,
      },
      exportInvoiceId: "",
      message: getInvoiceExportFailureMessage(source, "Xuất hóa đơn thất bại."),
    }
  }

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
    message: getInvoiceExportFailureMessage(source, "Xuất hóa đơn thất bại."),
  }
}

export async function resolveInvoiceExportResultWithJobStatus(
  source: any,
  context: InvoiceExportContext,
  fetchJobStatus: InvoiceJobStatusFetcher
): Promise<InvoiceExportResolution> {
  const initialResolution = resolveInvoiceExportResult(source, context)
  const jobId =
    getInvoiceExportJobId(initialResolution.exportData) ||
    getInvoiceExportJobId(source)

  if (!jobId) {
    return initialResolution
  }

  let jobStatusResponse: any

  try {
    jobStatusResponse = await fetchJobStatus(jobId)
  } catch {
    return initialResolution
  }

  const jobResolution = resolveInvoiceExportResult(jobStatusResponse, context)

  const mergedExportData = {
    ...initialResolution.exportData,
    ...getInvoiceExportData(jobStatusResponse),
    ...jobResolution.exportData,
    jobId,
  }

  const invoiceErrorMessage =
    getInvoiceExportTextField(mergedExportData, "invoiceErrorMessage") ||
    getInvoiceExportTextField(jobStatusResponse, "invoiceErrorMessage") ||
    getInvoiceExportTextField(jobResolution, "invoiceErrorMessage")

  return {
    ...jobResolution,
    exportData: mergedExportData,
    exportInvoiceId:
      jobResolution.exportInvoiceId || initialResolution.exportInvoiceId,
    message:
      invoiceErrorMessage ||
      jobResolution.message ||
      initialResolution.message ||
      "Xuất hóa đơn thất bại.",
  }
}

export function getInvoiceExportAlertMessage(
  resolution: InvoiceExportResolution
) {
  const rawInvoiceStatus = String(
    resolution.exportData?.invoiceStatus || resolution.status || ""
  ).trim()
  const normalizedInvoiceStatus = normalizeInvoiceStatusValue(rawInvoiceStatus)
  const invoiceErrorMessage = getInvoiceExportTextField(
    resolution.exportData,
    "invoiceErrorMessage"
  )
  const isFailed =
    resolution.status === InvoiceStatus.FAILED ||
    normalizedInvoiceStatus === InvoiceStatus.FAILED ||
    getBooleanFlag(resolution.exportData?.isFailed) ||
    Boolean(invoiceErrorMessage)

  if (isFailed) {
    return (
      invoiceErrorMessage ||
      getInvoiceExportFailureMessage(resolution.exportData, "") ||
      getInvoiceExportFailureMessage(resolution, "") ||
      "Xuất hóa đơn thất bại."
    )
  }

  const invoiceStatus = normalizedInvoiceStatus
    ? invoiceStatusLabel[normalizedInvoiceStatus]
    : rawInvoiceStatus
  if (invoiceStatus === invoiceStatusLabel[InvoiceStatus.FAILED]) {
    return (
      getInvoiceExportFailureMessage(resolution.exportData, "") ||
      getInvoiceExportFailureMessage(resolution, "") ||
      "Xuất hóa đơn thất bại."
    )
  }

  const statusMessage = invoiceStatus
  const message = normalizeMessage(resolution.message)
  const normalizedMessage = normalizeSearchText(message)

  if (!statusMessage) return message
  if (
    !message ||
    normalizedMessage.includes("invoice job status fetched successfully")
  ) {
    return statusMessage
  }

  return `${message} (${statusMessage})`
}

export function getInvoiceExportErrorAlertMessage(
  resolution: InvoiceExportResolution,
  fallbackRow?: InvoiceApiRow | null
) {
  const invoiceErrorMessage =
    getInvoiceExportTextField(resolution.exportData, "invoiceErrorMessage") ||
    getInvoiceExportTextField(resolution, "invoiceErrorMessage") ||
    normalizeMessage(fallbackRow?.invoiceErrorMessage)

  if (invoiceErrorMessage) {
    return invoiceErrorMessage
  }

  const message = normalizeMessage(resolution.message)
  const normalizedMessage = normalizeSearchText(message)

  if (
    message &&
    !normalizedMessage.includes("invoice job status fetched successfully")
  ) {
    return message
  }

  return getInvoiceExportAlertMessage(resolution) || "Xuất hóa đơn thất bại."
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
    message: getInvoiceExportFailureMessage(source, fallbackMessage),
  }
}

export function applyInvoiceExportResolutionToRow(
  row: InvoiceApiRow,
  resolution: InvoiceExportResolution
): InvoiceApiRow {
  const isFailed = resolution.status === InvoiceStatus.FAILED
  const invoiceErrorCode = getInvoiceExportTextField(
    resolution.exportData,
    "invoiceErrorCode"
  )
  const invoiceErrorMessage = getInvoiceExportTextField(
    resolution.exportData,
    "invoiceErrorMessage"
  )
  const rawFailedReason =
    getInvoiceExportTextField(resolution.exportData, "rawFailedReason") ||
    getInvoiceExportTextField(resolution.exportData, "failedReason")
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
    invoiceNumber: resolution.exportData?.invoiceNumber ?? row.invoiceNumber,
    orderNumber: resolution.exportData?.orderNumber || row.orderNumber,
    exportInvoiceData: mergedExportData,
    invoiceStatus: resolution.status,
    invoiceErrorCode: isFailed
      ? invoiceErrorCode || row.invoiceErrorCode
      : undefined,
    invoiceErrorMessage: isFailed
      ? invoiceErrorMessage || row.invoiceErrorMessage
      : undefined,
    rawFailedReason: isFailed
      ? rawFailedReason || row.rawFailedReason
      : undefined,
    jobId:
      resolution.status === InvoiceStatus.ISSUING
        ? String(resolution.exportData?.jobId || row.jobId || "").trim() || null
        : null,
    updatedAt: new Date().toISOString(),
  }
}
