"use client"

import {
  APICreateBank,
  APIDeleteBank,
  APIGetBankById,
  APIGetBanks,
  APIUpdateBank,
} from "@/services/bank"
import { Bank, BankPayload } from "@/types/bank"

import AlertOption from "@/components/alert/AlertOption"
import AlertSuccess from "@/components/alert/AlertSuccess"
import AlertError from "@/components/alert/AlertError"
import { Loader2, Plus, X } from "lucide-react"
import { ReactNode, useEffect, useMemo, useState } from "react"
import { useForm } from "react-hook-form"
import DataTable, { DataTableColumn } from "@/components/common/Datatable"

const emptyForm: BankPayload = {
  inv_buyerBankName: "",
  isActive: true,
}

type ModeType = "create" | "view" | "edit" | null

function normalizeBankList(response: any): Bank[] {
  const raw =
    response?.data?.data ??
    response?.data?.content ??
    response?.data?.items ??
    response?.data?.result ??
    response?.data ??
    response?.content ??
    response?.items ??
    response?.result ??
    response ??
    []

  if (!Array.isArray(raw)) return []

  return raw
    .map((item: any) => item?.content ?? item)
    .filter((item: any) => item?._id)
}

function normalizeBankDetail(response: any): Bank | null {
  const raw =
    response?.data?.data ??
    response?.data?.content ??
    response?.data?.result ??
    response?.data ??
    response?.content ??
    response?.result ??
    response

  if (!raw) return null

  return raw?.content ?? raw
}

interface ActionModalProps {
  open: boolean
  title: string
  children: ReactNode
  onClose: () => void
  footer?: ReactNode
  widthClassName?: string
}

function ActionModal({
  open,
  title,
  children,
  onClose,
  footer,
  widthClassName = "max-w-lg",
}: ActionModalProps) {
  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
      <div
        className={[
          "w-full rounded-2xl bg-white shadow-xl",
          widthClassName,
        ].join(" ")}
      >
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <h2 className="text-base font-bold text-slate-900">{title}</h2>

          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 transition hover:bg-slate-100 hover:text-slate-900"
          >
            <X size={18} />
          </button>
        </div>

        <div className="px-5 py-4">{children}</div>

        {footer && (
          <div className="flex justify-end gap-2 border-t border-slate-100 px-5 py-4">
            {footer}
          </div>
        )}
      </div>
    </div>
  )
}

