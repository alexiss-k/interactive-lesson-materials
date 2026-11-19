/* Mini-Illustrator editor UI: tools V, A, P, M, L, Shape Builder; Fill/Stroke, Pathfinder, Align, Object panels.
   Classic script; needs MiniAICore and LessonKit. Exposes window.MiniAIEditor.create(opts). */
(() => {
  'use strict';
  if (window.MiniAIEditor) return;
  const C = window.MiniAICore, K = window.LessonKit;
  const NS = 'http://www.w3.org/2000/svg';
  const BLUE = '#2F7DF6';

  const PALETTE = [
    ['#FFFFFF', 'білий'], ['#1E1B18', 'чорний'], ['#9E9E9E', 'сірий'], ['#E5383B', 'червоний'],
    ['#FF7A00', 'помаранчевий'], ['#FFC93C', 'жовтий'], ['#2BAE66', 'зелений'], ['#2F7DF6', 'синій'],
    ['#9AD0F5', 'блакитний'], ['#F49AC2', 'рожевий'], ['#8B5A2B', 'коричневий']
  ];
  const COLOR_NAME = Object.fromEntries(PALETTE);
  const WIDTHS = [1, 2, 3, 4, 6, 8, 10, 12, 16];
  const MAX_OBJS = 80;

  const TOOLS = [
    { id: 'V', key: 'V', name: 'Selection — чорна стрілка' },
    { id: 'A', key: 'A', name: 'Direct Selection — біла стрілка' },
    { id: 'P', key: 'P', name: 'Pen Tool — перо' },
    { id: 'M', key: 'M', name: 'Rectangle — прямокутник' },
    { id: 'L', key: 'L', name: 'Ellipse — еліпс' },
    { id: 'SB', key: 'Shift+M', name: 'Shape Builder — конструктор форм' }
  ];
  const TOOL_HELP = {
    V: 'Чорна стрілка: клік — виділити об’єкт (групу цілком), Shift + клік — додати, тягни — перемістити (Shift — рівно), квадратики рамки — змінити розмір (Shift — пропорційно, Alt — від центру), Alt + тягни або Ctrl+C → Ctrl+V — копія, рамка по порожньому — виділити кілька.',
    A: 'Біла стрілка: наведи на об’єкт — з’являться точки. Тягни точку або круглу ручку. Тягни за сам об’єкт — перемістити лише його. Alt на ручці — зламати кут. Delete — видалити виділену точку (сусідні з’єднаються).',
    P: 'Перо: клік — кутова точка · натисни й тягни — крива · Alt + клік по останній точці — прибрати ручку (далі кут) · Alt + тягни з останньої точки — нова ручка в інший бік · клік у точку 1 (біля пера ○) — замкнути · Enter — завершити відкриту лінію · Ctrl+Z — скасувати останню точку.',
    M: 'Прямокутник: натисни й тягни. Shift — квадрат, Alt — від центру.',
    L: 'Еліпс: натисни й тягни. Shift — коло, Alt — від центру.',
    SB: 'Shape Builder: спершу виділи фігури чорною стрілкою. Протягни через ділянки — об’єднати, Alt + клік по ділянці — видалити.'
  };

  const svgEl = (tag, attrs, parent) => {
    const e = document.createElementNS(NS, tag);
    if (attrs) for (const k in attrs) if (attrs[k] != null) e.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(e);
    return e;
  };
  const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
  const mirror = (a, p) => ({ x: 2 * a.x - p.x, y: 2 * a.y - p.y });
  function constrain45(a, p) {
    const dx = p.x - a.x, dy = p.y - a.y;
    const ang = Math.round(Math.atan2(dy, dx) / (Math.PI / 4)) * (Math.PI / 4);
    const l = Math.hypot(dx, dy);
    return { x: a.x + Math.cos(ang) * l, y: a.y + Math.sin(ang) * l };
  }
  function isSmooth(a) {
    if (!a.i || !a.o) return false;
    const v1x = a.i.x - a.x, v1y = a.i.y - a.y, v2x = a.o.x - a.x, v2y = a.o.y - a.y;
    const l1 = Math.hypot(v1x, v1y), l2 = Math.hypot(v2x, v2y);
    if (!l1 || !l2) return false;
    return (v1x * v2x + v1y * v2y) / (l1 * l2) < -0.985;
  }
  const PEN_CURSOR = 'url("data:image/svg+xml,' + encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="26" height="26" viewBox="0 0 26 26"><path d="M2 2 L8 18 L13 13 L18 8 Z" fill="#fff" stroke="#000" stroke-width="1.4" stroke-linejoin="round"/><path d="M2 2 L10 10" stroke="#000" stroke-width="1.2"/><circle cx="10" cy="10" r="1.6" fill="#000"/><path d="M13 13 L22 22 M18 8 L24 14 L19 19" stroke="#000" stroke-width="1.4" fill="none"/></svg>'
  ) + '") 2 2, crosshair';

  function create(opts) {
    const life = opts.life;
    const h = K.h;
    let doc = C.unpackDoc(opts.doc ? C.packDoc(opts.doc) : null);
    let guide = opts.guide || null, showGuide = true;
    let locked = !!opts.locked;
    let tool = 'V';
    let sel = new Set();
    let style = { f: '#FFFFFF', s: '#1E1B18', w: 2 };
    let active = 'f';
    let history = [];
    let pen = { a: [], closed: false, hist: [] }, penMode = null, cursor = null;
    let drag = null, hover = null, dsA = null, preview = null;
    let sb = { R: null, key: '', hover: 0, shapes: {} };
    let alignTo = 'sel';
    let lastPen = null, clip = null, pasteN = 0;
    let keyMods = { shift: false, alt: false };

    /* ---------- DOM ---------- */
    const svg = svgEl('svg', { viewBox: `0 0 ${C.W} ${C.H}`, class: 'mai-svg', role: 'img', 'aria-label': 'Полотно для малювання' });
    svgEl('rect', { x: 0, y: 0, width: C.W, height: C.H, fill: '#fff', class: 'mai-board' }, svg);
    const gridG = svgEl('g', { class: 'mai-grid', 'pointer-events': 'none' }, svg);
    for (let x = 20; x < C.W; x += 20) svgEl('line', { x1: x, y1: 0, x2: x, y2: C.H, stroke: x % 100 ? '#F1EEE9' : '#E6E1D9', 'stroke-width': 1, 'vector-effect': 'non-scaling-stroke' }, gridG);
    for (let y = 20; y < C.H; y += 20) svgEl('line', { x1: 0, y1: y, x2: C.W, y2: y, stroke: y % 100 ? '#F1EEE9' : '#E6E1D9', 'stroke-width': 1, 'vector-effect': 'non-scaling-stroke' }, gridG);
    const ghostG = svgEl('g', { class: 'mai-ghost', 'pointer-events': 'none' }, svg);
    const artG = svgEl('g', { class: 'mai-art' }, svg);
    const guideG = svgEl('g', { class: 'mai-guide', 'pointer-events': 'none' }, svg);
    const overG = svgEl('g', { class: 'mai-over', 'pointer-events': 'none' }, svg);
    const hint = svgEl('text', { 'font-size': 14, 'font-weight': 800, fill: '#000', 'pointer-events': 'none' }, svg);

    const status = h('p', { class: 'mai-status', role: 'status', 'aria-live': 'polite' });
    const toolBtns = {};
    const toolsEl = h('div', { class: 'mai-tools', role: 'toolbar', 'aria-label': 'Інструменти' });
    TOOLS.forEach(t => {
      const b = h('button', { type: 'button', class: 'mai-tool', 'aria-label': `${t.name}, клавіша ${t.key}`, 'data-tool': t.id },
        h('i', { class: `mai-ic mai-ic-${t.id.toLowerCase()}`, 'aria-hidden': 'true' }),
        h('span', { class: 'mai-tip', 'aria-hidden': 'true' }, h('b', { text: t.name }), h('kbd', { text: t.key })));
      life.listen(b, 'click', () => setTool(t.id));
      toolBtns[t.id] = b; toolsEl.append(b);
    });
    toolsEl.append(h('div', { class: 'mai-sep' }));
    const undoBtn = h('button', { type: 'button', class: 'mai-tool', 'aria-label': 'Скасувати, Ctrl+Z' },
      h('i', { class: 'mai-ic mai-ic-undo', 'aria-hidden': 'true' }),
      h('span', { class: 'mai-tip', 'aria-hidden': 'true' }, h('b', { text: 'Скасувати' }), h('kbd', { text: 'Ctrl+Z' })));
    life.listen(undoBtn, 'click', () => undo());
    toolsEl.append(undoBtn);

    const stageEl = h('div', { class: 'mai-stage' }, svg);
    const editorEl = h('div', { class: 'mai-editor' }, toolsEl, h('div', { class: 'mai-stagewrap' }, stageEl, status));

    /* panels */
    const fillBox = h('button', { type: 'button', class: 'mai-fsbox mai-fill', title: 'Заливка (Fill) — клавіша X перемикає' });
    const strokeBox = h('button', { type: 'button', class: 'mai-fsbox mai-stroke', title: 'Обведення (Stroke) — клавіша X перемикає' });
    const fillLbl = h('span', { class: 'mai-fslbl' }), strokeLbl = h('span', { class: 'mai-fslbl' });
    life.listen(fillBox, 'click', () => { active = 'f'; renderPanels(); });
    life.listen(strokeBox, 'click', () => { active = 's'; renderPanels(); });
    const swatches = h('div', { class: 'mai-swatches', role: 'group', 'aria-label': 'Кольори' });
    const swBtns = [];
    [[null, 'без кольору']].concat(PALETTE).forEach(([c, name]) => {
      const b = h('button', { type: 'button', class: 'mai-sw' + (c ? '' : ' none'), title: name, 'aria-label': name, style: c ? `background:${c}` : '' });
      b.dataset.color = c || 'none';
      life.listen(b, 'click', () => applyColor(c));
      swBtns.push(b); swatches.append(b);
    });
    const widthSel = h('select', { class: 'mai-width', 'aria-label': 'Товщина обведення' }, WIDTHS.map(w => h('option', { value: w, text: w + ' pt' })));
    life.listen(widthSel, 'change', () => applyWidth(+widthSel.value));
    const swapBtn = h('button', { type: 'button', class: 'btn small', title: 'Поміняти заливку й обведення (Shift+X)' }, '⇄ Поміняти');
    life.listen(swapBtn, 'click', () => swapFS());
    const colorPanel = h('section', { class: 'mai-panel' },
      h('h4', { text: 'Заливка й обведення' }),
      h('div', { class: 'mai-fsrow' },
        h('div', { class: 'mai-fspair' }, fillBox, fillLbl), h('div', { class: 'mai-fspair' }, strokeBox, strokeLbl)),
      swatches,
      h('div', { class: 'mai-row' }, h('label', { class: 'mai-wlbl' }, 'Товщина ', widthSel), swapBtn));

    const pfDefs = [
      ['unite', 'Unite', 'об’єднати', '<path d="M3 3h10v6h6v10H9v-6H3z" fill="currentColor"/>'],
      ['minus', 'Minus Front', 'відняти верхню', '<path d="M3 3h10v6H9v4H3z" fill="currentColor"/><path d="M9 9h10v10H9z" fill="none" stroke="currentColor" stroke-dasharray="2 2"/>'],
      ['intersect', 'Intersect', 'перетин', '<path d="M3 3h10v10H3z M9 9h10v10H9z" fill="none" stroke="currentColor" stroke-dasharray="2 2"/><path d="M9 9h4v4H9z" fill="currentColor"/>'],
      ['exclude', 'Exclude', 'виключити спільне', '<path d="M3 3h10v6H9v4H3z M13 9h6v10H9v-6h4z" fill="currentColor"/>']
    ];
    const pfPanel = h('section', { class: 'mai-panel' }, h('h4', { text: 'Pathfinder' }),
      h('div', { class: 'mai-btngrid' }, pfDefs.map(([op, en, ua, ic]) => {
        const b = h('button', { type: 'button', class: 'mai-pbtn', title: `${en} — ${ua}`, 'data-pf': op });
        b.innerHTML = `<svg viewBox="0 0 22 22" width="22" height="22" aria-hidden="true">${ic}</svg><span><b>${en}</b><small>${ua}</small></span>`;
        life.listen(b, 'click', () => doPathfinder(op));
        return b;
      })));
    const alDefs = [
      ['left', 'По лівому краю', '<path d="M3 2v18" stroke="currentColor" stroke-width="2"/><rect x="5" y="4" width="12" height="5" fill="currentColor"/><rect x="5" y="12" width="7" height="5" fill="currentColor"/>'],
      ['hcenter', 'По центру (горизонтально)', '<path d="M11 2v18" stroke="currentColor" stroke-width="2"/><rect x="4" y="4" width="14" height="5" fill="currentColor"/><rect x="7" y="12" width="8" height="5" fill="currentColor"/>'],
      ['right', 'По правому краю', '<path d="M19 2v18" stroke="currentColor" stroke-width="2"/><rect x="5" y="4" width="12" height="5" fill="currentColor"/><rect x="10" y="12" width="7" height="5" fill="currentColor"/>'],
      ['top', 'По верхньому краю', '<path d="M2 3h18" stroke="currentColor" stroke-width="2"/><rect x="4" y="5" width="5" height="12" fill="currentColor"/><rect x="12" y="5" width="5" height="7" fill="currentColor"/>'],
      ['vcenter', 'По центру (вертикально)', '<path d="M2 11h18" stroke="currentColor" stroke-width="2"/><rect x="4" y="4" width="5" height="14" fill="currentColor"/><rect x="12" y="7" width="5" height="8" fill="currentColor"/>'],
      ['bottom', 'По нижньому краю', '<path d="M2 19h18" stroke="currentColor" stroke-width="2"/><rect x="4" y="5" width="5" height="12" fill="currentColor"/><rect x="12" y="10" width="5" height="7" fill="currentColor"/>'],
      ['disth', 'Розподілити по горизонталі', '<rect x="2" y="7" width="4" height="8" fill="currentColor"/><rect x="9" y="7" width="4" height="8" fill="currentColor"/><rect x="16" y="7" width="4" height="8" fill="currentColor"/><path d="M4 4v14 M11 4v14 M18 4v14" stroke="currentColor" stroke-width="1"/>'],
      ['distv', 'Розподілити по вертикалі', '<rect x="7" y="2" width="8" height="4" fill="currentColor"/><rect x="7" y="9" width="8" height="4" fill="currentColor"/><rect x="7" y="16" width="8" height="4" fill="currentColor"/><path d="M4 4h14 M4 11h14 M4 18h14" stroke="currentColor" stroke-width="1"/>']
    ];
    const alignToSel = h('select', { class: 'mai-alignto', 'aria-label': 'Вирівняти відносно' },
      h('option', { value: 'sel', text: 'до виділення' }), h('option', { value: 'art', text: 'до монтажної області' }));
    life.listen(alignToSel, 'change', () => { alignTo = alignToSel.value; });
    const alPanel = h('section', { class: 'mai-panel' }, h('h4', { text: 'Вирівнювання (Align)' }),
      h('div', { class: 'mai-aligngrid' }, alDefs.map(([op, title, ic]) => {
        const b = h('button', { type: 'button', class: 'mai-abtn', title, 'aria-label': title, 'data-align': op });
        b.innerHTML = `<svg viewBox="0 0 22 22" width="22" height="22" aria-hidden="true">${ic}</svg>`;
        life.listen(b, 'click', () => doAlign(op));
        return b;
      })),
      h('label', { class: 'mai-wlbl' }, 'Вирівняти ', alignToSel));
    const objBtn = (label, title, fn, attr) => { const b = h('button', { type: 'button', class: 'btn small', title, 'data-obj': attr }, label); life.listen(b, 'click', fn); return b; };
    const objPanel = h('section', { class: 'mai-panel' }, h('h4', { text: 'Об’єкт' }),
      h('div', { class: 'mai-row mai-wrap' },
        objBtn('Згрупувати', 'Ctrl+G', () => doGroup(), 'group'),
        objBtn('Розгрупувати', 'Shift+Ctrl+G', () => doUngroup(), 'ungroup'),
        objBtn('⬆ Наперед', 'На передній план (Shift+Ctrl+])', () => doArrange('front'), 'front'),
        objBtn('⬇ Назад', 'На задній план (Shift+Ctrl+[)', () => doArrange('back'), 'back'),
        objBtn('🗑 Видалити', 'Delete', () => doDelete(), 'delete')));
    const panelsEl = h('div', { class: 'mai-panels' }, colorPanel, pfPanel, alPanel, objPanel);

    /* ---------- helpers ---------- */
    const byId = id => doc.objs.find(o => o.id === id);
    const idxOf = id => doc.objs.findIndex(o => o.id === id);
    const k = () => { const m = svg.getScreenCTM(); return m && m.a ? 1 / m.a : 1; };
    function svgPoint(e) {
      const m = svg.getScreenCTM();
      if (!m) return { x: 0, y: 0 };
      const p = svg.createSVGPoint(); p.x = e.clientX; p.y = e.clientY;
      const r = p.matrixTransform(m.inverse());
      return { x: r.x, y: r.y };
    }
    const mods = e => ({ shift: !!(e && e.shiftKey) || keyMods.shift, alt: !!(e && e.altKey) || keyMods.alt });
    const groupOf = id => { const o = byId(id); return o && o.g ? doc.objs.filter(x => x.g === o.g).map(x => x.id) : [id]; };
    const selObjs = () => doc.objs.filter(o => sel.has(o.id));
    const newId = () => 'o' + (doc.n++);
    function say(msg) { status.textContent = msg; }
    function toolHelp() { say(TOOL_HELP[tool]); }
    function pushHistory() { history.push(JSON.stringify(C.packDoc(doc))); if (history.length > 80) history.shift(); }
    function changed(kind) {
      sb.R = null; sb.shapes = {};
      sel = new Set([...sel].filter(id => byId(id)));
      renderArt(); renderOver(); renderPanels();
      if (opts.onChange) opts.onChange(doc, kind);
    }
    function tooMany() {
      if (doc.objs.length >= MAX_OBJS) { say(`На полотні вже ${MAX_OBJS} об’єктів — це максимум. Видали зайве.`); return true; }
      return false;
    }

    /* ---------- rendering ---------- */
    function renderArt() {
      while (artG.firstChild) artG.firstChild.remove();
      const hitW = Math.max(10 * k(), 6);
      for (const o of doc.objs) {
        const g = svgEl('g', { 'data-oid': o.id }, artG);
        const d = C.toD(o);
        svgEl('path', { d, fill: o.f || 'none', 'fill-rule': 'evenodd', stroke: o.s || 'none', 'stroke-width': o.s ? o.w : 0, 'stroke-miterlimit': 10 }, g);
        svgEl('path', { d, fill: 'none', stroke: 'transparent', 'stroke-width': Math.max(hitW, (o.s ? o.w : 0) + 4), 'pointer-events': 'stroke' }, g);
      }
    }
    function drawOutline(o, opacity) {
      svgEl('path', { d: C.toD(o), fill: 'none', stroke: BLUE, 'stroke-width': 1.3, 'vector-effect': 'non-scaling-stroke', opacity: opacity == null ? 1 : opacity }, overG);
    }
    function drawAnchors(o, selAnchor, showHandles) {
      const kk = k(), s = 7 * kk;
      o.sp.forEach((sp, si) => {
        const n = sp.a.length;
        sp.a.forEach((a, ai) => {
          if (!showHandles) return;
          let vis = false;
          if (selAnchor && selAnchor.si === si) {
            const s0 = selAnchor.ai;
            vis = ai === s0 || ai === (s0 + 1) % n || ai === (s0 - 1 + n) % n;
          }
          if (!vis) return;
          for (const hh of [a.i, a.o]) {
            if (!hh) continue;
            svgEl('line', { x1: a.x, y1: a.y, x2: hh.x, y2: hh.y, stroke: BLUE, 'stroke-width': 1.2, 'vector-effect': 'non-scaling-stroke' }, overG);
            svgEl('circle', { cx: hh.x, cy: hh.y, r: 4 * kk, fill: BLUE }, overG);
          }
        });
        sp.a.forEach((a, ai) => {
          const on = selAnchor && selAnchor.si === si && selAnchor.ai === ai;
          svgEl('rect', { x: a.x - s / 2, y: a.y - s / 2, width: s, height: s, fill: on ? BLUE : '#fff', stroke: BLUE, 'stroke-width': 1.3, 'vector-effect': 'non-scaling-stroke' }, overG);
        });
      });
    }
    function renderOver() {
      while (overG.firstChild) overG.firstChild.remove();
      const kk = k();
      if (tool === 'V' || tool === 'SB' || tool === 'M' || tool === 'L') {
        const objs = selObjs();
        objs.forEach(o => drawOutline(o));
        if (objs.length && tool === 'V') {
          const b = C.bbox(objs);
          if (b) {
            svgEl('rect', { x: b.x, y: b.y, width: b.w, height: b.h, fill: 'none', stroke: BLUE, 'stroke-width': 1, 'vector-effect': 'non-scaling-stroke' }, overG);
            const s = 8 * kk;
            for (const [, x, y] of handlesOf(b))
              svgEl('rect', { x: x - s / 2, y: y - s / 2, width: s, height: s, fill: '#fff', stroke: BLUE, 'stroke-width': 1, 'vector-effect': 'non-scaling-stroke' }, overG);
          }
        }
        if (tool === 'V' && hover && !sel.has(hover) && !drag) { const o = byId(hover); if (o) drawOutline(o, 0.6); }
      }
      if (tool === 'A') {
        if (hover && !sel.has(hover)) { const o = byId(hover); if (o) { drawOutline(o, 0.7); drawAnchors(o, null, false); } }
        selObjs().forEach(o => { drawOutline(o); drawAnchors(o, dsA && dsA.oid === o.id ? dsA : null, true); });
      }
      if (tool === 'P') renderPen();
      if (preview) svgEl('path', { d: C.toD(preview), fill: preview.f || 'none', 'fill-opacity': 0.6, stroke: BLUE, 'stroke-width': 1.3, 'vector-effect': 'non-scaling-stroke' }, overG);
      if (drag && drag.type === 'marquee') {
        const x = Math.min(drag.start.x, drag.cur.x), y = Math.min(drag.start.y, drag.cur.y);
        svgEl('rect', { x, y, width: Math.abs(drag.cur.x - drag.start.x), height: Math.abs(drag.cur.y - drag.start.y), fill: 'rgba(47,125,246,.08)', stroke: BLUE, 'stroke-dasharray': '4 3', 'stroke-width': 1, 'vector-effect': 'non-scaling-stroke' }, overG);
      }
      if (tool === 'SB' && sb.R) {
        const ids = drag && drag.type === 'sb' ? drag.ids : (sb.hover ? [sb.hover] : []);
        const del = drag ? false : mods(null).alt;
        for (const id of ids) {
          const sp = regionSp(id);
          if (!sp.length) continue;
          svgEl('path', { d: C.toD({ sp }), fill: del ? 'rgba(217,58,58,.35)' : 'rgba(47,125,246,.28)', 'fill-rule': 'evenodd', stroke: del ? '#D93A3A' : BLUE, 'stroke-width': 2, 'stroke-dasharray': '5 3', 'vector-effect': 'non-scaling-stroke' }, overG);
        }
      }
      // cursor glyph for the pen
      let sym = '';
      if (tool === 'P' && cursor && !penMode && !locked) {
        const A = pen.a;
        if (!A.length) sym = '×';
        else if (A.length >= 2 && near(A[0], cursor)) sym = '○';
        else if (mods(null).alt && near(A[A.length - 1], cursor)) sym = '^';
      }
      if (tool === 'SB' && cursor && !locked) sym = mods(null).alt ? '−' : '+';
      hint.textContent = sym;
      if (sym && cursor) { hint.setAttribute('x', cursor.x + 14 * kk); hint.setAttribute('y', cursor.y + 22 * kk); hint.setAttribute('font-size', 15 * kk); }
    }
    function near(a, p) { return a && p && dist(a, p) < 9 * k(); }
    function renderPen() {
      const A = pen.a, n = A.length;
      if (!n) return;
      const P = { sp: [{ a: A, c: pen.closed }] };
      svgEl('path', { d: C.toD(P), fill: style.f && n > 2 ? style.f : 'none', 'fill-opacity': 0.55, stroke: style.s || BLUE, 'stroke-width': style.s ? style.w : 0, 'stroke-opacity': 0.8 }, overG);
      drawOutline(P);
      if (cursor && !penMode && !pen.closed) {
        const last = A[n - 1];
        let c = cursor;
        const closing = n >= 2 && near(A[0], c);
        if (closing) c = A[0];
        const c2 = closing && A[0].i ? A[0].i : c;
        const d = last.o ? `M${last.x},${last.y} C${last.o.x},${last.o.y} ${c2.x},${c2.y} ${c.x},${c.y}` : `M${last.x},${last.y} L${c.x},${c.y}`;
        svgEl('path', { d, fill: 'none', stroke: BLUE, 'stroke-width': 1.2, 'stroke-dasharray': '4 4', 'vector-effect': 'non-scaling-stroke' }, overG);
      }
      const kk = k(), s = 7 * kk;
      A.forEach((a, i) => {
        if (i >= n - 2) for (const hh of [a.i, a.o]) {
          if (!hh) continue;
          svgEl('line', { x1: a.x, y1: a.y, x2: hh.x, y2: hh.y, stroke: BLUE, 'stroke-width': 1.2, 'vector-effect': 'non-scaling-stroke' }, overG);
          svgEl('circle', { cx: hh.x, cy: hh.y, r: 4 * kk, fill: BLUE }, overG);
        }
        svgEl('rect', { x: a.x - s / 2, y: a.y - s / 2, width: s, height: s, fill: i === n - 1 ? BLUE : '#fff', stroke: BLUE, 'stroke-width': 1.3, 'vector-effect': 'non-scaling-stroke' }, overG);
      });
    }
    function renderGuide() {
      while (guideG.firstChild) guideG.firstChild.remove();
      while (ghostG.firstChild) ghostG.firstChild.remove();
      if (!guide || !showGuide) return;
      /* half-transparent sample UNDER the drawing: students trace over it */
      (guide.ghostObjs || []).forEach(o => svgEl('path', { d: o.d, fill: o.f || 'none', 'fill-rule': 'evenodd', stroke: o.s || 'none', 'stroke-width': o.s ? o.w : 0, 'stroke-miterlimit': 10, opacity: 0.32 }, ghostG));
      (guide.ghost || []).forEach(o => svgEl('path', { d: o.d, fill: o.f || '#999', 'fill-rule': 'evenodd', opacity: 0.16 }, guideG));
      (guide.paths || []).forEach(o => {
        if (o.bad) svgEl('path', { d: o.d, fill: 'none', stroke: '#D93A3A', 'stroke-width': 3, 'stroke-dasharray': '3 6', 'stroke-linecap': 'round', 'vector-effect': 'non-scaling-stroke', opacity: 0.85 }, guideG);
        else svgEl('path', { d: o.d, fill: 'none', stroke: o.c || '#FF7A00', 'stroke-width': 2, 'stroke-dasharray': o.solid ? null : '7 5', 'vector-effect': 'non-scaling-stroke', opacity: 0.9 }, guideG);
      });
      (guide.marks || []).forEach(m => {
        svgEl('path', { d: `M${m.x - 8},${m.y} H${m.x + 8} M${m.x},${m.y - 8} V${m.y + 8}`, stroke: '#FF7A00', 'stroke-width': 2, 'vector-effect': 'non-scaling-stroke' }, guideG);
        if (m.t) svgEl('text', { x: m.x + 10, y: m.y - 8, 'font-size': 13, fill: '#B54F00', 'font-weight': 700, 'paint-order': 'stroke', stroke: '#fff', 'stroke-width': 4 }, guideG).textContent = m.t;
      });
      /* drag arrows: purple line from the point, arrow head, hollow circle where to release the mouse.
         alt: true → dashed (Alt + тягни). */
      (guide.arrows || []).forEach(a => {
        const ang = Math.atan2(a.y2 - a.y, a.x2 - a.x), L = 11, R = 8;
        const ex = a.x2 - R * Math.cos(ang), ey = a.y2 - R * Math.sin(ang);
        svgEl('path', { d: `M${a.x},${a.y} L${ex},${ey}`, stroke: '#7A3FD1', 'stroke-width': 3, 'stroke-linecap': 'round', 'stroke-dasharray': a.alt ? '7 5' : null, fill: 'none' }, guideG);
        svgEl('path', { d: `M${ex},${ey} L${ex - L * Math.cos(ang - 0.5)},${ey - L * Math.sin(ang - 0.5)} L${ex - L * Math.cos(ang + 0.5)},${ey - L * Math.sin(ang + 0.5)} Z`, fill: '#7A3FD1' }, guideG);
        svgEl('circle', { cx: a.x2, cy: a.y2, r: R, fill: '#fff', 'fill-opacity': 0.6, stroke: '#7A3FD1', 'stroke-width': 2.5 }, guideG);
        if (a.t) {
          const tx = svgEl('text', { x: a.x2 + (a.tx || 6), y: a.y2 + (a.ty || 4), 'font-size': 14, fill: '#5B2AA6', 'font-weight': 800, 'paint-order': 'stroke', stroke: '#fff', 'stroke-width': 4 }, guideG);
          tx.textContent = a.t;
        }
      });
      (guide.labels || []).forEach(l => {
        const t = svgEl('text', { x: l.x, y: l.y, 'font-size': l.size || 14, 'font-weight': 700, fill: l.c || '#6E675F', 'text-anchor': l.anchor || 'start', 'paint-order': 'stroke', stroke: '#fff', 'stroke-width': 4 }, guideG);
        t.textContent = l.t;
      });
      (guide.points || []).forEach(p => {
        svgEl('circle', { cx: p.x, cy: p.y, r: 11, fill: '#FF7A00', stroke: '#fff', 'stroke-width': 2 }, guideG);
        const t = svgEl('text', { x: p.x, y: p.y + 5, 'text-anchor': 'middle', 'font-size': 14, 'font-weight': 800, fill: '#fff' }, guideG);
        t.textContent = p.n;
        if (p.alt) {   // purple «Alt» tag: Alt + клік по цій точці
          const bx = p.x + (p.ax == null ? 12 : p.ax), by = p.y + (p.ay == null ? 8 : p.ay);
          svgEl('rect', { x: bx, y: by, width: 30, height: 18, rx: 9, fill: '#7A3FD1', stroke: '#fff', 'stroke-width': 1.5 }, guideG);
          const at = svgEl('text', { x: bx + 15, y: by + 13, 'text-anchor': 'middle', 'font-size': 12, 'font-weight': 800, fill: '#fff' }, guideG);
          at.textContent = 'Alt';
        }
        if (p.t) {
          const l = svgEl('text', { x: p.x + (p.tx || 14), y: p.y + (p.ty || -12), 'font-size': 13, 'font-weight': 700, fill: '#B54F00', 'paint-order': 'stroke', stroke: '#fff', 'stroke-width': 4 }, guideG);
          l.textContent = p.t;
        }
      });
    }
    function fsPreview(box, c) {
      if (box === strokeBox) { box.style.background = '#fff'; box.style.setProperty('--mai-s', c || 'transparent'); }
      else box.style.background = c || '#fff';
      box.classList.toggle('none', !c);
    }
    function renderPanels() {
      const objs = selObjs();
      const ref = objs[0];
      const f = ref ? ref.f : style.f, s = ref ? ref.s : style.s, w = ref ? ref.w : style.w;
      fsPreview(fillBox, f); fsPreview(strokeBox, s);
      fillBox.classList.toggle('on', active === 'f'); strokeBox.classList.toggle('on', active === 's');
      fillBox.setAttribute('aria-pressed', String(active === 'f')); strokeBox.setAttribute('aria-pressed', String(active === 's'));
      fillLbl.textContent = 'Заливка: ' + (f ? (COLOR_NAME[f] || f) : 'немає');
      strokeLbl.textContent = 'Обведення: ' + (s ? (COLOR_NAME[s] || s) + ', ' + w + ' pt' : 'немає');
      const cur = active === 'f' ? f : s;
      swBtns.forEach(b => b.classList.toggle('on', (b.dataset.color === 'none' ? null : b.dataset.color) === (cur || null)));
      widthSel.value = String(WIDTHS.includes(w) ? w : 2);
      Object.entries(toolBtns).forEach(([id, b]) => { b.classList.toggle('on', id === tool); b.setAttribute('aria-pressed', String(id === tool)); });
      const dis = locked;
      panelsEl.querySelectorAll('button, select').forEach(b => { b.disabled = dis; });
      toolsEl.querySelectorAll('button').forEach(b => { b.disabled = dis; });
      svg.style.cursor = locked ? 'default' : tool === 'P' ? PEN_CURSOR : (tool === 'M' || tool === 'L') ? 'crosshair' : 'default';
    }
    function renderAll() { renderArt(); renderGuide(); renderOver(); renderPanels(); }

    /* ---------- tools ---------- */
    function setTool(t) {
      if (locked) return;
      if (tool === 'P' && t !== 'P') commitPen();
      tool = t; drag = null; preview = null; dsA = null; sb.hover = 0;
      if (t === 'SB') ensureRegions(true);
      if (t === 'P' || t === 'M' || t === 'L') { sel.clear(); dsA = null; }
      toolHelp(); renderOver(); renderPanels();
    }
    function commitPen() {
      const A = pen.a;
      if (A.length >= 2 && !tooMany()) {
        pushHistory();
        const o = { id: newId(), sp: [{ a: A.map(a => ({ x: a.x, y: a.y, i: a.i, o: a.o })), c: pen.closed }], f: style.f, s: style.s, w: style.w, g: null, k: 'pen' };
        doc.objs.push(o); doc.ops.pen++;
        sel = new Set([o.id]);
        // remember how to reopen: Ctrl+Z right after closing / finishing undoes only that last step
        lastPen = { oid: o.id, histLen: history.length,
          resume: pen.closed && pen.hist.length ? pen.hist[pen.hist.length - 1] : JSON.stringify({ a: pen.a, closed: false }),
          hist: pen.closed ? pen.hist.slice(0, -1) : pen.hist.slice() };
        pen = { a: [], closed: false, hist: [] };
        changed('pen');
        return;
      }
      pen = { a: [], closed: false, hist: [] };
      renderOver();
    }
    function penSnap() { pen.hist.push(JSON.stringify({ a: pen.a, closed: pen.closed })); }
    function ensureRegions(announce) {
      const objs = selObjs().filter(C.isClosed);
      if (!objs.length) { sb.R = null; if (announce) say('Shape Builder: спершу виділи фігури чорною стрілкою (V) — рамкою або Shift + клік.'); return null; }
      const key = objs.map(o => o.id).join(',') + '|' + history.length + '|' + doc.n;
      if (sb.R && sb.key === key) return sb.R;
      sb.R = C.buildRegions(objs); sb.R.cacheF = {}; sb.key = key; sb.shapes = {};
      if (announce) toolHelp();
      return sb.R;
    }
    function regionSp(id) {
      if (!sb.shapes[id]) sb.shapes[id] = C.regionShape(sb.R, [id]);
      return sb.shapes[id];
    }
    function commitSB(merge, del) {
      const R = sb.R;
      if (!R) return;
      pushHistory();
      const out = [];
      const styleOf = id => R.objs[R.regions[id].top];
      const mk = (sp, src, top) => ({ id: newId(), sp, f: src.f, s: src.s, w: src.w, g: null, k: 'sb', _top: top });
      if (merge.length) {
        const sp = C.regionShape(R, merge);
        if (sp.length) out.push(mk(sp, styleOf(merge[0]), Math.max(...merge.map(id => R.regions[id].top)) + 0.5));
      }
      R.regions.forEach((r, id) => {
        if (!r || r.tiny || merge.includes(id) || del.includes(id)) return;
        const sp = sb.shapes[id] || C.regionShape(R, [id]);
        if (sp.length) out.push(mk(sp, styleOf(id), r.top));
      });
      out.sort((a, b) => a._top - b._top);
      out.forEach(o => delete o._top);
      const ids = new Set(R.objs.map(o => o.id));
      const at = Math.max(...R.objs.map(o => idxOf(o.id)));
      const before = doc.objs.slice(0, at + 1).filter(o => !ids.has(o.id));
      const after = doc.objs.slice(at + 1);
      doc.objs = before.concat(out, after);
      doc.ops.sb++;
      sel = new Set(out.map(o => o.id));
      sb.R = null; sb.hover = 0;
      changed('sb');
      ensureRegions(false);
      renderOver();
      say(del.length ? 'Ділянку видалено. Можна продовжувати або перемкнутися на чорну стрілку (V).' : 'Ділянки об’єднано. Можна продовжувати або перемкнутися на чорну стрілку (V).');
    }
    function doPathfinder(op) {
      if (locked) return;
      if (tool === 'P') commitPen();
      const objs = selObjs().filter(C.isClosed);
      if (objs.length < 2) { say('Pathfinder: виділи чорною стрілкою щонайменше дві замкнені фігури.'); return; }
      const res = C.pathfinder(op, objs);
      if (!res || !res.sp.length) { say('Результат порожній: фігури не перетинаються. Спробуй іншу операцію.'); return; }
      pushHistory();
      const st = res.style;
      const o = { id: newId(), sp: res.sp, f: st.f, s: st.s, w: st.w, g: null, k: 'pf' };
      const ids = new Set(objs.map(x => x.id));
      const at = op === 'minus' ? Math.min(...objs.map(x => idxOf(x.id))) : Math.max(...objs.map(x => idxOf(x.id)));
      const list = [];
      doc.objs.forEach((x, i) => { if (i === at) list.push(o); if (!ids.has(x.id)) list.push(x); });
      doc.objs = list;
      doc.ops.pf++;
      sel = new Set([o.id]);
      changed('pf');
      say({ unite: 'Unite: фігури об’єднано в одну.', minus: 'Minus Front: верхні фігури вирізано з нижньої.', intersect: 'Intersect: залишилась лише спільна частина.', exclude: 'Exclude: спільну частину вирізано.' }[op]);
    }
    function units() {
      const map = new Map();
      for (const o of selObjs()) {
        const key = o.g || o.id;
        if (!map.has(key)) map.set(key, []);
        map.get(key).push(o);
      }
      return [...map.values()].map(objs => ({ objs, b: C.bbox(objs) })).filter(u => u.b);
    }
    function doAlign(op) {
      if (locked) return;
      const U = units();
      if (!U.length) { say('Вирівнювання: спершу виділи об’єкти.'); return; }
      pushHistory();
      if (op === 'disth' || op === 'distv') {
        if (U.length < 3) { history.pop(); say('Розподілити можна щонайменше три об’єкти (або групи).'); return; }
        const ax = op === 'disth' ? 'cx' : 'cy';
        U.sort((a, b) => a.b[ax] - b.b[ax]);
        const a0 = U[0].b[ax], a1 = U[U.length - 1].b[ax], step = (a1 - a0) / (U.length - 1);
        U.forEach((u, i) => { const d = a0 + step * i - u.b[ax]; u.objs.forEach(o => op === 'disth' ? C.translate(o, d, 0) : C.translate(o, 0, d)); });
      } else {
        const toArt = alignTo === 'art' || U.length === 1;
        const ref = toArt ? { x: 0, y: 0, x2: C.W, y2: C.H, cx: C.W / 2, cy: C.H / 2 } : C.bbox(U.flatMap(u => u.objs));
        U.forEach(u => {
          const b = u.b;
          let dx = 0, dy = 0;
          if (op === 'left') dx = ref.x - b.x;
          if (op === 'right') dx = ref.x2 - b.x2;
          if (op === 'hcenter') dx = ref.cx - b.cx;
          if (op === 'top') dy = ref.y - b.y;
          if (op === 'bottom') dy = ref.y2 - b.y2;
          if (op === 'vcenter') dy = ref.cy - b.cy;
          u.objs.forEach(o => C.translate(o, dx, dy));
        });
        if (U.length === 1 && alignTo !== 'art') say('Виділено один об’єкт — він вирівнюється до монтажної області.');
      }
      doc.ops.align++;
      changed('align');
    }
    function doGroup() {
      if (locked) return;
      const objs = selObjs();
      if (objs.length < 2) { say('Згрупувати: виділи щонайменше два об’єкти.'); return; }
      pushHistory();
      const gid = 'g' + (doc.n++);
      const top = Math.max(...objs.map(o => idxOf(o.id)));
      const rest = doc.objs.filter(o => !sel.has(o.id));
      const insertAt = doc.objs.slice(0, top + 1).filter(o => !sel.has(o.id)).length;
      objs.forEach(o => { o.g = gid; });
      rest.splice(insertAt, 0, ...objs);
      doc.objs = rest;
      doc.ops.group++;
      changed('group');
      say('Згруповано: тепер чорна стрілка виділяє все разом.');
    }
    function doUngroup() {
      if (locked) return;
      const objs = selObjs().filter(o => o.g);
      if (!objs.length) { say('Серед виділеного немає груп.'); return; }
      pushHistory();
      objs.forEach(o => { o.g = null; });
      changed('ungroup');
      say('Групу розібрано.');
    }
    function doArrange(where) {
      if (locked) return;
      const objs = selObjs();
      if (!objs.length) { say('Спершу виділи об’єкт.'); return; }
      pushHistory();
      const rest = doc.objs.filter(o => !sel.has(o.id));
      doc.objs = where === 'front' ? rest.concat(objs) : objs.concat(rest);
      changed('arrange');
    }
    function deleteAnchor() {
      const o = byId(dsA.oid), sp = o && o.sp[dsA.si];
      if (!sp || !sp.a[dsA.ai]) { dsA = null; return; }
      pushHistory();
      if (sp.a.length <= 2) o.sp.splice(dsA.si, 1);
      else sp.a.splice(dsA.ai, 1);
      if (!o.sp.length) { doc.objs = doc.objs.filter(x => x !== o); sel.delete(o.id); }
      dsA = null;
      changed('anchor');
      say('Точку видалено — сусідні точки з’єднано. Ctrl+Z поверне її.');
    }
    function deleteObjs() {
      if (!sel.size) return;
      pushHistory();
      doc.objs = doc.objs.filter(o => !sel.has(o.id));
      sel.clear(); dsA = null;
      changed('delete');
    }
    function copySel() {
      if (tool === 'P' && pen.a.length) return false;
      const objs = selObjs();
      if (!objs.length) return false;
      clip = objs.map(o => C.clone(o)); pasteN = 0;
      say(`Скопійовано: ${objs.length}. Ctrl+V — вставити.`);
      return true;
    }
    function paste() {
      if (locked) return;
      if (!clip || !clip.length) { say('Буфер порожній: спершу виділи об’єкт і натисни Ctrl+C.'); return; }
      if (tool === 'P') commitPen();
      if (doc.objs.length + clip.length > MAX_OBJS) { tooMany(); return; }
      pushHistory();
      pasteN++;
      const gmap = {};
      const copies = clip.map(o => {
        const c = C.translate(C.clone(o), 10 * pasteN, 10 * pasteN); c.id = newId();
        if (o.g) c.g = gmap[o.g] || (gmap[o.g] = 'g' + (doc.n++));
        return c;
      });
      doc.objs = doc.objs.concat(copies);
      sel = new Set(copies.map(c => c.id)); dsA = null;
      if (tool !== 'V' && tool !== 'A') { tool = 'V'; toolHelp(); }
      changed('paste');
      say(`Вставлено: ${copies.length}. Копія трохи зсунута — перетягни її чорною стрілкою.`);
    }
    function doDelete() {
      if (locked) return;
      if (tool === 'P' && pen.a.length) { penUndo(); return; }
      if (tool === 'A' && dsA) { deleteAnchor(); return; }
      if (!sel.size) return;
      pushHistory();
      doc.objs = doc.objs.filter(o => !sel.has(o.id));
      sel.clear(); dsA = null;
      changed('delete');
    }
    function applyColor(c) {
      if (locked) return;
      style[active] = c;
      const objs = selObjs();
      if (objs.length) {
        pushHistory();
        objs.forEach(o => { o[active] = c; if (active === 's' && c && !o.w) o.w = style.w || 2; });
        changed('color');
        say(`${active === 'f' ? 'Заливку' : 'Обведення'} змінено для виділеного (${objs.length}). Нові фігури теж будуть такими.`);
      } else { renderPanels(); say(`${active === 'f' ? 'Заливка' : 'Обведення'} для нових фігур: ${c ? COLOR_NAME[c] || c : 'без кольору'}.`); }
    }
    function applyWidth(w) {
      if (locked) return;
      style.w = w;
      const objs = selObjs();
      if (objs.length) {
        pushHistory();
        objs.forEach(o => { o.w = w; });
        changed('width');
        if (objs.some(o => !o.s)) say('Товщину змінено, але обведення вимкнене («без кольору»). Обери колір обведення, щоб його побачити.');
      } else renderPanels();
    }
    function swapFS() {
      if (locked) return;
      const objs = selObjs();
      [style.f, style.s] = [style.s, style.f];
      if (objs.length) { pushHistory(); objs.forEach(o => { [o.f, o.s] = [o.s, o.f]; if (o.s && !o.w) o.w = style.w; }); changed('color'); }
      else renderPanels();
    }
    function setDefault() {
      style = { f: '#FFFFFF', s: '#1E1B18', w: 1 };
      const objs = selObjs();
      if (objs.length) { pushHistory(); objs.forEach(o => { o.f = style.f; o.s = style.s; o.w = style.w; }); changed('color'); }
      else renderPanels();
    }
    function penUndo() {
      const s = pen.hist.pop();
      if (s) { const v = JSON.parse(s); pen.a = v.a; pen.closed = v.closed; renderOver(); }
      else { pen.a = []; renderOver(); }
    }
    function undo() {
      if (locked) return;
      if (tool === 'P' && pen.a.length) { penUndo(); return; }
      if (lastPen && history.length === lastPen.histLen && byId(lastPen.oid)) {
        const lp = lastPen; lastPen = null;
        doc = C.unpackDoc(JSON.parse(history.pop()));
        pen = { a: JSON.parse(lp.resume).a, closed: false, hist: lp.hist };
        tool = 'P'; sel.clear(); dsA = null;
        changed('undo');
        say('Останнє з’єднання скасовано — контур знову відкритий. Продовжуй малювати або замкни його ще раз.');
        return;
      }
      const s = history.pop();
      if (!s) { say('Більше нічого скасовувати.'); return; }
      doc = C.unpackDoc(JSON.parse(s));
      dsA = null;
      changed('undo');
    }
    function duplicateSel() {
      const objs = selObjs();
      if (doc.objs.length + objs.length > MAX_OBJS) { tooMany(); return false; }
      const gmap = {};
      const copies = objs.map(o => {
        const c = C.clone(o); c.id = newId();
        if (o.g) c.g = gmap[o.g] || (gmap[o.g] = 'g' + (doc.n++));
        return c;
      });
      doc.objs = doc.objs.concat(copies);
      sel = new Set(copies.map(c => c.id));
      return true;
    }

    /* ---------- pointer ---------- */
    const CURSOR = { nw: 'nwse-resize', se: 'nwse-resize', ne: 'nesw-resize', sw: 'nesw-resize', n: 'ns-resize', s: 'ns-resize', e: 'ew-resize', w: 'ew-resize' };
    function handlesOf(b) {
      return [['nw', b.x, b.y], ['ne', b.x2, b.y], ['se', b.x2, b.y2], ['sw', b.x, b.y2], ['n', b.cx, b.y], ['s', b.cx, b.y2], ['w', b.x, b.cy], ['e', b.x2, b.cy]];
    }
    function hitHandle(p) {
      const b = C.bbox(selObjs());
      if (!b) return null;
      const tol = 7 * k();
      for (const [name, x, y] of handlesOf(b)) {
        if ((name === 'n' || name === 's') && b.w < 1) continue;
        if ((name === 'e' || name === 'w') && b.h < 1) continue;
        if (Math.abs(p.x - x) <= tol && Math.abs(p.y - y) <= tol) return { name, box: b };
      }
      return null;
    }
    function objFromEvent(e) {
      const t = e.target && e.target.closest ? e.target.closest('[data-oid]') : null;
      return t && artG.contains(t) ? t.getAttribute('data-oid') : null;
    }
    function hitAnchor(p, objs) {
      const tol = 9 * k();
      // handles of the selected anchor neighbourhood first
      if (dsA) {
        const o = byId(dsA.oid);
        if (o && o.sp[dsA.si]) {
          const A = o.sp[dsA.si].a, n = A.length;
          for (const ai of [dsA.ai, (dsA.ai + 1) % n, (dsA.ai - 1 + n) % n]) {
            const a = A[ai];
            if (!a) continue;
            for (const w of ['i', 'o']) if (a[w] && dist(a[w], p) < tol) return { oid: o.id, si: dsA.si, ai, what: w };
          }
        }
      }
      let best = null, bd = tol;
      for (const o of objs) o.sp.forEach((sp, si) => sp.a.forEach((a, ai) => {
        const d = dist(a, p);
        if (d < bd) { bd = d; best = { oid: o.id, si, ai, what: 'anchor' }; }
      }));
      return best;
    }
    function onDown(e) {
      if (locked || e.button !== 0) return;
      try { (opts.focusTarget || svg).focus({ preventScroll: true }); } catch (_) {}
      const p = svgPoint(e), m = mods(e);
      e.preventDefault();
      cursor = p;
      if (tool === 'V') {
        const hh = sel.size ? hitHandle(p) : null;
        const hit = hh ? null : objFromEvent(e);
        if (hh) {
          pushHistory();
          drag = { type: 'scale', handle: hh.name, box: hh.box, start: p, orig: new Map(selObjs().map(o => [o.id, C.clone(o)])), moved: false };
        } else if (hit) {
          const grp = groupOf(hit);
          if (m.shift) {
            const all = grp.every(id => sel.has(id));
            grp.forEach(id => all ? sel.delete(id) : sel.add(id));
            renderOver(); renderPanels();
            if (all) return;                       // removed from the selection: nothing to drag
          } else if (!sel.has(hit)) sel = new Set(grp);
          pushHistory();
          let dup = false;
          if (m.alt) dup = duplicateSel();
          drag = { type: 'move', start: p, orig: new Map(selObjs().map(o => [o.id, C.clone(o)])), moved: dup, dup };
          if (dup) { renderArt(); say('Alt + тягни: створено копію.'); }
        } else {
          if (!m.shift) sel.clear();
          drag = { type: 'marquee', start: p, cur: p, base: new Set(sel) };
        }
      } else if (tool === 'A') {
        const hov = objFromEvent(e);
        const cands = selObjs().concat(hov && !sel.has(hov) ? [byId(hov)] : []).filter(Boolean);
        const hA = hitAnchor(p, cands);
        if (hA) {
          sel = new Set([hA.oid]);
          if (hA.what === 'anchor') dsA = { oid: hA.oid, si: hA.si, ai: hA.ai };
          pushHistory();
          const a = byId(hA.oid).sp[hA.si].a[hA.ai];
          drag = { type: hA.what === 'anchor' ? 'anchor' : 'handle', ref: hA, start: p, orig: C.clone(a), moved: false };
        } else if (hov) {
          sel = new Set([hov]); dsA = null;
          pushHistory();
          drag = { type: 'move', start: p, orig: new Map([[hov, C.clone(byId(hov))]]), moved: false };
        } else { sel.clear(); dsA = null; }
      } else if (tool === 'P') {
        const A = pen.a, last = A[A.length - 1], first = A[0];
        if (!A.length) sel.clear();
        penSnap();
        drag = { type: 'pen', start: p };
        if (last && m.alt && near(last, p)) { penMode = 'altLast'; drag.target = last; last.o = null; }
        else if (A.length >= 2 && near(first, p)) { penMode = 'close'; pen.closed = true; drag.target = first; drag.firstO = first.o ? { ...first.o } : null; }
        else {
          let q = p;
          if (last && m.shift) q = constrain45(last, p);
          const a = { x: q.x, y: q.y, i: null, o: null };
          A.push(a); penMode = 'new'; drag.target = a; drag.broken = null;
        }
      } else if (tool === 'M' || tool === 'L') {
        drag = { type: 'shape', start: p, cur: p };
      } else if (tool === 'SB') {
        const R = ensureRegions(true);
        if (!R) return;
        const id = C.regionAt(R, p.x, p.y);
        if (!id) { say('Тут немає ділянки виділених фігур. Клікай або тягни всередині фігур.'); return; }
        if (m.alt) { commitSB([], [id]); return; }
        drag = { type: 'sb', ids: [id] };
      }
      try { svg.setPointerCapture(e.pointerId); } catch (_) {}
      renderOver(); renderPanels();
    }
    function onMove(e) {
      const p = svgPoint(e), m = mods(e);
      cursor = p;
      keyMods = { shift: e.shiftKey, alt: e.altKey };
      if (locked) return;
      if (!drag) {
        if (tool === 'V') { const hh = sel.size ? hitHandle(p) : null; svg.style.cursor = hh ? CURSOR[hh.name] : 'default'; }
        if (tool === 'V' || tool === 'A') { const hv = objFromEvent(e); if (hv !== hover) { hover = hv; renderOver(); } else if (tool === 'A') renderOver(); return; }
        if (tool === 'SB' && sb.R) { const id = C.regionAt(sb.R, p.x, p.y); if (id !== sb.hover) sb.hover = id; renderOver(); return; }
        if (tool === 'P') renderOver();
        return;
      }
      if (drag.type === 'scale') {
        const b = drag.box, hn = drag.handle;
        const W = b.w > 0.5, Hh = b.h > 0.5;
        const ex = hn.includes('e') ? b.x2 : hn.includes('w') ? b.x : null;
        const ey = hn.includes('s') ? b.y2 : hn.includes('n') ? b.y : null;
        const fx = m.alt ? b.cx : (hn.includes('e') ? b.x : b.x2);
        const fy = m.alt ? b.cy : (hn.includes('s') ? b.y : b.y2);
        let sx = ex != null && W ? (p.x - fx) / (ex - fx) : 1;
        let sy = ey != null && Hh ? (p.y - fy) / (ey - fy) : 1;
        if (m.shift) {
          if (ex != null && ey != null) { const k2 = Math.abs(sx) > Math.abs(sy) ? sx : sy; sx = Math.sign(sx || 1) * Math.abs(k2); sy = Math.sign(sy || 1) * Math.abs(k2); }
          else if (ex != null) sy = Math.abs(sx);
          else sx = Math.abs(sy);
        }
        const lim = v => Math.abs(v) < 0.02 ? 0.02 * Math.sign(v || 1) : v;
        sx = lim(sx); sy = lim(sy);
        if (Math.abs(sx - 1) > 0.002 || Math.abs(sy - 1) > 0.002) drag.moved = true;
        const tr = q => ({ x: fx + (q.x - fx) * sx, y: fy + (q.y - fy) * sy });
        doc.objs = doc.objs.map(o => {
          if (!drag.orig.has(o.id)) return o;
          const c = C.clone(drag.orig.get(o.id));
          c.sp.forEach(sp => sp.a.forEach(a => { const q = tr(a); if (a.i) a.i = tr(a.i); if (a.o) a.o = tr(a.o); a.x = q.x; a.y = q.y; }));
          return c;
        });
        const nb = C.bbox(selObjs());
        if (nb) say(`Розмір: ${Math.round(nb.w)} × ${Math.round(nb.h)}. Shift — пропорційно, Alt — від центру.`);
        renderArt(); renderOver();
      } else if (drag.type === 'move') {
        let dx = p.x - drag.start.x, dy = p.y - drag.start.y;
        if (m.shift) { if (Math.abs(dx) > Math.abs(dy)) dy = 0; else dx = 0; }
        if (Math.hypot(dx, dy) > 0.5) drag.moved = true;
        doc.objs = doc.objs.map(o => drag.orig.has(o.id) ? C.translate(C.clone(drag.orig.get(o.id)), dx, dy) : o);
        renderArt(); renderOver();
      } else if (drag.type === 'marquee') {
        drag.cur = p;
        const x0 = Math.min(drag.start.x, p.x), x1 = Math.max(drag.start.x, p.x), y0 = Math.min(drag.start.y, p.y), y1 = Math.max(drag.start.y, p.y);
        const next = new Set(drag.base);
        if (x1 - x0 > 2 || y1 - y0 > 2) for (const o of doc.objs) {
          const b = C.bbox(o);
          if (b && b.x <= x1 && b.x2 >= x0 && b.y <= y1 && b.y2 >= y0) groupOf(o.id).forEach(id => next.add(id));
        }
        sel = next; renderOver();
      } else if (drag.type === 'anchor' || drag.type === 'handle') {
        const r = drag.ref, a = byId(r.oid).sp[r.si].a[r.ai], o = drag.orig;
        const dx = p.x - drag.start.x, dy = p.y - drag.start.y;
        if (Math.hypot(dx, dy) > 0.5) drag.moved = true;
        if (drag.type === 'anchor') {
          a.x = o.x + dx; a.y = o.y + dy;
          a.i = o.i ? { x: o.i.x + dx, y: o.i.y + dy } : null;
          a.o = o.o ? { x: o.o.x + dx, y: o.o.y + dy } : null;
        } else {
          const w = r.what, other = w === 'i' ? 'o' : 'i';
          a[w] = { x: p.x, y: p.y };
          if (o[other] && o[w] && !m.alt && isSmooth(o)) {
            const L = dist(o, o[other]);
            const vx = a.x - p.x, vy = a.y - p.y, vl = Math.hypot(vx, vy) || 1;
            a[other] = { x: a.x + vx / vl * L, y: a.y + vy / vl * L };
          }
        }
        renderArt(); renderOver();
      } else if (drag.type === 'pen') {
        const a = drag.target;
        const dragged = dist(drag.start, p) > 3 * k();
        let q = p;
        if (m.shift) q = constrain45(a, p);
        if (penMode === 'new' && dragged) {
          a.o = { x: q.x, y: q.y };
          if (m.alt) { if (!drag.broken) drag.broken = a.i ? { ...a.i } : mirror(a, q); a.i = drag.broken; }
          else { a.i = mirror(a, q); drag.broken = null; }
        } else if (penMode === 'altLast' && dragged) {
          a.o = { x: q.x, y: q.y };
        } else if (penMode === 'close' && dragged) {
          a.i = mirror(a, q);
          a.o = m.alt ? drag.firstO : { x: q.x, y: q.y };
        }
        renderOver();
      } else if (drag.type === 'shape') {
        drag.cur = p;
        preview = shapeFromDrag(drag.start, p, m);
        renderOver();
      } else if (drag.type === 'sb') {
        const id = C.regionAt(sb.R, p.x, p.y);
        if (id && !drag.ids.includes(id)) drag.ids.push(id);
        renderOver();
      }
    }
    function shapeFromDrag(s, p, m) {
      let w = p.x - s.x, hh = p.y - s.y;
      if (m.shift) { const v = Math.max(Math.abs(w), Math.abs(hh)); w = Math.sign(w || 1) * v; hh = Math.sign(hh || 1) * v; }
      let x0, y0, x1, y1;
      if (m.alt) { x0 = s.x - w; x1 = s.x + w; y0 = s.y - hh; y1 = s.y + hh; }
      else { x0 = s.x; x1 = s.x + w; y0 = s.y; y1 = s.y + hh; }
      const X = Math.min(x0, x1), Y = Math.min(y0, y1), Wd = Math.abs(x1 - x0), Hd = Math.abs(y1 - y0);
      const sp = tool === 'M' ? C.rectPath(X, Y, Wd, Hd) : C.ellipsePath(X + Wd / 2, Y + Hd / 2, Wd / 2, Hd / 2);
      return { sp: [sp], f: style.f, s: style.s, w: style.w, _w: Wd, _h: Hd };
    }
    function onUp(e) {
      try { svg.releasePointerCapture(e.pointerId); } catch (_) {}
      if (!drag || locked) { drag = null; return; }
      const d = drag; drag = null;
      if (d.type === 'move' || d.type === 'anchor' || d.type === 'handle' || d.type === 'scale') {
        if (!d.moved) { history.pop(); renderOver(); renderPanels(); }
        else changed(d.type === 'scale' ? 'scale' : d.dup ? 'duplicate' : 'move');
      } else if (d.type === 'marquee') { renderOver(); renderPanels(); }
      else if (d.type === 'pen') {
        penMode = null;
        if (pen.closed) commitPen(); else renderOver();
      } else if (d.type === 'shape') {
        const pv = preview; preview = null;
        if (!pv || pv._w < 2 || pv._h < 2) { say('Натисни кнопку миші й тягни, щоб намалювати фігуру.'); renderOver(); return; }
        if (tooMany()) { renderOver(); return; }
        pushHistory();
        const o = { id: newId(), sp: pv.sp, f: pv.f, s: pv.s, w: pv.w, g: null, k: tool === 'M' ? 'rect' : 'ellipse' };
        doc.objs.push(o);
        if (tool === 'M') doc.ops.rect++; else doc.ops.ell++;
        sel = new Set([o.id]);
        changed('shape');
      } else if (d.type === 'sb') commitSB(d.ids, []);
    }
    life.listen(svg, 'pointerdown', onDown);
    life.listen(svg, 'pointermove', onMove);
    life.listen(svg, 'pointerup', onUp);
    life.listen(svg, 'pointercancel', onUp);
    life.listen(svg, 'pointerleave', () => { if (!drag) { cursor = null; hover = null; sb.hover = 0; renderOver(); } });

    /* ---------- keyboard (scoped to the game root) ---------- */
    function onKey(e) {
      if (locked) return;
      const t = e.target;
      if (t && /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName)) return;
      if (t && t.tagName === 'BUTTON' && (e.key === 'Enter' || e.key === ' ')) return;
      keyMods = { shift: e.shiftKey, alt: e.altKey };
      const ctrl = e.ctrlKey || e.metaKey;
      const code = e.code;
      let used = true;
      if (e.key === 'Alt') { e.preventDefault(); renderOver(); return; }
      if (e.key === 'Shift') { renderOver(); return; }
      if (ctrl && code === 'KeyZ') undo();
      else if (ctrl && e.shiftKey && code === 'KeyG') doUngroup();
      else if (ctrl && code === 'KeyG') doGroup();
      else if (ctrl && e.shiftKey && code === 'BracketRight') doArrange('front');
      else if (ctrl && e.shiftKey && code === 'BracketLeft') doArrange('back');
      else if (ctrl && code === 'KeyC') used = copySel();
      else if (ctrl && code === 'KeyX') { used = copySel(); if (used) deleteObjs(); }
      else if (ctrl && code === 'KeyV') paste();
      else if (ctrl) used = false;
      else if (e.shiftKey && code === 'KeyM') setTool('SB');
      else if (e.shiftKey && code === 'KeyX') swapFS();
      else if (code === 'KeyV') setTool('V');
      else if (code === 'KeyA') setTool('A');
      else if (code === 'KeyP') setTool('P');
      else if (code === 'KeyM') setTool('M');
      else if (code === 'KeyL') setTool('L');
      else if (code === 'KeyX') { active = active === 'f' ? 's' : 'f'; renderPanels(); }
      else if (code === 'KeyD') setDefault();
      else if (e.key === 'Delete' || e.key === 'Backspace') doDelete();
      else if (e.key === 'Enter' || e.key === 'Escape') {
        if (tool === 'P' && pen.a.length) commitPen();
        else if (e.key === 'Escape') { sel.clear(); dsA = null; renderOver(); renderPanels(); }
        else used = false;
      } else if (e.key.startsWith('Arrow') && sel.size && (tool === 'V' || tool === 'A')) {
        const st = e.shiftKey ? 10 : 1;
        const dx = e.key === 'ArrowLeft' ? -st : e.key === 'ArrowRight' ? st : 0;
        const dy = e.key === 'ArrowUp' ? -st : e.key === 'ArrowDown' ? st : 0;
        pushHistory();
        selObjs().forEach(o => C.translate(o, dx, dy));
        changed('move');
      } else used = false;
      if (used) e.preventDefault();
    }
    function onKeyUp(e) {
      keyMods = { shift: e.shiftKey, alt: e.altKey };
      if (e.key === 'Alt') e.preventDefault();
      if (!locked) renderOver();
    }
    if (opts.keyTarget) { life.listen(opts.keyTarget, 'keydown', onKey); life.listen(opts.keyTarget, 'keyup', onKeyUp); }

    renderAll(); toolHelp();
    if (locked) say('Режим перегляду: малюнок не можна змінювати.');

    return {
      editorEl, panelsEl, svg,
      getDoc: () => doc,
      setDoc(d, g) {
        if (tool === 'P') pen = { a: [], closed: false, hist: [] };
        doc = C.unpackDoc(C.packDoc(d)); guide = g || null; history = []; lastPen = null; pasteN = 0; sel = new Set(); dsA = null; drag = null; preview = null; sb.R = null;
        renderAll(); if (!locked) toolHelp();
      },
      setGuideVisible(v) { showGuide = v; renderGuide(); },
      setLocked(v) { locked = !!v; if (locked) { pen = { a: [], closed: false, hist: [] }; drag = null; } renderAll(); if (locked) say('Режим перегляду: малюнок не можна змінювати.'); else toolHelp(); },
      finishPen() { if (tool === 'P' && pen.a.length) commitPen(); },
      redraw() { renderArt(); renderOver(); },
      setTool, palette: PALETTE, colorName: c => COLOR_NAME[c] || c
    };
  }
  window.MiniAIEditor = { create, PALETTE };
})();
