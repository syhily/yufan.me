export type CatalogEntryType = 'page' | 'post'

export interface CatalogEntry {
  type: CatalogEntryType
  id: bigint
  slug: string
}

export interface CatalogSnapshot {
  bySlug: ReadonlyMap<string, CatalogEntry>
  posts: ReadonlyArray<CatalogEntry>
  pages: ReadonlyArray<CatalogEntry>
  builtAt: Date
}

export class CatalogConsistencyError extends Error {
  readonly conflicts: Array<{ slug: string; entries: CatalogEntry[] }>
  constructor(conflicts: Array<{ slug: string; entries: CatalogEntry[] }>) {
    const summary = conflicts
      .slice(0, 5)
      .map((c) => `${c.slug}: ${c.entries.map((e) => `${e.type}#${e.id}`).join(' vs ')}`)
      .join('; ')
    super(`Catalog slug fence violation: ${summary}`)
    this.name = 'CatalogConsistencyError'
    this.conflicts = conflicts
  }
}
