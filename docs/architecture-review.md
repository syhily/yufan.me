# Architecture & Code Quality Review

**Date**: 2026-05-18
**Reviewer**: Strict Architect Audit
**Overall Score**: 78 / 100

---

## Summary

This is an above-average full-stack React SSR project with clear layered design intent and engineering infrastructure (CI, lint, contract tests) far exceeding typical personal projects. However, there are several areas where "design is in place but execution falls short." Issues are ranked by priority below.

---

## P0 — Must Fix (Correctness / Security)

### 1. Settings Contract Uses `z.unknown()`, Abandoning Runtime Validation

`shared/contracts/settings.ts` — all 14 settings section schemas are `z.unknown().nullable()`. The oRPC layer performs zero runtime validation on admin settings writes — malformed payloads reach the database directly. Real validation only exists in the service layer's `SECTION_REGISTRY[section].schema`, but these are two independently maintained schemas. Drift won't be caught at compile time.

**Why it's critical**: This is the sole write path for all system configuration. One bug can write illegal JSON that crashes the entire site's config.

**Recommendation**: `contracts/settings.ts` should import and reuse schemas from `SECTION_REGISTRY`, or `api.admin.settings.update`'s `.input()` should reference the service-layer schema directly.

### 2. `content-revisions.ts` Belongs to No Domain, Directly Operates `db`

`src/server/domains/content-revisions.ts` is a standalone file with raw `db.select()` Drizzle calls, bypassing the repo layer. This violates the AGENTS.md locked vocabulary (`schema.ts / repo.ts / service.ts / projection.ts / cache.ts`). Both posts and pages domains depend on it, but it lives in no domain folder.

**Recommendation**: Split into posts and pages repos respectively, or elevate to an independent domain with the full vocabulary.

### 3. `session-storage.ts` — `JSON.parse` Without Defense

`src/server/domains/auth/session-storage.ts` line ~51: `JSON.parse(value)` is not wrapped in try-catch. If Redis stores malformed data (manual edits, incompatible version upgrades), an uncaught exception causes a 500 on every request hitting that session.

**Recommendation**: Wrap in try-catch; on parse failure, treat as session-not-found and log a warning.

### 4. `posts/service.ts` Silently Swallows Index Errors

Line ~413: `.catch(() => undefined)` completely swallows search index write errors. Silent index failures mean search silently becomes stale, with no log or observable signal to detect the problem.

**Recommendation**: At minimum `log.warn` the error, or expose as an observable health metric.

---

## P1 — High Priority (Maintainability / Architecture Consistency)

### 5. Repository Pattern Enforcement Is Inconsistent

AGENTS.md mandates `schema.ts / repo.ts / service.ts / projection.ts / cache.ts` per domain, but execution varies:

- `posts/` has proper repo + service separation ✅
- `comments/` has `schema.ts`, `loader.ts`, `moderation.ts`, but **no** `repo.ts` — data access is scattered across loader and moderation
- `auth/` has no repo pattern at all — `sessions.ts` directly operates Redis
- `catalog/` cache logic is embedded directly in the `catalog.ts` class

New developers cannot predict "where is data access code?" from directory structure alone.

**Recommendation**: Unify at least core domains (auth, comments) to follow the repo pattern.

### 6. Magic Numbers Scattered Across the Project

| Location | Value | Meaning |
|----------|-------|---------|
| `orpc-base.ts:40` | `10 * 1024 * 1024` | Request body size limit |
| `session-storage.ts:33` | `60 * 60 * 24 * 30` | Session TTL |
| `posts/service.ts:88` | `10_000` | Slug uniqueness check upper bound |
| `app.ts:40` | `10 * 1024 * 1024` | Same body limit, duplicated |

These should be defined and exported from a constants file under `infra/`.

### 7. `server/http/app.ts` Overloaded Responsibilities (168 lines)

This single file handles:

- Hono app creation and middleware mounting
- React Router SSR fetch handler bridging
- OpenAPI docs HTML template (lines ~90–115, a massive inline HTML string)
- Response header merging logic
- Database migration triggering
- Backup scheduler triggering

Violates single responsibility principle.

**Recommendation**: Extract OpenAPI docs HTML to a template function under `render/`, and extract the SSR fetch handler bridge to an independent module.

### 8. `server/http/errors.ts` Hardcodes Chinese Error Messages

Lines ~57, ~69 have hardcoded Chinese strings in error responses. If the API ever needs i18n or serves non-Chinese consumers, this becomes tech debt. Error messages should be separated from error codes.

### 9. `src/shared/pt/schema.ts` Carries Too Many Responsibilities (675 lines)

This file simultaneously contains:

- Zod schema definitions (100+ lines)
- `collectHeadings()` recursive traversal
- `walkBlockForImages()` recursive traversal
- `pushBlockText()` recursive traversal
- `validatePortableTextBody()` validation
- `generateId()` ID generation
- `isPortableTextXxx()` type guards

Traversal and utility functions should be extracted to `shared/pt/traverse.ts` or `shared/pt/utils.ts`.

---

## P2 — Medium Priority (Code Quality / Developer Experience)

### 10. UI Components Missing Reasonable Memoization

Not "all components must memo," but these specific cases have measurable perf impact:

