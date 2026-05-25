"use client"

import type { ReactNode } from "react"
import {
  FileSpreadsheet,
  ListFilter,
  Plus,
  RefreshCw,
  Trash2,
} from "lucide-react"

type Props = {
  onReload: () => void
  onAdd: () => void
  onBulkImport?: () => void
  onDelete: () => void

  onStats?: () => void
  onSearchDateRange?: () => void
  onFilterEmployee?: () => void
  onFilterAgency?: () => void
  onFilterDepartment?: () => void
  onViewAll?: () => void
  onSendReceipt?: () => void

  loading?: boolean
  disableDelete?: boolean
}

type ToolbarButtonVariant =
  | "default"
  | "danger"
  | "primary"
  | "success"
  | "warning"

function ToolbarButton({
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
  onDelete,
  onViewAll,
  loading = false,
  disableDelete = false,
}: Props) {
  return (
    <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 bg-white px-4 py-3">
      <ToolbarButton onClick={onReload} disabled={loading}>
        <RefreshCw size={15} className={loading ? "animate-spin" : ""} />
        Tải dữ liệu
      </ToolbarButton>

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
        onClick={onDelete}
        variant="danger"
        disabled={loading || disableDelete}
      >
        <Trash2 size={15} />
        Xóa
      </ToolbarButton>

      {/* <ToolbarButton onClick={onStats} disabled={loading || !onStats}>
        <BarChart3 size={15} />
        Thống kê
      </ToolbarButton>

      <ToolbarButton
        onClick={onSearchDateRange}
        disabled={loading || !onSearchDateRange}
      >
        <CalendarRange size={15} />
        Theo khoảng ngày
      </ToolbarButton>

      <ToolbarButton
        onClick={onFilterEmployee}
        disabled={loading || !onFilterEmployee}
      >
        <UserRound size={15} />
        Theo nhân viên
      </ToolbarButton>

      <ToolbarButton
        onClick={onFilterAgency}
        disabled={loading || !onFilterAgency}
      >
        <Landmark size={15} />
        Theo đại lý
      </ToolbarButton>

      <ToolbarButton
        onClick={onFilterDepartment}
        disabled={loading || !onFilterDepartment}
      >
        <Building2 size={15} />
        Theo phòng ban
      </ToolbarButton> */}

      {/* <ToolbarButton onClick={onViewAll} disabled={loading || !onViewAll}>
        <ListFilter size={15} />
        Xem toàn bộ HĐ
      </ToolbarButton> */}

      {/* <ToolbarButton
        onClick={onSendReceipt}
        variant="success"
        disabled={loading || !onSendReceipt}
      >
        <Send size={15} />
        Gửi biên nhận
      </ToolbarButton> */}

      {/* <ToolbarButton variant="warning" disabled={loading}>
        <FileText size={15} />
        Nghiệp vụ
      </ToolbarButton> */}
    </div>
  )
}
