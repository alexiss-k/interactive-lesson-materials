/* LessonKit 1.0 — shared helpers for Interactive Lessons games.
   Classic script: declare it FIRST in `scripts`, before any game that uses window.LessonKit.
   Not a platform API: it ships inside each lesson's assets/ and is maintained with this skill.

   House rules it implements:
   - drafts are saved with score 0; the real score is sent only by final()
   - writes are serialized, snapshotted and debounced; failures keep local work and allow retry
   - details are size-checked with PHP JSON escaping (Cyrillic = 6 bytes per character)
   - the shuffle seed is taken once (participationId when available) and must be stored in details
   - everything a mount creates is tracked and removed by one dispose() call */
(() => {
  'use strict';
  if (window.LessonKit) return;

  const DETAILS_LIMIT = 120000;      // server limit, measured as PHP json_encode bytes
  const DETAILS_SAFE = 100000;       // kit refuses to send above this, to leave headroom

  /* ---------- DOM ---------- */
  function h(tag, props, ...kids) {
    const el = document.createElement(tag);
    if (props) for (const [k, v] of Object.entries(props)) {
      if (v == null || v === false) continue;
      if (k === 'class') el.className = v;
      else if (k === 'text') el.textContent = v;
      else if (k === 'html') el.innerHTML = v;            // trusted author HTML only, never learner text
      else if (k === 'style') el.style.cssText = v;
      else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v);
      else el.setAttribute(k, v === true ? '' : String(v));
    }
    for (const c of kids.flat(Infinity)) {
      if (c == null || c === false) continue;
      el.append(c.nodeType ? c : String(c));
    }
    return el;
  }
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  /* ---------- lifecycle: one dispose() removes everything ---------- */
  function lifecycle() {
    const undo = [];
    let disposed = false;
    const life = {
      get disposed() { return disposed; },
      add(fn) { if (disposed) { try { fn(); } catch (e) {} } else undo.push(fn); return fn; },
      listen(target, type, fn, opts) {
        target.addEventListener(type, fn, opts);
        return life.add(() => target.removeEventListener(type, fn, opts));
      },
      timeout(fn, ms) {
        const id = setTimeout(() => { if (!disposed) fn(); }, ms);
        life.add(() => clearTimeout(id)); return id;
      },
      interval(fn, ms) {
        const id = setInterval(() => { if (!disposed) fn(); }, ms);
        life.add(() => clearInterval(id)); return id;
      },
      frame(fn) {
        const id = requestAnimationFrame(t => { if (!disposed) fn(t); });
        life.add(() => cancelAnimationFrame(id)); return id;
      },
      observe(observer) { life.add(() => observer.disconnect()); return observer; },
      objectUrl(blob) { const u = URL.createObjectURL(blob); life.add(() => URL.revokeObjectURL(u)); return u; },
      dispose() {
        if (disposed) return;
        disposed = true;
        while (undo.length) { try { undo.pop()(); } catch (e) { /* keep cleaning */ } }
      }
    };
    return life;
  }

  /* ---------- sizes ---------- */
  function phpJsonBytes(value) {
    return JSON.stringify(value ?? null)
      .replace(/\//g, '\\/')
      .replace(/[\u0080-￿]/g, ch => '\\u' + ch.charCodeAt(0).toString(16).padStart(4, '0'))
      .length;
  }

  /* ---------- saved state ---------- */
  const isFinal = ctx => Boolean(ctx.saved && ctx.saved.final);
  /* Editable now? readOnly is a snapshot taken at mount; finish() does not change it, so games keep their own lock too. */
  const isLocked = ctx => Boolean(ctx.readOnly || (isFinal(ctx) && !ctx.task.manual));
  /* Return detection. `ack` is the author-owned counter stored in details (not a platform field). */
  function returnInfo(ctx) {
    const s = ctx.saved;
    const count = (s && s.returnCount) || 0;
    const ack = (s && s.details && s.details.ack) || 0;
    return {
      count,                                   // total returns so far
      everReturned: Boolean(s && !s.final && count > 0),
      isNew: Boolean(s && !s.final && count > ack),   // returned since the game last acknowledged it
      ack: count                               // put this value into details.ack on every save
    };
  }

  /* ---------- seeds and shuffles ---------- */
  function hashSeed(str) {
    let h1 = 1779033703 ^ str.length;
    for (let i = 0; i < str.length; i++) { h1 = Math.imul(h1 ^ str.charCodeAt(i), 3432918353); h1 = (h1 << 13) | (h1 >>> 19); }
    return () => {
      h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507); h1 = Math.imul(h1 ^ (h1 >>> 13), 3266489909); h1 ^= h1 >>> 16;
      return (h1 >>> 0) / 4294967296;
    };
  }
  function shuffle(list, seed) {
    const rand = hashSeed(String(seed)), a = list.slice();
    for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
    return a;
  }
  /* Resolve a stable seed: saved seed → participationId → random. ALWAYS store the result in details.seed.
     Teacher review and demo have no ctx.api; they show the saved seed (or a neutral one). */
  async function seed(ctx) {
    const saved = ctx.saved && ctx.saved.details && ctx.saved.details.seed;
    if (saved) return String(saved);
    const base = (ctx.sec && ctx.sec.id || 's') + '/' + (ctx.task && ctx.task.id || 't');
    if (!ctx.readOnly && typeof ctx.api === 'function') {
      try {
        const me = await ctx.api('/api/student/me');
        if (me && me.participationId) return me.participationId + '|' + base;
      } catch (e) { /* offline or not available */ }
    }
    if (ctx.readOnly) return 'review|' + base;
    const r = (window.crypto && crypto.getRandomValues) ? crypto.getRandomValues(new Uint32Array(2)).join('-') : String(Math.random()).slice(2);
    return r + '|' + base;
  }

  /* ---------- saving ---------- */
  /* saver(ctx, { life, getDetails, onError, onSaved, delay })
     getDetails(): returns the editable model (seed, ack, answers…). It is snapshotted on every write.
     draft():          debounced write with score 0 (house rule)
     flush():          send a pending draft now
     final(score):     cancel pending draft, wait for queued writes, then ctx.finish(score, details)
     A failed final() rejects; the caller keeps the model editable and shows a retry message. */
  function saver(ctx, opts) {
    const o = Object.assign({ delay: 600 }, opts);
    let queue = Promise.resolve(), timer = null, pending = false, closed = false;
    const snapshot = () => {
      const d = JSON.parse(JSON.stringify(o.getDetails()));
      const size = phpJsonBytes(d);
      if (size > DETAILS_SAFE) {
        const err = new Error('Робота завелика для збереження (' + size + ' байт). Скороти відповідь або розбий завдання.');
        err.code = 'details_too_large'; err.size = size; throw err;
      }
      return d;
    };
    function write(final, score) {
      let details;
      try { details = snapshot(); } catch (e) { return Promise.reject(e); }
      const req = queue.then(() => final ? ctx.finish(score, details) : ctx.complete(0, details, false));
      queue = req.catch(() => {});
      return req.then(entry => { o.onSaved && o.onSaved(entry, final); return entry; });
    }
    function send() {
      pending = false; timer = null;
      if (closed || isLocked(ctx)) return Promise.resolve(null);
      return write(false).catch(e => { o.onError && o.onError(e, false); return null; });
    }
    const api = {
      get pending() { return pending; },
      draft() {
        if (closed || isLocked(ctx)) return;
        pending = true;
        clearTimeout(timer);
        timer = setTimeout(send, o.delay);
      },
      flush() { if (!pending) return queue; clearTimeout(timer); return send(); },
      cancel() { clearTimeout(timer); timer = null; pending = false; },
      async final(score) {
        api.cancel();
        const value = Math.max(0, Math.min(100, Math.round(Number(score) || 0)));
        try { return await write(true, value); }
        catch (e) { o.onError && o.onError(e, true); throw e; }
      },
      close() {                      // on unmount: flush a pending draft (best effort), then stop
        if (pending && !closed && !isLocked(ctx)) { clearTimeout(timer); send(); }
        closed = true;
      }
    };
    if (o.life) o.life.add(() => api.close());
    return api;
  }

  /* ---------- confirmation ---------- */
  function confirm(o) {
    if (window.App && typeof App.confirmBox === 'function') return App.confirmBox(o);
    return Promise.resolve(true);
  }
  function toast(ctx, msg, kind) {
    try { (ctx.toast || (window.App && App.toast) || (() => {}))(msg, kind); } catch (e) {}
  }

  /* ---------- drag with click/keyboard alternative ---------- */
  /* draggable(el, life, { enabled(), onPick(), onMove(x,y), onDrop(x,y), onCancel() })
     Pointer drag shows a ghost; a click or Enter/Space calls onPick so the learner can then
     click or press Enter on a target (implement targets with dropTarget()). */
  function draggable(el, life, o) {
    let ghost = null, start = null, dragging = false, pid = null;
    const enabled = () => !o.enabled || o.enabled();
    const clear = () => {
      if (ghost) { ghost.remove(); ghost = null; }
      document.documentElement.classList.remove('lk-dragging');
      dragging = false; start = null; pid = null;
    };
    life.add(clear);
    const move = e => {
      if (!start || e.pointerId !== pid) return;
      if (!dragging) {
        if (Math.hypot(e.clientX - start.x, e.clientY - start.y) < 5) return;
        dragging = true;
        ghost = el.cloneNode(true);
        ghost.classList.add('lk-ghost');
        ghost.setAttribute('aria-hidden', 'true');
        ghost.style.width = el.getBoundingClientRect().width + 'px';
        document.body.append(ghost);
        document.documentElement.classList.add('lk-dragging');
      }
      ghost.style.left = (e.clientX - 12) + 'px';
      ghost.style.top = (e.clientY - 14) + 'px';
      o.onMove && o.onMove(e.clientX, e.clientY);
    };
    const up = e => {
      if (!start || e.pointerId !== pid) return;
      const was = dragging, x = e.clientX, y = e.clientY;
      clear();
      if (e.type === 'pointercancel') { o.onCancel && o.onCancel(); return; }
      if (was) o.onDrop && o.onDrop(x, y); else o.onPick && o.onPick();
    };
    life.listen(el, 'pointerdown', e => {
      if (e.button !== 0 || !enabled()) return;
      e.preventDefault();
      start = { x: e.clientX, y: e.clientY }; pid = e.pointerId;
    });
    life.listen(document, 'pointermove', move);
    life.listen(document, 'pointerup', up);
    life.listen(document, 'pointercancel', up);
    el.tabIndex = 0;
    el.setAttribute('role', el.getAttribute('role') || 'button');
    life.listen(el, 'keydown', e => {
      if ((e.key === 'Enter' || e.key === ' ') && enabled()) { e.preventDefault(); o.onPick && o.onPick(); }
    });
  }
  function dropTarget(el, life, o) {
    el.tabIndex = el.tabIndex >= 0 ? el.tabIndex : 0;
    life.listen(el, 'click', e => { if (!o.enabled || o.enabled()) o.onChoose(e); });
    life.listen(el, 'keydown', e => {
      if ((e.key === 'Enter' || e.key === ' ') && e.target === el && (!o.enabled || o.enabled())) { e.preventDefault(); o.onChoose(e); }
    });
  }
  const inside = (el, x, y) => { const r = el.getBoundingClientRect(); return x >= r.left && x <= r.right && y >= r.top && y <= r.bottom; };

  /* ---------- banners ---------- */
  function banners(ctx) {
    const info = returnInfo(ctx), out = [];
    if (info.isNew && !ctx.readOnly) out.push(h('div', { class: 'lk-banner lk-returned', role: 'status' }, 'Учитель повернув роботу на доопрацювання. Виправ і здай ще раз.'));
    if (ctx.readOnly) out.push(h('div', { class: 'lk-banner lk-readonly', role: 'status' }, 'Режим перегляду. Змінювати роботу зараз не можна.'));
    return out;
  }

  window.LessonKit = {
    version: '1.0.0', DETAILS_LIMIT, DETAILS_SAFE,
    h, esc, lifecycle, phpJsonBytes, isFinal, isLocked, returnInfo,
    shuffle, seed, saver, confirm, toast, draggable, dropTarget, inside, banners
  };
})();
