import * as XLSX from "xlsx-js-style"
export type ExcelRow = Record<string, any>

export const addrRC = (r0: number, c0: number) =>
  XLSX.utils.encode_cell({ r: r0, c: c0 })
export function deepClone<T>(v: T): T {
  return JSON.parse(JSON.stringify(v))
}
export const normalize = (s: any) =>
  String(s ?? "")
    .trim()
    .toLowerCase()
    .replace(/đ/g, "d")
    .replace(/Đ/g, "d")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .replace(/[^a-z0-9]+/g, "")

/** MTT1/MTT2 → MTT, SMI1/SMI.SL → SMI (chỉ lấy cụm chữ cái đầu của mã SP) */
export const extractProductGroupCode = (value: any) => {
  const raw = String(value ?? "")
    .trim()
    .toUpperCase()
  if (!raw) return ""
  const match = raw.match(/^([A-Z]+)/)
  return match?.[1] || raw
}

export const toNumber = (v: any) => {
  if (v == null || v === "") return 0
  if (typeof v === "number") return Number.isFinite(v) ? v : 0

  let s = String(v).trim()
  if (!s) return 0
  s = s.replace(/\s+/g, "")

  if (/^\d{1,3}(\.\d{3})+(,\d+)?$/.test(s)) {
    s = s.replace(/\./g, "").replace(",", ".")
  } else {
    s = s.replace(/,/g, "")
  }

  const n = Number(s)
  return Number.isFinite(n) ? n : 0
}

export const getKeepStyle = (ws: XLSX.WorkSheet, addr: string) => {
  const cell = (ws as any)[addr]
  return { s: cell?.s, z: cell?.z }
}

export const setCellValueKeepStyle = (
  ws: XLSX.WorkSheet,
  r0: number,
  c0: number,
  value: any
) => {
  const cell = ensureCell(ws, r0, c0)
  const keepS = cell.s
  const keepZ = cell.z

  ;(ws as any)[addrRC(r0, c0)] =
    typeof value === "number"
      ? { t: "n", v: value, s: keepS, z: keepZ }
      : { t: "s", v: value == null ? "" : String(value), s: keepS, z: keepZ }
}

const putCellKeepStyle = (
  ws: XLSX.WorkSheet,
  addr: string,
  next: { t: "s" | "n"; v: any; s?: any; z?: any }
) => {
  delete (ws as any)[addr]?.f
  ;(ws as any)[addr] = { ...(ws as any)[addr], ...next }
}

export const setTextKeepStyle = (
  ws: XLSX.WorkSheet,
  r0: number,
  c0: number,
  value: string
) => {
  const addr = addrRC(r0, c0)
  const keep = getKeepStyle(ws, addr)
  putCellKeepStyle(ws, addr, {
    t: "s",
    v: value == null ? "" : String(value),
    s: keep.s,
    z: keep.z,
  })
}

export const setNumberKeepStyle = (
  ws: XLSX.WorkSheet,
  r0: number,
  c0: number,
  value: number
) => {
  const addr = addrRC(r0, c0)
  const keep = getKeepStyle(ws, addr)
  putCellKeepStyle(ws, addr, {
    t: "n",
    v: Number.isFinite(value) ? value : 0,
    s: keep.s,
    z: keep.z,
  })
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
      if (isNumericCol(c0)) setNumberKeepStyle(ws, r0, c0, 0)
      else setTextKeepStyle(ws, r0, c0, "")
    }
  }
}
export const setFormulaKeepStyle = (
  ws: XLSX.WorkSheet,
  r0: number,
  c0: number,
  formula: string,
  fmt?: string,
  cachedValue?: number
) => {
  const addr = addrRC(r0, c0)
  const old = (ws as any)[addr] || {}
  const keepS = old.s || {}
  const keepZ = old.z

  ;(ws as any)[addr] = {
    t: "n",
    v: Number.isFinite(cachedValue as number) ? Number(cachedValue) : 0,
    f: formula.startsWith("=") ? formula.slice(1) : formula,
    s: fmt ? { ...keepS, numFmt: fmt } : keepS,
    z: fmt || keepZ,
  }

  delete (ws as any)[addr].r
  delete (ws as any)[addr].h
  delete (ws as any)[addr].w
}

