import { z } from 'astro/zod';

// The type of the options, use zod for better validation.
const Options = z.object({
  local: z
    .object({
      port: z.number(),
    })
    .transform((local) => ({ ...local, website: `http://localhost${local.port}` })),
  title: z.string().max(40),
  website: z.string().url(),
  description: z.string().max(100),
  keywords: z.array(z.string()),
  author: z.object({ name: z.string(), email: z.string().email(), url: z.string().url() }),
  navigation: z.array(z.object({ text: z.string(), link: z.string(), target: z.string().optional() })),
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
    initialYear: z.number().max(2024),
    icpNo: z.string().optional(),
    locale: z.string().optional().default('zh-CN'),
    timeZone: z.string().optional().default('Asia/Shanghai'),
    timeFormat: z.string().optional().default('yyyy-MM-dd HH:mm:ss'),
    twitter: z.string(),
    assetPrefix: z.string().url().readonly(),
    post: z.object({
      sort: z.enum(['asc', 'desc']),
      feature: z.array(z.string()).optional(),
      category: z.array(z.string()).optional(),
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
    }),
    comments: z.object({
      server: z.string().url().readonly(),
      admins: z.array(z.number()),
    }),
  }),
});

const options = {
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
    {
      text: '笔记',
      link: 'https://note.yufan.me',
      target: '_blank',
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
      name: 'Twitter',
      icon: 'icon-twitter',
      type: 'link',
      link: 'https://twitter.com/amehochan',
    },
    {
      name: 'Wechat',
      icon: 'icon-wechat',
      type: 'qrcode',
      title: '扫码加我微信好友',
      link: 'https://u.wechat.com/EBpmuKmrVz4YVFnoCJdnruA',
    },
  ],
  settings: {
    initialYear: 2011,
    icpNo: '皖ICP备2021002315号-2',
    locale: 'zh-CN',
    timeZone: 'Asia/Shanghai',
    timeFormat: 'yyyy-MM-dd',
    twitter: 'amehochan',
    assetPrefix: 'https://cat.yufan.me',
    post: {
      sort: 'desc',
      feature: ['secret-of-boys-mind', 'my-darling', 'happiness-caprice'],
      category: ['article', 'think', 'gossip', 'coding'],
    },
    pagination: {
      posts: 5,
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
      post: 6,
      comment: 6,
      tag: 20,
    },
    comments: {
      server: 'https://comment.yufan.me',
      admins: [3],
    },
  },
};

export default Options.parse(options);
