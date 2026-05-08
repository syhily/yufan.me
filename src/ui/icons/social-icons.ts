import type { ComponentType } from 'react'

import type { SocialNetwork } from '@/shared/socials'

import { GithubIcon, type IconProps, QQIcon, TwitterIcon, WechatIcon, WeiboIcon } from '@/ui/icons/brand-social-icons'

// Single source of truth for the `SocialNetwork → icon component`
// mapping shared by the public Header and the admin SocialsEditor.
//
// Keeping this table object-shaped (rather than a string-key lookup
// inside a switch) lets the bundler statically resolve the icon module
// for each branch — see Vercel `bundle-analyzable-paths`. New social
// platforms must add an entry here AND in
// `@/shared/socials.ts → SOCIAL_NETWORKS`.
export const SOCIAL_NETWORK_ICONS: Record<SocialNetwork, ComponentType<IconProps>> = {
  github: GithubIcon,
  twitter: TwitterIcon,
  wechat: WechatIcon,
  weibo: WeiboIcon,
  qq: QQIcon,
}
