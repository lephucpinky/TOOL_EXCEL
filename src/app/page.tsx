"use client"

import { useEffect, useMemo, useState } from "react"
import * as XLSX from "xlsx-js-style"
import { normalize, type ExcelRow } from "@/utils/excel"
import { exportChiHoaHongXlsx } from "@/services/file-chi-hoa-hong/exportChiHoaHong"
import { exportXuatHoaDonXlsx } from "@/services/file/exportXuatHD"
import { SearchableSelect } from "@/components/select/SearchableSelect"

const ALL_VALUE = "__ALL__"

const TEMPLATE_CONFIG = {
  commission: {
    key: "commission",
    label: "Mẫu chi hoa hồng",
    templateUrl: "/templates/mau-chi-hoa-hong-text.xlsx",
    exportLabel: "⬇️ Xuất Excel (Chi hoa hồng)",
  },
  invoice: {
    key: "invoice",
    label: "Mẫu hóa đơn",
    templateUrl: "/templates/MAU_XUAT-HD.xlsx",
    exportLabel: "⬇️ Xuất Excel (Hóa đơn)",
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
  keyCategory: string
} {
  const first = wb.SheetNames[0]
  const ws = wb.Sheets[first]
  const json = XLSX.utils.sheet_to_json<Record<string, any>>(ws, { defval: "" })
  const headers = json.length ? Object.keys(json[0]) : []
  const sample = json[0] || {}

  const keyDealer =
    pickKeyFromRow(sample, ["Đại Lý", "ĐẠI LÝ", "Dealer", "Tên đại lý"]) ||
    "Đại Lý"

  const keyDate =
    pickKeyFromRow(sample, [
      "NGÀY KÍCH HOẠT",
      "NGÀY PHÁT SINH",
      "Ngày phát sinh",
    ]) || "NGÀY KÍCH HOẠT"

  const keyCategory =
    pickKeyFromRow(sample, [
      "PHÒNG BAN",
      "Danh mục",
      "Category",
      "Loại sản phẩm",
      "TIÊU ĐỀ",
    ]) || "PHÒNG BAN"

  return {
    headers,
    rows: json as unknown as ExcelRow[],
    keyDealer,
    keyDate,
    keyCategory,
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
  const [keyCategory, setKeyCategory] = useState<string>("PHÒNG BAN")

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
      setKeyCategory(parsed.keyCategory)

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
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="mx-auto max-w-5xl space-y-6">
        {/* chọn danh mục mẫu */}
        <div className="rounded-xl bg-white p-5 shadow">
          <div className="text-center text-base font-bold">
            CHỌN DANH MỤC XUẤT FILE
          </div>

          <div className="mt-4 grid gap-4 md:grid-cols-2">
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
                  className={`rounded-xl border p-4 text-left transition ${
                    isActive
                      ? "border-slate-900 bg-slate-900 text-white shadow"
                      : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50"
                  }`}
                >
                  <div className="text-sm font-semibold">Danh mục</div>
                  <div className="mt-1 text-base font-bold">{item.label}</div>
                  <div
                    className={`mt-2 text-xs ${
                      isActive ? "text-slate-200" : "text-slate-500"
                    }`}
                  >
                    Dùng chung file doanh số, nhưng mỗi mẫu có template và cách
                    xuất riêng
                  </div>
                </button>
              )
            })}
          </div>

          {loadingTemplates && (
            <div className="mt-3 text-center text-xs text-slate-500">
              Đang tải template...
            </div>
          )}

          {templateErr && (
            <div className="mt-3 text-center text-xs text-red-600">
              {templateErr}
            </div>
          )}
        </div>

        {/* thông tin mẫu đang chọn */}
        <div className="rounded-xl bg-white p-5 shadow">
          <div className="text-center text-base font-bold uppercase">
            {currentTemplate.label}
          </div>

          <div className="mt-2 text-center text-sm text-slate-600">
            {templateType === "commission"
              ? "Xuất file theo mẫu chi hoa hồng"
              : "Xuất file theo mẫu hóa đơn"}
          </div>
        </div>

        {/* upload sales */}
        <div className="rounded-xl bg-white p-5 shadow">
          <div className="flex items-start gap-3">
            <div className="text-lg">📊</div>
            <div className="flex-1">
              <div className="text-base font-bold">File theo dõi doanh số</div>

              <input
                id="sales-file"
                type="file"
                accept=".xlsx,.xls"
                className="hidden"
                onChange={(e) => onPickSalesFile(e.target.files?.[0] ?? null)}
              />

              <div className="mt-3 flex flex-wrap items-center gap-3">
                <label
                  htmlFor="sales-file"
                  className="cursor-pointer rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-semibold hover:bg-slate-50"
                >
                  Choose File
                </label>

                <div className="text-sm text-slate-700">
                  {salesFile ? (
                    <span className="font-semibold">{salesFile.name}</span>
                  ) : (
                    <span className="text-slate-500">No file chosen</span>
                  )}
                </div>

                {salesFile && (
                  <button
                    type="button"
                    onClick={() => onPickSalesFile(null)}
                    className="text-sm text-slate-500 underline hover:text-slate-700"
                  >
                    Xoá
                  </button>
                )}
              </div>

              <div className="mt-2 text-sm text-slate-600">
                {salesFile ? (
                  <>
                    Đã chọn: <b>{salesFile.name}</b>
                  </>
                ) : (
                  "Chưa chọn file"
                )}
              </div>
            </div>
          </div>
        </div>

        {/* filter + export */}
        <div className="rounded-xl bg-white p-5 shadow">
          <div className="grid gap-3 md:grid-cols-2">
            <div>
              <div className="text-sm font-semibold text-slate-700">
                Tên đại lý
              </div>
              <div className="mt-1">
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
                <div className="mt-1 text-xs text-slate-500">
                  Upload file doanh số để lấy danh sách đại lý
                </div>
              )}
            </div>

            <div>
              <div className="text-sm font-semibold text-slate-700">
                Mẫu đang xuất
              </div>
              <div className="mt-1 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
                {currentTemplate.label}
              </div>
            </div>
          </div>

          <button
            onClick={onExport}
            disabled={!canExport}
            className={`mt-4 rounded-lg px-5 py-3 text-sm font-semibold shadow-sm transition ${
              canExport
                ? "bg-slate-900 text-white hover:bg-slate-800"
                : "bg-slate-200 text-slate-500"
            }`}
          >
            {exporting ? "⏳ Đang xuất..." : currentTemplate.exportLabel}
          </button>

          {exportErr && (
            <div className="mt-2 text-xs text-red-600">{exportErr}</div>
          )}
        </div>
      </div>
    </div>
  )
}
