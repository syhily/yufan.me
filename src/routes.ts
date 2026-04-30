import { type RouteConfig, index, layout, route } from '@react-router/dev/routes'

// React Router loads this manifest before Vite aliases are registered.
import { API_ACTIONS } from './client/api/actions'

export default [
  // Every public-facing URL sits under `routes/public.layout.tsx`. That
  // pathless layout owns the `<PublicChrome>` wrapper which statically
  // imports `globals.css`, so React Router can ship the resolved
  // `<link rel="stylesheet">` tags in the SSR `<Links />` output and the
  // first paint is fully styled (no FOUC). Admin / login / API routes
  // intentionally sit outside this layout so the wp-admin SPA chunk and
  // the JSON resource routes never pull in the public stylesheet cascade.
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
    // Splat MUST stay last inside this layout. React Router treats `*` as
    // the lowest-priority match, so this only fires for paths nothing else
    // handles (multi-segment WordPress probes such as
    // `/wp-content/plugins/x.php`, `/cgi-bin/test`,
    // `/wp-includes/wlwmanifest.xml`, …). Single-segment `.php` or
    // `cgi-bin` probes hit `:slug` first and are intercepted in
    // `routes/page.detail.tsx`.
    route('*', 'routes/not-found.tsx'),
  ]),
  // Resource routes (feeds, sitemap, generated images, JSON APIs) intentionally
  // sit outside the public layout. They never render `<Outlet />` chrome and
  // must not pull `globals.css` into their bundle.
  route('tags', 'routes/tags.index.ts'),
  // Six public feed URLs share two route modules (`feed.rss.ts`, `feed.atom.ts`).
  // The modules infer category/tag scope from the request URL (see
  // `scopeFromUrl`) so the only thing that varies across the three patterns
  // per format is the React Router `id`, which has to stay unique.
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
  route(API_ACTIONS.auth.updateUser.route, 'routes/api/actions/auth.updateUser.ts'),
  route(API_ACTIONS.comment.increaseLike.route, 'routes/api/actions/comment.increaseLike.ts'),
  route(API_ACTIONS.comment.decreaseLike.route, 'routes/api/actions/comment.decreaseLike.ts'),
  route(API_ACTIONS.comment.validateLikeToken.route, 'routes/api/actions/comment.validateLikeToken.ts'),
  route(API_ACTIONS.comment.findAvatar.route, 'routes/api/actions/comment.findAvatar.ts'),
  route(API_ACTIONS.comment.replyComment.route, 'routes/api/actions/comment.replyComment.ts'),
  route(API_ACTIONS.comment.approve.route, 'routes/api/actions/comment.approve.ts'),
  route(API_ACTIONS.comment.delete.route, 'routes/api/actions/comment.delete.ts'),
  route(API_ACTIONS.comment.loadComments.route, 'routes/api/actions/comment.loadComments.ts'),
  route(API_ACTIONS.comment.getRaw.route, 'routes/api/actions/comment.getRaw.ts'),
  route(API_ACTIONS.comment.edit.route, 'routes/api/actions/comment.edit.ts'),
  route(API_ACTIONS.comment.searchPages.route, 'routes/api/actions/comment.searchPages.ts'),
  route(API_ACTIONS.comment.searchAuthors.route, 'routes/api/actions/comment.searchAuthors.ts'),
  route(API_ACTIONS.comment.loadAll.route, 'routes/api/actions/comment.loadAll.ts'),
  route(API_ACTIONS.admin.listUsers.route, 'routes/api/actions/admin.listUsers.ts'),
  route(API_ACTIONS.admin.getUser.route, 'routes/api/actions/admin.getUser.ts'),
  route(API_ACTIONS.admin.softDeleteUser.route, 'routes/api/actions/admin.softDeleteUser.ts'),
  route(API_ACTIONS.admin.restoreUser.route, 'routes/api/actions/admin.restoreUser.ts'),
  route(API_ACTIONS.admin.muteUser.route, 'routes/api/actions/admin.muteUser.ts'),
  route(API_ACTIONS.admin.bulkApproveUserComments.route, 'routes/api/actions/admin.bulkApproveUserComments.ts'),
  route(API_ACTIONS.admin.bulkSoftDeleteUserComments.route, 'routes/api/actions/admin.bulkSoftDeleteUserComments.ts'),
  route(API_ACTIONS.admin.getSettings.route, 'routes/api/actions/admin.getSettings.ts'),
  route(API_ACTIONS.admin.updateSettings.route, 'routes/api/actions/admin.updateSettings.ts'),
  route(API_ACTIONS.admin.resetSettings.route, 'routes/api/actions/admin.resetSettings.ts'),
  route(API_ACTIONS.admin.getCacheStats.route, 'routes/api/actions/admin.getCacheStats.ts'),
  route(API_ACTIONS.admin.clearCache.route, 'routes/api/actions/admin.clearCache.ts'),
  route(API_ACTIONS.admin.sendTestMail.route, 'routes/api/actions/admin.sendTestMail.ts'),
  layout('routes/admin.layout.tsx', [
    route('wp-login.php', 'routes/wp-login.tsx'),
    route('wp-admin/install.php', 'routes/wp-admin.install.tsx'),
  ]),
  // The SPA admin shell owns its own chrome (sidebar + topbar) under
  // `routes/wp-admin.layout.tsx`. It still opts out of `BaseLayout`
  // via `handle.layout = 'admin'`, but does not reuse the public
  // login/install left-right split-screen layout above.
  layout('routes/wp-admin.layout.tsx', [
    route('wp-admin', 'routes/wp-admin.dashboard.tsx'),
    route('wp-admin/comments', 'routes/wp-admin.comments.tsx'),
    route('wp-admin/users', 'routes/wp-admin.users.tsx'),
    route('wp-admin/users/:id', 'routes/wp-admin.users.detail.tsx'),
    layout('routes/wp-admin.settings.layout.tsx', [
      route('wp-admin/settings', 'routes/wp-admin.settings.index.tsx'),
      route('wp-admin/settings/general', 'routes/wp-admin.settings.general.tsx'),
      route('wp-admin/settings/navigation', 'routes/wp-admin.settings.navigation.tsx'),
      route('wp-admin/settings/socials', 'routes/wp-admin.settings.socials.tsx'),
      route('wp-admin/settings/content', 'routes/wp-admin.settings.content.tsx'),
      route('wp-admin/settings/sidebar', 'routes/wp-admin.settings.sidebar.tsx'),
      route('wp-admin/settings/comments', 'routes/wp-admin.settings.comments.tsx'),
      route('wp-admin/settings/seo', 'routes/wp-admin.settings.seo.tsx'),
      route('wp-admin/settings/footer', 'routes/wp-admin.settings.footer.tsx'),
      route('wp-admin/settings/mail', 'routes/wp-admin.settings.mail.tsx'),
      route('wp-admin/settings/cache', 'routes/wp-admin.settings.cache.tsx'),
      route('wp-admin/settings/advanced', 'routes/wp-admin.settings.advanced.tsx'),
    ]),
  ]),
] satisfies RouteConfig
