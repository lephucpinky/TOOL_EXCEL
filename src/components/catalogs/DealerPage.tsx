"use client"

import {
  APICreateAgency,
  APIDeleteAgency,
  APIGetAgencies,
  APIGetAgencyById,
  APIUpdateAgency,
} from "@/services/agency"
import { Agency } from "@/types/agency"
import DataTable, { DataTableColumn } from "../common/Datatable"
import AlertOption from "@/components/alert/AlertOption"
import AlertSuccess from "@/components/alert/AlertSuccess"
import AlertError from "@/components/alert/AlertError"
import { Loader2, Plus, X } from "lucide-react"
import { ReactNode, useEffect, useMemo, useState } from "react"
import { useForm } from "react-hook-form"
import { Employee } from "@/types/employee"
import { APIGetEmployees } from "@/services/employee"
type AgencyFormValues = {
  agencyName: string
  agencyEmail: string
  employeeId: string
  commissionPercent: number
  isActive: "true" | "false"
}

type AgencyRequestPayload = {
  agencyName: string
  agencyEmail: string
  employeeId: string
  commissionPercent: number
  isActive: boolean
}

const emptyForm: AgencyFormValues = {
  agencyName: "",
  agencyEmail: "",
  employeeId: "",
  commissionPercent: 0,
  isActive: "true",
}
type ModeType = "create" | "view" | "edit" | null

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

