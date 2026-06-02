"use client"

import * as XLSX from "xlsx-js-style"
import { FileSpreadsheet, Loader2, UploadCloud, X } from "lucide-react"
import {
  ChangeEvent,
  ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react"

import AlertError from "@/components/alert/AlertError"
import AlertSuccess from "@/components/alert/AlertSuccess"
import { normalize, toNumber } from "@/utils/excel"
import { mapWithConcurrency } from "@/utils/concurrency"
import { useTransientAlert } from "@/hooks/useTransientAlert"

export type BulkImportColumnDefinition<TKey extends string> = {
  key: TKey
  label: string
  aliases: readonly string[]
  required?: boolean
}

export type BulkImportPreparedRow<
  TPayload,
  TPreview extends Record<string, unknown>,
> = {
  id: string
  rowNumber: number
  payload: TPayload | null
  preview: TPreview
  errors: string[]
  warnings: string[]
}

export type BulkImportPreviewColumn<
  TPayload,
  TPreview extends Record<string, unknown>,
> = {
  key: keyof TPreview & string
  title: string
  className?: string
  render?: (
    value: TPreview[keyof TPreview],
    row: BulkImportPreparedRow<TPayload, TPreview>
  ) => ReactNode
}

type BulkImportRowContext<TKey extends string> = {
  rowNumber: number
  rawRow: Record<string, unknown>
  getValue: (key: TKey) => unknown
}

type Props<
  TKey extends string,
  TPayload,
  TPreview extends Record<string, unknown>,
> = {
  open: boolean
  title: string
  entityLabel: string
  columns: readonly BulkImportColumnDefinition<TKey>[]
  previewColumns: readonly BulkImportPreviewColumn<TPayload, TPreview>[]
  notes?: readonly string[]
  createButtonLabel?: string
  onClose: () => void
  onCompleted?: () => Promise<void> | void
  mapRow: (
    context: BulkImportRowContext<TKey>
  ) => BulkImportPreparedRow<TPayload, TPreview>
  createItem: (payload: TPayload) => Promise<void>
}

type HeaderIndex = Map<string, string>

function buildHeaderIndex(headers: string[]) {
  const map: HeaderIndex = new Map()

  headers.forEach((header) => {
    const key = normalize(header)
    if (key && !map.has(key)) {
      map.set(key, header)
    }
  })

  return map
}

function findHeader(headerIndex: HeaderIndex, aliases: readonly string[]) {
  for (const alias of aliases) {
    const matchedHeader = headerIndex.get(normalize(alias))
    if (matchedHeader) {
      return matchedHeader
    }
  }

  return ""
}

function extractErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message) {
    return error.message
  }

  if (
    typeof error === "object" &&
    error !== null &&
    "response" in error &&
    typeof error.response === "object" &&
    error.response !== null &&
    "data" in error.response &&
    typeof error.response.data === "object" &&
    error.response.data !== null
  ) {
    const responseData = error.response.data as {
      message?: string | string[]
      error?: string
    }

    if (Array.isArray(responseData.message)) {
      return responseData.message.join(", ") || fallback
    }

    return responseData.message || responseData.error || fallback
  }

  return fallback
}

function toPreviewText(value: unknown) {
  if (value == null) return ""
  if (typeof value === "number") return String(value)
  return String(value).trim()
}

export function cleanImportText(value: unknown) {
  return String(value ?? "").trim()
}

export function parseImportNumber(value: unknown) {
  return Number(toNumber(value) || 0)
}

export function parseImportBoolean(value: unknown, fallback = true) {
  const normalized = normalize(cleanImportText(value))

  if (!normalized) return fallback

  if (
    ["true", "1", "yes", "y", "active", "hoatdong", "danghoatdong"].includes(
      normalized
    )
  ) {
    return true
  }

  if (
    [
      "false",
      "0",
      "no",
      "n",
      "inactive",
      "ngunghoatdong",
      "dung",
      "khonghoatdong",
    ].includes(normalized)
  ) {
    return false
  }

  return fallback
}

export default function CrudBulkImportModal<
  TKey extends string,
  TPayload,
  TPreview extends Record<string, unknown>,
