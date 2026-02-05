import * as XLSX from "xlsx-js-style"
import type { ExcelRow } from "@/utils/excel"
import {
  ensureRefIncludes,
  insertRows,
  normalize,
  setCell,
  unmergeInRange,
} from "@/utils/excel"
import {
  addrRC,
  copyRowStyleBlock,
  clearDataKeepStyle,
  findTitleRowA,
  setFormulaKeepStyle,
} from "./hoahong.excel"
import { COL_HOA_HONG } from "@/constants/Mauhoahong"

/* -------------------------------
   header index
-------------------------------- */

export const buildSalesIndex = (salesHeaders: string[]) => {
  const headers = Array.isArray(salesHeaders)
    ? salesHeaders.filter(Boolean)
    : []
  const idx = new Map<string, string>()
  headers.forEach((h) => {
    const k = normalize(h)
    if (k && !idx.has(k)) idx.set(k, h)
  })
  return idx
}

export const pickHeaderFromIndex = (
  idx: Map<string, string>,
  ...aliases: string[]
) => {
  for (const a of aliases) {
    const h = idx.get(normalize(a))
    if (h) return h
  }
  return ""
}

/* -------------------------------
   classify section
-------------------------------- */

export const classifyProductToSectionHoaHong = (
  v: any
): "A" | "B" | "C" | "D" | "E" | "F" | "G" | "" => {
  const s = normalize(v)

  if (
    (s.includes("hoadon") && s.includes("dientu")) ||
    s.includes("hoadondientu") ||
    s.includes("hddt") ||
    ((s.includes("tem") || s.includes("ve") || s.includes("the")) &&
      s.includes("dientu"))
  )
    return "A"

  if (
    (s.includes("hoadon") && s.includes("maytinhtien")) ||
    s.includes("maytinhtien") ||
    s.includes("mtt")
  )
    return "B"

  if (s.includes("khautru") || s.includes("tncn") || s.includes("chungtu"))
    return "C"
  if (s.includes("bhxh")) return "D"
  if (s.includes("smi")) return "E"

  if (
    s.includes("msller") ||
    s.includes("mseller") ||
    (s.includes("pm") && s.includes("banhang"))
  )
    return "F"

  if (s.includes("cks") || s.includes("chukyso") || s.includes("chukiso"))
    return "G"

  return ""
}

/* -------------------------------
   template row positions
-------------------------------- */

export const resolveTemplateRows = (ws: XLSX.WorkSheet) => {
  const rA = findTitleRowA(ws, "A. GIÁ TRỊ HÓA ĐƠN ĐIỆN TỬ", {
    startsWith: true,
  })
  const rB = findTitleRowA(ws, "B. MÁY TÍNH TIỀN", { startsWith: true })
  const rC = findTitleRowA(ws, "C. CHỨNG TỪ KHẤU TRỪ THUẾ TNCN", {
    startsWith: true,
  })
  const rD = findTitleRowA(ws, "D. BHXH", { startsWith: true })
  const rE = findTitleRowA(ws, "E. QUẢN LÝ HÓA ĐƠN SMI", { startsWith: true })
  const rF = findTitleRowA(ws, "F. PM BÁN HÀNG", { startsWith: true })
  const rG = findTitleRowA(ws, "G. GIÁ TRỊ CHỮ KÝ SỐ", { startsWith: true })
  const rTOTAL = findTitleRowA(ws, "CỘNG", { startsWith: false })

  if ([rA, rB, rC, rD, rE, rF, rG, rTOTAL].some((x) => x === -1)) {
    throw new Error(
      "❌ Không tìm thấy đủ khu A..G hoặc dòng CỘNG trong template HOA HỒNG."
    )
  }
  return { rA, rB, rC, rD, rE, rF, rG, rTOTAL }
}

/* -------------------------------
   ensure space bottom-up
-------------------------------- */

