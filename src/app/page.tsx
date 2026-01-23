"use client"

import { useEffect, useMemo, useState } from "react"
import * as XLSX from "xlsx-js-style"
import type { ExcelRow } from "@/utils/excel"

import { exportChiHoaHongXlsx } from "@/services/exportChiHoaHong"
import { exportThuGiaVonXlsx } from "@/services/exportThuGiaVon"
import { exportVacomHdXlsx } from "@/services/exportVacom"

const TEMPLATE_URL = "/templates/cac_mau_doi_soat_v3.xlsx"

type TemplateKey = "vacom-hd" | "chi-hoa-hong" | "thu-gia-von"
const ALL_VALUE = "__ALL__"

// -------- helpers: parse sales + detect columns ----------
const norm = (s: any) =>
  String(s ?? "")
    .trim()
    .toLowerCase()

function pickKeyFromRow(row: Record<string, any>, aliases: string[]) {
  const keys = Object.keys(row || {})
  const map = new Map<string, string>()
  for (const k of keys) map.set(norm(k), k)
  for (const a of aliases) {
    const found = map.get(norm(a))
    if (found) return found
  }
  return ""
}
function parseMonthKey(v: any): string {
  // trả về "MM/YYYY" hoặc "" nếu không parse được
  if (v == null || v === "") return ""

  // Excel serial date (number)
  if (typeof v === "number" && Number.isFinite(v)) {
    const d = XLSX.SSF.parse_date_code(v)
    if (!d?.m || !d?.y) return ""
    return `${String(d.m).padStart(2, "0")}/${String(d.y)}`
  }

  const s = String(v).trim()
  if (!s) return ""

  // bắt các kiểu: dd/mm/yyyy, d/m/yyyy, yyyy-mm-dd, yyyy/mm/dd
  // lấy month + year
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

  // nếu user nhập sẵn "mm/yyyy"
  const m3 = s.match(/^(\d{1,2})[\/\-](\d{4})$/)
  if (m3) {
    const mm = Number(m3[1])
    const yy = Number(m3[2])
    if (mm >= 1 && mm <= 12) return `${String(mm).padStart(2, "0")}/${yy}`
  }

  return ""
}

