import * as XLSX from "xlsx-js-style"
import { normalize, ensureRefIncludes } from "@/utils/excel"
import {
  BLUE_LIGHT,
  COL_HOA_HONG,
  NUM_PARENS_FMT,
  RED_FONT,
  YELLOW_BG,
} from "@/constants/Mauhoahong"
import {
  addrRC,
  applyFillRow,
  applyInnerThinBorders,
  applyOuterThickBorder,
  findRowContains,
  mergeCells,
  patchCellStyle,
  setFormulaKeepStyle,
  setRowFont,
  setTextKeepStyle,
  setFontAll,
  ensureCell,
} from "./hoahong.excel"
// ✅ helper set row height (hpt)
const setRowHeight = (ws: XLSX.WorkSheet, r0: number, hpt: number) => {
  const rows = (((ws as any)["!rows"] || []) as any[]).slice()
  rows[r0] = { ...(rows[r0] || {}), hpt }
  ;(ws as any)["!rows"] = rows
}

const setRowHeightRange = (
  ws: XLSX.WorkSheet,
  rStart0: number,
  rEnd0: number,
  hpt: number
) => {
  if (rEnd0 < rStart0) return
  const rows = (((ws as any)["!rows"] || []) as any[]).slice()
  for (let r0 = rStart0; r0 <= rEnd0; r0++) {
    rows[r0] = { ...(rows[r0] || {}), hpt }
  }
  ;(ws as any)["!rows"] = rows
}