export const ensureAllSectionsHaveSpace = (
  ws: XLSX.WorkSheet,
  rows: ReturnType<typeof resolveTemplateRows>,
  filteredRows: ExcelRow[],
  H_LOAI: string
) => {
  const group: Record<"A" | "B" | "C" | "D" | "E" | "F" | "G", ExcelRow[]> = {
    A: [],
    B: [],
    C: [],
    D: [],
    E: [],
    F: [],
    G: [],
  }

  filteredRows.forEach((row) => {
    const sec = classifyProductToSectionHoaHong((row as any)[H_LOAI])
    if (sec) group[sec].push(row)
  })

  const maxCol = COL_HOA_HONG.GHICHU

  const ensureSpace = (
    sec: keyof typeof group,
    titleLabel: string,
    boundaryLabel: string,
    boundaryExact = false
  ) => {
    const titleRow = findTitleRowA(ws, titleLabel, { startsWith: true })
    const boundaryRow = findTitleRowA(ws, boundaryLabel, {
      startsWith: boundaryExact ? false : true,
    })
    if (titleRow === -1 || boundaryRow === -1) return

    const start = titleRow + 1
    const placeholder = Math.max(0, boundaryRow - start)
    const needInsert = Math.max(0, group[sec].length - placeholder)
    if (needInsert <= 0) return

    insertRows(ws, boundaryRow, needInsert)

    // copy style from nearest existing row
    const srcStyleRow0 = Math.max(titleRow + 1, boundaryRow - 1)
    copyRowStyleBlock(ws, srcStyleRow0, boundaryRow, needInsert, 0, maxCol)
  }

  // bottom-up
  ensureSpace("G", "G. GIÁ TRỊ CHỮ KÝ SỐ", "CỘNG", true)
  ensureSpace("F", "F. PM BÁN HÀNG", "G. GIÁ TRỊ CHỮ KÝ SỐ")
  ensureSpace("E", "E. QUẢN LÝ HÓA ĐƠN SMI", "F. PM BÁN HÀNG")
  ensureSpace("D", "D. BHXH", "E. QUẢN LÝ HÓA ĐƠN SMI")
  ensureSpace("C", "C. CHỨNG TỪ KHẤU TRỪ THUẾ TNCN", "D. BHXH")
  ensureSpace("B", "B. MÁY TÍNH TIỀN", "C. CHỨNG TỪ KHẤU TRỪ THUẾ TNCN")
  ensureSpace("A", "A. GIÁ TRỊ HÓA ĐƠN ĐIỆN TỬ", "B. MÁY TÍNH TIỀN")

  return group
}

/* -------------------------------
   clear blocks
-------------------------------- */

export const clearAllSectionBlocks = (
  ws: XLSX.WorkSheet,
  rows: ReturnType<typeof resolveTemplateRows>
) => {
  // re-resolve after insert
  const rr = resolveTemplateRows(ws)
  Object.assign(rows, rr)

  const maxCol = COL_HOA_HONG.GHICHU

  const isNumericCol = (c0: number) =>
    (c0 >= COL_HOA_HONG.SL && c0 < COL_HOA_HONG.CHENH_TT) ||
    c0 === COL_HOA_HONG.HH_PERCENT

  const clearBlock = (startRow0: number, endRow0: number) => {
    if (endRow0 < startRow0) return
    clearDataKeepStyle(ws, startRow0, endRow0, 0, maxCol, isNumericCol)
    unmergeInRange(ws, startRow0, endRow0)
  }

  clearBlock(rows.rA + 1, rows.rB - 1)
  clearBlock(rows.rB + 1, rows.rC - 1)
  clearBlock(rows.rC + 1, rows.rD - 1)
  clearBlock(rows.rD + 1, rows.rE - 1)
  clearBlock(rows.rE + 1, rows.rF - 1)
  clearBlock(rows.rF + 1, rows.rG - 1)
  clearBlock(rows.rG + 1, rows.rTOTAL - 1)
}
/* -------------------------------
   fill data
-------------------------------- */

// ✅ parse số an toàn (hỗ trợ "1,234,567" / "1.234.567" / " 1234567 ")
const toNumber = (v: any) => {
  if (v == null || v === "") return 0
  if (typeof v === "number") return Number.isFinite(v) ? v : 0

  const raw = String(v).trim()
  if (!raw) return 0

  // bỏ khoảng trắng
  let s = raw.replace(/\s+/g, "")

  // nếu có dấu phẩy (thường là thousand separator) => bỏ phẩy
  if (s.includes(",")) s = s.replace(/,/g, "")

  // nếu có dấu chấm kiểu 1.234.567 => bỏ chấm
  // (trường hợp số thập phân 123.45 thì ít gặp trong tiền, nếu bạn cần decimal thì nói mình chỉnh)
  if (s.includes(".") && /^\d{1,3}(\.\d{3})+(\.\d+)?$/.test(s)) {
    s = s.replace(/\./g, "")
  } else if (s.includes(".") && /^\d{1,3}(\.\d{3})+$/.test(s)) {
    s = s.replace(/\./g, "")
  }

  const n = Number(s)
  return Number.isFinite(n) ? n : 0
}

