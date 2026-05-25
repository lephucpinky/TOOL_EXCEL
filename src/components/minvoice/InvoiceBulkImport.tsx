"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import * as XLSX from "xlsx-js-style"
import { ArrowLeft, FileSpreadsheet, Loader2, UploadCloud } from "lucide-react"

import AlertError from "@/components/alert/AlertError"
import AlertSuccess from "@/components/alert/AlertSuccess"
import { APIGetAgencies } from "@/services/agency"
import { APIGetBanks } from "@/services/bank"
import { APIGetProducts } from "@/services/product"
import { APICreateSaleTransaction } from "@/services/saleTransaction"
import type { Agency } from "@/types/agency"
import type { Bank } from "@/types/bank"
import type { Department } from "@/types/department"
import type { Employee } from "@/types/employee"
import type { Product } from "@/types/product"
import type { ReceiptInvoiceConfig } from "@/types/receiptInvoice"
import { normalize, toNumber as toExcelNumber } from "@/utils/excel"
import {
  formatMoney,
  getId,
  normalizeDateInput,
  roundInvoiceMoney,
} from "@/utils/invoice"
import { buildCreateInvoiceApiBody } from "@/utils/invoicePayload"

type Props = {
  receiptConfigs: ReceiptInvoiceConfig[]
  onBack: () => void
  onInvoicesCreated?: () => Promise<void> | void
}

type ProductOption = Product & {
  accountingAccountCode?: string | number
  accountCode?: string | number
  inv_accountCode?: string | number
}

type BulkImportExcelRow = {
  id: string
  rowNumber: number
  stt: string
  lineCode: string
  agencyCode: string
  currency: string
  exchangeRate: number
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
  discountAmount: number
  totalBeforeTax: number
  vatAmount: number
  totalAmount: number
  cccdan: string
  passport: string
  budgetUnitCode: string
  storeCode: string
  storeName: string
  quantity: number
}

type PreparedImportRow = {
  id: string
  rowNumber: number
  stt: string
  lineCode: string
  agencyCode: string
  buyerCompany: string
  buyerTaxCode: string
  invoiceSeries: string
  invoiceDate: string
  totalAmount: number
  quantity: number
  agency: Agency | null
  bank: Bank | null
  product: ProductOption | null
  warnings: string[]
  errors: string[]
  payload: Record<string, unknown> | null
}

const COLUMN_ALIASES = {
  stt: ["STT"],
  lineCode: ["Mã dòng", "Mã dòng hàng", "Mã đơn hàng"],
  agencyCode: ["Mã đại lý", "Đại lý"],
  currency: ["Mã tiền tệ", "Tiền tệ"],
  exchangeRate: ["Tỷ giá"],
  invoiceSeries: ["Ký hiệu hóa đơn"],
  invoiceDate: ["Ngày lập hóa đơn", "Ngày hóa đơn"],
  buyerName: ["Tên người mua"],
  buyerCompany: ["Tên đơn vị mua", "Tên công ty mua"],
  buyerTaxCode: ["Mã số thuế người mua", "MST người mua", "Mã số thuế"],
  buyerAddress: ["Địa chỉ người mua", "Địa chỉ"],
  buyerEmail: ["Email người mua", "Email"],
  buyerBankAccount: ["Số tài khoản người mua", "Số tài khoản"],
  buyerBankName: ["Ngân hàng người mua", "Ngân hàng"],
  paymentMethod: ["Phương thức thanh toán"],
  discountAmount: ["Tiền chiết khấu"],
  totalBeforeTax: ["Thành tiền chưa VAT", "Tiền trước VAT"],
  vatAmount: ["Tiền thuế VAT", "Thuế VAT"],
  totalAmount: ["Tổng tiền thanh toán", "Tổng tiền"],
  cccdan: ["CCCD/Căn cước công dân", "CCCD", "Căn cước công dân"],
  passport: ["Số hộ chiếu"],
  budgetUnitCode: ["Mã đơn vị qua ngân sách"],
  storeCode: ["Mã cửa hàng"],
  storeName: ["Tên cửa hàng"],
  quantity: ["Số lượng"],
} as const

