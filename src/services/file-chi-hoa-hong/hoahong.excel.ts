import * as XLSX from "xlsx-js-style"
import { normalize } from "@/utils/excel"
import {
  BORDER_THICK,
  BORDER_THIN,
  HOA_HONG_COL_WIDTHS,
} from "@/constants/Mauhoahong"

let _exemptTncnSet: Set<string> | null = null
export const extractAgencyNameFromTemplate = (ws: XLSX.WorkSheet) => {
  const ref = (ws as any)["!ref"] || "A1"
  const range = XLSX.utils.decode_range(ref)

  const maxR = Math.min(range.e.r, range.s.r + 80)
  const maxC = Math.min(range.e.c, range.s.c + 20)

  for (let r = range.s.r; r <= maxR; r++) {
    for (let c = range.s.c; c <= maxC; c++) {
      const addr = XLSX.utils.encode_cell({ r, c })
      const v = (ws as any)[addr]?.v
      const s = normalize(v ?? "")
      if (!s) continue

      if (s.includes(normalize("BẢNG ĐỐI SOÁT ĐẠI LÝ"))) {
        // ✅ ưu tiên lấy ô bên phải (thường là F5)
        const rightAddr = XLSX.utils.encode_cell({ r, c: c + 1 })
        const rightV = (ws as any)[rightAddr]?.v
        const nameRight = String(rightV ?? "").trim()
        if (nameRight) return nameRight

        // fallback: nếu tên nằm chung 1 ô sau dấu :
        const raw = String(v ?? "")
        const parts = raw.split(/[:：]/)
        return (parts[1] ?? "").trim()
      }
    }
  }
  return ""
}
export const getExemptTncnAgentsClient = async () => {
  if (_exemptTncnSet) return _exemptTncnSet

  const res = await fetch("/templates/DS DL KO CHỊU THUẾ TNCN.xlsx")
  if (!res.ok)
    throw new Error("Không tải được file DS DL KO CHỊU THUẾ TNCN.xlsx")

  const ab = await res.arrayBuffer()
  const wb = XLSX.read(ab, { type: "array" })
  const ws = wb.Sheets[wb.SheetNames[0]]

  const ref = (ws as any)["!ref"] || "A1"
  const range = XLSX.utils.decode_range(ref)

  const s = new Set<string>()
  for (let r = range.s.r; r <= range.e.r; r++) {
    const addr = XLSX.utils.encode_cell({ r, c: 0 }) // cột A
    const v = (ws as any)[addr]?.v
    const key = normalize(v ?? "")
    if (key) s.add(key)
  }

  _exemptTncnSet = s
  return s
}

export const addrRC = (r0: number, c0: number) =>
  XLSX.utils.encode_cell({ r: r0, c: c0 })

export const ensureCell = (ws: XLSX.WorkSheet, r0: number, c0: number) => {
  const addr = addrRC(r0, c0)
  if (!(ws as any)[addr]) (ws as any)[addr] = { t: "s", v: "" }
  return (ws as any)[addr]
}

