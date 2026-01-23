"use client"

import * as XLSX from "xlsx-js-style"
import type { ExcelRow } from "../utils/excel"
import {
  deepCloneSheet,
  ensureRefIncludes,
  findSheetName,
  insertRows,
  normalize,
  setCell,
  unmergeInRange,
} from "../utils/excel"
import {
  addLogoToA1ExcelJS,
  downloadArrayBuffer,
  fetchPngAsBase64,
} from "@/lib/logo"
import { COL_HOA_HONG } from "@/constants/Mauhoahong"

type ExportArgs = {
  templateWorkbook: XLSX.WorkBook
  salesHeaders: string[]
  salesRows: ExcelRow[]
  sheetName?: string
  filter: { dealerName: string; category?: string; month?: string }
  onLog?: (msg: string, ...rest: any[]) => void
}

/* =========================
   Helpers: Cell / Style
========================= */

const NUM_PARENS_FMT = "#,##0;(#,##0);0"

const BLUE_LIGHT = { patternType: "solid", fgColor: { rgb: "D9EAF7" } }
const BLUE_DARK = { patternType: "solid", fgColor: { rgb: "9DC3E6" } }
const RED_FONT = { color: { rgb: "FF0000" }, bold: true }
const YELLOW_BG = { patternType: "solid", fgColor: { rgb: "FFFF00" } }

const BORDER_THIN = {
  top: { style: "thin", color: { rgb: "000000" } },
  bottom: { style: "thin", color: { rgb: "000000" } },
  left: { style: "thin", color: { rgb: "000000" } },
  right: { style: "thin", color: { rgb: "000000" } },
}

const BORDER_THICK = {
  top: { style: "medium", color: { rgb: "000000" } },
  bottom: { style: "medium", color: { rgb: "000000" } },
  left: { style: "medium", color: { rgb: "000000" } },
  right: { style: "medium", color: { rgb: "000000" } },
}

const ensureCell = (ws: XLSX.WorkSheet, r0: number, c0: number) => {
  const addr = XLSX.utils.encode_cell({ r: r0, c: c0 })
  if (!(ws as any)[addr]) (ws as any)[addr] = { t: "s", v: "" }
  return (ws as any)[addr]
}

const patchCellStyle = (
  ws: XLSX.WorkSheet,
  r0: number,
  c0: number,
  patch: any
) => {
  const cell = ensureCell(ws, r0, c0)
  const s0 = cell.s || {}
  cell.s = {
    ...s0,
    ...patch,
    border: patch.border ?? s0.border,
    alignment: patch.alignment ?? s0.alignment,
    fill: patch.fill ?? s0.fill,
    font: patch.font ?? s0.font,
  }
}

const mergeCells = (
  ws: XLSX.WorkSheet,
  r0: number,
  cStart0: number,
  cEnd0: number
) => {
  const merges = ((ws as any)["!merges"] || []) as XLSX.Range[]
  merges.push({ s: { r: r0, c: cStart0 }, e: { r: r0, c: cEnd0 } })
  ;(ws as any)["!merges"] = merges
}

const setTextKeepStyle = (
  ws: XLSX.WorkSheet,
  r0: number,
  c0: number,
  value: string
) => {
  const addr = XLSX.utils.encode_cell({ r: r0, c: c0 })
  const keepS = (ws as any)[addr]?.s
  const old = (ws as any)[addr] || {}
  ;(ws as any)[addr] = { ...old, t: "s", v: value, s: keepS }
}

const setFormulaKeepStyle = (
  ws: XLSX.WorkSheet,
  r0: number,
  c0: number,
  formula: string,
  fmt?: string
) => {
  const addr = XLSX.utils.encode_cell({ r: r0, c: c0 })
  const keepS = (ws as any)[addr]?.s
  const keepZ = (ws as any)[addr]?.z
  const old = (ws as any)[addr] || {}

  // xoá cached value cũ (tránh giữ #VALUE!)
  delete old.v
  delete old.w
  delete old.vt
  ;(ws as any)[addr] = {
    ...old,
    t: "n",
    v: 0,
    f: formula.startsWith("=") ? formula.slice(1) : formula,
    s: keepS,
    z: fmt || keepZ,
  }
}

const setColumnWidths = (ws: XLSX.WorkSheet) => {
  ws["!cols"] = [
    { wch: 4 }, // A - STT
    { wch: 10 }, // B - Ngày
    { wch: 14 }, // C - MST
    { wch: 28 }, // D - Tên KH
    { wch: 22 }, // E - SL
    { wch: 32 }, // F - Tổng tiền
    { wch: 14 }, // G - Giá PP
    { wch: 12 }, // H - Chênh
    { wch: 12 }, // I - DT khác
    { wch: 10 }, // J - % HH
    { wch: 14 }, // K - Phí
    { wch: 14 }, // L - HH
    { wch: 14 }, // M - M-invoice thu
    { wch: 14 }, // N - Chênh TT
    { wch: 12 }, // O - Ghi chú
  ]
}

const applyAlignRowWithLeftTen = (
  ws: XLSX.WorkSheet,
  row0: number,
  cStart0: number,
  cEnd0: number,
  tenCol0: number
) => {
  for (let c0 = cStart0; c0 <= cEnd0; c0++) {
    patchCellStyle(ws, row0, c0, {
      alignment:
        c0 === tenCol0
          ? { horizontal: "left", vertical: "center", wrapText: true }
          : { horizontal: "center", vertical: "center", wrapText: true },
    })
  }
}

