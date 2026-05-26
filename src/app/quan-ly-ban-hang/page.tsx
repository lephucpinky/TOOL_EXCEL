"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import {
  ArrowRight,
  Building2,
  ClipboardCheck,
  FileText,
  Landmark,
  LayoutDashboard,
  Loader2,
  LogOut,
  PackageSearch,
  ReceiptText,
  Settings2,
  ShieldCheck,
  UserRound,
  UsersRound,
} from "lucide-react"

import { useAppDispatch, useAppSelector } from "@/store/hooks"
import { authActions } from "@/store/slices"

const modules = [
  {
    title: "Quản lý hóa đơn",
    description: "Theo dõi, tạo mới và xuất hóa đơn bán hàng.",
    href: "/quan-ly-ban-hang/danh-sach",
    icon: ReceiptText,
    tone: "border-blue-100 bg-blue-50 text-blue-700",
  },
  {
    title: "Đại lý",
    description: "Quản lý danh sách đại lý và tỷ lệ hoa hồng.",
    href: "/quan-ly-ban-hang/dai-ly",
    icon: UsersRound,
    tone: "border-emerald-100 bg-emerald-50 text-emerald-700",
  },
  {
    title: "Sản phẩm",
    description: "Chuẩn hóa mã hàng, đơn vị tính và giá bán.",
    href: "/quan-ly-ban-hang/san-pham",
    icon: PackageSearch,
    tone: "border-amber-100 bg-amber-50 text-amber-700",
  },
  {
    title: "Phòng ban",
    description: "Tổ chức dữ liệu theo bộ phận kinh doanh.",
    href: "/quan-ly-ban-hang/phong-ban",
    icon: Building2,
    tone: "border-violet-100 bg-violet-50 text-violet-700",
  },
  {
    title: "Nhân viên",
    description: "Theo dõi nhân viên phụ trách và trạng thái hoạt động.",
    href: "/quan-ly-ban-hang/nhan-vien",
    icon: UserRound,
    tone: "border-cyan-100 bg-cyan-50 text-cyan-700",
  },
  {
    title: "Đối soát",
    description: "Xuất file đối soát, hoa hồng và mẫu hóa đơn.",
    href: "/quan-ly-ban-hang/doi-soat",
    icon: ClipboardCheck,
    tone: "border-rose-100 bg-rose-50 text-rose-700",
  },
  {
    title: "Ngân hàng",
    description: "Quản lý tài khoản ngân hàng dùng trên hóa đơn.",
    href: "/quan-ly-ban-hang/ngan-hang",
    icon: Landmark,
    tone: "border-slate-200 bg-slate-50 text-slate-700",
  },
  {
    title: "Cấu hình hóa đơn",
    description: "Thiết lập ký hiệu hóa đơn và mã số thuế.",
    href: "/quan-ly-ban-hang/cau-hinh-hoa-don",
    icon: Settings2,
    tone: "border-indigo-100 bg-indigo-50 text-indigo-700",
  },
]

export default function Page() {
  const router = useRouter()
  const dispatch = useAppDispatch()
  const isAuthenticated = useAppSelector((state) => state.auth.isAuthenticated)

  const handleLogout = () => {
    localStorage.removeItem("access_token")
    localStorage.removeItem("refresh_token")
    dispatch(authActions.logout())
    router.replace("/login")
  }

  if (!isAuthenticated) {
    return (
      <div className="flex min-h-[calc(100vh-72px)] items-center justify-center px-4">
        <div className="flex items-center gap-3 rounded-lg border border-slate-200 bg-white px-5 py-4 text-sm font-semibold text-slate-600 shadow-sm">
          <Loader2 size={18} className="animate-spin text-blue-600" />
          Đang kiểm tra đăng nhập...
        </div>
      </div>
    )
  }

  return (
    <div className="px-4 py-6 lg:px-6">
      <div className="mx-auto max-w-7xl space-y-5">
        <section className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-col gap-4 p-5 lg:flex-row lg:items-center lg:justify-between">
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

            <button
              type="button"
              onClick={handleLogout}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-red-200 bg-white px-4 text-sm font-semibold text-red-600 transition hover:bg-red-50"
            >
              <LogOut size={17} />
              Đăng xuất
            </button>
          </div>
        </section>
      </div>
    </div>
  )
}
