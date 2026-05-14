import type { Editor, Range } from '@tiptap/core'

import { Extension } from '@tiptap/core'
import { gitHubEmojis, type EmojiItem } from '@tiptap/extension-emoji'
import { PluginKey } from '@tiptap/pm/state'
import { ReactRenderer } from '@tiptap/react'
import Suggestion, { type SuggestionProps, type SuggestionKeyDownProps } from '@tiptap/suggestion'
import { useEffect, useImperativeHandle, useRef, useState, type Ref } from 'react'
import { createPortal } from 'react-dom'

import { cn } from '@/ui/lib/cn'

// Selective emoji subset: exclude flags and ungrouped regional indicators
// so the picker only surfaces broadly-supported, commonly-used emojis.
const COMMENT_EMOJIS: readonly EmojiItem[] = gitHubEmojis.filter((item) => item.group && item.group !== 'flags')

// Emoji suggestion dropdown for the comment editor. Follows the same
// `@tiptap/suggestion` pattern as the slash menu (`SlashMenu.tsx`).
// Triggered by the English colon `:` only.
//
// Emojis are inserted as plain unicode text (not a custom node) so the
// comment PT schema needs no changes and round-tripping stays transparent.

interface EmojiSuggestionExtensionOptions {
  /** Maximum number of emoji suggestions shown at once. */
  limit?: number
}

interface EmojiMenuRendererRef {
  onKeyDown: (props: SuggestionKeyDownProps) => boolean
}

interface EmojiMenuListProps {
  items: readonly EmojiItem[]
  command: (item: EmojiItem) => void
  clientRect?: (() => DOMRect | null) | null
  query: string
  editor: Editor
  range: Range
  isOpen?: boolean
  ref?: Ref<EmojiMenuRendererRef>
}

const EMOJI_CHAR = ':' as const

function filterEmojis(query: string, limit = 24): readonly EmojiItem[] {
  const trimmed = query.trim().toLowerCase()
  if (trimmed === '') {
    return COMMENT_EMOJIS.slice(0, limit)
  }
  const results: EmojiItem[] = []
  for (const item of COMMENT_EMOJIS) {
    if (results.length >= limit) {
      break
    }
    const nameMatch = item.name.toLowerCase().includes(trimmed)
    const shortcodeMatch = item.shortcodes.some((s) => s.toLowerCase().includes(trimmed))
    const tagMatch = item.tags.some((t) => t.toLowerCase().includes(trimmed))
    if (nameMatch || shortcodeMatch || tagMatch) {
      results.push(item)
    }
  }
  return results
}

const EMOJI_PLUGIN_KEY = new PluginKey('emojiSuggestionColon')

function makeSuggestionPlugin(editor: Editor, char: typeof EMOJI_CHAR, limit: number) {
  return Suggestion<EmojiItem>({
    editor,
    char,
    pluginKey: EMOJI_PLUGIN_KEY,
    startOfLine: false,
    allowSpaces: false,
    items: ({ query }) => [...filterEmojis(query, limit)],
    command: ({ editor, range, props }) => {
      editor
        .chain()
        .focus()
        .deleteRange(range)
        .insertContent(props.emoji ?? `:${props.name}:`)
        .run()
    },
    render: () => {
      let component: ReactRenderer<EmojiMenuRendererRef, EmojiMenuListProps> | null = null

      return {
        onStart: (props) => {
          component = new ReactRenderer<EmojiMenuRendererRef, EmojiMenuListProps>(EmojiMenuList, {
            editor: props.editor,
            props: toListProps(props),
          })
        },
        onUpdate: (props) => {
          component?.updateProps(toListProps(props))
        },
        onKeyDown: (props) => {
          if (props.event.key === 'Escape') {
            component?.updateProps({ ...(component.props as EmojiMenuListProps), isOpen: false })
            return true
          }
          return component?.ref?.onKeyDown(props) ?? false
        },
        onExit: () => {
          component?.destroy()
          component = null
        },
      }
    },
  })
}

