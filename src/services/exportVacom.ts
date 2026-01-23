"use client"

import * as XLSX from "xlsx-js-style"
import type { ExcelRow } from "../utils/excel"
import {
  classifyProductToSection,
  clearRange,
  deepCloneSheet,
  ensureRefIncludes,
  findSectionTitleRow,
  findSheetName,
  forceLeftTitleRow,
  getSheetAOA,
  insertRows,
  monthKey,
  normalize,
  removeAllFormulas,
  setCell,
  setRowFormulas,
  unmergeInRange,
} from "../utils/excel"
import { BORDER_THIN_VACOM, COL_VACOM, COL_WCH_VACOM } from "@/constants/vacom"
import {
  addLogoToA1_OOXML,
  addLogoToA1ExcelJS,
  downloadArrayBuffer,
  fetchPngAsBase64,
} from "@/lib/logo"

type ExportArgs = {
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

const styleCell = (ws: XLSX.WorkSheet, r0: number, c0: number, s: any) => {
  const addr = XLSX.utils.encode_cell({ r: r0, c: c0 })
  if (!ws[addr]) ws[addr] = { t: "s", v: "" }
  ;(ws[addr] as any).s = { ...(ws[addr] as any).s, ...s }
}

const applyVacomHdStyles = (
  ws: XLSX.WorkSheet,
  opts: {
    headerRows0: number[]
    sectionTitleRows0: number[]
    dataStartRow0: number
    dataEndRow0: number
  }
) => {
  const { headerRows0, sectionTitleRows0, dataStartRow0, dataEndRow0 } = opts

  ;(ws as any)["!cols"] = COL_WCH_VACOM.map((wch) => ({ wch }))

  const addrs = ["C1", "C2", "C3"]

  for (const a of addrs) {
    const cell = ws[a] ?? (ws[a] = { t: "s", v: "" })

    cell.s = {
      ...(cell.s || {}),
      font: { ...(cell.s?.font || {}), bold: true },
      alignment: {
        ...(cell.s?.alignment || {}),
        horizontal: "left",
        vertical: "center",
        wrapText: false,
      },
    }
  }

  const rows = (((ws as any)["!rows"] || []) as any[]).slice()
  const setH = (r0: number, h: number) => {
    rows[r0] = { ...(rows[r0] || {}), hpt: h }
  }
  setH(3, 22)
  headerRows0.forEach((r0) => setH(r0, 30))
  sectionTitleRows0.forEach((r0) => setH(r0, 20))
  ;(ws as any)["!rows"] = rows

  // header style
  headerRows0.forEach((r0) => {
    for (let c0 = 0; c0 <= 10; c0++) {
      const isCHeaderTop3 = (r0 === 0 || r0 === 1 || r0 === 2) && c0 === 2 // C1:C3

      styleCell(ws, r0, c0, {
        font: { bold: true },
        alignment: isCHeaderTop3
          ? { vertical: "center", horizontal: "left", wrapText: false } // ✅ giữ tràn
          : { vertical: "center", horizontal: "center", wrapText: true },
        fill: { patternType: "solid", fgColor: { rgb: "EEF2F7" } },
        border: BORDER_THIN_VACOM,
      })
    }
  })

  // section title style
  sectionTitleRows0.forEach((r0) => {
    for (let c0 = 0; c0 <= 10; c0++) {
      const isTitleTextArea = c0 <= 2 // A..C là text tiêu đề khu

      styleCell(ws, r0, c0, {
        font: { bold: true },
        fill: { patternType: "solid", fgColor: { rgb: "DFF3E3" } },
        border: BORDER_THIN_VACOM,
        alignment: {
          vertical: "center",
          horizontal: isTitleTextArea ? "left" : "center",
          wrapText: true,
        },
      })

      // format số cho đúng (nếu template có sẵn dạng text)
      const addr = XLSX.utils.encode_cell({ r: r0, c: c0 })
      const cell = ws[addr] as any
      if (!cell) continue

      if ([4].includes(c0)) cell.z = "0" // E (SLHĐ)
      if ([5, 7, 8, 9, 10].includes(c0)) cell.z = "#,##0" // F,H,I,J,K
      if (c0 === 6) cell.z = "0%" // G (%)
    }
  })

  const safeStart = Math.max(0, dataStartRow0)
  const safeEnd = Math.max(safeStart, dataEndRow0)

  // data grid style
  for (let r0 = safeStart; r0 <= safeEnd; r0++) {
    for (let c0 = 0; c0 <= 10; c0++) {
      const isNameCol = c0 === 2
      styleCell(ws, r0, c0, {
        alignment: {
          vertical: "center",
          horizontal: isNameCol ? "left" : "center",
          wrapText: !isNameCol,
        },
        border: BORDER_THIN_VACOM,
      })

      const addr = XLSX.utils.encode_cell({ r: r0, c: c0 })
      const cell = ws[addr] as any
      if (!cell) continue

      // ✅ cột ngày là D (index 3)
      if (c0 === 3) cell.z = "dd/mm/yyyy"

      // tiền: F,H,I,J,K
      if ([5, 7, 8, 9, 10].includes(c0)) cell.z = "#,##0"

      // %: G
      if (c0 === 6) cell.z = "0%"

      // STT: A
      if (c0 === 0) cell.z = "0"
    }
  }
}

export async function exportVacomHdXlsx(args: ExportArgs) {
  const { templateWorkbook, salesHeaders, salesRows, onLog } = args

  if (!templateWorkbook || !salesHeaders?.length || !salesRows?.length) {
    throw new Error("Thiếu file mẫu hoặc file doanh số")
  }

  const realName =
    args.sheetName && templateWorkbook.SheetNames.includes(args.sheetName)
      ? args.sheetName
      : findSheetName(templateWorkbook, "MẪU VACOM HD")

  if (!realName) throw new Error("❌ Không tìm thấy sheet: MẪU VACOM HD")

  // ✅ build header index (fix lỗi thiếu cột)
  const salesIndex = new Map<string, string>()
  salesHeaders.forEach((h) => {
    const k = normalize(h)
    if (k && !salesIndex.has(k)) salesIndex.set(k, h)
  })

  const pickHeader = (...aliases: string[]) => {
    for (const a of aliases) {
      const h = salesIndex.get(normalize(a))
      if (h) return h
    }
    return ""
  }

  const productTypeCol =
    salesHeaders.find((h) => normalize(h) === normalize("Loại sản phẩm")) || ""
  if (!productTypeCol) {
    throw new Error(
      '❌ Không tìm thấy đúng cột "Loại sản phẩm" trong file doanh số'
    )
  }

  const H_MST = pickHeader("MST")
  const H_TEN = pickHeader("Tên hợp đồng", "Tên công ty")
  const H_NGAY = pickHeader(
    "Thời gian kích hoạt",
    "Ngày tháng",
    "Ngày phát sinh"
  )
  const H_SL = pickHeader("SLHĐ", "SL phát hành")
  const H_TIEN = pickHeader(
    "Tổng giá trị hợp đồng HDĐT tính hoa hồng",
    "Tổng tiền xuất HD"
  )
  const H_HH = pickHeader("TỶ LỆ HOA HỒNG", "% Hoa hồng")
  const H_HH5 = pickHeader("Hoa hồng thưởng dạt doanh số 5%")

  const H_DEALER = pickHeader("Tên đại lý", "Đại lý", "Dealer")
  const H_CATEGORY =
    pickHeader("Loại sản phẩm", "Danh mục", "Category") || productTypeCol

  const missing: string[] = []
  if (!H_MST) missing.push("MST")
  if (!H_TEN) missing.push("Tên hợp đồng / Tên công ty")
  if (!H_NGAY) missing.push("Thời gian kích hoạt / Ngày tháng / Ngày phát sinh")
  if (!H_SL) missing.push("SLHĐ / SL phát hành")
  if (!H_TIEN) missing.push("Tổng giá trị... / Tổng tiền xuất HD")
  if (!H_HH) missing.push("TỶ LỆ HOA HỒNG")
  if (!H_DEALER) missing.push("Tên đại lý/Đại lý/Dealer")
  if (missing.length)
    throw new Error("❌ Thiếu cột trong file doanh số: " + missing.join(", "))

  const setFormula = (
    ws: XLSX.WorkSheet,
    r0: number,
    c0: number,
    f: string
  ) => {
    const addr = XLSX.utils.encode_cell({ r: r0, c: c0 })
    const cell: any = ws[addr] || (ws[addr] = { t: "n", v: 0 })
    cell.t = "n"
    cell.v = 0
    delete cell.w
    delete cell.vt
    cell.f = f.startsWith("=") ? f.slice(1) : f
  }

  const cellHasValue = (ws: XLSX.WorkSheet, r0: number, c0: number) => {
    const addr = XLSX.utils.encode_cell({ r: r0, c: c0 })
    const cell = ws[addr] as any
    const v = cell?.v
    return v != null && String(v).trim() !== ""
  }

  const findLastDataRow = (
    ws: XLSX.WorkSheet,
    startRow0: number,
    endBound0: number,
    COL: any
  ) => {
    let last = startRow0 - 1
    for (let r0 = startRow0; r0 <= endBound0; r0++) {
      if (cellHasValue(ws, r0, COL.MST) || cellHasValue(ws, r0, COL.TEN))
        last = r0
    }
    return last
  }

  const sumRange = (c0: number, rStart0: number, rEnd0: number) => {
    if (rEnd0 < rStart0) return "0"
    const a1 = XLSX.utils.encode_cell({ r: rStart0, c: c0 })
    const a2 = XLSX.utils.encode_cell({ r: rEnd0, c: c0 })
    return `SUM(${a1}:${a2})`
  }

  // tìm đúng dòng "CỘNG" (đúng ô cột B)
  const findCongRow0 = (aoa: any[][]) => {
    for (let r = 0; r < aoa.length; r++) {
      const v = aoa[r]?.[1] // col B
      if (normalize(String(v ?? "")) === normalize("CỘNG")) return r
    }
    return -1
  }

  const findRowContains = (aoa: any[][], text: string) => {
    const needle = normalize(text)
    for (let r = 0; r < aoa.length; r++) {
      for (let c = 0; c < (aoa[r] || []).length; c++) {
        const v = aoa[r]?.[c]
        if (v == null || v === "") continue
        if (normalize(v).includes(needle)) return r
      }
    }
    return -1
  }

  const categoryPicked = String(args.filter?.category ?? "").trim()
  const monthPicked = String(args.filter?.month ?? "").trim()

  const dealerPickedRaw = String(args.filter?.dealerName ?? "").trim()
  const exportAllDealers = !dealerPickedRaw || dealerPickedRaw === "__ALL__"

  const dealers = exportAllDealers
    ? Array.from(
        new Set(
          salesRows
            .map((r: any) => String(r[H_DEALER] ?? "").trim())
            .filter(Boolean)
        )
      ).sort((a, b) => a.localeCompare(b, "vi"))
    : [dealerPickedRaw]

  if (!dealers.length)
    throw new Error("❌ Không tìm được danh sách đại lý để xuất")

  const templateWs = templateWorkbook.Sheets[realName]
  if (!templateWs) throw new Error("❌ Không đọc được sheet VACOM HD")

  // helper: format cell theo cột
  const applyColumnFormats = (ws: XLSX.WorkSheet, r0: number, c0: number) => {
    const addr = XLSX.utils.encode_cell({ r: r0, c: c0 })
    const cell = ws[addr] as any
    if (!cell) return
    if (c0 === 3) cell.z = "dd/mm/yyyy"
    if ([5, 7, 8, 9, 10].includes(c0)) cell.z = "#,##0"
    if (c0 === 6) cell.z = "0%"
    if (c0 === 0) cell.z = "0"
  }

  // helper: style dòng CỘNG (đặt SAU applyVacomHdStyles để không bị ghi đè)
  const styleCongRow = (ws: XLSX.WorkSheet, r0: number) => {
    for (let c0 = 0; c0 <= 10; c0++) {
      styleCell(ws, r0, c0, {
        font: { bold: true },
        fill: { patternType: "solid", fgColor: { rgb: "DFF3E3" } },
        border: BORDER_THIN_VACOM,
        alignment: {
          vertical: "center",
          horizontal: c0 === 2 ? "left" : "center",
          wrapText: true,
        },
      })
      applyColumnFormats(ws, r0, c0)
    }
  }

  // helper: center các cột số trên dòng “tổng khu” (hàng xanh lá)
  const centerTotalsOnSectionRow = (ws: XLSX.WorkSheet, r0: number) => {
    for (let c0 = 3; c0 <= 10; c0++) {
      styleCell(ws, r0, c0, {
        font: { bold: true },
        fill: { patternType: "solid", fgColor: { rgb: "DFF3E3" } },
        border: BORDER_THIN_VACOM,
        alignment: { vertical: "center", horizontal: "center", wrapText: true },
      })
      applyColumnFormats(ws, r0, c0)
    }
  }

  const styleTailBlockBold = (ws: XLSX.WorkSheet, aoa: any[][]) => {
    const rStart = findRowContains(aoa, "Doanh số Vacom HCM đạt được")
    const rEnd = findRowContains(aoa, "Tổng Minvoice HCM thực thu:")
    if (rStart === -1 || rEnd === -1) return

    const s = Math.min(rStart, rEnd)
    const e = Math.max(rStart, rEnd)

    for (let r0 = s; r0 <= e; r0++) {
      for (let c0 = 0; c0 <= 10; c0++) {
        const addr = XLSX.utils.encode_cell({ r: r0, c: c0 })
        const cell = ws[addr] as any

        const cellValue = aoa[r0]?.[c0]
        const isNumber =
          typeof cellValue === "number" ||
          (!isNaN(Number(cellValue)) && String(cellValue).trim() !== "")

        styleCell(ws, r0, c0, {
          font: { bold: true },
          border: BORDER_THIN_VACOM,
          fill: { patternType: "solid", fgColor: { rgb: "FFFFFF" } },
          alignment: {
            vertical: "center",
            horizontal: isNumber ? "center" : "left",
            wrapText: true,
          },
        })

        // ✅ thêm dấu phẩy cho số (đặc biệt cột H)
        if (cell && isNumber) {
          // ép kiểu số nếu đang là text số
          if (cell.t !== "n") {
            const n = Number(cell.v)
            if (!isNaN(n)) {
              cell.t = "n"
              cell.v = n
            }
          }
          cell.z = "#,##0" // 1,275,000
        }
      }
    }
  }

  const styleSignArea = (ws: XLSX.WorkSheet) => {
    const aoa = getSheetAOA(ws)

    const rXacNhan0 = findRowContains(aoa, "Xác nhận đại lý")
    const rHcmDate0 = findRowContains(aoa, "HCM, ngày")
    let rMinvoice0 = findRowContains(aoa, "M-INVOICE HCM")

    const rTong0 = findRowContains(aoa, "Tổng Minvoice HCM thực thu")

    // ✅ nếu findRowContains bị match nhầm vào dòng "Tổng Minvoice..."
    if (rMinvoice0 === rTong0) {
      rMinvoice0 = -1
      for (let r = 0; r < aoa.length; r++) {
        for (let c = 0; c < (aoa[r]?.length ?? 0); c++) {
          const v = (aoa[r]?.[c] ?? "").toString().trim()
          if (v.includes("M-INVOICE")) {
            // có dấu "-" nên không đụng "Tổng Minvoice..."
            rMinvoice0 = r
            break
          }
        }
        if (rMinvoice0 !== -1) break
      }
    }

    const targets = [rXacNhan0, rHcmDate0, rMinvoice0].filter((r) => r !== -1)

    for (const r0 of targets) {
      for (let c0 = 0; c0 <= 10; c0++) {
        styleCell(ws, r0, c0, {
          font: { bold: true },
          alignment: {
            vertical: "center",
            horizontal: "center",
            wrapText: true,
          },
        })
      }
    }
  }

  for (const dealerPicked of dealers) {
    const filteredRows = salesRows.filter((r: any) => {
      if (String(r[H_DEALER] ?? "").trim() !== dealerPicked) return false
      if (
        categoryPicked &&
        String(r[H_CATEGORY] ?? "").trim() !== categoryPicked
      )
        return false
      if (monthPicked) {
        const mk = monthKey(r[H_NGAY])
        if (mk !== monthPicked) return false
      }
      return true
    })

    if (!filteredRows.length) {
      onLog?.("SKIP (no data)", { dealerPicked, categoryPicked, monthPicked })
      continue
    }

    const newWs = deepCloneSheet(templateWs)
    removeAllFormulas(newWs)

    const recalc = () => getSheetAOA(newWs)
    let aoa = recalc()

    // ===== MAP HEADER: tháng/năm (dòng 5) + tên đại lý (dòng 6) =====

    const applyTopHeader = (
      ws: XLSX.WorkSheet,
      dealerName: string,
      monthStr: string
    ) => {
      const findCellAddrContains = (needleRaw: string) => {
        const needle = normalize(needleRaw)
        for (const addr of Object.keys(ws)) {
          if (addr.startsWith("!")) continue
          const cell = (ws as any)[addr]
          const v = cell?.v
          if (v == null || String(v).trim() === "") continue
          if (normalize(String(v)).includes(needle)) return addr
        }
        return ""
      }

      const month = String(monthStr ?? "").trim()
      let mm = "",
        yyyy = ""
      if (month.includes("/")) [mm, yyyy] = month.split("/")
      const title = findCellAddrContains("BẢNG KÊ PHÁT TRIỂN KHÁCH HÀNG  ")
      const addrThang = findCellAddrContains("THÁNG")
      const addrDaiLy = findCellAddrContains("ĐẠI LÝ")
      const addrSo = findCellAddrContains("MINV/HCM/VC")

      if (addrThang) {
        ;(ws as any)[addrThang].t = "s"
        ;(ws as any)[addrThang].v = `THÁNG: ${month}`
      }

      if (addrDaiLy) {
        ;(ws as any)[addrDaiLy].t = "s"
        ;(ws as any)[addrDaiLy].v = `ĐẠI LÝ: ${dealerName}`
      }

      if (addrSo) {
        const docNo =
          mm && yyyy ? `Số ${mm}.${yyyy}MINV/HCM/VC` : `Số MINV/HCM/VC`
        ;(ws as any)[addrSo].t = "s"
        ;(ws as any)[addrSo].v = docNo
      }

      const styleHeaderCell = (addr: string, sz: number, hpt?: number) => {
        if (!addr || !(ws as any)[addr]) return

        // cell style
        const cell = (ws as any)[addr]
        cell.s = {
          ...(cell.s || {}),
          font: { ...(cell.s?.font || {}), bold: true, sz },
          alignment: {
            ...(cell.s?.alignment || {}),
            horizontal: "center",
            vertical: "center",
            wrapText: false, // ✅ QUAN TRỌNG: tắt wrap để không đội height
          },
        }

        // row height
        if (hpt != null) {
          const r0 = XLSX.utils.decode_cell(addr).r
          const rows = (((ws as any)["!rows"] || []) as any[]).slice()
          rows[r0] = { ...(rows[r0] || {}), hpt }
          ;(ws as any)["!rows"] = rows
        }
      }

      styleHeaderCell(title, 18, 30) // title
      styleHeaderCell(addrThang, 18, 30) // tháng
      styleHeaderCell(addrDaiLy, 13, 20) // đại lý
      styleHeaderCell(addrSo, 13, 20) // số
    }

    const rA = findSectionTitleRow(aoa, "A. GIÁ TRỊ HÓA ĐƠN ĐIỆN TỬ")
    const rB = findSectionTitleRow(aoa, "B. MÁY TÍNH TIỀN")
    const rC = findSectionTitleRow(aoa, "C. CHỨNG TỪ KHẤU TRỪ THUẾ TNCN")
    const rE = findSectionTitleRow(aoa, "E. QUẢN LÝ HÓA ĐƠN SMI")
    const rD = findSectionTitleRow(aoa, "D. BHXH")
    if ([rA, rB, rC, rE, rD].some((x) => x === -1)) {
      throw new Error(
        "❌ Không tìm thấy đủ khu A/B/C/E/D trong template VACOM HD."
      )
    }

    const getStartOfSection = (titleRow0: number) => titleRow0 + 1

    const group: Record<"A" | "B" | "C" | "E" | "D", ExcelRow[]> = {
      A: [],
      B: [],
      C: [],
      E: [],
      D: [],
    }

    filteredRows.forEach((row: any) => {
      const rawType = row[productTypeCol]
      const sec = classifyProductToSection(rawType)
      if (normalize(rawType).includes("cks")) return
      if (!sec) return
      group[sec].push(row)
    })

    const ensureSpace = (
      sec: "A" | "B" | "C" | "E",
      titleLabel: string,
      nextLabel: string
    ) => {
      const aoaNow = recalc()
      const titleRow = findSectionTitleRow(aoaNow, titleLabel, 6000)
      const boundaryRow = findSectionTitleRow(aoaNow, nextLabel, 6000)
      const start = titleRow + 1
      const placeholder = Math.max(0, boundaryRow - start)
      const needInsert = Math.max(0, group[sec].length - placeholder)
      if (needInsert > 0) insertRows(newWs, boundaryRow, needInsert)
    }

    // insert bottom-up cho A/B/C/E
    ensureSpace("E", "E. QUẢN LÝ HÓA ĐƠN SMI", "D. BHXH")
    ensureSpace("C", "C. CHỨNG TỪ KHẤU TRỪ THUẾ TNCN", "E. QUẢN LÝ HÓA ĐƠN SMI")
    ensureSpace("B", "B. MÁY TÍNH TIỀN", "C. CHỨNG TỪ KHẤU TRỪ THUẾ TNCN")
    ensureSpace("A", "A. GIÁ TRỊ HÓA ĐƠN ĐIỆN TỬ", "B. MÁY TÍNH TIỀN")

    // ===== ✅ FIX LỆCH: ENSURE SPACE CHO KHU D (BHXH) TRƯỚC DÒNG "CỘNG" =====
    aoa = recalc()
    let rCong0 = findCongRow0(aoa)
    if (rCong0 === -1)
      throw new Error('❌ Không tìm thấy dòng "CỘNG" trong template')

    let rD2 = findSectionTitleRow(aoa, "D. BHXH", 6000)
    if (rD2 === -1)
      throw new Error("❌ Không tìm thấy khu D. BHXH sau khi insert")

    const startD_tmp = getStartOfSection(rD2)
    const placeholderD = Math.max(0, rCong0 - startD_tmp)
    const needInsertD = Math.max(0, group.D.length - placeholderD)
    if (needInsertD > 0) {
      insertRows(newWs, rCong0, needInsertD)
      aoa = recalc()
      rCong0 = findCongRow0(aoa)
      rD2 = findSectionTitleRow(aoa, "D. BHXH", 6000)
      if (rCong0 === -1 || rD2 === -1)
        throw new Error("❌ Lỗi re-index sau khi insert khu D")
    }

    // re-find lại tất cả section sau khi đã insert cả D
    const rA2 = findSectionTitleRow(aoa, "A. GIÁ TRỊ HÓA ĐƠN ĐIỆN TỬ", 6000)
    const rB2 = findSectionTitleRow(aoa, "B. MÁY TÍNH TIỀN", 6000)
    const rC2 = findSectionTitleRow(aoa, "C. CHỨNG TỪ KHẤU TRỪ THUẾ TNCN", 6000)
    const rE2 = findSectionTitleRow(aoa, "E. QUẢN LÝ HÓA ĐƠN SMI", 6000)
    const rD3 = findSectionTitleRow(aoa, "D. BHXH", 6000)

    const startA = getStartOfSection(rA2)
    const startB = getStartOfSection(rB2)
    const startC = getStartOfSection(rC2)
    const startE = getStartOfSection(rE2)
    const startD = getStartOfSection(rD3)
    const maxC = COL_VACOM.CONPHAITT

    // clear placeholders
    clearRange(newWs, startA, rB2 - 1, 0, maxC)
    clearRange(newWs, startB, rC2 - 1, 0, maxC)
    clearRange(newWs, startC, rE2 - 1, 0, maxC)
    clearRange(newWs, startE, rD3 - 1, 0, maxC)
    clearRange(newWs, startD, rCong0 - 1, 0, maxC)

    // unmerge trong vùng data (tránh merge placeholder)
    unmergeInRange(newWs, startA, rB2 - 1)
    unmergeInRange(newWs, startB, rC2 - 1)
    unmergeInRange(newWs, startC, rE2 - 1)
    unmergeInRange(newWs, startE, rD3 - 1)
    unmergeInRange(newWs, startD, rCong0 - 1)

    let sttCounter = 1

    const fillSection = (startRow0: number, rows: ExcelRow[]) => {
      let maxR = startRow0
      for (let i = 0; i < rows.length; i++) {
        const r0 = startRow0 + i
        const row = rows[i] as any

        setCell(newWs, r0, COL_VACOM.STT, sttCounter++, {
          kind: "stt",
          force: true,
        })
        setCell(newWs, r0, COL_VACOM.MST, row[H_MST], {
          kind: "text",
          force: true,
        })
        setCell(newWs, r0, COL_VACOM.TEN, row[H_TEN], {
          kind: "text",
          force: true,
        })
        setCell(newWs, r0, COL_VACOM.NGAY, row[H_NGAY], {
          kind: "date",
          force: true,
        })
        setCell(newWs, r0, COL_VACOM.SLHD, row[H_SL], {
          kind: "number0",
          force: true,
        })
        setCell(newWs, r0, COL_VACOM.TIEN, row[H_TIEN], {
          kind: "number0",
          force: true,
        })
        setCell(newWs, r0, COL_VACOM.HH, row[H_HH], {
          kind: "percent",
          force: true,
        })
        setCell(newWs, r0, COL_VACOM.HH5, H_HH5 ? row[H_HH5] : 0, {
          kind: "number0",
          force: true,
        })

        setRowFormulas(newWs, r0, COL_VACOM)
        maxR = Math.max(maxR, r0)
      }
      ensureRefIncludes(newWs, maxR, maxC)
    }

    fillSection(startA, group.A)
    fillSection(startB, group.B)
    fillSection(startC, group.C)
    fillSection(startE, group.E)
    fillSection(startD, group.D)

    // end rows thực tế
    const endA = findLastDataRow(newWs, startA, rB2 - 1, COL_VACOM)
    const endB = findLastDataRow(newWs, startB, rC2 - 1, COL_VACOM)
    const endC = findLastDataRow(newWs, startC, rE2 - 1, COL_VACOM)
    const endE = findLastDataRow(newWs, startE, rD3 - 1, COL_VACOM)
    const endD = findLastDataRow(newWs, startD, rCong0 - 1, COL_VACOM)

    // tổng từng khu (đúng mẫu)
    const rebuildSectionTotals = (
      titleRow0: number,
      start: number,
      end: number
    ) => {
      setFormula(
        newWs,
        titleRow0,
        COL_VACOM.SLHD,
        sumRange(COL_VACOM.SLHD, start, end)
      )
      setFormula(
        newWs,
        titleRow0,
        COL_VACOM.TIEN,
        sumRange(COL_VACOM.TIEN, start, end)
      )
      setFormula(
        newWs,
        titleRow0,
        COL_VACOM.DLDH,
        sumRange(COL_VACOM.DLDH, start, end)
      )
      setFormula(
        newWs,
        titleRow0,
        COL_VACOM.TONGTRICH,
        sumRange(COL_VACOM.TONGTRICH, start, end)
      )
      setFormula(
        newWs,
        titleRow0,
        COL_VACOM.CONPHAITT,
        sumRange(COL_VACOM.CONPHAITT, start, end)
      )
    }

    rebuildSectionTotals(rA2, startA, endA)
    rebuildSectionTotals(rB2, startB, endB)
    rebuildSectionTotals(rC2, startC, endC)
    rebuildSectionTotals(rE2, startE, endE)
    rebuildSectionTotals(rD3, startD, endD)

    // dòng CỘNG: cộng các dòng tổng khu
    const sumCells = (rows0: number[], c0: number) => {
      const addrs = rows0
        .filter((r) => r >= 0)
        .map((r) => XLSX.utils.encode_cell({ r, c: c0 }))
      return addrs.length ? `SUM(${addrs.join(",")})` : "0"
    }

    const sectionTitleRows = [rA2, rB2, rC2, rE2, rD3]
    setFormula(
      newWs,
      rCong0,
      COL_VACOM.SLHD,
      sumCells(sectionTitleRows, COL_VACOM.SLHD)
    )
    setFormula(
      newWs,
      rCong0,
      COL_VACOM.TIEN,
      sumCells(sectionTitleRows, COL_VACOM.TIEN)
    )
    setFormula(
      newWs,
      rCong0,
      COL_VACOM.DLDH,
      sumCells(sectionTitleRows, COL_VACOM.DLDH)
    )
    setFormula(
      newWs,
      rCong0,
      COL_VACOM.TONGTRICH,
      sumCells(sectionTitleRows, COL_VACOM.TONGTRICH)
    )
    setFormula(
      newWs,
      rCong0,
      COL_VACOM.CONPHAITT,
      sumCells(sectionTitleRows, COL_VACOM.CONPHAITT)
    )

    // ===== FIX khu tổng kết dưới dòng CỘNG (phải lấy aoa mới) =====
    const aoa2 = recalc()
    const rDoanhSo0 = findRowContains(aoa2, "Doanh số Vacom HCM đạt được")
    const rTongThucThu0 = findRowContains(aoa2, "Tổng Minvoice HCM thực thu")

    if (rDoanhSo0 !== -1) {
      const addrCongK = XLSX.utils.encode_cell({
        r: rCong0,
        c: COL_VACOM.CONPHAITT,
      })
      const addrDoanhH = XLSX.utils.encode_cell({
        r: rDoanhSo0,
        c: COL_VACOM.DLDH,
      })
      setFormula(newWs, rDoanhSo0, COL_VACOM.DLDH, addrCongK)
      if (rTongThucThu0 !== -1)
        setFormula(newWs, rTongThucThu0, COL_VACOM.DLDH, addrDoanhH)
    }

    // ===== style lại vùng bảng (tới hết dòng CỘNG) =====
    ensureRefIncludes(newWs, rCong0, maxC)
    const rowsMeta = (((newWs as any)["!rows"] || []) as any[]).slice()
    rowsMeta[rCong0] = { ...(rowsMeta[rCong0] || {}), hpt: 20 }
    ;(newWs as any)["!rows"] = rowsMeta

    applyVacomHdStyles(newWs, {
      headerRows0: [8, 9, 10],
      sectionTitleRows0: [rA2, rB2, rC2, rE2, rD3],
      dataStartRow0: startA,
      dataEndRow0: rCong0, // ✅ phủ tới dòng CỘNG
    })

    // ... sau khi insertRows + applyVacomHdStyles + các style khác xong hết

    const resolvedMonth = monthPicked || monthKey(filteredRows[0]?.[H_NGAY])
    applyTopHeader(newWs, dealerPicked, resolvedMonth) // ✅ gọi lại ở cuối để chốt height/style

    styleTailBlockBold(newWs, recalc())
    styleSignArea(newWs)

    // merge lại đúng tiêu đề khu (A..C)
    forceLeftTitleRow(newWs, rA2, 0, 2)
    forceLeftTitleRow(newWs, rB2, 0, 2)
    forceLeftTitleRow(newWs, rC2, 0, 2)
    forceLeftTitleRow(newWs, rE2, 0, 2)
    forceLeftTitleRow(newWs, rD3, 0, 2)

    // ✅ FIX: hàng xanh lá (tổng khu) center các cột số E..K
    centerTotalsOnSectionRow(newWs, rA2)
    centerTotalsOnSectionRow(newWs, rB2)
    centerTotalsOnSectionRow(newWs, rC2)
    centerTotalsOnSectionRow(newWs, rE2)
    centerTotalsOnSectionRow(newWs, rD3)

    // ✅ STYLE dòng CỘNG sau cùng để không bị applyVacomHdStyles ghi đè
    styleCongRow(newWs, rCong0)

    // ✅ BÔI ĐEN (bold + border + fill) toàn bộ khối cuối như hình (sau khi đã setFormula)
    styleTailBlockBold(newWs, recalc())
    styleSignArea(newWs)

    const outWb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(outWb, newWs, realName)

    const timestamp = new Date().toISOString().slice(0, 10).replace(/-/g, "")
    const fnameDealer = normalize(dealerPicked).slice(0, 60)
    const fnameMonth = monthPicked ? `-${monthPicked.replace("/", "")}` : ""
    const fnameCat = categoryPicked
      ? `-${normalize(categoryPicked).slice(0, 30)}`
      : ""

    const filename = `VACOM-HD-${fnameDealer}${fnameMonth}${fnameCat}-${timestamp}.xlsx`

    // 1) xuất từ xlsx-js-style ra ArrayBuffer
    const xlsxBuf = XLSX.write(outWb, {
      bookType: "xlsx",
      type: "array",
    }) as ArrayBuffer

    // 2) load logo PNG từ public -> base64
    const logoBase64 = await fetchPngAsBase64("/images/logo_minvoice.png")

    // 3) patch OOXML để nhét ảnh mà KHÔNG rewrite styles (giữ format)
    const finalBuf = await addLogoToA1_OOXML(xlsxBuf, realName, logoBase64, {
      widthPx: 150,
      heightPx: 85,
    })

    // 4) download
    downloadArrayBuffer(finalBuf, filename)
  }
}
