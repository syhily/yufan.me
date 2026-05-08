// Shared post-domain chrome utility chains. These are inlined-CSS
// equivalents of the legacy `.post-title` / `.post-meta` rules
// stays a single named export rather than being inlined verbatim
// at every consumer for two reasons:
//
//   1. The five `<h1>` consumers (PostDetailBody, PageDetailBody,
//      CategoriesBody, ArchivesBody, PostListViews) need byte-
//      identical typography or the cross-page navigation header
//      jitters. A single constant prevents drift when one site
//      gets a tweak and the others lag behind.
//      for `<h1>`–`<h6>`) will rewrite this chain in one place
//      rather than chasing five inlined call sites.
//
// The legacy ladder (`1.5rem` base / `1.625rem` at `md` only /
// `1.75rem` at `lg`+) is preserved verbatim — `md:max-lg:` is
// the Tailwind v4 native expression of `(min-width: 768 px) and
// (max-width: 991.98 px)`. None of the values map cleanly to a
// project text-token (`--text-2xl: 1.625rem` is the only direct
// match), so all three steps stay as arbitrary literals; the
// time it converts the matching `.post-content h1`-`h6` ladder
// to `clamp()`.
//
// Each chain leads with the legacy class literal (`post-title`,
// `post-meta`, `post-meta-date`, `post-meta-tags`) so downstream
// WordPress-compat templates and admin tooling keep their
// selector anchors. The literals carry no styling responsibility
// any more (the partial rules retired this stage); a contract
// test in `tests/contract.boundaries.test.ts` pins both the
// "no partial may reintroduce these rules" and "no JSX may drop
// these literals" invariants — same model as the comment-tree

export const postTitleClass = 'post-title text-[1.5rem] md:max-lg:text-[1.625rem] lg:text-[1.75rem]'

// `.post-meta` row holds the publish date on the left and the
// inline-tag chips on the right. Below the `md` breakpoint the row
// flips to a stacked column so the tag chips wrap to a fresh line
// rather than squeezing the date. `gap-x-4 gap-y-3` reproduces the
// legacy `gap: 0.75 rem 1 rem` shorthand (row, column).
export const postMetaClass = 'post-meta flex items-start gap-x-4 gap-y-3 max-md:flex-col max-md:gap-2.5'

// Date `<time>` cell. `flex-none` locks the cell to its content
// width so the right-aligned tag list keeps its `flex: 1 1 auto`
// behaviour. The `leading-7` (= 1.75 rem) on the default state
// matches the inline-flex tag chips' line-height so the row
// baseline stays flush; below `md` we drop to `leading-normal` (=
// 1.5) because the row stacks and the row baseline alignment is
// no longer relevant.
export const postMetaDateClass = 'post-meta-date flex-none leading-7 max-md:leading-normal'

// Inline tag list. `flex-1` claims the right side of `.post-meta`,
// `justify-end` right-aligns the chips at `>=md`, `min-w-0`
// guarantees the chips can wrap inside the flex container, and
// `ml-auto` keeps the chips pinned right when there's only one
// chip (otherwise the chip would centre under `justify-end`).
// Below `md` the chips left-align (`justify-start`), claim the
// row width (`w-full`), and reset `ml-auto` to `ml-0` so the
// stacked column lays out from the leading edge.
export const postMetaTagsClass =
  'post-meta-tags ml-auto flex min-w-0 flex-1 flex-wrap justify-end gap-2 ' +
  'max-md:ml-0 max-md:w-full max-md:justify-start max-md:gap-x-2.5 max-md:gap-y-2'
