import * as XLSX from "xlsx-js-style"
import {
  addrRC,
  deepClone,
  ensureCell,
  normalize,
  patchCellStyle,
  setCellValueKeepStyle,
} from "@/utils/excel"
import {
  COL_XUATHD,
  fontBase,
  fontBold,
  fontItalicBold,
  fontTitle,
  HEADER_FILL,
  NUM_PARENS_FMT,
  THIN_BORDER,
  WHITE_FILL,
  WIDTH_COL_XUATHD,
} from "@/constants/XuatHoaDon"

const findCellByText = (
  ws: XLSX.WorkSheet,
  keywords: string[],
  rowMax0 = 200
): { r0: number; c0: number } | null => {
  const ref = (ws as any)["!ref"]
  if (!ref) return null

  const rng = XLSX.utils.decode_range(ref)
  const wants = keywords.map((x) => normalize(x))

  for (let r0 = rng.s.r; r0 <= Math.min(rng.e.r, rowMax0); r0++) {
    for (let c0 = rng.s.c; c0 <= rng.e.c; c0++) {
      const text = normalize((ws as any)[addrRC(r0, c0)]?.v ?? "")
      if (text && wants.some((w) => text.includes(w))) return { r0, c0 }
    }
  }
  return null
}

const syncRowHeight = (ws: XLSX.WorkSheet, srcR0: number, dstR0: number) => {
  const rows: any[] = (ws as any)["!rows"] || []
  if (rows[srcR0]) {
    rows[dstR0] = deepClone(rows[srcR0])
    ;(ws as any)["!rows"] = rows
  }
}
const setRowHeight = (ws: XLSX.WorkSheet, r0: number, hpt: number) => {
  const rows: any[] = (ws as any)["!rows"] || []
  rows[r0] = {
    ...(rows[r0] || {}),
    hpt,
    hpx: Math.round(hpt * 1.333),
  }
  ;(ws as any)["!rows"] = rows
}

const isNumberCol = (c0: number) =>
  [
    COL_XUATHD.BAN_QUYEN,
    COL_XUATHD.SO_LUONG,
    COL_XUATHD.GOI_HOA_DON,
    COL_XUATHD.DT_KHAC,
    COL_XUATHD.GIA_TRI_HOA_DON,
    COL_XUATHD.GIA_MINV_THU_VE,
    COL_XUATHD.HOA_HONG_DL,
    COL_XUATHD.CONG_NO_THU_KHACH,
    COL_XUATHD.CON_LAI,
  ].includes(c0)

const getHorizontalAlign = (c0: number): "left" | "center" | "right" => {
  if (c0 === COL_XUATHD.TEN_DON_VI || c0 === COL_XUATHD.GHI_CHU) return "left"

  if (
    c0 === COL_XUATHD.STT ||
    c0 === COL_XUATHD.THANG_PHAT_SINH ||
    c0 === COL_XUATHD.MA_SO_THUE ||
    c0 === COL_XUATHD.LOAI_SP
  ) {
    return "center"
  }

  return "right"
}

const setCellStyle = (
  ws: XLSX.WorkSheet,
  r0: number,
  c0: number,
  style: any
) => {
  const cell = ensureCell(ws, r0, c0)
  const keepValue = cell.v
  const keepType = cell.t
  const keepFormula = cell.f
  const keepNumFmt = style?.numFmt ?? cell.z ?? cell.s?.numFmt

  ;(ws as any)[addrRC(r0, c0)] = {
    t: keepType || (typeof keepValue === "number" ? "n" : "s"),
    v: keepValue ?? (typeof keepValue === "number" ? 0 : ""),
    ...(keepFormula ? { f: keepFormula } : {}),
    ...(keepNumFmt ? { z: keepNumFmt } : {}),
    s: {
      ...style,
      ...(keepNumFmt ? { numFmt: keepNumFmt } : {}),
    },
  }

  delete (ws as any)[addrRC(r0, c0)].r
  delete (ws as any)[addrRC(r0, c0)].h
  delete (ws as any)[addrRC(r0, c0)].w
}

const setRowStyle = (
  ws: XLSX.WorkSheet,
  r0: number,
  cStart0: number,
  cEnd0: number,
  styleFactory: (c0: number) => any
) => {
  for (let c0 = cStart0; c0 <= cEnd0; c0++) {
    setCellStyle(ws, r0, c0, styleFactory(c0))
  }
}

