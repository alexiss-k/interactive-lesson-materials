/* Урок «Процесор (CPU)»: Паспорт мого процесора · Детектив материнської плати · Чи підійде до нашої плати? */
(function () {
  'use strict';
  const { h, confirmBox } = window.App;
  window.Games = window.Games || {};
  const { shuffle, seedOf, debounce } = window.GameKit;

  /* Картки з вибором: як choiceQuiz з уроку 1, але в кожної картки можуть бути власні варіанти.
     Зберігає details.review — список «✓/✗ питання: відповідь учня». */
  function itemQuiz(host, ctx, cfg) {
    const d0 = (ctx.saved && ctx.saved.details) || {};
    const ans = Object.assign({}, d0.ans || {});
    let submitted = !!(ctx.saved && ctx.saved.final);
    const items = cfg.shuffle === false ? cfg.items : shuffle(cfg.items, seedOf(ctx) + '|' + cfg.key);
    const list = h('div', { class: 'cq-list' });
    const submitBtn = h('button', { class: 'btn primary big' }, 'Завершити й перевірити');
    const result = h('div', { class: 'g-result' });
    const left = h('span', { class: 'muted' });
    host.append(h('div', { class: 'cpu-intro', html: cfg.intro }), list, h('div', { class: 'row', style: 'margin-top:14px' }, submitBtn, left), result);
    const save = debounce(() => { if (!submitted) ctx.complete(0, { ans }).catch(() => {}); }, 1200);
    const optsOf = it => it.options || cfg.options;
    const cards = items.map((it, i) => {
      const fb = h('div', { class: 'cq-fb' });
      const opts = h('div', { class: 'cq-opts' });
      const btns = optsOf(it).map(o => {
        const b = h('button', { class: 'cq-opt' + (ans[it.id] === o.id ? ' on' : ''), type: 'button' }, o.icon ? h('span', { class: 'cq-ic', text: o.icon }) : null, o.label);
        b.addEventListener('click', () => {
          if (submitted) return;
          ans[it.id] = o.id;
          btns.forEach(x => x.classList.toggle('on', x === b));
          upd(); save();
        });
        opts.appendChild(b);
        return b;
      });
      const card = h('div', { class: 'cq-card wide' },
        h('div', { class: 'cq-q' }, h('span', { class: 'cq-who', text: it.icon || String(i + 1) }), h('div', null, h('div', { html: it.q }), it.hint ? h('div', { class: 'cpu-hint', html: '💡 ' + it.hint }) : null)),
        opts, fb);
      list.appendChild(card);
      return { it, card, btns, fb };
    });
    const labelOf = (it, id) => { const o = optsOf(it).find(x => x.id === id); return o ? o.label : '—'; };
    const review = () => cards.map(c => ({ right: ans[c.it.id] === c.it.answer, text: `${c.it.short || c.it.q}: ${labelOf(c.it, ans[c.it.id])}` }));
    function upd() { left.textContent = submitted ? '' : `Відповідей: ${items.filter(it => ans[it.id]).length} з ${items.length}`; }
    function reveal() {
      let ok = 0;
      for (const c of cards) {
        const right = ans[c.it.id] === c.it.answer;
        if (right) ok++;
        c.card.classList.add(right ? 'ok' : 'bad');
        c.btns.forEach(b => { b.disabled = true; });
        c.fb.innerHTML = '';
        c.fb.append(h('b', { text: right ? '✓ Правильно. ' : `✗ Правильна відповідь: ${labelOf(c.it, c.it.answer)}. ` }), h('span', { html: c.it.why }));
      }
      submitBtn.remove();
      const score = Math.round(100 * ok / items.length);
      result.className = 'g-result ' + (score >= 75 ? 'ok' : 'bad');
      result.innerHTML = '';
      result.append(h('b', { text: `Правильно: ${ok} з ${items.length} (${score}%)` }), h('div', { text: 'Під кожною карткою — пояснення.' }));
      return score;
    }
    submitBtn.addEventListener('click', async () => {
      const miss = items.filter(it => !ans[it.id]).length;
      const go = await confirmBox({
        title: 'Завершити й перевірити?',
        html: (miss ? `<p>Без відповіді: <b>${miss}</b> — вони рахуватимуться як помилки.</p>` : '') + '<p>Ти впевнений(-а)? Після завершення змінити відповіді вже не можна.</p>',
        ok: 'Так, завершити', cancel: 'Ще подумаю', danger: !!miss
      });
      if (!go) return;
      submitted = true;
      const score = reveal();
      try { await ctx.finish(score, { ans, review: review() }); } catch (e) {}
    });
    upd();
    if (submitted) reveal();
  }

  window.GameKit.itemQuiz = itemQuiz;

  /* ================= Паспорт мого процесора ================= */
  const num = v => { const x = parseFloat(String(v == null ? '' : v).replace(',', '.').replace(/[^\d.]/g, '')); return isFinite(x) ? x : NaN; };
  const inRange = (v, a, b) => { const x = num(v); return !isNaN(x) && x >= a && x <= b; };
  const hasNum = v => /\d/.test(String(v || ''));
  const bw = v => num(v.ramSpeed) * 8 * num(v.channels) / 1000;
  const near = (x, target) => !isNaN(x) && target > 0 && (Math.abs(x - target) <= Math.max(0.15, target * 0.01) || Math.abs(x / 1000 - target) <= Math.max(0.15, target * 0.01));
  const SOCKET_RE = /\b(AM[2-5]\+?|FM[12]\+?|S?TRX?\d?|TR4|SP[3-6]|(FC)?LGA\s?-?\d{3,4}|(FC)?BGA\s?-?\d{3,4}|\d{3,4})\b/i;
  const where = t => `<b>Де:</b> ${t}`;

  const PASSPORT = {
    1: {
      intro: 'Відкрий <b>Диспетчер завдань</b> (<span class="kbd">Ctrl</span> + <span class="kbd">Shift</span> + <span class="kbd">Esc</span>) → вкладка <b>«Продуктивність»</b> → <b>«ЦП»</b> і перепиши дані свого процесора. Перевірка — після завершення.',
      fields: [
        { id: 'model', label: 'Модель процесора', ph: 'Наприклад: Intel Core i5-10400', hint: where('вгорі праворуч на вкладці «ЦП»'),
          check: v => String(v.model || '').trim().length >= 5 && /intel|amd|core|ryzen|celeron|pentium|athlon|xeon|epyc|apple|snapdragon|qualcomm|mediatek/i.test(v.model),
          bad: 'Впиши повну назву моделі разом із виробником, як у Диспетчері завдань.' },
        { id: 'speed', label: 'Базова швидкість, ГГц', ph: 'Наприклад: 2,90', type: 'num', hint: where('рядок «Базова швидкість»'),
          check: v => inRange(v.speed, 0.4, 6.5), bad: 'Частота сучасних процесорів — від 1 до 6 ГГц. Перевір одиниці: потрібні ГГц.' },
        { id: 'cores', label: 'Кількість ядер', ph: 'Наприклад: 6', type: 'num', hint: where('рядок «Ядра»'),
          check: v => inRange(v.cores, 1, 192) && Number.isInteger(num(v.cores)), bad: 'Кількість ядер — ціле число з рядка «Ядра».' },
        { id: 'threads', label: 'Логічні процесори (потоки)', ph: 'Наприклад: 12', type: 'num', hint: where('рядок «Логічні процесори»'),
          check: v => inRange(v.threads, 1, 384) && num(v.threads) >= num(v.cores) && num(v.threads) <= 2 * num(v.cores),
          bad: 'Логічних процесорів не менше, ніж ядер, і не більше ніж удвічі більше.' },
        { id: 'how', label: 'Як ти це дізнався(-лася)?', type: 'choice', options: ['Диспетчер завдань', 'Параметри → Система → Про систему', 'Наклейка на корпусі', 'Інший спосіб'],
          check: v => !!v.how, bad: 'Обери спосіб.' }
      ]
    },
    2: {
      intro: 'Знову відкрий <b>Диспетчер завдань</b> → <b>«Продуктивність»</b>. Кеш — на вкладці <b>«ЦП»</b>, швидкість пам\'яті — на вкладці <b>«Пам\'ять»</b>. Сокет і TDP знайди в інтернеті за моделлю свого процесора.',
      example: true,
      fields: [
        { id: 'l1', label: 'Кеш L1', ph: 'Наприклад: 384 КБ', hint: where('«ЦП» → «Кеш L1»'), check: v => hasNum(v.l1), bad: 'Впиши число з одиницями (КБ або МБ).' },
        { id: 'l2', label: 'Кеш L2', ph: 'Наприклад: 1,5 МБ', hint: where('«ЦП» → «Кеш L2»'), check: v => hasNum(v.l2), bad: 'Впиши число з одиницями (КБ або МБ).' },
        { id: 'l3', label: 'Кеш L3', ph: 'Наприклад: 12,0 МБ (або «немає»)', hint: where('«ЦП» → «Кеш L3»'), check: v => hasNum(v.l3) || /нема|нет|no/i.test(v.l3 || ''), bad: 'Впиши число з одиницями або «немає».' },
        { id: 'ramSpeed', label: 'Швидкість пам\'яті, МТ/с', ph: 'Наприклад: 2666', type: 'num', hint: where('«Пам\'ять» → «Швидкість»'),
          check: v => inRange(v.ramSpeed, 400, 10000), bad: 'Швидкість пам\'яті — число на кшталт 2400, 3200, 5600 МТ/с.' },
        { id: 'channels', label: 'Кількість каналів', type: 'choice', options: ['1', '2', '4'], hint: where('«Пам\'ять» → «Використано гнізд»: 1 модуль — 1 канал, 2 або 4 модулі — 2 канали'),
          check: v => !!v.channels, bad: 'Обери кількість каналів.' },
        { id: 'bw', label: 'Пропускна здатність, ГБ/с', ph: 'Порахуй за формулою', type: 'num', hint: '<b>Формула:</b> швидкість × 8 × канали = МБ/с; поділи на 1000 — отримаєш ГБ/с',
          check: v => near(num(v.bw), bw(v)), bad: v => isNaN(bw(v)) ? 'Спершу впиши швидкість пам\'яті й кількість каналів.' : `За твоїми даними: ${v.ramSpeed} × 8 × ${v.channels} = ${Math.round(bw(v) * 1000)} МБ/с ≈ ${(Math.round(bw(v) * 10) / 10).toString().replace('.', ',')} ГБ/с.` },
        { id: 'socket', label: 'Сокет', ph: 'Наприклад: LGA1200 або AM4', hint: where('сайт intel.com / amd.com або пошук «модель socket»'),
          check: v => SOCKET_RE.test(String(v.socket || '')), bad: 'Сокет записують як AM4, AM5, LGA1200, LGA1700, FCBGA1744…' },
        { id: 'tdp', label: 'TDP, Вт', ph: 'Наприклад: 65', type: 'num', hint: where('сайт виробника: «TDP» або «Базова потужність процесора»'),
          check: v => inRange(v.tdp, 3, 500), bad: 'TDP — число у ватах, зазвичай від 6 до 250 Вт.' }
      ]
    }
  };

  window.Games['cpu-passport'] = {
    readonlyView: true,
    mount(host, ctx) {
      const part = (ctx.task.data && ctx.task.data.part) || 1;
      const P = PASSPORT[part];
      const d0 = (ctx.saved && ctx.saved.details) || {};
      const v = Object.assign({}, d0.v || {});
      let submitted = !!(ctx.saved && ctx.saved.final);
      const fieldsBox = h('div', { class: 'pp-grid' });
      const submitBtn = h('button', { class: 'btn primary big' }, 'Завершити паспорт');
      const left = h('span', { class: 'muted' });
      const result = h('div', { class: 'g-result' });
      const save = debounce(() => { if (!submitted) ctx.complete(0, { v }).catch(() => {}); }, 1000);
      const all = [];
      if (P.example) all.push({ id: 'ex', label: 'Розминка: DDR4 3200 МТ/с, 2 канали — скільки ГБ/с?', ph: 'Порахуй за формулою', type: 'num', hint: '3200 × 8 × 2 = ? МБ/с → ГБ/с', check: x => near(num(x.ex), 51.2), bad: '3200 × 8 × 2 = 51 200 МБ/с ≈ 51,2 ГБ/с.', wide: true });
      all.push(...P.fields);

      host.append(h('div', { class: 'cpu-intro', html: P.intro }), h('div', { class: 'pp-card' },
        h('div', { class: 'pp-head' }, h('span', { text: '🪪' }), h('b', { text: `Паспорт процесора · частина ${part}` })), fieldsBox),
        h('div', { class: 'row', style: 'margin-top:14px' }, submitBtn, left), result);

      const rows = all.map(f => {
        let input;
        if (f.type === 'choice') {
          input = h('div', { class: 'cq-opts' }, f.options.map(o => h('button', { type: 'button', class: 'cq-opt' + (v[f.id] === o ? ' on' : ''), disabled: submitted,
            onclick: e => { v[f.id] = o; e.currentTarget.parentNode.querySelectorAll('.cq-opt').forEach(b => b.classList.toggle('on', b.textContent === o)); upd(); save(); } }, o)));
        } else {
          input = h('input', { class: 'inp', value: v[f.id] || '', placeholder: f.ph || '', maxlength: 80, inputmode: f.type === 'num' ? 'decimal' : 'text', disabled: submitted });
          input.addEventListener('input', () => { v[f.id] = input.value; upd(); save(); });
        }
        const fb = h('div', { class: 'pp-fb' });
        const row = h('div', { class: 'pp-row' + (f.wide ? ' wide' : '') }, h('label', { class: 'pp-lbl', text: f.label }), input, f.hint ? h('div', { class: 'pp-hint', html: f.hint }) : null, fb);
        fieldsBox.appendChild(row);
        return { f, row, fb, input };
      });
      const filled = f => String(v[f.id] == null ? '' : v[f.id]).trim() !== '';
      function upd() { left.textContent = submitted ? '' : `Заповнено: ${all.filter(filled).length} з ${all.length}`; }
      const review = () => all.map(f => ({ right: !!f.check(v), text: `${f.label}: ${filled(f) ? v[f.id] : '—'}` }));
      function reveal() {
        let ok = 0;
        for (const r of rows) {
          const right = !!r.f.check(v);
          if (right) ok++;
          r.row.classList.add(right ? 'ok' : 'bad');
          if (r.input.tagName === 'INPUT') r.input.disabled = true; else r.input.querySelectorAll('button').forEach(b => { b.disabled = true; });
          r.fb.textContent = right ? '✓ Зараховано' : '✗ ' + (typeof r.f.bad === 'function' ? r.f.bad(v) : r.f.bad);
        }
        submitBtn.remove();
        const score = Math.round(100 * ok / rows.length);
        result.className = 'g-result ' + (score >= 75 ? 'ok' : 'bad');
        result.innerHTML = '';
        result.append(h('b', { text: `Зараховано: ${ok} з ${rows.length} (${score}%)` }), h('div', { text: 'Збережи свій паспорт — він знадобиться, коли обиратимеш новий комп\'ютер 😉' }));
        return score;
      }
      submitBtn.addEventListener('click', async () => {
        const miss = all.filter(f => !filled(f)).length;
        const hc = navigator.hardwareConcurrency;
        const warnThreads = part === 1 && hc && filled({ id: 'threads' }) && num(v.threads) !== hc;
        const go = await confirmBox({
          title: 'Завершити паспорт?',
          html: (miss ? `<p>Не заповнено полів: <b>${miss}</b> — вони не будуть зараховані.</p>` : '') +
            (warnThreads ? `<p>🤔 Браузер бачить у твоєму комп'ютері <b>${hc}</b> логічних процесорів, а ти вписав(-ла) <b>${v.threads}</b>. Перевір ще раз!</p>` : '') +
            '<p>Після завершення змінити відповіді вже не можна.</p>',
          ok: 'Так, завершити', cancel: 'Перевірю ще раз', danger: !!miss || warnThreads
        });
        if (!go) return;
        submitted = true;
        const score = reveal();
        try { await ctx.finish(score, { v, review: review() }); } catch (e) {}
      });
      upd();
      if (submitted) reveal();
    }
  };

  /* ================= Детектив материнської плати ================= */
  const o = (...labels) => labels.map((label, i) => ({ id: 'o' + i, label }));
  const BOARD = [
    { id: 'socket', icon: '🔌', short: 'Сокет', q: 'Який <b>сокет</b> процесора на цій платі?', hint: 'шукай логотип на коробці або напис біля самого сокета',
      options: o('AM4', 'AM5', 'LGA1700', 'LGA1200'), answer: 'o0',
      why: 'AM4 — сокет для процесорів AMD Ryzen серій 3000, 4000, 5000. На сайті й коробці: «AMD Socket AM4».' },
    { id: 'chipset', icon: '🧠', short: 'Чіпсет', q: 'Який <b>чіпсет</b> у цієї плати?', hint: 'він захований прямо в назві плати',
      options: o('AMD A520', 'AMD B550', 'AMD X570', 'Intel Z790'), answer: 'o0',
      why: 'Gigabyte <b>A520</b>M K V2 — чіпсет AMD A520. Це найпростіший чіпсет для AM4: без розгону процесора.' },
    { id: 'slots', icon: '📋', short: 'Слотів RAM', q: 'Скільки <b>слотів для оперативної пам\'яті</b> на платі?', hint: 'порахуй довгі слоти поруч із сокетом',
      options: o('1', '2', '4', '8'), answer: 'o1',
      why: 'На платі 2 слоти DIMM. Щоб працювали обидва канали пам\'яті, треба встановити 2 модулі.' },
    { id: 'ramtype', icon: '🧾', short: 'Тип пам\'яті', q: 'Який <b>тип оперативної пам\'яті</b> підтримує плата?', hint: 'на коробці або підписи біля слотів (DDR4_A1…)',
      options: o('DDR3', 'DDR4', 'DDR5', 'GDDR6'), answer: 'o1',
      why: 'Плата підтримує лише DDR4. DDR5 сюди фізично не вставиться — виріз у іншому місці.' },
    { id: 'maxram', icon: '📦', short: 'Макс. обсяг RAM', q: 'Який <b>максимальний обсяг</b> оперативної пам\'яті можна встановити?', hint: 'шукай «Memory» у характеристиках',
      options: o('16 ГБ', '32 ГБ', '64 ГБ', '128 ГБ'), answer: 'o2',
      why: '2 слоти × 32 ГБ = 64 ГБ.' },
    { id: 'ff', icon: '📐', short: 'Форм-фактор', q: 'Який <b>форм-фактор</b> (розмір) плати?', hint: 'підказка — літера після «A520»',
      options: o('ATX', 'Micro ATX', 'Mini-ITX', 'E-ATX'), answer: 'o1',
      why: 'Літера M означає Micro ATX: 23,3 × 19,8 см — менша за ATX, але поміщається в більшість корпусів.' },
    { id: 'm2', icon: '💾', short: 'Слотів M.2', q: 'Скільки на платі <b>слотів M.2</b> для NVMe SSD?', hint: 'маленький горизонтальний слот із гвинтиком',
      options: o('0', '1', '2', '3'), answer: 'o1',
      why: 'Один слот M.2 (PCIe 3.0 x4) — для швидкого NVMe SSD.' },
    { id: 'sata', icon: '🔗', short: 'Портів SATA', q: 'Скільки <b>портів SATA</b> для HDD та SATA SSD?', hint: 'роз\'єми зазвичай біля краю плати, підписані SATA3_0, SATA3_1…',
      options: o('2', '4', '6', '8'), answer: 'o1',
      why: '4 порти SATA 6 Гбіт/с — для жорстких дисків і SATA SSD.' },
    { id: 'video', icon: '🖥', short: 'Відеовиходи', q: 'Які <b>відеовиходи</b> є на задній панелі плати?', hint: 'подивись на металеву панель із роз\'ємами',
      options: o('HDMI і D-Sub (VGA)', 'DisplayPort і HDMI', 'Тільки DVI', 'Немає відеовиходів'), answer: 'o0',
      why: 'HDMI та D-Sub. Вони працюють лише з процесором, що має вбудовану графіку (наприклад, Ryzen 5 5600G).' }
  ];
  window.Games['mb-detective'] = {
    mount(host, ctx) {
      itemQuiz(host, ctx, { key: 'board', items: BOARD, shuffle: false,
        intro: '🕵️ Перед тобою справжня плата <b>Gigabyte A520M K V2</b>. Знайди відповіді на <b>коробці</b>, на <b>самій платі</b> або на сайті <b>gigabyte.com</b>. Обережно з платою: тримай за краї й не торкайся сокета!' });
    }
  };

  /* ================= Чи підійде до нашої плати? ================= */
  const FIT = [{ id: 'yes', label: 'Підійде', icon: '✅' }, { id: 'no', label: 'Не підійде', icon: '❌' }];
  const PARTS = [
    { id: 'p1', icon: '🧠', short: 'Ryzen 5 5600', q: '<b>AMD Ryzen 5 5600</b> · сокет AM4 · 6 ядер · 65 Вт', answer: 'yes',
      why: 'Сокет AM4 збігається, серію Ryzen 5000 плата підтримує. Але вбудованої графіки немає — потрібна відеокарта.' },
    { id: 'p2', icon: '🧠', short: 'Ryzen 5 5600G', q: '<b>AMD Ryzen 5 5600G</b> · сокет AM4 · 6 ядер · вбудована графіка', answer: 'yes',
      why: 'AM4 і вбудована графіка: монітор можна під\'єднати прямо до HDMI на платі.' },
    { id: 'p3', icon: '🧠', short: 'Ryzen 7 5700X', q: '<b>AMD Ryzen 7 5700X</b> · сокет AM4 · 8 ядер · 65 Вт', answer: 'yes',
      why: 'Той самий сокет AM4 і підтримувана серія 5000.' },
    { id: 'p4', icon: '🧠', short: 'Ryzen 7 7800X3D', q: '<b>AMD Ryzen 7 7800X3D</b> · сокет AM5 · 96 МБ L3', answer: 'no',
      why: 'Це AMD, але сокет AM5 — новіший, фізично не підходить до AM4.' },
    { id: 'p5', icon: '🧠', short: 'Core i5-12400F', q: '<b>Intel Core i5-12400F</b> · сокет LGA1700', answer: 'no',
      why: 'Процесори Intel потребують плат з сокетом Intel (тут LGA1700). AMD та Intel несумісні.' },
    { id: 'p6', icon: '🧠', short: 'Core i9-14900KF', q: '<b>Intel Core i9-14900KF</b> · рекордсмен частоти з презентації', answer: 'no',
      why: 'Сокет LGA1700 від Intel. До того ж на A520 процесори не розганяються.' },
    { id: 'r1', icon: '📋', short: 'DDR4-3200 16 ГБ', q: 'Модуль пам\'яті <b>DDR4-3200, 16 ГБ, DIMM</b>', answer: 'yes',
      why: 'DDR4 у форм-факторі DIMM — саме те, що потрібно.' },
    { id: 'r2', icon: '📋', short: 'DDR5-6000 16 ГБ', q: 'Модуль пам\'яті <b>DDR5-6000, 16 ГБ, DIMM</b>', answer: 'no',
      why: 'Плата підтримує тільки DDR4; DDR5 має виріз в іншому місці.' },
    { id: 'r3', icon: '📋', short: 'SO-DIMM 8 ГБ', q: 'Модуль пам\'яті <b>DDR4 SO-DIMM, 8 ГБ</b> (з ноутбука)', answer: 'no',
      why: 'SO-DIMM — коротка пам\'ять для ноутбуків, у слоти DIMM не підходить.' },
    { id: 'r4', icon: '📋', short: '4 × 16 ГБ DDR4', q: 'Набір <b>4 модулі DDR4 по 16 ГБ</b> (разом 64 ГБ)', answer: 'no',
      why: 'Слотів лише 2! Ті самі 64 ГБ можна набрати двома модулями по 32 ГБ.' },
    { id: 'v1', icon: '🖥', short: 'Ryzen 5 5600 без відеокарти', q: 'У плату встановили <b>Ryzen 5 5600</b> без відеокарти й під\'єднали монітор до <b>HDMI на платі</b>. Що побачимо?',
      options: [{ id: 'nosig', label: 'Монітор: «Немає сигналу»', icon: '⬛' }, { id: 'ok', label: 'Робочий стіл Windows', icon: '🪟' }, { id: 'beep', label: 'Довгі гудки', icon: '🔊' }],
      answer: 'nosig', why: 'У Ryzen 5 5600 (без літери G) немає вбудованої графіки, тому виходи на платі не працюють. Потрібна відеокарта або Ryzen 5 5600G.' }
  ];
  window.Games['cpu-fit'] = {
    mount(host, ctx) {
      itemQuiz(host, ctx, { key: 'fit', items: PARTS, options: FIT,
        intro: 'Друг хоче зібрати комп\'ютер на нашій платі <b>Gigabyte A520M K V2</b> (сокет AM4, 2 слоти DDR4). Допоможи: що з цього <b>підійде</b>, а що <b>ні</b>?' });
    }
  };
})();
