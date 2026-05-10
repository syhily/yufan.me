// Shared blog settings fixtures for the test suite. After the
// per-section settings refactor the codebase has no `DEFAULT_SETTINGS`:
// any route, sidebar, formatter, OG, or thumbhash test that touches
// the runtime config has to seed the in-process snapshot before the
// import chain reaches `requireBlogSettingsSection()`. The setup file
// (tests/setup.ts) installs the bundle once per worker so individual
// tests don't have to.
//
// `TEST_BLOG_SETTINGS_BUNDLE` is the bucketed shape that mirrors the
// on-disk `setting('blog.<section>')` rows. It is the canonical fixture
// — there is no longer a parallel "legacy aggregated `BlogSettings`"
// fixture, because the legacy projection has been deleted from the
// shared module entirely.
//
// Values mirror the historical `DEFAULT_SETTINGS` so snapshot-based
// tests (post detail / home / SEO head / …) keep working without
// their `__snapshots__` files churning every time an unrelated default
// changes. Tests that need a different shape can call
// `setBlogSettingsBundleForTests(custom)` in their own `beforeEach`.
import type { BlogSettingsBundle } from '@/shared/blog-config'

import { CACHE_BUCKET_FALLBACKS } from '@/shared/cache-types'

export const TEST_BLOG_SETTINGS_BUNDLE: BlogSettingsBundle = {
  siteIdentity: {
    title: '且听书吟',
    description: '诗与梦想的远方',
    website: 'https://yufan.me',
    keywords: ['雨帆', '且听书吟', 'syhily', 'amehochan', 'yufan'],
    author: { name: '雨帆', email: 'syhily@gmail.com', url: 'https://yufan.me' },
    locale: 'zh-CN',
    timeZone: 'Asia/Shanghai',
    timeFormat: 'yyyy-MM-dd',
  },
  // Test fixture has the upload toggle ON with a fully-configured
  // bucket so the storage-dispatch / render-enhance suites can
  // exercise the "uploads enabled" path by default and switch the
  // toggle off in individual tests as needed.
  assets: {
    asset: { host: 'cat.yufan.me', scheme: 'https' },
    storage: {
      enabled: true,
      endpoint: 'https://s3.example.com',
      region: 'auto',
      bucket: 'yufan-test',
      accessKeyId: 'AKIA-TEST',
      secretAccessKey: 'secret-test',
      forcePathStyle: false,
      urlTemplate: '',
    },
    upload: { maxBytes: 8 * 1024 * 1024, jpegQuality: 82 },
  },
  navigation: {
    navigation: [
      { text: '首页', link: '/' },
      { text: '分类', link: '/categories' },
      { text: '归档', link: '/archives' },
      { text: '关于', link: '/about' },
      { text: '留言', link: '/guestbook' },
      { text: '友链', link: '/links' },
    ],
  },
  socials: {
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
  },
  content: {
    pagination: { posts: 6, category: 7, tags: 7, search: 7 },
    feed: { full: true, size: 20 },
    post: { sort: 'desc' },
    footnotes: { sectionTitle: '尾声礼记' },
  },
  sidebar: { sidebar: { calendar: true, search: true, comment: 5, post: 5, tag: 10 } },
  comments: { comments: { size: 10, avatar: { mirror: 'https://gravatar.loli.net/avatar', size: 120 } } },
  seo: {
    twitter: 'syhily',
    toc: { minHeadingLevel: 2, maxHeadingLevel: 3 },
    og: { width: 1200, height: 768 },
  },
  footer: { footer: { initialYear: 2011, icpNo: '皖ICP备2021002315号-2' } },
  mail: { mail: { enabled: false, host: 'api.zeabur.com', apiKey: '', sender: 'noreply@send.yufan.me' } },
  cache: {
    cache: {
      og: { ...CACHE_BUCKET_FALLBACKS.og, ttlSeconds: 60 * 60 * 24 * 7 },
      calendar: { ...CACHE_BUCKET_FALLBACKS.calendar, ttlSeconds: 60 * 60 * 24 },
      avatar: { ...CACHE_BUCKET_FALLBACKS.avatar, ttlSeconds: 60 * 60 * 24 * 7 },
      imageMeta: { ...CACHE_BUCKET_FALLBACKS.imageMeta },
      commentsMd: { ...CACHE_BUCKET_FALLBACKS.commentsMd },
    },
  },
  // Rate-limit fixture mirrors the historical hard-coded thresholds
  // so the suite's existing 429 assertions (auth flow, comment reply)
  // keep passing without per-test bundle surgery. Tests that need to
  // exercise the "exceeded" branch in a single hit can override the
  // bucket through `setBlogSettingsBundleForTests({ ..., rateLimit:
  // { ...rateLimit, signInIp: { windowSeconds: 60, maxAttempts: 1 } } })`.
  rateLimit: {
    signInIp: { windowSeconds: 60 * 30, maxAttempts: 5 },
    commentPostIp: { windowSeconds: 60 * 60, maxAttempts: 12 },
    commentPostEmail: { windowSeconds: 60 * 60, maxAttempts: 8 },
    likeIncreaseIp: { windowSeconds: 60 * 60, maxAttempts: 30 },
  },
}
