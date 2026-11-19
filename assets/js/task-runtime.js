/* Task runtime — runs one practical task as a standalone page.

   - Provides window.App (h, esc, toast, modal, confirmBox) that the task engines expect.
   - Builds an in-memory `ctx` for the game: nothing is stored between page loads,
     so a refresh always starts the task from scratch.
   - Asks for confirmation before the tab is closed or the page is left while the task
     is not finished.
   - When the game calls ctx.finish(score, details), shows the result of this task.

   Usage on a task page (after data/catalog.js and the engine scripts):
     TaskRuntime.start({ id: 'illustrator-01', game: 'zoom-sort', data: {...} });
*/
(function () {
  'use strict';

  /* ---------- small DOM helpers (same contract as the lesson platform) ---------- */
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }
  function h(tag, attrs, ...children) {
    const e = document.createElement(tag);
    if (attrs) for (const k of Object.keys(attrs)) {
      const v = attrs[k];
      if (k === 'class') e.className = v;
      else if (k === 'html') e.innerHTML = v;
      else if (k === 'text') e.textContent = v;
      else if (k === 'style') e.style.cssText = v;
      else if (k.startsWith('on') && typeof v === 'function') e.addEventListener(k.slice(2), v);
      else if (v === true) e.setAttribute(k, '');
      else if (v !== false && v != null) e.setAttribute(k, v);
    }
    for (const c of children.flat(Infinity)) {
      if (c == null || c === false) continue;
      e.appendChild(typeof c === 'string' || typeof c === 'number' ? document.createTextNode(String(c)) : c);
    }
    return e;
  }
  function toast(msg, kind, ms) {
    let box = document.getElementById('toasts');
    if (!box) { box = h('div', { id: 'toasts', role: 'status', 'aria-live': 'polite' }); document.body.appendChild(box); }
    const t = h('div', { class: 'toast' + (kind ? ' ' + kind : ''), text: msg });
    box.appendChild(t);
    setTimeout(() => { t.style.opacity = '0'; t.style.transition = 'opacity .3s'; setTimeout(() => t.remove(), 320); }, ms || 3500);
  }
  function modal(opts) {
    const back = h('div', { class: 'mdl-back' });
    const box = h('div', { class: 'mdl' + (opts.wide ? ' wide' : ''), role: 'dialog', 'aria-modal': 'true', 'aria-label': opts.title || '' });
    const close = () => { back.remove(); document.removeEventListener('keydown', onKey, true); opts.onClose && opts.onClose(); };
    const onKey = e => { if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); close(); } };
    box.append(h('div', { class: 'mdl-h' }, h('b', { text: opts.title || '' }), h('button', { class: 'mdl-x', title: 'Закрити', 'aria-label': 'Закрити', onclick: close }, '✕')));
    const body = h('div', { class: 'mdl-b' });
    if (opts.body) body.appendChild(opts.body);
    box.appendChild(body);
    back.appendChild(box);
    back.addEventListener('pointerdown', e => { if (e.target === back) close(); });
    document.addEventListener('keydown', onKey, true);
    document.body.appendChild(back);
    return { close, body, box };
  }
  function confirmBox(o) {
    return new Promise(resolve => {
      let done = false;
      const finish = v => { if (done) return; done = true; m.close(); resolve(v); };
      const content = h('div', null, h('div', { class: 'cf-text', html: o.html || '' }),
        h('div', { class: 'row', style: 'justify-content:flex-end;margin-top:16px' },
          h('button', { class: 'btn', onclick: () => finish(false) }, o.cancel || 'Скасувати'),
          h('button', { class: 'btn ' + (o.danger ? 'warn' : 'primary'), onclick: () => finish(true) }, o.ok || 'Так')));
      const m = modal({ title: o.title, body: content, onClose: () => { if (!done) { done = true; resolve(false); } } });
      setTimeout(() => { const b = content.querySelector('.btn'); if (b) b.focus(); }, 30);
    });
  }
  window.App = Object.assign(window.App || {}, { esc, h, toast, modal, confirmBox });

  /* ---------- helpers ---------- */
  const catalog = () => window.CATALOG || { folders: [], tags: {}, items: [] };
  const rootUrl = () => {
    const s = document.querySelector('script[src*="task-runtime.js"]');
    return s ? new URL('../../', s.src).href : new URL('./', location.href).href;
  };
  const fmtTime = ms => {
    const s = Math.max(0, Math.round(ms / 1000)), m = Math.floor(s / 60);
    return m ? `${m} хв ${String(s % 60).padStart(2, '0')} с` : `${s} с`;
  };
  function verdict(score) {
    if (score >= 90) return ['great', 'Відмінно!', 'Завдання виконано майже бездоганно.'];
    if (score >= 70) return ['good', 'Добре!', 'Більшість пунктів виконано. Подивись, що ще можна покращити.'];
    if (score >= 40) return ['mid', 'Непогано', 'Частину завдання виконано. Спробуй ще раз — вийде краще.'];
    return ['low', 'Варто спробувати ще раз', 'Перечитай підказки й пройди завдання знову.'];
  }

  /* ---------- page header from the catalog ---------- */
  function renderHeader(item, folder, siblings) {
    const root = rootUrl();
    const tagNames = catalog().tags || {};
    const idx = siblings.findIndex(x => x.id === item.id);
    const head = document.getElementById('task-head');
    if (!head) return;
    head.textContent = '';
    head.append(
      h('nav', { class: 'crumbs', 'aria-label': 'Навігація' },
        h('a', { href: root + 'index.html' }, 'Каталог'), ' / ',
        h('a', { href: root + 'index.html?folder=' + encodeURIComponent(folder.id) }, folder.title), ' / ',
        h('span', { text: 'Завдання ' + item.order })),
      h('h1', { text: item.title }),
      h('p', { class: 'task-summary', html: item.summary || '' }),
      h('div', { class: 'task-meta' },
        h('span', { class: 'lvl-badge lvl-' + item.level, text: ['', 'Початковий рівень', 'Середній рівень', 'Складний рівень'][item.level] || '' }),
        item.duration ? h('span', { class: 'meta-chip', text: '⏱ ' + item.duration }) : null,
        h('span', { class: 'meta-chip', text: item.needs === 'illustrator' ? '🖥 Потрібен Adobe Illustrator' : '🌐 Виконується в браузері' }),
        (item.tags || []).map(t => h('a', { class: 'tag', href: root + 'index.html?folder=' + encodeURIComponent(folder.id) + '&tags=' + encodeURIComponent(t), text: '#' + (tagNames[t] || t) }))),
      ...(item.note ? [h('p', { class: 'task-note', html: item.note })] : []));
    document.title = item.title + ' — ' + folder.title;
    const nav = document.getElementById('task-nav');
    if (nav) {
      nav.textContent = '';
      const prev = siblings[idx - 1], next = siblings[idx + 1];
      nav.append(
        prev ? h('a', { class: 'btn small', href: root + prev.file }, '← ' + prev.order + '. ' + prev.title) : h('span'),
        next ? h('a', { class: 'btn small', href: root + next.file }, next.order + '. ' + next.title + ' →') : h('span'));
    }
  }

  /* ---------- result panel ---------- */
  function renderResult(state, entry) {
    const box = document.getElementById('task-result');
    if (!box) return;
    const score = Math.max(0, Math.min(100, Math.round(Number(entry.score) || 0)));
    const [cls, title, text] = verdict(score);
    const root = rootUrl();
    const next = state.siblings[state.siblings.findIndex(x => x.id === state.item.id) + 1];
    const summary = h('div', { class: 'res-summary' });
    const sumFn = (TaskRuntime.summaries[state.cfg.summary || state.cfg.game]);
    if (typeof sumFn === 'function') {
      try { const node = sumFn(entry.details || {}, state.ctx, state.cfg); if (node) summary.append(node); }
      catch (e) { /* the score is still shown */ }
    }
    box.textContent = '';
    box.className = 'task-result card res-' + cls;
    box.hidden = false;
    box.append(
      h('div', { class: 'res-top' },
        h('div', { class: 'res-ring', style: '--p:' + score, role: 'img', 'aria-label': 'Результат ' + score + '%' }, h('b', { text: score + '%' })),
        h('div', { class: 'res-text' },
          h('div', { class: 'res-kicker', text: 'Результат завдання' }),
          h('h2', { text: title }),
          h('p', { text: text }),
          h('p', { class: 'muted' },
            h('span', { text: state.item.title }), ' · ',
            h('span', { text: 'час: ' + fmtTime(Date.now() - state.startedAt) }), ' · ',
            h('span', { text: new Date().toLocaleString('uk-UA', { dateStyle: 'medium', timeStyle: 'short' }) })))),
      summary,
      h('div', { class: 'row res-actions' },
        h('button', { class: 'btn', type: 'button', onclick: () => location.reload() }, '⟲ Пройти ще раз'),
        h('button', { class: 'btn', type: 'button', onclick: () => window.print() }, '🖨 Роздрукувати результат'),
        h('span', { class: 'spacer' }),
        h('a', { class: 'btn', href: root + 'index.html?folder=' + encodeURIComponent(state.folder.id) }, 'До каталогу'),
        next ? h('a', { class: 'btn primary', href: root + next.file }, 'Наступне завдання →') : null));
    requestAnimationFrame(() => box.scrollIntoView({ behavior: 'smooth', block: 'start' }));
  }

  /* ---------- start ---------- */
  function start(cfg) {
    const cat = catalog();
    const item = (cat.items || []).find(x => x.id === cfg.id) || { id: cfg.id, title: document.title, order: 1, tags: [] };
    const folder = (cat.folders || []).find(f => f.id === item.folder) || { id: item.folder || '', title: '' };
    const siblings = (cat.items || []).filter(x => x.folder === item.folder).sort((a, b) => a.order - b.order);
    renderHeader(item, folder, siblings);

    const host = document.getElementById('task-game');
    const game = window.Games && window.Games[cfg.game];
    if (!host || !game) {
      if (host) host.append(h('p', { class: 'err', text: 'Не вдалося завантажити завдання. Онови сторінку.' }));
      return;
    }

    const state = { cfg, item, folder, siblings, finished: false, startedAt: Date.now(), ctx: null };

    /* leave-page protection: active until the task is finished */
    const onBeforeUnload = e => {
      if (state.finished) return undefined;
      e.preventDefault();
      e.returnValue = '';
      return '';
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    /* a page restored from the back/forward cache would keep old progress: start fresh */
    window.addEventListener('pageshow', e => { if (e.persisted) location.reload(); });

    const assetBase = new URL('./', location.href).href;
    let saved = null;
    const ctx = {
      task: { id: cfg.taskId || cfg.game, game: cfg.game, title: item.title, desc: item.summary, data: cfg.data || {}, wide: !!cfg.wide, manual: false },
      sec: { id: item.folder || 'sec', num: 1, title: folder.title, intro: '', practice: [] },
      student: null,
      saved: null,
      readOnly: false,
      asset: p => new URL(String(p || '').replace(/^\/+/, ''), assetBase).href,
      complete(score, details) {
        saved = { score: Number(score) || 0, details: details || {}, at: new Date().toISOString(), final: false, returnCount: 0 };
        return Promise.resolve(saved);
      },
      finish(score, details) {
        saved = { score: Number(score) || 0, details: details || {}, at: new Date().toISOString(), final: true, returnCount: 0 };
        state.finished = true;
        renderResult(state, saved);
        return Promise.resolve(saved);
      },
      done(score) {
        state.finished = true;
        renderResult(state, { score, details: (saved && saved.details) || {} });
      },
      setSaved(entry) { saved = entry; },
      toast: (msg, kind) => toast(msg, kind),
      back: () => { location.href = rootUrl() + 'index.html'; }
    };
    state.ctx = ctx;
    document.body.classList.toggle('task-wide', !!cfg.wide);
    host.textContent = '';
    try { game.mount(host, ctx); }
    catch (e) {
      host.append(h('p', { class: 'err', text: 'Сталася помилка під час запуску завдання. Онови сторінку.' }));
      if (window.console) console.error(e);
    }
  }

  window.TaskRuntime = { start, summaries: {}, h, esc, fmtTime };
})();
