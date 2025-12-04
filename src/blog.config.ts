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
      icon: 'icon-github-fill',
      type: 'link',
      link: 'https://github.com/syhily',
    },
    {
      name: 'Follow',
      icon: 'icon-follow-rss',
      type: 'link',
      link: 'https://app.folo.is/share/feeds/54772566650461214',
    },
    {
      name: 'Yufan Sheng',
      icon: 'icon-wechat',
      type: 'qrcode',
      title: '扫码加我微信好友',
      link: 'https://u.wechat.com/EBpmuKmrVz4YVFnoCJdnruA',
    },
  ],
  settings: {
    asset: {
      host: 'asset.yufan.me',
      scheme: 'https',
    },
    footer: {
      initialYear: 2011,
      icpNo: '皖ICP备2021002315号-2',
    },
    locale: 'zh-CN',
    timeZone: 'Asia/Shanghai',
    timeFormat: 'yyyy-MM-dd',
    twitter: 'amehochan',
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
      size: 20,
    },
    sidebar: {
      calendar: true,
      search: true,
      post: 5,
      comment: 5,
      tag: 10,
    },
    comments: {
      size: 10,
      avatar: {
        mirror: 'https://cn.cravatar.com/avatar',
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

export interface BlogConfig {
  title: string
  description: string
  website: string
  keywords: string[]
  author: { name: string, email: string, url: string }
  navigation: { text: string, link: string, target?: string }[]
  socials: { name: string, icon: string, type: 'link' | 'qrcode', title?: string, link: string }[]
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
    post: {
      sort: 'asc' | 'desc'
      feature?: string[]
    }
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
    sidebar: {
      calendar: boolean
      search: boolean
      post: number
      comment: number
      tag: number
    }
    comments: {
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
