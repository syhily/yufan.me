import type { ReactNode } from 'react'

import { NavLink, useLocation } from 'react-router'

import { cn } from '@/ui/admin/shadcn/lib/utils'

interface SectionLink {
  to: string
  label: string
  description: string
}

const SECTIONS: SectionLink[] = [
  { to: '/wp-admin/settings/general', label: '基本信息', description: '站点标题、描述、关键词、作者' },
  { to: '/wp-admin/settings/localization', label: '资源与本地化', description: 'CDN 域名、语言、时区、日期格式' },
  { to: '/wp-admin/settings/navigation', label: '导航菜单', description: '顶部导航条目顺序与链接' },
  { to: '/wp-admin/settings/socials', label: '社交链接', description: 'Header 中显示的社交账号 / 二维码' },
  { to: '/wp-admin/settings/content', label: '内容与分页', description: '列表分页大小、排序、Feed' },
  { to: '/wp-admin/settings/sidebar', label: '侧边栏', description: '日历、搜索、推荐数量等开关' },
  { to: '/wp-admin/settings/comments', label: '评论与头像', description: '评论分页与 Gravatar 镜像' },
  { to: '/wp-admin/settings/seo', label: 'SEO 与目录', description: 'Twitter handle、TOC 标题级别' },
  { to: '/wp-admin/settings/footer', label: '页脚', description: '起始年份、ICP 备案号' },
  { to: '/wp-admin/settings/mail', label: '邮件服务', description: 'Zeabur ZSend 配置 / 测试发送' },
  { to: '/wp-admin/settings/cache', label: '缓存管理', description: 'OG 图 / 头像 / 日历的 Redis 缓存' },
]

interface SettingsShellProps {
  children: ReactNode
}

export function SettingsShell({ children }: SettingsShellProps) {
  // Pick out the current section so the mobile collapsed picker can
  // show "currently editing: <section>" without expanding. Falls
  // back to the first entry when the URL doesn't match (shouldn't
  // happen in normal navigation, but defensively the picker should
  // still render *something*).
  const location = useLocation()
  const activeSection =
    SECTIONS.find((section) => location.pathname === section.to || location.pathname.startsWith(`${section.to}/`)) ??
    SECTIONS[0]

  return (
    <div className="tw:flex tw:flex-col tw:gap-6">
      <header>
        <h1 className="tw:text-2xl tw:font-semibold tw:tracking-tight">系统设置</h1>
        <p className="tw:text-muted-foreground tw:text-sm">
          这里管理博客的运行期配置，修改后立即生效，无需重新部署。CDN 域名同时由部署期 ENV 变量提供给 MDX
          编译流水线，请确保两边数值一致。
        </p>
      </header>
      {/*
       * Mobile (< lg): 1 column, ROW gap separates the collapsible
       * picker from the content (24px reads as one section break).
       * Desktop (≥ lg): 2 columns; the COLUMN gap between sub-nav
       * and content cards is intentionally tightened from 24px to
       * 16px so the editor's visual scan path between picking a
       * section on the left and seeing its cards on the right
       * doesn't cross a wide chasm.
       */}
      <div className="tw:grid tw:gap-6 tw:lg:grid-cols-[14rem_minmax(0,1fr)] tw:lg:gap-x-4 tw:lg:gap-y-0">
        {/*
         * Section nav is rendered TWICE — once for mobile (<lg) as a
         * collapsible <details> picker, once for desktop (≥lg) as
         * the persistent sidebar. Twin trees beats a runtime media
         * query because:
         *  - SSR returns the right markup for either viewport,
         *  - the collapsed/expanded animation is owned by the
         *    browser's native <details> element, no JS state.
         *
         * Re-keying the <details> by `activeSection.to` lets the
         * picker auto-collapse when the editor lands on a new
         * section (a fresh DOM node has `open === false`).
         */}
        <details key={activeSection.to} className="tw:group tw:rounded-md tw:border tw:bg-card tw:lg:hidden">
          <summary className="tw:flex tw:cursor-pointer tw:list-none tw:items-center tw:justify-between tw:gap-3 tw:px-3 tw:py-2.5 tw:text-sm tw:[&::-webkit-details-marker]:hidden">
            <div className="tw:flex tw:flex-col tw:gap-0.5 tw:min-w-0">
              <span className="tw:text-muted-foreground tw:text-xs tw:uppercase tw:tracking-wide">当前页签</span>
              <span className="tw:font-medium tw:truncate">{activeSection.label}</span>
            </div>
            <span
              aria-hidden="true"
              className="tw:text-muted-foreground tw:transition-transform tw:group-open:rotate-180"
            >
              ▾
            </span>
          </summary>
          <nav className="tw:flex tw:flex-col tw:gap-1 tw:border-t tw:p-2">
            {SECTIONS.map((section) => (
              <NavLink
                key={section.to}
                to={section.to}
                prefetch="intent"
                className={({ isActive }) =>
                  cn(
                    'tw:flex tw:flex-col tw:gap-0.5 tw:rounded-md tw:px-3 tw:py-2 tw:text-sm tw:transition-colors',
                    isActive
                      ? 'tw:bg-sidebar-accent tw:text-sidebar-accent-foreground'
                      : 'tw:text-foreground/80 tw:hover:bg-sidebar-accent/60 tw:hover:text-sidebar-accent-foreground',
                  )
                }
              >
                <span className="tw:font-medium">{section.label}</span>
                <span className="tw:text-muted-foreground tw:text-xs">{section.description}</span>
              </NavLink>
            ))}
          </nav>
        </details>

        <aside className="tw:hidden tw:flex-col tw:gap-1 tw:lg:flex">
          {SECTIONS.map((section) => (
            <NavLink
              key={section.to}
              to={section.to}
              prefetch="intent"
              className={({ isActive }) =>
                cn(
                  'tw:flex tw:flex-col tw:gap-0.5 tw:rounded-md tw:px-3 tw:py-2 tw:text-sm tw:transition-colors',
                  isActive
                    ? 'tw:bg-sidebar-accent tw:text-sidebar-accent-foreground'
                    : 'tw:text-foreground/80 tw:hover:bg-sidebar-accent/60 tw:hover:text-sidebar-accent-foreground',
                )
              }
            >
              <span className="tw:font-medium">{section.label}</span>
              <span className="tw:text-muted-foreground tw:text-xs">{section.description}</span>
            </NavLink>
          ))}
        </aside>

        <section className="tw:min-w-0">{children}</section>
      </div>
    </div>
  )
}
