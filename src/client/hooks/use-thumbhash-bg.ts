import { useEffect, useState, type CSSProperties } from 'react'

// Module-level singleton for the dynamic `thumbhash` import. The first
// `<img>` mount triggers the chunk load; every subsequent mount awaits
// the same already-resolved promise instead of scheduling its own
// `import()` microtask. The browser's module cache guaranteed this for
// repeat `import()` calls before, but each call still cost a microtask
// hop — this hoist removes that overhead and makes the dependency
// surface explicit.
let thumbhashModulePromise: Promise<typeof import('thumbhash')> | null = null
function loadThumbhashModule(): Promise<typeof import('thumbhash')> {
  if (thumbhashModulePromise === null) {
    thumbhashModulePromise = import('thumbhash')
  }
  return thumbhashModulePromise
}

// In-process cache of decoded thumbhash data URLs. `MdxImg` mounts can fire
// many times for the same hash on a single page (post listing thumbnails,
// repeated images), so we avoid running the wasm decode per mount. Keyed on
// the raw thumbhash string for a constant-size hit.
const thumbhashUrlCache = new Map<string, string>()

// Lazily decodes a thumbhash string into a data URL and returns it as a CSS
// style chunk so the placeholder fades behind the real image while it
// downloads. Returns `undefined` until the dynamic import + decode finishes,
// then a stable style object that the host element merges via the `style`
// prop.
//
// The thumbhash itself is computed at MDX compile time by
// `rehype-image-enhance.server.ts` (via `loadImageThumbhash`) and inlined as
// `data-thumbhash` on the HTML, so consumers only need to pass it through.
//
// React 19 lets us drive the visual change through a `style` prop on the
// host element instead of imperatively mutating `image.style.background*`
// from a `useEffect`. That makes the data flow inspectable in the React
// tree and removes the need for the consumer to forward a ref.
export function useThumbhashBackground(thumbhash: string | undefined): CSSProperties | undefined {
  const [style, setStyle] = useState<CSSProperties | undefined>(() =>
    thumbhash !== undefined ? styleFromCache(thumbhash) : undefined,
  )

  useEffect(() => {
    if (!thumbhash) {
      setStyle(undefined)
      return
    }
    const cached = thumbhashUrlCache.get(thumbhash)
    if (cached !== undefined) {
      setStyle(buildStyle(cached))
      return
    }

    let cancelled = false
    void (async () => {
      try {
        const { thumbHashToDataURL } = await loadThumbhashModule()
        if (cancelled) {
          return
        }
        const dataUrl = thumbHashToDataURL(base64ToBytes(thumbhash))
        thumbhashUrlCache.set(thumbhash, dataUrl)
        setStyle(buildStyle(dataUrl))
      } catch {
        if (cancelled) {
          return
        }
        setStyle(undefined)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [thumbhash])

  return style
}

function styleFromCache(thumbhash: string): CSSProperties | undefined {
  const cached = thumbhashUrlCache.get(thumbhash)
  return cached !== undefined ? buildStyle(cached) : undefined
}

function buildStyle(dataUrl: string): CSSProperties {
  return {
    backgroundImage: `url("${dataUrl}")`,
    backgroundPosition: 'center',
    backgroundSize: 'cover',
    backgroundRepeat: 'no-repeat',
  }
}

function base64ToBytes(value: string): Uint8Array {
  const binary = atob(value)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i)
  }
  return bytes
}
