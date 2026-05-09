import { Node } from '@tiptap/core'
import { NodeViewWrapper, ReactNodeViewRenderer, type NodeViewProps } from '@tiptap/react'
import {
  CheckIcon,
  FunctionSquareIcon,
  Music2Icon,
  PencilIcon,
  SigmaIcon,
  TrashIcon,
  WorkflowIcon,
  XIcon,
} from 'lucide-react'
import { useState } from 'react'

import type { Block, MathBlock, MermaidBlock, MusicPlayerBlock } from '@/shared/portable-text'

import { useAdminMathPreview } from '@/ui/admin/pages/tiptap/use-admin-math-preview'
import { Button } from '@/ui/components/ui/button'
import { Checkbox } from '@/ui/components/ui/checkbox'
import { Input } from '@/ui/components/ui/input'
import { Label } from '@/ui/components/ui/label'
import { Textarea } from '@/ui/components/ui/textarea'
import { cn } from '@/ui/lib/cn'
import { MusicPlayer } from '@/ui/mdx/music/MusicPlayer'

// Universal "block card" Tiptap node. The PortableText ↔ ProseMirror
// bridge maps opaque PT custom blocks (`musicPlayer`, `mathBlock`,
// `mermaid`) to a single `blockCard` PM node carrying the original PT
// block in `attrs.payload`. **`solution`** uses a dedicated nested PM node
// (`SolutionNode`). **`footnoteDefinition`** is omitted from the admin page
// editor PM doc — see `@/shared/portable-text-footnote-merge`.
// This Node spec is what makes the editor round-trip
// those blocks safely:
//
// * Without a Node spec, Tiptap silently drops unknown PM nodes, so
//   loading a body with any custom block would lose data on the
//   first save.
// * Marking the node `atom: true` keeps ProseMirror from recursing
//   into the payload — the whole card is a single, indivisible unit
//   from the editor's perspective. Edits happen through dedicated
//   dialog panels (TODO milestones), not by typing into the card.
// * `selectable: true` lets the user select the card with a click and
//   delete it with `Delete` / `Backspace`, which is the expected
//   keyboard model for editor-as-document.
//
// The render path uses a React NodeView so we can show a preview
// (lucide icon + payload summary) instead of a placeholder bar.

export interface BlockCardAttrs {
  _key: string
  _ptType: string
  payload: Block
}

export const BlockCardNode = Node.create({
  name: 'blockCard',
  group: 'block',
  atom: true,
  selectable: true,
  draggable: true,
  addAttributes() {
    return {
      _key: { default: '' },
      _ptType: { default: '' },
      payload: { default: null as Block | null },
    }
  },
  parseHTML() {
    // Pasting a `<div data-pt-block-card="…">` is unusual but harmless —
    // we still register a parse rule so paste from another editor
    // panel survives without error.
    return [{ tag: 'div[data-pt-block-card]' }]
  },
  renderHTML({ node }) {
    const ptType = (node.attrs as BlockCardAttrs)._ptType
    return ['div', { 'data-pt-block-card': ptType, contenteditable: 'false' }, 0]
  },
  addNodeView() {
    return ReactNodeViewRenderer(BlockCardView)
  },
})

function BlockCardView(props: NodeViewProps) {
  const attrs = props.node.attrs as BlockCardAttrs
  const payload = attrs.payload
  const [editing, setEditing] = useState(false)
  const editable = payload !== null && isInlineEditable(payload._type)

  const commitPayload = (next: Block) => {
    // Drop any pre-rendered fields when the source changes — the
    // server will repopulate them on save (see prerender.ts). This
    // keeps the editor honest about "preview matches the source".
    const cleaned = stripPrerenderArtifacts(next)
    props.updateAttributes({ payload: cleaned })
    setEditing(false)
  }

  return (
    <NodeViewWrapper
      data-pt-block-card={attrs._ptType}
      className={cn(
        'group relative my-3 rounded-md border-2 border-dashed bg-muted/30 p-4 text-sm',
        props.selected ? 'border-primary' : 'border-border',
      )}
      contentEditable={false}
    >
      <div className="flex items-start gap-3">
        <CardIcon ptType={attrs._ptType} />
        <div className="grow">
          <div className="flex items-center gap-2">
            <span className="font-medium">{cardTitle(attrs._ptType)}</span>
            {editable && !editing ? (
              <Button
                variant="ghost"
                size="icon"
                title="编辑源"
                aria-label="编辑源"
                className="opacity-0 transition-opacity group-hover:opacity-100"
                onClick={() => setEditing(true)}
              >
                <PencilIcon />
              </Button>
            ) : null}
          </div>
          {editing && payload !== null ? (
            <CardSourceEditor payload={payload} onCommit={commitPayload} onCancel={() => setEditing(false)} />
          ) : (
            <>
              {payload !== null && payload._type === 'musicPlayer' ? (
                <MusicPlayerOptions
                  stableId={attrs._key}
                  auto={payload.auto === true}
                  center={payload.center === true}
                  onFlagChange={(flag, enabled) =>
                    props.updateAttributes({
                      payload: stripPrerenderArtifacts(patchMusicPlayerFlag(payload, flag, enabled)),
                    })
                  }
                />
              ) : null}
              {payload !== null && payload._type === 'mermaid' ? (
                <MermaidBlockOptions
                  stableId={attrs._key}
                  center={payload.center === true}
                  onCenterChange={(enabled) =>
                    props.updateAttributes({
                      payload: stripPrerenderArtifacts(patchMermaidCenterFlag(payload, enabled)),
                    })
                  }
                />
              ) : null}
              <CardSummary payload={payload} />
            </>
          )}
        </div>
        <Button
          variant="ghost"
          size="icon"
          title="删除"
          aria-label="删除该块"
          className="opacity-0 transition-opacity group-hover:opacity-100"
          onClick={() => props.deleteNode()}
        >
          <TrashIcon />
        </Button>
      </div>
    </NodeViewWrapper>
  )
}

