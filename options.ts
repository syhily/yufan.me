import process from 'node:process'
import { z } from 'astro/zod'

const isProd = (): boolean => import.meta.env.MODE === 'production' || process.env.NODE_ENV === 'production'

export type Navigation = z.infer<typeof Options>['navigation']

// The type of the options, use zod for better validation.
const Options = z
  .object({
    local: z
      .object({
        port: z.number(),
      })
      .transform(local => ({ ...local, website: `http://localhost:${local.port}` })),
    title: z.string().max(40),
    website: z
      .string()
      .url()
      .refine(u => !u.endsWith('/'))
      .readonly(),
    description: z.string().max(100),
    keywords: z.array(z.string()),
    author: z.object({ name: z.string(), email: z.string().email(), url: z.string().url() }),
    navigation: z.array(z.object({ text: z.string().trim(), link: z.string(), target: z.string().optional() })),
    socials: z.array(
      z.object({
        name: z.string(),
        icon: z.string(),
        type: z.enum(['link', 'qrcode']),
        title: z.string().optional(),
        link: z.string().url(),
      }),
    ),
    settings: z.object({
      footer: z.object({
        initialYear: z.number().max(2024),
        icpNo: z.string().optional(),
        moeIcpNo: z.string().optional(),
      }),
      locale: z.string().optional().default('zh-CN'),
      timeZone: z.string().optional().default('Asia/Shanghai'),
      timeFormat: z.string().optional().default('yyyy-MM-dd HH:mm:ss'),
      twitter: z.string(),
      assetPrefix: z
        .string()
        .url()
        .refine(u => !u.endsWith('/'))
        .readonly(),
      post: z.object({
        sort: z.enum(['asc', 'desc']),
        feature: z.array(z.string()).min(3).optional(),
      }),
      pagination: z.object({
        posts: z.number().optional().default(5),
        category: z.number().optional().default(7),
        tags: z.number().optional().default(7),
        search: z.number().optional().default(7),
      }),
      feed: z.object({
        full: z.boolean().optional().default(true),
        size: z.number().optional().default(20),
      }),
      sidebar: z.object({
        search: z.boolean().default(false),
        post: z.number().default(6),
        comment: z.number().default(0),
        tag: z.number().default(20),
        calendar: z.boolean().default(false),
      }),
      comments: z.object({
        size: z.number().default(10).readonly(),
        avatar: z.object({
          mirror: z.string().url().readonly(),
          size: z.number(),
        }),
      }),
      toc: z.object({
        minHeadingLevel: z.number().optional().default(2),
        maxHeadingLevel: z.number().optional().default(3),
      }),
    }),
    thumbnail: z
      .function()
      .args(z.object({ src: z.string().min(1), width: z.number().or(z.string()), height: z.number().or(z.string()) }))
      .returns(z.string()),
  })
  .transform((opts) => {
    const assetsPrefix = (): string => (isProd() ? opts.settings.assetPrefix : opts.local.website)
    return {
      ...opts,
      // Monkey patch for the issue https://github.com/withastro/astro/issues/11282
      // No need to fallback to the import.meta.env.PROD I think.
      isProd,
      // Given that the import.meta.env.ASSETS_PREFIX has two types.
      // I have to use this uniform method instead.
      assetsPrefix,
      defaultOpenGraph: (): string => `${assetsPrefix()}/images/open-graph.png`,
    }
  })
  .refine(
    options => options.settings.toc.minHeadingLevel <= options.settings.toc.maxHeadingLevel,
    'Invalid toc setting, the minHeadingLevel should bellow the maxHeadingLevel',
  )

