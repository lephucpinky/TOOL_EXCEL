"use client"

import type { ReactNode } from "react"
import {
  FileText,
  FileSpreadsheet,
  Loader2,
  Plus,
  RefreshCw,
  X,
} from "lucide-react"

type Props = {
  onReload: () => void
  onAdd: () => void
  onBulkImport?: () => void
  onBulkExportInvoice?: () => void
  onBulkUpdateMInvoice?: () => void
  onClearSelection?: () => void

  loading?: boolean
  bulkActionLoading?: boolean
  selectedCount?: number
  exportableCount?: number
  updatableCount?: number
}

type ToolbarButtonVariant =
  | "default"
  | "danger"
  | "primary"
  | "success"
  | "warning"

export function ToolbarButton({
  children,
  onClick,
  variant = "default",
  disabled = false,
}: {
  children: ReactNode
  onClick?: () => void
  variant?: ToolbarButtonVariant
  disabled?: boolean
}) {
  const className =
    variant === "danger"
      ? "border-red-300 bg-red-50 text-red-600 hover:bg-red-100"
      : variant === "primary"
        ? "border-blue-500 bg-blue-50 text-blue-700 hover:bg-blue-100"
        : variant === "success"
          ? "border-emerald-400 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
          : variant === "warning"
            ? "border-amber-400 bg-amber-50 text-amber-700 hover:bg-amber-100"
            : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={[
        "inline-flex h-9 items-center justify-center gap-1.5 rounded-md border px-3 text-sm font-medium transition",
        "disabled:cursor-not-allowed disabled:opacity-50",
        className,
      ].join(" ")}
    >
      {children}
    </button>
  )
}

export default function InvoiceToolbar({
  onReload,
  onAdd,
  onBulkImport,
  onBulkExportInvoice,
  onBulkUpdateMInvoice,
  onClearSelection,
  loading = false,
  bulkActionLoading = false,
  selectedCount = 0,
  exportableCount = 0,
  updatableCount = 0,
}: Props) {
  return (
    <div className="mx-4 flex flex-nowrap items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-3 shadow-sm">
      <ToolbarButton onClick={onReload} disabled={loading}>
        <RefreshCw size={15} className={loading ? "animate-spin" : ""} />
        Tải dữ liệu
      </ToolbarButton>

      <div
        id="invoice-order-filter-toolbar-slot"
        className="relative shrink-0"
      />

      <ToolbarButton onClick={onAdd} variant="primary" disabled={loading}>
        <Plus size={15} />
        Thêm hóa đơn
      </ToolbarButton>

      <ToolbarButton
        onClick={onBulkImport}
        variant="success"
        disabled={loading || !onBulkImport}
      >
        <FileSpreadsheet size={15} />
        Tạo HĐ hàng loạt
      </ToolbarButton>

      <ToolbarButton
        onClick={onBulkExportInvoice}
        variant="warning"
        disabled={
          loading ||
          bulkActionLoading ||
          !onBulkExportInvoice ||
          exportableCount === 0
        }
      >
        {bulkActionLoading ? (
          <Loader2 size={15} className="animate-spin" />
        ) : (
          <FileText size={15} />
        )}
        Xuất HĐ ({exportableCount})
      </ToolbarButton>

      <ToolbarButton
        onClick={onBulkUpdateMInvoice}
        variant="primary"
        disabled={
          loading ||
          bulkActionLoading ||
          !onBulkUpdateMInvoice ||
          updatableCount === 0
        }
      >
        {bulkActionLoading ? (
          <Loader2 size={15} className="animate-spin" />
        ) : (
          <RefreshCw size={15} />
        )}
        Cập nhật HĐ ({updatableCount})
      </ToolbarButton>

      {selectedCount > 0 && (
        <ToolbarButton
          onClick={onClearSelection}
          disabled={loading || bulkActionLoading || !onClearSelection}
        >
          <X size={15} />
          Bỏ chọn ({selectedCount})
        </ToolbarButton>
      )}
    </div>
  )
}