function isInlineEditable(ptType: string): boolean {
  return ptType === 'mathBlock' || ptType === 'mermaid'
}

// Drop the cached server-rendered fields when the user mutates the
// source. The save path repopulates them; leaving stale renders in
// place would silently desync source and preview.
function stripPrerenderArtifacts(block: Block): Block {
  if (block._type === 'mathBlock' || block._type === 'mermaid') {
    const { svg: _ignored, ...rest } = block as { svg?: string } & Block
    return rest as Block
  }
  if (block._type === 'code') {
    const { highlightedHtml: _ignored, ...rest } = block as { highlightedHtml?: string } & Block
    return rest as Block
  }
  return block
}

function patchMusicPlayerFlag(payload: MusicPlayerBlock, flag: 'auto' | 'center', enabled: boolean): Block {
  const next: MusicPlayerBlock = { ...payload }
  if (enabled) {
    next[flag] = true
  } else {
    delete next[flag]
  }
  return next
}

function patchMermaidCenterFlag(payload: MermaidBlock, enabled: boolean): Block {
  const next: MermaidBlock = { ...payload }
  if (enabled) {
    next.center = true
  } else {
    delete next.center
  }
  return next
}

interface MusicPlayerOptionsProps {
  stableId: string
  auto: boolean
  center: boolean
  onFlagChange: (flag: 'auto' | 'center', enabled: boolean) => void
}

function MusicPlayerOptions({ stableId, auto, center, onFlagChange }: MusicPlayerOptionsProps) {
  return (
    <div className="mt-2 flex flex-wrap gap-x-5 gap-y-2 border-b border-border/80 pb-2">
      <div className="flex items-center gap-2">
        <Checkbox
          id={`music-auto-${stableId}`}
          checked={auto}
          onCheckedChange={(v) => onFlagChange('auto', v === true)}
        />
        <Label htmlFor={`music-auto-${stableId}`} className="cursor-pointer text-xs leading-none font-normal">
          自动播放
        </Label>
      </div>
      <div className="flex items-center gap-2">
        <Checkbox
          id={`music-center-${stableId}`}
          checked={center}
          onCheckedChange={(v) => onFlagChange('center', v === true)}
        />
        <Label htmlFor={`music-center-${stableId}`} className="cursor-pointer text-xs leading-none font-normal">
          永远居中
        </Label>
      </div>
    </div>
  )
}

interface MermaidBlockOptionsProps {
  stableId: string
  center: boolean
  onCenterChange: (enabled: boolean) => void
}

function MermaidBlockOptions({ stableId, center, onCenterChange }: MermaidBlockOptionsProps) {
  return (
    <div className="mt-2 flex flex-wrap gap-x-5 gap-y-2 border-b border-border/80 pb-2">
      <div className="flex items-center gap-2">
        <Checkbox
          id={`mermaid-center-${stableId}`}
          checked={center}
          onCheckedChange={(v) => onCenterChange(v === true)}
        />
        <Label htmlFor={`mermaid-center-${stableId}`} className="cursor-pointer text-xs leading-none font-normal">
          永远居中
        </Label>
      </div>
    </div>
  )
}

interface CardSourceEditorProps {
  payload: Block
  onCommit: (next: Block) => void
  onCancel: () => void
}

function CardSourceEditor({ payload, onCommit, onCancel }: CardSourceEditorProps) {
  if (payload._type === 'mathBlock') {
    return <MathBlockSourceEditor payload={payload} onCommit={onCommit} onCancel={onCancel} />
  }
  if (payload._type === 'mermaid') {
    return (
      <SourceForm
        label="Mermaid 源"
        initial={payload.code}
        multiline
        placeholder="graph TD\n  A --> B"
        onCommit={(next) => onCommit({ ...payload, code: next })}
        onCancel={onCancel}
      />
    )
  }
  return null
}

interface MathBlockSourceEditorProps {
  payload: MathBlock
  onCommit: (next: Block) => void
  onCancel: () => void
}

