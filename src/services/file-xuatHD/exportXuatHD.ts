"use client"

import * as XLSX from "xlsx-js-style"
import { normalize } from "@/utils/excel"
import { buildXuatHDSheet } from "./XuatHDController"
import {
  fetchPngAsBase64,
  addLogoToA1_OOXML,
  downloadArrayBuffer,
} from "@/lib/logo"

export type ExportXuatHoaDonInput = {
  templateWorkbook: XLSX.WorkBook
  salesHeaders: string[]
  salesRows: any[]
  filter?: {
    dealerName?: string
  }
  templateSheetName?: string
  fileName?: string
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

const pickField = (row: any, aliases: string[]) => {
  const idx = new Map<string, string>()

  for (const key of Object.keys(row || {})) {
    idx.set(normalize(key), key)
  }

  for (const alias of aliases) {
    const hit = idx.get(normalize(alias))
    if (hit) return row[hit]
  }

  return undefined
}

const sanitizeFileNamePart = (value: string) =>
  String(value || "")
    .replace(/[\\/:*?"<>|]+/g, "-")
    .replace(/\s+/g, " ")
    .trim()

export async function exportXuatHoaDonXlsx({
  templateWorkbook,
  salesHeaders,
  salesRows,
  filter,
  templateSheetName,
  fileName,
}: ExportXuatHoaDonInput) {
  if (!templateWorkbook) throw new Error("Thiếu file mẫu xuất hóa đơn")
  if (!Array.isArray(salesRows) || salesRows.length === 0) {
    throw new Error("Không có dữ liệu theo dõi doanh số")
  }

  const workbook = cloneWorkbook(templateWorkbook)
  const dealerName = String(filter?.dealerName ?? "__ALL__").trim()

  const filteredRows = salesRows.filter((row: any) => {
    const dealerValue = String(
      pickField(row, ["Đại Lý", "ĐẠI LÝ", "Tên đại lý"]) ?? ""
    ).trim()

    return dealerName === "__ALL__" || !dealerName || dealerValue === dealerName
  })

  if (filteredRows.length === 0) {
    throw new Error("Không có dữ liệu phù hợp với đại lý đã chọn")
  }

  const { sheetName } = buildXuatHDSheet({
    workbook,
    templateSheetName,
    salesHeaders,
    dataRows: filteredRows,
    dealerName: dealerName === "__ALL__" ? "" : dealerName,
    signDate: new Date(),
  })

  const out = XLSX.write(workbook, {
    type: "array",
    bookType: "xlsx",
  }) as ArrayBuffer

  const logoBase64 = await fetchPngAsBase64("/images/logo_minvoice.png")

  const finalBuf = await addLogoToA1_OOXML(out, sheetName, logoBase64, {
    widthPx: 100,
    heightPx: 55,
    col: 0,
    row: 0,
    colOffPx: 0,
    rowOffPx: 10,
  })

  const safeDealer =
    dealerName && dealerName !== "__ALL__"
      ? sanitizeFileNamePart(dealerName)
      : "tat-ca"

  downloadArrayBuffer(finalBuf, fileName || `Xuat-hoa-don-${safeDealer}.xlsx`)
}
