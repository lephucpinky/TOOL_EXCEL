"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import * as XLSX from "xlsx-js-style"
import {
  ArrowLeft,
  Download,
  FileSpreadsheet,
  Loader2,
  UploadCloud,
} from "lucide-react"

import AlertError from "@/components/alert/AlertError"
import AlertSuccess from "@/components/alert/AlertSuccess"
import { APIGetAgencies } from "@/services/agency"
import { APIGetBanks } from "@/services/bank"
import { APIGetAllProducts } from "@/services/product"
import { APICreateSaleTransaction } from "@/services/saleTransaction"
import { getErrorMessage } from "@/store/utils/crud"
import type { Agency } from "@/types/agency"
import type { Bank } from "@/types/bank"
import type { ReceiptInvoiceConfig } from "@/types/receiptInvoice"
import { normalize, toNumber as toExcelNumber } from "@/utils/excel"
import {
  FIXED_RECEIPT_INVOICE_CONFIG,
  formatMoney,
  getId,
  normalizeDateInput,
  roundInvoiceMoney,
} from "@/utils/invoice"
import { buildCreateInvoiceApiBody } from "@/utils/invoicePayload"
import {
  COLUMN_ALIASES,
  REQUIRED_COLUMNS,
  buildHeaderIndex,
  cleanText,
  findHeader,
  findProductByExcelValue,
  getAgencyEmployee,
  getProductAccountingCode,
  pickCellValue,
  type BulkImportExcelRow,
  type PreparedImportRow,
  type ProductOption,
} from "@/components/minvoice/invoiceBulkImportUtils"

