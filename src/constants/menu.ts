export type UserRole = "admin" | "manager" | "user"

export type NavGroup = "main" | "category"

export type NavItem = {
  label: string
  href: string
  exact?: boolean
  matchPrefixes?: string[]
  hiddenForRoles?: UserRole[]
  group?: NavGroup
}

export const navItems: NavItem[] = [
  {
    label: "Tổng quan",
    href: "/quan-ly-ban-hang",
    exact: true,
    group: "main",
  },
  {
    label: "Hóa đơn",
    href: "/quan-ly-ban-hang/danh-sach",
    group: "main",
  },
  {
    label: "Báo cáo",
    href: "/quan-ly-ban-hang/doi-soat",
    group: "main",
  },

  {
    label: "Đại lý",
    href: "/quan-ly-ban-hang/dai-ly",
    group: "category",
  },
  {
    label: "Sản phẩm",
    href: "/quan-ly-ban-hang/san-pham",
    group: "category",
  },
  {
    label: "Phòng ban",
    href: "/quan-ly-ban-hang/phong-ban",
    group: "category",
  },
  {
    label: "Nhân viên",
    href: "/quan-ly-ban-hang/nhan-vien",
    group: "category",
  },
  {
    label: "Tài khoản",
    href: "/quan-ly-ban-hang/tai-khoan",
    hiddenForRoles: ["user"],
    group: "category",
  },
  {
    label: "Ngân hàng",
    href: "/quan-ly-ban-hang/ngan-hang",
    group: "category",
  },
]
