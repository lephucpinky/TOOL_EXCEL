import * as XLSX from "xlsx-js-style"
import {
  addrRC,
  buildSalesIndex,
  clearDataKeepStyle,
  copyRowStyleBlock,
  ensureCell,
  findRowContains,
  findTitleRowA,
  insertRows,
  normalize,
  patchCellStyle,
  pickHeaderFromIndex,
  setCell,
  setFormulaKeepStyle,
  setTextKeepStyle,
  toNumber,
  unmergeInRange,
  type ExcelRow,
} from "@/utils/excel"
import {
  BORDER_THICK,
  BORDER_THIN,
  COL_HOA_HONG,
  HOA_HONG_COL_WIDTHS,
  NUM_PARENS_FMT,
  sumTargets,
} from "@/constants/Mauhoahong"

let _exemptTncnSet: Set<string> | null = null

type Sec = "A" | "B" | "C" | "D" | "E" | "F" | "G" | "H"
const SECS: Sec[] = ["A", "B", "C", "D", "E", "F", "G", "H"]

export const pickSheetNameChiHoaHong = (
  workbook: XLSX.WorkBook,
  preferred?: string
) => {
  if (preferred && workbook.SheetNames.includes(preferred)) return preferred

  const names = workbook.SheetNames.map((raw) => ({ raw, n: normalize(raw) }))
  for (const candidate of [
    "MẪU CHI HOA HỒNG",
    "CHI HOA HONG",
    "HOA HONG",
    "Sheet1",
  ]) {
    const hit = names.find((x) => x.n.includes(normalize(candidate)))
    if (hit) return hit.raw
  }

  return workbook.SheetNames[0] || ""
}

export const extractAgencyNameFromTemplate = (ws: XLSX.WorkSheet) => {
  const ref = (ws as any)["!ref"] || "A1"
  const range = XLSX.utils.decode_range(ref)
  const maxR = Math.min(range.e.r, range.s.r + 80)
  const maxC = Math.min(range.e.c, range.s.c + 25)

  for (let r = range.s.r; r <= maxR; r++) {
    for (let c = range.s.c; c <= maxC; c++) {
      const addr = XLSX.utils.encode_cell({ r, c })
      const s = normalize((ws as any)[addr]?.v ?? "")
      if (!s) continue

      if (s.includes(normalize("ĐẠI LÝ/CTV"))) {
        const vAddr = XLSX.utils.encode_cell({ r, c: c + 2 })
        const v2 = (ws as any)[vAddr]?.v
        const name = String(v2 ?? "").trim()
        if (name) return name

        const rightAddr = XLSX.utils.encode_cell({ r, c: c + 1 })
        const rightV = (ws as any)[rightAddr]?.v
        const nameRight = String(rightV ?? "").trim()
        if (nameRight) return nameRight
      }
    }
  }
  return ""
}

export const getExemptTncnAgentsClient = async () => {
  if (_exemptTncnSet) return _exemptTncnSet

  const res = await fetch("/templates/DS DL KO CHỊU THUẾ TNCN.xlsx")
  if (!res.ok) {
    throw new Error("Không tải được file DS DL KO CHỊU THUẾ TNCN.xlsx")
  }

  const ab = await res.arrayBuffer()
  const wb = XLSX.read(ab, { type: "array" })
  const ws = wb.Sheets[wb.SheetNames[0]]
  const ref = (ws as any)["!ref"] || "A1"
  const range = XLSX.utils.decode_range(ref)

  const s = new Set<string>()
  for (let r = range.s.r; r <= range.e.r; r++) {
    const addr = XLSX.utils.encode_cell({ r, c: 0 })
    const key = normalize((ws as any)[addr]?.v ?? "")
    if (key) s.add(key)
  }

  _exemptTncnSet = s
  return s
}

export const mergeCells = (
  ws: XLSX.WorkSheet,
  r0: number,
  cStart0: number,
  cEnd0: number
) => {
  const merges = ((ws as any)["!merges"] || []) as XLSX.Range[]
  merges.push({ s: { r: r0, c: cStart0 }, e: { r: r0, c: cEnd0 } })
  ;(ws as any)["!merges"] = merges
}

export const mergeRange = (
  ws: XLSX.WorkSheet,
  rStart0: number,
  cStart0: number,
  rEnd0: number,
  cEnd0: number
) => {
  const merges = ((ws as any)["!merges"] || []) as XLSX.Range[]
  merges.push({ s: { r: rStart0, c: cStart0 }, e: { r: rEnd0, c: cEnd0 } })
  ;(ws as any)["!merges"] = merges
}

