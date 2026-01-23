import { excelSerialToDateString, normalize } from "./excel"

export const formatPreviewValue = (header: string, value: any) => {
  const h = normalize(header)

  // ngày
  if (h.includes("ngay") && Number.isFinite(Number(value))) {
    return excelSerialToDateString(value)
  }

  // ✅ CHỈ % cho cột "TỶ LỆ HOA HỒNG" hoặc header có ký tự %
  const isPercentCol = h.includes("tylehoahong") || header.includes("%")
  if (isPercentCol) {
    const n = Number(value)
    if (!Number.isFinite(n)) return String(value ?? "")
    const frac = n > 1 ? n / 100 : n
    return `${Math.round(frac * 100)}%`
  }

  // ✅ Cột "Hoa hồng" là TIỀN -> hiển thị dạng số (có thể thêm format tiền nếu bạn muốn)
  return String(value ?? "")
}