const applyHeaderRowsManual = (ws: XLSX.WorkSheet) => {
  setRowStyle(ws, 4, 0, COL_XUATHD.GHI_CHU, () => ({
    font: fontTitle,
    alignment: { horizontal: "center", vertical: "bottom", wrapText: true },
    fill: WHITE_FILL,
  }))

  setRowStyle(ws, 5, 0, COL_XUATHD.GHI_CHU, () => ({
    font: fontItalicBold,
    alignment: { horizontal: "center", vertical: "bottom", wrapText: true },
    fill: WHITE_FILL,
  }))

  for (const r0 of [7, 8]) {
    setRowStyle(ws, r0, 0, COL_XUATHD.GHI_CHU, () => ({
      font: fontBold,
      alignment: {
        horizontal: "center",
        vertical: "center",
        wrapText: true,
      },
      border: THIN_BORDER,
      fill: HEADER_FILL,
    }))
  }

  setRowStyle(ws, 9, 0, COL_XUATHD.GHI_CHU, () => ({
    font: fontBold,
    alignment: {
      horizontal: "center",
      vertical: "bottom",
      wrapText: true,
    },
    border: THIN_BORDER,
    fill: HEADER_FILL,
  }))
}

const applyDataRowManual = (ws: XLSX.WorkSheet, r0: number) => {
  for (let c0 = 0; c0 <= COL_XUATHD.GHI_CHU; c0++) {
    setCellStyle(ws, r0, c0, {
      font: {
        name: "Times New Roman",
        sz: 10,
        bold: false,
        italic: false,
        color: { rgb: "000000" },
      },
      fill: WHITE_FILL,
      border: THIN_BORDER,
      alignment: {
        vertical: "bottom",
        horizontal: getHorizontalAlign(c0),
        wrapText: true,
      },
      ...(isNumberCol(c0) ? { numFmt: NUM_PARENS_FMT } : {}),
    })
  }
}

const applyTotalRowManual = (ws: XLSX.WorkSheet, r0: number) => {
  for (let c0 = 0; c0 <= COL_XUATHD.GHI_CHU; c0++) {
    setCellStyle(ws, r0, c0, {
      font: fontBold,
      fill: HEADER_FILL,
      border: THIN_BORDER,
      alignment: {
        vertical: "bottom",
        horizontal: c0 === COL_XUATHD.STT ? "left" : getHorizontalAlign(c0),
        wrapText: true,
      },
      ...(isNumberCol(c0) ? { numFmt: NUM_PARENS_FMT } : {}),
    })
  }
}

const applyFooterRowManual = (
  ws: XLSX.WorkSheet,
  r0: number,
  opts?: { redText?: boolean }
) => {
  for (let c0 = 0; c0 <= COL_XUATHD.GHI_CHU; c0++) {
    setCellStyle(ws, r0, c0, {
      font: {
        ...fontBase,
        bold: c0 === 0,
        color: { rgb: opts?.redText ? "FF0000" : "000000" },
      },
      fill: WHITE_FILL,
      border: THIN_BORDER,
      alignment: {
        vertical: "bottom",
        horizontal: c0 === COL_XUATHD.STT ? "left" : getHorizontalAlign(c0),
        wrapText: true,
      },
      ...(isNumberCol(c0) ? { numFmt: NUM_PARENS_FMT } : {}),
    })
  }
}

export const applyTemplateVisualStyleXuatHD = (
  ws: XLSX.WorkSheet,
  rows: {
    rDataStart: number
    rTotal: number
    rFooter1: number
    rFooter2: number
    rFooter3: number
    rFooter4: number
    rSignDate?: number
    rSignTitle?: number
  }
) => {
  applyHeaderRowsManual(ws)

  // nới header
  setRowHeight(ws, 4, 24)
  setRowHeight(ws, 5, 22)
  setRowHeight(ws, 7, 26)
  setRowHeight(ws, 8, 24)
  setRowHeight(ws, 9, 20)

  for (let r0 = rows.rDataStart; r0 < rows.rTotal; r0++) {
    syncRowHeight(ws, 10, r0)
    setRowHeight(ws, r0, 20) // dòng data cao hơn
    applyDataRowManual(ws, r0)
  }

  syncRowHeight(ws, 10, rows.rTotal)
  setRowHeight(ws, rows.rTotal, 24)
  applyTotalRowManual(ws, rows.rTotal)

  syncRowHeight(ws, 12, rows.rFooter1)
  setRowHeight(ws, rows.rFooter1, 22)
  applyFooterRowManual(ws, rows.rFooter1)

  syncRowHeight(ws, 13, rows.rFooter2)
  setRowHeight(ws, rows.rFooter2, 22)
  applyFooterRowManual(ws, rows.rFooter2)

  syncRowHeight(ws, 14, rows.rFooter3)
  setRowHeight(ws, rows.rFooter3, 22)
  applyFooterRowManual(ws, rows.rFooter3)

  syncRowHeight(ws, 15, rows.rFooter4)
  setRowHeight(ws, rows.rFooter4, 24)
  applyFooterRowManual(ws, rows.rFooter4, { redText: true })

  const signDateRow = rows.rSignDate ?? 17
  const signTitleRow = rows.rSignTitle ?? 18

  setRowHeight(ws, signDateRow, 22)
  setRowHeight(ws, signTitleRow, 22)

  for (let c0 = 9; c0 <= 14; c0++) {
    setCellStyle(ws, signDateRow, c0, {
      font: { ...fontBase, italic: true },
      alignment: { horizontal: "center", vertical: "bottom", wrapText: true },
      fill: WHITE_FILL,
    })
  }

  for (let c0 = 2; c0 <= 14; c0++) {
    setCellStyle(ws, signTitleRow, c0, {
      font: fontBold,
      alignment: { horizontal: "center", vertical: "bottom", wrapText: true },
      fill: WHITE_FILL,
    })
  }
}

