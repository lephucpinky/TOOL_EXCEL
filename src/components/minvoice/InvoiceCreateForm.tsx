"use client"

import { useEffect, useMemo, useState } from "react"
import type { InvoiceApiRow } from "@/types/invoice"
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
import { APIExportMInvoiceReceiptPost } from "@/services/mInvoiceReceipt"
import AlertOption from "../alert/AlertOption"
import AlertSuccess from "../alert/AlertSuccess"
import AlertError from "../alert/AlertError"
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
  taxRate: number
  capitalPrice: number
  totalSalary: number
  accountingAccountCode: string
}

type Props = {
  onBack: () => void
  onSaved?: (payload: any) => void
  onEdit?: () => void
  onExported?: (
    saleTransactionId: string,
    exportData: any
  ) => void | Promise<void>
  mode?: InvoiceScreenMode
  initialInvoice?: InvoiceApiRow | null
}
const today = new Date().toISOString().slice(0, 10)

const inputClass =
  "h-8 w-full rounded border border-slate-300 bg-white px-2 text-[13px] text-slate-800 outline-none focus:border-indigo-500 disabled:bg-slate-100"
const MINVOICE_TAX_CODE = process.env.NEXT_PUBLIC_MINVOICE_TAX_CODE || ""
const MINVOICE_INVOICE_SERIES =
  process.env.NEXT_PUBLIC_MINVOICE_INVOICE_SERIES || ""
function unwrapListResponse(response: any) {
  const raw =
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

  if (!Array.isArray(raw)) return []

  return raw.map((item: any) => item?.content ?? item).filter(Boolean)
}
function toNumber(value: unknown) {
  const numberValue = Number(value)
  return Number.isFinite(numberValue) ? numberValue : 0
}

function formatMoney(value: unknown) {
  return new Intl.NumberFormat("vi-VN").format(toNumber(value))
}
function getId(value: any) {
  if (!value) return ""
  if (typeof value === "string") return value
  return value._id || value.id || ""
}

function resolveOption<T extends { _id?: string }>(
  list: T[],
  value: any
): T | null {
  if (!value) return null

  if (typeof value === "object") {
    return value as T
  }

  const id = getId(value)

  if (!id) return null

  return list.find((item) => item._id === id) || null
}

function mergeOptions<T extends { _id?: string }>(
  base: T[],
  selectedItems: Array<T | null | undefined>
) {
  const result: T[] = []
  const seen = new Set<string>()

  selectedItems.forEach((item) => {
    const id = getId(item)
    if (!id || seen.has(id)) return

    seen.add(id)
    result.push(item as T)
  })

  base.forEach((item) => {
    const id = getId(item)
    if (!id || seen.has(id)) return

    seen.add(id)
    result.push(item)
  })

  return result
}

function createItemId() {
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`
}

function normalizeDateInput(value?: string) {
  if (!value) return ""

  const textValue = String(value).trim()

  const yyyymmdd = textValue.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/)
  if (yyyymmdd) {
    const year = yyyymmdd[1]
    const month = yyyymmdd[2].padStart(2, "0")
    const day = yyyymmdd[3].padStart(2, "0")

    return `${year}-${month}-${day}`
  }

  const slashDate = textValue.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/)
  if (slashDate) {
    const first = Number(slashDate[1])
    const second = Number(slashDate[2])
    const year = slashDate[3]

    let day = first
    let month = second

    if (first <= 12 && second > 12) {
      month = first
      day = second
    }

    return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(
      2,
      "0"
    )}`
  }

  const date = new Date(textValue)
  if (!Number.isNaN(date.getTime())) {
    return date.toISOString().slice(0, 10)
  }

  return ""
}