const REQUIRED_COLUMNS: Array<keyof typeof COLUMN_ALIASES> = [
  "agencyCode",
  "invoiceSeries",
  "invoiceDate",
  "buyerCompany",
  "buyerTaxCode",
  "buyerAddress",
  "totalBeforeTax",
  "vatAmount",
  "totalAmount",
]

function buildHeaderIndex(headers: string[]) {
  const map = new Map<string, string>()

  headers.forEach((header) => {
    const key = normalize(header)
    if (key && !map.has(key)) {
      map.set(key, header)
    }
  })

  return map
}

function findHeader(
  headerIndex: Map<string, string>,
  aliases: readonly string[]
) {
  for (const alias of aliases) {
    const matchedHeader = headerIndex.get(normalize(alias))
    if (matchedHeader) return matchedHeader
  }

  return ""
}

function pickCellValue(
  row: Record<string, unknown>,
  headerIndex: Map<string, string>,
  aliases: readonly string[]
) {
  const header = findHeader(headerIndex, aliases)
  return header ? row[header] : ""
}

function cleanText(value: unknown) {
  return String(value ?? "").trim()
}

function getAgencyEmployee(agency: Agency | null) {
  if (!agency?.employeeId || typeof agency.employeeId === "string") return null
  return agency.employeeId as Employee
}

function getEmployeeDepartment(employee: Employee | null) {
  if (!employee?.departmentId || typeof employee.departmentId === "string") {
    return null
  }

  return employee.departmentId as Department
}

function getProductAccountingCode(product: ProductOption | null) {
  if (!product) return 0

  return Number(
    product.accountingAccountCode ||
      product.accountCode ||
      product.inv_accountCode ||
      0
  )
}

function extractErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message) {
    return error.message
  }

  if (
    typeof error === "object" &&
    error !== null &&
    "response" in error &&
    typeof error.response === "object" &&
    error.response !== null &&
    "data" in error.response &&
    typeof error.response.data === "object" &&
    error.response.data !== null
  ) {
    const responseData = error.response.data as {
      message?: string
      error?: string
    }

    return responseData.message || responseData.error || fallback
  }

  return fallback
}

