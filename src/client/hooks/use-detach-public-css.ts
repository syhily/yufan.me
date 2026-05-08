import { useEffect } from 'react'

// React Router v7 keeps already-injected CSS attached to `<head>` across
// SPA navigations on purpose (see `persistentHrefs` in the dev/runtime;
// shared lazy chunks may still reference it). That is the right default
// for layered stylesheets, but it breaks any admin-area route when the
// user navigates here from the public site: `public.css` stays in
// `<head>`, and per the W3C cascade-layers spec un-layered rules beat
// any `@layer utilities` rule of any specificity.
//
// This hook closes that gap by detaching every public stylesheet on
// mount and re-attaching them on unmount, so an SPA navigation back to
// a public page keeps its styling. It is shared by the wp-admin SPA
// layout and the wp-login / install split-screen layout — every route
// that opts out of the public chrome via `handle.layout = "admin"`
// must also opt into this hook.

function isPublicStylesheet(el: Element): boolean {
  if (el.tagName === 'STYLE') {
    // Vite dev server injects `<style data-vite-dev-id="…/public.css">`
    const devId = el.getAttribute('data-vite-dev-id') ?? ''
    return /[/\\]public\.css(?:[?#]|$)/.test(devId)
  }
  if (el.tagName === 'LINK') {
    // Production build emits a hashed `<link rel="stylesheet" href="…/assets/public-XXXX.css">`.
    const href = (el as HTMLLinkElement).getAttribute('href') ?? ''
    return /(?:\/|^)public(?:\.|-)[^/]*\.css(?:[?#]|$)/.test(href)
  }
  return false
}

export function useDetachPublicCss(): void {
  useEffect(() => {
    if (typeof document === 'undefined') {
      return
    }
    type Detached = { node: Element; nextSibling: Node | null; parent: ParentNode }
    const detached: Detached[] = []
    document.head.querySelectorAll('style, link[rel="stylesheet"]').forEach((el) => {
      if (!isPublicStylesheet(el)) {
        return
      }
      const parent = el.parentNode
      if (!parent) {
        return
      }
      detached.push({ node: el, nextSibling: el.nextSibling, parent })
      el.remove()
    })
    return () => {
      for (const { node, nextSibling, parent } of detached) {
        parent.insertBefore(node, nextSibling)
      }
    }
  }, [])
}
