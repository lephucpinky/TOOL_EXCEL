// /services/exportThuGiaVon.ts
import * as XLSX from "xlsx-js-style"
import {
  ExcelRow,
  normalize,
  getSheetAOA,
  deepCloneSheet,
  insertRows,
  ensureRefIncludes,
  unmergeInRange,
} from "@/utils/excel"
import {
  addLogoToA1ExcelJS,
  downloadArrayBuffer,
  fetchPngAsBase64,
} from "@/lib/logo"

type ExportArgs = {
  templateWorkbook: XLSX.WorkBook
  salesHeaders: string[]
  sheetName?: string
  salesRows: ExcelRow[]
  filter: { dealerName: string; category?: string }
  onLog?: (...args: any[]) => void
}

const SHEET_TEMPLATE_NAME = "MẪU THU GIÁ VỐN"

// --------------------
// small helpers
// --------------------
const sanitizeSheetName = (name: string) =>
  name
    .replace(/[:\\/?*\[\]]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 31)

const uniqueSheetName = (wb: XLSX.WorkBook, wanted: string) => {
  const base = sanitizeSheetName(wanted) || "Sheet"
  const exists = new Set(wb.SheetNames)
  if (!exists.has(base)) return base
  for (let i = 2; i < 1000; i++) {
    const suffix = ` (${i})`
    const trimmed = base.slice(0, 31 - suffix.length).trim()
    const candidate = `${trimmed}${suffix}`
    if (!exists.has(candidate)) return candidate
  }
  return `${base.slice(0, 28)}_${Date.now().toString().slice(-2)}`
}

const formatExcelDate = (v: any) => {
  if (v == null || v === "") return ""

  // ✅ Date object (trường hợp file của bạn)
  if (v instanceof Date) {
    const d = v.getDate()
    const m = v.getMonth() + 1
    const y = v.getFullYear()
    return `${String(d).padStart(2, "0")}/${String(m).padStart(2, "0")}/${String(y)}`
  }

  // Excel serial
  if (typeof v === "number") {
    const d = XLSX.SSF.parse_date_code(v)
    if (!d) return ""
    return `${String(d.d).padStart(2, "0")}/${String(d.m).padStart(2, "0")}/${String(d.y)}`
  }

  return String(v)
}

const num = (v: any) => {
  if (v == null || v === "") return 0
  const n = Number(String(v).replace(/,/g, "").trim())
  return Number.isFinite(n) ? n : 0
}

const setCellRC = (ws: XLSX.WorkSheet, r0: number, c0: number, v: any) => {
  const addr = XLSX.utils.encode_cell({ r: r0, c: c0 })
  const cur = (ws as any)[addr] || {}

  // object cell (formula / typed cell)
  if (v && typeof v === "object" && ("f" in v || "t" in v || "v" in v)) {
    ;(ws as any)[addr] = { ...cur, ...v }
    return
  }

  const isNum = typeof v === "number"
  ;(ws as any)[addr] = { ...cur, t: isNum ? "n" : "s", v }
}

const BORDER_THIN = {
  top: { style: "thin", color: { rgb: "D0D7DE" } },
  bottom: { style: "thin", color: { rgb: "D0D7DE" } },
  left: { style: "thin", color: { rgb: "D0D7DE" } },
  right: { style: "thin", color: { rgb: "D0D7DE" } },
} as const

const styleCell = (ws: XLSX.WorkSheet, r0: number, c0: number, s: any) => {
  const addr = XLSX.utils.encode_cell({ r: r0, c: c0 })
  if (!(ws as any)[addr]) (ws as any)[addr] = { t: "s", v: "" }
  ;(ws as any)[addr].s = { ...(ws as any)[addr].s, ...s }
}

const getMergeRangeContainingCell = (
  ws: XLSX.WorkSheet,
  r0: number,
  c0: number
) => {
  const merges = ((ws as any)["!merges"] || []) as XLSX.Range[]
  for (const m of merges) {
    if (r0 >= m.s.r && r0 <= m.e.r && c0 >= m.s.c && c0 <= m.e.c) return m
  }
  return null
}

const findFinalHeaderRow0 = (aoa: any[][], scan = 500) => {
  const needNgay = new Set([
    normalize("ngày tháng"),
    normalize("ngày phát sinh"),
  ])
  const needMST = new Set([normalize("mst"), normalize("mã số thuế")])
  const needTen = new Set([normalize("tên công ty"), normalize("tên đơn vị")])

  let best = -1
  for (let r = 0; r < Math.min(scan, aoa.length); r++) {
    const row = (aoa[r] || []).map((x) => normalize(x)).filter(Boolean)
    if (!row.length) continue
    const hasNgay = row.some((x) => needNgay.has(x))
    const hasMST = row.some((x) => needMST.has(x))
    const hasTen = row.some((x) => needTen.has(x))
    if (hasNgay && hasMST && hasTen) best = r
  }
  return best
}

