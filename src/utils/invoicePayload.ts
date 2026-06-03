import type { InvoiceApiRow } from "@/types/invoice"
import { toNumber } from "@/utils/excel"
import { getId } from "@/utils/invoice"

type InvoiceSaveApiBody = Omit<InvoiceApiRow, "_id"> & {
  _id?: string
}

type InvoicePayloadItem = {
  productId?: unknown
  product?: unknown
  quantity?: unknown
  inv_quantity?: unknown
  price?: unknown
  unitPrice?: unknown
  inv_unitPrice?: unknown
  revenue?: unknown
  capitalPrice?: unknown
  totalSalary?: unknown
  accountingAccountCode?: unknown
}

type InvoicePayloadInput = {
  _id?: string
  items?: InvoicePayloadItem[]
  __clientPayment?: {
    isPaid?: boolean
    paidAmount?: unknown
    paidDate?: string
    remainingAmount?: unknown
  }
  isPaid?: boolean
  paidAmount?: unknown
  paidDate?: string
  remainingAmount?: unknown
  inv_invoiceSeries?: string
  inv_invoiceIssuedDate?: string
  inv_currencyCode?: string
  inv_exchangeRate?: unknown
  so_benh_an?: string
  inv_buyerDisplayName?: string
  inv_buyerLegalName?: string
  inv_buyerTaxCode?: string
  inv_buyerAddressLine?: string
  inv_buyerEmail?: string
  inv_buyerBankAccount?: string
  inv_buyerBankName?: string
  inv_paymentMethodName?: string
  inv_discountAmount?: unknown
  inv_TotalAmountWithoutVAT?: unknown
  inv_vatAmount?: unknown
  inv_TotalAmount?: unknown
  inv_quantity?: unknown
  inv_discountPercentage?: unknown
  key_api?: string
  cccdan?: string
  so_hchieu?: string
  mdvqhnsach_nmua?: string
  ma_ch?: string
  ten_ch?: string
  agencyId?: unknown
  employeeId?: unknown
  bankId?: unknown
}

export function toInvoiceApiDate(value?: string) {
  if (!value) return ""

  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [year, month, day] = value.split("-")
    return `${day}/${month}/${year} 12:00:00 SA`
  }

  return value
}

export function buildCreateInvoiceApiBody(
  payload: InvoicePayloadInput,
  options?: {
    includePayment?: boolean
    includeId?: boolean
    itemMode?: "create" | "update"
  }
): InvoiceSaveApiBody {
  const items = Array.isArray(payload.items) ? payload.items : []
  const includePayment = Boolean(options?.includePayment)
  const includeId = Boolean(options?.includeId && payload._id)
  const itemMode = options?.itemMode || "create"
  const clientPayment = payload?.__clientPayment || {}
  const isPaid = Boolean(clientPayment.isPaid ?? payload.isPaid)
  const paidAmount = toNumber(clientPayment.paidAmount ?? payload.paidAmount)
  const paidDate = String(
    clientPayment.paidDate ?? payload.paidDate ?? ""
  ).trim()
  const remainingAmount = toNumber(
    clientPayment.remainingAmount ?? payload.remainingAmount
  )

  return {
    ...(includeId ? { _id: String(payload._id || "").trim() } : {}),
    inv_invoiceSeries: String(payload.inv_invoiceSeries || "").trim(),
    inv_invoiceIssuedDate: toInvoiceApiDate(payload.inv_invoiceIssuedDate),
    inv_currencyCode: payload.inv_currencyCode || "VND",
    inv_exchangeRate: toNumber(payload.inv_exchangeRate || 1),
    so_benh_an: payload.so_benh_an || "",
    inv_buyerDisplayName:
      payload.inv_buyerDisplayName || payload.inv_buyerLegalName || "",
    inv_buyerLegalName:
      payload.inv_buyerLegalName || payload.inv_buyerDisplayName || "",
    inv_buyerTaxCode: payload.inv_buyerTaxCode || "",
    inv_buyerAddressLine: payload.inv_buyerAddressLine || "",
    inv_buyerEmail: payload.inv_buyerEmail || "",
    inv_buyerBankAccount: payload.inv_buyerBankAccount || "",
    inv_buyerBankName: payload.inv_buyerBankName || "",
    inv_paymentMethodName: payload.inv_paymentMethodName || "CK",
    inv_discountAmount: toNumber(payload.inv_discountAmount),
    inv_TotalAmountWithoutVAT: toNumber(payload.inv_TotalAmountWithoutVAT),
    inv_vatAmount: toNumber(payload.inv_vatAmount),
    inv_TotalAmount: toNumber(payload.inv_TotalAmount),
    inv_quantity: toNumber(payload.inv_quantity),
    inv_discountPercentage: toNumber(payload.inv_discountPercentage),
    key_api: payload.key_api || "",
    cccdan: payload.cccdan || "",
    so_hchieu: payload.so_hchieu || "",
    mdvqhnsach_nmua: payload.mdvqhnsach_nmua || "",
    ma_ch: payload.ma_ch || "",
    ten_ch: payload.ten_ch || "",
    agencyId: payload.agencyId as InvoiceApiRow["agencyId"],
    employeeId: payload.employeeId as InvoiceApiRow["employeeId"],
    bankId: payload.bankId as InvoiceApiRow["bankId"],
    ...(includePayment
      ? {
          isPaid,
          paidAmount,
          paidDate,
          paymentDate: paidDate,
          remainingAmount,
        }
      : {}),
    items: items.map((item) => {
      const productId = getId(item.productId) || getId(item.product)

      if (itemMode === "update") {
        return {
          productId,
        }
      }

      return {
        productId,
        revenue: toNumber(item.revenue),
        capitalPrice: toNumber(item.capitalPrice),
        totalSalary: toNumber(item.totalSalary),
        accountingAccountCode: Number(item.accountingAccountCode || 0),
      }
    }),
  }
}
