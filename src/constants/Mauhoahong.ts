export const COL_HOA_HONG = {
  STT: 0, // A
  NGAY: 1, // B
  MST: 2, // C
  TEN: 3, // D
  LOAIHD: 4, // E
  SL: 5, // F
  TIEN: 6, // G
  GIAPP: 7, // H
  CHENH: 8, // I
  DOANHTHUKHAC: 9, // J
  HH_PERCENT: 10, // K (%)
  PHI_TRA: 11, // L
  HOA_HONG: 12, // M
  MI_THU: 13, // N
  CHENH_TT: 14, // O
  GHICHU: 15, // P (text)
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
  6, 14, 14, 40, 14, 8, 11, 11, 11, 11, 6, 11, 11, 11, 11, 8,
]
