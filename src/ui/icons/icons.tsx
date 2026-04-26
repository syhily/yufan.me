// Per-icon React components, one named export per SVG under
// `src/ui/icons/svg/*.svg`. Call sites import the icon they need by name
// (`import { MenuIcon } from '@/ui/icons/icons'`) so Rolldown can prune the
// rest from the client bundle (`bundle-analyzable-paths`).
//
// Each SVG is loaded at module evaluation time via Vite's `?raw` query and
// parsed once into the shape `<Icon>` used to compute. The component itself
// is a thin wrapper around `renderInlineIcon` that fixes the icon name + the
// parsed payload.

import { parseSvg, renderInlineIcon, type IconName, type IconProps, type ParsedIcon } from '@/ui/icons/Icon'
import arrowupRaw from '@/ui/icons/svg/arrowup.svg?raw'
import checkRaw from '@/ui/icons/svg/check.svg?raw'
import closeRaw from '@/ui/icons/svg/close.svg?raw'
import commentRaw from '@/ui/icons/svg/comment.svg?raw'
import deleteRaw from '@/ui/icons/svg/delete.svg?raw'
import editRaw from '@/ui/icons/svg/edit.svg?raw'
import ellipsisRaw from '@/ui/icons/svg/ellipsis.svg?raw'
import eyeRaw from '@/ui/icons/svg/eye.svg?raw'
import githubFillRaw from '@/ui/icons/svg/github-fill.svg?raw'
import heartFillRaw from '@/ui/icons/svg/heart-fill.svg?raw'
import leftRaw from '@/ui/icons/svg/left.svg?raw'
import linkRaw from '@/ui/icons/svg/link.svg?raw'
import menuRaw from '@/ui/icons/svg/menu.svg?raw'
import qqRaw from '@/ui/icons/svg/qq.svg?raw'
import refreshRaw from '@/ui/icons/svg/refresh.svg?raw'
import replyRaw from '@/ui/icons/svg/reply.svg?raw'
import rightRaw from '@/ui/icons/svg/right.svg?raw'
import searchRaw from '@/ui/icons/svg/search.svg?raw'
import twitterRaw from '@/ui/icons/svg/twitter.svg?raw'
import userRaw from '@/ui/icons/svg/user.svg?raw'
import wechatRaw from '@/ui/icons/svg/wechat.svg?raw'
import weiboRaw from '@/ui/icons/svg/weibo.svg?raw'

function defineIcon(name: string, raw: string) {
  const parsed: ParsedIcon = parseSvg(raw)
  function IconComponent({ size, title, className }: IconProps) {
    return renderInlineIcon({ icon: parsed, name, size, title, className })
  }
  IconComponent.displayName = `Icon(${name})`
  return IconComponent
}

export const ArrowUpIcon = defineIcon('arrowup', arrowupRaw)
export const CheckIcon = defineIcon('check', checkRaw)
export const CloseIcon = defineIcon('close', closeRaw)
export const CommentIcon = defineIcon('comment', commentRaw)
export const DeleteIcon = defineIcon('delete', deleteRaw)
export const EditIcon = defineIcon('edit', editRaw)
export const EllipsisIcon = defineIcon('ellipsis', ellipsisRaw)
export const EyeIcon = defineIcon('eye', eyeRaw)
export const GithubFillIcon = defineIcon('github-fill', githubFillRaw)
export const HeartFillIcon = defineIcon('heart-fill', heartFillRaw)
export const LeftIcon = defineIcon('left', leftRaw)
export const LinkIcon = defineIcon('link', linkRaw)
export const MenuIcon = defineIcon('menu', menuRaw)
export const QqIcon = defineIcon('qq', qqRaw)
export const RefreshIcon = defineIcon('refresh', refreshRaw)
export const ReplyIcon = defineIcon('reply', replyRaw)
export const RightIcon = defineIcon('right', rightRaw)
export const SearchIcon = defineIcon('search', searchRaw)
export const TwitterIcon = defineIcon('twitter', twitterRaw)
export const UserIcon = defineIcon('user', userRaw)
export const WechatIcon = defineIcon('wechat', wechatRaw)
export const WeiboIcon = defineIcon('weibo', weiboRaw)

export type IconComponent = (props: IconProps) => ReturnType<typeof renderInlineIcon>

// Stable name → component map used by the small number of call sites that
// genuinely choose an icon from runtime configuration (social links, QR
// dialog triggers, share buttons). Component identities are passed through
// rather than string keys, so the bundler retains every entry but each
// import is still resolved through `@/ui/icons/icons` (no `import.meta.glob`
// plumbing). The union narrowing on `name` keeps typos from compiling.
export const iconByName: { readonly [Name in IconName]: IconComponent } = {
  arrowup: ArrowUpIcon,
  check: CheckIcon,
  close: CloseIcon,
  comment: CommentIcon,
  delete: DeleteIcon,
  edit: EditIcon,
  ellipsis: EllipsisIcon,
  eye: EyeIcon,
  'github-fill': GithubFillIcon,
  'heart-fill': HeartFillIcon,
  left: LeftIcon,
  link: LinkIcon,
  menu: MenuIcon,
  qq: QqIcon,
  refresh: RefreshIcon,
  reply: ReplyIcon,
  right: RightIcon,
  search: SearchIcon,
  twitter: TwitterIcon,
  user: UserIcon,
  wechat: WechatIcon,
  weibo: WeiboIcon,
}

export interface DynamicIconProps extends IconProps {
  name: IconName
}

// Thin dispatcher used by the few config-driven call sites. New code should
// import the specific icon component instead, but this lets `social.icon` /
// QR dialog triggers stay declarative without resurrecting the string-keyed
// `<Icon name="…" />` lookup that hid every icon behind `import.meta.glob`.
export function DynamicIcon({ name, ...props }: DynamicIconProps) {
  const IconComp = iconByName[name]
  return <IconComp {...props} />
}

// Backwards-compatible alias kept exclusively for the admin surface
// (`src/ui/admin/*`), which is intentionally out of scope for the
// static-import migration. New code should import the specific icon
// component instead. Internally just forwards to `DynamicIcon`.
export const Icon = DynamicIcon
