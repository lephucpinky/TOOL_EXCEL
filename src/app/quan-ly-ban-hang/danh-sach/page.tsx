"use client"

import InvoiceCreateForm from "@/components/minvoice/InvoiceCreateForm"
import InvoiceDataTable from "@/components/minvoice/InvoiceDataTable"
import InvoiceToolbar from "@/components/minvoice/InvoiceToolbar"

import { InvoiceApiRow } from "@/types/invoice"

import { useEffect, useMemo, useState } from "react"
import {
  APICreateSaleTransaction,
  APIDeleteSaleTransaction,
  APIGetSaleTransactionById,
  APIGetSaleTransactions,
  APIUpdateSaleTransaction,
} from "@/services/saleTransaction"

import AlertOption from "@/components/alert/AlertOption"
import AlertSuccess from "@/components/alert/AlertSuccess"
import AlertError from "@/components/alert/AlertError"
import { APIViewPrintInvoice } from "@/services/mInvoiceReceipt"
import { ViewPrintInvoiceType } from "@/types/viewPrintInvoice.type"

const MINVOICE_TAX_CODE = process.env.NEXT_PUBLIC_MINVOICE_TAX_CODE || ""
type PageMode = "list" | "create" | "detail" | "edit"

type MaybeWrappedInvoiceApiRow =
  | InvoiceApiRow
  | {
      content: InvoiceApiRow
    }

function toNumber(value: unknown) {
  const numberValue = Number(value)
  return Number.isFinite(numberValue) ? numberValue : 0
}

function toApiDate(value?: string) {
  if (!value) return ""

  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [year, month, day] = value.split("-")
    return `${day}/${month}/${year} 12:00:00 SA`
  }

  return value
}

function unwrapApiRow(row: MaybeWrappedInvoiceApiRow): InvoiceApiRow {
  if ("content" in row) return row.content
  return row
}

function normalizeSaleTransactionList(response: any): InvoiceApiRow[] {
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
            : Array.isArray(rawRoot?.saleTransactions)
              ? rawRoot.saleTransactions
              : Array.isArray(rawRoot?.transactions)
                ? rawRoot.transactions
                : Array.isArray(rawRoot?.content)
                  ? rawRoot.content
                  : []

  return raw
    .map((item: any) => unwrapApiRow(item?.content ?? item))
    .filter((item: any) => item?._id)
}
function buildPdfFileUrl(filePath: string) {
  if (!filePath) return ""

  if (/^https?:\/\//i.test(filePath)) {
    return filePath
  }

  const baseUrl = process.env.NEXT_PUBLIC_API_URL || ""

  return `${baseUrl.replace(/\/$/, "")}/${filePath.replace(/^\//, "")}`
}
function normalizeSaleTransactionDetail(response: any): InvoiceApiRow | null {
  const raw =
    response?.data?.data ??
    response?.data?.content ??
    response?.data?.result ??
    response?.data ??
    response?.content ??
    response?.result ??
    response

  if (!raw) return null

  const detail = unwrapApiRow(raw?.content ?? raw)

  return detail?._id ? detail : null
}

