"use client"

import { APILogin } from "@/services/auth"
import { useRouter } from "next/navigation"
import { useState } from "react"

export default function LoginPage() {
  const router = useRouter()

  const [username, setUsername] = useState("tuanNd")
  const [password, setPassword] = useState("minvoice")
  const [loading, setLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState("")

  const handleLogin = async () => {
    if (!username.trim()) {
      setErrorMessage("Vui lòng nhập tên đăng nhập")
      return
    }

    if (!password.trim()) {
      setErrorMessage("Vui lòng nhập mật khẩu")
      return
    }

    try {
      setLoading(true)
      setErrorMessage("")

      const response = await APILogin({
        username: username.trim(),
        password: password.trim(),
      })

      const token =
        response?.content?.access_token ||
        response?.content?.accessToken ||
        response?.access_token ||
        response?.accessToken

      const refreshToken =
        response?.content?.refresh_token ||
        response?.content?.refreshToken ||
        response?.refresh_token ||
        response?.refreshToken

      if (!token) {
        setErrorMessage("Đăng nhập thành công nhưng không nhận được token")
        return
      }

      localStorage.setItem("access_token", token)

      if (refreshToken) {
        localStorage.setItem("refresh_token", refreshToken)
      }

      router.replace("/quan-ly-ban-hang")
    } catch (err: any) {
      console.error("Login error:", err)

      const status = err?.response?.status
      const message =
        err?.response?.data?.message ||
        err?.response?.data?.error ||
        "Đăng nhập thất bại"

      if (status === 403) {
        setErrorMessage(
          "Tài khoản không có quyền truy cập hoặc thiếu secret key"
        )
        return
      }

      if (status === 401) {
        setErrorMessage("Sai tên đăng nhập hoặc mật khẩu")
        return
      }

      setErrorMessage(message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-slate-100">
      <div className="grid min-h-screen lg:grid-cols-[1.1fr_0.9fr]">
        <div className="bg-Charcoal p-10 text-white lg:flex lg:flex-col lg:justify-between">
          <div>
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white/15 text-lg font-bold">
                KT
              </div>

              <div>
                <h1 className="text-xl font-bold">Phần mềm kế toán</h1>
                <p className="text-sm text-blue-100">
                  Hệ thống quản lý bán hàng
                </p>
              </div>
            </div>
          </div>

          <div className="max-w-xl">
            <h2 className="text-4xl font-bold leading-tight">
              Quản lý bán hàng, hóa đơn, đại lý và hoa hồng.
            </h2>

            <p className="mt-4 text-base leading-7 text-blue-100">
              Đăng nhập để sử dụng hệ thống quản trị dữ liệu kế toán và bán
              hàng.
            </p>
          </div>

          <p className="text-sm text-blue-100">
            © 2026 Accounting Management System
          </p>
        </div>

        <div className="flex items-center justify-center p-5">
          <div className="w-full max-w-md rounded-2xl bg-white p-7 shadow-sm">
            <div className="mb-7">
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-blue-600 text-lg font-bold text-white lg:hidden">
                KT
              </div>

              <h1 className="text-2xl font-bold text-slate-900">Đăng nhập</h1>

              <p className="mt-1 text-sm text-slate-500">
                Vui lòng đăng nhập tài khoản quản trị.
              </p>
            </div>

            {errorMessage && (
              <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-600">
                {errorMessage}
              </div>
            )}

            <div className="space-y-4">
              <div>
                <label className="mb-1.5 block text-sm font-semibold text-slate-700">
                  Tên đăng nhập
                </label>

                <input
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Nhập tên đăng nhập"
                  className="h-11 w-full rounded-lg border border-slate-300 px-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                />
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-semibold text-slate-700">
                  Mật khẩu
                </label>

                <input
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      handleLogin()
                    }
                  }}
                  placeholder="Nhập mật khẩu"
                  type="password"
                  className="h-11 w-full rounded-lg border border-slate-300 px-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                />
              </div>

              <button
                onClick={handleLogin}
                disabled={loading}
                className="h-11 w-full rounded-lg bg-blue-600 text-sm font-bold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loading ? "Đang đăng nhập..." : "Đăng nhập"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