export const applyChenhLechTTFormulas = (
  ws: XLSX.WorkSheet,
  rows: ReturnType<typeof resolveTemplateRows>,
  group: Record<"A" | "B" | "C" | "D" | "E" | "F" | "G", ExcelRow[]>
) => {
  const start = {
    A: rows.rA + 1,
    B: rows.rB + 1,
    C: rows.rC + 1,
    D: rows.rD + 1,
    E: rows.rE + 1,
    F: rows.rF + 1,
    G: rows.rG + 1,
  } as const

  ;(["A", "B", "C", "D", "E", "F", "G"] as const).forEach((sec) => {
    for (let i = 0; i < group[sec].length; i++) {
      const r0 = start[sec] + i
      // ✅ O(row) = G(row) - N(row) theo đúng dòng hiện tại
      setFormulaKeepStyle(
        ws,
        r0,
        COL_HOA_HONG.CHENH_TT,
        `=${addrRC(r0, COL_HOA_HONG.TIEN)}-${addrRC(r0, COL_HOA_HONG.MI_THU)}`
      )
    }
  })
}

export const fillAllSections = (
  ws: XLSX.WorkSheet,
  rows: ReturnType<typeof resolveTemplateRows>,
  group: Record<"A" | "B" | "C" | "D" | "E" | "F" | "G", ExcelRow[]>,
  H: any
) => {
  const start = {
    A: rows.rA + 1,
    B: rows.rB + 1,
    C: rows.rC + 1,
    D: rows.rD + 1,
    E: rows.rE + 1,
    F: rows.rF + 1,
    G: rows.rG + 1,
  } as const

  const fillSection = (sec: keyof typeof group) => {
    const rowsData = group[sec]
    for (let i = 0; i < rowsData.length; i++) {
      const r0 = start[sec] + i
      const row = rowsData[i]

      setCell(ws, r0, COL_HOA_HONG.STT, i + 1, { kind: "stt", force: true })
      setCell(ws, r0, COL_HOA_HONG.NGAY, row[H.NGAY], {
        kind: "date",
        force: true,
      })
      setCell(ws, r0, COL_HOA_HONG.MST, row[H.MST], {
        kind: "text",
        force: true,
      })
      setCell(ws, r0, COL_HOA_HONG.TEN, row[H.TEN], {
        kind: "text",
        force: true,
      })
      setCell(ws, r0, COL_HOA_HONG.LOAIHD, row[H.LOAIHD], {
        kind: "text",
        force: true,
      })

      setCell(ws, r0, COL_HOA_HONG.SL, row[H.SL], {
        kind: "number0",
        force: true,
      })
      setCell(ws, r0, COL_HOA_HONG.TIEN, row[H.TIEN], {
        kind: "number0",
        force: true,
      })
      setCell(ws, r0, COL_HOA_HONG.GIAPP, row[H.GIAPP], {
        kind: "number0",
        force: true,
      })
      setCell(ws, r0, COL_HOA_HONG.CHENH, row[H.CHENH], {
        kind: "number0",
        force: true,
      })
      setCell(ws, r0, COL_HOA_HONG.DOANHTHUKHAC, row[H.DTK], {
        kind: "number0",
        force: true,
      })

      setCell(ws, r0, COL_HOA_HONG.HH_PERCENT, row[H.HH_PERCENT], {
        kind: "percent",
        force: true,
      })
      setCell(ws, r0, COL_HOA_HONG.PHI_TRA, row[H.PHI_TRA], {
        kind: "number0",
        force: true,
      })
      setCell(ws, r0, COL_HOA_HONG.HOA_HONG, row[H.HOA_HONG], {
        kind: "number0",
        force: true,
      })
      setCell(ws, r0, COL_HOA_HONG.MI_THU, row[H.MI_THU], {
        kind: "number0",
        force: true,
      })

      setCell(ws, r0, COL_HOA_HONG.GHICHU, H.GHICHU ? row[H.GHICHU] : "", {
        kind: "text",
        force: true,
      })
    }
  }

  ;(["A", "B", "C", "D", "E", "F", "G"] as const).forEach(fillSection)
}

/* -------------------------------
   compact rows between sections (giống VACOM)
-------------------------------- */

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

  // merges
  const merges = ((newWs as any)["!merges"] || []) as XLSX.Range[]
  const kept: XLSX.Range[] = []
  for (const m of merges) {
    if (m.e.r < startRow0) {
      kept.push(m)
      continue
    }
    if (m.s.r >= startRow0 + nRows) {
      kept.push({
        s: { r: m.s.r - nRows, c: m.s.c },
        e: { r: m.e.r - nRows, c: m.e.c },
      })
      continue
    }
    if (m.s.r < startRow0 && m.e.r >= startRow0 + nRows) {
      kept.push({
        s: { r: m.s.r, c: m.s.c },
        e: { r: m.e.r - nRows, c: m.e.c },
      })
      continue
    }
  }
  ;(newWs as any)["!merges"] = kept

  // ref
  const ref = (newWs as any)["!ref"] || "A1"
  const range = XLSX.utils.decode_range(ref)
  range.e.r = Math.max(range.s.r, range.e.r - nRows)
  ;(newWs as any)["!ref"] = XLSX.utils.encode_range(range)

  Object.keys(ws).forEach((k) => delete (ws as any)[k])
  Object.assign(ws, newWs)
}

