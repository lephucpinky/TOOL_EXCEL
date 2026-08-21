"use client"

import { Banknote, CheckCircle2, Loader2, X } from "lucide-react"

import InvoiceFilterSelect from "@/components/minvoice/InvoiceFilterSelect"
import type { Bank } from "@/types/bank"
import type { InvoiceApiRow } from "@/types/invoice"

type Props = {
  open: boolean
  invoice: InvoiceApiRow | null
  banks: Bank[]
  bankId: string
  amountValue: string
  paidDateValue: string
  loadingBanks?: boolean
  saving?: boolean
  onBankChange: (value: string) => void
  onAmountChange: (value: string) => void
  onPaidDateChange: (value: string) => void
  onClose: () => void
  onConfirm: () => void | Promise<void>
}

const moneyFormatter = new Intl.NumberFormat("en-US", {
  maximumFractionDigits: 0,
})

function toNumber(value: unknown) {
  const number = Number(value)

  return Number.isFinite(number) ? number : 0
}

function parsePaymentAmount(value: string) {
  const digits = String(value || "").replace(/[^\d]/g, "")

  return digits ? Number(digits) : 0
}

export default function InvoiceCollectPaymentDialog({
  open,
  invoice,
  banks,
  bankId,
  amountValue,
  paidDateValue,
  loadingBanks = false,
  saving = false,
  onBankChange,
  onAmountChange,
  onPaidDateChange,
  onClose,
  onConfirm,
}: Props) {
  if (!open || !invoice) return null

  const companyName =
    invoice.inv_buyerLegalName || invoice.inv_buyerDisplayName || "-"
  const totalAmount = toNumber(invoice.inv_TotalAmount)
  const paidAmount = parsePaymentAmount(amountValue)
  const differenceAmount = totalAmount - paidAmount

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-950/45 p-4">
      <div
        role="dialog"
        aria-modal="true"
        className="w-full max-w-[520px] overflow-hidden rounded-2xl border border-slate-200 bg-white text-slate-900 shadow-2xl"
      >
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
          <div className="flex min-w-0 items-center gap-3">
            <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-emerald-200 bg-emerald-50 text-emerald-700">
              <Banknote size={20} />
            </span>
            <div className="min-w-0">
              <h2 className="truncate text-lg font-bold text-slate-900">
                Thu tiền
              </h2>
              <p className="truncate text-sm text-slate-500">{companyName}</p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 transition hover:bg-slate-50 hover:text-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
            aria-label="Đóng"
          >
            <X size={18} />
          </button>
        </div>

        <div className="space-y-4 p-5">
          <div className="grid gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm">
            <div className="flex items-center justify-between gap-4">
              <span className="text-slate-500">Số hóa đơn</span>
              <span className="font-semibold text-slate-800">
                {invoice.orderNumber || invoice.inv_invoiceCreatedId || "-"}
              </span>
            </div>

            <div className="flex items-center justify-between gap-4">
              <span className="text-slate-500">Tổng giá trị hóa đơn</span>
              <span className="font-semibold text-slate-800">
                {moneyFormatter.format(totalAmount)}
              </span>
            </div>

            <div className="grid gap-1.5">
              <label className="text-slate-500">Số tiền thu</label>
              <input
                type="text"
                inputMode="numeric"
                value={amountValue}
                disabled={loadingBanks || saving}
                onChange={(event) => onAmountChange(event.target.value)}
                placeholder="Nhập tổng tiền thu"
                className="h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-right text-sm font-bold text-emerald-700 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 disabled:cursor-not-allowed disabled:bg-slate-100"
              />
            </div>

            <div className="grid gap-1.5">
              <label className="text-slate-500">Ngày thu tiền</label>
              <input
                type="date"
                value={paidDateValue}
                disabled={loadingBanks || saving}
                onChange={(event) => onPaidDateChange(event.target.value)}
                className="h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-800 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 disabled:cursor-not-allowed disabled:bg-slate-100"
              />
            </div>

            <div className="flex items-center justify-between gap-4 rounded-lg bg-white px-3 py-2">
              <span className="text-slate-500">Chênh lệch</span>
              <span
                className={`font-bold ${
                  differenceAmount < 0
                    ? "text-rose-600"
                    : differenceAmount === 0
                      ? "text-emerald-700"
                      : "text-amber-700"
                }`}
              >
                {moneyFormatter.format(differenceAmount)}
              </span>
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-semibold text-slate-700">
              Ngân hàng
            </label>
            <InvoiceFilterSelect
              id="collect-payment-bank"
              options={[
                {
                  value: "",
                  label: loadingBanks
                    ? "Đang tải ngân hàng..."
                    : "Chưa chọn ngân hàng",
                },
                ...banks.map((bank) => ({
                  value: bank._id,
                  label: bank.inv_buyerBankName,
                })),
              ]}
              value={bankId}
              disabled={loadingBanks || saving}
              onChange={onBankChange}
              searchPlaceholder="Tìm ngân hàng..."
              emptyText="Không tìm thấy ngân hàng"
              contentClassName="z-[10000]"
            />
          </div>
        </div>

        <div className="flex justify-end gap-3 border-t border-slate-200 bg-slate-50 px-5 py-4">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="inline-flex h-10 min-w-[92px] items-center justify-center rounded-lg border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Hủy
          </button>

          <button
            type="button"
            onClick={onConfirm}
            disabled={
              saving ||
              loadingBanks ||
              (Boolean(bankId) && (!amountValue || !paidDateValue))
            }
            className="inline-flex h-10 min-w-[120px] items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 text-sm font-bold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {saving ? (
              <>
                <Loader2 size={18} className="animate-spin" />
                <span className="sr-only">Đang lưu</span>
              </>
            ) : (
              <>
                <CheckCircle2 size={17} />
                Xác nhận
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
