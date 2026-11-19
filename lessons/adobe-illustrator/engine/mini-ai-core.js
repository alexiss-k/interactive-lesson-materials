/* Mini-Illustrator core: path model, geometry, raster booleans (Pathfinder / Shape Builder),
   vectorization back to Bézier paths, and picture comparison for scoring.
   Classic script, no dependencies. Exposes window.MiniAICore. */
(() => {
  'use strict';
  if (window.MiniAICore) return;

  const W = 600, H = 420;          // artboard in document units
  const S = 2;                      // raster grid: 2 cells per unit
  const GW = W * S, GH = H * S;
  const K = 0.5523;                 // circle handle ratio

  /* ---------------- model ----------------
     obj = { id, sp:[{ a:[{x,y,i:{x,y}|null,o:{x,y}|null}], c:bool }], f:'#hex'|null, s:'#hex'|null, w:number, g:null|'gN', k:'rect'|'ellipse'|'pen'|'pf'|'sb'|'start' } */
  const r1 = v => Math.round(v * 10) / 10;
  const pt = (x, y) => ({ x, y });
  const anchor = (x, y, i, o) => ({ x, y, i: i || null, o: o || null });
  const clone = o => JSON.parse(JSON.stringify(o));

  function rectPath(x, y, w, h) {
    if (w < 0) { x += w; w = -w; }
    if (h < 0) { y += h; h = -h; }
    return { a: [anchor(x, y), anchor(x + w, y), anchor(x + w, y + h), anchor(x, y + h)], c: true };
  }
  function ellipsePath(cx, cy, rx, ry) {
    rx = Math.abs(rx); ry = Math.abs(ry);
    const kx = K * rx, ky = K * ry;
    return { c: true, a: [
      anchor(cx, cy - ry, pt(cx - kx, cy - ry), pt(cx + kx, cy - ry)),
      anchor(cx + rx, cy, pt(cx + rx, cy - ky), pt(cx + rx, cy + ky)),
      anchor(cx, cy + ry, pt(cx + kx, cy + ry), pt(cx - kx, cy + ry)),
      anchor(cx - rx, cy, pt(cx - rx, cy + ky), pt(cx - rx, cy - ky))
    ] };
  }
  /* Absolute M/L/C/Z parser → subpaths */
  function parseD(d) {
    const tok = String(d).match(/[MLCZ]|-?\d*\.?\d+(?:e-?\d+)?/gi) || [];
    const out = [];
    let cur = null, i = 0, cmd = null;
    const num = () => parseFloat(tok[i++]);
    const same = (p, q) => Math.abs(p.x - q.x) < 0.01 && Math.abs(p.y - q.y) < 0.01;
    while (i < tok.length) {
      if (/^[MLCZ]$/i.test(tok[i])) cmd = tok[i++].toUpperCase();
      if (cmd === 'M') { cur = { a: [anchor(num(), num())], c: false }; out.push(cur); cmd = 'L'; }
      else if (cmd === 'L') cur.a.push(anchor(num(), num()));
      else if (cmd === 'C') {
        const c1 = pt(num(), num()), c2 = pt(num(), num()), p = pt(num(), num());
        const prev = cur.a[cur.a.length - 1];
        if (!same(c1, prev)) prev.o = c1;
        const first = cur.a[0];
        const closing = tok[i] && /^z$/i.test(tok[i]) && same(p, first) && cur.a.length > 1;
        if (closing) { if (!same(c2, p)) first.i = c2; }
        else cur.a.push(anchor(p.x, p.y, same(c2, p) ? null : c2, null));
      } else if (cmd === 'Z') {
        cur.c = true;
        const f = cur.a[0], l = cur.a[cur.a.length - 1];
        if (cur.a.length > 1 && same(f, l) && !l.o && !l.i) cur.a.pop();
        cmd = null;
      } else i++;
    }
    return out;
  }

  function segD(a, b) {
    if (a.o || b.i) {
      const c1 = a.o || a, c2 = b.i || b;
      return ` C${r1(c1.x)},${r1(c1.y)} ${r1(c2.x)},${r1(c2.y)} ${r1(b.x)},${r1(b.y)}`;
    }
    return ` L${r1(b.x)},${r1(b.y)}`;
  }
  function spD(sp) {
    const A = sp.a;
    if (!A.length) return '';
    let d = `M${r1(A[0].x)},${r1(A[0].y)}`;
    for (let i = 0; i < A.length - 1; i++) d += segD(A[i], A[i + 1]);
    if (sp.c && A.length > 1) d += segD(A[A.length - 1], A[0]) + ' Z';
    return d;
  }
  const toD = obj => obj.sp.map(spD).join(' ');
  const isClosed = obj => obj.sp.length > 0 && obj.sp.every(s => s.c && s.a.length > 2);
  const anchorsOf = obj => obj.sp.reduce((n, s) => n + s.a.length, 0);
  const hasHandle = a => (a.i && Math.hypot(a.i.x - a.x, a.i.y - a.y) > 0.5) || (a.o && Math.hypot(a.o.x - a.x, a.o.y - a.y) > 0.5);
  const hasCurve = obj => obj.sp.some(s => s.a.some(hasHandle));
  const cornerCount = obj => obj.sp.reduce((n, s) => n + s.a.filter(a => !(a.i && a.o)).length, 0);

  function eachPoint(obj, fn) {
    for (const s of obj.sp) for (const a of s.a) { fn(a); if (a.i) fn(a.i); if (a.o) fn(a.o); }
  }
  function translate(obj, dx, dy) {
    eachPoint(obj, p => { p.x += dx; p.y += dy; });
    return obj;
  }

  /* exact geometric bounds (cubic extrema) */
  function cubicExt(p0, p1, p2, p3, out) {
    const a = -p0 + 3 * p1 - 3 * p2 + p3, b = 2 * (p0 - 2 * p1 + p2), c = p1 - p0;
    const ts = [];
    if (Math.abs(a) < 1e-9) { if (Math.abs(b) > 1e-9) ts.push(-c / b); }
    else {
      const disc = b * b - 4 * a * c;
      if (disc >= 0) { const q = Math.sqrt(disc); ts.push((-b + q) / (2 * a), (-b - q) / (2 * a)); }
    }
    for (const t of ts) if (t > 0 && t < 1) {
      const m = 1 - t;
      out.push(m * m * m * p0 + 3 * m * m * t * p1 + 3 * m * t * t * p2 + t * t * t * p3);
    }
  }
  function bbox(objs) {
    const xs = [], ys = [];
    for (const obj of [].concat(objs)) for (const s of obj.sp) {
      const A = s.a, n = A.length;
      A.forEach(a => { xs.push(a.x); ys.push(a.y); });
      const segs = s.c ? n : n - 1;
      for (let k = 0; k < segs; k++) {
        const a = A[k], b = A[(k + 1) % n];
        if (!a.o && !b.i) continue;
        const c1 = a.o || a, c2 = b.i || b;
        cubicExt(a.x, c1.x, c2.x, b.x, xs);
        cubicExt(a.y, c1.y, c2.y, b.y, ys);
      }
    }
    if (!xs.length) return null;
    const x = Math.min(...xs), y = Math.min(...ys), x2 = Math.max(...xs), y2 = Math.max(...ys);
    return { x, y, x2, y2, w: x2 - x, h: y2 - y, cx: (x + x2) / 2, cy: (y + y2) / 2 };
  }

  /* compact serialization for details */
  function packObj(o) {
    return { id: o.id, f: o.f, s: o.s, w: o.w, g: o.g || null, k: o.k || null,
      sp: o.sp.map(s => ({ c: s.c ? 1 : 0, a: s.a.map(a => {
        const r = [r1(a.x), r1(a.y)];
        if (a.i || a.o) r.push(a.i ? r1(a.i.x) : null, a.i ? r1(a.i.y) : null, a.o ? r1(a.o.x) : null, a.o ? r1(a.o.y) : null);
        return r;
      }) })) };
  }
  function unpackObj(p) {
    return { id: p.id, f: p.f || null, s: p.s || null, w: +p.w || 0, g: p.g || null, k: p.k || null,
      sp: (p.sp || []).map(s => ({ c: !!s.c, a: (s.a || []).map(r => anchor(r[0], r[1],
        r.length > 2 && r[2] != null ? pt(r[2], r[3]) : null,
        r.length > 2 && r[4] != null ? pt(r[4], r[5]) : null)) })) };
  }
  const packDoc = doc => ({ n: doc.n, ops: Object.assign({}, doc.ops), objs: doc.objs.map(packObj) });
  const unpackDoc = p => ({ n: (p && p.n) || 1, ops: Object.assign({ pen: 0, rect: 0, ell: 0, sb: 0, pf: 0, align: 0, group: 0 }, p && p.ops),
    objs: ((p && p.objs) || []).map(unpackObj) });

  /* ---------------- raster fields ---------------- */
  let fieldCanvas = null, fieldCtx = null;
  function fctx() {
    if (!fieldCanvas) {
      fieldCanvas = document.createElement('canvas');
      fieldCanvas.width = GW; fieldCanvas.height = GH;
      fieldCtx = fieldCanvas.getContext('2d', { willReadFrequently: true });
    }
    return fieldCtx;
  }
  /* coverage 0..1 of the object's fill area (fill-rule evenodd), on the GW×GH grid */
  function coverage(obj) {
    const c = fctx();
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.clearRect(0, 0, GW, GH);
    c.setTransform(S, 0, 0, S, 0, 0);
    c.fillStyle = '#000';
    c.fill(new Path2D(toD(obj)), 'evenodd');
    const data = c.getImageData(0, 0, GW, GH).data;
    const F = new Float32Array(GW * GH);
    for (let i = 0, j = 3; i < F.length; i++, j += 4) F[i] = data[j] / 255;
    return F;
  }
  const NF = () => new Float32Array(GW * GH);
  function opUnion(fs) { const R = NF(); for (const F of fs) for (let i = 0; i < R.length; i++) { const v = R[i] + F[i]; R[i] = v > 1 ? 1 : v; } return R; }
  function opMax(fs) { const R = NF(); for (const F of fs) for (let i = 0; i < R.length; i++) if (F[i] > R[i]) R[i] = F[i]; return R; }
  function opIntersect(fs) { const R = Float32Array.from(fs[0]); for (const F of fs.slice(1)) for (let i = 0; i < R.length; i++) if (F[i] < R[i]) R[i] = F[i]; return R; }
  function opMinus(base, cutters) { const R = Float32Array.from(base); for (const F of cutters) for (let i = 0; i < R.length; i++) { const v = 1 - F[i]; if (v < R[i]) R[i] = v; } return R; }
  function opExclude(fs) {
    // odd number of covers ⇒ inside; soft version from coverages
    let R = Float32Array.from(fs[0]);
    for (const F of fs.slice(1)) for (let i = 0; i < R.length; i++) {
      const a = R[i], b = F[i];
      R[i] = Math.max(Math.min(a, 1 - b), Math.min(b, 1 - a));
    }
    return R;
  }

  /* ---------------- marching squares ---------------- */
  const SEG = {
    1: [[3, 0]], 2: [[0, 1]], 3: [[3, 1]], 4: [[1, 2]], 6: [[0, 2]], 7: [[3, 2]], 8: [[2, 3]],
    9: [[0, 2]], 11: [[1, 2]], 12: [[1, 3]], 13: [[0, 1]], 14: [[3, 0]]
  };
  function contours(F, iso) {
    // bounding box of non-zero area
    let x0 = GW, y0 = GH, x1 = -1, y1 = -1;
    for (let y = 0; y < GH; y++) {
      const row = y * GW;
      for (let x = 0; x < GW; x++) if (F[row + x] >= iso) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
    }
    if (x1 < 0) return [];
    const V = (x, y) => (x < 0 || y < 0 || x >= GW || y >= GH) ? 0 : F[y * GW + x];
    const stride = GW + 3;
    const eid = (x, y, vert) => (((y + 1) * stride + (x + 1)) << 1) | (vert ? 1 : 0);
    const pos = new Map();
    const adj = new Map();
    const point = (x, y, vert) => {
      const id = eid(x, y, vert);
      if (!pos.has(id)) {
        const va = V(x, y), vb = vert ? V(x, y + 1) : V(x + 1, y);
        let t = (iso - va) / (vb - va);
        if (!isFinite(t)) t = 0.5;
        t = Math.min(1, Math.max(0, t));
        const gx = vert ? x : x + t, gy = vert ? y + t : y;
        pos.set(id, { x: (gx + 0.5) / S, y: (gy + 0.5) / S });
      }
      return id;
    };
    const link = (a, b) => {
      if (!adj.has(a)) adj.set(a, []);
      if (!adj.has(b)) adj.set(b, []);
      adj.get(a).push(b); adj.get(b).push(a);
    };
    for (let y = y0 - 1; y <= y1; y++) for (let x = x0 - 1; x <= x1; x++) {
      const v0 = V(x, y), v1 = V(x + 1, y), v2 = V(x + 1, y + 1), v3 = V(x, y + 1);
      const c = (v0 >= iso ? 1 : 0) | (v1 >= iso ? 2 : 0) | (v2 >= iso ? 4 : 0) | (v3 >= iso ? 8 : 0);
      if (c === 0 || c === 15) continue;
      const E = [() => point(x, y, false), () => point(x + 1, y, true), () => point(x, y + 1, false), () => point(x, y, true)];
      let segs = SEG[c];
      if (c === 5 || c === 10) {
        const centre = (v0 + v1 + v2 + v3) / 4 >= iso;
        if (c === 5) segs = centre ? [[0, 1], [2, 3]] : [[3, 0], [1, 2]];
        else segs = centre ? [[3, 0], [1, 2]] : [[0, 1], [2, 3]];
      }
      for (const [a, b] of segs) link(E[a](), E[b]());
    }
    const loops = [];
    const used = new Set();
    for (const start of adj.keys()) {
      if (used.has(start)) continue;
      const loop = [];
      let prev = null, cur = start;
      while (cur != null && !used.has(cur)) {
        used.add(cur);
        loop.push(pos.get(cur));
        const nb = adj.get(cur) || [];
        const next = nb[0] !== prev && !used.has(nb[0]) ? nb[0] : (nb[1] !== prev && !used.has(nb[1]) ? nb[1] : null);
        prev = cur; cur = next;
      }
      if (loop.length >= 6 && Math.abs(polyArea(loop)) > 4) loops.push(loop);
    }
    return loops;
  }
  function polyArea(P) {
    let s = 0;
    for (let i = 0, n = P.length; i < n; i++) { const a = P[i], b = P[(i + 1) % n]; s += a.x * b.y - b.x * a.y; }
    return s / 2;
  }

  /* ---------------- curve fitting (Schneider) ---------------- */
  const sub = (a, b) => pt(a.x - b.x, a.y - b.y);
  const add = (a, b) => pt(a.x + b.x, a.y + b.y);
  const mul = (a, k) => pt(a.x * k, a.y * k);
  const dot = (a, b) => a.x * b.x + a.y * b.y;
  const len = a => Math.hypot(a.x, a.y);
  const norm = a => { const l = len(a) || 1; return pt(a.x / l, a.y / l); };
  const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
  function bez(B, t) {
    const m = 1 - t;
    return pt(m * m * m * B[0].x + 3 * m * m * t * B[1].x + 3 * m * t * t * B[2].x + t * t * t * B[3].x,
      m * m * m * B[0].y + 3 * m * m * t * B[1].y + 3 * m * t * t * B[2].y + t * t * t * B[3].y);
  }
  function chordParams(P) {
    const u = [0];
    for (let i = 1; i < P.length; i++) u.push(u[i - 1] + dist(P[i], P[i - 1]));
    const L = u[u.length - 1] || 1;
    return u.map(v => v / L);
  }
  function genBez(P, u, t1, t2) {
    const p0 = P[0], p3 = P[P.length - 1];
    let c00 = 0, c01 = 0, c11 = 0, x0 = 0, x1 = 0;
    for (let i = 0; i < P.length; i++) {
      const t = u[i], m = 1 - t;
      const b0 = m * m * m, b1 = 3 * m * m * t, b2 = 3 * m * t * t, b3 = t * t * t;
      const A1 = mul(t1, b1), A2 = mul(t2, b2);
      c00 += dot(A1, A1); c01 += dot(A1, A2); c11 += dot(A2, A2);
      const tmp = sub(P[i], add(mul(p0, b0 + b1), mul(p3, b2 + b3)));
      x0 += dot(A1, tmp); x1 += dot(A2, tmp);
    }
    const det = c00 * c11 - c01 * c01;
    let a1 = 0, a2 = 0;
    if (Math.abs(det) > 1e-12) { a1 = (x0 * c11 - x1 * c01) / det; a2 = (c00 * x1 - c01 * x0) / det; }
    const segLen = dist(p0, p3), eps = 1e-6 * segLen;
    if (a1 < eps || a2 < eps || a1 > segLen * 3 || a2 > segLen * 3) { a1 = a2 = segLen / 3; }
    return [p0, add(p0, mul(t1, a1)), add(p3, mul(t2, a2)), p3];
  }
  function maxErr(P, B, u) {
    let m = 0, idx = Math.floor(P.length / 2);
    for (let i = 1; i < P.length - 1; i++) { const d = dist(bez(B, u[i]), P[i]); if (d > m) { m = d; idx = i; } }
    return { m, idx };
  }
  function reparam(P, B, u) {
    return u.map((t, i) => {
      const Q1 = [mul(sub(B[1], B[0]), 3), mul(sub(B[2], B[1]), 3), mul(sub(B[3], B[2]), 3)];
      const Q2 = [mul(sub(Q1[1], Q1[0]), 2), mul(sub(Q1[2], Q1[1]), 2)];
      const q = bez(B, t);
      const m = 1 - t;
      const q1 = pt(m * m * Q1[0].x + 2 * m * t * Q1[1].x + t * t * Q1[2].x, m * m * Q1[0].y + 2 * m * t * Q1[1].y + t * t * Q1[2].y);
      const q2 = pt(m * Q2[0].x + t * Q2[1].x, m * Q2[0].y + t * Q2[1].y);
      const num = dot(sub(q, P[i]), q1), den = dot(q1, q1) + dot(sub(q, P[i]), q2);
      const nt = Math.abs(den) < 1e-12 ? t : t - num / den;
      return Math.min(1, Math.max(0, nt));
    });
  }
  function fitCubic(P, t1, t2, err, out, depth) {
    if (P.length === 2) { const d = dist(P[0], P[1]) / 3; out.push([P[0], add(P[0], mul(t1, d)), add(P[1], mul(t2, d)), P[1]]); return; }
    let u = chordParams(P);
    let B = genBez(P, u, t1, t2);
    let e = maxErr(P, B, u);
    if (e.m < err) { out.push(B); return; }
    if (e.m < err * 4) {
      for (let k = 0; k < 6; k++) {
        u = reparam(P, B, u);
        B = genBez(P, u, t1, t2);
        e = maxErr(P, B, u);
        if (e.m < err) { out.push(B); return; }
      }
    }
    if (depth > 12 || P.length < 4) { out.push(B); return; }
    const s = Math.max(1, Math.min(P.length - 2, e.idx));
    const tc = norm(sub(P[s - 1], P[s + 1]));
    fitCubic(P.slice(0, s + 1), t1, tc, err, out, depth + 1);
    fitCubic(P.slice(s), mul(tc, -1), t2, err, out, depth + 1);
  }
  /* point at arc distance d before/after index i along a closed polyline */
  function along(P, i, d, dir) {
    const n = P.length;
    let acc = 0, j = i;
    for (let k = 0; k < n; k++) {
      const nj = (j + dir + n) % n;
      acc += dist(P[j], P[nj]);
      j = nj;
      if (acc >= d) break;
    }
    return P[j];
  }
  function lineFit(P) {
    let mx = 0, my = 0;
    for (const p of P) { mx += p.x; my += p.y; }
    mx /= P.length; my /= P.length;
    let sxx = 0, syy = 0, sxy = 0;
    for (const p of P) { const dx = p.x - mx, dy = p.y - my; sxx += dx * dx; syy += dy * dy; sxy += dx * dy; }
    const ang = 0.5 * Math.atan2(2 * sxy, sxx - syy);
    return { p: pt(mx, my), d: pt(Math.cos(ang), Math.sin(ang)) };
  }
  function intersectLines(L1, L2) {
    const den = L1.d.x * L2.d.y - L1.d.y * L2.d.x;
    if (Math.abs(den) < 1e-6) return null;
    const t = ((L2.p.x - L1.p.x) * L2.d.y - (L2.p.y - L1.p.y) * L2.d.x) / den;
    return add(L1.p, mul(L1.d, t));
  }
  /* closed polyline → closed Bézier subpath */
  function fitLoop(P0, err) {
    // dedupe
    const P = [];
    for (const p of P0) if (!P.length || dist(p, P[P.length - 1]) > 0.05) P.push(p);
    if (P.length > 2 && dist(P[0], P[P.length - 1]) < 0.05) P.pop();
    const n = P.length;
    if (n < 4) return null;
    // corner detection
    const D = 2.5, TH = 50 * Math.PI / 180;
    const ang = P.map((p, i) => {
      const a = along(P, i, D, -1), b = along(P, i, D, 1);
      const v1 = norm(sub(p, a)), v2 = norm(sub(b, p));
      return Math.acos(Math.max(-1, Math.min(1, dot(v1, v2))));
    });
    let corners = [];
    for (let i = 0; i < n; i++) {
      if (ang[i] < TH) continue;
      let isMax = true;
      for (let k = 1; k <= 4 && isMax; k++) {
        const l = ang[(i - k + n) % n], r = ang[(i + k) % n];
        if (l > ang[i] || r > ang[i] || (r === ang[i] && k === 1)) isMax = false;
      }
      if (isMax) corners.push(i);
    }
    // thin out corners that are too close
    corners = corners.filter((c, k) => k === 0 || dist(P[c], P[corners[k - 1]]) > 3);
    const pieces = [];
    if (!corners.length) {
      // smooth loop: split at 0 and at the opposite point, keep tangents continuous
      const h = Math.floor(n / 2);
      const t0 = norm(sub(P[1], P[n - 1])), th = norm(sub(P[h + 1], P[h - 1]));
      pieces.push({ pts: P.slice(0, h + 1), t1: t0, t2: mul(th, -1) });
      pieces.push({ pts: P.slice(h).concat([P[0]]), t1: th, t2: mul(t0, -1) });
    } else {
      for (let k = 0; k < corners.length; k++) {
        const a = corners[k], b = corners[(k + 1) % corners.length];
        const pts = [];
        let j = a;
        do { pts.push(P[j]); j = (j + 1) % n; } while (j !== b);
        pts.push(P[b]);
        if (pts.length < 2) continue;
        const t1 = norm(sub(alongOpen(pts, 0, 1.5), pts[0]));
        const t2 = norm(sub(alongOpen(pts, pts.length - 1, 1.5), pts[pts.length - 1]));
        pieces.push({ pts, t1, t2, corner: true });
      }
    }
    // straight-piece refinement
    const beziers = [];
    pieces.forEach(pc => {
      const ends = [pc.pts[0], pc.pts[pc.pts.length - 1]];
      const mid = pc.corner ? pc.pts.filter(p => dist(p, ends[0]) > 1.6 && dist(p, ends[1]) > 1.6) : [];
      const lf = mid.length > 3 ? lineFit(mid) : null;
      let straight = false;
      if (lf) {
        let m = 0;
        for (const p of mid) { const v = sub(p, lf.p); m = Math.max(m, Math.abs(v.x * lf.d.y - v.y * lf.d.x)); }
        straight = m < 0.3;
      }
      pc.straight = straight; pc.line = lf;
    });
    if (corners.length) {
      // snap corners between two straight pieces to the intersection of the fitted lines
      for (let k = 0; k < pieces.length; k++) {
        const A = pieces[k], B = pieces[(k + 1) % pieces.length];
        if (A.straight && B.straight && A.line && B.line) {
          const X = intersectLines(A.line, B.line);
          if (X && dist(X, B.pts[0]) < 3) { A.pts[A.pts.length - 1] = X; B.pts[0] = X; }
        }
      }
    }
    for (const pc of pieces) {
      if (pc.straight) { beziers.push({ line: true, B: [pc.pts[0], null, null, pc.pts[pc.pts.length - 1]] }); continue; }
      const out = [];
      fitCubic(pc.pts, pc.t1, pc.t2, err, out, 0);
      out.forEach(B => beziers.push({ line: false, B }));
    }
    // to anchors
    const A = [];
    beziers.forEach((bz, k) => {
      const B = bz.B;
      const prev = beziers[(k - 1 + beziers.length) % beziers.length];
      const a = anchor(B[0].x, B[0].y);
      if (!bz.line) a.o = B[1];
      if (!prev.line) a.i = prev.B[2];
      A.push(a);
    });
    // collapse nearly straight curves into lines
    for (let k = 0; k < A.length; k++) {
      const a = A[k], b = A[(k + 1) % A.length];
      if (!a.o || !b.i) continue;
      const ch = sub(b, a), L = len(ch);
      if (L < 1) continue;
      const off = p => { const v = sub(p, a); return Math.abs(v.x * ch.y - v.y * ch.x) / L; };
      if (off(a.o) < 0.3 && off(b.i) < 0.3) { a.o = null; b.i = null; }
    }
    // drop zero-length segments
    const C = A.filter((a, k) => k === 0 || dist(a, A[k - 1]) > 0.05);
    for (const a of C) { a.x = r1(a.x); a.y = r1(a.y); if (a.i) a.i = pt(r1(a.i.x), r1(a.i.y)); if (a.o) a.o = pt(r1(a.o.x), r1(a.o.y)); }
    return C.length >= 2 ? { a: C, c: true } : null;
  }
  function alongOpen(P, i, d) {
    const dir = i === 0 ? 1 : -1;
    let acc = 0, j = i;
    while (j + dir >= 0 && j + dir < P.length) {
      acc += dist(P[j], P[j + dir]);
      j += dir;
      if (acc >= d) break;
    }
    return P[j];
  }
  function vectorize(F, iso) {
    const loops = contours(F, iso == null ? 0.5 : iso);
    const sp = [];
    for (const L of loops) { const s = fitLoop(L, 0.5); if (s) sp.push(s); }
    return sp;
  }

  /* ---------------- Pathfinder ---------------- */
  /* objs in z-order (bottom → top), all closed. Returns { sp, style } or null */
  function pathfinder(op, objs) {
    const fs = objs.map(coverage);
    let F, style;
    const top = objs[objs.length - 1], bottom = objs[0];
    if (op === 'unite') { F = opUnion(fs); style = top; }
    else if (op === 'minus') { F = opMinus(fs[0], fs.slice(1)); style = bottom; }
    else if (op === 'intersect') { F = opIntersect(fs); style = top; }
    else if (op === 'exclude') { F = opExclude(fs); style = top; }
    else return null;
    const sp = vectorize(F, 0.5);
    return sp.length ? { sp, style } : { sp: [], style };
  }

  /* ---------------- Shape Builder regions ---------------- */
  /* objs: closed objects bottom → top (max 24). Returns a region map. */
  function buildRegions(objs) {
    const n = Math.min(objs.length, 24);
    const fs = objs.slice(0, n).map(coverage);
    const N = GW * GH;
    const pat = new Int32Array(N);
    for (let k = 0; k < n; k++) { const F = fs[k], bit = 1 << k; for (let i = 0; i < N; i++) if (F[i] >= 0.5) pat[i] |= bit; }
    // connected components (4-neighbour) of equal non-zero pattern
    const lab = new Int32Array(N);
    const regions = [null];
    const stack = new Int32Array(N);
    for (let i = 0; i < N; i++) {
      if (!pat[i] || lab[i]) continue;
      const id = regions.length, p = pat[i];
      let sp = 0, count = 0, x0 = GW, y0 = GH, x1 = 0, y1 = 0;
      stack[sp++] = i; lab[i] = id;
      while (sp) {
        const j = stack[--sp]; count++;
        const x = j % GW, y = (j - x) / GW;
        if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
        if (x > 0 && !lab[j - 1] && pat[j - 1] === p) { lab[j - 1] = id; stack[sp++] = j - 1; }
        if (x < GW - 1 && !lab[j + 1] && pat[j + 1] === p) { lab[j + 1] = id; stack[sp++] = j + 1; }
        if (y > 0 && !lab[j - GW] && pat[j - GW] === p) { lab[j - GW] = id; stack[sp++] = j - GW; }
        if (y < GH - 1 && !lab[j + GW] && pat[j + GW] === p) { lab[j + GW] = id; stack[sp++] = j + GW; }
      }
      let topIdx = 0;
      for (let k = 0; k < n; k++) if (p & (1 << k)) topIdx = k;
      regions.push({ id, pat: p, count, box: { x0, y0, x1, y1 }, top: topIdx, tiny: count < 12 });
    }
    // attach tiny slivers (antialias leftovers) to nothing — they are ignored
    return { n, fs, lab, regions, objs: objs.slice(0, n) };
  }
  function regionAt(R, x, y) {
    const gx = Math.floor(x * S), gy = Math.floor(y * S);
    if (gx < 0 || gy < 0 || gx >= GW || gy >= GH) return 0;
    const id = R.lab[gy * GW + gx];
    return id && !R.regions[id].tiny ? id : 0;
  }
  /* soft field of one region, limited to its neighbourhood */
  function regionField(R, id) {
    const reg = R.regions[id];
    const F = NF();
    const pad = 3;
    const bx0 = Math.max(0, reg.box.x0 - pad), by0 = Math.max(0, reg.box.y0 - pad);
    const bx1 = Math.min(GW - 1, reg.box.x1 + pad), by1 = Math.min(GH - 1, reg.box.y1 + pad);
    // dilated membership: pixel within 2 cells of the component
    const near = (x, y) => {
      for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
        const xx = x + dx, yy = y + dy;
        if (xx >= 0 && yy >= 0 && xx < GW && yy < GH && R.lab[yy * GW + xx] === id) return true;
      }
      return false;
    };
    for (let y = by0; y <= by1; y++) for (let x = bx0; x <= bx1; x++) {
      const i = y * GW + x;
      if (R.lab[i] !== id && !near(x, y)) continue;
      let v = 1;
      for (let k = 0; k < R.n; k++) {
        const a = R.fs[k][i];
        const t = (reg.pat & (1 << k)) ? a : 1 - a;
        if (t < v) v = t;
      }
      F[i] = v;
    }
    return F;
  }
  function regionShape(R, ids) {
    const F = opUnion(ids.map(id => R.cacheF ? (R.cacheF[id] || (R.cacheF[id] = regionField(R, id))) : regionField(R, id)));
    return vectorize(F, 0.5);
  }

  /* ---------------- picture comparison (scoring) ---------------- */
  const CS = 0.5, CW = W * CS, CH = H * CS;
  let cmpCanvas = null, cmpCtx = null;
  function cctx() {
    if (!cmpCanvas) {
      cmpCanvas = document.createElement('canvas');
      cmpCanvas.width = CW; cmpCanvas.height = CH;
      cmpCtx = cmpCanvas.getContext('2d', { willReadFrequently: true });
    }
    return cmpCtx;
  }
  function paint(objs, tf) {
    const c = cctx();
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.clearRect(0, 0, CW, CH);
    const t = tf || { s: 1, dx: 0, dy: 0 };
    c.setTransform(CS * t.s, 0, 0, CS * t.s, CS * t.dx, CS * t.dy);
    c.lineJoin = 'miter'; c.miterLimit = 10; c.lineCap = 'butt';
    for (const o of objs) {
      const p = new Path2D(toD(o));
      if (o.f) { c.fillStyle = o.f; c.fill(p, 'evenodd'); }
      if (o.s && o.w > 0) { c.strokeStyle = o.s; c.lineWidth = o.w; c.stroke(p); }
    }
    return c.getImageData(0, 0, CW, CH).data;
  }
  function inkBox(data) {
    let x0 = CW, y0 = CH, x1 = -1, y1 = -1, n = 0;
    for (let y = 0; y < CH; y++) for (let x = 0; x < CW; x++) if (data[(y * CW + x) * 4 + 3] > 127) {
      n++; if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
    }
    return x1 < 0 ? null : { x0, y0, x1: x1 + 1, y1: y1 + 1, n };
  }
  /* similarity of two pictures: pixels with the same colour / pixels painted in either.
     opts.normalize: scale & move the student's picture onto the sample's ink box first.
     opts.shapeOnly: ignore colours */
  function compare(objs, target, opts) {
    opts = opts || {};
    const T = paint(target);
    let Sd = paint(objs);
    if (opts.normalize) {
      const bt = inkBox(T), bs = inkBox(Sd);
      if (bt && bs) {
        const s = Math.sqrt(((bt.x1 - bt.x0) * (bt.y1 - bt.y0)) / Math.max(1, (bs.x1 - bs.x0) * (bs.y1 - bs.y0)));
        const cxT = (bt.x0 + bt.x1) / 2 / CS, cyT = (bt.y0 + bt.y1) / 2 / CS;
        const cxS = (bs.x0 + bs.x1) / 2 / CS, cyS = (bs.y0 + bs.y1) / 2 / CS;
        Sd = paint(objs, { s, dx: cxT - cxS * s, dy: cyT - cyS * s });
      }
    }
    let uni = 0, both = 0, same = 0;
    for (let i = 0; i < T.length; i += 4) {
      const a = T[i + 3] > 127, b = Sd[i + 3] > 127;
      if (!a && !b) continue;
      uni++;
      if (a && b) {
        both++;
        const dc = Math.abs(T[i] - Sd[i]) + Math.abs(T[i + 1] - Sd[i + 1]) + Math.abs(T[i + 2] - Sd[i + 2]);
        if (dc < 90) same++;
      }
    }
    if (!uni) return { iou: 0, sim: 0 };
    return { iou: both / uni, sim: (opts.shapeOnly ? both : same) / uni };
  }
  /* silhouette IoU of one object's fill area against a path spec */
  function shapeIoU(obj, targetSp) {
    const a = Object.assign({}, obj, { f: '#000', s: null });
    const b = { sp: targetSp, f: '#000', s: null };
    return compare([a], [b], { shapeOnly: true }).iou;
  }
  /* is a document point covered by any painted object? (topmost colour) */
  function colorAt(objs, x, y) {
    const d = paint(objs);
    const gx = Math.floor(x * CS), gy = Math.floor(y * CS);
    const i = (gy * CW + gx) * 4;
    if (d[i + 3] < 128) return null;
    return '#' + [d[i], d[i + 1], d[i + 2]].map(v => v.toString(16).padStart(2, '0')).join('').toUpperCase();
  }

  /* ---------------- contour distance (pen levels, «полагодь контур») ----------------
     Samples both contours every ~step units and returns the mean / max distance from each
     sample to the nearest sample of the other contour (symmetric). Units = document units. */
  function samples(sps, step) {
    const out = [];
    for (const s of sps) {
      const A = s.a, n = A.length;
      if (!n) continue;
      if (n === 1) { out.push(pt(A[0].x, A[0].y)); continue; }
      const segs = s.c ? n : n - 1;
      for (let k = 0; k < segs; k++) {
        const a = A[k], b = A[(k + 1) % n];
        const c1 = a.o || a, c2 = b.i || b;
        const L = dist(a, c1) + dist(c1, c2) + dist(c2, b);
        const m = Math.max(4, Math.ceil(L / step));
        const B = [a, c1, c2, b];
        for (let j = 0; j < m; j++) out.push(bez(B, j / m));
      }
      if (!s.c) out.push(pt(A[n - 1].x, A[n - 1].y));
    }
    return out;
  }
  function pathDist(spA, spB, step) {
    const A = samples(spA, step || 4), B = samples(spB, step || 4);
    if (!A.length || !B.length) return { avg: Infinity, max: Infinity };
    const one = (P, Q) => {
      let sum = 0, mx = 0;
      for (const p of P) {
        let best = Infinity;
        for (const q of Q) { const dx = p.x - q.x, dy = p.y - q.y, d = dx * dx + dy * dy; if (d < best) best = d; }
        best = Math.sqrt(best); sum += best; if (best > mx) mx = best;
      }
      return { avg: sum / P.length, max: mx };
    };
    const ab = one(A, B), ba = one(B, A);
    return { avg: (ab.avg + ba.avg) / 2, max: Math.max(ab.max, ba.max) };
  }
  /* raster boolean helpers for building target pictures: field of a path spec, back to subpaths */
  const fieldOf = sp => coverage({ sp });

  window.MiniAICore = {
    W, H, S, GW, GH, K, pathDist, fieldOf,
    anchor, pt, clone, rectPath, ellipsePath, parseD, toD, spD, isClosed, anchorsOf, hasCurve, hasHandle, cornerCount,
    translate, bbox, packDoc, unpackDoc, packObj, unpackObj,
    coverage, opUnion, opMax, opIntersect, opMinus, opExclude, contours, vectorize, fitLoop,
    pathfinder, buildRegions, regionAt, regionField, regionShape,
    paint, compare, shapeIoU, colorAt
  };
})();
