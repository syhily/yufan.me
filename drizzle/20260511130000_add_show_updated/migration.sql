-- Add `page.show_updated` / `post.show_updated` — per-row meta toggle
-- that opts the public detail route into rendering the「修改于 XXXX」
-- secondary timestamp next to the first-publish date. Default false so
-- existing rows keep their single-date display; operators flip it on
-- from the editor meta sidebar (next to the TOC toggle) without
-- touching the body revision.
ALTER TABLE "page" ADD COLUMN IF NOT EXISTS "show_updated" boolean NOT NULL DEFAULT false;
ALTER TABLE "post" ADD COLUMN IF NOT EXISTS "show_updated" boolean NOT NULL DEFAULT false;
