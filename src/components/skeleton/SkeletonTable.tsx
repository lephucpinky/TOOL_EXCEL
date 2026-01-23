import { Skeleton } from '../ui/skeleton'

const SkeletonTable = () => {
  return (
    <div className="w-full space-y-4">
      {Array(5)
        .fill(0)
        .map((_, index) => (
          <div key={index} className="flex animate-pulse items-center gap-3">
            <Skeleton className="h-6 w-[250px] p-2" />
            <Skeleton className="h-6 w-[250px] p-2" />
            <Skeleton className="h-6 w-[250px] p-2" />
            <Skeleton className="h-6 w-[250px] p-2" />
          </div>
        ))}
    </div>
  )
}

export default SkeletonTable
