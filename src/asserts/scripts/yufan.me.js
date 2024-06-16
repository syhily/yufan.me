import Aplayer from 'aplayer/dist/APlayer.min.js';
import stickySidebar from './sticky-sidebar.js';

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
if (typeof searchSidebar !== 'undefined' && searchSidebar !== null) {
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

// Loading the comments.
const comment = document.querySelector('#comments');
if (typeof comment !== 'undefined' && comment !== null) {
  const { key, title, server, site } = comment.dataset;
  // TODO Add dynamic loading feature.
}

// Add like button for updating likes.
const likeButton = document.querySelector('button.post-like');

const increaseLikes = (count) => {
  count.textContent = Number.parseInt(count.textContent) + 1;
  fetch(`${window.location.href}/likes`, {
    method: 'POST',
    headers: {
      'Content-type': 'application/json; charset=UTF-8',
    },
    body: JSON.stringify({ action: 'increase' }),
  })
    .then((res) => res.json())
    .then(({ likes, token }) => {
      count.textContent = likes;
      localStorage.setItem(window.location.href, token);
    });
};

const decreaseLikes = (count) => {
  const token = localStorage.getItem(window.location.href);
  if (token === null || token === '') {
    return;
  }

  count.textContent = Number.parseInt(count.textContent) - 1;
  fetch(`${window.location.href}/likes`, {
    method: 'POST',
    headers: {
      'Content-type': 'application/json; charset=UTF-8',
    },
    body: JSON.stringify({ action: 'decrease', token: token }),
  })
    .then((res) => res.json())
    .then(({ likes }) => {
      count.textContent = likes;
      localStorage.removeItem(window.location.href);
    });
};

if (typeof likeButton !== 'undefined' && likeButton !== null) {
  // Change the like state if it has been liked.
  const token = localStorage.getItem(window.location.href);
  if (token !== null && token !== '') {
    likeButton.classList.add('current');
  }

  // Add the click action.
  likeButton.addEventListener('click', (event) => {
    event.preventDefault();
    event.stopPropagation();

    const count = likeButton.querySelector('.like-count');
    if (typeof count === 'undefined') {
      return;
    }

    // Increase the likes and set liked before submitting.
    if (likeButton.classList.contains('current')) {
      likeButton.classList.remove('current');
      decreaseLikes(count);
    } else {
      likeButton.classList.add('current');
      increaseLikes(count);
    }
  });
}

// Sticky Sidebar
stickySidebar(document.querySelectorAll('.sidebar'));
