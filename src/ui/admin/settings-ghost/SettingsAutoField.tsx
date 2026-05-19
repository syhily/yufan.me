import { CheckIcon, Loader2Icon } from 'lucide-react'
import { useState } from 'react'

import { Switch } from '@/ui/components/switch'

interface SettingsAutoSwitchProps {
  id: string
  label: string
  checked: boolean
  onCheckedChange: (checked: boolean) => void
  isPending?: boolean
}

export function SettingsAutoSwitch({ id, label, checked, onCheckedChange, isPending }: SettingsAutoSwitchProps) {
  const [showSaved, setShowSaved] = useState(false)

  const handleChange = (value: boolean) => {
    onCheckedChange(value)
    setShowSaved(true)
    setTimeout(() => setShowSaved(false), 2000)
  }

  return (
    <div className="flex items-center gap-3">
      <Switch id={id} checked={checked} onCheckedChange={handleChange} disabled={isPending} />
      <label htmlFor={id} className="text-sm font-medium">
        {label}
      </label>
      {isPending ? (
        <Loader2Icon data-icon className="size-3.5 animate-spin text-muted-foreground" />
      ) : showSaved ? (
        <CheckIcon data-icon className="size-3.5 text-green-600" />
      ) : null}
    </div>
  )
}
