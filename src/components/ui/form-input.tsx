import React from "react"
import { cn } from "@/lib/utils"

interface FormInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string
  required?: boolean
  error?: string
}

export const FormInput: React.FC<FormInputProps> = ({
  label,
  required = false,
  error,
  className,
  ...props
}) => {
  return (
    <div className="flex flex-col items-stretch">
      <label className="text-[18px] font-normal">
        {label}
        {required && <span style={{ color: "rgba(255,0,0,1)" }}>*</span>}
      </label>
      <input
        className={cn(
          "border-gray-400 mt-[20px] flex h-10 shrink-0 rounded border border-solid bg-white px-3 focus:outline-none focus:ring-2 focus:ring-Blue/50",
          error && "border-Red/50",
          className
        )}
        {...props}
      />
      {error && <span className="mt-1 text-xs text-Red/50">{error}</span>}
    </div>
  )
}
