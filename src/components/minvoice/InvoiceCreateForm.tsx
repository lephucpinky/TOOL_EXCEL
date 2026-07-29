"use client"

import Link from "next/link"

import { useEffect, useMemo, useState } from "react"

import type { Agency } from "@/types/agency"
import type { Bank } from "@/types/bank"
import type { Department } from "@/types/department"
import type { Employee } from "@/types/employee"
import type { Product } from "@/types/product"

import { APIGetAgencies } from "@/services/agency"
import { APIGetDepartments } from "@/services/department"
import { APIGetEmployees } from "@/services/employee"
import { APIGetAllProducts } from "@/services/product"
import { APIGetBanks } from "@/services/bank"
import { APIGetCompanyInfo } from "@/services/companyInfo"
import { APIExportMInvoiceReceiptPost } from "@/services/mInvoiceReceipt"
import { Loader2, Search } from "lucide-react"
import type { ReceiptInvoiceConfig } from "@/types/receiptInvoice"
import AlertOption from "../alert/AlertOption"
import AlertSuccess from "../alert/AlertSuccess"
import AlertError from "../alert/AlertError"
import { SearchableSelect } from "../select/SearchableSelect"
import {
  canStartInvoiceExport,
  createItemId,
  FIXED_RECEIPT_INVOICE_CONFIG,
  formatMoney,
  getId,
  getInvoiceStatus,
  getInvoiceTaxRateNumber,
  inputClass,
  invoiceStatusClass,
  invoiceStatusLabel,
  mergeOptions,
  normalizeDateInput,
  normalizeInvoiceStatusValue,
  normalizeInvoiceTaxCode,
  numberToVietnamese,
  resolveInvoiceTaxCodeAndRate,
  resolveOption,
  roundInvoiceMoney,
} from "@/utils/invoice"
import { toNumber } from "@/utils/excel"
import { InvoiceApiRow, InvoiceStatus } from "@/types/invoice"
type InvoiceScreenMode = "create" | "edit" | "detail"

type InvoiceGeneralForm = {
  symbol: string
  invoiceDate: string
  invoiceNo: string
  currency: string
  exchangeRate: number
  paymentMethod: string
  agency: Agency | null
  department: Department | null
  employee: Employee | null
  product: Product | null
  bank: Bank | null
  taxCode: string
  companyName: string
  email: string
  address: string
  isPaid: boolean
  paidAmount: number
  paidDate: string
}

type InvoiceItemForm = {
  id: string
  product: Product | null
  productCode: string
  productName: string
  unit: string
  quantity: number
  type: string
  unitPrice: number
  discountAmount: number
  discountPercentage: number
  taxRate: string
  invReconciliation: number | null
  capitalPrice: number
  totalSalary: number
  accountingAccountCode: string
}

type InvoiceFieldErrors = Partial<Record<"taxCode" | "email", string>>

type Props = {
  onBack: () => void
  onCancel?: () => void
  onSaved?: (payload: any) => void
  onEdit?: () => void
  onExported?: (
    saleTransactionId: string,
    response: any,
    fallbackRow?: InvoiceApiRow | null,
    options?: { openDetail?: boolean; successMessage?: string }
  ) => void | Promise<unknown>
  onUpdateMInvoice?: (row: InvoiceApiRow) => void | Promise<unknown>
  updateMInvoiceLoading?: boolean
  mode?: InvoiceScreenMode
  initialInvoice?: InvoiceApiRow | null
  receiptConfig?: ReceiptInvoiceConfig | null
  receiptConfigs?: ReceiptInvoiceConfig[]
  selectedReceiptConfigValue?: string
  onReceiptConfigChange?: (value: string) => void
  receiptConfigLocked?: boolean
  exportInvoiceMinDate?: string
  exportInvoiceMaxDate?: string
}
const today = new Date().toISOString().slice(0, 10)
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const taxCodePattern = /^\d{10,13}(?:-\d{1,3})?$/

const taxCodeRequiredMessage = "Vui lòng nhập MST."
const taxCodeInvalidMessage =
  "Mã số thuế hoặc CMND/CCCD phải có 10 đến 13 ký tự số"
const emailRequiredMessage = "Vui lòng nhập Email."
const emailInvalidMessage = "Email không hợp lệ."

const invoiceSelectClass = `${inputClass} justify-between font-normal shadow-none hover:bg-white hover:text-slate-800`
const productCodeSelectClass = `${invoiceSelectClass} min-w-[260px]`
const productCodeSelectContentClass = "w-[380px] max-w-[calc(100vw-32px)]"

const receiptConfigSelectClass =
  "h-8 w-[280px] justify-between rounded-md border border-slate-300 bg-white px-2 text-xs font-medium text-slate-700 shadow-none hover:bg-white hover:text-slate-700 focus:border-indigo-500 disabled:bg-slate-100"

const itemTypeOptions = [
  { value: "Mới", label: "Mới" },
  { value: "Gia hạn", label: "Gia hạn" },
  { value: "Tặng", label: "Tặng" },
  { value: "Khác", label: "Khác" },
]

function resolveAgencyEmployee(
  agency: Agency | null,
  employees: Employee[]
): Employee | null {
  if (!agency?.employeeId) return null

  if (typeof agency.employeeId === "object") {
    return agency.employeeId
  }

  const employeeId = getId(agency.employeeId)

  if (!employeeId) return null

  return employees.find((item) => item._id === employeeId) || null
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
  const taxCode = String(config.tax_code || "").trim()

  if (invoiceSeries && taxCode) {
    return `${invoiceSeries} - MST: ${taxCode}`
  }

  if (invoiceSeries) {
    return `${invoiceSeries}`
  }

  return invoiceSeries || "Cấu hình hóa đơn chưa hoàn chỉnh"
}

function normalizePercent(value: unknown) {
  const numericValue = Number(value)

  if (!Number.isFinite(numericValue)) return 0

  return Math.min(Math.max(numericValue, 0), 100)
}

function getAgencyDiscountPercentage(agency?: Agency | null) {
  return normalizePercent(agency?.commissionPercent || 0)
}

function resolveAgencyDiscountPercentage(
  value: unknown,
  agency?: Agency | null
) {
  if (value === undefined || value === null || value === "") {
    return getAgencyDiscountPercentage(agency)
  }

  return normalizePercent(value)
}

