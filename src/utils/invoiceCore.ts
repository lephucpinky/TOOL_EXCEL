/* eslint-disable @typescript-eslint/no-explicit-any */

import { ReceiptInvoiceConfig } from "@/types/receiptInvoice"

export const FIXED_RECEIPT_INVOICE_CONFIG: ReceiptInvoiceConfig = {
  _id: "fixed-receipt-config-1c26thd",
  inv_invoiceSeries: "1C26THD",
  tax_code: "0106026495-001",
  description: "MST: 0106026495-001",
}

export function getFixedReceiptInvoiceConfig(): ReceiptInvoiceConfig {
  return { ...FIXED_RECEIPT_INVOICE_CONFIG }
}

export function getFixedReceiptInvoiceConfigs(): ReceiptInvoiceConfig[] {
  return [getFixedReceiptInvoiceConfig()]
}

export const inputClass =
  "h-8 w-full rounded border border-slate-300 bg-white px-2 text-[13px] text-slate-800 outline-none focus:border-indigo-500 disabled:bg-slate-100"

export function toNumber(value: unknown) {
  const numberValue = Number(value)
  return Number.isFinite(numberValue) ? numberValue : 0
}

export function formatMoney(value: unknown) {
  return new Intl.NumberFormat("en-US").format(toNumber(value))
}

export function roundInvoiceMoney(value: unknown) {
  const numberValue = Number(value)
  if (!Number.isFinite(numberValue)) return 0

  return Math.round(numberValue * 100) / 100
}

export function normalizeInvoiceTaxCode(value: unknown) {
  const textValue = String(value ?? "")
    .trim()
    .toUpperCase()

  if (!textValue) return "0"
  if (textValue === "-1") return "KCT"
  if (textValue === "-2") return "KKKNT"
  if (textValue === "KCT" || textValue === "KKKNT") return textValue

  const numericValue = Number(textValue.replace(/%$/, "").replace(",", "."))

  return Number.isFinite(numericValue) ? String(numericValue) : textValue
}

export function getInvoiceTaxRateNumber(value: unknown) {
  const taxCode = normalizeInvoiceTaxCode(value)

  if (taxCode === "KCT" || taxCode === "KKKNT") return 0

  const numericValue = Number(taxCode)

  return Number.isFinite(numericValue) ? numericValue : 0
}

export function resolveInvoiceTaxCodeAndRate(value: unknown) {
  const taxCode = normalizeInvoiceTaxCode(value)

  if (taxCode === "KCT") {
    return { displayTaxCode: taxCode, invoiceTaxCode: -1, taxRate: 0 }
  }

  if (taxCode === "KKKNT") {
    return { displayTaxCode: taxCode, invoiceTaxCode: -2, taxRate: 0 }
  }

  const taxPercent = Number(taxCode)
  const normalizedTaxPercent = Number.isFinite(taxPercent) ? taxPercent : 0

  return {
    displayTaxCode: String(normalizedTaxPercent),
    invoiceTaxCode: normalizedTaxPercent,
    taxRate: normalizedTaxPercent / 100,
  }
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
      if (unit === 1) result += " một"
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
