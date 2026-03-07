import * as XLSX from "xlsx-js-style"
import { normalize, ensureRefIncludes } from "@/utils/excel"
import {
  BLUE_LIGHT,
  COL_HOA_HONG,
  NUM_PARENS_FMT,
  RED_FONT,
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

  setRowHeightRange(ws, rCompany, rCompany + 2, 28)

  for (let r0 = rCompany; r0 <= rCompany + 2; r0++) {
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

/* ----------------------- header dealer + month ------------------------ */
/**
 * Template mới:
 * - Title: "BẢNG ĐỐI SOÁT DOANH THU THÁNG" => append tháng vào title
 * - Dealer label "ĐẠI LÝ/CTV", value ở cột K
 */
export const applyHeaderDealerMonth = (
  ws: XLSX.WorkSheet,
  dealerName: string
) => {
  const rTITLE = findRowContains(ws, "BẢNG ĐỐI SOÁT DOANH THU THÁNG", {
    scanRows: 100,
    scanCols: 30,
  })

  const now = new Date()
  const fallbackMonth = `${String(now.getMonth() + 1).padStart(2, "0")}/${now.getFullYear()}`

  const sanitizeMonth = (m?: string) => {
    const s = String(m ?? "").trim()
    // format mm/yyyy
    const match = s.match(/^(\d{1,2})\/(\d{4})$/)
    if (!match) return fallbackMonth

    const mm = Number(match[1])
    const yyyy = Number(match[2])

    // chặn 1900/những năm sai
    if (mm < 1 || mm > 12 || yyyy < 2000) return fallbackMonth

    return `${String(mm).padStart(2, "0")}/${yyyy}`
  }

  if (rTITLE !== -1) {
    const cTitle = 7 // H
    const tl = getTopLeftOfMerge(ws, rTITLE, cTitle)
    setTextKeepStyle(ws, tl.r, tl.c, `BẢNG ĐỐI SOÁT DOANH THU THÁNG `)
    patchCellStyle(ws, tl.r, tl.c, {
      font: { bold: true, sz: 18 },
      alignment: { horizontal: "left", vertical: "center", wrapText: false },
    })
    setRowHeight(ws, rTITLE, 30)
  }

  const rDealer = findRowContains(ws, "ĐẠI LÝ/CTV", {
    scanRows: 80,
    scanCols: 30,
  })
  if (rDealer !== -1) {
    setTextKeepStyle(ws, rDealer, 10, dealerName) // K
    patchCellStyle(ws, rDealer, 10, {
      font: { bold: true, sz: 14 },
      alignment: { horizontal: "left", vertical: "center", wrapText: false },
    })
  }
}

/* --------------------- footer formulas + highlight ------------------------ */
/**
 * Footer template mới:
 * - Label ở cột C
 * - Value nằm ở ô merge M..N => top-left col M = COL_HOA_HONG.VUOT_GIA
 * - 4 row label sau CỘNG:
 *   1) TỔNG CỘNG HOA HỒNG CHI TRẢ TRONG THÁNG
 *   2) THUẾ TNCN
 *   3) HOA HỒNG DL HƯỞNG
 *   4) CÔNG NỢ TỔNG CỘNG ( Âm - M-invoice chi ; Dương - M-invoice thu)
 */

const FOOTER_LAVENDER_BG = {
  patternType: "solid",
  fgColor: { rgb: "D7CBDC" }, // tím nhạt gần ảnh
} as const
export const applyFooterFormulasAndHighlight = (
  ws: XLSX.WorkSheet,
  rTOTAL: number,
  opts?: { isTncnExempt?: boolean }
) => {
  const isTncnExempt = !!opts?.isTncnExempt
  const FOOTER_COL0 = COL_HOA_HONG.VUOT_GIA // M

  let rowTongCong = -1
  let rowThue = -1
  let rowDlHuong = -1
  let rowMinvoiceConPhaiThu = -1

  const N_TONGCONG = normalize("TỔNG CỘNG HOA HỒNG CHI TRẢ TRONG THÁNG")
  const N_THUE1 = normalize("THUẾ TNCN")
  const N_THUE2 = normalize("THUẾ TNCN")
  const N_DLHUONG = normalize("HOA HỒNG DL HƯỞNG")
  const N_MINV = normalize(
    "CÔNG NỢ TỔNG CỘNG ( Âm - M-invoice chi ; Dương - M-invoice thu)	"
  )

  for (let r0 = rTOTAL + 1; r0 <= rTOTAL + 30; r0++) {
    const vC = (ws as any)[addrRC(r0, 2)]?.v
    const s = normalize(vC ?? "")
    if (s === N_TONGCONG) rowTongCong = r0
    if (s === N_THUE1 || s === N_THUE2) rowThue = r0
    if (s === N_DLHUONG) rowDlHuong = r0
    if (s === N_MINV) rowMinvoiceConPhaiThu = r0
  }

  const setFooterVal = (row0: number, formula: string) => {
    if (row0 === -1) return
    setFormulaKeepStyle(ws, row0, FOOTER_COL0, formula, NUM_PARENS_FMT)
  }

  // 1) Tổng cộng HH
  setFooterVal(rowTongCong, `=${addrRC(rTOTAL, COL_HOA_HONG.TONG_TRA_DOI_TAC)}`)

  // 2) Thuế
  if (rowTongCong !== -1 && rowThue !== -1) {
    setFooterVal(
      rowThue,
      isTncnExempt ? `=0` : `=${addrRC(rowTongCong, FOOTER_COL0)}*10%`
    )
  }

  // 3) HH DL hưởng
  if (rowTongCong !== -1 && rowThue !== -1 && rowDlHuong !== -1) {
    setFooterVal(
      rowDlHuong,
      `=${addrRC(rowTongCong, FOOTER_COL0)}-${addrRC(rowThue, FOOTER_COL0)}`
    )
  }

  // 4) Công nợ tổng cộng
  if (rowMinvoiceConPhaiThu !== -1 && rowDlHuong !== -1) {
    setFooterVal(
      rowMinvoiceConPhaiThu,
      `=${addrRC(rTOTAL, COL_HOA_HONG.CHENH_LECH)}-${addrRC(
        rowDlHuong,
        FOOTER_COL0
      )}`
    )
  }

  // ✅ tô xanh nhạt cho ô giá trị cột M (giống hình)
  const footerRows = [
    rowTongCong,
    rowThue,
    rowDlHuong,
    rowMinvoiceConPhaiThu,
  ].filter((r) => r !== -1)

  for (const r0 of footerRows) {
    patchCellStyle(ws, r0, FOOTER_COL0, {
      fill: FOOTER_LAVENDER_BG,
      alignment: { horizontal: "right", vertical: "center", wrapText: false },
    })
  }

  // ✅ tô tím nhạt cho dòng "CÔNG NỢ..." (vùng label từ C -> trước M)
  if (rowMinvoiceConPhaiThu !== -1) {
    for (let c = 2; c <= FOOTER_COL0 - 1; c++) {
      patchCellStyle(ws, rowMinvoiceConPhaiThu, c, {
        fill: FOOTER_LAVENDER_BG,
        alignment: { horizontal: "left", vertical: "center", wrapText: false },
      })
    }
  }

  const alignFooterLabel = (row0: number) => {
    if (row0 === -1) return
    setAlignmentCellMergeAware(ws, row0, 2, {
      horizontal: "left",
      vertical: "center",
      wrapText: false,
    })
    setRowHeight(ws, row0, 35)
  }

  // merge C..G label
  mergeLabelCG(ws, rowTongCong, "TỔNG CỘNG HOA HỒNG CHI TRẢ TRONG THÁNG")
  mergeLabelCG(ws, rowThue, "THUẾ TNCN")
  mergeLabelCG(ws, rowDlHuong, "HOA HỒNG DL HƯỞNG")
  mergeLabelCG(
    ws,
    rowMinvoiceConPhaiThu,
    "CÔNG NỢ TỔNG CỘNG ( Âm - M-invoice chi ; Dương - M-invoice thu)	"
  )

  alignFooterLabel(rowTongCong)
  alignFooterLabel(rowThue)
  alignFooterLabel(rowDlHuong)
  alignFooterLabel(rowMinvoiceConPhaiThu)

  return { rowTongCong }
}

/* --------------------------- table style block --------------------------- */

// ✅ gỡ merge ở 1 dòng (tránh dính merge cũ của template)
const unmergeRow = (ws: XLSX.WorkSheet, r0: number) => {
  const merges = ((ws as any)["!merges"] || []) as XLSX.Range[]
  ;(ws as any)["!merges"] = merges.filter(
    (m) => !(m.s.r === r0 && m.e.r === r0)
  )
}
// ✅ merge label C..G nhưng giữ chữ ở ô C (top-left)
const mergeLabelCG = (ws: XLSX.WorkSheet, r0: number, text: string) => {
  if (r0 === -1) return

  // gỡ merge cũ của dòng đó (nếu có)
  unmergeRow(ws, r0)

  // quan trọng: set text vào ô C trước (top-left)
  setTextKeepStyle(ws, r0, 2, text)

  // merge C..G (C=2, G=6)
  mergeCells(ws, r0, 2, 6)

  // style cho ô top-left của merge
  patchCellStyle(ws, r0, 2, {
    alignment: { horizontal: "left", vertical: "center", wrapText: false },
    font: { bold: true },
  })
}

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
    rH: number
    rTOTAL: number
  }
) => {
  const maxCol = COL_HOA_HONG.GHI_CHU
  const headerRow0 = rows.rA - 1
  const top0 = Math.max(0, headerRow0)
  const bot0 = rows.rTOTAL

  // base: center toàn bảng
  setAlignmentRange(ws, top0, bot0, 0, maxCol, {
    horizontal: "center",
    vertical: "center",
    wrapText: false,
  })

  // TÊN: left + wrap
  setColAlignmentMergeAware(ws, top0, bot0, COL_HOA_HONG.TEN, {
    horizontal: "left",
    vertical: "center",
    wrapText: true,
  })

  // header row: wrap
  setAlignmentRange(ws, headerRow0, headerRow0, 0, maxCol, {
    horizontal: "center",
    vertical: "center",
    wrapText: true,
  })
  setRowHeight(ws, headerRow0, 55)

  // data: numeric cols right
  const dataStart = headerRow0 + 1
  const dataEnd = bot0

  const rightCols: number[] = [
    COL_HOA_HONG.BANQUYEN,
    COL_HOA_HONG.SL_MOI,
    COL_HOA_HONG.SL_GH,
    COL_HOA_HONG.SL_TANG,
    COL_HOA_HONG.DT_GOI_HD,
    COL_HOA_HONG.DT_KHAC,
    COL_HOA_HONG.TRI_GIA_XUAT_HD,
    COL_HOA_HONG.GIA_DOI_SOAT,
    COL_HOA_HONG.VUOT_GIA,
    COL_HOA_HONG.TIEN_HOA_HONG,
    COL_HOA_HONG.PHI_VIET_CHENH,
    COL_HOA_HONG.TONG_TRA_DOI_TAC,
    COL_HOA_HONG.DT_MINVOICE,
    COL_HOA_HONG.CHENH_LECH,
  ]
  for (const c0 of rightCols) {
    setColAlignmentMergeAware(ws, dataStart, dataEnd, c0, {
      horizontal: "right",
      vertical: "center",
      wrapText: false,
    })
  }

  const cksStart = rows.rG + 1
  const cksEnd = rows.rH - 1
  if (cksEnd >= cksStart) {
    for (let r0 = cksStart; r0 <= cksEnd; r0++) {
      setAlignmentCellMergeAware(ws, r0, COL_HOA_HONG.BANQUYEN, {
        horizontal: "center",
        vertical: "center",
        wrapText: true,
      })
    }
  }

  // ghi chú: left + wrap
  setColAlignmentMergeAware(ws, dataStart, dataEnd, COL_HOA_HONG.GHI_CHU, {
    horizontal: "left",
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

  // section rows + TOTAL
  ;[
    rows.rA,
    rows.rB,
    rows.rC,
    rows.rD,
    rows.rE,
    rows.rF,
    rows.rG,
    rows.rH,
    rows.rTOTAL,
  ].forEach(paintTitleRow)

  // data row height
  setRowHeightRange(ws, headerRow0 + 1, bot0 - 1, 30)

  // total row
  setRowHeight(ws, rows.rTOTAL, 32)
  setRowFont(ws, rows.rTOTAL, 0, maxCol, RED_FONT)

  // ✅ merge title:
  // - các khu khác: A..D
  // - riêng CKS (rows.rF): A..C để không che "F. GIÁ TRỊ CHỮ KÝ SỐ" ở cột D
  ;[
    rows.rA,
    rows.rB,
    rows.rC,
    rows.rD,
    rows.rE,
    rows.rF,
    rows.rG,
    rows.rH,
  ].forEach((r0) => {
    // merge A..C (không đụng cột D)
    mergeCells(ws, r0, 0, 2)
    patchCellStyle(ws, r0, 0, {
      alignment: { horizontal: "left", vertical: "center", wrapText: false },
    })
  })
}

/* --------------------------- number formatting --------------------------- */

export const formatAllNumbers = (ws: XLSX.WorkSheet) => {
  const rng = XLSX.utils.decode_range(ws["!ref"] || "A1")
  const rEnd0 = rng.e.r

  const intCols = [
    COL_HOA_HONG.STT,
    COL_HOA_HONG.SL_MOI,
    COL_HOA_HONG.SL_GH,
    COL_HOA_HONG.SL_TANG,
  ]
  const moneyCols = [
    COL_HOA_HONG.BANQUYEN,
    COL_HOA_HONG.DT_GOI_HD,
    COL_HOA_HONG.DT_KHAC,
    COL_HOA_HONG.TRI_GIA_XUAT_HD,
    COL_HOA_HONG.GIA_DOI_SOAT,
    COL_HOA_HONG.VUOT_GIA,
    COL_HOA_HONG.TIEN_HOA_HONG,
    COL_HOA_HONG.PHI_VIET_CHENH,
    COL_HOA_HONG.TONG_TRA_DOI_TAC,
    COL_HOA_HONG.DT_MINVOICE,
    COL_HOA_HONG.CHENH_LECH,
  ]

  for (let r0 = 0; r0 <= rEnd0; r0++) {
    const dateCell: any = (ws as any)[addrRC(r0, COL_HOA_HONG.NGAY)]
    if (dateCell) {
      const v = dateCell.v

      // 1) rỗng/null => để trống
      if (v == null || v === "") {
        dateCell.t = "s"
        dateCell.v = ""
        dateCell.z = "dd/mm"
        continue
      }

      // 2) nếu là number: Excel date serial
      if (typeof v === "number") {
        // 0/1/2 thường là rỗng hoặc lỗi -> đừng hiển thị 1900
        if (!Number.isFinite(v) || v <= 2) {
          dateCell.t = "s"
          dateCell.v = ""
          dateCell.z = "dd/mm"
          continue
        }
        // serial hợp lệ: giữ, format ngày
        dateCell.t = "n"
        dateCell.z = "dd/mm"
        continue
      }

      // 3) nếu là string: chỉ xóa khi nó "0" hoặc quá rác
      const s = String(v).trim()
      if (!s || s === "0" || s === "00/00") {
        dateCell.t = "s"
        dateCell.v = ""
        dateCell.z = "dd/mm"
        continue
      }

      // nếu là chuỗi ngày (dd/mm/yyyy hoặc yyyy-mm-dd...) -> giữ nguyên
      dateCell.t = "s"
      dateCell.v = s
      dateCell.z = "dd/mm"
    }

    for (const c0 of intCols) {
      const cell: any = (ws as any)[addrRC(r0, c0)]
      if (!cell) continue

      cell.z = `0;;-`
      cell.s = {
        ...(cell.s || {}),
        numFmt: `0;;-`,
      }
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

      cell.z = NUM_PARENS_FMT
      cell.s = {
        ...(cell.s || {}),
        numFmt: NUM_PARENS_FMT,
      }
    }
  }
}

/* ------------------------------ footer block ----------------------------- */

export const boldFooterBlock = (
  ws: XLSX.WorkSheet,
  rTOTAL: number,
  rowTongCong: number
) => {
  const maxCol = COL_HOA_HONG.GHI_CHU
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

  ensureRefIncludes(ws, endFooter0, maxCol)
  setRowHeightRange(ws, startFooter0, endFooter0, 35)

  for (let r0 = startFooter0; r0 <= endFooter0; r0++) {
    for (let c0 = 0; c0 <= maxCol; c0++) {
      const cell = ensureCell(ws, r0, c0)
      patchCellStyle(ws, r0, c0, {
        font: { ...(cell.s?.font || {}), sz: 11, bold: true },
        alignment: {
          ...(cell.s?.alignment || {}),
          vertical: "center",
          horizontal: (cell.s?.alignment as any)?.horizontal || "left",
          wrapText: false,
        },
      })
    }
  }
}
