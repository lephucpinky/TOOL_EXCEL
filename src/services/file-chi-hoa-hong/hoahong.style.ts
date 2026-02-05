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

/* ----------------------------- basic helpers ----------------------------- */

const getRefRange = (ws: XLSX.WorkSheet) => {
  const ref = (ws as any)["!ref"]
  if (!ref) return null
  return XLSX.utils.decode_range(ref)
}

export const setFontSizeAll = (ws: XLSX.WorkSheet, sz: number) => {
  const rng = getRefRange(ws)
  if (!rng) return

  for (let r = rng.s.r; r <= rng.e.r; r++) {
    for (let c = rng.s.c; c <= rng.e.c; c++) {
      const addr = XLSX.utils.encode_cell({ r, c })
      const cell: any = (ws as any)[addr]
      if (!cell) continue
      cell.s = cell.s || {}
      cell.s.font = { ...(cell.s.font || {}), sz }
    }
  }
}

const getRowsArr = (ws: XLSX.WorkSheet) =>
  (((ws as any)["!rows"] || []) as any[]).slice()

const setRowHeightAt = (rows: any[], r0: number, hpt: number) => {
  rows[r0] = { ...(rows[r0] || {}), hpt }
}

const setRowHeightRange = (
  ws: XLSX.WorkSheet,
  rStart0: number,
  rEnd0: number,
  hpt: number
) => {
  if (rEnd0 < rStart0) return
  const rows = getRowsArr(ws)
  for (let r0 = rStart0; r0 <= rEnd0; r0++) setRowHeightAt(rows, r0, hpt)
  ;(ws as any)["!rows"] = rows
}

const setRowHeight = (ws: XLSX.WorkSheet, r0: number, hpt: number) =>
  setRowHeightRange(ws, r0, r0, hpt)

/* ---------------------------- merge-aware align --------------------------- */

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
    // tránh tạo cell rác
    const addr = XLSX.utils.encode_cell({ r, c: c0 })
    if (!(ws as any)[addr]) continue
    setAlignmentCellMergeAware(ws, r, c0, alignment)
  }
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
      const cell = ensureCell(ws, r0, c0)
      patchCellStyle(ws, r0, c0, {
        alignment: {
          ...(cell.s?.alignment || {}),
          vertical: align.vertical ?? "center",
          horizontal: align.horizontal ?? "center",
          wrapText: align.wrapText ?? false,
        },
      })
    }
  }
}

/* -------------------------- header company block -------------------------- */

export const applyTopCompanyHeaderHeight = (ws: XLSX.WorkSheet) => {
  const rCompany = findRowContains(ws, "CÔNG TY", {
    scanRows: 200,
    scanCols: 50,
  })
  if (rCompany === -1) return

  const rStart = rCompany
  const rEnd = rCompany + 2

  setRowHeightRange(ws, rStart, rEnd, 28)

  // patch style cho cell tồn tại để tránh tạo cell rác
  for (let r0 = rStart; r0 <= rEnd; r0++) {
    for (let c0 = 0; c0 <= 20; c0++) {
      const addr = XLSX.utils.encode_cell({ r: r0, c: c0 })
      if (!(ws as any)[addr]) continue
      patchCellStyle(ws, r0, c0, {
        alignment: { vertical: "center", wrapText: false },
        font: { bold: true },
      })
    }
  }
}

/* ----------------------- header dealer + month row ------------------------ */

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

  const COL_F = 5 // F

  const writeLabelValueSameCell = (
    r0: number,
    label: string,
    value: string
  ) => {
    if (r0 === -1) return

    const isMonthRow = normalize(label) === normalize("THÁNG")
    if (isMonthRow) mergeCells(ws, r0, COL_F, 7) // F..H

    const tl = getTopLeftOfMerge(ws, r0, COL_F)
    const addr = XLSX.utils.encode_cell({ r: tl.r, c: tl.c })
    const cell: any =
      (ws as any)[addr] || ((ws as any)[addr] = { t: "s", v: "" })

    const cur = String(cell.v ?? "")
    const curNorm = normalize(cur)
    const labelNorm = normalize(label)

    const next = curNorm.includes(labelNorm)
      ? cur.includes(":")
        ? `${cur.split(":")[0].trim()}: ${value}`
        : `${label}: ${value}`
      : `${label}: ${value}`

    setTextKeepStyle(ws, tl.r, tl.c, next)

    patchCellStyle(ws, tl.r, tl.c, {
      font: { bold: true, sz: 18 },
      alignment: {
        horizontal: isMonthRow ? "center" : "left",
        vertical: "center",
        wrapText: false,
      },
    })

    if (isMonthRow) {
      setAlignmentCellMergeAware(ws, tl.r, tl.c, {
        horizontal: "center",
        vertical: "center",
        wrapText: false,
      })
    }

    setRowHeight(ws, r0, 30)
  }

  writeLabelValueSameCell(rTITLE, "BẢNG ĐỐI SOÁT ĐẠI LÝ", dealerName)
  writeLabelValueSameCell(rMONTH, "THÁNG", monthText)
}

