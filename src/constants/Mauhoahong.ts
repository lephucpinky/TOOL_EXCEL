export const COL_HOA_HONG = {
  STT: 0, // A
  NGAY: 1, // B
  MST: 2, // C
  TEN: 3, // D
  SL: 4, // E
  TIEN: 5, // F
  GIAPP: 6, // G
  CHENH: 7, // H
  DOANHTHUKHAC: 8, // I
  HH_PERCENT: 9, // J (%)
  PHI_TRA: 10, // K
  HOA_HONG: 11, // L
  MI_THU: 12, // M
  CHENH_TT: 13, // N
  GHICHU: 14, // O (text)
} as const
export const FONT_TNR = { name: "Times New Roman" }
export const NUM_PARENS_FMT = "#,##0;(#,##0);0"

export const BLUE_LIGHT = { patternType: "solid", fgColor: { rgb: "D9EAF7" } }
export const BLUE_DARK = { patternType: "solid", fgColor: { rgb: "9DC3E6" } }
export const RED_FONT = { color: { rgb: "FF0000" }, bold: true }
export const YELLOW_BG = { patternType: "solid", fgColor: { rgb: "FFFF00" } }

export const BORDER_THIN = {
  top: { style: "thin", color: { rgb: "000000" } },
  bottom: { style: "thin", color: { rgb: "000000" } },
  left: { style: "thin", color: { rgb: "000000" } },
  right: { style: "thin", color: { rgb: "000000" } },
} as const

export const BORDER_THICK = {
  top: { style: "medium", color: { rgb: "000000" } },
  bottom: { style: "medium", color: { rgb: "000000" } },
  left: { style: "medium", color: { rgb: "000000" } },
  right: { style: "medium", color: { rgb: "000000" } },
} as const

export const HOA_HONG_COL_WIDTHS = [
  5, 10, 14, 70, 27, 20, 20, 20, 20, 20, 20, 20, 20, 20, 20,
]