export default function BankPage() {
  const [banks, setBanks] = useState<Bank[]>([])
  const [selectedBank, setSelectedBank] = useState<Bank | null>(null)

  const [mode, setMode] = useState<ModeType>("create")
  const [open, setOpen] = useState(false)
  const [isDeleteDialogOpen, setDeleteDialogOpen] = useState(false)

  const [loading, setLoading] = useState(false)
  const [detailLoading, setDetailLoading] = useState(false)
  const [submitLoading, setSubmitLoading] = useState(false)
  const [deleteLoading, setDeleteLoading] = useState(false)

  const [showSuccess, setShowSuccess] = useState(false)
  const [showError, setShowError] = useState(false)
  const [message, setMessage] = useState("")

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<BankPayload>({
    defaultValues: emptyForm,
  })

  const isViewMode = mode === "view"
  const isEditMode = mode === "edit"
  const isCreateMode = mode === "create"

  const showSuccessMessage = (text: string) => {
    setMessage(text)
    setShowSuccess(true)
    setTimeout(() => setShowSuccess(false), 3000)
  }

  const showErrorMessage = (text: string) => {
    setMessage(text)
    setShowError(true)
    setTimeout(() => setShowError(false), 3000)
  }

  const handleGetBanks = async () => {
    try {
      setLoading(true)

      const response = await APIGetBanks()
      const list = normalizeBankList(response)

      setBanks(list)
    } catch (err) {
      console.error("APIGetBanks error:", err)
      showErrorMessage("Không thể tải danh sách ngân hàng")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    handleGetBanks()
  }, [])

  const columns = useMemo<DataTableColumn<Bank>[]>(
    () => [
      {
        key: "index",
        title: "STT",
        className: "w-[80px] text-slate-500",
        render: (_item, index) => index + 1,
      },
      {
        key: "inv_buyerBankName",
        title: "Tên ngân hàng",
        render: (item) => (
          <p className="font-semibold text-slate-900">
            {item.inv_buyerBankName}
          </p>
        ),
      },
      {
        key: "isActive",
        title: "Trạng thái",
        headerClassName: "text-center",
        className: "text-center",
        render: (item) => (
          <span
            className={[
              "inline-flex rounded-full px-3 py-1 text-xs font-bold",
              item.isActive
                ? "bg-emerald-50 text-emerald-700"
                : "bg-slate-100 text-slate-500",
            ].join(" ")}
          >
            {item.isActive ? "Hoạt động" : "Ngừng hoạt động"}
          </span>
        ),
      },
    ],
    []
  )

  const handleCloseDialog = () => {
    if (submitLoading || detailLoading) return

    setOpen(false)
    setSelectedBank(null)
    setMode("create")
    reset(emptyForm)
  }

  const openCreateDialog = () => {
    setSelectedBank(null)
    setMode("create")
    reset(emptyForm)
    setOpen(true)
  }

  const handleCreateBank = async (data: BankPayload) => {
    try {
      setSubmitLoading(true)

      const res = await APICreateBank(data)

      if (res?.status === 201 || res?.status === 200) {
        showSuccessMessage("Thêm ngân hàng thành công!")
        await handleGetBanks()
        handleCloseDialog()
      }
    } catch (err: any) {
      console.error("APICreateBank error:", err)
      showErrorMessage(
        err?.response?.data?.message || "Thêm ngân hàng thất bại!"
      )
    } finally {
      setSubmitLoading(false)
    }
  }

  const handleUpdateBank = async (id: string, data: BankPayload) => {
    try {
      setSubmitLoading(true)

      const res = await APIUpdateBank(id, data)

      if (res?.status === 200) {
        showSuccessMessage("Cập nhật ngân hàng thành công!")
        await handleGetBanks()
        handleCloseDialog()
      }
    } catch (err: any) {
      console.error("APIUpdateBank error:", err)
      showErrorMessage(
        err?.response?.data?.message || "Cập nhật ngân hàng thất bại!"
      )
    } finally {
      setSubmitLoading(false)
    }
  }

  const handleDeleteBank = async (id: string) => {
    try {
      setDeleteLoading(true)

      const res = await APIDeleteBank(id)

      if (res?.status === 200 || res?.status === 201 || res?.status === 204) {
        showSuccessMessage("Xóa ngân hàng thành công!")
        setDeleteDialogOpen(false)
        setSelectedBank(null)
        setMode("create")
        reset(emptyForm)
        await handleGetBanks()
        return
      }

      showErrorMessage("Xóa ngân hàng thất bại!")
    } catch (err: any) {
      console.error("APIDeleteBank error:", err)
      showErrorMessage(
        err?.response?.data?.message || "Xóa ngân hàng thất bại!"
      )
    } finally {
      setDeleteLoading(false)
    }
  }

  const onSubmit = async (data: BankPayload) => {
    const body: BankPayload = {
      inv_buyerBankName: data.inv_buyerBankName.trim(),
      isActive: Boolean(data.isActive),
    }

    if (isCreateMode) {
      await handleCreateBank(body)
      return
    }

    if (isEditMode && selectedBank?._id) {
      await handleUpdateBank(selectedBank._id, body)
      return
    }
  }

  const onView = async (rowData: Bank) => {
    if (!rowData?._id) {
      showErrorMessage("Không tìm thấy ID ngân hàng")
      return
    }

    try {
      setDetailLoading(true)
      setSelectedBank(null)

      const res = await APIGetBankById(rowData._id)

      if (res?.status === 200) {
        const detail = normalizeBankDetail(res)

        if (!detail?._id) {
          showErrorMessage("Không tìm thấy chi tiết ngân hàng")
          return
        }

        setSelectedBank(detail)
        reset({
          inv_buyerBankName: detail.inv_buyerBankName || "",
          isActive: Boolean(detail.isActive),
        })

        setMode("view")
        setOpen(true)
      }
    } catch (err: any) {
      console.error("APIGetBankById view error:", err)
      showErrorMessage(
        err?.response?.data?.message || "Không thể tải chi tiết ngân hàng"
      )
    } finally {
      setDetailLoading(false)
    }
  }

  const onEdit = async (rowData: Bank) => {
    if (!rowData?._id) {
      showErrorMessage("Không tìm thấy ID ngân hàng")
      return
    }

    try {
      setDetailLoading(true)
      setSelectedBank(null)

      const res = await APIGetBankById(rowData._id)

      if (res?.status === 200) {
        const detail = normalizeBankDetail(res)

        if (!detail?._id) {
          showErrorMessage("Không tìm thấy chi tiết ngân hàng")
          return
        }

        setSelectedBank(detail)
        reset({
          inv_buyerBankName: detail.inv_buyerBankName || "",
          isActive: Boolean(detail.isActive),
        })

        setMode("edit")
        setOpen(true)
      }
    } catch (err: any) {
      console.error("APIGetBankById edit error:", err)
      showErrorMessage(
        err?.response?.data?.message || "Không thể tải dữ liệu ngân hàng"
      )
    } finally {
      setDetailLoading(false)
    }
  }

  const onDeleteClick = (rowData: Bank) => {
    if (!rowData?._id) {
      showErrorMessage("Không tìm thấy ID ngân hàng")
      return
    }

    setSelectedBank(rowData)
    setDeleteDialogOpen(true)
  }

  return (
    <div className="min-h-screen bg-slate-100 p-5">
      <div className="mx-auto max-w-7xl space-y-5">
        <div className="flex flex-col gap-3 rounded-xl bg-white p-5 shadow-sm md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-xl font-bold text-slate-900">
              Quản lý ngân hàng
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              Quản lý danh sách ngân hàng dùng khi lập hóa đơn.
            </p>
          </div>

          <button
            type="button"
            onClick={openCreateDialog}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 text-sm font-bold text-white transition hover:bg-blue-700"
          >
            <Plus size={18} />
            Thêm ngân hàng
          </button>
        </div>

        <DataTable
          data={banks}
          columns={columns}
          loading={loading}
          emptyText="Chưa có dữ liệu ngân hàng"
          getRowKey={(item) => item._id}
          onView={onView}
          onEdit={onEdit}
          onDelete={onDeleteClick}
        />
      </div>

      <ActionModal
        open={open}
        title={
          isCreateMode
            ? "Thêm ngân hàng"
            : isViewMode
              ? "Chi tiết ngân hàng"
              : "Chỉnh sửa ngân hàng"
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
                form="bank-form"
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
            Đang tải dữ liệu ngân hàng...
          </div>
        ) : (
          <form
            id="bank-form"
            onSubmit={handleSubmit(onSubmit)}
            className="space-y-4"
          >
            <div>
              <label className="mb-1.5 block text-sm font-semibold text-slate-700">
                Tên ngân hàng
              </label>

              <input
                disabled={isViewMode}
                className="h-10 w-full rounded-lg border border-slate-200 px-3 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:bg-slate-50 disabled:text-slate-500"
                placeholder="Nhập tên ngân hàng"
                {...register("inv_buyerBankName", {
                  required: "Vui lòng nhập tên ngân hàng",
                  validate: (value) =>
                    value.trim().length > 0 || "Vui lòng nhập tên ngân hàng",
                })}
              />

              {errors.inv_buyerBankName && !isViewMode && (
                <p className="mt-1 text-xs font-medium text-red-600">
                  {errors.inv_buyerBankName.message}
                </p>
              )}
            </div>

            <label className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
              <input
                type="checkbox"
                disabled={isViewMode}
                className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 disabled:cursor-not-allowed"
                {...register("isActive")}
              />

              <span className="text-sm font-semibold text-slate-700">
                Đang hoạt động
              </span>
            </label>
          </form>
        )}
      </ActionModal>

      <AlertOption
        isOpen={isDeleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        onConfirm={() => {
          if (!selectedBank?._id || deleteLoading) return
          void handleDeleteBank(selectedBank._id)
        }}
        title="Xác nhận thao tác"
        description={`Hành động này sẽ xóa ngân hàng "${selectedBank?.inv_buyerBankName}" khỏi hệ thống và không thể hoàn tác. Bạn có chắc chắn tiếp tục?`}
        confirmText="Xóa"
        cancelText="Hủy"
        tone="destructive"
      />

      {showSuccess && <AlertSuccess description={message} />}
      {showError && <AlertError description={message} />}
    </div>
  )
}
