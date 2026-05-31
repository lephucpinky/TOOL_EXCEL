"use client"

import type { FormEvent } from "react"
import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import {
  ArrowLeft,
  Eye,
  EyeOff,
  Loader2,
  ShieldCheck,
  UserRound,
  UserRoundPlus,
} from "lucide-react"

import { APICreateUser } from "@/services/user"
import { getErrorMessage } from "@/store/utils/crud"
import type { UserRole } from "@/types/user"
import PageHeader from "../../../components/header/PageHeader"

const ROLE_OPTIONS: Array<{
  value: UserRole
  label: string
  description: string
}> = [
  {
    value: "ADMIN",
    label: "Admin",
    description: "Quản trị hệ thống",
  },
  {
    value: "USER",
    label: "User",
    description: "Người dùng thường",
  },
]

export default function RegisterPage() {
  const router = useRouter()

  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [role, setRole] = useState<UserRole>("USER")
  const [loading, setLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState("")
  const [successMessage, setSuccessMessage] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)

  const clearMessages = () => {
    setErrorMessage("")
    setSuccessMessage("")
  }

  const resetForm = () => {
    setUsername("")
    setPassword("")
    setConfirmPassword("")
    setRole("USER")
    setShowPassword(false)
    setShowConfirmPassword(false)
  }

  const handleRegister = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    const nextUsername = username.trim()
    const nextPassword = password.trim()
    const nextConfirmPassword = confirmPassword.trim()

    if (!nextUsername) {
      setSuccessMessage("")
      setErrorMessage("Vui lòng nhập tên đăng nhập")
      return
    }

    if (!nextPassword) {
      setSuccessMessage("")
      setErrorMessage("Vui lòng nhập mật khẩu")
      return
    }

    if (nextPassword !== nextConfirmPassword) {
      setSuccessMessage("")
      setErrorMessage("Mật khẩu xác nhận không khớp")
      return
    }

    try {
      clearMessages()
      setLoading(true)

      await APICreateUser({
        username: nextUsername,
        password: nextPassword,
      })

      setSuccessMessage("Tạo tài khoản thành công")
      resetForm()

      setTimeout(() => {
        router.replace("/quan-ly-ban-hang/tai-khoan")
      }, 900)
    } catch (error) {
      setSuccessMessage("")
      setErrorMessage(getErrorMessage(error) || "Tạo tài khoản thất bại")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen p-5">
      {successMessage && (
        <div className="fixed right-5 top-24 z-50 w-[320px] rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700 shadow-lg">
          {successMessage}
        </div>
      )}

      {errorMessage && (
        <div className="fixed right-5 top-24 z-50 w-[320px] rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700 shadow-lg">
          {errorMessage}
        </div>
      )}

      <div className="mx-auto max-w-5xl space-y-5">
        <PageHeader
          icon={<UserRoundPlus size={24} />}
          eyebrow="Quản trị hệ thống"
          title="Tạo tài khoản"
          description="Admin tạo tài khoản đăng nhập mới và phân quyền theo vai trò."
          tone="cyan"
          actions={
            <Link
              href="/quan-ly-ban-hang/tai-khoan"
              className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-4 text-sm font-bold text-slate-700 transition hover:bg-slate-50"
            >
              <ArrowLeft size={18} />
              Danh sách tài khoản
            </Link>
          }
        />

        <div className="grid gap-5 lg:grid-cols-[1fr_0.75fr]">
          <form
            className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm"
            onSubmit={handleRegister}
          >
            <div className="mb-5 flex items-center gap-3 border-b border-slate-100 pb-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
                <UserRound size={20} />
              </div>
              <div>
                <div className="text-base font-bold text-slate-900">
                  Thông tin tài khoản
                </div>
                <div className="text-sm text-slate-500">
                  Tên đăng nhập, mật khẩu và vai trò
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label
                  className="mb-1.5 block text-sm font-semibold text-slate-700"
                  htmlFor="register-username"
                >
                  Tên đăng nhập
                </label>

                <input
                  id="register-username"
                  value={username}
                  onChange={(event) => {
                    setUsername(event.target.value)
                    clearMessages()
                  }}
                  placeholder="Nhập tên đăng nhập"
                  className="h-11 w-full rounded-lg border border-slate-300 px-3 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                  disabled={loading}
                />
              </div>

              <div>
                <label
                  className="mb-1.5 block text-sm font-semibold text-slate-700"
                  htmlFor="register-password"
                >
                  Mật khẩu
                </label>

                <div className="relative">
                  <input
                    id="register-password"
                    value={password}
                    onChange={(event) => {
                      setPassword(event.target.value)
                      clearMessages()
                    }}
                    placeholder="Nhập mật khẩu"
                    type={showPassword ? "text" : "password"}
                    className="h-11 w-full rounded-lg border border-slate-300 px-3 pr-11 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                    disabled={loading}
                  />

                  <button
                    type="button"
                    onClick={() => setShowPassword((prev) => !prev)}
                    className="absolute right-2 top-1/2 inline-flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-md text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 disabled:cursor-not-allowed disabled:opacity-60"
                    disabled={loading}
                    aria-label={showPassword ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              <div>
                <label
                  className="mb-1.5 block text-sm font-semibold text-slate-700"
                  htmlFor="register-confirm-password"
                >
                  Xác nhận mật khẩu
                </label>

                <div className="relative">
                  <input
                    id="register-confirm-password"
                    value={confirmPassword}
                    onChange={(event) => {
                      setConfirmPassword(event.target.value)
                      clearMessages()
                    }}
                    placeholder="Nhập lại mật khẩu"
                    type={showConfirmPassword ? "text" : "password"}
                    className="h-11 w-full rounded-lg border border-slate-300 px-3 pr-11 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                    disabled={loading}
                  />

                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword((prev) => !prev)}
                    className="absolute right-2 top-1/2 inline-flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-md text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 disabled:cursor-not-allowed disabled:opacity-60"
                    disabled={loading}
                    aria-label={
                      showConfirmPassword
                        ? "Ẩn xác nhận mật khẩu"
                        : "Hiện xác nhận mật khẩu"
                    }
                  >
                    {showConfirmPassword ? (
                      <EyeOff size={18} />
                    ) : (
                      <Eye size={18} />
                    )}
                  </button>
                </div>
              </div>

              <div>
                <div className="mb-2 block text-sm font-semibold text-slate-700">
                  Vai trò
                </div>

                <div className="grid grid-cols-2 gap-2">
                  {ROLE_OPTIONS.map((item) => {
                    const active = role === item.value
                    const Icon =
                      item.value === "ADMIN" ? ShieldCheck : UserRound

                    return (
                      <button
                        key={item.value}
                        type="button"
                        onClick={() => {
                          setRole(item.value)
                          clearMessages()
                        }}
                        className={`rounded-lg border px-3 py-3 text-left transition disabled:cursor-not-allowed disabled:opacity-60 ${
                          active
                            ? "border-blue-600 bg-blue-50 text-blue-700"
                            : "border-slate-200 bg-white text-slate-700 hover:border-blue-200 hover:bg-slate-50"
                        }`}
                        disabled={loading}
                      >
                        <div className="flex items-center gap-2 text-sm font-bold">
                          <Icon size={17} />
                          {item.label}
                        </div>
                        <div className="mt-1 text-xs text-slate-500">
                          {item.description}
                        </div>
                      </button>
                    )
                  })}
                </div>
              </div>

              <div className="flex flex-col-reverse gap-2 border-t border-slate-100 pt-4 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={() => {
                    resetForm()
                    clearMessages()
                  }}
                  disabled={loading}
                  className="h-10 rounded-lg border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Làm mới
                </button>

                <button
                  type="submit"
                  disabled={loading}
                  className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-blue-600 px-5 text-sm font-bold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {loading && <Loader2 size={16} className="animate-spin" />}
                  {loading ? "Đang tạo..." : "Tạo tài khoản"}
                </button>
              </div>
            </div>
          </form>

          <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-100 text-slate-600">
                <ShieldCheck size={20} />
              </div>
              <div>
                <div className="text-base font-bold text-slate-900">
                  Phân quyền
                </div>
                <div className="text-sm text-slate-500">
                  Role gửi lên API dạng ADMIN hoặc USER
                </div>
              </div>
            </div>

            <div className="mt-2 divide-y divide-slate-100">
              {ROLE_OPTIONS.map((item) => (
                <div key={item.value} className="py-3">
                  <div className="text-sm font-bold text-slate-900">
                    {item.label}
                  </div>
                  <div className="mt-1 text-sm text-slate-500">
                    {item.description}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
