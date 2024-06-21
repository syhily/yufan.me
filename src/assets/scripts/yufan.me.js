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
const comments = document.querySelector('#comments');
if (typeof comments !== 'undefined' && comments !== null) {
  const cancel = comments.querySelector('#cancel-comment-reply-link');
  const replyForm = comments.querySelector('#respond');
  const cancelReply = () => {
    cancel.hidden = true;
    replyForm.querySelector('textarea[name="content"]').value = '';

    // Move the form back to top.
    const commentCount = comments.querySelector('.comment-total-count');
    commentCount.after(replyForm);

    // Get rid to clean up the children form.
    const ridInput = replyForm.querySelector('input[name="rid"]');
    const rid = ridInput.value;
    ridInput.value = '0';
    if (rid !== '0') {
      const children = comments.querySelector(`#atk-comment-${rid}`).querySelector('.children');
      if (children !== null && children.querySelectorAll('li').length === 0) {
        children.remove();
      }
    }
  };

  // TODO: Load the commenter information from the cookie.

  comments.addEventListener('focusout', (event) => {
    const avatar = document.querySelector('#commentForm img.avatar');
    if (event.target === document.querySelector('input[name="email"]')) {
      event.stopPropagation();
      const email = event.target.value;
      if (email !== '' && email.includes('@')) {
        // Replace the avatar after typing the email.
        fetch(`/comments/avatar?email=${email}`)
          .then((res) => res.text())
          .then((link) => {
            avatar.src = link;
          })
          .catch((e) => console.log(e));
      } else {
        avatar.src = avatar.dataset.src;
      }
    }
  });

  comments.addEventListener('click', async (event) => {
    // Loading more comments from server.
    if (event.target === comments.querySelector('#comments-next-button')) {
      const { size, offset, key } = event.target.dataset;
      const html = await fetch(`/comments/list?key=${key}&offset=${offset}`)
        .then((res) => res.text())
        .catch((e) => {
          console.log(e);
          return '';
        });
      if (html === '') {
        // Remove the load more button.
        event.target.remove();
      } else {
        // Append the comments into the list.
        event.target.dataset.offset = Number(offset) + Number(size);
        comments.querySelector('.comment-list').insertAdjacentHTML('beforeend', html);
      }
    }

    // Reply a comment.
    if (event.target.matches('.comment-reply-link')) {
      cancelReply();
      cancel.hidden = false;
      replyForm.querySelector('input[name="rid"]').value = event.target.dataset.rid;

      // Move form to the reply.
      const commentItem = event.target.closest('li');
      if (commentItem.dataset.depth === '1') {
        if (commentItem.querySelector('ul.children') === null) {
          // Create this for better architecture.
          commentItem.insertAdjacentHTML('beforeend', '<ul class="children"></ul>');
        }
        commentItem.querySelector('ul.children').appendChild(replyForm);
      } else {
        commentItem.after(replyForm);
      }

      // Focus the comment form.
      replyForm.querySelector('#content').focus();
    }

    // Cancel reply comment.
    if (event.target === cancel) {
      cancelReply();
    }
  });

  // Reply a comment.
  comments.addEventListener('submit', async (event) => {
    event.preventDefault();
    event.stopPropagation();

    const formData = new FormData(event.target);
    const data = {};
    for (const [key, value] of formData) {
      data[key] = value;
    }

    const resp = await fetch('/comments/new', {
      method: 'POST',
      headers: {
        'Content-type': 'application/json; charset=UTF-8',
      },
      body: JSON.stringify(data),
    })
      .then((res) => res.text())
      .catch((e) => {
        console.log(e);
        return '<li>评论失败<li>';
      });

    if (data.rid !== '0') {
      replyForm.insertAdjacentHTML('beforebegin', resp);
    } else {
      const list = comments.querySelector('.comment-list');
      list.insertAdjacentHTML('afterbegin', resp);
    }

    cancelReply();
  });
}

const scrollIntoView = (elem) => {
  let top = 0;

  const rect = elem.getBoundingClientRect();
  const elemTop = rect.top + window.scrollY;
  top = elemTop - (window.innerHeight / 2 - rect.height / 2);

  const scrollOptions = {
    top,
    left: 0,
    behavior: 'smooth',
  };

  window.scroll(scrollOptions);
};

const focusComment = () => {
  // Highlighting the selected comment.
  if (location.hash.startsWith('#atk-comment-')) {
    for (const li of document.querySelectorAll('.comment-body')) {
      li.classList.remove('active');
    }

    const li = document.querySelector(location.hash);
    if (li !== null) {
      scrollIntoView(li);
      li.querySelector('.comment-body').classList.add('active');
    }
  }
};
window.addEventListener('hashchange', focusComment);
window.addEventListener('load', focusComment);

// Add like button for updating likes.
const likeButton = document.querySelector('button.post-like');

const increaseLikes = (count) => {
  count.textContent = Number.parseInt(count.textContent) + 1;
  fetch('/likes', {
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
  fetch('/likes', {
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
