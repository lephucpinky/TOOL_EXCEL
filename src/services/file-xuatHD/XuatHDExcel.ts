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

const dateText = (v: any) => {
  if (v == null || v === "") return ""

  if (v instanceof Date && !Number.isNaN(v.getTime())) {
    return `${String(v.getDate()).padStart(2, "0")}/${String(
      v.getMonth() + 1
    ).padStart(2, "0")}/${v.getFullYear()}`
  }

  if (typeof v === "number" && Number.isFinite(v)) {
    const parsed = XLSX.SSF.parse_date_code(v)
    if (parsed) {
      return `${String(parsed.d).padStart(2, "0")}/${String(parsed.m).padStart(
        2,
        "0"
      )}/${parsed.y}`
    }

    return String(v)
  }

  const raw = String(v).trim()
  if (!raw) return ""

  const vietnameseDate = raw.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})(?:\D|$)/)
  if (vietnameseDate) {
    return `${vietnameseDate[1].padStart(2, "0")}/${vietnameseDate[2].padStart(
      2,
      "0"
    )}/${vietnameseDate[3]}`
  }

  const isoDate = raw.match(/^(\d{4})[/-](\d{1,2})[/-](\d{1,2})(?:[T\s]|$)/)
  if (isoDate) {
    return `${isoDate[3].padStart(2, "0")}/${isoDate[2].padStart(2, "0")}/${
      isoDate[1]
    }`
  }

  return raw
}

export const buildHeaderMapHD = (salesHeaders: string[]) => {
  const idx = buildSalesIndex(salesHeaders)
  const pick = (...aliases: string[]) => pickHeaderFromIndex(idx, ...aliases)

  return {
    NGAY_PHAT_SINH: pick(
      "NGÀY PHÁT SINH",
      "NGAY PHAT SINH",
      "NGÀY KÍCH HOẠT",
      "NGAY KICH HOAT",
      "THÁNG PHÁT SINH",
      "THANG PHAT SINH",
      "THÁNG",
      "THANG"
    ),
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
    MST: pick("MST", "Mã số thuế"),
    TEN_CTY: pick("TÊN CTY", "TÊN CÔNG TY", "TÊN ĐƠN VỊ"),
    LOAI_SAN_PHAM: pick("MÃ SẢN PHẨM", "MA SAN PHAM"),
    SO_LUONG: pick("SỐ LƯỢNG", "SO LUONG", "SOLUONG", "SL"),
    DT_KHAC: pick("DT KHÁC", "DT KHAC", "DOANH THU KHÁC", "KHÁC", "KHAC"),
    GIA_TRI_HOA_DON: pick(
      "TỔNG TIỀN SAU THUẾ",
      "TONG TIEN SAU THUE",
      "TIỀN SAU THUẾ",
      "TIEN SAU THUE",
      "TỔNG XUẤT HĐ",
      "TỔNG XUẤT HÓA ĐƠN"
    ),
    HOA_HONG_DL: pick("CHIẾT KHẤU", "CHIET KHAU", "HOA HỒNG ĐL", "HOA HONG DL"),
    SO_TIEN: pick(
      "SỐ TIỀN",
      "SO TIEN",
      "SOTIEN",
      "SỐ TIỀN THU",
      "SO TIEN THU",
      "TIỀN THU",
      "TIEN THU",
      "M-INV ĐÃ THU",
      "M INV DA THU",
      "MINV DA THU",
      "M-INVOICE ĐÃ THU",
      "M INVOICE DA THU",
      "THU TIỀN",
      "THU TIEN"
    ),
    GHI_CHU_SRC: pick("CHI CHÚ", "CHI CHU", "GHI CHÚ", "GHI CHU"),
  }
}

export const validateHeaderMapHD = (H: ReturnType<typeof buildHeaderMapHD>) => {
  const missing: string[] = []

  ;[
    ["NGÀY PHÁT SINH", H.NGAY_PHAT_SINH],
    ["Đại Lý", H.DEALER],
    ["MST", H.MST],
    ["TÊN CTY", H.TEN_CTY],
    ["LOẠI SẢN PHẨM", H.LOAI_SAN_PHAM],
    ["SỐ LƯỢNG", H.SO_LUONG],
    ["TỔNG TIỀN SAU THUẾ", H.GIA_TRI_HOA_DON],
    ["CHIẾT KHẤU", H.HOA_HONG_DL],
    ["SỐ TIỀN", H.SO_TIEN],
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
  let rHeaderTitle = findRowContains(ws, "NGÀY PHÁT SINH", {
    scanRows: 30,
    scanCols: 20,
  })
  if (rHeaderTitle < 0) {
    rHeaderTitle = findRowContains(ws, "THÁNG PHÁT SINH", {
      scanRows: 30,
      scanCols: 20,
    })
  }

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

    const loaiSP = pickStr(row, H.LOAI_SAN_PHAM).trim()
    const soLuong = toNumber(pickRaw(row, H.SO_LUONG))
    const dtKhac = toNumber(pickRaw(row, H.DT_KHAC))
    const giaTriTheoHoaDon = toNumber(pickRaw(row, H.GIA_TRI_HOA_DON))
    const hoaHongDL = toNumber(pickRaw(row, H.HOA_HONG_DL))
    const giaMinvThuVe = giaTriTheoHoaDon - hoaHongDL
    const congNoThuKhach = toNumber(pickRaw(row, H.SO_TIEN))

    setNumberKeepStyle(ws, r0, COL_XUATHD.STT, i + 1)
    setTextKeepStyle(
      ws,
      r0,
      COL_XUATHD.NGAY_PHAT_SINH,
      dateText(pickRaw(row, H.NGAY_PHAT_SINH))
    )
    setTextKeepStyle(ws, r0, COL_XUATHD.MA_SO_THUE, pickStr(row, H.MST))
    setTextKeepStyle(ws, r0, COL_XUATHD.TEN_DON_VI, pickStr(row, H.TEN_CTY))
    setTextKeepStyle(ws, r0, COL_XUATHD.LOAI_SP, loaiSP)

    setNumberKeepStyle(ws, r0, COL_XUATHD.SO_LUONG, soLuong)
    setNumberKeepStyle(ws, r0, COL_XUATHD.DT_KHAC, dtKhac)

    setNumberKeepStyle(ws, r0, COL_XUATHD.GIA_TRI_HOA_DON, giaTriTheoHoaDon)

    setFormulaKeepStyle(
      ws,
      r0,
      COL_XUATHD.GIA_MINV_THU_VE,
      `=${addrRC(r0, COL_XUATHD.GIA_TRI_HOA_DON)}-${addrRC(r0, COL_XUATHD.HOA_HONG_DL)}`,
      NUM_PARENS_FMT,
      giaMinvThuVe
    )
    setNumberKeepStyle(ws, r0, COL_XUATHD.HOA_HONG_DL, hoaHongDL)
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
      giaTriTheoHoaDon - congNoThuKhach
    )

    setTextKeepStyle(
      ws,
      r0,
      COL_XUATHD.GHI_CHU,
      pickStr(row, H.GHI_CHU_SRC).trim()
    )
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
