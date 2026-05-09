import GithubSlugger from 'github-slugger'
import { pinyin } from 'pinyin-pro'

// Single canonical slug helper for the entire blog. The pipeline is
// `pinyin-pro` → `github-slugger`:
//
//   1. `pinyin(text)` rewrites every CJK glyph to its Hanyu Pinyin
//      ASCII syllables ("编程" → "bian cheng"), leaves ASCII +
//      whitespace + punctuation untouched, and groups runs of
//      non-Han characters into a single chunk (`nonZh: 'consecutive'`).
//      We strip tones (`toneType: 'none'`) because slugs are
//      case-insensitive ASCII; tone diacritics would either round-trip
//      through `github-slugger`'s lower-case + collapse pass losslessly
//      or get lost depending on locale, and the tone signal is rarely
//      worth the URL noise.
//   2. `GithubSlugger().slug(text)` is the same algorithm
//      `rehype-slug` uses on the historical MDX path: lowercases,
//      collapses runs of non-alphanumerics into `-`, trims leading /
//      trailing dashes, and Unicode-folds. Routing through it after
//      pinyin means a Han-text input and an ASCII input go through
//      ONE deterministic pass, so MDX-time anchors and DB-time
//      tag/category slugs cannot drift.
//
// The helper deliberately allocates a fresh slugger per call so it
// is *stateless* (no cross-call dedup memory) — callers that need
// "first heading wins, second becomes -1" semantics keep their own
// slugger instance (see `collectHeadings`).
//
// Lives under `src/server/` (not `src/shared/`) because `pinyin-pro`
// ships ~150KB of CJK lookup tables and must not reach the client
// bundle. The module surface is a pure function + two constants so
// callers can import without paying for transitive setup.
//
// **Do not memoize** here; admin callers translate one or two names
// per request and the cost is negligible (~<1ms). Heading-anchor
// callers walk linearly with their own slugger anyway. A global LRU
// would invite stale-data bugs the moment we tweak the pipeline.

// `pinyin-pro`'s default overload returns a `string`. We keep the
// options object inline so TypeScript picks that overload (the
// `type: 'string'` literal collides with the discriminated overload
// types in the package's `.d.ts`).
//
// Three normalisation quirks the helper has to paper over before
// the result satisfies `SLUG_PATTERN`:
//
//   1. With `nonZh: 'consecutive'`, pinyin-pro keeps every
//      non-Chinese character verbatim AND adds its own separator on
//      each side of the Han run. So "Web 开发" becomes "Web  kai fa"
//      (two spaces between `Web` and `kai`) — we collapse runs of
//      whitespace into one before slugging.
//   2. `github-slugger.slug()` lowercases + replaces a curated set
//      of "control" punctuation with `-`, but it preserves dashes
//      literally. So an input of `--foo--bar--` round-trips as
//      `--foo--bar--`. We collapse runs of dashes and trim leading /
//      trailing dashes after the slugger pass for a canonical shape.
//   3. Inputs whose alpha-numeric content is empty (emoji-only,
//      whitespace-only) yield an empty string. The helper returns
//      `''` so callers can distinguish "no slug derivable" from
//      a legitimate slug; the call sites that hit user-supplied
//      input (category / page service) translate that into a
//      friendly 400.
export function deriveSlug(text: string): string {
  const romanised = pinyin(text, {
    toneType: 'none',
    separator: ' ',
    nonZh: 'consecutive',
  })
  const collapsedSpaces = romanised.replace(/\s+/g, ' ').trim()
  const slugged = new GithubSlugger().slug(collapsedSpaces)
  return slugged.replace(/-+/g, '-').replace(/^-|-$/g, '')
}

// Slug pattern shared across schemas (`tag`, `category`, `page`).
// Lowercase ASCII alphanumerics + `-`, no leading / trailing dash,
// no double dash. Matches `github-slugger` output one-for-one — any
// `deriveSlug(text)` value that's non-empty satisfies this regex,
// so the pattern is BOTH the validation envelope for user-supplied
// slugs AND the post-condition of the helper.
export const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

// Hard ceiling on slug length. 80 matches the existing per-table
// schemas (`tag.slug`, `category.slug`, `pageMeta.slug`) so callers
// can validate against this constant instead of repeating the
// magic number. The pinyin expansion of a 20-character Han title
// can run ~80 ASCII characters, which is exactly the budget.
export const SLUG_MAX = 80
