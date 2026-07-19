/* eslint-disable @typescript-eslint/no-explicit-any */

import { InvoiceApiRow, InvoicePaymentStatus } from "@/types/invoice"
import {
  normalizeDateInput,
  normalizeInvoiceTaxCode,
  toNumber,
} from "./invoiceCore"

function preferDisplayValue(
  serverValue: any,
  clientValue: any,
  fallbackValue?: any
) {
  if (serverValue && typeof serverValue === "object") return serverValue
  if (clientValue && typeof clientValue === "object") return clientValue
  return serverValue ?? clientValue ?? fallbackValue
}

function buildPayloadItems(payload: any) {
  const items = Array.isArray(payload?.items) ? payload.items : []

  return items.map((item: any) => {
    const hasQuantity = Object.prototype.hasOwnProperty.call(item, "quantity")
    const hasInvQuantity = Object.prototype.hasOwnProperty.call(
      item,
      "inv_quantity"
    )

    return {
      productId: item.product || item.productId || null,
      product: item.product || item.productId || null,
      quantity: hasQuantity
        ? toNumber(item.quantity)
        : hasInvQuantity
          ? toNumber(item.inv_quantity)
          : undefined,
      inv_quantity: hasInvQuantity
        ? toNumber(item.inv_quantity)
        : hasQuantity
          ? toNumber(item.quantity)
          : undefined,
      price: toNumber(item.price ?? item.unitPrice ?? 0),
      unitPrice: toNumber(item.unitPrice ?? item.price ?? 0),
      inv_unitPrice: toNumber(item.inv_unitPrice ?? 0),
      ma_thue: normalizeInvoiceTaxCode(item.ma_thue ?? item.taxRate),
      taxRate: normalizeInvoiceTaxCode(item.taxRate ?? item.ma_thue),
      discountPercentage: toNumber(item.discountPercentage),
      revenue: toNumber(item.revenue),
      capitalPrice: toNumber(item.capitalPrice),
      totalSalary: toNumber(item.totalSalary),
      accountingAccountCode: Number(item.accountingAccountCode || 0),
    }
  })
}

