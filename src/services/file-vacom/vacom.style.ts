import * as XLSX from "xlsx-js-style"
import {
  BORDER_THIN_VACOM,
  COL_WCH_VACOM,
  COL_VACOM,
  MONEY_COLS_VACOM,
} from "@/constants/vacom"
import { styleCell } from "./vacom.excel"
import { getSheetAOA, normalize, ensureRefIncludes } from "@/utils/excel"
const FONT_TNR = { name: "Times New Roman" }
const isNilOrEmpty = (v: any) => v == null || String(v).trim() === ""
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
const getLastCol = (ws: XLSX.WorkSheet) => {
  const ref = (ws as any)["!ref"]
  if (ref) return XLSX.utils.decode_range(ref).e.c
  return Math.max(0, (COL_WCH_VACOM?.length ?? 1) - 1)
}
const mergeRowFullWidthIfHit = (
  ws: XLSX.WorkSheet,
  row0: number,
  startCol0: number,
  lastCol0: number
) => {
  const merges = (((ws as any)["!merges"] || []) as XLSX.Range[]).slice()

  const filtered = merges.filter((m) => {
    const sameRow = row0 >= m.s.r && row0 <= m.e.r
    const colOverlap = !(lastCol0 < m.s.c || startCol0 > m.e.c)
    return !(sameRow && colOverlap)
  })

  filtered.push({ s: { r: row0, c: startCol0 }, e: { r: row0, c: lastCol0 } })
  ;(ws as any)["!merges"] = filtered
}

const findRowContainsInAOA = (aoa: any[][], text: string) => {
  const needle = normalize(text)
  for (let r = 0; r < aoa.length; r++) {
    for (let c = 0; c < (aoa[r] || []).length; c++) {
      const v = aoa[r]?.[c]
      if (isNilOrEmpty(v)) continue
      if (normalize(String(v)).includes(needle)) return r
    }
  }
  return -1
}
const findCellAddrContainsInWS = (ws: XLSX.WorkSheet, needleRaw: string) => {
  const needle = normalize(needleRaw)
  for (const addr of Object.keys(ws)) {
    if (addr.startsWith("!")) continue
    const cell = (ws as any)[addr]
    const v = cell?.v
    if (isNilOrEmpty(v)) continue
    if (normalize(String(v)).includes(needle)) return addr
  }
  return ""
}
const getTopLeftOfMerge = (ws: XLSX.WorkSheet, r0: number, c0: number) => {
  const merges = ((ws as any)["!merges"] || []) as XLSX.Range[]
  for (const m of merges) {
    if (r0 >= m.s.r && r0 <= m.e.r && c0 >= m.s.c && c0 <= m.e.c) return m.s.c
  }
  return c0
}

const findCellPosContainsInAOA = (aoa: any[][], needleRaw: string) => {
  const needle = normalize(needleRaw)
  for (let r = 0; r < aoa.length; r++) {
    for (let c = 0; c < (aoa[r] || []).length; c++) {
      const v = aoa[r]?.[c]
      if (isNilOrEmpty(v)) continue
      if (normalize(String(v)).includes(needle)) return { r, c }
    }
  }
  return null
}

// Trả về address của ô top-left của merge chứa text
const findMergedTopLeftAddrByText = (ws: XLSX.WorkSheet, text: string) => {
  const addr = findCellAddrContainsInWS(ws, text)
  if (addr) {
    const { r, c } = XLSX.utils.decode_cell(addr)
    const topLeftC = getTopLeftOfMerge(ws, r, c)
    return XLSX.utils.encode_cell({ r, c: topLeftC })
  }

  // fallback AOA
  const aoa = getSheetAOA(ws)
  const hit = findCellPosContainsInAOA(aoa, text)
  if (!hit) return ""
  const topLeftC = getTopLeftOfMerge(ws, hit.r, hit.c)
  return XLSX.utils.encode_cell({ r: hit.r, c: topLeftC })
}

/** format theo cột */
export const applyColumnFormats = (
  ws: XLSX.WorkSheet,
  r0: number,
  c0: number
) => {
  const addr = XLSX.utils.encode_cell({ r: r0, c: c0 })
  const cell = ws[addr] as any
  if (!cell) return

  if (c0 === COL_VACOM.NGAY_KICH_HOAT) cell.z = "dd/mm/yyyy"
  if (c0 === COL_VACOM.PHAN_TRAM_HH) cell.z = "0%"

  if (MONEY_COLS_VACOM.includes(c0 as 6 | 8 | 9 | 10 | 11)) cell.z = "#,##0"
  if (c0 === COL_VACOM.STT || c0 === COL_VACOM.SLHD) cell.z = "0"
}

