import { normalize } from "@/utils/excel"
import * as XLSX from "xlsx-js-style"

export const styleCell = (
  ws: XLSX.WorkSheet,
  r0: number,
  c0: number,
  s: any
) => {
  const addr = XLSX.utils.encode_cell({ r: r0, c: c0 })
  if (!ws[addr]) ws[addr] = { t: "s", v: "" }
  ;(ws[addr] as any).s = { ...(ws[addr] as any).s, ...s }
}

export const setFormula = (
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

export const cellHasValue = (ws: XLSX.WorkSheet, r0: number, c0: number) => {
  const addr = XLSX.utils.encode_cell({ r: r0, c: c0 })
  const cell = ws[addr] as any
  const v = cell?.v
  return v != null && String(v).trim() !== ""
}

export const findLastDataRow = (
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

export const sumRange = (c0: number, rStart0: number, rEnd0: number) => {
  if (rEnd0 < rStart0) return "0"
  const a1 = XLSX.utils.encode_cell({ r: rStart0, c: c0 })
  const a2 = XLSX.utils.encode_cell({ r: rEnd0, c: c0 })
  return `SUM(${a1}:${a2})`
}

export const findCongRow0 = (aoa: any[][]) => {
  for (let r = 0; r < aoa.length; r++) {
    const v = aoa[r]?.[1] // col B
    if (normalize(String(v ?? "")) === normalize("CỘNG")) return r
  }
  return -1
}

export const findRowContainsAOA = (aoa: any[][], text: string) => {
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

export const buildSalesIndex = (salesHeaders: string[]) => {
  const salesIndex = new Map<string, string>()
  salesHeaders.forEach((h) => {
    const k = normalize(h)
    if (k && !salesIndex.has(k)) salesIndex.set(k, h)
  })
  return salesIndex
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
