"use client"

import AlertError from "@/components/alert/AlertError"
import AlertOption from "@/components/alert/AlertOption"
import AlertSuccess from "@/components/alert/AlertSuccess"
import CrudBulkImportModal, {
  BulkImportColumnDefinition,
  BulkImportPreparedRow,
  BulkImportPreviewColumn,
  cleanImportText,
  parseImportNumber,
} from "@/components/common/CrudBulkImportModal"
import DataTable, { DataTableColumn } from "@/components/common/Datatable"
import { useAppDispatch, useAppSelector } from "@/store/hooks"
import { productActions, productThunks } from "@/store/slices"
import { getErrorMessage } from "@/store/utils/crud"
import { Product, ProductPayload } from "@/types/product"
import { normalizeInvoiceTaxCode } from "@/utils/invoice"
import {
  Loader2,
  PackageSearch,
  Plus,
  RefreshCcw,
  UploadCloud,
} from "lucide-react"
import { useSearchParams } from "next/navigation"
import { useEffect, useMemo, useState } from "react"
import { useForm } from "react-hook-form"
import PageHeader from "../../../components/header/PageHeader"
import ActionModal from "@/components/modal/ActionModal"
import { useTransientAlert } from "@/hooks/useTransientAlert"
import {
  getUrlPaginationParams,
  URL_PAGE_SIZE_OPTIONS,
} from "@/utils/pagination"

const emptyForm: ProductPayload = {
  inv_itemName: "",
  inv_itemProduct: "",
  inv_unitCode: "",
  inv_unitPrice: 0,
  inv_quantity: 0,
  inv_discountAmount: 0,
  ma_thue: "",
}

type ProductImportKey =
  | "itemName"
  | "itemProduct"
  | "unitCode"
  | "unitPrice"
  | "quantity"
  | "discountAmount"
  | "tax"

type ProductImportPreview = {
  itemName: string
  itemProduct: string
  unitCode: string
  unitPrice: string
  quantity: string
  discountAmount: string
  tax: string
}

const PRODUCT_IMPORT_COLUMNS: readonly BulkImportColumnDefinition<ProductImportKey>[] =
  [
    {
      key: "itemName",
      label: "Tên sản phẩm",
      aliases: ["Tên sản phẩm", "Item Name"],
      required: true,
    },
    {
      key: "itemProduct",
      label: "Mã sản phẩm",
      aliases: [
        "Mã sản phẩm",
        "Mã SP",
        "Sản phẩm",
        "Item Product",
        "inv_itemProduct",
      ],
      required: true,
    },
    {
      key: "unitCode",
      label: "Đơn vị tính",
      aliases: ["Đơn vị tính", "Đơn vị", "Unit"],
      required: true,
    },
    {
      key: "unitPrice",
      label: "Đơn giá",
      aliases: ["Đơn giá", "Giá bán", "Unit Price"],
      required: true,
    },
    {
      key: "quantity",
      label: "Số lượng",
      aliases: ["Số lượng", "Quantity"],
      required: true,
    },
    {
      key: "discountAmount",
      label: "Tiền chiết khấu",
      aliases: ["Tiền chiết khấu", "Chiết khấu", "Discount"],
    },
    {
      key: "tax",
      label: "Thuế suất",
      aliases: ["Thuế suất", "Thuế", "VAT", "Tax"],
      required: true,
    },
  ]

const PRODUCT_IMPORT_PREVIEW_COLUMNS: readonly BulkImportPreviewColumn<
  ProductPayload,
  ProductImportPreview
>[] = [
  { key: "itemName", title: "Tên sản phẩm" },
  { key: "itemProduct", title: "Mã SP" },
  { key: "unitCode", title: "Đơn vị", className: "whitespace-nowrap" },
  {
    key: "unitPrice",
    title: "Đơn giá",
    className: "whitespace-nowrap text-right",
  },
  {
    key: "quantity",
    title: "Số lượng",
    className: "whitespace-nowrap text-right",
  },
  {
    key: "discountAmount",
    title: "Chiết khấu",
    className: "whitespace-nowrap text-right",
  },
  { key: "tax", title: "Thuế", className: "whitespace-nowrap" },
]

