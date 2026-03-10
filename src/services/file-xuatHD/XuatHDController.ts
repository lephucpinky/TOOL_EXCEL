import * as XLSX from "xlsx-js-style"
import {
  applyTotalRowXuatHD,
  buildHeaderMapHD,
  clearDataBlockXuatHD,
  ensureDataRowsSpaceXuatHD,
  fillDataRowsXuatHD,
  resolveTemplateRowsXuatHD,
  validateHeaderMapHD,
} from "./XuatHDExcel"
import {
  applyHeaderDealerMonthXuatHD,
  applySignDateXuatHD,
  applyXuatHDTableStyle,
  formatAllNumbersXuatHD,
  pickSheetNameXuatHD,
  setColumnWidthsXuatHD,
} from "./XuatHDStyle"

export type XuatHDBuildInput = {
  workbook: XLSX.WorkBook
  templateSheetName?: string
  salesHeaders: string[]
  dataRows: any[]
  dealerName: string
  month?: string | number | Date
  signDate?: Date
}

export const buildXuatHDSheet = ({
  workbook,
  templateSheetName,
  salesHeaders,
  dataRows,
  dealerName,
  signDate,
}: XuatHDBuildInput) => {
  const sheetName = pickSheetNameXuatHD(workbook, templateSheetName)
  if (!sheetName) throw new Error("Không tìm thấy sheet mẫu xuất hóa đơn")

  const ws = workbook.Sheets[sheetName]
  if (!ws) throw new Error(`Không tìm thấy worksheet: ${sheetName}`)

  const headerMap = buildHeaderMapHD(salesHeaders)
  validateHeaderMapHD(headerMap)

  let rows = resolveTemplateRowsXuatHD(ws)
  rows = ensureDataRowsSpaceXuatHD(ws, rows, dataRows.length)

  clearDataBlockXuatHD(ws, rows)
  setColumnWidthsXuatHD(ws)
  applyHeaderDealerMonthXuatHD(ws, dealerName)

  fillDataRowsXuatHD(ws, rows, dataRows, headerMap)
  applyTotalRowXuatHD(ws, rows, dataRows.length)

  applyXuatHDTableStyle(ws, rows)
  formatAllNumbersXuatHD(ws, rows)
  applySignDateXuatHD(ws, rows.rSignDate, signDate)

  return {
    workbook,
    worksheet: ws,
    sheetName,
    rows,
    headerMap,
  }
}
