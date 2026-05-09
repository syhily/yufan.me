import { describe, expect, it, vi } from 'vite-plus/test'

import { createDragHandleStore, type DragHandleHover } from '@/ui/admin/pages/tiptap/drag-handle-plugin'

// The drag-handle plugin is mostly DOM glue; the only piece with
// interesting state-machine behaviour is the subscription store.
// Spinning up a real ProseMirror editor in jsdom would be slow and
// fragile — instead we verify the store's contract directly.

describe('drag-handle store', () => {
  it('starts with no hover', () => {
    const store = createDragHandleStore()
    expect(store.current).toBe(null)
  })

  it('notifies subscribers on emit and updates `current`', () => {
    const store = createDragHandleStore()
    const listener = vi.fn()
    store.subscribe(listener)
    const hover: DragHandleHover = { from: 1, to: 5, rect: stubRect() }
    store.emit(hover)
    expect(listener).toHaveBeenCalledWith(hover)
    expect(store.current).toBe(hover)
  })

  it('stops notifying after unsubscribe', () => {
    const store = createDragHandleStore()
    const listener = vi.fn()
    const unsubscribe = store.subscribe(listener)
    unsubscribe()
    store.emit({ from: 0, to: 1, rect: stubRect() })
    expect(listener).not.toHaveBeenCalled()
  })

  it('fans out to multiple subscribers in deterministic order', () => {
    const store = createDragHandleStore()
    const order: number[] = []
    store.subscribe(() => order.push(1))
    store.subscribe(() => order.push(2))
    store.emit(null)
    expect(order).toEqual([1, 2])
  })

  it('emits null to clear the active hover', () => {
    const store = createDragHandleStore()
    store.emit({ from: 1, to: 2, rect: stubRect() })
    store.emit(null)
    expect(store.current).toBe(null)
  })
})

function stubRect(): DOMRect {
  return {
    x: 0,
    y: 0,
    width: 100,
    height: 20,
    top: 0,
    bottom: 20,
    left: 0,
    right: 100,
    toJSON: () => ({}),
  }
}