const applyInnerThinBorders = (
  ws: XLSX.WorkSheet,
  rStart0: number,
  rEnd0: number,
  cStart0: number,
  cEnd0: number
) => {
  for (let r0 = rStart0; r0 <= rEnd0; r0++) {
    for (let c0 = cStart0; c0 <= cEnd0; c0++) {
      patchCellStyle(ws, r0, c0, { border: BORDER_THIN })
    }
  }
  ensureRefIncludes(ws, rEnd0, cEnd0)
}

const applyOuterThickBorder = (
  ws: XLSX.WorkSheet,
  rStart0: number,
  rEnd0: number,
  cStart0: number,
  cEnd0: number
) => {
  for (let c0 = cStart0; c0 <= cEnd0; c0++) {
    patchCellStyle(ws, rStart0, c0, {
      border: {
        ...(ensureCell(ws, rStart0, c0).s?.border || BORDER_THIN),
        top: BORDER_THICK.top,
      },
    })
    patchCellStyle(ws, rEnd0, c0, {
      border: {
        ...(ensureCell(ws, rEnd0, c0).s?.border || BORDER_THIN),
        bottom: BORDER_THICK.bottom,
      },
    })
  }

  for (let r0 = rStart0; r0 <= rEnd0; r0++) {
    patchCellStyle(ws, r0, cStart0, {
      border: {
        ...(ensureCell(ws, r0, cStart0).s?.border || BORDER_THIN),
        left: BORDER_THICK.left,
      },
    })
    patchCellStyle(ws, r0, cEnd0, {
      border: {
        ...(ensureCell(ws, r0, cEnd0).s?.border || BORDER_THIN),
        right: BORDER_THICK.right,
      },
    })
  }
  ensureRefIncludes(ws, rEnd0, cEnd0)
}

const applyFillRow = (
  ws: XLSX.WorkSheet,
  row0: number,
  cStart0: number,
  cEnd0: number,
  fill: any
) => {
  for (let c0 = cStart0; c0 <= cEnd0; c0++)
    patchCellStyle(ws, row0, c0, { fill })
  ensureRefIncludes(ws, row0, cEnd0)
}

const setRowFont = (
  ws: XLSX.WorkSheet,
  row0: number,
  cStart0: number,
  cEnd0: number,
  fontPatch: any
) => {
  for (let c0 = cStart0; c0 <= cEnd0; c0++) {
    const cell = ensureCell(ws, row0, c0)
    const font0 = cell.s?.font || {}
    patchCellStyle(ws, row0, c0, { font: { ...font0, ...fontPatch } })
  }
  ensureRefIncludes(ws, row0, cEnd0)
}

/* =========================
   Helpers: Find rows
========================= */

const findTitleRowA = (
  ws: XLSX.WorkSheet,
  label: string,
  opts?: { startsWith?: boolean; scanRows?: number }
) => {
  const want = normalize(label)
  const range = XLSX.utils.decode_range(ws["!ref"] || "A1")
  const maxR = Math.min(range.e.r, (opts?.scanRows ?? 5000) - 1)

  for (let r0 = 0; r0 <= maxR; r0++) {
    const addr = XLSX.utils.encode_cell({ r: r0, c: 0 }) // chỉ cột A
    const v = (ws as any)[addr]?.v
    const s = normalize(v ?? "")
    if (!s) continue
    if (opts?.startsWith ? s.startsWith(want) : s === want) return r0
  }
  return -1
}

const findRowContains = (
  ws: XLSX.WorkSheet,
  label: string,
  opts?: { scanRows?: number; scanCols?: number }
) => {
  const want = normalize(label)
  const range = XLSX.utils.decode_range(ws["!ref"] || "A1")
  const maxR = Math.min(range.e.r, (opts?.scanRows ?? 200) - 1)
  const maxC = Math.min(range.e.c, (opts?.scanCols ?? 20) - 1)

  for (let r0 = 0; r0 <= maxR; r0++) {
    for (let c0 = 0; c0 <= maxC; c0++) {
      const addr = XLSX.utils.encode_cell({ r: r0, c: c0 })
      const v = (ws as any)[addr]?.v
      const s = normalize(v ?? "")
      if (s && s.includes(want)) return r0
    }
  }
  return -1
}

/* =========================
   Helpers: Section classify
========================= */

const classifyProductToSectionHoaHong = (
  v: any
): "A" | "B" | "C" | "D" | "E" | "F" | "G" | "" => {
  const s = normalize(v)

  if (
    (s.includes("hoadon") && s.includes("dientu")) ||
    s.includes("hoadondientu") ||
    s.includes("hddt") ||
    ((s.includes("tem") || s.includes("ve") || s.includes("the")) &&
      s.includes("dientu"))
  )
    return "A"

  if (
    (s.includes("hoadon") && s.includes("maytinhtien")) ||
    s.includes("maytinhtien") ||
    s.includes("mtt")
  )
    return "B"

  if (s.includes("khautru") || s.includes("tncn") || s.includes("chungtu"))
    return "C"
  if (s.includes("bhxh")) return "D"
  if (s.includes("smi")) return "E"

  if (
    s.includes("msller") ||
    s.includes("mseller") ||
    (s.includes("pm") && s.includes("banhang"))
  )
    return "F"

  if (s.includes("cks") || s.includes("chukyso") || s.includes("chukiso"))
    return "G"

  return ""
}

/* =========================
   Helpers: Copy row style
========================= */

