"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  Building2,
  ClipboardCheck,
  FileText,
  Landmark,
  LayoutDashboard,
  PackageSearch,
  ReceiptText,
  Settings2,
  UserRound,
  UsersRound,
} from "lucide-react"
import type { ReactNode } from "react"

type NavItem = {
  label: string
  href: string
  icon: typeof LayoutDashboard
  exact?: boolean
  matchPrefixes?: string[]
}

const navItems: NavItem[] = [
  {
    label: "Tổng quan",
    href: "/quan-ly-ban-hang",
    icon: LayoutDashboard,
    exact: true,
  },
  {
    label: "Hóa đơn",
    href: "/quan-ly-ban-hang/danh-sach",
    icon: ReceiptText,
  },
  {
    label: "Đại lý",
    href: "/quan-ly-ban-hang/dai-ly",
    icon: UsersRound,
  },
  {
    label: "Sản phẩm",
    href: "/quan-ly-ban-hang/san-pham",
    icon: PackageSearch,
  },
  {
    label: "Phòng ban",
    href: "/quan-ly-ban-hang/phong-ban",
    icon: Building2,
  },
  {
    label: "Nhân viên",
    href: "/quan-ly-ban-hang/nhan-vien",
    icon: UserRound,
  },
  {
    label: "Đối soát",
    href: "/quan-ly-ban-hang/doi-soat",
    icon: ClipboardCheck,
  },
  {
    label: "Ngân hàng",
    href: "/quan-ly-ban-hang/ngan-hang",
    icon: Landmark,
  },
]

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ")
}

export default function SalesShell({ children }: { children: ReactNode }) {
  const pathname = usePathname()

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900">
      <header className="sticky top-0 z-50 border-b border-slate-200 bg-white/95 shadow-sm backdrop-blur">
        <div className="mx-auto flex h-[72px] max-w-[1600px] items-center gap-4 px-4 lg:px-6">
          <Link
            href="/quan-ly-ban-hang"
            className="flex shrink-0 items-center gap-3 rounded-lg px-2 py-1.5 transition hover:bg-slate-50"
          >
            <img
              className="h-11 w-16 object-contain"
              src="/images/logo_minvoice.png"
              alt="M-Invoice"
            />
            <div className="hidden min-w-[150px] xl:block">
              <div className="text-[11px] font-bold uppercase tracking-[0.16em] text-blue-600">
                M-Invoice
              </div>
              <div className="text-sm font-bold text-slate-900">
                Quản lý bán hàng
              </div>
            </div>
          </Link>

          <nav className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto py-2">
            {navItems.map((item) => {
              const Icon = item.icon
              const active =
                item.exact && item.href === "/quan-ly-ban-hang"
                  ? pathname === item.href
                  : pathname === item.href ||
                    pathname.startsWith(`${item.href}/`) ||
                    Boolean(
                      item.matchPrefixes?.some(
                        (prefix) =>
                          pathname === prefix ||
                          pathname.startsWith(`${prefix}/`)
                      )
                    )

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "inline-flex h-10 shrink-0 items-center gap-2 rounded-lg px-3 text-sm font-semibold transition",
                    active
                      ? "bg-blue-600 text-white shadow-sm shadow-blue-200"
                      : "text-slate-600 hover:bg-slate-100 hover:text-slate-950"
                  )}
                  aria-current={active ? "page" : undefined}
                >
                  <Icon size={17} />
                  <span>{item.label}</span>
                </Link>
              )
            })}
          </nav>

          <div className="hidden h-10 items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 text-xs font-semibold text-slate-500 lg:flex">
            <FileText size={15} className="text-slate-400" />
            <span>Sales workspace</span>
          </div>
        </div>
      </header>

      <main className="min-h-[calc(100vh-72px)] bg-[linear-gradient(180deg,#f8fafc_0%,#eef2f7_42%,#f8fafc_100%)]">
        {children}
      </main>
    </div>
  )
}
