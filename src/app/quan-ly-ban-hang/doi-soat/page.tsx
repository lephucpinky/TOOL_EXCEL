"use client"

import { useEffect, useMemo, useState } from "react"
import * as XLSX from "xlsx-js-style"
import { normalize, type ExcelRow } from "@/utils/excel"
import { exportChiHoaHongXlsx } from "@/services/file-chi-hoa-hong/exportChiHoaHong"

import { SearchableSelect } from "@/components/select/SearchableSelect"
import { exportXuatHoaDonXlsx } from "@/services/file-xuatHD/exportXuatHD"
import {
  CheckCircle2,
  ClipboardCheck,
  Download,
  FileSpreadsheet,
  Loader2,
  UploadCloud,
  X,
} from "lucide-react"
import PageHeader from "../_components/PageHeader"

const ALL_VALUE = "__ALL__"

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
  keyDate: string
} {
  const first = wb.SheetNames[0]
  const ws = wb.Sheets[first]
  const json = XLSX.utils.sheet_to_json<Record<string, any>>(ws, { defval: "" })
  const headers = json.length ? Object.keys(json[0]) : []
  const sample = json[0] || {}

  const keyDealer = pickKeyFromRow(sample, ["Đại Lý"])
  const keyDate = pickKeyFromRow(sample, ["NGÀY KÍCH HOẠT"])

  return {
    headers,
    rows: json as unknown as ExcelRow[],
    keyDealer,
    keyDate,
  }
}

function uniqueSorted(arr: string[]) {
  return Array.from(
    new Set(arr.map((x) => String(x ?? "").trim()).filter(Boolean))
  ).sort((a, b) => a.localeCompare(b, "vi"))
}

export default function HomePage() {
  const [templateType, setTemplateType] = useState<TemplateKey>("commission")

  const [salesFile, setSalesFile] = useState<File | null>(null)
  const [salesHeaders, setSalesHeaders] = useState<string[]>([])
  const [salesRows, setSalesRows] = useState<ExcelRow[]>([])

  const [keyDealer, setKeyDealer] = useState<string>("Đại Lý")
  const [keyDate, setKeyDate] = useState<string>("NGÀY KÍCH HOẠT")

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

  const dealerOptions = useMemo(
    () => [
      { value: ALL_VALUE, label: "Tất cả" },
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
      setKeyDealer(parsed.keyDealer)
      setKeyDate(parsed.keyDate)

      const dls = uniqueSorted(parsed.rows.map((r: any) => r[parsed.keyDealer]))
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
                <SearchableSelect
                  options={dealerOptions}
                  value={dealerName || undefined}
                  onChange={(v) => setDealerName(v)}
                  placeholder="Chọn đại lý..."
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
      </div>
    </div>
  )
}
