"use client"

import { Geist, Geist_Mono } from "next/font/google"
import { Provider } from "react-redux"
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
      const isLoginPage = pathname === "/"

      if (!token && !isLoginPage) {
        router.replace("/")
      }

      setIsLoading(false)
    }

    // Chạy sau khi component mount
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
