import { afterEach, beforeEach, describe, expect, it } from 'vite-plus/test'

import { enhanceImageHtml, loadImageThumbhash } from '@/server/images/thumbhash'

import { installFetch, jsonResponse } from './_helpers/fetch'

const ASSET_HOST = 'cat.yufan.me'

describe('services/images/thumbhash — loadImageThumbhash', () => {
  let mock: ReturnType<typeof installFetch>
  beforeEach(() => {
    mock = installFetch()
  })
  afterEach(() => {
    mock.reset()
  })

  it('returns null for non-asset-host URLs (no metadata fetch attempted)', async () => {
    const result = await loadImageThumbhash('https://other-cdn.example.com/img.png')
    expect(result).toBeNull()
    expect(mock.calls.length).toBe(0)
  })

  it('returns null for data URLs (skips the metadata pipeline entirely)', async () => {
    const result = await loadImageThumbhash('data:image/png;base64,iVBORw0KG')
    expect(result).toBeNull()
  })

  it('translates the metadata response into a thumbhash payload', async () => {
    const src = `https://${ASSET_HOST}/photos/sunset.jpg`
    mock.enqueue(
      `https://${ASSET_HOST}/photos/sunset.json`,
      jsonResponse({ width: 1200, height: 800, blurhash: 'abcdef' }),
    )
    const result = await loadImageThumbhash(src)
    expect(result).toEqual({ width: 1200, height: 800, thumbhash: 'abcdef' })
  })

  it('returns width/height even when the upstream blurhash is missing', async () => {
    const src = `https://${ASSET_HOST}/photos/no-hash.jpg`
    mock.enqueue(`https://${ASSET_HOST}/photos/no-hash.json`, jsonResponse({ width: 600, height: 400 }))
    const result = await loadImageThumbhash(src)
    expect(result).toEqual({ width: 600, height: 400, thumbhash: undefined })
  })

  it('returns null when metadata has invalid dimensions', async () => {
    const src = `https://${ASSET_HOST}/photos/broken.jpg`
    mock.enqueue(`https://${ASSET_HOST}/photos/broken.json`, jsonResponse({ width: 0, height: 100 }))
    expect(await loadImageThumbhash(src)).toBeNull()
  })

  it('returns null when fetch throws (network outage / DNS failure)', async () => {
    const src = `https://${ASSET_HOST}/photos/missing.jpg`
    mock.enqueue(`https://${ASSET_HOST}/photos/missing.json`, () => Promise.reject(new Error('ENOTFOUND')))
    expect(await loadImageThumbhash(src)).toBeNull()
  })
})

describe('services/images/thumbhash — enhanceImageHtml', () => {
  let mock: ReturnType<typeof installFetch>
  beforeEach(() => {
    mock = installFetch()
  })
  afterEach(() => {
    mock.reset()
  })

  it('injects data-thumbhash and rewrites src for asset-host images', async () => {
    const src = `https://${ASSET_HOST}/img/cover.jpg`
    mock.enqueue(`https://${ASSET_HOST}/img/cover.json`, jsonResponse({ width: 1200, height: 800, blurhash: 'AAA111' }))
    const html = await enhanceImageHtml(`<p><img src="${src}" /></p>`)
    expect(html).toContain('data-thumbhash="AAA111"')
    expect(html).toContain('width="1200"')
    expect(html).toContain('height="800"')
    expect(html).toContain('upyun520')
  })

  it('leaves non-asset-host images untouched (no fetch, no data-thumbhash)', async () => {
    const html = await enhanceImageHtml(`<img src="https://other.example.com/x.png" />`)
    expect(html).not.toContain('data-thumbhash')
    expect(mock.calls.length).toBe(0)
  })

  it('ignores empty src attributes safely', async () => {
    const html = await enhanceImageHtml(`<img src="" />`)
    expect(html).not.toContain('data-thumbhash')
  })
})
