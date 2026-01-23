"use client"

import React, { useRef, useState } from "react"
import { cn } from "@/lib/utils"

interface FileUploadProps {
  label: string
  accept?: string
  multiple?: boolean
  onFileSelect?: (files: FileList | null) => void
  className?: string
}

export const FileUpload: React.FC<FileUploadProps> = ({
  label,
  accept,
  multiple = false,
  onFileSelect,
  className,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [dragOver, setDragOver] = useState(false)

  const handleClick = () => {
    fileInputRef.current?.click()
  }

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    onFileSelect?.(event.target.files)
  }

  const handleDragOver = (event: React.DragEvent) => {
    event.preventDefault()
    setDragOver(true)
  }

  const handleDragLeave = () => {
    setDragOver(false)
  }

  const handleDrop = (event: React.DragEvent) => {
    event.preventDefault()
    setDragOver(false)
    onFileSelect?.(event.dataTransfer.files)
  }

  return (
    <div
      className={cn(
        "flex cursor-pointer flex-col items-center rounded border border-solid border-[rgba(61,61,61,1)] bg-white px-[57px] py-12 text-center leading-[18px] transition-colors hover:bg-gray-50 max-md:px-5",
        dragOver && "border-blue-500 bg-blue-50",
        className
      )}
      onClick={handleClick}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <img
        src="https://cdn.builder.io/api/v1/image/assets/3c372df1d09f420992b2d762af53e9cb/78a90820f9e83dd0ea8877b03ab90a3a90e4c8e8?placeholderIfAbsent=true"
        className="aspect-[1.24] w-[52px] object-contain"
        alt="Upload icon"
      />
      <div className="mt-2.5 text-sm font-normal text-[#1A1A1A] opacity-20">
        {label}
      </div>
      <input
        ref={fileInputRef}
        type="file"
        accept={accept}
        multiple={multiple}
        onChange={handleFileChange}
        className="hidden"
      />
    </div>
  )
}