export const setColumnWidthsXuatHD = (ws: XLSX.WorkSheet) => {
  const existing = Array.isArray((ws as any)["!cols"])
    ? (ws as any)["!cols"]
    : []

  if (existing.length > 0) {
    ws["!cols"] = existing.map((col: any) => deepClone(col))
    return
  }

  ws["!cols"] = WIDTH_COL_XUATHD.map((wch) => ({ wch }))
}

export const applyHeaderDealerMonthXuatHD = (
  ws: XLSX.WorkSheet,
  dealerName: string
) => {
  const titlePos = findCellByText(ws, ["bảng đối soát đại lý"], 20) || {
    r0: 4,
    c0: 0,
  }

  setCellValueKeepStyle(
    ws,
    titlePos.r0,
    titlePos.c0,
    `BẢNG ĐỐI SOÁT ĐẠI LÝ: ${dealerName || ""}`.trim()
  )
}

export const applySignDateXuatHD = (
  ws: XLSX.WorkSheet,
  row0?: number,
  date = new Date()
) => {
  const dd = String(date.getDate()).padStart(2, "0")
  const mm = String(date.getMonth() + 1).padStart(2, "0")
  const yyyy = date.getFullYear()

  const signPos =
    typeof row0 === "number" && row0 >= 0
      ? { r0: row0, c0: 9 }
      : findCellByText(ws, ["hcm, ngày", "hà nội, ngày"], 500)

  if (!signPos) return

  setCellValueKeepStyle(
    ws,
    signPos.r0,
    signPos.c0,
    `HCM, ngày ${dd} tháng ${Number(mm)} năm ${yyyy}`
  )

  const style = getCellStyle(ws, signPos.r0, signPos.c0)
  patchCellStyle(ws, signPos.r0, signPos.c0, {
    alignment: style.alignment ?? {
      horizontal: "center",
      vertical: "bottom",
      wrapText: true,
    },
    font: style.font ?? { ...fontBase, italic: true },
    fill: style.fill ?? WHITE_FILL,
    border: style.border,
  })
}

const getCellStyle = (ws: XLSX.WorkSheet, r0: number, c0: number) => {
  return deepClone(ensureCell(ws, r0, c0).s || {})
}

export const formatAllNumbersXuatHD = (
  ws: XLSX.WorkSheet,
  rows: {
    rDataStart: number
    rTotal: number
    rFooter1: number
    rFooter2: number
    rFooter3: number
    rFooter4: number
  }
) => {
  const numberCols = [
    COL_XUATHD.BAN_QUYEN,
    COL_XUATHD.SO_LUONG,
    COL_XUATHD.GOI_HOA_DON,
    COL_XUATHD.DT_KHAC,
    COL_XUATHD.GIA_TRI_HOA_DON,
    COL_XUATHD.GIA_MINV_THU_VE,
    COL_XUATHD.HOA_HONG_DL,
    COL_XUATHD.CONG_NO_THU_KHACH,
    COL_XUATHD.CON_LAI,
  ]

  for (let r0 = rows.rDataStart; r0 <= rows.rFooter4; r0++) {
    for (const c0 of numberCols) {
      const cell = ensureCell(ws, r0, c0)
      cell.z = NUM_PARENS_FMT
      cell.s = {
        ...(cell.s || {}),
        numFmt: NUM_PARENS_FMT,
      }
    }
  }
}

export const applyXuatHDTableStyle = (
  ws: XLSX.WorkSheet,
  rows: {
    rDataStart: number
    rTotal: number
    rFooter1: number
    rFooter2: number
    rFooter3: number
    rFooter4: number
    rSignDate?: number
    rSignTitle?: number
  }
) => {
  applyTemplateVisualStyleXuatHD(ws, rows)
}
