import type { ReactNode } from "react"

type HeaderTone = "blue" | "emerald" | "amber" | "violet" | "cyan" | "rose"

type PageHeaderProps = {
  icon: ReactNode
  eyebrow?: string
  title: string
  description?: string
  actions?: ReactNode
  tone?: HeaderTone
}

const toneClasses: Record<HeaderTone, string> = {
  blue: "border-blue-100 bg-blue-50 text-blue-700",
  emerald: "border-emerald-100 bg-emerald-50 text-emerald-700",
  amber: "border-amber-100 bg-amber-50 text-amber-700",
  violet: "border-violet-100 bg-violet-50 text-violet-700",
  cyan: "border-cyan-100 bg-cyan-50 text-cyan-700",
  rose: "border-rose-100 bg-rose-50 text-rose-700",
}

export default function PageHeader({
  icon,
  eyebrow,
  title,
  description,
  actions,
  tone = "blue",
}: PageHeaderProps) {
  return (
    <section className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-col gap-4 p-5 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex min-w-0 items-start gap-4">
          <div
            className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-lg border ${toneClasses[tone]}`}
          >
            {icon}
          </div>

          <div className="min-w-0">
            {eyebrow && (
              <div className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-500">
                {eyebrow}
              </div>
            )}
            <h1 className="mt-1 text-xl font-bold text-slate-950">{title}</h1>
            {description && (
              <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-500">
                {description}
              </p>
            )}
          </div>
        </div>

        {actions && (
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            {actions}
          </div>
        )}
      </div>
    </section>
  )
}
