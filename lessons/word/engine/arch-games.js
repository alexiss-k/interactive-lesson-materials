/* Урок «Архітектура комп'ютера»: Який це комп'ютер? · Збери комп'ютер · Майстер сервісного центру */
(function () {
  'use strict';
  const { h, esc, confirmBox } = window.App;
  window.Games = window.Games || {};
  const IMG = n => window.lessonAssets('img/arch/' + n);

  function seeded(str) {
    let x = 1779033703 ^ str.length;
    for (let i = 0; i < str.length; i++) { x = Math.imul(x ^ str.charCodeAt(i), 3432918353); x = (x << 13) | (x >>> 19); }
    return () => { x = Math.imul(x ^ (x >>> 16), 2246822507); x = Math.imul(x ^ (x >>> 13), 3266489909); x ^= x >>> 16; return (x >>> 0) / 4294967296; };
  }
  function shuffle(a, seed) { const r = seeded(seed); a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
  const seedOf = ctx => (ctx.student ? ctx.student.name + '|' + ctx.student.cls : 'x');
  const debounce = (fn, ms) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };

  /* Спільна логіка «обери відповідь для кожної картки → здати → пояснення» */
  function choiceQuiz(host, ctx, cfg) {
    const d0 = (ctx.saved && ctx.saved.details) || {};
    const ans = Object.assign({}, d0.ans || {});
    let submitted = !!(ctx.saved && ctx.saved.final);
    const items = shuffle(cfg.items, seedOf(ctx) + '|' + cfg.key);
    const list = h('div', { class: cfg.listClass });
    const submitBtn = h('button', { class: 'btn primary big' }, 'Завершити й перевірити');
    const result = h('div', { class: 'g-result' });
    const left = h('span', { class: 'muted' });
    host.append(h('p', { class: 'muted', html: cfg.intro }), list, h('div', { class: 'row', style: 'margin-top:14px' }, submitBtn, left), result);
    const save = debounce(() => { if (!submitted) ctx.complete(0, { ans }).catch(() => {}); }, 1200);
    const cards = [];
    for (const it of items) {
      const fb = h('div', { class: 'cq-fb' });
      const opts = h('div', { class: 'cq-opts' });
      const btns = cfg.options.map(o => {
        const b = h('button', { class: 'cq-opt', type: 'button' }, o.icon ? h('span', { class: 'cq-ic', text: o.icon }) : null, o.label);
        b.addEventListener('click', () => {
          if (submitted) return;
          ans[it.id] = o.id;
          btns.forEach(x => x.classList.toggle('on', x === b));
          upd(); save();
        });
        if (ans[it.id] === o.id) b.classList.add('on');
        opts.appendChild(b);
        return b;
      });
      const card = cfg.renderCard(it, opts, fb);
      cards.push({ it, card, btns, fb });
      list.appendChild(card);
    }
    function upd() {
      const n = items.filter(it => ans[it.id]).length;
      left.textContent = submitted ? '' : `Відповідей: ${n} з ${items.length}`;
    }
    function reveal() {
      let ok = 0;
      for (const c of cards) {
        const right = ans[c.it.id] === c.it.answer;
        if (right) ok++;
        c.card.classList.add(right ? 'ok' : 'bad');
        c.btns.forEach(b => { b.disabled = true; });
        const correctLabel = cfg.options.find(o => o.id === c.it.answer).label;
        c.fb.innerHTML = '';
        c.fb.append(h('b', { text: right ? '✓ Правильно. ' : `✗ Правильна відповідь: ${correctLabel}. ` }), c.it.why);
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
      try { await ctx.finish(score, { ans }); } catch (e) {}
    });
    upd();
    if (submitted) reveal();
  }

  window.GameKit = Object.assign(window.GameKit || {}, { choiceQuiz, shuffle, seedOf, debounce });

  /* ================= 1. Який це комп'ютер? ================= */
  const TYPE_OPTS = [
    { id: 'super', label: 'Суперкомп\'ютер', icon: '🏭' }, { id: 'server', label: 'Сервер', icon: '🗄' },
    { id: 'desktop', label: 'Повнорозмірний ПК', icon: '🖥' }, { id: 'mini', label: 'Міні-ПК', icon: '📦' },
    { id: 'aio', label: 'Моноблок', icon: '🖵' }, { id: 'laptop', label: 'Ноутбук', icon: '💻' }
  ];
  const TYPE_ITEMS = [
    { id: 'i1', img: 'supercomputer.webp', answer: 'super', why: 'Сотні шаф-стійок із процесорами в окремому залі.' },
    { id: 'i2', img: 'condor.webp', answer: 'super', why: 'Condor Cluster — суперкомп\'ютер із 1760 приставок PlayStation 3.' },
    { id: 'i3', img: 'server.webp', answer: 'server', why: 'Плаский корпус для серверної стійки: працює цілодобово, без монітора.' },
    { id: 'i4', img: 'pc-desktop.webp', answer: 'desktop', why: 'Великий корпус — «системний блок», у якому легко замінити деталі.' },
    { id: 'i5', img: 'pc-mini-mac.webp', answer: 'mini', why: 'Маленька коробочка, до якої підключають окремий монітор.' },
    { id: 'i6', img: 'pc-mini-nuc.webp', answer: 'mini', why: 'Міні-ПК розміром із долоню.' },
    { id: 'i7', img: 'pc-aio.webp', answer: 'aio', why: 'Усі компоненти сховані в корпусі монітора — це моноблок.' },
    { id: 'i8', img: 'pc-laptop.webp', answer: 'laptop', why: 'Екран, клавіатура й батарея в одному складному корпусі.' }
  ];
  window.Games['pc-types'] = {
    mount(host, ctx) {
      choiceQuiz(host, ctx, {
        key: 'types', items: TYPE_ITEMS, options: TYPE_OPTS, listClass: 'cq-grid',
        intro: 'Подивись на фото та обери тип комп\'ютера. Відповіді перевіряться після завершення.',
        renderCard: (it, opts, fb) => h('div', { class: 'cq-card' }, h('div', { class: 'cq-img' }, h('img', { src: IMG(it.img), alt: '' })), opts, fb)
      });
    }
  };

  /* ================= 3. Майстер сервісного центру ================= */
  const PART_OPTS = [
    { id: 'mb', label: 'Материнська плата', icon: '🧩' }, { id: 'cpu', label: 'Процесор', icon: '🧠' },
    { id: 'ram', label: 'Оперативна пам\'ять', icon: '📋' }, { id: 'disk', label: 'Накопичувач', icon: '💾' },
    { id: 'gpu', label: 'Відеокарта', icon: '🎮' }, { id: 'psu', label: 'Блок живлення', icon: '⚡' }
  ];
  const CASES = [
    { id: 'c1', who: '👩‍🎓', q: 'Відкриваю 40 вкладок у браузері й Photoshop — комп\'ютер «задумується», все дуже гальмує. Що варто збільшити?', answer: 'ram',
      why: 'Програми, що працюють зараз, тримаються в оперативній пам\'яті. Коли її бракує, комп\'ютер гальмує — потрібно більше ГБ RAM.' },
    { id: 'c2', who: '🎮', q: 'У нових іграх дуже мало кадрів (FPS), картинка смикається, хоча процесор майже не завантажений.', answer: 'gpu',
      why: 'Кадри в іграх малює відеокарта. Слабкий GPU — низький FPS.' },
    { id: 'c3', who: '📸', q: 'Фото й відео більше не вміщаються — Windows пише «Недостатньо місця на диску».', answer: 'disk',
      why: 'Файли зберігаються постійно на накопичувачі (HDD/SSD). Потрібен диск більшої ємності.' },
    { id: 'c4', who: '🐢', q: 'Старий комп\'ютер вмикається 3 хвилини, програми відкриваються дуже довго, диск гучно тріщить.', answer: 'disk',
      why: 'Це повільний HDD. Заміна на SSD — найкращий спосіб пришвидшити старий ПК.' },
    { id: 'c5', who: '💥', q: 'Поставив нову потужну відеокарту — тепер у важких іграх комп\'ютер раптово вимикається.', answer: 'psu',
      why: 'Відеокарта споживає багато енергії, і старому блоку живлення не вистачає потужності (Вт).' },
    { id: 'c6', who: '🔌', q: 'Купив новий процесор, але він фізично не підходить до роз\'єму — інший сокет.', answer: 'mb',
      why: 'Сокет — роз\'єм на материнській платі. Для процесора з іншим сокетом потрібна інша плата.' },
    { id: 'c7', who: '🧮', q: 'Архівування й обробка відео тривають годинами, у диспетчері задач всі ядра завантажені на 100%.', answer: 'cpu',
      why: 'Обчислення виконує процесор. Більше ядер і вища частота — швидше рахує.' },
    { id: 'c8', who: '😱', q: 'Вимкнули світло — і документ, який я не встиг зберегти, зник. Де він зберігався до того?', answer: 'ram',
      why: 'Відкриті, але незбережені дані лежать в оперативній пам\'яті — вона очищується без живлення. Збережені файли — на накопичувачі.' }
  ];
  window.Games['pc-doctor'] = {
    mount(host, ctx) {
      choiceQuiz(host, ctx, {
        key: 'doctor', items: CASES, options: PART_OPTS, listClass: 'cq-list',
        intro: 'Ти — майстер сервісного центру 🧑‍🔧. Прочитай скаргу клієнта та обери компонент, який винен (або який треба замінити).',
        renderCard: (it, opts, fb) => h('div', { class: 'cq-card wide' },
          h('div', { class: 'cq-q' }, h('span', { class: 'cq-who', text: it.who }), h('span', { text: '«' + it.q + '»' })), opts, fb)
      });
    }
  };

  /* ================= 2. Збери комп'ютер ================= */
  // зони у відсотках від корпусу: [left, top, width, height]
  const ZONES = {
    mb: { r: [6, 5, 68, 62], name: 'місце для материнської плати', onBoard: false },
    socket: { r: [27, 11, 15, 19], name: 'сокет — роз\'єм для процесора', onBoard: true },
    dimm: { r: [46, 8, 14, 31], name: 'слоти DIMM — для оперативної пам\'яті', onBoard: true },
    pcie: { r: [9, 40, 60, 11], name: 'слот PCIe x16 — для відеокарти', onBoard: true },
    m2: { r: [16, 55, 30, 9], name: 'слот M.2 — для NVMe SSD', onBoard: true },
    psu: { r: [6, 72, 44, 23], name: 'відсік блока живлення', onBoard: false },
    bay: { r: [78, 48, 17, 47], name: 'кошик для жорстких дисків 3,5″', onBoard: false }
  };
  const PARTS = [
    { id: 'mb', name: 'Материнська плата ATX', img: 'motherboard.webp', zone: 'mb', req: true },
    { id: 'cpu', name: 'Процесор', img: 'part-cpu.webp', zone: 'socket', req: true },
    { id: 'ram', name: 'Оперативна пам\'ять DIMM DDR5', img: 'part-dimm.webp', slotImg: 'part-dimm-v.webp', zone: 'dimm', req: true },
    { id: 'gpu', name: 'Відеокарта', img: 'part-gpu.webp', zone: 'pcie', req: true },
    { id: 'ssd', name: 'NVMe SSD (M.2)', img: 'part-m2.webp', zone: 'm2', req: true },
    { id: 'psu', name: 'Блок живлення 750 Вт', img: 'part-psu.webp', zone: 'psu', req: true },
    { id: 'hdd', name: 'Жорсткий диск HDD 3,5″', img: 'part-hdd.webp', zone: 'bay', req: false },
    { id: 'sodimm', name: 'Оперативна пам\'ять SO-DIMM', img: 'part-sodimm.webp', zone: null, trap: 'SO-DIMM — коротка пам\'ять для ноутбуків. У слоти DIMM настільного ПК вона не підходить!' },
    { id: 'mbl', name: 'Материнська плата ноутбука', img: 'motherboard-laptop.webp', zone: null, trap: 'Це плата з ноутбука — вона не підходить до корпусу настільного ПК (інший форм-фактор).' }
  ];
  const BOOT = [
    ['psu', '⚡ Блок живлення перетворює струм із розетки й подає живлення всім компонентам.'],
    ['mb', '🧩 Материнська плата розподіляє живлення й з\'єднує всі компоненти.'],
    ['cpu', '🧠 Процесор запускає першу програму (BIOS/UEFI) і перевіряє обладнання.'],
    ['ram', '📋 Оперативна пам\'ять готова: сюди завантажуватимуться програми.'],
    ['disk', '💾 Накопичувач передає операційну систему в оперативну пам\'ять…'],
    ['gpu', '🎮 Відеокарта малює зображення й виводить його на монітор.']
  ];

  window.Games['pc-build'] = {
    mount(host, ctx) {
      const d0 = (ctx.saved && ctx.saved.details) || {};
      const installed = new Set((d0.installed || []).filter(id => PARTS.some(p => p.id === id)));
      let mistakes = d0.mistakes || 0, attempts = d0.attempts || 0;
      let done = !!(ctx.saved && ctx.saved.final);
      const trayOrder = shuffle(PARTS.map(p => p.id), seedOf(ctx) + '|build');

      const caseEl = h('div', { class: 'pcb-case' });
      const tray = h('div', { class: 'pcb-tray' });
      const screen = h('div', { class: 'pcb-screen off' });
      const monitor = h('div', { class: 'pcb-monitor' }, screen, h('div', { class: 'pcb-stand' }));
      const log = h('ol', { class: 'pcb-log' });
      const msg = h('div', { class: 'pcb-msg' });
      const stat = h('div', { class: 'pcb-stat' });
      const power = h('button', { class: 'pcb-power', title: 'Увімкнути комп\'ютер' }, '⏻');
      host.append(
        h('p', { class: 'muted', html: 'Перетягни деталі з лотка в корпус. Почни з <b>материнської плати</b> — без неї нікуди встановити процесор, пам\'ять і відеокарту. Серед деталей є дві, що <b>не підходять</b> до цього ПК. Коли все готово — натисни кнопку живлення ⏻.' }),
        h('div', { class: 'pcb-grid' },
          h('div', null, h('div', { class: 'hb-h', text: 'Лоток з деталями' }), tray),
          h('div', { class: 'pcb-case-wrap' }, caseEl),
          h('div', { class: 'pcb-side' }, monitor, h('div', { class: 'row', style: 'margin:12px 0 6px' }, power, h('div', null, h('b', { text: 'Кнопка живлення' }), h('div', { class: 'muted', style: 'font-size:13px', text: 'Можна вмикати будь-коли — подивись, що станеться без якоїсь деталі.' }))), stat, msg, log)));
      caseEl.appendChild(power.cloneNode(true)); // декоративна кнопка на корпусі
      caseEl.lastChild.className = 'pcb-case-btn';
      caseEl.lastChild.onclick = () => power.click();

      const save = () => { if (!done) ctx.complete(0, { installed: [...installed], mistakes, attempts }).catch(() => {}); };
      function say(text, kind) { msg.className = 'pcb-msg ' + (kind || ''); msg.textContent = text; }

      function zoneAt(x, y) {
        const r = caseEl.getBoundingClientRect();
        if (x < r.left || x > r.right || y < r.top || y > r.bottom) return null;
        const px = (x - r.left) / r.width * 100, py = (y - r.top) / r.height * 100;
        // спершу дрібні зони на платі, потім великі
        const order = installed.has('mb') ? ['socket', 'dimm', 'm2', 'pcie', 'psu', 'bay'] : ['mb', 'psu', 'bay'];
        for (const z of order) {
          const [l, t, w, hh] = ZONES[z].r;
          if (px >= l && px <= l + w && py >= t && py <= t + hh) return z;
        }
        return installed.has('mb') ? null : (px >= 6 && px <= 74 && py >= 5 && py <= 67 ? 'mb' : null);
      }
      const box = r => `left:${r[0]}%;top:${r[1]}%;width:${r[2]}%;height:${r[3]}%`;

      function renderCase() {
        caseEl.querySelectorAll('.pcb-z, .pcb-board, .pcb-part').forEach(e => e.remove());
        // плата
        if (installed.has('mb')) {
          const b = h('div', { class: 'pcb-board', style: box(ZONES.mb.r) },
            h('div', { class: 'pcb-io' }), h('div', { class: 'pcb-chipset' }), h('div', { class: 'pcb-vrm' }));
          caseEl.appendChild(b);
          const sock = h('div', { class: 'pcb-z slot socket', style: box(ZONES.socket.r) }, h('i'));
          const dimm = h('div', { class: 'pcb-z slot dimm', style: box(ZONES.dimm.r) }, h('i'), h('i'), h('i'), h('i'));
          const pcie = h('div', { class: 'pcb-z slot pcie', style: box(ZONES.pcie.r) }, h('i'));
          const m2 = h('div', { class: 'pcb-z slot m2', style: box(ZONES.m2.r) }, h('i'));
          [sock, dimm, pcie, m2].forEach(z => caseEl.appendChild(z));
        } else {
          caseEl.appendChild(h('div', { class: 'pcb-z area mb', style: box(ZONES.mb.r) }, h('span', { text: 'Порожній корпус' })));
        }
        caseEl.appendChild(h('div', { class: 'pcb-z area psu', style: box(ZONES.psu.r) }));
        caseEl.appendChild(h('div', { class: 'pcb-z area bay', style: box(ZONES.bay.r) }, h('i'), h('i'), h('i')));
        // встановлені деталі
        for (const p of PARTS) {
          if (!installed.has(p.id) || p.id === 'mb') continue;
          const z = ZONES[p.zone].r;
          const el = h('div', { class: 'pcb-part p-' + p.id, style: box(z), 'data-part': p.id }, h('img', { src: IMG(p.slotImg || p.img), alt: p.name }));
          caseEl.appendChild(el);
        }
        if (installed.has('mb')) caseEl.querySelector('.pcb-board').setAttribute('data-part', 'mb');
        stat.innerHTML = '';
        const need = PARTS.filter(p => p.req);
        const got = need.filter(p => installed.has(p.id)).length;
        stat.append(h('div', { class: 'progress' }, h('i', { style: `width:${Math.round(100 * got / need.length)}%` })),
          h('div', { class: 'muted', style: 'font-size:13px;margin-top:4px', text: `Встановлено основних деталей: ${got} з ${need.length} · помилок: ${mistakes}` }));
      }
      function renderTray() {
        tray.innerHTML = '';
        for (const id of trayOrder) {
          if (installed.has(id)) continue;
          const p = PARTS.find(x => x.id === id);
          const card = h('div', { class: 'pcb-card' }, h('div', { class: 'pcb-ci' }, h('img', { src: IMG(p.img), alt: '' })), h('div', { class: 'pcb-cn', text: p.name }));
          if (!done) dragPart(card, p);
          else card.classList.add('dim');
          tray.appendChild(card);
        }
        if (!tray.children.length) tray.appendChild(h('div', { class: 'ts-empty', text: 'Лоток порожній' }));
      }
      function dragPart(el, p) {
        el.addEventListener('pointerdown', e => {
          if (done || e.button !== 0) return;
          e.preventDefault();
          const sx = e.clientX, sy = e.clientY;
          let ghost = null, hot = null;
          const move = ev => {
            if (!ghost) {
              if (Math.hypot(ev.clientX - sx, ev.clientY - sy) < 5) return;
              ghost = el.cloneNode(true); ghost.classList.add('drag-ghost'); ghost.style.width = el.offsetWidth + 'px';
              document.body.appendChild(ghost); document.body.classList.add('is-dragging'); el.classList.add('dragging-src');
            }
            ghost.style.left = (ev.clientX - 40) + 'px'; ghost.style.top = (ev.clientY - 40) + 'px';
            const z = zoneAt(ev.clientX, ev.clientY);
            if (z !== hot) {
              hot = z;
              caseEl.querySelectorAll('.pcb-z').forEach(n => n.classList.remove('hot'));
              if (z) { const n = caseEl.querySelector('.pcb-z.' + z); if (n) n.classList.add('hot'); }
            }
          };
          const up = ev => {
            document.removeEventListener('pointermove', move); document.removeEventListener('pointerup', up);
            document.body.classList.remove('is-dragging'); el.classList.remove('dragging-src');
            caseEl.querySelectorAll('.pcb-z').forEach(n => n.classList.remove('hot'));
            if (!ghost) { say(`«${p.name}»: перетягни деталь у потрібне місце корпусу.`, ''); return; }
            ghost.remove();
            drop(p, zoneAt(ev.clientX, ev.clientY), ev.clientX, ev.clientY);
          };
          document.addEventListener('pointermove', move); document.addEventListener('pointerup', up);
        });
      }
      function drop(p, z, x, y) {
        if (!z) {
          const r = caseEl.getBoundingClientRect();
          const inCase = x >= r.left && x <= r.right && y >= r.top && y <= r.bottom;
          if (inCase && !installed.has('mb') && p.zone && ZONES[p.zone].onBoard) { say('Спершу встанови материнську плату — саме на неї кріпляться процесор, пам\'ять, відеокарта і SSD.', 'warn'); return; }
          if (inCase) say('Сюди нічого не встановлюється. Спробуй інше місце.', 'warn');
          return;
        }
        if (z === 'mb' && !installed.has('mb') && p.zone && ZONES[p.zone].onBoard) { say('Спершу встанови материнську плату — саме на неї кріпляться процесор, пам\'ять, відеокарта і SSD.', 'warn'); return; }
        if (p.trap) { mistakes++; say('✗ ' + p.trap, 'bad'); shake(); save(); renderCase(); return; }
        if (z === p.zone) {
          installed.add(p.id);
          say(`✓ ${p.name} — на місці!`, 'ok');
          renderCase(); renderTray(); save();
          const el = caseEl.querySelector(`[data-part="${p.id}"]`); if (el) { el.classList.add('pop'); }
          return;
        }
        if (installed.has(PARTS.find(q => q.zone === z) ? PARTS.find(q => q.zone === z).id : '') && z !== 'mb') { say('Це місце вже зайняте.', 'warn'); return; }
        mistakes++;
        say(`✗ Не сюди: це ${ZONES[z].name}. Подумай, куди встановлюється «${p.name}».`, 'bad');
        shake(); save(); renderCase();
      }
      function shake() { caseEl.classList.remove('shake'); void caseEl.offsetWidth; caseEl.classList.add('shake'); }

      function setScreen(cls, html) { screen.className = 'pcb-screen ' + cls; screen.innerHTML = html || ''; }
      const hasDisk = () => installed.has('ssd') || installed.has('hdd');
      async function powerOn() {
        if (done) return;
        attempts++;
        log.innerHTML = '';
        caseEl.querySelectorAll('.glow').forEach(n => n.classList.remove('glow'));
        let fail = null;
        if (!installed.has('psu')) fail = ['off', '', 'Тиша… Комп\'ютер не реагує: немає блока живлення — компонентам нізвідки взяти енергію.'];
        else if (!installed.has('mb')) fail = ['off', '', 'Блок живлення гуде, але живлення нікуди подати: немає материнської плати.'];
        else if (!installed.has('cpu')) fail = ['off', '', 'Вентилятор закрутився, але більше нічого не відбувається: немає процесора — нікому виконувати команди.'];
        else if (!installed.has('ram')) fail = ['off', '🔊 біп-біп-біп…', 'Довгі гудки! Немає оперативної пам\'яті — процесору нікуди завантажити програми.'];
        else if (!installed.has('gpu')) fail = ['nosig', '<div class="osd">Немає сигналу</div>', 'Комп\'ютер працює, але монітор пише «Немає сигналу»: немає відеокарти, яка виводить зображення (у нашого процесора немає вбудованої графіки).'];
        else if (!hasDisk()) fail = ['text', '<div class="bios">No bootable device.<br>Insert boot disk and press any key_</div>', 'Немає накопичувача — нема звідки завантажити операційну систему.'];
        if (fail) {
          setScreen(fail[0], fail[1]);
          say('⚠ ' + fail[2], 'warn');
          save();
          return;
        }
        // успішний запуск
        power.disabled = true;
        say('', '');
        setScreen('boot', '<div class="bios">BIOS… перевірка обладнання</div>');
        for (const [k, text] of BOOT) {
          const ids = k === 'disk' ? (installed.has('ssd') ? ['ssd'] : ['hdd']) : [k];
          ids.forEach(id => { const n = caseEl.querySelector(`[data-part="${id}"]`); if (n) n.classList.add('glow'); });
          log.appendChild(h('li', { text }));
          await new Promise(r => setTimeout(r, 750));
          if (k === 'disk') setScreen('boot', '<div class="loader"></div><div style="margin-top:10px">Завантаження системи…</div>');
        }
        setScreen('desk', '<div class="desk-txt">🎉 Комп\'ютер працює!</div>');
        const slow = !installed.has('ssd');
        const score = Math.max(40, 100 - 10 * mistakes);
        say(`✓ Комп'ютер зібрано й запущено! Помилок під час збирання: ${mistakes}.${slow ? ' Система вантажилась із повільного HDD 🐢 — з NVMe SSD було б у рази швидше.' : ''}`, 'ok');
        done = true;
        renderTray();
        try { await ctx.finish(score, { installed: [...installed], mistakes, attempts }); } catch (e) {}
      }
      power.addEventListener('click', powerOn);

      renderCase(); renderTray();
      if (done) {
        power.disabled = true;
        setScreen('desk', '<div class="desk-txt">🎉 Комп\'ютер працює!</div>');
        say(`Комп'ютер зібрано. Помилок: ${mistakes}.`, 'ok');
      } else setScreen('off', '');
    }
  };
})();