export default function DealerPage() {
  const [agencies, setAgencies] = useState<Agency[]>([])
  const [selectedAgency, setSelectedAgency] = useState<Agency | null>(null)
  const [employees, setEmployees] = useState<Employee[]>([])
  const [employeeLoading, setEmployeeLoading] = useState(false)

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
  } = useForm<AgencyFormValues>({
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

  const handleGetAgencies = async () => {
    try {
      setLoading(true)

      const response = await APIGetAgencies()

      if (response?.status === 200 && Array.isArray(response.data)) {
        setAgencies(response.data)
        return
      }

      setAgencies([])
    } catch (err) {
      console.error("APIGetAgencies error:", err)
      showErrorMessage("Không thể tải danh sách đại lý")
    } finally {
      setLoading(false)
    }
  }
  const handleGetEmployees = async () => {
    try {
      setEmployeeLoading(true)

      const response = await APIGetEmployees()

      if (response?.status === 200 && Array.isArray(response.data)) {
        setEmployees(response.data)
        return
      }

      setEmployees([])
    } catch (err) {
      console.error("APIGetEmployees error:", err)
      showErrorMessage("Không thể tải danh sách nhân viên")
    } finally {
      setEmployeeLoading(false)
    }
  }

  useEffect(() => {
    handleGetAgencies()
    handleGetEmployees()
  }, [])
  useEffect(() => {
    console.log("=== AGENCIES STATE UPDATED ===", agencies)
    console.log("=== AGENCIES LENGTH ===", agencies.length)
  }, [agencies])

  const columns = useMemo<DataTableColumn<Agency>[]>(
    () => [
      {
        key: "index",
        title: "STT",
        className: "w-[70px] text-slate-500",
        render: (_item, index) => index + 1,
      },
      {
        key: "agencyNumber",
        title: "Mã đại lý",
        render: (item) => (
          <span className="inline-flex rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-700">
            {item.agencyNumber || "-.-"}
          </span>
        ),
      },
      {
        key: "agencyName",
        title: "Tên đại lý",
        render: (item) => (
          <p className="font-semibold text-slate-900">{item.agencyName}</p>
        ),
      },
      {
        key: "agencyEmail",
        title: "Email đại lý",
        render: (item) => (
          <span className="text-sm font-medium text-slate-700">
            {item.agencyEmail || "-.-"}
          </span>
        ),
      },
      {
        key: "employeeId",
        title: "Nhân viên phụ trách",
        render: (item) => (
          <span className="text-sm font-medium text-slate-700">
            {item.employeeId?.employeeName || "-.-"}
          </span>
        ),
      },
      {
        key: "department",
        title: "Phòng ban",
        render: (item) => (
          <span className="text-sm font-medium text-slate-700">
            {item.employeeId?.departmentId?.departmentName || "-.-"}
          </span>
        ),
      },
      {
        key: "commissionPercent",
        title: "% hoa hồng",
        headerClassName: "text-right",
        className: "text-right",
        render: (item) => (
          <span className="inline-flex rounded-full bg-blue-50 px-3 py-1 text-xs font-bold text-blue-700">
            {item.commissionPercent}%
          </span>
        ),
      },
      {
        key: "isActive",
        title: "Trạng thái",
        render: (item) => (
          <span
            className={[
              "inline-flex rounded-full px-3 py-1 text-xs font-bold",
              item.isActive
                ? "bg-emerald-50 text-emerald-700"
                : "bg-slate-100 text-slate-500",
            ].join(" ")}
          >
            {item.isActive ? "Đang hoạt động" : "Ngừng hoạt động"}
          </span>
        ),
      },
    ],
    []
  )

  const handleCloseDialog = () => {
    if (submitLoading || detailLoading) return

    setOpen(false)
    setSelectedAgency(null)
    setMode("create")
    reset(emptyForm)
  }

  const openCreateDialog = () => {
    setSelectedAgency(null)
    setMode("create")
    reset(emptyForm)
    setOpen(true)
  }

  const handleCreateAgency = async (data: AgencyRequestPayload) => {
    try {
      setSubmitLoading(true)

      const res = await APICreateAgency(data)

      if (res?.status === 201 || res?.status === 200) {
        showSuccessMessage("Thêm đại lý thành công!")
        await handleGetAgencies()
        handleCloseDialog()
      }
    } catch (err: any) {
      console.error("APICreateAgency error:", err)
      showErrorMessage(err?.response?.data?.message || "Thêm đại lý thất bại!")
    } finally {
      setSubmitLoading(false)
    }
  }

  const handleUpdateAgency = async (id: string, data: AgencyRequestPayload) => {
    try {
      setSubmitLoading(true)

      const res = await APIUpdateAgency(id, data)

      if (res?.status === 200 || res?.status === 201) {
        showSuccessMessage("Cập nhật đại lý thành công!")
        await handleGetAgencies()
        handleCloseDialog()
      }
    } catch (err: any) {
      console.error("APIUpdateAgency error:", err)
      showErrorMessage(
        err?.response?.data?.message || "Cập nhật đại lý thất bại!"
      )
    } finally {
      setSubmitLoading(false)
    }
  }

  const handleDeleteAgency = async (id: string) => {
    console.log("=== handleDeleteAgency called with ID ===", id)

    try {
      console.log("=== Starting delete process ===")
      setDeleteLoading(true)

      const res = await APIDeleteAgency(id)
      console.log("=== API delete response ===", res)

      if (res?.status === 200 || res?.status === 201 || res?.status === 204) {
        console.log("=== Delete successful, status ===", res?.status)
        showSuccessMessage("Xóa đại lý thành công!")
        console.log("=== Closing delete dialog and resetting state ===")
        setDeleteDialogOpen(false)
        setSelectedAgency(null)
        setMode("create")
        reset(emptyForm)
        console.log("=== Refreshing agencies list ===")
        await handleGetAgencies()
        return
      }

      console.log("=== Delete failed with status ===", res?.status)
      showErrorMessage("Xóa đại lý thất bại!")
    } catch (err: any) {
      console.error("APIDeleteAgency error:", err)
      showErrorMessage(err?.response?.data?.message || "Xóa đại lý thất bại!")
    } finally {
      console.log("=== Finished delete process ===")
      setDeleteLoading(false)
    }
  }

  const onSubmit = async (data: AgencyFormValues) => {
    const body: AgencyRequestPayload = {
      agencyName: data.agencyName.trim(),
      agencyEmail: data.agencyEmail.trim(),
      employeeId: data.employeeId,
      commissionPercent: Number(data.commissionPercent),
      isActive: data.isActive === "true",
    }

    if (isCreateMode) {
      await handleCreateAgency(body)
      return
    }

    if (isEditMode && selectedAgency?._id) {
      await handleUpdateAgency(selectedAgency._id, body)
    }
  }
  const onView = async (rowData: Agency) => {
    console.log("=== onView clicked with rowData ===", rowData)

    if (!rowData?._id) {
      console.log("=== ERROR: No _id found ===")
      showErrorMessage("Không tìm thấy ID đại lý")
      return
    }

    try {
      console.log("=== Starting detail loading for ID ===", rowData._id)
      setDetailLoading(true)
      setSelectedAgency(null)

      const res = await APIGetAgencyById(rowData._id)
      console.log("=== API response for onView ===", res)

      if (res?.status === 200 && res.data?._id) {
        const detail = res.data as Agency

        setSelectedAgency(detail)

        reset({
          agencyName: detail.agencyName || "",
          agencyEmail: detail.agencyEmail || "",
          employeeId:
            typeof detail.employeeId === "string"
              ? detail.employeeId
              : detail.employeeId?._id || "",
          commissionPercent: Number(detail.commissionPercent || 0),
          isActive: detail.isActive === false ? "false" : "true",
        })

        setMode("view")
        setOpen(true)
      } else {
        showErrorMessage("Không tìm thấy chi tiết đại lý")
      }
    } catch (err: any) {
      console.error("APIGetAgencyById view error:", err)
      showErrorMessage(
        err?.response?.data?.message || "Không thể tải chi tiết đại lý"
      )
    } finally {
      console.log("=== Finished detail loading ===")
      setDetailLoading(false)
    }
  }
  const onEdit = async (rowData: Agency) => {
    console.log("=== onEdit clicked with rowData ===", rowData)

    if (!rowData?._id) {
      console.log("=== ERROR: No _id found ===")
      showErrorMessage("Không tìm thấy ID đại lý")
      return
    }

    try {
      console.log("=== Starting detail loading for edit, ID ===", rowData._id)
      setDetailLoading(true)
      setSelectedAgency(null)

      const res = await APIGetAgencyById(rowData._id)
      console.log("=== API response for onEdit ===", res)

      if (res?.status === 200 && res.data?._id) {
        const detail = res.data as Agency

        setSelectedAgency(detail)

        reset({
          agencyName: detail.agencyName || "",
          agencyEmail: detail.agencyEmail || "",
          employeeId:
            typeof detail.employeeId === "string"
              ? detail.employeeId
              : detail.employeeId?._id || "",
          commissionPercent: Number(detail.commissionPercent || 0),
          isActive: detail.isActive === false ? "false" : "true",
        })

        setMode("edit")
        setOpen(true)
      } else {
        showErrorMessage("Không tìm thấy chi tiết đại lý")
      }
    } catch (err: any) {
      console.error("APIGetAgencyById edit error:", err)
      showErrorMessage(
        err?.response?.data?.message || "Không thể tải dữ liệu đại lý"
      )
    } finally {
      console.log("=== Finished detail loading for edit ===")
      setDetailLoading(false)
    }
  }

  const onDeleteClick = (rowData: Agency) => {
    console.log("=== onDeleteClick clicked with rowData ===", rowData)

    if (!rowData?._id) {
      console.log("=== ERROR: No _id found ===")
      showErrorMessage("Không tìm thấy ID đại lý")
      return
    }

    console.log(
      "=== Setting selected agency for delete and opening dialog ===",
      rowData
    )
    setSelectedAgency(rowData)
    setDeleteDialogOpen(true)
  }

  return (
    <div className="min-h-screen bg-slate-100 p-5">
      <div className="mx-auto max-w-7xl space-y-5">
        <div className="flex flex-col gap-3 rounded-xl bg-white p-5 shadow-sm md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-xl font-bold text-slate-900">Quản lý đại lý</h1>
            {/* <p className="mt-1 text-sm text-slate-500">
              Quản lý tên đại lý và phần trăm hoa hồng.
            </p> */}
          </div>

          <button
            type="button"
            onClick={openCreateDialog}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 text-sm font-bold text-white transition hover:bg-blue-700"
          >
            <Plus size={18} />
            Thêm đại lý
          </button>
        </div>

        <DataTable
          data={agencies}
          columns={columns}
          loading={loading}
          emptyText="Chưa có dữ liệu đại lý"
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
            ? "Thêm đại lý"
            : isViewMode
              ? "Chi tiết đại lý"
              : "Chỉnh sửa đại lý"
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
                form="dealer-form"
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
            Đang tải dữ liệu đại lý...
          </div>
        ) : (
          <form
            id="dealer-form"
            onSubmit={handleSubmit(onSubmit)}
            className="space-y-4"
          >
            <div>
              <label className="mb-1.5 block text-sm font-semibold text-slate-700">
                Tên đại lý
              </label>

              <input
                disabled={isViewMode}
                className="h-10 w-full rounded-lg border border-slate-200 px-3 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:bg-slate-50 disabled:text-slate-500"
                placeholder="Nhập tên đại lý"
                {...register("agencyName", {
                  required: "Vui lòng nhập tên đại lý",
                  validate: (value) =>
                    value.trim().length > 0 || "Vui lòng nhập tên đại lý",
                })}
              />

              {errors.agencyName && !isViewMode && (
                <p className="mt-1 text-xs font-medium text-red-600">
                  {errors.agencyName.message}
                </p>
              )}
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-semibold text-slate-700">
                Email đại lý
              </label>

              <input
                disabled={isViewMode}
                type="email"
                className="h-10 w-full rounded-lg border border-slate-200 px-3 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:bg-slate-50 disabled:text-slate-500"
                placeholder="Nhập email đại lý"
                {...register("agencyEmail", {
                  required: "Vui lòng nhập email đại lý",
                  validate: (value) =>
                    value.trim().length > 0 || "Vui lòng nhập email đại lý",
                  pattern: {
                    value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
                    message: "Email đại lý không hợp lệ",
                  },
                })}
              />

              {errors.agencyEmail && !isViewMode && (
                <p className="mt-1 text-xs font-medium text-red-600">
                  {errors.agencyEmail.message}
                </p>
              )}
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-semibold text-slate-700">
                Nhân viên phụ trách
              </label>

              <select
                disabled={isViewMode || employeeLoading}
                className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:bg-slate-50 disabled:text-slate-500"
                {...register("employeeId", {
                  required: "Vui lòng chọn nhân viên phụ trách",
                })}
              >
                <option value="">
                  {employeeLoading
                    ? "Đang tải nhân viên..."
                    : "Chọn nhân viên phụ trách"}
                </option>

                {employees.map((employee) => (
                  <option key={employee._id} value={employee._id}>
                    {employee.employeeName}
                  </option>
                ))}
              </select>

              {errors.employeeId && !isViewMode && (
                <p className="mt-1 text-xs font-medium text-red-600">
                  {errors.employeeId.message}
                </p>
              )}
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-semibold text-slate-700">
                Phần trăm hoa hồng
              </label>

              <input
                disabled={isViewMode}
                type="number"
                min={0}
                step="0.01"
                className="h-10 w-full rounded-lg border border-slate-200 px-3 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:bg-slate-50 disabled:text-slate-500"
                placeholder="Nhập % hoa hồng"
                {...register("commissionPercent", {
                  required: "Vui lòng nhập phần trăm hoa hồng",
                  valueAsNumber: true,
                  min: {
                    value: 0,
                    message: "Phần trăm hoa hồng không được nhỏ hơn 0",
                  },
                  validate: (value) =>
                    !Number.isNaN(Number(value)) ||
                    "Phần trăm hoa hồng không hợp lệ",
                })}
              />

              {errors.commissionPercent && !isViewMode && (
                <p className="mt-1 text-xs font-medium text-red-600">
                  {errors.commissionPercent.message}
                </p>
              )}
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-semibold text-slate-700">
                Trạng thái
              </label>

              <select
                disabled={isViewMode}
                className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:bg-slate-50 disabled:text-slate-500"
                {...register("isActive", {
                  required: "Vui lòng chọn trạng thái",
                })}
              >
                <option value="true">Đang hoạt động</option>
                <option value="false">Ngừng hoạt động</option>
              </select>

              {errors.isActive && !isViewMode && (
                <p className="mt-1 text-xs font-medium text-red-600">
                  {errors.isActive.message}
                </p>
              )}
            </div>
          </form>
        )}
      </ActionModal>

      <AlertOption
        isOpen={isDeleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        onConfirm={() => {
          if (!selectedAgency?._id) return
          void handleDeleteAgency(selectedAgency._id)
        }}
        title="Xác nhận thao tác"
        description={`Hành động này sẽ xóa đại lý "${selectedAgency?.agencyName}" khỏi hệ thống và không thể hoàn tác. Bạn có chắc chắn tiếp tục?`}
        confirmText="Xóa"
        cancelText="Hủy"
        tone="destructive"
      />

      {showSuccess && <AlertSuccess description={message} />}
      {showError && <AlertError description={message} />}
    </div>
  )
}
