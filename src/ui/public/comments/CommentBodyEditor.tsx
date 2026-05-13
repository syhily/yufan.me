import Link from '@tiptap/extension-link'
import Placeholder from '@tiptap/extension-placeholder'
import { type Editor, EditorContent, useEditor, useEditorState } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import {
  BoldIcon,
  CodeIcon,
  ItalicIcon,
  LinkIcon,
  ListIcon,
  ListOrderedIcon,
  QuoteIcon,
  StrikethroughIcon,
  UnderlineIcon,
} from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'

import type { PmDoc } from '@/shared/pt/bridge/types'
import type { PortableTextBody } from '@/shared/pt/schema'

import { pmDocToBody } from '@/shared/pt/bridge/pm-to-pt'
import { bodyToPmDoc } from '@/shared/pt/bridge/pt-to-pm'
import { type CommentBody, safeValidateCommentBody } from '@/shared/pt/comment-schema'
import { BlockCardNode } from '@/ui/admin/editor/tiptap/BlockCardNode'
import { MathInlineMark } from '@/ui/admin/editor/tiptap/InlineMarks'
import { SlashCommandsExtension } from '@/ui/admin/editor/tiptap/SlashMenu'
import { Button } from '@/ui/components/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/ui/components/dialog'
import { Input } from '@/ui/components/input'
import { Label } from '@/ui/components/label'
import { cn } from '@/ui/lib/cn'
import { COMMENT_SLASH_COMMANDS } from '@/ui/public/comments/comment-slash-commands'
import { EmojiSuggestionExtension } from '@/ui/public/comments/EmojiSuggestion'

// Simplified Tiptap editor for comment bodies. Mirrors the admin
// `PageBodyEditor` shape but loads only the extensions needed for the
// comment dialect: paragraphs / lists / blockquote / inline marks /
// fenced code / inline math (`$…$` shortcut) / block math (slash
// menu). No headings, no image library, no music picker, no tables,
// no footnotes — those are filtered out at the slash menu, the
// `commentBodySchema` perimeter rejects any rogue blocks that slip
// past the editor UI.
//
// Round-tripping uses the same PT ↔ ProseMirror bridge as posts /
// pages, since `CommentBody` is a strict subset of the upstream PT
// dialect.

export interface CommentBodyEditorProps {
  /** Initial PortableText body. Read on first mount + when `bodyKey` changes. */
  initialBody: CommentBody
  /**
   * Identity of the body source — when this string changes the editor
   * resets its content from `initialBody`. Use it for the reply form
   * to reset after submit, or when switching the edited comment.
   */
  bodyKey: string
  /** Fired on every editor update with the freshly-derived comment body. */
  onBodyChange: (body: CommentBody) => void
  /** When true, the editor becomes read-only. */
  disabled?: boolean
  /** Override the placeholder copy. */
  placeholder?: string
  /** Extra Tailwind classes applied to the editor content host. */
  className?: string
}

const DEFAULT_PLACEHOLDER = '写下你的评论…  / 命令，$ 公式，: Emoji'

const EMPTY_BODY: CommentBody = []

function safeBodyToPmDoc(body: CommentBody): PmDoc {
  const result = safeValidateCommentBody(body)
  const safe = result.ok ? result.body : EMPTY_BODY
  return bodyToPmDoc(safe as PortableTextBody)
}

