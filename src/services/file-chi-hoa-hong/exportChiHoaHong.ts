"use client"

import JSZip from "jszip"
import * as XLSX from "xlsx-js-style"

import {
  fetchPngAsBase64,
  addLogoToA1_OOXML,
  downloadArrayBuffer,
} from "@/lib/logo"
import { deepCloneSheet, ExcelRow, normalize } from "@/utils/excel"

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
  applyHoaHongTableStyle,
  formatAllNumbers,
  applyHeaderDealerMonth,
  boldFooterBlock,
  applyFooterFormulasAndHighlight,
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
  filter: { dealerName: string; category?: string }
  onLog?: (msg: string, ...rest: any[]) => void
}

const downloadBlob = (blob: Blob, name: string) => {
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = name
  a.click()
  URL.revokeObjectURL(url)
}

export async function exportChiHoaHongXlsx(args: ExportArgs) {
  const { templateWorkbook, salesHeaders, salesRows, filter } = args
  const log = args.onLog || (() => {})

  if (!templateWorkbook) throw new Error("Thiếu file mẫu")
  if (!Array.isArray(salesRows) || salesRows.length === 0)
    throw new Error("Thiếu dữ liệu doanh thu")
  if (!filter?.dealerName) throw new Error("❌ Thiếu filter.dealerName")

  const norm = (v: any) => normalize(v ?? "")

  const pickSheetName = () => {
    if (args.sheetName && templateWorkbook.SheetNames.includes(args.sheetName))
      return args.sheetName

    const candidates = [
      "MẪU CHI HOA HỒNG",
      "CHI HOA HONG",
      "HOA HONG",
      "Sheet1",
    ]
    const names = templateWorkbook.SheetNames.map((raw) => ({
      raw,
      n: norm(raw),
    }))

    for (const c of candidates) {
      const want = norm(c)
      const hit = names.find((x) => x.n.includes(want))
      if (hit) return hit.raw
    }
    return templateWorkbook.SheetNames[0] || ""
  }

  const realName = pickSheetName()
  if (!realName) throw new Error("❌ Không có sheet nào trong file mẫu")

  const templateWs = templateWorkbook.Sheets[realName]
  if (!templateWs)
    throw new Error(`❌ Không đọc được sheet template: ${realName}`)

  // header index -> map columns
  const index = buildSalesIndex(salesHeaders)
  const pick = (...aliases: string[]) => pickHeaderFromIndex(index, ...aliases)
  const headers = (salesHeaders || []).filter(Boolean).map(String)
  const sampleN = Math.min(200, salesRows.length)

  // ✅ Pick đúng cột TIỀN HOA HỒNG (tránh nhầm %)
  const pickTienHoaHong = () => {
    const moneyLabel = norm("TIỀN HOA HỒNG")
    const byMoneyName = headers.find((h) => norm(h).includes(moneyLabel))
    if (byMoneyName) return byMoneyName

    const hhMoney = headers.find((h) => {
      const raw = String(h).toLowerCase()
      const s = norm(h)

      const looksLikeHH =
        s === norm("hh") ||
        s === norm("tien hoa hong") ||
        s.includes(norm("hoa hong"))

      const isPercent =
        raw.includes("%") ||
        s.includes(norm("phan tram")) ||
        s.includes(norm("percent")) ||
        s.includes(norm("ty le")) ||
        s.includes(norm("ti le"))

      return looksLikeHH && !isPercent
    })
    if (hhMoney) return hhMoney

    return pick("TIỀN HOA HỒNG", "TIEN HOA HONG", "HH")
  }

  // ✅ Pick đúng cột LOẠI SP / TÊN SP để phân khu (ưu tiên cột có HD/CKS/ICA...)
  const pickLoaiSanPham = () => {
    const candidates = headers.filter((h) => {
      const nh = norm(h)
      return (
        nh.includes(norm("tên sp")) ||
        nh.includes(norm("ten sp")) ||
        nh.includes(norm("loại sp")) ||
        nh.includes(norm("loai sp"))
      )
    })

    if (!candidates.length)
      return pick("TÊN SP", "Tên SP", "LOẠI SP", "Loại sản phẩm")
    if (candidates.length === 1) return candidates[0]

    const score = (header: string) => {
      let sc = 0
      for (let i = 0; i < sampleN; i++) {
        const v = String((salesRows[i] as any)?.[header] ?? "")
        const s = norm(v)
        if (!s) continue

        const hit =
          s === norm("HD") ||
          s === norm("MTT") ||
          s === norm("TNCN") ||
          s === norm("BHXH") ||
          s === norm("SMI") ||
          s === norm("CKS") ||
          s.startsWith(norm("ICA")) ||
          s.includes("hddt") ||
          (s.includes("hoadon") && s.includes("dientu")) ||
          s.includes("maytinhtien")

        if (hit) sc += 5
        if (s.length <= 5) sc += 1
      }
      return sc
    }

    return candidates.sort((a, b) => score(b) - score(a))[0]
  }

  // ✅ cột code: HD/CKS/TH/PM... (tương ứng cột P)
  const pickLoaiCode = () => {
    const candidates = headers.filter((h) => norm(h).includes(norm("tên sp")))
    if (!candidates.length) return pick("TÊN SP")

    const score = (header: string) => {
      let sc = 0
      for (let i = 0; i < sampleN; i++) {
        const v = String((salesRows[i] as any)?.[header] ?? "")
        const s = norm(v)
        if (!s) continue

        if (
          s === norm("HD") ||
          s === norm("CKS") ||
          s === norm("TH") ||
          s === norm("PM")
        )
          sc += 5
        if (s.length <= 4) sc += 1

        if (
          s.startsWith(norm("ICA")) ||
          s.startsWith(norm("INT")) ||
          s.includes("KIOT") ||
          s === norm("MTT")
        )
          sc -= 3
      }
      return sc
    }

    return candidates.sort((a, b) => score(b) - score(a))[0]
  }

  // ✅ cột chi tiết: MTT/INT1/KIOT/ICA1... (tương ứng cột O vàng)
  const pickTenSpVangO = (loaiCodeHeader: string) => {
    const candidates = headers.filter((h) => norm(h).includes(norm("tên sp")))
    if (!candidates.length) return ""

    const others = candidates.filter((h) => h !== loaiCodeHeader)
    const pool = others.length ? others : candidates

    const score = (header: string) => {
      let sc = 0
      for (let i = 0; i < sampleN; i++) {
        const v = String((salesRows[i] as any)?.[header] ?? "")
        const s = norm(v)
        if (!s) continue

        if (
          s.startsWith(norm("ICA")) ||
          s.startsWith(norm("INT")) ||
          s.startsWith(norm("TOKEN")) ||
          s.includes("KIOT") ||
          s === norm("MTT")
        )
          sc += 5

        if (
          s === norm("HD") ||
          s === norm("CKS") ||
          s === norm("TH") ||
          s === norm("PM")
        )
          sc -= 4
      }
      return sc
    }

    return pool.sort((a, b) => score(b) - score(a))[0]
  }

  const loaiCodeHeader = pickLoaiCode()

  const H = {
    LOAI: pickLoaiSanPham(),

    THANG: pick("THÁNG", "Tháng", "thang"),
    MST: pick("MST", "Mã số thuế"),
    TEN: pick("TÊN CTY", "TÊN CÔNG TY", "TÊN ĐƠN VỊ", "Tên công ty"),

    LOAI_CODE: loaiCodeHeader, // cột P (HD/CKS/TH/PM)
    LOAI_CKS_TEXT: pickTenSpVangO(loaiCodeHeader), // cột O (MTT/INT1/KIOT/ICA1)

    BANQUYEN: pick("BQ", "BẢN QUYỀN"),
    SL_MOI: pick("SL MỚI", "SLMOI"),
    SL_GH: pick("SL GH", "SLGH"),
    SL_TANG: pick("SL TẶNG", "SL TANG", "SLTANG"),

    DT_GOI_HD: pick("GÓI HÓA ĐƠN", "GOI HOA DON", "GÓI HĐ"),
    DT_KHAC: pick("KHÁC", "KHAC"),
    TRI_GIA_XUAT_HD: pick(
      "TỔNG XUẤT HD",
      "TONG XUAT HD",
      "TỔNG XUẤT HĐ",
      "tổng suất hd"
    ),

    VUOT_GIA: pick("VIẾT CHÊNH", "VIET CHENH", "VƯỢT GIÁ"),
    TIEN_HOA_HONG: pickTienHoaHong(),
    PHI_VIET_CHENH: pick(
      "DT VIẾT CHÊNH",
      "DT VIET CHENH",
      "T VIẾT CHÊNH",
      "T VIET CHENH",
      "PHÍ VIẾT CHÊNH",
      "PHI VIET CHENH",
      "PHAIRTRA CHÊNH",
      "PHAI TRA CHENH"
    ),

    // M-INV đã thu: từ cột "SỐ TIỀN"
    DT_MINVOICE: pick(
      "SỐ TIỀN",
      "SO TIEN",
      "SOTIEN",
      "SỐ TIỀN THU",
      "SO TIEN THU",
      "TIỀN THU",
      "TIEN THU"
    ),

    GHI_CHU: pick("CHI CHÚ", "CHI CHU", "GHI CHÚ", "GHI CHU"),
    DEALER: pick("Tên đại lý", "Đại lý", "Dealer"),
    CATEGORY: pick("PHÒNG BAN", "Danh mục", "Category") || "",
  }

  // ✅ validate đúng các cột cần thiết
  const missing: string[] = []
  ;[
    ["TÊN SP", H.LOAI],
    ["THÁNG KÍCH HOẠT", H.THANG],
    ["MST", H.MST],
    ["TÊN CTY", H.TEN],
    ["BQ", H.BANQUYEN],
    ["SL MỚI", H.SL_MOI],
    ["SL GH", H.SL_GH],
    ["SL TẶNG", H.SL_TANG],
    ["GÓI HÓA ĐƠN", H.DT_GOI_HD],
    ["KHÁC", H.DT_KHAC],
    ["TỔNG XUẤT HĐ", H.TRI_GIA_XUAT_HD],
    ["BQ", H.BANQUYEN],
    ["GÓI HÓA ĐƠN", H.DT_GOI_HD],
    ["VIẾT CHÊNH", H.VUOT_GIA],
    ["TIỀN HOA HỒNG", H.TIEN_HOA_HONG],
    ["DT VIẾT CHÊNH", H.PHI_VIET_CHENH],
    ["SỐ TIỀN", H.DT_MINVOICE],
    ["Đại Lý", H.DEALER],
  ].forEach(([label, v]) => {
    if (!v) missing.push(label as string)
  })
  if (missing.length)
    throw new Error(
      "❌ Thiếu cột trong file theo dõi doanh số: " + missing.join(", ")
    )

  // ALL dealers
  const dealerPickedRaw = String(filter.dealerName ?? "").trim()
  const isAll =
    dealerPickedRaw === "__ALL__" || norm(dealerPickedRaw) === norm("tất cả")

  const dealers: string[] = isAll
    ? Array.from(
        new Set(
          salesRows
            .map((r: any) => String(r[H.DEALER] ?? "").trim())
            .filter(Boolean)
        )
      ).sort((a, b) => a.localeCompare(b, "vi"))
    : [dealerPickedRaw]

  if (!dealers.length)
    throw new Error("❌ Không tìm được danh sách đại lý để xuất")

  const [logoBase64, exemptSet] = await Promise.all([
    fetchPngAsBase64("/images/logo_minvoice.png"),
    getExemptTncnAgentsClient(),
  ])

  const zip = isAll ? new JSZip() : null
  let zipCount = 0
  const errors: string[] = []
  const exportOneDealer = async (dealerName: string) => {
    const wantedDealer = norm(dealerName)

    const filteredRows = salesRows.filter(
      (row: any) => norm(row[H.DEALER]) === wantedDealer
    )
    if (!filteredRows.length)
      throw new Error(`Không có dữ liệu sau lọc: dealer="${dealerName}"`)

    const ws = deepCloneSheet(templateWs)
    setColumnWidthsHoaHong(ws)

    let rows = resolveTemplateRows(ws)

    applyHeaderDealerMonth(ws, dealerName)

    const grouped = ensureAllSectionsHaveSpace(ws, rows, filteredRows, H.LOAI)

    rows = resolveTemplateRows(ws)
    rows = compactSections(ws, grouped)
    rows = resolveTemplateRows(ws)

    clearAllSectionBlocks(ws, rows)

    fillAllSections(ws, rows, grouped, H)

    applyAllSectionSums(ws, rows, grouped)
    applyGrandTotal(ws, rows)

    const agencyName = extractAgencyNameFromTemplate(ws)
    const isTncnExempt = exemptSet.has(norm(agencyName))
    const { rowTongCong } = applyFooterFormulasAndHighlight(ws, rows.rTOTAL, {
      isTncnExempt,
    })

    applyHoaHongTableStyle(ws, rows)
    formatAllNumbers(ws)
    boldFooterBlock(ws, rows.rTOTAL, rowTongCong)

    const outWb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(outWb, ws, realName)

    const safeDealer = String(dealerName)
      .replace(/[\\/:*?"<>|]+/g, "-")
      .trim()
    const fileName = `CHI-HOA-HONG-${safeDealer}.xlsx`

    const xlsxBuf = XLSX.write(outWb, {
      bookType: "xlsx",
      type: "array",
    }) as ArrayBuffer
    const finalBuf = await addLogoToA1_OOXML(xlsxBuf, realName, logoBase64, {
      widthPx: 150,
      heightPx: 85,
    })

    return { finalBuf, fileName, rowCount: filteredRows.length }
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

  if (zip) {
    if (!zipCount) {
      const detail = errors.length
        ? `\n\nChi tiết:\n- ${errors.join("\n- ")}`
        : ""
      throw new Error(`❌ Không có file hợp lệ để nén.${detail}`)
    }
    if (errors.length) log("⚠️ Some dealers failed:", errors)

    const zipName = `CHI-HOA-HONG-ALL-.zip`
    const blob = await zip.generateAsync({ type: "blob" })
    downloadBlob(blob, zipName)
  }
}
