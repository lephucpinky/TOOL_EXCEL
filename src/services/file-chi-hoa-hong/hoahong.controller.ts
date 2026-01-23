import * as XLSX from "xlsx-js-style"
import type { ExcelRow } from "@/utils/excel" // hoặc "../utils/excel"
import {
  ensureRefIncludes,
  insertRows,
  normalize,
  setCell,
  unmergeInRange,
} from "@/utils/excel" // chỉnh path theo project bạn
import {
  addrRC,
  applyFillRow,
  applyInnerThinBorders,
  applyOuterThickBorder,
  clearDataKeepStyle,
  copyRowStyleBlock,
  findRowContains,
  findTitleRowA,
  mergeCells,
  patchCellStyle,
  setFormulaKeepStyle,
  setRowFont,
  setTextKeepStyle,
  setColumnWidthsHoaHong,
} from "./hoahong.excel"
import {
  BLUE_DARK,
  BLUE_LIGHT,
  COL_HOA_HONG,
  NUM_PARENS_FMT,
  RED_FONT,
  YELLOW_BG,
} from "@/constants/Mauhoahong"

/* -------------------------------
   headers index
-------------------------------- */

export const buildSalesIndex = (salesHeaders: string[]) => {
  const headers = Array.isArray(salesHeaders)
    ? salesHeaders.filter(Boolean)
    : []
  const idx = new Map<string, string>()
  headers.forEach((h) => {
    const k = normalize(h)
    if (k && !idx.has(k)) idx.set(k, h)
  })
  return idx
}

export const pickHeaderFromIndex = (
  idx: Map<string, string>,
  ...aliases: string[]
) => {
  for (const a of aliases) {
    const h = idx.get(normalize(a))
    if (h) return h
  }
  return ""
}

/* -------------------------------
   classify section
-------------------------------- */