export function hydrateSaleTransactionDetail(
  detail: InvoiceApiRow,
  payload?: any,
  fallback?: InvoiceApiRow | null
): InvoiceApiRow {
  const payloadItems = buildPayloadItems(payload)

  const mergedItems =
    Array.isArray(detail?.items) && detail.items.length
      ? detail.items.map((item: any, index: number) => {
          const payloadItem = payloadItems[index]
          const fallbackItem = fallback?.items?.[index] as any

          return {
            ...item,
            productId: preferDisplayValue(
              item?.productId,
              payloadItem?.productId,
              fallbackItem?.productId
            ),
            product: preferDisplayValue(
              item?.product,
              payloadItem?.product,
              fallbackItem?.product
            ),
            quantity:
              payloadItem?.quantity ??
              payloadItem?.inv_quantity ??
              item?.quantity ??
              item?.inv_quantity ??
              fallbackItem?.quantity,
            inv_quantity:
              payloadItem?.inv_quantity ??
              payloadItem?.quantity ??
              item?.inv_quantity ??
              item?.quantity ??
              fallbackItem?.inv_quantity,
            price:
              item?.price ??
              item?.unitPrice ??
              payloadItem?.price ??
              payloadItem?.unitPrice ??
              fallbackItem?.price ??
              fallbackItem?.unitPrice,
            unitPrice:
              item?.unitPrice ??
              item?.price ??
              payloadItem?.unitPrice ??
              payloadItem?.price ??
              fallbackItem?.unitPrice ??
              fallbackItem?.price,
            inv_unitPrice:
              item?.inv_unitPrice ??
              payloadItem?.inv_unitPrice ??
              fallbackItem?.inv_unitPrice,
            ma_thue: normalizeInvoiceTaxCode(
              item?.ma_thue ??
                item?.taxRate ??
                payloadItem?.ma_thue ??
                payloadItem?.taxRate ??
                fallbackItem?.ma_thue ??
                fallbackItem?.taxRate
            ),
            taxRate: normalizeInvoiceTaxCode(
              item?.taxRate ??
                item?.ma_thue ??
                payloadItem?.taxRate ??
                payloadItem?.ma_thue ??
                fallbackItem?.taxRate ??
                fallbackItem?.ma_thue
            ),
            discountPercentage:
              item?.discountPercentage ??
              payloadItem?.discountPercentage ??
              fallbackItem?.discountPercentage,
            revenue:
              item?.revenue ?? payloadItem?.revenue ?? fallbackItem?.revenue,
            capitalPrice:
              item?.capitalPrice ??
              payloadItem?.capitalPrice ??
              fallbackItem?.capitalPrice,
            totalSalary:
              item?.totalSalary ??
              payloadItem?.totalSalary ??
              fallbackItem?.totalSalary,
            accountingAccountCode:
              item?.accountingAccountCode ??
              payloadItem?.accountingAccountCode ??
              fallbackItem?.accountingAccountCode,
          }
        })
      : payloadItems.length
        ? payloadItems
        : fallback?.items || []

  const totalItemQuantity = mergedItems.reduce((sum: number, item: any) => {
    return sum + toNumber(item?.inv_quantity ?? item?.quantity ?? 0)
  }, 0)

  const detailTotalAmount = toNumber(detail.inv_TotalAmount)
  const payloadTotalAmount = toNumber(payload?.inv_TotalAmount)
  const fallbackTotalAmount = toNumber(fallback?.inv_TotalAmount)

  // Detail API có trường hợp trả inv_TotalAmount = 0 khi xem chi tiết,
  // nên ưu tiên số > 0 để không làm mất tổng tiền thật trên bảng.
  const totalAmount =
    detailTotalAmount > 0
      ? detailTotalAmount
      : payloadTotalAmount > 0
        ? payloadTotalAmount
        : fallbackTotalAmount

  const detailAmountCollected = toNumber(detail.amountCollected)
  const detailPaidAmount = toNumber(detail.paidAmount)
  const payloadAmountCollected = toNumber(payload?.amountCollected)
  const payloadPaidAmount = toNumber(payload?.paidAmount)
  const fallbackAmountCollected = toNumber(fallback?.amountCollected)
  const fallbackPaidAmount = toNumber(fallback?.paidAmount)

  const amountCollected =
    detailAmountCollected > 0
      ? detailAmountCollected
      : detailPaidAmount > 0
        ? detailPaidAmount
        : payloadAmountCollected > 0
          ? payloadAmountCollected
          : payloadPaidAmount > 0
            ? payloadPaidAmount
            : fallbackAmountCollected > 0
              ? fallbackAmountCollected
              : fallbackPaidAmount > 0
                ? fallbackPaidAmount
                : totalAmount > 0 &&
                    (detail.isPaid === true ||
                      detail.paymentStatus === InvoicePaymentStatus.PAID ||
                      fallback?.isPaid === true ||
                      fallback?.paymentStatus === InvoicePaymentStatus.PAID)
                  ? totalAmount
                  : 0

  const remainingAmount = totalAmount - amountCollected
  const paymentStatus =
    totalAmount > 0 && amountCollected >= totalAmount
      ? InvoicePaymentStatus.PAID
      : amountCollected > 0
        ? InvoicePaymentStatus.PARTIAL
        : InvoicePaymentStatus.UNPAID
  const payloadHasActivationDate = Object.prototype.hasOwnProperty.call(
    payload || {},
    "activationDate"
  )
  const detailHasActivationDate = Object.prototype.hasOwnProperty.call(
    detail,
    "activationDate"
  )
  const detailActivationDateText = String(detail.activationDate || "").trim()
  const detailActivationDateStartsWithDate = Boolean(
    detailActivationDateText.match(
      /^(\d{4}-\d{1,2}-\d{1,2}|\d{1,2}\/\d{1,2}\/\d{4})/
    )
  )
  const canUseDetailActivationDate = Boolean(
    detailActivationDateStartsWithDate &&
      normalizeDateInput(detailActivationDateText)
  )
  const activationDate = payloadHasActivationDate
    ? payload?.activationDate || null
    : detailHasActivationDate && canUseDetailActivationDate
      ? detail.activationDate || null
      : fallback?.activationDate || null

  return {
    ...(fallback || {}),
    ...detail,
    activationDate,
    agencyId: preferDisplayValue(
      detail.agencyId,
      payload?.agencyId,
      fallback?.agencyId
    ),
    departmentId: preferDisplayValue(
      detail.departmentId,
      payload?.departmentId,
      fallback?.departmentId
    ),
    employeeId: preferDisplayValue(
      detail.employeeId,
      payload?.employeeId,
      fallback?.employeeId
    ),
    bankId: preferDisplayValue(
      detail.bankId,
      payload?.bankId,
      fallback?.bankId
    ),
    inv_buyerBankName:
      detail.inv_buyerBankName ||
      fallback?.inv_buyerBankName ||
      payload?.inv_buyerBankName ||
      "",
    invReconciliation:
      detail.invReconciliation ??
      payload?.invReconciliation ??
      fallback?.invReconciliation ??
      "",
    inv_quantity: toNumber(
      detail.inv_quantity ??
        payload?.inv_quantity ??
        fallback?.inv_quantity ??
        totalItemQuantity
    ),
    minvoiceRevenue:
      detail.minvoiceRevenue ??
      payload?.minvoiceRevenue ??
      fallback?.minvoiceRevenue ??
      mergedItems.reduce((sum: number, item: any) => {
        return sum + toNumber(item?.revenue)
      }, 0),
    items: mergedItems,
    isPaid:
      detail.isPaid ??
      payload?.isPaid ??
      fallback?.isPaid ??
      (totalAmount > 0 && amountCollected >= totalAmount),
    paymentStatus,

    amountCollected,

    // Giữ paidAmount như field mirror để những form cũ không bị vỡ UI,
    // nhưng toàn bộ logic tính toán chỉ đọc amountCollected.
    paidAmount: amountCollected,

    remainingAmount,

    paidDate: detail.paidDate ?? payload?.paidDate ?? fallback?.paidDate ?? "",

    paymentDate:
      detail.paymentDate ?? payload?.paidDate ?? fallback?.paymentDate ?? "",
  }
}
