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
  findRowContains,
  findTitleRowA,
  setFormulaKeepStyle,
  patchCellStyle,
  mergeCells,
} from "./hoahong.excel"
import {
  COL_HOA_HONG,
  NUM_PARENS_FMT,
  sumTargets,
} from "@/constants/Mauhoahong"

/* ------------------------------- header index ------------------------------- */

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

/* ------------------------------- section classify ------------------------------- */
type Sec = "A" | "B" | "C" | "D" | "E" | "F" | "G" | "H"
const SECS: Sec[] = ["A", "B", "C", "D", "E", "F", "G", "H"]

// ✅ File theo dõi doanh số của bạn: cột "TÊN SP" có code ngắn: HD, MTT, BHXH, ICA3...
export const classifyProductToSectionHoaHong = (v: any): Sec => {
  const s = normalize(v)

  // ✅ code ngắn trong file doanh số
  if (
    s === normalize("HD") ||
    s.includes("hddt") ||
    s.includes("hoadondientu") ||
    (s.includes("hoadon") && s.includes("dientu"))
  )
    return "A"

  if (
    s === normalize("MTT") ||
    s.includes("maytinhtien") ||
    s.includes("may tinh tien")
  )
    return "B"

  if (
    s === normalize("TNCN") ||
    s.includes("tncn") ||
    s.includes("khautru") ||
    s.includes("khau tru") ||
    s.includes("chungtu") ||
    s.includes("chung tu")
  )
    return "C"

  if (s === normalize("BHXH") || s.includes("bhxh")) return "D"

  if (s === normalize("SMI") || s.includes("smi")) return "E"
  if (s === normalize("XANG") || s.includes("xang")) return "F"
  if (
    s.startsWith(normalize("ICA")) ||
    s.startsWith(normalize("INT")) ||
    s.startsWith(normalize("EAS")) ||
    s.startsWith(normalize("TOKEN")) ||
    s.includes("cks") ||
    s.includes("chukyso") ||
    s.includes("chu ky so") ||
    s.includes("chukiso")
  )
    // ICA3 / ICA... / CKS
    return "G"

  // ✅ KHÔNG MATCH -> đẩy vào "mục khác" (chọn E)
  return "H"
}

/* ------------------------------- template row positions ------------------------------- */

export const resolveTemplateRows = (ws: XLSX.WorkSheet) => {
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
  if (rH === -1)
    rH = findRowContains(ws, "H. KHÁC", { scanRows: 1500, scanCols: 30 })

  const rTOTAL = findTitleRowA(ws, "CỘNG", {
    startsWith: false,
    scanRows: 5000,
  })

  if ([rA, rB, rC, rD, rE, rF, rG, rH, rTOTAL].some((x) => x === -1)) {
    throw new Error(
      "❌ Không tìm thấy đủ khu A..F + KHAC hoặc dòng CỘNG trong template."
    )
  }
  return { rA, rB, rC, rD, rE, rF, rG, rH, rTOTAL }
}

/* ------------------------------- ensure space bottom-up ------------------------------- */

export const ensureAllSectionsHaveSpace = (
  ws: XLSX.WorkSheet,
  rows: ReturnType<typeof resolveTemplateRows>,
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
    if (sec) group[sec].push(row)
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

    // copy style row gần nhất
    const srcStyleRow0 = Math.max(titleRow + 1, boundaryRow - 1)
    copyRowStyleBlock(ws, srcStyleRow0, boundaryRow, needInsert, 0, maxCol)
  }

  // bottom-up
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

/* ------------------------------- clear blocks ------------------------------- */

export const clearAllSectionBlocks = (
  ws: XLSX.WorkSheet,
  rows: ReturnType<typeof resolveTemplateRows>
) => {
  Object.assign(rows, resolveTemplateRows(ws))

  // ✅ PHẢI clear tới cột S
  const maxCol = COL_HOA_HONG.GHI_CHU

  const numericCols = new Set<number>([
    COL_HOA_HONG.STT,
    COL_HOA_HONG.BANQUYEN,
    COL_HOA_HONG.SL_MOI,
    COL_HOA_HONG.SL_GH,
    COL_HOA_HONG.SL_TANG,
    COL_HOA_HONG.DT_GOI_HD,
    COL_HOA_HONG.DT_KHAC,
    COL_HOA_HONG.TRI_GIA_XUAT_HD,
    COL_HOA_HONG.GIA_DOI_SOAT,
    COL_HOA_HONG.VUOT_GIA,
    COL_HOA_HONG.TIEN_HOA_HONG,
    COL_HOA_HONG.PHI_VIET_CHENH,
    COL_HOA_HONG.TONG_TRA_DOI_TAC,
    COL_HOA_HONG.DT_MINVOICE,
    COL_HOA_HONG.CHENH_LECH,
  ])

  const isNumericCol = (c0: number) => numericCols.has(c0)

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
  clearBlock(rows.rG + 1, rows.rH - 1)
  clearBlock(rows.rH + 1, rows.rTOTAL - 1)
}

