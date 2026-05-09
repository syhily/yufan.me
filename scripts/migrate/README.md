# Migration scripts

One-shot importers that move legacy content into the DB-backed
schemas. Each migrator owns its own subdirectory; nothing here is
loaded by the SSR bundle.

```
scripts/migrate/
├── pages/                       # MDX → `page` + `content` tables
│   ├── cli.ts                   # operator-facing entry point
│   └── mdx-to-portable-text.ts  # narrow mdast → PortableText converter
└── README.md                    # this file
```

## Pages — MDX → `page` + `content`

```bash
# Dry run (no writes)
vp dlx vite-node --env-file=.env scripts/migrate/pages/cli.ts \
  --source-dir /abs/path/to/mdx-pages

# Actually write
vp dlx vite-node --env-file=.env scripts/migrate/pages/cli.ts \
  --source-dir /abs/path/to/mdx-pages --apply

# Re-run preview against pages already imported
vp dlx vite-node --env-file=.env scripts/migrate/pages/cli.ts \
  --source-dir /abs/path/to/mdx-pages --apply --force
```

`--source-dir` is required: pages no longer ship in-tree under
`src/content/pages` (they live in Postgres now), so the operator must
physically stage the input next to the production environment before
running the importer. The script never writes back to the input
directory — it reads MDX, persists to `page` + `content`, and prints a
per-page report.

See `pages/cli.ts` for the resolver semantics (image lookup, music
sanity check, `<Friends />` auto-toggle, idempotency guard) and
`pages/mdx-to-portable-text.ts` for the supported subset of mdast
constructs the converter accepts.

## Adding a new migrator

The pages migrator sets the convention for future importers (e.g. an
upcoming MDX → DB post migrator):

1. **One subdirectory per source.** Posts will live under
   `scripts/migrate/posts/`, with the same `cli.ts` /
   `<source>-to-<target>.ts` split: a CLI runner that owns argument
   parsing, settings hydration, and reporting; and a pure converter
   the unit tests can drive without touching the DB.
2. **Heavy parser deps stay out of `src/`.** The pages converter pulls
   in `remark` + `mdast` + `yaml`. Those stay under `scripts/` so the
   SSR bundle does not pay the cost. New migrators should follow the
   same rule — if the parser only runs at import time, it lives here.
3. **Idempotency by default.** Re-running with the same input must
   skip every previously-imported row. `--force` only opts a known
   slug back into the dry-run preview; it never updates the existing
   row.
4. **Per-row report + structured logs.** Every row gets a
   `'created' | 'skipped' | 'failed' | 'dry-run'` status, an
   unresolved-resource list, and a short hint string the operator can
   act on. Use `getLogger('scripts.migrate.<source>')` so the JSON
   stream stays grep-friendly.
5. **No SSR-side imports.** Migrators import service / repository
   helpers from `@/server/cms/...` and `@/server/db/query/...`; they
   must never expose anything back through `@/server/cms/...` so the
   `src/server` import graph does not gain a `remark` edge.

Test the converter with `tests/script.migrate-<source>-<target>.test.ts`
(see `tests/script.migrate-pages-mdx.test.ts` for the existing
contract).
