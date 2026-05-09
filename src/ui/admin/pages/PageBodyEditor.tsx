import Focus from '@tiptap/extension-focus'
import Link from '@tiptap/extension-link'
import Placeholder from '@tiptap/extension-placeholder'
import { Table, TableCell, TableHeader, TableRow } from '@tiptap/extension-table'
import TextAlign from '@tiptap/extension-text-align'
import Typography from '@tiptap/extension-typography'
import Underline from '@tiptap/extension-underline'
import { type Editor, EditorContent, useEditor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import {
  BoldIcon,
  Code2Icon,
  GripVerticalIcon,
  ImageIcon,
  ItalicIcon,
  LinkIcon,
  ListIcon,
  ListOrderedIcon,
  MaximizeIcon,
  MinimizeIcon,
  MinusIcon,
  Music2Icon,
  PlusIcon,
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
import { DragHandlePlugin } from '@/ui/admin/pages/tiptap/drag-handle-plugin'
import { DragHandle } from '@/ui/admin/pages/tiptap/DragHandle'
import { EDITOR_EVENT_OPEN_IMAGE_PICKER, EDITOR_EVENT_OPEN_MUSIC_PICKER } from '@/ui/admin/pages/tiptap/editor-events'
import { ImageNode } from '@/ui/admin/pages/tiptap/ImageNode'
import { FootnoteRefMark, MathInlineMark } from '@/ui/admin/pages/tiptap/InlineMarks'
import { SlashCommandsExtension } from '@/ui/admin/pages/tiptap/SlashMenu'
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
// custom block types (musicPlayer, mathBlock, mermaid, solution,
// footnoteDefinition) round-trip through the generic `blockCard`
// PM node defined by `pt-bridge`.
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
        // Match emdash's drop indicator colour so the visual cue
        // for "drop here" is consistent across the projects'
        // editors.
        dropcursor: { color: '#3b82f6', width: 2 },
      }),
      Underline,
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
      BlockCardNode,
      MathInlineMark,
      FootnoteRefMark,
      // Slash menu + drag handle are extensions for clean PM-side
      // wiring (suggestion plugin / DOM event capture).
      SlashCommandsExtension,
      DragHandlePlugin,
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

  // Refs to dialog triggers — the slash menu fires global custom
  // events when the user picks "image" / "music" so we don't have
  // to teach the suggestion plugin about React state.
  const imagePickerOpenRef = useRef<() => void>(() => undefined)
  const musicPickerOpenRef = useRef<() => void>(() => undefined)
  useEffect(() => {
    const openImage = () => imagePickerOpenRef.current()
    const openMusic = () => musicPickerOpenRef.current()
    document.addEventListener(EDITOR_EVENT_OPEN_IMAGE_PICKER, openImage)
    document.addEventListener(EDITOR_EVENT_OPEN_MUSIC_PICKER, openMusic)
    return () => {
      document.removeEventListener(EDITOR_EVENT_OPEN_IMAGE_PICKER, openImage)
      document.removeEventListener(EDITOR_EVENT_OPEN_MUSIC_PICKER, openMusic)
    }
  }, [])

  // Drag-handle toggle. The UI defaults to enabled but can be
  // turned off so QA can verify keyboard interactions in isolation.
  const [dragHandleEnabled, setDragHandleEnabled] = useState(true)

  // Toolbar density. `'auto'` lets a CSS @container query at the
  // editor frame decide compact vs full based on the editor pane's
  // own width — which is the right axis (preview / metadata sheet
  // toggles narrow the editor, viewport doesn't). The two explicit
  // overrides (`'compact'` / `'full'`) give the operator a manual
  // pin that survives navigations via localStorage. The auto path
  // is the default because most users never want to think about
  // this knob.
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
        dragHandleEnabled={dragHandleEnabled}
        onToggleDragHandle={() => setDragHandleEnabled((on) => !on)}
        density={toolbarDensity}
        onDensityChange={setToolbarDensity}
        onPickImage={insertImage}
        onPickMusic={insertMusic}
        registerImageOpener={(open) => {
          imagePickerOpenRef.current = open
        }}
        registerMusicOpener={(open) => {
          musicPickerOpenRef.current = open
        }}
      />
      <PageBubbleMenu editor={editor} />
      <TableBubbleMenu editor={editor} />
      <DragHandle editor={editor} enabled={dragHandleEnabled && disabled !== true}>
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
      </DragHandle>
    </div>
  )
}

