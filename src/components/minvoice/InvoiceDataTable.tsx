"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { createPortal } from "react-dom"
import {
  InvoiceApiRow,
  InvoicePaymentStatus,
  InvoiceStatus,
} from "@/types/invoice"
import { DataTable, type DataTableColumn } from "../common/Datatable"
import {
  Ban,
  Copy,
  FileText,
  HandCoins,
  Loader2,
  Printer,
  RefreshCw,
  SlidersHorizontal,
  X,
} from "lucide-react"
import { AnimatePresence, motion } from "framer-motion"
import Pagination from "../pagination/Pagination"
import * as invoiceHelper from "@/utils/invoice"
import { cn } from "@/lib/utils"
import InvoiceFilterSelect from "./InvoiceFilterSelect"
import InvoiceDatePicker from "./InvoiceFilterDatePicker"
import { ToolbarButton } from "./InvoiceToolbar"
import { APIGetAllAgencies } from "@/services/agency"
import type { Agency } from "@/types/agency"

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
  onCancelInvoice?: (row: InvoiceApiRow) => void
  cancellingInvoiceId?: string | null
  selectedRowIds?: string[]
  onSelectedRowIdsChange?: (ids: string[]) => void
  bulkActionLoading?: boolean
  searchKeyword?: string
  onSearchKeywordChange?: (keyword: string) => void
  agencyFilterId?: string
  onAgencyFilterChange?: (agencyId: string) => void
  onClearServerFilters?: () => void
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

type InvoiceColumnFilterKey =
  | "createdAt"
  | "activationDate"
  | "invoiceNumber"
  | "inv_invoiceIssuedDate"
  | "orderCreateStatus"
  | "exportInvoiceStatus"
  | "agencyId"
  | "inv_buyerTaxCode"
  | "companyName"
  | "orderNumber"
  | "productName"
  | "inv_TotalAmountWithoutVAT"
  | "inv_TotalAmount"
  | "paid"
  | "paidDate"
  | "amountCollected"
  | "paidAmount"

type InvoiceColumnFilters = Record<InvoiceColumnFilterKey, string>

type InvoiceColumnFilterControlProps = {
  id: string
  label: string
  value: string
  appliedValue: string
  onChange: (value: string) => void
  onApply: (value: string) => void
  inputType?: "text" | "date"
  options?: { value: string; label: string }[]
}

const createEmptyColumnFilters = (): InvoiceColumnFilters => ({
  createdAt: "",
  activationDate: "",
  invoiceNumber: "",
  inv_invoiceIssuedDate: "",
  orderCreateStatus: "",
  exportInvoiceStatus: "",
  agencyId: "",
  inv_buyerTaxCode: "",
  companyName: "",
  orderNumber: "",
  productName: "",
  inv_TotalAmountWithoutVAT: "",
  inv_TotalAmount: "",
  paid: "",
  paidDate: "",
  amountCollected: "",
  paidAmount: "",
})

function normalizeFilterText(value: unknown) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
}

const MONEY_FORMATTER = new Intl.NumberFormat("vi-VN")
const EXACT_MATCH_COLUMN_KEYS = new Set<InvoiceColumnFilterKey>([
  "createdAt",
  "activationDate",
  "inv_invoiceIssuedDate",
  "orderCreateStatus",
  "exportInvoiceStatus",
  "agencyId",
  "paid",
  "paidDate",
])

function getInvoiceStatusDisplayLabel(invoice: InvoiceApiRow) {
  return (
    String(invoice.invoiceStatusVi || "").trim() ||
    invoiceHelper.invoiceStatusLabel[invoiceHelper.getInvoiceStatus(invoice)]
  )
}

function getInvoiceCreationStatus(invoice: InvoiceApiRow) {
  const status = invoiceHelper.getInvoiceStatus(invoice)

  if (status === InvoiceStatus.CANCELLED) return "cancelled"
  if (status === InvoiceStatus.ISSUED) return "created"
  return "not_created"
}

function getMInvoiceCreatedId(invoice?: InvoiceApiRow | null) {
  return String(invoice?.inv_invoiceCreatedId || "").trim()
}

function canViewMInvoicePdf(invoice: InvoiceApiRow) {
  return (
    invoiceHelper.getInvoiceStatus(invoice) === InvoiceStatus.ISSUED &&
    Boolean(getMInvoiceCreatedId(invoice))
  )
}

