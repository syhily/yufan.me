import mediumZoom from 'medium-zoom/dist/pure'

export function initMediumZoom(): void {
  const zoom = mediumZoom()
  zoom.attach('.post-content img', '.post-content svg')
}
