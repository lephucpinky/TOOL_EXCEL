"use client"

import AlertError from "@/components/alert/AlertError"
import AlertOption from "@/components/alert/AlertOption"
import AlertSuccess from "@/components/alert/AlertSuccess"
import DataTable, { DataTableColumn } from "@/components/common/Datatable"
import {
  APIDeleteUser,
  APIGetUserById,
  APIGetUsers,
  APIUpdateUser,
} from "@/services/user"
import { getErrorMessage } from "@/store/utils/crud"
import type { UpdateUserPayload, UserAccount, UserRole } from "@/types/user"
import {
  Eye,
  EyeOff,
  Loader2,
  Plus,
  RefreshCcw,
  Search,
  UsersRound,
  X,
} from "lucide-react"
import Link from "next/link"
import { ReactNode, useEffect, useMemo, useState } from "react"
import PageHeader from "../_components/PageHeader"

const LIST_PARAMS = {
  page: 1,
  limit: 1000,
}

const ROLE_OPTIONS: Array<{
  value: UserRole
  label: string
}> = [
  { value: "ADMIN", label: "Admin" },
  { value: "USER", label: "User" },
]

type ModeType = "view" | "edit" | null

type UserFormValues = {
  username: string
  password: string
  role: UserRole
  isActive: boolean
}

interface ActionModalProps {
  open: boolean
  title: string
  children: ReactNode
  onClose: () => void
  footer?: ReactNode
}

function ActionModal({
  open,
  title,
  children,
  onClose,
  footer,
}: ActionModalProps) {
  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
      <div className="w-full max-w-xl rounded-2xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <h2 className="text-base font-bold text-slate-900">{title}</h2>

          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 transition hover:bg-slate-100 hover:text-slate-900"
          >
            <X size={18} />
          </button>
        </div>

        <div className="px-5 py-4">{children}</div>

        {footer && (
          <div className="flex justify-end gap-2 border-t border-slate-100 px-5 py-4">
            {footer}
          </div>
        )}
      </div>
    </div>
  )
}

function extractUsers(value: unknown): UserAccount[] {
  if (Array.isArray(value)) return value as UserAccount[]

  if (value && typeof value === "object") {
    const candidate = value as Record<string, unknown>

    if (Array.isArray(candidate.items)) return candidate.items as UserAccount[]
    if (Array.isArray(candidate.docs)) return candidate.docs as UserAccount[]
    if (Array.isArray(candidate.results)) {
      return candidate.results as UserAccount[]
    }
    if (Array.isArray(candidate.data)) return candidate.data as UserAccount[]
    if (Array.isArray(candidate.users)) return candidate.users as UserAccount[]
  }

  return []
}

function extractUser(value: unknown): UserAccount | null {
  if (!value || Array.isArray(value)) return null

  if (typeof value === "object") {
    const candidate = value as Record<string, unknown>

    if (candidate.user && typeof candidate.user === "object") {
      return candidate.user as UserAccount
    }
  }

  return value as UserAccount
}

function getUserId(user: UserAccount) {
  return user._id || user.id || ""
}

function getUsername(user: UserAccount) {
  return user.username || user.userName || user.email || "-"
}

function normalizeRole(value: unknown): UserRole {
  return String(value || "").toUpperCase() === "ADMIN" ? "ADMIN" : "USER"
}

function buildFormValues(user: UserAccount | null): UserFormValues {
  return {
    username: user ? getUsername(user) : "",
    password: "",
    role: normalizeRole(user?.role),
    isActive: user?.isActive ?? true,
  }
}

function formatDate(value?: string) {
  if (!value) return "-"

  const date = new Date(value)

  if (Number.isNaN(date.getTime())) return "-"

  return date.toLocaleDateString("vi-VN")
}

