import { describe, expect, it } from 'vite-plus/test'

import { cn } from '@/ui/lib/cn'

// Guards against tailwind-merge regressions in `cn()`.
//
// 'tw' })` to match Tailwind v4's `prefix(tw)` compile-time
// `extendTailwindMerge` wrapper — `cn.ts` now imports the default
// `twMerge` from `tailwind-merge`. These tests pin the merge
// semantics that BOTH configurations need to satisfy:
//   - dedupe conflicting Tailwind utilities (gap-2 + gap-4 → gap-4)
//   - leave non-Tailwind class literals (`btn`, `media`,
//     `post-like`) opaque (no merging, no rewriting)
//   - respect responsive variant scoping (`md:gap-4` and
//     `gap-3` are different cascade slots and both survive)
// A regression where tailwind-merge can't recognise a Tailwind
// utility returns `'gap-2 gap-4'` instead of `'gap-4'`, which
// is invisible at type-check time and only shows up as missing/
// wrong spacing in production.
describe('cn() — Tailwind utility merging', () => {
  it('drops falsy entries without leaving stray spaces', () => {
    const liked: boolean = false
    expect(cn('media', liked && 'media-36x17')).toBe('media')
    expect(cn('a', null, undefined, '', 'b')).toBe('a b')
  })

  it('preserves order when there is no conflict', () => {
    expect(cn('post-like', 'btn', 'btn-secondary')).toBe('post-like btn btn-secondary')
  })

  it('flattens arrays / objects via clsx semantics', () => {
    expect(cn(['a', ['b', { c: true, d: false }]])).toBe('a b c')
  })

  it('dedupes conflicting Tailwind spacing utilities (last wins)', () => {
    expect(cn('gap-2', 'gap-4')).toBe('gap-4')
    expect(cn('p-2', 'p-1', 'p-3')).toBe('p-3')
  })

  it('dedupes conflicting Tailwind sizing utilities', () => {
    expect(cn('h-4', 'h-6')).toBe('h-6')
    expect(cn('w-full', 'w-1/2')).toBe('w-1/2')
  })

  it('dedupes conflicting Tailwind text utilities', () => {
    expect(cn('text-sm', 'text-base')).toBe('text-base')
    expect(cn('text-(--color-foreground)', 'text-(--color-primary)')).toBe('text-(--color-primary)')
  })

  it('does NOT dedupe non-conflicting Tailwind utilities', () => {
    const result = cn('gap-4', 'p-2', 'text-base')
    expect(result.split(' ').sort()).toEqual(['gap-4', 'p-2', 'text-base'])
  })

  it('dedupes Tailwind responsive variants independently', () => {
    expect(cn('gap-2', 'md:gap-4', 'gap-3')).toBe('md:gap-4 gap-3')
  })

  it('treats non-Tailwind (legacy WordPress-compat) utilities as opaque — no merging', () => {
    expect(cn('btn', 'btn')).toBe('btn btn')
    expect(cn('media', 'media-36x17')).toBe('media media-36x17')
  })

  it('mixes legacy and Tailwind utilities cleanly', () => {
    expect(cn('btn btn-secondary', 'gap-2', 'gap-4')).toBe('btn btn-secondary gap-4')
  })

  it('handles conditional shorthand (null/undefined/false short-circuits)', () => {
    const isPending: boolean = false
    const liked: boolean = true
    expect(cn('post-like btn btn-secondary btn-lg btn-rounded', liked && 'current', isPending && 'lock')).toBe(
      'post-like btn btn-secondary btn-lg btn-rounded current',
    )
  })

  it('returns an empty string for empty input', () => {
    expect(cn()).toBe('')
    expect(cn(null, undefined, false)).toBe('')
  })
})
