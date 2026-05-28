"use client"

import { useEffect, useMemo, useState } from "react"
import { createPortal } from "react-dom"
import { InvoiceApiRow, InvoiceStatus } from "@/types/invoice"
import DataTable, { DataTableColumn } from "../common/Datatable"
import {
  FileText,
  HandCoins,
  Loader2,
  Printer,
  SlidersHorizontal,
  X,
} from "lucide-react"
import Pagination from "../pagination/Pagination"
import * as invoiceHelper from "@/utils/invoice"
import { ToolbarButton } from "./InvoiceToolbar"
type Props = {
  rows: InvoiceApiRow[]
  loading?: boolean
  onEdit?: (row: InvoiceApiRow) => void
  onView?: (row: InvoiceApiRow) => void
  onDelete?: (row: InvoiceApiRow) => void
  onExportInvoice?: (row: InvoiceApiRow) => void | Promise<void>
  exportingInvoiceId?: string | null
  onViewMInvoicePdf?: (row: InvoiceApiRow) => void
  onCollectPayment?: (row: InvoiceApiRow) => void
}

type InvoiceProductValue =
  | NonNullable<InvoiceApiRow["items"]>[number]["productId"]
  | NonNullable<InvoiceApiRow["items"]>[number]["product"]

export default function InvoiceDataTable({
  rows,
  loading = false,
  onEdit,
  onView,
  onExportInvoice,
  exportingInvoiceId = null,
  onViewMInvoicePdf,
  onCollectPayment,
}: Props) {
  const [keyword, setKeyword] = useState("")
  const [filterOpen, setFilterOpen] = useState(false)
  const [mounted, setMounted] = useState(false)

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
  const [pageSize, setPageSize] = useState(50)

  const invoiceStatusLabel = invoiceHelper.invoiceStatusLabel
  const invoiceStatusClass = invoiceHelper.invoiceStatusClass
  const getInvoiceStatus = invoiceHelper.getInvoiceStatus
  const canStartInvoiceExport = invoiceHelper.canStartInvoiceExport
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

  const getProductCode = (product: InvoiceProductValue) => {
    if (!product || typeof product === "string") return ""
    return String(product.inv_itemCode || "")
  }

  const getProductName = (product: InvoiceProductValue) => {
    if (!product || typeof product === "string") return ""
    return String(product.inv_itemName || "")
  }

  const getInvoicePaymentState = (invoice: InvoiceApiRow) => {
    const totalAmount = invoiceHelper.toNumber(invoice.inv_TotalAmount)

    const amountCollected = invoiceHelper.toNumber(
      invoice.amountCollected ?? invoice.paidAmount ?? 0
    )

    const remainingAmount = Math.max(totalAmount - amountCollected, 0)

    return {
      isPaid: Boolean(invoice.isPaid || amountCollected > 0),
      paidAmount: amountCollected,
      remainingAmount,
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
        invoiceStatusLabel[invoiceStatus],
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
    setPage(1)
  }, [
    rows,
    keyword,
    fromDate,
    toDate,
    exportStatusFilter,
    orderCreateFilter,
    agencyFilter,
  ])
  const totalPages = Math.max(Math.ceil(filteredRows.length / pageSize), 1)
  const safePage = Math.min(page, totalPages)
  const startIndex = (safePage - 1) * pageSize
  const pageRows = filteredRows.slice(startIndex, startIndex + pageSize)

  const summary = useMemo(() => {
    return filteredRows.reduce(
      (acc, invoice) => {
        const totalAmount = Number(invoice.inv_TotalAmount || 0)
        const totalBeforeTax = Number(invoice.inv_TotalAmountWithoutVAT || 0)
        const vatAmount = Number(invoice.inv_vatAmount || 0)
        const paymentState = getInvoicePaymentState(invoice)

        const itemRevenue =
          invoice.items?.reduce((sum, item) => {
            return sum + Number(item.revenue || 0)
          }, 0) || 0

        acc.totalAmount += totalAmount
        acc.totalBeforeTax += totalBeforeTax
        acc.vatAmount += vatAmount
        acc.paidAmount += paymentState.paidAmount
        acc.remainingAmount += paymentState.remainingAmount
        acc.minvoiceRevenue += Number(
          invoice.minvoiceRevenue || itemRevenue || 0
        )

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
      key: "month",
      title: "Tháng",
      className: "whitespace-nowrap text-center",
      headerClassName: "text-center",
      render: (invoice) => {
        const value = invoice.inv_invoiceIssuedDate || ""
        const match = value.match(/^(\d{2})\/(\d{2})\/(\d{4})/)

        if (match) return `${match[2]}/${match[3]}`

        const date = new Date(value)

        if (!Number.isNaN(date.getTime())) {
          return `${String(date.getMonth() + 1).padStart(
            2,
            "0"
          )}/${date.getFullYear()}`
        }

        return "-"
      },
    },
    {
      key: "inv_invoiceIssuedDate",
      title: "Ngày HĐ",
      className: "whitespace-nowrap text-center",
      headerClassName: "text-center",
      render: (invoice) => {
        const value = invoice.inv_invoiceIssuedDate

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
    // {
    //   key: "inv_invoiceSeries",
    //   title: "Ký hiệu HĐ",
    //   className: "whitespace-nowrap text-center min-w-[100px] ",
    //   headerClassName: "text-center",
    //   render: (invoice) => invoice.inv_invoiceSeries || "-",
    // },
    {
      key: "invoiceNumber",
      title: "Số hoá đơn",
      className: "whitespace-nowrap text-center min-w-[130px] ",
      headerClassName: "text-center",
      render: (invoice) => invoice.invoiceNumber || "-",
    },
    {
      key: "exportInvoiceStatus",
      title: "Trạng thái xuất HĐ",
      className: "whitespace-nowrap text-center",
      headerClassName: "text-center",
      render: (invoice) => {
        const status = getInvoiceStatus(invoice)

        return (
          <div className="flex flex-col items-center gap-1">
            <span
              className={`inline-flex min-w-[150px] justify-center rounded-full border px-2.5 py-1 text-xs font-semibold ${invoiceStatusClass[status]}`}
            >
              {invoiceStatusLabel[status]}
            </span>
          </div>
        )
      },
    },
    // {
    //   key: "agencyId",
    //   title: "Đại lý",
    //   className: "min-w-[130px]",
    //   render: (invoice) => getAgencyName(invoice.agencyId) || "-",
    // },
    // {
    //   key: "departmentId",
    //   title: "Phòng ban",
    //   className: "min-w-[150px]",
    //   render: (invoice) => getDepartmentName(invoice.departmentId) || "-",
    // },
    // {
    //   key: "employeeId",
    //   title: "NVKD",
    //   className: "min-w-[160px]",
    //   render: (invoice) => getEmployeeName(invoice.employeeId) || "-",
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
      className: "min-w-[150px]",
      render: (invoice) =>
        invoice.inv_buyerLegalName || invoice.inv_buyerDisplayName || "-",
    },
    {
      key: "inv_quantity",
      title: "SL",
      className: "text-center",
      headerClassName: "text-center",
      render: (invoice) => Number(invoice.inv_quantity || 0),
    },
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
      className: "min-w-[150px]",
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
    // {
    //   key: "inv_vatAmount",
    //   title: "Tiền thuế",
    //   className: "whitespace-nowrap text-right ",
    //   headerClassName: "text-right",
    //   render: (invoice) =>
    //     moneyFormatter.format(Number(invoice.inv_vatAmount || 0)),
    // },
    {
      key: "inv_TotalAmount",
      title: "Tổng xuất HĐ",
      className: "whitespace-nowrap text-right min-w-[120px] ",
      headerClassName: "text-right",
      render: (invoice) =>
        moneyFormatter.format(Number(invoice.inv_TotalAmount || 0)),
    },
    // {
    //   key: "commissionRate",
    //   title: "%HH",
    //   className: "text-center font-semibold",
    //   headerClassName: "text-center",
    //   render: (invoice) => `${getAgencyCommissionPercent(invoice.agencyId)}%`,
    // },
    // {
    //   key: "commissionAmount",
    //   title: "HH",
    //   className: "whitespace-nowrap text-right font-semibold",
    //   headerClassName: "text-right",
    //   render: (invoice) => {
    //     const amount =
    //       (Number(invoice.inv_TotalAmountWithoutVAT || 0) *
    //         getAgencyCommissionPercent(invoice.agencyId)) /
    //       100

    //     return moneyFormatter.format(amount)
    //   },
    // },
    // {
    //   key: "minvoiceRevenue",
    //   title: "DT MINVOICE",
    //   className: "whitespace-nowrap text-right font-semibold",
    //   headerClassName: "text-right",
    //   render: (invoice) => {
    //     const itemRevenue =
    //       invoice.items?.reduce((sum, item) => {
    //         return sum + Number(item.revenue || 0)
    //       }, 0) || 0

    //     return moneyFormatter.format(
    //       Number(invoice.minvoiceRevenue || itemRevenue || 0)
    //     )
    //   },
    // },
    {
      key: "paid",
      title: "Thu tiền",
      className: "text-center",
      headerClassName: "text-center",
      render: (invoice) => {
        const { isPaid } = getInvoicePaymentState(invoice)

        return (
          <span
            className={`inline-flex min-w-[82px] justify-center rounded-xl px-2 py-1 text-xs font-semibold ${
              isPaid
                ? "bg-emerald-100 text-emerald-700"
                : "bg-amber-100 text-amber-700"
            }`}
          >
            {isPaid ? "Đã thu" : "Chưa thu"}
          </span>
        )
      },
    },
    {
      key: "paidAmount",
      title: "Số tiền thu",
      className: "whitespace-nowrap text-right min-w-[120px] ",
      headerClassName: "text-right",
      render: (invoice) =>
        moneyFormatter.format(getInvoicePaymentState(invoice).remainingAmount),
    },
    // {
    //   key: "remainingAmount",
    //   title: "Còn lại",
    //   className: "whitespace-nowrap text-right ",
    //   headerClassName: "text-right",
    //   render: (invoice) =>
    //     moneyFormatter.format(getInvoicePaymentState(invoice).remainingAmount),
    // },
    // {
    //   key: "note",
    //   title: "Ghi chú",
    //   className: "min-w-[220px]",
    //   render: (invoice) => invoice.note || "-",
    // },
  ]

  return (
    <div className="mx-4 flex min-h-0 flex-1 flex-col gap-3 bg-white p-3">
      {filterToolbarSlot &&
        createPortal(
          <div className="relative">
            <ToolbarButton
              onClick={handleToggleFilter}
              variant={filterOpen || hasActiveFilters ? "primary" : "default"}
              disabled={loading}
            >
              <SlidersHorizontal size={16} />
            </ToolbarButton>

            {filterOpen && (
              <div className="absolute left-0 top-[calc(100%+8px)] z-[999] w-[560px] max-w-[calc(100vw-32px)] rounded-lg border border-slate-200 bg-white p-6 shadow-xl">
                <div className="grid gap-4">
                  <div className="grid gap-2 sm:grid-cols-[170px_1fr] sm:items-center">
                    <label className="text-sm font-medium text-slate-700">
                      Từ ngày
                    </label>
                    <input
                      type="date"
                      value={draftFromDate}
                      onChange={(e) => setDraftFromDate(e.target.value)}
                      className="h-11 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                    />
                  </div>

                  <div className="grid gap-2 sm:grid-cols-[170px_1fr] sm:items-center">
                    <label className="text-sm font-medium text-slate-700">
                      Đến ngày
                    </label>
                    <input
                      type="date"
                      value={draftToDate}
                      onChange={(e) => setDraftToDate(e.target.value)}
                      className="h-11 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                    />
                  </div>

                  <div className="grid gap-2 sm:grid-cols-[170px_1fr] sm:items-center">
                    <label className="text-sm font-medium text-slate-700">
                      Trạng thái xuất hóa đơn
                    </label>
                    <select
                      value={draftExportStatusFilter}
                      onChange={(e) =>
                        setDraftExportStatusFilter(e.target.value)
                      }
                      className="h-11 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                    >
                      <option value="">Tất cả</option>
                      <option value={InvoiceStatus.DRAFT}>Nháp</option>
                      <option value={InvoiceStatus.ISSUING}>
                        Đang xuất hóa đơn
                      </option>
                      <option value={InvoiceStatus.ISSUED}>
                        Đã xuất hóa đơn
                      </option>
                      <option value={InvoiceStatus.FAILED}>
                        Xuất thất bại
                      </option>
                      <option value={InvoiceStatus.CANCELLED}>Đã hủy</option>
                    </select>
                  </div>

                  <div className="grid gap-2 sm:grid-cols-[170px_1fr] sm:items-center">
                    <label className="text-sm font-medium text-slate-700">
                      Trạng thái tạo đơn hàng
                    </label>
                    <select
                      value={draftOrderCreateFilter}
                      onChange={(e) =>
                        setDraftOrderCreateFilter(e.target.value)
                      }
                      className="h-11 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                    >
                      <option value="">Tất cả</option>
                      <option value="created">Đã tạo đơn hàng</option>
                      <option value="not_created">Chưa tạo đơn hàng</option>
                    </select>
                  </div>

                  <div className="grid gap-2 sm:grid-cols-[170px_1fr] sm:items-center">
                    <label className="text-sm font-medium text-slate-700">
                      Đại lý
                    </label>
                    <select
                      value={draftAgencyFilter}
                      onChange={(e) => setDraftAgencyFilter(e.target.value)}
                      className="h-11 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                    >
                      <option value="">Tất cả đại lý</option>
                      {agencyOptions.map((agency) => (
                        <option key={agency.value} value={agency.value}>
                          {agency.label}
                        </option>
                      ))}
                    </select>
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
              </div>
            )}
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
        onView={onView}
        onEdit={onEdit}
        canEdit={(invoice) => {
          const status = getInvoiceStatus(invoice)

          return ![
            InvoiceStatus.ISSUED,
            InvoiceStatus.ISSUING,
            InvoiceStatus.CANCELLED,
          ].includes(status)
        }}
        renderActions={(invoice) => {
          const status = getInvoiceStatus(invoice)
          const isExporting = exportingInvoiceId === invoice._id
          const isProcessing = status === InvoiceStatus.ISSUING || isExporting

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

          if (canStartInvoiceExport(status) && onExportInvoice) {
            return (
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
            )
          }

          if (status !== InvoiceStatus.ISSUED) return null

          return (
            <>
              {onCollectPayment && (
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
          <div className="font-bold text-amber-700">
            {moneyFormatter.format(summary.remainingAmount)}
          </div>
        </div>
      </div>

      <Pagination
        currentPage={safePage}
        setCurrentPage={setPage}
        totalItem={filteredRows.length}
        itemPerPage={pageSize}
        setItemPerPage={(nextPageSize) => {
          setPage(1)
          setPageSize(nextPageSize)
        }}
        pageSizeOptions={[10, 20, 50, 100]}
      />
    </div>
  )
}
