import { format } from 'date-fns'
import { zhCN } from 'date-fns/locale'
import { CalendarIcon, ChevronDownIcon } from 'lucide-react'
import { useState } from 'react'

import { Button } from '@/ui/components/ui/button'
import { Calendar } from '@/ui/components/ui/calendar'
import { Field, FieldGroup, FieldLabel } from '@/ui/components/ui/field'
import { Input } from '@/ui/components/ui/input'
import { Popover, PopoverContent, PopoverTrigger } from '@/ui/components/ui/popover'

// Date + time picker, modelled on shadcn/ui base's Date Picker
// "Time Picker" recipe (https://ui.shadcn.com/docs/components/base/date-picker).
// Two side-by-side `Field`s in a `FieldGroup`:
//   - **Date** — `Popover` + `Calendar` (which is the project's
//     react-day-picker wrapper). The trigger uses base-ui's `render`
//     prop, not `asChild`, because shadcn base-vega routes triggers
//     that way.
//   - **Time** — native `<input type="time">` with the OS calendar
//     picker indicator hidden (the date half already covers that).
//
// The wire contract stays unchanged from the previous
// `<input type="datetime-local">`-backed widget: a
// `YYYY-MM-DDTHH:mm` string flows in/out, empty = "unset".

export interface DateTimePickerProps {
  value: string
  onChange: (next: string) => void
  disabled?: boolean
  /** Optional id surfaced on the Date trigger; the time field
   *  derives its own id from `${id}-time`. */
  id?: string
}

export function DateTimePicker({ value, onChange, disabled, id }: DateTimePickerProps) {
  const [open, setOpen] = useState(false)
  const parsed = parseLocal(value)
  const dateOnly = parsed === null ? undefined : new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate())
  const timeValue = parsed === null ? '09:00' : `${pad(parsed.getHours())}:${pad(parsed.getMinutes())}`

  const dateId = id ?? 'datetime-picker'
  const timeId = `${dateId}-time`

  const commitDate = (next: Date | undefined) => {
    if (next === undefined) {
      onChange('')
      return
    }
    const [h, m] = timeValue.split(':').map((part) => Number.parseInt(part, 10))
    onChange(toLocalInputValue(next, h ?? 9, m ?? 0))
    setOpen(false)
  }

  const commitTime = (next: string) => {
    const baseDate = dateOnly ?? new Date()
    const [h, m] = next.split(':').map((part) => Number.parseInt(part, 10))
    if (Number.isNaN(h) || Number.isNaN(m)) {
      return
    }
    onChange(toLocalInputValue(baseDate, h, m))
  }

  return (
    <FieldGroup className="flex-row gap-2">
      <Field className="grow">
        <FieldLabel htmlFor={dateId} className="sr-only">
          日期
        </FieldLabel>
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger
            render={
              <Button
                id={dateId}
                variant="outline"
                type="button"
                disabled={disabled}
                data-empty={dateOnly === undefined}
                className="w-full justify-between font-normal data-[empty=true]:text-muted-foreground"
              />
            }
          >
            <span className="inline-flex items-center gap-2">
              <CalendarIcon className="size-4" />
              {dateOnly !== undefined ? format(dateOnly, 'PPP', { locale: zhCN }) : '选择日期'}
            </span>
            <ChevronDownIcon className="size-4 opacity-60" />
          </PopoverTrigger>
          <PopoverContent align="start" className="w-auto overflow-hidden p-0">
            <Calendar
              mode="single"
              selected={dateOnly}
              defaultMonth={dateOnly}
              captionLayout="dropdown"
              onSelect={commitDate}
              disabled={disabled}
            />
          </PopoverContent>
        </Popover>
      </Field>
      <Field className="w-32">
        <FieldLabel htmlFor={timeId} className="sr-only">
          时间
        </FieldLabel>
        <Input
          id={timeId}
          type="time"
          step={60}
          value={timeValue}
          onChange={(event) => commitTime(event.target.value)}
          disabled={disabled || dateOnly === undefined}
          className="appearance-none bg-background font-mono [&::-webkit-calendar-picker-indicator]:hidden [&::-webkit-calendar-picker-indicator]:appearance-none"
        />
      </Field>
    </FieldGroup>
  )
}

function pad(n: number): string {
  return n.toString().padStart(2, '0')
}

function parseLocal(value: string): Date | null {
  if (value.trim() === '') {
    return null
  }
  const ms = Date.parse(value)
  if (Number.isNaN(ms)) {
    return null
  }
  return new Date(ms)
}

function toLocalInputValue(date: Date, hours: number, minutes: number): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(hours)}:${pad(minutes)}`
}