/** header dealer + month */
export const applyHeaderDealerMonth = (
  ws: XLSX.WorkSheet,
  dealerName: string,
  month?: string
) => {
  const rTITLE = findRowContains(ws, "BẢNG ĐỐI SOÁT ĐẠI LÝ", {
    scanRows: 5000,
    scanCols: 50,
  })
  const rMONTH = findRowContains(ws, "THÁNG", { scanRows: 5000, scanCols: 50 })

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

/** footer formulas + yellow highlight */
export const applyFooterFormulasAndHighlight = (
  ws: XLSX.WorkSheet,
  rTOTAL: number,
  opts?: { isTncnExempt?: boolean }
) => {
  const isTncnExempt = !!opts?.isTncnExempt
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
  // ✅ THUẾ TNCN: nếu đại lý miễn => 0
  if (rowTongCong !== -1 && rowThue !== -1) {
    setFooterJ(
      rowThue,
      isTncnExempt ? `=0` : `=${addrRC(rowTongCong, FOOTER_COL0)}*10%`
    )
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
  if (rowTongThanhToan !== -1) {
    // ✅ Merge label từ C đến I
    mergeCells(ws, rowTongThanhToan, 2, 8)

    // ✅ Set đúng full text (giữ style)
    setTextKeepStyle(
      ws,
      rowTongThanhToan,
      2,
      "TỔNG TIỀN THANH TOÁN (Số tiền âm là Minvoice chi, Số dương là Minvoice thu)"
    )

    // ✅ Canh trái cho dễ đọc (tuỳ bạn có thể bỏ nếu đang OK)
    patchCellStyle(ws, rowTongThanhToan, 2, {
      alignment: { horizontal: "left", vertical: "center", wrapText: false },
    })
  }

  // highlight yellow (block 4 dòng sau TOTAL)
  for (let r0 = rTOTAL + 1; r0 <= rTOTAL + 4; r0++) {
    patchCellStyle(ws, r0, FOOTER_COL0, {
      fill: YELLOW_BG,
      alignment: { horizontal: "right", vertical: "center", wrapText: false },
    })
  }

  return { rowTongCong }
}
export const setAlignmentRange = (
  ws: XLSX.WorkSheet,
  rStart0: number,
  rEnd0: number,
  cStart0: number,
  cEnd0: number,
  align: {
    horizontal?: "left" | "center" | "right"
    vertical?: "top" | "center" | "bottom"
    wrapText?: boolean
  }
) => {
  for (let r0 = rStart0; r0 <= rEnd0; r0++) {
    for (let c0 = cStart0; c0 <= cEnd0; c0++) {
      patchCellStyle(ws, r0, c0, {
        alignment: {
          ...(ensureCell(ws, r0, c0).s?.alignment || {}),
          vertical: align.vertical ?? "center",
          horizontal: align.horizontal ?? "center",
          wrapText: align.wrapText ?? false,
        },
      })
    }
  }
}

export const getTopLeftOfMerge = (
  ws: XLSX.WorkSheet,
  r0: number,
  c0: number
) => {
  const merges = ((ws as any)["!merges"] || []) as XLSX.Range[]
  for (const m of merges) {
    if (r0 >= m.s.r && r0 <= m.e.r && c0 >= m.s.c && c0 <= m.e.c) {
      return { r: m.s.r, c: m.s.c }
    }
  }
  return { r: r0, c: c0 }
}

export const setAlignmentCellMergeAware = (
  ws: XLSX.WorkSheet,
  r0: number,
  c0: number,
  alignment: any
) => {
  const tl = getTopLeftOfMerge(ws, r0, c0)
  const addr = XLSX.utils.encode_cell({ r: tl.r, c: tl.c })
  const cell: any = (ws as any)[addr] || ((ws as any)[addr] = { t: "s", v: "" })
  cell.s = cell.s || {}
  cell.s.alignment = { ...(cell.s.alignment || {}), ...alignment }
}

export const setColAlignmentMergeAware = (
  ws: XLSX.WorkSheet,
  rStart0: number,
  rEnd0: number,
  c0: number,
  alignment: any
) => {
  for (let r = rStart0; r <= rEnd0; r++) {
    // chỉ set nếu trong row đó có cell tồn tại (giảm tạo cell rác)
    const addr = XLSX.utils.encode_cell({ r, c: c0 })
    if (!(ws as any)[addr]) continue
    setAlignmentCellMergeAware(ws, r, c0, alignment)
  }
}

/** style bảng: border + fills + title merge + left title */
export const applyHoaHongTableStyle = (
  ws: XLSX.WorkSheet,
  rows: {
    rA: number
    rB: number
    rC: number
    rD: number
    rE: number
    rF: number
    rG: number
    rTOTAL: number
  }
) => {
  const maxCol = COL_HOA_HONG.GHICHU
  const headerRow0 = rows.rA - 1
  const top0 = Math.max(0, headerRow0)
  const bot0 = rows.rTOTAL
  setAlignmentRange(ws, top0, bot0, 0, maxCol, {
    horizontal: "center",
    vertical: "center",
    wrapText: false,
  })

  // ✅ sau khi đã apply style/border/fill/merge xong hết
  setColAlignmentMergeAware(ws, top0, bot0, COL_HOA_HONG.TEN, {
    horizontal: "left",
    vertical: "center",
    wrapText: false,
  })

  setRowHeight(ws, headerRow0, 40)

  // ✅ font all Times New Roman
  setFontAll(ws, "Times New Roman")

  // borders full table
  applyInnerThinBorders(ws, top0, bot0, 0, maxCol)
  applyOuterThickBorder(ws, top0, bot0, 0, maxCol)

  // header
  applyFillRow(ws, headerRow0, 0, maxCol, BLUE_LIGHT)
  setRowFont(ws, headerRow0, 0, maxCol, { bold: true })

  // titles A..G + TOTAL
  const titleRows = [
    rows.rA,
    rows.rB,
    rows.rC,
    rows.rD,
    rows.rE,
    rows.rF,
    rows.rG,
    rows.rTOTAL,
  ]
  titleRows.forEach((r0) => {
    applyFillRow(ws, r0, 0, maxCol, BLUE_LIGHT)
    setRowFont(ws, r0, 0, maxCol, { bold: true })
  })
  // data block: từ sau header tới trước TOTAL
  setRowHeightRange(ws, headerRow0 + 1, bot0 - 1, 28)

  // total row cao hơn chút
  setRowHeight(ws, rows.rTOTAL, 32)

  // A..G: nền xanh đậm, merge A..D (0..3), và text LEFT (giống VACOM yêu cầu)
  ;[rows.rA, rows.rB, rows.rC, rows.rD, rows.rE, rows.rF, rows.rG].forEach(
    (r0) => {
      applyFillRow(ws, r0, 0, maxCol, BLUE_LIGHT)
      setRowFont(ws, r0, 0, maxCol, { bold: true })

      mergeCells(ws, r0, 0, 3)
      patchCellStyle(ws, r0, 0, {
        alignment: { horizontal: "left", vertical: "center", wrapText: false },
      })
    }
  )

  // total red font
  setRowFont(ws, rows.rTOTAL, 0, maxCol, RED_FONT)
}

/** format number columns */
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

/** bold footer block + center signatures */
export const boldFooterBlock = (
  ws: XLSX.WorkSheet,
  rTOTAL: number,
  rowTongCong: number
) => {
  const maxCol = COL_HOA_HONG.GHICHU
  const startFooter0 = rowTongCong !== -1 ? rowTongCong : rTOTAL + 1

  const candidates = [
    findRowContains(ws, "Giám đốc kinh doanh", {
      scanRows: 9000,
      scanCols: 40,
    }),
    findRowContains(ws, "Người lập bảng", { scanRows: 9000, scanCols: 40 }),
    findRowContains(ws, "NGUYỄN TRỌNG ĐỨC", { scanRows: 9000, scanCols: 40 }),
    findRowContains(ws, "ONG NGỌC BÍCH", { scanRows: 9000, scanCols: 40 }),
  ].filter((x) => x !== -1)

  const endFooter0 = candidates.length
    ? Math.max(...candidates)
    : startFooter0 + 15

  for (let r0 = startFooter0; r0 <= endFooter0; r0++) {
    setRowFont(ws, r0, 0, maxCol, { bold: true })
  }

  const centerIfExact = (text: string) => {
    const r0 = findRowContains(ws, text, { scanRows: 9000, scanCols: 40 })
    if (r0 === -1) return
    const target = normalize(text)
    for (let c0 = 0; c0 <= maxCol; c0++) {
      const v = (ws as any)[addrRC(r0, c0)]?.v
      if (normalize(v ?? "") === target) {
        patchCellStyle(ws, r0, c0, {
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

  ;[
    "Giám đốc kinh doanh",
    "Người lập bảng",
    "NGUYỄN TRỌNG ĐỨC",
    "ONG NGỌC BÍCH",
  ].forEach(centerIfExact)

  ensureRefIncludes(ws, endFooter0, maxCol)
}
