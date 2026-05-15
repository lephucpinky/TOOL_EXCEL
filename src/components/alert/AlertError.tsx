import React from "react"
import { Cross2Icon, ExclamationTriangleIcon } from "@radix-ui/react-icons"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"

type AlertProps = {
  description?: string
  title?: string
  dismissible?: boolean
  duration?: number // milliseconds; set 0 to disable auto-dismiss
  onClose?: () => void
}

const AlertError: React.FC<AlertProps> = ({
  description,
  title = "Có lỗi xảy ra",
  dismissible = true,
  duration = 5000,
  onClose,
}) => {
  const [mounted, setMounted] = React.useState(false)
  const [visible, setVisible] = React.useState(true)

  React.useEffect(() => {
    const t = setTimeout(() => setMounted(true), 10)
    let auto: ReturnType<typeof setTimeout> | undefined
    if (duration && duration > 0) {
      auto = setTimeout(() => handleDismiss(), duration)
    }
    return () => {
      clearTimeout(t)
      if (auto) clearTimeout(auto)
    }
  }, [])

  const handleDismiss = () => {
    setMounted(false)
    // allow transition to play before unmounting
    setTimeout(() => {
      setVisible(false)
      onClose?.()
    }, 200)
  }

  if (!visible) return null

  return (
    <div
      className={`pointer-events-auto fixed right-4 top-4 z-[1000] max-w-sm font-sans transition-all duration-200 ease-out sm:right-6 sm:top-6 ${
        mounted ? "translate-y-0 opacity-100" : "-translate-y-2 opacity-0"
      }`}
      role="alert"
      aria-live="assertive"
      aria-atomic="true"
    >
      <div className="bg-background/95 supports-[backdrop-filter]:bg-background/80 relative overflow-hidden rounded-md border border-Charcoal/10 shadow-lg ring-1 ring-black/5 backdrop-blur">
        {/* left accent */}
        <div
          className="absolute inset-y-0 left-0 w-1 bg-PersianRed"
          aria-hidden
        />
        <Alert variant="destructive" className="p-4 pr-10">
          <div className="flex items-start gap-3">
            <span className="mt-0.5 inline-flex h-8 w-8 items-center justify-center rounded-full bg-PersianRed/10">
              <ExclamationTriangleIcon className="h-4 w-4 text-PersianRed" />
            </span>
            <div className="min-w-0 flex-1">
              <AlertTitle className="truncate font-semibold leading-6 text-PersianRed">
                {title}
              </AlertTitle>
              {description ? (
                <AlertDescription className="mt-1 text-sm leading-6 text-PersianRed/90">
                  {description}
                </AlertDescription>
              ) : null}
            </div>
          </div>
          {dismissible ? (
            <button
              type="button"
              onClick={handleDismiss}
              className="absolute right-2 top-2 inline-flex h-7 w-7 items-center justify-center rounded-md text-PersianRed/70 transition-colors hover:bg-PersianRed/5 hover:text-PersianRed focus:outline-none focus:ring-2 focus:ring-PersianRed/30"
              aria-label="Đóng thông báo"
            >
              <Cross2Icon className="h-4 w-4" />
            </button>
          ) : null}
        </Alert>
      </div>
    </div>
  )
}

export default AlertError
