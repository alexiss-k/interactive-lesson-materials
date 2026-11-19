/* Урок «Текстовий документ» (9 клас): Яка програма впорається? · Чия це властивість? · Який формат обрати? · Лабораторія форматів · Обери режим */
(function () {
  'use strict';
  const { h, confirmBox } = window.App;
  window.Games = window.Games || {};
  const { itemQuiz, debounce } = window.GameKit;
  const o = (...labels) => labels.map(([label, icon], i) => ({ id: 'o' + i, label, icon }));
  const fxTag = e => `<span class="tx-fx ${e.toLowerCase()}">${e}</span>`;

  /* ================= Яка програма впорається? ================= */
  const TOOL_OPTS = o(['Текстовий редактор', '📝'], ['Текстовий процесор', '📄'], ['Наукові документи', '🧮'], ['Видавнича система', '📰'],
    ['Машинний переклад', '🌍'], ['Розпізнавання тексту (OCR)', '📷'], ['Розпізнавання мовлення', '🎙']);
  const TOOLS = [
    { id: 'ref', icon: '📚', short: 'Реферат', q: 'Написати реферат з історії: заголовки, абзаци, таблиця з датами й кілька фото.', answer: 'o1',
      why: 'Форматування, малюнки, таблиці — робота для текстового процесора: Word, LibreOffice Writer, Google Docs.' },
    { id: 'ini', icon: '🎮', short: 'Файл налаштувань', q: 'Змінити файл налаштувань гри <b>settings.ini</b>: це простий текст без жодного оформлення.', answer: 'o0',
      why: 'Для простого тексту без оформлення досить текстового редактора, наприклад Блокнота.' },
    { id: 'lens', icon: '📸', short: 'Текст із фото', q: 'Сфотографувати конспект однокласника й скопіювати з фото текст, щоб його редагувати.', answer: 'o5',
      why: 'Google Lens та інші OCR-системи перетворюють зображення тексту на текст.' },
    { id: 'lect', icon: '🎧', short: 'Аудіо → текст', q: 'Перетворити запис онлайн-лекції на текст, щоб швидко знайти потрібне місце.', answer: 'o6',
      why: 'Транскрибування (голос → текст) виконують системи розпізнавання мовлення. Так працюють і автоматичні субтитри.' },
    { id: 'trans', icon: '🇬🇧', short: 'Стаття англійською', q: 'Прочитати українською англомовну статтю про нову відеокарту.', answer: 'o4',
      why: 'DeepL або Google Translate — системи машинного перекладу.' },
    { id: 'mag', icon: '📰', short: 'Шкільний журнал', q: 'Зверстати шкільний журнал на 24 сторінки й підготувати його для друкарні.', answer: 'o3',
      why: 'Макети журналів, книжок і афіш роблять у видавничих системах: InDesign, Scribus. Для простих макетів підійде Canva.' },
    { id: 'math', icon: '➗', short: 'Формули', q: 'Оформити розв\'язання олімпіадної задачі з дробами, коренями й системами рівнянь.', answer: 'o2',
      why: 'Складні формули зручно набирати в редакторах наукових документів: LaTeX, Overleaf.' },
    { id: 'code', icon: '🐍', short: 'Код Python', q: 'Написати програму мовою Python.', answer: 'o0',
      why: 'Код — простий текст без форматування. Його пишуть у текстових редакторах, вбудованих у середовища розробки (VS Code, IDLE).' }
  ];
  window.Games['text-tools'] = {
    mount(host, ctx) {
      itemQuiz(host, ctx, { key: 'tools', items: TOOLS, options: TOOL_OPTS,
        intro: 'Для кожної задачі обери, яка <b>система опрацювання текстів</b> підходить найкраще. Відповіді перевіряться після завершення.' });
    }
  };

  /* ================= Чия це властивість? ================= */
  const OBJ_OPTS = o(['Символ', '🔤'], ['Абзац', '¶'], ['Сторінка', '📄'], ['Малюнок', '🖼'], ['Таблиця', '▦']);
  const PROPS = [
    { id: 'font', icon: '🔠', q: 'Шрифт <b>Times New Roman</b>', answer: 'o0', why: 'Шрифт задають для символів (у Word: Основне → Шрифт).' },
    { id: 'size', icon: '🔍', q: 'Розмір <b>14 пт</b>', answer: 'o0', why: 'Розмір шрифту — властивість символу.' },
    { id: 'italic', icon: '✍️', q: 'Накреслення <b><i>курсив</i></b>', answer: 'o0', why: 'Жирний, курсив, підкреслений — це накреслення символу.' },
    { id: 'sub', icon: '🧪', q: 'Видозміна <b>підрядковий</b>: H<sub>2</sub>O', answer: 'o0', why: 'Надрядковий і підрядковий знаки — видозміна символу.' },
    { id: 'just', icon: '↔️', q: 'Вирівнювання <b>по ширині</b>', answer: 'o1', why: 'Вирівнювання задають для абзацу (Основне → Абзац).' },
    { id: 'indent', icon: '⇥', q: 'Відступ першого рядка <b>1,25 см</b>', answer: 'o1', why: 'Відступ першого рядка — властивість абзацу.' },
    { id: 'spacing', icon: '↕️', q: 'Міжрядковий інтервал <b>1,5</b>', answer: 'o1', why: 'Міжрядковий інтервал задають для абзацу.' },
    { id: 'orient', icon: '🔄', q: 'Орієнтація <b>альбомна</b>', answer: 'o2', why: 'Орієнтація — властивість сторінки (Макет → Орієнтація).' },
    { id: 'margins', icon: '📏', q: 'Поля: ліве <b>3 см</b>, праве <b>1 см</b>', answer: 'o2', why: 'Поля — властивість сторінки.' },
    { id: 'header', icon: '🔝', q: '<b>Колонтитул</b> «Шкільна газета · Випуск №3» і номер сторінки', answer: 'o2', why: 'Колонтитули й нумерація належать сторінці.' },
    { id: 'wrap', icon: '🌊', q: 'Обтікання текстом <b>«Навколо рамки»</b>', answer: 'o3', why: 'Обтікання визначає, як текст розміщується навколо малюнка.' },
    { id: 'cols', icon: '🔢', q: '<b>4 стовпці</b> і <b>6 рядків</b>, заливка клітинок', answer: 'o4', why: 'Кількість рядків і стовпців, заливка клітинок — властивості таблиці.' }
  ];
  window.Games['text-props'] = {
    mount(host, ctx) {
      itemQuiz(host, ctx, { key: 'props', items: PROPS, options: OBJ_OPTS,
        intro: 'Визнач, якому <b>об\'єкту документа</b> належить кожна властивість. 💡 Не впевнений? Подумай, що треба виділити, щоб її змінити.' });
    }
  };

  /* ================= Який формат обрати? ================= */
  const FMT_OPTS = o(['TXT'], ['DOCX'], ['ODT'], ['RTF'], ['PDF'], ['MD']);
  const FORMATS = [
    { id: 'edit', icon: '👩‍🏫', short: 'Реферат на перевірку', q: 'Учитель просить надіслати реферат так, щоб він міг <b>дописати коментарі у Word</b>.', answer: 'o1',
      why: 'DOCX — стандартний формат Word: його можна редагувати й рецензувати.' },
    { id: 'cv', icon: '💼', short: 'Резюме', q: 'Надіслати <b>резюме</b> для участі в проєкті, щоб на будь-якому пристрої воно виглядало однаково й нічого не «з\'їхало».', answer: 'o4',
      why: 'PDF зберігає вигляд документа незалежно від пристрою, ОС і програми.' },
    { id: 'print', icon: '🖨', short: 'Макет для друкарні', q: 'Друкарня просить макет <b>афіші шкільного концерту</b>.', answer: 'o4',
      why: 'Друкарні приймають PDF: шрифти й малюнки вже «вшиті» у файл.' },
    { id: 'lo', icon: '🐧', short: 'Друг із LibreOffice', q: 'Однокласник працює в <b>LibreOffice Writer</b> на Linux. У якому стандартному для нього форматі зберегти спільний звіт?', answer: 'o2',
      why: 'ODT (OpenDocument Text) — стандартний формат LibreOffice Writer. Word теж уміє його відкривати.' },
    { id: 'note', icon: '🗒', short: 'Проста нотатка', q: 'Записати список слів для диктанту. Форматування не потрібне, а файл має відкриватися <b>будь-якою програмою на будь-якій ОС</b>.', answer: 'o0',
      why: 'TXT — лише текст. Його відкриє навіть найпростіший редактор на будь-якому пристрої.' },
    { id: 'readme', icon: '🐙', short: 'Опис проєкту на GitHub', q: 'Написати опис свого проєкту для GitHub із заголовками й списками, позначеними символами <b>#</b> і <b>-</b>.', answer: 'o5',
      why: 'README.md — це Markdown: простий текст з розміткою, який GitHub показує гарно оформленим.' },
    { id: 'old', icon: '🦕', short: 'Стара програма', q: 'Документ із жирним текстом треба відкрити на дуже старому комп\'ютері з невідомою програмою, яка не знає DOCX і ODT.', answer: 'o3',
      why: 'RTF — старий кросплатформний формат з форматуванням, його розуміють майже всі текстові процесори.' },
    { id: 'cert', icon: '📜', short: 'Довідка зі школи', q: 'Школа надсилає <b>довідку</b> з печаткою, яку не мають змінювати.', answer: 'o4',
      why: 'PDF не призначений для редагування: документ виглядає точно як задумано.' }
  ];
  window.Games['text-format'] = {
    mount(host, ctx) {
      itemQuiz(host, ctx, { key: 'formats', items: FORMATS, options: FMT_OPTS,
        intro: 'Прочитай ситуацію й обери <b>найкращий формат файлу</b>.<div class="tx-legend">' +
          [['TXT', 'лише текст'], ['DOCX', 'Word'], ['ODT', 'LibreOffice'], ['RTF', 'старий універсальний'], ['PDF', 'однаково всюди'], ['MD', 'Markdown']].map(([e, t]) => `<span>${fxTag(e)} ${t}</span>`).join('') + '</div>' });
    }
  };

  /* ================= Лабораторія форматів ================= */
  const num = v => { const x = parseFloat(String(v == null ? '' : v).replace(',', '.').replace(/[^\d.]/g, '')); return isFinite(x) ? x : NaN; };
  const EXTS = ['DOCX', 'TXT', 'RTF', 'PDF', 'ODT'];
  const sizeOk = x => !isNaN(x) && x > 0 && x < 100000;
  const sizes = v => EXTS.map(e => [e, num(v['s' + e])]).filter(([, x]) => sizeOk(x));
  const pick = (v, cmp) => { const s = sizes(v); return s.length === EXTS.length ? s.reduce((a, b) => (cmp(b[1], a[1]) ? b : a))[0] : null; };
  const LAB = [
    ...EXTS.map(e => ({ id: 's' + e, label: `Розмір файлу ${e}, КБ`, ph: 'Наприклад: 64', type: 'num', ext: e,
      check: v => sizeOk(num(v['s' + e])) && (e !== 'TXT' || num(v.sTXT) < num(v.sDOCX)),
      bad: e === 'TXT' ? 'Впиши розмір у КБ. TXT без малюнка має бути меншим за DOCX: перевір, чи правильний файл ти дивишся.' : 'Впиши розмір файлу в КБ (число з колонки «Розмір» у Провіднику).' })),
    { id: 'min', label: 'Який файл виявився найменшим?', type: 'choice', options: EXTS,
      check: v => !!v.min && v.min === pick(v, (a, b) => a < b), bad: v => pick(v, (a, b) => a < b) ? `За твоїми числами найменший — ${pick(v, (a, b) => a < b)}.` : 'Спершу впиши всі п\'ять розмірів.' },
    { id: 'max', label: 'Який файл виявився найбільшим?', type: 'choice', options: EXTS,
      check: v => !!v.max && v.max === pick(v, (a, b) => a > b), bad: v => pick(v, (a, b) => a > b) ? `За твоїми числами найбільший — ${pick(v, (a, b) => a > b)}.` : 'Спершу впиши всі п\'ять розмірів.' },
    { id: 'lost', label: 'Відкрий TXT у Блокноті. Що зникло?', type: 'choice', options: ['Діаграма, таблиця й усе оформлення', 'Лише діаграма', 'Нічого не зникло', 'Зник увесь текст'],
      check: v => v.lost === 'Діаграма, таблиця й усе оформлення', bad: 'TXT зберігає лише символи й абзаци: зникає і діаграма, і таблиця (залишається лише її текст), і оформлення.' },
    { id: 'send', label: 'Який із цих файлів ти надішлеш, щоб на телефоні вчителя він виглядав точно як у тебе?', type: 'choice', options: EXTS,
      check: v => v.send === 'PDF', bad: 'PDF виглядає однаково на будь-якому пристрої.' }
  ];
  window.Games['text-lab'] = {
    readonlyView: true,
    mount(host, ctx) {
      const d0 = (ctx.saved && ctx.saved.details) || {};
      const v = Object.assign({}, d0.v || {});
      let submitted = !!(ctx.saved && ctx.saved.final);
      const grid = h('div', { class: 'pp-grid' });
      const submitBtn = h('button', { class: 'btn primary big' }, 'Завершити завдання');
      const left = h('span', { class: 'muted' });
      const result = h('div', { class: 'g-result' });
      const save = debounce(() => { if (!submitted) ctx.complete(0, { v }).catch(() => {}); }, 1000);
      host.append(
        h('div', { class: 'cpu-intro', html: '🧪 Практична робота. Працюй у <b>Word</b> або <b>LibreOffice Writer</b>.' }),
        h('ol', { class: 'tx-steps' },
          h('li', null, 'Завантаж зразок: ', h('a', { class: 'btn small', href: ctx.asset('files/zrazok-gazeta.docx'), download: 'газета.docx' }, '⬇ газета.docx'), ' і збережи у своїй папці.'),
          h('li', { html: 'Відкрий його та збережи ще в чотирьох форматах: <b>Файл → Зберегти як → Тип файлу</b> (<span class="kbd">F12</span>): <b>TXT</b>, <b>RTF</b>, <b>PDF</b>, <b>ODT</b>. Для TXT обери кодування <b>Юнікод (UTF-8)</b>.' }),
          h('li', { html: 'Відкрий папку в Провіднику, увімкни <b>Подання → Відомості</b> і перепиши розміри файлів.' })),
        h('div', { class: 'pp-card' }, h('div', { class: 'pp-head' }, h('span', { text: '🧪' }), h('b', { text: 'Лабораторія форматів' })), grid),
        h('div', { class: 'row', style: 'margin-top:14px' }, submitBtn, left), result);
      const rows = LAB.map(f => {
        let input;
        if (f.type === 'choice') {
          input = h('div', { class: 'cq-opts' }, f.options.map(op => h('button', { type: 'button', class: 'cq-opt' + (v[f.id] === op ? ' on' : ''), disabled: submitted,
            onclick: e => { v[f.id] = op; e.currentTarget.parentNode.querySelectorAll('.cq-opt').forEach(b => b.classList.toggle('on', b.textContent === op)); upd(); save(); } }, op)));
        } else {
          input = h('input', { class: 'inp', value: v[f.id] || '', placeholder: f.ph, maxlength: 20, inputmode: 'decimal', disabled: submitted });
          input.addEventListener('input', () => { v[f.id] = input.value; upd(); save(); });
        }
        const fb = h('div', { class: 'pp-fb' });
        const row = h('div', { class: 'pp-row' + (f.type === 'choice' ? ' tx-wide' : '') }, h('label', { class: 'pp-lbl', html: f.ext ? `${fxTag(f.ext)} ${f.label}` : f.label }), input, fb);
        grid.appendChild(row);
        return { f, row, fb, input };
      });
      const filled = f => String(v[f.id] == null ? '' : v[f.id]).trim() !== '';
      function upd() { left.textContent = submitted ? '' : `Заповнено: ${LAB.filter(filled).length} з ${LAB.length}`; }
      const review = () => LAB.map(f => ({ right: !!f.check(v), text: `${f.ext ? f.ext + ', КБ' : f.label}: ${filled(f) ? v[f.id] : '—'}` }));
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
        result.append(h('b', { text: `Зараховано: ${ok} з ${rows.length} (${score}%)` }),
          h('div', { text: 'Висновок: TXT найменший, бо в ньому лише текст; DOCX і ODT стиснуті; RTF із малюнком — найбільший. Надсилати, щоб виглядало однаково, — PDF.' }));
        return score;
      }
      submitBtn.addEventListener('click', async () => {
        const miss = LAB.filter(f => !filled(f)).length;
        const go = await confirmBox({
          title: 'Завершити роботу?',
          html: (miss ? `<p>Не заповнено полів: <b>${miss}</b> — вони не будуть зараховані.</p>` : '') + '<p>Після завершення змінити відповіді вже не можна.</p>',
          ok: 'Так, завершити', cancel: 'Перевірю ще раз', danger: !!miss
        });
        if (!go) return;
        submitted = true;
        upd();
        const score = reveal();
        try { await ctx.finish(score, { v, review: review() }); } catch (e) {}
      });
      upd();
      if (submitted) reveal();
    }
  };

  /* ================= Обери режим ================= */
  const VIEW_OPTS = o(['Макет друку', '📄'], ['Режим читання', '📖'], ['Вебмакет', '🌐'], ['Структура', '🗂'], ['Чернетка', '✏️'], ['Розділити вікно', '⬒'], ['Переглянути поруч', '🪟']);
  const VIEWS = [
    { id: 'print', icon: '🖨', short: 'Перед друком', q: 'Перед друком перевірити, як реферат виглядатиме на аркуші: поля, колонтитули, де закінчується сторінка.', answer: 'o0',
      why: 'Макет друку показує документ саме так, як він буде надрукований.' },
    { id: 'read', icon: '🛋', short: 'Читати з планшета', q: 'Спокійно прочитати довгу статтю з екрана, без стрічки й панелей інструментів.', answer: 'o1',
      why: 'У режимі читання панелі сховано, а текст підлаштовано під екран.' },
    { id: 'outline', icon: '🧩', short: 'Переставити розділи', q: 'Поміняти місцями розділи 2 і 3 у 15-сторінковому рефераті, бачачи лише заголовки.', answer: 'o3',
      why: 'Режим «Структура» показує ієрархію заголовків і дає змогу перетягувати розділи.' },
    { id: 'draft', icon: '⚡', short: 'Швидко набрати текст', q: 'Швидко набрати текст диктанту, не відволікаючись на поля й розриви сторінок.', answer: 'o4',
      why: 'Чернетка показує текст у спрощеному вигляді, без оформлення сторінки.' },
    { id: 'web', icon: '🌍', short: 'Як сайт', q: 'Подивитися, як документ виглядатиме, якщо розмістити його як вебсторінку: без поділу на сторінки.', answer: 'o2',
      why: 'Вебмакет подає документ як вебсторінку.' },
    { id: 'split', icon: '📝', short: 'Вступ і висновок', q: 'Пишеш висновок у кінці реферату й хочеш бачити вступ на першій сторінці <b>того самого</b> документа.', answer: 'o5',
      why: 'Подання → Вікно → Розділити: дві частини одного документа зі своїми смугами прокручування.' },
    { id: 'side', icon: '🔍', short: 'Дві версії твору', q: 'Знайти відмінності між <b>двома файлами</b>: чернеткою й остаточною версією твору.', answer: 'o6',
      why: 'Переглянути поруч із синхронним прокручуванням: обидва документи прокручуються разом.' }
  ];
  window.Games['text-view'] = {
    mount(host, ctx) {
      itemQuiz(host, ctx, { key: 'views', items: VIEWS, options: VIEW_OPTS,
        intro: 'Для кожної ситуації обери найзручніший <b>режим перегляду</b> або спосіб роботи з вікнами.' });
    }
  };
})();