function mapInvoiceApiToTableRow(invoice: InvoiceApiRow) {
  const invoiceDate = invoice.inv_invoiceIssuedDate || ""
  const monthMatch = invoiceDate.match(/^(\d{2})\/(\d{2})\/(\d{4})/)
  const month = monthMatch ? `${monthMatch[2]}/${monthMatch[3]}` : ""

  const rawItems = Array.isArray((invoice as any).items)
    ? (invoice as any).items
    : (invoice as any).items
      ? [(invoice as any).items]
      : []

  const firstItem = rawItems[0]
  const firstProduct =
    firstItem?.productId && typeof firstItem.productId === "object"
      ? firstItem.productId
      : firstItem

  const totalInvoice = toNumber(invoice.inv_TotalAmount)
  const totalValue = toNumber(invoice.inv_TotalAmountWithoutVAT)
  const paidAmount = toNumber(invoice.paidAmount)
  const remainingAmount =
    invoice.remainingAmount !== undefined
      ? toNumber(invoice.remainingAmount)
      : Math.max(totalInvoice - paidAmount, 0)

  const commissionRate = toNumber(invoice.agencyId?.commissionPercent)
  const commissionAmount = rawItems.reduce((sum: number, item: any) => {
    return sum + toNumber(item?.commissionAmount)
  }, 0)

  const revenue = rawItems.reduce((sum: number, item: any) => {
    return sum + toNumber(item?.revenue)
  }, 0)

  return {
    id: invoice._id,
    month,
    activatedDate: invoice.createdAt || invoiceDate,
    dealerName: invoice.agencyId?.name || "",
    departmentName: invoice.departmentId?.departmentName || "",
    employeeName: invoice.employeeId?.employeeName || "",
    taxCode: invoice.inv_buyerTaxCode || "",
    companyName:
      invoice.inv_buyerLegalName || invoice.inv_buyerDisplayName || "",
    newQuantity: toNumber(invoice.newQuantity || invoice.inv_quantity),
    renewQuantity: toNumber(invoice.renewQuantity),
    giftQuantity: toNumber(invoice.giftQuantity),
    invoiceDate,
    invoiceNo:
      invoice.invoiceNo ||
      invoice.inv_invoiceNumber ||
      invoice.so_hoa_don ||
      "",
    explanation: invoice.ten_ch || "",
    productName: firstProduct?.inv_itemName || "",
    invoiceTitle: invoice.invoiceTitle || invoice.inv_invoiceSeries || "",
    difference: toNumber(invoice.difference),
    totalInvoice,
    totalValue,
    unitPrice: toNumber(firstProduct?.inv_unitPrice),
    bq: toNumber(firstProduct?.inv_unitPrice),
    invoicePackage: toNumber(invoice.invoicePackage),
    otherAmount: toNumber(invoice.otherAmount),
    writeDifference: toNumber(invoice.writeDifference),
    customerDiscount: toNumber(invoice.customerDiscount),
    commissionRate,
    commissionAmount,
    writeRevenue: toNumber(invoice.writeRevenue),
    differencePayable: toNumber(invoice.differencePayable),
    minvoiceRevenue: toNumber(invoice.minvoiceRevenue || revenue),
    ds: toNumber(invoice.ds || totalValue),
    paid: invoice.isPaid || paidAmount > 0 ? "paid" : "unpaid",
    paidAmount,
    remainingAmount,
    note: invoice.note || "",
  }
}

function buildCreateApiBody(payload: any) {
  const items = Array.isArray(payload.items) ? payload.items : []

  return {
    inv_invoiceSeries: payload.inv_invoiceSeries || "1C26MZZ",
    inv_invoiceIssuedDate: toApiDate(payload.inv_invoiceIssuedDate),
    inv_currencyCode: payload.inv_currencyCode || "VND",
    inv_exchangeRate: toNumber(payload.inv_exchangeRate || 1),

    so_benh_an: payload.so_benh_an || "",

    inv_buyerDisplayName:
      payload.inv_buyerDisplayName || payload.inv_buyerLegalName || "",
    inv_buyerLegalName:
      payload.inv_buyerLegalName || payload.inv_buyerDisplayName || "",
    inv_buyerTaxCode: payload.inv_buyerTaxCode || "",
    inv_buyerAddressLine: payload.inv_buyerAddressLine || "",
    inv_buyerEmail: payload.inv_buyerEmail || "",
    inv_buyerBankAccount: payload.inv_buyerBankAccount || "",
    inv_buyerBankName: payload.inv_buyerBankName || "",
    inv_paymentMethodName: payload.inv_paymentMethodName || "CK",

    inv_discountAmount: toNumber(payload.inv_discountAmount),
    inv_TotalAmountWithoutVAT: toNumber(payload.inv_TotalAmountWithoutVAT),
    inv_vatAmount: toNumber(payload.inv_vatAmount),
    inv_TotalAmount: toNumber(payload.inv_TotalAmount),

    key_api: payload.key_api || "",
    cccdan: payload.cccdan || "",
    so_hchieu: payload.so_hchieu || "",
    mdvqhnsach_nmua: payload.mdvqhnsach_nmua || "",
    ma_ch: payload.ma_ch || "",
    ten_ch: payload.ten_ch || "",

    inv_quantity: toNumber(payload.inv_quantity),
    inv_discountPercentage: toNumber(payload.inv_discountPercentage),

    agencyId: payload.agencyId,
    departmentId: payload.departmentId,
    employeeId: payload.employeeId,
    bankId: payload.bankId,

    items: items.map((item: any) => ({
      productId: item.productId,
      revenue: toNumber(item.revenue),
      capitalPrice: toNumber(item.capitalPrice),
      totalSalary: toNumber(item.totalSalary),
      accountingAccountCode: Number(item.accountingAccountCode || 0),
    })),
  }
}
function getMInvoiceData(invoice: InvoiceApiRow) {
  const row = invoice as any

  return (
    row.content?.data ||
    row.content ||
    row.exportInvoiceData?.data ||
    row.exportInvoiceData ||
    row.data?.data ||
    row.data ||
    row
  )
}

