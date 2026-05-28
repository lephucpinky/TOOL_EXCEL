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
import { APIGetProducts } from "@/services/product"
import { APIGetBanks } from "@/services/bank"
import {
  APIExportMInvoiceReceiptPost,
  APIGetMInvoiceReceiptJobStatus,
} from "@/services/mInvoiceReceipt"
import type { ReceiptInvoiceConfig } from "@/types/receiptInvoice"
import AlertOption from "../alert/AlertOption"
import AlertSuccess from "../alert/AlertSuccess"
import AlertError from "../alert/AlertError"
import {
  canStartInvoiceExport,
  createItemId,
  formatMoney,
  getId,
  getInvoiceStatus,
  inputClass,
  invoiceStatusClass,
  invoiceStatusLabel,
  mergeOptions,
  normalizeDateInput,
  numberToVietnamese,
  resolveOption,
  roundInvoiceMoney,
} from "@/utils/invoice"
import {
  createAlreadyIssuingResolution,
  createInvoiceExportFailureResolution,
  createRateLimitedResolution,
  getInvoiceExportAlertMessage,
  getInvoiceExportErrorAlertMessage,
  type InvoiceExportContext,
  type InvoiceExportResolution,
  isInvoiceAlreadyBeingIssuedError,
  isInvoiceExportRateLimitedError,
  resolveInvoiceExportResultWithJobStatus,
} from "@/utils/invoiceExport"
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
  activatedDate: string
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
  taxRate: number
  capitalPrice: number
  totalSalary: number
  accountingAccountCode: string
}

type InvoiceFieldErrors = Partial<Record<"taxCode" | "email", string>>

type Props = {
  onBack: () => void
  onSaved?: (payload: any) => void
  onEdit?: () => void
  onExported?: (
    saleTransactionId: string,
    resolution: InvoiceExportResolution
  ) => void | Promise<void>
  mode?: InvoiceScreenMode
  initialInvoice?: InvoiceApiRow | null
  receiptConfig?: ReceiptInvoiceConfig | null
  receiptConfigs?: ReceiptInvoiceConfig[]
  selectedReceiptConfigValue?: string
  onReceiptConfigChange?: (value: string) => void
  receiptConfigLocked?: boolean
}
const today = new Date().toISOString().slice(0, 10)
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const taxCodePattern = /^(?:\d{10}|\d{14})$/

const taxCodeRequiredMessage = "Vui lòng nhập MST."
const taxCodeInvalidMessage = "Mã số thuế phải là 10 hoặc 14 ký tự số."
const emailRequiredMessage = "Vui lòng nhập Email."
const emailInvalidMessage = "Email không hợp lệ."

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

  if (invoiceSeries) {
    return `${invoiceSeries}`
  }

  return invoiceSeries || "Cấu hình hóa đơn chưa hoàn chỉnh"
}

const issuedEditableGeneralKeys: Array<keyof InvoiceGeneralForm> = [
  "bank",
  "isPaid",
  "paidAmount",
  "paidDate",
]

