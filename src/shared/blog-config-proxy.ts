import { type BlogConfigSnapshot, getBlogConfigSync } from '@/shared/blog-config-snapshot'

// Drop-in replacement for the historical `import config from '@/blog.config'`
// shape. Reads always go through `getBlogConfigSync()` so callers see
// the live in-process snapshot — on the server the latest DB-backed
// values, on the client the seed defaults.
//
// Lives in `@/shared/` (not `@/server/`) because some consumers (notably
// `@/server/seo/meta`, which is reached from route `meta()` exports)
// end up in the client bundle. Anything reaching for `pg` / `drizzle-orm`
// transitively from those entry points would crash with
// `Buffer is not defined` in the browser.

const handler: ProxyHandler<BlogConfigSnapshot> = {
  get(_target, prop, receiver) {
    return Reflect.get(getBlogConfigSync(), prop, receiver)
  },
  has(_target, prop) {
    return Reflect.has(getBlogConfigSync(), prop)
  },
  ownKeys(_target) {
    return Reflect.ownKeys(getBlogConfigSync())
  },
  getOwnPropertyDescriptor(_target, prop) {
    return Reflect.getOwnPropertyDescriptor(getBlogConfigSync(), prop)
  },
}

const config = new Proxy({} as BlogConfigSnapshot, handler)

export default config
export { type BlogConfigSnapshot }
