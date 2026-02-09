"use client"

import { useEffect, useMemo, useState } from "react"
import * as XLSX from "xlsx-js-style"
import { normalize, type ExcelRow } from "@/utils/excel"
import { exportChiHoaHongXlsx } from "@/services/file-chi-hoa-hong/exportChiHoaHong"
import { SearchableSelect } from "@/components/select/SearchableSelect"

// ✅ chỉ dùng mẫu chi hoa hồng
const TEMPLATE_URL = "/templates/mau-chi-hoa-hong-text.xlsx"
const ALL_VALUE = "__ALL__"

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

function parseMonthKey(v: any): string {
  if (v == null || v === "") return ""

  // Excel serial date
  if (typeof v === "number" && Number.isFinite(v)) {
    const d = XLSX.SSF.parse_date_code(v)
    if (!d?.m || !d?.y) return ""
    return `${String(d.m).padStart(2, "0")}/${String(d.y)}`
  }

  const s = String(v).trim()
  if (!s) return ""

  const m1 = s.match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/) // dd/mm/yyyy
  if (m1) {
    const mm = Number(m1[2])
    const yy = Number(m1[3])
    if (mm >= 1 && mm <= 12) return `${String(mm).padStart(2, "0")}/${yy}`
  }

  const m2 = s.match(/(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})/) // yyyy-mm-dd
  if (m2) {
    const yy = Number(m2[1])
    const mm = Number(m2[2])
    if (mm >= 1 && mm <= 12) return `${String(mm).padStart(2, "0")}/${yy}`
  }

  const m3 = s.match(/^(\d{1,2})[\/\-](\d{4})$/) // mm/yyyy
  if (m3) {
    const mm = Number(m3[1])
    const yy = Number(m3[2])
    if (mm >= 1 && mm <= 12) return `${String(mm).padStart(2, "0")}/${yy}`
  }

  return ""
}