function MathBlockSourceEditor({ payload, onCommit, onCancel }: MathBlockSourceEditorProps) {
  const [draft, setDraft] = useState(payload.tex)
  const { previewHtml, renderError, showSpinner } = useAdminMathPreview(draft, true)

  return (
    <div className="mt-2 flex w-full max-w-full flex-col gap-2">
      <div className="flex items-center justify-between gap-2">
        <Label className="text-xs">公式块 TeX</Label>
        {renderError !== null ? (
          <span className="shrink-0 text-xs text-destructive">语法错误：{renderError}</span>
        ) : null}
      </div>
      <p className="text-xs leading-snug text-muted-foreground">
        独占行或多行环境（align、gather 等）。预览与发布后正文一致（MathJax）。
      </p>
      <Textarea
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        placeholder={'\\begin{align*}\n    a &= b\\\\\n    c &= d\n\\end{align*}'}
        rows={8}
        className="font-mono text-xs"
      />
      <div className="rounded-sm border bg-muted/30 px-2 py-2 text-sm">
        <span className="text-xs text-muted-foreground">预览：</span>
        {showSpinner ? (
          <span className="ml-2 text-xs text-muted-foreground">渲染中…</span>
        ) : (
          <div
            className="math math-display mt-2 max-w-full overflow-x-auto text-center [&_svg]:mx-auto [&_svg]:block [&_svg]:max-w-none"
            dangerouslySetInnerHTML={{ __html: previewHtml }}
          />
        )}
      </div>
      <div className="flex justify-end gap-1">
        <Button
          variant="ghost"
          size="sm"
          type="button"
          onClick={() => {
            setDraft(payload.tex)
            onCancel()
          }}
          title="取消"
        >
          <XIcon /> 取消
        </Button>
        <Button size="sm" type="button" onClick={() => onCommit({ ...payload, tex: draft })} title="保存编辑">
          <CheckIcon /> 保存
        </Button>
      </div>
    </div>
  )
}

interface SourceFormProps {
  label: string
  initial: string
  multiline: boolean
  placeholder: string
  onCommit: (next: string) => void
  onCancel: () => void
}

function SourceForm({ label, initial, multiline, placeholder, onCommit, onCancel }: SourceFormProps) {
  const [draft, setDraft] = useState(initial)
  return (
    <div className="mt-2 flex flex-col gap-2">
      <Label className="text-xs">{label}</Label>
      {multiline ? (
        <Textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder={placeholder}
          rows={5}
          className="font-mono text-xs"
        />
      ) : (
        <Input value={draft} onChange={(e) => setDraft(e.target.value)} placeholder={placeholder} />
      )}
      <div className="flex justify-end gap-1">
        <Button
          variant="ghost"
          size="sm"
          type="button"
          onClick={() => {
            setDraft(initial)
            onCancel()
          }}
          title="取消"
        >
          <XIcon /> 取消
        </Button>
        <Button size="sm" type="button" onClick={() => onCommit(draft)} title="保存编辑">
          <CheckIcon /> 保存
        </Button>
      </div>
    </div>
  )
}

function CardIcon({ ptType }: { ptType: string }) {
  const props = { className: 'mt-0.5 size-5 shrink-0 text-muted-foreground' }
  switch (ptType) {
    case 'musicPlayer':
      return <Music2Icon {...props} />
    case 'mathBlock':
      return <SigmaIcon {...props} />
    case 'mermaid':
      return <WorkflowIcon {...props} />
    default:
      return <FunctionSquareIcon {...props} />
  }
}

function cardTitle(ptType: string): string {
  switch (ptType) {
    case 'musicPlayer':
      return '音乐播放器'
    case 'mathBlock':
      return '数学公式块'
    case 'mermaid':
      return 'Mermaid 流程图'
    default:
      return `自定义块 (${ptType})`
  }
}

interface CardSummaryProps {
  payload: Block | null
}

function CardSummary({ payload }: CardSummaryProps) {
  if (payload === null) {
    return <div className="text-xs text-muted-foreground">无效的负载</div>
  }
  switch (payload._type) {
    case 'musicPlayer':
      return (
        <div className="mt-2">
          <MusicPlayer id={payload.playerId} auto={false} center={payload.center} />
        </div>
      )
    case 'mathBlock':
      return payload.svg !== undefined && payload.svg !== '' ? (
        <div
          className="math math-display mt-2 max-w-full overflow-x-auto text-center [&_svg]:max-w-none"
          // MathJax SVG from the same prerender pipeline as publish / preview.
          dangerouslySetInnerHTML={{ __html: payload.svg }}
        />
      ) : (
        <code className="mt-1 block text-xs text-muted-foreground">{payload.tex}</code>
      )
    case 'mermaid': {
      const center = payload.center === true
      const inner =
        payload.svg !== undefined && payload.svg !== '' ? (
          <div
            className={cn('mermaid mt-2 max-w-full overflow-x-auto [&_svg]:max-w-none', center && 'shrink-0')}
            dangerouslySetInnerHTML={{ __html: payload.svg }}
          />
        ) : (
          <pre className="mt-1 max-h-32 shrink-0 overflow-auto text-xs text-muted-foreground">{payload.code}</pre>
        )
      if (!center) {
        return inner
      }
      return <div className="flex max-w-full justify-center overflow-x-auto">{inner}</div>
    }
    default:
      return <div className="mt-1 text-xs text-muted-foreground">_type: {(payload as { _type: string })._type}</div>
  }
}
