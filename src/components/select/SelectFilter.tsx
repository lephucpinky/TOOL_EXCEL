import * as React from 'react';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '../ui/label';

type SelectFilterProps = {
  data?: { value: string; id: string }[];
  label?: string;
  className?: string;
  placeholder?: string;
  disabled?: boolean;
  onChange?: (value: string) => void;
  value?: string;
  defaultValue?: string;
};

const SelectFilter: React.FC<SelectFilterProps> = ({
  data,
  label,
  className,
  disabled,
  value,
  onChange,
}) => {
  return (
    <div
      className={`z-50 flex w-full flex-col justify-center gap-1.5 bg-White p-3 ${className}`}
    >
      <div>
        <Label className="flex flex-row items-center text-[12px]">
          {label}
        </Label>
      </div>
      <Select disabled={disabled} onValueChange={onChange} value={value}>
        <SelectTrigger
          className={`w-full ${
            disabled
              ? 'text-black cursor-not-allowed border-solid bg-[#e5e7e9] text-[11px] font-bold' // Disabled styles
              : 'bg-white text-black cursor-pointer text-[11px]' // Default styles
          }`}
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent className="bg-White">
          <SelectGroup>
            {data &&
              data.map((item) => (
                <SelectItem
                  key={item.id}
                  value={item.id}
                  className="text-[11px]"
                >
                  {item.value}
                </SelectItem>
              ))}
          </SelectGroup>
        </SelectContent>
      </Select>
    </div>
  );
};

export default SelectFilter;
