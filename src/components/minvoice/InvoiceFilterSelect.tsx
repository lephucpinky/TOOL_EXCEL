"use client"

import * as SelectPrimitive from "@radix-ui/react-select"
import { Check, ChevronDown } from "lucide-react"

import { cn } from "@/lib/utils"

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
}

const EMPTY_VALUE = "__invoice_filter_empty__"

export default function InvoiceFilterSelect({
  id,
  value,
  options,
  onChange,
  disabled = false,
}: InvoiceFilterSelectProps) {
  return (
    <SelectPrimitive.Root
      value={value || EMPTY_VALUE}
      onValueChange={(nextValue) =>
        onChange(nextValue === EMPTY_VALUE ? "" : nextValue)
      }
      disabled={disabled}
    >
      <SelectPrimitive.Trigger
        id={id}
        className={cn(
          "group flex h-11 w-full items-center justify-between rounded-lg border border-slate-200 bg-white px-3 text-left text-sm font-medium text-slate-700 outline-none transition",
          "hover:border-blue-300 hover:bg-blue-50/40 focus:border-blue-500 focus:ring-2 focus:ring-blue-100",
          "data-[state=open]:border-blue-500 data-[state=open]:bg-blue-50/40 data-[state=open]:ring-2 data-[state=open]:ring-blue-100",
          "disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
        )}
      >
        <SelectPrimitive.Value />
        <SelectPrimitive.Icon asChild>
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-slate-50 text-slate-500 transition group-hover:bg-white group-hover:text-blue-600 group-data-[state=open]:rotate-180 group-data-[state=open]:bg-white group-data-[state=open]:text-blue-600">
            <ChevronDown size={17} />
          </span>
        </SelectPrimitive.Icon>
      </SelectPrimitive.Trigger>

      <SelectPrimitive.Portal>
        <SelectPrimitive.Content
          data-invoice-filter-select
          position="popper"
          align="start"
          sideOffset={6}
          collisionPadding={12}
          className="z-[1000] min-w-[var(--radix-select-trigger-width)] overflow-hidden rounded-xl border border-slate-200 bg-white p-1.5 text-slate-700 shadow-[0_18px_45px_rgba(15,23,42,0.18)] outline-none data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95"
        >
          <SelectPrimitive.Viewport className="max-h-64">
            {options.map((option) => {
              const optionValue = option.value || EMPTY_VALUE

              return (
                <SelectPrimitive.Item
                  key={optionValue}
                  value={optionValue}
                  className="relative flex min-h-10 cursor-pointer select-none items-center rounded-lg py-2 pl-3 pr-10 text-sm outline-none transition data-[highlighted]:bg-blue-50 data-[state=checked]:bg-blue-50 data-[state=checked]:font-semibold data-[highlighted]:text-blue-700 data-[state=checked]:text-blue-700"
                >
                  <SelectPrimitive.ItemText>
                    {option.label}
                  </SelectPrimitive.ItemText>
                  <SelectPrimitive.ItemIndicator className="absolute right-3 flex h-6 w-6 items-center justify-center rounded-full bg-blue-600 text-white shadow-sm">
                    <Check size={14} strokeWidth={3} />
                  </SelectPrimitive.ItemIndicator>
                </SelectPrimitive.Item>
              )
            })}
          </SelectPrimitive.Viewport>
        </SelectPrimitive.Content>
      </SelectPrimitive.Portal>
    </SelectPrimitive.Root>
  )
}
