"use client"

import { useEffect, useState } from "react"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"

import { cn } from "@/lib/utils"

interface PaginationProps {
  currentPage: number
  setCurrentPage: (page: number) => void
  totalItem: number
  itemPerPage: number
  setItemPerPage?: (pageSize: number) => void
  pageSizeOptions?: number[]
  syncUrl?: boolean
  className?: string
}

const DEFAULT_PAGE_SIZE_OPTIONS = [10, 50, 100, 200, 300]

export default function Pagination({
  currentPage,
  setCurrentPage,
  totalItem,
  itemPerPage,
  setItemPerPage,
  pageSizeOptions = DEFAULT_PAGE_SIZE_OPTIONS,
  syncUrl = false,
  className,
}: PaginationProps) {
  const router = useRouter()
  const pathName = usePathname()
  const searchParams = useSearchParams()
  const totalPages = Math.max(Math.ceil(totalItem / itemPerPage), 1)
  const safePage = Math.max(1, Math.min(currentPage, totalPages))
  const startItem = totalItem === 0 ? 0 : (safePage - 1) * itemPerPage + 1
  const endItem = Math.min(safePage * itemPerPage, totalItem)
  const [jumpPage, setJumpPage] = useState(String(safePage))

  useEffect(() => {
    setJumpPage(String(safePage))
  }, [safePage])

  const updateUrl = (page: number, limit = itemPerPage) => {
    if (!syncUrl) return

    const params = new URLSearchParams(
      typeof window !== "undefined"
        ? window.location.search
        : searchParams.toString()
    )
    params.set("page", String(page))
    params.set("limit", String(limit))

    const nextQuery = params.toString()
    const currentQuery =
      typeof window !== "undefined"
        ? window.location.search.replace(/^\?/, "")
        : searchParams.toString()

    if (nextQuery === currentQuery) return

    router.push(`${pathName}?${nextQuery}`)
  }

  const handleChangePage = (page: number) => {
    const nextPage = Math.max(1, Math.min(page, totalPages))

    updateUrl(nextPage)
    setCurrentPage(nextPage)
  }

  const handlePageSizeChange = (value: string) => {
    const nextPageSize = Number(value) || itemPerPage

    setItemPerPage?.(nextPageSize)
    updateUrl(1, nextPageSize)
    setCurrentPage(1)
  }

  const commitJumpPage = () => {
    const nextPage = Number(jumpPage)

    if (!Number.isFinite(nextPage)) {
      setJumpPage(String(safePage))
      return
    }

    handleChangePage(nextPage)
  }

  const pages = (() => {
    const result: Array<number | string> = [1]
    const startPage = Math.max(2, safePage - 1)
    const endPage = Math.min(totalPages - 1, safePage + 1)

    if (startPage > 2) {
      result.push("left-ellipsis")
    }

    for (let page = startPage; page <= endPage; page += 1) {
      result.push(page)
    }

    if (endPage < totalPages - 1) {
      result.push("right-ellipsis")
    }

    if (totalPages > 1) {
      result.push(totalPages)
    }

    return result
  })()

  return (
    <div
      className={cn(
        "grid w-full grid-cols-1 items-center gap-3 border-t border-slate-200 bg-white py-4 text-sm text-slate-950 lg:grid-cols-[minmax(160px,1fr)_auto_minmax(220px,1fr)]",
        className
      )}
    >
      <div className="flex items-center gap-3">
        <span className="font-medium">Số dòng:</span>
        <select
          value={itemPerPage}
          onChange={(event) => handlePageSizeChange(event.target.value)}
          className="h-10 w-[80px] rounded-lg border border-slate-200 bg-white px-4 text-sm shadow-sm outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
        >
          {pageSizeOptions.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-wrap items-center justify-center gap-5">
        <span>
          Hiển thị{" "}
          <strong>
            {startItem} - {endItem}
          </strong>{" "}
          trong tổng số <strong>{totalItem}</strong>
        </span>

        <label className="flex items-center gap-3">
          <span>Đến trang:</span>
          <input
            value={jumpPage}
            inputMode="numeric"
            onChange={(event) => setJumpPage(event.target.value)}
            onBlur={commitJumpPage}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.currentTarget.blur()
              }
            }}
            className="h-10 w-20 rounded-lg border border-slate-200 bg-white text-center text-sm shadow-sm outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
          />
          <span>/ {totalPages}</span>
        </label>
      </div>

      <div className="flex flex-wrap items-center justify-start gap-1 lg:justify-end">
        <button
          type="button"
          disabled={safePage <= 1}
          onClick={() => handleChangePage(safePage - 1)}
          className="inline-flex h-9 w-9 items-center justify-center rounded-md text-slate-950 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40"
          aria-label="Trang trước"
        >
          <ChevronLeft size={20} />
        </button>

        {pages.map((page) =>
          typeof page === "number" ? (
            <button
              key={page}
              type="button"
              onClick={() => handleChangePage(page)}
              className={cn(
                "inline-flex h-9 min-w-9 items-center justify-center rounded-md px-2 text-sm font-medium transition hover:bg-slate-100",
                page === safePage &&
                  "border border-blue-300 bg-blue-50 text-blue-700 hover:bg-blue-50"
              )}
            >
              {page}
            </button>
          ) : (
            <span
              key={page}
              className="inline-flex h-9 min-w-9 items-center justify-center px-1"
            >
              ...
            </span>
          )
        )}

        <button
          type="button"
          disabled={safePage >= totalPages}
          onClick={() => handleChangePage(safePage + 1)}
          className="inline-flex h-9 w-9 items-center justify-center rounded-md text-slate-950 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40"
          aria-label="Trang sau"
        >
          <ChevronRight size={20} />
        </button>
      </div>
    </div>
  )
}
