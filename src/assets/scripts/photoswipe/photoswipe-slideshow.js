/**
 * Slideshow plugin for PhotoSwipe v5.
 *
 * https://github.com/htmltiger/photoswipe-slideshow
 */
class PhotoSwipeSlideshow {
  constructor(lightbox, options) {
    this.lightbox = lightbox;
    this.options = Object.assign(
      {
        defaultDelayMs: 4000,
        playPauseButtonOrder: 6,
        progressBarPosition: 'top',
        progressBarTransition: 'ease',
        restartOnSlideChange: true,
        autoHideProgressBar: true,
      },
      options,
    );

    // Use the stored slideshow length, if it's been saved to Local Storage.
    // Otherwise, use the length specified by the caller, or fall back to the default value.
    this.setSlideshowLength(Number(localStorage.getItem('pswp_delay')) || this.options.defaultDelayMs);

    document.head.insertAdjacentHTML(
      'beforeend',
      `<style>.pswp__progress-bar{position:fixed;${this.options.progressBarPosition}:0;width:0;height:0}.pswp__progress-bar.running{width:100%;height:3px;transition-property:width;background:#c00}</style>`,
    );

    // Set default parameters.
    this.slideshowIsRunning = false;
    this.slideshowTimerID = null;
    this.wakeLockIsRunning = false;
    this.wakeLockSentinel = null;

    // Set up lightbox and gallery event binds.
    this.lightbox.on('init', () => {
      this.init(this.lightbox.pswp);
    });
  }

  // Set up event binds for the PhotoSwipe lightbox and gallery.

  init(pswp) {
    // Add UI elements to an open gallery.
    pswp.on('uiRegister', () => {
      // Add a button to the PhotoSwipe UI for toggling the slideshow state.
      pswp.ui.registerElement({
        name: 'playpause-button',
        title: 'Toggle slideshow (Space)\nChange delay with +/- while running',
        order: this.options.playPauseButtonOrder,
        isButton: true,
        html: '<svg aria-hidden="true" class="pswp__icn" viewBox="0 0 32 32"><use class="pswp__icn-shadow" xlink:href="#pswp__icn-play"/><use class="pswp__icn-shadow" xlink:href="#pswp__icn-stop"/><path id="pswp__icn-play" d="M9.5 6.4c-.7-.4-1.6-.4-2.3-0S6 7.5 6 8.2V23.9c0 .8.5 1.5 1.2 1.9s1.6.4 2.3-0l13.8-7.8a2.3 2.1 0 000-3.7z"/><path id="pswp__icn-stop" style="display:none" d="M6 9A3 3 90 019 6H23A3 3 90 0126 9V23a3 3 90 01-3 3H9A3 3 90 016 23z"/></svg>',
        onClick: (event, el) => {
          this.setSlideshowState();
        },
      });

      // Add an element for the slideshow progress bar.
      pswp.ui.registerElement({
        name: 'playtime',
        appendTo: 'wrapper', // add to PhotoSwipe's scroll viewport wrapper
        tagName: 'div',
        className: 'pswp__progress-bar',
      });

      // Add custom keyboard bindings, replacing the default bindings.
      pswp.events.add(document, 'keydown', (e) => {
        switch (e.code) {
          case 'Space':
            this.setSlideshowState();
            e.preventDefault();
            break;

          case 'ArrowUp':
          case 'NumpadAdd':
          case 'Equal':
            this.changeSlideshowLength(1000);
            e.preventDefault();
            break;

          case 'ArrowDown':
          case 'NumpadSubtract':
          case 'Minus':
            this.changeSlideshowLength(-1000);
            e.preventDefault();
            break;
        }
      });
    });

    // When slide is switched during the slideshow, optionally restart the slideshow.
    this.lightbox.on('change', () => {
      if (this.slideshowIsRunning && this.options.restartOnSlideChange) {
        this.goToNextSlideAfterTimeout();
      }
    });

    // Close the slideshow when closing PhotoSwipe.
    this.lightbox.on('close', () => {
      if (this.slideshowIsRunning) {
        this.setSlideshowState();
      }
    });
  }

