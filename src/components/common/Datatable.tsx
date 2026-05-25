"use client"

import { useEffect, useMemo, useState, type ReactNode } from "react"
import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Eye,
  Inbox,
  Loader2,
  Pencil,
  Trash2,
} from "lucide-react"

export interface DataTableColumn<T> {
  key: string
  title: string
  render?: (item: T, index: number) => ReactNode
  className?: string
  headerClassName?: string
}

type DataTablePagination =
  | boolean
  | {
      initialPageSize?: number
      pageSizeOptions?: number[]
      itemLabel?: string
    }

interface DataTableProps<T> {
  data: T[]
  columns: DataTableColumn<T>[]
  loading?: boolean
  emptyText?: string
  getRowKey: (item: T, index: number) => string
  onView?: (item: T) => void
  onEdit?: (item: T) => void
  onDelete?: (item: T) => void
  renderActions?: (row: T) => ReactNode
  pagination?: DataTablePagination
}

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ")
}

function buildPaginationItems(currentPage: number, totalPages: number) {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, index) => index + 1)
  }

  const items: Array<number | string> = [1]
  const startPage = Math.max(2, currentPage - 1)
  const endPage = Math.min(totalPages - 1, currentPage + 1)

  if (startPage > 2) {
    items.push("left-ellipsis")
  }

  for (let page = startPage; page <= endPage; page += 1) {
    items.push(page)
  }

  if (endPage < totalPages - 1) {
    items.push("right-ellipsis")
  }

  items.push(totalPages)

  return items
}

