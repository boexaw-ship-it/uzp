/* ── UZ P — app.js ── */

'use strict';

// ── STATE ──────────────────────────────────────────────────────────
let hlsInst   = null;
let allCh     = [];
let filtered  = [];
let activeTab = 'ALL';
let activeCh  = null;

// ── SPLASH ─────────────────────────────────────────────────────────
(function splash() {
  const fill = document.getElementById('splashFill');
  let w = 0;
  const t = setInterval(() => {
    w += Math.random() * 18 + 8;
    if (w >= 100) { w = 100; clearInterval(t); }
    fill.style.width = w + '%';
  }, 80);

  setTimeout(() => {
    document.getElementById('splash').style.opacity = '0';
    document.getElementById('splash').style.transition = 'opacity 0.4s';
    setTimeout(() => {
      document.getElementById('splash').style.display = 'none';
      document.getElementById('app').classList.remove('hidden');
    }, 400);
  }, 1200);
})();

// ── NAV ─────────────────────────────────────────────────────────────
document.querySelectorAll('.nav-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    const tab = btn.dataset.tab;

    if (tab === 'upload') {
      showUploadSheet();
      // Revert active to previous
      setTimeout(() => {
        btn.classList.remove('active');
        document.querySelector('.nav-btn[data-tab="watch"]').classList.add('active');
      }, 100);
    } else if (tab === 'channels') {
      showChannelsView();
    } else {
      showWatchView();
    }
  });
});

function showWatchView() {
  document.getElementById('playerSection').style.display = '';
  document.getElementById('urlSection') && (document.getElementById('urlSection').style.display = '');
  document.getElementById('channelsSection').style.display = 'none';
  document.getElementById('emptyState').style.display = allCh.length ? 'none' : '';
}

function showChannelsView() {
  if (!allCh.length) { showUploadSheet(); return; }
  document.getElementById('channelsSection').style.display = '';
  document.getElementById('emptyState').style.display = 'none';
}

// ── UPLOAD SHEET ────────────────────────────────────────────────────
function showUploadSheet() {
  let overlay = document.getElementById('uploadOverlay');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'uploadOverlay';
    overlay.className = 'upload-overlay';
    overlay.innerHTML = `
      <div class="upload-sheet" id="uploadSheet">
        <div class="sheet-handle"></div>
        <div class="sheet-title">Load Playlist</div>
        <div class="sheet-sub">Upload your .m3u or .m3u8 file</div>
        <div class="drop-zone" id="dropZone">
          <div class="drop-icon">📂</div>
          <div class="drop-text">Tap to browse or <strong>drag & drop</strong><br>.m3u file here</div>
        </div>
        <button class="sheet-cancel" id="sheetCancel">Cancel</button>
      </div>`;
    document.body.appendChild(overlay);

    document.getElementById('dropZone').addEventListener('click', () => {
      document.getElementById('fileInput').click();
    });
    document.getElementById('sheetCancel').addEventListener('click', hideUploadSheet);
    overlay.addEventListener('click', e => { if (e.target === overlay) hideUploadSheet(); });

    // Drag & drop
    const dz = document.getElementById('dropZone');
    dz.addEventListener('dragover', e => { e.preventDefault(); dz.classList.add('drag'); });
    dz.addEventListener('dragleave', () => dz.classList.remove('drag'));
    dz.addEventListener('drop', e => {
      e.preventDefault(); dz.classList.remove('drag');
      const file = e.dataTransfer.files[0];
      if (file) readFile(file);
    });
  }
  overlay.classList.remove('hidden');
}

function hideUploadSheet() {
  const o = document.getElementById('uploadOverlay');
  if (o) o.classList.add('hidden');
}

// ── FILE INPUT ──────────────────────────────────────────────────────
document.getElementById('fileInput').addEventListener('change', function() {
  if (this.files[0]) readFile(this.files[0]);
  this.value = '';
});

function readFile(file) {
  const reader = new FileReader();
  reader.onload = e => {
    localStorage.setItem('uzp_playlist', e.target.result);
    allCh = parseM3U(e.target.result);
    hideUploadSheet();
    initChannels();
    showToast('✅ ' + allCh.length + ' channels loaded');
  };
  reader.readAsText(file);
}