export default function AccountManagementPage() {
  const [users, setUsers] = useState<UserAccount[]>([])
  const [selectedUser, setSelectedUser] = useState<UserAccount | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<UserAccount | null>(null)
  const [mode, setMode] = useState<ModeType>(null)
  const [open, setOpen] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [detailLoading, setDetailLoading] = useState(false)
  const [submitLoading, setSubmitLoading] = useState(false)
  const [deleteLoading, setDeleteLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [keyword, setKeyword] = useState("")
  const [roleFilter, setRoleFilter] = useState<"ALL" | UserRole>("ALL")
  const [showSuccess, setShowSuccess] = useState(false)
  const [showError, setShowError] = useState(false)
  const [message, setMessage] = useState("")
  const [formValues, setFormValues] = useState<UserFormValues>(
    buildFormValues(null)
  )

  const isViewMode = mode === "view"
  const isEditMode = mode === "edit"

  const showSuccessMessage = (text: string) => {
    setMessage(text)
    setShowSuccess(true)
    setTimeout(() => setShowSuccess(false), 3000)
  }

  const showErrorMessage = (text: string) => {
    setMessage(text)
    setShowError(true)
    setTimeout(() => setShowError(false), 3000)
  }

  const fetchUsers = async () => {
    setLoading(true)

    try {
      const response = await APIGetUsers(LIST_PARAMS)
      setUsers(extractUsers(response.data))
    } catch (error) {
      showErrorMessage(
        getErrorMessage(error) || "Không thể tải danh sách tài khoản"
      )
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void fetchUsers()
  }, [])

  const filteredUsers = useMemo(() => {
    const normalizedKeyword = keyword.trim().toLowerCase()

    return users.filter((user) => {
      const matchesKeyword =
        !normalizedKeyword ||
        getUsername(user).toLowerCase().includes(normalizedKeyword) ||
        getUserId(user).toLowerCase().includes(normalizedKeyword)
      const matchesRole =
        roleFilter === "ALL" || normalizeRole(user.role) === roleFilter

      return matchesKeyword && matchesRole
    })
  }, [keyword, roleFilter, users])

  const columns = useMemo<DataTableColumn<UserAccount>[]>(
    () => [
      {
        key: "index",
        title: "STT",
        className: "w-[70px] text-slate-500",
        render: (_item, index) => index + 1,
      },
      {
        key: "username",
        title: "Tên đăng nhập",
        render: (item) => (
          <div className="text-center">
            <p className="font-semibold text-slate-900">{getUsername(item)}</p>
          </div>
        ),
      },
      {
        key: "role",
        title: "Vai trò",
        render: (item) => {
          const role = normalizeRole(item.role)

          return (
            <span
              className={[
                "inline-flex rounded-full px-3 py-1 text-xs font-bold",
                role === "ADMIN"
                  ? "bg-blue-50 text-blue-700"
                  : "bg-slate-100 text-slate-700",
              ].join(" ")}
            >
              {role}
            </span>
          )
        },
      },
      {
        key: "isActive",
        title: "Trạng thái",
        render: (item) =>
          item.isActive === false ? (
            <span className="inline-flex rounded-full bg-red-50 px-3 py-1 text-xs font-bold text-red-700">
              Ngừng hoạt động
            </span>
          ) : (
            <span className="inline-flex rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700">
              Hoạt động
            </span>
          ),
      },
      {
        key: "createdAt",
        title: "Ngày tạo",
        render: (item) => (
          <span className="text-sm text-slate-600">
            {formatDate(item.createdAt)}
          </span>
        ),
      },
    ],
    []
  )

  const handleCloseDialog = () => {
    if (submitLoading || detailLoading) return

    setOpen(false)
    setMode(null)
    setSelectedUser(null)
    setShowPassword(false)
    setFormValues(buildFormValues(null))
  }

  const openUserDialog = async (user: UserAccount, nextMode: ModeType) => {
    const id = getUserId(user)

    if (!id) {
      showErrorMessage("Không tìm thấy ID tài khoản")
      return
    }

    setMode(nextMode)
    setOpen(true)
    setDetailLoading(true)
    setSelectedUser(user)
    setFormValues(buildFormValues(user))

    try {
      const response = await APIGetUserById(id)
      const detail = extractUser(response.data) || user

      setSelectedUser(detail)
      setFormValues(buildFormValues(detail))
    } catch (error) {
      showErrorMessage(
        getErrorMessage(error) || "Không thể tải chi tiết tài khoản"
      )
    } finally {
      setDetailLoading(false)
    }
  }

  const handleUpdateUser = async () => {
    if (!selectedUser) return

    const id = getUserId(selectedUser)
    const nextUsername = formValues.username.trim()
    const nextPassword = formValues.password.trim()

    if (!id) {
      showErrorMessage("Không tìm thấy ID tài khoản")
      return
    }

    if (!nextUsername) {
      showErrorMessage("Vui lòng nhập tên đăng nhập")
      return
    }

    const payload: UpdateUserPayload = {
      username: nextUsername,
      role: formValues.role,
      isActive: formValues.isActive,
    }

    if (nextPassword) {
      payload.password = nextPassword
    }

    setSubmitLoading(true)

    try {
      await APIUpdateUser(id, payload)
      await fetchUsers()
      showSuccessMessage("Cập nhật tài khoản thành công!")
      handleCloseDialog()
    } catch (error) {
      showErrorMessage(getErrorMessage(error) || "Cập nhật tài khoản thất bại!")
    } finally {
      setSubmitLoading(false)
    }
  }

  const onDeleteClick = (user: UserAccount) => {
    if (!getUserId(user)) {
      showErrorMessage("Không tìm thấy ID tài khoản")
      return
    }

    setDeleteTarget(user)
    setDeleteDialogOpen(true)
  }

  const handleDeleteUser = async () => {
    if (!deleteTarget) return

    const id = getUserId(deleteTarget)

    if (!id) return

    setDeleteLoading(true)

    try {
      await APIDeleteUser(id)
      await fetchUsers()
      showSuccessMessage("Xóa tài khoản thành công!")
      setDeleteDialogOpen(false)
      setDeleteTarget(null)
    } catch (error) {
      showErrorMessage(getErrorMessage(error) || "Xóa tài khoản thất bại!")
    } finally {
      setDeleteLoading(false)
    }
  }

  return (
    <div className="min-h-screen p-5">
      <div className="mx-auto max-w-7xl space-y-5">
        <PageHeader
          icon={<UsersRound size={24} />}
          eyebrow="Quản trị hệ thống"
          title="Quản lý tài khoản"
          description="Theo dõi, cập nhật vai trò và quản lý danh sách tài khoản đăng nhập."
          tone="cyan"
          actions={
            <>
              <Link
                href="/quan-ly-ban-hang/register"
                className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 text-sm font-bold text-white transition hover:bg-blue-700"
              >
                <Plus size={18} />
                Tạo tài khoản
              </Link>

              <button
                type="button"
                onClick={() => void fetchUsers()}
                disabled={loading}
                className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-4 text-sm font-bold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <RefreshCcw
                  size={18}
                  className={loading ? "animate-spin" : undefined}
                />
                Tải dữ liệu
              </button>
            </>
          }
        />

        <DataTable
          data={filteredUsers}
          columns={columns}
          loading={loading}
          emptyText="Chưa có dữ liệu tài khoản"
          getRowKey={(item, index) => getUserId(item) || String(index)}
          pagination={{ itemLabel: "tài khoản" }}
          onView={(user) => void openUserDialog(user, "view")}
          onEdit={(user) => void openUserDialog(user, "edit")}
          onDelete={onDeleteClick}
        >
          <div className="relative">
            <Search
              size={16}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
            />
            <input
              value={keyword}
              onChange={(event) => setKeyword(event.target.value)}
              placeholder="Tìm tài khoản..."
              className="h-10 w-56 rounded-lg border border-slate-200 bg-white pl-9 pr-3 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            />
          </div>

          <select
            value={roleFilter}
            onChange={(event) =>
              setRoleFilter(event.target.value as "ALL" | UserRole)
            }
            className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
          >
            <option value="ALL">Tất cả vai trò</option>
            {ROLE_OPTIONS.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
        </DataTable>
      </div>

      <ActionModal
        open={open}
        title={isViewMode ? "Chi tiết tài khoản" : "Chỉnh sửa tài khoản"}
        onClose={handleCloseDialog}
        footer={
          isViewMode ? (
            <button
              type="button"
              onClick={handleCloseDialog}
              className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-bold text-white transition hover:bg-slate-800"
            >
              Đóng
            </button>
          ) : (
            <>
              <button
                type="button"
                onClick={() => void handleUpdateUser()}
                disabled={submitLoading || detailLoading}
                className="inline-flex min-w-[120px] items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-bold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {submitLoading && (
                  <Loader2 size={16} className="animate-spin" />
                )}
                Cập nhật
              </button>

              <button
                type="button"
                onClick={handleCloseDialog}
                disabled={submitLoading || detailLoading}
                className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Hủy
              </button>
            </>
          )
        }
      >
        {detailLoading ? (
          <div className="flex items-center justify-center gap-2 py-8 text-sm text-slate-500">
            <Loader2 size={18} className="animate-spin" />
            Đang tải dữ liệu tài khoản...
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <label
                htmlFor="account-username"
                className="mb-1.5 block text-sm font-semibold text-slate-700"
              >
                Tên đăng nhập
              </label>

              <input
                id="account-username"
                value={formValues.username}
                onChange={(event) =>
                  setFormValues((prev) => ({
                    ...prev,
                    username: event.target.value,
                  }))
                }
                disabled={isViewMode || !isEditMode}
                className="h-10 w-full rounded-lg border border-slate-200 px-3 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:bg-slate-50 disabled:text-slate-500"
              />
            </div>

            {!isViewMode && (
              <div>
                <label
                  htmlFor="account-password"
                  className="mb-1.5 block text-sm font-semibold text-slate-700"
                >
                  Mật khẩu mới
                </label>

                <div className="relative">
                  <input
                    id="account-password"
                    value={formValues.password}
                    onChange={(event) =>
                      setFormValues((prev) => ({
                        ...prev,
                        password: event.target.value,
                      }))
                    }
                    placeholder="Để trống nếu không đổi mật khẩu"
                    type={showPassword ? "text" : "password"}
                    className="h-10 w-full rounded-lg border border-slate-200 px-3 pr-10 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
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
            )}

            <div>
              <label
                htmlFor="account-role"
                className="mb-1.5 block text-sm font-semibold text-slate-700"
              >
                Vai trò
              </label>

              <select
                id="account-role"
                value={formValues.role}
                onChange={(event) =>
                  setFormValues((prev) => ({
                    ...prev,
                    role: event.target.value as UserRole,
                  }))
                }
                disabled={isViewMode}
                className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:bg-slate-50 disabled:text-slate-500"
              >
                {ROLE_OPTIONS.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label
                htmlFor="account-is-active"
                className="mb-1.5 block text-sm font-semibold text-slate-700"
              >
                Trạng thái
              </label>

              <label
                htmlFor="account-is-active"
                className="flex h-11 items-center gap-3 rounded-lg border border-slate-200 px-3"
              >
                <input
                  id="account-is-active"
                  type="checkbox"
                  checked={formValues.isActive}
                  disabled={isViewMode}
                  onChange={(event) =>
                    setFormValues((prev) => ({
                      ...prev,
                      isActive: event.target.checked,
                    }))
                  }
                  className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 disabled:cursor-not-allowed"
                />
                <span className="text-sm font-medium text-slate-700">
                  Đang hoạt động
                </span>
              </label>
            </div>

            <div className="grid gap-3 rounded-lg border border-slate-100 bg-slate-50 p-3 text-sm text-slate-600 sm:grid-cols-2">
              <div>
                <div className="font-semibold text-slate-700">ID</div>
                <div className="mt-1 break-all">
                  {getUserId(selectedUser || {}) || "-"}
                </div>
              </div>
              <div>
                <div className="font-semibold text-slate-700">Ngày tạo</div>
                <div className="mt-1">
                  {formatDate(selectedUser?.createdAt)}
                </div>
              </div>
            </div>
          </div>
        )}
      </ActionModal>

      <AlertOption
        isOpen={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        onConfirm={() => void handleDeleteUser()}
        title="Xác nhận thao tác"
        description={`Hành động này sẽ xóa tài khoản "${getUsername(
          deleteTarget || {}
        )}" khỏi hệ thống và không thể hoàn tác. Bạn có chắc chắn tiếp tục?`}
        confirmText={deleteLoading ? "Đang xóa..." : "Xóa"}
        cancelText="Hủy"
        tone="destructive"
      />

      {showSuccess && <AlertSuccess description={message} />}
      {showError && <AlertError description={message} />}
    </div>
  )
}
