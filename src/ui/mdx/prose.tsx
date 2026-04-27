import type { ComponentProps } from 'react'

import { cn } from '@/ui/lib/cn'

// MDX prose components — only the React-only renderers stay here. The
// per-element typography (h1, h5, h6, p, ol, ul, li, hr, blockquote,
// table family, …) is now handled by `@tailwindcss/typography`'s `prose`
// utilities applied on the `.prose-host` host element in
// `globals.css` (`@layer components`). The wrappers below are mounted
// via `useMDXComponents` in `MdxContent.tsx` only for the things `prose-*`
// cannot reach:
//
//   - `<H2|H3|H4>` add the absolutely-positioned `<HeadingBar>` artwork
//     that prose cannot draw via `::before` (we keep the bar in JSX so
//     the bundler can analyse it instead of buried in `globals.css`).
//   - `<Code>` paints the warm rgb(253, 246, 227) wash on inline code
//     and the dark-mode fallback. We could drive it via `prose-code:bg-…`
//     in CSS but the value is component-only, not a token, so it stays
//     inline.
//   - `<SupLink>` carries the footnote-ref bolding for `<sup>` markers
//     when they have NO tooltip preview registered (the tooltip path
//     uses `Tooltip.Trigger as="sup"` with `FOOTNOTE_SUP_CLASSES`).
//   - `<Center>` is the HTML4 `<center>` tag — Tailwind typography does
//     not target it; we keep a thin wrapper so legacy posts still render
//     centered.

// `<H2>` / `<H3>` / `<H4>` indicator bar. We render this as a real
// `<span aria-hidden>` instead of a CSS pseudo-element so the artwork
// lives in JSX (analysable by the bundler, no `::before` cascade in
// `globals.css`). The parent heading is `position: relative` and the
// span is absolutely positioned at its left edge.
//
// Tokens follow the legacy values:
//   - H2 bar: 6×22, top: 7px (mobile 5px / 18px tall)
//   - H3 bar: 5×11, top: 11px (md/sm 9px)
//   - H4 dot: 5×5,  top: 11px
function HeadingBar({ shape }: { shape: 'h2' | 'h3' | 'h4' }) {
  if (shape === 'h2') {
    return (
      <span
        aria-hidden
        className={cn('absolute left-0 bg-accent', 'top-[5px] h-[18px] w-1.5', 'md:top-[7px] md:h-[22px]')}
      />
    )
  }
  if (shape === 'h3') {
    return (
      <span aria-hidden className={cn('absolute left-0 bg-accent', 'top-[9px] w-[5px] h-[11px]', 'lg:top-[11px]')} />
    )
  }
  return <span aria-hidden className={cn('absolute left-0 bg-accent', 'top-[11px] w-[5px] h-[5px]')} />
}

export function H2({ className, children, ...props }: ComponentProps<'h2'>) {
  return (
    <h2 className={cn('relative pl-6', className)} {...props}>
      <HeadingBar shape="h2" />
      {children}
    </h2>
  )
}

export function H3({ className, children, ...props }: ComponentProps<'h3'>) {
  return (
    <h3 className={cn('relative pl-6', className)} {...props}>
      <HeadingBar shape="h3" />
      {children}
    </h3>
  )
}

export function H4({ className, children, ...props }: ComponentProps<'h4'>) {
  return (
    <h4 className={cn('relative pl-6', className)} {...props}>
      <HeadingBar shape="h4" />
      {children}
    </h4>
  )
}

// Inline `<code>` (i.e. NOT inside a `<pre>` — those go through
// `<CodeBlock>` and Shiki handles their colour). The styling tracks the
// legacy `:not(pre) > code { padding ... border-radius ... }` cascade
// from the Bootstrap-era prose host, plus the Solarized Light warm
// wash we keep on inline tokens.
//
// `prose` already sets up `code` typography in `globals.css`; we override
// the surface tint and clear its built-in padding so the chip looks
// right against the prose body.
export function Code({ className, children, ...props }: ComponentProps<'code'>) {
  return (
    <code
      className={cn(
        'px-[0.32em] py-[0.08em] mx-[0.06em] rounded-[3px]',
        'font-mono text-[90%] [word-break:break-all] [overflow-wrap:break-word]',
        'bg-[rgb(253,246,227)] dark:bg-surface-muted',
        '[box-decoration-break:clone]',
        className,
      )}
      {...props}
    >
      {children}
    </code>
  )
}

// Class string applied to the `<sup>` host of footnote references —
// used both by the bare `<SupLink>` (for footnote refs that have no
// preview to tooltip) and by `<FootnoteReference>` when it composes a
// `Tooltip.Trigger as="sup">`. The bolding + accent colour is reused
// from `.prose-host` (`[&_sup_a]:…`); this constant only holds the
// extra refinements that need to override the host on hover.
//
// No structural overrides today — the host `.prose-host [&_sup_a]:…`
// rule already matches everything we need. Kept as an exported empty
// string so the tooltip trigger can keep merging it without churn.
export const FOOTNOTE_SUP_CLASSES = ''

export function SupLink({ className, children, ...props }: ComponentProps<'sup'>) {
  return (
    <sup className={cn(FOOTNOTE_SUP_CLASSES, className)} {...props}>
      {children}
    </sup>
  )
}

// `<center>` is a deprecated HTML4 tag, but a few legacy posts still
// emit it (e.g. for `<center>...</center>` blocks). The Tailwind
// typography plugin does not style it, so we keep a thin wrapper that
// re-uses the same per-paragraph spacing the prose host applies.
export function Center({ className, children, ...props }: ComponentProps<'center'>) {
  return (
    <center className={cn('block mb-5 text-base md:text-prose', className)} {...props}>
      {children}
    </center>
  )
}
