/* docx-check — the student picks the .docx they are building in Microsoft Word; the browser unpacks it
   (ZIP + Office Open XML), checks the features from the slides and shows ✓/✗ with "where to click" hints.
   The file itself is NOT uploaded or stored: only the check results and file facts go into details.
   Also registers `docx-starter` (download the starter document, ungraded).
   Requires lesson-kit.js. Task data: { set: 'headers'|'layout'|'lists'|'math', brief: '<trusted author HTML>' } */
(() => {
  'use strict';
  const K = window.LessonKit;

  /* ======================= ZIP reader (stored + deflate) ======================= */
  const u16 = (b, o) => b[o] | (b[o + 1] << 8);
  const u32 = (b, o) => (b[o] | (b[o + 1] << 8) | (b[o + 2] << 16) | (b[o + 3] << 24)) >>> 0;
  async function inflateRaw(bytes) {
    if (typeof DecompressionStream !== 'function') { const e = new Error('no-inflate'); e.code = 'no-inflate'; throw e; }
    const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
    return new Uint8Array(await new Response(stream).arrayBuffer());
  }
  async function readZip(buffer) {
    const b = new Uint8Array(buffer);
    const bad = () => { const e = new Error('not-zip'); e.code = 'not-zip'; return e; };
    if (b.length < 22 || u32(b, 0) !== 0x04034b50) throw bad();
    let eocd = -1;
    for (let i = b.length - 22; i >= Math.max(0, b.length - 65557); i--) if (u32(b, i) === 0x06054b50) { eocd = i; break; }
    if (eocd < 0) throw bad();
    const count = u16(b, eocd + 10);
    let p = u32(b, eocd + 16);
    const dec = new TextDecoder('utf-8');
    const entries = new Map();
    for (let n = 0; n < count; n++) {
      if (p + 46 > b.length || u32(b, p) !== 0x02014b50) throw bad();
      const method = u16(b, p + 10), csize = u32(b, p + 20), nlen = u16(b, p + 28), elen = u16(b, p + 30), clen = u16(b, p + 32), off = u32(b, p + 42);
      const name = dec.decode(b.subarray(p + 46, p + 46 + nlen));
      entries.set(name, { method, csize, off });
      p += 46 + nlen + elen + clen;
    }
    async function read(name) {
      const e = entries.get(name);
      if (!e) return null;
      if (u32(b, e.off) !== 0x04034b50) throw bad();
      const start = e.off + 30 + u16(b, e.off + 26) + u16(b, e.off + 28);
      const raw = b.subarray(start, start + e.csize);
      const data = e.method === 0 ? raw : e.method === 8 ? await inflateRaw(raw) : null;
      if (!data) throw bad();
      return dec.decode(data);
    }
    return { names: [...entries.keys()], read };
  }

  /* ======================= OOXML facts ======================= */
  const xml = s => new DOMParser().parseFromString(s, 'application/xml');
  const all = (root, name) => root ? Array.from(root.getElementsByTagNameNS('*', name)) : [];
  const kid = (el, name) => el ? Array.from(el.children).find(c => c.localName === name) || null : null;
  const attr = (el, name) => { if (!el) return null; for (const a of Array.from(el.attributes)) if (a.localName === name) return a.value; return null; };
  const onOff = el => !!el && !/^(0|false|off)$/i.test(attr(el, 'val') || '1');
  const LETTERS = /[A-Za-zА-Яа-яІіЇїЄєҐґ’']{3,}/;
  const DATE_RE = /\b\d{1,2}[.\/-]\d{1,2}[.\/-]\d{2,4}\b|\b\d{4}-\d{2}-\d{2}\b|\d{1,2}\s+(січня|лютого|березня|квітня|травня|червня|липня|серпня|вересня|жовтня|листопада|грудня)/i;
  const SPECIAL = '©®™€£°±≤≥≠≈∞αβγδελμπωΩΔΣ∑√∆→←↑↓↔⇒§¶½¼¾×÷‰•☺☼♥♦♣♠✓✔';

  /* Text of a part: w:t (and m:t unless skipMath); skips Word placeholder text ("[Назва документа]") and deleted text. */
  function textOf(root, skipMath) {
    let out = '';
    (function walk(el) {
      for (const c of Array.from(el.children)) {
        const n = c.localName;
        if (n === 'sdt' && all(kid(c, 'sdtPr'), 'showingPlcHdr').length) continue;
        if (skipMath && (n === 'oMath' || n === 'oMathPara')) continue;
        if (n === 'del' || n === 'instrText' || n === 'delText') continue;
        if (n === 't') { out += c.textContent; continue; }
        if (n === 'tab' || n === 'br') out += ' ';
        if (n === 'p') { walk(c); out += '\n'; continue; }
        walk(c);
      }
    })(root.documentElement || root);
    return out;
  }
  const hasPlaceholder = root => all(root, 'showingPlcHdr').length > 0;
  const fieldCodes = root => [...all(root, 'fldSimple').map(f => attr(f, 'instr') || ''), all(root, 'instrText').map(t => t.textContent).join(' ')].join(' | ');

  async function analyze(zip) {
    const docXml = await zip.read('word/document.xml');
    if (!docXml) { const e = new Error('not-docx'); e.code = 'not-docx'; throw e; }
    const doc = xml(docXml);
    if (doc.getElementsByTagName('parsererror').length) { const e = new Error('bad-xml'); e.code = 'not-docx'; throw e; }
    const body = all(doc, 'body')[0];

    // relationships rId → part path
    const rels = {};
    const relXml = await zip.read('word/_rels/document.xml.rels');
    if (relXml) for (const r of all(xml(relXml), 'Relationship')) {
      let t = attr(r, 'Target') || '';
      t = t.replace(/^\/?word\//, '').replace(/^\//, '');
      rels[attr(r, 'Id')] = 'word/' + t;
    }
    // header/footer parts
    const parts = {};
    for (const name of zip.names.filter(n => /^word\/(header|footer)\d*\.xml$/.test(n))) {
      const x = xml(await zip.read(name));
      const text = textOf(x, false);
      const codes = fieldCodes(x);
      parts[name] = {
        kind: name.includes('header') ? 'header' : 'footer',
        text: text.replace(/\s+/g, ' ').trim(),
        letters: LETTERS.test(text),
        placeholder: hasPlaceholder(x),
        page: /\bPAGE\b/.test(codes),
        date: /\b(DATE|TIME|CREATEDATE|SAVEDATE|PRINTDATE)\b/.test(codes) || DATE_RE.test(text)
      };
    }
    // sections in document order
    const sects = all(body, 'sectPr').filter(s => s.parentNode && (s.parentNode.localName === 'body' || (s.parentNode.localName === 'pPr' && s.parentNode.parentNode && s.parentNode.parentNode.localName === 'p')));
    const sections = sects.map(s => {
      const pg = kid(s, 'pgSz'), cols = kid(s, 'cols'), type = kid(s, 'type');
      const w = Number(attr(pg, 'w') || 0), h = Number(attr(pg, 'h') || 0);
      const refs = kind => {
        const o = {};
        for (const r of Array.from(s.children).filter(c => c.localName === kind + 'Reference')) o[attr(r, 'type') || 'default'] = rels[attr(r, 'id')] || null;
        return o;
      };
      return {
        type: (type && attr(type, 'val')) || 'nextPage',
        landscape: attr(pg, 'orient') === 'landscape' || (w > 0 && h > 0 && w > h),
        cols: Number(attr(cols, 'num') || (cols ? all(cols, 'col').length : 0) || 1),
        sep: !!cols && /^(1|true|on)$/i.test(attr(cols, 'sep') || ''),
        titlePg: onOff(kid(s, 'titlePg')),
        header: refs('header'), footer: refs('footer')
      };
    });
    if (!sections.length) sections.push({ type: 'nextPage', landscape: false, cols: 1, sep: false, titlePg: false, header: {}, footer: {} });
    // effective default header text per section (unlinked parts are inherited from the previous section)
    let inherited = null;
    for (const s of sections) {
      if (s.header.default !== undefined) inherited = s.header.default;
      s.ownHeader = s.header.default !== undefined;
      s.headerPart = inherited;
      s.headerText = inherited && parts[inherited] ? parts[inherited].text : '';
    }

    // numbering: styles with numbering, num → abstractNum, lvlText
    const styleNum = {};
    const stylesXml = await zip.read('word/styles.xml');
    if (stylesXml) for (const st of all(xml(stylesXml), 'style')) {
      const np = all(kid(st, 'pPr'), 'numPr')[0];
      if (np) styleNum[attr(st, 'styleId')] = { numId: attr(all(np, 'numId')[0], 'val'), ilvl: Number(attr(all(np, 'ilvl')[0], 'val') || 0) };
    }
    const abstract = {}, nums = {};
    const numXml = await zip.read('word/numbering.xml');
    if (numXml) {
      const nx = xml(numXml);
      for (const a of all(nx, 'abstractNum')) {
        const lv = {};
        for (const l of all(a, 'lvl')) lv[attr(l, 'ilvl')] = { text: attr(kid(l, 'lvlText'), 'val') || '', fmt: attr(kid(l, 'numFmt'), 'val') || '' };
        abstract[attr(a, 'abstractNumId')] = { type: attr(kid(a, 'multiLevelType'), 'val') || '', lvls: lv, link: attr(kid(a, 'numStyleLink'), 'val') };
      }
      for (const n of all(nx, 'num')) {
        const a = abstract[attr(kid(n, 'abstractNumId'), 'val')] || { type: '', lvls: {} };
        const lv = Object.assign({}, a.lvls);
        for (const o of all(n, 'lvlOverride')) { const l = kid(o, 'lvl'); if (l) lv[attr(o, 'ilvl')] = { text: attr(kid(l, 'lvlText'), 'val') || '', fmt: attr(kid(l, 'numFmt'), 'val') || '' }; }
        nums[attr(n, 'numId')] = { type: a.type, lvls: lv, link: a.link };
      }
      // list styles: an abstractNum with numStyleLink takes its levels from the style's own num
      for (const n of Object.values(nums)) {
        const target = n.link && styleNum[n.link] && nums[styleNum[n.link].numId];
        if (target && !Object.keys(n.lvls).length) { n.lvls = target.lvls; n.type = target.type; }
      }
    }
    const lists = {};
    for (const p of all(body, 'p')) {
      const pPr = kid(p, 'pPr');
      const np = kid(pPr, 'numPr');
      let numId = np ? attr(kid(np, 'numId'), 'val') : null, ilvl = np ? attr(kid(np, 'ilvl'), 'val') : null;
      const style = attr(kid(pPr, 'pStyle'), 'val');
      if (!numId && style && styleNum[style]) { numId = styleNum[style].numId; if (ilvl == null) ilvl = styleNum[style].ilvl; }
      if (!numId || numId === '0') continue;
      const L = lists[numId] || (lists[numId] = { numId, count: 0, levels: new Set() });
      L.count++; L.levels.add(Number(ilvl || 0));
    }
    const listArr = Object.values(lists).map(L => {
      const def = nums[L.numId] || { type: '', lvls: {} };
      const t1 = (def.lvls['1'] || {}).text || '', t2 = (def.lvls['2'] || {}).text || '';
      return { numId: L.numId, count: L.count, levels: [...L.levels].sort(), depth: L.levels.size, multi: def.type === 'multilevel',
        legal: /%1/.test(t1) && /%2/.test(t1), legal3: /%1/.test(t2) && /%2/.test(t2) && /%3/.test(t2), bullet: (def.lvls['0'] || {}).fmt === 'bullet' };
    }).sort((a, b) => (b.depth - a.depth) || (b.count - a.count));

    // symbols, indices, maths (body only)
    const plain = textOf(body, true);
    const specials = new Set([...plain].filter(ch => SPECIAL.includes(ch)));
    const syms = all(body, 'sym').map(s => ({ font: attr(s, 'font') || '', ch: attr(s, 'char') || '' }));
    for (const s of syms) if (!/wingdings|webdings/i.test(s.font)) specials.add(s.font + ':' + s.ch);
    let picto = syms.some(s => /wingdings|webdings/i.test(s.font));
    let sub = false, sup = false;
    for (const r of all(body, 'r')) {
      if (r.namespaceURI && /math/.test(r.namespaceURI)) continue;
      const rPr = kid(r, 'rPr');
      const txt = all(r, 't').map(t => t.textContent).join('');
      const rf = kid(rPr, 'rFonts');
      if (!picto && txt.trim() && /wingdings|webdings/i.test([attr(rf, 'ascii'), attr(rf, 'hAnsi'), attr(rf, 'cs')].join(' '))) picto = true;
      const va = attr(kid(rPr, 'vertAlign'), 'val');
      if (txt.trim() && va === 'subscript') sub = true;
      if (txt.trim() && va === 'superscript') sup = true;
    }
    const maths = all(body, 'oMath').filter(m => !(m.parentNode && m.parentNode.localName === 'oMath')).map(m => ({
      frac: all(m, 'f').length > 0, sup: all(m, 'sSup').length + all(m, 'sSubSup').length > 0, rad: all(m, 'rad').length > 0,
      text: all(m, 't').map(t => t.textContent).join('')
    }));

    // core properties (shown to the teacher)
    const core = {};
    const coreXml = await zip.read('docProps/core.xml');
    if (coreXml) { const c = xml(coreXml); for (const k of ['creator', 'lastModifiedBy', 'modified', 'title']) { const el = all(c, k)[0]; if (el) core[k] = el.textContent.slice(0, 80); } }

    return { parts, sections, lists: listArr, specials: [...specials], picto, sub, sup, maths, core,
      words: (plain.match(/[\p{L}\p{N}’']+/gu) || []).length };
  }

  /* ======================= check sets ======================= */
  const headers = f => Object.values(f.parts).filter(p => p.kind === 'header');
  const footers = f => Object.values(f.parts).filter(p => p.kind === 'footer');
  const defaultHeaderParts = f => [...new Set(f.sections.map(s => s.header.default).filter(Boolean))].map(n => f.parts[n]).filter(Boolean);
  const firstHeaderParts = f => [...new Set(f.sections.map(s => s.header.first).filter(Boolean))].map(n => f.parts[n]).filter(Boolean);
  const r = (ok, hint) => ({ ok: !!ok, hint: ok ? '' : hint });

  const CHECK_SETS = {
    headers: [
      { id: 'h-text', label: 'У верхньому колонтитулі є твій текст (назва вісника)',
        test: f => {
          if (defaultHeaderParts(f).some(p => p.letters)) return r(true);
          if (firstHeaderParts(f).some(p => p.letters)) return r(false, 'Текст є лише на першій сторінці. Перейди на 2-гу сторінку, двічі клацни вгорі й надрукуй текст там.');
          if (headers(f).some(p => p.placeholder)) return r(false, 'У колонтитулі лишився текст-підказка шаблону в [дужках]. Клацни його й надрукуй свій текст.');
          return r(false, 'Вставлення › Колонтитули › Верхній колонтитул › вибери шаблон і надрукуй назву вісника.');
        } },
      { id: 'f-page', label: 'Номер сторінки в нижньому колонтитулі',
        test: f => {
          if (footers(f).some(p => p.page)) return r(true);
          if (headers(f).some(p => p.page)) return r(false, 'Номер сторінки стоїть угорі. Потрібно внизу: Вставлення › Номер сторінки › Внизу сторінки.');
          return r(false, 'Вставлення › Колонтитули › Номер сторінки › Внизу сторінки › шаблон. Цифру вручну не друкуй — вона не змінюватиметься.');
        } },
      { id: 'date', label: 'У колонтитулі є дата',
        test: f => r(Object.values(f.parts).some(p => p.date), 'Двічі клацни нижній колонтитул › вкладка «Колонтитули» › Дата й час › вибери формат › OK.') },
      { id: 'first', label: 'Титульна (перша) сторінка — без колонтитулів',
        test: f => r(f.sections[0] && f.sections[0].titlePg, 'Двічі клацни колонтитул › вкладка «Колонтитули» › група «Параметри» › прапорець «Особливий колонтитул для першої сторінки».') }
    ],
    layout: [
      { id: 'cols', label: 'Стаття розміщена у 2 або 3 стовпцях',
        test: f => {
          if (f.sections.some(s => s.cols >= 2)) return r(true);
          return r(false, 'Виділи абзаци статті (без заголовка) › Макет › Стовпці › Інші стовпці… › 2 або 3 › OK.');
        } },
      { id: 'sep', label: 'Між стовпцями є роздільник (вертикальна лінія)',
        test: f => r(f.sections.some(s => s.cols >= 2 && s.sep), 'Курсор у статті › Макет › Стовпці › Інші стовпці… › прапорець «Роздільник» › OK.') },
      { id: 'next', label: 'Є розрив розділу «Наступна сторінка»',
        test: f => r(f.sections.slice(1).some(s => s.type !== 'continuous'), 'Курсор перед заголовком «Розклад наукових гуртків» › Макет › Розриви › Розриви розділів › Наступна сторінка. Те саме — перед заголовком «План…».') },
      { id: 'land', label: 'Сторінка з таблицею альбомна, інші — книжкові',
        test: f => {
          const L = f.sections.some(s => s.landscape), P = f.sections.some(s => !s.landscape);
          if (L && P) return r(true);
          if (L) return r(false, 'Альбомним став увесь документ. Спершу постав розриви розділу перед таблицею й після неї, потім змінюй орієнтацію лише в розділі з таблицею.');
          return r(false, 'Курсор у таблиці › Макет › Орієнтація › Альбомна (після розривів розділу перед і після таблиці).');
        } },
      { id: 'hdr2', label: 'Розділ із таблицею має власний текст верхнього колонтитула',
        test: f => {
          const first = f.sections[0] ? f.sections[0].headerText : '';
          if (f.sections.slice(1).some(s => s.ownHeader && LETTERS.test(s.headerText) && s.headerText !== first)) return r(true);
          return r(false, 'Двічі клацни колонтитул на альбомній сторінці › вимкни «Як у попередньому» (група «Навігація») › зміни текст, напр. «Розклад гуртків».');
        } }
    ],
    lists: [
      { id: 'two', label: 'План оформлено багаторівневим списком (є 2-й рівень)',
        test: f => {
          const L = f.lists[0];
          if (L && L.depth >= 2) return r(true);
          if (L) return r(false, 'Список є, але всі пункти на одному рівні. Виділи підпункти й натисни Tab (або Основне › Абзац › Збільшити відступ).');
          return r(false, 'Виділи пункти плану › Основне › Абзац › Багаторівневий список › Бібліотека списків › шаблон.');
        } },
      { id: 'three', label: 'У списку є 3-й рівень (як 1.1.1.)',
        test: f => r(f.lists.some(L => L.levels.includes(2) && L.levels.includes(1) && L.levels.includes(0)), 'Пункти «Підручник з хімії» і «Сайти наукових музеїв» опусти ще на рівень нижче: Tab двічі.') },
      { id: 'legal', label: 'Нумерація «1. → 1.1. → 1.1.1.» із бібліотеки багаторівневих списків',
        test: f => {
          const L = f.lists.find(x => x.depth >= 2) || f.lists[0];
          if (L && L.legal) return r(true);
          if (L && L.bullet) return r(false, 'Це маркований список. Виділи план › Основне › Абзац › Багаторівневий список › шаблон «1. 1.1. 1.1.1.».');
          return r(false, 'Звичайна нумерація + Tab дає «a.», а не «1.1.». Виділи план › Основне › Абзац › Багаторівневий список › шаблон «1. 1.1. 1.1.1.».');
        } },
      { id: 'all', label: 'Усі пункти плану (щонайменше 10) — в одному списку',
        test: f => r(f.lists.some(L => L.count >= 10), 'Виділи весь план від «Підготовка» до «Виступити перед класом» і застосуй список ще раз.') }
    ],
    math: [
      { id: 'sym', label: 'Щонайменше 3 різні спецсимволи (°, π, ≈, € …)',
        test: f => r(f.specials.length >= 3, `Знайдено: ${f.specials.length}. Вставлення › Символ › Інші символи… › вибери символ › Вставити. Заміни ним слова в [дужках].`) },
      { id: 'picto', label: 'Піктограма зі шрифту Wingdings або Webdings',
        test: f => r(f.picto, 'Вставлення › Символ › Інші символи… › у полі «Шрифт» вибери Wingdings › телефон або конверт › Вставити.') },
      { id: 'sub', label: 'Нижній індекс (H₂O, CO₂)',
        test: f => r(f.sub, 'Виділи цифру 2 у H2O › Основне › Шрифт › кнопка x₂ (Ctrl+=).') },
      { id: 'sup', label: 'Верхній індекс (м², 10³)',
        test: f => r(f.sup, 'Виділи цифру 2 у «м2» › Основне › Шрифт › кнопка x² (Ctrl+Shift++).') },
      { id: 'eq1', label: 'Формула 1 у «Рівнянні»: дріб і степінь',
        test: f => {
          if (f.maths.some(m => m.frac && m.sup)) return r(true);
          if (f.maths.length) return r(false, 'Рівняння є, але бракує дробу або степеня. Вкладка «Рівняння» › Структури › Дріб; потім Індекс › верхній індекс.');
          return r(false, 'Вставлення › Символи › Рівняння › вкладка «Рівняння» › Структури › Дріб. Набери (3x+7)/4 = (x−3)² за слайдом.');
        } },
      { id: 'eq2', label: 'Формула 2 у «Рівнянні»: квадратний корінь',
        test: f => r(f.maths.some(m => m.rad), 'Вставлення › Рівняння › Структури › Радикал › квадратний корінь. Набери формулу коренів за слайдом.') }
    ]
  };

  async function inspect(file, checks) {
    if (!file) throw Object.assign(new Error('no-file'), { code: 'no-file' });
    if (/^~\$/.test(file.name)) throw Object.assign(new Error('owner'), { code: 'owner' });
    if (/\.(doc|rtf|odt|pdf)$/i.test(file.name)) throw Object.assign(new Error('format'), { code: 'format' });
    if (file.size > 30 * 1024 * 1024) throw Object.assign(new Error('big'), { code: 'big' });
    const zip = await readZip(await file.arrayBuffer());
    const facts = await analyze(zip);
    const results = {};
    for (const c of checks) { let x; try { x = c.test(facts); } catch (e) { x = r(false, 'Не вдалося перевірити цей пункт.'); } results[c.id] = x; }
    return { facts, results };
  }
  const ERRORS = {
    'no-file': 'Файл не вибрано.',
    owner: 'Це тимчасовий файл Word (ім’я починається з ~$). Вибери свій документ без «~$».',
    format: 'Це не .docx. У Word: Файл › Зберегти як › тип «Документ Word (*.docx)».',
    big: 'Файл завеликий (понад 30 МБ). Можливо, це не той документ.',
    'not-zip': 'Файл не схожий на документ Word .docx. Перевір, що вибрано правильний файл.',
    'not-docx': 'Файл не схожий на документ Word .docx. Перевір, що вибрано правильний файл.',
    'no-inflate': 'Цей браузер не вміє розпаковувати .docx. Онови браузер або відкрий урок у Chrome чи Edge.'
  };

  window.Games = window.Games || {};

  /* ======================= docx-check ======================= */
  window.Games['docx-check'] = {
    readonlyView: true,
    mount(host, ctx) {
      const life = K.lifecycle();
      const data = ctx.task.data || {};
      const checks = CHECK_SETS[data.set] || [];
      const d0 = (ctx.saved && ctx.saved.details) || {};
      const ret = K.returnInfo(ctx);
      let model = d0.model && typeof d0.model === 'object' ? d0.model : { file: null, results: {}, facts: null, at: null, tries: 0 };
      let locked = K.isLocked(ctx), busy = false;

      const status = K.h('p', { class: 'dc-status', role: 'status', 'aria-live': 'polite' });
      const save = K.saver(ctx, {
        life,
        getDetails: () => ({ set: data.set, model, ack: ret.ack }),
        onError: (e, final) => { if (!life.disposed && !final) status.textContent = 'Результат перевірки не збережено. Перевір файл ще раз.'; }
      });

      const list = K.h('ol', { class: 'dc-checks', 'aria-label': 'Що перевіряється' });
      const input = K.h('input', { type: 'file', accept: '.docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document', class: 'dc-input' });
      const pick = K.h('button', { type: 'button', class: 'btn dark' }, 'Вибрати файл .docx');
      const zone = K.h('div', { class: 'dc-zone' },
        K.h('div', { class: 'dc-zone-steps' },
          K.h('b', null, '1.'), ' Збережи документ у Word (Ctrl+S).  ', K.h('b', null, '2.'), ' Вибери його тут або перетягни сюди файл.'),
        K.h('div', { class: 'dc-zone-row' }, pick, input));
      const fileInfo = K.h('div', { class: 'dc-file' });
      const meter = K.h('div', { class: 'dc-meter', 'aria-hidden': 'true' }, K.h('span'));
      const submit = K.h('button', { type: 'button', class: 'btn primary' }, 'Завершити завдання');
      const root = K.h('div', { class: 'docx-check' },
        K.banners(ctx),
        data.brief ? K.h('div', { class: 'dc-brief', html: data.brief }) : null,
        K.h('div', { class: 'dc-label' }, 'Що перевіряється у твоєму файлі'),
        list, zone, fileInfo, meter,
        K.h('p', { class: 'dc-note' }, 'Перевірка відбувається прямо в браузері. Оцінка — частка виконаних пунктів у момент завершення. Перевіряти файл можна скільки завгодно разів.'),
        K.h('div', { class: 'dc-actions' }, submit), status);
      host.append(root);

      const passed = () => checks.filter(c => model.results[c.id] && model.results[c.id].ok).length;
      const score = () => checks.length ? Math.round(100 * passed() / checks.length) : 0;
      const fmtTime = iso => { try { return new Date(iso).toLocaleTimeString('uk-UA', { hour: '2-digit', minute: '2-digit' }); } catch (e) { return ''; } };

      function render() {
        list.replaceChildren(...checks.map(c => {
          const res = model.results[c.id];
          const mark = !res ? '•' : res.ok ? '✓' : '✗';
          const word = !res ? 'ще не перевірено' : res.ok ? 'виконано' : 'не знайдено';
          return K.h('li', { class: 'dc-item ' + (!res ? 'todo' : res.ok ? 'ok' : 'no') },
            K.h('span', { class: 'dc-mark', 'aria-hidden': 'true' }, mark),
            K.h('div', null, K.h('div', { class: 'dc-text' }, c.label, K.h('span', { class: 'dc-sr' }, ' — ' + word)),
              res && !res.ok && res.hint ? K.h('div', { class: 'dc-hint' }, 'Де знайти: ' + res.hint) : null));
        }));
        if (model.file) {
          const fx = model.facts || {};
          fileInfo.replaceChildren(
            K.h('span', null, '📄 '), K.h('b', null, model.file.name),
            K.h('span', null, ` · перевірено о ${fmtTime(model.at)} · виконано ${passed()} з ${checks.length} (${score()}%)`),
            fx.words != null ? K.h('span', { class: 'dc-muted' }, ` · слів: ${fx.words}, розділів: ${fx.sections}` + (fx.lastModifiedBy ? ` · востаннє зберіг(-ла) у Word: ${fx.lastModifiedBy}` : '')) : null);
        } else fileInfo.replaceChildren(K.h('span', { class: 'dc-muted' }, 'Файл ще не перевірено.'));
        meter.firstChild.style.width = (model.file ? score() : 0) + '%';
        zone.classList.toggle('hidden', locked);
        pick.disabled = input.disabled = busy || locked;
        submit.classList.toggle('hidden', locked);
        submit.disabled = busy || !model.file;
      }

      async function check(file) {
        if (locked || busy || life.disposed) return;
        busy = true; render(); status.textContent = 'Перевіряю файл…';
        try {
          const { facts, results } = await inspect(file, checks);
          if (life.disposed) return;
          if (locked) return;
          model = {
            file: { name: String(file.name).slice(0, 120), size: file.size, modified: file.lastModified ? new Date(file.lastModified).toISOString() : null },
            results,
            facts: { words: facts.words, sections: facts.sections.length, author: facts.core.creator || '', lastModifiedBy: facts.core.lastModifiedBy || '', savedAt: facts.core.modified || '' },
            at: new Date().toISOString(),
            tries: (model.tries || 0) + 1
          };
          status.textContent = passed() === checks.length ? `Усе виконано: ${checks.length} з ${checks.length}. Можна завершувати завдання.` : `Виконано ${passed()} з ${checks.length}. Подивись підказки біля ✗, виправ у Word, збережи й перевір ще раз.`;
          save.draft();
        } catch (e) {
          if (life.disposed) return;
          status.textContent = ERRORS[e && e.code] || 'Не вдалося прочитати файл. Збережи документ у Word ще раз і повтори.';
        } finally {
          busy = false; input.value = '';
          if (!life.disposed) render();
        }
      }
      life.listen(pick, 'click', () => { if (!locked && !busy) input.click(); });
      life.listen(input, 'change', () => { if (input.files && input.files[0]) check(input.files[0]); });
      life.listen(zone, 'dragover', e => { if (locked) return; e.preventDefault(); zone.classList.add('over'); });
      life.listen(zone, 'dragleave', () => zone.classList.remove('over'));
      life.listen(zone, 'drop', e => {
        zone.classList.remove('over');
        if (locked) return;
        e.preventDefault();
        const f = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
        if (f) check(f);
      });
      life.listen(submit, 'click', async () => {
        if (locked || busy || !model.file) return;
        const n = passed();
        if (n < checks.length) {
          const missing = checks.filter(c => !(model.results[c.id] && model.results[c.id].ok)).map(c => `<li>${K.esc(c.label)}</li>`).join('');
          const go = await K.confirm({ title: 'Не все виконано', html: `<p>Виконано <b>${n} з ${checks.length}</b>. Бракує:</p><ul>${missing}</ul><p>Завершити як є? Після завершення перевірити файл ще раз на цій сторінці вже не вийде.</p>`, ok: 'Так, завершити', cancel: 'Ще попрацюю', danger: true });
          if (!go || life.disposed || locked) return;
        }
        busy = true; render(); status.textContent = 'Підбиваю підсумок…';
        try {
          await save.final(score());
          if (life.disposed) return;
          locked = true;
          status.textContent = `Завершено: ${score()}%. Продовжуй працювати в тому самому документі.`;
        } catch (e) {
          if (life.disposed) return;
          status.textContent = 'Не вдалося завершити. Натисни «Завершити завдання» ще раз.';
        } finally { busy = false; if (!life.disposed) render(); }
      });

      render();
      if (locked) status.textContent = K.isFinal(ctx) ? `Завершено: ${ctx.saved.score}%.` : 'Режим перегляду.';
      else if (ret.isNew) save.draft();
      return () => life.dispose();
    }
  };

  /* ======================= docx-starter (ungraded) ======================= */
  window.Games['docx-starter'] = {
    readonlyView: true,
    mount(host, ctx) {
      const life = K.lifecycle();
      const data = ctx.task.data || {};
      let locked = K.isLocked(ctx), busy = false;
      const status = K.h('p', { class: 'dc-status', role: 'status', 'aria-live': 'polite' });
      const link = K.h('a', { class: 'btn primary big', href: ctx.asset(data.file || 'files/naukovyi-visnyk.docx'), download: data.downloadName || 'Науковий_вісник.docx' }, '⬇ Завантажити заготовку .docx');
      const done = K.h('button', { type: 'button', class: 'btn dark' }, 'Я відкрив(-ла) файл у Word');
      const root = K.h('div', { class: 'docx-check' },
        K.banners(ctx),
        K.h('div', { class: 'dc-zone dc-start' }, link),
        K.h('ol', { class: 'dc-steps' },
          K.h('li', null, 'Завантаж заготовку й відкрий її у Word.'),
          K.h('li', null, 'Якщо вгорі жовта смуга «Захищений перегляд» — натисни «Увімкнути редагування».'),
          K.h('li', null, 'Файл › Зберегти як › твоя папка. Назви файл своїм прізвищем, напр. «Коваль_вісник.docx».'),
          K.h('li', null, 'На першій сторінці впиши своє прізвище та ім’я замість підказки.')),
        K.h('p', { class: 'dc-note' }, 'Далі весь урок працюєш у цьому одному документі. На кожній контрольній точці вибираєш його для перевірки.'),
        K.h('div', { class: 'dc-actions' }, done), status);
      host.append(root);
      function render() { done.classList.toggle('hidden', locked); done.disabled = busy; }
      life.listen(done, 'click', async () => {
        if (locked || busy) return;
        busy = true; render();
        try { await ctx.finish(100, { opened: true }); if (life.disposed) return; locked = true; status.textContent = 'Чудово! Слідкуй за слайдами.'; }
        catch (e) { if (!life.disposed) status.textContent = 'Не вдалося зберегти позначку. Натисни ще раз.'; }
        finally { busy = false; if (!life.disposed) render(); }
      });
      render();
      if (locked && K.isFinal(ctx)) status.textContent = 'Файл відкрито. Слідкуй за слайдами.';
      return () => life.dispose();
    }
  };

  window.LessonDocxCheck = { readZip, analyze, inspect, CHECK_SETS };
})();
