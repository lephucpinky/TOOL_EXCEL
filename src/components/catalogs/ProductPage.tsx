"use client"

import { useState } from "react"

type Product = {
  id: string
  code: string
  name: string
  unitPrice: number
  taxRate: number
  accountCode: string
}

const fakeProducts: Product[] = [
  {
    id: "1",
    code: "SP001",
    name: "Hóa đơn điện tử gói 500 số",
    unitPrice: 420000,
    taxRate: 8,
    accountCode: "5111",
  },
  {
    id: "2",
    code: "SP002",
    name: "Hóa đơn điện tử gói 1.000 số",
    unitPrice: 790000,
    taxRate: 8,
    accountCode: "5111",
  },
]

const emptyForm: Product = {
  id: "",
  code: "",
  name: "",
  unitPrice: 0,
  taxRate: 8,
  accountCode: "",
}

function formatMoney(value: number) {
  return new Intl.NumberFormat("vi-VN").format(Number(value || 0))
}

export default function ProductPage() {
  const [products, setProducts] = useState<Product[]>(fakeProducts)
  const [form, setForm] = useState<Product>(emptyForm)
  const [editingId, setEditingId] = useState<string | null>(null)

  const handleSave = () => {
    if (!form.code.trim()) {
      alert("Vui lòng nhập mã sản phẩm")
      return
    }

    if (!form.name.trim()) {
      alert("Vui lòng nhập tên sản phẩm")
      return
    }

    if (editingId) {
      setProducts((prev) =>
        prev.map((item) =>
          item.id === editingId
            ? {
                ...form,
                id: editingId,
                code: form.code.trim().toUpperCase(),
                name: form.name.trim(),
                unitPrice: Number(form.unitPrice || 0),
                taxRate: Number(form.taxRate || 0),
              }
            : item
        )
      )
    } else {
      setProducts((prev) => [
        {
          ...form,
          id: crypto.randomUUID(),
          code: form.code.trim().toUpperCase(),
          name: form.name.trim(),
          unitPrice: Number(form.unitPrice || 0),
          taxRate: Number(form.taxRate || 0),
        },
        ...prev,
      ])
    }

    setForm(emptyForm)
    setEditingId(null)
  }

  const handleDelete = (id: string) => {
    if (!confirm("Bạn có chắc muốn xóa sản phẩm này không?")) return
    setProducts((prev) => prev.filter((item) => item.id !== id))
  }

  return (
    <div className="min-h-screen bg-slate-100 p-5">
      <div className="mx-auto max-w-7xl space-y-5">
        <div className="rounded-xl bg-white p-5 shadow-sm">
          <h1 className="text-xl font-bold text-slate-900">
            Danh sách sản phẩm
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Mã SP ra tên SP, đơn giá, thuế suất và mã tài khoản hạch toán.
          </p>
        </div>

        <div className="grid gap-5 lg:grid-cols-[380px_1fr]">
          <div className="rounded-xl bg-white p-5 shadow-sm">
            <h2 className="mb-4 font-bold text-slate-800">
              {editingId ? "Sửa sản phẩm" : "Thêm sản phẩm"}
            </h2>

            <div className="space-y-3">
              <input
                className="h-10 w-full rounded-lg border px-3 text-sm"
                placeholder="Mã sản phẩm"
                value={form.code}
                onChange={(e) =>
                  setForm((prev) => ({
                    ...prev,
                    code: e.target.value.toUpperCase(),
                  }))
                }
              />

              <input
                className="h-10 w-full rounded-lg border px-3 text-sm"
                placeholder="Tên sản phẩm"
                value={form.name}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, name: e.target.value }))
                }
              />

              <input
                className="h-10 w-full rounded-lg border px-3 text-sm"
                placeholder="Đơn giá"
                type="number"
                value={form.unitPrice}
                onChange={(e) =>
                  setForm((prev) => ({
                    ...prev,
                    unitPrice: Number(e.target.value),
                  }))
                }
              />

              <input
                className="h-10 w-full rounded-lg border px-3 text-sm"
                placeholder="Thuế suất"
                type="number"
                value={form.taxRate}
                onChange={(e) =>
                  setForm((prev) => ({
                    ...prev,
                    taxRate: Number(e.target.value),
                  }))
                }
              />

              <input
                className="h-10 w-full rounded-lg border px-3 text-sm"
                placeholder="Mã tài khoản hạch toán"
                value={form.accountCode}
                onChange={(e) =>
                  setForm((prev) => ({
                    ...prev,
                    accountCode: e.target.value,
                  }))
                }
              />

              <div className="flex gap-2">
                <button
                  onClick={handleSave}
                  className="flex-1 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white"
                >
                  {editingId ? "Cập nhật" : "Thêm mới"}
                </button>

                {editingId && (
                  <button
                    onClick={() => {
                      setForm(emptyForm)
                      setEditingId(null)
                    }}
                    className="rounded-lg border px-4 py-2 text-sm font-semibold"
                  >
                    Hủy
                  </button>
                )}
              </div>
            </div>
          </div>

          <div className="overflow-hidden rounded-xl bg-white shadow-sm">
            <table className="w-full border-collapse text-sm">
              <thead className="bg-slate-50">
                <tr>
                  <th className="border-b p-3 text-left">Mã SP</th>
                  <th className="border-b p-3 text-left">Tên sản phẩm</th>
                  <th className="border-b p-3 text-right">Đơn giá</th>
                  <th className="border-b p-3 text-right">Thuế</th>
                  <th className="border-b p-3 text-left">TK hạch toán</th>
                  <th className="border-b p-3 text-center">Thao tác</th>
                </tr>
              </thead>

              <tbody>
                {products.map((item) => (
                  <tr key={item.id} className="hover:bg-blue-50">
                    <td className="border-b p-3 font-semibold">{item.code}</td>
                    <td className="border-b p-3">{item.name}</td>
                    <td className="border-b p-3 text-right">
                      {formatMoney(item.unitPrice)}
                    </td>
                    <td className="border-b p-3 text-right">{item.taxRate}%</td>
                    <td className="border-b p-3">{item.accountCode}</td>
                    <td className="border-b p-3">
                      <div className="flex justify-center gap-2">
                        <button
                          onClick={() => {
                            setForm(item)
                            setEditingId(item.id)
                          }}
                          className="rounded border border-blue-300 px-3 py-1 text-xs font-semibold text-blue-700"
                        >
                          Sửa
                        </button>
                        <button
                          onClick={() => handleDelete(item.id)}
                          className="rounded border border-red-300 px-3 py-1 text-xs font-semibold text-red-600"
                        >
                          Xóa
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {!products.length && (
              <div className="p-6 text-center text-sm text-slate-500">
                Chưa có dữ liệu
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
