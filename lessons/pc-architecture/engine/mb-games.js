/* Урок «Материнська плата, блок живлення та відеокарта» — ігри на LessonKit.
   'hw-passport' (data.part: mb | gpu) · 'mb-quiz' (data.set: decode | psu) · 'pc-config'.
   Зміст — з уроку вчителя (lesson8 / mb-games.js); правила платформи: чернетка 0 %, оцінка після «Здати», повернення.
   Needs kit/lesson-kit.js. Classic script. */
(() => {
  'use strict';
  const K = window.LessonKit;
  window.Games = window.Games || {};

  const num = v => { const x = parseFloat(String(v == null ? '' : v).replace(',', '.').replace(/[^\d.]/g, '')); return isFinite(x) ? x : NaN; };
  const inRange = (v, a, b) => { const x = num(v); return !isNaN(x) && x >= a && x <= b; };
  const str = v => String(v == null ? '' : v).trim();
  const where = t => `<b>Де:</b> ${t}`;
  const SOCKET_RE = /\b(AM[2-5]\+?|FM[12]\+?|S?TRX?\d?|TR4|SP[3-6]|(FC)?LGA\s?-?\d{3,4}|(FC)?BGA\s?-?\d{3,4}|\d{3,4})\b/i;
  const CHIPSET_RE = /\b([ABHQXZ]\d{2,3})(E)?/i;
  const fmt = n => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  const statusEl = () => K.h('p', { class: 'mbg-status', role: 'status', 'aria-live': 'polite' });
  const draftError = (status, life) => (e, final) => { if (!life.disposed && !final) status.textContent = 'Чернетку не збережено. Робота залишається на екрані — спробуй трохи пізніше.'; };

  /* Відеокарта, яку бачить браузер (WebGL). Порожній рядок — якщо не вдалося дізнатися */
  function webglGpu() {
    try {
      const c = document.createElement('canvas');
      const gl = c.getContext('webgl') || c.getContext('experimental-webgl');
      if (!gl) return '';
      const ext = gl.getExtension('WEBGL_debug_renderer_info');
      const r = String(ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER) || '');
      const lose = gl.getExtension('WEBGL_lose_context'); if (lose) lose.loseContext();
      return /swiftshader|llvmpipe|software|microsoft basic/i.test(r) || !/\d/.test(r) ? '' : r;
    } catch (e) { return ''; }
  }
  const isIntegratedName = s => /\b(uhd|iris|hd graphics)\b|radeon\(tm\) graphics|^\s*(amd )?radeon graphics|vega \d+ graphics|radeon \d{3}m/i.test(s);
  const isDiscreteName = s => /geforce|\brtx\b|\bgtx\b|quadro|\brx\s?\d{3,4}|\barc\s?a\d{3}|\barc\s?b\d{3}/i.test(s);
  const KIND_INT = 'Вбудована (частина процесора)', KIND_DIS = 'Окрема (дискретна) відеокарта';

  /* ================= 1. Паспорт плати / відеокарти ================= */
  const PASSPORT = {
    mb: {
      icon: '🧩', name: 'Паспорт материнської плати',
      intro: 'Натисни <span class="kbd">Win</span> + <span class="kbd">R</span>, введи <b>msinfo32</b> і натисни Enter. У «Відомостях про систему» знайди рядки <b>«Виробник основної плати»</b> і <b>«Продукт основної плати»</b>. Решту знайдеш у назві плати, у Диспетчері завдань або на сайті виробника. Оцінка — частка зарахованих полів, рахується після «Завершити паспорт».',
      fields: [
        { id: 'maker', label: 'Виробник плати', type: 'choice', options: ['ASUS', 'Gigabyte', 'MSI', 'ASRock', 'Інший'], hint: where('msinfo32 → «Виробник основної плати»'),
          check: v => !!v.maker, bad: 'Обери виробника.' },
        { id: 'model', label: 'Модель плати', ph: 'Наприклад: PRIME B460M-A', hint: where('msinfo32 → «Продукт основної плати»'),
          check: v => str(v.model).length >= 3 && /\d/.test(v.model) && !/to be filled|недоступн|default/i.test(v.model),
          bad: 'Впиши модель так, як у рядку «Продукт основної плати» (у ній майже завжди є цифри).' },
        { id: 'chipset', label: 'Чипсет', ph: 'Наприклад: B460', hint: where('захований у назві плати: літера + 3 цифри'),
          check: v => { const m = str(v.chipset).match(CHIPSET_RE); if (!m) return false; const inModel = str(v.model).match(CHIPSET_RE); return !inModel || inModel[1].toUpperCase() === m[1].toUpperCase(); },
          bad: v => { const inModel = str(v.model).match(CHIPSET_RE); return inModel ? `Подивись на назву своєї плати: чипсет — ${inModel[1].toUpperCase()}.` : 'Чипсет записують як літеру й 3 цифри: A520, B460, H610, Z790…'; } },
        { id: 'socket', label: 'Сокет', ph: 'Наприклад: LGA1200 або AM4', hint: where('такий самий, як у процесора (паспорт процесора), або сайт виробника'),
          check: v => SOCKET_RE.test(str(v.socket)), bad: 'Сокет записують як AM4, AM5, LGA1200, LGA1700…' },
        { id: 'ff', label: 'Форм-фактор', type: 'choice', options: ['ATX', 'Micro-ATX', 'Mini-ITX'], hint: where('M після чипсета — Micro-ATX, I — Mini-ITX; або сайт виробника'),
          check: v => { if (!v.ff) return false; const m = str(v.model).match(/\b[ABHQXZ]\d{3}E?([MI])\b/i); if (!m) return true; return v.ff === (m[1].toUpperCase() === 'M' ? 'Micro-ATX' : 'Mini-ITX'); },
          bad: v => { const m = str(v.model).match(/\b[ABHQXZ]\d{3}E?([MI])\b/i); return m ? `Літера ${m[1].toUpperCase()} після чипсета означає ${m[1].toUpperCase() === 'M' ? 'Micro-ATX' : 'Mini-ITX'}.` : 'Обери форм-фактор.'; } },
        { id: 'dimm', label: 'Слотів оперативної пам’яті (DIMM)', ph: 'Наприклад: 4', type: 'num', hint: where('Диспетчер завдань → «Пам’ять» → «Використано гнізд»: друге число'),
          check: v => inRange(v.dimm, 1, 8) && Number.isInteger(num(v.dimm)), bad: 'Слотів зазвичай 2 або 4 — друге число в рядку «Використано гнізд».' },
        { id: 'how', label: 'Як ти це дізнався(-лася)?', type: 'choice', options: ['msinfo32 (Відомості про систему)', 'Диспетчер завдань', 'Напис на самій платі', 'Сайт виробника', 'Інший спосіб'],
          check: v => !!v.how, bad: 'Обери спосіб.' }
      ]
    },
    gpu: {
      icon: '🎮', name: 'Паспорт відеокарти',
      intro: 'Відкрий <b>Диспетчер завдань</b> (<span class="kbd">Ctrl</span> + <span class="kbd">Shift</span> + <span class="kbd">Esc</span>) → <b>«Продуктивність»</b> → <b>«Графічний процесор»</b>. Якщо їх два — заповни паспорт для потужнішого (зазвичай «Графічний процесор 1»). TDP знайди в інтернеті, порти — на задній панелі ПК. Оцінка — частка зарахованих полів, рахується після «Завершити паспорт».',
      fields: [
        { id: 'model', label: 'Модель відеокарти (GPU)', ph: 'Наприклад: NVIDIA GeForce GTX 1650', hint: where('вгорі праворуч на вкладці «Графічний процесор»'),
          check: v => str(v.model).length >= 4 && /nvidia|geforce|gtx|rtx|quadro|radeon|\brx\b|intel|uhd|iris|\barc\b|amd|vega|graphics|apple/i.test(v.model),
          bad: 'Впиши повну назву разом із виробником, як у Диспетчері завдань.' },
        { id: 'kind', label: 'Тип графіки', type: 'choice', options: [KIND_INT, KIND_DIS], hint: 'Intel UHD / Iris, AMD Radeon Graphics — вбудовані; GeForce, Radeon RX, Intel Arc — окремі',
          check: v => { if (!v.kind) return false; const m = str(v.model); if (isIntegratedName(m)) return v.kind === KIND_INT; if (isDiscreteName(m)) return v.kind === KIND_DIS; return true; },
          bad: v => isIntegratedName(str(v.model)) ? 'Твоя модель — вбудована графіка процесора.' : isDiscreteName(str(v.model)) ? 'Твоя модель — окрема відеокарта.' : 'Обери тип графіки.' },
        { id: 'vram', label: 'Відеопам’ять (VRAM), ГБ', ph: 'Наприклад: 4', type: 'num', hint: where('«Виділена пам’ять графічного процесора» (у вбудованої — 0 або менше 1 ГБ)'),
          check: v => { if (!inRange(v.vram, 0, 64)) return false; return v.kind !== KIND_DIS || num(v.vram) >= 1; },
          bad: v => v.kind === KIND_DIS ? 'В окремої відеокарти VRAM — від 1 до 32 ГБ. Не плутай зі «спільною» пам’яттю.' : 'Впиши число в гігабайтах (можна 0 для вбудованої графіки).' },
        { id: 'ports', label: 'Порти виводу (познач усі, що є)', type: 'multi', options: ['HDMI', 'DisplayPort', 'DVI', 'VGA (D-Sub)', 'USB-C'], hint: where('задня панель ПК: порти відеокарти — горизонтальним рядом нижче'),
          check: v => Array.isArray(v.ports) && v.ports.length > 0, bad: 'Познач хоча б один порт, до якого під’єднано монітор.' },
        { id: 'tdp', label: 'TDP (енергоспоживання), Вт', ph: 'Наприклад: 75 (або «вбудована»)', hint: where('сайт виробника або techpowerup.com; у вбудованої свого TDP немає'),
          check: v => v.kind === KIND_INT ? (/\d|нема|вбуд|cpu|проц/i.test(str(v.tdp))) : inRange(v.tdp, 3, 650),
          bad: v => v.kind === KIND_INT ? 'Напиши «вбудована» або TDP процесора.' : 'TDP відеокарти — число у ватах, зазвичай від 30 до 450 Вт.' },
        { id: 'how', label: 'Як ти це дізнався(-лася)?', type: 'choice', options: ['Диспетчер завдань', 'dxdiag', 'Сайт виробника / techpowerup', 'Подивився(-лася) на задню панель', 'Інший спосіб'],
          check: v => !!v.how, bad: 'Обери спосіб.' }
      ],
      warn(v) {
        const r = webglGpu(), m = str(v.model);
        if (!r || !m) return '';
        const toks = (m.match(/[a-z]*\d+[a-z0-9]*/gi) || []).filter(t => t.length >= 3);
        const words = toks.length ? toks : m.split(/\s+/).filter(t => t.length >= 4 && !/nvidia|geforce|intel|amd|radeon|graphics|\(r\)|\(tm\)/i.test(t));
        if (!words.length) return '';
        const rl = r.toLowerCase();
        if (words.some(t => rl.includes(t.toLowerCase()))) return '';
        const shown = r.replace(/^ANGLE \(/, '').replace(/\s*\(0x[0-9a-f]+\)/i, '').replace(/\s*Direct3D.*$/i, '').replace(/,\s*D3D\d+\)?$/, '');
        return `<p>🤔 Браузер бачить відеокарту <b>${K.esc(shown)}</b>, а ти вписав(-ла) <b>${K.esc(m)}</b>. Перевір ще раз! (Якщо в ПК дві відеокарти, браузер може показувати іншу.)</p>`;
      }
    }
  };

  window.Games['hw-passport'] = {
    readonlyView: true,
    mount(host, ctx) {
      const life = K.lifecycle(), h = K.h;
      const P = PASSPORT[(ctx.task.data && ctx.task.data.part) || 'mb'] || PASSPORT.mb;
      const d0 = (ctx.saved && ctx.saved.details) || {};
      const ret = K.returnInfo(ctx);
      const v = Object.assign({}, d0.v || {});
      let locked = K.isLocked(ctx), busy = false, submittedNow = false;
      const status = statusEl();
      const save = K.saver(ctx, { life, getDetails: () => ({ v, ack: ret.ack }), onError: draftError(status, life) });
      const left = h('span', { class: 'mbg-muted' });
      const submit = h('button', { type: 'button', class: 'btn primary' }, 'Завершити паспорт');
      const result = h('div', { class: 'mbg-result' });
      const grid = h('div', { class: 'hp-grid' });
      host.append(h('div', { class: 'mbg hp' }, ...K.banners(ctx), h('p', { class: 'mbg-intro', html: P.intro }),
        h('div', { class: 'hp-card' }, h('div', { class: 'hp-head' }, h('span', { text: P.icon }), h('b', { text: P.name })), grid),
        h('div', { class: 'mbg-submitrow' }, submit, left, status), result));

      const filled = f => Array.isArray(v[f.id]) ? v[f.id].length > 0 : str(v[f.id]) !== '';
      const shown = f => Array.isArray(v[f.id]) ? v[f.id].join(', ') : v[f.id];
      const score = () => Math.round(100 * P.fields.filter(f => f.check(v)).length / P.fields.length);
      const rows = P.fields.map(f => {
        let input;
        if (f.type === 'choice' || f.type === 'multi') {
          const multi = f.type === 'multi';
          input = h('div', { class: 'hp-opts', role: 'group', 'aria-label': f.label });
          f.options.forEach(o => {
            const b = h('button', { type: 'button', class: 'hp-opt', 'data-v': o }, o);
            life.listen(b, 'click', () => {
              if (locked || busy) return;
              if (multi) { const s = new Set(v[f.id] || []); s.has(o) ? s.delete(o) : s.add(o); v[f.id] = f.options.filter(x => s.has(x)); }
              else v[f.id] = o;
              render(); save.draft();
            });
            input.append(b);
          });
        } else {
          input = h('input', { class: 'inp', value: v[f.id] || '', placeholder: f.ph || '', maxlength: 80, inputmode: f.type === 'num' ? 'decimal' : 'text', 'aria-label': f.label });
          life.listen(input, 'input', () => { if (locked || busy) return; v[f.id] = input.value; render(); save.draft(); });
        }
        const fb = h('div', { class: 'hp-fb' });
        const row = h('div', { class: 'hp-row' + (f.type === 'multi' ? ' wide' : '') }, h('label', { class: 'hp-lbl', text: f.label }), input, f.hint ? h('div', { class: 'hp-hint', html: f.hint }) : null, fb);
        grid.append(row);
        return { f, row, fb, input };
      });
      function render() {
        const final = locked && (submittedNow || !!(ctx.saved && ctx.saved.final));
        const hints = final || (!locked && ret.everReturned);
        for (const r of rows) {
          const right = !!r.f.check(v);
          if (r.input.tagName === 'INPUT') r.input.disabled = locked || busy;
          else r.input.querySelectorAll('.hp-opt').forEach(b => {
            const on = r.f.type === 'multi' ? (v[r.f.id] || []).includes(b.dataset.v) : v[r.f.id] === b.dataset.v;
            b.classList.toggle('on', on); b.setAttribute('aria-pressed', String(on)); b.disabled = locked || busy;
          });
          r.row.classList.toggle('ok', hints && right); r.row.classList.toggle('bad', hints && !right);
          r.fb.textContent = hints ? (right ? '✓ Зараховано' : '✗ ' + (typeof r.f.bad === 'function' ? r.f.bad(v) : r.f.bad)) : '';
        }
        submit.classList.toggle('hidden', locked);
        submit.disabled = busy;
        left.textContent = locked ? '' : `Заповнено: ${P.fields.filter(filled).length} з ${P.fields.length}`;
        result.textContent = ''; result.className = 'mbg-result';
        if (final) {
          const ok = P.fields.filter(f => f.check(v)).length, sc = score();
          result.classList.add(sc >= 75 ? 'ok' : 'bad');
          result.append(h('b', { text: `Зараховано: ${ok} з ${P.fields.length} (${sc}%)` }), h('div', { text: 'Тепер ти знаєш свій комп’ютер краще, ніж більшість його власників 😉' }));
        }
      }
      life.listen(submit, 'click', async () => {
        if (locked || busy) return;
        const miss = P.fields.filter(f => !filled(f)).length;
        const warn = P.warn ? P.warn(v) : '';
        if (miss || warn) {
          const ok = await K.confirm({ title: 'Завершити паспорт?', html: (miss ? `<p>Не заповнено полів: <b>${miss}</b> — вони не будуть зараховані.</p>` : '') + warn + '<p>Після завершення змінити відповіді вже не можна.</p>', ok: 'Так, завершити', cancel: 'Перевірю ще раз', danger: true });
          if (!ok || life.disposed || locked) return;
        }
        busy = true; render(); status.textContent = 'Підбиваю підсумок…';
        try {
          await save.final(score());
          if (life.disposed) return;
          locked = true; submittedNow = true; status.textContent = 'Завершено.';
        } catch (e) { if (!life.disposed) status.textContent = 'Не вдалося завершити. Натисни «Завершити паспорт» ще раз.'; }
        finally { busy = false; if (!life.disposed) render(); }
      });
      render();
      if (ret.isNew && !locked) save.draft();
      return () => life.dispose();
    }
  };

  /* ================= 2. Вікторини: «Розшифруй назву плати», «Наклейка блока живлення» ================= */
  const o = (...labels) => labels.map((label, i) => ({ id: 'o' + i, label }));
  const SOCKETS = o('AM4', 'AM5', 'LGA1700', 'LGA1851');
  const FFS = o('ATX', 'Micro-ATX', 'Mini-ITX');
  const OC = [{ id: 'yes', label: '🚀 Так, можна розганяти' }, { id: 'no', label: '🚫 Ні, без розгону' }];
  const TO = [{ id: 'mb', label: '🧩 Материнська плата' }, { id: 'cpu', label: '🧠 Процесор' }, { id: 'gpu', label: '🎮 Відеокарта' }, { id: 'disk', label: '💾 SSD / HDD' }];
  const PSU_LABEL = `<div class="psu-label">
    <div class="pl-top"><b>VOLTEX</b><span>CORE 650 B</span><i>80 PLUS<br>BRONZE</i></div>
    <div class="pl-mid">ATX12V Power Supply · Model: VX-650B · <b>Non-Modular</b></div>
    <table><tr><th>DC Output</th><th>+3.3V</th><th>+5V</th><th>+12V</th><th>−12V</th><th>+5Vsb</th></tr>
    <tr><td>Max Current</td><td>20A</td><td>20A</td><td>54A</td><td>0.3A</td><td>2.5A</td></tr>
    <tr><td colspan="6" class="pl-tot">Total Output: <b>650W</b></td></tr></table>
    <div class="pl-ac">AC Input: 200–240V~ 5A 50/60Hz</div>
    <div class="pl-prot"><span>OVP</span><span>UVP</span><span>OPP</span><span>SCP</span><span>OTP</span></div>
  </div>`;
  const QUIZ = {
    decode: {
      intro: '🔍 Назва материнської плати — це «паспорт у кишені». Чипсет (<b>A520</b>, <b>B650</b>, <b>Z790</b>…) підказує сокет і розгін, а літера після нього — розмір: <b>M</b> — Micro-ATX, <b>I</b> — Mini-ITX, нічого — зазвичай ATX. Скористайся таблицею серій чипсетів зі слайдів.',
      items: [
        { id: 'd1', name: 'MSI PRO Z790-A', q: 'Чи можна на цій платі розганяти процесор?', options: OC, answer: 'yes', why: 'Чипсет <b>Z790</b> — Z-серія Intel, топові плати з розгоном.' },
        { id: 'd2', name: 'ASRock H610M-HDV', q: 'Який форм-фактор цієї плати?', options: FFS, answer: 'o1', why: 'Літера <b>M</b> одразу після чипсета H610 — Micro-ATX.' },
        { id: 'd3', name: 'ASUS PRIME A520M-A II', q: 'Плата з фото на слайді. Чи можна на ній розганяти процесор?', options: OC, answer: 'no', why: '<b>A520</b> — бюджетна A-серія AMD, розгону немає. Як і в нашої Gigabyte A520M K V2.' },
        { id: 'd4', name: 'Gigabyte B650M D3HP', q: 'Який сокет у цієї плати?', options: SOCKETS, answer: 'o1', why: 'Чипсети AMD 600-ї серії (A620, B650, X670) — для нового сокета <b>AM5</b>.' },
        { id: 'd5', name: 'ASUS ROG STRIX B550-F GAMING', q: 'Який сокет у цієї плати?', options: SOCKETS, answer: 'o0', why: 'Чипсети AMD 300/400/500-ї серій (A520, B550, X570) — для сокета <b>AM4</b>.' },
        { id: 'd6', name: 'Gigabyte B760I AORUS PRO', q: 'Який форм-фактор цієї плати?', options: FFS, answer: 'o2', why: 'Літера <b>I</b> після чипсета — Mini-ITX: крихітна плата 17 × 17 см.' },
        { id: 'd7', name: 'MSI B760 GAMING PLUS WIFI', q: 'Чи можна на цій платі розганяти процесор?', options: OC, answer: 'no', why: 'Пастка! B-серія <b>Intel</b> без розгону процесора (на відміну від B-серії AMD).' },
        { id: 'd8', name: 'ASUS TUF GAMING X670E-PLUS', q: 'Для якого комп’ютера зробили цю плату?', options: o('Бюджетний офісний ПК', 'Середній клас', 'Потужні ігрові ПК і робочі станції'), answer: 'o2', why: '<b>X</b>-серія AMD — найбільше портів і ліній PCIe, розгін. Для потужних систем.' },
        { id: 'd9', name: 'Gigabyte Z890 AORUS ELITE WIFI7', q: 'Який сокет у цієї плати?', options: SOCKETS, answer: 'o3', why: 'Z890 — найновіший чипсет Intel для процесорів Core Ultra із сокетом <b>LGA 1851</b>.' }
      ]
    },
    psu: {
      intro: `Перед тобою наклейка з бокової стінки блока живлення. Прочитай її й дай відповіді на питання.<div class="mq-psu">${PSU_LABEL}</div>`,
      items: [
        { id: 'w', q: 'Яка <b>максимальна потужність</b> цього блока живлення?', options: o('650 Вт', '54 А', '240 В', '80 Вт'), answer: 'o0', why: 'Рядок <b>Total Output: 650W</b>. 54 А — струм на лінії +12 В, 240 В — напруга з розетки.' },
        { id: 'cert', q: 'Який сертифікат <b>ефективності</b> має блок?', options: o('80 PLUS Bronze', '80 PLUS Gold', '80 PLUS Titanium', 'Немає сертифіката'), answer: 'o0', why: 'Значок у правому верхньому куті: <b>80 PLUS Bronze</b> — близько 85 % ефективності.' },
        { id: 'mod', q: 'Що можна сказати про <b>кабелі</b> цього блока?', options: o('Усі кабелі фіксовані (Non-Modular)', 'Усі кабелі знімні', 'Частина кабелів знімна', 'Кабелів немає — він бездротовий'), answer: 'o0', why: 'На наклейці написано <b>Non-Modular</b>: кабелі припаяні, зайві доведеться ховати в корпусі.' },
        { id: 'prot', q: 'Якого захисту <b>немає</b> в списку на наклейці?', options: o('OCP — від перевантаження по струму', 'SCP — від короткого замикання', 'OTP — від перегріву', 'OVP — від перенапруги'), answer: 'o0', why: 'На наклейці: OVP, UVP, OPP, SCP, OTP. <b>OCP</b> немає — у дешевших блоків часто економлять саме на ньому.' },
        { id: 'c24', q: 'Конектор <b>24-pin</b> (найширший) під’єднують до…', options: TO, answer: 'mb', why: '24-pin живить <b>материнську плату</b>, а вона — пам’ять, USB-пристрої, вентилятори.' },
        { id: 'c8cpu', q: 'Конектор <b>8-pin CPU (4+4)</b> біля верхнього краю плати під’єднують до живлення…', options: TO, answer: 'cpu', why: 'Він живить <b>процесор</b> через систему живлення плати (VRM).' },
        { id: 'c8pcie', q: 'Конектор <b>8-pin PCIe (6+2)</b> під’єднують до…', options: TO, answer: 'gpu', why: 'PCIe-конектори — для <b>відеокарти</b>. Не переплутай із 8-pin CPU: вони різні!' },
        { id: 'csata', q: 'Плаский конектор живлення <b>SATA</b> під’єднують до…', options: TO, answer: 'disk', why: 'SATA-живлення — для <b>SSD та HDD</b> 2,5″ і 3,5″. M.2 SSD живиться прямо від плати.' },
        { id: 'c12v', q: 'Конектор <b>12VHPWR (16-pin)</b> під’єднують до…', options: TO, answer: 'gpu', why: 'Новий конектор до 600 Вт — для потужних <b>відеокарт</b> на кшталт RTX 4080/4090/5090.' },
        { id: 'calc1', q: 'Чи вистачить цього блока на 650 Вт для <b>Ryzen 7 7700 (65 Вт)</b> + <b>RTX 4070 SUPER (220 Вт)</b>? <small>Формула: (CPU + GPU + 100 Вт) × 1,3</small>', options: o('Так, з запасом', 'Ні, потрібно 1000 Вт', 'Ні, потрібно два блоки'), answer: 'o0', why: '(65 + 220 + 100) × 1,3 ≈ 500 Вт. 650 Вт вистачає з запасом.' },
        { id: 'calc2', q: 'А для <b>Ryzen 9 7950X (170 Вт)</b> + <b>RTX 4090 (450 Вт)</b>? <small>Формула: (CPU + GPU + 100 Вт) × 1,3</small>', options: o('Так, вистачить', 'Ні, потрібен блок ≈ 1000 Вт', 'Вистачить, якщо вимкнути монітор'), answer: 'o1', why: '(170 + 450 + 100) × 1,3 ≈ 936 Вт → блок на 1000 Вт. З блоком 650 Вт ПК вимикатиметься в іграх.' },
        { id: 'eff', q: 'Компоненти споживають <b>400 Вт</b>. Скільки приблизно цей блок (Bronze, ≈ 85 %) бере <b>з розетки</b>?', options: o('≈ 470 Вт', '400 Вт', '≈ 340 Вт', '650 Вт'), answer: 'o0', why: '400 ÷ 0,85 ≈ 470 Вт. Близько 70 Вт іде в тепло — тому блок і має вентилятор.' }
      ]
    }
  };

  /* Each item: choose an option → «Перевірити» → one attempt, ✓/✗ and the explanation. After a teacher's return the wrong items reopen. */
  window.Games['mb-quiz'] = {
    readonlyView: true,
    mount(host, ctx) {
      const life = K.lifecycle(), h = K.h;
      const setId = (ctx.task.data && ctx.task.data.set) || 'decode';
      const Q = QUIZ[setId] || QUIZ.decode;
      const d0 = (ctx.saved && ctx.saved.details) || {};
      const ret = K.returnInfo(ctx);
      const ans = Object.assign({}, d0.ans || {});
      const chk = Object.assign({}, d0.chk || {});
      let locked = K.isLocked(ctx), busy = false;
      const right = it => ans[it.id] === it.answer;
      if (ret.isNew && !locked) Q.items.forEach(it => { if (chk[it.id] && !right(it)) delete chk[it.id]; });   // reopen wrong items once
      const status = statusEl();
      const save = K.saver(ctx, { life, getDetails: () => ({ set: setId, ans, chk, ack: ret.ack }), onError: draftError(status, life) });
      const list = h('div', { class: 'mq-list' });
      const total = h('div', { class: 'mq-total' });
      const submit = h('button', { type: 'button', class: 'btn primary' }, 'Завершити й перевірити');
      host.append(h('div', { class: 'mbg mq' }, ...K.banners(ctx), h('div', { class: 'mbg-intro', html: Q.intro }),
        h('p', { class: 'mbg-rubric', text: `Кожне питання — одна спроба: обери відповідь і натисни «Перевірити». Оцінка — частка правильних відповідей із ${Q.items.length}; рахується після «Завершити й перевірити».` }),
        total, list, h('div', { class: 'mbg-submitrow' }, submit, status)));
      const score = () => Math.round(100 * Q.items.filter(it => chk[it.id] && right(it)).length / Q.items.length);
      const cards = Q.items.map((it, i) => {
        const opts = h('div', { class: 'mq-opts', role: 'group', 'aria-label': 'Варіанти відповіді' });
        it.options.forEach(op => {
          const b = h('button', { type: 'button', class: 'mq-opt', 'data-id': op.id }, op.label);
          life.listen(b, 'click', () => { if (locked || busy || chk[it.id]) return; ans[it.id] = op.id; render(); save.draft(); });
          opts.append(b);
        });
        const check = h('button', { type: 'button', class: 'btn small' }, 'Перевірити');
        life.listen(check, 'click', () => { if (locked || busy || chk[it.id] || !ans[it.id]) return; chk[it.id] = true; render(); save.draft(); });
        const fb = h('div', { class: 'mq-fb' });
        const card = h('div', { class: 'mq-card', 'data-id': it.id },
          h('div', { class: 'mq-q' }, h('span', { class: 'mq-n', text: String(i + 1) }), h('div', null, it.name ? h('span', { class: 'mq-name', text: it.name }) : null, h('div', { html: it.q }))),
          opts, h('div', { class: 'mq-actions' }, check), fb);
        list.append(card);
        return { it, card, opts, check, fb };
      });
      function render() {
        for (const c of cards) {
          const done = !!chk[c.it.id], ok = done && right(c.it);
          c.opts.querySelectorAll('.mq-opt').forEach(b => {
            const on = ans[c.it.id] === b.dataset.id;
            b.classList.toggle('on', on); b.setAttribute('aria-pressed', String(on));
            b.classList.toggle('right', done && b.dataset.id === c.it.answer);
            b.classList.toggle('wrong', done && on && !ok);
            b.disabled = locked || busy || done;
          });
          c.check.classList.toggle('hidden', locked || done);
          c.check.disabled = busy || !ans[c.it.id];
          c.card.classList.toggle('ok', ok); c.card.classList.toggle('bad', done && !ok);
          c.fb.innerHTML = done ? `<b>${ok ? '✓ Правильно.' : '✗ Ні.'}</b> ${c.it.why}` : '';
        }
        const n = Q.items.filter(it => chk[it.id]).length, good = Q.items.filter(it => chk[it.id] && right(it)).length;
        total.textContent = `Перевірено: ${n} з ${Q.items.length} · правильно: ${good}`;
        submit.classList.toggle('hidden', locked);
        submit.disabled = busy;
      }
      life.listen(submit, 'click', async () => {
        if (locked || busy) return;
        const left = Q.items.filter(it => !chk[it.id]).length;
        if (left) {
          const ok = await K.confirm({ title: 'Не всі питання перевірено', html: `<p>Неперевірених питань: <b>${left}</b>. Вони рахуються як неправильні.</p><p>Оцінка зараз: <b>${score()}%</b>.</p>`, ok: 'Завершити так', cancel: 'Повернутися' });
          if (!ok || life.disposed || locked) return;
        }
        busy = true; render(); status.textContent = 'Підбиваю підсумок…';
        try { await save.final(score()); if (life.disposed) return; locked = true; status.textContent = `Завершено. Результат: ${score()}%.`; }
        catch (e) { if (!life.disposed) status.textContent = 'Не вдалося завершити. Натисни «Завершити й перевірити» ще раз.'; }
        finally { busy = false; if (!life.disposed) render(); }
      });
      render();
      if (locked && ctx.saved && ctx.saved.final) status.textContent = `Завершено. Результат: ${ctx.saved.score}%.`;
      if (ret.isNew && !locked) save.draft();
      return () => life.dispose();
    }
  };

  /* ================= 3. Збери ПК під замовлення ================= */
  const CAT = [
    { id: 'mb', name: 'Материнська плата', icon: '🧩' }, { id: 'cpu', name: 'Процесор', icon: '🧠' }, { id: 'ram', name: 'Оперативна пам’ять', icon: '📋' },
    { id: 'gpu', name: 'Відеокарта', icon: '🎮' }, { id: 'psu', name: 'Блок живлення', icon: '⚡' }, { id: 'case', name: 'Корпус', icon: '🗄' }
  ];
  const ITEMS = {
    mb: [
      { id: 'a520', name: 'Gigabyte A520M K V2', spec: 'AM4 · A520 · DDR4 · Micro-ATX', socket: 'AM4', ram: 'DDR4', ff: 'Micro-ATX', price: 2600 },
      { id: 'b550', name: 'MSI B550-A PRO', spec: 'AM4 · B550 · DDR4 · ATX', socket: 'AM4', ram: 'DDR4', ff: 'ATX', price: 4500 },
      { id: 'b650', name: 'Gigabyte B650M D3HP', spec: 'AM5 · B650 · DDR5 · Micro-ATX', socket: 'AM5', ram: 'DDR5', ff: 'Micro-ATX', price: 5500 },
      { id: 'x670', name: 'ASUS ROG STRIX X670E-E', spec: 'AM5 · X670E · DDR5 · ATX', socket: 'AM5', ram: 'DDR5', ff: 'ATX', price: 18000 },
      { id: 'h610', name: 'ASRock H610M-HDV', spec: 'LGA1700 · H610 · DDR4 · Micro-ATX', socket: 'LGA1700', ram: 'DDR4', ff: 'Micro-ATX', price: 3000 },
      { id: 'z790', name: 'MSI PRO Z790-A', spec: 'LGA1700 · Z790 · DDR5 · ATX', socket: 'LGA1700', ram: 'DDR5', ff: 'ATX', price: 9500 }
    ],
    cpu: [
      { id: '5600g', name: 'AMD Ryzen 5 5600G', spec: 'AM4 · 6 ядер · 65 Вт · є графіка', socket: 'AM4', cores: 6, tdp: 65, igpu: true, price: 5000 },
      { id: '5600', name: 'AMD Ryzen 5 5600', spec: 'AM4 · 6 ядер · 65 Вт · без графіки', socket: 'AM4', cores: 6, tdp: 65, igpu: false, price: 4000 },
      { id: '7600', name: 'AMD Ryzen 5 7600', spec: 'AM5 · 6 ядер · 65 Вт · є графіка', socket: 'AM5', cores: 6, tdp: 65, igpu: true, price: 8000 },
      { id: '7800x3d', name: 'AMD Ryzen 7 7800X3D', spec: 'AM5 · 8 ядер · 120 Вт · є графіка', socket: 'AM5', cores: 8, tdp: 120, igpu: true, price: 17000 },
      { id: '12100', name: 'Intel Core i3-12100', spec: 'LGA1700 · 4 ядра · 60 Вт · є графіка', socket: 'LGA1700', cores: 4, tdp: 60, igpu: true, price: 4500 },
      { id: '13400f', name: 'Intel Core i5-13400F', spec: 'LGA1700 · 10 ядер · 65 Вт · без графіки', socket: 'LGA1700', cores: 10, tdp: 65, igpu: false, price: 7000 },
      { id: '14900k', name: 'Intel Core i9-14900K', spec: 'LGA1700 · 24 ядра · 125 Вт · є графіка', socket: 'LGA1700', cores: 24, tdp: 125, igpu: true, price: 22000 }
    ],
    ram: [
      { id: 'd4-16', name: '2 × 8 ГБ DDR4-3200', spec: 'DIMM · разом 16 ГБ', type: 'DDR4', gb: 16, price: 1400 },
      { id: 'd4-32', name: '2 × 16 ГБ DDR4-3600', spec: 'DIMM · разом 32 ГБ', type: 'DDR4', gb: 32, price: 2800 },
      { id: 'd5-32', name: '2 × 16 ГБ DDR5-6000', spec: 'DIMM · разом 32 ГБ', type: 'DDR5', gb: 32, price: 4000 },
      { id: 'so-16', name: '2 × 8 ГБ DDR4 SO-DIMM', spec: 'з ноутбука · разом 16 ГБ', type: 'DDR4', sodimm: true, gb: 16, price: 1300 }
    ],
    gpu: [
      { id: 'none', name: 'Без відеокарти', spec: 'зображення — через вбудовану графіку процесора', tdp: 0, vram: 0, tier: 0, conn: 'none', price: 0 },
      { id: '3050', name: 'GeForce RTX 3050 6 ГБ', spec: '70 Вт · живлення від слота', tdp: 70, vram: 6, tier: 1, conn: 'none', price: 8000 },
      { id: '4060', name: 'GeForce RTX 4060 8 ГБ', spec: '115 Вт · 1 × 8-pin PCIe', tdp: 115, vram: 8, tier: 2, conn: '8x1', price: 13000 },
      { id: '7800xt', name: 'Radeon RX 7800 XT 16 ГБ', spec: '263 Вт · 2 × 8-pin PCIe', tdp: 263, vram: 16, tier: 3, conn: '8x2', price: 22000 },
      { id: '4080s', name: 'GeForce RTX 4080 SUPER 16 ГБ', spec: '320 Вт · 12VHPWR', tdp: 320, vram: 16, tier: 4, conn: '12v', price: 45000 }
    ],
    psu: [
      { id: 'p400', name: '400 Вт · без сертифіката', spec: 'ATX · немає конекторів PCIe', w: 400, conns: [], price: 1200 },
      { id: 'p550', name: '550 Вт · 80 PLUS Bronze', spec: 'ATX · 1 × 8-pin PCIe', w: 550, conns: ['8x1'], price: 2200 },
      { id: 'p750', name: '750 Вт · 80 PLUS Gold', spec: 'ATX · Modular · 2 × 8-pin PCIe', w: 750, conns: ['8x1', '8x2'], price: 4200 },
      { id: 'p1000', name: '1000 Вт · 80 PLUS Gold', spec: 'ATX 3.0 · 12VHPWR + 4 × 8-pin', w: 1000, conns: ['8x1', '8x2', '12v'], price: 7500 }
    ],
    case: [
      { id: 'mini', name: 'Компактний корпус', spec: 'для Micro-ATX і Mini-ITX', fits: ['Micro-ATX', 'Mini-ITX'], compact: true, price: 1800 },
      { id: 'mid', name: 'Корпус Midi Tower', spec: 'для ATX, Micro-ATX, Mini-ITX', fits: ['ATX', 'Micro-ATX', 'Mini-ITX'], compact: false, price: 2500 }
    ]
  };
  const CONN_NAME = { none: 'не потрібні', '8x1': '1 × 8-pin PCIe', '8x2': '2 × 8-pin PCIe', '12v': '12VHPWR' };
  const ORDERS = [
    { id: 'lib', icon: '🏫', who: 'Бібліотека ліцею', text: 'Потрібен тихий офісний комп’ютер для документів і браузера. Місця на столі мало — тільки <b>компактний корпус</b>.', budget: 13000,
      req: [{ t: 'Компактний корпус', ok: s => s.case && s.case.compact }] },
    { id: 'gamer', icon: '🎮', who: 'Геймер Максим', text: 'Хочу грати в нові ігри у Full HD. Відеокарта — <b>не слабша за RTX 4060</b>, пам’яті — <b>від 16 ГБ</b>.', budget: 35000,
      req: [{ t: 'Відеокарта від RTX 4060', ok: s => s.gpu && s.gpu.tier >= 2 }, { t: 'Оперативної пам’яті від 16 ГБ', ok: s => s.ram && s.ram.gb >= 16 }] },
    { id: 'studio', icon: '🎬', who: 'Студія відеомонтажу', text: 'Монтаж і 3D: процесор <b>від 8 ядер</b>, <b>32 ГБ</b> оперативної пам’яті, відеокарта з <b>16 ГБ</b> відеопам’яті.', budget: 70000,
      req: [{ t: 'Процесор від 8 ядер', ok: s => s.cpu && s.cpu.cores >= 8 }, { t: '32 ГБ оперативної пам’яті', ok: s => s.ram && s.ram.gb >= 32 }, { t: 'Відеопам’ять 16 ГБ', ok: s => s.gpu && s.gpu.vram >= 16 }] }
  ];
  const needW = s => Math.round(((s.cpu ? s.cpu.tdp : 0) + (s.gpu ? s.gpu.tdp : 0) + 100) * 1.3);
  const priceOf = s => CAT.reduce((a, c) => a + (s[c.id] ? s[c.id].price : 0), 0);
  function checksOf(order, s) {
    const r = [];
    r.push({ t: 'Сокет процесора збігається з сокетом плати', ok: s.cpu.socket === s.mb.socket, why: `Процесор ${s.cpu.socket}, а плата ${s.mb.socket}.` });
    r.push({ t: 'Пам’ять підходить до плати', ok: !s.ram.sodimm && s.ram.type === s.mb.ram,
      why: s.ram.sodimm ? 'SO-DIMM — пам’ять для ноутбуків, у слоти DIMM не встане.' : `Плата підтримує ${s.mb.ram}, а пам’ять — ${s.ram.type}.` });
    r.push({ t: 'Плата влазить у корпус', ok: s.case.fits.includes(s.mb.ff), why: `Плата ${s.mb.ff} не поміститься в «${s.case.name}».` });
    r.push({ t: 'Є чим вивести зображення', ok: s.gpu.id !== 'none' || s.cpu.igpu, why: `У ${s.cpu.name} немає вбудованої графіки — монітор покаже «Немає сигналу».` });
    const nw = needW(s);
    r.push({ t: `Потужності БЖ вистачає (потрібно ≈ ${nw} Вт)`, ok: s.psu.w >= nw, why: `(${s.cpu.tdp} + ${s.gpu.tdp} + 100) × 1,3 ≈ ${nw} Вт, а блок — лише ${s.psu.w} Вт.` });
    r.push({ t: 'БЖ має конектори для відеокарти', ok: s.gpu.conn === 'none' || s.psu.conns.includes(s.gpu.conn), why: `Відеокарті потрібен ${CONN_NAME[s.gpu.conn]}, а в блоці його немає.` });
    const p = priceOf(s);
    r.push({ t: `Вкладаємося в бюджет (${fmt(p)} з ${fmt(order.budget)} грн)`, ok: p <= order.budget, why: `Перевищення на ${fmt(p - order.budget)} грн.` });
    for (const q of order.req) r.push({ t: q.t, ok: !!q.ok(s), why: 'Клієнт просив саме так.' });
    return r;
  }
  const scoreFor = n => n <= 1 ? 100 : n === 2 ? 75 : 50;

  window.Games['pc-config'] = {
    readonlyView: true,
    mount(host, ctx) {
      const life = K.lifecycle(), h = K.h;
      const d0 = (ctx.saved && ctx.saved.details) || {};
      const ret = K.returnInfo(ctx);
      const sel = {}, tries = {}, done = {};
      for (const od of ORDERS) {
        sel[od.id] = Object.assign({}, (d0.sel || {})[od.id] || {});
        tries[od.id] = (d0.tries || {})[od.id] || 0;
        done[od.id] = !!(d0.done || {})[od.id];
      }
      let locked = K.isLocked(ctx), busy = false;
      let cur = (ORDERS.find(od => !done[od.id]) || ORDERS[0]).id;
      const lastChecks = {};
      const status = statusEl();
      const save = K.saver(ctx, { life, getDetails: () => ({ sel, tries, done, ack: ret.ack }), onError: draftError(status, life) });
      const total = () => Math.round(ORDERS.reduce((a, od) => a + (done[od.id] ? scoreFor(tries[od.id]) : 0), 0) / ORDERS.length);
      const resolve = od => { const s = {}; for (const c of CAT) { const id = sel[od.id][c.id]; s[c.id] = id ? ITEMS[c.id].find(x => x.id === id) : null; } return s; };

      const tabs = h('div', { class: 'cfg-tabs', role: 'tablist', 'aria-label': 'Замовлення' });
      const main = h('div', { class: 'cfg-main' });
      const side = h('div', { class: 'cfg-side' });
      const submit = h('button', { type: 'button', class: 'btn primary' }, 'Завершити практику');
      const progress = h('span', { class: 'mbg-muted' });
      host.append(h('div', { class: 'mbg pcc' }, ...K.banners(ctx),
        h('p', { class: 'mbg-intro', html: 'Ти — консультант комп’ютерного магазину 🧑‍💼. Для кожного клієнта обери по одній деталі з кожної категорії і натисни <b>«Перевірити збірку»</b>. Перша вдала перевірка — 100 %, друга — 75 %, далі — 50 %. Оцінка — середнє за 3 замовлення; рахується після «Завершити практику».' }),
        tabs, h('div', { class: 'cfg-grid' }, main, side), h('div', { class: 'mbg-submitrow' }, submit, progress, status)));

      let panel = null;
      function render() {
        if (panel) panel.dispose();
        panel = K.lifecycle();
        const od = ORDERS.find(x => x.id === cur), s = resolve(od), p = priceOf(s);
        const odLocked = locked || busy || done[od.id];
        tabs.textContent = '';
        for (const x of ORDERS) {
          const st = done[x.id] ? '✓ ' + scoreFor(tries[x.id]) + ' %' : tries[x.id] ? '✗ спроб: ' + tries[x.id] : '';
          const b = h('button', { type: 'button', role: 'tab', 'aria-selected': String(x.id === cur), class: 'cfg-tab' + (x.id === cur ? ' on' : '') + (done[x.id] ? ' done' : ''), 'data-readonly-ok': '', 'data-order': x.id },
            h('span', { text: x.icon }), h('b', { text: x.who }), st ? h('i', { text: st }) : null);
          panel.listen(b, 'click', () => { if (cur === x.id) return; cur = x.id; render(); });
          tabs.append(b);
        }
        main.textContent = '';
        main.append(h('div', { class: 'cfg-order' }, h('span', { class: 'cfg-oi', text: od.icon }),
          h('div', null, h('b', { text: od.who }), h('div', { html: od.text }), h('div', { class: 'cfg-budget', text: `Бюджет: до ${fmt(od.budget)} грн` }))));
        for (const c of CAT) {
          const box = h('div', { class: 'cfg-opts', role: 'group', 'aria-label': c.name });
          for (const it of ITEMS[c.id]) {
            const on = sel[od.id][c.id] === it.id;
            const b = h('button', { type: 'button', class: 'cfg-opt' + (on ? ' on' : ''), 'aria-pressed': String(on), 'data-cat': c.id, 'data-item': it.id },
              h('b', { text: it.name }), h('span', { text: it.spec }), h('i', { text: fmt(it.price) + ' грн' }));
            b.disabled = odLocked;
            panel.listen(b, 'click', () => { if (locked || busy || done[od.id]) return; sel[od.id][c.id] = it.id; delete lastChecks[od.id]; render(); save.draft(); });
            box.append(b);
          }
          main.append(h('div', { class: 'cfg-cat' }, h('div', { class: 'cfg-ch' }, h('span', { text: c.icon }), h('b', { text: c.name })), box));
        }
        side.textContent = '';
        side.append(h('div', { class: 'cfg-h', text: '🧾 Чек' }));
        const bill = h('div', { class: 'cfg-bill' });
        for (const c of CAT) bill.append(h('div', { class: s[c.id] ? '' : 'empty' }, h('span', { text: c.icon + ' ' + (s[c.id] ? s[c.id].name : c.name + ' — не обрано') }), h('b', { text: s[c.id] ? fmt(s[c.id].price) : '' })));
        side.append(bill, h('div', { class: 'cfg-sum' + (p > od.budget ? ' over' : '') }, h('span', { text: 'Разом' }), h('b', { text: `${fmt(p)} / ${fmt(od.budget)} грн` })),
          h('div', { class: 'cfg-bar' + (p > od.budget ? ' over' : '') }, h('i', { style: `width:${Math.min(100, Math.round(100 * p / od.budget))}%` })),
          h('div', { class: 'cfg-pow', html: `⚡ Потрібний БЖ: (CPU ${s.cpu ? s.cpu.tdp : '?'} + GPU ${s.gpu ? s.gpu.tdp : '?'} + 100) × 1,3 ≈ <b>${s.cpu && s.gpu ? needW(s) + ' Вт' : '?'}</b>` }));
        const all = CAT.every(c => s[c.id]);
        if (done[od.id]) side.append(h('div', { class: 'cfg-ok', text: `✓ Замовлення виконано: ${scoreFor(tries[od.id])} %` }));
        else if (!locked) {
          const btn = h('button', { type: 'button', class: 'btn primary cfg-check' }, all ? 'Перевірити збірку' : 'Обери всі 6 деталей');
          btn.disabled = !all || busy;
          panel.listen(btn, 'click', () => {
            if (locked || busy || done[od.id] || !CAT.every(c => s[c.id])) return;
            const r = checksOf(od, s);
            tries[od.id]++;
            lastChecks[od.id] = r;
            if (r.every(x => x.ok)) {
              done[od.id] = true;
              status.textContent = `${od.who}: комп’ютер запустився! 🎉`;
              const next = ORDERS.find(x => !done[x.id]);
              if (next) cur = next.id;
              else status.textContent = 'Усі три замовлення виконано! Натисни «Завершити практику».';
            } else status.textContent = `${od.who}: збірка не запуститься — подивись, що позначено ✗.`;
            render(); save.draft();
          });
          side.append(btn);
          if (tries[od.id]) side.append(h('div', { class: 'mbg-muted cfg-tries', text: `Спроб: ${tries[od.id]}` }));
        }
        const r = lastChecks[od.id];
        if (r) side.append(h('div', { class: 'cfg-checks' }, r.map(x => h('div', { class: x.ok ? 'ok' : 'bad' }, h('b', { text: (x.ok ? '✓ ' : '✗ ') + x.t }), x.ok ? null : h('span', { text: x.why })))));
        submit.classList.toggle('hidden', locked);
        submit.disabled = busy;
        const n = ORDERS.filter(x => done[x.id]).length;
        progress.textContent = `Виконано: ${n} з ${ORDERS.length} · поточний результат ${total()} %`;
      }
      life.add(() => { if (panel) panel.dispose(); });
      life.listen(submit, 'click', async () => {
        if (locked || busy) return;
        const n = ORDERS.filter(x => done[x.id]).length;
        if (n < ORDERS.length) {
          const ok = await K.confirm({ title: 'Завершити практику?', html: `<p>Виконано замовлень: <b>${n} з ${ORDERS.length}</b>. Невиконані рахуються як 0 %.</p><p>Оцінка зараз: <b>${total()}%</b>.</p>`, ok: 'Завершити так', cancel: 'Ще попрацюю' });
          if (!ok || life.disposed || locked) return;
        }
        busy = true; render(); status.textContent = 'Підбиваю підсумок…';
        try { await save.final(total()); if (life.disposed) return; locked = true; status.textContent = `Завершено. Результат: ${total()}%.`; }
        catch (e) { if (!life.disposed) status.textContent = 'Не вдалося завершити. Натисни «Завершити практику» ще раз.'; }
        finally { busy = false; if (!life.disposed) render(); }
      });
      render();
      if (locked && ctx.saved && ctx.saved.final) status.textContent = `Завершено. Результат: ${ctx.saved.score}%.`;
      if (ret.isNew && !locked) save.draft();
      return () => life.dispose();
    }
  };
})();