function numberToVietnamese(value: number) {
  const number = Math.round(Number.isFinite(value) ? value : 0)

  if (number === 0) return "Không đồng"

  const digitText = [
    "không",
    "một",
    "hai",
    "ba",
    "bốn",
    "năm",
    "sáu",
    "bảy",
    "tám",
    "chín",
  ]

  const unitText = ["", "nghìn", "triệu", "tỷ"]

  function readThreeDigits(num: number, full: boolean) {
    const hundred = Math.floor(num / 100)
    const ten = Math.floor((num % 100) / 10)
    const unit = num % 10
    let result = ""

    if (hundred > 0 || full) {
      result += `${digitText[hundred]} trăm`
      if (ten === 0 && unit > 0) result += " lẻ"
    }

    if (ten > 1) {
      result += `${result ? " " : ""}${digitText[ten]} mươi`
      if (unit === 1) result += " mốt"
      else if (unit === 5) result += " lăm"
      else if (unit > 0) result += ` ${digitText[unit]}`
    } else if (ten === 1) {
      result += `${result ? " " : ""}mười`
      if (unit === 5) result += " lăm"
      else if (unit > 0) result += ` ${digitText[unit]}`
    } else if (unit > 0) {
      result += `${result ? " " : ""}${digitText[unit]}`
    }

    return result
  }

  const groups: number[] = []
  let temp = number

  while (temp > 0) {
    groups.push(temp % 1000)
    temp = Math.floor(temp / 1000)
  }

  const parts: string[] = []

  for (let i = groups.length - 1; i >= 0; i--) {
    const group = groups[i]
    if (group === 0) continue

    const full = i < groups.length - 1 && group < 100
    const text = readThreeDigits(group, full)
    const unit = unitText[i] ?? ""

    parts.push(`${text}${unit ? ` ${unit}` : ""}`)
  }

  const sentence = parts.join(" ").replace(/\s+/g, " ").trim()
  return `${sentence.charAt(0).toUpperCase()}${sentence.slice(1)} đồng`
}

function getExistingExportInvoiceId(invoice?: InvoiceApiRow | null) {
  if (!invoice) return ""

  const row = invoice as any

  return String(
    row?.inv_invoiceCreatedId ||
      row?.id ||
      row?.exportInvoiceData?.id ||
      row?.exportInvoiceData?.data?.id ||
      row?.data?.id ||
      ""
  ).trim()
}