export const EmojiSuggestionExtension = Extension.create<EmojiSuggestionExtensionOptions>({
  name: 'emojiSuggestion',
  addOptions() {
    return { limit: 24 }
  },
  addProseMirrorPlugins() {
    const limit = this.options.limit ?? 24
    return [makeSuggestionPlugin(this.editor, EMOJI_CHAR, limit)]
  },
})

function toListProps(suggestion: SuggestionProps<EmojiItem>): EmojiMenuListProps {
  return {
    items: suggestion.items,
    command: (item) => suggestion.command(item),
    clientRect: suggestion.clientRect,
    query: suggestion.query,
    editor: suggestion.editor,
    range: suggestion.range,
    isOpen: true,
  }
}

function EmojiMenuList(props: EmojiMenuListProps) {
  const { items, command, clientRect, isOpen = true, ref } = props
  const [activeIndex, setActiveIndex] = useState(0)
  const itemsRef = useRef<readonly EmojiItem[]>(items)
  const activeIndexRef = useRef(activeIndex)
  itemsRef.current = items
  activeIndexRef.current = activeIndex

  useEffect(() => {
    if (activeIndex >= items.length && items.length > 0) {
      setActiveIndex(0)
    }
  }, [items, activeIndex])

  const rect = clientRect ? clientRect() : null

  useImperativeHandle(ref, () => ({
    onKeyDown: ({ event }) => {
      if (!isOpen) {
        return false
      }
      const list = itemsRef.current
      if (event.key === 'ArrowDown') {
        if (list.length === 0) {
          return true
        }
        setActiveIndex((current) => (current + 1) % list.length)
        return true
      }
      if (event.key === 'ArrowUp') {
        if (list.length === 0) {
          return true
        }
        setActiveIndex((current) => (current - 1 + list.length) % list.length)
        return true
      }
      if (event.key === 'Enter') {
        const item = list[activeIndexRef.current]
        if (item !== undefined) {
          command(item)
        }
        return true
      }
      return false
    },
  }))

  if (!isOpen || rect === null || typeof document === 'undefined') {
    return null
  }
  if (items.length === 0) {
    return createPortal(
      <div
        // Combobox-style suggestion popup, not a form select. The
        // <select> alternative the lint rule suggests has incompatible
        // keyboard model and can't be styled this way.
        // oxlint-disable-next-line jsx-a11y/prefer-tag-over-role
        role="listbox"
        className="fixed z-[1600] w-72 rounded-md border bg-popover p-2 text-sm text-muted-foreground shadow-md"
        style={positionStyle(rect)}
      >
        没有匹配的 Emoji
      </div>,
      document.body,
    )
  }
  return createPortal(
    <div
      // oxlint-disable-next-line jsx-a11y/prefer-tag-over-role
      role="listbox"
      aria-label="Emoji 选择菜单"
      className="fixed z-[1600] flex max-h-72 w-72 flex-col gap-0.5 overflow-y-auto rounded-md border bg-popover p-1 text-sm shadow-md"
      style={positionStyle(rect)}
    >
      {items.map((item, index) => {
        const active = index === activeIndex
        const shortcode = item.shortcodes[0] ?? `:${item.name}:`
        return (
          <button
            key={item.name}
            type="button"
            role="option"
            aria-selected={active}
            onMouseEnter={() => setActiveIndex(index)}
            onMouseDown={(event) => {
              event.preventDefault()
              command(item)
            }}
            className={cn(
              'flex w-full items-center gap-3 rounded-sm px-2 py-1.5 text-left transition-colors',
              active ? 'bg-accent text-accent-foreground' : 'text-foreground',
            )}
          >
            <span className="flex size-6 shrink-0 items-center justify-center text-base" aria-hidden>
              {item.emoji ?? `:${item.name}:`}
            </span>
            <span className="truncate font-mono text-xs text-muted-foreground">{shortcode}</span>
          </button>
        )
      })}
    </div>,
    document.body,
  )
}

function positionStyle(rect: DOMRect): React.CSSProperties {
  const margin = 8
  const menuWidth = 288
  const left = Math.max(margin, Math.min(rect.left, window.innerWidth - menuWidth - margin))
  const top = rect.bottom + 6
  return { top, left }
}
