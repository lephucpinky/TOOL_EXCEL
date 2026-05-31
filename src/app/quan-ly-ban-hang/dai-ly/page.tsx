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
  parseImportNumber,
} from "@/components/common/CrudBulkImportModal"
import DataTable, { DataTableColumn } from "@/components/common/Datatable"
import { SearchableSelect } from "@/components/select/SearchableSelect"
import { useAppDispatch, useAppSelector } from "@/store/hooks"
import { agencyActions, agencyThunks, employeeThunks } from "@/store/slices"
import { getErrorMessage } from "@/store/utils/crud"
import { Agency, AgencyPayload } from "@/types/agency"
import { Employee } from "@/types/employee"
import { normalize } from "@/utils/excel"
import { Loader2, Plus, UploadCloud, UsersRound, } from "lucide-react"
import { useEffect, useMemo, useState } from "react"
import { Controller, useForm } from "react-hook-form"
import PageHeader from "../../../components/header/PageHeader"
import ActionModal from "@/components/modal/ActionModal"

type AgencyFormValues = {
  agencyName: string
  agencyEmail: string
  employeeId: string
  commissionPercent: number
  isActive: "true" | "false"
}

const LIST_PARAMS = {
  page: 1,
  limit: 1000,
}

const emptyForm: AgencyFormValues = {
  agencyName: "",
  agencyEmail: "",
  employeeId: "",
  commissionPercent: 0,
  isActive: "true",
}

const STATUS_OPTIONS = [
  { value: "true", label: "Đang hoạt động" },
  { value: "false", label: "Ngừng hoạt động" },
]

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

type AgencyImportKey =
  | "agencyName"
  | "agencyEmail"
  | "employee"
  | "commissionPercent"
  | "status"

type AgencyImportPreview = {
  agencyName: string
  agencyEmail: string
  employee: string
  commissionPercent: string
  status: string
}

const AGENCY_IMPORT_COLUMNS: readonly BulkImportColumnDefinition<AgencyImportKey>[] =
  [
    {
      key: "agencyName",
      label: "Tên đại lý",
      aliases: ["Tên đại lý", "Đại lý", "Tên NPP"],
      required: true,
    },
    {
      key: "agencyEmail",
      label: "Email đại lý",
      aliases: ["Email đại lý", "Email", "Mail đại lý"],
      required: true,
    },
    {
      key: "employee",
      label: "Nhân viên phụ trách",
      aliases: [
        "Nhân viên phụ trách",
        "Tên nhân viên",
        "Nhân viên",
        "Employee",
      ],
      required: true,
    },
    {
      key: "commissionPercent",
      label: "% hoa hồng",
      aliases: ["% hoa hồng", "Hoa hồng", "Commission", "Commission Percent"],
      required: true,
    },
    {
      key: "status",
      label: "Trạng thái",
      aliases: ["Trạng thái", "Status"],
    },
  ]

const AGENCY_IMPORT_PREVIEW_COLUMNS: readonly BulkImportPreviewColumn<
  AgencyPayload,
  AgencyImportPreview
>[] = [
  { key: "agencyName", title: "Tên đại lý" },
  { key: "agencyEmail", title: "Email" },
  { key: "employee", title: "Nhân viên phụ trách" },
  {
    key: "commissionPercent",
    title: "% hoa hồng",
    className: "whitespace-nowrap",
  },
  { key: "status", title: "Trạng thái", className: "whitespace-nowrap" },
]

type ModeType = "create" | "view" | "edit" | null


function buildAgencyFormValues(detail: Agency | null): AgencyFormValues {
  return {
    agencyName: detail?.agencyName || "",
    agencyEmail: detail?.agencyEmail || "",
    employeeId:
      typeof detail?.employeeId === "string"
        ? detail.employeeId
        : detail?.employeeId?._id || "",
    commissionPercent: Number(detail?.commissionPercent || 0),
    isActive: detail?.isActive === false ? "false" : "true",
  }
}

function getAgencyEmployeeId(value: Agency["employeeId"] | string | undefined) {
  if (typeof value === "object") {
    return value?._id ?? ""
  }

  return value ?? ""
}

