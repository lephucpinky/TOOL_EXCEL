"use client"

import type { ReactNode } from "react"
import { Eye, Inbox, Loader2, Pencil, Trash2 } from "lucide-react"

export interface DataTableColumn<T> {
  key: string
  title: string
  render?: (item: T, index: number) => ReactNode
  className?: string
  headerClassName?: string
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
}

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ")
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
}: DataTableProps<T>) {
  const hasActions = Boolean(onView || onEdit || onDelete || renderActions)
  const colSpan = columns.length + (hasActions ? 1 : 0)
  const ACTION_COL_WIDTH = "w-[168px] min-w-[168px]"
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
                    ACTION_COL_WIDTH
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
            ) : data.length ? (
              data.map((item, index) => {
                const rowBg =
                  index % 2 === 0
                    ? "bg-white group-hover:bg-blue-50"
                    : "bg-slate-50/50 group-hover:bg-blue-50"

                return (
                  <tr
                    key={getRowKey(item, index)}
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
                          ? column.render(item, index)
                          : String((item as any)[column.key] ?? "")}
                      </td>
                    ))}
                    {hasActions && (
                      <td
                        className={cn(
                          "sticky right-0 z-30 border-b border-slate-100 px-3 py-3 shadow-[-12px_0_18px_-18px_rgba(15,23,42,0.75)] transition-colors",
                          ACTION_COL_WIDTH,
                          index % 2 === 0 ? "bg-white" : "bg-slate-50"
                        )}
                      >
                        <div className="flex items-center justify-center gap-2 whitespace-nowrap">
                          {onView && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation()
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
                              onClick={(e) => {
                                e.stopPropagation()
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
                              onClick={(e) => {
                                e.stopPropagation()
                                onDelete(item)
                              }}
                              title="Xoá"
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
    </div>
  )
}
