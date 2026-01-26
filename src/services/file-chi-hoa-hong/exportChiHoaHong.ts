"use client"

import * as XLSX from "xlsx-js-style"

import {
  downloadArrayBuffer,
  fetchPngAsBase64,
  addLogoToA1_OOXML,
} from "@/lib/logo"
import { COL_HOA_HONG } from "@/constants/Mauhoahong"
import {
  deepCloneSheet,
  ExcelRow,
  findSheetName,
  normalize,
} from "@/utils/excel"

import {
  buildSalesIndex,
  pickHeaderFromIndex,
  resolveTemplateRows,
  ensureAllSectionsHaveSpace,
  clearAllSectionBlocks,
  fillAllSections,
  compactSections,
  applyAllSectionSums,
  applyGrandTotal,
} from "./hoahongcontroller"

import {
  applyHeaderDealerMonth,
  applyFooterFormulasAndHighlight,
  applyHoaHongTableStyle,
  formatAllNumbers,
  boldFooterBlock,
} from "./hoahong.style"

import {
  extractAgencyNameFromTemplate,
  getExemptTncnAgentsClient,
  setColumnWidthsHoaHong,
} from "./hoahong.excel"

export type ExportArgs = {
  templateWorkbook: XLSX.WorkBook
  salesHeaders: string[]
  salesRows: ExcelRow[]
  sheetName?: string
  filter: { dealerName: string; category?: string; month?: string }
  onLog?: (msg: string, ...rest: any[]) => void
}

