# `src/content/pages/` — Page archive (read-only)

This directory holds the historical Fumadocs MDX page sources
(`about.mdx`, `guestbook.mdx`, `links.mdx`). They are **not** rendered
by the SSR runtime any more — pages live exclusively in the `page` +
`content` Postgres tables and are edited through `/wp-admin/pages`.

The files are kept here as **migration source material** so the
production-environment importer
(`scripts/migrate/pages/cli.ts`) can be pointed at this directory:

```bash
vp dlx vite-node --env-file=.env scripts/migrate/pages/cli.ts \
  --source-dir "$PWD/src/content/pages"            # dry run
vp dlx vite-node --env-file=.env scripts/migrate/pages/cli.ts \
  --source-dir "$PWD/src/content/pages" --apply    # write
```

Conventions:

- The files are intentionally invisible to `source.config.ts`. The
  Fumadocs `pages` collection has been removed; this directory is
  not walked at build time, so adding / editing files here has zero
  effect on the live site.
- Do not edit these files to "update content" — edit the rows in
  `/wp-admin/pages` instead. The MDX snapshots are frozen as a
  one-shot importer input; treat them as a backup of the original
  Astro / Fumadocs corpus.
- The leading-underscore prefix on this README ensures it is not
  picked up by any future glob that might re-enable this directory.
