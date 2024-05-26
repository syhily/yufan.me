import Aplayer from 'aplayer/dist/APlayer.min.js';
import Artalk from 'artalk/dist/ArtalkLite';

// Menu toggle.
const menuBody = document.querySelector('.site-aside');
document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') {
    event.preventDefault();
    event.stopPropagation();
    menuBody.classList.toggle('in', false);
  }
});
document.querySelector('.menu-toggler').addEventListener('click', () => menuBody.classList.toggle('in', true));
document.querySelector('.site-menu').addEventListener('click', () => menuBody.classList.toggle('in', false));
document.querySelector('.aside-overlay').addEventListener('click', () => menuBody.classList.toggle('in', false));

// Go to top.
const goTop = document.querySelector('.fixed-gotop');
const handleScrollUp = () => {
  window.requestAnimationFrame(() => {
    goTop.classList.toggle('current', window.scrollY > 300);
  });
};

goTop.addEventListener('click', () => window.scrollTo({ left: 0, top: 0, behavior: 'smooth' }));
window.addEventListener('scroll', handleScrollUp);
window.addEventListener('resize', handleScrollUp);

// Dialog popup.
for (const dialog of document.querySelectorAll('.nice-dialog')) {
  const popup = dialog.querySelector('.nice-popup');
  dialog.addEventListener('click', (event) => {
    event.stopPropagation();
    popup.classList.toggle('nice-popup-open', true);
  });

  const close = dialog.querySelector('.nice-popup-close');
  close.addEventListener('click', (event) => {
    event.stopPropagation();
    popup.classList.toggle('nice-popup-open', false);
  });
}

// Netease music player.
const ps = document.querySelectorAll('.aplayer');
for (const p of ps) {
  new Aplayer({
    container: p,
    audio: [
      {
        name: p.dataset.name,
        artist: p.dataset.artist,
        url: p.dataset.url,
        cover: p.dataset.cover,
        theme: '#ebd0c2',
      },
    ],
  });
}

// Search Bar.
const searchSidebar = document.querySelector('.search-sidebar');
if (searchSidebar) {
  searchSidebar.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      event.stopPropagation();

      const query = event.target.value;
      event.target.value = '';
      location.href = `/search?q=${encodeURIComponent(query)}`;
    }
  });
}

// Search dialog.
const searchPopup = document.querySelector('.global-search-popup');
document.querySelector('.global-search').addEventListener('click', (event) => {
  event.stopPropagation();
  searchPopup.classList.toggle('nice-popup-open', true);
});

document.querySelector('.global-search-close').addEventListener('click', (event) => {
  event.stopPropagation();
  searchPopup.classList.toggle('nice-popup-open', false);
});

// Console.log
const comment = document.getElementById('comments');
if (typeof comment !== 'undefined') {
  Artalk.init({
    el: '#comments',
    pageKey: comment.dataset.key,
    pageTitle: comment.dataset.title,
    server: comment.dataset.server,
    site: comment.dataset.site,
  });
}
