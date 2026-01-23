import Image, { StaticImageData } from "next/image"

interface SolutionCardProps {
  image: string | StaticImageData
  title: string
  description: string
  alt: string
}

export default function SolutionCard({
  image,
  title,
  description,
  alt,
}: SolutionCardProps) {
  return (
    <div className="flex h-full w-full flex-col items-center rounded-lg">
      <div className="relative mb-4 h-[203px] w-full overflow-hidden rounded-lg">
        <Image
          src={image || "/placeholder.svg"}
          alt={alt}
          fill
          className="h-full w-full object-cover"
        />
      </div>
      <div className="text-left">
        <div className="h-16">
          <h3 className="line-clamp-2 text-base font-bold leading-tight text-gray-800 md:text-lg">
            {title}
          </h3>
        </div>
        <div className="flex-1">
          <p className="line-clamp-2 text-sm leading-relaxed text-gray-600 md:text-[15px]">
            {description}
          </p>
        </div>
      </div>
    </div>
  )
}