export const classifyProductToSectionHoaHong = (
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

/* -------------------------------
   template row positions
-------------------------------- */

export const resolveTemplateRows = (ws: XLSX.WorkSheet) => {
  const rA = findTitleRowA(ws, "A. GIÁ TRỊ HÓA ĐƠN ĐIỆN TỬ", {
    startsWith: true,
  })
  const rB = findTitleRowA(ws, "B. MÁY TÍNH TIỀN", { startsWith: true })
  const rC = findTitleRowA(ws, "C. CHỨNG TỪ KHẤU TRỪ THUẾ TNCN", {
    startsWith: true,
  })
  const rD = findTitleRowA(ws, "D. BHXH", { startsWith: true })
  const rE = findTitleRowA(ws, "E. QUẢN LÝ HÓA ĐƠN SMI", { startsWith: true })
  const rF = findTitleRowA(ws, "F. PM BÁN HÀNG", { startsWith: true })
  const rG = findTitleRowA(ws, "G. GIÁ TRỊ CHỮ KÝ SỐ", { startsWith: true })
  const rTOTAL = findTitleRowA(ws, "CỘNG", { startsWith: false })

  if ([rA, rB, rC, rD, rE, rF, rG, rTOTAL].some((x) => x === -1)) {
    throw new Error(
      "❌ Không tìm thấy đủ khu A..G hoặc dòng CỘNG trong template HOA HỒNG."
    )
  }

  return { rA, rB, rC, rD, rE, rF, rG, rTOTAL }
}

/* -------------------------------
   header dealer + month
-------------------------------- */

export const applyHeaderDealerMonth = (
  ws: XLSX.WorkSheet,
  dealerName: string,
  month?: string
) => {
  const rTITLE = findRowContains(ws, "BẢNG ĐỐI SOÁT ĐẠI LÝ")
  const rMONTH = findRowContains(ws, "THÁNG")

  const now = new Date()
  const fallbackMonth = `${String(now.getMonth() + 1).padStart(2, "0")}/${now.getFullYear()}`
  const monthText = month || fallbackMonth
  const VALUE_COL = 5 // F

  if (rTITLE !== -1) setTextKeepStyle(ws, rTITLE, VALUE_COL, dealerName)
  if (rMONTH !== -1) setTextKeepStyle(ws, rMONTH, VALUE_COL, monthText)
  ;[rTITLE, rMONTH].forEach((r0) => {
    if (r0 === -1) return
    ;[4, 5].forEach((c0) => {
      patchCellStyle(ws, r0, c0, {
        font: { bold: true },
        alignment: { horizontal: "left", vertical: "center", wrapText: false },
      })
    })
  })
}

/* -------------------------------
   ensure space bottom-up
-------------------------------- */

export const ensureAllSectionsHaveSpace = (
  ws: XLSX.WorkSheet,
  rows: ReturnType<typeof resolveTemplateRows>,
  filteredRows: ExcelRow[],
  H_LOAI: string
) => {
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
    const sec = classifyProductToSectionHoaHong((row as any)[H_LOAI])
    if (sec) group[sec].push(row)
  })

  const maxCol = COL_HOA_HONG.GHICHU

  const ensureSpace = (
    sec: keyof typeof group,
    titleLabel: string,
    boundaryLabel: string,
    boundaryExact = false
  ) => {
    const titleRow = findTitleRowA(ws, titleLabel, { startsWith: true })
    const boundaryRow = findTitleRowA(ws, boundaryLabel, {
      startsWith: boundaryExact ? false : true,
    })
    if (titleRow === -1 || boundaryRow === -1) return

    const start = titleRow + 1
    const placeholder = Math.max(0, boundaryRow - start)
    const needInsert = Math.max(0, group[sec].length - placeholder)
    if (needInsert <= 0) return

    insertRows(ws, boundaryRow, needInsert)

    const srcStyleRow0 = Math.max(titleRow + 1, boundaryRow - 1)
    copyRowStyleBlock(ws, srcStyleRow0, boundaryRow, needInsert, 0, maxCol)
  }

  // bottom-up like VACOM
  ensureSpace("G", "G. GIÁ TRỊ CHỮ KÝ SỐ", "CỘNG", true)
  ensureSpace("F", "F. PM BÁN HÀNG", "G. GIÁ TRỊ CHỮ KÝ SỐ")
  ensureSpace("E", "E. QUẢN LÝ HÓA ĐƠN SMI", "F. PM BÁN HÀNG")
  ensureSpace("D", "D. BHXH", "E. QUẢN LÝ HÓA ĐƠN SMI")
  ensureSpace("C", "C. CHỨNG TỪ KHẤU TRỪ THUẾ TNCN", "D. BHXH")
  ensureSpace("B", "B. MÁY TÍNH TIỀN", "C. CHỨNG TỪ KHẤU TRỪ THUẾ TNCN")
  ensureSpace("A", "A. GIÁ TRỊ HÓA ĐƠN ĐIỆN TỬ", "B. MÁY TÍNH TIỀN")

  return group
}

/* -------------------------------
   clear blocks
-------------------------------- */

export const clearAllSectionBlocks = (
  ws: XLSX.WorkSheet,
  rows: ReturnType<typeof resolveTemplateRows>
) => {
  // re-find after insert
  const rr = resolveTemplateRows(ws)
  Object.assign(rows, rr)

  const maxCol = COL_HOA_HONG.GHICHU

  const isNumericCol = (c0: number) =>
    (c0 >= COL_HOA_HONG.SL && c0 <= COL_HOA_HONG.CHENH_TT) ||
    c0 === COL_HOA_HONG.HH_PERCENT

  const clearBlock = (startRow0: number, endRow0: number) => {
    if (endRow0 < startRow0) return
    clearDataKeepStyle(ws, startRow0, endRow0, 0, maxCol, isNumericCol)
    unmergeInRange(ws, startRow0, endRow0)
  }

  clearBlock(rows.rA + 1, rows.rB - 1)
  clearBlock(rows.rB + 1, rows.rC - 1)
  clearBlock(rows.rC + 1, rows.rD - 1)
  clearBlock(rows.rD + 1, rows.rE - 1)
  clearBlock(rows.rE + 1, rows.rF - 1)
  clearBlock(rows.rF + 1, rows.rG - 1)
  clearBlock(rows.rG + 1, rows.rTOTAL - 1)
}

/* -------------------------------
   fill data
-------------------------------- */

