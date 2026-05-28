"use client"
import { LayoutDashboard, Loader2 } from "lucide-react"

import { useAppSelector } from "@/store/hooks"

export default function Page() {
  const isAuthenticated = useAppSelector((state) => state.auth.isAuthenticated)

  if (!isAuthenticated) {
    return (
      <div className="flex min-h-[calc(100vh-72px)] items-center justify-center px-4">
        <div className="flex items-center gap-3 rounded-lg px-5 py-4 text-sm font-semibold text-slate-600">
          <Loader2 size={20} className="animate-spin text-blue-600" />
        </div>
      </div>
    )
  }

  return (
    <div className="px-4 py-6 lg:px-6">
      <div className="mx-auto max-w-7xl space-y-5">
        <section className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-col gap-4 p-5 lg:flex-row lg:items-center">
            <div className="flex min-w-0 items-start gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg border border-blue-100 bg-blue-50 text-blue-700">
                <LayoutDashboard size={24} />
              </div>

              <div className="min-w-0">
                <div className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-500">
                  Sales workspace
                </div>

                <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-500">
                  Quản trị hóa đơn, đại lý, nhân viên, sản phẩm và dữ liệu đối
                  soát.
                </p>
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}
