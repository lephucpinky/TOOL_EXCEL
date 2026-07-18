import * as invoiceHelper from "@/utils/invoice"
import {
  InvoiceApiRow,
  InvoicePaymentStatus,
  InvoiceStatus,
} from "@/types/invoice"

const DEPARTMENT_OVERRIDE_STORAGE_KEY =
  "minvoice.saleTransaction.departmentOverrides"
const PAYMENT_AMOUNT_FIELDS = ["amountCollected", "paidAmount"] as const
const SUGGESTED_PAYMENT_AMOUNT_FIELDS = ["suggestedAmountCollected"] as const

export const getTodayDate = () => new Date().toISOString().slice(0, 10)

export const hasOwnField = <K extends PropertyKey>(
  value: unknown,
  key: K
): value is Record<K, unknown> => {
  return (
    Boolean(value) &&
    typeof value === "object" &&
    Object.prototype.hasOwnProperty.call(value, key)
  )
}

export const isFilledValue = (value: unknown) => {
  return value !== undefined && value !== null && String(value).trim() !== ""
}

export const toSafeNumber = (value: unknown) => {
  const numberValue = invoiceHelper.toNumber(value)
  return Number.isFinite(numberValue) ? numberValue : 0
}

export const getInvoiceTotalAmount = (
  invoice?: InvoiceApiRow | null,
  fallback?: InvoiceApiRow | null
) => {
  const invoiceTotalAmount = toSafeNumber(invoice?.inv_TotalAmount)
  const fallbackTotalAmount = toSafeNumber(fallback?.inv_TotalAmount)

  return invoiceTotalAmount > 0 ? invoiceTotalAmount : fallbackTotalAmount
}

export const getFirstPositiveNumberField = <K extends PropertyKey>(
  candidates: Array<InvoiceApiRow | null | undefined>,
  fields: readonly K[]
) => {
  for (const candidate of candidates) {
    for (const field of fields) {
      if (!hasOwnField(candidate, field) || !isFilledValue(candidate[field])) {
        continue
      }

      const value = toSafeNumber(candidate[field])

      if (value > 0) return value
    }
  }

  return 0
}

export const isInvoiceMarkedPaid = (invoice?: InvoiceApiRow | null) => {
  return (
    invoice?.isPaid === true ||
    invoice?.paymentStatus === InvoicePaymentStatus.PAID
  )
}

const readDepartmentOverrides = () => {
  if (typeof window === "undefined") return {}

  try {
    const rawValue = window.localStorage.getItem(
      DEPARTMENT_OVERRIDE_STORAGE_KEY
    )
    const parsedValue = rawValue ? JSON.parse(rawValue) : {}

    return parsedValue && typeof parsedValue === "object"
      ? (parsedValue as Record<string, InvoiceApiRow["departmentId"]>)
      : {}
  } catch {
    return {}
  }
}

export const persistDepartmentOverride = (
  invoiceId: string,
  department: InvoiceApiRow["departmentId"] | undefined
) => {
  if (!invoiceId || typeof window === "undefined") return

  const overrides = readDepartmentOverrides()

  if (department && typeof department === "object") {
    overrides[invoiceId] = department
  } else {
    delete overrides[invoiceId]
  }

  window.localStorage.setItem(
    DEPARTMENT_OVERRIDE_STORAGE_KEY,
    JSON.stringify(overrides)
  )
}

export const applyDepartmentOverride = (
  invoice: InvoiceApiRow
): InvoiceApiRow => {
  if (!invoice?._id) return invoice

  const override = readDepartmentOverrides()[invoice._id]

  if (!override || typeof override !== "object") return invoice

  return {
    ...invoice,
    departmentId: override,
  }
}

export const getPaymentStatus = (
  totalAmount: number,
  amountCollected: number
): InvoicePaymentStatus => {
  if (totalAmount > 0 && amountCollected >= totalAmount) {
    return InvoicePaymentStatus.PAID
  }

  if (amountCollected > 0) {
    return InvoicePaymentStatus.PARTIAL
  }

  return InvoicePaymentStatus.UNPAID
}

export const canCollectPayment = (invoice?: InvoiceApiRow | null) => {
  const status = invoiceHelper.getInvoiceStatus(invoice)

  return status === InvoiceStatus.DRAFT || status === InvoiceStatus.ISSUED
}

export const getUniqueInvoiceRows = (rows: InvoiceApiRow[]) => {
  const seenIds = new Set<string>()

  return rows.flatMap((row) => {
    if (!row?._id || seenIds.has(row._id)) return []

    seenIds.add(row._id)
    return [row]
  })
}

export const canUpdateMInvoiceRow = (row?: InvoiceApiRow | null) => {
  const invoiceNumber = Number(row?.invoiceNumber)

  return (
    Boolean(row?._id) &&
    invoiceHelper.getInvoiceStatus(row) === InvoiceStatus.ISSUED &&
    Boolean(invoiceHelper.getExportInvoiceId(row)) &&
    Number.isFinite(invoiceNumber) &&
    invoiceNumber > 0
  )
}

