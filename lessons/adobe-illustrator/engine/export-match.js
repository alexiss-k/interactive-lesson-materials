/* Куди відправимо файл? — вибір формату, колірного режиму та команди для кожного замовлення */
(function () {
  'use strict';
  const { h, esc } = window.App;
  window.Games = window.Games || {};

  /* ================= Куди відправимо файл? ================= */
  const FORMATS = ['AI', 'PDF', 'SVG', 'PNG', 'JPG', 'EPS'];
  const MODES = ['RGB', 'CMYK'];
  const CMDS = ['Save As', 'Export As', 'Export for Screens'];
  const ORDERS = [
    { icon: '🌐', text: 'Логотип ліцею для сайту — має бути чітким на будь-якому екрані.',
      fmt: ['SVG'], mode: ['RGB'], cmd: ['Export As', 'Export for Screens', 'Save As'],
      why: 'SVG — вектор для браузерів, екран — RGB. Підійде будь-яка з команд, найзручніше Export As.' },
    { icon: '🖨', text: 'Плакат A3 для друкарні.',
      fmt: ['PDF'], mode: ['CMYK'], cmd: ['Save As'],
      why: 'Друкарня чекає PDF у CMYK із вилітами. PDF зберігається через File › Save As › Adobe PDF.' },
    { icon: '🎮', text: 'Аватарка з прозорим фоном для Discord.',
      fmt: ['PNG'], mode: ['RGB'], cmd: ['Export As', 'Export for Screens'],
      why: 'Прозорість підтримує PNG. Це растр для екрана — RGB, команда Export.' },
    { icon: '🤝', text: 'Однокласник доопрацює твій макет в Illustrator.',
      fmt: ['AI'], mode: ['RGB', 'CMYK'], cmd: ['Save As'],
      why: 'Робочий файл .AI зберігає всі шари й можливість редагування. Колірний режим залишаємо як у проєкті.' },
    { icon: '📸', text: 'Пост в Instagram з яскравою ілюстрацією, без прозорості.',
      fmt: ['JPG', 'PNG'], mode: ['RGB'], cmd: ['Export As', 'Export for Screens'],
      why: 'Соцмережі приймають JPG чи PNG у RGB. Експортуємо через Export As або Export for Screens.' },
    { icon: '📱', text: 'Іконки для мобільного застосунку в розмірах 1x, 2x і 3x одночасно.',
      fmt: ['PNG'], mode: ['RGB'], cmd: ['Export for Screens'],
      why: 'Export for Screens уміє за один раз зберегти кілька масштабів (1x, 2x, 3x).' },
    { icon: '💼', text: 'Візитки для типографії.',
      fmt: ['PDF'], mode: ['CMYK'], cmd: ['Save As'],
      why: 'Як і плакат: PDF (PDF/X) у CMYK з вилітами 3 мм, текст переведено в криві.' }
  ];
  window.Games['export-match'] = {
    mount(host, ctx) {
      const ans = ORDERS.map(() => ({ fmt: null, mode: null, cmd: null }));
      let locked = false;
      const list = h('div', { class: 'orders' });
      const checkBtn = h('button', { class: 'btn primary big', disabled: true }, 'Перевірити всі замовлення');
      const result = h('div', { class: 'g-result' });
      host.append(h('p', { class: 'muted', text: 'Для кожного замовлення обери формат, колірний режим і команду меню File.' }), list,
        h('div', { class: 'row', style: 'margin-top:14px' }, checkBtn), result);
      const cards = [];
      const pills = (i, key, opts) => {
        const box = h('div', { class: 'pills' });
        opts.forEach(o => {
          const b = h('button', { class: 'pill', text: o });
          b.onclick = () => { if (locked) return; ans[i][key] = o; box.querySelectorAll('.pill').forEach(x => x.classList.toggle('on', x === b)); checkBtn.disabled = !ans.every(a => a.fmt && a.mode && a.cmd); };
          box.appendChild(b);
        });
        return box;
      };
      ORDERS.forEach((o, i) => {
        const fb = h('div', { class: 'order-fb' });
        const card = h('div', { class: 'order' },
          h('div', { class: 'order-h' }, h('span', { class: 'order-ic', text: o.icon }), h('b', { text: `${i + 1}. ${o.text}` })),
          h('div', { class: 'order-grid' },
            h('span', { class: 'lbl', text: 'Формат' }), pills(i, 'fmt', FORMATS),
            h('span', { class: 'lbl', text: 'Колір' }), pills(i, 'mode', MODES),
            h('span', { class: 'lbl', text: 'Команда' }), pills(i, 'cmd', CMDS.map(c => c))),
          fb);
        cards.push({ card, fb });
        list.appendChild(card);
      });
      checkBtn.onclick = async () => {
        if (locked) return;
        locked = true;
        checkBtn.remove();
        list.querySelectorAll('.pill').forEach(b => { b.disabled = true; });
        let ok = 0;
        ORDERS.forEach((o, i) => {
          const a = ans[i];
          const good = { fmt: o.fmt.includes(a.fmt), mode: o.mode.includes(a.mode), cmd: o.cmd.includes(a.cmd) };
          const all = good.fmt && good.mode && good.cmd;
          if (all) ok++;
          const { card, fb } = cards[i];
          card.classList.toggle('ok', all); card.classList.toggle('bad', !all);
          fb.innerHTML = '';
          fb.append(h('div', { html: all ? '✓ <b>Правильно.</b>' : `✗ <b>Правильно:</b> ${o.fmt.join(' або ')} · ${o.mode.join(' або ')} · ${o.cmd.join(' / ')}` }),
            h('div', { class: 'muted', text: o.why }));
        });
        const score = Math.round(100 * ok / ORDERS.length);
        result.className = 'g-result ' + (score >= 70 ? 'ok' : 'bad');
        result.innerHTML = '';
        result.append(h('b', { text: `Правильно виконано замовлень: ${ok} з ${ORDERS.length} (${score}%)` }));
        try { await ctx.finish(score, { ok, total: ORDERS.length }); } catch (e) {}
      };
    }
  };

})();
