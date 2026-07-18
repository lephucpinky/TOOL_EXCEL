"use client"

import JSZip from "jszip"
import * as XLSX from "xlsx-js-style"
import {
  fetchPngAsBase64,
  addLogoToA1_OOXML,
  downloadArrayBuffer,
} from "@/lib/logo"
import { normalize, type ExcelRow } from "@/utils/excel"
import { buildHoaHongSheet } from "./hoahongcontroller"
import {
  buildHeaderMapHH,
  getExemptTncnAgentsClient,
  pickSheetNameChiHoaHong,
} from "./hoahong.excel"

export type ExportArgs = {
  templateWorkbook: XLSX.WorkBook
  salesHeaders: string[]
  salesRows: ExcelRow[]
  sheetName?: string
  filter: { dealerName: string; category?: string }
  onLog?: (msg: string, ...rest: any[]) => void
}

const cloneWorkbook = (wb: XLSX.WorkBook): XLSX.WorkBook => {
  const buf = XLSX.write(wb, {
    type: "array",
    bookType: "xlsx",
    cellStyles: true,
  })

  return XLSX.read(buf, {
    type: "array",
    cellStyles: true,
    cellNF: true,
    cellDates: true,
  })
}

const sanitizeFileNamePart = (value: string) =>
  String(value || "")
    .replace(/[\\/:*?"<>|]+/g, "-")
    .replace(/\s+/g, " ")
    .trim()

const downloadBlob = (blob: Blob, name: string) => {
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = name
  document.body.appendChild(a)
  a.click()
  a.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 0)
}

export async function exportChiHoaHongXlsx({
  templateWorkbook,
  salesHeaders,
  salesRows,
  sheetName,
  filter,
  onLog,
}: ExportArgs) {
  const log = onLog || (() => {})

  if (!templateWorkbook) throw new Error("Thiếu file mẫu")
  if (!Array.isArray(salesRows) || salesRows.length === 0) {
    throw new Error("Thiếu dữ liệu doanh thu")
  }
  if (!filter?.dealerName) throw new Error("❌ Thiếu filter.dealerName")

  const headerMap = buildHeaderMapHH(salesHeaders, salesRows)
  if (!headerMap.DEALER)
    throw new Error("❌ Thiếu cột Đại lý trong file doanh số")

  const exemptTncnSet = await getExemptTncnAgentsClient()
  const logoBase64 = await fetchPngAsBase64("/images/logo_minvoice.png")

  const dealerPickedRaw = String(filter.dealerName ?? "").trim()
  const isAll =
    dealerPickedRaw === "__ALL__" ||
    normalize(dealerPickedRaw) === normalize("tất cả")

  const dealers = isAll
    ? Array.from(
        new Set(
          salesRows
            .map((row: any) => String(row?.[headerMap.DEALER] ?? "").trim())
            .filter(Boolean)
        )
      )
    : [dealerPickedRaw]

  if (!dealers.length)
    throw new Error("Không tìm thấy đại lý phù hợp để xuất file")

  const realSheetName = pickSheetNameChiHoaHong(templateWorkbook, sheetName)
  if (!realSheetName) throw new Error("❌ Không có sheet nào trong file mẫu")

  const zip = dealers.length > 1 ? new JSZip() : null
  const errors: string[] = []
  let zipCount = 0

  const exportOneDealer = async (dealerName: string) => {
    const wantedDealer = normalize(dealerName)
    const filteredRows = salesRows.filter(
      (row: any) => normalize(row?.[headerMap.DEALER]) === wantedDealer
    )

    if (!filteredRows.length) {
      throw new Error(`Không có dữ liệu sau lọc: dealer=\"${dealerName}\"`)
    }

    const workbook = cloneWorkbook(templateWorkbook)

    const { sheetName: builtSheetName } = buildHoaHongSheet({
      workbook,
      templateSheetName: realSheetName,
      salesHeaders,
      dataRows: filteredRows,
      dealerName,
      exemptTncnSet,
    })

    const out = XLSX.write(workbook, {
      type: "array",
      bookType: "xlsx",
    }) as ArrayBuffer

    const finalBuf = await addLogoToA1_OOXML(out, builtSheetName, logoBase64, {
      widthPx: 100,
      heightPx: 55,
      col: 0,
      row: 0,
      colOffPx: 40,
      rowOffPx: 10,
    })

    const safeDealer = sanitizeFileNamePart(dealerName)
    return {
      finalBuf,
      fileName: `CHI-HOA-HONG-${safeDealer}.xlsx`,
      rowCount: filteredRows.length,
    }
  }

  for (const dealer of dealers) {
    try {
      const { finalBuf, fileName, rowCount } = await exportOneDealer(dealer)
      if (zip) {
        zip.file(fileName, finalBuf)
        zipCount++
      } else {
        downloadArrayBuffer(finalBuf, fileName)
      }
      log("✅ Export OK", { fileName, rows: rowCount })
    } catch (e: any) {
      errors.push(`[${dealer}] ${e?.message ?? String(e)}`)
    }
  }

  if (!zip && errors.length) {
    throw new Error(`❌ Xuất chi hoa hồng thất bại:\n- ${errors.join("\n- ")}`)
  }

  if (zip) {
    if (!zipCount) {
      const detail = errors.length
        ? `\n\nChi tiết:\n- ${errors.join("\n- ")}`
        : ""
      throw new Error(`❌ Không có file hợp lệ để nén.${detail}`)
    }

    if (errors.length) log("⚠️ Some dealers failed:", errors)

    const blob = await zip.generateAsync({ type: "blob" })
    downloadBlob(blob, "CHI-HOA-HONG-ALL.zip")
  }
}
