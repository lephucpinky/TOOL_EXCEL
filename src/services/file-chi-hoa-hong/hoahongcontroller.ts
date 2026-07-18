import * as XLSX from "xlsx-js-style"
import {
  applyAllSectionSumsHoaHong,
  applyGrandTotalHoaHong,
  buildHeaderMapHH,
  clearAllSectionBlocksHoaHong,
  compactSectionsHoaHong,
  ensureAllSectionsHaveSpaceHoaHong,
  fillAllSectionsHoaHong,
  pickSheetNameChiHoaHong,
  resolveTemplateRowsHoaHong,
  validateHeaderMapHH,
  extractAgencyNameFromTemplate,
  setColumnWidthsHoaHong,
} from "./hoahong.excel"
import {
  applyFooterFormulasAndHighlight,
  applyHeaderDealerMonth,
  applyHoaHongTableStyle,
  boldFooterBlock,
  formatAllNumbers,
} from "./hoahong.style"
import { normalize } from "@/utils/excel"

export type ChiHoaHongBuildInput = {
  workbook: XLSX.WorkBook
  templateSheetName?: string
  salesHeaders: string[]
  dataRows: any[]
  dealerName: string
  month?: string | number | Date
  signDate?: Date
  exemptTncnSet?: Set<string>
}

export const buildHoaHongSheet = ({
  workbook,
  templateSheetName,
  salesHeaders,
  dataRows,
  dealerName,
  exemptTncnSet,
}: ChiHoaHongBuildInput) => {
  const sheetName = pickSheetNameChiHoaHong(workbook, templateSheetName)
  if (!sheetName) throw new Error("Không tìm thấy sheet mẫu chi hoa hồng")

  const ws = workbook.Sheets[sheetName]
  if (!ws) throw new Error(`Không tìm thấy worksheet: ${sheetName}`)

  const headerMap = buildHeaderMapHH(salesHeaders, dataRows)
  validateHeaderMapHH(headerMap)
  const productSectionHeader =
    headerMap.PRODUCT_SECTION || headerMap.LOAI_CODE || headerMap.LOAI

  let rows = resolveTemplateRowsHoaHong(ws)
  const grouped = ensureAllSectionsHaveSpaceHoaHong(
    ws,
    dataRows,
    productSectionHeader
  )

  rows = resolveTemplateRowsHoaHong(ws)
  rows = compactSectionsHoaHong(ws, grouped)

  clearAllSectionBlocksHoaHong(ws, rows)
  setColumnWidthsHoaHong(ws, rows)
  applyHeaderDealerMonth(ws, dealerName)

  fillAllSectionsHoaHong(ws, rows, grouped, headerMap)
  applyAllSectionSumsHoaHong(ws, rows, grouped)
  applyGrandTotalHoaHong(ws, rows)

  const agencyName = extractAgencyNameFromTemplate(ws)
  const isTncnExempt = !!exemptTncnSet?.has(normalize(agencyName))
  const { rowTongCong } = applyFooterFormulasAndHighlight(ws, rows.rTOTAL, {
    isTncnExempt,
  })

  applyHoaHongTableStyle(ws, rows)
  formatAllNumbers(ws)
  boldFooterBlock(ws, rows.rTOTAL, rowTongCong)

  return {
    workbook,
    worksheet: ws,
    sheetName,
    rows,
    headerMap,
    grouped,
  }
}