/* ------------------------------- fill data + FORMULA LIKE TEMPLATE ------------------------------- */

const toNumber = (v: any) => {
  if (v == null || v === "") return 0
  if (typeof v === "number") return Number.isFinite(v) ? v : 0
  const raw = String(v).trim()
  if (!raw) return 0
  let s = raw.replace(/\s+/g, "")
  if (s.includes(",")) s = s.replace(/,/g, "")
  if (s.includes(".") && /^\d{1,3}(\.\d{3})+(\.\d+)?$/.test(s))
    s = s.replace(/\./g, "")
  const n = Number(s)
  return Number.isFinite(n) ? n : 0
}

export const fillAllSections = (
  ws: XLSX.WorkSheet,
  rows: ReturnType<typeof resolveTemplateRows>,
  group: Record<Sec, ExcelRow[]>,
  H: any
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

  const n0 = (v: any) => toNumber(v)

  const setNumKeepStyle = (r0: number, c0: number, value: any) => {
    const addr = addrRC(r0, c0)
    const keepS = (ws as any)[addr]?.s
    const keepZ = (ws as any)[addr]?.z
    ;(ws as any)[addr] = { t: "n", v: n0(value), s: keepS, z: keepZ }
  }

  const fillSection = (sec: Sec) => {
    const rowsData = group[sec]
    for (let i = 0; i < rowsData.length; i++) {
      const r0 = start[sec] + i
      const row = rowsData[i] as any
      const isCKS = classifyProductToSectionHoaHong(row[H.LOAI_CODE]) === "G"

      // basic
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

      if (isCKS) {
        // 0) Đảm bảo không dính merge cũ trên dòng này (nếu template từng merge)
        unmergeInRange(ws, r0, r0)

        // 1) Xoá giá trị cột E (BẢN QUYỀN) để khỏi hiện 0
        setCell(ws, r0, COL_HOA_HONG.BANQUYEN, "", {
          kind: "text",
          force: true,
        })

        // 2) Merge text từ E..J  (BANQUYEN..DT_KHAC)
        mergeCells(ws, r0, COL_HOA_HONG.BANQUYEN, COL_HOA_HONG.DT_KHAC)

        // 3) Lấy text theo cột O vàng
        const cksText = H.LOAI_CKS_TEXT && row[H.LOAI_CKS_TEXT]

        // 4) Set text vào ô top-left của merge (E)
        setCell(ws, r0, COL_HOA_HONG.BANQUYEN, cksText, {
          kind: "text",
          force: true,
        })

        // 5) Canh giữa ô merge E..J
        patchCellStyle(ws, r0, COL_HOA_HONG.BANQUYEN, {
          alignment: {
            horizontal: "center",
            vertical: "center",
            wrapText: true,
          },
        })

        // 7) K: TỔNG XUẤT HĐ
        setNumKeepStyle(
          r0,
          COL_HOA_HONG.TRI_GIA_XUAT_HD,
          row[H.TRI_GIA_XUAT_HD]
        )
        // 8) L = BQ + GÓI HÓA ĐƠN (tính trực tiếp từ file doanh số)
        const giaDoiSoat =
          toNumber(row[H.BANQUYEN]) + toNumber(row[H.DT_GOI_HD])

        setNumKeepStyle(r0, COL_HOA_HONG.GIA_DOI_SOAT, giaDoiSoat)

        // 9) M,N,O
        setNumKeepStyle(r0, COL_HOA_HONG.VUOT_GIA, row[H.VUOT_GIA])
        setNumKeepStyle(r0, COL_HOA_HONG.TIEN_HOA_HONG, row[H.TIEN_HOA_HONG])
        setNumKeepStyle(r0, COL_HOA_HONG.PHI_VIET_CHENH, row[H.PHI_VIET_CHENH])

        // 10) P
        setFormulaKeepStyle(
          ws,
          r0,
          COL_HOA_HONG.TONG_TRA_DOI_TAC,
          `=${addrRC(r0, COL_HOA_HONG.TIEN_HOA_HONG)}+${addrRC(
            r0,
            COL_HOA_HONG.VUOT_GIA
          )}-${addrRC(r0, COL_HOA_HONG.PHI_VIET_CHENH)}`
        )

        // 11) Q
        setNumKeepStyle(r0, COL_HOA_HONG.DT_MINVOICE, row[H.DT_MINVOICE])

        // 12) R
        setFormulaKeepStyle(
          ws,
          r0,
          COL_HOA_HONG.CHENH_LECH,
          `=${addrRC(r0, COL_HOA_HONG.TRI_GIA_XUAT_HD)}-${addrRC(
            r0,
            COL_HOA_HONG.DT_MINVOICE
          )}`
        )
      } else {
        /**
         * ✅ KHU THƯỜNG: PHẢI set lại BẢN QUYỀN (đây là chỗ bạn bị “mất số bản quyền”)
         */
        setNumKeepStyle(r0, COL_HOA_HONG.BANQUYEN, row[H.BANQUYEN])

        setNumKeepStyle(r0, COL_HOA_HONG.SL_MOI, row[H.SL_MOI])
        setNumKeepStyle(r0, COL_HOA_HONG.SL_GH, row[H.SL_GH])
        setNumKeepStyle(r0, COL_HOA_HONG.SL_TANG, row[H.SL_TANG])

        setNumKeepStyle(r0, COL_HOA_HONG.DT_GOI_HD, row[H.DT_GOI_HD])
        setNumKeepStyle(r0, COL_HOA_HONG.DT_KHAC, row[H.DT_KHAC])
         setNumKeepStyle(
          r0,
          COL_HOA_HONG.TRI_GIA_XUAT_HD,
          row[H.TRI_GIA_XUAT_HD]
        )

        setFormulaKeepStyle(
          ws,
          r0,
          COL_HOA_HONG.GIA_DOI_SOAT,
          `=${addrRC(r0, COL_HOA_HONG.BANQUYEN)}+${addrRC(
            r0,
            COL_HOA_HONG.DT_GOI_HD
          )}+${addrRC(r0, COL_HOA_HONG.DT_KHAC)}`
        )

        setNumKeepStyle(r0, COL_HOA_HONG.VUOT_GIA, row[H.VUOT_GIA])
        setNumKeepStyle(r0, COL_HOA_HONG.TIEN_HOA_HONG, row[H.TIEN_HOA_HONG])
        setNumKeepStyle(r0, COL_HOA_HONG.PHI_VIET_CHENH, row[H.PHI_VIET_CHENH])

        setFormulaKeepStyle(
          ws,
          r0,
          COL_HOA_HONG.TONG_TRA_DOI_TAC,
          `=${addrRC(r0, COL_HOA_HONG.TIEN_HOA_HONG)}+${addrRC(
            r0,
            COL_HOA_HONG.VUOT_GIA
          )}-${addrRC(r0, COL_HOA_HONG.PHI_VIET_CHENH)}`
        )

        setNumKeepStyle(r0, COL_HOA_HONG.DT_MINVOICE, row[H.DT_MINVOICE])

        setFormulaKeepStyle(
          ws,
          r0,
          COL_HOA_HONG.CHENH_LECH,
          `=${addrRC(r0, COL_HOA_HONG.TRI_GIA_XUAT_HD)}-${addrRC(
            r0,
            COL_HOA_HONG.DT_MINVOICE
          )}`
        )
      }

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

/* ------------------------------- compact sections ------------------------------- */

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

export const compactSections = (
  ws: XLSX.WorkSheet,
  group: Record<Sec, ExcelRow[]>
) => {
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
  rows = resolveTemplateRows(ws)
  compactBetween(rows.rH, rows.rTOTAL, group.H.length)

  rows = resolveTemplateRows(ws)
  compactBetween(rows.rG, rows.rH, group.G.length)

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

/* ------------------------------- sums (giữ như template) ------------------------------- */

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
    const addr = addrRC(titleRow0, c0)
    const keepS = (ws as any)[addr]?.s
    ;(ws as any)[addr] = { t: "n", f: mkSum(c0), s: keepS }
    patchCellStyle(ws, titleRow0, c0, { numFmt: NUM_PARENS_FMT })
    const cell: any = (ws as any)[addr]
    if (cell) cell.z = NUM_PARENS_FMT
  })

  ensureRefIncludes(ws, titleRow0, COL_HOA_HONG.GHI_CHU)
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

  sumTargets.forEach((c0) => {
    const addr = addrRC(rows.rTOTAL, c0)
    const keepS = (ws as any)[addr]?.s
    ;(ws as any)[addr] = { t: "n", f: mk(c0), s: keepS }
    patchCellStyle(ws, rows.rTOTAL, c0, { numFmt: NUM_PARENS_FMT })
    const cell: any = (ws as any)[addr]
    if (cell) cell.z = NUM_PARENS_FMT
  })
}
export const applyAllSectionSums = (
  ws: XLSX.WorkSheet,
  rows: ReturnType<typeof resolveTemplateRows>,
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
