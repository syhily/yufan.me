/** Branded social entry in `socials`; Header maps each value to a fixed icon. */
export type SocialNetwork = 'github' | 'twitter' | 'wechat' | 'weibo' | 'qq'

// Single source of truth for blog-wide configuration. Every field is safe to
// reference from both server (loaders, feeds, OG images, comment APIs) and
// client (Header, Sidebar, navigation, …) modules. The value is a plain
// JS object today; in the future it will be replaced by a database-backed
// config so we keep all knobs in one shape rather than splitting by surface.
const config: BlogConfig = {
  title: '且听书吟',
  description: '诗与梦想的远方',
  website: 'https://yufan.me',
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
      text: '归档',
      link: '/archives',
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
      network: 'github',
      type: 'link',
      link: 'https://github.com/syhily',
    },
    {
      name: 'Twitter',
      network: 'twitter',
      type: 'link',
      link: 'https://x.com/amehochan',
    },
    {
      name: 'Yufan Sheng',
      network: 'wechat',
      type: 'qrcode',
      title: '扫码加我微信好友',
      link: 'https://u.wechat.com/EBpmuKmrVz4YVFnoCJdnruA',
    },
  ],
  settings: {
    asset: {
      host: 'cat.yufan.me',
      scheme: 'https',
    },
    footer: {
      initialYear: 2011,
      icpNo: '皖ICP备2021002315号-2',
    },
    locale: 'zh-CN',
    timeZone: 'Asia/Shanghai',
    timeFormat: 'yyyy-MM-dd',
    twitter: 'syhily',
    pagination: {
      posts: 6,
      category: 7,
      tags: 7,
      search: 7,
    },
    feed: {
      full: true,
      size: 20,
    },
    post: {
      sort: 'desc',
    },
    sidebar: {
      calendar: true,
      search: true,
      comment: 5,
      post: 5,
      tag: 10,
    },
    comments: {
      size: 10,
      avatar: {
        mirror: 'https://gravatar.loli.net/avatar',
        size: 120,
      },
    },
    toc: {
      minHeadingLevel: 2,
      maxHeadingLevel: 3,
    },
    og: {
      width: 1200,
      height: 768,
    },
  },
}

export const assetConfig = config.settings.asset

export interface BlogConfig {
  title: string
  description: string
  website: string
  keywords: string[]
  author: { name: string; email: string; url: string }
  navigation: { text: string; link: string; target?: string }[]
  socials: {
    name: string
    network: SocialNetwork
    type: 'link' | 'qrcode'
    title?: string
    link: string
  }[]
  settings: {
    asset: {
      host: string
      scheme: 'http' | 'https'
    }
    footer: {
      initialYear: number
      icpNo?: string
      moeIcpNo?: string
    }
    locale: string
    timeZone: string
    timeFormat: string
    twitter: string
    pagination: {
      posts: number
      category: number
      tags: number
      search: number
    }
    feed: {
      full: boolean
      size: number
    }
    post: {
      sort: 'asc' | 'desc'
      feature?: string[]
    }
    sidebar: {
      calendar: boolean
      search: boolean
      /** Number of recent / pending comments shown in the sidebar widget. */
      comment: number
      /** Random-pick window for the sidebar's recommended posts widget. */
      post: number
      /** Random-pick window for the sidebar's tag cloud widget. */
      tag: number
    }
    comments: {
      /** Page size for the inline comment thread (used on both client and server). */
      size: number
      avatar: {
        mirror: string
        size: number
      }
    }
    toc: {
      minHeadingLevel: number
      maxHeadingLevel: number
    }
    og: {
      width: number
      height: number
    }
  }
}

export default config
