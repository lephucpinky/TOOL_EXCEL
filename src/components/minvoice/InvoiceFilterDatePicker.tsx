"use client"

import { useMemo, useState } from "react"
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react"
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  isValid,
  parseISO,
  startOfMonth,
  startOfWeek,
  subMonths,
} from "date-fns"
import { vi } from "date-fns/locale"

import { cn } from "@/lib/utils"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"

type InvoiceFilterDatePickerProps = {
  id: string
  value: string
  onChange: (value: string) => void
}

const WEEKDAY_LABELS = ["T2", "T3", "T4", "T5", "T6", "T7", "CN"]

export default function InvoiceFilterDatePicker({
  id,
  value,
  onChange,
}: InvoiceFilterDatePickerProps) {
  const [open, setOpen] = useState(false)
  const selectedDate = useMemo(() => {
    if (!value) return null

    const parsedDate = parseISO(value)
    return isValid(parsedDate) ? parsedDate : null
  }, [value])
  const [visibleMonth, setVisibleMonth] = useState(() =>
    startOfMonth(selectedDate || new Date())
  )
  const calendarDays = useMemo(() => {
    const monthStart = startOfMonth(visibleMonth)
    const monthEnd = endOfMonth(visibleMonth)

    return eachDayOfInterval({
      start: startOfWeek(monthStart, { weekStartsOn: 1 }),
      end: endOfWeek(monthEnd, { weekStartsOn: 1 }),
    })
  }, [visibleMonth])

  const handleOpenChange = (nextOpen: boolean) => {
    if (nextOpen) {
      setVisibleMonth(startOfMonth(selectedDate || new Date()))
    }

    setOpen(nextOpen)
  }

  const handleSelectDate = (date: Date) => {
    onChange(format(date, "yyyy-MM-dd"))
    setOpen(false)
  }

  const today = new Date()

  return (
    <Popover open={open} onOpenChange={handleOpenChange} modal={false}>
      <PopoverTrigger asChild>
        <button
          id={id}
          type="button"
          className={cn(
            "group flex h-11 w-full items-center justify-between rounded-lg border border-slate-200 bg-white px-3 text-left text-sm outline-none transition",
            "hover:border-blue-300 hover:bg-blue-50/40 focus:border-blue-500 focus:ring-2 focus:ring-blue-100",
            selectedDate ? "font-medium text-slate-800" : "text-slate-400"
          )}
        >
          <span>
            {selectedDate ? format(selectedDate, "dd/MM/yyyy") : "Chọn ngày"}
          </span>
          <span className="flex h-8 w-8 items-center justify-center rounded-md bg-slate-50 text-slate-500 transition group-hover:bg-white group-hover:text-blue-600">
            <CalendarDays size={17} />
          </span>
        </button>
      </PopoverTrigger>

      <PopoverContent
        data-invoice-filter-calendar
        align="start"
        sideOffset={6}
        className="z-[1000] w-[320px] overflow-hidden rounded-xl border-slate-200 bg-white p-0 shadow-[0_18px_45px_rgba(15,23,42,0.18)]"
      >
        <div className="bg-gradient-to-r flex items-center justify-between border-b border-blue-100 from-blue-50 to-indigo-50 px-4 py-3">
          <button
            type="button"
            onClick={() => setVisibleMonth((month) => subMonths(month, 1))}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-600 transition hover:bg-white hover:text-blue-700 hover:shadow-sm"
            aria-label="Tháng trước"
          >
            <ChevronLeft size={18} />
          </button>

          <span className="text-sm font-bold capitalize text-slate-800">
            {format(visibleMonth, "'Tháng' M, yyyy", { locale: vi })}
          </span>

          <button
            type="button"
            onClick={() => setVisibleMonth((month) => addMonths(month, 1))}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-600 transition hover:bg-white hover:text-blue-700 hover:shadow-sm"
            aria-label="Tháng sau"
          >
            <ChevronRight size={18} />
          </button>
        </div>

        <div className="p-3">
          <div className="mb-1 grid grid-cols-7">
            {WEEKDAY_LABELS.map((label) => (
              <span
                key={label}
                className="flex h-8 items-center justify-center text-xs font-semibold text-slate-400"
              >
                {label}
              </span>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-y-1">
            {calendarDays.map((date) => {
              const isSelected = Boolean(
                selectedDate && isSameDay(date, selectedDate)
              )
              const isToday = isSameDay(date, today)
              const isCurrentMonth = isSameMonth(date, visibleMonth)

              return (
                <button
                  key={format(date, "yyyy-MM-dd")}
                  type="button"
                  onClick={() => handleSelectDate(date)}
                  className={cn(
                    "mx-auto flex h-9 w-9 items-center justify-center rounded-lg text-sm transition",
                    isCurrentMonth
                      ? "text-slate-700 hover:bg-blue-50 hover:text-blue-700"
                      : "text-slate-300 hover:bg-slate-50",
                    isToday &&
                      !isSelected &&
                      "font-bold text-blue-700 ring-1 ring-inset ring-blue-200",
                    isSelected &&
                      "bg-blue-600 font-bold text-white shadow-md shadow-blue-200 hover:bg-blue-700 hover:text-white"
                  )}
                  aria-pressed={isSelected}
                  aria-label={format(date, "dd/MM/yyyy")}
                >
                  {format(date, "d")}
                </button>
              )
            })}
          </div>
        </div>

        <div className="flex items-center justify-between border-t border-slate-100 bg-slate-50/70 px-4 py-3">
          <button
            type="button"
            onClick={() => {
              onChange("")
              setOpen(false)
            }}
            disabled={!selectedDate}
            className="text-sm font-semibold text-slate-500 transition hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Xóa ngày
          </button>
          <button
            type="button"
            onClick={() => handleSelectDate(today)}
            className="rounded-lg bg-blue-50 px-3 py-1.5 text-sm font-semibold text-blue-700 transition hover:bg-blue-100"
          >
            Hôm nay
          </button>
        </div>
      </PopoverContent>
    </Popover>
  )
}
