// Replacement for Astro's `<Fragment set:html={…}>`. React forbids
// `dangerouslySetInnerHTML` on a Fragment, so callers that want to stream
// pre-sanitized HTML pick a host tag — `<span>` for inline (comment body,
// listing descriptions), `<div>` for block content.
import type { HTMLAttributes } from 'react'

type BaseProps<T extends 'span' | 'div'> = Omit<HTMLAttributes<HTMLElement>, 'children' | 'dangerouslySetInnerHTML'> & {
  html: string
  as?: T
}

export function Html({ html, as = 'span', ...rest }: BaseProps<'span' | 'div'>) {
  const Tag = as
  return <Tag {...rest} dangerouslySetInnerHTML={{ __html: html }} />
}
