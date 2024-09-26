import Aplayer from 'aplayer/dist/APlayer.min.js';
import { actions, isInputError } from 'astro:actions';
import stickySidebar from './sticky-sidebar.js';

// Error Popup.
const handleActionError = (error) => {
  const errorMsg = isInputError(error)
    ? error.issues.map((issue) => `<p>${issue.message}</p>`).join('\n')
    : error.message;
  const errorPopup = `<div class="nice-popup nice-popup-center error nice-popup-error nice-popup-open">
  <div class="nice-popup-overlay"></div>
  <div class="nice-popup-body">
    <div class="nice-popup-close"><span class="svg-white"></span> <span class="svg-dark"></span></div>
    <div class="nice-popup-content">
      <div class="icon"></div>
      <div class="text-center">
        <p class="mt-1 mb-2">${errorMsg}</p>
      </div>
    </div>
  </div>
</div>`;
  document.querySelector('body').insertAdjacentHTML('beforeend', errorPopup);
  const popup = document.querySelector('.nice-popup-error');
  popup.querySelector('.nice-popup-close').addEventListener('click', () => popup.remove());
};

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
      location.href = `/search/${encodeURIComponent(query)}`;
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

searchPopup.querySelector('.search-dialog').addEventListener('submit', (event) => {
  event.preventDefault();
  event.stopPropagation();

  const formData = new FormData(event.target);
  const query = formData.get('q');
  location.href = `/search/${encodeURIComponent(query)}`;
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
        actions.avatar({ email }).then(({ data, error }) => {
          if (error) {
            return handleActionError(error);
          }
          avatar.src = data.avatar;
        });
      } else {
        avatar.src = avatar.dataset.src;
      }
    }
  });

  comments.addEventListener('click', async (event) => {
    // Loading more comments from server.
    if (event.target === comments.querySelector('#comments-next-button')) {
      const { size, offset, key } = event.target.dataset;
      const { data, error } = await actions.comments({ offset: Number(offset), page_key: key });
      if (error) {
        return handleActionError(error);
      }

      const { content } = data;
      if (content === '') {
        // Remove the load more button.
        event.target.remove();
      } else {
        // Append the comments into the list.
        event.target.dataset.offset = Number(offset) + Number(size);
        comments.querySelector('.comment-list').insertAdjacentHTML('beforeend', content);
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
    const request = {};
    for (const [key, value] of formData) {
      request[key] = value;
    }
    request.rid = request.rid === undefined ? 0 : Number(request.rid);

    const { data, error } = await actions.comment(request);

    if (error) {
      return handleActionError(error);
    }

    const { content } = data;
    if (request.rid !== 0) {
      replyForm.insertAdjacentHTML('beforebegin', content);
    } else {
      const list = comments.querySelector('.comment-list');
      list.insertAdjacentHTML('afterbegin', content);
    }

    cancelReply();
  });
}

const scrollIntoView = (elem) => {
  if (elem === undefined || elem === null) {
    return;
  }

  const rect = elem.getBoundingClientRect();
  const elemTop = rect.top + window.scrollY;
  const scrollOptions = {
    top: elemTop,
    left: 0,
    behavior: 'smooth',
  };

  window.scroll(scrollOptions);
};

// Highlighting the selected comment.
const focusContent = () => {
  if (location.hash.startsWith('#atk-comment-')) {
    for (const li of document.querySelectorAll('.comment-body')) {
      li.classList.remove('active');
    }

    const li = document.querySelector(location.hash);
    if (li !== null) {
      scrollIntoView(li);
      li.querySelector('.comment-body').classList.add('active');
    }
  } else {
    // Try to find the ID on heading
    if (location.hash.startsWith('#')) {
      scrollIntoView(document.getElementById(decodeURIComponent(location.hash).substring(1)));
    }
  }
};

window.addEventListener('load', focusContent);

// TOC Support
for (const anchor of document.querySelectorAll('a[href^="#"]')) {
  anchor.addEventListener('click', (e) => {
    e.preventDefault();
    const href = anchor.getAttribute('href');
    location.hash = `${href}`;
    scrollIntoView(document.querySelector(anchor.getAttribute('href')));
  });
}

// Add like button for updating likes.
const likeButton = document.querySelector('button.post-like');

const increaseLikes = (count, permalink) => {
  count.textContent = Number.parseInt(count.textContent) + 1;
  actions.like({ action: 'increase', key: permalink }).then(({ data, error }) => {
    if (error) {
      return handleActionError(error);
    }
    const { likes, token } = data;
    count.textContent = likes;
    localStorage.setItem(permalink, token);
  });
};

const decreaseLikes = (count, permalink) => {
  const token = localStorage.getItem(permalink);
  if (token === null || token === '') {
    return;
  }
  count.textContent = Number.parseInt(count.textContent) - 1;
  actions.like({ action: 'decrease', key: permalink, token }).then(({ data, error }) => {
    if (error) {
      return handleActionError(error);
    }
    count.textContent = data.likes;
    localStorage.removeItem(permalink);
  });
};

if (typeof likeButton !== 'undefined' && likeButton !== null) {
  const permalink = likeButton.dataset.permalink;

  // Change the like state if it has been liked.
  const token = localStorage.getItem(permalink);
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
      decreaseLikes(count, permalink);
    } else {
      likeButton.classList.add('current');
      increaseLikes(count, permalink);
    }
  });
}

// Sticky Sidebar
stickySidebar(document.querySelectorAll('.sidebar'));
