"use client"

import Link from "next/link"
import { ReceiptText, Settings2, SlidersHorizontal } from "lucide-react"

import InvoiceCreateForm from "@/components/minvoice/InvoiceCreateForm"
import InvoiceDataTable from "@/components/minvoice/InvoiceDataTable"
import InvoiceBulkImport from "@/components/minvoice/InvoiceBulkImport"
import InvoiceToolbar from "@/components/minvoice/InvoiceToolbar"
import InvoiceCollectPaymentDialog from "@/components/minvoice/InvoiceCollectPaymentDialog"

import { useEffect, useMemo, useRef, useState } from "react"
import {
  APICreateSaleTransaction,
  APIDeleteSaleTransaction,
  APIGetSaleTransactionById,
  APIGetSaleTransactions,
  APIUpdateSaleTransaction,
  APIUpdateSaleTransactionBank,
} from "@/services/saleTransaction"

import AlertOption from "@/components/alert/AlertOption"
import AlertSuccess from "@/components/alert/AlertSuccess"
import AlertError from "@/components/alert/AlertError"
import { APIGetBanks } from "@/services/bank"
import {
  APIExportMInvoiceReceiptPost,
  APIViewPrintInvoice,
} from "@/services/mInvoiceReceipt"
import { APIGetReceiptInvoices } from "@/services/receiptInvoice"
import {
  canStartInvoiceExport,
  getExportInvoiceId,
  getId,
  getInvoiceStatus,
  normalizeDateInput,
  toNumber,
} from "@/utils/invoice"
import { buildCreateInvoiceApiBody } from "@/utils/invoicePayload"
import {
  applyInvoiceExportResolutionToRow,
  createAlreadyIssuingResolution,
  createInvoiceExportFailureResolution,
  createRateLimitedResolution,
  type InvoiceExportContext,
  type InvoiceExportResolution,
  isInvoiceAlreadyBeingIssuedError,
  isInvoiceExportRateLimitedError,
  resolveInvoiceExportResult,
} from "@/utils/invoiceExport"
import { InvoiceApiRow, InvoiceStatus } from "@/types/invoice"
import type { Bank } from "@/types/bank"
import type { ReceiptInvoiceConfig } from "@/types/receiptInvoice"
import PageHeader from "../_components/PageHeader"
type PageMode = "list" | "create" | "detail" | "edit" | "bulk-import"

const LIST_ALL_RECEIPT_CONFIG_VALUE = "__ALL_RECEIPT_CONFIG__"
const LIST_PARAMS = {
  page: 1,
  limit: 1000,
}

function normalizeSaleTransactionList(response: any): InvoiceApiRow[] {
  const raw = response?.data ?? []

  const list = Array.isArray(raw)
    ? raw
    : Array.isArray(raw?.items)
      ? raw.items
      : Array.isArray(raw?.docs)
        ? raw.docs
        : Array.isArray(raw?.results)
          ? raw.results
          : Array.isArray(raw?.saleTransactions)
            ? raw.saleTransactions
            : Array.isArray(raw?.transactions)
              ? raw.transactions
              : []

  return list.filter((item: any) => item?._id)
}

function normalizeReceiptInvoiceList(response: any): ReceiptInvoiceConfig[] {
  const raw = response?.data ?? []

  const list = Array.isArray(raw)
    ? raw
    : Array.isArray(raw?.items)
      ? raw.items
      : Array.isArray(raw?.docs)
        ? raw.docs
        : Array.isArray(raw?.results)
          ? raw.results
          : Array.isArray(raw?.receiptInvoices)
            ? raw.receiptInvoices
            : Array.isArray(raw?.configs)
              ? raw.configs
              : raw
                ? [raw]
                : []

  return list.filter(
    (item: any) =>
      item && (getId(item) || item.inv_invoiceSeries || item.tax_code)
  )
}

function normalizeBankList(response: any): Bank[] {
  const raw = response?.data ?? []

  const list = Array.isArray(raw)
    ? raw
    : Array.isArray(raw?.items)
      ? raw.items
      : Array.isArray(raw?.docs)
        ? raw.docs
        : Array.isArray(raw?.results)
          ? raw.results
          : Array.isArray(raw?.banks)
            ? raw.banks
            : raw
              ? [raw]
              : []

  return list.filter((item: any) => item?._id)
}

function getReceiptConfigOptionValue(
  config: ReceiptInvoiceConfig,
  index: number
) {
  return (
    getId(config) ||
    [config.inv_invoiceSeries, config.tax_code].filter(Boolean).join("::") ||
    `receipt-config-${index}`
  )
}

function formatReceiptConfigLabel(config: ReceiptInvoiceConfig) {
  const invoiceSeries = String(config.inv_invoiceSeries || "").trim()
  const description = String(config.description || "").trim()

  if (invoiceSeries && description) {
    return `${invoiceSeries} - ${description}`
  }

  return invoiceSeries || description || "Cấu hình hóa đơn chưa hoàn chỉnh"
}

function getInvoiceSellerTaxCode(invoice: InvoiceApiRow, fallbackTaxCode = "") {
  const row = invoice as any

  return String(
    row?.exportInvoiceData?.tax_code ||
      row?.exportInvoiceData?.data?.tax_code ||
      row?.content?.tax_code ||
      row?.tax_code ||
      fallbackTaxCode ||
      ""
  ).trim()
}

function isInvoiceMatchedReceiptConfig(
  invoice: InvoiceApiRow,
  config?: ReceiptInvoiceConfig | null
) {
  if (!config) return true

  const invoiceSeries = String(invoice.inv_invoiceSeries || "").trim()
  const invoiceTaxCode = getInvoiceSellerTaxCode(invoice)
  const configSeries = String(config.inv_invoiceSeries || "").trim()
  const configTaxCode = String(config.tax_code || "").trim()

  const sameSeries = configSeries && invoiceSeries === configSeries
  const sameTaxCode = configTaxCode && invoiceTaxCode === configTaxCode

  return Boolean(sameSeries || sameTaxCode)
}

