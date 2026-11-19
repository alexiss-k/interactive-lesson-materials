/* MiniSQL — a tiny read-only SQL interpreter for lessons (global window.MiniSQL).
   Supports: SELECT [DISTINCT] cols|* FROM table [WHERE …] [ORDER BY … ASC|DESC] [LIMIT n];
   operators = <> != < > <= >= AND OR NOT LIKE IN BETWEEN IS [NOT] NULL + - * / %;
   functions UPPER, LOWER, LENGTH, ROUND, ABS. Semantics follow SQLite where it matters
   (NULL handling, case-sensitive =, case-insensitive LIKE, NULLs first when sorting ascending).
   Errors are thrown as MiniSQL.SqlError with a Ukrainian message and hint — written for beginners.
   Classic script: no import/export. Pure functions only; no DOM, no state. */
(() => {
  'use strict';
  if (window.MiniSQL) return;

  class SqlError extends Error {
    constructor(message, hint) { super(message); this.name = 'SqlError'; this.hint = hint || ''; }
  }
  const fail = (m, h) => { throw new SqlError(m, h); };

  const KEYWORDS = new Set(['SELECT', 'FROM', 'WHERE', 'ORDER', 'BY', 'ASC', 'DESC', 'AND', 'OR', 'NOT', 'LIKE',
    'IN', 'BETWEEN', 'IS', 'NULL', 'AS', 'DISTINCT', 'LIMIT', 'GROUP', 'HAVING', 'JOIN', 'ON', 'INSERT', 'UPDATE',
    'DELETE', 'DROP', 'CREATE', 'ALTER', 'INTO', 'VALUES', 'SET', 'TRUE', 'FALSE']);
  const CLAUSE_WORDS = ['SELECT', 'FROM', 'WHERE', 'ORDER', 'AND', 'LIMIT', 'DESC', 'ASC', 'LIKE', 'BETWEEN'];
  const CHANGING = ['INSERT', 'UPDATE', 'DELETE', 'DROP', 'CREATE', 'ALTER'];
  const AGG = new Set(['COUNT', 'SUM', 'AVG', 'MIN', 'MAX']);
  const FUNCS = {
    UPPER: a => a == null ? null : String(a).toUpperCase(),
    LOWER: a => a == null ? null : String(a).toLowerCase(),
    LENGTH: a => a == null ? null : String(a).length,
    ABS: a => a == null ? null : Math.abs(num(a)),
    ROUND: (a, d) => a == null ? null : (() => { const k = Math.pow(10, d == null ? 0 : num(d)); return Math.round(num(a) * k) / k; })()
  };
  const CYR = /[Ѐ-ӿ]/;
  const ORDER_HINT = 'Порядок частин запиту: SELECT … FROM … WHERE … ORDER BY …';

  /* ---------- helpers ---------- */
  function lev(a, b) {
    a = a.toUpperCase(); b = b.toUpperCase();
    const d = Array.from({ length: a.length + 1 }, (_, i) => [i]);
    for (let j = 1; j <= b.length; j++) d[0][j] = j;
    for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++)
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    return d[a.length][b.length];
  }
  function closest(word, list, max) {
    let best = null, bd = Infinity;
    for (const w of list) { const x = lev(word, w); if (x < bd) { bd = x; best = w; } }
    return bd <= (max == null ? 2 : max) ? best : null;
  }
  const isNumStr = s => typeof s === 'string' && /^\s*[+-]?(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?\s*$/.test(s);
  function num(v) {
    if (v == null) return null;
    if (typeof v === 'number') return v;
    if (typeof v === 'boolean') return v ? 1 : 0;
    const m = String(v).match(/^\s*[+-]?(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?/);
    return m ? parseFloat(m[0]) : 0;
  }
  const truthy = v => v != null && num(v) !== 0;
  function plural(n, one, few, many) {
    const a = Math.abs(n) % 100, b = a % 10;
    if (a > 10 && a < 20) return many;
    if (b === 1) return one;
    if (b >= 2 && b <= 4) return few;
    return many;
  }
  /* SQLite-like comparison: NULL → null; numbers vs numeric text compare as numbers; numbers sort before text. */
  function cmp(a, b) {
    if (a == null || b == null) return null;
    if (typeof a === 'boolean') a = a ? 1 : 0;
    if (typeof b === 'boolean') b = b ? 1 : 0;
    if (typeof a === 'number' && typeof b === 'string' && isNumStr(b)) b = parseFloat(b);
    if (typeof b === 'number' && typeof a === 'string' && isNumStr(a)) a = parseFloat(a);
    if (typeof a === 'number' && typeof b === 'number') return a < b ? -1 : a > b ? 1 : 0;
    if (typeof a === 'number') return -1;
    if (typeof b === 'number') return 1;
    a = String(a); b = String(b);
    return a < b ? -1 : a > b ? 1 : 0;
  }
  function sortCmp(a, b) {           // for ORDER BY: NULLs first
    if (a == null && b == null) return 0;
    if (a == null) return -1;
    if (b == null) return 1;
    return cmp(a, b);
  }
  function likeRe(pattern) {
    let re = '';
    for (const ch of String(pattern)) {
      if (ch === '%') re += '[\\s\\S]*';
      else if (ch === '_') re += '[\\s\\S]';
      else re += ch.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }
    return new RegExp('^' + re + '$', 'i');
  }

  /* ---------- tokenizer ---------- */
  function tokenize(src) {
    const toks = []; let i = 0; const n = src.length;
    const push = (t, v, start, extra) => toks.push(Object.assign({ t, v, pos: start, end: i }, extra));
    while (i < n) {
      const c = src[i];
      if (/\s/.test(c)) { i++; continue; }
      if (c === '-' && src[i + 1] === '-') { while (i < n && src[i] !== '\n') i++; continue; }
      const start = i;
      if (c === "'") {
        let s = ''; i++;
        for (;;) {
          if (i >= n) fail('Не закрито лапку \'.', 'Текст береться в одинарні лапки з обох боків: \'Slytherin\'.');
          if (src[i] === "'") { if (src[i + 1] === "'") { s += "'"; i += 2; continue; } i++; break; }
          s += src[i++];
        }
        push('str', s, start); continue;
      }
      if (c === '"' || c === '`') {
        let s = ''; i++;
        while (i < n && src[i] !== c) s += src[i++];
        if (i >= n) fail(`Не закрито лапку ${c}.`, 'Текст у SQL пишуть в одинарних лапках: \'Slytherin\'.');
        i++; push('qid', s, start); continue;
      }
      if ('‘’‚‛“”„«»ʼ′'.includes(c)) {
        fail(`Символ ${c} — це не та лапка, яку розуміє SQL.`, 'Текст береться у звичайні одинарні лапки \' (клавіша поруч з Enter в англійській розкладці): \'Slytherin\'.');
      }
      if (/[0-9]/.test(c) || (c === '.' && /[0-9]/.test(src[i + 1] || ''))) {
        const m = src.slice(i).match(/^(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?/);
        i += m[0].length;
        if (/[A-Za-z_Ѐ-ӿ]/.test(src[i] || '')) {
          const w = src.slice(start).match(/^[A-Za-z0-9_Ѐ-ӿ.]+/)[0];
          fail(`Незрозуміле слово «${w}».`, 'Назва стовпця не може починатися з цифри. Якщо це текст — візьми його в одинарні лапки.');
        }
        push('num', parseFloat(m[0]), start); continue;
      }
      if (/[A-Za-z_Ѐ-ӿ]/.test(c)) {
        const w = src.slice(i).match(/^[A-Za-z0-9_Ѐ-ӿ]+/)[0];
        i += w.length;
        if (CYR.test(w)) {
          fail(`У слові «${w}» є кириличні літери.`, 'Перемкни розкладку на англійську: команди SQL і назви стовпців пишуться латиницею. Українською можна писати лише текст у лапках.');
        }
        const up = w.toUpperCase();
        if (KEYWORDS.has(up)) push('kw', up, start, { raw: w }); else push('id', w, start);
        continue;
      }
      const two = src.slice(i, i + 2);
      if (two === '==') fail('У SQL порівнюють одним знаком =, а не ==.', 'Наприклад: house = \'Slytherin\'.');
      if (two === '=>' || two === '=<') fail(`Знак ${two} записано навпаки.`, 'Пиши >= (більше або дорівнює) чи <= (менше або дорівнює).');
      if (['<=', '>=', '<>', '!='].includes(two)) { i += 2; push('op', two === '!=' ? '<>' : two, start, { raw: two }); continue; }
      if ('=<>(),*;+-/%.'.includes(c)) { i++; push('op', c, start); continue; }
      fail(`Незрозумілий символ «${c}».`, c === '"' ? '' : 'Перевір, чи не потрапив зайвий символ у запит.');
    }
    toks.push({ t: 'eof', v: null, pos: n, end: n });
    return toks;
  }

  /* ---------- parser ---------- */
  function parse(src, knownCols) {
    const toks = tokenize(src);
    knownCols = knownCols || [];
    let p = 0;
    const peek = (o = 0) => toks[Math.min(p + o, toks.length - 1)];
    const next = () => toks[p++];
    const isKw = (k, o = 0) => peek(o).t === 'kw' && peek(o).v === k;
    const isOp = (v, o = 0) => peek(o).t === 'op' && peek(o).v === v;
    const desc = tok => tok.t === 'eof' ? 'кінець запиту'
      : tok.t === 'str' ? `'${tok.v}'` : `«${tok.raw || tok.v}»`;
    const isColName = w => knownCols.some(c => c.toLowerCase() === String(w).toLowerCase());
    const typo = (w, list) => closest(w, list || CLAUSE_WORDS, w.length <= 2 ? 0 : 2);

    const first = peek();
    if (first.t === 'eof') fail('Запит порожній.', 'Почни з SELECT.');
    if (first.t === 'kw' && CHANGING.includes(first.v)) fail(`Команда ${first.v} змінює базу даних, а сьогодні ми лише читаємо дані.`, 'Використовуй SELECT.');
    if (!isKw('SELECT')) {
      const t = first.t === 'id' ? typo(first.v, ['SELECT']) : null;
      fail(`Запит має починатися з SELECT, а не з ${desc(first)}.`, t ? 'Перевір, як написано слово SELECT.' : '');
    }
    next();
    const q = { distinct: false, cols: [], from: null, where: null, order: [], limit: null, src };
    if (isKw('DISTINCT')) { next(); q.distinct = true; }
    if (isKw('FROM') || peek().t === 'eof') fail('Після SELECT треба вказати, що саме вивести.', 'Наприклад: SELECT first_name FROM characters або SELECT * FROM characters.');

    for (;;) {
      if (isOp('*')) { next(); q.cols.push({ star: true }); }
      else {
        const e = expr();
        let alias = null;
        if (isKw('AS')) {
          next(); const a = next();
          if (a.t !== 'id' && a.t !== 'qid') fail('Після AS потрібна нова назва стовпця.');
          alias = a.v;
        } else if (peek().t === 'id' || peek().t === 'qid') {
          const w = peek().v, t = typo(w);
          if (t && !isColName(w)) fail(`Незрозуміле слово «${w}».`, `Можливо, ти мав(-ла) на увазі ${t}?`);
          fail(`Між «${e.text}» і «${w}» потрібна кома.`, 'Стовпці в SELECT перелічують через кому: SELECT first_name, last_name FROM …');
        }
        q.cols.push({ expr: e, alias });
      }
      if (isOp(',')) {
        next();
        if (isKw('FROM')) fail('Перед FROM зайва кома.', 'Після останнього стовпця кома не потрібна.');
        if (peek().t === 'eof') fail('Запит обірвався після коми.', 'Допиши назву стовпця та FROM.');
        continue;
      }
      break;
    }

    if (!isKw('FROM')) {
      const t = peek();
      if (t.t === 'eof') fail('Бракує FROM: не вказано, з якої таблиці брати дані.', 'Додай FROM і назву таблиці, наприклад: … FROM characters');
      if (isKw('WHERE') || isKw('ORDER')) fail(`Перед ${t.v} має стояти FROM із назвою таблиці.`, ORDER_HINT);
      const near = t.t === 'id' ? typo(t.v) : null;
      fail(`Після списку стовпців очікувалося FROM, а натомість ${desc(t)}.`, near ? `Можливо, ти мав(-ла) на увазі ${near}?` : '');
    }
    next();
    const tt = next();
    if (tt.t !== 'id' && tt.t !== 'qid') {
      if (tt.t === 'eof') fail('Після FROM потрібна назва таблиці.', 'Наприклад: FROM characters');
      fail(`Після FROM потрібна назва таблиці, а натомість ${desc(tt)}.`, '');
    }
    q.from = tt.v;
    if (isOp(',') || isKw('JOIN')) fail('Сьогодні в запиті використовуємо лише одну таблицю.', 'Як поєднувати таблиці, вивчатимемо на наступних уроках.');
    if (isOp('.')) fail('Крапка після назви таблиці тут не потрібна.', '');

    if (isKw('WHERE')) {
      next();
      if (peek().t === 'eof' || isKw('ORDER')) fail('Після WHERE потрібна умова.', 'Наприклад: WHERE house = \'Slytherin\'');
      q.where = expr();
    }
    if (isKw('GROUP') || isKw('HAVING')) fail('Групування (GROUP BY) вивчатимемо на наступних уроках.', '');
    if (isKw('ORDER')) {
      next();
      if (!isKw('BY')) fail('Після ORDER потрібне слово BY: ORDER BY.', 'Наприклад: ORDER BY age DESC');
      next();
      if (peek().t === 'eof') fail('Після ORDER BY потрібна назва стовпця.', 'Наприклад: ORDER BY age DESC');
      for (;;) {
        const e = expr();
        let dir = 'ASC';
        if (isKw('ASC') || isKw('DESC')) dir = next().v;
        q.order.push({ expr: e, dir });
        if (isOp(',')) { next(); continue; }
        break;
      }
    }
    if (isKw('LIMIT')) {
      next(); const t = next();
      if (t.t !== 'num' || !Number.isInteger(t.v) || t.v < 0) fail('Після LIMIT потрібне ціле число.', 'Наприклад: LIMIT 3');
      q.limit = t.v;
    }
    if (isKw('WHERE')) fail('WHERE стоїть не на своєму місці.', 'Умова WHERE пишеться одразу після FROM і перед ORDER BY. ' + ORDER_HINT);
    if (isKw('FROM')) fail('FROM трапляється в запиті двічі.', ORDER_HINT);
    if (isOp(';')) next();
    const rest = peek();
    if (rest.t !== 'eof') {
      if (rest.t === 'kw' && rest.v === 'SELECT') fail('За раз можна виконати лише один запит.', 'Залиш один SELECT.');
      if (rest.t === 'id') {
        const t = typo(rest.v);
        if (t) fail(`Незрозуміле слово «${rest.v}».`, `Можливо, ти мав(-ла) на увазі ${t}?`);
      }
      fail(`Зайве в запиті: ${desc(rest)}.`, rest.t === 'str' || rest.t === 'num'
        ? 'Можливо, бракує знака порівняння або слова AND між умовами.'
        : ORDER_HINT);
    }
    return q;

    /* expressions, lowest precedence first */
    function node(start, n) { n.text = src.slice(start, toks[p - 1].end).trim(); return n; }
    function expr() { return orExpr(); }
    function orExpr() {
      const s = peek().pos; let l = andExpr();
      while (isKw('OR')) { next(); l = node(s, { k: 'or', l, r: andExpr() }); }
      return l;
    }
    function andExpr() {
      const s = peek().pos; let l = notExpr();
      while (isKw('AND')) { next(); missing('AND'); l = node(s, { k: 'and', l, r: notExpr() }); }
      return l;
    }
    function notExpr() {
      const s = peek().pos;
      if (isKw('NOT')) { next(); return node(s, { k: 'not', e: notExpr() }); }
      return cmpExpr();
    }
    function missing(after) {
      const t = peek();
      if (t.t === 'eof') fail(`Запит обірвався після ${after}.`, 'Допиши значення або умову.');
      if (t.t === 'kw' && ['FROM', 'WHERE', 'ORDER', 'LIMIT', 'AND', 'OR'].includes(t.v)) fail(`Після ${after} бракує значення: далі одразу йде ${t.v}.`, '');
    }
    function cmpExpr() {
      const s = peek().pos;
      const l = addExpr();
      const t = peek();
      if (t.t === 'op' && ['=', '<>', '<', '>', '<=', '>='].includes(t.v)) {
        next(); missing(t.raw || t.v);
        const r = addExpr();
        if (peek().t === 'op' && ['=', '<>', '<', '>', '<=', '>='].includes(peek().v)) fail('Два порівняння поспіль не можна писати без AND.', 'Наприклад: age > 13 AND age < 16');
        return node(s, { k: 'cmp', op: t.v, l, r });
      }
      let neg = false;
      if (isKw('NOT') && (isKw('LIKE', 1) || isKw('IN', 1) || isKw('BETWEEN', 1))) { next(); neg = true; }
      if (isKw('LIKE')) { next(); missing('LIKE'); return node(s, { k: 'like', neg, l, r: addExpr() }); }
      if (isKw('IN')) {
        next();
        if (!isOp('(')) fail('Після IN потрібен список у дужках.', 'Наприклад: house IN (\'Gryffindor\', \'Slytherin\')');
        next(); const list = [];
        for (;;) { list.push(addExpr()); if (isOp(',')) { next(); continue; } break; }
        if (!isOp(')')) fail('Не закрито дужку в списку IN.', '');
        next();
        return node(s, { k: 'in', neg, l, list });
      }
      if (isKw('BETWEEN')) {
        next(); const a = addExpr();
        if (!isKw('AND')) fail('BETWEEN пишеться так: BETWEEN 13 AND 15.', '');
        next(); const b = addExpr();
        return node(s, { k: 'between', neg, l, a, b });
      }
      if (isKw('IS')) {
        next(); let isNeg = false;
        if (isKw('NOT')) { next(); isNeg = true; }
        if (!isKw('NULL')) fail('Після IS очікується NULL: IS NULL або IS NOT NULL.', '');
        next();
        return node(s, { k: 'isnull', neg: isNeg, l });
      }
      return l;
    }
    function addExpr() {
      const s = peek().pos; let l = mulExpr();
      while (isOp('+') || isOp('-')) { const op = next().v; l = node(s, { k: 'arith', op, l, r: mulExpr() }); }
      return l;
    }
    function mulExpr() {
      const s = peek().pos; let l = unary();
      while (isOp('*') || isOp('/') || isOp('%')) { const op = next().v; l = node(s, { k: 'arith', op, l, r: unary() }); }
      return l;
    }
    function unary() {
      const s = peek().pos;
      if (isOp('-')) { next(); return node(s, { k: 'neg', e: unary() }); }
      if (isOp('+')) { next(); return unary(); }
      return primary();
    }
    function primary() {
      const s = peek().pos, t = next();
      if (t.t === 'num') return node(s, { k: 'lit', v: t.v });
      if (t.t === 'str') return node(s, { k: 'lit', v: t.v, str: true });
      if (t.t === 'kw' && t.v === 'NULL') return node(s, { k: 'lit', v: null });
      if (t.t === 'kw' && (t.v === 'TRUE' || t.v === 'FALSE')) return node(s, { k: 'lit', v: t.v === 'TRUE' ? 1 : 0 });
      if (t.t === 'id' && isOp('(')) {
        const name = t.v.toUpperCase();
        if (AGG.has(name)) fail(`Функцію ${name} вивчатимемо на наступних уроках.`, 'Сьогодні виводимо самі записи: SELECT … FROM … WHERE … ORDER BY …');
        if (!FUNCS[name]) fail(`Невідома функція ${t.v}.`, '');
        next(); const args = [];
        if (!isOp(')')) for (;;) { args.push(expr()); if (isOp(',')) { next(); continue; } break; }
        if (!isOp(')')) fail(`Не закрито дужку після ${name}(.`, '');
        next();
        return node(s, { k: 'fn', name, args });
      }
      if (t.t === 'id' || t.t === 'qid') return node(s, { k: 'col', name: t.v, quoted: t.t === 'qid' });
      if (t.t === 'op' && t.v === '(') {
        const e = expr();
        if (!isOp(')')) fail('Не закрито дужку (.', 'Кожна відкривна дужка ( потребує закривної ).');
        next();
        return node(s, { k: 'paren', e });
      }
      if (t.t === 'eof') fail('Запит обірвався: бракує значення або назви стовпця.', '');
      if (t.t === 'op' && t.v === ',') fail('Зайва кома.', 'Між двома комами немає стовпця.');
      if (t.t === 'op' && t.v === '*') fail('Зірочку * можна писати лише окремо: SELECT * FROM …', '');
      if (t.t === 'kw') fail(`Тут очікувалося значення або назва стовпця, а натомість ${t.v}.`, t.v === 'FROM' ? 'Можливо, зайва кома перед FROM?' : ORDER_HINT);
      fail(`Тут очікувалося значення або назва стовпця, а натомість ${desc(t)}.`, '');
    }
  }

  /* ---------- execution ---------- */
  function findTable(db, name) {
    const tables = (db && db.tables) || [];
    const t = tables.find(x => x.name.toLowerCase() === String(name).toLowerCase());
    if (t) return t;
    const names = tables.map(x => x.name);
    const near = closest(name, names, 3);
    fail(`Таблиці «${name}» у базі немає.`, (near ? `Можливо, ${near}? ` : '') + `Доступні таблиці: ${names.join(', ')}.`);
  }

  function run(db, sql) {
    const allCols = [];
    ((db && db.tables) || []).forEach(t => t.columns.forEach(c => allCols.push(c.name)));
    const q = parse(String(sql || ''), allCols);
    const table = findTable(db, q.from);
    const colNames = table.columns.map(c => c.name);
    const index = new Map(colNames.map((c, i) => [c.toLowerCase(), i]));
    const literals = [];                 // text literals compared with = (for the "case" notice)

    function unknownColumn(n) {
      const name = n.name;
      const values = new Set();
      table.rows.forEach(r => r.forEach(v => { if (typeof v === 'string') values.add(v.toLowerCase()); }));
      if (n.quoted) fail(`Стовпця «${name}» немає.`, `Текст у SQL пишуть в одинарних лапках: '${name}'. Подвійні лапки "…" означають назву стовпця.`);
      if (values.has(name.toLowerCase())) fail(`Стовпця «${name}» немає в таблиці ${table.name}.`, `Схоже, ${name} — це текст. Візьми його в одинарні лапки: '${name}'.`);
      const near = closest(name, colNames, name.length <= 4 ? 1 : 3);
      fail(`Стовпця «${name}» немає в таблиці ${table.name}.`,
        near ? `Можливо, ${near}?` : `Стовпці таблиці: ${colNames.join(', ')}. Якщо ${name} — це текст, візьми його в одинарні лапки: '${name}'.`);
    }
    function compile(n) {
      switch (n.k) {
        case 'lit': return () => n.v;
        case 'col': {
          const i = index.get(n.name.toLowerCase());
          if (i == null) unknownColumn(n);
          return r => r[i];
        }
        case 'paren': return compile(n.e);
        case 'neg': { const f = compile(n.e); return r => { const v = f(r); return v == null ? null : -num(v); }; }
        case 'not': { const f = compile(n.e); return r => { const v = f(r); return v == null ? null : (truthy(v) ? 0 : 1); }; }
        case 'and': {
          const a = compile(n.l), b = compile(n.r);
          return r => { const x = a(r), y = b(r); if ((x != null && !truthy(x)) || (y != null && !truthy(y))) return 0; return x == null || y == null ? null : 1; };
        }
        case 'or': {
          const a = compile(n.l), b = compile(n.r);
          return r => { const x = a(r), y = b(r); if (truthy(x) || truthy(y)) return 1; return x == null || y == null ? null : 0; };
        }
        case 'cmp': {
          const a = compile(n.l), b = compile(n.r), op = n.op;
          if (op === '=' && n.r.k === 'lit' && n.r.str && n.l.k === 'col') literals.push({ col: n.l.name, v: n.r.v });
          if (op === '=' && n.l.k === 'lit' && n.l.str && n.r.k === 'col') literals.push({ col: n.r.name, v: n.l.v });
          return r => {
            const c = cmp(a(r), b(r));
            if (c == null) return null;
            switch (op) {
              case '=': return c === 0 ? 1 : 0; case '<>': return c !== 0 ? 1 : 0;
              case '<': return c < 0 ? 1 : 0; case '>': return c > 0 ? 1 : 0;
              case '<=': return c <= 0 ? 1 : 0; default: return c >= 0 ? 1 : 0;
            }
          };
        }
        case 'like': {
          const a = compile(n.l), b = compile(n.r);
          return r => { const x = a(r), y = b(r); if (x == null || y == null) return null; const m = likeRe(y).test(String(x)); return (m !== n.neg) ? 1 : 0; };
        }
        case 'in': {
          const a = compile(n.l), list = n.list.map(compile);
          return r => {
            const x = a(r); if (x == null) return null;
            let sawNull = false;
            for (const f of list) { const v = f(r); if (v == null) { sawNull = true; continue; } if (cmp(x, v) === 0) return n.neg ? 0 : 1; }
            return sawNull ? null : (n.neg ? 1 : 0);
          };
        }
        case 'between': {
          const a = compile(n.l), lo = compile(n.a), hi = compile(n.b);
          return r => { const x = a(r), l = lo(r), h = hi(r); const c1 = cmp(x, l), c2 = cmp(x, h); if (c1 == null || c2 == null) return null; const inside = c1 >= 0 && c2 <= 0; return inside !== n.neg ? 1 : 0; };
        }
        case 'isnull': { const a = compile(n.l); return r => ((a(r) == null) !== n.neg) ? 1 : 0; }
        case 'arith': {
          const a = compile(n.l), b = compile(n.r), op = n.op;
          return r => {
            const x = a(r), y = b(r); if (x == null || y == null) return null;
            const p = num(x), s = num(y);
            switch (op) {
              case '+': return p + s; case '-': return p - s; case '*': return p * s;
              case '/': if (s === 0) return null; return Number.isInteger(p) && Number.isInteger(s) ? Math.trunc(p / s) : p / s;
              default: if (s === 0) return null; return p % s;
            }
          };
        }
        case 'fn': { const fs = n.args.map(compile), f = FUNCS[n.name]; return r => f(...fs.map(g => g(r))); }
        default: fail('Внутрішня помилка розбору запиту.', '');
      }
    }

    /* output columns */
    const out = [];
    q.cols.forEach(c => {
      if (c.star) colNames.forEach((name, i) => out.push({ name, f: r => r[i] }));
      else {
        const f = compile(c.expr);
        const name = c.alias || (c.expr.k === 'col' ? colNames[index.get(c.expr.name.toLowerCase())] : c.expr.text);
        out.push({ name, f });
      }
    });
    const where = q.where ? compile(q.where) : null;
    const order = q.order.map(o => {
      const e = o.expr;
      if (e.k === 'lit' && typeof e.v === 'number' && !e.str) {
        if (!Number.isInteger(e.v) || e.v < 1 || e.v > out.length) fail(`ORDER BY ${e.v}: у результаті немає стовпця з таким номером.`, 'Краще сортувати за назвою стовпця: ORDER BY age');
        const k = e.v - 1; return { pick: (src, row) => row[k], dir: o.dir };
      }
      if (e.k === 'col' && !index.has(e.name.toLowerCase())) {
        const k = out.findIndex(x => x.name.toLowerCase() === e.name.toLowerCase());
        if (k >= 0) return { pick: (src, row) => row[k], dir: o.dir };
      }
      const f = compile(e);
      return { pick: src => f(src), dir: o.dir };
    });

    let rows = [];
    for (const src of table.rows) {
      if (where && !truthy(where(src))) continue;
      rows.push({ src, row: out.map(c => c.f(src)) });
    }
    if (q.distinct) {
      const seen = new Set();
      rows = rows.filter(x => { const k = JSON.stringify(x.row); if (seen.has(k)) return false; seen.add(k); return true; });
    }
    if (order.length) {
      rows = rows.map((x, i) => ({ x, i, keys: order.map(o => o.pick(x.src, x.row)) }))
        .sort((A, B) => {
          for (let j = 0; j < order.length; j++) {
            const c = sortCmp(A.keys[j], B.keys[j]);
            if (c) return order[j].dir === 'DESC' ? -c : c;
          }
          return A.i - B.i;
        }).map(y => y.x);
    }
    if (q.limit != null) rows = rows.slice(0, q.limit);

    /* notices for "zero rows" moments that beginners hit */
    const notices = [];
    if (!rows.length) {
      for (const L of literals) {
        const i = index.get(L.col.toLowerCase());
        if (i == null) continue;
        const vals = table.rows.map(r => r[i]).filter(v => typeof v === 'string');
        if (vals.includes(L.v)) continue;
        const ci = vals.find(v => v.toLowerCase() === L.v.toLowerCase());
        const sp = vals.find(v => v.trim() === L.v.trim());
        if (ci) notices.push(`Текст порівнюється з урахуванням великих і малих літер: '${L.v}' ≠ '${ci}'.`);
        else if (sp) notices.push(`У тексті '${L.v}' є зайві пробіли.`);
      }
    }
    return { columns: out.map(c => c.name), rows: rows.map(x => x.row), notices, table: table.name, ordered: order.length > 0 };
  }

  /* ---------- result comparison ---------- */
  const norm = v => typeof v === 'number' ? Math.round(v * 1e9) / 1e9 : v;
  const rowKey = r => JSON.stringify(r.map(norm));
  function compare(got, exp, ordered) {
    const gc = got.columns.length, ec = exp.columns.length;
    if (gc !== ec) {
      const why = `У результаті ${gc} ${plural(gc, 'стовпець', 'стовпці', 'стовпців')}, а потрібно ${ec}.`;
      return { ok: false, why, hint: gc > ec ? 'Виведи лише ті стовпці, про які йдеться в завданні, — не всі (*).' : 'Перевір, чи всі потрібні стовпці перелічено після SELECT.' };
    }
    const gn = got.columns.map(c => c.toLowerCase()), en = exp.columns.map(c => c.toLowerCase());
    const sameSet = gn.slice().sort().join('|') === en.slice().sort().join('|');
    const sameOrder = gn.join('|') === en.join('|');
    if (sameSet && !sameOrder) return { ok: false, why: 'Стовпці правильні, але стоять в іншому порядку.', hint: `Перелічи їх так: ${exp.columns.join(', ')}.` };
    const gr = got.rows.length, er = exp.rows.length;
    if (gr !== er) {
      return { ok: false, why: `Знайдено ${gr} ${plural(gr, 'рядок', 'рядки', 'рядків')}, а має бути ${er}.`, hint: 'Перевір умову після WHERE.' };
    }
    const gk = got.rows.map(rowKey), ek = exp.rows.map(rowKey);
    const sorted = a => a.slice().sort();
    if (sorted(gk).join('\n') !== sorted(ek).join('\n')) {
      return { ok: false, why: 'Кількість рядків правильна, але дані інші.', hint: sameSet ? 'Перевір умову WHERE.' : 'Перевір, які стовпці виведено і чи правильна умова WHERE.' };
    }
    if (ordered && gk.join('\n') !== ek.join('\n')) {
      return { ok: false, why: 'Рядки правильні, але порядок інший.', hint: got.ordered
        ? 'Перевір ORDER BY: за яким стовпцем сортуєш і в якому напрямку. ASC — за зростанням (1→9, A→Z), DESC — за спаданням.'
        : 'Додай наприкінці запиту ORDER BY і назву стовпця, за яким треба впорядкувати.' };
    }
    return { ok: true, why: '', hint: '' };
  }

  function format(v) {
    if (v == null) return 'NULL';
    if (typeof v === 'number') return Number.isInteger(v) ? String(v) : String(Math.round(v * 1e6) / 1e6);
    return String(v);
  }

  window.MiniSQL = { version: '1.0.0', SqlError, tokenize, parse, run, compare, format, plural };
})();
