import * as React from "react"
import { Check, ChevronsUpDown } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
} from "@/components/ui/command"

type Option = { value: string; label: string }

type Props = {
  options: Option[]
  value?: string
  onChange: (value: string) => void
  placeholder?: string
  searchPlaceholder?: string
  emptyText?: string
  disabled?: boolean
}

export function SearchableSelect({
  options,
  value,
  onChange,
  placeholder = "Chọn...",
  searchPlaceholder = "Tìm kiếm...",
  emptyText = "Không tìm thấy kết quả",
  disabled,
}: Props) {
  const [open, setOpen] = React.useState(false)

  const selected = React.useMemo(
    () => options.find((o) => o.value === value),
    [options, value]
  )

  return (
    <Popover open={open} onOpenChange={setOpen} modal={false}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className="border-gray-100 w-full justify-between rounded-xl border font-normal"
        >
          <span className="min-w-0 flex-1 truncate text-left">
            {selected ? selected.label : placeholder}
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>

      <PopoverContent
        align="start"
        sideOffset={6}
        className={cn(
          // ✅ ép width đúng bằng trigger, không cho phình theo nội dung
          "w-[--radix-popover-trigger-width] max-w-[--radix-popover-trigger-width]",
          "p-0",
          // ✅ giới hạn chiều cao để không “vỡ” layout
          "max-h-[320px] overflow-hidden",
          // ✅ đảm bảo nổi lên trên
          "z-50"
        )}
      >
        <Command className="w-full">
          <CommandInput placeholder={searchPlaceholder} />
          <CommandEmpty>{emptyText}</CommandEmpty>

          {/* ✅ list scroll */}
          <CommandGroup className="max-h-[260px] overflow-auto">
            {options.map((opt) => (
              <CommandItem
                key={opt.value}
                value={opt.label}
                onSelect={() => {
                  onChange(opt.value)
                  setOpen(false)
                }}
                className="w-full"
              >
                <Check
                  className={cn(
                    "mr-2 h-4 w-4 shrink-0",
                    opt.value === value ? "opacity-100" : "opacity-0"
                  )}
                />
                {/* ✅ truncate label dài */}
                <span className="min-w-0 flex-1 truncate">{opt.label}</span>
              </CommandItem>
            ))}
          </CommandGroup>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