/** header top: THÁNG / ĐẠI LÝ / Số ... + fix wrap/height */
export const applyTopHeader = (
  ws: XLSX.WorkSheet,
  dealerName: string,
  monthStr: string
) => {
  const month = String(monthStr ?? "").trim()
  let mm = "",
    yyyy = ""
  if (month.includes("/")) [mm, yyyy] = month.split("/")

  const title = findCellAddrContainsInWS(ws, "BẢNG KÊ PHÁT TRIỂN KHÁCH HÀNG  ")
  const addrThang = findCellAddrContainsInWS(ws, "THÁNG")
  const addrDaiLy = findCellAddrContainsInWS(ws, "ĐẠI LÝ")
  const addrSo = findCellAddrContainsInWS(ws, "MINV/HCM/VC")

  if (addrThang) {
    ;(ws as any)[addrThang].t = "s"
    ;(ws as any)[addrThang].v = `THÁNG: ${month}`
  }

  if (addrDaiLy) {
    ;(ws as any)[addrDaiLy].t = "s"
    ;(ws as any)[addrDaiLy].v = `ĐẠI LÝ: ${dealerName}`
  }

  if (addrSo) {
    const docNo = mm && yyyy ? `Số ${mm}.${yyyy}MINV/HCM/VC` : `Số MINV/HCM/VC`
    ;(ws as any)[addrSo].t = "s"
    ;(ws as any)[addrSo].v = docNo
  }

  const styleHeaderCell = (addr: string, sz: number, hpt?: number) => {
    if (!addr || !(ws as any)[addr]) return
    const cell = (ws as any)[addr]
    cell.s = {
      ...(cell.s || {}),
      font: { ...(cell.s?.font || {}), ...FONT_TNR, bold: true, sz },
      alignment: {
        ...(cell.s?.alignment || {}),
        horizontal: "center",
        vertical: "center",
        wrapText: false,
      },
    }
    if (hpt != null) setRowHeight(ws, XLSX.utils.decode_cell(addr).r, hpt)
  }

  styleHeaderCell(title, 18, 30)
  styleHeaderCell(addrThang, 18, 30)
  styleHeaderCell(addrDaiLy, 13, 30)
  styleHeaderCell(addrSo, 13, 30)
}

export const widenCompanyHeader = (ws: XLSX.WorkSheet) => {
  const aoa = getSheetAOA(ws)
  const lastCol = getLastCol(ws)

  const rCompany = findRowContainsInAOA(aoa, "CÔNG TY")
  if (rCompany === -1) return

  const rows = [rCompany, rCompany + 1, rCompany + 2]

  ensureRefIncludes(ws, rCompany + 2, lastCol)

  const startCol0 = 2
  for (const r0 of rows) {
    mergeRowFullWidthIfHit(ws, r0, startCol0, lastCol)
    styleCell(ws, r0, startCol0, {
      font: { ...FONT_TNR, bold: true, sz: "14" },
      alignment: { horizontal: "left", vertical: "center", wrapText: false },
    })
  }

  setRowHeight(ws, rCompany, 32)
  setRowHeight(ws, rCompany + 1, 32)
  setRowHeight(ws, rCompany + 2, 32)
}

