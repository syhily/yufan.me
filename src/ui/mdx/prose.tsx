import type { ComponentProps, ReactNode } from 'react'

import { clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

// MDX prose components — these replace the legacy Bootstrap-era prose
// cascade that lived in `globals.css`. Each component is a thin wrapper around the
// matching HTML tag that bakes the per-tag typography in via Tailwind
// utilities. They are plumbed into MDX via `useMDXComponents` in
// `MdxContent.tsx`.
//
// Why per-element wrappers instead of a single descendant cascade in CSS:
// MDX compiles every Markdown element down to `_jsx('h2', { ... })`, and
// `MDXComponents` lets us swap that for a real React component. That keeps
// styling local to the component tree (so it's analysable by the bundler
// and stays in sync with token edits) without forcing us to author every
// post node by hand.
//
// In-text link underlining (`shadow-[0_-1px...]` inset border-bottom) is
// applied per *text container* (P / Li / Td / Th / Em / Strong) using
// Tailwind arbitrary descendant variants — `[&_a]:...` — so a bare `<A>`
// inside a heading or table-of-contents widget does not pick it up.
const TEXT_LINK_UNDERLINE = clsx(
  '[&_a]:shadow-[0_-1px_0_0_var(--color-accent)_inset]',
  '[&_a]:transition-[box-shadow,opacity] [&_a]:duration-300 [&_a]:ease-in',
  'hover:[&_a]:shadow-[0_-1px_0_0_currentColor_inset] hover:[&_a]:opacity-100',
)

// Common heading anchor styling. `rehype-slug` adds an `<a>` inside each
// heading whose text is the heading slug; `rehype-autolink-headings` (or
// the equivalent Fumadocs default) makes that link the heading text. We
// reset the inherited link colour and add a subtle accent on hover.
const HEADING_ANCHOR = clsx(
  '[&_a]:ml-3 [&_a]:no-underline [&_a]:text-foreground-muted',
  'hover:[&_a]:text-accent [&_a]:transition-colors',
)

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
        className={clsx('absolute left-0 bg-accent', 'top-[7px] w-1.5 h-[22px]', 'max-md:top-[5px] max-md:h-[18px]')}
      />
    )
  }
  if (shape === 'h3') {
    return (
      <span
        aria-hidden
        className={clsx(
          'absolute left-0 bg-accent',
          'top-[11px] w-[5px] h-[11px]',
          'max-md:top-[9px] md:max-lg:top-[9px]',
        )}
      />
    )
  }
  return <span aria-hidden className={clsx('absolute left-0 bg-accent', 'top-[11px] w-[5px] h-[5px]')} />
}

// Legacy cascade values:
//   h1, h2, h3     => line-height: 1.5; margin: 2rem 0 1rem; color: dark
//   h4, h5, h6     => margin: 2rem 0
//   @media (max-width: 767.98px):
//     h1, h2, h3   => margin: 2rem 0 1.25rem
//     h4, h5, h6   => margin: 2.5rem 0 1.75rem
const HEADING_TOP = 'leading-[1.5] mt-8 mb-4 text-foreground max-md:mb-5'
const HEADING_BOTTOM = 'mt-8 mb-8 max-md:mt-10 max-md:mb-7'

export function H1({ className, children, ...props }: ComponentProps<'h1'>) {
  return (
    <h1 className={twMerge(clsx(HEADING_TOP, HEADING_ANCHOR), className)} {...props}>
      {children}
    </h1>
  )
}

export function H2({ className, children, ...props }: ComponentProps<'h2'>) {
  return (
    <h2 className={twMerge(clsx(HEADING_TOP, HEADING_ANCHOR, 'relative pl-6'), className)} {...props}>
      <HeadingBar shape="h2" />
      {children}
    </h2>
  )
}

export function H3({ className, children, ...props }: ComponentProps<'h3'>) {
  return (
    <h3 className={twMerge(clsx(HEADING_TOP, HEADING_ANCHOR, 'relative pl-6'), className)} {...props}>
      <HeadingBar shape="h3" />
      {children}
    </h3>
  )
}

export function H4({ className, children, ...props }: ComponentProps<'h4'>) {
  return (
    <h4 className={twMerge(clsx(HEADING_BOTTOM, HEADING_ANCHOR, 'relative pl-6'), className)} {...props}>
      <HeadingBar shape="h4" />
      {children}
    </h4>
  )
}

export function H5({ className, children, ...props }: ComponentProps<'h5'>) {
  return (
    <h5 className={twMerge(clsx(HEADING_BOTTOM, HEADING_ANCHOR), className)} {...props}>
      {children}
    </h5>
  )
}

export function H6({ className, children, ...props }: ComponentProps<'h6'>) {
  return (
    <h6 className={twMerge(clsx(HEADING_BOTTOM, HEADING_ANCHOR), className)} {...props}>
      {children}
    </h6>
  )
}

export function P({ className, children, ...props }: ComponentProps<'p'>) {
  return (
    <p className={twMerge(clsx('mb-5 text-[1.05rem] max-md:text-base', TEXT_LINK_UNDERLINE), className)} {...props}>
      {children}
    </p>
  )
}

export function Hr({ className, ...props }: ComponentProps<'hr'>) {
  return <hr className={twMerge('my-8 mx-auto', className)} {...props} />
}

export function Ol({ className, children, ...props }: ComponentProps<'ol'>) {
  return (
    <ol
      className={twMerge(clsx('list-decimal mb-4 ml-4', '[&_ol]:ml-4 [&_ul]:ml-4 [&_ol]:mb-0 [&_ul]:mb-0'), className)}
      {...props}
    >
      {children}
    </ol>
  )
}

