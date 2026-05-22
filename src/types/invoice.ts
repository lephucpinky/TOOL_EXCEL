import { Agency } from "./agency"
import { Bank } from "./bank"
import { Department } from "./department"
import { Employee } from "./employee"
import { Product } from "./product"

export enum InvoiceStatus {
  DRAFT = "DRAFT",
  ISSUED = "ISSUED",
  CANCELLED = "CANCELLED",
}

export type InvoiceItem = {
  _id?: string
  productId?: Product | null
  revenue?: number
  capitalPrice?: number
  totalSalary?: number
  accountingAccountCode?: number
}

export type InvoiceApiRow = {
  _id: string

  invoiceStatus?: InvoiceStatus
  bankId?: Bank | string | null

  activationDate?: string | null
  inv_invoiceCreatedId?: string | null
  inv_invoiceSeries?: string
  inv_invoiceIssuedDate?: string
  inv_currencyCode?: string
  inv_exchangeRate?: number

  orderNumber?: string
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

  agencyId?: Agency
  departmentId?: Department
  employeeId?: Employee

  items?: InvoiceItem[]

  paidAmount?: number
  remainingAmount?: number
  minvoiceRevenue?: number
  isPaid?: boolean
  note?: string
  isActive?: boolean

  createdAt?: string
  updatedAt?: string
}
