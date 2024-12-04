/**
 * PhotoSwipe Auto Hide UI plugin v1.0.1
 *
 * https://github.com/arnowelzel/photoswipe-auto-hide-ui
 */
const defaultOptions = {
  idleTime: 4000,
};

class PhotoSwipeAutoHideUI {
  constructor(lightbox, options) {
    this.options = {
      ...defaultOptions,
      ...options,
    };

    this.captionTimer = false;

    this.lightbox = lightbox;

    this.hasTouch = false;

    this.lightbox.on('change', () => {
      document.addEventListener(
        'touchstart',
        () => {
          this.stopHideTimer();
          this.hasTouch = true;
        },
        { once: true },
      );
      document.addEventListener(
        'mousemove',
        () => {
          this.startHideTimer();
        },
        { once: true },
      );
    });

    this.lightbox.on('destroy', () => {
      this.stopHideTimer();
    });
  }

  showUI() {
    if (this.lightbox?.pswp?.element) {
      this.lightbox.pswp.element.classList.add('pswp--ui-visible');
    }
  }

  hideUI() {
    if (this.lightbox?.pswp?.element) {
      this.lightbox.pswp.element.classList.remove('pswp--ui-visible');
    }
  }

  mouseMove() {
    this.stopHideTimer();
    if (this.lightbox) {
      this.showUI();
      this.startHideTimer();
    }
  }

  startHideTimer() {
    if (this.hasTouch) {
      return;
    }

    this.stopHideTimer();
    this.captionTimer = window.setTimeout(() => {
      this.hideUI();
    }, this.options.idleTime);
    document.addEventListener(
      'mousemove',
      () => {
        this.mouseMove();
      },
      { once: true },
    );
  }

  stopHideTimer() {
    if (this.captionTimer) {
      window.clearTimeout(this.captionTimer);
      this.captionTimer = false;
    }
  }
}

export default PhotoSwipeAutoHideUI;
