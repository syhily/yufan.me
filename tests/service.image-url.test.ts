import { describe, expect, it } from 'vite-plus/test'

import { getImageUrl, isTransformableRemoteImage } from '@/shared/image-url'

const ASSET_HOST = 'cat.yufan.me'

describe('services/images/image-url — isTransformableRemoteImage', () => {
  it('rejects data URIs', () => {
    expect(isTransformableRemoteImage('data:image/png;base64,abcd')).toBe(false)
  })

  it('rejects relative URLs (URL parse fails)', () => {
    expect(isTransformableRemoteImage('/local/x.png')).toBe(false)
    expect(isTransformableRemoteImage('relative.jpg')).toBe(false)
  })

  it('accepts URLs hosted on the configured asset host', () => {
    expect(isTransformableRemoteImage(`https://${ASSET_HOST}/photo.jpg`)).toBe(true)
  })

  it('rejects URLs from other hosts', () => {
    expect(isTransformableRemoteImage('https://images.example.com/photo.jpg')).toBe(false)
  })

  it('does not double-transform URLs that already contain an upyun directive', () => {
    expect(isTransformableRemoteImage(`https://${ASSET_HOST}/photo.jpg!upyun520/foo`)).toBe(false)
  })
})

describe('services/images/image-url — getImageUrl', () => {
  it('appends the upyun transform with width/height/quality (default quality=100)', () => {
    const url = getImageUrl({ src: `https://${ASSET_HOST}/cover.png`, width: 800, height: 600 })
    expect(url).toContain('!upyun520/both/800x600/format/webp/quality/100/')
  })

  it('honours an explicit quality override', () => {
    const url = getImageUrl({
      src: `https://${ASSET_HOST}/cover.png`,
      width: 400,
      height: 300,
      quality: 70,
    })
    expect(url).toContain('/quality/70/')
  })

  it('returns the input unchanged for non-transformable URLs', () => {
    const src = 'https://other.example.com/cover.png'
    expect(getImageUrl({ src, width: 100, height: 100 })).toBe(src)
  })
})
