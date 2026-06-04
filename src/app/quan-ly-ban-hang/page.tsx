"use client"

import Link from "next/link"
import { useMemo, type ReactNode } from "react"
import {
  AlertTriangle,
  ArrowUpRight,
  BarChart3,
  Building2,
  CheckCircle2,
  Clock3,
  FileText,
  LayoutDashboard,
  Loader2,
  ReceiptText,
  RefreshCcw,
  TrendingUp,
  WalletCards,
} from "lucide-react"

import PageHeader from "@/components/header/PageHeader"
import { useAppDispatch, useAppSelector } from "@/store/hooks"
import { fetchSaleTransactionsThunk } from "@/store/slices"
import type { InvoiceApiRow } from "@/types/invoice"
import { InvoiceStatus } from "@/types/invoice"
import * as invoiceHelper from "@/utils/invoice"

type MetricTone = "blue" | "emerald" | "amber" | "rose" | "cyan" | "slate"

type MetricCardProps = {
  title: string
  value: string
  subtitle: string
  icon: ReactNode
  tone: MetricTone
}

type StatusItem = {
  label: string
  value: number
  color: string
  badgeClass: string
}

type MonthlyPoint = {
  key: string
  label: string
  count: number
  revenue: number
}

const LIST_PARAMS = {
  page: 1,
  limit: 1000,
}

const metricToneClasses: Record<MetricTone, string> = {
  blue: "border-blue-100 bg-blue-50 text-blue-700",
  emerald: "border-emerald-100 bg-emerald-50 text-emerald-700",
  amber: "border-amber-100 bg-amber-50 text-amber-700",
  rose: "border-rose-100 bg-rose-50 text-rose-700",
  cyan: "border-cyan-100 bg-cyan-50 text-cyan-700",
  slate: "border-slate-200 bg-slate-50 text-slate-700",
}

const moneyFormatter = new Intl.NumberFormat("vi-VN", {
  style: "currency",
  currency: "VND",
  maximumFractionDigits: 0,
})

const numberFormatter = new Intl.NumberFormat("vi-VN")

const monthFormatter = new Intl.DateTimeFormat("vi-VN", {
  month: "2-digit",
  year: "2-digit",
})

const dateFormatter = new Intl.DateTimeFormat("vi-VN", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
})

function formatMoney(value: number) {
  return moneyFormatter.format(value)
}

function getInvoiceTotal(row: InvoiceApiRow) {
  return invoiceHelper.toNumber(row.inv_TotalAmount)
}

function getCollectedAmount(row: InvoiceApiRow) {
  const totalAmount = getInvoiceTotal(row)

  return Math.max(
    invoiceHelper.toNumber(row.amountCollected),
    invoiceHelper.toNumber(row.paidAmount),
    row.isPaid ? totalAmount : 0
  )
}

function getInvoiceDate(row: InvoiceApiRow) {
  const normalized = invoiceHelper.normalizeDateInput(
    row.inv_invoiceIssuedDate || row.activationDate || row.createdAt || ""
  )

  if (!normalized) return null

  const date = new Date(`${normalized}T00:00:00`)
  return Number.isNaN(date.getTime()) ? null : date
}

function getInvoiceTimestamp(row: InvoiceApiRow) {
  return getInvoiceDate(row)?.getTime() || 0
}

function getMonthKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`
}

function getAgencyName(row: InvoiceApiRow) {
  const agency = row.agencyId

  if (agency && typeof agency === "object") {
    return String(agency.agencyName || "").trim() || "Chưa gán đại lý"
  }

  return "Chưa gán đại lý"
}

function MetricCard({ title, value, subtitle, icon, tone }: MetricCardProps) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase text-slate-500">
            {title}
          </p>
          <p className="mt-2 truncate text-2xl font-bold text-slate-950">
            {value}
          </p>
        </div>

        <div
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border ${metricToneClasses[tone]}`}
        >
          {icon}
        </div>
      </div>

      <p className="mt-3 text-sm font-medium text-slate-500">{subtitle}</p>
    </div>
  )
}

function ProgressRow({ item, total }: { item: StatusItem; total: number }) {
  const percent = total > 0 ? Math.round((item.value / total) * 100) : 0

  return (
    <div>
      <div className="mb-1 flex items-center justify-between gap-3 text-sm">
        <span className="font-semibold text-slate-700">{item.label}</span>
        <span className={`rounded-full px-2 py-0.5 text-xs ${item.badgeClass}`}>
          {numberFormatter.format(item.value)} · {percent}%
        </span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-slate-100">
        <div
          className={`h-full rounded-full ${item.color}`}
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  )
}

