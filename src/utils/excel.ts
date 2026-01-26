import { BORDER_THIN_VACOM } from "@/constants/vacom"
import * as XLSX from "xlsx-js-style"
const FONT_TNR = { name: "Times New Roman" }
export type ExcelRow = Record<string, any>

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

// Excel serial (1900) -> dd/mm/yyyy
export const excelSerialToDateString = (serial: any) => {
  const n = Number(serial)
  if (!Number.isFinite(n)) return String(serial ?? "")
  const utcDays = Math.floor(n - 25569)
  const date = new Date(utcDays * 86400 * 1000)
  const dd = String(date.getDate()).padStart(2, "0")
  const mm = String(date.getMonth() + 1).padStart(2, "0")
  const yyyy = date.getFullYear()
  return `${dd}/${mm}/${yyyy}`
}
export const clearRange = (
  ws: XLSX.WorkSheet,
  rStart0: number,
  rEnd0: number,
  cStart0: number,
  cEnd0: number
) => {
  if (rEnd0 < rStart0 || cEnd0 < cStart0) return
  for (let r0 = rStart0; r0 <= rEnd0; r0++) {
    for (let c0 = cStart0; c0 <= cEnd0; c0++) {
      const addr = XLSX.utils.encode_cell({ r: r0, c: c0 })
      delete (ws as any)[addr] // xoá luôn cả text mẫu như "XĂNG DẦU"
    }
  }
}

export const removeAllFormulas = (ws: XLSX.WorkSheet) => {
  for (const addr in ws) {
    if (addr.startsWith("!")) continue
    const cell: any = (ws as any)[addr]
    if (cell?.f) delete cell.f
  }
}

