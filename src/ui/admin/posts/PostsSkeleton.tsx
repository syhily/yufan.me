import { Skeleton } from '@/ui/components/skeleton'
import { TableCell, TableRow } from '@/ui/components/table'

export function PostsSkeleton() {
  return (
    <>
      {[0, 1, 2, 3].map((i) => (
        <TableRow key={i}>
          <TableCell className="pl-4">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="mt-2 h-3 w-20" />
          </TableCell>
          <TableCell className="hidden md:table-cell">
            <Skeleton className="h-3 w-full" />
          </TableCell>
          <TableCell className="hidden md:table-cell">
            <Skeleton className="mx-auto h-3 w-16" />
          </TableCell>
          <TableCell>
            <Skeleton className="mx-auto h-5 w-16" />
          </TableCell>
          <TableCell className="hidden lg:table-cell">
            <Skeleton className="h-3 w-32" />
          </TableCell>
          <TableCell className="pr-4">
            <Skeleton className="ml-auto h-8 w-32" />
          </TableCell>
        </TableRow>
      ))}
    </>
  )
}
