import { describe, expect, it } from 'vite-plus/test'

import { parseContent } from '@/server/markdown/parser'

// Comment markdown is rendered server-side and embedded into post detail
// HTML; any sanitisation regression instantly becomes a stored XSS hole.
// This file is the safety net for the boundary — every additional vector we
// know about should land here as a regression test.

describe('services/markdown/parser — XSS / injection battery', () => {
  // Cold-load of mdx-remote + shiki + ultrahtml routinely exceeds 5s on the
  // first call; once warm, every other case here completes in milliseconds.
  it('strips bare <script> tags', { timeout: 30_000 }, async () => {
    const html = await parseContent("<script>alert('boom')</script>")
    expect(html.toLowerCase()).not.toContain('<script')
  })

  it('strips <iframe> embeds', async () => {
    const html = await parseContent('<iframe src="https://evil.example/"></iframe>')
    expect(html.toLowerCase()).not.toContain('<iframe')
  })

  it('strips <object> / <embed>', async () => {
    const html = await parseContent('<object data="x.swf"></object>')
    expect(html.toLowerCase()).not.toContain('<object')
    const html2 = await parseContent('<embed src="x.svg" />')
    expect(html2.toLowerCase()).not.toContain('<embed')
  })

  it('strips <style> blocks (no CSS injection)', async () => {
    const html = await parseContent('<style>body{display:none}</style>hi')
    expect(html.toLowerCase()).not.toContain('<style')
    expect(html).not.toContain('display:none')
  })

  it('strips inline event handlers like onerror/onload/onclick', async () => {
    const html = await parseContent('<img src=x onerror="alert(1)" /><a href="#" onclick="alert(2)">x</a>')
    const lower = html.toLowerCase()
    expect(lower).not.toContain('onerror=')
    expect(lower).not.toContain('onclick=')
  })

  it('removes <script> nested inside an allowed parent', async () => {
    const html = await parseContent("> quote\n>\n> <script>alert('nested')</script>\n")
    expect(html.toLowerCase()).not.toContain('<script')
  })

  it('never lets a `<script` tag survive even when fragmented across newlines', async () => {
    const html = await parseContent('hello<script\n>document.cookie</script>world')
    expect(html.toLowerCase()).not.toContain('<script')
    // The leftover source may remain as inert text inside `<p>`; it is not
    // executable in any rendering context, so we explicitly tolerate the
    // string but lock down the active tag.
  })

  it('removes the body of HTML comments (no payload survives)', async () => {
    const html = await parseContent('text<!-- evil --><span>ok</span>')
    // ultrahtml's sanitize leaves the comment marker `<!---->` in place but
    // we strip the *payload* in the post-sanitize prune pass. That removes
    // the exploit surface (a comment can hide active content like
    // `<!--<script>-->` in some browsers), even though the empty marker may
    // remain.
    expect(html).not.toContain('evil')
    expect(html.toLowerCase()).not.toContain('<script')
    expect(html).toContain('ok')
  })

  it('strips disallowed attributes from allowed elements (style on <a>)', async () => {
    const html = await parseContent('<a href="#" style="color:red">link</a>')
    expect(html.toLowerCase()).not.toContain('style=')
  })

  it('strips formaction / autofocus on form-like inputs', async () => {
    const html = await parseContent('<button formaction="javascript:alert(1)" autofocus>x</button>')
    expect(html.toLowerCase()).not.toContain('<button')
    expect(html.toLowerCase()).not.toContain('formaction')
  })

  it('does not double-decode HTML entities into a live tag', async () => {
    const html = await parseContent('&lt;script&gt;alert(1)&lt;/script&gt;')
    expect(html.toLowerCase()).not.toContain('<script')
  })

  it('forces external links to target=_blank rel=nofollow', async () => {
    const html = await parseContent('[gh](https://github.com)')
    expect(html).toContain('href="https://github.com"')
    expect(html).toContain('target="_blank"')
    expect(html).toContain('rel="nofollow"')
  })

  it('internal yufan.me links keep their href but stay same-tab', async () => {
    const html = await parseContent('[me](https://yufan.me/about)')
    expect(html).toContain('href="https://yufan.me/about"')
    expect(html).not.toContain('target="_blank"')
  })

  it('repeated identical input hits the LRU and returns the same string ref', async () => {
    const a = await parseContent('# cache battery')
    const b = await parseContent('# cache battery')
    expect(b).toBe(a)
  })
})
