"use client"

import { useEffect, useMemo, useState } from "react"
import * as XLSX from "xlsx-js-style"
import {
  extractProductGroupCode,
  normalize,
  type ExcelRow,
} from "@/utils/excel"
import { exportChiHoaHongXlsx } from "@/services/file-chi-hoa-hong/exportChiHoaHong"

import InvoiceFilterDatePicker from "@/components/minvoice/InvoiceFilterDatePicker"
import InvoiceFilterSelect from "@/components/minvoice/InvoiceFilterSelect"
import { exportXuatHoaDonXlsx } from "@/services/file-xuatHD/exportXuatHD"
import {
  APIExportSaleTransactionReport,
  type SaleTransactionReportExportParams,
} from "@/services/saleTransaction"
import { useAppDispatch, useAppSelector } from "@/store/hooks"
import { InvoiceStatus } from "@/types/invoice"
import {
  agencyThunks,
  bankThunks,
  departmentThunks,
  employeeThunks,
} from "@/store/slices"
import { getErrorMessage } from "@/store/utils/crud"
import {
  CheckCircle2,
  ClipboardCheck,
  Download,
  FileSpreadsheet,
  Loader2,
  UploadCloud,
  X,
} from "lucide-react"
import PageHeader from "../../../components/header/PageHeader"

const ALL_VALUE = "__ALL__"
const LIST_PARAMS = {}
const EXCEL_MIME_TYPE =
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"

const INVOICE_STATUS_OPTIONS = [
  { value: "", label: "Tất cả trạng thái" },
  { value: InvoiceStatus.DRAFT, label: "Nháp" },
  { value: InvoiceStatus.ISSUING, label: "Đang xuất hóa đơn" },
  { value: InvoiceStatus.ISSUED, label: "Đã xuất hóa đơn" },
  { value: InvoiceStatus.FAILED, label: "Xuất thất bại" },
  { value: InvoiceStatus.CANCELLED, label: "Đã hủy" },
]

const PAYMENT_STATUS_OPTIONS = [
  { value: "", label: "Tất cả thanh toán" },
  { value: "true", label: "Đã thanh toán" },
  { value: "false", label: "Chưa thanh toán" },
]

const TEMPLATE_CONFIG = {
  commission: {
    key: "commission",
    label: "Mẫu chi hoa hồng",
    templateUrl: "/templates/mau-chi-hoa-hong-text.xlsx",
    exportLabel: "Xuất Excel (Chi hoa hồng)",
  },
  invoice: {
    key: "invoice",
    label: "Mẫu hóa đơn",
    templateUrl: "/templates/MAU_XUAT-HD.xlsx",
    exportLabel: "Xuất Excel (Hóa đơn)",
  },
} as const

type TemplateKey = keyof typeof TEMPLATE_CONFIG
type ReportFilters = {
  startDate: string
  endDate: string
  invoiceStatus: string
  isPaid: string
  agencyId: string
  employeeId: string
  departmentId: string
  bankId: string
}

function formatDateInput(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const day = String(date.getDate()).padStart(2, "0")

  return `${year}-${month}-${day}`
}

function getCurrentMonthRange() {
  const now = new Date()

  return {
    startDate: formatDateInput(new Date(now.getFullYear(), now.getMonth(), 1)),
    endDate: formatDateInput(
      new Date(now.getFullYear(), now.getMonth() + 1, 0)
    ),
  }
}

function createDefaultReportFilters(): ReportFilters {
  const range = getCurrentMonthRange()

  return {
    startDate: range.startDate,
    endDate: range.endDate,
    invoiceStatus: "",
    isPaid: "",
    agencyId: "",
    employeeId: "",
    departmentId: "",
    bankId: "",
  }
}

