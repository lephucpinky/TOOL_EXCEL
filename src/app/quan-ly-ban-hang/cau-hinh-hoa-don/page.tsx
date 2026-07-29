"use client"

import Link from "next/link"
import { useEffect, useMemo, useState } from "react"
import { useForm } from "react-hook-form"
import { Loader2, RefreshCcw, Settings2 } from "lucide-react"

import AlertError from "@/components/alert/AlertError"
import AlertOption from "@/components/alert/AlertOption"
import AlertSuccess from "@/components/alert/AlertSuccess"
import DataTable, { DataTableColumn } from "@/components/common/Datatable"
import {
  APICreateReceiptInvoice,
  APIDeleteReceiptInvoice,
  APIGetReceiptInvoiceById,
  APIGetReceiptInvoices,
  APIUpdateReceiptInvoice,
} from "@/services/receiptInvoice"
import type {
  ReceiptInvoiceConfig,
  ReceiptInvoicePayload,
} from "@/types/receiptInvoice"
import { getId } from "@/utils/invoice"
import PageHeader from "../../../components/header/PageHeader"
import ActionModal from "@/components/modal/ActionModal"
import { useTransientAlert } from "@/hooks/useTransientAlert"
import { getErrorMessage } from "@/store/utils/crud"
import { fetchAllPages } from "@/utils/pagination"

const emptyForm: ReceiptInvoicePayload = {
  inv_invoiceSeries: "",
  tax_code: "",
  description: "",
}

type ModeType = "create" | "view" | "edit" | null

function normalizeReceiptInvoiceDetail(
  response: any
): ReceiptInvoiceConfig | null {
  const raw = response?.data ?? null
  const detail = Array.isArray(raw)
    ? raw[0]
    : raw?.item || raw?.result || raw?.receiptInvoice || raw

  if (!detail) return null
  if (getId(detail) || detail.inv_invoiceSeries || detail.tax_code) {
    return detail as ReceiptInvoiceConfig
  }

  return null
}

function buildReceiptInvoiceFormValues(
  detail: ReceiptInvoiceConfig | null
): ReceiptInvoicePayload {
  return {
    inv_invoiceSeries: detail?.inv_invoiceSeries || "",
    tax_code: detail?.tax_code || "",
    description: detail?.description || "",
  }
}

function formatDateTime(value?: string) {
  if (!value) return "-"

  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return value
  }

  return new Intl.DateTimeFormat("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date)
}

