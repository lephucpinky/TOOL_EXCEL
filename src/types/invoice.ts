import { Agency } from "./agency"
import { Bank } from "./bank"
import { Department } from "./department"
import { Employee } from "./employee"
import { Product } from "./product"

export enum InvoiceStatus {
  DRAFT = "DRAFT",
  ISSUING = "ISSUING",
  ISSUED = "ISSUED",
  FAILED = "FAILED",
  CANCELLED = "CANCELLED",
}

export enum InvoicePaymentStatus {
  UNPAID = "UNPAID",
  PARTIAL = "PARTIAL",
  PAID = "PAID",
}

export const INVOICE_ITEM_TYPES = ["Mới", "Gia hạn", "Tặng", "Khác"] as const

export type InvoiceItemType = (typeof INVOICE_ITEM_TYPES)[number]

export function normalizeInvoiceItemType(value: unknown): InvoiceItemType {
  const normalizedValue = String(value || "").trim()

  return INVOICE_ITEM_TYPES.includes(normalizedValue as InvoiceItemType)
    ? (normalizedValue as InvoiceItemType)
    : "Khác"
}

export type InvoiceItem = {
  _id?: string
  productId?: Product | string | null
  product?: Product | string | null
  type?: InvoiceItemType
  quantity?: number
  inv_quantity?: number
  price?: number
  inv_unitPrice?: number
  unitPrice?: number
  ma_thue?: string
  taxRate?: number | string
  discount?: number
  discountPercentage?: number
  revenue?: number
  capitalPrice?: number
  totalSalary?: number
  accountingAccountCode?: number
}

export type InvoiceApiRow = {
  _id: string

  invoiceStatus?: InvoiceStatus
  invoiceStatusVi?: string
  bankId?: Bank | string
  invoiceNumber?: number
  activationDate?: string | null // tạo và update được
  inv_invoiceCreatedId?: string
  inv_invoiceSeries?: string
  inv_invoiceIssuedDate?: string //// xuất hoá đơn mới tạo
  inv_currencyCode?: string
  inv_exchangeRate?: number

  orderNumber?: string
  suggestedAmountCollected?: number
  amountCollected?: number

  so_benh_an?: string

  inv_buyerDisplayName?: string
  inv_buyerLegalName?: string
  inv_buyerTaxCode?: string
  inv_buyerAddressLine?: string
  inv_buyerEmail?: string
  inv_buyerBankAccount?: string
  inv_buyerBankName?: string
  inv_paymentMethodName?: string
  invReconciliation?: string
  inv_discountAmount?: number
  inv_TotalAmountWithoutVAT?: number
  inv_vatAmount?: number
  inv_TotalAmount?: number
  inv_quantity?: number
  inv_discountPercentage?: number

  key_api?: string
  cccdan?: string
  so_hchieu?: string
  mdvqhnsach_nmua?: string
  ma_ch?: string
  ten_ch?: string

  agencyId?: Agency | string | null
  departmentId?: Department | string | null
  employeeId?: Employee | string | null

  items?: InvoiceItem[]

  paidAmount?: number
  paidDate?: string | null
  invoiceFilePath?: string
  paymentDate?: string
  remainingAmount?: number
  minvoiceRevenue?: number

  /**
   * true chỉ khi amountCollected >= inv_TotalAmount.
   * Không được set true chỉ vì đã thu một phần.
   */
  isPaid?: boolean

  /**
   * Dùng cho UI:
   * - UNPAID: chưa thu
   * - PARTIAL: thu một phần
   * - PAID: đã thu đủ
   */
  paymentStatus?: InvoicePaymentStatus

  note?: string
  isActive?: boolean
  jobId?: string | null
  invoiceErrorCode?: string
  invoiceErrorMessage?: string
  rawFailedReason?: string

  createdAt?: string
  updatedAt?: string
}
