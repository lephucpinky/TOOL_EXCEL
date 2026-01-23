import * as XLSX from "xlsx-js-style"
import { getSheetAOA, normalize } from "@/utils/excel"

// --------------------
// style basics
// --------------------
export const BORDER_THIN = {
  top: { style: "thin", color: { rgb: "D0D7DE" } },
  bottom: { style: "thin", color: { rgb: "D0D7DE" } },
  left: { style: "thin", color: { rgb: "D0D7DE" } },
  right: { style: "thin", color: { rgb: "D0D7DE" } },
} as const

export const styleCell = (
  ws: XLSX.WorkSheet,
  r0: number,
  c0: number,
  s: any
) => {
  const addr = XLSX.utils.encode_cell({ r: r0, c: c0 })
  if (!(ws as any)[addr]) (ws as any)[addr] = { t: "s", v: "" }
  ;(ws as any)[addr].s = { ...(ws as any)[addr].s, ...s }
}

const getMergeRangeContainingCell = (
  ws: XLSX.WorkSheet,
  r0: number,
  c0: number
) => {
  const merges = ((ws as any)["!merges"] || []) as XLSX.Range[]
  for (const m of merges) {
    if (r0 >= m.s.r && r0 <= m.e.r && c0 >= m.s.c && c0 <= m.e.c) return m
  }
  return null
}
/** header top: THÁNG / ĐẠI LÝ / Số ... + fix wrap/height (scan ONLY top header area) */
export const applyTopHeader = (
  ws: XLSX.WorkSheet,
  dealerName: string,
  monthStr: string
) => {
  // ✅ chỉ scan vùng header giữa: A5:J12 (tuỳ template, bạn có thể nới nếu cần)
  const R0 = 4 // row5
  const R1 = 12 // tới row13
  const C0 = 0 // col A
  const C1 = 12 // tới col M (nới rộng cho chắc)

  const findCellAddrContainsInBox = (needleRaw: string) => {
    const needle = normalize(needleRaw)
    for (let r0 = R0; r0 <= R1; r0++) {
      for (let c0 = C0; c0 <= C1; c0++) {
        const addr = XLSX.utils.encode_cell({ r: r0, c: c0 })
        const cell = (ws as any)[addr]
        const v = cell?.v
        if (v == null || String(v).trim() === "") continue
        if (normalize(String(v)).includes(needle)) return addr
      }
    }
    return ""
  }

  const month = String(monthStr ?? "").trim()
  let mm = "",
    yyyy = ""
  if (month.includes("/")) [mm, yyyy] = month.split("/")

  // ✅ tìm đúng theo text trong HEADER giữa
  const title =
    findCellAddrContainsInBox(
      "BẢNG KÊ PHÁT TRIỂN HÓA ĐƠN ĐIỆN TỬ CHO KHÁCH HÀNG"
    ) || findCellAddrContainsInBox("BẢNG KÊ PHÁT TRIỂN KHÁCH HÀNG")

  const addrThang = findCellAddrContainsInBox("THÁNG")
  const addrDaiLy = findCellAddrContainsInBox("ĐẠI LÝ")
  const addrSo =
    findCellAddrContainsInBox("MINV/HCM/VC") ||
    findCellAddrContainsInBox("MINV/HCM") ||
    findCellAddrContainsInBox("Số")

  if (addrThang) {
    ;(ws as any)[addrThang].t = "s"
    ;(ws as any)[addrThang].v = `THÁNG: ${month}`
  }

  if (addrDaiLy) {
    ;(ws as any)[addrDaiLy].t = "s"
    ;(ws as any)[addrDaiLy].v = `ĐẠI LÝ: ${dealerName}`
  }

  if (addrSo) {
    const docNo = mm && yyyy ? `Số ${mm}.${yyyy}/MINV/HCM` : `Số /MINV/HCM`
    ;(ws as any)[addrSo].t = "s"
    ;(ws as any)[addrSo].v = docNo
  }

  const styleHeaderCell = (addr: string, sz: number, hpt?: number) => {
    if (!addr || !(ws as any)[addr]) return
    const cell = (ws as any)[addr]
    cell.s = {
      ...(cell.s || {}),
      font: { ...(cell.s?.font || {}), bold: true, sz },
      alignment: {
        ...(cell.s?.alignment || {}),
        horizontal: "center",
        vertical: "center",
        wrapText: false,
      },
    }

    if (hpt != null) {
      const r0 = XLSX.utils.decode_cell(addr).r
      const rows = (((ws as any)["!rows"] || []) as any[]).slice()
      rows[r0] = { ...(rows[r0] || {}), hpt }
      ;(ws as any)["!rows"] = rows
    }
  }

  styleHeaderCell(title, 18, 30)
  styleHeaderCell(addrThang, 18, 30)
  styleHeaderCell(addrDaiLy, 13, 20)
  styleHeaderCell(addrSo, 13, 20)
}

