"use client"

import * as XLSX from "xlsx-js-style"
import type { ExcelRow } from "../../utils/excel"
import { findSheetName, normalize, monthKey } from "../../utils/excel"
import {
  downloadArrayBuffer,
  fetchPngAsBase64,
  addLogoToA1_OOXML,
} from "@/lib/logo"

import { buildVacomHdSheetForDealer } from "./vacom.controller"

export type ExportArgs = {
  templateWorkbook: XLSX.WorkBook
  salesRows: ExcelRow[]
  salesHeaders: string[]
  filter: {
    dealerName: string // "" hoặc "__ALL__" => tất cả
    category?: string
    month?: string // "MM/YYYY"
  }
  sheetName?: string
  onLog?: (...args: any[]) => void
}

export async function exportVacomHdXlsx(args: ExportArgs) {
  const { templateWorkbook, salesHeaders, salesRows, onLog } = args
  const log = onLog || (() => {})

  if (!templateWorkbook || !salesHeaders?.length || !salesRows?.length) {
    throw new Error("Thiếu file mẫu hoặc file doanh số")
  }

  const realName =
    args.sheetName && templateWorkbook.SheetNames.includes(args.sheetName)
      ? args.sheetName
      : findSheetName(templateWorkbook, "MẪU VACOM HD")

  if (!realName) throw new Error("❌ Không tìm thấy sheet: MẪU VACOM HD")

  const dealerPickedRaw = String(args.filter?.dealerName ?? "").trim()
  const exportAllDealers = !dealerPickedRaw || dealerPickedRaw === "__ALL__"

  // build header index 1 lần cho toàn bộ export
  // NOTE: builder sẽ tự pickHeader theo index
  const dealers = exportAllDealers
    ? Array.from(
        new Set(
          salesRows
            .map((r: any) =>
              String(r["Tên đại lý"] ?? r["Đại lý"] ?? r["Dealer"] ?? "").trim()
            )
            .filter(Boolean)
        )
      ).sort((a, b) => a.localeCompare(b, "vi"))
    : [dealerPickedRaw]

  if (!dealers.length)
    throw new Error("❌ Không tìm được danh sách đại lý để xuất")

  // load logo 1 lần
  const logoBase64 = await fetchPngAsBase64("/images/logo_minvoice.png")

  for (const dealerPicked of dealers) {
    const built = buildVacomHdSheetForDealer({
      templateWorkbook,
      templateSheetName: realName,
      salesHeaders,
      salesRows,
      dealerPicked,
      categoryPicked: String(args.filter?.category ?? "").trim(),
      monthPicked: String(args.filter?.month ?? "").trim(),
      onLog: log,
    })

    if (!built) {
      log("SKIP (no data)", { dealerPicked })
      continue
    }

    const { outWb, filename, sheetName } = built

    const xlsxBuf = XLSX.write(outWb, {
      bookType: "xlsx",
      type: "array",
    }) as ArrayBuffer
    const finalBuf = await addLogoToA1_OOXML(xlsxBuf, sheetName, logoBase64, {
      widthPx: 150,
      heightPx: 85,
    })

    downloadArrayBuffer(finalBuf, filename)
  }
}
