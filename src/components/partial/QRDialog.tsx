import { Icon } from '@/components/icons/Icon'
import { cx } from '@/components/ui/cx'

export interface QRDialogProps {
  url: string
  name: string
  title: string
  icon: string
  className?: string
}

export function QRDialog({ url, name, title, icon, className }: QRDialogProps) {
  const rootClass = className
    ? cx('nice-dialog', className)
    : 'nice-dialog btn btn-dark btn-icon btn-circle single-popup button-social'
  return (
    <div className={rootClass} title={name} data-title={title} data-name={name} data-url={url}>
      <span>
        <Icon name={icon} />
      </span>
    </div>
  )
}
