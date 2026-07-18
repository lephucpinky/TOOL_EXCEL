import ExcelJS from "exceljs"
import JSZip from "jszip"
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
  document.body.appendChild(a)
  a.click()
  a.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 0)
}

// px -> EMU (Excel drawing unit)
const pxToEmu = (px: number) => Math.round(px * 9525)

const ensureContentTypes = (ctXml: string) => {
  // ensure png default
  if (!ctXml.includes('Extension="png"')) {
    ctXml = ctXml.replace(
      "</Types>",
      `<Default Extension="png" ContentType="image/png"/></Types>`
    )
  }
  // ensure drawing override exists (we'll add drawingX.xml)
  // (we add override later when we know drawing path; safe to add generic pattern per file)
  return ctXml
}

const nextIndex = (names: string[], prefix: string, suffix: string) => {
  let max = 0
  for (const n of names) {
    const m = n.match(new RegExp(`${prefix}(\\d+)\\${suffix}$`))
    if (m) max = Math.max(max, Number(m[1]))
  }
  return max + 1
}

const ensureRelsFile = (xml?: string) => {
  if (xml && xml.trim()) return xml
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"></Relationships>`
}

const addRelationship = (
  relsXml: string,
  rel: { Id: string; Type: string; Target: string }
) => {
  if (relsXml.includes(`Id="${rel.Id}"`)) return relsXml
  return relsXml.replace(
    "</Relationships>",
    `<Relationship Id="${rel.Id}" Type="${rel.Type}" Target="${rel.Target}"/></Relationships>`
  )
}

const getSheetTargetByName = async (
  zip: JSZip,
  sheetName: string
): Promise<{ sheetPath: string; sheetRelsPath: string }> => {
  const wbXml = await zip.file("xl/workbook.xml")!.async("text")
  const wbRelsXml = await zip.file("xl/_rels/workbook.xml.rels")!.async("text")

  // 1) find r:id of sheet by name
  // <sheet name="..." sheetId="1" r:id="rId1"/>
  const sheetRegex = new RegExp(
    `<sheet[^>]*name="${sheetName.replace(/"/g, "&quot;")}"[^>]*r:id="([^"]+)"[^>]*/?>`
  )
  const m1 = wbXml.match(sheetRegex)
  if (!m1)
    throw new Error(
      `Không tìm thấy sheet name="${sheetName}" trong workbook.xml`
    )

  const rid = m1[1]

  // 2) map rid -> target
  // <Relationship Id="rId1" Type=".../worksheet" Target="worksheets/sheet1.xml"/>
  const relRegex = new RegExp(
    `<Relationship[^>]*Id="${rid}"[^>]*Target="([^"]+)"[^>]*/?>`
  )
  const m2 = wbRelsXml.match(relRegex)
  if (!m2)
    throw new Error(
      `Không map được ${rid} -> worksheet target trong workbook.xml.rels`
    )

  const target = m2[1] // e.g. worksheets/sheet1.xml
  const sheetPath = `xl/${target}`
  const baseName = target.split("/").pop()! // sheet1.xml
  const sheetRelsPath = `xl/worksheets/_rels/${baseName}.rels`

  return { sheetPath, sheetRelsPath }
}

