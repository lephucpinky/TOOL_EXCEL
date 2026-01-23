"use client"

import React from "react"

export function FileCard(props: {
  title: string
  subtitle?: string
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void
  footer?: React.ReactNode
}) {
  const { title, subtitle, onChange, footer } = props

  return (
    <div className="rounded-xl bg-white p-6 shadow">
      <div className="mb-1 font-semibold">{title}</div>
      {subtitle && (
        <div className="mb-3 text-xs text-slate-500">{subtitle}</div>
      )}
      <input type="file" accept=".xlsx,.xls" onChange={onChange} />
      {footer && <div className="mt-2">{footer}</div>}
    </div>
  )
}
