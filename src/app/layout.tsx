"use client"

import ReduxProvider from "@/store/provider"
import { useAppDispatch, useAppSelector } from "@/store/hooks"
import { authActions } from "@/store/slices"
import { Geist, Geist_Mono } from "next/font/google"
import { usePathname, useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import "./globals.css"
import { metadata } from "./metadata"
import { Loader2 } from "lucide-react"
import { jwtDecode } from "jwt-decode"

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
})

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
})

const PUBLIC_ROUTES = ["/", "/login"] as const
const ADMIN_ROUTES = [
  "/quan-ly-ban-hang/tai-khoan",
  "/quan-ly-ban-hang/register",
] as const

type TokenProfile = {
  role?: string
  roles?: string[] | string
}

function isPublicRoute(pathname: string) {
  return PUBLIC_ROUTES.some((route) => {
    if (route === "/") {
      return pathname === "/"
    }

    return pathname === route || pathname.startsWith(`${route}/`)
  })
}

function isAdminRoute(pathname: string) {
  return ADMIN_ROUTES.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`)
  )
}

function getTokenRole(token: string) {
  try {
    const profile = jwtDecode<TokenProfile>(token)
    const role = Array.isArray(profile.roles)
      ? profile.roles[0]
      : profile.roles || profile.role

    return String(role || "")
      .trim()
      .toLowerCase()
  } catch {
    return ""
  }
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
    const username = localStorage.getItem("auth_username")

    if (token) {
      dispatch(
        authActions.hydrateAuth({
          accessToken: token,
          refreshToken,
          username,
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

    if (
      token &&
      isAdminRoute(pathname) &&
      !["admin", "manager"].includes(getTokenRole(token))
    ) {
      router.replace("/quan-ly-ban-hang")
      return
    }

    setIsLoading(false)
  }, [accessToken, pathname, router])
  return isLoading ? (
    <div className="flex min-h-screen items-center justify-center">
      <div className="flex w-[360px] flex-col items-center rounded-2xl px-8 py-7 text-center">
        <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-full bg-blue-50 text-blue-600">
          <Loader2 size={32} className="animate-spin" />
        </div>

        <h2 className="text-base font-bold text-slate-900">Đang tải dữ liệu</h2>

        <p className="mt-1 text-sm font-medium text-slate-500">
          Vui lòng chờ trong giây lát...
        </p>
      </div>
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
