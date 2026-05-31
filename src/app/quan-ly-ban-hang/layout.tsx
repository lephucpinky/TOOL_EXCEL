import type { Metadata } from "next"

import SalesShell from "../../components/header/SalesShell"

export const metadata: Metadata = {
  title: "M-Invoice | Quản lý bán hàng",
  description: "Quản lý bán hàng, hóa đơn, đại lý và danh mục",
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <SalesShell>{children}</SalesShell>
}