>({
  open,
  title,
  entityLabel,
  columns,
  previewColumns,
  notes = [],
  createButtonLabel,
  onClose,
  onCompleted,
  mapRow,
  createItem,
}: Props<TKey, TPayload, TPreview>) {
  const inputRef = useRef<HTMLInputElement | null>(null)
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const [selectedFileName, setSelectedFileName] = useState("")
  const [preparedRows, setPreparedRows] = useState<
    BulkImportPreparedRow<TPayload, TPreview>[]
  >([])
  const [submitErrors, setSubmitErrors] = useState<Record<string, string>>({})
  const [createdRowIds, setCreatedRowIds] = useState<Record<string, true>>({})
  const [parsing, setParsing] = useState(false)
  const [creating, setCreating] = useState(false)
  const {
    showSuccess,
    showError,
    message,
    clearAlert,
    showSuccessMessage,
    showErrorMessage,
  } = useTransientAlert(3500, 4500)

  const resetState = useCallback(() => {
    setSelectedFileName("")
    setPreparedRows([])
    setSubmitErrors({})
    setCreatedRowIds({})
    clearAlert()

    if (inputRef.current) {
      inputRef.current.value = ""
    }
  }, [clearAlert])

  useEffect(() => {
    if (!open) {
      resetState()
    }
  }, [open, resetState])

  const validRows = useMemo(
    () =>
      preparedRows.filter(
        (row) =>
          row.payload && row.errors.length === 0 && !createdRowIds[row.id]
      ),
    [createdRowIds, preparedRows]
  )

  const invalidRowsCount = useMemo(
    () =>
      preparedRows.filter(
        (row) => row.errors.length > 0 || Boolean(submitErrors[row.id])
      ).length,
    [preparedRows, submitErrors]
  )

  const createdRowsCount = useMemo(
    () => Object.keys(createdRowIds).length,
    [createdRowIds]
  )

  const handleClose = () => {
    if (parsing || creating) return
    if (closeTimerRef.current) {
      clearTimeout(closeTimerRef.current)
      closeTimerRef.current = null
    }
    resetState()
    onClose()
  }

  useEffect(() => {
    return () => {
      if (closeTimerRef.current) {
        clearTimeout(closeTimerRef.current)
      }
    }
  }, [])

  const handleReadFile = async (file: File) => {
    try {
      setParsing(true)
      setSubmitErrors({})
      setCreatedRowIds({})
      setPreparedRows([])

      const buffer = await file.arrayBuffer()
      const workbook = XLSX.read(buffer, { type: "array" })
      const firstSheetName = workbook.SheetNames[0]

      if (!firstSheetName) {
        throw new Error("Không tìm thấy sheet nào trong file Excel.")
      }

      const worksheet = workbook.Sheets[firstSheetName]
      const matrix = XLSX.utils.sheet_to_json<unknown[]>(worksheet, {
        header: 1,
        defval: "",
        blankrows: false,
      })
      const headers = Array.isArray(matrix[0])
        ? matrix[0].map((value) => cleanImportText(value))
        : []
      const rawRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(
        worksheet,
        {
          defval: "",
          blankrows: false,
        }
      )

      if (!headers.length) {
        throw new Error("File Excel chưa có dòng tiêu đề.")
      }

      if (!rawRows.length) {
        throw new Error("File Excel chưa có dữ liệu để import.")
      }

      const headerIndex = buildHeaderIndex(headers)
      const columnHeaderMap = new Map<TKey, string>()
      const missingColumns = columns
        .filter((column) => {
          const matchedHeader = findHeader(headerIndex, column.aliases)
          if (matchedHeader) {
            columnHeaderMap.set(column.key, matchedHeader)
            return false
          }

          return Boolean(column.required)
        })
        .map((column) => column.label)

      if (missingColumns.length > 0) {
        throw new Error(`Thiếu cột bắt buộc: ${missingColumns.join(", ")}.`)
      }

      const nextRows = rawRows
        .map((rawRow, index) => ({
          rawRow,
          rowNumber: index + 2,
        }))
        .filter(({ rawRow }) =>
          Object.values(rawRow).some((value) => cleanImportText(value) !== "")
        )
        .map(({ rawRow, rowNumber }) =>
          mapRow({
            rawRow,
            rowNumber,
            getValue: (key) => {
              const header = columnHeaderMap.get(key)
              return header ? rawRow[header] : ""
            },
          })
        )

      if (!nextRows.length) {
        throw new Error("Không có dòng dữ liệu hợp lệ trong file Excel.")
      }

      setPreparedRows(nextRows)
      setSelectedFileName(file.name)
      showSuccessMessage(`Đã đọc ${nextRows.length} dòng từ file ${file.name}.`)
    } catch (error) {
      showErrorMessage(
        extractErrorMessage(error, "Không thể đọc file Excel để import.")
      )
    } finally {
      setParsing(false)

      if (inputRef.current) {
        inputRef.current.value = ""
      }
    }
  }

  const handleFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return
    await handleReadFile(file)
  }

  const handleCreate = async () => {
    if (!validRows.length) {
      showErrorMessage(`Chưa có dòng ${entityLabel} hợp lệ để tạo.`)
      return
    }

    try {
      setCreating(true)

      const nextSubmitErrors: Record<string, string> = {}
      const nextCreatedRowIds = { ...createdRowIds }
      let successCount = 0

      await mapWithConcurrency(validRows, 5, async (row) => {
        if (!row.payload) return

        try {
          await createItem(row.payload)
          successCount += 1
          nextCreatedRowIds[row.id] = true
        } catch (error) {
          nextSubmitErrors[row.id] = extractErrorMessage(
            error,
            `Không thể tạo ${entityLabel} ở dòng ${row.rowNumber}.`
          )
        }
      })

      setCreatedRowIds(nextCreatedRowIds)
      setSubmitErrors(nextSubmitErrors)

      if (successCount > 0) {
        try {
          await onCompleted?.()
        } catch (refreshError) {
          showErrorMessage(
            extractErrorMessage(
              refreshError,
              `Đã tạo ${successCount} ${entityLabel} nhưng chưa thể làm mới danh sách.`
            )
          )
          return
        }
      }

      if (Object.keys(nextSubmitErrors).length === 0) {
        showSuccessMessage(`Đã tạo thành công ${successCount} ${entityLabel}.`)

        closeTimerRef.current = setTimeout(() => {
          closeTimerRef.current = null
          handleClose()
        }, 1200)

        return
      }

      const failureCount = Object.keys(nextSubmitErrors).length
      showErrorMessage(
        `Đã tạo ${successCount} ${entityLabel}, còn ${failureCount} dòng cần kiểm tra lại.`
      )
    } finally {
      setCreating(false)
    }
  }

  if (!open) return null

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
        <div className="flex max-h-[92vh] w-full max-w-7xl flex-col overflow-hidden rounded-2xl bg-white shadow-xl">
          <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
            <div>
              <h2 className="text-base font-bold text-slate-900">{title}</h2>
              <p className="mt-1 text-sm text-slate-500">
                Upload file Excel, kiểm tra dữ liệu và xác nhận tạo hàng loạt.
              </p>
            </div>

            <button
              type="button"
              onClick={handleClose}
              disabled={parsing || creating}
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 transition hover:bg-slate-100 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <X size={18} />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto px-5 py-5">
            <div className="space-y-5">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 text-slate-900">
                      <FileSpreadsheet size={18} className="text-emerald-600" />
                      <p className="text-sm font-semibold">
                        Cột Excel cần có ở dòng tiêu đề đầu tiên
                      </p>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      {columns.map((column) => (
                        <span
                          key={column.key}
                          className={[
                            "inline-flex rounded-full px-3 py-1 text-xs font-semibold",
                            column.required
                              ? "bg-blue-100 text-blue-700"
                              : "bg-white text-slate-600",
                          ].join(" ")}
                        >
                          {column.label}
                          {column.required ? " *" : ""}
                        </span>
                      ))}
                    </div>

                    {notes.length > 0 && (
                      <div className="space-y-1 text-sm text-slate-600">
                        {notes.map((note) => (
                          <p key={note}>- {note}</p>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="w-full max-w-sm rounded-2xl border border-dashed border-slate-300 bg-white p-4">
                    <input
                      ref={inputRef}
                      type="file"
                      accept=".xlsx,.xls"
                      onChange={handleFileChange}
                      className="hidden"
                    />

                    <button
                      type="button"
                      onClick={() => inputRef.current?.click()}
                      disabled={parsing || creating}
                      className="flex w-full flex-col items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-5 text-center text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {parsing ? (
                        <Loader2 size={20} className="animate-spin" />
                      ) : (
                        <UploadCloud size={20} />
                      )}

                      <span className="text-sm font-semibold">
                        {parsing
                          ? "Đang đọc file..."
                          : "Chọn file Excel để upload"}
                      </span>

                      <span className="text-xs text-slate-300">
                        Hỗ trợ định dạng .xlsx, .xls
                      </span>
                    </button>

                    <p className="mt-3 truncate text-xs font-medium text-slate-500">
                      {selectedFileName || "Chưa chọn file nào"}
                    </p>
                  </div>
                </div>
              </div>

              {preparedRows.length > 0 && (
                <>
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
                    <div className="rounded-2xl border border-slate-200 bg-white p-4">
                      <p className="text-sm text-slate-500">Tổng số dòng</p>
                      <p className="mt-1 text-2xl font-bold text-slate-900">
                        {preparedRows.length}
                      </p>
                    </div>

                    <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
                      <p className="text-sm text-emerald-700">Sẵn sàng tạo</p>
                      <p className="mt-1 text-2xl font-bold text-emerald-700">
                        {validRows.length}
                      </p>
                    </div>

                    <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4">
                      <p className="text-sm text-blue-700">Đã tạo</p>
                      <p className="mt-1 text-2xl font-bold text-blue-700">
                        {createdRowsCount}
                      </p>
                    </div>

                    <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
                      <p className="text-sm text-amber-700">Cần kiểm tra lại</p>
                      <p className="mt-1 text-2xl font-bold text-amber-700">
                        {invalidRowsCount}
                      </p>
                    </div>
                  </div>

                  <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
                    <div className="overflow-x-auto">
                      <table className="min-w-full divide-y divide-slate-200">
                        <thead className="bg-slate-50">
                          <tr>
                            <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wide text-slate-500">
                              Dòng
                            </th>
                            <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wide text-slate-500">
                              Trạng thái
                            </th>
                            {previewColumns.map((column) => (
                              <th
                                key={column.key}
                                className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wide text-slate-500"
                              >
                                {column.title}
                              </th>
                            ))}
                            <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wide text-slate-500">
                              Ghi chú
                            </th>
                          </tr>
                        </thead>

                        <tbody className="divide-y divide-slate-100">
                          {preparedRows.map((row) => {
                            const submitError = submitErrors[row.id]
                            const isCreated = Boolean(createdRowIds[row.id])
                            const hasError =
                              row.errors.length > 0 || Boolean(submitError)

                            return (
                              <tr
                                key={row.id}
                                className={
                                  hasError ? "bg-red-50/40" : "bg-white"
                                }
                              >
                                <td className="whitespace-nowrap px-4 py-3 text-sm font-semibold text-slate-900">
                                  {row.rowNumber}
                                </td>

                                <td className="whitespace-nowrap px-4 py-3">
                                  <span
                                    className={[
                                      "inline-flex rounded-full px-3 py-1 text-xs font-bold",
                                      isCreated
                                        ? "bg-blue-100 text-blue-700"
                                        : hasError
                                          ? "bg-red-100 text-red-700"
                                          : "bg-emerald-100 text-emerald-700",
                                    ].join(" ")}
                                  >
                                    {isCreated
                                      ? "Đã tạo"
                                      : hasError
                                        ? "Lỗi"
                                        : "Hợp lệ"}
                                  </span>
                                </td>

                                {previewColumns.map((column) => {
                                  const value = row.preview[column.key]

                                  return (
                                    <td
                                      key={column.key}
                                      className={[
                                        "px-4 py-3 text-sm text-slate-700",
                                        column.className || "",
                                      ].join(" ")}
                                    >
                                      {column.render
                                        ? column.render(value, row)
                                        : toPreviewText(value) || "-"}
                                    </td>
                                  )
                                })}

                                <td className="min-w-[280px] px-4 py-3 text-sm">
                                  <div className="space-y-2">
                                    {row.errors.map((error) => (
                                      <p
                                        key={`${row.id}-${error}`}
                                        className="font-medium text-red-600"
                                      >
                                        - {error}
                                      </p>
                                    ))}

                                    {submitError && (
                                      <p className="font-medium text-red-600">
                                        - {submitError}
                                      </p>
                                    )}

                                    {row.warnings.map((warning) => (
                                      <p
                                        key={`${row.id}-${warning}`}
                                        className="font-medium text-amber-600"
                                      >
                                        - {warning}
                                      </p>
                                    ))}

                                    {row.errors.length === 0 &&
                                      !submitError &&
                                      row.warnings.length === 0 && (
                                        <p className="text-slate-400">-</p>
                                      )}
                                  </div>
                                </td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>

          <div className="flex flex-col gap-3 border-t border-slate-100 px-5 py-4 md:flex-row md:items-center md:justify-between">
            <p className="text-sm text-slate-500">
              {preparedRows.length > 0
                ? "Sau khi tạo thành công, danh sách sẽ được làm mới tự động."
                : "Upload file Excel để xem trước dữ liệu trước khi tạo."}
            </p>

            <div className="flex flex-wrap items-center justify-end gap-2">
              <button
                type="button"
                onClick={handleClose}
                disabled={parsing || creating}
                className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Đóng
              </button>

              <button
                type="button"
                onClick={handleCreate}
                disabled={!validRows.length || parsing || creating}
                className="inline-flex min-w-[170px] items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-bold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {creating && <Loader2 size={16} className="animate-spin" />}
                {createButtonLabel || `Tạo ${entityLabel} hàng loạt`}
              </button>
            </div>
          </div>
        </div>
      </div>

      {showSuccess && <AlertSuccess description={message} />}
      {showError && <AlertError description={message} />}
    </>
  )
}
