import type { EditorView } from '@tiptap/pm/view'

import Focus from '@tiptap/extension-focus'
import Link from '@tiptap/extension-link'
import Placeholder from '@tiptap/extension-placeholder'
import { Table, TableCell, TableHeader, TableRow } from '@tiptap/extension-table'
import TextAlign from '@tiptap/extension-text-align'
import Typography from '@tiptap/extension-typography'
import { type Editor, EditorContent, useEditor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import {
  AlignCenterIcon,
  AlignLeftIcon,
  AlignRightIcon,
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
  SuperscriptIcon,
  TableIcon,
  Undo2Icon,
  UnderlineIcon,
} from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { useMediumZoom } from '@/client/hooks/use-medium-zoom'
import { bodyToPmDoc } from '@/shared/pt/bridge'
import { stripFootnoteDefinitionsForEditor } from '@/shared/pt/footnote-merge'
import { generateBlockKey, validatePortableTextBody, type PortableTextBody } from '@/shared/pt/schema'
import { FootnoteEditorDialog } from '@/ui/admin/editor/FootnoteEditorDialog'
import { ImageLibraryPicker } from '@/ui/admin/editor/pickers/ImageLibraryPicker'
import { MusicPickerDialog } from '@/ui/admin/editor/pickers/MusicPickerDialog'
import { BlockCardNode } from '@/ui/admin/editor/tiptap/BlockCardNode'
import { PageBubbleMenu } from '@/ui/admin/editor/tiptap/BubbleMenu'
import { CodeBlockBubbleMenu } from '@/ui/admin/editor/tiptap/CodeBlockBubbleMenu'
import { EditorActionsExtension } from '@/ui/admin/editor/tiptap/editor-actions'
import { FootnoteCaretTriggerExtension } from '@/ui/admin/editor/tiptap/footnote-caret-trigger'
import { ImageNode } from '@/ui/admin/editor/tiptap/ImageNode'
import { FootnoteRefMark, MathInlineMark } from '@/ui/admin/editor/tiptap/InlineMarks'
import { canInsertFootnoteMark } from '@/ui/admin/editor/tiptap/insert-inline-footnote'
import { LinkPopover } from '@/ui/admin/editor/tiptap/LinkPopover'
import { SlashCommandsExtension } from '@/ui/admin/editor/tiptap/SlashMenu'
import { SolutionNode } from '@/ui/admin/editor/tiptap/SolutionNode'
import { TableBubbleMenu } from '@/ui/admin/editor/tiptap/TableBubbleMenu'
import { TwoColumnNode, TwoColumnPaneNode } from '@/ui/admin/editor/tiptap/TwoColumnNode'
import { useEditorFootnotes } from '@/ui/admin/editor/tiptap/use-editor-footnotes'
import { Button } from '@/ui/components/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/ui/components/popover'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/ui/components/select'
import { Separator } from '@/ui/components/separator'
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
  /**
   * Live preview column layout: keep the formatting toolbar fixed above
   * the scrollable canvas. When false, the toolbar starts inline at the
   * top of the scroll stack and a floating duplicate appears at the
   * bottom center after it scrolls out of view.
   */
  livePreviewOpen?: boolean
  /**
   * Ref to the scrollable container so the parent shell can wire
   * bidirectional scroll sync with the live-preview pane.
   */
  scrollContainerRef?: React.RefObject<HTMLDivElement | null>
}

