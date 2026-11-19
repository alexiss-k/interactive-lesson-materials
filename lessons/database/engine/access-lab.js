/* access-lab — guided practice in Microsoft Access: download files, follow numbered steps, answer a check
   question per step that can be answered only by looking at one's own database.
   Requires lesson-kit.js before it in `scripts`.
   Task data: {
     files: [{ href: 'files/x.accdb' (relative to assets/), name: 'Download name.accdb', label }],
     steps: [{ id, title, html: '<trusted author HTML>', q, options: [..], correct: index, why }]
   }
   Two attempts per question: right first time = 1 point, second time = ½, otherwise 0 and the answer is shown.
   Score = points / steps, sent only on submit (drafts send 0). After a teacher return, steps without a full
   point reopen. Details: { steps: { stepId: { tries, pick, done, pts } }, cur, ack }. */
(() => {
  'use strict';
  const K = window.LessonKit;

  window.Games = window.Games || {};
  window.Games['access-lab'] = {
    readonlyView: true,
    mount(host, ctx) {
      const life = K.lifecycle();
      const data = ctx.task.data || {};
      const steps = Array.isArray(data.steps) ? data.steps : [];
      const files = Array.isArray(data.files) ? data.files : [];
      const d0 = (ctx.saved && ctx.saved.details) || {};
      const ret = K.returnInfo(ctx);
      let locked = K.isLocked(ctx), busy = false;

      const st = {};
      const savedSteps = d0.steps && typeof d0.steps === 'object' ? d0.steps : {};
      steps.forEach(s => {
        const x = savedSteps[s.id];
        st[s.id] = x && typeof x === 'object'
          ? { tries: x.tries | 0, pick: Number.isInteger(x.pick) ? x.pick : -1, done: !!x.done, pts: Number(x.pts) || 0 }
          : { tries: 0, pick: -1, done: false, pts: 0 };
      });
      let cur = Number.isInteger(d0.cur) && d0.cur >= 0 && d0.cur < steps.length ? d0.cur : 0;
      let sel = -1;                         // chosen option, not yet checked
      let missMsg = '';                     // message after a failed first try (not persisted)

      if (ret.isNew && !locked) {
        steps.forEach(s => { if (st[s.id].pts < 1) st[s.id] = { tries: 0, pick: -1, done: false, pts: 0 }; });
        const first = steps.findIndex(s => !st[s.id].done);
        if (first >= 0) cur = first;
      }

      const points = () => steps.reduce((a, s) => a + (st[s.id].done ? st[s.id].pts : 0), 0);
      const doneCount = () => steps.filter(s => st[s.id].done).length;
      const scoreNow = () => steps.length ? Math.round(100 * points() / steps.length) : 0;
      const fmtPts = p => p === 1 ? '1' : p === 0.5 ? '½' : '0';
      const fmtTotal = p => { const w = Math.floor(p), h = p - w >= 0.5; return w === 0 && h ? '½' : String(w) + (h ? '½' : ''); };

      /* ---------- DOM ---------- */
      const status = K.h('p', { class: 'al-status', role: 'status', 'aria-live': 'polite' });
      const save = K.saver(ctx, {
        life,
        getDetails: () => ({ steps: st, cur, ack: ret.ack }),
        onError: (e, final) => { if (!life.disposed && !final) status.textContent = 'Чернетку не збережено — відповіді залишаються на екрані.'; }
      });
      const filesBox = files.length ? K.h('div', { class: 'al-files' },
        K.h('div', { class: 'al-files-title' }, 'Файли для роботи'),
        K.h('div', { class: 'al-files-list' }, files.map(f => K.h('a', {
          class: 'al-file' + (/\.accdb$/i.test(f.href) ? ' al-file-acc' : ''), href: ctx.asset(f.href), download: f.name || '', 'data-readonly-ok': ''
        }, K.h('span', { class: 'al-file-ico', 'aria-hidden': 'true' }, /\.accdb$/i.test(f.href) ? 'A' : 'X'),
          K.h('span', null, K.h('b', { text: f.name || f.href }), f.label ? K.h('span', { class: 'al-file-lbl', text: f.label }) : null)))),
        K.h('p', { class: 'al-files-tip' }, 'Збережи обидва файли в одну папку. Якщо браузер відкриває файл замість збереження — клацни посилання правою кнопкою → «Зберегти посилання як…».')) : null;
      const chips = K.h('ol', { class: 'al-steps', 'aria-label': 'Кроки' });
      const sTitle = K.h('h3', { class: 'al-title' });
      const sHow = K.h('div', { class: 'al-how' });
      const qText = K.h('p', { class: 'al-q' });
      const opts = K.h('div', { class: 'al-opts', role: 'radiogroup' });
      const fb = K.h('div', { class: 'al-fb', 'aria-live': 'polite' });
      const checkBtn = K.h('button', { type: 'button', class: 'btn primary al-check' }, 'Перевірити');
      const nextBtn = K.h('button', { type: 'button', class: 'btn ghost al-next hidden', 'data-readonly-ok': '' }, 'Наступний крок →');
      const progress = K.h('div', { class: 'al-progress' });
      const submit = K.h('button', { type: 'button', class: 'btn primary al-submit' }, 'Завершити завдання');
      const root = K.h('div', { class: 'access-lab' },
        K.banners(ctx),
        filesBox,
        chips,
        K.h('div', { class: 'al-card' },
          sTitle, sHow,
          K.h('div', { class: 'al-check-box' },
            K.h('div', { class: 'al-qk' }, 'Контрольне запитання'), qText, opts,
            K.h('div', { class: 'al-actions' }, checkBtn, nextBtn), fb)),
        K.h('div', { class: 'al-foot' }, progress, submit),
        status);
      host.append(root);

      function go(i) {
        if (busy || i < 0 || i >= steps.length) return;
        cur = i; sel = -1; missMsg = '';
        render();
        if (!locked) save.draft();
      }

      function render() {
        const s = steps[cur], S = s ? st[s.id] : null;
        chips.replaceChildren(...steps.map((x, i) => {
          const y = st[x.id];
          const mark = y.done ? (y.pts === 1 ? '✓' : y.pts === 0.5 ? '½' : '✗') : '';
          const cls = 'al-chip' + (i === cur ? ' al-cur' : '') + (y.done ? (y.pts === 1 ? ' al-ok' : y.pts > 0 ? ' al-half' : ' al-bad') : '');
          const b = K.h('button', { type: 'button', class: cls, 'data-readonly-ok': '', 'aria-current': i === cur ? 'step' : null,
            'aria-label': `Крок ${i + 1}: ${x.title}` + (y.done ? `, бали: ${fmtPts(y.pts)}` : '') },
            String(i + 1), mark ? K.h('span', { 'aria-hidden': 'true' }, ' ' + mark) : null);
          b.addEventListener('click', () => go(i));    // removed with the node on the next render
          return K.h('li', null, b);
        }));
        if (!s) return;
        sTitle.textContent = `Крок ${cur + 1} з ${steps.length}. ${s.title}`;
        sHow.innerHTML = s.html || '';                  // trusted author HTML from lesson.js
        qText.textContent = s.q || '';

        const canPick = !locked && !busy && !S.done;
        opts.replaceChildren(...(s.options || []).map((o, i) => {
          const isPick = S.done ? S.pick === i : sel === i;
          const firstMiss = !S.done && S.tries === 1 && S.pick === i && sel !== i;
          const cls = ['al-opt',
            isPick ? 'al-sel' : '',
            S.done && i === s.correct ? 'al-right' : '',
            S.done && S.pick === i && i !== s.correct ? 'al-wrong' : '',
            firstMiss ? 'al-wrong' : ''].filter(Boolean).join(' ');
          const b = K.h('button', { type: 'button', role: 'radio', class: cls, 'aria-checked': isPick ? 'true' : 'false' },
            K.h('span', { class: 'al-dot', 'aria-hidden': 'true' }),
            K.h('span', { text: o }),
            S.done && i === s.correct ? K.h('span', { class: 'al-tag' }, ' ✓') : null,
            (S.done && S.pick === i && i !== s.correct) || firstMiss ? K.h('span', { class: 'al-tag' }, ' ✗') : null);
          b.disabled = !canPick;
          b.addEventListener('click', () => {
            if (locked || busy || st[s.id].done) return;
            sel = i; missMsg = ''; render();
          });
          return b;
        }));

        fb.replaceChildren();
        if (S.done) {
          const right = S.pick === s.correct;
          fb.append(K.h('div', { class: 'al-verdict ' + (right ? 'al-v-ok' : 'al-v-bad') },
            K.h('b', { text: right ? (S.pts === 1 ? '✓ Правильно з першої спроби: 1 бал.' : '✓ Правильно з другої спроби: ½ бала.') : '✗ Спроби скінчилися: 0 балів. Правильну відповідь позначено.' }),
            s.why ? K.h('p', { text: s.why }) : null));
        } else if (missMsg) {
          fb.append(K.h('div', { class: 'al-verdict al-v-try' }, K.h('b', { text: missMsg })));
        } else if (S.tries === 1 && !locked) {
          fb.append(K.h('div', { class: 'al-verdict al-v-try' }, K.h('b', null, '✗ Перша спроба не вдалася. Залишилася одна — перевір у своїй базі ще раз.')));
        }

        const left = steps.length - doneCount();
        progress.textContent = `Кроків виконано: ${doneCount()} з ${steps.length} · бали: ${fmtTotal(points())} з ${steps.length}`;
        checkBtn.classList.toggle('hidden', locked || S.done);
        checkBtn.disabled = busy || sel < 0;
        nextBtn.classList.toggle('hidden', !S.done || cur >= steps.length - 1);
        submit.classList.toggle('hidden', locked);
        submit.disabled = busy;
        submit.textContent = left ? 'Завершити завдання' : 'Завершити завдання ✓';
      }

      life.listen(checkBtn, 'click', () => {
        if (locked || busy || sel < 0) return;
        const s = steps[cur], S = st[s.id];
        if (S.done) return;
        S.tries += 1; S.pick = sel;
        if (sel === s.correct) { S.done = true; S.pts = S.tries === 1 ? 1 : 0.5; missMsg = ''; }
        else if (S.tries >= 2) { S.done = true; S.pts = 0; missMsg = ''; }
        else missMsg = '✗ Не так. Залишилася одна спроба — перевір у своїй базі ще раз.';
        sel = -1;
        render();
        save.draft();
      });
      life.listen(nextBtn, 'click', () => go(cur + 1));
      life.listen(submit, 'click', async () => {
        if (locked || busy) return;
        const left = steps.length - doneCount();
        if (left > 0) {
          const list = steps.map((s, i) => st[s.id].done ? '' : `<li>Крок ${i + 1}. ${K.esc(s.title)}</li>`).join('');
          const ok = await K.confirm({
            title: 'Не всі кроки виконано',
            html: `<p>Виконано <b>${doneCount()} з ${steps.length}</b>. За невиконані кроки — 0 балів:</p><ul>${list}</ul><p>Завершити як є? Після завершення змінити роботу вже не можна.</p>`,
            ok: 'Так, завершити', cancel: 'Ще попрацюю', danger: true
          });
          if (!ok || life.disposed || locked) return;
        }
        busy = true; render(); status.textContent = 'Підбиваю підсумок…';
        const score = scoreNow();
        try {
          await save.final(score);
          if (life.disposed) return;
          locked = true; sel = -1;
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
