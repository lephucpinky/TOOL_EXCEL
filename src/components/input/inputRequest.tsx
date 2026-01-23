import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import React, { forwardRef } from "react"

type InputRequestProps = {
  labelText: string
  type?: string
  onChange?: React.ChangeEventHandler<HTMLInputElement> | undefined
  name?: string
  placeholder?: string
  value?: any
  className?: string
  error?: string
  disabled?: boolean
  required?: boolean
}

const InputRequest = forwardRef<HTMLInputElement, InputRequestProps>(
  (
    {
      labelText,
      type = "text",
      onChange,
      name,
      placeholder,
      value,
      className,
      error,
      disabled,
      required,
      ...rest
    },
    ref
  ) => {
    return (
      <div
        className={`text-BlackOlive flex w-full flex-col gap-1 font-sans font-normal`}
      >
        <div className="flex flex-row items-center gap-1 text-[10px]">
          <Label htmlFor={name} className="text-[12px]">
            {labelText}
          </Label>
          {required && <span className="text-CustomRed">*</span>}
        </div>
        <Input
          ref={ref}
          type={type}
          id={name}
          name={name}
          placeholder={placeholder}
          onChange={onChange}
          value={value}
          className={`${className} border-LightSilver rounded-md border`}
          disabled={disabled}
          {...rest}
        />
        {error && (
          <div className="text-PersianRed font-sans text-[10px] font-normal">
            {error}
          </div>
        )}
      </div>
    )
  }
)

InputRequest.displayName = "InputRequest"

export default InputRequest
