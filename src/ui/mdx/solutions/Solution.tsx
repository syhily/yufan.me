import type { ReactNode } from 'react'

import { cn } from '@/ui/lib/cn'

export interface SolutionProps {
  children?: ReactNode
}

// `<Solution>` is a `<blockquote class="solution">` whose direct
// `<p>` / `<mjx-container>` children should sit on a single
// horizontal line where possible. We override the prose `<P>` margins
// and font-size with Tailwind arbitrary descendant variants — Tailwind
// emits these as `.solution :is(.solution p)` -style selectors with
// higher specificity than the bare `<P>` className, so the inline
// utilities here win without `!important`.
//
// First / last `<p>` collapse to `inline-block` so the leading "解："
// label and the trailing `□` proof terminator can hug the formula on
// the same line.
const SOLUTION_CHILDREN_OVERRIDES = [
  '[&_p]:text-[0.938rem] [&_p]:mt-0 [&_p]:mb-[1.05rem] [&_p]:mx-0',
  '[&_>p:first-of-type]:inline-block',
  '[&_>p:last-of-type]:inline-block [&_>p:last-of-type]:mb-0 [&_>p:last-of-type]:pb-0',
  '[&_mjx-container]:my-0 [&_mjx-container]:mx-0 [&_mjx-container]:mb-[0.95rem]',
  '[&_>mjx-container:last-of-type]:inline-block [&_>mjx-container:last-of-type]:mb-0 [&_>mjx-container:last-of-type]:pb-0',
].join(' ')

export function Solution({ children }: SolutionProps) {
  return (
    <blockquote
      className={cn('solution block flow-root p-5 overflow-x-auto overflow-y-hidden', SOLUTION_CHILDREN_OVERRIDES)}
    >
      <div className="font-extrabold text-[1.2rem] text-accent mb-2 inline-block">解：</div>
      {children}
      <div className="float-right relative text-[1.2rem] text-foreground-soft">□</div>
    </blockquote>
  )
}

export interface UnstyledSolutionProps {
  children?: ReactNode
}

export function UnstyledSolution({ children }: UnstyledSolutionProps) {
  return <blockquote>{children}</blockquote>
}
