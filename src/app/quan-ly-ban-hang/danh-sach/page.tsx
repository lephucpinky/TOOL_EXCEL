"use client"

import Link from "next/link"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { ReceiptText, Settings2 } from "lucide-react"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"

import InvoiceCreateForm from "@/components/minvoice/InvoiceCreateForm"
import InvoiceDataTable from "@/components/minvoice/InvoiceDataTable"
import InvoiceBulkImport from "@/components/minvoice/InvoiceBulkImport"
import InvoiceToolbar from "@/components/minvoice/InvoiceToolbar"
import InvoiceCollectPaymentDialog from "@/components/minvoice/InvoiceCollectPaymentDialog"
import {
  applyDepartmentOverride,
  buildCopiedInvoiceDraft,
  canCollectPayment,
  canUpdateMInvoiceRow,
  getInvoiceAmountCollected,
  getInvoiceDefaultCollectPaymentAmount,
  getInvoicePaidDateInput,
  getPaymentStatus,
  getTodayDate,
  getUniqueInvoiceRows,
  hasOwnField,
  isFilledValue,
  mergeInvoicePaymentState,
  toSafeNumber,
} from "@/components/minvoice/invoiceListUtils"

import AlertOption from "@/components/alert/AlertOption"
import AlertSuccess from "@/components/alert/AlertSuccess"
import AlertError from "@/components/alert/AlertError"

import { APIGetBanks } from "@/services/bank"
import {
  APICancelSaleTransactionInvoice,
  APIGetSaleTransactions,
} from "@/services/saleTransaction"
import {
  APIExportMInvoiceReceiptPost,
  APIGetMInvoiceReceiptJobStatus,
  APIUpdateMInvoiceReceiptPost,
  APIViewPrintInvoice,
} from "@/services/mInvoiceReceipt"
import { APIGetReceiptInvoices } from "@/services/receiptInvoice"

import * as invoiceHelper from "@/utils/invoice"
import { buildCreateInvoiceApiBody } from "@/utils/invoicePayload"
import { DEFAULT_URL_PAGE, getPositiveInteger } from "@/utils/pagination"
import { useAppDispatch, useAppSelector } from "@/store/hooks"
import {
  createSaleTransactionThunk,
  fetchSaleTransactionByIdThunk,
  saleTransactionActions,
  updateSaleTransactionBankThunk,
  updateSaleTransactionThunk,
} from "@/store/slices/saleTransactionSlice"
import { getErrorMessage } from "@/store/utils/crud"

import { InvoiceApiRow, InvoiceStatus } from "@/types/invoice"
import type { Bank } from "@/types/bank"
import type { ReceiptInvoiceConfig } from "@/types/receiptInvoice"

import PageHeader from "../../../components/header/PageHeader"

type PageMode = "list" | "create" | "detail" | "edit" | "bulk-import"

type InvoiceFormPayload = Partial<InvoiceApiRow> & {
  bankOnlyEdit?: boolean
  bankId?: Bank | string | null
  inv_buyerBankName?: string
}

type InvoiceListActionOptions = {
  silent?: boolean
  bypassBusyGuard?: boolean
}

type InvoiceListActionStatus =
  | InvoiceStatus.ISSUED
  | InvoiceStatus.ISSUING
  | InvoiceStatus.FAILED
  | null

const NO_INVOICE_EXPORT_RESULT_MESSAGE =
  "Xuất hoá đơn không thành công, vui lòng thử lại sau."
const INVOICE_PAGE_SIZE_OPTIONS = [50, 100, 200, 300]
const INVOICE_DEFAULT_LIMIT = 50

