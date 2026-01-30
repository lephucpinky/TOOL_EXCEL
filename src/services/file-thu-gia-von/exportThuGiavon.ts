"use client"
import JSZip from "jszip"
import * as XLSX from "xlsx-js-style"
import type { ExcelRow } from "@/utils/excel"
import { normalize } from "@/utils/excel"
import { addLogoToA1_OOXML, fetchPngAsBase64 } from "@/lib/logo"

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

const downloadBlob = (blob: Blob, name: string) => {
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = name
  a.click()
  URL.revokeObjectURL(url)
}

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

  // load logo 1 lần
  const logoBase64 = await fetchPngAsBase64("/images/logo_minvoice.png")

  const timestamp = new Date().toISOString().slice(0, 10).replace(/-/g, "")

  // ✅ ALL => ZIP nhiều file, 1 dealer => tải lẻ
  const zip = isAll ? new JSZip() : null
  let zipCount = 0
  const errors: string[] = []

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

      // ✅ tạo workbook riêng cho dealer
      const wb = XLSX.utils.book_new()
      ;(wb as any).Workbook = (wb as any).Workbook || {}
      ;(wb as any).Workbook.CalcPr = { fullCalcOnLoad: true }

      const outSheetName = uniqueSheetName(wb, built.outSheetNameBase)
      XLSX.utils.book_append_sheet(wb, built.ws, outSheetName)

      const filename = `MAU-THU-GIA-VON-${sanitizeSheetName(dealerPicked)}-${timestamp}.xlsx`

      // write workbook
      const xlsxBuf = XLSX.write(wb, {
        bookType: "xlsx",
        type: "array",
      }) as ArrayBuffer

      // add logo for sheet
      const finalBuf = await addLogoToA1_OOXML(
        xlsxBuf,
        outSheetName,
        logoBase64,
        {
          widthPx: 150,
          heightPx: 85,
        }
      )

      if (zip) {
        zip.file(filename, finalBuf)
        zipCount++
      } else {
        // tải lẻ (1 dealer)
        downloadBlob(
          new Blob([finalBuf], {
            type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          }),
          filename
        )
      }
    } catch (e: any) {
      errors.push(`[${dealerPicked}] ${e?.message ?? String(e)}`)
    }
  }

  if (zip) {
    if (!zipCount) {
      const detail = errors.length
        ? `\n\nChi tiết:\n- ${errors.join("\n- ")}`
        : ""
      throw new Error(
        `Không có dữ liệu để xuất cho bất kỳ đại lý nào.${detail}`
      )
    }
    if (errors.length) log("⚠️ Some dealers failed:", errors)

    const zipName = `MAU-THU-GIA-VON-ALL-${timestamp}.zip`
    const blob = await zip.generateAsync({ type: "blob" })
    downloadBlob(blob, zipName)
  }
}
