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
import InvoiceFilterSelect from "@/components/minvoice/InvoiceFilterSelect"
import { useAppDispatch, useAppSelector } from "@/store/hooks"
import {
  departmentThunks,
  employeeActions,
  employeeThunks,
} from "@/store/slices"
import { getErrorMessage } from "@/store/utils/crud"
import { Department } from "@/types/department"
import { Employee, EmployeePayload } from "@/types/employee"
import { normalize } from "@/utils/excel"
import {
  Loader2,
  Plus,
  RefreshCcw,
  UploadCloud,
  UserRound,
  X,
} from "lucide-react"
import { useSearchParams } from "next/navigation"
import { useEffect, useMemo, useState } from "react"
import { useForm } from "react-hook-form"
import PageHeader from "../../../components/header/PageHeader"
import ActionModal from "@/components/modal/ActionModal"
import { useTransientAlert } from "@/hooks/useTransientAlert"
import { DEFAULT_URL_PAGE, getPositiveInteger } from "@/utils/pagination"
import { scheduleDelayedRefresh } from "@/utils/refresh"
const LIST_PARAMS = {}
const EMPLOYEE_PAGE_SIZE_OPTIONS = [50, 100, 200, 300]
const EMPLOYEE_DEFAULT_LIMIT = 50
const emptyForm: EmployeePayload = {
  employeeName: "",
  employeeEmail: "",
  employeePhone: "",
  departmentId: "",
  isActive: true,
}

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

type EmployeeImportKey =
  | "employeeName"
  | "employeeEmail"
  | "employeePhone"
  | "department"
  | "status"

type EmployeeImportPreview = {
  employeeName: string
  employeeEmail: string
  employeePhone: string
  department: string
  status: string
}

const EMPLOYEE_IMPORT_COLUMNS: readonly BulkImportColumnDefinition<EmployeeImportKey>[] =
  [
    {
      key: "employeeName",
      label: "Tên nhân viên",
      aliases: ["Tên nhân viên", "Nhân viên", "Employee Name"],
      required: true,
    },
    {
      key: "employeeEmail",
      label: "Email",
      aliases: ["Email", "Employee Email"],
      required: true,
    },
    {
      key: "employeePhone",
      label: "Số điện thoại",
      aliases: ["Số điện thoại", "Điện thoại", "Phone"],
      required: true,
    },
    {
      key: "department",
      label: "Phòng ban",
      aliases: [
        "Phòng ban",
        "Tên phòng ban",
        "Department",
        "Department Name",
        "departmentName",
      ],
      required: true,
    },
    {
      key: "status",
      label: "Trạng thái",
      aliases: ["Trạng thái", "Status"],
    },
  ]

const EMPLOYEE_IMPORT_PREVIEW_COLUMNS: readonly BulkImportPreviewColumn<
  EmployeePayload,
  EmployeeImportPreview
>[] = [
  { key: "employeeName", title: "Tên nhân viên" },
  { key: "employeeEmail", title: "Email" },
  {
    key: "employeePhone",
    title: "Số điện thoại",
    className: "whitespace-nowrap",
  },
  { key: "department", title: "Phòng ban" },
  { key: "status", title: "Trạng thái", className: "whitespace-nowrap" },
]

type ModeType = "create" | "view" | "edit" | null

type EmployeeTableFilters = {
  employeeName: string
  employeeEmail: string
  employeePhone: string
  departmentId: string
  isActive: string
}

const EMPTY_EMPLOYEE_TABLE_FILTERS: EmployeeTableFilters = {
  employeeName: "",
  employeeEmail: "",
  employeePhone: "",
  departmentId: "",
  isActive: "",
}

const employeeFilterControlClassName =
  "h-8 w-full min-w-0 rounded border border-slate-300 bg-white px-2 text-xs font-normal text-slate-800 outline-none transition placeholder:text-slate-400 hover:border-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100"

function EmployeeTextFilter({
  label,
  value,
  onChange,
}: {
  label: string
  value: string
  onChange: (value: string) => void
}) {
  return (
    <input
      type="text"
      value={value}
      onChange={(event) => onChange(event.target.value)}
      placeholder=""
      aria-label={`Lọc theo ${label}`}
      className={employeeFilterControlClassName}
    />
  )
}