const getOrCreateDrawingForSheet = async (
  zip: JSZip,
  sheetXml: string,
  sheetRelsXml: string
): Promise<{
  sheetXml: string
  sheetRelsXml: string
  drawingPath: string
  drawingRelsPath: string
  drawingXml: string
  drawingRelsXml: string
  drawingRidOnSheet: string
}> => {
  // Check if sheet already has <drawing r:id="rIdX"/>
  const m = sheetXml.match(/<drawing[^>]*r:id="([^"]+)"[^>]*\/>/)
  if (m) {
    const drawingRidOnSheet = m[1]
    // find drawing target in sheet rels
    const relRegex = new RegExp(
      `<Relationship[^>]*Id="${drawingRidOnSheet}"[^>]*Target="([^"]+)"[^>]*/?>`
    )
    const mr = sheetRelsXml.match(relRegex)
    if (!mr)
      throw new Error(
        "Sheet có <drawing> nhưng không thấy relationship trong sheet rels."
      )
    const drawingTarget = mr[1] // ../drawings/drawing1.xml
    const drawingPath = `xl/${drawingTarget.replace(/^\.\.\//, "")}` // xl/drawings/drawing1.xml
    const drawingRelsPath = drawingPath
      .replace("xl/drawings/", "xl/drawings/_rels/")
      .replace(".xml", ".xml.rels")

    const drawingXml = await zip.file(drawingPath)!.async("text")
    const drawingRelsXml = ensureRelsFile(
      zip.file(drawingRelsPath)
        ? await zip.file(drawingRelsPath)!.async("text")
        : undefined
    )

    return {
      sheetXml,
      sheetRelsXml,
      drawingPath,
      drawingRelsPath,
      drawingXml,
      drawingRelsXml,
      drawingRidOnSheet,
    }
  }

  // Need create new drawing
  const names = Object.keys(zip.files)
  const drawingIdx = nextIndex(names, "xl/drawings/drawing", ".xml")
  const drawingPath = `xl/drawings/drawing${drawingIdx}.xml`
  const drawingRelsPath = `xl/drawings/_rels/drawing${drawingIdx}.xml.rels`

  // choose next rId for sheet rels
  const existingIds = Array.from(sheetRelsXml.matchAll(/Id="rId(\d+)"/g)).map(
    (x) => Number(x[1])
  )
  const nextRidNum = (existingIds.length ? Math.max(...existingIds) : 0) + 1
  const drawingRidOnSheet = `rId${nextRidNum}`

  // Add <drawing .../> to sheet (near end, before </worksheet>)
  if (!sheetXml.includes("<drawing")) {
    sheetXml = sheetXml.replace(
      "</worksheet>",
      `<drawing xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" r:id="${drawingRidOnSheet}"/></worksheet>`
    )
  }

  // Add rel in sheet rels
  sheetRelsXml = addRelationship(sheetRelsXml, {
    Id: drawingRidOnSheet,
    Type: "http://schemas.openxmlformats.org/officeDocument/2006/relationships/drawing",
    Target: `../drawings/drawing${drawingIdx}.xml`,
  })

  const drawingXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<xdr:wsDr xmlns:xdr="http://schemas.openxmlformats.org/drawingml/2006/spreadsheetDrawing"
          xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"></xdr:wsDr>`

  const drawingRelsXml = ensureRelsFile(undefined)

  return {
    sheetXml,
    sheetRelsXml,
    drawingPath,
    drawingRelsPath,
    drawingXml,
    drawingRelsXml,
    drawingRidOnSheet,
  }
}