export default function DataTable<T>({
  data,
  columns,
  loading = false,
  emptyText = "Chưa có dữ liệu",
  getRowKey,
  onView,
  onEdit,
  onDelete,
  renderActions,
  pagination = false,
}: DataTableProps<T>) {
  const hasActions = Boolean(onView || onEdit || onDelete || renderActions)
  const colSpan = columns.length + (hasActions ? 1 : 0)
  const actionColWidth = "w-[168px] min-w-[168px]"

  const isPaginationEnabled = Boolean(pagination)
  const initialPageSize =
    pagination && pagination !== true ? (pagination.initialPageSize ?? 10) : 10
  const itemLabel =
    pagination && pagination !== true ? pagination.itemLabel || "dòng" : "dòng"
  const pageSizeOptions = useMemo(() => {
    if (
      pagination &&
      pagination !== true &&
      pagination.pageSizeOptions?.length
    ) {
      return pagination.pageSizeOptions
    }

    return [10, 20, 50]
  }, [
    pagination,
    pagination && pagination !== true
      ? pagination.pageSizeOptions?.join(",")
      : "10,20,50",
  ])

  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(initialPageSize)

  useEffect(() => {
    if (!isPaginationEnabled) return

    setPageSize((previousPageSize) => {
      if (pageSizeOptions.includes(previousPageSize)) {
        return previousPageSize
      }

      return initialPageSize
    })
  }, [initialPageSize, isPaginationEnabled, pageSizeOptions])

  const totalRows = data.length
  const totalPages = isPaginationEnabled
    ? Math.max(Math.ceil(totalRows / pageSize), 1)
    : 1
  const safePage = Math.max(1, Math.min(page, totalPages))
  const startIndex = isPaginationEnabled ? (safePage - 1) * pageSize : 0
  const visibleRows = isPaginationEnabled
    ? data.slice(startIndex, startIndex + pageSize)
    : data
  const paginationItems = isPaginationEnabled
    ? buildPaginationItems(safePage, totalPages)
    : []

  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages)
    }
  }, [page, totalPages])

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_14px_35px_rgba(15,23,42,0.08)]">
      <div className="w-full overflow-x-auto">
        <table className="w-full min-w-[860px] border-separate border-spacing-0 text-sm">
          <thead>
            <tr className="bg-slate-50">
              {columns.map((column, index) => (
                <th
                  key={column.key}
                  className={cn(
                    "border-b border-slate-200 px-5 py-4 text-left text-[11px] font-bold uppercase tracking-[0.08em] text-slate-500",
                    index === 0 && "pl-6",
                    column.headerClassName
                  )}
                >
                  {column.title}
                </th>
              ))}

              {hasActions && (
                <th
                  className={cn(
                    "sticky right-0 z-30 border-b border-slate-200 bg-slate-50 px-3 py-4 text-center text-[11px] font-bold uppercase tracking-[0.08em] text-slate-500 shadow-[-12px_0_18px_-18px_rgba(15,23,42,0.75)]",
                    actionColWidth
                  )}
                >
                  Thao tác
                </th>
              )}
            </tr>
          </thead>

          <tbody>
            {loading ? (
              <tr>
                <td colSpan={colSpan} className="px-6 py-14">
                  <div className="flex flex-col items-center justify-center text-center">
                    <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-blue-50 text-blue-600">
                      <Loader2 size={22} className="animate-spin" />
                    </div>

                    <p className="text-sm font-semibold text-slate-700">
                      Đang tải dữ liệu
                    </p>

                    <p className="mt-1 text-xs text-slate-500">
                      Vui lòng chờ trong giây lát...
                    </p>
                  </div>
                </td>
              </tr>
            ) : visibleRows.length ? (
              visibleRows.map((item, index) => {
                const rowIndex = startIndex + index
                const rowBg =
                  rowIndex % 2 === 0
                    ? "bg-white group-hover:bg-blue-50"
                    : "bg-slate-50/50 group-hover:bg-blue-50"

                return (
                  <tr
                    key={getRowKey(item, rowIndex)}
                    className="group transition-colors duration-150"
                  >
                    {columns.map((column, columnIndex) => (
                      <td
                        key={column.key}
                        className={cn(
                          "border-b border-slate-100 px-5 py-4 align-middle text-slate-700 transition-colors",
                          "max-w-[260px] overflow-hidden truncate whitespace-nowrap",
                          rowBg,
                          columnIndex === 0 &&
                            "pl-6 font-medium text-slate-800",
                          column.className
                        )}
                      >
                        {column.render
                          ? column.render(item, rowIndex)
                          : String(
                              (item as Record<string, unknown>)[column.key] ??
                                ""
                            )}
                      </td>
                    ))}

                    {hasActions && (
                      <td
                        className={cn(
                          "sticky right-0 z-30 border-b border-slate-100 px-3 py-3 shadow-[-12px_0_18px_-18px_rgba(15,23,42,0.75)] transition-colors",
                          actionColWidth,
                          rowIndex % 2 === 0 ? "bg-white" : "bg-slate-50"
                        )}
                      >
                        <div className="flex items-center justify-center gap-2 whitespace-nowrap">
                          {onView && (
                            <button
                              type="button"
                              onClick={(event) => {
                                event.stopPropagation()
                                onView(item)
                              }}
                              title="Xem"
                              className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 shadow-sm transition hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700"
                            >
                              <Eye size={16} />
                            </button>
                          )}

                          {renderActions?.(item)}

                          {onEdit && (
                            <button
                              type="button"
                              onClick={(event) => {
                                event.stopPropagation()
                                onEdit(item)
                              }}
                              title="Sửa"
                              className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-blue-200 bg-blue-50 text-blue-600 shadow-sm transition hover:border-blue-400 hover:bg-blue-100 hover:text-blue-700"
                            >
                              <Pencil size={16} />
                            </button>
                          )}

                          {onDelete && (
                            <button
                              type="button"
                              onClick={(event) => {
                                event.stopPropagation()
                                onDelete(item)
                              }}
                              title="Xóa"
                              className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-red-200 bg-red-50 text-red-600 shadow-sm transition hover:border-red-400 hover:bg-red-100 hover:text-red-700"
                            >
                              <Trash2 size={16} />
                            </button>
                          )}
                        </div>
                      </td>
                    )}
                  </tr>
                )
              })
            ) : (
              <tr>
                <td colSpan={colSpan} className="px-6 py-16">
                  <div className="flex flex-col items-center justify-center text-center">
                    <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-400">
                      <Inbox size={23} />
                    </div>

                    <p className="text-sm font-semibold text-slate-700">
                      Không có dữ liệu
                    </p>

                    <p className="mt-1 max-w-sm text-xs leading-5 text-slate-500">
                      {emptyText}
                    </p>
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {isPaginationEnabled && totalRows > 0 && (
        <div className="flex flex-col gap-3 border-t border-slate-200 bg-slate-50 px-4 py-3 md:flex-row md:items-center md:justify-between">
          <div className="flex flex-col gap-2 text-sm text-slate-600 md:flex-row md:items-center md:gap-4">
            <p>
              Hiển thị{" "}
              <span className="font-semibold text-slate-800">
                {startIndex + 1}
              </span>{" "}
              -{" "}
              <span className="font-semibold text-slate-800">
                {Math.min(startIndex + visibleRows.length, totalRows)}
              </span>{" "}
              /{" "}
              <span className="font-semibold text-slate-800">{totalRows}</span>{" "}
              {itemLabel}
            </p>

            <label className="flex items-center gap-2 text-sm text-slate-600">
              <span>Mỗi trang</span>
              <select
                value={pageSize}
                onChange={(event) => {
                  setPageSize(Number(event.target.value) || 10)
                  setPage(1)
                }}
                className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              >
                {pageSizeOptions.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="flex flex-wrap items-center justify-end gap-2">
            <span className="mr-1 text-sm text-slate-600">
              Trang{" "}
              <span className="font-semibold text-slate-800">{safePage}</span> /{" "}
              <span className="font-semibold text-slate-800">{totalPages}</span>
            </span>

            <button
              type="button"
              disabled={safePage <= 1}
              onClick={() => setPage(1)}
              className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <ChevronsLeft size={16} />
            </button>

            <button
              type="button"
              disabled={safePage <= 1}
              onClick={() =>
                setPage((previousPage) => Math.max(previousPage - 1, 1))
              }
              className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <ChevronLeft size={16} />
            </button>

            {paginationItems.map((item) =>
              typeof item === "number" ? (
                <button
                  key={item}
                  type="button"
                  onClick={() => setPage(item)}
                  className={cn(
                    "inline-flex h-9 min-w-9 items-center justify-center rounded-lg border px-3 text-sm font-semibold transition",
                    item === safePage
                      ? "border-blue-600 bg-blue-600 text-white"
                      : "border-slate-200 bg-white text-slate-700 hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700"
                  )}
                >
                  {item}
                </button>
              ) : (
                <span
                  key={item}
                  className="inline-flex h-9 min-w-9 items-center justify-center px-1 text-slate-400"
                >
                  ...
                </span>
              )
            )}

            <button
              type="button"
              disabled={safePage >= totalPages}
              onClick={() =>
                setPage((previousPage) =>
                  Math.min(previousPage + 1, totalPages)
                )
              }
              className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <ChevronRight size={16} />
            </button>

            <button
              type="button"
              disabled={safePage >= totalPages}
              onClick={() => setPage(totalPages)}
              className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <ChevronsRight size={16} />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