export const applyVacomHdStyles = (
  ws: XLSX.WorkSheet,
  opts: {
    headerRows0: number[]
    sectionTitleRows0: number[]
    dataStartRow0: number
    dataEndRow0: number
  }
) => {
  const { headerRows0, sectionTitleRows0, dataStartRow0, dataEndRow0 } = opts

  ;(ws as any)["!cols"] = COL_WCH_VACOM.map((wch) => ({ wch }))
  widenCompanyHeader(ws)

  const lastCol = getLastCol(ws)

  const safeStart = Math.max(0, dataStartRow0)
  const safeEnd = Math.max(safeStart, dataEndRow0)

  setRowHeight(ws, 3, 30)
  headerRows0.forEach((r0) => setRowHeight(ws, r0, 30))
  sectionTitleRows0.forEach((r0) => setRowHeight(ws, r0, 30))
  for (let r0 = safeStart; r0 <= safeEnd; r0++) {
    if (headerRows0.includes(r0)) continue
    if (sectionTitleRows0.includes(r0)) continue
    setRowHeight(ws, r0, 30)
  }

  // header style
  headerRows0.forEach((r0) => {
    for (let c0 = 0; c0 <= lastCol; c0++) {
      const isCHeaderTop3 = (r0 === 0 || r0 === 1 || r0 === 2) && c0 === 2
      styleCell(ws, r0, c0, {
        font: { ...FONT_TNR, bold: true },
        alignment: isCHeaderTop3
          ? { vertical: "center", horizontal: "left", wrapText: false }
          : { vertical: "center", horizontal: "center", wrapText: true },
        fill: { patternType: "solid", fgColor: { rgb: "EEF2F7" } },
        border: BORDER_THIN_VACOM,
      })
    }
  })

  // section title style
  sectionTitleRows0.forEach((r0) => {
    for (let c0 = 0; c0 <= lastCol; c0++) {
      styleCell(ws, r0, c0, {
        font: { ...FONT_TNR, bold: true },
        fill: { patternType: "solid", fgColor: { rgb: "DFF3E3" } },
        border: BORDER_THIN_VACOM,
        alignment: { vertical: "center", horizontal: "left", wrapText: false },
      })

      const addr = XLSX.utils.encode_cell({ r: r0, c: c0 })
      const cell = ws[addr] as any
      if (!cell) continue

      if (c0 === COL_VACOM.SLHD) cell.z = "0"
      if (c0 === COL_VACOM.PHAN_TRAM_HH) cell.z = "0%"
      if (MONEY_COLS_VACOM.includes(c0 as 6 | 8 | 9 | 10 | 11)) cell.z = "#,##0"
    }
  })

  // data grid style
  for (let r0 = safeStart; r0 <= safeEnd; r0++) {
    for (let c0 = 0; c0 <= lastCol; c0++) {
      const isNameCol = c0 === COL_VACOM.TEN_HD
      styleCell(ws, r0, c0, {
        font: { ...FONT_TNR },
        alignment: {
          vertical: "center",
          horizontal: isNameCol ? "left" : "center",
          wrapText: isNameCol ? true : false,
        },
        border: BORDER_THIN_VACOM,
      })
      applyColumnFormats(ws, r0, c0)
    }
  }
}

/** style dòng CỘNG – đặt SAU applyVacomHdStyles để không bị ghi đè */
export const styleCongRow = (ws: XLSX.WorkSheet, r0: number) => {
  const lastCol = getLastCol(ws)
  for (let c0 = 0; c0 <= lastCol; c0++) {
    styleCell(ws, r0, c0, {
      font: { ...FONT_TNR, bold: true },
      fill: { patternType: "solid", fgColor: { rgb: "DFF3E3" } },
      border: BORDER_THIN_VACOM,
      alignment: {
        vertical: "center",
        horizontal: c0 === COL_VACOM.TEN_HD ? "left" : "center",
        wrapText: true,
      },
    })
    applyColumnFormats(ws, r0, c0)
  }
}

/** center các cột số trên dòng tổng khu (hàng xanh lá) */
export const centerTotalsOnSectionRow = (ws: XLSX.WorkSheet, r0: number) => {
  const lastCol = getLastCol(ws)
  for (let c0 = COL_VACOM.SLHD; c0 <= lastCol; c0++) {
    styleCell(ws, r0, c0, {
      font: { ...FONT_TNR, bold: true },
      fill: { patternType: "solid", fgColor: { rgb: "DFF3E3" } },
      border: BORDER_THIN_VACOM,
      alignment: { vertical: "center", horizontal: "center", wrapText: true },
    })
    applyColumnFormats(ws, r0, c0)
  }
}

