import ExcelJS from "exceljs"

// fetch logo từ /public và trả về base64 thuần
export async function fetchPngAsBase64(url: string) {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Không tải được logo: ${url}`)
  const blob = await res.blob()
  return await new Promise<string>((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => {
      const s = String(r.result || "")
      resolve(s.split(",")[1] || "")
    }
    r.onerror = reject
    r.readAsDataURL(blob)
  })
}

// chèn logo vào A1 bằng ExcelJS (nhúng base64 vào workbook)
export async function addLogoToA1ExcelJS(
  xlsxArrayBuffer: ArrayBuffer,
  sheetName: string,
  logoBase64: string
) {
  const wb = new ExcelJS.Workbook()
  await wb.xlsx.load(xlsxArrayBuffer)

  const ws = wb.getWorksheet(sheetName)
  if (!ws) throw new Error(`Không tìm thấy sheet: ${sheetName}`)

  const imageId = wb.addImage({
    base64: `data:image/png;base64,${logoBase64}`,
    extension: "png",
  })

  // ✅ đặt logo tại A1 (góc trái trên)
  ws.addImage(imageId, {
    tl: { col: 0, row: 0 }, // A1
    ext: { width: 150, height: 85 }, // tùy chỉnh kích thước
  })

  // (tuỳ chọn) tăng chiều cao vài dòng đầu để logo không đè nội dung
  ws.getRow(1).height = 22
  ws.getRow(2).height = 22
  ws.getRow(3).height = 22
  ws.getRow(4).height = 22

  return (await wb.xlsx.writeBuffer()) as ArrayBuffer
}

// download ArrayBuffer (client)
export function downloadArrayBuffer(buf: ArrayBuffer, filename: string) {
  const blob = new Blob([buf], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