export const setColumnWidthsHoaHong = (
  ws: XLSX.WorkSheet,
  rows?: { rA: number; rTOTAL: number }
) => {
  ws["!cols"] = HOA_HONG_COL_WIDTHS.map((wch) => ({ wch }))

  if (!rows) return

  const headerRow0 = rows.rA - 1
  for (let r0 = headerRow0; r0 <= rows.rTOTAL; r0++) {
    for (let c0 = COL_HOA_HONG.GHI_CHU + 1; c0 <= 18; c0++) {
      delete (ws as any)[addrRC(r0, c0)]
    }
  }
}

export const applyInnerThinBorders = (
  ws: XLSX.WorkSheet,
  rStart0: number,
  rEnd0: number,
  cStart0: number,
  cEnd0: number
) => {
  for (let r0 = rStart0; r0 <= rEnd0; r0++) {
    for (let c0 = cStart0; c0 <= cEnd0; c0++) {
      patchCellStyle(ws, r0, c0, { border: BORDER_THIN })
    }
  }
}

export const applyOuterThickBorder = (
  ws: XLSX.WorkSheet,
  rStart0: number,
  rEnd0: number,
  cStart0: number,
  cEnd0: number
) => {
  for (let c0 = cStart0; c0 <= cEnd0; c0++) {
    patchCellStyle(ws, rStart0, c0, {
      border: {
        ...(ensureCell(ws, rStart0, c0).s?.border || BORDER_THIN),
        top: BORDER_THICK.top,
      },
    })
    patchCellStyle(ws, rEnd0, c0, {
      border: {
        ...(ensureCell(ws, rEnd0, c0).s?.border || BORDER_THIN),
        bottom: BORDER_THICK.bottom,
      },
    })
  }

  for (let r0 = rStart0; r0 <= rEnd0; r0++) {
    patchCellStyle(ws, r0, cStart0, {
      border: {
        ...(ensureCell(ws, r0, cStart0).s?.border || BORDER_THIN),
        left: BORDER_THICK.left,
      },
    })
    patchCellStyle(ws, r0, cEnd0, {
      border: {
        ...(ensureCell(ws, r0, cEnd0).s?.border || BORDER_THIN),
        right: BORDER_THICK.right,
      },
    })
  }
}

export const applyFillRow = (
  ws: XLSX.WorkSheet,
  row0: number,
  cStart0: number,
  cEnd0: number,
  fill: any
) => {
  for (let c0 = cStart0; c0 <= cEnd0; c0++) {
    patchCellStyle(ws, row0, c0, { fill })
  }
}

export const setRowFont = (
  ws: XLSX.WorkSheet,
  row0: number,
  cStart0: number,
  cEnd0: number,
  fontPatch: any
) => {
  for (let c0 = cStart0; c0 <= cEnd0; c0++) {
    const cell = ensureCell(ws, row0, c0)
    const font0 = cell.s?.font || {}
    patchCellStyle(ws, row0, c0, { font: { ...font0, ...fontPatch } })
  }
}

export const setFontAll = (ws: XLSX.WorkSheet, name = "Times New Roman") => {
  for (const addr of Object.keys(ws)) {
    if (addr.startsWith("!")) continue
    const cell: any = (ws as any)[addr]
    const font0 = cell?.s?.font || {}
    cell.s = {
      ...(cell.s || {}),
      font: { ...font0, name },
    }
  }
}

