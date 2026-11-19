/* Result summaries for the HTML tasks. Load after task-runtime.js and the game scripts. */
(function () {
  'use strict';
  const R = window.TaskRuntime;
  if (!R) return;
  const { h } = R;

  const stats = rows => h('dl', { class: 'res-stats' },
    rows.filter(Boolean).map(([k, v]) => h('div', null, h('dt', { text: k }), h('dd', { text: String(v) }))));

  /* the learner's HTML in a sandboxed frame (no scripts); relative image paths resolve next to this page */
  function preview(code, title) {
    const base = new URL('./', location.href).href;
    const src = '<base href="' + base + '">' + String(code || '');
    return h('iframe', { class: 'res-frame', sandbox: '', title: title || 'Результат у браузері', srcdoc: src });
  }
  function download(code, name, label) {
    return h('button', {
      class: 'btn small', type: 'button',
      onclick: () => {
        const a = h('a', { href: URL.createObjectURL(new Blob([String(code || '')], { type: 'text/html' })), download: name });
        document.body.append(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
      }
    }, label || '⬇ Зберегти .html');
  }

  /* sorting games: every card with the learner's answer */
  function sortSummary(d) {
    const rev = d.review || [];
    if (!rev.length) return null;
    const ok = rev.filter(r => r.right).length;
    return h('div', null,
      stats([['Правильно розкладено карток', `${ok} з ${rev.length}`]]),
      h('div', { class: 'res-block' }, h('h3', { text: 'Твої відповіді' }),
        h('ul', { class: 'res-list' }, rev.map(r => h('li', { class: r.right ? 'ok' : 'bad' },
          h('span', { class: 'res-ic', 'aria-hidden': 'true', text: r.right ? '✓' : '✗' }),
          h('span', null, h('code', { text: r.text }), r.answer === '—' ? h('small', { text: 'не розкладено' }) : null))))));
  }
  R.summaries['tag-sort'] = sortSummary;
  R.summaries['html2-sort'] = sortSummary;

  /* level games: score of each level and the page the learner built */
  function levelsSummary(sets) {
    return (d, ctx) => {
      const set = (sets() || {})[ctx.task.id] || [];
      const lv = d.levels || [];
      if (!lv.length) return null;
      return h('div', { class: 'res-block' }, h('h3', { text: 'Рівні' }),
        h('div', { class: 'res-pages' }, lv.map((l, i) => {
          const title = (set[i] && set[i].title) || 'Рівень ' + (i + 1);
          const sc = l.submitted ? l.score : null;
          return h('figure', { class: 'res-level ' + (sc === 100 ? 'ok' : sc ? 'part' : 'bad') },
            l.html ? preview(l.html, title) : h('div', { class: 'res-pic' }, h('span', { class: 'muted', text: 'не виконано' })),
            h('figcaption', null,
              h('b', { text: `${i + 1}. ${title}` }),
              h('span', { class: 'res-lvsc', text: sc == null ? '—' : `${sc}% · вимог ${l.passed} з ${l.total}` }),
              l.html ? download(l.html, `${ctx.task.id}-${i + 1}.html`, '⬇ .html') : null));
        })));
    };
  }
  R.summaries['html-builder'] = levelsSummary(() => window.HtmlGamesKit && window.HtmlGamesKit.BUILDER_SETS);
  R.summaries['html2-lab'] = levelsSummary(() => window.Html2Kit && window.Html2Kit.LAB_SETS);

  /* code editors: requirements, live result and the code itself */
  function editorSummary(d, ctx) {
    const code = d.code || d.html || '';
    const wrap = h('div');
    if (d.total != null) wrap.append(stats([['Виконано вимог', `${d.passed ?? 0} з ${d.total}`]]));
    if (code) {
      wrap.append(h('div', { class: 'res-block' },
        h('h3', { text: 'Твоя сторінка' }),
        h('div', { class: 'res-code' }, preview(code, 'Твоя сторінка'), h('pre', null, h('code', { text: code }))),
        h('div', { class: 'row', style: 'margin-top:10px' }, download(code, 'index.html', '⬇ Зберегти сторінку (index.html)'))));
    }
    return wrap;
  }
  R.summaries['html-editor'] = editorSummary;
  R.summaries['html2-editor'] = editorSummary;
})();