function sortMonthKeysDesc(keys: string[]) {
  return [...keys].sort((a, b) => {
    const [am, ay] = a.split("/")
    const [bm, by] = b.split("/")
    const av = Number(ay) * 100 + Number(am)
    const bv = Number(by) * 100 + Number(bm)
    return bv - av
  })
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

  // ✅ ưu tiên đúng file THEO-DOI-DOANH-SO.xlsx
  const keyDealer =
    pickKeyFromRow(sample, ["Đại Lý", "ĐẠI LÝ", "Dealer", "Tên đại lý"]) ||
    "Đại Lý"

  const keyDate =
    pickKeyFromRow(sample, [
      "NGÀY KÍCH HOẠT",
      "NGÀY PHÁT SINH",
      "Ngày phát sinh",
    ]) || "NGÀY KÍCH HOẠT"

  // (không show UI category nữa, nhưng vẫn parse sẵn nếu sau này cần)
  const keyCategory =
    pickKeyFromRow(sample, [
      "PHÒNG BAN",
      "Danh mục",
      "Category",
      "Loại sản phẩm",
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
  const [salesFile, setSalesFile] = useState<File | null>(null)
  const [salesHeaders, setSalesHeaders] = useState<string[]>([])
  const [salesRows, setSalesRows] = useState<ExcelRow[]>([])

  const [keyDealer, setKeyDealer] = useState<string>("Đại Lý")
  const [keyDate, setKeyDate] = useState<string>("NGÀY KÍCH HOẠT")
  const [keyCategory, setKeyCategory] = useState<string>("PHÒNG BAN")

  const [dealers, setDealers] = useState<string[]>([])
  const [dealerName, setDealerName] = useState<string>(ALL_VALUE)

  const [month, setMonth] = useState<string>("")
  const [monthsAll, setMonthsAll] = useState<string[]>([])

  const [templateWb, setTemplateWb] = useState<XLSX.WorkBook | null>(null)
  const [loadingTemplate, setLoadingTemplate] = useState(false)
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

  // ✅ load template chi hoa hồng (fix cứng) + hiển thị lỗi nếu fail
  useEffect(() => {
    ;(async () => {
      setLoadingTemplate(true)
      setTemplateErr("")
      try {
        const res = await fetch(TEMPLATE_URL)
        if (!res.ok) throw new Error(`Không tải được template (${res.status})`)
        const buf = await res.arrayBuffer()
        const wb = XLSX.read(buf, { type: "array" })
        setTemplateWb(wb)
      } catch (e: any) {
        console.error("Load template failed:", e)
        setTemplateWb(null)
        setTemplateErr(
          e?.message ??
            `Lỗi tải template. Hãy kiểm tra file nằm ở /public${TEMPLATE_URL}`
        )
      } finally {
        setLoadingTemplate(false)
      }
    })()
  }, [])

  async function onPickSalesFile(file: File | null) {
    setSalesFile(file)
    setSalesHeaders([])
    setSalesRows([])
    setDealers([])
    setDealerName(ALL_VALUE)
    setMonth("")
    setMonthsAll([])
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

      // months
      const months = uniqueSorted(
        parsed.rows
          .map((r: any) => parseMonthKey(r[parsed.keyDate]))
          .filter(Boolean)
      )
      const sortedMonths = sortMonthKeysDesc(months)
      setMonthsAll(sortedMonths)
      if (sortedMonths.length) setMonth(sortedMonths[0])

      // dealers
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
      !!templateWb &&
      !!dealerName &&
      salesRows.length > 0 &&
      !loadingTemplate &&
      !exporting
    )
  }, [
    salesFile,
    templateWb,
    dealerName,
    salesRows.length,
    loadingTemplate,
    exporting,
  ])

  async function onExport() {
    if (!canExport || !templateWb) return
    setExportErr("")
    setExporting(true)
    try {
      await exportChiHoaHongXlsx({
        templateWorkbook: templateWb,
        salesHeaders,
        salesRows,
        filter: {
          dealerName, // "__ALL__" hoặc 1 dealer
          month: month || undefined,
        },
      } as any)
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
        {/* ✅ chỉ hiện mẫu chi hoa hồng */}
        <div className="rounded-xl bg-white p-5 shadow">
          <div className="text-center text-base font-bold">
            MẪU CHI HOA HỒNG
          </div>
          <div className="mt-2 text-center text-xs text-slate-500">
            Template: <b>{TEMPLATE_URL}</b>
          </div>

          {loadingTemplate && (
            <div className="mt-2 text-center text-xs text-slate-500">
              Đang tải template...
            </div>
          )}

          {templateErr && (
            <div className="mt-2 text-center text-xs text-red-600">
              {templateErr}
              <div className="mt-1 text-[11px] text-red-500">
                Hãy chắc chắn file nằm đúng: <b>/public/templates/</b> và đúng
                tên <b>mau-chi-hoa-hong-text.xlsx</b>
              </div>
            </div>
          )}
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

              {!!salesRows.length && (
                <div className="mt-2 text-xs text-slate-500">
                  Đọc được <b>{salesRows.length}</b> dòng — cột đại lý:{" "}
                  <b>{keyDealer}</b>, cột tháng: <b>{keyDate}</b> (category:{" "}
                  <b>{keyCategory}</b>)
                </div>
              )}
            </div>
          </div>
        </div>

        {/* select dealer/month */}
        <div className="rounded-xl bg-white p-5 shadow">
          <div className="grid gap-3 md:grid-cols-2">
            <div>
              <div className="text-sm font-semibold text-slate-700">
                Tên đại lý (bắt buộc)
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
                Tháng (tuỳ chọn)
              </div>
              <select
                className="mt-1 w-full rounded-lg border border-slate-200 bg-white p-2 text-sm"
                value={month}
                onChange={(e) => setMonth(e.target.value)}
                disabled={!monthsAll.length}
              >
                <option value="">Tất cả</option>
                {monthsAll.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>

              {!monthsAll.length && (
                <div className="mt-1 text-xs text-slate-500">
                  Upload file doanh số để lấy danh sách tháng từ “{keyDate}”
                </div>
              )}
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
            {exporting ? "⏳ Đang xuất..." : "⬇️ Xuất Excel (Chi hoa hồng)"}
          </button>

          {exportErr && (
            <div className="mt-2 text-xs text-red-600">{exportErr}</div>
          )}

          {/* debug nhỏ để biết vì sao nút bị disable */}
          <div className="mt-2 text-[11px] text-slate-400">
            canExport: {String(canExport)} | templateWb: {String(!!templateWb)}{" "}
            | salesRows: {salesRows.length} | loadingTemplate:{" "}
            {String(loadingTemplate)} | exporting: {String(exporting)}
          </div>
        </div>
      </div>
    </div>
  )
}
