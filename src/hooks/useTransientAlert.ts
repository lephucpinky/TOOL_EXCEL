"use client"

import { useCallback, useEffect, useRef, useState } from "react"

export function useTransientAlert(
  successDuration = 3000,
  errorDuration = 3000
) {
  const [showSuccess, setShowSuccess] = useState(false)
  const [showError, setShowError] = useState(false)
  const [message, setMessage] = useState("")
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const clearTimer = useCallback(() => {
    if (!timerRef.current) return

    clearTimeout(timerRef.current)
    timerRef.current = null
  }, [])

  const clearAlert = useCallback(() => {
    clearTimer()
    setShowSuccess(false)
    setShowError(false)
    setMessage("")
  }, [clearTimer])

  const showSuccessMessage = useCallback(
    (text: string) => {
      clearTimer()
      setShowError(false)
      setMessage(text)
      setShowSuccess(true)
      timerRef.current = setTimeout(() => {
        setShowSuccess(false)
        timerRef.current = null
      }, successDuration)
    },
    [clearTimer, successDuration]
  )

  const showErrorMessage = useCallback(
    (text: string) => {
      clearTimer()
      setShowSuccess(false)
      setMessage(text)
      setShowError(true)
      timerRef.current = setTimeout(() => {
        setShowError(false)
        timerRef.current = null
      }, errorDuration)
    },
    [clearTimer, errorDuration]
  )

  useEffect(() => clearTimer, [clearTimer])

  return {
    showSuccess,
    showError,
    message,
    clearAlert,
    showSuccessMessage,
    showErrorMessage,
  }
}
