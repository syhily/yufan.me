import { Node } from '@tiptap/core'
import { NodeViewWrapper, ReactNodeViewRenderer, type NodeViewProps } from '@tiptap/react'
import {
  CodeIcon,
  FunctionSquareIcon,
  ListTreeIcon,
  Music2Icon,
  SigmaIcon,
  TrashIcon,
  UsersIcon,
  WorkflowIcon,
} from 'lucide-react'

import type { Block } from '@/shared/portable-text'

import { Button } from '@/ui/components/ui/button'
import { cn } from '@/ui/lib/cn'
import { MusicPlayer } from '@/ui/mdx/music/MusicPlayer'

// Universal "block card" Tiptap node. The PortableText ↔ ProseMirror
// bridge maps every PT custom block (`musicPlayer`, `mathBlock`,
// `mermaid`, `solution`, `friends`, `footnoteDefinition`) to a single
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
          <div className="font-medium">{cardTitle(attrs._ptType)}</div>
          <CardSummary payload={payload} />
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
    case 'friends':
      return <UsersIcon {...props} />
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
    case 'friends':
      return '友链网格'
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
    case 'friends':
      return <div className="mt-1 text-xs text-muted-foreground">渲染时使用 catalog 友链</div>
    case 'footnoteDefinition':
      return <div className="mt-1 text-xs text-muted-foreground">脚注 #{payload.index}</div>
    default:
      return <div className="mt-1 text-xs text-muted-foreground">_type: {(payload as { _type: string })._type}</div>
  }
}
