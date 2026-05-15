import { ViewPrintInvoiceType } from "@/types/viewPrintInvoice.type"
import axiosInstance from "./axiosInstance"

export type MInvoiceReceiptPostPayload = {
  saleTransactionId: string
  inv_invoiceSeries: string
  inv_invoiceIssuedDate: string
  editmode: number
}

export const APIExportMInvoiceReceiptPost = async (
  payload: MInvoiceReceiptPostPayload,
  taxCode = process.env.NEXT_PUBLIC_MINVOICE_TAX_CODE || ""
) => {
  if (!taxCode) {
    throw new Error("Thiếu NEXT_PUBLIC_MINVOICE_TAX_CODE trong file .env.local")
  }

  const response = await axiosInstance.post(
    "/m-invoice-receipt-post",
    payload,
    {
      params: {
        tax_code: taxCode,
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
    console.error("Lỗi khi xem hoá đơn:", error)
    throw error
  }
}
