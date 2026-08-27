export const COL_XUATHD = {
  STT: 0,
  NGAY_PHAT_SINH: 1,
  MA_SO_THUE: 2,
  TEN_DON_VI: 3,
  LOAI_SP: 4,
  SO_LUONG: 5,
  DT_KHAC: 6,
  GIA_TRI_HOA_DON: 7,
  GIA_MINV_THU_VE: 8,
  HOA_HONG_DL: 9,
  CONG_NO_THU_KHACH: 10,
  CON_LAI: 11,
  GHI_CHU: 12,
}

export const WIDTH_COL_XUATHD = [
  4.82, // A
  10, // B
  18.18, // C
  45.55, // D
  8.82, // E
  11.36, // F
  10.82, // G
  10.91, // H
  9.73, // I
  12.18, // J
  16.18, // K
  10.09, // L
  8.82, // M
]
export const NUM_PARENS_FMT = `_-* #,##0_-;[Red]_* (#,##0);_-* "-"_-;_-@_-`
export const THIN_BORDER = {
  top: { style: "thin", color: { rgb: "000000" } },
  bottom: { style: "thin", color: { rgb: "000000" } },
  left: { style: "thin", color: { rgb: "000000" } },
  right: { style: "thin", color: { rgb: "000000" } },
}

export const HEADER_FILL = {
  patternType: "solid",
  fgColor: { rgb: "D9D9D9" },
  bgColor: { rgb: "D9D9D9" },
}

export const WHITE_FILL = {
  patternType: "solid",
  fgColor: { rgb: "FFFFFF" },
  bgColor: { rgb: "FFFFFF" },
}

export const fontBase = {
  name: "Times New Roman",
  sz: 10,
  color: { rgb: "000000" },
}
export const fontTitle = {
  ...fontBase,
  sz: 16,
  bold: true,
}

export const fontBold = {
  ...fontBase,
  bold: true,
}

export const fontItalicBold = {
  ...fontBase,
  bold: true,
  italic: true,
}

export const sumTargetsHD = [
  COL_XUATHD.SO_LUONG,
  COL_XUATHD.DT_KHAC,
  COL_XUATHD.GIA_TRI_HOA_DON,
  COL_XUATHD.GIA_MINV_THU_VE,
  COL_XUATHD.HOA_HONG_DL,
  COL_XUATHD.CONG_NO_THU_KHACH,
  COL_XUATHD.CON_LAI,
]