export const patchCellStyle = (
  ws: XLSX.WorkSheet,
  r0: number,
  c0: number,
  patch: any
) => {
  const cell = ensureCell(ws, r0, c0)
  const s0 = cell.s || {}
  cell.s = {
    ...s0,
    ...patch,
    border: patch.border ?? s0.border,
    alignment: patch.alignment ?? s0.alignment,
    fill: patch.fill ?? s0.fill,
    font: patch.font ?? s0.font,
  }
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

export const setTextKeepStyle = (
  ws: XLSX.WorkSheet,
  r0: number,
  c0: number,
  value: string
) => {
  const addr = addrRC(r0, c0)
  const keepS = (ws as any)[addr]?.s
  const keepZ = (ws as any)[addr]?.z
  const old = (ws as any)[addr] || {}
  ;(ws as any)[addr] = { ...old, t: "s", v: value, s: keepS, z: keepZ }
}

export const setFormulaKeepStyle = (
  ws: XLSX.WorkSheet,
  r0: number,
  c0: number,
  formula: string,
  fmt?: string
) => {
  const addr = addrRC(r0, c0)
  const keepS = (ws as any)[addr]?.s
  const keepZ = (ws as any)[addr]?.z
  const old = (ws as any)[addr] || {}
  delete old.v
  delete old.w
  delete old.vt
  ;(ws as any)[addr] = {
    ...old,
    t: "n",
    v: 0,
    f: formula.startsWith("=") ? formula.slice(1) : formula,
    s: keepS,
    z: fmt || keepZ,
  }
}

export const copyRowStyle = (
  ws: XLSX.WorkSheet,
  srcRow0: number,
  dstRow0: number,
  cStart0: number,
  cEnd0: number
) => {
  for (let c0 = cStart0; c0 <= cEnd0; c0++) {
    const srcAddr = addrRC(srcRow0, c0)
    const dstAddr = addrRC(dstRow0, c0)

    const srcCell: any = (ws as any)[srcAddr]
    const dstCell: any = (ws as any)[dstAddr]
    if (!srcCell) continue

    const keepV = dstCell?.v ?? ""
    const keepT = dstCell?.t ?? "s"

    ;(ws as any)[dstAddr] = {
      ...dstCell,
      t: keepT,
      v: keepV,
      s: srcCell.s ? JSON.parse(JSON.stringify(srcCell.s)) : dstCell?.s,
      z: srcCell.z ?? dstCell?.z,
    }
  }

  const rows: any[] = (ws as any)["!rows"] || []
  if (rows[srcRow0]) {
    rows[dstRow0] = { ...rows[srcRow0] }
    ;(ws as any)["!rows"] = rows
  }
}

export const copyRowStyleBlock = (
  ws: XLSX.WorkSheet,
  srcRow0: number,
  startDstRow0: number,
  count: number,
  cStart0: number,
  cEnd0: number
) => {
  for (let i = 0; i < count; i++)
    copyRowStyle(ws, srcRow0, startDstRow0 + i, cStart0, cEnd0)
}

export const clearDataKeepStyle = (
  ws: XLSX.WorkSheet,
  rStart0: number,
  rEnd0: number,
  cStart0: number,
  cEnd0: number,
  isNumericCol: (c0: number) => boolean
) => {
  if (rEnd0 < rStart0 || cEnd0 < cStart0) return
  for (let r0 = rStart0; r0 <= rEnd0; r0++) {
    for (let c0 = cStart0; c0 <= cEnd0; c0++) {
      const addr = addrRC(r0, c0)
      const cell: any = (ws as any)[addr]
      if (!cell) continue
      const s = cell.s
      const z = cell.z
      ;(ws as any)[addr] = isNumericCol(c0)
        ? { t: "n", v: 0, s, z }
        : { t: "s", v: "", s, z }
    }
  }
}

export const findTitleRowA = (
  ws: XLSX.WorkSheet,
  label: string,
  opts?: { startsWith?: boolean; scanRows?: number }
) => {
  const want = normalize(label)
  const range = XLSX.utils.decode_range(ws["!ref"] || "A1")
  const maxR = Math.min(range.e.r, (opts?.scanRows ?? 5000) - 1)

  for (let r0 = 0; r0 <= maxR; r0++) {
    const v = (ws as any)[addrRC(r0, 0)]?.v
    const s = normalize(v ?? "")
    if (!s) continue
    if (opts?.startsWith ? s.startsWith(want) : s === want) return r0
  }
  return -1
}

export const findRowContains = (
  ws: XLSX.WorkSheet,
  label: string,
  opts?: { scanRows?: number; scanCols?: number }
) => {
  const want = normalize(label)
  const range = XLSX.utils.decode_range(ws["!ref"] || "A1")
  const maxR = Math.min(range.e.r, (opts?.scanRows ?? 200) - 1)
  const maxC = Math.min(range.e.c, (opts?.scanCols ?? 20) - 1)

  for (let r0 = 0; r0 <= maxR; r0++) {
    for (let c0 = 0; c0 <= maxC; c0++) {
      const v = (ws as any)[addrRC(r0, c0)]?.v
      const s = normalize(v ?? "")
      if (s && s.includes(want)) return r0
    }
  }
  return -1
}

export const setColumnWidthsHoaHong = (ws: XLSX.WorkSheet) => {
  ws["!cols"] = HOA_HONG_COL_WIDTHS.map((wch) => ({ wch }))
}

export const applyInnerThinBorders = (
  ws: XLSX.WorkSheet,
  rStart0: number,
  rEnd0: number,
  cStart0: number,
  cEnd0: number
) => {
  for (let r0 = rStart0; r0 <= rEnd0; r0++) {
    for (let c0 = cStart0; c0 <= cEnd0; c0++)
      patchCellStyle(ws, r0, c0, { border: BORDER_THIN })
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
  for (let c0 = cStart0; c0 <= cEnd0; c0++)
    patchCellStyle(ws, row0, c0, { fill })
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

// ✅ set font all cells (Times New Roman)
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
