"use client"

import React, { useMemo, useRef } from "react"
import { formatPreviewValue } from "../utils/preview"
import { HorizontalScroller } from "./scoller"

export function PreviewTable(props: {
  headers: string[]
  rows: Record<string, any>[]
  take?: number
}) {
  const { headers, rows, take = 15 } = props
  const previewRows = useMemo(() => rows.slice(0, take), [rows, take])

  const scrollRef = useRef<HTMLDivElement | null>(null)

  if (!rows.length) return null

  return (
    <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
        <div className="text-sm font-semibold">👀 Preview dữ liệu doanh số</div>
        <div className="text-xs text-slate-500">
          Hiển thị <b>{previewRows.length}</b> / <b>{rows.length}</b> dòng
        </div>
      </div>

      <div className="w-full min-w-0 overflow-hidden border-t border-slate-200">
        {/* ✅ container scroll thật của bảng */}
        <div
          ref={scrollRef}
          className="max-h-[420px] w-full overflow-x-auto overflow-y-auto"
        >
          {/* w-max để bảng rộng bao nhiêu cũng được, nhưng chỉ scroll trong container */}
          <table className="w-max min-w-full border-collapse text-[12px] leading-4">
            <thead className="sticky top-0 z-10 bg-slate-100">
              <tr>
                {headers.map((h) => (
                  <th
                    key={h}
                    className="whitespace-nowrap border-b border-slate-200 px-2 py-1.5 text-left text-[10px] font-semibold uppercase tracking-wide text-slate-600"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>

            <tbody>
              {previewRows.map((row, idx) => (
                <tr
                  key={idx}
                  className="even:bg-slate-50 hover:bg-slate-100/60"
                >
                  {headers.map((h) => (
                    <td
                      key={h}
                      className="border-b border-slate-100 px-2 py-1.5 align-top text-slate-800"
                    >
                      <div className="max-w-[320px] break-words">
                        {formatPreviewValue(h, row[h])}
                      </div>
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* ✅ thanh kéo ngang “xịn” như bạn chụp */}
        <div className="px-4 py-2">
          <HorizontalScroller targetRef={scrollRef} />
        </div>
      </div>
    </div>
  )
}
