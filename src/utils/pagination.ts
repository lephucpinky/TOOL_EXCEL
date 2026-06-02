type PageResponse<T> = {
  data?: T | T[] | null
  page?: number
  totalPages?: number
}

type FetchAllPagesOptions<T> = {
  pageSize?: number
  maxPages?: number
  getKey?: (item: T) => string
}

function normalizePageItems<T>(value: unknown): T[] {
  if (Array.isArray(value)) return value as T[]
  if (!value || typeof value !== "object") return []

  const candidate = value as Record<string, unknown>

  if (Array.isArray(candidate.items)) return candidate.items as T[]
  if (Array.isArray(candidate.docs)) return candidate.docs as T[]
  if (Array.isArray(candidate.results)) return candidate.results as T[]
  if (Array.isArray(candidate.data)) return candidate.data as T[]

  return [value as T]
}

function getDefaultItemKey(item: unknown) {
  if (item && typeof item === "object") {
    const candidate = item as Record<string, unknown>
    const id = candidate._id ?? candidate.id

    if (id !== undefined && id !== null && String(id).trim()) {
      return String(id)
    }
  }

  return JSON.stringify(item)
}

export async function fetchAllPages<
  T,
  TParams extends Record<string, unknown> = Record<string, unknown>,
>(
  fetchPage: (params?: any) => Promise<PageResponse<T>>,
  params?: TParams,
  options?: FetchAllPagesOptions<T>
) {
  const pageSize = options?.pageSize ?? 250
  const maxPages = options?.maxPages ?? 1000
  const getKey = options?.getKey ?? getDefaultItemKey
  const seenKeys = new Set<string>()
  const items: T[] = []

  for (let page = 1; page <= maxPages; page += 1) {
    const response = await fetchPage({
      ...(params || ({} as TParams)),
      page,
      limit: pageSize,
    } as TParams)
    const pageItems = normalizePageItems<T>(response?.data)

    if (!pageItems.length) return items

    let addedCount = 0

    pageItems.forEach((item) => {
      const key = getKey(item)

      if (seenKeys.has(key)) return

      seenKeys.add(key)
      items.push(item)
      addedCount += 1
    })

    if (!addedCount) return items

    const totalPages = Number(response?.totalPages)

    if (Number.isFinite(totalPages) && totalPages > 0 && page >= totalPages) {
      return items
    }
  }

  throw new Error("Danh sach vuot qua gioi han phan trang an toan.")
}
