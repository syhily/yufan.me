import { type RouteConfig, index, layout, route } from '@react-router/dev/routes'

// React Router loads this manifest before Vite aliases are registered.
import { API_ACTIONS } from './client/api/actions'

export default [
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
  route(API_ACTIONS.comment.getFilterOptions.route, 'routes/api/actions/comment.getFilterOptions.ts'),
  route(API_ACTIONS.comment.loadAll.route, 'routes/api/actions/comment.loadAll.ts'),
  layout('routes/admin.layout.tsx', [
    route('wp-login.php', 'routes/wp-login.tsx'),
    route('wp-admin', 'routes/wp-admin.tsx'),
    route('wp-admin/install.php', 'routes/wp-admin.install.tsx'),
  ]),
  // Splat MUST stay last. React Router treats `*` as the lowest-priority
  // match, so this only fires for paths nothing else handles (multi-segment
  // WordPress probes such as `/wp-content/plugins/x.php`, `/cgi-bin/test`,
  // `/wp-includes/wlwmanifest.xml`, …). Single-segment `.php` or `cgi-bin`
  // probes hit `:slug` first and are intercepted in `routes/page.detail.tsx`.
  route('*', 'routes/not-found.tsx'),
] satisfies RouteConfig
