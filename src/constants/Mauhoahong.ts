export const COL_HOA_HONG = {
  STT: 0, // A
  NGAY: 1, // B
  MST: 2, // C
  TEN: 3, // D
  BANQUYEN: 4, // E  (BQ)
  SL_MOI: 5, // F
  SL_GH: 6, // G
  SL_TANG: 7, // H
  DT_GOI_HD: 8, // I (GÓI HÓA ĐƠN)
  DT_KHAC: 9, // J (KHÁC)
  TRI_GIA_XUAT_HD: 10, // K (TỔNG XUẤT HD)
  GIA_DOI_SOAT: 11, // L (=E+I+J)
  VUOT_GIA: 12, // M (VIẾT CHÊNH)
  TIEN_HOA_HONG: 13, // N (HH)
  PHI_VIET_CHENH: 14, // O (T VIẾT CHÊNH)
  TONG_TRA_DOI_TAC: 15, // P ()
  DT_MINVOICE: 16, // Q (DT MINVOICE)
  CHENH_LECH: 17, // R (=P-Q)
  GHI_CHU: 18, // S
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

// ✅ 19 cột A..S
export const HOA_HONG_COL_WIDTHS = [
  6, 14, 14, 40, 14, 8, 11, 11, 11, 11, 12, 14, 14, 14, 14, 16, 14, 14, 18,
]
