/* Розділ «Вектор і растр»: 'zoom-sort' (збільш і визнач) і 'vector-numbers' (малюємо числами).
   Content from lesson 1, rewritten on LessonKit: drafts score 0, final on «Завершити», returnable, self-locking.
   Needs kit/lesson-kit.js. Classic script. */
(() => {
  'use strict';
  const K = window.LessonKit;
  const O = '#FF7A00';
  window.Games = window.Games || {};

  /* ================= 1. Збільш і визнач ================= */
  const ZOOM_ITEMS = [
    { id: 'star', fx: 49, fy: 47, type: 'vector', label: 'Емблема-зірка',
      svg: `<circle cx="60" cy="60" r="52" fill="#1E1B18"/><path d="M60 18 L71 47 L102 48 L78 67 L86 98 L60 80 L34 98 L42 67 L18 48 L49 47 Z" fill="${O}"/>` },
    { id: 'heart', fx: 38, fy: 28, type: 'raster', label: 'Іконка «серце»',
      svg: `<rect width="120" height="120" rx="26" fill="#FDE2E4"/><path d="M60 96 C60 96 22 72 22 46 C22 32 33 24 44 24 C52 24 57 29 60 35 C63 29 68 24 76 24 C87 24 98 32 98 46 C98 72 60 96 60 96 Z" fill="#E5383B"/>` },
    { id: 'ai', fx: 44, fy: 58, type: 'vector', label: 'Напис «Ai»',
      svg: `<rect x="10" y="10" width="100" height="100" rx="20" fill="#330000" stroke="${O}" stroke-width="5"/><text x="60" y="78" text-anchor="middle" font-family="Arial" font-weight="700" font-size="52" fill="${O}">Ai</text>` },
    { id: 'photo', fx: 60, fy: 58, type: 'raster', label: 'Фото заходу сонця', photo: true,
      svg: `<defs><linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2B2D6E"/><stop offset=".55" stop-color="#F77F00"/><stop offset="1" stop-color="#FCBF49"/></linearGradient></defs><rect width="120" height="120" fill="url(#sky)"/><circle cx="60" cy="78" r="20" fill="#FFE8A3"/><path d="M0 90 Q30 80 60 92 T120 88 V120 H0Z" fill="#14213D"/>` },
    { id: 'target', fx: 60, fy: 17, type: 'raster', label: 'Мішень',
      svg: `<circle cx="60" cy="60" r="54" fill="#fff"/><circle cx="60" cy="60" r="44" fill="#2F7DF6"/><circle cx="60" cy="60" r="32" fill="#fff"/><circle cx="60" cy="60" r="20" fill="#2F7DF6"/><circle cx="60" cy="60" r="8" fill="#E5383B"/>` },
    { id: 'leaf', fx: 46, fy: 56, type: 'vector', label: 'Листок',
      svg: `<path d="M18 102 C18 102 30 30 104 16 C104 16 96 92 18 102 Z" fill="#3BB273"/><path d="M18 102 C44 76 66 52 90 32" stroke="#1E7A48" stroke-width="4" fill="none" stroke-linecap="round"/>` },
    { id: 'pin', fx: 74, fy: 36, type: 'raster', label: 'Мітка на карті',
      svg: `<path d="M60 112 C60 112 24 70 24 46 C24 26 40 12 60 12 C80 12 96 26 96 46 C96 70 60 112 60 112 Z" fill="${O}"/><circle cx="60" cy="46" r="14" fill="#fff"/>` },
    { id: 'wave', fx: 40, fy: 50, type: 'vector', label: 'Лого-хвилі',
      svg: `<rect width="120" height="120" rx="60" fill="#E8F1FF"/><path d="M14 52 C34 32 46 72 66 52 S 96 32 106 52" stroke="#2F7DF6" stroke-width="7" fill="none" stroke-linecap="round"/><path d="M14 74 C34 54 46 94 66 74 S 96 54 106 74" stroke="#1E1B18" stroke-width="4" fill="none" stroke-linecap="round"/>` }
  ];
  const TYPE_UA = { vector: 'вектор', raster: 'растр' };

  /* a raster copy is a tiny 120 px canvas; scaled up it shows its pixels */
  function rasterize(item, size, life, done) {
    const c = document.createElement('canvas');
    c.width = size; c.height = size;
    const img = new Image();
    img.onload = () => {
      if (life.disposed) return;
      const g = c.getContext('2d');
      g.drawImage(img, 0, 0, size, size);
      if (item.photo) {   // фото має «шум»
        const d = g.getImageData(0, 0, size, size);
        let s = 12345;
        for (let i = 0; i < d.data.length; i += 4) { s = (s * 1103515245 + 12345) & 0x7fffffff; const n = (s / 0x7fffffff - 0.5) * 26; d.data[i] += n; d.data[i + 1] += n; d.data[i + 2] += n; }
        g.putImageData(d, 0, 0);
      }
      done(c);
    };
    img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120" width="${size}" height="${size}">${item.svg}</svg>`);
  }

  window.Games['zoom-sort'] = {
    readonlyView: true,
    mount(host, ctx) {
      const life = K.lifecycle(), h = K.h;
      const d0 = (ctx.saved && ctx.saved.details) || {};
      const ret = K.returnInfo(ctx);
      let answers = Object.assign({}, d0.answers || {});
      let seed = d0.seed || null;
      let locked = K.isLocked(ctx), busy = false;
      let submittedNow = false;
      const showResult = () => locked && (submittedNow || !!(ctx.saved && ctx.saved.final));

      const status = h('p', { class: 'vr-status', role: 'status', 'aria-live': 'polite' });
      const save = K.saver(ctx, {
        life, getDetails: () => ({ answers, seed, ack: ret.ack }),
        onError: (e, final) => { if (!life.disposed && !final) status.textContent = 'Чернетку не збережено. Відповіді залишаються на екрані.'; }
      });
      const slider = h('input', { type: 'range', min: 1, max: 10, step: 0.5, value: 1, class: 'vr-range', 'aria-label': 'Збільшення', 'data-readonly-ok': '' });
      const zlabel = h('b', { text: '100%' });
      const grid = h('div', { class: 'vr-zgrid' });
      const submit = h('button', { type: 'button', class: 'btn primary' }, 'Завершити й перевірити');
      const summary = h('div', { class: 'vr-result' });
      const root = h('div', { class: 'vr vr-zoom' }, ...K.banners(ctx),
        h('p', { class: 'vr-lead', html: 'Збільшуй зображення повзунком. <b>Векторні</b> залишаються чіткими, а <b>растрові</b> розпадаються на пікселі. Познач тип кожного зображення й натисни «Завершити й перевірити». Оцінка — частка правильних відповідей.' }),
        h('div', { class: 'vr-zoomrow' }, h('span', { text: '🔍 Збільшення:' }), slider, zlabel),
        grid, h('div', { class: 'vr-submitrow' }, submit, status), summary);
      host.append(root);

      let cards = [];
      function build() {
        grid.textContent = ''; cards = [];
        const items = seed ? K.shuffle(ZOOM_ITEMS, seed) : ZOOM_ITEMS.slice();
        items.forEach(it => {
          const inner = h('div', { class: 'vr-zinner' });
          const frame = h('div', { class: 'vr-zframe' }, inner);
          if (it.type === 'vector') inner.innerHTML = `<svg viewBox="0 0 120 120" width="120" height="120" role="img" aria-label="${K.esc(it.label)}">${it.svg}</svg>`;
          else rasterize(it, 120, life, c => { c.className = 'pix'; c.setAttribute('role', 'img'); c.setAttribute('aria-label', it.label); inner.appendChild(c); applyZoom(); });
          const bV = h('button', { type: 'button', class: 'btn small', 'data-type': 'vector', 'aria-pressed': 'false' }, 'Вектор');
          const bR = h('button', { type: 'button', class: 'btn small', 'data-type': 'raster', 'aria-pressed': 'false' }, 'Растр');
          const verdict = h('div', { class: 'vr-zans' });
          const card = h('div', { class: 'vr-zcard', 'data-id': it.id }, frame, h('div', { class: 'vr-zlabel', text: it.label }), h('div', { class: 'vr-zbtns' }, bV, bR), verdict);
          [bV, bR].forEach(b => life.listen(b, 'click', () => {
            if (locked || busy) return;
            answers[it.id] = b.dataset.type; render(); save.draft();
          }));
          grid.append(card);
          cards.push({ it, inner, card, bV, bR, verdict });
        });
        applyZoom();
      }
      function applyZoom() {
        const zoom = +slider.value;
        zlabel.textContent = Math.round(zoom * 100) + '%';
        for (const f of cards) {
          const el = f.inner.firstChild; if (!el) continue;
          const px = 120 * zoom;
          el.style.width = px + 'px'; el.style.height = px + 'px';
          if (el.tagName.toLowerCase() === 'svg') { el.setAttribute('width', px); el.setAttribute('height', px); }
          const t = Math.min(1, (zoom - 1) / 2);   // точка інтересу (край фігури) — у центрі рамки
          const fx = 60 + (f.it.fx - 60) * t, fy = 60 + (f.it.fy - 60) * t;
          f.inner.style.left = (80 - fx * zoom) + 'px'; f.inner.style.top = (80 - fy * zoom) + 'px';
        }
      }
      const score = () => Math.round(100 * ZOOM_ITEMS.filter(it => answers[it.id] === it.type).length / ZOOM_ITEMS.length);
      function render() {
        const reveal = showResult();
        for (const f of cards) {
          const a = answers[f.it.id];
          [f.bV, f.bR].forEach(b => { const on = b.dataset.type === a; b.classList.toggle('primary', on); b.setAttribute('aria-pressed', String(on)); b.disabled = locked || busy; });
          const right = a === f.it.type;
          f.card.classList.toggle('ok', reveal && right); f.card.classList.toggle('bad', reveal && !right);
          f.verdict.textContent = reveal ? (right ? '✓ правильно' : `✗ це ${TYPE_UA[f.it.type]}`) : '';
        }
        submit.classList.toggle('hidden', locked);
        submit.disabled = busy;
        summary.textContent = '';
        summary.className = 'vr-result';
        if (reveal) {
          const ok = ZOOM_ITEMS.filter(it => answers[it.id] === it.type).length, sc = score();
          summary.classList.add(sc >= 75 ? 'ok' : 'bad');
          summary.append(h('b', { text: `Правильно: ${ok} з ${ZOOM_ITEMS.length} (${sc}%)` }),
            h('div', { text: sc === 100 ? 'Відмінно! Ти точно відрізняєш вектор від растру.' : 'Запам’ятай: на збільшенні 400–600% растр розпадається на пікселі, а вектор лишається гладким.' }));
        }
      }
      life.listen(slider, 'input', applyZoom);
      life.listen(submit, 'click', async () => {
        if (locked || busy) return;
        const missing = ZOOM_ITEMS.filter(it => !answers[it.id]);
        if (missing.length) {
          const ok = await K.confirm({ title: 'Не всі зображення позначено', html: `<p>Без відповіді: ${missing.length} з ${ZOOM_ITEMS.length}. Вони рахуються як неправильні.</p>`, ok: 'Завершити так', cancel: 'Повернутися' });
          if (!ok || life.disposed || locked) return;
        }
        busy = true; render(); status.textContent = 'Підбиваю підсумок…';
        try {
          await save.final(score());
          if (life.disposed) return;
          locked = true; submittedNow = true; status.textContent = 'Завершено.';
        } catch (e) { if (!life.disposed) status.textContent = 'Не вдалося завершити. Натисни «Завершити й перевірити» ще раз.'; }
        finally { busy = false; if (!life.disposed) render(); }
      });

      build(); render();
      if (!seed) K.seed(ctx).then(s => { if (life.disposed) return; seed = s; build(); render(); if (!locked) save.draft(); });
      else if (ret.isNew && !locked) save.draft();
      return () => life.dispose();
    }
  };

  /* ================= 2. Малюємо числами ================= */
  const COLORS = [['#FF7A00', 'помаранчевий'], ['#2F7DF6', 'синій'], ['#3BB273', 'зелений'], ['#E5383B', 'червоний'], ['#9B9B9B', 'сірий']];
  const NUM_TASKS = [
    { title: 'Коло', shape: 'circle', text: 'Налаштуй числа так, щоб коло точно накрило пунктирний зразок і стало <b>помаранчевим</b>.',
      start: { cx: 100, cy: 90, r: 30, fill: '#9B9B9B' }, target: { cx: 200, cy: 150, r: 80, fill: '#FF7A00' }, fields: ['cx', 'cy', 'r'] },
    { title: 'Прямокутник', shape: 'rect', text: 'Прямокутник задається кутом (x, y), шириною і висотою. Зроби <b>синій</b> прямокутник за зразком.',
      start: { x: 20, y: 20, width: 80, height: 60, fill: '#9B9B9B' }, target: { x: 60, y: 90, width: 280, height: 120, fill: '#2F7DF6' }, fields: ['x', 'y', 'width', 'height'] },
    { title: 'Збільш у 2 рази', shape: 'circle', text: 'Це <b>зелене</b> коло треба збільшити вдвічі — разом із його положенням. Просто помнож усі числа на 2! Саме так вектор масштабується без втрати якості.',
      start: { cx: 90, cy: 70, r: 40, fill: '#3BB273' }, target: { cx: 180, cy: 140, r: 80, fill: '#3BB273' }, fields: ['cx', 'cy', 'r'] }
  ];
  const solvedNum = (T, v) => T.fields.every(f => Math.abs(v[f] - T.target[f]) <= 4) && v.fill === T.target.fill;

  window.Games['vector-numbers'] = {
    readonlyView: true,
    mount(host, ctx) {
      const life = K.lifecycle(), h = K.h;
      const d0 = (ctx.saved && ctx.saved.details) || {};
      const ret = K.returnInfo(ctx);
      const vals = NUM_TASKS.map((T, i) => Object.assign({}, T.start, d0.vals && d0.vals[i]));
      let cur = Math.max(0, Math.min(NUM_TASKS.length - 1, d0.cur | 0));
      let locked = K.isLocked(ctx), busy = false;

      const status = h('p', { class: 'vr-status', role: 'status', 'aria-live': 'polite' });
      const save = K.saver(ctx, {
        life, getDetails: () => ({ vals, cur, ack: ret.ack }),
        onError: (e, final) => { if (!life.disposed && !final) status.textContent = 'Чернетку не збережено. Числа залишаються на екрані.'; }
      });
      const tabs = h('div', { class: 'vr-tabs', role: 'tablist', 'aria-label': 'Завдання' });
      const total = h('div', { class: 'vr-total' });
      const body = h('div', { class: 'vr-numbody' });
      const submit = h('button', { type: 'button', class: 'btn primary' }, 'Завершити завдання');
      const root = h('div', { class: 'vr vr-num' }, ...K.banners(ctx),
        h('div', { class: 'vr-top' }, tabs, total), body,
        h('p', { class: 'vr-rubric', text: 'Оцінка — частка розв’язаних завдань (з трьох). Рахується після «Завершити завдання».' }),
        h('div', { class: 'vr-submitrow' }, submit, status));
      host.append(root);

      const score = () => Math.round(100 * NUM_TASKS.filter((T, i) => solvedNum(T, vals[i])).length / NUM_TASKS.length);
      function renderTabs() {
        tabs.textContent = '';
        NUM_TASKS.forEach((T, i) => {
          const ok = solvedNum(T, vals[i]);
          const b = h('button', { type: 'button', role: 'tab', class: 'vr-tab' + (i === cur ? ' cur' : '') + (ok ? ' done' : ''), 'aria-selected': String(i === cur), 'data-readonly-ok': '' },
            h('b', { text: String(i + 1) }), h('span', { text: ok ? '✓ ' + T.title : T.title }));
          life.listen(b, 'click', () => { if (i === cur) return; cur = i; renderAll(); if (!locked) save.draft(); });
          tabs.append(b);
        });
        total.textContent = '';
        total.append('Розв’язано: ', h('b', { text: `${NUM_TASKS.filter((T, i) => solvedNum(T, vals[i])).length} з ${NUM_TASKS.length}` }));
      }
      let panel = null;
      function renderBody() {
        if (panel) panel.dispose();
        panel = K.lifecycle();
        const T = NUM_TASKS[cur], v = vals[cur], tg = T.target;
        body.textContent = '';
        const NS = 'http://www.w3.org/2000/svg';
        const svg = document.createElementNS(NS, 'svg');
        svg.setAttribute('viewBox', '-34 -24 444 344');
        svg.setAttribute('class', 'vr-canvas');
        svg.setAttribute('role', 'img');
        svg.setAttribute('aria-label', 'Полотно з координатною сіткою');
        let grid = '';
        for (let x = 0; x <= 400; x += 50) grid += `<line x1="${x}" y1="0" x2="${x}" y2="300" stroke="#000000${x % 100 ? '10' : '22'}"/><text x="${x}" y="-8" font-size="11" text-anchor="middle" fill="#8a8178">${x}</text>`;
        for (let y = 0; y <= 300; y += 50) grid += `<line x1="0" y1="${y}" x2="400" y2="${y}" stroke="#000000${y % 100 ? '10' : '22'}"/><text x="-6" y="${y + 4}" font-size="11" text-anchor="end" fill="#8a8178">${y}</text>`;
        const targetEl = T.shape === 'circle'
          ? `<circle cx="${tg.cx}" cy="${tg.cy}" r="${tg.r}" fill="none" stroke="#1E1B18" stroke-width="2" stroke-dasharray="7 5"/>`
          : `<rect x="${tg.x}" y="${tg.y}" width="${tg.width}" height="${tg.height}" fill="none" stroke="#1E1B18" stroke-width="2" stroke-dasharray="7 5"/>`;
        svg.innerHTML = `<rect x="0" y="0" width="400" height="300" fill="#fff"/>${grid}<g class="vr-shape"></g>${targetEl}<text x="0" y="318" font-size="12" fill="#8a8178">x →  ·  y ↓ (у комп’ютерній графіці вісь y спрямована вниз)</text>`;
        const shapeG = svg.querySelector('.vr-shape');
        const code = h('div', { class: 'vr-code' });
        const res = h('div', { class: 'vr-result' });
        const inputs = h('div', { class: 'vr-inputs' });
        const draw = () => {
          shapeG.innerHTML = T.shape === 'circle'
            ? `<circle cx="${v.cx}" cy="${v.cy}" r="${Math.max(0, v.r)}" fill="${v.fill}" fill-opacity=".9"/><circle cx="${v.cx}" cy="${v.cy}" r="3" fill="#1E1B18"/>`
            : `<rect x="${v.x}" y="${v.y}" width="${Math.max(0, v.width)}" height="${Math.max(0, v.height)}" fill="${v.fill}" fill-opacity=".9"/>`;
          code.innerHTML = `&lt;<b>${T.shape}</b> ${T.fields.map(f => `${f}="<span class="v">${v[f]}</span>"`).join(' ')} fill="<span class="v">${v.fill}</span>" /&gt;`;
          const okNums = T.fields.every(f => Math.abs(v[f] - tg[f]) <= 4);
          res.className = 'vr-result'; res.textContent = '';
          if (solvedNum(T, v)) { res.classList.add('ok'); res.append(h('b', { text: '✓ Точно! Фігура збігається зі зразком.' })); }
          else if (okNums) res.append(h('span', { text: 'Розмір і положення правильні — залишилось обрати колір.' }));
        };
        const change = () => { if (locked || busy) return; draw(); renderTabs(); save.draft(); };
        for (const f of T.fields) {
          const max = f === 'r' ? 150 : (f === 'x' || f === 'cx' || f === 'width') ? 400 : 300;
          const num = h('input', { type: 'number', class: 'inp', value: v[f], min: 0, max, step: 1, 'aria-label': f });
          const rng = h('input', { type: 'range', min: 0, max, value: v[f], step: 1, 'aria-label': f + ' (повзунок)' });
          num.disabled = rng.disabled = locked;
          const set = val => { if (locked || busy) return; v[f] = Math.max(0, Math.min(max, Math.round(+val || 0))); num.value = v[f]; rng.value = v[f]; change(); };
          panel.listen(num, 'input', () => set(num.value));
          panel.listen(rng, 'input', () => set(rng.value));
          inputs.append(h('label', { class: 'vr-numrow' }, h('code', { text: f }), rng, num));
        }
        const sw = h('div', { class: 'vr-swatches', role: 'group', 'aria-label': 'Колір заливки' });
        COLORS.forEach(([c, name]) => {
          const b = h('button', { type: 'button', class: 'vr-sw' + (v.fill === c ? ' on' : ''), title: name, 'aria-label': name, style: `background:${c}` });
          b.disabled = locked;
          panel.listen(b, 'click', () => { if (locked || busy) return; v.fill = c; sw.querySelectorAll('.vr-sw').forEach(x => x.classList.toggle('on', x === b)); change(); });
          sw.append(b);
        });
        inputs.append(h('div', { class: 'vr-numrow' }, h('code', { text: 'fill' }), sw));
        body.append(h('div', { class: 'vr-layout' },
          h('div', { class: 'vr-canvaswrap' }, svg),
          h('div', { class: 'vr-side' }, h('h3', { text: T.title }), h('p', { html: T.text }), inputs, code, res)));
        draw();
      }
      function renderAll() {
        renderTabs(); renderBody();
        submit.classList.toggle('hidden', locked);
        submit.disabled = busy;
      }
      life.add(() => { if (panel) panel.dispose(); });
      life.listen(submit, 'click', async () => {
        if (locked || busy) return;
        const left = NUM_TASKS.filter((T, i) => !solvedNum(T, vals[i]));
        if (left.length) {
          const ok = await K.confirm({ title: 'Не всі завдання розв’язано', html: '<ul>' + left.map(T => `<li>${K.esc(T.title)}</li>`).join('') + `</ul><p>Результат зараз: <b>${score()}%</b>. Після завершення змінювати вже не можна.</p>`, ok: 'Завершити так', cancel: 'Ще попрацюю' });
          if (!ok || life.disposed || locked) return;
        }
        busy = true; renderAll(); status.textContent = 'Підбиваю підсумок…';
        try {
          await save.final(score());
          if (life.disposed) return;
          locked = true; status.textContent = `Завершено. Результат: ${score()}%.`;
        } catch (e) { if (!life.disposed) status.textContent = 'Не вдалося завершити. Натисни «Завершити завдання» ще раз.'; }
        finally { busy = false; if (!life.disposed) renderAll(); }
      });

      renderAll();
      if (locked && ctx.saved && ctx.saved.final) status.textContent = `Завершено. Результат: ${ctx.saved.score}%.`;
      if (ret.isNew && !locked) save.draft();
      return () => life.dispose();
    }
  };
})();
