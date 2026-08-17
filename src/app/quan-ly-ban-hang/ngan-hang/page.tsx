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
import { bankActions, bankThunks } from "@/store/slices"
import { getErrorMessage } from "@/store/utils/crud"
import { Bank, BankPayload } from "@/types/bank"
import { Landmark, Loader2, Plus, RefreshCcw, UploadCloud } from "lucide-react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { useEffect, useMemo, useState } from "react"
import { useForm } from "react-hook-form"
import PageHeader from "../../../components/header/PageHeader"
import ActionModal from "@/components/modal/ActionModal"
import { useTransientAlert } from "@/hooks/useTransientAlert"
import {
  getUrlPaginationParams,
  URL_PAGE_SIZE_OPTIONS,
} from "@/utils/pagination"
import { scheduleDelayedRefresh } from "@/utils/refresh"

const emptyForm: BankPayload = {
  inv_buyerBankName: "",
  isActive: true,
}

type BankImportKey = "bankName" | "status"

type BankImportPreview = {
  bankName: string
  status: string
}

const BANK_IMPORT_COLUMNS: readonly BulkImportColumnDefinition<BankImportKey>[] =
  [
    {
      key: "bankName",
      label: "Tên ngân hàng",
      aliases: ["Tên ngân hàng", "Ngân hàng", "Bank Name"],
      required: true,
    },
    {
      key: "status",
      label: "Trạng thái",
      aliases: ["Trạng thái", "Status"],
    },
  ]

const BANK_IMPORT_PREVIEW_COLUMNS: readonly BulkImportPreviewColumn<
  BankPayload,
  BankImportPreview
>[] = [
  { key: "bankName", title: "Tên ngân hàng" },
  { key: "status", title: "Trạng thái", className: "whitespace-nowrap" },
]

type ModeType = "create" | "view" | "edit" | null

function buildBankFormValues(detail: Bank | null): BankPayload {
  return {
    inv_buyerBankName: detail?.inv_buyerBankName || "",
    isActive: Boolean(detail?.isActive),
  }
}

