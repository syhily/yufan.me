// `API_ACTIONS` lives under `@/shared/api-actions` so both the server
// bundle (e.g. `server/listing.ts` checks `formAction` against the
// comment endpoints) and the client bundle (`useApiAction`,
// `useApiStream`) can import the same literal manifest without
// crossing the RSC boundary. This module is the historical client
// entry point and only re-exports the same surface so existing
// browser-side imports (`@/client/api/actions`) keep compiling.
export { API_ACTIONS, API_ACTION_LIST, type ApiActionMethod } from '@/shared/api-actions'
