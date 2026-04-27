import type { ComponentProps } from 'react'

import { clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

// MDX table primitives — replace the legacy
// `:is(> table, div > table) ...` cascade hosted by the Bootstrap-era
// prose container. The wrapper is always full-width with collapsed
// borders; rows alternate background to keep dense data legible.
//
// Notes for callers:
//   - Inline links inside cells are styled by the cell wrappers (Td /
//     Th) via `[&_a]:shadow-...` so the underline cascade matches the
//     legacy `:is(td, th) a` rule.
//   - `Caption` paints a muted bar above the table.

const CELL_LINK_UNDERLINE = clsx(
  '[&_a]:shadow-[0_-1px_0_0_var(--color-accent)_inset]',
  '[&_a]:transition-[box-shadow,opacity] [&_a]:duration-300 [&_a]:ease-in',
  'hover:[&_a]:shadow-[0_-1px_0_0_currentColor_inset] hover:[&_a]:opacity-100',
)

export function Table({ className, children, ...props }: ComponentProps<'table'>) {
  return (
    <table
      className={twMerge(
        'w-full max-w-full overflow-hidden m-0 border border-border border-collapse [&_caption]:bg-surface-muted [&_caption]:font-semibold [&_caption]:p-2 [&_caption]:text-center',
        className,
      )}
      {...props}
    >
      {children}
    </table>
  )
}

export function Thead({ className, children, ...props }: ComponentProps<'thead'>) {
  return (
    <thead className={twMerge('align-bottom whitespace-nowrap', className)} {...props}>
      {children}
    </thead>
  )
}

export function Tbody({ className, children, ...props }: ComponentProps<'tbody'>) {
  return (
    <tbody className={twMerge('[&_tr:nth-child(odd)]:bg-surface-muted', className)} {...props}>
      {children}
    </tbody>
  )
}

export function Tr({ className, children, ...props }: ComponentProps<'tr'>) {
  return (
    <tr className={twMerge('', className)} {...props}>
      {children}
    </tr>
  )
}

export function Th({ className, children, ...props }: ComponentProps<'th'>) {
  return (
    <th
      className={twMerge(
        clsx('border border-border px-[1.125rem] py-3 m-0 overflow-visible font-semibold', CELL_LINK_UNDERLINE),
        className,
      )}
      {...props}
    >
      {children}
    </th>
  )
}

export function Td({ className, children, ...props }: ComponentProps<'td'>) {
  return (
    <td
      className={twMerge(
        clsx('border border-border px-[1.125rem] py-3 m-0 overflow-visible', CELL_LINK_UNDERLINE),
        className,
      )}
      {...props}
    >
      {children}
    </td>
  )
}

export function Caption({ className, children, ...props }: ComponentProps<'caption'>) {
  return (
    <caption className={twMerge('bg-surface-muted font-semibold p-2 text-center', className)} {...props}>
      {children}
    </caption>
  )
}
