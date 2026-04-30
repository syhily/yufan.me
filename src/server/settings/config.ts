import type { BlogConfig } from '@/blog.config'

// Server-side re-export of the shared blog-config Proxy.
//
// Server callers historically reached `config.title` / `config.settings.x`
// via `import config from '@/blog.config'`. This module preserves the
// same call shape but reads through the live settings snapshot — so the
// returned values reflect admin edits without a redeploy.
//
// The actual Proxy implementation lives in `@/shared/blog-config-proxy`
// because some server modules (notably `@/server/seo/meta`) are reached
// from route `meta()` exports that also run on the client. Putting the
// reader in `@/shared/` keeps the client bundle free of `pg` /
// `drizzle-orm` while still letting SSR see the live values.
//
// Importing from `@/server/settings/config` (instead of directly from
// `@/shared/blog-config-proxy`) signals reviewer intent: the caller is
// server-only and may freely use any field. UI/shared modules should
// instead use the `BlogConfigContext` / `useBlogConfig()` hook so they
// can stay in the client bundle.
export { default } from '@/shared/blog-config-proxy'
export { type BlogConfig }
