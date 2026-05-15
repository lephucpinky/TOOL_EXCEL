"use client"

import {
  APICreateDepartment,
  APIDeleteDepartment,
  APIGetDepartmentById,
  APIGetDepartments,
  APIUpdateDepartment,
} from "@/services/department"
import { Department, DepartmentPayload } from "@/types/department"

import AlertOption from "@/components/alert/AlertOption"
import AlertSuccess from "@/components/alert/AlertSuccess"
import AlertError from "@/components/alert/AlertError"
import { Loader2, Plus, X } from "lucide-react"
import { ReactNode, useEffect, useMemo, useState } from "react"
import { useForm } from "react-hook-form"
import DataTable, { DataTableColumn } from "@/components/common/Datatable"

const emptyForm: DepartmentPayload = {
  departmentName: "",
  departmentDescription: "",
  isActive: true,
}

type ModeType = "create" | "view" | "edit" | null

function normalizeDepartmentItem(item: any): Department | null {
  if (!item) return null

  const id = item._id ?? item.id

  if (!id) return null

  return {
    _id: id,
    departmentName: item.departmentName ?? "",
    departmentDescription: item.departmentDescription ?? "",
    isActive: Boolean(item.isActive),
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
    __v: item.__v,
  }
}

function normalizeDepartmentList(response: any): Department[] {
  const rawRoot =
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

  const raw = Array.isArray(rawRoot)
    ? rawRoot
    : Array.isArray(rawRoot?.data)
      ? rawRoot.data
      : Array.isArray(rawRoot?.items)
        ? rawRoot.items
        : Array.isArray(rawRoot?.docs)
          ? rawRoot.docs
          : Array.isArray(rawRoot?.results)
            ? rawRoot.results
            : Array.isArray(rawRoot?.departments)
              ? rawRoot.departments
              : Array.isArray(rawRoot?.content)
                ? rawRoot.content
                : []

  return raw
    .map((item: any) => normalizeDepartmentItem(item?.content ?? item))
    .filter(Boolean) as Department[]
}

