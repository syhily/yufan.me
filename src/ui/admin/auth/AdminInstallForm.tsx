import { EyeIcon, EyeOffIcon, GlobeIcon, LockIcon, MailIcon, UserIcon } from 'lucide-react'
import { useState } from 'react'
import { Form, useNavigation } from 'react-router'

import { Button } from '@/ui/components/button'
import { Input } from '@/ui/components/input'
import { Label } from '@/ui/components/label'
import { cn } from '@/ui/lib/cn'

export interface AdminInstallFormProps {
  csrf: string
}

// Ghost-style large input: 48px height, rounded-lg, muted background.
const inputBaseClasses =
  'h-12 rounded-lg border-0 bg-muted/60 px-4 text-base placeholder:text-muted-foreground/50 focus-visible:bg-background focus-visible:ring-2 focus-visible:ring-primary/25 focus-visible:border-primary'

export function AdminInstallForm({ csrf }: AdminInstallFormProps) {
  const navigation = useNavigation()
  const isSubmitting = navigation.state === 'submitting' && navigation.formMethod === 'POST'
  const [showPassword, setShowPassword] = useState(false)

  return (
    <Form method="post" id="adminInstallForm" className="flex flex-col gap-5">
      <input type="hidden" name="csrf" value={csrf} />

      {/* Site title — prefixed with Globe icon */}
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="install-title" className="text-[15px] font-semibold">
          站点名称
        </Label>
        <div className="relative">
          <GlobeIcon
            size={18}
            className="pointer-events-none absolute top-1/2 left-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <Input
            id="install-title"
            name="title"
            type="text"
            autoComplete="off"
            placeholder="My Blog"
            required
            disabled={isSubmitting}
            className={cn(inputBaseClasses, 'pl-10')}
          />
        </div>
      </div>

      {/* Name — prefixed with User icon */}
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="install-name" className="text-[15px] font-semibold">
          昵称
        </Label>
        <div className="relative">
          <UserIcon
            size={18}
            className="pointer-events-none absolute top-1/2 left-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <Input
            id="install-name"
            name="name"
            type="text"
            autoComplete="nickname"
            placeholder="你的名字"
            required
            disabled={isSubmitting}
            className={cn(inputBaseClasses, 'pl-10')}
          />
        </div>
      </div>

      {/* Email — prefixed with Mail icon */}
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="install-email" className="text-[15px] font-semibold">
          邮箱
        </Label>
        <div className="relative">
          <MailIcon
            size={18}
            className="pointer-events-none absolute top-1/2 left-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <Input
            id="install-email"
            name="email"
            type="email"
            autoComplete="username"
            placeholder="your@email.com"
            required
            disabled={isSubmitting}
            className={cn(inputBaseClasses, 'pl-10')}
          />
        </div>
      </div>

      {/* Password — prefixed with Lock icon, with show/hide toggle */}
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="install-password" className="text-[15px] font-semibold">
          密码
        </Label>
        <div className="relative">
          <LockIcon
            size={18}
            className="pointer-events-none absolute top-1/2 left-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <Input
            id="install-password"
            name="password"
            type={showPassword ? 'text' : 'password'}
            autoComplete="new-password"
            placeholder="至少 10 个字符"
            required
            minLength={10}
            disabled={isSubmitting}
            className={cn(inputBaseClasses, 'pr-12 pl-10')}
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
      </div>

      {/* Ghost-style full-width CTA button */}
      <Button
        type="submit"
        name="submit"
        disabled={isSubmitting}
        className="mt-2 h-[52px] w-full rounded-lg bg-brand text-lg font-normal text-white hover:opacity-90"
      >
        {isSubmitting ? (
          '创建中...'
        ) : (
          <>
            创建账号并开始写作 <span aria-hidden>&rarr;</span>
          </>
        )}
      </Button>
    </Form>
  )
}
