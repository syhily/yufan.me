UPDATE "setting"
SET "data" = jsonb_build_object(
  'sidebar',
  jsonb_build_object(
    'widgets',
    jsonb_build_array(
      jsonb_build_object('type', 'search',        'enabled', coalesce(("data"->'sidebar'->>'search')::boolean, false)),
      jsonb_build_object('type', 'recentPosts',   'enabled', coalesce(("data"->'sidebar'->>'post')::int, 0) > 0,    'count', coalesce(("data"->'sidebar'->>'post')::int, 5)),
      jsonb_build_object('type', 'recentComments','enabled', coalesce(("data"->'sidebar'->>'comment')::int, 0) > 0, 'count', coalesce(("data"->'sidebar'->>'comment')::int, 5)),
      jsonb_build_object('type', 'randomTags',    'enabled', coalesce(("data"->'sidebar'->>'tag')::int, 0) > 0,     'count', coalesce(("data"->'sidebar'->>'tag')::int, 20)),
      jsonb_build_object('type', 'todayCalendar', 'enabled', coalesce(("data"->'sidebar'->>'calendar')::boolean, false))
    )
  )
)
WHERE "scope" = 'blog.sidebar';
