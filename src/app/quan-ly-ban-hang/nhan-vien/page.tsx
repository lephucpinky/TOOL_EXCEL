"use client"

import {
  APICreateEmployee,
  APIDeleteEmployee,
  APIGetEmployeeById,
  APIGetEmployees,
  APIUpdateEmployee,
} from "@/services/employee"
import { Employee, EmployeePayload } from "@/types/employee"

import AlertOption from "@/components/alert/AlertOption"
import AlertSuccess from "@/components/alert/AlertSuccess"
import AlertError from "@/components/alert/AlertError"
import { Loader2, Plus, X } from "lucide-react"
import { ReactNode, useEffect, useMemo, useState } from "react"
import { useForm } from "react-hook-form"
import DataTable, { DataTableColumn } from "@/components/common/Datatable"

import { APIGetDepartments } from "@/services/department"
import { Department } from "@/types/department"

const emptyForm: EmployeePayload = {
  employeeName: "",
  employeeEmail: "",
  employeePhone: "",
  departmentId: "",
  isActive: true,
}

type ModeType = "create" | "view" | "edit" | null

function normalizeEmployeeItem(item: any): Employee | null {
  if (!item) return null

  const id = item._id ?? item.id

  if (!id) return null

  return {
    _id: id,
    employeeName: item.employeeName ?? "",
    employeeEmail: item.employeeEmail ?? "",
    employeePhone: item.employeePhone ?? "",
    departmentId:
      typeof item.departmentId === "object"
        ? (item.departmentId?._id ?? "")
        : (item.departmentId ?? ""),
    isActive: Boolean(item.isActive),
  }
}

function normalizeEmployeeList(response: any): Employee[] {
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
            : Array.isArray(rawRoot?.employees)
              ? rawRoot.employees
              : Array.isArray(rawRoot?.content)
                ? rawRoot.content
                : []

  return raw
    .map((item: any) => normalizeEmployeeItem(item?.content ?? item))
    .filter(Boolean) as Employee[]
}

