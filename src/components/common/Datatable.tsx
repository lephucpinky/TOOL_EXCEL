"use client"

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type MouseEvent,
  type ReactNode,
  type WheelEvent,
} from "react"
import { Download, Eye, Loader2, Pencil, Plus, Trash2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { cn } from "@/lib/utils"

import SkeletonTable from "../skeleton/SkeletonTable"
import Pagination from "../pagination/Pagination"

export interface DataTableColumn<T> {
  key: string
  title: React.ReactNode
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

export interface DataTableProps<T> {
  data: T[]
  columns: DataTableColumn<T>[]
  loading?: boolean
  emptyText?: string
  getRowKey?: (item: T, index: number) => string
  onView?: (item: T) => void
  onEdit?: (item: T) => void
  canEdit?: (item: T) => boolean
  onDelete?: (item: T) => void
  renderActions?: (row: T) => ReactNode
  pagination?: DataTablePagination
  titleTable?: string
  totalItems?: number
  currentPage?: number
  setCurrentPage?: (page: number) => void
  itemsPerPage?: number
  setItemsPerPage?: (page: number) => void
  onClickAddNew?: () => void
  children?: ReactNode
  openValue?: boolean
  onClickOpenFilter?: () => void
  filter?: boolean
  type?: string
  onExportExcel?: () => void
  isExportLoading?: boolean
  showExportButton?: boolean
}

function getDefaultRowKey<T>(item: T, index: number) {
  const row = item as Record<string, unknown>
  const id = row.id ?? row._id

  return id === undefined || id === null ? String(index) : String(id)
}

export function DataTable<T>({
  data,
  columns,
  loading = false,
  emptyText = "Không có dữ liệu",
  getRowKey,
  onView,
  onEdit,
  canEdit,
  onDelete,
  renderActions,
  pagination = false,
  titleTable,
  totalItems,
  currentPage,
  setCurrentPage,
  itemsPerPage,
  setItemsPerPage,
  onClickAddNew,
  children,
  onExportExcel,
  isExportLoading = false,
  showExportButton = false,
}: DataTableProps<T>) {
  const hasActions = Boolean(onView || onEdit || onDelete || renderActions)
  const hasToolbar = Boolean(
    titleTable || children || onClickAddNew || showExportButton
  )
  const firstColWidth = "w-[126px] min-w-[126px] max-w-[126px]"
  const actionColWidth = "w-[180px] min-w-[180px] max-w-[180px]"
  const stickyCoverBase =
    "overflow-visible before:pointer-events-none before:absolute before:inset-y-0 before:z-0 before:bg-inherit before:content-['']"
  const leftStickyCover = "overflow-hidden"
  const rightStickyCover = cn(stickyCoverBase, "before:-left-6 before:-right-3")

  const isPaginationEnabled = Boolean(pagination || currentPage)
  const isExternalPagination = currentPage !== undefined

  const initialPageSize =
    itemsPerPage ??
    (pagination && pagination !== true
      ? (pagination.initialPageSize ?? 10)
      : 10)
  const pageSizeOptions = useMemo(() => {
    if (
      pagination &&
      pagination !== true &&
      pagination.pageSizeOptions?.length
    ) {
      return pagination.pageSizeOptions
    }

    return [10, 50, 100, 200, 300]
  }, [
    pagination,
    pagination && pagination !== true
      ? pagination.pageSizeOptions?.join(",")
      : "10,50,100,200,300",
  ])

  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(initialPageSize)

  useEffect(() => {
    if (!isPaginationEnabled || itemsPerPage !== undefined) return

    setPageSize((previousPageSize) => {
      if (pageSizeOptions.includes(previousPageSize)) {
        return previousPageSize
      }

      return initialPageSize
    })
  }, [initialPageSize, isPaginationEnabled, itemsPerPage, pageSizeOptions])

  const effectivePage = currentPage ?? page
  const effectivePageSize = itemsPerPage ?? pageSize
  const totalRows = totalItems ?? data.length
  const totalPages = isPaginationEnabled
    ? Math.max(Math.ceil(totalRows / effectivePageSize), 1)
    : 1
  const safePage = Math.max(1, Math.min(effectivePage, totalPages))
  const startIndex = isPaginationEnabled
    ? (safePage - 1) * effectivePageSize
    : 0
  const visibleRows =
    isPaginationEnabled && !isExternalPagination
      ? data.slice(startIndex, startIndex + effectivePageSize)
      : data

  const tableScrollRef = useRef<HTMLDivElement | null>(null)
  const isTableDraggingRef = useRef(false)
  const dragStartXRef = useRef(0)
  const dragStartScrollLeftRef = useRef(0)
  const dragMovedRef = useRef(false)

  const isInteractiveTarget = (target: EventTarget | null) => {
    if (!(target instanceof HTMLElement)) return false

    return Boolean(
      target.closest("button,a,input,select,textarea,[role='button']")
    )
  }

  const stopTableDrag = () => {
    isTableDraggingRef.current = false

    tableScrollRef.current?.classList.remove("cursor-grabbing", "select-none")
  }

  const handleTableMouseDown = (event: MouseEvent<HTMLDivElement>) => {
    if (event.button !== 0) return
    if (isInteractiveTarget(event.target)) return

    const scrollElement = tableScrollRef.current
    if (!scrollElement) return

    isTableDraggingRef.current = true
    dragMovedRef.current = false
    dragStartXRef.current = event.clientX
    dragStartScrollLeftRef.current = scrollElement.scrollLeft

    scrollElement.classList.add("cursor-grabbing", "select-none")
  }

  const handleTableMouseMove = (event: MouseEvent<HTMLDivElement>) => {
    if (!isTableDraggingRef.current) return

    const scrollElement = tableScrollRef.current
    if (!scrollElement) return

    const distance = event.clientX - dragStartXRef.current

    if (Math.abs(distance) > 4) {
      dragMovedRef.current = true
    }

    scrollElement.scrollLeft = dragStartScrollLeftRef.current - distance
    event.preventDefault()
  }

  const handleTableClickCapture = (event: MouseEvent<HTMLDivElement>) => {
    if (!dragMovedRef.current) return

    event.preventDefault()
    event.stopPropagation()

    dragMovedRef.current = false
  }

  const handleTableWheel = (event: WheelEvent<HTMLDivElement>) => {
    if (!event.shiftKey) return
    if (!tableScrollRef.current) return

    tableScrollRef.current.scrollLeft += event.deltaY
  }
  useEffect(() => {
    if (isExternalPagination) return

    if (page > totalPages) {
      setPage(totalPages)
    }
  }, [isExternalPagination, page, totalPages])

  const setSafePage = (nextPage: number) => {
    const pageNumber = Math.max(1, Math.min(nextPage, totalPages))

    if (setCurrentPage) {
      setCurrentPage(pageNumber)
      return
    }

    setPage(pageNumber)
  }

  const handleItemsPerPageChange = (nextPageSize: number) => {
    if (setItemsPerPage) {
      setItemsPerPage(nextPageSize)
    } else {
      setPageSize(nextPageSize)
    }

    if (setCurrentPage) {
      setCurrentPage(1)
    } else {
      setPage(1)
    }
  }

  return (
    <div className="relative flex w-full flex-col gap-4 rounded-md border border-slate-200 bg-white p-2 font-sans sm:p-4">
      {hasToolbar && (
        <div className="flex w-full flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="flex min-w-0 items-center gap-4">
            {titleTable && (
              <h3 className="truncate text-base font-bold text-slate-900">
                {titleTable}
              </h3>
            )}
          </div>

          <div className="flex flex-wrap items-center justify-end gap-3">
            {children}

            {onClickAddNew && (
              <Button
                type="button"
                className="flex items-center gap-2 bg-blue-600 text-white hover:bg-blue-700"
                onClick={onClickAddNew}
              >
                <Plus className="h-4 w-4" />
                <span>Thêm mới</span>
              </Button>
            )}

            {showExportButton && (
              <Button
                type="button"
                className="flex items-center gap-2 border border-emerald-600 bg-white text-emerald-700 hover:bg-emerald-600 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
                onClick={onExportExcel}
                disabled={isExportLoading || data.length === 0}
              >
                {isExportLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Đang xuất...</span>
                  </>
                ) : (
                  <>
                    <Download className="h-4 w-4" />
                    <span>Xuất Excel</span>
                  </>
                )}
              </Button>
            )}
          </div>
        </div>
      )}

      {loading ? (
        <SkeletonTable />
      ) : (
        <div className="rounded-md">
          <div
            ref={tableScrollRef}
            onMouseDown={handleTableMouseDown}
            onMouseMove={handleTableMouseMove}
            onMouseUp={stopTableDrag}
            onMouseLeave={stopTableDrag}
            onClickCapture={handleTableClickCapture}
            onWheel={handleTableWheel}
            className={cn(
              "relative isolate max-h-[600px] cursor-grab overflow-auto rounded-md",
              "overscroll-contain scroll-smooth",
              "[scrollbar-width:thin]",
              "[scrollbar-color:#cbd5e1_transparent]",
              "[&::-webkit-scrollbar]:h-2",
              "[&::-webkit-scrollbar]:w-2",
              "[&::-webkit-scrollbar-track]:bg-transparent",
              "[&::-webkit-scrollbar-thumb]:rounded-full",
              "[&::-webkit-scrollbar-thumb]:bg-slate-300",
              "[&::-webkit-scrollbar-thumb:hover]:bg-slate-400"
            )}
          >
            <table className="relative w-full min-w-[860px] caption-bottom border-separate border-spacing-0 text-sm shadow-2xl">
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  {columns.map((column, index) => {
                    const isFirstColumn = index === 0
                    const isLastDataColumn = index === columns.length - 1

                    return (
                      <TableHead
                        key={column.key}
                        className={cn(
                          "sticky top-0 z-20 h-10 bg-[#2869B4] px-3 text-center font-semibold text-white",
                          isFirstColumn && leftStickyCover,
                          isFirstColumn && firstColWidth,
                          isFirstColumn && "left-0 z-30",
                          !hasActions && isLastDataColumn && rightStickyCover,
                          !hasActions && isLastDataColumn && "right-0 z-50",
                          column.headerClassName
                        )}
                      >
                        <span className="relative z-10">{column.title}</span>
                      </TableHead>
                    )
                  })}

                  {hasActions && (
                    <TableHead
                      className={cn(
                        rightStickyCover,
                        "sticky right-0 top-0 z-[80] h-10 bg-[#2869B4] px-3 text-center font-semibold text-white",
                        actionColWidth
                      )}
                    >
                      <div className="relative z-10">Thao tác</div>
                    </TableHead>
                  )}
                </TableRow>
              </TableHeader>

              <TableBody>
                {visibleRows.length > 0 ? (
                  visibleRows.map((item, index) => {
                    const rowIndex = isExternalPagination
                      ? startIndex + index
                      : isPaginationEnabled
                        ? startIndex + index
                        : index
                    const rowBg =
                      rowIndex % 2 === 0
                        ? "bg-white group-hover:bg-blue-50"
                        : "bg-slate-50/60 group-hover:bg-blue-50"

                    return (
                      <TableRow
                        className="group text-center"
                        key={
                          getRowKey?.(item, rowIndex) ??
                          getDefaultRowKey(item, rowIndex)
                        }
                      >
                        {columns.map((column, columnIndex) => {
                          const isFirstColumn = columnIndex === 0
                          const isLastDataColumn =
                            columnIndex === columns.length - 1

                          return (
                            <TableCell
                              key={column.key}
                              className={cn(
                                "border-b border-slate-100 px-3 py-3 align-middle text-slate-700 transition-colors",
                                rowBg,
                                isFirstColumn && leftStickyCover,
                                isFirstColumn && firstColWidth,
                                isFirstColumn &&
                                  "sticky left-0 z-20 font-medium text-slate-800",
                                !hasActions &&
                                  isLastDataColumn &&
                                  rightStickyCover,
                                !hasActions &&
                                  isLastDataColumn &&
                                  "sticky right-0 z-40",
                                column.className
                              )}
                            >
                              {isFirstColumn ||
                              (!hasActions && isLastDataColumn) ? (
                                <div className="relative z-10">
                                  {column.render
                                    ? column.render(item, rowIndex)
                                    : String(
                                        (item as Record<string, unknown>)[
                                          column.key
                                        ] ?? ""
                                      )}
                                </div>
                              ) : column.render ? (
                                column.render(item, rowIndex)
                              ) : (
                                String(
                                  (item as Record<string, unknown>)[
                                    column.key
                                  ] ?? ""
                                )
                              )}
                            </TableCell>
                          )
                        })}

                        {hasActions && (
                          <TableCell
                            className={cn(
                              rightStickyCover,
                              "sticky right-0 z-[60] border-b border-slate-100 px-3 py-2 transition-colors",
                              rowIndex % 2 === 0
                                ? "bg-white group-hover:bg-blue-50"
                                : "bg-slate-50 group-hover:bg-blue-50",
                              actionColWidth
                            )}
                          >
                            <div className="relative z-10 flex items-center justify-center gap-2 whitespace-nowrap">
                              {onView && (
                                <button
                                  type="button"
                                  onClick={(event) => {
                                    event.stopPropagation()
                                    onView(item)
                                  }}
                                  title="Xem"
                                  className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-600 shadow-sm transition hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700"
                                >
                                  <Eye size={15} />
                                </button>
                              )}

                              {renderActions?.(item)}

                              {onEdit && (!canEdit || canEdit(item)) && (
                                <button
                                  type="button"
                                  onClick={(event) => {
                                    event.stopPropagation()
                                    onEdit(item)
                                  }}
                                  title="Sửa"
                                  className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-blue-200 bg-blue-50 text-blue-600 shadow-sm transition hover:border-blue-400 hover:bg-blue-100 hover:text-blue-700"
                                >
                                  <Pencil size={15} />
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
                                  className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-red-200 bg-red-50 text-red-600 shadow-sm transition hover:border-red-400 hover:bg-red-100 hover:text-red-700"
                                >
                                  <Trash2 size={15} />
                                </button>
                              )}
                            </div>
                          </TableCell>
                        )}
                      </TableRow>
                    )
                  })
                ) : (
                  <TableRow>
                    <TableCell
                      colSpan={columns.length + (hasActions ? 1 : 0)}
                      className="h-24 text-center text-sm font-medium text-slate-500"
                    >
                      {emptyText}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </table>
          </div>
        </div>
      )}

      {isPaginationEnabled && (
        <Pagination
          currentPage={safePage}
          setCurrentPage={setSafePage}
          totalItem={totalRows}
          itemPerPage={effectivePageSize}
          setItemPerPage={handleItemsPerPageChange}
          pageSizeOptions={pageSizeOptions}
        />
      )}
    </div>
  )
}

export default DataTable
