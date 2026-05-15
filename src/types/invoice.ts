import { Agency } from "./agency"
import { Bank } from "./bank"
import { Department } from "./department"
import { Employee } from "./employee"
import { Product } from "./product"

export type InvoicePaidStatus = "paid" | "unpaid"

export type InvoiceApiRow = {
  _id: string
  inv_invoiceCreatedId?: string
  inv_invoiceSeries?: string
  invoiceNo?: string
  inv_invoiceNumber?: string
  so_hoa_don?: string
  orderNumber?: string

  inv_invoiceIssuedDate?: string
  inv_currencyCode?: string
  inv_exchangeRate?: number

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

  key_api?: string
  cccdan?: string
  so_hchieu?: string
  mdvqhnsach_nmua?: string
  ma_ch?: string
  ten_ch?: string

  inv_quantity?: number
  inv_discountPercentage?: number

  agencyId?: Agency
  departmentId?: Department
  employeeId?: Employee
  bankId?: Bank
  items?: Product
  newQuantity?: number
  renewQuantity?: number
  giftQuantity?: number
  invoiceTitle?: string
  difference?: number
  invoicePackage?: number
  otherAmount?: number
  writeDifference?: number
  customerDiscount?: number
  commissionAmount?: number
  writeRevenue?: number
  differencePayable?: number
  minvoiceRevenue?: number
  ds?: number
  isPaid?: boolean
  paidAmount?: number
  remainingAmount?: number
  note?: string
  createdAt?: string
  updatedAt?: string
}
