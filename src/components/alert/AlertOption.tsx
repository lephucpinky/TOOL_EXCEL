import React, { useEffect, useState } from "react"

interface AlertOptionProps {
  isOpen: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: () => void | Promise<void>
  title?: string
  description?: string
  confirmText?: string
  cancelText?: string
  tone?: "neutral" | "destructive"
}

const AlertOption: React.FC<AlertOptionProps> = ({
  isOpen,
  onOpenChange,
  onConfirm,
  title = "Xác nhận thao tác",
  description = "Vui lòng kiểm tra thông tin trước khi tiếp tục. Thao tác này có thể không thể hoàn tác.",
  confirmText = "Tiếp tục",
  cancelText = "Hủy",
  tone = "neutral",
}) => {
  const [confirming, setConfirming] = useState(false)

  const isDestructive = tone === "destructive"

  useEffect(() => {
    if (!isOpen) return

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !confirming) {
        onOpenChange(false)
      }
    }

    document.addEventListener("keydown", handleKeyDown)

    return () => {
      document.removeEventListener("keydown", handleKeyDown)
    }
  }, [isOpen, confirming, onOpenChange])

  if (!isOpen) return null

  const handleConfirm = async () => {
    try {
      setConfirming(true)
      await onConfirm()
    } finally {
      setConfirming(false)
    }
  }

  const handleCancel = () => {
    if (confirming) return
    onOpenChange(false)
  }

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/45 px-4">
      <div
        role="alertdialog"
        aria-modal="true"
        className="w-full max-w-[520px] overflow-hidden rounded-2xl border border-slate-200 bg-white text-slate-900 shadow-2xl"
      >
        <div
          className={[
            "h-1.5 w-full",
            isDestructive ? "bg-red-600" : "bg-blue-600",
          ].join(" ")}
        />

        <div className="p-6">
          <div className="space-y-3">
            <h2
              className={[
                "text-xl font-bold tracking-tight",
                isDestructive ? "text-red-600" : "text-slate-900",
              ].join(" ")}
            >
              {title}
            </h2>

            <p className="text-sm leading-6 text-slate-600">{description}</p>
          </div>

          <div className="mt-7 flex justify-end gap-3">
            <button
              type="button"
              onClick={handleCancel}
              disabled={confirming}
              className="inline-flex h-10 min-w-[88px] items-center justify-center rounded-xl border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-100 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {cancelText}
            </button>

            <button
              type="button"
              onClick={handleConfirm}
              disabled={confirming}
              className={[
                "inline-flex h-10 min-w-[88px] items-center justify-center rounded-xl px-4 text-sm font-bold text-white transition disabled:cursor-not-allowed disabled:opacity-60",
                isDestructive
                  ? "bg-red-600 hover:bg-red-700"
                  : "bg-blue-600 hover:bg-blue-700",
              ].join(" ")}
            >
              {confirming ? "Đang xử lý..." : confirmText}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default AlertOption
