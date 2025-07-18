import resizeSensor from 'resize-sensor'

class stickySidebarEventHandler {
  constructor() {
    this.functionMap = {}
  }

  addEventListener(target, event, func) {
    this.functionMap[event] = func
    target.addEventListener(event.split('.')[0], this.functionMap[event])
  }

  removeEventListener(target, event) {
    target.removeEventListener(event.split('.')[0], this.functionMap[event])
    delete this.functionMap[event]
  }
}

function stickySidebarStickySidebar(target, opts) {
  const defaults = {
    containerSelector: '',
    additionalMarginTop: 0,
    additionalMarginBottom: 0,
    updateSidebarHeight: true,
    minWidth: 0,
    disableOnResponsiveLayouts: true,
    sidebarBehavior: 'modern',
    defaultPosition: 'relative',
    namespace: 'TSS',
  }

  const options = Object.assign(defaults, opts)

  // Validate options
  options.additionalMarginTop = Number.parseInt(options.additionalMarginTop) || 0
  options.additionalMarginBottom = Number.parseInt(options.additionalMarginBottom) || 0

  tryInitOrHookIntoEvents(options, target)

  // Try doing init, otherwise hook into window.resize and document.scroll and try again then.
  function tryInitOrHookIntoEvents(options, $that) {
    const success = tryInit(options, $that)

    if (!success) {
      console.log('TSS: Body width smaller than options.minWidth. Init is delayed.')

      stickySidebarEventHandler.addEventListener(
        document,
        `scroll.${options.namespace}`,
        ((options, $that) => () => {
          const success = tryInit(options, $that)

          if (success) {
            stickySidebarEventHandler.removeEventListener(document, `scroll.${options.namespace}`)
          }
        })(options, $that),
      )

      stickySidebarEventHandler.addEventListener(
        window,
        `resize.${options.namespace}`,
        ((options, $that) => () => {
          const success = tryInit(options, $that)

          if (success) {
            stickySidebarEventHandler.removeEventListener(window, `resize.${options.namespace}`)
          }
        })(options, $that),
      )
    }
  }

  // Try doing init if proper conditions are met.
  function tryInit(options, $that) {
    if (options.initialized === true) {
      return true
    }

    if (document.querySelector('body').getBoundingClientRect().width < options.minWidth) {
      return false
    }

    init(options, $that)

    return true
  }

  // Init the sticky sidebar(s).
  function init(options, $that) {
    options.initialized = true

    // Add CSS
    const existingStylesheet = document.querySelectorAll(
      `#stickySidebar-sticky-sidebar-stylesheet-${options.namespace}`,
    )

    if (existingStylesheet.length === 0) {
      document
        .querySelector('head')
        .insertAdjacentHTML(
          'beforeend',
          `<style id="stickySidebar-sticky-sidebar-stylesheet-${options.namespace}">.stickySidebarStickySidebar:after {content: ""; display: table; clear: both;}</style>`,
        )
    }

    for (const element of $that) {
      const o = {}

      o.sidebar = element

      // Save options
      o.options = options || {}

      // Get container
      o.container = o.options.containerSelector === '' ? [] : document.querySelectorAll(o.options.containerSelector)
      if (o.container.length === 0) {
        o.container = o.sidebar.parentNode
      }

      // Create sticky sidebar
      let parentNode = o.sidebar.parentNode
      while (parentNode && parentNode !== document) {
        parentNode.style.setProperty('-webkit-transform', 'none') // Fix for WebKit bug - https://code.google.com/p/chromium/issues/detail?id=20574
        parentNode = parentNode.parentNode
      }

      for (const [key, value] of Object.entries({
        'position': o.options.defaultPosition,
        'overflow': 'visible',
        // The "box-sizing" must be set to "content-box" because we set a fixed height to this element when the sticky sidebar has a fixed position.
        '-webkit-box-sizing': 'border-box',
        '-moz-box-sizing': 'border-box',
        'box-sizing': 'border-box',
      })) {
        o.sidebar.style.setProperty(key, value)
      }

      // Get the sticky sidebar element. If none has been found, then create one.
      o.stickySidebar = o.sidebar.querySelector('.stickySidebarStickySidebar')
      if (o.stickySidebar === null) {
        // Remove <script> tags, otherwise they will be run again when added to the stickySidebar.
        const javaScriptMIMETypes = /(?:text|application)\/(?:x-)?(?:javascript|ecmascript)/i

        for (const script of Array.from(o.sidebar.querySelectorAll('script'))) {
          if (script.type.length === 0 || script.type.match(javaScriptMIMETypes)) {
            script.remove()
          }
        }

        o.stickySidebar = document.createElement('div')
        o.stickySidebar.classList.add('stickySidebarStickySidebar')
        for (const child of Array.from(o.sidebar.children)) {
          o.stickySidebar.appendChild(child)
        }
        o.sidebar.appendChild(o.stickySidebar)
      }

      // Get existing top and bottom margins and paddings
      const computedStyle = window.getComputedStyle(o.sidebar)
      o.marginBottom = Number.parseInt(computedStyle.getPropertyValue('margin-bottom'))
      o.paddingTop = Number.parseInt(computedStyle.getPropertyValue('padding-top'))
      o.paddingBottom = Number.parseInt(computedStyle.getPropertyValue('padding-bottom'))

      // Add a temporary padding rule to check for collapsable margins.
      let collapsedTopHeight = o.stickySidebar.getBoundingClientRect().top + window.scrollY
      let collapsedBottomHeight = o.stickySidebar.getBoundingClientRect().height
      o.stickySidebar.style.setProperty('padding-top', '1px')
      o.stickySidebar.style.setProperty('padding-bottom', '1px')
      collapsedTopHeight -= o.stickySidebar.getBoundingClientRect().top + window.scrollY
      collapsedBottomHeight
        = o.stickySidebar.getBoundingClientRect().height - collapsedBottomHeight - collapsedTopHeight
      if (collapsedTopHeight === 0) {
        o.stickySidebar.style.setProperty('padding-top', '0')
        o.stickySidebarPaddingTop = 0
      }
      else {
        o.stickySidebarPaddingTop = 1
      }

      if (collapsedBottomHeight === 0) {
        o.stickySidebar.style.setProperty('padding-bottom', '0')
        o.stickySidebarPaddingBottom = 0
      }
      else {
        o.stickySidebarPaddingBottom = 1
      }

      // We use this to know whether the user is scrolling up or down.
      o.previousScrollTop = null

      // Scroll top (value) when the sidebar has fixed position.
      o.fixedScrollTop = 0

      // Set sidebar to default values.
      resetSidebar()

      o.onScroll = (o) => {
        // Stop if the sidebar isn't visible.
        if (getComputedStyle(o.stickySidebar).display === 'none') {
          return
        }

        // Stop if the window is too small.
        if (document.querySelector('body').getBoundingClientRect().width < o.options.minWidth) {
          resetSidebar()
          return
        }

        // Stop if the sidebar width is larger than the container width (e.g. the theme is responsive and the sidebar is now below the content)
        if (o.options.disableOnResponsiveLayouts) {
          const sidebarStyles = getComputedStyle(o.sidebar)
          const margins
            = sidebarStyles.float === 'none'
              ? Number.parseInt(sidebarStyles.marginLeft) + Number.parseInt(sidebarStyles.marginRight)
              : 0
          const sidebarWidth = o.sidebar.getBoundingClientRect().width + margins

          if (sidebarWidth + 50 > o.container.getBoundingClientRect().width) {
            resetSidebar()
            return
          }
        }

        const scrollTop = window.scrollY
        let position = 'static'
        let top = 0

        // Position of element relative to document = position of element relative to screen + window scrolling position
        const sidebarOffset = o.sidebar.getBoundingClientRect().top + window.scrollY

        // If the user has scrolled down enough for the sidebar to be clipped at the top, then we can consider changing its position.
        if (scrollTop >= sidebarOffset + (o.paddingTop - o.options.additionalMarginTop)) {
          // The top and bottom offsets, used in various calculations.
          const offsetTop = o.paddingTop + options.additionalMarginTop
          const offsetBottom = o.paddingBottom + o.marginBottom + options.additionalMarginBottom

          // All top and bottom positions are relative to the window, not to the parent elements.
          const containerTop = o.sidebar.getBoundingClientRect().top + window.scrollY
          const containerBottom
            = o.sidebar.getBoundingClientRect().top + window.scrollY + getClearedHeight(o.container)

          // The top and bottom offsets relative to the window screen top (zero) and bottom (window height).
          const windowOffsetTop = 0 + options.additionalMarginTop
          let windowOffsetBottom

          const sidebarSmallerThanWindow
            = o.stickySidebar.getBoundingClientRect().height + offsetTop + offsetBottom < window.innerHeight
          if (sidebarSmallerThanWindow) {
            windowOffsetBottom = windowOffsetTop + o.stickySidebar.getBoundingClientRect().height
          }
          else {
            windowOffsetBottom = window.innerHeight - o.marginBottom - o.paddingBottom - options.additionalMarginBottom
          }

          const staticLimitTop = containerTop - scrollTop + o.paddingTop
          const staticLimitBottom = containerBottom - scrollTop - o.paddingBottom - o.marginBottom

          top = o.stickySidebar.getBoundingClientRect().top + window.scrollY - scrollTop
          const scrollTopDiff = o.previousScrollTop - scrollTop

          // If the sidebar position is fixed, then it won't move up or down by itself. So, we manually adjust the top coordinate.
          if (getComputedStyle(o.stickySidebar).position === 'fixed') {
            if (o.options.sidebarBehavior === 'modern') {
              top += scrollTopDiff
            }
          }

          if (o.options.sidebarBehavior === 'stick-to-top') {
            top = options.additionalMarginTop
          }

          if (o.options.sidebarBehavior === 'stick-to-bottom') {
            top = windowOffsetBottom - o.stickySidebar.getBoundingClientRect().height
          }

          if (scrollTopDiff > 0) {
            // If the user is scrolling up.
            top = Math.min(top, windowOffsetTop)
          }
          else {
            // If the user is scrolling down.
            top = Math.max(top, windowOffsetBottom - o.stickySidebar.getBoundingClientRect().height)
          }

          top = Math.max(top, staticLimitTop)

          top = Math.min(top, staticLimitBottom - o.stickySidebar.getBoundingClientRect().height)

          // If the sidebar is the same height as the container, we won't use fixed positioning.
          const sidebarSameHeightAsContainer
            = o.container.getBoundingClientRect().height === o.stickySidebar.getBoundingClientRect().height

          if (!sidebarSameHeightAsContainer && top === windowOffsetTop) {
            position = 'fixed'
          }
          else if (
            !sidebarSameHeightAsContainer
            && top === windowOffsetBottom - o.stickySidebar.getBoundingClientRect().height
          ) {
            position = 'fixed'
          }
          else if (
            scrollTop + top - (o.sidebar.getBoundingClientRect().top + window.scrollY) - o.paddingTop
            <= options.additionalMarginTop
          ) {
            // Stuck to the top of the page. No special behavior.
            position = 'static'
          }
          else {
            // Stuck to the bottom of the page.
            position = 'absolute'
          }
        }

        /*
         * Performance notice: It's OK to set these CSS values at each resize/scroll, even if they don't change.
         * It's way slower to first check if the values have changed.
         */
        if (position === 'fixed') {
          const scrollLeft = window.scrollX

          for (const [key, value] of Object.entries({
            position: 'fixed',
            width: `${getWidthForObject(o.stickySidebar)}px`,
            transform: `translateY(${top}px)`,
            left: `${o.sidebar.getBoundingClientRect().left + Number.parseInt(getComputedStyle(o.sidebar).paddingLeft) - scrollLeft}px`,
            top: '0',
          })) {
            o.stickySidebar.style.setProperty(key, value)
          }
        }
        else if (position === 'absolute') {
          const css = {}

          if (getComputedStyle(o.stickySidebar).position !== 'absolute') {
            css.position = 'absolute'
            css.transform = `translateY(${scrollTop + top - (o.sidebar.getBoundingClientRect().top + window.scrollY) - o.stickySidebarPaddingTop - o.stickySidebarPaddingBottom}px)`
            css.top = '0px'
          }

          css.width = `${getWidthForObject(o.stickySidebar)}px`
          css.left = ''

          for (const [key, value] of Object.entries(css)) {
            o.stickySidebar.style.setProperty(key, value)
          }
        }
        else if (position === 'static') {
          resetSidebar()
        }

        if (position !== 'static') {
          if (o.options.updateSidebarHeight === true) {
            o.sidebar.style.setProperty(
              'min-height',
              o.stickySidebar.outerHeight
              + (o.stickySidebar.getBoundingClientRect().top + window.scrollY)
              - (o.sidebar.getBoundingClientRect().top + window.scrollY)
              + o.paddingBottom,
            )
          }
        }

        o.previousScrollTop = scrollTop
      }

      // Initialize the sidebar's position.
      o.onScroll(o)

      // Recalculate the sidebar's position on every scroll and resize.
      document.addEventListener(
        'scroll',
        (o => () => {
          o.onScroll(o)
        })(o),
      )
      window.addEventListener(
        'resize',
        (o => () => {
          o.stickySidebar.style.setProperty('position', 'static')
          o.onScroll(o)
        })(o),
      )

      // Recalculate the sidebar's position every time the sidebar changes its size.
      if (typeof resizeSensor !== 'undefined') {
        // eslint-disable-next-line no-new, new-cap
        new resizeSensor(
          o.stickySidebar,
          (o => () => {
            o.onScroll(o)
          })(o),
        )
      }

      // Reset the sidebar to its default state
      function resetSidebar() {
        o.fixedScrollTop = 0
        o.sidebar.style.setProperty('min-height', '1px')
        for (const [key, value] of Object.entries({
          position: 'static',
          width: '',
          transform: 'none',
        })) {
          o.stickySidebar.style.setProperty(key, value)
        }
      }

      // Get the height of a div as if its floated children were cleared. Note that this function fails if the floats are more than one level deep.
      function getClearedHeight(e) {
        let height = e.getBoundingClientRect().height

        for (const child of Array.from(e.children)) {
          height = Math.max(height, child.getBoundingClientRect().height)
        }

        return height
      }
    }
  }

  function getWidthForObject(object) {
    let width

    try {
      width = object[0].getBoundingClientRect().width
    }
    // eslint-disable-next-line unused-imports/no-unused-vars
    catch (err) {
      // No need to log
    }

    if (typeof width === 'undefined') {
      width = object.getBoundingClientRect().width
    }

    return width
  }

  return this
}

export default stickySidebarStickySidebar
