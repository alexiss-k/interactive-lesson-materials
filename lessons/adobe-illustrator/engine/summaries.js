/* Result summaries for the Adobe Illustrator tasks.
   Each function gets the details the game passed to ctx.finish() and returns a DOM node
   that the task runtime shows inside the result panel. Load after task-runtime.js. */
(function () {
  'use strict';
  const R = window.TaskRuntime;
  if (!R) return;
  const { h } = R;

  const stats = rows => h('dl', { class: 'res-stats' },
    rows.filter(Boolean).map(([k, v]) => h('div', null, h('dt', { text: k }), h('dd', { text: String(v) }))));
  const list = (title, items) => h('div', { class: 'res-block' },
    h('h3', { text: title }),
    h('ul', { class: 'res-list' }, items.map(([ok, text, extra]) =>
      h('li', { class: ok === true ? 'ok' : ok === false ? 'bad' : 'part' },
        h('span', { class: 'res-ic', 'aria-hidden': 'true', text: ok === true ? '✓' : ok === false ? '✗' : '◐' }),
        h('span', null, text, extra ? h('small', { text: extra }) : null)))));

  /* --- simple games --- */
  R.summaries['interface-hunt'] = d => stats([
    ['Знайдено з першої спроби', `${d.firstTry ?? 0} з ${d.total ?? 0}`],
    ['Помилкових кліків', d.mistakes ?? 0]]);
  R.summaries['hotkeys'] = d => stats([
    ['Правильно з першої спроби', `${d.firstTry ?? 0} з ${d.total ?? 0}`]]);
  R.summaries['export-match'] = d => stats([
    ['Правильно виконаних замовлень', `${d.ok ?? 0} з ${d.total ?? 0}`]]);
  R.summaries['zoom-sort'] = (d, ctx) => {
    const n = Object.keys(d.answers || {}).length;
    return stats([['Позначено зображень', n]]);
  };
  R.summaries['vector-numbers'] = d => {
    const solved = Object.keys(d.solved || {}).filter(k => d.solved[k]).length;
    return stats([['Розв’язано фігур', `${solved} з 3`]]);
  };
  R.summaries['doc-setup'] = d => {
    const res = d.res || {};
    const titles = ['Флаєр A5 для друкарні', 'Пост для Instagram', 'Візитка', 'Банер для сайту', 'Іконка застосунку'];
    return list('Замовлення', titles.map((t, i) => {
      const v = res[i];
      return [v == null ? false : v >= 100 ? true : 'part', t, v == null ? 'не виконано' : v >= 100 ? 'з першої спроби' : 'з підказкою'];
    }));
  };

  /* --- file check in real Adobe Illustrator --- */
  R.summaries['ai-file-check'] = (d, ctx) => {
    const L = d.last;
    const steps = (d.steps || []).filter(Boolean).length;
    const total = ((ctx.task.data || {}).steps || []).length;
    const wrap = h('div');
    wrap.append(stats([
      L ? ['Перевірений файл', L.name] : null,
      ['Виконано кроків', `${steps} з ${total}`],
      ['Спроб перевірки', d.attempts || 0]]));
    if (L && L.checks) wrap.append(list('Перевірка файлу', L.checks.map(c => [c.st === 'ok' ? true : c.st === 'bad' ? false : 'part', c.label, c.st === 'ok' ? '' : (c.hint || c.detail || '')])));
    return wrap;
  };

  /* --- mini-Illustrator levels: score and a picture of every level --- */
  function drawingSvg(objs, crop) {
    const C = window.MiniAICore;
    const NS = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(NS, 'svg');
    let vb = `0 0 ${C.W} ${C.H}`;
    if (crop) { const b = C.bbox(objs); if (b) { const m = 18; vb = `${b.x - m} ${b.y - m} ${b.w + 2 * m} ${b.h + 2 * m}`; } }
    svg.setAttribute('viewBox', vb);
    svg.setAttribute('xmlns', NS);
    for (const o of objs) {
      const p = document.createElementNS(NS, 'path');
      p.setAttribute('d', C.toD(o)); p.setAttribute('fill', o.f || 'none'); p.setAttribute('fill-rule', 'evenodd');
      p.setAttribute('stroke', o.s || 'none'); p.setAttribute('stroke-width', o.s ? o.w : 0); p.setAttribute('stroke-miterlimit', 10);
      svg.appendChild(p);
    }
    return svg;
  }
  R.summaries['ai-levels'] = d => {
    const C = window.MiniAICore, dbg = window.AiLevelsDebug;
    if (!C || !dbg || !d.lv) return null;
    const set = dbg.SETS[d.set] || dbg.SETS.drills;
    const grid = h('div', { class: 'res-levels' });
    set.levels.forEach((L, i) => {
      const s = d.lv[L.id];
      const touched = s && s.t;
      let sc = 0, doc = null;
      if (s && s.doc) {
        doc = C.unpackDoc(s.doc);
        if (touched) sc = dbg.scoreOf(dbg.runChecks(L, doc));
      }
      const objs = doc ? doc.objs : [];
      const pic = h('div', { class: 'res-pic' });
      if (touched && objs.length) {
        const svg = drawingSvg(objs, false);
        pic.append(svg);
      } else pic.append(h('span', { class: 'muted', text: 'не почато' }));
      const dl = touched && objs.length ? h('button', {
        class: 'btn small ghost', type: 'button', title: 'Зберегти малюнок як SVG',
        onclick: () => {
          const text = '<?xml version="1.0" encoding="UTF-8"?>\n' + new XMLSerializer().serializeToString(drawingSvg(objs, false));
          const a = h('a', { href: URL.createObjectURL(new Blob([text], { type: 'image/svg+xml' })), download: `${String(i + 1).padStart(2, '0')}-${L.id}.svg` });
          document.body.append(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
        }
      }, '⬇ SVG') : null;
      grid.append(h('figure', { class: 'res-level ' + (sc === 100 ? 'ok' : sc > 0 ? 'part' : 'bad') },
        pic,
        h('figcaption', null,
          h('b', { text: `${i + 1}. ${L.title}` }),
          h('span', { class: 'res-lvsc', text: touched ? sc + '%' : '—' }),
          dl)));
    });
    const note = set.mode === 'best' ? 'Зараховано найкращий з малюнків.' : (set.levels.length === 1 ? 'Результат — частка виконаних правил.' : `Результат — середнє за всі рівні (${set.levels.length}).`);
    return h('div', { class: 'res-block' }, h('h3', { text: 'Твої малюнки' }), h('p', { class: 'muted', text: note }), grid);
  };
})();
