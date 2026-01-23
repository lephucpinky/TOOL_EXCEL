import Image, { StaticImageData } from "next/image"

interface ProblemCardProps {
  image: string | StaticImageData
  title: string
  alt: string
}

export default function ProblemCard({ image, title, alt }: ProblemCardProps) {
  return (
    <div className="flex h-full w-full flex-col items-center rounded-lg">
      <div className="relative mb-6 h-[203px] w-full overflow-hidden rounded-lg">
        <Image
          src={image || "/placeholder.svg"}
          alt={alt}
          fill
          className="h-full w-full object-cover"
        />
      </div>
      <div className="text-left">
        <h3 className="text-base font-bold leading-tight text-gray-800 md:text-lg">
          {title}
        </h3>
      </div>
    </div>
  )
}
