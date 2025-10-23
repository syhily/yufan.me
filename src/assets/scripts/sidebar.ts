/**
 * Theia Sticky Sidebar.
 *
 * The following code has been ported and rewritten by Yufan Sheng from Liviu's original work at:
 * https://github.com/WeCodePixels/theia-sticky-sidebar/blob/master/lib/theia-sticky-sidebar.ts
 *
 * ```
 * The MIT License (MIT)
 *
 * Copyright (c) 2025 Liviu Cristian Mirea Ghiban
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 * ```
 */
interface Options {
  elements: string | HTMLElement | Array<HTMLElement>
  containerSelector: string
  additionalMarginTop: number
  additionalMarginBottom: number
  updateSidebarHeight: boolean
  minWidth: number
  disableOnResponsiveLayouts: boolean
  sidebarBehavior: string
  defaultPosition: string
  verbose: boolean
  requestAnimationFrame: boolean
}

interface StickySidebar {
  options: Options
  sidebar: HTMLElement
  stickySidebar: HTMLElement
  container: HTMLElement
  onScroll: () => unknown
  previousScrollTop: number
  fixedScrollTop: number
  stickySidebarPaddingTop: number
  stickySidebarPaddingBottom: number
  marginBottom: number
  paddingTop: number
  paddingBottom: number
  resizeObserver: ResizeObserver
  queuedForAnimationFrame: boolean
}