export const findSheetName = (wb: XLSX.WorkBook, wanted: string) => {
  const w = normalize(wanted)
  return wb.SheetNames.find((n) => normalize(n) === w) || ""
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

export const forceLeftTitleRow = (
  ws: XLSX.WorkSheet,
  r0: number,
  startCol0 = 0, // A
  endCol0 = 10 // K
) => {
  // 1) gom text đang nằm ở đâu đó trong hàng A..K
  let title = ""
  for (let c0 = startCol0; c0 <= endCol0; c0++) {
    const addr = XLSX.utils.encode_cell({ r: r0, c: c0 })
    const cell = ws[addr] as any
    const v = cell?.v
    if (!title && v !== undefined && v !== null && String(v).trim() !== "") {
      title = String(v).trim()
    }
  }

  // 2) clear toàn bộ cell trong hàng (để khỏi bị center từ cell cũ)
  for (let c0 = startCol0; c0 <= endCol0; c0++) {
    const addr = XLSX.utils.encode_cell({ r: r0, c: c0 })
    delete (ws as any)[addr]
  }

  // 3) xoá mọi merge đụng tới row này (không chỉ s.r === r0)
  const merges = ((ws as any)["!merges"] || []) as XLSX.Range[]
  ;(ws as any)["!merges"] = merges.filter((m) => !(m.s.r <= r0 && m.e.r >= r0))

  // 4) tạo merge chuẩn A..K cho row này
  ;(ws as any)["!merges"] = [
    ...(((ws as any)["!merges"] || []) as XLSX.Range[]),
    { s: { r: r0, c: startCol0 }, e: { r: r0, c: endCol0 } },
  ]

  // 5) set lại ô A chứa title + style LEFT
  const aAddr = XLSX.utils.encode_cell({ r: r0, c: startCol0 })
  ;(ws as any)[aAddr] = {
    t: "s",
    v: title,
    s: {
      font: { ...FONT_TNR, bold: true },
      fill: { patternType: "solid", fgColor: { rgb: "DFF3E3" } },
      border: BORDER_THIN_VACOM,
      alignment: {
        vertical: "center",
        horizontal: "left",
        wrapText: false,
        indent: 0,
      },
    },
  }
}

export const getSheetAOA = (ws: XLSX.WorkSheet) =>
  XLSX.utils.sheet_to_json(ws, { header: 1, defval: "", raw: false }) as any[][]

export const deepCloneSheet = (ws: XLSX.WorkSheet) =>
  JSON.parse(JSON.stringify(ws)) as XLSX.WorkSheet

export const ensureRefIncludes = (
  ws: XLSX.WorkSheet,
  maxR: number,
  maxC: number
) => {
  const ref = ws["!ref"] || "A1"
  const range = XLSX.utils.decode_range(ref)
  if (maxR > range.e.r) range.e.r = maxR
  if (maxC > range.e.c) range.e.c = maxC
  ws["!ref"] = XLSX.utils.encode_range(range)
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
export const findSectionTitleRow = (
  aoa: any[][],
  label: string,
  scanRows = 5000
) => {
  const key = normalize(label)
  for (let r = 0; r < Math.min(scanRows, aoa.length); r++) {
    const line = normalize((aoa[r] || []).map((x) => String(x ?? "")).join(" "))
    if (line.includes(key)) return r
  }
  return -1
}

/** classify Loại sản phẩm -> section */
export const classifyProductToSection = (
  v: any
): "A" | "B" | "C" | "E" | "D" | "" => {
  const s = normalize(v)

  // ✅ BỎ CKS (không lấy)
  if (s.includes("cks") || s.includes("chukyso") || s.includes("chukiso"))
    return ""

  // A: Hóa đơn điện tử + tem/vé/thẻ điện tử
  if (
    (s.includes("hoadon") && s.includes("dientu")) ||
    s.includes("hoadondientu") ||
    s.includes("hddt") ||
    ((s.includes("tem") || s.includes("ve") || s.includes("the")) &&
      s.includes("dientu"))
  )
    return "A"

  // B: Hóa đơn từ máy tính tiền
  if (
    (s.includes("hoadon") && s.includes("maytinhtien")) ||
    s.includes("maytinhtien") ||
    s.includes("mtt")
  )
    return "B"

  // C: khấu trừ TNCN / chứng từ
  if (s.includes("khautru") || s.includes("tncn") || s.includes("chungtu"))
    return "C"

  // E: SMI
  if (s.includes("smi")) return "E"

  // D: BHXH
  if (s.includes("bhxh")) return "D"

  return ""
}

/** ✅ parse số kiểu "1,280,000" | "1.280.000" | "1 280 000" -> number */
export const parseNumberLoose = (v: any): number | null => {
  if (v === null || v === undefined || v === "") return null
  if (typeof v === "number" && Number.isFinite(v)) return v

  let s = String(v).trim()
  if (!s) return null

  // bỏ ký tự tiền tệ/khoảng trắng
  s = s.replace(/\s+/g, "").replace(/[₫đ]/gi, "")

  // nếu có % thì không parse dạng tiền ở đây
  if (s.includes("%")) return null

  const lastDot = s.lastIndexOf(".")
  const lastComma = s.lastIndexOf(",")

  // xác định decimal separator là cái xuất hiện cuối cùng (nếu có)
  const decPos = Math.max(lastDot, lastComma)

  // nếu có decimal và sau nó là 1-2 chữ số => coi là phần lẻ, bỏ đi (hoặc có thể /100)
  if (decPos !== -1) {
    const tail = s.slice(decPos + 1)
    if (/^\d{1,2}$/.test(tail)) {
      s = s.slice(0, decPos) // bỏ phần lẻ cho an toàn (tiền của bạn đang integer)
    }
  }

  // bỏ hết dấu phân tách hàng nghìn
  s = s.replace(/[.,]/g, "")

  // chỉ giữ số và dấu -
  s = s.replace(/[^\d-]/g, "")
  if (!s || s === "-") return null

  const n = Number(s)
  return Number.isFinite(n) ? n : null
}

export const toNumberLoose = (v: any) => {
  if (v === null || v === undefined || v === "") return null
  if (typeof v === "number" && Number.isFinite(v)) return v

  const s = String(v).trim()
  if (!s) return null

  // bỏ phân cách tiền: "1,280,000" / "1.280.000" / "1 280 000"
  const cleaned = s
    .replace(/\s+/g, "")
    .replace(/,/g, "")
    .replace(/\.(?=\d{3}(\D|$))/g, "") // xóa dấu . ngăn cách hàng nghìn

  const n = Number(cleaned)
  return Number.isFinite(n) ? n : null
}
export const monthKey = (v: any): string => {
  if (v == null || v === "") return ""
  if (typeof v === "number" && Number.isFinite(v)) {
    const d = XLSX.SSF.parse_date_code(v)
    if (!d?.m || !d?.y) return ""
    return `${String(d.m).padStart(2, "0")}/${String(d.y)}`
  }
  const s = String(v).trim()
  if (!s) return ""

  // dd/mm/yyyy
  const m1 = s.match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/)
  if (m1) {
    const mm = Number(m1[2])
    const yy = Number(m1[3])
    if (mm >= 1 && mm <= 12) return `${String(mm).padStart(2, "0")}/${yy}`
  }
  // yyyy-mm-dd
  const m2 = s.match(/(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})/)
  if (m2) {
    const yy = Number(m2[1])
    const mm = Number(m2[2])
    if (mm >= 1 && mm <= 12) return `${String(mm).padStart(2, "0")}/${yy}`
  }
  // mm/yyyy
  const m3 = s.match(/^(\d{1,2})[\/\-](\d{4})$/)
  if (m3) {
    const mm = Number(m3[1])
    const yy = Number(m3[2])
    if (mm >= 1 && mm <= 12) return `${String(mm).padStart(2, "0")}/${yy}`
  }
  return ""
}

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

  // ---- DATE ----
  if (opts?.kind === "date") {
    const n = Number(v)
    ws[addr] = {
      t: "s",
      v: Number.isFinite(n) ? excelSerialToDateString(n) : String(v ?? ""),
    }
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

  // ---- NUMBER0: rỗng => 0 (dùng cho SL, TIỀN, HH5...) ----
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

/** ✅ Set công thức theo từng dòng */
export const setRowFormulas = (
  ws: XLSX.WorkSheet,
  r0: number,
  col: {
    TIEN: number
    HH: number
    DLDH: number
    HH5: number
    TONGTRICH: number
    CONPHAITT: number
  }
) => {
  const r1 = r0 + 1 // excel 1-index
  const F = XLSX.utils.encode_col(col.TIEN)
  const G = XLSX.utils.encode_col(col.HH)
  const H = XLSX.utils.encode_col(col.DLDH)
  const I = XLSX.utils.encode_col(col.HH5)
  const J = XLSX.utils.encode_col(col.TONGTRICH)

  // H = F * G  (Đại lý được hưởng)
  ws[XLSX.utils.encode_cell({ r: r0, c: col.DLDH })] = {
    t: "n",
    f: `${F}${r1}*${G}${r1}`,
  }

  // J = H + I  (Tổng trích đại lý)
  ws[XLSX.utils.encode_cell({ r: r0, c: col.TONGTRICH })] = {
    t: "n",
    f: `${H}${r1}+${I}${r1}`,
  }

  // ✅ K = J  (Còn phải TT = Tổng trích đại lý)
  ws[XLSX.utils.encode_cell({ r: r0, c: col.CONPHAITT })] = {
    t: "n",
    f: `${J}${r1}`,
  }
}
