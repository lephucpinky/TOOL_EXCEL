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
import InvoiceFilterSelect from "@/components/minvoice/InvoiceFilterSelect"
import { SearchableSelect } from "@/components/select/SearchableSelect"
import { useAppDispatch, useAppSelector } from "@/store/hooks"
import { agencyActions, agencyThunks, employeeThunks } from "@/store/slices"
import { getErrorMessage } from "@/store/utils/crud"
import { Agency, AgencyPayload } from "@/types/agency"
import { Employee } from "@/types/employee"
import { normalize } from "@/utils/excel"
import {
  Loader2,
  Plus,
  RefreshCcw,
  UploadCloud,
  UsersRound,
  X,
} from "lucide-react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { useEffect, useMemo, useState } from "react"
import { Controller, useForm } from "react-hook-form"
import PageHeader from "../../../components/header/PageHeader"
import ActionModal from "@/components/modal/ActionModal"
import { useTransientAlert } from "@/hooks/useTransientAlert"
import { DEFAULT_URL_PAGE, getPositiveInteger } from "@/utils/pagination"
import { scheduleDelayedRefresh } from "@/utils/refresh"

type AgencyFormValues = {
  inv_agencyName: string
  agencyName: string
  agencyEmail: string
  employeeId: string
  commissionPercent: number
  isActive: "true" | "false"
}

type AgencyTableFilters = {
  inv_agencyName: string
  agencyName: string
  agencyEmail: string
  employeeId: string
  department: string
  commissionPercent: string
  isActive: string
}

const LIST_PARAMS = {}

const emptyForm: AgencyFormValues = {
  inv_agencyName: "",
  agencyName: "",
  agencyEmail: "",
  employeeId: "",
  commissionPercent: 0,
  isActive: "true",
}

const EMPTY_AGENCY_TABLE_FILTERS: AgencyTableFilters = {
  inv_agencyName: "",
  agencyName: "",
  agencyEmail: "",
  employeeId: "",
  department: "",
  commissionPercent: "",
  isActive: "",
}

const agencyFilterControlClassName =
  "h-8 w-full min-w-0 rounded border border-slate-300 bg-white px-2 text-xs font-normal text-slate-800 outline-none transition placeholder:text-slate-400 hover:border-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100"

function AgencyTextFilter({
  label,
  value,
  onChange,
  inputMode,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  inputMode?: "text" | "decimal"
}) {
  return (
    <input
      type="text"
      inputMode={inputMode}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      placeholder=""
      aria-label={`Lọc theo ${label}`}
      className={agencyFilterControlClassName}
    />
  )
}