export const fillAllSections = (
  ws: XLSX.WorkSheet,
  rows: ReturnType<typeof resolveTemplateRows>,
  group: Record<"A" | "B" | "C" | "D" | "E" | "F" | "G", ExcelRow[]>,
  H: any,
  COL: any
) => {
  const start = {
    A: rows.rA + 1,
    B: rows.rB + 1,
    C: rows.rC + 1,
    D: rows.rD + 1,
    E: rows.rE + 1,
    F: rows.rF + 1,
    G: rows.rG + 1,
  } as const

  const fillSection = (sec: keyof typeof group) => {
    const rowsData = group[sec]
    for (let i = 0; i < rowsData.length; i++) {
      const r0 = start[sec] + i
      const row = rowsData[i]

      setCell(ws, r0, COL_HOA_HONG.STT, i + 1, { kind: "stt", force: true })
      setCell(ws, r0, COL_HOA_HONG.NGAY, row[H.NGAY], {
        kind: "date",
        force: true,
      })
      setCell(ws, r0, COL_HOA_HONG.MST, row[H.MST], {
        kind: "text",
        force: true,
      })
      setCell(ws, r0, COL_HOA_HONG.TEN, row[H.TEN], {
        kind: "text",
        force: true,
      })

      setCell(ws, r0, COL_HOA_HONG.SL, row[H.SL], {
        kind: "number0",
        force: true,
      })
      setCell(ws, r0, COL_HOA_HONG.TIEN, row[H.TIEN], {
        kind: "number0",
        force: true,
      })
      setCell(ws, r0, COL_HOA_HONG.GIAPP, row[H.GIAPP], {
        kind: "number0",
        force: true,
      })
      setCell(ws, r0, COL_HOA_HONG.CHENH, row[H.CHENH], {
        kind: "number0",
        force: true,
      })
      setCell(ws, r0, COL_HOA_HONG.DOANHTHUKHAC, row[H.DTK], {
        kind: "number0",
        force: true,
      })

      setCell(ws, r0, COL_HOA_HONG.HH_PERCENT, row[H.HH_PERCENT], {
        kind: "percent",
        force: true,
      })
      setCell(ws, r0, COL_HOA_HONG.PHI_TRA, row[H.PHI_TRA], {
        kind: "number0",
        force: true,
      })
      setCell(ws, r0, COL_HOA_HONG.HOA_HONG, row[H.HOA_HONG], {
        kind: "number0",
        force: true,
      })
      setCell(ws, r0, COL_HOA_HONG.MI_THU, row[H.MI_THU], {
        kind: "number0",
        force: true,
      })
      setCell(ws, r0, COL_HOA_HONG.CHENH_TT, row[H.CHENH_TT], {
        kind: "number0",
        force: true,
      })

      setCell(ws, r0, COL_HOA_HONG.GHICHU, H.GHICHU ? row[H.GHICHU] : "", {
        kind: "text",
        force: true,
      })
    }
  }

  ;(["A", "B", "C", "D", "E", "F", "G"] as const).forEach(fillSection)
}

/* -------------------------------
   sums
-------------------------------- */

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
    const addr = addrRC(titleRow0, c0)
    const keepS = (ws as any)[addr]?.s
    ;(ws as any)[addr] = { t: "n", f: mkSum(c0), s: keepS }
  })

  // % + ghi chú
  ;(ws as any)[addrRC(titleRow0, COL_HOA_HONG.HH_PERCENT)] = {
    t: "n",
    v: 0,
    z: "0%",
    s: (ws as any)[addrRC(titleRow0, COL_HOA_HONG.HH_PERCENT)]?.s,
  }
  ;(ws as any)[addrRC(titleRow0, COL_HOA_HONG.GHICHU)] = {
    t: "s",
    v: "",
    s: (ws as any)[addrRC(titleRow0, COL_HOA_HONG.GHICHU)]?.s,
  }

  ensureRefIncludes(ws, titleRow0, COL_HOA_HONG.GHICHU)
}

