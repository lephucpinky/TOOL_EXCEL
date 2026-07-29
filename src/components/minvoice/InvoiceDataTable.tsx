"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { createPortal } from "react-dom"
import {
  InvoiceApiRow,
  InvoicePaymentStatus,
  InvoiceStatus,
} from "@/types/invoice"
import DataTable, { DataTableColumn } from "../common/Datatable"
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Copy,
  FileText,
  HandCoins,
  Loader2,
  Printer,
  RefreshCw,
  SlidersHorizontal,
  X,
} from "lucide-react"
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  isValid,
  parseISO,
  startOfMonth,
  startOfWeek,
  subMonths,
} from "date-fns"
import { vi } from "date-fns/locale"
import { AnimatePresence, motion } from "framer-motion"
import Pagination from "../pagination/Pagination"
import * as invoiceHelper from "@/utils/invoice"
import { cn } from "@/lib/utils"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import InvoiceFilterSelect from "./InvoiceFilterSelect"
import { ToolbarButton } from "./InvoiceToolbar"
type Props = {
  rows: InvoiceApiRow[]
  loading?: boolean
  onEdit?: (row: InvoiceApiRow) => void
  onView?: (row: InvoiceApiRow) => void
  onExportInvoice?: (row: InvoiceApiRow) => void | Promise<unknown>
  exportingInvoiceId?: string | null
  onUpdateMInvoice?: (row: InvoiceApiRow) => void | Promise<unknown>
  updatingMInvoiceId?: string | null
  onCopyInvoice?: (row: InvoiceApiRow) => void | Promise<unknown>
  onViewMInvoicePdf?: (row: InvoiceApiRow) => void
  onCollectPayment?: (row: InvoiceApiRow) => void
  selectedRowIds?: string[]
  onSelectedRowIdsChange?: (ids: string[]) => void
  bulkActionLoading?: boolean
  pagination?: {
    currentPage: number
    pageSize: number
    totalItems: number
    onPageChange: (page: number) => void
    onPageSizeChange: (pageSize: number) => void
    pageSizeOptions?: number[]
    syncUrl?: boolean
  }
}

type InvoiceProductValue =
  | NonNullable<InvoiceApiRow["items"]>[number]["productId"]
  | NonNullable<InvoiceApiRow["items"]>[number]["product"]

type InvoiceDatePickerProps = {
  id: string
  value: string
  onChange: (value: string) => void
}

const WEEKDAY_LABELS = ["T2", "T3", "T4", "T5", "T6", "T7", "CN"]

