import type { Editor } from '@tiptap/core'
import type { EditorView } from '@tiptap/pm/view'

import { Extension } from '@tiptap/core'
import { Plugin, PluginKey } from '@tiptap/pm/state'

// Drag-handle plugin: tracks which top-level block the mouse is
// currently hovering inside the editor's contentEditable region and
// publishes the result through a `useSyncExternalStore`-friendly
// listener API. The companion React `<DragHandle>` component
// subscribes to that store, renders a vertical-grip button at the
// block's left edge, and uses dnd-kit to move the block when the
// operator drags it.
//
// Why a plugin instead of just listening on the editor DOM root
// from React: the `mousemove → coordsAtPos → resolved-block` path
// needs the live PM state, and PM exposes that cleanly via plugin
// methods. Doing it from React would require either (a) re-deriving
// `state` from `editor.state` on every mousemove (slow) or (b)
// reading `view.posAtCoords` from outside any plugin (allowed but
// it would still need a ref to the EditorView).

export interface DragHandleHover {
  /** Inclusive start position of the hovered top-level block. */
  from: number
  /** Exclusive end position of the hovered top-level block. */
  to: number
  /** DOMRect of the block's wrapping element, in viewport coords. */
  rect: DOMRect
}

export type DragHandleListener = (hover: DragHandleHover | null) => void

export interface DragHandleStore {
  current: DragHandleHover | null
  subscribe(listener: DragHandleListener): () => void
  emit(hover: DragHandleHover | null): void
}

// Exported for unit tests. The plugin instantiates one of these per
// editor and never re-creates it, so subscribers can hold the
// reference for the editor's lifetime.
export function createDragHandleStore(): DragHandleStore {
  const listeners = new Set<DragHandleListener>()
  return {
    current: null,
    subscribe(listener) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    emit(hover) {
      this.current = hover
      for (const listener of listeners) {
        listener(hover)
      }
    },
  }
}

export const dragHandlePluginKey = new PluginKey<DragHandleStore>('yufanDragHandle')

export const DragHandlePlugin = Extension.create({
  name: 'yufanDragHandle',
  addProseMirrorPlugins() {
    const store = createDragHandleStore()
    return [
      new Plugin<DragHandleStore>({
        key: dragHandlePluginKey,
        state: {
          init: () => store,
          apply: () => store,
        },
        props: {
          handleDOMEvents: {
            mousemove(view, event) {
              const hover = computeHover(view, event)
              store.emit(hover)
              return false
            },
            mouseleave() {
              store.emit(null)
              return false
            },
          },
        },
      }),
    ]
  },
})

export function getDragHandleStore(editor: Editor): DragHandleStore | null {
  const plugin = dragHandlePluginKey.getState(editor.state)
  return plugin ?? null
}

function computeHover(view: EditorView, event: MouseEvent): DragHandleHover | null {
  if (!view.editable) {
    return null
  }
  const coords = view.posAtCoords({ left: event.clientX, top: event.clientY })
  if (coords === null) {
    return null
  }
  // Walk up `$pos`'s ancestor chain to the top-level block (depth=1
  // in the doc). Anything inside a list item / table cell still
  // resolves to its outermost block from the doc's perspective.
  const $pos = view.state.doc.resolve(coords.pos)
  if ($pos.depth === 0) {
    return null
  }
  const blockPos = $pos.before(1)
  const blockNode = view.state.doc.nodeAt(blockPos)
  if (blockNode === null) {
    return null
  }
  const dom = view.nodeDOM(blockPos)
  if (!(dom instanceof HTMLElement)) {
    return null
  }
  const rect = dom.getBoundingClientRect()
  return { from: blockPos, to: blockPos + blockNode.nodeSize, rect }
}