// Tiptap-based PortableText editor. The standard subset (paragraphs /
// headings / blockquote / lists / inline marks / fenced code /
// horizontal rule / link / table) is handled by Tiptap extensions;
// custom block types: `solution` uses a nested PM node; `musicPlayer`,
// `mathBlock`, and `mermaid` round-trip through `blockCard`.
// `footnoteDefinition` rows are **not** loaded into PM — they merge on
// save beside the prose slice so footnotes are authored via dialog + inline
// refs only; the public page still renders a unified footnotes list from PT.
//
// The user-facing surface area lives in three layers:
//   * **Toolbar** (this file): mouse-friendly row at the top of the
//     scroll stack in normal mode (duplicates at the bottom center
//     while scrolled); pinned above the canvas when live preview is on.
//   * **BubbleMenu** (`tiptap/BubbleMenu.tsx`): inline format affordances
//     above any selection, including a link popover and inline-mark
//     editing panels for `mathInline`. Footnote refs open the shell dialog
//     when clicked in the canvas (`handleClick`).
//   * **SlashMenu** (`tiptap/SlashMenu.tsx`): keyboard-driven `/`
//     command launcher covering every block type.
//   * Inline triggers: `` `…` `` → code, `$…$` → math (`InlineMarks`), `^ `
//     → footnote dialog (`footnote-caret-trigger`).
export function PageBodyEditor({
  initialBody,
  bodyKey,
  onBodyChange,
  disabled,
  livePreviewOpen = false,
  scrollContainerRef,
}: PageBodyEditorProps) {
  const onBodyChangeRef = useRef(onBodyChange)
  onBodyChangeRef.current = onBodyChange

  const editorZoomContainerRef = useRef<HTMLDivElement>(null)
  useMediumZoom(editorZoomContainerRef)

  // `handleClick` must read the live `Editor` from a ref: `editorProps`
  // is fixed at mount but `useEditor` returns `null` on the first render.
  const mathInlineClickEditorRef = useRef<Editor | null>(null)

  const openFootnoteEditDialogRef = useRef<(targetKey: string) => void>(() => {})

  const tiptapEditorProps = useMemo(
    () => ({
      handleClick(view: EditorView, pos: number, event: MouseEvent): boolean {
        if (!view.editable) {
          return false
        }
        if (!(event.target instanceof Element)) {
          return false
        }
        const ed = mathInlineClickEditorRef.current
        if (ed === null) {
          return false
        }

        if (event.target.closest('[data-math-inline]')) {
          const coords = view.posAtCoords({ left: event.clientX, top: event.clientY })
          const base = coords?.pos ?? pos
          const docSize = view.state.doc.content.size
          for (const anchor of [base, base - 1, base + 1]) {
            if (anchor < 0 || anchor > docSize) {
              continue
            }
            ed.chain().focus().setTextSelection({ from: anchor, to: anchor }).extendMarkRange('mathInline').run()
            const { from, to } = ed.state.selection
            if (ed.isActive('mathInline') && from < to) {
              return true
            }
          }
          return false
        }

        if (event.target.closest('[data-footnote-ref], sup.footnote-ref')) {
          const coords = view.posAtCoords({ left: event.clientX, top: event.clientY })
          const base = coords?.pos ?? pos
          const docSize = view.state.doc.content.size
          for (const anchor of [base, base - 1, base + 1]) {
            if (anchor < 0 || anchor > docSize) {
              continue
            }
            ed.chain().focus().setTextSelection({ from: anchor, to: anchor }).extendMarkRange('footnoteRef').run()
            const { from, to } = ed.state.selection
            if (ed.isActive('footnoteRef') && from < to) {
              const attrs = ed.getAttributes('footnoteRef') as { targetKey?: string }
              const tk = attrs.targetKey ?? ''
              if (tk !== '') {
                openFootnoteEditDialogRef.current(tk)
                return true
              }
            }
          }
          return false
        }

        return false
      },
    }),
    [],
  )

  const editor = useEditor({
    immediatelyRender: false,
    editable: disabled !== true,
    editorProps: tiptapEditorProps,
    extensions: [
      StarterKit.configure({
        link: false,
        dropcursor: { color: '#3b82f6', width: 2 },
      }),
      Typography,
      TextAlign.configure({ types: ['heading', 'paragraph', 'blockquote'] }),
      // TipTap Focus decorations must not use the bare token has-focus (Tailwind has variant collision risk).
      Focus.configure({ className: 'tiptap-focus-node', mode: 'all' }),
      Link.configure({
        openOnClick: false,
        autolink: true,
        // Upstream defaults force target _blank on every link; override so same-tab
        // is the default and operators opt into new-tab explicitly in LinkPopover.
        HTMLAttributes: { class: null, target: null, rel: null },
      }),
      Placeholder.configure({
        placeholder: '在此处开始编写内容…（/ 命令菜单，^ 空格插入脚注）',
      }),
      // Tables use the upstream Tiptap extensions; resizable=false
      // keeps the column-width UX out of scope for this iteration
      // (handled by future work per plan §六).
      //
      // `View: null` disables the default TableView node view. TableView
      // builds the DOM with createElement and never applies
      // `HTMLAttributes.class`, so our portable-text stylesheet hook
      // `table.pt-table` never matched in the editor canvas.
      Table.configure({
        resizable: false,
        View: null,
        HTMLAttributes: { class: 'pt-table' },
      }),
      TableRow,
      TableHeader,
      TableCell,
      // Custom Node + Mark specs that mirror the PT ↔ PM bridge so
      // every PortableText shape round-trips losslessly through the
      // editor.
      ImageNode,
      TwoColumnPaneNode,
      TwoColumnNode,
      SolutionNode,
      BlockCardNode,
      MathInlineMark,
      FootnoteRefMark,
      FootnoteCaretTriggerExtension,
      SlashCommandsExtension,
      EditorActionsExtension,
    ],
    content: bodyToPmDoc(stripFootnoteDefinitionsForEditor(validatePortableTextBody(initialBody))) as never,
    onUpdate({ editor: instance }) {
      const merged = footnotes.handleEditorUpdate(instance)
      onBodyChangeRef.current(merged)
    },
  })

  const footnotes = useEditorFootnotes(editor)
  openFootnoteEditDialogRef.current = footnotes.openEditDialog

  const confirmFootnoteDialog = useCallback(
    (plainText: string) => {
      const merged = footnotes.insertFootnote(plainText)
      if (merged !== null) {
        onBodyChangeRef.current(merged)
      }
    },
    [footnotes],
  )

  const deleteFootnoteFromDialog = useCallback(() => {
    const targetKey = footnotes.editTargetKey
    if (targetKey === null) return
    const merged = footnotes.removeFootnote(targetKey)
    if (merged !== null) {
      onBodyChangeRef.current(merged)
    }
  }, [footnotes])

  useEffect(() => {
    mathInlineClickEditorRef.current = editor
    return () => {
      if (mathInlineClickEditorRef.current === editor) {
        mathInlineClickEditorRef.current = null
      }
    }
  }, [editor])

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
    const mergedCanon = footnotes.resetFootnotes(initialBody)
    onBodyChangeRef.current(mergedCanon)
  }, [editor, bodyKey, initialBody, footnotes])

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
    if (editor === null) {
      return
    }
    const actions = editor.storage.editorActions
    if (actions === undefined) {
      return
    }
    actions.openImagePicker = () => setImagePickerOpen(true)
    actions.openMusicPicker = () => setMusicPickerOpen(true)
    actions.openFootnoteDialog = () => footnotes.openInsertDialog()
    return () => {
      actions.openImagePicker = undefined
      actions.openMusicPicker = undefined
      actions.openFootnoteDialog = undefined
    }
  }, [editor, footnotes])

  // Toolbar density. Two-state toggle: `'full'` shows block style and
  // inserts as buttons (toolbar wraps to more rows when narrow);
  // `'compact'` collapses inserts into 「插入 ▼」 and block style into a
  // Select. The preference survives navigations via localStorage.
  const [toolbarDensity, setToolbarDensity] = useToolbarDensityPreference()

  const inlineToolbarRef = useRef<HTMLDivElement>(null)
  const [showFloatingToolbar, setShowFloatingToolbar] = useState(false)

  useEffect(() => {
    if (editor === null || livePreviewOpen) {
      setShowFloatingToolbar(false)
      return
    }
    const target = inlineToolbarRef.current
    if (target === null) {
      return
    }
    // `AdminShell` lets the document scroll (the `<main>` column is not a
    // fixed-height scrollport), so our inner `overflow-y-auto` often never
    // scrolls — `IntersectionObserver` must use the viewport as `root`
    // or the inline toolbar would always read as "intersecting" and the
    // floated duplicate would never mount.
    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0]
        if (entry === undefined) {
          return
        }
        setShowFloatingToolbar(!entry.isIntersecting)
      },
      { root: null, rootMargin: '0px', threshold: 0 },
    )
    observer.observe(target)
    return () => observer.disconnect()
  }, [editor, livePreviewOpen, bodyKey])

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
    return (
      <div className="flex min-h-0 flex-1 items-center justify-center rounded-md border bg-card p-4 text-sm text-muted-foreground">
        编辑器正在加载…
      </div>
    )
  }

  const toolbarProps = {
    editor,
    disabled,
    density: toolbarDensity,
    onDensityChange: setToolbarDensity,
    onOpenImagePicker: () => setImagePickerOpen(true),
    onOpenMusicPicker: () => setMusicPickerOpen(true),
    onOpenFootnoteInsertDialog: footnotes.openInsertDialog,
  } as const

  const editorCanvas = (
    <div ref={editorZoomContainerRef}>
      <EditorContent
        editor={editor}
        className={cn(
          // `post-content` pairs with `@utility prose-blog { &.post-content {…} }`
          // so code/pre match public page + preview pane typography.
          // `pt-body-editor` narrows the math-inline chip tint to the Tiptap
          // canvas only (preview stays on the shared post-content styles).
          'post-content pt-body-editor prose-blog prose prose-lg max-w-none focus:outline-none',
          'min-h-120 [&_.ProseMirror]:min-h-110',
          '[&_.ProseMirror]:focus:outline-none',
          '[&_blockquote[data-pt-solution]]:relative [&_blockquote[data-pt-solution]]:my-4 [&_blockquote[data-pt-solution]]:border-l-4 [&_blockquote[data-pt-solution]]:border-brand/40 [&_blockquote[data-pt-solution]]:bg-muted/25 [&_blockquote[data-pt-solution]]:py-3 [&_blockquote[data-pt-solution]]:pl-4',
          '[&_[data-pt-two-column-pane]]:min-w-0 [&_[data-pt-two-column-pane]]:rounded-md [&_[data-pt-two-column-pane]]:border [&_[data-pt-two-column-pane]]:border-dashed [&_[data-pt-two-column-pane]]:border-muted-foreground/45 [&_[data-pt-two-column-pane]]:bg-background/85 [&_[data-pt-two-column-pane]]:p-3',
          '[&_section[data-pt-two-column]]:relative [&_section[data-pt-two-column]]:my-5 [&_section[data-pt-two-column]]:grid [&_section[data-pt-two-column]]:gap-4 [&_section[data-pt-two-column]]:rounded-lg [&_section[data-pt-two-column]]:border-2 [&_section[data-pt-two-column]]:border-dashed [&_section[data-pt-two-column]]:border-border [&_section[data-pt-two-column]]:bg-muted/30 [&_section[data-pt-two-column]]:p-3 [&_section[data-pt-two-column]]:shadow-sm [&_section[data-pt-two-column]]:md:grid-cols-2',
          '[&_.ProseMirror_p.is-editor-empty:first-child::before]:text-muted-foreground',
          '[&_.ProseMirror_p.is-editor-empty:first-child::before]:content-[attr(data-placeholder)]',
          '[&_.ProseMirror_p.is-editor-empty:first-child::before]:pointer-events-none',
          '[&_.ProseMirror_p.is-editor-empty:first-child::before]:float-left',
          '[&_.ProseMirror_p.is-editor-empty:first-child::before]:h-0',
        )}
      />
    </div>
  )

  return (
    <div className="relative flex min-h-0 w-full min-w-0 flex-1 flex-col rounded-md border bg-card">
      {livePreviewOpen ? (
        <>
          {/* Sticks to the top of the wp-admin `<main>` scrollport; canvas
              scrolls in the sibling below. */}
          <div className="sticky top-0 z-20 shrink-0 border-b bg-card">
            <Toolbar {...toolbarProps} />
          </div>
          {/* Bottom padding (`pb-[60vh]`) gives the operator a generous
              scroll runway past the end of the document. Without it the
              last paragraph hugs the container edge, which leaves the
              slash menu (anchored below the caret) clipped or overlapped
              by the surrounding chrome when authoring near the bottom. */}
          <div
            ref={scrollContainerRef}
            className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto px-6 pt-6 pb-[60vh]"
          >
            {editorCanvas}
          </div>
        </>
      ) : (
        <>
          <div ref={scrollContainerRef} className="flex min-h-0 flex-1 flex-col overflow-x-hidden overflow-y-auto">
            <div
              ref={inlineToolbarRef}
              className="shrink-0 border-b bg-card"
              inert={showFloatingToolbar ? true : undefined}
            >
              <Toolbar {...toolbarProps} />
            </div>
            <div className="min-h-0 grow px-6 pt-6 pb-[60vh]">{editorCanvas}</div>
          </div>
          {showFloatingToolbar ? (
            <div className="pointer-events-none fixed inset-x-0 bottom-6 z-40 flex justify-center px-3 sm:bottom-8">
              <div className="pointer-events-auto max-w-full overflow-x-auto rounded-xl border bg-card/95 p-1 shadow-lg ring-1 ring-border/60 backdrop-blur-sm supports-[backdrop-filter]:bg-card/90">
                <Toolbar {...toolbarProps} className="border-b-0" />
              </div>
            </div>
          ) : null}
        </>
      )}
      <ImageLibraryPicker open={imagePickerOpen} onOpenChange={setImagePickerOpen} onPick={insertImage} />
      <MusicPickerDialog open={musicPickerOpen} onOpenChange={setMusicPickerOpen} onPick={insertMusic} />
      <FootnoteEditorDialog
        open={footnotes.dialogOpen}
        onOpenChange={footnotes.setDialogOpen}
        mode={footnotes.dialogMode}
        initialPlainText={footnotes.dialogInitialText}
        onConfirm={confirmFootnoteDialog}
        onDelete={footnotes.dialogMode === 'edit' ? deleteFootnoteFromDialog : undefined}
      />
      <PageBubbleMenu editor={editor} />
      <TableBubbleMenu editor={editor} />
      <CodeBlockBubbleMenu editor={editor} />
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
  onOpenFootnoteInsertDialog: () => void
  /** Merged onto the outer toolbar row (e.g. floated duplicate drops `border-b`). */
  className?: string
}

