import type { Metadata } from "next"

import AppHeader from "@/components/AppHeader"

export const metadata: Metadata = {
  title: "M-Invoice",
  description: "Quản lý hóa đơn",
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="vi">
      <body>
        <AppHeader />
        <main className="min-h-[calc(100vh-72px)] bg-slate-100">
          {children}
        </main>
      </body>
    </html>
  )
}