type ModeType = "create" | "view" | "edit" | null

function formatNumber(value: number) {
  return new Intl.NumberFormat("vi-VN").format(Number(value || 0))
}

function formatTaxRate(value: unknown) {
  const textValue = String(value ?? "").trim()

  if (!textValue) return "-"

  const taxCode = normalizeInvoiceTaxCode(textValue)

  if (taxCode === "KCT" || taxCode === "KKKNT") return taxCode
  if (/^\d+(\.\d+)?$/.test(taxCode)) return `${taxCode}`

  return taxCode
}

function buildProductFormValues(detail: Product | null): ProductPayload {
  return {
    inv_itemName: detail?.inv_itemName || "",
    inv_itemProduct: detail?.inv_itemProduct || "",
    inv_unitCode: detail?.inv_unitCode || "",
    inv_unitPrice: Number(detail?.inv_unitPrice || 0),
    inv_quantity: Number(detail?.inv_quantity || 0),
    inv_discountAmount: Number(detail?.inv_discountAmount || 0),
    ma_thue: normalizeInvoiceTaxCode(detail?.ma_thue || ""),
  }
}

export default function ProductPage() {
  const searchParams = useSearchParams()
  const dispatch = useAppDispatch()
  const {
    items: products,
    current: selectedProduct,
    loading,
    detailLoading,
    submitLoading,
    deleteLoading,
    pagination: productPagination,
  } = useAppSelector((state) => state.products)
  const { page: listPage, limit: listLimit } =
    getUrlPaginationParams(searchParams)
  const listParams = useMemo(
    () => ({ page: listPage, limit: listLimit }),
    [listPage, listLimit]
  )

  const [deleteTarget, setDeleteTarget] = useState<Product | null>(null)
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
  } = useForm<ProductPayload>({
    defaultValues: emptyForm,
  })

  const isViewMode = mode === "view"
  const isEditMode = mode === "edit"
  const isCreateMode = mode === "create"

  useEffect(() => {
    void dispatch(productThunks.fetchPage(listParams))
      .unwrap()
      .catch((error) => {
        showErrorMessage(
          getErrorMessage(error) || "Không thể tải danh sách sản phẩm"
        )
      })
  }, [dispatch, listParams])

  const columns = useMemo<DataTableColumn<Product>[]>(
    () => [
      {
        key: "index",
        title: "STT",
        className: "w-[70px] text-slate-500",
        render: (_item, index) => index + 1,
      },

      {
        key: "inv_itemProduct",
        title: "Mã sản phẩm",
        render: (item) => (
          <p className="font-semibold text-slate-900">{item.inv_itemProduct}</p>
        ),
      },
      {
        key: "inv_itemName",
        title: "Tên sản phẩm",
        render: (item) => (
          <p className="font-semibold text-slate-900">{item.inv_itemName}</p>
        ),
      },

      {
        key: "inv_unitCode",
        title: "Đơn vị",
        render: (item) => (
          <span className="inline-flex rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-700">
            {item.inv_unitCode}
          </span>
        ),
      },
      {
        key: "inv_unitPrice",
        title: "Đơn giá",
        headerClassName: "text-right",
        className: "text-right",
        render: (item) => (
          <span className="font-semibold text-slate-900">
            {formatNumber(item.inv_unitPrice)}
          </span>
        ),
      },
      {
        key: "inv_quantity",
        title: "Số lượng",
        headerClassName: "text-right",
        className: "text-right",
        render: (item) => formatNumber(item.inv_quantity),
      },
      {
        key: "inv_discountAmount",
        title: "Chiết khấu",
        headerClassName: "text-right",
        className: "text-right",
        render: (item) => formatNumber(item.inv_discountAmount),
      },
      {
        key: "ma_thue",
        title: "Thuế",
        headerClassName: "text-right",
        className: "text-right",
        render: (item) => (
          <span className="inline-flex rounded-full bg-blue-50 px-3 py-1 text-xs font-bold text-blue-700">
            {formatTaxRate(item.ma_thue)}
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
    dispatch(productActions.clearCurrent())
  }

  const openCreateDialog = () => {
    setMode("create")
    reset(emptyForm)
    dispatch(productActions.clearCurrent())
    setOpen(true)
  }

  const handleRefreshProducts = async () => {
    await dispatch(productThunks.fetchPage(listParams)).unwrap()
  }

  const onRefreshProducts = async () => {
    try {
      await handleRefreshProducts()
    } catch (error) {
      showErrorMessage(
        getErrorMessage(error) || "Không thể tải lại danh sách sản phẩm"
      )
    }
  }

  const createBulkProduct = async (payload: ProductPayload) => {
    await dispatch(productThunks.createItem(payload)).unwrap()
  }

  const onSubmit = async (data: ProductPayload) => {
    const body: ProductPayload = {
      inv_itemName: data.inv_itemName.trim(),
      inv_itemProduct: data.inv_itemProduct.trim(),
      inv_unitCode: data.inv_unitCode.trim(),
      inv_unitPrice: Number(data.inv_unitPrice),
      inv_quantity: Number(data.inv_quantity),
      inv_discountAmount: Number(data.inv_discountAmount),
      ma_thue: normalizeInvoiceTaxCode(data.ma_thue),
    }

    try {
      if (isCreateMode) {
        await dispatch(productThunks.createItem(body)).unwrap()
        await handleRefreshProducts()
        showSuccessMessage("Thêm sản phẩm thành công!")
        handleCloseDialog()
        return
      }

      if (isEditMode && selectedProduct?._id) {
        await dispatch(
          productThunks.updateItem({ id: selectedProduct._id, payload: body })
        ).unwrap()
        await handleRefreshProducts()
        showSuccessMessage("Cập nhật sản phẩm thành công!")
        handleCloseDialog()
      }
    } catch (error) {
      showErrorMessage(getErrorMessage(error) || "Lưu sản phẩm thất bại!")
    }
  }

  const onView = async (rowData: Product) => {
    if (!rowData?._id) {
      showErrorMessage("Không tìm thấy ID sản phẩm")
      return
    }

    try {
      const detail = await dispatch(
        productThunks.fetchById(rowData._id)
      ).unwrap()

      if (!detail?._id) {
        showErrorMessage("Không tìm thấy chi tiết sản phẩm")
        return
      }

      reset(buildProductFormValues(detail))
      setMode("view")
      setOpen(true)
    } catch (error) {
      showErrorMessage(
        getErrorMessage(error) || "Không thể tải chi tiết sản phẩm"
      )
    }
  }

  const onEdit = async (rowData: Product) => {
    if (!rowData?._id) {
      showErrorMessage("Không tìm thấy ID sản phẩm")
      return
    }

    try {
      const detail = await dispatch(
        productThunks.fetchById(rowData._id)
      ).unwrap()

      if (!detail?._id) {
        showErrorMessage("Không tìm thấy chi tiết sản phẩm")
        return
      }

      reset(buildProductFormValues(detail))
      setMode("edit")
      setOpen(true)
    } catch (error) {
      showErrorMessage(
        getErrorMessage(error) || "Không thể tải dữ liệu sản phẩm"
      )
    }
  }

  const onDeleteClick = (rowData: Product) => {
    if (!rowData?._id) {
      showErrorMessage("Không tìm thấy ID sản phẩm")
      return
    }

    setDeleteTarget(rowData)
    setDeleteDialogOpen(true)
  }

  const handleDeleteProduct = async (id: string) => {
    try {
      await dispatch(productThunks.deleteItem(id)).unwrap()
      await handleRefreshProducts()
      showSuccessMessage("Xóa sản phẩm thành công!")
      setDeleteDialogOpen(false)
      setDeleteTarget(null)
      if (selectedProduct?._id === id) {
        handleCloseDialog()
      }
    } catch (error) {
      showErrorMessage(getErrorMessage(error) || "Xóa sản phẩm thất bại!")
    }
  }

  const mapProductImportRow = ({
    rowNumber,
    getValue,
  }: {
    rowNumber: number
    getValue: (key: ProductImportKey) => unknown
  }): BulkImportPreparedRow<ProductPayload, ProductImportPreview> => {
    const errors: string[] = []
    const itemName = cleanImportText(getValue("itemName"))
    const itemProduct = cleanImportText(getValue("itemProduct"))
    const unitCode = cleanImportText(getValue("unitCode"))
    const unitPrice = parseImportNumber(getValue("unitPrice"))
    const quantity = parseImportNumber(getValue("quantity"))
    const discountAmount = parseImportNumber(getValue("discountAmount"))
    const tax = cleanImportText(getValue("tax"))

    if (!itemName) {
      errors.push("Thiếu tên sản phẩm.")
    }

    if (!itemProduct) {
      errors.push("Thiếu mã sản phẩm.")
    }

    if (!unitCode) {
      errors.push("Thiếu đơn vị tính.")
    }

    if (unitPrice < 0) {
      errors.push("Đơn giá không được nhỏ hơn 0.")
    }

    if (quantity < 0) {
      errors.push("Số lượng không được nhỏ hơn 0.")
    }

    if (discountAmount < 0) {
      errors.push("Tiền chiết khấu không được nhỏ hơn 0.")
    }

    if (!tax) {
      errors.push("Thiếu thuế suất.")
    }

    return {
      id: `product-${rowNumber}-${itemProduct || itemName}`,
      rowNumber,
      payload:
        errors.length === 0
          ? {
              inv_itemName: itemName,
              inv_itemProduct: itemProduct,
              inv_unitCode: unitCode,
              inv_unitPrice: unitPrice,
              inv_quantity: quantity,
              inv_discountAmount: discountAmount,
              ma_thue: normalizeInvoiceTaxCode(tax),
            }
          : null,
      preview: {
        itemName,
        itemProduct,
        unitCode,
        unitPrice: formatNumber(unitPrice),
        quantity: formatNumber(quantity),
        discountAmount: formatNumber(discountAmount),
        tax,
      },
      errors,
      warnings: [],
    }
  }

  return (
    <div className="min-h-screen p-5">
      <div className="mx-auto max-w-7xl space-y-5">
        <PageHeader
          icon={<PackageSearch size={24} />}
          eyebrow="Danh mục bán hàng"
          title="Quản lý sản phẩm"
          description="Quản lý mã sản phẩm, đơn vị tính, số lượng và thông tin thuế."
          tone="amber"
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
                Thêm sản phẩm
              </button>

              <button
                type="button"
                onClick={() => void onRefreshProducts()}
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
          data={products}
          columns={columns}
          loading={loading}
          emptyText="Chưa có dữ liệu sản phẩm"
          getRowKey={(item) => item._id}
          pagination={{
            itemLabel: "sản phẩm",
            pageSizeOptions: URL_PAGE_SIZE_OPTIONS,
            syncUrl: true,
          }}
          totalItems={productPagination.total}
          currentPage={listPage}
          setCurrentPage={() => undefined}
          itemsPerPage={listLimit}
          setItemsPerPage={() => undefined}
          onView={onView}
          onEdit={onEdit}
          onDelete={onDeleteClick}
        />
      </div>

      <ActionModal
        open={open}
        title={
          isCreateMode
            ? "Thêm sản phẩm"
            : isViewMode
              ? "Chi tiết sản phẩm"
              : "Chỉnh sửa sản phẩm"
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
                form="product-form"
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
            Đang tải dữ liệu sản phẩm...
          </div>
        ) : (
          <form
            id="product-form"
            onSubmit={handleSubmit(onSubmit)}
            className="grid grid-cols-1 gap-4 md:grid-cols-2"
          >
            <div>
              <label
                htmlFor="product-item-name"
                className="mb-1.5 block text-sm font-semibold text-slate-700"
              >
                Tên sản phẩm
              </label>

              <input
                id="product-item-name"
                disabled={isViewMode}
                className="h-10 w-full rounded-lg border border-slate-200 px-3 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:bg-slate-50 disabled:text-slate-500"
                placeholder="Ví dụ: Hàng hóa 001"
                {...register("inv_itemName", {
                  required: "Vui lòng nhập tên sản phẩm",
                  validate: (value) =>
                    value.trim().length > 0 || "Vui lòng nhập tên sản phẩm",
                })}
              />

              {errors.inv_itemName && !isViewMode && (
                <p className="mt-1 text-xs font-medium text-red-600">
                  {errors.inv_itemName.message}
                </p>
              )}
            </div>

            <div>
              <label
                htmlFor="product-unit-code"
                className="mb-1.5 block text-sm font-semibold text-slate-700"
              >
                Đơn vị tính
              </label>

              <input
                id="product-unit-code"
                disabled={isViewMode}
                className="h-10 w-full rounded-lg border border-slate-200 px-3 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:bg-slate-50 disabled:text-slate-500"
                placeholder="Ví dụ: Phần"
                {...register("inv_unitCode", {
                  required: "Vui lòng nhập đơn vị tính",
                  validate: (value) =>
                    value.trim().length > 0 || "Vui lòng nhập đơn vị tính",
                })}
              />

              {errors.inv_unitCode && !isViewMode && (
                <p className="mt-1 text-xs font-medium text-red-600">
                  {errors.inv_unitCode.message}
                </p>
              )}
            </div>

            <div>
              <label
                htmlFor="product-item-product"
                className="mb-1.5 block text-sm font-semibold text-slate-700"
              >
                Mã sản phẩm
              </label>

              <input
                id="product-item-product"
                disabled={isViewMode}
                className="h-10 w-full rounded-lg border border-slate-200 px-3 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:bg-slate-50 disabled:text-slate-500"
                placeholder="Ví dụ: cks12"
                {...register("inv_itemProduct", {
                  required: "Vui lòng nhập mã sản phẩm",
                  validate: (value) =>
                    value.trim().length > 0 || "Vui lòng nhập mã sản phẩm",
                })}
              />

              {errors.inv_itemProduct && !isViewMode && (
                <p className="mt-1 text-xs font-medium text-red-600">
                  {errors.inv_itemProduct.message}
                </p>
              )}
            </div>

            <div>
              <label
                htmlFor="product-unit-price"
                className="mb-1.5 block text-sm font-semibold text-slate-700"
              >
                Đơn giá
              </label>

              <input
                id="product-unit-price"
                disabled={isViewMode}
                type="number"
                min={0}
                step="1"
                className="h-10 w-full rounded-lg border border-slate-200 px-3 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:bg-slate-50 disabled:text-slate-500"
                placeholder="Ví dụ: 245000"
                {...register("inv_unitPrice", {
                  required: "Vui lòng nhập đơn giá",
                  valueAsNumber: true,
                  min: {
                    value: 0,
                    message: "Đơn giá không được nhỏ hơn 0",
                  },
                  validate: (value) =>
                    !Number.isNaN(Number(value)) || "Đơn giá không hợp lệ",
                })}
              />

              {errors.inv_unitPrice && !isViewMode && (
                <p className="mt-1 text-xs font-medium text-red-600">
                  {errors.inv_unitPrice.message}
                </p>
              )}
            </div>

            <div>
              <label
                htmlFor="product-quantity"
                className="mb-1.5 block text-sm font-semibold text-slate-700"
              >
                Số lượng
              </label>

              <input
                id="product-quantity"
                disabled={isViewMode}
                type="number"
                min={0}
                step="1"
                className="h-10 w-full rounded-lg border border-slate-200 px-3 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:bg-slate-50 disabled:text-slate-500"
                placeholder="Ví dụ: 2"
                {...register("inv_quantity", {
                  required: "Vui lòng nhập số lượng",
                  valueAsNumber: true,
                  min: {
                    value: 0,
                    message: "Số lượng không được nhỏ hơn 0",
                  },
                  validate: (value) =>
                    !Number.isNaN(Number(value)) || "Số lượng không hợp lệ",
                })}
              />

              {errors.inv_quantity && !isViewMode && (
                <p className="mt-1 text-xs font-medium text-red-600">
                  {errors.inv_quantity.message}
                </p>
              )}
            </div>

            <div>
              <label
                htmlFor="product-discount-amount"
                className="mb-1.5 block text-sm font-semibold text-slate-700"
              >
                Tiền chiết khấu
              </label>

              <input
                id="product-discount-amount"
                disabled={isViewMode}
                type="number"
                min={0}
                step="1"
                className="h-10 w-full rounded-lg border border-slate-200 px-3 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:bg-slate-50 disabled:text-slate-500"
                placeholder="Ví dụ: 0"
                {...register("inv_discountAmount", {
                  valueAsNumber: true,
                  min: {
                    value: 0,
                    message: "Tiền chiết khấu không được nhỏ hơn 0",
                  },
                  validate: (value) =>
                    !Number.isNaN(Number(value)) ||
                    "Tiền chiết khấu không hợp lệ",
                })}
              />

              {errors.inv_discountAmount && !isViewMode && (
                <p className="mt-1 text-xs font-medium text-red-600">
                  {errors.inv_discountAmount.message}
                </p>
              )}
            </div>

            <div className="md:col-span-2">
              <label
                htmlFor="product-tax"
                className="mb-1.5 block text-sm font-semibold text-slate-700"
              >
                Thuế suất
              </label>

              <input
                id="product-tax"
                disabled={isViewMode}
                className="h-10 w-full rounded-lg border border-slate-200 px-3 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:bg-slate-50 disabled:text-slate-500"
                placeholder="Ví dụ: 8"
                {...register("ma_thue", {
                  required: "Vui lòng nhập thuế suất",
                  validate: (value) =>
                    String(value).trim().length > 0 ||
                    "Vui lòng nhập thuế suất",
                })}
              />

              {errors.ma_thue && !isViewMode && (
                <p className="mt-1 text-xs font-medium text-red-600">
                  {errors.ma_thue.message}
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
          void handleDeleteProduct(deleteTarget._id)
        }}
        title="Xác nhận thao tác"
        description={`Hành động này sẽ xóa sản phẩm "${deleteTarget?.inv_itemName}" khỏi hệ thống và không thể hoàn tác. Bạn có chắc chắn tiếp tục?`}
        confirmText={deleteLoading ? "Đang xóa..." : "Xóa"}
        cancelText="Hủy"
        tone="destructive"
      />

      <CrudBulkImportModal
        open={isBulkImportOpen}
        title="Tạo sản phẩm hàng loạt từ Excel"
        entityLabel="sản phẩm"
        columns={PRODUCT_IMPORT_COLUMNS}
        previewColumns={PRODUCT_IMPORT_PREVIEW_COLUMNS}
        notes={[
          'Cột "Mã sản phẩm" sẽ được gửi lên hệ thống dưới field inv_itemProduct.',
          'Nếu để trống "Tiền chiết khấu", hệ thống sẽ mặc định là 0.',
        ]}
        onClose={() => setBulkImportOpen(false)}
        onCompleted={handleRefreshProducts}
        mapRow={mapProductImportRow}
        createItem={createBulkProduct}
      />

      {showSuccess && <AlertSuccess description={message} />}
      {showError && <AlertError description={message} />}
    </div>
  )
}