export default function InvoiceCreateForm({
  onBack,
  onSaved,
  onEdit,
  onExported,
  mode = "create",
  initialInvoice = null,
  receiptConfig = null,
  receiptConfigs = [],
  selectedReceiptConfigValue = "",
  onReceiptConfigChange,
  receiptConfigLocked = false,
}: Props) {
  const invoiceStatus = getInvoiceStatus(initialInvoice)
  const isIssuedInvoice = invoiceStatus === InvoiceStatus.ISSUED
  const isIssuingInvoice = invoiceStatus === InvoiceStatus.ISSUING
  const isCancelledInvoice = invoiceStatus === InvoiceStatus.CANCELLED
  const canExportInvoice = canStartInvoiceExport(invoiceStatus)

  const alreadyExported = isIssuedInvoice

  const readOnly = mode === "detail" || isCancelledInvoice

  // Chỉ hóa đơn ISSUED mới được vào luồng sửa riêng ngân hàng.
  const issuedLimitedEdit = mode === "edit" && isIssuedInvoice
  const canEditBank = issuedLimitedEdit

  const mainFieldsDisabled = readOnly || issuedLimitedEdit
  const paymentFieldsDisabled = !issuedLimitedEdit

  const [agencies, setAgencies] = useState<Agency[]>([])
  const [departments, setDepartments] = useState<Department[]>([])
  const [employees, setEmployees] = useState<Employee[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [banks, setBanks] = useState<Bank[]>([])
  const [catalogLoading, setCatalogLoading] = useState(false)
  const bankFieldDisabled = catalogLoading || !canEditBank
  const activeReceiptSeries = String(
    receiptConfig?.inv_invoiceSeries || ""
  ).trim()
  const activeReceiptTaxCode = String(receiptConfig?.tax_code || "").trim()

  const [general, setGeneral] = useState<InvoiceGeneralForm>({
    symbol: activeReceiptSeries,
    invoiceDate: today,
    invoiceNo: "",
    currency: "VND",
    exchangeRate: 1,
    paymentMethod: "CK",

    activatedDate: today,

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
      taxRate: 0,
      capitalPrice: 0,
      totalSalary: 0,
      accountingAccountCode: "",
    },
  ])

  const [exportInvoiceLoading, setExportInvoiceLoading] = useState(false)
  const [saveLoading, setSaveLoading] = useState(false)

  const [showSuccess, setShowSuccess] = useState(false)
  const [showError, setShowError] = useState(false)
  const [message, setMessage] = useState("")
  const [isCancelDialogOpen, setCancelDialogOpen] = useState(false)
  const [fieldErrors, setFieldErrors] = useState<InvoiceFieldErrors>({})

  const receiptConfigSelectValue = useMemo(() => {
    if (selectedReceiptConfigValue) return selectedReceiptConfigValue

    const matchedIndex = receiptConfigs.findIndex((item) => {
      return (
        String(item.inv_invoiceSeries || "").trim() === general.symbol.trim() ||
        String(item.tax_code || "").trim() === activeReceiptTaxCode
      )
    })

    if (matchedIndex < 0) return ""

    return getReceiptConfigOptionValue(
      receiptConfigs[matchedIndex],
      matchedIndex
    )
  }, [
    selectedReceiptConfigValue,
    receiptConfigs,
    general.symbol,
    activeReceiptTaxCode,
  ])

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

    const nextConfig = receiptConfigs.find(
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
            APIGetProducts(),
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

    setGeneral((prev) => ({
      ...prev,
      symbol: initialInvoice.inv_invoiceSeries || activeReceiptSeries,
      activatedDate:
        normalizeDateInput(initialInvoice.activationDate || undefined) || today,
      invoiceDate:
        normalizeDateInput(initialInvoice.inv_invoiceIssuedDate) || today,

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

      isPaid:
        Boolean((initialInvoice as any).isPaid) ||
        Number((initialInvoice as any).paidAmount || 0) > 0,
      paidAmount: Number((initialInvoice as any).paidAmount || 0),
      paidDate:
        normalizeDateInput((initialInvoice as any).paidDate) ||
        normalizeDateInput((initialInvoice as any).paymentDate) ||
        today,
    }))

    if (!apiItems.length) {
      if (resolvedProduct) {
        setItems([
          {
            id: createItemId(),
            product: resolvedProduct,
            productCode: resolvedProduct.inv_itemCode || "",
            productName: resolvedProduct.inv_itemName || "",
            unit: resolvedProduct.inv_unitCode || "kg",
            quantity: Number(
              (initialInvoice as any).inv_quantity ||
                resolvedProduct.inv_quantity ||
                1
            ),
            type: "Mới",
            unitPrice: Number(resolvedProduct.inv_unitPrice || 0),
            discountAmount: Number(
              (initialInvoice as any).inv_discountAmount || 0
            ),
            taxRate: Number(resolvedProduct.ma_thue || 0),
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

        const taxRate = toNumber(
          apiItem.taxRate ?? apiItem.ma_thue ?? product?.ma_thue ?? 0
        )

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
          (netUnitPrice > 0 ? netUnitPrice * (1 + taxRate / 100) : 0) ||
          Number(product?.inv_unitPrice || 0)

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
          discountAmount: 0,
          taxRate,
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

  const departmentOptions = useMemo(() => {
    return mergeOptions(departments, [general.department])
  }, [departments, general.department])

  const selectedAgencyEmployee = useMemo(() => {
    return resolveAgencyEmployee(general.agency, employees)
  }, [general.agency, employees])

  const filteredEmployees = employees.filter((item: any) => {
    if (!general.department?._id) return true

    const employeeDepartmentId = getId(item.departmentId)

    if (!employeeDepartmentId) return true

    return employeeDepartmentId === general.department._id
  })

  const employeeOptions = useMemo(() => {
    if (selectedAgencyEmployee) {
      return mergeOptions(filteredEmployees, [
        selectedAgencyEmployee,
        general.employee,
      ])
    }

    return mergeOptions(filteredEmployees, [general.employee])
  }, [selectedAgencyEmployee, filteredEmployees, general.employee])

  const productOptions = useMemo(() => {
    return mergeOptions(products, [
      general.product,
      ...items.map((item) => item.product),
    ])
  }, [products, general.product, items])

  const bankOptions = useMemo(() => {
    return mergeOptions(banks, [general.bank])
  }, [banks, general.bank])
  const computedItems = useMemo(() => {
    const commissionRate = Number(selectedAgency?.commissionPercent || 0)

    return items.map((item) => {
      // Khớp BE: quantity = item.inv_quantity ?? 1
      const quantityValue = Number(item.quantity)
      const quantity = Number.isFinite(quantityValue) ? quantityValue : 1

      // Khớp BE: price = item.price
      // FE đang dùng ô Đơn giá làm `price` gửi xuống BE, tức giá đã gồm VAT.
      const price = Number(item.unitPrice || 0)

      // Khớp BE: discount và discountPercentage đang hard-code = 0
      const discount = 0
      const discountPercentage = 0

      // Khớp BE: tax = item.ma_thue / 100
      const taxRate = Number(item.taxRate || 0)
      const tax = taxRate / 100

      // Khớp BE: totalPrice = price * quantity - discount
      const totalPrice = price * quantity - discount

      // Khớp BE: totalAmountWithVat = totalPrice / (1 + tax)
      const totalAmountWithoutVat = totalPrice / (1 + tax)

      // Khớp BE: vatAmount = totalPrice - totalAmountWithVat
      const vatAmount = totalPrice - totalAmountWithoutVat

      // Khớp BE: totalBeforeDiscount = totalAmountWithVat / (1 - discountPercentage)
      const totalBeforeDiscount =
        totalAmountWithoutVat / (1 - discountPercentage)

      // Khớp BE: unitPrice = totalBeforeDiscount / quantity
      const invUnitPrice = quantity > 0 ? totalBeforeDiscount / quantity : 0

      return {
        ...item,
        quantity,

        // Giữ lại để build payload gửi BE đúng tên field input.
        price: roundInvoiceMoney(price),
        ma_thue: taxRate,

        // Cột Tổng tiền hàng trên UI đang hiển thị tổng tiền thanh toán đã gồm VAT.
        amount: roundInvoiceMoney(totalPrice),

        // Hoa hồng đại lý không tham gia công thức BE, chỉ giữ lại nếu UI cần dùng.
        commissionRate,
        commissionAmount: roundInvoiceMoney(
          (totalPrice * commissionRate) / 100
        ),

        discountAmount: roundInvoiceMoney(discount),
        discountPercentage: roundInvoiceMoney(discountPercentage),

        taxRate,
        taxAmount: roundInvoiceMoney(vatAmount),

        // Doanh thu = tiền chưa VAT theo BE.
        revenue: roundInvoiceMoney(totalAmountWithoutVat),

        // Tổng thanh toán = inv_TotalAmount theo BE.
        totalAmount: roundInvoiceMoney(totalPrice),

        // inv_unitPrice BE trả về là đơn giá chưa VAT.
        invUnitPrice: roundInvoiceMoney(invUnitPrice),

        capitalPrice: Number(item.capitalPrice || 0),

        // Tính lương = Doanh thu.
        totalSalary: roundInvoiceMoney(totalAmountWithoutVat),

        accountingAccountCode: item.accountingAccountCode,
      }
    })
  }, [items, selectedAgency?.commissionPercent])

  const totalDiscountAmount = computedItems.reduce(
    (sum, item) => sum + Number(item.discountAmount || 0),
    0
  )

  const totalBeforeTax = computedItems.reduce(
    (sum, item) => sum + Number(item.revenue || 0),
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
  const effectivePaidAmount = general.isPaid
    ? roundInvoiceMoney(Number(general.paidAmount || totalPayment))
    : 0

  const effectiveRemainingAmount = general.isPaid
    ? Math.max(roundInvoiceMoney(totalPayment - effectivePaidAmount), 0)
    : roundInvoiceMoney(totalPayment)
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

    // Hóa đơn đã ISSUED thì chỉ cho đổi ngân hàng, khóa toàn bộ thông tin khác.
    if (issuedLimitedEdit && !issuedEditableGeneralKeys.includes(key)) return

    if (key === "agency") {
      const agency = value as Agency | null
      const employee = resolveAgencyEmployee(agency, employees)

      setGeneral((prev) => ({
        ...prev,
        agency,
        employee,
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
            taxRate: Number(product?.ma_thue || 0),
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
            taxRate: Number(product?.ma_thue || 0),
            discountAmount: item.discountAmount || 0,
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
        taxRate: 0,
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
      paidDate: checked ? today : prev.paidDate,
    }))
  }

  const buildPayload = () => {
    const validItems = computedItems.filter(
      (item) =>
        getId(item.product) && item.productName && Number(item.quantity) > 0
    )

    const agencyId = getId(general.agency)
    const employeeId = getId(general.employee)
    const bankId = getId(general.bank)
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

    return {
      activationDate: general.activatedDate || null,
      inv_invoiceSeries: general.symbol,
      inv_invoiceIssuedDate: general.invoiceDate,
      inv_currencyCode: general.currency,
      inv_exchangeRate: Number(general.exchangeRate || 1),
      inv_paymentMethodName: general.paymentMethod,

      agencyId,
      // departmentId: departmentId || undefined,
      employeeId: employeeId || undefined,
      bankId: bankId || undefined,

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
      inv_discountPercentage: 0,
      items: validItems.map((item) => ({
        productId: getId(item.product),
        product: item.product,
        quantity: Number(item.quantity || 1),
        inv_quantity: Number(item.quantity || 1),
        // Khớp schema BE hiện tại của TransactionItem.
        revenue: roundInvoiceMoney(item.revenue || 0),
        capitalPrice: Number(item.capitalPrice || 0),
        totalSalary: roundInvoiceMoney(item.totalSalary || item.revenue || 0),
        accountingAccountCode: Number(item.accountingAccountCode || 0),
      })),
      __clientSnapshot: {
        agency: general.agency,
        department: general.department,
        employee: general.employee,
        bank: general.bank,
      },
    }
  }

  const handleSave = async () => {
    if (isCancelledInvoice) {
      showErrorMessage("Hóa đơn đã hủy, không thể chỉnh sửa.")
      return
    }

    if (false) {
      const bankId = getId(general.bank)

      if (!bankId) {
        showErrorMessage("Vui lòng chọn ngân hàng cần cập nhật.")
        return
      }

      try {
        setSaveLoading(true)

        await onSaved?.({
          bankOnlyEdit: true,
          bankId,
          inv_buyerBankName: selectedBank?.inv_buyerBankName || "",
        })

        showSuccessMessage("Cập nhật ngân hàng thành công.")

        setTimeout(() => {
          onBack()
        }, 700)
      } catch (err: any) {
        console.error("SAVE_BANK_INVOICE_ERROR", err)

        const message =
          err?.response?.data?.message ||
          err?.response?.data?.error ||
          err?.message ||
          "Cập nhật ngân hàng thất bại."

        showErrorMessage(message)
      } finally {
        setSaveLoading(false)
      }

      return
    }

    const payload = buildPayload()
    if (!payload) return

    try {
      setSaveLoading(true)

      console.log("INVOICE_FORM_SUBMIT_PAYLOAD", {
        mode,
        initialInvoiceId: initialInvoice?._id || null,
        payload,
      })

      await onSaved?.({
        ...payload,
        __clientPayment: {
          isPaid: Boolean(general.isPaid),
          paidAmount: effectivePaidAmount,
          paidDate: general.isPaid ? general.paidDate || today : "",
          remainingAmount: effectiveRemainingAmount,
        },
      })

      showSuccessMessage(
        mode === "edit" ? "Cập nhật thành công." : "Tạo thành công."
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

  const handleExportInvoice = async () => {
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

    const invoiceSeries = String(general.symbol || activeReceiptSeries).trim()

    if (!invoiceSeries) {
      showErrorMessage("Chưa có ký hiệu hóa đơn từ cấu hình.")
      return
    }

    if (!activeReceiptTaxCode) {
      showErrorMessage("Chưa có mã số thuế từ cấu hình hóa đơn.")
      return
    }

    const invoiceIssuedDate = normalizeDateInput(general.invoiceDate) || today
    const payload = {
      saleTransactionId: initialInvoice._id,
      inv_invoiceSeries: invoiceSeries,
      inv_invoiceIssuedDate: invoiceIssuedDate,
      editmode: 1,
    }
    const exportContext: InvoiceExportContext = {
      saleTransactionId: initialInvoice._id,
      invoiceSeries,
      taxCode: activeReceiptTaxCode,
    }

    try {
      setExportInvoiceLoading(true)

      console.log("EXPORT_M_INVOICE_REQUEST", {
        mode,
        saleTransactionId: initialInvoice._id,
        payload,
        taxCode: activeReceiptTaxCode,
      })

      const response = await APIExportMInvoiceReceiptPost(
        payload,
        activeReceiptTaxCode
      )
      const resolution = await resolveInvoiceExportResultWithJobStatus(
        response,
        exportContext,
        APIGetMInvoiceReceiptJobStatus
      )

      console.log("EXPORT_M_INVOICE_RESOLUTION", {
        saleTransactionId: initialInvoice._id,
        resolution,
      })

      await onExported?.(initialInvoice._id, resolution)

      if (resolution.status === InvoiceStatus.FAILED) {
        showErrorMessage(
          getInvoiceExportErrorAlertMessage(resolution, initialInvoice)
        )
        return
      }

      if (resolution.status === InvoiceStatus.ISSUED) {
        showSuccessMessage(getInvoiceExportAlertMessage(resolution))
        return
      }

      showSuccessMessage(getInvoiceExportAlertMessage(resolution))
    } catch (err: any) {
      console.error("EXPORT_M_INVOICE_ERROR", {
        saleTransactionId: initialInvoice._id,
        payload,
        taxCode: activeReceiptTaxCode,
        error: err,
        response: err?.response?.data,
      })

      if (isInvoiceAlreadyBeingIssuedError(err)) {
        const resolution = createAlreadyIssuingResolution(err, exportContext)
        await onExported?.(initialInvoice._id, resolution)
        showSuccessMessage(getInvoiceExportAlertMessage(resolution))
        return
      }

      if (isInvoiceExportRateLimitedError(err)) {
        const resolution = createRateLimitedResolution(err, exportContext)
        await onExported?.(initialInvoice._id, resolution)
        showErrorMessage(
          getInvoiceExportErrorAlertMessage(resolution, initialInvoice)
        )
        return
      }

      const resolution = createInvoiceExportFailureResolution(
        err,
        exportContext,
        err?.message || "Xuất hóa đơn thất bại."
      )

      await onExported?.(initialInvoice._id, resolution)
      showErrorMessage(
        getInvoiceExportErrorAlertMessage(resolution, initialInvoice)
      )
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
              {invoiceStatusLabel[invoiceStatus]}
            </span>
          </div>

          <div className="mb-3 flex flex-wrap items-center gap-3 rounded border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
            <div className="flex items-center gap-2">
              <span>Ký hiệu:</span>
              {receiptConfigLocked && receiptConfig ? (
                <span className="inline-flex min-h-8 min-w-[280px] items-center rounded-md border border-indigo-200 bg-white px-3 py-1 text-xs font-semibold text-slate-700">
                  {formatReceiptConfigLabel(receiptConfig)}
                </span>
              ) : (
                <select
                  className="h-8 min-w-[280px] rounded-md border border-slate-300 bg-white px-2 text-xs font-medium text-slate-700 outline-none focus:border-indigo-500 disabled:bg-slate-100"
                  value={receiptConfigSelectValue}
                  disabled={mainFieldsDisabled || !receiptConfigs.length}
                  onChange={(e) => handleReceiptConfigSelect(e.target.value)}
                >
                  <option value="" disabled>
                    {receiptConfigs.length ? "Chọn ký hiệu" : "Chưa có ký hiệu"}
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
                value={general.activatedDate}
                disabled={mainFieldsDisabled}
                onChange={(e) => updateGeneral("activatedDate", e.target.value)}
              />
            </div>

            <div>
              <label className="mb-1 block text-[13px] font-medium text-slate-600">
                Đại lý
              </label>
              <select
                className={inputClass}
                value={general.agency?._id || ""}
                disabled={catalogLoading || mainFieldsDisabled}
                onChange={(e) => {
                  const agency =
                    agencyOptions.find((item) => item._id === e.target.value) ||
                    null
                  updateGeneral("agency", agency)
                }}
              >
                <option value="">Chọn đại lý</option>
                {agencyOptions.map((item) => (
                  <option key={item._id} value={item._id}>
                    {item.agencyName} - {item.commissionPercent}% HH
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1 block text-[13px] font-medium text-slate-600">
                Phòng ban
              </label>
              <select
                className={inputClass}
                value={general.department?._id || ""}
                disabled={catalogLoading || mainFieldsDisabled}
                onChange={(e) => {
                  const department =
                    departmentOptions.find(
                      (item) => item._id === e.target.value
                    ) || null
                  updateGeneral("department", department)
                }}
              >
                <option value="">Chọn phòng ban</option>
                {departmentOptions.map((item) => (
                  <option key={item._id} value={item._id}>
                    {item.departmentName}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1 block text-[13px] font-medium text-slate-600">
                NVKD
              </label>
              <select
                className={inputClass}
                value={general.employee?._id || ""}
                disabled={catalogLoading || mainFieldsDisabled}
                onChange={(e) => {
                  const employee =
                    employeeOptions.find(
                      (item) => item._id === e.target.value
                    ) || null

                  updateGeneral("employee", employee)
                }}
              >
                <option value="">Chọn nhân viên</option>
                {employeeOptions.map((item) => (
                  <option key={item._id} value={item._id}>
                    {item.employeeName}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1 block text-[13px] font-medium text-slate-600">
                MST
                <span className="ml-0.5 text-red-500">*</span>
              </label>
              <input
                className={`${inputClass} ${
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
                  const nextTaxCode = e.target.value
                    .replace(/\D/g, "")
                    .slice(0, 14)

                  updateGeneral("taxCode", nextTaxCode)

                  setFieldErrors((prev) => ({
                    ...prev,
                    taxCode: getTaxCodeError(nextTaxCode) || undefined,
                  }))
                }}
                onBlur={() => validateRequiredField("taxCode")}
                placeholder="Nhập MST"
                inputMode="numeric"
                maxLength={14}
                required
                aria-required="true"
                aria-invalid={Boolean(fieldErrors.taxCode)}
                aria-describedby={
                  fieldErrors.taxCode ? "invoice-tax-code-error" : undefined
                }
              />
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
                disabled={paymentFieldsDisabled}
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
              <select
                className={inputClass}
                value={general.bank?._id || ""}
                disabled={bankFieldDisabled}
                onChange={(e) => {
                  const bank =
                    bankOptions.find((item) => item._id === e.target.value) ||
                    null
                  updateGeneral("bank", bank)
                }}
              >
                <option value="">Chọn ngân hàng</option>
                {bankOptions.map((item) => (
                  <option key={item._id} value={item._id}>
                    {item.inv_buyerBankName}
                  </option>
                ))}
              </select>
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
                <th className="min-w-[150px] border-b border-r border-slate-300 px-2 py-2 text-left">
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
                {/* <th className="min-w-[110px] border-b border-r border-slate-300 px-2 py-2 text-right">
                  % CK
                </th> */}
                {/* <th className="min-w-[150px] border-b border-r border-slate-300 px-2 py-2 text-right">
                  Tiền chiết khấu
                </th> */}
                <th className="min-w-[150px] border-b border-r border-slate-300 px-2 py-2 text-right">
                  Doanh thu
                </th>
                {/* <th className="min-w-[140px] border-b border-r border-slate-300 px-2 py-2 text-right">
                  Giá vốn
                </th> */}
                {/* <th className="min-w-[140px] border-b border-r border-slate-300 px-2 py-2 text-right">
                  Tính lương
                </th> */}
                {/* <th className="min-w-[170px] border-b border-r border-slate-300 px-2 py-2 text-left">
                  Mã tài khoản hạch toán
                </th> */}
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

                  <td className="border-b border-r border-slate-200 px-2 py-2">
                    <select
                      className={inputClass}
                      value={item.product?._id || ""}
                      disabled={catalogLoading || mainFieldsDisabled}
                      onChange={(e) => {
                        const product =
                          productOptions.find(
                            (productItem) => productItem._id === e.target.value
                          ) || null

                        updateItem(item.id, "product", product)
                      }}
                    >
                      <option value="">Chọn mã hàng</option>
                      {productOptions.map((product) => (
                        <option key={product._id} value={product._id}>
                          {product.inv_itemCode}
                        </option>
                      ))}
                    </select>
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
                    <select
                      className={inputClass}
                      value={item.type}
                      disabled={mainFieldsDisabled}
                      onChange={(e) =>
                        updateItem(item.id, "type", e.target.value)
                      }
                    >
                      <option value="Mới">Mới</option>
                      <option value="Gia hạn">Gia hạn</option>
                      <option value="Tặng">Tặng</option>
                      <option value="Khác">Khác</option>
                    </select>
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

                  <td className="border-b border-r border-slate-200 px-2 py-2 text-right font-semibold">
                    {item.discountPercentage}%
                  </td>
                  {/* <td className="border-b border-r border-slate-200 px-2 py-2">
                    <input
                      className={`${inputClass} text-right`}
                      value={item.discountAmount}
                      disabled={mainFieldsDisabled}
                      onChange={(e) =>
                        updateItem(
                          item.id,
                          "discountAmount",
                          toNumber(e.target.value)
                        )
                      }
                      placeholder="Tiền CK"
                    />
                  </td> */}

                  {/* <td className="border-b border-r border-slate-200 px-2 py-2 text-right font-semibold text-blue-700">
                    {formatMoney(item.revenue)}
                  </td> */}

                  {/* <td className="border-b border-r border-slate-200 px-2 py-2">
                    <input
                      className={`${inputClass} text-right`}
                      value={item.capitalPrice}
                      disabled={mainFieldsDisabled}
                      onChange={(e) =>
                        updateItem(
                          item.id,
                          "capitalPrice",
                          toNumber(e.target.value)
                        )
                      }
                      placeholder="Giá vốn"
                    />
                  </td>

                  <td className="border-b border-r border-slate-200 px-2 py-2">
                    <input
                      className={`${inputClass} bg-slate-50 text-right font-semibold text-blue-700`}
                      value={formatMoney(item.totalSalary)}
                      disabled
                      readOnly
                    />
                  </td>

                  <td className="border-b border-r border-slate-200 px-2 py-2">
                    <input
                      className={`${inputClass} bg-slate-50`}
                      value={item.accountingAccountCode}
                      disabled
                      readOnly
                    />
                  </td> */}

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
            {/* <div>
              <label className="mb-1 block text-[13px] text-slate-500">
                Tổng tiền chiết khấu
              </label>
              <div className="rounded border border-slate-300 bg-slate-50 px-3 py-2 text-right font-semibold">
                {formatMoney(totalDiscountAmount)}
              </div>
            </div> */}
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
              disabled={
                isCancelledInvoice || isIssuedInvoice || isIssuingInvoice
              }
              className="rounded border border-indigo-500 bg-indigo-50 px-5 py-2 text-sm font-semibold text-indigo-700 hover:bg-indigo-100 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Sửa
            </button>

            <button
              onClick={handleExportInvoice}
              disabled={exportInvoiceLoading || !canExportInvoice}
              className="rounded border border-emerald-500 bg-emerald-50 px-5 py-2 text-sm font-semibold text-emerald-700 hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isCancelledInvoice
                ? "Hóa đơn đã hủy"
                : alreadyExported
                  ? "Đã xuất hóa đơn"
                  : exportInvoiceLoading || isIssuingInvoice
                    ? "Đang xuất..."
                    : invoiceStatus === InvoiceStatus.FAILED
                      ? "Xuất lại hóa đơn"
                      : "Xuất hóa đơn"}
            </button>
          </>
        ) : mode === "edit" ? (
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
              className="rounded bg-indigo-600 px-5 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {saveLoading ? "Đang lưu..." : "Lưu"}
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
              className="rounded bg-indigo-600 px-5 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {saveLoading ? "Đang lưu..." : "Lưu"}
            </button>
          </>
        )}
      </div>
      <AlertOption
        isOpen={isCancelDialogOpen}
        onOpenChange={setCancelDialogOpen}
        onConfirm={() => {
          setCancelDialogOpen(false)
          onBack()
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
