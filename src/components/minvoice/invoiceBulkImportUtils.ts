import type { Agency } from "@/types/agency"
import type { Bank } from "@/types/bank"
import type { Employee } from "@/types/employee"
import type { InvoiceItemType } from "@/types/invoice"
import type { Product } from "@/types/product"
import { normalize } from "@/utils/excel"

export type ProductOption = Product & {
  accountingAccountCode?: string | number
  accountCode?: string | number
  inv_accountCode?: string | number
}

export type BulkImportExcelRow = {
  id: string
  rowNumber: number
  stt: string
  lineCode: string
  agencyCode: string
  productCode: string
  itemType: string
  currency: string
  exchangeRate: string | number
  invoiceSeries: string
  invoiceDate: string
  buyerName: string
  buyerCompany: string
  buyerTaxCode: string
  buyerAddress: string
  buyerEmail: string
  buyerBankAccount: string
  buyerBankName: string
  paymentMethod: string
  discountPercentage: string | number
  discountAmount: string | number
  totalBeforeTax: string | number
  vatAmount: string | number
  totalAmount: string | number
  reconciliationAmount: string | number
  writeDifference: string | number
  writeDifferenceFee: string | number
  cccdan: string
  passport: string
  budgetUnitCode: string
  storeCode: string
  storeName: string
  quantity: string | number
}
export type PreparedImportRow = {
  id: string
  rowNumber: number
  stt: string
  lineCode: string
  agencyCode: string
  productCode: string
  itemType: InvoiceItemType
  buyerCompany: string
  buyerTaxCode: string
  buyerEmail: string
  buyerAddress: string
  invoiceSeries: string
  invoiceDate: string
  totalBeforeTax: number
  vatAmount: number
  totalAmount: number
  reconciliationAmount: number
  writeDifference: number
  writeDifferenceFee: number
  quantity: number
  agency: Agency | null
  bank: Bank | null
  product: ProductOption | null
  warnings: string[]
  errors: string[]
  payload: Record<string, unknown> | null
}

export const COLUMN_ALIASES = {
  stt: ["STT"],
  lineCode: ["Mã dòng", "Mã dòng hàng", "Mã đơn hàng"],
  agencyCode: ["Mã đại lý", "Đại lý"],
  productCode: [
    "Mã sản phẩm",
    "Sản phẩm",
    "Tên sản phẩm",
    "Mã hàng hóa",
    "Tên hàng hóa",
    "Mã dịch vụ",
    "Tên dịch vụ",
  ],
  itemType: ["Loại", "Loại sản phẩm", "Loại hàng"],
  currency: ["Mã tiền tệ", "Tiền tệ"],
  exchangeRate: ["Tỷ giá"],
  invoiceSeries: ["Ký hiệu hóa đơn"],
  invoiceDate: ["Ngày kích hoạt"],
  buyerName: ["Tên người mua"],
  buyerCompany: ["Tên đơn vị mua", "Tên công ty mua"],
  buyerTaxCode: ["Mã số thuế người mua", "MST người mua", "Mã số thuế"],
  buyerAddress: ["Địa chỉ người mua", "Địa chỉ"],
  buyerEmail: ["Email người mua", "Email"],
  buyerBankAccount: ["Số tài khoản người mua", "Số tài khoản"],
  buyerBankName: ["Ngân hàng người mua", "Ngân hàng"],
  paymentMethod: ["Phương thức thanh toán"],
  discountPercentage: [
    "Phần trăm chiết khấu",
    "% chiết khấu",
    "Tỷ lệ chiết khấu",
  ],
  discountAmount: ["Tiền chiết khấu"],
  totalBeforeTax: ["Thành tiền chưa VAT", "Tiền trước VAT"],
  vatAmount: ["Tiền thuế VAT", "Thuế VAT"],
  totalAmount: ["Tổng tiền thanh toán", "Tổng tiền"],
  reconciliationAmount: ["Giá đối soát"],
  writeDifference: ["Viết chênh"],
  writeDifferenceFee: ["Phí viết chênh"],
  cccdan: ["CCCD/Căn cước công dân", "CCCD", "Căn cước công dân"],
  passport: ["Số hộ chiếu"],
  budgetUnitCode: ["Mã đơn vị qua ngân sách"],
  storeCode: ["Mã cửa hàng"],
  storeName: ["Tên cửa hàng"],
  quantity: ["Số lượng"],
} as const

export const REQUIRED_COLUMNS: Array<keyof typeof COLUMN_ALIASES> = [
  "agencyCode",
  "productCode",
  "invoiceDate",
  "buyerCompany",
  "buyerTaxCode",
  "buyerEmail",
  "buyerAddress",
  "quantity",
  "totalBeforeTax",
  "vatAmount",
  "totalAmount",
]

export function buildHeaderIndex(headers: string[]) {
  const map = new Map<string, string>()

  headers.forEach((header) => {
    const key = normalize(header)
    if (key && !map.has(key)) {
      map.set(key, header)
    }
  })

  return map
}

export function findHeader(
  headerIndex: Map<string, string>,
  aliases: readonly string[]
) {
  for (const alias of aliases) {
    const matchedHeader = headerIndex.get(normalize(alias))
    if (matchedHeader) return matchedHeader
  }

  return ""
}

export function pickCellValue(
  row: Record<string, unknown>,
  headerIndex: Map<string, string>,
  aliases: readonly string[]
) {
  const header = findHeader(headerIndex, aliases)
  return header ? row[header] : ""
}

export function cleanText(value: unknown) {
  return String(value ?? "").trim()
}

export function getAgencyEmployee(agency: Agency | null) {
  if (!agency?.employeeId || typeof agency.employeeId === "string") return null
  return agency.employeeId as Employee
}

export function getProductAccountingCode(product: ProductOption | null) {
  if (!product) return 0

  return Number(
    product.accountingAccountCode ||
      product.accountCode ||
      product.inv_accountCode ||
      0
  )
}
export function findProductByExcelValue(
  products: ProductOption[],
  value: string
) {
  const keyword = normalize(value)

  if (!keyword) return null

  return (
    products.find((product) => {
      const itemProduct = normalize(product.inv_itemProduct || "")

      return itemProduct === keyword
    }) || null
  )
}
