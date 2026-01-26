"use client"

import * as XLSX from "xlsx-js-style"
import type { ExcelRow } from "@/utils/excel"
import { normalize } from "@/utils/excel"
import {
  addLogoToA1_OOXML,
  downloadArrayBuffer,
  fetchPngAsBase64,
} from "@/lib/logo"

import { buildThuGiaVonSheetForDealer } from "./thugiavoncontroller"
import { sanitizeSheetName, uniqueSheetName } from "./thugiavon.excel"

export type ExportArgs = {
  templateWorkbook: XLSX.WorkBook
  salesHeaders: string[]
  sheetName?: string
  salesRows: ExcelRow[]
  filter: { dealerName: string; category?: string }
  onLog?: (...args: any[]) => void
}

const SHEET_TEMPLATE_NAME = "MẪU THU GIÁ VỐN"

export async function exportThuGiaVonXlsx({
  templateWorkbook,
  salesRows,
  filter,
  onLog,
  sheetName,
}: ExportArgs) {
  const log = onLog || (() => {})
  const dealerPickedRaw = String(filter?.dealerName ?? "").trim()
  const categoryPicked = String(filter?.category ?? "").trim()

  if (!salesRows.length) throw new Error("Không có dữ liệu doanh số")

  const pickedSheetName =
    sheetName && templateWorkbook.SheetNames.includes(sheetName)
      ? sheetName
      : SHEET_TEMPLATE_NAME

  const isAll =
    dealerPickedRaw === "__ALL__" ||
    normalize(dealerPickedRaw) === normalize("tất cả")

  const dealers: string[] = isAll
    ? Array.from(
        new Set(
          salesRows
            .map((r: any) => String(r["Tên đại lý"] ?? "").trim())
            .filter(Boolean)
        )
      ).sort((a, b) => a.localeCompare(b, "vi"))
    : [dealerPickedRaw]

  if (!dealers.length) throw new Error("Bạn chưa chọn đại lý")

  const outWb = XLSX.utils.book_new()

  let appended = 0
  const errors: string[] = []
  const appendedSheetNames: string[] = []

  for (const dealerPicked of dealers) {
    try {
      const built = buildThuGiaVonSheetForDealer({
        templateWorkbook,
        templateSheetName: pickedSheetName,
        salesRows,
        dealerPicked,
        categoryPicked: categoryPicked || undefined,
        onLog,
      })

      if (!built) continue

      const outSheetName = uniqueSheetName(outWb, built.outSheetNameBase)
      XLSX.utils.book_append_sheet(outWb, built.ws, outSheetName)

      appendedSheetNames.push(outSheetName)
      appended++
    } catch (e: any) {
      errors.push(`[${dealerPicked}] ${e?.message ?? String(e)}`)
    }
  }

  if (appended === 0) {
    const detail = errors.length
      ? `\n\nChi tiết:\n- ${errors.join("\n- ")}`
      : ""
    throw new Error(
      isAll
        ? `Không có dữ liệu để xuất cho bất kỳ đại lý nào.${detail}`
        : `Không có dữ liệu cho đại lý "${dealers[0]}"${
            categoryPicked ? ` với danh mục "${categoryPicked}"` : ""
          }.${detail}`
    )
  }

  if (isAll && errors.length) log("⚠️ Some dealers failed:", errors)

  const timestamp = new Date().toISOString().slice(0, 10).replace(/-/g, "")
  ;(outWb as any).Workbook = (outWb as any).Workbook || {}
  ;(outWb as any).Workbook.CalcPr = { fullCalcOnLoad: true }

  const fileName = isAll
    ? `MAU-THU-GIA-VON-ALL-${timestamp}.xlsx`
    : `MAU-THU-GIA-VON-${sanitizeSheetName(dealers[0])}-${timestamp}.xlsx`

  // 1) write workbook
  const xlsxBuf = XLSX.write(outWb, {
    bookType: "xlsx",
    type: "array",
  }) as ArrayBuffer

  // 2) load logo
  const logoBase64 = await fetchPngAsBase64("/images/logo_minvoice.png")

  // 3) patch OOXML add logo for EACH sheet
  let buf = xlsxBuf
  for (const sn of appendedSheetNames) {
    buf = await addLogoToA1_OOXML(buf, sn, logoBase64, {
      widthPx: 150,
      heightPx: 85,
    })
  }

  // 4) download
  downloadArrayBuffer(buf, fileName)
}