export const applyAllSectionSums = (
  ws: XLSX.WorkSheet,
  rows: ReturnType<typeof resolveTemplateRows>,
  group: Record<"A" | "B" | "C" | "D" | "E" | "F" | "G", ExcelRow[]>
) => {
  const start = {
    A: rows.rA + 1,
    B: rows.rB + 1,
    C: rows.rC + 1,
    D: rows.rD + 1,
    E: rows.rE + 1,
    F: rows.rF + 1,
    G: rows.rG + 1,
  } as const

  const end = {
    A: start.A + group.A.length - 1,
    B: start.B + group.B.length - 1,
    C: start.C + group.C.length - 1,
    D: start.D + group.D.length - 1,
    E: start.E + group.E.length - 1,
    F: start.F + group.F.length - 1,
    G: start.G + group.G.length - 1,
  } as const

  setSectionSumRow(ws, rows.rA, start.A, end.A)
  setSectionSumRow(ws, rows.rB, start.B, end.B)
  setSectionSumRow(ws, rows.rC, start.C, end.C)
  setSectionSumRow(ws, rows.rD, start.D, end.D)
  setSectionSumRow(ws, rows.rE, start.E, end.E)
  setSectionSumRow(ws, rows.rF, start.F, end.F)
  setSectionSumRow(ws, rows.rG, start.G, end.G)
}

export const applyGrandTotal = (
  ws: XLSX.WorkSheet,
  rows: ReturnType<typeof resolveTemplateRows>
) => {
  const titleRows0 = [
    rows.rA,
    rows.rB,
    rows.rC,
    rows.rD,
    rows.rE,
    rows.rF,
    rows.rG,
  ]
  const mk = (c0: number) => {
    const col = XLSX.utils.encode_col(c0)
    return titleRows0.map((r0) => `${col}${r0 + 1}`).join("+")
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
    const addr = addrRC(rows.rTOTAL, c0)
    const keepS = (ws as any)[addr]?.s
    ;(ws as any)[addr] = { t: "n", f: mk(c0), s: keepS }
  })
}

/* -------------------------------
   footer formulas + highlight
-------------------------------- */

export const applyFooterFormulasAndHighlight = (
  ws: XLSX.WorkSheet,
  rTOTAL: number
) => {
  const FOOTER_COL0 = COL_HOA_HONG.HH_PERCENT // J
  const addrL_Total = addrRC(rTOTAL, COL_HOA_HONG.HOA_HONG)
  const addrF_Total = addrRC(rTOTAL, COL_HOA_HONG.TIEN)
  const addrN_Total = addrRC(rTOTAL, COL_HOA_HONG.CHENH_TT)

  let rowTongCong = -1
  let rowThue = -1
  let rowDlHuong = -1
  let rowTongThanhToan = -1

  for (let r0 = rTOTAL + 1; r0 <= rTOTAL + 30; r0++) {
    const vC = (ws as any)[addrRC(r0, 2)]?.v
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
    setFormulaKeepStyle(ws, row0, FOOTER_COL0, formula, NUM_PARENS_FMT)
  }

  setFooterJ(rowTongCong, `=${addrL_Total}`)
  if (rowTongCong !== -1 && rowThue !== -1) {
    setFooterJ(rowThue, `=${addrRC(rowTongCong, FOOTER_COL0)}*10%`)
  }
  if (rowTongCong !== -1 && rowThue !== -1 && rowDlHuong !== -1) {
    setFooterJ(
      rowDlHuong,
      `=${addrRC(rowTongCong, FOOTER_COL0)}-${addrRC(rowThue, FOOTER_COL0)}`
    )
  }
  if (rowTongThanhToan !== -1 && rowDlHuong !== -1) {
    setFooterJ(
      rowTongThanhToan,
      `=${addrF_Total}-${addrN_Total}-${addrRC(rowDlHuong, FOOTER_COL0)}`
    )
  }

  // highlight yellow
  for (let r0 = rTOTAL + 1; r0 <= rTOTAL + 4; r0++) {
    patchCellStyle(ws, r0, FOOTER_COL0, {
      fill: YELLOW_BG,
      alignment: { horizontal: "right", vertical: "center" },
    })
  }

  return { rowTongCong }
}

/* -------------------------------
   style table
-------------------------------- */

