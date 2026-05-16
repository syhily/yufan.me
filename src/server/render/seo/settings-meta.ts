import { bundleFromMatches, routeMeta } from '@/server/render/seo/meta'

/**
 * Factory for the `meta` export in settings section routes.
 * Replaces the repetitive 3-line `meta` function in each route:
 * ```ts
 * import { bundleFromMatches, routeMeta } from '@/server/render/seo/meta'
 * export function meta({ matches }: Route.MetaArgs) {
 *   return routeMeta({ title: '...' }, bundleFromMatches(matches))
 * }
 * ```
 * with a single `export const meta = settingsMeta('...')`.
 */
export function settingsMeta(title: string) {
  return ({ matches }: { matches: readonly unknown[] }) => routeMeta({ title }, bundleFromMatches(matches))
}
