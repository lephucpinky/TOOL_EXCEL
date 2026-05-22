"use client"

import {
  APICreateProduct,
  APIDeleteProduct,
  APIGetProductById,
  APIGetProducts,
  APIUpdateProduct,
} from "@/services/product"
import { Product, ProductPayload } from "@/types/product"

import AlertOption from "@/components/alert/AlertOption"
import AlertSuccess from "@/components/alert/AlertSuccess"
import AlertError from "@/components/alert/AlertError"
import { Loader2, Plus, X } from "lucide-react"
import { ReactNode, useEffect, useMemo, useState } from "react"
import { useForm } from "react-hook-form"
import DataTable, { DataTableColumn } from "@/components/common/Datatable"

const emptyForm: ProductPayload = {
  inv_itemCode: "",
  inv_itemName: "",
  inv_unitCode: "",
  inv_unitPrice: 0,
  inv_quantity: 0,
  inv_discountAmount: 0,
  ma_thue: "",
}

type ModeType = "create" | "view" | "edit" | null

function formatNumber(value: number) {
  return new Intl.NumberFormat("vi-VN").format(Number(value || 0))
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

export default function ProductPage() {
  const [products, setProducts] = useState<Product[]>([])
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null)

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
  } = useForm<ProductPayload>({
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

  const handleGetProducts = async () => {
    try {
      setLoading(true)

      const response = await APIGetProducts()
      if (response?.status === 200 && Array.isArray(response.data)) {
        setProducts(response.data)
        return
      }
    } catch (err) {
      console.error("APIGetProducts error:", err)
      showErrorMessage("Không thể tải danh sách sản phẩm")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    handleGetProducts()
  }, [])

  const columns = useMemo<DataTableColumn<Product>[]>(
    () => [
      {
        key: "index",
        title: "STT",
        className: "w-[70px] text-slate-500",
        render: (_item, index) => index + 1,
      },
      {
        key: "inv_itemCode",
        title: "Mã sản phẩm",
        render: (item) => (
          <p className="font-semibold text-slate-900">{item.inv_itemCode}</p>
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
            {item.ma_thue}%
          </span>
        ),
      },
    ],
    []
  )

  const handleCloseDialog = () => {
    if (submitLoading || detailLoading) return

    setOpen(false)
    setSelectedProduct(null)
    setMode("create")
    reset(emptyForm)
  }

  const openCreateDialog = () => {
    setSelectedProduct(null)
    setMode("create")
    reset(emptyForm)
    setOpen(true)
  }

  const handleCreateProduct = async (data: ProductPayload) => {
    try {
      setSubmitLoading(true)

      const res = await APICreateProduct(data)

      if (res?.status === 201 || res?.status === 200) {
        showSuccessMessage("Thêm sản phẩm thành công!")
        await handleGetProducts()
        handleCloseDialog()
      }
    } catch (err: any) {
      console.error("APICreateProduct error:", err)
      showErrorMessage(
        err?.response?.data?.message || "Thêm sản phẩm thất bại!"
      )
    } finally {
      setSubmitLoading(false)
    }
  }

  const handleUpdateProduct = async (id: string, data: ProductPayload) => {
    try {
      setSubmitLoading(true)

      const res = await APIUpdateProduct(id, data)

      if (res?.status === 200 || res?.status === 201) {
        showSuccessMessage("Cập nhật sản phẩm thành công!")
        await handleGetProducts()
        handleCloseDialog()
      }
    } catch (err: any) {
      console.error("APIUpdateProduct error:", err)
      showErrorMessage(
        err?.response?.data?.message || "Cập nhật sản phẩm thất bại!"
      )
    } finally {
      setSubmitLoading(false)
    }
  }

  const handleDeleteProduct = async (id: string) => {
    try {
      setDeleteLoading(true)

      const res = await APIDeleteProduct(id)

      if (res?.status === 200 || res?.status === 201 || res?.status === 204) {
        showSuccessMessage("Xóa sản phẩm thành công!")
        setDeleteDialogOpen(false)
        setSelectedProduct(null)
        setMode("create")
        reset(emptyForm)
        await handleGetProducts()
        return
      }

      showErrorMessage("Xóa sản phẩm thất bại!")
    } catch (err: any) {
      console.error("APIDeleteProduct error:", err)
      showErrorMessage(err?.response?.data?.message || "Xóa sản phẩm thất bại!")
    } finally {
      setDeleteLoading(false)
    }
  }

  const onSubmit = async (data: ProductPayload) => {
    const body: ProductPayload = {
      inv_itemCode: data.inv_itemCode.trim(),
      inv_itemName: data.inv_itemName.trim(),
      inv_unitCode: data.inv_unitCode.trim(),
      inv_unitPrice: Number(data.inv_unitPrice),
      inv_quantity: Number(data.inv_quantity),
      inv_discountAmount: Number(data.inv_discountAmount),
      ma_thue: String(data.ma_thue).trim(),
    }

    if (isCreateMode) {
      await handleCreateProduct(body)
      return
    }

    if (isEditMode && selectedProduct?._id) {
      await handleUpdateProduct(selectedProduct._id, body)
      return
    }
  }

  const onView = async (rowData: Product) => {
    if (!rowData?._id) {
      showErrorMessage("Không tìm thấy ID sản phẩm")
      return
    }

    try {
      setDetailLoading(true)
      setSelectedProduct(null)

      const res = await APIGetProductById(rowData._id)

      if (res?.status === 200 || res?.status === 201) {
        const detail = res.data as Product

        setSelectedProduct(detail)

        reset({
          inv_itemCode: detail.inv_itemCode || "",
          inv_itemName: detail.inv_itemName || "",
          inv_unitCode: detail.inv_unitCode || "",
          inv_unitPrice: Number(detail.inv_unitPrice || 0),
          inv_quantity: Number(detail.inv_quantity || 0),
          inv_discountAmount: Number(detail.inv_discountAmount || 0),
          ma_thue: String(detail.ma_thue || ""),
        })

        setMode("view")
        setOpen(true)
      }
    } catch (err: any) {
      console.error("APIGetProductById view error:", err)
      showErrorMessage(
        err?.response?.data?.message || "Không thể tải chi tiết sản phẩm"
      )
    } finally {
      setDetailLoading(false)
    }
  }

  const onEdit = async (rowData: Product) => {
    if (!rowData?._id) {
      showErrorMessage("Không tìm thấy ID sản phẩm")
      return
    }

    try {
      setDetailLoading(true)
      setSelectedProduct(null)

      const res = await APIGetProductById(rowData._id)

      if (res?.status === 200 || res?.status === 201) {
        const detail = res.data as Product

        setSelectedProduct(detail)

        reset({
          inv_itemCode: detail.inv_itemCode || "",
          inv_itemName: detail.inv_itemName || "",
          inv_unitCode: detail.inv_unitCode || "",
          inv_unitPrice: Number(detail.inv_unitPrice || 0),
          inv_quantity: Number(detail.inv_quantity || 0),
          inv_discountAmount: Number(detail.inv_discountAmount || 0),
          ma_thue: String(detail.ma_thue || ""),
        })

        setMode("edit")
        setOpen(true)
      }
    } catch (err: any) {
      console.error("APIGetProductById edit error:", err)
      showErrorMessage(
        err?.response?.data?.message || "Không thể tải dữ liệu sản phẩm"
      )
    } finally {
      setDetailLoading(false)
    }
  }

  const onDeleteClick = (rowData: Product) => {
    if (!rowData?._id) {
      showErrorMessage("Không tìm thấy ID sản phẩm")
      return
    }

    setSelectedProduct(rowData)
    setDeleteDialogOpen(true)
  }

  return (
    <div className="min-h-screen bg-slate-100 p-5">
      <div className="mx-auto max-w-7xl space-y-5">
        <div className="flex flex-col gap-3 rounded-xl bg-white p-5 shadow-sm md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-xl font-bold text-slate-900">
              Quản lý sản phẩm
            </h1>
            {/* <p className="mt-1 text-sm text-slate-500">
              Quản lý mã sản phẩm, tên sản phẩm, đơn vị tính, đơn giá, số lượng
              và thuế suất.
            </p> */}
          </div>

          <button
            type="button"
            onClick={openCreateDialog}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 text-sm font-bold text-white transition hover:bg-blue-700"
          >
            <Plus size={18} />
            Thêm sản phẩm
          </button>
        </div>

        <DataTable
          data={products}
          columns={columns}
          loading={loading}
          emptyText="Chưa có dữ liệu sản phẩm"
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
              <label className="mb-1.5 block text-sm font-semibold text-slate-700">
                Mã sản phẩm
              </label>

              <input
                disabled={isViewMode}
                className="h-10 w-full rounded-lg border border-slate-200 px-3 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:bg-slate-50 disabled:text-slate-500"
                placeholder="Ví dụ: HH001"
                {...register("inv_itemCode", {
                  required: "Vui lòng nhập mã sản phẩm",
                  validate: (value) =>
                    value.trim().length > 0 || "Vui lòng nhập mã sản phẩm",
                })}
              />

              {errors.inv_itemCode && !isViewMode && (
                <p className="mt-1 text-xs font-medium text-red-600">
                  {errors.inv_itemCode.message}
                </p>
              )}
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-semibold text-slate-700">
                Tên sản phẩm
              </label>

              <input
                disabled={isViewMode}
                className="h-10 w-full rounded-lg border border-slate-200 px-3 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:bg-slate-50 disabled:text-slate-500"
                placeholder="Ví dụ: Hang hoa 001"
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
              <label className="mb-1.5 block text-sm font-semibold text-slate-700">
                Đơn vị tính
              </label>

              <input
                disabled={isViewMode}
                className="h-10 w-full rounded-lg border border-slate-200 px-3 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:bg-slate-50 disabled:text-slate-500"
                placeholder="Ví dụ: Phan"
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
              <label className="mb-1.5 block text-sm font-semibold text-slate-700">
                Đơn giá
              </label>

              <input
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
              <label className="mb-1.5 block text-sm font-semibold text-slate-700">
                Số lượng
              </label>

              <input
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
              <label className="mb-1.5 block text-sm font-semibold text-slate-700">
                Tiền chiết khấu
              </label>

              <input
                disabled={isViewMode}
                type="number"
                min={0}
                step="1"
                className="h-10 w-full rounded-lg border border-slate-200 px-3 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:bg-slate-50 disabled:text-slate-500"
                placeholder="Ví dụ: 0"
                {...register("inv_discountAmount", {
                  required: "Vui lòng nhập tiền chiết khấu",
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
              <label className="mb-1.5 block text-sm font-semibold text-slate-700">
                Thuế suất
              </label>

              <input
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
          if (!selectedProduct?._id || deleteLoading) return
          void handleDeleteProduct(selectedProduct._id)
        }}
        title="Xác nhận thao tác"
        description={`Hành động này sẽ xóa sản phẩm "${selectedProduct?.inv_itemName}" khỏi hệ thống và không thể hoàn tác. Bạn có chắc chắn tiếp tục?`}
        confirmText={deleteLoading ? "Đang xóa..." : "Xóa"}
        cancelText="Hủy"
        tone="destructive"
      />

      {showSuccess && <AlertSuccess description={message} />}
      {showError && <AlertError description={message} />}
    </div>
  )
}
