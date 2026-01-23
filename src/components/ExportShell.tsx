"use client"

import Link from "next/link"
import React from "react"

export function ExportShell({
  title,
  subtitle,
  children,
}: {
  title: string
  subtitle?: string
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="mx-auto max-w-6xl space-y-4">
        <div className="flex items-center justify-between rounded-xl bg-white p-6 shadow">
          <div>
            <div className="text-xl font-bold">{title}</div>
            {subtitle ? (
              <div className="text-sm text-slate-600">{subtitle}</div>
            ) : null}
          </div>

          <Link
            href="/"
            className="rounded-lg border px-4 py-2 text-sm font-semibold hover:bg-slate-50"
          >
            ← Home
          </Link>
        </div>

        {children}
      </div>
    </div>
  )
}