function EmployeeSelectFilter({
  id,
  label,
  value,
  onChange,
  options,
}: {
  id: string
  label: string
  value: string
  onChange: (value: string) => void
  options: { value: string; label: string }[]
}) {
  return (
    <InvoiceFilterSelect
      id={id}
      value={value}
      onChange={onChange}
      searchPlaceholder={`Tìm ${label.toLowerCase()}...`}
      emptyText={`Không tìm thấy ${label.toLowerCase()}`}
      options={[{ value: "", label: "-" }, ...options]}
    />
  )
}

const EMPLOYEE_STATUS_OPTIONS = [
  { value: "true", label: "Hoạt động" },
  { value: "false", label: "Ngừng hoạt động" },
]

function getDepartmentId(value: Employee["departmentId"] | string | undefined) {
  if (typeof value === "object") {
    return value?._id ?? ""
  }

  return value ?? ""
}

function buildEmployeeFormValues(detail: Employee | null): EmployeePayload {
  return {
    employeeName: detail?.employeeName || "",
    employeeEmail: detail?.employeeEmail || "",
    employeePhone: detail?.employeePhone || "",
    departmentId: getDepartmentId(detail?.departmentId),
    isActive: Boolean(detail?.isActive),
  }
}

function normalizeEmployeePayload(data: EmployeePayload): EmployeePayload {
  return {
    employeeName: data.employeeName.trim(),
    employeeEmail: data.employeeEmail.trim(),
    employeePhone: data.employeePhone.trim(),
    departmentId: data.departmentId.trim(),
    isActive: Boolean(data.isActive),
  }
}

