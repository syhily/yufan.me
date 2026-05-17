import { ArrowRightIcon, EyeIcon, GlobeIcon, UsersIcon } from 'lucide-react'
import { Link } from 'react-router'

import type { CountersDto } from '@/shared/contracts/analytics'

import { Button } from '@/ui/components/button'

// Compact 24-hour visit statistics card for the welcome page. Sits
// alongside the pending-moderation panel in a two-column grid.

interface VisitSummaryCardProps {
  summary: CountersDto
}

interface KpiEntry {
  label: string
  value: number
  icon: typeof EyeIcon
}

const KPI_ENTRIES: KpiEntry[] = [
  { label: '访问量', value: 0, icon: EyeIcon },
  { label: '访客数', value: 0, icon: UsersIcon },
  { label: '来源域名', value: 0, icon: GlobeIcon },
]

export function VisitSummaryCard({ summary }: VisitSummaryCardProps) {
  const values = [summary.visits, summary.visitors, summary.referers]

  return (
    <div className="flex h-full min-h-[280px] flex-col rounded-lg border bg-card p-5">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-lg font-medium">今日概览</h2>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          render={<Link to="/wp-admin/analytics/overview?preset=today" />}
        >
          <span className="hidden sm:inline">查看详情</span> <ArrowRightIcon data-icon />
        </Button>
      </div>
      <p className="mt-1 text-sm text-muted-foreground">最近 24 小时访问统计</p>

      <ul className="mt-6 flex flex-1 flex-col justify-center gap-5">
        {KPI_ENTRIES.map((entry, i) => {
          const Icon = entry.icon
          return (
            <li key={entry.label} className="flex items-center gap-3">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-status-info-bg">
                <Icon aria-hidden="true" className="size-5 text-status-info-fg" strokeWidth={1.8} />
              </div>
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground">{entry.label}</p>
                <p className="text-xl font-semibold tabular-nums">{values[i]?.toLocaleString() ?? 0}</p>
              </div>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
