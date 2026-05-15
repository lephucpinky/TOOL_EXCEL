"use client"

import { useEffect, useState } from "react"

export type Dealer = {
  code: string
  name: string
  commissionRate: number
}

export type Department = {  code: string
  name: string
}

export type Employee = {
  code: string
  name: string
  departmentCode: string
}

export type Product = {
  code: string
  name: string
  unitPrice: number
  taxRate: number
  accountCode: string
}

export type AccountingCatalogs = {
  dealers: Dealer[]
  departments: Department[]
  employees: Employee[]
  products: Product[]
}

const STORAGE_KEY = "accounting_catalogs_v1"

export const defaultCatalogs: AccountingCatalogs = {
  dealers: [
    { code: "DL001", name: "CTV Cô Huệ", commissionRate: 10 },
    { code: "DL002", name: "TH TAX", commissionRate: 8 },
    { code: "DL003", name: "Khách trực tiếp", commissionRate: 0 },
  ],
  departments: [
    { code: "KD", name: "Kinh doanh" },
    { code: "CSKH", name: "Chăm sóc khách hàng" },
    { code: "KT", name: "Kế toán" },
  ],
  employees: [
    { code: "NV001", name: "Nguyễn Văn A", departmentCode: "KD" },
    { code: "NV002", name: "Trần Thị B", departmentCode: "KD" },
    { code: "NV003", name: "Lê Minh C", departmentCode: "CSKH" },
  ],
  products: [
    {
      code: "SP001",
      name: "M-Invoice Standard",
      unitPrice: 420000,
      taxRate: 8,
      accountCode: "5111",
    },
    {
      code: "SP002",
      name: "M-Invoice Pro",
      unitPrice: 670000,
      taxRate: 8,
      accountCode: "5112",
    },
    {
      code: "SP003",
      name: "Gói hóa đơn điện tử",
      unitPrice: 2500000,
      taxRate: 8,
      accountCode: "5113",
    },
  ],
}

export function useAccountingCatalogs() {
  const [catalogs, setCatalogsState] =
    useState<AccountingCatalogs>(defaultCatalogs)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY)
      if (raw) {
        setCatalogsState(JSON.parse(raw))
      }
    } catch {
      setCatalogsState(defaultCatalogs)
    } finally {
      setReady(true)
    }
  }, [])

  const setCatalogs = (next: AccountingCatalogs) => {
    setCatalogsState(next)
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
  }

  const resetCatalogs = () => {
    setCatalogsState(defaultCatalogs)
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(defaultCatalogs))
  }

  return { catalogs, setCatalogs, resetCatalogs, ready }
}



export const inputClass =
  "h-10 w-full rounded border border-slate-300 bg-white px-3 text-sm text-slate-800 outline-none focus:border-[#d96b9b]"

export const buttonClass =
  "rounded border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