// Toolbar layered into a stack of `ToolbarGroup`s (see groups below).
// Undo / redo only render in 'full' density. Tiptap's History
// extension wires Cmd/Ctrl+Z and Cmd/Ctrl+Shift+Z in every mode, so
// 'compact' falls back to the keyboard to save the two slots.
//
// Full density: the outer container is `flex flex-wrap` so groups
// flow to extra rows when space is tight (whole groups stay together).
// Compact density uses the same wrap rules with Select + 「插入」Popover.
//
// Each `ToolbarGroup` is `flex flex-nowrap` with a trailing separator.
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
  const { editor, disabled, density, className } = props

  const [linkToolbarOpen, setLinkToolbarOpen] = useState(false)

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
      <Popover
        open={linkToolbarOpen}
        onOpenChange={(open) => {
          if (open) {
            editor.chain().focus().run()
          }
          setLinkToolbarOpen(open)
        }}
      >
        <PopoverTrigger
          disabled={disabled}
          render={
            <Button
              type="button"
              variant={editor.isActive('link') ? 'secondary' : 'ghost'}
              size="sm"
              disabled={disabled}
              title="链接"
              aria-label="链接"
              aria-pressed={editor.isActive('link')}
              onMouseDownCapture={(event) => {
                // Match BubbleMenu / LinkPopover: keep ProseMirror selection
                // when the trigger is pressed so setLink still has a range.
                event.preventDefault()
              }}
            >
              <LinkIcon />
            </Button>
          }
        />
        <PopoverContent align="start" sideOffset={6} className="w-auto border-0 bg-transparent p-0 shadow-none">
          {linkToolbarOpen ? (
            <LinkPopover
              variant="toolbar"
              editor={editor}
              onClose={() => {
                setLinkToolbarOpen(false)
              }}
            />
          ) : null}
        </PopoverContent>
      </Popover>
      <ToolbarButton
        title="水平分隔线"
        disabled={disabled}
        onClick={() => editor.chain().focus().setHorizontalRule().run()}
      >
        <MinusIcon />
      </ToolbarButton>
    </>
  )

  const groups = (
    <>
      {density === 'full' ? <UndoRedoGroup editor={editor} disabled={disabled} /> : null}
      <BlockStyleGroup editor={editor} disabled={disabled} density={density} />
      <AlignGroup editor={editor} disabled={disabled} density={density} />
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
        <ToolbarButton
          title="脚注引用（^ 空格快捷插入；行内上标；表格与代码块内不可用）"
          disabled={disabled || !canInsertFootnoteMark(editor)}
          onClick={() => props.onOpenFootnoteInsertDialog()}
        >
          <SuperscriptIcon />
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
      <InsertsGroup density={density} disabled={disabled}>
        {insertButtons}
      </InsertsGroup>
    </>
  )

  const densityRail = <DensityToggleButton density={density} onChange={props.onDensityChange} disabled={disabled} />

  const isCompact = density === 'compact'

  return (
    <div
      className={cn(
        'flex w-full max-w-full min-w-0 items-center gap-x-0.5 border-b p-2',
        isCompact ? 'flex-nowrap overflow-x-auto' : 'flex-wrap gap-y-1',
        className,
      )}
    >
      {groups}
      <ToolbarGroup hideTrailingSeparator className="ml-auto shrink-0">
        {densityRail}
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

interface GroupProps {
  editor: Editor
  disabled?: boolean
}

interface DensityGroupProps extends GroupProps {
  density: ToolbarDensity
}

function UndoRedoGroup({ editor, disabled }: GroupProps) {
  return (
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
  )
}

function BlockStyleGroup({ editor, disabled, density }: DensityGroupProps) {
  return (
    <ToolbarGroup>
      {density === 'full' ? (
        <BlockStyleButtons editor={editor} disabled={disabled} />
      ) : (
        <BlockStyleSelect editor={editor} disabled={disabled} />
      )}
    </ToolbarGroup>
  )
}

function AlignGroup({ editor, disabled, density }: DensityGroupProps) {
  if (density === 'compact') {
    return (
      <ToolbarGroup>
        <AlignSelect editor={editor} disabled={disabled} />
      </ToolbarGroup>
    )
  }
  return (
    <ToolbarGroup>
      <ToolbarButton
        title="居左"
        disabled={disabled}
        active={editor.isActive({ textAlign: 'left' })}
        onClick={() => editor.chain().focus().setTextAlign('left').run()}
      >
        <AlignLeftIcon />
      </ToolbarButton>
      <ToolbarButton
        title="居中"
        disabled={disabled}
        active={editor.isActive({ textAlign: 'center' })}
        onClick={() => editor.chain().focus().setTextAlign('center').run()}
      >
        <AlignCenterIcon />
      </ToolbarButton>
      <ToolbarButton
        title="居右"
        disabled={disabled}
        active={editor.isActive({ textAlign: 'right' })}
        onClick={() => editor.chain().focus().setTextAlign('right').run()}
      >
        <AlignRightIcon />
      </ToolbarButton>
    </ToolbarGroup>
  )
}

interface InsertsGroupProps {
  density: ToolbarDensity
  disabled?: boolean
  children: React.ReactNode
}

function InsertsGroup({ density, disabled, children }: InsertsGroupProps) {
  if (density === 'full') {
    return <ToolbarGroup>{children}</ToolbarGroup>
  }
  return (
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
          <div className="flex flex-wrap items-center gap-0.5">{children}</div>
        </PopoverContent>
      </Popover>
    </ToolbarGroup>
  )
}

export type ToolbarDensity = 'compact' | 'full'

const TOOLBAR_DENSITY_STORAGE_KEY = 'yufan.me/admin/page-editor/toolbar-density'

// Persistent toolbar density preference. Defaults to `'full'` so a
// fresh visit shows every group inline; the outer `flex-wrap` container
// grows to more rows when space is tight. Compact mode uses Select +
// 「插入」Popover. Wrapped in `useState` + a `useEffect`
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
// "expand outward" chevron. Full mode wraps groups across rows;
// compact collapses inserts and block style into menus.
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

interface AlignSelectProps {
  editor: Editor
  disabled?: boolean
}

const ALIGN_OPTIONS = [
  { value: 'left', label: '居左', Icon: AlignLeftIcon },
  { value: 'center', label: '居中', Icon: AlignCenterIcon },
  { value: 'right', label: '居右', Icon: AlignRightIcon },
] as const

function getActiveAlign(editor: Editor): string {
  for (const opt of ALIGN_OPTIONS) {
    if (editor.isActive({ textAlign: opt.value })) {
      return opt.value
    }
  }
  return 'left'
}

function AlignSelect({ editor, disabled }: AlignSelectProps) {
  const active = getActiveAlign(editor)
  return (
    <Select
      value={active}
      onValueChange={(value: string | null) => {
        if (typeof value === 'string') {
          editor
            .chain()
            .focus()
            .setTextAlign(value as 'left' | 'center' | 'right')
            .run()
        }
      }}
      disabled={disabled}
    >
      <SelectTrigger size="sm" className="h-8 min-w-24" aria-label="对齐方式">
        <SelectValue placeholder="对齐">
          {(value) => {
            const match = ALIGN_OPTIONS.find((option) => option.value === value)
            if (match === undefined) {
              return '对齐'
            }
            return (
              <span className="flex items-center gap-1.5">
                <match.Icon className="h-4 w-4" />
                {match.label}
              </span>
            )
          }}
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        {ALIGN_OPTIONS.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            <span className="flex items-center gap-2">
              <option.Icon className="h-4 w-4" />
              {option.label}
            </span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
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
