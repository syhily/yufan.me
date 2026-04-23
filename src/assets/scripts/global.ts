// Bootstrap entry: wires every page-wide feature module. Most features only
// run on a subset of pages (TOC needs `.toggle-menu-tree`, APlayer needs
// `.aplayer`, etc.), so we dynamic-import them on demand. The first network
// round-trip ships a tiny dispatcher; everything else is pulled in only when
// the corresponding DOM hook is present on the page.
//
// IMPORTANT: each `selector` below MUST match what the feature itself queries
// for, otherwise we'll fail to load the module and the feature becomes a
// no-op. Cross-reference with `src/assets/scripts/features/*` when editing.

type FeatureFn = () => unknown | Promise<unknown>

interface Feature {
  /** When this selector matches at least one element, load and run the feature. */
  selector?: string
  /** Always load this feature (used for site-wide UI like header/menu). */
  always?: boolean
  /** Lazy import returning the feature function. */
  load: () => Promise<FeatureFn>
}

async function run(feature: Feature): Promise<void> {
  if (!feature.always && feature.selector && document.querySelector(feature.selector) === null) {
    return
  }
  try {
    const fn = await feature.load()
    await fn()
  } catch (err) {
    console.error('[global] feature failed to initialise', err)
  }
}

const features: Feature[] = [
  // Site-wide chrome: rendered by every layout via BaseLayout.astro.
  // `.site-aside` (mobile menu) and `.fixed-gotop` (scroll-to-top widget) are
  // always present, so we skip the gate to avoid an extra DOM lookup.
  { always: true, load: () => import('@/assets/scripts/features/menu-toggle').then((m) => m.initMenuToggle) },
  { always: true, load: () => import('@/assets/scripts/features/scroll-top').then((m) => m.initScrollTop) },
  { always: true, load: () => import('@/assets/scripts/features/focus-hash').then((m) => m.initFocusHash) },

  // Sidebar lives on most listing/article pages but not on the install page.
  { selector: '.sidebar', load: () => import('@/assets/scripts/features/sidebar-tooltips').then((m) => m.initSidebar) },

  // Search lives wherever the header search icon (`.global-search`) or the
  // sidebar search input (`.search-sidebar`) is rendered.
  {
    selector: '.global-search, .search-sidebar',
    load: () => import('@/assets/scripts/features/search').then((m) => m.initSearch),
  },

  // QR-code popups are bound to any `.nice-dialog` (currently used for the
  // WeChat contact widget in the sidebar).
  {
    selector: '.nice-dialog',
    load: () => import('@/assets/scripts/features/qr-popup').then((m) => m.initQrPopups),
  },

  // TOC adds smooth-scroll to in-page anchors AND toggles the menu tree.
  // We need it whenever the page contains either an in-page anchor or the
  // toggle button itself.
  {
    selector: 'a[href^="#"], .toggle-menu-tree',
    load: () => import('@/assets/scripts/features/toc').then((m) => m.initTableOfContents),
  },

  // Footnote tooltips: only show up inside MDX posts that render footnotes.
  {
    selector: 'sup a[id^="user-content-fnref-"]',
    load: () => import('@/assets/scripts/features/footnotes').then((m) => m.initFootnoteTooltips),
  },

  // medium-zoom binds against `.post-content img/svg`. Anything inside a post
  // body is enough to warrant loading the module.
  {
    selector: '.post-content img, .post-content svg',
    load: () => import('@/assets/scripts/features/medium-zoom').then((m) => m.initMediumZoom),
  },

  // Code-block copy buttons: any <pre> on the page (posts/snippets/about).
  { selector: 'pre', load: () => import('@/assets/scripts/features/snippet').then((m) => m.attachCopyButtons) },

  // Comments only render where the comment block has been mounted.
  { selector: '#comments', load: () => import('@/assets/scripts/features/comments').then((m) => m.initComments) },

  // Like button is rendered with `button.post-like` on individual posts.
  {
    selector: 'button.post-like',
    load: () => import('@/assets/scripts/features/like-button').then((m) => m.initLikeButton),
  },

  // APlayer only on pages that use the music player component (`.aplayer`).
  {
    selector: '.aplayer[data-id]',
    load: () => import('@/assets/scripts/features/aplayer').then((m) => m.initAPlayer),
  },
]

// Schedule everything in parallel; individual feature failures don't block
// each other thanks to per-feature try/catch in `run`.
void Promise.all(features.map(run))