function getExportInvoiceId(invoice: any) {
  const mInvoiceData =
    invoice?.content?.data ||
    invoice?.content ||
    invoice?.exportInvoiceData?.data ||
    invoice?.exportInvoiceData ||
    invoice?.data?.data ||
    invoice?.data ||
    null

  return String(
    mInvoiceData?.inv_invoiceCreatedId ||
      mInvoiceData?.id ||
      invoice?.inv_invoiceCreatedId ||
      invoice?.hoadon68_id ||
      invoice?.inv_invoiceAuth_id ||
      invoice?.inv_originalId ||
      ""
  ).trim()
}
async function getBlobErrorMessage(data: any) {
  if (!(data instanceof Blob)) return ""

  const text = await data.text()

  try {
    const json = JSON.parse(text)

    return (
      json?.message ||
      json?.error ||
      json?.data?.message ||
      json?.content?.message ||
      text
    )
  } catch {
    return text
  }
}

export default function InvoiceListPage() {
  const [apiRows, setApiRows] = useState<InvoiceApiRow[]>([])
  const [loading, setLoading] = useState(false)
  const [mode, setMode] = useState<PageMode>("list")
  const [selectedInvoiceId, setSelectedInvoiceId] = useState<string | null>(
    null
  )
  const [showSuccess, setShowSuccess] = useState(false)
  const [showError, setShowError] = useState(false)
  const [message, setMessage] = useState("")
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null)

  const [pdfViewerOpen, setPdfViewerOpen] = useState(false)
  const [pdfLoading, setPdfLoading] = useState(false)
  const [pdfUrl, setPdfUrl] = useState("")
  const [pdfTitle, setPdfTitle] = useState("Mẫu hóa đơn")

  const showSuccessMessage = (text: string) => {
    setShowError(false)
    setMessage(text)
    setShowSuccess(true)
    setTimeout(() => setShowSuccess(false), 3000)
  }

  const showErrorMessage = (text: string) => {
    setShowSuccess(false)
    setMessage(text)
    setShowError(true)
    setTimeout(() => setShowError(false), 3000)
  }
  const closePdfViewer = () => {
    const currentUrl = pdfUrl

    setPdfViewerOpen(false)
    setPdfLoading(false)
    setPdfUrl("")
    setPdfTitle("Mẫu hóa đơn")

    if (currentUrl && currentUrl.startsWith("blob:")) {
      setTimeout(() => URL.revokeObjectURL(currentUrl), 0)
    }
  }
  const selectedInvoice = useMemo(() => {
    if (!selectedInvoiceId) return null
    return apiRows.find((item) => item._id === selectedInvoiceId) ?? null
  }, [apiRows, selectedInvoiceId])

  const handleGetSaleTransactions = async () => {
    try {
      setLoading(true)

      const res = await APIGetSaleTransactions()

      if (res?.status === 200 || res?.status === 201) {
        setApiRows(normalizeSaleTransactionList(res))
        return
      }

      setApiRows([])
    } catch (err: any) {
      console.error("APIGetSaleTransactions error:", err)
      showErrorMessage(
        err?.response?.data?.message || "Không thể tải danh sách hóa đơn"
      )
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    handleGetSaleTransactions()
  }, [])

  const handleReload = async () => {
    setSelectedInvoiceId(null)
    setMode("list")
    await handleGetSaleTransactions()
  }

  const handleAdd = () => {
    setSelectedInvoiceId(null)
    setMode("create")
  }

  const handleDelete = () => {
    const id = selectedInvoiceId

    if (!id) {
      showErrorMessage("Vui lòng mở chi tiết hoặc chọn hóa đơn cần xóa trước.")
      return
    }

    setPendingDeleteId(id)
    setDeleteDialogOpen(true)
  }

  const handleConfirmDelete = async () => {
    const id = pendingDeleteId || selectedInvoiceId

    if (!id) {
      showErrorMessage("Không tìm thấy hóa đơn cần xóa.")
      setDeleteDialogOpen(false)
      return
    }

    try {
      setLoading(true)
      setDeleteDialogOpen(false)

      const res = await APIDeleteSaleTransaction(id)

      if (res?.status === 200 || res?.status === 201 || res?.status === 204) {
        showSuccessMessage("Xóa hóa đơn thành công!")

        setSelectedInvoiceId(null)
        setMode("list")
        await handleGetSaleTransactions()
        return
      }

      showErrorMessage("Xóa hóa đơn thất bại!")
    } catch (err: any) {
      console.error("APIDeleteSaleTransaction error:", err)

      showErrorMessage(err?.response?.data?.message || "Xóa hóa đơn thất bại!")
    } finally {
      setLoading(false)
      setPendingDeleteId(null)
    }
  }
  const handleEdit = async (row: any) => {
    try {
      setLoading(true)

      const res = await APIGetSaleTransactionById(row._id)

      if (res?.status === 200 || res?.status === 201) {
        const detail = normalizeSaleTransactionDetail(res)

        if (!detail?._id) {
          showErrorMessage("Không tìm thấy dữ liệu hóa đơn")
          return
        }

        setApiRows((prev) => {
          const existed = prev.some((item) => item._id === detail._id)

          if (!existed) return [detail, ...prev]

          return prev.map((item) => {
            if (item._id !== detail._id) return item
            return detail
          })
        })

        setSelectedInvoiceId(detail._id)
        setMode("edit")
      }
    } catch (err: any) {
      console.error("APIGetSaleTransactionById edit error:", err)
      showErrorMessage(
        err?.response?.data?.message || "Không thể tải dữ liệu hóa đơn"
      )
    } finally {
      setLoading(false)
    }
  }

  const handleView = async (row: any) => {
    try {
      setLoading(true)

      const res = await APIGetSaleTransactionById(row._id)

      if (res?.status === 200 || res?.status === 201) {
        const detail = normalizeSaleTransactionDetail(res)

        if (!detail?._id) {
          showErrorMessage("Không tìm thấy chi tiết hóa đơn")
          return
        }

        setApiRows((prev) => {
          const existed = prev.some((item) => item._id === detail._id)

          if (!existed) return [detail, ...prev]

          return prev.map((item) => {
            if (item._id !== detail._id) return item
            return detail
          })
        })

        setSelectedInvoiceId(detail._id)
        setMode("detail")
      }
    } catch (err: any) {
      console.error("APIGetSaleTransactionById view error:", err)
      showErrorMessage(
        err?.response?.data?.message || "Không thể tải chi tiết hóa đơn"
      )
    } finally {
      setLoading(false)
    }
  }

  const handleSavedInvoice = async (payload: any) => {
    const editingInvoice = mode === "edit" ? selectedInvoice : null
    const body = buildCreateApiBody(payload)

    try {
      setLoading(true)

      const res = editingInvoice?._id
        ? await APIUpdateSaleTransaction(editingInvoice._id, body)
        : await APICreateSaleTransaction(body)

      if (res?.status === 200 || res?.status === 201) {
        const detail = normalizeSaleTransactionDetail(res)

        if (detail?._id) {
          setApiRows((prev) => {
            const existed = prev.some((item) => item._id === detail._id)

            if (!existed) return [detail, ...prev]

            return prev.map((item) => {
              if (item._id !== detail._id) return item
              return detail
            })
          })

          setSelectedInvoiceId(detail._id)
          setMode("detail")
        } else {
          await handleGetSaleTransactions()
          setSelectedInvoiceId(null)
          setMode("list")
        }

        return
      }

      throw new Error(
        editingInvoice ? "Cập nhật hóa đơn thất bại!" : "Thêm hóa đơn thất bại!"
      )
    } catch (err: any) {
      console.error("Save sale transaction error:", err)

      throw err
    } finally {
      setLoading(false)
    }
  }
  const handleInvoiceExported = (
    saleTransactionId: string,
    exportData: any
  ) => {
    const exportInvoiceId =
      exportData?.id ||
      exportData?.inv_invoiceCreatedId ||
      exportData?.hoadon68_id ||
      exportData?.inv_invoiceAuth_id ||
      exportData?.inv_originalId ||
      ""

    if (!exportInvoiceId) return

    setApiRows((prev) =>
      prev.map((row) => {
        if (row._id !== saleTransactionId) return row

        return {
          ...row,

          // Field để InvoiceDataTable nhận biết đã xuất hóa đơn
          id: exportInvoiceId,
          inv_invoiceCreatedId: exportInvoiceId,

          // Lưu lại response xuất hóa đơn
          exportInvoiceData: {
            ...exportData,
            id: exportInvoiceId,
            inv_invoiceCreatedId: exportInvoiceId,
          },

          // Cập nhật số hóa đơn nếu response có trả về
          inv_invoiceNumber:
            exportData?.inv_invoiceNumber ?? row.inv_invoiceNumber,
          so_hoa_don: exportData?.shdon ?? row.so_hoa_don,
          inv_invoiceSeries:
            exportData?.inv_invoiceSeries ?? row.inv_invoiceSeries,

          updatedAt: new Date().toISOString(),
        } as InvoiceApiRow
      })
    )
  }
  const handleViewMInvoicePdf = async (row: InvoiceApiRow) => {
    const token = process.env.NEXT_PUBLIC_MINVOICE_TOKEN || ""
    const invInvoiceCreatedId = getExportInvoiceId(row)

    if (!MINVOICE_TAX_CODE) {
      showErrorMessage("Chưa cấu hình mã số thuế M-Invoice trong file .env.")
      return
    }

    if (!invInvoiceCreatedId) {
      showErrorMessage("Hóa đơn chưa có mã khởi tạo trên M-Invoice.")
      return
    }

    try {
      setPdfViewerOpen(true)
      setPdfLoading(true)
      setPdfUrl("")
      setPdfTitle("Mẫu hóa đơn")

      const res = await APIViewPrintInvoice({
        token,
        taxCode: MINVOICE_TAX_CODE,
        inv_invoiceCreatedId: invInvoiceCreatedId,
      })

      const filePath = String(
        res?.filePath || res?.data?.filePath || res?.content?.filePath || ""
      ).trim()

      if (!filePath) {
        closePdfViewer()
        showErrorMessage("API không trả về đường dẫn file PDF.")
        return
      }

      const nextPdfUrl = buildPdfFileUrl(filePath)

      setPdfUrl(nextPdfUrl)
    } catch (err: any) {
      console.error("APIViewPrintInvoice error:", err)

      closePdfViewer()

      showErrorMessage(
        err?.response?.data?.message ||
          err?.response?.data?.error ||
          err?.message ||
          "Không thể xem mẫu hóa đơn."
      )
    } finally {
      setPdfLoading(false)
    }
  }
  return (
    <div className="flex min-h-screen flex-col bg-[#edf1f5] text-slate-800">
      <main className="flex min-h-0 flex-1 flex-col">
        {mode === "list" ? (
          <>
            <div className="border-b border-slate-200 bg-[#f8fafc] px-4 py-2">
              <div className="flex items-center gap-3">
                <select className="h-9 w-full max-w-[520px] rounded border border-slate-300 bg-white px-3 text-sm font-medium text-slate-700 outline-none focus:border-indigo-500">
                  <option>
                    1C26MZZ - Hóa đơn giá trị gia tăng - Máy tính tiền
                  </option>
                </select>

                <button
                  type="button"
                  className="ml-auto flex h-9 w-9 items-center justify-center rounded-full border border-slate-300 bg-white text-slate-600 hover:bg-slate-50"
                >
                  ⚙
                </button>
              </div>
            </div>

            <InvoiceToolbar
              onReload={handleReload}
              onAdd={handleAdd}
              onDelete={handleDelete}
              onViewAll={handleReload}
              loading={loading}
              disableDelete={!selectedInvoiceId}
            />

            <InvoiceDataTable
              rows={apiRows}
              loading={loading}
              onEdit={handleEdit}
              onView={handleView}
              onViewMInvoicePdf={handleViewMInvoicePdf}
            />
          </>
        ) : mode === "detail" && selectedInvoice ? (
          <InvoiceCreateForm
            mode="detail"
            initialInvoice={selectedInvoice}
            onBack={() => {
              setSelectedInvoiceId(null)
              setMode("list")
            }}
            onEdit={() => setMode("edit")}
            onSaved={handleSavedInvoice}
            onExported={handleInvoiceExported}
          />
        ) : mode === "edit" && selectedInvoice ? (
          <InvoiceCreateForm
            mode="edit"
            initialInvoice={selectedInvoice}
            onBack={() => setMode("detail")}
            onEdit={() => setMode("edit")}
            onSaved={handleSavedInvoice}
          />
        ) : (
          <InvoiceCreateForm
            mode="create"
            initialInvoice={null}
            onBack={() => {
              setSelectedInvoiceId(null)
              setMode("list")
            }}
            onSaved={handleSavedInvoice}
          />
        )}
      </main>

      {pdfViewerOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/60 p-4">
          <div className="flex h-[100vh] w-full max-w-6xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-end border-b border-slate-200 px-4 py-3">
              <button
                type="button"
                onClick={closePdfViewer}
                className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-300 bg-white text-xl leading-none text-slate-600 hover:bg-slate-50"
              >
                ×
              </button>
            </div>

            <div className="min-h-0 flex-1 bg-slate-100">
              {pdfLoading ? (
                <div className="flex h-full flex-col items-center justify-center text-slate-600">
                  <div className="mb-3 h-9 w-9 animate-spin rounded-full border-2 border-slate-300 border-t-indigo-600" />
                  <div className="text-sm font-semibold">
                    Đang tải mẫu hóa đơn...
                  </div>
                </div>
              ) : pdfUrl ? (
                <iframe
                  src={pdfUrl}
                  title={pdfTitle}
                  className="h-full w-full border-0 bg-white"
                />
              ) : (
                <div className="flex h-full items-center justify-center text-sm text-slate-500">
                  Không có dữ liệu PDF để hiển thị.
                </div>
              )}
            </div>
          </div>
        </div>
      )}
      <AlertOption
        isOpen={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        onConfirm={handleConfirmDelete}
        title="Xác nhận xóa hóa đơn"
        description="Bạn có chắc chắn muốn xóa hóa đơn này? Thao tác này không thể hoàn tác."
        confirmText="Xóa"
        cancelText="Hủy"
        tone="destructive"
      />

      {showSuccess && <AlertSuccess description={message} />}
      {showError && <AlertError description={message} />}
    </div>
  )
}
