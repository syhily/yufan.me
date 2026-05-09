import Focus from '@tiptap/extension-focus'
import Link from '@tiptap/extension-link'
import Placeholder from '@tiptap/extension-placeholder'
import { Table, TableCell, TableHeader, TableRow } from '@tiptap/extension-table'
import TextAlign from '@tiptap/extension-text-align'
import Typography from '@tiptap/extension-typography'
import { type Editor, EditorContent, useEditor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import {
  BoldIcon,
  Code2Icon,
  CodeIcon,
  Heading2Icon,
  Heading3Icon,
  Heading4Icon,
  Heading5Icon,
  ImageIcon,
  ItalicIcon,
  LinkIcon,
  ListIcon,
  ListOrderedIcon,
  MaximizeIcon,
  MinimizeIcon,
  MinusIcon,
  Music2Icon,
  PilcrowIcon,
  PlusIcon,
  QuoteIcon,
  Redo2Icon,
  StrikethroughIcon,
  TableIcon,
  Undo2Icon,
  UnderlineIcon,
} from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'

import type { PortableTextBody } from '@/shared/portable-text'
import type { PmDoc } from '@/shared/pt-bridge'

import { generateBlockKey } from '@/shared/portable-text'
import { bodyToPmDoc, pmDocToBody } from '@/shared/pt-bridge'
import { ImageLibraryPicker } from '@/ui/admin/pages/ImageLibraryPicker'
import { MusicPickerDialog } from '@/ui/admin/pages/MusicPickerDialog'
import { BlockCardNode } from '@/ui/admin/pages/tiptap/BlockCardNode'
import { PageBubbleMenu } from '@/ui/admin/pages/tiptap/BubbleMenu'
import { CodeBlockBubbleMenu } from '@/ui/admin/pages/tiptap/CodeBlockBubbleMenu'
import { EDITOR_EVENT_OPEN_IMAGE_PICKER, EDITOR_EVENT_OPEN_MUSIC_PICKER } from '@/ui/admin/pages/tiptap/editor-events'
import { ImageNode } from '@/ui/admin/pages/tiptap/ImageNode'
import { FootnoteRefMark, MathInlineMark } from '@/ui/admin/pages/tiptap/InlineMarks'
import { SlashCommandsExtension } from '@/ui/admin/pages/tiptap/SlashMenu'
import { SolutionNode } from '@/ui/admin/pages/tiptap/SolutionNode'
import { TableBubbleMenu } from '@/ui/admin/pages/tiptap/TableBubbleMenu'
import { Button } from '@/ui/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/ui/components/ui/popover'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/ui/components/ui/select'
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

// Tiptap-based PortableText editor. The standard subset (paragraphs /
// headings / blockquote / lists / inline marks / fenced code /
// horizontal rule / link / table) is handled by Tiptap extensions;
// custom block types: `solution` uses a nested `solution` PM node
// (blockquote-shaped `block+`); `musicPlayer`, `mathBlock`,
// `mermaid`, and `footnoteDefinition` round-trip through the generic
// `blockCard` PM node defined by `pt-bridge`.
//
// The user-facing surface area lives in three layers:
//   * **Toolbar** (this file): mouse-friendly slim row at the top
//     for image / music / link / table / hr + undo/redo.
//   * **BubbleMenu** (`tiptap/BubbleMenu.tsx`): inline format affordances
//     above any selection, including a link popover and inline-mark
//     editing panels for `mathInline` / `footnoteRef`.
//   * **SlashMenu** (`tiptap/SlashMenu.tsx`): keyboard-driven `/`
//     command launcher covering every block type.
//
// A custom drag handle (`tiptap/DragHandle.tsx`) is mounted around
// the editor canvas; the operator can toggle it from the toolbar
// when QA-ing the page (drag interactions can interfere with
// keyboard tests).
export function PageBodyEditor({ initialBody, bodyKey, onBodyChange, disabled }: PageBodyEditorProps) {
  const onBodyChangeRef = useRef(onBodyChange)
  onBodyChangeRef.current = onBodyChange

  const editor = useEditor({
    immediatelyRender: false,
    editable: disabled !== true,
    extensions: [
      StarterKit.configure({
        link: false,
        dropcursor: { color: '#3b82f6', width: 2 },
      }),
      Typography,
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      Focus.configure({ className: 'has-focus', mode: 'all' }),
      Link.configure({
        openOnClick: false,
        autolink: true,
        HTMLAttributes: { rel: 'noreferrer noopener', target: '_blank' },
      }),
      Placeholder.configure({
        placeholder: '在此处开始编写内容…（输入 / 唤出命令菜单）',
      }),
      // Tables use the upstream Tiptap extensions; resizable=false
      // keeps the column-width UX out of scope for this iteration
      // (handled by future work per plan §六).
      Table.configure({ resizable: false, HTMLAttributes: { class: 'pt-table' } }),
      TableRow,
      TableHeader,
      TableCell,
      // Custom Node + Mark specs that mirror the PT ↔ PM bridge so
      // every PortableText shape round-trips losslessly through the
      // editor.
      ImageNode,
      SolutionNode,
      BlockCardNode,
      MathInlineMark,
      FootnoteRefMark,
      SlashCommandsExtension,
    ],
    content: bodyToPmDoc(initialBody) as never,
    onUpdate({ editor: instance }) {
      onBodyChangeRef.current(pmDocToBody(instance.getJSON() as PmDoc))
    },
  })

  // Reset content whenever the upstream `bodyKey` changes.
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

  // Single controlled-open state per picker — the toolbar buttons
  // and the slash-command events both flip this. Driving the dialog
  // via state (rather than synthesising a click on the trigger
  // button) avoids a Base UI focus race where the dialog would
  // briefly open and then close because the click fired while the
  // suggestion plugin was tearing down its portal.
  const [imagePickerOpen, setImagePickerOpen] = useState(false)
  const [musicPickerOpen, setMusicPickerOpen] = useState(false)
  useEffect(() => {
    const openImage = () => setImagePickerOpen(true)
    const openMusic = () => setMusicPickerOpen(true)
    document.addEventListener(EDITOR_EVENT_OPEN_IMAGE_PICKER, openImage)
    document.addEventListener(EDITOR_EVENT_OPEN_MUSIC_PICKER, openMusic)
    return () => {
      document.removeEventListener(EDITOR_EVENT_OPEN_IMAGE_PICKER, openImage)
      document.removeEventListener(EDITOR_EVENT_OPEN_MUSIC_PICKER, openMusic)
    }
  }, [])

  // Toolbar density. Two-state toggle: `'full'` renders every group
  // inline (the toolbar still wraps to multiple rows on its own when
  // horizontal space is tight); `'compact'` collapses the inserts
  // group into a single 「插入 ▼」Popover and the block-style group
  // into a Select. The preference survives navigations via
  // localStorage.
  const [toolbarDensity, setToolbarDensity] = useToolbarDensityPreference()

  const insertImage = useCallback(
    (image: import('@/shared/images').AdminImageDto) => {
      if (editor === null) {
        return
      }
      editor
        .chain()
        .focus()
        .insertContent({
          type: 'image',
          attrs: {
            _key: generateBlockKey(),
            src: image.publicUrl,
            alt: image.note ?? '',
            width: image.width,
            height: image.height,
            thumbhash: image.thumbhash ?? undefined,
            storagePath: image.storagePath,
            imageId: image.id,
          },
        })
        .run()
    },
    [editor],
  )

  const insertMusic = useCallback(
    (music: import('@/shared/music').AdminMusicDto) => {
      if (editor === null) {
        return
      }
      editor
        .chain()
        .focus()
        .insertContent({
          type: 'blockCard',
          attrs: {
            _key: generateBlockKey(),
            _ptType: 'musicPlayer',
            payload: { _type: 'musicPlayer', _key: generateBlockKey(), playerId: music.playerId },
          },
        })
        .run()
    },
    [editor],
  )

  if (editor === null) {
    return <div className="rounded-md border bg-card p-4 text-sm text-muted-foreground">编辑器正在加载…</div>
  }

  return (
    <div className="flex min-h-0 flex-col rounded-md border bg-card">
      <Toolbar
        editor={editor}
        disabled={disabled}
        density={toolbarDensity}
        onDensityChange={setToolbarDensity}
        onOpenImagePicker={() => setImagePickerOpen(true)}
        onOpenMusicPicker={() => setMusicPickerOpen(true)}
      />
      <ImageLibraryPicker open={imagePickerOpen} onOpenChange={setImagePickerOpen} onPick={insertImage} />
      <MusicPickerDialog open={musicPickerOpen} onOpenChange={setMusicPickerOpen} onPick={insertMusic} />
      <PageBubbleMenu editor={editor} />
      <TableBubbleMenu editor={editor} />
      <CodeBlockBubbleMenu editor={editor} />
      {/* Bottom padding (`pb-[60vh]`) gives the operator a generous
          scroll runway past the end of the document. Without it the
          last paragraph hugs the container edge, which leaves the
          slash menu (anchored below the caret) clipped or overlapped
          by the surrounding chrome when authoring near the bottom. */}
      <div className="grow overflow-auto px-6 pt-6 pb-[60vh]">
        <EditorContent
          editor={editor}
          className={cn(
            'prose max-w-none prose-zinc focus:outline-none',
            'min-h-120 [&_.ProseMirror]:min-h-110',
            '[&_.ProseMirror]:focus:outline-none',
            '[&_blockquote[data-pt-solution]]:relative [&_blockquote[data-pt-solution]]:my-4 [&_blockquote[data-pt-solution]]:border-l-4 [&_blockquote[data-pt-solution]]:border-brand/40 [&_blockquote[data-pt-solution]]:bg-muted/25 [&_blockquote[data-pt-solution]]:py-3 [&_blockquote[data-pt-solution]]:pl-4',
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
  editor: Editor
  disabled?: boolean
  density: ToolbarDensity
  onDensityChange: (next: ToolbarDensity) => void
  onOpenImagePicker: () => void
  onOpenMusicPicker: () => void
}

// Toolbar layered into a stack of `ToolbarGroup`s so the operator
// can reach every common authoring action without leaving the canvas:
//   1. History — undo / redo (full mode only).
//   2. Block style — single Select covering paragraph / H1–H5 /
//      blockquote / code block.
//   3. Inline marks — bold / italic / underline / strike / inline code.
//   4. Lists — bullet / ordered.
//   5. Inserts — image / music / table / link / hr.
//   6. Editor toggles — drag handle, density.
// Undo / redo only render in 'full' density. Tiptap's History
// extension wires Cmd/Ctrl+Z and Cmd/Ctrl+Shift+Z in every mode, so
// 'compact' falls back to the keyboard to save the two slots —
// 'full' surfaces the buttons because they doubled as a live
// "history is reachable" affordance for mouse-first operators.
// Wrapping rules: the outer container is `flex flex-wrap` so the
// toolbar grows to a second / third row when a row can no longer
// fit. Each `ToolbarGroup` is itself `flex flex-nowrap` and carries
// its own trailing separator, so when wrapping happens it always
// breaks BETWEEN groups — a button is never split off from its
// sibling and a separator never floats to the start of a new row.
// `gap-y-1` keeps the row rhythm tight even with two or three rows
// of buttons.
//
// Density modes (two-state toggle — no automatic mode):
// - 'full': every group renders inline. The outer `flex flex-wrap`
//   container handles overflow naturally — toolbar grows to a 2nd or
//   3rd row when a row can no longer fit, breaking only between
//   groups.
// - 'compact': the Inserts group collapses into a single 「插入 ▼」
//   Popover whose body carries the SAME buttons; the Block-style
//   group falls back to a Select. Saves ~5 button-widths.
//
// The picker triggers (image / music) own their own picker dialogs,
// so we MUST mount the inserts buttons exactly once per render to
// avoid duplicate dialog state. That's why we branch on `density`
// first and pick a single branch, instead of rendering both
// branches and toggling visibility with CSS.
//
// The slash menu (`/`) and bubble menu still cover the same surface
// for keyboard-first authoring; the toolbar exists so the editor
// looks self-evidently capable on first open.

function Toolbar(props: ToolbarProps) {
  const { editor, disabled, density } = props

  const insertButtons = (
    <>
      <ToolbarButton title="插入图片" disabled={disabled} onClick={props.onOpenImagePicker}>
        <ImageIcon />
      </ToolbarButton>
      <ToolbarButton title="插入音乐" disabled={disabled} onClick={props.onOpenMusicPicker}>
        <Music2Icon />
      </ToolbarButton>
      <ToolbarButton
        title="插入表格 (3×3 含表头)"
        disabled={disabled}
        onClick={() => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()}
      >
        <TableIcon />
      </ToolbarButton>
      <ToolbarButton
        title="链接（在浮动菜单中编辑）"
        disabled={disabled}
        active={editor.isActive('link')}
        onClick={() => {
          // The BubbleMenu's link popover handles authoring + edit;
          // here we just nudge the selection so the BubbleMenu has
          // something to anchor to. If the cursor is inside an
          // existing link mark, extend the range so the popover
          // initialises with the current href.
          if (editor.isActive('link')) {
            editor.chain().focus().extendMarkRange('link').run()
          } else {
            editor.chain().focus().run()
          }
        }}
      >
        <LinkIcon />
      </ToolbarButton>
      <ToolbarButton
        title="水平分隔线"
        disabled={disabled}
        onClick={() => editor.chain().focus().setHorizontalRule().run()}
      >
        <MinusIcon />
      </ToolbarButton>
    </>
  )

  return (
    <div className="flex flex-wrap items-center gap-x-0.5 gap-y-1 border-b p-2">
      {density === 'full' ? (
        <ToolbarGroup>
          <ToolbarButton
            title="撤销 (Cmd/Ctrl+Z)"
            disabled={disabled || !editor.can().undo()}
            onClick={() => editor.chain().focus().undo().run()}
          >
            <Undo2Icon />
          </ToolbarButton>
          <ToolbarButton
            title="重做 (Cmd/Ctrl+Shift+Z)"
            disabled={disabled || !editor.can().redo()}
            onClick={() => editor.chain().focus().redo().run()}
          >
            <Redo2Icon />
          </ToolbarButton>
        </ToolbarGroup>
      ) : null}
      {/* Block style: in 'full' mode each option renders as its own
          toggle button so the operator hits paragraph / a heading
          level / blockquote / code block in a single click. The
          compact mode keeps the Select to save horizontal space. */}
      {density === 'full' ? (
        <ToolbarGroup>
          <BlockStyleButtons editor={editor} disabled={disabled} />
        </ToolbarGroup>
      ) : (
        <ToolbarGroup>
          <BlockStyleSelect editor={editor} disabled={disabled} />
        </ToolbarGroup>
      )}
      <ToolbarGroup>
        <ToolbarButton
          title="加粗 (Cmd/Ctrl+B)"
          disabled={disabled}
          active={editor.isActive('bold')}
          onClick={() => editor.chain().focus().toggleBold().run()}
        >
          <BoldIcon />
        </ToolbarButton>
        <ToolbarButton
          title="斜体 (Cmd/Ctrl+I)"
          disabled={disabled}
          active={editor.isActive('italic')}
          onClick={() => editor.chain().focus().toggleItalic().run()}
        >
          <ItalicIcon />
        </ToolbarButton>
        <ToolbarButton
          title="下划线 (Cmd/Ctrl+U)"
          disabled={disabled}
          active={editor.isActive('underline')}
          onClick={() => editor.chain().focus().toggleUnderline().run()}
        >
          <UnderlineIcon />
        </ToolbarButton>
        <ToolbarButton
          title="删除线"
          disabled={disabled}
          active={editor.isActive('strike')}
          onClick={() => editor.chain().focus().toggleStrike().run()}
        >
          <StrikethroughIcon />
        </ToolbarButton>
        <ToolbarButton
          title="行内代码"
          disabled={disabled}
          active={editor.isActive('code')}
          onClick={() => editor.chain().focus().toggleCode().run()}
        >
          <Code2Icon />
        </ToolbarButton>
      </ToolbarGroup>
      <ToolbarGroup>
        <ToolbarButton
          title="无序列表"
          disabled={disabled}
          active={editor.isActive('bulletList')}
          onClick={() => editor.chain().focus().toggleBulletList().run()}
        >
          <ListIcon />
        </ToolbarButton>
        <ToolbarButton
          title="有序列表"
          disabled={disabled}
          active={editor.isActive('orderedList')}
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
        >
          <ListOrderedIcon />
        </ToolbarButton>
      </ToolbarGroup>
      {/* Inserts: rendered as either an inline group (full mode) or
          a 「插入」Popover (compact mode). Single-mount so the
          picker triggers don't end up with two `<ImageLibraryPicker>`
          dialogs in the tree. */}
      {density === 'full' ? (
        <ToolbarGroup>{insertButtons}</ToolbarGroup>
      ) : (
        <ToolbarGroup>
          <Popover>
            <PopoverTrigger
              render={
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={disabled}
                  title="插入图片 / 音乐 / 表格 / 链接 / 分隔线"
                  aria-label="插入元素"
                >
                  <PlusIcon /> 插入
                </Button>
              }
            />
            <PopoverContent align="start" sideOffset={6} className="w-auto p-1">
              <div className="flex flex-wrap items-center gap-0.5">{insertButtons}</div>
            </PopoverContent>
          </Popover>
        </ToolbarGroup>
      )}
      <ToolbarGroup hideTrailingSeparator className="ml-auto">
        <DensityToggleButton density={density} onChange={props.onDensityChange} disabled={disabled} />
      </ToolbarGroup>
    </div>
  )
}

interface ToolbarGroupProps {
  children: React.ReactNode
  /**
   * Set on the last group in the toolbar so we don't print a
   * dangling separator at the right edge. Internal groups always
   * print their own trailing separator — that separator stays
   * inside the group's `flex-nowrap` box, so wrapping occurs
   * BETWEEN groups (between separator and next group), never
   * leaving a separator marooned at row start or row end.
   */
  hideTrailingSeparator?: boolean
  /**
   * Extra classes — used by the Toolbar to flip a group between
   * inline (`flex`) and hidden (`hidden`) variants for the
   * full / compact density swap. The default `flex` is overridden
   * if the caller provides `flex` or `hidden` of their own.
   */
  className?: string
}

function ToolbarGroup({ children, hideTrailingSeparator, className }: ToolbarGroupProps) {
  return (
    <div className={cn('flex flex-nowrap items-center gap-0.5', className)}>
      {children}
      {hideTrailingSeparator !== true ? (
        <Separator orientation="vertical" className="mx-1 h-6" aria-hidden="true" />
      ) : null}
    </div>
  )
}

export type ToolbarDensity = 'compact' | 'full'

const TOOLBAR_DENSITY_STORAGE_KEY = 'yufan.me/admin/page-editor/toolbar-density'

// Persistent toolbar density preference. Defaults to `'full'` so a
// fresh visit shows every group inline; the outer flex-wrap container
// handles overflow on its own. Wrapped in `useState` + a `useEffect`
// write because we need lazy SSR-safe initialisation; reading
// localStorage synchronously inside the initialiser would crash
// during hydration if the value type drifts — the guard inside
// `readDensity` covers that.
function useToolbarDensityPreference(): [ToolbarDensity, (next: ToolbarDensity) => void] {
  const [density, setDensityState] = useState<ToolbarDensity>('full')
  useEffect(() => {
    setDensityState(readDensity())
  }, [])
  const setDensity = useCallback((next: ToolbarDensity) => {
    setDensityState(next)
    if (typeof window === 'undefined') {
      return
    }
    try {
      window.localStorage.setItem(TOOLBAR_DENSITY_STORAGE_KEY, next)
    } catch {
      // localStorage may throw in private mode / quota-exceeded; the
      // preference is best-effort, so silently move on.
    }
  }, [])
  return [density, setDensity]
}

function readDensity(): ToolbarDensity {
  if (typeof window === 'undefined') {
    return 'full'
  }
  try {
    const raw = window.localStorage.getItem(TOOLBAR_DENSITY_STORAGE_KEY)
    if (raw === 'compact' || raw === 'full') {
      return raw
    }
  } catch {
    // ignore — return the safe default.
  }
  return 'full'
}

interface DensityToggleButtonProps {
  density: ToolbarDensity
  onChange: (next: ToolbarDensity) => void
  disabled?: boolean
}

// Two-state toggle: full ↔ compact. The icon mirrors the action that
// firing the button will perform — when expanded ('full') we show the
// "collapse inward" chevron; when collapsed ('compact') we show the
// "expand outward" chevron. The toolbar itself flex-wraps when space
// runs out, so density is purely an operator-driven affordance.
function DensityToggleButton({ density, onChange, disabled }: DensityToggleButtonProps) {
  const next: ToolbarDensity = density === 'full' ? 'compact' : 'full'
  const title = density === 'full' ? '收起工具栏' : '展开工具栏'
  const Icon = density === 'full' ? MinimizeIcon : MaximizeIcon
  return (
    <ToolbarButton title={title} disabled={disabled} onClick={() => onChange(next)}>
      <Icon />
    </ToolbarButton>
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

// Block style values map 1:1 to PortableText `style` values produced
// by pmDocToBody / consumed by bodyToPmDoc — keep in sync if a new
// style is ever added to `portableTextBodySchema`. h1 is owned by
// the page title (rendered in the public layout), so the editor
// surfaces h2–h5 only; h1 + h6 still round-trip through the bridge
// if external content provides them.
const BLOCK_STYLE_OPTIONS: { value: string; label: string }[] = [
  { value: 'normal', label: '正文段落' },
  { value: 'h2', label: '二级标题' },
  { value: 'h3', label: '三级标题' },
  { value: 'h4', label: '四级标题' },
  { value: 'h5', label: '五级标题' },
  { value: 'blockquote', label: '引用' },
  { value: 'codeBlock', label: '代码块' },
]

function getActiveBlockStyle(editor: Editor): string {
  if (editor.isActive('codeBlock')) {
    return 'codeBlock'
  }
  if (editor.isActive('blockquote')) {
    return 'blockquote'
  }
  for (const level of [2, 3, 4, 5] as const) {
    if (editor.isActive('heading', { level })) {
      return `h${level}`
    }
  }
  return 'normal'
}

function applyBlockStyle(editor: Editor, value: string): void {
  const chain = editor.chain().focus()
  switch (value) {
    case 'normal':
      chain.setParagraph().run()
      return
    case 'blockquote':
      // toggle vs set: setting blockquote when already inside it is a
      // no-op in tiptap, so prefer toggle so re-selecting "引用" lifts
      // the wrapper. Same goes for codeBlock below.
      if (!editor.isActive('blockquote')) {
        chain.toggleBlockquote().run()
      }
      return
    case 'codeBlock':
      if (!editor.isActive('codeBlock')) {
        chain.toggleCodeBlock().run()
      }
      return
    default: {
      const match = /^h([2-5])$/.exec(value)
      if (match) {
        const level = Number(match[1]) as 2 | 3 | 4 | 5
        chain.setHeading({ level }).run()
      }
    }
  }
}

interface BlockStyleSelectProps {
  editor: Editor
  disabled?: boolean
}

function BlockStyleSelect({ editor, disabled }: BlockStyleSelectProps) {
  const active = getActiveBlockStyle(editor)
  return (
    <Select
      value={active}
      onValueChange={(value: string | null) => {
        if (typeof value === 'string') {
          applyBlockStyle(editor, value)
        }
      }}
      disabled={disabled}
    >
      <SelectTrigger size="sm" className="h-8 min-w-30" aria-label="段落样式">
        {/* Base UI's Select.Value defaults to rendering the raw `value`
            string (e.g. "h2" / "codeBlock") when no child render
            function is supplied. We map back to the Chinese label so
            the trigger matches the dropdown options. */}
        <SelectValue placeholder="段落样式">
          {(value) => {
            const match = BLOCK_STYLE_OPTIONS.find((option) => option.value === value)
            return match?.label ?? '段落样式'
          }}
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        {BLOCK_STYLE_OPTIONS.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

interface BlockStyleButtonsProps {
  editor: Editor
  disabled?: boolean
}

// Inline button row mirror of `BlockStyleSelect`. The icons follow
// the same conventions used by the slash menu so the operator gets
// the same visual cue regardless of entry point.
const BLOCK_STYLE_BUTTONS: { value: string; title: string; Icon: typeof PilcrowIcon }[] = [
  { value: 'normal', title: '正文段落', Icon: PilcrowIcon },
  { value: 'h2', title: '二级标题', Icon: Heading2Icon },
  { value: 'h3', title: '三级标题', Icon: Heading3Icon },
  { value: 'h4', title: '四级标题', Icon: Heading4Icon },
  { value: 'h5', title: '五级标题', Icon: Heading5Icon },
  { value: 'blockquote', title: '引用', Icon: QuoteIcon },
  { value: 'codeBlock', title: '代码块', Icon: CodeIcon },
]

function BlockStyleButtons({ editor, disabled }: BlockStyleButtonsProps) {
  const active = getActiveBlockStyle(editor)
  return (
    <>
      {BLOCK_STYLE_BUTTONS.map(({ value, title, Icon }) => (
        <ToolbarButton
          key={value}
          title={title}
          disabled={disabled}
          active={active === value}
          onClick={() => applyBlockStyle(editor, value)}
        >
          <Icon />
        </ToolbarButton>
      ))}
    </>
  )
}
