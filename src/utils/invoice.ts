import { InvoiceApiRow } from "@/types/invoice"

export const inputClass =
  "h-8 w-full rounded border border-slate-300 bg-white px-2 text-[13px] text-slate-800 outline-none focus:border-indigo-500 disabled:bg-slate-100"
export const MINVOICE_TAX_CODE = process.env.NEXT_PUBLIC_MINVOICE_TAX_CODE || ""
export const MINVOICE_INVOICE_SERIES =
  process.env.NEXT_PUBLIC_MINVOICE_INVOICE_SERIES || ""

export function toNumber(value: unknown) {
  const numberValue = Number(value)
  return Number.isFinite(numberValue) ? numberValue : 0
}

export function formatMoney(value: unknown) {
  return new Intl.NumberFormat("vi-VN").format(toNumber(value))
}

export function roundInvoiceMoney(value: unknown) {
  const numberValue = Number(value)
  if (!Number.isFinite(numberValue)) return 0

  return Math.round(numberValue * 100) / 100
}
export function getId(value: any) {
  if (!value) return ""
  if (typeof value === "string") return value
  return value._id || value.id || ""
}

export function resolveOption<T extends { _id?: string }>(
  list: T[],
  value: any
): T | null {
  if (!value) return null

  if (typeof value === "object") {
    return value as T
  }

  const id = getId(value)

  if (!id) return null

  return list.find((item) => item._id === id) || null
}

export function mergeOptions<T extends { _id?: string }>(
  base: T[],
  selectedItems: Array<T | null | undefined>
) {
  const result: T[] = []
  const seen = new Set<string>()

  selectedItems.forEach((item) => {
    const id = getId(item)
    if (!id || seen.has(id)) return

    seen.add(id)
    result.push(item as T)
  })

  base.forEach((item) => {
    const id = getId(item)
    if (!id || seen.has(id)) return

    seen.add(id)
    result.push(item)
  })

  return result
}

export function createItemId() {
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`
}

export function normalizeDateInput(value?: string) {
  if (!value) return ""

  const textValue = String(value).trim()

  const yyyymmdd = textValue.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/)
  if (yyyymmdd) {
    const year = yyyymmdd[1]
    const month = yyyymmdd[2].padStart(2, "0")
    const day = yyyymmdd[3].padStart(2, "0")

    return `${year}-${month}-${day}`
  }

  const slashDate = textValue.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/)
  if (slashDate) {
    const first = Number(slashDate[1])
    const second = Number(slashDate[2])
    const year = slashDate[3]

    let day = first
    let month = second

    if (first <= 12 && second > 12) {
      month = first
      day = second
    }

    return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(
      2,
      "0"
    )}`
  }

  const date = new Date(textValue)
  if (!Number.isNaN(date.getTime())) {
    return date.toISOString().slice(0, 10)
  }

  return ""
}

export function numberToVietnamese(value: number) {
  const number = Math.round(Number.isFinite(value) ? value : 0)

  if (number === 0) return "Không đồng"

  const digitText = [
    "không",
    "một",
    "hai",
    "ba",
    "bốn",
    "năm",
    "sáu",
    "bảy",
    "tám",
    "chín",
  ]

  const unitText = ["", "nghìn", "triệu", "tỷ"]

  function readThreeDigits(num: number, full: boolean) {
    const hundred = Math.floor(num / 100)
    const ten = Math.floor((num % 100) / 10)
    const unit = num % 10
    let result = ""

    if (hundred > 0 || full) {
      result += `${digitText[hundred]} trăm`
      if (ten === 0 && unit > 0) result += " lẻ"
    }

    if (ten > 1) {
      result += `${result ? " " : ""}${digitText[ten]} mươi`
      if (unit === 1) result += " mốt"
      else if (unit === 5) result += " lăm"
      else if (unit > 0) result += ` ${digitText[unit]}`
    } else if (ten === 1) {
      result += `${result ? " " : ""}mười`
      if (unit === 5) result += " lăm"
      else if (unit > 0) result += ` ${digitText[unit]}`
    } else if (unit > 0) {
      result += `${result ? " " : ""}${digitText[unit]}`
    }

    return result
  }

  const groups: number[] = []
  let temp = number

  while (temp > 0) {
    groups.push(temp % 1000)
    temp = Math.floor(temp / 1000)
  }

  const parts: string[] = []

  for (let i = groups.length - 1; i >= 0; i--) {
    const group = groups[i]
    if (group === 0) continue

    const full = i < groups.length - 1 && group < 100
    const text = readThreeDigits(group, full)
    const unit = unitText[i] ?? ""

    parts.push(`${text}${unit ? ` ${unit}` : ""}`)
  }

  const sentence = parts.join(" ").replace(/\s+/g, " ").trim()
  return `${sentence.charAt(0).toUpperCase()}${sentence.slice(1)} đồng`
}

function getExistingExportInvoiceId(invoice?: InvoiceApiRow | null) {
  if (!invoice) return ""

  const row = invoice as any

  return String(
    row?.inv_invoiceCreatedId ||
      row?.id ||
      row?.exportInvoiceData?.id ||
      row?.exportInvoiceData?.data?.id ||
      row?.data?.id ||
      ""
  ).trim()
}

type InvoiceStatusValue = "DRAFT" | "ISSUED" | "CANCELLED"

export function getInvoiceStatus(
  invoice?: InvoiceApiRow | null
): InvoiceStatusValue {
  const status = String((invoice as any)?.invoiceStatus || "").toUpperCase()

  if (status === "DRAFT" || status === "ISSUED" || status === "CANCELLED") {
    return status as InvoiceStatusValue
  }

  return getExistingExportInvoiceId(invoice) ? "ISSUED" : "DRAFT"
}

export const invoiceStatusLabel: Record<InvoiceStatusValue, string> = {
  DRAFT: "Nháp",
  ISSUED: "Đã xuất hóa đơn",
  CANCELLED: "Đã hủy",
}

export const invoiceStatusClass: Record<InvoiceStatusValue, string> = {
  DRAFT: "border-amber-200 bg-amber-50 text-amber-700",
  ISSUED: "border-emerald-200 bg-emerald-50 text-emerald-700",
  CANCELLED: "border-red-200 bg-red-50 text-red-700",
}
