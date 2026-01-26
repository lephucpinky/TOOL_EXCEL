import * as XLSX from "xlsx-js-style"

import { BORDER_THIN_VACOM, COL_WCH_VACOM, COL_VACOM } from "@/constants/vacom"
import { styleCell } from "./vacom.excel"
import { getSheetAOA, normalize } from "@/utils/excel"
const FONT_TNR = { name: "Times New Roman" }

/** format theo cột */
export const applyColumnFormats = (
  ws: XLSX.WorkSheet,
  r0: number,
  c0: number
) => {
  const addr = XLSX.utils.encode_cell({ r: r0, c: c0 })
  const cell = ws[addr] as any
  if (!cell) return
  if (c0 === 3) cell.z = "dd/mm/yyyy"
  if ([5, 7, 8, 9, 10].includes(c0)) cell.z = "#,##0"
  if (c0 === 6) cell.z = "0%"
  if (c0 === 0) cell.z = "0"
}

export const applyVacomHdStyles = (
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

  const safeStart = Math.max(0, dataStartRow0)
  const safeEnd = Math.max(safeStart, dataEndRow0)

  // row heights
  const rows = (((ws as any)["!rows"] || []) as any[]).slice()

  // set các dòng đặc biệt trước (nếu bạn vẫn cần)
  const setH = (r0: number, h: number) => {
    rows[r0] = { ...(rows[r0] || {}), hpt: h }
  }
  setH(3, 30)
  headerRows0.forEach((r0) => setH(r0, 30))
  sectionTitleRows0.forEach((r0) => setH(r0, 30))

  // ✅ data rows height = 16
  for (let r0 = safeStart; r0 <= safeEnd; r0++) {
    if (headerRows0.includes(r0)) continue
    if (sectionTitleRows0.includes(r0)) continue
    rows[r0] = { ...(rows[r0] || {}), hpt: 30 }
  }

  ;(ws as any)["!rows"] = rows
  // ✅ tăng height khu cuối (Doanh số / % thưởng / Tổng thực thu / ký tên) = 30
  {
    const aoa = getSheetAOA(ws)

    const findRowContains = (text: string) => {
      const needle = normalize(text)
      for (let r = 0; r < aoa.length; r++) {
        for (let c = 0; c < (aoa[r] || []).length; c++) {
          const v = aoa[r]?.[c]
          if (v == null || v === "") continue
          if (normalize(String(v)).includes(needle)) return r
        }
      }
      return -1
    }

    const rDoanh0 = findRowContains("Doanh số Vacom HCM đạt được")
    const rXacNhan0 = findRowContains("Xác nhận đại lý")
    const rMinv0 = findRowContains("M-INVOICE HCM")

    // ưu tiên lấy tới dòng M-INVOICE, nếu không có thì tới Xác nhận
    const start = rDoanh0 !== -1 ? rDoanh0 : -1
    const end = rMinv0 !== -1 ? rMinv0 : rXacNhan0 !== -1 ? rXacNhan0 : -1

    if (start !== -1 && end !== -1) {
      const s = Math.min(start, end)
      const e = Math.max(start, end)
      const rows2 = (((ws as any)["!rows"] || []) as any[]).slice()
      for (let r0 = s; r0 <= e; r0++) {
        rows2[r0] = { ...(rows2[r0] || {}), hpt: 30 }
      }
      ;(ws as any)["!rows"] = rows2
    }
  }

  // header style
  headerRows0.forEach((r0) => {
    for (let c0 = 0; c0 <= 10; c0++) {
      const isCHeaderTop3 = (r0 === 0 || r0 === 1 || r0 === 2) && c0 === 2
      styleCell(ws, r0, c0, {
        font: { ...FONT_TNR, bold: true },
        alignment: isCHeaderTop3
          ? { vertical: "center", horizontal: "left", wrapText: false }
          : { vertical: "center", horizontal: "center", wrapText: true },
        fill: { patternType: "solid", fgColor: { rgb: "EEF2F7" } },
        border: BORDER_THIN_VACOM,
      })
    }
  })

  // section title style

  sectionTitleRows0.forEach((r0) => {
    for (let c0 = 0; c0 <= 10; c0++) {
      styleCell(ws, r0, c0, {
        font: { ...FONT_TNR, bold: true },
        fill: { patternType: "solid", fgColor: { rgb: "DFF3E3" } },
        border: BORDER_THIN_VACOM,
        alignment: {
          vertical: "center",
          horizontal: "left", // ✅ left tất cả
          wrapText: false,
        },
      })

      // format số trên dòng tổng khu
      const addr = XLSX.utils.encode_cell({ r: r0, c: c0 })
      const cell = ws[addr] as any
      if (!cell) continue
      if ([4].includes(c0)) cell.z = "0"
      if ([5, 7, 8, 9, 10].includes(c0)) cell.z = "#,##0"
      if (c0 === 6) cell.z = "0%"
    }
  })

  // data grid style
  for (let r0 = safeStart; r0 <= safeEnd; r0++) {
    for (let c0 = 0; c0 <= 10; c0++) {
      const isNameCol = c0 === 2
      styleCell(ws, r0, c0, {
        font: { ...FONT_TNR },
        alignment: {
          vertical: "center",
          horizontal: isNameCol ? "left" : "center",
          wrapText: false, // ✅ không bung height
        },
        border: BORDER_THIN_VACOM,
      })
      applyColumnFormats(ws, r0, c0)
    }
  }
}