const mapTemplateCols = (aoa: any[][], finalHeaderRow0: number) => {
  const headerRows = [finalHeaderRow0 - 2, finalHeaderRow0 - 1, finalHeaderRow0]
    .filter((r) => r >= 0)
    .map((r) => aoa[r] || [])

  const findCol = (aliases: string[]) => {
    const set = new Set(aliases.map((x) => normalize(x)))
    for (let rr = headerRows.length - 1; rr >= 0; rr--) {
      const row = headerRows[rr]
      for (let c = 0; c < row.length; c++) {
        if (set.has(normalize(row[c]))) return c
      }
    }
    return -1
  }

  const STT = findCol(["stt"])
  const NGAY = findCol(["ngày phát sinh", "ngày tháng"])
  const MST = findCol(["mã số thuế", "mst"])
  const TEN = findCol(["tên đơn vị", "tên công ty"])

  let TONGTIEN = findCol(["tổng tiền xuất hóa đơn", "tổng tiền xuất hd"])
  let GOIHOADON = findCol(["gói hóa đơn"])
  let DTKHAC = findCol(["dt khác", "doanh thu khác"])
  let NIEMYET = findCol(["giá trị theo niêm yết", "tiền theo niêm yết"])
  let GIAMINV = findCol(["giá minv thu về (xuất hóa đơn)", "hoa hồng"])
  let GHICHU = findCol(["ghi chú", "ghi chu"])

  const base = TEN !== -1 ? TEN + 1 : 4
  if (TONGTIEN === -1) TONGTIEN = base + 0
  if (GOIHOADON === -1) GOIHOADON = base + 1
  if (DTKHAC === -1) DTKHAC = base + 2
  if (NIEMYET === -1) NIEMYET = base + 3
  if (GIAMINV === -1) GIAMINV = base + 4
  if (GHICHU === -1) GHICHU = base + 5

  const STT2 = STT !== -1 ? STT : 0
  if (GOIHOADON === TONGTIEN) GOIHOADON = TONGTIEN + 1

  const lastCol = Math.max(
    STT2,
    NGAY,
    MST,
    TEN,
    TONGTIEN,
    GOIHOADON,
    DTKHAC,
    NIEMYET,
    GIAMINV,
    GHICHU
  )

  return {
    COL: {
      STT: STT2,
      NGAY,
      MST,
      TEN,
      TONGTIEN,
      GOIHOADON,
      DTKHAC,
      NIEMYET,
      GIAMINV,
      GHICHU,
    },
    lastCol,
  }
}

const findFooterLabelRow0 = (aoa: any[][], scan = 10000) => {
  const keys = [normalize("GIÁ TRỊ M-INVOICE THU TIỀN - XUẤT HD")]
  const end = Math.min(scan, aoa.length)
  for (let r = end - 1; r >= 0; r--) {
    const line = normalize((aoa[r] || []).join(" "))
    if (keys.some((k) => line.includes(k))) return r
  }
  return -1
}

const buildSalesPicker = (rows: ExcelRow[]) => {
  const headers = Object.keys(rows[0] || {})
  const idx = new Map<string, string>()
  for (const h of headers) {
    const k = normalize(h)
    if (k && !idx.has(k)) idx.set(k, h)
  }
  const pick = (...aliases: string[]) => {
    for (const a of aliases) {
      const h = idx.get(normalize(a))
      if (h) return h
    }
    return ""
  }
  return {
    H: {
      DAILY: pick("Tên đại lý", "Đại lý"), // ✅ thêm dòng này
      NGAY: pick("Ngày tháng", "Ngày phát sinh", "Ngày"),
      MST: pick("Mã số thuế", "MST"),
      TEN: pick("Tên đơn vị", "Tên công ty"),
      TONGTIEN: pick("TỔNG TIỀN XUẤT HÓA ĐƠN", "Tổng tiền xuất HD"),
      GOI: pick("GÓI HÓA ĐƠN", "SL phát hành"),
      DTKHAC: pick("DT khác", "Doanh thu khác"),
      NIEMYET: pick("Giá trị theo niêm yết", "tiền theo niêm yết"),
      GIAMINV: pick("GIÁ MINV THU VỀ (XUẤT HÓA ĐƠN)", "Hoa hồng"),
      GHICHU: pick("Ghi chú"),
    },
  }
}

