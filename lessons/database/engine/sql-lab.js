/* sql-lab — write SQL queries against a small in-browser database (MiniSQL) and get checked feedback.
   Requires lesson-kit.js and mini-sql.js before it in `scripts`.
   Task data: {
     brief: '<trusted author HTML>',
     db: { tables: [{ name, columns: [{ name, type, desc }], rows: [[…]] }] },
     glossary: [['English', 'українською'], …],
     levels: [{ id, text, hint, solution: 'SELECT …', ordered?: true, starter?: '' }]
   }
   A level counts when the learner's result equals the result of `solution` (columns in order, rows as a
   multiset, or in sequence when `ordered`). Drafts are saved with score 0; the score is the share of
   counted levels at the moment of submission. Details: { answers: {levelId: sql}, cur, ack }. */
(() => {
  'use strict';
  const K = window.LessonKit;
  const M = window.MiniSQL;
  const MAX_SHOWN = 60;

  window.Games = window.Games || {};
  window.Games['sql-lab'] = {
    readonlyView: true,
    mount(host, ctx) {
      const life = K.lifecycle();
      const data = ctx.task.data || {};
      const db = data.db && Array.isArray(data.db.tables) ? data.db : { tables: [] };
      const levels = Array.isArray(data.levels) ? data.levels : [];
      const d0 = (ctx.saved && ctx.saved.details) || {};
      const ret = K.returnInfo(ctx);
      const saved = d0.answers && typeof d0.answers === 'object' ? d0.answers : {};
      const answers = {};
      levels.forEach(l => { answers[l.id] = typeof saved[l.id] === 'string' ? saved[l.id] : (l.starter || ''); });
      let cur = Number.isInteger(d0.cur) && d0.cur >= 0 && d0.cur < levels.length ? d0.cur : 0;
      let locked = K.isLocked(ctx), busy = false;

      const expected = {};
      levels.forEach(l => { try { expected[l.id] = M.run(db, l.solution); } catch (e) { expected[l.id] = null; } });
      function check(l) {
        const q = (answers[l.id] || '').trim();
        if (!q) return { state: 'empty' };
        let res;
        try { res = M.run(db, q); } catch (e) { return { state: 'error', err: e }; }
        const exp = expected[l.id];
        if (!exp) return { state: 'wrong', res, verdict: { why: 'Для цього завдання немає еталона — повідом учителя.', hint: '' } };
        const v = M.compare(res, exp, !!l.ordered);
        return { state: v.ok ? 'ok' : 'wrong', res, verdict: v };
      }
      const countPassed = () => levels.filter(l => check(l).state === 'ok').length;
      const scoreNow = () => levels.length ? Math.round(100 * countPassed() / levels.length) : 0;

      /* ---------- DOM ---------- */
      const status = K.h('p', { class: 'sl-status', role: 'status', 'aria-live': 'polite' });
      const save = K.saver(ctx, {
        life,
        getDetails: () => ({ answers, cur, ack: ret.ack }),
        onError: (e, final) => {
          if (life.disposed || final) return;
          status.textContent = e.code === 'details_too_large' ? e.message : 'Чернетку не збережено — запити залишаються на екрані.';
        }
      });
      const tabs = K.h('div', { class: 'sl-tabs', role: 'tablist', 'aria-label': 'Завдання' });
      const taskTitle = K.h('h3', { class: 'sl-task-title' });
      const taskText = K.h('p', { class: 'sl-task-text' });
      const hintBox = K.h('details', { class: 'sl-hint' }, K.h('summary', null, 'Підказка'), K.h('p'));
      const editor = K.h('textarea', {
        class: 'sl-code', spellcheck: 'false', autocapitalize: 'off', autocomplete: 'off', autocorrect: 'off',
        rows: '5', 'aria-label': 'Твій SQL-запит', placeholder: 'SELECT … FROM …'
      });
      const runBtn = K.h('button', { type: 'button', class: 'btn dark sl-run' }, '▶ Виконати');
      const nextBtn = K.h('button', { type: 'button', class: 'btn ghost sl-next hidden', 'data-readonly-ok': '' }, 'Наступне завдання →');
      const keyHint = K.h('span', { class: 'sl-key' }, 'або Ctrl + Enter');
      const out = K.h('div', { class: 'sl-out', 'aria-live': 'polite' });
      const progress = K.h('div', { class: 'sl-progress' });
      const submit = K.h('button', { type: 'button', class: 'btn primary sl-submit' }, 'Завершити завдання');

      const side = K.h('aside', { class: 'sl-side', 'aria-label': 'Будова бази даних' },
        db.tables.map(t => K.h('div', { class: 'sl-schema' },
          K.h('div', { class: 'sl-schema-title' }, 'Таблиця ', K.h('code', { text: t.name })),
          K.h('ul', null, t.columns.map(c => K.h('li', null,
            K.h('code', { class: 'sl-col', text: c.name }),
            K.h('span', { class: 'sl-type', text: c.type || '' }),
            c.desc ? K.h('span', { class: 'sl-desc', text: c.desc }) : null))))),
        Array.isArray(data.glossary) && data.glossary.length ? K.h('details', { class: 'sl-gloss' },
          K.h('summary', null, 'Словничок'),
          K.h('table', null, K.h('tbody', null, data.glossary.map(([en, uk]) =>
            K.h('tr', null, K.h('td', null, K.h('code', { text: en })), K.h('td', { text: uk })))))) : null);

      const root = K.h('div', { class: 'sql-lab' },
        K.banners(ctx),
        data.brief ? K.h('div', { class: 'sl-brief', html: data.brief }) : null,
        tabs,
        K.h('div', { class: 'sl-grid' },
          K.h('div', { class: 'sl-main' },
            K.h('div', { class: 'sl-task' }, taskTitle, taskText, hintBox),
            K.h('label', { class: 'sl-label' }, 'Твій запит', editor),
            K.h('div', { class: 'sl-actions' }, runBtn, keyHint, nextBtn),
            out),
          side),
        K.h('div', { class: 'sl-foot' }, progress, submit),
        status);
      host.append(root);

      /* ---------- rendering ---------- */
      function resultTable(res) {
        const shown = res.rows.slice(0, MAX_SHOWN);
        const table = K.h('table', { class: 'sl-res' },
          K.h('thead', null, K.h('tr', null, res.columns.map(c => K.h('th', { text: c })))),
          K.h('tbody', null, shown.map(r => K.h('tr', null, r.map(v =>
            K.h('td', { class: v == null ? 'sl-nul' : (typeof v === 'number' ? 'sl-num' : null), text: M.format(v) }))))));
        const n = res.rows.length;
        return K.h('div', null,
          K.h('div', { class: 'sl-count' }, `Рядків у результаті: ${n}` + (n > MAX_SHOWN ? ` (показано ${MAX_SHOWN})` : '')),
          n ? K.h('div', { class: 'sl-table-wrap', tabindex: '0', role: 'region', 'aria-label': 'Результат запиту' }, table)
            : K.h('p', { class: 'sl-empty' }, 'Жоден запис не відповідає умові.'));
      }
      function showResult(ran) {
        const l = levels[cur];
        out.replaceChildren();
        if (!l) return;
        const c = check(l);
        if (c.state === 'empty') {
          if (ran) out.append(K.h('div', { class: 'sl-verdict sl-v-err' }, K.h('b', null, '✗ Запит порожній. '), 'Напиши запит у полі вище.'));
          return;
        }
        if (c.state === 'error') {
          out.append(K.h('div', { class: 'sl-verdict sl-v-err' },
            K.h('b', null, '✗ Помилка в запиті. '), K.h('span', { text: c.err.message }),
            c.err.hint ? K.h('p', { class: 'sl-why', text: c.err.hint }) : null));
          return;
        }
        if (c.state === 'ok') out.append(K.h('div', { class: 'sl-verdict sl-v-ok' }, K.h('b', null, '✓ Правильно! '), 'Завдання зараховано.'));
        else out.append(K.h('div', { class: 'sl-verdict sl-v-bad' },
          K.h('b', null, '✗ Запит виконано, але результат не той. '), K.h('span', { text: c.verdict.why }),
          c.verdict.hint ? K.h('p', { class: 'sl-why', text: c.verdict.hint }) : null,
          (c.res.notices || []).map(n => K.h('p', { class: 'sl-why', text: '⚠ ' + n }))));
        out.append(resultTable(c.res));
      }
      function renderTabs() {
        tabs.replaceChildren(...levels.map((l, i) => {
          const st = check(l).state;
          const b = K.h('button', {
            type: 'button', role: 'tab', class: 'sl-tab' + (i === cur ? ' sl-cur' : '') + (st === 'ok' ? ' sl-done' : ''),
            'aria-selected': i === cur ? 'true' : 'false', 'data-readonly-ok': '',
            'aria-label': `Завдання ${i + 1}` + (st === 'ok' ? ', зараховано' : '')
          }, String(i + 1), st === 'ok' ? K.h('span', { 'aria-hidden': 'true' }, ' ✓') : null);
          b.addEventListener('click', () => go(i));     // removed with the node on the next render
          return b;
        }));
      }
      function render(ran) {
        const l = levels[cur];
        if (l) {
          taskTitle.textContent = `Завдання ${cur + 1} з ${levels.length}`;
          taskText.textContent = l.text || '';
          hintBox.querySelector('p').textContent = l.hint || '';
          hintBox.classList.toggle('hidden', !l.hint);
          if (editor.value !== answers[l.id]) editor.value = answers[l.id];
        }
        renderTabs();
        showResult(ran);
        const p = countPassed();
        progress.textContent = `Зараховано: ${p} з ${levels.length}`;
        const okHere = l && check(l).state === 'ok';
        nextBtn.classList.toggle('hidden', !(okHere && cur < levels.length - 1));
        editor.readOnly = locked || busy;
        runBtn.classList.toggle('hidden', locked);
        keyHint.classList.toggle('hidden', locked);
        submit.classList.toggle('hidden', locked);
        runBtn.disabled = busy; submit.disabled = busy;
      }
      function go(i) {
        if (i < 0 || i >= levels.length || i === cur) return;
        cur = i; editor.value = answers[levels[cur].id];
        render(false);
        if (!locked) save.draft();
      }
      function runNow() {
        if (locked || busy) return;
        render(true);
        save.draft();
      }

      /* ---------- events ---------- */
      life.listen(editor, 'input', () => {
        const l = levels[cur];
        if (!l) return;
        if (locked || busy) { editor.value = answers[l.id]; return; }
        answers[l.id] = editor.value;
        status.textContent = '';
        save.draft();
      });
      life.listen(editor, 'keydown', e => {
        if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); runNow(); return; }
        if (e.key !== 'Tab' || e.shiftKey || locked || busy) return;
        e.preventDefault();
        editor.setRangeText('  ', editor.selectionStart, editor.selectionEnd, 'end');
        editor.dispatchEvent(new Event('input'));
      });
      life.listen(runBtn, 'click', runNow);
      life.listen(nextBtn, 'click', () => { go(cur + 1); editor.focus(); });
      life.listen(submit, 'click', async () => {
        if (locked || busy) return;
        const p = countPassed();
        if (p < levels.length) {
          const missing = levels.map((l, i) => check(l).state === 'ok' ? '' : `<li>Завдання ${i + 1}</li>`).join('');
          const ok = await K.confirm({
            title: 'Не всі завдання зараховано',
            html: `<p>Зараховано <b>${p} з ${levels.length}</b>. Ще не зараховано:</p><ul>${missing}</ul><p>Завершити як є? Після завершення змінити роботу вже не можна.</p>`,
            ok: 'Так, завершити', cancel: 'Ще попрацюю', danger: true
          });
          if (!ok || life.disposed || locked) return;
        }
        busy = true; render(false); status.textContent = 'Підбиваю підсумок…';
        const score = scoreNow();
        try {
          await save.final(score);
          if (life.disposed) return;
          locked = true;
          status.textContent = `Завершено: ${score}%. Зараховано ${countPassed()} з ${levels.length}.`;
        } catch (e) {
          if (life.disposed) return;
          status.textContent = e.code === 'details_too_large' ? e.message : 'Не вдалося завершити. Натисни «Завершити завдання» ще раз.';
        } finally {
          busy = false;
          if (!life.disposed) render(false);
        }
      });

      render(false);
      if (locked) status.textContent = K.isFinal(ctx)
        ? `Завершено: ${ctx.saved.score}%. Зараховано ${countPassed()} з ${levels.length}.`
        : 'Режим перегляду.';
      else if (ret.isNew) save.draft();       // acknowledge the return once
      return () => life.dispose();
    }
  };
})();
