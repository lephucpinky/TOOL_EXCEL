"use client"

import AlertError from "@/components/alert/AlertError"
import AlertOption from "@/components/alert/AlertOption"
import AlertSuccess from "@/components/alert/AlertSuccess"
import DataTable from "@/components/common/Datatable"
import type { DataTableColumn } from "@/components/common/Datatable"
import PageHeader from "../../../components/header/PageHeader"
import {
  APIDeleteUser,
  APIGetUserById,
  APIGetUsers,
  APIUpdateUser,
} from "@/services/user"
import { getErrorMessage } from "@/store/utils/crud"
import type { UserAccount, UserRole } from "@/types/user"
import {
  Eye,
  EyeOff,
  Loader2,
  Plus,
  RefreshCcw,
  Search,
  UsersRound,
} from "lucide-react"
import Link from "next/link"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import ActionModal from "@/components/modal/ActionModal"
import {
  getUrlPaginationParams,
  URL_PAGE_SIZE_OPTIONS,
} from "@/utils/pagination"
import { scheduleDelayedRefresh } from "@/utils/refresh"

const ROLE_OPTIONS: Array<{
  value: UserRole
  label: string
}> = [
  { value: "ADMIN", label: "Admin" },
  { value: "USER", label: "User" },
]

type ModeType = "view" | "edit"

type UserFormValues = {
  username: string
  password: string
  role: UserRole
  isActive: boolean
}

function normalizeUserList(value: unknown): UserAccount[] {
  if (Array.isArray(value)) return value
  if (!value || typeof value !== "object") return []

  const candidate = value as Record<string, unknown>

  if (Array.isArray(candidate.items)) return candidate.items as UserAccount[]
  if (Array.isArray(candidate.docs)) return candidate.docs as UserAccount[]
  if (Array.isArray(candidate.results)) {
    return candidate.results as UserAccount[]
  }
  if (Array.isArray(candidate.data)) return candidate.data as UserAccount[]

  return []
}