export const copyRowStyle = (
  ws: XLSX.WorkSheet,
  srcRow0: number,
  dstRow0: number,
  cStart0: number,
  cEnd0: number
) => {
  for (let c0 = cStart0; c0 <= cEnd0; c0++) {
    const srcCell: any = (ws as any)[addrRC(srcRow0, c0)]
    const dstAddr = addrRC(dstRow0, c0)

    if (!srcCell) {
      delete (ws as any)[dstAddr]
      continue
    }

    const dstCell = (ws as any)[dstAddr] || { t: "s", v: "" }
    ;(ws as any)[dstAddr] = {
      ...dstCell,
      s: srcCell.s ? deepClone(srcCell.s) : dstCell.s,
      z: srcCell.z ?? dstCell.z,
    }

    if ((ws as any)[dstAddr].v == null) {
      ;(ws as any)[dstAddr].v = ""
      ;(ws as any)[dstAddr].t = "s"
    }

    delete (ws as any)[dstAddr].f
    delete (ws as any)[dstAddr].w
  }

  const rows: any[] = (ws as any)["!rows"] || []
  if (rows[srcRow0]) rows[dstRow0] = deepClone(rows[srcRow0])
  ;(ws as any)["!rows"] = rows
}

export const copyRowStyleBlock = (
  ws: XLSX.WorkSheet,
  srcRow0: number,
  startDstRow0: number,
  count: number,
  cStart0: number,
  cEnd0: number
) => {
  for (let i = 0; i < count; i++) {
    copyRowStyle(ws, srcRow0, startDstRow0 + i, cStart0, cEnd0)
  }
}