export const compactSections = (
  ws: XLSX.WorkSheet,
  group: Record<"A" | "B" | "C" | "D" | "E" | "F" | "G", ExcelRow[]>
) => {
  // resolve current rows
  let rows = resolveTemplateRows(ws)

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

  // bottom-up (G->TOTAL, F->G,... A->B)
  rows = resolveTemplateRows(ws)
  compactBetween(rows.rG, rows.rTOTAL, group.G.length)
  rows = resolveTemplateRows(ws)
  compactBetween(rows.rF, rows.rG, group.F.length)
  rows = resolveTemplateRows(ws)
  compactBetween(rows.rE, rows.rF, group.E.length)
  rows = resolveTemplateRows(ws)
  compactBetween(rows.rD, rows.rE, group.D.length)
  rows = resolveTemplateRows(ws)
  compactBetween(rows.rC, rows.rD, group.C.length)
  rows = resolveTemplateRows(ws)
  compactBetween(rows.rB, rows.rC, group.B.length)
  rows = resolveTemplateRows(ws)
  compactBetween(rows.rA, rows.rB, group.A.length)

  return resolveTemplateRows(ws)
}

/* -------------------------------
   sums
-------------------------------- */

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

  const sumTargets = [
    COL_HOA_HONG.SL,
    COL_HOA_HONG.TIEN,
    COL_HOA_HONG.GIAPP,
    COL_HOA_HONG.CHENH,
    COL_HOA_HONG.DOANHTHUKHAC,
    COL_HOA_HONG.PHI_TRA,
    COL_HOA_HONG.HOA_HONG,
    COL_HOA_HONG.MI_THU,
    COL_HOA_HONG.CHENH_TT,
  ]

  sumTargets.forEach((c0) => {
    const addr = addrRC(titleRow0, c0)
    const keepS = (ws as any)[addr]?.s
    ;(ws as any)[addr] = { t: "n", f: mkSum(c0), s: keepS }
  })

  ensureRefIncludes(ws, titleRow0, COL_HOA_HONG.GHICHU)
}

export const applyAllSectionSums = (
  ws: XLSX.WorkSheet,
  rows: ReturnType<typeof resolveTemplateRows>,
  group: Record<"A" | "B" | "C" | "D" | "E" | "F" | "G", ExcelRow[]>
) => {
  const start = {
    A: rows.rA + 1,
    B: rows.rB + 1,
    C: rows.rC + 1,
    D: rows.rD + 1,
    E: rows.rE + 1,
    F: rows.rF + 1,
    G: rows.rG + 1,
  } as const

  const end = {
    A: start.A + group.A.length - 1,
    B: start.B + group.B.length - 1,
    C: start.C + group.C.length - 1,
    D: start.D + group.D.length - 1,
    E: start.E + group.E.length - 1,
    F: start.F + group.F.length - 1,
    G: start.G + group.G.length - 1,
  } as const

  setSectionSumRow(ws, rows.rA, start.A, end.A)
  setSectionSumRow(ws, rows.rB, start.B, end.B)
  setSectionSumRow(ws, rows.rC, start.C, end.C)
  setSectionSumRow(ws, rows.rD, start.D, end.D)
  setSectionSumRow(ws, rows.rE, start.E, end.E)
  setSectionSumRow(ws, rows.rF, start.F, end.F)
  setSectionSumRow(ws, rows.rG, start.G, end.G)
}

export const applyGrandTotal = (
  ws: XLSX.WorkSheet,
  rows: ReturnType<typeof resolveTemplateRows>
) => {
  const titleRows0 = [
    rows.rA,
    rows.rB,
    rows.rC,
    rows.rD,
    rows.rE,
    rows.rF,
    rows.rG,
  ]
  const mk = (c0: number) => {
    const col = XLSX.utils.encode_col(c0)
    return titleRows0.map((r0) => `${col}${r0 + 1}`).join("+")
  }

  const sumTargets = [
    COL_HOA_HONG.SL,
    COL_HOA_HONG.TIEN,
    COL_HOA_HONG.GIAPP,
    COL_HOA_HONG.CHENH,
    COL_HOA_HONG.DOANHTHUKHAC,
    COL_HOA_HONG.PHI_TRA,
    COL_HOA_HONG.HOA_HONG,
    COL_HOA_HONG.MI_THU,
    COL_HOA_HONG.CHENH_TT,
  ]

  sumTargets.forEach((c0) => {
    const addr = addrRC(rows.rTOTAL, c0)
    const keepS = (ws as any)[addr]?.s
    ;(ws as any)[addr] = { t: "n", f: mk(c0), s: keepS }
  })
}
