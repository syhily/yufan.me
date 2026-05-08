import type { Element, Root } from 'hast'

import { describe, expect, it } from 'vite-plus/test'

import type { CodeInstance } from '@/server/markdown/mermaid/types'

import { handleError } from '@/server/markdown/mermaid/errors'
import { collectDiagrams } from '@/server/markdown/mermaid/parse'
import { getRenderOptions, renderInstances, toReplacement } from '@/server/markdown/mermaid/render'

function codeBlock(diagram: string): Root {
  return {
    type: 'root',
    children: [
      {
        type: 'element',
        tagName: 'pre',
        properties: {},
        children: [
          {
            type: 'element',
            tagName: 'code',
            properties: { className: ['language-mermaid'] },
            children: [{ type: 'text', value: diagram }],
          },
        ],
      },
    ],
  }
}

describe('services/markdown/mermaid — parse.collectDiagrams', () => {
  it('collects a `<code class=language-mermaid>` block wrapped in `<pre>`', () => {
    const ast = codeBlock('graph TD; A-->B;')
    const instances = collectDiagrams(ast)
    expect(instances).toHaveLength(1)
    expect(instances[0].diagram).toBe('graph TD; A-->B;')
    // For `<code>` wrapped in `<pre>`, `inclusiveAncestors` ends at the
    // `<pre>` (not the `<code>`) so the replacement step targets the
    // surrounding block.
    expect(instances[0].ancestors.at(-1)?.tagName).toBe('pre')
  })

  it('ignores `<code>` blocks without language-mermaid class', () => {
    const ast: Root = {
      type: 'root',
      children: [
        {
          type: 'element',
          tagName: 'pre',
          properties: {},
          children: [
            {
              type: 'element',
              tagName: 'code',
              properties: { className: ['language-typescript'] },
              children: [{ type: 'text', value: 'const a = 1;' }],
            },
          ],
        },
      ],
    }
    expect(collectDiagrams(ast)).toHaveLength(0)
  })

  it('bails out if the surrounding `<pre>` has non-whitespace siblings', () => {
    const ast: Root = {
      type: 'root',
      children: [
        {
          type: 'element',
          tagName: 'pre',
          properties: {},
          children: [
            { type: 'text', value: 'noise' },
            {
              type: 'element',
              tagName: 'code',
              properties: { className: ['language-mermaid'] },
              children: [{ type: 'text', value: 'graph TD; A-->B;' }],
            },
          ],
        },
      ],
    }
    expect(collectDiagrams(ast)).toHaveLength(0)
  })

  it('treats non-ASCII text siblings as non-whitespace noise', () => {
    const ast: Root = {
      type: 'root',
      children: [
        {
          type: 'element',
          tagName: 'pre',
          properties: {},
          children: [
            { type: 'text', value: '噪声' },
            {
              type: 'element',
              tagName: 'code',
              properties: { className: ['language-mermaid'] },
              children: [{ type: 'text', value: 'graph TD; A-->B;' }],
            },
          ],
        },
      ],
    }
    expect(collectDiagrams(ast)).toHaveLength(0)
  })

  it('does not collect a nested code block again after matching `<pre class=mermaid>`', () => {
    const ast: Root = {
      type: 'root',
      children: [
        {
          type: 'element',
          tagName: 'pre',
          properties: { className: ['mermaid'] },
          children: [
            {
              type: 'element',
              tagName: 'code',
              properties: { className: ['language-mermaid'] },
              children: [{ type: 'text', value: 'graph TD; A-->B;' }],
            },
          ],
        },
      ],
    }
    const instances = collectDiagrams(ast)
    expect(instances).toHaveLength(1)
    expect(instances[0].ancestors.at(-1)?.tagName).toBe('pre')
  })

  it('collects raw `<pre class=mermaid>` candidates', () => {
    const ast: Root = {
      type: 'root',
      children: [
        {
          type: 'element',
          tagName: 'pre',
          properties: { className: ['mermaid'] },
          children: [{ type: 'text', value: 'graph TD; A-->B;' }],
        },
      ],
    }
    const instances = collectDiagrams(ast)
    expect(instances).toHaveLength(1)
    expect(instances[0].diagram).toBe('graph TD; A-->B;')
  })

  it('supports a `className` provided as a space-separated string', () => {
    const ast: Root = {
      type: 'root',
      children: [
        {
          type: 'element',
          tagName: 'pre',
          properties: {},
          children: [
            {
              type: 'element',
              tagName: 'code',
              properties: { className: 'language-mermaid extra-class' },
              children: [{ type: 'text', value: 'graph TD; A-->B;' }],
            },
          ],
        },
      ],
    }
    expect(collectDiagrams(ast)).toHaveLength(1)
  })
})

describe('services/markdown/mermaid — render.getRenderOptions', () => {
  it('returns the user options unchanged when bg+fg are explicit', async () => {
    const result = await getRenderOptions({
      renderOptions: { bg: '#fff', fg: '#000' },
    })
    expect(result).toEqual({ bg: '#fff', fg: '#000' })
  })

  it('layers a fallback theme palette when bg+fg are not provided', async () => {
    const result = await getRenderOptions(undefined)
    // We don't pin specific colour values here — beautiful-mermaid owns
    // them — but at minimum bg+fg must be filled in by the fallback.
    expect(result.bg).toBeTruthy()
    expect(result.fg).toBeTruthy()
  })
})

describe('services/markdown/mermaid — render.renderInstances', () => {
  it('renders a basic diagram through the lazy-loaded renderer', async () => {
    const results = await renderInstances([{ diagram: 'graph TD\nA-->B', ancestors: [] }], {
      renderOptions: { bg: '#fff', fg: '#000' },
    })

    const result = results[0]
    expect(result.status).toBe('fulfilled')
    if (result.status !== 'fulfilled') {
      return
    }
    expect(result.value.svg).toContain('<svg')
  })
})

describe('services/markdown/mermaid — render.toReplacement', () => {
  it('accepts SVG renderer output', async () => {
    const result = await toReplacement({ svg: '<svg viewBox="0 0 1 1"></svg>' })
    expect(result.tagName).toBe('svg')
  })

  it('rejects non-SVG renderer output', async () => {
    await expect(toReplacement({ svg: '<div></div>' })).rejects.toThrow(/non-SVG/)
  })
})

describe('services/markdown/mermaid — errors.handleError', () => {
  it('delegates to errorFallback when one is supplied', () => {
    const fallbackEl: Element = { type: 'element', tagName: 'div', properties: {}, children: [] }
    const instance: CodeInstance = {
      diagram: 'graph TD; A-->B;',
      ancestors: [fallbackEl],
    }
    const result = handleError(
      new Error('boom'),
      instance,
      // Minimal stub with the only method we use; cast covers the rest.
      { message: () => ({ fatal: false }) } as never,
      {
        errorFallback: (_el, _diagram, error) => ({
          type: 'text',
          value: `fallback:${(error as Error).message}`,
        }),
      },
    )
    expect(result).toEqual({ type: 'text', value: 'fallback:boom' })
  })

  it('escalates a fatal vfile message when no fallback is provided', () => {
    const fakeFile = {
      message: (msg: string) => {
        const err = new Error(msg)
        // attach `fatal` so we can assert the escalation later
        ;(err as Error & { fatal: boolean }).fatal = false
        throw err
      },
    }
    const instance: CodeInstance = {
      diagram: 'graph TD; A-->B;',
      ancestors: [{ type: 'element', tagName: 'code', properties: {}, children: [] }],
    }
    expect(() => handleError('kaboom', instance, fakeFile as never, undefined)).toThrow(/kaboom/)
  })
})
