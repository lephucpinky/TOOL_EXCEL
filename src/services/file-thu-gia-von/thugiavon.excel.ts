import * as XLSX from "xlsx-js-style"
import type { ExcelRow } from "@/utils/excel"
import { normalize } from "@/utils/excel"

// --------------------
// sheet name helpers
// --------------------
export const sanitizeSheetName = (name: string) =>
  name
    .replace(/[:\\/?*\[\]]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 31)

export const uniqueSheetName = (wb: XLSX.WorkBook, wanted: string) => {
  const base = sanitizeSheetName(wanted) || "Sheet"
  const exists = new Set(wb.SheetNames)
  if (!exists.has(base)) return base
  for (let i = 2; i < 1000; i++) {
    const suffix = ` (${i})`
    const trimmed = base.slice(0, 31 - suffix.length).trim()
    const candidate = `${trimmed}${suffix}`
    if (!exists.has(candidate)) return candidate
  }
  return `${base.slice(0, 28)}_${Date.now().toString().slice(-2)}`
}

// --------------------
// value helpers
// --------------------
export const formatExcelDate = (v: any) => {
  if (v == null || v === "") return ""
  if (v instanceof Date) {
    const d = v.getDate()
    const m = v.getMonth() + 1
    const y = v.getFullYear()
    return `${String(d).padStart(2, "0")}/${String(m).padStart(2, "0")}/${String(y)}`
  }
  if (typeof v === "number") {
    const d = XLSX.SSF.parse_date_code(v)
    if (!d) return ""
    return `${String(d.d).padStart(2, "0")}/${String(d.m).padStart(2, "0")}/${String(d.y)}`
  }
  return String(v)
}

export const num = (v: any) => {
  if (v == null || v === "") return 0
  const n = Number(String(v).replace(/,/g, "").trim())
  return Number.isFinite(n) ? n : 0
}

export const setCellRC = (
  ws: XLSX.WorkSheet,
  r0: number,
  c0: number,
  v: any
) => {
  const addr = XLSX.utils.encode_cell({ r: r0, c: c0 })
  const cur = (ws as any)[addr] || {}

  // object cell (formula / typed cell)
  if (v && typeof v === "object" && ("f" in v || "t" in v || "v" in v)) {
    ;(ws as any)[addr] = { ...cur, ...v }
    return
  }

  const isNum = typeof v === "number"
  ;(ws as any)[addr] = { ...cur, t: isNum ? "n" : "s", v }
}

// --------------------
// template header scanning
// --------------------
export const findFinalHeaderRow0 = (aoa: any[][], scan = 500) => {
  const needNgay = new Set([
    normalize("ngày tháng"),
    normalize("ngày phát sinh"),
  ])
  const needMST = new Set([normalize("mst"), normalize("mã số thuế")])
  const needTen = new Set([normalize("tên công ty"), normalize("tên đơn vị")])

  let best = -1
  for (let r = 0; r < Math.min(scan, aoa.length); r++) {
    const row = (aoa[r] || []).map((x) => normalize(x)).filter(Boolean)
    if (!row.length) continue
    const hasNgay = row.some((x) => needNgay.has(x))
    const hasMST = row.some((x) => needMST.has(x))
    const hasTen = row.some((x) => needTen.has(x))
    if (hasNgay && hasMST && hasTen) best = r
  }
  return best
}

export const mapTemplateCols = (aoa: any[][], finalHeaderRow0: number) => {
  const headerRows = [finalHeaderRow0 - 2, finalHeaderRow0 - 1, finalHeaderRow0]
    .filter((r) => r >= 0)
    .map((r) => aoa[r] || [])

  const findCol = (aliases: string[]) => {
    const set = new Set(aliases.map((x) => normalize(x)))
    for (let rr = headerRows.length - 1; rr >= 0; rr--) {
      const row = headerRows[rr]
      for (let c = 0; c < row.length; c++) {
        if (set.has(normalize(row[c]))) return c
      }
    }
    return -1
  }

  const STT = findCol(["stt"])
  const NGAY = findCol(["ngày phát sinh", "ngày tháng"])
  const MST = findCol(["mã số thuế", "mst"])
  const TEN = findCol(["tên đơn vị", "tên công ty"])

  let TONGTIEN = findCol(["tổng tiền xuất hóa đơn", "tổng tiền xuất hd"])
  let GOIHOADON = findCol(["gói hóa đơn"])
  let DTKHAC = findCol(["dt khác", "doanh thu khác"])
  let NIEMYET = findCol(["giá trị theo niêm yết", "tiền theo niêm yết"])
  let GIAMINV = findCol(["giá minv thu về (xuất hóa đơn)", "hoa hồng"])
  let GHICHU = findCol(["ghi chú", "ghi chu"])

  const base = TEN !== -1 ? TEN + 1 : 4
  if (TONGTIEN === -1) TONGTIEN = base + 0
  if (GOIHOADON === -1) GOIHOADON = base + 1
  if (DTKHAC === -1) DTKHAC = base + 2
  if (NIEMYET === -1) NIEMYET = base + 3
  if (GIAMINV === -1) GIAMINV = base + 4
  if (GHICHU === -1) GHICHU = base + 5

  const STT2 = STT !== -1 ? STT : 0
  if (GOIHOADON === TONGTIEN) GOIHOADON = TONGTIEN + 1

  const lastCol = Math.max(
    STT2,
    NGAY,
    MST,
    TEN,
    TONGTIEN,
    GOIHOADON,
    DTKHAC,
    NIEMYET,
    GIAMINV,
    GHICHU
  )

  return {
    COL: {
      STT: STT2,
      NGAY,
      MST,
      TEN,
      TONGTIEN,
      GOIHOADON,
      DTKHAC,
      NIEMYET,
      GIAMINV,
      GHICHU,
    },
    lastCol,
  }
}

