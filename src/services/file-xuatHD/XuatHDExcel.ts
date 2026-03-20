import * as XLSX from "xlsx-js-style"
import {
  addrRC,
  buildSalesIndex,
  clearDataKeepStyle,
  copyRowStyleBlock,
  deepClone,
  findRowContains,
  findTitleRowA,
  normalize,
  pickHeaderFromIndex,
  setFormulaKeepStyle,
  setNumberKeepStyle,
  setTextKeepStyle,
  toNumber,
} from "@/utils/excel"
import {
  COL_XUATHD,
  NUM_PARENS_FMT,
  sumTargetsHD,
} from "@/constants/XuatHoaDon"
export const pickSheetNameXuatHD = (
  workbook: XLSX.WorkBook,
  preferred?: string
) => {
  if (preferred && workbook.SheetNames.includes(preferred)) return preferred

  const names = workbook.SheetNames.map((raw) => ({
    raw,
    n: normalize(raw),
  }))

  for (const candidate of [
    "mẫu xuất hd",
    "xuất hd",
    "xuat hoa don",
    "sheet1",
  ]) {
    const hit = names.find((x) => x.n.includes(normalize(candidate)))
    if (hit) return hit.raw
  }

  return workbook.SheetNames[0] || ""
}
const isSumTargetCol = (c0: number) =>
  (sumTargetsHD as readonly number[]).includes(c0)

const getRefRange = (ws: XLSX.WorkSheet) => {
  const ref = (ws as any)["!ref"]
  return ref ? XLSX.utils.decode_range(ref) : null
}

const getLastCol0 = (ws: XLSX.WorkSheet) => {
  let last = COL_XUATHD.GHI_CHU

  const ref = (ws as any)["!ref"]
  if (ref) {
    const rng = XLSX.utils.decode_range(ref)
    last = Math.max(last, rng.e.c)
  }

  const cols: any[] = (ws as any)["!cols"] || []
  if (cols.length) last = Math.max(last, cols.length - 1)

  const merges: XLSX.Range[] = (ws as any)["!merges"] || []
  for (const m of merges) last = Math.max(last, m.e.c)

  return last
}

const setRefRange = (ws: XLSX.WorkSheet, endRow0: number, endCol0: number) => {
  ;(ws as any)["!ref"] = XLSX.utils.encode_range({
    s: { r: 0, c: 0 },
    e: { r: endRow0, c: endCol0 },
  })
}

const shiftRowsDown = (
  ws: XLSX.WorkSheet,
  fromRow0: number,
  offset: number,
  cStart0: number,
  cEnd0: number
) => {
  if (offset <= 0) return

  const rng = getRefRange(ws)
  if (!rng) return

  const endCol0 = Math.max(cEnd0, rng.e.c)

  for (let r0 = rng.e.r; r0 >= fromRow0; r0--) {
    for (let c0 = cStart0; c0 <= endCol0; c0++) {
      const src = addrRC(r0, c0)
      const dst = addrRC(r0 + offset, c0)
      const cell = (ws as any)[src]

      if (cell) (ws as any)[dst] = deepClone(cell)
      else delete (ws as any)[dst]

      delete (ws as any)[src]
    }
  }

  const rows: any[] = (ws as any)["!rows"] || []
  for (let r0 = rows.length - 1; r0 >= fromRow0; r0--) {
    if (rows[r0]) rows[r0 + offset] = deepClone(rows[r0])
    else delete rows[r0 + offset]
    delete rows[r0]
  }
  ;(ws as any)["!rows"] = rows

  const merges = (((ws as any)["!merges"] || []) as XLSX.Range[]).map((m) => {
    const next = deepClone(m)
    if (next.s.r >= fromRow0) next.s.r += offset
    if (next.e.r >= fromRow0) next.e.r += offset
    return next
  })
  ;(ws as any)["!merges"] = merges

  setRefRange(ws, rng.e.r + offset, endCol0)
}

const dayText = (v: any) => {
  if (v == null || v === "") return ""

  if (typeof v === "number" && Number.isFinite(v)) {
    return String(Math.trunc(v))
  }

  const raw = String(v).trim()
  if (!raw) return ""

  if (/^\d{1,2}$/.test(raw)) return raw

  const m1 = raw.match(/^T\d+\.(\d{1,2})$/i)
  if (m1) return m1[1]

  const m2 = raw.match(/(\d{1,2})[/-](\d{1,2})[/-](\d{4})/)
  if (m2) return m2[1]

  const m3 = raw.match(/(\d{4})[/-](\d{1,2})[/-](\d{1,2})/)
  if (m3) return m3[3]

  return raw
}