export function Ul({ className, children, ...props }: ComponentProps<'ul'>) {
  return (
    <ul
      className={twMerge(clsx('list-[circle] mb-4 ml-4', '[&_ol]:ml-4 [&_ul]:ml-4 [&_ol]:mb-0 [&_ul]:mb-0'), className)}
      {...props}
    >
      {children}
    </ul>
  )
}

// Plain `<li>` wrapper. `FootnoteDefinition` (the actual `li:` MDX
// override) calls into this for footnote `<li>` nodes too so the
// underline cascade and base typography still apply.
export function Li({ className, children, ...props }: ComponentProps<'li'>) {
  return (
    <li className={twMerge(clsx(TEXT_LINK_UNDERLINE), className)} {...props}>
      {children}
    </li>
  )
}

// Bare anchor: prose links inherit `--color-accent` and have
// hover `text-decoration: none`. The underline-via-box-shadow effect is
// applied by parent text containers, not by the link itself, so a plain
// link inside a heading or a list-only structure stays clean.
export function A({ className, children, ...props }: ComponentProps<'a'>) {
  return (
    <a className={twMerge(clsx('hover:no-underline focus:no-underline'), className)} {...props}>
      {children}
    </a>
  )
}

// Inline `<code>` (i.e. NOT inside a `<pre>` — those go through
// `<CodeBlock>` and Shiki handles their colour). The styling tracks the
// legacy `:not(pre) > code { padding ... border-radius ... }` cascade
// from the Bootstrap-era prose host.
// We do not gate on the parent here because MDX always emits the
// fenced-block form via `<pre><code>...</code></pre>` and the `pre`
// override (`CodeBlock`) wraps that whole subtree itself, leaving only
// inline `code` nodes to land here.
//
// The bare `<code>` light surface tint (rgb(253, 246, 227) — Solarized
// Light's `--color-base3`) used to live in `globals.css`'s `@layer base`
// and applied to every `<code>` in the bundle. Now that the base layer
// no longer styles `<code>`, the color is baked in here as an arbitrary
// utility so inline code always picks up the warm wash without the
// global cascade.
export function Code({ className, children, ...props }: ComponentProps<'code'>) {
  return (
    <code
      className={twMerge(
        clsx(
          'px-[0.32em] py-[0.08em] mx-[0.06em] rounded-[3px]',
          'font-mono text-[90%] [word-break:break-all] [overflow-wrap:break-word]',
          'bg-[rgb(253,246,227)] dark:bg-surface-muted',
          '[box-decoration-break:clone]',
        ),
        className,
      )}
      {...props}
    >
      {children}
    </code>
  )
}

// Default `<blockquote>` styling. The `<Solution>` wrapper takes care
// of its own appearance and hits a separate component path; this
// component only fires on unstyled blockquotes that authors write
// directly in MDX. Tracks the legacy `blockquote:not(.solution)` cascade
// (border-left + 1rem 2rem padding + 1.75rem 0 margin), and the
// `@variant dark` fallback that fills the surface in night mode.
export function Blockquote({ className, children, ...props }: ComponentProps<'blockquote'>) {
  return (
    <blockquote
      className={twMerge(
        clsx(
          'border-l-4 border-accent border-y-0 border-r-0',
          'my-7 px-8 py-4',
          'dark:bg-surface-muted',
          TEXT_LINK_UNDERLINE,
        ),
        className,
      )}
      {...props}
    >
      {children}
    </blockquote>
  )
}

// Class string applied to the `<sup>` host of footnote references —
// used both by the bare `<SupLink>` (for footnote refs that have no
// preview to tooltip) and by `<FootnoteReference>` when it composes a
// `Tooltip.Trigger as="sup">` (the trigger is a literal `<sup>`, so
// the wrapper-component approach is replaced by handing this constant
// to the trigger via `className`). Tracks the legacy `sup a { ... }`
// cascade.
export const FOOTNOTE_SUP_CLASSES = clsx(
  '[&_a]:text-accent [&_a]:text-[0.8em] [&_a]:font-bold [&_a]:no-underline',
  'hover:[&_a]:text-foreground hover:[&_a]:cursor-pointer',
  // Footnote backref defeats the inherited underline.
  '[&_.data-footnote-backref]:shadow-none hover:[&_.data-footnote-backref]:shadow-none',
)

export function SupLink({ className, children, ...props }: ComponentProps<'sup'>) {
  return (
    <sup className={twMerge(FOOTNOTE_SUP_CLASSES, className)} {...props}>
      {children}
    </sup>
  )
}

// `<center>` is a deprecated HTML4 tag, but a few legacy posts still
// emit it (e.g. for `<center>...</center>` blocks). MDX preserves it as
// a custom element; we keep its margins compatible with `<P>`.
export function Center({ className, children, ...props }: ComponentProps<'center'>) {
  return (
    <center className={twMerge(clsx('block mb-5 text-[1.05rem] max-md:text-base'), className)} {...props}>
      {children}
    </center>
  )
}

// `<MdxImg>` already handles `<img>` (with thumbhash + lazy-loading);
// this `Figure` wrapper lives here to give us a single place to control
// figure / image alignment if needed in future. Not mounted yet.
export function Figure({ className, children, ...props }: ComponentProps<'figure'>) {
  return (
    <figure className={twMerge('m-0', className)} {...props}>
      {children}
    </figure>
  )
}

// `<a><img /></a>` should hint a zoom-in cursor; we attach this on the
// container `.prose-host` element, so callers do not pass children. This
// is unused as a JSX component — kept here to document the intent.
export type ProseChildren = ReactNode
