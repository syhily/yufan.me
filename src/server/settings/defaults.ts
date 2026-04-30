// Server-facing re-export of the seed values. The literals live in
// `@/shared/blog-defaults` so the client bundle (and the static
// `blog.config.ts` shim used by `BlogConfigContext` as a fallback) can
// reach the same canonical definitions without crossing the
// shared → server boundary.
export { BLOG_CONSTANTS, type BlogConstants, type BlogSettings, DEFAULT_SETTINGS } from '@/shared/blog-defaults'
