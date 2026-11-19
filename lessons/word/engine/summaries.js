/* Result summaries for the Word / text document tasks. Load after task-runtime.js and the game scripts. */
(function () {
  'use strict';
  const R = window.TaskRuntime;
  if (!R) return;
  const { h } = R;
  const plain = t => String(t == null ? '' : t).replace(/<[^>]+>/g, '');

  const stats = rows => h('dl', { class: 'res-stats' },
    rows.filter(Boolean).map(([k, v]) => h('div', null, h('dt', { text: k }), h('dd', { text: String(v) }))));
  const list = (title, rows) => (rows && rows.length) ? h('div', { class: 'res-block' },
    h('h3', { text: title }),
    h('ul', { class: 'res-list' }, rows.map(([ok, text, extra]) => h('li', { class: ok ? 'ok' : 'bad' },
      h('span', { class: 'res-ic', 'aria-hidden': 'true', text: ok ? '✓' : '✗' }),
      h('span', null, text, extra ? h('small', { text: extra }) : null))))) : null;

  /* question lists keep a ready review: [{ right, text }] */
  const withReview = title => d => {
    const rev = d.review || [];
    return h('div', null,
      rev.length ? stats([['Правильно', `${rev.filter(r => r.right).length} з ${rev.length}`]]) : null,
      list(title, rev.map(r => [r.right, plain(r.text)])));
  };
  R.summaries['text-tools'] = withReview('Твої відповіді');
  R.summaries['text-props'] = withReview('Твої відповіді');
  R.summaries['text-format'] = withReview('Твої відповіді');
  R.summaries['text-view'] = withReview('Твої відповіді');
  R.summaries['text-lab'] = withReview('Лабораторія форматів');

  /* DOCX checks: the file and every check point */
  R.summaries['docx-check'] = (d, ctx) => {
    const m = d.model || {};
    const set = ((window.LessonDocxCheck || {}).CHECK_SETS || {})[d.set || (ctx.task.data || {}).set] || [];
    const res = m.results || {};
    return h('div', null,
      stats([
        m.file ? ['Перевірений файл', m.file.name] : null,
        ['Виконано пунктів', `${set.filter(c => res[c.id] && res[c.id].ok).length} з ${set.length}`],
        ['Спроб перевірки', m.tries || 0]]),
      list('Перевірка документа', set.map(c => {
        const x = res[c.id];
        return [!!(x && x.ok), c.label, x && !x.ok ? x.hint : (!x ? 'не перевірено' : '')];
      })));
  };
})();
