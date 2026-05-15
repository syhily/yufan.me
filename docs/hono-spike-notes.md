# Phase A1 spike — Hono + ts-rest landing notes

Spike run date: 2026-05-14. Spike scope is defined in
`docs/hono-api-migration-plan.md` Part 14.

## TL;DR — Recommendation: **GO (with stipulations)**

The architecture survives contact with the codebase. Types compile,
all 782 existing tests pass, production build succeeds, and a
standalone Hono server boots and serves `/api/account/profile` end
to end (401 unauth path verified; 200 path requires a real
authenticated session). One genuine ts-rest type-inference issue
needs a workaround at the contract authoring layer; nothing else
required redesign.

The plan's Phase A2–A6 ordering is safe to proceed with. Do **not**
attempt to migrate any client call sites or kill the existing
`routes/api/actions/**` shim until Phase A3 (session middleware
swap) is shipped — the new perimeter currently runs in parallel,
not as a replacement.

## What was actually built

| Piece | Path | State |
|---|---|---|
| Contract foundation | `src/shared/contracts/_base.ts`, `_errors.ts`, `_types.ts`, `index.ts` | Done |
| First domain contract | `src/shared/contracts/account.ts` (1 endpoint: `updateProfile`) | Done |
| ts-rest → Hono adapter | `src/server/http/ts-rest-adapter.ts` | Done, ~230 lines |
| RBAC guard factories | `src/server/http/guards.ts` (`publicRoute`/`authedRoute`/`adminRoute`/`authorRoute`/`roleRoute`) | Done |
| Error mapper | `src/server/http/errors.ts` (HTTPException/ActionFailure/DomainError/ZodError → unified envelope) | Done |
| App assembly | `src/server/http/app.ts` (`createApiApp()` — single permission-matrix file) | Done |
| OpenAPI doc | `src/server/http/openapi.ts` + `/docs` Swagger UI (dev-only) | Done |
| Account controller | `src/server/http/controllers/account.controller.ts` | Done, service layer untouched |
| Hono entry skeleton | `src/entry/server.node.ts` | Standalone-only (not yet wired into Vite dev / `react-router-serve`) |
| Client SDK | `src/client/api/client.ts`, `error.ts`, `unwrap.ts` | Done; no call-site migrated (call-site swap belongs to Phase B1) |

## Verifications

| Step | Outcome |
|---|---|
| `vp fmt` | Clean, 765 files |
| `vp lint` (oxlint) | 0 warnings, 0 errors |
| `vp run typecheck` (`react-router typegen && tsc`) | 0 errors |
| `vp test run` | 106 files / 782 tests passed |
| `vp build` (client + SSR) | Built in 1.18s, no new bundle warnings; `build/server/index.js` 1,743 kB (366 kB gz), no regression |
| `HONO_STANDALONE=1 vite-node src/entry/server.node.ts` | Listens on `:4378`, DB migrations ran, ready |
| `PATCH /api/account/profile` (no session) | `401 {"error":{"message":"需要登录后再操作。"}}` ✓ |
| `GET /openapi.json` | Valid OpenAPI 3.0.2 document with 1 path / 9 status codes |
| `GET /docs` | Swagger UI 200 OK |

## Genuine spike findings — track these

### 1. Dep-resolution: zod v4 ↔ ts-rest peer-dep mismatch

`@ts-rest/open-api@3.52.1` (latest stable) hard-pins peer
`zod ^3.22.3`; the project is on Zod 4. `@ts-rest/core@3.53.0-rc.1`
dropped the zod peer pin entirely, and at runtime works against
Zod 4 in this codebase — but `@ts-rest/open-api@3.53.0-rc.1`
**still** declares the v3 peer. Installation requires
`--legacy-peer-deps` until upstream cuts a stable 3.53 with the
peer adjustment.

**Action for Phase A2**: pin `@ts-rest/core` and `@ts-rest/open-api`
to the same `3.53.0-rc.*` version, and add a CI guard that watches
for upstream stable. Do **not** try to downgrade Zod — the project
relies on Zod 4 features (`z.url()` without `.string()` first,
`z.coerce` semantics, `safeParseAsync` shape).

