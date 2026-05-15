"use client"

import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"

export default function Page() {
  const router = useRouter()
  const [checked, setChecked] = useState(false)

  useEffect(() => {
    const token = localStorage.getItem("access_token")

    if (!token) {
      router.replace("/login")
      return
    }

    setChecked(true)
  }, [router])

  const handleLogout = () => {
    localStorage.removeItem("access_token")
    localStorage.removeItem("refresh_token")
    router.replace("/")
  }

  if (!checked) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-100">
        <div className="rounded-xl bg-white px-6 py-4 text-sm font-semibold text-slate-600 shadow-sm">
          Đang kiểm tra đăng nhập...
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-100 p-5">
      <div className="mx-auto max-w-7xl space-y-5">
        <div className="rounded-xl bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-bold text-slate-900">
                Quản lý bán hàng
              </h1>
              <p className="mt-1 text-sm text-slate-500">
                Trang quản trị phần mềm kế toán.
              </p>
            </div>

            <button
              onClick={handleLogout}
              className="rounded-lg border border-red-200 px-4 py-2 text-sm font-semibold text-red-600 hover:bg-red-50"
            >
              Đăng xuất
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
