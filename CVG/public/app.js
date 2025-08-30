// public/app.js
const feedEl = document.getElementById('feed');
const uploadToggleBtn = document.getElementById('uploadToggle');
const uploadPanel = document.getElementById('uploadPanel');
const closeUploadBtn = document.getElementById('closeUpload');
const uploadForm = document.getElementById('uploadForm');
const muteToggleBtn = document.getElementById('muteToggle');

let isMuted = true;
let loading = false;
let reachedEnd = false;
let nextCursor = null;

// IntersectionObserver to autoplay the in-view video
const observer = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    const video = entry.target.querySelector('video');
    if (!video) return;
    if (entry.isIntersecting && entry.intersectionRatio > 0.6) {
      pauseAllExcept(video);
      video.muted = isMuted;
      video.play().catch(() => {/* ignore */});
    } else {
      video.pause();
    }
  });
}, { threshold: [0.0, 0.6, 1.0] });

function pauseAllExcept(current) {
  document.querySelectorAll('video').forEach(v => { if (v !== current) v.pause(); });
}

function videoCardTemplate(v) {
  const card = document.createElement('section');
  card.className = 'card';
  card.dataset.id = v.id;
  card.innerHTML = `
    <div class="player">
      <video playsinline muted loop preload="metadata" src="${v.url}"></video>
    </div>
    <div class="meta">
      <div class="title">${escapeHtml(v.title)}</div>
      <div class="controls">
        <button class="likeBtn">❤ Like</button>
        <span class="likes">${v.likes}</span>
      </div>
    </div>
  `;
  const video = card.querySelector('video');
  video.addEventListener('click', () => {
    if (video.paused) video.play(); else video.pause();
  });
  const likeBtn = card.querySelector('.likeBtn');
  const likesEl = card.querySelector('.likes');
  likeBtn.addEventListener('click', async () => {
    try {
      likeBtn.disabled = true;
      const res = await fetch(`/api/videos/${v.id}/like`, { method: 'POST' });
      if (!res.ok) throw new Error('Like failed');
      const data = await res.json();
      likesEl.textContent = data.likes;
    } catch (e) {
      alert('Failed to like this video.');
    } finally {
      likeBtn.disabled = false;
    }
  });
  observer.observe(card);
  return card;
}

function escapeHtml(s) {
  return s.replace(/[&<>\"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'}[c]));
}

async function loadMore() {
  if (loading || reachedEnd) return;
  loading = true;
  showLoading();
  try {
    const url = new URL('/api/videos', window.location.origin);
    url.searchParams.set('limit', '5');
    if (nextCursor) url.searchParams.set('cursor', String(nextCursor));
    const res = await fetch(url);
    if (!res.ok) throw new Error('Failed to fetch feed');
    const { videos, nextCursor: nc } = await res.json();

    if (!videos || videos.length === 0) {
      if (feedEl.children.length === 0) {
        feedEl.insertAdjacentHTML('beforeend', `<p class="empty">No videos yet. Click <b>Upload</b> to add one!</p>`);
      }
      reachedEnd = true;
      return;
    }

    const frag = document.createDocumentFragment();
    videos.forEach(v => frag.appendChild(videoCardTemplate(v)));
    feedEl.appendChild(frag);

    nextCursor = nc; // may become null => reached the end next time
    if (!nextCursor) reachedEnd = true;
  } catch (err) {
    console.error(err);
    alert('Could not load videos.');
  } finally {
    hideLoading();
    loading = false;
  }
}

function showLoading() {
  if (!document.querySelector('.loading')) {
    const el = document.createElement('div');
    el.className = 'loading';
    el.textContent = 'Loading…';
    feedEl.appendChild(el);
  }
}
function hideLoading() {
  const el = document.querySelector('.loading');
  if (el) el.remove();
}

// Infinite scroll trigger near bottom
feedEl.addEventListener('scroll', () => {
  const nearBottom = feedEl.scrollTop + feedEl.clientHeight >= feedEl.scrollHeight - 200;
  if (nearBottom) loadMore();
});

// Upload panel toggle
uploadToggleBtn.addEventListener('click', () => uploadPanel.classList.toggle('hidden'));
closeUploadBtn.addEventListener('click', () => uploadPanel.classList.add('hidden'));

// Upload form submit
uploadForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const fd = new FormData(uploadForm);
  try {
    const res = await fetch('/api/upload', { method: 'POST', body: fd });
    if (!res.ok) {
      const msg = await res.text();
      throw new Error(msg || 'Upload failed');
    }
    const v = await res.json();
    // Prepend the new card at the top and scroll to top
    const card = videoCardTemplate(v);
    feedEl.prepend(card);
    feedEl.scrollTo({ top: 0, behavior: 'smooth' });
    uploadPanel.classList.add('hidden');
    uploadForm.reset();
  } catch (err) {
    console.error(err);
    alert('Upload failed. Ensure the file is MP4/WebM and ≤ 50 MB.');
  }
});

// Global mute toggle
muteToggleBtn.addEventListener('click', () => {
  isMuted = !isMuted;
  muteToggleBtn.textContent = `Mute: ${isMuted ? 'ON' : 'OFF'}`;
  muteToggleBtn.setAttribute('aria-pressed', String(isMuted));
  document.querySelectorAll('video').forEach(v => v.muted = isMuted);
});

// Initial fetch
loadMore();