export const buildHeaderMapHD = (salesHeaders: string[]) => {
  const idx = buildSalesIndex(salesHeaders)
  const pick = (...aliases: string[]) => pickHeaderFromIndex(idx, ...aliases)

  const headerAA = salesHeaders?.[26] || ""
  const hhFromAA =
    normalize(headerAA) === normalize("HH") ? headerAA : pick("HH")

  return {
    THANG: pick("THÁNG", "THANG"),
    NGAY_KICH_HOAT: pick("NGÀY KÍCH HOẠT", "NGAY KICH HOAT"),
    DEALER: pick("Đại Lý", "ĐẠI LÝ", "Dealer", "Tên đại lý"),
    MST: pick("MST", "Mã số thuế"),
    TEN_CTY: pick("TÊN CTY", "TÊN CÔNG TY", "TÊN ĐƠN VỊ"),
    TIEU_DE: pick("TIÊU ĐỀ", "TIEU DE"),
    TEN_SP: pick("TÊN SP", "TEN SP"),
    BQ: pick("BQ", "BẢN QUYỀN"),
    SL_MOI: pick("SL MỚI", "SL MOI"),
    SL_GH: pick("SL GH", "SLGH"),
    SL_TANG: pick("SL TẶNG", "SL TANG"),
    GOI_HOA_DON: pick("GÓI HÓA ĐƠN", "GOI HOA DON", "GÓI HĐ"),
    KHAC: pick("KHÁC", "KHAC"),
    GIA_TRI_HOA_DON: pick("TỔNG XUẤT HĐ", "tổng xuất hoá đơn"),
    DT_MINVOICE: pick("DT MINVOICE", "DT_MINVOICE"),
    SO_TIEN: pick("SỐ TIỀN", "SO TIEN", "TIỀN THU", "TIEN THU"),
    HH: hhFromAA,
    GHI_CHU_SRC: pick("CHI CHÚ", "CHI CHU", "GHI CHÚ", "GHI CHU"),
  }
}

export const validateHeaderMapHD = (H: ReturnType<typeof buildHeaderMapHD>) => {
  const missing: string[] = []

  ;[
    ["THÁNG", H.THANG],
    ["NGÀY KÍCH HOẠT", H.NGAY_KICH_HOAT],
    ["Đại Lý", H.DEALER],
    ["MST", H.MST],
    ["TÊN CTY", H.TEN_CTY],
    ["TIÊU ĐỀ", H.TIEU_DE],
    ["BQ", H.BQ],
    ["GÓI HÓA ĐƠN", H.GOI_HOA_DON],
    ["KHÁC", H.KHAC],
    ["TỔNG XUẤT HĐ", H.GIA_TRI_HOA_DON],
    ["DT MINVOICE", H.DT_MINVOICE],
    ["HH", H.HH],
  ].forEach(([label, value]) => {
    if (!value) missing.push(label as string)
  })

  if (missing.length) {
    throw new Error(
      "Thiếu cột trong file theo dõi doanh số: " +
        Array.from(new Set(missing)).join(", ")
    )
  }
}

export const resolveTemplateRowsXuatHD = (ws: XLSX.WorkSheet) => {
  const rTotal = findTitleRowA(ws, "CỘNG", { startsWith: true, scanRows: 200 })
  const rHeaderTitle = findRowContains(ws, "NGÀY PHÁT SINH", {
    scanRows: 30,
    scanCols: 20,
  })

  const resolved = {
    rHeaderTitle: rHeaderTitle >= 0 ? rHeaderTitle : 7,
    rCodeRow: rHeaderTitle >= 0 ? rHeaderTitle + 2 : 9,
    rDataStart: rTotal >= 0 ? rTotal - 1 : 10,
    rDataEndTemplate: rTotal >= 0 ? rTotal - 1 : 10,
    rTotal: rTotal >= 0 ? rTotal : 11,
    rFooter1: rTotal >= 0 ? rTotal + 1 : 12,
    rFooter2: rTotal >= 0 ? rTotal + 2 : 13,
    rFooter3: rTotal >= 0 ? rTotal + 3 : 14,
    rFooter4: rTotal >= 0 ? rTotal + 4 : 15,
    rSignDate: rTotal >= 0 ? rTotal + 6 : 17,
    rSignTitle: rTotal >= 0 ? rTotal + 7 : 18,
  }

  return {
    ...resolved,
    srcDataRow: resolved.rDataStart,
    srcTotalRow: resolved.rTotal,
    srcFooter1: resolved.rFooter1,
    srcFooter2: resolved.rFooter2,
    srcFooter3: resolved.rFooter3,
    srcFooter4: resolved.rFooter4,
    srcSignDate: resolved.rSignDate,
    srcSignTitle: resolved.rSignTitle,
    cSheetEnd: getLastCol0(ws),
  }
}

