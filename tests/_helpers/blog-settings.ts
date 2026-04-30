// Shared blog settings fixtures for the test suite. After the
// static-config refactor the codebase has no `DEFAULT_SETTINGS`: any
// route, sidebar, formatter, OG, or thumbhash test that touches the
// runtime config has to seed the in-process snapshot before the import
// chain reaches `requireBlogConfig()`. The setup file (tests/setup.ts)
// installs the bundle once per worker so individual tests don't have
// to.
//
// `TEST_BLOG_SETTINGS` is the legacy aggregated `BlogSettings` shape
// kept around so existing fixtures and `setBlogSettingsSnapshotForTests`
// callers don't have to be rewritten. `TEST_BLOG_SETTINGS_BUNDLE` is
// the bucketed shape that mirrors the on-disk
// `setting('blog.<section>')` rows; new tests should reach for it
// directly.
//
// Values mirror the historical `DEFAULT_SETTINGS` + `BLOG_CONSTANTS`
// pair so snapshot-based tests (post detail / home / SEO head / …)
// keep working without their `__snapshots__` files churning every time
// an unrelated default changes. Tests that need a different shape can
// still call `setBlogSettingsSnapshotForTests(custom)` in their own
// `beforeEach`.
import type { BlogSettings, BlogSettingsBundle } from '@/shared/blog-config'

import { blogSettingsToBundle } from '@/shared/blog-config'

export const TEST_BLOG_SETTINGS: BlogSettings = {
  title: '且听书吟',
  description: '诗与梦想的远方',
  website: 'https://yufan.me',
  keywords: ['雨帆', '且听书吟', 'syhily', 'amehochan', 'yufan'],
  author: { name: '雨帆', email: 'syhily@gmail.com', url: 'https://yufan.me' },
  navigation: [
    { text: '首页', link: '/' },
    { text: '分类', link: '/categories' },
    { text: '归档', link: '/archives' },
    { text: '关于', link: '/about' },
    { text: '留言', link: '/guestbook' },
    { text: '友链', link: '/links' },
  ],
  socials: [
    { name: 'GitHub', network: 'github', type: 'link', link: 'https://github.com/syhily' },
    { name: 'Twitter', network: 'twitter', type: 'link', link: 'https://x.com/amehochan' },
    {
      name: 'Yufan Sheng',
      network: 'wechat',
      type: 'qrcode',
      title: '扫码加我微信好友',
      link: 'https://u.wechat.com/EBpmuKmrVz4YVFnoCJdnruA',
    },
  ],
  settings: {
    asset: { host: 'cat.yufan.me', scheme: 'https' },
    locale: 'zh-CN',
    timeZone: 'Asia/Shanghai',
    timeFormat: 'yyyy-MM-dd',
    twitter: 'syhily',
    pagination: { posts: 6, category: 7, tags: 7, search: 7 },
    feed: { full: true, size: 20 },
    post: { sort: 'desc' },
    sidebar: { calendar: true, search: true, comment: 5, post: 5, tag: 10 },
    comments: { size: 10, avatar: { mirror: 'https://gravatar.loli.net/avatar', size: 120 } },
    toc: { minHeadingLevel: 2, maxHeadingLevel: 3 },
    og: { width: 1200, height: 768 },
    footer: { initialYear: 2011, icpNo: '皖ICP备2021002315号-2' },
    mail: { enabled: false, host: 'api.zeabur.com', apiKey: '', sender: 'noreply@send.yufan.me' },
    cache: {
      og: { prefix: 'og-', ttlSeconds: 60 * 60 * 24 * 7 },
      calendar: { prefix: 'calendar-', ttlSeconds: 60 * 60 * 24 },
      avatar: { prefix: 'avatar-', ttlSeconds: 60 * 60 * 24 * 7 },
    },
  },
}

/**
 * `TEST_BLOG_SETTINGS` decomposed into the bucketed bundle shape the
 * snapshot slot now stores. New tests should consume the bundle
 * directly to mirror what the real loader hands `BlogSettingsProvider`.
 */
export const TEST_BLOG_SETTINGS_BUNDLE: BlogSettingsBundle = blogSettingsToBundle(TEST_BLOG_SETTINGS)
