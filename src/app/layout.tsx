"use client"

import { Geist, Geist_Mono } from "next/font/google"
import "./globals.css"
import { metadata } from "./metadata"
import { useEffect, useState } from "react"
import { useRouter, usePathname } from "next/navigation"

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
})

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
})

// Các route được phép vào không cần đăng nhập
const PUBLIC_ROUTES = [
  "/", // app/page.tsx - trang đối soát hiện tại của bạn
  "/login",
] as const

function isPublicRoute(pathname: string) {
  return PUBLIC_ROUTES.some((route) => {
    if (route === "/") {
      return pathname === "/"
    }

    return pathname === route || pathname.startsWith(`${route}/`)
  })
}

function RootLayoutContent({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  const router = useRouter()
  const pathname = usePathname()
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const checkAuth = () => {
      const token = localStorage.getItem("access_token")
      const publicRoute = isPublicRoute(pathname)

      // Nếu chưa đăng nhập và route không public thì mới đá về login
      if (!token && !publicRoute) {
        router.replace("/login")
        return
      }

      // Nếu đã đăng nhập mà vào /login thì đẩy về trang chính
      if (token && pathname === "/login") {
        router.replace("/")
        return
      }

      setIsLoading(false)
    }

    checkAuth()
  }, [pathname, router])

  return (
    <html lang="en">
      <head>
        <title>{String(metadata.title) ?? "Default Title"}</title>
      </head>

      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {isLoading ? (
          <div className="flex min-h-screen items-center justify-center">
            Đang tải...
          </div>
        ) : (
          children
        )}
      </body>
    </html>
  )
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return <RootLayoutContent>{children}</RootLayoutContent>
}