export function stickySidebar(options: Partial<Options>) {
  const defaults: Options = {
    elements: '',
    containerSelector: '',
    additionalMarginTop: 0,
    additionalMarginBottom: 0,
    updateSidebarHeight: true,
    minWidth: 0,
    disableOnResponsiveLayouts: true,
    sidebarBehavior: 'modern',
    defaultPosition: 'relative',
    verbose: false,
    requestAnimationFrame: true,
  }

  const opts: Options = { ...defaults, ...options } as Options

  // Validate numeric options
  opts.additionalMarginTop = Math.floor((options as any)?.additionalMarginTop || 0)
  opts.additionalMarginBottom = Math.floor((options as any)?.additionalMarginBottom || 0)

  let elements: Array<HTMLElement>
  if ((opts.elements as any) instanceof HTMLElement) {
    elements = [opts.elements as unknown as HTMLElement]
  }
  else if (Array.isArray(opts.elements)) {
    elements = opts.elements as unknown as Array<HTMLElement>
  }
  else {
    elements = Array.from(document.querySelectorAll(opts.elements as string))
  }

  let initialized = false
  const stickySidebars: Array<StickySidebar> = []

  // named functions so we can remove listeners later
  function tryInitOrHookIntoEvents() {
    const success = tryInit()
    if (!success) {
      if (opts.verbose) {
        console.log('TSS: Body width smaller than options.minWidth. Init is delayed.')
      }
      document.addEventListener('scroll', tryDelayedInit)
      window.addEventListener('resize', tryDelayedInit)
    }
  }

  function tryDelayedInit() {
    const success = tryInit()
    if (success) {
      document.removeEventListener('scroll', tryDelayedInit)
      window.removeEventListener('resize', tryDelayedInit)
    }
  }

  function tryInit() {
    if (initialized)
      return true
    if (document.body.getBoundingClientRect().width < opts.minWidth)
      return false
    init()
    return true
  }

  function unbind() {
    document.removeEventListener('scroll', tryDelayedInit)
    window.removeEventListener('resize', tryDelayedInit)

    stickySidebars.forEach((o) => {
      document.removeEventListener('scroll', o.onScroll)
      window.removeEventListener('resize', o.onScroll)
      try {
        o.resizeObserver.disconnect()
      }
      catch {
        // ignore errors during disconnect
      }
    })
  }

  function init() {
    initialized = true

    const existingStylesheet = document.querySelector('#theia-sticky-sidebar-stylesheet')
    if (!existingStylesheet) {
      document.head.insertAdjacentHTML('beforeend', '<style id="theia-sticky-sidebar-stylesheet">.stickySidebar:after {content: ""; display: table; clear: both;}</style>')
    }

    elements.forEach((element) => {
      const o: StickySidebar = {} as StickySidebar
      o.sidebar = element
      o.options = opts

      o.container = (o.options.containerSelector && document.querySelector(o.options.containerSelector)) as HTMLElement
      if (!o.container) {
        o.container = o.sidebar.parentNode as HTMLElement
      }

      Object.assign(o.sidebar.style, {
        position: o.options.defaultPosition,
        overflow: 'visible',
        boxSizing: 'border-box',
      })

      o.stickySidebar = o.sidebar.querySelector('.stickySidebar') as HTMLElement
      if (!o.stickySidebar) {
        const javaScriptMIMETypes = /(?:text|application)\/(?:x-)?(?:javascript|ecmascript)/i
        Array.from(o.sidebar.querySelectorAll('script')).forEach((script) => {
          if (script.type.length === 0 || script.type.match(javaScriptMIMETypes)) {
            script.remove()
          }
        })

        o.stickySidebar = document.createElement('div')
        o.stickySidebar.classList.add('stickySidebar')
        o.stickySidebar.append(...o.sidebar.children)
        o.sidebar.append(o.stickySidebar)
      }

      const computedStyle = getComputedStyle(o.sidebar)
      o.marginBottom = Number.parseFloat(computedStyle.marginBottom)
      o.paddingTop = Number.parseFloat(computedStyle.paddingTop)
      o.paddingBottom = Number.parseFloat(computedStyle.paddingBottom)

      let collapsedTopHeight = getOffset(o.stickySidebar).top
      let collapsedBottomHeight = o.stickySidebar.offsetHeight
      o.stickySidebar.style.paddingTop = '1px'
      o.stickySidebar.style.paddingBottom = '1px'
      collapsedTopHeight -= getOffset(o.stickySidebar).top
      collapsedBottomHeight = o.stickySidebar.offsetHeight - collapsedBottomHeight - collapsedTopHeight
      if (collapsedTopHeight === 0) {
        o.stickySidebar.style.paddingTop = '0px'
        o.stickySidebarPaddingTop = 0
      }
      else {
        o.stickySidebarPaddingTop = 1
      }

      if (collapsedBottomHeight === 0) {
        o.stickySidebar.style.paddingBottom = '0px'
        o.stickySidebarPaddingBottom = 0
      }
      else {
        o.stickySidebarPaddingBottom = 1
      }

      o.previousScrollTop = 0
      o.fixedScrollTop = 0
      resetSidebar(o)

      o.onScroll = () => {
        if (o.options.requestAnimationFrame) {
          if (!o.queuedForAnimationFrame) {
            o.queuedForAnimationFrame = true
            window.requestAnimationFrame(() => {
              handleScroll(o)
              o.queuedForAnimationFrame = false
            })
          }
        }
        else {
          handleScroll(o)
        }
      }

      o.onScroll()

      document.addEventListener('scroll', o.onScroll)
      window.addEventListener('resize', o.onScroll)

      o.resizeObserver = new ResizeObserver(() => {
        o.onScroll()
      })
      o.resizeObserver.observe(o.stickySidebar)

      stickySidebars.push(o)
    })
  }

  function getOuterWidth(element: HTMLElement): number {
    const style = getComputedStyle(element)
    return element.getBoundingClientRect().width + Number.parseFloat(style.marginLeft) + Number.parseFloat(style.marginRight)
  }

  function isVisible(element: HTMLElement) {
    return !!(element.offsetWidth || element.offsetHeight || element.getClientRects().length)
  }

  function resetSidebar(s: StickySidebar) {
    s.fixedScrollTop = 0
    s.sidebar.style.minHeight = '1px'
    Object.assign(s.stickySidebar.style, {
      position: 'static',
      width: '',
      transform: 'none',
    })
  }

  function getClearedHeight(element: HTMLElement) {
    let height = element.getBoundingClientRect().height
    Array.from(element.children).forEach((child) => {
      height = Math.max(height, child.getBoundingClientRect().height)
    })
    return height
  }

  function handleScroll(o: StickySidebar) {
    if (!isVisible(o.stickySidebar))
      return
    if (document.body.getBoundingClientRect().width < o.options.minWidth) {
      resetSidebar(o)
      return
    }

    if (o.options.disableOnResponsiveLayouts) {
      const sidebarWidth = getComputedStyle(o.sidebar).float === 'none' ? getOuterWidth(o.sidebar) : o.sidebar.offsetWidth
      if (sidebarWidth + 50 > o.container.getBoundingClientRect().width) {
        resetSidebar(o)
        return
      }
    }

    const scrollTop = window.scrollY
    let position = 'static'
    const sidebarOffset = getOffset(o.sidebar)
    let top = 0

    if (scrollTop >= sidebarOffset.top + (o.paddingTop - o.options.additionalMarginTop)) {
      const offsetTop = o.paddingTop + opts.additionalMarginTop
      const offsetBottom = o.paddingBottom + o.marginBottom + opts.additionalMarginBottom
      const containerTop = sidebarOffset.top
      const containerBottom = getOffset(o.container).top + getClearedHeight(o.container)
      const windowOffsetTop = opts.additionalMarginTop
      let windowOffsetBottom

      const sidebarSmallerThanWindow = (o.stickySidebar.offsetHeight + offsetTop + offsetBottom) < window.innerHeight
      if (sidebarSmallerThanWindow) {
        windowOffsetBottom = windowOffsetTop + o.stickySidebar.offsetHeight
      }
      else {
        windowOffsetBottom = window.innerHeight - o.marginBottom - o.paddingBottom - opts.additionalMarginBottom
      }

      const staticLimitTop = containerTop - scrollTop + o.paddingTop
      const staticLimitBottom = containerBottom - scrollTop - o.paddingBottom - o.marginBottom

      top = getOffset(o.stickySidebar).top - scrollTop
      const scrollTopDiff = o.previousScrollTop - scrollTop

      if (getComputedStyle(o.stickySidebar).position === 'fixed') {
        if (o.options.sidebarBehavior === 'modern') {
          top += scrollTopDiff
        }
      }

      if (o.options.sidebarBehavior === 'stick-to-top') {
        top = opts.additionalMarginTop
      }

      if (o.options.sidebarBehavior === 'stick-to-bottom') {
        top = windowOffsetBottom - o.stickySidebar.offsetHeight
      }

      if (scrollTopDiff > 0) {
        top = Math.min(top, windowOffsetTop)
      }
      else {
        top = Math.max(top, windowOffsetBottom - o.stickySidebar.offsetHeight)
      }

      top = Math.max(top, staticLimitTop)
      top = Math.min(top, staticLimitBottom - o.stickySidebar.offsetHeight)

      const sidebarSameHeightAsContainer = o.container.getBoundingClientRect().height === o.stickySidebar.offsetHeight

      if (!sidebarSameHeightAsContainer && top === windowOffsetTop) {
        position = 'fixed'
      }
      else if (!sidebarSameHeightAsContainer && top === windowOffsetBottom - o.stickySidebar.offsetHeight) {
        position = 'fixed'
      }
      else if (scrollTop + top - sidebarOffset.top - o.paddingTop <= opts.additionalMarginTop) {
        position = 'static'
      }
      else {
        position = 'absolute'
      }
    }

    if (position === 'fixed') {
      Object.assign(o.stickySidebar.style, {
        position: 'fixed',
        width: `${o.stickySidebar.getBoundingClientRect().width}px`,
        transform: `translateY(${top}px)`,
        left: `${getOffset(o.sidebar).left + Number.parseFloat(getComputedStyle(o.sidebar).paddingLeft) - window.scrollX}px`,
        top: '0px',
      })
    }
    else if (position === 'absolute') {
      const css: Partial<CSSStyleDeclaration> = {}
      if (getComputedStyle(o.stickySidebar).position !== 'absolute') {
        css.position = 'absolute'
        css.transform = `translateY(${scrollTop + top - sidebarOffset.top - o.stickySidebarPaddingTop - o.stickySidebarPaddingBottom}px)`
        css.top = '0px'
      }
      css.width = `${o.stickySidebar.getBoundingClientRect().width}px`
      css.left = ''
      Object.assign(o.stickySidebar.style, css)
    }
    else if (position === 'static') {
      resetSidebar(o)
    }

    if (position !== 'static') {
      if (o.options.updateSidebarHeight) {
        o.sidebar.style.minHeight = `${o.stickySidebar.offsetHeight + getOffset(o.stickySidebar).top - sidebarOffset.top + o.paddingBottom}px`
      }
    }

    o.previousScrollTop = scrollTop
  }

  // start initialization
  tryInitOrHookIntoEvents()

  // return API
  return { unbind }
}

export function getOffset(element: HTMLElement): { top: number, left: number } {
  const rect = element.getBoundingClientRect()
  return {
    top: rect.top + window.scrollY - document.documentElement.clientTop,
    left: rect.left + window.scrollX - document.documentElement.clientLeft,
  }
}
