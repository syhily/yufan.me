import { qrcode } from '@/assets/scripts/qrcode'

import { buildQrPopup, hidePopup, showPopup } from './popup'

// Wire each `.nice-dialog` element so clicking it opens a popup containing
// a QR code generated from the dialog's `data-url` attribute.
export function initQrPopups(): void {
  for (const dialog of document.querySelectorAll<HTMLElement>('.nice-dialog')) {
    let popup: HTMLElement | null = null

    const open = () => {
      if (!popup) {
        const { title, name, url } = dialog.dataset
        if (!title || !name || !url) return

        const svg = qrcode(url, { border: 2 })
        popup = buildQrPopup(title, name, svg)
        showPopup(popup)
      } else {
        showPopup(popup)
      }
    }

    dialog.addEventListener('click', (event) => {
      event.stopPropagation()
      open()
    })

    document.addEventListener('click', (event) => {
      if (popup && !popup.contains(event.target as Node) && !dialog.contains(event.target as Node)) {
        hidePopup(popup)
        popup = null
      }
    })
  }
}
