// Single source of truth for the JSON envelope every Resource Route emits
// (see `src/routes/_shared/api/handler.server.ts`'s `ok` / `fail`). Browser
// islands use `useApiFetcher` from `@/client/api/fetcher` to consume it,
// and `ApiEnvelope<T>` is re-exported from there for convenience.
export interface ApiEnvelope<T> {
  data?: T
  error?: { message: string }
}
