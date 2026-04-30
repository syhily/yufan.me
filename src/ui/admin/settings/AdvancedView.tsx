import type { BlogConstants } from '@/server/settings/defaults'

import { ReadOnlyField, SettingsSection } from '@/ui/admin/settings/SettingsSection'

interface AdvancedViewProps {
  constants: BlogConstants
}

// Display-only view of bucket-A constants. These values are baked into
// the client bundle (asset host) or the server image renderer (OG
// dimensions) at build time, so editing them in the admin UI would have
// no effect until the next deploy. The page surfaces them for visibility:
// editors can confirm what's currently in production without grepping
// the codebase, and the description tells them what to do if they need
// to change anything here.
export function AdvancedView({ constants }: AdvancedViewProps) {
  return (
    <div className="tw:flex tw:flex-col tw:gap-6">
      <SettingsSection
        title="静态资源域名"
        description="图片 / 音乐 / 头像等远程资源的 CDN 域名。该值嵌入了客户端构建产物，修改需要更新 blog.config.ts 并重新部署。"
      >
        <ReadOnlyField label="协议" value={constants.asset.scheme} />
        <ReadOnlyField label="域名" value={constants.asset.host} />
      </SettingsSection>

      <SettingsSection
        title="时间与本地化"
        description="日期格式化由共享格式化函数处理，会同时进入服务端和客户端 bundle，无法在运行期更改。"
      >
        <ReadOnlyField label="语言" value={constants.locale} />
        <ReadOnlyField label="时区" value={constants.timeZone} />
        <ReadOnlyField label="日期格式" value={constants.timeFormat} />
      </SettingsSection>
    </div>
  )
}