export default function BankPage() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()
  const dispatch = useAppDispatch()
  const {
    items: banks,
    current: selectedBank,
    loading,
    detailLoading,
    submitLoading,
    deleteLoading,
    pagination: bankPagination,
  } = useAppSelector((state) => state.banks)
  const { page: listPage, limit: listLimit } =
    getUrlPaginationParams(searchParams)
  const listParams = useMemo(
    () => ({ page: listPage, limit: listLimit }),
    [listPage, listLimit]
  )

  const [deleteTarget, setDeleteTarget] = useState<Bank | null>(null)
  const [mode, setMode] = useState<ModeType>("create")
  const [open, setOpen] = useState(false)
  const [isBulkImportOpen, setBulkImportOpen] = useState(false)
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
  } = useForm<BankPayload>({
    defaultValues: emptyForm,
  })

  const isViewMode = mode === "view"
  const isEditMode = mode === "edit"
  const isCreateMode = mode === "create"

  useEffect(() => {
    void dispatch(bankThunks.fetchPage(listParams))
      .unwrap()
      .catch((error) => {
        showErrorMessage(
          getErrorMessage(error, "Không thể tải danh sách ngân hàng")
        )
      })
  }, [dispatch, listParams])

  const columns = useMemo<DataTableColumn<Bank>[]>(
    () => [
      {
        key: "index",
        title: "STT",
        headerClassName: "text-white",
        className: "w-[80px] text-slate-500",
        render: (_item, index) => index + 1,
      },
      {
        key: "inv_buyerBankName",
        title: "Tên ngân hàng",
        className: "w-[150px] text-slate-900",
        headerClassName: "text-white",
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
        className: "text-center w-[150px]",
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
    setMode("create")
    reset(emptyForm)
    dispatch(bankActions.clearCurrent())
  }

  const openCreateDialog = () => {
    setMode("create")
    reset(emptyForm)
    dispatch(bankActions.clearCurrent())
    setOpen(true)
  }

  const handleRefreshBanks = async () => {
    await dispatch(bankThunks.fetchPage(listParams)).unwrap()
  }

  const onRefreshBanks = async () => {
    try {
      await handleRefreshBanks()
    } catch (error) {
      showErrorMessage(
        getErrorMessage(error, "Không thể tải danh sách ngân hàng")
      )
    }
  }

  const createBulkBank = async (payload: BankPayload) => {
    await dispatch(bankThunks.createItem(payload)).unwrap()
  }

  const onSubmit = async (data: BankPayload) => {
    const body: BankPayload = {
      inv_buyerBankName: data.inv_buyerBankName.trim(),
      isActive: Boolean(data.isActive),
    }

    try {
      if (isCreateMode) {
        await dispatch(bankThunks.createItem(body)).unwrap()
        await handleRefreshBanks()
        showSuccessMessage("Thêm ngân hàng thành công!")
        handleCloseDialog()
        return
      }

      if (isEditMode && selectedBank?._id) {
        await dispatch(
          bankThunks.updateItem({ id: selectedBank._id, payload: body })
        ).unwrap()
        await handleRefreshBanks()
        showSuccessMessage("Cập nhật ngân hàng thành công!")
        handleCloseDialog()
      }
    } catch (error) {
      showErrorMessage(getErrorMessage(error, "Lưu ngân hàng thất bại!"))
    }
  }

  const onView = async (rowData: Bank) => {
    if (!rowData?._id) {
      showErrorMessage("Không tìm thấy ID ngân hàng")
      return
    }

    try {
      const detail = await dispatch(bankThunks.fetchById(rowData._id)).unwrap()

      if (!detail?._id) {
        showErrorMessage("Không tìm thấy chi tiết ngân hàng")
        return
      }

      reset(buildBankFormValues(detail))
      setMode("view")
      setOpen(true)
    } catch (error) {
      showErrorMessage(
        getErrorMessage(error, "Không thể tải chi tiết ngân hàng")
      )
    }
  }

  const onEdit = async (rowData: Bank) => {
    if (!rowData?._id) {
      showErrorMessage("Không tìm thấy ID ngân hàng")
      return
    }

    try {
      const detail = await dispatch(bankThunks.fetchById(rowData._id)).unwrap()

      if (!detail?._id) {
        showErrorMessage("Không tìm thấy chi tiết ngân hàng")
        return
      }

      reset(buildBankFormValues(detail))
      setMode("edit")
      setOpen(true)
    } catch (error) {
      showErrorMessage(
        getErrorMessage(error, "Không thể tải dữ liệu ngân hàng")
      )
    }
  }

  const onDeleteClick = (rowData: Bank) => {
    if (!rowData?._id) {
      showErrorMessage("Không tìm thấy ID ngân hàng")
      return
    }

    setDeleteTarget(rowData)
    setDeleteDialogOpen(true)
  }

  const handleDeleteBank = async (id: string) => {
    try {
      await dispatch(bankThunks.deleteItem(id)).unwrap()
      showSuccessMessage("Xóa ngân hàng thành công!")
      setDeleteDialogOpen(false)
      setDeleteTarget(null)
      if (selectedBank?._id === id) {
        handleCloseDialog()
      }
      const nextTotal = Math.max(bankPagination.total - 1, 0)
      const nextTotalPages = Math.max(Math.ceil(nextTotal / listLimit), 1)
      const nextPage = Math.min(listPage, nextTotalPages)
      const nextParams = { page: nextPage, limit: listLimit }

      if (nextPage !== listPage) {
        router.replace(`${pathname}?page=${nextPage}&limit=${listLimit}`)
      }

      scheduleDelayedRefresh(
        async () => {
          await dispatch(bankThunks.fetchPage(nextParams)).unwrap()
        },
        (error) => {
          showErrorMessage(
            getErrorMessage(error, "Không thể tải danh sách ngân hàng")
          )
        }
      )
    } catch (error) {
      showErrorMessage(getErrorMessage(error, "Xóa ngân hàng thất bại!"))
    }
  }

  const mapBankImportRow = ({
    rowNumber,
    getValue,
  }: {
    rowNumber: number
    getValue: (key: BankImportKey) => unknown
  }): BulkImportPreparedRow<BankPayload, BankImportPreview> => {
    const errors: string[] = []
    const bankName = cleanImportText(getValue("bankName"))
    const isActive = parseImportBoolean(getValue("status"), true)

    if (!bankName) {
      errors.push("Thiếu tên ngân hàng.")
    }

    return {
      id: `bank-${rowNumber}-${bankName}`,
      rowNumber,
      payload:
        errors.length === 0
          ? {
              inv_buyerBankName: bankName,
              isActive,
            }
          : null,
      preview: {
        bankName,
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
          icon={<Landmark size={24} />}
          eyebrow="Thanh toán"
          title="Quản lý ngân hàng"
          description=""
          tone="blue"
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
                Thêm ngân hàng
              </button>
              <button
                type="button"
                onClick={() => void onRefreshBanks()}
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
          data={banks}
          columns={columns}
          loading={loading}
          emptyText="Chưa có dữ liệu ngân hàng"
          getRowKey={(item) => item._id}
          onView={onView}
          onEdit={onEdit}
          onDelete={onDeleteClick}
          pagination={{
            itemLabel: "ngân hàng",
            pageSizeOptions: URL_PAGE_SIZE_OPTIONS,
            syncUrl: true,
          }}
          totalItems={bankPagination.total}
          currentPage={listPage}
          setCurrentPage={() => undefined}
          itemsPerPage={listLimit}
          setItemsPerPage={() => undefined}
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
              <label
                htmlFor="bank-name"
                className="mb-1.5 block text-sm font-semibold text-slate-700"
              >
                Tên ngân hàng
              </label>

              <input
                id="bank-name"
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

      <CrudBulkImportModal
        open={isBulkImportOpen}
        title="Tạo ngân hàng hàng loạt từ Excel"
        entityLabel="ngân hàng"
        columns={BANK_IMPORT_COLUMNS}
        previewColumns={BANK_IMPORT_PREVIEW_COLUMNS}
        notes={[
          'Cột "Trạng thái" có thể để trống, hệ thống sẽ mặc định là Đang hoạt động.',
          'Có thể nhập trạng thái là "Đang hoạt động", "Ngừng hoạt động", "active", "inactive", "1" hoặc "0".',
        ]}
        onClose={() => setBulkImportOpen(false)}
        onCompleted={handleRefreshBanks}
        mapRow={mapBankImportRow}
        createItem={createBulkBank}
      />

      <AlertOption
        isOpen={isDeleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        onConfirm={() => {
          if (!deleteTarget?._id || deleteLoading) return
          void handleDeleteBank(deleteTarget._id)
        }}
        title="Xác nhận thao tác"
        description={`Hành động này sẽ xóa ngân hàng "${deleteTarget?.inv_buyerBankName}" khỏi hệ thống và không thể hoàn tác. Bạn có chắc chắn tiếp tục?`}
        confirmText={deleteLoading ? "Đang xóa..." : "Xóa"}
        cancelText="Hủy"
        tone="destructive"
      />

      {showSuccess && <AlertSuccess description={message} />}
      {showError && <AlertError description={message} />}
    </div>
  )
}