  // Toggle the slideshow state and switch the button's icon.

  setSlideshowState() {
    // Invert the slideshow state.
    this.slideshowIsRunning = !this.slideshowIsRunning;

    if (this.slideshowIsRunning) {
      // Starting the slideshow: go to next slide after some wait time.
      this.goToNextSlideAfterTimeout();
    } else {
      // Stopping the slideshow: reset the progress bar and timer.
      this.resetSlideshow();
    }

    // Update button icon to reflect the slideshow state.
    document.querySelector('#pswp__icn-stop').style.display = this.slideshowIsRunning ? 'inline' : 'none';
    document.querySelector('#pswp__icn-play').style.display = this.slideshowIsRunning ? 'none' : 'inline';

    // Optionally ensure the progress bar isn't hidden after some time of inactivity.
    document.querySelector('.pswp__progress-bar').style.opacity = this.options.autoHideProgressBar ? null : 1;

    // Prevent or allow the screen to turn off.
    this.toggleWakeLock();
  }

  setSlideshowLength(newDelay) {
    // The `setTimeout` function requires a 32-bit positive number, in milliseconds.
    // But 1ms isn't useful for a slideshow, so use a reasonable minimum.
    this.options.defaultDelayMs = Math.min(Math.max(newDelay, 1000), 2147483647); // 1 sec <= delay <= 24.85 days

    // Save the slideshow length to Local Storage if one of the bounds has been reached.
    // This survives page refreshes.
    if (this.options.defaultDelayMs !== newDelay) {
      localStorage.setItem('pswp_delay', this.options.defaultDelayMs);
    }
  }

  changeSlideshowLength(delta) {
    // Don't do anything if the slideshow isn't running.
    if (!this.slideshowIsRunning) {
      return;
    }

    // Update the slideshow length and save it to Local Storage.
    this.setSlideshowLength(this.options.defaultDelayMs + delta);
    localStorage.setItem('pswp_delay', this.options.defaultDelayMs);

    // Show the current slideshow length.
    const slideCounterElement = document.querySelector('.pswp__counter');
    if (slideCounterElement) {
      slideCounterElement.innerHTML = `${this.options.defaultDelayMs / 1000}s`;
    }

    // Restart the slideshow.
    this.goToNextSlideAfterTimeout();
  }

  isVideoContent(content) {
    return content?.data?.type === 'video';
  }

  // Calculate the time before going to the next slide.
  getSlideTimeout() {
    const slideContent = pswp.currSlide.content;

    // Calculate remaining duration for videos.
    if (this.isVideoContent(slideContent)) {
      const videoElement = slideContent.element;
      if (videoElement.paused) {
        // Use default delay if video isn't playing.
        return this.options.defaultDelayMs;
      }

      const durationSec = videoElement.duration;
      const currentTimeSec = videoElement.currentTime;
      if (Number.isNaN(durationSec) || Number.isNaN(currentTimeSec)) {
        // Fall back to default delay if video hasn't been loaded yet.
        return this.options.defaultDelayMs;
      }
      return (durationSec - currentTimeSec) * 1000;
    }

    // Use the default delay for images.
    return this.options.defaultDelayMs;
  }

  slideContentHasLoaded() {
    const slideContent = pswp.currSlide.content;

    if (this.isVideoContent(slideContent)) {
      // Ensure that video can be played smoothly:
      //  * Enough data has been downloaded for playback
      //    (https://developer.mozilla.org/en-US/docs/Web/API/HTMLMediaElement/readyState)
      //  * More data may still need to be downloaded
      //    (https://developer.mozilla.org/en-US/docs/Web/API/HTMLMediaElement/networkState)
      // This requires a network with a sufficiently high download rate.
      const videoElement = slideContent.element;
      return (
        videoElement.ended ||
        (videoElement.readyState === HTMLMediaElement.HAVE_ENOUGH_DATA &&
          [HTMLMediaElement.NETWORK_IDLE, HTMLMediaElement.NETWORK_LOADING].includes(videoElement.networkState))
      );
    }

    // For images (or other media), use PhotoSwipe's LOAD_STATE.
    return !slideContent.isLoading();
  }

