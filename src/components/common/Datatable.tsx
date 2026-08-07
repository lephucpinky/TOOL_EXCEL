"use client"

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type MouseEvent,
  type PointerEvent,
  type ReactNode,
  type WheelEvent,
} from "react"
import { Download, Eye, FileSearch, Loader2, Pencil, Plus, Trash2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { cn } from "@/lib/utils"

import Pagination from "../pagination/Pagination"

const DEFAULT_PAGE_SIZE_OPTIONS = [10, 50, 100, 200, 300]

export interface DataTableColumn<T> {
  key: string
  title: React.ReactNode
  filter?: React.ReactNode
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
      syncUrl?: boolean
    }

export interface DataTableProps<T> {
  data: T[]
  columns: DataTableColumn<T>[]
  loading?: boolean
  emptyText?: string
  getRowKey?: (item: T, index: number) => string
  selectable?: boolean
  selectedRowKeys?: string[]
  onSelectedRowKeysChange?: (keys: string[]) => void
  isRowSelectable?: (item: T) => boolean
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

function SelectionCheckbox({
  checked,
  indeterminate = false,
  disabled = false,
  title,
  ariaLabel,
  onChange,
}: {
  checked: boolean
  indeterminate?: boolean
  disabled?: boolean
  title: string
  ariaLabel: string
  onChange: (checked: boolean) => void
}) {
  return (
    <input
      ref={(element) => {
        if (element) element.indeterminate = indeterminate
      }}
      type="checkbox"
      checked={checked}
      disabled={disabled}
      title={title}
      aria-label={ariaLabel}
      onChange={(event) => onChange(event.target.checked)}
      onClick={(event) => event.stopPropagation()}
      className="h-4 w-4 rounded border-slate-300 accent-blue-600 disabled:cursor-not-allowed disabled:opacity-50"
    />
  )
}

export function DataTable<T>({
  data,
  columns,
  loading = false,
  emptyText = "Không có dữ liệu",
  getRowKey,
  selectable = false,
  selectedRowKeys = [],
  onSelectedRowKeysChange,
  isRowSelectable,
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
  const hasSelection = Boolean(selectable && onSelectedRowKeysChange)
  const hasColumnFilters = columns.some((column) => Boolean(column.filter))
  const hasToolbar = Boolean(
    titleTable || children || onClickAddNew || showExportButton
  )
  const selectionColWidth = "w-[48px] min-w-[48px] max-w-[48px]"
  const firstColWidth = "w-[150px] min-w-[150px] max-w-[150px]"
  const firstDataColumnLeft = hasSelection ? "left-[48px]" : "left-0"
  const actionColWidth = "w-[260px] min-w-[260px] max-w-[260px]"
  const tableColSpan =
    columns.length + (hasSelection ? 1 : 0) + (hasActions ? 1 : 0)
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
  const pageSizeOptions =
    pagination && pagination !== true && pagination.pageSizeOptions?.length
      ? pagination.pageSizeOptions
      : DEFAULT_PAGE_SIZE_OPTIONS

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
  const getRenderRowIndex = (index: number) =>
    isPaginationEnabled ? startIndex + index : index
  const getResolvedRowKey = (item: T, index: number) =>
    getRowKey?.(item, index) ?? getDefaultRowKey(item, index)
  const selectedRowKeySet = useMemo(
    () => new Set(selectedRowKeys),
    [selectedRowKeys]
  )
  const selectableVisibleRowKeys = hasSelection
    ? visibleRows.flatMap((item, index) => {
        if (isRowSelectable && !isRowSelectable(item)) return []

        return [getResolvedRowKey(item, getRenderRowIndex(index))]
      })
    : []
  const allVisibleRowsSelected =
    selectableVisibleRowKeys.length > 0 &&
    selectableVisibleRowKeys.every((key) => selectedRowKeySet.has(key))
  const someVisibleRowsSelected = selectableVisibleRowKeys.some((key) =>
    selectedRowKeySet.has(key)
  )

  const handleToggleAllVisibleRows = (checked: boolean) => {
    if (!onSelectedRowKeysChange) return

    const nextSelectedKeys = new Set(selectedRowKeys)

    selectableVisibleRowKeys.forEach((key) => {
      if (checked) {
        nextSelectedKeys.add(key)
      } else {
        nextSelectedKeys.delete(key)
      }
    })

    onSelectedRowKeysChange(Array.from(nextSelectedKeys))
  }

  const handleToggleRow = (rowKey: string, checked: boolean) => {
    if (!onSelectedRowKeysChange) return

    const nextSelectedKeys = new Set(selectedRowKeys)

    if (checked) {
      nextSelectedKeys.add(rowKey)
    } else {
      nextSelectedKeys.delete(rowKey)
    }

    onSelectedRowKeysChange(Array.from(nextSelectedKeys))
  }

  const tableScrollRef = useRef<HTMLDivElement | null>(null)
  const isTableDragCandidateRef = useRef(false)
  const isTableDraggingRef = useRef(false)
  const dragStartXRef = useRef(0)
  const dragStartScrollLeftRef = useRef(0)
  const dragMovedRef = useRef(false)
  const dragPointerIdRef = useRef<number | null>(null)
  const pendingScrollLeftRef = useRef(0)
  const dragAnimationFrameRef = useRef<number | null>(null)

  const isInteractiveTarget = (target: EventTarget | null) => {
    if (!(target instanceof HTMLElement)) return false

    return Boolean(
      target.closest(
        "button,a,input,select,textarea,[role='button'],[data-table-copyable]"
      )
    )
  }

  const stopTableDrag = () => {
    const scrollElement = tableScrollRef.current

    if (
      isTableDraggingRef.current &&
      dragAnimationFrameRef.current !== null &&
      scrollElement
    ) {
      scrollElement.scrollLeft = pendingScrollLeftRef.current
    }

    isTableDragCandidateRef.current = false
    isTableDraggingRef.current = false
    dragPointerIdRef.current = null

    if (dragAnimationFrameRef.current !== null) {
      window.cancelAnimationFrame(dragAnimationFrameRef.current)
      dragAnimationFrameRef.current = null
    }

    tableScrollRef.current?.classList.remove("cursor-grabbing", "select-none")
  }

  const handleTablePointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return
    if (event.pointerType !== "mouse") return
    if (isInteractiveTarget(event.target)) return

    const scrollElement = tableScrollRef.current
    if (!scrollElement) return

    isTableDragCandidateRef.current = true
    isTableDraggingRef.current = false
    dragMovedRef.current = false
    dragPointerIdRef.current = event.pointerId
    dragStartXRef.current = event.clientX
    dragStartScrollLeftRef.current = scrollElement.scrollLeft
  }

  const handleTablePointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (!isTableDragCandidateRef.current) return
    if (event.pointerId !== dragPointerIdRef.current) return

    const scrollElement = tableScrollRef.current
    if (!scrollElement) return

    const distance = event.clientX - dragStartXRef.current

    if (!isTableDraggingRef.current) {
      if (Math.abs(distance) <= 6) return

      isTableDraggingRef.current = true
      dragMovedRef.current = true
      scrollElement.setPointerCapture(event.pointerId)
      scrollElement.classList.add("cursor-grabbing", "select-none")
    }

    pendingScrollLeftRef.current = dragStartScrollLeftRef.current - distance

    if (dragAnimationFrameRef.current === null) {
      dragAnimationFrameRef.current = window.requestAnimationFrame(() => {
        scrollElement.scrollLeft = pendingScrollLeftRef.current
        dragAnimationFrameRef.current = null
      })
    }

    event.preventDefault()
  }

  const handleTablePointerUp = (event: PointerEvent<HTMLDivElement>) => {
    const scrollElement = tableScrollRef.current

    if (scrollElement?.hasPointerCapture(event.pointerId)) {
      scrollElement.releasePointerCapture(event.pointerId)
    }

    stopTableDrag()

    window.setTimeout(() => {
      dragMovedRef.current = false
    }, 0)
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
    return () => {
      if (dragAnimationFrameRef.current !== null) {
        window.cancelAnimationFrame(dragAnimationFrameRef.current)
      }
    }
  }, [])
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

      <div className="rounded-md">
          <div
            ref={tableScrollRef}
            onPointerDown={handleTablePointerDown}
            onPointerMove={handleTablePointerMove}
            onPointerUp={handleTablePointerUp}
            onPointerCancel={handleTablePointerUp}
            onPointerLeave={() => {
              if (!isTableDraggingRef.current) stopTableDrag()
            }}
            onClickCapture={handleTableClickCapture}
            onWheel={handleTableWheel}
            className={cn(
              "relative isolate max-h-[600px] cursor-grab overflow-auto rounded-md",
              "overscroll-contain [&_[data-table-copyable]]:cursor-text [&_[data-table-copyable]]:select-text",
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
            <table className="relative w-max min-w-full caption-bottom border-separate border-spacing-0 text-sm shadow-2xl">
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  {hasSelection && (
                    <TableHead
                      className={cn(
                        leftStickyCover,
                        selectionColWidth,
                        "sticky left-0 top-0 z-40 h-10 bg-[#2869B4] px-3 text-center font-semibold text-white"
                      )}
                    >
                      <div className="relative z-10 flex items-center justify-center">
                        <SelectionCheckbox
                          checked={allVisibleRowsSelected}
                          indeterminate={
                            someVisibleRowsSelected && !allVisibleRowsSelected
                          }
                          disabled={
                            loading || selectableVisibleRowKeys.length === 0
                          }
                          title="Chọn tất cả dòng đang hiển thị"
                          ariaLabel="Chọn tất cả dòng đang hiển thị"
                          onChange={handleToggleAllVisibleRows}
                        />
                      </div>
                    </TableHead>
                  )}

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
                          isFirstColumn && firstDataColumnLeft,
                          isFirstColumn && "z-30",
                          !hasActions && isLastDataColumn && rightStickyCover,
                          !hasActions && isLastDataColumn && "right-0 z-50",
                          column.className,
                          column.headerClassName
                        )}
                      >
                        <span
                          data-table-copyable
                          className="relative z-10 select-text"
                        >
                          {column.title}
                        </span>
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

                {hasColumnFilters && (
                  <TableRow className="hover:bg-transparent">
                    {hasSelection && (
                      <TableHead
                        className={cn(
                          leftStickyCover,
                          selectionColWidth,
                          "sticky left-0 top-10 z-40 h-auto border-b border-slate-200 bg-slate-50 px-2 py-1"
                        )}
                      >
                        <div className="h-8" />
                      </TableHead>
                    )}

                    {columns.map((column, index) => {
                      const isFirstColumn = index === 0
                      const isLastDataColumn = index === columns.length - 1

                      return (
                        <TableHead
                          key={`${column.key}-filter`}
                          className={cn(
                            "sticky top-10 z-20 h-auto border-b border-slate-200 bg-slate-50 px-2 py-1 font-normal text-slate-700",
                            isFirstColumn && leftStickyCover,
                            isFirstColumn && firstColWidth,
                            isFirstColumn && firstDataColumnLeft,
                            isFirstColumn && "z-30",
                            !hasActions && isLastDataColumn && rightStickyCover,
                            !hasActions && isLastDataColumn && "right-0 z-50",
                            column.className
                          )}
                        >
                          <div className="relative z-10">
                            {column.filter ?? <div className="h-8" />}
                          </div>
                        </TableHead>
                      )
                    })}

                    {hasActions && (
                      <TableHead
                        className={cn(
                          rightStickyCover,
                          actionColWidth,
                          "sticky right-0 top-10 z-[80] h-auto border-b border-slate-200 bg-slate-50 px-2 py-1"
                        )}
                      >
                        <div className="h-8" />
                      </TableHead>
                    )}
                  </TableRow>
                )}
              </TableHeader>

              <TableBody>
                {(loading || visibleRows.length === 0) && (
                  <TableRow
                    aria-hidden
                    className="pointer-events-none h-0 hover:bg-transparent"
                  >
                    {hasSelection && (
                      <TableCell
                        className={cn(
                          selectionColWidth,
                          "h-0 border-0 p-0"
                        )}
                      />
                    )}
                    {columns.map((column, index) => (
                      <TableCell
                        key={`width-lock-${column.key}`}
                        className={cn(
                          "h-0 border-0 p-0",
                          index === 0 && firstColWidth,
                          column.className
                        )}
                      />
                    ))}
                    {hasActions && (
                      <TableCell
                        className={cn(actionColWidth, "h-0 border-0 p-0")}
                      />
                    )}
                  </TableRow>
                )}

                {loading ? (
                  <TableRow className="hover:bg-transparent">
                    <TableCell
                      colSpan={tableColSpan}
                      className="border-b border-slate-100 bg-gradient-to-b from-slate-50 to-white px-3 py-10"
                    >
                      <div className="flex flex-col items-center justify-center gap-3">
                        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-blue-50 text-blue-600 shadow-sm ring-1 ring-blue-100">
                          <Loader2 className="h-6 w-6 animate-spin" />
                        </div>
                        <div className="text-center">
                          <p className="text-sm font-semibold text-slate-700">
                            Đang tìm kiếm dữ liệu...
                          </p>
                          <p className="mt-1 text-xs text-slate-500">
                            Vui lòng chờ trong giây lát
                          </p>
                        </div>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : visibleRows.length > 0 ? (
                  visibleRows.map((item, index) => {
                    const rowIndex = getRenderRowIndex(index)
                    const rowKey = getResolvedRowKey(item, rowIndex)
                    const rowSelectable =
                      !isRowSelectable || isRowSelectable(item)
                    const rowBg =
                      rowIndex % 2 === 0
                        ? "bg-White group-hover:bg-blue-50"
                        : "bg-slate-50/60 group-hover:bg-blue-50"
                    const stickyRowBg =
                      rowIndex % 2 === 0
                        ? "bg-white group-hover:bg-blue-50"
                        : "bg-slate-50 group-hover:bg-blue-50"

                    return (
                      <TableRow className="group text-center" key={rowKey}>
                        {hasSelection && (
                          <TableCell
                            className={cn(
                              leftStickyCover,
                              selectionColWidth,
                              "sticky left-0 z-30 border-b border-slate-100 px-3 py-3 text-center align-middle transition-colors",
                              stickyRowBg
                            )}
                          >
                            <div className="relative z-10 flex items-center justify-center">
                              <SelectionCheckbox
                                checked={selectedRowKeySet.has(rowKey)}
                                disabled={!rowSelectable}
                                title={
                                  rowSelectable
                                    ? "Chọn dòng"
                                    : "Không thể chọn dòng này"
                                }
                                ariaLabel="Chọn dòng"
                                onChange={(checked) =>
                                  handleToggleRow(rowKey, checked)
                                }
                              />
                            </div>
                          </TableCell>
                        )}

                        {columns.map((column, columnIndex) => {
                          const isFirstColumn = columnIndex === 0
                          const isLastDataColumn =
                            columnIndex === columns.length - 1

                          return (
                            <TableCell
                              key={column.key}
                              className={cn(
                                "border-b border-slate-100 px-3 py-3 align-middle text-slate-700 transition-colors",
                                isFirstColumn ||
                                  (!hasActions && isLastDataColumn)
                                  ? stickyRowBg
                                  : rowBg,
                                isFirstColumn && leftStickyCover,
                                isFirstColumn && firstColWidth,
                                isFirstColumn && firstDataColumnLeft,
                                isFirstColumn &&
                                  "sticky z-20 font-medium text-slate-800",
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
                                <div
                                  data-table-copyable
                                  className="relative z-10 inline-block max-w-full select-text"
                                >
                                  {column.render
                                    ? column.render(item, rowIndex)
                                    : String(
                                        (item as Record<string, unknown>)[
                                          column.key
                                        ] ?? ""
                                      )}
                                </div>
                              ) : (
                                <div
                                  data-table-copyable
                                  className="inline-block max-w-full select-text"
                                >
                                  {column.render
                                    ? column.render(item, rowIndex)
                                    : String(
                                        (item as Record<string, unknown>)[
                                          column.key
                                        ] ?? ""
                                      )}
                                </div>
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
                            <div className="relative z-10 flex w-full items-center justify-center gap-2 whitespace-nowrap px-1 [&>div]:contents">
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
                  <TableRow className="hover:bg-transparent">
                    <TableCell
                      colSpan={tableColSpan}
                      className="border-b border-slate-100 bg-slate-50/40 px-3 py-10"
                    >
                      <div className="flex flex-col items-center justify-center gap-3">
                        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-400 ring-1 ring-slate-200">
                          <FileSearch className="h-6 w-6" />
                        </div>
                        <div className="text-center">
                          <p className="text-sm font-semibold text-slate-600">
                            {emptyText}
                          </p>
                          <p className="mt-1 text-xs text-slate-400">
                            Thử đổi từ khóa hoặc xóa bộ lọc để xem thêm kết quả
                          </p>
                        </div>
                      </div>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </table>
          </div>
        </div>

      {isPaginationEnabled && (
        <Pagination
          currentPage={safePage}
          setCurrentPage={setSafePage}
          totalItem={totalRows}
          itemPerPage={effectivePageSize}
          setItemPerPage={handleItemsPerPageChange}
          pageSizeOptions={pageSizeOptions}
          syncUrl={
            pagination && pagination !== true
              ? Boolean(pagination.syncUrl)
              : false
          }
        />
      )}
    </div>
  )
}

export default DataTable