export default function ReceiptInvoiceConfigPage() {
  const [configs, setConfigs] = useState<ReceiptInvoiceConfig[]>([])
  const [selectedConfig, setSelectedConfig] =
    useState<ReceiptInvoiceConfig | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<ReceiptInvoiceConfig | null>(
    null
  )
  const [mode, setMode] = useState<ModeType>("create")
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [detailLoading, setDetailLoading] = useState(false)
  const [submitLoading, setSubmitLoading] = useState(false)
  const [deleteLoading, setDeleteLoading] = useState(false)
  const [isDeleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const {
    showSuccess,
    showError,
    message,
    showSuccessMessage,
    showErrorMessage,
  } = useTransientAlert()

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<ReceiptInvoicePayload>({
    defaultValues: emptyForm,
  })

  const isViewMode = mode === "view"
  const isEditMode = mode === "edit"
  const isCreateMode = mode === "create"

  const loadConfigs = async () => {
    try {
      setLoading(true)

      setConfigs(
        await fetchAllPages<ReceiptInvoiceConfig>(APIGetReceiptInvoices)
      )
    } catch (error) {
      console.error("LOAD_RECEIPT_INVOICE_CONFIGS_ERROR", error)
      showErrorMessage(
        getErrorMessage(error, "Không thể tải danh sách cấu hình hóa đơn.")
      )
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadConfigs()
  }, [])

  const columns = useMemo<DataTableColumn<ReceiptInvoiceConfig>[]>(
    () => [
      {
        key: "index",
        title: "STT",
        className: "w-[80px] text-slate-500",
        render: (_item, index) => index + 1,
      },
      {
        key: "inv_invoiceSeries",
        title: "Ký hiệu hóa đơn",
        render: (item) => (
          <p className="font-semibold text-slate-900">
            {item.inv_invoiceSeries || "-"}
          </p>
        ),
      },
      {
        key: "tax_code",
        title: "Mã số thuế",
        render: (item) => (
          <p className="font-medium text-slate-700">{item.tax_code || "-"}</p>
        ),
      },
      {
        key: "description",
        title: "Mô tả",
        render: (item) => (
          <p className="text-slate-600">{item.description || "-"}</p>
        ),
      },
      {
        key: "updatedAt",
        title: "Cập nhật lúc",
        className: "whitespace-nowrap",
        render: (item) => formatDateTime(item.updatedAt || item.createdAt),
      },
    ],
    []
  )

  const handleCloseDialog = () => {
    if (submitLoading || detailLoading) return

    setOpen(false)
    setMode("create")
    setSelectedConfig(null)
    reset(emptyForm)
  }

  const openCreateDialog = () => {
    setMode("create")
    setSelectedConfig(null)
    reset(emptyForm)
    setOpen(true)
  }

  const handleViewOrEdit = async (
    rowData: ReceiptInvoiceConfig,
    nextMode: Exclude<ModeType, "create" | null>
  ) => {
    const id = getId(rowData)

    if (!id) {
      showErrorMessage("Không tìm thấy ID cấu hình hóa đơn.")
      return
    }

    try {
      setDetailLoading(true)

      const response = await APIGetReceiptInvoiceById(id)
      const detail = normalizeReceiptInvoiceDetail(response)

      if (!detail) {
        showErrorMessage("Không tìm thấy chi tiết cấu hình hóa đơn.")
        return
      }

      setSelectedConfig(detail)
      reset(buildReceiptInvoiceFormValues(detail))
      setMode(nextMode)
      setOpen(true)
    } catch (error) {
      console.error("LOAD_RECEIPT_INVOICE_CONFIG_DETAIL_ERROR", error)
      showErrorMessage(
        getErrorMessage(error, "Không thể tải chi tiết cấu hình hóa đơn.")
      )
    } finally {
      setDetailLoading(false)
    }
  }

  const handleDeleteClick = (rowData: ReceiptInvoiceConfig) => {
    const id = getId(rowData)

    if (!id) {
      showErrorMessage("Không tìm thấy ID cấu hình hóa đơn.")
      return
    }

    setDeleteTarget(rowData)
    setDeleteDialogOpen(true)
  }

  const handleDeleteConfig = async () => {
    const id = getId(deleteTarget)

    if (!id) return

    try {
      setDeleteLoading(true)

      await APIDeleteReceiptInvoice(id)
      await loadConfigs()

      showSuccessMessage("Xóa cấu hình hóa đơn thành công.")
      setDeleteDialogOpen(false)
      setDeleteTarget(null)

      if (getId(selectedConfig) === id) {
        handleCloseDialog()
      }
    } catch (error) {
      console.error("DELETE_RECEIPT_INVOICE_CONFIG_ERROR", error)
      showErrorMessage(getErrorMessage(error, "Xóa cấu hình hóa đơn thất bại."))
    } finally {
      setDeleteLoading(false)
    }
  }

  const onSubmit = async (data: ReceiptInvoicePayload) => {
    const payload: ReceiptInvoicePayload = {
      inv_invoiceSeries: data.inv_invoiceSeries.trim(),
      tax_code: data.tax_code.trim(),
      description: data.description?.trim() || "",
    }

    try {
      setSubmitLoading(true)

      if (isCreateMode) {
        await APICreateReceiptInvoice(payload)
        await loadConfigs()
        showSuccessMessage("Thêm cấu hình hóa đơn thành công.")
        handleCloseDialog()
        return
      }

      if (isEditMode) {
        const id = getId(selectedConfig)

        if (!id) {
          showErrorMessage("Không tìm thấy ID cấu hình hóa đơn.")
          return
        }

        await APIUpdateReceiptInvoice(id, payload)
        await loadConfigs()
        showSuccessMessage("Cập nhật cấu hình hóa đơn thành công.")
        handleCloseDialog()
      }
    } catch (error) {
      console.error("SAVE_RECEIPT_INVOICE_CONFIG_ERROR", error)
      showErrorMessage(getErrorMessage(error, "Lưu cấu hình hóa đơn thất bại."))
    } finally {
      setSubmitLoading(false)
    }
  }

  return (
    <div className="min-h-screen p-5">
      <div className="mx-auto max-w-7xl space-y-5">
        <PageHeader
          icon={<Settings2 size={24} />}
          eyebrow="Cấu hình hóa đơn"
          title="Quản lý cấu hình hóa đơn"
          description=""
          tone="violet"
          actions={
            <>
              <Link
                href="/quan-ly-ban-hang/danh-sach"
                className="inline-flex h-10 items-center justify-center rounded-lg border border-slate-200 px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
              >
                Quay lại hóa đơn
              </Link>

              <button
                type="button"
                onClick={() => void loadConfigs()}
                disabled={loading}
                className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-slate-200 px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <RefreshCcw
                  size={16}
                  className={loading ? "animate-spin" : ""}
                />
                Tải dữ liệu
              </button>
            </>
          }
        />

        <DataTable
          data={configs}
          columns={columns}
          loading={loading}
          emptyText="Chưa có cấu hình hóa đơn nào."
          getRowKey={(item, index) => getId(item) || `receipt-config-${index}`}
          onView={(row) => void handleViewOrEdit(row, "view")}
        />
      </div>

      <ActionModal
        open={open}
        title={
          isCreateMode
            ? "Thêm cấu hình hóa đơn"
            : isViewMode
              ? "Chi tiết cấu hình hóa đơn"
              : "Chỉnh sửa cấu hình hóa đơn"
        }
        onClose={handleCloseDialog}
        footer={
          isViewMode ? (
            <button
              type="button"
              onClick={handleCloseDialog}
              className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-bold text-white transition hover:bg-slate-800"
            >
              Đóng
            </button>
          ) : (
            <>
              <button
                type="submit"
                form="receipt-invoice-config-form"
                disabled={submitLoading || detailLoading}
                className="inline-flex min-w-[120px] items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-bold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {submitLoading && (
                  <Loader2 size={16} className="animate-spin" />
                )}
                {isCreateMode ? "Thêm mới" : "Cập nhật"}
              </button>

              <button
                type="button"
                onClick={handleCloseDialog}
                disabled={submitLoading || detailLoading}
                className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Hủy
              </button>
            </>
          )
        }
      >
        {detailLoading ? (
          <div className="flex items-center justify-center gap-2 py-8 text-sm text-slate-500">
            <Loader2 size={18} className="animate-spin" />
            Đang tải dữ liệu cấu hình hóa đơn...
          </div>
        ) : (
          <form
            id="receipt-invoice-config-form"
            onSubmit={handleSubmit(onSubmit)}
            className="space-y-4"
          >
            <div>
              <label className="mb-1.5 block text-sm font-semibold text-slate-700">
                Ký hiệu hóa đơn
              </label>

              <input
                disabled={isViewMode}
                className="h-10 w-full rounded-lg border border-slate-200 px-3 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:bg-slate-50 disabled:text-slate-500"
                placeholder="Ví dụ: 1C26MZZ"
                {...register("inv_invoiceSeries", {
                  required: "Vui lòng nhập ký hiệu hóa đơn",
                  validate: (value) =>
                    value.trim().length > 0 || "Vui lòng nhập ký hiệu hóa đơn",
                })}
              />

              {errors.inv_invoiceSeries && !isViewMode && (
                <p className="mt-1 text-xs font-medium text-red-600">
                  {errors.inv_invoiceSeries.message}
                </p>
              )}
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-semibold text-slate-700">
                Mã số thuế
              </label>

              <input
                disabled={isViewMode}
                className="h-10 w-full rounded-lg border border-slate-200 px-3 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:bg-slate-50 disabled:text-slate-500"
                placeholder="Ví dụ: 0106026495-999"
                {...register("tax_code", {
                  required: "Vui lòng nhập mã số thuế",
                  validate: (value) =>
                    value.trim().length > 0 || "Vui lòng nhập mã số thuế",
                })}
              />

              {errors.tax_code && !isViewMode && (
                <p className="mt-1 text-xs font-medium text-red-600">
                  {errors.tax_code.message}
                </p>
              )}
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-semibold text-slate-700">
                Mô tả
              </label>

              <input
                disabled={isViewMode}
                className="h-10 w-full rounded-lg border border-slate-200 px-3 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:bg-slate-50 disabled:text-slate-500"
                placeholder="Mô tả thêm về cấu hình hóa đơn này (không bắt buộc)"
                {...register("description")}
              />
            </div>
          </form>
        )}
      </ActionModal>

      <AlertOption
        isOpen={isDeleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        onConfirm={handleDeleteConfig}
        title="Xác nhận xóa cấu hình"
        description={`Bạn có chắc chắn muốn xóa cấu hình "${deleteTarget?.inv_invoiceSeries || "-"}" khỏi hệ thống?`}
        confirmText={deleteLoading ? "Đang xóa..." : "Xóa"}
        cancelText="Hủy"
        tone="destructive"
      />

      {showSuccess && <AlertSuccess description={message} />}
      {showError && <AlertError description={message} />}
    </div>
  )
}