export default function Page() {
  const dispatch = useAppDispatch()
  const isAuthenticated = useAppSelector((state) => state.auth.isAuthenticated)
  const {
    items: invoices,
    loading,
    initialized,
    error,
  } = useAppSelector((state) => state.saleTransactions)

  const dashboard = useMemo(() => {
    const summary = invoices.reduce(
      (acc, row) => {
        const totalAmount = getInvoiceTotal(row)
        const collectedAmount = getCollectedAmount(row)
        const status = invoiceHelper.getInvoiceStatus(row)
        const paid = totalAmount > 0 && collectedAmount >= totalAmount
        const partial = collectedAmount > 0 && !paid

        acc.totalInvoices += 1
        acc.totalRevenue += totalAmount
        acc.collected += collectedAmount
        acc.remaining += Math.max(totalAmount - collectedAmount, 0)

        if (status === InvoiceStatus.ISSUED) acc.issued += 1
        else if (status === InvoiceStatus.DRAFT) acc.draft += 1
        else if (status === InvoiceStatus.ISSUING) acc.issuing += 1
        else if (status === InvoiceStatus.FAILED) acc.failed += 1
        else if (status === InvoiceStatus.CANCELLED) acc.cancelled += 1

        if (paid) acc.paid += 1
        else if (partial) acc.partial += 1
        else acc.unpaid += 1

        return acc
      },
      {
        totalInvoices: 0,
        totalRevenue: 0,
        collected: 0,
        remaining: 0,
        issued: 0,
        draft: 0,
        issuing: 0,
        failed: 0,
        cancelled: 0,
        paid: 0,
        partial: 0,
        unpaid: 0,
      }
    )

    const collectionRate =
      summary.totalRevenue > 0
        ? Math.min((summary.collected / summary.totalRevenue) * 100, 100)
        : 0
    const averageInvoice =
      summary.totalInvoices > 0
        ? summary.totalRevenue / summary.totalInvoices
        : 0

    const now = new Date()
    const monthStarts = Array.from(
      { length: now.getMonth() + 1 },
      (_, index) => new Date(now.getFullYear(), index, 1)
    )
    const monthlyTrend = monthStarts.map<MonthlyPoint>((date) => ({
      key: getMonthKey(date),
      label: monthFormatter.format(date),
      count: 0,
      revenue: 0,
    }))
    const monthMap = new Map(monthlyTrend.map((item) => [item.key, item]))

    const agencyMap = new Map<
      string,
      { name: string; count: number; revenue: number; collected: number }
    >()

    invoices.forEach((row) => {
      const invoiceDate = getInvoiceDate(row)
      const totalAmount = getInvoiceTotal(row)
      const collectedAmount = getCollectedAmount(row)

      if (invoiceDate) {
        const month = monthMap.get(getMonthKey(invoiceDate))
        if (month) {
          month.count += 1
          month.revenue += totalAmount
        }
      }

      const agencyName = getAgencyName(row)
      const agency = agencyMap.get(agencyName) || {
        name: agencyName,
        count: 0,
        revenue: 0,
        collected: 0,
      }
      agency.count += 1
      agency.revenue += totalAmount
      agency.collected += collectedAmount
      agencyMap.set(agencyName, agency)
    })

    const topAgencies = Array.from(agencyMap.values())
      .sort((first, second) => second.revenue - first.revenue)
      .slice(0, 5)

    const recentInvoices = [...invoices]
      .sort(
        (first, second) =>
          getInvoiceTimestamp(second) - getInvoiceTimestamp(first)
      )
      .slice(0, 6)

    return {
      summary,
      collectionRate,
      averageInvoice,
      monthlyTrend,
      topAgencies,
      recentInvoices,
    }
  }, [invoices])

  const statusItems: StatusItem[] = [
    {
      label: "Đã xuất",
      value: dashboard.summary.issued,
      color: "bg-emerald-500",
      badgeClass: "bg-emerald-50 text-emerald-700",
    },
    {
      label: "Nháp",
      value: dashboard.summary.draft,
      color: "bg-amber-500",
      badgeClass: "bg-amber-50 text-amber-700",
    },
    {
      label: "Đang xuất",
      value: dashboard.summary.issuing,
      color: "bg-blue-500",
      badgeClass: "bg-blue-50 text-blue-700",
    },
    {
      label: "Lỗi/Hủy",
      value: dashboard.summary.failed + dashboard.summary.cancelled,
      color: "bg-rose-500",
      badgeClass: "bg-rose-50 text-rose-700",
    },
  ]

  const paymentItems: StatusItem[] = [
    {
      label: "Đã thu đủ",
      value: dashboard.summary.paid,
      color: "bg-cyan-500",
      badgeClass: "bg-cyan-50 text-cyan-700",
    },
    {
      label: "Thu một phần",
      value: dashboard.summary.partial,
      color: "bg-violet-500",
      badgeClass: "bg-violet-50 text-violet-700",
    },
    {
      label: "Chưa thu",
      value: dashboard.summary.unpaid,
      color: "bg-slate-500",
      badgeClass: "bg-slate-100 text-slate-700",
    },
  ]

  const maxMonthlyRevenue = Math.max(
    ...dashboard.monthlyTrend.map((item) => item.revenue),
    1
  )
  const maxAgencyRevenue = Math.max(
    ...dashboard.topAgencies.map((item) => item.revenue),
    1
  )
  const initialLoading = isAuthenticated && loading && !initialized

  if (!isAuthenticated) {
    return (
      <div className="flex min-h-[calc(100vh-72px)] items-center justify-center px-4">
        <div className="flex items-center gap-3 rounded-lg px-5 py-4 text-sm font-semibold text-slate-600">
          <Loader2 size={20} className="animate-spin text-blue-600" />
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#edf1f5] px-4 py-5 lg:px-6">
      <div className="mx-auto max-w-7xl space-y-5">
        <PageHeader
          icon={<LayoutDashboard size={24} />}
          eyebrow="Tổng quan"
          title="Dashboard bán hàng"
          description="Doanh thu, công nợ và trạng thái hóa đơn cập nhật từ dữ liệu bán hàng."
          tone="blue"
          actions={
            <>
              <button
                type="button"
                onClick={() =>
                  void dispatch(fetchSaleTransactionsThunk(LIST_PARAMS))
                }
                disabled={loading}
                className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <RefreshCcw
                  size={16}
                  className={loading ? "animate-spin" : ""}
                />
                Tải lại
              </button>

              <Link
                href="/quan-ly-ban-hang/danh-sach"
                className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 text-sm font-bold text-white transition hover:bg-blue-700"
              >
                Hóa đơn
                <ArrowUpRight size={16} />
              </Link>
            </>
          }
        />

        {error && (
          <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">
            {error}
          </div>
        )}

        {initialLoading ? (
          <div className="flex min-h-[360px] items-center justify-center rounded-lg border border-slate-200 bg-white">
            <Loader2 size={24} className="animate-spin text-blue-600" />
          </div>
        ) : (
          <>
            <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <MetricCard
                title="Tổng doanh thu"
                value={formatMoney(dashboard.summary.totalRevenue)}
                subtitle={`${numberFormatter.format(
                  dashboard.summary.totalInvoices
                )} hóa đơn`}
                icon={<TrendingUp size={20} />}
                tone="blue"
              />
              <MetricCard
                title="Đã thu"
                value={formatMoney(dashboard.summary.collected)}
                subtitle={`${Math.round(dashboard.collectionRate)}% trên tổng doanh thu`}
                icon={<WalletCards size={20} />}
                tone="emerald"
              />
              <MetricCard
                title="Còn phải thu"
                value={formatMoney(dashboard.summary.remaining)}
                subtitle={`${numberFormatter.format(
                  dashboard.summary.partial + dashboard.summary.unpaid
                )} hóa đơn còn công nợ`}
                icon={<Clock3 size={20} />}
                tone="amber"
              />
              <MetricCard
                title="Giá trị trung bình"
                value={formatMoney(dashboard.averageInvoice)}
                subtitle={`${numberFormatter.format(
                  dashboard.summary.issued
                )} hóa đơn đã xuất`}
                icon={<ReceiptText size={20} />}
                tone="cyan"
              />
            </section>

            <section className="grid gap-4 xl:grid-cols-[minmax(0,1.35fr)_minmax(360px,0.65fr)]">
              <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
                <div className="mb-4 flex items-center justify-between gap-3">
                  <div>
                    <h2 className="text-base font-bold text-slate-950">
                      Doanh thu năm {new Date().getFullYear()}
                    </h2>
                    <p className="mt-1 text-sm font-medium text-slate-500">
                      Từ tháng 1 đến tháng hiện tại
                    </p>
                  </div>
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-blue-100 bg-blue-50 text-blue-700">
                    <BarChart3 size={20} />
                  </div>
                </div>

                <div className="flex h-72 items-end gap-3 border-b border-slate-200 pb-4">
                  {dashboard.monthlyTrend.map((item) => {
                    const height =
                      item.revenue > 0
                        ? Math.max((item.revenue / maxMonthlyRevenue) * 100, 8)
                        : 0

                    return (
                      <div
                        key={item.key}
                        className="flex h-full min-w-0 flex-1 flex-col justify-end gap-2"
                      >
                        <div className="flex min-h-12 items-end justify-center text-center text-[11px] font-semibold text-slate-500">
                          {item.revenue > 0 ? formatMoney(item.revenue) : ""}
                        </div>
                        <div className="flex h-44 items-end rounded-md bg-slate-50 px-2">
                          <div
                            className="w-full rounded-t-md bg-blue-500"
                            style={{ height: `${height}%` }}
                          />
                        </div>
                        <div className="text-center text-xs font-bold text-slate-700">
                          {item.label}
                        </div>
                      </div>
                    )
                  })}
                </div>

                <div className="mt-4 grid gap-3 sm:grid-cols-3">
                  <div className="rounded-lg border border-slate-200 px-3 py-2">
                    <p className="text-xs font-semibold text-slate-500">
                      Đã xuất
                    </p>
                    <p className="mt-1 text-lg font-bold text-emerald-700">
                      {numberFormatter.format(dashboard.summary.issued)}
                    </p>
                  </div>
                  <div className="rounded-lg border border-slate-200 px-3 py-2">
                    <p className="text-xs font-semibold text-slate-500">
                      Chưa xuất
                    </p>
                    <p className="mt-1 text-lg font-bold text-amber-700">
                      {numberFormatter.format(dashboard.summary.draft)}
                    </p>
                  </div>
                  <div className="rounded-lg border border-slate-200 px-3 py-2">
                    <p className="text-xs font-semibold text-slate-500">
                      Lỗi/Hủy
                    </p>
                    <p className="mt-1 text-lg font-bold text-rose-700">
                      {numberFormatter.format(
                        dashboard.summary.failed + dashboard.summary.cancelled
                      )}
                    </p>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
                  <div className="mb-4 flex items-center justify-between gap-3">
                    <h2 className="text-base font-bold text-slate-950">
                      Trạng thái hóa đơn
                    </h2>
                    <FileText size={20} className="text-slate-500" />
                  </div>
                  <div className="space-y-4">
                    {statusItems.map((item) => (
                      <ProgressRow
                        key={item.label}
                        item={item}
                        total={dashboard.summary.totalInvoices}
                      />
                    ))}
                  </div>
                </div>

                <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
                  <div className="mb-4 flex items-center justify-between gap-3">
                    <h2 className="text-base font-bold text-slate-950">
                      Thu tiền
                    </h2>
                    <WalletCards size={20} className="text-slate-500" />
                  </div>
                  <div className="space-y-4">
                    {paymentItems.map((item) => (
                      <ProgressRow
                        key={item.label}
                        item={item}
                        total={dashboard.summary.totalInvoices}
                      />
                    ))}
                  </div>
                </div>
              </div>
            </section>

            <section className="grid gap-4 xl:grid-cols-[minmax(340px,0.85fr)_minmax(0,1.15fr)]">
              <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
                <div className="mb-4 flex items-center justify-between gap-3">
                  <div>
                    <h2 className="text-base font-bold text-slate-950">
                      Các đại lý
                    </h2>
                  </div>
                  <Building2 size={20} className="text-slate-500" />
                </div>

                <div className="space-y-4">
                  {dashboard.topAgencies.length ? (
                    dashboard.topAgencies.map((agency, index) => {
                      const percent = Math.max(
                        (agency.revenue / maxAgencyRevenue) * 100,
                        4
                      )

                      return (
                        <div key={agency.name}>
                          <div className="mb-1 flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <p className="truncate text-sm font-bold text-slate-800">
                                {index + 1}. {agency.name}
                              </p>
                              <p className="mt-0.5 text-xs font-medium text-slate-500">
                                {numberFormatter.format(agency.count)} hóa đơn
                              </p>
                            </div>
                            <p className="shrink-0 text-sm font-bold text-slate-950">
                              {formatMoney(agency.revenue)}
                            </p>
                          </div>
                          <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                            <div
                              className="h-full rounded-full bg-cyan-500"
                              style={{ width: `${percent}%` }}
                            />
                          </div>
                        </div>
                      )
                    })
                  ) : (
                    <div className="rounded-lg border border-dashed border-slate-300 px-4 py-8 text-center text-sm font-semibold text-slate-500">
                      Chưa có dữ liệu đại lý.
                    </div>
                  )}
                </div>
              </div>

              <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
                <div className="mb-4 flex items-center justify-between gap-3">
                  <div>
                    <h2 className="text-base font-bold text-slate-950">
                      Hóa đơn gần đây
                    </h2>
                  </div>
                  <Link
                    href="/quan-ly-ban-hang/danh-sach"
                    className="inline-flex h-8 items-center justify-center gap-1 rounded-md border border-slate-200 px-3 text-xs font-bold text-slate-700 transition hover:bg-slate-50"
                  >
                    Xem tất cả
                    <ArrowUpRight size={14} />
                  </Link>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full min-w-[620px] border-separate border-spacing-0 text-sm">
                    <thead>
                      <tr className="text-left text-xs font-bold uppercase text-slate-500">
                        <th className="border-b border-slate-200 py-2 pr-3">
                          Công ty
                        </th>
                        <th className="border-b border-slate-200 px-3 py-2">
                          Ngày
                        </th>
                        <th className="border-b border-slate-200 px-3 py-2">
                          Trạng thái
                        </th>
                        <th className="border-b border-slate-200 py-2 pl-3 text-right">
                          Giá trị
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {dashboard.recentInvoices.length ? (
                        dashboard.recentInvoices.map((invoice) => {
                          const status = invoiceHelper.getInvoiceStatus(invoice)
                          const isIssued = status === InvoiceStatus.ISSUED
                          const isFailed =
                            status === InvoiceStatus.FAILED ||
                            status === InvoiceStatus.CANCELLED

                          return (
                            <tr key={invoice._id} className="group">
                              <td className="border-b border-slate-100 py-3 pr-3">
                                <div className="max-w-[260px] truncate font-bold text-slate-800">
                                  {invoice.inv_buyerLegalName ||
                                    invoice.inv_buyerDisplayName ||
                                    "-"}
                                </div>
                                <div className="mt-0.5 text-xs font-medium text-slate-500">
                                  MST: {invoice.inv_buyerTaxCode || "-"}
                                </div>
                              </td>
                              <td className="border-b border-slate-100 px-3 py-3 font-semibold text-slate-600">
                                {getInvoiceDate(invoice)
                                  ? dateFormatter.format(
                                      getInvoiceDate(invoice) as Date
                                    )
                                  : "-"}
                              </td>
                              <td className="border-b border-slate-100 px-3 py-3">
                                <span
                                  className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-bold ${
                                    isIssued
                                      ? "bg-emerald-50 text-emerald-700"
                                      : isFailed
                                        ? "bg-rose-50 text-rose-700"
                                        : "bg-amber-50 text-amber-700"
                                  }`}
                                >
                                  {isIssued ? (
                                    <CheckCircle2 size={13} />
                                  ) : isFailed ? (
                                    <AlertTriangle size={13} />
                                  ) : (
                                    <Clock3 size={13} />
                                  )}
                                  {invoiceHelper.invoiceStatusLabel[status]}
                                </span>
                              </td>
                              <td className="border-b border-slate-100 py-3 pl-3 text-right font-bold text-slate-950">
                                {formatMoney(getInvoiceTotal(invoice))}
                              </td>
                            </tr>
                          )
                        })
                      ) : (
                        <tr>
                          <td
                            colSpan={4}
                            className="py-10 text-center text-sm font-semibold text-slate-500"
                          >
                            Chưa có hóa đơn.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </section>
          </>
        )}
      </div>
    </div>
  )
}
