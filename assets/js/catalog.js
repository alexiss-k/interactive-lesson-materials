/* Catalog page: folders, tags, level and search filters over window.CATALOG.
   Filters are kept in the URL (?folder=…&tags=a,b&level=…&needs=…&q=…) so a filtered view can be shared. */
(function () {
  'use strict';
  const CAT = window.CATALOG || { folders: [], tags: {}, items: [] };
  const $ = id => document.getElementById(id);
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const LEVELS = { 1: 'Початковий', 2: 'Середній', 3: 'Складний' };
  const NEEDS = { browser: '🌐 У браузері', illustrator: '🖥 У програмі + перевірка файлу' };

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
  function matches(it, skip) {
    if (skip !== 'folder' && state.folder && it.folder !== state.folder) return false;
    if (skip !== 'level' && state.level && String(it.level) !== state.level) return false;
    if (skip !== 'needs' && state.needs && it.needs !== state.needs) return false;
    if (skip !== 'tags' && state.tags.length && !state.tags.every(t => (it.tags || []).includes(t))) return false;
    if (state.q) {
      const hay = norm([it.title, it.summary, it.source, (it.tags || []).map(t => CAT.tags[t] || t).join(' ')].join(' '));
      if (!norm(state.q).split(/\s+/).filter(Boolean).every(w => hay.includes(w))) return false;
    }
    return true;
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

  function renderFilters() {
    const items = CAT.items || [];
    const folders = $('folders'); folders.textContent = '';
    folders.append(chip('Усі', items.filter(it => matches(it, 'folder')).length, !state.folder, () => { state.folder = ''; update(); }));
    (CAT.folders || []).forEach(f => folders.append(chip(f.title, items.filter(it => it.folder === f.id && matches(it, 'folder')).length, state.folder === f.id,
      () => { state.folder = state.folder === f.id ? '' : f.id; update(); })));

    const levels = $('levels'); levels.textContent = '';
    levels.append(chip('Будь-який', null, !state.level, () => { state.level = ''; update(); }));
    Object.keys(LEVELS).forEach(l => levels.append(chip(LEVELS[l], items.filter(it => String(it.level) === l && matches(it, 'level')).length, state.level === l,
      () => { state.level = state.level === l ? '' : l; update(); }, 'lvl-' + l)));

    const needs = $('needs'); needs.textContent = '';
    needs.append(chip('Будь-де', null, !state.needs, () => { state.needs = ''; update(); }));
    Object.keys(NEEDS).forEach(n => needs.append(chip(NEEDS[n], items.filter(it => it.needs === n && matches(it, 'needs')).length, state.needs === n,
      () => { state.needs = state.needs === n ? '' : n; update(); })));

    const tags = $('tags'); tags.textContent = '';
    const scope = items.filter(it => !state.folder || it.folder === state.folder);
    const used = Object.keys(CAT.tags || {}).filter(t => scope.some(it => (it.tags || []).includes(t)) || state.tags.includes(t));
    used.forEach(t => {
      const on = state.tags.includes(t);
      const n = items.filter(it => matches(it, 'tags') && (it.tags || []).includes(t) && state.tags.every(x => (it.tags || []).includes(x))).length;
      tags.append(chip('#' + (CAT.tags[t] || t), n, on, () => {
        state.tags = on ? state.tags.filter(x => x !== t) : state.tags.concat(t); update();
      }));
    });
  }

  function card(it) {
    const tags = (it.tags || []).map(t => `<button type="button" class="tag${state.tags.includes(t) ? ' on' : ''}" data-tag="${esc(t)}">#${esc(CAT.tags[t] || t)}</button>`).join('');
    const el = document.createElement('article');
    el.className = 'task-card-x';
    el.innerHTML = `
      <a class="tc-link" href="${esc(it.file)}">
        <span class="tc-num">${it.order}</span>
        <span class="tc-body">
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
    el.querySelectorAll('.tag').forEach(b => b.addEventListener('click', () => {
      const t = b.dataset.tag;
      state.tags = state.tags.includes(t) ? state.tags.filter(x => x !== t) : state.tags.concat(t);
      update(); window.scrollTo({ top: 0, behavior: 'smooth' });
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

  function renderResults() {
    const res = $('results'); res.textContent = '';
    const items = (CAT.items || []).filter(it => matches(it));
    $('count').textContent = items.length ? `Знайдено завдань: ${items.length}` : '';
    if (!items.length) {
      res.innerHTML = '<div class="empty card"><b>Нічого не знайдено.</b><p class="muted">Спробуй прибрати частину тегів або змінити пошук.</p></div>';
      return;
    }
    (CAT.folders || []).forEach(f => {
      const list = items.filter(it => it.folder === f.id).sort((a, b) => a.order - b.order);
      if (!list.length) return;
      const sec = document.createElement('section');
      sec.className = 'folder-sec';
      const total = (CAT.items || []).filter(it => it.folder === f.id).length;
      sec.innerHTML = `<header class="folder-h"><span class="folder-ic">${esc(f.icon || '📁')}</span><div><h2>${esc(f.title)}</h2><p class="muted">${esc(f.description || '')}</p></div><span class="folder-n">${list.length} з ${total}</span></header>`;
      const grid = document.createElement('div');
      grid.className = 'task-grid';
      list.forEach(it => grid.append(card(it)));
      sec.append(grid);
      res.append(sec);
    });
  }

  function update() { writeUrl(); renderFilters(); renderResults(); }

  readUrl();
  const q = $('q');
  q.value = state.q;
  let t = null;
  q.addEventListener('input', () => { clearTimeout(t); t = setTimeout(() => { state.q = q.value.trim(); update(); }, 150); });
  $('reset').addEventListener('click', () => { Object.assign(state, { folder: '', tags: [], level: '', needs: '', q: '' }); q.value = ''; update(); });
  update();
})();
