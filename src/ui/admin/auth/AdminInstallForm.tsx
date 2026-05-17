import { EyeIcon, EyeOffIcon } from 'lucide-react'
import { useState } from 'react'
import { Form, useNavigation } from 'react-router'

import { Button } from '@/ui/components/button'
import { Input } from '@/ui/components/input'
import { Label } from '@/ui/components/label'

export interface AdminInstallFormProps {
  csrf: string
}

// `AdminCredentialsForm` (which serves the lightweight login flow at
// `/wp-login.php`) because the install path's submission auto-logs the
// everything else.
export function AdminInstallForm({ csrf }: AdminInstallFormProps) {
  const navigation = useNavigation()
  const isSubmitting = navigation.state === 'submitting' && navigation.formMethod === 'POST'
  const [showPassword, setShowPassword] = useState(false)

  return (
    <Form method="post" id="adminInstallForm" className="flex flex-col gap-4">
      <input type="hidden" name="csrf" value={csrf} />

      <div className="flex flex-col gap-2">
        <Label htmlFor="install-name">昵称</Label>
        <Input id="install-name" name="name" type="text" autoComplete="nickname" required disabled={isSubmitting} />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="install-email">邮箱</Label>
        <Input id="install-email" name="email" type="email" autoComplete="username" required disabled={isSubmitting} />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="install-password">密码</Label>
        <div className="relative">
          <Input
            id="install-password"
            name="password"
            type={showPassword ? 'text' : 'password'}
            autoComplete="new-password"
            required
            minLength={10}
            disabled={isSubmitting}
            className="pr-10"
          />
          <button
            type="button"
            onClick={() => setShowPassword((prev) => !prev)}
            disabled={isSubmitting}
            className="absolute inset-y-0 right-0 flex items-center justify-center px-3 text-muted-foreground transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none disabled:pointer-events-none"
            aria-label={showPassword ? '隐藏密码' : '显示密码'}
            aria-pressed={showPassword}
          >
            {showPassword ? <EyeOffIcon size={16} aria-hidden /> : <EyeIcon size={16} aria-hidden />}
          </button>
        </div>
        <p className="text-xs text-muted-foreground">至少 10 个字符。</p>
      </div>

      <Button type="submit" name="submit" disabled={isSubmitting} className="w-full">
        {isSubmitting ? '创建中...' : '下一步：站点初始化'}
      </Button>
    </Form>
  )
}