/* --------------------- footer formulas + highlight ------------------------ */

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

  // scan 30 dòng sau TOTAL
  let rowTongCong = -1
  let rowThue = -1
  let rowDlHuong = -1
  let rowTongThanhToan = -1

  const N_TONGCONG = normalize("TỔNG CỘNG HOA HỒNG CHI TRẢ TRONG THÁNG")
  const N_THUE1 = normalize("THUẾ TNCN")
  const N_THUE2 = normalize("THUẾ TNCN")
  const N_DLHUONG = normalize("HOA HỒNG DL HƯỞNG")
  const N_TONGTT = normalize("TỔNG TIỀN THANH TOÁN")

  for (let r0 = rTOTAL + 1; r0 <= rTOTAL + 30; r0++) {
    const vC = (ws as any)[addrRC(r0, 2)]?.v
    const s = normalize(vC ?? "")

    if (s === N_TONGCONG) rowTongCong = r0
    if (s === N_THUE1 || s === N_THUE2) rowThue = r0
    if (s === N_DLHUONG) rowDlHuong = r0
    if (s.startsWith(N_TONGTT)) rowTongThanhToan = r0
  }

  const setFooterJ = (row0: number, formula: string) => {
    if (row0 === -1) return
    setFormulaKeepStyle(ws, row0, FOOTER_COL0, formula, NUM_PARENS_FMT)
  }

  // formulas
  setFooterJ(rowTongCong, `=${addrL_Total}`)

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
      `=${addrN_Total}-${addrRC(rowDlHuong, FOOTER_COL0)}`
    )
  }

  // label row: merge + text
  if (rowTongThanhToan !== -1) {
    mergeCells(ws, rowTongThanhToan, 2, COL_HOA_HONG.HH_PERCENT - 1) // C..I
    setTextKeepStyle(
      ws,
      rowTongThanhToan,
      2,
      "TỔNG TIỀN THANH TOÁN (Số tiền âm là Minvoice chi, Số dương là Minvoice thu)"
    )
    patchCellStyle(ws, rowTongThanhToan, 2, {
      alignment: { horizontal: "left", vertical: "center", wrapText: false },
    })
  }

  // highlight vàng 4 dòng sau TOTAL
  for (let r0 = rTOTAL + 1; r0 <= rTOTAL + 4; r0++) {
    patchCellStyle(ws, r0, FOOTER_COL0, {
      fill: YELLOW_BG,
      alignment: { horizontal: "right", vertical: "center", wrapText: false },
    })
  }

  const alignFooterLabel = (row0: number) => {
    if (row0 === -1) return

    // label bắt đầu ở C (2)
    setAlignmentCellMergeAware(ws, row0, 2, {
      horizontal: "left",
      vertical: "center",
      wrapText: false,
    })

    // set vertical center cho C..I (merge rồi thì TL là đủ, nhưng vẫn ok)
    for (let c0 = 2; c0 <= COL_HOA_HONG.HH_PERCENT - 1; c0++) {
      const addr = XLSX.utils.encode_cell({ r: row0, c: c0 })
      if (!(ws as any)[addr]) continue // tránh tạo cell rác
      setAlignmentCellMergeAware(ws, row0, c0, { vertical: "center" })
    }

    setRowHeight(ws, row0, 35)
  }

  alignFooterLabel(rowTongCong)
  alignFooterLabel(rowThue)
  alignFooterLabel(rowDlHuong)
  alignFooterLabel(rowTongThanhToan)

  return { rowTongCong }
}

