"use client"

import React, { useEffect, useRef, useState } from "react"

export function HorizontalScroller(props: {
  targetRef: React.RefObject<HTMLElement | null>
  className?: string
}) {
  const { targetRef, className } = props
  const barRef = useRef<HTMLDivElement | null>(null)
  const [contentWidth, setContentWidth] = useState(0)
  const [viewportWidth, setViewportWidth] = useState(0)

  const show = contentWidth > viewportWidth + 1

  useEffect(() => {
    const target = targetRef.current
    if (!target) return

    const measure = () => {
      setContentWidth(target.scrollWidth)
      setViewportWidth(target.clientWidth)
    }

    measure()

    const ro = new ResizeObserver(() => measure())
    ro.observe(target)

    const child = target.firstElementChild as HTMLElement | null
    if (child) ro.observe(child)

    return () => ro.disconnect()
  }, [targetRef])

  useEffect(() => {
    const target = targetRef.current
    const bar = barRef.current
    if (!target || !bar) return

    let lock = false

    const onTargetScroll = () => {
      if (lock) return
      lock = true
      bar.scrollLeft = target.scrollLeft
      requestAnimationFrame(() => (lock = false))
    }

    const onBarScroll = () => {
      if (lock) return
      lock = true
      target.scrollLeft = bar.scrollLeft
      requestAnimationFrame(() => (lock = false))
    }

    target.addEventListener("scroll", onTargetScroll, { passive: true })
    bar.addEventListener("scroll", onBarScroll, { passive: true })

    return () => {
      target.removeEventListener("scroll", onTargetScroll)
      bar.removeEventListener("scroll", onBarScroll)
    }
  }, [targetRef])

  if (!show) return null

  return (
    <div className={className}>
      <div
        ref={barRef}
        className="h-4 w-full overflow-x-auto overflow-y-hidden rounded-full bg-slate-100"
      >
        <div style={{ width: contentWidth, height: 1 }} />
      </div>

      <div className="mt-1 flex items-center justify-between text-[11px] text-slate-500">
        <span>Kéo ngang để xem thêm</span>
        <span>
          width: <b>{contentWidth}px</b>
        </span>
      </div>
    </div>
  )
}
