import * as XLSX from "xlsx-js-style"
import {
  ExcelRow,
  getSheetAOA,
  deepCloneSheet,
  insertRows,
  ensureRefIncludes,
  unmergeInRange,
} from "@/utils/excel"

import {
  buildSalesPicker,
  findFinalHeaderRow0,
  findFooterLabelRow0,
  formatExcelDate,
  mapTemplateCols,
  num,
  pickMonthStrFromSalesRows,
  setCellRC,
} from "./thugiavon.excel"
import { applyHcmDateNow, applyThuGiaVonStyles } from "./thugiavon.style"

export function buildThuGiaVonSheetForDealer(args: {
  templateWorkbook: XLSX.WorkBook
  templateSheetName: string
  salesRows: ExcelRow[]
  dealerPicked: string
  categoryPicked?: string
  onLog?: (...args: any[]) => void
}) {
  const { templateWorkbook, templateSheetName, salesRows, dealerPicked } = args
  const log = args.onLog || (() => {})
  const categoryPicked = String(args.categoryPicked ?? "").trim()

  const templateSheet = templateWorkbook.Sheets[templateSheetName]
  if (!templateSheet) {
    throw new Error(
      `Không tìm thấy sheet "${templateSheetName}" trong file mẫu`
    )
  }

  const picker = buildSalesPicker(salesRows)
  const monthStr = pickMonthStrFromSalesRows(salesRows, picker, dealerPicked)

  // group rows by category for chosen dealer
  const groups = new Map<string, ExcelRow[]>()
  for (const r of salesRows) {
    const dealerKey = picker.H.DAILY || "Tên đại lý"
    const dealerName = String(
      (r as any)[dealerKey] ?? (r as any)["Tên đại lý"] ?? ""
    ).trim()
    if (!dealerName || dealerName !== dealerPicked) continue

    const category = String((r as any)["Loại sản phẩm"] ?? "").trim() || "KHÁC"
    if (categoryPicked && category !== categoryPicked) continue

    if (!groups.has(category)) groups.set(category, [])
    groups.get(category)!.push(r)
  }

  if (groups.size === 0) return null // ALL mode skip dealer no data

  const ws = deepCloneSheet(templateSheet)
  const aoa0 = getSheetAOA(ws)

  const headerRow0 = findFinalHeaderRow0(aoa0)
  if (headerRow0 === -1) {
    throw new Error(
      "Không dò được dòng header cuối (cần có: Ngày tháng/Ngày phát sinh + MST + Tên công ty)."
    )
  }

  const { COL, lastCol } = mapTemplateCols(aoa0, headerRow0)
  const dataStartRow0 = headerRow0 + 2
  let footerLabelRow0 = findFooterLabelRow0(aoa0)

  const categories = Array.from(groups.keys()).sort((a, b) =>
    a.localeCompare(b, "vi")
  )
  const totalRows = categories.reduce(
    (sum, k) => sum + (groups.get(k)?.length || 0),
    0
  )

  let sumRow0 =
    footerLabelRow0 !== -1 ? footerLabelRow0 - 1 : dataStartRow0 + totalRows

  // fixed footer but data longer => insert
  if (footerLabelRow0 !== -1) {
    const available = sumRow0 - dataStartRow0
    if (totalRows > available) {
      const need = totalRows - available
      log("🔧 Insert rows to fit ALL data:", { dealer: dealerPicked, need })
      insertRows(ws, footerLabelRow0, need)
      footerLabelRow0 += need
      sumRow0 += need
    }
  }

  const dataEndRow0 = dataStartRow0 + totalRows - 1

  // header cells (template positions)
  setCellRC(ws, 0, 6, dealerPicked) // G1
  setCellRC(ws, 5, 1, dealerPicked) // B6

  // unmerge only data area
  if (dataEndRow0 >= dataStartRow0)
    unmergeInRange(ws, dataStartRow0, dataEndRow0)

  // fill data
  let stt = 1
  let cursor = dataStartRow0
  for (const cat of categories) {
    const rows = groups.get(cat) || []
    for (let i = 0; i < rows.length; i++) {
      const r0 = cursor + i
      const row = rows[i] as any

      setCellRC(ws, r0, COL.STT, stt++)

      if (COL.NGAY !== -1)
        setCellRC(
          ws,
          r0,
          COL.NGAY,
          formatExcelDate(row[picker.H.NGAY] ?? row["Ngày tháng"])
        )

      if (COL.MST !== -1)
        setCellRC(
          ws,
          r0,
          COL.MST,
          String(row[picker.H.MST] ?? row["MST"] ?? "").trim()
        )

      if (COL.TEN !== -1)
        setCellRC(
          ws,
          r0,
          COL.TEN,
          String(row[picker.H.TEN] ?? row["Tên công ty"] ?? "").trim()
        )

      if (COL.LOAIHD !== -1)
        setCellRC(
          ws,
          r0,
          COL.LOAIHD,
          String(row[picker.H.LOAIHD] ?? row["Loại hợp đồng"] ?? "").trim()
        )

      setCellRC(ws, r0, COL.TONGTIEN, num(row[picker.H.TONGTIEN]))
      setCellRC(ws, r0, COL.GOIHOADON, num(row[picker.H.GOI]))
      setCellRC(ws, r0, COL.DTKHAC, num(row[picker.H.DTKHAC]))
      setCellRC(ws, r0, COL.NIEMYET, num(row[picker.H.NIEMYET]))
      setCellRC(ws, r0, COL.GIAMINV, num(row[picker.H.GIAMINV]))

      if (COL.GHICHU !== -1)
        setCellRC(
          ws,
          r0,
          COL.GHICHU,
          String(row[picker.H.GHICHU] ?? row["ghi chú"] ?? "").trim()
        )
    }
    cursor += rows.length
  }

  // SUM row
  const startRow1 = dataStartRow0 + 1
  const lastRow1 = dataEndRow0 + 1
  const safeSUM = (c0: number) => {
    if (c0 == null || c0 < 0) return
    const col = XLSX.utils.encode_col(c0)
    setCellRC(ws, sumRow0, c0, {
      t: "n",
      f: `SUM(${col}${startRow1}:${col}${lastRow1})`,
      v: 0,
    })
  }

  safeSUM(COL.TONGTIEN)
  safeSUM(COL.GOIHOADON)
  safeSUM(COL.DTKHAC)
  safeSUM(COL.NIEMYET)
  safeSUM(COL.GIAMINV)

  // copy tổng GIAMINV xuống dòng dưới (để không bị trống)
  if (COL.GIAMINV !== -1) {
    const src = XLSX.utils.encode_cell({ r: sumRow0, c: COL.GIAMINV })
    const dst = XLSX.utils.encode_cell({ r: sumRow0 + 1, c: COL.GIAMINV })
    const cell = (ws as any)[src]
    if (cell) (ws as any)[dst] = { ...cell }
  }
  // ✅ lấy Mã đại lý từ file theo dõi doanh số theo dealerPicked
  let maDaiLy = ""
  const dealerKey = picker.H.DAILY || "Tên đại lý"
  const maKey = (picker.H as any).MA_DAI_LY || "Mã đại lý"

  for (const r of salesRows) {
    const dn = String((r as any)[dealerKey] ?? "").trim()
    if (dn !== dealerPicked) continue

    maDaiLy = String((r as any)[maKey] ?? (r as any)["Mã đại lý"] ?? "").trim()
    if (maDaiLy) break
  }

  applyHcmDateNow(ws, new Date())

  // styles
  applyThuGiaVonStyles({
    ws,
    aoa0,
    headerRow0,
    dataStartRow0,
    dataEndRow0,
    sumRow0,
    footerLabelRow0,
    COL,
    lastCol,
    dealerName: dealerPicked,
    monthStr,
    maDaiLy,
  })

  ensureRefIncludes(ws, Math.max(sumRow0, footerLabelRow0), lastCol)

  return { ws, outSheetNameBase: `${dealerPicked} - THU GIÁ VỐN` }
}
