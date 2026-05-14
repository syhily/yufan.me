import { EditIcon, ExternalLinkIcon, GripVerticalIcon, MoreHorizontalIcon, Trash2Icon } from 'lucide-react'
import { type DragEvent, memo } from 'react'

import type { AdminCategoryDto } from '@/shared/categories'

import { Badge } from '@/ui/components/badge'
import { Button } from '@/ui/components/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/ui/components/dropdown-menu'
import { Skeleton } from '@/ui/components/skeleton'
import { TableCell, TableRow } from '@/ui/components/table'
import { Tooltip } from '@/ui/components/tooltip'

interface CategoryRowProps {
  category: AdminCategoryDto
  dragEnabled: boolean
  isDragging: boolean
  onDragStart: (id: string) => void
  onDragEnd: () => void
  onDropOnRow: (id: string) => void
  onEdit: () => void
  onDelete: () => void
}

// Drag-reorderable row for the categories table. Memoized so an
// unrelated state tick (search debounce, draggingId rotate on a
// sibling row) doesn't reconcile every row in the list.
export const CategoryRow = memo(function CategoryRow({
  category,
  dragEnabled,
  isDragging,
  onDragStart,
  onDragEnd,
  onDropOnRow,
  onEdit,
  onDelete,
}: CategoryRowProps) {
  // The whole row is the drop target so the admin can hover anywhere
  // on the row (not just the small handle column) when releasing the
  // dragged row. Only the handle cell flips `draggable={true}` so a
  // click anywhere else in the row (image, name link, action menu)
  // still behaves like a normal click without intercepting it.
  const handleDragStart = (event: DragEvent<HTMLTableRowElement>) => {
    if (!dragEnabled) {
      return
    }
    event.dataTransfer.effectAllowed = 'move'
    event.dataTransfer.setData('text/plain', category.id)
    onDragStart(category.id)
  }
  const handleDragOver = (event: DragEvent<HTMLTableRowElement>) => {
    if (!dragEnabled) {
      return
    }
    event.preventDefault()
    event.dataTransfer.dropEffect = 'move'
  }
  const handleDrop = (event: DragEvent<HTMLTableRowElement>) => {
    if (!dragEnabled) {
      return
    }
    event.preventDefault()
    onDropOnRow(category.id)
  }

  return (
    <TableRow
      draggable={dragEnabled}
      onDragStart={handleDragStart}
      onDragEnd={onDragEnd}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      data-dragging={isDragging ? 'true' : undefined}
      className={isDragging ? 'opacity-50' : undefined}
    >
      <TableCell className="pl-4">
        <span
          className={
            dragEnabled
              ? 'flex cursor-grab items-center justify-center text-muted-foreground hover:text-foreground active:cursor-grabbing'
              : 'flex cursor-not-allowed items-center justify-center text-muted-foreground/40'
          }
          aria-hidden="true"
        >
          <GripVerticalIcon className="size-4" />
        </span>
      </TableCell>
      <TableCell>
        {/* Plain <img>: same rationale as FriendsView — the admin list
            should not depend on the localization context (`asset.host`)
            for a thumbnail. */}
        <img
          src={category.cover}
          alt={category.name}
          loading="lazy"
          decoding="async"
          className="h-10 w-20 rounded border bg-muted object-cover"
        />
      </TableCell>
      <TableCell>
        <div className="flex flex-col gap-0.5">
          <span className="font-medium">{category.name}</span>
          <a
            href={`/cats/${category.slug}`}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
          >
            <ExternalLinkIcon className="size-3" />
            <span className="max-w-xs truncate">/cats/{category.slug}</span>
          </a>
        </div>
      </TableCell>
      <TableCell className="hidden max-w-xs lg:table-cell">
        <CategoryDescriptionCell description={category.description} />
      </TableCell>
      <TableCell className="text-center">
        <Badge variant="outline">{category.sortOrder}</Badge>
      </TableCell>
      <TableCell className="text-center">
        {/* `secondary` reads as "informational" for non-zero counts;
            zero falls back to `outline` so the cell visually says
            "no references → safe to delete" without a colored chip. */}
        <Badge variant={category.postCount > 0 ? 'secondary' : 'outline'}>{category.postCount}</Badge>
      </TableCell>
      <TableCell className="pr-4 text-right">
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button type="button" variant="ghost" size="icon" aria-label="更多操作">
                <MoreHorizontalIcon />
              </Button>
            }
          />
          <DropdownMenuContent align="end" className="w-44">
            <DropdownMenuItem onClick={onEdit}>
              <EditIcon /> 编辑
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem variant="destructive" onClick={onDelete}>
              <Trash2Icon /> 删除
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </TableCell>
    </TableRow>
  )
})

interface CategoryDescriptionCellProps {
  description: string
}

// Render the category description in a single truncated line; on hover or
// keyboard focus a tooltip surfaces the full text. Empty values fall back
// to the em-dash placeholder without a tooltip (nothing to expand).
function CategoryDescriptionCell({ description }: CategoryDescriptionCellProps) {
  if (!description) {
    return <span className="text-sm text-muted-foreground">—</span>
  }
  // Unified `<Tooltip>` primitive so the popup matches the rest of
  // the site (white pill + drop shadow + ::before arrow). The trigger renders as
  // `<button type="button">` so the truncated text is reachable by
  // keyboard without `tabIndex` on a non-interactive element
  // (`jsx-a11y/no-noninteractive-tabindex`); native button chrome is
  // reset so it visually matches the surrounding table cell text.
  return (
    <Tooltip placement="top">
      <Tooltip.Trigger
        as="button"
        type="button"
        className="block w-full cursor-help truncate border-0 bg-transparent p-0 text-left text-sm text-muted-foreground hover:text-foreground focus-visible:rounded-sm focus-visible:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
      >
        {description}
      </Tooltip.Trigger>
      <Tooltip.Content>{description}</Tooltip.Content>
    </Tooltip>
  )
}

export function CategoriesSkeleton() {
  return (
    <>
      {Array.from({ length: 4 }).map((_, i) => (
        // Skeleton rows — identical placeholders, swapped wholesale on load.
        // oxlint-disable-next-line react/no-array-index-key
        <TableRow key={i}>
          <TableCell className="pl-4">
            <Skeleton className="h-4 w-4" />
          </TableCell>
          <TableCell>
            <Skeleton className="h-10 w-20 rounded" />
          </TableCell>
          <TableCell colSpan={5}>
            <Skeleton className="h-4 w-1/3" />
          </TableCell>
        </TableRow>
      ))}
    </>
  )
}