/** map tháng cho dòng "Doanh số Vacom ... trong tháng ..." giống THÁNG: MM/YYYY */
export const applyTailMonth = (ws: XLSX.WorkSheet, monthStr: string) => {
  const month = String(monthStr ?? "").trim()
  if (!month) return

  const addr = findMergedTopLeftAddrByText(ws, "Doanh số Vacom HCM đạt được")
  if (!addr) return

  const hitR = XLSX.utils.decode_cell(addr).r
  const cell: any = (ws as any)[addr] || ((ws as any)[addr] = { t: "s", v: "" })

  const keepS = cell.s
  const keepZ = cell.z

  const curText = String(cell.v ?? "")
  const nextText = /trong\s+tháng\s*\d{1,2}\/\d{4}/i.test(curText)
    ? curText.replace(/trong\s+tháng\s*\d{1,2}\/\d{4}/i, `trong tháng ${month}`)
    : `${curText.trim()} trong tháng ${month}`.trim()

  cell.t = "s"
  cell.v = nextText
  cell.s = keepS
  cell.z = keepZ

  {
    const startCol0 = 2
    const endCol0 = 5

    ensureRefIncludes(ws, hitR, endCol0)
    mergeRowFullWidthIfHit(ws, hitR, startCol0, endCol0)

    styleCell(ws, hitR, startCol0, {
      font: { ...FONT_TNR, bold: true, sz: 14 },
      alignment: { horizontal: "left", vertical: "center", wrapText: false },
    })

    setRowHeight(ws, hitR, 45)
  }
}

/** map ngày hiện tại vào dòng "HCM, ngày ... tháng ... năm ..." */
export const applyHcmDateNow = (ws: XLSX.WorkSheet, d = new Date()) => {
  const addr = findMergedTopLeftAddrByText(ws, "HCM, ngày")
  if (!addr) return

  const dd = String(d.getDate()).padStart(2, "0")
  const mm = String(d.getMonth() + 1).padStart(2, "0")
  const yyyy = String(d.getFullYear())
  const text = `HCM, ngày ${dd} tháng ${mm} năm ${yyyy}`

  const cell: any = (ws as any)[addr] || ((ws as any)[addr] = { t: "s", v: "" })

  const keepS = cell.s
  const keepZ = cell.z

  cell.t = "s"
  cell.v = text
  cell.s = keepS
  cell.z = keepZ
}

/** block cuối: bôi đen + format số có dấu phẩy */
export const styleTailBlockBold = (ws: XLSX.WorkSheet) => {
  const aoa = getSheetAOA(ws)
  const lastCol = getLastCol(ws)

  const rStart = findRowContainsInAOA(aoa, "Doanh số Vacom HCM đạt được")
  const rEnd = findRowContainsInAOA(aoa, "Tổng Minvoice HCM thực thu:")
  if (rStart === -1 || rEnd === -1) return

  const s = Math.min(rStart, rEnd)
  const e = Math.max(rStart, rEnd)

  setRowHeightRange(ws, s, e, 45)

  for (let r0 = s; r0 <= e; r0++) {
    for (let c0 = 0; c0 <= lastCol; c0++) {
      const addr = XLSX.utils.encode_cell({ r: r0, c: c0 })
      const cell = ws[addr] as any

      const cellValue = aoa[r0]?.[c0]
      const isNumber =
        typeof cellValue === "number" ||
        (!isNaN(Number(cellValue)) && String(cellValue).trim() !== "")

      styleCell(ws, r0, c0, {
        font: { ...FONT_TNR, bold: true, sz: 14 },
        alignment: {
          vertical: "center",
          horizontal: isNumber ? "center" : "left",
          wrapText: false,
        },
      })

      if (cell && isNumber) {
        if (cell.t !== "n") {
          const n = Number(cell.v)
          if (!isNaN(n)) {
            cell.t = "n"
            cell.v = n
          }
        }
        cell.z = "#,##0"
      }
    }
  }
}

/** chữ ký cuối */
export const styleSignArea = (ws: XLSX.WorkSheet) => {
  const aoa = getSheetAOA(ws)
  const lastCol = getLastCol(ws)
  const rXacNhan0 = findRowContainsInAOA(aoa, "Xác nhận đại lý")
  const rHcmDate0 = findRowContainsInAOA(aoa, "HCM, ngày")
  const targets = [rXacNhan0, rHcmDate0].filter((r) => r !== -1)
  for (const r0 of targets) setRowHeight(ws, r0, 35)
  if (rHcmDate0 !== -1) setRowHeight(ws, rHcmDate0, 35)
  for (const r0 of targets) {
    for (let c0 = 0; c0 <= lastCol; c0++) {
      styleCell(ws, r0, c0, {
        font: { ...FONT_TNR, bold: true, sz: 14 },
        alignment: {
          vertical: "center",
          horizontal: "center",
          wrapText: false,
        },
      })
    }
  }
}