  goToNextSlideAfterTimeout() {
    // Reset the progress bar and timer.
    this.resetSlideshow();

    if (this.slideContentHasLoaded()) {
      // Get timeout length, accounting for various media types.
      const currentSlideTimeout = this.getSlideTimeout();

      // Start the slideshow timer.
      this.slideshowTimerID = setTimeout(() => {
        pswp.next();
        if (this.options.restartOnSlideChange) {
          // The slideshow timer has been set by the `change` listener.
        } else {
          this.goToNextSlideAfterTimeout();
        }
      }, currentSlideTimeout);

      // Show the progress bar.
      // This needs a small delay so the browser has time to reset the progress bar.
      setTimeout(() => {
        if (this.slideshowIsRunning) {
          this.toggleProgressBar(currentSlideTimeout);
        }
      }, 100);
    } else {
      // Wait for the media to load, without blocking the page.
      this.slideshowTimerID = setTimeout(() => {
        this.goToNextSlideAfterTimeout();
      }, 200);
    }
  }

  // https://developer.mozilla.org/en-US/docs/Web/CSS/transition-timing-function
  getSlideTransition() {
    if (this.isVideoContent(pswp.currSlide.content)) {
      // Match the transition of a video player's seekbar.
      return 'linear';
    }

    // Use the default animation.
    return this.options.progressBarTransition;
  }

  toggleProgressBar(currentSlideTimeout) {
    const slideshowProgressBarElement = document.querySelector('.pswp__progress-bar');

    if (currentSlideTimeout) {
      // Start slideshow
      slideshowProgressBarElement.style.transitionTimingFunction = this.getSlideTransition();
      slideshowProgressBarElement.style.transitionDuration = `${currentSlideTimeout}ms`;
      slideshowProgressBarElement.classList.add('running');
    } else {
      // Stop slideshow
      slideshowProgressBarElement.classList.remove('running');
    }
  }

  toggleWakeLock() {
    if (this.wakeLockIsRunning === this.slideshowIsRunning) {
      return;
    }

    if ('keepAwake' in screen) {
      // Use experimental API for older browsers.
      // This is a simple boolean flag.
      screen.keepAwake = this.slideshowIsRunning;
    } else if ('wakeLock' in navigator) {
      // Use the Screen Wake Lock API for newer browsers.

      if (this.wakeLockSentinel) {
        // Release screen wake lock, if a request was previously successful.
        this.wakeLockSentinel.release().then(() => {
          this.wakeLockSentinel = null;
        });
      } else {
        // Request screen wake lock.
        navigator.wakeLock
          .request('screen')
          .then((sentinel) => {
            // Save the reference for the wake lock.
            this.wakeLockSentinel = sentinel;

            // Update our state if the wake lock happens to be released by the browser.
            this.wakeLockSentinel.addEventListener('release', () => {
              this.wakeLockSentinel = null;
              this.wakeLockIsRunning = false;
            });
          })
          .catch((e) => {}); // ignore errors if wake lock request fails.
      }
    }

    this.wakeLockIsRunning = this.slideshowIsRunning;
  }

  // Stop the slideshow by resetting the progress bar and timer.
  resetSlideshow() {
    this.toggleProgressBar();
    if (this.slideshowTimerID) {
      clearTimeout(this.slideshowTimerID);
      this.slideshowTimerID = null;
    }
  }
}

export default PhotoSwipeSlideshow;