type Props = {
  receiptConfigs: ReceiptInvoiceConfig[]
  onBack: () => void
  onInvoicesCreated?: () => Promise<void> | void
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

  const [excelRows, setExcelRows] = useState<BulkImportExcelRow[]>([])
  const [parsing, setParsing] = useState(false)
  const [creating, setCreating] = useState(false)
  const [submitErrors, setSubmitErrors] = useState<Record<string, string>>({})
  const [createdRowIds, setCreatedRowIds] = useState<Record<string, string>>({})

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
          APIGetAllProducts(),
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

  const preparedRows = useMemo<PreparedImportRow[]>(() => {
    return excelRows.map((row) => {
      const errors: string[] = []
      const warnings: string[] = []

      const agencyCode = cleanText(row.agencyCode)
      const productCode = cleanText(row.productCode)
      const fixedReceiptConfig =
        receiptConfigs[0] || FIXED_RECEIPT_INVOICE_CONFIG
      const invoiceSeries =
        cleanText(row.invoiceSeries) ||
        cleanText(fixedReceiptConfig.inv_invoiceSeries)
      const rawInvoiceDate = cleanText(row.invoiceDate)
      const invoiceDate = normalizeDateInput(rawInvoiceDate)
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
      const rawQuantity = cleanText(row.quantity)
      const quantity = roundInvoiceMoney(toExcelNumber(row.quantity))
      const totalBeforeTax = roundInvoiceMoney(
        toExcelNumber(row.totalBeforeTax)
      )
      const vatAmount = roundInvoiceMoney(toExcelNumber(row.vatAmount))
      const totalAmount = roundInvoiceMoney(
        toExcelNumber(row.totalAmount) || totalBeforeTax + vatAmount
      )

      const agency =
        agencies.find((item) => {
          const agencyNumberMatch =
            normalize((item as any).agencyNumber || "") ===
            normalize(agencyCode)
          const codeMatch =
            normalize(item.inv_agencyName || "") === normalize(agencyCode)
          const nameMatch =
            normalize(item.agencyName || "") === normalize(agencyCode)

          return Boolean(agencyNumberMatch || codeMatch || nameMatch)
        }) || null

      const bank =
        banks.find(
          (item) =>
            normalize(item.inv_buyerBankName || "") === normalize(buyerBankName)
        ) || null

      const product = findProductByExcelValue(products, productCode)
      const agencyEmployee = getAgencyEmployee(agency)

      if (!agencyCode) errors.push("Thiếu mã đại lý.")
      if (agencyCode && !agency) {
        errors.push(`Không tìm thấy đại lý cho mã "${agencyCode}".`)
      }

      if (!invoiceSeries) errors.push("Thiếu ký hiệu hóa đơn.")
      if (!rawInvoiceDate) {
        errors.push("Thiếu ngày kích hoạt.")
      } else if (!invoiceDate) {
        errors.push(`Ngày kích hoạt "${rawInvoiceDate}" không hợp lệ.`)
      }

      if (!buyerCompany) errors.push("Thiếu tên đơn vị mua.")
      if (!buyerTaxCode) errors.push("Thiếu mã số thuế người mua.")
      if (!buyerEmail) errors.push("Thiếu email người mua.")
      if (!buyerAddress) errors.push("Thiếu địa chỉ người mua.")
      if (!productCode) errors.push("Thiếu sản phẩm.")
      if (productCode && !product) {
        errors.push(`Không tìm thấy sản phẩm cho giá trị "${productCode}".`)
      }

      if (!rawQuantity) {
        errors.push("Thiếu số lượng sản phẩm.")
      } else if (quantity <= 0) {
        errors.push("Số lượng sản phẩm phải lớn hơn 0.")
      }

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
              inv_invoiceSeries: invoiceSeries,
              activationDate: invoiceDate,
              inv_currencyCode: currency,
              inv_exchangeRate: exchangeRate,
              inv_paymentMethodName: paymentMethod,
              agencyId: agency._id,
              employeeId: getId(agencyEmployee) || undefined,
              amountCollected: 0,
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
                  productCode: product.inv_itemCode,
                  productName: product.inv_itemName,
                  unit: product.inv_unitCode,
                  quantity,
                  inv_quantity: quantity,
                  price:
                    roundInvoiceMoney(product.inv_unitPrice) ||
                    roundInvoiceMoney(totalAmount / (quantity || 1)),
                  unitPrice:
                    roundInvoiceMoney(product.inv_unitPrice) ||
                    roundInvoiceMoney(totalAmount / (quantity || 1)),
                  inv_unitPrice: roundInvoiceMoney(product.inv_unitPrice),
                  ma_thue: product.ma_thue,
                  taxRate: product.ma_thue,
                  discountPercentage: 0,
                  revenue: totalBeforeTax,
                  capitalPrice: 0,
                  totalSalary: totalBeforeTax,
                  accountingAccountCode: getProductAccountingCode(product),
                },
              ],
            }

      return {
        id: row.id,
        rowNumber: row.rowNumber,
        stt: row.stt,
        lineCode: row.lineCode,
        agencyCode,
        productCode,
        buyerCompany,
        buyerTaxCode,
        buyerEmail,
        buyerAddress,
        invoiceSeries,
        invoiceDate,
        totalBeforeTax,
        vatAmount,
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
  }, [agencies, banks, excelRows, products, receiptConfigs, submitErrors])

  const pendingRows = preparedRows.filter((item) => !createdRowIds[item.id])
  const validRows = pendingRows.filter((item) => item.errors.length === 0)
  const invalidRows = pendingRows.length - validRows.length
  const createdRowsCount = preparedRows.length - pendingRows.length

  const updateImportRow = <K extends keyof BulkImportExcelRow>(
    rowId: string,
    field: K,
    value: BulkImportExcelRow[K]
  ) => {
    if (createdRowIds[rowId]) return

    setExcelRows((currentRows) =>
      currentRows.map((row) =>
        row.id === rowId ? { ...row, [field]: value } : row
      )
    )

    setSubmitErrors((currentErrors) => {
      if (!currentErrors[rowId]) return currentErrors

      const nextErrors = { ...currentErrors }
      delete nextErrors[rowId]

      return nextErrors
    })
  }

  const handleClearFile = () => {
    setSelectedFileName("")
    setExcelRows([])
    setSubmitErrors({})
    setCreatedRowIds({})
    if (inputRef.current) {
      inputRef.current.value = ""
    }
  }

  const handleDownloadTemplate = () => {
    try {
      const fields = REQUIRED_COLUMNS
      const headers = fields.map((field) => COLUMN_ALIASES[field][0])
      const workbook = XLSX.utils.book_new()
      const importSheet = XLSX.utils.aoa_to_sheet([headers])

      importSheet["!cols"] = fields.map((field) => ({
        wch:
          field === "buyerAddress"
            ? 32
            : field === "buyerCompany" || field === "productCode"
              ? 26
              : field === "buyerEmail" || field === "buyerBankName"
                ? 24
                : 18,
      }))
      importSheet["!autofilter"] = {
        ref: XLSX.utils.encode_range({
          s: { r: 0, c: 0 },
          e: { r: 0, c: headers.length - 1 },
        }),
      }

      fields.forEach((field, index) => {
        const cellRef = XLSX.utils.encode_cell({ r: 0, c: index })
        const cell = (importSheet as any)[cellRef]

        if (!cell) return

        cell.s = {
          font: { bold: true, color: { rgb: "FFFFFF" } },
          fill: {
            fgColor: { rgb: "2563EB" },
          },
          alignment: {
            horizontal: "center",
            vertical: "center",
            wrapText: true,
          },
          border: {
            top: { style: "thin", color: { rgb: "CBD5E1" } },
            bottom: { style: "thin", color: { rgb: "CBD5E1" } },
            left: { style: "thin", color: { rgb: "CBD5E1" } },
            right: { style: "thin", color: { rgb: "CBD5E1" } },
          },
        }
      })

      XLSX.utils.book_append_sheet(workbook, importSheet, "Import hoa don")

      XLSX.writeFile(workbook, "mau-tao-hoa-don-hang-loat.xlsx", {
        bookType: "xlsx",
        cellStyles: true,
      })
    } catch (error) {
      console.error("Download bulk import template error:", error)
      showErrorMessage("Không thể tải mẫu Excel tạo hóa đơn hàng loạt.")
    }
  }

  const parseFile = async (file: File) => {
    try {
      setParsing(true)
      setSubmitErrors({})
      setCreatedRowIds({})

      const buffer = await file.arrayBuffer()
      const workbook = XLSX.read(buffer, {
        type: "array",
        cellDates: true,
        dateNF: "yyyy-mm-dd",
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
        productCode: cleanText(
          pickCellValue(row, headerIndex, COLUMN_ALIASES.productCode)
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
      handleClearFile()
      showErrorMessage(
        getErrorMessage(error, "Không thể đọc file Excel import hóa đơn.")
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

    if (!pendingRows.length) {
      showSuccessMessage("Tất cả dòng trong file đã được tạo hóa đơn.")
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
      const nextCreatedRowIds = { ...createdRowIds }
      let successCount = 0

      for (const row of validRows) {
        try {
          if (!row.payload) {
            throw new Error("Dòng import chưa build được payload hợp lệ.")
          }

          const response = await APICreateSaleTransaction(
            buildCreateInvoiceApiBody(row.payload)
          )
          const createdOrderNumber = String(
            (response as any)?.data?.orderNumber ||
              (response as any)?.content?.orderNumber ||
              (response as any)?.orderNumber ||
              ""
          ).trim()

          nextCreatedRowIds[row.id] = createdOrderNumber || "Đã tạo"
          successCount += 1
        } catch (error: unknown) {
          nextSubmitErrors[row.id] = getErrorMessage(
            error,
            "Không tạo được hóa đơn cho dòng này."
          )
        }
      }

      setSubmitErrors(nextSubmitErrors)
      setCreatedRowIds(nextCreatedRowIds)

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
        `Đã tạo thành công ${successCount} hóa đơn. Các dòng đã tạo vẫn giữ đúng vị trí trong bảng.`
      )
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
                onClick={handleDownloadTemplate}
                disabled={parsing || creating}
                className="inline-flex h-10 items-center gap-2 rounded-xl border border-emerald-300 bg-emerald-50 px-4 text-sm font-semibold text-emerald-700 transition hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <Download size={16} />
                Tải mẫu Excel
              </button>

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
                Cột bắt buộc trong mẫu import
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

            <div className="mt-4 rounded-2xl border border-indigo-100 bg-indigo-50 p-4">
              <div className="text-sm font-semibold text-indigo-800">
                Sản phẩm được lấy trực tiếp từ file Excel
              </div>

              <div className="mt-2 text-xs leading-5 text-indigo-700">
                File Excel cần có cột <b>Mã sản phẩm</b> hoặc <b>Sản phẩm</b>.
                Hệ thống sẽ tự đối chiếu với danh mục sản phẩm theo mã sản phẩm
                hoặc tên sản phẩm trước khi tạo hóa đơn hàng loạt.
              </div>

              <div className="mt-3 text-xs text-slate-600">
                Danh mục sản phẩm hiện có:{" "}
                <span className="font-bold text-slate-900">
                  {products.length}
                </span>
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
                  Chờ tạo
                </div>
                <div className="mt-2 text-2xl font-bold text-emerald-700">
                  {validRows.length}
                </div>
              </div>

              <div className="rounded-2xl bg-rose-50 p-4">
                <div className="text-xs uppercase tracking-wide text-rose-700">
                  Có lỗi
                </div>
                <div className="mt-2 text-2xl font-bold text-rose-700">
                  {invalidRows}
                </div>
              </div>

              <div className="rounded-2xl bg-blue-50 p-4">
                <div className="text-xs uppercase tracking-wide text-blue-700">
                  Đã tạo
                </div>
                <div className="mt-2 text-2xl font-bold text-blue-700">
                  {createdRowsCount}
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
                !validRows.length ||
                invalidRows > 0
              }
              className="mt-5 inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 text-sm font-bold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-slate-300"
            >
              {creating ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  Đang tạo hóa đơn...
                </>
              ) : !pendingRows.length && preparedRows.length ? (
                <>Đã tạo hết hóa đơn</>
              ) : (
                <>Tạo hóa đơn hàng loạt</>
              )}
            </button>

            {invalidRows > 0 && (
              <div className="mt-3 text-sm text-rose-600">
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
              <table className="min-w-[2050px] text-sm">
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
                      Sản phẩm
                    </th>
                    <th className="whitespace-nowrap border-b border-slate-200 px-3 py-3 text-left font-semibold">
                      Đơn vị mua
                    </th>
                    <th className="whitespace-nowrap border-b border-slate-200 px-3 py-3 text-left font-semibold">
                      MST
                    </th>
                    <th className="whitespace-nowrap border-b border-slate-200 px-3 py-3 text-left font-semibold">
                      Email
                    </th>
                    <th className="whitespace-nowrap border-b border-slate-200 px-3 py-3 text-left font-semibold">
                      Địa chỉ
                    </th>
                    <th className="whitespace-nowrap border-b border-slate-200 px-3 py-3 text-left font-semibold">
                      Ký hiệu HĐ
                    </th>
                    <th className="whitespace-nowrap border-b border-slate-200 px-3 py-3 text-left font-semibold">
                      Ngày kích hoạt
                    </th>
                    <th className="whitespace-nowrap border-b border-slate-200 px-3 py-3 text-right font-semibold">
                      Số lượng
                    </th>
                    <th className="whitespace-nowrap border-b border-slate-200 px-3 py-3 text-right font-semibold">
                      Trước VAT
                    </th>
                    <th className="whitespace-nowrap border-b border-slate-200 px-3 py-3 text-right font-semibold">
                      VAT
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
                  {preparedRows.map((row, index) => {
                    const sourceRow = excelRows[index] || null
                    const isValid = row.errors.length === 0
                    const createdLabel = createdRowIds[row.id]
                    const isCreated = Boolean(createdLabel)
                    const rowDisabled = creating || isCreated

                    return (
                      <tr
                        key={row.id}
                        className={
                          isCreated
                            ? "bg-blue-50/40"
                            : isValid
                              ? "bg-white"
                              : "bg-rose-50/50"
                        }
                      >
                        <td className="border-b border-slate-100 px-3 py-3 align-top font-semibold text-slate-700">
                          {row.rowNumber}
                        </td>
                        <td className="border-b border-slate-100 px-3 py-3 align-top">
                          <input
                            value={cleanText(
                              sourceRow?.lineCode || row.lineCode
                            )}
                            onChange={(event) =>
                              updateImportRow(
                                row.id,
                                "lineCode",
                                event.target.value
                              )
                            }
                            disabled={rowDisabled}
                            className="h-8 w-28 rounded border border-slate-300 bg-white px-2 text-xs text-slate-800 outline-none focus:border-indigo-500 disabled:border-slate-200 disabled:bg-slate-100 disabled:text-slate-500"
                          />
                        </td>
                        <td className="border-b border-slate-100 px-3 py-3 align-top">
                          <input
                            value={cleanText(
                              sourceRow?.agencyCode || row.agencyCode
                            )}
                            onChange={(event) =>
                              updateImportRow(
                                row.id,
                                "agencyCode",
                                event.target.value
                              )
                            }
                            disabled={rowDisabled}
                            className="h-8 w-32 rounded border border-slate-300 bg-white px-2 text-xs font-semibold text-slate-800 outline-none focus:border-indigo-500 disabled:border-slate-200 disabled:bg-slate-100 disabled:text-slate-500"
                          />
                          <div className="mt-1 text-xs text-slate-500">
                            {row.agency?.agencyName || "Chưa map đại lý"}
                          </div>
                        </td>
                        <td className="border-b border-slate-100 px-3 py-3 align-top">
                          <input
                            value={cleanText(
                              sourceRow?.productCode || row.productCode
                            )}
                            onChange={(event) =>
                              updateImportRow(
                                row.id,
                                "productCode",
                                event.target.value
                              )
                            }
                            disabled={rowDisabled}
                            className="h-8 w-36 rounded border border-slate-300 bg-white px-2 text-xs font-semibold text-slate-800 outline-none focus:border-indigo-500 disabled:border-slate-200 disabled:bg-slate-100 disabled:text-slate-500"
                          />
                          <div className="mt-1 text-xs text-slate-500">
                            {row.product
                              ? [
                                  row.product.inv_itemCode,
                                  row.product.inv_itemProduct,
                                  row.product.inv_itemName,
                                ]
                                  .filter(Boolean)
                                  .join(" - ")
                              : "Chưa map sản phẩm"}
                          </div>
                        </td>
                        <td className="border-b border-slate-100 px-3 py-3 align-top">
                          <input
                            value={cleanText(
                              sourceRow?.buyerCompany || row.buyerCompany
                            )}
                            onChange={(event) =>
                              updateImportRow(
                                row.id,
                                "buyerCompany",
                                event.target.value
                              )
                            }
                            disabled={rowDisabled}
                            className="h-8 w-52 rounded border border-slate-300 bg-white px-2 text-xs text-slate-800 outline-none focus:border-indigo-500 disabled:border-slate-200 disabled:bg-slate-100 disabled:text-slate-500"
                          />
                        </td>
                        <td className="border-b border-slate-100 px-3 py-3 align-top">
                          <input
                            value={cleanText(
                              sourceRow?.buyerTaxCode || row.buyerTaxCode
                            )}
                            onChange={(event) =>
                              updateImportRow(
                                row.id,
                                "buyerTaxCode",
                                event.target.value
                              )
                            }
                            disabled={rowDisabled}
                            className="h-8 w-36 rounded border border-slate-300 bg-white px-2 text-xs text-slate-800 outline-none focus:border-indigo-500 disabled:border-slate-200 disabled:bg-slate-100 disabled:text-slate-500"
                          />
                        </td>
                        <td className="border-b border-slate-100 px-3 py-3 align-top">
                          <input
                            value={cleanText(
                              sourceRow?.buyerEmail || row.buyerEmail
                            )}
                            onChange={(event) =>
                              updateImportRow(
                                row.id,
                                "buyerEmail",
                                event.target.value
                              )
                            }
                            disabled={rowDisabled}
                            className="h-8 w-48 rounded border border-slate-300 bg-white px-2 text-xs text-slate-800 outline-none focus:border-indigo-500 disabled:border-slate-200 disabled:bg-slate-100 disabled:text-slate-500"
                          />
                        </td>
                        <td className="border-b border-slate-100 px-3 py-3 align-top">
                          <input
                            value={cleanText(
                              sourceRow?.buyerAddress || row.buyerAddress
                            )}
                            onChange={(event) =>
                              updateImportRow(
                                row.id,
                                "buyerAddress",
                                event.target.value
                              )
                            }
                            disabled={rowDisabled}
                            className="h-8 w-64 rounded border border-slate-300 bg-white px-2 text-xs text-slate-800 outline-none focus:border-indigo-500 disabled:border-slate-200 disabled:bg-slate-100 disabled:text-slate-500"
                          />
                        </td>
                        <td className="border-b border-slate-100 px-3 py-3 align-top">
                          <input
                            value={cleanText(
                              sourceRow?.invoiceSeries || row.invoiceSeries
                            )}
                            onChange={(event) =>
                              updateImportRow(
                                row.id,
                                "invoiceSeries",
                                event.target.value
                              )
                            }
                            disabled={rowDisabled}
                            className="h-8 w-32 rounded border border-slate-300 bg-white px-2 text-xs text-slate-800 outline-none focus:border-indigo-500 disabled:border-slate-200 disabled:bg-slate-100 disabled:text-slate-500"
                          />
                        </td>
                        <td className="border-b border-slate-100 px-3 py-3 align-top">
                          <input
                            type="date"
                            value={
                              normalizeDateInput(
                                cleanText(
                                  sourceRow?.invoiceDate || row.invoiceDate
                                )
                              ) || ""
                            }
                            onChange={(event) =>
                              updateImportRow(
                                row.id,
                                "invoiceDate",
                                event.target.value
                              )
                            }
                            disabled={rowDisabled}
                            className="h-8 w-36 rounded border border-slate-300 bg-white px-2 text-xs text-slate-800 outline-none focus:border-indigo-500 disabled:border-slate-200 disabled:bg-slate-100 disabled:text-slate-500"
                          />
                        </td>
                        <td className="border-b border-slate-100 px-3 py-3 align-top">
                          <input
                            value={cleanText(
                              sourceRow?.quantity ?? row.quantity
                            )}
                            inputMode="decimal"
                            onChange={(event) =>
                              updateImportRow(
                                row.id,
                                "quantity",
                                event.target.value
                              )
                            }
                            disabled={rowDisabled}
                            className="h-8 w-24 rounded border border-slate-300 bg-white px-2 text-right text-xs font-semibold text-slate-800 outline-none focus:border-indigo-500 disabled:border-slate-200 disabled:bg-slate-100 disabled:text-slate-500"
                          />
                        </td>
                        <td className="border-b border-slate-100 px-3 py-3 align-top">
                          <input
                            value={cleanText(
                              sourceRow?.totalBeforeTax ?? row.totalBeforeTax
                            )}
                            inputMode="decimal"
                            onChange={(event) =>
                              updateImportRow(
                                row.id,
                                "totalBeforeTax",
                                event.target.value
                              )
                            }
                            disabled={rowDisabled}
                            className="h-8 w-32 rounded border border-slate-300 bg-white px-2 text-right text-xs font-semibold text-slate-800 outline-none focus:border-indigo-500 disabled:border-slate-200 disabled:bg-slate-100 disabled:text-slate-500"
                          />
                        </td>
                        <td className="border-b border-slate-100 px-3 py-3 align-top">
                          <input
                            value={cleanText(
                              sourceRow?.vatAmount ?? row.vatAmount
                            )}
                            inputMode="decimal"
                            onChange={(event) =>
                              updateImportRow(
                                row.id,
                                "vatAmount",
                                event.target.value
                              )
                            }
                            disabled={rowDisabled}
                            className="h-8 w-28 rounded border border-slate-300 bg-white px-2 text-right text-xs font-semibold text-slate-800 outline-none focus:border-indigo-500 disabled:border-slate-200 disabled:bg-slate-100 disabled:text-slate-500"
                          />
                        </td>
                        <td className="border-b border-slate-100 px-3 py-3 align-top">
                          <input
                            value={cleanText(
                              sourceRow?.totalAmount ?? row.totalAmount
                            )}
                            inputMode="decimal"
                            onChange={(event) =>
                              updateImportRow(
                                row.id,
                                "totalAmount",
                                event.target.value
                              )
                            }
                            disabled={rowDisabled}
                            className="h-8 w-32 rounded border border-slate-300 bg-white px-2 text-right text-xs font-semibold text-slate-900 outline-none focus:border-indigo-500 disabled:border-slate-200 disabled:bg-slate-100 disabled:text-slate-500"
                          />
                        </td>
                        <td className="border-b border-slate-100 px-3 py-3 align-top">
                          <div
                            className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${
                              isCreated
                                ? "bg-blue-100 text-blue-700"
                                : isValid
                                  ? "bg-emerald-100 text-emerald-700"
                                  : "bg-rose-100 text-rose-700"
                            }`}
                          >
                            {isCreated
                              ? createdLabel === "Đã tạo"
                                ? "Đã tạo"
                                : `Đã tạo ${createdLabel}`
                              : isValid
                                ? "Hợp lệ"
                                : "Có lỗi"}
                          </div>

                          {row.errors.length > 0 && (
                            <div className="mt-2 space-y-1 text-xs text-rose-600">
                              {row.errors.map((error) => (
                                <div key={error}>{error}</div>
                              ))}
                            </div>
                          )}

                          {row.warnings.length > 0 && (
                            <div className="mt-2 space-y-1 text-xs text-amber-600">
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
