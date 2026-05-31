"use client"

import AlertError from "@/components/alert/AlertError"
import AlertOption from "@/components/alert/AlertOption"
import AlertSuccess from "@/components/alert/AlertSuccess"
import CrudBulkImportModal, {
  BulkImportColumnDefinition,
  BulkImportPreparedRow,
  BulkImportPreviewColumn,
  cleanImportText,
  parseImportBoolean,
} from "@/components/common/CrudBulkImportModal"
import DataTable, { DataTableColumn } from "@/components/common/Datatable"
import { useAppDispatch, useAppSelector } from "@/store/hooks"
import { departmentActions, departmentThunks } from "@/store/slices"
import { getErrorMessage } from "@/store/utils/crud"
import { Department, DepartmentPayload } from "@/types/department"
import { Building2, Loader2, Plus, RefreshCcw, UploadCloud } from "lucide-react"
import { useEffect, useMemo, useState } from "react"
import { useForm } from "react-hook-form"
import PageHeader from "../../../components/header/PageHeader"
import ActionModal from "@/components/modal/ActionModal"

const LIST_PARAMS = {
  page: 1,
  limit: 1000,
}

const emptyForm: DepartmentPayload = {
  departmentName: "",
  departmentDescription: "",
  isActive: true,
}

type DepartmentImportKey = "departmentName" | "departmentDescription" | "status"

type DepartmentImportPreview = {
  departmentName: string
  departmentDescription: string
  status: string
}

const DEPARTMENT_IMPORT_COLUMNS: readonly BulkImportColumnDefinition<DepartmentImportKey>[] =
  [
    {
      key: "departmentName",
      label: "Tên phòng ban",
      aliases: ["Tên phòng ban", "Phòng ban", "Department Name"],
      required: true,
    },
    {
      key: "departmentDescription",
      label: "Mô tả",
      aliases: ["Mô tả", "Diễn giải", "Description"],
      required: true,
    },
    {
      key: "status",
      label: "Trạng thái",
      aliases: ["Trạng thái", "Status"],
    },
  ]

const DEPARTMENT_IMPORT_PREVIEW_COLUMNS: readonly BulkImportPreviewColumn<
  DepartmentPayload,
  DepartmentImportPreview
>[] = [
  { key: "departmentName", title: "Tên phòng ban" },
  { key: "departmentDescription", title: "Mô tả" },
  { key: "status", title: "Trạng thái", className: "whitespace-nowrap" },
]

type ModeType = "create" | "view" | "edit" | null

function buildDepartmentFormValues(
  detail: Department | null
): DepartmentPayload {
  return {
    departmentName: detail?.departmentName || "",
    departmentDescription: detail?.departmentDescription || "",
    isActive: Boolean(detail?.isActive),
  }
}

