import { diff_match_patch } from 'diff-match-patch'

import type { Block, PortableTextBody } from '@/shared/portable-text'

import { bodyToPlainText } from '@/shared/portable-text'
import { Badge } from '@/ui/components/ui/badge'
import { cn } from '@/ui/lib/cn'

// Shared block-level diff primitives used by both the
// `DraftConflictDialog` (local-vs-server) and the
// `RevisionHistoryDrawer` (any-revision-vs-current). Living in a
// dedicated module keeps the diff renderer reusable without
// pulling DialogContent / Sheet hierarchy into either consumer.

export interface DiffEntry {
  key: string
  status: 'unchanged' | 'changed' | 'leftOnly' | 'rightOnly'
  leftBlock: Block | null
  rightBlock: Block | null
}

// Singleton — diff-match-patch is stateless after construction and
// the cleanup defaults are tuned for our short editor blocks.
const dmp = new diff_match_patch()

interface InlineDiffPart {
  // 1 = insertion (only on the right side); -1 = deletion (only on
  // the left side); 0 = unchanged on both sides.
  op: -1 | 0 | 1
  text: string
}

export function inlineCharDiff(left: string, right: string): InlineDiffPart[] {
  const result = dmp.diff_main(left, right)
  // Word-level cleanup is the closest match to "show me what the
  // user actually changed" — the per-character output of diff_main
  // looks like alphabet soup on Chinese prose.
  dmp.diff_cleanupSemantic(result)
  return result.map(([op, text]) => ({ op: op as -1 | 0 | 1, text }))
}

// Align two bodies by `_key`. The output preserves the order in which
// each block first appears, leaning on the **left** body for shared
// blocks (so the caller renders the side they care most about on the
// left). This is intentionally simpler than a Myers diff — for the
// small bodies we care about (≤ a few hundred blocks) the per-key
// alignment is good enough and renders predictably.
export function diffBodies(leftBody: PortableTextBody, rightBody: PortableTextBody): DiffEntry[] {
  const rightByKey = new Map(rightBody.map((block) => [block._key, block]))
  const leftByKey = new Map(leftBody.map((block) => [block._key, block]))
  const entries: DiffEntry[] = []
  for (const block of leftBody) {
    const counterpart = rightByKey.get(block._key) ?? null
    if (counterpart === null) {
      entries.push({ key: block._key, status: 'leftOnly', leftBlock: block, rightBlock: null })
    } else if (sameBlock(block, counterpart)) {
      entries.push({ key: block._key, status: 'unchanged', leftBlock: block, rightBlock: counterpart })
    } else {
      entries.push({ key: block._key, status: 'changed', leftBlock: block, rightBlock: counterpart })
    }
  }
  for (const block of rightBody) {
    if (!leftByKey.has(block._key)) {
      entries.push({ key: block._key, status: 'rightOnly', leftBlock: null, rightBlock: block })
    }
  }
  return entries
}

function sameBlock(left: Block, right: Block): boolean {
  return JSON.stringify(left) === JSON.stringify(right)
}

export interface DiffPanelProps {
  diff: DiffEntry[]
  /** Which side of each diff entry to render in this panel. */
  side: 'left' | 'right'
}

// Renders one side of a block-level diff as a vertical list. Equal
// blocks render dimmed; changed blocks highlight char-level edits;
// blocks unique to the *other* side render as `（无）` placeholders
// so two stacked panels stay row-aligned.
export function DiffPanel({ diff, side }: DiffPanelProps) {
  return (
    <ol className="flex flex-col gap-2">
      {diff.map((entry, idx) => {
        const block = side === 'left' ? entry.leftBlock : entry.rightBlock
        const onlyOtherSide =
          (side === 'left' && entry.status === 'rightOnly') || (side === 'right' && entry.status === 'leftOnly')
        if (onlyOtherSide) {
          return (
            <li
              key={`${entry.key}-${idx}`}
              className="rounded border border-dashed border-muted bg-muted/30 px-2 py-2 text-xs text-muted-foreground"
            >
              （无）
            </li>
          )
        }
        return (
          <li
            key={`${entry.key}-${idx}`}
            className={cn(
              'rounded border px-2 py-2 text-sm',
              entry.status === 'unchanged' && 'border-muted bg-muted/30',
              entry.status === 'changed' && 'border-amber-300 bg-amber-50',
              entry.status === 'leftOnly' && side === 'left' && 'border-rose-300 bg-rose-50',
              entry.status === 'rightOnly' && side === 'right' && 'border-emerald-300 bg-emerald-50',
            )}
          >
            <div className="mb-1 flex items-center gap-2">
              <BlockTypeBadge block={block} />
              <span className="text-[10px] tracking-wide text-muted-foreground uppercase">{entry.status}</span>
            </div>
            {entry.status === 'changed' && entry.leftBlock?._type === 'block' && entry.rightBlock?._type === 'block' ? (
              <BlockInlineDiff leftBlock={entry.leftBlock} rightBlock={entry.rightBlock} side={side} />
            ) : (
              <BlockPreview block={block} />
            )}
          </li>
        )
      })}
    </ol>
  )
}

function BlockTypeBadge({ block }: { block: Block | null }) {
  if (block === null) {
    return null
  }
  return <Badge variant="outline">{block._type}</Badge>
}

interface BlockInlineDiffProps {
  leftBlock: Block
  rightBlock: Block
  side: 'left' | 'right'
}

// Highlight char-level insertions / deletions inside a text block
// pair. The right panel highlights insertions (green); the left
// panel highlights deletions (red, struck-through). Equal runs
// render as plain text.
function BlockInlineDiff({ leftBlock, rightBlock, side }: BlockInlineDiffProps) {
  const leftText = bodyToPlainText([leftBlock]).trim()
  const rightText = bodyToPlainText([rightBlock]).trim()
  const parts = inlineCharDiff(leftText, rightText)
  return (
    <p className="line-clamp-6 leading-relaxed break-words">
      {parts.map((part, idx) => {
        if (part.op === 0) {
          return <span key={idx}>{part.text}</span>
        }
        if (side === 'right' && part.op === 1) {
          return (
            <span key={idx} className="rounded bg-emerald-200/70 px-0.5 text-emerald-950">
              {part.text}
            </span>
          )
        }
        if (side === 'left' && part.op === -1) {
          return (
            <span key={idx} className="rounded bg-rose-200/70 px-0.5 text-rose-950 line-through">
              {part.text}
            </span>
          )
        }
        return null
      })}
    </p>
  )
}

function BlockPreview({ block }: { block: Block | null }) {
  if (block === null) {
    return <span className="text-xs text-muted-foreground">（空）</span>
  }
  if (block._type === 'block') {
    const text = bodyToPlainText([block]).trim()
    return <span className="line-clamp-3 break-words">{text || '（空文本块）'}</span>
  }
  return (
    <pre className="line-clamp-3 text-xs break-all text-muted-foreground">{JSON.stringify(block).slice(0, 240)}</pre>
  )
}