export default function InvoiceListPage() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()
  const dispatch = useAppDispatch()
  const {
    items: apiRows,
    loading: listLoading,
    submitLoading,
    deleteLoading,
  } = useAppSelector((state) => state.saleTransactions)

  const [pageLoading, setPageLoading] = useState(false)
  const loading = pageLoading || listLoading || submitLoading || deleteLoading

  const listPage = getPositiveInteger(
    searchParams.get("page"),
    DEFAULT_URL_PAGE
  )
  const listLimit = getPositiveInteger(
    searchParams.get("limit"),
    INVOICE_DEFAULT_LIMIT
  )
  const listSearch = String(searchParams.get("search") ?? "").trim()
  const listAgencyId = String(searchParams.get("agencyId") ?? "").trim()
  const listRequestIdRef = useRef(0)
  const listQueryRef = useRef({
    page: listPage,
    limit: listLimit,
    search: listSearch,
    agencyId: listAgencyId,
  })

  listQueryRef.current = {
    page: listPage,
    limit: listLimit,
    search: listSearch,
    agencyId: listAgencyId,
  }

  const pushListQuery = useCallback(
    (
      patch: Partial<{
        page: number
        limit: number
        search: string
        agencyId: string
      }>
    ) => {
      const current = listQueryRef.current
      const next = {
        page: patch.page ?? current.page,
        limit: patch.limit ?? current.limit,
        search:
          patch.search !== undefined ? patch.search.trim() : current.search,
        agencyId:
          patch.agencyId !== undefined
            ? patch.agencyId.trim()
            : current.agencyId,
      }

      listQueryRef.current = next

      const params = new URLSearchParams()
      params.set("page", String(Math.max(next.page, 1)))
      params.set("limit", String(Math.max(next.limit, 1)))
      if (next.search) params.set("search", next.search)
      if (next.agencyId) params.set("agencyId", next.agencyId)

      const nextQuery = params.toString()
      const currentQuery =
        typeof window !== "undefined"
          ? window.location.search.replace(/^\?/, "")
          : searchParams.toString()

      if (nextQuery === currentQuery) return

      router.push(nextQuery ? `${pathname}?${nextQuery}` : pathname)
    },
    [pathname, router, searchParams]
  )

  const listParams = useMemo(
    () => ({
      page: listPage,
      limit: listLimit,
      ...(listSearch ? { search: listSearch } : {}),
      ...(listAgencyId ? { agencyId: listAgencyId } : {}),
    }),
    [listPage, listLimit, listSearch, listAgencyId]
  )
  const [listPagination, setListPagination] = useState({
    page: DEFAULT_URL_PAGE,
    limit: INVOICE_DEFAULT_LIMIT,
    total: 0,
    totalPages: 1,
  })
  const listTablePagination = useMemo(
    () => ({
      currentPage: listPage,
      pageSize: listLimit,
      totalItems: listPagination.total,
      onPageChange: () => undefined,
      onPageSizeChange: () => undefined,
      pageSizeOptions: INVOICE_PAGE_SIZE_OPTIONS,
      syncUrl: true,
    }),
    [listPage, listLimit, listPagination.total]
  )

  const handleSearchKeywordChange = useCallback(
    (keyword: string) => {
      pushListQuery({
        search: keyword.trim(),
        page: 1,
        limit: listLimit || INVOICE_DEFAULT_LIMIT,
      })
    },
    [listLimit, pushListQuery]
  )

  const handleAgencyFilterChange = useCallback(
    (agencyId: string) => {
      const nextAgencyId = agencyId.trim()
      if (nextAgencyId === listQueryRef.current.agencyId) return

      pushListQuery({
        agencyId: nextAgencyId,
        page: 1,
        limit: listLimit || INVOICE_DEFAULT_LIMIT,
      })
    },
    [listLimit, pushListQuery]
  )

  const handleClearListFilters = useCallback(() => {
    pushListQuery({
      search: "",
      agencyId: "",
      page: 1,
      limit: listLimit || INVOICE_DEFAULT_LIMIT,
    })
  }, [listLimit, pushListQuery])

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

  const [cancelInvoiceDialogOpen, setCancelInvoiceDialogOpen] = useState(false)
  const [pendingCancelInvoiceId, setPendingCancelInvoiceId] = useState<
    string | null
  >(null)
  const [cancellingInvoiceId, setCancellingInvoiceId] = useState<string | null>(
    null
  )

  const [exportingInvoiceId, setExportingInvoiceId] = useState<string | null>(
    null
  )
  const [updatingMInvoiceId, setUpdatingMInvoiceId] = useState<string | null>(
    null
  )
  const [exportDateDialogOpen, setExportDateDialogOpen] = useState(false)
  const [pendingExportInvoice, setPendingExportInvoice] =
    useState<InvoiceApiRow | null>(null)
  const [pendingBulkExportInvoices, setPendingBulkExportInvoices] = useState<
    InvoiceApiRow[]
  >([])
  const [selectedExportInvoiceDate, setSelectedExportInvoiceDate] = useState("")
  const [selectedBulkInvoiceIds, setSelectedBulkInvoiceIds] = useState<
    string[]
  >([])
  const [copyInvoiceDraft, setCopyInvoiceDraft] =
    useState<InvoiceApiRow | null>(null)
  const [bulkInvoiceActionLoading, setBulkInvoiceActionLoading] =
    useState(false)

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
  const [collectPaymentDate, setCollectPaymentDate] = useState(getTodayDate)
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
  const updatingMInvoiceRef = useRef(false)
  const bulkInvoiceActionRef = useRef(false)
  const collectPaymentSavingRef = useRef(false)

  const isInvoiceActionBusy = () => {
    return Boolean(
      exportingInvoiceRef.current ||
        exportingInvoiceId ||
        updatingMInvoiceRef.current ||
        updatingMInvoiceId ||
        bulkInvoiceActionRef.current ||
        bulkInvoiceActionLoading
    )
  }

  const getInvoicePrintContext = (invoice: InvoiceApiRow) => {
    const matchedReceiptConfig =
      receiptConfigs.find((config) =>
        invoiceHelper.isInvoiceMatchedReceiptConfig(invoice, config)
      ) ||
      activeReceiptConfig ||
      invoiceHelper.getFixedReceiptInvoiceConfig()
    const taxCode =
      matchedReceiptConfig?.tax_code ||
      invoiceHelper.getInvoiceSellerTaxCode(invoice)
    const invoiceSeries = String(
      invoice.inv_invoiceSeries || matchedReceiptConfig?.inv_invoiceSeries || ""
    ).trim()
    const invoiceIssuedDate =
      invoiceHelper.normalizeDateInput(invoice.inv_invoiceIssuedDate || "") ||
      exportInvoiceMaxDate

    return {
      invInvoiceCreatedId: invoiceHelper.getExportInvoiceId(invoice),
      taxCode,
      invoiceSeries,
      invoiceIssuedDate,
    }
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

  const replaceInvoiceRows = (
    updater: (rows: InvoiceApiRow[]) => InvoiceApiRow[]
  ) => {
    const nextRows = updater(apiRowsRef.current)
    apiRowsRef.current = nextRows
    dispatch(saleTransactionActions.setSaleTransactions(nextRows))
  }

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

  const selectedBulkInvoices = useMemo(() => {
    const selectedIdSet = new Set(selectedBulkInvoiceIds)

    return listRows.filter((invoice) => selectedIdSet.has(invoice._id))
  }, [listRows, selectedBulkInvoiceIds])
  const selectedBulkExportableInvoices = useMemo(() => {
    return selectedBulkInvoices.filter((invoice) =>
      invoiceHelper.canStartInvoiceExport(
        invoiceHelper.getInvoiceStatus(invoice)
      )
    )
  }, [selectedBulkInvoices])
  const selectedBulkUpdatableInvoices = useMemo(() => {
    return selectedBulkInvoices.filter(canUpdateMInvoiceRow)
  }, [selectedBulkInvoices])

  useEffect(() => {
    apiRowsRef.current = listRows
  }, [listRows])

  useEffect(() => {
    setSelectedBulkInvoiceIds((currentIds) => {
      if (!currentIds.length) return currentIds

      const currentRowIds = new Set(listRows.map((row) => row._id))
      const nextIds = currentIds.filter((id) => currentRowIds.has(id))

      return nextIds.length === currentIds.length ? currentIds : nextIds
    })
  }, [listRows])

  const selectedInvoice = useMemo(() => {
    if (!selectedInvoiceId) return null
    return listRows.find((item) => item._id === selectedInvoiceId) ?? null
  }, [listRows, selectedInvoiceId])

  const exportInvoiceMaxDate = new Date().toISOString().slice(0, 10)
  const exportInvoiceMinDate = useMemo(() => {
    let latestIssuedDate = ""

    listRows.forEach((row) => {
      const isIssued =
        invoiceHelper.getInvoiceStatus(row) === InvoiceStatus.ISSUED

      if (!isIssued) return

      const issuedDate = invoiceHelper.normalizeDateInput(
        row.inv_invoiceIssuedDate || ""
      )

      if (issuedDate && (!latestIssuedDate || issuedDate > latestIssuedDate)) {
        latestIssuedDate = issuedDate
      }
    })

    if (!latestIssuedDate) return ""

    const [year, month, day] = latestIssuedDate.split("-").map(Number)
    const nextDate = new Date(year, month - 1, day + 1)

    const nextDateText = [
      nextDate.getFullYear(),
      String(nextDate.getMonth() + 1).padStart(2, "0"),
      String(nextDate.getDate()).padStart(2, "0"),
    ].join("-")

    return latestIssuedDate === exportInvoiceMaxDate
      ? exportInvoiceMaxDate
      : nextDateText
  }, [listRows, exportInvoiceMaxDate])

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

  const syncInvoiceListAfterExport = async () => {
    const response = await APIGetSaleTransactions(listParams)
    const latestRows = response.data

    if (!latestRows.length) return

    const previousRowMap = new Map(
      apiRowsRef.current.map((item) => [item._id, item])
    )
    const nextRows = latestRows.map((item) => {
      const fallback = previousRowMap.get(item._id)

      return mergeInvoicePaymentState(
        applyDepartmentOverride(item),
        fallback ? applyDepartmentOverride(fallback) : fallback
      )
    })

    apiRowsRef.current = nextRows
    dispatch(saleTransactionActions.setSaleTransactions(nextRows))
  }

  const scheduleInvoiceRefresh = (
    saleTransactionId: string,
    fallback?: InvoiceApiRow | null,
    jobId?: string,
    successMessage = "Đã xuất hóa đơn thành công."
  ) => {
    const scheduledIds = issuingSyncQueueRef.current

    if (scheduledIds.has(saleTransactionId)) return

    scheduledIds.add(saleTransactionId)

    const syncVersion =
      (issuingSyncVersionRef.current.get(saleTransactionId) || 0) + 1
    issuingSyncVersionRef.current.set(saleTransactionId, syncVersion)

    const isCurrentRefresh = () =>
      issuingSyncVersionRef.current.get(saleTransactionId) === syncVersion

    const refreshIntervals = [3000, 5000, 7000, 10000]

    const stopRefresh = () => {
      issuingSyncQueueRef.current.delete(saleTransactionId)
      issuingSyncVersionRef.current.delete(saleTransactionId)
    }

    const finish = (row: InvoiceApiRow, message?: string) => {
      if (!isCurrentRefresh()) return

      stopRefresh()

      const status = invoiceHelper.getInvoiceStatus(row)

      if (status === InvoiceStatus.ISSUED) {
        showSuccessMessage(successMessage)
        void syncInvoiceListAfterExport().catch((error) => {
          console.error("FETCH_LIST_AFTER_EXPORT_SUCCESS_ERROR", {
            saleTransactionId,
            error,
          })
        })
      } else if (status === InvoiceStatus.FAILED) {
        showErrorMessage(message || "Xuất hóa đơn thất bại.")
      }
    }

    const runRefresh = (index: number) => {
      const refreshInterval =
        refreshIntervals[Math.min(index, refreshIntervals.length - 1)]

      const timeoutId = setTimeout(() => {
        issuingSyncTimeoutRef.current.delete(saleTransactionId)

        if (!isCurrentRefresh()) return

        const refreshPromise = jobId
          ? APIGetMInvoiceReceiptJobStatus(jobId).then((jobStatus) => {
              if (!isCurrentRefresh()) return

              const jobInvoiceStatus = jobStatus.isSuccess
                ? InvoiceStatus.ISSUED
                : jobStatus.isFailed
                  ? InvoiceStatus.FAILED
                  : jobStatus.isProcessing
                    ? InvoiceStatus.ISSUING
                    : invoiceHelper.normalizeInvoiceStatusValue(
                        jobStatus.invoiceStatus || jobStatus.jobState
                      )

              if (
                jobInvoiceStatus !== InvoiceStatus.ISSUED &&
                jobInvoiceStatus !== InvoiceStatus.FAILED
              ) {
                runRefresh(index + 1)
                return
              }

              const currentRow =
                apiRowsRef.current.find(
                  (item) => item._id === saleTransactionId
                ) ||
                fallback ||
                null
              const jobErrorMessage = String(
                jobStatus.invoiceErrorMessage ||
                  jobStatus.rawFailedReason ||
                  jobStatus.failedReason ||
                  ""
              ).trim()
              const terminalRow = mergeInvoicePaymentState(
                applyDepartmentOverride({
                  ...(currentRow || ({} as InvoiceApiRow)),
                  _id: saleTransactionId,
                  jobId: jobStatus.jobId || jobId,
                  invoiceStatus: jobInvoiceStatus,
                  inv_invoiceCreatedId:
                    jobStatus.inv_invoiceCreatedId ||
                    currentRow?.inv_invoiceCreatedId,
                  inv_invoiceSeries:
                    jobStatus.inv_invoiceSeries ||
                    currentRow?.inv_invoiceSeries,
                  inv_invoiceIssuedDate:
                    jobStatus.inv_invoiceIssuedDate ||
                    currentRow?.inv_invoiceIssuedDate,
                  orderNumber: jobStatus.orderNumber || currentRow?.orderNumber,
                  invoiceNumber:
                    jobStatus.invoiceNumber || currentRow?.invoiceNumber,
                  invoiceErrorCode:
                    jobInvoiceStatus === InvoiceStatus.FAILED
                      ? jobStatus.invoiceErrorCode ||
                        currentRow?.invoiceErrorCode
                      : undefined,
                  invoiceErrorMessage:
                    jobInvoiceStatus === InvoiceStatus.FAILED
                      ? jobErrorMessage || NO_INVOICE_EXPORT_RESULT_MESSAGE
                      : undefined,
                  rawFailedReason:
                    jobInvoiceStatus === InvoiceStatus.FAILED
                      ? jobErrorMessage || NO_INVOICE_EXPORT_RESULT_MESSAGE
                      : undefined,
                  isActive: true,
                  updatedAt: new Date().toISOString(),
                }),
                currentRow ? applyDepartmentOverride(currentRow) : currentRow
              )

              upsertInvoiceRow(terminalRow)
              finish(
                terminalRow,
                jobInvoiceStatus === InvoiceStatus.FAILED
                  ? jobErrorMessage
                  : undefined
              )
            })
          : fetchSaleTransactionDetail(saleTransactionId, fallback).then(
              (detailResult) => {
                if (!isCurrentRefresh()) return

                const detail = detailResult.detail

                if (!detail) {
                  runRefresh(index + 1)
                  return
                }

                const status = invoiceHelper.getInvoiceStatus(detail)

                if (status !== InvoiceStatus.ISSUING) {
                  finish(detail)
                  return
                }

                runRefresh(index + 1)
              }
            )

        void refreshPromise.catch(() => {
          if (!isCurrentRefresh()) return
          runRefresh(index + 1)
        })
      }, refreshInterval)

      issuingSyncTimeoutRef.current.set(saleTransactionId, timeoutId)
    }

    runRefresh(0)
  }
  const handleGetSaleTransactions = async () => {
    const requestId = ++listRequestIdRef.current

    try {
      setPageLoading(true)
      replaceInvoiceRows(() => [])
      setListPagination((current) => ({
        ...current,
        page: listParams.page,
        limit: listParams.limit,
        total: 0,
        totalPages: 1,
      }))

      const previousRows = apiRowsRef.current
      const previousRowMap = new Map(
        previousRows.map((item) => [item._id, item])
      )

      const response = await APIGetSaleTransactions(listParams)
      if (requestId !== listRequestIdRef.current) return

      const nextRows = response.data.map((row) => {
        const fallback = previousRowMap.get(row._id)

        return mergeInvoicePaymentState(
          applyDepartmentOverride(row),
          fallback ? applyDepartmentOverride(fallback) : fallback
        )
      })

      apiRowsRef.current = nextRows
      dispatch(saleTransactionActions.setSaleTransactions(nextRows))

      const total = Math.max(Number(response.total ?? nextRows.length), 0)
      const limit = Math.max(Number(response.limit ?? listParams.limit), 1)
      const totalPages = Math.max(
        Number(response.totalPages ?? Math.max(Math.ceil(total / limit), 1)),
        1
      )

      setListPagination({
        page: Math.max(Number(response.page ?? listParams.page), 1),
        limit,
        total,
        totalPages,
      })
    } catch (error) {
      if (requestId !== listRequestIdRef.current) return

      console.error("APIGetSaleTransactions error:", error)
      replaceInvoiceRows(() => [])
      setListPagination((current) => ({
        ...current,
        page: listParams.page,
        limit: listParams.limit,
        total: 0,
        totalPages: 1,
      }))
      showErrorMessage(
        getErrorMessage(error, "Không thể tải danh sách hóa đơn")
      )
    } finally {
      if (requestId === listRequestIdRef.current) {
        setPageLoading(false)
      }
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
      showErrorMessage(getErrorMessage(error, "Không thể tải cấu hình hóa đơn"))
    }
  }

  useEffect(() => {
    setPageLoading(true)
    void handleGetSaleTransactions()
  }, [listPage, listLimit, listSearch, listAgencyId])

  useEffect(() => {
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

    setSelectedReceiptConfigValue((prev: any) => {
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

    setSelectedReceiptConfigValue((prev: any) =>
      prev === nextValue ? prev : nextValue
    )
  }, [selectedInvoice, receiptConfigs])

  useEffect(() => {
    listRows.forEach((invoice) => {
      if (
        invoiceHelper.getInvoiceStatus(invoice) !== InvoiceStatus.ISSUING ||
        !invoice._id
      ) {
        if (invoice._id) {
          cancelInvoiceRefresh(invoice._id)
        }
        return
      }

      scheduleInvoiceRefresh(
        invoice._id,
        invoice,
        undefined,
        invoice.inv_invoiceCreatedId
          ? "Đã cập nhật hóa đơn thành công."
          : "Đã xuất hóa đơn thành công."
      )
    })
  }, [listRows])

  const handleReload = async () => {
    setSelectedInvoiceId(null)
    setSelectedBulkInvoiceIds([])
    setCopyInvoiceDraft(null)
    setMode("list")
    await Promise.all([handleGetSaleTransactions(), handleGetReceiptConfigs()])
  }

  const handleAdd = () => {
    setSelectedReceiptConfigValue(
      invoiceHelper.getFixedReceiptConfigOptionValue()
    )

    setSelectedInvoiceId(null)
    setSelectedBulkInvoiceIds([])
    setCopyInvoiceDraft(null)
    setMode("create")
  }

  const handleOpenBulkImport = () => {
    setSelectedInvoiceId(null)
    setSelectedBulkInvoiceIds([])
    setCopyInvoiceDraft(null)
    setMode("bulk-import")
  }

  const handleCancelInvoice = (invoice: InvoiceApiRow) => {
    if (!invoice?._id) {
      showErrorMessage("Không tìm thấy phiếu cần huỷ.")
      return
    }

    if (invoiceHelper.getInvoiceStatus(invoice) !== InvoiceStatus.DRAFT) {
      showErrorMessage(
        "Chỉ phiếu đã tạo nhưng chưa xuất hoá đơn mới được phép huỷ."
      )
      return
    }

    setPendingCancelInvoiceId(invoice._id)
    setCancelInvoiceDialogOpen(true)
  }

  const handleConfirmCancelInvoice = async () => {
    const id = pendingCancelInvoiceId

    if (!id) {
      showErrorMessage("Không tìm thấy phiếu cần huỷ.")
      setCancelInvoiceDialogOpen(false)
      return
    }

    const currentInvoice = apiRowsRef.current.find((row) => row._id === id)

    if (
      !currentInvoice ||
      invoiceHelper.getInvoiceStatus(currentInvoice) !== InvoiceStatus.DRAFT
    ) {
      showErrorMessage(
        "Chỉ phiếu đã tạo nhưng chưa xuất hoá đơn mới được phép huỷ."
      )
      setCancelInvoiceDialogOpen(false)
      setPendingCancelInvoiceId(null)
      return
    }

    try {
      setCancellingInvoiceId(id)
      setCancelInvoiceDialogOpen(false)

      const res = await APICancelSaleTransactionInvoice(id)

      if (res?.status === 200 || res?.status === 201 || res?.status === 204) {
        const cancelledInvoice = mergeInvoicePaymentState(
          applyDepartmentOverride({
            ...currentInvoice,
            ...(res.data || {}),
            _id: id,
            invoiceStatus: InvoiceStatus.CANCELLED,
            invoiceStatusVi: "Đã huỷ",
            updatedAt: new Date().toISOString(),
          }),
          currentInvoice
        )

        upsertInvoiceRow(cancelledInvoice)
        cancelInvoiceRefresh(id)
        showSuccessMessage("Huỷ phiếu thành công!")
        return
      }

      showErrorMessage("Huỷ phiếu thất bại!")
    } catch (error) {
      console.error("APICancelSaleTransactionInvoice error:", error)
      const errorMessage = getErrorMessage(error, "Huỷ phiếu thất bại!")
      const isDraftOnlyError = errorMessage
        .toLowerCase()
        .includes(
          "only draft invoices that have not been issued can be canceled"
        )

      showErrorMessage(
        isDraftOnlyError
          ? "Chỉ phiếu đã tạo nhưng chưa xuất hoá đơn mới được phép huỷ."
          : errorMessage
      )
    } finally {
      setCancellingInvoiceId(null)
      setPendingCancelInvoiceId(null)
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

      if (status === InvoiceStatus.ISSUING) {
        showErrorMessage("Hóa đơn đang xuất, vui lòng chờ hệ thống xử lý xong.")
        setSelectedInvoiceId(nextDetail._id)
        setMode("detail")
        return
      }

      setSelectedInvoiceId(nextDetail._id)
      setCopyInvoiceDraft(null)
      setMode("edit")
    } catch (error) {
      console.error("APIGetSaleTransactionById edit error:", error)
      showErrorMessage(getErrorMessage(error, "Không thể tải dữ liệu hóa đơn"))
    }
  }

  const handleCopyInvoice = async (row: InvoiceApiRow) => {
    if (!row?._id) {
      showErrorMessage("Không tìm thấy hóa đơn cần sao chép.")
      return
    }

    try {
      const detail = await dispatch(
        fetchSaleTransactionByIdThunk(row._id)
      ).unwrap()

      if (!detail?._id) {
        showErrorMessage("Không tìm thấy dữ liệu hóa đơn cần sao chép.")
        return
      }

      const source = applyDepartmentOverride(
        invoiceHelper.hydrateSaleTransactionDetail(detail, null, row)
      )
      const draft = buildCopiedInvoiceDraft(source)
      const matchedReceiptConfigIndex = receiptConfigs.findIndex((config) =>
        invoiceHelper.isInvoiceMatchedReceiptConfig(source, config)
      )

      setSelectedReceiptConfigValue(
        matchedReceiptConfigIndex >= 0
          ? invoiceHelper.getReceiptConfigOptionValue(
              receiptConfigs[matchedReceiptConfigIndex],
              matchedReceiptConfigIndex
            )
          : invoiceHelper.getFixedReceiptConfigOptionValue()
      )
      setSelectedInvoiceId(null)
      setSelectedBulkInvoiceIds([])
      setCopyInvoiceDraft(draft)
      setMode("create")
    } catch (error) {
      console.error("APIGetSaleTransactionById copy error:", error)
      showErrorMessage(getErrorMessage(error, "Không thể sao chép hóa đơn."))
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
      setCopyInvoiceDraft(null)
      setMode("detail")
    } catch (error) {
      console.error("APIGetSaleTransactionById view error:", error)
      showErrorMessage(getErrorMessage(error, "Không thể tải chi tiết hóa đơn"))
    }
  }

  const closeCollectPaymentDialog = () => {
    if (collectPaymentSavingRef.current || collectPaymentSaving) return

    setCollectPaymentOpen(false)
    setCollectPaymentTarget(null)
    setCollectPaymentBankId("")
    setCollectPaymentAmount("")
    setCollectPaymentDate(getTodayDate())
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
    setCollectPaymentDate(getInvoicePaidDateInput(safeRow))
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
      setCollectPaymentDate(getInvoicePaidDateInput(nextTarget))
      setCollectPaymentAmount(
        nextTargetCollectedAmount > 0
          ? invoiceHelper.formatPaymentAmountInput(nextTargetCollectedAmount)
          : ""
      )
    } catch (error) {
      console.error("OPEN_COLLECT_PAYMENT_ERROR", error)
      showErrorMessage(
        getErrorMessage(error, "Không thể tải dữ liệu thu tiền.")
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

    const paidDate = collectPaymentDate || getTodayDate()
    const paidAmount =
      invoiceHelper.parsePaymentAmountInput(collectPaymentAmount)

    if (!paidDate) {
      showErrorMessage("Vui lòng chọn ngày thu tiền.")
      return
    }

    if (paidAmount <= 0) {
      showErrorMessage("Vui lòng nhập tổng tiền thu hợp lệ.")
      return
    }

    const totalAmount = toSafeNumber(target.inv_TotalAmount)

    if (totalAmount <= 0) {
      showErrorMessage("Tổng tiền hóa đơn không hợp lệ.")
      return
    }

    try {
      collectPaymentSavingRef.current = true
      setCollectPaymentSaving(true)

      let paymentBaseDetail = target

      if (
        !Array.isArray(paymentBaseDetail.items) ||
        !paymentBaseDetail.items.length
      ) {
        const loadedDetail = await dispatch(
          fetchSaleTransactionByIdThunk(target._id)
        ).unwrap()

        if (loadedDetail?._id) {
          paymentBaseDetail = hydrateAndUpsertInvoice(
            loadedDetail,
            null,
            target
          )
        }
      }

      const paymentItems = (
        Array.isArray(paymentBaseDetail.items) ? paymentBaseDetail.items : []
      ).flatMap((item) => {
        const productId =
          invoiceHelper.getId(item.productId) ||
          invoiceHelper.getId(item.product)

        if (!productId) return []

        return [
          {
            productId,
            quantity: toSafeNumber(item.quantity ?? item.inv_quantity ?? 1),
            price: toSafeNumber(item.price ?? item.unitPrice),
            revenue: toSafeNumber(item.revenue),
            capitalPrice: toSafeNumber(item.capitalPrice),
            totalSalary: toSafeNumber(item.totalSalary),
            accountingAccountCode: Number(item.accountingAccountCode || 0),
          },
        ]
      })

      if (!paymentItems.length) {
        throw new Error(
          "Hóa đơn chưa có dòng hàng hợp lệ để cập nhật ngày thu tiền."
        )
      }

      const bankDetail = await dispatch(
        updateSaleTransactionBankThunk({
          id: target._id,
          bankId: selectedBank._id,
          amountCollected: paidAmount,
        })
      ).unwrap()

      const paidDateDetail = await dispatch(
        updateSaleTransactionThunk({
          id: target._id,
          payload: {
            amountCollected: paidAmount,
            paidDate,
            items: paymentItems,
          },
        })
      ).unwrap()

      const detail = paidDateDetail?._id ? paidDateDetail : bankDetail

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
            invoiceHelper.getInvoiceStatus(target),
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
      setCollectPaymentDate(getTodayDate())
      setCollectPaymentBanks([])

      showSuccessMessage("Thu tiền thành công!")
    } catch (error) {
      console.error("CONFIRM_COLLECT_PAYMENT_ERROR", error)
      showErrorMessage(getErrorMessage(error, "Thu tiền thất bại."))
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
              invoiceStatus:
                detail.invoiceStatus || editingInvoice.invoiceStatus,
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
          setCopyInvoiceDraft(null)
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
        const refreshedDetail = editingInvoice?._id
          ? detail
          : (await dispatch(
              fetchSaleTransactionByIdThunk(detail._id)
            ).unwrap()) || detail

        const nextDetail = mergeInvoicePaymentState(
          {
            ...invoiceHelper.hydrateSaleTransactionDetail(
              refreshedDetail,
              payload,
              editingInvoice
            ),
            invoiceStatus:
              refreshedDetail.invoiceStatus ||
              (editingInvoice
                ? invoiceHelper.getInvoiceStatus(editingInvoice)
                : InvoiceStatus.DRAFT),
            updatedAt: new Date().toISOString(),
          },
          editingInvoice
        )

        upsertInvoiceRow(nextDetail)

        setSelectedInvoiceId(nextDetail._id)
        setCopyInvoiceDraft(null)
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

  const handleInvoiceExported = async (
    saleTransactionId: string,
    response: any,
    fallbackRow?: InvoiceApiRow | null,
    options?: { openDetail?: boolean; successMessage?: string }
  ) => {
    const previousRow =
      fallbackRow ||
      apiRowsRef.current.find((item) => item._id === saleTransactionId) ||
      null
    const content = response?.content
    const jobId = String(response?.jobId || content?.jobId || "").trim()
    const message = String(response?.message || content?.message || "").trim()
    const code = Number(response?.code ?? response?.statusCode ?? NaN)
    const info = String(response?.info || content?.info || "")
      .trim()
      .toUpperCase()
    const responseStatus = invoiceHelper.normalizeInvoiceStatusValue(
      response?.invoiceStatus || content?.invoiceStatus
    )
    const failed =
      responseStatus === InvoiceStatus.FAILED ||
      info === "FAIL" ||
      info === "FAILED" ||
      (Number.isFinite(code) && code >= 400)

    if (failed) {
      const failedRow = mergeInvoicePaymentState(
        applyDepartmentOverride({
          ...(previousRow || ({} as InvoiceApiRow)),
          _id: saleTransactionId,
          invoiceStatus: InvoiceStatus.FAILED,
          invoiceErrorMessage: message || NO_INVOICE_EXPORT_RESULT_MESSAGE,
          rawFailedReason: message || NO_INVOICE_EXPORT_RESULT_MESSAGE,
          isActive: true,
          updatedAt: new Date().toISOString(),
        }),
        previousRow ? applyDepartmentOverride(previousRow) : previousRow
      )

      upsertInvoiceRow(failedRow)
      cancelInvoiceRefresh(saleTransactionId)

      return {
        source: response,
        row: failedRow,
        status: InvoiceStatus.FAILED,
      }
    }

    if (
      responseStatus === InvoiceStatus.ISSUED ||
      responseStatus === InvoiceStatus.CANCELLED
    ) {
      const responseRow = content?._id ? (content as InvoiceApiRow) : null
      const terminalRow = mergeInvoicePaymentState(
        applyDepartmentOverride({
          ...(previousRow || ({} as InvoiceApiRow)),
          ...(responseRow || {}),
          _id: saleTransactionId,
          invoiceStatus: responseStatus,
          isActive: true,
          updatedAt: new Date().toISOString(),
        }),
        previousRow ? applyDepartmentOverride(previousRow) : previousRow
      )

      upsertInvoiceRow(terminalRow)
      cancelInvoiceRefresh(saleTransactionId)

      if (options?.openDetail !== false) {
        setSelectedInvoiceId(saleTransactionId)
        setMode("detail")
      }

      return {
        source: responseRow || response,
        row: terminalRow,
        status: responseStatus,
      }
    }

    if (jobId || responseStatus === InvoiceStatus.ISSUING) {
      const issuingRow = mergeInvoicePaymentState(
        applyDepartmentOverride({
          ...(previousRow || ({} as InvoiceApiRow)),
          _id: saleTransactionId,
          jobId: jobId || previousRow?.jobId || null,
          invoiceStatus: InvoiceStatus.ISSUING,
          isActive: true,
          updatedAt: new Date().toISOString(),
        }),
        previousRow ? applyDepartmentOverride(previousRow) : previousRow
      )

      upsertInvoiceRow(issuingRow)
      scheduleInvoiceRefresh(
        saleTransactionId,
        issuingRow,
        jobId || undefined,
        options?.successMessage
      )

      if (options?.openDetail !== false) {
        setSelectedInvoiceId(saleTransactionId)
        setMode("detail")
      }

      return {
        source: response,
        row: issuingRow,
        status: InvoiceStatus.ISSUING,
      }
    }

    try {
      const result = await fetchSaleTransactionDetail(
        saleTransactionId,
        previousRow
      )

      if (result.detail) {
        const status = invoiceHelper.getInvoiceStatus(result.detail)

        if (status === InvoiceStatus.ISSUING) {
          scheduleInvoiceRefresh(
            saleTransactionId,
            result.detail,
            jobId,
            options?.successMessage
          )

          if (options?.openDetail !== false) {
            setSelectedInvoiceId(saleTransactionId)
            setMode("detail")
          }

          return {
            source: result.detail,
            row: result.detail,
            status,
          }
        } else if (
          status === InvoiceStatus.ISSUED ||
          status === InvoiceStatus.FAILED ||
          status === InvoiceStatus.CANCELLED
        ) {
          cancelInvoiceRefresh(saleTransactionId)

          if (options?.openDetail !== false) {
            setSelectedInvoiceId(saleTransactionId)
            setMode("detail")
          }

          return {
            source: result.detail,
            row: result.detail,
            status,
          }
        }
      }
    } catch (error) {
      console.error("FETCH_TRANSACTION_AFTER_EXPORT_ERROR", {
        saleTransactionId,
        error,
      })
    }

    const failedRow = mergeInvoicePaymentState(
      applyDepartmentOverride({
        ...(previousRow || ({} as InvoiceApiRow)),
        _id: saleTransactionId,
        invoiceStatus: InvoiceStatus.FAILED,
        invoiceErrorMessage: message || NO_INVOICE_EXPORT_RESULT_MESSAGE,
        rawFailedReason: message || NO_INVOICE_EXPORT_RESULT_MESSAGE,
        isActive: true,
        updatedAt: new Date().toISOString(),
      }),
      previousRow ? applyDepartmentOverride(previousRow) : previousRow
    )

    upsertInvoiceRow(failedRow)
    cancelInvoiceRefresh(saleTransactionId)

    return {
      source: response,
      row: failedRow,
      status: InvoiceStatus.FAILED,
    }
  }

  const handleExportInvoiceFromList = (row: InvoiceApiRow) => {
    if (isInvoiceActionBusy()) return

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

    if (exportInvoiceMinDate && exportInvoiceMinDate > exportInvoiceMaxDate) {
      showErrorMessage("Không có ngày xuất hóa đơn hợp lệ.")
      return
    }

    setPendingExportInvoice(row)
    setPendingBulkExportInvoices([])
    setSelectedExportInvoiceDate(exportInvoiceMaxDate)
    setExportDateDialogOpen(true)
  }

  const handleBulkExportInvoiceFromList = (rows: InvoiceApiRow[]) => {
    if (isInvoiceActionBusy()) return

    const exportRows = getUniqueInvoiceRows(rows).filter((row) => {
      return invoiceHelper.canStartInvoiceExport(
        invoiceHelper.getInvoiceStatus(row)
      )
    })

    if (!exportRows.length) {
      showErrorMessage(
        "Vui lòng chọn hóa đơn nháp hoặc xuất thất bại để xuất hóa đơn hàng loạt."
      )
      return
    }

    if (exportInvoiceMinDate && exportInvoiceMinDate > exportInvoiceMaxDate) {
      showErrorMessage("Không có ngày xuất hóa đơn hợp lệ.")
      return
    }

    setPendingExportInvoice(null)
    setPendingBulkExportInvoices(exportRows)
    setSelectedExportInvoiceDate(exportInvoiceMaxDate)
    setExportDateDialogOpen(true)
  }

  const handleConfirmExportInvoiceFromList = async () => {
    const exportRows = pendingBulkExportInvoices.length
      ? pendingBulkExportInvoices
      : pendingExportInvoice
        ? [pendingExportInvoice]
        : []

    if (!exportRows.length) {
      showErrorMessage("Không tìm thấy hóa đơn cần xuất.")
      return
    }

    if (!selectedExportInvoiceDate) {
      showErrorMessage("Vui lòng chọn ngày xuất hóa đơn.")
      return
    }

    if (
      exportInvoiceMinDate &&
      selectedExportInvoiceDate < exportInvoiceMinDate
    ) {
      showErrorMessage("Ngày xuất hóa đơn nhỏ hơn ngày hợp lệ.")
      return
    }

    if (selectedExportInvoiceDate > exportInvoiceMaxDate) {
      showErrorMessage("Ngày xuất hóa đơn không được lớn hơn hôm nay.")
      return
    }

    setExportDateDialogOpen(false)

    if (exportRows.length > 1) {
      await submitBulkExportInvoicesFromList(
        exportRows,
        selectedExportInvoiceDate
      )
      return
    }

    await submitExportInvoiceFromList(exportRows[0], selectedExportInvoiceDate)
  }

  const submitExportInvoiceFromList = async (
    row: InvoiceApiRow,
    exportInvoiceIssuedDate: string,
    options: InvoiceListActionOptions = {}
  ): Promise<InvoiceListActionStatus> => {
    const silent = Boolean(options.silent)
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

    if (!invoiceSeries) {
      setPendingExportInvoice(null)
      if (!silent) {
        showErrorMessage("Chưa có ký hiệu hóa đơn từ cấu hình.")
      }
      return InvoiceStatus.FAILED
    }

    if (!taxCode) {
      setPendingExportInvoice(null)
      if (!silent) {
        showErrorMessage("Chưa có mã số thuế từ cấu hình hóa đơn.")
      }
      return InvoiceStatus.FAILED
    }

    const fallbackRow: InvoiceApiRow = {
      ...row,
      inv_invoiceSeries: invoiceSeries,
      inv_invoiceIssuedDate: exportInvoiceIssuedDate,
      invoiceStatus: InvoiceStatus.ISSUING,
    }

    try {
      exportingInvoiceRef.current = true
      setExportingInvoiceId(row._id)

      const response = await APIExportMInvoiceReceiptPost(
        {
          saleTransactionId: row._id,
          inv_invoiceSeries: invoiceSeries,
          inv_invoiceIssuedDate: exportInvoiceIssuedDate,
          editmode: 1,
        },
        taxCode
      )

      const exportResult = await handleInvoiceExported(
        row._id,
        response,
        fallbackRow,
        {
          openDetail: false,
          successMessage: "Đã xuất hóa đơn thành công.",
        }
      )
      const resultSource = exportResult?.source || response
      const status =
        exportResult?.status ||
        invoiceHelper.normalizeInvoiceStatusValue(
          response?.invoiceStatus || response?.content?.invoiceStatus
        ) ||
        (response?.jobId || response?.content?.jobId
          ? InvoiceStatus.ISSUING
          : null)
      const resultMessage = String(
        resultSource?.message || response?.message || ""
      ).trim()

      if (status === InvoiceStatus.FAILED) {
        if (!silent) {
          showErrorMessage(resultMessage || "Xuất hóa đơn thất bại.")
        }
        return InvoiceStatus.FAILED
      }

      if (status === InvoiceStatus.ISSUED) {
        if (!silent) {
          showSuccessMessage("Đã xuất hóa đơn thành công.")
        }
        return InvoiceStatus.ISSUED
      }

      return InvoiceStatus.ISSUING
    } catch (error) {
      console.error("EXPORT_M_INVOICE_FROM_LIST_ERROR", {
        saleTransactionId: row._id,
        invoiceSeries,
        invoiceIssuedDate: exportInvoiceIssuedDate,
        taxCode,
        error,
      })

      const errorMessage = getErrorMessage(error, "Xuất hóa đơn thất bại.")

      await handleInvoiceExported(
        row._id,
        {
          code: (error as any)?.response?.status || 500,
          info: "FAIL",
          message: errorMessage,
          invoiceStatus: InvoiceStatus.FAILED,
        },
        {
          ...fallbackRow,
          invoiceStatus: InvoiceStatus.FAILED,
        },
        { openDetail: false }
      )

      if (!silent) {
        showErrorMessage(errorMessage)
      }
      return InvoiceStatus.FAILED
    } finally {
      exportingInvoiceRef.current = false
      setExportingInvoiceId(null)
      setPendingExportInvoice(null)
      setPendingBulkExportInvoices([])
    }
  }

  const submitBulkExportInvoicesFromList = async (
    rows: InvoiceApiRow[],
    exportInvoiceIssuedDate: string
  ) => {
    const exportRows = getUniqueInvoiceRows(rows).filter((row) =>
      invoiceHelper.canStartInvoiceExport(invoiceHelper.getInvoiceStatus(row))
    )

    if (!exportRows.length) {
      showErrorMessage(
        "Vui lòng chọn hóa đơn nháp hoặc xuất thất bại để xuất hóa đơn hàng loạt."
      )
      return
    }

    let issuedCount = 0
    let processingCount = 0
    let failedCount = 0

    try {
      bulkInvoiceActionRef.current = true
      setBulkInvoiceActionLoading(true)

      for (const row of exportRows) {
        const status = await submitExportInvoiceFromList(
          row,
          exportInvoiceIssuedDate,
          { silent: true }
        )

        if (status === InvoiceStatus.ISSUED) {
          issuedCount += 1
        } else if (status === InvoiceStatus.ISSUING) {
          processingCount += 1
        } else {
          failedCount += 1
        }
      }

      setSelectedBulkInvoiceIds([])

      if (failedCount > 0) {
        showErrorMessage(
          `Đã xử lý ${issuedCount + processingCount}/${exportRows.length} hóa đơn, ${failedCount} lỗi.`
        )
        return
      }

      if (processingCount === 0) {
        showSuccessMessage("Đã xuất hóa đơn thành công.")
      }
    } finally {
      bulkInvoiceActionRef.current = false
      setBulkInvoiceActionLoading(false)
      setPendingBulkExportInvoices([])
      setPendingExportInvoice(null)
    }
  }

  const handleUpdateMInvoiceFromList = async (
    row: InvoiceApiRow,
    options: InvoiceListActionOptions = {}
  ): Promise<InvoiceListActionStatus> => {
    const silent = Boolean(options.silent)

    if (!options.bypassBusyGuard && isInvoiceActionBusy()) {
      return null
    }

    if (!row?._id) {
      if (!silent) {
        showErrorMessage(
          "Không tìm thấy ID giao dịch bán hàng để cập nhật hóa đơn."
        )
      }
      return InvoiceStatus.FAILED
    }

    if (invoiceHelper.getInvoiceStatus(row) !== InvoiceStatus.ISSUED) {
      if (!silent) {
        showErrorMessage("Chỉ hóa đơn đã xuất thành công mới được cập nhật.")
      }
      return InvoiceStatus.FAILED
    }

    const { invInvoiceCreatedId, taxCode, invoiceSeries, invoiceIssuedDate } =
      getInvoicePrintContext(row)
    const invoiceNumber = Number(row.invoiceNumber)

    if (!taxCode) {
      if (!silent) {
        showErrorMessage("Chưa có mã số thuế từ cấu hình hóa đơn.")
      }
      return InvoiceStatus.FAILED
    }

    if (!invoiceSeries) {
      if (!silent) {
        showErrorMessage("Chưa có ký hiệu hóa đơn từ cấu hình.")
      }
      return InvoiceStatus.FAILED
    }

    if (!invInvoiceCreatedId) {
      if (!silent) {
        showErrorMessage("Chưa có mã hóa đơn M-Invoice để cập nhật.")
      }
      return InvoiceStatus.FAILED
    }

    if (!Number.isFinite(invoiceNumber) || invoiceNumber <= 0) {
      if (!silent) {
        showErrorMessage("Chưa có số hóa đơn M-Invoice để cập nhật.")
      }
      return InvoiceStatus.FAILED
    }

    const fallbackRow: InvoiceApiRow = {
      ...row,
      inv_invoiceSeries: invoiceSeries,
      inv_invoiceIssuedDate: invoiceIssuedDate,
      inv_invoiceCreatedId: invInvoiceCreatedId,
      invoiceStatus: InvoiceStatus.ISSUING,
    }

    try {
      updatingMInvoiceRef.current = true
      setUpdatingMInvoiceId(row._id)

      const response = await APIUpdateMInvoiceReceiptPost(
        {
          saleTransactionId: row._id,
          inv_invoiceSeries: invoiceSeries,
          inv_invoiceIssuedDate: invoiceIssuedDate,
          editmode: 2,
          inv_invoiceNumber: invoiceNumber,
          inv_invoiceAuth_id: invInvoiceCreatedId,
        },
        taxCode
      )

      const updateResult = await handleInvoiceExported(
        row._id,
        response,
        fallbackRow,
        {
          openDetail: false,
          successMessage: "Đã cập nhật hóa đơn thành công.",
        }
      )
      const resultSource = updateResult?.source || response
      const status =
        updateResult?.status ||
        invoiceHelper.normalizeInvoiceStatusValue(
          response?.invoiceStatus || response?.content?.invoiceStatus
        ) ||
        (response?.jobId || response?.content?.jobId
          ? InvoiceStatus.ISSUING
          : null)
      const resultMessage = String(
        resultSource?.message || response?.message || ""
      ).trim()

      if (status === InvoiceStatus.FAILED) {
        if (!silent) {
          showErrorMessage(resultMessage || "Cập nhật hóa đơn thất bại.")
        }
        return InvoiceStatus.FAILED
      }

      if (status === InvoiceStatus.ISSUED) {
        if (!silent) {
          showSuccessMessage("Đã cập nhật hóa đơn thành công.")
        }
        return InvoiceStatus.ISSUED
      }

      return InvoiceStatus.ISSUING
    } catch (error) {
      console.error("UPDATE_M_INVOICE_FROM_LIST_ERROR", {
        saleTransactionId: row._id,
        invoiceSeries,
        invoiceIssuedDate,
        invoiceNumber,
        taxCode,
        error,
      })

      const errorMessage = getErrorMessage(error, "Cập nhật hóa đơn thất bại.")

      await handleInvoiceExported(
        row._id,
        {
          code: (error as any)?.response?.status || 500,
          info: "FAIL",
          message: errorMessage,
          invoiceStatus: InvoiceStatus.FAILED,
        },
        {
          ...fallbackRow,
          invoiceStatus: InvoiceStatus.FAILED,
        },
        { openDetail: false }
      )

      if (!silent) {
        showErrorMessage(errorMessage)
      }
      return InvoiceStatus.FAILED
    } finally {
      updatingMInvoiceRef.current = false
      setUpdatingMInvoiceId(null)
    }
  }

  const handleBulkUpdateMInvoiceFromList = async (rows: InvoiceApiRow[]) => {
    if (isInvoiceActionBusy()) return

    const updateRows = getUniqueInvoiceRows(rows).filter(canUpdateMInvoiceRow)

    if (!updateRows.length) {
      showErrorMessage(
        "Vui lòng chọn hóa đơn đã xuất thành công để cập nhật hàng loạt."
      )
      return
    }

    let updatedCount = 0
    let processingCount = 0
    let failedCount = 0

    try {
      bulkInvoiceActionRef.current = true
      setBulkInvoiceActionLoading(true)

      for (const row of updateRows) {
        const status = await handleUpdateMInvoiceFromList(row, {
          silent: true,
          bypassBusyGuard: true,
        })

        if (status === InvoiceStatus.ISSUED) {
          updatedCount += 1
        } else if (status === InvoiceStatus.ISSUING) {
          processingCount += 1
        } else {
          failedCount += 1
        }
      }

      setSelectedBulkInvoiceIds([])

      if (failedCount > 0) {
        showErrorMessage(
          `Đã xử lý ${updatedCount + processingCount}/${updateRows.length} hóa đơn, ${failedCount} lỗi.`
        )
        return
      }

      if (processingCount === 0) {
        showSuccessMessage("Đã cập nhật hóa đơn thành công.")
      }
    } finally {
      bulkInvoiceActionRef.current = false
      setBulkInvoiceActionLoading(false)
    }
  }

  const handleViewMInvoicePdf = async (row: InvoiceApiRow) => {
    if (!row?._id) {
      showErrorMessage("Không tìm thấy hóa đơn cần xem/in.")
      return
    }

    try {
      const latestDetail = await dispatch(
        fetchSaleTransactionByIdThunk(row._id)
      ).unwrap()
      const printableInvoice = latestDetail?._id
        ? hydrateAndUpsertInvoice(latestDetail, null, row)
        : row
      const invoiceStatus = invoiceHelper.getInvoiceStatus(printableInvoice)
      const invInvoiceCreatedId = String(
        printableInvoice.inv_invoiceCreatedId || ""
      ).trim()

      if (invoiceStatus !== InvoiceStatus.ISSUED || !invInvoiceCreatedId) {
        throw new Error("Hóa đơn chưa xuất thành công nên chưa thể xem/in.")
      }

      const { taxCode } = getInvoicePrintContext(printableInvoice)

      if (!taxCode) {
        throw new Error("Chưa có mã số thuế từ cấu hình hóa đơn.")
      }

      setPdfViewerOpen(true)
      setPdfLoading(true)
      setPdfUrl("")
      setPdfTitle("Mẫu hóa đơn")

      const res = await APIViewPrintInvoice({
        taxCode,
        inv_invoiceCreatedId: invInvoiceCreatedId,
      })

      const fileUrl = String(
        res?.fileUrl || res?.data?.fileUrl || res?.content?.fileUrl || ""
      ).trim()

      if (!fileUrl) {
        closePdfViewer()
        showErrorMessage("Dịch vụ xem/in không trả về đường dẫn file PDF.")
        return
      }

      setPdfUrl(invoiceHelper.buildPdfFileUrl(fileUrl))
    } catch (error) {
      console.error("APIViewPrintInvoice error:", error)

      closePdfViewer()

      showErrorMessage(getErrorMessage(error, "Không thể xem mẫu hóa đơn."))
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
                description=""
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
                onBulkExportInvoice={() =>
                  void handleBulkExportInvoiceFromList(
                    selectedBulkExportableInvoices
                  )
                }
                onBulkUpdateMInvoice={() =>
                  void handleBulkUpdateMInvoiceFromList(
                    selectedBulkUpdatableInvoices
                  )
                }
                onClearSelection={() => setSelectedBulkInvoiceIds([])}
                loading={loading}
                bulkActionLoading={bulkInvoiceActionLoading}
                selectedCount={selectedBulkInvoices.length}
                exportableCount={selectedBulkExportableInvoices.length}
                updatableCount={selectedBulkUpdatableInvoices.length}
              />

              <InvoiceDataTable
                rows={listRows}
                loading={loading}
                onEdit={handleEdit}
                onView={handleView}
                onCopyInvoice={handleCopyInvoice}
                onExportInvoice={handleExportInvoiceFromList}
                exportingInvoiceId={exportingInvoiceId}
                onUpdateMInvoice={handleUpdateMInvoiceFromList}
                updatingMInvoiceId={updatingMInvoiceId}
                onViewMInvoicePdf={handleViewMInvoicePdf}
                onCollectPayment={handleOpenCollectPayment}
                onCancelInvoice={handleCancelInvoice}
                cancellingInvoiceId={cancellingInvoiceId}
                selectedRowIds={selectedBulkInvoiceIds}
                onSelectedRowIdsChange={setSelectedBulkInvoiceIds}
                bulkActionLoading={bulkInvoiceActionLoading}
                searchKeyword={listSearch}
                onSearchKeywordChange={handleSearchKeywordChange}
                agencyFilterId={listAgencyId}
                onAgencyFilterChange={handleAgencyFilterChange}
                onClearServerFilters={handleClearListFilters}
                pagination={listTablePagination}
              />
            </div>
          </>
        ) : mode === "bulk-import" ? (
          <InvoiceBulkImport
            receiptConfigs={receiptConfigs}
            onBack={() => {
              setSelectedInvoiceId(null)
              setCopyInvoiceDraft(null)
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
              setCopyInvoiceDraft(null)
              setMode("list")
            }}
            onEdit={() => setMode("edit")}
            onSaved={handleSavedInvoice}
            onExported={handleInvoiceExported}
            onUpdateMInvoice={handleUpdateMInvoiceFromList}
            updateMInvoiceLoading={updatingMInvoiceId === selectedInvoice._id}
            onCancelInvoice={handleCancelInvoice}
            cancelInvoiceLoading={cancellingInvoiceId === selectedInvoice._id}
            exportInvoiceMinDate={exportInvoiceMinDate}
            exportInvoiceMaxDate={exportInvoiceMaxDate}
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
            onCancel={() => {
              setSelectedInvoiceId(null)
              setCopyInvoiceDraft(null)
              setMode("list")
            }}
            onEdit={() => setMode("edit")}
            onSaved={handleSavedInvoice}
          />
        ) : (
          <InvoiceCreateForm
            mode="create"
            initialInvoice={copyInvoiceDraft}
            receiptConfig={activeReceiptConfig}
            receiptConfigs={receiptConfigs}
            selectedReceiptConfigValue={selectedReceiptConfigValue}
            onReceiptConfigChange={setSelectedReceiptConfigValue}
            receiptConfigLocked
            onBack={() => {
              setSelectedInvoiceId(null)
              setCopyInvoiceDraft(null)
              setMode("list")
            }}
            onSaved={handleSavedInvoice}
          />
        )}
      </main>

      {exportDateDialogOpen && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-950/50 p-4">
          <div className="w-full max-w-md rounded-lg border border-slate-200 bg-white shadow-xl">
            <div className="border-b border-slate-100 px-5 py-4">
              <h3 className="text-base font-bold text-slate-900">
                {pendingBulkExportInvoices.length > 1
                  ? `Chọn ngày xuất ${pendingBulkExportInvoices.length} hóa đơn`
                  : "Chọn ngày xuất hóa đơn"}
              </h3>
            </div>

            <div className="space-y-3 px-5 py-4">
              <label
                htmlFor="invoice-list-export-date"
                className="block text-sm font-medium text-slate-700"
              >
                Ngày xuất hóa đơn
              </label>
              <input
                id="invoice-list-export-date"
                className="h-9 w-full rounded border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none transition focus:border-indigo-500"
                type="date"
                value={selectedExportInvoiceDate}
                min={exportInvoiceMinDate || undefined}
                max={exportInvoiceMaxDate}
                disabled={
                  Boolean(exportingInvoiceId) || bulkInvoiceActionLoading
                }
                onChange={(event) =>
                  setSelectedExportInvoiceDate(event.target.value)
                }
              />
              <p className="text-xs text-slate-500">
                Ngày hợp lệ: {exportInvoiceMinDate || "..."} -{" "}
                {exportInvoiceMaxDate}
              </p>
            </div>

            <div className="flex justify-end gap-2 border-t border-slate-100 px-5 py-4">
              <button
                type="button"
                onClick={() => {
                  setExportDateDialogOpen(false)
                  setPendingExportInvoice(null)
                  setPendingBulkExportInvoices([])
                }}
                disabled={
                  Boolean(exportingInvoiceId) || bulkInvoiceActionLoading
                }
                className="rounded border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={() => void handleConfirmExportInvoiceFromList()}
                disabled={
                  Boolean(exportingInvoiceId) || bulkInvoiceActionLoading
                }
                className="rounded bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {exportingInvoiceId || bulkInvoiceActionLoading
                  ? "Đang xuất..."
                  : pendingBulkExportInvoices.length > 1
                    ? "Xuất hàng loạt"
                    : "Xuất hóa đơn"}
              </button>
            </div>
          </div>
        </div>
      )}

      <InvoiceCollectPaymentDialog
        open={collectPaymentOpen}
        invoice={collectPaymentTarget}
        banks={collectPaymentBanks}
        bankId={collectPaymentBankId}
        amountValue={collectPaymentAmount}
        paidDateValue={collectPaymentDate}
        loadingBanks={collectPaymentLoading}
        saving={collectPaymentSaving}
        onBankChange={setCollectPaymentBankId}
        onAmountChange={handleCollectPaymentAmountChange}
        onPaidDateChange={setCollectPaymentDate}
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
        isOpen={cancelInvoiceDialogOpen}
        onOpenChange={setCancelInvoiceDialogOpen}
        onConfirm={handleConfirmCancelInvoice}
        title="Xác nhận huỷ phiếu"
        description="Bạn có chắc chắn muốn huỷ phiếu này không? Phiếu đã huỷ sẽ không được đưa vào báo cáo."
        confirmText="Huỷ phiếu"
        cancelText="Đóng"
        tone="destructive"
      />

      {showSuccess && <AlertSuccess description={message} />}
      {showError && <AlertError description={message} />}
    </div>
  )
}