### 2. ts-rest spread-erasure bug for `responses` map

Spreading an `as const`-typed error-response group (e.g.
`{ 200: ok, ...standardMutationErrors }`) loses the numeric
literal keys at TS inference time. The resulting
`keyof T['responses']` collapses to just the inline keys (here:
`200`), so `ServerInferResponses<R, _, 'force'>` discards every
error branch and `strictStatusCodes` becomes unusable. Reproduced
on `@ts-rest/core@3.53.0-rc.1` + TS 6.0 + Zod 4. Most likely lives
in the StandardSchemaV1 conversion path that 3.53 introduced.

**Workaround adopted**: contracts **inline every status code**
(`400: errorResponse, 401: errorResponse, …`) rather than spread a
shared group. See `src/shared/contracts/account.ts` for the
pattern. `_errors.ts` exposes two helper *functions*
(`standardMutationErrorResponses()` /
`standardReadErrorResponses()`) rather than `as const` objects, so
the call site can be tightened later without a contract-file
rewrite. The functions are not actually called yet — every
contract spells the responses inline. We can revisit once upstream
fixes the regression.

**Action for Phase B1**: include this finding in the contract
authoring style guide and add a contract-shape lint check.

### 3. ts-rest path-prefix breaks `ContractImpl` assignability

Applying `pathPrefix: '/api'` in the aggregator
(`shared/contracts/index.ts`) rewrites `R['path']` through
`RecursivelyApplyOptions`. The resulting type for
`apiContract.account.updateProfile.path`
(`'/api/account/profile'`) is no longer structurally compatible
with `accountContract.updateProfile.path` (`'/account/profile'`),
so a controller typed `ContractImpl<typeof accountContract>` will
not mount through `apiContract.account`.

**Workaround adopted**: drop `pathPrefix` from the contract tree;
mount `createApiApp()` at `/api` in `src/entry/server.node.ts`.
Documented in `shared/contracts/index.ts`. This costs nothing —
the path prefix was a string-template convenience for OpenAPI, not
a routing requirement.

### 4. Strict relative-import boundary test must be kept green

`tests/contract.boundaries.test.ts` enforces that every project
import goes through the `@/` alias (with a tiny explicit
allowlist). All new files were initially flagged and fixed; future
PRs adding files under `server/http/**` /
`shared/contracts/**` must follow the same rule. No allowlist
entries were added — the new tree is strictly `@/`.

### 5. `import.meta.env` in `session-storage.ts` blocks
non-Vite execution

`src/server/auth/session-storage.ts` reads
`import.meta.env.PROD`. A plain Node + `tsx` invocation of
`src/entry/server.node.ts` crashes with
`TypeError: Cannot read properties of undefined (reading 'PROD')`.
The spike worked around this with `vite-node`, which polyfills the
field.

**Action for Phase A2**: when wiring the production launcher,
build through Vite SSR (the existing `vp build` output already
populates `import.meta.env.PROD = true`) so the runtime entry runs
out of `build/server/`, not raw TS. Do not factor the env access
into a top-level `process.env.NODE_ENV` — `import.meta.env` is the
project's documented isomorphic env channel.

### 6. ts-rest 3.53's schema slot is StandardSchemaV1, not raw Zod

`AppRouteResponse` is now
`z.ZodSchema | StandardSchemaV1<any> | ContractPlainType<unknown> | ContractNullType | null`.
The adapter must not assume `parse` exists. Current implementation
ships a `asZod()` shim that admits anything with `parse`, falling
back to a passthrough. Good enough for the spike; Phase A4 should
extend it to call StandardSchemaV1's `'~standard'.validate` for
non-Zod schemas if the contracts ever introduce them.

### 7. RR Vite dev integration is deliberately deferred

The plan's Phase A1 deliverable included swapping the Vite dev
server entry through `react-router-hono-server`. The spike did
**not** do this — installing it carries non-trivial HMR risk and
the React Router 7.15 + Vite+ 0.1.21 + Vite 8 stack here is
unusual (vite is overridden to `@voidzero-dev/vite-plus-core`).
The Phase A2 PR should:

