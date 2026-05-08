// Canonical IANA / tzdata timezone list, sourced from the runtime's
// own bundled tzdata via `Intl.supportedValuesOf('timeZone')` (an
// ECMAScript 2022 standard, available in Node 18+ and every modern
// browser). Centralising the call here keeps:
//
//   1. The list out of the client bundle — only callers that are server
//      modules (loaders, schema validators) reach for it; UI surfaces
//      receive the resulting `string[]` as a prop.
//   2. The cost paid once per process — `supportedValuesOf` does the
//      Unicode CLDR lookup eagerly, so we cache the array and a `Set`
//      view alongside it for O(1) membership checks in the schemas.
//   3. The data fresh — Node ships an updated tzdata with every minor
//      release, so a runtime upgrade automatically refreshes the
//      offered options without any code change here.
//
// We deliberately do NOT bundle `tzdata` from npm: keeping the runtime
// as the single source of truth means the dropdown can never offer a
// zone the runtime would later reject, which is the failure mode the
// dropdown was added to prevent.

const ZONES: readonly string[] = Object.freeze([...Intl.supportedValuesOf('timeZone')].sort())
const ZONE_SET: ReadonlySet<string> = new Set(ZONES)

export function getSupportedTimeZones(): readonly string[] {
  return ZONES
}

export function isSupportedTimeZone(value: string): boolean {
  return ZONE_SET.has(value)
}