function normalizeDepartmentDetail(response: any): Department | null {
  const raw =
    response?.data?.data ??
    response?.data?.content ??
    response?.data?.result ??
    response?.data ??
    response?.content ??
    response?.result ??
    response

  return normalizeDepartmentItem(raw?.content ?? raw)
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
  widthClassName = "max-w-2xl",
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

export default function DepartmentPage() {
  const [departments, setDepartments] = useState<Department[]>([])
  const [selectedDepartment, setSelectedDepartment] =
    useState<Department | null>(null)

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
  } = useForm<DepartmentPayload>({
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

  const handleGetDepartments = async () => {
    try {
      setLoading(true)

      const response = await APIGetDepartments()
      const list = normalizeDepartmentList(response)

      setDepartments(list)
    } catch (err) {
      console.error("APIGetDepartments error:", err)
      showErrorMessage("Không thể tải danh sách phòng ban")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    handleGetDepartments()
  }, [])

  const columns = useMemo<DataTableColumn<Department>[]>(
    () => [
      {
        key: "index",
        title: "STT",
        className: "w-[70px] text-slate-500",
        render: (_item, index) => index + 1,
      },
      {
        key: "departmentName",
        title: "Tên phòng ban",
        render: (item) => (
          <p className="font-semibold text-slate-900">{item.departmentName}</p>
        ),
      },
      {
        key: "departmentDescription",
        title: "Mô tả",
        render: (item) => (
          <p className="line-clamp-2 text-sm text-slate-600">
            {item.departmentDescription || "Chưa có mô tả"}
          </p>
        ),
      },
      {
        key: "isActive",
        title: "Trạng thái",
        render: (item) =>
          item.isActive ? (
            <span className="bg-emerald-50 text-emerald-700 inline-flex rounded-full px-3 py-1 text-xs font-bold">
              Hoạt động
            </span>
          ) : (
            <span className="inline-flex rounded-full bg-red-50 px-3 py-1 text-xs font-bold text-red-700">
              Ngừng hoạt động
            </span>
          ),
      },
    ],
    []
  )

  const handleCloseDialog = () => {
    if (submitLoading || detailLoading) return

    setOpen(false)
    setSelectedDepartment(null)
    setMode("create")
    reset(emptyForm)
  }

  const openCreateDialog = () => {
    setSelectedDepartment(null)
    setMode("create")
    reset(emptyForm)
    setOpen(true)
  }

  const handleCreateDepartment = async (data: DepartmentPayload) => {
    try {
      setSubmitLoading(true)

      const res = await APICreateDepartment(data)

      if (res?.status === 201 || res?.status === 200) {
        showSuccessMessage("Thêm phòng ban thành công!")
        await handleGetDepartments()
        handleCloseDialog()
      }
    } catch (err: any) {
      console.error("APICreateDepartment error:", err)
      showErrorMessage(
        err?.response?.data?.message || "Thêm phòng ban thất bại!"
      )
    } finally {
      setSubmitLoading(false)
    }
  }

  const handleUpdateDepartment = async (
    id: string,
    data: DepartmentPayload
  ) => {
    try {
      setSubmitLoading(true)

      const res = await APIUpdateDepartment(id, data)

      if (res?.status === 200 || res?.status === 201) {
        showSuccessMessage("Cập nhật phòng ban thành công!")
        await handleGetDepartments()
        handleCloseDialog()
      }
    } catch (err: any) {
      console.error("APIUpdateDepartment error:", err)
      showErrorMessage(
        err?.response?.data?.message || "Cập nhật phòng ban thất bại!"
      )
    } finally {
      setSubmitLoading(false)
    }
  }

  const handleDeleteDepartment = async (id: string) => {
    try {
      setDeleteLoading(true)

      const res = await APIDeleteDepartment(id)

      if (res?.status === 200 || res?.status === 201 || res?.status === 204) {
        showSuccessMessage("Xóa phòng ban thành công!")
        setDeleteDialogOpen(false)
        setSelectedDepartment(null)
        setMode("create")
        reset(emptyForm)
        await handleGetDepartments()
        return
      }

      showErrorMessage("Xóa phòng ban thất bại!")
    } catch (err: any) {
      console.error("APIDeleteDepartment error:", err)
      showErrorMessage(
        err?.response?.data?.message || "Xóa phòng ban thất bại!"
      )
    } finally {
      setDeleteLoading(false)
    }
  }

  const onSubmit = async (data: DepartmentPayload) => {
    const body: DepartmentPayload = {
      departmentName: data.departmentName.trim(),
      departmentDescription: data.departmentDescription.trim(),
      isActive: Boolean(data.isActive),
    }

    if (isCreateMode) {
      await handleCreateDepartment(body)
      return
    }

    if (isEditMode && selectedDepartment?._id) {
      await handleUpdateDepartment(selectedDepartment._id, body)
      return
    }
  }

  const onView = async (rowData: Department) => {
    if (!rowData?._id) {
      showErrorMessage("Không tìm thấy ID phòng ban")
      return
    }

    try {
      setDetailLoading(true)
      setSelectedDepartment(null)

      const res = await APIGetDepartmentById(rowData._id)

      if (res?.status === 200 || res?.status === 201) {
        const detail = normalizeDepartmentDetail(res)

        if (!detail?._id) {
          showErrorMessage("Không tìm thấy chi tiết phòng ban")
          return
        }

        setSelectedDepartment(detail)

        reset({
          departmentName: detail.departmentName || "",
          departmentDescription: detail.departmentDescription || "",
          isActive: Boolean(detail.isActive),
        })

        setMode("view")
        setOpen(true)
      }
    } catch (err: any) {
      console.error("APIGetDepartmentById view error:", err)
      showErrorMessage(
        err?.response?.data?.message || "Không thể tải chi tiết phòng ban"
      )
    } finally {
      setDetailLoading(false)
    }
  }

  const onEdit = async (rowData: Department) => {
    if (!rowData?._id) {
      showErrorMessage("Không tìm thấy ID phòng ban")
      return
    }

    try {
      setDetailLoading(true)
      setSelectedDepartment(null)

      const res = await APIGetDepartmentById(rowData._id)

      if (res?.status === 200 || res?.status === 201) {
        const detail = normalizeDepartmentDetail(res)

        if (!detail?._id) {
          showErrorMessage("Không tìm thấy chi tiết phòng ban")
          return
        }

        setSelectedDepartment(detail)

        reset({
          departmentName: detail.departmentName || "",
          departmentDescription: detail.departmentDescription || "",
          isActive: Boolean(detail.isActive),
        })

        setMode("edit")
        setOpen(true)
      }
    } catch (err: any) {
      console.error("APIGetDepartmentById edit error:", err)
      showErrorMessage(
        err?.response?.data?.message || "Không thể tải dữ liệu phòng ban"
      )
    } finally {
      setDetailLoading(false)
    }
  }

  const onDeleteClick = (rowData: Department) => {
    if (!rowData?._id) {
      showErrorMessage("Không tìm thấy ID phòng ban")
      return
    }

    setSelectedDepartment(rowData)
    setDeleteDialogOpen(true)
  }

  return (
    <div className="min-h-screen bg-slate-100 p-5">
      <div className="mx-auto max-w-7xl space-y-5">
        <div className="flex flex-col gap-3 rounded-xl bg-white p-5 shadow-sm md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-xl font-bold text-slate-900">
              Quản lý phòng ban
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              Quản lý tên phòng ban, mô tả và trạng thái hoạt động.
            </p>
          </div>

          <button
            type="button"
            onClick={openCreateDialog}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 text-sm font-bold text-white transition hover:bg-blue-700"
          >
            <Plus size={18} />
            Thêm phòng ban
          </button>
        </div>

        <DataTable
          data={departments}
          columns={columns}
          loading={loading}
          emptyText="Chưa có dữ liệu phòng ban"
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
            ? "Thêm phòng ban"
            : isViewMode
              ? "Chi tiết phòng ban"
              : "Chỉnh sửa phòng ban"
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
                form="department-form"
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
            Đang tải dữ liệu phòng ban...
          </div>
        ) : (
          <form
            id="department-form"
            onSubmit={handleSubmit(onSubmit)}
            className="space-y-4"
          >
            <div>
              <label className="mb-1.5 block text-sm font-semibold text-slate-700">
                Tên phòng ban
              </label>

              <input
                disabled={isViewMode}
                className="h-10 w-full rounded-lg border border-slate-200 px-3 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:bg-slate-50 disabled:text-slate-500"
                placeholder="Ví dụ: Sales"
                {...register("departmentName", {
                  required: "Vui lòng nhập tên phòng ban",
                  validate: (value) =>
                    value.trim().length > 0 || "Vui lòng nhập tên phòng ban",
                })}
              />

              {errors.departmentName && !isViewMode && (
                <p className="mt-1 text-xs font-medium text-red-600">
                  {errors.departmentName.message}
                </p>
              )}
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-semibold text-slate-700">
                Mô tả
              </label>

              <textarea
                disabled={isViewMode}
                rows={4}
                className="w-full resize-none rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:bg-slate-50 disabled:text-slate-500"
                placeholder="Ví dụ: kinh doanh là..."
                {...register("departmentDescription", {
                  required: "Vui lòng nhập mô tả phòng ban",
                  validate: (value) =>
                    value.trim().length > 0 || "Vui lòng nhập mô tả phòng ban",
                })}
              />

              {errors.departmentDescription && !isViewMode && (
                <p className="mt-1 text-xs font-medium text-red-600">
                  {errors.departmentDescription.message}
                </p>
              )}
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-semibold text-slate-700">
                Trạng thái
              </label>

              <label className="flex h-11 items-center gap-3 rounded-lg border border-slate-200 px-3">
                <input
                  disabled={isViewMode}
                  type="checkbox"
                  className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 disabled:cursor-not-allowed"
                  {...register("isActive")}
                />
                <span className="text-sm font-medium text-slate-700">
                  Đang hoạt động
                </span>
              </label>
            </div>
          </form>
        )}
      </ActionModal>

      <AlertOption
        isOpen={isDeleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        onConfirm={() => {
          if (!selectedDepartment?._id || deleteLoading) return
          void handleDeleteDepartment(selectedDepartment._id)
        }}
        title="Xác nhận thao tác"
        description={`Hành động này sẽ xóa phòng ban "${selectedDepartment?.departmentName}" khỏi hệ thống và không thể hoàn tác. Bạn có chắc chắn tiếp tục?`}
        confirmText={deleteLoading ? "Đang xóa..." : "Xóa"}
        cancelText="Hủy"
        tone="destructive"
      />

      {showSuccess && <AlertSuccess description={message} />}
      {showError && <AlertError description={message} />}
    </div>
  )
}