// ── PARSE M3U ───────────────────────────────────────────────────────
function parseM3U(text) {
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
  const channels = [];
  for (let i = 0; i < lines.length; i++) {
    if (!lines[i].startsWith('#EXTINF')) continue;
    const extinf = lines[i];
    const url = lines[i + 1] && !lines[i + 1].startsWith('#') ? lines[i + 1] : '';
    if (!url) continue;
    const nameM  = extinf.match(/,(.+)$/);
    const groupM = extinf.match(/group-title="([^"]*)"/i);
    const logoM  = extinf.match(/tvg-logo="([^"]*)"/i);
    channels.push({
      name:  nameM  ? nameM[1].trim()  : 'Unknown',
      group: groupM ? groupM[1].trim() : 'Other',
      logo:  logoM  ? logoM[1]         : '',
      url
    });
    i++;
  }
  return channels;
}

// ── INIT CHANNELS ───────────────────────────────────────────────────
function initChannels() {
  activeTab = 'ALL';
  buildTabs();
  filterAndRender();
  document.getElementById('emptyState').style.display = 'none';
  document.getElementById('channelsSection').style.display = '';
  document.getElementById('chCount').textContent = allCh.length;

  // Switch to channels view
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
  document.querySelector('.nav-btn[data-tab="channels"]').classList.add('active');
  showChannelsView();
}

// ── TABS ────────────────────────────────────────────────────────────
function buildTabs() {
  const groups = ['ALL', ...new Set(allCh.map(c => c.group).filter(Boolean).sort())];
  const tabs = document.getElementById('tabs');
  tabs.innerHTML = groups.map(g => `
    <button class="tab-btn${g === 'ALL' ? ' active' : ''}" data-g="${escH(g)}">
      ${g === 'ALL' ? '🌐 All' : '⚽ ' + escH(g)}
    </button>`).join('');

  tabs.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      activeTab = btn.dataset.g;
      tabs.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      filterAndRender();
    });
  });
}

// ── FILTER & RENDER ─────────────────────────────────────────────────
function filterAndRender() {
  const q = (document.getElementById('searchInput').value || '').toLowerCase();
  filtered = allCh.filter(c => {
    const grpOk = activeTab === 'ALL' || c.group === activeTab;
    const srchOk = !q || c.name.toLowerCase().includes(q) || c.group.toLowerCase().includes(q);
    return grpOk && srchOk;
  });
  document.getElementById('chCount').textContent = filtered.length;
  renderGrid();
}

function renderGrid() {
  const grid = document.getElementById('chGrid');
  grid.innerHTML = filtered.map((ch, i) => `
    <div class="ch-card${activeCh === ch.url ? ' playing' : ''}"
         data-idx="${i}" onclick="playChannel(${i})">
      <div class="ch-logo">
        ${ch.logo
          ? `<img src="${escH(ch.logo)}" alt="" loading="lazy" onerror="this.parentNode.innerHTML='⚽'">`
          : '⚽'}
      </div>
      <div class="ch-info">
        <div class="ch-name">${escH(ch.name)}</div>
        <div class="ch-group">${escH(ch.group)}</div>
      </div>
      <div class="ch-play-icon">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>
      </div>
    </div>`).join('');
}

// ── PLAY CHANNEL ─────────────────────────────────────────────────────
function playChannel(idx) {
  const ch = filtered[idx];
  if (!ch) return;
  activeCh = ch.url;

  // Update UI
  document.getElementById('urlInput').value = ch.url;
  document.getElementById('npName').textContent = ch.name;
  document.getElementById('npGroup').textContent = ch.group;
  document.getElementById('nowPlaying').style.display = 'flex';
  document.getElementById('liveBadge').style.display = 'flex';
  renderGrid();

  // Switch to watch view
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
  document.querySelector('.nav-btn[data-tab="watch"]').classList.add('active');
  showWatchView();

  // Scroll to top
  document.querySelector('.main').scrollTo({ top: 0, behavior: 'smooth' });

  startStream(ch.url);
}

// ── PLAY BUTTON (manual URL) ─────────────────────────────────────────
document.getElementById('playBtn').addEventListener('click', () => {
  const url = document.getElementById('urlInput').value.trim();
  if (!url) return;
  document.getElementById('npName').textContent = 'Custom Stream';
  document.getElementById('npGroup').textContent = url;
  document.getElementById('nowPlaying').style.display = 'flex';
  document.getElementById('liveBadge').style.display = 'flex';
  activeCh = url;
  startStream(url);
});

document.getElementById('urlInput').addEventListener('keydown', e => {
  if (e.key === 'Enter') document.getElementById('playBtn').click();
});

