# Architecture & Code Quality Review (Third Pass)

**Date**: 2026-05-18
**Reviewer**: Strict Architect Re-Audit
**Previous Score**: 86 / 100

---

## Improvements Since Second Review

| Previous Issue | Status | What Changed |
|---|---|---|
| P0-1: Settings controller raw `Error` | **Fixed** | Now throws `ORPCError('BAD_REQUEST', { message, data })` with structured issues |
| P0-2: Pages `isCatalogVisible` missing `publishedRevisionId` | **Fixed** | Both copies in `repo.ts` and `service.ts` now check `publishedRevisionId` |
| P0-3: Posts defense-in-depth filter | **Fixed** | Removed the misleading `.filter()` — SQL is authoritative |
| P1-4: Hardcoded `'未登录'` | **Fixed** | `requireRole` now uses `ErrorMessages.UNAUTHORIZED` |
| P1-5: Silent `.catch(() => undefined)` | **Fixed** | All three sites now `log.warn` with structured context |
| P1-6: Copy-pasted helpers | **Fixed** | Extracted `canonicalizeBodyOrThrow` + `extractZodIssues` to `content/save-helpers.ts` |
| P2-10: Raw `Error` in `content/repo.ts` | **Fixed** | Now throws `DomainError('NOT_FOUND', ...)` |
| Import cycle (`pt/schema` ↔ `pt/utils`) | **Fixed** | Types moved to `schema.ts`; callers import functions from `@/shared/pt/utils` directly |
| Relative imports | **Fixed** | All non-`+types` relative imports converted to `@/` aliases |
| Pre-existing type errors | **Fixed** | `pool.ts`, `leaked-response.ts`, `PageBodyEditor.tsx` — 0 errors, 0 warnings |

**Score impact**: All P0 and P1 issues resolved. Baseline rises from 86 → ~92.

---

## Remaining Issues

### P1-1: `rateLimit` probe in `snapshot.ts` only checks 4 of 9 buckets

`src/server/domains/settings/snapshot.ts:163`:
```ts
const buckets = ['signInIp', 'commentPostIp', 'commentPostEmail', 'likeIncreaseIp'] as const
```

The probe validates only 4 rate-limit buckets, but `rateLimitDefaults` in `sections.ts` defines 9: `signInIp`, `commentPostIp`, `commentPostEmail`, `likeIncreaseIp`, `inviteIp`, `inviteEmail`, `passwordResetIp`, `passwordResetEmail`, `passwordResetTarget`. Missing any of these means an admin save that corrupts a newer bucket (or a legacy row missing one) passes the probe and enters the bundle — then the rate-limit middleware reads an `undefined` bucket and the throttle silently degrades to "no limit" instead of falling through to the backfill path.

**Fix**: Derive the bucket list from `CACHE_BUCKET_IDS`-style constant exported from the rate-limit schema, or enumerate all 9 keys.

### P1-2: `auth/repo.ts` is 345 lines mixing data access with orchestration

The file contains:
- Raw data access (HSET, HGETALL, DEL, pipeline) — correct for `repo.ts`
- Orchestration: `listSessionsByUser` (orphan detection + cleanup), `listAllSessions` (SCAN loop + user join), `filterLiveSidsAndCleanOrphans` (cross-reference existence check)

Per AGENTS.md's locked vocabulary (`schema.ts / repo.ts / service.ts`), `repo.ts` should be lean data access; orchestration belongs in `service.ts`. The orphan-cleanup logic in particular has side effects (lazy DEL/SREM) that belong in a service layer.

**Fix**: Extract `listSessionsByUser`, `listAllSessions`, and `filterLiveSidsAndCleanOrphans` to a `service.ts` or rename the module to acknowledge the hybrid role.

### P1-3: `content/schema.ts` uses inline `import()` type expressions

`src/server/domains/content/schema.ts:20-21, 27-28`:
```ts
| { status: 'saved'; row: import('@/server/infra/db/types').ContentRow }
```

Inline `import()` types work but are inconsistent with the codebase pattern (dedicated `import type` at the top). Four occurrences.

**Fix**: Add a top-level `import type { ContentRow } from '@/server/infra/db/types'` and use the short name.

### P1-4: `openapi-docs.ts` loads external scripts from `unpkg.com` without SRI

`src/server/render/openapi-docs.ts:13-14`:
```html
<script src="https://unpkg.com/@stoplight/elements/web-components.min.js"></script>
<link rel="stylesheet" href="https://unpkg.com/@stoplight/elements/styles.min.css">
```

No `integrity` or `crossorigin` attributes. While dev-only, the OpenAPI docs page is accessible in development and staging environments. A compromised CDN or dependency could inject arbitrary JS into the admin browser context (which carries session cookies).