const applyStyles = (
  ws: XLSX.WorkSheet,
  aoa0: any[][],
  headerRow0: number,
  dataStartRow0: number,
  dataEndRow0: number,
  sumRow0: number,
  footerLabelRow0: number,
  COL: any,
  lastCol: number
) => {
  // widths
  const cols: any[] = Array.from({ length: lastCol + 1 }).map(() => ({
    wch: 14,
  }))
  Object.assign(cols, {
    [COL.STT]: { wch: 6 },
    [COL.NGAY]: { wch: 16 },
    [COL.MST]: { wch: 18 },
    [COL.TEN]: { wch: 44 },
    [COL.TONGTIEN]: { wch: 20 },
    [COL.GOIHOADON]: { wch: 16 },
    [COL.DTKHAC]: { wch: 12 },
    [COL.NIEMYET]: { wch: 20 },
    [COL.GIAMINV]: { wch: 20 },
    [COL.GHICHU]: { wch: 18 },
  })
  ;(ws as any)["!cols"] = cols
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
  const HEADER_STYLE = {
    font: { bold: true },
    alignment: { vertical: "center", horizontal: "center", wrapText: true },
    fill: { patternType: "solid", fgColor: { rgb: "EEF2F7" } },
    border: BORDER_THIN,
  }

  // header 2 rows: headerRow0..headerRow0+1
  for (let r = Math.max(0, headerRow0); r <= headerRow0 + 1; r++) {
    for (let c = 0; c <= lastCol; c++) styleCell(ws, r, c, HEADER_STYLE)
  }

  // guide row (ngay trên data): CENTER
  const guideRow0 = dataStartRow0 - 1
  if (guideRow0 >= 0) {
    for (let c = 0; c <= lastCol; c++) {
      styleCell(ws, guideRow0, c, {
        alignment: { vertical: "center", horizontal: "center", wrapText: true },
        border: BORDER_THIN,
      })
    }
  }

  // footer label row: fill + label LEFT (merge-safe) + totals
  if (footerLabelRow0 !== -1) {
    for (let c = 0; c <= lastCol; c++) {
      styleCell(ws, footerLabelRow0, c, {
        fill: { patternType: "solid", fgColor: { rgb: "EEF2F7" } },
        border: BORDER_THIN,
      })
    }

    // locate label cell in that row, then find top-left of merge for alignment
    const aliases = ["giá trị m-invoice thu tiền - xuất hd"]
    let labelCol = -1
    const row = aoa0[footerLabelRow0] || []
    const set = new Set(aliases.map((x) => normalize(x)))
    for (let c = 0; c < row.length; c++)
      if (set.has(normalize(row[c]))) {
        labelCol = c
        break
      }

    const targetCol = labelCol >= 0 ? labelCol : 0
    const m = getMergeRangeContainingCell(ws, footerLabelRow0, targetCol)
    const topLeftC = m ? m.s.c : targetCol

    styleCell(ws, footerLabelRow0, topLeftC, {
      font: { bold: true },
      alignment: { vertical: "center", horizontal: "left", wrapText: true },
    })

    // totals (right) except GIAMINV
    for (const c of [COL.TONGTIEN, COL.GOIHOADON, COL.DTKHAC, COL.NIEMYET]) {
      if (c !== -1) {
        styleCell(ws, footerLabelRow0, c, {
          font: { bold: true },
          alignment: { vertical: "center", horizontal: "right" },
        })
      }
    }

    // GIAMINV total: CENTER + #,##0
    if (COL.GIAMINV !== -1) {
      styleCell(ws, footerLabelRow0, COL.GIAMINV, {
        font: { bold: true },
        alignment: { vertical: "center", horizontal: "center" },
      })
      const addr = XLSX.utils.encode_cell({
        r: footerLabelRow0,
        c: COL.GIAMINV,
      })
      const cell = (ws as any)[addr]
      if (cell) cell.z = "#,##0"
    }
  }

  // data + sum row
  for (let r = dataStartRow0; r <= Math.max(dataEndRow0, sumRow0); r++) {
    const isSumRow = r === sumRow0
    for (let c = 0; c <= lastCol; c++) {
      // 1) default: center hết
      styleCell(ws, r, c, {
        font: isSumRow ? { bold: true } : undefined,
        alignment: {
          vertical: "center",
          horizontal: "center",
          wrapText: true,
        },
        fill: isSumRow
          ? { patternType: "solid", fgColor: { rgb: "EEF2F7" } }
          : undefined,
        border: BORDER_THIN,
      })

      // 2) override riêng cột tên: LEFT
      if (c === COL.TEN) {
        styleCell(ws, r, c, {
          alignment: {
            vertical: "center",
            horizontal: "left",
            wrapText: true,
          },
        })
      }

      const addr = XLSX.utils.encode_cell({ r, c })
      const cell = (ws as any)[addr]
      if (!cell) continue

      if (c === COL.NGAY) cell.z = "dd/mm/yyyy"
      if ([COL.TONGTIEN, COL.DTKHAC, COL.NIEMYET, COL.GIAMINV].includes(c))
        cell.z = "#,##0"
      if (c === COL.GOIHOADON) cell.z = "0"
      if (c === COL.STT) cell.z = "0"
    }
  }
}

