import * as React from "react"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Label } from "../ui/label"
import { ChevronDown } from "lucide-react"

type SelectTypeProps = {
  data?: { value: string; id: string }[]
  label?: string
  className?: string
  placeholder?: string
  disabled?: boolean
  onChange?: (value: string) => void
  value?: string
  defaultValue?: string
  error?: string
}

const SelectType: React.FC<SelectTypeProps> = ({
  data,
  label,
  className = "",
  placeholder = "Chọn một tùy chọn...",
  disabled = false,
  value,
  onChange,
  error,
}) => {
  return (
    <div className={`w-full space-y-2 ${className}`}>
      {/* Label */}
      {label && (
        <Label className="text-gray-700 block text-sm font-medium">
          {label}
          {error && <span className="ml-1 text-red-500">*</span>}
        </Label>
      )}

      {/* Select Container */}
      <div className="relative">
        <Select disabled={disabled} onValueChange={onChange} value={value}>
          <SelectTrigger
            className={`h-10 w-full rounded-md border px-3 py-2 text-sm shadow-sm transition-all duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-offset-1 ${
              disabled
                ? "bg-gray-100 text-gray-400 cursor-not-allowed border-DarkSilver border-opacity-25"
                : error
                  ? "text-gray-900 border-red-300 bg-white hover:border-red-400 focus:border-red-500 focus:ring-red-500/20"
                  : "text-gray-900 hover:border-gray-400 border-DarkSilver border-opacity-25 bg-white focus:border-blue-500 focus:ring-blue-500/20"
            } `}
          >
            <div className="flex w-full items-center justify-between">
              <SelectValue
                placeholder={
                  <span className="text-gray-500 font-normal">
                    {placeholder}
                  </span>
                }
                className="truncate text-left"
              />
            </div>
          </SelectTrigger>

          <SelectContent className="z-50 max-h-60 overflow-auto rounded-md border border-DarkSilver border-opacity-25 bg-white shadow-lg">
            <SelectGroup>
              {data && data.length > 0 ? (
                data.map((item) => (
                  <SelectItem
                    key={item.id}
                    value={item.id}
                    className="hover:bg-gray-50 cursor-pointer px-3 py-2 text-sm transition-colors duration-150 focus:bg-blue-50 focus:text-blue-900 data-[highlighted]:bg-blue-50 data-[highlighted]:text-blue-900"
                  >
                    <span className="block truncate">{item.value}</span>
                  </SelectItem>
                ))
              ) : (
                <div className="text-gray-500 px-3 py-2 text-sm italic">
                  Không có dữ liệu
                </div>
              )}
            </SelectGroup>
          </SelectContent>
        </Select>

        {/* Custom arrow icon - optional if you want to override default */}
        {/* <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
          <ChevronDown className={`h-4 w-4 transition-colors ${
            disabled ? 'text-gray-400' : 'text-gray-500'
          }`} />
        </div> */}
      </div>

      {/* Error Message */}
      {error && (
        <div className="mt-1 flex items-center">
          <p className="text-sm font-medium text-red-600">{error}</p>
        </div>
      )}

      {/* Helper text - optional */}
      {!error && (
        <div className="text-gray-500 mt-1 text-xs opacity-0">
          Placeholder for consistent spacing
        </div>
      )}
    </div>
  )
}

export default SelectType
