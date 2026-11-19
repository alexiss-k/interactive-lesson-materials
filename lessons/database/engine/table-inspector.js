/* table-inspector — click the field, record or value a step asks for; spot key, type and format errors.
   Requires lesson-kit.js before it in `scripts`.
   Task data: {
     table: { name, columns: [{ name, type }], rows: [{ id, cells: […] }] },
     steps: [{ id, kind: 'col'|'row'|'cell', answers: ['house' | 'r4' | 'r3:birth_date'], text, why }]
   }
   Selection keys: 'col:<column>', 'row:<rowId>', 'cell:<rowId>:<column>'.
   Two attempts per step: right first time = 1 point, second time = ½, otherwise 0 and the answer is shown.
   Score = points / steps, sent only on submit (drafts send 0). After a teacher return, steps without a full
   point reopen. Details: { steps: {stepId: { tries, pick, done, pts }}, cur, ack }. */
(() => {
  'use strict';
  const K = window.LessonKit;
  const KIND_WORD = { col: 'поле (стовпець)', row: 'запис (рядок)', cell: 'значення (клітинку)' };
  const KIND_HOW = { col: 'клацни заголовок стовпця', row: 'клацни номер рядка ліворуч', cell: 'клацни клітинку' };

  window.Games = window.Games || {};
  window.Games['table-inspector'] = {
    readonlyView: true,
    mount(host, ctx) {
      const life = K.lifecycle();
      const data = ctx.task.data || {};
      const table = data.table || { name: '', columns: [], rows: [] };
      const steps = Array.isArray(data.steps) ? data.steps : [];
      const d0 = (ctx.saved && ctx.saved.details) || {};
      const ret = K.returnInfo(ctx);
      let locked = K.isLocked(ctx), busy = false;

      const st = {};
      const savedSteps = d0.steps && typeof d0.steps === 'object' ? d0.steps : {};
      steps.forEach(s => {
        const x = savedSteps[s.id];
        st[s.id] = x && typeof x === 'object'
          ? { tries: x.tries | 0, pick: typeof x.pick === 'string' ? x.pick : '', done: !!x.done, pts: Number(x.pts) || 0 }
          : { tries: 0, pick: '', done: false, pts: 0 };
      });
      let cur = Number.isInteger(d0.cur) && d0.cur >= 0 && d0.cur < steps.length ? d0.cur : 0;
      let sel = '';                     // current selection (not yet checked)
      let feedback = null;              // { kind: 'ok'|'bad'|'try', text, why }

      if (ret.isNew && !locked) {       // returned: reopen steps without a full point
        steps.forEach(s => { if (st[s.id].pts < 1) st[s.id] = { tries: 0, pick: '', done: false, pts: 0 }; });
        const first = steps.findIndex(s => !st[s.id].done);
        if (first >= 0) cur = first;
      }

      const parseKey = k => {
        const [kind, a, b] = String(k).split(':');
        return { kind, row: kind === 'col' ? null : a, col: kind === 'col' ? a : (kind === 'cell' ? b : null) };
      };
      const isRight = (s, key) => {
        const p = parseKey(key);
        if (p.kind !== s.kind) return false;
        const id = p.kind === 'col' ? p.col : p.kind === 'row' ? p.row : `${p.row}:${p.col}`;
        return (s.answers || []).includes(id);
      };
      const points = () => steps.reduce((a, s) => a + (st[s.id].done ? st[s.id].pts : 0), 0);
      const scoreNow = () => steps.length ? Math.round(100 * points() / steps.length) : 0;
      const doneCount = () => steps.filter(s => st[s.id].done).length;
      const fmtPts = p => p === 1 ? '1' : p === 0.5 ? '½' : '0';
      const fmtTotal = p => (Number.isInteger(p) ? String(p) : String(Math.floor(p)) + '½').replace(/^0½$/, '½');

      /* ---------- DOM ---------- */
      const status = K.h('p', { class: 'ti-status', role: 'status', 'aria-live': 'polite' });
      const save = K.saver(ctx, {
        life,
        getDetails: () => ({ steps: st, cur, ack: ret.ack }),
        onError: (e, final) => { if (!life.disposed && !final) status.textContent = 'Чернетку не збережено — відповіді залишаються на екрані.'; }
      });
      const chips = K.h('ol', { class: 'ti-steps', 'aria-label': 'Завдання' });
      const qNum = K.h('div', { class: 'ti-qnum' });
      const qText = K.h('p', { class: 'ti-qtext' });
      const pickInfo = K.h('p', { class: 'ti-pick' });
      const fb = K.h('div', { class: 'ti-fb', 'aria-live': 'polite' });
      const checkBtn = K.h('button', { type: 'button', class: 'btn primary ti-check' }, 'Перевірити');
      const nextBtn = K.h('button', { type: 'button', class: 'btn ghost ti-next hidden', 'data-readonly-ok': '' }, 'Далі →');
      const tableBox = K.h('div', { class: 'ti-table-wrap', role: 'region', 'aria-label': `Таблиця ${table.name}`, tabindex: '0' });
      const progress = K.h('div', { class: 'ti-progress' });
      const submit = K.h('button', { type: 'button', class: 'btn primary ti-submit' }, 'Завершити завдання');
      const root = K.h('div', { class: 'table-inspector' },
        K.banners(ctx),
        K.h('div', { class: 'ti-howto' },
          K.h('span', null, K.h('b', null, 'Поле'), ' — клацни заголовок стовпця'),
          K.h('span', null, K.h('b', null, 'Запис'), ' — клацни номер рядка'),
          K.h('span', null, K.h('b', null, 'Значення'), ' — клацни клітинку')),
        chips,
        K.h('div', { class: 'ti-q' }, qNum, qText, pickInfo, K.h('div', { class: 'ti-actions' }, checkBtn, nextBtn), fb),
        K.h('div', { class: 'ti-tname' }, 'Таблиця ', K.h('code', { text: table.name })),
        tableBox,
        K.h('div', { class: 'ti-foot' }, progress, submit),
        status);
      host.append(root);

      /* ---------- table (built once; classes updated on render) ---------- */
      const cellsByKey = new Map();     // key → [elements to mark]
      const buttons = [];
      const addMark = (key, el) => { if (!cellsByKey.has(key)) cellsByKey.set(key, []); cellsByKey.get(key).push(el); };
      const choose = key => {
        if (locked || busy) return;
        const s = steps[cur];
        if (!s || st[s.id].done) return;
        sel = key; feedback = null; render();
      };
      const mkBtn = (cls, key, label, kids) => {
        const b = K.h('button', { type: 'button', class: cls, 'data-key': key, 'aria-label': label }, kids);
        life.listen(b, 'click', () => choose(key));
        buttons.push(b);
        return b;
      };
      const cols = table.columns || [];
      const tbl = K.h('table', { class: 'ti-table' });
      const headRow = K.h('tr', null, K.h('th', { class: 'ti-corner', scope: 'col' }, '№'));
      cols.forEach(c => {
        const key = 'col:' + c.name;
        const th = K.h('th', { scope: 'col' }, mkBtn('ti-colbtn', key, `Поле ${c.name}`,
          [K.h('span', { class: 'ti-cname', text: c.name }), K.h('span', { class: 'ti-ctype', text: c.type || '' })]));
        addMark(key, th);
        headRow.append(th);
      });
      tbl.append(K.h('thead', null, headRow));
      const tbody = K.h('tbody');
      (table.rows || []).forEach((r, i) => {
        const rowKey = 'row:' + r.id;
        const tr = K.h('tr');
        const rh = K.h('th', { scope: 'row' }, mkBtn('ti-rowbtn', rowKey, `Запис ${i + 1}`, String(i + 1)));
        addMark(rowKey, rh);
        tr.append(rh);
        cols.forEach((c, j) => {
          const v = r.cells[j];
          const key = `cell:${r.id}:${c.name}`;
          const td = K.h('td', null, mkBtn('ti-cellbtn' + (v == null ? ' ti-nul' : ''), key,
            `Значення: ${v == null ? 'NULL' : v}, поле ${c.name}, запис ${i + 1}`, v == null ? 'NULL' : String(v)));
          addMark(key, td); addMark('col:' + c.name, td); addMark(rowKey, td);
          tr.append(td);
        });
        tbody.append(tr);
      });
      tbl.append(tbody);
      tableBox.append(tbl);

      const keyLabel = key => {
        const p = parseKey(key);
        const ri = (table.rows || []).findIndex(r => r.id === p.row);
        if (p.kind === 'col') return `поле ${p.col}`;
        if (p.kind === 'row') return `запис № ${ri + 1}`;
        const r = table.rows[ri], j = cols.findIndex(c => c.name === p.col);
        const v = r ? r.cells[j] : '';
        return `значення ${v == null ? 'NULL' : '«' + v + '»'} (поле ${p.col}, запис № ${ri + 1})`;
      };
      /* ---------- render ---------- */
      function render() {
        const s = steps[cur];
        const S = s ? st[s.id] : null;
        chips.replaceChildren(...steps.map((x, i) => {
          const y = st[x.id];
          const mark = y.done ? (y.pts === 1 ? '✓' : y.pts === 0.5 ? '½' : '✗') : '';
          const cls = 'ti-chip' + (i === cur ? ' ti-cur' : '') + (y.done ? (y.pts === 1 ? ' ti-ok' : y.pts > 0 ? ' ti-half' : ' ti-bad') : '');
          const b = K.h('button', { type: 'button', class: cls, 'data-readonly-ok': '', 'aria-current': i === cur ? 'step' : null,
            'aria-label': `Завдання ${i + 1}` + (y.done ? `, бали: ${fmtPts(y.pts)}` : '') }, String(i + 1), mark ? K.h('span', { 'aria-hidden': 'true' }, ' ' + mark) : null);
          b.addEventListener('click', () => { if (busy) return; cur = i; sel = ''; feedback = null; render(); if (!locked) save.draft(); });
          return K.h('li', null, b);
        }));

        // marks on the table
        for (const els of cellsByKey.values()) els.forEach(el => el.classList.remove('ti-sel', 'ti-picked', 'ti-rev', 'ti-wrong'));
        const shownPick = S && S.done ? S.pick : sel;
        if (shownPick && cellsByKey.has(shownPick)) cellsByKey.get(shownPick).forEach(el => el.classList.add(S && S.done ? (isRight(s, S.pick) ? 'ti-picked' : 'ti-wrong') : 'ti-sel'));
        if (S && S.done && !isRight(s, S.pick)) (s.answers || []).forEach(a => {
          const k = s.kind === 'cell' ? 'cell:' + a : `${s.kind}:${a}`;
          (cellsByKey.get(k) || []).forEach(el => el.classList.add('ti-rev'));
        });
        const firstMiss = S && !S.done && S.tries === 1 && S.pick && !sel && cellsByKey.has(S.pick);
        if (firstMiss) cellsByKey.get(S.pick).forEach(el => el.classList.add('ti-wrong'));

        if (s) {
          qNum.textContent = `Завдання ${cur + 1} з ${steps.length}`;
          qText.textContent = s.text || '';
          if (S.done) pickInfo.textContent = S.pick ? `Твоя відповідь: ${keyLabel(S.pick)}.` : '';
          else pickInfo.textContent = sel ? `Позначено: ${keyLabel(sel)}.` : (locked ? 'Відповіді немає.' : `Обери ${KIND_WORD[s.kind] || 'відповідь'} у таблиці й натисни «Перевірити».`);
          fb.replaceChildren();
          let f = feedback;
          if (!f && S.done) f = isRight(s, S.pick)
            ? { kind: 'ok', text: S.pts === 1 ? '✓ Правильно з першої спроби: 1 бал.' : '✓ Правильно з другої спроби: ½ бала.', why: s.why }
            : { kind: 'bad', text: '✗ Спроби скінчилися: 0 балів. Правильну відповідь виділено.', why: s.why };
          if (!f && !S.done && S.tries === 1 && !sel && !locked) f = { kind: 'try', text: '✗ Перша спроба не вдалася. Залишилася одна.', why: '' };
          if (f) fb.append(K.h('div', { class: 'ti-verdict ti-v-' + f.kind }, K.h('b', { text: f.text }), f.why ? K.h('p', { text: f.why }) : null));
        }
        const unfinished = steps.length - doneCount();
        progress.textContent = `Виконано: ${doneCount()} з ${steps.length} · бали: ${fmtTotal(points())} з ${steps.length}`;
        checkBtn.classList.toggle('hidden', locked || !S || S.done);
        checkBtn.disabled = busy || !sel;
        nextBtn.classList.toggle('hidden', !(S && S.done) || cur >= steps.length - 1);
        submit.classList.toggle('hidden', locked);
        submit.disabled = busy;
        submit.textContent = unfinished ? 'Завершити завдання' : 'Завершити завдання ✓';
        const canPick = !locked && !busy && S && !S.done;
        buttons.forEach(b => { b.disabled = !canPick; });
      }

      /* ---------- events ---------- */
      life.listen(checkBtn, 'click', () => {
        if (locked || busy || !sel) return;
        const s = steps[cur], S = st[s.id];
        if (S.done) return;
        S.tries += 1; S.pick = sel;
        const p = parseKey(sel);
        if (isRight(s, sel)) {
          S.done = true; S.pts = S.tries === 1 ? 1 : 0.5;
          feedback = null;
        } else if (S.tries >= 2) {
          S.done = true; S.pts = 0;
          feedback = null;
        } else {
          const kindMsg = p.kind !== s.kind
            ? `Ти позначив(-ла) ${KIND_WORD[p.kind]}, а треба ${KIND_WORD[s.kind]}: ${KIND_HOW[s.kind]}.`
            : 'Це не та відповідь.';
          feedback = { kind: 'try', text: '✗ ' + kindMsg + ' Залишилася одна спроба.', why: '' };
        }
        sel = '';
        render();
        save.draft();
      });
      life.listen(nextBtn, 'click', () => {
        if (cur < steps.length - 1) { cur += 1; sel = ''; feedback = null; render(); if (!locked) save.draft(); }
      });
      life.listen(submit, 'click', async () => {
        if (locked || busy) return;
        const left = steps.length - doneCount();
        if (left > 0) {
          const list = steps.map((s, i) => st[s.id].done ? '' : `<li>Завдання ${i + 1}</li>`).join('');
          const ok = await K.confirm({
            title: 'Не всі завдання виконано',
            html: `<p>Виконано <b>${doneCount()} з ${steps.length}</b>. За невиконані завдання — 0 балів:</p><ul>${list}</ul><p>Завершити як є? Після завершення змінити роботу вже не можна.</p>`,
            ok: 'Так, завершити', cancel: 'Ще попрацюю', danger: true
          });
          if (!ok || life.disposed || locked) return;
        }
        busy = true; render(); status.textContent = 'Підбиваю підсумок…';
        const score = scoreNow();
        try {
          await save.final(score);
          if (life.disposed) return;
          locked = true; sel = '';
          status.textContent = `Завершено: ${score}%.`;
        } catch (e) {
          if (life.disposed) return;
          status.textContent = 'Не вдалося завершити. Натисни «Завершити завдання» ще раз.';
        } finally {
          busy = false;
          if (!life.disposed) render();
        }
      });

      render();
      if (locked) status.textContent = K.isFinal(ctx) ? `Завершено: ${ctx.saved.score}%.` : 'Режим перегляду.';
      else if (ret.isNew) save.draft();
      return () => life.dispose();
    }
  };
})();
