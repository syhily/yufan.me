// Centralised React Router route module exports for the public surface.
//
// Every public listing/detail route used to spell out the same two lines:
//
//   export const shouldRevalidate = ...;
//   export const headers = cacheHeaders("listing"|"detail");
//
// Drift is easy in that pattern (the previous codebase had two byte-identical
// `shouldRevalidate` helpers under different names). The React Router Vite
// plugin requires route module exports to be plain `export const X = …`
// (it tree-shakes `loader`/`action`/`headers`/etc. statically), so we
// expose the policy as named constants here and let each route do
// `export const headers = listingHeaders;` plus
// `export const shouldRevalidate = listingShouldRevalidate;`. Any future
// tweak (a new cache profile, a new revalidation rule) lands in this one
// file instead of eight.

import { cacheHeaders } from '@/server/route-helpers/headers'
import { commentAwareRevalidate } from '@/server/route-helpers/revalidate'

// Listing pages: home, archives, categories, /cats/:slug, /tags/:slug,
// /search/:keyword. Short browser cache + SWR window keeps per-post
// like/view counters fresh without another round-trip on back/forward
// navigations.
export const listingHeaders = cacheHeaders('listing')

// Detail pages: post.detail, page.detail. Longer SWR window since the body
// content rarely changes between visits.
export const detailHeaders = cacheHeaders('detail')

// Single revalidation policy shared by every public route: opt out of
// re-running the loader for comment-action submissions (the comment island
// owns its own DOM updates), and otherwise honour the router default.
export const publicShouldRevalidate = commentAwareRevalidate
