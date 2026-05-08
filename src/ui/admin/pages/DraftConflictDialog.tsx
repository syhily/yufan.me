import { ArrowRightLeftIcon, MonitorIcon, ServerIcon } from 'lucide-react'

import type { Block, PortableTextBody } from '@/shared/portable-text'

import { bodyToPlainText } from '@/shared/portable-text'
import { Badge } from '@/ui/components/ui/badge'
import { Button } from '@/ui/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/ui/components/ui/dialog'
import { cn } from '@/ui/lib/cn'

// "Local vs server" diff resolver. Renders when the editor opens a
// page and both Local Storage AND the server have a draft, but their
// PortableText bodies differ. The author picks one — the loser is
// discarded. There's no merge: PT body diffing is structural, but
// merging two structural docs requires user-driven block-level
// resolution, which is overkill for our scale.
//
// Diff strategy: align blocks by `_key`. A block present only in
// local is shown as added; only-in-server is removed; same-key but
// different content shows both bodies side by side.

export interface DraftConflictDialogProps {
  open: boolean
  /** PT body that was just loaded from Local Storage. */
  localBody: PortableTextBody
  /** PT body of the server's latest revision. */
  serverBody: PortableTextBody
  /** ms-since-epoch when the local copy was last saved. */
  localSavedAt: number | null
  /** ms-since-epoch when the server copy was last updated. */
  serverUpdatedAt: number | null
  /** Adopt the local copy and overwrite the server on next save. */
  onChooseLocal: () => void
  /** Adopt the server copy and discard the local draft. */
  onChooseServer: () => void
}

export function DraftConflictDialog({
  open,
  localBody,
  serverBody,
  localSavedAt,
  serverUpdatedAt,
  onChooseLocal,
  onChooseServer,
}: DraftConflictDialogProps) {
  const diff = diffBodies(localBody, serverBody)

  return (
    <Dialog open={open}>
      <DialogContent className="max-h-[90vh] max-w-5xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ArrowRightLeftIcon className="size-4" />
            检测到本地草稿与云端不一致
          </DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          两份内容都存在，但内容不一致。请选择保留哪一份继续编辑。被舍弃的一份会被永久丢弃。
        </p>
        <div className="grid gap-3 lg:grid-cols-2">
          <DraftPanel
            title="本地草稿"
            icon={<MonitorIcon className="size-4" />}
            timestamp={localSavedAt}
            kind="local"
            diff={diff}
          />
          <DraftPanel
            title="云端版本"
            icon={<ServerIcon className="size-4" />}
            timestamp={serverUpdatedAt}
            kind="server"
            diff={diff}
          />
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2">
          <Button variant="outline" onClick={onChooseServer}>
            <ServerIcon /> 使用云端版本
          </Button>
          <Button onClick={onChooseLocal}>
            <MonitorIcon /> 使用本地草稿
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

interface DiffEntry {
  key: string
  status: 'unchanged' | 'changed' | 'localOnly' | 'serverOnly'
  localBlock: Block | null
  serverBlock: Block | null
}

interface DraftPanelProps {
  title: string
  icon: React.ReactNode
  timestamp: number | null
  kind: 'local' | 'server'
  diff: DiffEntry[]
}

function DraftPanel({ title, icon, timestamp, kind, diff }: DraftPanelProps) {
  return (
    <div className="flex min-h-0 flex-col rounded-md border bg-card">
      <div className="flex items-center gap-2 border-b px-3 py-2 text-sm font-medium">
        {icon}
        {title}
        {timestamp !== null ? (
          <span className="ml-auto text-xs text-muted-foreground">{new Date(timestamp).toLocaleString('zh-CN')}</span>
        ) : null}
      </div>
      <div className="max-h-[480px] overflow-y-auto">
        <ol className="flex flex-col gap-2 p-3">
          {diff.map((entry, idx) => {
            const block = kind === 'local' ? entry.localBlock : entry.serverBlock
            const visible = entry.status !== (kind === 'local' ? 'serverOnly' : 'localOnly')
            if (!visible) {
              // Render a placeholder so the two columns stay aligned.
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
                  entry.status === 'localOnly' && kind === 'local' && 'border-emerald-300 bg-emerald-50',
                  entry.status === 'serverOnly' && kind === 'server' && 'border-rose-300 bg-rose-50',
                )}
              >
                <div className="mb-1 flex items-center gap-2">
                  <BlockTypeBadge block={block} />
                  <span className="text-[10px] tracking-wide text-muted-foreground uppercase">{entry.status}</span>
                </div>
                <BlockPreview block={block} />
              </li>
            )
          })}
        </ol>
      </div>
    </div>
  )
}

function BlockTypeBadge({ block }: { block: Block | null }) {
  if (block === null) {
    return null
  }
  return <Badge variant="outline">{block._type}</Badge>
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

// Align two bodies by `_key`. The output preserves the order in which
// each block first appears, leaning on the local body for shared
// blocks (so the author sees their own ordering on the left). This
// is intentionally simpler than a Myers diff — for the small bodies
// we care about (≤ a few hundred blocks) the per-key alignment is
// good enough and renders predictably.
function diffBodies(localBody: PortableTextBody, serverBody: PortableTextBody): DiffEntry[] {
  const serverByKey = new Map(serverBody.map((block) => [block._key, block]))
  const localByKey = new Map(localBody.map((block) => [block._key, block]))
  const entries: DiffEntry[] = []
  for (const block of localBody) {
    const counterpart = serverByKey.get(block._key) ?? null
    if (counterpart === null) {
      entries.push({ key: block._key, status: 'localOnly', localBlock: block, serverBlock: null })
    } else if (sameBlock(block, counterpart)) {
      entries.push({ key: block._key, status: 'unchanged', localBlock: block, serverBlock: counterpart })
    } else {
      entries.push({ key: block._key, status: 'changed', localBlock: block, serverBlock: counterpart })
    }
  }
  for (const block of serverBody) {
    if (!localByKey.has(block._key)) {
      entries.push({ key: block._key, status: 'serverOnly', localBlock: null, serverBlock: block })
    }
  }
  return entries
}

function sameBlock(left: Block, right: Block): boolean {
  return JSON.stringify(left) === JSON.stringify(right)
}
