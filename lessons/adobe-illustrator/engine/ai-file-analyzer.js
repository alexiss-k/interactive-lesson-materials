/* AiFileAnalyzer — reads a learner's PDF / AI / SVG file IN THE BROWSER (nothing is sent anywhere)
   and checks it against a task spec: page size, orientation, colour mode, artboards, objects,
   fill colours, strokes, file name. Classic script; declare it before ai-file-check.js / ai-file-upload.js.

   analyze(file)        → Promise<report>   (format, size in pt/px, colour mode + evidence, objects…)
   evaluate(report, spec, fileName) → { checks:[{id,label,st:'ok'|'bad'|'unk',detail,hint}], score }

   PDF: Illustrator PDFs and PDF-compatible .ai files are PDFs. We scan every stream, inflate
   FlateDecode with DecompressionStream, read object streams, page boxes, XMP metadata,
   Illustrator private-data headers and the drawing operators of page contents and forms.
   Colour mode is a weighted vote of independent signals (document signals outweigh output ones).
   Anything that cannot be decided is 'unk' (never a false ✗). */
(() => {
  'use strict';
  if (window.AiFileAnalyzer) return;

  const MM_PER_PT = 25.4 / 72;
  const UNIT_TO_PT = { pt: 1, px: 1, mm: 72 / 25.4, cm: 72 / 2.54, in: 72, pc: 12 };

  /* ---------- bytes ---------- */
  function latin1(u8, from = 0, to = u8.length) {
    let out = '';
    for (let i = from; i < to; i += 0x8000) out += String.fromCharCode.apply(null, u8.subarray(i, Math.min(to, i + 0x8000)));
    return out;
  }
  async function inflate(u8) {
    if (typeof DecompressionStream !== 'function') return null;
    const chunks = [];
    try {
      const reader = new Blob([u8]).stream().pipeThrough(new DecompressionStream('deflate')).getReader();
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        chunks.push(value);
      }
    } catch (e) { if (!chunks.length) return null; /* keep what was decoded before junk/truncation */ }
    let n = 0; for (const c of chunks) n += c.length;
    const out = new Uint8Array(n); let p = 0;
    for (const c of chunks) { out.set(c, p); p += c.length; }
    return out;
  }
  function a85(u8) {
    const out = []; let tuple = 0, cnt = 0;
    for (let i = 0; i < u8.length; i++) {
      const c = u8[i];
      if (c === 126) break;                       // '~>' end
      if (c <= 32) continue;
      if (c === 122 && cnt === 0) { out.push(0, 0, 0, 0); continue; }   // 'z'
      if (c < 33 || c > 117) return null;
      tuple = tuple * 85 + (c - 33); cnt++;
      if (cnt === 5) { out.push(tuple >>> 24 & 255, tuple >>> 16 & 255, tuple >>> 8 & 255, tuple & 255); tuple = 0; cnt = 0; }
    }
    if (cnt > 1) {
      for (let k = cnt; k < 5; k++) tuple = tuple * 85 + 84;
      const b = [tuple >>> 24 & 255, tuple >>> 16 & 255, tuple >>> 8 & 255, tuple & 255];
      out.push(...b.slice(0, cnt - 1));
    }
    return new Uint8Array(out);
  }
  function ahx(u8) {
    const s = latin1(u8).replace(/>[\s\S]*$/, '').replace(/[^0-9a-fA-F]/g, '');
    const out = new Uint8Array(Math.ceil(s.length / 2));
    for (let i = 0; i < out.length; i++) out[i] = parseInt((s.substr(i * 2, 2) + '0').slice(0, 2), 16);
    return out;
  }
  async function sha(buf) {
    try {
      const d = await crypto.subtle.digest('SHA-256', buf);
      return [...new Uint8Array(d)].slice(0, 8).map(b => b.toString(16).padStart(2, '0')).join('');
    } catch (e) { return ''; }
  }

  /* ---------- PDF ---------- */
  const num = s => { const v = parseFloat(s); return Number.isFinite(v) ? v : null; };
  function box(dict, key) {
    const m = new RegExp('/' + key + '\\s*\\[\\s*([-+\\d.eE\\s]+?)\\s*\\]').exec(dict);
    if (!m) return null;
    const v = m[1].trim().split(/\s+/).map(Number);
    if (v.length !== 4 || v.some(x => !Number.isFinite(x))) return null;
    const w = Math.abs(v[2] - v[0]), h = Math.abs(v[3] - v[1]);
    return w > 0 && h > 0 ? { w, h } : null;
  }

  async function parsePdf(u8, s) {
    const streams = new Map();    // objNum → { dict, text }
    const objText = new Map();    // objNum → dictionary text (non-stream objects, incl. object streams)
    const extraText = [];         // decoded texts that may hold XMP / private data
    // 1) walk "N G obj … endobj" in the raw file, cutting stream bodies out
    const objRe = /(\d+)\s+(\d+)\s+obj\b/g;
    let m;
    while ((m = objRe.exec(s))) {
      const n = +m[1], start = m.index + m[0].length;
      const streamAt = s.indexOf('stream', start);
      const endAt = s.indexOf('endobj', start);
      if (endAt < 0) break;
      if (streamAt >= 0 && streamAt < endAt) {
        const dict = s.slice(start, streamAt);
        let p = streamAt + 6;
        if (s[p] === '\r') p++;
        if (s[p] === '\n') p++;
        let len = null;
        const lm = /\/Length\s+(\d+)(?!\s+\d+\s+R)/.exec(dict);
        if (lm) len = +lm[1];
        let end;
        if (len != null && /^\s*endstream/.test(s.slice(p + len, p + len + 20))) end = p + len;
        else {
          end = s.indexOf('endstream', p);
          if (end < 0) break;
          while (end > p && (s[end - 1] === '\n' || s[end - 1] === '\r')) end--;
        }
        const after = s.indexOf('endobj', end);
        streams.set(n, { dict, raw: u8.subarray(p, end) });
        objRe.lastIndex = after > 0 ? after + 6 : end;
      } else {
        objText.set(n, s.slice(start, endAt));
        objRe.lastIndex = endAt + 6;
      }
    }
    // 2) decode streams (filter chains of ASCII85 / ASCIIHex / Flate)
    for (const [n, st] of streams) {
      const d = st.dict;
      if (/\/Subtype\s*\/Image\b|\/Type\s*\/XRef\b|\/Length1\b|\/Subtype\s*\/(Type1C|CIDFontType0C|OpenType)\b/.test(d)) continue;
      const fm = /\/Filter\s*(\[[^\]]*\]|\/\w+)/.exec(d);
      const filters = fm ? (fm[1].match(/\/\w+/g) || []).map(x => x.slice(1)) : [];
      let bytes = st.raw;
      for (const f of filters) {
        if (!bytes) break;
        if (f === 'FlateDecode' || f === 'Fl') bytes = await inflate(bytes);
        else if (f === 'ASCII85Decode' || f === 'A85') bytes = a85(bytes);
        else if (f === 'ASCIIHexDecode' || f === 'AHx') bytes = ahx(bytes);
        else bytes = null;
      }
      if (!bytes) continue;
      st.text = latin1(bytes);
      if (/\/Type\s*\/ObjStm\b/.test(d)) {
        const first = +((/\/First\s+(\d+)/.exec(d) || [])[1] || 0);
        const head = st.text.slice(0, first).trim().split(/\s+/).map(Number);
        for (let i = 0; i + 1 < head.length; i += 2) {
          const o = first + head[i + 1], o2 = i + 3 < head.length ? first + head[i + 3] : st.text.length;
          objText.set(head[i], st.text.slice(o, o2));
        }
        st.text = null;
      } else if (/\/Type\s*\/Metadata\b|\/Subtype\s*\/XML\b/.test(d) || /^\s*%/.test(st.text.slice(0, 64))) {
        extraText.push(st.text);          // XMP or Illustrator private data
        st.private = /^\s*%/.test(st.text.slice(0, 64));
      }
    }
    // 3) pages
    const pages = [], pagesNodes = [];
    for (const [n, t] of objText) {
      if (/\/Type\s*\/Page(?![a-zA-Z])/.test(t)) pages.push({ n, t });
      else if (/\/Type\s*\/Pages\b/.test(t)) pagesNodes.push(t);
    }
    const r = { kind: 'pdf', pages: pages.length || null, page: null, evidence: [] };
    if (pages.length) {
      const p = pages[0].t;
      let b = null, used = '';
      for (const k of ['TrimBox', 'CropBox', 'MediaBox']) { b = box(p, k); if (b) { used = k; break; } }
      if (!b) for (const pn of pagesNodes) { b = box(pn, 'MediaBox'); if (b) { used = 'MediaBox (Pages)'; break; } }
      const rot = +((/\/Rotate\s+(-?\d+)/.exec(p) || [])[1] || 0);
      if (b) {
        if (Math.abs(rot) % 180 === 90) b = { w: b.h, h: b.w };
        r.page = { wPt: b.w, hPt: b.h, box: used };
      }
    }
    // 4) metadata & private data
    const meta = s.match(/<x:xmpmeta[\s\S]*?<\/x:xmpmeta>/g) || [];
    for (const t of extraText) { const mm = t.match(/<x:xmpmeta[\s\S]*?<\/x:xmpmeta>/g); if (mm) meta.push(...mm); }
    const xmp = meta.join('\n');
    const priv = extraText.filter(t => /^\s*%/.test(t.slice(0, 64))).join('\n') + '\n' + latin1(u8, 0, Math.min(u8.length, 4096));
    const infoText = [...objText.values()].join('\n');
    const creator = (/<xmp:CreatorTool>([^<]*)</.exec(xmp) || /xmp:CreatorTool="([^"]*)"/.exec(xmp) || [])[1]
      || (/%%Creator:\s*([^\r\n]*)/.exec(priv) || [])[1]
      || (/\/Creator\s*\(([^)]*)\)/.exec(infoText) || [])[1] || '';
    r.creator = creator.trim();
    r.isIllustrator = /Illustrator/i.test(creator) || /<illustrator:/i.test(xmp) || /%AI\d+_/.test(priv) || /\/Creator\s*\(Adobe Illustrator/i.test(infoText);
    const np = /<xmpTPg:NPages>(\d+)</.exec(xmp);
    r.xmpPages = np ? +np[1] : null;
    const ms = /<xmpTPg:MaxPageSize[\s\S]*?<stDim:w>([\d.]+)<\/stDim:w>[\s\S]*?<stDim:h>([\d.]+)<\/stDim:h>[\s\S]*?<stDim:unit>(\w+)</.exec(xmp)
      || /<xmpTPg:MaxPageSize[^>]*stDim:w="([\d.]+)"[^>]*stDim:h="([\d.]+)"[^>]*stDim:unit="(\w+)"/.exec(xmp);
    if (ms) {
      const unit = { Millimeters: 'mm', Points: 'pt', Pixels: 'px', Inches: 'in', Centimeters: 'cm', Picas: 'pc' }[ms[3]] || null;
      if (unit) r.xmpSize = { wPt: +ms[1] * UNIT_TO_PT[unit], hPt: +ms[2] * UNIT_TO_PT[unit], unit };
    }
    if (!r.page && r.xmpSize) r.page = { wPt: r.xmpSize.wPt, hPt: r.xmpSize.hPt, box: 'XMP' };
    // 5) colour votes
    const vote = { CMYK: 0, RGB: 0 };
    const add = (mode, w, why) => { vote[mode] += w; r.evidence.push((mode === 'CMYK' ? 'CMYK' : 'RGB') + ' +' + w + ': ' + why); };
    const cm = /%AI9_ColorModel:\s*(\d)/.exec(priv);
    if (cm) { if (cm[1] === '2') add('CMYK', 3, 'AI9_ColorModel 2'); else if (cm[1] === '1') add('RGB', 3, 'AI9_ColorModel 1'); }
    if (/%%CMYKProcessColor:/.test(priv)) add('CMYK', 2, 'CMYKProcessColor');
    else if (/%%RGBProcessColor:/.test(priv)) add('RGB', 2, 'RGBProcessColor');
    const modes = (xmp.match(/xmpG:mode(?:>|=")(\w+)/g) || []).map(x => x.replace(/xmpG:mode(?:>|=")/, ''));
    const mc = modes.filter(x => x === 'CMYK').length, mr = modes.filter(x => x === 'RGB').length;
    if (mc + mr >= 2 && mc !== mr) add(mc > mr ? 'CMYK' : 'RGB', 2, 'XMP swatches ' + mc + '/' + mr);
    const grp = infoText.match(/\/Group\s*<<[^>]*\/CS\s*\/Device(CMYK|RGB)/g) || [];
    for (const g of grp.slice(0, 1)) add(/CMYK/.test(g) ? 'CMYK' : 'RGB', 1, 'page group');
    // 6) drawing operators: page contents + forms
    const contentIds = new Set();
    for (const p of pages) {
      const cm2 = /\/Contents\s*(\[[^\]]*\]|\d+\s+\d+\s+R)/.exec(p.t);
      if (cm2) for (const x of cm2[1].matchAll(/(\d+)\s+\d+\s+R/g)) contentIds.add(+x[1]);
    }
    for (const [n, st] of streams) if (/\/Subtype\s*\/Form\b/.test(st.dict)) contentIds.add(n);
    const art = { objects: new Set(), fills: new Set(), strokes: 0, comp: { 4: 0, 3: 0, 1: 0 }, ops: 0, decoded: 0 };
    for (const id of contentIds) {
      const st = streams.get(id);
      if (!st || !st.text || st.private) continue;
      art.decoded++;
      scanContent(st.text, art);
    }
    r.contentStreams = contentIds.size;
    r.decodedStreams = art.decoded;
    if (contentIds.size && !art.decoded) r.evidence.push('content not decoded');
    r.objects = art.decoded || !contentIds.size ? art.objects.size : null;
    r.fills = [...art.fills];
    r.strokes = art.strokes;
    const c4 = art.comp[4], c3 = art.comp[3];
    if (c4 + c3 > 0 && c4 !== c3) add(c4 > c3 ? 'CMYK' : 'RGB', vote.CMYK + vote.RGB ? 1 : 2, 'content ' + c4 + '×CMYK/' + c3 + '×RGB');
    r.colorMode = vote.CMYK > vote.RGB ? 'CMYK' : vote.RGB > vote.CMYK ? 'RGB' : null;
    r.vote = vote;
    return r;
  }

  /* minimal content-stream interpreter: colours, paint operators, paths */
  function scanContent(t, art) {
    const st = { fill: 'g:0', fillN: 1, stroke: 'g:0', strokeN: 1, ctm: '' };
    const stack = [];
    let ops = [], path = '';
    const n = t.length;
    let i = 0;
    const key = (vals) => vals.map(v => Math.round(v * 100) / 100).join(',');
    const paint = (fill, stroke) => {
      const k = st.ctm + '|' + path;
      if (path) art.objects.add(k);
      if (fill) { art.fills.add(st.fill); art.comp[st.fillN] = (art.comp[st.fillN] || 0) + 1; }
      if (stroke) { art.strokes++; art.comp[st.strokeN] = (art.comp[st.strokeN] || 0) + 1; }
      path = '';
    };
    while (i < n) {
      const c = t[i];
      if (c === '%') { while (i < n && t[i] !== '\n' && t[i] !== '\r') i++; continue; }
      if (c <= ' ') { i++; continue; }
      if (c === '(') {                    // literal string
        let depth = 1; i++;
        while (i < n && depth) { const d = t[i]; if (d === '\\') i++; else if (d === '(') depth++; else if (d === ')') depth--; i++; }
        ops.push(null); continue;
      }
      if (c === '<' && t[i + 1] === '<') { i += 2; ops.push(null); continue; }
      if (c === '>' && t[i + 1] === '>') { i += 2; continue; }
      if (c === '<') { const e = t.indexOf('>', i); i = e < 0 ? n : e + 1; ops.push(null); continue; }
      if (c === '[' || c === ']' || c === '{' || c === '}') { i++; continue; }
      if (c === '/') { let j = i + 1; while (j < n && !/[\s/\[\]()<>{}%]/.test(t[j])) j++; ops.push({ name: t.slice(i + 1, j) }); i = j; continue; }
      let j = i;
      while (j < n && !/[\s/\[\]()<>{}%]/.test(t[j])) j++;
      if (j === i) { i++; continue; }
      const tok = t.slice(i, j); i = j;
      if (/^[-+]?(\d+\.?\d*|\.\d+)$/.test(tok)) { ops.push(+tok); continue; }
      const nums = () => { const a = []; for (let k = ops.length - 1; k >= 0 && typeof ops[k] === 'number'; k--) a.unshift(ops[k]); return a; };
      switch (tok) {
        case 'q': stack.push(Object.assign({}, st)); break;
        case 'Q': if (stack.length) Object.assign(st, stack.pop()); break;
        case 'cm': st.ctm += key(nums().slice(-6)) + ';'; break;
        case 'k': st.fill = 'cmyk:' + key(nums().slice(-4)); st.fillN = 4; break;
        case 'K': st.stroke = 'cmyk:' + key(nums().slice(-4)); st.strokeN = 4; break;
        case 'rg': st.fill = 'rgb:' + key(nums().slice(-3)); st.fillN = 3; break;
        case 'RG': st.stroke = 'rgb:' + key(nums().slice(-3)); st.strokeN = 3; break;
        case 'g': st.fill = 'g:' + key(nums().slice(-1)); st.fillN = 1; break;
        case 'G': st.stroke = 'g:' + key(nums().slice(-1)); st.strokeN = 1; break;
        case 'cs': case 'CS': {
          const nm = ops[ops.length - 1] && ops[ops.length - 1].name;
          const comp = nm === 'DeviceCMYK' ? 4 : nm === 'DeviceRGB' ? 3 : nm === 'DeviceGray' ? 1 : 0;
          if (tok === 'cs' && comp) st.fillN = comp;
          if (tok === 'CS' && comp) st.strokeN = comp;
          break;
        }
        case 'sc': case 'scn': case 'SC': case 'SCN': {
          const v = nums(), last = ops[ops.length - 1];
          const isName = last && typeof last === 'object' && last.name;
          const val = isName ? 'pat:' + last.name : (v.length === 4 ? 'cmyk:' : v.length === 3 ? 'rgb:' : 'c' + v.length + ':') + key(v);
          const comp = isName ? 0 : v.length;
          if (tok === 'sc' || tok === 'scn') { st.fill = val; st.fillN = comp; } else { st.stroke = val; st.strokeN = comp; }
          break;
        }
        case 'm': case 'l': case 'c': case 'v': case 'y': case 're': case 'h':
          path += key(nums()) + tok; break;
        case 'f': case 'F': case 'f*': paint(true, false); break;
        case 'S': case 's': paint(false, true); break;
        case 'B': case 'B*': case 'b': case 'b*': paint(true, true); break;
        case 'n': path = ''; break;
        case 'sh': art.objects.add('sh|' + st.ctm + (ops[ops.length - 1] && ops[ops.length - 1].name)); break;
        case 'ET': art.objects.add('text|' + st.ctm + '|' + art.objects.size); art.fills.add(st.fill); break;
        case 'BI': { const e = t.indexOf('EI', i); i = e < 0 ? n : e + 2; break; }
        default: break;
      }
      ops = [];
      art.ops++;
    }
  }

  /* ---------- SVG ---------- */
  function svgLen(v) {
    if (v == null) return null;
    const m = /^\s*([\d.]+)\s*(px|pt|mm|cm|in|pc)?\s*$/.exec(v);
    if (!m) return null;
    return +m[1] * (m[2] ? UNIT_TO_PT[m[2]] * (m[2] === 'px' ? 1 : 96 / 72) : 1);   // → px (CSS: 1in = 96px)
  }
  function normColor(c) {
    if (!c) return null;
    c = c.trim().toLowerCase();
    if (c === 'none' || c === 'transparent') return 'none';
    let m = /^#([0-9a-f])([0-9a-f])([0-9a-f])$/.exec(c);
    if (m) return '#' + m[1] + m[1] + m[2] + m[2] + m[3] + m[3];
    m = /^rgba?\(\s*(\d+)[,\s]+(\d+)[,\s]+(\d+)/.exec(c);
    if (m) return '#' + [m[1], m[2], m[3]].map(x => (+x).toString(16).padStart(2, '0')).join('');
    if (/^url\(/.test(c)) return 'gradient';
    return c;
  }
  function parseSvg(text) {
    const r = { kind: 'svg', evidence: [] };
    let doc;
    try { doc = new DOMParser().parseFromString(text, 'image/svg+xml'); } catch (e) { r.kind = 'bad-svg'; return r; }
    const root = doc.documentElement;
    if (!root || root.nodeName.toLowerCase() !== 'svg' || doc.getElementsByTagName('parsererror').length) { r.kind = 'bad-svg'; return r; }
    const vb = (root.getAttribute('viewBox') || '').trim().split(/[\s,]+/).map(Number);
    const vw = vb.length === 4 && vb.every(Number.isFinite) ? vb[2] : null, vh = vw != null ? vb[3] : null;
    const w = svgLen(root.getAttribute('width')), hgt = svgLen(root.getAttribute('height'));
    r.svgSize = vw != null ? { w: vw, h: vh, from: 'viewBox' } : (w && hgt ? { w, h: hgt, from: 'width/height' } : null);
    r.page = r.svgSize ? { wPx: r.svgSize.w, hPx: r.svgSize.h, box: r.svgSize.from } : null;
    r.isIllustrator = /Generator:\s*Adobe Illustrator/i.test(text) || /data-name=/.test(text) || null;
    // class rules
    const rules = {};
    for (const st of root.getElementsByTagName('style')) {
      for (const m of st.textContent.matchAll(/([^{}]+)\{([^}]*)\}/g)) {
        const decl = {};
        for (const d of m[2].split(';')) { const [k, ...v] = d.split(':'); if (k && v.length) decl[k.trim().toLowerCase()] = v.join(':').trim(); }
        for (const sel of m[1].split(',')) { const cm = /^\s*\.([\w-]+)\s*$/.exec(sel); if (cm) rules[cm[1]] = Object.assign(rules[cm[1]] || {}, decl); }
      }
    }
    const SKIP = new Set(['defs', 'clippath', 'mask', 'symbol', 'pattern', 'marker', 'lineargradient', 'radialgradient', 'style', 'title', 'desc', 'metadata']);
    const SHAPES = new Set(['rect', 'circle', 'ellipse', 'path', 'polygon', 'polyline', 'line', 'text']);
    const fills = new Set(); let objects = 0, strokes = 0;
    const prop = (el, name, inh) => {
      let v = null;
      for (const cls of (el.getAttribute('class') || '').split(/\s+/)) if (rules[cls] && rules[cls][name] != null) v = rules[cls][name];
      const a = el.getAttribute(name); if (a != null) v = a;
      const sm = new RegExp('(?:^|;)\\s*' + name + '\\s*:\\s*([^;]+)').exec(el.getAttribute('style') || ''); if (sm) v = sm[1];
      return v != null ? v : inh;
    };
    (function walk(el, inhFill, inhStroke) {
      for (const ch of el.children) {
        const tag = ch.nodeName.toLowerCase().replace(/^svg:/, '');
        if (SKIP.has(tag)) continue;
        const f = prop(ch, 'fill', inhFill), s = prop(ch, 'stroke', inhStroke);
        if (SHAPES.has(tag)) {
          objects++;
          const nf = normColor(f || '#000000');
          if (nf !== 'none') fills.add(nf);
          const ns = normColor(s || 'none');
          if (ns && ns !== 'none') strokes++;
        }
        walk(ch, f, s);
      }
    })(root, null, null);
    r.objects = objects; r.fills = [...fills]; r.strokes = strokes;
    r.colorMode = 'RGB';
    r.pages = 1;
    return r;
  }

  /* ---------- entry ---------- */
  async function analyze(file) {
    const buf = await file.arrayBuffer();
    const u8 = new Uint8Array(buf);
    const head = latin1(u8, 0, Math.min(u8.length, 1024));
    const ext = (/\.([a-z0-9]+)$/i.exec(file.name || '') || [])[1];
    const base = { name: file.name, size: file.size, ext: ext ? ext.toLowerCase() : '', hash: await sha(buf) };
    let r;
    try {
      if (/%PDF-\d/.test(head)) r = await parsePdf(u8, latin1(u8));
      else if (/^\s*(<\?xml|<svg|<!--|<!DOCTYPE svg)/i.test(new TextDecoder('utf-8').decode(u8.subarray(0, 512)).replace(/^﻿/, ''))) r = parseSvg(new TextDecoder('utf-8').decode(u8));
      else if (/^%!PS-Adobe/.test(head)) {
        const t = latin1(u8, 0, Math.min(u8.length, 200000));
        const cm = /%AI9_ColorModel:\s*(\d)/.exec(t);
        r = { kind: 'ai-ps', isIllustrator: /Illustrator/.test(t), colorMode: cm ? (cm[1] === '2' ? 'CMYK' : 'RGB') : (/%%CMYKProcessColor/.test(t) ? 'CMYK' : /%%RGBProcessColor/.test(t) ? 'RGB' : null), page: null, objects: null, evidence: ['PostScript-only .ai'] };
      } else r = { kind: 'other', evidence: [] };
    } catch (e) {
      r = { kind: 'error', error: String(e && e.message || e), evidence: [] };
    }
    return Object.assign(base, r);
  }

  /* ---------- evaluation against a task spec ---------- */
  const fmt1 = v => (Math.round(v * 10) / 10).toString().replace('.', ',');
  const PLURAL = (n, a, b, c) => { const m10 = n % 10, m100 = n % 100; return n + ' ' + (m10 === 1 && m100 !== 11 ? a : m10 >= 2 && m10 <= 4 && (m100 < 10 || m100 >= 20) ? b : c); };

  function evaluate(rep, spec, fileName) {
    const checks = [];
    const add = (id, label, st, detail, hint) => checks.push({ id, label, st, detail: detail || '', hint: st === 'ok' ? '' : (hint || '') });
    const formats = spec.formats || ['pdf', 'ai'];
    const ext = rep.ext;
    const kindOk = (rep.kind === 'pdf' && (ext === 'pdf' || ext === 'ai') && formats.includes(ext))
      || (rep.kind === 'svg' && ext === 'svg' && formats.includes('svg'))
      || (rep.kind === 'ai-ps' && ext === 'ai' && formats.includes('ai'));
    const wantTxt = formats.map(f => f.toUpperCase()).join(' або ');
    add('format', 'Формат файлу: ' + wantTxt, kindOk ? 'ok' : 'bad',
      kindOk ? (ext.toUpperCase() + ', ' + Math.ceil(rep.size / 1024) + ' КіБ') : (rep.kind === 'other' || rep.kind === 'error' || rep.kind === 'bad-svg' ? 'Файл не вдалося прочитати як ' + wantTxt + '.' : 'Отримано ' + (ext || '?').toUpperCase() + '.'),
      formats.includes('svg') ? 'Експортуй: Файл › Експорт › Експортувати як… → тип SVG.' : 'Збережи: Файл › Зберегти як… → Тип файлу: Adobe PDF. Не перейменовуй файл вручну.');
    if (spec.prefix) {
      const nm = (fileName || rep.name || '').normalize('NFC');
      const ok = nm.toLowerCase().startsWith(spec.prefix.toLowerCase()) && nm.replace(/\.[^.]*$/, '').length >= spec.prefix.length + 2;
      add('name', 'Назва файлу: ' + spec.prefix + 'Прізвище', ok ? 'ok' : 'bad', nm, 'Назви файл, наприклад, ' + spec.prefix + 'Petrenko.' + (formats[0]) + ' — так учитель знайде твою роботу.');
    }
    const dead = !kindOk;
    const skip = (id, label) => add(id, label, 'bad', 'Спершу потрібен правильний формат файлу.', '');
    if (spec.illustrator) {
      if (dead) skip('ai', 'Створено в Adobe Illustrator');
      else add('ai', 'Створено в Adobe Illustrator', rep.isIllustrator ? 'ok' : rep.isIllustrator === false ? 'bad' : 'unk',
        rep.creator ? 'Програма: ' + rep.creator : (rep.isIllustrator ? '' : 'Ознак Illustrator не знайдено.'), 'Створи й збережи файл саме в Illustrator.');
    }
    if (spec.size) {
      const { w, h, unit, tol } = spec.size;
      const label = 'Розмір: ' + w + ' × ' + h + ' ' + (unit === 'mm' ? 'мм' : 'px');
      if (dead) skip('size', label);
      else if (!rep.page) add('size', label, 'unk', 'Розмір сторінки не знайдено.', 'Покажи файл учителеві.');
      else {
        const gw = unit === 'mm' ? (rep.page.wPt != null ? rep.page.wPt * MM_PER_PT : null) : (rep.page.wPx != null ? rep.page.wPx : rep.page.wPt);
        const gh = unit === 'mm' ? (rep.page.hPt != null ? rep.page.hPt * MM_PER_PT : null) : (rep.page.hPx != null ? rep.page.hPx : rep.page.hPt);
        if (gw == null) add('size', label, 'unk', 'Розмір не вдалося визначити.', 'Покажи файл учителеві.');
        else {
          const t = tol != null ? tol : (unit === 'mm' ? 1.5 : 1);
          const same = Math.abs(gw - w) <= t && Math.abs(gh - h) <= t;
          const swapped = Math.abs(gw - h) <= t && Math.abs(gh - w) <= t;
          const got = fmt1(gw) + ' × ' + fmt1(gh) + ' ' + (unit === 'mm' ? 'мм' : 'px');
          const sizeOk = spec.orientation ? (same || swapped) : same;
          add('size', label, sizeOk ? 'ok' : 'bad', 'У файлі: ' + got,
            rep.kind === 'svg' ? 'Створи документ ' + w + '×' + h + ' px і під час експорту увімкни «Використовувати монтажні області».'
              : 'Створи новий документ із розміром ' + w + '×' + h + ' мм (або зміни монтажну область: інструмент «Монтажна область», Shift+O).');
          if (spec.orientation) {
            const lbl = 'Орієнтація: ' + (spec.orientation === 'portrait' ? 'книжкова' : 'альбомна');
            if (!sizeOk) add('orient', lbl, 'bad', 'Спершу потрібен правильний розмір.', '');
            else {
              const isPortrait = gh >= gw;
              const ok = (spec.orientation === 'portrait') === isPortrait;
              add('orient', lbl, ok ? 'ok' : 'bad', isPortrait ? 'Книжкова (вертикальна).' : 'Альбомна (горизонтальна).', 'У вікні «Створити документ» обери вертикальну (книжкову) орієнтацію.');
            }
          }
        }
      }
    }
    if (spec.color) {
      const label = 'Колірний режим: ' + spec.color;
      if (dead) skip('color', label);
      else if (!rep.colorMode) add('color', label, 'unk', 'Колірний режим не вдалося визначити.', 'Покажи учителеві вкладку документа: там написано (CMYK/…) або (RGB/…).');
      else add('color', label, rep.colorMode === spec.color ? 'ok' : 'bad', 'У файлі: ' + rep.colorMode,
        spec.color === 'CMYK' ? 'Для друку потрібен CMYK: Файл › Колірний режим документа › Колір CMYK. Потім збережи PDF ще раз.'
          : 'Для вебу потрібен RGB: Файл › Колірний режим документа › Колір RGB.');
    }
    if (spec.artboards) {
      const label = spec.artboards === 1 ? 'Одна монтажна область' : 'Монтажних областей: ' + spec.artboards;
      const n = rep.xmpPages || rep.pages;
      if (dead) skip('boards', label);
      else if (!n) add('boards', label, 'unk', '', 'Покажи файл учителеві.');
      else add('boards', label, n === spec.artboards ? 'ok' : 'bad', 'У файлі: ' + PLURAL(n, 'сторінка', 'сторінки', 'сторінок'), 'Залиш лише одну монтажну область або збережи PDF тільки з першою.');
    }
    if (spec.minObjects) {
      const label = spec.minObjects === 1 ? 'Є хоча б один об’єкт' : 'Об’єктів: щонайменше ' + spec.minObjects;
      if (dead) skip('objects', label);
      else if (rep.objects == null) add('objects', label, 'unk', 'Об’єкти не вдалося порахувати.', 'Покажи файл учителеві.');
      else add('objects', label, rep.objects >= spec.minObjects ? 'ok' : 'bad', 'Знайдено: ' + rep.objects,
        rep.objects === 0 ? 'Документ порожній: намалюй фігуру з заливкою на монтажній області й збережи ще раз.' : 'Додай фігури, яких бракує, і збережи ще раз.');
    }
    if (spec.minFills) {
      const label = 'Різних кольорів заливки: щонайменше ' + spec.minFills;
      const n = rep.fills ? rep.fills.length : null;
      if (dead) skip('fills', label);
      else if (n == null) add('fills', label, 'unk', '', 'Покажи файл учителеві.');
      else add('fills', label, n >= spec.minFills ? 'ok' : 'bad', 'Знайдено: ' + n, 'Виділи фігуру й обери інший колір заливки (панель «Властивості» › Заливка).');
    }
    if (spec.needStroke) {
      const label = 'Є обведення (stroke)';
      if (dead) skip('stroke', label);
      else if (rep.strokes == null) add('stroke', label, 'unk', '', 'Покажи файл учителеві.');
      else add('stroke', label, rep.strokes > 0 ? 'ok' : 'bad', rep.strokes > 0 ? 'Знайдено.' : 'Обведення немає.', 'Виділи корпус і задай колір обведення та товщину 3 pt.');
    }
    const total = checks.length;
    const okN = checks.filter(c => c.st === 'ok').length;
    return { checks, score: total ? Math.round(100 * okN / total) : 0, okN, total };
  }

  /* compact evidence for the teacher (stored in details) */
  function summary(rep) {
    const o = { kind: rep.kind, cm: rep.colorMode || null, obj: rep.objects == null ? null : rep.objects, fills: rep.fills ? rep.fills.length : null, strokes: rep.strokes == null ? null : rep.strokes };
    if (rep.page) o.page = rep.page.wPt != null ? [Math.round(rep.page.wPt * MM_PER_PT * 10) / 10, Math.round(rep.page.hPt * MM_PER_PT * 10) / 10, 'mm'] : [Math.round(rep.page.wPx), Math.round(rep.page.hPx), 'px'];
    if (rep.creator) o.creator = String(rep.creator).slice(0, 60);
    if (rep.evidence && rep.evidence.length) o.ev = rep.evidence.slice(0, 6).map(x => String(x).slice(0, 60));
    return o;
  }

  window.AiFileAnalyzer = { version: '1.0.0', analyze, evaluate, summary, _scanContent: scanContent };
})();
