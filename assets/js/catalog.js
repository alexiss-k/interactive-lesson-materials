/* Catalog page over window.CATALOG.
   - index.html            → the list of folders (plus a search across all folders)
   - index.html?folder=id  → one folder: its tasks with level, location, tag and search filters
   Folder filters are kept in the URL (?folder=…&tags=a,b&level=…&needs=…&q=…) so a view can be shared. */
(function () {
  'use strict';
  const CAT = window.CATALOG || { folders: [], tags: {}, items: [] };
  const ITEMS = CAT.items || [];
  const FOLDERS = CAT.folders || [];
  const $ = id => document.getElementById(id);
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const LEVELS = { 1: 'Початковий', 2: 'Середній', 3: 'Складний' };
  const NEEDS = { browser: '🌐 У браузері', illustrator: '🖥 У програмі + перевірка файлу' };
  const folderUrl = id => 'index.html?folder=' + encodeURIComponent(id);
  const plural = (n, one, few, many) => {
    const m10 = n % 10, m100 = n % 100;
    return m10 === 1 && m100 !== 11 ? one : m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14) ? few : many;
  };
  const tasksWord = n => n + ' ' + plural(n, 'завдання', 'завдання', 'завдань');

  const state = { folder: '', tags: [], level: '', needs: '', q: '' };

  function readUrl() {
    const p = new URLSearchParams(location.search);
    state.folder = p.get('folder') || '';
    state.tags = (p.get('tags') || '').split(',').map(s => s.trim()).filter(Boolean);
    state.level = p.get('level') || '';
    state.needs = p.get('needs') || '';
    state.q = p.get('q') || '';
  }
  function writeUrl() {
    const p = new URLSearchParams();
    if (state.folder) p.set('folder', state.folder);
    if (state.tags.length) p.set('tags', state.tags.join(','));
    if (state.level) p.set('level', state.level);
    if (state.needs) p.set('needs', state.needs);
    if (state.q) p.set('q', state.q);
    const qs = p.toString();
    history.replaceState(null, '', location.pathname + (qs ? '?' + qs : ''));
  }

  const norm = s => String(s || '').toLowerCase().replace(/[’'`]/g, '');
  function textMatch(it, q) {
    if (!q) return true;
    const hay = norm([it.title, it.summary, it.source, (it.tags || []).map(t => CAT.tags[t] || t).join(' ')].join(' '));
    return norm(q).split(/\s+/).filter(Boolean).every(w => hay.includes(w));
  }
  function matches(it, skip) {
    if (state.folder && it.folder !== state.folder) return false;
    if (skip !== 'level' && state.level && String(it.level) !== state.level) return false;
    if (skip !== 'needs' && state.needs && it.needs !== state.needs) return false;
    if (skip !== 'tags' && state.tags.length && !state.tags.every(t => (it.tags || []).includes(t))) return false;
    return textMatch(it, state.q);
  }

  function chip(label, count, on, onClick, extraClass) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'chip-btn' + (on ? ' on' : '') + (extraClass ? ' ' + extraClass : '');
    b.setAttribute('aria-pressed', String(on));
    b.innerHTML = esc(label) + (count != null ? ` <span class="n">${count}</span>` : '');
    b.disabled = !on && count === 0;
    b.addEventListener('click', onClick);
    return b;
  }

  /* ---------- task card (folder view and home search) ---------- */
  function card(it, opts) {
    const o = opts || {};
    const tags = (it.tags || []).map(t => o.tagsAsLinks
      ? `<a class="tag" href="${folderUrl(it.folder)}&tags=${encodeURIComponent(t)}">#${esc(CAT.tags[t] || t)}</a>`
      : `<button type="button" class="tag${state.tags.includes(t) ? ' on' : ''}" data-tag="${esc(t)}">#${esc(CAT.tags[t] || t)}</button>`).join('');
    const folder = FOLDERS.find(f => f.id === it.folder);
    const el = document.createElement('article');
    el.className = 'task-card-x';
    el.innerHTML = `
      <a class="tc-link" href="${esc(it.file)}">
        <span class="tc-num">${it.order}</span>
        <span class="tc-body">
          ${o.showFolder && folder ? `<span class="tc-folder">${esc(folder.title)}</span>` : ''}
          <span class="tc-title">${esc(it.title)}</span>
          <span class="tc-sum">${it.summary || ''}</span>
        </span>
      </a>
      <div class="tc-meta">
        <span class="lvl-badge lvl-${it.level}">${esc(LEVELS[it.level] || '')}</span>
        ${it.duration ? `<span class="meta-chip">⏱ ${esc(it.duration)}</span>` : ''}
        <span class="meta-chip">${it.needs === 'illustrator' ? '🖥 Потрібна програма' : '🌐 У браузері'}</span>
        ${tags}
        <button type="button" class="btn small ghost tc-share" title="Скопіювати посилання на завдання">🔗 Посилання</button>
      </div>
      ${it.source ? `<div class="tc-src muted">Джерело: ${esc(it.source)}</div>` : ''}`;
    el.querySelectorAll('button.tag').forEach(b => b.addEventListener('click', () => {
      const t = b.dataset.tag;
      state.tags = state.tags.includes(t) ? state.tags.filter(x => x !== t) : state.tags.concat(t);
      updateFolder(); window.scrollTo({ top: 0, behavior: 'smooth' });
    }));
    el.querySelector('.tc-share').addEventListener('click', async e => {
      const url = new URL(it.file, location.href).href;
      const btn = e.currentTarget;
      try { await navigator.clipboard.writeText(url); btn.textContent = '✓ Скопійовано'; }
      catch (err) { window.prompt('Посилання на завдання:', url); }
      setTimeout(() => { btn.textContent = '🔗 Посилання'; }, 1800);
    });
    return el;
  }

  /* ---------- home: folders only ---------- */
  function folderCard(f) {
    const list = ITEMS.filter(it => it.folder === f.id);
    const counts = {};
    list.forEach(it => (it.tags || []).forEach(t => { counts[t] = (counts[t] || 0) + 1; }));
    const topTags = Object.keys(counts).sort((a, b) => counts[b] - counts[a]).slice(0, 6);
    const lv = Object.keys(LEVELS).map(l => [l, list.filter(it => String(it.level) === l).length]).filter(x => x[1]);
    const el = document.createElement('a');
    el.className = 'folder-card';
    el.href = folderUrl(f.id);
    el.innerHTML = `
      <span class="fc-top">
        <span class="folder-ic">${esc(f.icon || '📁')}</span>
        <span class="fc-name"><b>${esc(f.title)}</b><span class="muted">${tasksWord(list.length)}</span></span>
      </span>
      <span class="fc-desc">${esc(f.description || '')}</span>
      <span class="fc-levels">${lv.map(([l, n]) => `<span class="lvl-badge lvl-${l}">${esc(LEVELS[l])}: ${n}</span>`).join('')}</span>
      <span class="fc-tags">${topTags.map(t => `<span class="meta-chip">#${esc(CAT.tags[t] || t)}</span>`).join('')}</span>
      <span class="fc-open">Відкрити папку →</span>`;
    return el;
  }
  function renderHome() {
    document.title = 'Інтерактивні уроки';
    const grid = $('folder-grid');
    const q = state.q;
    const res = $('home-results');
    grid.textContent = ''; res.textContent = '';
    if (!q) {
      grid.hidden = false;
      FOLDERS.forEach(f => grid.append(folderCard(f)));
      $('home-count').textContent = '';
      return;
    }
    grid.hidden = true;
    const found = ITEMS.filter(it => textMatch(it, q));
    $('home-count').textContent = found.length ? `Знайдено: ${tasksWord(found.length)}` : '';
    if (!found.length) {
      res.innerHTML = '<div class="empty card"><b>Нічого не знайдено.</b><p class="muted">Спробуй інше слово або відкрий папку.</p></div>';
      return;
    }
    FOLDERS.forEach(f => {
      const list = found.filter(it => it.folder === f.id).sort((a, b) => a.order - b.order);
      if (!list.length) return;
      const sec = document.createElement('section');
      sec.className = 'folder-sec';
      sec.innerHTML = `<h2 class="fs-h"><a href="${folderUrl(f.id)}">${esc(f.title)}</a> <span class="muted">${list.length}</span></h2>`;
      const g = document.createElement('div');
      g.className = 'task-grid';
      list.forEach(it => g.append(card(it, { tagsAsLinks: true })));
      sec.append(g);
      res.append(sec);
    });
  }

  /* ---------- one folder ---------- */
  function renderFolderHead(f) {
    const total = ITEMS.filter(it => it.folder === f.id).length;
    $('folder-head').innerHTML = `<span class="folder-ic">${esc(f.icon || '📁')}</span><div><h1>${esc(f.title)}</h1><p class="muted">${esc(f.description || '')}</p></div><span class="folder-n">${tasksWord(total)}</span>`;
    document.title = f.title + ' — Інтерактивні уроки';
  }
  function renderFilters() {
    const scope = ITEMS.filter(it => it.folder === state.folder);
    const levels = $('levels'); levels.textContent = '';
    levels.append(chip('Будь-який', null, !state.level, () => { state.level = ''; updateFolder(); }));
    Object.keys(LEVELS).forEach(l => {
      if (!scope.some(it => String(it.level) === l)) return;
      levels.append(chip(LEVELS[l], scope.filter(it => String(it.level) === l && matches(it, 'level')).length, state.level === l,
        () => { state.level = state.level === l ? '' : l; updateFolder(); }, 'lvl-' + l));
    });

    const needs = $('needs'); needs.textContent = '';
    const needKinds = Object.keys(NEEDS).filter(n => scope.some(it => it.needs === n));
    needs.closest('.f-group').hidden = needKinds.length < 2;
    needs.append(chip('Будь-де', null, !state.needs, () => { state.needs = ''; updateFolder(); }));
    needKinds.forEach(n => needs.append(chip(NEEDS[n], scope.filter(it => it.needs === n && matches(it, 'needs')).length, state.needs === n,
      () => { state.needs = state.needs === n ? '' : n; updateFolder(); })));

    const tags = $('tags'); tags.textContent = '';
    const used = Object.keys(CAT.tags || {}).filter(t => scope.some(it => (it.tags || []).includes(t)) || state.tags.includes(t));
    used.forEach(t => {
      const on = state.tags.includes(t);
      const n = scope.filter(it => matches(it, 'tags') && (it.tags || []).includes(t) && state.tags.every(x => (it.tags || []).includes(x))).length;
      tags.append(chip('#' + (CAT.tags[t] || t), n, on, () => {
        state.tags = on ? state.tags.filter(x => x !== t) : state.tags.concat(t); updateFolder();
      }));
    });
  }
  function renderResults() {
    const res = $('results'); res.textContent = '';
    const items = ITEMS.filter(it => matches(it)).sort((a, b) => a.order - b.order);
    const total = ITEMS.filter(it => it.folder === state.folder).length;
    $('count').textContent = items.length === total ? `Усього: ${tasksWord(total)}` : `Знайдено: ${items.length} з ${total}`;
    if (!items.length) {
      res.innerHTML = '<div class="empty card"><b>Нічого не знайдено.</b><p class="muted">Спробуй прибрати частину тегів або змінити пошук.</p></div>';
      return;
    }
    items.forEach(it => res.append(card(it)));
  }
  function updateFolder() { writeUrl(); renderFilters(); renderResults(); }

  /* ---------- start ---------- */
  readUrl();
  if (!state.folder) {
    $('home').hidden = false;
    const hq = $('hq');
    hq.value = state.q;
    let t = null;
    hq.addEventListener('input', () => { clearTimeout(t); t = setTimeout(() => { state.q = hq.value.trim(); writeUrl(); renderHome(); }, 150); });
    renderHome();
    return;
  }
  const folder = FOLDERS.find(f => f.id === state.folder);
  if (!folder) { $('not-found').hidden = false; return; }
  $('folder-view').hidden = false;
  renderFolderHead(folder);
  const q = $('q');
  q.value = state.q;
  let t = null;
  q.addEventListener('input', () => { clearTimeout(t); t = setTimeout(() => { state.q = q.value.trim(); updateFolder(); }, 150); });
  $('reset').addEventListener('click', () => { Object.assign(state, { tags: [], level: '', needs: '', q: '' }); q.value = ''; updateFolder(); });
  updateFolder();
})();