export const ensureDataRowsSpaceXuatHD = (
  ws: XLSX.WorkSheet,
  rows: ReturnType<typeof resolveTemplateRowsXuatHD>,
  dataCount: number
) => {
  const templateCount = rows.rDataEndTemplate - rows.rDataStart + 1
  const extra = Math.max(0, dataCount - templateCount)
  const endCol0 = rows.cSheetEnd ?? getLastCol0(ws)

  if (extra > 0) {
    shiftRowsDown(ws, rows.rTotal, extra, 0, endCol0)
    copyRowStyleBlock(
      ws,
      rows.srcDataRow,
      rows.rDataEndTemplate + 1,
      extra,
      0,
      endCol0
    )
  }

  return {
    ...rows,
    cSheetEnd: endCol0,
    rDataEndTemplate: rows.rDataEndTemplate + extra,
    rTotal: rows.rTotal + extra,
    rFooter1: rows.rFooter1 + extra,
    rFooter2: rows.rFooter2 + extra,
    rFooter3: rows.rFooter3 + extra,
    rFooter4: rows.rFooter4 + extra,
    rSignDate: rows.rSignDate + extra,
    rSignTitle: rows.rSignTitle + extra,
  }
}

export const clearDataBlockXuatHD = (
  ws: XLSX.WorkSheet,
  rows: ReturnType<typeof resolveTemplateRowsXuatHD>
) => {
  clearDataKeepStyle(
    ws,
    rows.rDataStart,
    rows.rTotal - 1,
    0,
    COL_XUATHD.GHI_CHU,
    isSumTargetCol
  )

  setTextKeepStyle(ws, rows.rTotal, COL_XUATHD.STT, "CỘNG")
}

