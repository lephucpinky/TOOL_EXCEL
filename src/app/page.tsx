"use client"

import { useAppDispatch, useAppSelector } from "@/store/hooks"
import { loginThunk } from "@/store/slices"
import { getErrorMessage } from "@/store/utils/crud"
import { Eye, EyeOff, Loader2 } from "lucide-react"
import { useRouter } from "next/navigation"
import { useState } from "react"

export default function LoginPage() {
  const router = useRouter()
  const dispatch = useAppDispatch()
  const loading = useAppSelector((state) => state.auth.loading)

  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const [errorMessage, setErrorMessage] = useState("")
  const [successMessage, setSuccessMessage] = useState("")
  const [showPassword, setShowPassword] = useState(false)

  const handleLogin = async () => {
    if (!username.trim()) {
      setSuccessMessage("")
      setErrorMessage("Vui lòng nhập tên đăng nhập")
      return
    }

    if (!password.trim()) {
      setSuccessMessage("")
      setErrorMessage("Vui lòng nhập mật khẩu")
      return
    }

    try {
      setErrorMessage("")
      setSuccessMessage("")

      const response = await dispatch(
        loginThunk({
          username: username.trim(),
          password: password.trim(),
        })
      ).unwrap()

      const token = response?.accessToken
      const refreshToken = response?.refreshToken

      if (!token) {
        setSuccessMessage("")
        setErrorMessage("Sai tên đăng nhập hoặc mật khẩu")
        return
      }

      localStorage.setItem("access_token", token)
      localStorage.setItem("auth_username", username.trim())

      if (refreshToken) {
        localStorage.setItem("refresh_token", refreshToken)
      } else {
        localStorage.removeItem("refresh_token")
      }

      setSuccessMessage("Đăng nhập thành công")

      setTimeout(() => {
        router.replace("/quan-ly-ban-hang")
      }, 800)
    } catch (error: any) {
      setSuccessMessage("")

      const status = error?.response?.status
      const message = getErrorMessage(error, "Đăng nhập thất bại")

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
    }
  }

  return (
    <div className="min-h-screen bg-slate-100">
      {successMessage && (
        <div className="fixed right-5 top-5 z-50 w-[320px] rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700 shadow-lg">
          {successMessage}
        </div>
      )}

      {errorMessage && (
        <div className="fixed right-5 top-5 z-50 w-[320px] rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700 shadow-lg">
          {errorMessage}
        </div>
      )}
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

            <div className="space-y-4">
              <div>
                <label className="mb-1.5 block text-sm font-semibold text-slate-700">
                  Tên đăng nhập
                </label>

                <input
                  value={username}
                  onChange={(e) => {
                    setUsername(e.target.value)
                    setErrorMessage("")
                    setSuccessMessage("")
                  }}
                  placeholder="Nhập tên đăng nhập"
                  className="h-11 w-full rounded-lg border border-slate-300 px-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                />
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-semibold text-slate-700">
                  Mật khẩu
                </label>

                <div className="relative">
                  <input
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value)
                      setErrorMessage("")
                      setSuccessMessage("")
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        void handleLogin()
                      }
                    }}
                    placeholder="Nhập mật khẩu"
                    type={showPassword ? "text" : "password"}
                    className="h-11 w-full rounded-lg border border-slate-300 px-3 pr-11 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                  />

                  <button
                    type="button"
                    onClick={() => setShowPassword((prev) => !prev)}
                    className="absolute right-2 top-1/2 inline-flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-md text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
                    aria-label={showPassword ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              <button
                onClick={() => void handleLogin()}
                disabled={loading}
                className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-blue-600 text-sm font-bold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loading ? (
                  <Loader2 size={20} className="animate-spin" />
                ) : (
                  "Đăng nhập"
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