const HoaHongRowStyle = (
  ws: XLSX.WorkSheet,
  srcRow0: number,
  dstRow0: number,
  cStart0: number,
  cEnd0: number
) => {
  for (let c0 = cStart0; c0 <= cEnd0; c0++) {
    const srcAddr = XLSX.utils.encode_cell({ r: srcRow0, c: c0 })
    const dstAddr = XLSX.utils.encode_cell({ r: dstRow0, c: c0 })

    const srcCell: any = (ws as any)[srcAddr]
    const dstCell: any = (ws as any)[dstAddr]
    if (!srcCell) continue

    const v = dstCell?.v ?? ""
    const t = dstCell?.t ?? "s"

    ;(ws as any)[dstAddr] = {
      ...dstCell,
      t,
      v,
      s: srcCell.s ? JSON.parse(JSON.stringify(srcCell.s)) : dstCell?.s,
      z: srcCell.z ?? dstCell?.z,
    }
  }

  const rows: any[] = (ws as any)["!rows"] || []
  if (rows[srcRow0]) {
    rows[dstRow0] = { ...rows[srcRow0] }
    ;(ws as any)["!rows"] = rows
  }
}

const HoaHongRowStyleBlock = (
  ws: XLSX.WorkSheet,
  srcRow0: number,
  startDstRow0: number,
  count: number,
  cStart0: number,
  cEnd0: number
) => {
  for (let i = 0; i < count; i++) {
    HoaHongRowStyle(ws, srcRow0, startDstRow0 + i, cStart0, cEnd0)
  }
}

/* =========================
   Helpers: Clear data keep style
========================= */

const clearDataKeepStyle = (
  ws: XLSX.WorkSheet,
  rStart0: number,
  rEnd0: number,
  cStart0: number,
  cEnd0: number
) => {
  if (rEnd0 < rStart0 || cEnd0 < cStart0) return

  const isNumericCol = (c0: number) =>
    (c0 >= COL_HOA_HONG.SL && c0 <= COL_HOA_HONG.CHENH_TT) ||
    c0 === COL_HOA_HONG.HH_PERCENT

  for (let r0 = rStart0; r0 <= rEnd0; r0++) {
    for (let c0 = cStart0; c0 <= cEnd0; c0++) {
      const addr = XLSX.utils.encode_cell({ r: r0, c: c0 })
      const cell: any = (ws as any)[addr]
      if (!cell) continue

      const s = cell.s
      const z = cell.z

      ;(ws as any)[addr] = isNumericCol(c0)
        ? { t: "n", v: 0, s, z }
        : { t: "s", v: "", s, z }
    }
  }
}

/* =========================
   SUM rows
========================= */

const setSectionSumRow = (
  ws: XLSX.WorkSheet,
  titleRow0: number,
  dataStartRow0: number,
  dataEndRow0: number
) => {
  const rStart1 = dataStartRow0 + 1
  const rEnd1 = dataEndRow0 + 1

  const mkSum = (colIdx: number) => {
    const col = XLSX.utils.encode_col(colIdx)
    return dataEndRow0 >= dataStartRow0
      ? `SUM(${col}${rStart1}:${col}${rEnd1})`
      : "0"
  }

  const sumTargets = [
    COL_HOA_HONG.SL,
    COL_HOA_HONG.TIEN,
    COL_HOA_HONG.GIAPP,
    COL_HOA_HONG.CHENH,
    COL_HOA_HONG.DOANHTHUKHAC,
    COL_HOA_HONG.PHI_TRA,
    COL_HOA_HONG.HOA_HONG,
    COL_HOA_HONG.MI_THU,
    COL_HOA_HONG.CHENH_TT,
  ]

  sumTargets.forEach((c0) => {
    const addr = XLSX.utils.encode_cell({ r: titleRow0, c: c0 })
    const keepS = (ws as any)[addr]?.s
    ;(ws as any)[addr] = { t: "n", f: mkSum(c0), s: keepS }
  })

  // %: không sum
  {
    const addr = XLSX.utils.encode_cell({
      r: titleRow0,
      c: COL_HOA_HONG.HH_PERCENT,
    })
    const keepS = (ws as any)[addr]?.s
    ;(ws as any)[addr] = { t: "n", v: 0, z: "0%", s: keepS }
  }

  // ghi chú: text rỗng
  {
    const addr = XLSX.utils.encode_cell({
      r: titleRow0,
      c: COL_HOA_HONG.GHICHU,
    })
    const keepS = (ws as any)[addr]?.s
    ;(ws as any)[addr] = { t: "s", v: "", s: keepS }
  }

  ensureRefIncludes(ws, titleRow0, COL_HOA_HONG.GHICHU)
}

const setGrandTotalRow = (
  ws: XLSX.WorkSheet,
  totalRow0: number,
  titleRows0: number[]
) => {
  const mk = (c0: number) => {
    const col = XLSX.utils.encode_col(c0)
    const parts = titleRows0.map((r0) => `${col}${r0 + 1}`)
    return parts.length ? parts.join("+") : "0"
  }

  const sumTargets = [
    COL_HOA_HONG.SL,
    COL_HOA_HONG.TIEN,
    COL_HOA_HONG.GIAPP,
    COL_HOA_HONG.CHENH,
    COL_HOA_HONG.DOANHTHUKHAC,
    COL_HOA_HONG.PHI_TRA,
    COL_HOA_HONG.HOA_HONG,
    COL_HOA_HONG.MI_THU,
    COL_HOA_HONG.CHENH_TT,
  ]

  sumTargets.forEach((c0) => {
    const addr = XLSX.utils.encode_cell({ r: totalRow0, c: c0 })
    const keepS = (ws as any)[addr]?.s
    ;(ws as any)[addr] = { t: "n", f: mk(c0), s: keepS }
  })

  {
    const addr = XLSX.utils.encode_cell({
      r: totalRow0,
      c: COL_HOA_HONG.HH_PERCENT,
    })
    const keepS = (ws as any)[addr]?.s
    ;(ws as any)[addr] = { t: "n", v: 0, z: "0%", s: keepS }
  }
  {
    const addr = XLSX.utils.encode_cell({
      r: totalRow0,
      c: COL_HOA_HONG.GHICHU,
    })
    const keepS = (ws as any)[addr]?.s
    ;(ws as any)[addr] = { t: "s", v: "", s: keepS }
  }

  ensureRefIncludes(ws, totalRow0, COL_HOA_HONG.GHICHU)
}

