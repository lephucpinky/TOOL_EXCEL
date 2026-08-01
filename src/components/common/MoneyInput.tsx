"use client"

import type { InputHTMLAttributes } from "react"

const MONEY_FORMATTER = new Intl.NumberFormat("en-US", {
  maximumFractionDigits: 0,
})

type MoneyInputProps = Omit<
  InputHTMLAttributes<HTMLInputElement>,
  "type" | "value" | "onChange" | "inputMode"
> & {
  value: number | null | undefined
  onValueChange: (value: number) => void
}

export default function MoneyInput({
  value,
  onValueChange,
  ...inputProps
}: MoneyInputProps) {
  const numericValue = Number(value)
  const displayValue =
    value === null || value === undefined || !Number.isFinite(numericValue)
      ? ""
      : MONEY_FORMATTER.format(Math.max(0, Math.trunc(numericValue)))

  return (
    <input
      {...inputProps}
      type="text"
      inputMode="numeric"
      value={displayValue}
      onChange={(event) => {
        const digits = event.currentTarget.value.replace(/[^\d]/g, "")
        onValueChange(digits ? Number(digits) : 0)
      }}
    />
  )
}
