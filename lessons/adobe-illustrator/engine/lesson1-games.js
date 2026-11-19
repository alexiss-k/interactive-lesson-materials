/* Ігри уроку 1: Збільш і визнач · Малюємо числами · Знайди інструмент · Гарячі клавіші · Налаштуй документ */
(function () {
  'use strict';
  const { h, esc } = window.App;
  window.Games = window.Games || {};
  const O = '#FF7A00';

  function seededRandom(str) {
    let h = 1779033703 ^ str.length;
    for (let i = 0; i < str.length; i++) { h = Math.imul(h ^ str.charCodeAt(i), 3432918353); h = (h << 13) | (h >>> 19); }
    return function () { h = Math.imul(h ^ (h >>> 16), 2246822507); h = Math.imul(h ^ (h >>> 13), 3266489909); h ^= h >>> 16; return (h >>> 0) / 4294967296; };
  }
  function seededShuffle(a, seed) { const r = seededRandom(seed); a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
  const studentSeed = ctx => (ctx.student ? ctx.student.name + '|' + ctx.student.cls : String(Math.random()));
  function shuffle(a) { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }

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
  function rasterize(item, size) {
    return new Promise(resolve => {
      const c = document.createElement('canvas');
      c.width = size; c.height = size;
      const img = new Image();
      img.onload = () => {
        const g = c.getContext('2d');
        g.drawImage(img, 0, 0, size, size);
        if (item.photo) { // шум, як у фото
          const d = g.getImageData(0, 0, size, size);
          for (let i = 0; i < d.data.length; i += 4) { const n = (Math.random() - .5) * 26; d.data[i] += n; d.data[i + 1] += n; d.data[i + 2] += n; }
          g.putImageData(d, 0, 0);
        }
        resolve(c);
      };
      img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120" width="${size}" height="${size}">${item.svg}</svg>`);
    });
  }

  window.Games['zoom-sort'] = {
    mount(host, ctx) {
      // власний випадковий порядок для кожного учня (стабільний при перезавантаженні)
      const rnd = seededRandom(studentSeed(ctx) + '|zoom');
      let items = seededShuffle(ZOOM_ITEMS, studentSeed(ctx) + '|zoom');
      let locked = false;
      const answers = {};
      let zoom = 1;
      const grid = h('div', { class: 'zoom-grid' });
      const slider = h('input', { type: 'range', min: 1, max: 10, step: .5, value: 1, class: 'zoom-range' });
      const zlabel = h('b', { text: '100%' });
      const checkBtn = h('button', { class: 'btn primary', disabled: true }, 'Перевірити');
      const result = h('div', { class: 'g-result' });
      host.append(
        h('div', { class: 'card-inner' },
          h('p', { html: 'Збільшуй зображення повзунком. Векторні залишаються чіткими, а растрові розпадаються на <b>пікселі</b>. Познач тип кожного зображення.' }),
          h('div', { class: 'row' }, h('span', { text: '🔍 Збільшення:' }), slider, zlabel)),
        grid, h('div', { class: 'row', style: 'margin-top:14px' }, checkBtn), result);
      const frames = [];
      items.forEach(it => {
        const frame = h('div', { class: 'zoom-frame' });
        const inner = h('div', { class: 'zoom-inner' });
        frame.appendChild(inner);
        if (it.type === 'vector') inner.innerHTML = `<svg viewBox="0 0 120 120" width="120" height="120">${it.svg}</svg>`;
        else rasterize(it, 120).then(c => { c.className = 'pix'; inner.appendChild(c); });
        const bV = h('button', { class: 'btn small' }, 'Вектор');
        const bR = h('button', { class: 'btn small' }, 'Растр');
        const pick = t => { if (locked) return; answers[it.id] = t; bV.classList.toggle('primary', t === 'vector'); bR.classList.toggle('primary', t === 'raster'); checkBtn.disabled = Object.keys(answers).length < items.length; };
        bV.onclick = () => pick('vector'); bR.onclick = () => pick('raster');
        const btns = rnd() < .5 ? [bV, bR] : [bR, bV];
        const card = h('div', { class: 'zoom-card' }, frame, h('div', { class: 'zoom-label', text: it.label }), h('div', { class: 'row', style: 'justify-content:center' }, btns));
        grid.appendChild(card);
        frames.push({ inner, card, it, bV, bR });
      });
      const applyZoom = () => {
        zoom = +slider.value; zlabel.textContent = Math.round(zoom * 100) + '%';
        for (const f of frames) {
          const el = f.inner.firstChild; if (!el) continue;
          const px = 120 * zoom;
          el.style.width = px + 'px'; el.style.height = px + 'px';
          if (el.tagName.toLowerCase() === 'svg') { el.setAttribute('width', px); el.setAttribute('height', px); }
          // точка інтересу (край фігури) — в центрі рамки
          const t = Math.min(1, (zoom - 1) / 2);
          const fx = 60 + (f.it.fx - 60) * t, fy = 60 + (f.it.fy - 60) * t;
          f.inner.style.left = (80 - fx * zoom) + 'px'; f.inner.style.top = (80 - fy * zoom) + 'px';
        }
      };
      slider.addEventListener('input', applyZoom);
      setTimeout(applyZoom, 50);
      checkBtn.onclick = async () => {
        if (locked) return;
        locked = true;
        checkBtn.remove();
        let ok = 0;
        for (const f of frames) {
          f.bV.disabled = true; f.bR.disabled = true;
          const right = answers[f.it.id] === f.it.type;
          if (right) ok++;
          f.card.classList.toggle('ok', right); f.card.classList.toggle('bad', !right);
          const old = f.card.querySelector('.zoom-ans'); if (old) old.remove();
          f.card.appendChild(h('div', { class: 'zoom-ans', text: right ? '✓ правильно' : `✗ це ${f.it.type === 'vector' ? 'вектор' : 'растр'}` }));
        }
        const score = Math.round(100 * ok / items.length);
        result.className = 'g-result ' + (score >= 75 ? 'ok' : 'bad');
        result.innerHTML = '';
        result.append(h('b', { text: `Правильно: ${ok} з ${items.length} (${score}%)` }),
          h('div', { text: score === 100 ? 'Відмінно! Ти точно відрізняєш вектор від растру.' : 'Запам\'ятай: на збільшенні 400–600% растр розпадається на пікселі, а вектор лишається гладким.' }));
        try { await ctx.finish(score, { ok, total: items.length }); } catch (e) {}
      };
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
  window.Games['vector-numbers'] = {
    mount(host, ctx) {
      const saved = (ctx.saved && ctx.saved.details) || {};
      const solved = Object.assign({}, saved.solved || {});
      let cur = 0;
      while (cur < NUM_TASKS.length - 1 && solved[cur]) cur++;
      const bar = h('div', { class: 'lvl-bar' });
      const body = h('div');
      host.append(bar, body);
      const score = () => Math.round(100 * Object.keys(solved).length / NUM_TASKS.length);

      function renderBar() {
        bar.innerHTML = '';
        NUM_TASKS.forEach((t, i) => {
          const b = h('button', { class: 'lvl' + (i === cur ? ' cur' : '') + (solved[i] ? ' done' : ''), disabled: !!solved[i] && i !== cur }, h('span', { class: 'n', text: i + 1 }), h('span', { class: 'st', text: solved[i] ? '✓' : t.title }));
          b.onclick = () => { cur = i; load(); };
          bar.appendChild(b);
        });
        bar.appendChild(h('div', { class: 'lvl-total' }, 'Результат: ', h('b', { text: score() + '%' })));
      }
      function load() {
        renderBar();
        const T = NUM_TASKS[cur];
        const allDone = () => NUM_TASKS.every((_, i) => solved[i]);
        const v = Object.assign({}, T.start);
        body.innerHTML = '';
        const NS = 'http://www.w3.org/2000/svg';
        const svg = document.createElementNS(NS, 'svg');
        svg.setAttribute('viewBox', '-30 -24 440 344');
        svg.setAttribute('class', 'num-canvas');
        let grid = '';
        for (let x = 0; x <= 400; x += 50) grid += `<line x1="${x}" y1="0" x2="${x}" y2="300" stroke="#000000${x % 100 ? '10' : '22'}"/><text x="${x}" y="-8" font-size="11" text-anchor="middle" fill="#8a8178">${x}</text>`;
        for (let y = 0; y <= 300; y += 50) grid += `<line x1="0" y1="${y}" x2="400" y2="${y}" stroke="#000000${y % 100 ? '10' : '22'}"/><text x="-6" y="${y + 4}" font-size="11" text-anchor="end" fill="#8a8178">${y}</text>`;
        const tg = T.target;
        const targetEl = T.shape === 'circle'
          ? `<circle cx="${tg.cx}" cy="${tg.cy}" r="${tg.r}" fill="none" stroke="#1E1B18" stroke-width="2" stroke-dasharray="7 5"/>`
          : `<rect x="${tg.x}" y="${tg.y}" width="${tg.width}" height="${tg.height}" fill="none" stroke="#1E1B18" stroke-width="2" stroke-dasharray="7 5"/>`;
        svg.innerHTML = `<rect x="0" y="0" width="400" height="300" fill="#fff"/>${grid}<g id="shape"></g>${targetEl}<text x="0" y="318" font-size="12" fill="#8a8178">x →  ·  y ↓ (у комп'ютерній графіці вісь y спрямована вниз)</text>`;
        const shapeG = svg.querySelector('#shape');
        const code = h('div', { class: 'code-box' });
        const res = h('div', { class: 'g-result' });
        const inputs = h('div', { class: 'num-inputs' });
        let done = !!solved[cur];
        const draw = () => {
          const attrs = T.fields.map(f => `${f}="${v[f]}"`).join(' ');
          shapeG.innerHTML = T.shape === 'circle'
            ? `<circle cx="${v.cx}" cy="${v.cy}" r="${Math.max(0, v.r)}" fill="${v.fill}" fill-opacity=".9"/><circle cx="${v.cx}" cy="${v.cy}" r="3" fill="#1E1B18"/>`
            : `<rect x="${v.x}" y="${v.y}" width="${Math.max(0, v.width)}" height="${Math.max(0, v.height)}" fill="${v.fill}" fill-opacity=".9"/>`;
          code.innerHTML = `&lt;<b>${T.shape}</b> ${T.fields.map(f => `${f}="<span class="v">${v[f]}</span>"`).join(' ')} fill="<span class="v">${v.fill}</span>" /&gt;`;
          const okNums = T.fields.every(f => Math.abs(v[f] - tg[f]) <= 4);
          const okColor = v.fill === tg.fill;
          if (okNums && okColor && !done) {
            done = true; solved[cur] = true;
            res.className = 'g-result ok'; res.innerHTML = '';
            const nextI = NUM_TASKS.findIndex((_, i) => !solved[i]);
            res.append(h('b', { text: '✓ Точно! Фігура збігається зі зразком.' }),
              nextI >= 0 ? h('button', { class: 'btn primary', style: 'display:block;margin-top:8px', onclick: () => { cur = nextI; load(); } }, 'Наступне завдання →') : h('div', { text: '🏆 Усі завдання виконано. Тепер ти знаєш, як «думає» векторна програма!' }));
            inputs.classList.add('locked-ui'); inputs.style.opacity = .6;
            if (allDone()) ctx.finish(score(), { solved }).catch(() => {});
            else ctx.complete(score(), { solved }).catch(() => {});
            renderBar();
          } else if (!done) {
            res.className = 'g-result'; res.innerHTML = '';
            if (okNums && !okColor) res.append(h('span', { text: 'Розмір і положення правильні — залишилось обрати колір.' }));
          }
        };
        for (const f of T.fields) {
          const max = f === 'r' ? 150 : (f === 'x' || f === 'cx' || f === 'width') ? 400 : 300;
          const num = h('input', { type: 'number', class: 'inp', value: v[f], min: 0, max, step: 1 });
          const rng = h('input', { type: 'range', min: 0, max, value: v[f], step: 1 });
          const set = val => { v[f] = Math.max(0, Math.min(max, Math.round(+val || 0))); num.value = v[f]; rng.value = v[f]; draw(); };
          num.addEventListener('input', () => set(num.value));
          rng.addEventListener('input', () => set(rng.value));
          inputs.appendChild(h('label', { class: 'num-row' }, h('code', { text: f }), rng, num));
        }
        const sw = h('div', { class: 'swatches' });
        COLORS.forEach(([c, name]) => {
          const b = h('button', { class: 'sw' + (v.fill === c ? ' on' : ''), title: name, style: `background:${c}` });
          b.onclick = () => { v.fill = c; sw.querySelectorAll('.sw').forEach(x => x.classList.remove('on')); b.classList.add('on'); draw(); };
          sw.appendChild(b);
        });
        inputs.appendChild(h('label', { class: 'num-row' }, h('code', { text: 'fill' }), sw));
        body.append(h('div', { class: 'g-layout' },
          h('div', { class: 'g-canvas-wrap' }, svg),
          h('div', { class: 'g-side' }, h('h2', { text: T.title }), h('p', { html: T.text }), inputs, code, res)));
        draw();
        if (solved[cur]) { res.className = 'g-result ok'; res.textContent = '✓ Виконано'; }
      }
      load();
    }
  };

  /* ================= 3. Знайди інструмент ================= */
  const TOOL_ICONS = {
    selection: '<path d="M7 3 L7 20 L11.5 15.5 L14.5 22 L17 21 L14 14.5 L20 14.5 Z" fill="#eee"/>',
    direct: '<path d="M7 3 L7 20 L11.5 15.5 L14.5 22 L17 21 L14 14.5 L20 14.5 Z" fill="none" stroke="#eee" stroke-width="1.6"/>',
    pen: '<path d="M12 3 L18 15 L12 21 L6 15 Z" fill="none" stroke="#eee" stroke-width="1.6"/><circle cx="12" cy="13" r="1.6" fill="#eee"/><path d="M12 3 V11" stroke="#eee" stroke-width="1.4"/>',
    curvature: '<path d="M4 18 C8 4 16 4 20 18" fill="none" stroke="#eee" stroke-width="1.8"/><circle cx="12" cy="8" r="2" fill="#eee"/>',
    type: '<text x="12" y="19" text-anchor="middle" font-size="18" font-family="Georgia" fill="#eee">T</text>',
    line: '<path d="M5 19 L19 5" stroke="#eee" stroke-width="2"/>',
    rect: '<rect x="5" y="6" width="14" height="12" fill="none" stroke="#eee" stroke-width="1.8"/>',
    ellipse: '<ellipse cx="12" cy="12" rx="8" ry="6.5" fill="none" stroke="#eee" stroke-width="1.8"/>',
    brush: '<path d="M18 4 L10 14" stroke="#eee" stroke-width="2.4"/><path d="M10 14 C6 14 6 19 4 20 C9 21 12 19 11.5 15.5 Z" fill="#eee"/>',
    rotate: '<path d="M18 12 A6 6 0 1 1 12 6" fill="none" stroke="#eee" stroke-width="1.8"/><path d="M11 3 L15 6 L11 9 Z" fill="#eee"/>',
    scale: '<rect x="4" y="10" width="10" height="10" fill="none" stroke="#eee" stroke-width="1.6"/><path d="M10 14 L20 4 M14 4 H20 V10" fill="none" stroke="#eee" stroke-width="1.6"/>',
    shapebuilder: '<circle cx="9" cy="12" r="5.5" fill="none" stroke="#eee" stroke-width="1.6"/><circle cx="15" cy="12" r="5.5" fill="none" stroke="#eee" stroke-width="1.6"/><path d="M18 2 V8 M15 5 H21" stroke="#eee" stroke-width="1.6"/>',
    gradient: '<defs><linearGradient id="tg"><stop offset="0" stop-color="#eee"/><stop offset="1" stop-color="#555"/></linearGradient></defs><rect x="4" y="6" width="16" height="12" fill="url(#tg)"/>',
    eyedropper: '<path d="M16 4 L20 8 L10 18 L6 19 L5 18 L6 14 Z" fill="none" stroke="#eee" stroke-width="1.6"/>',
    artboard: '<rect x="6" y="6" width="12" height="12" fill="none" stroke="#eee" stroke-width="1.4"/><path d="M3 6 H6 M6 3 V6 M18 21 V18 M21 18 H18" stroke="#eee" stroke-width="1.4"/>',
    hand: '<path d="M8 20 C5 16 5 13 6 11 L7 11 L8 14 L8 5 C8 4 10 4 10 5 L10 11 L10 3.5 C10 2.5 12 2.5 12 3.5 L12 11 L12 4.5 C12 3.5 14 3.5 14 4.5 L14 11 L14 6.5 C14 5.5 16 5.5 16 6.5 L16 15 C16 18 14 20 12 20 Z" fill="#eee"/>',
    zoom: '<circle cx="10" cy="10" r="5.5" fill="none" stroke="#eee" stroke-width="1.8"/><path d="M14 14 L20 20" stroke="#eee" stroke-width="2.4"/>',
    undo: '<path d="M8 9 H15 A5 5 0 0 1 15 19 H9" fill="none" stroke="#eee" stroke-width="1.9"/><path d="M9 5 L4 9 L9 13 Z" fill="#eee"/>',
    copy: '<rect x="8" y="8" width="11" height="12" rx="1.5" fill="none" stroke="#eee" stroke-width="1.7"/><path d="M5 16 V5 a1 1 0 0 1 1 -1 H15" fill="none" stroke="#eee" stroke-width="1.7"/>',
    paste: '<rect x="5" y="5" width="14" height="16" rx="2" fill="none" stroke="#eee" stroke-width="1.7"/><rect x="9" y="3" width="6" height="4" rx="1" fill="#eee"/><path d="M8 12 H16 M8 16 H14" stroke="#eee" stroke-width="1.5"/>',
    cut: '<circle cx="7" cy="17" r="3" fill="none" stroke="#eee" stroke-width="1.7"/><circle cx="17" cy="17" r="3" fill="none" stroke="#eee" stroke-width="1.7"/><path d="M9 15 L18 4 M15 15 L6 4" stroke="#eee" stroke-width="1.7"/>'
  };
  const TOOLS = [
    ['selection', 'Selection Tool (V)'], ['direct', 'Direct Selection Tool (A)'], ['pen', 'Pen Tool (P)'], ['curvature', 'Curvature Tool (Shift+~)'],
    ['type', 'Type Tool (T)'], ['line', 'Line Segment Tool (\\)'], ['rect', 'Rectangle Tool (M)'], ['ellipse', 'Ellipse Tool (L)'],
    ['brush', 'Paintbrush Tool (B)'], ['rotate', 'Rotate Tool (R)'], ['scale', 'Scale Tool (S)'], ['shapebuilder', 'Shape Builder Tool (Shift+M)'],
    ['gradient', 'Gradient Tool (G)'], ['eyedropper', 'Eyedropper Tool (I)'], ['artboard', 'Artboard Tool (Shift+O)'], ['hand', 'Hand Tool (H)'], ['zoom', 'Zoom Tool (Z)']
  ];
  const HUNT = [
    ['pen', 'Pen Tool — перо'], ['selection', 'Selection Tool — чорна стрілка'], ['direct', 'Direct Selection Tool — біла стрілка'],
    ['rect', 'Rectangle Tool — прямокутник'], ['ellipse', 'Ellipse Tool — еліпс'], ['hand', 'Hand Tool — рука'],
    ['type', 'Type Tool — текст'], ['fill', 'квадрат заливки (Fill)'], ['stroke', 'квадрат обведення (Stroke)'],
    ['layers', 'панель Layers (Шари)'], ['board', 'монтажну область (Artboard)'], ['menu-File', 'меню File (тут Save, Export)'], ['zoom', 'Zoom Tool — лупа']
  ];
  const NAMES = Object.assign(Object.fromEntries(TOOLS), {
    fill: 'Fill — заливка', stroke: 'Stroke — обведення', swap: 'Swap Fill and Stroke (Shift+X)', layers: 'Панель Layers', properties: 'Панель Properties',
    board: 'Монтажна область (Artboard)', canvas: 'Робочий стіл (поза монтажною областю)', control: 'Контекстна панель (Control)',
    'menu-File': 'Меню File', 'menu-Edit': 'Меню Edit', 'menu-Object': 'Меню Object', 'menu-Type': 'Меню Type', 'menu-Select': 'Меню Select',
    'menu-Effect': 'Меню Effect', 'menu-View': 'Меню View', 'menu-Window': 'Меню Window', 'menu-Help': 'Меню Help', align: 'Кнопки вирівнювання (Align)', swatches: 'Панель Swatches (зразки кольорів)'
  });

  function aiInterface() {
    const menus = ['File', 'Edit', 'Object', 'Type', 'Select', 'Effect', 'View', 'Window', 'Help'];
    let menuX = 52;
    const menuHtml = menus.map(m => { const w = m.length * 7.6 + 18; const s = `<g class="hot" data-id="menu-${m}"><rect x="${menuX}" y="4" width="${w}" height="22" rx="3" fill="transparent"/><text x="${menuX + w / 2}" y="20" text-anchor="middle" font-size="13" fill="#ddd">${m}</text></g>`; menuX += w; return s; }).join('');
    const tools = TOOLS.map(([id], i) => {
      const col = i % 2, row = Math.floor(i / 2);
      const x = 10 + col * 30, y = 72 + row * 30;
      return `<g class="hot" data-id="${id}" transform="translate(${x} ${y})"><rect width="26" height="26" rx="4" fill="#3a3a3a"/><g transform="translate(1 1)">${TOOL_ICONS[id]}</g></g>`;
    }).join('');
    const sy = 72 + 9 * 30 + 12;
    return `<svg viewBox="0 0 900 540" class="ai-ui" font-family="Segoe UI, Arial">
      <rect width="900" height="540" fill="#323232"/>
      <rect width="900" height="30" fill="#252525"/>
      <rect x="8" y="5" width="34" height="20" rx="4" fill="#330000" stroke="${O}" stroke-width="1.5"/><text x="25" y="20" text-anchor="middle" font-size="12" font-weight="800" fill="${O}">Ai</text>
      ${menuHtml}
      <g class="hot" data-id="control"><rect x="0" y="30" width="900" height="30" fill="#3b3b3b"/><text x="80" y="50" font-size="12" fill="#bbb">Path   Fill ▾   Stroke ▾   1 pt ▾   Opacity: 100%   Style ▾</text></g>
      <rect x="4" y="64" width="68" height="472" rx="4" fill="#2a2a2a"/>
      ${tools}
      <g class="hot" data-id="fill"><rect x="14" y="${sy}" width="28" height="28" fill="#fff" stroke="#111" stroke-width="1.5"/></g>
      <g class="hot" data-id="stroke"><rect x="31" y="${sy + 17}" width="28" height="28" fill="#2a2a2a" stroke="#E5383B" stroke-width="6"/></g>
      <g class="hot" data-id="swap"><path d="M48 ${sy + 2} q8 0 8 8" fill="none" stroke="#ccc" stroke-width="1.5"/><path d="M53 ${sy - 1} l-5 3 5 3z M53 ${sy + 9} l3 5 3 -5z" fill="#ccc"/></g>
      <g class="hot" data-id="canvas"><rect x="78" y="64" width="560" height="472" fill="#535353"/></g>
      <g class="hot" data-id="board"><rect x="148" y="110" width="420" height="380" fill="#fff"/><circle cx="358" cy="300" r="90" fill="${O}"/><path d="M290 200 L330 150 L380 210" fill="none" stroke="#2F7DF6" stroke-width="3"/></g>
      <text x="150" y="104" font-size="11" fill="#ccc" pointer-events="none">01 - Artboard 1</text>
      <rect x="644" y="64" width="252" height="472" fill="#2a2a2a"/>
      <g class="hot" data-id="properties"><rect x="650" y="70" width="240" height="210" rx="4" fill="#323232"/>
        <text x="662" y="92" font-size="13" font-weight="700" fill="#eee">Properties</text>
        <text x="662" y="118" font-size="11" fill="#aaa">Transform</text>
        <rect x="662" y="126" width="100" height="18" rx="3" fill="#444"/><rect x="772" y="126" width="100" height="18" rx="3" fill="#444"/>
        <text x="662" y="168" font-size="11" fill="#aaa">Appearance</text>
        <rect x="662" y="176" width="210" height="18" rx="3" fill="#444"/></g>
      <g class="hot" data-id="align"><rect x="662" y="214" width="210" height="52" rx="4" fill="#3a3a3a"/><text x="670" y="230" font-size="11" fill="#aaa">Align</text>
        ${[0,1,2,3,4,5].map(i => `<g transform="translate(${670 + i * 33} 236)"><rect width="24" height="22" rx="3" fill="#4a4a4a"/><path d="M${i < 3 ? 4 + i * 8 : 4} ${i < 3 ? 3 : 3 + (i - 3) * 8} ${i < 3 ? 'v16' : 'h16'}" stroke="#ddd" stroke-width="1.6"/><rect x="${i < 3 ? 6 : 7}" y="${i < 3 ? 7 : 6}" width="${i < 3 ? 12 : 10}" height="${i < 3 ? 8 : 12}" fill="#bbb" opacity=".8"/></g>`).join('')}</g>
      <g class="hot" data-id="layers"><rect x="650" y="290" width="240" height="140" rx="4" fill="#323232"/>
        <text x="662" y="312" font-size="13" font-weight="700" fill="#eee">Layers</text>
        ${[0,1,2].map(i => `<rect x="662" y="${324 + i * 32}" width="216" height="26" rx="3" fill="#3d3d3d"/><text x="670" y="${341 + i * 32}" font-size="12" fill="#ddd">👁 🔒  ${['Layer 1', '&lt;Ellipse&gt;', '&lt;Path&gt;'][i]}</text>`).join('')}</g>
      <g class="hot" data-id="swatches"><rect x="650" y="440" width="240" height="90" rx="4" fill="#323232"/>
        <text x="662" y="460" font-size="13" font-weight="700" fill="#eee">Swatches</text>
        ${['#fff','#000','#E5383B',O,'#FFD23F','#3BB273','#2F7DF6','#8E44AD','#999','#5D4037'].map((c, i) => `<rect x="${662 + (i % 10) * 21}" y="472" width="18" height="18" fill="${c}"/>`).join('')}</g>
    </svg>`;
  }

  window.Games['interface-hunt'] = {
    mount(host, ctx) {
      const prompts = shuffle(HUNT).slice(0, 10);
      let i = 0, mistakes = 0, firstTry = 0, triedThis = false;
      const ask = h('div', { class: 'hunt-ask' });
      const fb = h('div', { class: 'hunt-fb' });
      const prog = h('div', { class: 'progress', style: 'margin:10px 0' }, h('i', { style: 'width:0%' }));
      const ui = h('div', { class: 'ai-ui-wrap', html: aiInterface() });
      host.append(h('p', { class: 'muted', text: 'Це макет інтерфейсу Illustrator. Клікни на елемент, який названо нижче.' }), ask, prog, ui, fb);
      const show = () => {
        if (i >= prompts.length) return finish();
        ask.innerHTML = `Знайди: <b>${esc(prompts[i][1])}</b> <span class="muted">(${i + 1} з ${prompts.length})</span>`;
        prog.firstChild.style.width = (100 * i / prompts.length) + '%';
        triedThis = false;
      };
      const flash = (el, cls) => { el.classList.add(cls); setTimeout(() => el.classList.remove(cls), 700); };
      ui.addEventListener('click', e => {
        if (i >= prompts.length) return;
        const g = e.target.closest('.hot');
        if (!g) return;
        const id = g.dataset.id;
        if (id === prompts[i][0]) {
          if (!triedThis) firstTry++;
          flash(g, 'hit-ok');
          fb.className = 'hunt-fb ok'; fb.textContent = '✓ Так! Це ' + (NAMES[id] || id);
          i++; setTimeout(show, 450);
        } else {
          mistakes++; triedThis = true;
          flash(g, 'hit-bad');
          fb.className = 'hunt-fb bad'; fb.textContent = '✗ Ні, це ' + (NAMES[id] || id) + '. Шукай далі!';
        }
      });
      async function finish() {
        prog.firstChild.style.width = '100%';
        const score = Math.round(100 * firstTry / prompts.length);
        ask.innerHTML = `🏁 Готово! З першої спроби: <b>${firstTry} з ${prompts.length}</b> · помилок: ${mistakes}`;
        fb.className = 'hunt-fb'; fb.innerHTML = '';
        ui.classList.add('locked-ui');
        try { await ctx.finish(score, { firstTry, total: prompts.length, mistakes }); } catch (e) {}
      }
      show();
    }
  };

  /* ================= 4. Гарячі клавіші ================= */
  const KEYS = [
    { icon: 'selection', name: 'Selection Tool (чорна стрілка)', code: 'KeyV', label: 'V' },
    { icon: 'direct', name: 'Direct Selection Tool (біла стрілка)', code: 'KeyA', label: 'A' },
    { icon: 'pen', name: 'Pen Tool (перо)', code: 'KeyP', label: 'P' },
    { icon: 'rect', name: 'Rectangle Tool (прямокутник)', code: 'KeyM', label: 'M' },
    { icon: 'ellipse', name: 'Ellipse Tool (еліпс)', code: 'KeyL', label: 'L' },
    { icon: 'type', name: 'Type Tool (текст)', code: 'KeyT', label: 'T' },
    { icon: 'zoom', name: 'Zoom Tool (лупа)', code: 'KeyZ', label: 'Z' },
    { icon: 'hand', name: 'Hand Tool (рука)', code: 'KeyH', label: 'H' },
    { icon: 'undo', name: 'Скасувати останню дію', code: 'KeyZ', ctrl: true, label: 'Ctrl + Z' },
    { icon: 'copy', name: 'Копіювати', code: 'KeyC', ctrl: true, label: 'Ctrl + C' },
    { icon: 'paste', name: 'Вставити', code: 'KeyV', ctrl: true, label: 'Ctrl + V' },
    { icon: 'cut', name: 'Вирізати', code: 'KeyX', ctrl: true, label: 'Ctrl + X' }
  ];
  window.Games['hotkeys'] = {
    mount(host, ctx) {
      const rounds = shuffle(KEYS);
      let i = 0, firstTry = 0, missed = false, busy = false;
      const card = h('div', { class: 'hk-card' });
      const fb = h('div', { class: 'hunt-fb' });
      const prog = h('div', { class: 'progress', style: 'margin:10px 0' }, h('i', { style: 'width:0%' }));
      host.append(h('p', { class: 'muted', html: 'Натисни на клавіатурі гарячу клавішу для інструмента чи дії. Розкладка (укр/англ) не має значення. <b>Клікни тут, щоб почати.</b>' }), prog, card, fb);
      const iconSvg = id => id === 'swap'
        ? '<svg viewBox="0 0 24 24" width="64" height="64"><rect width="24" height="24" rx="5" fill="#3a3a3a"/><rect x="4" y="4" width="10" height="10" fill="#fff"/><rect x="10" y="10" width="10" height="10" fill="none" stroke="#E5383B" stroke-width="3"/></svg>'
        : `<svg viewBox="0 0 24 24" width="64" height="64"><rect width="24" height="24" rx="5" fill="#3a3a3a"/>${TOOL_ICONS[id]}</svg>`;
      const show = () => {
        if (i >= rounds.length) return finish();
        const r = rounds[i];
        missed = false; busy = false;
        card.className = 'hk-card';
        card.innerHTML = `${iconSvg(r.icon)}<div><div class="hk-name">${esc(r.name)}</div><div class="muted">Натисни клавішу… (${i + 1} з ${rounds.length})</div></div>`;
        prog.firstChild.style.width = (100 * i / rounds.length) + '%';
      };
      const fmt = e => [(e.ctrlKey || e.metaKey) ? 'Ctrl' : '', e.shiftKey ? 'Shift' : '', e.altKey ? 'Alt' : '', e.code.replace(/^Key|^Digit/, '')].filter(Boolean).join(' + ');
      const onKey = e => {
        if (i >= rounds.length || busy) return;
        if (['ShiftLeft', 'ShiftRight', 'ControlLeft', 'ControlRight', 'AltLeft', 'AltRight', 'MetaLeft', 'MetaRight'].includes(e.code)) return;
        if (e.target && /INPUT|TEXTAREA/.test(e.target.tagName)) return;
        e.preventDefault();
        const r = rounds[i];
        const ok = e.code === r.code && !!r.shift === e.shiftKey && !!r.ctrl === (e.ctrlKey || e.metaKey) && !e.altKey;
        if (ok) {
          if (!missed) firstTry++;
          busy = true;
          card.classList.add('ok');
          fb.className = 'hunt-fb ok'; fb.textContent = `✓ ${r.label} — правильно!`;
          i++; setTimeout(show, 550);
        } else {
          missed = true;
          card.classList.remove('bad'); void card.offsetWidth; card.classList.add('bad');
          fb.className = 'hunt-fb bad'; fb.innerHTML = `✗ Ти натиснув ${esc(fmt(e))}. Правильно: <span class="kbd-inline">${esc(r.label)}</span> — натисни її.`;
        }
      };
      window.addEventListener('keydown', onKey);
      async function finish() {
        prog.firstChild.style.width = '100%';
        const score = Math.round(100 * firstTry / rounds.length);
        card.className = 'hk-card';
        card.innerHTML = `<div style="font-size:54px">⌨️</div><div><div class="hk-name">З першої спроби: ${firstTry} з ${rounds.length}</div><div class="muted">${score >= 80 ? 'Майже як професіонал!' : 'Повтори шпаргалку і спробуй ще раз.'}</div></div>`;
        fb.className = 'hunt-fb'; fb.innerHTML = '';
        window.removeEventListener('keydown', onKey);
        try { await ctx.finish(score, { firstTry, total: rounds.length }); } catch (e) {}
      }
      show();
      return () => window.removeEventListener('keydown', onKey);
    }
  };

  /* ================= 5. Налаштуй документ ================= */
  const PROFILES = {
    'Mobile': { units: 'px', w: 1080, h: 1920, color: 'RGB', ppi: 72, bleed: 0 },
    'Web': { units: 'px', w: 1366, h: 768, color: 'RGB', ppi: 72, bleed: 0 },
    'Print': { units: 'mm', w: 210, h: 297, color: 'CMYK', ppi: 300, bleed: 3 },
    'Film & Video': { units: 'px', w: 1920, h: 1080, color: 'RGB', ppi: 72, bleed: 0 },
    'Art & Illustration': { units: 'mm', w: 297, h: 210, color: 'RGB', ppi: 300, bleed: 0 }
  };
  const UNITS = { px: ['Pixels', 1], mm: ['Millimeters', 72 / 25.4], cm: ['Centimeters', 72 / 2.54], in: ['Inches', 72], pt: ['Points', 1] };
  const DOCS = [
    { title: 'Флаєр A5 для друкарні', brief: 'Кафе замовило <b>вертикальний флаєр формату A5</b>, який надрукують у друкарні тиражем 1000 штук. Фон — яскрава фотографія на весь аркуш.',
      need: { units: 'mm', w: 148, h: 210, color: 'CMYK', ppi: 300, bleed: 3 } },
    { title: 'Пост для Instagram', brief: 'Шкільний блог хоче <b>вертикальний пост для Instagram 1080 × 1350 пікселів</b> з анонсом конкурсу.',
      need: { units: 'px', w: 1080, h: 1350, color: 'RGB', ppi: 72, bleed: 0 } },
    { title: 'Візитка', brief: 'Вчителька замовила <b>горизонтальні візитки 90 × 50 мм</b>, їх друкуватимуть у типографії. Колір фону — до самого краю.',
      need: { units: 'mm', w: 90, h: 50, color: 'CMYK', ppi: 300, bleed: 3 } },
    { title: 'Банер для сайту', brief: 'Потрібен <b>банер для головної сторінки сайту ліцею 1200 × 400 px</b>.',
      need: { units: 'px', w: 1200, h: 400, color: 'RGB', ppi: 72, bleed: 0 } },
    { title: 'Іконка застосунку', brief: 'Учні розробляють мобільний застосунок. Потрібна <b>квадратна іконка 1024 × 1024 px</b>.',
      need: { units: 'px', w: 1024, h: 1024, color: 'RGB', ppi: 72, bleed: 0 } }
  ];
  /* Випадкові НЕправильні стартові налаштування — учень мусить змінити все сам */
  function wrongStart(need) {
    const pick = a => a[Math.floor(Math.random() * a.length)];
    const profile = pick(Object.keys(PROFILES));
    const units = need.units === 'px' ? pick(['mm', 'mm', 'cm', 'in']) : pick(['px', 'px', 'cm', 'pt']);
    const sizesPx = [[1366, 768], [595, 842], [800, 600], [1920, 1080], [612, 792], [500, 500], [1000, 700]];
    const k = UNITS[units][1];
    let [w, hh] = pick(sizesPx.filter(([a, b]) => !(Math.abs(a - need.w * UNITS[need.units][1]) < 3 && Math.abs(b - need.h * UNITS[need.units][1]) < 3)));
    const mmK = UNITS.mm[1] / k;
    return {
      profile, units, w: w / k, h: hh / k,
      color: need.color === 'CMYK' ? 'RGB' : 'CMYK',
      ppi: pick([72, 150, 300].filter(v => v !== need.ppi)),
      bleed: (need.bleed ? pick([0, 0, 1, 5]) : pick([3, 5])) * mmK
    };
  }
  window.Games['doc-setup'] = {
    mount(host, ctx) {
      const saved = (ctx.saved && ctx.saved.details) || {};
      const res = Object.assign({}, saved.res || {});   // індекс → 100 | 60
      let cur = 0;
      while (cur < DOCS.length - 1 && res[cur] != null) cur++;
      const bar = h('div', { class: 'lvl-bar' });
      const body = h('div');
      host.append(bar, body);
      const total = () => Math.round(DOCS.reduce((a, _, i) => a + (res[i] || 0), 0) / DOCS.length);
      function renderBar() {
        bar.innerHTML = '';
        DOCS.forEach((D, i) => {
          const b = h('button', { class: 'lvl' + (i === cur ? ' cur' : '') + (res[i] != null ? ' done' : ''), disabled: res[i] != null && i !== cur }, h('span', { class: 'n', text: i + 1 }), h('span', { class: 'st', text: res[i] != null ? '✓' : D.title }));
          b.onclick = () => { cur = i; load(); };
          bar.appendChild(b);
        });
        bar.appendChild(h('div', { class: 'lvl-total' }, 'Результат: ', h('b', { text: total() + '%' })));
      }
      function load() {
        renderBar();
        const D = DOCS[cur];
        let attempts = 0;
        const st = wrongStart(D.need);
        let locked = false;
        body.innerHTML = '';
        const dlg = h('div', { class: 'nd' });
        const fb = h('div', { class: 'g-result' });
        body.append(h('div', { class: 'brief' }, h('div', { class: 'brief-h', text: `📩 Замовлення ${cur + 1}: ${D.title}` }), h('div', { html: D.brief }),
          h('div', { class: 'brief-note', text: '⚠️ Колега залишив у вікні чужі налаштування. Вкладка профілю змінює лише розмір — Color Mode, Raster Effects і Bleed перевір і вистав сам!' })), dlg, fb);

        function fmtNum(v) { return Math.round(v * 100) / 100; }
        function draw() {
          dlg.innerHTML = '';
          const tabs = h('div', { class: 'nd-tabs' });
          Object.keys(PROFILES).forEach(p => {
            const b = h('button', { class: p === st.profile ? 'on' : '' }, p);
            b.onclick = () => { if (locked) return; const P = PROFILES[p]; Object.assign(st, { profile: p, units: P.units, w: P.w, h: P.h }); draw(); };
            tabs.appendChild(b);
          });
          const field = (label, ctrl) => h('div', { class: 'nd-f' }, h('span', { text: label }), ctrl);
          const num = (key, step) => {
            const i = h('input', { type: 'number', value: fmtNum(st[key]), step: step || 1, min: 0 });
            i.addEventListener('input', () => { st[key] = parseFloat(String(i.value).replace(',', '.')) || 0; });
            return i;
          };
          const sel = (key, opts) => {
            const s = h('select', null, opts.map(([v, t]) => h('option', { value: v, text: t })));
            s.value = st[key];
            s.addEventListener('change', () => {
              if (key === 'units') {
                const k0 = UNITS[st.units][1], k1 = UNITS[s.value][1];
                st.w = st.w * k0 / k1; st.h = st.h * k0 / k1;
                if (st.bleed) st.bleed = st.bleed * k0 / k1;
                st.units = s.value; draw(); return;
              }
              st[key] = isNaN(+s.value) ? s.value : +s.value;
            });
            return s;
          };
          const portrait = st.h >= st.w;
          const orient = h('div', { class: 'nd-orient' },
            h('button', { class: portrait ? 'on' : '', title: 'Книжкова', onclick: () => { if (st.w > st.h) { [st.w, st.h] = [st.h, st.w]; draw(); } } }, '▯'),
            h('button', { class: !portrait ? 'on' : '', title: 'Альбомна', onclick: () => { if (st.h > st.w) { [st.w, st.h] = [st.h, st.w]; draw(); } } }, '▭'));
          dlg.append(
            h('div', { class: 'nd-head' }, h('b', { text: 'New Document' }), h('span', { class: 'nd-x', text: '✕' })),
            tabs,
            h('div', { class: 'nd-body' },
              h('div', { class: 'nd-preview' }, h('div', { class: 'nd-paper', style: `aspect-ratio:${Math.max(1, st.w)}/${Math.max(1, st.h)}` }), h('div', { class: 'nd-cap', text: `${fmtNum(st.w)} × ${fmtNum(st.h)} ${st.units}` })),
              h('div', { class: 'nd-details' },
                h('div', { class: 'nd-sec', text: 'PRESET DETAILS' }),
                h('div', { class: 'nd-name' }, h('input', { type: 'text', value: D.title })),
                field('Width', h('div', { class: 'nd-pair' }, num('w', .1), sel('units', Object.entries(UNITS).map(([k, v]) => [k, v[0]])))),
                field('Height', h('div', { class: 'nd-pair' }, num('h', .1), orient)),
                field('Artboards', h('input', { type: 'number', value: 1, min: 1 })),
                field('Bleed (' + st.units + ')', h('div', { class: 'nd-pair' }, num('bleed', .5), h('span', { class: 'nd-link', title: 'Однаково з усіх боків', text: '🔗 усі 4 боки' }))),
                h('div', { class: 'nd-sec', text: '▾ ADVANCED OPTIONS' }),
                field('Color Mode', sel('color', [['RGB', 'RGB Color'], ['CMYK', 'CMYK Color']])),
                field('Raster Effects', sel('ppi', [[72, 'Screen (72 ppi)'], [150, 'Medium (150 ppi)'], [300, 'High (300 ppi)']])),
                h('div', { class: 'nd-actions' }, h('button', { class: 'nd-create', onclick: check }, 'Create'), h('button', { class: 'nd-close', text: 'Close', onclick: () => {} })))));
        }
        async function check() {
          attempts++;
          const n = D.need;
          const k = UNITS[st.units][1] / UNITS[n.units][1];
          const w = st.w * k, hh = st.h * k, bl = st.bleed * k;
          const tol = n.units === 'mm' ? 1 : 2;
          const rows = [
            ['Одиниці виміру', st.units === n.units, n.units === 'mm' ? 'Для друку — міліметри.' : 'Для екрана — пікселі.'],
            ['Ширина', Math.abs(w - n.w) <= tol, `Потрібно ${n.w} ${n.units}.`],
            ['Висота', Math.abs(hh - n.h) <= tol, `Потрібно ${n.h} ${n.units}. Перевір орієнтацію.`],
            ['Колірний режим', st.color === n.color, n.color === 'CMYK' ? 'Друк — CMYK.' : 'Екран — RGB.'],
            ['Raster Effects', +st.ppi === n.ppi, n.ppi === 300 ? 'Для друку — High (300 ppi).' : 'Для екрана — Screen (72 ppi).'],
            ['Виліт (Bleed)', Math.abs(bl - n.bleed) <= (n.units === 'mm' ? .2 : 1), n.bleed ? 'Для друку з фоном до краю — 3 мм.' : 'Для екрана виліт не потрібен — 0.']
          ];
          const allOk = rows.every(r => r[1]);
          fb.innerHTML = '';
          fb.className = 'g-result ' + (allOk ? 'ok' : 'bad');
          fb.append(h('b', { text: allOk ? '✓ Документ створено правильно!' : 'Клієнт повернув файл. Перевір налаштування:' }),
            h('ul', { class: 'checklist' }, rows.map(r => h('li', { class: r[1] ? 'ok' : 'bad' }, (r[1] ? '✓ ' : '✗ ') + r[0] + (r[1] ? '' : ' — ' + r[2])))));
          if (allOk) {
            if (res[cur] == null) res[cur] = attempts === 1 ? 100 : 60;
            locked = true;
            dlg.classList.add('locked-ui'); dlg.style.opacity = .7;
            const cb = dlg.querySelector('.nd-create'); if (cb) cb.remove();
            renderBar();
            const nextI = DOCS.findIndex((_, i) => res[i] == null);
            if (nextI < 0) { try { await ctx.finish(total(), { res }); } catch (e) {} }
            else { try { await ctx.complete(total(), { res }); } catch (e) {} }
            fb.append(nextI >= 0
              ? h('button', { class: 'btn primary', style: 'margin-top:8px', onclick: () => { cur = nextI; load(); } }, 'Наступне замовлення →')
              : h('div', { style: 'margin-top:8px;font-weight:700', text: '🏆 Усі замовлення виконано!' }));
          }
        }
        draw();
      }
      load();
    }
  };
})();
