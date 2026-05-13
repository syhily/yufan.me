import { Moon, Sun } from 'lucide-react'

import { Button } from '@/ui/components/button'
import { IconButtonContent } from '@/ui/components/icon-button-content'
import { useTheme } from '@/ui/lib/ThemeProvider'
import { publicButtonVariants } from '@/ui/primitives/btn'

interface ThemeToggleProps {
  mode: 'public' | 'admin'
}

export function ThemeToggle({ mode }: ThemeToggleProps) {
  const { resolvedTheme, setTheme } = useTheme()

  const toggle = () => {
    setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')
  }

  const label = resolvedTheme === 'dark' ? '切换到亮色模式' : '切换到暗色模式'

  if (mode === 'public') {
    return (
      <button
        type="button"
        onClick={toggle}
        title={label}
        aria-label={label}
        className={publicButtonVariants({ variant: 'dark', size: 'iconSm', shape: 'circle' })}
      >
        <IconButtonContent>
          {resolvedTheme === 'dark' ? (
            <Sun size="1em" aria-hidden className="m-icon-inset" />
          ) : (
            <Moon size="1em" aria-hidden className="m-icon-inset" />
          )}
        </IconButtonContent>
      </button>
    )
  }

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={toggle}
      className="relative text-foreground hover:text-primary focus-visible:text-primary"
      title={label}
    >
      <Sun data-icon className="transition-all dark:scale-0 dark:opacity-0" />
      <Moon data-icon className="absolute scale-0 opacity-0 transition-all dark:scale-100 dark:opacity-100" />
      <span className="sr-only">{label}</span>
    </Button>
  )
}
