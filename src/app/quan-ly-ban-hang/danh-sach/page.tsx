"use client"

import Link from "next/link"
import { ReceiptText, Settings2 } from "lucide-react"
import { useEffect, useMemo, useRef, useState } from "react"

import InvoiceCreateForm from "@/components/minvoice/InvoiceCreateForm"
import InvoiceDataTable from "@/components/minvoice/InvoiceDataTable"
import InvoiceBulkImport from "@/components/minvoice/InvoiceBulkImport"
import InvoiceToolbar from "@/components/minvoice/InvoiceToolbar"
import InvoiceCollectPaymentDialog from "@/components/minvoice/InvoiceCollectPaymentDialog"

import AlertOption from "@/components/alert/AlertOption"
import AlertSuccess from "@/components/alert/AlertSuccess"
import AlertError from "@/components/alert/AlertError"

import { APIGetBanks } from "@/services/bank"
import {
  APIDeleteSaleTransaction,
  APIGetSaleTransactions,
} from "@/services/saleTransaction"
import {
  APIExportMInvoiceReceiptPost,
  APIGetMInvoiceReceiptJobStatus,
  APIViewPrintInvoice,
} from "@/services/mInvoiceReceipt"
import { APIGetReceiptInvoices } from "@/services/receiptInvoice"

import * as invoiceHelper from "@/utils/invoice"
import { buildCreateInvoiceApiBody } from "@/utils/invoicePayload"
import {
  applyInvoiceExportResolutionToRow,
  createAlreadyIssuingResolution,
  createInvoiceExportFailureResolution,
  createRateLimitedResolution,
  getInvoiceExportAlertMessage,
  getInvoiceExportErrorAlertMessage,
  getInvoiceExportJobId,
  type InvoiceExportContext,
  type InvoiceExportResolution,
  isInvoiceAlreadyBeingIssuedError,
  isInvoiceExportRateLimitedError,
  resolveInvoiceExportResult,
  resolveInvoiceExportResultWithJobStatus,
} from "@/utils/invoiceExport"

import { useAppDispatch, useAppSelector } from "@/store/hooks"
import {
  createSaleTransactionThunk,
  fetchSaleTransactionByIdThunk,
  fetchSaleTransactionsThunk,
  saleTransactionActions,
  updateSaleTransactionBankThunk,
  updateSaleTransactionThunk,
} from "@/store/slices"

import {
  InvoiceApiRow,
  InvoicePaymentStatus,
  InvoiceStatus,
} from "@/types/invoice"
import type { Bank } from "@/types/bank"
import type { ReceiptInvoiceConfig } from "@/types/receiptInvoice"

import PageHeader from "../../../components/header/PageHeader"

type PageMode = "list" | "create" | "detail" | "edit" | "bulk-import"

type InvoiceFormPayload = Partial<InvoiceApiRow> & {
  bankOnlyEdit?: boolean
  bankId?: Bank | string | null
  inv_buyerBankName?: string
  __clientSnapshot?: {
    department?: InvoiceApiRow["departmentId"]
  }
}

type ApiErrorLike = {
  response?: {
    data?: {
      message?: string
      error?: string
    }
  }
  message?: string
}

const DEPARTMENT_OVERRIDE_STORAGE_KEY =
  "minvoice.saleTransaction.departmentOverrides"

const LIST_PARAMS = {
  page: 1,
  limit: 1000,
}

