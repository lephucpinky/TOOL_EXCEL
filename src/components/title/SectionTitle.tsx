interface SectionTitleProps {
  text: string
  highlight: string
  highlightColor: string
  titleColor?: string
}

export default function SectionTitle({
  text,
  highlight,
  highlightColor,
  titleColor = "text-Blue",
}: SectionTitleProps) {
  return (
    <h2 className="mb-8 text-center text-xl font-bold md:text-2xl lg:text-[32px]">
      <span className={titleColor}>{text} </span>
      <span className={highlightColor}>{highlight}</span>
    </h2>
  )
}
