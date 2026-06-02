export type CompanyInfo = {
  taxCode: string
  companyName: string
  address: string
}

type ApiErrorBody = {
  message?: string
  error?: string
}

function getErrorMessage(body: unknown, fallback: string) {
  if (!body || typeof body !== "object") return fallback

  const errorBody = body as ApiErrorBody
  return errorBody.message || errorBody.error || fallback
}

export function normalizeCompanyInfoResponse(response: any): CompanyInfo | null {
  const content =
    response?.content ?? response?.data?.content ?? response?.data ?? response

  if (!content || typeof content !== "object") return null

  const taxCode = String(
    content.taxCode || content.tax_code || content.inv_buyerTaxCode || ""
  ).trim()
  const companyName = String(
    content.company_name ||
      content.companyName ||
      content.inv_buyerLegalName ||
      content.inv_buyerDisplayName ||
      ""
  ).trim()
  const address = String(
    content.address || content.inv_buyerAddressLine || ""
  ).trim()

  if (!taxCode || !companyName || !address) return null

  return {
    taxCode,
    companyName,
    address,
  }
}

export async function APIGetCompanyInfo(taxCode: string) {
  const response = await fetch(
    `/api/company-info?taxCode=${encodeURIComponent(taxCode)}`,
    {
      headers: {
        Accept: "application/json",
      },
      cache: "no-store",
    }
  )

  const body = await response.json().catch(() => null)

  if (!response.ok) {
    throw new Error(
      getErrorMessage(body, "Không thể tra cứu thông tin doanh nghiệp.")
    )
  }

  const companyInfo = normalizeCompanyInfoResponse(body)

  if (!companyInfo) {
    throw new Error(
      getErrorMessage(body, "Không tìm thấy thông tin doanh nghiệp.")
    )
  }

  return companyInfo
}
