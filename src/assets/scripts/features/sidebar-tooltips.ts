import tippy from 'tippy.js'

import { stickySidebar } from '@/assets/scripts/shared/sidebar'

export function initSidebar(): void {
  stickySidebar({
    elements: '.sidebar',
    additionalMarginTop: 30,
  })

  tippy('.sidebar .widget-title', {
    theme: 'light',
    placement: 'left',
    animation: 'fade',
  })
}