export const fillDataRowsXuatHD = (
  ws: XLSX.WorkSheet,
  rows: ReturnType<typeof resolveTemplateRowsXuatHD>,
  dataRows: any[],
  H: ReturnType<typeof buildHeaderMapHD>
) => {
  const pickRaw = (row: any, header: string) =>
    header ? row[header] : undefined
  const pickStr = (row: any, header: string) =>
    String(pickRaw(row, header) ?? "")

  for (let i = 0; i < dataRows.length; i++) {
    const r0 = rows.rDataStart + i
    const row = dataRows[i]

    const loaiSP = pickStr(row, H.TIEU_DE).trim()
    const isCKS = normalize(loaiSP) === normalize("CKS")

    const slMoi = toNumber(pickRaw(row, H.SL_MOI))
    const slGh = toNumber(pickRaw(row, H.SL_GH))
    const slTang = toNumber(pickRaw(row, H.SL_TANG))

    let soLuong = slMoi + slGh + slTang

    const banQuyen = isCKS ? 0 : toNumber(pickRaw(row, H.BQ))
    const goiHoaDon = toNumber(pickRaw(row, H.GOI_HOA_DON))
    const dtKhac = toNumber(pickRaw(row, H.KHAC))
    const giaTriNiemYet = banQuyen + goiHoaDon + dtKhac

    const giaTriTheoHoaDon = toNumber(pickRaw(row, H.GIA_TRI_HOA_DON))
    const giaMinvThuVe = toNumber(pickRaw(row, H.DT_MINVOICE))
    const hoaHongDL = giaTriTheoHoaDon - giaMinvThuVe
    const congNoThuKhach = toNumber(pickRaw(row, H.SO_TIEN))
    if (soLuong <= 0 && giaTriNiemYet > 0) soLuong = 1

    setNumberKeepStyle(ws, r0, COL_XUATHD.STT, i + 1)
    setTextKeepStyle(
      ws,
      r0,
      COL_XUATHD.THANG_PHAT_SINH,
      dayText(pickRaw(row, H.THANG))
    )
    setTextKeepStyle(ws, r0, COL_XUATHD.MA_SO_THUE, pickStr(row, H.MST))
    setTextKeepStyle(ws, r0, COL_XUATHD.TEN_DON_VI, pickStr(row, H.TEN_CTY))
    setTextKeepStyle(ws, r0, COL_XUATHD.LOAI_SP, loaiSP)

    if (isCKS) {
      setTextKeepStyle(ws, r0, COL_XUATHD.BAN_QUYEN, "")
    } else {
      setNumberKeepStyle(ws, r0, COL_XUATHD.BAN_QUYEN, banQuyen)
    }

    setNumberKeepStyle(ws, r0, COL_XUATHD.SO_LUONG, soLuong)
    setNumberKeepStyle(ws, r0, COL_XUATHD.GOI_HOA_DON, goiHoaDon)
    setNumberKeepStyle(ws, r0, COL_XUATHD.DT_KHAC, dtKhac)

    setFormulaKeepStyle(
      ws,
      r0,
      COL_XUATHD.GIA_TRI_HOA_DON,
      pickStr(row, H.GIA_TRI_HOA_DON)
    )

    setNumberKeepStyle(ws, r0, COL_XUATHD.GIA_MINV_THU_VE, giaMinvThuVe)
    setFormulaKeepStyle(
      ws,
      r0,
      COL_XUATHD.HOA_HONG_DL,
      `=${addrRC(r0, COL_XUATHD.GIA_TRI_HOA_DON)}-${addrRC(r0, COL_XUATHD.GIA_MINV_THU_VE)}`,
      NUM_PARENS_FMT,
      hoaHongDL
    )
    setNumberKeepStyle(ws, r0, COL_XUATHD.CONG_NO_THU_KHACH, congNoThuKhach)

    setFormulaKeepStyle(
      ws,
      r0,
      COL_XUATHD.CON_LAI,
      `=${addrRC(r0, COL_XUATHD.GIA_TRI_HOA_DON)}-${addrRC(
        r0,
        COL_XUATHD.CONG_NO_THU_KHACH
      )}`,
      NUM_PARENS_FMT,
      giaTriNiemYet - congNoThuKhach
    )

    const ghiChu = isCKS
      ? String(
          pickRaw(row, H.GHI_CHU_SRC) || pickRaw(row, H.TEN_SP) || ""
        ).trim()
      : ""

    setTextKeepStyle(ws, r0, COL_XUATHD.GHI_CHU, ghiChu)
  }
}

export const applyTotalRowXuatHD = (
  ws: XLSX.WorkSheet,
  rows: ReturnType<typeof resolveTemplateRowsXuatHD>,
  dataCount: number
) => {
  for (let c0 = 0; c0 <= COL_XUATHD.GHI_CHU; c0++) {
    if (c0 === COL_XUATHD.STT || isSumTargetCol(c0)) {
      continue
    }
    setTextKeepStyle(ws, rows.rTotal, c0, "")
  }

  const rStart1 = rows.rDataStart + 1
  const rEnd1 = rows.rDataStart + Math.max(0, dataCount - 1) + 1

  const mkSum = (colIdx: number) => {
    const col = XLSX.utils.encode_col(colIdx)
    return dataCount > 0 ? `SUM(${col}${rStart1}:${col}${rEnd1})` : "0"
  }

  for (const c0 of sumTargetsHD) {
    setFormulaKeepStyle(ws, rows.rTotal, c0, `=${mkSum(c0)}`, NUM_PARENS_FMT)
  }

  setTextKeepStyle(ws, rows.rTotal, COL_XUATHD.STT, "CỘNG")

  const linkTotal = (rDst0: number, col0: number) =>
    setFormulaKeepStyle(
      ws,
      rDst0,
      col0,
      `=${addrRC(rows.rTotal, col0)}`,
      NUM_PARENS_FMT
    )

  linkTotal(rows.rFooter1, COL_XUATHD.GIA_MINV_THU_VE)
  linkTotal(rows.rFooter2, COL_XUATHD.CONG_NO_THU_KHACH)
  linkTotal(rows.rFooter3, COL_XUATHD.HOA_HONG_DL)

  setFormulaKeepStyle(
    ws,
    rows.rFooter4,
    COL_XUATHD.CONG_NO_THU_KHACH,
    `=${addrRC(rows.rTotal, COL_XUATHD.GIA_TRI_HOA_DON)}-${addrRC(
      rows.rTotal,
      COL_XUATHD.HOA_HONG_DL
    )}-${addrRC(rows.rTotal, COL_XUATHD.CONG_NO_THU_KHACH)}`,
    NUM_PARENS_FMT
  )
}
