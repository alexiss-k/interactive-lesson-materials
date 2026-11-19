/* HTML · Урок 2 — практика.
   Ігри: «html2-sort» (правильний атрибут чи помилка), «html2-lab» (рівні: блоки, пропуски в коді, виправлення помилок),
   «html2-editor» (підсумкова сторінка з нуля). Потрібен html-core.js (window.HtmlCore). */
(function () {
  'use strict';
  const App = window.App || {};
  const HC = window.HtmlCore;
  window.Games = window.Games || {};

  /* ---------------------------------------------------------------- Утиліти */
  function h(tag, props, ...kids) {
    const el = document.createElement(tag);
    if (props) for (const k in props) {
      const v = props[k];
      if (v == null || v === false) continue;
      if (k === 'class') el.className = v;
      else if (k === 'text') el.textContent = v;
      else if (k === 'html') el.innerHTML = v;
      else if (k === 'style') el.style.cssText = v;
      else if (k.slice(0, 2) === 'on' && typeof v === 'function') el.addEventListener(k.slice(2), v);
      else el.setAttribute(k, v === true ? '' : v);
    }
    for (const c of kids.flat()) { if (c == null || c === false) continue; el.append(c.nodeType ? c : String(c)); }
    return el;
  }
  const escH = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const labelHtml = s => escH(s).replace(/&lt;(\/?[!\w]+(?:(?!&gt;|&lt;).)*?)&gt;/g, '<code>&lt;$1&gt;</code>');
  const seedOf = ctx => (ctx.student ? (ctx.student.name || '') + '|' + (ctx.student.cls || '') : 'x');
  const safe = f => { try { return f(); } catch (e) { return false; } };
  function debounce(fn, ms) {
    let t = null;
    const d = (...a) => { clearTimeout(t); t = setTimeout(() => { t = null; fn(...a); }, ms); };
    d.flush = (...a) => { clearTimeout(t); t = null; fn(...a); };
    d.pending = () => t !== null;
    d.cancel = () => { clearTimeout(t); t = null; };
    return d;
  }
  const toast = (ctx, msg, kind) => { try { (ctx.toast || App.toast || (() => {}))(msg, kind); } catch (e) {} };

  /* Модальне підтвердження: платформне, якщо є, інакше власне */
  function confirmBox(o) {
    if (typeof App.confirmBox === 'function') return App.confirmBox(o);
    return new Promise(res => {
      const ok = h('button', { class: 'btn primary' + (o.danger ? ' danger' : '') }, o.ok || 'Так');
      const no = h('button', { class: 'btn' }, o.cancel || 'Скасувати');
      const box = h('div', { class: 'h2-modal' }, h('div', { class: 'h2-modal-card', role: 'dialog', 'aria-modal': 'true' },
        h('h3', { text: o.title || 'Підтвердження' }), h('div', { html: o.html || '' }), h('div', { class: 'h2-modal-btns' }, no, ok)));
      const close = v => { box.remove(); res(v); };
      ok.onclick = () => close(true); no.onclick = () => close(false);
      box.addEventListener('click', e => { if (e.target === box) close(false); });
      document.body.appendChild(box); ok.focus();
    });
  }

  /* Повернення на доопрацювання */
  function returnedNow(ctx, details) {
    const s = ctx.saved;
    return !!(s && !s.final && (s.returnCount || 0) > ((details && details.ack) || 0));
  }
  const returnBanner = () => h('div', { class: 'ret-banner' }, '↩ ', h('b', { text: 'Вчитель повернув роботу на доопрацювання.' }), ' Виправ помилки і здай ще раз.');
  const roBanner = () => h('div', { class: 'ret-banner ro' }, '👁 ', h('b', { text: 'Режим перегляду.' }), ' Змінювати роботу зараз не можна.');

  async function askSubmit(passed, total, failed) {
    if (passed === total) return true;
    const list = failed.length ? '<ul class="cf-list">' + failed.map(f => `<li>✗ ${labelHtml(f)}</li>`).join('') + '</ul>' : '';
    return confirmBox({
      title: 'Не всі вимоги виконано',
      html: `<p>Виконано <b>${passed} з ${total}</b>.</p>${list}<p>Ти впевнений(-а), що хочеш завершити як є? Після завершення змінити вже не можна.</p>`,
      ok: 'Так, завершити', cancel: 'Ні, ще попрацюю', danger: true
    });
  }

  /* Черга збережень: одна за одною, помилки не губляться */
  function saver(ctx) {
    let chain = Promise.resolve();
    return (score, details, final) => {
      const snap = JSON.parse(JSON.stringify(details));
      const req = chain.then(() => final ? ctx.finish(score, snap) : ctx.complete(score, snap, false));
      chain = req.catch(() => {});
      return req;
    };
  }

  /* Перетягування (pointer events: миша, тачпад, сенсорний екран) */
  function dragSource(el, opts) {
    el.addEventListener('pointerdown', e => {
      if (e.button !== 0 || (opts.enabled && !opts.enabled()) || e.target.closest('.x')) return;
      e.preventDefault();
      const sx = e.clientX, sy = e.clientY;
      let dragging = false, ghost = null;
      const move = ev => {
        if (!dragging) {
          if (Math.hypot(ev.clientX - sx, ev.clientY - sy) < 5) return;
          dragging = true;
          ghost = el.cloneNode(true);
          ghost.classList.add('drag-ghost');
          ghost.style.width = el.getBoundingClientRect().width + 'px';
          document.body.appendChild(ghost);
          document.body.classList.add('is-dragging');
          opts.start && opts.start();
        }
        ghost.style.left = (ev.clientX - 14) + 'px';
        ghost.style.top = (ev.clientY - 16) + 'px';
        opts.move && opts.move(ev.clientX, ev.clientY);
      };
      const up = ev => {
        document.removeEventListener('pointermove', move);
        document.removeEventListener('pointerup', up);
        document.removeEventListener('pointercancel', up);
        document.body.classList.remove('is-dragging');
        if (!dragging) { opts.click && opts.click(); return; }
        ghost.remove();
        opts.drop && opts.drop(ev.clientX, ev.clientY);
      };
      document.addEventListener('pointermove', move);
      document.addEventListener('pointerup', up);
      document.addEventListener('pointercancel', up);
    });
    el.tabIndex = 0;
    el.addEventListener('keydown', e => {
      if ((e.key === 'Enter' || e.key === ' ') && (!opts.enabled || opts.enabled())) { e.preventDefault(); opts.click && opts.click(); }
    });
  }
  const inside = (el, x, y) => { const r = el.getBoundingClientRect(); return x >= r.left && x <= r.right && y >= r.top && y <= r.bottom; };
  function chipCode(code) {
    const m = /^(\s*)([\s\S]*?)(\s*)$/.exec(code);
    const dots = s => s ? `<span class="sp">${'·'.repeat(s.length)}</span>` : '';
    return dots(m[1]) + HC.highlight(m[2]) + dots(m[3]);
  }

  /* ------------------------------------------------- Файли «папки сайту» */
  const CATALOG = [
    { path: 'images/garden.svg', label: 'Шкільний сад' },
    { path: 'images/books.svg', label: 'Книжковий клуб' },
    { path: 'images/robot.svg', label: 'Робототехніка' },
    { path: 'images/music.svg', label: 'Музика й хор' },
    { path: 'images/sport.svg', label: 'Спорт' },
    { path: 'images/mountains.svg', label: 'Карпати' }
  ];
  const DEFAULT_FILES = Object.fromEntries(CATALOG.map(c => [c.path, c.path]));
  const normPath = p => String(p == null ? '' : p).trim().replace(/^\.\//, '');

  /* ----------------------------------------- Перевірка атрибутів (лінтер) */
  const GLOBAL_ATTRS = new Set(['id', 'class', 'lang', 'title', 'style', 'dir', 'hidden']);
  const TAG_ATTRS = {
    a: ['href', 'target', 'rel', 'download'], img: ['src', 'alt', 'width', 'height', 'loading'],
    ol: ['type', 'start', 'reversed'], ul: [], meta: ['charset', 'name', 'content'], html: [], li: ['value'],
    p: [], h1: [], h2: [], h3: [], h4: [], h5: [], h6: [], body: [], head: [], title: [], b: []
  };
  function lintAttrs(src) {
    const out = [];
    const ids = {};
    const lineAt = i => src.slice(0, i).split('\n').length;
    const re = /<\/?[a-zA-Z][^<>]*>/g;
    let m;
    while ((m = re.exec(src))) {
      const t = m[0], line = lineAt(m.index);
      const nm = /^<(\/?)\s*([a-zA-Z][\w-]*)/.exec(t);
      if (!nm) continue;
      const tag = nm[2].toLowerCase();
      const body = t.slice(nm[0].length, -1);
      if (nm[1]) { if (body.trim()) out.push({ line, msg: `Атрибути пишуть лише у відкривальному тегу — у </${tag}> їх бути не може` }); continue; }
      const curly = /[“”„«»]/.test(body);
      if (curly) out.push({ line, msg: 'Використовуй прямі лапки " " — не “ ” і не « »' });
      const names = [];
      let i = 0, hadSpace = true;
      while (i < body.length) {
        if (/\s/.test(body[i])) { hadSpace = true; i++; continue; }
        if (body[i] === '/') { i++; continue; }
        let j = i;
        while (j < body.length && !/[\s="'>]/.test(body[j])) j++;
        const name = body.slice(i, j);
        if (!name) {
          const q = body[i];
          const k = body.indexOf(q, i + 1);
          out.push({ line, msg: 'Зайве значення в лапках без назви атрибута — перевір запис name="value"' });
          i = k < 0 ? body.length : k + 1; hadSpace = false; continue;
        }
        if (!hadSpace && names.length) out.push({ line, msg: `Між атрибутами потрібен пробіл (перед «${name}»)` });
        const low = name.toLowerCase();
        names.push(low);
        i = j;
        while (i < body.length && /\s/.test(body[i])) i++;
        let value = null, sawEq = false;
        if (body[i] === '=') {
          sawEq = true; i++;
          while (i < body.length && /\s/.test(body[i])) i++;
          const q = body[i];
          if (q === '"' || q === "'") {
            const k = body.indexOf(q, i + 1);
            if (k < 0) { out.push({ line, msg: `Незакрита лапка в атрибуті ${low}` }); value = body.slice(i + 1); i = body.length; }
            else { value = body.slice(i + 1, k); i = k + 1; }
          } else {
            let k = i;
            while (k < body.length && !/\s/.test(body[k])) k++;
            value = body.slice(i, k); i = k;
            if (!curly && value) out.push({ line, msg: `Значення атрибута бери в лапки: ${low}="${value}"` });
            if (!value) out.push({ line, msg: `Після «${low}=» бракує значення в лапках` });
          }
        } else if (body[i] === '"' || body[i] === "'") {
          out.push({ line, msg: `Між назвою атрибута ${low} і значенням потрібен знак =` });
          const q = body[i], k = body.indexOf(q, i + 1);
          value = k < 0 ? body.slice(i + 1) : body.slice(i + 1, k);
          i = k < 0 ? body.length : k + 1;
        }
        hadSpace = false;
        const clean = value == null ? '' : value.replace(/[“”„«»]/g, '');
        if (tag === 'a' && low === 'src') out.push({ line, msg: 'У <a> адресу задає href, а не src' });
        else if (tag === 'img' && low === 'href') out.push({ line, msg: 'У <img> файл задає src, а не href' });
        else if (TAG_ATTRS[tag] && !GLOBAL_ATTRS.has(low) && !TAG_ATTRS[tag].includes(low) && !/^(data-|aria-)/.test(low))
          out.push({ line, msg: `Невідомий атрибут «${name}» для <${tag}> — перевір написання` });
        if ((low === 'width' || low === 'height') && value != null && !/^\d+$/.test(clean.trim())) out.push({ line, msg: `${low} — ціле число без px: ${low}="300"` });
        if (low === 'id' && value != null) {
          if (!clean.trim()) out.push({ line, msg: 'id не може бути порожнім' });
          else if (clean.startsWith('#')) out.push({ line, msg: 'У значенні id не пишуть # — решітка лише в href="#…"' });
          else if (/\s/.test(clean)) out.push({ line, msg: `id="${clean}" містить пробіл — id пишуть одним словом, напр. my-section` });
          (ids[clean] = ids[clean] || []).push(line);
        }
        if ((low === 'src' || low === 'href') && /^[a-zA-Z]:\\|\\/.test(clean)) out.push({ line, msg: 'Шлях із «\\» або C:\\ працює лише на твоєму комп’ютері — пиши шлях від HTML-файлу через «/»' });
        if (low === 'target' && clean && clean !== '_blank' && clean !== '_self') out.push({ line, msg: `target="${clean}" — для нової вкладки пишуть target="_blank" (з підкресленням)` });
        if (!sawEq && value == null && ['href', 'src', 'width', 'height', 'id', 'type', 'lang', 'target'].includes(low)) out.push({ line, msg: `Атрибут ${low} без значення — допиши ${low}="…"` });
      }
      const seen = new Set();
      for (const n of names) { if (seen.has(n)) out.push({ line, msg: `Атрибут ${n} повторюється в одному тегу` }); seen.add(n); }
    }
    for (const id in ids) if (id && ids[id].length > 1) ids[id].slice(1).forEach(line => out.push({ line, msg: `id="${id}" уже є на сторінці (рядок ${ids[id][0]}) — id має бути унікальним` }));
    return out;
  }
  /* Аналіз коду + загальний список помилок */
  function analyzeAll(code) {
    const A = HC.analyze(code);
    const lint = lintAttrs(code);
    const lintLines = new Set(lint.map(e => e.line));
    const base = A.errors.filter(e => !(/^Неправильно записаний тег/.test(e.msg) && lintLines.has(e.line)));
    const errors = base.concat(lint).sort((a, b) => a.line - b.line);
    return { A, X: { code, lint, errors } };
  }

  /* ------------------------------------------------ Помічники для перевірок */
  const txt = el => (el ? HC.norm(HC.text(el)) : '');
  const at = (el, n) => (el && el.attrs ? el.attrs[n] : undefined);
  const bodyKids = A => (A.body ? HC.kids(A.body) : HC.kids(A.root));
  const seqIs = (A, list) => bodyKids(A).map(e => e.tag + ':' + txt(e)).join('|') === list.join('|');
  const byText = (A, tag, t) => A.all(tag).find(e => txt(e) === t);
  const idsOf = A => { const out = []; (function walk(n) { for (const c of n.children || []) if (c.type === 'el') { if (c.attrs && c.attrs.id != null) out.push(c.attrs.id); walk(c); } })(A.root); return out; };
  const internalOk = (A, a) => { const v = at(a, 'href') || ''; return v.length > 1 && v[0] === '#' && idsOf(A).includes(v.slice(1)); };
  const usefulAlt = v => { const s = HC.norm(v || ''); return s.length >= 8 && s.split(' ').length >= 2 && !/\.(svg|png|jpe?g|gif|webp)$/i.test(s) && !/^(фото|зображення|картинка|малюнок|image|photo|img|picture)$/i.test(s); };
  const headLevels = A => { const out = []; (function walk(n) { for (const c of n.children || []) if (c.type === 'el') { const m = /^h([1-6])$/.exec(c.tag); if (m) out.push(+m[1]); walk(c); } })(A.root); return out; };

  const C = {
    noErrors: { label: 'Усі теги правильно закриті й вкладені', test: (A, S, X) => X.errors.length === 0 },
    clean: { label: 'Теги й атрибути записано без помилок', test: (A, S, X) => X.errors.length === 0 },
    usedAll: { label: 'Використано всі блоки', test: (A, S) => S.missing === 0 && S.extra === 0 },
    onlyNeeded: { label: 'Використано всі потрібні блоки і жодного зайвого', test: (A, S) => S.missing === 0 && S.extra === 0 }
  };
  const SKEL = title => [
    { id: 'f1', code: '<!DOCTYPE html>' }, { id: 'f2', code: '<html lang="uk">' }, { id: 'f3', code: '<head>' },
    { id: 'f3b', code: '<meta charset="utf-8">' },
    { id: 'f4', code: `<title>${title}</title>` }, { id: 'f5', code: '</head>' }, { id: 'f6', code: '<body>' },
    { id: 'f7', code: '</body>' }, { id: 'f8', code: '</html>' }
  ];
  const TREE_IMAGES = `<pre class="tree">📁 site
├─ 📄 index.html  <i>← ця сторінка</i>
└─ 📁 images
   ├─ 🖼 garden.svg
   ├─ 🖼 books.svg
   └─ 🖼 robot.svg</pre>`;
  const TREE_PATHS = `<pre class="tree">📁 site
├─ 📄 index.html  <i>← ця сторінка</i>
├─ 🖼 logo.svg
└─ 📁 images
   ├─ 🖼 garden.svg
   └─ 📁 clubs
      └─ 🖼 robot.svg</pre>`;

  /* ======================================================= Набори рівнів */
  const LAB_SETS = {
    /* ---------- Розділ 1: заголовки ---------- */
    headings: [
      { title: 'Стаття з підрозділами', mode: 'lines', fixed: SKEL('Мій клас'), insertBefore: 'f7',
        brief: 'Каркас уже готовий 🔒. Збери в <b>&lt;body&gt;</b> статтю: головний заголовок <b>«Мій клас»</b>, а під ним два підрозділи — <b>«Хто ми»</b> і <b>«Наші традиції»</b>, кожен зі своїм абзацом.',
        blocks: [['h1', '<h1>Мій клас</h1>'], ['h2a', '<h2>Хто ми</h2>'], ['pa', '<p>Нас 28, і кожен має своє захоплення.</p>'], ['h2b', '<h2>Наші традиції</h2>'], ['pb', '<p>Щоосені ми разом садимо дерева біля ліцею.</p>']],
        checks: [
          { label: 'Перший у <body> — головний заголовок <h1> «Мій клас»', test: A => { const k = bodyKids(A)[0]; return !!k && k.tag === 'h1' && txt(k) === 'Мій клас'; } },
          { label: 'Підрозділи «Хто ми» і «Наші традиції» — заголовки <h2>', test: A => !!byText(A, 'h2', 'Хто ми') && !!byText(A, 'h2', 'Наші традиції') },
          { label: 'Під кожним <h2> — його абзац <p>', test: A => seqIs(A, ['h1:Мій клас', 'h2:Хто ми', 'p:Нас 28, і кожен має своє захоплення.', 'h2:Наші традиції', 'p:Щоосені ми разом садимо дерева біля ліцею.']) },
          C.noErrors, C.usedAll] },
      { title: 'Шкільна газета', mode: 'lines', fixed: SKEL('Шкільна газета'), insertBefore: 'f7',
        brief: 'Збери випуск газети: назва <b>«Шкільна газета»</b> → розділ <b>«Новини»</b> → у ньому підрозділ <b>«Перемога на олімпіаді»</b> з абзацом → розділ <b>«Анонси»</b> з абзацом. <b>Три блоки — пастки!</b>',
        blocks: [['h1', '<h1>Шкільна газета</h1>'], ['h2a', '<h2>Новини</h2>'], ['h3', '<h3>Перемога на олімпіаді</h3>'], ['pa', '<p>Наша команда посіла перше місце з інформатики.</p>'], ['h2b', '<h2>Анонси</h2>'], ['pb', '<p>У п’ятницю — шкільний концерт.</p>'],
          ['x1', '<h1>Новини</h1>', 1], ['x2', '<p><b>Анонси</b></p>', 1], ['x3', '<h7>Перемога на олімпіаді</h7>', 1]],
        checks: [
          { label: 'На сторінці рівно один <h1>', test: A => A.all('h1').length === 1 },
          { label: '«Новини» й «Анонси» — заголовки <h2>, а не жирний абзац', test: A => !!byText(A, 'h2', 'Новини') && !!byText(A, 'h2', 'Анонси') && !A.all('b').length },
          { label: '«Перемога на олімпіаді» — <h3> усередині розділу «Новини»', test: A => seqIs(A, ['h1:Шкільна газета', 'h2:Новини', 'h3:Перемога на олімпіаді', 'p:Наша команда посіла перше місце з інформатики.', 'h2:Анонси', 'p:У п’ятницю — шкільний концерт.']) },
          { label: 'Рівні заголовків не перестрибують: h1 → h2 → h3', test: A => { const l = headLevels(A); return l.length > 0 && l[0] === 1 && l.every((v, i) => i === 0 || v <= l[i - 1] + 1); } },
          { label: 'Немає вигаданих тегів (тегу <h7> не існує)', test: A => A.unknown === 0 },
          C.onlyNeeded] }
    ],

    /* ---------- Розділ 2: атрибути ---------- */
    attrlab: [
      { title: 'Імена для розділів', mode: 'fill', tabTitle: 'Гурток робототехніки',
        brief: 'Меню вгорі вже готове, але заголовкам розділів бракує імен. Допиши значення <code>id</code>, щоб кожен пункт меню знаходив свій розділ. Підказка — у <code>href</code> пунктів меню. <b>Перевір: клацай пункти меню в браузері праворуч!</b>',
        template: '<h1>Гурток робототехніки</h1>\n<ul>\n  <li><a href="#about">Про гурток</a></li>\n  <li><a href="#schedule">Розклад</a></li>\n  <li><a href="#join">Як записатися</a></li>\n</ul>\n<h2 id="[[i1]]">Про гурток</h2>\n<p>Ми збираємо роботів із конструктора\n   й програмуємо їх рухатися.</p>\n<p>Наш робот уже вміє об’їжджати перешкоди.</p>\n<h2 id="[[i2]]">Розклад</h2>\n<p>Вівторок і четвер, 15:00–16:30, кабінет 204.</p>\n<h2 id="[[i3]]">Як записатися</h2>\n<p>Прийди на заняття або напиши керівникові.</p>',
        slots: { i1: { ph: '?' }, i2: { ph: '?' }, i3: { ph: '?' } },
        checks: [
          { label: 'Розділ «Про гурток» має id="about"', test: A => at(byText(A, 'h2', 'Про гурток'), 'id') === 'about' },
          { label: 'Розділ «Розклад» має id="schedule"', test: A => at(byText(A, 'h2', 'Розклад'), 'id') === 'schedule' },
          { label: 'Розділ «Як записатися» має id="join"', test: A => at(byText(A, 'h2', 'Як записатися'), 'id') === 'join' },
          { label: 'Кожен пункт меню веде до існуючого id', test: A => { const as = A.all('a'); return as.length === 3 && as.every(a => internalOk(A, a)); } },
          C.clean] },
      { title: 'Знайди помилки', mode: 'fix', tabTitle: 'Шаховий клуб',
        brief: 'У коді <b>4 помилки в атрибутах</b>. Номери червоних рядків і підказки під браузером допоможуть їх знайти. Задум: правила нумеруються літерами <b>A, B</b>; кожен <code>id</code> — унікальний, латиницею й без пробілів.',
        starter: '<h1 id="top">Шаховий клуб</h1>\n<p>Наші правила:</p>\n<ol type=“A”>\n  <li>Вітаємося перед партією</li>\n  <li>Не підказуємо гравцям</li>\n</ol type="A">\n<h2 id="наш розклад">Розклад</h2>\n<p>Щосереди о 14:30.</p>\n<h2 id="top">Контакти</h2>\n<p>Кабінет 305.</p>',
        checks: [
          { label: 'Правила нумеруються літерами: type="A" у прямих лапках', test: (A, S, X) => { const o = A.all('ol')[0]; return at(o, 'type') === 'A' && !/[“”«»]/.test(X.code); } },
          { label: 'Закривальний тег </ol> — без атрибутів', test: (A, S, X) => /<\/ol>/.test(X.code) && !/<\/ol\s+[^>]+>/.test(X.code) },
          { label: 'id розділу «Розклад» — латиницею, без пробілів (наприклад, schedule)', test: A => /^[a-z][a-z0-9_-]*$/i.test(at(byText(A, 'h2', 'Розклад'), 'id') || '') },
          { label: 'Кожен id на сторінці — унікальний', test: A => { const ids = idsOf(A); return ids.length >= 3 && new Set(ids).size === ids.length; } },
          C.clean] }
    ],

    /* ---------- Розділ 3: посилання ---------- */
    links: [
      { title: 'Перше посилання', mode: 'inline', tabTitle: 'Карпати',
        brief: 'Збери абзац <b>«Читай більше на Вікіпедії»</b>, у якому слово <b>«Вікіпедії»</b> — посилання на <code>https://uk.wikipedia.org</code>. <b>Два блоки — зайві!</b> Наведи курсор на посилання в браузері: унизу з’явиться адреса.',
        blocks: [['a', '<p>'], ['b', 'Читай більше на '], ['c', '<a href="https://uk.wikipedia.org">'], ['d', 'Вікіпедії'], ['e', '</a>'], ['f', '</p>'],
          ['x1', '<a src="https://uk.wikipedia.org">', 1], ['x2', '</a href="https://uk.wikipedia.org">', 1]],
        checks: [
          { label: 'Посилання <a> — усередині абзацу <p>', test: A => A.all('a').length === 1 && !!HC.ancestor(A.all('a')[0], 'p') },
          { label: 'Адреса: href="https://uk.wikipedia.org"', test: A => at(A.all('a')[0], 'href') === 'https://uk.wikipedia.org' },
          { label: 'Текст посилання — «Вікіпедії»', test: A => txt(A.all('a')[0]) === 'Вікіпедії' },
          { label: 'Текст абзацу: «Читай більше на Вікіпедії»', test: A => { const p = A.all('p')[0]; return !!p && txt(p) === 'Читай більше на Вікіпедії'; } },
          C.clean, C.onlyNeeded] },
      { title: 'Куди веде посилання?', mode: 'fill', tabTitle: 'Корисні контакти',
        brief: 'Допиши адреси в <code>href</code>. Кожне посилання веде в інше «місце»:',
        extra: '<table class="mini"><tr><td>інший сайт</td><td><code>https://адреса</code></td></tr><tr><td>електронна пошта</td><td><code>mailto:адреса</code></td></tr><tr><td>телефон</td><td><code>tel:+380…</code> (без пробілів)</td></tr><tr><td>сторінка свого сайту</td><td><code>назва.html</code> — файл <b>bells.html</b> лежить поруч з index.html</td></tr></table><p class="tiny-help">Клацни кожне посилання в браузері — побачиш, що станеться.</p>',
        template: '<h2>Корисні контакти</h2>\n<ul>\n  <li>Міністерство освіти:\n    <a href="[[web]]">mon.gov.ua</a></li>\n  <li>Написати класному керівнику:\n    <a href="[[mail]]">teacher@example.com</a></li>\n  <li>Подзвонити в ліцей:\n    <a href="[[tel]]">+380 31 200 00 00</a></li>\n  <li>Розклад дзвінків:\n    <a href="[[page]]">окрема сторінка</a></li>\n</ul>',
        slots: { web: { ph: 'https://…' }, mail: { ph: 'mailto:…' }, tel: { ph: 'tel:…' }, page: { ph: '….html' } },
        checks: [
          { label: 'Сайт міністерства: https://mon.gov.ua', test: A => A.all('a').some(a => /^https:\/\/(www\.)?mon\.gov\.ua\/?$/.test(at(a, 'href') || '')) },
          { label: 'Лист: mailto:teacher@example.com', test: A => A.all('a').some(a => (at(a, 'href') || '').trim().toLowerCase() === 'mailto:teacher@example.com') },
          { label: 'Дзвінок: tel:+380312000000', test: A => A.all('a').some(a => { const v = (at(a, 'href') || '').trim(); return /^tel:/i.test(v) && v.slice(4).replace(/[\s()-]/g, '') === '+380312000000'; }) },
          { label: 'Сторінка свого сайту: bells.html', test: A => A.all('a').some(a => normPath(at(a, 'href')) === 'bells.html') },
          C.clean] },
      { title: 'Полагодь посилання', mode: 'fix', tabTitle: 'Корисне для уроків',
        brief: 'На сторінці <b>5 проблем</b> з посиланнями. Клацай кожне посилання в браузері — повідомлення під вікном підкаже, що не так. Задум: Google відкривається як сайт, «розклад» прокручує сторінку до розкладу, Вікіпедія — у новій вкладці.',
        starter: '<h1>Корисне для уроків</h1>\n<p>Шукай інформацію в <a href="www.google.com">Google</a>.</p>\n<p>Розклад дзвінків — <a href="#bells">тут</a>.</p>\n<p><a href="https://uk.wikipedia.org" target="blank">Вікіпедія (у новій вкладці)</a></p>\n<p>Прогноз погоди — на <a href="https://meteo.gov.ua">сайті Укргідрометцентру</p>\n<h2 id="Bells">Розклад дзвінків</h2>\n<ol>\n  <li>8:30 – 9:15</li>\n  <li>9:25 – 10:10</li>\n  <li>10:30 – 11:15</li>\n</ol>',
        checks: [
          { label: 'Google: повна адреса з https://', test: A => A.all('a').some(a => txt(a) === 'Google' && /^https:\/\/(www\.)?google\.com(\.ua)?\/?$/.test(at(a, 'href') || '')) },
          { label: 'Посилання на розклад знаходить свій id (великі й малі літери мають значення!)', test: A => A.all('a').some(a => (at(a, 'href') || '')[0] === '#' && internalOk(A, a)) },
          { label: 'Текст посилання на розклад пояснює, куди воно веде (не «тут»)', test: A => A.all('a').filter(a => (at(a, 'href') || '')[0] === '#').some(a => txt(a).length >= 6 && !/^(тут|сюди|клікни тут|натисни тут|натисніть тут|посилання)$/i.test(txt(a))) },
          { label: 'Вікіпедія відкривається в новій вкладці: target="_blank"', test: A => A.all('a').some(a => /wikipedia/.test(at(a, 'href') || '') && at(a, 'target') === '_blank') },
          { label: 'Кожне посилання закрите тегом </a>, інших помилок немає', test: (A, S, X) => X.errors.length === 0 }] }
    ],

    /* ---------- Розділ 4: зображення ---------- */
    images: [
      { title: 'Додай зображення', mode: 'fill', tabTitle: 'Шкільний сад',
        brief: 'Додай на сторінку зображення <b>garden.svg</b> з папки <b>images</b> шириною <b>300</b> пікселів. Яка назва атрибута задає файл? В <code>alt</code> опиши зміст так, щоб його зрозуміла людина, яка зображення не бачить.',
        extra: TREE_IMAGES,
        template: '<h2>Шкільний сад</h2>\n<img [[n]]="[[src]]"\n     alt="[[alt]]"\n     width="[[w]]">\n<p>Цієї весни ми посадили біля ліцею 12 дерев.</p>',
        slots: { n: { ph: 'атрибут' }, src: { ph: 'шлях до файлу' }, alt: { ph: 'опис зображення', w: 28 }, w: { ph: '…' } },
        checks: [
          { label: 'Файл задає атрибут src', test: A => { const i = A.all('img')[0]; return !!i && at(i, 'src') != null; } },
          { label: 'Шлях до файлу: images/garden.svg', test: A => normPath(at(A.all('img')[0], 'src')) === 'images/garden.svg' },
          { label: 'alt змістовно описує зображення (2+ слова, не назва файлу)', test: A => usefulAlt(at(A.all('img')[0], 'alt')) },
          { label: 'Ширина: width="300" (число без px)', test: A => at(A.all('img')[0], 'width') === '300' },
          C.clean] },
      { title: 'Шляхи до файлів', mode: 'fill', tabTitle: 'Наш ліцей',
        files: { 'logo.svg': 'images/logo.svg', 'images/garden.svg': 'images/garden.svg', 'images/clubs/robot.svg': 'images/robot.svg' },
        brief: 'Сторінка <b>index.html</b> лежить у папці <b>site</b>. Допиши шлях до кожного файлу <b>від сторінки</b>. Неправильний шлях — і браузер покаже «зламане» зображення з текстом alt.',
        extra: TREE_PATHS,
        template: '<h1>Наш ліцей</h1>\n<img src="[[p1]]" alt="Логотип ліцею" width="70">\n<p>Ми доглядаємо шкільний сад:</p>\n<img src="[[p2]]" alt="Дерева на пагорбі в шкільному саду"\n     width="220">\n<p>А ще в нас є гурток робототехніки:</p>\n<img src="[[p3]]" alt="Блакитний робот з антеною"\n     width="220">',
        slots: { p1: { ph: '?' }, p2: { ph: '?' }, p3: { ph: '?' } },
        checks: [
          { label: 'Логотип: logo.svg (лежить поруч зі сторінкою)', test: A => normPath(at(A.all('img')[0], 'src')) === 'logo.svg' },
          { label: 'Сад: images/garden.svg', test: A => normPath(at(A.all('img')[1], 'src')) === 'images/garden.svg' },
          { label: 'Робот: images/clubs/robot.svg', test: A => normPath(at(A.all('img')[2], 'src')) === 'images/clubs/robot.svg' },
          C.clean] },
      { title: 'Картинка-посилання', mode: 'lines', fixed: SKEL('Книжковий клуб'), insertBefore: 'f7',
        brief: 'Збери картку клубу: заголовок, потім <b>зображення, яке є посиланням</b> на сайт <code>https://chytomo.com</code>, а під ним — абзац. Зображення має лежати <b>всередині</b> &lt;a&gt;…&lt;/a&gt;. <b>Два блоки — зайві!</b>',
        blocks: [['h', '<h2>Книжковий клуб</h2>'], ['ao', '<a href="https://chytomo.com">'], ['im', '<img src="images/books.svg" alt="Перейти на сайт про книжки" width="240">'], ['ac', '</a>'], ['p', '<p>Зустрічі — щочетверга о 15:00 у бібліотеці.</p>'],
          ['x1', '</img>', 1], ['x2', '<img href="images/books.svg" alt="Книжки" width="240">', 1]],
        checks: [
          { label: 'Зображення <img> — усередині посилання <a>', test: A => A.all('img').length === 1 && !!HC.ancestor(A.all('img')[0], 'a') },
          { label: 'Посилання веде на https://chytomo.com', test: A => at(A.all('a')[0], 'href') === 'https://chytomo.com' },
          { label: 'У зображення є src="images/books.svg" і змістовний alt', test: A => { const i = A.all('img')[0]; return normPath(at(i, 'src')) === 'images/books.svg' && usefulAlt(at(i, 'alt')); } },
          { label: 'Порядок: заголовок → картинка-посилання → абзац', test: A => bodyKids(A).map(e => e.tag).join(',') === 'h2,a,p' },
          C.clean, C.onlyNeeded] }
    ]
  };

  /* ===================================================== Вікно браузера */
  const BASE_URL = 'file:///C:/Users/Учень/site/index.html';
  const absUrl = u => { try { return new URL(u, document.baseURI).href; } catch (e) { return u; } };
  function prepareDoc(code, files, ctx) {
    const doc = new DOMParser().parseFromString(code, 'text/html');
    doc.querySelectorAll('script, iframe, object, embed, base, form, link').forEach(n => n.remove());
    if (!doc.querySelector('meta[charset]')) { const m = doc.createElement('meta'); m.setAttribute('charset', 'utf-8'); doc.head.prepend(m); }
    doc.querySelectorAll('img').forEach(img => {
      const raw = img.getAttribute('src');
      if (raw == null) return;
      const p = normPath(raw);
      if (/^https?:\/\//i.test(p) || /^data:image\//i.test(p)) return;
      img.setAttribute('src', files[p] ? absUrl(ctx.asset(files[p])) : 'data:,');
    });
    const st = doc.createElement('style');
    st.textContent = '.h2-flash{outline:3px solid #FF7A00;outline-offset:3px;background:#FFF3E0;transition:background .8s}';
    doc.head.append(st);
    return '<!DOCTYPE html>' + doc.documentElement.outerHTML;
  }
  function describeHref(href, d, target) {
    const v = (href || '').trim();
    if (!href && href !== '') return { kind: 'none', url: '', msg: 'Тег <a> без href — це ще не посилання: браузеру нікуди переходити.' };
    if (!v) return { kind: 'none', url: BASE_URL, msg: 'href порожній — посилання нікуди не веде.' };
    if (v === '#') return { kind: 'top', url: BASE_URL + '#', msg: '⬆ href="#" — перехід на самий верх сторінки.' };
    if (v[0] === '#') {
      const id = (() => { try { return decodeURIComponent(v.slice(1)); } catch (e) { return v.slice(1); } })();
      const el = d && d.getElementById(id);
      if (el) return { kind: 'anchor', el, url: BASE_URL + v, msg: `⚓ Перехід до елемента з id="${id}" на цій сторінці.` };
      const near = d && [...d.querySelectorAll('[id]')].find(e => e.id.toLowerCase() === id.toLowerCase());
      if (near) return { kind: 'miss', url: BASE_URL + v, msg: `⚠ Немає елемента з id="${id}". Є id="${near.id}" — великі й малі літери мають значення!` };
      return { kind: 'miss', url: BASE_URL + v, msg: `⚠ На сторінці немає елемента з id="${id}" — посилання нікуди не веде.` };
    }
    const tab = target === '_blank' ? ' у новій вкладці' : '';
    if (/^https?:\/\//i.test(v)) return { kind: 'web', url: v, msg: `🌐 Тут${tab} відкрився б сайт ${v}. (У тренажері зовнішні переходи вимкнено.)` };
    if (/^mailto:/i.test(v)) return { kind: 'mail', url: v, msg: `✉ Відкрилася б поштова програма з новим листом на адресу ${v.slice(7)}.` };
    if (/^tel:/i.test(v)) return { kind: 'tel', url: v, msg: `📞 На телефоні почався б дзвінок на номер ${v.slice(4)}.` };
    const fileUrl = 'file:///C:/Users/Учень/site/' + v;
    if (/^www\.|\.(com|ua|org|net|info|gov\.ua)(\/|$)/i.test(v)) return { kind: 'file', url: fileUrl, msg: `📄 Без https:// браузер вважає «${v}» файлом у папці сайту — і не знайде його. Допиши https:// на початку.` };
    if (/\.html?$/i.test(v)) return { kind: 'file', url: fileUrl, msg: `📄 Відкрилася б сторінка «${v}» з папки сайту${tab}. (У тренажері її немає.)` };
    return { kind: 'file', url: fileUrl, msg: `📄 Браузер шукатиме файл «${v}» у папці сайту.` };
  }
  function browserView(ctx) {
    const tab = h('span', { class: 'bw-tab' });
    const url = h('div', { class: 'bw-url', text: BASE_URL });
    const frame = h('iframe', { sandbox: 'allow-same-origin', title: 'Результат у браузері' });
    const status = h('div', { class: 'bw-status' });
    const note = h('div', { class: 'bw-note', role: 'status', 'aria-live': 'polite' });
    const wrap = h('div', { class: 'hbw h2bw' },
      h('div', { class: 'bw-top' }, h('span', { class: 'bw-dots' }, h('i'), h('i'), h('i')), tab), url,
      h('div', { class: 'bw-view' }, frame, status));
    let last = null, keep = 0, flashT = null, dead = false;
    const over = e => { const a = e.target && e.target.closest && e.target.closest('a'); if (!a) return; const r = describeHref(a.getAttribute('href'), frame.contentDocument, a.getAttribute('target')); status.textContent = r.url || '(немає адреси)'; status.classList.add('on'); };
    const out = e => { const a = e.target && e.target.closest && e.target.closest('a'); if (a) status.classList.remove('on'); };
    const click = e => {
      const a = e.target && e.target.closest && e.target.closest('a');
      if (!a) return;
      e.preventDefault();
      const d = frame.contentDocument, w = frame.contentWindow;
      const r = describeHref(a.getAttribute('href'), d, a.getAttribute('target'));
      note.textContent = r.msg;
      note.className = 'bw-note on ' + (r.kind === 'miss' || (r.kind === 'file' && /не знайде/.test(r.msg)) ? 'bad' : r.kind === 'anchor' || r.kind === 'top' ? 'ok' : '');
      if (r.kind === 'anchor') {
        url.textContent = r.url;
        r.el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        r.el.classList.add('h2-flash');
        clearTimeout(flashT);
        flashT = setTimeout(() => { try { r.el.classList.remove('h2-flash'); } catch (er) {} }, 1600);
      } else if (r.kind === 'top') { url.textContent = r.url; w.scrollTo({ top: 0, behavior: 'smooth' }); }
    };
    frame.addEventListener('load', () => {
      if (dead) return;
      try {
        const d = frame.contentDocument, w = frame.contentWindow;
        if (!d) return;
        if (keep) w.scrollTo(0, keep);
        d.addEventListener('mouseover', over);
        d.addEventListener('mouseout', out);
        d.addEventListener('click', click);
      } catch (e) {}
    });
    return {
      el: wrap, note,
      update(code, title, files) {
        tab.textContent = title && title.trim() ? title.trim() : 'Без назви';
        tab.classList.toggle('empty', !(title && title.trim()));
        const docStr = prepareDoc(code, files || DEFAULT_FILES, ctx);
        if (docStr === last) return;
        last = docStr;
        try { keep = frame.contentWindow ? frame.contentWindow.scrollY : 0; } catch (e) { keep = 0; }
        url.textContent = BASE_URL;
        status.classList.remove('on');
        frame.srcdoc = docStr;
      },
      destroy() { dead = true; clearTimeout(flashT); }
    };
  }
  const wrapFragment = (code, title) => `<!DOCTYPE html><html lang="uk"><head><meta charset="utf-8"><title>${escH(title || '')}</title></head><body>${code}</body></html>`;

  /* Мінікод-редактор (textarea з номерами рядків) */
  function codeEditor(opts) {
    const ta = h('textarea', { class: 'ed-ta', spellcheck: 'false', autocapitalize: 'off', autocomplete: 'off', wrap: 'off', placeholder: opts.placeholder || '', 'aria-label': 'HTML-код' });
    const gutter = h('div', { class: 'ed-gut', 'aria-hidden': 'true' });
    const el = h('div', { class: 'ed' + (opts.small ? ' sm' : '') }, gutter, ta);
    function gut(errLines) {
      const n = Math.max(1, ta.value.split('\n').length);
      let s = '';
      for (let i = 1; i <= n; i++) s += `<div class="${errLines && errLines.has(i) ? 'err' : ''}">${i}</div>`;
      gutter.innerHTML = s;
      gutter.scrollTop = ta.scrollTop;
    }
    ta.addEventListener('scroll', () => { gutter.scrollTop = ta.scrollTop; });
    ta.addEventListener('keydown', e => {
      if (ta.readOnly) return;
      if (e.key === 'Tab' && !e.shiftKey && !e.ctrlKey && !e.altKey && !e.metaKey) {
        e.preventDefault();
        ta.setRangeText('  ', ta.selectionStart, ta.selectionEnd, 'end');
        ta.dispatchEvent(new Event('input'));
      } else if (e.key === 'Enter') {
        const s = ta.selectionStart;
        const ls = ta.value.lastIndexOf('\n', s - 1) + 1;
        const ind = /^[ \t]*/.exec(ta.value.slice(ls, s))[0];
        if (ind) { e.preventDefault(); ta.setRangeText('\n' + ind, s, ta.selectionEnd, 'end'); ta.dispatchEvent(new Event('input')); }
      }
    });
    function goLine(n) {
      const lines = ta.value.split('\n');
      const start = lines.slice(0, n - 1).reduce((a, l) => a + l.length + 1, 0);
      ta.focus();
      ta.setSelectionRange(start, start + (lines[n - 1] || '').length);
      ta.scrollTop = Math.max(0, (n - 4) * 22);
    }
    return { el, ta, gut, goLine, setRO(v) { ta.readOnly = v; el.classList.toggle('ro', v); } };
  }
  function renderChecklist(list, res) {
    list.innerHTML = '';
    res.forEach(r => list.appendChild(h('li', { class: r.ok ? 'ok' : 'todo' }, h('span', { class: 'mk', text: r.ok ? '✓' : '○' }), h('span', { html: labelHtml(r.label) }))));
  }
  function renderErrors(box, errors, max, goLine, title) {
    box.innerHTML = '';
    if (!errors.length) return;
    box.appendChild(h('div', { class: 'hb-h', text: title || 'Підказки' }));
    errors.slice(0, max).forEach(e => {
      const line = h('div', { class: 'err-line' + (goLine ? ' clickable' : ''), text: e.line ? `Рядок ${e.line}: ${e.msg}` : e.msg });
      if (goLine) line.onclick = () => goLine(e.line);
      box.appendChild(line);
    });
    if (errors.length > max) box.appendChild(h('div', { class: 'muted', text: `…і ще ${errors.length - max}` }));
  }

  /* ===================================================== 1. Сортування */
  window.Games['html2-sort'] = {
    readonlyView: true,
    mount(host, ctx) {
      const ITEMS = (ctx.task.data && ctx.task.data.items) || [];
      const d0 = (ctx.saved && ctx.saved.details) || {};
      const place = Object.assign({}, d0.place || {});
      const wasReturned = returnedNow(ctx, d0);
      let ack = wasReturned ? ctx.saved.returnCount : (d0.ack || 0);
      let submitted = !!(ctx.saved && ctx.saved.final) || (!!d0.submitted && !wasReturned);
      const ro = !!ctx.readOnly;
      const items = HC.shuffleSeed(ITEMS, seedOf(ctx) + '|' + ctx.task.id);
      const persist = saver(ctx);
      let selected = null, busy = false, disposed = false;
      const okLabel = (ctx.task.data && ctx.task.data.okLabel) || '✅ Правильно';
      const badLabel = (ctx.task.data && ctx.task.data.badLabel) || '❌ Помилка';

      const pool = h('div', { class: 'ts-zone ts-pool' });
      const bOk = h('div', { class: 'ts-zone ts-bucket ok' });
      const bBad = h('div', { class: 'ts-zone ts-bucket bad' });
      const result = h('div', { class: 'g-result' });
      const submitBtn = h('button', { class: 'btn primary big' }, 'Завершити й перевірити');
      const root = h('div', { class: 'h2-sort' });
      if (wasReturned) root.appendChild(returnBanner());
      if (ro && !submitted) root.appendChild(roBanner());
      root.append(
        h('p', { class: 'muted', text: 'Перетягни кожну картку в кошик. Можна й так: клацни картку (або Enter), потім — кошик. Поки не здав, картки можна переставляти.' }),
        h('div', { class: 'ts-label', text: 'Картки' }), pool,
        h('div', { class: 'ts-buckets' },
          h('div', null, h('div', { class: 'ts-label ok', text: okLabel }), bOk),
          h('div', null, h('div', { class: 'ts-label bad', text: badLabel }), bBad)),
        h('div', { class: 'row', style: 'margin-top:14px' }, submitBtn), result);
      host.appendChild(root);

      const save = debounce(() => { if (!submitted && !ro) persist(0, { place, ack }, false).catch(() => {}); }, 900);
      const zoneOf = (x, y) => inside(bOk, x, y) ? 'ok' : inside(bBad, x, y) ? 'bad' : inside(pool, x, y) ? null : undefined;
      const can = () => !submitted && !ro && !busy;
      function render() {
        [pool, bOk, bBad].forEach(z => { z.innerHTML = ''; z.classList.remove('hot'); });
        for (const it of items) {
          const where = place[it.id] || null;
          const card = h('div', { class: 'ts-card' + (selected === it.id ? ' sel' : '') }, h('code', { html: HC.highlight(it.t) }));
          if (submitted) {
            const right = where === (it.ok ? 'ok' : 'bad');
            card.classList.add(right ? 'right' : 'wrong');
            card.appendChild(h('div', { class: 'why', text: (right ? '✓ ' : (it.ok ? '✗ Це правильний запис. ' : '✗ Тут помилка. ')) + it.why }));
          } else if (!ro) {
            dragSource(card, {
              enabled: can,
              move: (x, y) => { const z = zoneOf(x, y); bOk.classList.toggle('hot', z === 'ok'); bBad.classList.toggle('hot', z === 'bad'); pool.classList.toggle('hot', z === null); },
              drop: (x, y) => { const z = zoneOf(x, y); if (z !== undefined) { if (z) place[it.id] = z; else delete place[it.id]; save(); } selected = null; render(); },
              click: () => { selected = selected === it.id ? null : it.id; render(); }
            });
          }
          (where === 'ok' ? bOk : where === 'bad' ? bBad : pool).appendChild(card);
        }
        if (!pool.children.length) pool.appendChild(h('div', { class: 'ts-empty', text: submitted ? '' : 'Усі картки розкладено 👍' }));
        [bOk, bBad].forEach(b => { if (!b.children.length) b.appendChild(h('div', { class: 'ts-empty', text: 'Перетягни картки сюди' })); });
        submitBtn.classList.toggle('hidden', submitted || ro);
        submitBtn.disabled = busy;
      }
      const clickZone = (zone, val) => zone.addEventListener('click', e => {
        if (!can() || !selected || e.target.closest('.ts-card')) return;
        if (val) place[selected] = val; else delete place[selected];
        selected = null; save(); render();
      });
      clickZone(bOk, 'ok'); clickZone(bBad, 'bad'); clickZone(pool, null);
      function showResult() {
        const okN = items.filter(it => place[it.id] === (it.ok ? 'ok' : 'bad')).length;
        const score = items.length ? Math.round(100 * okN / items.length) : 0;
        result.className = 'g-result ' + (score >= 75 ? 'ok' : score >= 50 ? 'mid' : 'bad');
        result.innerHTML = '';
        result.append(h('b', { text: `Правильно: ${okN} з ${items.length} (${score}%)` }), h('div', { text: 'Під кожною карткою — пояснення.' }));
        return score;
      }
      submitBtn.addEventListener('click', async () => {
        if (!can()) return;
        const unsorted = items.filter(it => !place[it.id]).length;
        const ok = await confirmBox({
          title: 'Завершити й перевірити?',
          html: (unsorted ? `<p>Не розкладено карток: <b>${unsorted}</b> — вони рахуватимуться як помилки.</p>` : '') + '<p>Після завершення змінити відповіді вже не можна.</p>',
          ok: 'Так, завершити', cancel: 'Ще подумаю', danger: !!unsorted
        });
        if (!ok || disposed) return;
        save.cancel();
        busy = true; render();
        const okN = items.filter(it => place[it.id] === (it.ok ? 'ok' : 'bad')).length;
        const score = items.length ? Math.round(100 * okN / items.length) : 0;
        const review = items.map(it => ({ text: it.t, right: place[it.id] === (it.ok ? 'ok' : 'bad'), answer: place[it.id] || '—' }));
        try {
          await persist(score, { place, submitted: true, ack, review }, true);
          if (disposed) return;
          submitted = true; busy = false; render(); showResult();
        } catch (e) {
          if (disposed) return;
          busy = false; render();
          toast(ctx, 'Не вдалося завершити. Натисни «Завершити й перевірити» ще раз.', 'warn');
        }
      });
      render();
      if (submitted) showResult();
      else if (wasReturned && !ro) persist(0, { place, ack }, false).catch(() => {});
      return () => { disposed = true; if (save.pending() && !submitted && !ro) save.flush(); };
    }
  };

  /* Відступи для режиму «рядки» */
  function indentLines(codes) {
    let d = 0;
    return codes.map(c => {
      const toks = HC.tokenize(c).filter(t => !(t.type === 'text' && !t.text.trim()));
      const first = toks[0];
      const lineDepth = first && first.type === 'close' ? Math.max(0, d - 1) : d;
      for (const t of toks) {
        if (t.type === 'open' && !HC.VOID.has(t.name)) d++;
        else if (t.type === 'close' && !HC.VOID.has(t.name)) d = Math.max(0, d - 1);
      }
      return lineDepth;
    });
  }

  /* ===================================================== 2. Лабораторія з рівнями */
  const SLOT_RE = /\[\[(\w+)\]\]/g;
  window.Games['html2-lab'] = {
    readonlyView: true,
    mount(host, ctx) {
      const SET = LAB_SETS[ctx.task.id] || (ctx.task.data && LAB_SETS[ctx.task.data.set]);
      if (!SET) { host.textContent = 'Немає рівнів для цього завдання'; return; }
      const d0 = (ctx.saved && ctx.saved.details) || {};
      const finalDone = !!(ctx.saved && ctx.saved.final);
      const ro = !!ctx.readOnly;
      const wasReturned = returnedNow(ctx, d0);
      let ack = wasReturned ? ctx.saved.returnCount : (d0.ack || 0);
      const seed = seedOf(ctx) + '|' + ctx.task.id;
      const persist = saver(ctx);
      let disposed = false, view = null, cleanupLevel = null;

      const levels = SET.map((L, i) => {
        if (!L.byId && L.blocks) L.byId = Object.fromEntries([...(L.fixed || []).map(f => [f.id, { id: f.id, code: f.code, fixed: true }]), ...L.blocks.map(([id, code, dis]) => [id, { id, code, dis: !!dis }])]);
        const sv = (d0.levels || [])[i] || {};
        const st = { submitted: !!sv.submitted, score: sv.score || 0, passed: sv.passed || 0, total: sv.total || L.checks.length, html: sv.html || '' };
        if (L.blocks) {
          let order = Array.isArray(sv.order) ? sv.order.filter(id => L.byId[id]) : null;
          if (!order) order = (L.fixed || []).map(f => f.id);
          for (const f of (L.fixed || [])) if (!order.includes(f.id)) order.push(f.id);
          st.order = order;
          st.paletteOrder = HC.shuffleSeed(L.blocks.map(b => b[0]), seed + i);
        }
        if (L.mode === 'fill') st.vals = Object.assign({}, sv.vals || {});
        if (L.mode === 'fix') st.code = typeof sv.code === 'string' ? sv.code : L.starter;
        return st;
      });
      if (wasReturned) {
        const imperfect = levels.filter(l => l.submitted && l.score < 100);
        (imperfect.length ? imperfect : levels).forEach(l => { l.submitted = false; });
      }
      if (finalDone) levels.forEach(l => { l.submitted = true; });
      let cur = levels.findIndex(l => !l.submitted);
      if (cur < 0) cur = 0;

      const details = () => ({ ack, levels: levels.map(l => {
        const o = { submitted: l.submitted, score: l.score, passed: l.passed, total: l.total, html: l.html };
        if (l.order) o.order = l.order; if (l.vals) o.vals = l.vals; if (l.code != null) o.code = l.code;
        return o;
      }) });
      const totalScore = () => Math.round(levels.reduce((a, l) => a + (l.submitted ? l.score : 0), 0) / levels.length);
      const saveDraft = debounce(() => { if (!finalDone && !ro && !disposed) persist(totalScore(), details(), false).catch(() => {}); }, 1200);

      const bar = h('div', { class: 'lvl-bar' });
      const body = h('div');
      const root = h('div', { class: 'h2-lab' });
      if (wasReturned) root.appendChild(returnBanner());
      if (ro && !finalDone) root.appendChild(roBanner());
      root.append(bar, body);
      host.appendChild(root);
      if (wasReturned && !ro) persist(totalScore(), details(), false).catch(() => {});

      function renderBar() {
        bar.innerHTML = '';
        levels.forEach((l, i) => {
          const open = i === 0 || levels[i - 1].submitted || l.submitted || ro;
          const b = h('button', { class: 'lvl' + (i === cur ? ' cur' : '') + (l.submitted ? ' done' : ''), disabled: !open, title: SET[i].title },
            h('span', { class: 'n', text: open ? String(i + 1) : '🔒' }), h('span', { class: 'st', text: l.submitted ? `готово · ${l.score}%` : SET[i].title }));
          b.onclick = () => { if (i === cur) return; cur = i; load(); };
          bar.appendChild(b);
        });
        bar.appendChild(h('div', { class: 'lvl-total' }, 'Результат: ', h('b', { text: totalScore() + '%' })));
      }

      function load() {
        if (cleanupLevel) { cleanupLevel(); cleanupLevel = null; }
        if (view) { view.destroy(); view = null; }
        renderBar();
        const L = SET[cur], st = levels[cur];
        const locked = () => st.submitted || ro;
        const files = L.files || DEFAULT_FILES;
        body.innerHTML = '';
        view = browserView(ctx);
        const checklist = h('ul', { class: 'checklist live' });
        const errBox = h('div', { class: 'hb-errs' });
        const result = h('div', { class: 'g-result' });
        const submitBtn = h('button', { class: 'btn primary big' }, 'Завершити рівень');
        const resetBtn = h('button', { class: 'btn small' }, '⟲ Почати заново');
        const modeHelp = { inline: 'Перетягни блок у рядок коду або клацни — він додасться в кінець.', lines: 'Перетягни блок у потрібне місце або клацни — він додасться перед </body>.', fill: 'Клацни поле в коді й допиши потрібне. Браузер оновлюється одразу.', fix: 'Виправ код просто в редакторі. Клацни підказку — курсор перейде до рядка.' }[L.mode];
        const brief = h('div', { class: 'brief' }, h('div', { class: 'brief-h', text: `Рівень ${cur + 1}. ${L.title}` }), h('div', { html: L.brief }), L.extra ? h('div', { class: 'brief-extra', html: L.extra }) : null);
        const right = h('div', { class: 'hb-col' }, h('div', { class: 'hb-h', text: 'Результат у браузері' }), view.el, view.note,
          h('div', { class: 'hb-h', style: 'margin-top:12px', text: 'Перевірка' }), checklist, errBox,
          h('div', { style: 'margin-top:12px' }, submitBtn), result);

        /* --- код рівня --- */
        let getCode, renderInput, setLocked = () => {}, goLine = null, edRef = null, slotKeys = [];
        if (L.blocks) {
          const palette = h('div', { class: 'hb-pal' });
          const ws = h('div', { class: 'hb-ws ' + L.mode });
          body.append(brief, h('div', { class: 'hb-grid' },
            h('div', { class: 'hb-col' }, h('div', { class: 'hb-h', text: 'Блоки' }), palette, h('p', { class: 'muted tiny-help', text: modeHelp })),
            h('div', { class: 'hb-col' }, h('div', { class: 'hb-h' }, 'Мій код ', h('span', { class: 'spacer' }), resetBtn), ws),
            right));
          let drag = null;
          const genCode = ids => {
            const codes = ids.map(id => L.byId[id].code);
            if (L.mode === 'inline') return codes.join('');
            const dep = indentLines(codes);
            return codes.map((c, i) => '  '.repeat(dep[i]) + c).join('\n');
          };
          getCode = () => genCode(st.order);
          const defaultIndex = () => { if (L.insertBefore) { const k = st.order.indexOf(L.insertBefore); if (k >= 0) return k; } return st.order.length; };
          const insertAt = (idx, id) => { const o = st.order.filter(x => x !== id); o.splice(Math.max(0, Math.min(o.length, idx)), 0, id); st.order = o; refresh(); };
          const removeId = id => { st.order = st.order.filter(x => x !== id); refresh(); };
          function renderPalette() {
            palette.innerHTML = '';
            palette.classList.toggle('hot', !!drag && drag.from === 'ws' && drag.overPal);
            if (locked()) { palette.appendChild(h('div', { class: 'ts-empty', text: st.submitted ? 'Рівень завершено' : 'Перегляд' })); return; }
            const used = new Set(st.order);
            const free = st.paletteOrder.filter(id => !used.has(id));
            if (!free.length) palette.appendChild(h('div', { class: 'ts-empty', text: 'Усі блоки використано' }));
            for (const id of free) {
              const blk = h('div', { class: 'hblk', html: chipCode(L.byId[id].code), role: 'button', 'aria-label': 'Додати блок ' + L.byId[id].code });
              if (drag && drag.id === id) blk.classList.add('dragging-src');
              dragSource(blk, { enabled: () => !locked(), start: () => { drag = { id, from: 'pal', idx: null }; }, move: onMove, drop: onDrop, click: () => insertAt(defaultIndex(), id) });
              palette.appendChild(blk);
            }
          }
          function renderWS() {
            ws.innerHTML = '';
            ws.classList.toggle('hot', !!drag && drag.idx != null);
            const ids = drag && drag.from === 'ws' ? st.order.filter(x => x !== drag.id) : st.order.slice();
            const show = ids.slice();
            if (drag && drag.idx != null) show.splice(drag.idx, 0, '#ph');
            const depths = L.mode === 'lines' ? indentLines(show.map(id => id === '#ph' ? L.byId[drag.id].code : L.byId[id].code)) : [];
            if (!show.length) ws.appendChild(h('div', { class: 'ts-empty big', text: L.mode === 'inline' ? 'Перетягни блоки сюди, щоб зібрати абзац' : 'Перетягни блоки сюди' }));
            let n = 0;
            show.forEach((id, k) => {
              if (id === '#ph') {
                ws.appendChild(h('div', { class: (L.mode === 'lines' ? 'hrow' : 'hchip') + ' ph', style: L.mode === 'lines' ? `padding-left:${12 + depths[k] * 22}px` : '' }, L.mode === 'lines' ? h('span', { class: 'ln' }) : null, h('span', { html: chipCode(L.byId[drag.id].code) })));
                return;
              }
              const b = L.byId[id];
              n++;
              const x = locked() || b.fixed ? null : h('button', { class: 'x', title: 'Прибрати', 'aria-label': 'Прибрати блок', onclick: () => removeId(id) }, '×');
              if (L.mode === 'lines') {
                const row = h('div', { class: 'hrow' + (b.fixed ? ' fixed' : '') }, h('span', { class: 'ln', text: String(n) }),
                  h('span', { class: 'cd', style: `padding-left:${depths[k] * 22}px`, html: chipCode(b.code) }),
                  b.fixed ? h('span', { class: 'lock', text: '🔒', title: 'Цей рядок уже на місці' }) : x);
                if (!b.fixed && !locked()) dragSource(row, { enabled: () => !locked(), start: () => { drag = { id, from: 'ws', idx: null }; }, move: onMove, drop: onDrop });
                ws.appendChild(row);
              } else {
                const chip = h('div', { class: 'hchip' }, h('span', { html: chipCode(b.code) }), x);
                if (!locked()) dragSource(chip, { enabled: () => !locked(), start: () => { drag = { id, from: 'ws', idx: null }; }, move: onMove, drop: onDrop });
                ws.appendChild(chip);
              }
            });
          }
          function wsIndex(x, y) {
            const items = [...ws.querySelectorAll(L.mode === 'lines' ? '.hrow:not(.ph)' : '.hchip:not(.ph)')];
            for (let k = 0; k < items.length; k++) {
              const r = items[k].getBoundingClientRect();
              if (L.mode === 'lines') { if (y < r.top + r.height / 2) return k; }
              else if (y < r.top || (y <= r.bottom && x < r.left + r.width / 2)) return k;
            }
            return items.length;
          }
          function onMove(x, y) {
            if (!drag) return;
            const overWs = inside(ws, x, y), overPal = inside(palette, x, y);
            const idx = overWs ? wsIndex(x, y) : null;
            if (idx !== drag.idx || overPal !== drag.overPal) { drag.idx = idx; drag.overPal = overPal; renderWS(); renderPalette(); }
          }
          function onDrop() {
            const d = drag; drag = null;
            if (!d) return;
            if (d.idx != null) { const o = st.order.filter(x => x !== d.id); o.splice(d.idx, 0, d.id); st.order = o; }
            else if (d.overPal && d.from === 'ws') st.order = st.order.filter(x => x !== d.id);
            refresh();
          }
          renderInput = () => { renderPalette(); renderWS(); };
          resetBtn.onclick = () => { if (locked()) return; st.order = (L.fixed || []).map(f => f.id); refresh(); };
        } else if (L.mode === 'fill') {
          const codeBox = h('pre', { class: 'fill-code' });
          body.append(brief, h('div', { class: 'lab-grid' },
            h('div', { class: 'hb-col' }, h('div', { class: 'hb-h' }, 'Мій код ', h('span', { class: 'spacer' }), resetBtn), codeBox, h('p', { class: 'muted tiny-help', text: modeHelp })),
            right));
          const keys = slotKeys;
          const marked = L.template.replace(SLOT_RE, (_, k) => { keys.push(k); return '\u0001' + String.fromCharCode(0xE000 + keys.length - 1) + '\u0002'; });
          codeBox.innerHTML = HC.highlight(marked).replace(/\u0001([\uE000-\uE0FF])\u0002/g, (_, c) => `<span class="slot" data-k="${c.charCodeAt(0) - 0xE000}"></span>`);
          const inputs = {};
          codeBox.querySelectorAll('.slot').forEach(sp => {
            const k = keys[+sp.dataset.k];
            const cfg = (L.slots && L.slots[k]) || {};
            const inp = h('input', { class: 'fill-in', type: 'text', spellcheck: 'false', autocomplete: 'off', autocapitalize: 'off', placeholder: cfg.ph || '', 'aria-label': 'Пропуск у коді: ' + (cfg.ph || k) });
            inp.value = st.vals[k] || '';
            const size = () => { inp.style.width = Math.max((inp.value || '').length, (cfg.ph || '').length, cfg.w || 3) + 1.5 + 'ch'; };
            size();
            inp.addEventListener('input', () => { if (locked()) return; st.vals[k] = inp.value; size(); refreshSoon(); });
            inputs[k] = inp;
            sp.replaceWith(inp);
          });
          getCode = () => L.template.replace(SLOT_RE, (_, k) => st.vals[k] || '');
          renderInput = () => { for (const k in inputs) { inputs[k].disabled = locked(); } };
          resetBtn.onclick = () => { if (locked()) return; st.vals = {}; for (const k in inputs) { inputs[k].value = ''; inputs[k].dispatchEvent(new Event('input')); } refresh(); };
        } else {
          const ed = codeEditor({ small: true });
          ed.ta.value = st.code;
          goLine = ed.goLine;
          body.append(brief, h('div', { class: 'lab-grid' },
            h('div', { class: 'hb-col' }, h('div', { class: 'hb-h' }, 'Мій код', h('span', { class: 'spacer' }), resetBtn), ed.el, h('p', { class: 'muted tiny-help', text: modeHelp })),
            right));
          ed.ta.addEventListener('input', () => { if (locked()) return; st.code = ed.ta.value; ed.gut(new Set()); refreshSoon(); });
          getCode = () => st.code;
          renderInput = () => { ed.setRO(locked()); };
          setLocked = () => ed.setRO(locked());
          resetBtn.onclick = async () => {
            if (locked()) return;
            if (!(await confirmBox({ title: 'Почати заново?', html: '<p>Код повернеться до початкового стану з помилками.</p>', ok: 'Так, почати заново', cancel: 'Ні' }))) return;
            st.code = L.starter; ed.ta.value = L.starter; refresh();
          };
          edRef = ed;
        }

        function evaluate() {
          const code = getCode();
          const { A, X } = analyzeAll(code);
          let S = { missing: 0, extra: 0 };
          if (L.blocks) {
            const used = st.order.filter(id => !L.byId[id].fixed);
            const need = {}; L.blocks.filter(b => !b[2]).forEach(b => { need[b[1]] = (need[b[1]] || 0) + 1; });
            const have = {}; used.forEach(id => { const c = L.byId[id].code; have[c] = (have[c] || 0) + 1; });
            let missing = 0, extra = 0;
            for (const c of new Set([...Object.keys(need), ...Object.keys(have)])) { const dl = (have[c] || 0) - (need[c] || 0); if (dl > 0) extra += dl; else missing -= dl; }
            S = { missing, extra };
          }
          const res = L.checks.map(ch => ({ label: ch.label, ok: !!safe(() => ch.test(A, S, X)) }));
          return { code, A, X, res, passed: res.filter(r => r.ok).length };
        }
        function renderResult() {
          const E = evaluate();
          const full = L.mode === 'lines';
          view.update(full ? E.code : wrapFragment(E.code, L.tabTitle), full ? E.A.titleText : L.tabTitle, files);
          renderChecklist(checklist, E.res);
          const hasWork = L.blocks ? st.order.some(id => !L.byId[id].fixed) : true;
          const emptySlot = L.mode === 'fill' && slotKeys.some(k => !String(st.vals[k] || '').trim());
          if (emptySlot && !locked()) { errBox.innerHTML = ''; errBox.append(h('div', { class: 'hb-h', text: 'Підказки' }), h('div', { class: 'info-line', text: '✏️ Заповни всі пропуски в коді — тоді тут з’являться підказки щодо помилок.' })); }
          else renderErrors(errBox, hasWork ? E.X.errors : [], 4, goLine, 'Підказки');
          if (edRef) edRef.gut(new Set(E.X.errors.map(e => e.line)));
          return E;
        }
        function refresh() {
          renderInput();
          const E = renderResult();
          if (!locked()) saveDraft();
          return E;
        }
        const refreshSoon = debounce(() => { if (!disposed) refresh(); }, 220);
        function showLocked() {
          submitBtn.classList.add('hidden'); resetBtn.classList.add('hidden');
          setLocked();
          result.innerHTML = '';
          if (!st.submitted) { result.className = 'g-result'; return; }
          result.className = 'g-result ' + (st.score >= 100 ? 'ok' : st.score >= 60 ? 'mid' : 'bad');
          result.append(h('b', { text: `Рівень завершено: ${st.passed} з ${st.total} вимог (${st.score}%)` }));
          const next = levels.findIndex(l => !l.submitted);
          if (next >= 0 && !ro) result.append(h('button', { class: 'btn primary big', style: 'display:block;margin-top:10px', onclick: () => { cur = next; load(); } }, 'Наступний рівень →'));
          else if (next < 0) result.append(h('div', { text: `Усі рівні завершено. Загальний результат: ${totalScore()}%.` }));
        }
        let busy = false;
        submitBtn.addEventListener('click', async () => {
          if (locked() || busy) return;
          refreshSoon.cancel();
          const E = refresh();
          const failed = E.res.filter(r => !r.ok).map(r => r.label);
          if (!(await askSubmit(E.passed, E.res.length, failed)) || disposed) return;
          busy = true; submitBtn.disabled = true;
          const prev = { submitted: st.submitted, passed: st.passed, total: st.total, score: st.score, html: st.html };
          st.submitted = true; st.passed = E.passed; st.total = E.res.length;
          st.score = Math.round(100 * E.passed / E.res.length); st.html = E.code;
          saveDraft.cancel();
          const allDone = levels.every(l => l.submitted);
          try {
            await persist(totalScore(), details(), allDone);
            if (disposed) return;
            renderInput(); renderBar(); showLocked();
          } catch (e) {
            Object.assign(st, prev);
            if (disposed) return;
            toast(ctx, 'Не вдалося завершити рівень. Натисни «Завершити рівень» ще раз.', 'warn');
          } finally { busy = false; submitBtn.disabled = false; }
        });
        cleanupLevel = () => { refreshSoon.cancel(); };
        refresh();
        if (locked()) showLocked();
      }
      load();
      return () => {
        disposed = true;
        if (cleanupLevel) cleanupLevel();
        if (view) view.destroy();
        if (saveDraft.pending()) { saveDraft.cancel(); if (!finalDone && !ro) persist(totalScore(), details(), false).catch(() => {}); }
      };
    }
  };

  /* ===================================================== 3. Підсумковий редактор */
  const ED_CHECKS = [
    { label: '<!DOCTYPE html> і структура <html> → <head> → <body>', test: A => A.doctypeFirst && A.htmlRoot && A.headOk && A.bodyOk && A.headBeforeBody && A.htmlChildrenOk },
    { label: 'Мова сторінки: <html lang="uk">', test: A => !!A.html && at(A.html, 'lang') === 'uk' },
    { label: '<title> з текстом — усередині <head>', test: A => A.titleInHead && !!A.titleText },
    { label: 'Один <h1> і щонайменше один <h2>', test: A => A.all('h1').length === 1 && txt(A.all('h1')[0]) && A.all('h2').some(e => txt(e)) },
    { label: 'Щонайменше 2 абзаци <p> з текстом', test: A => A.all('p').filter(p => A.inBody(p) && txt(p).length >= 10).length >= 2 },
    { label: 'Зовнішнє посилання <a href="https://…"> із текстом', test: A => A.all('a').some(a => /^https?:\/\/\S+\.\S+/.test(at(a, 'href') || '') && (txt(a).length >= 3 || A.all('img').some(i => HC.ancestor(i, 'a') === a))) },
    { label: 'Внутрішнє посилання href="#…" веде до існуючого id', test: A => A.all('a').some(a => internalOk(A, a)) },
    { label: 'Зображення з папки images і змістовним alt', test: A => A.all('img').some(i => DEFAULT_FILES[normPath(at(i, 'src'))] && usefulAlt(at(i, 'alt'))) },
    { label: 'У кожного <img> є width — число без px', test: A => A.all('img').length > 0 && A.all('img').every(i => /^\d+$/.test(at(i, 'width') || '')) },
    { label: 'Усі теги й атрибути записано без помилок', test: (A, X) => X.errors.length === 0 }
  ];
  window.Games['html2-editor'] = {
    readonlyView: true,
    mount(host, ctx) {
      const d0 = (ctx.saved && ctx.saved.details) || {};
      const finalDone = !!(ctx.saved && ctx.saved.final);
      const ro = !!ctx.readOnly;
      const wasReturned = returnedNow(ctx, d0);
      let ack = wasReturned ? ctx.saved.returnCount : (d0.ack || 0);
      let submitted = finalDone, busy = false, disposed = false;
      const persist = saver(ctx);
      const ed = codeEditor({ placeholder: 'Почни з першого рядка:  <!DOCTYPE html>' });
      ed.ta.value = typeof d0.code === 'string' ? d0.code : '';
      const view = browserView(ctx);
      const checklist = h('ul', { class: 'checklist live' });
      const errBox = h('div', { class: 'hb-errs' });
      const result = h('div', { class: 'g-result' });
      const meter = h('div', { class: 'meter' }, h('i'));
      const meterLbl = h('div', { class: 'muted' });
      const submitBtn = h('button', { class: 'btn primary big' }, 'Завершити завдання');
      const data = ctx.task.data || {};
      const catalog = h('div', { class: 'h2-cat' });
      CATALOG.forEach(c => {
        const b = h('button', { class: 'h2-cat-item', type: 'button', title: 'Вставити шлях ' + c.path },
          h('img', { src: ctx.asset(c.path), alt: '' }), h('span', { text: c.path }));
        b.onclick = () => {
          if (ed.ta.readOnly) return;
          ed.ta.focus();
          ed.ta.setRangeText(c.path, ed.ta.selectionStart, ed.ta.selectionEnd, 'end');
          ed.ta.dispatchEvent(new Event('input'));
        };
        catalog.appendChild(b);
      });
      const cheatTags = ['<!DOCTYPE html>', '<html lang="uk"> … </html>', '<meta charset="utf-8">', '<title> … </title>', '<h1> … </h1>', '<h2 id="plan"> … </h2>', '<p> … </p>', '<ul> <li> … </li> </ul>', '<a href="https://…"> … </a>', '<a href="#plan"> … </a>', '<a href="…" target="_blank">', '<img src="images/…" alt="…" width="300">'];
      const root = h('div', { class: 'h2-ed' });
      if (wasReturned) root.appendChild(returnBanner());
      if (ro && !submitted) root.appendChild(roBanner());
      root.append(
        h('div', { class: 'brief' }, h('div', { class: 'brief-h', text: data.heading || '✍️ Сторінка-запрошення' }), h('div', { html: data.brief || '' })),
        h('div', { class: 'ed-grid' },
          h('div', { class: 'hb-col' },
            h('div', { class: 'hb-h' }, 'Код (index.html)', h('span', { class: 'spacer' }), h('span', { class: 'muted', style: 'font-weight:400;text-transform:none;letter-spacing:0', text: 'Tab — відступ' })), ed.el,
            h('details', { class: 'cheat', open: true }, h('summary', { text: '📁 Папка images — клацни, щоб вставити шлях у код' }), catalog),
            h('details', { class: 'cheat' }, h('summary', { text: '📋 Шпаргалка тегів і атрибутів' }),
              h('div', { class: 'cheat-body', html: cheatTags.map(t => `<code>${HC.highlight(t)}</code>`).join('') }))),
          h('div', { class: 'hb-col' }, h('div', { class: 'hb-h', text: 'Результат у браузері' }), view.el, view.note,
            h('div', { class: 'hb-h', style: 'margin-top:12px', text: 'Вимоги' }), meter, meterLbl, checklist, errBox,
            h('div', { style: 'margin-top:12px' }, submitBtn), result)));
      host.appendChild(root);

      const evaluate = () => {
        const { A, X } = analyzeAll(ed.ta.value);
        const res = ED_CHECKS.map(c => ({ label: c.label, ok: !!safe(() => c.test(A, X)) }));
        return { A, X, res, passed: res.filter(r => r.ok).length };
      };
      const scoreOf = E => Math.round(100 * E.passed / E.res.length);
      const saveDraft = debounce(() => {
        if (submitted || ro || disposed) return;
        const E = evaluate();
        persist(scoreOf(E), { code: ed.ta.value, ack, passed: E.passed, total: E.res.length }, false).catch(() => {
          if (!disposed) toast(ctx, 'Не вдалося зберегти чернетку. Код лишився в редакторі — продовжуй, спробуємо ще раз.', 'warn');
        });
      }, 1200);
      const update = debounce(() => {
        if (disposed) return;
        const E = evaluate();
        view.update(ed.ta.value, E.A.titleText, DEFAULT_FILES);
        renderChecklist(checklist, E.res);
        meter.firstChild.style.width = scoreOf(E) + '%';
        meter.classList.toggle('ok', E.passed === E.res.length);
        meterLbl.textContent = `Виконано ${E.passed} з ${E.res.length}`;
        renderErrors(errBox, ed.ta.value.trim() ? E.X.errors : [], 6, ed.goLine, 'Помилки в коді');
        ed.gut(new Set(E.X.errors.map(e => e.line)));
      }, 250);
      ed.ta.addEventListener('input', () => { if (submitted || ro) return; ed.gut(new Set()); update(); saveDraft(); });

      function lock() {
        ed.setRO(true);
        submitBtn.classList.add('hidden');
        if (!submitted) return;
        const E = evaluate(), sc = scoreOf(E);
        result.className = 'g-result ' + (sc >= 100 ? 'ok' : sc >= 60 ? 'mid' : 'bad');
        result.innerHTML = '';
        result.append(h('b', { text: `Завершено: ${E.passed} з ${E.res.length} вимог (${sc}%)` }));
      }
      submitBtn.addEventListener('click', async () => {
        if (submitted || ro || busy) return;
        if (!ed.ta.value.trim()) { toast(ctx, 'Спершу напиши код 🙂', 'warn'); return; }
        const E = evaluate();
        const failed = E.res.filter(r => !r.ok).map(r => r.label);
        if (!(await askSubmit(E.passed, E.res.length, failed)) || disposed) return;
        busy = true; submitBtn.disabled = true; saveDraft.cancel();
        try {
          await persist(scoreOf(E), { code: ed.ta.value, html: ed.ta.value, ack, passed: E.passed, total: E.res.length, submitted: true }, true);
          if (disposed) return;
          submitted = true; lock();
        } catch (e) {
          if (!disposed) toast(ctx, 'Не вдалося завершити. Код залишився в редакторі — натисни «Завершити завдання» ще раз.', 'warn');
        } finally { busy = false; submitBtn.disabled = false; }
      });

      update.flush();
      if (submitted || ro) lock();
      else if (wasReturned) persist(scoreOf(evaluate()), { code: ed.ta.value, ack }, false).catch(() => {});
      return () => {
        disposed = true; update.cancel(); view.destroy();
        if (saveDraft.pending()) { saveDraft.cancel(); if (!submitted && !ro) { const E = evaluate(); persist(scoreOf(E), { code: ed.ta.value, ack, passed: E.passed, total: E.res.length }, false).catch(() => {}); } }
      };
    }
  };

  /* Для автоматичних перевірок пакета */
  window.Html2Kit = { lintAttrs, analyzeAll, LAB_SETS, ED_CHECKS, describeHref };
})();