function sortMonthKeysDesc(keys: string[]) {
  // sort giảm dần theo YYYYMM
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
  keyCategory: string
  keyDate: string
} {
  const first = wb.SheetNames[0]
  const ws = wb.Sheets[first]
  const json = XLSX.utils.sheet_to_json<Record<string, any>>(ws, { defval: "" })
  const headers = json.length ? Object.keys(json[0]) : []

  const sample = json[0] || {}

  const keyDealer =
    pickKeyFromRow(sample, ["Tên đại lý", "Đại lý", "Dealer"]) || "Tên đại lý"
  const keyCategory =
    pickKeyFromRow(sample, ["Loại sản phẩm", "Danh mục", "Category"]) ||
    "Loại sản phẩm"

  const keyDate =
    pickKeyFromRow(sample, [
      "Ngày phát sinh",
      "Ngày tháng",
      "Thời gian kích hoạt",
      "Date",
    ]) || "Ngày phát sinh"

  return {
    headers,
    rows: json as unknown as ExcelRow[],
    keyDealer,
    keyCategory,
    keyDate,
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
  const [keyDealer, setKeyDealer] = useState<string>("Tên đại lý")
  const [keyCategory, setKeyCategory] = useState<string>("Loại sản phẩm")

  const [dealers, setDealers] = useState<string[]>([])
  const [categoriesAll, setCategoriesAll] = useState<string[]>([])

  const [dealerName, setDealerName] = useState<string>("")
  const [category, setCategory] = useState<string>("")
  const [month, setMonth] = useState<string>("")
  const [keyDate, setKeyDate] = useState<string>("Ngày phát sinh")
  const [monthsAll, setMonthsAll] = useState<string[]>([])

  const [templateWb, setTemplateWb] = useState<XLSX.WorkBook | null>(null)
  const [templateKey, setTemplateKey] = useState<TemplateKey>("vacom-hd")
  const [loadingTemplate, setLoadingTemplate] = useState(false)

  // load template (fix cứng)
  useEffect(() => {
    ;(async () => {
      setLoadingTemplate(true)
      try {
        const res = await fetch(TEMPLATE_URL)
        if (!res.ok) throw new Error(`Template not found: ${res.status}`)
        const buf = await res.arrayBuffer()
        const wb = XLSX.read(buf, { type: "array" })
        setTemplateWb(wb)
      } finally {
        setLoadingTemplate(false)
      }
    })()
  }, [])

  // when upload sales file -> parse -> build selects
  async function onPickSalesFile(file: File | null) {
    setSalesFile(file)
    setSalesHeaders([])
    setSalesRows([])
    setDealers([])
    setCategoriesAll([])
    setDealerName("")
    setCategory("")

    if (!file) return
    const buf = await file.arrayBuffer()
    const wb = XLSX.read(buf, { type: "array" })
    const parsed = parseSalesWorkbook(wb)

    setSalesHeaders(parsed.headers)
    setSalesRows(parsed.rows)
    setKeyDealer(parsed.keyDealer)
    setKeyCategory(parsed.keyCategory)
    setKeyDate(parsed.keyDate)
    const months = uniqueSorted(
      parsed.rows
        .map((r: any) => parseMonthKey(r[parsed.keyDate]))
        .filter(Boolean)
    )
    setMonthsAll(sortMonthKeysDesc(months))

    // auto chọn tháng mới nhất (nếu có)
    if (months.length) setMonth(sortMonthKeysDesc(months)[0])

    const dls = uniqueSorted(parsed.rows.map((r: any) => r[parsed.keyDealer]))
    setDealers(dls)

    const cats = uniqueSorted(
      parsed.rows.map((r: any) => r[parsed.keyCategory])
    )
    setCategoriesAll(cats)

    // auto chọn "Tất cả" nếu muốn, hoặc dealer đầu tiên
    // setDealerName(ALL_VALUE)
    if (dls.length) setDealerName(dls[0])
  }

  // categories filtered by selected dealer (nếu ALL => trả categoriesAll)
  const categories = useMemo(() => {
    if (!salesRows.length) return []
    if (!dealerName || dealerName === ALL_VALUE) return categoriesAll

    const set = new Set<string>()
    for (const r of salesRows as any[]) {
      if (String(r[keyDealer] ?? "").trim() !== dealerName) continue
      const c = String(r[keyCategory] ?? "").trim()
      if (c) set.add(c)
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b, "vi"))
  }, [salesRows, categoriesAll, dealerName, keyDealer, keyCategory])

  // auto reset category when dealer changes (if category not in list)
  useEffect(() => {
    if (!dealerName) return
    if (!category || categories.includes(category)) return
    setCategory("")
  }, [dealerName, categories, category])

  const canExport = useMemo(() => {
    return (
      !!salesFile &&
      !!templateWb &&
      !!dealerName &&
      salesRows.length > 0 &&
      !loadingTemplate
    )
  }, [salesFile, templateWb, dealerName, salesRows.length, loadingTemplate])

  async function onExport() {
    if (!canExport || !templateWb) return

    const runOne = (pickedDealer: string) => {
      const commonArgs = {
        templateWorkbook: templateWb,
        salesHeaders,
        salesRows,
        filter: {
          dealerName: pickedDealer,
          category: category || undefined,
          month: month || undefined,
        },
      }

      if (templateKey === "vacom-hd") exportVacomHdXlsx(commonArgs as any)
      else if (templateKey === "chi-hoa-hong")
        exportChiHoaHongXlsx(commonArgs as any)
      else exportThuGiaVonXlsx(commonArgs as any)
    }

    // ✅ nếu chọn "Tất cả" => mỗi đại lý 1 file riêng
    if (dealerName === ALL_VALUE) {
      if (!dealers.length) throw new Error("Chưa có danh sách đại lý")

      // lặp từng đại lý và trigger download
      for (const d of dealers) {
        runOne(d)

        // ✅ giúp trình duyệt kịp trigger download từng file (tránh dồn 1 lúc)
        await new Promise((r) => setTimeout(r, 200))
      }
      return
    }

    // ✅ 1 đại lý
    runOne(dealerName)
  }

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="mx-auto max-w-5xl space-y-6">
        {/* chọn template mẫu đối soát */}
        <div className="rounded-xl bg-white p-5 shadow">
          <div className="text-center text-base font-bold">
            Chọn mẫu báo cáo
          </div>

          <div className="mx-auto mt-3 max-w-xl">
            <select
              className="w-full rounded-lg border border-slate-200 bg-white p-3 text-sm"
              value={templateKey}
              onChange={(e) => setTemplateKey(e.target.value as TemplateKey)}
            >
              <option value="vacom-hd">MẪU VACOM HD</option>
              <option value="chi-hoa-hong">MẪU CHI HOA HỒNG</option>
              <option value="thu-gia-von">MẪU THU GIÁ VỐN</option>
            </select>
          </div>
        </div>

        {/* upload sales */}
        <div className="rounded-xl bg-white p-5 shadow">
          <div className="flex items-start gap-3">
            <div className="text-lg">📊</div>
            <div className="flex-1">
              <div className="text-base font-bold">File theo dõi doanh số</div>

              {/* input ẩn */}
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
                  <b>{keyDealer}</b>, cột danh mục: <b>{keyCategory}</b>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* select dealer/category/month */}
        <div className="rounded-xl bg-white p-5 shadow">
          <div className="grid gap-3 md:grid-cols-3">
            <div>
              <div className="text-sm font-semibold text-slate-700">
                Tên đại lý (bắt buộc)
              </div>
              <select
                className="mt-1 w-full rounded-lg border border-slate-200 bg-white p-2 text-sm"
                value={dealerName}
                onChange={(e) => setDealerName(e.target.value)}
                disabled={!dealers.length}
              >
                {/* ✅ thêm option ALL */}
                <option value={ALL_VALUE}>Tất cả</option>

                {dealers.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>

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
            ⬇️ Xuất Excel
          </button>

          {loadingTemplate && (
            <div className="mt-2 text-xs text-slate-500">
              Đang tải template...
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