function InvoiceDatePicker({ id, value, onChange }: InvoiceDatePickerProps) {
  const [open, setOpen] = useState(false)
  const selectedDate = useMemo(() => {
    if (!value) return null

    const parsedDate = parseISO(value)
    return isValid(parsedDate) ? parsedDate : null
  }, [value])
  const [visibleMonth, setVisibleMonth] = useState(() =>
    startOfMonth(selectedDate || new Date())
  )
  const calendarDays = useMemo(() => {
    const monthStart = startOfMonth(visibleMonth)
    const monthEnd = endOfMonth(visibleMonth)

    return eachDayOfInterval({
      start: startOfWeek(monthStart, { weekStartsOn: 1 }),
      end: endOfWeek(monthEnd, { weekStartsOn: 1 }),
    })
  }, [visibleMonth])

  const handleOpenChange = (nextOpen: boolean) => {
    if (nextOpen) {
      setVisibleMonth(startOfMonth(selectedDate || new Date()))
    }

    setOpen(nextOpen)
  }

  const handleSelectDate = (date: Date) => {
    onChange(format(date, "yyyy-MM-dd"))
    setOpen(false)
  }

  const today = new Date()

  return (
    <Popover open={open} onOpenChange={handleOpenChange} modal={false}>
      <PopoverTrigger asChild>
        <button
          id={id}
          type="button"
          className={cn(
            "group flex h-11 w-full items-center justify-between rounded-lg border border-slate-200 bg-white px-3 text-left text-sm outline-none transition",
            "hover:border-blue-300 hover:bg-blue-50/40 focus:border-blue-500 focus:ring-2 focus:ring-blue-100",
            selectedDate ? "font-medium text-slate-800" : "text-slate-400"
          )}
        >
          <span>
            {selectedDate ? format(selectedDate, "dd/MM/yyyy") : "Chọn ngày"}
          </span>
          <span className="flex h-8 w-8 items-center justify-center rounded-md bg-slate-50 text-slate-500 transition group-hover:bg-white group-hover:text-blue-600">
            <CalendarDays size={17} />
          </span>
        </button>
      </PopoverTrigger>

      <PopoverContent
        data-invoice-filter-calendar
        align="start"
        sideOffset={6}
        className="z-[1000] w-[320px] overflow-hidden rounded-xl border-slate-200 bg-white p-0 shadow-[0_18px_45px_rgba(15,23,42,0.18)]"
      >
        <div className="bg-gradient-to-r flex items-center justify-between border-b border-blue-100 from-blue-50 to-indigo-50 px-4 py-3">
          <button
            type="button"
            onClick={() => setVisibleMonth((month) => subMonths(month, 1))}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-600 transition hover:bg-white hover:text-blue-700 hover:shadow-sm"
            aria-label="Tháng trước"
          >
            <ChevronLeft size={18} />
          </button>

          <span className="text-sm font-bold capitalize text-slate-800">
            {format(visibleMonth, "'Tháng' M, yyyy", { locale: vi })}
          </span>

          <button
            type="button"
            onClick={() => setVisibleMonth((month) => addMonths(month, 1))}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-600 transition hover:bg-white hover:text-blue-700 hover:shadow-sm"
            aria-label="Tháng sau"
          >
            <ChevronRight size={18} />
          </button>
        </div>

        <div className="p-3">
          <div className="mb-1 grid grid-cols-7">
            {WEEKDAY_LABELS.map((label) => (
              <span
                key={label}
                className="flex h-8 items-center justify-center text-xs font-semibold text-slate-400"
              >
                {label}
              </span>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-y-1">
            {calendarDays.map((date) => {
              const isSelected = Boolean(
                selectedDate && isSameDay(date, selectedDate)
              )
              const isToday = isSameDay(date, today)
              const isCurrentMonth = isSameMonth(date, visibleMonth)

              return (
                <button
                  key={format(date, "yyyy-MM-dd")}
                  type="button"
                  onClick={() => handleSelectDate(date)}
                  className={cn(
                    "mx-auto flex h-9 w-9 items-center justify-center rounded-lg text-sm transition",
                    isCurrentMonth
                      ? "text-slate-700 hover:bg-blue-50 hover:text-blue-700"
                      : "text-slate-300 hover:bg-slate-50",
                    isToday &&
                      !isSelected &&
                      "font-bold text-blue-700 ring-1 ring-inset ring-blue-200",
                    isSelected &&
                      "bg-blue-600 font-bold text-white shadow-md shadow-blue-200 hover:bg-blue-700 hover:text-white"
                  )}
                  aria-pressed={isSelected}
                  aria-label={format(date, "dd/MM/yyyy")}
                >
                  {format(date, "d")}
                </button>
              )
            })}
          </div>
        </div>

        <div className="flex items-center justify-between border-t border-slate-100 bg-slate-50/70 px-4 py-3">
          <button
            type="button"
            onClick={() => {
              onChange("")
              setOpen(false)
            }}
            disabled={!selectedDate}
            className="text-sm font-semibold text-slate-500 transition hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Xóa ngày
          </button>
          <button
            type="button"
            onClick={() => handleSelectDate(today)}
            className="rounded-lg bg-blue-50 px-3 py-1.5 text-sm font-semibold text-blue-700 transition hover:bg-blue-100"
          >
            Hôm nay
          </button>
        </div>
      </PopoverContent>
    </Popover>
  )
}

export default function InvoiceDataTable({
  rows,
  loading = false,
  onEdit,
  onView,
  onExportInvoice,
  exportingInvoiceId = null,
  onUpdateMInvoice,
  updatingMInvoiceId = null,
  onCopyInvoice,
  onViewMInvoicePdf,
  onCollectPayment,
  selectedRowIds = [],
  onSelectedRowIdsChange,
  bulkActionLoading = false,
  pagination,
}: Props) {
  const [keyword, setKeyword] = useState("")
  const [filterOpen, setFilterOpen] = useState(false)
  const [mounted, setMounted] = useState(false)
  const filterContainerRef = useRef<HTMLDivElement>(null)

  const [draftFromDate, setDraftFromDate] = useState("")
  const [draftToDate, setDraftToDate] = useState("")
  const [draftExportStatusFilter, setDraftExportStatusFilter] = useState("")
  const [draftOrderCreateFilter, setDraftOrderCreateFilter] = useState("")
  const [draftAgencyFilter, setDraftAgencyFilter] = useState("")

  const [fromDate, setFromDate] = useState("")
  const [toDate, setToDate] = useState("")
  const [exportStatusFilter, setExportStatusFilter] = useState("")
  const [orderCreateFilter, setOrderCreateFilter] = useState("")
  const [agencyFilter, setAgencyFilter] = useState("")
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const isExternalPagination = Boolean(pagination)
  const effectivePage = pagination?.currentPage ?? page
  const effectivePageSize = pagination?.pageSize ?? pageSize

  const invoiceStatusLabel = invoiceHelper.invoiceStatusLabel
  const invoiceStatusClass = invoiceHelper.invoiceStatusClass
  const getInvoiceStatus = invoiceHelper.getInvoiceStatus
  const canStartInvoiceExport = invoiceHelper.canStartInvoiceExport
  const getInvoiceStatusDisplayLabel = (invoice: InvoiceApiRow) => {
    return (
      String(invoice.invoiceStatusVi || "").trim() ||
      invoiceStatusLabel[getInvoiceStatus(invoice)]
    )
  }
  const getMInvoiceCreatedId = (invoice?: InvoiceApiRow | null) => {
    return String(invoice?.inv_invoiceCreatedId || "").trim()
  }

  const canViewMInvoicePdf = (invoice: InvoiceApiRow) => {
    return (
      getInvoiceStatus(invoice) === InvoiceStatus.ISSUED &&
      Boolean(getMInvoiceCreatedId(invoice))
    )
  }
  const canUpdateMInvoice = (invoice: InvoiceApiRow) => {
    const invoiceNumber = Number(invoice.invoiceNumber)

    return (
      canViewMInvoicePdf(invoice) &&
      Number.isFinite(invoiceNumber) &&
      invoiceNumber > 0
    )
  }
  const canSelectInvoice = (invoice: InvoiceApiRow) => {
    if (bulkActionLoading) return false

    const status = getInvoiceStatus(invoice)

    return canStartInvoiceExport(status) || canUpdateMInvoice(invoice)
  }

  const getAgencyName = (value: InvoiceApiRow["agencyId"]) => {
    if (!value || typeof value === "string") return ""
    return String(value.agencyName || "")
  }

  const getDepartmentName = (value: InvoiceApiRow["departmentId"]) => {
    if (!value || typeof value === "string") return ""
    return String(value.departmentName || "")
  }

  const getEmployeeName = (value: InvoiceApiRow["employeeId"]) => {
    if (!value || typeof value === "string") return ""
    return String(value.employeeName || "")
  }

  const hasDisplayValue = (value: unknown) => {
    return value !== undefined && value !== null && String(value).trim() !== ""
  }

  const formatDisplayDate = (value?: string | null) => {
    const normalizedDate = invoiceHelper.normalizeDateInput(value || "")

    if (normalizedDate) {
      const [year, month, day] = normalizedDate.split("-")
      return `${day}/${month}/${year}`
    }

    return "-"
  }

  const getPositivePercent = (value: unknown) => {
    if (!hasDisplayValue(value)) return null

    const numericValue = invoiceHelper.toNumber(value)

    return numericValue > 0 ? numericValue : null
  }

  const formatPercent = (value: unknown) => {
    const numericValue = invoiceHelper.toNumber(value)

    return Number.isInteger(numericValue)
      ? String(numericValue)
      : numericValue.toFixed(2).replace(/\.?0+$/, "")
  }

  const getInvoiceDiscountPercentage = (invoice: InvoiceApiRow) => {
    const itemWithDiscount = invoice.items?.find((item) =>
      getPositivePercent(item.discountPercentage)
    )

    if (itemWithDiscount) {
      return getPositivePercent(itemWithDiscount.discountPercentage) || 0
    }

    const invoiceDiscountPercentage = getPositivePercent(
      invoice.inv_discountPercentage
    )

    if (invoiceDiscountPercentage !== null) {
      return invoiceDiscountPercentage
    }

    if (hasDisplayValue(invoice.inv_discountPercentage)) {
      return invoiceHelper.toNumber(invoice.inv_discountPercentage)
    }

    if (invoice.agencyId && typeof invoice.agencyId === "object") {
      const agencyDiscountPercentage = getPositivePercent(
        invoice.agencyId.commissionPercent
      )

      if (agencyDiscountPercentage !== null) return agencyDiscountPercentage
    }

    const firstItemDiscountPercentage = invoice.items?.find((item) =>
      hasDisplayValue(item.discountPercentage)
    )?.discountPercentage

    if (hasDisplayValue(firstItemDiscountPercentage)) {
      return invoiceHelper.toNumber(firstItemDiscountPercentage)
    }

    return 0
  }

  const getInvoiceMinvoiceRevenue = (invoice: InvoiceApiRow) => {
    const discountPercentage = getInvoiceDiscountPercentage(invoice)
    const totalAmount = invoiceHelper.toNumber(invoice.inv_TotalAmount)

    if (totalAmount > 0) {
      return invoiceHelper.roundInvoiceMoney(
        (totalAmount * discountPercentage) / 100
      )
    }

    return (
      invoice.items?.reduce((sum, item) => {
        return sum + invoiceHelper.toNumber(item.revenue)
      }, 0) || 0
    )
  }

  const getProductCode = (product: InvoiceProductValue) => {
    if (!product || typeof product === "string") return ""
    return String(product.inv_itemCode || "")
  }

  const getProductName = (product: InvoiceProductValue) => {
    if (!product || typeof product === "string") return ""
    return String(product.inv_itemName || "")
  }

  const getInvoiceExportedAmount = (invoice: InvoiceApiRow) => {
    if (getInvoiceStatus(invoice) !== InvoiceStatus.ISSUED) return 0

    return invoiceHelper.toNumber(invoice.inv_TotalAmount)
  }

  const getInvoicePaymentState = (invoice: InvoiceApiRow) => {
    const totalAmount = invoiceHelper.toNumber(invoice.inv_TotalAmount)
    const exportedAmount = getInvoiceExportedAmount(invoice)

    const rawCollected = Math.max(
      invoiceHelper.toNumber(invoice.amountCollected),
      invoiceHelper.toNumber(invoice.paidAmount)
    )

    const isPaidFromApi =
      invoice.isPaid === true ||
      invoice.paymentStatus === InvoicePaymentStatus.PAID
    const isCollectedFromApi =
      isPaidFromApi || invoice.paymentStatus === InvoicePaymentStatus.PARTIAL
    const actualPaidAmount =
      isPaidFromApi && rawCollected <= 0
        ? totalAmount
        : Math.max(rawCollected, 0)
    const rawSuggestedPaidAmount = invoiceHelper.toNumber(
      invoice.suggestedAmountCollected
    )
    const suggestedPaidAmount =
      rawSuggestedPaidAmount > 0 ? rawSuggestedPaidAmount : exportedAmount
    const isPaid =
      totalAmount > 0 && (isPaidFromApi || actualPaidAmount >= totalAmount)
    const isCollected = isCollectedFromApi || actualPaidAmount > 0
    const paidAmount =
      actualPaidAmount > 0 ? actualPaidAmount : suggestedPaidAmount
    const remainingAmount = totalAmount - paidAmount
    const outstandingAmount = totalAmount - actualPaidAmount

    return {
      isPaid,
      isCollected,
      actualPaidAmount,
      paidAmount,
      remainingAmount,
      outstandingAmount,
    }
  }
  const moneyFormatter = useMemo(() => {
    return new Intl.NumberFormat("vi-VN")
  }, [])
  const agencyOptions = useMemo(() => {
    const optionMap = new Map<string, string>()

    rows.forEach((invoice) => {
      const agencyName = getAgencyName(invoice.agencyId)
      const agencyId = invoiceHelper.getId(invoice.agencyId) || agencyName

      if (!agencyId || !agencyName) return

      optionMap.set(agencyId, agencyName)
    })

    return Array.from(optionMap.entries())
      .map(([value, label]) => ({ value, label }))
      .sort((a, b) => a.label.localeCompare(b.label, "vi"))
  }, [rows])

  const hasActiveFilters = Boolean(
    keyword ||
      fromDate ||
      toDate ||
      exportStatusFilter ||
      orderCreateFilter ||
      agencyFilter
  )

  const handleClearFilters = () => {
    setKeyword("")

    setDraftFromDate("")
    setDraftToDate("")
    setDraftExportStatusFilter("")
    setDraftOrderCreateFilter("")
    setDraftAgencyFilter("")

    setFromDate("")
    setToDate("")
    setExportStatusFilter("")
    setOrderCreateFilter("")
    setAgencyFilter("")

    setPage(1)
  }

  const handleApplyFilters = () => {
    setFromDate(draftFromDate)
    setToDate(draftToDate)
    setExportStatusFilter(draftExportStatusFilter)
    setOrderCreateFilter(draftOrderCreateFilter)
    setAgencyFilter(draftAgencyFilter)
    setPage(1)
    setFilterOpen(false)
  }

  const handleToggleFilter = () => {
    setDraftFromDate(fromDate)
    setDraftToDate(toDate)
    setDraftExportStatusFilter(exportStatusFilter)
    setDraftOrderCreateFilter(orderCreateFilter)
    setDraftAgencyFilter(agencyFilter)
    setFilterOpen((current) => !current)
  }
  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (!filterOpen) return

    const handlePointerDownOutside = (event: PointerEvent) => {
      const target = event.target
      const isFloatingFilterInteraction =
        target instanceof Element &&
        Boolean(
          target.closest(
            "[data-invoice-filter-calendar], [data-invoice-filter-select]"
          )
        )

      if (
        target instanceof Node &&
        !isFloatingFilterInteraction &&
        !filterContainerRef.current?.contains(target)
      ) {
        setFilterOpen(false)
      }
    }

    document.addEventListener("pointerdown", handlePointerDownOutside)

    return () => {
      document.removeEventListener("pointerdown", handlePointerDownOutside)
    }
  }, [filterOpen])

  const filterToolbarSlot =
    mounted && typeof document !== "undefined"
      ? document.getElementById("invoice-order-filter-toolbar-slot")
      : null
  const filteredRows = useMemo(() => {
    const searchValue = keyword.trim().toLowerCase()

    return rows.filter((invoice) => {
      const firstItem = invoice.items?.[0]
      const product = firstItem?.productId

      const invoiceStatus = getInvoiceStatus(invoice)
      const invoiceDate = invoiceHelper.normalizeDateInput(
        invoice.inv_invoiceIssuedDate
      )

      const agencyName = getAgencyName(invoice.agencyId)
      const agencyId = invoiceHelper.getId(invoice.agencyId) || agencyName

      const orderCreated = Boolean(String(invoice.orderNumber || "").trim())

      const searchText = [
        invoice.inv_invoiceSeries,
        invoice.orderNumber,
        invoice.inv_invoiceIssuedDate,
        agencyName,
        getDepartmentName(invoice.departmentId),
        getEmployeeName(invoice.employeeId),
        invoice.inv_buyerTaxCode,
        invoice.inv_buyerDisplayName,
        invoice.inv_buyerLegalName,
        invoice.inv_buyerEmail,
        invoice.inv_buyerAddressLine,
        invoice.inv_buyerBankName,
        getProductCode(product),
        getProductName(product),
        invoice.inv_invoiceCreatedId,
        getInvoiceStatusDisplayLabel(invoice),
        invoice.note,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()

      const matchKeyword = searchValue ? searchText.includes(searchValue) : true

      const matchFromDate = fromDate
        ? Boolean(invoiceDate && invoiceDate >= fromDate)
        : true

      const matchToDate = toDate
        ? Boolean(invoiceDate && invoiceDate <= toDate)
        : true

      const matchExportStatus = exportStatusFilter
        ? invoiceStatus === exportStatusFilter
        : true

      const matchOrderCreate =
        orderCreateFilter === "created"
          ? orderCreated
          : orderCreateFilter === "not_created"
            ? !orderCreated
            : true

      const matchAgency = agencyFilter ? agencyId === agencyFilter : true

      return (
        matchKeyword &&
        matchFromDate &&
        matchToDate &&
        matchExportStatus &&
        matchOrderCreate &&
        matchAgency
      )
    })
  }, [
    rows,
    keyword,
    fromDate,
    toDate,
    exportStatusFilter,
    orderCreateFilter,
    agencyFilter,
  ])

  useEffect(() => {
    if (isExternalPagination) return

    setPage(1)
  }, [
    isExternalPagination,
    rows,
    keyword,
    fromDate,
    toDate,
    exportStatusFilter,
    orderCreateFilter,
    agencyFilter,
  ])
  const totalItems = pagination?.totalItems ?? filteredRows.length
  const totalPages = Math.max(Math.ceil(totalItems / effectivePageSize), 1)
  const safePage = Math.min(effectivePage, totalPages)
  const startIndex = (safePage - 1) * effectivePageSize
  const pageRows = isExternalPagination
    ? filteredRows
    : filteredRows.slice(startIndex, startIndex + effectivePageSize)
  const enableBulkSelection = Boolean(onSelectedRowIdsChange)

  const summary = useMemo(() => {
    return filteredRows.reduce(
      (acc, invoice) => {
        const exportedAmount = getInvoiceExportedAmount(invoice)
        const totalBeforeTax = Number(invoice.inv_TotalAmountWithoutVAT || 0)
        const vatAmount = Number(invoice.inv_vatAmount || 0)
        const paymentState = getInvoicePaymentState(invoice)

        acc.totalAmount += exportedAmount
        acc.totalBeforeTax += totalBeforeTax
        acc.vatAmount += vatAmount
        acc.paidAmount += paymentState.actualPaidAmount
        acc.remainingAmount += paymentState.outstandingAmount
        acc.minvoiceRevenue += getInvoiceMinvoiceRevenue(invoice)

        return acc
      },
      {
        totalAmount: 0,
        totalBeforeTax: 0,
        vatAmount: 0,
        paidAmount: 0,
        remainingAmount: 0,
        minvoiceRevenue: 0,
      }
    )
  }, [filteredRows])

  const columns: DataTableColumn<InvoiceApiRow>[] = [
    {
      key: "createdAt",
      title: "Ngày tạo",
      className: "whitespace-nowrap text-center",
      headerClassName: "text-center",
      render: (invoice) => {
        const value = invoice.createdAt

        if (!value) return "-"

        const textValue = String(value).trim()
        const match = textValue.match(/^(\d{2})\/(\d{2})\/(\d{4})/)

        if (match) return `${match[1]}/${match[2]}/${match[3]}`

        const date = new Date(textValue)

        if (!Number.isNaN(date.getTime())) {
          return new Intl.DateTimeFormat("vi-VN", {
            day: "2-digit",
            month: "2-digit",
            year: "numeric",
          }).format(date)
        }

        return textValue
      },
    },
    {
      key: "activationDate",
      title: "Ngày kích hoạt",
      className: "whitespace-nowrap text-center min-w-[130px]",
      headerClassName: "text-center",
      render: (invoice) => {
        return formatDisplayDate(invoice.activationDate)
      },
    },
    {
      key: "invoiceNumber",
      title: "Số hoá đơn",
      className: "whitespace-nowrap text-center min-w-[130px] ",
      headerClassName: "text-center",
      render: (invoice) => invoice.invoiceNumber || "-",
    },
    {
      key: "inv_invoiceIssuedDate",
      title: "Ngày xuất HĐ",
      className: "whitespace-nowrap text-center min-w-[130px]",
      headerClassName: "text-center",
      render: (invoice) => {
        return formatDisplayDate(invoice.inv_invoiceIssuedDate)
      },
    },
    {
      key: "orderCreateStatus",
      title: "Trạng thái tạo",
      className: "whitespace-nowrap text-center min-w-[130px]",
      headerClassName: "text-center",
      render: (invoice) => {
        const orderCreated = Boolean(String(invoice.orderNumber || "").trim())

        return (
          <span
            className={`inline-flex min-w-[90px] justify-center rounded-full border px-2.5 py-1 text-xs font-semibold ${
              orderCreated
                ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                : "border-slate-200 bg-slate-50 text-slate-600"
            }`}
          >
            {orderCreated ? "Đã tạo" : "Chưa tạo"}
          </span>
        )
      },
    },
    {
      key: "exportInvoiceStatus",
      title: "Trạng thái xuất HĐ",
      className: "whitespace-nowrap text-center min-w-[140px]",
      headerClassName: "text-center",
      render: (invoice) => {
        const status = getInvoiceStatus(invoice)

        return (
          <span
            className={`inline-flex min-w-[110px] justify-center rounded-full border px-2.5 py-1 text-xs font-semibold ${invoiceStatusClass[status]}`}
          >
            {getInvoiceStatusDisplayLabel(invoice)}
          </span>
        )
      },
    },
    {
      key: "agencyId",
      title: "Tên Đại lý",
      className: "min-w-[130px]",
      render: (invoice) => getAgencyName(invoice.agencyId) || "-",
    },
    // {
    //   key: "discountPercentage",
    //   title: "% chiết khấu",
    //   className: "whitespace-nowrap text-right min-w-[120px]",
    //   headerClassName: "text-right",
    //   render: (invoice) =>
    //     `${formatPercent(getInvoiceDiscountPercentage(invoice))}%`,
    // },
    {
      key: "inv_buyerTaxCode",
      title: "MST",
      className: "whitespace-nowrap",
      render: (invoice) => invoice.inv_buyerTaxCode || "-",
    },
    {
      key: "companyName",
      title: "Tên công ty",
      className: "min-w-[400px] text-left",
      render: (invoice) =>
        invoice.inv_buyerLegalName || invoice.inv_buyerDisplayName || "-",
    },
    // {
    //   key: "inv_quantity",
    //   title: "SL",
    //   className: "text-center",
    //   headerClassName: "text-center",
    //   render: (invoice) => Number(invoice.inv_quantity || 0),
    // },
    {
      key: "orderNumber",
      title: "Số đơn hàng",
      className: "whitespace-nowrap text-center min-w-[160px]",
      headerClassName: "text-center",
      render: (invoice) => invoice.orderNumber || "-",
    },
    {
      key: "productName",
      title: "Tên SP",
      className: "min-w-[200px]",
      render: (invoice) => getProductName(invoice.items?.[0]?.productId) || "-",
    },
    {
      key: "inv_TotalAmountWithoutVAT",
      title: "Tổng giá trị",
      className: "whitespace-nowrap min-w-[150px] text-right ",
      headerClassName: "text-right",
      render: (invoice) =>
        moneyFormatter.format(Number(invoice.inv_TotalAmount || 0)),
    },
    {
      key: "inv_TotalAmount",
      title: "Tổng xuất HĐ",
      className: "whitespace-nowrap text-right min-w-[120px] ",
      headerClassName: "text-right",
      render: (invoice) =>
        moneyFormatter.format(getInvoiceExportedAmount(invoice)),
    },

    {
      key: "paid",
      title: "Thu tiền",
      className: "text-center",
      headerClassName: "text-center",
      render: (invoice) => {
        const { isCollected } = getInvoicePaymentState(invoice)

        return (
          <span
            className={`inline-flex min-w-[82px] justify-center rounded-xl px-2 py-1 text-xs font-semibold ${
              isCollected
                ? "bg-emerald-100 text-emerald-700"
                : "bg-amber-100 text-amber-700"
            }`}
          >
            {isCollected ? "Đã thu" : "Chưa thu"}
          </span>
        )
      },
    },
    {
      key: "paidDate",
      title: "Ngày thu tiền",
      className: "whitespace-nowrap text-center min-w-[130px]",
      headerClassName: "text-center",
      render: (invoice) => {
        const { isCollected } = getInvoicePaymentState(invoice)

        if (!isCollected) return "-"

        return formatDisplayDate(invoice.paidDate || invoice.paymentDate)
      },
    },
    {
      key: "amountCollected",
      title: "Số tiền thu",
      className: "whitespace-nowrap text-right min-w-[120px] ",
      headerClassName: "text-right",
      render: (invoice) =>
        moneyFormatter.format(getInvoicePaymentState(invoice).paidAmount),
    },
    {
      key: "paidAmount",
      title: "Số tiền chênh lệch",
      className: "whitespace-nowrap text-center min-w-[150px] ",
      headerClassName: "text-right",
      render: (invoice) => {
        const remainingAmount = getInvoicePaymentState(invoice).remainingAmount

        return (
          <span className={remainingAmount < 0 ? "text-rose-600" : ""}>
            {moneyFormatter.format(remainingAmount)}
          </span>
        )
      },
    },
  ]

  return (
    <div className="mx-4 flex min-h-0 flex-1 flex-col gap-3 bg-white p-3">
      {filterToolbarSlot &&
        createPortal(
          <div ref={filterContainerRef} className="relative">
            <ToolbarButton
              onClick={handleToggleFilter}
              variant={filterOpen || hasActiveFilters ? "primary" : "default"}
              disabled={loading}
            >
              <SlidersHorizontal size={16} />
              Lọc đơn hàng
            </ToolbarButton>

            <AnimatePresence initial={false}>
              {filterOpen && (
                <motion.div
                  initial={{ opacity: 0, y: -6, scale: 0.985 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{
                    opacity: 0,
                    y: -4,
                    scale: 0.985,
                    transition: { duration: 0.28, ease: "easeInOut" },
                  }}
                  transition={{ duration: 0.16, ease: "easeOut" }}
                  className="absolute left-0 top-[calc(100%+8px)] z-[999] w-[560px] max-w-[calc(100vw-32px)] origin-top-left rounded-lg border border-slate-200 bg-white p-6 shadow-xl"
                >
                  <div className="grid gap-4">
                    <div className="grid gap-2 sm:grid-cols-[170px_1fr] sm:items-center">
                      <label
                        htmlFor="invoice-filter-from-date"
                        className="text-sm font-medium text-slate-700"
                      >
                        Từ ngày
                      </label>
                      <InvoiceDatePicker
                        id="invoice-filter-from-date"
                        value={draftFromDate}
                        onChange={setDraftFromDate}
                      />
                    </div>

                    <div className="grid gap-2 sm:grid-cols-[170px_1fr] sm:items-center">
                      <label
                        htmlFor="invoice-filter-to-date"
                        className="text-sm font-medium text-slate-700"
                      >
                        Đến ngày
                      </label>
                      <InvoiceDatePicker
                        id="invoice-filter-to-date"
                        value={draftToDate}
                        onChange={setDraftToDate}
                      />
                    </div>

                    <div className="grid gap-2 sm:grid-cols-[170px_1fr] sm:items-center">
                      <label
                        htmlFor="invoice-filter-export-status"
                        className="text-sm font-medium text-slate-700"
                      >
                        Trạng thái xuất hóa đơn
                      </label>
                      <InvoiceFilterSelect
                        id="invoice-filter-export-status"
                        value={draftExportStatusFilter}
                        onChange={setDraftExportStatusFilter}
                        options={[
                          { value: "", label: "Tất cả" },
                          { value: InvoiceStatus.DRAFT, label: "Nháp" },
                          {
                            value: InvoiceStatus.ISSUING,
                            label: "Đang xuất hóa đơn",
                          },
                          {
                            value: InvoiceStatus.ISSUED,
                            label: "Đã xuất hóa đơn",
                          },
                          {
                            value: InvoiceStatus.FAILED,
                            label: "Xuất thất bại",
                          },
                          {
                            value: InvoiceStatus.CANCELLED,
                            label: "Đã hủy",
                          },
                        ]}
                      />
                    </div>

                    <div className="grid gap-2 sm:grid-cols-[170px_1fr] sm:items-center">
                      <label
                        htmlFor="invoice-filter-order-status"
                        className="text-sm font-medium text-slate-700"
                      >
                        Trạng thái tạo đơn hàng
                      </label>
                      <InvoiceFilterSelect
                        id="invoice-filter-order-status"
                        value={draftOrderCreateFilter}
                        onChange={setDraftOrderCreateFilter}
                        options={[
                          { value: "", label: "Tất cả" },
                          { value: "created", label: "Đã tạo đơn hàng" },
                          { value: "not_created", label: "Chưa tạo đơn hàng" },
                        ]}
                      />
                    </div>

                    <div className="grid gap-2 sm:grid-cols-[170px_1fr] sm:items-center">
                      <label
                        htmlFor="invoice-filter-agency"
                        className="text-sm font-medium text-slate-700"
                      >
                        Đại lý
                      </label>
                      <InvoiceFilterSelect
                        id="invoice-filter-agency"
                        value={draftAgencyFilter}
                        onChange={setDraftAgencyFilter}
                        options={[
                          { value: "", label: "Tất cả đại lý" },
                          ...agencyOptions,
                        ]}
                      />
                    </div>

                    <div className="flex flex-wrap items-center gap-2 sm:pl-[170px]">
                      <button
                        type="button"
                        onClick={handleApplyFilters}
                        className="inline-flex h-11 items-center justify-center rounded-lg bg-blue-600 px-5 text-sm font-semibold text-white transition hover:bg-blue-700"
                      >
                        Lọc
                      </button>

                      <button
                        type="button"
                        onClick={handleClearFilters}
                        className="inline-flex h-11 items-center justify-center rounded-lg bg-red-700 px-5 text-sm font-semibold text-white transition hover:bg-red-800"
                      >
                        Xóa lọc
                      </button>
                    </div>

                    <div className="text-sm font-bold text-blue-700 sm:pl-[170px]">
                      Tổng đơn hàng: {filteredRows.length}
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>,
          filterToolbarSlot
        )}
      <div className="relative z-40">
        <div className="flex flex-wrap items-center gap-2">
          <input
            className="h-9 w-full max-w-[360px] rounded border border-slate-300 bg-white px-3 text-sm outline-none focus:border-indigo-500"
            value={keyword}
            onChange={(e) => {
              setPage(1)
              setKeyword(e.target.value)
            }}
            placeholder="Tìm theo MST, công ty, đại lý, nhân viên, sản phẩm..."
          />

          {hasActiveFilters && (
            <button
              type="button"
              onClick={handleClearFilters}
              className="inline-flex h-9 items-center justify-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 text-sm font-semibold text-red-700 transition hover:bg-red-100"
            >
              <X size={15} />
              Xóa lọc
            </button>
          )}

          <div className="ml-auto text-sm text-slate-500">
            Tổng:{" "}
            <span className="font-semibold text-slate-800">
              {filteredRows.length}
            </span>{" "}
            hóa đơn
          </div>
        </div>
      </div>

      <DataTable<InvoiceApiRow>
        data={pageRows}
        columns={columns}
        loading={loading}
        emptyText="Không có dữ liệu hóa đơn phù hợp."
        getRowKey={(invoice) => invoice._id}
        selectable={enableBulkSelection}
        selectedRowKeys={selectedRowIds}
        onSelectedRowKeysChange={onSelectedRowIdsChange}
        isRowSelectable={canSelectInvoice}
        onView={onView}
        onEdit={onEdit}
        canEdit={(invoice) => {
          const status = getInvoiceStatus(invoice)

          return ![InvoiceStatus.ISSUING, InvoiceStatus.CANCELLED].includes(
            status
          )
        }}
        renderActions={(invoice) => {
          const status = getInvoiceStatus(invoice)
          const isExporting = exportingInvoiceId === invoice._id
          const isUpdatingMInvoice = updatingMInvoiceId === invoice._id
          const isProcessing =
            status === InvoiceStatus.ISSUING ||
            isExporting ||
            isUpdatingMInvoice
          const canCollectPayment =
            status === InvoiceStatus.DRAFT || status === InvoiceStatus.ISSUED

          if (isProcessing) {
            return (
              <button
                type="button"
                disabled
                title="Đang xử lý xuất hóa đơn"
                className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-sky-200 bg-sky-50 text-sky-700 shadow-sm transition disabled:cursor-not-allowed disabled:opacity-70"
              >
                <Loader2 size={15} className="animate-spin" />
              </button>
            )
          }

          return (
            <>
              {onCopyInvoice && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    void onCopyInvoice(invoice)
                  }}
                  title="Sao chép hóa đơn"
                  className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-violet-200 bg-violet-50 text-violet-700 shadow-sm transition hover:border-violet-400 hover:bg-violet-100 hover:text-violet-800"
                >
                  <Copy size={15} />
                </button>
              )}

              {canStartInvoiceExport(status) && onExportInvoice && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    void onExportInvoice(invoice)
                  }}
                  title="Xuất hóa đơn"
                  className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-amber-200 bg-amber-50 text-amber-700 shadow-sm transition hover:border-amber-400 hover:bg-amber-100 hover:text-amber-800"
                >
                  <FileText size={15} />
                </button>
              )}

              {canCollectPayment && onCollectPayment && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    onCollectPayment(invoice)
                  }}
                  title="Thu tiền"
                  className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-teal-200 bg-teal-50 text-teal-700 shadow-sm transition hover:border-teal-400 hover:bg-teal-100 hover:text-teal-800"
                >
                  <HandCoins size={15} />
                </button>
              )}

              {canUpdateMInvoice(invoice) && onUpdateMInvoice && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    void onUpdateMInvoice(invoice)
                  }}
                  title="Cập nhật hóa đơn"
                  className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-blue-200 bg-blue-50 text-blue-700 shadow-sm transition hover:border-blue-400 hover:bg-blue-100 hover:text-blue-800"
                >
                  <RefreshCw size={15} />
                </button>
              )}

              {canViewMInvoicePdf(invoice) && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    onViewMInvoicePdf?.(invoice)
                  }}
                  title="Xem mẫu hóa đơn PDF"
                  className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-emerald-200 bg-emerald-50 text-emerald-700 shadow-sm transition hover:border-emerald-400 hover:bg-emerald-100 hover:text-emerald-800"
                >
                  <Printer size={15} />
                </button>
              )}
            </>
          )
        }}
      />

      <div className="grid gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm md:grid-cols-3 xl:grid-cols-6">
        <div>
          <div className="text-xs text-slate-500">Tổng giá trị</div>
          <div className="font-bold text-slate-800">
            {moneyFormatter.format(summary.totalBeforeTax)}
          </div>
        </div>

        <div>
          <div className="text-xs text-slate-500">Tiền thuế</div>
          <div className="font-bold text-slate-800">
            {moneyFormatter.format(summary.vatAmount)}
          </div>
        </div>

        <div>
          <div className="text-xs text-slate-500">Tổng xuất HĐ</div>
          <div className="font-bold text-slate-800">
            {moneyFormatter.format(summary.totalAmount)}
          </div>
        </div>

        <div>
          <div className="text-xs text-slate-500">DT MINVOICE</div>
          <div className="font-bold text-slate-800">
            {moneyFormatter.format(summary.minvoiceRevenue)}
          </div>
        </div>

        <div>
          <div className="text-xs text-slate-500">Đã thu</div>
          <div className="font-bold text-emerald-700">
            {moneyFormatter.format(summary.paidAmount)}
          </div>
        </div>

        <div>
          <div className="text-xs text-slate-500">Còn lại</div>
          <div
            className={`font-bold ${
              summary.remainingAmount < 0 ? "text-rose-600" : "text-amber-700"
            }`}
          >
            {moneyFormatter.format(summary.remainingAmount)}
          </div>
        </div>
      </div>

      <Pagination
        currentPage={safePage}
        setCurrentPage={pagination?.onPageChange ?? setPage}
        totalItem={totalItems}
        itemPerPage={effectivePageSize}
        setItemPerPage={
          pagination?.onPageSizeChange ??
          ((nextPageSize) => {
            setPage(1)
            setPageSize(nextPageSize)
          })
        }
        pageSizeOptions={pagination?.pageSizeOptions ?? [10, 20, 50, 100]}
        syncUrl={pagination?.syncUrl}
      />
    </div>
  )
}
