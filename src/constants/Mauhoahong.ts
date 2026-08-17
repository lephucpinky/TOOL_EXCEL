export const COL_HOA_HONG = {
  STT: 0, // A
  NGAYPHATSINH: 1, // B   //NGÀY KÍCH HOẠT
  MASOTHUE: 2, // C     MÃ SỐ THUẾ
  TENDONVI: 3, // D    TÊN ĐẠI LÝ
  SOLUONG: 4, // E Số lượng
  GIA_TRI_XUAT_HOA_DON: 5, // F = TỔNG TIỀN SAU THUẾ từ báo cáo
  GIA_DOI_SOAT: 6, // G
  GIA_TRI_VIET_CHENH: 7, // H = F-G
  TIEN_HOA_HONG: 8, // I = CHIẾT KHẤU từ báo cáo
  CHENH_LECH_VIET_CHENH: 9, // J = CHI CHÊNH từ báo cáo
  TONG_TIEN_TRA_DOI_TAC: 10, // K = I+J
  MINV_DA_THU: 11, // L   THU TIỀN
  CHENH_LECH_THANH_TOAN: 12, // M = F-L
  GHI_CHU: 13, // N
} as const

export const sumTargets = [
  COL_HOA_HONG.SOLUONG,
  COL_HOA_HONG.GIA_TRI_XUAT_HOA_DON,
  COL_HOA_HONG.GIA_DOI_SOAT,
  COL_HOA_HONG.GIA_TRI_VIET_CHENH,
  COL_HOA_HONG.TIEN_HOA_HONG,
  COL_HOA_HONG.CHENH_LECH_VIET_CHENH,
  COL_HOA_HONG.TONG_TIEN_TRA_DOI_TAC,
  COL_HOA_HONG.MINV_DA_THU,
  COL_HOA_HONG.CHENH_LECH_THANH_TOAN,
]

export const FONT_TNR = { name: "Times New Roman" }
export const NUM_PARENS_FMT = `_-* #,##0_-;[Red]_* (#,##0);_-* "-"_-;_-@_-`

export const BLUE_LIGHT = { patternType: "solid", fgColor: { rgb: "D9EAF7" } }
export const BLUE_DARK = { patternType: "solid", fgColor: { rgb: "9DC3E6" } }
export const RED_FONT = { color: { rgb: "FF0000" }, bold: true }
export const YELLOW_BG = { patternType: "solid", fgColor: { rgb: "FFFF00" } }
export const PURPLE_BG = {
  patternType: "solid",
  fgColor: { rgb: "B1A0C7" }, // giống màu trong hình (RGB 177,160,199)
}

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

// 14 cot A..N
export const HOA_HONG_COL_WIDTHS = [
  4, 14, 14, 40, 10, 16, 14, 14, 14, 16, 18, 14, 18, 14,
]