function findReceiptConfigByValue(
  receiptConfigs: ReceiptInvoiceConfig[],
  value: string
) {
  if (!value) return null

  return (
    receiptConfigs.find(
      (config, index) => getReceiptConfigOptionValue(config, index) === value
    ) || null
  )
}

function buildPdfFileUrl(filePath: string) {
  if (!filePath) return ""

  if (/^https?:\/\//i.test(filePath)) {
    return filePath
  }

  const baseUrl = process.env.NEXT_PUBLIC_API_URL || ""

  return `${baseUrl.replace(/\/$/, "")}/${filePath.replace(/^\//, "")}`
}

function formatPaymentAmountInput(value: any) {
  const numberValue = toNumber(value)

  if (numberValue <= 0) return ""

  return new Intl.NumberFormat("vi-VN").format(numberValue)
}

function parsePaymentAmountInput(value: string) {
  const digits = String(value || "").replace(/[^\d]/g, "")

  return digits ? Number(digits) : 0
}
function normalizeSaleTransactionDetail(response: any): InvoiceApiRow | null {
  const detail = response?.data ?? null

  return detail?._id ? detail : null
}

function preferDisplayValue(
  serverValue: any,
  clientValue: any,
  fallbackValue?: any
) {
  if (serverValue && typeof serverValue === "object") return serverValue
  if (clientValue && typeof clientValue === "object") return clientValue
  return serverValue ?? clientValue ?? fallbackValue
}

function buildClientItems(payload: any) {
  const items = Array.isArray(payload?.items) ? payload.items : []

  return items.map((item: any) => ({
    productId: item.product || item.productId || null,
    product: item.product || item.productId || null,
    quantity: toNumber(item.quantity ?? item.inv_quantity ?? 0),
    inv_quantity: toNumber(item.inv_quantity ?? item.quantity ?? 0),
    revenue: toNumber(item.revenue),
    capitalPrice: toNumber(item.capitalPrice),
    totalSalary: toNumber(item.totalSalary),
    accountingAccountCode: Number(item.accountingAccountCode || 0),
  }))
}

