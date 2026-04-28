import { resolve } from 'node:path'
import { describe, expect, it } from 'vite-plus/test'

import {
  committedImageMetadataFilePath,
  metadataJsonUrlForImageSrc,
  parseImageMetadataRecord,
} from '@/server/images/metadata-store'

describe('services/images/metadata-store', () => {
  it('maps image URL to repo metadata path (mirrors pathname + .json)', () => {
    const src = 'https://cat.yufan.me/images/2025/12/sample.jpg'
    const p = committedImageMetadataFilePath(src)
    expect(p).not.toBeNull()
    expect(p).toBe(resolve(process.cwd(), 'src/content/image-metadata/images/2025/12/sample.jpg.json'))
  })

  it('strips query string for repo path mapping', () => {
    const src = 'https://cat.yufan.me/images/a.png?v=1'
    const p = committedImageMetadataFilePath(src)
    expect(p).toBe(resolve(process.cwd(), 'src/content/image-metadata/images/a.png.json'))
  })

  it('metadataJsonUrlForImageSrc replaces file extension with .json', () => {
    expect(metadataJsonUrlForImageSrc('https://cat.yufan.me/images/a/b.jpg')).toBe(
      'https://cat.yufan.me/images/a/b.json',
    )
  })

  it('parseImageMetadataRecord accepts valid payloads', () => {
    expect(parseImageMetadataRecord({ width: 10, height: 20, blurhash: 'abc' })).toEqual({
      width: 10,
      height: 20,
      blurhash: 'abc',
    })
    expect(parseImageMetadataRecord({ width: 1, height: 2 })).toEqual({ width: 1, height: 2, blurhash: undefined })
  })

  it('parseImageMetadataRecord rejects invalid payloads', () => {
    expect(parseImageMetadataRecord(null)).toBeNull()
    expect(parseImageMetadataRecord({ width: 0, height: 10 })).toBeNull()
    expect(parseImageMetadataRecord({ width: 10, height: 10, blurhash: 1 })).toBeNull()
  })

  it('returns null for non-asset-host URLs', () => {
    expect(committedImageMetadataFilePath('https://example.com/x.jpg')).toBeNull()
    expect(metadataJsonUrlForImageSrc('https://example.com/x.jpg')).toBeNull()
  })
})