interface ToolbarProps {
  editor: Editor
  disabled?: boolean
  dragHandleEnabled: boolean
  onToggleDragHandle: () => void
  density: ToolbarDensity
  onDensityChange: (next: ToolbarDensity) => void
  onPickImage: (image: import('@/shared/images').AdminImageDto) => void
  onPickMusic: (music: import('@/shared/music').AdminMusicDto) => void
  registerImageOpener: (open: () => void) => void
  registerMusicOpener: (open: () => void) => void
}

// Toolbar layered into a stack of `ToolbarGroup`s so the operator
// can reach every common authoring action without leaving the canvas:
//   1. History — undo / redo.
//   2. Block style — single Select covering paragraph / H1–H5 /
//      blockquote / code block.
//   3. Inline marks — bold / italic / underline / strike / inline code.
//   4. Lists — bullet / ordered.
//   5. Inserts — image / music / table / link / hr.
//   6. Editor toggles — drag handle, density.
// Wrapping rules: the outer container is `flex flex-wrap` so the
// toolbar grows to a second / third row when a row can no longer
// fit. Each `ToolbarGroup` is itself `flex flex-nowrap` and carries
// its own trailing separator, so when wrapping happens it always
// breaks BETWEEN groups — a button is never split off from its
// sibling and a separator never floats to the start of a new row.
// `gap-y-1` keeps the row rhythm tight even with two or three rows
// of buttons.
//
// Density modes:
// - 'full' (manual): every group renders inline.
// - 'compact' (manual): the Inserts group collapses into a single
//   「插入 ▼」Popover whose body carries the SAME buttons. Saves
//   ~5 button-widths and dodges a wrap row when the editor pane is
//   squeezed by preview / metadata sheet toggles.
// - 'auto' (the default): a `ResizeObserver` watches the toolbar
//   wrapper and switches to compact below `TOOLBAR_COMPACT_THRESHOLD`,
//   reverts to full above. The observer is debounced via the browser's
//   batching, so the only React re-render happens on the threshold
//   crossing — not on every pixel of resize.
//
// The picker triggers (image / music) own their own picker dialogs,
// so we MUST mount the inserts buttons exactly once per render to
// avoid duplicate dialog state. That's why we resolve the
// `effectiveDensity` first and pick a single branch, instead of
// rendering both branches and toggling visibility with CSS.
//
// The slash menu (`/`) and bubble menu still cover the same surface
// for keyboard-first authoring; the toolbar exists so the editor
// looks self-evidently capable on first open.
const TOOLBAR_COMPACT_THRESHOLD = 720

