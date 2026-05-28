"use client"

import {
  ChevronDown,
  Eye,
  EyeOff,
  KeyRound,
  Loader2,
  LogOut,
  UserRound,
} from "lucide-react"
import { jwtDecode } from "jwt-decode"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import type { FormEvent, ReactNode } from "react"
import { useMemo, useState } from "react"

import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { APIChangePassword } from "@/services/auth"
import { useAppDispatch, useAppSelector } from "@/store/hooks"
import { authActions } from "@/store/slices"
import { getErrorMessage } from "@/store/utils/crud"
import { navItems } from "@/constants/menu"

type TokenProfile = {
  username?: string
  userName?: string
  preferred_username?: string
  name?: string
  email?: string
  sub?: string
  role?: string
  roles?: string[] | string
}

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ")
}

function getAccountNameFromToken(token: string | null) {
  if (!token) return null

  try {
    const profile = jwtDecode<TokenProfile>(token)

    return (
      profile.username ||
      profile.userName ||
      profile.preferred_username ||
      profile.name ||
      profile.email ||
      profile.sub ||
      null
    )
  } catch {
    return null
  }
}

export default function SalesShell({ children }: { children: ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const dispatch = useAppDispatch()
  const accessToken = useAppSelector((state) => state.auth.accessToken)
  const username = useAppSelector((state) => state.auth.username)

  const [accountMenuOpen, setAccountMenuOpen] = useState(false)
  const [passwordDialogOpen, setPasswordDialogOpen] = useState(false)
  const [oldPassword, setOldPassword] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [changePasswordLoading, setChangePasswordLoading] = useState(false)
  const [changePasswordError, setChangePasswordError] = useState("")
  const [changePasswordSuccess, setChangePasswordSuccess] = useState("")
  const [showOldPassword, setShowOldPassword] = useState(false)
  const [showNewPassword, setShowNewPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)

  const accountName = useMemo(
    () => username || getAccountNameFromToken(accessToken) || "Tài khoản",
    [accessToken, username]
  )
  const currentRole = useMemo(() => {
    if (!accessToken) return ""

    try {
      const profile = jwtDecode<TokenProfile>(accessToken)

      const role = Array.isArray(profile.roles)
        ? profile.roles[0]
        : profile.roles || profile.role

      return String(role || "").toLowerCase()
    } catch {
      return ""
    }
  }, [accessToken])

  const visibleNavItems = useMemo(() => {
    if (currentRole !== "user") return navItems

    return navItems.filter(
      (item) => item.href !== "/quan-ly-ban-hang/tai-khoan"
    )
  }, [currentRole])

  const resetChangePasswordForm = () => {
    setOldPassword("")
    setNewPassword("")
    setConfirmPassword("")
    setChangePasswordError("")
    setChangePasswordSuccess("")
    setShowOldPassword(false)
    setShowNewPassword(false)
    setShowConfirmPassword(false)
  }

  const handleOpenPasswordDialog = () => {
    resetChangePasswordForm()
    setAccountMenuOpen(false)
    setPasswordDialogOpen(true)
  }

  const handleChangePassword = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setChangePasswordError("")
    setChangePasswordSuccess("")

    if (!oldPassword.trim()) {
      setChangePasswordError("Vui lòng nhập mật khẩu hiện tại.")
      return
    }

    if (!newPassword.trim()) {
      setChangePasswordError("Vui lòng nhập mật khẩu mới.")
      return
    }

    if (newPassword !== confirmPassword) {
      setChangePasswordError("Mật khẩu mới và xác nhận mật khẩu không khớp.")
      return
    }

    try {
      setChangePasswordLoading(true)

      await APIChangePassword({
        oldPassword: oldPassword,
        newPassword: newPassword,
      })
      setChangePasswordSuccess("Đổi mật khẩu thành công.")
      setOldPassword("")
      setNewPassword("")
      setConfirmPassword("")

      setTimeout(() => {
        setPasswordDialogOpen(false)
        setChangePasswordSuccess("")
      }, 800)
    } catch (error) {
      setChangePasswordError(getErrorMessage(error))
    } finally {
      setChangePasswordLoading(false)
    }
  }

  const handleLogout = () => {
    localStorage.removeItem("access_token")
    localStorage.removeItem("refresh_token")
    localStorage.removeItem("auth_username")
    dispatch(authActions.logout())
    router.replace("/login")
  }

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900">
      {changePasswordSuccess && (
        <div className="fixed right-5 top-5 z-[9999] w-[320px] rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700 shadow-lg">
          {changePasswordSuccess}
        </div>
      )}

      {changePasswordError && (
        <div className="fixed right-5 top-5 z-[9999] w-[320px] rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700 shadow-lg">
          {changePasswordError}
        </div>
      )}
      <header className="sticky top-0 z-50 border-b border-slate-200 bg-white/95 shadow-sm backdrop-blur">
        <div className="mx-auto flex h-[72px] max-w-[1600px] items-center gap-4 px-4 lg:px-6">
          <Link
            href="/quan-ly-ban-hang"
            className="flex shrink-0 items-center gap-3 rounded-lg px-2 py-1.5 transition hover:bg-slate-50"
          >
            <img
              className="w-[100px] object-contain"
              src="/images/logo_minvoice.png"
              alt="M-Invoice"
            />
          </Link>

          <nav className="flex min-w-0 flex-1 items-center justify-center gap-1 overflow-x-auto py-2">
            {visibleNavItems.map((item) => {
              const active =
                item.exact && item.href === "/quan-ly-ban-hang"
                  ? pathname === item.href
                  : pathname === item.href ||
                    pathname.startsWith(`${item.href}/`) ||
                    Boolean(
                      item.matchPrefixes?.some(
                        (prefix) =>
                          pathname === prefix ||
                          pathname.startsWith(`${prefix}/`)
                      )
                    )

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "inline-flex h-10 shrink-0 items-center gap-2 rounded-lg px-3 text-sm font-semibold transition",
                    active
                      ? "bg-blue-600 text-white shadow-sm shadow-blue-200"
                      : "text-slate-600 hover:bg-slate-100 hover:text-slate-950"
                  )}
                  aria-current={active ? "page" : undefined}
                >
                  <span>{item.label}</span>
                </Link>
              )
            })}
          </nav>

          <Popover open={accountMenuOpen} onOpenChange={setAccountMenuOpen}>
            <PopoverTrigger asChild>
              <button
                type="button"
                className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 shadow-sm transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700"
                aria-label="Mở menu tài khoản"
              >
                <UserRound size={20} />
              </button>
            </PopoverTrigger>

            <PopoverContent
              align="end"
              sideOffset={10}
              className="w-72 overflow-hidden rounded-lg border-slate-200 p-0 text-slate-900 shadow-lg"
            >
              <div className="border-b border-slate-100 bg-slate-50 px-4 py-3">
                <div className="mt-1 flex min-w-0 items-center gap-2 text-sm font-semibold text-slate-900">
                  <UserRound size={16} className="shrink-0 text-blue-600" />
                  <span className="truncate">{accountName}</span>
                </div>
              </div>

              <div className="p-2">
                <button
                  type="button"
                  onClick={handleOpenPasswordDialog}
                  className="flex h-10 w-full items-center justify-between rounded-md px-3 text-left text-sm font-semibold text-slate-700 transition hover:bg-slate-100 hover:text-slate-950"
                >
                  <span className="flex items-center gap-2">
                    <KeyRound size={16} className="text-slate-500" />
                    Đổi mật khẩu
                  </span>
                  <ChevronDown
                    size={15}
                    className="-rotate-90 text-slate-400"
                  />
                </button>

                <button
                  type="button"
                  onClick={handleLogout}
                  className="mt-1 flex h-10 w-full items-center gap-2 rounded-md px-3 text-left text-sm font-semibold text-red-600 transition hover:bg-red-50"
                >
                  <LogOut size={16} />
                  Đăng xuất
                </button>
              </div>
            </PopoverContent>
          </Popover>
        </div>
      </header>

      <main className="min-h-[calc(100vh-72px)] bg-[linear-gradient(180deg,#f8fafc_0%,#eef2f7_42%,#f8fafc_100%)]">
        {children}
      </main>

      <Dialog
        open={passwordDialogOpen}
        onOpenChange={(open) => {
          setPasswordDialogOpen(open)

          if (!open) {
            resetChangePasswordForm()
          }
        }}
      >
        <DialogContent className="w-[calc(100vw-2rem)] max-w-md overflow-hidden rounded-lg border-slate-200 p-0 text-slate-900">
          <DialogHeader className="border-b border-slate-100 px-5 py-4">
            <DialogTitle className="flex items-center gap-2 text-base font-bold">
              <KeyRound size={18} className="text-blue-600" />
              Đổi mật khẩu
            </DialogTitle>
          </DialogHeader>

          <form className="space-y-4 px-5 pb-4" onSubmit={handleChangePassword}>
            <div className="space-y-1.5">
              <Label htmlFor="old-password">Mật khẩu hiện tại</Label>

              <div className="relative">
                <Input
                  id="old-password"
                  type={showOldPassword ? "text" : "password"}
                  value={oldPassword}
                  onChange={(event) => {
                    setOldPassword(event.target.value)
                    setChangePasswordError("")
                    setChangePasswordSuccess("")
                  }}
                  placeholder="Nhập mật khẩu hiện tại"
                  className="h-10 pr-10"
                  disabled={changePasswordLoading}
                />

                <button
                  type="button"
                  onClick={() => setShowOldPassword((prev) => !prev)}
                  className="absolute right-2 top-1/2 inline-flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-md text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
                  disabled={changePasswordLoading}
                  aria-label={
                    showOldPassword
                      ? "Ẩn mật khẩu hiện tại"
                      : "Hiện mật khẩu hiện tại"
                  }
                >
                  {showOldPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="new-password">Mật khẩu mới</Label>

              <div className="relative">
                <Input
                  id="new-password"
                  type={showNewPassword ? "text" : "password"}
                  value={newPassword}
                  onChange={(event) => {
                    setNewPassword(event.target.value)
                    setChangePasswordError("")
                    setChangePasswordSuccess("")
                  }}
                  placeholder="Nhập mật khẩu mới"
                  className="h-10 pr-10"
                  disabled={changePasswordLoading}
                />

                <button
                  type="button"
                  onClick={() => setShowNewPassword((prev) => !prev)}
                  className="absolute right-2 top-1/2 inline-flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-md text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
                  disabled={changePasswordLoading}
                  aria-label={
                    showNewPassword ? "Ẩn mật khẩu mới" : "Hiện mật khẩu mới"
                  }
                >
                  {showNewPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="confirm-password">Xác nhận mật khẩu mới</Label>

              <div className="relative">
                <Input
                  id="confirm-password"
                  type={showConfirmPassword ? "text" : "password"}
                  value={confirmPassword}
                  onChange={(event) => {
                    setConfirmPassword(event.target.value)
                    setChangePasswordError("")
                    setChangePasswordSuccess("")
                  }}
                  placeholder="Nhập lại mật khẩu mới"
                  className="h-10 pr-10"
                  disabled={changePasswordLoading}
                />

                <button
                  type="button"
                  onClick={() => setShowConfirmPassword((prev) => !prev)}
                  className="absolute right-2 top-1/2 inline-flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-md text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
                  disabled={changePasswordLoading}
                  aria-label={
                    showConfirmPassword
                      ? "Ẩn xác nhận mật khẩu mới"
                      : "Hiện xác nhận mật khẩu mới"
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

            <DialogFooter className="gap-2 border-t border-slate-100 pt-4 sm:space-x-0">
              <button
                type="button"
                onClick={() => setPasswordDialogOpen(false)}
                className="inline-flex h-10 items-center justify-center rounded-lg border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                disabled={changePasswordLoading}
              >
                Hủy
              </button>

              <button
                type="submit"
                className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
                disabled={changePasswordLoading}
              >
                {changePasswordLoading && (
                  <Loader2 size={16} className="animate-spin" />
                )}
                Cập nhật
              </button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
