import * as XLSX from "xlsx-js-style"
import { normalize } from "@/utils/excel"
import { buildXuatHDSheet } from "./XuatHDController"

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

const downloadArrayBuffer = (data: ArrayBuffer, fileName: string) => {
  const blob = new Blob([data], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = fileName
  a.click()
  URL.revokeObjectURL(url)
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
      pickField(row, ["Đại Lý", "ĐẠI LÝ", "Dealer", "Tên đại lý"]) ?? ""
    ).trim()

    const okDealer =
      dealerName === "__ALL__" || !dealerName || dealerValue === dealerName

    return okDealer
  })

  if (filteredRows.length === 0) {
    throw new Error("Không có dữ liệu phù hợp với đại lý / tháng đã chọn")
  }

  buildXuatHDSheet({
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

  downloadArrayBuffer(
    out,
    fileName ||
      `Xuat-hoa-don
      }.xlsx`
  )
}
