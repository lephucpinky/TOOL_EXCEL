"use client"

import ReduxProvider from "@/store/provider"
import { useAppDispatch, useAppSelector } from "@/store/hooks"
import { authActions } from "@/store/slices"
import { Geist, Geist_Mono } from "next/font/google"
import { usePathname, useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import "./globals.css"
import { metadata } from "./metadata"

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
})

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
})

const PUBLIC_ROUTES = ["/", "/login"] as const

function isPublicRoute(pathname: string) {
  return PUBLIC_ROUTES.some((route) => {
    if (route === "/") {
      return pathname === "/"
    }

    return pathname === route || pathname.startsWith(`${route}/`)
  })
}

function AuthGate({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  const dispatch = useAppDispatch()
  const router = useRouter()
  const pathname = usePathname()
  const accessToken = useAppSelector((state) => state.auth.accessToken)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const token = localStorage.getItem("access_token")
    const refreshToken = localStorage.getItem("refresh_token")

    if (token) {
      dispatch(
        authActions.hydrateAuth({
          accessToken: token,
          refreshToken,
        })
      )
    } else {
      dispatch(authActions.logout())
    }
  }, [dispatch])

  useEffect(() => {
    const token = accessToken ?? localStorage.getItem("access_token")
    const publicRoute = isPublicRoute(pathname)

    if (!token && !publicRoute) {
      router.replace("/login")
      return
    }

    if (token && pathname === "/login") {
      router.replace("/quan-ly-ban-hang")
      return
    }

    setIsLoading(false)
  }, [accessToken, pathname, router])

  return isLoading ? (
    <div className="flex min-h-screen items-center justify-center">
      Đang tải...
    </div>
  ) : (
    <>{children}</>
  )
}

function RootLayoutContent({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en">
      <head>
        <title>{String(metadata.title) ?? "Default Title"}</title>
      </head>

      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <ReduxProvider>
          <AuthGate>{children}</AuthGate>
        </ReduxProvider>
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