export default function InvoiceBulkImport({
  receiptConfigs,
  onBack,
  onInvoicesCreated,
}: Props) {
  const inputRef = useRef<HTMLInputElement | null>(null)

  const [agencies, setAgencies] = useState<Agency[]>([])
  const [products, setProducts] = useState<ProductOption[]>([])
  const [banks, setBanks] = useState<Bank[]>([])
  const [catalogLoading, setCatalogLoading] = useState(false)

  const [selectedFileName, setSelectedFileName] = useState("")
  const [selectedProductId, setSelectedProductId] = useState("")
  const [excelRows, setExcelRows] = useState<BulkImportExcelRow[]>([])
  const [parsing, setParsing] = useState(false)
  const [creating, setCreating] = useState(false)
  const [submitErrors, setSubmitErrors] = useState<Record<string, string>>({})

  const [showSuccess, setShowSuccess] = useState(false)
  const [showError, setShowError] = useState(false)
  const [message, setMessage] = useState("")

  const showSuccessMessage = (text: string) => {
    setShowError(false)
    setMessage(text)
    setShowSuccess(true)
    setTimeout(() => setShowSuccess(false), 3500)
  }

  const showErrorMessage = (text: string) => {
    setShowSuccess(false)
    setMessage(text)
    setShowError(true)
    setTimeout(() => setShowError(false), 4500)
  }

  useEffect(() => {
    const fetchCatalogs = async () => {
      try {
        setCatalogLoading(true)

        const [agencyRes, productRes, bankRes] = await Promise.all([
          APIGetAgencies(),
          APIGetProducts(),
          APIGetBanks(),
        ])

        const nextAgencies = (
          Array.isArray(agencyRes?.data) ? agencyRes.data : []
        ).filter((item: Agency) => item?._id) as Agency[]

        const nextProducts = (
          Array.isArray(productRes?.data) ? productRes.data : []
        ).filter((item: ProductOption) => item?._id) as ProductOption[]

        const nextBanks = (
          Array.isArray(bankRes?.data) ? bankRes.data : []
        ).filter((item: Bank) => item?._id) as Bank[]

        setAgencies(nextAgencies)
        setProducts(nextProducts)
        setBanks(nextBanks)
      } catch (error) {
        console.error("Fetch bulk import catalogs error:", error)
        showErrorMessage("Không thể tải danh mục để import hóa đơn hàng loạt.")
      } finally {
        setCatalogLoading(false)
      }
    }

    fetchCatalogs()
  }, [])

  useEffect(() => {
    if (selectedProductId || products.length !== 1) return
    setSelectedProductId(products[0]._id)
  }, [products, selectedProductId])

  const selectedProduct = useMemo(() => {
    return products.find((item) => item._id === selectedProductId) || null
  }, [products, selectedProductId])

  const preparedRows = useMemo<PreparedImportRow[]>(() => {
    return excelRows.map((row) => {
      const errors: string[] = []
      const warnings: string[] = []

      const agencyCode = cleanText(row.agencyCode)
      const invoiceSeries = cleanText(row.invoiceSeries)
      const invoiceDate = normalizeDateInput(row.invoiceDate)
      const buyerCompany = cleanText(row.buyerCompany)
      const buyerName = cleanText(row.buyerName)
      const buyerTaxCode = cleanText(row.buyerTaxCode)
      const buyerAddress = cleanText(row.buyerAddress)
      const buyerEmail = cleanText(row.buyerEmail)
      const buyerBankAccount = cleanText(row.buyerBankAccount)
      const buyerBankName = cleanText(row.buyerBankName)
      const paymentMethod = cleanText(row.paymentMethod) || "CK"
      const currency = cleanText(row.currency) || "VND"
      const exchangeRate = toExcelNumber(row.exchangeRate) || 1
      const quantity = Math.max(
        1,
        roundInvoiceMoney(toExcelNumber(row.quantity || 1))
      )
      const totalBeforeTax = roundInvoiceMoney(
        toExcelNumber(row.totalBeforeTax)
      )
      const vatAmount = roundInvoiceMoney(toExcelNumber(row.vatAmount))
      const totalAmount = roundInvoiceMoney(
        toExcelNumber(row.totalAmount) || totalBeforeTax + vatAmount
      )

      const agency =
        agencies.find((item) => {
          const numberMatch =
            normalize(item.agencyNumber || "") === normalize(agencyCode)
          const nameMatch =
            normalize(item.agencyName || "") === normalize(agencyCode)

          return Boolean(numberMatch || nameMatch)
        }) || null

      const bank =
        banks.find(
          (item) =>
            normalize(item.inv_buyerBankName || "") === normalize(buyerBankName)
        ) || null

      const matchedReceiptConfig =
        receiptConfigs.find(
          (item) =>
            normalize(item.inv_invoiceSeries || "") === normalize(invoiceSeries)
        ) || null

      const product = selectedProduct
      const agencyEmployee = getAgencyEmployee(agency)
      const agencyDepartment = getEmployeeDepartment(agencyEmployee)

      if (!agencyCode) errors.push("Thiếu mã đại lý.")
      if (agencyCode && !agency) {
        errors.push(`Không tìm thấy đại lý cho mã "${agencyCode}".`)
      }

      if (!invoiceSeries) errors.push("Thiếu ký hiệu hóa đơn.")
      if (invoiceSeries && !matchedReceiptConfig) {
        errors.push(
          `Ký hiệu hóa đơn "${invoiceSeries}" chưa có trong cấu hình.`
        )
      }

      if (!invoiceDate) errors.push("Ngày lập hóa đơn không hợp lệ.")
      if (!buyerCompany) errors.push("Thiếu tên đơn vị mua.")
      if (!buyerTaxCode) errors.push("Thiếu mã số thuế người mua.")
      if (!buyerAddress) errors.push("Thiếu địa chỉ người mua.")
      if (!product) errors.push("Chưa chọn sản phẩm mặc định cho file import.")

      if (totalBeforeTax <= 0)
        errors.push("Thành tiền chưa VAT phải lớn hơn 0.")
      if (vatAmount < 0) errors.push("Tiền thuế VAT không hợp lệ.")
      if (totalAmount <= 0) errors.push("Tổng tiền thanh toán phải lớn hơn 0.")

      if (Math.abs(totalBeforeTax + vatAmount - totalAmount) > 1) {
        errors.push(
          "Tổng tiền thanh toán không khớp với tiền trước VAT và VAT."
        )
      }

      if (buyerBankName && !bank) {
        warnings.push(
          `Ngân hàng "${buyerBankName}" chưa có trong danh mục, sẽ lưu theo text từ file.`
        )
      }

      const payload =
        errors.length > 0 || !product || !agency
          ? null
          : {
              activationDate: invoiceDate || null,
              orderNumber: cleanText(row.lineCode),
              inv_invoiceSeries: invoiceSeries,
              inv_invoiceIssuedDate: invoiceDate,
              inv_currencyCode: currency,
              inv_exchangeRate: exchangeRate,
              inv_paymentMethodName: paymentMethod,
              agencyId: agency._id,
              employeeId: getId(agencyEmployee) || undefined,
              bankId: getId(bank) || undefined,
              inv_buyerTaxCode: buyerTaxCode,
              inv_buyerLegalName: buyerCompany,
              inv_buyerDisplayName: buyerName || buyerCompany,
              inv_buyerEmail: buyerEmail,
              inv_buyerAddressLine: buyerAddress,
              inv_buyerBankAccount: buyerBankAccount,
              inv_buyerBankName: bank?.inv_buyerBankName || buyerBankName,
              so_benh_an: "",
              key_api: "",
              cccdan: cleanText(row.cccdan),
              so_hchieu: cleanText(row.passport),
              mdvqhnsach_nmua: cleanText(row.budgetUnitCode),
              ma_ch: cleanText(row.storeCode),
              ten_ch: cleanText(row.storeName),
              inv_discountAmount: roundInvoiceMoney(row.discountAmount),
              inv_TotalAmountWithoutVAT: totalBeforeTax,
              inv_vatAmount: vatAmount,
              inv_TotalAmount: totalAmount,
              inv_quantity: quantity,
              inv_discountPercentage: 0,
              items: [
                {
                  productId: product._id,
                  product,
                  quantity,
                  inv_quantity: quantity,
                  revenue: totalBeforeTax,
                  capitalPrice: 0,
                  totalSalary: totalBeforeTax,
                  accountingAccountCode: getProductAccountingCode(product),
                },
              ],
              __clientSnapshot: {
                agency,
                department: agencyDepartment,
                employee: agencyEmployee,
                bank,
              },
              __clientPayment: {
                isPaid: false,
                paidAmount: 0,
                paidDate: "",
                remainingAmount: totalAmount,
              },
            }

      return {
        id: row.id,
        rowNumber: row.rowNumber,
        stt: row.stt,
        lineCode: row.lineCode,
        agencyCode,
        buyerCompany,
        buyerTaxCode,
        invoiceSeries,
        invoiceDate,
        totalAmount,
        quantity,
        agency,
        bank,
        product,
        warnings,
        errors: submitErrors[row.id]
          ? [...errors, `Lỗi tạo hóa đơn: ${submitErrors[row.id]}`]
          : errors,
        payload,
      }
    })
  }, [
    agencies,
    banks,
    excelRows,
    receiptConfigs,
    selectedProduct,
    submitErrors,
  ])

  const validRows = preparedRows.filter((item) => item.errors.length === 0)
  const invalidRows = preparedRows.length - validRows.length

  const handleClearFile = () => {
    setSelectedFileName("")
    setExcelRows([])
    setSubmitErrors({})
    if (inputRef.current) {
      inputRef.current.value = ""
    }
  }

  const parseFile = async (file: File) => {
    try {
      setParsing(true)
      setSubmitErrors({})

      const buffer = await file.arrayBuffer()
      const workbook = XLSX.read(buffer, {
        type: "array",
        cellDates: true,
      })

      const firstSheetName = workbook.SheetNames[0]
      if (!firstSheetName) {
        throw new Error("File Excel không có sheet dữ liệu.")
      }

      const worksheet = workbook.Sheets[firstSheetName]
      const rawRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(
        worksheet,
        {
          defval: "",
          raw: false,
        }
      )

      if (!rawRows.length) {
        throw new Error("File Excel chưa có dữ liệu để import.")
      }

      const headerIndex = buildHeaderIndex(Object.keys(rawRows[0]))
      const missingHeaders = REQUIRED_COLUMNS.filter(
        (field) => !findHeader(headerIndex, COLUMN_ALIASES[field])
      )

      if (missingHeaders.length) {
        throw new Error(
          `Thiếu cột bắt buộc: ${missingHeaders
            .map((field) => COLUMN_ALIASES[field][0])
            .join(", ")}.`
        )
      }

      const nextRows = rawRows.map((row, index) => ({
        id: `${Date.now()}-${index}`,
        rowNumber: index + 2,
        stt: cleanText(pickCellValue(row, headerIndex, COLUMN_ALIASES.stt)),
        lineCode: cleanText(
          pickCellValue(row, headerIndex, COLUMN_ALIASES.lineCode)
        ),
        agencyCode: cleanText(
          pickCellValue(row, headerIndex, COLUMN_ALIASES.agencyCode)
        ),
        currency: cleanText(
          pickCellValue(row, headerIndex, COLUMN_ALIASES.currency)
        ),
        exchangeRate: toExcelNumber(
          pickCellValue(row, headerIndex, COLUMN_ALIASES.exchangeRate)
        ),
        invoiceSeries: cleanText(
          pickCellValue(row, headerIndex, COLUMN_ALIASES.invoiceSeries)
        ),
        invoiceDate: cleanText(
          pickCellValue(row, headerIndex, COLUMN_ALIASES.invoiceDate)
        ),
        buyerName: cleanText(
          pickCellValue(row, headerIndex, COLUMN_ALIASES.buyerName)
        ),
        buyerCompany: cleanText(
          pickCellValue(row, headerIndex, COLUMN_ALIASES.buyerCompany)
        ),
        buyerTaxCode: cleanText(
          pickCellValue(row, headerIndex, COLUMN_ALIASES.buyerTaxCode)
        ),
        buyerAddress: cleanText(
          pickCellValue(row, headerIndex, COLUMN_ALIASES.buyerAddress)
        ),
        buyerEmail: cleanText(
          pickCellValue(row, headerIndex, COLUMN_ALIASES.buyerEmail)
        ),
        buyerBankAccount: cleanText(
          pickCellValue(row, headerIndex, COLUMN_ALIASES.buyerBankAccount)
        ),
        buyerBankName: cleanText(
          pickCellValue(row, headerIndex, COLUMN_ALIASES.buyerBankName)
        ),
        paymentMethod: cleanText(
          pickCellValue(row, headerIndex, COLUMN_ALIASES.paymentMethod)
        ),
        discountAmount: toExcelNumber(
          pickCellValue(row, headerIndex, COLUMN_ALIASES.discountAmount)
        ),
        totalBeforeTax: toExcelNumber(
          pickCellValue(row, headerIndex, COLUMN_ALIASES.totalBeforeTax)
        ),
        vatAmount: toExcelNumber(
          pickCellValue(row, headerIndex, COLUMN_ALIASES.vatAmount)
        ),
        totalAmount: toExcelNumber(
          pickCellValue(row, headerIndex, COLUMN_ALIASES.totalAmount)
        ),
        cccdan: cleanText(
          pickCellValue(row, headerIndex, COLUMN_ALIASES.cccdan)
        ),
        passport: cleanText(
          pickCellValue(row, headerIndex, COLUMN_ALIASES.passport)
        ),
        budgetUnitCode: cleanText(
          pickCellValue(row, headerIndex, COLUMN_ALIASES.budgetUnitCode)
        ),
        storeCode: cleanText(
          pickCellValue(row, headerIndex, COLUMN_ALIASES.storeCode)
        ),
        storeName: cleanText(
          pickCellValue(row, headerIndex, COLUMN_ALIASES.storeName)
        ),
        quantity: toExcelNumber(
          pickCellValue(row, headerIndex, COLUMN_ALIASES.quantity)
        ),
      }))

      setSelectedFileName(file.name)
      setExcelRows(nextRows)
      showSuccessMessage(
        `Đã đọc file ${file.name}. Vui lòng kiểm tra lại trước khi tạo hóa đơn.`
      )
    } catch (error: unknown) {
      console.error("Parse bulk invoice file error:", error)
      handleClearFile()
      showErrorMessage(
        extractErrorMessage(error, "Không thể đọc file Excel import hóa đơn.")
      )
    } finally {
      setParsing(false)
    }
  }

  const handleFileChange = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0]
    if (!file) return
    await parseFile(file)
  }

  const handleCreateInvoices = async () => {
    if (!preparedRows.length) {
      showErrorMessage("Vui lòng chọn file Excel trước khi tạo hóa đơn.")
      return
    }

    if (invalidRows > 0) {
      showErrorMessage(
        "File import còn dòng lỗi. Vui lòng xử lý hết lỗi trước khi tạo hóa đơn."
      )
      return
    }

    try {
      setCreating(true)
      setSubmitErrors({})

      const nextSubmitErrors: Record<string, string> = {}
      let successCount = 0

      for (const row of validRows) {
        try {
          if (!row.payload) {
            throw new Error("Dòng import chưa build được payload hợp lệ.")
          }

          await APICreateSaleTransaction(buildCreateInvoiceApiBody(row.payload))
          successCount += 1
        } catch (error: unknown) {
          nextSubmitErrors[row.id] = extractErrorMessage(
            error,
            "Không tạo được hóa đơn cho dòng này."
          )
        }
      }

      setSubmitErrors(nextSubmitErrors)

      if (successCount > 0) {
        await onInvoicesCreated?.()
      }

      const failedCount = Object.keys(nextSubmitErrors).length

      if (failedCount > 0) {
        showErrorMessage(
          `Đã tạo ${successCount}/${validRows.length} hóa đơn. Vui lòng kiểm tra lại các dòng bị lỗi.`
        )
        return
      }

      showSuccessMessage(
        `Đã tạo thành công ${successCount} hóa đơn. Hệ thống sẽ quay về danh sách sau giây lát.`
      )

      setTimeout(() => {
        onBack()
      }, 1500)
    } finally {
      setCreating(false)
    }
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-[#edf1f4]">
      <div className="flex items-center justify-between border-b border-slate-300 bg-white px-4 py-2">
        <div className="text-[15px] font-bold text-slate-800">
          Tạo Hóa Đơn Hàng Loạt
        </div>

        <button
          type="button"
          onClick={onBack}
          className="inline-flex h-9 items-center gap-2 rounded-md border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
        >
          <ArrowLeft size={16} />
          Quay lại danh sách
        </button>
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-auto p-4">
        <div className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-start gap-3">
              <div className="rounded-2xl bg-emerald-50 p-3 text-emerald-700">
                <FileSpreadsheet size={22} />
              </div>

              <div className="flex-1">
                <div className="text-lg font-bold text-slate-900">
                  Upload File Excel
                </div>
                <div className="mt-1 text-sm text-slate-600">
                  Chọn file Excel để hệ thống đọc dữ liệu, kiểm tra mapping danh
                  mục và hiển thị xem trước trước khi tạo hóa đơn.
                </div>
              </div>
            </div>

            <input
              ref={inputRef}
              type="file"
              accept=".xlsx,.xls"
              className="hidden"
              onChange={handleFileChange}
            />

            <div className="mt-5 flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() => inputRef.current?.click()}
                disabled={parsing || creating}
                className="inline-flex h-10 items-center gap-2 rounded-xl border border-indigo-300 bg-indigo-50 px-4 text-sm font-semibold text-indigo-700 transition hover:bg-indigo-100 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {parsing ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <UploadCloud size={16} />
                )}
                {parsing ? "Đang đọc file..." : "Chọn file Excel"}
              </button>

              {selectedFileName ? (
                <>
                  <div className="rounded-xl bg-slate-100 px-3 py-2 text-sm font-medium text-slate-700">
                    {selectedFileName}
                  </div>
                  <button
                    type="button"
                    onClick={handleClearFile}
                    disabled={parsing || creating}
                    className="text-sm font-medium text-slate-500 underline underline-offset-2 hover:text-slate-700 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    Xóa file
                  </button>
                </>
              ) : (
                <div className="text-sm text-slate-500">
                  Chưa chọn file import.
                </div>
              )}
            </div>

            <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="text-sm font-semibold text-slate-800">
                Cột tối thiểu hệ thống đang đọc
              </div>
              <div className="mt-2 flex flex-wrap gap-2 text-xs text-slate-600">
                {REQUIRED_COLUMNS.map((field) => (
                  <span
                    key={field}
                    className="rounded-full border border-slate-200 bg-white px-3 py-1"
                  >
                    {COLUMN_ALIASES[field][0]}
                  </span>
                ))}
              </div>
            </div>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="text-lg font-bold text-slate-900">
              Thiết lập import
            </div>

            <div className="mt-4">
              <label
                htmlFor="bulk-import-product"
                className="mb-2 block text-sm font-semibold text-slate-700"
              >
                Sản phẩm mặc định áp dụng cho các dòng import
              </label>
              <select
                id="bulk-import-product"
                value={selectedProductId}
                disabled={catalogLoading || creating}
                onChange={(event) => setSelectedProductId(event.target.value)}
                className="h-10 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm text-slate-800 outline-none focus:border-indigo-500 disabled:bg-slate-100"
              >
                <option value="">Chọn sản phẩm</option>
                {products.map((product) => (
                  <option key={product._id} value={product._id}>
                    {[product.inv_itemCode, product.inv_itemName]
                      .filter(Boolean)
                      .join(" - ")}
                  </option>
                ))}
              </select>

              <div className="mt-2 text-xs text-slate-500">
                File import hiện chưa có cột sản phẩm, nên hệ thống sẽ dùng một
                sản phẩm mặc định cho toàn bộ các dòng trong file.
              </div>
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl bg-slate-50 p-4">
                <div className="text-xs uppercase tracking-wide text-slate-500">
                  Tổng dòng
                </div>
                <div className="mt-2 text-2xl font-bold text-slate-900">
                  {preparedRows.length}
                </div>
              </div>

              <div className="rounded-2xl bg-emerald-50 p-4">
                <div className="text-xs uppercase tracking-wide text-emerald-700">
                  Hợp lệ
                </div>
                <div className="mt-2 text-2xl font-bold text-emerald-700">
                  {validRows.length}
                </div>
              </div>

              <div className="bg-rose-50 rounded-2xl p-4">
                <div className="text-rose-700 text-xs uppercase tracking-wide">
                  Có lỗi
                </div>
                <div className="text-rose-700 mt-2 text-2xl font-bold">
                  {invalidRows}
                </div>
              </div>

              <div className="rounded-2xl bg-indigo-50 p-4">
                <div className="text-xs uppercase tracking-wide text-indigo-700">
                  Giá trị file
                </div>
                <div className="mt-2 text-lg font-bold text-indigo-700">
                  {formatMoney(
                    preparedRows.reduce(
                      (sum, item) => sum + item.totalAmount,
                      0
                    )
                  )}
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={handleCreateInvoices}
              disabled={
                creating ||
                parsing ||
                catalogLoading ||
                !preparedRows.length ||
                invalidRows > 0
              }
              className="mt-5 inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 text-sm font-bold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-slate-300"
            >
              {creating ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  Đang tạo hóa đơn...
                </>
              ) : (
                <>Tạo hóa đơn hàng loạt</>
              )}
            </button>

            {invalidRows > 0 && (
              <div className="text-rose-600 mt-3 text-sm">
                Cần xử lý hết lỗi trong bảng xem trước trước khi bấm tạo hóa
                đơn.
              </div>
            )}
          </section>
        </div>

        <section className="min-h-0 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="text-lg font-bold text-slate-900">
                Xem trước dữ liệu import
              </div>
              <div className="mt-1 text-sm text-slate-600">
                Kiểm tra mapping danh mục và nội dung từng dòng trước khi tạo
                hóa đơn.
              </div>
            </div>
          </div>

          {preparedRows.length === 0 ? (
            <div className="mt-5 rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-10 text-center text-sm text-slate-500">
              Chọn file Excel để hiển thị dữ liệu xem trước.
            </div>
          ) : (
            <div className="mt-5 overflow-auto rounded-2xl border border-slate-200">
              <table className="min-w-full text-sm">
                <thead className="bg-slate-50 text-slate-700">
                  <tr>
                    <th className="whitespace-nowrap border-b border-slate-200 px-3 py-3 text-left font-semibold">
                      Dòng
                    </th>
                    <th className="whitespace-nowrap border-b border-slate-200 px-3 py-3 text-left font-semibold">
                      Mã dòng
                    </th>
                    <th className="whitespace-nowrap border-b border-slate-200 px-3 py-3 text-left font-semibold">
                      Mã đại lý
                    </th>
                    <th className="whitespace-nowrap border-b border-slate-200 px-3 py-3 text-left font-semibold">
                      Đơn vị mua
                    </th>
                    <th className="whitespace-nowrap border-b border-slate-200 px-3 py-3 text-left font-semibold">
                      MST
                    </th>
                    <th className="whitespace-nowrap border-b border-slate-200 px-3 py-3 text-left font-semibold">
                      Ký hiệu HĐ
                    </th>
                    <th className="whitespace-nowrap border-b border-slate-200 px-3 py-3 text-left font-semibold">
                      Ngày HĐ
                    </th>
                    <th className="whitespace-nowrap border-b border-slate-200 px-3 py-3 text-right font-semibold">
                      Số lượng
                    </th>
                    <th className="whitespace-nowrap border-b border-slate-200 px-3 py-3 text-right font-semibold">
                      Tổng tiền
                    </th>
                    <th className="whitespace-nowrap border-b border-slate-200 px-3 py-3 text-left font-semibold">
                      Trạng thái
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {preparedRows.map((row) => {
                    const isValid = row.errors.length === 0

                    return (
                      <tr
                        key={row.id}
                        className={isValid ? "bg-white" : "bg-rose-50/50"}
                      >
                        <td className="border-b border-slate-100 px-3 py-3 align-top font-semibold text-slate-700">
                          {row.rowNumber}
                        </td>
                        <td className="border-b border-slate-100 px-3 py-3 align-top text-slate-700">
                          {row.lineCode || row.stt || "-"}
                        </td>
                        <td className="border-b border-slate-100 px-3 py-3 align-top text-slate-700">
                          <div className="font-semibold">
                            {row.agencyCode || "-"}
                          </div>
                          <div className="mt-1 text-xs text-slate-500">
                            {row.agency?.agencyName || "Chưa map đại lý"}
                          </div>
                        </td>
                        <td className="border-b border-slate-100 px-3 py-3 align-top text-slate-700">
                          {row.buyerCompany || "-"}
                        </td>
                        <td className="border-b border-slate-100 px-3 py-3 align-top text-slate-700">
                          {row.buyerTaxCode || "-"}
                        </td>
                        <td className="border-b border-slate-100 px-3 py-3 align-top text-slate-700">
                          {row.invoiceSeries || "-"}
                        </td>
                        <td className="border-b border-slate-100 px-3 py-3 align-top text-slate-700">
                          {row.invoiceDate || "-"}
                        </td>
                        <td className="border-b border-slate-100 px-3 py-3 text-right align-top font-semibold text-slate-700">
                          {formatMoney(row.quantity)}
                        </td>
                        <td className="border-b border-slate-100 px-3 py-3 text-right align-top font-semibold text-slate-900">
                          {formatMoney(row.totalAmount)}
                        </td>
                        <td className="border-b border-slate-100 px-3 py-3 align-top">
                          <div
                            className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${
                              isValid
                                ? "bg-emerald-100 text-emerald-700"
                                : "bg-rose-100 text-rose-700"
                            }`}
                          >
                            {isValid ? "Hợp lệ" : "Có lỗi"}
                          </div>

                          {row.product && (
                            <div className="mt-2 text-xs text-slate-500">
                              Sản phẩm:{" "}
                              <span className="font-medium text-slate-700">
                                {[
                                  row.product.inv_itemCode,
                                  row.product.inv_itemName,
                                ]
                                  .filter(Boolean)
                                  .join(" - ")}
                              </span>
                            </div>
                          )}

                          {row.errors.length > 0 && (
                            <div className="text-rose-600 mt-2 space-y-1 text-xs">
                              {row.errors.map((error) => (
                                <div key={error}>{error}</div>
                              ))}
                            </div>
                          )}

                          {row.warnings.length > 0 && (
                            <div className="text-amber-600 mt-2 space-y-1 text-xs">
                              {row.warnings.map((warning) => (
                                <div key={warning}>{warning}</div>
                              ))}
                            </div>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>

      {showSuccess && <AlertSuccess description={message} />}
      {showError && <AlertError description={message} />}
    </div>
  )
}
