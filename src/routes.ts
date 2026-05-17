import { type RouteConfig, index, layout, route } from '@react-router/dev/routes'

// See `src/routes/README.md` for the rationale behind every block.
export default [
  // Public layout — see README.md §A (and §B for the splat).
  layout('routes/public/layout.tsx', [
    index('routes/public/home.tsx'),
    route('page/:num', 'routes/public/home.tsx', { id: 'home-page' }),
    route('archives', 'routes/public/archives.tsx'),
    route('categories', 'routes/public/categories.tsx'),
    route('cats/:slug', 'routes/public/category/list.tsx'),
    route('cats/:slug/page/:num', 'routes/public/category/list.tsx', { id: 'category-list-page' }),
    route('tags/:slug', 'routes/public/tag/list.tsx'),
    route('tags/:slug/page/:num', 'routes/public/tag/list.tsx', { id: 'tag-list-page' }),
    route('search/:keyword', 'routes/public/search/list.tsx'),
    route('search/:keyword/page/:num', 'routes/public/search/list.tsx', { id: 'search-list-page' }),
    route('posts/:slug', 'routes/public/post/detail.tsx'),
    route(':slug', 'routes/public/page/detail.tsx'),
    // Splat MUST stay last — see README.md §B.
    route('*', 'routes/public/not-found.tsx'),
  ]),

  // Auth split-screen layout — see README.md §F.
  layout('routes/auth/layout.tsx', [
    route('wp-login.php', 'routes/auth/wp-login.tsx'),
    route('wp-admin/install.php', 'routes/auth/install/index.tsx'),
    route('wp-admin/install/settings.php', 'routes/auth/install/settings.tsx'),
  ]),
  // wp-admin SPA shell — see README.md §G.
  layout('routes/wp-admin/layout.tsx', [
    route('wp-admin', 'routes/wp-admin/dashboard.tsx'),
    route('wp-admin/welcome', 'routes/wp-admin/welcome.tsx'),
    route('wp-admin/comments', 'routes/wp-admin/comments.tsx'),
    route('wp-admin/users', 'routes/wp-admin/users/index.tsx'),
    route('wp-admin/users/:id', 'routes/wp-admin/users/detail.tsx'),
    route('wp-admin/my/profile', 'routes/wp-admin/my/profile.tsx'),
    route('wp-admin/my/comments', 'routes/wp-admin/my/comments.tsx'),
    route('wp-admin/my/sessions', 'routes/wp-admin/my/sessions.tsx'),
    route('wp-admin/sessions', 'routes/wp-admin/sessions.tsx'),
    route('wp-admin/friends', 'routes/wp-admin/friends.tsx'),
    route('wp-admin/categories', 'routes/wp-admin/categories.tsx'),
    route('wp-admin/tags', 'routes/wp-admin/tags.tsx'),
    route('wp-admin/pages', 'routes/wp-admin/pages/index.tsx'),
    route('wp-admin/pages/new', 'routes/wp-admin/pages/new.tsx'),
    route('wp-admin/pages/:id/edit', 'routes/wp-admin/pages/edit.tsx'),
    route('wp-admin/posts', 'routes/wp-admin/posts/index.tsx'),
    route('wp-admin/posts/new', 'routes/wp-admin/posts/new.tsx'),
    route('wp-admin/posts/:id/edit', 'routes/wp-admin/posts/edit.tsx'),
    route('wp-admin/images', 'routes/wp-admin/images.tsx'),
    route('wp-admin/musics', 'routes/wp-admin/musics.tsx'),
    route('wp-admin/analytics', 'routes/wp-admin/analytics/layout.tsx', [
      index('routes/wp-admin/analytics/overview.tsx'),
      route('realtime', 'routes/wp-admin/analytics/realtime.tsx'),
    ]),
    // Settings sub-layout — see README.md §H.
    layout('routes/wp-admin/settings/layout.tsx', [
      route('wp-admin/settings', 'routes/wp-admin/settings/index.tsx'),
      route('wp-admin/settings/general', 'routes/wp-admin/settings/general.tsx'),
      route('wp-admin/settings/assets', 'routes/wp-admin/settings/assets.tsx'),
      route('wp-admin/settings/navigation', 'routes/wp-admin/settings/navigation.tsx'),
      route('wp-admin/settings/socials', 'routes/wp-admin/settings/socials.tsx'),
      route('wp-admin/settings/content', 'routes/wp-admin/settings/content.tsx'),
      route('wp-admin/settings/sidebar', 'routes/wp-admin/settings/sidebar.tsx'),
      route('wp-admin/settings/comments', 'routes/wp-admin/settings/comments.tsx'),
      route('wp-admin/settings/seo', 'routes/wp-admin/settings/seo.tsx'),
      route('wp-admin/settings/mail', 'routes/wp-admin/settings/mail.tsx'),
      route('wp-admin/settings/cache', 'routes/wp-admin/settings/cache.tsx'),
      route('wp-admin/settings/rate-limit', 'routes/wp-admin/settings/rate-limit.tsx'),
      route('wp-admin/settings/search', 'routes/wp-admin/settings/search.tsx'),
      route('wp-admin/settings/fonts', 'routes/wp-admin/settings/fonts.tsx'),
      route('wp-admin/settings/backup', 'routes/wp-admin/settings/backup.tsx'),
    ]),
  ]),
] satisfies RouteConfig
