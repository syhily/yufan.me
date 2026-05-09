import { deriveSlug } from '@/server/slug'

// Compatibility shim. The canonical implementation now lives in
// `@/server/slug`; this re-export stays so the seeder script and
// long-standing service callers don't churn import paths.
//
// The pipeline is unchanged externally — `pinyin-pro` lowercases
// CJK to syllables, `github-slugger` produces the kebab-case form —
// but the helper now goes through the project-wide `deriveSlug`
// pass so tag, category, page, and heading slugs all share one
// deterministic algorithm.
export function derivedTagSlug(name: string): string {
  return deriveSlug(name)
}
