export type ReceiptInvoiceConfig = {
  _id?: string
  id?: string
  inv_invoiceSeries?: string
  tax_code?: string
  description?: string
  __v?: number
  createdAt?: string
  updatedAt?: string
}

export type ReceiptInvoicePayload = {
  inv_invoiceSeries: string
  tax_code: string
  description?: string
}
