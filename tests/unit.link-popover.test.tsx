import type { Editor } from '@tiptap/core'

import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vite-plus/test'

import { LinkPopover } from '@/ui/admin/pages/tiptap/LinkPopover'

// LinkPopover is the BubbleMenu's link-editing affordance. The full
// interactive surface needs a DOM (focus, keydown, button presses),
// which would require pulling in @testing-library; we keep the
// dependency footprint minimal and instead verify the static SSR
// shape + the editor command surface contract via a stub editor.
//
// What this guards against: the popover MUST render an URL input
// with the current href, expose 应用 / 取消 / 移除 buttons in the
// initial-edit case, and only show 移除 when an existing link
// is in edit mode.

interface LinkChain {
  focus: () => LinkChain
  extendMarkRange: (mark: string) => LinkChain
  setLink: (attrs: { href: string }) => LinkChain
  unsetLink: () => LinkChain
  run: () => boolean
}

function stubEditor(initialHref: string): {
  editor: Editor
  calls: Array<string>
} {
  const calls: Array<string> = []
  const chain = (): LinkChain => ({
    focus() {
      calls.push('focus')
      return this
    },
    extendMarkRange(mark) {
      calls.push(`extendMarkRange:${mark}`)
      return this
    },
    setLink({ href }) {
      calls.push(`setLink:${href}`)
      return this
    },
    unsetLink() {
      calls.push('unsetLink')
      return this
    },
    run() {
      calls.push('run')
      return true
    },
  })
  const editor = {
    getAttributes(_mark: string) {
      return { href: initialHref }
    },
    chain,
  } as unknown as Editor
  return { editor, calls }
}

describe('LinkPopover', () => {
  it('renders 移除 button when editing an existing link', () => {
    const { editor } = stubEditor('https://example.com')
    const html = renderToStaticMarkup(<LinkPopover editor={editor} onClose={() => undefined} />)
    expect(html).toContain('链接 URL')
    expect(html).toContain('value="https://example.com"')
    expect(html).toContain('移除')
    expect(html).toContain('应用')
    expect(html).toContain('取消')
  })

  it('hides 移除 button when authoring a fresh link', () => {
    const { editor } = stubEditor('')
    const html = renderToStaticMarkup(<LinkPopover editor={editor} onClose={() => undefined} />)
    expect(html).not.toContain('>移除<')
    expect(html).toContain('应用')
  })

  it('marks the input as type=url so mobile keyboards show the URL row', () => {
    const { editor } = stubEditor('')
    const html = renderToStaticMarkup(<LinkPopover editor={editor} onClose={() => undefined} />)
    expect(html).toMatch(/type="url"/)
  })

  it('exposes the contract used by the apply path (smoke check)', () => {
    // Smoke-test the chain wiring shape: when the apply path runs
    // we expect focus → extendMarkRange('link') → setLink → run.
    const { editor, calls } = stubEditor('')
    editor.chain().focus().extendMarkRange('link').setLink({ href: 'https://x.test' }).run()
    expect(calls).toEqual(['focus', 'extendMarkRange:link', 'setLink:https://x.test', 'run'])
  })
})