// --------------------
// build 1 sheet for 1 dealer
// --------------------
function buildThuGiaVonSheetForDealer(args: {
  templateWorkbook: XLSX.WorkBook
  templateSheetName: string
  salesRows: ExcelRow[]
  dealerPicked: string
  categoryPicked?: string
  onLog?: (...args: any[]) => void
}) {
  const { templateWorkbook, templateSheetName, salesRows, dealerPicked } = args
  const log = args.onLog || (() => {})
  const categoryPicked = String(args.categoryPicked ?? "").trim()

  const templateSheet = templateWorkbook.Sheets[templateSheetName]
  if (!templateSheet) {
    throw new Error(
      `Không tìm thấy sheet "${templateSheetName}" trong file mẫu`
    )
  }

  const picker = buildSalesPicker(salesRows)

  // group rows by category for chosen dealer
  const groups = new Map<string, ExcelRow[]>()
  for (const r of salesRows) {
    const dealerKey = picker.H.DAILY || "Tên đại lý"
    const dealerName = String(
      (r as any)[dealerKey] ?? (r as any)["Tên đại lý"] ?? ""
    ).trim()

    if (!dealerName || dealerName !== dealerPicked) continue

    const category = String((r as any)["Loại sản phẩm"] ?? "").trim() || "KHÁC"
    if (categoryPicked && category !== categoryPicked) continue

    if (!groups.has(category)) groups.set(category, [])
    groups.get(category)!.push(r)
  }

  if (groups.size === 0) {
    return null // ✅ để chế độ ALL bỏ qua dealer không có data
  }

  const ws = deepCloneSheet(templateSheet)
  const aoa0 = getSheetAOA(ws)

  const headerRow0 = findFinalHeaderRow0(aoa0)
  if (headerRow0 === -1) {
    throw new Error(
      "Không dò được dòng header cuối (cần có: Ngày tháng/Ngày phát sinh + MST + Tên công ty)."
    )
  }

  const { COL, lastCol } = mapTemplateCols(aoa0, headerRow0)
  const dataStartRow0 = headerRow0 + 2
  let footerLabelRow0 = findFooterLabelRow0(aoa0)

  // sorted categories => stable output
  const categories = Array.from(groups.keys()).sort((a, b) =>
    a.localeCompare(b, "vi")
  )
  const totalRows = categories.reduce(
    (sum, k) => sum + (groups.get(k)?.length || 0),
    0
  )

  let sumRow0 =
    footerLabelRow0 !== -1 ? footerLabelRow0 - 1 : dataStartRow0 + totalRows

  // if fixed footer and data longer => insert
  if (footerLabelRow0 !== -1) {
    const available = sumRow0 - dataStartRow0
    if (totalRows > available) {
      const need = totalRows - available
      log("🔧 Insert rows to fit ALL data:", { dealer: dealerPicked, need })
      insertRows(ws, footerLabelRow0, need)
      footerLabelRow0 += need
      sumRow0 += need
    }
  }

  const dataEndRow0 = dataStartRow0 + totalRows - 1

  // header cells (template positions)
  setCellRC(ws, 0, 6, dealerPicked) // G1
  setCellRC(ws, 5, 1, dealerPicked) // B6

  // unmerge only data area
  if (dataEndRow0 >= dataStartRow0) {
    unmergeInRange(ws, dataStartRow0, dataEndRow0)
  }

  // fill data
  let stt = 1
  let cursor = dataStartRow0
  for (const cat of categories) {
    const rows = groups.get(cat) || []
    for (let i = 0; i < rows.length; i++) {
      const r0 = cursor + i
      const row = rows[i] as any

      setCellRC(ws, r0, COL.STT, stt++)

      if (COL.NGAY !== -1)
        setCellRC(
          ws,
          r0,
          COL.NGAY,
          formatExcelDate(row[picker.H.NGAY] ?? row["Ngày tháng"])
        )

      if (COL.MST !== -1)
        setCellRC(
          ws,
          r0,
          COL.MST,
          String(row[picker.H.MST] ?? row["MST"] ?? "").trim()
        )

      if (COL.TEN !== -1)
        setCellRC(
          ws,
          r0,
          COL.TEN,
          String(row[picker.H.TEN] ?? row["Tên công ty"] ?? "").trim()
        )

      setCellRC(ws, r0, COL.TONGTIEN, num(row[picker.H.TONGTIEN]))
      setCellRC(ws, r0, COL.GOIHOADON, num(row[picker.H.GOI]))
      setCellRC(ws, r0, COL.DTKHAC, num(row[picker.H.DTKHAC]))
      setCellRC(ws, r0, COL.NIEMYET, num(row[picker.H.NIEMYET]))
      setCellRC(ws, r0, COL.GIAMINV, num(row[picker.H.GIAMINV]))

      if (COL.GHICHU !== -1)
        setCellRC(
          ws,
          r0,
          COL.GHICHU,
          String(row[picker.H.GHICHU] ?? row["ghi chú"] ?? "").trim()
        )
    }
    cursor += rows.length
  }

  // SUM row
  const startRow1 = dataStartRow0 + 1
  const lastRow1 = dataEndRow0 + 1
  const safeSUM = (c0: number) => {
    if (c0 == null || c0 < 0) return
    const col = XLSX.utils.encode_col(c0)
    setCellRC(ws, sumRow0, c0, {
      t: "n",
      f: `SUM(${col}${startRow1}:${col}${lastRow1})`,
      v: 0,
    })
  }
  safeSUM(COL.TONGTIEN)
  safeSUM(COL.GOIHOADON)
  safeSUM(COL.DTKHAC)
  safeSUM(COL.NIEMYET)
  safeSUM(COL.GIAMINV)
  // copy tổng GIAMINV xuống dòng dưới (để không bị trống)
  if (COL.GIAMINV !== -1) {
    const src = XLSX.utils.encode_cell({ r: sumRow0, c: COL.GIAMINV })
    const dst = XLSX.utils.encode_cell({ r: sumRow0 + 1, c: COL.GIAMINV })
    const cell = (ws as any)[src]
    if (cell) (ws as any)[dst] = { ...cell }
  }

  // styles
  applyStyles(
    ws,
    aoa0,
    headerRow0,
    dataStartRow0,
    dataEndRow0,
    sumRow0,
    footerLabelRow0,
    COL,
    lastCol
  )

  ensureRefIncludes(ws, Math.max(sumRow0, footerLabelRow0), lastCol)

  return {
    ws,
    // sheet name trong workbook output
    outSheetNameBase: `${dealerPicked} - THU GIÁ VỐN`,
  }
}

