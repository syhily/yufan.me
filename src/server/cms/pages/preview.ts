import type { Block, NonRecursiveBlock, PortableTextBody } from '@/shared/portable-text'

// Render the supplied PortableText body to a stand-alone HTML fragment
// for the editor's right-pane preview.
//
// The full SSR renderer (with math/mermaid/shiki/music/friends) lands
// in Milestone 5 alongside `@/ui/portable-text/PortableTextBody`. Until
// then this module emits a minimal, accessibility-friendly HTML
// fallback so the wire contract (`{ html, headings }`) is stable for
// the editor right-pane and the API contract tests. The contract is
// what Milestone 5 swaps under without touching the route.
export async function renderPortableTextToHtml(body: PortableTextBody): Promise<string> {
  const out: string[] = []
  for (const block of body) {
    out.push(renderBlock(block))
  }
  return out.filter((html) => html.length > 0).join('\n')
}

function renderBlock(block: Block): string {
  switch (block._type) {
    case 'block': {
      const tag = block.style === 'blockquote' ? 'blockquote' : headingTagFor(block.style)
      const inner = (block.children ?? []).map((span) => escapeHtml(span.text)).join('')
      return `<${tag}>${inner}</${tag}>`
    }
    case 'image': {
      const src = escapeAttr(block.src)
      const alt = escapeAttr(block.alt ?? '')
      const inner = `<img src="${src}" alt="${alt}" />`
      return block.caption
        ? `<figure>${inner}<figcaption>${escapeHtml(block.caption)}</figcaption></figure>`
        : `<figure>${inner}</figure>`
    }
    case 'code': {
      const language = block.language ? ` class="language-${escapeAttr(block.language)}"` : ''
      return `<pre><code${language}>${escapeHtml(block.code)}</code></pre>`
    }
    case 'mathBlock':
      return block.svg ?? `<div class="math math-block">${escapeHtml(block.tex)}</div>`
    case 'mermaid':
      return block.svg ?? `<pre class="mermaid">${escapeHtml(block.code)}</pre>`
    case 'horizontalRule':
      return '<hr />'
    case 'musicPlayer':
      return `<aside class="music-player" data-player-id="${escapeAttr(block.playerId)}"></aside>`
    case 'friends':
      return '<section class="friends-grid"></section>'
    case 'solution': {
      const inner = block.children.map((child) => renderBlock(child)).join('\n')
      return `<details class="solution"><summary>解答</summary>${inner}</details>`
    }
    case 'footnoteDefinition': {
      const inner = block.children.map((child) => renderBlock(child)).join('\n')
      return `<div class="footnote" id="fn-${block.index}" data-footnote-index="${block.index}">${inner}</div>`
    }
    default: {
      // Exhaustiveness check — TypeScript flags any new `_type` that
      // forgets to register a render branch.
      const exhaustive: never = block
      void exhaustive
      return ''
    }
  }
}

function headingTagFor(style: string | undefined): string {
  switch (style) {
    case 'h1':
      return 'h1'
    case 'h2':
      return 'h2'
    case 'h3':
      return 'h3'
    case 'h4':
      return 'h4'
    default:
      return 'p'
  }
}

function escapeHtml(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function escapeAttr(value: string): string {
  return escapeHtml(value).replace(/"/g, '&quot;')
}

// Re-export so the type imports above don't read as unused if the
// renderer evolves to drop the explicit `Block` annotation.
export type { NonRecursiveBlock }