export default function Page() {
  const dispatch = useAppDispatch()
  const {
    items: agencies,
    current: selectedAgency,
    loading,
    detailLoading,
    submitLoading,
    deleteLoading,
  } = useAppSelector((state) => state.agencies)
  const { items: employees, loading: employeeLoading } = useAppSelector(
    (state) => state.employees
  )

  const [deleteTarget, setDeleteTarget] = useState<Agency | null>(null)
  const [mode, setMode] = useState<ModeType>("create")
  const [open, setOpen] = useState(false)
  const [isBulkImportOpen, setBulkImportOpen] = useState(false)
  const [isDeleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [showSuccess, setShowSuccess] = useState(false)
  const [showError, setShowError] = useState(false)
  const [message, setMessage] = useState("")

  const {
    control,
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

  const employeeOptions = useMemo(
    () =>
      employees.map((employee) => ({
        value: employee._id,
        label: employee.employeeName,
      })),
    [employees]
  )

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
    void dispatch(agencyThunks.fetchAll(LIST_PARAMS))
      .unwrap()
      .catch((error) => {
        showErrorMessage(
          getErrorMessage(error) || "Không thể tải danh sách đại lý"
        )
      })

    void dispatch(employeeThunks.fetchAll(LIST_PARAMS))
      .unwrap()
      .catch((error) => {
        showErrorMessage(
          getErrorMessage(error) || "Không thể tải danh sách nhân viên"
        )
      })
  }, [dispatch])

  const columns = useMemo<DataTableColumn<Agency>[]>(
    () => [
      {
        key: "index",
        title: "STT",
        className: "w-[10px] text-slate-500",
        render: (_item, index) => index + 1,
      },
      {
        key: "agencyNumber",
        title: "Mã đại lý",
        render: (item) => (
          <span className="inline-flex rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-700">
            {item.agencyNumber || "---"}
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
            {item.agencyEmail || "---"}
          </span>
        ),
      },
      {
        key: "employeeId",
        title: "Nhân viên phụ trách",
        render: (item) => (
          <span className="text-sm font-medium text-slate-700">
            {typeof item.employeeId === "string"
              ? employees.find(
                  (employee) =>
                    employee._id === getAgencyEmployeeId(item.employeeId)
                )?.employeeName || "---"
              : item.employeeId?.employeeName || "---"}
          </span>
        ),
      },
      {
        key: "department",
        title: "Phòng ban",
        render: (item) => {
          const employee =
            typeof item.employeeId === "string"
              ? employees.find(
                  (entry) => entry._id === getAgencyEmployeeId(item.employeeId)
                )
              : (item.employeeId as Employee | undefined)

          const department =
            typeof employee?.departmentId === "object"
              ? employee.departmentId?.departmentName
              : ""

          return (
            <span className="text-sm font-medium text-slate-700">
              {department || "---"}
            </span>
          )
        },
      },
      {
        key: "commissionPercent",
        title: "% hoa hồng",
        headerClassName: "text-right",
        className: "text-right w-[50px]",
        render: (item) => (
          <span className="inline-flex rounded-full bg-blue-50 px-3 py-1 text-xs font-bold text-blue-700">
            {item.commissionPercent}%
          </span>
        ),
      },
      {
        key: "isActive",
        title: "Trạng thái",
        className: "w-[160px] text-center",
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
    [employees]
  )

  const handleCloseDialog = () => {
    if (submitLoading || detailLoading) return

    setOpen(false)
    setMode("create")
    reset(emptyForm)
    dispatch(agencyActions.clearCurrent())
  }

  const openCreateDialog = () => {
    setMode("create")
    reset(emptyForm)
    dispatch(agencyActions.clearCurrent())
    setOpen(true)
  }

  const handleRefreshAgencies = async () => {
    await dispatch(agencyThunks.fetchAll(LIST_PARAMS)).unwrap()
  }

  const createBulkAgency = async (payload: AgencyPayload) => {
    await dispatch(agencyThunks.createItem(payload)).unwrap()
  }

  const onSubmit = async (data: AgencyFormValues) => {
    const body: AgencyPayload = {
      agencyName: data.agencyName.trim(),
      agencyEmail: data.agencyEmail.trim(),
      employeeId: data.employeeId,
      commissionPercent: Number(data.commissionPercent),
      isActive: data.isActive === "true",
    }

    try {
      if (isCreateMode) {
        await dispatch(agencyThunks.createItem(body)).unwrap()
        await handleRefreshAgencies()
        showSuccessMessage("Thêm đại lý thành công!")
        handleCloseDialog()
        return
      }

      if (isEditMode && selectedAgency?._id) {
        await dispatch(
          agencyThunks.updateItem({ id: selectedAgency._id, payload: body })
        ).unwrap()
        await handleRefreshAgencies()
        showSuccessMessage("Cập nhật đại lý thành công!")
        handleCloseDialog()
      }
    } catch (error) {
      showErrorMessage(getErrorMessage(error) || "Lưu đại lý thất bại!")
    }
  }

  const onView = async (rowData: Agency) => {
    if (!rowData?._id) {
      showErrorMessage("Không tìm thấy ID đại lý")
      return
    }

    try {
      const detail = await dispatch(
        agencyThunks.fetchById(rowData._id)
      ).unwrap()

      if (!detail?._id) {
        showErrorMessage("Không tìm thấy chi tiết đại lý")
        return
      }

      reset(buildAgencyFormValues(detail))
      setMode("view")
      setOpen(true)
    } catch (error) {
      showErrorMessage(
        getErrorMessage(error) || "Không thể tải chi tiết đại lý"
      )
    }
  }

  const onEdit = async (rowData: Agency) => {
    if (!rowData?._id) {
      showErrorMessage("Không tìm thấy ID đại lý")
      return
    }

    try {
      const detail = await dispatch(
        agencyThunks.fetchById(rowData._id)
      ).unwrap()

      if (!detail?._id) {
        showErrorMessage("Không tìm thấy chi tiết đại lý")
        return
      }

      reset(buildAgencyFormValues(detail))
      setMode("edit")
      setOpen(true)
    } catch (error) {
      showErrorMessage(getErrorMessage(error) || "Không thể tải dữ liệu đại lý")
    }
  }

  const onDeleteClick = (rowData: Agency) => {
    if (!rowData?._id) {
      showErrorMessage("Không tìm thấy ID đại lý")
      return
    }

    setDeleteTarget(rowData)
    setDeleteDialogOpen(true)
  }

  const handleDeleteAgency = async (id: string) => {
    try {
      await dispatch(agencyThunks.deleteItem(id)).unwrap()
      await handleRefreshAgencies()
      showSuccessMessage("Xóa đại lý thành công!")
      setDeleteDialogOpen(false)
      setDeleteTarget(null)
      if (selectedAgency?._id === id) {
        handleCloseDialog()
      }
    } catch (error) {
      showErrorMessage(getErrorMessage(error) || "Xóa đại lý thất bại!")
    }
  }

  const mapAgencyImportRow = ({
    rowNumber,
    getValue,
  }: {
    rowNumber: number
    getValue: (key: AgencyImportKey) => unknown
  }): BulkImportPreparedRow<AgencyPayload, AgencyImportPreview> => {
    const errors: string[] = []
    const agencyName = cleanImportText(getValue("agencyName"))
    const agencyEmail = cleanImportText(getValue("agencyEmail"))
    const employeeKeyword = cleanImportText(getValue("employee"))
    const commissionPercent = parseImportNumber(getValue("commissionPercent"))
    const isActive = parseImportBoolean(getValue("status"), true)

    const matchedEmployee =
      employees.find((employee) =>
        [
          employee._id,
          employee.employeeName,
          employee.employeeEmail,
          employee.employeePhone,
        ].some((value) => normalize(value) === normalize(employeeKeyword))
      ) || null

    if (!agencyName) {
      errors.push("Thiếu tên đại lý.")
    }

    if (!agencyEmail) {
      errors.push("Thiếu email đại lý.")
    } else if (!emailPattern.test(agencyEmail)) {
      errors.push("Email đại lý không hợp lệ.")
    }

    if (!employeeKeyword) {
      errors.push("Thiếu nhân viên phụ trách.")
    } else if (!matchedEmployee) {
      errors.push(`Không tìm thấy nhân viên phù hợp với "${employeeKeyword}".`)
    }

    if (commissionPercent < 0) {
      errors.push("% hoa hồng không được nhỏ hơn 0.")
    }

    return {
      id: `agency-${rowNumber}-${agencyEmail || agencyName}`,
      rowNumber,
      payload:
        errors.length === 0 && matchedEmployee
          ? {
              agencyName,
              agencyEmail,
              employeeId: matchedEmployee._id,
              commissionPercent,
              isActive,
            }
          : null,
      preview: {
        agencyName,
        agencyEmail,
        employee: matchedEmployee?.employeeName || employeeKeyword || "-",
        commissionPercent: `${commissionPercent}%`,
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
          icon={<UsersRound size={24} />}
          eyebrow="Danh mục bán hàng"
          title="Quản lý đại lý"
          description="Quản lý thông tin đại lý, nhân viên phụ trách và tỷ lệ hoa hồng."
          tone="emerald"
          actions={
            <>
              <button
                type="button"
                onClick={() => setBulkImportOpen(true)}
                disabled={employeeLoading}
                className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-4 text-sm font-bold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
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
                Thêm đại lý
              </button>
            </>
          }
        />

        <DataTable
          data={agencies}
          columns={columns}
          loading={loading}
          emptyText="Chưa có dữ liệu đại lý"
          getRowKey={(item) => item._id}
          pagination={{ itemLabel: "đại lý" }}
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
              <label
                htmlFor="dealer-agency-name"
                className="mb-1.5 block text-sm font-semibold text-slate-700"
              >
                Tên đại lý
              </label>

              <input
                id="dealer-agency-name"
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
              <label
                htmlFor="dealer-agency-email"
                className="mb-1.5 block text-sm font-semibold text-slate-700"
              >
                Email đại lý
              </label>

              <input
                id="dealer-agency-email"
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
              <label
                htmlFor="dealer-employee-id"
                className="mb-1.5 block text-sm font-semibold text-slate-700"
              >
                Nhân viên phụ trách
              </label>

              <Controller
                control={control}
                name="employeeId"
                render={({ field }) => (
                  <SearchableSelect
                    options={employeeOptions}
                    value={field.value || undefined}
                    onChange={field.onChange}
                    placeholder={
                      employeeLoading
                        ? "Đang tải nhân viên..."
                        : "Chọn nhân viên phụ trách"
                    }
                    searchPlaceholder="Tìm nhân viên..."
                    emptyText="Không tìm thấy nhân viên"
                    disabled={isViewMode || employeeLoading}
                  />
                )}
              />

              {errors.employeeId && !isViewMode && (
                <p className="mt-1 text-xs font-medium text-red-600">
                  {errors.employeeId.message}
                </p>
              )}
            </div>

            <div>
              <label
                htmlFor="dealer-commission-percent"
                className="mb-1.5 block text-sm font-semibold text-slate-700"
              >
                Phần trăm hoa hồng
              </label>

              <input
                id="dealer-commission-percent"
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
              <label
                htmlFor="dealer-is-active"
                className="mb-1.5 block text-sm font-semibold text-slate-700"
              >
                Trạng thái
              </label>

              <Controller
                control={control}
                name="isActive"
                rules={{
                  required: "Vui lòng chọn trạng thái",
                }}
                render={({ field }) => (
                  <SearchableSelect
                    options={STATUS_OPTIONS}
                    value={field.value}
                    onChange={field.onChange}
                    placeholder="Chọn trạng thái"
                    searchPlaceholder="Tìm trạng thái..."
                    emptyText="Không tìm thấy trạng thái"
                    disabled={isViewMode}
                  />
                )}
              />

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
          if (!deleteTarget?._id || deleteLoading) return
          void handleDeleteAgency(deleteTarget._id)
        }}
        title="Xác nhận thao tác"
        description={`Hành động này sẽ xóa đại lý "${deleteTarget?.agencyName}" khỏi hệ thống và không thể hoàn tác. Bạn có chắc chắn tiếp tục?`}
        confirmText={deleteLoading ? "Đang xóa..." : "Xóa"}
        cancelText="Hủy"
        tone="destructive"
      />

      <CrudBulkImportModal
        open={isBulkImportOpen}
        title="Tạo đại lý hàng loạt từ Excel"
        entityLabel="đại lý"
        columns={AGENCY_IMPORT_COLUMNS}
        previewColumns={AGENCY_IMPORT_PREVIEW_COLUMNS}
        notes={[
          'Cột "Nhân viên phụ trách" có thể nhập theo tên, email hoặc ID nhân viên.',
          'Cột "Trạng thái" có thể để trống, hệ thống sẽ mặc định là Đang hoạt động.',
        ]}
        onClose={() => setBulkImportOpen(false)}
        onCompleted={handleRefreshAgencies}
        mapRow={mapAgencyImportRow}
        createItem={createBulkAgency}
      />

      {showSuccess && <AlertSuccess description={message} />}
      {showError && <AlertError description={message} />}
    </div>
  )
}
