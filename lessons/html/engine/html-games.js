/* HTML-практика: «Правильний тег чи помилка?», конструктор з блоків (drag-and-drop), редактор коду */
(function () {
  'use strict';
  const { h, esc, confirmBox } = window.App;
  const HC = window.HtmlCore;
  window.Games = window.Games || {};

  const seedOf = ctx => (ctx.student ? ctx.student.name + '|' + ctx.student.cls : 'x');
  const debounce = (fn, ms) => { let t; const d = (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; d.flush = (...a) => { clearTimeout(t); fn(...a); }; return d; };

  /* Повернення на доопрацювання: чи треба знову відкрити роботу */
  function returnedNow(ctx, details) {
    const s = ctx.saved;
    return !!(s && !s.final && (s.returnCount || 0) > ((details && details.ack) || 0));
  }
  function returnBanner() {
    return h('div', { class: 'ret-banner' }, '↩ ', h('b', { text: 'Вчитель повернув роботу на доопрацювання.' }), ' Виправ помилки і здай ще раз.');
  }

  /* Підтвердження завершення */
  async function askSubmit(passed, total, failed) {
    if (passed === total) return true;
    const list = failed.length ? '<ul class="cf-list">' + failed.map(f => `<li>✗ ${esc(f)}</li>`).join('') + '</ul>' : '';
    return confirmBox({
      title: 'Не всі вимоги виконано',
      html: `<p>Виконано <b>${passed} з ${total}</b>.</p>${list}<p>Ти впевнений(-а), що хочеш завершити як є? Після завершення змінити роботу вже не можна.</p>`,
      ok: 'Так, завершити', cancel: 'Ні, ще попрацюю', danger: true
    });
  }

  /* Перетягування (pointer events — працює і з мишею, і з тачпадом) */
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
        document.body.classList.remove('is-dragging');
        if (!dragging) { opts.click && opts.click(); return; }
        ghost.remove();
        opts.drop && opts.drop(ev.clientX, ev.clientY);
      };
      document.addEventListener('pointermove', move);
      document.addEventListener('pointerup', up);
    });
  }
  const inside = (el, x, y) => { const r = el.getBoundingClientRect(); return x >= r.left && x <= r.right && y >= r.top && y <= r.bottom; };

  /* Код блоку з видимими пробілами на краях */
  function chipCode(code) {
    const m = /^(\s*)([\s\S]*?)(\s*)$/.exec(code);
    const dots = s => s ? `<span class="sp">${'·'.repeat(s.length)}</span>` : '';
    return dots(m[1]) + HC.highlight(m[2]) + dots(m[3]);
  }

  /* =====================================================================
     1. Правильний тег чи помилка?
     ===================================================================== */
  const TAG_ITEMS = [
    { id: 't1', t: '<p>', ok: true, why: 'Відкривальний тег абзацу.' },
    { id: 't2', t: '</b>', ok: true, why: 'Закривальний тег: коса риска / перед назвою.' },
    { id: 't3', t: '<li>', ok: true, why: 'Пункт списку.' },
    { id: 't4', t: '<title>', ok: true, why: 'Назва сторінки на вкладці.' },
    { id: 't5', t: '</body>', ok: true, why: 'Закриває тіло сторінки.' },
    { id: 't6', t: '<br>', ok: true, why: 'Одиночний тег переносу рядка — закривального не потребує.' },
    { id: 'f1', t: 'p>', ok: false, why: 'Бракує відкривальної дужки «<».' },
    { id: 'f2', t: '<b', ok: false, why: 'Бракує закривальної дужки «>».' },
    { id: 'f3', t: '<\\p>', ok: false, why: 'Потрібна коса риска «/», а не «\\».' },
    { id: 'f4', t: '[ul]', ok: false, why: 'Теги пишуть лише в кутових дужках < >.' },
    { id: 'f5', t: '< li>', ok: false, why: 'Після «<» не можна ставити пробіл.' },
    { id: 'f6', t: '<tittle>', ok: false, why: 'Помилка в назві: правильно title.' }
  ];
  window.Games['tag-sort'] = {
    readonlyView: true,
    mount(host, ctx) {
      const d0 = (ctx.saved && ctx.saved.details) || {};
      const place = Object.assign({}, d0.place || {});     // id → 'ok' | 'bad'
      let submitted = !!(ctx.saved && ctx.saved.final) || (!!d0.submitted && !returnedNow(ctx, d0));
      let ack = d0.ack || 0;
      const wasReturned = returnedNow(ctx, d0);
      if (wasReturned) { submitted = false; ack = ctx.saved.returnCount; }
      const items = HC.shuffleSeed(TAG_ITEMS, seedOf(ctx) + '|tags');
      let selected = null;

      const pool = h('div', { class: 'ts-zone ts-pool' });
      const bOk = h('div', { class: 'ts-zone ts-bucket ok' });
      const bBad = h('div', { class: 'ts-zone ts-bucket bad' });
      const result = h('div', { class: 'g-result' });
      const submitBtn = h('button', { class: 'btn primary big' }, 'Завершити й перевірити');
      if (wasReturned) host.appendChild(returnBanner());
      host.append(
        h('p', { class: 'muted', html: 'Перетягни кожну картку в кошик. Можна й так: клікни картку, потім — кошик. Поки не здав, картки можна переставляти.' }),
        h('div', { class: 'ts-label', text: 'Картки' }), pool,
        h('div', { class: 'ts-buckets' },
          h('div', null, h('div', { class: 'ts-label ok', text: '✅ Правильно записаний тег' }), bOk),
          h('div', null, h('div', { class: 'ts-label bad', text: '❌ Помилка в записі' }), bBad)),
        h('div', { class: 'row', style: 'margin-top:14px' }, submitBtn), result);

      const save = debounce(() => { if (!submitted) ctx.complete(0, { place, ack }).catch(() => {}); }, 1200);
      const zoneOf = (x, y) => inside(bOk, x, y) ? 'ok' : inside(bBad, x, y) ? 'bad' : inside(pool, x, y) ? null : undefined;
      function render() {
        [pool, bOk, bBad].forEach(z => { z.innerHTML = ''; z.classList.remove('hot'); });
        for (const it of items) {
          const where = place[it.id] || null;
          const card = h('div', { class: 'ts-card' + (selected === it.id ? ' sel' : '') }, h('code', { text: it.t }));
          if (submitted) {
            const right = where === (it.ok ? 'ok' : 'bad');
            card.classList.add(right ? 'right' : 'wrong');
            card.appendChild(h('div', { class: 'why', text: right ? '✓ ' + it.why : (it.ok ? '✗ Це правильний тег. ' : '✗ Тут помилка. ') + it.why }));
          } else {
            dragSource(card, {
              enabled: () => !submitted,
              move: (x, y) => { const z = zoneOf(x, y); bOk.classList.toggle('hot', z === 'ok'); bBad.classList.toggle('hot', z === 'bad'); pool.classList.toggle('hot', z === null); },
              drop: (x, y) => { const z = zoneOf(x, y); if (z !== undefined) { if (z) place[it.id] = z; else delete place[it.id]; save(); } selected = null; render(); },
              click: () => { selected = selected === it.id ? null : it.id; render(); }
            });
          }
          (where === 'ok' ? bOk : where === 'bad' ? bBad : pool).appendChild(card);
        }
        if (!pool.children.length) pool.appendChild(h('div', { class: 'ts-empty', text: submitted ? '' : 'Усі картки розкладено 👍' }));
        [bOk, bBad].forEach(b => { if (!b.children.length) b.appendChild(h('div', { class: 'ts-empty', text: 'Перетягни картки сюди' })); });
        submitBtn.classList.toggle('hidden', submitted);
      }
      const clickZone = (zone, val) => zone.addEventListener('click', e => {
        if (submitted || !selected || e.target.closest('.ts-card')) return;
        if (val) place[selected] = val; else delete place[selected];
        selected = null; save(); render();
      });
      clickZone(bOk, 'ok'); clickZone(bBad, 'bad'); clickZone(pool, null);

      function showResult() {
        const okN = items.filter(it => place[it.id] === (it.ok ? 'ok' : 'bad')).length;
        const score = Math.round(100 * okN / items.length);
        result.className = 'g-result ' + (score >= 75 ? 'ok' : 'bad');
        result.innerHTML = '';
        result.append(h('b', { text: `Правильно: ${okN} з ${items.length} (${score}%)` }), h('div', { text: 'Під кожною карткою — пояснення.' }));
        return { okN, score };
      }
      submitBtn.addEventListener('click', async () => {
        const unsorted = items.filter(it => !place[it.id]).length;
        const ok = await confirmBox({
          title: 'Завершити й перевірити?',
          html: (unsorted ? `<p>Не розкладено карток: <b>${unsorted}</b> — вони рахуватимуться як помилки.</p>` : '') +
            '<p>Ти впевнений(-а)? Після завершення змінити відповіді вже не можна.</p>',
          ok: 'Так, завершити', cancel: 'Ще подумаю', danger: !!unsorted
        });
        if (!ok) return;
        submitted = true;
        render();
        const { score } = showResult();
        const review = items.map(it => ({ text: it.t, right: place[it.id] === (it.ok ? 'ok' : 'bad'), answer: place[it.id] || '—' }));
        try { await ctx.finish(score, { place, submitted: true, ack, review }); } catch (e) {}
      });
      render();
      if (submitted) showResult();
      else if (wasReturned) ctx.complete(0, { place, ack }).catch(() => {});
    }
  };

  /* =====================================================================
     2. Конструктор з блоків
     ===================================================================== */
  const C = {
    noErrors: { label: 'Усі теги правильно закриті й вкладені', test: A => A.errors.length === 0 },
    usedAll: { label: 'Використано всі блоки', test: (A, S) => S.missing === 0 && S.extra === 0 },
    onlyNeeded: { label: 'Використано всі потрібні блоки і жодного зайвого', test: (A, S) => S.missing === 0 && S.extra === 0 },
    doctype: { label: '<!DOCTYPE html> — перший рядок', test: A => A.doctypeFirst },
    htmlRoot: { label: '<html> обгортає всю сторінку', test: A => A.htmlRoot },
    head: { label: '<head> — всередині <html>, перед <body>', test: A => A.headOk && A.headBeforeBody },
    body: { label: '<body> — всередині <html>', test: A => A.bodyOk && A.htmlChildrenOk },
    title: { label: '<title> — всередині <head>', test: A => A.titleInHead },
    known: { label: 'Немає тегів з помилками в назві', test: A => A.unknown === 0 }
  };
  const onlyP = A => { const k = HC.kids(A.root); return k.length === 1 && k[0].tag === 'p' && !A.root.children.some(c => c.type === 'text' && c.text.trim()) ? k[0] : null; };
  const pWraps = { label: 'Усе вкладено в один абзац <p>', test: A => !!onlyP(A) };
  const pText = t => ({ label: `Текст абзацу: «${t}»`, test: A => { const p = onlyP(A); return !!p && HC.norm(HC.text(p)) === t; } });
  const boldSet = words => ({
    label: words.length === 1 ? `Жирне — лише «${words[0]}» (<b> всередині <p>)` : `Жирні — «${words.join('» і «')}»`,
    test: A => { const bs = A.all('b'); return bs.length === words.length && bs.every(b => HC.ancestor(b, 'p')) && bs.map(b => HC.norm(HC.text(b))).sort().join('|') === words.slice().sort().join('|'); }
  });
  const listIn = (tag, n, words) => ({
    label: `Усі ${n} пункти <li> — всередині <${tag}>`,
    test: A => { const lis = A.all('li'); return lis.length === n && lis.every(li => li.parent.tag === tag); }
  });
  const firstBefore = (a, b, label) => ({
    label,
    test: A => { const x = A.all(a)[0], y = A.all(b)[0]; if (!x || !y || !A.body) return false; const k = HC.kids(A.body); const ix = k.indexOf(x), iy = k.indexOf(y); return ix >= 0 && iy >= 0 && ix < iy; }
  });

  const SKEL = title => [
    { id: 'f1', code: '<!DOCTYPE html>' }, { id: 'f2', code: '<html lang="uk">' }, { id: 'f3', code: '<head>' },
    { id: 'f4', code: `<title>${title}</title>` }, { id: 'f5', code: '</head>' }, { id: 'f6', code: '<body>' },
    { id: 'f7', code: '</body>' }, { id: 'f8', code: '</html>' }
  ];

  const BUILDER_SETS = {
    nest: [
      { title: 'Жирне слово', mode: 'inline', tabTitle: 'Абзац',
        brief: 'Збери абзац <b>«Я вивчаю HTML»</b>, у якому слово <b>HTML</b> — жирне.',
        blocks: [['a', '<p>'], ['b', 'Я вивчаю '], ['c', '<b>'], ['d', 'HTML'], ['e', '</b>'], ['f', '</p>']],
        checks: [C.noErrors, pWraps, pText('Я вивчаю HTML'), boldSet(['HTML']), C.usedAll] },
      { title: 'Два жирні фрагменти', mode: 'inline', tabTitle: 'Оголошення',
        brief: 'Збери абзац <b>«Увага! Урок о 8:30»</b>, де жирні — «Увага!» і «8:30».',
        blocks: [['a', '<p>'], ['b', '<b>'], ['c', 'Увага!'], ['d', '</b>'], ['e', ' Урок о '], ['f', '<b>'], ['g', '8:30'], ['h', '</b>'], ['i', '</p>']],
        checks: [C.noErrors, pWraps, pText('Увага! Урок о 8:30'), boldSet(['Увага!', '8:30']), C.usedAll] },
      { title: 'Знайди зайве', mode: 'inline', tabTitle: 'Погода',
        brief: 'Збери абзац <b>«Сьогодні дуже спекотно»</b> з жирним словом «дуже». <b>Два блоки — зайві!</b>',
        blocks: [['a', '<p>'], ['b', 'Сьогодні '], ['c', '<b>'], ['d', 'дуже'], ['e', '</b>'], ['f', ' спекотно'], ['g', '</p>'], ['x1', '</b>', 1], ['x2', '<p>', 1]],
        checks: [C.noErrors, pWraps, pText('Сьогодні дуже спекотно'), boldSet(['дуже']), C.onlyNeeded] }
    ],
    page: [
      { title: 'Каркас сторінки', mode: 'lines',
        brief: 'Склади з блоків правильну HTML-сторінку. Порядок і вкладеність — як на слайді «Скелет HTML-сторінки».',
        blocks: [['dt', '<!DOCTYPE html>'], ['ho', '<html>'], ['hc', '</html>'], ['heo', '<head>'], ['hec', '</head>'], ['ti', '<title>Моя перша сторінка</title>'], ['bo', '<body>'], ['bc', '</body>'], ['p', '<p>Привіт! Це моя сторінка.</p>']],
        checks: [C.doctype, C.htmlRoot, C.head, C.title, C.body, { label: 'Абзац <p> — всередині <body>', test: A => { const ps = A.all('p'); return ps.length > 0 && ps.every(A.inBody); } }, C.noErrors, C.usedAll] },
      { title: 'Сторінка «Погода»', mode: 'lines',
        brief: 'Збери сторінку з назвою вкладки <b>«Погода в Ужгороді»</b> і двома абзацами. <b>Три блоки — зайві</b>: знайди помилки!',
        blocks: [['dt', '<!DOCTYPE html>'], ['ho', '<html lang="uk">'], ['hc', '</html>'], ['heo', '<head>'], ['hec', '</head>'], ['ti', '<title>Погода в Ужгороді</title>'], ['bo', '<body>'], ['bc', '</body>'],
          ['p1', '<p>Сьогодні <b>сонячно</b>.</p>'], ['p2', '<p>Температура: +18°</p>'],
          ['x1', '<tittle>Погода</tittle>', 1], ['x2', '</head>', 1], ['x3', '<body>', 1]],
        checks: [C.doctype, C.htmlRoot, C.head, { label: 'Назва вкладки «Погода в Ужгороді» — у <title> всередині <head>', test: A => A.titleInHead && A.titleText === 'Погода в Ужгороді' }, C.body,
          { label: 'Обидва абзаци — всередині <body>', test: A => { const ps = A.all('p'); return ps.length === 2 && ps.every(A.inBody); } }, C.known, C.noErrors, C.onlyNeeded] }
    ],
    lists: [
      { title: 'Список покупок', mode: 'lines', fixed: SKEL('Покупки'), insertBefore: 'f7',
        brief: 'Каркас уже готовий 🔒. Додай у <b>&lt;body&gt;</b> підпис і <b>маркований</b> список із трьох покупок.',
        blocks: [['p', '<p><b>Купити в магазині:</b></p>'], ['uo', '<ul>'], ['uc', '</ul>'], ['l1', '<li>Хліб</li>'], ['l2', '<li>Молоко</li>'], ['l3', '<li>Яблука</li>']],
        checks: [{ label: 'Список <ul> — всередині <body>', test: A => { const u = A.all('ul'); return u.length === 1 && A.inBody(u[0]); } },
          listIn('ul', 3), firstBefore('p', 'ul', 'Підпис (абзац) — перед списком'), C.noErrors, C.usedAll] },
      { title: 'Рецепт', mode: 'lines', fixed: SKEL('Рецепт чаю'), insertBefore: 'f7',
        brief: 'Додай назву рецепта і <b>кроки в правильному порядку</b>. Подумай, який список потрібен для кроків. <b>Два блоки — зайві.</b>',
        blocks: [['p', '<p><b>Чай з лимоном</b></p>'], ['oo', '<ol>'], ['oc', '</ol>'],
          ['s1', '<li>Закип\'ятити воду</li>'], ['s2', '<li>Покласти чайний пакетик у чашку</li>'], ['s3', '<li>Залити окропом</li>'], ['s4', '<li>Додати скибочку лимона</li>'],
          ['x1', '<ul>', 1], ['x2', '</ul>', 1]],
        checks: [{ label: 'Для кроків — нумерований список <ol>', test: A => { const o = A.all('ol'); return o.length === 1 && A.all('ul').length === 0 && A.inBody(o[0]); } },
          listIn('ol', 4),
          { label: 'Кроки — у правильному порядку', test: A => A.all('li').map(li => HC.norm(HC.text(li))).join('|') === ['Закип\'ятити воду', 'Покласти чайний пакетик у чашку', 'Залити окропом', 'Додати скибочку лимона'].join('|') },
          firstBefore('p', 'ol', 'Назва рецепта (абзац) — перед списком'), C.noErrors, C.onlyNeeded] }
    ]
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

  window.Games['html-builder'] = {
    readonlyView: true,
    mount(host, ctx) {
      const SET = BUILDER_SETS[ctx.task.id];
      if (!SET) { host.textContent = 'Немає рівнів для цього завдання'; return; }
      const d0 = (ctx.saved && ctx.saved.details) || {};
      const finalDone = !!(ctx.saved && ctx.saved.final);
      const wasReturned = returnedNow(ctx, d0);
      let ack = wasReturned ? ctx.saved.returnCount : (d0.ack || 0);
      const seed = seedOf(ctx) + '|' + ctx.task.id;

      const levels = SET.map((L, i) => {
        L.byId = L.byId || Object.fromEntries([...(L.fixed || []).map(f => [f.id, { id: f.id, code: f.code, fixed: true }]), ...L.blocks.map(([id, code, dis]) => [id, { id, code, dis: !!dis }])]);
        const sv = (d0.levels || [])[i] || {};
        let order = Array.isArray(sv.order) ? sv.order.filter(id => L.byId[id]) : null;
        if (!order) order = (L.fixed || []).map(f => f.id);
        for (const f of (L.fixed || [])) if (!order.includes(f.id)) order.push(f.id);
        return { order, submitted: !!sv.submitted, score: sv.score || 0, passed: sv.passed || 0, total: sv.total || L.checks.length, html: sv.html || '', paletteOrder: HC.shuffleSeed(L.blocks.map(b => b[0]), seed + i) };
      });
      if (wasReturned) {
        const imperfect = levels.filter(l => l.submitted && l.score < 100);
        (imperfect.length ? imperfect : levels).forEach(l => { l.submitted = false; });
      }
      if (finalDone) levels.forEach(l => { l.submitted = true; });
      let cur = levels.findIndex(l => !l.submitted);
      if (cur < 0) cur = 0;

      const details = () => ({ ack, levels: levels.map(l => ({ order: l.order, submitted: l.submitted, score: l.score, passed: l.passed, total: l.total, html: l.html })) });
      const totalScore = () => Math.round(levels.reduce((a, l) => a + (l.submitted ? l.score : 0), 0) / levels.length);
      const saveDraft = debounce(() => { if (!finalDone) ctx.complete(totalScore(), details()).catch(() => {}); }, 1500);

      const bar = h('div', { class: 'lvl-bar' });
      const body = h('div');
      if (wasReturned) host.appendChild(returnBanner());
      host.append(bar, body);
      if (wasReturned) ctx.complete(totalScore(), details()).catch(() => {});

      function renderBar() {
        bar.innerHTML = '';
        levels.forEach((l, i) => {
          const open = i === 0 || levels[i - 1].submitted || l.submitted;
          const b = h('button', { class: 'lvl' + (i === cur ? ' cur' : '') + (l.submitted ? ' done' : ''), disabled: !open, title: SET[i].title },
            h('span', { class: 'n', text: open ? i + 1 : '🔒' }), h('span', { class: 'st', text: l.submitted ? `готово · ${l.score}%` : SET[i].title }));
          b.onclick = () => { cur = i; load(); };
          bar.appendChild(b);
        });
        bar.appendChild(h('div', { class: 'lvl-total' }, 'Результат: ', h('b', { text: totalScore() + '%' })));
      }

      function load() {
        renderBar();
        const L = SET[cur], st = levels[cur];
        const locked = () => st.submitted;
        body.innerHTML = '';
        const palette = h('div', { class: 'hb-pal' });
        const ws = h('div', { class: 'hb-ws ' + L.mode });
        const bv = HC.browserView();
        const checklist = h('ul', { class: 'checklist live' });
        const errBox = h('div', { class: 'hb-errs' });
        const result = h('div', { class: 'g-result' });
        const submitBtn = h('button', { class: 'btn primary big' }, 'Завершити рівень');
        const resetBtn = h('button', { class: 'btn small', onclick: () => { st.order = (L.fixed || []).map(f => f.id); refresh(); } }, '⟲ Почати заново');
        body.append(
          h('div', { class: 'brief' }, h('div', { class: 'brief-h', text: `Рівень ${cur + 1}. ${L.title}` }), h('div', { html: L.brief })),
          h('div', { class: 'hb-grid' },
            h('div', { class: 'hb-col' }, h('div', { class: 'hb-h', text: 'Блоки' }), palette,
              h('p', { class: 'muted tiny-help', text: L.mode === 'inline' ? 'Перетягни блок у рядок коду або клікни — він додасться в кінець.' : 'Перетягни блок у потрібне місце або клікни — він додасться в кінець.' })),
            h('div', { class: 'hb-col' }, h('div', { class: 'hb-h' }, 'Мій код ', h('span', { class: 'spacer' }), resetBtn), ws),
            h('div', { class: 'hb-col' }, h('div', { class: 'hb-h', text: 'Результат у браузері' }), bv.el,
              h('div', { class: 'hb-h', style: 'margin-top:12px', text: 'Перевірка' }), checklist, errBox,
              h('div', { style: 'margin-top:12px' }, submitBtn), result)));

        let drag = null; // { id, from: 'pal'|'ws', idx }
        const codeOf = ids => ids.map(id => L.byId[id].code);
        function genCode(ids) {
          const codes = codeOf(ids);
          if (L.mode === 'inline') return codes.join('');
          const dep = indentLines(codes);
          return codes.map((c, i) => '  '.repeat(dep[i]) + c).join('\n');
        }
        function evaluate() {
          const code = genCode(st.order);
          const A = HC.analyze(code);
          const used = st.order.filter(id => !L.byId[id].fixed);
          const need = {}; L.blocks.filter(b => !b[2]).forEach(b => { need[b[1]] = (need[b[1]] || 0) + 1; });
          const have = {}; used.forEach(id => { const c = L.byId[id].code; have[c] = (have[c] || 0) + 1; });
          let missing = 0, extra = 0;
          for (const c of new Set([...Object.keys(need), ...Object.keys(have)])) {
            const dlt = (have[c] || 0) - (need[c] || 0);
            if (dlt > 0) extra += dlt; else missing -= dlt;
          }
          const S = { missing, extra };
          const res = L.checks.map(ch => ({ label: ch.label, ok: !!safe(() => ch.test(A, S)) }));
          return { code, A, res, passed: res.filter(r => r.ok).length };
        }
        const safe = f => { try { return f(); } catch (e) { return false; } };

        function renderPalette() {
          palette.innerHTML = '';
          palette.classList.toggle('hot', !!drag && drag.from === 'ws' && drag.overPal);
          const used = new Set(st.order);
          const free = st.paletteOrder.filter(id => !used.has(id));
          if (locked()) { palette.appendChild(h('div', { class: 'ts-empty', text: 'Рівень завершено' })); return; }
          if (!free.length) palette.appendChild(h('div', { class: 'ts-empty', text: 'Усі блоки використано' }));
          for (const id of free) {
            const blk = h('div', { class: 'hblk', html: chipCode(L.byId[id].code) });
            if (drag && drag.id === id) blk.classList.add('dragging-src');
            dragSource(blk, {
              enabled: () => !locked(),
              start: () => { drag = { id, from: 'pal', idx: null }; },
              move: onMove, drop: onDrop,
              click: () => { insertAt(defaultIndex(), id); }
            });
            palette.appendChild(blk);
          }
        }
        function defaultIndex() {
          if (L.insertBefore) { const k = st.order.indexOf(L.insertBefore); if (k >= 0) return k; }
          return st.order.length;
        }
        function insertAt(idx, id) {
          const o = st.order.filter(x => x !== id);
          o.splice(Math.max(0, Math.min(o.length, idx)), 0, id);
          st.order = o;
          refresh();
        }
        function renderWS() {
          ws.innerHTML = '';
          ws.classList.toggle('hot', !!drag && drag.idx != null);
          const ids = drag && drag.from === 'ws' ? st.order.filter(x => x !== drag.id) : st.order.slice();
          const show = ids.slice();
          if (drag && drag.idx != null) show.splice(drag.idx, 0, '#ph');
          const depths = L.mode === 'lines' ? indentLines(show.map(id => id === '#ph' ? (L.byId[drag.id].code) : L.byId[id].code)) : [];
          if (!show.length) ws.appendChild(h('div', { class: 'ts-empty big', text: L.mode === 'inline' ? 'Перетягни блоки сюди, щоб зібрати абзац' : 'Перетягни блоки сюди' }));
          let n = 0;
          show.forEach((id, k) => {
            if (id === '#ph') {
              ws.appendChild(h('div', { class: (L.mode === 'lines' ? 'hrow' : 'hchip') + ' ph', style: L.mode === 'lines' ? `padding-left:${12 + depths[k] * 22}px` : '' }, L.mode === 'lines' ? h('span', { class: 'ln' }) : null, h('span', { html: chipCode(L.byId[drag.id].code) })));
              return;
            }
            const b = L.byId[id];
            n++;
            if (L.mode === 'lines') {
              const row = h('div', { class: 'hrow' + (b.fixed ? ' fixed' : '') },
                h('span', { class: 'ln', text: n }),
                h('span', { class: 'cd', style: `padding-left:${depths[k] * 22}px`, html: chipCode(b.code) }),
                b.fixed ? h('span', { class: 'lock', text: '🔒', title: 'Цей рядок уже на місці' }) : (locked() ? null : h('button', { class: 'x', title: 'Прибрати', onclick: () => { st.order = st.order.filter(x => x !== id); refresh(); } }, '×')));
              if (!b.fixed && !locked()) dragSource(row, { enabled: () => !locked(), start: () => { drag = { id, from: 'ws', idx: null }; }, move: onMove, drop: onDrop });
              ws.appendChild(row);
            } else {
              const chip = h('div', { class: 'hchip' }, h('span', { html: chipCode(b.code) }),
                locked() ? null : h('button', { class: 'x', title: 'Прибрати', onclick: () => { st.order = st.order.filter(x => x !== id); refresh(); } }, '×'));
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
          const overWs = inside(ws, x, y);
          const overPal = inside(palette, x, y);
          const idx = overWs ? wsIndex(x, y) : null;
          if (idx !== drag.idx || overPal !== drag.overPal) {
            drag.idx = idx; drag.overPal = overPal;
            renderWS(); renderPalette();
          }
        }
        function onDrop() {
          const d = drag; drag = null;
          if (!d) return;
          if (d.idx != null) {
            const o = st.order.filter(x => x !== d.id);
            o.splice(d.idx, 0, d.id);
            st.order = o;
          } else if (d.overPal && d.from === 'ws') {
            st.order = st.order.filter(x => x !== d.id);
          }
          refresh();
        }

        function renderResult() {
          const E = evaluate();
          bv.update(L.mode === 'inline' ? `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${L.tabTitle}</title></head><body>${E.code}</body></html>` : E.code,
            L.mode === 'inline' ? L.tabTitle : E.A.titleText);
          checklist.innerHTML = '';
          E.res.forEach(r => checklist.appendChild(h('li', { class: r.ok ? 'ok' : 'todo' }, h('span', { class: 'mk', text: r.ok ? '✓' : '○' }), h('span', { html: HC.escH(r.label).replace(/&lt;(\/?[!\w]+[^&]*?)&gt;/g, '<code>&lt;$1&gt;</code>') }))));
          errBox.innerHTML = '';
          if (E.A.errors.length && st.order.some(id => !L.byId[id].fixed)) {
            errBox.appendChild(h('div', { class: 'hb-h', text: 'Підказки' }));
            E.A.errors.slice(0, 3).forEach(e => errBox.appendChild(h('div', { class: 'err-line', text: L.mode === 'lines' ? `Рядок ${e.line}: ${e.msg}` : e.msg })));
          }
          return E;
        }
        function refresh() {
          renderPalette(); renderWS();
          const E = renderResult();
          if (!locked()) saveDraft();
          return E;
        }
        function showLocked() {
          submitBtn.classList.add('hidden'); resetBtn.classList.add('hidden');
          result.className = 'g-result ' + (st.score >= 100 ? 'ok' : st.score >= 60 ? 'mid' : 'bad');
          result.innerHTML = '';
          result.append(h('b', { text: `Рівень завершено: ${st.passed} з ${st.total} вимог (${st.score}%)` }));
          const next = levels.findIndex(l => !l.submitted);
          if (next >= 0) result.append(h('button', { class: 'btn primary big', style: 'display:block;margin-top:10px', onclick: () => { cur = next; load(); } }, 'Наступний рівень →'));
        }

        submitBtn.addEventListener('click', async () => {
          const E = evaluate();
          const failed = E.res.filter(r => !r.ok).map(r => r.label);
          if (!(await askSubmit(E.passed, E.res.length, failed))) return;
          st.submitted = true; st.passed = E.passed; st.total = E.res.length;
          st.score = Math.round(100 * E.passed / E.res.length); st.html = E.code;
          refresh(); renderBar(); showLocked();
          const allDone = levels.every(l => l.submitted);
          try {
            if (allDone) await ctx.finish(totalScore(), details());
            else await ctx.complete(totalScore(), details());
          } catch (e) {}
        });

        refresh();
        if (locked()) showLocked();
      }
      load();
    }
  };

  /* =====================================================================
     3. Редактор коду: сторінка «Про мене»
     ===================================================================== */
  const ED_CHECKS = [
    { label: '<!DOCTYPE html> — перший рядок', test: A => A.doctypeFirst },
    { label: '<html> обгортає всю сторінку', test: A => A.htmlRoot },
    { label: '<head> і <body> — всередині <html>, спершу <head>', test: A => A.headOk && A.bodyOk && A.headBeforeBody && A.htmlChildrenOk },
    { label: '<title> з текстом — всередині <head>', test: A => A.titleInHead && !!A.titleText },
    { label: 'Щонайменше 2 абзаци <p> у <body>', test: A => A.all('p').filter(p => A.inBody(p) && HC.norm(HC.text(p))).length >= 2 },
    { label: 'Жирний текст <b> — всередині абзацу', test: A => A.all('b').some(b => HC.ancestor(b, 'p') && HC.norm(HC.text(b))) },
    { label: 'Маркований список <ul> — щонайменше 3 пункти <li>', test: A => A.all('ul').some(u => A.inBody(u) && HC.kids(u).filter(k => k.tag === 'li').length >= 3) },
    { label: 'Нумерований список <ol> — щонайменше 3 пункти <li>', test: A => A.all('ol').some(o => A.inBody(o) && HC.kids(o).filter(k => k.tag === 'li').length >= 3) },
    { label: 'Пункти <li> — лише всередині <ul> або <ol>', test: A => A.all('li').length > 0 && A.liOk && A.listsOk },
    { label: 'Усі теги правильно записані, закриті й вкладені', test: A => A.errors.length === 0 }
  ];
  const labelHtml = s => HC.escH(s).replace(/&lt;(\/?[!\w]+[^&]*?)&gt;/g, '<code>&lt;$1&gt;</code>');

  window.HtmlGamesKit = { BUILDER_SETS };

  window.Games['html-editor'] = {
    readonlyView: true,
    mount(host, ctx) {
      const d0 = (ctx.saved && ctx.saved.details) || {};
      const finalDone = !!(ctx.saved && ctx.saved.final);
      const wasReturned = returnedNow(ctx, d0);
      let ack = wasReturned ? ctx.saved.returnCount : (d0.ack || 0);
      let submitted = finalDone;
      const ta = h('textarea', { class: 'ed-ta', spellcheck: 'false', autocapitalize: 'off', autocomplete: 'off', wrap: 'off',
        placeholder: 'Почни з першого рядка:  <!DOCTYPE html>' });
      ta.value = d0.code || '';
      const gutter = h('div', { class: 'ed-gut' });
      const editor = h('div', { class: 'ed' }, gutter, ta);
      const bv = HC.browserView();
      const checklist = h('ul', { class: 'checklist live' });
      const errBox = h('div', { class: 'hb-errs' });
      const result = h('div', { class: 'g-result' });
      const meter = h('div', { class: 'meter' }, h('i'));
      const meterLbl = h('div', { class: 'muted' });
      const submitBtn = h('button', { class: 'btn primary big' }, 'Завершити завдання');
      if (wasReturned) host.appendChild(returnBanner());
      host.append(
        h('div', { class: 'brief' }, h('div', { class: 'brief-h', text: '✍️ Напиши сторінку «Про мене»' }),
          h('div', { html: 'Пиши код сам, без блоків. Назва вкладки — твоє ім\'я; 2 абзаци про себе з <b>жирним</b> текстом; маркований список (хобі, улюблені речі) і нумерований список (топ-3 фільмів, ігор чи план на день). Праворуч одразу видно результат і які вимоги виконано.' })),
        h('div', { class: 'ed-grid' },
          h('div', { class: 'hb-col' }, h('div', { class: 'hb-h' }, 'Код (index.html)', h('span', { class: 'spacer' }), h('span', { class: 'muted', style: 'font-weight:400;text-transform:none;letter-spacing:0', text: 'Tab — відступ' })), editor,
            h('details', { class: 'cheat' }, h('summary', { text: '📋 Шпаргалка тегів' }),
              h('div', { class: 'cheat-body', html: ['<!DOCTYPE html>', '<html lang="uk"> … </html>', '<head> … </head>', '<meta charset="utf-8">', '<title> … </title>', '<body> … </body>', '<p> … </p>', '<b> … </b>', '<br>', '<ul> … </ul>', '<ol> … </ol>', '<li> … </li>'].map(t => `<code>${HC.highlight(t)}</code>`).join('') }))),
          h('div', { class: 'hb-col' }, h('div', { class: 'hb-h', text: 'Результат у браузері' }), bv.el,
            h('div', { class: 'hb-h', style: 'margin-top:12px', text: 'Вимоги' }), meter, meterLbl, checklist, errBox,
            h('div', { style: 'margin-top:12px' }, submitBtn), result)));

      const evaluate = () => {
        const A = HC.analyze(ta.value);
        const res = ED_CHECKS.map(c => { let ok = false; try { ok = !!c.test(A); } catch (e) {} return { label: c.label, ok }; });
        return { A, res, passed: res.filter(r => r.ok).length };
      };
      const scoreOf = E => Math.round(100 * E.passed / E.res.length);
      const saveDraft = debounce(() => {
        if (submitted) return;
        const E = evaluate();
        ctx.complete(scoreOf(E), { code: ta.value, ack, passed: E.passed, total: E.res.length }).catch(() => {});
      }, 1500);

      function renderGutter(errLines) {
        const n = Math.max(1, ta.value.split('\n').length);
        let html = '';
        for (let i = 1; i <= n; i++) html += `<div class="${errLines.has(i) ? 'err' : ''}">${i}</div>`;
        gutter.innerHTML = html;
        gutter.scrollTop = ta.scrollTop;
      }
      const update = debounce(() => {
        const E = evaluate();
        bv.update(ta.value, E.A.titleText);
        checklist.innerHTML = '';
        E.res.forEach(r => checklist.appendChild(h('li', { class: r.ok ? 'ok' : 'todo' }, h('span', { class: 'mk', text: r.ok ? '✓' : '○' }), h('span', { html: labelHtml(r.label) }))));
        meter.firstChild.style.width = scoreOf(E) + '%';
        meter.classList.toggle('ok', E.passed === E.res.length);
        meterLbl.textContent = `Виконано ${E.passed} з ${E.res.length}`;
        errBox.innerHTML = '';
        if (E.A.errors.length && ta.value.trim()) {
          errBox.appendChild(h('div', { class: 'hb-h', text: 'Помилки в коді' }));
          E.A.errors.slice(0, 5).forEach(e => {
            const line = h('div', { class: 'err-line clickable', text: `Рядок ${e.line}: ${e.msg}` });
            line.onclick = () => goLine(e.line);
            errBox.appendChild(line);
          });
          if (E.A.errors.length > 5) errBox.appendChild(h('div', { class: 'muted', text: `…і ще ${E.A.errors.length - 5}` }));
        }
        renderGutter(new Set(E.A.errors.map(e => e.line)));
      }, 250);
      function goLine(n) {
        const lines = ta.value.split('\n');
        const start = lines.slice(0, n - 1).reduce((a, l) => a + l.length + 1, 0);
        ta.focus();
        ta.setSelectionRange(start, start + (lines[n - 1] || '').length);
        ta.scrollTop = Math.max(0, (n - 4) * 22);
      }
      ta.addEventListener('input', () => { renderGutter(new Set()); update(); saveDraft(); });
      ta.addEventListener('scroll', () => { gutter.scrollTop = ta.scrollTop; });
      ta.addEventListener('keydown', e => {
        if (ta.readOnly) return;
        if (e.key === 'Tab') {
          e.preventDefault();
          const s = ta.selectionStart;
          ta.setRangeText('  ', s, ta.selectionEnd, 'end');
          ta.dispatchEvent(new Event('input'));
        } else if (e.key === 'Enter') {
          const s = ta.selectionStart;
          const lineStart = ta.value.lastIndexOf('\n', s - 1) + 1;
          const indent = /^[ \t]*/.exec(ta.value.slice(lineStart, s))[0];
          if (indent) {
            e.preventDefault();
            ta.setRangeText('\n' + indent, s, ta.selectionEnd, 'end');
            ta.dispatchEvent(new Event('input'));
          }
        }
      });

      function lock() {
        ta.readOnly = true;
        editor.classList.add('ro');
        submitBtn.classList.add('hidden');
        const E = evaluate();
        const sc = scoreOf(E);
        result.className = 'g-result ' + (sc >= 100 ? 'ok' : sc >= 60 ? 'mid' : 'bad');
        result.innerHTML = '';
        result.append(h('b', { text: `Завершено: ${E.passed} з ${E.res.length} вимог (${sc}%)` }));
      }
      submitBtn.addEventListener('click', async () => {
        const E = evaluate();
        if (!ta.value.trim()) { window.App.toast('Спершу напиши код 🙂', 'warn'); return; }
        const failed = E.res.filter(r => !r.ok).map(r => r.label);
        if (!(await askSubmit(E.passed, E.res.length, failed))) return;
        submitted = true;
        lock();
        try { await ctx.finish(scoreOf(E), { code: ta.value, html: ta.value, ack, passed: E.passed, total: E.res.length, submitted: true }); } catch (e) {}
      });

      update.flush();
      if (submitted) lock();
      else if (wasReturned) ctx.complete(scoreOf(evaluate()), { code: ta.value, ack }).catch(() => {});
    }
  };
})();
