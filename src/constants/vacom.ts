export const COL_WCH_VACOM = [6, 22, 66, 14, 18, 18, 18, 18, 18, 18, 18, 18] // A..L

export const BORDER_THIN_VACOM = {
  top: { style: "thin", color: { rgb: "000000" } },
  bottom: { style: "thin", color: { rgb: "000000" } },
  left: { style: "thin", color: { rgb: "000000" } },
  right: { style: "thin", color: { rgb: "000000" } },
} as const

/** ====== define column indexes after adding "Loại hợp đồng" ====== */
export const COL_VACOM = {
  STT: 0,
  MST: 1,
  TEN_HD: 2,
  LOAI_HD: 3, // ✅ new column
  NGAY_KICH_HOAT: 4, // dd/mm/yyyy
  SLHD: 5, // integer
  TONG_GIA_TRI: 6, // money
  PHAN_TRAM_HH: 7, // percent
  DAI_LY_DUOC_HUONG: 8, // money
  HH_THUONG_5: 9, // money
  TONG_TRICH_DAI_LY: 10, // money
  CON_PHAI_THANH_TOAN: 11, // money
} as const

export const MONEY_COLS_VACOM = [
  COL_VACOM.TONG_GIA_TRI,
  COL_VACOM.DAI_LY_DUOC_HUONG,
  COL_VACOM.HH_THUONG_5,
  COL_VACOM.TONG_TRICH_DAI_LY,
  COL_VACOM.CON_PHAI_THANH_TOAN,
]
