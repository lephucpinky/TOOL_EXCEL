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
  filter: { dealerName: string; category?: string; month?: string }
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

  // ✅ resolve sheet template (không hardcode)
  const pickSheetName = () => {
    if (args.sheetName && templateWorkbook.SheetNames.includes(args.sheetName))
      return args.sheetName
    const candidates = [
      "MẪU CHI HOA HỒNG",
      "CHI HOA HONG",
      "HOA HONG",
      "Sheet1",
    ]
    const normNames = templateWorkbook.SheetNames.map((n) => ({
      raw: n,
      n: normalize(n),
    }))
    for (const c of candidates) {
      const want = normalize(c)
      const hit = normNames.find((x) => x.n.includes(want))
      if (hit) return hit.raw
    }
    return templateWorkbook.SheetNames[0] || ""
  }

  const realName = pickSheetName()
  if (!realName) throw new Error("❌ Không có sheet nào trong file mẫu")

  const templateWs = templateWorkbook.Sheets[realName]
  if (!templateWs)
    throw new Error(`❌ Không đọc được sheet template: ${realName}`)

  // 2) header index -> map columns (THEO FILE THEO DÕI DOANH SỐ)
  const index = buildSalesIndex(salesHeaders)
  const pick = (...aliases: string[]) => pickHeaderFromIndex(index, ...aliases)
  // ✅ Pick đúng cột TIỀN HOA HỒNG (HH tiền) - tránh nhầm sang % hoa hồng
  const pickTienHoaHong = () => {
    const hs = (salesHeaders || []).filter(Boolean).map(String)

    // Ưu tiên tiêu đề có "TIỀN HOA HỒNG"
    const byMoneyName = hs.find((h) =>
      normalize(h).includes(normalize("TIỀN HOA HỒNG"))
    )
    if (byMoneyName) return byMoneyName

    // Nếu chỉ ghi "HH" thì loại những cột có dấu % / tỷ lệ
    const hhMoney = hs.find((h) => {
      const raw = h.toLowerCase()
      const s = normalize(h)

      const looksLikeHH =
        s === normalize("hh") ||
        s === normalize("tien hoa hong") ||
        s.includes(normalize("hoa hong")) // phòng trường hợp "Hoa hồng"

      const isPercent =
        raw.includes("%") ||
        s.includes(normalize("phan tram")) ||
        s.includes(normalize("percent")) ||
        s.includes(normalize("ty le")) ||
        s.includes(normalize("ti le"))

      return looksLikeHH && !isPercent
    })
    if (hhMoney) return hhMoney

    // fallback cuối cùng
    return pick("TIỀN HOA HỒNG", "TIEN HOA HONG", "HH")
  }
  // ✅ Pick đúng cột LOẠI SP / TÊN SP để phân khu (ưu tiên cột có HD/CKS/ICA...)
  // Vì file doanh số có thể có 2 cột "TÊN SP"
  const pickLoaiSanPham = () => {
    const hs = (salesHeaders || []).filter(Boolean).map(String)

    // gom các header có thể là "TÊN SP" (kể cả bị suffix: _1, (2), ...)
    const candidates = hs.filter((h) => {
      const nh = normalize(h)
      return (
        nh.includes(normalize("tên sp")) ||
        nh.includes(normalize("ten sp")) ||
        nh.includes(normalize("loại sp")) ||
        nh.includes(normalize("loai sp"))
      )
    })

    // fallback nếu chỉ có 1 cột hoặc không tìm được
    if (!candidates.length)
      return pick("TÊN SP", "Tên SP", "LOẠI SP", "Loại sản phẩm")
    if (candidates.length === 1) return candidates[0]

    // chấm điểm theo dữ liệu: cột nào chứa HD/CKS/ICA/BHXH/MTT... thì ưu tiên
    const score = (header: string) => {
      let sc = 0
      const max = Math.min(200, salesRows.length)
      for (let i = 0; i < max; i++) {
        const v = String((salesRows[i] as any)?.[header] ?? "")
        const s = normalize(v)
        if (!s) continue

        const hit =
          s === normalize("HD") ||
          s === normalize("MTT") ||
          s === normalize("TNCN") ||
          s === normalize("BHXH") ||
          s === normalize("SMI") ||
          s === normalize("CKS") ||
          s.startsWith(normalize("ICA")) ||
          s.includes("hddt") ||
          (s.includes("hoadon") && s.includes("dientu")) ||
          s.includes("maytinhtien")

        if (hit) sc += 5
        if (s.length <= 5) sc += 1 // code ngắn thường là cột phân loại
      }
      return sc
    }

    return candidates.sort((a, b) => score(b) - score(a))[0]
  }
  // ✅ cột code: HD/CKS/TH/PM... (tương ứng cột P)
  const pickLoaiCode = () => {
    const hs = (salesHeaders || []).filter(Boolean).map(String)
    const candidates = hs.filter((h) =>
      normalize(h).includes(normalize("tên sp"))
    )
    if (!candidates.length) return pick("TÊN SP")

    const score = (header: string) => {
      let sc = 0
      const max = Math.min(200, salesRows.length)
      for (let i = 0; i < max; i++) {
        const v = String((salesRows[i] as any)?.[header] ?? "")
        const s = normalize(v)
        if (!s) continue
        if (
          s === normalize("HD") ||
          s === normalize("CKS") ||
          s === normalize("TH") ||
          s === normalize("PM")
        )
          sc += 5
        if (s.length <= 4) sc += 1
        if (
          s.startsWith(normalize("ICA")) ||
          s.startsWith(normalize("INT")) ||
          s.includes("KIOT") ||
          s === normalize("MTT")
        )
          sc -= 3
      }
      return sc
    }

    return candidates.sort((a, b) => score(b) - score(a))[0]
  }

  // ✅ cột chi tiết: MTT/INT1/KIOT/ICA1... (tương ứng cột O màu vàng)
  const pickTenSpVangO = (loaiCodeHeader: string) => {
    const hs = (salesHeaders || []).filter(Boolean).map(String)
    const candidates = hs.filter((h) =>
      normalize(h).includes(normalize("tên sp"))
    )
    if (!candidates.length) return ""

    const others = candidates.filter((h) => h !== loaiCodeHeader)
    const pool = others.length ? others : candidates

    const score = (header: string) => {
      let sc = 0
      const max = Math.min(200, salesRows.length)
      for (let i = 0; i < max; i++) {
        const v = String((salesRows[i] as any)?.[header] ?? "")
        const s = normalize(v)
        if (!s) continue
        if (
          s.startsWith(normalize("ICA")) ||
          s.startsWith(normalize("INT")) ||
          s.includes("KIOT") ||
          s === normalize("MTT")
        )
          sc += 5
        if (
          s === normalize("HD") ||
          s === normalize("CKS") ||
          s === normalize("TH") ||
          s === normalize("PM")
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

    NGAY: pick(
      "NGÀY KÍCH H",
      "NGÀY KÍCH HOẠT",
      "NGÀY PHÁT SINH",
      "Ngày phát sinh"
    ),
    MST: pick("MST", "Mã số thuế"),
    TEN: pick("TÊN CTY", "TÊN CÔNG TY", "TÊN ĐƠN VỊ", "Tên công ty"),
    LOAI_CODE: loaiCodeHeader, // ✅ cột P (HD/CKS/TH/PM)
    LOAI_CKS_TEXT: pickTenSpVangO(loaiCodeHeader), // ✅ cột O (MTT/INT1/KIOT/ICA1)
    BANQUYEN: pick("BQ", "BẢN QUYỀN"),
    SL_MOI: pick("SL MỚI", "SLMOI"),
    SL_GH: pick("SL GH", "SLGH"),
    SL_TANG: pick("SL TẶNG", "SL TANG", "SLTANG"),

    DT_GOI_HD: pick("GÓI HÓA ĐƠN", "GOI HOA DON", "GÓI HĐ"),
    DT_KHAC: pick("KHÁC", "KHAC"),
    TRI_GIA_XUAT_HD: pick("TỔNG XUẤT HD", "TONG XUAT HD", "TỔNG XUẤT HĐ"),

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

    // ✅ M-INV ĐÃ THU: lấy từ cột "SỐ TIỀN" trong file theo dõi doanh số
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

  // ✅ validate đúng các cột cần thiết để ra công thức chuẩn
  const missing: string[] = []
  ;[
    ["TÊN SP", H.LOAI],
    ["NGÀY KÍCH HOẠT", H.NGAY],
    ["MST", H.MST],
    ["TÊN CTY", H.TEN],
    ["BQ", H.BANQUYEN],
    ["SL MỚI", H.SL_MOI],
    ["SL GH", H.SL_GH],
    ["SL TẶNG", H.SL_TANG],
    ["GÓI HÓA ĐƠN", H.DT_GOI_HD],
    ["KHÁC", H.DT_KHAC],
    ["TỔNG XUẤT HĐ", H.TRI_GIA_XUAT_HD],
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

  // ✅ ALL dealers
  const dealerPickedRaw = String(filter.dealerName ?? "").trim()
  const isAll =
    dealerPickedRaw === "__ALL__" ||
    normalize(dealerPickedRaw) === normalize("tất cả")

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

  const now = new Date()
  const timestamp = now.toISOString().slice(0, 10).replace(/-/g, "")

  const exportOneDealer = async (dealerName: string) => {
    const wantedDealer = normalize(dealerName)

    const filteredRows = salesRows.filter(
      (row: any) => normalize(row[H.DEALER]) === wantedDealer
    )

    if (!filteredRows.length) {
      throw new Error(`Không có dữ liệu sau lọc: dealer="${dealerName}"`)
    }

    const ws = deepCloneSheet(templateWs)
    setColumnWidthsHoaHong(ws)

    let rows = resolveTemplateRows(ws)

    // header dealer + month
    applyHeaderDealerMonth(ws, dealerName, filter.month)

    // ensure space & group
    const grouped = ensureAllSectionsHaveSpace(ws, rows, filteredRows, H.LOAI)

    // sau insert phải resolve lại rows
    rows = resolveTemplateRows(ws)

    // ✅ COMPACT TRƯỚC khi fill (để không lệch công thức)
    rows = compactSections(ws, grouped)

    // ✅ sau deleteRows, resolve lại rows lần nữa
    rows = resolveTemplateRows(ws)

    // ✅ clear sau khi layout đã “chốt”
    clearAllSectionBlocks(ws, rows)

    // ✅ fill cuối cùng (formula sẽ đúng row hiện tại)
    fillAllSections(ws, rows, grouped, H)

    // sums + total
    applyAllSectionSums(ws, rows, grouped)
    applyGrandTotal(ws, rows)

    // footer (nếu bạn vẫn dùng block footer)
    const agencyName = extractAgencyNameFromTemplate(ws)
    const isTncnExempt = exemptSet.has(normalize(agencyName))
    const { rowTongCong } = applyFooterFormulasAndHighlight(ws, rows.rTOTAL, {
      isTncnExempt,
    })

    // style + number format
    applyHoaHongTableStyle(ws, rows)
    formatAllNumbers(ws)
    boldFooterBlock(ws, rows.rTOTAL, rowTongCong)

    const outWb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(outWb, ws, realName)

    const safeDealer = String(dealerName)
      .replace(/[\\/:*?"<>|]+/g, "-")
      .trim()
    const fileName = `CHI-HOA-HONG-${safeDealer}-${timestamp}.xlsx`

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

    const zipName = `CHI-HOA-HONG-ALL-${timestamp}.zip`
    const blob = await zip.generateAsync({ type: "blob" })
    downloadBlob(blob, zipName)
  }
}