export default function DepartmentPage() {
  const dispatch = useAppDispatch()
  const {
    items: departments,
    current: selectedDepartment,
    loading,
    detailLoading,
    submitLoading,
    deleteLoading,
  } = useAppSelector((state) => state.departments)

  const [deleteTarget, setDeleteTarget] = useState<Department | null>(null)
  const [mode, setMode] = useState<ModeType>("create")
  const [open, setOpen] = useState(false)
  const [isBulkImportOpen, setBulkImportOpen] = useState(false)
  const [isDeleteDialogOpen, setDeleteDialogOpen] = useState(false)
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

  useEffect(() => {
    void dispatch(departmentThunks.fetchAll(LIST_PARAMS))
      .unwrap()
      .catch((error) => {
        showErrorMessage(
          getErrorMessage(error) || "Không thể tải danh sách phòng ban"
        )
      })
  }, [dispatch])

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
            <span className="inline-flex rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700">
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
    setMode("create")
    reset(emptyForm)
    dispatch(departmentActions.clearCurrent())
  }

  const openCreateDialog = () => {
    setMode("create")
    reset(emptyForm)
    dispatch(departmentActions.clearCurrent())
    setOpen(true)
  }

  const handleRefreshDepartments = async () => {
    await dispatch(departmentThunks.fetchAll(LIST_PARAMS)).unwrap()
  }

  const onRefreshDepartments = async () => {
    try {
      await handleRefreshDepartments()
    } catch (error) {
      showErrorMessage(
        getErrorMessage(error) || "Không thể tải lại danh sách phòng ban"
      )
    }
  }

  const createBulkDepartment = async (payload: DepartmentPayload) => {
    await dispatch(departmentThunks.createItem(payload)).unwrap()
  }

  const onSubmit = async (data: DepartmentPayload) => {
    const body: DepartmentPayload = {
      departmentName: data.departmentName.trim(),
      departmentDescription: data.departmentDescription.trim(),
      isActive: Boolean(data.isActive),
    }

    try {
      if (isCreateMode) {
        await dispatch(departmentThunks.createItem(body)).unwrap()
        await handleRefreshDepartments()
        showSuccessMessage("Thêm phòng ban thành công!")
        handleCloseDialog()
        return
      }

      if (isEditMode && selectedDepartment?._id) {
        await dispatch(
          departmentThunks.updateItem({
            id: selectedDepartment._id,
            payload: body,
          })
        ).unwrap()
        await handleRefreshDepartments()
        showSuccessMessage("Cập nhật phòng ban thành công!")
        handleCloseDialog()
      }
    } catch (error) {
      showErrorMessage(getErrorMessage(error) || "Lưu phòng ban thất bại!")
    }
  }

  const onView = async (rowData: Department) => {
    if (!rowData?._id) {
      showErrorMessage("Không tìm thấy ID phòng ban")
      return
    }

    try {
      const detail = await dispatch(
        departmentThunks.fetchById(rowData._id)
      ).unwrap()

      if (!detail?._id) {
        showErrorMessage("Không tìm thấy chi tiết phòng ban")
        return
      }

      reset(buildDepartmentFormValues(detail))
      setMode("view")
      setOpen(true)
    } catch (error) {
      showErrorMessage(
        getErrorMessage(error) || "Không thể tải chi tiết phòng ban"
      )
    }
  }

  const onEdit = async (rowData: Department) => {
    if (!rowData?._id) {
      showErrorMessage("Không tìm thấy ID phòng ban")
      return
    }

    try {
      const detail = await dispatch(
        departmentThunks.fetchById(rowData._id)
      ).unwrap()

      if (!detail?._id) {
        showErrorMessage("Không tìm thấy chi tiết phòng ban")
        return
      }

      reset(buildDepartmentFormValues(detail))
      setMode("edit")
      setOpen(true)
    } catch (error) {
      showErrorMessage(
        getErrorMessage(error) || "Không thể tải dữ liệu phòng ban"
      )
    }
  }

  const onDeleteClick = (rowData: Department) => {
    if (!rowData?._id) {
      showErrorMessage("Không tìm thấy ID phòng ban")
      return
    }

    setDeleteTarget(rowData)
    setDeleteDialogOpen(true)
  }

  const handleDeleteDepartment = async (id: string) => {
    try {
      await dispatch(departmentThunks.deleteItem(id)).unwrap()
      await handleRefreshDepartments()
      showSuccessMessage("Xóa phòng ban thành công!")
      setDeleteDialogOpen(false)
      setDeleteTarget(null)
      if (selectedDepartment?._id === id) {
        handleCloseDialog()
      }
    } catch (error) {
      showErrorMessage(getErrorMessage(error) || "Xóa phòng ban thất bại!")
    }
  }

  const mapDepartmentImportRow = ({
    rowNumber,
    getValue,
  }: {
    rowNumber: number
    getValue: (key: DepartmentImportKey) => unknown
  }): BulkImportPreparedRow<DepartmentPayload, DepartmentImportPreview> => {
    const errors: string[] = []
    const departmentName = cleanImportText(getValue("departmentName"))
    const departmentDescription = cleanImportText(
      getValue("departmentDescription")
    )
    const isActive = parseImportBoolean(getValue("status"), true)

    if (!departmentName) {
      errors.push("Thiếu tên phòng ban.")
    }

    if (!departmentDescription) {
      errors.push("Thiếu mô tả phòng ban.")
    }

    return {
      id: `department-${rowNumber}-${departmentName}`,
      rowNumber,
      payload:
        errors.length === 0
          ? {
              departmentName,
              departmentDescription,
              isActive,
            }
          : null,
      preview: {
        departmentName,
        departmentDescription,
        status: isActive ? "Đang hoạt động" : "Ngừng hoạt động",
      },
      errors,
      warnings: [],
    }
  }

  return (
    <div className="min-h-screen p-5">
      <div className="mx-auto max-w-7xl space-y-5">
        <PageHeader
          icon={<Building2 size={24} />}
          eyebrow="Tổ chức dữ liệu"
          title="Quản lý phòng ban"
          description="Tạo và cập nhật phòng ban để phân loại dữ liệu bán hàng."
          tone="violet"
          actions={
            <>
              <button
                type="button"
                onClick={() => setBulkImportOpen(true)}
                className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-4 text-sm font-bold text-slate-700 transition hover:bg-slate-50"
              >
                <UploadCloud size={18} />
                Tạo hàng loạt
              </button>

              <button
                type="button"
                onClick={openCreateDialog}
                className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 text-sm font-bold text-white transition hover:bg-blue-700"
              >
                <Plus size={18} />
                Thêm phòng ban
              </button>
              <button
                type="button"
                onClick={() => void onRefreshDepartments()}
                disabled={loading}
                className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-4 text-sm font-bold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <RefreshCcw
                  size={18}
                  className={loading ? "animate-spin" : undefined}
                />
                Tải dữ liệu
              </button>
            </>
          }
        />

        <DataTable
          data={departments}
          columns={columns}
          loading={loading}
          emptyText="Chưa có dữ liệu phòng ban"
          getRowKey={(item) => item._id}
          pagination={{ itemLabel: "phòng ban" }}
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
              <label
                htmlFor="department-name"
                className="mb-1.5 block text-sm font-semibold text-slate-700"
              >
                Tên phòng ban
              </label>

              <input
                id="department-name"
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
              <label
                htmlFor="department-description"
                className="mb-1.5 block text-sm font-semibold text-slate-700"
              >
                Mô tả
              </label>

              <textarea
                id="department-description"
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
              <label
                htmlFor="department-is-active"
                className="mb-1.5 block text-sm font-semibold text-slate-700"
              >
                Trạng thái
              </label>

              <label
                htmlFor="department-is-active"
                className="flex h-11 items-center gap-3 rounded-lg border border-slate-200 px-3"
              >
                <input
                  id="department-is-active"
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

      <CrudBulkImportModal
        open={isBulkImportOpen}
        title="Tạo phòng ban hàng loạt từ Excel"
        entityLabel="phòng ban"
        columns={DEPARTMENT_IMPORT_COLUMNS}
        previewColumns={DEPARTMENT_IMPORT_PREVIEW_COLUMNS}
        notes={[
          'Cột "Trạng thái" có thể để trống, hệ thống sẽ mặc định là Đang hoạt động.',
        ]}
        onClose={() => setBulkImportOpen(false)}
        onCompleted={handleRefreshDepartments}
        mapRow={mapDepartmentImportRow}
        createItem={createBulkDepartment}
      />

      <AlertOption
        isOpen={isDeleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        onConfirm={() => {
          if (!deleteTarget?._id || deleteLoading) return
          void handleDeleteDepartment(deleteTarget._id)
        }}
        title="Xác nhận thao tác"
        description={`Hành động này sẽ xóa phòng ban "${deleteTarget?.departmentName}" khỏi hệ thống và không thể hoàn tác. Bạn có chắc chắn tiếp tục?`}
        confirmText={deleteLoading ? "Đang xóa..." : "Xóa"}
        cancelText="Hủy"
        tone="destructive"
      />

      {showSuccess && <AlertSuccess description={message} />}
      {showError && <AlertError description={message} />}
    </div>
  )
}