function normalizeEmployeeDetail(response: any): Employee | null {
  const raw =
    response?.data?.data ??
    response?.data?.content ??
    response?.data?.result ??
    response?.data ??
    response?.content ??
    response?.result ??
    response

  return normalizeEmployeeItem(raw?.content ?? raw)
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

export default function EmployeePage() {
  const [employees, setEmployees] = useState<Employee[]>([])
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(
    null
  )

  const [departments, setDepartments] = useState<Department[]>([])

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
  } = useForm<EmployeePayload>({
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

  const handleGetEmployees = async () => {
    try {
      setLoading(true)

      const response = await APIGetEmployees()
      const list = normalizeEmployeeList(response)

      setEmployees(list)
    } catch (err) {
      console.error("APIGetEmployees error:", err)
      showErrorMessage("Không thể tải danh sách nhân viên")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    handleGetEmployees()
  }, [])
  const handleGetDepartments = async () => {
    try {
      const res = await APIGetDepartments()

      if (res?.status === 200 || res?.status === 201) {
        const list = Array.isArray(res?.data)
          ? res.data.map((item: any) => item?.content ?? item)
          : []

        setDepartments(list)
        return
      }

      setDepartments([])
    } catch (err) {
      console.error("APIGetDepartments error:", err)
      showErrorMessage("Không thể tải danh sách phòng ban")
    }
  }
  useEffect(() => {
    handleGetDepartments()
  }, [])

  const columns = useMemo<DataTableColumn<Employee>[]>(
    () => [
      {
        key: "index",
        title: "STT",
        className: "w-[70px] text-slate-500",
        render: (_item, index) => index + 1,
      },
      {
        key: "employeeName",
        title: "Tên nhân viên",
        render: (item) => (
          <p className="font-semibold text-slate-900">{item.employeeName}</p>
        ),
      },
      {
        key: "employeeEmail",
        title: "Email",
        render: (item) => (
          <p className="text-sm text-slate-700">{item.employeeEmail}</p>
        ),
      },
      {
        key: "employeePhone",
        title: "Số điện thoại",
        render: (item) => (
          <p className="text-sm font-medium text-slate-700">
            {item.employeePhone}
          </p>
        ),
      },
      {
        key: "departmentId",
        title: "Phòng ban",
        render: (item) => {
          const department = departments.find(
            (departmentItem) => departmentItem.departmentName
          )

          return (
            <span className="inline-flex rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-700">
              {department?.departmentName || "Chưa có"}
            </span>
          )
        },
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
    setSelectedEmployee(null)
    setMode("create")
    reset(emptyForm)
  }

  const openCreateDialog = () => {
    setSelectedEmployee(null)
    setMode("create")
    reset(emptyForm)
    setOpen(true)
  }

  const handleCreateEmployee = async (data: EmployeePayload) => {
    try {
      setSubmitLoading(true)

      const res = await APICreateEmployee(data)

      if (res?.status === 201 || res?.status === 200) {
        showSuccessMessage("Thêm nhân viên thành công!")
        await handleGetEmployees()
        handleCloseDialog()
      }
    } catch (err: any) {
      console.error("APICreateEmployee error:", err)
      showErrorMessage(
        err?.response?.data?.message || "Thêm nhân viên thất bại!"
      )
    } finally {
      setSubmitLoading(false)
    }
  }

  const handleUpdateEmployee = async (id: string, data: EmployeePayload) => {
    try {
      setSubmitLoading(true)

      const res = await APIUpdateEmployee(id, data)

      if (res?.status === 200 || res?.status === 201) {
        showSuccessMessage("Cập nhật nhân viên thành công!")
        await handleGetEmployees()
        handleCloseDialog()
      }
    } catch (err: any) {
      console.error("APIUpdateEmployee error:", err)
      showErrorMessage(
        err?.response?.data?.message || "Cập nhật nhân viên thất bại!"
      )
    } finally {
      setSubmitLoading(false)
    }
  }

  const handleDeleteEmployee = async (id: string) => {
    try {
      setDeleteLoading(true)

      const res = await APIDeleteEmployee(id)

      if (res?.status === 200 || res?.status === 201 || res?.status === 204) {
        showSuccessMessage("Xóa nhân viên thành công!")
        setDeleteDialogOpen(false)
        setSelectedEmployee(null)
        setMode("create")
        reset(emptyForm)
        await handleGetEmployees()
        return
      }

      showErrorMessage("Xóa nhân viên thất bại!")
    } catch (err: any) {
      console.error("APIDeleteEmployee error:", err)
      showErrorMessage(
        err?.response?.data?.message || "Xóa nhân viên thất bại!"
      )
    } finally {
      setDeleteLoading(false)
    }
  }

  const onSubmit = async (data: EmployeePayload) => {
    const body: EmployeePayload = {
      employeeName: data.employeeName.trim(),
      employeeEmail: data.employeeEmail.trim(),
      employeePhone: data.employeePhone.trim(),
      departmentId: data.departmentId.trim(),
      isActive: Boolean(data.isActive),
    }

    if (isCreateMode) {
      await handleCreateEmployee(body)
      return
    }

    if (isEditMode && selectedEmployee?._id) {
      await handleUpdateEmployee(selectedEmployee._id, body)
      return
    }
  }

  const onView = async (rowData: Employee) => {
    if (!rowData?._id) {
      showErrorMessage("Không tìm thấy ID nhân viên")
      return
    }

    try {
      setDetailLoading(true)
      setSelectedEmployee(null)

      const res = await APIGetEmployeeById(rowData._id)

      if (res?.status === 200 || res?.status === 201) {
        const detail = normalizeEmployeeDetail(res)

        if (!detail?._id) {
          showErrorMessage("Không tìm thấy chi tiết nhân viên")
          return
        }

        setSelectedEmployee(detail)

        reset({
          employeeName: detail.employeeName || "",
          employeeEmail: detail.employeeEmail || "",
          employeePhone: detail.employeePhone || "",
          departmentId: detail.departmentId || "",
          isActive: Boolean(detail.isActive),
        })

        setMode("view")
        setOpen(true)
      }
    } catch (err: any) {
      console.error("APIGetEmployeeById view error:", err)
      showErrorMessage(
        err?.response?.data?.message || "Không thể tải chi tiết nhân viên"
      )
    } finally {
      setDetailLoading(false)
    }
  }

  const onEdit = async (rowData: Employee) => {
    if (!rowData?._id) {
      showErrorMessage("Không tìm thấy ID nhân viên")
      return
    }

    try {
      setDetailLoading(true)
      setSelectedEmployee(null)

      const res = await APIGetEmployeeById(rowData._id)

      if (res?.status === 200 || res?.status === 201) {
        const detail = normalizeEmployeeDetail(res)

        if (!detail?._id) {
          showErrorMessage("Không tìm thấy chi tiết nhân viên")
          return
        }

        setSelectedEmployee(detail)

        reset({
          employeeName: detail.employeeName || "",
          employeeEmail: detail.employeeEmail || "",
          employeePhone: detail.employeePhone || "",
          departmentId: detail.departmentId || "",
          isActive: Boolean(detail.isActive),
        })

        setMode("edit")
        setOpen(true)
      }
    } catch (err: any) {
      console.error("APIGetEmployeeById edit error:", err)
      showErrorMessage(
        err?.response?.data?.message || "Không thể tải dữ liệu nhân viên"
      )
    } finally {
      setDetailLoading(false)
    }
  }

  const onDeleteClick = (rowData: Employee) => {
    if (!rowData?._id) {
      showErrorMessage("Không tìm thấy ID nhân viên")
      return
    }

    setSelectedEmployee(rowData)
    setDeleteDialogOpen(true)
  }

  return (
    <div className="min-h-screen bg-slate-100 p-5">
      <div className="mx-auto max-w-7xl space-y-5">
        <div className="flex flex-col gap-3 rounded-xl bg-white p-5 shadow-sm md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-xl font-bold text-slate-900">
              Quản lý nhân viên
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              Quản lý thông tin nhân viên, email, số điện thoại, phòng ban và
              trạng thái hoạt động.
            </p>
          </div>

          <button
            type="button"
            onClick={openCreateDialog}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 text-sm font-bold text-white transition hover:bg-blue-700"
          >
            <Plus size={18} />
            Thêm nhân viên
          </button>
        </div>

        <DataTable
          data={employees}
          columns={columns}
          loading={loading}
          emptyText="Chưa có dữ liệu nhân viên"
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
            ? "Thêm nhân viên"
            : isViewMode
              ? "Chi tiết nhân viên"
              : "Chỉnh sửa nhân viên"
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
                form="employee-form"
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
            Đang tải dữ liệu nhân viên...
          </div>
        ) : (
          <form
            id="employee-form"
            onSubmit={handleSubmit(onSubmit)}
            className="grid grid-cols-1 gap-4 md:grid-cols-2"
          >
            <div>
              <label className="mb-1.5 block text-sm font-semibold text-slate-700">
                Tên nhân viên
              </label>

              <input
                disabled={isViewMode}
                className="h-10 w-full rounded-lg border border-slate-200 px-3 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:bg-slate-50 disabled:text-slate-500"
                placeholder="Ví dụ: Nguyen Van A"
                {...register("employeeName", {
                  required: "Vui lòng nhập tên nhân viên",
                  validate: (value) =>
                    value.trim().length > 0 || "Vui lòng nhập tên nhân viên",
                })}
              />

              {errors.employeeName && !isViewMode && (
                <p className="mt-1 text-xs font-medium text-red-600">
                  {errors.employeeName.message}
                </p>
              )}
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-semibold text-slate-700">
                Email
              </label>

              <input
                disabled={isViewMode}
                type="email"
                className="h-10 w-full rounded-lg border border-slate-200 px-3 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:bg-slate-50 disabled:text-slate-500"
                placeholder="Ví dụ: employee@example.com"
                {...register("employeeEmail", {
                  required: "Vui lòng nhập email",
                  pattern: {
                    value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
                    message: "Email không hợp lệ",
                  },
                })}
              />

              {errors.employeeEmail && !isViewMode && (
                <p className="mt-1 text-xs font-medium text-red-600">
                  {errors.employeeEmail.message}
                </p>
              )}
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-semibold text-slate-700">
                Số điện thoại
              </label>

              <input
                disabled={isViewMode}
                className="h-10 w-full rounded-lg border border-slate-200 px-3 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:bg-slate-50 disabled:text-slate-500"
                placeholder="Ví dụ: 0987654321"
                {...register("employeePhone", {
                  required: "Vui lòng nhập số điện thoại",
                  validate: (value) =>
                    value.trim().length > 0 || "Vui lòng nhập số điện thoại",
                })}
              />

              {errors.employeePhone && !isViewMode && (
                <p className="mt-1 text-xs font-medium text-red-600">
                  {errors.employeePhone.message}
                </p>
              )}
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-semibold text-slate-700">
                Phòng ban
              </label>

              <select
                disabled={isViewMode}
                className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:bg-slate-50 disabled:text-slate-500"
                {...register("departmentId", {
                  required: "Vui lòng chọn phòng ban",
                  validate: (value) =>
                    value.trim().length > 0 || "Vui lòng chọn phòng ban",
                })}
              >
                <option value="">-- Chọn phòng ban --</option>

                {departments.map((department) => (
                  <option key={department._id} value={department._id}>
                    {department.departmentName}
                  </option>
                ))}
              </select>

              {errors.departmentId && !isViewMode && (
                <p className="mt-1 text-xs font-medium text-red-600">
                  {errors.departmentId.message}
                </p>
              )}
            </div>

            <div className="md:col-span-2">
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
          if (!selectedEmployee?._id || deleteLoading) return
          void handleDeleteEmployee(selectedEmployee._id)
        }}
        title="Xác nhận thao tác"
        description={`Hành động này sẽ xóa nhân viên "${selectedEmployee?.employeeName}" khỏi hệ thống và không thể hoàn tác. Bạn có chắc chắn tiếp tục?`}
        confirmText={deleteLoading ? "Đang xóa..." : "Xóa"}
        cancelText="Hủy"
        tone="destructive"
      />

      {showSuccess && <AlertSuccess description={message} />}
      {showError && <AlertError description={message} />}
    </div>
  )
}
