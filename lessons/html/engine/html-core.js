/* HTML-ядро: розбір коду, перевірка вкладеності, підсвічування, вікно браузера */
(function () {
  'use strict';

  const VOID = new Set(['br', 'hr', 'img', 'meta', 'link', 'input', 'wbr', 'source', 'area', 'base', 'col', 'embed', 'param', 'track']);
  const KNOWN = new Set([...VOID, 'html', 'head', 'title', 'body', 'p', 'b', 'i', 'u', 's', 'strong', 'em', 'mark', 'small', 'sub', 'sup',
    'ul', 'ol', 'li', 'dl', 'dt', 'dd', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'a', 'div', 'span', 'table', 'tr', 'td', 'th', 'thead', 'tbody', 'tfoot', 'caption',
    'style', 'script', 'header', 'footer', 'main', 'section', 'nav', 'article', 'aside', 'pre', 'code', 'blockquote', 'q', 'label', 'button', 'form',
    'textarea', 'select', 'option', 'iframe', 'video', 'audio', 'figure', 'figcaption', 'abbr', 'cite', 'del', 'ins', 'kbd', 'address', 'center', 'font', 'big', 'noscript']);

  const escH = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const nl = s => (s.match(/\n/g) || []).length;

  /* ---------- Токенізація ---------- */
  function tokenize(src) {
    const toks = [];
    let i = 0, line = 1;
    const TAG = /<(\/?)([a-zA-Z][a-zA-Z0-9-]*)((?:\s+[^\s"'>\/=]+(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s"'>]+))?)*)\s*(\/?)>/y;
    const DT = /<!doctype[^>]*>/iy;
    let textStart = 0, textLine = 1;
    const flushText = end => {
      if (end > textStart) toks.push({ type: 'text', text: src.slice(textStart, end), line: textLine });
    };
    while (i < src.length) {
      if (src[i] !== '<') { if (src[i] === '\n') line++; i++; continue; }
      // можливий тег
      if (src.startsWith('<!--', i)) {
        flushText(i);
        const e = src.indexOf('-->', i + 4), end = e < 0 ? src.length : e + 3;
        const raw = src.slice(i, end);
        toks.push({ type: 'comment', raw, line });
        line += nl(raw); i = end; textStart = i; textLine = line; continue;
      }
      DT.lastIndex = i;
      let m = DT.exec(src);
      if (m) {
        flushText(i);
        toks.push({ type: 'doctype', raw: m[0], line, ok: /^<!doctype\s+html\s*>$/i.test(m[0]) });
        line += nl(m[0]); i = DT.lastIndex; textStart = i; textLine = line; continue;
      }
      TAG.lastIndex = i;
      m = TAG.exec(src);
      if (m) {
        flushText(i);
        const name = m[2].toLowerCase();
        const attrs = {};
        m[3].replace(/([^\s"'>\/=]+)(?:\s*=\s*("[^"]*"|'[^']*'|[^\s"'>]+))?/g, (_, k, v) => { attrs[k.toLowerCase()] = v == null ? '' : v.replace(/^["']|["']$/g, ''); return ''; });
        toks.push({ type: m[1] ? 'close' : (m[4] ? 'selfclose' : 'open'), name, attrs, raw: m[0], line, attrsRaw: m[3] });
        line += nl(m[0]); i = TAG.lastIndex; textStart = i; textLine = line; continue;
      }
      // зіпсований тег: «< p>», «<\p>», «<b» без «>» …
      const rest = src.slice(i);
      const bad = /^<\s*[\/\\]?\s*[a-zA-Z][^<>\n]*>?|^<[\/\\]\s*[a-zA-Z]?[^<>\n]*>?/.exec(rest);
      if (bad && bad[0].length > 1) {
        flushText(i);
        toks.push({ type: 'bad', raw: bad[0], line });
        i += bad[0].length; textStart = i; textLine = line; continue;
      }
      i++; // «<» як звичайний текст (наприклад, «2 < 3»)
    }
    flushText(src.length);
    return toks;
  }

  /* ---------- Дерево + помилки ---------- */
  function parse(src) {
    const tokens = tokenize(src);
    const root = { tag: '#root', children: [], parent: null, line: 0 };
    const stack = [root];
    const errors = [];
    const err = (line, msg) => errors.push({ line, msg });
    for (const t of tokens) {
      const top = stack[stack.length - 1];
      if (t.type === 'text') { top.children.push({ type: 'text', text: t.text, parent: top, line: t.line }); continue; }
      if (t.type === 'comment') continue;
      if (t.type === 'doctype') {
        if (!t.ok) err(t.line, `Неправильний запис DOCTYPE — має бути <!DOCTYPE html>`);
        if (stack.length > 1) err(t.line, '<!DOCTYPE html> має бути на самому початку, перед <html>');
        continue;
      }
      if (t.type === 'bad') { err(t.line, `Неправильно записаний тег «${t.raw.trim()}» — перевір дужки < >, косу риску / і пробіли`); continue; }
      if (!KNOWN.has(t.name) && t.type !== 'close') err(t.line, `Невідомий тег <${t.name}> — перевір, чи правильно написано назву`);
      if (t.type === 'open' || t.type === 'selfclose') {
        const el = { type: 'el', tag: t.name, attrs: t.attrs, children: [], parent: top, line: t.line };
        top.children.push(el);
        if (VOID.has(t.name)) continue;
        if (t.type === 'selfclose') { err(t.line, `<${t.name}/> так не закривають — пиши <${t.name}>…</${t.name}>`); continue; }
        stack.push(el);
        continue;
      }
      if (t.type === 'close') {
        if (VOID.has(t.name)) { err(t.line, `<${t.name}> — одиночний тег, закривальний </${t.name}> не потрібен`); continue; }
        let k = stack.length - 1;
        while (k > 0 && stack[k].tag !== t.name) k--;
        if (k === 0) { err(t.line, `Зайвий закривальний тег </${t.name}> — тег <${t.name}> не було відкрито`); continue; }
        for (let j = stack.length - 1; j > k; j--) {
          err(stack[j].line, `Тег <${stack[j].tag}> (рядок ${stack[j].line}) треба закрити перед </${t.name}> (рядок ${t.line})`);
        }
        stack.length = k;
      }
    }
    for (let j = stack.length - 1; j > 0; j--) err(stack[j].line, `Тег <${stack[j].tag}> не закрито — бракує </${stack[j].tag}>`);
    errors.sort((a, b) => a.line - b.line);
    return { tokens, root, errors };
  }

  /* ---------- Запити по дереву ---------- */
  function all(node, tag, out) {
    out = out || [];
    for (const c of node.children || []) {
      if (c.type === 'el') { if (!tag || c.tag === tag) out.push(c); all(c, tag, out); }
    }
    return out;
  }
  const kids = node => (node.children || []).filter(c => c.type === 'el');
  const hasText = node => (node.children || []).some(c => c.type === 'text' && c.text.trim());
  function text(node) {
    if (node.type === 'text') return node.text;
    return (node.children || []).map(text).join('');
  }
  const norm = s => String(s).replace(/\s+/g, ' ').trim();
  function ancestor(el, tag) { let p = el.parent; while (p) { if (p.tag === tag) return p; p = p.parent; } return null; }

  /* Аналіз структури сторінки */
  function analyze(src) {
    const P = parse(src);
    const { root, tokens, errors } = P;
    const sig = tokens.filter(t => !(t.type === 'text' && !t.text.trim()) && t.type !== 'comment');
    const htmls = all(root, 'html'), heads = all(root, 'head'), bodies = all(root, 'body'), titles = all(root, 'title');
    const html = htmls[0], head = heads[0], body = bodies[0], title = titles[0];
    const A = {
      code: src, ...P,
      unknown: tokens.filter(t => (t.type === 'open' || t.type === 'close' || t.type === 'selfclose') && !KNOWN.has(t.name)).length + tokens.filter(t => t.type === 'bad').length,
      doctypeFirst: !!sig[0] && sig[0].type === 'doctype' && sig[0].ok,
      htmlRoot: htmls.length === 1 && html.parent === root && kids(root).length === 1 && !hasText(root),
      headOk: heads.length === 1 && !!html && head.parent === html,
      bodyOk: bodies.length === 1 && !!html && body.parent === html,
      headBeforeBody: !!head && !!body && head.parent === body.parent && head.parent.children.indexOf(head) < body.parent.children.indexOf(body),
      htmlChildrenOk: !!html && kids(html).every(c => c.tag === 'head' || c.tag === 'body') && !hasText(html),
      titleInHead: titles.length === 1 && !!head && title.parent === head,
      titleText: title ? norm(text(title)) : '',
      all: tag => all(root, tag),
      inBody: el => !!ancestor(el, 'body'),
      text, norm, kids, ancestor, html, head, body, title
    };
    A.liOk = all(root, 'li').every(li => li.parent && (li.parent.tag === 'ul' || li.parent.tag === 'ol'));
    A.listsOk = [...all(root, 'ul'), ...all(root, 'ol')].every(l => kids(l).every(c => c.tag === 'li') && !hasText(l));
    return A;
  }

  /* ---------- Підсвічування ---------- */
  function highlight(src) {
    let out = '', i = 0, m;
    const re = /<!--[\s\S]*?-->|<!DOCTYPE[^>]*>|<\/?[a-zA-Z][^<>]*>/gi;
    while ((m = re.exec(src))) {
      out += escH(src.slice(i, m.index));
      const t = m[0];
      if (t.startsWith('<!--')) out += `<span class="hc">${escH(t)}</span>`;
      else if (/^<!doctype/i.test(t)) out += `<span class="hd">${escH(t)}</span>`;
      else {
        const mm = /^<(\/?)([a-zA-Z][\w-]*)([\s\S]*?)(\/?)>$/.exec(t);
        if (!mm) out += escH(t);
        else {
          let attrs = '', j = 0, a;
          const ar = /([\w-]+)(\s*=\s*)("[^"]*"|'[^']*'|[^\s"'>]+)?/g;
          while ((a = ar.exec(mm[3]))) {
            attrs += escH(mm[3].slice(j, a.index)) + `<span class="ha">${escH(a[1])}</span>` + (a[2] ? escH(a[2]) : '') + (a[3] ? `<span class="hs">${escH(a[3])}</span>` : '');
            j = ar.lastIndex;
          }
          attrs += escH(mm[3].slice(j));
          out += `<span class="hp">&lt;${mm[1]}</span><span class="ht">${mm[2]}</span>${attrs}<span class="hp">${mm[4]}&gt;</span>`;
        }
      }
      i = re.lastIndex;
    }
    return out + escH(src.slice(i));
  }

  /* ---------- Вікно браузера з живим результатом ---------- */
  function browserView() {
    const tab = document.createElement('span'); tab.className = 'bw-tab';
    const frame = document.createElement('iframe');
    frame.setAttribute('sandbox', '');
    frame.setAttribute('title', 'Результат');
    const wrap = document.createElement('div');
    wrap.className = 'hbw';
    wrap.innerHTML = '<div class="bw-top"><span class="bw-dots"><i></i><i></i><i></i></span></div><div class="bw-url">file:///C:/Users/Учень/index.html</div>';
    wrap.querySelector('.bw-top').appendChild(tab);
    wrap.appendChild(frame);
    let last = null;
    return {
      el: wrap,
      update(code, title) {
        tab.textContent = title && title.trim() ? title.trim() : 'Без назви';
        tab.classList.toggle('empty', !(title && title.trim()));
        if (code === last) return;
        last = code;
        frame.srcdoc = code;
      }
    };
  }

  /* Детермінований «випадковий» порядок для учня */
  function seeded(str) {
    let h = 1779033703 ^ str.length;
    for (let i = 0; i < str.length; i++) { h = Math.imul(h ^ str.charCodeAt(i), 3432918353); h = (h << 13) | (h >>> 19); }
    return () => { h = Math.imul(h ^ (h >>> 16), 2246822507); h = Math.imul(h ^ (h >>> 13), 3266489909); h ^= h >>> 16; return (h >>> 0) / 4294967296; };
  }
  function shuffleSeed(arr, seed) { const r = seeded(seed); const a = arr.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }

  window.HtmlCore = { tokenize, parse, analyze, highlight, browserView, all, kids, text, norm, ancestor, VOID, KNOWN, escH, shuffleSeed };
})();
