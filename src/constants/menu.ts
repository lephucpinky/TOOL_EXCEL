export type UserRole = "admin" | "manager" | "user"

type NavItem = {
  label: string
  href: string
  exact?: boolean
  matchPrefixes?: string[]
  hiddenForRoles?: UserRole[]
}

export const navItems: NavItem[] = [
  {
    label: "Tổng quan",
    href: "/quan-ly-ban-hang",
    exact: true,
  },
  {
    label: "Hóa đơn",
    href: "/quan-ly-ban-hang/danh-sach",
  },
  {
    label: "Đại lý",
    href: "/quan-ly-ban-hang/dai-ly",
  },
  {
    label: "Sản phẩm",
    href: "/quan-ly-ban-hang/san-pham",
  },
  {
    label: "Phòng ban",
    href: "/quan-ly-ban-hang/phong-ban",
  },
  {
    label: "Nhân viên",
    href: "/quan-ly-ban-hang/nhan-vien",
  },
  {
    label: "Tài khoản",
    href: "/quan-ly-ban-hang/tai-khoan",
    hiddenForRoles: ["user"],
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
