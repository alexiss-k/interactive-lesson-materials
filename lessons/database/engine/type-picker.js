/* type-picker — choose the Access data type (and the Number field size) for each field from sample values.
   Requires lesson-kit.js before it in `scripts`.
   Task data: {
     types: ['Короткий текст', …, 'Не зберігати в базі'],
     sizes: ['Байт', …],                               // shown only when the type is 'Число'
     fields: [{ id, table, name, samples: [..], accept: [[type] | [type, size], …], why }]
   }
   A field counts when the chosen [type] (or [type, size] for 'Число') is in `accept`.
   Results and explanations appear after submission. Score = correct fields / all fields, sent only on submit
   (drafts send 0). After a teacher return the wrong rows are reopened and the right ones stay as they were.
   Details: { picks: { fieldId: { type, size } }, ack }. */
(() => {
  'use strict';
  const K = window.LessonKit;
  const NUMBER = 'Число';

  window.Games = window.Games || {};
  window.Games['type-picker'] = {
    readonlyView: true,
    mount(host, ctx) {
      const life = K.lifecycle();
      const data = ctx.task.data || {};
      const types = Array.isArray(data.types) ? data.types : [];
      const sizes = Array.isArray(data.sizes) ? data.sizes : [];
      const fields = Array.isArray(data.fields) ? data.fields : [];
      const d0 = (ctx.saved && ctx.saved.details) || {};
      const ret = K.returnInfo(ctx);
      let locked = K.isLocked(ctx), busy = false;
      let showResults = K.isFinal(ctx) || (ctx.readOnly && !!ctx.saved);

      const picks = {};
      const savedPicks = d0.picks && typeof d0.picks === 'object' ? d0.picks : {};
      fields.forEach(f => {
        const p = savedPicks[f.id];
        picks[f.id] = { type: p && types.includes(p.type) ? p.type : '', size: p && sizes.includes(p.size) ? p.size : '' };
      });

      const isRight = f => {
        const p = picks[f.id];
        if (!p.type) return false;
        return (f.accept || []).some(a => a[0] === p.type && (a.length < 2 || a[1] === p.size));
      };
      const isComplete = f => !!picks[f.id].type && (picks[f.id].type !== NUMBER || !!picks[f.id].size);
      const rightCount = () => fields.filter(isRight).length;
      const scoreNow = () => fields.length ? Math.round(100 * rightCount() / fields.length) : 0;

      if (ret.isNew && !locked) {            // returned: clear wrong rows so the learner rethinks them
        fields.forEach(f => { if (!isRight(f)) picks[f.id] = { type: '', size: '' }; });
        showResults = false;
      }

      /* ---------- DOM ---------- */
      const status = K.h('p', { class: 'tp-status', role: 'status', 'aria-live': 'polite' });
      const save = K.saver(ctx, {
        life,
        getDetails: () => ({ picks, ack: ret.ack }),
        onError: (e, final) => { if (!life.disposed && !final) status.textContent = 'Чернетку не збережено — вибір залишається на екрані.'; }
      });
      const progress = K.h('div', { class: 'tp-progress' });
      const submit = K.h('button', { type: 'button', class: 'btn primary tp-submit' }, 'Завершити завдання');
      const groups = K.h('div', { class: 'tp-groups' });
      const root = K.h('div', { class: 'type-picker' },
        K.banners(ctx),
        K.h('p', { class: 'tp-help' }, 'Подивись на приклади значень з Excel і обери тип даних Access. Для типу «Число» з’явиться ще й розмір поля.'),
        groups,
        K.h('div', { class: 'tp-foot' }, progress, submit),
        status);
      host.append(root);

      const rows = {};                       // fieldId → { tr, typeSel, sizeSel, sizeWrap, result }
      const tables = [];
      fields.forEach(f => { if (!tables.includes(f.table)) tables.push(f.table); });
      tables.forEach(tname => {
        const list = K.h('div', { class: 'tp-list', role: 'list' });
        groups.append(K.h('section', { class: 'tp-group' },
          K.h('h3', { class: 'tp-gtitle' }, 'Таблиця ', K.h('span', { class: 'tp-tname', text: tname })), list));
        fields.filter(f => f.table === tname).forEach(f => {
          const typeSel = K.h('select', { class: 'tp-sel', 'aria-label': `Тип даних поля ${f.name}` },
            K.h('option', { value: '' }, '— обери тип —'),
            types.map(t => K.h('option', { value: t, text: t })));
          const sizeSel = K.h('select', { class: 'tp-sel tp-size', 'aria-label': `Розмір поля ${f.name}` },
            K.h('option', { value: '' }, '— розмір —'),
            sizes.map(s => K.h('option', { value: s, text: s })));
          const sizeWrap = K.h('label', { class: 'tp-sizewrap' }, K.h('span', { class: 'tp-sizelbl' }, 'Розмір:'), sizeSel);
          const result = K.h('div', { class: 'tp-result' });
          const row = K.h('div', { class: 'tp-row', role: 'listitem', 'data-id': f.id },
            K.h('div', { class: 'tp-field' },
              K.h('code', { class: 'tp-name', text: f.name }),
              K.h('div', { class: 'tp-samples' }, (f.samples || []).map(s => K.h('span', { class: 'tp-sample', text: s })))),
            K.h('div', { class: 'tp-pick' }, typeSel, sizeWrap),
            result);
          life.listen(typeSel, 'change', () => {
            if (locked || busy) { typeSel.value = picks[f.id].type; return; }
            picks[f.id] = { type: typeSel.value, size: typeSel.value === NUMBER ? picks[f.id].size : '' };
            status.textContent = ''; render(); save.draft();
          });
          life.listen(sizeSel, 'change', () => {
            if (locked || busy) { sizeSel.value = picks[f.id].size; return; }
            picks[f.id].size = sizeSel.value;
            status.textContent = ''; render(); save.draft();
          });
          rows[f.id] = { row, typeSel, sizeSel, sizeWrap, result };
          list.append(row);
        });
      });

      function render() {
        fields.forEach(f => {
          const r = rows[f.id], p = picks[f.id];
          if (r.typeSel.value !== p.type) r.typeSel.value = p.type;
          if (r.sizeSel.value !== p.size) r.sizeSel.value = p.size;
          r.sizeWrap.classList.toggle('hidden', p.type !== NUMBER);
          r.typeSel.disabled = locked || busy;
          r.sizeSel.disabled = locked || busy;
          const ok = isRight(f);
          r.row.classList.toggle('tp-ok', showResults && ok);
          r.row.classList.toggle('tp-bad', showResults && !ok);
          r.row.classList.toggle('tp-done', !showResults && isComplete(f));
          r.result.replaceChildren();
          if (showResults) {
            r.result.append(K.h('b', { class: 'tp-mark' }, ok ? '✓ Правильно. ' : '✗ Неправильно. '), K.h('span', { text: f.why || '' }));
          }
        });
        const done = fields.filter(isComplete).length;
        progress.textContent = showResults
          ? `Правильно: ${rightCount()} з ${fields.length}`
          : `Обрано: ${done} з ${fields.length}`;
        submit.classList.toggle('hidden', locked);
        submit.disabled = busy;
      }

      life.listen(submit, 'click', async () => {
        if (locked || busy) return;
        const missing = fields.filter(f => !isComplete(f));
        if (missing.length) {
          const list = missing.map(f => `<li>${K.esc(f.table)}: ${K.esc(f.name)}</li>`).join('');
          const ok = await K.confirm({
            title: 'Не для всіх полів обрано тип',
            html: `<p>Без відповіді: <b>${missing.length}</b>. Вони рахуватимуться як помилки.</p><ul>${list}</ul><p>Завершити як є? Після завершення змінити вибір вже не можна.</p>`,
            ok: 'Так, завершити', cancel: 'Ще попрацюю', danger: true
          });
          if (!ok || life.disposed || locked) return;
        }
        busy = true; render(); status.textContent = 'Підбиваю підсумок…';
        const score = scoreNow();
        try {
          await save.final(score);
          if (life.disposed) return;
          locked = true; showResults = true;
          status.textContent = `Завершено: ${score}%. Пояснення — біля кожного поля.`;
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