function getFilenameFromDisposition(disposition?: string) {
  if (!disposition) return ""

  const utf8Match = disposition.match(/filename\*=UTF-8''([^;]+)/i)
  if (utf8Match?.[1]) {
    return decodeURIComponent(utf8Match[1].replace(/"/g, ""))
  }

  const asciiMatch = disposition.match(/filename="?([^";]+)"?/i)
  return asciiMatch?.[1] || ""
}

function buildDefaultReportFileName(filters: ReportFilters) {
  const suffix = [filters.startDate, filters.endDate].filter(Boolean).join("_")

  return suffix
    ? `sale-transaction-report_${suffix}.xlsx`
    : "sale-transaction-report.xlsx"
}

function downloadBlob(blob: Blob, fileName: string) {
  const url = window.URL.createObjectURL(blob)
  const link = document.createElement("a")

  link.href = url
  link.download = fileName
  document.body.appendChild(link)
  link.click()
  link.remove()
  window.setTimeout(() => window.URL.revokeObjectURL(url), 0)
}

function getReportResponseBlob(
  response: Awaited<ReturnType<typeof APIExportSaleTransactionReport>>
) {
  return response.data instanceof Blob
    ? response.data
    : new Blob([response.data], {
        type: EXCEL_MIME_TYPE,
      })
}

function pickKeyFromRow(row: Record<string, any>, aliases: string[]) {
  const keys = Object.keys(row || {})
  const map = new Map<string, string>()

  for (const k of keys) map.set(normalize(k), k)

  for (const a of aliases) {
    const found = map.get(normalize(a))
    if (found) return found
  }

  return ""
}

function parseSalesWorkbook(wb: XLSX.WorkBook): {
  headers: string[]
  rows: ExcelRow[]
  keyDealer: string
} {
  const first = wb.SheetNames[0]
  const ws = wb.Sheets[first]
  const json = XLSX.utils.sheet_to_json<Record<string, any>>(ws, { defval: "" })
  const headers = json.length ? Object.keys(json[0]) : []
  const sample = json[0] || {}

  const keyDealer = pickKeyFromRow(sample, [
    "Đại Lý",
    "Tên đại lý",
    "Danh mục đại lý",
    "Dai Ly",
    "Ten Dai Ly",
    "Danh Muc Dai Ly",
    "Dealer",
    "Agency",
    "CTV",
  ])
  const keyOrder = pickKeyFromRow(sample, [
    "SỐ ĐƠN HÀNG",
    "MÃ ĐƠN HÀNG",
    "MÃ HÓA ĐƠN",
    "ORDER NUMBER",
  ])
  const keyProduct = pickKeyFromRow(sample, [
    "MÃ SẢN PHẨM",
    "MÃ SP",
    "ITEM PRODUCT",
    "PRODUCT CODE",
  ])
  const keyReconciliation = pickKeyFromRow(sample, [
    "GIÁ ĐỐI SOÁT",
    "GIA DOI SOAT",
  ])

  let rows = json
  if (keyOrder && keyProduct && keyReconciliation) {
    const productGroups = new Map<
      string,
      { rowCount: number; totalRowIndex: number }
    >()

    json.forEach((row, index) => {
      const orderNumber = String(row[keyOrder] ?? "").trim()
      const productCode = String(row[keyProduct] ?? "")
        .trim()
        .toUpperCase()
      const groupCode = extractProductGroupCode(productCode)

      if (!orderNumber || !productCode) return

      const groupKey = `${orderNumber}\u0000${groupCode}`
      const group = productGroups.get(groupKey) || {
        rowCount: 0,
        totalRowIndex: -1,
      }

      group.rowCount += 1
      if (group.totalRowIndex < 0 && productCode === groupCode) {
        group.totalRowIndex = index
      }
      productGroups.set(groupKey, group)
    })

    rows = json.filter((row, index) => {
      const orderNumber = String(row[keyOrder] ?? "").trim()
      const productCode = String(row[keyProduct] ?? "")
        .trim()
        .toUpperCase()
      const groupCode = extractProductGroupCode(productCode)
      const group = productGroups.get(`${orderNumber}\u0000${groupCode}`)

      return (
        !group ||
        group.rowCount === 1 ||
        group.totalRowIndex < 0 ||
        group.totalRowIndex === index
      )
    })
  }

  return {
    headers,
    rows: rows as unknown as ExcelRow[],
    keyDealer,
  }
}

function uniqueSorted(arr: string[]) {
  return Array.from(
    new Set(arr.map((x) => String(x ?? "").trim()).filter(Boolean))
  ).sort((a, b) => a.localeCompare(b, "vi"))
}

export default function HomePage() {
  const dispatch = useAppDispatch()
  const { items: agencies, loading: agenciesLoading } = useAppSelector(
    (state) => state.agencies
  )
  const { items: employees, loading: employeesLoading } = useAppSelector(
    (state) => state.employees
  )
  const { items: departments, loading: departmentsLoading } = useAppSelector(
    (state) => state.departments
  )
  const { items: banks, loading: banksLoading } = useAppSelector(
    (state) => state.banks
  )

  const [templateType, setTemplateType] = useState<TemplateKey>("commission")

  const [salesFile, setSalesFile] = useState<File | null>(null)
  const [salesHeaders, setSalesHeaders] = useState<string[]>([])
  const [salesRows, setSalesRows] = useState<ExcelRow[]>([])

  const [dealers, setDealers] = useState<string[]>([])
  const [dealerName, setDealerName] = useState<string>(ALL_VALUE)

  // tách riêng workbook cho từng mẫu để không ảnh hưởng chéo
  const [commissionTemplateWb, setCommissionTemplateWb] =
    useState<XLSX.WorkBook | null>(null)
  const [invoiceTemplateWb, setInvoiceTemplateWb] =
    useState<XLSX.WorkBook | null>(null)

  const [loadingTemplates, setLoadingTemplates] = useState(false)
  const [templateErr, setTemplateErr] = useState<string>("")

  const [exporting, setExporting] = useState(false)
  const [exportErr, setExportErr] = useState<string>("")
  const [reportFilters, setReportFilters] = useState<ReportFilters>(() =>
    createDefaultReportFilters()
  )
  const [reportExporting, setReportExporting] = useState(false)
  const [reportExportErr, setReportExportErr] = useState("")
  const [catalogErr, setCatalogErr] = useState("")

  const dealerOptions = useMemo(
    () => [
      { value: ALL_VALUE, label: "Tất cả đại lý" },
      ...dealers.map((d) => ({ value: d, label: d })),
    ],
    [dealers]
  )

  const templateOptions = useMemo(
    () => [
      {
        value: TEMPLATE_CONFIG.commission.key,
        label: TEMPLATE_CONFIG.commission.label,
      },
      {
        value: TEMPLATE_CONFIG.invoice.key,
        label: TEMPLATE_CONFIG.invoice.label,
      },
    ],
    []
  )

  const currentTemplate = TEMPLATE_CONFIG[templateType]
  const currentTemplateWb =
    templateType === "commission" ? commissionTemplateWb : invoiceTemplateWb
  const catalogsLoading =
    agenciesLoading || employeesLoading || departmentsLoading || banksLoading
  const reportDateInvalid = Boolean(
    reportFilters.startDate &&
      reportFilters.endDate &&
      reportFilters.startDate > reportFilters.endDate
  )
  const canExportReport = !reportExporting && !reportDateInvalid

  useEffect(() => {
    ;(async () => {
      const results = await Promise.allSettled([
        dispatch(agencyThunks.fetchAll(LIST_PARAMS)).unwrap(),
        dispatch(employeeThunks.fetchAll(LIST_PARAMS)).unwrap(),
        dispatch(departmentThunks.fetchAll(LIST_PARAMS)).unwrap(),
        dispatch(bankThunks.fetchAll(LIST_PARAMS)).unwrap(),
      ])
      const rejected = results.find(
        (result): result is PromiseRejectedResult =>
          result.status === "rejected"
      )

      if (rejected) {
        setCatalogErr(
          getErrorMessage(rejected.reason) ||
            "Không thể tải đầy đủ danh mục lọc báo cáo."
        )
      }
    })()
  }, [dispatch])

  useEffect(() => {
    ;(async () => {
      setLoadingTemplates(true)
      setTemplateErr("")

      try {
        const [commissionRes, invoiceRes] = await Promise.all([
          fetch(TEMPLATE_CONFIG.commission.templateUrl),
          fetch(TEMPLATE_CONFIG.invoice.templateUrl),
        ])

        if (!commissionRes.ok) {
          throw new Error(
            `Không tải được template chi hoa hồng (${commissionRes.status})`
          )
        }

        if (!invoiceRes.ok) {
          throw new Error(
            `Không tải được template hóa đơn (${invoiceRes.status})`
          )
        }

        const [commissionBuf, invoiceBuf] = await Promise.all([
          commissionRes.arrayBuffer(),
          invoiceRes.arrayBuffer(),
        ])

        const commissionWb = XLSX.read(commissionBuf, { type: "array" })
        const invoiceWb = XLSX.read(invoiceBuf, { type: "array" })

        setCommissionTemplateWb(commissionWb)
        setInvoiceTemplateWb(invoiceWb)
      } catch (e: any) {
        console.error("Load templates failed:", e)
        setCommissionTemplateWb(null)
        setInvoiceTemplateWb(null)
        setTemplateErr(
          e?.message ??
            "Lỗi tải template. Hãy kiểm tra file template trong thư mục /public/templates"
        )
      } finally {
        setLoadingTemplates(false)
      }
    })()
  }, [])

  async function onPickSalesFile(file: File | null) {
    setSalesFile(file)
    setSalesHeaders([])
    setSalesRows([])
    setDealers([])
    setDealerName(ALL_VALUE)
    setExportErr("")

    if (!file) return

    try {
      const buf = await file.arrayBuffer()
      const wb = XLSX.read(buf, { type: "array" })
      const parsed = parseSalesWorkbook(wb)

      setSalesHeaders(parsed.headers)
      setSalesRows(parsed.rows)

      if (!parsed.keyDealer) {
        setExportErr(
          "Không tìm thấy cột Đại lý / Danh mục đại lý trong file doanh số."
        )
      }

      const dls = parsed.keyDealer
        ? uniqueSorted(parsed.rows.map((r: any) => r[parsed.keyDealer]))
        : []
      setDealers(dls)
    } catch (e: any) {
      console.error("Parse sales file failed:", e)
      alert(e?.message ?? "Không đọc được file doanh số")
    }
  }

  const canExport = useMemo(() => {
    return (
      !!salesFile &&
      !!currentTemplateWb &&
      !!dealerName &&
      salesRows.length > 0 &&
      !loadingTemplates &&
      !exporting
    )
  }, [
    salesFile,
    currentTemplateWb,
    dealerName,
    salesRows.length,
    loadingTemplates,
    exporting,
  ])

  async function onExport() {
    if (!canExport || !currentTemplateWb) return

    setExportErr("")
    setExporting(true)

    try {
      if (templateType === "commission") {
        await exportChiHoaHongXlsx({
          templateWorkbook: commissionTemplateWb,
          salesHeaders,
          salesRows,
          filter: {
            dealerName,
          },
        } as any)
      } else {
        await exportXuatHoaDonXlsx({
          templateWorkbook: invoiceTemplateWb,
          salesHeaders,
          salesRows,
          filter: {
            dealerName,
          },
        } as any)
      }
    } catch (e: any) {
      console.error("Export failed:", e)
      const msg = e?.message ?? "Xuất file thất bại"
      setExportErr(msg)
      alert(msg)
    } finally {
      setExporting(false)
    }
  }

  function updateReportFilter(key: keyof ReportFilters, value: string) {
    setReportFilters((prev) => ({
      ...prev,
      [key]: value,
    }))
    setReportExportErr("")
  }

  function buildReportParams(): SaleTransactionReportExportParams {
    return {
      startDate: reportFilters.startDate,
      endDate: reportFilters.endDate,
      invoiceStatus: reportFilters.invoiceStatus,
      isPaid:
        reportFilters.isPaid === ""
          ? undefined
          : reportFilters.isPaid === "true",
      agencyId: reportFilters.agencyId,
      employeeId: reportFilters.employeeId,
      departmentId: reportFilters.departmentId,
      bankId: reportFilters.bankId,
    }
  }

  async function onExportReport() {
    if (!canExportReport) return

    if (reportDateInvalid) {
      setReportExportErr("Ngày bắt đầu không được lớn hơn ngày kết thúc.")
      return
    }

    setReportExportErr("")
    setReportExporting(true)

    try {
      const params = buildReportParams()
      const response = await APIExportSaleTransactionReport(params)
      const blob = getReportResponseBlob(response)

      if (!blob.size) {
        throw new Error("API không trả về dữ liệu file báo cáo.")
      }

      const fileName =
        getFilenameFromDisposition(response.headers?.["content-disposition"]) ||
        buildDefaultReportFileName(reportFilters)
      downloadBlob(blob, fileName)
    } catch (e: any) {
      console.error("Export sale transaction report failed:", e)
      setReportExportErr(
        e?.response?.data?.message ||
          e?.response?.data?.error ||
          e?.message ||
          "Xuất báo cáo giao dịch bán hàng thất bại."
      )
    } finally {
      setReportExporting(false)
    }
  }

  return (
    <div className="min-h-screen p-5">
      <div className="mx-auto max-w-6xl space-y-5">
        <PageHeader
          icon={<ClipboardCheck size={24} />}
          eyebrow="Đối soát dữ liệu"
          title="Đối soát & xuất file"
          description="Tải file doanh số, chọn mẫu và xuất nhanh file hoa hồng hoặc hóa đơn."
          tone="rose"
          actions={
            <button
              type="button"
              onClick={onExport}
              disabled={!canExport}
              className={[
                "inline-flex h-10 items-center justify-center gap-2 rounded-lg px-4 text-sm font-bold transition",
                canExport
                  ? "bg-blue-600 text-white hover:bg-blue-700"
                  : "cursor-not-allowed bg-slate-200 text-slate-500",
              ].join(" ")}
            >
              {exporting ? (
                <Loader2 size={17} className="animate-spin" />
              ) : (
                <Download size={17} />
              )}
              {exporting ? "Đang xuất..." : currentTemplate.exportLabel}
            </button>
          }
        />

        <section className="grid gap-4 lg:grid-cols-[0.95fr_1.05fr]">
          <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50 text-blue-700">
                <FileSpreadsheet size={21} />
              </div>
              <div>
                <h2 className="text-base font-bold text-slate-950">
                  Chọn mẫu xuất
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  Mẫu đang chọn sẽ quyết định định dạng file Excel.
                </p>
              </div>
            </div>

            <div className="mt-4 grid gap-3 md:grid-cols-2">
              {templateOptions.map((item) => {
                const isActive = templateType === item.value

                return (
                  <button
                    key={item.value}
                    type="button"
                    onClick={() => {
                      setTemplateType(item.value as TemplateKey)
                      setExportErr("")
                    }}
                    className={[
                      "flex min-h-[112px] flex-col justify-between rounded-lg border p-4 text-left transition",
                      isActive
                        ? "border-blue-500 bg-blue-50 text-blue-900 shadow-sm"
                        : "border-slate-200 bg-white text-slate-700 hover:border-blue-200 hover:bg-slate-50",
                    ].join(" ")}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <FileSpreadsheet
                        size={20}
                        className={
                          isActive ? "text-blue-700" : "text-slate-400"
                        }
                      />
                      {isActive && (
                        <CheckCircle2 size={18} className="text-blue-700" />
                      )}
                    </div>
                    <div className="mt-4 text-sm font-bold">{item.label}</div>
                  </button>
                )
              })}
            </div>

            {loadingTemplates && (
              <div className="mt-4 flex items-center gap-2 rounded-lg bg-slate-50 px-3 py-2 text-sm font-medium text-slate-500">
                <Loader2 size={16} className="animate-spin" />
                Đang tải template...
              </div>
            )}

            {templateErr && (
              <div className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm font-semibold text-red-600">
                {templateErr}
              </div>
            )}
          </div>

          <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700">
                <UploadCloud size={21} />
              </div>
              <div>
                <h2 className="text-base font-bold text-slate-950">
                  File theo dõi doanh số
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  Hệ thống sẽ đọc danh sách đại lý từ file Excel đã chọn.
                </p>
              </div>
            </div>

            <input
              id="sales-file"
              type="file"
              accept=".xlsx,.xls"
              className="hidden"
              onChange={(e) => onPickSalesFile(e.target.files?.[0] ?? null)}
            />

            <div className="mt-5 flex flex-col gap-3 rounded-lg border border-dashed border-slate-300 bg-slate-50 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <div className="text-sm font-bold text-slate-800">
                  {salesFile ? salesFile.name : "Chưa chọn file"}
                </div>
                <div className="mt-1 text-xs font-medium text-slate-500">
                  {salesFile
                    ? "File đã sẵn sàng để lọc và xuất dữ liệu."
                    : "Hỗ trợ .xlsx và .xls"}
                </div>
              </div>

              <div className="flex shrink-0 items-center gap-2">
                <label
                  htmlFor="sales-file"
                  className="inline-flex h-10 cursor-pointer items-center justify-center gap-2 rounded-lg bg-slate-900 px-4 text-sm font-bold text-white transition hover:bg-slate-800"
                >
                  <UploadCloud size={17} />
                  Chọn file
                </label>

                {salesFile && (
                  <button
                    type="button"
                    onClick={() => onPickSalesFile(null)}
                    className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 transition hover:bg-slate-100 hover:text-slate-800"
                    aria-label="Xóa file đã chọn"
                  >
                    <X size={17} />
                  </button>
                )}
              </div>
            </div>
          </div>
        </section>

        <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="text-sm font-bold text-slate-700">
                Tên đại lý
              </label>
              <div className="mt-2">
                <InvoiceFilterSelect
                  id="dealer-name"
                  options={dealerOptions}
                  value={dealerName}
                  onChange={setDealerName}
                  searchPlaceholder="Tìm đại lý..."
                  emptyText="Không tìm thấy đại lý"
                  disabled={!dealers.length}
                />
              </div>

              {!dealers.length && (
                <div className="mt-2 text-xs font-medium text-slate-500">
                  Upload file doanh số để lấy danh sách đại lý.
                </div>
              )}
            </div>

            <div>
              <label className="text-sm font-bold text-slate-700">
                Mẫu đang xuất
              </label>
              <div className="mt-2 flex h-10 items-center rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm font-semibold text-slate-700">
                {currentTemplate.label}
              </div>
            </div>
          </div>

          {exportErr && (
            <div className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm font-semibold text-red-600">
              {exportErr}
            </div>
          )}
        </section>
        <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700">
                <FileSpreadsheet size={21} />
              </div>
              <div>
                <h2 className="text-base font-bold text-slate-950">
                  Xuất báo cáo giao dịch bán hàng
                </h2>
                <p className="mt-1 text-sm leading-6 text-slate-500">
                  Lọc dữ liệu và tải file Excel báo cáo trực tiếp từ hệ thống.
                </p>
              </div>
            </div>

            <div className="flex shrink-0 flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setReportFilters(createDefaultReportFilters())
                  setReportExportErr("")
                }}
                disabled={reportExporting}
                className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-4 text-sm font-bold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <X size={17} />
                Xóa lọc
              </button>

              <button
                type="button"
                onClick={onExportReport}
                disabled={!canExportReport}
                className={[
                  "inline-flex h-10 items-center justify-center gap-2 rounded-lg px-4 text-sm font-bold transition",
                  canExportReport
                    ? "bg-emerald-600 text-white hover:bg-emerald-700"
                    : "cursor-not-allowed bg-slate-200 text-slate-500",
                ].join(" ")}
              >
                {reportExporting ? (
                  <Loader2 size={17} className="animate-spin" />
                ) : (
                  <Download size={17} />
                )}
                {reportExporting ? "Đang xuất..." : "Xuất báo cáo"}
              </button>
            </div>
          </div>

          <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <div>
              <label
                htmlFor="report-start-date"
                className="text-sm font-bold text-slate-700"
              >
                Từ ngày
              </label>
              <div className="mt-2">
                <InvoiceFilterDatePicker
                  id="report-start-date"
                  value={reportFilters.startDate}
                  onChange={(value) => updateReportFilter("startDate", value)}
                />
              </div>
            </div>

            <div>
              <label
                htmlFor="report-end-date"
                className="text-sm font-bold text-slate-700"
              >
                Đến ngày
              </label>
              <div className="mt-2">
                <InvoiceFilterDatePicker
                  id="report-end-date"
                  value={reportFilters.endDate}
                  onChange={(value) => updateReportFilter("endDate", value)}
                />
              </div>
            </div>

            <div>
              <label
                htmlFor="report-invoice-status"
                className="text-sm font-bold text-slate-700"
              >
                Trạng thái hóa đơn
              </label>
              <div className="mt-2">
                <InvoiceFilterSelect
                  id="report-invoice-status"
                  value={reportFilters.invoiceStatus}
                  onChange={(value) =>
                    updateReportFilter("invoiceStatus", value)
                  }
                  options={INVOICE_STATUS_OPTIONS}
                />
              </div>
            </div>

            <div>
              <label
                htmlFor="report-payment-status"
                className="text-sm font-bold text-slate-700"
              >
                Thanh toán
              </label>
              <div className="mt-2">
                <InvoiceFilterSelect
                  id="report-payment-status"
                  value={reportFilters.isPaid}
                  onChange={(value) => updateReportFilter("isPaid", value)}
                  options={PAYMENT_STATUS_OPTIONS}
                />
              </div>
            </div>

            <div>
              <label
                htmlFor="report-agency"
                className="text-sm font-bold text-slate-700"
              >
                Đại lý
              </label>
              <div className="mt-2">
                <InvoiceFilterSelect
                  id="report-agency"
                  value={reportFilters.agencyId}
                  disabled={catalogsLoading}
                  onChange={(value) => updateReportFilter("agencyId", value)}
                  searchPlaceholder="Tìm đại lý..."
                  options={[
                    { value: "", label: "Tất cả đại lý" },
                    ...agencies.map((agency) => ({
                      value: agency._id,
                      label: agency.agencyName,
                    })),
                  ]}
                />
              </div>
            </div>

            <div>
              <label
                htmlFor="report-employee"
                className="text-sm font-bold text-slate-700"
              >
                Nhân viên
              </label>
              <div className="mt-2">
                <InvoiceFilterSelect
                  id="report-employee"
                  value={reportFilters.employeeId}
                  disabled={catalogsLoading}
                  onChange={(value) => updateReportFilter("employeeId", value)}
                  searchPlaceholder="Tìm nhân viên..."
                  options={[
                    { value: "", label: "Tất cả nhân viên" },
                    ...employees.map((employee) => ({
                      value: employee._id,
                      label: employee.employeeName,
                    })),
                  ]}
                />
              </div>
            </div>

            <div>
              <label
                htmlFor="report-department"
                className="text-sm font-bold text-slate-700"
              >
                Phòng ban
              </label>
              <div className="mt-2">
                <InvoiceFilterSelect
                  id="report-department"
                  value={reportFilters.departmentId}
                  disabled={catalogsLoading}
                  onChange={(value) =>
                    updateReportFilter("departmentId", value)
                  }
                  searchPlaceholder="Tìm phòng ban..."
                  options={[
                    { value: "", label: "Tất cả phòng ban" },
                    ...departments.map((department) => ({
                      value: department._id,
                      label: department.departmentName,
                    })),
                  ]}
                />
              </div>
            </div>

            <div>
              <label
                htmlFor="report-bank"
                className="text-sm font-bold text-slate-700"
              >
                Ngân hàng
              </label>
              <div className="mt-2">
                <InvoiceFilterSelect
                  id="report-bank"
                  value={reportFilters.bankId}
                  disabled={catalogsLoading}
                  onChange={(value) => updateReportFilter("bankId", value)}
                  searchPlaceholder="Tìm ngân hàng..."
                  options={[
                    { value: "", label: "Tất cả ngân hàng" },
                    ...banks.map((bank) => ({
                      value: bank._id,
                      label: bank.inv_buyerBankName,
                    })),
                  ]}
                />
              </div>
            </div>
          </div>

          {catalogsLoading && (
            <div className="mt-4 flex items-center gap-2 rounded-lg bg-slate-50 px-3 py-2 text-sm font-medium text-slate-500">
              <Loader2 size={16} className="animate-spin" />
              Đang tải danh mục lọc...
            </div>
          )}

          {reportDateInvalid && (
            <div className="mt-4 rounded-lg bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-700">
              Ngày bắt đầu không được lớn hơn ngày kết thúc.
            </div>
          )}

          {catalogErr && (
            <div className="mt-4 rounded-lg bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-700">
              {catalogErr}
            </div>
          )}

          {reportExportErr && (
            <div className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm font-semibold text-red-600">
              {reportExportErr}
            </div>
          )}
        </section>
      </div>
    </div>
  )
}
