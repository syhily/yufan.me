import { useEffect, useState } from 'react'
import { useRevalidator } from 'react-router'

import type { InstallWizardData } from '@/shared/types/install'

import { useInstallWizard } from '@/ui/admin/auth/install-wizard/InstallWizardContext'
import { StepAppearanceSidebar } from '@/ui/admin/auth/install-wizard/StepAppearanceSidebar'
import { StepConfirm } from '@/ui/admin/auth/install-wizard/StepConfirm'
import { StepContentComments } from '@/ui/admin/auth/install-wizard/StepContentComments'
import { StepNavigationSocials } from '@/ui/admin/auth/install-wizard/StepNavigationSocials'
import { StepServices } from '@/ui/admin/auth/install-wizard/StepServices'
import { StepSiteIdentity } from '@/ui/admin/auth/install-wizard/StepSiteIdentity'
import { cn } from '@/ui/lib/cn'

const STEPS = [
  { id: 1, label: '基础信息' },
  { id: 2, label: '导航与社交' },
  { id: 3, label: '外观与侧边栏' },
  { id: 4, label: '内容与互动' },
  { id: 5, label: '存储与搜索' },
  { id: 6, label: '确认并初始化' },
] as const

export interface WizardShellProps {
  csrf: string
  timeZones: readonly string[]
}

function validateCurrentStep(step: number, data: InstallWizardData): string | null {
  if (step !== 1) {
    return null
  }
  if (!data.title.trim()) {
    return '请填写站点名称'
  }
  if (!data.description.trim()) {
    return '请填写站点描述'
  }
  if (!data.website.trim()) {
    return '请填写站点 URL'
  }
  if (!data.locale.trim()) {
    return '请填写语言'
  }
  if (!data.timeZone.trim()) {
    return '请选择时区'
  }
  if (!data.timeFormat.trim()) {
    return '请填写日期格式'
  }
  return null
}

export function WizardShell({ csrf, timeZones }: WizardShellProps) {
  const { data, currentStep, goToStep, nextStep, prevStep, canAccessStep } = useInstallWizard()
  const [stepError, setStepError] = useState<string | null>(null)
  const revalidator = useRevalidator()

  // Renew the CSRF cookie every minute so the 5-minute TTL doesn't expire
  // while the user is filling out the multi-step wizard.
  useEffect(() => {
    const id = setInterval(() => {
      if (revalidator.state === 'idle') {
        void revalidator.revalidate()
      }
    }, 60000)
    return () => clearInterval(id)
  }, [revalidator])

  const StepComponent = [
    StepSiteIdentity,
    StepNavigationSocials,
    StepAppearanceSidebar,
    StepContentComments,
    StepServices,
    StepConfirm,
  ][currentStep - 1]

  const handleNext = () => {
    const error = validateCurrentStep(currentStep, data)
    if (error) {
      setStepError(error)
      return
    }
    setStepError(null)
    nextStep()
  }

  const handlePrev = () => {
    setStepError(null)
    prevStep()
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Stepper with sliding active indicator */}
      <nav aria-label="安装步骤">
        <div className="relative rounded-lg bg-muted/50 p-1 shadow-sm">
          {/* Sliding active background */}
          <div
            className="absolute inset-y-1 rounded-md bg-primary shadow-sm transition-transform duration-300 ease-out"
            style={{
              width: `calc((100% - ${(STEPS.length - 1) * 4}px) / ${STEPS.length})`,
              transform: `translateX(calc(${currentStep - 1} * (100% + 4px)))`,
            }}
          />

          <ol className="relative flex items-center">
            {STEPS.map((step) => {
              const isActive = step.id === currentStep
              const isAccessible = canAccessStep(step.id)

              return (
                <li key={step.id} className="flex flex-1">
                  <button
                    type="button"
                    onClick={() => {
                      setStepError(null)
                      if (isAccessible) {
                        goToStep(step.id)
                      }
                    }}
                    disabled={!isAccessible}
                    className={cn(
                      'relative z-10 w-full py-2 text-center text-xs font-medium transition-colors duration-200',
                      isActive ? 'text-primary-foreground' : 'text-muted-foreground hover:text-foreground',
                      !isAccessible && 'cursor-not-allowed opacity-50',
                    )}
                    aria-current={isActive ? 'step' : undefined}
                  >
                    <span className="hidden sm:inline">{step.label}</span>
                    <span className="sm:hidden">{step.id}</span>
                  </button>
                </li>
              )
            })}
          </ol>
        </div>
      </nav>

      {stepError && (
        <div
          role="alert"
          aria-live="polite"
          className="rounded-md border border-destructive/20 bg-destructive/10 px-3 py-2 text-sm text-destructive"
        >
          {stepError}
        </div>
      )}

      {/* Step content */}
      <div className="min-h-[320px]">
        <StepComponent csrf={csrf} timeZones={timeZones} />
      </div>

      {/* Navigation buttons — shown on steps 1-5; step 6 has its own submit */}
      {currentStep < STEPS.length && (
        <div className="flex justify-between border-t border-line pt-2">
          <button
            type="button"
            onClick={handlePrev}
            disabled={currentStep === 1}
            className={cn(
              'inline-flex h-9 items-center justify-center rounded-sm border border-line bg-transparent px-4 text-sm font-medium transition-colors',
              'hover:bg-accent hover:text-accent-foreground',
              'disabled:pointer-events-none disabled:opacity-50',
            )}
          >
            上一步
          </button>
          <button
            type="button"
            onClick={handleNext}
            className="inline-flex h-9 items-center justify-center rounded-sm bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            {currentStep === STEPS.length - 1 ? '下一步：确认' : '下一步'}
          </button>
        </div>
      )}
    </div>
  )
}
