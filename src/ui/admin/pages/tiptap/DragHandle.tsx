import type { Editor } from '@tiptap/core'

import {
  DndContext,
  PointerSensor,
  pointerWithin,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core'
import { Slice } from '@tiptap/pm/model'
import { GripVerticalIcon } from 'lucide-react'
import { useCallback, useMemo, useRef, useSyncExternalStore, type ReactNode } from 'react'

import { dragHandlePluginKey, type DragHandleHover } from '@/ui/admin/pages/tiptap/drag-handle-plugin'
import { cn } from '@/ui/lib/cn'

// Top-level block drag-and-drop. Two pieces:
//
// 1. `<DragSurface>`: wraps the editor canvas in a `<DndContext>` so
//    dnd-kit can route the drag from the handle (the source) to a
//    drop zone inside the editor. The drop zone is the editor's own
//    DOM container — when the drag ends we project the cursor's Y
//    position back to a PM doc position via `view.posAtCoords` and
//    move the source slice there with a single transaction.
//
// 2. `<DragHandleButton>`: a `position: absolute` button positioned
//    at the left edge of the currently-hovered block. The button is
//    the actual `useDraggable` source; clicking it doesn't move
//    text, only initiates the drag.
//
// Limit (matches plan B6): MVP only supports moving top-level
// blocks. Items inside a list / table cell can be selected for
// keyboard reorder via Tiptap's built-in `Tab` / `Shift+Tab`, but
// the cross-tree drag affordance is intentionally absent because
// dropping a list item between two paragraphs would corrupt the
// surrounding `<ul>`.

interface DragHandleProps {
  editor: Editor
  enabled: boolean
  children: ReactNode
}

export function DragHandle({ editor, enabled, children }: DragHandleProps) {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }))
  const dragRangeRef = useRef<{ from: number; to: number } | null>(null)

  const onDragStart = useCallback((event: DragStartEvent) => {
    const data = event.active.data.current as { from?: number; to?: number } | undefined
    if (data && typeof data.from === 'number' && typeof data.to === 'number') {
      dragRangeRef.current = { from: data.from, to: data.to }
    }
  }, [])

  const onDragEnd = useCallback(
    (event: DragEndEvent) => {
      const range = dragRangeRef.current
      dragRangeRef.current = null
      if (range === null) {
        return
      }
      // dnd-kit's pointer event delta is relative to drag start — we
      // recover the absolute pointer position from `activatorEvent +
      // delta` and then ask PM where that lands inside the doc.
      const activator = event.activatorEvent as PointerEvent | undefined
      if (activator === undefined) {
        return
      }
      const absX = activator.clientX + event.delta.x
      const absY = activator.clientY + event.delta.y
      const view = editor.view
      const target = view.posAtCoords({ left: absX, top: absY })
      if (target === null) {
        return
      }
      const targetPos = resolveTopLevelInsertPos(editor, target.pos)
      if (targetPos === null) {
        return
      }
      // Refuse a no-op drop (target === source). PM would reject
      // this anyway with a mapping error.
      if (targetPos >= range.from && targetPos <= range.to) {
        return
      }
      const { state } = editor
      const slice = state.doc.slice(range.from, range.to, false) as Slice
      const tr = state.tr.delete(range.from, range.to)
      const mappedTarget = tr.mapping.map(targetPos)
      tr.insert(mappedTarget, slice.content)
      editor.view.dispatch(tr)
    },
    [editor],
  )

  if (!enabled) {
    return <>{children}</>
  }

  return (
    <DndContext sensors={sensors} collisionDetection={pointerWithin} onDragStart={onDragStart} onDragEnd={onDragEnd}>
      <DropZone>
        {children}
        <DragHandleButton editor={editor} />
      </DropZone>
    </DndContext>
  )
}

function DropZone({ children }: { children: ReactNode }) {
  const { setNodeRef } = useDroppable({ id: 'editor-drop-zone' })
  return (
    <div ref={setNodeRef} className="relative">
      {children}
    </div>
  )
}

function DragHandleButton({ editor }: { editor: Editor }) {
  const hover = useHover(editor)
  const id = useMemo(() => `block-drag-${hover?.from ?? 'idle'}`, [hover])
  const draggable = useDraggable({
    id,
    data: hover ? { from: hover.from, to: hover.to } : undefined,
  })

  if (hover === null) {
    return null
  }

  // Position the button at the left edge of the editor canvas, at
  // the same vertical offset as the hovered block. We compute the
  // editor canvas's left edge from the editor DOM root so the
  // button stays anchored even when the page scrolls.
  const editorRect = editor.view.dom.getBoundingClientRect()
  const top = hover.rect.top - editorRect.top
  return (
    <button
      ref={draggable.setNodeRef}
      type="button"
      title="拖拽以重新排序"
      aria-label="拖拽块"
      className={cn(
        'absolute -left-7 z-20 flex h-6 w-6 cursor-grab items-center justify-center rounded text-muted-foreground opacity-0 hover:bg-accent hover:opacity-100 active:cursor-grabbing',
        // Show as soon as the hover state exists so the operator
        // sees the affordance the moment they hover any block.
        'opacity-100',
      )}
      style={{
        top,
        transform: draggable.transform
          ? `translate3d(${draggable.transform.x}px, ${draggable.transform.y}px, 0)`
          : undefined,
      }}
      {...draggable.listeners}
      {...draggable.attributes}
    >
      <GripVerticalIcon className="size-3.5" />
    </button>
  )
}

function useHover(editor: Editor): DragHandleHover | null {
  return useSyncExternalStore(
    (listener) => {
      const store = dragHandlePluginKey.getState(editor.state)
      if (!store) {
        return () => undefined
      }
      return store.subscribe(listener)
    },
    () => dragHandlePluginKey.getState(editor.state)?.current ?? null,
    () => null,
  )
}

// Resolve the drop coordinate to a top-level insertion position
// inside the doc. We snap to the nearest gap *between* top-level
// nodes — i.e., the resolved position rounded to the nearest
// block boundary — so the operator can drop "between" blocks
// without having to land precisely on a sub-pixel.
function resolveTopLevelInsertPos(editor: Editor, pos: number): number | null {
  const $pos = editor.state.doc.resolve(pos)
  if ($pos.depth === 0) {
    return pos
  }
  // `before(1)` = start of the top-level block under the pointer.
  // `after(1)`  = position immediately after that block.
  // We pick whichever is closer to the original `pos`.
  const before = $pos.before(1)
  const after = $pos.after(1)
  return Math.abs(pos - before) < Math.abs(pos - after) ? before : after
}