const pickLoaiSanPhamHeader = (salesHeaders: string[], salesRows: any[]) => {
  const headers = (salesHeaders || []).filter(Boolean).map(String)
  const candidates = headers.filter((h) => {
    const nh = normalize(h)
    return (
      nh.includes(normalize("tên sp")) ||
      nh.includes(normalize("ten sp")) ||
      nh.includes(normalize("loại sp")) ||
      nh.includes(normalize("loai sp"))
    )
  })

  if (!candidates.length) return ""
  if (candidates.length === 1) return candidates[0]

  const sampleN = Math.min(200, salesRows.length)
  const score = (header: string) => {
    let sc = 0
    for (let i = 0; i < sampleN; i++) {
      const s = normalize((salesRows[i] as any)?.[header] ?? "")
      if (!s) continue
      const hit =
        s === normalize("HD") ||
        s === normalize("MTT") ||
        s === normalize("TNCN") ||
        s === normalize("BHXH") ||
        s === normalize("SMI") ||
        s === normalize("CKS") ||
        s.includes(normalize("ICA")) ||
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

const pickLoaiCodeHeader = (salesHeaders: string[], salesRows: any[]) => {
  const headers = (salesHeaders || []).filter(Boolean).map(String)
  const productCodeAliases = [
    "Mã sản phẩm",
    "Ma san pham",
    "Mã SP",
    "Ma SP",
    "Sản phẩm",
    "San pham",
    "Item Product",
    "inv_itemProduct",
    "Product Code",
  ]
  const productCodeKeys = new Set(productCodeAliases.map(normalize))
  const explicitCodeHeader = headers.find((h) => {
    const key = normalize(h)
    return (
      productCodeKeys.has(key) ||
      key.includes(normalize("mã sản phẩm")) ||
      key.includes(normalize("product code")) ||
      key.includes(normalize("item product"))
    )
  })

  if (explicitCodeHeader) return explicitCodeHeader

  const candidates = headers.filter((h) => {
    const key = normalize(h)
    return (
      key.includes(normalize("tên sp")) ||
      key.includes(normalize("ten sp")) ||
      key.includes(normalize("loại sp")) ||
      key.includes(normalize("loai sp"))
    )
  })
  if (!candidates.length) return ""

  const sampleN = Math.min(200, salesRows.length)
  const score = (header: string) => {
    let sc = 0
    for (let i = 0; i < sampleN; i++) {
      const s = normalize((salesRows[i] as any)?.[header] ?? "")
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
        s.includes(normalize("ICA")) ||
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

const pickLoaiCksTextHeader = (
  salesHeaders: string[],
  salesRows: any[],
  loaiCodeHeader: string
) => {
  const headers = (salesHeaders || []).filter(Boolean).map(String)
  const candidates = headers.filter((h) =>
    normalize(h).includes(normalize("tên sp"))
  )
  if (!candidates.length) return ""

  const pool = candidates.filter((h) => h !== loaiCodeHeader)
  const source = pool.length ? pool : candidates
  const sampleN = Math.min(200, salesRows.length)

  const score = (header: string) => {
    let sc = 0
    for (let i = 0; i < sampleN; i++) {
      const s = normalize((salesRows[i] as any)?.[header] ?? "")
      if (!s) continue

      if (
        s.includes(normalize("ICA")) ||
        s.startsWith(normalize("INT")) ||
        s.startsWith(normalize("TOKEN")) ||
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

  return source.sort((a, b) => score(b) - score(a))[0]
}

const pickTienHoaHongHeader = (salesHeaders: string[]) => {
  const headers = (salesHeaders || []).filter(Boolean).map(String)
  const moneyLabel = normalize("TIỀN HOA HỒNG")
  const byMoneyName = headers.find((h) => normalize(h).includes(moneyLabel))
  if (byMoneyName) return byMoneyName

  return headers.find((h) => {
    const raw = String(h).toLowerCase()
    const s = normalize(h)
    const looksLikeHH =
      s === normalize("hh") ||
      s === normalize("tien hoa hong") ||
      s.includes(normalize("hoa hong"))

    const isPercent =
      raw.includes("%") ||
      s.includes(normalize("phan tram")) ||
      s.includes(normalize("percent")) ||
      s.includes(normalize("ty le")) ||
      s.includes(normalize("ti le"))

    return looksLikeHH && !isPercent
  })
}

export const buildHeaderMapHH = (
  salesHeaders: string[],
  salesRows: any[] = []
) => {
  const idx = buildSalesIndex(salesHeaders)
  const pick = (...aliases: string[]) => pickHeaderFromIndex(idx, ...aliases)

  const loaiCodeHeader = pickLoaiCodeHeader(salesHeaders, salesRows)
  const productSectionHeader =
    loaiCodeHeader ||
    pickLoaiSanPhamHeader(salesHeaders, salesRows) ||
    pick(
      "Mã sản phẩm",
      "Ma san pham",
      "Mã SP",
      "Ma SP",
      "TÊN SP",
      "LOẠI SP",
      "Item Product",
      "inv_itemProduct",
      "Product Code"
    )

  return {
    LOAI: productSectionHeader,
    PRODUCT_SECTION: productSectionHeader,
    THANG: pick(
      "NGAY PHAT SINH",
      "NGAY KICH HOAT",
      "THANG PHAT SINH",
      "THÁNG",
      "Tháng",
      "thang"
    ),
    MST: pick("MST", "Mã số thuế"),
    TEN: pick("TÊN CTY", "TÊN CÔNG TY", "TÊN ĐƠN VỊ", "Tên công ty"),
    LOAI_CODE: loaiCodeHeader,
    LOAI_CKS_TEXT: pickLoaiCksTextHeader(
      salesHeaders,
      salesRows,
      loaiCodeHeader
    ),

    SOLUONG: pick("SỐ LƯỢNG", "SO LUONG", "SOLUONG", "SL"),
    DOANH_THU_SAN_PHAM: pick(
      "TỔNG TIỀN SAU THUẾ",
      "TONG TIEN SAU THUE",
      "TIỀN SAU THUẾ",
      "TIEN SAU THUE"
    ),
    GIA_DOI_SOAT: pick("Giá đối soát", "GIÁ ĐỐI SOÁT", "GIA DOI SOAT"),

    TIEN_HOA_HONG:
      pickTienHoaHongHeader(salesHeaders) ||
      pick("TIỀN HOA HỒNG", "TIEN HOA HONG", "HH"),
    PHI_VIET_CHENH: pick(
      "PHÍ VIẾT CHÊNH",
      "PHI VIET CHENH",
      "Phí viết chênh",
      "Phi viet chenh",
      "PRICE DIFFERENCE",
      "priceDifference"
    ),
    DT_MINVOICE: pick(
      "SỐ TIỀN",
      "SO TIEN",
      "SOTIEN",
      "SỐ TIỀN THU",
      "SO TIEN THU",
      "TIỀN THU",
      "TIEN THU",
      "M-INV DA THU",
      "M INV DA THU",
      "MINV DA THU",
      "M-INVOICE DA THU",
      "M INVOICE DA THU",
      "THU TIEN"
    ),
    GHI_CHU: pick("CHI CHÚ", "CHI CHU", "GHI CHÚ", "GHI CHU"),
    DEALER: pick(
      "Tên đại lý",
      "Đại lý",
      "Danh mục đại lý",
      "Ten Dai Ly",
      "Dai Ly",
      "Danh Muc Dai Ly",
      "Dealer",
      "Agency",
      "CTV"
    ),
    CATEGORY: pick("PHÒNG BAN", "Danh mục", "Category") || "",
  }
}

export const validateHeaderMapHH = (H: ReturnType<typeof buildHeaderMapHH>) => {
  const missing: string[] = []

  ;[
    ["MÃ SẢN PHẨM", H.PRODUCT_SECTION || H.LOAI_CODE || H.LOAI],
    ["NGÀY KÍCH HOẠT", H.THANG],
    ["MST", H.MST],
    ["TÊN CTY", H.TEN],
    ["SỐ LƯỢNG", H.SOLUONG],
    ["TỔNG TIỀN SAU THUẾ", H.DOANH_THU_SAN_PHAM],
    ["GIÁ ĐỐI SOÁT", H.GIA_DOI_SOAT],
    ["PHÍ VIẾT CHÊNH", H.PHI_VIET_CHENH],
    ["SỐ TIỀN", H.DT_MINVOICE],
    ["Đại Lý", H.DEALER],
  ].forEach(([label, value]) => {
    if (!value) missing.push(label as string)
  })

  if (missing.length) {
    throw new Error(
      "❌ Thiếu cột trong file theo dõi doanh số: " +
        Array.from(new Set(missing)).join(", ")
    )
  }
}

export const classifyProductToSectionHoaHong = (v: any): Sec => {
  const s = normalize(v)
  const productCode = s.replace(/\d+$/, "")

  if (
    productCode === normalize("HD") ||
    s.includes("hddt") ||
    s.includes("hoadondientu") ||
    (s.includes("hoadon") && s.includes("dientu"))
  )
    return "A"

  if (
    productCode === normalize("MTT") ||
    s.includes("maytinhtien") ||
    s.includes("may tinh tien")
  )
    return "B"

  if (
    productCode === normalize("TNCN") ||
    s.includes("tncn") ||
    s.includes("khautru") ||
    s.includes("khau tru") ||
    s.includes("chungtu") ||
    s.includes("chung tu")
  )
    return "C"

  if (productCode === normalize("BHXH") || s.includes("bhxh")) return "D"
  if (productCode === normalize("SMI") || s.includes("smi")) return "E"
  if (productCode === normalize("XANG") || s.includes("xang")) return "F"

  if (
    s.includes(normalize("ICA")) ||
    s.startsWith(normalize("INT")) ||
    s.startsWith(normalize("EAS")) ||
    s.startsWith(normalize("TOKEN")) ||
    s.includes("cks") ||
    s.includes("chukyso") ||
    s.includes("chu ky so") ||
    s.includes("chukiso")
  )
    return "G"

  return "H"
}

export const resolveTemplateRowsHoaHong = (ws: XLSX.WorkSheet) => {
  const rA = findRowContains(ws, "A. GIÁ TRỊ HÓA ĐƠN ĐIỆN TỬ", {
    scanRows: 500,
    scanCols: 30,
  })
  const rB = findRowContains(ws, "B. MÁY TÍNH TIỀN", {
    scanRows: 500,
    scanCols: 30,
  })
  const rC = findRowContains(ws, "C. CHỨNG TỪ KHẤU TRỪ THUẾ TNCN", {
    scanRows: 800,
    scanCols: 30,
  })
  const rD = findRowContains(ws, "D. BHXH", { scanRows: 800, scanCols: 30 })
  const rE = findRowContains(ws, "E. QUẢN LÝ HÓA ĐƠN SMI", {
    scanRows: 1000,
    scanCols: 30,
  })
  const rF = findRowContains(ws, "F. XĂNG DẦU", { scanRows: 800, scanCols: 30 })
  const rG = findRowContains(ws, "G. GIÁ TRỊ CHỮ KÝ SỐ", {
    scanRows: 1200,
    scanCols: 30,
  })
  let rH = findRowContains(ws, "H. KHAC", { scanRows: 1500, scanCols: 30 })
  if (rH === -1) {
    rH = findRowContains(ws, "H. KHÁC", { scanRows: 1500, scanCols: 30 })
  }

  const rTOTAL = findTitleRowA(ws, "CỘNG", {
    startsWith: false,
    scanRows: 5000,
  })

  if ([rA, rB, rC, rD, rE, rF, rG, rH, rTOTAL].some((x) => x === -1)) {
    throw new Error(
      "❌ Không tìm thấy đủ khu A..H hoặc dòng CỘNG trong template."
    )
  }

  return { rA, rB, rC, rD, rE, rF, rG, rH, rTOTAL }
}

export const ensureAllSectionsHaveSpaceHoaHong = (
  ws: XLSX.WorkSheet,
  filteredRows: ExcelRow[],
  H_LOAI: string
) => {
  const group: Record<Sec, ExcelRow[]> = {
    A: [],
    B: [],
    C: [],
    D: [],
    E: [],
    F: [],
    G: [],
    H: [],
  }

  filteredRows.forEach((row) => {
    const sec = classifyProductToSectionHoaHong((row as any)[H_LOAI])
    group[sec].push(row)
  })

  const maxCol = COL_HOA_HONG.GHI_CHU

  const ensureSpace = (
    sec: Sec,
    titleLabel: string,
    boundaryLabel: string,
    boundaryExact = false
  ) => {
    const titleRow = findRowContains(ws, titleLabel, {
      scanRows: 2000,
      scanCols: 30,
    })
    const boundaryRow = boundaryExact
      ? findTitleRowA(ws, boundaryLabel, { startsWith: false, scanRows: 5000 })
      : findRowContains(ws, boundaryLabel, { scanRows: 2000, scanCols: 30 })

    if (titleRow === -1 || boundaryRow === -1) return

    const start = titleRow + 1
    const placeholder = Math.max(0, boundaryRow - start)
    const needInsert = Math.max(0, group[sec].length - placeholder)
    if (needInsert <= 0) return

    insertRows(ws, boundaryRow, needInsert)
    const srcStyleRow0 = Math.max(titleRow + 1, boundaryRow - 1)
    copyRowStyleBlock(ws, srcStyleRow0, boundaryRow, needInsert, 0, maxCol)
  }

  ensureSpace("H", "H. KHAC", "CỘNG", true)
  ensureSpace("G", "G. GIÁ TRỊ CHỮ KÝ SỐ", "H. KHAC")
  ensureSpace("F", "F. XĂNG DẦU", "G. GIÁ TRỊ CHỮ KÝ SỐ")
  ensureSpace("E", "E. QUẢN LÝ HÓA ĐƠN SMI", "F. XĂNG DẦU")
  ensureSpace("D", "D. BHXH", "E. QUẢN LÝ HÓA ĐƠN SMI")
  ensureSpace("C", "C. CHỨNG TỪ KHẤU TRỪ THUẾ TNCN", "D. BHXH")
  ensureSpace("B", "B. MÁY TÍNH TIỀN", "C. CHỨNG TỪ KHẤU TRỪ THUẾ TNCN")
  ensureSpace("A", "A. GIÁ TRỊ HÓA ĐƠN ĐIỆN TỬ", "B. MÁY TÍNH TIỀN")

  return group
}

export const clearAllSectionBlocksHoaHong = (
  ws: XLSX.WorkSheet,
  rows: ReturnType<typeof resolveTemplateRowsHoaHong>
) => {
  Object.assign(rows, resolveTemplateRowsHoaHong(ws))

  const numericCols = new Set<number>([
    COL_HOA_HONG.STT,
    COL_HOA_HONG.SOLUONG,
    COL_HOA_HONG.DOANH_THU_SAN_PHAM,
    COL_HOA_HONG.PHI_VIET_CHENH,
    COL_HOA_HONG.GIA_TRI_XUAT_HOA_DON,
    COL_HOA_HONG.GIA_DOI_SOAT,
    COL_HOA_HONG.TIEN_HOA_HONG,
    COL_HOA_HONG.CHENH_LECH_VIET_CHENH,
    COL_HOA_HONG.TONG_TIEN_TRA_DOI_TAC,
    COL_HOA_HONG.MINV_DA_THU,
    COL_HOA_HONG.CHENH_LECH_THANH_TOAN,
  ])

  const isNumericCol = (c0: number) => numericCols.has(c0)
  const clearBlock = (startRow0: number, endRow0: number) => {
    if (endRow0 < startRow0) return
    clearDataKeepStyle(
      ws,
      startRow0,
      endRow0,
      0,
      COL_HOA_HONG.GHI_CHU,
      isNumericCol
    )
    unmergeInRange(ws, startRow0, endRow0)
  }

  clearBlock(rows.rA + 1, rows.rB - 1)
  clearBlock(rows.rB + 1, rows.rC - 1)
  clearBlock(rows.rC + 1, rows.rD - 1)
  clearBlock(rows.rD + 1, rows.rE - 1)
  clearBlock(rows.rE + 1, rows.rF - 1)
  clearBlock(rows.rF + 1, rows.rG - 1)
  clearBlock(rows.rG + 1, rows.rH - 1)
  clearBlock(rows.rH + 1, rows.rTOTAL - 1)
}

export const fillAllSectionsHoaHong = (
  ws: XLSX.WorkSheet,
  rows: ReturnType<typeof resolveTemplateRowsHoaHong>,
  group: Record<Sec, ExcelRow[]>,
  H: ReturnType<typeof buildHeaderMapHH>
) => {
  const start: Record<Sec, number> = {
    A: rows.rA + 1,
    B: rows.rB + 1,
    C: rows.rC + 1,
    D: rows.rD + 1,
    E: rows.rE + 1,
    F: rows.rF + 1,
    G: rows.rG + 1,
    H: rows.rH + 1,
  }

  const isEmptyValue = (v: any) => v == null || String(v).trim() === ""
  const setNumKeepStyle = (r0: number, c0: number, value: any) => {
    const addr = addrRC(r0, c0)
    const keepS = (ws as any)[addr]?.s
    const keepZ = (ws as any)[addr]?.z
    const vNum = isEmptyValue(value) ? 0 : toNumber(value)

    ;(ws as any)[addr] = {
      t: "n",
      v: vNum,
      s: keepS,
      z: keepZ || NUM_PARENS_FMT,
    }

    patchCellStyle(ws, r0, c0, { numFmt: keepZ || NUM_PARENS_FMT })
  }

  const fillSection = (sec: Sec) => {
    const rowsData = group[sec]
    for (let i = 0; i < rowsData.length; i++) {
      const r0 = start[sec] + i
      const row = rowsData[i] as any

      setCell(ws, r0, COL_HOA_HONG.STT, i + 1, { kind: "stt", force: true })
      setCell(ws, r0, COL_HOA_HONG.NGAYPHATSINH, row[H.THANG], {
        kind: "text",
        force: true,
      })
      setCell(ws, r0, COL_HOA_HONG.MASOTHUE, row[H.MST], {
        kind: "text",
        force: true,
      })
      setCell(ws, r0, COL_HOA_HONG.TENDONVI, row[H.TEN], {
        kind: "text",
        force: true,
      })

      const soLuong = H.SOLUONG ? row[H.SOLUONG] : 0
      const doanhThuSanPham = H.DOANH_THU_SAN_PHAM
        ? row[H.DOANH_THU_SAN_PHAM]
        : 0
      const giadoisoat = H.GIA_DOI_SOAT ? row[H.GIA_DOI_SOAT] : 0
      const phiVietChenhRaw = H.PHI_VIET_CHENH ? row[H.PHI_VIET_CHENH] : ""
      const phiVietChenh = isEmptyValue(phiVietChenhRaw)
        ? (toNumber(doanhThuSanPham) - toNumber(giadoisoat)) * 0.15
        : phiVietChenhRaw

      setNumKeepStyle(r0, COL_HOA_HONG.SOLUONG, soLuong)
      setNumKeepStyle(r0, COL_HOA_HONG.DOANH_THU_SAN_PHAM, doanhThuSanPham)
      setNumKeepStyle(r0, COL_HOA_HONG.PHI_VIET_CHENH, phiVietChenh)
      setFormulaKeepStyle(
        ws,
        r0,
        COL_HOA_HONG.GIA_TRI_XUAT_HOA_DON,
        `=${addrRC(r0, COL_HOA_HONG.DOANH_THU_SAN_PHAM)}+${addrRC(r0, COL_HOA_HONG.PHI_VIET_CHENH)}`
      )

      setNumKeepStyle(r0, COL_HOA_HONG.GIA_DOI_SOAT, giadoisoat)
      setFormulaKeepStyle(
        ws,
        r0,
        COL_HOA_HONG.TIEN_HOA_HONG,
        `=${addrRC(r0, COL_HOA_HONG.GIA_DOI_SOAT)}*50%`
      )
      setFormulaKeepStyle(
        ws,
        r0,
        COL_HOA_HONG.CHENH_LECH_VIET_CHENH,
        `=${addrRC(r0, COL_HOA_HONG.PHI_VIET_CHENH)}*85%`
      )
      setFormulaKeepStyle(
        ws,
        r0,
        COL_HOA_HONG.TONG_TIEN_TRA_DOI_TAC,
        `=${addrRC(r0, COL_HOA_HONG.TIEN_HOA_HONG)}+${addrRC(r0, COL_HOA_HONG.CHENH_LECH_VIET_CHENH)}`
      )
      setNumKeepStyle(r0, COL_HOA_HONG.MINV_DA_THU, row[H.DT_MINVOICE])
      setFormulaKeepStyle(
        ws,
        r0,
        COL_HOA_HONG.CHENH_LECH_THANH_TOAN,
        `=${addrRC(r0, COL_HOA_HONG.GIA_TRI_XUAT_HOA_DON)}-${addrRC(r0, COL_HOA_HONG.MINV_DA_THU)}`
      )

      if (H.GHI_CHU) {
        setCell(ws, r0, COL_HOA_HONG.GHI_CHU, row[H.GHI_CHU], {
          kind: "text",
          force: true,
        })
      }
    }
  }

  SECS.forEach(fillSection)
}

const deleteRows = (ws: XLSX.WorkSheet, startRow0: number, nRows: number) => {
  if (nRows <= 0) return

  const newWs: XLSX.WorkSheet = { ...ws }
  const keys = Object.keys(newWs).filter((k) => !k.startsWith("!"))

  keys
    .map((addr) => ({ addr, cell: (newWs as any)[addr] }))
    .sort(
      (a, b) =>
        XLSX.utils.decode_cell(a.addr).r - XLSX.utils.decode_cell(b.addr).r
    )
    .forEach(({ addr, cell }) => {
      const { r, c } = XLSX.utils.decode_cell(addr)
      if (r >= startRow0 && r < startRow0 + nRows) {
        delete (newWs as any)[addr]
        return
      }
      if (r >= startRow0 + nRows) {
        const newAddr = XLSX.utils.encode_cell({ r: r - nRows, c })
        ;(newWs as any)[newAddr] = cell
        delete (newWs as any)[addr]
      }
    })

  const merges = ((newWs as any)["!merges"] || []) as XLSX.Range[]
  const kept: XLSX.Range[] = []
  for (const m of merges) {
    if (m.e.r < startRow0) kept.push(m)
    else if (m.s.r >= startRow0 + nRows) {
      kept.push({
        s: { r: m.s.r - nRows, c: m.s.c },
        e: { r: m.e.r - nRows, c: m.e.c },
      })
    } else if (m.s.r < startRow0 && m.e.r >= startRow0 + nRows) {
      kept.push({
        s: { r: m.s.r, c: m.s.c },
        e: { r: m.e.r - nRows, c: m.e.c },
      })
    }
  }
  ;(newWs as any)["!merges"] = kept

  const ref = (newWs as any)["!ref"] || "A1"
  const range = XLSX.utils.decode_range(ref)
  range.e.r = Math.max(range.s.r, range.e.r - nRows)
  ;(newWs as any)["!ref"] = XLSX.utils.encode_range(range)

  Object.keys(ws).forEach((k) => delete (ws as any)[k])
  Object.assign(ws, newWs)
}

export const compactSectionsHoaHong = (
  ws: XLSX.WorkSheet,
  group: Record<Sec, ExcelRow[]>
) => {
  let rows = resolveTemplateRowsHoaHong(ws)

  const compactBetween = (
    titleRow0: number,
    nextTitleRow0: number,
    dataLen: number
  ) => {
    const start = titleRow0 + 1 + Math.max(0, dataLen)
    const end = nextTitleRow0 - 1
    const nDel = Math.max(0, end - start + 1)
    if (nDel > 0) deleteRows(ws, start, nDel)
  }

  rows = resolveTemplateRowsHoaHong(ws)
  compactBetween(rows.rH, rows.rTOTAL, group.H.length)
  rows = resolveTemplateRowsHoaHong(ws)
  compactBetween(rows.rG, rows.rH, group.G.length)
  rows = resolveTemplateRowsHoaHong(ws)
  compactBetween(rows.rF, rows.rG, group.F.length)
  rows = resolveTemplateRowsHoaHong(ws)
  compactBetween(rows.rE, rows.rF, group.E.length)
  rows = resolveTemplateRowsHoaHong(ws)
  compactBetween(rows.rD, rows.rE, group.D.length)
  rows = resolveTemplateRowsHoaHong(ws)
  compactBetween(rows.rC, rows.rD, group.C.length)
  rows = resolveTemplateRowsHoaHong(ws)
  compactBetween(rows.rB, rows.rC, group.B.length)
  rows = resolveTemplateRowsHoaHong(ws)
  compactBetween(rows.rA, rows.rB, group.A.length)

  return resolveTemplateRowsHoaHong(ws)
}

const setSectionSumRow = (
  ws: XLSX.WorkSheet,
  titleRow0: number,
  dataStartRow0: number,
  dataEndRow0: number
) => {
  const rStart1 = dataStartRow0 + 1
  const rEnd1 = dataEndRow0 + 1
  const mkSum = (colIdx: number) => {
    const col = XLSX.utils.encode_col(colIdx)
    return dataEndRow0 >= dataStartRow0
      ? `SUM(${col}${rStart1}:${col}${rEnd1})`
      : "0"
  }

  sumTargets.forEach((c0) => {
    setFormulaKeepStyle(ws, titleRow0, c0, `=${mkSum(c0)}`, NUM_PARENS_FMT)
  })

  setTextKeepStyle(ws, titleRow0, COL_HOA_HONG.GHI_CHU, "")
}

export const applyAllSectionSumsHoaHong = (
  ws: XLSX.WorkSheet,
  rows: ReturnType<typeof resolveTemplateRowsHoaHong>,
  group: Record<Sec, ExcelRow[]>
) => {
  const start: Record<Sec, number> = {
    A: rows.rA + 1,
    B: rows.rB + 1,
    C: rows.rC + 1,
    D: rows.rD + 1,
    E: rows.rE + 1,
    F: rows.rF + 1,
    G: rows.rG + 1,
    H: rows.rH + 1,
  }

  const end: Record<Sec, number> = {
    A: start.A + group.A.length - 1,
    B: start.B + group.B.length - 1,
    C: start.C + group.C.length - 1,
    D: start.D + group.D.length - 1,
    E: start.E + group.E.length - 1,
    F: start.F + group.F.length - 1,
    G: start.G + group.G.length - 1,
    H: start.H + group.H.length - 1,
  }

  setSectionSumRow(ws, rows.rA, start.A, end.A)
  setSectionSumRow(ws, rows.rB, start.B, end.B)
  setSectionSumRow(ws, rows.rC, start.C, end.C)
  setSectionSumRow(ws, rows.rD, start.D, end.D)
  setSectionSumRow(ws, rows.rE, start.E, end.E)
  setSectionSumRow(ws, rows.rF, start.F, end.F)
  setSectionSumRow(ws, rows.rG, start.G, end.G)
  setSectionSumRow(ws, rows.rH, start.H, end.H)
}

export const applyGrandTotalHoaHong = (
  ws: XLSX.WorkSheet,
  rows: ReturnType<typeof resolveTemplateRowsHoaHong>
) => {
  const titleRows0 = [
    rows.rA,
    rows.rB,
    rows.rC,
    rows.rD,
    rows.rE,
    rows.rF,
    rows.rG,
    rows.rH,
  ]

  const mk = (c0: number) => {
    const col = XLSX.utils.encode_col(c0)
    return titleRows0.map((r0) => `${col}${r0 + 1}`).join("+")
  }

  sumTargets.forEach((c0) => {
    setFormulaKeepStyle(ws, rows.rTOTAL, c0, `=${mk(c0)}`, NUM_PARENS_FMT)
  })

  setTextKeepStyle(ws, rows.rTOTAL, COL_HOA_HONG.GHI_CHU, "")
}
