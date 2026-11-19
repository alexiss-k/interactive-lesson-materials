/* lk-sort — data-driven "sort cards into groups" game. Requires lesson-kit.js (and lesson-kit.css, sort-buckets.css).
   Task data:
     { buckets: [{ id, label }],
       items:   [{ id, text, code?: true, bucket: '<bucket id>', why: 'shown after submit' }],
       hint?:   'extra instruction line' }
   Score on submit = % of cards in the right group. Drafts are saved with score 0 (house rule). */
(() => {
  'use strict';
  const K = window.LessonKit;
  window.Games = window.Games || {};
  window.Games['lk-sort'] = {
    readonlyView: true,
    mount(host, ctx) {
      const life = K.lifecycle();
      const data = ctx.task.data || {};
      const buckets = data.buckets || [];
      const items = data.items || [];
      const d0 = (ctx.saved && ctx.saved.details) || {};
      const ret = K.returnInfo(ctx);
      const place = Object.assign({}, d0.place || {});
      let seed = d0.seed || null;
      let order = seed ? K.shuffle(items, seed) : null;
      let locked = K.isLocked(ctx);
      let showResults = K.isFinal(ctx);
      let busy = false, selected = null, renderLife = null;

      const status = K.h('p', { class: 'lk-sort-status', role: 'status', 'aria-live': 'polite' });
      const save = K.saver(ctx, {
        life,
        getDetails: () => ({ seed, place, ack: ret.ack }),
        onError: (e, final) => { if (!life.disposed && !final) status.textContent = e.code === 'details_too_large' ? e.message : 'Чернетку не збережено — робота залишається на екрані.'; }
      });

      const pool = K.h('div', { class: 'lk-zone lk-pool', 'aria-label': 'Нерозкладені картки' });
      const zones = buckets.map(b => ({ b, el: K.h('div', { class: 'lk-zone lk-bucket', 'aria-label': b.label }) }));
      const submit = K.h('button', { type: 'button', class: 'btn primary' }, 'Завершити й перевірити');
      const result = K.h('div', { class: 'lk-sort-result' });
      const root = K.h('div', { class: 'lk-sort' },
        K.banners(ctx),
        K.h('p', { class: 'lk-sort-help' }, 'Перетягни кожну картку в потрібну групу. Без миші: клацни або натисни Enter на картці, потім — на групі.' + (data.hint ? ' ' + data.hint : '')),
        K.h('div', { class: 'lk-label' }, 'Картки'), pool,
        K.h('div', { class: 'lk-buckets' }, zones.map(z => K.h('div', { class: 'lk-bucket-wrap' }, K.h('div', { class: 'lk-label' }, z.b.label), z.el))),
        K.h('div', { class: 'lk-sort-actions' }, submit), status, result);
      host.append(root);

      const editable = () => !locked && !busy && !life.disposed;
      const zoneAt = (x, y) => {
        for (const z of zones) if (K.inside(z.el, x, y)) return z.b.id;
        return K.inside(pool, x, y) ? null : undefined;
      };
      function move(itemId, bucketId) {
        if (!editable()) return;
        if (bucketId) place[itemId] = bucketId; else delete place[itemId];
        selected = null;
        status.textContent = '';
        save.draft();
        render();
      }
      function render() {
        if (renderLife) renderLife.dispose();
        renderLife = K.lifecycle();
        [pool, ...zones.map(z => z.el)].forEach(el => { el.replaceChildren(); el.classList.remove('hot'); });
        if (!order) { pool.append(K.h('div', { class: 'lk-empty' }, 'Завантаження…')); submit.disabled = true; return; }
        for (const it of order) {
          const where = place[it.id] || null;
          const card = K.h('div', { class: 'lk-card' + (selected === it.id ? ' sel' : ''), 'aria-pressed': String(selected === it.id), 'data-id': it.id },
            it.code ? K.h('code', { text: it.text }) : K.h('span', { text: it.text }));
          if (showResults) {
            const right = where === it.bucket;
            card.classList.add(right ? 'right' : 'wrong');
            card.append(K.h('div', { class: 'lk-why' }, (right ? '✓ ' : '✗ ') + (it.why || '')));
          } else if (!locked) {
            K.draggable(card, renderLife, {
              enabled: editable,
              onPick: () => { selected = selected === it.id ? null : it.id; render(); if (selected) root.querySelector(`.lk-card[data-id="${CSS.escape(it.id)}"]`)?.focus(); },
              onMove: (x, y) => { const z = zoneAt(x, y); zones.forEach(q => q.el.classList.toggle('hot', z === q.b.id)); pool.classList.toggle('hot', z === null); },
              onDrop: (x, y) => { const z = zoneAt(x, y); if (z === undefined) render(); else move(it.id, z); },
              onCancel: () => render()
            });
          }
          const target = where ? zones.find(z => z.b.id === where) : null;
          (target ? target.el : pool).append(card);
        }
        if (!pool.children.length) pool.append(K.h('div', { class: 'lk-empty' }, showResults ? '' : 'Усі картки розкладено.'));
        zones.forEach(z => { if (!z.el.children.length) z.el.append(K.h('div', { class: 'lk-empty' }, 'Поклади картки сюди')); });
        if (!locked) {
          K.dropTarget(pool, renderLife, { enabled: editable, onChoose: e => { if (selected && !e.target.closest('.lk-card')) move(selected, null); } });
          zones.forEach(z => K.dropTarget(z.el, renderLife, { enabled: editable, onChoose: e => { if (selected && !e.target.closest('.lk-card')) move(selected, z.b.id); } }));
        }
        submit.classList.toggle('hidden', locked);   // .btn sets display, so the hidden attribute would not hide it
        submit.disabled = busy;
      }
      const scoreNow = () => items.length ? Math.round(100 * items.filter(it => place[it.id] === it.bucket).length / items.length) : 0;
      function showScore() {
        const okN = items.filter(it => place[it.id] === it.bucket).length;
        result.replaceChildren(K.h('b', null, `Правильно: ${okN} з ${items.length} (${scoreNow()}%).`), ' Під кожною карткою — пояснення.');
      }
      life.listen(submit, 'click', async () => {
        if (!editable() || !order) return;
        const unsorted = items.filter(it => !place[it.id]).length;
        if (unsorted) {
          const go = await K.confirm({ title: 'Завершити й перевірити?', html: `<p>Не розкладено карток: <b>${unsorted}</b>. Вони рахуватимуться як помилки.</p><p>Після завершення змінити відповіді вже не можна.</p>`, ok: 'Так, завершити', cancel: 'Ще попрацюю', danger: true });
          if (!go || life.disposed) return;
        }
        busy = true; render();
        status.textContent = 'Підбиваю підсумок…';
        try {
          await save.final(scoreNow());
          if (life.disposed) return;
          locked = true; showResults = true;
          status.textContent = 'Завершено.';
          showScore();
        } catch (e) {
          if (life.disposed) return;
          status.textContent = e.code === 'details_too_large' ? e.message : 'Не вдалося завершити. Натисни «Завершити й перевірити» ще раз.';
        } finally {
          busy = false;
          if (!life.disposed) render();
        }
      });

      render();
      if (showResults) showScore();
      else if (ctx.readOnly && ctx.saved) status.textContent = 'Завдання не завершено.';
      if (!seed) {
        K.seed(ctx).then(s => {
          if (life.disposed) return;
          seed = s; order = K.shuffle(items, s); render();
          if (!locked) save.draft();                  // persist the seed so the order never changes
        });
      } else if (ret.isNew && !locked) save.draft();  // acknowledge the return once
      life.add(() => renderLife && renderLife.dispose());
      return () => life.dispose();
    }
  };
})();