export const normalizeAndBeautifyTable = (
  ws: XLSX.WorkSheet,
  rows: ReturnType<typeof resolveTemplateRows>
) => {
  const maxCol = COL_HOA_HONG.GHICHU
  const headerRow0 = rows.rA - 1
  const top0 = Math.max(0, headerRow0)
  const bot0 = rows.rTOTAL

  applyInnerThinBorders(ws, top0, bot0, 0, maxCol)
  applyOuterThickBorder(ws, top0, bot0, 0, maxCol)

  // header
  applyFillRow(ws, headerRow0, 0, maxCol, BLUE_LIGHT)
  setRowFont(ws, headerRow0, 0, maxCol, { bold: true })

  // titles
  ;[
    rows.rA,
    rows.rB,
    rows.rC,
    rows.rD,
    rows.rE,
    rows.rF,
    rows.rG,
    rows.rTOTAL,
  ].forEach((r0) => {
    applyFillRow(ws, r0, 0, maxCol, BLUE_LIGHT)
    setRowFont(ws, r0, 0, maxCol, { bold: true })
  })
  ;[rows.rA, rows.rB, rows.rC, rows.rD, rows.rE, rows.rF, rows.rG].forEach(
    (r0) => {
      applyFillRow(ws, r0, 0, maxCol, BLUE_DARK)
      setRowFont(ws, r0, 0, maxCol, { bold: true })
      mergeCells(ws, r0, 0, 3)
      patchCellStyle(ws, r0, COL_HOA_HONG.STT, {
        alignment: { horizontal: "left", vertical: "center", wrapText: false },
      })
    }
  )

  // total red
  setRowFont(ws, rows.rTOTAL, 0, maxCol, RED_FONT)
}

export const formatAllNumbers = (ws: XLSX.WorkSheet) => {
  const rng = XLSX.utils.decode_range(ws["!ref"] || "A1")
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

  for (let r0 = 0; r0 <= rEnd0; r0++) {
    const dateCell: any = (ws as any)[addrRC(r0, COL_HOA_HONG.NGAY)]
    if (dateCell) dateCell.z = "dd/mm/yyyy"

    for (const c0 of intCols) {
      const cell: any = (ws as any)[addrRC(r0, c0)]
      if (cell) cell.z = "0"
    }

    for (const c0 of moneyCols) {
      const cell: any = (ws as any)[addrRC(r0, c0)]
      if (!cell) continue
      if (cell.t !== "n" && cell.v != null && cell.v !== "") {
        const n = Number(String(cell.v).replace(/,/g, "").trim())
        if (!Number.isNaN(n)) {
          cell.t = "n"
          cell.v = n
        }
      }
      cell.z = "#,##0;(#,##0)"
    }
  }
}

export const boldFooterBlock = (
  ws: XLSX.WorkSheet,
  rTOTAL: number,
  rowTongCong: number
) => {
  const maxCol = COL_HOA_HONG.GHICHU
  const startFooter0 = rowTongCong !== -1 ? rowTongCong : rTOTAL + 1

  const candidates = [
    findRowContains(ws, "Giám đốc kinh doanh", {
      scanRows: 5000,
      scanCols: 20,
    }),
    findRowContains(ws, "Người lập bảng", { scanRows: 5000, scanCols: 20 }),
    findRowContains(ws, "NGUYỄN TRỌNG ĐỨC", { scanRows: 8000, scanCols: 20 }),
    findRowContains(ws, "ONG NGỌC BÍCH", { scanRows: 8000, scanCols: 20 }),
  ].filter((x) => x !== -1)

  const endFooter0 = candidates.length
    ? Math.max(...candidates)
    : startFooter0 + 15

  for (let r0 = startFooter0; r0 <= endFooter0; r0++) {
    setRowFont(ws, r0, 0, maxCol, { bold: true })
  }
  // ✅ CĂN GIỮA các dòng như trong hình
  const centerCellContains = (row0: number, text: string) => {
    const target = normalize(text)
    for (let c0 = 0; c0 <= maxCol; c0++) {
      const v = (ws as any)[addrRC(row0, c0)]?.v
      if (normalize(v ?? "") === target) {
        patchCellStyle(ws, row0, c0, {
          alignment: {
            horizontal: "center",
            vertical: "center",
            wrapText: false,
          },
        })
        break
      }
    }
  }

  const toCenter = [
    "Giám đốc kinh doanh",
    "Người lập bảng",
    "NGUYỄN TRỌNG ĐỨC",
    "ONG NGỌC BÍCH",
  ]

  for (const t of toCenter) {
    const r0 = findRowContains(ws, t, { scanRows: 9000, scanCols: 40 })
    if (r0 !== -1) centerCellContains(r0, t)
  }

  ensureRefIncludes(ws, endFooter0, maxCol)
}

// re-export widths helper
export { setColumnWidthsHoaHong }