function canUpdateMInvoice(invoice: InvoiceApiRow) {
  const invoiceNumber = Number(invoice.invoiceNumber)

  return (
    canViewMInvoicePdf(invoice) &&
    Number.isFinite(invoiceNumber) &&
    invoiceNumber > 0
  )
}

function getAgencyName(value: InvoiceApiRow["agencyId"]) {
  if (!value || typeof value === "string") return ""
  return String(value.agencyName || "")
}

function getDepartmentName(value: InvoiceApiRow["departmentId"]) {
  if (!value || typeof value === "string") return ""
  return String(value.departmentName || "")
}

function getEmployeeName(value: InvoiceApiRow["employeeId"]) {
  if (!value || typeof value === "string") return ""
  return String(value.employeeName || "")
}

function hasDisplayValue(value: unknown) {
  return value !== undefined && value !== null && String(value).trim() !== ""
}

function formatDisplayDate(value?: string | null) {
  const normalizedDate = invoiceHelper.normalizeDateInput(value || "")

  if (normalizedDate) {
    const [year, month, day] = normalizedDate.split("-")
    return `${day}/${month}/${year}`
  }

  return "-"
}

function getPositivePercent(value: unknown) {
  if (!hasDisplayValue(value)) return null

  const numericValue = invoiceHelper.toNumber(value)
  return numericValue > 0 ? numericValue : null
}

function getInvoiceDiscountPercentage(invoice: InvoiceApiRow) {
  const itemWithDiscount = invoice.items?.find((item) =>
    getPositivePercent(item.discountPercentage)
  )

  if (itemWithDiscount) {
    return getPositivePercent(itemWithDiscount.discountPercentage) || 0
  }

  const invoiceDiscountPercentage = getPositivePercent(
    invoice.inv_discountPercentage
  )

  if (invoiceDiscountPercentage !== null) return invoiceDiscountPercentage

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

  return hasDisplayValue(firstItemDiscountPercentage)
    ? invoiceHelper.toNumber(firstItemDiscountPercentage)
    : 0
}

function getInvoiceMinvoiceRevenue(invoice: InvoiceApiRow) {
  const discountPercentage = getInvoiceDiscountPercentage(invoice)
  const totalAmount = invoiceHelper.toNumber(invoice.inv_TotalAmount)

  if (totalAmount > 0) {
    return invoiceHelper.roundInvoiceMoney(
      (totalAmount * discountPercentage) / 100
    )
  }

  return (
    invoice.items?.reduce(
      (sum, item) => sum + invoiceHelper.toNumber(item.revenue),
      0
    ) || 0
  )
}

function getProductCode(product: InvoiceProductValue) {
  if (!product || typeof product === "string") return ""
  return String(product.inv_itemCode || "")
}

function getProductName(product: InvoiceProductValue) {
  if (!product || typeof product === "string") return ""
  return String(product.inv_itemName || "")
}

function getInvoiceExportedAmount(invoice: InvoiceApiRow) {
  if (invoiceHelper.getInvoiceStatus(invoice) !== InvoiceStatus.ISSUED) return 0
  return invoiceHelper.toNumber(invoice.inv_TotalAmount)
}

function getInvoicePaymentState(invoice: InvoiceApiRow) {
  const totalAmount = invoiceHelper.toNumber(invoice.inv_TotalAmount)
  const hasAmountCollected =
    invoice.amountCollected !== undefined && invoice.amountCollected !== null
  const hasPaidAmount =
    invoice.paidAmount !== undefined && invoice.paidAmount !== null
  const rawCollected = invoiceHelper.toNumber(
    hasAmountCollected ? invoice.amountCollected : invoice.paidAmount
  )
  const isPaidFromApi =
    invoice.isPaid === true ||
    invoice.paymentStatus === InvoicePaymentStatus.PAID
  const actualPaidAmount =
    !hasAmountCollected && !hasPaidAmount && isPaidFromApi
      ? totalAmount
      : Math.max(rawCollected, 0)
  const isPaid = actualPaidAmount > 0
  const isCollected = actualPaidAmount > 0

  return {
    isPaid,
    isCollected,
    actualPaidAmount,
    paidAmount: actualPaidAmount,
    remainingAmount: totalAmount - actualPaidAmount,
    outstandingAmount: totalAmount - actualPaidAmount,
  }
}

