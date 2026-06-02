import { NextRequest, NextResponse } from "next/server"

const COMPANY_INFO_API_URL =
  process.env.COMPANY_INFO_API_URL ||
  "https://api-hopdong.mecontract.com.vn/api/v1/company-info"

const taxCodePattern = /^\d{10,13}$/

export async function GET(request: NextRequest) {
  const taxCode = String(
    request.nextUrl.searchParams.get("taxCode") || ""
  ).trim()

  if (!taxCodePattern.test(taxCode)) {
    return NextResponse.json(
      {
        message: "Mã số thuế hoặc CMND/CCCD phải có từ 10 đến 13 ký tự số.",
      },
      { status: 400 }
    )
  }

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), 10000)

  try {
    const apiUrl = new URL(COMPANY_INFO_API_URL)
    apiUrl.searchParams.set("taxCode", taxCode)

    const response = await fetch(apiUrl, {
      headers: {
        Accept: "application/json",
      },
      cache: "no-store",
      signal: controller.signal,
    })

    const body = await response.json().catch(() => null)

    if (!response.ok) {
      return NextResponse.json(
        body || { message: "Không thể tra cứu thông tin doanh nghiệp." },
        { status: response.status }
      )
    }

    return NextResponse.json(body)
  } catch (error) {
    const isTimeout =
      error instanceof Error &&
      (error.name === "AbortError" || error.name === "TimeoutError")

    return NextResponse.json(
      {
        message: isTimeout
          ? "Tra cứu thông tin doanh nghiệp quá thời gian chờ."
          : "Không thể kết nối dịch vụ tra cứu thông tin doanh nghiệp.",
      },
      { status: isTimeout ? 504 : 502 }
    )
  } finally {
    clearTimeout(timeoutId)
  }
}