export const findTitleRowA = (
  ws: XLSX.WorkSheet,
  label: string,
  opts?: { startsWith?: boolean; scanRows?: number }
) => {
  const want = normalize(label)
  const range = XLSX.utils.decode_range((ws as any)["!ref"] || "A1")
  const maxR = Math.min(range.e.r, (opts?.scanRows ?? 5000) - 1)

  for (let r0 = 0; r0 <= maxR; r0++) {
    const s = normalize((ws as any)[addrRC(r0, 0)]?.v ?? "")
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
  const range = XLSX.utils.decode_range((ws as any)["!ref"] || "A1")
  const maxR = Math.min(range.e.r, (opts?.scanRows ?? 200) - 1)
  const maxC = Math.min(range.e.c, (opts?.scanCols ?? 20) - 1)

  for (let r0 = 0; r0 <= maxR; r0++) {
    for (let c0 = 0; c0 <= maxC; c0++) {
      const s = normalize((ws as any)[addrRC(r0, c0)]?.v ?? "")
      if (s && s.includes(want)) return r0
    }
  }
  return -1
}

export const buildSalesIndex = (salesHeaders: string[]) => {
  const idx = new Map<string, string>()
  ;(Array.isArray(salesHeaders) ? salesHeaders : []).forEach((h) => {
    const key = normalize(h)
    if (key && !idx.has(key)) idx.set(key, h)
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

export const unmergeInRange = (
  ws: XLSX.WorkSheet,
  rStart0: number,
  rEnd0: number
) => {
  const merges = ((ws as any)["!merges"] || []) as XLSX.Range[]
  if (!merges.length) return

  // Giữ lại merge KHÔNG nằm trong range data
  const kept = merges.filter((m) => {
    const inRowRange = !(m.e.r < rStart0 || m.s.r > rEnd0) // có giao nhau theo row
    return !inRowRange
  })

  ;(ws as any)["!merges"] = kept
}

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

/** insert rows: shift tất cả cell từ startRow trở xuống */
export const insertRows = (
  ws: XLSX.WorkSheet,
  startRow0: number,
  nRows: number
) => {
  if (nRows <= 0) return

  const newWs: XLSX.WorkSheet = { ...ws }
  const keys = Object.keys(newWs).filter((k) => !k.startsWith("!"))

  keys
    .map((addr) => ({ addr, cell: (newWs as any)[addr] }))
    .sort(
      (a, b) =>
        XLSX.utils.decode_cell(b.addr).r - XLSX.utils.decode_cell(a.addr).r
    )
    .forEach(({ addr, cell }) => {
      const { r, c } = XLSX.utils.decode_cell(addr)
      if (r >= startRow0) {
        const newAddr = XLSX.utils.encode_cell({ r: r + nRows, c })
        ;(newWs as any)[newAddr] = cell
        delete (newWs as any)[addr]
      }
    })

  // shift merges
  const merges = ((newWs as any)["!merges"] || []) as XLSX.Range[]
  merges.forEach((m) => {
    if (m.s.r >= startRow0) {
      m.s.r += nRows
      m.e.r += nRows
      return
    }
    if (m.s.r < startRow0 && m.e.r >= startRow0) {
      m.e.r += nRows
    }
  })
  ;(newWs as any)["!merges"] = merges

  // ref
  const ref = (newWs as any)["!ref"] || "A1"
  const range = XLSX.utils.decode_range(ref)
  range.e.r += nRows
  ;(newWs as any)["!ref"] = XLSX.utils.encode_range(range)

  Object.keys(ws).forEach((k) => delete (ws as any)[k])
  Object.assign(ws, newWs)
}

/** tìm row section title theo text A./B./C./E./D. */

export const setCell = (
  ws: XLSX.WorkSheet,
  r0: number,
  c0: number,
  v: any,
  opts?: {
    kind?: "stt" | "date" | "percent" | "text" | "number0"
    force?: boolean
  }
) => {
  const addr = XLSX.utils.encode_cell({ r: r0, c: c0 })
  const existing = ws[addr] as any

  // ✅ mặc định: không ghi đè công thức
  // ✅ nhưng nếu opts.force=true thì ghi đè (dành cho dòng data)
  if (!opts?.force && existing && existing.f && opts?.kind !== "percent") return

  // ---- TEXT (MST, mã...) => giữ nguyên, không convert số ----
  if (opts?.kind === "text") {
    ws[addr] = { t: "s", v: String(v ?? "").trim() }
    return
  }

  // ---- STT ----
  if (opts?.kind === "stt") {
    ws[addr] = { t: "n", v: Number(v) || 0 }
    return
  }

  // ---- PERCENT (luôn ra 0%..100%, không bao giờ để text gây #VALUE) ----
  if (opts?.kind === "percent") {
    let num: number = NaN

    if (typeof v === "string") {
      const t = v.trim()
      if (t.includes("%")) num = parseFloat(t) / 100
      else num = Number(t)
    } else {
      num = Number(v)
    }

    if (!Number.isFinite(num)) {
      // ✅ nếu bẩn dữ liệu (vd "Giá vốn") thì ép về 0%
      ws[addr] = { t: "n", v: 0, z: "0%" }
      return
    }

    const fraction = num > 1 ? num / 100 : num
    ws[addr] = { t: "n", v: fraction, z: "0%" }
    return
  }

  // ---- NUMBER0: rỗng => 0 (dùng cho SL, TIỀN, HH_THUONG_5...) ----
  if (opts?.kind === "number0") {
    if (v === null || v === undefined || v === "") {
      ws[addr] = { t: "n", v: 0 }
      return
    }

    // parse số có dấu phẩy
    const asText = String(v).replace(/,/g, "").trim()
    const num = Number(asText)
    ws[addr] = { t: "n", v: Number.isFinite(num) ? num : 0 }
    return
  }

  // ---- default ----
  if (v === null || v === undefined || v === "") {
    ws[addr] = { t: "s", v: "" }
    return
  }

  // ✅ KHÔNG tự convert những field có thể là MST nữa,
  // chỉ convert khi chắc chắn numeric
  const asText = String(v).trim()
  const num = Number(asText.replace(/,/g, ""))
  if (asText !== "" && Number.isFinite(num)) ws[addr] = { t: "n", v: num }
  else ws[addr] = { t: "s", v: String(v) }
}