// --------------------
// main export (single dealer OR ALL dealers)
// --------------------
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

  // ✅ danh sách dealer để chạy
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
      appendedSheetNames.push(outSheetName) // ✅ thêm dòng này

      appended++
    } catch (e: any) {
      errors.push(`[${dealerPicked}] ${e?.message ?? String(e)}`)
    }
  }

  if (appended === 0) {
    // nếu ALL mà không append được sheet nào -> báo lỗi rõ
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

  const timestamp = new Date().toISOString().slice(0, 10).replace(/-/g, "")
  ;(outWb as any).Workbook = (outWb as any).Workbook || {}
  ;(outWb as any).Workbook.CalcPr = { fullCalcOnLoad: true }

  const fileName = isAll
    ? `MAU-THU-GIA-VON-ALL-${timestamp}.xlsx`
    : `MAU-THU-GIA-VON-${sanitizeSheetName(dealers[0])}-${timestamp}.xlsx`

  // (optional) log lỗi (nếu ALL, có dealer fail nhưng vẫn còn dealer ok)
  if (isAll && errors.length) {
    log("⚠️ Some dealers failed:", errors)
  }

  // 1) xuất từ xlsx-js-style ra ArrayBuffer
  const xlsxBuf = XLSX.write(outWb, {
    bookType: "xlsx",
    type: "array",
  }) as ArrayBuffer

  // 2) load logo PNG từ public (bạn đặt file ở /public/logo_minvoice.png)
  const logoBase64 = await fetchPngAsBase64("/images/logo_minvoice.png")

  // 3) chèn logo vào A1 bằng ExcelJS
  let buf = xlsxBuf

  for (const sn of appendedSheetNames) {
    buf = await addLogoToA1ExcelJS(buf, sn, logoBase64)
  }

  downloadArrayBuffer(buf, fileName)
}