export default function AccountManagementPage() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()
  const [users, setUsers] = useState<UserAccount[]>([])
  const [userPagination, setUserPagination] = useState({
    total: 0,
    page: 1,
    limit: 10,
    totalPages: 1,
  })
  const [selectedUser, setSelectedUser] = useState<UserAccount | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<UserAccount | null>(null)

  const [mode, setMode] = useState<ModeType>("view")
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

  const [formValues, setFormValues] = useState<UserFormValues>({
    username: "",
    password: "",
    role: "USER",
    isActive: true,
  })

  const successTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const errorTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const detailRequestRef = useRef(0)

  const isViewMode = mode === "view"
  const isEditMode = mode === "edit"
  const { page: listPage, limit: listLimit } =
    getUrlPaginationParams(searchParams)
  const listParams = useMemo(
    () => ({
      page: listPage,
      limit: listLimit,
      keyword: keyword.trim() || undefined,
      role: roleFilter === "ALL" ? undefined : roleFilter,
    }),
    [keyword, listLimit, listPage, roleFilter]
  )

  const showSuccessMessage = useCallback((text: string) => {
    if (successTimerRef.current) {
      clearTimeout(successTimerRef.current)
    }
    if (errorTimerRef.current) {
      clearTimeout(errorTimerRef.current)
    }

    setMessage(text)
    setShowSuccess(true)
    setShowError(false)

    successTimerRef.current = setTimeout(() => {
      setShowSuccess(false)
    }, 3000)
  }, [])

  const showErrorMessage = useCallback((text: string) => {
    if (errorTimerRef.current) {
      clearTimeout(errorTimerRef.current)
    }
    if (successTimerRef.current) {
      clearTimeout(successTimerRef.current)
    }

    setMessage(text)
    setShowError(true)
    setShowSuccess(false)

    errorTimerRef.current = setTimeout(() => {
      setShowError(false)
    }, 3000)
  }, [])

  const fetchUsers = useCallback(
    async (params = listParams) => {
      setLoading(true)

      try {
        const response = await APIGetUsers(params)
        const nextUsers = normalizeUserList(response.data)
        const requestedPage = Math.max(Number(params.page ?? 1), 1)
        const requestedLimit = Math.max(Number(params.limit ?? 10), 1)
        const responseLimit = Math.max(
          Number(response.limit ?? requestedLimit),
          1
        )

        setUsers(nextUsers)
        setUserPagination({
          total: Math.max(Number(response.total ?? nextUsers.length), 0),
          page: Math.max(Number(response.page ?? requestedPage), 1),
          limit: responseLimit,
          totalPages: Math.max(
            Number(
              response.totalPages ??
                Math.ceil(
                  Number(response.total ?? nextUsers.length) / responseLimit
                )
            ),
            1
          ),
        })
      } catch (error) {
        showErrorMessage(
          getErrorMessage(error, "Không thể tải danh sách tài khoản")
        )
      } finally {
        setLoading(false)
      }
    },
    [listParams, showErrorMessage]
  )

  useEffect(() => {
    void fetchUsers()
  }, [fetchUsers])

  useEffect(() => {
    return () => {
      if (successTimerRef.current) {
        clearTimeout(successTimerRef.current)
      }

      if (errorTimerRef.current) {
        clearTimeout(errorTimerRef.current)
      }
    }
  }, [])

  const filteredUsers = useMemo(() => {
    const normalizedKeyword = keyword.trim().toLowerCase()

    return users.filter((user) => {
      const matchesKeyword =
        !normalizedKeyword ||
        user.username?.toLowerCase().includes(normalizedKeyword) ||
        user._id?.toLowerCase().includes(normalizedKeyword)

      const matchesRole = roleFilter === "ALL" || user.role === roleFilter

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
            <p className="font-semibold text-slate-900">
              {item.username || "-"}
            </p>
          </div>
        ),
      },
      {
        key: "role",
        title: "Vai trò",
        render: (item) => (
          <span
            className={[
              "inline-flex rounded-full px-3 py-1 text-xs font-bold",
              item.role === "ADMIN"
                ? "bg-blue-50 text-blue-700"
                : "bg-slate-100 text-slate-700",
            ].join(" ")}
          >
            {item.role || "-"}
          </span>
        ),
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
            {item.createdAt && !Number.isNaN(new Date(item.createdAt).getTime())
              ? new Date(item.createdAt).toLocaleDateString("vi-VN")
              : "-"}
          </span>
        ),
      },
    ],
    []
  )

  const resetDialog = () => {
    setOpen(false)
    setMode("view")
    setSelectedUser(null)
    setShowPassword(false)
    setFormValues({
      username: "",
      password: "",
      role: "USER",
      isActive: true,
    })
    detailRequestRef.current += 1
  }

  const handleCloseDialog = () => {
    if (submitLoading || detailLoading) return

    resetDialog()
  }

  const openUserDialog = async (user: UserAccount, nextMode: ModeType) => {
    if (!user._id) {
      showErrorMessage("Không tìm thấy ID tài khoản")
      return
    }

    const requestId = detailRequestRef.current + 1
    detailRequestRef.current = requestId

    setMode(nextMode)
    setOpen(true)
    setDetailLoading(true)
    setSelectedUser(user)
    setShowPassword(false)
    setFormValues({
      username: user.username || "",
      password: "",
      role: user.role === "ADMIN" ? "ADMIN" : "USER",
      isActive: user.isActive ?? true,
    })

    try {
      const response = await APIGetUserById(user._id)

      if (detailRequestRef.current !== requestId) return

      const detail = response.data as UserAccount

      if (!detail?._id) {
        throw new Error("Dữ liệu chi tiết tài khoản không đúng định dạng")
      }

      setSelectedUser(detail)
      setFormValues({
        username: detail.username || "",
        password: "",
        role: detail.role === "ADMIN" ? "ADMIN" : "USER",
        isActive: detail.isActive ?? true,
      })
    } catch (error) {
      if (detailRequestRef.current !== requestId) return

      showErrorMessage(
        getErrorMessage(error, "Không thể tải chi tiết tài khoản")
      )
    } finally {
      if (detailRequestRef.current === requestId) {
        setDetailLoading(false)
      }
    }
  }

  const handleUpdateUser = async () => {
    if (submitLoading || !selectedUser) return

    const nextUsername = formValues.username.trim()
    const nextPassword = formValues.password

    if (!selectedUser._id) {
      showErrorMessage("Không tìm thấy ID tài khoản")
      return
    }

    if (!nextUsername) {
      showErrorMessage("Vui lòng nhập tên đăng nhập")
      return
    }

    if (nextPassword.length > 0 && nextPassword.trim().length === 0) {
      showErrorMessage("Mật khẩu không được chỉ gồm khoảng trắng")
      return
    }

    const payload: {
      username: string
      password?: string
    } = {
      username: nextUsername,
    }

    if (nextPassword.length > 0) {
      payload.password = nextPassword
    }

    setSubmitLoading(true)

    try {
      const response = await APIUpdateUser(selectedUser._id, payload)

      const updatedUser: UserAccount = {
        ...selectedUser,
        ...(response.data as UserAccount),
        username: nextUsername,
      }

      setUsers((prev) =>
        prev.map((item) => (item._id === selectedUser._id ? updatedUser : item))
      )

      showSuccessMessage("Cập nhật tài khoản thành công!")
      resetDialog()
    } catch (error) {
      showErrorMessage(getErrorMessage(error, "Cập nhật tài khoản thất bại!"))
    } finally {
      setSubmitLoading(false)
    }
  }

  const onDeleteClick = (user: UserAccount) => {
    if (!user._id) {
      showErrorMessage("Không tìm thấy ID tài khoản")
      return
    }

    setDeleteTarget(user)
    setDeleteDialogOpen(true)
  }

  const handleDeleteUser = async () => {
    if (deleteLoading || !deleteTarget) return

    if (!deleteTarget._id) {
      showErrorMessage("Không tìm thấy ID tài khoản")
      return
    }

    setDeleteLoading(true)

    try {
      const deletedUserId = deleteTarget._id
      await APIDeleteUser(deletedUserId)

      setUsers((prev) => prev.filter((item) => item._id !== deletedUserId))
      showSuccessMessage("Xóa tài khoản thành công!")
      setDeleteDialogOpen(false)
      setDeleteTarget(null)
      if (selectedUser?._id === deletedUserId) {
        resetDialog()
      }

      const nextTotal = Math.max(userPagination.total - 1, 0)
      const nextTotalPages = Math.max(Math.ceil(nextTotal / listLimit), 1)
      const nextPage = Math.min(listPage, nextTotalPages)
      const nextParams = { ...listParams, page: nextPage, limit: listLimit }
      setUserPagination((prev) => ({
        ...prev,
        total: nextTotal,
        totalPages: nextTotalPages,
        page: nextPage,
      }))

      if (nextPage !== listPage) {
        router.replace(`${pathname}?page=${nextPage}&limit=${listLimit}`)
      }

      scheduleDelayedRefresh(
        async () => {
          await fetchUsers(nextParams)
        },
        (error) => {
          showErrorMessage(
            getErrorMessage(error, "Không thể tải lại danh sách tài khoản")
          )
        }
      )
    } catch (error) {
      showErrorMessage(getErrorMessage(error, "Xóa tài khoản thất bại!"))
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
          description=""
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
          getRowKey={(item) => item._id || ""}
          pagination={{
            itemLabel: "tài khoản",
            pageSizeOptions: URL_PAGE_SIZE_OPTIONS,
            syncUrl: true,
          }}
          totalItems={userPagination.total}
          currentPage={listPage}
          setCurrentPage={() => undefined}
          itemsPerPage={listLimit}
          setItemsPerPage={() => undefined}
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
            onChange={(event) => {
              const value = event.target.value

              setRoleFilter(
                value === "ADMIN" || value === "USER" ? value : "ALL"
              )
            }}
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
                onChange={(event) => {
                  const value = event.target.value

                  setFormValues((prev) => ({
                    ...prev,
                    role: value === "ADMIN" ? "ADMIN" : "USER",
                  }))
                }}
                disabled
                className="h-10 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm outline-none transition disabled:text-slate-500"
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
                  disabled
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
          </div>
        )}
      </ActionModal>

      <AlertOption
        isOpen={deleteDialogOpen}
        onOpenChange={(nextOpen) => {
          if (deleteLoading) return

          setDeleteDialogOpen(nextOpen)

          if (!nextOpen) {
            setDeleteTarget(null)
          }
        }}
        onConfirm={() => void handleDeleteUser()}
        title="Xác nhận thao tác"
        description={`Hành động này sẽ xóa tài khoản "${
          deleteTarget?.username || "-"
        }" khỏi hệ thống và không thể hoàn tác. Bạn có chắc chắn tiếp tục?`}
        confirmText={deleteLoading ? "Đang xóa..." : "Xóa"}
        cancelText="Hủy"
        tone="destructive"
      />

      {showSuccess && <AlertSuccess description={message} />}
      {showError && <AlertError description={message} />}
    </div>
  )
}
