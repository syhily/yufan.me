import { type RouteConfig, index, layout, route } from '@react-router/dev/routes'

// See `src/routes/_README.md` for the long-form rationale behind every
// block below (file-naming convention, why specific layouts wrap which
// URLs, splat ordering, feed `id` disambiguators, etc.). Keep this
// manifest terse — extend the README first when you need to explain
// "why".
export default [
  // Public layout — see _README.md §A (and §B for the splat).
  layout('routes/public.layout.tsx', [
    index('routes/home.tsx'),
    route('page/:num', 'routes/home.tsx', { id: 'home-page' }),
    route('archives', 'routes/archives.tsx'),
    route('categories', 'routes/categories.tsx'),
    route('cats/:slug', 'routes/category.list.tsx'),
    route('cats/:slug/page/:num', 'routes/category.list.tsx', { id: 'category-list-page' }),
    route('tags/:slug', 'routes/tag.list.tsx'),
    route('tags/:slug/page/:num', 'routes/tag.list.tsx', { id: 'tag-list-page' }),
    route('search/:keyword', 'routes/search.list.tsx'),
    route('search/:keyword/page/:num', 'routes/search.list.tsx', { id: 'search-list-page' }),
    route('posts/:slug', 'routes/post.detail.tsx'),
    route(':slug', 'routes/page.detail.tsx'),
    // Splat MUST stay last — see _README.md §B.
    route('*', 'routes/not-found.tsx'),
  ]),
  // Backwards-compat redirects.
  //
  // Both `/my/comments` and `/my/profile` were promoted into the
  // wp-admin shell to match the richness of the admin-side moderation
  // and user-detail views (rich Tabs / search / pagination instead of
  // the old plain stack). External bookmarks under `/my/*` survive
  // via these 301s; the canonical URL is now `/wp-admin/my/*`.
  route('my/comments', 'routes/my.redirect.comments.ts'),
  route('my/profile', 'routes/my.redirect.profile.ts'),
  // Resource routes outside the public layout — see _README.md §C.
  route('tags', 'routes/tags.index.ts'),
  // Feed / sitemap resource routes now served by Hono — see server.ts
  route('search', 'routes/search.index.ts'),
  route('images/og/:slug.png', 'routes/image.og.ts'),
  route('images/calendar/:year/:time.png', 'routes/image.calendar.ts'),
  route('images/calendar/dark/:year/:time.png', 'routes/image.calendar.dark.ts'),
  route('images/avatar/:hash.png', 'routes/image.avatar.ts'),
  // Auth split-screen layout — see _README.md §F.
  layout('routes/admin.layout.tsx', [
    route('wp-login.php', 'routes/wp-login.tsx'),
    route('wp-admin/install.php', 'routes/wp-admin.install.tsx'),
    route('wp-admin/install/settings.php', 'routes/wp-admin.install.settings.tsx'),
  ]),
  // wp-admin SPA shell — see _README.md §G.
  layout('routes/wp-admin.layout.tsx', [
    route('wp-admin', 'routes/wp-admin.dashboard.tsx'),
    route('wp-admin/welcome', 'routes/wp-admin.welcome.tsx'),
    route('wp-admin/comments', 'routes/wp-admin.comments.tsx'),
    route('wp-admin/users', 'routes/wp-admin.users.tsx'),
    route('wp-admin/users/:id', 'routes/wp-admin.users.detail.tsx'),
    // Self-service profile editor — same shell as the admin user
    // detail view, but scoped to the current session's own row.
    route('wp-admin/my/profile', 'routes/wp-admin.my.profile.tsx'),
    // Self-service comment list — mirrors the admin moderation view
    // (Tabs / search / pagination) but only exposes own-comment
    // actions (申请删除 / 撤回删除); approve/reject/edit-user are
    // admin-only and stay on `/wp-admin/comments`.
    route('wp-admin/my/comments', 'routes/wp-admin.my.comments.tsx'),
    // Self-service active-session list. Mirrors the same shell as
    // the admin site-wide view but scoped to the current user; each
    // row's 注销 button hits `api/actions/account/revokeSession`.
    route('wp-admin/my/sessions', 'routes/wp-admin.my.sessions.tsx'),
    // Admin site-wide session-management surface — search by user,
    // filter by login-time range, sort by activity, revoke any row.
    route('wp-admin/sessions', 'routes/wp-admin.sessions.tsx'),
    route('wp-admin/friends', 'routes/wp-admin.friends.tsx'),
    route('wp-admin/categories', 'routes/wp-admin.categories.tsx'),
    route('wp-admin/tags', 'routes/wp-admin.tags.tsx'),
    route('wp-admin/pages', 'routes/wp-admin.pages.tsx'),
    route('wp-admin/pages/new', 'routes/wp-admin.pages.new.tsx'),
    route('wp-admin/pages/:id/edit', 'routes/wp-admin.pages.edit.tsx'),
    route('wp-admin/posts', 'routes/wp-admin.posts.tsx'),
    route('wp-admin/posts/new', 'routes/wp-admin.posts.new.tsx'),
    route('wp-admin/posts/:id/edit', 'routes/wp-admin.posts.edit.tsx'),
    route('wp-admin/images', 'routes/wp-admin.images.tsx'),
    route('wp-admin/musics', 'routes/wp-admin.musics.tsx'),
    // Analytics dashboard. Layout owns the date-range + filters URL
    // state; child routes paint Overview and the Realtime feed.
    route('wp-admin/analytics', 'routes/wp-admin.analytics.layout.tsx', [
      index('routes/wp-admin.analytics.overview.tsx'),
      route('realtime', 'routes/wp-admin.analytics.realtime.tsx'),
    ]),
    // Settings sub-layout — see _README.md §H.
    layout('routes/wp-admin.settings.layout.tsx', [
      route('wp-admin/settings', 'routes/wp-admin.settings.index.tsx'),
      route('wp-admin/settings/general', 'routes/wp-admin.settings.general.tsx'),
      route('wp-admin/settings/assets', 'routes/wp-admin.settings.assets.tsx'),
      route('wp-admin/settings/navigation', 'routes/wp-admin.settings.navigation.tsx'),
      route('wp-admin/settings/socials', 'routes/wp-admin.settings.socials.tsx'),
      route('wp-admin/settings/content', 'routes/wp-admin.settings.content.tsx'),
      route('wp-admin/settings/sidebar', 'routes/wp-admin.settings.sidebar.tsx'),
      route('wp-admin/settings/comments', 'routes/wp-admin.settings.comments.tsx'),
      route('wp-admin/settings/seo', 'routes/wp-admin.settings.seo.tsx'),
      route('wp-admin/settings/footer', 'routes/wp-admin.settings.footer.tsx'),
      route('wp-admin/settings/mail', 'routes/wp-admin.settings.mail.tsx'),
      route('wp-admin/settings/cache', 'routes/wp-admin.settings.cache.tsx'),
      route('wp-admin/settings/rate-limit', 'routes/wp-admin.settings.rate-limit.tsx'),
      route('wp-admin/settings/search', 'routes/wp-admin.settings.search.tsx'),
      route('wp-admin/settings/fonts', 'routes/wp-admin.settings.fonts.tsx'),
    ]),
  ]),
] satisfies RouteConfig