function Toolbar(props: ToolbarProps) {
  const { editor, disabled, density } = props
  const wrapperRef = useRef<HTMLDivElement | null>(null)
  const [autoCompact, setAutoCompact] = useState(false)
  useEffect(() => {
    if (density !== 'auto' || wrapperRef.current === null || typeof ResizeObserver === 'undefined') {
      return
    }
    const el = wrapperRef.current
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0]
      if (entry === undefined) {
        return
      }
      // Use `contentBoxSize` when available (consistent across
      // browsers), fall back to `contentRect.width` for Safari.
      const width = entry.contentBoxSize?.[0]?.inlineSize ?? entry.contentRect.width
      setAutoCompact(width < TOOLBAR_COMPACT_THRESHOLD)
    })
    observer.observe(el)
    return () => observer.disconnect()
  }, [density])

  const effectiveDensity: 'compact' | 'full' =
    density === 'compact' ? 'compact' : density === 'full' ? 'full' : autoCompact ? 'compact' : 'full'

  const insertButtons = (
    <>
      <ImageLibraryTrigger disabled={disabled} onPick={props.onPickImage} registerOpener={props.registerImageOpener} />
      <MusicPickerTrigger disabled={disabled} onPick={props.onPickMusic} registerOpener={props.registerMusicOpener} />
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
    <div ref={wrapperRef} className="flex flex-wrap items-center gap-x-0.5 gap-y-1 border-b p-2">
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
      <ToolbarGroup>
        <BlockStyleSelect editor={editor} disabled={disabled} />
      </ToolbarGroup>
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
      {effectiveDensity === 'full' ? (
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
      <ToolbarGroup hideTrailingSeparator>
        <ToolbarButton
          title={props.dragHandleEnabled ? '关闭拖拽手柄' : '开启拖拽手柄'}
          active={props.dragHandleEnabled}
          disabled={disabled}
          onClick={props.onToggleDragHandle}
        >
          <GripVerticalIcon />
        </ToolbarButton>
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

export type ToolbarDensity = 'auto' | 'compact' | 'full'

const TOOLBAR_DENSITY_STORAGE_KEY = 'yufan.me/admin/page-editor/toolbar-density'

// Persistent toolbar density preference. Defaults to `'auto'` so a
// fresh visit lets the @container query make the call. Wrapped in
// `useState` + a `useEffect` write because we need lazy SSR-safe
// initialisation; reading localStorage synchronously inside the
// initialiser would crash during hydration if the value type drifts
// — the guard inside `readDensity` covers that.
function useToolbarDensityPreference(): [ToolbarDensity, (next: ToolbarDensity) => void] {
  const [density, setDensityState] = useState<ToolbarDensity>('auto')
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
    return 'auto'
  }
  try {
    const raw = window.localStorage.getItem(TOOLBAR_DENSITY_STORAGE_KEY)
    if (raw === 'compact' || raw === 'full' || raw === 'auto') {
      return raw
    }
  } catch {
    // ignore — return the safe default.
  }
  return 'auto'
}

interface DensityToggleButtonProps {
  density: ToolbarDensity
  onChange: (next: ToolbarDensity) => void
  disabled?: boolean
}

// Three-state cycle: auto → full → compact → auto …
// `auto` is the recommended state so we surface it as the default
// label. The icon flips to MaximizeIcon when the user has pinned
// to full and MinimizeIcon when pinned to compact.
function DensityToggleButton({ density, onChange, disabled }: DensityToggleButtonProps) {
  const next: ToolbarDensity = density === 'auto' ? 'full' : density === 'full' ? 'compact' : 'auto'
  const title =
    density === 'auto'
      ? '工具栏密度：自动 (点击切到 完整)'
      : density === 'full'
        ? '工具栏密度：完整 (点击切到 精简)'
        : '工具栏密度：精简 (点击切到 自动)'
  const Icon = density === 'compact' ? MinimizeIcon : MaximizeIcon
  return (
    <ToolbarButton title={title} active={density !== 'auto'} disabled={disabled} onClick={() => onChange(next)}>
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
// style is ever added to `portableTextBodySchema`. We deliberately
// stop at h5: emdash and the public renderer agree h6 is rare enough
// that hiding it from the toolbar is the right default. h6 still
// round-trips through the bridge if external content provides it.
const BLOCK_STYLE_OPTIONS: { value: string; label: string }[] = [
  { value: 'normal', label: '正文段落' },
  { value: 'h1', label: '一级标题' },
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
  for (const level of [1, 2, 3, 4, 5] as const) {
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
      const match = /^h([1-5])$/.exec(value)
      if (match) {
        const level = Number(match[1]) as 1 | 2 | 3 | 4 | 5
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
        <SelectValue placeholder="段落样式" />
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

interface ImageLibraryTriggerProps {
  disabled?: boolean
  onPick: (image: import('@/shared/images').AdminImageDto) => void
  registerOpener: (open: () => void) => void
}

function ImageLibraryTrigger({ disabled, onPick, registerOpener }: ImageLibraryTriggerProps) {
  const buttonRef = useRef<HTMLButtonElement | null>(null)
  useEffect(() => {
    registerOpener(() => buttonRef.current?.click())
  }, [registerOpener])
  return (
    <ImageLibraryPicker
      trigger={
        <Button
          ref={buttonRef}
          variant="ghost"
          size="sm"
          disabled={disabled}
          title="插入图片"
          aria-label="插入图片"
          type="button"
        >
          <ImageIcon />
        </Button>
      }
      onPick={onPick}
    />
  )
}

interface MusicPickerTriggerProps {
  disabled?: boolean
  onPick: (music: import('@/shared/music').AdminMusicDto) => void
  registerOpener: (open: () => void) => void
}

function MusicPickerTrigger({ disabled, onPick, registerOpener }: MusicPickerTriggerProps) {
  const buttonRef = useRef<HTMLButtonElement | null>(null)
  useEffect(() => {
    registerOpener(() => buttonRef.current?.click())
  }, [registerOpener])
  return (
    <MusicPickerDialog
      trigger={
        <Button
          ref={buttonRef}
          variant="ghost"
          size="sm"
          disabled={disabled}
          title="插入音乐"
          aria-label="插入音乐"
          type="button"
        >
          <Music2Icon />
        </Button>
      }
      onPick={onPick}
    />
  )
}