export const applyLeftDealerBlockFixed = (
  ws: XLSX.WorkSheet,
  dealerName: string,
  maDaiLy: string
) => {
  // label cells (để chắc chắn bold/left như template)
  const labelAddrs = ["F3", "F4", "F5"]
  for (const a of labelAddrs) {
    const cell: any = (ws as any)[a] ?? ((ws as any)[a] = { t: "s", v: "" })
    cell.s = {
      ...(cell.s || {}),

      alignment: {
        ...(cell.s?.alignment || {}),
        horizontal: "left",
        vertical: "center",
        wrapText: false,
      },
    }
  }

  const setVal = (addr: string, value: string) => {
    const cell: any =
      (ws as any)[addr] ?? ((ws as any)[addr] = { t: "s", v: "" })
    cell.t = "s"
    cell.v = String(value ?? "").trim()
    cell.s = {
      ...(cell.s || {}),

      alignment: {
        ...(cell.s?.alignment || {}),
        horizontal: "left",
        vertical: "center",
        wrapText: false,
      },
    }
  }

  // ✅ đúng: Tên đại lý ở G3
  setVal("G1", dealerName)

  // ✅ đúng: Mã đại lý (bạn đang gọi là MST) ở G5
  setVal("G3", maDaiLy)
}

export function applyThuGiaVonStyles(opts: {
  ws: XLSX.WorkSheet
  aoa0: any[][]
  maDaiLy: string
  headerRow0: number
  dataStartRow0: number
  dataEndRow0: number
  sumRow0: number
  footerLabelRow0: number
  COL: any

  lastCol: number
  dealerName: string
  monthStr: string
}) {
  const {
    ws,
    aoa0,
    maDaiLy,
    headerRow0,
    dataStartRow0,
    dataEndRow0,
    sumRow0,
    footerLabelRow0,
    COL,
    lastCol,
    dealerName,
    monthStr,
  } = opts

  // widths
  const cols: any[] = Array.from({ length: lastCol + 1 }).map(() => ({
    wch: 14,
  }))
  Object.assign(cols, {
    [COL.STT]: { wch: 6 },
    [COL.NGAY]: { wch: 16 },
    [COL.MST]: { wch: 18 },
    [COL.TEN]: { wch: 44 },
    [COL.TONGTIEN]: { wch: 20 },
    [COL.GOIHOADON]: { wch: 16 },
    [COL.DTKHAC]: { wch: 12 },
    [COL.NIEMYET]: { wch: 20 },
    [COL.GIAMINV]: { wch: 20 },
    [COL.GHICHU]: { wch: 18 },
  })
  ;(ws as any)["!cols"] = cols
  // ✅ MAP + STYLE header theo text trong template (THÁNG/ĐẠI LÝ/Số)
  applyTopHeader(ws, dealerName, monthStr)
  applyLeftDealerBlockFixed(ws, dealerName, maDaiLy)

  // C1:C3 bold left no wrap
  for (const a of ["C1", "C2", "C3"]) {
    const cell = ws[a] ?? (ws[a] = { t: "s", v: "" })
    cell.s = {
      ...(cell.s || {}),
      font: { ...(cell.s?.font || {}), bold: true },
      alignment: {
        ...(cell.s?.alignment || {}),
        horizontal: "left",
        vertical: "center",
        wrapText: false,
      },
    }
  }

  // ✅ HEADER A5:A8 (thực tế đang merge A5:J5 .. A8:J8) => style FULL vùng merge
  const colA = 0
  const rows0 = [4, 5, 6, 7] // row0: 4..7 => A5..A8

  // width cột A
  cols[colA] = { ...(cols[colA] || {}), wch: 6 } // chỉnh theo ý bạn
  ;(ws as any)["!cols"] = cols

  // height các dòng 5..8
  const rowInfo = ((ws as any)["!rows"] || []) as any[]
  for (const r0 of rows0) {
    // set cả point + pixel cho chắc
    rowInfo[r0] = { ...(rowInfo[r0] || {}), hpt: 20, hpx: 26 } // chỉnh theo ý bạn
  }
  ;(ws as any)["!rows"] = rowInfo

  // style FULL merge range mỗi dòng (A..J)
  for (const r0 of rows0) {
    const m = getMergeRangeContainingCell(ws, r0, colA)
    const cStart = m ? m.s.c : colA
    const cEnd = m ? m.e.c : colA

    for (let c0 = cStart; c0 <= cEnd; c0++) {
      styleCell(ws, r0, c0, {
        font: { bold: true },
        alignment: {
          horizontal: "center",
          vertical: "center",
          wrapText: false,
        },
      })
    }
  }

  const HEADER_STYLE = {
    font: { bold: true },
    alignment: { vertical: "center", horizontal: "center", wrapText: true },
    fill: { patternType: "solid", fgColor: { rgb: "EEF2F7" } },
    border: BORDER_THIN,
  }

  // header 2 rows: headerRow0..headerRow0+1
  for (let r = Math.max(0, headerRow0); r <= headerRow0 + 1; r++) {
    for (let c = 0; c <= lastCol; c++) styleCell(ws, r, c, HEADER_STYLE)
  }

  // guide row (ngay trên data): CENTER
  const guideRow0 = dataStartRow0 - 1
  if (guideRow0 >= 0) {
    for (let c = 0; c <= lastCol; c++) {
      styleCell(ws, guideRow0, c, {
        alignment: { vertical: "center", horizontal: "center", wrapText: true },
        border: BORDER_THIN,
      })
    }
  }

  // footer label row: fill + label LEFT (merge-safe) + totals
  if (footerLabelRow0 !== -1) {
    for (let c = 0; c <= lastCol; c++) {
      styleCell(ws, footerLabelRow0, c, {
        fill: { patternType: "solid", fgColor: { rgb: "EEF2F7" } },
        border: BORDER_THIN,
      })
    }

    // find label col then find top-left of merge to align
    const aliases = ["giá trị m-invoice thu tiền - xuất hd"]
    let labelCol = -1
    const row = aoa0[footerLabelRow0] || []
    const set = new Set(aliases.map((x) => normalize(x)))
    for (let c = 0; c < row.length; c++) {
      if (set.has(normalize(row[c]))) {
        labelCol = c
        break
      }
    }

    const targetCol = labelCol >= 0 ? labelCol : 0
    const m = getMergeRangeContainingCell(ws, footerLabelRow0, targetCol)
    const topLeftC = m ? m.s.c : targetCol

    styleCell(ws, footerLabelRow0, topLeftC, {
      font: { bold: true },
      alignment: { vertical: "center", horizontal: "left", wrapText: true },
    })

    // totals (right) except GIAMINV
    for (const c of [COL.TONGTIEN, COL.GOIHOADON, COL.DTKHAC, COL.NIEMYET]) {
      if (c !== -1) {
        styleCell(ws, footerLabelRow0, c, {
          font: { bold: true },
          alignment: { vertical: "center", horizontal: "right" },
        })
      }
    }

    // GIAMINV total: CENTER + #,##0
    if (COL.GIAMINV !== -1) {
      styleCell(ws, footerLabelRow0, COL.GIAMINV, {
        font: { bold: true },
        alignment: { vertical: "center", horizontal: "center" },
      })
      const addr = XLSX.utils.encode_cell({
        r: footerLabelRow0,
        c: COL.GIAMINV,
      })
      const cell = (ws as any)[addr]
      if (cell) cell.z = "#,##0"
    }
  }

  // data + sum row
  for (let r = dataStartRow0; r <= Math.max(dataEndRow0, sumRow0); r++) {
    const isSumRow = r === sumRow0
    for (let c = 0; c <= lastCol; c++) {
      // default center
      styleCell(ws, r, c, {
        font: isSumRow ? { bold: true } : undefined,
        alignment: { vertical: "center", horizontal: "center", wrapText: true },
        fill: isSumRow
          ? { patternType: "solid", fgColor: { rgb: "EEF2F7" } }
          : undefined,
        border: BORDER_THIN,
      })

      // name column left
      if (c === COL.TEN) {
        styleCell(ws, r, c, {
          alignment: { vertical: "center", horizontal: "left", wrapText: true },
        })
      }

      const addr = XLSX.utils.encode_cell({ r, c })
      const cell = (ws as any)[addr]
      if (!cell) continue

      if (c === COL.NGAY) cell.z = "dd/mm/yyyy"
      if ([COL.TONGTIEN, COL.DTKHAC, COL.NIEMYET, COL.GIAMINV].includes(c))
        cell.z = "#,##0"
      if (c === COL.GOIHOADON) cell.z = "0"
      if (c === COL.STT) cell.z = "0"
    }
  }
  // ✅ Footer confirm: bold + center (merge-aware)
  const styleFooterCellContains = (needleRaw: string) => {
    const needle = normalize(needleRaw)

    // scan rộng phần cuối sheet
    const rng = XLSX.utils.decode_range((ws as any)["!ref"] || "A1")
    const rStart = Math.max(0, rng.e.r - 60) // 60 dòng cuối
    const rEnd = rng.e.r
    const cEnd = Math.min(rng.e.c, Math.max(lastCol, 30))

    for (let r0 = rStart; r0 <= rEnd; r0++) {
      for (let c0 = 0; c0 <= cEnd; c0++) {
        const addr = XLSX.utils.encode_cell({ r: r0, c: c0 })
        const v = (ws as any)[addr]?.v
        if (v == null || String(v).trim() === "") continue
        if (!normalize(String(v)).includes(needle)) continue

        // nếu nằm trong merge -> style toàn vùng merge
        const m = getMergeRangeContainingCell(ws, r0, c0)
        const cStart = m ? m.s.c : c0
        const cStop = m ? m.e.c : c0

        for (let cc = cStart; cc <= cStop; cc++) {
          styleCell(ws, r0, cc, {
            font: { bold: true },
            alignment: {
              horizontal: "center",
              vertical: "center",
              wrapText: false,
            },
          })
        }
        return
      }
    }
  }

  styleFooterCellContains("Xác nhận đại lý")
  styleFooterCellContains("Xác nhận M-invoice")
}
/** map ngày hiện tại vào dòng "HCM, ngày ... tháng ... năm ..." */
export const applyHcmDateNow = (ws: XLSX.WorkSheet, d = new Date()) => {
  const aoa = getSheetAOA(ws)

  const needle = normalize("HCM, ngày")
  let hitR = -1
  let hitC = -1

  for (let r = 0; r < aoa.length; r++) {
    for (let c = 0; c < (aoa[r] || []).length; c++) {
      const v = aoa[r]?.[c]
      if (v == null || v === "") continue
      if (normalize(String(v)).includes(needle)) {
        hitR = r
        hitC = c
        break
      }
    }
    if (hitR !== -1) break
  }
  if (hitR === -1) return

  // nếu nằm trong merge -> set vào top-left
  const merges = ((ws as any)["!merges"] || []) as XLSX.Range[]
  let topLeftC = hitC
  for (const m of merges) {
    if (hitR >= m.s.r && hitR <= m.e.r && hitC >= m.s.c && hitC <= m.e.c) {
      topLeftC = m.s.c
      break
    }
  }

  const dd = String(d.getDate()).padStart(2, "0")
  const mm = String(d.getMonth() + 1).padStart(2, "0")
  const yyyy = String(d.getFullYear())

  const text = `HCM, ngày ${dd} tháng ${mm} năm ${yyyy}`

  const addr = XLSX.utils.encode_cell({ r: hitR, c: topLeftC })
  const cell: any = (ws as any)[addr] || ((ws as any)[addr] = { t: "s", v: "" })

  // giữ style cũ
  const keepS = cell.s
  const keepZ = cell.z

  cell.t = "s"
  cell.v = text
  cell.s = keepS
  cell.z = keepZ

  styleCell(ws, hitR, topLeftC, {
    font: { bold: true },
    alignment: { vertical: "center", horizontal: "center", wrapText: false },
  })
}
