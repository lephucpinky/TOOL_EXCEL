"use client"

import * as React from "react"
import { Check, ChevronDown, Search } from "lucide-react"

import { cn } from "@/lib/utils"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"

export type InvoiceFilterSelectOption = {
  value: string
  label: string
}

type InvoiceFilterSelectProps = {
  id: string
  value: string
  options: InvoiceFilterSelectOption[]
  onChange: (value: string) => void
  disabled?: boolean
  searchPlaceholder?: string
  emptyText?: string
}

const EMPTY_VALUE = "__invoice_filter_empty__"

function normalizeSearchText(value: unknown) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
}

export default function InvoiceFilterSelect({
  id,
  value,
  options,
  onChange,
  disabled = false,
  searchPlaceholder = "Tìm kiếm...",
  emptyText = "Không tìm thấy kết quả",
}: InvoiceFilterSelectProps) {
  const [open, setOpen] = React.useState(false)
  const [keyword, setKeyword] = React.useState("")
  const inputRef = React.useRef<HTMLInputElement>(null)

  const selected = React.useMemo(
    () => options.find((option) => option.value === value),
    [options, value]
  )

  const filteredOptions = React.useMemo(() => {
    const searchValue = normalizeSearchText(keyword)
    if (!searchValue) return options

    return options.filter((option) =>
      normalizeSearchText(option.label).includes(searchValue)
    )
  }, [keyword, options])

  React.useEffect(() => {
    if (!open) {
      setKeyword("")
      return
    }

    const timeoutId = window.setTimeout(() => {
      inputRef.current?.focus()
    }, 0)

    return () => window.clearTimeout(timeoutId)
  }, [open])

  const handleSelect = (nextValue: string) => {
    onChange(nextValue)
    setOpen(false)
  }

  return (
    <Popover
      open={open}
      onOpenChange={(nextOpen) => {
        if (disabled) return
        setOpen(nextOpen)
      }}
      modal={false}
    >
      <PopoverTrigger asChild>
        <button
          id={id}
          type="button"
          disabled={disabled}
          data-invoice-filter-select
          data-state={open ? "open" : "closed"}
          className={cn(
            "group flex h-8 w-full items-center justify-between rounded border border-slate-200 bg-white px-2 text-left text-[13px] font-medium text-slate-700 outline-none transition",
            "hover:border-blue-300 hover:bg-blue-50/40 focus:border-blue-500 focus:ring-2 focus:ring-blue-100",
            "data-[state=open]:border-blue-500 data-[state=open]:bg-blue-50/40 data-[state=open]:ring-2 data-[state=open]:ring-blue-100",
            "disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
          )}
        >
          <span className="min-w-0 flex-1 truncate">
            {selected?.label || options[0]?.label || "Chọn..."}
          </span>
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded text-slate-500 transition group-hover:text-blue-600 group-data-[state=open]:rotate-180 group-data-[state=open]:text-blue-600">
            <ChevronDown size={15} />
          </span>
        </button>
      </PopoverTrigger>

      <PopoverContent
        data-invoice-filter-select
        align="start"
        sideOffset={6}
        collisionPadding={12}
        className="z-[1000] w-[var(--radix-popover-trigger-width)] min-w-[var(--radix-popover-trigger-width)] overflow-hidden rounded-xl border border-slate-200 bg-white p-1.5 text-slate-700 shadow-[0_18px_45px_rgba(15,23,42,0.18)] outline-none"
        onOpenAutoFocus={(event) => event.preventDefault()}
      >
        <div className="mb-1.5 flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
          <Search size={15} className="shrink-0 text-slate-400" />
          <input
            ref={inputRef}
            value={keyword}
            onChange={(event) => setKeyword(event.target.value)}
            placeholder={searchPlaceholder}
            className="h-7 w-full bg-transparent text-sm text-slate-700 outline-none placeholder:text-slate-400"
          />
        </div>

        <div className="max-h-64 overflow-y-auto">
          {filteredOptions.length === 0 ? (
            <div className="px-3 py-6 text-center text-sm text-slate-500">
              {emptyText}
            </div>
          ) : (
            filteredOptions.map((option) => {
              const optionValue = option.value || EMPTY_VALUE
              const isSelected = (value || EMPTY_VALUE) === optionValue

              return (
                <button
                  key={optionValue}
                  type="button"
                  onClick={() =>
                    handleSelect(optionValue === EMPTY_VALUE ? "" : option.value)
                  }
                  className={cn(
                    "relative flex min-h-10 w-full cursor-pointer select-none items-center rounded-lg py-2 pl-3 pr-10 text-left text-sm outline-none transition",
                    "hover:bg-blue-50 hover:text-blue-700",
                    isSelected && "bg-blue-50 font-semibold text-blue-700"
                  )}
                >
                  <span className="min-w-0 flex-1 truncate">{option.label}</span>
                  {isSelected && (
                    <span className="absolute right-3 flex h-6 w-6 items-center justify-center rounded-full bg-blue-600 text-white shadow-sm">
                      <Check size={14} strokeWidth={3} />
                    </span>
                  )}
                </button>
              )
            })
          )}
        </div>
      </PopoverContent>
    </Popover>
  )
}
