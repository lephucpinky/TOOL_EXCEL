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

export type InvoiceItem = {
  _id?: string
  productId?: Product | string | null
  product?: Product | string | null
  quantity?: number
  inv_quantity?: number
  revenue?: number
  capitalPrice?: number
  totalSalary?: number
  accountingAccountCode?: number
}

export type InvoiceApiRow = {
  _id: string

  invoiceStatus?: InvoiceStatus
  bankId?: Bank | string | null
  invoiceNumber?: number
  activationDate?: string | null
  inv_invoiceCreatedId?: string | null
  inv_invoiceSeries?: string
  inv_invoiceIssuedDate?: string
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
  paidDate?: string
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
  exportInvoiceData?: Record<string, unknown>
  jobId?: string | null
  invoiceErrorCode?: string
  invoiceErrorMessage?: string
  rawFailedReason?: string

  createdAt?: string
  updatedAt?: string
}