export const buildCopiedInvoiceDraft = (
  source: InvoiceApiRow
): InvoiceApiRow => {
  const copiedDate = getTodayDate()

  return {
    ...source,
    _id: "",
    invoiceStatus: InvoiceStatus.DRAFT,
    invoiceNumber: undefined,
    inv_invoiceCreatedId: "",
    inv_invoiceIssuedDate: "",
    activationDate: copiedDate,
    orderNumber: undefined,
    amountCollected: 0,
    paidAmount: 0,
    paidDate: null,
    paymentDate: "",
    remainingAmount: toSafeNumber(source.inv_TotalAmount),
    suggestedAmountCollected: 0,
    isPaid: false,
    paymentStatus: InvoicePaymentStatus.UNPAID,
    jobId: null,
    invoiceErrorCode: "",
    invoiceErrorMessage: "",
    rawFailedReason: "",
    createdAt: undefined,
    updatedAt: undefined,
    items: source.items?.map((item) => ({
      ...item,
      _id: undefined,
    })),
  }
}

export const getPaymentAmountFromInvoice = (
  invoice?: InvoiceApiRow | null,
  fallback?: InvoiceApiRow | null
) => {
  const totalAmount = getInvoiceTotalAmount(invoice, fallback)

  for (const candidate of [invoice, fallback]) {
    const amount = getFirstPositiveNumberField(
      [candidate],
      PAYMENT_AMOUNT_FIELDS
    )

    if (amount > 0) return amount
    if (totalAmount > 0 && isInvoiceMarkedPaid(candidate)) return totalAmount
  }

  return 0
}

export const getSuggestedPaymentAmountFromInvoice = (
  invoice?: InvoiceApiRow | null,
  fallback?: InvoiceApiRow | null
) => {
  return getFirstPositiveNumberField(
    [invoice, fallback],
    SUGGESTED_PAYMENT_AMOUNT_FIELDS
  )
}

export const mergeInvoicePaymentState = (
  invoice: InvoiceApiRow,
  fallback?: InvoiceApiRow | null
): InvoiceApiRow => {
  if (!invoice?._id) return invoice

  const totalAmount = getInvoiceTotalAmount(invoice, fallback)
  const amountCollected = getPaymentAmountFromInvoice(invoice, fallback)
  const remainingAmount = totalAmount - amountCollected
  const suggestedAmountCollectedFromInvoice =
    getSuggestedPaymentAmountFromInvoice(invoice, fallback)
  const invoiceStatus = invoice.invoiceStatus || fallback?.invoiceStatus
  const suggestedAmountCollected =
    amountCollected > 0
      ? amountCollected
      : suggestedAmountCollectedFromInvoice > 0
        ? suggestedAmountCollectedFromInvoice
        : invoiceStatus === InvoiceStatus.ISSUED
          ? totalAmount
          : 0

  const isPaid = totalAmount > 0 && amountCollected >= totalAmount

  const paidDate =
    invoice.paidDate ||
    invoice.paymentDate ||
    fallback?.paidDate ||
    fallback?.paymentDate ||
    undefined
  const activationDateText = String(invoice.activationDate || "").trim()
  const activationDateStartsWithDate = Boolean(
    activationDateText.match(/^(\d{4}-\d{1,2}-\d{1,2}|\d{1,2}\/\d{1,2}\/\d{4})/)
  )
  const canUseInvoiceActivationDate = Boolean(
    activationDateStartsWithDate &&
      invoiceHelper.normalizeDateInput(activationDateText)
  )
  const activationDate = canUseInvoiceActivationDate
    ? invoice.activationDate
    : fallback?.activationDate || invoice.activationDate

  return {
    ...invoice,
    activationDate,
    inv_TotalAmount: totalAmount,
    amountCollected,
    suggestedAmountCollected,
    paidAmount: amountCollected,
    isPaid,
    paymentStatus: getPaymentStatus(totalAmount, amountCollected),
    paidDate: amountCollected > 0 ? paidDate : undefined,
    paymentDate: amountCollected > 0 ? paidDate : undefined,
    remainingAmount,
  }
}

export const getInvoiceAmountCollected = (invoice?: InvoiceApiRow | null) => {
  return getPaymentAmountFromInvoice(invoice)
}

export const getInvoiceDefaultCollectPaymentAmount = (
  invoice?: InvoiceApiRow | null
) => {
  const amountCollected = getInvoiceAmountCollected(invoice)

  if (amountCollected > 0) {
    return amountCollected
  }

  return getSuggestedPaymentAmountFromInvoice(invoice)
}

export const getInvoicePaidDateInput = (invoice?: InvoiceApiRow | null) => {
  return (
    invoiceHelper.normalizeDateInput(
      String(invoice?.paidDate || invoice?.paymentDate || "")
    ) || getTodayDate()
  )
}