export const findFooterLabelRow0 = (aoa: any[][], scan = 10000) => {
  const keys = [normalize("GIÁ TRỊ M-INVOICE THU TIỀN - XUẤT HD")]
  const end = Math.min(scan, aoa.length)
  for (let r = end - 1; r >= 0; r--) {
    const line = normalize((aoa[r] || []).join(" "))
    if (keys.some((k) => line.includes(k))) return r
  }
  return -1
}

// --------------------
// sales picker
// --------------------
export const buildSalesPicker = (rows: ExcelRow[]) => {
  const headers = Object.keys(rows[0] || {})
  const idx = new Map<string, string>()
  for (const h of headers) {
    const k = normalize(h)
    if (k && !idx.has(k)) idx.set(k, h)
  }
  const pick = (...aliases: string[]) => {
    for (const a of aliases) {
      const h = idx.get(normalize(a))
      if (h) return h
    }
    return ""
  }

  return {
    H: {
      DAILY: pick("Tên đại lý", "Đại lý"),
      NGAY: pick("Ngày tháng", "Ngày phát sinh", "Ngày"),
      MST: pick("Mã số thuế", "MST"),
      MA_DAI_LY: pick("Mã đại lý", "Ma dai ly", "MADAILY", "MA DAI LY"),
      TEN: pick("Tên đơn vị", "Tên công ty"),
      TONGTIEN: pick("TỔNG TIỀN XUẤT HÓA ĐƠN", "Tổng tiền xuất HD"),
      GOI: pick("GÓI HÓA ĐƠN", "SL phát hành"),
      DTKHAC: pick("DT khác", "Doanh thu khác"),
      NIEMYET: pick("Giá trị theo niêm yết", "tiền theo niêm yết"),
      GIAMINV: pick("GIÁ MINV THU VỀ (XUẤT HÓA ĐƠN)", "Hoa hồng"),
      GHICHU: pick("Ghi chú"),
    },
  }
}

/** lấy monthStr = "MM/YYYY" từ cột Ngày tháng/Ngày phát sinh trong salesRows của dealer */
export const pickMonthStrFromSalesRows = (
  salesRows: ExcelRow[],
  picker: ReturnType<typeof buildSalesPicker>,
  dealerPicked: string
) => {
  const dealerKey = picker.H.DAILY || "Tên đại lý"
  const dateKey = picker.H.NGAY || "Ngày tháng"

  // lấy ngày đầu tiên hợp lệ của dealer
  for (const r of salesRows) {
    const dn = String((r as any)[dealerKey] ?? "").trim()
    if (dn !== dealerPicked) continue

    const raw =
      (r as any)[dateKey] ??
      (r as any)["Ngày tháng"] ??
      (r as any)["Ngày phát sinh"]
    if (raw == null || raw === "") continue

    // raw có thể là Date | number (excel serial) | string
    let d: Date | null = null

    if (raw instanceof Date) {
      d = raw
    } else if (typeof raw === "number") {
      const dc = XLSX.SSF.parse_date_code(raw)
      if (dc) d = new Date(dc.y, dc.m - 1, dc.d)
    } else {
      const s = String(raw).trim()

      // dd/mm/yyyy hoặc d/m/yyyy
      const m1 = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/)
      if (m1) {
        const dd = Number(m1[1])
        const mm = Number(m1[2])
        let yy = Number(m1[3])
        if (yy < 100) yy += 2000
        d = new Date(yy, mm - 1, dd)
      } else {
        // fallback: Date.parse
        const t = Date.parse(s)
        if (!Number.isNaN(t)) d = new Date(t)
      }
    }

    if (!d || Number.isNaN(d.getTime())) continue

    const mm = String(d.getMonth() + 1).padStart(2, "0")
    const yyyy = String(d.getFullYear())
    return `${mm}/${yyyy}`
  }

  // fallback nếu không tìm được ngày
  const now = new Date()
  return `${String(now.getMonth() + 1).padStart(2, "0")}/${now.getFullYear()}`
}
