import { normalizeInvoiceItemType, type InvoiceApiRow } from "@/types/invoice"
import { toNumber } from "@/utils/excel"
import { getId } from "@/utils/invoice"

export function buildCreateInvoiceApiBody(
  payload: Partial<InvoiceApiRow>,
  options?: {
    includePayment?: boolean
    includeId?: boolean
  }
): Partial<InvoiceApiRow> {
  const items = Array.isArray(payload.items) ? payload.items : []
  const includePayment = Boolean(options?.includePayment)
  const includeId = Boolean(options?.includeId && payload._id)
  const amountCollected = toNumber(payload.amountCollected)
  const paidDate =
    payload.paidDate === undefined
      ? undefined
      : String(payload.paidDate ?? "").trim()

  return {
    ...(includeId ? { _id: String(payload._id || "").trim() } : {}),
    activationDate: payload.activationDate || null,
    inv_invoiceSeries: String(payload.inv_invoiceSeries || "").trim(),
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
    invReconciliation:
      payload.invReconciliation === undefined ||
      String(payload.invReconciliation).trim() === ""
        ? String(toNumber(payload.inv_TotalAmount))
        : String(payload.invReconciliation).trim(),
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
    ...(includePayment
      ? {
          amountCollected,
          ...(payload.paidDate !== undefined
            ? { paidDate: paidDate || null }
            : {}),
        }
      : {}),
    items: items
      .map((item) => {
        const productId = getId(item.productId) || getId(item.product)
        const quantity = toNumber(item.quantity ?? item.inv_quantity ?? 0)

        return {
          productId,
          type: normalizeInvoiceItemType(item.type),
          quantity,
          price: toNumber(item.price ?? item.unitPrice ?? 0),
          discountAmount: toNumber(
            item.discountAmount ?? item.inv_discountAmount ?? item.discount
          ),
          discountPercentage: toNumber(item.discountPercentage),
          revenue: toNumber(item.revenue),
          capitalPrice: toNumber(item.capitalPrice),
          totalSalary: toNumber(item.totalSalary),
          accountingAccountCode: Number(item.accountingAccountCode || 0),
        }
      })
      .filter((item) => item.productId),
  }
}
