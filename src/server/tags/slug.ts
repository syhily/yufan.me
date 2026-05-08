import { pinyin } from 'pinyin-pro'

// Server-side counterpart of the compile-time slug helper that used
// to live in `source.config.ts`. Outputs the same kebab-case ASCII
// form `slugSchema` validates so admin-created (and CLI-seeded) tags
// share the URL shape authors get from `pinyin-pro` at MDX build
// time.
//
// Lives in its own module (instead of `service.ts`) so the one-shot
// seeder script can import it without dragging in
// `ContentCatalog`/`#source/server` through the service file.
export function derivedTagSlug(name: string): string {
  return pinyin(name, {
    toneType: 'none',
    separator: '-',
    nonZh: 'consecutive',
    type: 'string',
  })
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}
