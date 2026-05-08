import { type ReactNode, useId } from 'react'

import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from '@/ui/components/ui/card'
import { Checkbox } from '@/ui/components/ui/checkbox'
import { Field, FieldContent, FieldDescription, FieldError, FieldGroup, FieldLabel } from '@/ui/components/ui/field'
import { cn } from '@/ui/lib/cn'

interface SettingsSectionProps {
  title: string
  description?: string
  /**
   * Slot for top-right buttons (e.g. "添加菜单项"). Forwarded directly to
   * shadcn's `<CardAction>`, which `<CardHeader>` recognises by its
   * `data-slot="card-action"` attribute and switches the header into a
   * 2-column grid (title/description on the left, action on the right
   * — matches the upstream Card composition documented in the shadcn
   * Skill).
   */
  actions?: ReactNode
  /**
   * When the section's body is a form group, wrap the children in a
   * `<FieldGroup>` so individual `<Field>` rows pick up the canonical
   * vertical spacing. Defaults to `true`. Disable for sections that
   * render bespoke layouts (e.g. cache stats, sortable lists).
   */
  groupFields?: boolean
  children: ReactNode
}

// Card-based wrapper used by every settings page so spacing, headings,
// and actions stay consistent. Composes the canonical shadcn `Card`
// primitives (`CardHeader` / `CardAction` / `CardContent`) so a `Card`
// upgrade lands here without re-styling each section by hand.
export function SettingsSection({ title, description, actions, groupFields = true, children }: SettingsSectionProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        {description ? <CardDescription>{description}</CardDescription> : null}
        {actions ? <CardAction>{actions}</CardAction> : null}
      </CardHeader>
      <CardContent>{groupFields ? <FieldGroup className="gap-5">{children}</FieldGroup> : children}</CardContent>
    </Card>
  )
}

export interface SettingsControlProps {
  'aria-invalid'?: true
  'aria-describedby'?: string
}

type SettingsRowChildren = ReactNode | ((controlProps: SettingsControlProps) => ReactNode)

interface SettingsRowProps {
  /** Label rendered in the row's left column on desktop. */
  label: string
  /** Sets the label's `htmlFor` so it points at the control's `id`. */
  htmlFor?: string
  /** Optional helper text rendered below the control. */
  hint?: ReactNode
  /** Validation error rendered through `FieldError`. Drives `data-invalid` styling. */
  error?: string
  /** Form control(s) — `<Input>`, `<Select>`, etc. May receive a11y props by render prop. */
  children: SettingsRowChildren
}

// Two-column field row: label on the left, control + hint + error on
// the right. Composed on top of shadcn's `<Field>` primitives so the
// row inherits the upstream `data-invalid` / `aria-describedby`
// semantics. On narrow viewports the columns collapse into a stacked
// vertical block.
export function SettingsRow({ label, htmlFor, hint, error, children }: SettingsRowProps) {
  const generatedId = useId()
  const descriptionId = hint ? `${generatedId}-description` : undefined
  const errorId = error ? `${generatedId}-error` : undefined
  const describedBy = [descriptionId, errorId].filter(Boolean).join(' ') || undefined
  const controlProps: SettingsControlProps = {
    ...(error ? { 'aria-invalid': true } : {}),
    ...(describedBy ? { 'aria-describedby': describedBy } : {}),
  }
  const renderedChildren = typeof children === 'function' ? children(controlProps) : children

  return (
    <Field
      data-invalid={error ? true : undefined}
      className="gap-2 sm:grid sm:grid-cols-[12rem_minmax(0,1fr)] sm:items-start sm:gap-4"
    >
      <FieldLabel
        htmlFor={htmlFor}
        className={cn(
          'text-sm leading-none font-medium text-foreground sm:pt-2',
          'group-data-[invalid=true]/field:text-destructive',
        )}
      >
        {label}
      </FieldLabel>
      <FieldContent>
        {renderedChildren}
        {hint ? <FieldDescription id={descriptionId}>{hint}</FieldDescription> : null}
        {error ? <FieldError id={errorId}>{error}</FieldError> : null}
      </FieldContent>
    </Field>
  )
}

interface SettingsCheckboxRowProps {
  /** Row label (left column on desktop, "feature group" of the toggle). */
  rowLabel: string
  /** Optional helper text rendered below the checkbox. */
  hint?: ReactNode
  /** Inline label sitting right next to the checkbox. */
  checkboxLabel: string
  /** DOM id shared between the checkbox and the inline label. */
  id: string
  checked: boolean
  onCheckedChange: (checked: boolean) => void
  disabled?: boolean
}

// Two-column row whose right side is the canonical "checkbox +
// inline label" pair. Replaces the old hand-rolled
// `<div className="flex items-center gap-2"><Checkbox/><label/></div>`
// markup so the same a11y / `data-invalid` semantics that
// `SettingsRow` provides apply here too.
export function SettingsCheckboxRow({
  rowLabel,
  hint,
  checkboxLabel,
  id,
  checked,
  onCheckedChange,
  disabled,
}: SettingsCheckboxRowProps) {
  return (
    <SettingsRow label={rowLabel} hint={hint}>
      <Field orientation="horizontal" className="w-fit">
        <Checkbox
          id={id}
          checked={checked}
          disabled={disabled}
          onCheckedChange={(value) => onCheckedChange(value === true)}
        />
        <FieldLabel htmlFor={id} className="font-normal">
          {checkboxLabel}
        </FieldLabel>
      </Field>
    </SettingsRow>
  )
}

interface ReadOnlyFieldProps {
  label: string
  value: ReactNode
  hint?: ReactNode
}

// Shows a value the editor cannot change (bucket-A / env-only fields).
// Renders the value in a muted card-style box so it visually reads as
// "this is what's currently in effect" rather than "this is a form
// control you forgot to interact with".
export function ReadOnlyField({ label, value, hint }: ReadOnlyFieldProps) {
  return (
    <SettingsRow label={label} hint={hint}>
      <div className="rounded-md border bg-muted/40 px-3 py-2 font-mono text-sm break-all text-foreground">
        {value || <span className="text-muted-foreground">—</span>}
      </div>
    </SettingsRow>
  )
}
