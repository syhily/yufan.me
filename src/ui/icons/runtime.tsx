// Runtime icon dispatcher. Lives in its own module so call sites that
// pull a specific icon by name (`import { MenuIcon } from '@/ui/icons/icons'`)
// never drag the full 22-icon name → component map into their chunk —
// see the `bundle-analyzable-paths` rule in
// `.claude/skills/vercel-react-best-practices`.
//
// The map below exists for the handful of consumers that genuinely
// pick an icon at runtime (header social-link list, share buttons,
// QR-dialog triggers driven by `blog.config.ts`). Everything else
// imports the per-icon component directly so Rolldown can prune the
// rest from the page chunk.
//
// `<DynamicIcon name="…" />` is the typed dispatcher. It accepts the
// same `IconProps` envelope as every other icon and narrows `name`
// against the `IconName` union, so typos fail to compile.

import type { IconName, IconProps } from '@/ui/icons/Icon'
import type { IconComponent } from '@/ui/icons/icons'

import {
  ArrowUpIcon,
  CheckIcon,
  CloseIcon,
  CommentIcon,
  DeleteIcon,
  EditIcon,
  EllipsisIcon,
  EyeIcon,
  GithubIcon,
  HeartIcon,
  LeftIcon,
  LinkIcon,
  MenuIcon,
  QqIcon,
  RefreshIcon,
  ReplyIcon,
  RightIcon,
  SearchIcon,
  TwitterIcon,
  UserIcon,
  WechatIcon,
  WeiboIcon,
} from '@/ui/icons/icons'

// Stable name → component map used by the small number of call sites that
// genuinely choose an icon from runtime configuration (social links, QR
// dialog triggers, share buttons). Component identities are passed
// through rather than string keys, so the bundler retains every entry but
// each import is still resolved through `@/ui/icons/icons` (no
// `import.meta.glob` plumbing). The union narrowing on `name` keeps
// typos from compiling.
export const iconByName: { readonly [Name in IconName]: IconComponent } = {
  arrowup: ArrowUpIcon,
  check: CheckIcon,
  close: CloseIcon,
  comment: CommentIcon,
  delete: DeleteIcon,
  edit: EditIcon,
  ellipsis: EllipsisIcon,
  eye: EyeIcon,
  github: GithubIcon,
  heart: HeartIcon,
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

// Thin dispatcher used by the few config-driven call sites
// (`social.icon`, share buttons, QR dialog triggers). New code should
// import the specific icon component instead, but this keeps declarative
// runtime selection working without resurrecting the string-keyed
// `<Icon name="…" />` lookup that used to hide every icon behind
// `import.meta.glob`.
export function DynamicIcon({ name, ...props }: DynamicIconProps) {
  const IconComp = iconByName[name]
  return <IconComp {...props} />
}