function InvoiceColumnFilterControl({
  id,
  label,
  value,
  appliedValue,
  onChange,
  onApply,
  inputType = "text",
  options,
}: InvoiceColumnFilterControlProps) {
  const isActive = Boolean(appliedValue)
  const controlClassName = cn(
    "h-8 w-full rounded border bg-white px-2 text-[13px] font-normal text-slate-800 outline-none transition placeholder:text-slate-400",
    "hover:border-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100",
    isActive ? "border-blue-400 bg-blue-50/40" : "border-slate-300"
  )

  if (options) {
    return (
      <InvoiceFilterSelect
        id={id}
        value={value}
        onChange={(nextValue) => {
          onChange(nextValue)
          onApply(nextValue)
        }}
        options={[{ value: "", label: "-" }, ...options]}
      />
    )
  }

  if (inputType === "date") {
    return (
      <div
        className={cn(
          "[&_button]:h-8",
          isActive && "[&_button]:border-blue-400 [&_button]:bg-blue-50/40"
        )}
      >
        <InvoiceDatePicker
          id={id}
          value={value}
          onChange={(nextValue) => {
            onChange(nextValue)
            onApply(nextValue)
          }}
        />
      </div>
    )
  }

  return (
    <input
      id={id}
      type="text"
      value={value}
      onChange={(event) => onChange(event.target.value)}
      onBlur={(event) => onApply(event.target.value)}
      onKeyDown={(event) => {
        if (event.key === "Enter") {
          onApply(event.currentTarget.value)
          event.preventDefault()
        }

        if (event.key === "Escape") {
          onChange(appliedValue)
        }
      }}
      placeholder=""
      className={controlClassName}
      aria-label={`Lọc theo ${label}`}
    />
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
  onCancelInvoice,
  cancellingInvoiceId = null,
  selectedRowIds = [],
  onSelectedRowIdsChange,
  bulkActionLoading = false,
  searchKeyword,
  onSearchKeywordChange,
  agencyFilterId,
  onAgencyFilterChange,
  onClearServerFilters,
  pagination,
}: Props) {
  const isServerSearch = Boolean(onSearchKeywordChange || onAgencyFilterChange)
  const [keyword, setKeyword] = useState(searchKeyword ?? "")
  const [filterOpen, setFilterOpen] = useState(false)
  const [mounted, setMounted] = useState(false)
  const filterContainerRef = useRef<HTMLDivElement>(null)
  const [agencyCatalog, setAgencyCatalog] = useState<Agency[]>([])

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
  const [columnFilters, setColumnFilters] = useState<InvoiceColumnFilters>(
    createEmptyColumnFilters
  )
  const [draftColumnFilters, setDraftColumnFilters] =
    useState<InvoiceColumnFilters>(createEmptyColumnFilters)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const isExternalPagination = Boolean(pagination)
  const effectivePage = pagination?.currentPage ?? page
  const effectivePageSize = pagination?.pageSize ?? pageSize

  const canSelectInvoice = (invoice: InvoiceApiRow) => {
    if (bulkActionLoading) return false

    const status = invoiceHelper.getInvoiceStatus(invoice)

    return (
      invoiceHelper.canStartInvoiceExport(status) || canUpdateMInvoice(invoice)
    )
  }
  const agencyOptions = useMemo(() => {
    const optionMap = new Map<string, string>()

    agencyCatalog.forEach((agency) => {
      const agencyId = agency._id
      const agencyName = agency.agencyName || agency.inv_agencyName || agencyId
      if (!agencyId || !agencyName) return
      optionMap.set(agencyId, agencyName)
    })

    rows.forEach((invoice) => {
      const agencyName = getAgencyName(invoice.agencyId)
      const agencyId = invoiceHelper.getId(invoice.agencyId)
      if (!agencyId || !agencyName) return
      if (!optionMap.has(agencyId)) optionMap.set(agencyId, agencyName)
    })

    return Array.from(optionMap.entries())
      .map(([value, label]) => ({ value, label }))
      .sort((a, b) => a.label.localeCompare(b.label, "vi"))
  }, [agencyCatalog, rows])

  const hasActiveFilters = Boolean(
    keyword ||
      agencyFilterId ||
      fromDate ||
      toDate ||
      exportStatusFilter ||
      orderCreateFilter ||
      agencyFilter ||
      Object.values(columnFilters).some(Boolean)
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
    setColumnFilters(createEmptyColumnFilters())
    setDraftColumnFilters(createEmptyColumnFilters())

    setPage(1)

    if (onClearServerFilters) {
      onClearServerFilters()
      return
    }

    pagination?.onPageChange(1)
    onSearchKeywordChange?.("")
    onAgencyFilterChange?.("")
  }

  const handleAgencySelectChange = (nextAgencyId: string) => {
    const normalizedAgencyId = nextAgencyId.trim()
    const currentAgencyId = (agencyFilterId ?? agencyFilter).trim()
    const agencyChanged = normalizedAgencyId !== currentAgencyId

    setAgencyFilter(normalizedAgencyId)
    setDraftAgencyFilter(normalizedAgencyId)
    setColumnFilters((current) =>
      current.agencyId === normalizedAgencyId
        ? current
        : { ...current, agencyId: normalizedAgencyId }
    )
    setDraftColumnFilters((current) =>
      current.agencyId === normalizedAgencyId
        ? current
        : { ...current, agencyId: normalizedAgencyId }
    )

    if (!agencyChanged) return

    setPage(1)

    if (onAgencyFilterChange) {
      onAgencyFilterChange(normalizedAgencyId)
      return
    }

    pagination?.onPageChange(1)
  }

  const handleDraftColumnFilterChange = (
    key: InvoiceColumnFilterKey,
    value: string
  ) => {
    if (key === "agencyId") {
      handleAgencySelectChange(value)
      return
    }

    setDraftColumnFilters((current) => ({ ...current, [key]: value }))
  }

  const handleApplyColumnFilter = (
    key: InvoiceColumnFilterKey,
    value: string
  ) => {
    if (key === "agencyId") {
      handleAgencySelectChange(value)
      return
    }

    setColumnFilters((current) => ({ ...current, [key]: value }))
    setPage(1)
    pagination?.onPageChange(1)
  }

  useEffect(() => {
    const hasPendingColumnFilter = (
      Object.keys(draftColumnFilters) as InvoiceColumnFilterKey[]
    ).some(
      (key) =>
        key !== "agencyId" && draftColumnFilters[key] !== columnFilters[key]
    )

    if (!hasPendingColumnFilter) return

    const timeoutId = window.setTimeout(() => {
      setColumnFilters((current) => {
        const nextFilters = { ...draftColumnFilters }
        // Giữ agency theo URL/server, tránh debounce ghi đè gây loop
        if (onAgencyFilterChange) {
          nextFilters.agencyId = current.agencyId
        }
        return nextFilters
      })
      setPage(1)
      if (!onAgencyFilterChange) {
        pagination?.onPageChange(1)
      }
    }, 500)

    return () => window.clearTimeout(timeoutId)
    // Không phụ thuộc `pagination` (object mới mỗi render từ parent → loop)
  }, [columnFilters, draftColumnFilters, onAgencyFilterChange])

  const handleApplyFilters = () => {
    setFromDate(draftFromDate)
    setToDate(draftToDate)
    setExportStatusFilter(draftExportStatusFilter)
    setOrderCreateFilter(draftOrderCreateFilter)
    handleAgencySelectChange(draftAgencyFilter)
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
    let cancelled = false

    void (async () => {
      try {
        const response = await APIGetAllAgencies()
        if (cancelled) return
        setAgencyCatalog(Array.isArray(response.data) ? response.data : [])
      } catch {
        if (!cancelled) setAgencyCatalog([])
      }
    })()

    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (searchKeyword === undefined) return
    setKeyword(searchKeyword)
  }, [searchKeyword])

  useEffect(() => {
    if (agencyFilterId === undefined) return

    const nextAgencyId = agencyFilterId.trim()

    setAgencyFilter((current) =>
      current === nextAgencyId ? current : nextAgencyId
    )
    setDraftAgencyFilter((current) =>
      current === nextAgencyId ? current : nextAgencyId
    )
    setColumnFilters((current) =>
      current.agencyId === nextAgencyId
        ? current
        : { ...current, agencyId: nextAgencyId }
    )
    setDraftColumnFilters((current) =>
      current.agencyId === nextAgencyId
        ? current
        : { ...current, agencyId: nextAgencyId }
    )
  }, [agencyFilterId])

  useEffect(() => {
    if (!onSearchKeywordChange) return

    const nextKeyword = keyword.trim()
    const currentKeyword = (searchKeyword ?? "").trim()

    if (nextKeyword === currentKeyword) return

    const timeoutId = window.setTimeout(() => {
      onSearchKeywordChange(keyword)
    }, 400)

    return () => window.clearTimeout(timeoutId)
  }, [keyword, onSearchKeywordChange, searchKeyword])

  useEffect(() => {
    if (!onSearchKeywordChange) return

    const textValues = (
      Object.entries(columnFilters) as [InvoiceColumnFilterKey, string][]
    )
      .filter(
        ([key, value]) => value.trim() && !EXACT_MATCH_COLUMN_KEYS.has(key)
      )
      .map(([, value]) => value.trim())

    // Exact-match (agencyId,...) khong duoc ghi de / xoa search keyword
    if (textValues.length === 0) return

    const nextKeyword = textValues[textValues.length - 1]

    setKeyword((current) =>
      current.trim() === nextKeyword ? current : nextKeyword
    )
  }, [columnFilters, onSearchKeywordChange])

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
    const searchValue = normalizeFilterText(keyword)

    return rows.filter((invoice) => {
      const firstItem = invoice.items?.[0]
      const product = firstItem?.productId

      const invoiceStatus = invoiceHelper.getInvoiceStatus(invoice)
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
      const normalizedSearchText = normalizeFilterText(searchText)

      const matchKeyword =
        isServerSearch || !searchValue
          ? true
          : normalizedSearchText.includes(searchValue)

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

      const matchAgency =
        onAgencyFilterChange || !agencyFilter ? true : agencyId === agencyFilter

      const paymentState = getInvoicePaymentState(invoice)
      const paidDate = paymentState.isCollected
        ? invoiceHelper.normalizeDateInput(
            invoice.paidDate || invoice.paymentDate || ""
          )
        : ""
      const columnValues: Record<InvoiceColumnFilterKey, string> = {
        createdAt: invoiceHelper.normalizeDateInput(
          String(invoice.createdAt || "")
        ),
        activationDate: invoiceHelper.normalizeDateInput(
          invoice.activationDate || ""
        ),
        invoiceNumber: String(invoice.invoiceNumber || ""),
        inv_invoiceIssuedDate: invoiceDate,
        orderCreateStatus: getInvoiceCreationStatus(invoice),
        exportInvoiceStatus: invoiceStatus,
        agencyId,
        inv_buyerTaxCode: String(invoice.inv_buyerTaxCode || ""),
        companyName: String(
          invoice.inv_buyerLegalName || invoice.inv_buyerDisplayName || ""
        ),
        orderNumber: String(invoice.orderNumber || ""),
        productName: getProductName(product),
        inv_TotalAmountWithoutVAT: MONEY_FORMATTER.format(
          Number(invoice.inv_TotalAmount || 0)
        ),
        inv_TotalAmount: MONEY_FORMATTER.format(
          getInvoiceExportedAmount(invoice)
        ),
        paid: paymentState.isCollected ? "collected" : "not_collected",
        paidDate,
        amountCollected: MONEY_FORMATTER.format(paymentState.paidAmount),
        paidAmount: MONEY_FORMATTER.format(paymentState.remainingAmount),
      }
      const matchColumnFilters = (
        Object.entries(columnFilters) as [InvoiceColumnFilterKey, string][]
      ).every(([key, filterValue]) => {
        if (!filterValue) return true

        // Dai ly da loc phia BE qua agencyId, khong loc lai o client
        if (key === "agencyId" && onAgencyFilterChange) {
          return true
        }

        // Text text đã gửi lên BE (search); chỉ giữ exact-match ở client
        if (isServerSearch && !EXACT_MATCH_COLUMN_KEYS.has(key)) {
          return true
        }

        const normalizedCellValue = normalizeFilterText(columnValues[key])
        const normalizedFilterValue = normalizeFilterText(filterValue)

        if (EXACT_MATCH_COLUMN_KEYS.has(key)) {
          return normalizedCellValue === normalizedFilterValue
        }

        if (normalizedCellValue.includes(normalizedFilterValue)) return true

        const numericFilterValue = normalizedFilterValue.replace(/\D/g, "")

        return (
          /^[\d\s.,-]+$/.test(normalizedFilterValue) &&
          numericFilterValue.length > 0 &&
          normalizedCellValue.replace(/\D/g, "").includes(numericFilterValue)
        )
      })

      return (
        matchKeyword &&
        matchFromDate &&
        matchToDate &&
        matchExportStatus &&
        matchOrderCreate &&
        matchAgency &&
        matchColumnFilters
      )
    })
  }, [
    rows,
    isServerSearch,
    keyword,
    fromDate,
    toDate,
    exportStatusFilter,
    orderCreateFilter,
    agencyFilter,
    columnFilters,
    onAgencyFilterChange,
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
    columnFilters,
  ])
  const totalItems = pagination?.totalItems ?? filteredRows.length
  const totalPages = Math.max(Math.ceil(totalItems / effectivePageSize), 1)
  const safePage = Math.min(effectivePage, totalPages)
  const startIndex = (safePage - 1) * effectivePageSize
  const pageRows = isExternalPagination
    ? filteredRows
    : filteredRows.slice(startIndex, startIndex + effectivePageSize)
  const enableBulkSelection = Boolean(onSelectedRowIdsChange)
  const displayTotalCount = isExternalPagination
    ? totalItems
    : filteredRows.length

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

  const renderColumnFilter = (
    key: InvoiceColumnFilterKey,
    label: string,
    config?: Pick<InvoiceColumnFilterControlProps, "inputType" | "options">
  ) => (
    <InvoiceColumnFilterControl
      id={`invoice-column-filter-${key}`}
      label={label}
      value={draftColumnFilters[key]}
      appliedValue={columnFilters[key]}
      onChange={(value) => handleDraftColumnFilterChange(key, value)}
      onApply={(value) => handleApplyColumnFilter(key, value)}
      inputType={config?.inputType}
      options={config?.options}
    />
  )

  const columns: DataTableColumn<InvoiceApiRow>[] = [
    {
      key: "activationDate",
      title: "Ngày kích hoạt",
      filter: renderColumnFilter("activationDate", "Ngày kích hoạt", {
        inputType: "date",
      }),
      className: "whitespace-nowrap text-center min-w-[150px]",
      headerClassName: "text-center",
      render: (invoice) => {
        return formatDisplayDate(invoice.activationDate)
      },
    },
    // {
    //   key: "createdAt",
    //   title: "Ngày tạo",
    //   filter: renderColumnFilter("createdAt", "Ngày tạo", {
    //     inputType: "date",
    //   }),
    //   className: "whitespace-nowrap text-center min-w-[150px]",
    //   headerClassName: "text-center",
    //   render: (invoice) => {
    //     const value = invoice.createdAt

    //     if (!value) return "-"

    //     const textValue = String(value).trim()
    //     const match = textValue.match(/^(\d{2})\/(\d{2})\/(\d{4})/)

    //     if (match) return `${match[1]}/${match[2]}/${match[3]}`

    //     const date = new Date(textValue)

    //     if (!Number.isNaN(date.getTime())) {
    //       return new Intl.DateTimeFormat("vi-VN", {
    //         day: "2-digit",
    //         month: "2-digit",
    //         year: "numeric",
    //       }).format(date)
    //     }

    //     return textValue
    //   },
    // },

    {
      key: "invoiceNumber",
      title: "Số hoá đơn",
      filter: renderColumnFilter("invoiceNumber", "Số hoá đơn"),
      className: "whitespace-nowrap text-center min-w-[150px] ",
      headerClassName: "text-center",
      render: (invoice) => invoice.invoiceNumber || "-",
    },
    {
      key: "inv_invoiceIssuedDate",
      title: "Ngày xuất HĐ",
      filter: renderColumnFilter("inv_invoiceIssuedDate", "Ngày xuất HĐ", {
        inputType: "date",
      }),
      className: "whitespace-nowrap text-center min-w-[150px]",
      headerClassName: "text-center",
      render: (invoice) => {
        return formatDisplayDate(invoice.inv_invoiceIssuedDate)
      },
    },
    {
      key: "orderCreateStatus",
      title: "Trạng thái tạo",
      filter: renderColumnFilter("orderCreateStatus", "Trạng thái tạo", {
        options: [
          { value: "created", label: "Đã tạo" },
          { value: "not_created", label: "Chưa tạo" },
          { value: "cancelled", label: "Đã huỷ" },
        ],
      }),
      className: "whitespace-nowrap text-center min-w-[150px]",
      headerClassName: "text-center",
      render: (invoice) => {
        const creationStatus = getInvoiceCreationStatus(invoice)
        const isCancelled = creationStatus === "cancelled"
        const isCreated = creationStatus === "created"

        return (
          <span
            className={`inline-flex min-w-[90px] justify-center rounded-full border px-2.5 py-1 text-xs font-semibold ${
              isCancelled
                ? "border-red-200 bg-red-50 text-red-700"
                : isCreated
                  ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                  : "border-slate-200 bg-slate-50 text-slate-600"
            }`}
          >
            {isCancelled ? "Đã huỷ" : isCreated ? "Đã tạo" : "Chưa tạo"}
          </span>
        )
      },
    },
    {
      key: "exportInvoiceStatus",
      title: "Trạng thái xuất HĐ",
      filter: renderColumnFilter("exportInvoiceStatus", "Trạng thái xuất HĐ", {
        options: [
          { value: InvoiceStatus.DRAFT, label: "Nháp" },
          { value: InvoiceStatus.ISSUING, label: "Đang xuất hóa đơn" },
          { value: InvoiceStatus.ISSUED, label: "Đã xuất hóa đơn" },
          { value: InvoiceStatus.FAILED, label: "Xuất thất bại" },
          { value: InvoiceStatus.CANCELLED, label: "Đã huỷ" },
        ],
      }),
      className: "whitespace-nowrap text-center min-w-[160px]",
      headerClassName: "text-center",
      render: (invoice) => {
        const status = invoiceHelper.getInvoiceStatus(invoice)

        return (
          <span
            className={`inline-flex min-w-[110px] justify-center rounded-full border px-2.5 py-1 text-xs font-semibold ${invoiceHelper.invoiceStatusClass[status]}`}
          >
            {getInvoiceStatusDisplayLabel(invoice)}
          </span>
        )
      },
    },
    {
      key: "agencyId",
      title: "Tên Đại lý",
      filter: renderColumnFilter("agencyId", "Tên Đại lý", {
        options: agencyOptions,
      }),
      className: "min-w-[180px] text-left",
      headerClassName: "text-center",
      render: (invoice) => getAgencyName(invoice.agencyId) || "-",
    },
    {
      key: "inv_buyerTaxCode",
      title: "MST",
      filter: renderColumnFilter("inv_buyerTaxCode", "MST"),
      className: "whitespace-nowrap min-w-[140px]",
      render: (invoice) => invoice.inv_buyerTaxCode || "-",
    },
    {
      key: "companyName",
      title: "Tên công ty",
      filter: renderColumnFilter("companyName", "Tên công ty"),
      className: "min-w-[320px] max-w-[420px] text-left",
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
      filter: renderColumnFilter("orderNumber", "Số đơn hàng"),
      className: "whitespace-nowrap text-center min-w-[160px]",
      headerClassName: "text-center",
      render: (invoice) => invoice.orderNumber || "-",
    },
    {
      key: "productName",
      title: "Tên SP",
      filter: renderColumnFilter("productName", "Tên SP"),
      headerClassName: "text-center",
      className: "min-w-[200px] text-left",
      render: (invoice) => getProductName(invoice.items?.[0]?.productId) || "-",
    },
    {
      key: "inv_TotalAmountWithoutVAT",
      title: "Tổng giá trị",
      filter: renderColumnFilter("inv_TotalAmountWithoutVAT", "Tổng giá trị"),
      className: "whitespace-nowrap min-w-[150px] text-right ",
      headerClassName: "text-center",
      render: (invoice) =>
        MONEY_FORMATTER.format(Number(invoice.inv_TotalAmount || 0)),
    },
    {
      key: "inv_TotalAmount",
      title: "Tổng xuất HĐ",
      filter: renderColumnFilter("inv_TotalAmount", "Tổng xuất HĐ"),
      className: "whitespace-nowrap text-right min-w-[120px] ",
      headerClassName: "text-center",
      render: (invoice) =>
        MONEY_FORMATTER.format(getInvoiceExportedAmount(invoice)),
    },

    {
      key: "paid",
      title: "Thu tiền",
      filter: renderColumnFilter("paid", "Thu tiền", {
        options: [
          { value: "collected", label: "Đã thu" },
          { value: "not_collected", label: "Chưa thu" },
        ],
      }),
      className: "min-w-[120px] text-center",
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
      filter: renderColumnFilter("paidDate", "Ngày thu tiền", {
        inputType: "date",
      }),
      className: "whitespace-nowrap text-center min-w-[150px]",
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
      filter: renderColumnFilter("amountCollected", "Số tiền thu"),
      className: "whitespace-nowrap text-right min-w-[120px] ",
      headerClassName: "text-center",
      render: (invoice) =>
        MONEY_FORMATTER.format(getInvoicePaymentState(invoice).paidAmount),
    },
    {
      key: "paidAmount",
      title: "Số tiền chênh lệch",
      filter: renderColumnFilter("paidAmount", "Số tiền chênh lệch"),
      className: "whitespace-nowrap text-right min-w-[150px] ",
      headerClassName: "text-center",
      render: (invoice) => {
        const remainingAmount = getInvoicePaymentState(invoice).remainingAmount

        return (
          <span className={remainingAmount < 0 ? "text-rose-600" : ""}>
            {MONEY_FORMATTER.format(remainingAmount)}
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
                            label: "Đã huỷ",
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
                        searchPlaceholder="Tìm đại lý..."
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
                      Tổng đơn hàng: {displayTotalCount}
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

          <div className="ml-auto flex items-center gap-2 text-sm text-slate-500">
            {loading && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700 ring-1 ring-blue-100">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Đang tìm...
              </span>
            )}
            Tổng:{" "}
            <span className="font-semibold text-slate-800">
              {displayTotalCount}
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
        enableVerticalDragScroll
        onView={onView}
        onEdit={onEdit}
        canEdit={(invoice) => {
          const status = invoiceHelper.getInvoiceStatus(invoice)

          return ![InvoiceStatus.ISSUING, InvoiceStatus.CANCELLED].includes(
            status
          )
        }}
        renderActions={(invoice) => {
          const status = invoiceHelper.getInvoiceStatus(invoice)
          const isExporting = exportingInvoiceId === invoice._id
          const isUpdatingMInvoice = updatingMInvoiceId === invoice._id
          const isCancellingInvoice = cancellingInvoiceId === invoice._id
          const isProcessing =
            status === InvoiceStatus.ISSUING ||
            isExporting ||
            isUpdatingMInvoice ||
            isCancellingInvoice
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
              {status !== InvoiceStatus.CANCELLED && onCopyInvoice && (
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

              {status === InvoiceStatus.DRAFT && onCancelInvoice && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    onCancelInvoice(invoice)
                  }}
                  title="Huỷ phiếu"
                  className="inline-flex h-8 items-center justify-center gap-1 rounded-lg border border-red-200 bg-red-50 px-2 text-xs font-semibold text-red-700 shadow-sm transition hover:border-red-400 hover:bg-red-100 hover:text-red-800"
                >
                  <Ban size={15} />
                </button>
              )}

              {invoiceHelper.canStartInvoiceExport(status) &&
                onExportInvoice && (
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
            {MONEY_FORMATTER.format(summary.totalBeforeTax)}
          </div>
        </div>

        <div>
          <div className="text-xs text-slate-500">Tiền thuế</div>
          <div className="font-bold text-slate-800">
            {MONEY_FORMATTER.format(summary.vatAmount)}
          </div>
        </div>

        <div>
          <div className="text-xs text-slate-500">Tổng xuất HĐ</div>
          <div className="font-bold text-slate-800">
            {MONEY_FORMATTER.format(summary.totalAmount)}
          </div>
        </div>

        <div>
          <div className="text-xs text-slate-500">DT MINVOICE</div>
          <div className="font-bold text-slate-800">
            {MONEY_FORMATTER.format(summary.minvoiceRevenue)}
          </div>
        </div>

        <div>
          <div className="text-xs text-slate-500">Đã thu</div>
          <div className="font-bold text-emerald-700">
            {MONEY_FORMATTER.format(summary.paidAmount)}
          </div>
        </div>

        <div>
          <div className="text-xs text-slate-500">Còn lại</div>
          <div
            className={`font-bold ${
              summary.remainingAmount < 0 ? "text-rose-600" : "text-amber-700"
            }`}
          >
            {MONEY_FORMATTER.format(summary.remainingAmount)}
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
        pageSizeOptions={pagination?.pageSizeOptions ?? [50, 100, 200, 300]}
        syncUrl={pagination?.syncUrl}
      />
    </div>
  )
}
