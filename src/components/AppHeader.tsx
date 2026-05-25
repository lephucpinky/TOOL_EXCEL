"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"

const menus = [
  {
    label: "Quản lý hóa đơn",
    href: "/quan-ly-ban-hang/danh-sach",
    matchPrefixes: ["/quan-ly-ban-hang/cau-hinh-hoa-don"],
  },
  {
    label: "Quản lý đại lý",
    href: "/quan-ly-ban-hang/dai-ly",
  },
  {
    label: "Danh sách sản phẩm",
    href: "/quan-ly-ban-hang/san-pham",
  },
  {
    label: "Quản lý phòng ban",
    href: "/quan-ly-ban-hang/phong-ban",
  },
  {
    label: "Quản lý nhân viên",
    href: "/quan-ly-ban-hang/nhan-vien",
  },
  {
    label: "Đối soát",
    href: "/quan-ly-ban-hang/doi-soat",
  },
  {
    label: "Ngân hàng",
    href: "/quan-ly-ban-hang/ngan-hang",
  },
]

export default function AppHeader() {
  const pathname = usePathname()

  return (
    <header className="sticky top-0 z-50 border-b border-slate-200 bg-white">
      <div className="flex h-[72px] items-center gap-8 px-5">
        <Link
          href="/quan-ly-ban-hang"
          className="flex h-[75px] w-[100px] items-center gap-3"
        >
          <img
            className="h-full w-full"
            src="/images/logo_minvoice.png"
            alt=""
          />
        </Link>

        <nav className="flex min-w-0 flex-1 items-center gap-2 overflow-x-auto">
          {menus.map((item) => {
            const active =
              pathname === item.href ||
              pathname.startsWith(`${item.href}/`) ||
              item.matchPrefixes?.some(
                (prefix) =>
                  pathname === prefix || pathname.startsWith(`${prefix}/`)
              )

            return (
              <Link
                key={item.href}
                href={item.href}
                className={
                  active
                    ? "whitespace-nowrap rounded-xl bg-blue-50 px-4 py-2 text-[15px] font-bold text-blue-700"
                    : "whitespace-nowrap rounded-xl px-4 py-2 text-[15px] font-semibold text-slate-700 transition hover:bg-slate-100 hover:text-blue-700"
                }
              >
                {item.label}
              </Link>
            )
          })}
        </nav>
      </div>
    </header>
  )
}