export async function exportChiHoaHongXlsx(args: ExportArgs) {
  const { templateWorkbook, salesHeaders, salesRows, filter } = args
  const log = args.onLog || (() => {})

  if (!templateWorkbook) throw new Error("Thiếu file mẫu")
  if (!Array.isArray(salesRows) || salesRows.length === 0)
    throw new Error("Thiếu dữ liệu doanh thu")
  if (!filter?.dealerName) throw new Error("❌ Thiếu filter.dealerName")

  // 1) resolve sheet template
  const realName =
    args.sheetName && templateWorkbook.SheetNames.includes(args.sheetName)
      ? args.sheetName
      : findSheetName(templateWorkbook, "MẪU CHI HOA HỒNG")

  if (!realName) throw new Error("❌ Không tìm thấy sheet: MẪU CHI HOA HỒNG")

  const templateWs = templateWorkbook.Sheets[realName]
  if (!templateWs) throw new Error("❌ Không đọc được sheet HOA HỒNG")

  // 2) header index -> map columns
  const index = buildSalesIndex(salesHeaders)
  const pick = (...aliases: string[]) => pickHeaderFromIndex(index, ...aliases)

  const H = {
    LOAI: pick("Loại sản phẩm"),
    NGAY: pick("Ngày tháng", "Ngày phát sinh"),
    MST: pick("MST"),
    TEN: pick("Tên công ty", "Tên khách hàng", "Tên Khách hàng"),
    SL: pick("SL phát hành", "Số lượng phát hành"),
    TIEN: pick("Tổng tiền xuất HD"),
    GIAPP: pick("GIÁ PP ( TIỀN GỐC)", "GIÁ PP (TIỀN GỐC)", "GIÁ PP"),
    CHENH: pick("Số tiền chênh", "Số Tiền chênh"),
    DTK: pick("Doanh thu khác"),
    HH_PERCENT: pick("TỶ LỆ HOA HỒNG", "Tỷ lệ hoa hồng"),
    PHI_TRA: pick("Phí viết chênh (Minvoice trả)"),
    HOA_HONG: pick("Hoa hồng đối tác", "Hoa hồng"),
    MI_THU: pick("Số tiền M-invoice Thu"),
    CHENH_TT: pick("Chênh lệch thanh toán"),
    GHICHU: pick("Ghi chú"),
    DEALER: pick("Tên đại lý", "Đại lý", "Dealer"),
    CATEGORY: pick("Danh mục", "Category") || pick("Loại sản phẩm"),
  }

  const missing: string[] = []
  ;[
    ["Loại sản phẩm", H.LOAI],
    ["Ngày tháng/Ngày phát sinh", H.NGAY],
    ["MST", H.MST],
    ["Tên công ty", H.TEN],
    ["SL phát hành", H.SL],
    ["Tổng tiền xuất HD", H.TIEN],
    ["GIÁ PP", H.GIAPP],
    ["Số tiền chênh", H.CHENH],
    ["Doanh thu khác", H.DTK],
    ["TỶ LỆ HOA HỒNG", H.HH_PERCENT],
    ["Phí viết chênh", H.PHI_TRA],
    ["Hoa hồng", H.HOA_HONG],
    ["Số tiền M-invoice Thu", H.MI_THU],
    ["Chênh lệch thanh toán", H.CHENH_TT],
    ["Tên đại lý", H.DEALER],
  ].forEach(([label, v]) => {
    if (!v) missing.push(label as string)
  })
  if (missing.length)
    throw new Error("❌ Thiếu cột trong file doanh thu: " + missing.join(", "))

  // 3) filter rows
  const wantedDealer = normalize(filter.dealerName || "")
  const wantedCategory = normalize(filter.category || "")
  const filteredRows = salesRows.filter((row: any) => {
    if (normalize(row[H.DEALER]) !== wantedDealer) return false
    if (!wantedCategory) return true
    return normalize(row[H.CATEGORY]) === wantedCategory
  })
  if (!filteredRows.length) {
    throw new Error(
      `❌ Không có dữ liệu sau lọc: dealer="${filter.dealerName}" category="${filter.category ?? ""}"`
    )
  }

  // 4) clone sheet
  const ws = deepCloneSheet(templateWs)
  setColumnWidthsHoaHong(ws)

  // 5) locate rows
  let rows = resolveTemplateRows(ws)

  // 6) header dealer + month
  applyHeaderDealerMonth(ws, filter.dealerName, filter.month)

  // 7) ensure space bottom-up
  const grouped = ensureAllSectionsHaveSpace(ws, rows, filteredRows, H.LOAI)

  // 8) clear placeholders (keep style) + unmerge
  clearAllSectionBlocks(ws, rows)

  // 9) fill data
  fillAllSections(ws, rows, grouped, H)

  // ✅ 9.5) compact xoá dòng trống giữa khu (giống VACOM)
  rows = compactSections(ws, grouped)

  // 10) sums
  applyAllSectionSums(ws, rows, grouped)
  applyGrandTotal(ws, rows)
  const agencyName = extractAgencyNameFromTemplate(ws)
  const exemptSet = await getExemptTncnAgentsClient()
  const isTncnExempt = exemptSet.has(normalize(agencyName))
  // 11) footer formulas + yellow highlight
  const { rowTongCong } = applyFooterFormulasAndHighlight(ws, rows.rTOTAL, {
    isTncnExempt,
  })

  // 12) style table + numbers + footer bold
  applyHoaHongTableStyle(ws, rows)
  formatAllNumbers(ws)
  boldFooterBlock(ws, rows.rTOTAL, rowTongCong)

  // 13) output + logo + download
  const outWb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(outWb, ws, realName)

  const now = new Date()
  const timestamp = now.toISOString().slice(0, 10).replace(/-/g, "")
  const safeDealer = String(filter.dealerName)
    .replace(/[\\/:*?"<>|]+/g, "-")
    .trim()
  const fileName = `CHI-HOA-HONG-${safeDealer}-${timestamp}.xlsx`

  const xlsxBuf = XLSX.write(outWb, {
    bookType: "xlsx",
    type: "array",
  }) as ArrayBuffer
  const logoBase64 = await fetchPngAsBase64("/images/logo_minvoice.png")
  const finalBuf = await addLogoToA1_OOXML(xlsxBuf, realName, logoBase64, {
    widthPx: 150,
    heightPx: 85,
  })

  downloadArrayBuffer(finalBuf, fileName)
  log("✅ Export OK", { fileName, rows: filteredRows.length })
}