export default function InvoiceCreateForm({
  onBack,
  onSaved,
  onEdit,
  onExported,
  mode = "create",
  initialInvoice = null,
}: Props) {
  const readOnly = mode === "detail"

  const [agencies, setAgencies] = useState<Agency[]>([])
  const [departments, setDepartments] = useState<Department[]>([])
  const [employees, setEmployees] = useState<Employee[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [banks, setBanks] = useState<Bank[]>([])
  const [catalogLoading, setCatalogLoading] = useState(false)

  const [general, setGeneral] = useState<InvoiceGeneralForm>({
    symbol: "1C26MZZ",
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

  const handleCancelClick = () => {
    if (readOnly) {
      onBack()
      return
    }

    setCancelDialogOpen(true)
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

        const nextAgencies = unwrapListResponse(agencyRes).filter(
          (item: Agency) => item?._id
        ) as Agency[]

        const nextDepartments = unwrapListResponse(departmentRes).filter(
          (item: Department) => item?._id
        ) as Department[]

        const nextEmployees = unwrapListResponse(employeeRes).filter(
          (item: Employee) => item?._id
        ) as Employee[]

        const nextProducts = unwrapListResponse(productRes).filter(
          (item: Product) => item?._id
        ) as Product[]

        const nextBanks = unwrapListResponse(bankRes).filter(
          (item: Bank) => item?._id
        ) as Bank[]

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

    const resolvedEmployee = resolveOption<Employee>(
      employees,
      (initialInvoice as any).employeeId
    )

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
      symbol: initialInvoice.inv_invoiceSeries || "1C26MZZ",
      invoiceDate:
        normalizeDateInput(initialInvoice.inv_invoiceIssuedDate) || today,
      invoiceNo:
        initialInvoice.invoiceNo ||
        initialInvoice.inv_invoiceNumber ||
        initialInvoice.so_hoa_don ||
        "",
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

        const amount = toNumber(
          apiItem.amount ??
            apiItem.totalAmountWithoutVAT ??
            apiItem.inv_TotalAmountWithoutVAT ??
            (apiItems.length === 1
              ? initialInvoice.inv_TotalAmountWithoutVAT
              : 0)
        )

        const unitPrice = toNumber(
          apiItem.unitPrice ??
            apiItem.inv_unitPrice ??
            product?.inv_unitPrice ??
            (quantity > 0 ? amount / quantity : 0)
        )

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
          taxRate: toNumber(
            apiItem.taxRate ?? apiItem.ma_thue ?? product?.ma_thue ?? 0
          ),
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
  }, [initialInvoice, agencies, departments, employees, products, banks])

  const selectedAgency = general.agency
  const selectedProduct = general.product
  const selectedBank = general.bank
  const agencyOptions = useMemo(() => {
    return mergeOptions(agencies, [general.agency])
  }, [agencies, general.agency])

  const departmentOptions = useMemo(() => {
    return mergeOptions(departments, [general.department])
  }, [departments, general.department])

  const filteredEmployees = employees.filter((item: any) => {
    if (!general.department?._id) return true

    const employeeDepartmentId = getId(item.departmentId)

    if (!employeeDepartmentId) return true

    return employeeDepartmentId === general.department._id
  })

  const employeeOptions = useMemo(() => {
    return mergeOptions(filteredEmployees, [general.employee])
  }, [filteredEmployees, general.employee])

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
      const quantity = Number(item.quantity || 0)
      const unitPrice = Number(item.unitPrice || 0)
      const amount = quantity * unitPrice

      const taxRate = Number(item.taxRate || 0)
      const taxAmount = (amount * taxRate) / 100
      const totalAmount = amount + taxAmount

      const commissionAmount = (amount * commissionRate) / 100
      const revenue = amount - commissionAmount

      return {
        ...item,
        amount,
        taxRate,
        taxAmount,
        totalAmount,
        commissionRate,
        commissionAmount,
        revenue,
        capitalPrice: Number(item.capitalPrice || 0),
        totalSalary: Number(item.totalSalary || 0),
        accountingAccountCode: item.accountingAccountCode,
      }
    })
  }, [items, selectedAgency?.commissionPercent])

  const totalBeforeTax = computedItems.reduce(
    (sum, item) => sum + item.revenue,
    0
  )

  const totalTax = computedItems.reduce((sum, item) => sum + item.taxAmount, 0)

  const totalPayment = computedItems.reduce(
    (sum, item) => sum + item.totalAmount,
    0
  )

  useEffect(() => {
    if (readOnly) return
    if (!general.isPaid) return

    setGeneral((prev) => ({
      ...prev,
      paidAmount: totalPayment,
    }))
  }, [readOnly, general.isPaid, totalPayment])

  const updateGeneral = <K extends keyof InvoiceGeneralForm>(
    key: K,
    value: InvoiceGeneralForm[K]
  ) => {
    if (readOnly) return

    if (key === "department") {
      const department = value as Department | null

      setGeneral((prev) => ({
        ...prev,
        department,
        employee: null,
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
    if (readOnly) return

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
          }
        }

        return { ...item, [key]: value }
      })
    )
  }

  const addItem = () => {
    if (readOnly) return

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
        taxRate: 0,
        capitalPrice: 0,
        totalSalary: 0,
        accountingAccountCode: "",
      },
    ])
  }

  const removeItem = (id: string) => {
    if (readOnly) return

    setItems((prev) => {
      if (prev.length <= 1) return prev
      return prev.filter((item) => item.id !== id)
    })
  }

  const copyItem = (id: string) => {
    if (readOnly) return

    const source = items.find((item) => item.id === id)
    if (!source) return

    setItems((prev) => [...prev, { ...source, id: createItemId() }])
  }

  const handlePaidChange = (checked: boolean) => {
    if (readOnly) return

    setGeneral((prev) => ({
      ...prev,
      isPaid: checked,
      paidAmount: checked ? totalPayment : 0,
      paidDate: checked ? today : prev.paidDate,
    }))
  }

  const buildPayload = () => {
    const validItems = computedItems.filter(
      (item) =>
        getId(item.product) && item.productName && Number(item.quantity) > 0
    )

    const agencyId = getId(general.agency)
    const departmentId = getId(general.department)
    const employeeId = getId(general.employee)
    const bankId = getId(general.bank)

    if (!agencyId) {
      showErrorMessage("Vui lòng chọn đại lý.")
      return null
    }

    if (!departmentId) {
      showErrorMessage("Vui lòng chọn phòng ban.")
      return null
    }

    if (!employeeId) {
      showErrorMessage("Vui lòng chọn nhân viên kinh doanh.")
      return null
    }

    if (!bankId) {
      showErrorMessage("Vui lòng chọn ngân hàng.")
      return null
    }

    if (!general.taxCode.trim()) {
      showErrorMessage("Vui lòng nhập MST.")
      return null
    }

    if (!general.companyName.trim()) {
      showErrorMessage("Vui lòng nhập Tên công ty.")
      return null
    }

    if (!validItems.length) {
      showErrorMessage("Vui lòng nhập ít nhất 1 dòng chi tiết chứng từ.")
      return null
    }

    return {
      inv_invoiceSeries: general.symbol,
      inv_invoiceIssuedDate: general.invoiceDate,
      inv_currencyCode: general.currency,
      inv_exchangeRate: Number(general.exchangeRate || 1),
      inv_paymentMethodName: general.paymentMethod,

      agencyId,
      departmentId,
      employeeId,
      bankId,

      inv_buyerTaxCode: general.taxCode.trim(),
      inv_buyerLegalName: general.companyName.trim(),
      inv_buyerDisplayName: general.companyName.trim(),
      inv_buyerEmail: general.email.trim(),
      inv_buyerAddressLine: general.address.trim(),
      inv_buyerBankName: selectedBank?.inv_buyerBankName || "",
      inv_buyerBankAccount: "",

      so_benh_an: "",
      key_api: "",
      cccdan: "",
      so_hchieu: "",
      mdvqhnsach_nmua: "",
      ma_ch: "",
      ten_ch: "",

      inv_discountAmount: 0,
      inv_TotalAmountWithoutVAT: totalBeforeTax,
      inv_vatAmount: totalTax,
      inv_TotalAmount: totalPayment,
      inv_quantity: validItems.reduce(
        (sum, item) => sum + Number(item.quantity || 0),
        0
      ),
      inv_discountPercentage: 0,

      isPaid: general.isPaid,
      paidAmount: Number(general.paidAmount || 0),
      paidDate: general.paidDate,
      remainingAmount: Math.max(
        totalPayment - Number(general.paidAmount || 0),
        0
      ),

      items: validItems.map((item) => ({
        productId: getId(item.product),
        revenue: Number(item.revenue || 0),
        capitalPrice: Number(item.capitalPrice || 0),
        totalSalary: Number(item.totalSalary || 0),
        accountingAccountCode: Number(item.accountingAccountCode || 0),
      })),
    }
  }

  // const handlePreview = () => {
  //   const payload = buildPayload()
  //   if (!payload) return

  //   setPreviewData({
  //     symbol: payload.inv_invoiceSeries,
  //     invoiceDate: payload.inv_invoiceIssuedDate,
  //     invoiceNo: general.invoiceNo,
  //     currency: payload.inv_currencyCode,
  //     exchangeRate: payload.inv_exchangeRate,
  //     paymentMethod: payload.inv_paymentMethodName,

  //     buyer: {
  //       taxCode: payload.inv_buyerTaxCode,
  //       companyName: payload.inv_buyerLegalName,
  //       email: payload.inv_buyerEmail,
  //       address: payload.inv_buyerAddressLine,
  //     },
  //     items: computedItems.map((item, index) => ({
  //       id: `${item.product?._id || index}`,
  //       code: item.productCode,
  //       name: item.productName,
  //       unit: item.unit,
  //       quantity: item.quantity,
  //       type: item.type,
  //       unitPrice: item.unitPrice,
  //       amount: item.amount,
  //       taxRate: item.taxRate,
  //       taxAmount: item.taxAmount,
  //       totalAmount: item.totalAmount,
  //     })),
  //     totalBeforeTax,
  //     totalTax,
  //     totalPayment,
  //     amountInWords: numberToVietnamese(totalPayment),
  //   })

  //   setPreviewOpen(true)
  // }

  const handleSave = async () => {
    const payload = buildPayload()
    if (!payload) return

    try {
      setSaveLoading(true)

      console.log("CREATE_INVOICE_FORM_PAYLOAD", payload)

      await onSaved?.(payload)

      showSuccessMessage(
        mode === "edit" ? "Cập nhật thành công." : "Tạo thành công."
      )

      setTimeout(() => {
        onBack()
      }, 700)
    } catch (err: any) {
      console.error("SAVE_INVOICE_ERROR", err)

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

    const invoiceIssuedDate = normalizeDateInput(general.invoiceDate) || today

    const payload = {
      saleTransactionId: initialInvoice._id,
      inv_invoiceSeries: MINVOICE_INVOICE_SERIES,
      inv_invoiceIssuedDate: invoiceIssuedDate,
      editmode: 1,
    }

    try {
      setExportInvoiceLoading(true)

      const response = await APIExportMInvoiceReceiptPost(
        payload,
        MINVOICE_TAX_CODE
      )

      console.log("EXPORT_M_INVOICE_RESPONSE", response)

      const exportData =
        response?.data?.data || response?.data || response?.content || response

      const exportInvoiceId =
        exportData?.id ||
        exportData?.hoadon68_id ||
        exportData?.inv_invoiceAuth_id ||
        exportData?.inv_originalId

      if (!exportInvoiceId) {
        showErrorMessage("Bị lỗi trùng key")
        return
      }

      await onExported?.(initialInvoice._id, {
        ...exportData,

        id: exportInvoiceId,
        inv_invoiceCreatedId: exportInvoiceId,

        inv_invoiceNumber: exportData?.inv_invoiceNumber,
        so_hoa_don: exportData?.shdon,
      })

      showSuccessMessage(response?.message || "Xuất hóa đơn thành công.")

      setTimeout(() => {
        onBack()
      }, 700)
    } catch (err: any) {
      console.error("EXPORT_M_INVOICE_ERROR", err)

      const message =
        err?.response?.data?.message ||
        err?.response?.data?.error ||
        err?.message ||
        "Xuất hóa đơn thất bại."

      showErrorMessage(message)
    } finally {
      setExportInvoiceLoading(false)
    }
  }
  const alreadyExported = Boolean(getExistingExportInvoiceId(initialInvoice))

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-[#edf1f4]">
      <div className="flex items-center justify-between border-b border-slate-300 bg-white px-4 py-2">
        <div className="text-[15px] font-bold text-slate-800">
          {mode === "detail"
            ? "Chi tiết Hóa đơn giá trị gia tăng - Máy tính tiền"
            : mode === "edit"
              ? "Sửa Hóa đơn giá trị gia tăng - Máy tính tiền"
              : "Tạo mới Hóa đơn giá trị gia tăng - Máy tính tiền"}
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
          <div className="mb-3 flex items-center justify-between">
            <div className="text-sm font-bold text-slate-800">
              Thông tin chung
            </div>
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
                disabled={readOnly}
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
                disabled={catalogLoading || readOnly}
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
                    {item.name} - {item.commissionPercent}% HH
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
                disabled={catalogLoading || readOnly}
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
                disabled={catalogLoading || readOnly}
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

            {/* <div>
              <label className="mb-1 block text-[13px] font-medium text-slate-600">
                SP
              </label>
              <select
                className={inputClass}
                value={general.product?._id || ""}
                disabled={catalogLoading || readOnly}
                onChange={(e) => {
                  const product =
                    productOptions.find(
                      (item) => item._id === e.target.value
                    ) || null
                  updateGeneral("product", product)
                }}
              >
                <option value="">Chọn sản phẩm</option>
                {productOptions.map((item) => (
                  <option key={item._id} value={item._id}>
                    {item.inv_itemCode} - {item.inv_itemName}
                  </option>
                ))}
              </select>
            </div> */}

            <div>
              <label className="mb-1 block text-[13px] font-medium text-slate-600">
                MST
              </label>
              <input
                className={inputClass}
                value={general.taxCode}
                disabled={readOnly}
                onChange={(e) => updateGeneral("taxCode", e.target.value)}
                placeholder="Nhập MST"
              />
            </div>

            <div>
              <label className="mb-1 block text-[13px] font-medium text-slate-600">
                Tên cty
              </label>
              <input
                className={inputClass}
                value={general.companyName}
                disabled={readOnly}
                onChange={(e) => updateGeneral("companyName", e.target.value)}
                placeholder="Nhập tên công ty"
              />
            </div>

            <div>
              <label className="mb-1 block text-[13px] font-medium text-slate-600">
                Email
              </label>
              <input
                className={inputClass}
                value={general.email}
                disabled={readOnly}
                onChange={(e) => updateGeneral("email", e.target.value)}
                placeholder="Email xuất hóa đơn"
              />
            </div>

            <div className="xl:col-span-2">
              <label className="mb-1 block text-[13px] font-medium text-slate-600">
                Địa chỉ
              </label>
              <input
                className={inputClass}
                value={general.address}
                disabled={readOnly}
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
                  disabled={readOnly}
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
                disabled={readOnly}
                onChange={(e) =>
                  updateGeneral("paidAmount", toNumber(e.target.value))
                }
                placeholder="Số tiền đã thu"
              />
              {general.isPaid && !readOnly && (
                <div className="text-emerald-600 mt-1 text-xs">
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
                disabled={readOnly}
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
                disabled={catalogLoading || readOnly}
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

        {!readOnly && (
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <button
              onClick={addItem}
              className="border-indigo-400 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 h-8 rounded border px-3 text-sm font-medium"
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
              className="border-emerald-300 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 h-8 rounded border px-3 text-sm font-medium"
            >
              ⎘ Sao chép (F7)
            </button>

            <button
              onClick={addItem}
              className="h-8 rounded border border-blue-300 bg-blue-50 px-3 text-sm font-medium text-blue-700 hover:bg-blue-100"
            >
              → Chèn dòng (Ins)
            </button>

            {/* <button className="border-purple-300 bg-purple-50 text-purple-700 hover:bg-purple-100 h-8 rounded border px-3 text-sm font-medium">
              ⎙ Nhận Excel chi tiết
            </button> */}
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
                <th className="min-w-[110px] border-b border-r border-slate-300 px-2 py-2 text-right">
                  % CK
                </th>
                <th className="min-w-[150px] border-b border-r border-slate-300 px-2 py-2 text-right">
                  Doanh thu
                </th>
                <th className="min-w-[140px] border-b border-r border-slate-300 px-2 py-2 text-right">
                  Giá vốn
                </th>
                <th className="min-w-[140px] border-b border-r border-slate-300 px-2 py-2 text-right">
                  Tính lương
                </th>
                <th className="min-w-[170px] border-b border-r border-slate-300 px-2 py-2 text-left">
                  Mã tài khoản hạch toán
                </th>
                {!readOnly && (
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
                    <input type="checkbox" defaultChecked disabled={readOnly} />
                  </td>

                  <td className="border-b border-r border-slate-200 px-2 py-2 text-center">
                    {index + 1}
                  </td>

                  <td className="border-b border-r border-slate-200 px-2 py-2">
                    <select
                      className={inputClass}
                      value={item.product?._id || ""}
                      disabled={catalogLoading || readOnly}
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
                      disabled={readOnly}
                      onChange={(e) =>
                        updateItem(item.id, "productName", e.target.value)
                      }
                    />
                  </td>

                  <td className="border-b border-r border-slate-200 px-2 py-2">
                    <input
                      className={`${inputClass} text-right`}
                      value={item.quantity}
                      disabled={readOnly}
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
                      disabled={readOnly}
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
                      disabled={readOnly || item.type === "Tặng"}
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
                    {item.commissionRate}%
                  </td>

                  <td className="border-b border-r border-slate-200 px-2 py-2 text-right font-semibold text-blue-700">
                    {formatMoney(item.revenue)}
                  </td>

                  <td className="border-b border-r border-slate-200 px-2 py-2">
                    <input
                      className={`${inputClass} text-right`}
                      value={item.capitalPrice}
                      disabled={readOnly}
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
                      className={`${inputClass} text-right`}
                      value={item.totalSalary}
                      disabled={readOnly}
                      onChange={(e) =>
                        updateItem(
                          item.id,
                          "totalSalary",
                          toNumber(e.target.value)
                        )
                      }
                      placeholder="Tính lương"
                    />
                  </td>

                  <td className="border-b border-r border-slate-200 px-2 py-2">
                    <input
                      className={`${inputClass} bg-slate-50`}
                      value={item.accountingAccountCode}
                      disabled
                      readOnly
                    />
                  </td>

                  {!readOnly && (
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

          <div className="grid gap-3 lg:grid-cols-4">
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
              <div className="text-indigo-700 rounded border border-slate-300 bg-slate-50 px-3 py-2 text-right font-bold">
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
              className="border-indigo-500 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 rounded border px-5 py-2 text-sm font-semibold"
            >
              Sửa
            </button>

            <button
              onClick={handleExportInvoice}
              disabled={exportInvoiceLoading || alreadyExported}
              className="border-emerald-500 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 rounded border px-5 py-2 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-60"
            >
              {alreadyExported
                ? "Đã xuất hóa đơn"
                : exportInvoiceLoading
                  ? "Đang xuất..."
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
              className="bg-indigo-600 hover:bg-indigo-700 rounded px-5 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
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
              className="bg-indigo-600 hover:bg-indigo-700 rounded px-5 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
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
      {/* <InvoicePreviewModal
        open={previewOpen}
        data={previewData}
        onClose={() => setPreviewOpen(false)}
      /> */}
    </div>
  )
}