/** style dòng CỘNG – đặt SAU applyVacomHdStyles để không bị ghi đè */
export const styleCongRow = (ws: XLSX.WorkSheet, r0: number) => {
  for (let c0 = 0; c0 <= 10; c0++) {
    styleCell(ws, r0, c0, {
      font: { ...FONT_TNR, bold: true },
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

/** center các cột số trên dòng tổng khu (hàng xanh lá) */
export const centerTotalsOnSectionRow = (ws: XLSX.WorkSheet, r0: number) => {
  for (let c0 = 3; c0 <= 10; c0++) {
    styleCell(ws, r0, c0, {
      font: { ...FONT_TNR, bold: true },
      fill: { patternType: "solid", fgColor: { rgb: "DFF3E3" } },
      border: BORDER_THIN_VACOM,
      alignment: { vertical: "center", horizontal: "center", wrapText: true },
    })
    applyColumnFormats(ws, r0, c0)
  }
}

/** block cuối: bôi đen + format số có dấu phẩy */
export const styleTailBlockBold = (ws: XLSX.WorkSheet) => {
  const aoa = getSheetAOA(ws)

  const findRowContains = (text: string) => {
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

  const rStart = findRowContains("Doanh số Vacom HCM đạt được")
  const rEnd = findRowContains("Tổng Minvoice HCM thực thu:")
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
        font: { ...FONT_TNR, bold: true },

        alignment: {
          vertical: "center",
          horizontal: isNumber ? "center" : "left",
          wrapText: true,
        },
      })

      if (cell && isNumber) {
        if (cell.t !== "n") {
          const n = Number(cell.v)
          if (!isNaN(n)) {
            cell.t = "n"
            cell.v = n
          }
        }
        cell.z = "#,##0"
      }
    }
  }
}

/** chữ ký cuối */
export const styleSignArea = (ws: XLSX.WorkSheet) => {
  const aoa = getSheetAOA(ws)

  const findRowContains = (text: string) => {
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

  const rXacNhan0 = findRowContains("Xác nhận đại lý")
  const rHcmDate0 = findRowContains("HCM, ngày")
  let rMinvoice0 = findRowContains("M-INVOICE HCM")

  const rTong0 = findRowContains("Tổng Minvoice HCM thực thu")

  // tránh match nhầm
  if (rMinvoice0 === rTong0) {
    rMinvoice0 = -1
    for (let r = 0; r < aoa.length; r++) {
      for (let c = 0; c < (aoa[r]?.length ?? 0); c++) {
        const v = (aoa[r]?.[c] ?? "").toString().trim()
        if (v.includes("M-INVOICE")) {
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
        font: { ...FONT_TNR, bold: true },
        alignment: { vertical: "center", horizontal: "center", wrapText: true },
      })
    }
  }
}

/** header top: THÁNG / ĐẠI LÝ / Số ... + fix wrap/height */
export const applyTopHeader = (
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
    const docNo = mm && yyyy ? `Số ${mm}.${yyyy}MINV/HCM/VC` : `Số MINV/HCM/VC`
    ;(ws as any)[addrSo].t = "s"
    ;(ws as any)[addrSo].v = docNo
  }

  const styleHeaderCell = (addr: string, sz: number, hpt?: number) => {
    if (!addr || !(ws as any)[addr]) return
    const cell = (ws as any)[addr]
    cell.s = {
      ...(cell.s || {}),
      font: { ...(cell.s?.font || {}), ...FONT_TNR, bold: true, sz },
      alignment: {
        ...(cell.s?.alignment || {}),
        horizontal: "center",
        vertical: "center",
        wrapText: false,
      },
    }

    if (hpt != null) {
      const r0 = XLSX.utils.decode_cell(addr).r
      const rows = (((ws as any)["!rows"] || []) as any[]).slice()
      rows[r0] = { ...(rows[r0] || {}), hpt }
      ;(ws as any)["!rows"] = rows
    }
  }

  styleHeaderCell(title, 18, 30)
  styleHeaderCell(addrThang, 18, 30)
  styleHeaderCell(addrDaiLy, 13, 30)
  styleHeaderCell(addrSo, 13, 30)
}

/** map tháng cho dòng "Doanh số Vacom ... trong tháng ..." giống THÁNG: MM/YYYY */
export const applyTailMonth = (ws: XLSX.WorkSheet, monthStr: string) => {
  const aoa = getSheetAOA(ws)
  const month = String(monthStr ?? "").trim()
  if (!month) return

  // tìm row + col chứa "Doanh số Vacom HCM đạt được"
  const needle = normalize("Doanh số Vacom HCM đạt được")

  let hitR = -1
  let hitC = -1
  for (let r = 0; r < aoa.length; r++) {
    for (let c = 0; c < (aoa[r] || []).length; c++) {
      const v = aoa[r]?.[c]
      if (v == null || v === "") continue
      if (normalize(String(v)).includes(needle)) {
        hitR = r
        hitC = c
        break
      }
    }
    if (hitR !== -1) break
  }
  if (hitR === -1) return

  // nếu nằm trong merge -> set vào top-left của merge
  const merges = ((ws as any)["!merges"] || []) as XLSX.Range[]
  let topLeftC = hitC
  for (const m of merges) {
    if (hitR >= m.s.r && hitR <= m.e.r && hitC >= m.s.c && hitC <= m.e.c) {
      topLeftC = m.s.c
      break
    }
  }

  const addr = XLSX.utils.encode_cell({ r: hitR, c: topLeftC })
  const cell: any = (ws as any)[addr] || ((ws as any)[addr] = { t: "s", v: "" })

  // giữ style cũ
  const keepS = cell.s
  const keepZ = cell.z

  const curText = String(cell.v ?? "")
  // replace "trong tháng ..." nếu đã có, không thì append
  const nextText = /trong\s+tháng\s*\d{1,2}\/\d{4}/i.test(curText)
    ? curText.replace(/trong\s+tháng\s*\d{1,2}\/\d{4}/i, `trong tháng ${month}`)
    : `${curText.trim()} trong tháng ${month}`.trim()

  cell.t = "s"
  cell.v = nextText
  cell.s = keepS
  cell.z = keepZ

  // (optional) muốn giống header: canh trái + bold + no wrap thì mở dòng dưới
  // styleCell(ws, hitR, topLeftC, {
  //   font: { bold: true },
  //   alignment: { vertical: "center", horizontal: "left", wrapText: false },
  // })
}

/** map ngày hiện tại vào dòng "HCM, ngày ... tháng ... năm ..." */
export const applyHcmDateNow = (ws: XLSX.WorkSheet, d = new Date()) => {
  const aoa = getSheetAOA(ws)

  const needle = normalize("HCM, ngày")
  let hitR = -1
  let hitC = -1

  for (let r = 0; r < aoa.length; r++) {
    for (let c = 0; c < (aoa[r] || []).length; c++) {
      const v = aoa[r]?.[c]
      if (v == null || v === "") continue
      if (normalize(String(v)).includes(needle)) {
        hitR = r
        hitC = c
        break
      }
    }
    if (hitR !== -1) break
  }
  if (hitR === -1) return

  // nếu nằm trong merge -> set vào top-left
  const merges = ((ws as any)["!merges"] || []) as XLSX.Range[]
  let topLeftC = hitC
  for (const m of merges) {
    if (hitR >= m.s.r && hitR <= m.e.r && hitC >= m.s.c && hitC <= m.e.c) {
      topLeftC = m.s.c
      break
    }
  }

  const dd = String(d.getDate()).padStart(2, "0")
  const mm = String(d.getMonth() + 1).padStart(2, "0")
  const yyyy = String(d.getFullYear())

  const text = `HCM, ngày ${dd} tháng ${mm} năm ${yyyy}`

  const addr = XLSX.utils.encode_cell({ r: hitR, c: topLeftC })
  const cell: any = (ws as any)[addr] || ((ws as any)[addr] = { t: "s", v: "" })

  // giữ style cũ
  const keepS = cell.s
  const keepZ = cell.z

  cell.t = "s"
  cell.v = text
  cell.s = keepS
  cell.z = keepZ

  // (optional) nếu muốn chắc chắn no-wrap + center giống sign area:
  // styleCell(ws, hitR, topLeftC, {
  //   font: { bold: true },
  //   alignment: { vertical: "center", horizontal: "center", wrapText: false },
  // })
}
export const forceCompanyHeaderLeft = (ws: XLSX.WorkSheet) => {
  const fix = (addr: string) => {
    const cell: any =
      (ws as any)[addr] || ((ws as any)[addr] = { t: "s", v: "" })
    cell.s = {
      ...(cell.s || {}),
      alignment: {
        // ✅ overwrite hẳn alignment, đừng spread alignment cũ
        horizontal: "left",
        vertical: "center",
        wrapText: false,
      },
      font: { ...(cell.s?.font || {}), ...FONT_TNR, bold: true },
    }
  }

  fix("C1")
  fix("C2")
  fix("C3")
}
