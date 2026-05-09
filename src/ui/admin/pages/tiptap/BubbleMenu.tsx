import type { Editor } from '@tiptap/core'

import { BubbleMenu } from '@tiptap/react/menus'
import {
  BoldIcon,
  Code2Icon,
  ExternalLinkIcon,
  ItalicIcon,
  LinkIcon,
  SigmaIcon,
  StrikethroughIcon,
  UnderlineIcon,
} from 'lucide-react'
import { useState } from 'react'

import { FootnoteRefPanel, MathInlinePanel } from '@/ui/admin/pages/tiptap/InlineMarkPanels'
import { LinkPopover } from '@/ui/admin/pages/tiptap/LinkPopover'
import { Button } from '@/ui/components/ui/button'
import { Separator } from '@/ui/components/ui/separator'
import { cn } from '@/ui/lib/cn'

// BubbleMenu surface: floats above the current selection with the
// most common inline-format affordances + the link popover toggle.
// While a `mathInline` or `footnoteRef` mark is active under the
// selection we swap the action row for a contextual editor (B5) so
// the operator can tweak the TeX source / jump to the linked
// footnote definition without leaving the editor.
//
// **shouldShow** intentionally hides the menu inside tables — the
// `TableBubbleMenu` takes the stage there. Without that branch the
// two menus would stack and fight for keyboard focus.

export interface PageBubbleMenuProps {
  editor: Editor
}

export function PageBubbleMenu({ editor }: PageBubbleMenuProps) {
  const [linkOpen, setLinkOpen] = useState(false)

  return (
    <BubbleMenu
      editor={editor}
      options={{
        placement: 'top',
        offset: 8,
      }}
      shouldShow={({ editor: instance, from, to }) => {
        if (!instance.isEditable) {
          return false
        }
        if (instance.isActive('table')) {
          return false
        }
        // Hide on collapsed selections unless the cursor sits inside
        // an inline mark we can edit (link / mathInline / footnoteRef
        // are clickable cursor-only affordances).
        const collapsed = from === to
        if (collapsed) {
          return instance.isActive('link') || instance.isActive('mathInline') || instance.isActive('footnoteRef')
        }
        return true
      }}
      // Tiptap renders the menu element as a positioned wrapper; we
      // style it minimally and let the inner row handle visuals.
      className="rounded-md border bg-popover text-popover-foreground shadow-md"
    >
      {linkOpen ? (
        <LinkPopover editor={editor} onClose={() => setLinkOpen(false)} />
      ) : editor.isActive('mathInline') ? (
        <MathInlinePanel editor={editor} />
      ) : editor.isActive('footnoteRef') ? (
        <FootnoteRefPanel editor={editor} />
      ) : (
        <ActionRow editor={editor} onLink={() => setLinkOpen(true)} />
      )}
    </BubbleMenu>
  )
}

interface ActionRowProps {
  editor: Editor
  onLink: () => void
}

function ActionRow({ editor, onLink }: ActionRowProps) {
  return (
    <div className="flex items-center gap-0.5 px-1 py-1">
      <Toggle title="加粗" active={editor.isActive('bold')} onClick={() => editor.chain().focus().toggleBold().run()}>
        <BoldIcon />
      </Toggle>
      <Toggle
        title="斜体"
        active={editor.isActive('italic')}
        onClick={() => editor.chain().focus().toggleItalic().run()}
      >
        <ItalicIcon />
      </Toggle>
      <Toggle
        title="下划线"
        active={editor.isActive('underline')}
        onClick={() => editor.chain().focus().toggleUnderline().run()}
      >
        <UnderlineIcon />
      </Toggle>
      <Toggle
        title="删除线"
        active={editor.isActive('strike')}
        onClick={() => editor.chain().focus().toggleStrike().run()}
      >
        <StrikethroughIcon />
      </Toggle>
      <Toggle
        title="行内代码"
        active={editor.isActive('code')}
        onClick={() => editor.chain().focus().toggleCode().run()}
      >
        <Code2Icon />
      </Toggle>
      <Separator orientation="vertical" className="mx-1 h-5" />
      <Toggle title="链接" active={editor.isActive('link')} onClick={onLink}>
        <LinkIcon />
      </Toggle>
      <Toggle
        title="行内公式 (math inline)"
        active={editor.isActive('mathInline')}
        onClick={() => insertMathInline(editor)}
      >
        <SigmaIcon />
      </Toggle>
      {editor.isActive('link') ? (
        <a
          href={(editor.getAttributes('link').href as string | undefined) ?? '#'}
          target="_blank"
          rel="noreferrer"
          title="在新标签打开"
          className="inline-flex h-7 w-7 items-center justify-center rounded text-muted-foreground hover:bg-accent"
        >
          <ExternalLinkIcon className="size-3.5" />
        </a>
      ) : null}
    </div>
  )
}

interface ToggleProps {
  title: string
  active: boolean
  onClick: () => void
  children: React.ReactNode
}

function Toggle({ title, active, onClick, children }: ToggleProps) {
  return (
    <Button
      type="button"
      variant={active ? 'secondary' : 'ghost'}
      size="icon"
      onClick={onClick}
      title={title}
      aria-label={title}
      aria-pressed={active}
      className={cn('size-7')}
    >
      {children}
    </Button>
  )
}

// Insert a fresh `mathInline` mark at the current selection. We
// route through the existing `MathInlineMark` spec so the round-trip
// stays clean even when the operator never opens the inline-mark
// panel to edit the TeX source.
function insertMathInline(editor: Editor) {
  if (editor.isActive('mathInline')) {
    return
  }
  const { from, to } = editor.state.selection
  const text = editor.state.doc.textBetween(from, to, '\n')
  const tex = text === '' ? 'a^2' : text
  editor
    .chain()
    .focus()
    .insertContent({
      type: 'text',
      text: tex,
      marks: [{ type: 'mathInline', attrs: { tex } }],
    })
    .run()
}
