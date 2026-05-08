import { type RouteConfig, index, layout, route } from '@react-router/dev/routes'

import { API_ACTION_LIST } from './shared/api-actions'

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
  // Resource routes outside the public layout — see _README.md §C.
  route('tags', 'routes/tags.index.ts'),
  // Feed URLs — see _README.md §D for the URL ↔ module ↔ id table.
  route('feed', 'routes/feed.rss.ts'),
  route('feed/atom', 'routes/feed.atom.ts'),
  route('cats/:slug/feed', 'routes/feed.rss.ts', { id: 'category-feed-rss' }),
  route('cats/:slug/feed/atom', 'routes/feed.atom.ts', { id: 'category-feed-atom' }),
  route('tags/:slug/feed', 'routes/feed.rss.ts', { id: 'tag-feed-rss' }),
  route('tags/:slug/feed/atom', 'routes/feed.atom.ts', { id: 'tag-feed-atom' }),
  route('search', 'routes/search.index.ts'),
  route('sitemap.xml', 'routes/sitemap.ts'),
  route('images/og/:slug.png', 'routes/image.og.ts'),
  route('images/calendar/:year/:time.png', 'routes/image.calendar.ts'),
  route('images/avatar/:hash.png', 'routes/image.avatar.ts'),
  // API resource routes generated from `API_ACTION_LIST` — see _README.md §E.
  ...API_ACTION_LIST.map((action) => route(action.route, action.file)),
  // Auth split-screen layout — see _README.md §F.
  layout('routes/admin.layout.tsx', [
    route('wp-login.php', 'routes/wp-login.tsx'),
    route('wp-admin/install.php', 'routes/wp-admin.install.tsx'),
    route('wp-admin/install/settings.php', 'routes/wp-admin.install.settings.tsx'),
  ]),
  // wp-admin SPA shell — see _README.md §G.
  layout('routes/wp-admin.layout.tsx', [
    route('wp-admin', 'routes/wp-admin.dashboard.tsx'),
    route('wp-admin/comments', 'routes/wp-admin.comments.tsx'),
    route('wp-admin/users', 'routes/wp-admin.users.tsx'),
    route('wp-admin/users/:id', 'routes/wp-admin.users.detail.tsx'),
    route('wp-admin/friends', 'routes/wp-admin.friends.tsx'),
    route('wp-admin/categories', 'routes/wp-admin.categories.tsx'),
    route('wp-admin/tags', 'routes/wp-admin.tags.tsx'),
    route('wp-admin/pages', 'routes/wp-admin.pages.tsx'),
    route('wp-admin/images', 'routes/wp-admin.images.tsx'),
    route('wp-admin/musics', 'routes/wp-admin.musics.tsx'),
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
    ]),
  ]),
] satisfies RouteConfig
