import type { ReactNode } from 'react'

import { Card, CardContent, CardDescription, CardTitle } from '@/ui/admin/shadcn/components/ui/card'

interface SettingsSectionProps {
  title: string
  description?: string
  /** Slot for top-right buttons (e.g. "重置为默认", "保存更改"). */
  actions?: ReactNode
  children: ReactNode
}

// Card-based wrapper used by every settings page so spacing, headings,
// and actions stay consistent.
//
// Layout:
//   ≥ sm: title / description on the left, actions pinned to the
//         top-right corner.
//   < sm: title + description stacked, actions drop to a right-aligned
//         row directly below the description (does NOT mix into the
//         body content).
//
// We render the header markup ourselves rather than reaching for shadcn's
// `CardHeader`, because that component's "switch to 2 columns when a
// child has `data-slot=card-action`" rule would force every consumer of
// `SettingsSection` to opt into shadcn-internal slot identifiers — too
// leaky an abstraction for a project-owned wrapper.
export function SettingsSection({ title, description, actions, children }: SettingsSectionProps) {
  return (
    <Card>
      <div className="tw:flex tw:flex-col tw:gap-3 tw:px-6 tw:sm:flex-row tw:sm:items-start tw:sm:justify-between tw:sm:gap-4">
        <div className="tw:flex tw:flex-col tw:gap-1.5 tw:min-w-0 tw:flex-1">
          <CardTitle>{title}</CardTitle>
          {description ? <CardDescription>{description}</CardDescription> : null}
        </div>
        {actions ? (
          <div className="tw:flex tw:flex-wrap tw:items-center tw:gap-2 tw:self-end tw:sm:self-start tw:sm:shrink-0">
            {actions}
          </div>
        ) : null}
      </div>
      <CardContent className="tw:flex tw:flex-col tw:gap-5">{children}</CardContent>
    </Card>
  )
}

interface FieldRowProps {
  label: string
  htmlFor?: string
  hint?: string
  error?: string
  children: ReactNode
}

// Two-column field row: label on the left, control + hint on the right.
// On narrow viewports it collapses to stacked rows automatically.
export function FieldRow({ label, htmlFor, hint, error, children }: FieldRowProps) {
  return (
    <div className="tw:grid tw:gap-2 tw:sm:grid-cols-[12rem_minmax(0,1fr)] tw:sm:items-start tw:sm:gap-4">
      <label htmlFor={htmlFor} className="tw:text-sm tw:font-medium tw:leading-none tw:text-foreground tw:sm:pt-2">
        {label}
      </label>
      <div className="tw:flex tw:flex-col tw:gap-1">
        {children}
        {hint ? <p className="tw:text-muted-foreground tw:text-xs">{hint}</p> : null}
        {error ? <p className="tw:text-destructive tw:text-xs">{error}</p> : null}
      </div>
    </div>
  )
}

interface ReadOnlyFieldProps {
  label: string
  value: ReactNode
  hint?: string
}

// Shows a value the editor cannot change (bucket-A / env-only fields).
// Renders the value in a muted card-style box so it visually reads as
// "this is what's currently in effect" rather than "this is a form
// control you forgot to interact with".
export function ReadOnlyField({ label, value, hint }: ReadOnlyFieldProps) {
  return (
    <FieldRow label={label}>
      <div className="tw:bg-muted/40 tw:text-foreground tw:rounded-md tw:border tw:px-3 tw:py-2 tw:text-sm tw:font-mono tw:break-all">
        {value || <span className="tw:text-muted-foreground">—</span>}
      </div>
      {hint ? <p className="tw:text-muted-foreground tw:text-xs">{hint}</p> : null}
    </FieldRow>
  )
}
