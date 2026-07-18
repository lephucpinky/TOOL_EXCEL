import * as XLSX from "xlsx-js-style"
import {
  normalize,
  ensureCell,
  patchCellStyle,
  addrRC,
  setTextKeepStyle,
  setFormulaKeepStyle,
  findRowContains,
} from "@/utils/excel"
import {
  BLUE_LIGHT,
  COL_HOA_HONG,
  NUM_PARENS_FMT,
  RED_FONT,
  sumTargets,
} from "@/constants/Mauhoahong"
import {
  applyFillRow,
  applyInnerThinBorders,
  applyOuterThickBorder,
  mergeCells,
  setRowFont,
  setFontAll,
} from "./hoahong.excel"

type AlignStyle = {
  horizontal?: "left" | "center" | "right"
  vertical?: "top" | "center" | "bottom"
  wrapText?: boolean
}

type TableRows = {
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

const FOOTER_LAVENDER_BG = {
  patternType: "solid",
  fgColor: { rgb: "D7CBDC" },
} as const

const SECTION_KEYS = ["rA", "rB", "rC", "rD", "rE", "rF", "rG", "rH"] as const

const CENTER_ALIGN_COLS: number[] = [
  COL_HOA_HONG.STT,
  COL_HOA_HONG.NGAYPHATSINH,
  COL_HOA_HONG.MASOTHUE,
  COL_HOA_HONG.SOLUONG,
]

const INT_COLS = [
  COL_HOA_HONG.STT,
  COL_HOA_HONG.SOLUONG,
]

const MONEY_COLS = [
  COL_HOA_HONG.DOANH_THU_SAN_PHAM,
  COL_HOA_HONG.PHI_VIET_CHENH,
  COL_HOA_HONG.GIA_TRI_XUAT_HOA_DON,
  COL_HOA_HONG.GIA_DOI_SOAT,
  COL_HOA_HONG.TIEN_HOA_HONG,
  COL_HOA_HONG.CHENH_LECH_VIET_CHENH,
  COL_HOA_HONG.TONG_TIEN_TRA_DOI_TAC,
  COL_HOA_HONG.MINV_DA_THU,
  COL_HOA_HONG.CHENH_LECH_THANH_TOAN,
]

const FOOTER_LABELS = {
  tongCong: "TỔNG CỘNG HOA HỒNG CHI TRẢ TRONG THÁNG",
  thue: "THUẾ TNCN",
  dlHuong: "HOA HỒNG DL HƯỞNG",
  congNo: "CÔNG NỢ TỔNG CỘNG ( Âm - M-invoice chi ; Dương - M-invoice thu)\t",
} as const

/* ----------------------------- basic helpers ----------------------------- */

const getRefRange = (ws: XLSX.WorkSheet) => {
  const ref = (ws as any)["!ref"]
  if (!ref) return null
  return XLSX.utils.decode_range(ref)
}

const getCell = (ws: XLSX.WorkSheet, r0: number, c0: number) => {
  const addr = XLSX.utils.encode_cell({ r: r0, c: c0 })
  return ((ws as any)[addr] ||= { t: "s", v: "" })
}

const hasCell = (ws: XLSX.WorkSheet, r0: number, c0: number) =>
  !!(ws as any)[XLSX.utils.encode_cell({ r: r0, c: c0 })]

const eachCell = (
  rStart0: number,
  rEnd0: number,
  cStart0: number,
  cEnd0: number,
  cb: (r0: number, c0: number) => void
) => {
  for (let r0 = rStart0; r0 <= rEnd0; r0++) {
    for (let c0 = cStart0; c0 <= cEnd0; c0++) cb(r0, c0)
  }
}

const setRowHeightRange = (
  ws: XLSX.WorkSheet,
  rStart0: number,
  rEnd0: number,
  hpt: number
) => {
  if (rEnd0 < rStart0) return
  const rows = [...(((ws as any)["!rows"] || []) as any[])]
  for (let r0 = rStart0; r0 <= rEnd0; r0++) {
    rows[r0] = { ...(rows[r0] || {}), hpt }
  }
  ;(ws as any)["!rows"] = rows
}

const setRowHeight = (ws: XLSX.WorkSheet, r0: number, hpt: number) =>
  setRowHeightRange(ws, r0, r0, hpt)

const setRowsHeight = (ws: XLSX.WorkSheet, rows: number[], hpt: number) => {
  const safeRows = rows.filter((r) => r >= 0)
  if (!safeRows.length) return
  const store = [...(((ws as any)["!rows"] || []) as any[])]
  safeRows.forEach((r0) => {
    store[r0] = { ...(store[r0] || {}), hpt }
  })
  ;(ws as any)["!rows"] = store
}

export const setFontSizeAll = (ws: XLSX.WorkSheet, sz: number) => {
  const rng = getRefRange(ws)
  if (!rng) return

  eachCell(rng.s.r, rng.e.r, rng.s.c, rng.e.c, (r, c) => {
    const cell: any = (ws as any)[XLSX.utils.encode_cell({ r, c })]
    if (!cell) return
    cell.s = cell.s || {}
    cell.s.font = { ...(cell.s.font || {}), sz }
  })
}

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

const toSafeAlign = (align: AlignStyle): Required<AlignStyle> => ({
  horizontal: align.horizontal ?? "center",
  vertical: align.vertical ?? "center",
  wrapText: align.wrapText ?? false,
})

const patchAlignmentAt = (
  ws: XLSX.WorkSheet,
  r0: number,
  c0: number,
  alignment: AlignStyle,
  mergeAware = false
) => {
  const pos = mergeAware ? getTopLeftOfMerge(ws, r0, c0) : { r: r0, c: c0 }
  const cell = getCell(ws, pos.r, pos.c)
  const safe = toSafeAlign(alignment)

  cell.s = cell.s || {}
  cell.s.alignment = {
    ...(cell.s.alignment || {}),
    ...safe,
  }
}

export const setAlignmentCellMergeAware = (
  ws: XLSX.WorkSheet,
  r0: number,
  c0: number,
  alignment: AlignStyle
) => {
  patchAlignmentAt(ws, r0, c0, alignment, true)
}

export const setAlignmentRange = (
  ws: XLSX.WorkSheet,
  rStart0: number,
  rEnd0: number,
  cStart0: number,
  cEnd0: number,
  align: AlignStyle,
  mergeAware = false
) => {
  const safe = toSafeAlign(align)

  eachCell(rStart0, rEnd0, cStart0, cEnd0, (r0, c0) => {
    if (!mergeAware) {
      const cell = ensureCell(ws, r0, c0)
      patchCellStyle(ws, r0, c0, {
        alignment: {
          ...(cell.s?.alignment || {}),
          ...safe,
        },
      })
      return
    }

    patchAlignmentAt(ws, r0, c0, safe, true)
  })
}

export const setColAlignmentMergeAware = (
  ws: XLSX.WorkSheet,
  rStart0: number,
  rEnd0: number,
  c0: number,
  alignment: AlignStyle
) => {
  for (let r0 = rStart0; r0 <= rEnd0; r0++) {
    if (!hasCell(ws, r0, c0)) continue
    patchAlignmentAt(ws, r0, c0, alignment, true)
  }
}

const setColsAlignmentMergeAware = (
  ws: XLSX.WorkSheet,
  rStart0: number,
  rEnd0: number,
  cols: number[],
  alignment: AlignStyle
) => {
  cols.forEach((c0) =>
    setColAlignmentMergeAware(ws, rStart0, rEnd0, c0, alignment)
  )
}

const setRowVerticalBottom = (
  ws: XLSX.WorkSheet,
  rStart0: number,
  rEnd0: number,
  cStart0: number,
  cEnd0: number
) => {
  setAlignmentRange(
    ws,
    rStart0,
    rEnd0,
    cStart0,
    cEnd0,
    { vertical: "bottom" },
    true
  )
}

/* ------------------------------ merge helpers ---------------------------- */

const unmergeRow = (ws: XLSX.WorkSheet, r0: number) => {
  const merges = ((ws as any)["!merges"] || []) as XLSX.Range[]
  ;(ws as any)["!merges"] = merges.filter(
    (m) => !(m.s.r === r0 && m.e.r === r0)
  )
}

const mergeLabelCG = (ws: XLSX.WorkSheet, r0: number, text: string) => {
  if (r0 === -1) return
  unmergeRow(ws, r0)
  setTextKeepStyle(ws, r0, 2, text)
  mergeCells(ws, r0, 2, 6)
  patchCellStyle(ws, r0, 2, {
    alignment: { horizontal: "left", vertical: "bottom", wrapText: false },
    font: { bold: true },
  })
}

/* -------------------------- header company block ------------------------- */

export const applyTopCompanyHeaderHeight = (ws: XLSX.WorkSheet) => {
  const rCompany = findRowContains(ws, "CÔNG TY", {
    scanRows: 200,
    scanCols: 50,
  })
  if (rCompany === -1) return

  setRowHeightRange(ws, rCompany, rCompany + 2, 20)

  eachCell(rCompany, rCompany + 2, 0, 20, (r0, c0) => {
    if (!hasCell(ws, r0, c0)) return
    patchCellStyle(ws, r0, c0, {
      alignment: { vertical: "center", wrapText: false },
      font: { bold: true },
    })
  })
}

/* --------------------------- header dealer block ------------------------- */

export const applyHeaderDealerMonth = (
  ws: XLSX.WorkSheet,
  dealerName: string
) => {
  const rTITLE = findRowContains(ws, "BẢNG ĐỐI SOÁT DOANH THU THÁNG", {
    scanRows: 100,
    scanCols: 30,
  })

  if (rTITLE !== -1) {
    const tl = getTopLeftOfMerge(ws, rTITLE, 7)
    setTextKeepStyle(ws, tl.r, tl.c, "BẢNG ĐỐI SOÁT DOANH THU THÁNG ")
    patchCellStyle(ws, tl.r, tl.c, {
      font: { bold: true, sz: 16 },
      alignment: { horizontal: "left", vertical: "center", wrapText: false },
    })
    setRowHeight(ws, rTITLE, 30)
  }

  const rDealer = findRowContains(ws, "ĐẠI LÝ/CTV", {
    scanRows: 80,
    scanCols: 30,
  })

  if (rDealer !== -1) {
    setTextKeepStyle(ws, rDealer, 10, dealerName)
    patchCellStyle(ws, rDealer, 10, {
      font: { bold: true, sz: 14 },
      alignment: { horizontal: "left", vertical: "center", wrapText: false },
    })
  }
}

/* --------------------- footer formulas + highlight ---------------------- */

export const applyFooterFormulasAndHighlight = (
  ws: XLSX.WorkSheet,
  rTOTAL: number,
  opts?: { isTncnExempt?: boolean }
) => {
  const isTncnExempt = !!opts?.isTncnExempt
  const FOOTER_COL0 = COL_HOA_HONG.TONG_TIEN_TRA_DOI_TAC

  let rowTongCong = -1
  let rowThue = -1
  let rowDlHuong = -1
  let rowMinvoiceConPhaiThu = -1

  const N_TONGCONG = normalize(FOOTER_LABELS.tongCong)
  const N_THUE1 = normalize("THUẾ TNCN")
  const N_THUE2 = normalize(FOOTER_LABELS.thue)
  const N_DLHUONG = normalize(FOOTER_LABELS.dlHuong)
  const N_MINV = normalize(FOOTER_LABELS.congNo)

  for (let r0 = rTOTAL + 1; r0 <= rTOTAL + 30; r0++) {
    const s = normalize((ws as any)[addrRC(r0, 2)]?.v ?? "")
    if (s === N_TONGCONG) rowTongCong = r0
    if (s === N_THUE1 || s === N_THUE2) rowThue = r0
    if (s === N_DLHUONG) rowDlHuong = r0
    if (s === N_MINV) rowMinvoiceConPhaiThu = r0
  }

  const setFooterVal = (row0: number, formula: string) => {
    if (row0 === -1) return
    setFormulaKeepStyle(ws, row0, FOOTER_COL0, formula, NUM_PARENS_FMT)
  }

  setFooterVal(
    rowTongCong,
    `=${addrRC(rTOTAL, COL_HOA_HONG.TONG_TIEN_TRA_DOI_TAC)}`
  )

  if (rowTongCong !== -1 && rowThue !== -1) {
    setFooterVal(
      rowThue,
      isTncnExempt ? `=0` : `=${addrRC(rowTongCong, FOOTER_COL0)}*10%`
    )
  }

  if (rowTongCong !== -1 && rowThue !== -1 && rowDlHuong !== -1) {
    setFooterVal(
      rowDlHuong,
      `=${addrRC(rowTongCong, FOOTER_COL0)}-${addrRC(rowThue, FOOTER_COL0)}`
    )
  }

  if (rowMinvoiceConPhaiThu !== -1) {
    setFooterVal(
      rowMinvoiceConPhaiThu,
      `=${addrRC(rTOTAL, COL_HOA_HONG.GIA_TRI_XUAT_HOA_DON)}-${addrRC(
        rTOTAL,
        COL_HOA_HONG.TONG_TIEN_TRA_DOI_TAC
      )}-${addrRC(rTOTAL, COL_HOA_HONG.MINV_DA_THU)}`
    )
  }

  const footerRows = [
    rowTongCong,
    rowThue,
    rowDlHuong,
    rowMinvoiceConPhaiThu,
  ].filter((r) => r !== -1)

  footerRows.forEach((r0) => {
    patchCellStyle(ws, r0, FOOTER_COL0, {
      fill: FOOTER_LAVENDER_BG,
      alignment: { horizontal: "right", vertical: "center", wrapText: false },
    })
  })

  if (rowMinvoiceConPhaiThu !== -1) {
    for (let c0 = 2; c0 <= FOOTER_COL0 - 1; c0++) {
      patchCellStyle(ws, rowMinvoiceConPhaiThu, c0, {
        fill: FOOTER_LAVENDER_BG,
        alignment: { horizontal: "left", vertical: "center", wrapText: false },
      })
    }
  }

  ;[
    [rowTongCong, FOOTER_LABELS.tongCong],
    [rowThue, FOOTER_LABELS.thue],
    [rowDlHuong, FOOTER_LABELS.dlHuong],
    [rowMinvoiceConPhaiThu, FOOTER_LABELS.congNo],
  ].forEach(([row0, text]) => {
    const r = Number(row0)
    if (r === -1) return
    mergeLabelCG(ws, r, String(text))
    setAlignmentCellMergeAware(ws, r, 2, {
      horizontal: "left",
      vertical: "center",
      wrapText: false,
    })
  })

  setRowsHeight(ws, footerRows, 20)

  return { rowTongCong }
}

/* --------------------------- table style block --------------------------- */

export const applyHoaHongTableStyle = (ws: XLSX.WorkSheet, rows: TableRows) => {
  const maxCol = COL_HOA_HONG.GHI_CHU
  const headerRow0 = rows.rA - 1
  const top0 = Math.max(0, headerRow0)
  const bot0 = rows.rTOTAL
  const dataStart = headerRow0 + 1
  const dataEnd = bot0 - 1
  const sectionRows = SECTION_KEYS.map((k) => rows[k])

  setAlignmentRange(ws, top0, bot0, 0, maxCol, {
    horizontal: "center",
    vertical: "center",
    wrapText: false,
  })

  setAlignmentRange(ws, headerRow0, headerRow0, 0, maxCol, {
    horizontal: "center",
    vertical: "center",
    wrapText: true,
  })
  setRowHeight(ws, headerRow0, 55)

  if (dataEnd >= dataStart) {
    setRowVerticalBottom(ws, dataStart, dataEnd, 0, maxCol)

    setColAlignmentMergeAware(ws, dataStart, dataEnd, COL_HOA_HONG.TENDONVI, {
      horizontal: "left",
      vertical: "bottom",
      wrapText: true,
    })

    setColsAlignmentMergeAware(ws, dataStart, dataEnd, sumTargets, {
      horizontal: "right",
      vertical: "bottom",
      wrapText: false,
    })

    setColsAlignmentMergeAware(ws, dataStart, dataEnd, CENTER_ALIGN_COLS, {
      horizontal: "center",
      vertical: "bottom",
      wrapText: false,
    })

    setColAlignmentMergeAware(ws, dataStart, dataEnd, COL_HOA_HONG.GHI_CHU, {
      horizontal: "left",
      vertical: "bottom",
      wrapText: true,
    })
  }

  setFontAll(ws, "Times New Roman")
  setFontSizeAll(ws, 10)
  applyTopCompanyHeaderHeight(ws)
  const rTITLE = findRowContains(ws, "BẢNG ĐỐI SOÁT DOANH THU THÁNG", {
    scanRows: 100,
    scanCols: 30,
  })

  if (rTITLE !== -1) {
    const tl = getTopLeftOfMerge(ws, rTITLE, 7)
    patchCellStyle(ws, tl.r, tl.c, {
      font: { name: "Times New Roman", bold: true, sz: 16 },
    })
  }
  const rDealer = findRowContains(ws, "CTV", {
    scanRows: 80,
    scanCols: 30,
  })

  if (rDealer !== -1) {
    const tlDealer = getTopLeftOfMerge(ws, rDealer, 8) // vùng label ĐẠI LÝ/CTV
    patchCellStyle(ws, tlDealer.r, tlDealer.c, {
      font: { name: "Times New Roman", bold: true, sz: 14 },
      alignment: { horizontal: "center", vertical: "center", wrapText: false },
    })

    patchCellStyle(ws, rDealer, 10, {
      font: { name: "Times New Roman", bold: true, sz: 14 },
      alignment: { horizontal: "left", vertical: "center", wrapText: false },
    })
  }
  applyInnerThinBorders(ws, top0, bot0, 0, maxCol)
  applyOuterThickBorder(ws, top0, bot0, 0, maxCol)

  const paintTitleRow = (r0: number) => {
    applyFillRow(ws, r0, 0, maxCol, BLUE_LIGHT)
    setRowFont(ws, r0, 0, maxCol, { bold: true })
  }

  ;[headerRow0, ...sectionRows, rows.rTOTAL].forEach(paintTitleRow)

  setAlignmentRange(ws, rows.rTOTAL, rows.rTOTAL, 0, maxCol, {
    horizontal: "center",
    vertical: "bottom",
    wrapText: false,
  })

  setRowHeightRange(ws, headerRow0 + 1, bot0 - 1, 30)
  setRowHeight(ws, rows.rTOTAL, 32)
  setRowFont(ws, rows.rTOTAL, 0, maxCol, RED_FONT)

  sectionRows.forEach((r0) => {
    mergeCells(ws, r0, 0, 2)
    patchCellStyle(ws, r0, 0, {
      alignment: { horizontal: "left", vertical: "bottom", wrapText: false },
    })
  })
}

/* --------------------------- number formatting --------------------------- */

const normalizeDateCell = (cell: any) => {
  const v = cell.v

  if (v == null || v === "") {
    cell.t = "s"
    cell.v = ""
    cell.z = "dd/mm"
    return
  }

  if (typeof v === "number") {
    if (!Number.isFinite(v) || v <= 2) {
      cell.t = "s"
      cell.v = ""
      cell.z = "dd/mm"
      return
    }
    cell.t = "n"
    cell.z = "dd/mm"
    return
  }

  const s = String(v).trim()
  if (!s || s === "0" || s === "00/00") {
    cell.t = "s"
    cell.v = ""
    cell.z = "dd/mm"
    return
  }

  cell.t = "s"
  cell.v = s
  cell.z = "dd/mm"
}

const applyNumFmt = (cell: any, fmt: string) => {
  cell.z = fmt
  cell.s = {
    ...(cell.s || {}),
    numFmt: fmt,
  }
}

export const formatAllNumbers = (ws: XLSX.WorkSheet) => {
  const rng = XLSX.utils.decode_range(ws["!ref"] || "A1")

  for (let r0 = 0; r0 <= rng.e.r; r0++) {
    const dateCell: any = (ws as any)[addrRC(r0, COL_HOA_HONG.NGAYPHATSINH)]
    if (dateCell) normalizeDateCell(dateCell)

    INT_COLS.forEach((c0) => {
      const cell: any = (ws as any)[addrRC(r0, c0)]
      if (!cell) return
      applyNumFmt(cell, `0;;-`)
    })

    MONEY_COLS.forEach((c0) => {
      const cell: any = (ws as any)[addrRC(r0, c0)]
      if (!cell) return

      if (cell.t !== "n" && cell.v != null && cell.v !== "") {
        const n = Number(String(cell.v).replace(/,/g, "").trim())
        if (!Number.isNaN(n)) {
          cell.t = "n"
          cell.v = n
        }
      }

      applyNumFmt(cell, NUM_PARENS_FMT)
    })
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

  const marks = [
    findRowContains(ws, "Giám đốc kinh doanh", {
      scanRows: 9000,
      scanCols: 40,
    }),
    findRowContains(ws, "Người lập bảng", { scanRows: 9000, scanCols: 40 }),
    findRowContains(ws, "NGUYỄN TRỌNG ĐỨC", { scanRows: 9000, scanCols: 40 }),
    findRowContains(ws, "ONG NGỌC BÍCH", { scanRows: 9000, scanCols: 40 }),
  ].filter((x) => x !== -1)

  const endFooter0 = marks.length ? Math.max(...marks) : startFooter0 + 5
  setRowHeightRange(ws, startFooter0, endFooter0, 20)

  eachCell(startFooter0, endFooter0, 0, maxCol, (r0, c0) => {
    const cell = ensureCell(ws, r0, c0)
    patchCellStyle(ws, r0, c0, {
      font: { ...(cell.s?.font || {}), sz: 10, bold: true },
      alignment: {
        ...(cell.s?.alignment || {}),
        vertical: "bottom",
        horizontal: (cell.s?.alignment as any)?.horizontal || "left",
        wrapText: false,
      },
    })
  })
}
