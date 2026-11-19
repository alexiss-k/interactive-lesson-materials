/* Result summaries for the database / SQL / Access tasks. Load after task-runtime.js and the game scripts. */
(function () {
  'use strict';
  const R = window.TaskRuntime;
  if (!R) return;
  const { h } = R;
  const plain = t => String(t == null ? '' : t).replace(/<[^>]+>/g, '');

  const stats = rows => h('dl', { class: 'res-stats' },
    rows.filter(Boolean).map(([k, v]) => h('div', null, h('dt', { text: k }), h('dd', { text: String(v) }))));
  const ICON = { ok: '✓', bad: '✗', part: '◐' };
  const list = (title, rows) => (rows && rows.length) ? h('div', { class: 'res-block' },
    h('h3', { text: title }),
    h('ul', { class: 'res-list' }, rows.map(([st, text, extra, code]) => h('li', { class: st },
      h('span', { class: 'res-ic', 'aria-hidden': 'true', text: ICON[st] }),
      h('span', null, text,
        code ? h('pre', { class: 'res-sql' }, h('code', { text: code })) : null,
        extra ? h('small', { text: extra }) : null))))) : null;

  /* step-by-step tasks: 1 point at the first try, ½ at the second */
  const steps = title => (d, ctx) => {
    const S = (ctx.task.data || {}).steps || [];
    const st = d.steps || {};
    const pts = S.reduce((a, s) => a + ((st[s.id] && st[s.id].done) ? (st[s.id].pts || 0) : 0), 0);
    return h('div', null,
      stats([['Виконано', `${S.filter(s => st[s.id] && st[s.id].done).length} з ${S.length}`], ['Бали', `${String(pts).replace('.', ',')} з ${S.length}`]]),
      list(title, S.map((s, i) => {
        const x = st[s.id] || {};
        const state = !x.done ? 'bad' : x.pts >= 1 ? 'ok' : 'part';
        return [state, `${i + 1}. ${plain(s.title || s.text || s.q || '')}`, !x.done ? 'не виконано' : x.pts >= 1 ? 'з першої спроби' : 'з другої спроби'];
      })));
  };
  R.summaries['table-inspector'] = steps('Завдання');
  R.summaries['access-lab'] = steps('Кроки в Access');

  /* SQL: every query re-checked against the reference result */
  R.summaries['sql-lab'] = (d, ctx) => {
    const M = window.MiniSQL;
    const data = ctx.task.data || {};
    const db = data.db && Array.isArray(data.db.tables) ? data.db : { tables: [] };
    const levels = data.levels || [];
    const ans = d.answers || {};
    const rows = levels.map((l, i) => {
      const q = String(ans[l.id] || '').trim();
      let ok = false;
      if (q && M) {
        try { ok = M.compare(M.run(db, q), M.run(db, l.solution), !!l.ordered).ok; } catch (e) { ok = false; }
      }
      return [ok ? 'ok' : 'bad', `${i + 1}. ${plain(l.title || l.text || 'Завдання')}`, q ? (ok ? '' : 'результат не збігається з правильним') : 'запит не написано', q];
    });
    return h('div', null,
      stats([['Зараховано запитів', `${rows.filter(r => r[0] === 'ok').length} з ${levels.length}`]]),
      list('Твої запити', rows));
  };

  /* Access data types */
  R.summaries['type-picker'] = (d, ctx) => {
    const fields = (ctx.task.data || {}).fields || [];
    const picks = d.picks || {};
    const right = f => {
      const p = picks[f.id] || {};
      return (f.accept || []).some(a => a[0] === p.type && (a.length < 2 || a[1] === p.size));
    };
    return h('div', null,
      stats([['Правильно визначено полів', `${fields.filter(right).length} з ${fields.length}`]]),
      list('Поля', fields.map(f => {
        const p = picks[f.id] || {};
        const mine = p.type ? p.type + (p.size ? ' · ' + p.size : '') : 'не обрано';
        return [right(f) ? 'ok' : 'bad', `${f.table ? f.table + '.' : ''}${f.name}: ${mine}`, right(f) ? '' : plain(f.why)];
      })));
  };

  /* sorting cards into buckets */
  R.summaries['lk-sort'] = (d, ctx) => {
    const data = ctx.task.data || {};
    const items = data.items || [];
    const names = Object.fromEntries((data.buckets || []).map(b => [b.id, b.label]));
    const place = d.place || {};
    return h('div', null,
      stats([['Правильно розкладено', `${items.filter(it => place[it.id] === it.bucket).length} з ${items.length}`]]),
      list('Твої відповіді', items.map(it => {
        const ok = place[it.id] === it.bucket;
        return [ok ? 'ok' : 'bad', plain(it.text), ok ? '' : `правильно: ${plain(names[it.bucket] || it.bucket)}. ${plain(it.why || '')}`];
      })));
  };
})();