**Fix**: Pin a specific version and add `integrity` SHA hashes. Alternatively, vendor the assets locally.

---

### P2-5: `settings.controller.ts` validates payload schema manually inside the handler

`src/server/http/controllers/admin/settings.controller.ts:36-41`:

The controller validates `meta.schema.safeParseAsync(input.payload)` inside the handler and manually maps issues to `ORPCError.data`. This is correct but verbose — the same pattern appears nowhere else because all other controllers use `.input(zodSchema)` at the procedure level and let oRPC's built-in validation produce the standard 400 response.

The reason is that the section schema is dynamic (picked from `SECTION_REGISTRY[input.section]`). The current approach works, but a discriminated-union input schema (built once at startup from the registry) would eliminate the manual validation step and keep the handler thin.

**Fix**: Consider pre-building a `z.discriminatedUnion('section', [...])` from the registry at module load time, so the procedure's `.input()` handles validation automatically.

### P2-6: `auth/primitives.ts:61` throws plain `Error` for programmer invariant

```ts
if (!dbUser.role) {
  throw new Error('establishLoginSession requires a user with a role')
}
```

This is a programmer invariant, not a user-facing error — `onErrorHandler` will return 500. That's correct for an invariant violation, but it doesn't appear in `getLogger` output, making it harder to diagnose in production. Consider `DomainError('INTERNAL', ...)` or at minimum logging before throwing.

### P2-7: Duplicate `isCatalogVisible` across posts and pages

Even after fixing the `publishedRevisionId` gap, `isCatalogVisible` exists in:
- `src/server/domains/posts/service.ts`
- `src/server/domains/pages/service.ts`
- `src/server/domains/pages/repo.ts`

All three now check the same four conditions. A shared narrow structural type in `domains/content/` would eliminate the drift risk.

### P2-8: `account.controller.ts` and `users.controller.ts` inline input schemas instead of shared contracts

`src/server/http/controllers/account.controller.ts` has inline `z.object(...)` schemas with a comment noting the previous shared contract was deleted. `users.controller.ts` similarly. Per AGENTS.md, these should live in `shared/contracts/` with parity assertions against `shared/types/`. The inline approach works but bypasses the type-parity safety net.

### P2-9: `listAllSessions` SCAN in `auth/repo.ts` is unbounded

`src/server/domains/auth/repo.ts:230-313`: The SCAN loop collects all session sids into memory, then does one EXISTS pipeline per sid, then one HGETALL per live sid. For a blog with thousands of sessions (legitimate over years of operation), this is a single-request O(N) memory spike. The comment acknowledges this but no pagination guard exists.

**Fix**: Add a soft cap (e.g. 10,000 sids) and return a truncated result with a `hasMore` flag, or switch to a sorted-set index.

---

## Updated Score Breakdown

| Dimension | Max | Previous | New | Notes |
|-----------|-----|----------|-----|-------|
| Architecture Design | 20 | 18 | 19 | Content domain clean; auth repo layering minor gap |
| Code Quality | 20 | 16 | 18 | All P0/P1 fixed; cycle eliminated; remaining are P2 polish |
| Type Safety | 15 | 14 | 14 | `content/schema.ts` inline types; otherwise solid |
| Testing | 15 | 11 | 12 | Draft visibility test added; rate-limit probe gap untested |
| Security | 10 | 9 | 9 | OpenAPI SRI gap; rate-limit probe bypass |
| Engineering | 10 | 9 | 10 | 0 warnings, 0 errors; clean import hygiene |
| Maintainability | 10 | 9 | 9 | Duplicate `isCatalogVisible` still present; inline schemas |
| **Total** | **100** | **86** | **92** | |

**92 / 100** — All critical and high-priority issues from the second review are fixed. The remaining deductions come from the `rateLimit` probe gap (correctness risk), auth-repo layering (maintainability), and minor polish items.

---

## Priority Action List

1. **P1-1**: Expand `rateLimit` probe to check all 9 buckets (derive from schema constant)
2. **P1-2**: Extract orchestration from `auth/repo.ts` into a service layer
3. **P1-3**: Replace inline `import()` types in `content/schema.ts` with top-level imports
4. **P1-4**: Pin `unpkg.com` assets with `integrity` hashes in `openapi-docs.ts`
5. **P2-5**: Consider pre-built discriminated-union input for settings controller
6. **P2-6**: Add logging before invariant `throw new Error(...)` in `auth/primitives.ts`
7. **P2-7**: Extract shared `isCatalogVisible` to `domains/content/`
8. **P2-8**: Move inline controller schemas to `shared/contracts/`
9. **P2-9**: Add a soft cap to `listAllSessions` SCAN
