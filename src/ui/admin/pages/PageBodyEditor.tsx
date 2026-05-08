import Link from '@tiptap/extension-link'
import Placeholder from '@tiptap/extension-placeholder'
import { EditorContent, useEditor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import {
  BoldIcon,
  Code2Icon,
  Heading1Icon,
  Heading2Icon,
  Heading3Icon,
  ItalicIcon,
  LinkIcon,
  ListIcon,
  ListOrderedIcon,
  MinusIcon,
  QuoteIcon,
  StrikethroughIcon,
} from 'lucide-react'
import { useEffect, useRef } from 'react'

import type { PortableTextBody } from '@/shared/portable-text'
import type { PmDoc } from '@/shared/pt-bridge'

import { bodyToPmDoc, pmDocToBody } from '@/shared/pt-bridge'
import { Button } from '@/ui/components/ui/button'
import { Separator } from '@/ui/components/ui/separator'
import { cn } from '@/ui/lib/cn'

export interface PageBodyEditorProps {
  /** Initial PortableText body. Only read on first mount + when `bodyKey` changes. */
  initialBody: PortableTextBody
  /**
   * Identity of the body source. When this string changes the editor
   * resets its content from `initialBody`. Use the page id +
   * `clientRevisionToken` so opening a different page (or accepting a
   * remote revision in the conflict resolver) flushes stale content.
   */
  bodyKey: string
  /** Fired on every editor update with the freshly-derived PortableText body. */
  onBodyChange: (body: PortableTextBody) => void
  /** When true, the editor becomes read-only. */
  disabled?: boolean
}

// Tiptap-based PortableText editor. The shell layer focuses on the
// **standard** subset (paragraphs / headings / blockquote / bullet +
// ordered lists / inline marks / fenced code / horizontal rule /
// link). The custom block types (musicPlayer, mathBlock, mermaid,
// solution, friends, footnoteDefinition) round-trip through the
// generic `blockCard` PM node defined by `pt-bridge` — they'll get
// dedicated Node specs and toolbar affordances in a follow-up commit.
//
// **Why no DOM events?** Both Tiptap's `useEditor` and our PT bridge
// are isomorphic-friendly. The component still has to render in the
// browser (Tiptap mounts a contenteditable region), but the
// import path stays clean enough that SSR can pre-render the
// surrounding chrome (header, toolbar) without complaining.
export function PageBodyEditor({ initialBody, bodyKey, onBodyChange, disabled }: PageBodyEditorProps) {
  // Latest callback ref so re-creating the closure inline doesn't
  // require recreating the editor instance — `useEditor`'s deps array
  // takes only the editor extensions.
  const onBodyChangeRef = useRef(onBodyChange)
  onBodyChangeRef.current = onBodyChange

  const editor = useEditor({
    immediatelyRender: false,
    editable: disabled !== true,
    extensions: [
      StarterKit.configure({
        // We disable the default link extension because we configure
        // it explicitly below to control `rel`/`target` on save.
        link: false,
      }),
      Link.configure({
        openOnClick: false,
        autolink: true,
        HTMLAttributes: { rel: 'noreferrer noopener', target: '_blank' },
      }),
      Placeholder.configure({
        placeholder: '在此处开始编写内容…',
      }),
    ],
    content: bodyToPmDoc(initialBody) as never,
    onUpdate({ editor: instance }) {
      onBodyChangeRef.current(pmDocToBody(instance.getJSON() as PmDoc))
    },
  })

  // Reset content whenever the upstream `bodyKey` changes. We compare
  // the prop, not the editor's current JSON, so accepting a remote
  // revision can force-reset even if the user's local edits happen to
  // match the new bodyKey on the surface.
  const lastResetKey = useRef<string | null>(null)
  useEffect(() => {
    if (editor === null) {
      return
    }
    if (lastResetKey.current === bodyKey) {
      return
    }
    lastResetKey.current = bodyKey
    editor.commands.setContent(bodyToPmDoc(initialBody) as never, { emitUpdate: false })
  }, [editor, bodyKey, initialBody])

  // Keep `editable` in sync with the disabled prop. Tiptap exposes this
  // imperatively rather than as a reactive option.
  useEffect(() => {
    if (editor === null) {
      return
    }
    editor.setEditable(disabled !== true)
  }, [editor, disabled])

  if (editor === null) {
    return <div className="rounded-md border bg-card p-4 text-sm text-muted-foreground">编辑器正在加载…</div>
  }

  return (
    <div className="flex min-h-0 flex-col rounded-md border bg-card">
      <Toolbar
        boldActive={editor.isActive('bold')}
        italicActive={editor.isActive('italic')}
        strikeActive={editor.isActive('strike')}
        codeActive={editor.isActive('code')}
        h1Active={editor.isActive('heading', { level: 1 })}
        h2Active={editor.isActive('heading', { level: 2 })}
        h3Active={editor.isActive('heading', { level: 3 })}
        bulletListActive={editor.isActive('bulletList')}
        orderedListActive={editor.isActive('orderedList')}
        blockquoteActive={editor.isActive('blockquote')}
        codeBlockActive={editor.isActive('codeBlock')}
        linkActive={editor.isActive('link')}
        disabled={disabled}
        onBold={() => editor.chain().focus().toggleBold().run()}
        onItalic={() => editor.chain().focus().toggleItalic().run()}
        onStrike={() => editor.chain().focus().toggleStrike().run()}
        onCode={() => editor.chain().focus().toggleCode().run()}
        onH1={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
        onH2={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
        onH3={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
        onBulletList={() => editor.chain().focus().toggleBulletList().run()}
        onOrderedList={() => editor.chain().focus().toggleOrderedList().run()}
        onBlockquote={() => editor.chain().focus().toggleBlockquote().run()}
        onCodeBlock={() => editor.chain().focus().toggleCodeBlock().run()}
        onHr={() => editor.chain().focus().setHorizontalRule().run()}
        onLink={() => {
          const previous = editor.getAttributes('link').href as string | undefined
          const url = window.prompt('链接 URL', previous ?? 'https://')
          if (url === null) {
            return
          }
          if (url === '') {
            editor.chain().focus().extendMarkRange('link').unsetLink().run()
            return
          }
          editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run()
        }}
      />
      <div className="grow overflow-auto px-6 py-6">
        <EditorContent
          editor={editor}
          className={cn(
            'prose max-w-none prose-zinc focus:outline-none',
            'min-h-[480px] [&_.ProseMirror]:min-h-[440px]',
            '[&_.ProseMirror]:focus:outline-none',
            '[&_.ProseMirror_p.is-editor-empty:first-child::before]:text-muted-foreground',
            '[&_.ProseMirror_p.is-editor-empty:first-child::before]:content-[attr(data-placeholder)]',
            '[&_.ProseMirror_p.is-editor-empty:first-child::before]:pointer-events-none',
            '[&_.ProseMirror_p.is-editor-empty:first-child::before]:float-left',
            '[&_.ProseMirror_p.is-editor-empty:first-child::before]:h-0',
          )}
        />
      </div>
    </div>
  )
}

interface ToolbarProps {
  boldActive: boolean
  italicActive: boolean
  strikeActive: boolean
  codeActive: boolean
  h1Active: boolean
  h2Active: boolean
  h3Active: boolean
  bulletListActive: boolean
  orderedListActive: boolean
  blockquoteActive: boolean
  codeBlockActive: boolean
  linkActive: boolean
  disabled?: boolean
  onBold: () => void
  onItalic: () => void
  onStrike: () => void
  onCode: () => void
  onH1: () => void
  onH2: () => void
  onH3: () => void
  onBulletList: () => void
  onOrderedList: () => void
  onBlockquote: () => void
  onCodeBlock: () => void
  onHr: () => void
  onLink: () => void
}

function Toolbar(props: ToolbarProps) {
  const { disabled } = props
  return (
    <div className="flex flex-wrap items-center gap-1 border-b p-2">
      <ToolbarButton title="加粗" active={props.boldActive} disabled={disabled} onClick={props.onBold}>
        <BoldIcon />
      </ToolbarButton>
      <ToolbarButton title="斜体" active={props.italicActive} disabled={disabled} onClick={props.onItalic}>
        <ItalicIcon />
      </ToolbarButton>
      <ToolbarButton title="删除线" active={props.strikeActive} disabled={disabled} onClick={props.onStrike}>
        <StrikethroughIcon />
      </ToolbarButton>
      <ToolbarButton title="行内代码" active={props.codeActive} disabled={disabled} onClick={props.onCode}>
        <Code2Icon />
      </ToolbarButton>
      <Separator orientation="vertical" className="mx-1 h-6" />
      <ToolbarButton title="一级标题" active={props.h1Active} disabled={disabled} onClick={props.onH1}>
        <Heading1Icon />
      </ToolbarButton>
      <ToolbarButton title="二级标题" active={props.h2Active} disabled={disabled} onClick={props.onH2}>
        <Heading2Icon />
      </ToolbarButton>
      <ToolbarButton title="三级标题" active={props.h3Active} disabled={disabled} onClick={props.onH3}>
        <Heading3Icon />
      </ToolbarButton>
      <Separator orientation="vertical" className="mx-1 h-6" />
      <ToolbarButton title="无序列表" active={props.bulletListActive} disabled={disabled} onClick={props.onBulletList}>
        <ListIcon />
      </ToolbarButton>
      <ToolbarButton
        title="有序列表"
        active={props.orderedListActive}
        disabled={disabled}
        onClick={props.onOrderedList}
      >
        <ListOrderedIcon />
      </ToolbarButton>
      <ToolbarButton title="引用" active={props.blockquoteActive} disabled={disabled} onClick={props.onBlockquote}>
        <QuoteIcon />
      </ToolbarButton>
      <ToolbarButton title="代码块" active={props.codeBlockActive} disabled={disabled} onClick={props.onCodeBlock}>
        <Code2Icon />
      </ToolbarButton>
      <ToolbarButton title="分隔线" disabled={disabled} onClick={props.onHr}>
        <MinusIcon />
      </ToolbarButton>
      <Separator orientation="vertical" className="mx-1 h-6" />
      <ToolbarButton title="链接" active={props.linkActive} disabled={disabled} onClick={props.onLink}>
        <LinkIcon />
      </ToolbarButton>
    </div>
  )
}

interface ToolbarButtonProps {
  title: string
  active?: boolean
  disabled?: boolean
  onClick: () => void
  children: React.ReactNode
}

function ToolbarButton({ title, active, disabled, onClick, children }: ToolbarButtonProps) {
  return (
    <Button
      type="button"
      variant={active === true ? 'secondary' : 'ghost'}
      size="sm"
      onClick={onClick}
      disabled={disabled}
      title={title}
      aria-label={title}
      aria-pressed={active === true}
    >
      {children}
    </Button>
  )
}
