# Hono + ts-rest Spike Notes

Decision: **go**. The approach works in this project.

## Dev Experience

- HMR works through `react-router-hono-server` v2.26.0 + Vite+
- `vp dev` starts via Hono entry; existing URLs still reachable
- HMR speed comparable to pre-migration (sub-second for route changes)

## Build

- Client build: unchanged (~4.5s)
- Server build: Hono entry produces `build/server/index.js` (~1.8KB)
- React Router SSR bundle: `build/server/assets/server-build.js` (~1.7MB)
- No significant size regression

## Pitfalls

1. **Zod v4 compatibility**: `@ts-rest/core@3.53.0-rc.1` drops the zod peer dep — works natively with Zod v4. Earlier versions required `--legacy-peer-deps`.
2. **RouterContextProvider**: With `v8_middleware: true`, `createRequestHandler` expects `RouterContextProvider` instance, not a plain object. The entry creates one with `sessionContext`/`requestContext`.
3. **`import type` vs `import`**: `expectTypeOf` from vitest requires runtime values — use regular `import`, not `import type`.
4. **Hono path param naming**: `:slug.png` creates param named `slug.png`, not `slug`. Handlers must strip the extension.
5. **Controller type safety**: `ContractImpl` is deliberately loose (`Record<string, any>`) due to Zod v3/v4 type differences. Runtime validation via Zod schemas compensates.

## Bundle Size

- `apiContract` adds Zod schemas to client bundle
- Estimated <50KB gzipped for full contract tree
- Future: can split into `apiContractPublic` / `apiContractAdmin` if needed

## Go / No-Go

**Go**. The Hono + ts-rest architecture is production-ready. Backward compatibility is maintained via 308 redirects and `resolveId()` body/query fallback.
