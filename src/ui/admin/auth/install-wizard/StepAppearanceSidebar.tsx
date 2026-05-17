import type { StepProps } from '@/ui/admin/auth/install-wizard/StepSiteIdentity'

import { useInstallWizard } from '@/ui/admin/auth/install-wizard/InstallWizardContext'
import { Input } from '@/ui/components/input'
import { Label } from '@/ui/components/label'

export function StepAppearanceSidebar(_props: StepProps) {
  const { data, updateData } = useInstallWizard()

  const updateWidget = (index: number, patch: Partial<(typeof data.sidebar.widgets)[number]>) => {
    updateData((prev) => ({
      ...prev,
      sidebar: {
        ...prev.sidebar,
        widgets: prev.sidebar.widgets.map((w, i) => (i === index ? { ...w, ...patch } : w)),
      },
    }))
  }

  const widgetLabels: Record<string, string> = {
    search: '搜索框',
    recentPosts: '最新文章',
    recentComments: '最新评论',
    randomTags: '随机标签',
    todayCalendar: '日历',
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-3">
        <Label>侧边栏组件</Label>
        {data.sidebar.widgets.map((widget, i) => (
          <div key={widget.type} className="flex items-center gap-3 rounded-sm border border-line p-3">
            <input
              type="checkbox"
              id={`w-widget-${widget.type}`}
              checked={widget.enabled}
              onChange={(e) => updateWidget(i, { enabled: e.target.checked })}
              className="h-4 w-4"
            />
            <Label htmlFor={`w-widget-${widget.type}`} className="flex-1 cursor-pointer">
              {widgetLabels[widget.type] ?? widget.type}
            </Label>
            {widget.count !== undefined && widget.enabled && (
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">数量</span>
                <Input
                  type="number"
                  value={widget.count}
                  onChange={(e) => updateWidget(i, { count: Number(e.target.value) })}
                  min={0}
                  max={100}
                  className="w-20"
                />
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="w-font-og">OG 图字体 URL（可选）</Label>
        <Input
          id="w-font-og"
          type="url"
          value={data.fonts.og.url}
          onChange={(e) =>
            updateData((prev) => ({
              ...prev,
              fonts: { ...prev.fonts, og: { url: e.target.value } },
            }))
          }
          placeholder="https://cdn.example.com/font.ttf"
        />
        <p className="text-xs text-muted-foreground">TTF/OTF 格式，留空使用系统字体。</p>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="w-font-calendar">日历字体 URL（可选）</Label>
        <Input
          id="w-font-calendar"
          type="url"
          value={data.fonts.calendar.url}
          onChange={(e) =>
            updateData((prev) => ({
              ...prev,
              fonts: { ...prev.fonts, calendar: { url: e.target.value } },
            }))
          }
          placeholder="https://cdn.example.com/font.ttf"
        />
      </div>
    </div>
  )
}
