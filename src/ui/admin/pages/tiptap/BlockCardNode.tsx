import { Node } from '@tiptap/core'
import { NodeViewWrapper, ReactNodeViewRenderer, type NodeViewProps } from '@tiptap/react'
import {
  CheckIcon,
  CodeIcon,
  FunctionSquareIcon,
  ListTreeIcon,
  Music2Icon,
  PencilIcon,
  SigmaIcon,
  TrashIcon,
  WorkflowIcon,
  XIcon,
} from 'lucide-react'
import { useState } from 'react'

import type { Block } from '@/shared/portable-text'

import { Button } from '@/ui/components/ui/button'
import { Input } from '@/ui/components/ui/input'
import { Label } from '@/ui/components/ui/label'
import { Textarea } from '@/ui/components/ui/textarea'
import { cn } from '@/ui/lib/cn'
import { MusicPlayer } from '@/ui/mdx/music/MusicPlayer'

// Universal "block card" Tiptap node. The PortableText ↔ ProseMirror
// bridge maps every PT custom block (`musicPlayer`, `mathBlock`,
// `mermaid`, `solution`, `footnoteDefinition`) to a single
// `blockCard` PM node carrying the original PT block in
// `attrs.payload`. This Node spec is what makes the editor round-trip
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
            <CardSummary payload={payload} />
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
  return ptType === 'mathBlock' || ptType === 'mermaid' || ptType === 'solution'
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

interface CardSourceEditorProps {
  payload: Block
  onCommit: (next: Block) => void
  onCancel: () => void
}

function CardSourceEditor({ payload, onCommit, onCancel }: CardSourceEditorProps) {
  if (payload._type === 'mathBlock') {
    return (
      <SourceForm
        label="TeX 源"
        initial={payload.tex}
        multiline
        placeholder="\\frac{a}{b}"
        onCommit={(next) => onCommit({ ...payload, tex: next })}
        onCancel={onCancel}
      />
    )
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
  if (payload._type === 'solution') {
    // Solution blocks have nested PT children which are out of
    // scope for this inline editor (the round-trip bridge already
    // preserves them). The only field worth editing in place is
    // the visible label.
    const initial = (payload as { label?: string }).label ?? ''
    return (
      <SourceForm
        label="标签文本"
        initial={initial}
        multiline={false}
        placeholder="解答 / 提示"
        onCommit={(next) => onCommit({ ...payload, label: next } as Block)}
        onCancel={onCancel}
      />
    )
  }
  return null
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
        <Button variant="ghost" size="sm" onClick={onCancel} title="取消">
          <XIcon /> 取消
        </Button>
        <Button size="sm" onClick={() => onCommit(draft)} title="保存编辑">
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
    case 'solution':
      return <ListTreeIcon {...props} />
    case 'footnoteDefinition':
      return <CodeIcon {...props} />
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
    case 'solution':
      return '解答块'
    case 'footnoteDefinition':
      return '脚注定义'
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
          <MusicPlayer id={payload.playerId} />
        </div>
      )
    case 'mathBlock':
      return <code className="mt-1 block text-xs text-muted-foreground">{payload.tex}</code>
    case 'mermaid':
      return <pre className="mt-1 max-h-32 overflow-auto text-xs text-muted-foreground">{payload.code}</pre>
    case 'solution':
      return <div className="mt-1 text-xs text-muted-foreground">包含 {payload.children.length} 个子块</div>
    case 'footnoteDefinition':
      return <div className="mt-1 text-xs text-muted-foreground">脚注 #{payload.index}</div>
    default:
      return <div className="mt-1 text-xs text-muted-foreground">_type: {(payload as { _type: string })._type}</div>
  }
}
