import { useCallback, useLayoutEffect, useRef, useState, type Ref, type SyntheticEvent } from 'react'

// Shared internals for image components that drive a thumbhash placeholder
// and need to know when the underlying `<img>` finishes painting.
//
// Two concerns are bundled together because they cannot live apart:
//
//   1. A ref-merger callback that forwards into both an internal ref
//      (used by `useLayoutEffect` to check `node.complete`) and an
//      optional external ref provided by the parent.
//   2. A `loaded` flag that flips true the moment the browser has the
//      pixels — either via `<img onLoad>` or, for already-cached
//      images, by inspecting `node.complete` synchronously on attach
//      AND in a layout effect to cover hydration cases where the
//      ref callback ran before the network finished.
//
// Both `<RawImage>` and `<BlockImage>` used to inline 20 identical
// lines for this; the hook keeps a single source of truth so any
// future tweak (e.g. tracking decode timing) lands in one place.
export interface ImageLoadedHook {
  ref: (node: HTMLImageElement | null) => void
  loaded: boolean
  handleLoad: (event: SyntheticEvent<HTMLImageElement>) => void
}

export function useImageLoaded(
  externalRef: Ref<HTMLImageElement> | undefined,
  onLoad?: (event: SyntheticEvent<HTMLImageElement>) => void,
): ImageLoadedHook {
  const imgRef = useRef<HTMLImageElement | null>(null)
  const [loaded, setLoaded] = useState(false)

  useLayoutEffect(() => {
    if (imgRef.current?.complete) {
      setLoaded(true)
    }
  }, [])

  const ref = useCallback(
    (node: HTMLImageElement | null) => {
      imgRef.current = node
      if (typeof externalRef === 'function') {
        externalRef(node)
      } else if (externalRef && 'current' in externalRef) {
        ;(externalRef as React.RefObject<HTMLImageElement | null>).current = node
      }
      if (node?.complete) {
        setLoaded(true)
      }
    },
    [externalRef],
  )

  const handleLoad = useCallback(
    (event: SyntheticEvent<HTMLImageElement>) => {
      setLoaded(true)
      onLoad?.(event)
    },
    [onLoad],
  )

  return { ref, loaded, handleLoad }
}