export async function addLogoToA1_OOXML(
  xlsxArrayBuffer: ArrayBuffer,
  sheetName: string,
  logoBase64: string,
  opts?: {
    widthPx?: number
    heightPx?: number
    col?: number
    row?: number
    colOffPx?: number
    rowOffPx?: number
  }
): Promise<ArrayBuffer> {
  const widthPx = opts?.widthPx ?? 150
  const heightPx = opts?.heightPx ?? 85
  const col = opts?.col ?? 8
  const row = opts?.row ?? 0
  const colOffPx = opts?.colOffPx ?? 10
  const rowOffPx = opts?.rowOffPx ?? 5

  const zip = await JSZip.loadAsync(xlsxArrayBuffer)

  // Ensure [Content_Types]
  let ctXml = await zip.file("[Content_Types].xml")!.async("text")
  ctXml = ensureContentTypes(ctXml)

  // Find sheet xml path by sheet name
  const { sheetPath, sheetRelsPath } = await getSheetTargetByName(
    zip,
    sheetName
  )

  let sheetXml = await zip.file(sheetPath)!.async("text")
  let sheetRelsXml = ensureRelsFile(
    zip.file(sheetRelsPath)
      ? await zip.file(sheetRelsPath)!.async("text")
      : undefined
  )

  // Get or create drawing parts
  const drawingInfo = await getOrCreateDrawingForSheet(
    zip,
    sheetXml,
    sheetRelsXml
  )
  sheetXml = drawingInfo.sheetXml
  sheetRelsXml = drawingInfo.sheetRelsXml

  let drawingXml = drawingInfo.drawingXml
  let drawingRelsXml = drawingInfo.drawingRelsXml

  // Add image into xl/media
  const namesNow = Object.keys(zip.files)
  const imgIdx = nextIndex(namesNow, "xl/media/image", ".png")
  const imgPath = `xl/media/image${imgIdx}.png`

  // decode base64 -> binary
  const bin = Uint8Array.from(atob(logoBase64), (c) => c.charCodeAt(0))
  zip.file(imgPath, bin)

  // Ensure ContentTypes has Override for drawing + Default png already
  if (!ctXml.includes(`PartName="/${drawingInfo.drawingPath}"`)) {
    ctXml = ctXml.replace(
      "</Types>",
      `<Override PartName="/${drawingInfo.drawingPath}" ContentType="application/vnd.openxmlformats-officedocument.drawing+xml"/></Types>`
    )
  }

  // Add relationship in drawing rels to image
  const existingDrawRelIds = Array.from(
    drawingRelsXml.matchAll(/Id="rId(\d+)"/g)
  ).map((x) => Number(x[1]))
  const nextDrawRidNum =
    (existingDrawRelIds.length ? Math.max(...existingDrawRelIds) : 0) + 1
  const imgRid = `rId${nextDrawRidNum}`

  drawingRelsXml = addRelationship(drawingRelsXml, {
    Id: imgRid,
    Type: "http://schemas.openxmlformats.org/officeDocument/2006/relationships/image",
    Target: `../media/image${imgIdx}.png`,
  })

  const cx = pxToEmu(widthPx)
  const cy = pxToEmu(heightPx)
  const colOff = pxToEmu(colOffPx)
  const rowOff = pxToEmu(rowOffPx)

  const anchor = `
  <xdr:oneCellAnchor>
    <xdr:from>
      <xdr:col>${col}</xdr:col>
      <xdr:colOff>${colOff}</xdr:colOff>
      <xdr:row>${row}</xdr:row>
      <xdr:rowOff>${rowOff}</xdr:rowOff>
    </xdr:from>
    <xdr:ext cx="${cx}" cy="${cy}"/>
    <xdr:pic>
      <xdr:nvPicPr>
        <xdr:cNvPr id="${1000 + imgIdx}" name="Picture ${imgIdx}"/>
        <xdr:cNvPicPr/>
      </xdr:nvPicPr>
      <xdr:blipFill>
        <a:blip xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" r:embed="${imgRid}"/>
        <a:stretch><a:fillRect/></a:stretch>
      </xdr:blipFill>
      <xdr:spPr>
        <a:prstGeom prst="rect"><a:avLst/></a:prstGeom>
      </xdr:spPr>
    </xdr:pic>
    <xdr:clientData/>
  </xdr:oneCellAnchor>`

  if (!drawingXml.includes("</xdr:wsDr>")) {
    throw new Error("drawing.xml không hợp lệ: thiếu </xdr:wsDr>")
  }

  drawingXml = drawingXml.replace("</xdr:wsDr>", `${anchor}\n</xdr:wsDr>`)

  // Write back files
  zip.file("[Content_Types].xml", ctXml)
  zip.file(sheetPath, sheetXml)
  zip.file(sheetRelsPath, sheetRelsXml)
  zip.file(drawingInfo.drawingPath, drawingXml)
  zip.file(drawingInfo.drawingRelsPath, drawingRelsXml)

  const out = await zip.generateAsync({ type: "arraybuffer" })
  return out
}
