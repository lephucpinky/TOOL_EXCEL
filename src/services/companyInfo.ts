import { APIGetMInvoiceReceiptPostCompanyInfo } from "./mInvoiceReceipt"

export type CompanyInfo = {
  ma_so_thue: string
  ten_cty: string
  dia_chi: string
}

type ApiErrorBody = {
  message?: string
  error?: string
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object"
}

function getErrorMessage(body: unknown, fallback: string) {
  if (!isRecord(body)) return fallback

  const errorBody = body as ApiErrorBody
  return errorBody.message || errorBody.error || fallback
}

function hasCompanyInfoFields(content: Record<string, unknown>) {
  return [
    "ma_so_thue",
    "ten_cty",
    "dia_chi",
    "taxCode",
    "tax_code",
    "company_name",
    "companyName",
    "address",
  ].some((key) => content[key] !== undefined && content[key] !== null)
}

function getResponseContent(response: unknown) {
  let content = response

  for (let index = 0; index < 5; index += 1) {
    if (!isRecord(content)) return content

    if (hasCompanyInfoFields(content)) return content

    const nextContent = content.content ?? content.data ?? content.result

    if (nextContent === undefined || nextContent === content) {
      return content
    }

    content = nextContent
  }

  return content
}

function getTrimmedString(
  content: Record<string, unknown>,
  keys: string[]
): string {
  for (const key of keys) {
    const value = content[key]

    if (value !== undefined && value !== null) {
      const text = String(value).trim()

      if (text) return text
    }
  }

  return ""
}

function getAxiosErrorBody(error: unknown) {
  if (!isRecord(error)) return null

  const response = error.response

  if (!isRecord(response)) return null

  return response.data
}

export function normalizeCompanyInfoResponse(
  response: unknown
): CompanyInfo | null {
  const content = getResponseContent(response)

  if (!isRecord(content)) return null

  const ma_so_thue = getTrimmedString(content, [
    "ma_so_thue",
    "taxCode",
    "tax_code",
    "inv_buyerTaxCode",
  ])
  const ten_cty = getTrimmedString(content, [
    "ten_cty",
    "company_name",
    "companyName",
    "inv_buyerLegalName",
    "inv_buyerDisplayName",
  ])
  const dia_chi = getTrimmedString(content, [
    "dia_chi",
    "address",
    "inv_buyerAddressLine",
  ])

  if (!ma_so_thue || !ten_cty || !dia_chi) return null

  return {
    ma_so_thue,
    ten_cty,
    dia_chi,
  }
}

export async function APIGetCompanyInfo(taxCode: string) {
  try {
    const body = await APIGetMInvoiceReceiptPostCompanyInfo(taxCode)
    const companyInfo = normalizeCompanyInfoResponse(body)

    if (!companyInfo) {
      throw new Error(
        getErrorMessage(body, "Không tìm thấy thông tin doanh nghiệp.")
      )
    }

    return companyInfo
  } catch (error) {
    const errorBody = getAxiosErrorBody(error)

    if (errorBody) {
      throw new Error(
        getErrorMessage(
          errorBody,
          "Không thể tra cứu thông tin doanh nghiệp."
        )
      )
    }

    if (error instanceof Error) {
      throw error
    }

    throw new Error("Không thể tra cứu thông tin doanh nghiệp.")
  }
}