export default function EmployeePage() {
  const searchParams = useSearchParams()
  const dispatch = useAppDispatch()
  const {
    items: employees,
    current: selectedEmployee,
    loading,
    detailLoading,
    submitLoading,
    deleteLoading,
    pagination: employeePagination,
  } = useAppSelector((state) => state.employees)
  const { items: departments, loading: departmentLoading } = useAppSelector(
    (state) => state.departments
  )

  const [deleteTarget, setDeleteTarget] = useState<Employee | null>(null)
  const [mode, setMode] = useState<ModeType>("create")
  const [open, setOpen] = useState(false)
  const [isBulkImportOpen, setBulkImportOpen] = useState(false)
  const [isDeleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [tableFilters, setTableFilters] = useState<EmployeeTableFilters>(
    EMPTY_EMPLOYEE_TABLE_FILTERS
  )
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
  } = useForm<EmployeePayload>({
    defaultValues: emptyForm,
  })

  const isViewMode = mode === "view"
  const isEditMode = mode === "edit"
  const isCreateMode = mode === "create"
  const listPage = getPositiveInteger(
    searchParams.get("page"),
    DEFAULT_URL_PAGE
  )
  const requestedListLimit = getPositiveInteger(
    searchParams.get("limit"),
    EMPLOYEE_DEFAULT_LIMIT
  )
  const listLimit = EMPLOYEE_PAGE_SIZE_OPTIONS.includes(requestedListLimit)
    ? requestedListLimit
    : EMPLOYEE_DEFAULT_LIMIT
  const listParams = useMemo(
    () => ({ page: listPage, limit: listLimit }),
    [listPage, listLimit]
  )
  const departmentOptions = useMemo(
    () =>
      departments.map((department) => ({
        value: department._id,
        label: department.departmentName,
      })),
    [departments]
  )

  useEffect(() => {
    void dispatch(employeeThunks.fetchPage(listParams))
      .unwrap()
      .catch((error) => {
        showErrorMessage(
          getErrorMessage(error, "Không thể tải danh sách nhân viên")
        )
      })

    void dispatch(departmentThunks.fetchAll(LIST_PARAMS))
      .unwrap()
      .catch((error) => {
        showErrorMessage(
          getErrorMessage(error, "Không thể tải danh sách phòng ban")
        )
      })
  }, [dispatch, listParams])

  const updateTableFilter = (
    key: keyof EmployeeTableFilters,
    value: string
  ) => {
    setTableFilters((current) => ({ ...current, [key]: value }))
  }

  const filteredEmployees = useMemo(() => {
    const normalizedFilters = {
      employeeName: normalize(tableFilters.employeeName),
      employeeEmail: normalize(tableFilters.employeeEmail),
      employeePhone: normalize(tableFilters.employeePhone),
    }

    return employees.filter((employee) => {
      const departmentId = getDepartmentId(employee.departmentId)
      const matchesStatus = tableFilters.isActive
        ? String(Boolean(employee.isActive)) === tableFilters.isActive
        : true

      return (
        (!normalizedFilters.employeeName ||
          normalize(employee.employeeName).includes(
            normalizedFilters.employeeName
          )) &&
        (!normalizedFilters.employeeEmail ||
          normalize(employee.employeeEmail).includes(
            normalizedFilters.employeeEmail
          )) &&
        (!normalizedFilters.employeePhone ||
          normalize(employee.employeePhone).includes(
            normalizedFilters.employeePhone
          )) &&
        (!tableFilters.departmentId ||
          departmentId === tableFilters.departmentId) &&
        matchesStatus
      )
    })
  }, [employees, tableFilters])

  const hasActiveTableFilters = Object.values(tableFilters).some((value) =>
    Boolean(value.trim())
  )

  const columns = useMemo<DataTableColumn<Employee>[]>(
    () => [
      {
        key: "index",
        title: "STT",
        headerClassName: "text-white",
        className: "min-w-[70px] text-center text-slate-500",
        render: (_item, index) => index + 1,
      },
      {
        key: "employeeName",
        title: "Tên nhân viên",
        sortable: true,
        sortValue: (item) => item.employeeName || "",
        filter: (
          <EmployeeTextFilter
            label="Tên nhân viên"
            value={tableFilters.employeeName}
            onChange={(value) => updateTableFilter("employeeName", value)}
          />
        ),
        className: "min-w-[220px]",
        render: (item) => (
          <p className="font-semibold text-slate-900">{item.employeeName}</p>
        ),
      },
      {
        key: "employeeEmail",
        title: "Email",
        sortable: true,
        sortValue: (item) => item.employeeEmail || "",
        filter: (
          <EmployeeTextFilter
            label="Email"
            value={tableFilters.employeeEmail}
            onChange={(value) => updateTableFilter("employeeEmail", value)}
          />
        ),
        className: "min-w-[240px]",
        render: (item) => (
          <p className="text-sm text-slate-700">{item.employeeEmail}</p>
        ),
      },
      {
        key: "employeePhone",
        title: "Số điện thoại",
        sortable: true,
        sortValue: (item) => item.employeePhone || "",
        filter: (
          <EmployeeTextFilter
            label="Số điện thoại"
            value={tableFilters.employeePhone}
            onChange={(value) => updateTableFilter("employeePhone", value)}
          />
        ),
        className: "min-w-[170px]",
        render: (item) => (
          <p className="text-sm font-medium text-slate-700">
            {item.employeePhone}
          </p>
        ),
      },
      {
        key: "departmentId",
        title: "Phòng ban",
        sortable: true,
        sortValue: (item) => {
          const departmentId = getDepartmentId(item.departmentId)
          return (
            departments.find(
              (departmentItem) => departmentItem._id === departmentId
            )?.departmentName || ""
          )
        },
        filter: (
          <EmployeeSelectFilter
            id="employee-table-filter-department"
            label="Phòng ban"
            value={tableFilters.departmentId}
            onChange={(value) => updateTableFilter("departmentId", value)}
            options={departmentOptions}
          />
        ),
        className: "min-w-[200px]",
        render: (item) => {
          const departmentId = getDepartmentId(item.departmentId)
          const department = departments.find(
            (departmentItem) => departmentItem._id === departmentId
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
        sortable: true,
        sortValue: (item) => Boolean(item.isActive),
        filter: (
          <EmployeeSelectFilter
            id="employee-table-filter-status"
            label="Trạng thái"
            value={tableFilters.isActive}
            onChange={(value) => updateTableFilter("isActive", value)}
            options={EMPLOYEE_STATUS_OPTIONS}
          />
        ),
        className: "min-w-[170px] text-center",
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
    [departmentOptions, departments, tableFilters]
  )

  const handleCloseDialog = () => {
    if (submitLoading || detailLoading) return

    setOpen(false)
    setMode("create")
    reset(emptyForm)
    dispatch(employeeActions.clearCurrent())
  }

  const openCreateDialog = () => {
    setMode("create")
    reset(emptyForm)
    dispatch(employeeActions.clearCurrent())
    setOpen(true)
  }

  const handleRefreshEmployees = async () => {
    await dispatch(employeeThunks.fetchPage(listParams)).unwrap()
  }

  const onRefreshEmployees = async () => {
    try {
      await handleRefreshEmployees()
    } catch (error) {
      showErrorMessage(
        getErrorMessage(error, "Không thể tải lại danh sách nhân viên")
      )
    }
  }

  const createBulkEmployee = async (payload: EmployeePayload) => {
    await dispatch(
      employeeThunks.createItem(normalizeEmployeePayload(payload))
    ).unwrap()
  }

  const validateEmployeeImportRows = (
    rows: BulkImportPreparedRow<EmployeePayload, EmployeeImportPreview>[]
  ) => {
    const emailCounts = new Map<string, number>()
    const phoneCounts = new Map<string, number>()

    rows.forEach((row) => {
      const email = cleanImportText(row.preview.employeeEmail).toLowerCase()
      const phone = cleanImportText(row.preview.employeePhone)

      if (email) {
        emailCounts.set(email, (emailCounts.get(email) || 0) + 1)
      }

      if (phone) {
        phoneCounts.set(phone, (phoneCounts.get(phone) || 0) + 1)
      }
    })

    return rows.map((row) => {
      const errors = [...row.errors]
      const email = cleanImportText(row.preview.employeeEmail).toLowerCase()
      const phone = cleanImportText(row.preview.employeePhone)

      if (email && (emailCounts.get(email) || 0) > 1) {
        errors.push("Email nhân viên bị trùng trong file Excel.")
      }

      if (phone && (phoneCounts.get(phone) || 0) > 1) {
        errors.push("Số điện thoại nhân viên bị trùng trong file Excel.")
      }

      return {
        ...row,
        payload: errors.length === 0 ? row.payload : null,
        errors,
      }
    })
  }

  const onSubmit = async (data: EmployeePayload) => {
    const body = normalizeEmployeePayload(data)

    try {
      if (isCreateMode) {
        await dispatch(employeeThunks.createItem(body)).unwrap()
        await handleRefreshEmployees()
        showSuccessMessage("Thêm nhân viên thành công!")
        handleCloseDialog()
        return
      }

      if (isEditMode && selectedEmployee?._id) {
        await dispatch(
          employeeThunks.updateItem({
            id: selectedEmployee._id,
            payload: body,
          })
        ).unwrap()
        await handleRefreshEmployees()
        showSuccessMessage("Cập nhật nhân viên thành công!")
        handleCloseDialog()
      }
    } catch (error) {
      showErrorMessage(getErrorMessage(error, "Lưu nhân viên thất bại!"))
    }
  }

  const onView = async (rowData: Employee) => {
    if (!rowData?._id) {
      showErrorMessage("Không tìm thấy ID nhân viên")
      return
    }

    try {
      const detail = await dispatch(
        employeeThunks.fetchById(rowData._id)
      ).unwrap()

      if (!detail?._id) {
        showErrorMessage("Không tìm thấy chi tiết nhân viên")
        return
      }

      reset(buildEmployeeFormValues(detail))
      setMode("view")
      setOpen(true)
    } catch (error) {
      showErrorMessage(
        getErrorMessage(error, "Không thể tải chi tiết nhân viên")
      )
    }
  }

  const onEdit = async (rowData: Employee) => {
    if (!rowData?._id) {
      showErrorMessage("Không tìm thấy ID nhân viên")
      return
    }

    try {
      const detail = await dispatch(
        employeeThunks.fetchById(rowData._id)
      ).unwrap()

      if (!detail?._id) {
        showErrorMessage("Không tìm thấy chi tiết nhân viên")
        return
      }

      reset(buildEmployeeFormValues(detail))
      setMode("edit")
      setOpen(true)
    } catch (error) {
      showErrorMessage(
        getErrorMessage(error, "Không thể tải dữ liệu nhân viên")
      )
    }
  }

  const onCopy = async (rowData: Employee) => {
    if (!rowData?._id) {
      showErrorMessage("Không tìm thấy ID nhân viên")
      return
    }

    try {
      const detail = await dispatch(
        employeeThunks.fetchById(rowData._id)
      ).unwrap()

      if (!detail?._id) {
        showErrorMessage("Không tìm thấy dữ liệu nhân viên cần sao chép")
        return
      }

      reset({
        ...buildEmployeeFormValues(detail),
        employeeEmail: "",
        employeePhone: "",
      })
      dispatch(employeeActions.clearCurrent())
      setMode("create")
      setOpen(true)
    } catch (error) {
      showErrorMessage(getErrorMessage(error, "Không thể sao chép nhân viên"))
    }
  }

  const onDeleteClick = (rowData: Employee) => {
    if (!rowData?._id) {
      showErrorMessage("Không tìm thấy ID nhân viên")
      return
    }

    setDeleteTarget(rowData)
    setDeleteDialogOpen(true)
  }

  const handleDeleteEmployee = async (id: string) => {
    try {
      await dispatch(employeeThunks.deleteItem(id)).unwrap()
      showSuccessMessage("Xóa nhân viên thành công!")
      setDeleteDialogOpen(false)
      setDeleteTarget(null)
      if (selectedEmployee?._id === id) {
        handleCloseDialog()
      }
      scheduleDelayedRefresh(handleRefreshEmployees, (error) => {
        showErrorMessage(
          getErrorMessage(error, "Không thể tải lại danh sách nhân viên")
        )
      })
    } catch (error) {
      showErrorMessage(getErrorMessage(error, "Xóa nhân viên thất bại!"))
    }
  }

  const mapEmployeeImportRow = ({
    rowNumber,
    getValue,
  }: {
    rowNumber: number
    getValue: (key: EmployeeImportKey) => unknown
  }): BulkImportPreparedRow<EmployeePayload, EmployeeImportPreview> => {
    const errors: string[] = []
    const employeeName = cleanImportText(getValue("employeeName"))
    const employeeEmail = cleanImportText(getValue("employeeEmail"))
    const employeePhone = cleanImportText(getValue("employeePhone"))
    const departmentKeyword = cleanImportText(getValue("department"))
    const normalizedDepartmentKeyword = normalize(departmentKeyword)
    const isActive = parseImportBoolean(getValue("status"), true)

    const matchedDepartment =
      departments.find(
        (department) =>
          normalize(department.departmentName) === normalizedDepartmentKeyword
      ) || null

    if (!employeeName) {
      errors.push("Thiếu tên nhân viên.")
    }

    if (!employeeEmail) {
      errors.push("Thiếu email nhân viên.")
    } else if (!emailPattern.test(employeeEmail)) {
      errors.push("Email nhân viên không hợp lệ.")
    }

    if (!employeePhone) {
      errors.push("Thiếu số điện thoại.")
    }

    if (!departmentKeyword) {
      errors.push("Thiếu phòng ban.")
    } else if (!matchedDepartment) {
      errors.push(
        `Không tìm thấy phòng ban phù hợp với "${departmentKeyword}".`
      )
    }

    return {
      id: `employee-${rowNumber}-${employeeEmail || employeeName}`,
      rowNumber,
      payload:
        errors.length === 0 && matchedDepartment
          ? {
              employeeName,
              employeeEmail,
              employeePhone,
              departmentId: matchedDepartment._id,
              isActive,
            }
          : null,
      preview: {
        employeeName,
        employeeEmail,
        employeePhone,
        department:
          matchedDepartment?.departmentName || departmentKeyword || "-",
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
          icon={<UserRound size={24} />}
          eyebrow="Nhân sự bán hàng"
          title="Quản lý nhân viên"
          description=""
          tone="cyan"
          actions={
            <>
              <button
                type="button"
                onClick={() => setBulkImportOpen(true)}
                disabled={departmentLoading}
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
                Thêm nhân viên
              </button>
              <button
                type="button"
                onClick={() => void onRefreshEmployees()}
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
          data={filteredEmployees}
          columns={columns}
          loading={loading}
          emptyText="Chưa có dữ liệu nhân viên"
          getRowKey={(item) => item._id}
          pagination={{
            itemLabel: "nhân viên",
            pageSizeOptions: EMPLOYEE_PAGE_SIZE_OPTIONS,
            syncUrl: true,
          }}
          totalItems={employeePagination.total}
          currentPage={listPage}
          setCurrentPage={() => undefined}
          itemsPerPage={listLimit}
          setItemsPerPage={() => undefined}
          onView={onView}
          onCopy={onCopy}
          onEdit={onEdit}
          onDelete={onDeleteClick}
          children={
            hasActiveTableFilters ? (
              <button
                type="button"
                onClick={() =>
                  setTableFilters({ ...EMPTY_EMPLOYEE_TABLE_FILTERS })
                }
                className="inline-flex h-9 items-center justify-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 text-sm font-semibold text-red-700 transition hover:bg-red-100"
              >
                <X size={15} />
                Xóa lọc
              </button>
            ) : null
          }
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
              <label
                htmlFor="employee-name"
                className="mb-1.5 block text-sm font-semibold text-slate-700"
              >
                Tên nhân viên
              </label>

              <input
                id="employee-name"
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
              <label
                htmlFor="employee-email"
                className="mb-1.5 block text-sm font-semibold text-slate-700"
              >
                Email
              </label>

              <input
                id="employee-email"
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
              <label
                htmlFor="employee-phone"
                className="mb-1.5 block text-sm font-semibold text-slate-700"
              >
                Số điện thoại
              </label>

              <input
                id="employee-phone"
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
              <label
                htmlFor="employee-department"
                className="mb-1.5 block text-sm font-semibold text-slate-700"
              >
                Phòng ban
              </label>

              <select
                id="employee-department"
                disabled={isViewMode || departmentLoading}
                className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:bg-slate-50 disabled:text-slate-500"
                {...register("departmentId", {
                  required: "Vui lòng chọn phòng ban",
                  validate: (value) =>
                    value.trim().length > 0 || "Vui lòng chọn phòng ban",
                })}
              >
                <option value="">-- Chọn phòng ban --</option>

                {departments.map((department: Department) => (
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
              <label
                htmlFor="employee-is-active"
                className="mb-1.5 block text-sm font-semibold text-slate-700"
              >
                Trạng thái
              </label>

              <label
                htmlFor="employee-is-active"
                className="flex h-11 items-center gap-3 rounded-lg border border-slate-200 px-3"
              >
                <input
                  id="employee-is-active"
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
        title="Tạo nhân viên hàng loạt từ Excel"
        entityLabel="nhân viên"
        columns={EMPLOYEE_IMPORT_COLUMNS}
        previewColumns={EMPLOYEE_IMPORT_PREVIEW_COLUMNS}
        notes={[
          'Cột "Phòng ban" nhập đúng departmentName từ danh sách phòng ban, ví dụ "Phòng CS".',
          'Cột "Trạng thái" có thể để trống, hệ thống sẽ mặc định là Đang hoạt động.',
        ]}
        onClose={() => setBulkImportOpen(false)}
        onCompleted={handleRefreshEmployees}
        mapRow={mapEmployeeImportRow}
        validateRows={validateEmployeeImportRows}
        createItem={createBulkEmployee}
        concurrency={1}
      />

      <AlertOption
        isOpen={isDeleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        onConfirm={() => {
          if (!deleteTarget?._id || deleteLoading) return
          void handleDeleteEmployee(deleteTarget._id)
        }}
        title="Xác nhận thao tác"
        description={`Hành động này sẽ xóa nhân viên "${deleteTarget?.employeeName}" khỏi hệ thống và không thể hoàn tác. Bạn có chắc chắn tiếp tục?`}
        confirmText={deleteLoading ? "Đang xóa..." : "Xóa"}
        cancelText="Hủy"
        tone="destructive"
      />

      {showSuccess && <AlertSuccess description={message} />}
      {showError && <AlertError description={message} />}
    </div>
  )
}