- `Comments.tsx` (460 lines) lines ~326–344: context value object recreated every render, causing unnecessary re-renders across the entire comment tree. Should `useMemo`.
- `PostEditorShell.tsx` (514 lines) and `PageBodyEditor.tsx` (531 lines): many inline callbacks and derived state computations lack memoization.
- `TableOfContents.tsx` (285 lines): TOC config object recreated every render.

### 11. Some Components Exceed LOC Ceiling

AGENTS.md explicitly states stateful orchestrators should be ≤500 LOC:

| File | Lines | Over |
|------|-------|------|
| `admin/editor/PageBodyEditor.tsx` | 531 | +31 |
| `admin/posts/PostEditorShell.tsx` | 514 | +14 |
| `public/comments/Comments.tsx` | 460 | borderline |
| `public/post/PostListViews.tsx` | 399 | borderline |

PageBodyEditor and PostEditorShell need splitting per the documented requirement.

### 12. `infra/db/pool.ts` Global Singleton Pattern

```typescript
let _db: MyDbType | undefined;
export function db() { if (!_db) { ... } return _db!; }
```

Uses `!` non-null assertion instead of throwing a clear error on uninitialized access. `getRawPool()` contains `(db as unknown as { $client: Pool })` — an unsafe type assertion.

### 13. Structural Blind Spots in Test Coverage

Out of 291 test files:

- **Client hooks**: 0 dedicated tests
- **UI components**: only 1 component test
- **Integration tests**: only 4 files
- **E2E tests**: 0

Server-side testing is solid (contract tests, service tests, controller smoke tests), but the client side is essentially a test vacuum. For the comment system and editor with complex interactions, this is significant risk.

### 14. Multiple Alpha/RC Dependencies

`package.json` contains several unstable-version dependencies:

- `drizzle-orm: "1.0.0-rc.2"`
- `npm:@voidzero-dev/vite-plus-core@latest`
- Multiple `@tiptap/*` beta packages

These pose supply chain risk in production deployments.

---

## P3 — Low Priority (Improvement Suggestions)

### 15. Hardcoded i18n Strings

Numerous Chinese strings are scattered directly in UI components ("评论加载失败", "共 X 篇文章", "保存中...", etc.). Even if multi-language support isn't needed, these should at minimum be centralized into constants files for easy batch modification.

### 16. Coverage Thresholds Are Low

Current 70–75% coverage thresholds are below par for a production project. Recommend gradually raising to 80%.

### 17. `routes/public/home.tsx` Loader Mixes Concerns

A single loader handles pagination parsing, data fetching, sidebar computation, and analytics tracking simultaneously. While not technically violating the route layer's "orchestration" role, readability suffers. Suggest splitting into internal helper functions.

### 18. Duplicate Body Size Limit Definitions

`orpc-base.ts:40` and `app.ts:40` each independently define `10 * 1024 * 1024`. Changing the limit requires editing two places.

### 19. Source-Code-Based Contract Tests Are Fragile

`contract.cookie.test.ts` and `contract.tailwind-tokens.test.ts` validate contracts by regex-parsing source files. Clever, but if source formatting changes (different formatter), tests silently pass without actually checking. Recommend retaining runtime assertions alongside.

---

## Strengths

After the criticism, credit where it's due:

1. **Clear layered design intent** — The `infra → domains → http` one-way dependency graph is the correct architectural choice. AGENTS.md constraint documentation quality is exceptional.
2. **Contract test system** — PT bridge, Tailwind tokens, cookie security, projection fallback — these cross-layer contract tests are something many teams don't achieve.
3. **oRPC + Zod type-safe API layer** — Schema-to-DTO parity assertions ensure compile-time drift detection.
4. **Per-section settings management** — 14 independent sections + per-section React contexts avoid giant state global re-renders.
5. **`cn()` utility token registration** — `tailwind-merge` custom config + contract test ensures CSS tokens and JS registrations don't drift.
6. **No barrel imports** — Zero `index.ts` barrel files found across the project.
7. **Test helper infrastructure** — `chainable()`, `mockDb()`, `seedComment()` and other declarative fixture systems are high quality.
8. **CSRF protection** — Global CSRF guard at the RPCHandler layer; procedure handlers never call `validateRequestCsrf` themselves.
9. **Docker multi-stage build** — Production image optimization is reasonable.

---

## Score Breakdown

| Dimension | Max | Score | Notes |
|-----------|-----|-------|-------|
| Architecture Design | 20 | 17 | Layered intent excellent, execution consistency has gaps |
| Code Quality | 20 | 14 | Magic numbers, overloaded responsibilities, some modules exceed LOC limits |
| Type Safety | 15 | 13 | oRPC+Zod chain excellent, but settings `z.unknown()` is a clear weak point |
| Testing | 15 | 10 | Server-side solid, client/UI nearly blank |
| Security | 10 | 8 | CSRF/RBAC in place, but JSON.parse undefended, errors silently swallowed |
| Engineering | 10 | 8 | CI/lint/format/contract tests solid, but dependency versions unstable |
| Maintainability | 10 | 8 | AGENTS.md is excellent, but inconsistent repo pattern increases cognitive load |
| **Total** | **100** | **78** | |

**78** — A project with clear architectural thinking and above-average engineering maturity. Primary deductions come from execution inconsistency (repo pattern, magic numbers, settings validation gap) and client-side test vacuum. Fixing all P0 issues and half of P1 would raise the score to 85+.
