import { useCallback } from 'react'
import { useNavigation, useSubmit } from 'react-router'

import type { StepProps } from '@/ui/admin/auth/install-wizard/StepSiteIdentity'

import { useInstallWizard } from '@/ui/admin/auth/install-wizard/InstallWizardContext'
import { Button } from '@/ui/components/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/ui/components/card'

export function StepConfirm({ csrf }: StepProps) {
  const { data, prevStep } = useInstallWizard()
  const submit = useSubmit()
  const navigation = useNavigation()
  const isSubmitting = navigation.state === 'submitting' && navigation.formMethod === 'POST'

  const handleSubmit = useCallback(() => {
    const formData = new FormData()
    formData.append('csrf', csrf)
    formData.append('payload', JSON.stringify(data))
    void submit(formData, { method: 'post' })
  }, [csrf, data, submit])

  return (
    <div className="flex flex-col gap-5">
      <h2 className="text-lg font-semibold">确认配置</h2>
      <p className="text-sm text-muted-foreground">请检查以下配置摘要。确认无误后点击「完成初始化并进入后台」。</p>

      {/* Step 1 · 站点与身份 */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">站点与身份</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
            <dt className="text-muted-foreground">名称</dt>
            <dd className="font-medium">{data.title}</dd>
            <dt className="text-muted-foreground">URL</dt>
            <dd className="font-medium">{data.website}</dd>
            <dt className="text-muted-foreground">语言</dt>
            <dd>{data.locale}</dd>
            <dt className="text-muted-foreground">时区</dt>
            <dd>{data.timeZone}</dd>
            <dt className="text-muted-foreground">日期格式</dt>
            <dd>{data.timeFormat}</dd>
            {data.keywords.length > 0 && (
              <>
                <dt className="text-muted-foreground">关键词</dt>
                <dd>{data.keywords.join('、')}</dd>
              </>
            )}
            {data.icpNo && (
              <>
                <dt className="text-muted-foreground">备案号</dt>
                <dd>{data.icpNo}</dd>
              </>
            )}
          </dl>
        </CardContent>
      </Card>

      {/* Step 2 · 导航与社交 */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">导航与社交</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
            <dt className="text-muted-foreground">顶部导航</dt>
            <dd>{data.navigation.sideNav.length} 项</dd>
            <dt className="text-muted-foreground">页脚按钮</dt>
            <dd>{data.navigation.footerNav.length} 项</dd>
            <dt className="text-muted-foreground">社交链接</dt>
            <dd>{data.socials.length} 项</dd>
          </dl>
        </CardContent>
      </Card>

      {/* Step 3 · 外观与侧边栏 */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">外观与侧边栏</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
            <dt className="text-muted-foreground">侧边栏组件</dt>
            <dd>
              {data.sidebar.widgets
                .filter((w) => w.enabled)
                .map((w) => w.type)
                .join('、') || '无'}
            </dd>
            <dt className="text-muted-foreground">OG 字体</dt>
            <dd>{data.fonts.og.url ? '已配置' : '系统默认'}</dd>
            <dt className="text-muted-foreground">日历字体</dt>
            <dd>{data.fonts.calendar.url ? '已配置' : '系统默认'}</dd>
          </dl>
        </CardContent>
      </Card>

      {/* Step 4 · 内容与互动 */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">内容与互动</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
            <dt className="text-muted-foreground">首页分页</dt>
            <dd>{data.content.pagination.posts} 篇/页</dd>
            <dt className="text-muted-foreground">RSS 条数</dt>
            <dd>{data.content.feed.size} 条</dd>
            <dt className="text-muted-foreground">评论分页</dt>
            <dd>{data.comments.size} 条/页</dd>
          </dl>
        </CardContent>
      </Card>

      {/* Step 5 · 存储与搜索 */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">存储、邮件与搜索</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
            <dt className="text-muted-foreground">S3 存储</dt>
            <dd>{data.assets.storage.enabled ? `已开启（${data.assets.storage.bucket}）` : '未开启'}</dd>
            <dt className="text-muted-foreground">邮件通知</dt>
            <dd>{data.mail.enabled ? `已开启（${data.mail.sender}）` : '未开启'}</dd>
            <dt className="text-muted-foreground">搜索</dt>
            <dd>{data.search.enabled ? (data.search.mode === 'vector' ? '向量搜索' : '关键词搜索') : '未开启'}</dd>
          </dl>
        </CardContent>
      </Card>

      {/* Actions */}
      <div className="flex justify-between border-t border-line pt-2">
        <Button type="button" variant="outline" onClick={prevStep} disabled={isSubmitting}>
          上一步
        </Button>
        <Button type="button" onClick={handleSubmit} disabled={isSubmitting}>
          {isSubmitting ? '初始化中...' : '完成初始化并进入后台'}
        </Button>
      </div>
    </div>
  )
}
