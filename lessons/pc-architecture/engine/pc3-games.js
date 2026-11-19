/* Компоненти ПК · Урок 3 — RAM і накопичувачі.
   Ігри: «ram-sim» (RAM під навантаженням), «ram-config» (конфігуратор пам'яті),
   «storage-race» (перегони накопичувачів і вибір рішення), «pc-passport» (паспорт пам'яті мого ПК). */
(function () {
  'use strict';
  const App = window.App || {};
  window.Games = window.Games || {};

  /* ---------------------------------------------------------------- Утиліти */
  function h(tag, props, ...kids) {
    const el = document.createElement(tag);
    if (props) for (const k in props) {
      const v = props[k];
      if (v == null || v === false) continue;
      if (k === 'class') el.className = v;
      else if (k === 'text') el.textContent = v;
      else if (k === 'html') el.innerHTML = v;
      else if (k === 'style') el.style.cssText = v;
      else if (k.slice(0, 2) === 'on' && typeof v === 'function') el.addEventListener(k.slice(2), v);
      else el.setAttribute(k, v === true ? '' : v);
    }
    for (const c of kids.flat()) { if (c == null || c === false) continue; el.append(c.nodeType ? c : String(c)); }
    return el;
  }
  const clone = o => JSON.parse(JSON.stringify(o));
  const fmt = (n, d = 1) => (Math.round(n * Math.pow(10, d)) / Math.pow(10, d)).toLocaleString('uk-UA', { maximumFractionDigits: d });
  const toast = (ctx, m, k) => { try { (ctx.toast || App.toast || (() => {}))(m, k); } catch (e) {} };
  function debounce(fn, ms) {
    let t = null;
    const d = () => { clearTimeout(t); t = setTimeout(() => { t = null; fn(); }, ms); };
    d.pending = () => t !== null;
    d.cancel = () => { clearTimeout(t); t = null; };
    d.flush = () => { if (t !== null) { clearTimeout(t); t = null; fn(); } };
    return d;
  }
  function saver(ctx) {
    let chain = Promise.resolve();
    return (score, details, final) => {
      const snap = clone(details);
      const req = chain.then(() => final ? ctx.finish(score, snap) : ctx.complete(score, snap, false));
      chain = req.catch(() => {});
      return req;
    };
  }
  const returnedNow = (ctx, d) => !!(ctx.saved && !ctx.saved.final && (ctx.saved.returnCount || 0) > ((d && d.ack) || 0));

  /* ======================================================= Рушій місій */
  function missionGame(host, ctx, cfg) {
    const saved = (ctx.saved && ctx.saved.details) || {};
    const M = cfg.missions;
    const ro = !!ctx.readOnly;
    const wasReturned = returnedNow(ctx, saved);
    let submitted = !!(ctx.saved && ctx.saved.final);
    let busy = false, dead = false, failMsg = '';
    const st = {
      sim: cfg.initSim(saved.sim ? clone(saved.sim) : null),
      first: Object.assign({}, saved.first), solved: Object.assign({}, saved.solved), sel: Object.assign({}, saved.sel),
      cur: Math.max(0, Math.min(saved.cur || 0, M.length - 1)), ack: wasReturned ? ctx.saved.returnCount : (saved.ack || 0)
    };
    const persist = saver(ctx);
    const score = () => Math.round(100 * M.filter(m => st.first[m.id] === m.answer).length / M.length);
    const details = () => ({ sim: st.sim, first: st.first, solved: st.solved, sel: st.sel, cur: st.cur, ack: st.ack,
      review: M.map(m => ({ right: st.first[m.id] === m.answer, text: m.title + ': ' + (st.first[m.id] == null ? '—' : m.options[st.first[m.id]]) + (st.solved[m.id] ? '' : ' (не розв’язано)') })) });
    const locked = () => submitted || ro;
    const draft = debounce(() => { if (!locked() && !dead) persist(score(), details(), false).catch(() => {}); }, 700);

    const dots = h('div', { class: 'px-dots', role: 'list' });
    const scoreEl = h('div', { class: 'px-score' });
    const stage = h('div', { class: 'px-stage' });
    const panel = h('aside', { class: 'px-mission', 'aria-live': 'polite' });
    const status = h('p', { class: 'px-status', role: 'status' });
    const submitBtn = h('button', { class: 'px-btn px-primary', type: 'button' }, 'Завершити й побачити результат');
    const root = h('div', { class: 'px-game ' + (cfg.cls || '') },
      h('div', { class: 'px-head' }, h('div', null, h('div', { class: 'px-kicker', text: cfg.kicker || 'Симулятор' }), h('h2', { text: cfg.title })), dots, scoreEl),
      wasReturned ? h('div', { class: 'px-banner', text: '↩ Вчитель повернув роботу. Перевір відповіді й надішли ще раз.' }) : null,
      ro && !submitted ? h('div', { class: 'px-banner info', text: '👁 Режим перегляду: змінювати роботу зараз не можна.' }) : null,
      h('div', { class: 'px-grid' }, stage, panel),
      h('div', { class: 'px-foot' }, h('p', { class: 'px-rule', text: cfg.rule || `${M.length} місій. Бал — частка правильних відповідей з першої спроби. Після помилки прочитай пояснення й виправ відповідь.` }), status, submitBtn));
    host.appendChild(root);

    const api = { sim: st.sim, locked, changed() { renderPanel(); renderDots(); draft(); }, ctx, mission: () => M[st.cur] };
    const stageCtl = cfg.mountStage(stage, api);

    function renderDots() {
      dots.innerHTML = '';
      M.forEach((m, i) => {
        const cls = st.solved[m.id] ? (st.first[m.id] === m.answer ? 'ok' : 'retry') : '';
        const b = h('button', { class: 'px-dot ' + cls + (i === st.cur ? ' cur' : ''), type: 'button', role: 'listitem', title: `Місія ${i + 1}: ${m.title}`, 'aria-label': `Місія ${i + 1}: ${m.title}` }, String(i + 1));
        b.onclick = () => { st.cur = i; renderPanel(); renderDots(); if (stageCtl.onMission) stageCtl.onMission(M[i]); };
        dots.appendChild(b);
      });
      const done = M.filter(m => st.solved[m.id]).length;
      scoreEl.innerHTML = `<b>${score()}%</b><span>розв’язано ${done}/${M.length}</span>`;
      const all = done === M.length;
      submitBtn.disabled = !all || busy || locked();
      submitBtn.hidden = locked();
      if (submitted) status.textContent = `Завершено. Результат: ${score()}%.`;
      else if (failMsg) status.textContent = failMsg;
      else if (!all && !ro) status.textContent = 'Розв’яжи всі місії — тоді можна завершити завдання.';
      else if (all && !ro && !busy) status.textContent = 'Усі місії розв’язано. Надішли результат.';
    }
    function renderPanel() {
      const m = M[st.cur];
      const needOk = !m.need || !!safe(() => m.need.test(st.sim));
      const solved = !!st.solved[m.id];
      panel.innerHTML = '';
      panel.append(h('div', { class: 'px-mhead' }, h('span', { class: 'px-mnum', text: `Місія ${st.cur + 1} / ${M.length}` }), h('h3', { text: m.title })));
      panel.append(h('div', { class: 'px-task', html: m.task }));
      if (m.need) panel.append(h('div', { class: 'px-need ' + (needOk ? 'ok' : '') }, h('span', { class: 'mk', text: needOk ? '✓' : '○' }), h('span', { text: (needOk ? 'Виконано: ' : 'Дія в симуляторі: ') + m.need.label })));
      const opts = h('div', { class: 'px-opts', role: 'radiogroup', 'aria-label': m.q });
      panel.append(h('p', { class: 'px-q', text: m.q }), opts);
      const canAnswer = needOk && !solved && !locked() && !busy;
      m.options.forEach((o, i) => {
        const picked = st.sel[m.id] === i;
        let cls = 'px-opt' + (picked ? ' sel' : '');
        if (solved && i === m.answer) cls += ' right';
        const b = h('button', { class: cls, type: 'button', role: 'radio', 'aria-checked': picked ? 'true' : 'false', disabled: !canAnswer }, h('span', { class: 'px-letter', text: 'АБВГДЕ'[i] }), h('span', { text: o }));
        b.onclick = () => { if (!canAnswer) return; st.sel[m.id] = i; renderPanel(); draft(); };
        opts.appendChild(b);
      });
      if (!needOk && !solved) panel.append(h('p', { class: 'px-hint', text: 'Спершу виконай дію в симуляторі — тоді відповіді розблокуються.' }));
      const fb = h('div', { class: 'px-fb' });
      if (solved) { fb.className = 'px-fb ok'; fb.textContent = (st.first[m.id] === m.answer ? '✓ Правильно з першої спроби. ' : '✓ Розв’язано. ') + m.why; }
      else if (st.first[m.id] != null) { fb.className = 'px-fb bad'; fb.textContent = '✗ Не зовсім. ' + m.why + ' Спробуй ще раз.'; }
      const check = h('button', { class: 'px-btn px-primary', type: 'button', disabled: !canAnswer || st.sel[m.id] == null }, 'Перевірити');
      check.onclick = () => {
        if (!canAnswer || st.sel[m.id] == null) return;
        const c = st.sel[m.id];
        if (st.first[m.id] == null) st.first[m.id] = c;
        if (c === m.answer) st.solved[m.id] = true;
        renderPanel(); renderDots(); draft();
      };
      const prev = h('button', { class: 'px-btn', type: 'button', disabled: st.cur === 0 }, '←');
      prev.onclick = () => { st.cur--; renderPanel(); renderDots(); if (stageCtl.onMission) stageCtl.onMission(M[st.cur]); };
      const next = h('button', { class: 'px-btn', type: 'button', disabled: st.cur === M.length - 1 || !solved }, 'Наступна місія →');
      next.onclick = () => { st.cur++; renderPanel(); renderDots(); if (stageCtl.onMission) stageCtl.onMission(M[st.cur]); };
      panel.append(fb, h('div', { class: 'px-nav' }, prev, solved ? null : check, next));
    }
    const safe = f => { try { return f(); } catch (e) { return false; } };
    submitBtn.onclick = async () => {
      if (locked() || busy || !M.every(m => st.solved[m.id])) return;
      busy = true; failMsg = ''; draft.cancel(); submitBtn.disabled = true; status.textContent = 'Підбиваю підсумок…';
      try {
        await persist(score(), details(), true);
        if (dead) return;
        submitted = true; stageCtl.render && stageCtl.render();
      } catch (e) {
        if (!dead) { failMsg = 'Не вдалося завершити. Відповіді залишилися на сторінці — натисни кнопку ще раз.'; toast(ctx, 'Не вдалося завершити завдання', 'warn'); }
      } finally { busy = false; if (!dead) { renderPanel(); renderDots(); } }
    };
    renderPanel(); renderDots();
    if (stageCtl.onMission) stageCtl.onMission(M[st.cur]);
    if (wasReturned && !ro) persist(score(), details(), false).catch(() => {});
    return () => {
      dead = true;
      stageCtl.destroy && stageCtl.destroy();
      if (draft.pending()) { draft.cancel(); if (!locked()) persist(score(), details(), false).catch(() => {}); }
    };
  }
  const seg = (items, value, onPick, disabled, label) => h('div', { class: 'px-seg', role: 'group', 'aria-label': label },
    items.map(([v, t]) => { const b = h('button', { type: 'button', class: v === value ? 'on' : '', 'aria-pressed': v === value ? 'true' : 'false', disabled: !!disabled }, t); b.onclick = () => onPick(v); return b; }));

  /* ======================================================= 1. RAM під навантаженням */
  const OS_GB = 2.5;
  const APPS = [
    { id: 'browser', name: 'Браузер', sub: '10 вкладок', gb: 3, color: '#3B82F6', icon: '🌐' },
    { id: 'game', name: 'Гра', sub: '3D-шутер', gb: 6, color: '#EF4444', icon: '🎮' },
    { id: 'chat', name: 'Месенджер', sub: 'голосовий чат', gb: 1, color: '#8B5CF6', icon: '💬' },
    { id: 'photo', name: 'Фоторедактор', sub: 'плакат', gb: 2.5, color: '#06B6D4', icon: '🎨' },
    { id: 'video', name: 'Відеоредактор', sub: 'монтаж', gb: 4, color: '#F59E0B', icon: '🎬' },
    { id: 'docs', name: 'Текстовий редактор', sub: 'реферат', gb: 0.5, color: '#10B981', icon: '📝' }
  ];
  const appById = id => APPS.find(a => a.id === id);
  const sameSet = (a, b) => a.length === b.length && b.every(x => a.includes(x));
  window.Games['ram-sim'] = {
    readonlyView: true,
    mount(host, ctx) {
      return missionGame(host, ctx, {
        title: 'RAM під навантаженням', kicker: 'Симулятор · оперативна пам’ять', cls: 'px-ram',
        initSim: s => Object.assign({ cap: 8, run: [], power: true, saved: false }, s || {}),
        missions: [
          { id: 'm1', title: 'Пам’яті не вистачає', task: 'Встанови <b>8 ГБ</b> RAM і запусти <b>гру</b>. Подивись на модуль пам’яті й на файл підкачки.',
            need: { label: '8 ГБ RAM і запущена гра', test: s => s.power && s.cap === 8 && s.run.includes('game') },
            q: 'Що робить операційна система, коли RAM бракує?',
            options: ['Переносить частину даних у файл підкачки на SSD — ПК пригальмовує', 'Автоматично збільшує обсяг RAM', 'Вимикає комп’ютер, щоб не перегрітися', 'Видаляє гру з накопичувача'], answer: 0,
            why: 'Файл підкачки лежить на накопичувачі, а він у десятки разів повільніший за RAM. Тому ПК «задумується».' },
          { id: 'm2', title: 'Скільки ще вільно?', task: 'Тепер постав <b>16 ГБ</b> і запусти рівно три програми: <b>гру, браузер і месенджер</b>. Windows уже займає 2,5 ГБ.',
            need: { label: '16 ГБ, запущені лише гра, браузер і месенджер', test: s => s.power && s.cap === 16 && sameSet(s.run, ['game', 'browser', 'chat']) },
            q: 'Скільки RAM залишилося вільно?',
            options: ['12,5 ГБ', '3,5 ГБ', '6 ГБ', '0 ГБ — усе зайнято'], answer: 1,
            why: '2,5 + 6 + 3 + 1 = 12,5 ГБ зайнято. 16 − 12,5 = 3,5 ГБ вільно.' },
          { id: 'm3', title: 'Купувати більше RAM?', task: 'На <b>16 ГБ</b> залиш запущеним <b>лише браузер</b>. Ти думаєш про апгрейд до 32 ГБ.',
            need: { label: '16 ГБ, запущено лише браузер', test: s => s.power && s.cap === 16 && sameSet(s.run, ['browser']) },
            q: 'Чи пришвидшить браузер перехід на 32 ГБ?',
            options: ['Так, удвічі', 'Так, бо більше RAM завжди означає швидше', 'Ні: зайнято лише 5,5 з 16 ГБ, зайвий обсяг просто не використовується', 'Ні, бо браузер не використовує RAM'], answer: 2,
            why: 'Додаткова RAM допомагає, лише коли її бракує. Якщо вільного місця вдосталь, швидкість залежить від CPU, частоти й затримок.' },
          { id: 'm4', title: 'Вимкнули світло', task: 'Запусти <b>фоторедактор</b>, натисни <b>💾 Зберегти плакат</b>, а потім <b>⏻ вимкни живлення</b>.',
            need: { label: 'плакат збережено, живлення вимкнено', test: s => s.saved && !s.power },
            q: 'Що залишилося після вимкнення?',
            options: ['Усе: відкриті програми продовжать роботу', 'Нічого — зник навіть збережений файл', 'Вміст RAM зник, а збережений плакат лишився на SSD', 'Програми лишилися в RAM, а файл зник'], answer: 2,
            why: 'Звичайна RAM енергозалежна: без живлення дані зникають. Накопичувач зберігає файли й без живлення.' }
        ],
        mountStage(stage, api) {
          const s = api.sim;
          function render() {
            const lock = api.locked();
            const used = s.power ? OS_GB + s.run.reduce((a, id) => a + appById(id).gb, 0) : 0;
            const swap = Math.max(0, used - s.cap);
            const free = Math.max(0, s.cap - used);
            const resp = !s.power ? 0 : swap === 0 ? 100 : Math.max(8, Math.round(100 - swap / s.cap * 260));
            stage.innerHTML = '';
            const capSeg = seg([[8, '8 ГБ'], [16, '16 ГБ'], [32, '32 ГБ']], s.cap, v => { s.cap = v; render(); api.changed(); }, lock, 'Обсяг RAM');
            const power = h('button', { type: 'button', class: 'px-power' + (s.power ? ' on' : ''), disabled: lock, 'aria-pressed': s.power ? 'true' : 'false' }, s.power ? '⏻ Вимкнути живлення' : '⏻ Увімкнути ПК');
            power.onclick = () => { if (s.power) { s.power = false; s.run = []; } else s.power = true; render(); api.changed(); };
            stage.append(h('div', { class: 'ram-top' }, h('div', null, h('div', { class: 'px-lbl', text: 'Встановлено RAM' }), capSeg), power));
            /* модуль RAM */
            const stick = h('div', { class: 'ram-stick' + (s.power ? '' : ' off') });
            const fill = h('div', { class: 'ram-fill' });
            const segs = [{ name: 'Windows', gb: OS_GB, color: '#64748B' }, ...(s.power ? s.run.map(appById).map(a => ({ name: a.name, gb: a.gb, color: a.color, icon: a.icon })) : [])];
            if (!s.power) segs.length = 0;
            let acc = 0;
            segs.forEach(g => {
              const inRam = Math.max(0, Math.min(g.gb, s.cap - acc));
              acc += g.gb;
              if (inRam > 0) fill.append(h('div', { class: 'ram-seg', style: `width:${inRam / s.cap * 100}%;background:${g.color}`, title: `${g.name}: ${fmt(g.gb)} ГБ` }, h('span', { text: (g.icon ? g.icon + ' ' : '') + fmt(g.gb) })));
            });
            stick.append(h('div', { class: 'ram-chips' }, Array.from({ length: 8 }, () => h('i'))), fill, h('div', { class: 'ram-pins' }));
            stage.append(h('div', { class: 'ram-meter' },
              h('div', { class: 'ram-cap' }, h('b', { text: s.power ? `${fmt(Math.min(used, s.cap))} з ${s.cap} ГБ зайнято` : 'Живлення вимкнено — RAM порожня' }), h('span', { text: s.power ? `вільно ${fmt(free)} ГБ` : '' })),
              stick));
            /* файл підкачки */
            const swapBox = h('div', { class: 'ram-swap' + (swap > 0 ? ' hot' : '') },
              h('div', { class: 'px-lbl', text: '💽 Файл підкачки на SSD' }),
              h('div', { class: 'swap-bar' }, h('i', { style: `width:${Math.min(100, swap / 8 * 100)}%` })),
              h('div', { class: 'swap-txt', text: swap > 0 ? `${fmt(swap)} ГБ даних винесено на SSD — доступ значно повільніший` : 'порожньо: усі робочі дані вміщаються в RAM' }));
            const gauge = h('div', { class: 'ram-gauge ' + (resp >= 90 ? 'g' : resp >= 50 ? 'y' : 'r') },
              h('div', { class: 'px-lbl', text: 'Чуйність системи' }),
              h('div', { class: 'gauge-bar' }, h('i', { style: `width:${resp}%` })),
              h('b', { text: !s.power ? '—' : resp >= 90 ? 'Швидко ⚡' : resp >= 50 ? 'Пригальмовує' : 'Сильно гальмує ⏳' }));
            stage.append(h('div', { class: 'ram-row' }, swapBox, gauge));
            /* програми */
            const apps = h('div', { class: 'ram-apps' });
            APPS.forEach(a => {
              const on = s.run.includes(a.id);
              const b = h('button', { type: 'button', class: 'ram-app' + (on ? ' on' : ''), disabled: lock || !s.power, 'aria-pressed': on ? 'true' : 'false', style: `--c:${a.color}` },
                h('span', { class: 'ic', text: a.icon }), h('span', { class: 'nm' }, h('b', { text: a.name }), h('small', { text: a.sub })), h('span', { class: 'gb', text: fmt(a.gb) + ' ГБ' }));
              b.onclick = () => { if (on) s.run = s.run.filter(x => x !== a.id); else s.run.push(a.id); render(); api.changed(); };
              apps.append(b);
            });
            stage.append(h('div', { class: 'px-lbl', text: s.power ? 'Програми — клацни, щоб запустити або закрити' : 'Програми недоступні: ПК вимкнено' }), apps);
            /* SSD */
            const saveBtn = h('button', { type: 'button', class: 'px-btn', disabled: lock || !s.power || !s.run.includes('photo') || s.saved }, s.saved ? '✓ Плакат збережено' : '💾 Зберегти плакат');
            saveBtn.onclick = () => { s.saved = true; render(); api.changed(); };
            stage.append(h('div', { class: 'ram-ssd' }, h('div', null, h('div', { class: 'px-lbl', text: '🗄 SSD · мої файли' }), h('div', { class: 'files' }, h('span', { text: '📄 реферат.docx' }), s.saved ? h('span', { class: 'new', text: '🖼 плакат.png' }) : null)), saveBtn));
          }
          render();
          return { render };
        }
      });
    }
  };

  /* ======================================================= 2. Конфігуратор пам'яті */
  const MODS = {
    m1: { gen: 'ddr4', mts: 3200, cl: 16, gb: 8 }, m2: { gen: 'ddr4', mts: 3200, cl: 16, gb: 8 },
    m3: { gen: 'ddr4', mts: 2666, cl: 19, gb: 8 }, m4: { gen: 'ddr4', mts: 2666, cl: 19, gb: 8 },
    m5: { gen: 'ddr5', mts: 5600, cl: 40, gb: 16 }, m6: { gen: 'ddr5', mts: 5600, cl: 40, gb: 16 }
  };
  const SLOTS = ['A1', 'A2', 'B1', 'B2'];
  const modLabel = m => `${m.gen.toUpperCase()}-${m.mts}`;
  function memCalc(s) {
    const ids = SLOTS.map(k => s.slots[k]).filter(Boolean);
    const mods = ids.map(id => MODS[id]);
    const ch = (s.slots.A1 || s.slots.A2 ? 1 : 0) + (s.slots.B1 || s.slots.B2 ? 1 : 0);
    if (!mods.length) return { n: 0, ch: 0, gb: 0, mts: 0, cl: 0, bw: 0, ns: 0, mixed: false, ids };
    const mts = Math.min(...mods.map(m => m.mts)), cl = Math.max(...mods.map(m => m.cl));
    return { n: mods.length, ch, gb: mods.reduce((a, m) => a + m.gb, 0), mts, cl, bw: mts * 8 * ch / 1000, ns: cl * 2000 / mts, mixed: new Set(mods.map(m => m.mts)).size > 1, ids };
  }
  window.Games['ram-config'] = {
    readonlyView: true,
    mount(host, ctx) {
      return missionGame(host, ctx, {
        title: 'Конфігуратор пам’яті', kicker: 'Симулятор · материнська плата', cls: 'px-cfg',
        initSim: s => Object.assign({ board: 'ddr4', slots: { A1: null, A2: null, B1: null, B2: null }, sel: null, mismatch: false, msg: '' }, s || {}),
        missions: [
          { id: 'c1', title: 'Два канали', task: 'На платі <b>DDR4</b> встанови <b>два</b> модулі DDR4 так, щоб пам’ять працювала в <b>двоканальному</b> режимі. Клацни модуль у лотку, потім — гніздо.',
            need: { label: 'плата DDR4, 2 модулі, режим «двоканальний»', test: s => { const c = memCalc(s); return s.board === 'ddr4' && c.n === 2 && c.ch === 2; } },
            q: 'Чому важливо, у які гнізда вставити модулі?',
            options: ['Так модулі менше нагріваються', 'Кожен канал — окремий шлях до контролера пам’яті; модулі мають бути в різних каналах', 'Гнізда A працюють лише з DDR5', 'Різниці немає — режим завжди двоканальний'], answer: 1,
            why: 'Два канали — це два незалежні шляхи до CPU. Якщо обидва модулі в каналі A (A1 + A2), працює лише один канал.' },
          { id: 'c2', title: 'Ціль: 51,2 ГБ/с', task: 'Збери конфігурацію з пропускною здатністю рівно <b>51,2 ГБ/с</b>. Стеж за формулою під платою.',
            need: { label: 'пропускна здатність 51,2 ГБ/с', test: s => Math.abs(memCalc(s).bw - 51.2) < 0.01 },
            q: 'Яке обчислення дає 51,2 ГБ/с?',
            options: ['8 ГБ + 8 ГБ × 3200', '3200 МТ/с × 8 байтів × 2 канали = 51 200 МБ/с', '3200 ÷ 64 біти', '3200 × 2 × 8 ГБ'], answer: 1,
            why: 'Пропускна здатність = швидкість передавання × ширина каналу в байтах (64 біти = 8 байтів) × кількість каналів. Обсяг модулів у формулі не бере участі.' },
          { id: 'c3', title: 'Канали чи мегатрансфери?', task: 'Порівняй дві збірки в конфігураторі: <b>DDR4-3200 в одному каналі</b> і <b>DDR4-2666 у двох каналах</b>.',
            q: 'Яка збірка має більшу пропускну здатність?',
            options: ['DDR4-3200 в одному каналі — 25,6 ГБ/с', 'DDR4-2666 у двох каналах — ≈42,7 ГБ/с', 'Однаково — важить лише обсяг', 'Порівняти неможливо'], answer: 1,
            why: 'Другий канал подвоює ширину шини. 2666 × 8 × 2 ≈ 42,7 ГБ/с — більше, ніж 3200 × 8 × 1 = 25,6 ГБ/с.' },
          { id: 'c4', title: 'Різні модулі разом', task: 'Встав разом один модуль <b>DDR4-3200</b> і один <b>DDR4-2666</b>.',
            need: { label: 'встановлено 3200 і 2666', test: s => { const ms = memCalc(s).ids.map(id => MODS[id].mts); return ms.includes(3200) && ms.includes(2666); } },
            q: 'На якій швидкості працюватиме така пара?',
            options: ['3200 МТ/с — за швидшим модулем', '5866 МТ/с — швидкості додаються', '2666 МТ/с — за найповільнішим модулем', '2933 МТ/с — середнє'], answer: 2,
            why: 'Контролер налаштовує всі модулі на швидкість, яку витримує найповільніший. Тому модулі краще купувати однаковими, комплектом.' },
          { id: 'c5', title: 'DDR5 у плату DDR4?', task: 'Перемкни плату на <b>DDR4</b> і спробуй вставити модуль <b>DDR5-5600</b>.',
            need: { label: 'спроба вставити DDR5 у DDR4', test: s => !!s.mismatch },
            q: 'Чому модуль не вставився?',
            options: ['Треба сильніше натиснути', 'DDR5 підходить лише для ноутбуків', 'Бракує драйвера в Windows', 'Покоління мають різне розташування вирізу-ключа і несумісні електрично'], answer: 3,
            why: 'Виріз на контактах розташований у кожного покоління DDR інакше. Так неможливо вставити несумісний модуль і пошкодити плату.' }
        ],
        mountStage(stage, api) {
          const s = api.sim;
          let shakeT = null;
          function render() {
            const lock = api.locked();
            const c = memCalc(s);
            stage.innerHTML = '';
            const boardSeg = seg([['ddr4', 'Плата DDR4'], ['ddr5', 'Плата DDR5']], s.board, v => {
              if (v === s.board) return;
              s.board = v; let ej = 0;
              SLOTS.forEach(k => { if (s.slots[k] && MODS[s.slots[k]].gen !== v) { s.slots[k] = null; ej++; } });
              s.msg = ej ? `Модулі іншого покоління (${ej}) повернуто в лоток.` : '';
              render(); api.changed();
            }, lock, 'Тип материнської плати');
            stage.append(h('div', { class: 'cfg-top' }, h('div', null, h('div', { class: 'px-lbl', text: 'Материнська плата' }), boardSeg), h('div', { class: 'cfg-msg' + (s.msg && /не вставляється/.test(s.msg) ? ' bad' : ''), role: 'status', text: s.msg || (s.sel ? `Обрано ${modLabel(MODS[s.sel])}. Клацни вільне гніздо.` : 'Клацни модуль у лотку, потім — гніздо. Клацни встановлений модуль, щоб вийняти.') })));
            /* плата */
            const board = h('div', { class: 'cfg-board ' + s.board });
            const cpu = h('div', { class: 'cfg-cpu' }, h('b', { text: 'CPU' }), h('small', { text: 'контролер пам’яті' }));
            const lanes = h('div', { class: 'cfg-lanes' },
              h('div', { class: 'lane a' + (s.slots.A1 || s.slots.A2 ? ' on' : '') }, h('span', { text: 'канал A · 64 біти' })),
              h('div', { class: 'lane b' + (s.slots.B1 || s.slots.B2 ? ' on' : '') }, h('span', { text: 'канал B · 64 біти' })));
            const slots = h('div', { class: 'cfg-slots' });
            SLOTS.forEach(k => {
              const id = s.slots[k];
              const m = id && MODS[id];
              const b = h('button', { type: 'button', class: 'cfg-slot ch' + k[0].toLowerCase() + (id ? ' full ' + m.gen : '') + (s.shake === k ? ' shake' : ''), disabled: lock, 'aria-label': `Гніздо ${k}` + (m ? `, встановлено ${modLabel(m)}` : ', порожнє') },
                h('span', { class: 'sk', text: k }), h('span', { class: 'notch' }),
                m ? h('span', { class: 'mod' }, h('b', { text: modLabel(m) }), h('small', { text: `${m.gb} ГБ · CL${m.cl}` })) : h('span', { class: 'empty', text: 'порожнє' }));
              b.onclick = () => {
                if (id && !s.sel) { s.slots[k] = null; s.msg = ''; render(); api.changed(); return; }
                if (!s.sel) { s.msg = 'Спершу обери модуль у лотку.'; render(); return; }
                if (id) { s.msg = 'Гніздо зайняте. Обери інше або вийми модуль.'; render(); return; }
                const mm = MODS[s.sel];
                if (mm.gen !== s.board) {
                  s.mismatch = true; s.shake = k;
                  s.msg = `✋ ${mm.gen.toUpperCase()} не вставляється в гніздо ${s.board.toUpperCase()}: виріз-ключ не збігається.`;
                  clearTimeout(shakeT); shakeT = setTimeout(() => { s.shake = null; render(); }, 600);
                  render(); api.changed(); return;
                }
                s.slots[k] = s.sel; s.sel = null; s.msg = ''; render(); api.changed();
              };
              slots.append(b);
            });
            board.append(cpu, lanes, slots);
            stage.append(board);
            /* лоток */
            const tray = h('div', { class: 'cfg-tray' });
            Object.keys(MODS).forEach(id => {
              const m = MODS[id];
              const inUse = SLOTS.some(k => s.slots[k] === id);
              const b = h('button', { type: 'button', class: 'cfg-mod ' + m.gen + (s.sel === id ? ' sel' : '') + (inUse ? ' used' : ''), disabled: lock || inUse, 'aria-pressed': s.sel === id ? 'true' : 'false' },
                h('span', { class: 'pcb' }, h('i'), h('i'), h('i'), h('i'), h('em', { class: 'k' })), h('b', { text: modLabel(m) }), h('small', { text: `${m.gb} ГБ · CL${m.cl}` }));
              b.onclick = () => { s.sel = s.sel === id ? null : id; s.msg = ''; render(); api.changed(); };
              tray.append(b);
            });
            stage.append(h('div', { class: 'px-lbl', text: 'Лоток з модулями' }), tray);
            /* паспорт конфігурації */
            const mode = c.ch === 2 ? '2 канали' : c.ch === 1 ? '1 канал' : '—';
            stage.append(h('div', { class: 'cfg-spec' },
              spec('Обсяг', c.n ? c.gb + ' ГБ' : '—'),
              spec('Режим', mode, c.ch === 2 ? 'good' : ''),
              spec('Швидкість', c.n ? c.mts + ' МТ/с' : '—', c.mixed ? 'warn' : '', c.mixed ? 'за найповільнішим модулем' : ''),
              spec('Затримка', c.n ? `CL${c.cl} ≈ ${fmt(c.ns)} нс` : '—', '', c.n ? `${c.cl} × 2000 ÷ ${c.mts}` : ''),
              spec('Пропускна здатність', c.n ? fmt(c.bw) + ' ГБ/с' : '—', 'big')));
            stage.append(h('div', { class: 'cfg-formula', html: c.n ? `<span>${c.mts}</span> МТ/с × <span>8</span> байтів × <span>${c.ch}</span> ${c.ch === 1 ? 'канал' : 'канали'} = <b>${(c.mts * 8 * c.ch).toLocaleString('uk-UA')} МБ/с ≈ ${fmt(c.bw)} ГБ/с</b>` : 'Встанови модулі — тут з’явиться розрахунок пропускної здатності.' }),
              h('div', { class: 'cfg-pipe' }, h('i', { style: `width:${Math.min(100, c.bw / 89.6 * 100)}%` }), h('span', { text: 'шкала до 89,6 ГБ/с (DDR5-5600 × 2 канали)' })));
          }
          const spec = (k, v, cls, sub) => h('div', { class: 'sp ' + (cls || '') }, h('small', { text: k }), h('b', { text: v }), sub ? h('em', { text: sub }) : null);
          render();
          return { render, destroy() { clearTimeout(shakeT); } };
        }
      });
    }
  };

  /* ======================================================= 3. Перегони накопичувачів */
  const DRIVES = [
    { id: 'hdd', name: 'HDD 7200 об/хв', sub: 'SATA · магнітні пластини', color: '#F08C00', seq: 160, small: 25 },
    { id: 'sata', name: 'SATA SSD 2,5″', sub: 'флешпам’ять · SATA', color: '#0FA36B', seq: 530, small: 350 },
    { id: 'nvme', name: 'NVMe SSD M.2', sub: 'флешпам’ять · PCIe 4.0', color: '#0EA5E9', seq: 6500, small: 900 }
  ];
  const JOBS = { film: { name: '🎬 Фільм 10 ГБ', mb: 10000, kind: 'seq' }, photos: { name: '🖼 3000 фото по 3 МБ', mb: 9000, kind: 'small' }, game: { name: '🎮 Гра 80 ГБ', mb: 80000, kind: 'seq' } };
  const tfmt = sec => sec < 60 ? `${fmt(sec, sec < 10 ? 1 : 0)} с` : `${Math.floor(sec / 60)} хв ${String(Math.round(sec % 60)).padStart(2, '0')} с`;
  window.Games['storage-race'] = {
    readonlyView: true,
    mount(host, ctx) {
      return missionGame(host, ctx, {
        title: 'Перегони накопичувачів', kicker: 'Симулятор · HDD і SSD', cls: 'px-race',
        initSim: s => Object.assign({ job: 'film', runs: {} }, s || {}),
        missions: [
          { id: 's1', title: 'Копіюємо фільм', task: 'Обери <b>🎬 Фільм 10 ГБ</b> і натисни <b>▶ Старт</b>. Таймери показують реальний час копіювання (анімацію прискорено).',
            need: { label: 'проведено перегони з фільмом', test: s => !!s.runs.film },
            q: 'Скільки приблизно триває копіювання фільму на HDD?',
            options: ['≈ 6 секунд', '≈ 1 хвилину', '≈ 10 хвилин', '≈ 1 годину'], answer: 1,
            why: '10 000 МБ ÷ 160 МБ/с ≈ 62 с. Той самий фільм NVMe SSD копіює за 1–2 секунди.' },
          { id: 's2', title: 'Тисячі дрібних файлів', task: 'Тепер запусти перегони з <b>🖼 3000 фото</b>. Порівняй з результатом фільму в таблиці.',
            need: { label: 'проведено перегони з фото і з фільмом', test: s => !!(s.runs.film && s.runs.photos) },
            q: 'Де HDD програє SATA SSD найсильніше?',
            options: ['На одному великому фільмі', 'Однаково на всіх завданнях', 'На тисячах дрібних фото — головка HDD постійно переміщується між ними', 'HDD виграє на дрібних файлах'], answer: 2,
            why: 'Фільм: ≈62 с проти ≈19 с (у 3 рази). Фото: ≈6 хв проти ≈26 с (у 14 разів). Механічна головка витрачає час на кожен пошук, у SSD рухомих частин немає.' },
          { id: 's3', title: 'Відеоархів школи', task: 'Камери записують відео цілодобово. Потрібно <b>8 ТБ</b> місця за найнижчою ціною за гігабайт. Швидкість не критична.',
            q: 'Який накопичувач обрати?', options: ['NVMe SSD M.2', 'HDD великої місткості', 'Модулі RAM', 'USB-флешки'], answer: 1,
            why: 'HDD дає найдешевший гігабайт і великі обсяги — ідеально для архівів.' },
          { id: 's4', title: 'Ігровий ПК', task: 'Системний диск для ігрового ПК. На материнській платі є слот <b>M.2 з підтримкою PCIe</b>.',
            q: 'Який накопичувач обрати?', options: ['NVMe SSD у слот M.2', 'HDD 5400 об/хв', 'Оптичний DVD-привід', 'SD-карта'], answer: 0,
            why: 'NVMe працює через PCIe й дає найшвидше завантаження системи та ігор. M.2 — лише формат роз’єму, тому перевіряй підтримку PCIe.' },
          { id: 's5', title: 'Старий ноутбук', task: 'Ноутбук має лише відсік <b>2,5″ SATA</b> (слота M.2 немає). Мета — щоб він швидше вмикався.',
            q: 'Що встановити?', options: ['NVMe SSD M.2', 'SATA SSD 2,5″ замість HDD', 'Ще один HDD 7200 об/хв', 'Оптичний привід'], answer: 1,
            why: 'SATA SSD підходить у той самий відсік і роз’єм, а завантаження стане в рази швидшим. NVMe M.2 сюди фізично не встановити.' }
        ],
        mountStage(stage, api) {
          const s = api.sim;
          let raf = null, running = false, live = null;
          function render() {
            const lock = api.locked();
            stage.innerHTML = '';
            const jobSeg = seg(Object.entries(JOBS).map(([k, j]) => [k, j.name]), s.job, v => { if (running) return; s.job = v; live = null; render(); api.changed(); }, lock || running, 'Що копіюємо');
            const start = h('button', { type: 'button', class: 'px-btn px-primary race-go', disabled: lock || running }, running ? 'Копіюємо…' : '▶ Старт');
            start.onclick = go;
            stage.append(h('div', { class: 'race-top' }, h('div', null, h('div', { class: 'px-lbl', text: 'Що копіюємо' }), jobSeg), start));
            const job = JOBS[s.job];
            const lanes = h('div', { class: 'race-lanes' });
            DRIVES.forEach(d => {
              const total = job.mb / (job.kind === 'seq' ? d.seq : d.small);
              const p = live ? Math.min(1, live.t / total) : (s.runs[s.job] ? 1 : 0);
              const shownT = live ? Math.min(live.t, total) : (s.runs[s.job] ? total : 0);
              lanes.append(h('div', { class: 'lane-r ' + d.id + (p >= 1 ? ' done' : '') + (running && p < 1 ? ' busy' : ''), style: `--c:${d.color}` },
                h('div', { class: 'lane-name' }, h('span', { class: 'dico ' + d.id }), h('span', null, h('b', { text: d.name }), h('small', { text: (job.kind === 'seq' ? d.seq : d.small) + ' МБ/с · ' + (d.id === 'hdd' ? 'механіка' : 'флешпам’ять') }))),
                h('div', { class: 'lane-track' }, h('i', { style: `width:${p * 100}%` })),
                h('div', { class: 'lane-time', text: shownT ? tfmt(shownT) + (p >= 1 ? ' ✓' : '') : '—' })));
            });
            stage.append(lanes);
            /* таблиця результатів */
            const rows = Object.keys(JOBS).filter(k => s.runs[k]);
            const tbl = h('table', { class: 'race-tbl' }, h('thead', null, h('tr', null, h('th', { text: 'Завдання' }), DRIVES.map(d => h('th', { text: d.name.split(' ')[0] + (d.id === 'sata' ? ' SSD' : d.id === 'nvme' ? ' SSD' : '') })), h('th', { text: 'HDD ÷ SATA' }))),
              h('tbody', null, rows.length ? rows.map(k => {
                const j = JOBS[k];
                const ts = DRIVES.map(d => j.mb / (j.kind === 'seq' ? d.seq : d.small));
                return h('tr', null, h('td', { text: j.name }), ts.map(t => h('td', { text: tfmt(t) })), h('td', { class: 'x', text: `×${fmt(ts[0] / ts[1], 1)}` }));
              }) : h('tr', null, h('td', { colspan: '5', class: 'empty', text: 'Запусти перегони — тут з’являться результати.' }))));
            stage.append(h('div', { class: 'px-lbl', text: 'Результати' }), tbl);
          }
          function go() {
            if (running || api.locked()) return;
            running = true;
            const job = JOBS[s.job];
            const slow = job.mb / (job.kind === 'seq' ? DRIVES[0].seq : DRIVES[0].small);
            const scale = slow / 4.5; // найповільніший фінішує за ~4,5 с реального часу
            const t0 = performance.now();
            live = { t: 0 };
            const tick = now => {
              live.t = (now - t0) / 1000 * scale;
              if (live.t >= slow) { live = null; running = false; s.runs[s.job] = true; render(); api.changed(); return; }
              render();
              raf = requestAnimationFrame(tick);
            };
            render();
            raf = requestAnimationFrame(tick);
          }
          render();
          return { render, destroy() { cancelAnimationFrame(raf); } };
        }
      });
    }
  };

  /* ======================================================= 4. Паспорт пам'яті мого ПК */
  const REF = [
    { name: 'HDD 7200 об/хв', v: 160, c: '#F08C00' }, { name: 'SATA SSD', v: 550, c: '#0FA36B' },
    { name: 'NVMe PCIe 3.0', v: 3500, c: '#0EA5E9' }, { name: 'NVMe PCIe 4.0', v: 7000, c: '#6366F1' }
  ];
  const num = v => { const n = parseFloat(String(v || '').replace(',', '.').replace(/\s/g, '')); return isFinite(n) ? n : null; };
  window.Games['pc-passport'] = {
    readonlyView: true,
    mount(host, ctx) {
      const saved = (ctx.saved && ctx.saved.details) || {};
      const ro = !!ctx.readOnly;
      const wasReturned = returnedNow(ctx, saved);
      let submitted = !!(ctx.saved && ctx.saved.final), busy = false, dead = false;
      const v = Object.assign({ station: '', ramGb: '', ramSpeed: '', ramUnit: 'МТ/с', slotsUsed: '', slotsTotal: '', form: '', ramSrc: 'Диспетчер завдань', diskType: '', diskModel: '', diskGb: '', read: '', write: '', noBench: false, noBenchWhy: '', conclusion: '' }, saved.v || {});
      const ack = wasReturned ? ctx.saved.returnCount : (saved.ack || 0);
      const persist = saver(ctx);
      const locked = () => submitted || ro;
      const draft = debounce(() => { if (!locked() && !dead) persist(0, { v, ack }, false).then(() => { if (!dead) status.textContent = 'Чернетку збережено.'; }).catch(() => { if (!dead) status.textContent = 'Чернетку не збережено. Дані лишилися у формі — продовжуй, спробуємо ще раз.'; }); }, 800);
      const status = h('p', { class: 'px-status', role: 'status' });
      const inputs = [];
      const inp = (key, ph, opts) => {
        const o = opts || {};
        const el = h('input', { type: 'text', class: 'pp-in' + (o.short ? ' short' : ''), placeholder: ph || '', inputmode: o.numeric ? 'decimal' : null, maxlength: o.max || 80, 'aria-label': o.label || ph });
        el.value = v[key] || '';
        el.addEventListener('input', () => { if (locked()) return; v[key] = el.value; refresh(); draft(); });
        inputs.push(el); return el;
      };
      const sel = (key, items, label) => {
        const el = h('select', { class: 'pp-in', 'aria-label': label }, items.map(([val, t]) => { const o = h('option', { value: val, text: t }); if (v[key] === val) o.selected = true; return o; }));
        el.addEventListener('change', () => { if (locked()) return; v[key] = el.value; refresh(); draft(); });
        inputs.push(el); return el;
      };
      const row = (label, ...ctl) => h('label', { class: 'pp-row' }, h('span', { class: 'pp-k', text: label }), h('span', { class: 'pp-v' }, ...ctl));
      const ramOut = h('div', { class: 'pp-calc' });
      const diskOut = h('div', { class: 'pp-calc' });
      const chart = h('div', { class: 'pp-chart' });
      const noBench = h('input', { type: 'checkbox' }); noBench.checked = !!v.noBench;
      noBench.addEventListener('change', () => { if (locked()) return; v.noBench = noBench.checked; refresh(); draft(); });
      inputs.push(noBench);
      const whyRow = row('Чому не виміряно', inp('noBenchWhy', 'Наприклад: програма не встановлена', { max: 200 }));
      const concl = h('textarea', { class: 'pp-in', rows: 3, maxlength: 600, placeholder: 'Наприклад: RAM вистачає для навчання, але для монтажу відео я б додав…', 'aria-label': 'Висновок' });
      concl.value = v.conclusion;
      concl.addEventListener('input', () => { if (locked()) return; v.conclusion = concl.value; draft(); });
      inputs.push(concl);
      const submit = h('button', { class: 'px-btn px-primary', type: 'button' }, 'Завершити паспорт');

      const root = h('div', { class: 'px-game pp' },
        h('div', { class: 'px-head' }, h('div', null, h('div', { class: 'px-kicker', text: 'Дослідження · мій ПК' }), h('h2', { text: 'Паспорт пам’яті мого ПК' })), h('div', { class: 'pp-station' }, row('Робоче місце', inp('station', 'ПК №…', { short: true, label: 'Номер робочого місця' })))),
        wasReturned ? h('div', { class: 'px-banner', text: '↩ Вчитель повернув паспорт. Виправ і надішли ще раз.' }) : null,
        ro && !submitted ? h('div', { class: 'px-banner info', text: '👁 Режим перегляду.' }) : null,
        h('p', { class: 'px-rule', text: 'Записуй значення саме так, як їх показує програма. Автоматичних балів за характеристики ПК немає — паспорт сам перерахує одиниці й порівняє швидкість. Якщо показника немає, так і напиши.' }),
        h('div', { class: 'pp-grid' },
          h('section', { class: 'pp-card ram' },
            h('h3', null, h('span', { class: 'pp-ico', text: '▤' }), 'Оперативна пам’ять'),
            h('p', { class: 'pp-how', html: '<b>Ctrl + Shift + Esc</b> → «Продуктивність» → «Пам’ять»' }),
            row('Обсяг', inp('ramGb', '16', { short: true, numeric: true, label: 'Обсяг RAM у ГБ' }), h('span', { class: 'u', text: 'ГБ' })),
            row('Швидкість', inp('ramSpeed', '3200', { short: true, numeric: true, label: 'Швидкість RAM' }), sel('ramUnit', [['МТ/с', 'МТ/с'], ['МГц', 'МГц']], 'Одиниця швидкості')),
            row('Використано гнізд', inp('slotsUsed', '2', { short: true, numeric: true, label: 'Використано гнізд' }), h('span', { class: 'u', text: 'з' }), inp('slotsTotal', '4', { short: true, numeric: true, label: 'Усього гнізд' })),
            row('Форм-фактор', sel('form', [['', '— обери —'], ['DIMM', 'DIMM'], ['SO-DIMM', 'SO-DIMM'], ['Немає даних', 'Немає даних']], 'Форм-фактор')),
            row('Джерело', sel('ramSrc', [['Диспетчер завдань', 'Диспетчер завдань'], ['CPU-Z', 'CPU-Z'], ['Інше', 'Інше']], 'Джерело даних RAM')),
            ramOut),
          h('section', { class: 'pp-card ssd' },
            h('h3', null, h('span', { class: 'pp-ico', text: '◫' }), 'Накопичувач (диск C:)'),
            h('p', { class: 'pp-how', html: 'Диспетчер завдань → «Диск 0». Швидкість — <b>CrystalDiskMark</b>, рядок <b>SEQ1M Q8T1</b>' }),
            row('Тип', sel('diskType', [['', '— обери —'], ['SSD', 'SSD'], ['HDD', 'HDD'], ['Немає даних', 'Немає даних']], 'Тип накопичувача')),
            row('Модель', inp('diskModel', 'Як у Диспетчері завдань', { max: 120, label: 'Модель накопичувача' })),
            row('Обсяг у Windows', inp('diskGb', '477', { short: true, numeric: true, label: 'Обсяг диска у Windows, ГБ' }), h('span', { class: 'u', text: 'ГБ' })),
            row('Читання', inp('read', '—', { short: true, numeric: true, label: 'Швидкість читання, МБ/с' }), h('span', { class: 'u', text: 'МБ/с' })),
            row('Запис', inp('write', '—', { short: true, numeric: true, label: 'Швидкість запису, МБ/с' }), h('span', { class: 'u', text: 'МБ/с' })),
            h('label', { class: 'pp-check' }, noBench, h('span', { text: 'Швидкість не вимірювали' })), whyRow,
            diskOut, chart)),
        h('section', { class: 'pp-card wide' }, h('h3', { text: 'Висновок' }), h('label', { class: 'pp-q', text: 'Що б ти покращив(-ла) у пам’яті цього ПК і для якого завдання? Чому?' }), concl),
        h('div', { class: 'px-foot' }, status, submit));
      host.appendChild(root);

      function refresh() {
        const sp = num(v.ramSpeed), gb = num(v.ramGb);
        ramOut.innerHTML = '';
        if (sp) {
          const b1 = sp * 8 / 1000, b2 = b1 * 2;
          ramOut.append(h('div', { class: 'pp-calc-h', text: 'Розрахунок (64 біти = 8 байтів на канал)' }),
            h('div', { class: 'pp-bw' }, h('span', null, h('small', { text: '1 канал' }), h('b', { text: fmt(b1) + ' ГБ/с' })), h('span', null, h('small', { text: '2 канали' }), h('b', { text: fmt(b2) + ' ГБ/с' }))),
            h('p', { class: 'pp-note', text: (num(v.slotsUsed) >= 2 ? 'Зайнято 2+ гнізда — можливий двоканальний режим, але його треба підтвердити (CPU-Z або UEFI).' : num(v.slotsUsed) === 1 ? 'Один модуль — працює один канал.' : 'Укажи кількість зайнятих гнізд.') + (v.ramUnit === 'МГц' ? ' Windows підписує МГц, але число відповідає МТ/с.' : '') }));
        } else ramOut.append(h('p', { class: 'pp-note', text: 'Введи швидкість — тут з’явиться теоретична пропускна здатність.' }));
        if (gb) ramOut.append(h('p', { class: 'pp-note', text: gb < 8 ? 'Менше 8 ГБ: при багатьох вкладках можливе використання файлу підкачки.' : gb <= 16 ? '8–16 ГБ: достатньо для навчання й офісних задач.' : 'Понад 16 ГБ: вистачить і для монтажу та ігор.' }));
        const dg = num(v.diskGb);
        diskOut.innerHTML = '';
        if (dg) diskOut.append(h('div', { class: 'pp-gib' }, h('span', null, h('small', { text: 'Windows показує' }), h('b', { text: fmt(dg) + ' «ГБ»' })), h('i', { text: '× 1,0737 =' }), h('span', null, h('small', { text: 'на коробці (10⁹ байтів)' }), h('b', { text: '≈ ' + fmt(dg * 1.073741824, 0) + ' GB' }))));
        const r = num(v.read);
        chart.innerHTML = '';
        whyRow.hidden = !v.noBench;
        const max = 7000;
        const bars = REF.map(x => ({ ...x })).concat(r && !v.noBench ? [{ name: 'Мій диск', v: r, c: '#E11D48', mine: true }] : []).sort((a, b) => a.v - b.v);
        chart.append(h('div', { class: 'pp-calc-h', text: 'Швидкість читання: порівняння' }));
        bars.forEach(b => chart.append(h('div', { class: 'pp-bar' + (b.mine ? ' mine' : '') }, h('span', { class: 'n', text: b.name }), h('span', { class: 't' }, h('i', { style: `width:${Math.max(2, Math.min(100, b.v / max * 100))}%;background:${b.c}` })), h('span', { class: 'v', text: fmt(b.v, 0) + ' МБ/с' }))));
        if (r && !v.noBench) chart.append(h('p', { class: 'pp-verdict', text: r < 250 ? 'Схоже на HDD.' : r <= 620 ? 'Схоже на SATA SSD (межа інтерфейсу SATA ≈ 600 МБ/с).' : r <= 4000 ? 'Схоже на NVMe SSD (PCIe 3.0).' : 'Схоже на NVMe SSD (PCIe 4.0 або новіший).' }));
        inputs.forEach(i => { i.disabled = locked() || busy; });
        submit.hidden = locked();
        submit.disabled = busy;
        if (submitted) status.textContent = 'Паспорт заповнено.';
      }
      submit.onclick = async () => {
        if (locked() || busy) return;
        const missing = [];
        if (!v.station.trim()) missing.push('робоче місце');
        if (!num(v.ramGb)) missing.push('обсяг RAM');
        if (!num(v.ramSpeed)) missing.push('швидкість RAM');
        if (!v.diskType) missing.push('тип накопичувача');
        if (!num(v.diskGb)) missing.push('обсяг диска');
        if (!v.noBench && !(num(v.read) && num(v.write))) missing.push('швидкість читання й запису (або познач «не вимірювали»)');
        if (v.noBench && v.noBenchWhy.trim().length < 5) missing.push('причину, чому не виміряно');
        if (v.conclusion.trim().length < 15) missing.push('висновок (1–2 речення)');
        if (missing.length) { status.textContent = 'Заповни: ' + missing.join(', ') + '.'; return; }
        busy = true; draft.cancel(); refresh(); status.textContent = 'Підбиваю підсумок…';
        try { await persist(0, { v, ack, submitted: true }, true); if (!dead) submitted = true; }
        catch (e) { if (!dead) status.textContent = 'Не вдалося завершити. Дані лишилися у формі — спробуй ще раз.'; }
        finally { busy = false; if (!dead) refresh(); }
      };
      refresh();
      if (wasReturned && !ro) persist(0, { v, ack }, false).catch(() => {});
      return () => { dead = true; if (draft.pending()) { draft.cancel(); if (!locked()) persist(0, { v, ack }, false).catch(() => {}); } };
    }
  };
})();