/* =========================
   Main export
========================= */

export async function exportChiHoaHongXlsx(args: ExportArgs) {
  const { templateWorkbook, salesHeaders, salesRows, filter } = args

  if (!templateWorkbook) throw new Error("Thiếu file mẫu")
  if (!Array.isArray(salesRows) || salesRows.length === 0)
    throw new Error("Thiếu dữ liệu doanh thu")
  if (!filter?.dealerName) throw new Error("❌ Thiếu filter.dealerName")

  // headers -> index map
  const headers = Array.isArray(salesHeaders)
    ? salesHeaders.filter(Boolean)
    : []
  if (!headers.length) throw new Error("❌ salesHeaders rỗng/undefined")

  const salesIndex = new Map<string, string>()
  headers.forEach((h) => {
    const k = normalize(h)
    if (k && !salesIndex.has(k)) salesIndex.set(k, h)
  })

  const pickHeader = (...aliases: string[]) => {
    for (const a of aliases) {
      const h = salesIndex.get(normalize(a))
      if (h) return h
    }
    return ""
  }

  // sheet
  const realName =
    args.sheetName && templateWorkbook.SheetNames.includes(args.sheetName)
      ? args.sheetName
      : findSheetName(templateWorkbook, "MẪU CHI HOA HỒNG")

  if (!realName) throw new Error("❌ Không tìm thấy sheet: MẪU CHI HOA HỒNG")

  const templateWs = templateWorkbook.Sheets[realName]
  if (!templateWs) throw new Error("❌ Không đọc được sheet HOA HỒNG")

  // map cột
  const H_LOAI = pickHeader("Loại sản phẩm")
  const H_NGAY = pickHeader("Ngày tháng", "Ngày phát sinh")
  const H_MST = pickHeader("MST")
  const H_TEN = pickHeader("Tên công ty", "Tên khách hàng", "Tên Khách hàng")
  const H_SL = pickHeader("SL phát hành", "Số lượng phát hành")
  const H_TIEN = pickHeader("Tổng tiền xuất HD")
  const H_GIAPP = pickHeader(
    "GIÁ PP ( TIỀN GỐC)",
    "GIÁ PP (TIỀN GỐC)",
    "GIÁ PP"
  )
  const H_CHENH = pickHeader("Số tiền chênh", "Số Tiền chênh")
  const H_DTK = pickHeader("Doanh thu khác")
  const H_HH_PERCENT = pickHeader("TỶ LỆ HOA HỒNG", "Tỷ lệ hoa hồng")
  const H_PHI_TRA = pickHeader("Phí viết chênh (Minvoice trả)")
  const H_HOA_HONG = pickHeader("Hoa hồng đối tác", "Hoa hồng")
  const H_MI_THU = pickHeader("Số tiền M-invoice Thu")
  const H_CHENH_TT = pickHeader("Chênh lệch thanh toán")
  const H_GHICHU = pickHeader("Ghi chú")

  const H_DEALER = pickHeader("Tên đại lý", "Đại lý", "Dealer")
  const H_CATEGORY = pickHeader("Danh mục", "Category") || H_LOAI

  const missing: string[] = []
  if (!H_LOAI) missing.push("Loại sản phẩm")
  if (!H_NGAY) missing.push("Ngày tháng / Ngày phát sinh")
  if (!H_MST) missing.push("MST")
  if (!H_TEN) missing.push("Tên công ty")
  if (!H_SL) missing.push("SL phát hành")
  if (!H_TIEN) missing.push("Tổng tiền xuất HD")
  if (!H_GIAPP) missing.push("GIÁ PP ( TIỀN GỐC)")
  if (!H_CHENH) missing.push("Số tiền chênh")
  if (!H_DTK) missing.push("Doanh thu khác")
  if (!H_HH_PERCENT) missing.push("TỶ LỆ HOA HỒNG")
  if (!H_PHI_TRA) missing.push("Phí viết chênh (Minvoice trả)")
  if (!H_HOA_HONG) missing.push("Hoa hồng đối tác/Hoa hồng")
  if (!H_MI_THU) missing.push("Số tiền M-invoice Thu")
  if (!H_CHENH_TT) missing.push("Chênh lệch thanh toán")
  if (!H_DEALER) missing.push("Tên đại lý/Đại lý")
  if (missing.length)
    throw new Error("❌ Thiếu cột trong file doanh thu: " + missing.join(", "))

  // filter
  const wantedDealer = normalize(filter.dealerName || "")
  const wantedCategory = normalize(filter.category || "")

  const filteredRows = salesRows.filter((row) => {
    if (normalize(row[H_DEALER]) !== wantedDealer) return false
    if (!wantedCategory) return true
    return normalize(row[H_CATEGORY]) === wantedCategory
  })

  if (!filteredRows.length) {
    throw new Error(
      `❌ Không có dữ liệu sau lọc: dealer="${filter.dealerName}" category="${filter.category ?? ""}"`
    )
  }

  // clone sheet (giữ formulas)
  const newWs = deepCloneSheet(templateWs)

  setColumnWidths(newWs)

  // title/month (giữ style template, fill value ở cột F)
  const rTITLE = findRowContains(newWs, "BẢNG ĐỐI SOÁT ĐẠI LÝ")
  const rMONTH = findRowContains(newWs, "THÁNG")

  const now = new Date()
  const fallbackMonth = `${String(now.getMonth() + 1).padStart(2, "0")}/${now.getFullYear()}`
  const monthText = filter.month || fallbackMonth
  const VALUE_COL = 5 // F

  if (rTITLE !== -1)
    setTextKeepStyle(newWs, rTITLE, VALUE_COL, filter.dealerName)
  if (rMONTH !== -1)
    setTextKeepStyle(newWs, rMONTH, VALUE_COL, monthText)
    // ✅ bold + canh trái + không wrap cho dòng TITLE/MONTH ở cột E,F
  ;[rTITLE, rMONTH].forEach((r0) => {
    if (r0 === -1) return
    ;[4, 5].forEach((c0) => {
      const cell = ensureCell(newWs, r0, c0)
      const font0 = cell.s?.font || {}
      patchCellStyle(newWs, r0, c0, {
        font: { ...font0, bold: true },
        alignment: { horizontal: "left", vertical: "center", wrapText: false },
      })
    })
  })

  // find A..G + TOTAL (A exact row by col A; TOTAL match exact "CỘNG")
  const rA = findTitleRowA(newWs, "A. GIÁ TRỊ HÓA ĐƠN ĐIỆN TỬ", {
    startsWith: true,
  })
  const rB = findTitleRowA(newWs, "B. MÁY TÍNH TIỀN", { startsWith: true })
  const rC = findTitleRowA(newWs, "C. CHỨNG TỪ KHẤU TRỪ THUẾ TNCN", {
    startsWith: true,
  })
  const rD = findTitleRowA(newWs, "D. BHXH", { startsWith: true })
  const rE = findTitleRowA(newWs, "E. QUẢN LÝ HÓA ĐƠN SMI", {
    startsWith: true,
  })
  const rF = findTitleRowA(newWs, "F. PM BÁN HÀNG", { startsWith: true })
  const rG = findTitleRowA(newWs, "G. GIÁ TRỊ CHỮ KÝ SỐ", { startsWith: true })
  const rTOTAL = findTitleRowA(newWs, "CỘNG", { startsWith: false })

  if ([rA, rB, rC, rD, rE, rF, rG, rTOTAL].some((x) => x === -1)) {
    throw new Error(
      "❌ Không tìm thấy đủ khu A..G hoặc dòng CỘNG trong template HOA HỒNG."
    )
  }

  // group rows
  const group: Record<"A" | "B" | "C" | "D" | "E" | "F" | "G", ExcelRow[]> = {
    A: [],
    B: [],
    C: [],
    D: [],
    E: [],
    F: [],
    G: [],
  }

  filteredRows.forEach((row) => {
    const sec = classifyProductToSectionHoaHong(row[H_LOAI])
    if (sec) group[sec].push(row)
  })

  const maxCol = COL_HOA_HONG.GHICHU
  for (let r0 = 0; r0 <= 2; r0++) {
    for (let c0 = 0; c0 <= maxCol; c0++) {
      const cell = ensureCell(newWs, r0, c0)
      const font0 = cell.s?.font || {}
      patchCellStyle(newWs, r0, c0, { font: { ...font0, bold: true } })
    }
  }
  const boldRowByContains = (needle: string) => {
    const r0 = findRowContains(newWs, needle, { scanRows: 50, scanCols: 10 })
    if (r0 === -1) return
    for (let c0 = 0; c0 <= COL_HOA_HONG.GHICHU; c0++) {
      const cell = ensureCell(newWs, r0, c0)
      const font0 = cell.s?.font || {}
      patchCellStyle(newWs, r0, c0, { font: { ...font0, bold: true } })
    }
  }

  // ✅ ví dụ theo hình:
  boldRowByContains("CÔNG TY TNHH HÓA ĐƠN ĐIỆN TỬ M-INVOICE")
  boldRowByContains("Số 2 Nguyễn Thế Lộc")
  boldRowByContains("0106026495-001")

  // ensure enough rows in each section (insert bottom-up)
  const ensureSpace = (
    sec: keyof typeof group,
    titleLabel: string,
    nextLabel: string,
    nextExact = false
  ) => {
    const titleRow = findTitleRowA(newWs, titleLabel, { startsWith: true })
    const boundaryRow = findTitleRowA(newWs, nextLabel, {
      startsWith: !nextExact ? true : false,
    })
    if (titleRow === -1 || boundaryRow === -1) return

    const start = titleRow + 1
    const placeholder = Math.max(0, boundaryRow - start)
    const needInsert = Math.max(0, group[sec].length - placeholder)
    if (needInsert <= 0) return

    insertRows(newWs, boundaryRow, needInsert)

    const srcStyleRow0 = Math.max(titleRow + 1, boundaryRow - 1)
    HoaHongRowStyleBlock(
      newWs,
      srcStyleRow0,
      boundaryRow,
      needInsert,
      0,
      maxCol
    )
  }

  ensureSpace("G", "G. GIÁ TRỊ CHỮ KÝ SỐ", "CỘNG", true)
  ensureSpace("F", "F. PM BÁN HÀNG", "G. GIÁ TRỊ CHỮ KÝ SỐ")
  ensureSpace("E", "E. QUẢN LÝ HÓA ĐƠN SMI", "F. PM BÁN HÀNG")
  ensureSpace("D", "D. BHXH", "E. QUẢN LÝ HÓA ĐƠN SMI")
  ensureSpace("C", "C. CHỨNG TỪ KHẤU TRỪ THUẾ TNCN", "D. BHXH")
  ensureSpace("B", "B. MÁY TÍNH TIỀN", "C. CHỨNG TỪ KHẤU TRỪ THUẾ TNCN")
  ensureSpace("A", "A. GIÁ TRỊ HÓA ĐƠN ĐIỆN TỬ", "B. MÁY TÍNH TIỀN")

  // refind after insert
  const rA2 = findTitleRowA(newWs, "A. GIÁ TRỊ HÓA ĐƠN ĐIỆN TỬ", {
    startsWith: true,
  })
  const rB2 = findTitleRowA(newWs, "B. MÁY TÍNH TIỀN", { startsWith: true })
  const rC2 = findTitleRowA(newWs, "C. CHỨNG TỪ KHẤU TRỪ THUẾ TNCN", {
    startsWith: true,
  })
  const rD2 = findTitleRowA(newWs, "D. BHXH", { startsWith: true })
  const rE2 = findTitleRowA(newWs, "E. QUẢN LÝ HÓA ĐƠN SMI", {
    startsWith: true,
  })
  const rF2 = findTitleRowA(newWs, "F. PM BÁN HÀNG", { startsWith: true })
  const rG2 = findTitleRowA(newWs, "G. GIÁ TRỊ CHỮ KÝ SỐ", { startsWith: true })
  const rTOTAL2 = findTitleRowA(newWs, "CỘNG", { startsWith: false })

  const startA = rA2 + 1
  const startB = rB2 + 1
  const startC = rC2 + 1
  const startD = rD2 + 1
  const startE = rE2 + 1
  const startF = rF2 + 1
  const startG = rG2 + 1

  const clearBlock = (startRow0: number, endRow0: number) => {
    if (endRow0 < startRow0) return
    clearDataKeepStyle(newWs, startRow0, endRow0, 0, maxCol)
    unmergeInRange(newWs, startRow0, endRow0)
  }

  clearBlock(startA, rB2 - 1)
  clearBlock(startB, rC2 - 1)
  clearBlock(startC, rD2 - 1)
  clearBlock(startD, rE2 - 1)
  clearBlock(startE, rF2 - 1)
  clearBlock(startF, rG2 - 1)
  clearBlock(startG, rTOTAL2 - 1)

  let lastFilledRow0 = startA

  const fillSection = (startRow0: number, rows: ExcelRow[]) => {
    for (let i = 0; i < rows.length; i++) {
      const r0 = startRow0 + i
      const row = rows[i]

      setCell(newWs, r0, COL_HOA_HONG.STT, i + 1, { kind: "stt", force: true })
      setCell(newWs, r0, COL_HOA_HONG.NGAY, row[H_NGAY], {
        kind: "date",
        force: true,
      })
      setCell(newWs, r0, COL_HOA_HONG.MST, row[H_MST], {
        kind: "text",
        force: true,
      })
      setCell(newWs, r0, COL_HOA_HONG.TEN, row[H_TEN], {
        kind: "text",
        force: true,
      })

      setCell(newWs, r0, COL_HOA_HONG.SL, row[H_SL], {
        kind: "number0",
        force: true,
      })
      setCell(newWs, r0, COL_HOA_HONG.TIEN, row[H_TIEN], {
        kind: "number0",
        force: true,
      })
      setCell(newWs, r0, COL_HOA_HONG.GIAPP, row[H_GIAPP], {
        kind: "number0",
        force: true,
      })
      setCell(newWs, r0, COL_HOA_HONG.CHENH, row[H_CHENH], {
        kind: "number0",
        force: true,
      })
      setCell(newWs, r0, COL_HOA_HONG.DOANHTHUKHAC, row[H_DTK], {
        kind: "number0",
        force: true,
      })

      setCell(newWs, r0, COL_HOA_HONG.HH_PERCENT, row[H_HH_PERCENT], {
        kind: "percent",
        force: true,
      })
      setCell(newWs, r0, COL_HOA_HONG.PHI_TRA, row[H_PHI_TRA], {
        kind: "number0",
        force: true,
      })
      setCell(newWs, r0, COL_HOA_HONG.HOA_HONG, row[H_HOA_HONG], {
        kind: "number0",
        force: true,
      })
      setCell(newWs, r0, COL_HOA_HONG.MI_THU, row[H_MI_THU], {
        kind: "number0",
        force: true,
      })
      setCell(newWs, r0, COL_HOA_HONG.CHENH_TT, row[H_CHENH_TT], {
        kind: "number0",
        force: true,
      })

      setCell(newWs, r0, COL_HOA_HONG.GHICHU, H_GHICHU ? row[H_GHICHU] : "", {
        kind: "text",
        force: true,
      })

      lastFilledRow0 = Math.max(lastFilledRow0, r0)
    }
  }

  fillSection(startA, group.A)
  fillSection(startB, group.B)
  fillSection(startC, group.C)
  fillSection(startD, group.D)
  fillSection(startE, group.E)
  fillSection(startF, group.F)
  fillSection(startG, group.G)

  const endA = startA + group.A.length - 1
  const endB = startB + group.B.length - 1
  const endC = startC + group.C.length - 1
  const endD = startD + group.D.length - 1
  const endE = startE + group.E.length - 1
  const endF = startF + group.F.length - 1
  const endG = startG + group.G.length - 1

  // section sums (dòng xanh A..G)
  setSectionSumRow(newWs, rA2, startA, endA)
  setSectionSumRow(newWs, rB2, startB, endB)
  setSectionSumRow(newWs, rC2, startC, endC)
  setSectionSumRow(newWs, rD2, startD, endD)
  setSectionSumRow(newWs, rE2, startE, endE)
  setSectionSumRow(newWs, rF2, startF, endF)
  setSectionSumRow(newWs, rG2, startG, endG)

  // grand total row (CỘNG)
  setGrandTotalRow(newWs, rTOTAL2, [rA2, rB2, rC2, rD2, rE2, rF2, rG2])

  /* ===============================
     Footer formulas (giá trị ở cột J)
  =============================== */

  const FOOTER_COL0 = COL_HOA_HONG.HH_PERCENT // J

  const addrL_Total = XLSX.utils.encode_cell({
    r: rTOTAL2,
    c: COL_HOA_HONG.HOA_HONG,
  }) // L
  const addrF_Total = XLSX.utils.encode_cell({
    r: rTOTAL2,
    c: COL_HOA_HONG.TIEN,
  }) // F
  const addrN_Total = XLSX.utils.encode_cell({
    r: rTOTAL2,
    c: COL_HOA_HONG.CHENH_TT,
  }) // N

  let rowTongCong = -1
  let rowThue = -1
  let rowDlHuong = -1
  let rowTongThanhToan = -1

  for (let r0 = rTOTAL2 + 1; r0 <= rTOTAL2 + 30; r0++) {
    const vC = (newWs as any)[XLSX.utils.encode_cell({ r: r0, c: 2 })]?.v
    const s = normalize(vC ?? "")
    if (s === normalize("TỔNG CỘNG HOA HỒNG CHI TRẢ TRONG THÁNG"))
      rowTongCong = r0
    if (s === normalize("THUẾ TNCN") || s === normalize("THUẾ TNCN"))
      rowThue = r0
    if (s === normalize("HOA HỒNG DL HƯỞNG")) rowDlHuong = r0
    if (s.startsWith(normalize("TỔNG TIỀN THANH TOÁN"))) rowTongThanhToan = r0
  }

  const setFooterJ = (row0: number, formula: string) => {
    if (row0 === -1) return
    setFormulaKeepStyle(newWs, row0, FOOTER_COL0, formula, NUM_PARENS_FMT)
    ensureRefIncludes(newWs, row0, FOOTER_COL0)
  }

  // 1) Tổng cộng = L(CỘNG)
  setFooterJ(rowTongCong, `=${addrL_Total}`)

  // 2) Thuế = J(Tổng cộng) * 10%
  if (rowTongCong !== -1 && rowThue !== -1) {
    const aTongJ = XLSX.utils.encode_cell({ r: rowTongCong, c: FOOTER_COL0 })
    setFooterJ(rowThue, `=${aTongJ}*10%`)
  }

  // 3) DL hưởng = Tổng cộng - Thuế
  if (rowTongCong !== -1 && rowThue !== -1 && rowDlHuong !== -1) {
    const aTongJ = XLSX.utils.encode_cell({ r: rowTongCong, c: FOOTER_COL0 })
    const aThueJ = XLSX.utils.encode_cell({ r: rowThue, c: FOOTER_COL0 })
    setFooterJ(rowDlHuong, `=${aTongJ}-${aThueJ}`)
  }

  // 4) Tổng thanh toán = F(CỘNG) - N(CỘNG) - DL hưởng
  if (rowTongThanhToan !== -1 && rowDlHuong !== -1) {
    const aDlJ = XLSX.utils.encode_cell({ r: rowDlHuong, c: FOOTER_COL0 })
    setFooterJ(rowTongThanhToan, `=${addrF_Total}-${addrN_Total}-${aDlJ}`)
  }

  // highlight J dưới dòng CỘNG
  {
    const col0 = FOOTER_COL0
    const startRow0 = rTOTAL2 + 1
    const endRow0 = rTOTAL2 + 4
    for (let r0 = startRow0; r0 <= endRow0; r0++) {
      patchCellStyle(newWs, r0, col0, {
        fill: YELLOW_BG,
        alignment: { horizontal: "right", vertical: "center" },
      })
    }
    ensureRefIncludes(newWs, endRow0, col0)
  }

  /* ===============================
     Normalize style: border/fill/align
  =============================== */

  {
    const headerRow0 = rA2 - 1
    const tableTop0 = Math.max(0, headerRow0)
    const tableBot0 = rTOTAL2
    const cStart0 = 0
    const cEnd0 = maxCol

    applyInnerThinBorders(newWs, tableTop0, tableBot0, cStart0, cEnd0)
    applyOuterThickBorder(newWs, tableTop0, tableBot0, cStart0, cEnd0)

    for (let r0 = tableTop0; r0 <= tableBot0; r0++) {
      applyAlignRowWithLeftTen(newWs, r0, cStart0, cEnd0, COL_HOA_HONG.TEN)
    }

    applyFillRow(newWs, headerRow0, cStart0, cEnd0, BLUE_LIGHT)
    setRowFont(newWs, headerRow0, cStart0, cEnd0, { bold: true })
    ;[rA2, rB2, rC2, rD2, rE2, rF2, rG2, rTOTAL2].forEach((r0) => {
      applyFillRow(newWs, r0, cStart0, cEnd0, BLUE_LIGHT)
      setRowFont(newWs, r0, cStart0, cEnd0, { bold: true })
    })
    ;[rA2, rB2, rC2, rD2, rE2, rF2, rG2].forEach((r0) => {
      applyFillRow(newWs, r0, cStart0, cEnd0, BLUE_DARK)
      setRowFont(newWs, r0, cStart0, cEnd0, { bold: true })
      mergeCells(newWs, r0, 0, 3)
      patchCellStyle(newWs, r0, COL_HOA_HONG.STT, {
        alignment: { horizontal: "left", vertical: "center", wrapText: false },
      })
    })

    setRowFont(newWs, rTOTAL2, cStart0, cEnd0, RED_FONT)
  }
  // ✅ Format số có dấu phẩy cho cả bảng
  {
    const rng = XLSX.utils.decode_range(newWs["!ref"] || "A1")
    const rStart0 = 0
    const rEnd0 = rng.e.r

    const moneyCols = [
      COL_HOA_HONG.TIEN,
      COL_HOA_HONG.GIAPP,
      COL_HOA_HONG.CHENH,
      COL_HOA_HONG.DOANHTHUKHAC,
      COL_HOA_HONG.PHI_TRA,
      COL_HOA_HONG.HOA_HONG,
      COL_HOA_HONG.MI_THU,
      COL_HOA_HONG.CHENH_TT,
    ]

    const intCols = [COL_HOA_HONG.STT, COL_HOA_HONG.SL]

    for (let r0 = rStart0; r0 <= rEnd0; r0++) {
      // Date (B)
      {
        const addr = XLSX.utils.encode_cell({ r: r0, c: COL_HOA_HONG.NGAY })
        const cell: any = (newWs as any)[addr]
        if (cell) cell.z = "dd/mm/yyyy"
      }

      // // Percent (J)
      // {
      //   const addr = XLSX.utils.encode_cell({
      //     r: r0,
      //     c: COL_HOA_HONG.HH_PERCENT,
      //   })
      //   const cell: any = (newWs as any)[addr]
      //   if (cell) cell.z = "0%"
      // }

      // Integer cols (STT, SL)
      for (const c0 of intCols) {
        const addr = XLSX.utils.encode_cell({ r: r0, c: c0 })
        const cell: any = (newWs as any)[addr]
        if (cell) cell.z = "0"
      }

      // Money cols => có dấu phẩy
      for (const c0 of moneyCols) {
        const addr = XLSX.utils.encode_cell({ r: r0, c: c0 })
        const cell: any = (newWs as any)[addr]
        if (!cell) continue

        // nếu cell là text số (ví dụ "670000") thì ép về number để format ăn
        if (cell.t !== "n" && cell.v != null && cell.v !== "") {
          const n = Number(String(cell.v).replace(/,/g, "").trim())
          if (!Number.isNaN(n)) {
            cell.t = "n"
            cell.v = n
          }
        }

        cell.z = "#,##0"
      }
    }
  }
  // ✅ BOLD toàn bộ block footer + chữ ký (không thêm helper)
  {
    const cStart0 = 0
    const cEnd0 = maxCol

    // start: từ "TỔNG CỘNG HOA HỒNG..." nếu có, không thì từ ngay dưới dòng CỘNG
    const startFooter0 = rowTongCong !== -1 ? rowTongCong : rTOTAL2 + 1

    // end: tìm các dòng chữ ký / người lập bảng / tên… rồi lấy dòng lớn nhất
    const candidates = [
      findRowContains(newWs, "Giám đốc kinh doanh", {
        scanRows: 5000,
        scanCols: 20,
      }),
      findRowContains(newWs, "Người lập bảng", {
        scanRows: 5000,
        scanCols: 20,
      }),
      findRowContains(newWs, "NGUYỄN TRỌNG ĐỨC", {
        scanRows: 8000,
        scanCols: 20,
      }),
      findRowContains(newWs, "ONG NGỌC BÍCH", { scanRows: 8000, scanCols: 20 }),
    ].filter((x) => x !== -1)

    const endFooter0 = candidates.length
      ? Math.max(...candidates)
      : startFooter0 + 15

    for (let r0 = startFooter0; r0 <= endFooter0; r0++) {
      setRowFont(newWs, r0, cStart0, cEnd0, { bold: true })
    }

    ensureRefIncludes(newWs, endFooter0, cEnd0)
  }

  ensureRefIncludes(newWs, Math.max(lastFilledRow0, rTOTAL2), maxCol)

  /* ===============================
     Output workbook + logo + download
  =============================== */

  const outWb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(outWb, newWs, realName)

  const timestamp = now.toISOString().slice(0, 10).replace(/-/g, "")
  const safeDealer = String(filter.dealerName)
    .replace(/[\\/:*?"<>|]+/g, "-")
    .trim()
  const fileName = `CHI-HOA-HONG-${safeDealer}-${timestamp}.xlsx`

  const xlsxBuf = XLSX.write(outWb, {
    bookType: "xlsx",
    type: "array",
  }) as ArrayBuffer
  const logoBase64 = await fetchPngAsBase64("/images/logo_minvoice.png")
  const finalBuf = await addLogoToA1ExcelJS(xlsxBuf, realName, logoBase64)

  downloadArrayBuffer(finalBuf, fileName)
}
