import React from "react"
import { CheckCircledIcon, Cross2Icon } from "@radix-ui/react-icons"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"

type AlertProps = {
  description?: string
  title?: string
  dismissible?: boolean
  duration?: number // milliseconds; set 0 to disable auto-dismiss
  onClose?: () => void
}

const AlertSuccess: React.FC<AlertProps> = ({
  description,
  title = "Thành công",
  dismissible = true,
  duration = 4000,
  onClose,
}) => {
  const [mounted, setMounted] = React.useState(false)
  const [visible, setVisible] = React.useState(true)
  const autoRef = React.useRef<ReturnType<typeof setTimeout> | null>(null)

  React.useEffect(() => {
    const t = setTimeout(() => setMounted(true), 10)
    if (duration && duration > 0) {
      autoRef.current = setTimeout(() => handleDismiss(), duration)
    }
    return () => {
      clearTimeout(t)
      if (autoRef.current) clearTimeout(autoRef.current)
    }
  }, [])

  const handleDismiss = () => {
    setMounted(false)
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
      role="status"
      aria-live="polite"
      aria-atomic="true"
    >
      <div className="bg-background/95 supports-[backdrop-filter]:bg-background/80 relative overflow-hidden rounded-md border border-Charcoal/10 shadow-lg ring-1 ring-black/5 backdrop-blur">
        {/* left accent */}
        <div
          className="absolute inset-y-0 left-0 w-1 bg-Charcoal"
          aria-hidden
        />
        <Alert className="p-4 pr-10">
          <div className="flex items-start gap-3">
            <span className="mt-0.5 inline-flex h-8 w-8 items-center justify-center rounded-full bg-Charcoal/10">
              <CheckCircledIcon className="h-4 w-4 text-foreground" />
            </span>
            <div className="min-w-0 flex-1">
              <AlertTitle className="truncate font-semibold leading-6 text-foreground">
                {title}
              </AlertTitle>
              {description ? (
                <AlertDescription className="text-foreground/90 mt-1 text-sm leading-6">
                  {description}
                </AlertDescription>
              ) : null}
            </div>
          </div>
          {dismissible ? (
            <button
              type="button"
              onClick={handleDismiss}
              className="text-foreground/70 absolute right-2 top-2 inline-flex h-7 w-7 items-center justify-center rounded-md transition-colors hover:bg-Charcoal/5 hover:text-foreground focus:outline-none focus:ring-2 focus:ring-Charcoal/30"
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

export default AlertSuccess
