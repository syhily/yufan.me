-- Restore metric counters from prod domain (yufan.me) into stage domain (stage.yufan.me).
--
-- Context: the blog's `website` setting is `https://stage.yufan.me`, so the runtime
-- generates metric keys like `https://stage.yufan.me/posts/<slug>/`. After the MDX->DB
-- post migration, new metric rows were created under that stage key, but the historic
-- counters live under the old `https://yufan.me/...` keys. This script:
--   1. Aggregates pv + vote_up per URL path across both domains.
--   2. Upserts the aggregated values into the stage key.
--   3. Deletes the old prod keys so the table stays clean.
--   4. Reports what changed.

-- ---------------------------------------------------------------------------
-- Preview: show the top 20 posts whose stage key will receive a boost
-- ---------------------------------------------------------------------------
WITH merged AS (
  SELECT
    regexp_replace(key, 'https?://[^/]+(/.*)', '\1') AS path,
    SUM(COALESCE(pv, 0)) AS total_pv,
    SUM(COALESCE(vote_up, 0)) AS total_votes
  FROM metric
  GROUP BY regexp_replace(key, 'https?://[^/]+(/.*)', '\1')
),
stage_existing AS (
  SELECT
    regexp_replace(key, 'https?://[^/]+(/.*)', '\1') AS path,
    COALESCE(pv, 0) AS stage_pv,
    COALESCE(vote_up, 0) AS stage_votes
  FROM metric
  WHERE key LIKE 'https://stage.yufan.me/%'
)
SELECT
  m.path,
  m.total_pv,
  m.total_votes,
  COALESCE(se.stage_pv, 0) AS stage_before_pv,
  COALESCE(se.stage_votes, 0) AS stage_before_votes
FROM merged m
LEFT JOIN stage_existing se ON m.path = se.path
WHERE m.total_pv > COALESCE(se.stage_pv, 0)
ORDER BY m.total_pv DESC
LIMIT 20;

-- ---------------------------------------------------------------------------
-- Step 1: Upsert aggregated values into stage keys
-- ---------------------------------------------------------------------------
-- For each path, sum pv + vote_up across ALL domains, then write that total
-- into the stage key. If the stage key doesn't exist yet, insert it (copying
-- title from whichever old row has the highest pv).

WITH merged AS (
  SELECT
    regexp_replace(key, 'https?://[^/]+(/.*)', '\1') AS path,
    SUM(COALESCE(pv, 0)) AS total_pv,
    SUM(COALESCE(vote_up, 0)) AS total_votes
  FROM metric
  GROUP BY regexp_replace(key, 'https?://[^/]+(/.*)', '\1')
),
best_title AS (
  SELECT DISTINCT ON (regexp_replace(key, 'https?://[^/]+(/.*)', '\1'))
    regexp_replace(key, 'https?://[^/]+(/.*)', '\1') AS path,
    title
  FROM metric
  WHERE title IS NOT NULL AND title != ''
  ORDER BY regexp_replace(key, 'https?://[^/]+(/.*)', '\1'), COALESCE(pv, 0) DESC
),
upsert_data AS (
  SELECT
    'https://stage.yufan.me' || m.path AS new_key,
    m.path,
    m.total_pv,
    m.total_votes,
    COALESCE(bt.title, '无标题') AS title
  FROM merged m
  LEFT JOIN best_title bt ON m.path = bt.path
)
INSERT INTO metric (key, title, pv, vote_up, created_at, updated_at)
SELECT new_key, title, total_pv, total_votes, NOW(), NOW()
FROM upsert_data
ON CONFLICT (key) DO UPDATE SET
  pv = EXCLUDED.pv,
  vote_up = EXCLUDED.vote_up,
  updated_at = NOW();

-- ---------------------------------------------------------------------------
-- Step 2: Delete old prod keys (they are now merged into stage keys)
-- ---------------------------------------------------------------------------
DELETE FROM metric WHERE key LIKE 'https://yufan.me/%';

-- ---------------------------------------------------------------------------
-- Step 3: Summary
-- ---------------------------------------------------------------------------
SELECT
  COUNT(*) AS remaining_rows,
  SUM(COALESCE(pv, 0)) AS total_pv,
  SUM(COALESCE(vote_up, 0)) AS total_votes
FROM metric;
