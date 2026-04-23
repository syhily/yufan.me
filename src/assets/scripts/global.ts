// Bootstrap entry: wires every page-wide feature module. Each feature is
// completely self-contained; remove an import below to disable it.

import { initAPlayer } from '@/assets/scripts/features/aplayer'
import { initComments } from '@/assets/scripts/features/comments'
import { initFocusHash } from '@/assets/scripts/features/focus-hash'
import { initFootnoteTooltips } from '@/assets/scripts/features/footnotes'
import { initLikeButton } from '@/assets/scripts/features/like-button'
import { initMediumZoom } from '@/assets/scripts/features/medium-zoom'
import { initMenuToggle } from '@/assets/scripts/features/menu-toggle'
import { initQrPopups } from '@/assets/scripts/features/qr-popup'
import { initScrollTop } from '@/assets/scripts/features/scroll-top'
import { initSearch } from '@/assets/scripts/features/search'
import { initSidebar } from '@/assets/scripts/features/sidebar-tooltips'
import { initTableOfContents } from '@/assets/scripts/features/toc'
import { attachCopyButtons } from '@/assets/scripts/snippet'

initFocusHash()
initScrollTop()
initMediumZoom()
attachCopyButtons()
initFootnoteTooltips()
initQrPopups()
initTableOfContents()
initSidebar()
initMenuToggle()
initSearch()
initComments()

// Async features: don't await – let them run in the background so a failure
// in one doesn't block the rest of the page.
void initAPlayer()
void initLikeButton()