1. Add `react-router-hono-server` as a dev dep.
2. Wire it into `vite.config.ts` as a plugin with
   `serverEntryPoint: 'src/entry/server.node.ts'`.
3. Validate `vp dev` HMR for: a page route, a route loader, a
   stylesheet edit. The plan's Part 12 risk matrix flags this
   integration as "medium probability, low impact" — keep it that
   way by isolating it to its own PR.
4. Update `package.json` `start`/`build` scripts to point at the
   Hono runtime when the integration is stable.

### 8. Compatibility shim: `/api/actions/**` is **still alive**

Phase A1 deliberately leaves the existing RR-based resource
routes serving `/api/actions/account/updateProfile` (and the other
91 endpoints) untouched. The Hono entry runs at port 4378 in
parallel and does **not** intercept React Router's `/api/actions/**`
routes. **Nothing in the public site or wp-admin SPA currently
talks to the new perimeter.** This is correct for a spike — call
sites migrate in Phase B, one domain at a time.

## What the spike intentionally did NOT do

- Migrate any client call site. `src/ui/admin/my/MyProfileView.tsx`
  still uses the legacy `useFetcher` + `API_ACTIONS.account.updateProfile`
  pattern. The new ts-rest client is built but unused.
- Swap the Vite dev server / production launcher entry. The current
  app still runs through `@react-router/serve` and serves
  `/api/actions/**` via RR resource routes.
- Migrate session, CSRF, install-gate, or wp-decoy middleware to
  Hono. The Hono entry has a minimal placeholder session reader
  but does **not** commit-on-mutate; that is Phase A3.
- Touch the `AGENTS.md` "RSC Layering Rules" or the `routes.ts`
  manifest. Both will need updates in Phase D2 / D1 respectively.
- Add contract / type / e2e tests for the contract tree. Phase A6
  / D3 own those.

## Files added (relative to `feature/hono-migration` branch base)

```
src/client/api/client.ts
src/client/api/error.ts
src/client/api/unwrap.ts
src/entry/server.node.ts
src/server/http/app.ts
src/server/http/context.ts
src/server/http/controllers/account.controller.ts
src/server/http/errors.ts
src/server/http/guards.ts
src/server/http/openapi.ts
src/server/http/ts-rest-adapter.ts
src/shared/contracts/_base.ts
src/shared/contracts/_errors.ts
src/shared/contracts/_types.ts
src/shared/contracts/account.ts
src/shared/contracts/index.ts
docs/hono-spike-notes.md   ← this file
```

Plus `package.json` / `package-lock.json` for the new deps:
`hono`, `@hono/node-server`, `@hono/swagger-ui`, `@ts-rest/core`,
`@ts-rest/open-api`. All installed with
`--legacy-peer-deps` (see Finding §1).

## Open questions for the team before Phase A2

1. **Bundle policy for the client `apiContract`**: the contract
   tree currently imports `accountContract` only. When all 92
   endpoints land, do we keep one `apiContract` and rely on Vite
   tree-shaking to drop unused branches from the public bundle, or
   split into `apiContractPublic` / `apiContractAdmin` as the plan
   Part 7.1 suggests? Decide before B5 (`comment` domain), which
   is the first time the public site actively imports from the
   tree.

2. **OpenAPI hosting**: Swagger UI is dev-only behind the
   `process.env.NODE_ENV !== 'production'` gate. Do we also want
   it on staging behind an admin-role check? If yes, the gate
   moves into a `roleRoute` mount and we need to decide whether
   the spec content is itself admin-only.

3. **`@ts-rest/open-api` peer-dep status**: monitor upstream. If
   they cut a stable 3.53 with Zod-4-compatible peer dep before
   B1 lands, we drop `--legacy-peer-deps` and the install becomes
   clean.

4. **Standalone-vs-integrated entry point**: should
   `src/entry/server.node.ts` keep its "run me directly with
   vite-node" affordance after Phase A2, or strip it to a pure
   `createServer()` factory once the Vite dev plugin owns the
   process? Keeping it costs nothing and gives us an
   `npm run hono:standalone` debug path that bypasses RR — useful
   when investigating SSR vs API issues in isolation.