const options: z.input<typeof Options> = {
  local: {
    port: 4321,
  },
  title: '且听书吟',
  website: 'https://yufan.me',
  description: '诗与梦想的远方',
  keywords: ['雨帆', '且听书吟', 'syhily', 'amehochan', 'yufan'],
  author: {
    name: '雨帆',
    email: 'syhily@gmail.com',
    url: 'https://yufan.me',
  },
  navigation: [
    {
      text: '首页',
      link: '/',
    },
    {
      text: '分类',
      link: '/categories',
    },
    {
      text: '关于',
      link: '/about',
    },
    {
      text: '留言',
      link: '/guestbook',
    },
    {
      text: '友链',
      link: '/links',
    },
  ],
  socials: [
    {
      name: 'GitHub',
      icon: 'icon-github-fill',
      type: 'link',
      link: 'https://github.com/syhily',
    },
    {
      name: 'Follow',
      icon: '<svg viewBox="0 0 83 80"><g stroke="none" stroke-width="1" fill="none" fill-rule="evenodd"><g transform="translate(0.6377, 0.6948)" fill="#FFFFFF" fill-rule="nonzero"><path d="M70.9713,-7.10542736e-15 L20.9446,-7.10542736e-15 C14.895,-7.10542736e-15 9.9907,4.8998 9.9907,10.944 C9.9907,16.9882 14.895,21.888 20.9446,21.888 L70.9713,21.888 C77.0213,21.888 81.9253,16.9882 81.9253,10.944 C81.9253,4.8998 77.0213,-7.10542736e-15 70.9713,-7.10542736e-15 Z" id="Path"></path><path d="M44.2971,28.4541 L10.9539,28.4541 C4.9042,28.4541 -7.10542736e-15,33.3539 -7.10542736e-15,39.3981 C-7.10542736e-15,45.4423 4.9042,50.3421 10.9539,50.3421 L44.2971,50.3421 C50.3468,50.3421 55.2511,45.4423 55.2511,39.3981 C55.2511,33.3539 50.3468,28.4541 44.2971,28.4541 Z" id="Path"></path><path d="M47.5231,67.8762 C47.5231,61.8324 42.6188,56.9326 36.5691,56.9326 C30.5195,56.9326 25.6152,61.8324 25.6152,67.8762 C25.6152,73.9212 30.5195,78.8202 36.5691,78.8202 C42.6188,78.8202 47.5231,73.9212 47.5231,67.8762 Z" id="Path"></path></g></g></svg>',
      type: 'link',
      link: 'https://app.follow.is/share/feeds/54772566650461214',
    },
    {
      name: '微信',
      icon: 'icon-wechat',
      type: 'qrcode',
      title: '扫码加我微信好友',
      link: 'https://u.wechat.com/EBpmuKmrVz4YVFnoCJdnruA',
    },
  ],
  settings: {
    footer: {
      initialYear: 2011,
      icpNo: '皖ICP备2021002315号-2',
    },
    locale: 'zh-CN',
    timeZone: 'Asia/Shanghai',
    timeFormat: 'yyyy-MM-dd',
    twitter: 'amehochan',
    assetPrefix: 'https://cat.yufan.me',
    post: {
      sort: 'desc',
    },
    pagination: {
      posts: 6,
      category: 7,
      tags: 7,
      search: 7,
    },
    feed: {
      full: true,
      size: 10,
    },
    sidebar: {
      search: true,
      post: 5,
      comment: 5,
      tag: 10,
      calendar: true,
    },
    comments: {
      size: 10,
      avatar: {
        mirror: 'https://gravatar.com/avatar',
        size: 120,
      },
    },
    toc: {
      minHeadingLevel: 2,
      maxHeadingLevel: 3,
    },
  },
  thumbnail: ({ src, width, height }) => {
    if (src.endsWith('.svg')) {
      return src
    }
    if (isProd()) {
      // Add upyun thumbnail support.
      return `${src}!upyun520/both/${width}x${height}/format/webp/quality/100/unsharp/true/progressive/true`
    }
    // See https://docs.astro.build/en/reference/image-service-reference/#local-services
    // Remember to add the localhost to you image service settings.
    return `http://localhost:4321/_image?href=${src}&w=${width}&h=${height}&f=webp&q=100`
  },
}

export default Options.parse(options)
