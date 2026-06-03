import type {
  ReceiptInvoiceConfig,
  ReceiptInvoicePayload,
} from "@/types/receiptInvoice"
import {
  getFixedReceiptInvoiceConfig,
  getFixedReceiptInvoiceConfigs,
} from "@/utils/invoice"

export const APIGetReceiptInvoices = async (
  _params?: any
): Promise<{
  data: ReceiptInvoiceConfig[] | ReceiptInvoiceConfig
  status: number
}> => {
  return {
    data: getFixedReceiptInvoiceConfigs(),
    status: 200,
  }
}

export const APIGetReceiptInvoiceById = async (
  _id: string
): Promise<{
  data: ReceiptInvoiceConfig[] | ReceiptInvoiceConfig
  status: number
}> => {
  return {
    data: getFixedReceiptInvoiceConfig(),
    status: 200,
  }
}

export const APICreateReceiptInvoice = async (
  _payload: ReceiptInvoicePayload
): Promise<{
  data: ReceiptInvoiceConfig[] | ReceiptInvoiceConfig
  status: number
}> => {
  return {
    data: getFixedReceiptInvoiceConfig(),
    status: 200,
  }
}

export const APIUpdateReceiptInvoice = async (
  _id: string,
  _payload: ReceiptInvoicePayload
): Promise<{
  data: ReceiptInvoiceConfig[] | ReceiptInvoiceConfig
  status: number
}> => {
  return {
    data: getFixedReceiptInvoiceConfig(),
    status: 200,
  }
}

export const APIDeleteReceiptInvoice = async (
  _id: string
): Promise<{
  data: ReceiptInvoiceConfig[] | ReceiptInvoiceConfig | null
  status: number
}> => {
  return {
    data: getFixedReceiptInvoiceConfig(),
    status: 200,
  }
}
