"use client"

import { useMemo, useState } from "react"
import type { InvoiceApiRow } from "@/types/invoice"
import DataTable, { DataTableColumn } from "../common/Datatable"
import { Printer } from "lucide-react"

type Props = {
  rows: InvoiceApiRow[]
  loading?: boolean
  onEdit?: (row: InvoiceApiRow) => void
  onView?: (row: InvoiceApiRow) => void
  onDelete?: (row: InvoiceApiRow) => void
  onViewMInvoicePdf?: (row: InvoiceApiRow) => void
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

function getProductCode(product: any) {
  if (!product || typeof product === "string") return ""
  return String(product.inv_itemCode || "")
}

function getProductName(product: any) {
  if (!product || typeof product === "string") return ""
  return String(product.inv_itemName || "")
}

function getAgencyCommissionPercent(agency: InvoiceApiRow["agencyId"]) {
  if (!agency || typeof agency === "string") return 0
  return Number(agency.commissionPercent || 0)
}

export default function InvoiceDataTable({
  rows,
  loading = false,
  onEdit,
  onView,
  onViewMInvoicePdf,
}: Props) {
  const [keyword, setKeyword] = useState("")
  const [paidFilter, setPaidFilter] = useState("")
  const [exportFilter, setExportFilter] = useState("")
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)

  const moneyFormatter = useMemo(() => {
    return new Intl.NumberFormat("vi-VN")
  }, [])

  const filteredRows = useMemo(() => {
    const searchValue = keyword.trim().toLowerCase()

    return rows.filter((invoice) => {
      const firstItem = invoice.items?.[0]
      const product = firstItem?.productId

      const exported = Boolean(invoice.inv_invoiceCreatedId)

      const searchText = [
        invoice.inv_invoiceSeries,
        invoice.orderNumber,
        invoice.inv_invoiceIssuedDate,
        getAgencyName(invoice.agencyId),
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
        exported ? "đã tạo" : "chưa tạo",
        invoice.note,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()

      const paidStatus =
        invoice.isPaid || Number(invoice.paidAmount || 0) > 0
          ? "paid"
          : "unpaid"

      const exportStatus = exported ? "exported" : "not_exported"

      const matchKeyword = searchValue ? searchText.includes(searchValue) : true
      const matchPaid = paidFilter ? paidStatus === paidFilter : true
      const matchExport = exportFilter ? exportStatus === exportFilter : true

      return matchKeyword && matchPaid && matchExport
    })
  }, [rows, keyword, paidFilter, exportFilter])

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
        const paidAmount = Number(invoice.paidAmount || 0)

        const remainingAmount =
          invoice.remainingAmount !== undefined
            ? Number(invoice.remainingAmount || 0)
            : Math.max(totalAmount - paidAmount, 0)

        const itemRevenue =
          invoice.items?.reduce((sum, item) => {
            return sum + Number(item.revenue || 0)
          }, 0) || 0

        acc.totalAmount += totalAmount
        acc.totalBeforeTax += totalBeforeTax
        acc.vatAmount += vatAmount
        acc.paidAmount += paidAmount
        acc.remainingAmount += remainingAmount
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
    {
      key: "exportInvoiceStatus",
      title: "Trạng thái xuất HĐ",
      className: "whitespace-nowrap text-center",
      headerClassName: "text-center",
      render: (invoice) => {
        const exported = Boolean(invoice.inv_invoiceCreatedId)

        return (
          <div className="flex flex-col items-center gap-1">
            <span
              className={`inline-flex min-w-[92px] justify-center rounded-full border px-2.5 py-1 text-xs font-semibold ${
                exported
                  ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                  : "border-slate-200 bg-slate-50 text-slate-600"
              }`}
            >
              {exported ? "Đã tạo" : "Chưa tạo"}
            </span>
          </div>
        )
      },
    },
    {
      key: "agencyId",
      title: "Đại lý",
      className: "min-w-[180px]",
      render: (invoice) => getAgencyName(invoice.agencyId) || "-",
    },
    {
      key: "departmentId",
      title: "Phòng ban",
      className: "min-w-[150px]",
      render: (invoice) => getDepartmentName(invoice.departmentId) || "-",
    },
    {
      key: "employeeId",
      title: "NVKD",
      className: "min-w-[160px]",
      render: (invoice) => getEmployeeName(invoice.employeeId) || "-",
    },
    {
      key: "inv_buyerTaxCode",
      title: "MST",
      className: "whitespace-nowrap",
      render: (invoice) => invoice.inv_buyerTaxCode || "-",
    },
    {
      key: "companyName",
      title: "Tên công ty",
      className: "min-w-[260px]",
      render: (invoice) =>
        invoice.inv_buyerLegalName || invoice.inv_buyerDisplayName || "-",
    },
    {
      key: "inv_quantity",
      title: "SL",
      className: "text-center font-semibold",
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
      className: "min-w-[220px]",
      render: (invoice) =>
        getProductName(invoice.items?.[0]?.productId) || "-",
    },
    {
      key: "inv_TotalAmountWithoutVAT",
      title: "Tổng giá trị",
      className: "whitespace-nowrap text-right font-semibold",
      headerClassName: "text-right",
      render: (invoice) =>
        moneyFormatter.format(Number(invoice.inv_TotalAmountWithoutVAT || 0)),
    },
    {
      key: "inv_vatAmount",
      title: "Tiền thuế",
      className: "whitespace-nowrap text-right font-semibold",
      headerClassName: "text-right",
      render: (invoice) =>
        moneyFormatter.format(Number(invoice.inv_vatAmount || 0)),
    },
    {
      key: "inv_TotalAmount",
      title: "Tổng xuất HĐ",
      className: "whitespace-nowrap text-right font-semibold",
      headerClassName: "text-right",
      render: (invoice) =>
        moneyFormatter.format(Number(invoice.inv_TotalAmount || 0)),
    },
    {
      key: "commissionRate",
      title: "%HH",
      className: "text-center font-semibold",
      headerClassName: "text-center",
      render: (invoice) => `${getAgencyCommissionPercent(invoice.agencyId)}%`,
    },
    {
      key: "commissionAmount",
      title: "HH",
      className: "whitespace-nowrap text-right font-semibold",
      headerClassName: "text-right",
      render: (invoice) => {
        const amount =
          (Number(invoice.inv_TotalAmountWithoutVAT || 0) *
            getAgencyCommissionPercent(invoice.agencyId)) /
          100

        return moneyFormatter.format(amount)
      },
    },
    {
      key: "minvoiceRevenue",
      title: "DT MINVOICE",
      className: "whitespace-nowrap text-right font-semibold",
      headerClassName: "text-right",
      render: (invoice) => {
        const itemRevenue =
          invoice.items?.reduce((sum, item) => {
            return sum + Number(item.revenue || 0)
          }, 0) || 0

        return moneyFormatter.format(
          Number(invoice.minvoiceRevenue || itemRevenue || 0)
        )
      },
    },
    {
      key: "paid",
      title: "Thu tiền",
      className: "text-center",
      headerClassName: "text-center",
      render: (invoice) => {
        const isPaid = invoice.isPaid || Number(invoice.paidAmount || 0) > 0

        return (
          <span
            className={`inline-flex min-w-[82px] justify-center rounded px-2 py-1 text-xs font-semibold ${
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
      title: "Số tiền",
      className: "whitespace-nowrap text-right font-semibold",
      headerClassName: "text-right",
      render: (invoice) =>
        moneyFormatter.format(Number(invoice.paidAmount || 0)),
    },
    {
      key: "remainingAmount",
      title: "Còn lại",
      className: "whitespace-nowrap text-right font-semibold",
      headerClassName: "text-right",
      render: (invoice) => {
        const totalAmount = Number(invoice.inv_TotalAmount || 0)
        const paidAmount = Number(invoice.paidAmount || 0)

        const remainingAmount =
          invoice.remainingAmount !== undefined
            ? Number(invoice.remainingAmount || 0)
            : Math.max(totalAmount - paidAmount, 0)

        return moneyFormatter.format(remainingAmount)
      },
    },
    {
      key: "note",
      title: "Ghi chú",
      className: "min-w-[220px]",
      render: (invoice) => invoice.note || "-",
    },
  ]

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3 bg-white p-3">
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

        <select
          className="h-9 rounded border border-slate-300 bg-white px-3 text-sm outline-none focus:border-indigo-500"
          value={paidFilter}
          onChange={(e) => {
            setPage(1)
            setPaidFilter(e.target.value)
          }}
        >
          <option value="">Tất cả thu tiền</option>
          <option value="paid">Đã thu</option>
          <option value="unpaid">Chưa thu</option>
        </select>

        <select
          className="h-9 rounded border border-slate-300 bg-white px-3 text-sm outline-none focus:border-indigo-500"
          value={exportFilter}
          onChange={(e) => {
            setPage(1)
            setExportFilter(e.target.value)
          }}
        >
          <option value="">Tất cả xuất HĐ</option>
          <option value="exported">Đã tạo HĐ</option>
          <option value="not_exported">Chưa tạo HĐ</option>
        </select>

        <div className="ml-auto text-sm text-slate-500">
          Tổng:{" "}
          <span className="font-semibold text-slate-800">
            {filteredRows.length}
          </span>{" "}
          hóa đơn
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
        renderActions={(invoice) => {
          const exported = Boolean(invoice.inv_invoiceCreatedId)

          if (!exported) return null

          return (
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
          <div className="text-amber-700 font-bold">
            {moneyFormatter.format(summary.remainingAmount)}
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3">
        <div className="text-xs text-slate-500">
          Hiển thị{" "}
          <span className="font-semibold text-slate-700">
            {filteredRows.length === 0 ? 0 : startIndex + 1}
          </span>{" "}
          -{" "}
          <span className="font-semibold text-slate-700">
            {Math.min(startIndex + pageSize, filteredRows.length)}
          </span>{" "}
          trong{" "}
          <span className="font-semibold text-slate-700">
            {filteredRows.length}
          </span>{" "}
          bản ghi
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            className="h-8 rounded border border-slate-300 px-3 text-sm disabled:opacity-40"
            disabled={safePage <= 1}
            onClick={() => setPage(1)}
          >
            «
          </button>

          <button
            type="button"
            className="h-8 rounded border border-slate-300 px-3 text-sm disabled:opacity-40"
            disabled={safePage <= 1}
            onClick={() => setPage((prev) => Math.max(prev - 1, 1))}
          >
            ‹
          </button>

          <div className="flex h-8 min-w-[34px] items-center justify-center rounded-full bg-indigo-100 px-3 text-sm font-semibold text-indigo-700">
            {safePage}
          </div>

          <button
            type="button"
            className="h-8 rounded border border-slate-300 px-3 text-sm disabled:opacity-40"
            disabled={safePage >= totalPages}
            onClick={() => setPage((prev) => Math.min(prev + 1, totalPages))}
          >
            ›
          </button>

          <button
            type="button"
            className="h-8 rounded border border-slate-300 px-3 text-sm disabled:opacity-40"
            disabled={safePage >= totalPages}
            onClick={() => setPage(totalPages)}
          >
            »
          </button>

          <select
            className="h-8 rounded border border-slate-300 bg-white px-2 text-sm"
            value={pageSize}
            onChange={(e) => {
              setPage(1)
              setPageSize(Number(e.target.value))
            }}
          >
            <option value={20}>20</option>
            <option value={50}>50</option>
            <option value={100}>100</option>
          </select>
        </div>
      </div>
    </div>
  )
}