function AgencySelectFilter({
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

const STATUS_OPTIONS = [
  { value: "true", label: "Đang hoạt động" },
  { value: "false", label: "Ngừng hoạt động" },
]

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

type AgencyImportKey =
  | "inv_agencyName"
  | "agencyName"
  | "agencyEmail"
  | "employee"
  | "commissionPercent"
  | "status"

type AgencyImportPreview = {
  inv_agencyName: string
  agencyName: string
  agencyEmail: string
  employee: string
  commissionPercent: string
  status: string
}

const AGENCY_IMPORT_COLUMNS: readonly BulkImportColumnDefinition<AgencyImportKey>[] =
  [
    {
      key: "inv_agencyName",
      label: "Mã đại lý",
      aliases: ["Mã đại lý", "Mã NPP", "Agency Code", "Agency Number"],
      required: true,
    },
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
  { key: "inv_agencyName", title: "Mã đại lý" },
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
    inv_agencyName: detail?.inv_agencyName || "",
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

function getAgencyEmployee(agency: Agency, employees: Employee[]) {
  if (typeof agency.employeeId === "object") {
    return agency.employeeId as Employee
  }

  const employeeId = getAgencyEmployeeId(agency.employeeId)
  return employees.find((employee) => employee._id === employeeId)
}

function getEmployeeDepartmentName(employee?: Employee) {
  return typeof employee?.departmentId === "object"
    ? employee.departmentId?.departmentName || ""
    : ""
}

export default function Page() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()
  const dispatch = useAppDispatch()
  const {
    items: agencies,
    current: selectedAgency,
    loading,
    detailLoading,
    submitLoading,
    deleteLoading,
    pagination: agencyPagination,
  } = useAppSelector((state) => state.agencies)
  const { items: employees, loading: employeeLoading } = useAppSelector(
    (state) => state.employees
  )

  const [deleteTarget, setDeleteTarget] = useState<Agency | null>(null)
  const [mode, setMode] = useState<ModeType>("create")
  const [open, setOpen] = useState(false)
  const [isBulkImportOpen, setBulkImportOpen] = useState(false)
  const [isDeleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [tableFilters, setTableFilters] = useState<AgencyTableFilters>(
    EMPTY_AGENCY_TABLE_FILTERS
  )
  const {
    showSuccess,
    showError,
    message,
    showSuccessMessage,
    showErrorMessage,
  } = useTransientAlert()

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
  const listPage = getPositiveInteger(
    searchParams.get("page"),
    DEFAULT_URL_PAGE
  )
  const listLimit = getPositiveInteger(searchParams.get("limit"), 50)
  const listParams = useMemo(
    () => ({ page: listPage, limit: listLimit }),
    [listPage, listLimit]
  )

  const employeeOptions = useMemo(
    () =>
      employees.map((employee) => ({
        value: employee._id,
        label: employee.employeeName,
      })),
    [employees]
  )

  useEffect(() => {
    void dispatch(agencyThunks.fetchPage(listParams))
      .unwrap()
      .catch((error) => {
        showErrorMessage(
          getErrorMessage(error, "Không thể tải danh sách đại lý")
        )
      })

    void dispatch(employeeThunks.fetchAll(LIST_PARAMS))
      .unwrap()
      .catch((error) => {
        showErrorMessage(
          getErrorMessage(error, "Không thể tải danh sách nhân viên")
        )
      })
  }, [dispatch, listParams])

  const updateTableFilter = (key: keyof AgencyTableFilters, value: string) => {
    setTableFilters((current) => ({ ...current, [key]: value }))
  }

  const filteredAgencies = useMemo(() => {
    const normalizedFilters = {
      inv_agencyName: normalize(tableFilters.inv_agencyName),
      agencyName: normalize(tableFilters.agencyName),
      agencyEmail: normalize(tableFilters.agencyEmail),
      department: normalize(tableFilters.department),
    }

    return agencies.filter((agency) => {
      const employee = getAgencyEmployee(agency, employees)
      const departmentName = getEmployeeDepartmentName(employee)
      const matchesCommission = tableFilters.commissionPercent
        ? Number(agency.commissionPercent) ===
          Number(tableFilters.commissionPercent)
        : true
      const matchesStatus = tableFilters.isActive
        ? String(Boolean(agency.isActive)) === tableFilters.isActive
        : true

      return (
        (!normalizedFilters.inv_agencyName ||
          normalize(agency.inv_agencyName).includes(
            normalizedFilters.inv_agencyName
          )) &&
        (!normalizedFilters.agencyName ||
          normalize(agency.agencyName).includes(
            normalizedFilters.agencyName
          )) &&
        (!normalizedFilters.agencyEmail ||
          normalize(agency.agencyEmail).includes(
            normalizedFilters.agencyEmail
          )) &&
        (!tableFilters.employeeId ||
          getAgencyEmployeeId(agency.employeeId) === tableFilters.employeeId) &&
        (!normalizedFilters.department ||
          normalize(departmentName).includes(normalizedFilters.department)) &&
        matchesCommission &&
        matchesStatus
      )
    })
  }, [agencies, employees, tableFilters])
  const hasActiveTableFilters = Object.values(tableFilters).some((value) =>
    Boolean(value.trim())
  )

  const columns = useMemo<DataTableColumn<Agency>[]>(
    () => [
      {
        key: "index",
        title: "STT",
        className: "min-w-[70px] text-center",
        headerClassName: "text-white",
        render: (_item, index) => (
          <span className="text-slate-500">{index + 1}</span>
        ),
      },
      {
        key: "inv_agencyName",
        title: "Mã đại lý",
        sortable: true,
        sortValue: (item) => item.inv_agencyName || "",
        filter: (
          <AgencyTextFilter
            label="Mã đại lý"
            value={tableFilters.inv_agencyName}
            onChange={(value) => updateTableFilter("inv_agencyName", value)}
          />
        ),
        render: (item) => (
          <span className="inline-flex rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-700">
            {item.inv_agencyName || "-"}
          </span>
        ),
      },
      {
        key: "agencyName",
        title: "Tên đại lý",
        sortable: true,
        sortValue: (item) => item.agencyName || "",
        filter: (
          <AgencyTextFilter
            label="Tên đại lý"
            value={tableFilters.agencyName}
            onChange={(value) => updateTableFilter("agencyName", value)}
          />
        ),
        className: "min-w-[300px]",
        render: (item) => (
          <p className="font-semibold text-slate-900">{item.agencyName}</p>
        ),
      },
      {
        key: "agencyEmail",
        title: "Email đại lý",
        sortable: true,
        sortValue: (item) => item.agencyEmail || "",
        filter: (
          <AgencyTextFilter
            label="Email đại lý"
            value={tableFilters.agencyEmail}
            onChange={(value) => updateTableFilter("agencyEmail", value)}
          />
        ),
        render: (item) => (
          <span className="text-sm font-medium text-slate-700">
            {item.agencyEmail || "---"}
          </span>
        ),
      },
      {
        key: "employeeId",
        title: "Nhân viên phụ trách",
        sortable: true,
        sortValue: (item) =>
          getAgencyEmployee(item, employees)?.employeeName || "",
        filter: (
          <AgencySelectFilter
            id="agency-table-filter-employee"
            label="Nhân viên phụ trách"
            value={tableFilters.employeeId}
            onChange={(value) => updateTableFilter("employeeId", value)}
            options={employeeOptions}
          />
        ),
        className: "min-w-[200px]",
        render: (item) => (
          <span className="text-sm font-medium text-slate-700">
            {getAgencyEmployee(item, employees)?.employeeName || "---"}
          </span>
        ),
      },
      {
        key: "department",
        title: "Phòng ban",
        sortable: true,
        sortValue: (item) =>
          getEmployeeDepartmentName(getAgencyEmployee(item, employees)),
        filter: (
          <AgencyTextFilter
            label="Phòng ban"
            value={tableFilters.department}
            onChange={(value) => updateTableFilter("department", value)}
          />
        ),
        className: "min-w-[150px]",
        render: (item) => {
          const department = getEmployeeDepartmentName(
            getAgencyEmployee(item, employees)
          )

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
        sortable: true,
        sortValue: (item) => Number(item.commissionPercent || 0),
        filter: (
          <AgencyTextFilter
            label="Phần trăm hoa hồng"
            value={tableFilters.commissionPercent}
            onChange={(value) => updateTableFilter("commissionPercent", value)}
            inputMode="decimal"
          />
        ),
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
        sortable: true,
        sortValue: (item) => Boolean(item.isActive),
        filter: (
          <AgencySelectFilter
            id="agency-table-filter-status"
            label="Trạng thái"
            value={tableFilters.isActive}
            onChange={(value) => updateTableFilter("isActive", value)}
            options={STATUS_OPTIONS}
          />
        ),
        className: "min-w-[160px] text-center",
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
    [employeeOptions, employees, tableFilters]
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
    await dispatch(agencyThunks.fetchPage(listParams)).unwrap()
  }

  const onRefreshAgencies = async () => {
    try {
      await Promise.all([
        handleRefreshAgencies(),
        dispatch(employeeThunks.fetchAll(LIST_PARAMS)).unwrap(),
      ])
    } catch (error) {
      showErrorMessage(
        getErrorMessage(error, "Không thể tải lại danh sách đại lý")
      )
    }
  }

  const createBulkAgency = async (payload: AgencyPayload) => {
    await dispatch(agencyThunks.createItem(payload)).unwrap()
  }

  const onSubmit = async (data: AgencyFormValues) => {
    const body: AgencyPayload = {
      inv_agencyName: data.inv_agencyName.trim(),
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
      showErrorMessage(getErrorMessage(error, "Lưu đại lý thất bại!"))
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
      showErrorMessage(getErrorMessage(error, "Không thể tải chi tiết đại lý"))
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
      showErrorMessage(getErrorMessage(error, "Không thể tải dữ liệu đại lý"))
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
      showSuccessMessage("Xóa đại lý thành công!")
      setDeleteDialogOpen(false)
      setDeleteTarget(null)
      if (selectedAgency?._id === id) {
        handleCloseDialog()
      }
      const nextTotal = Math.max(agencyPagination.total - 1, 0)
      const nextTotalPages = Math.max(Math.ceil(nextTotal / listLimit), 1)
      const nextPage = Math.min(listPage, nextTotalPages)
      const nextParams = { page: nextPage, limit: listLimit }

      if (nextPage !== listPage) {
        router.replace(`${pathname}?page=${nextPage}&limit=${listLimit}`)
      }

      scheduleDelayedRefresh(
        async () => {
          await dispatch(agencyThunks.fetchPage(nextParams)).unwrap()
        },
        (error) => {
          showErrorMessage(
            getErrorMessage(error, "Không thể tải lại danh sách đại lý")
          )
        }
      )
    } catch (error) {
      showErrorMessage(getErrorMessage(error, "Xóa đại lý thất bại!"))
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
    const inv_agencyName = cleanImportText(getValue("inv_agencyName"))
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

    if (!inv_agencyName) {
      errors.push("Thiếu mã đại lý.")
    }

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
      id: `agency-${rowNumber}-${inv_agencyName || agencyEmail || agencyName}`,
      rowNumber,
      payload:
        errors.length === 0 && matchedEmployee
          ? {
              inv_agencyName,
              agencyName,
              agencyEmail,
              employeeId: matchedEmployee._id,
              commissionPercent,
              isActive,
            }
          : null,
      preview: {
        inv_agencyName,
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
          description=""
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

              <button
                type="button"
                onClick={() => void onRefreshAgencies()}
                disabled={loading || employeeLoading}
                className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-4 text-sm font-bold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <RefreshCcw
                  size={18}
                  className={
                    loading || employeeLoading ? "animate-spin" : undefined
                  }
                />
                Tải dữ liệu
              </button>
            </>
          }
        />

        <DataTable
          data={filteredAgencies}
          columns={columns}
          loading={loading}
          emptyText="Chưa có dữ liệu đại lý"
          getRowKey={(item) => item._id}
          pagination={{
            itemLabel: "đại lý",
            pageSizeOptions: [50, 100, 200, 300],
            syncUrl: true,
          }}
          totalItems={agencyPagination.total}
          currentPage={listPage}
          setCurrentPage={() => undefined}
          itemsPerPage={listLimit}
          setItemsPerPage={() => undefined}
          onView={onView}
          onEdit={onEdit}
          onDelete={onDeleteClick}
          children={
            hasActiveTableFilters ? (
              <button
                type="button"
                onClick={() =>
                  setTableFilters({ ...EMPTY_AGENCY_TABLE_FILTERS })
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
                htmlFor="dealer-inv-agency-name"
                className="mb-1.5 block text-sm font-semibold text-slate-700"
              >
                Mã đại lý
              </label>

              <input
                id="dealer-inv-agency-name"
                disabled={isViewMode}
                className="h-10 w-full rounded-lg border border-slate-200 px-3 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:bg-slate-50 disabled:text-slate-500"
                placeholder="Nhập mã đại lý"
                {...register("inv_agencyName", {
                  required: "Vui lòng nhập mã đại lý",
                  validate: (value) =>
                    value.trim().length > 0 || "Vui lòng nhập mã đại lý",
                })}
              />

              {errors.inv_agencyName && !isViewMode && (
                <p className="mt-1 text-xs font-medium text-red-600">
                  {errors.inv_agencyName.message}
                </p>
              )}
            </div>

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
        description={`Hành động này sẽ xóa đại lý "${deleteTarget?.inv_agencyName || deleteTarget?.agencyName}" khỏi hệ thống và không thể hoàn tác. Bạn có chắc chắn tiếp tục?`}
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
