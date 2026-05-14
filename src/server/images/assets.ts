import { Buffer } from 'node:buffer'
import { createHash } from 'node:crypto'

import LogoDarkSvg from '@/assets/logos/logo-dark.svg?raw'
import LogoLightSvg from '@/assets/logos/logo.svg?raw'
import { loadBuffer } from '@/server/cache/image'
import { getLogger } from '@/server/logger'
import { requireBlogSettingsSection } from '@/shared/blog-config'

// Logo SVGs are inlined into the server bundle via Vite's built-in
// `?raw` query — 19 KB of text each, OG-card composition needs them
// at first render. The browser fetches `public/logo-dark.svg` (which
// still exists for the public Header / BrandLogo) — only the server
// reads from `@/assets/logos/` for Canvas use. This used to go
// through the project's custom `vite-plugin-binary` (z85 + gzip
// embedding); `?raw` covers the same ground with zero plugin.
const LogoDarkBuffer = Buffer.from(LogoDarkSvg, 'utf8')
const LogoLightBuffer = Buffer.from(LogoLightSvg, 'utf8')

export function logoDark(): Buffer {
  return LogoDarkBuffer
}

export function logoLight(): Buffer {
  return LogoLightBuffer
}

// -------- Canvas fonts (`fonts.og` / `fonts.calendar` from settings) --------
//
// The TTFs used by `@napi-rs/canvas` (`og.ts` + `calendar.ts`) used to
// live in the repo as `?binary` imports; the binary then sat embedded
// in the server bundle as a ~60 MB z85+gzip string. They now live on a
// CDN and the URL is admin-configurable at `/wp-admin/settings/fonts`.
//
// Three layers of caching protect the SSR hot path:
//
//   1. Process Map (`inProcessByUrl`) — keyed by URL so a settings
//      rotation doesn't return a stale Buffer. Hit = zero I/O.
//   2. Redis via `loadBuffer` — shared between replicas, TTL 30 days
//      (effectively forever); URL-hash key auto-invalidates on rotate.
//   3. CDN `fetch` — only on a cold replica after a Redis flush.
//
// Failure mode is **null, not throw**. An admin who hasn't configured
// the URL, or a CDN outage, must NOT 500 the OG / calendar route. The
// renderer skips `GlobalFonts.register()` for null buffers and Canvas
// falls back to its built-in system CJK shaper.

const log = getLogger('images.assets')

const FONT_CACHE_TTL_SECONDS = 60 * 60 * 24 * 30 // 30 days
const FONT_MAX_BYTES = 100 * 1024 * 1024 // 100 MB hard cap

const inProcessByUrl = new Map<string, Buffer>()

async function fetchFontBuffer(url: string): Promise<Buffer> {
  const res = await fetch(url)
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}`)
  }
  const contentLength = Number(res.headers.get('content-length') ?? '0')
  if (contentLength > FONT_MAX_BYTES) {
    throw new Error(`Content-Length ${contentLength} exceeds ${FONT_MAX_BYTES}`)
  }
  const arrayBuf = await res.arrayBuffer()
  if (arrayBuf.byteLength > FONT_MAX_BYTES) {
    throw new Error(`Downloaded ${arrayBuf.byteLength} bytes exceeds ${FONT_MAX_BYTES}`)
  }
  return Buffer.from(arrayBuf)
}

async function loadFontSlot(slot: 'og' | 'calendar'): Promise<Buffer | null> {
  const fonts = requireBlogSettingsSection('fonts')
  const url = fonts[slot].url
  if (url === '') {
    return null
  }
  const inProcess = inProcessByUrl.get(url)
  if (inProcess !== undefined) {
    return inProcess
  }
  try {
    const key = `fonts:cache:${createHash('sha256').update(url).digest('hex')}`
    const buffer = await loadBuffer(key, () => fetchFontBuffer(url), FONT_CACHE_TTL_SECONDS)
    inProcessByUrl.set(url, buffer)
    return buffer
  } catch (err) {
    log.warn('Failed to load Canvas font slot', {
      slot,
      url,
      err: err instanceof Error ? err.message : String(err),
    })
    return null
  }
}

export function oppoSans(): Promise<Buffer | null> {
  return loadFontSlot('og')
}

export function oppoSerif(): Promise<Buffer | null> {
  return loadFontSlot('calendar')
}