export function CommentBodyEditor({
  initialBody,
  bodyKey,
  onBodyChange,
  disabled,
  placeholder,
  className,
}: CommentBodyEditorProps) {
  // Pin the latest `onBodyChange` so re-renders from the parent don't
  // tear the editor's transaction handler. Same pattern as
  // `useApiFetcher` and `PageBodyEditor`.
  const onBodyChangeRef = useRef(onBodyChange)
  onBodyChangeRef.current = onBodyChange

  const placeholderText = placeholder ?? DEFAULT_PLACEHOLDER

  const extensions = useMemo(
    () => [
      StarterKit.configure({
        // Comments are unstructured prose — headings would let one
        // commenter visually outweigh the rest of the thread.
        heading: false,
        // No native image support; comments don't carry media uploads.
        // The PT schema rejects `image` blocks anyway.
        // StarterKit doesn't include an image extension by default,
        // so nothing to disable here, but list it for clarity.
        horizontalRule: false,
        link: false,
        dropcursor: { color: '#3b82f6', width: 2 },
      }),
      Link.configure({
        openOnClick: false,
        autolink: true,
        HTMLAttributes: { class: null, target: null, rel: null },
      }),
      Placeholder.configure({ placeholder: placeholderText }),
      // `mathInline` mark + `$…$` input rule.
      MathInlineMark,
      // PM node for any `mathBlock` payloads round-tripping through
      // the bridge. The shared editor node view ships with a math
      // preview surface that's perfectly usable in the comment form.
      BlockCardNode,
      SlashCommandsExtension.configure({ commands: COMMENT_SLASH_COMMANDS }),
      EmojiSuggestionExtension,
    ],
    [placeholderText],
  )

  const editor = useEditor({
    immediatelyRender: false,
    editable: disabled !== true,
    extensions,
    content: safeBodyToPmDoc(initialBody) as never,
    onUpdate({ editor: instance }) {
      const body = pmDocToBody(instance.getJSON() as PmDoc)
      const result = safeValidateCommentBody(body)
      if (result.ok) {
        onBodyChangeRef.current(result.body)
      } else {
        // Editor produced a transient state that violates the comment
        // schema (rare — typically only between two transactions on a
        // freshly-inserted block). The save-side `canonicalizeCommentBody`
        // will surface a precise error if the body is still invalid at
        // submit time; for live updates we propagate the parent's most
        // recent valid body by skipping this tick.
      }
    },
  })

  // Reset content when `bodyKey` changes (form submit clears the editor,
  // switching the edited comment loads a different body).
  useEffect(() => {
    if (editor === null) {
      return
    }
    editor.commands.setContent(safeBodyToPmDoc(initialBody) as never, { emitUpdate: false })
    // `initialBody` ref isn't a stable dep — keying on `bodyKey` is
    // the documented contract for resetting.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bodyKey, editor])

  useEffect(() => {
    if (editor !== null) {
      editor.setEditable(disabled !== true)
    }
  }, [disabled, editor])

  return (
    <div
      className={cn(
        // `group/comment-editor` lets the toolbar listen for
        // `focus-within` on this wrapper without grabbing the focus
        // state itself.
        'group/comment-editor',
        'rounded-md border border-line bg-background',
        'focus-within:border-brand focus-within:ring-1 focus-within:ring-brand/40',
        className,
      )}
    >
      {editor !== null && <CommentEditorToolbar editor={editor} disabled={disabled === true} />}
      <EditorContent
        editor={editor}
        className={cn(
          'prose-blog prose prose-sm max-w-none px-3 py-2',
          'min-h-[6rem]',
          'wrap-break-word whitespace-normal',
          // Tiptap injects `.ProseMirror` on the contenteditable host.
          '[&_.ProseMirror]:min-h-[5rem] [&_.ProseMirror]:outline-none',
          // The Tailwind Typography plugin gives every `<p>` a top
          // margin via `.prose > :first-child` reset that only fires
          // for direct children — but our `<p>` sits inside the
          // injected `.ProseMirror` wrapper, so the reset misses and
          // the first paragraph picks up both the editor `py-2` AND
          // the prose-sm `<p>` margin. Zero out the first/last child
          // margins inside `.ProseMirror` so the caret hugs the
          // padding box instead of floating below it.
          '[&_.ProseMirror>:first-child]:mt-0 [&_.ProseMirror>:last-child]:mb-0',
        )}
      />
      <CommentEditorHint />
    </div>
  )
}

interface CommentEditorToolbarProps {
  editor: Editor
  disabled: boolean
}

// Inline formatting toolbar. Hidden by default; revealed only while
// the wrapping `<div>` carries `:focus-within` (i.e. while the
// contenteditable, the slash menu, or any toolbar button itself
// has focus). The button-bar lives inside the same wrapper, so
// clicking a button preserves `focus-within` — no flicker between
// "editor focused" and "button focused" states.
//
// Markdown-shortcut hints (`**bold**`, `*italic*`, …) turned out to
// be unreliable: Tiptap's StarterKit only wires a subset of GFM
// shortcuts and the comment dialect deliberately disables a few of
// them. Surfacing the actual buttons removes the guesswork.
function CommentEditorToolbar({ editor, disabled }: CommentEditorToolbarProps) {
  const state = useEditorState({
    editor,
    selector: ({ editor: ed }) => ({
      bold: ed.isActive('bold'),
      italic: ed.isActive('italic'),
      underline: ed.isActive('underline'),
      strike: ed.isActive('strike'),
      code: ed.isActive('code'),
      bulletList: ed.isActive('bulletList'),
      orderedList: ed.isActive('orderedList'),
      blockquote: ed.isActive('blockquote'),
      link: ed.isActive('link'),
    }),
  })

  // Replaces the legacy `window.prompt` flow. The toolbar seeds the
  // dialog with the link href under the current selection; the dialog
  // owns the apply / remove / cancel branches and calls into the
  // editor on confirm so the toolbar handler stays synchronous.
  const [linkPromptSeed, setLinkPromptSeed] = useState<string | null>(null)

  const promptLink = () => {
    const current = (editor.getAttributes('link').href as string | undefined) ?? ''
    setLinkPromptSeed(current)
  }

  return (
    <>
      <div
        className={cn(
          // Hidden by default; revealed when the wrapping div carries
          // `:focus-within` (the editor, slash menu, or any toolbar
          // button is focused).
          'hidden flex-wrap items-center gap-0.5 border-b border-line/60 px-2 py-1',
          'group-focus-within/comment-editor:flex',
        )}
        aria-label="评论格式工具栏"
      >
        <ToolButton
          title="加粗 (Cmd/Ctrl+B)"
          disabled={disabled}
          active={state.bold}
          onClick={() => editor.chain().focus().toggleBold().run()}
        >
          <BoldIcon />
        </ToolButton>
        <ToolButton
          title="斜体 (Cmd/Ctrl+I)"
          disabled={disabled}
          active={state.italic}
          onClick={() => editor.chain().focus().toggleItalic().run()}
        >
          <ItalicIcon />
        </ToolButton>
        <ToolButton
          title="下划线 (Cmd/Ctrl+U)"
          disabled={disabled}
          active={state.underline}
          onClick={() => editor.chain().focus().toggleUnderline().run()}
        >
          <UnderlineIcon />
        </ToolButton>
        <ToolButton
          title="删除线"
          disabled={disabled}
          active={state.strike}
          onClick={() => editor.chain().focus().toggleStrike().run()}
        >
          <StrikethroughIcon />
        </ToolButton>
        <ToolButton
          title="行内代码"
          disabled={disabled}
          active={state.code}
          onClick={() => editor.chain().focus().toggleCode().run()}
        >
          <CodeIcon />
        </ToolButton>
        <ToolDivider />
        <ToolButton
          title="无序列表"
          disabled={disabled}
          active={state.bulletList}
          onClick={() => editor.chain().focus().toggleBulletList().run()}
        >
          <ListIcon />
        </ToolButton>
        <ToolButton
          title="有序列表"
          disabled={disabled}
          active={state.orderedList}
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
        >
          <ListOrderedIcon />
        </ToolButton>
        <ToolButton
          title="引用"
          disabled={disabled}
          active={state.blockquote}
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
        >
          <QuoteIcon />
        </ToolButton>
        <ToolDivider />
        <ToolButton title="链接" disabled={disabled} active={state.link} onClick={promptLink}>
          <LinkIcon />
        </ToolButton>
      </div>
      <LinkPromptDialog
        seed={linkPromptSeed}
        onClose={() => setLinkPromptSeed(null)}
        onConfirm={(href) => {
          if (href === null) {
            editor.chain().focus().extendMarkRange('link').unsetLink().run()
          } else {
            editor.chain().focus().extendMarkRange('link').setLink({ href }).run()
          }
          setLinkPromptSeed(null)
        }}
      />
    </>
  )
}

interface LinkPromptDialogProps {
  /** Seed value when open; `null` keeps the dialog closed. */
  seed: string | null
  onClose: () => void
  /** Confirm callback. `null` means "remove the link"; a string is the new href. */
  onConfirm: (href: string | null) => void
}

// Small inline dialog that replaces the native `window.prompt` flow
// for the link bubble. Mounted next to the toolbar; the toolbar
// owns the seed value (read from the active selection) and the
// editor instance is closed over by `onConfirm`, so the dialog
// itself stays UI-only.
function LinkPromptDialog({ seed, onClose, onConfirm }: LinkPromptDialogProps) {
  const [value, setValue] = useState('')

  useEffect(() => {
    if (seed !== null) {
      setValue(seed)
    }
  }, [seed])

  const open = seed !== null

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>编辑链接</DialogTitle>
          <DialogDescription>填写链接地址，留空可移除当前链接。</DialogDescription>
        </DialogHeader>
        <form
          onSubmit={(e) => {
            e.preventDefault()
            const trimmed = value.trim()
            onConfirm(trimmed === '' ? null : trimmed)
          }}
          className="grid gap-4"
        >
          <div className="grid gap-2">
            <Label htmlFor="comment-link-href">链接地址</Label>
            <Input
              id="comment-link-href"
              type="url"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder="https://example.com"
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              取消
            </Button>
            <Button type="submit">确定</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

interface ToolButtonProps {
  title: string
  disabled: boolean
  active: boolean
  onClick: () => void
  children: React.ReactNode
}

function ToolButton({ title, disabled, active, onClick, children }: ToolButtonProps) {
  return (
    <button
      type="button"
      title={title}
      disabled={disabled}
      aria-pressed={active}
      // Prevent the button from stealing focus on mousedown so the
      // contenteditable selection stays intact while the formatting
      // command runs. Without this the caret would briefly jump out
      // of the editor and the toggled mark would land on whatever
      // came next instead of the active selection.
      onMouseDown={(event) => event.preventDefault()}
      onClick={onClick}
      className={cn(
        'inline-flex size-7 items-center justify-center rounded-sm',
        '[&_svg]:size-4',
        'text-ink-4 hover:bg-surface hover:text-ink-1',
        'disabled:cursor-not-allowed disabled:opacity-50',
        active && 'bg-surface text-brand',
      )}
    >
      {children}
    </button>
  )
}

function ToolDivider() {
  return <span aria-hidden="true" className="mx-1 h-4 w-px bg-line/60" />
}

function CommentEditorHint() {
  return (
    <div className="border-t border-line/60 px-3 py-1.5 text-xs text-ink-4">
      输入 <code>/</code> 块级命令，<code>$</code> 内联公式，<code>:</code> Emoji。
    </div>
  )
}

// Helper exposed so the consuming form can detect "no actual content" without
// poking into the editor instance directly.
export function isCommentBodyBlank(body: CommentBody): boolean {
  if (body.length === 0) {
    return true
  }
  for (const block of body) {
    if (block._type === 'code' && block.code.trim().length > 0) {
      return false
    }
    if (block._type === 'mathBlock' && block.tex.trim().length > 0) {
      return false
    }
    if (block._type === 'block') {
      for (const span of block.children) {
        if (span.text.trim().length > 0) {
          return false
        }
      }
    }
  }
  return true
}

// Re-export so callers that already import the editor can grab the empty
// body sentinel without a second import path.
export const EMPTY_COMMENT_BODY: CommentBody = EMPTY_BODY

// Avoid an unused-var lint error if a caller imports `Editor` from this module.
export type { Editor }