export default function InvoiceListPage() {
  const dispatch = useAppDispatch()
  const {
    items: apiRows,
    loading: listLoading,
    detailLoading,
    submitLoading,
    deleteLoading,
  } = useAppSelector((state) => state.saleTransactions)

  const [pageLoading, setPageLoading] = useState(false)
  const loading =
    pageLoading ||
    listLoading ||
    detailLoading ||
    submitLoading ||
    deleteLoading

  const [mode, setMode] = useState<PageMode>("list")
  const [selectedInvoiceId, setSelectedInvoiceId] = useState<string | null>(
    null
  )

  const [showSuccess, setShowSuccess] = useState(false)
  const [showError, setShowError] = useState(false)
  const [message, setMessage] = useState("")

  const [receiptConfigs, setReceiptConfigs] = useState<ReceiptInvoiceConfig[]>(
    invoiceHelper.getFixedReceiptInvoiceConfigs()
  )
  const [selectedReceiptConfigValue, setSelectedReceiptConfigValue] = useState(
    invoiceHelper.getFixedReceiptConfigOptionValue()
  )

  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null)

  const [exportingInvoiceId, setExportingInvoiceId] = useState<string | null>(
    null
  )

  const [pdfViewerOpen, setPdfViewerOpen] = useState(false)
  const [pdfLoading, setPdfLoading] = useState(false)
  const [pdfUrl, setPdfUrl] = useState("")
  const [pdfTitle, setPdfTitle] = useState("Mẫu hóa đơn")

  const [collectPaymentOpen, setCollectPaymentOpen] = useState(false)
  const [collectPaymentTarget, setCollectPaymentTarget] =
    useState<InvoiceApiRow | null>(null)
  const [collectPaymentBanks, setCollectPaymentBanks] = useState<Bank[]>([])
  const [collectPaymentBankId, setCollectPaymentBankId] = useState("")
  const [collectPaymentAmount, setCollectPaymentAmount] = useState("")
  const [collectPaymentLoading, setCollectPaymentLoading] = useState(false)
  const [collectPaymentSaving, setCollectPaymentSaving] = useState(false)

  const apiRowsRef = useRef<InvoiceApiRow[]>([])
  const issuingSyncQueueRef = useRef<Set<string>>(new Set())
  const issuingSyncTimeoutRef = useRef<
    Map<string, ReturnType<typeof setTimeout>>
  >(new Map())
  const issuingSyncVersionRef = useRef<Map<string, number>>(new Map())
  const alertTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const exportingInvoiceRef = useRef(false)
  const collectPaymentSavingRef = useRef(false)

  const hasOwnField = <K extends PropertyKey>(
    value: unknown,
    key: K
  ): value is Record<K, unknown> => {
    return (
      Boolean(value) &&
      typeof value === "object" &&
      Object.prototype.hasOwnProperty.call(value, key)
    )
  }

  const isFilledValue = (value: unknown) => {
    return value !== undefined && value !== null && String(value).trim() !== ""
  }

  const toSafeNumber = (value: unknown) => {
    const numberValue = invoiceHelper.toNumber(value)
    return Number.isFinite(numberValue) ? numberValue : 0
  }

  const readDepartmentOverrides = () => {
    if (typeof window === "undefined") return {}

    try {
      const rawValue = window.localStorage.getItem(
        DEPARTMENT_OVERRIDE_STORAGE_KEY
      )
      const parsedValue = rawValue ? JSON.parse(rawValue) : {}

      return parsedValue && typeof parsedValue === "object"
        ? (parsedValue as Record<string, InvoiceApiRow["departmentId"]>)
        : {}
    } catch {
      return {}
    }
  }

  const persistDepartmentOverride = (
    invoiceId: string,
    department: InvoiceApiRow["departmentId"] | undefined
  ) => {
    if (!invoiceId || typeof window === "undefined") return

    const overrides = readDepartmentOverrides()

    if (department && typeof department === "object") {
      overrides[invoiceId] = department
    } else {
      delete overrides[invoiceId]
    }

    window.localStorage.setItem(
      DEPARTMENT_OVERRIDE_STORAGE_KEY,
      JSON.stringify(overrides)
    )
  }

  const applyDepartmentOverride = (invoice: InvoiceApiRow): InvoiceApiRow => {
    if (!invoice?._id) return invoice

    const override = readDepartmentOverrides()[invoice._id]

    if (!override || typeof override !== "object") return invoice

    return {
      ...invoice,
      departmentId: override,
    }
  }

  const getPaymentStatus = (
    totalAmount: number,
    amountCollected: number
  ): InvoicePaymentStatus => {
    if (totalAmount > 0 && amountCollected >= totalAmount) {
      return InvoicePaymentStatus.PAID
    }

    if (amountCollected > 0) {
      return InvoicePaymentStatus.PARTIAL
    }

    return InvoicePaymentStatus.UNPAID
  }

  const getErrorAlertMessage = (error: unknown, fallbackMessage: string) => {
    if (error && typeof error === "object") {
      const err = error as ApiErrorLike

      return (
        err.response?.data?.message ||
        err.response?.data?.error ||
        err.message ||
        fallbackMessage
      )
    }

    return fallbackMessage
  }

  const canCollectPayment = (invoice?: InvoiceApiRow | null) => {
    const status = invoiceHelper.getInvoiceStatus(invoice)

    return status === InvoiceStatus.DRAFT || status === InvoiceStatus.ISSUED
  }

  const getPaymentAmountFromInvoice = (
    invoice?: InvoiceApiRow | null,
    fallback?: InvoiceApiRow | null
  ) => {
    const invoiceTotalAmount = toSafeNumber(invoice?.inv_TotalAmount)
    const fallbackTotalAmount = toSafeNumber(fallback?.inv_TotalAmount)
    const totalAmount =
      invoiceTotalAmount > 0 ? invoiceTotalAmount : fallbackTotalAmount

    if (
      hasOwnField(invoice, "amountCollected") &&
      isFilledValue(invoice.amountCollected)
    ) {
      const amountCollected = toSafeNumber(invoice.amountCollected)

      if (amountCollected > 0) {
        return amountCollected
      }
    }

    if (hasOwnField(invoice, "paidAmount") && isFilledValue(invoice.paidAmount)) {
      const paidAmount = toSafeNumber(invoice.paidAmount)

      if (paidAmount > 0) {
        return paidAmount
      }
    }

    if (
      totalAmount > 0 &&
      (invoice?.isPaid === true ||
        invoice?.paymentStatus === InvoicePaymentStatus.PAID)
    ) {
      return totalAmount
    }

    if (
      hasOwnField(fallback, "amountCollected") &&
      isFilledValue(fallback.amountCollected)
    ) {
      const amountCollected = toSafeNumber(fallback.amountCollected)

      if (amountCollected > 0) {
        return amountCollected
      }
    }

    if (
      hasOwnField(fallback, "paidAmount") &&
      isFilledValue(fallback.paidAmount)
    ) {
      const paidAmount = toSafeNumber(fallback.paidAmount)

      if (paidAmount > 0) {
        return paidAmount
      }
    }

    if (
      totalAmount > 0 &&
      (fallback?.isPaid === true ||
        fallback?.paymentStatus === InvoicePaymentStatus.PAID)
    ) {
      return totalAmount
    }

    return 0
  }

  const getSuggestedPaymentAmountFromInvoice = (
    invoice?: InvoiceApiRow | null,
    fallback?: InvoiceApiRow | null
  ) => {
    if (
      hasOwnField(invoice, "suggestedAmountCollected") &&
      isFilledValue(invoice.suggestedAmountCollected)
    ) {
      return toSafeNumber(invoice.suggestedAmountCollected)
    }

    if (
      hasOwnField(fallback, "suggestedAmountCollected") &&
      isFilledValue(fallback.suggestedAmountCollected)
    ) {
      return toSafeNumber(fallback.suggestedAmountCollected)
    }

    return 0
  }

  const mergeInvoicePaymentState = (
    invoice: InvoiceApiRow,
    fallback?: InvoiceApiRow | null
  ): InvoiceApiRow => {
    if (!invoice?._id) return invoice

    const invoiceTotalAmount = toSafeNumber(invoice.inv_TotalAmount)
    const fallbackTotalAmount = toSafeNumber(fallback?.inv_TotalAmount)
    const totalAmount =
      invoiceTotalAmount > 0 ? invoiceTotalAmount : fallbackTotalAmount

    const amountCollected = getPaymentAmountFromInvoice(invoice, fallback)
    const remainingAmount = Math.max(totalAmount - amountCollected, 0)
    const suggestedAmountCollectedFromInvoice =
      getSuggestedPaymentAmountFromInvoice(invoice, fallback)
    const invoiceStatus = invoice.invoiceStatus || fallback?.invoiceStatus
    const suggestedAmountCollected =
      amountCollected > 0
        ? amountCollected
        : suggestedAmountCollectedFromInvoice > 0
          ? suggestedAmountCollectedFromInvoice
          : invoiceStatus === InvoiceStatus.ISSUED
            ? totalAmount
            : 0

    /**
     * Quy tắc đúng:
     * - Chưa thu hoặc thu một phần: isPaid = false
     * - Chỉ khi thu đủ hoặc lớn hơn tổng tiền: isPaid = true
     */
    const isPaid = totalAmount > 0 && amountCollected >= totalAmount

    const paidDate =
      invoice.paidDate ||
      invoice.paymentDate ||
      fallback?.paidDate ||
      fallback?.paymentDate ||
      undefined

    return {
      ...invoice,
      inv_TotalAmount: totalAmount,
      amountCollected,
      suggestedAmountCollected,
      paidAmount: amountCollected,
      isPaid,
      paymentStatus: getPaymentStatus(totalAmount, amountCollected),
      paidDate: amountCollected > 0 ? paidDate : undefined,
      paymentDate: amountCollected > 0 ? paidDate : undefined,
      remainingAmount,
    }
  }

  const getInvoiceAmountCollected = (invoice?: InvoiceApiRow | null) => {
    return getPaymentAmountFromInvoice(invoice)
  }

  const getInvoiceDefaultCollectPaymentAmount = (
    invoice?: InvoiceApiRow | null
  ) => {
    const amountCollected = getInvoiceAmountCollected(invoice)

    if (amountCollected > 0) {
      return amountCollected
    }

    return getSuggestedPaymentAmountFromInvoice(invoice)
  }

  const clearAlertTimer = () => {
    if (alertTimerRef.current) {
      clearTimeout(alertTimerRef.current)
      alertTimerRef.current = null
    }
  }

  const showSuccessMessage = (text: string) => {
    clearAlertTimer()
    setShowError(false)
    setMessage(text)
    setShowSuccess(true)

    alertTimerRef.current = setTimeout(() => {
      setShowSuccess(false)
      alertTimerRef.current = null
    }, 3000)
  }

  const showErrorMessage = (text: string) => {
    clearAlertTimer()
    setShowSuccess(false)
    setMessage(text)
    setShowError(true)

    alertTimerRef.current = setTimeout(() => {
      setShowError(false)
      alertTimerRef.current = null
    }, 3000)
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

  useEffect(() => {
    apiRowsRef.current = apiRows
  }, [apiRows])

  const replaceInvoiceRows = (
    updater: (rows: InvoiceApiRow[]) => InvoiceApiRow[]
  ) => {
    const nextRows = updater(apiRowsRef.current)
    apiRowsRef.current = nextRows
    dispatch(saleTransactionActions.setSaleTransactions(nextRows))
  }

  const selectedInvoice = useMemo(() => {
    if (!selectedInvoiceId) return null
    return apiRows.find((item) => item._id === selectedInvoiceId) ?? null
  }, [apiRows, selectedInvoiceId])

  const activeReceiptConfig = useMemo(() => {
    return (
      invoiceHelper.findReceiptConfigByValue(
        receiptConfigs,
        selectedReceiptConfigValue
      ) ||
      receiptConfigs[0] ||
      invoiceHelper.getFixedReceiptInvoiceConfig()
    )
  }, [receiptConfigs, selectedReceiptConfigValue])

  const listReceiptConfig = useMemo(() => {
    return receiptConfigs[0] || invoiceHelper.getFixedReceiptInvoiceConfig()
  }, [receiptConfigs])

  const listRows = useMemo(() => {
    return apiRows
  }, [apiRows])

  const upsertInvoiceRow = (nextRow: InvoiceApiRow) => {
    const fallback = apiRowsRef.current.find((item) => item._id === nextRow._id)
    const normalizedRow = mergeInvoicePaymentState(
      applyDepartmentOverride(nextRow),
      fallback ? applyDepartmentOverride(fallback) : fallback
    )
    const existed = Boolean(fallback)

    apiRowsRef.current = existed
      ? apiRowsRef.current.map((item) =>
          item._id === normalizedRow._id ? normalizedRow : item
        )
      : [normalizedRow, ...apiRowsRef.current]

    dispatch(saleTransactionActions.upsertSaleTransaction(normalizedRow))
  }

  const hydrateAndUpsertInvoice = (
    detail: InvoiceApiRow,
    payload?: InvoiceFormPayload | null,
    fallback?: InvoiceApiRow | null
  ) => {
    const nextDetail = mergeInvoicePaymentState(
      applyDepartmentOverride(
        invoiceHelper.hydrateSaleTransactionDetail(detail, payload, fallback)
      ),
      fallback ? applyDepartmentOverride(fallback) : fallback
    )

    upsertInvoiceRow(nextDetail)
    return nextDetail
  }

  useEffect(() => {
    return () => {
      clearAlertTimer()

      issuingSyncTimeoutRef.current.forEach((timeoutId) =>
        clearTimeout(timeoutId)
      )
      issuingSyncTimeoutRef.current.clear()
      issuingSyncQueueRef.current.clear()
      issuingSyncVersionRef.current.clear()
    }
  }, [])

  const cancelInvoiceRefresh = (saleTransactionId: string) => {
    const timeoutId = issuingSyncTimeoutRef.current.get(saleTransactionId)

    if (timeoutId) {
      clearTimeout(timeoutId)
      issuingSyncTimeoutRef.current.delete(saleTransactionId)
    }

    issuingSyncQueueRef.current.delete(saleTransactionId)
    issuingSyncVersionRef.current.delete(saleTransactionId)
  }

  const buildInvoiceExportContext = (
    saleTransactionId: string,
    fallback?: InvoiceApiRow | null,
    resolution?: InvoiceExportResolution | null
  ): InvoiceExportContext => {
    const matchedReceiptConfig = fallback
      ? receiptConfigs.find((config) =>
          invoiceHelper.isInvoiceMatchedReceiptConfig(fallback, config)
        ) ||
        activeReceiptConfig ||
        invoiceHelper.getFixedReceiptInvoiceConfig()
      : null

    return {
      saleTransactionId,
      invoiceSeries: String(
        resolution?.exportData?.inv_invoiceSeries ||
          matchedReceiptConfig?.inv_invoiceSeries ||
          fallback?.inv_invoiceSeries ||
          ""
      ).trim(),
      invoiceIssuedDate:
        invoiceHelper.normalizeDateInput(
          resolution?.exportData?.inv_invoiceIssuedDate ||
            fallback?.inv_invoiceIssuedDate ||
            ""
        ) || undefined,
      taxCode: String(
        resolution?.exportData?.tax_code ||
          matchedReceiptConfig?.tax_code ||
          (fallback
            ? invoiceHelper.getInvoiceSellerTaxCode(
                fallback,
                matchedReceiptConfig?.tax_code || ""
              )
            : "")
      ).trim(),
    }
  }

  const fetchSaleTransactionDetail = async (
    saleTransactionId: string,
    fallback?: InvoiceApiRow | null
  ) => {
    const detail = await dispatch(
      fetchSaleTransactionByIdThunk(saleTransactionId)
    ).unwrap()

    if (!detail?._id) {
      return {
        response: null,
        detail: null,
      }
    }

    const nextDetail = hydrateAndUpsertInvoice(detail, null, fallback)

    return {
      response: null,
      detail: nextDetail,
    }
  }

  const fetchInvoiceJobStatus = async (
    jobId: string,
    exportContext: InvoiceExportContext
  ) => {
    const response = await APIGetMInvoiceReceiptJobStatus(jobId)
    const resolution = resolveInvoiceExportResult(response, exportContext)

    return {
      response,
      resolution,
    }
  }

  const syncInvoiceListAfterExport = async (saleTransactionId: string) => {
    let latestRows: InvoiceApiRow[] = []

    for (let attempt = 0; attempt < 10; attempt += 1) {
      if (attempt > 0) {
        await new Promise<void>((resolve) => setTimeout(resolve, 1000))
      }

      const response = await APIGetSaleTransactions(LIST_PARAMS)
      latestRows = invoiceHelper.normalizeSaleTransactionList(response)

      const latestRow =
        latestRows.find((item) => item._id === saleTransactionId) || null
      const latestInvoiceNumber = String(latestRow?.invoiceNumber ?? "").trim()

      if (latestInvoiceNumber) {
        break
      }
    }

    if (!latestRows.length) return

    const previousRowMap = new Map(
      apiRowsRef.current.map((item) => [item._id, item])
    )
    const nextRows = latestRows.map((item) => {
      const fallback = previousRowMap.get(item._id)

      if (item._id !== saleTransactionId) {
        return mergeInvoicePaymentState(
          applyDepartmentOverride(item),
          fallback ? applyDepartmentOverride(fallback) : fallback
        )
      }

      const amountCollected = Math.max(
        getPaymentAmountFromInvoice(item),
        getPaymentAmountFromInvoice(fallback)
      )

      return mergeInvoicePaymentState(
        applyDepartmentOverride({
          ...item,
          invoiceStatus: InvoiceStatus.ISSUED,
          amountCollected,
          suggestedAmountCollected:
            amountCollected ||
            toSafeNumber(item.inv_TotalAmount || fallback?.inv_TotalAmount),
        }),
        fallback ? applyDepartmentOverride(fallback) : fallback
      )
    })

    apiRowsRef.current = nextRows
    dispatch(saleTransactionActions.setSaleTransactions(nextRows))
  }

  const scheduleInvoiceRefresh = (
    saleTransactionId: string,
    fallback?: InvoiceApiRow | null,
    initialResolution?: InvoiceExportResolution | null
  ) => {
    const scheduledIds = issuingSyncQueueRef.current

    if (scheduledIds.has(saleTransactionId)) return

    scheduledIds.add(saleTransactionId)

    const syncVersion =
      (issuingSyncVersionRef.current.get(saleTransactionId) || 0) + 1
    issuingSyncVersionRef.current.set(saleTransactionId, syncVersion)

    const isCurrentRefresh = () =>
      issuingSyncVersionRef.current.get(saleTransactionId) === syncVersion

    const refreshIntervals = [3000, 5000, 7000]
    const exportContext = buildInvoiceExportContext(
      saleTransactionId,
      fallback,
      initialResolution
    )
    const jobId =
      getInvoiceExportJobId(initialResolution?.exportData) ||
      getInvoiceExportJobId(fallback)

    const finalizeRefresh = (resolution: InvoiceExportResolution) => {
      if (!isCurrentRefresh()) return

      cancelInvoiceRefresh(saleTransactionId)
      applyInvoiceExportResolution(saleTransactionId, resolution, {
        openDetail: false,
        fallbackRow: fallback,
      })

      if (resolution.status === InvoiceStatus.ISSUED) {
        showSuccessMessage(getInvoiceExportAlertMessage(resolution))
        return
      }

      showErrorMessage(getInvoiceExportErrorAlertMessage(resolution, fallback))
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

        if (!isCurrentRefresh()) return

        const refreshPromise = jobId
          ? fetchInvoiceJobStatus(jobId, exportContext)
          : fetchSaleTransactionDetail(saleTransactionId, fallback).then(
              (result) => ({
                response: result.response,
                resolution: result.detail
                  ? resolveInvoiceExportResult(result.detail, exportContext)
                  : null,
              })
            )

        void refreshPromise
          .then((result) => {
            if (!isCurrentRefresh()) return

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

            const nextResolution = result?.resolution || null

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
                  result?.resolution?.exportData || result?.response,
                  exportContext,
                  "Xuất hóa đơn thất bại."
                )
              )
              return
            }

            runRefresh(index + 1)
          })
          .catch((error) => {
            if (!isCurrentRefresh()) return

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
    replaceInvoiceRows((prev) =>
      prev.map((row) => {
        if (row._id !== saleTransactionId) return row

        return mergeInvoicePaymentState(
          applyDepartmentOverride(
            applyInvoiceExportResolutionToRow(row, resolution)
          ),
          applyDepartmentOverride(row)
        )
      })
    )

    if (resolution.status === InvoiceStatus.ISSUED) {
      void syncInvoiceListAfterExport(saleTransactionId).catch((error) => {
        console.error("FETCH_LIST_AFTER_EXPORT_SUCCESS_ERROR", {
          saleTransactionId,
          error,
        })
      })
    }

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
      const previousRows = apiRowsRef.current
      const previousRowMap = new Map(
        previousRows.map((item) => [item._id, item])
      )

      const rows = await dispatch(
        fetchSaleTransactionsThunk(LIST_PARAMS)
      ).unwrap()

      const nextRows = rows.map((row) => {
        const fallback = previousRowMap.get(row._id)
        return mergeInvoicePaymentState(
          applyDepartmentOverride(row),
          fallback ? applyDepartmentOverride(fallback) : fallback
        )
      })

      apiRowsRef.current = nextRows
      dispatch(saleTransactionActions.setSaleTransactions(nextRows))
    } catch (error) {
      console.error("APIGetSaleTransactions error:", error)
      replaceInvoiceRows(() => [])
      showErrorMessage(
        getErrorAlertMessage(error, "Không thể tải danh sách hóa đơn")
      )
    }
  }

  const handleGetReceiptConfigs = async () => {
    try {
      const res = await APIGetReceiptInvoices()

      if (res?.status === 200 || res?.status === 201) {
        setReceiptConfigs(invoiceHelper.normalizeReceiptInvoiceList(res))
        return
      }

      setReceiptConfigs(invoiceHelper.getFixedReceiptInvoiceConfigs())
    } catch (error) {
      console.error("APIGetReceiptInvoices error:", error)
      setReceiptConfigs(invoiceHelper.getFixedReceiptInvoiceConfigs())
      showErrorMessage(
        getErrorAlertMessage(error, "Không thể tải cấu hình hóa đơn")
      )
    }
  }

  useEffect(() => {
    void handleGetSaleTransactions()
    void handleGetReceiptConfigs()
  }, [])

  useEffect(() => {
    if (!receiptConfigs.length) {
      setReceiptConfigs(invoiceHelper.getFixedReceiptInvoiceConfigs())
      setSelectedReceiptConfigValue(
        invoiceHelper.getFixedReceiptConfigOptionValue()
      )
      return
    }

    const fixedValue = invoiceHelper.getReceiptConfigOptionValue(
      receiptConfigs[0],
      0
    )

    setSelectedReceiptConfigValue((prev:any) => {
      if (!prev) return fixedValue

      const existed = receiptConfigs.some(
        (config, index) =>
          invoiceHelper.getReceiptConfigOptionValue(config, index) === prev
      )

      return existed ? prev : fixedValue
    })
  }, [receiptConfigs])

  useEffect(() => {
    if (!selectedInvoice || !receiptConfigs.length) return

    const invoiceTaxCode =
      invoiceHelper.getInvoiceSellerTaxCode(selectedInvoice)

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

    const nextValue = invoiceHelper.getReceiptConfigOptionValue(
      receiptConfigs[matchedIndex],
      matchedIndex
    )

    setSelectedReceiptConfigValue((prev:any) =>
      prev === nextValue ? prev : nextValue
    )
  }, [selectedInvoice, receiptConfigs])

  useEffect(() => {
    apiRows.forEach((invoice) => {
      if (
        invoiceHelper.getInvoiceStatus(invoice) !== InvoiceStatus.ISSUING ||
        !invoice._id
      ) {
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
    setSelectedReceiptConfigValue(
      invoiceHelper.getFixedReceiptConfigOptionValue()
    )

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
      setPageLoading(true)
      setDeleteDialogOpen(false)

      const res = await APIDeleteSaleTransaction(id)

      if (res?.status === 200 || res?.status === 201 || res?.status === 204) {
        const detail = invoiceHelper.normalizeSaleTransactionDetail(res)

        replaceInvoiceRows((prev) =>
          prev.map((row) => {
            if (row._id !== id) return row

            return mergeInvoicePaymentState(
              {
                ...row,
                ...(detail || {}),
                invoiceStatus: InvoiceStatus.CANCELLED,
                updatedAt: new Date().toISOString(),
              },
              row
            )
          })
        )

        showSuccessMessage("Hủy hóa đơn thành công!")
        setSelectedInvoiceId(null)
        setMode("list")
        return
      }

      showErrorMessage("Hủy hóa đơn thất bại!")
    } catch (error) {
      console.error("APIDeleteSaleTransaction error:", error)
      showErrorMessage(getErrorAlertMessage(error, "Hủy hóa đơn thất bại!"))
    } finally {
      setPageLoading(false)
      setPendingDeleteId(null)
    }
  }

  const handleEdit = async (row: InvoiceApiRow) => {
    try {
      const detail = await dispatch(
        fetchSaleTransactionByIdThunk(row._id)
      ).unwrap()

      if (!detail?._id) {
        showErrorMessage("Không tìm thấy dữ liệu hóa đơn")
        return
      }

      const nextDetail = hydrateAndUpsertInvoice(detail, null, row)
      const status = invoiceHelper.getInvoiceStatus(nextDetail)

      if (status === InvoiceStatus.CANCELLED) {
        showErrorMessage("Hóa đơn đã hủy, không thể chỉnh sửa.")
        setSelectedInvoiceId(nextDetail._id)
        setMode("detail")
        return
      }

      if (status === InvoiceStatus.ISSUED) {
        showErrorMessage(
          "Hóa đơn đã xuất, vui lòng dùng nút Thu tiền để cập nhật thanh toán."
        )
        setSelectedInvoiceId(nextDetail._id)
        setMode("detail")
        return
      }

      setSelectedInvoiceId(nextDetail._id)
      setMode("edit")
    } catch (error) {
      console.error("APIGetSaleTransactionById edit error:", error)
      showErrorMessage(
        getErrorAlertMessage(error, "Không thể tải dữ liệu hóa đơn")
      )
    }
  }

  const handleView = async (row: InvoiceApiRow) => {
    try {
      const detail = await dispatch(
        fetchSaleTransactionByIdThunk(row._id)
      ).unwrap()

      if (!detail?._id) {
        showErrorMessage("Không tìm thấy chi tiết hóa đơn")
        return
      }

      const nextDetail = hydrateAndUpsertInvoice(detail, null, row)

      setSelectedInvoiceId(nextDetail._id)
      setMode("detail")
    } catch (error) {
      console.error("APIGetSaleTransactionById view error:", error)
      showErrorMessage(
        getErrorAlertMessage(error, "Không thể tải chi tiết hóa đơn")
      )
    }
  }

  const closeCollectPaymentDialog = () => {
    if (collectPaymentSavingRef.current || collectPaymentSaving) return

    setCollectPaymentOpen(false)
    setCollectPaymentTarget(null)
    setCollectPaymentBankId("")
    setCollectPaymentAmount("")
    setCollectPaymentBanks([])
  }

  const handleCollectPaymentAmountChange = (value: string) => {
    const amount = invoiceHelper.parsePaymentAmountInput(value)

    setCollectPaymentAmount(
      amount > 0 ? invoiceHelper.formatPaymentAmountInput(amount) : ""
    )
  }

  const handleOpenCollectPayment = async (row: InvoiceApiRow) => {
    if (!canCollectPayment(row)) {
      showErrorMessage(
        "Chỉ hóa đơn nháp hoặc đã xuất thành công mới được thu tiền."
      )
      return
    }

    const safeRow = mergeInvoicePaymentState(row, row)
    const rowCollectedAmount = getInvoiceDefaultCollectPaymentAmount(safeRow)

    setCollectPaymentTarget(safeRow)
    setCollectPaymentBankId(invoiceHelper.getId(safeRow.bankId))
    setCollectPaymentAmount(
      rowCollectedAmount > 0
        ? invoiceHelper.formatPaymentAmountInput(rowCollectedAmount)
        : ""
    )
    setCollectPaymentBanks([])
    setCollectPaymentOpen(true)

    try {
      setCollectPaymentLoading(true)

      const [bankRes, detailRes] = await Promise.all([
        APIGetBanks(),
        dispatch(fetchSaleTransactionByIdThunk(row._id)).unwrap(),
      ])

      const nextTarget = detailRes?._id
        ? mergeInvoicePaymentState(
            invoiceHelper.hydrateSaleTransactionDetail(
              detailRes,
              null,
              safeRow
            ),
            safeRow
          )
        : safeRow

      if (!canCollectPayment(nextTarget)) {
        setCollectPaymentOpen(false)
        setCollectPaymentTarget(null)
        showErrorMessage(
          "Chỉ hóa đơn nháp hoặc đã xuất thành công mới được thu tiền."
        )
        return
      }

      const nextTargetCollectedAmount =
        getInvoiceDefaultCollectPaymentAmount(nextTarget)
      const nextBanks = invoiceHelper.normalizeBankList(bankRes)
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
      setCollectPaymentBankId(invoiceHelper.getId(nextTarget.bankId))
      setCollectPaymentAmount(
        nextTargetCollectedAmount > 0
          ? invoiceHelper.formatPaymentAmountInput(nextTargetCollectedAmount)
          : ""
      )
    } catch (error) {
      console.error("OPEN_COLLECT_PAYMENT_ERROR", error)
      showErrorMessage(
        getErrorAlertMessage(error, "Không thể tải dữ liệu thu tiền.")
      )
    } finally {
      setCollectPaymentLoading(false)
    }
  }
  const handleConfirmCollectPayment = async () => {
    if (collectPaymentSavingRef.current) return

    const target = collectPaymentTarget

    if (!target?._id) {
      showErrorMessage("Không tìm thấy hóa đơn cần thu tiền.")
      return
    }

    if (!canCollectPayment(target)) {
      showErrorMessage(
        "Chỉ hóa đơn nháp hoặc đã xuất thành công mới được thu tiền."
      )
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
    const paidAmount =
      invoiceHelper.parsePaymentAmountInput(collectPaymentAmount)

    if (paidAmount <= 0) {
      showErrorMessage("Vui lòng nhập tổng tiền thu hợp lệ.")
      return
    }

    const totalAmount = toSafeNumber(target.inv_TotalAmount)

    if (totalAmount <= 0) {
      showErrorMessage("Tổng tiền hóa đơn không hợp lệ.")
      return
    }

    if (paidAmount > totalAmount) {
      showErrorMessage("Số tiền thu không được lớn hơn tổng tiền hóa đơn.")
      return
    }

    try {
      collectPaymentSavingRef.current = true
      setCollectPaymentSaving(true)

      const detail = await dispatch(
        updateSaleTransactionBankThunk({
          id: target._id,
          bankId: selectedBank._id,
          amountCollected: paidAmount,
        })
      ).unwrap()

      if (!detail?._id) {
        throw new Error("Thu tiền thất bại.")
      }

      const detailAmountCollected =
        hasOwnField(detail, "amountCollected") &&
        isFilledValue(detail.amountCollected)
          ? toSafeNumber(detail.amountCollected)
          : 0
      const nextAmountCollected =
        detailAmountCollected > 0 ? detailAmountCollected : paidAmount

      const nextDetail = mergeInvoicePaymentState(
        {
          ...target,
          ...detail,

          bankId: selectedBank,
          inv_buyerBankName: selectedBank.inv_buyerBankName,

          inv_TotalAmount: totalAmount,
          amountCollected: nextAmountCollected,
          paidAmount: nextAmountCollected,
          isPaid: totalAmount > 0 && nextAmountCollected >= totalAmount,
          paymentStatus: getPaymentStatus(totalAmount, nextAmountCollected),

          paidDate,
          paymentDate: paidDate,

          invoiceStatus:
            detail.invoiceStatus ||
            target.invoiceStatus ||
            InvoiceStatus.ISSUED,
          updatedAt: new Date().toISOString(),
        },
        target
      )

      replaceInvoiceRows((prev) =>
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

      showSuccessMessage("Thu tiền thành công!")
    } catch (error) {
      console.error("CONFIRM_COLLECT_PAYMENT_ERROR", error)
      showErrorMessage(getErrorAlertMessage(error, "Thu tiền thất bại."))
    } finally {
      collectPaymentSavingRef.current = false
      setCollectPaymentSaving(false)
    }
  }

  const handleSavedInvoice = async (payload: InvoiceFormPayload) => {
    const editingInvoice = mode === "edit" ? selectedInvoice : null

    try {
      if (editingInvoice?._id && payload.bankOnlyEdit) {
        if (
          invoiceHelper.getInvoiceStatus(editingInvoice) !==
          InvoiceStatus.ISSUED
        ) {
          throw new Error(
            "Chỉ hóa đơn đã xuất thành công mới được sửa ngân hàng."
          )
        }

        const bankId = invoiceHelper.getId(payload.bankId)

        if (!bankId) {
          throw new Error("Vui lòng chọn ngân hàng cần cập nhật.")
        }

        const currentAmountCollected = getInvoiceAmountCollected(editingInvoice)
        const editingTotalAmount = toSafeNumber(editingInvoice.inv_TotalAmount)

        const detail = await dispatch(
          updateSaleTransactionBankThunk({
            id: editingInvoice._id,
            bankId,
            amountCollected: currentAmountCollected,
          })
        ).unwrap()

        if (detail?._id) {
          const detailAmountCollected =
            hasOwnField(detail, "amountCollected") &&
            isFilledValue(detail.amountCollected)
              ? toSafeNumber(detail.amountCollected)
              : 0
          const nextAmountCollected =
            detailAmountCollected > 0
              ? detailAmountCollected
              : currentAmountCollected

          const nextDetail = mergeInvoicePaymentState(
            {
              ...editingInvoice,
              ...detail,
              bankId: payload.bankId || detail.bankId || editingInvoice.bankId,
              inv_buyerBankName: payload.inv_buyerBankName || "",
              amountCollected: nextAmountCollected,
              paidAmount: nextAmountCollected,
              isPaid:
                editingTotalAmount > 0 &&
                nextAmountCollected >= editingTotalAmount,
              paymentStatus: getPaymentStatus(
                editingTotalAmount,
                nextAmountCollected
              ),
              invoiceStatus: InvoiceStatus.ISSUED,
              updatedAt: new Date().toISOString(),
            },
            editingInvoice
          )

          replaceInvoiceRows((prev) =>
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
        invoiceHelper.getInvoiceStatus(editingInvoice) === InvoiceStatus.ISSUED

      const body = buildCreateInvoiceApiBody(payload, {
        includePayment: allowPaymentUpdate,
        includeId: Boolean(editingInvoice?._id),
        itemMode: editingInvoice?._id ? "update" : "create",
      })

      const detail = editingInvoice?._id
        ? await dispatch(
            updateSaleTransactionThunk({
              id: editingInvoice._id,
              payload: body,
            })
          ).unwrap()
        : await dispatch(createSaleTransactionThunk(body)).unwrap()

      if (detail?._id) {
        persistDepartmentOverride(
          detail._id,
          payload.__clientSnapshot?.department
        )

        const nextDetail = mergeInvoicePaymentState(
          {
            ...invoiceHelper.hydrateSaleTransactionDetail(
              detail,
              payload,
              editingInvoice
            ),
            invoiceStatus:
              detail.invoiceStatus ||
              (editingInvoice
                ? invoiceHelper.getInvoiceStatus(editingInvoice)
                : InvoiceStatus.DRAFT),
          },
          editingInvoice
        )

        upsertInvoiceRow(nextDetail)

        setSelectedInvoiceId(nextDetail._id)
        setMode("detail")

        return
      }

      throw new Error(
        editingInvoice ? "Cập nhật hóa đơn thất bại!" : "Thêm hóa đơn thất bại!"
      )
    } catch (error) {
      console.error("SALE_TRANSACTION_SAVE_ERROR", {
        mode: editingInvoice?._id ? "update" : "create",
        saleTransactionId: editingInvoice?._id || null,
        payload,
        error,
      })

      throw error
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
    if (exportingInvoiceRef.current || exportingInvoiceId) return

    if (!row?._id) {
      showErrorMessage("Không tìm thấy ID giao dịch bán hàng để xuất hóa đơn.")
      return
    }

    const currentStatus = invoiceHelper.getInvoiceStatus(row)
    if (!invoiceHelper.canStartInvoiceExport(currentStatus)) {
      showErrorMessage(
        "Chỉ hóa đơn nháp hoặc xuất thất bại mới được xuất hóa đơn."
      )
      return
    }

    const matchedReceiptConfig =
      receiptConfigs.find((config) =>
        invoiceHelper.isInvoiceMatchedReceiptConfig(row, config)
      ) ||
      activeReceiptConfig ||
      listReceiptConfig ||
      invoiceHelper.getFixedReceiptInvoiceConfig()

    const invoiceSeries = String(
      matchedReceiptConfig?.inv_invoiceSeries || row.inv_invoiceSeries || ""
    ).trim()

    const taxCode = String(
      matchedReceiptConfig?.tax_code ||
        invoiceHelper.getInvoiceSellerTaxCode(row) ||
        ""
    ).trim()

    const invoiceIssuedDate =
      invoiceHelper.normalizeDateInput(row.inv_invoiceIssuedDate) ||
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
      exportingInvoiceRef.current = true
      setExportingInvoiceId(row._id)

      const response = await APIExportMInvoiceReceiptPost(
        {
          saleTransactionId: row._id,
          inv_invoiceSeries: invoiceSeries,
          inv_invoiceIssuedDate: invoiceIssuedDate,
          editmode: 1,
        },
        taxCode
      )

      const resolution = await resolveInvoiceExportResultWithJobStatus(
        response,
        exportContext,
        APIGetMInvoiceReceiptJobStatus
      )

      handleInvoiceExported(row._id, resolution, {
        openDetail: false,
        fallbackRow: row,
      })

      if (resolution.status === InvoiceStatus.FAILED) {
        showErrorMessage(getInvoiceExportErrorAlertMessage(resolution, row))
        return
      }

      if (resolution.status === InvoiceStatus.ISSUED) {
        showSuccessMessage(getInvoiceExportAlertMessage(resolution))
        return
      }

      showSuccessMessage(getInvoiceExportAlertMessage(resolution))
    } catch (error) {
      console.error("EXPORT_M_INVOICE_FROM_LIST_ERROR", {
        saleTransactionId: row._id,
        invoiceSeries,
        invoiceIssuedDate,
        taxCode,
        error,
      })

      if (isInvoiceAlreadyBeingIssuedError(error)) {
        const resolution = createAlreadyIssuingResolution(error, exportContext)

        handleInvoiceExported(row._id, resolution, {
          openDetail: false,
          fallbackRow: row,
        })

        showSuccessMessage(getInvoiceExportAlertMessage(resolution))
        return
      }

      if (isInvoiceExportRateLimitedError(error)) {
        const resolution = createRateLimitedResolution(error, exportContext)

        handleInvoiceExported(row._id, resolution, {
          openDetail: false,
          fallbackRow: row,
        })

        showErrorMessage(getInvoiceExportErrorAlertMessage(resolution, row))
        return
      }

      const resolution = createInvoiceExportFailureResolution(
        error,
        exportContext,
        error instanceof Error ? error.message : "Xuất hóa đơn thất bại."
      )

      handleInvoiceExported(row._id, resolution, {
        openDetail: false,
        fallbackRow: row,
      })

      showErrorMessage(getInvoiceExportErrorAlertMessage(resolution, row))
    } finally {
      exportingInvoiceRef.current = false
      setExportingInvoiceId(null)
    }
  }

  const handleViewMInvoicePdf = async (row: InvoiceApiRow) => {
    const invInvoiceCreatedId = invoiceHelper.getExportInvoiceId(row)
    const matchedReceiptConfig =
      receiptConfigs.find((config) =>
        invoiceHelper.isInvoiceMatchedReceiptConfig(row, config)
      ) ||
      activeReceiptConfig ||
      invoiceHelper.getFixedReceiptInvoiceConfig()

    const taxCode =
      matchedReceiptConfig?.tax_code ||
      invoiceHelper.getInvoiceSellerTaxCode(row)

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
        taxCode,
        inv_invoiceCreatedId: invInvoiceCreatedId,
      })

      const fileUrl = String(
        res?.fileUrl ||
          res?.data?.fileUrl ||
          res?.content?.fileUrl ||
          res?.filePath ||
          res?.data?.filePath ||
          res?.content?.filePath ||
          ""
      ).trim()

      if (!fileUrl) {
        closePdfViewer()
        showErrorMessage(" không trả về đường dẫn file PDF.")
        return
      }

      const nextPdfUrl = invoiceHelper.buildPdfFileUrl(fileUrl)

      setPdfUrl(nextPdfUrl)
    } catch (error) {
      console.error("APIViewPrintInvoice error:", error)

      closePdfViewer()

      showErrorMessage(
        getErrorAlertMessage(error, "Không thể xem mẫu hóa đơn.")
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

              <div className="flex flex-col gap-2 rounded-lg border border-slate-200 bg-white p-3 text-sm shadow-sm sm:flex-row sm:items-center">
                <span className="inline-flex h-9 items-center rounded-md border border-blue-100 bg-blue-50 px-3 font-bold text-blue-700">
                  {activeReceiptConfig.inv_invoiceSeries} - MST:{" "}
                  {activeReceiptConfig.tax_code}
                </span>
              </div>
            </div>

            <div className="mt-4 flex flex-col gap-4">
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
            </div>
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
            receiptConfigLocked
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
                x
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
