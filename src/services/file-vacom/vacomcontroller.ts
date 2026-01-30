import * as XLSX from "xlsx-js-style"

import {
  classifyProductToSection,
  clearRange,
  deepCloneSheet,
  ensureRefIncludes,
  findSectionTitleRow,
  getSheetAOA,
  insertRows,
  normalize,
  removeAllFormulas,
  setCell,
  setRowFormulas,
  unmergeInRange,
  forceLeftTitleRow,
  monthKey,
} from "../../utils/excel"
import { COL_VACOM } from "@/constants/vacom"

import {
  buildSalesIndex,
  pickHeaderFromIndex,
  findCongRow0,
  findRowContainsAOA,
  findLastDataRow,
  sumRange,
  setFormula,
} from "./vacom.excel"
import {
  applyHcmDateNow,
  applyTailMonth,
  applyTopHeader,
  applyVacomHdStyles,
  centerTotalsOnSectionRow,
  styleCongRow,
  styleSignArea,
  styleTailBlockBold,
} from "./vacom.style"
import { ExcelRow } from "@/utils/excel"

export function buildVacomHdSheetForDealer(args: {
  templateWorkbook: XLSX.WorkBook
  templateSheetName: string
  salesHeaders: string[]
  salesRows: ExcelRow[]
  dealerPicked: string
  categoryPicked?: string
  monthPicked?: string
  onLog?: (...args: any[]) => void
}) {
  const log = args.onLog || (() => {})
  const {
    templateWorkbook,
    templateSheetName,
    salesHeaders,
    salesRows,
    dealerPicked,
    categoryPicked = "",
    monthPicked = "",
  } = args

  const templateWs = templateWorkbook.Sheets[templateSheetName]
  if (!templateWs) throw new Error("❌ Không đọc được sheet VACOM HD")

  // build index + pickHeader
  const idx = buildSalesIndex(salesHeaders)
  const pick = (...aliases: string[]) => pickHeaderFromIndex(idx, ...aliases)

  const productTypeCol =
    salesHeaders.find((h) => normalize(h) === normalize("Loại sản phẩm")) || ""
  if (!productTypeCol) {
    throw new Error(
      '❌ Không tìm thấy đúng cột "Loại sản phẩm" trong file doanh số'
    )
  }

  // map headers
  const H_MST = pick("MST")
  const H_TEN = pick("Tên hợp đồng", "Tên công ty")
  const H_LOAIHD = pick("Loại hợp đồng")
  const H_NGAY = pick("Thời gian kích hoạt", "Ngày tháng", "Ngày phát sinh")
  const H_SL = pick("SLHĐ", "SL phát hành")
  const H_TIEN = pick(
    "Tổng giá trị hợp đồng HDĐT tính hoa hồng",
    "Tổng tiền xuất HD"
  )
  const H_HH = pick("TỶ LỆ HOA HỒNG", "% Hoa hồng")
  const H_HH5 = pick(
    "Hoa hồng thưởng đạt doanh số 5%",
    "Hoa hồng thưởng dạt doanh số 5%"
  )

  const H_DEALER = pick("Tên đại lý", "Đại lý", "Dealer")
  const H_CATEGORY =
    pick("Loại sản phẩm", "Danh mục", "Category") || productTypeCol

  const missing: string[] = []
  if (!H_MST) missing.push("MST")
  if (!H_TEN) missing.push("Tên hợp đồng / Tên công ty")
  if (!H_NGAY) missing.push("Thời gian kích hoạt / Ngày tháng / Ngày phát sinh")
  if (!H_SL) missing.push("SLHĐ / SL phát hành")
  if (!H_TIEN) missing.push("Tổng giá trị... / Tổng tiền xuất HD")
  if (!H_HH) missing.push("TỶ LỆ HOA HỒNG")
  if (!H_DEALER) missing.push("Tên đại lý/Đại lý/Dealer")
  if (missing.length)
    throw new Error("❌ Thiếu cột trong file doanh số: " + missing.join(", "))

  // filter rows for dealer
  const filteredRows = salesRows.filter((r: any) => {
    if (String(r[H_DEALER] ?? "").trim() !== dealerPicked) return false
    if (categoryPicked && String(r[H_CATEGORY] ?? "").trim() !== categoryPicked)
      return false
    if (monthPicked) {
      const mk = monthKey(r[H_NGAY])
      if (mk !== monthPicked) return false
    }
    return true
  })

  if (!filteredRows.length) return null

  // clone sheet
  const newWs = deepCloneSheet(templateWs)
  removeAllFormulas(newWs)

  const recalc = () => getSheetAOA(newWs)
  let aoa = recalc()

  // find sections
  const rA = findSectionTitleRow(aoa, "A. GIÁ TRỊ HÓA ĐƠN ĐIỆN TỬ")
  const rB = findSectionTitleRow(aoa, "B. MÁY TÍNH TIỀN")
  const rC = findSectionTitleRow(aoa, "C. CHỨNG TỪ KHẤU TRỪ THUẾ TNCN")
  const rE = findSectionTitleRow(aoa, "E. QUẢN LÝ HÓA ĐƠN SMI")
  const rD = findSectionTitleRow(aoa, "D. BHXH")
  if ([rA, rB, rC, rE, rD].some((x) => x === -1)) {
    throw new Error(
      "❌ Không tìm thấy đủ khu A/B/C/E/D trong template VACOM HD."
    )
  }

  const group: Record<"A" | "B" | "C" | "E" | "D", ExcelRow[]> = {
    A: [],
    B: [],
    C: [],
    E: [],
    D: [],
  }
  filteredRows.forEach((row: any) => {
    const rawType = row[productTypeCol]
    const sec = classifyProductToSection(rawType)
    if (normalize(rawType).includes("cks")) return
    if (!sec) return
    group[sec].push(row)
  })

  // ensureSpace bottom-up for A/B/C/E (boundary next section)
  const ensureSpace = (
    sec: "A" | "B" | "C" | "E",
    titleLabel: string,
    nextLabel: string
  ) => {
    const aoaNow = recalc()
    const titleRow = findSectionTitleRow(aoaNow, titleLabel, 6000)
    const boundaryRow = findSectionTitleRow(aoaNow, nextLabel, 6000)
    const start = titleRow + 1
    const placeholder = Math.max(0, boundaryRow - start)
    const needInsert = Math.max(0, group[sec].length - placeholder)
    if (needInsert > 0) insertRows(newWs, boundaryRow, needInsert)
  }

  ensureSpace("E", "E. QUẢN LÝ HÓA ĐƠN SMI", "D. BHXH")
  ensureSpace("C", "C. CHỨNG TỪ KHẤU TRỪ THUẾ TNCN", "E. QUẢN LÝ HÓA ĐƠN SMI")
  ensureSpace("B", "B. MÁY TÍNH TIỀN", "C. CHỨNG TỪ KHẤU TRỪ THUẾ TNCN")
  ensureSpace("A", "A. GIÁ TRỊ HÓA ĐƠN ĐIỆN TỬ", "B. MÁY TÍNH TIỀN")

  // ensureSpace for D before CỘNG
  aoa = recalc()
  let rCong0 = findCongRow0(aoa)
  if (rCong0 === -1)
    throw new Error('❌ Không tìm thấy dòng "CỘNG" trong template')

  let rD2 = findSectionTitleRow(aoa, "D. BHXH", 6000)
  if (rD2 === -1)
    throw new Error("❌ Không tìm thấy khu D. BHXH sau khi insert")

  const startD_tmp = rD2 + 1
  const placeholderD = Math.max(0, rCong0 - startD_tmp)
  const needInsertD = Math.max(0, group.D.length - placeholderD)
  if (needInsertD > 0) {
    insertRows(newWs, rCong0, needInsertD)
    aoa = recalc()
    rCong0 = findCongRow0(aoa)
    rD2 = findSectionTitleRow(aoa, "D. BHXH", 6000)
    if (rCong0 === -1 || rD2 === -1)
      throw new Error("❌ Lỗi re-index sau khi insert khu D")
  }

  // re-find again after all inserts
  const rA2 = findSectionTitleRow(aoa, "A. GIÁ TRỊ HÓA ĐƠN ĐIỆN TỬ", 6000)
  const rB2 = findSectionTitleRow(aoa, "B. MÁY TÍNH TIỀN", 6000)
  const rC2 = findSectionTitleRow(aoa, "C. CHỨNG TỪ KHẤU TRỪ THUẾ TNCN", 6000)
  const rE2 = findSectionTitleRow(aoa, "E. QUẢN LÝ HÓA ĐƠN SMI", 6000)
  const rD3 = findSectionTitleRow(aoa, "D. BHXH", 6000)

  const startA = rA2 + 1
  const startB = rB2 + 1
  const startC = rC2 + 1
  const startE = rE2 + 1
  const startD = rD3 + 1

  const maxC = COL_VACOM.CON_PHAI_THANH_TOAN

  // clear placeholders
  clearRange(newWs, startA, rB2 - 1, 0, maxC)
  clearRange(newWs, startB, rC2 - 1, 0, maxC)
  clearRange(newWs, startC, rE2 - 1, 0, maxC)
  clearRange(newWs, startE, rD3 - 1, 0, maxC)
  clearRange(newWs, startD, rCong0 - 1, 0, maxC)

  // unmerge
  unmergeInRange(newWs, startA, rB2 - 1)
  unmergeInRange(newWs, startB, rC2 - 1)
  unmergeInRange(newWs, startC, rE2 - 1)
  unmergeInRange(newWs, startE, rD3 - 1)
  unmergeInRange(newWs, startD, rCong0 - 1)

  let sttCounter = 1

  const fillSection = (startRow0: number, rowsData: ExcelRow[]) => {
    let maxR = startRow0
    for (let i = 0; i < rowsData.length; i++) {
      const r0 = startRow0 + i
      const row = rowsData[i] as any

      setCell(newWs, r0, COL_VACOM.STT, sttCounter++, {
        kind: "stt",
        force: true,
      })
      setCell(newWs, r0, COL_VACOM.MST, row[H_MST], {
        kind: "text",
        force: true,
      })
      setCell(newWs, r0, COL_VACOM.TEN_HD, row[H_TEN], {
        kind: "text",
        force: true,
      })
      setCell(newWs, r0, COL_VACOM.LOAI_HD, H_LOAIHD ? row[H_LOAIHD] : "", {
        kind: "text",
        force: true,
      })
      setCell(newWs, r0, COL_VACOM.NGAY_KICH_HOAT, row[H_NGAY], {
        kind: "date",
        force: true,
      })
      setCell(newWs, r0, COL_VACOM.SLHD, row[H_SL], {
        kind: "number0",
        force: true,
      })
      setCell(newWs, r0, COL_VACOM.TONG_GIA_TRI, row[H_TIEN], {
        kind: "number0",
        force: true,
      })
      setCell(newWs, r0, COL_VACOM.PHAN_TRAM_HH, row[H_HH], {
        kind: "percent",
        force: true,
      })
      setCell(newWs, r0, COL_VACOM.HH_THUONG_5, H_HH5 ? row[H_HH5] : 0, {
        kind: "number0",
        force: true,
      })

      setRowFormulas(newWs, r0, COL_VACOM)

      // ✅ FIX: Đại lý còn phải thanh toán (K) = Tổng giá trị (F) - Tổng trích (J)
      const addrTien = XLSX.utils.encode_cell({
        r: r0,
        c: COL_VACOM.TONG_GIA_TRI,
      })
      const addrTongTrich = XLSX.utils.encode_cell({
        r: r0,
        c: COL_VACOM.TONG_TRICH_DAI_LY,
      })
      setFormula(
        newWs,
        r0,
        COL_VACOM.CON_PHAI_THANH_TOAN,
        `${addrTien}-${addrTongTrich}`
      )

      maxR = Math.max(maxR, r0)
    }
    ensureRefIncludes(newWs, maxR, maxC)
  }

  fillSection(startA, group.A)
  fillSection(startB, group.B)
  fillSection(startC, group.C)
  fillSection(startE, group.E)
  fillSection(startD, group.D)

  // end rows thực tế
  const endA = findLastDataRow(newWs, startA, rB2 - 1, COL_VACOM)
  const endB = findLastDataRow(newWs, startB, rC2 - 1, COL_VACOM)
  const endC = findLastDataRow(newWs, startC, rE2 - 1, COL_VACOM)
  const endE = findLastDataRow(newWs, startE, rD3 - 1, COL_VACOM)
  const endD = findLastDataRow(newWs, startD, rCong0 - 1, COL_VACOM)

  const rebuildSectionTotals = (
    titleRow0: number,
    start: number,
    end: number
  ) => {
    setFormula(
      newWs,
      titleRow0,
      COL_VACOM.SLHD,
      sumRange(COL_VACOM.SLHD, start, end)
    )
    setFormula(
      newWs,
      titleRow0,
      COL_VACOM.TONG_GIA_TRI,
      sumRange(COL_VACOM.TONG_GIA_TRI, start, end)
    )
    setFormula(
      newWs,
      titleRow0,
      COL_VACOM.DAI_LY_DUOC_HUONG,
      sumRange(COL_VACOM.DAI_LY_DUOC_HUONG, start, end)
    )
    setFormula(
      newWs,
      titleRow0,
      COL_VACOM.HH_THUONG_5,
      sumRange(COL_VACOM.HH_THUONG_5, start, end)
    )
    setFormula(
      newWs,
      titleRow0,
      COL_VACOM.TONG_TRICH_DAI_LY,
      sumRange(COL_VACOM.TONG_TRICH_DAI_LY, start, end)
    )
    setFormula(
      newWs,
      titleRow0,
      COL_VACOM.CON_PHAI_THANH_TOAN,
      sumRange(COL_VACOM.CON_PHAI_THANH_TOAN, start, end)
    )
  }

  rebuildSectionTotals(rA2, startA, endA)
  rebuildSectionTotals(rB2, startB, endB)
  rebuildSectionTotals(rC2, startC, endC)
  rebuildSectionTotals(rE2, startE, endE)
  rebuildSectionTotals(rD3, startD, endD)

  // dòng CỘNG: cộng các dòng tổng khu
  const sumCells = (rows0: number[], c0: number) => {
    const addrs = rows0
      .filter((r) => r >= 0)
      .map((r) => XLSX.utils.encode_cell({ r, c: c0 }))
    return addrs.length ? `SUM(${addrs.join(",")})` : "0"
  }

  const sectionTitleRows = [rA2, rB2, rC2, rE2, rD3]
  setFormula(
    newWs,
    rCong0,
    COL_VACOM.SLHD,
    sumCells(sectionTitleRows, COL_VACOM.SLHD)
  )
  setFormula(
    newWs,
    rCong0,
    COL_VACOM.TONG_GIA_TRI,
    sumCells(sectionTitleRows, COL_VACOM.TONG_GIA_TRI)
  )
  setFormula(
    newWs,
    rCong0,
    COL_VACOM.DAI_LY_DUOC_HUONG,
    sumCells(sectionTitleRows, COL_VACOM.DAI_LY_DUOC_HUONG)
  )
  setFormula(
    newWs,
    rCong0,
    COL_VACOM.HH_THUONG_5,
    sumCells(sectionTitleRows, COL_VACOM.HH_THUONG_5)
  )
  setFormula(
    newWs,
    rCong0,
    COL_VACOM.TONG_TRICH_DAI_LY,
    sumCells(sectionTitleRows, COL_VACOM.TONG_TRICH_DAI_LY)
  )
  setFormula(
    newWs,
    rCong0,
    COL_VACOM.CON_PHAI_THANH_TOAN,
    sumCells(sectionTitleRows, COL_VACOM.CON_PHAI_THANH_TOAN)
  )

  // fix block tổng kết dưới CỘNG (KHÔNG search text để tránh nhảy nhầm)
  const rDoanhSo0 = rCong0 + 1
  const rThuong0 = rCong0 + 2
  const rTongThucThu0 = rCong0 + 3

  // Doanh số = ô CỘNG cột H
  const addrCongDoanh = XLSX.utils.encode_cell({
    r: rCong0,
    c: COL_VACOM.CON_PHAI_THANH_TOAN,
  })
  setFormula(newWs, rDoanhSo0, COL_VACOM.DAI_LY_DUOC_HUONG, addrCongDoanh)

  // ✅ % thưởng = SUM các ô tổng khu của cột I (HH5) -> =SUM(I12,I16,I18,I20,I22)
  const formulaThuong = sumCells(sectionTitleRows, COL_VACOM.HH_THUONG_5)
  setFormula(newWs, rThuong0, COL_VACOM.DAI_LY_DUOC_HUONG, formulaThuong)

  // Tổng thực thu = H25 + H26
  const addrDoanhH = XLSX.utils.encode_cell({
    r: rDoanhSo0,
    c: COL_VACOM.DAI_LY_DUOC_HUONG,
  })
  const addrThuongH = XLSX.utils.encode_cell({
    r: rThuong0,
    c: COL_VACOM.DAI_LY_DUOC_HUONG,
  })
  setFormula(
    newWs,
    rTongThucThu0,
    COL_VACOM.DAI_LY_DUOC_HUONG,
    `${addrDoanhH}+${addrThuongH}`
  )

  // style bảng tới dòng CỘNG
  ensureRefIncludes(newWs, rCong0, maxC)
  const rowsMeta = (((newWs as any)["!rows"] || []) as any[]).slice()
  rowsMeta[rCong0] = { ...(rowsMeta[rCong0] || {}), hpt: 20 }
  ;(newWs as any)["!rows"] = rowsMeta

  applyVacomHdStyles(newWs, {
    headerRows0: [8, 9, 10],
    sectionTitleRows0: [rA2, rB2, rC2, rE2, rD3],
    dataStartRow0: startA,
    dataEndRow0: rCong0,
  })

  const resolvedMonth = monthPicked || monthKey(filteredRows[0]?.[H_NGAY])
  applyTopHeader(newWs, dealerPicked, resolvedMonth)
  applyTailMonth(newWs, resolvedMonth)
  applyHcmDateNow(newWs, new Date())

  const sectionRows = [rA2, rB2, rC2, rE2, rD3]
  for (const r0 of sectionRows) {
    forceLeftTitleRow(newWs, r0, 0, 2)
    centerTotalsOnSectionRow(newWs, r0)
  }

  styleCongRow(newWs, rCong0)
  styleTailBlockBold(newWs)
  styleSignArea(newWs)

  const outWb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(outWb, newWs, templateSheetName)

  const timestamp = new Date().toISOString().slice(0, 10).replace(/-/g, "")
  const fnameDealer = normalize(dealerPicked).slice(0, 60)
  const fnameMonth = monthPicked ? `-${monthPicked.replace("/", "")}` : ""
  const fnameCat = categoryPicked
    ? `-${normalize(categoryPicked).slice(0, 30)}`
    : ""
  const filename = `VACOM-HD-${fnameDealer}${fnameMonth}${fnameCat}-${timestamp}.xlsx`

  log("✅ BUILT VACOM", { dealerPicked, rows: filteredRows.length, filename })

  return { outWb, filename, sheetName: templateSheetName }
}
