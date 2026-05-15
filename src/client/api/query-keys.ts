/**
 * Centralised TanStack Query key factory.
 *
 * Every query key used across the admin UI lives here so mutations can
 * invalidate the correct scopes without hand-keeping string arrays in
 * multiple files.
 */

export const queryKeys = {
  admin: {
    images: (q: string, kind: string, page: number, pageSize: number) =>
      ['admin', 'images', q, kind, page, pageSize] as const,
    imagesList: (q: string) => ['admin', 'images', q] as const,
    comments: (userId?: string) => ['admin', 'comments', userId] as const,
    pending: (offset: number, limit: number) => ['admin', 'pending', 'all', offset, limit] as const,
  },
  comment: {
    searchPages: (q: string) => ['comment-search-pages', q] as const,
    searchAuthors: (q: string) => ['comment-search-authors', q] as const,
    rehydrateAuthor: (id: string | undefined) => ['comment-rehydrate-author', id] as const,
    rehydratePage: (key: string | undefined) => ['comment-rehydrate-page', key] as const,
    raw: (id: string) => ['comment-raw', id] as const,
  },
  analytics: {
    metrics: (
      type: string | null,
      preset: string | null,
      startAt: number,
      endAt: number,
      filters: Record<string, unknown>,
    ) => ['analytics', 'metrics', type, preset, startAt, endAt, filters] as const,
  },
} as const
