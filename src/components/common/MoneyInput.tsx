"use client"

import { useState, type InputHTMLAttributes } from "react"

const MONEY_FORMATTER = new Intl.NumberFormat("en-US", {
  maximumFractionDigits: 0,
})

const DECIMAL_MONEY_FORMATTER = new Intl.NumberFormat("en-US", {
  maximumFractionDigits: 20,
})

type MoneyInputProps = Omit<
  InputHTMLAttributes<HTMLInputElement>,
  "type" | "value" | "onChange" | "inputMode"
> & {
  value: number | null | undefined
  onValueChange: (value: number) => void
  allowDecimal?: boolean
}

export default function MoneyInput({
  value,
  onValueChange,
  allowDecimal = false,
  ...inputProps
}: MoneyInputProps) {
  const [decimalDraft, setDecimalDraft] = useState<string | null>(null)
  const numericValue = Number(value)
  const displayValue =
    value === null || value === undefined || !Number.isFinite(numericValue)
      ? ""
      : allowDecimal
        ? DECIMAL_MONEY_FORMATTER.format(Math.max(0, numericValue))
        : MONEY_FORMATTER.format(Math.max(0, Math.trunc(numericValue)))

  return (
    <input
      {...inputProps}
      type="text"
      inputMode={allowDecimal ? "decimal" : "numeric"}
      value={allowDecimal && decimalDraft !== null ? decimalDraft : displayValue}
      onFocus={(event) => {
        if (allowDecimal) {
          setDecimalDraft(
            Number.isFinite(numericValue) ? String(Math.max(0, numericValue)) : ""
          )
        }
        inputProps.onFocus?.(event)
      }}
      onBlur={(event) => {
        if (allowDecimal) setDecimalDraft(null)
        inputProps.onBlur?.(event)
      }}
      onChange={(event) => {
        if (allowDecimal) {
          const decimalText = event.currentTarget.value
            .replace(/,/g, "")
            .replace(/[^\d.]/g, "")
          const decimalPointIndex = decimalText.indexOf(".")
          const normalizedValue =
            decimalPointIndex < 0
              ? decimalText
              : `${decimalText.slice(0, decimalPointIndex + 1)}${decimalText
                  .slice(decimalPointIndex + 1)
                  .replace(/\./g, "")}`

          setDecimalDraft(normalizedValue)
          const nextValue = Number(normalizedValue)
          onValueChange(Number.isFinite(nextValue) ? nextValue : 0)
          return
        }

        const digits = event.currentTarget.value.replace(/[^\d]/g, "")
        onValueChange(digits ? Number(digits) : 0)
      }}
    />
  )
}
