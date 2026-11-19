/* ai-file-check — step-by-step Illustrator task + automatic check of the learner's file.
   The learner works in Adobe Illustrator, ticks the steps, picks the saved PDF/AI/SVG here,
   sees a ✓/✗/⚠ checklist with hints, fixes the file, checks again and submits.
   Score = share of passed checks of the LAST checked file, final only on «Завершити завдання».
   Needs: kit/lesson-kit.js, games/ai-file-analyzer.js (declared before this file).
   data: { steps:[html], sample?, sampleAlt?, sampleCap?, spec:{…see analyzer…}, next? } */
(() => {
  'use strict';
  const K = window.LessonKit;
  const ICON = { ok: '✓', bad: '✗', unk: '⚠' };
  const WORD = { ok: 'виконано', bad: 'не виконано', unk: 'не вдалося перевірити' };
  window.Games = window.Games || {};
  window.Games['ai-file-check'] = {
    readonlyView: true,
    mount(host, ctx) {
      const life = K.lifecycle();
      const data = ctx.task.data || {};
      const spec = data.spec || {};
      const steps = Array.isArray(data.steps) ? data.steps : [];
      const d0 = (ctx.saved && ctx.saved.details) || {};
      const ret = K.returnInfo(ctx);
      let model = {
        steps: steps.map((_, i) => Boolean(d0.steps && d0.steps[i])),
        last: d0.last || null,
        attempts: d0.attempts || 0
      };
      let locked = K.isLocked(ctx), busy = false, checking = false;
      const MAXB = 15 * 1024 * 1024;

      const status = K.h('p', { class: 'aif-status', role: 'status', 'aria-live': 'polite' });
      const save = K.saver(ctx, {
        life,
        getDetails: () => ({ steps: model.steps, last: model.last, attempts: model.attempts, ack: ret.ack }),
        onError: (e, final) => { if (!life.disposed && !final) status.textContent = 'Чернетку не збережено (немає зв’язку). Результат перевірки залишається на екрані.'; }
      });

      /* ---- steps ---- */
      const stepBoxes = [];
      const stepList = K.h('ol', { class: 'aif-steplist' }, steps.map((html, i) => {
        const cb = K.h('input', { type: 'checkbox', class: 'aif-cb', 'aria-label': 'Крок ' + (i + 1) + ' виконано' });
        stepBoxes.push(cb);
        life.listen(cb, 'change', () => {
          if (locked || life.disposed) { cb.checked = model.steps[i]; return; }
          model.steps[i] = cb.checked; renderSteps(); save.draft();
        });
        return K.h('li', { class: 'aif-step' }, K.h('label', null, cb, K.h('span', { class: 'aif-steptext', html })));
      }));
      const stepCount = K.h('span', { class: 'aif-count' });
      const stepsBox = K.h('section', { class: 'aif-card aif-steps' },
        K.h('h3', null, 'Кроки в Illustrator ', stepCount),
        K.h('p', { class: 'aif-muted' }, 'Виконуй по черзі й став позначку — так легше не загубитися.'),
        stepList);

      /* ---- sample + rubric ---- */
      const side = K.h('aside', { class: 'aif-card aif-side' });
      if (data.sample) {
        side.append(K.h('figure', { class: 'aif-fig' },
          K.h('img', { src: ctx.asset(data.sample), alt: data.sampleAlt || 'Зразок результату' }),
          K.h('figcaption', null, data.sampleCap || 'Зразок: так може виглядати результат.')));
      }
      const f0 = (spec.formats || ['pdf'])[0], sz = spec.size || { w: 1, h: 1, unit: 'mm' };
      const fakePage = sz.unit === 'mm' ? { wPt: sz.w * 72 / 25.4, hPt: sz.h * 72 / 25.4 } : { wPx: sz.w, hPx: sz.h };
      const preview = AiFileAnalyzer.evaluate({ kind: f0 === 'svg' ? 'svg' : 'pdf', ext: f0, size: 0, name: '', page: fakePage }, spec, '').checks;
      side.append(K.h('h3', null, 'Що перевірить сайт'),
        K.h('ul', { class: 'aif-rubric' }, preview.map(c => K.h('li', null, c.label))),
        K.h('p', { class: 'aif-muted' }, 'Відсоток = частка виконаних пунктів в останньому перевіреному файлі. Підсумок — після «Завершити завдання».'));

      /* ---- file picker ---- */
      const accept = (spec.formats || ['pdf']).map(f => '.' + f).join(',');
      const input = K.h('input', { type: 'file', accept, class: 'aif-input', 'aria-label': 'Обрати файл для перевірки' });
      const pick = K.h('button', { type: 'button', class: 'btn primary' }, 'Обрати файл…');
      const drop = K.h('div', { class: 'aif-drop' },
        K.h('div', { class: 'aif-dropicon', 'aria-hidden': 'true' }, '⬆'),
        K.h('div', null, K.h('b', null, 'Перетягни сюди файл'), ' ', K.h('span', { class: 'aif-muted' }, '(' + (spec.formats || ['pdf']).map(f => f.toUpperCase()).join(', ') + ') або'), ' ', pick),
        input);
      const result = K.h('div', { class: 'aif-result' });
      const checkBox = K.h('section', { class: 'aif-card aif-check' },
        K.h('h3', null, 'Перевір свій файл'),
        K.h('p', { class: 'aif-muted' }, 'Сайт перевіряє файл прямо в браузері. Виправив(-ла) щось в Illustrator — збережи й обери файл ще раз.'),
        drop, result);

      const submit = K.h('button', { type: 'button', class: 'btn primary big' }, 'Завершити завдання');
      const next = data.next ? K.h('p', { class: 'aif-next' }, data.next) : null;
      const root = K.h('div', { class: 'aif' }, K.banners(ctx),
        K.h('div', { class: 'aif-top' }, stepsBox, side),
        checkBox,
        K.h('div', { class: 'aif-actions' }, submit, status), next);
      host.append(root);

      function renderSteps() {
        const done = model.steps.filter(Boolean).length;
        stepCount.textContent = '(' + done + ' з ' + steps.length + ')';
        stepBoxes.forEach((cb, i) => { cb.checked = model.steps[i]; cb.disabled = locked; cb.closest('li').classList.toggle('done', model.steps[i]); });
      }
      function renderResult() {
        result.replaceChildren();
        const L = model.last;
        if (checking) { result.append(K.h('p', { class: 'aif-wait' }, 'Читаю файл…')); return; }
        if (!L) { result.append(K.h('p', { class: 'aif-muted' }, 'Ще не перевірено жодного файлу.')); return; }
        const okN = L.checks.filter(c => c.st === 'ok').length;
        result.append(
          K.h('div', { class: 'aif-file' },
            K.h('span', { class: 'aif-fname', text: L.name }),
            K.h('span', { class: 'aif-muted' }, ' · ' + Math.max(1, Math.ceil((L.size || 0) / 1024)) + ' КіБ · перевірка №' + model.attempts)),
          K.h('div', { class: 'aif-score' + (L.score === 100 ? ' full' : '') },
            K.h('div', { class: 'aif-bar' }, K.h('i', { style: 'width:' + L.score + '%' })),
            K.h('b', null, okN + ' з ' + L.checks.length + ' · ' + L.score + ' %')),
          K.h('ul', { class: 'aif-list' }, L.checks.map(c => K.h('li', { class: 'aif-row ' + c.st },
            K.h('span', { class: 'aif-ic', 'aria-hidden': 'true' }, ICON[c.st]),
            K.h('div', null,
              K.h('div', { class: 'aif-lbl' }, K.h('span', { text: c.label }), K.h('span', { class: 'sr' }, ' — ' + WORD[c.st])),
              c.detail ? K.h('div', { class: 'aif-det', text: c.detail }) : null,
              c.hint ? K.h('div', { class: 'aif-hint', text: '→ ' + c.hint }) : null)))));
        if (L.checks.some(c => c.st === 'unk')) result.append(K.h('p', { class: 'aif-unk' }, '⚠ Деякі пункти сайт не зміг перевірити. Підніми руку — учитель гляне на файл.'));
      }
      function render() {
        renderSteps(); renderResult();
        input.disabled = locked || busy || checking;
        pick.disabled = locked || busy || checking;
        drop.classList.toggle('off', locked);
        submit.classList.toggle('hidden', locked);
        submit.disabled = busy || checking;
        if (next) next.classList.toggle('hidden', !locked && !(ctx.saved && ctx.saved.final));
      }

      async function check(file) {
        if (locked || busy || checking || life.disposed || !file) return;
        if (file.size > MAXB) { status.textContent = 'Файл більший за 15 МіБ — сайт такий не прийме. Збережи PDF без зайвих зображень.'; }
        checking = true; render();
        try {
          const rep = await AiFileAnalyzer.analyze(file);
          if (life.disposed) return;
          const ev = AiFileAnalyzer.evaluate(rep, spec, file.name);
          model.attempts++;
          model.last = {
            name: String(file.name).slice(0, 120), size: file.size, hash: rep.hash, at: Date.now(),
            score: ev.score,
            checks: ev.checks.map(c => ({ id: c.id, st: c.st, label: c.label, detail: String(c.detail).slice(0, 120), hint: String(c.hint || '').slice(0, 200) })),
            sum: AiFileAnalyzer.summary(rep)
          };
          status.textContent = ev.score === 100 ? 'Усі пункти виконано! Натисни «Завершити завдання».' : 'Перевірено: ' + ev.okN + ' з ' + ev.total + '. Виправ позначене ✗ і перевір ще раз.';
          save.draft();
        } catch (e) {
          if (!life.disposed) status.textContent = 'Не вдалося прочитати файл. Збережи його ще раз в Illustrator і спробуй знову.';
        } finally {
          checking = false;
          if (!life.disposed) { input.value = ''; render(); }
        }
      }
      life.listen(pick, 'click', () => { if (!locked && !busy) input.click(); });
      life.listen(input, 'change', () => { const f = input.files && input.files[0]; if (f) check(f); });
      life.listen(drop, 'dragover', e => { if (locked) return; e.preventDefault(); drop.classList.add('over'); });
      life.listen(drop, 'dragleave', () => drop.classList.remove('over'));
      life.listen(drop, 'drop', e => {
        e.preventDefault(); drop.classList.remove('over');
        if (locked) return;
        const f = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
        if (f) check(f);
      });

      life.listen(submit, 'click', async () => {
        if (locked || busy || checking) return;
        const L = model.last;
        if (!L) { status.textContent = 'Спершу обери й перевір свій файл.'; return; }
        if (L.score < 100) {
          const miss = L.checks.filter(c => c.st !== 'ok').map(c => '<li>' + K.esc(c.label) + '</li>').join('');
          const ok = await K.confirm({ title: 'Не всі пункти виконано', html: '<p>Ще не виконано:</p><ul>' + miss + '</ul><p>Завершити з результатом ' + L.score + ' %?</p>', ok: 'Завершити так', cancel: 'Ще попрацюю' });
          if (!ok || life.disposed || locked) return;
        }
        busy = true; render(); status.textContent = 'Підбиваю підсумок…';
        try {
          await save.final(L.score);
          if (life.disposed) return;
          locked = true;
          status.textContent = 'Завершено: ' + L.score + ' %.';
        } catch (e) {
          if (!life.disposed) status.textContent = 'Не вдалося завершити. Натисни «Завершити завдання» ще раз.';
        } finally {
          busy = false;
          if (!life.disposed) render();
        }
      });

      render();
      if (ctx.saved && ctx.saved.final && !ctx.readOnly) status.textContent = 'Завершено: ' + ctx.saved.score + ' %.';
      if (ret.isNew && !locked) save.draft();       // acknowledge the return once
      return () => life.dispose();
    }
  };
})();