export default function InvoiceCreateForm({
  onBack,
  onCancel,
  onSaved,
  onEdit,
  onExported,
  onUpdateMInvoice,
  updateMInvoiceLoading = false,
  mode = "create",
  initialInvoice = null,
  receiptConfig = null,
  receiptConfigs = [],
  selectedReceiptConfigValue = "",
  onReceiptConfigChange,
  receiptConfigLocked = false,
  exportInvoiceMinDate = "",
  exportInvoiceMaxDate = today,
}: Props) {
  const invoiceStatus = getInvoiceStatus(initialInvoice)
  const invoiceStatusDisplayLabel =
    String(initialInvoice?.invoiceStatusVi || "").trim() ||
    invoiceStatusLabel[invoiceStatus]
  const isIssuedInvoice = invoiceStatus === InvoiceStatus.ISSUED
  const isIssuingInvoice = invoiceStatus === InvoiceStatus.ISSUING
  const isCancelledInvoice = invoiceStatus === InvoiceStatus.CANCELLED
  const canExportInvoice = canStartInvoiceExport(invoiceStatus)

  const alreadyExported = isIssuedInvoice

  const readOnly = mode === "detail" || isCancelledInvoice || isIssuingInvoice

  // Bank is editable from the issued-invoice edit flow.
  const canEditBank = mode === "edit" && isIssuedInvoice

  const mainFieldsDisabled = readOnly
  const invoiceDateFieldDisabled = readOnly
  const paymentFieldsDisabled = readOnly
  const effectiveReceiptConfig = useMemo(
    () => receiptConfig || receiptConfigs[0] || FIXED_RECEIPT_INVOICE_CONFIG,
    [receiptConfig, receiptConfigs]
  )
  const effectiveReceiptConfigs = useMemo(
    () => (receiptConfigs.length ? receiptConfigs : [effectiveReceiptConfig]),
    [effectiveReceiptConfig, receiptConfigs]
  )

  const [agencies, setAgencies] = useState<Agency[]>([])
  const [departments, setDepartments] = useState<Department[]>([])
  const [employees, setEmployees] = useState<Employee[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [banks, setBanks] = useState<Bank[]>([])
  const [catalogLoading, setCatalogLoading] = useState(false)
  const bankFieldDisabled = catalogLoading || !canEditBank
  const activeReceiptSeries = String(
    effectiveReceiptConfig.inv_invoiceSeries || ""
  ).trim()
  const activeReceiptTaxCode = String(
    effectiveReceiptConfig.tax_code || ""
  ).trim()

  const [general, setGeneral] = useState<InvoiceGeneralForm>({
    symbol: activeReceiptSeries,
    invoiceDate: today,
    invoiceNo: "",
    currency: "VND",
    exchangeRate: 1,
    paymentMethod: "CK",

    agency: null,
    department: null,
    employee: null,
    product: null,
    bank: null,

    taxCode: "",
    companyName: "",
    email: "",
    address: "",

    isPaid: false,
    paidAmount: 0,
    paidDate: today,
  })

  const [items, setItems] = useState<InvoiceItemForm[]>([
    {
      id: createItemId(),
      product: null,
      productCode: "",
      productName: "",
      unit: "kg",
      quantity: 1,
      type: "Mới",
      unitPrice: 0,
      discountAmount: 0,
      discountPercentage: 0,
      taxRate: "0",
      invReconciliation: null,
      capitalPrice: 0,
      totalSalary: 0,
      accountingAccountCode: "",
    },
  ])

  const [exportInvoiceLoading, setExportInvoiceLoading] = useState(false)
  const [saveLoading, setSaveLoading] = useState(false)
  const [companyInfoLoading, setCompanyInfoLoading] = useState(false)
  const [exportDateDialogOpen, setExportDateDialogOpen] = useState(false)
  const [selectedExportInvoiceDate, setSelectedExportInvoiceDate] =
    useState(today)

  const [showSuccess, setShowSuccess] = useState(false)
  const [showError, setShowError] = useState(false)
  const [message, setMessage] = useState("")
  const [isCancelDialogOpen, setCancelDialogOpen] = useState(false)
  const [fieldErrors, setFieldErrors] = useState<InvoiceFieldErrors>({})

  const receiptConfigSelectValue = useMemo(() => {
    if (selectedReceiptConfigValue) return selectedReceiptConfigValue

    const matchedIndex = effectiveReceiptConfigs.findIndex((item) => {
      return (
        String(item.inv_invoiceSeries || "").trim() === general.symbol.trim() ||
        String(item.tax_code || "").trim() === activeReceiptTaxCode
      )
    })

    if (matchedIndex < 0) return ""

    return getReceiptConfigOptionValue(
      effectiveReceiptConfigs[matchedIndex],
      matchedIndex
    )
  }, [
    selectedReceiptConfigValue,
    effectiveReceiptConfigs,
    general.symbol,
    activeReceiptTaxCode,
  ])

  const receiptConfigSelectOptions = useMemo(
    () =>
      effectiveReceiptConfigs.map((config, index) => ({
        value: getReceiptConfigOptionValue(config, index),
        label: formatReceiptConfigLabel(config),
      })),
    [effectiveReceiptConfigs]
  )

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

  const handleCancelAction = () => {
    const cancelAction = onCancel || onBack
    cancelAction()
  }

  const getTaxCodeError = (value: string) => {
    const taxCode = value.trim()

    if (!taxCode) return taxCodeRequiredMessage
    if (!taxCodePattern.test(taxCode)) return taxCodeInvalidMessage

    return ""
  }

  const getEmailError = (value: string) => {
    const email = value.trim()

    if (!email) return emailRequiredMessage
    if (!emailPattern.test(email)) return emailInvalidMessage

    return ""
  }

  const validateRequiredField = (field: keyof InvoiceFieldErrors) => {
    const message =
      field === "taxCode"
        ? getTaxCodeError(general.taxCode)
        : getEmailError(general.email)

    setFieldErrors((prev) => ({
      ...prev,
      [field]: message || undefined,
    }))

    return !message
  }

  const handleLookupCompanyInfo = async () => {
    if (mainFieldsDisabled || companyInfoLoading) return

    const taxCode = general.taxCode.trim()
    const taxCodeError = getTaxCodeError(taxCode)

    if (taxCodeError) {
      setFieldErrors((prev) => ({
        ...prev,
        taxCode: taxCodeError,
      }))
      showErrorMessage(taxCodeError)
      return
    }

    try {
      setCompanyInfoLoading(true)

      const companyInfo = await APIGetCompanyInfo(taxCode)

      setGeneral((prev) => ({
        ...prev,
        taxCode: companyInfo.ma_so_thue,
        companyName: companyInfo.ten_cty,
        address: companyInfo.dia_chi,
      }))
      setFieldErrors((prev) => ({
        ...prev,
        taxCode: undefined,
      }))
      showSuccessMessage("Tra cứu thông tin doanh nghiệp thành công.")
    } catch (error) {
      showErrorMessage(
        error instanceof Error
          ? error.message
          : "Không thể tra cứu thông tin doanh nghiệp."
      )
    } finally {
      setCompanyInfoLoading(false)
    }
  }
  const handleCancelClick = () => {
    if (readOnly) {
      onBack()
      return
    }

    setCancelDialogOpen(true)
  }

  const handleReceiptConfigSelect = (value: string) => {
    if (mainFieldsDisabled) return

    onReceiptConfigChange?.(value)

    const nextConfig = effectiveReceiptConfigs.find(
      (item, index) => getReceiptConfigOptionValue(item, index) === value
    )

    if (!nextConfig) return

    setGeneral((prev) => ({
      ...prev,
      symbol: String(nextConfig.inv_invoiceSeries || "").trim(),
    }))
  }

  useEffect(() => {
    const fetchCatalogs = async () => {
      try {
        setCatalogLoading(true)

        const [agencyRes, departmentRes, employeeRes, productRes, bankRes] =
          await Promise.all([
            APIGetAgencies(),
            APIGetDepartments(),
            APIGetEmployees(),
            APIGetAllProducts(),
            APIGetBanks(),
          ])

        const nextAgencies = (
          Array.isArray(agencyRes?.data) ? agencyRes.data : []
        ).filter((item: Agency) => item?._id) as Agency[]

        const nextDepartments = (
          Array.isArray(departmentRes?.data) ? departmentRes.data : []
        ).filter((item: Department) => item?._id) as Department[]

        const nextEmployees = (
          Array.isArray(employeeRes?.data) ? employeeRes.data : []
        ).filter((item: Employee) => item?._id) as Employee[]

        const nextProducts = (
          Array.isArray(productRes?.data) ? productRes.data : []
        ).filter((item: Product) => item?._id) as Product[]

        const nextBanks = (
          Array.isArray(bankRes?.data) ? bankRes.data : []
        ).filter((item: Bank) => item?._id) as Bank[]

        setAgencies(nextAgencies)
        setDepartments(nextDepartments)
        setEmployees(nextEmployees)
        setProducts(nextProducts)
        setBanks(nextBanks)
      } catch (err) {
        console.error("Fetch invoice catalogs error:", err)
        showErrorMessage("Không thể tải dữ liệu danh mục tạo hóa đơn.")
      } finally {
        setCatalogLoading(false)
      }
    }

    fetchCatalogs()
  }, [])

  useEffect(() => {
    if (initialInvoice?._id) return

    setGeneral((prev) => {
      if (prev.symbol === activeReceiptSeries) return prev

      return {
        ...prev,
        symbol: activeReceiptSeries,
      }
    })
  }, [activeReceiptSeries, initialInvoice])

  useEffect(() => {
    if (!initialInvoice) return

    const apiItems = Array.isArray((initialInvoice as any).items)
      ? ((initialInvoice as any).items as any[])
      : []

    const firstApiItem = apiItems[0]

    const resolvedAgency = resolveOption<Agency>(
      agencies,
      (initialInvoice as any).agencyId
    )

    const resolvedDepartment = resolveOption<Department>(
      departments,
      (initialInvoice as any).departmentId
    )

    const resolvedEmployee =
      resolveOption<Employee>(employees, (initialInvoice as any).employeeId) ||
      resolveAgencyEmployee(resolvedAgency, employees)

    const resolvedBank = resolveOption<Bank>(
      banks,
      (initialInvoice as any).bankId
    )

    const resolvedProduct = resolveOption<Product>(
      products,
      firstApiItem?.productId ||
        firstApiItem?.product ||
        (initialInvoice as any).productId ||
        (initialInvoice as any).product
    )
    const invoiceDate =
      normalizeDateInput(initialInvoice.activationDate || undefined) || today
    const initialPaidAmount = Number(
      (initialInvoice as any).amountCollected ||
        (initialInvoice as any).paidAmount ||
        0
    )
    const initialIsPaid =
      Boolean((initialInvoice as any).isPaid) || initialPaidAmount > 0

    setGeneral((prev) => ({
      ...prev,
      symbol: activeReceiptSeries,
      invoiceDate,

      currency: initialInvoice.inv_currencyCode || "VND",
      exchangeRate: Number(initialInvoice.inv_exchangeRate || 1),
      paymentMethod: initialInvoice.inv_paymentMethodName || "CK",

      agency: resolvedAgency,
      department: resolvedDepartment,
      employee: resolvedEmployee,
      bank: resolvedBank,
      product: resolvedProduct,

      taxCode: initialInvoice.inv_buyerTaxCode || "",
      companyName:
        initialInvoice.inv_buyerLegalName ||
        initialInvoice.inv_buyerDisplayName ||
        "",
      email: initialInvoice.inv_buyerEmail || "",
      address: initialInvoice.inv_buyerAddressLine || "",

      isPaid: initialIsPaid,
      paidAmount: initialPaidAmount,
      paidDate:
        normalizeDateInput((initialInvoice as any).paidDate) ||
        normalizeDateInput((initialInvoice as any).paymentDate) ||
        today,
    }))

    if (!apiItems.length) {
      if (resolvedProduct) {
        const quantity = Number(
          (initialInvoice as any).inv_quantity ||
            resolvedProduct.inv_quantity ||
            1
        )
        const unitPrice = Number(resolvedProduct.inv_unitPrice || 0)
        const loadedDiscountAmount = Number(
          (initialInvoice as any).inv_discountAmount || 0
        )
        const loadedDiscountPercentage = normalizePercent(
          (initialInvoice as any).inv_discountPercentage
        )
        const totalPrice = unitPrice * quantity

        setItems([
          {
            id: createItemId(),
            product: resolvedProduct,
            productCode: resolvedProduct.inv_itemCode || "",
            productName: resolvedProduct.inv_itemName || "",
            unit: resolvedProduct.inv_unitCode || "kg",
            quantity,
            type: "Mới",
            unitPrice,
            discountAmount: loadedDiscountAmount,
            discountPercentage: loadedDiscountPercentage
              ? loadedDiscountPercentage
              : loadedDiscountAmount > 0 && totalPrice > 0
                ? normalizePercent((loadedDiscountAmount / totalPrice) * 100)
                : resolveAgencyDiscountPercentage(
                    (initialInvoice as any).inv_discountPercentage ??
                      resolvedAgency?.commissionPercent,
                    resolvedAgency
                  ),
            taxRate: normalizeInvoiceTaxCode(resolvedProduct.ma_thue),
            invReconciliation:
              (initialInvoice as any).invReconciliation !== undefined &&
              (initialInvoice as any).invReconciliation !== null &&
              String((initialInvoice as any).invReconciliation).trim() !== ""
                ? toNumber((initialInvoice as any).invReconciliation)
                : null,
            capitalPrice: 0,
            totalSalary: 0,
            accountingAccountCode: String(
              (resolvedProduct as any).accountingAccountCode ||
                (resolvedProduct as any).accountCode ||
                (resolvedProduct as any).inv_accountCode ||
                ""
            ),
          },
        ])
      }

      return
    }

    setItems(
      apiItems.map((apiItem, index) => {
        const product = resolveOption<Product>(
          products,
          apiItem.productId || apiItem.product
        )

        const quantity = toNumber(
          apiItem.quantity ??
            apiItem.inv_quantity ??
            (apiItems.length === 1
              ? (initialInvoice as any).inv_quantity
              : 0) ??
            product?.inv_quantity ??
            1
        )

        const taxRate = normalizeInvoiceTaxCode(
          product?.ma_thue ?? apiItem.ma_thue ?? apiItem.taxRate ?? "0"
        )
        const taxRateNumber = getInvoiceTaxRateNumber(taxRate)

        // BE dùng `price` là đơn giá đã gồm VAT, sau đó tự tách tiền chưa VAT.
        const grossTotalAmount = toNumber(
          apiItem.inv_TotalAmount ??
            apiItem.totalAmount ??
            apiItem.totalPrice ??
            (apiItems.length === 1
              ? (initialInvoice as any).inv_TotalAmount
              : 0)
        )

        const netUnitPrice = toNumber(apiItem.inv_unitPrice ?? 0)
        const loadedPrice = toNumber(apiItem.price ?? apiItem.unitPrice)

        const unitPrice =
          loadedPrice ||
          (quantity > 0 && grossTotalAmount > 0
            ? grossTotalAmount / quantity
            : 0) ||
          (netUnitPrice > 0 ? netUnitPrice * (1 + taxRateNumber / 100) : 0) ||
          Number(product?.inv_unitPrice || 0)
        const loadedDiscountAmount = toNumber(
          apiItem.discountAmount ??
            apiItem.inv_discountAmount ??
            (apiItems.length === 1
              ? (initialInvoice as any).inv_discountAmount
              : 0)
        )
        const loadedDiscountPercentage = normalizePercent(
          apiItem.discountPercentage ??
            apiItem.commissionRate ??
            (initialInvoice as any).inv_discountPercentage
        )
        const totalPrice = unitPrice * (quantity || 1)
        const loadedInvReconciliation =
          (apiItem as any).invReconciliation ??
          (index === 0 ? (initialInvoice as any).invReconciliation : undefined)

        return {
          id: apiItem._id || `${index}-${createItemId()}`,
          product,
          productCode:
            product?.inv_itemCode ||
            apiItem.productCode ||
            apiItem.inv_itemCode ||
            "",
          productName:
            product?.inv_itemName ||
            apiItem.productName ||
            apiItem.inv_itemName ||
            "",
          unit:
            product?.inv_unitCode ||
            apiItem.unit ||
            apiItem.inv_unitCode ||
            "kg",
          quantity: quantity || 1,
          type: apiItem.type || apiItem.itemType || "Mới",
          unitPrice,
          discountAmount: loadedDiscountAmount,
          discountPercentage: loadedDiscountPercentage
            ? loadedDiscountPercentage
            : loadedDiscountAmount > 0 && totalPrice > 0
              ? normalizePercent((loadedDiscountAmount / totalPrice) * 100)
              : resolveAgencyDiscountPercentage(
                  apiItem.discountPercentage ??
                    apiItem.commissionRate ??
                    (initialInvoice as any).inv_discountPercentage,
                  resolvedAgency
                ),
          taxRate,
          invReconciliation:
            loadedInvReconciliation !== undefined &&
            loadedInvReconciliation !== null &&
            String(loadedInvReconciliation).trim() !== ""
              ? toNumber(loadedInvReconciliation)
              : null,
          capitalPrice: Number(apiItem.capitalPrice || 0),
          totalSalary: Number(apiItem.totalSalary || 0),
          accountingAccountCode: String(
            apiItem.accountingAccountCode ||
              (product as any)?.accountingAccountCode ||
              (product as any)?.accountCode ||
              (product as any)?.inv_accountCode ||
              ""
          ),
        }
      })
    )
  }, [
    initialInvoice,
    agencies,
    departments,
    employees,
    products,
    banks,
    activeReceiptSeries,
  ])

  const selectedAgency = general.agency
  const selectedBank = general.bank
  const agencyOptions = useMemo(() => {
    return mergeOptions(agencies, [general.agency])
  }, [agencies, general.agency])

  const agencySelectOptions = useMemo(
    () => [
      { value: "", label: "Chọn đại lý" },
      ...agencyOptions.map((item) => ({
        value: getId(item),
        label: `${item.agencyName} - ${item.commissionPercent}% HH`,
      })),
    ],
    [agencyOptions]
  )

  const departmentOptions = useMemo(() => {
    return mergeOptions(departments, [general.department])
  }, [departments, general.department])

  const departmentSelectOptions = useMemo(
    () => [
      { value: "", label: "Chọn phòng ban" },
      ...departmentOptions.map((item) => ({
        value: getId(item),
        label: item.departmentName,
      })),
    ],
    [departmentOptions]
  )

  const selectedAgencyEmployee = useMemo(() => {
    return resolveAgencyEmployee(general.agency, employees)
  }, [general.agency, employees])

  const employeeOptions = useMemo(() => {
    if (selectedAgencyEmployee) {
      return mergeOptions(employees, [selectedAgencyEmployee, general.employee])
    }

    return mergeOptions(employees, [general.employee])
  }, [selectedAgencyEmployee, employees, general.employee])

  const employeeSelectOptions = useMemo(
    () => [
      { value: "", label: "Chọn nhân viên" },
      ...employeeOptions.map((item) => ({
        value: getId(item),
        label: item.employeeName,
      })),
    ],
    [employeeOptions]
  )

  const productOptions = useMemo(() => {
    return mergeOptions(products, [
      general.product,
      ...items.map((item) => item.product),
    ])
  }, [products, general.product, items])

  const productCodeSelectOptions = useMemo(
    () => [
      { value: "", label: "Chọn mã hàng" },
      ...productOptions.flatMap((product) => {
        const productCode = String(
          product.inv_itemProduct || product.inv_itemCode || ""
        ).trim()

        return productCode
          ? [
              {
                value: getId(product),
                label: productCode,
              },
            ]
          : []
      }),
    ],
    [productOptions]
  )

  const bankOptions = useMemo(() => {
    return mergeOptions(banks, [general.bank])
  }, [banks, general.bank])

  const bankSelectOptions = useMemo(
    () => [
      { value: "", label: "Chọn ngân hàng" },
      ...bankOptions.map((item) => ({
        value: getId(item),
        label: item.inv_buyerBankName,
      })),
    ],
    [bankOptions]
  )
  const computedItems = useMemo(() => {
    return items.map((item) => {
      // Khớp BE: quantity = item.inv_quantity ?? 1
      const quantityValue = Number(item.quantity)
      const quantity = Number.isFinite(quantityValue) ? quantityValue : 1

      // Khớp BE: price = item.price
      // FE đang dùng ô Đơn giá làm `price` gửi xuống BE, tức giá đã gồm VAT.
      const price = Number(item.unitPrice || 0)

      // Keep special tax codes for M-Invoice; use numeric value only for VAT math.
      const { displayTaxCode, taxRate } = resolveInvoiceTaxCodeAndRate(
        item.taxRate
      )

      const totalPrice = price * quantity
      const manualDiscountAmount = roundInvoiceMoney(
        Math.max(0, Number(item.discountAmount || 0))
      )
      const discountPercentage = normalizePercent(item.discountPercentage)
      const discountAmount =
        manualDiscountAmount > 0
          ? manualDiscountAmount
          : roundInvoiceMoney((totalPrice * discountPercentage) / 100)
      const revenue = roundInvoiceMoney(
        Math.max(totalPrice - discountAmount, 0)
      )
      const invReconciliation =
        item.invReconciliation === null || item.invReconciliation === undefined
          ? roundInvoiceMoney(totalPrice)
          : roundInvoiceMoney(Math.max(0, Number(item.invReconciliation || 0)))

      // Khớp BE: totalAmountWithVat = totalPrice / (1 + tax)
      const totalAmountWithoutVat = totalPrice / (1 + taxRate)

      // Khớp BE: vatAmount = totalPrice - totalAmountWithVat
      const vatAmount = totalPrice - totalAmountWithoutVat

      // No invoice discount is applied when calculating BE unit price.
      const totalBeforeDiscount = totalAmountWithoutVat

      // Khớp BE: unitPrice = totalBeforeDiscount / quantity
      const invUnitPrice = quantity > 0 ? totalBeforeDiscount / quantity : 0

      return {
        ...item,
        quantity,

        // Giữ lại để build payload gửi BE đúng tên field input.
        price: roundInvoiceMoney(price),
        ma_thue: displayTaxCode,

        // Cột Tổng tiền hàng trên UI đang hiển thị tổng tiền thanh toán đã gồm VAT.
        amount: roundInvoiceMoney(totalPrice),

        // Ưu tiên tiền chiết khấu nhập tay, nếu không có thì tính theo %.
        discountAmount,
        discountPercentage: roundInvoiceMoney(discountPercentage),

        taxRate: displayTaxCode,
        taxAmount: roundInvoiceMoney(vatAmount),

        // netAmount keeps invoice total-before-tax; revenue is total goods amount minus discount.
        netAmount: roundInvoiceMoney(totalAmountWithoutVat),
        revenue,
        invReconciliation,

        // Tổng thanh toán = inv_TotalAmount theo BE.
        totalAmount: roundInvoiceMoney(totalPrice),

        // inv_unitPrice BE trả về là đơn giá chưa VAT.
        invUnitPrice: roundInvoiceMoney(invUnitPrice),

        capitalPrice: Number(item.capitalPrice || 0),

        // Tính lương = Doanh thu.
        totalSalary: revenue,

        accountingAccountCode: item.accountingAccountCode,
      }
    })
  }, [items])

  const totalDiscountAmount = computedItems.reduce(
    (sum, item) => sum + Number(item.discountAmount || 0),
    0
  )

  const totalBeforeTax = computedItems.reduce(
    (sum, item) => sum + Number(item.netAmount || 0),
    0
  )

  const totalTax = computedItems.reduce(
    (sum, item) => sum + Number(item.taxAmount || 0),
    0
  )

  const totalPayment = computedItems.reduce(
    (sum, item) => sum + Number(item.totalAmount || 0),
    0
  )
  const totalRevenue = computedItems.reduce(
    (sum, item) => sum + Number(item.revenue || 0),
    0
  )
  const totalInvReconciliation = computedItems.reduce(
    (sum, item) => sum + Number(item.invReconciliation || 0),
    0
  )
  const effectivePaidAmount = general.isPaid
    ? roundInvoiceMoney(Number(general.paidAmount || totalPayment))
    : 0

  useEffect(() => {
    if (readOnly || paymentFieldsDisabled) return
    if (!general.isPaid) return

    setGeneral((prev) => {
      const nextPaidAmount = roundInvoiceMoney(totalPayment)

      if (Number(prev.paidAmount || 0) === nextPaidAmount) {
        return prev
      }

      return {
        ...prev,
        paidAmount: nextPaidAmount,
      }
    })
  }, [readOnly, paymentFieldsDisabled, general.isPaid, totalPayment])

  const updateGeneral = <K extends keyof InvoiceGeneralForm>(
    key: K,
    value: InvoiceGeneralForm[K]
  ) => {
    if (readOnly) return

    // Ngân hàng chỉ được đổi khi hóa đơn đã ISSUED và đang ở màn sửa.
    if (key === "bank" && !canEditBank) return

    if (
      (key === "isPaid" || key === "paidAmount" || key === "paidDate") &&
      paymentFieldsDisabled
    ) {
      return
    }

    if (key === "agency") {
      const agency = value as Agency | null
      const employee = resolveAgencyEmployee(agency, employees)
      const email = agency?.agencyEmail || ""
      const previousCommissionPercent = getAgencyDiscountPercentage(
        general.agency
      )
      const nextCommissionPercent = getAgencyDiscountPercentage(agency)

      setGeneral((prev) => ({
        ...prev,
        agency,
        employee,
        email,
      }))

      setItems((prev) =>
        prev.map((item) => {
          const currentDiscountPercentage = normalizePercent(
            item.discountPercentage
          )

          if (currentDiscountPercentage !== previousCommissionPercent) {
            return item
          }

          return {
            ...item,
            discountPercentage: nextCommissionPercent,
          }
        })
      )

      setFieldErrors((prev) => ({
        ...prev,
        email: email ? getEmailError(email) || undefined : prev.email,
      }))

      return
    }

    if (key === "department") {
      const department = value as Department | null

      setGeneral((prev) => ({
        ...prev,
        department,
        employee: prev.agency ? prev.employee : null,
      }))

      return
    }

    if (key === "product") {
      const product = value as Product | null

      setGeneral((prev) => ({
        ...prev,
        product,
      }))

      setItems((prev) =>
        prev.map((item, index) => {
          if (index !== 0) return item

          return {
            ...item,
            product,
            productCode: product?.inv_itemCode || "",
            productName: product?.inv_itemName || "",
            unit: product?.inv_unitCode || "kg",
            quantity: Number(product?.inv_quantity || item.quantity || 1),
            unitPrice:
              item.type === "Tặng" ? 0 : Number(product?.inv_unitPrice || 0),
            discountAmount: item.discountAmount || 0,
            discountPercentage: normalizePercent(item.discountPercentage),
            taxRate: normalizeInvoiceTaxCode(product?.ma_thue),
            accountingAccountCode: String(
              (product as any)?.accountingAccountCode ||
                (product as any)?.accountCode ||
                (product as any)?.inv_accountCode ||
                ""
            ),
          }
        })
      )

      return
    }

    setGeneral((prev) => ({ ...prev, [key]: value }))
  }

  const updateItem = <K extends keyof InvoiceItemForm>(
    id: string,
    key: K,
    value: InvoiceItemForm[K]
  ) => {
    if (mainFieldsDisabled) return

    setItems((prev) =>
      prev.map((item) => {
        if (item.id !== id) return item

        if (key === "discountPercentage") {
          return {
            ...item,
            discountAmount: 0,
            discountPercentage: normalizePercent(value),
          }
        }

        if (key === "discountAmount") {
          const nextDiscountAmount = Math.max(0, Number(value || 0))

          return {
            ...item,
            discountAmount: nextDiscountAmount,
            discountPercentage:
              nextDiscountAmount > 0 ? 0 : item.discountPercentage,
          }
        }

        if (key === "product") {
          const product = value as Product | null

          return {
            ...item,
            product,
            productCode: product?.inv_itemCode || "",
            productName: product?.inv_itemName || "",
            unit: product?.inv_unitCode || "kg",
            quantity: Number(product?.inv_quantity || item.quantity || 1),
            unitPrice:
              item.type === "Tặng" ? 0 : Number(product?.inv_unitPrice || 0),
            taxRate: normalizeInvoiceTaxCode(product?.ma_thue),
            discountAmount: item.discountAmount || 0,
            discountPercentage: normalizePercent(item.discountPercentage),
            accountingAccountCode: String(
              (product as any)?.accountingAccountCode ||
                (product as any)?.accountCode ||
                (product as any)?.inv_accountCode ||
                ""
            ),
          }
        }

        if (key === "type") {
          return {
            ...item,
            type: String(value),
            unitPrice: String(value) === "Tặng" ? 0 : item.unitPrice,
            discountAmount: String(value) === "Tặng" ? 0 : item.discountAmount,
          }
        }

        return { ...item, [key]: value }
      })
    )
  }

  const addItem = () => {
    if (mainFieldsDisabled) return

    setItems((prev) => [
      ...prev,
      {
        id: createItemId(),
        product: null,
        productCode: "",
        productName: "",
        unit: "kg",
        quantity: 1,
        type: "Mới",
        unitPrice: 0,
        discountAmount: 0,
        discountPercentage: getAgencyDiscountPercentage(selectedAgency),
        taxRate: "0",
        invReconciliation: null,
        capitalPrice: 0,
        totalSalary: 0,
        accountingAccountCode: "",
      },
    ])
  }

  const removeItem = (id: string) => {
    if (mainFieldsDisabled) return

    setItems((prev) => {
      if (prev.length <= 1) return prev
      return prev.filter((item) => item.id !== id)
    })
  }

  const copyItem = (id: string) => {
    if (mainFieldsDisabled) return

    const source = items.find((item) => item.id === id)
    if (!source) return

    setItems((prev) => [...prev, { ...source, id: createItemId() }])
  }
  const handlePaidChange = (checked: boolean) => {
    if (paymentFieldsDisabled) return

    setGeneral((prev) => ({
      ...prev,
      isPaid: checked,
      paidAmount: checked ? roundInvoiceMoney(totalPayment) : 0,
      paidDate: prev.paidDate || today,
    }))
  }

  const buildPayload = () => {
    const validItems = computedItems.filter(
      (item) =>
        getId(item.product) && item.productName && Number(item.quantity) > 0
    )

    const agencyId = getId(general.agency)
    const employeeId = getId(general.employee)
    const nextFieldErrors: InvoiceFieldErrors = {}

    if (!general.symbol.trim()) {
      showErrorMessage("Vui lòng chọn cấu hình hóa đơn.")
      return null
    }

    if (!agencyId) {
      showErrorMessage("Vui lòng chọn đại lý.")
      return null
    }

    const buyerEmail = general.email.trim()

    const buyerTaxCode = general.taxCode.trim()

    if (!buyerTaxCode) {
      nextFieldErrors.taxCode = taxCodeRequiredMessage
    } else if (!taxCodePattern.test(buyerTaxCode)) {
      nextFieldErrors.taxCode = taxCodeInvalidMessage
    }

    if (!buyerEmail) {
      nextFieldErrors.email = emailRequiredMessage
    } else if (!emailPattern.test(buyerEmail)) {
      nextFieldErrors.email = emailInvalidMessage
    }
    if (nextFieldErrors.taxCode || nextFieldErrors.email) {
      setFieldErrors(nextFieldErrors)
      showErrorMessage(
        nextFieldErrors.taxCode ||
          nextFieldErrors.email ||
          "Vui lòng kiểm tra thông tin."
      )
      return null
    }

    setFieldErrors({})

    if (general.isPaid && !general.paidDate) {
      showErrorMessage("Vui lòng chọn ngày thu tiền.")
      return null
    }

    if (!general.companyName.trim()) {
      showErrorMessage("Vui lòng nhập Tên công ty.")
      return null
    }

    if (!general.address.trim()) {
      showErrorMessage("Vui lòng nhập Địa chỉ.")
      return null
    }

    if (!validItems.length) {
      showErrorMessage("Vui lòng nhập ít nhất 1 dòng chi tiết chứng từ.")
      return null
    }

    const invoiceDiscountPercentage = normalizePercent(
      validItems[0]?.discountPercentage || 0
    )

    return {
      inv_invoiceSeries: activeReceiptSeries,
      activationDate: general.invoiceDate || null,
      inv_currencyCode: general.currency,
      inv_exchangeRate: Number(general.exchangeRate || 1),
      inv_paymentMethodName: general.paymentMethod,
      invReconciliation: String(roundInvoiceMoney(totalInvReconciliation)),

      agencyId,
      employeeId: employeeId || undefined,
      amountCollected: effectivePaidAmount,
      paidDate: general.isPaid ? general.paidDate : null,

      inv_buyerTaxCode: buyerTaxCode,
      inv_buyerLegalName: general.companyName.trim(),
      inv_buyerDisplayName: general.companyName.trim(),
      inv_buyerEmail: buyerEmail,
      inv_buyerAddressLine: general.address.trim(),
      inv_buyerBankAccount: "",
      inv_buyerBankName: selectedBank?.inv_buyerBankName || "",

      so_benh_an: "",
      key_api: "",
      cccdan: "",
      so_hchieu: "",
      mdvqhnsach_nmua: "",
      ma_ch: "",
      ten_ch: "",

      inv_discountAmount: roundInvoiceMoney(totalDiscountAmount),
      inv_TotalAmountWithoutVAT: roundInvoiceMoney(totalBeforeTax),
      inv_vatAmount: roundInvoiceMoney(totalTax),
      inv_TotalAmount: roundInvoiceMoney(totalPayment),
      inv_quantity: validItems.reduce(
        (sum, item) => sum + Number(item.quantity || 0),
        0
      ),
      inv_discountPercentage: roundInvoiceMoney(invoiceDiscountPercentage),
      items: validItems.map((item) => ({
        productId: getId(item.product),
        product: item.product,
        productCode: item.productCode,
        productName: item.productName,
        unit: item.unit,
        quantity: item.quantity,
        inv_quantity: item.quantity,
        price: roundInvoiceMoney(item.price || item.unitPrice || 0),
        unitPrice: roundInvoiceMoney(item.price || item.unitPrice || 0),
        inv_unitPrice: roundInvoiceMoney(item.invUnitPrice || 0),
        ma_thue: item.ma_thue,
        taxRate: item.taxRate,
        discountPercentage: roundInvoiceMoney(item.discountPercentage || 0),
        // Khớp schema BE hiện tại của TransactionItem.
        revenue: roundInvoiceMoney(item.revenue || 0),
        capitalPrice: Number(item.capitalPrice || 0),
        totalSalary: roundInvoiceMoney(item.totalSalary || item.revenue || 0),
        accountingAccountCode: Number(item.accountingAccountCode || 0),
      })),
    }
  }

  const handleSave = async () => {
    if (isCancelledInvoice) {
      showErrorMessage("Hóa đơn đã hủy, không thể chỉnh sửa.")
      return
    }

    if (isIssuingInvoice) {
      showErrorMessage("Hóa đơn đang xuất, vui lòng chờ hệ thống xử lý xong.")
      return
    }

    const payload = buildPayload()
    if (!payload) return

    try {
      setSaveLoading(true)

      await onSaved?.(payload)

      showSuccessMessage(
        mode === "edit" ? "Cập nhật hoá đơn thành công." : "Tạo hoá đơn thành công."
      )

      setTimeout(() => {
        onBack()
      }, 700)
    } catch (err: any) {
      console.error("SAVE_INVOICE_ERROR", {
        mode,
        initialInvoiceId: initialInvoice?._id || null,
        error: err,
        response: err?.response?.data,
      })

      const message =
        err?.response?.data?.message ||
        err?.response?.data?.error ||
        err?.message ||
        "Lưu hóa đơn thất bại."

      showErrorMessage(message)
    } finally {
      setSaveLoading(false)
    }
  }

  const openExportInvoiceDateDialog = () => {
    if (exportInvoiceLoading || !canExportInvoice) return

    if (exportInvoiceMinDate && exportInvoiceMinDate > exportInvoiceMaxDate) {
      showErrorMessage("Không có ngày xuất hóa đơn hợp lệ.")
      return
    }

    setSelectedExportInvoiceDate(exportInvoiceMaxDate || today)
    setExportDateDialogOpen(true)
  }

  const handleConfirmExportInvoiceDate = async () => {
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
    await handleExportInvoice(selectedExportInvoiceDate)
  }

  const handleExportInvoice = async (exportInvoiceIssuedDate: string) => {
    if (!initialInvoice?._id) {
      showErrorMessage("Không tìm thấy ID giao dịch bán hàng để xuất hóa đơn.")
      return
    }

    if (!canExportInvoice) {
      showErrorMessage(
        "Chỉ hóa đơn nháp hoặc xuất thất bại mới được xuất hóa đơn."
      )
      return
    }

    const invoiceSeries = String(activeReceiptSeries || general.symbol).trim()

    if (!invoiceSeries) {
      showErrorMessage("Chưa có ký hiệu hóa đơn từ cấu hình.")
      return
    }

    if (!activeReceiptTaxCode) {
      showErrorMessage("Chưa có mã số thuế từ cấu hình hóa đơn.")
      return
    }

    const payload = {
      saleTransactionId: initialInvoice._id,
      inv_invoiceSeries: invoiceSeries,
      inv_invoiceIssuedDate: exportInvoiceIssuedDate,
      editmode: 1,
    }
    const fallbackRow: InvoiceApiRow = {
      ...initialInvoice,
      inv_invoiceSeries: invoiceSeries,
      inv_invoiceIssuedDate: exportInvoiceIssuedDate,
      invoiceStatus: InvoiceStatus.ISSUING,
    }

    try {
      setExportInvoiceLoading(true)

      const response = await APIExportMInvoiceReceiptPost(
        payload,
        activeReceiptTaxCode
      )
      const exportResult = (await onExported?.(
        initialInvoice._id,
        response,
        fallbackRow
      )) as any
      const responseContent = response?.content
      const responseInfo = String(response?.info || responseContent?.info || "")
        .trim()
        .toUpperCase()
      const responseCode = Number(
        response?.code ?? response?.statusCode ?? response?.status ?? NaN
      )
      const responseJobId = String(
        response?.jobId || responseContent?.jobId || ""
      ).trim()
      const responseMessage = String(
        exportResult?.source?.message ||
          response?.message ||
          responseContent?.message ||
          ""
      ).trim()
      const status =
        normalizeInvoiceStatusValue(exportResult?.status) ||
        normalizeInvoiceStatusValue(
          response?.invoiceStatus || responseContent?.invoiceStatus
        ) ||
        (responseInfo === "FAIL" ||
        responseInfo === "FAILED" ||
        responseCode >= 400
          ? InvoiceStatus.FAILED
          : null) ||
        (responseJobId || responseInfo === "PROCESSING" || responseCode === 202
          ? InvoiceStatus.ISSUING
          : null)

      if (!status && !responseContent) {
        showErrorMessage("Không nhận được kết quả xuất hóa đơn từ hệ thống.")
        return
      }

      if (status === InvoiceStatus.FAILED) {
        showErrorMessage(responseMessage || "Xuất hóa đơn thất bại.")
        return
      }

      if (status === InvoiceStatus.ISSUED) {
        showSuccessMessage("Đã xuất hóa đơn thành công.")
        return
      }

      return
    } catch (err: any) {
      console.error("EXPORT_M_INVOICE_ERROR", {
        saleTransactionId: initialInvoice._id,
        payload,
        taxCode: activeReceiptTaxCode,
        error: err,
        response: err?.response?.data,
      })

      const errorBody = err?.response?.data
      const errorContent = errorBody?.content
      const errorStatus =
        normalizeInvoiceStatusValue(
          errorBody?.invoiceStatus || errorContent?.invoiceStatus
        ) || InvoiceStatus.FAILED
      const errorMessage = String(
        errorBody?.message ||
          errorContent?.message ||
          errorBody?.error ||
          err?.message ||
          "Xuất hóa đơn thất bại."
      ).trim()

      await onExported?.(
        initialInvoice._id,
        {
          ...(errorBody && typeof errorBody === "object" ? errorBody : {}),
          code: errorBody?.code || err?.response?.status || 500,
          info:
            errorBody?.info ||
            (errorStatus === InvoiceStatus.FAILED ? "FAIL" : "PROCESSING"),
          message: errorMessage,
          invoiceStatus: errorStatus,
        },
        {
          ...fallbackRow,
          invoiceStatus: errorStatus,
        }
      )
      if (errorStatus === InvoiceStatus.ISSUING) {
        return
      }

      showErrorMessage(errorMessage || "Xuất hóa đơn thất bại.")
    } finally {
      setExportInvoiceLoading(false)
    }
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-[#edf1f4]">
      <div className="flex items-center justify-between border-b border-slate-300 bg-white px-4 py-2">
        <div className="text-[15px] font-bold text-slate-800">
          {mode === "detail"
            ? "Chi tiết Hóa đơn "
            : mode === "edit"
              ? "Sửa Hóa đơn "
              : "Tạo mới Hóa đơn "}
        </div>

        <button
          onClick={handleCancelClick}
          className="flex h-8 w-8 items-center justify-center rounded-full border border-slate-300 text-xl text-slate-500 hover:bg-slate-100"
        >
          ×
        </button>
      </div>

      <div className="flex-1 overflow-auto p-4">
        <section className="rounded border border-slate-300 bg-white p-3">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div className="text-sm font-bold text-slate-800">
              Thông tin chung
            </div>

            <span
              className={`rounded-full border px-3 py-1 text-xs font-semibold ${invoiceStatusClass[invoiceStatus]}`}
            >
              {invoiceStatusDisplayLabel}
            </span>
          </div>

          <div className="mb-3 flex flex-wrap items-center gap-3 rounded border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
            <div className="flex items-center gap-2">
              <span>Ký hiệu:</span>
              {(receiptConfigLocked || effectiveReceiptConfigs.length === 1) &&
              effectiveReceiptConfig ? (
                <span className="inline-flex min-h-8 min-w-[280px] items-center rounded-md border border-indigo-200 bg-white px-3 py-1 text-xs font-semibold text-slate-700">
                  {formatReceiptConfigLabel(effectiveReceiptConfig)}
                </span>
              ) : (
                <SearchableSelect
                  options={receiptConfigSelectOptions}
                  value={receiptConfigSelectValue}
                  onChange={handleReceiptConfigSelect}
                  placeholder={
                    receiptConfigs.length ? "Chọn ký hiệu" : "Chưa có ký hiệu"
                  }
                  searchPlaceholder="Tìm ký hiệu..."
                  emptyText="Không tìm thấy ký hiệu"
                  disabled={
                    mainFieldsDisabled || !effectiveReceiptConfigs.length
                  }
                  className={receiptConfigSelectClass}
                />
              )}
            </div>

            <Link
              href="/quan-ly-ban-hang/cau-hinh-hoa-don"
              className="ml-auto inline-flex h-7 items-center justify-center rounded-md border border-slate-300 bg-white px-3 text-xs font-semibold text-slate-700 transition hover:bg-slate-100"
            >
              Cấu hình
            </Link>
          </div>

          <div className="grid gap-3 xl:grid-cols-4">
            <div>
              <label className="mb-1 block text-[13px] font-medium text-slate-600">
                Ngày kích hoạt
              </label>
              <input
                className={inputClass}
                type="date"
                value={general.invoiceDate}
                disabled={invoiceDateFieldDisabled}
                onChange={(e) => updateGeneral("invoiceDate", e.target.value)}
              />
            </div>

            <div>
              <label className="mb-1 block text-[13px] font-medium text-slate-600">
                Đại lý
              </label>
              <SearchableSelect
                options={agencySelectOptions}
                value={general.agency?._id || ""}
                onChange={(value) => {
                  const agency =
                    agencyOptions.find((item) => item._id === value) || null
                  updateGeneral("agency", agency)
                }}
                placeholder="Chọn đại lý"
                searchPlaceholder="Tìm đại lý..."
                emptyText="Không tìm thấy đại lý"
                disabled={catalogLoading || mainFieldsDisabled}
                className={invoiceSelectClass}
              />
            </div>

            <div>
              <label className="mb-1 block text-[13px] font-medium text-slate-600">
                Phòng ban
              </label>
              <SearchableSelect
                options={departmentSelectOptions}
                value={general.department?._id || ""}
                onChange={(value) => {
                  const department =
                    departmentOptions.find((item) => item._id === value) || null
                  updateGeneral("department", department)
                }}
                placeholder="Chọn phòng ban"
                searchPlaceholder="Tìm phòng ban..."
                emptyText="Không tìm thấy phòng ban"
                disabled={catalogLoading || mainFieldsDisabled}
                className={invoiceSelectClass}
              />
            </div>

            <div>
              <label className="mb-1 block text-[13px] font-medium text-slate-600">
                NVKD
              </label>
              <SearchableSelect
                options={employeeSelectOptions}
                value={general.employee?._id || ""}
                onChange={(value) => {
                  const employee =
                    employeeOptions.find((item) => item._id === value) || null

                  updateGeneral("employee", employee)
                }}
                placeholder="Chọn nhân viên"
                searchPlaceholder="Tìm nhân viên..."
                emptyText="Không tìm thấy nhân viên"
                disabled={catalogLoading || mainFieldsDisabled}
                className={invoiceSelectClass}
              />
            </div>

            <div>
              <label className="mb-1 block text-[13px] font-medium text-slate-600">
                MST
                <span className="ml-0.5 text-red-500">*</span>
              </label>
              <div className="flex gap-2">
                <input
                  className={`${inputClass} min-w-0 flex-1 ${
                    fieldErrors.taxCode
                      ? "border-red-400 focus:border-red-500"
                      : ""
                  }`}
                  value={general.taxCode}
                  disabled={mainFieldsDisabled}
                  onFocus={() => {
                    if (!general.taxCode.trim()) {
                      setFieldErrors((prev) => ({
                        ...prev,
                        taxCode: taxCodeRequiredMessage,
                      }))
                    }
                  }}
                  onChange={(e) => {
                    const rawTaxCode = e.target.value
                      .replace(/[^\d-]/g, "")
                      .slice(0, 17)
                    const [mainTaxCode, ...branchTaxCodeParts] =
                      rawTaxCode.split("-")
                    const branchTaxCode = branchTaxCodeParts
                      .join("")
                      .replace(/\D/g, "")
                      .slice(0, 3)
                    const nextTaxCode = branchTaxCodeParts.length
                      ? `${mainTaxCode.slice(0, 13)}-${branchTaxCode}`
                      : mainTaxCode.slice(0, 13)

                    updateGeneral("taxCode", nextTaxCode)

                    setFieldErrors((prev) => ({
                      ...prev,
                      taxCode: getTaxCodeError(nextTaxCode) || undefined,
                    }))
                  }}
                  onBlur={() => validateRequiredField("taxCode")}
                  onKeyDown={(e) => {
                    if (e.key !== "Enter") return

                    e.preventDefault()
                    void handleLookupCompanyInfo()
                  }}
                  placeholder="Nhập MST"
                  inputMode="text"
                  maxLength={17}
                  required
                  aria-required="true"
                  aria-invalid={Boolean(fieldErrors.taxCode)}
                  aria-describedby={
                    fieldErrors.taxCode ? "invoice-tax-code-error" : undefined
                  }
                />

                <button
                  type="button"
                  onClick={() => void handleLookupCompanyInfo()}
                  disabled={mainFieldsDisabled || companyInfoLoading}
                  className="inline-flex h-8 shrink-0 items-center justify-center gap-1.5 rounded border border-blue-200 bg-blue-50 px-3 text-xs font-semibold text-blue-700 transition hover:border-blue-300 hover:bg-blue-100 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {companyInfoLoading ? (
                    <Loader2 size={14} className="animate-spin" />
                  ) : (
                    <Search size={14} />
                  )}
                  Tra cứu
                </button>
              </div>
              {fieldErrors.taxCode && (
                <p
                  id="invoice-tax-code-error"
                  className="mt-1 text-xs font-medium text-red-600"
                >
                  {fieldErrors.taxCode}
                </p>
              )}
            </div>

            <div>
              <label className="mb-1 block text-[13px] font-medium text-slate-600">
                Tên cty
                <span className="ml-0.5 text-red-500">*</span>
              </label>
              <input
                className={inputClass}
                value={general.companyName}
                disabled={mainFieldsDisabled}
                onChange={(e) => updateGeneral("companyName", e.target.value)}
                placeholder="Nhập tên công ty"
              />
            </div>

            <div>
              <label className="mb-1 block text-[13px] font-medium text-slate-600">
                Email
                <span className="ml-0.5 text-red-500">*</span>
              </label>
              <input
                type="email"
                className={`${inputClass} ${
                  fieldErrors.email ? "border-red-400 focus:border-red-500" : ""
                }`}
                value={general.email}
                disabled={mainFieldsDisabled}
                onFocus={() => {
                  if (!general.email.trim()) {
                    setFieldErrors((prev) => ({
                      ...prev,
                      email: emailRequiredMessage,
                    }))
                  }
                }}
                onChange={(e) => {
                  const nextEmail = e.target.value

                  updateGeneral("email", nextEmail)

                  setFieldErrors((prev) => ({
                    ...prev,
                    email: getEmailError(nextEmail) || undefined,
                  }))
                }}
                onBlur={() => validateRequiredField("email")}
                placeholder="Email xuất hóa đơn"
                inputMode="email"
                autoComplete="email"
                required
                aria-required="true"
                aria-invalid={Boolean(fieldErrors.email)}
                aria-describedby={
                  fieldErrors.email ? "invoice-email-error" : undefined
                }
              />
              {fieldErrors.email && (
                <p
                  id="invoice-email-error"
                  className="mt-1 text-xs font-medium text-red-600"
                >
                  {fieldErrors.email}
                </p>
              )}
            </div>

            <div className="xl:col-span-2">
              <label className="mb-1 block text-[13px] font-medium text-slate-600">
                Địa chỉ
                <span className="ml-0.5 text-red-500">*</span>
              </label>
              <input
                className={inputClass}
                value={general.address}
                disabled={mainFieldsDisabled}
                onChange={(e) => updateGeneral("address", e.target.value)}
                placeholder="Địa chỉ xuất hóa đơn"
              />
            </div>

            <div>
              <label className="mb-1 block text-[13px] font-medium text-slate-600">
                Đã thu tiền
              </label>
              <label className="flex h-8 items-center gap-2 rounded border border-slate-300 bg-white px-2 text-[13px]">
                <input
                  type="checkbox"
                  checked={general.isPaid}
                  disabled={paymentFieldsDisabled}
                  onChange={(e) => handlePaidChange(e.target.checked)}
                />
                Xác nhận đã thu
              </label>
            </div>

            <div>
              <label className="mb-1 block text-[13px] font-medium text-slate-600">
                Thu tiền
              </label>
              <input
                className={`${inputClass} text-right`}
                value={general.paidAmount}
                disabled={paymentFieldsDisabled || !general.isPaid}
                onChange={(e) =>
                  updateGeneral("paidAmount", toNumber(e.target.value))
                }
                placeholder="Số tiền đã thu"
              />
              {general.isPaid && !paymentFieldsDisabled && (
                <div className="mt-1 text-xs text-emerald-600">
                  Đã thu tiền: mặc định bằng tổng tiền dòng hàng.
                </div>
              )}
            </div>

            <div>
              <label className="mb-1 block text-[13px] font-medium text-slate-600">
                Ngày thu tiền
              </label>
              <input
                className={inputClass}
                type="date"
                value={general.paidDate}
                disabled={paymentFieldsDisabled}
                onChange={(e) => updateGeneral("paidDate", e.target.value)}
              />
            </div>

            <div>
              <label className="mb-1 block text-[13px] font-medium text-slate-600">
                Ngân hàng
              </label>
              <SearchableSelect
                options={bankSelectOptions}
                value={general.bank?._id || ""}
                onChange={(value) => {
                  const bank =
                    bankOptions.find((item) => item._id === value) || null
                  updateGeneral("bank", bank)
                }}
                placeholder="Chọn ngân hàng"
                searchPlaceholder="Tìm ngân hàng..."
                emptyText="Không tìm thấy ngân hàng"
                disabled={bankFieldDisabled}
                className={invoiceSelectClass}
              />
            </div>
          </div>
        </section>

        {!mainFieldsDisabled && (
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <button
              onClick={addItem}
              className="h-8 rounded border border-indigo-400 bg-indigo-50 px-3 text-sm font-medium text-indigo-700 hover:bg-indigo-100"
            >
              ＋ Thêm dòng (F9)
            </button>

            <button
              onClick={() => items[0] && removeItem(items[0].id)}
              className="h-8 rounded border border-red-300 bg-red-50 px-3 text-sm font-medium text-red-600 hover:bg-red-100"
            >
              🗑 Xóa dòng (F8)
            </button>

            <button
              onClick={() => items[0] && copyItem(items[0].id)}
              className="h-8 rounded border border-emerald-300 bg-emerald-50 px-3 text-sm font-medium text-emerald-700 hover:bg-emerald-100"
            >
              ⎘ Sao chép (F7)
            </button>

            <button
              onClick={addItem}
              className="h-8 rounded border border-blue-300 bg-blue-50 px-3 text-sm font-medium text-blue-700 hover:bg-blue-100"
            >
              → Chèn dòng (Ins)
            </button>
          </div>
        )}

        <div className="mt-2 overflow-auto rounded border border-slate-300 bg-white">
          <table className="w-max min-w-full border-collapse text-[13px]">
            <thead>
              <tr className="bg-[#b7e1a1] text-slate-900">
                <th className="w-[44px] min-w-[44px] border-b border-r border-slate-300 px-2 py-2 text-center">
                  ✓
                </th>
                <th className="w-[60px] min-w-[60px] border-b border-r border-slate-300 px-2 py-2 text-center">
                  STT
                </th>
                <th className="min-w-[280px] border-b border-r border-slate-300 px-2 py-2 text-left">
                  Mã hàng
                </th>
                <th className="min-w-[260px] border-b border-r border-slate-300 px-2 py-2 text-left">
                  Tên hàng
                </th>
                <th className="min-w-[110px] border-b border-r border-slate-300 px-2 py-2 text-right">
                  Số lượng
                </th>
                <th className="min-w-[130px] border-b border-r border-slate-300 px-2 py-2 text-left">
                  Loại
                </th>
                <th className="min-w-[170px] border-b border-r border-slate-300 px-2 py-2 text-right">
                  Đơn giá
                </th>
                <th className="min-w-[160px] border-b border-r border-slate-300 px-2 py-2 text-right">
                  Tổng tiền hàng
                </th>
                <th className="min-w-[110px] border-b border-r border-slate-300 px-2 py-2 text-right">
                  Thuế suất
                </th>
                <th className="min-w-[130px] border-b border-r border-slate-300 px-2 py-2 text-right">
                  % chiết khấu
                </th>
                <th className="min-w-[150px] border-b border-r border-slate-300 px-2 py-2 text-right">
                  Tiền chiết khấu
                </th>
                <th className="min-w-[150px] border-b border-r border-slate-300 px-2 py-2 text-right">
                  Giá đối soát
                </th>
                {!mainFieldsDisabled && (
                  <th className="min-w-[90px] border-b border-slate-300 px-2 py-2 text-center">
                    Thao tác
                  </th>
                )}
              </tr>
            </thead>

            <tbody>
              {computedItems.map((item, index) => (
                <tr key={item.id} className="hover:bg-blue-50">
                  <td className="border-b border-r border-slate-200 px-2 py-2 text-center">
                    <input
                      type="checkbox"
                      defaultChecked
                      disabled={mainFieldsDisabled}
                    />
                  </td>

                  <td className="border-b border-r border-slate-200 px-2 py-2 text-center">
                    {index + 1}
                  </td>

                  <td className="min-w-[280px] border-b border-r border-slate-200 px-2 py-2">
                    <SearchableSelect
                      options={productCodeSelectOptions}
                      value={item.product?._id || ""}
                      onChange={(value) => {
                        const product =
                          productOptions.find(
                            (productItem) => productItem._id === value
                          ) || null

                        updateItem(item.id, "product", product)
                      }}
                      placeholder="Chọn mã hàng"
                      searchPlaceholder="Tìm mã hàng..."
                      emptyText="Không tìm thấy mã hàng"
                      disabled={catalogLoading || mainFieldsDisabled}
                      className={productCodeSelectClass}
                      contentClassName={productCodeSelectContentClass}
                    />
                  </td>

                  <td className="border-b border-r border-slate-200 px-2 py-2">
                    <input
                      className={inputClass}
                      value={item.productName}
                      disabled={mainFieldsDisabled}
                      onChange={(e) =>
                        updateItem(item.id, "productName", e.target.value)
                      }
                    />
                  </td>

                  <td className="border-b border-r border-slate-200 px-2 py-2">
                    <input
                      className={`${inputClass} text-right`}
                      value={item.quantity}
                      disabled={mainFieldsDisabled}
                      onChange={(e) =>
                        updateItem(
                          item.id,
                          "quantity",
                          toNumber(e.target.value)
                        )
                      }
                    />
                  </td>

                  <td className="border-b border-r border-slate-200 px-2 py-2">
                    <SearchableSelect
                      options={itemTypeOptions}
                      value={item.type}
                      onChange={(value) => updateItem(item.id, "type", value)}
                      placeholder="Chọn loại"
                      searchPlaceholder="Tìm loại..."
                      emptyText="Không tìm thấy loại"
                      disabled={mainFieldsDisabled}
                      className={invoiceSelectClass}
                    />
                  </td>

                  <td className="border-b border-r border-slate-200 px-2 py-2">
                    <input
                      className={`${inputClass} text-right`}
                      value={item.unitPrice}
                      disabled={mainFieldsDisabled || item.type === "Tặng"}
                      onChange={(e) =>
                        updateItem(
                          item.id,
                          "unitPrice",
                          toNumber(e.target.value)
                        )
                      }
                    />
                  </td>

                  <td className="border-b border-r border-slate-200 px-2 py-2 text-right font-semibold">
                    {formatMoney(item.amount)}
                  </td>

                  <td className="border-b border-r border-slate-200 px-2 py-2 text-right">
                    <input
                      className={`${inputClass} bg-slate-50 text-right`}
                      value={item.taxRate}
                      disabled
                      readOnly
                    />
                  </td>

                  <td className="border-b border-r border-slate-200 px-2 py-2">
                    <input
                      className={`${inputClass} text-right`}
                      value={item.discountPercentage}
                      disabled={mainFieldsDisabled}
                      onChange={(e) =>
                        updateItem(
                          item.id,
                          "discountPercentage",
                          normalizePercent(toNumber(e.target.value))
                        )
                      }
                      placeholder="%"
                    />
                  </td>
                  <td className="border-b border-r border-slate-200 px-2 py-2">
                    <input
                      className={`${inputClass} text-right`}
                      value={item.discountAmount}
                      disabled={mainFieldsDisabled || mode !== "create"}
                      onChange={(e) =>
                        updateItem(
                          item.id,
                          "discountAmount",
                          toNumber(e.target.value)
                        )
                      }
                      placeholder="0"
                    />
                  </td>
                  <td className="border-b border-r border-slate-200 px-2 py-2">
                    <input
                      className={`${inputClass} text-right`}
                      value={item.invReconciliation}
                      disabled={mainFieldsDisabled}
                      onChange={(e) =>
                        updateItem(
                          item.id,
                          "invReconciliation",
                          toNumber(e.target.value)
                        )
                      }
                      placeholder="0"
                    />
                  </td>

                  {!mainFieldsDisabled && (
                    <td className="border-b border-slate-200 px-2 py-2 text-center">
                      <button
                        onClick={() => removeItem(item.id)}
                        className="rounded border border-red-300 px-2 py-1 text-xs text-red-600 hover:bg-red-50"
                      >
                        Xóa
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="mt-4 rounded border border-slate-300 bg-white p-3">
          <div className="mb-2 text-sm font-bold text-slate-700">Tổng cộng</div>

          <div className="grid gap-3 lg:grid-cols-5">
            <div>
              <label className="mb-1 block text-[13px] text-slate-500">
                Tổng tiền hàng
              </label>
              <div className="rounded border border-slate-300 bg-slate-50 px-3 py-2 text-right font-semibold">
                {formatMoney(totalBeforeTax)}
              </div>
            </div>

            <div>
              <label className="mb-1 block text-[13px] text-slate-500">
                Tổng tiền thuế
              </label>
              <div className="rounded border border-slate-300 bg-slate-50 px-3 py-2 text-right font-semibold">
                {formatMoney(totalTax)}
              </div>
            </div>

            <div>
              <label className="mb-1 block text-[13px] text-slate-500">
                Tổng tiền thanh toán
              </label>
              <div className="rounded border border-slate-300 bg-slate-50 px-3 py-2 text-right font-bold text-indigo-700">
                {formatMoney(totalPayment)}
              </div>
            </div>

            <div>
              <label className="mb-1 block text-[13px] text-slate-500">
                Tổng doanh thu
              </label>
              <div className="rounded border border-slate-300 bg-slate-50 px-3 py-2 text-right font-bold text-blue-700">
                {formatMoney(totalRevenue)}
              </div>
            </div>

            <div>
              <label className="mb-1 block text-[13px] text-slate-500">
                Tổng tiền bằng chữ
              </label>
              <div className="rounded border border-slate-300 bg-slate-50 px-3 py-2 font-semibold">
                {numberToVietnamese(totalPayment)}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="flex justify-center gap-2 border-t border-slate-300 bg-white px-4 py-3">
        {mode === "detail" ? (
          <>
            <button
              onClick={onBack}
              className="rounded border border-slate-400 bg-white px-5 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Đóng
            </button>

            <button
              onClick={onEdit}
              disabled={isCancelledInvoice || isIssuingInvoice}
              className="rounded border border-indigo-500 bg-indigo-50 px-5 py-2 text-sm font-semibold text-indigo-700 hover:bg-indigo-100 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Sửa
            </button>

            {(alreadyExported ||
              (isIssuingInvoice &&
                Boolean(initialInvoice?.inv_invoiceCreatedId))) &&
            initialInvoice &&
            onUpdateMInvoice ? (
              <button
                onClick={() => {
                  void onUpdateMInvoice(initialInvoice)
                }}
                disabled={updateMInvoiceLoading || isIssuingInvoice}
                className="inline-flex items-center justify-center gap-2 rounded border border-blue-500 bg-blue-50 px-5 py-2 text-sm font-semibold text-blue-700 hover:bg-blue-100 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {updateMInvoiceLoading || isIssuingInvoice ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    Đang cập nhật...
                  </>
                ) : (
                  "Cập nhật hóa đơn"
                )}
              </button>
            ) : (
              <button
                onClick={openExportInvoiceDateDialog}
                disabled={
                  exportInvoiceLoading || isIssuingInvoice || !canExportInvoice
                }
                className="inline-flex items-center justify-center gap-2 rounded border border-emerald-500 bg-emerald-50 px-5 py-2 text-sm font-semibold text-emerald-700 hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isCancelledInvoice ? (
                  "Hóa đơn đã hủy"
                ) : alreadyExported ? (
                  "Đã xuất hóa đơn"
                ) : exportInvoiceLoading || isIssuingInvoice ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    Đang xuất...
                  </>
                ) : invoiceStatus === InvoiceStatus.FAILED ? (
                  "Xuất lại hóa đơn"
                ) : (
                  "Xuất hóa đơn"
                )}
              </button>
            )}
          </>
        ) : mode === "edit" ? (
          <>
            <button
              onClick={handleCancelAction}
              disabled={saveLoading}
              className="rounded border border-slate-400 bg-white px-5 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Hủy
            </button>

            <button
              onClick={handleSave}
              disabled={saveLoading}
              className="inline-flex min-w-[76px] items-center justify-center rounded bg-indigo-600 px-5 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {saveLoading ? (
                <>
                  <Loader2 size={17} className="animate-spin" />
                  <span className="sr-only">Đang lưu</span>
                </>
              ) : (
                "Lưu"
              )}
            </button>
          </>
        ) : (
          <>
            <button
              onClick={onBack}
              disabled={saveLoading}
              className="rounded border border-slate-400 bg-white px-5 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Hủy
            </button>

            <button
              onClick={handleSave}
              disabled={saveLoading}
              className="inline-flex min-w-[76px] items-center justify-center rounded bg-indigo-600 px-5 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {saveLoading ? (
                <>
                  <Loader2 size={17} className="animate-spin" />
                  <span className="sr-only">Đang lưu</span>
                </>
              ) : (
                "Lưu"
              )}
            </button>
          </>
        )}
      </div>

      {exportDateDialogOpen && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-950/50 p-4">
          <div className="w-full max-w-md rounded-lg border border-slate-200 bg-white shadow-xl">
            <div className="border-b border-slate-100 px-5 py-4">
              <h3 className="text-base font-bold text-slate-900">
                Chọn ngày xuất hóa đơn
              </h3>
            </div>

            <div className="space-y-3 px-5 py-4">
              <label
                htmlFor="invoice-form-export-date"
                className="block text-sm font-medium text-slate-700"
              >
                Ngày xuất hóa đơn
              </label>
              <input
                id="invoice-form-export-date"
                className={inputClass}
                type="date"
                value={selectedExportInvoiceDate}
                min={exportInvoiceMinDate || undefined}
                max={exportInvoiceMaxDate}
                disabled={exportInvoiceLoading}
                onChange={(e) => setSelectedExportInvoiceDate(e.target.value)}
              />
              <p className="text-xs text-slate-500">
                Ngày hợp lệ: {exportInvoiceMinDate || "..."} -{" "}
                {exportInvoiceMaxDate}
              </p>
            </div>

            <div className="flex justify-end gap-2 border-t border-slate-100 px-5 py-4">
              <button
                type="button"
                onClick={() => setExportDateDialogOpen(false)}
                disabled={exportInvoiceLoading}
                className="rounded border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={() => void handleConfirmExportInvoiceDate()}
                disabled={exportInvoiceLoading}
                className="rounded bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {exportInvoiceLoading ? "Đang xuất..." : "Xuất hóa đơn"}
              </button>
            </div>
          </div>
        </div>
      )}

      <AlertOption
        isOpen={isCancelDialogOpen}
        onOpenChange={setCancelDialogOpen}
        onConfirm={() => {
          setCancelDialogOpen(false)
          handleCancelAction()
        }}
        title="Xác nhận hủy thao tác"
        description={
          mode === "edit"
            ? "Các thay đổi chưa lưu sẽ bị mất. Bạn có chắc chắn muốn hủy chỉnh sửa?"
            : "Dữ liệu đang nhập sẽ bị mất. Bạn có chắc chắn muốn hủy tạo hóa đơn?"
        }
        confirmText="Đồng ý"
        cancelText="Ở lại"
        tone="destructive"
      />

      {showSuccess && <AlertSuccess description={message} />}
      {showError && <AlertError description={message} />}
    </div>
  )
}