// ── STREAM ENGINE ────────────────────────────────────────────────────
function startStream(url) {
  document.getElementById('vIdle').style.display = 'none';
  document.getElementById('vError').classList.remove('on');
  document.getElementById('vSpinner').classList.add('on');
  document.getElementById('resSel').style.display = 'none';

  if (hlsInst) { hlsInst.destroy(); hlsInst = null; }
  const vid = document.getElementById('vid');
  vid.src = '';

  const isHLS = /\.m3u8|\/hls|\/live|\/stream|chunklist|playlist/i.test(url);

  if (isHLS && Hls.isSupported()) {
    hlsInst = new Hls({ enableWorker: true, lowLatencyMode: true, maxBufferLength: 30 });
    hlsInst.loadSource(url);
    hlsInst.attachMedia(vid);
    hlsInst.on(Hls.Events.MANIFEST_PARSED, (_, data) => {
      document.getElementById('vSpinner').classList.remove('on');
      buildResMenu(data.levels || []);
      vid.play().catch(() => {});
    });
    hlsInst.on(Hls.Events.ERROR, (_, d) => {
      if (d.fatal) {
        document.getElementById('vSpinner').classList.remove('on');
        document.getElementById('vError').classList.add('on');
      }
    });
  } else if (vid.canPlayType('application/vnd.apple.mpegurl')) {
    vid.src = url;
    vid.oncanplay = () => document.getElementById('vSpinner').classList.remove('on');
    vid.onerror   = () => {
      document.getElementById('vSpinner').classList.remove('on');
      document.getElementById('vError').classList.add('on');
    };
    vid.play().catch(() => {});
  } else {
    vid.src = url;
    vid.oncanplay = () => document.getElementById('vSpinner').classList.remove('on');
    vid.onerror   = () => {
      document.getElementById('vSpinner').classList.remove('on');
      document.getElementById('vError').classList.add('on');
    };
    vid.play().catch(() => {});
  }
}

// ── RESOLUTION ───────────────────────────────────────────────────────
function buildResMenu(levels) {
  const sel = document.getElementById('resSel');
  sel.innerHTML = '<option value="-1">🔄 Auto</option>';
  levels.forEach((lv, i) => {
    const label = lv.height ? lv.height + 'p' : 'Level ' + i;
    const opt = document.createElement('option');
    opt.value = i; opt.textContent = label;
    sel.appendChild(opt);
  });
  sel.style.display = levels.length > 1 ? '' : 'none';
  sel.value = '-1';
}

function changeRes(val) {
  if (hlsInst) hlsInst.currentLevel = parseInt(val);
}

// ── SEARCH ────────────────────────────────────────────────────────────
document.getElementById('searchBtn').addEventListener('click', () => {
  const bar = document.getElementById('searchBar');
  const btn = document.getElementById('searchBtn');
  const isVisible = bar.style.display !== 'none';
  bar.style.display = isVisible ? 'none' : 'flex';
  btn.classList.toggle('active', !isVisible);
  if (!isVisible) document.getElementById('searchInput').focus();
});

document.getElementById('searchClose').addEventListener('click', () => {
  document.getElementById('searchBar').style.display = 'none';
  document.getElementById('searchBtn').classList.remove('active');
  document.getElementById('searchInput').value = '';
  filterAndRender();
});

document.getElementById('searchInput').addEventListener('input', () => {
  filterAndRender();
  if (allCh.length) {
    document.getElementById('channelsSection').style.display = '';
    document.getElementById('emptyState').style.display = 'none';
  }
});

// ── UPLOAD BUTTONS ────────────────────────────────────────────────────
document.getElementById('uploadBtn').addEventListener('click', showUploadSheet);
document.getElementById('vLoadBtn').addEventListener('click', showUploadSheet);
document.getElementById('emptyBtn').addEventListener('click', showUploadSheet);
document.getElementById('emptyState').style.display = '';

function showToast(msg) {
  let t = document.getElementById('toast');
  if (!t) {
    t = document.createElement('div');
    t.id = 'toast';
    t.style.cssText = 'position:fixed;bottom:80px;left:50%;transform:translateX(-50%);background:rgba(20,20,40,0.95);border:1px solid rgba(255,255,255,0.1);color:#f4f4ff;font-family:Outfit,sans-serif;font-size:13px;padding:10px 20px;border-radius:20px;z-index:700;white-space:nowrap;transition:opacity 0.4s;';
    document.body.appendChild(t);
  }
  t.textContent = msg;
  t.style.opacity = '1';
  setTimeout(() => { t.style.opacity = '0'; }, 3000);
}

// ── HELPER ────────────────────────────────────────────────────────────
function escH(s) {
  return String(s || '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
