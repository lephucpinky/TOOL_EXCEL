import { ViewPrintInvoiceType } from "@/types/viewPrintInvoice.type"
import axiosInstance from "./axiosInstance"

export type MInvoiceReceiptPostPayload = {
  saleTransactionId: string
  inv_invoiceSeries: string
  inv_invoiceIssuedDate: string
  editmode: number
}

export type MInvoiceReceiptJobStatus = {
  code?: number
  info?: string
  message?: string
  jobId?: string
  jobName?: string
  jobState?: string
  attemptsMade?: number
  failedReason?: string | null
  stacktrace?: string[]
  saleTransactionId?: string
  invoiceStatus?: string
  inv_invoiceCreatedId?: string
  inv_invoiceSeries?: string
  inv_invoiceIssuedDate?: string
  orderNumber?: string
  invoiceNumber?: number
  invoiceErrorCode?: string
  invoiceErrorMessage?: string
  rawFailedReason?: string
  isProcessing?: boolean
  isSuccess?: boolean
  isFailed?: boolean
}

export const APIExportMInvoiceReceiptPost = async (
  payload: MInvoiceReceiptPostPayload,
  taxCode: string
) => {
  const normalizedTaxCode = String(taxCode || "").trim()

  if (!normalizedTaxCode) {
    throw new Error("Thiếu mã số thuế cấu hình hóa đơn.")
  }

  const response = await axiosInstance.post(
    "/m-invoice-receipt-post",
    payload,
    {
      params: {
        tax_code: normalizedTaxCode,
      },
    }
  )

  return response.data
}

export const APIGetMInvoiceReceiptJobStatus = async (jobId: string) => {
  const normalizedJobId = String(jobId || "").trim()

  if (!normalizedJobId) {
    throw new Error("Thiếu jobId để kiểm tra trạng thái xuất hóa đơn.")
  }

  const response = await axiosInstance.get<MInvoiceReceiptJobStatus>(
    "/m-invoice-receipt-post/job-status",
    {
      params: {
        jobId: normalizedJobId,
      },
    }
  )

  return response.data
}

export const APIViewPrintInvoice = async (request: ViewPrintInvoiceType) => {
  try {
    const response = await axiosInstance.get("/m-invoice-receipt-get-view", {
      params: {
        tax_code: request.taxCode,
        inv_invoiceCreatedId: request.inv_invoiceCreatedId,
      },
    })

    return response.data
  } catch (error) {
    console.error("Lỗi khi xem hóa đơn:", error)
    throw error
  }
}