/* --------------------------- table style block --------------------------- */

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

  // 1) Base: center toàn bảng (đúng form)
  setAlignmentRange(ws, top0, bot0, 0, maxCol, {
    horizontal: "center",
    vertical: "center",
    wrapText: false,
  })

  // 2) Cột TÊN: left + wrap
  setColAlignmentMergeAware(ws, top0, bot0, COL_HOA_HONG.TEN, {
    horizontal: "left",
    vertical: "center",
    wrapText: true,
  })

  // 3) Header row: center + wrap để xuống dòng nếu hẹp
  setAlignmentRange(ws, headerRow0, headerRow0, 0, maxCol, {
    horizontal: "center",
    vertical: "center",
    wrapText: true,
  })
  setRowHeight(ws, headerRow0, 55)

  // 4) DATA: chỉ canh phải các cột SỐ (từ "SỐ LƯỢNG PHÁT HÀNH" trở đi)
  const dataStart = headerRow0 + 1
  const dataEnd = bot0

  const rightCols: number[] = [
    COL_HOA_HONG.SL, // ✅ SỐ LƯỢNG PHÁT HÀNH
    COL_HOA_HONG.TIEN,
    COL_HOA_HONG.GIAPP,
    COL_HOA_HONG.CHENH,
    COL_HOA_HONG.DOANHTHUKHAC,
    COL_HOA_HONG.PHI_TRA,
    COL_HOA_HONG.HOA_HONG,
    COL_HOA_HONG.MI_THU,
    COL_HOA_HONG.CHENH_TT,
  ]

  for (const c0 of rightCols) {
    setColAlignmentMergeAware(ws, dataStart, dataEnd, c0, {
      horizontal: "right",
      vertical: "center",
      wrapText: false,
    })
  }

  // % hoa hồng: giữ center như Vacom (nếu bạn muốn right thì đổi lại sau)
  setColAlignmentMergeAware(ws, dataStart, dataEnd, COL_HOA_HONG.HH_PERCENT, {
    horizontal: "center",
    vertical: "center",
    wrapText: false,
  })

  // Ghi chú: để center (hoặc muốn left thì đổi sang left)
  setColAlignmentMergeAware(ws, dataStart, dataEnd, COL_HOA_HONG.GHICHU, {
    horizontal: "center",
    vertical: "center",
    wrapText: true,
  })

  setFontAll(ws, "Times New Roman")
  applyTopCompanyHeaderHeight(ws)

  applyInnerThinBorders(ws, top0, bot0, 0, maxCol)
  applyOuterThickBorder(ws, top0, bot0, 0, maxCol)

  const paintTitleRow = (r0: number) => {
    applyFillRow(ws, r0, 0, maxCol, BLUE_LIGHT)
    setRowFont(ws, r0, 0, maxCol, { bold: true })
  }

  // header
  paintTitleRow(headerRow0)

  // title rows
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
  titleRows.forEach(paintTitleRow)

  // data block
  setRowHeightRange(ws, headerRow0 + 1, bot0 - 1, 30)

  // total row
  setRowHeight(ws, rows.rTOTAL, 32)
  setRowFont(ws, rows.rTOTAL, 0, maxCol, RED_FONT)

  // merge A..G title rows (0..3) + align left
  ;[rows.rA, rows.rB, rows.rC, rows.rD, rows.rE, rows.rF, rows.rG].forEach(
    (r0) => {
      mergeCells(ws, r0, 0, 3)
      patchCellStyle(ws, r0, 0, {
        alignment: { horizontal: "left", vertical: "center", wrapText: false },
      })
    }
  )
}

/* --------------------------- number formatting --------------------------- */

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

/* ------------------------------ footer block ----------------------------- */

export const boldFooterBlock = (
  ws: XLSX.WorkSheet,
  rTOTAL: number,
  rowTongCong: number
) => {
  const maxCol = COL_HOA_HONG.GHICHU
  const startFooter0 = rowTongCong !== -1 ? rowTongCong : rTOTAL + 1

  const rGDKD = findRowContains(ws, "Giám đốc kinh doanh", {
    scanRows: 9000,
    scanCols: 40,
  })
  const rNLB = findRowContains(ws, "Người lập bảng", {
    scanRows: 9000,
    scanCols: 40,
  })
  const rDuc = findRowContains(ws, "NGUYỄN TRỌNG ĐỨC", {
    scanRows: 9000,
    scanCols: 40,
  })
  const rBich = findRowContains(ws, "ONG NGỌC BÍCH", {
    scanRows: 9000,
    scanCols: 40,
  })

  const marks = [rGDKD, rNLB, rDuc, rBich].filter((x) => x !== -1)
  const endFooter0 = marks.length ? Math.max(...marks) : startFooter0 + 5

  // không kéo xuống thêm
  ensureRefIncludes(ws, endFooter0, maxCol)

  // set nhỏ cho toàn footer trước
  setRowHeightRange(ws, startFooter0, endFooter0, 35)

  // chỉnh riêng khoảng trống ký nếu đủ cặp title/name
  const rTitle = Math.max(rGDKD, rNLB)
  const rName = Math.max(rDuc, rBich)

  if (rTitle !== -1 && rName !== -1 && rName > rTitle) {
    setRowHeight(ws, rTitle, 40)
    setRowHeight(ws, rName, 40)

    const gapStart = rTitle + 1
    const gapEnd = rName - 1
    if (gapEnd >= gapStart) setRowHeightRange(ws, gapStart, gapEnd, 18)
  }

  // font + vertical center toàn vùng footer
  for (let r0 = startFooter0; r0 <= endFooter0; r0++) {
    for (let c0 = 0; c0 <= maxCol; c0++) {
      const cell = ensureCell(ws, r0, c0)
      patchCellStyle(ws, r0, c0, {
        font: { ...(cell.s?.font || {}), sz: 14, bold: true },
        alignment: {
          ...(cell.s?.alignment || {}),
          vertical: "center",
          horizontal: (cell.s?.alignment as any)?.horizontal || "left",
          wrapText: false,
        },
      })
    }
  }

  const centerRowText = (text: string) => {
    const r0 = findRowContains(ws, text, { scanRows: 9000, scanCols: 40 })
    if (r0 === -1) return
    const target = normalize(text)

    for (let c0 = 0; c0 <= maxCol; c0++) {
      const v = (ws as any)[addrRC(r0, c0)]?.v
      if (normalize(v ?? "") === target) {
        setAlignmentCellMergeAware(ws, r0, c0, {
          horizontal: "center",
          vertical: "center",
          wrapText: false,
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
  ].forEach(centerRowText)
}