function hydrateSaleTransactionDetail(
  detail: InvoiceApiRow,
  payload?: any,
  fallback?: InvoiceApiRow | null
): InvoiceApiRow {
  const clientSnapshot = payload?.__clientSnapshot || {}
  const clientPayment = payload?.__clientPayment || {}
  const clientItems = buildClientItems(payload)

  const mergedItems =
    Array.isArray(detail?.items) && detail.items.length
      ? detail.items.map((item: any, index: number) => {
          const clientItem = clientItems[index]
          const fallbackItem = fallback?.items?.[index] as any

          return {
            ...item,
            productId: preferDisplayValue(
              item?.productId,
              clientItem?.productId,
              fallbackItem?.productId
            ),
            product: preferDisplayValue(
              item?.product,
              clientItem?.product,
              fallbackItem?.product
            ),
            quantity:
              item?.quantity ??
              item?.inv_quantity ??
              clientItem?.quantity ??
              fallbackItem?.quantity,
            inv_quantity:
              item?.inv_quantity ??
              item?.quantity ??
              clientItem?.inv_quantity ??
              fallbackItem?.inv_quantity,
          }
        })
      : clientItems.length
        ? clientItems
        : fallback?.items || []

  const totalItemQuantity = mergedItems.reduce((sum: number, item: any) => {
    return sum + toNumber(item?.inv_quantity ?? item?.quantity ?? 0)
  }, 0)

  return {
    ...(fallback || {}),
    ...detail,
    // activationDate:
    //   detail.activationDate ??
    //   payload?.activationDate ??
    //   fallback?.activationDate,
    agencyId: preferDisplayValue(
      detail.agencyId,
      clientSnapshot.agency,
      fallback?.agencyId
    ),
    departmentId: preferDisplayValue(
      detail.departmentId,
      clientSnapshot.department,
      fallback?.departmentId
    ),
    employeeId: preferDisplayValue(
      detail.employeeId,
      clientSnapshot.employee,
      fallback?.employeeId
    ),
    bankId: preferDisplayValue(
      detail.bankId,
      clientSnapshot.bank,
      fallback?.bankId
    ),
    inv_buyerBankName:
      detail.inv_buyerBankName ||
      clientSnapshot.bank?.inv_buyerBankName ||
      fallback?.inv_buyerBankName ||
      payload?.inv_buyerBankName ||
      "",
    inv_quantity: toNumber(
      detail.inv_quantity ??
        payload?.inv_quantity ??
        fallback?.inv_quantity ??
        totalItemQuantity
    ),
    items: mergedItems,
    isPaid: detail.isPaid ?? clientPayment.isPaid ?? fallback?.isPaid ?? false,
    paidAmount:
      detail.paidAmount ??
      clientPayment.paidAmount ??
      fallback?.paidAmount ??
      0,
    paidDate:
      detail.paidDate ?? clientPayment.paidDate ?? fallback?.paidDate ?? "",
    remainingAmount:
      detail.remainingAmount ??
      clientPayment.remainingAmount ??
      fallback?.remainingAmount ??
      0,
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
  const [receiptConfigs, setReceiptConfigs] = useState<ReceiptInvoiceConfig[]>(
    []
  )
  const [configLoading, setConfigLoading] = useState(false)
  const [selectedReceiptConfigValue, setSelectedReceiptConfigValue] =
    useState("")
  const [listReceiptConfigValue, setListReceiptConfigValue] = useState(
    LIST_ALL_RECEIPT_CONFIG_VALUE
  )
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null)
  const [exportingInvoiceId, setExportingInvoiceId] = useState<string | null>(
    null
  )
  const issuingSyncQueueRef = useRef<Set<string>>(new Set())
  const issuingSyncTimeoutRef = useRef<
    Map<string, ReturnType<typeof setTimeout>>
  >(new Map())

  const [pdfViewerOpen, setPdfViewerOpen] = useState(false)
  const [pdfLoading, setPdfLoading] = useState(false)
  const [pdfUrl, setPdfUrl] = useState("")
  const [collectPaymentOpen, setCollectPaymentOpen] = useState(false)
  const [collectPaymentTarget, setCollectPaymentTarget] =
    useState<InvoiceApiRow | null>(null)
  const [collectPaymentBanks, setCollectPaymentBanks] = useState<Bank[]>([])
  const [collectPaymentBankId, setCollectPaymentBankId] = useState("")
  const [collectPaymentAmount, setCollectPaymentAmount] = useState("")
  const [collectPaymentLoading, setCollectPaymentLoading] = useState(false)
  const [collectPaymentSaving, setCollectPaymentSaving] = useState(false)
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
    setPdfTitle("Mẫu hoá đơn")

    if (currentUrl && currentUrl.startsWith("blob:")) {
      setTimeout(() => URL.revokeObjectURL(currentUrl), 0)
    }
  }
  const selectedInvoice = useMemo(() => {
    if (!selectedInvoiceId) return null
    return apiRows.find((item) => item._id === selectedInvoiceId) ?? null
  }, [apiRows, selectedInvoiceId])
  const activeReceiptConfig = useMemo(() => {
    return findReceiptConfigByValue(receiptConfigs, selectedReceiptConfigValue)
  }, [receiptConfigs, selectedReceiptConfigValue])
  const listReceiptConfig = useMemo(() => {
    if (
      listReceiptConfigValue === LIST_ALL_RECEIPT_CONFIG_VALUE ||
      !receiptConfigs.length
    ) {
      return null
    }

    return (
      receiptConfigs.find(
        (config, index) =>
          getReceiptConfigOptionValue(config, index) === listReceiptConfigValue
      ) || null
    )
  }, [receiptConfigs, listReceiptConfigValue])
  const listRows = useMemo(() => {
    if (!listReceiptConfig) return apiRows

    return apiRows.filter((invoice) =>
      isInvoiceMatchedReceiptConfig(invoice, listReceiptConfig)
    )
  }, [apiRows, listReceiptConfig])

  const upsertInvoiceRow = (nextRow: InvoiceApiRow) => {
    setApiRows((prev) => {
      const existed = prev.some((item) => item._id === nextRow._id)

      if (!existed) return [nextRow, ...prev]

      return prev.map((item) => {
        if (item._id !== nextRow._id) return item
        return nextRow
      })
    })
  }

  const hydrateAndUpsertInvoice = (
    detail: InvoiceApiRow,
    payload?: any,
    fallback?: InvoiceApiRow | null
  ) => {
    const nextDetail = hydrateSaleTransactionDetail(detail, payload, fallback)
    upsertInvoiceRow(nextDetail)
    return nextDetail
  }

  useEffect(() => {
    return () => {
      issuingSyncTimeoutRef.current.forEach((timeoutId) =>
        clearTimeout(timeoutId)
      )
      issuingSyncTimeoutRef.current.clear()
      issuingSyncQueueRef.current.clear()
    }
  }, [])

  const cancelInvoiceRefresh = (saleTransactionId: string) => {
    const timeoutId = issuingSyncTimeoutRef.current.get(saleTransactionId)

    if (timeoutId) {
      clearTimeout(timeoutId)
      issuingSyncTimeoutRef.current.delete(saleTransactionId)
    }

    issuingSyncQueueRef.current.delete(saleTransactionId)
  }

  const buildInvoiceExportContext = (
    saleTransactionId: string,
    fallback?: InvoiceApiRow | null,
    resolution?: InvoiceExportResolution | null
  ): InvoiceExportContext => ({
    saleTransactionId,
    invoiceSeries: String(
      resolution?.exportData?.inv_invoiceSeries ||
        fallback?.inv_invoiceSeries ||
        ""
    ).trim(),
    invoiceIssuedDate:
      normalizeDateInput(
        resolution?.exportData?.inv_invoiceIssuedDate ||
          fallback?.inv_invoiceIssuedDate ||
          ""
      ) || undefined,
    taxCode: String(
      resolution?.exportData?.tax_code ||
        (fallback ? getInvoiceSellerTaxCode(fallback) : "") ||
        ""
    ).trim(),
  })

  const fetchSaleTransactionDetail = async (
    saleTransactionId: string,
    fallback?: InvoiceApiRow | null
  ) => {
    const res = await APIGetSaleTransactionById(saleTransactionId)

    console.log("ISSUING_INVOICE_SYNC_RESPONSE", {
      saleTransactionId,
      response: res,
    })

    if (res?.status !== 200 && res?.status !== 201) {
      throw res
    }

    const detail = normalizeSaleTransactionDetail(res)
    if (!detail?._id) {
      return {
        response: res,
        detail: null,
      }
    }

    const nextDetail = hydrateAndUpsertInvoice(detail, null, fallback)

    console.log("ISSUING_INVOICE_SYNC_DETAIL", {
      saleTransactionId,
      detail: nextDetail,
    })

    return {
      response: res,
      detail: nextDetail,
    }
  }

  const scheduleInvoiceRefresh = (
    saleTransactionId: string,
    fallback?: InvoiceApiRow | null,
    initialResolution?: InvoiceExportResolution | null
  ) => {
    const scheduledIds = issuingSyncQueueRef.current

    if (scheduledIds.has(saleTransactionId)) return

    scheduledIds.add(saleTransactionId)

    const refreshIntervals = [3000, 5000, 7000]
    const exportContext = buildInvoiceExportContext(
      saleTransactionId,
      fallback,
      initialResolution
    )

    const finalizeRefresh = (resolution: InvoiceExportResolution) => {
      cancelInvoiceRefresh(saleTransactionId)
      applyInvoiceExportResolution(saleTransactionId, resolution, {
        openDetail: false,
        fallbackRow: fallback,
      })

      if (resolution.status === InvoiceStatus.ISSUED) {
        showSuccessMessage(resolution.message)
        return
      }

      showErrorMessage(resolution.message)
    }

    const runRefresh = (index: number) => {
      if (index >= refreshIntervals.length) {
        finalizeRefresh(
          createInvoiceExportFailureResolution(
            { message: "Không nhận được kết quả xuất hóa đơn từ hệ thống." },
            exportContext,
            "Không nhận được kết quả xuất hóa đơn từ hệ thống."
          )
        )
        return
      }

      const delay = refreshIntervals[index]
      const timeoutId = setTimeout(() => {
        issuingSyncTimeoutRef.current.delete(saleTransactionId)

        void fetchSaleTransactionDetail(saleTransactionId, fallback)
          .then((result) => {
            console.log("ISSUING_INVOICE_SYNC_ATTEMPT", {
              saleTransactionId,
              attempt: index + 1,
              delay,
              result,
            })

            if (isInvoiceExportRateLimitedError(result?.response)) {
              finalizeRefresh(
                createRateLimitedResolution(
                  result?.response,
                  exportContext,
                  "Hệ thống trả về 429 khi kiểm tra kết quả xuất hóa đơn."
                )
              )
              return
            }

            const nextResolution = result?.detail
              ? resolveInvoiceExportResult(result.detail, exportContext)
              : null

            console.log("ISSUING_INVOICE_SYNC_RESOLUTION", {
              saleTransactionId,
              attempt: index + 1,
              resolution: nextResolution,
            })

            if (
              nextResolution &&
              nextResolution.status !== InvoiceStatus.ISSUING
            ) {
              finalizeRefresh(nextResolution)
              return
            }

            if (index === refreshIntervals.length - 1) {
              finalizeRefresh(
                createInvoiceExportFailureResolution(
                  result?.detail || result?.response,
                  exportContext,
                  "Xuất hóa đơn thất bại."
                )
              )
              return
            }

            runRefresh(index + 1)
          })
          .catch((error) => {
            console.error("ISSUING_INVOICE_SYNC_ERROR", {
              saleTransactionId,
              attempt: index + 1,
              delay,
              error,
            })

            finalizeRefresh(
              isInvoiceExportRateLimitedError(error)
                ? createRateLimitedResolution(
                    error,
                    exportContext,
                    "Hệ thống trả về 429 khi kiểm tra kết quả xuất hóa đơn."
                  )
                : createInvoiceExportFailureResolution(
                    error,
                    exportContext,
                    "Xuất hóa đơn thất bại."
                  )
            )
          })
      }, delay)

      issuingSyncTimeoutRef.current.set(saleTransactionId, timeoutId)
    }

    runRefresh(0)
  }

  const applyInvoiceExportResolution = (
    saleTransactionId: string,
    resolution: InvoiceExportResolution,
    options?: { openDetail?: boolean; fallbackRow?: InvoiceApiRow | null }
  ) => {
    setApiRows((prev) =>
      prev.map((row) => {
        if (row._id !== saleTransactionId) return row

        return applyInvoiceExportResolutionToRow(row, resolution)
      })
    )

    if (resolution.status === InvoiceStatus.ISSUING) {
      scheduleInvoiceRefresh(
        saleTransactionId,
        options?.fallbackRow,
        resolution
      )
    } else {
      cancelInvoiceRefresh(saleTransactionId)
    }

    if (options?.openDetail === false) {
      return
    }

    setSelectedInvoiceId(saleTransactionId)
    setMode("detail")
  }

  const handleGetSaleTransactions = async () => {
    try {
      setLoading(true)

      const res = await APIGetSaleTransactions(LIST_PARAMS)

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

  const handleGetReceiptConfigs = async () => {
    try {
      setConfigLoading(true)

      const res = await APIGetReceiptInvoices()

      if (res?.status === 200 || res?.status === 201) {
        setReceiptConfigs(normalizeReceiptInvoiceList(res))
        return
      }

      setReceiptConfigs([])
    } catch (err: any) {
      console.error("APIGetReceiptInvoices error:", err)
      setReceiptConfigs([])
      showErrorMessage(
        err?.response?.data?.message || "Không thể tải cấu hình hóa đơn"
      )
    } finally {
      setConfigLoading(false)
    }
  }

  useEffect(() => {
    handleGetSaleTransactions()
    handleGetReceiptConfigs()
  }, [])

  useEffect(() => {
    if (!receiptConfigs.length) {
      setSelectedReceiptConfigValue("")
      setListReceiptConfigValue(LIST_ALL_RECEIPT_CONFIG_VALUE)
      return
    }

    setSelectedReceiptConfigValue((prev) => {
      if (!prev) return ""

      const existed = receiptConfigs.some(
        (config, index) => getReceiptConfigOptionValue(config, index) === prev
      )

      return existed ? prev : ""
    })

    setListReceiptConfigValue((prev) => {
      if (prev === LIST_ALL_RECEIPT_CONFIG_VALUE) return prev

      const existed = receiptConfigs.some(
        (config, index) => getReceiptConfigOptionValue(config, index) === prev
      )

      return existed ? prev : LIST_ALL_RECEIPT_CONFIG_VALUE
    })
  }, [receiptConfigs])

  useEffect(() => {
    if (!selectedInvoice || !receiptConfigs.length) return

    const invoiceTaxCode = getInvoiceSellerTaxCode(selectedInvoice)
    const matchedIndex = receiptConfigs.findIndex((config) => {
      const sameSeries =
        String(config.inv_invoiceSeries || "").trim() ===
        String(selectedInvoice.inv_invoiceSeries || "").trim()
      const sameTaxCode =
        invoiceTaxCode &&
        String(config.tax_code || "").trim() === invoiceTaxCode

      return sameSeries || sameTaxCode
    })

    if (matchedIndex < 0) return

    const nextValue = getReceiptConfigOptionValue(
      receiptConfigs[matchedIndex],
      matchedIndex
    )

    setSelectedReceiptConfigValue((prev) =>
      prev === nextValue ? prev : nextValue
    )
  }, [selectedInvoice, receiptConfigs])

  useEffect(() => {
    apiRows.forEach((invoice) => {
      if (getInvoiceStatus(invoice) !== InvoiceStatus.ISSUING || !invoice._id) {
        if (invoice._id) {
          cancelInvoiceRefresh(invoice._id)
        }
        return
      }

      scheduleInvoiceRefresh(invoice._id, invoice)
    })
  }, [apiRows])

  const handleReload = async () => {
    setSelectedInvoiceId(null)
    setMode("list")
    await Promise.all([handleGetSaleTransactions(), handleGetReceiptConfigs()])
  }

  const handleAdd = () => {
    if (listReceiptConfigValue !== LIST_ALL_RECEIPT_CONFIG_VALUE) {
      setSelectedReceiptConfigValue(listReceiptConfigValue)
    } else {
      setSelectedReceiptConfigValue("")
    }

    setSelectedInvoiceId(null)
    setMode("create")
  }

  const handleOpenBulkImport = () => {
    setSelectedInvoiceId(null)
    setMode("bulk-import")
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
      showErrorMessage("Không tìm thấy hóa đơn cần hủy.")
      setDeleteDialogOpen(false)
      return
    }

    try {
      setLoading(true)
      setDeleteDialogOpen(false)

      const res = await APIDeleteSaleTransaction(id)

      if (res?.status === 200 || res?.status === 201 || res?.status === 204) {
        const detail = normalizeSaleTransactionDetail(res)

        setApiRows((prev) =>
          prev.map((row) => {
            if (row._id !== id) return row

            return {
              ...row,
              ...(detail || {}),
              invoiceStatus: "CANCELLED",
              updatedAt: new Date().toISOString(),
            } as InvoiceApiRow
          })
        )

        showSuccessMessage("Hủy hóa đơn thành công!")
        setSelectedInvoiceId(null)
        setMode("list")
        return
      }

      showErrorMessage("Hủy hóa đơn thất bại!")
    } catch (err: any) {
      console.error("APIDeleteSaleTransaction error:", err)

      showErrorMessage(err?.response?.data?.message || "Hủy hóa đơn thất bại!")
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

        const nextDetail = hydrateSaleTransactionDetail(detail, null, row)
        setApiRows((prev) => {
          const existed = prev.some((item) => item._id === nextDetail._id)

          if (!existed) return [nextDetail, ...prev]

          return prev.map((item) => {
            if (item._id !== nextDetail._id) return item
            return nextDetail
          })
        })

        if (getInvoiceStatus(nextDetail) === "CANCELLED") {
          showErrorMessage("Hóa đơn đã hủy, không thể chỉnh sửa.")
          setSelectedInvoiceId(nextDetail._id)
          setMode("detail")
          return
        }

        if (getInvoiceStatus(nextDetail) === InvoiceStatus.ISSUED) {
          showErrorMessage(
            "Hóa đơn đã xuất, vui lòng dùng nút Thu tiền để cập nhật thanh toán."
          )
          setSelectedInvoiceId(nextDetail._id)
          setMode("detail")
          return
        }

        setSelectedInvoiceId(nextDetail._id)
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
          const nextDetail = hydrateSaleTransactionDetail(detail, null, row)
          const existed = prev.some((item) => item._id === nextDetail._id)

          if (!existed) return [nextDetail, ...prev]

          return prev.map((item) => {
            if (item._id !== nextDetail._id) return item
            return nextDetail
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

  const closeCollectPaymentDialog = () => {
    if (collectPaymentSaving) return

    setCollectPaymentOpen(false)
    setCollectPaymentTarget(null)
    setCollectPaymentBankId("")
    setCollectPaymentAmount("")
    setCollectPaymentBanks([])
  }
  const handleCollectPaymentAmountChange = (value: string) => {
    const amount = parsePaymentAmountInput(value)

    setCollectPaymentAmount(amount > 0 ? formatPaymentAmountInput(amount) : "")
  }
  const handleOpenCollectPayment = async (row: InvoiceApiRow) => {
    if (getInvoiceStatus(row) !== InvoiceStatus.ISSUED) {
      showErrorMessage("Chỉ hóa đơn đã xuất thành công mới được thu tiền.")
      return
    }

    setCollectPaymentTarget(row)
    setCollectPaymentBankId(getId(row.bankId))
    setCollectPaymentAmount(formatPaymentAmountInput(row.inv_TotalAmount))
    setCollectPaymentBanks([])
    setCollectPaymentOpen(true)

    try {
      setCollectPaymentLoading(true)

      const [bankRes, detailRes] = await Promise.all([
        APIGetBanks(),
        APIGetSaleTransactionById(row._id),
      ])

      const detail = normalizeSaleTransactionDetail(detailRes)
      const nextTarget = detail?._id
        ? hydrateSaleTransactionDetail(detail, null, row)
        : row
      const nextBanks = normalizeBankList(bankRes)
      const currentBank =
        nextTarget.bankId && typeof nextTarget.bankId === "object"
          ? (nextTarget.bankId as Bank)
          : null

      if (
        currentBank?._id &&
        !nextBanks.some((bank) => bank._id === currentBank._id)
      ) {
        nextBanks.unshift(currentBank)
      }

      setCollectPaymentTarget(nextTarget)
      setCollectPaymentBanks(nextBanks)
      setCollectPaymentBankId(getId(nextTarget.bankId))
      setCollectPaymentAmount(
        formatPaymentAmountInput(nextTarget.inv_TotalAmount)
      )
    } catch (err: any) {
      console.error("OPEN_COLLECT_PAYMENT_ERROR", err)
      showErrorMessage(
        err?.response?.data?.message ||
          err?.response?.data?.error ||
          err?.message ||
          "Không thể tải dữ liệu thu tiền."
      )
    } finally {
      setCollectPaymentLoading(false)
    }
  }

  const handleConfirmCollectPayment = async () => {
    const target = collectPaymentTarget

    if (!target?._id) {
      showErrorMessage("Không tìm thấy hóa đơn cần thu tiền.")
      return
    }

    if (getInvoiceStatus(target) !== InvoiceStatus.ISSUED) {
      showErrorMessage("Chỉ hóa đơn đã xuất thành công mới được thu tiền.")
      return
    }

    const selectedBank = collectPaymentBanks.find(
      (bank) => bank._id === collectPaymentBankId
    )

    if (!selectedBank?._id) {
      showErrorMessage("Vui lòng chọn ngân hàng thu tiền.")
      return
    }

    const paidDate = new Date().toISOString().slice(0, 10)
    const paidAmount = parsePaymentAmountInput(collectPaymentAmount)

    if (paidAmount <= 0) {
      showErrorMessage("Vui lòng nhập tổng tiền thu hợp lệ.")
      return
    }
    const paymentSnapshot = {
      isPaid: true,
      paidAmount,
      paidDate,
      remainingAmount: 0,
    }
    const clientPayload = {
      ...target,
      _id: target._id,
      agencyId: getId(target.agencyId) || target.agencyId,
      employeeId: getId(target.employeeId) || target.employeeId,
      bankId: selectedBank._id,
      inv_buyerBankName: selectedBank.inv_buyerBankName,
      isPaid: true,
      paidAmount,
      paidDate,
      paymentDate: paidDate,
      remainingAmount: 0,
      items: (target.items || []).map((item) => ({
        ...item,
        productId: getId(item.productId) || getId(item.product),
      })),
      __clientSnapshot: {
        bank: selectedBank,
      },
      __clientPayment: paymentSnapshot,
      inv_TotalAmount: paidAmount,
    }
    const body = buildCreateInvoiceApiBody(clientPayload, {
      includePayment: true,
      includeId: true,
    })

    try {
      setCollectPaymentSaving(true)

      const res = await APIUpdateSaleTransaction(target._id, body)

      if (res?.status !== 200 && res?.status !== 201) {
        throw new Error("Thu tiền thất bại.")
      }

      const detail = normalizeSaleTransactionDetail(res)
      const nextDetail = {
        ...hydrateSaleTransactionDetail(
          detail || target,
          clientPayload,
          target
        ),
        bankId: selectedBank,
        inv_buyerBankName: selectedBank.inv_buyerBankName,
        inv_TotalAmount: paidAmount,
        isPaid: true,
        paidAmount,
        paidDate,
        paymentDate: paidDate,
        remainingAmount: 0,
        invoiceStatus: (detail as any)?.invoiceStatus || InvoiceStatus.ISSUED,
        updatedAt: new Date().toISOString(),
      } as InvoiceApiRow

      setApiRows((prev) =>
        prev.map((item) => {
          if (item._id !== target._id) return item
          return nextDetail
        })
      )

      setSelectedInvoiceId(target._id)
      setCollectPaymentOpen(false)
      setCollectPaymentTarget(null)
      setCollectPaymentBankId("")
      setCollectPaymentAmount("")
      setCollectPaymentBanks([])
      showSuccessMessage("Thu tiền thành công.")
    } catch (err: any) {
      console.error("CONFIRM_COLLECT_PAYMENT_ERROR", err)
      showErrorMessage(
        err?.response?.data?.message ||
          err?.response?.data?.error ||
          err?.message ||
          "Thu tiền thất bại."
      )
    } finally {
      setCollectPaymentSaving(false)
    }
  }

  const handleSavedInvoice = async (payload: any) => {
    const editingInvoice = mode === "edit" ? selectedInvoice : null

    try {
      setLoading(true)

      if (editingInvoice?._id && payload?.bankOnlyEdit) {
        if (getInvoiceStatus(editingInvoice) !== "ISSUED") {
          throw new Error(
            "Chỉ hóa đơn đã xuất thành công mới được sửa ngân hàng."
          )
        }

        if (!payload.bankId) {
          throw new Error("Vui lòng chọn ngân hàng cần cập nhật.")
        }

        const res = await APIUpdateSaleTransactionBank(editingInvoice._id, {
          bankId: payload.bankId,
        })

        if (res?.status === 200 || res?.status === 201) {
          const detail = normalizeSaleTransactionDetail(res)
          const nextDetail = {
            ...editingInvoice,
            ...(detail || {}),
            bankId: payload.bankId,
            inv_buyerBankName: payload.inv_buyerBankName || "",
            invoiceStatus: "ISSUED",
            updatedAt: new Date().toISOString(),
          } as InvoiceApiRow

          setApiRows((prev) =>
            prev.map((item) => {
              if (item._id !== editingInvoice._id) return item
              return nextDetail
            })
          )

          setSelectedInvoiceId(editingInvoice._id)
          setMode("detail")
          return
        }

        throw new Error("Cập nhật ngân hàng thất bại!")
      }

      const allowPaymentUpdate =
        Boolean(editingInvoice?._id) &&
        getInvoiceStatus(editingInvoice) === "ISSUED"

      const body = buildCreateInvoiceApiBody(payload, {
        includePayment: allowPaymentUpdate,
        includeId: Boolean(editingInvoice?._id),
      })

      console.log("SALE_TRANSACTION_SAVE_REQUEST", {
        mode: editingInvoice?._id ? "update" : "create",
        saleTransactionId: editingInvoice?._id || null,
        body,
      })

      const res = editingInvoice?._id
        ? await APIUpdateSaleTransaction(editingInvoice._id, body)
        : await APICreateSaleTransaction(body)

      console.log("SALE_TRANSACTION_SAVE_RESPONSE", {
        mode: editingInvoice?._id ? "update" : "create",
        saleTransactionId: editingInvoice?._id || null,
        status: res?.status,
        data: res?.data,
      })

      if (res?.status === 200 || res?.status === 201) {
        const detail = normalizeSaleTransactionDetail(res)
        if (detail?._id) {
          const nextDetail = {
            ...hydrateSaleTransactionDetail(detail, payload, editingInvoice),
            invoiceStatus:
              (detail as any).invoiceStatus ||
              (editingInvoice ? getInvoiceStatus(editingInvoice) : "DRAFT"),
          } as InvoiceApiRow

          setApiRows((prev) => {
            const existed = prev.some((item) => item._id === nextDetail._id)

            if (!existed) return [nextDetail, ...prev]

            return prev.map((item) => {
              if (item._id !== nextDetail._id) return item
              return nextDetail
            })
          })

          setSelectedInvoiceId(nextDetail._id)
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
      console.error("SALE_TRANSACTION_SAVE_ERROR", {
        mode: editingInvoice?._id ? "update" : "create",
        saleTransactionId: editingInvoice?._id || null,
        payload,
        error: err,
        response: err?.response?.data,
      })

      throw err
    } finally {
      setLoading(false)
    }
  }

  const handleInvoiceExported = (
    saleTransactionId: string,
    resolution: InvoiceExportResolution,
    options?: { openDetail?: boolean; fallbackRow?: InvoiceApiRow | null }
  ) => {
    applyInvoiceExportResolution(saleTransactionId, resolution, options)
  }

  const handleExportInvoiceFromList = async (row: InvoiceApiRow) => {
    if (exportingInvoiceId) return

    if (!row?._id) {
      showErrorMessage("Không tìm thấy ID giao dịch bán hàng để xuất hóa đơn.")
      return
    }

    const currentStatus = getInvoiceStatus(row)
    if (!canStartInvoiceExport(currentStatus)) {
      showErrorMessage(
        "Chỉ hóa đơn nháp hoặc xuất thất bại mới được xuất hóa đơn."
      )
      return
    }

    const matchedReceiptConfig =
      receiptConfigs.find((config) =>
        isInvoiceMatchedReceiptConfig(row, config)
      ) ||
      activeReceiptConfig ||
      listReceiptConfig ||
      null

    const invoiceSeries = String(
      row.inv_invoiceSeries || matchedReceiptConfig?.inv_invoiceSeries || ""
    ).trim()
    const taxCode = String(
      matchedReceiptConfig?.tax_code || getInvoiceSellerTaxCode(row) || ""
    ).trim()
    const invoiceIssuedDate =
      normalizeDateInput(row.inv_invoiceIssuedDate) ||
      new Date().toISOString().slice(0, 10)

    if (!invoiceSeries) {
      showErrorMessage("Chưa có ký hiệu hóa đơn từ cấu hình.")
      return
    }

    if (!taxCode) {
      showErrorMessage("Chưa có mã số thuế từ cấu hình hóa đơn.")
      return
    }

    const exportContext: InvoiceExportContext = {
      saleTransactionId: row._id,
      invoiceSeries,
      invoiceIssuedDate,
      taxCode,
    }

    try {
      setExportingInvoiceId(row._id)

      console.log("EXPORT_M_INVOICE_FROM_LIST_REQUEST", {
        saleTransactionId: row._id,
        invoiceSeries,
        invoiceIssuedDate,
        taxCode,
      })

      const response = await APIExportMInvoiceReceiptPost(
        {
          saleTransactionId: row._id,
          inv_invoiceSeries: invoiceSeries,
          inv_invoiceIssuedDate: invoiceIssuedDate,
          editmode: 1,
        },
        taxCode
      )

      const resolution = resolveInvoiceExportResult(response, exportContext)

      console.log("EXPORT_M_INVOICE_FROM_LIST_RESOLUTION", {
        saleTransactionId: row._id,
        resolution,
      })

      handleInvoiceExported(row._id, resolution, {
        openDetail: false,
        fallbackRow: row,
      })

      if (resolution.status === InvoiceStatus.FAILED) {
        showErrorMessage(resolution.message)
        return
      }

      if (resolution.status === InvoiceStatus.ISSUED) {
        showSuccessMessage(resolution.message)
      }
    } catch (err: any) {
      console.error("EXPORT_M_INVOICE_FROM_LIST_ERROR", {
        saleTransactionId: row._id,
        invoiceSeries,
        invoiceIssuedDate,
        taxCode,
        error: err,
        response: err?.response?.data,
      })

      if (isInvoiceAlreadyBeingIssuedError(err)) {
        const resolution = createAlreadyIssuingResolution(err, exportContext)

        handleInvoiceExported(row._id, resolution, {
          openDetail: false,
          fallbackRow: row,
        })
        return
      }

      if (isInvoiceExportRateLimitedError(err)) {
        const resolution = createRateLimitedResolution(err, exportContext)

        handleInvoiceExported(row._id, resolution, {
          openDetail: false,
          fallbackRow: row,
        })
        showErrorMessage(resolution.message)
        return
      }

      showErrorMessage(
        err?.response?.data?.message ||
          err?.response?.data?.error ||
          err?.message ||
          "Xuất hóa đơn thất bại."
      )
    } finally {
      setExportingInvoiceId(null)
    }
  }

  const handleViewMInvoicePdf = async (row: InvoiceApiRow) => {
    const token = process.env.NEXT_PUBLIC_MINVOICE_TOKEN || ""
    const invInvoiceCreatedId = getExportInvoiceId(row)
    const taxCode = getInvoiceSellerTaxCode(
      row,
      activeReceiptConfig?.tax_code || ""
    )

    if (!taxCode) {
      showErrorMessage("Chưa có mã số thuế từ cấu hình hóa đơn.")
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
        taxCode,
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
            <div className="space-y-4 px-4 pt-4">
              <PageHeader
                icon={<ReceiptText size={24} />}
                eyebrow="Nghiệp vụ bán hàng"
                title="Quản lý hóa đơn"
                description="Theo dõi danh sách hóa đơn, xuất hóa đơn M-Invoice và kiểm tra trạng thái thanh toán."
                tone="blue"
                actions={
                  <Link
                    href="/quan-ly-ban-hang/cau-hinh-hoa-don"
                    className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                  >
                    <Settings2 size={17} />
                    Cấu hình
                  </Link>
                }
              />

              <div className="flex flex-col gap-3 rounded-lg border border-slate-200 bg-white p-3 shadow-sm lg:flex-row lg:items-center">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-600">
                  <SlidersHorizontal size={19} />
                </div>

                <select
                  className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:bg-slate-100 lg:max-w-[560px]"
                  value={listReceiptConfigValue}
                  disabled={configLoading}
                  onChange={(e) => {
                    const nextValue = e.target.value

                    setListReceiptConfigValue(nextValue)

                    if (nextValue !== LIST_ALL_RECEIPT_CONFIG_VALUE) {
                      setSelectedReceiptConfigValue(nextValue)
                    }
                  }}
                >
                  <option value={LIST_ALL_RECEIPT_CONFIG_VALUE}>
                    Tất cả ký hiệu hóa đơn
                  </option>
                  {receiptConfigs.map((config, index) => (
                    <option
                      key={getReceiptConfigOptionValue(config, index)}
                      value={getReceiptConfigOptionValue(config, index)}
                    >
                      {formatReceiptConfigLabel(config)}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <InvoiceToolbar
              onReload={handleReload}
              onAdd={handleAdd}
              onBulkImport={handleOpenBulkImport}
              onDelete={handleDelete}
              onViewAll={handleReload}
              loading={loading}
              disableDelete={!selectedInvoiceId}
            />

            <InvoiceDataTable
              rows={listRows}
              loading={loading}
              onEdit={handleEdit}
              onView={handleView}
              onExportInvoice={handleExportInvoiceFromList}
              exportingInvoiceId={exportingInvoiceId}
              onViewMInvoicePdf={handleViewMInvoicePdf}
              onCollectPayment={handleOpenCollectPayment}
            />
          </>
        ) : mode === "bulk-import" ? (
          <InvoiceBulkImport
            receiptConfigs={receiptConfigs}
            onBack={() => {
              setSelectedInvoiceId(null)
              setMode("list")
            }}
            onInvoicesCreated={async () => {
              await handleGetSaleTransactions()
            }}
          />
        ) : mode === "detail" && selectedInvoice ? (
          <InvoiceCreateForm
            mode="detail"
            initialInvoice={selectedInvoice}
            receiptConfig={activeReceiptConfig}
            receiptConfigs={receiptConfigs}
            selectedReceiptConfigValue={selectedReceiptConfigValue}
            onReceiptConfigChange={setSelectedReceiptConfigValue}
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
            receiptConfig={activeReceiptConfig}
            receiptConfigs={receiptConfigs}
            selectedReceiptConfigValue={selectedReceiptConfigValue}
            onReceiptConfigChange={setSelectedReceiptConfigValue}
            onBack={() => setMode("detail")}
            onEdit={() => setMode("edit")}
            onSaved={handleSavedInvoice}
          />
        ) : (
          <InvoiceCreateForm
            mode="create"
            initialInvoice={null}
            receiptConfig={activeReceiptConfig}
            receiptConfigs={receiptConfigs}
            selectedReceiptConfigValue={selectedReceiptConfigValue}
            onReceiptConfigChange={setSelectedReceiptConfigValue}
            receiptConfigLocked={
              listReceiptConfigValue !== LIST_ALL_RECEIPT_CONFIG_VALUE
            }
            onBack={() => {
              setSelectedInvoiceId(null)
              setMode("list")
            }}
            onSaved={handleSavedInvoice}
          />
        )}
      </main>

      <InvoiceCollectPaymentDialog
        open={collectPaymentOpen}
        invoice={collectPaymentTarget}
        banks={collectPaymentBanks}
        bankId={collectPaymentBankId}
        amountValue={collectPaymentAmount}
        loadingBanks={collectPaymentLoading}
        saving={collectPaymentSaving}
        onBankChange={setCollectPaymentBankId}
        onAmountChange={handleCollectPaymentAmountChange}
        onClose={closeCollectPaymentDialog}
        onConfirm={handleConfirmCollectPayment}
      />

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
        title="Xác nhận hủy hóa đơn"
        description="Bạn có chắc chắn muốn hủy hóa đơn này? Hóa đơn sẽ chuyển sang trạng thái CANCELLED."
        confirmText="Hủy hóa đơn"
        cancelText="Hủy"
        tone="destructive"
      />

      {showSuccess && <AlertSuccess description={message} />}
      {showError && <AlertError description={message} />}
    </div>
  )
}
