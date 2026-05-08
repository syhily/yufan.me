import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { describe, expect, it } from 'vite-plus/test'

function files(...args: string[]): string[] {
  // `rg --files` exits with a non-zero status when every input path is
  // missing (which happens after we deleted an entire feature tree), so we
  // return early if no path-like argument resolves on disk. Flag args (`-g`
  // plus its value) are kept intact.
  const paths = args.filter((arg) => !arg.startsWith('-'))
  if (paths.length === 0) {
    return []
  }
  if (paths.every((path) => !existsSync(path))) {
    return []
  }
  const out = execFileSync('rg', ['--files', ...args], { encoding: 'utf8' }).trim()
  return out === '' ? [] : out.split('\n')
}

describe('contract: module and bundle boundaries', () => {
  it('keeps catalog private modules behind @/shared/catalog', () => {
    const offenders = files('src', 'tests', '-g', '*.ts', '-g', '*.tsx')
      .filter((file) => !file.startsWith('src/server/catalog/'))
      .filter((file) => {
        const source = readFileSync(file, 'utf8')
        return /@\/server\/catalog\/(?:schema|catalog)(?:["'/])/.test(source)
      })

    expect(offenders).toEqual([])
  })

  it('keeps optional vendor CSS out of the root stylesheet', () => {
    const source = readFileSync('src/assets/styles/public.css', 'utf8')

    expect(source).not.toContain('bootstrap/dist/css/bootstrap.css')
    expect(source).not.toContain('bootstrap/dist/css/bootstrap-reboot.css')
    expect(source).not.toContain('bootstrap/dist/css/bootstrap-utilities.css')
    expect(source).not.toContain('aplayer-ts/src/css/base.css')
    expect(source).not.toContain('medium-zoom/dist/style.css')
    expect(source).not.toContain('tippy.js')
  })

  it('keeps the Bootstrap npm dep fully retired from the public bundle', () => {
    // The public bundle must not pull anything from `bootstrap/dist/`
    // (the grid was the last surface to retire — its 4011-line
    // `bootstrap-grid.css` is now expressed as Tailwind utility
    // chains directly on the JSX, e.g. `.container` →
    // `mx-auto w-full px-3 sm:max-w-sm …`). The
    // Bootstrap utility ladder (`d-flex`, `me-2`, `text-center`,
    // `sticky-top`, …) and its `_legacy-utilities.css` shim must
    // also stay un-imported.
    const globals = readFileSync('src/assets/styles/public.css', 'utf8')

    // Match real CSS/JS import statements only — comments mentioning
    // `bootstrap/dist/css/bootstrap-grid.css` (the historical retired
    // path documented in the file's header) must not trip these.
    expect(globals).not.toMatch(/^\s*@import\s+['"]bootstrap/m)
    expect(globals).not.toMatch(/^\s*import\s.*from\s+['"]bootstrap/m)
    expect(globals).not.toContain('_legacy-utilities')
    expect(globals).not.toMatch(/bootstrap[^.]*utilities\.css/i)
    expect(
      files('src/assets/styles', '-g', '*.css').filter((file) =>
        /bootstrap.*utilities|utilities.*bootstrap|legacy-utilities/.test(file),
      ),
    ).toEqual([])
  })

  it('keeps the legacy buttons + bootstrap-compat partials AND the temporary components.css shim fully retired', () => {
    // The `.btn` family (the bespoke variant ladder in `buttons.css` +
    // the residual Bootstrap `.btn` reset in `bootstrap-compat.css` +
    // the temporary un-layered shim at `components.css` that briefly
    // consumer is now inlined into a Tailwind utility chain backed by
    // the shared `btn*` constants in `@/ui/primitives/btn.ts`. This
    // contract guards every step of that retirement so a future
    // refactor can't silently re-introduce the legacy partials.
    expect(existsSync('src/ui/primitives/buttons.css')).toBe(false)
    expect(existsSync('src/assets/styles/bootstrap-compat.css')).toBe(false)
    expect(existsSync('src/assets/styles/components.css')).toBe(false)

    const globals = readFileSync('src/assets/styles/public.css', 'utf8')
    expect(globals).not.toMatch(/@import\s+['"][^'"]*buttons\.css['"]/)
    expect(globals).not.toMatch(/@import\s+['"][^'"]*bootstrap-compat\.css['"]/)
    expect(globals).not.toMatch(/@import\s+['"][^'"]*components\.css['"]/)

    // Every inlined `.btn` consumer reads from this module; a future
    // refactor that drops one of these symbols must update the
    // `cn(btn*)` call sites in lockstep rather than silently delete
    // the export.
    expect(existsSync('src/ui/primitives/btn.ts')).toBe(true)
    const btn = readFileSync('src/ui/primitives/btn.ts', 'utf8')
    for (const symbol of [
      'btnBase',
      'btnPrimary',
      'btnSecondary',
      'btnLight',
      'btnDark',
      'btnCircle',
      'btnRoundedLg',
      'btnLg',
      'btnBlock',
      'btnIcon',
      'btnIconMd',
      'btnIconLg',
      'btnSocial',
    ]) {
      expect(btn).toMatch(new RegExp(`export const ${symbol}\\b`))
    }

    // Source-of-truth for the `28%` icon-inset magic number — every
    // icon-button consumer reads it through `m-icon-inset`.
    const tailwindCss = readFileSync('src/assets/styles/tailwind.css', 'utf8')
    expect(tailwindCss).toMatch(/--spacing-icon-inset:\s*28%;/)
  })

  it('keeps the legacy cards + lists partials fully retired', () => {
    // `cards.css` and `lists.css` are gone. Every `.block` /
    // `.list-*` / `.media` / `.overlay` / `.list-nice-overlay` /
    // `.list-bookmarks` / `.list-grid` / `.text-muted` /
    // `.list-title.h5/.h6` / `.list-grouped` rule was inlined into
    // the matching JSX as a Tailwind utility chain (stages 6e-6k).
    // The dark-overlay metadata colour `#eaecf3` that used to live
    // in lists.css's `.list-nice-overlay .text-muted:not(i)`
    // override is now a first-class token (`--color-light-overlay`
    // raw + `--color-ink-overlay` theme alias); PostSquare reads it
    // as `text-ink-overlay`. Re-introducing either partial would
    // silently shadow the inlined chains because the legacy
    // partials would have to come back un-layered (un-layered beats
    // `@layer utilities` per the W3C cascade-layers spec, lesson 2);
    // this contract makes the regression visible at PR time instead.
    expect(existsSync('src/ui/primitives/cards.css')).toBe(false)
    expect(existsSync('src/ui/primitives/lists.css')).toBe(false)

    const globals = readFileSync('src/assets/styles/public.css', 'utf8')
    expect(globals).not.toMatch(/@import\s+['"][^'"]*cards\.css['"]/)
    expect(globals).not.toMatch(/@import\s+['"][^'"]*lists\.css['"]/)

    // The `--color-ink-overlay` token lives in `tailwind.css`
    // (theme alias) backed by `--color-light-overlay` in
    // `_tokens.css` (raw hex). Both must stay registered because
    // PostSquare reads the alias as `text-ink-overlay`.
    const tokens = readFileSync('src/assets/styles/tailwind.css', 'utf8')
    expect(tokens).toMatch(/--color-light-overlay:\s*#eaecf3;/)
    const tailwindCss = readFileSync('src/assets/styles/tailwind.css', 'utf8')
    expect(tailwindCss).toMatch(/--color-ink-overlay:\s*var\(--color-light-overlay\);/)

    // Scan every public source file for residual className tokens
    // that would only resolve through the deleted partials. We strip
    // line and block comments first so the assertion fires on real
    // markup, not on documentation that legitimately references the
    // retired classes (e.g. `public.css` retired-partials index).
    //
    // The boundary character class `[^A-Za-z0-9_:-]` is intentionally
    // strict: `\b` would treat `:` as a word boundary, so the bare
    // `block` rule would mis-fire on the Tailwind `block` /
    // `md:block` utility chain. Same for `overlay` (the
    // legitimate `replying-to-overlay` and `aside-overlay` chrome
    // classes) and `text-muted` (shadcn's `text-muted-foreground`).
    // Each banned token must be flanked on both sides by something
    // that cannot appear inside a className identifier (`-`, `:`, or
    // alphanumeric) — i.e. a quote, whitespace, `=`, etc.
    const offenders: string[] = []
    // `cards.css` `.block` card-layout helper coming back. After
    // utility writes the same className literal, so a "no bare
    // `block`" check would mis-fire on every `<div className=
    // "block">` in the codebase. The check is removed; the
    // surviving `existsSync('src/ui/primitives/cards.css') ===
    // false` + the `@import './cards.css'` absence assertions
    // above already pin the partial as fully retired, and the
    // `bannedClassTokens` list catches every NON-Tailwind
    // remnant (the cards.css `.block` helper had no peer in
    // Tailwind, so its return would still surface through some
    // companion class like `list-content` / `list-grouped`).
    const bannedClassTokens = [
      'list-item',
      'list-content',
      'list-body',
      'list-title',
      'list-grouped',
      'list-bookmarks',
      'list-nice-overlay',
      'list-grid',
      'list-desc',
      'list-meta',
      'list-footer',
      'list-subtitle',
      'list-gogogo',
      'h-1x',
      'h-2x',
      'h-3x',
      'data-null',
    ]
    // `media`, `overlay`, and `text-muted` are common substrings that
    // legitimately appear in variable names (`media`), other chrome
    // classes (`replying-to-overlay`, `aside-overlay`), or shadcn
    // utility tokens (`text-muted-foreground`, `text-muted-
    // foreground`). We only ban each as a standalone className token.
    const ambiguousClassTokens = ['media', 'overlay', 'text-muted']
    for (const file of files('src', '-g', '*.ts', '-g', '*.tsx', '-g', '*.css')) {
      const source = readFileSync(file, 'utf8')
      const stripped = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1')
      const hit = bannedClassTokens.find((token) =>
        new RegExp(`(?<![A-Za-z0-9_-])${token}(?![A-Za-z0-9_-])`).test(stripped),
      )
      if (hit !== undefined) {
        offenders.push(`${file} (${hit})`)
        continue
      }
      const ambiguous = ambiguousClassTokens.find((token) =>
        new RegExp(
          `class(?:Name)?\\s*=\\s*["'\`][^"'\`]*(?<![A-Za-z0-9_:-])${token}(?![A-Za-z0-9_:-])[^"'\`]*["'\`]`,
        ).test(stripped),
      )
      if (ambiguous !== undefined) {
        offenders.push(`${file} (${ambiguous} className)`)
      }
    }
    expect(offenders).toEqual([])
  })

  it('keeps the legacy navigation partial fully retired', () => {
    // `src/ui/primitives/navigation.css` is gone. The whole public
    // chrome state machine is now React-driven — `<header>` carries
    // `data-state="open" | "closed"` and Tailwind v4's
    // `max-lg:data-[state=open]:` / `group-data-[state=open]/
    // aside:` named-group variants paint the mobile drawer (Header.tsx,
    // `.navbar-brand`, `.mobile-brand`, `.menu-toggler`, `.site-menu`,
    // `.site-submenu`, `.button-social`, `.content-wrapper`, `.sidebar`
    // — the public `<aside>` rail; `.sidebar` as a Tailwind theme
    // token / shadcn semantic colour like `bg-sidebar` is NOT
    // banned —, `.site-layout`, `.site-main`) is inlined into JSX as
    // a Tailwind utility chain. The single shared social-button
    // wrapper now lives at `btnSocial` in `@/ui/primitives/btn.ts`
    // (covered by the buttons describe above). Re-introducing the
    // partial would silently shadow the inlined chains because the
    // legacy partial would have to come back un-layered, and
    // un-layered normal declarations beat `@layer utilities` per the
    // W3C cascade-layers spec; this contract makes the regression
    // visible at PR time instead. The new `--z-aside-drawer: 1020`
    // raw token (`_tokens.css`) backs the drawer's stacking
    // context — Tailwind v4 has no `--z-*` theme namespace, so
    // Header.tsx reaches it via the arbitrary-value reference
    // `z-(--z-aside-drawer)`; this contract pins the token so a
    // future cleanup can't drop it without replacing the consumer.
    expect(existsSync('src/ui/primitives/navigation.css')).toBe(false)

    const globals = readFileSync('src/assets/styles/public.css', 'utf8')
    expect(globals).not.toMatch(/@import\s+['"][^'"]*navigation\.css['"]/)

    // The drawer-stacking token is the public chrome's only
    // first-class consumer; pin it so the consumer (Header.tsx
    // `asideShellClass`) keeps resolving.
    const tokens = readFileSync('src/assets/styles/tailwind.css', 'utf8')
    expect(tokens).toMatch(/--z-aside-drawer:\s*1020;/)

    // Scan every public source file for residual className tokens
    // that would only resolve through the deleted partial. Strip
    // line and block comments first so the assertion fires on real
    // markup, not the documentation that legitimately references
    // the retired classes (e.g. `public.css` retired-partials
    // index, `reset.css` cap-comment block).
    const offenders: string[] = []
    const bannedClassTokens = [
      'site-aside',
      'aside-inner',
      'navbar-brand',
      'mobile-brand',
      'menu-toggler',
      'site-menu',
      'site-submenu',
      'button-social',
      'content-wrapper',
      'site-layout',
      'site-main',
    ]
    // `sidebar` is a special case: shadcn's design-system semantic
    // colour group ships `bg-sidebar`, `text-sidebar-foreground`,
    // `border-sidebar-border` etc., which would all fire under a
    // bare `(?<![A-Za-z0-9_-])sidebar(?![A-Za-z0-9_-])` className
    // scan because the `` prefix and the trailing `-foreground`
    // sit OUTSIDE the className-token pattern. We instead ban the
    // exact bare `sidebar` className word — a literal `className="
    // sidebar"` or whitespace-flanked occurrence inside any class
    // attribute (matching the legacy `<aside className="sidebar
    // `search-sidebar` (search compound) are unaffected because the
    // boundary class fires on `-`/`_`/alphanumerics flanking
    // `sidebar`. (`sidebar-inner` retired with the `sidebar.css`
    // marker; the per-partial sidebar contract below pins its
    // utility-chain replacement.)
    const bareSidebar = /class(?:Name)?\s*=\s*["'`][^"'`]*(?:^|\s)sidebar(?:\s|$)[^"'`]*["'`]/
    for (const file of files('src', '-g', '*.ts', '-g', '*.tsx', '-g', '*.css')) {
      const source = readFileSync(file, 'utf8')
      const stripped = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1')
      if (bareSidebar.test(stripped)) {
        offenders.push(`${file} (bare 'sidebar' className)`)
        continue
      }
      const hit = bannedClassTokens.find((token) =>
        new RegExp(`(?<![A-Za-z0-9_-])${token}(?![A-Za-z0-9_-])`).test(stripped),
      )
      if (hit !== undefined) {
        offenders.push(`${file} (${hit})`)
      }
    }
    expect(offenders).toEqual([])
  })

  it('keeps the legacy popup partial fully retired', () => {
    // The `popup.css` partial is gone: every dimension, color,
    // shadow, transition and close-button cursor cue is now expressed
    // as Tailwind utilities backed by the popup-token block in
    // `tailwind.css`. No JSX (or any non-comment source) writes a
    // `nice-popup` / `nice-popup-close` / `nice-popup-content`
    // className. Re-introducing the partial would silently shadow the
    // inlined utility chains because un-layered partials beat every
    // `@layer utilities` rule per the W3C cascade-layers spec; this
    // contract makes the regression visible at PR time instead.
    expect(existsSync('src/ui/primitives/popup.css')).toBe(false)

    const globals = readFileSync('src/assets/styles/public.css', 'utf8')
    expect(globals).not.toMatch(/popup\.css/)

    const offenders: string[] = []
    for (const file of files('src', '-g', '*.ts', '-g', '*.tsx', '-g', '*.css')) {
      const source = readFileSync(file, 'utf8')
      // Strip line comments and block comments before scanning so the
      // assertion fires only on real code. Block comments span lines,
      // so do them first; then collapse `//` line comments.
      const stripped = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1')
      if (/\bnice-popup(?:-[a-z]+)*\b/.test(stripped)) {
        offenders.push(file)
      }
    }
    expect(offenders).toEqual([])
  })

  it('keeps the legacy media partial fully retired', () => {
    // `media.css` is gone. The base `.media` wrapper rule moved to
    // `lists.css` (where the existing `.list-grid .media` /
    // `.list-nice-overlay .media` descendants already live); every
    // variant flavour (`.media-overlay`, `.media-content`,
    // `.media-3x*`, `.media-36x17`, `.overlay-top`) and the
    // `.nav-links` / `.page-numbers` pagination chrome was inlined
    // into JSX as Tailwind utility chains. Re-introducing any of those
    // classnames would silently shadow the inlined chains because the
    // legacy partial would have to come back un-layered (un-layered
    // beats `@layer utilities` per the W3C cascade-layers spec); this
    // contract makes the regression visible at PR time instead.
    expect(existsSync('src/ui/primitives/media.css')).toBe(false)

    const globals = readFileSync('src/assets/styles/public.css', 'utf8')
    expect(globals).not.toMatch(/@import\s+['"][^'"]*media\.css['"]/)

    const offenders: string[] = []
    for (const file of files('src', '-g', '*.ts', '-g', '*.tsx', '-g', '*.css')) {
      const source = readFileSync(file, 'utf8')
      const stripped = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1')
      if (
        /\bmedia-(?:overlay|content|3x[12]|36x17)\b/.test(stripped) ||
        /\boverlay-top\b/.test(stripped) ||
        /\bnav-links\b/.test(stripped) ||
        /\bpage-numbers\b/.test(stripped)
      ) {
        offenders.push(file)
      }
    }
    expect(offenders).toEqual([])
  })

  it('keeps the legacy forms partial fully retired', () => {
    // `forms.css` is gone. Its sole remaining rule (`.flex-avatar` and
    // its `<img>` descendant — the `.form-control*` family had already
    // into the two avatar wrappers under `@/ui/comments/`:
    //
    //   - `CommentItem.tsx` 的 thread-row avatar wrapper
    //   - `CommentReplyForm.tsx` 的 form-level avatar wrapper
    //
    // Both wrappers now carry the utility chain
    //   relative flex shrink-0 items-center
    //   justify-center rounded-full leading-none
    //   font-semibold whitespace-nowrap
    // and the inner `<img>` carries `w-full rounded-full`
    // (replacing the descendant rule `.flex-avatar img { border-radius:
    // inherit; width: 100% }`). Re-introducing the partial would
    // silently shadow the inlined chains because the legacy partial
    // would have to come back un-layered, and un-layered普通 declarations
    // beat `@layer utilities` per the W3C cascade-layers spec; this
    // contract makes the regression visible at PR time instead.
    expect(existsSync('src/ui/primitives/forms.css')).toBe(false)

    const globals = readFileSync('src/assets/styles/public.css', 'utf8')
    expect(globals).not.toMatch(/@import\s+['"][^'"]*forms\.css['"]/)

    const offenders: string[] = []
    for (const file of files('src', '-g', '*.ts', '-g', '*.tsx', '-g', '*.css')) {
      const source = readFileSync(file, 'utf8')
      const stripped = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1')
      if (/\bflex-avatar\b/.test(stripped)) {
        offenders.push(file)
      }
    }
    expect(offenders).toEqual([])
  })

  it('keeps the legacy sidebar partial fully retired', () => {
    // `src/ui/sidebar/sidebar.css` is gone. Every widget body, every
    // tag-cloud chip, the search-form chrome, the like-count chips
    // and the fixed-widget rail are now expressed as named `cn()`
    // utility chains on their consuming components:
    //
    //   - `Sidebar.tsx` owns `sidebarInnerClass`, `widgetClass`,
    //     `widgetTitleClass`, `widgetListClass`, `widgetListItemClass`,
    //     `widgetEntryLinkClass`, `widgetCommentLinkClass`,
    //     `commentAuthorLinkClass`, `tagcloudClass`, `tagcloudLinkClass`.
    //   - `Search.tsx` owns `sidebarSearchInputClass`.
    //   - `PostListViews.tsx` owns `listLikeClass`, `listLikeSquareClass`,
    //     `likeCountClass`.
    //   - `BaseLayout.tsx` carries the inline `fixed right-5
    //     bottom-0 -translate-y-1/2 z-[9999]` chain on the
    //     `<ul className="site-fixed-widget …">` rail.
    //   - `ScrollTopButton.tsx` carries the inline `hidden`/
    //     `block` toggle on its `<li className="fixed-gotop …">`.
    //
    // Two `:before` decorations whose `content: …` owned boxes
    // cannot be expressed as Tailwind utilities (`.widget-title:
    // before` and `.tagcloud > a:before`) survive in the
    // `@layer components` block of `public.css`; the
    // `.screen-reader-text` a11y helper survives un-layered just
    // below it (cross-partial concern shared with `Pagination.tsx`).
    // Re-introducing the partial would silently shadow every inlined
    // chain because the legacy partial would have to come back
    // un-layered (un-layered普通 declarations beat `@layer utilities`
    // per the W3C cascade-layers spec); this contract makes the
    // regression visible at PR time instead.
    expect(existsSync('src/ui/sidebar/sidebar.css')).toBe(false)

    const globals = readFileSync('src/assets/styles/public.css', 'utf8')
    expect(globals).not.toMatch(/@import\s+['"][^'"]*sidebar\.css['"]/)

    // The two surviving `:before` decorations and the relocated a11y
    // helper must live in `public.css`. Pin them so a future cleanup
    // can't drop them without replacing the consumer (`Sidebar.tsx`'s
    // `widgetTitleClass` / `tagcloudClass`, `Pagination.tsx`'s
    // landmark `<h2>`, `Search.tsx`'s `<span>`).
    expect(globals).toMatch(/\.widget-title:before\s*\{/)
    expect(globals).toMatch(/\.tagcloud\s*>\s*a:before\s*\{/)
    expect(globals).toMatch(/\.screen-reader-text\s*\{/)

    // No `.css` partial under `src/` may redefine the inlined
    // selectors. (`.like-count` is a special case — `post.css`'s
    // sidebar-scoped `.list-like .like-count` and `.list-like-square
    // .like-count` rules retired here. We pin the bare-`.list-like`
    // and `.list-like-square` parents instead.)
    const partialOffenders: string[] = []
    const bannedSelectors = [
      /\.sidebar-inner\s*\{/,
      /\.widget\s*\{/,
      /\.widget-title\s*\{/,
      /\.widget-search\b/,
      /\.widget-recent-(?:entries|comments)\b/,
      /\.tagcloud\s*\{/,
      /\.tagcloud\s+a\b/,
      /\.list-like(?:-square)?\s*\{/,
      /\.list-like(?:-square)?\s+\.like-count\b/,
      /\.site-fixed-widget\b/,
      /\.search-field\b/,
    ]
    for (const file of files('src', '-g', '*.css')) {
      const source = readFileSync(file, 'utf8')
      const stripped = source.replace(/\/\*[\s\S]*?\*\//g, '')
      const hit = bannedSelectors.find((re) => re.test(stripped))
      if (hit !== undefined) {
        partialOffenders.push(`${file} (${hit})`)
      }
    }
    expect(partialOffenders).toEqual([])
  })
  it('keeps client utilities independent from UI component modules', () => {
    const offenders = files('src/client', 'src/shared', '-g', '*.ts').filter((file) => {
      const source = readFileSync(file, 'utf8')
      return /@\/ui\//.test(source)
    })

    expect(offenders).toEqual([])
  })

  it('keeps UI and client modules from importing server/runtime data modules', () => {
    const offenders = files('src/ui', 'src/client', '-g', '*.ts', '-g', '*.tsx').filter((file) => {
      const source = readFileSync(file, 'utf8')
      return source.split('\n').some((line) => {
        const trimmed = line.trim()
        if (!trimmed.startsWith('import')) {
          return false
        }
        return /@\/server\//.test(trimmed) || /\.server(?:["']|$)/.test(trimmed)
      })
    })

    expect(offenders).toEqual([])
  })

  it('keeps the static `@/blog.config` import out of the codebase entirely', () => {
    // The static config tree (`src/blog.config.ts`, `DEFAULT_SETTINGS`,
    // `BlogConstants`) was deleted alongside the install-flow refactor.
    // Every consumer now reaches the live values through
    // `requireBlogSettingsSection()` (server) or the per-section
    // hooks like `useFooterSettings()` (UI).
    const offenders = files('src', 'tests', '-g', '*.ts', '-g', '*.tsx').filter((file) => {
      const source = readFileSync(file, 'utf8')
      return /from\s+["']@\/blog\.config["']/.test(source)
    })
    expect(offenders).toEqual([])
  })

  it('keeps the retired blog-config snapshot shim out of the codebase', () => {
    expect(existsSync('src/shared/blog-config-snapshot.ts')).toBe(false)

    const offenders = files('src', 'tests', '-g', '*.ts', '-g', '*.tsx').filter((file) => {
      const source = readFileSync(file, 'utf8')
      return /from\s+["']@\/shared\/blog-config-snapshot["']/.test(source)
    })

    expect(offenders).toEqual([])
  })

  it('keeps blog settings provider split by section context', () => {
    const source = readFileSync('src/ui/lib/blog-config-context.tsx', 'utf8')

    // The contexts file now derives one context per `BUNDLE_KEYS`
    // entry through a `makeContext('<key>')` factory instead of 12
    // hand-written `createContext` calls. The split is still
    // per-section — we just generate the surface from the canonical
    // listing in `@/shared/settings`. Assert the derivation is in
    // place by checking the registry entries (one per section,
    // including the new `rateLimit` slot) and the absence of any
    // monolithic bundle context.
    expect(source).toContain('SECTION_CONTEXTS')
    expect(source).toContain("makeContext('siteIdentity')")
    expect(source).toContain("makeContext('cache')")
    expect(source).toContain("makeContext('rateLimit')")
    expect((source.match(/makeContext\(/g) ?? []).length).toBeGreaterThanOrEqual(12)
    expect(source).not.toContain('BlogSettingsBundleContext')
  })

  it('routes every settings form through the unified react-hook-form wrapper', () => {
    // After the unification, both `GeneralForm` (which used to wire up
    // its own `useForm` + `zodResolver`) and the simpler forms (which
    // used to keep a hand-rolled `useState<TState>` + `setSnapshot(draft)`
    // pair) go through `useSettingsForm`. RHF owns the dirty tracking
    // and the "what was submitted" baseline (`reset(getValues(), …)`
    // inside `onSaved`), which makes the previous `submittedDraftRef`
    // bookkeeping unnecessary. Guard against accidental re-introduction
    // of the old pattern.
    const source = readFileSync('src/ui/admin/settings/useSettingsForm.ts', 'utf8')

    expect(source).toContain('useForm<TState>')
    expect(source).toContain('zodResolver(schema as never)')
    expect(source).not.toContain('submittedDraftRef')
    expect(source).not.toContain('setSnapshot(')

    // Every settings form delegates to `useSettingsForm`; none of them
    // imports `useForm` directly (which would bypass the shared dirty /
    // status / save / revert pipeline). `GeneralForm` may still import
    // `useFieldArray` to drive its `keywords` array, but `useForm`
    // itself only lives in the hook.
    const formFiles = [
      'src/ui/admin/settings/AssetsForm.tsx',
      'src/ui/admin/settings/CommentsForm.tsx',
      'src/ui/admin/settings/ContentForm.tsx',
      'src/ui/admin/settings/FooterForm.tsx',
      'src/ui/admin/settings/GeneralForm.tsx',
      'src/ui/admin/settings/MailForm.tsx',
      'src/ui/admin/settings/SeoForm.tsx',
      'src/ui/admin/settings/SidebarForm.tsx',
    ]
    for (const file of formFiles) {
      const formSource = readFileSync(file, 'utf8')
      expect(formSource).toContain('useSettingsForm')
      // Direct `import { useForm } from 'react-hook-form'` would mean
      // the form is duplicating the wrapper's lifecycle.
      // `useFieldArray` is allowed (consumed via the wrapper's `form.control`).
      expect(formSource).not.toMatch(/import\s*\{[^}]*\buseForm\b[^}]*\}\s*from\s*['"]react-hook-form['"]/)
      // The wrapper's exit point: `useRevalidator` belongs to
      // `useSettingsFetcher`, which is reached through the wrapper.
      // `MailForm` is allowed to import `useFetcher` from `react-router`
      // for the secondary "send test mail" button — that channel is
      // independent of the section-update channel and shouldn't be
      // routed through `useSettingsFetcher`.
      expect(formSource).not.toMatch(/import\s*\{[^}]*\buseRevalidator\b[^}]*\}\s*from\s*['"]react-router['"]/)
    }
  })

  it('keeps non-type catalog imports out of UI components', () => {
    const offenders = files('src/ui', '-g', '*.ts', '-g', '*.tsx').filter((file) => {
      const source = readFileSync(file, 'utf8')
      return source.split('\n').some((line) => {
        const trimmed = line.trim()
        return (
          trimmed.startsWith('import') && !trimmed.startsWith('import type') && trimmed.includes('"@/shared/catalog"')
        )
      })
    })

    expect(offenders).toEqual([])
  })

  it('keeps Luxon out of client-facing chrome and date formatter paths', () => {
    const clientFacing = [
      ...files('src/ui', '-g', '*.ts', '-g', '*.tsx'),
      'src/shared/formatter.ts',
      'src/server/sidebar/select.ts',
      'src/routes/home.tsx',
    ]
    const offenders = clientFacing.filter((file) => readFileSync(file, 'utf8').includes('luxon'))

    expect(offenders).toEqual([])
  })

  it('keeps source relative imports inside the documented allowlist', () => {
    const explicitAllowed = [
      { key: 'vite.config.ts -> ./source.config.ts', file: 'vite.config.ts', specifier: './source.config.ts' },
      // Vite+'s `defineConfig({ fmt, lint })` only accepts inline objects
      // (the toolchain reads them statically — see
      // https://viteplus.dev/guide/troubleshooting). The Oxfmt/Oxlint
      // configs therefore have to be siblings of `vite.config.ts` and
      // imported with explicit relative `.ts` specifiers; aliases would
      // be resolved too late by Vite+'s config loader.
      { key: 'vite.config.ts -> ./oxfmt.config.ts', file: 'vite.config.ts', specifier: './oxfmt.config.ts' },
      { key: 'vite.config.ts -> ./oxlint.config.ts', file: 'vite.config.ts', specifier: './oxlint.config.ts' },
      {
        key: 'source.config.ts -> mermaid rehype plugin',
        file: 'source.config.ts',
        specifier: './src/server/markdown/mermaid/index.ts',
      },
      {
        key: 'source.config.ts -> rehype code wrapper',
        file: 'source.config.ts',
        specifier: './src/server/markdown/rehype-code.ts',
      },
      {
        key: 'source.config.ts -> rehype mathjax',
        file: 'source.config.ts',
        specifier: './src/server/markdown/rehype-mathjax.ts',
      },
      {
        key: 'source.config.ts -> remark collect images',
        file: 'source.config.ts',
        specifier: './src/server/markdown/remark-collect-images.ts',
      },
      {
        key: 'brand-social-icons.tsx -> icon-props',
        file: 'src/ui/icons/brand-social-icons.tsx',
        specifier: './icon-props',
      },
      {
        key: 'routes.ts -> shared API actions',
        file: 'src/routes.ts',
        specifier: './shared/api-actions',
      },
    ] as const
    const explicitAllowedHits = new Set<string>()

    const allowed = (file: string, specifier: string): boolean => {
      if (specifier.startsWith('./+types/')) {
        return true
      }

      const explicit = explicitAllowed.find((entry) => entry.file === file && entry.specifier === specifier)
      if (explicit) {
        explicitAllowedHits.add(explicit.key)
        return true
      }

      if (
        file.startsWith('src/server/markdown/mermaid/') &&
        ['./errors.ts', './parse.ts', './render.ts', './types.ts'].includes(specifier)
      ) {
        return true
      }
      return false
    }

    const offenders: string[] = []
    const importRe = /from\s+["'](\.{1,2}\/[^"']+)["']|import\(\s*["'](\.{1,2}\/[^"']+)["']\s*\)/g
    for (const file of files(
      'src',
      'source.config.ts',
      'vite.config.ts',
      'react-router.config.ts',
      '-g',
      '*.ts',
      '-g',
      '*.tsx',
    )) {
      const source = readFileSync(file, 'utf8')
      let match: RegExpExecArray | null
      while ((match = importRe.exec(source)) !== null) {
        const specifier = match[1] ?? match[2]
        if (!allowed(file, specifier)) {
          offenders.push(`${file}: ${specifier}`)
        }
      }
    }

    expect(offenders).toEqual([])
    expect(explicitAllowed.map((entry) => entry.key).filter((key) => !explicitAllowedHits.has(key))).toEqual([])
  })

  it('keeps src/routes.ts project imports relative because aliases are unavailable there', () => {
    const source = readFileSync('src/routes.ts', 'utf8')
    const importSpecifiers = [...source.matchAll(/(?:from\s+|import\(\s*)["']([^"']+)["']/g)].map((match) => match[1])
    const aliasedProjectImports = importSpecifiers.filter(
      (specifier) => specifier.startsWith('@/') || specifier.startsWith('~/') || specifier.startsWith('#source/'),
    )

    expect(aliasedProjectImports).toEqual([])
    expect(importSpecifiers).toContain('./shared/api-actions')
  })

  it('keeps DOM/script islands out of the tree (React only)', () => {
    // Public interactivity now lives in React hooks/components. Guard the
    // regression by asserting the legacy vanilla script tree stays empty.
    const legacy = files('src/assets/scripts', '-g', '*.ts')
    expect(legacy).toEqual([])
  })

  it('documents React islands instead of the removed src/assets/scripts tree', () => {
    const agents = readFileSync('AGENTS.md', 'utf8')
    expect(agents).toContain('`src/assets/scripts` is intentionally absent')
    expect(agents).not.toContain('src/assets/scripts/**/*.ts')
    expect(agents).not.toContain('Do not remove existing browser scripts')
  })

  it('keeps domain Zod schemas out of db/types', () => {
    const source = readFileSync('src/server/db/types/index.ts', 'utf8')
    expect(source).not.toContain('db/types/auth')
    expect(source).not.toContain('db/types/comment')
  })

  it('loads OPPO font CSS from public instead of the root CSS bundle', () => {
    const globals = readFileSync('src/assets/styles/public.css', 'utf8')
    const root = readFileSync('src/root.tsx', 'utf8')

    expect(globals).not.toContain('opposans.css')
    expect(globals).not.toContain('opposerif.css')
    expect(globals).not.toContain('iosevka.css')
    expect(root).toContain("href: '/fonts/opposans.css'")
    expect(root).toContain("href: '/fonts/iosevka.css'")
    expect(root).toContain("href: '/fonts/opposerif.css'")
    expect(files('public/fonts', '-g', '*.css').sort()).toEqual([
      'public/fonts/iosevka.css',
      'public/fonts/opposans.css',
      'public/fonts/opposerif.css',
    ])
  })

  it('keeps admin Tailwind layouts on flex/grid gap instead of space utilities', () => {
    const offenders = files('src/ui/admin', '-g', '*.ts', '-g', '*.tsx').filter((file) => {
      const source = readFileSync(file, 'utf8')
      return /space-[xy]-/.test(source)
    })

    expect(offenders).toEqual([])
  })

  it('keeps screen-reader helpers visually hidden instead of display-none', () => {
    // sweep deleted everything except the body typography baseline and
    // the cursor-image overrides, so the sr-only rule is no longer in
    // `reset.css` at all. Pin the rule lives in `public.css` and uses
    // the WordPress-classic 1px visually-hidden recipe (some older
    // screen readers skipped 0×0 rects, so 1px keeps belt-and-braces
    // coverage). `display: none` would hide the helper from screen
    // readers too — the assertion below explicitly bans it.
    const source = readFileSync('src/assets/styles/public.css', 'utf8')

    expect(source).not.toMatch(/\.screen-reader-text\s*\{[^}]*display:\s*none/s)
    expect(source).not.toMatch(/\.sr-only\s*\{[^}]*display:\s*none/s)
    expect(source).toMatch(/\.screen-reader-text\s*\{[^}]*clip:\s*rect\(\s*1px,\s*1px,\s*1px,\s*1px\s*\)/s)
    expect(source).toMatch(/\.screen-reader-text\s*\{[^}]*position:\s*absolute\s*!important/s)
  })

  it('does not pass hex design tokens through rgba(var(...))', () => {
    const offenders = files('src/assets/styles', '-g', '*.css').filter((file) =>
      /rgba\(\s*var\(--/.test(readFileSync(file, 'utf8')),
    )

    expect(offenders).toEqual([])
  })

  it('keeps raw arbitrary colors out of non-admin Tailwind surfaces', () => {
    const offenders = files('src/ui', 'src/routes', '-g', '*.ts', '-g', '*.tsx')
      .filter((file) => !file.startsWith('src/ui/admin/') && !file.startsWith('src/routes/admin'))
      .filter((file) => /(?:bg|text|border)-\[#/.test(readFileSync(file, 'utf8')))

    expect(offenders).toEqual([])
  })

  it('keeps Base UI select and dropdown items inside group wrappers', () => {
    const select = readFileSync('src/ui/components/ui/select.tsx', 'utf8')
    const dropdown = readFileSync('src/ui/components/ui/dropdown-menu.tsx', 'utf8')

    expect(select).toContain('<SelectGroup>{children}</SelectGroup>')
    expect(dropdown).toContain('<DropdownMenuGroup>{children}</DropdownMenuGroup>')
  })

  it('sizes Button icons through data-icon instead of hand-written size classes', () => {
    const button = readFileSync('src/ui/components/ui/button.tsx', 'utf8')
    const offenders: string[] = []

    expect(button).toContain('[&_[data-icon]]')

    for (const file of files('src/ui/admin', '-g', '*.tsx')) {
      const source = readFileSync(file, 'utf8')
      for (const chunk of source.split(/<Button\b/).slice(1)) {
        const end = chunk.indexOf('</Button>')
        if (end === -1) {
          continue
        }
        const block = chunk.slice(0, end)
        if (/<[A-Z][A-Za-z0-9]*Icon\b[^>]*className=["'][^"']*size-/.test(block)) {
          offenders.push(file)
          break
        }
      }
    }

    expect(offenders).toEqual([])
  })

  it('forbids template-literal `className=` strings under src/ui in favour of cn()', () => {
    // Hand-rolled `className={`a ${x ? 'b' : ''}`}` patterns silently
    // produce stray spaces, miss the dedupe `tailwind-merge` provides,
    // and bypass the `` prefix audit. `cn()` (`@/ui/lib/cn`)
    // handles all three. The matcher excludes `${ctx.placement}` style
    // *interpolated suffixes* in tooltip placement keys etc., which
    // legitimately read better as a single template — those callers
    // wrap the placement substitution in `cn()` (see Tooltip.tsx) so
    // the *outer* attribute itself is no longer a bare template.
    const offenders: string[] = []
    for (const file of files('src/ui', '-g', '*.tsx')) {
      const source = readFileSync(file, 'utf8')
      // Match `className={` immediately followed by a backtick. Any
      // call site that wraps the template in `cn(`…`)` already starts
      // with `className={cn(` and is exempt.
      if (/className=\{`/.test(source)) {
        offenders.push(file)
      }
    }

    expect(offenders).toEqual([])
  })

  it('keeps the wp-decoy status text mirrored between server and ErrorView', () => {
    // `src/ui/post/ErrorView.tsx` lives under `src/ui/` so it may not
    // import from `src/server/`. The literal `'Not WordPress'` is
    // duplicated so the UI module stays boundary-clean; this test makes
    // sure the two copies agree.
    const server = readFileSync('src/server/route-helpers/wp-decoy.ts', 'utf8')
    const ui = readFileSync('src/ui/post/ErrorView.tsx', 'utf8')

    expect(server).toContain("export const NOT_WORDPRESS_STATUS_TEXT = 'Not WordPress'")
    expect(ui).toContain("const NOT_WORDPRESS_STATUS_TEXT = 'Not WordPress'")
  })

  it('keeps solution math scrollable instead of clipping long formulas', () => {
    // The post-detail partial moved next to the consuming components
    // (see `public.css` — `@import '@/ui/post/post.css';`). The
    // assertions stay the same; only the source path moved.
    const source = readFileSync('src/assets/styles/public.css', 'utf8')

    expect(source).not.toMatch(/\.post-content \.solution\s*{[^}]*overflow:\s*hidden/s)
    expect(source).toContain(".post-content mjx-container[jax='SVG'][display='true']")
    expect(source).toContain('overflow-x: auto')
  })
})
