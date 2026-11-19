/* Game 'ai-levels': levels in the mini-Illustrator with automatic checks.
   data.set: 'shapes' | 'sb' | 'pen1' | 'pen2' | 'penfix' | 'drills' | 'guided' | 'open' | 'free'.
   Needs kit/lesson-kit.js, games/mini-ai-core.js, games/mini-ai-editor.js.

   ONE instruction language for every pen step (the same words are on the slides):
     «Точка N — клік.»                         orange numbered circle
     «Точка N — натисни й тягни … до кружечка.» purple arrow + hollow circle where to release
     «Alt + клік по точці N — ручку прибрано.»  purple «Alt» tag next to the point
     «Alt + тягни з точки N … до кружечка.»     dashed purple arrow
     «Замкни: клік у точку 1 (біля пера ○).» / «Відкрита лінія: Enter.» */
(() => {
  'use strict';
  const K = window.LessonKit, C = window.MiniAICore, E = window.MiniAIEditor;

  /* ---------- shape helpers ---------- */
  const R = (x, y, w, h) => [C.rectPath(x, y, w, h)];
  const O = (cx, cy, rx, ry) => [C.ellipsePath(cx, cy, rx, ry == null ? rx : ry)];
  const P = d => C.parseD(d);
  const POLY = pts => P('M' + pts.map(p => p.join(',')).join(' L') + ' Z');
  const ob = (sp, f, s, w) => ({ sp, f: f || null, s: s || null, w: s ? (w || 1) : 0, k: 'start' });
  const D = sp => C.toD({ sp });
  const WHITE = '#FFFFFF', INK = '#1E1B18', GREY = '#9E9E9E', RED = '#E5383B', ORANGE = '#FF7A00', YELLOW = '#FFC93C',
    GREEN = '#2BAE66', BLUE = '#2F7DF6', SKY = '#9AD0F5', PINK = '#F49AC2', BROWN = '#8B5A2B';
  const drop = x => P(`M${x},275 C${x},275 ${x + 24},312 ${x + 24},330 C${x + 24},346 ${x + 13},356 ${x},356 C${x - 13},356 ${x - 24},346 ${x - 24},330 C${x - 24},312 ${x},275 ${x},275 Z`);
  /* lazily computed target silhouettes built with raster booleans */
  const lazy = fn => { let v = null; return () => v || (v = fn()); };
  const F = sp => C.fieldOf(sp);
  const vec = field => C.vectorize(field, 0.5);
  const ghostOf = objs => objs.map(o => ({ d: D(o.sp), f: o.f, s: o.s, w: o.w }));

  /* ---------- check helpers ---------- */
  const closedPath = o => !!o && o.sp.length > 0 && o.sp.every(s => s.c && s.a.length >= 2);
  function helpers(doc) {
    const objs = doc.objs;
    const H = {
      objs, doc,
      closed: objs.filter(C.isClosed),
      open: objs.filter(o => !closedPath(o)),
      pens: objs.filter(o => o.k === 'pen'),
      bb: o => C.bbox(o),
      idx: o => objs.indexOf(o),
      best(targetSp, list) {
        let bo = null, bi = 0;
        for (const o of (list || H.closed)) { const v = C.shapeIoU(o, targetSp); if (v > bi) { bi = v; bo = o; } }
        return { o: bo, iou: bi };
      },
      bestOf(targetObjs, list) {
        let bo = null, bi = 0;
        for (const o of (list || H.closed)) {
          const v = C.compare([Object.assign({}, o, { f: '#000', s: null })], targetObjs.map(t => Object.assign({}, t, { f: '#000', s: null })), { shapeOnly: true }).iou;
          if (v > bi) { bi = v; bo = o; }
        }
        return { o: bo, iou: bi };
      },
      /* the pen contour (open or closed, as asked) nearest to the target contour */
      pen(targetSp, closed, list) {
        let best = null;
        for (const o of (list || H.pens)) {
          if (closedPath(o) !== closed) continue;
          const d = C.pathDist(o.sp, targetSp);
          if (!best || d.avg < best.d.avg) best = { o, d };
        }
        return best || { o: null, d: { avg: Infinity, max: Infinity } };
      },
      grouped() { return objs.length > 1 && objs[0].g && objs.every(o => o.g === objs[0].g); },
      near(o, x, y, tol) { return !!o && o.sp.some(s => s.a.some(a => Math.hypot(a.x - x, a.y - y) <= tol)); },
      sim(target, opts) { return objs.length ? C.compare(objs, target, opts) : { iou: 0, sim: 0 }; },
      ramp(v, lo, hi) { return Math.max(0, Math.min(1, (v - lo) / (hi - lo))); },
      hole(x, y) { return objs.length > 0 && C.colorAt(objs, x, y) === null; }
    };
    return H;
  }
  /* anchor near (x, y) is a corner or a broken (non-smooth) point */
  function cuspAt(o, x, y) {
    let best = null, bd = 18;
    o.sp.forEach(s => s.a.forEach(a => { const d = Math.hypot(a.x - x, a.y - y); if (d < bd) { bd = d; best = a; } }));
    if (!best) return false;
    if (!best.i || !best.o) return true;
    const v1x = best.i.x - best.x, v1y = best.i.y - best.y, v2x = best.o.x - best.x, v2y = best.o.y - best.y;
    const l1 = Math.hypot(v1x, v1y), l2 = Math.hypot(v2x, v2y);
    if (l1 < 0.5 || l2 < 0.5) return true;
    return (v1x * v2x + v1y * v2y) / (l1 * l2) > -0.97;
  }
  const chk = (t, ok, hint, w) => ({ t, ok: typeof ok === 'number' ? ok : (ok ? 1 : 0), hint, w: w || 1 });
  const GOOD = d => d.avg <= 6 && d.max <= 22;   // contour close enough to the dashed sample

  /* pen guide: pts = [{ n, x, y, drag:[x2,y2], dt, alt:true, altDrag:[x2,y2] }] */
  function penGuide(targetSp, pts, extra) {
    const g = { paths: [{ d: D(targetSp) }], points: [], arrows: [] };
    pts.forEach(p => {
      g.points.push({ n: p.n, x: p.x, y: p.y, alt: !!(p.alt || p.altDrag), ax: p.ax, ay: p.ay, t: p.t, tx: p.tx, ty: p.ty });
      if (p.drag) g.arrows.push({ x: p.x, y: p.y, x2: p.drag[0], y2: p.drag[1], t: p.dt, tx: p.dtx, ty: p.dty });
      if (p.altDrag) g.arrows.push({ x: p.x, y: p.y, x2: p.altDrag[0], y2: p.altDrag[1], alt: true, t: p.at != null ? p.at : 'Alt + тягни', tx: p.atx, ty: p.aty });
    });
    if (extra) Object.keys(extra).forEach(k => { g[k] = (g[k] || []).concat(extra[k]); });
    return g;
  }
  /* the standard checks of a pen level */
  function penChecks(H, L) {
    const m = H.pen(L.T, L.closed), o = m.o;
    const list = [
      chk(L.closed ? 'Контур намальовано пером і замкнено' : 'Лінію намальовано пером і завершено (Enter)', !!o,
        L.closed ? 'Заверши кліком у точку 1, коли біля пера з’явиться ○.' : 'Відкриту лінію завершуй клавішею Enter. Не замикай її в точці 1.'),
      chk('Форма збігається з пунктиром', !!o && GOOD(m.d),
        o ? `Зараз відхилення в середньому ${Math.round(m.d.avg)} px. Клікай точно в кружечки, а тягни до кінця фіолетової стрілки.` : 'Спершу намалюй контур.')
    ];
    if (L.straight) list.push(chk('Лише прямі лінії — без ручок', !!o && !C.hasCurve(o), 'Не тягни мишу після кліку — інакше з’являються ручки й криві.'));
    else list.push(chk('Є криві: у потрібних точках натиснуто й протягнуто', !!o && C.hasCurve(o), 'У точках зі стрілкою натисни кнопку миші й тягни, не відпускаючи.'));
    (L.cusps || []).forEach(([x, y, n]) => list.push(chk(`У точці ${n} кут: ручку зламано (Alt)`, !!o && cuspAt(o, x, y),
      `Після «натисни й тягни» в точці ${n} затисни Alt і клікни по ній (або Alt + тягни, якщо так у кроках).`)));
    list.push(chk(`Точок не більше ${L.ideal}`, !!o && C.anchorsOf(o) <= L.ideal, 'Зайві точки — зайва робота. Скасуй їх Ctrl+Z.'));
    return list;
  }

  /* ======================= 1. Фігури: збери за зразком ======================= */
  const SUN = O(300, 210, 110);
  const TL_BODY = R(240, 22, 120, 376), TL_L = [O(300, 90, 45), O(300, 210, 45), O(300, 330, 45)];
  const TL_T = [ob(TL_BODY, INK), ob(TL_L[0], RED), ob(TL_L[1], YELLOW), ob(TL_L[2], GREEN)];
  const SHAPES = [
    { id: 's1', title: 'Сонце', tool: 'Ellipse (L) · Shift · Alt', tool0: 'L',
      steps: [
        '<b>Еліпс (L)</b>: постав курсор у центр «+», затисни <b>Shift + Alt</b> і тягни до пунктирного кола.',
        '<b>Shift</b> — рівне коло, <b>Alt</b> — від центру. Обидві клавіші відпускай <b>після</b> кнопки миші.',
        'Заливка — <b>помаранчева</b>: виділи коло чорною стрілкою (V) → «Заливка» → помаранчевий.'
      ],
      start: [], sample: [ob(SUN, ORANGE)],
      guide: { paths: [{ d: D(SUN) }], marks: [{ x: 300, y: 210, t: 'центр' }] },
      checks(H) {
        const b = H.best(SUN), bb = b.o && H.bb(b.o);
        return [
          chk('Коло лежить на пунктирі', b.iou >= 0.9, 'Почни точно в «+» і тягни з Alt до пунктиру.'),
          chk('Це рівне коло, а не овал', b.iou >= 0.8 && Math.abs(bb.w - bb.h) <= 1.5, 'Тримай Shift, поки тягнеш, і відпусти його після миші.'),
          chk('Коло помаранчеве', !!b.o && b.o.f === ORANGE, 'Виділи коло (V) → «Заливка» → помаранчевий.')
        ];
      } },
    { id: 's2', title: 'Світлофор', tool: 'Rectangle (M) · Ellipse (L) · Arrange', tool0: 'M',
      steps: [
        '<b>Прямокутник (M)</b>: тягни від точки <b>1</b> до точки <b>2</b>. Заливка — <b>чорна</b>.',
        '<b>Еліпс (L)</b>: з кожного «+» із <b>Shift + Alt</b> тягни до пунктирного кола. Кола: <b>червоне</b>, <b>жовте</b>, <b>зелене</b>.',
        'Корпус закрив кола? Виділи корпус → <b>⬇ Назад</b>.',
        'Колір можна обрати <b>до</b> малювання або виділити фігуру й клікнути колір.'
      ],
      start: [], sample: TL_T,
      guide: { paths: [{ d: D(TL_BODY) }].concat(TL_L.map(s => ({ d: D(s), c: '#C2185B' }))),
        points: [{ n: 1, x: 240, y: 22 }, { n: 2, x: 360, y: 398 }], marks: [{ x: 300, y: 90 }, { x: 300, y: 210 }, { x: 300, y: 330 }] },
      checks(H) {
        const body = H.best(TL_BODY), cols = [RED, YELLOW, GREEN], names = ['червоне', 'жовте', 'зелене'];
        const list = [chk('Корпус — чорний прямокутник на пунктирі', body.iou >= 0.9 && body.o.f === INK, 'Інструментом M тягни від точки 1 до точки 2, заливка — чорна.')];
        TL_L.forEach((sp, i) => {
          const b = H.best(sp, H.closed.filter(o => o !== body.o));
          list.push(chk(`Коло ${i + 1} — ${names[i]}, на своєму місці`, b.iou >= 0.85 && b.o.f === cols[i], 'Еліпс із Shift + Alt від «+», потім колір.'));
        });
        list.push(chk('Усі три кола видно (корпус позаду)', TL_L.every((sp, i) => C.colorAt(H.objs, 300, [90, 210, 330][i]) === cols[i]), 'Виділи корпус → «⬇ Назад».'));
        return list;
      } },
    { id: 's3', title: 'Сніговик', tool: 'Selection (V) · Align · Group', tool0: 'V',
      steps: [
        'Три кола стоять криво. <b>Чорна стрілка (V)</b>: виділи всі три кола рамкою.',
        'Align › <b>По центру (горизонтально)</b> — сніговик стане рівно.',
        'Не зсунь кола по вертикалі: вони мають торкатися одне одного.',
        'Виділи все → <b>Згрупувати</b> (Ctrl+G).'
      ],
      start: [ob(O(282, 320, 80), SKY, INK, 2), ob(O(318, 190, 58), SKY, INK, 2), ob(O(272, 95, 42), SKY, INK, 2)],
      checks(H) {
        const cs = H.closed.map(o => H.bb(o)).sort((a, b) => a.cy - b.cy);
        const three = cs.length === 3;
        const col = three && Math.max(...cs.map(b => b.cx)) - Math.min(...cs.map(b => b.cx)) <= 1.5;
        const ys = three && Math.abs(cs[0].cy - 95) < 3 && Math.abs(cs[1].cy - 190) < 3 && Math.abs(cs[2].cy - 320) < 3;
        return [
          chk('Три кола на одній вертикалі', col, 'Виділи всі три кола → «По центру (горизонтально)».'),
          chk('Висота кіл не змінилась', ys, 'Рухай лише кнопкою Align. Ctrl+Z — скасувати.'),
          chk('Сніговик згруповано', H.objs.length === 3 && H.grouped(), 'Виділи все → «Згрупувати».')
        ];
      } }
  ];

  /* ======================= 2. Shape Builder: пазли ======================= */
  /* start shapes have a thin dark outline so every region is visible */
  const sbo = (sp, f) => ob(sp, f, INK, 2);
  const MOON_A = O(260, 220, 130), MOON_B = O(345, 160, 115);
  const DON_O = O(300, 210, 150), DON_I = O(300, 210, 60);
  const HEART_L = O(237, 170, 90), HEART_R = O(363, 170, 90), HEART_D = POLY([[300, 108], [427, 236], [300, 364], [173, 236]]);
  const LENS_L = O(255, 210, 140), LENS_R = O(345, 210, 140);
  const BITE_O = O(285, 228, 160), BITE_H = O(285, 228, 58), BITE_B = O(445, 92, 85);
  const CAT_H = O(300, 240, 125), CAT_E1 = POLY([[178, 190], [200, 48], [288, 118]]), CAT_E2 = POLY([[422, 190], [400, 48], [312, 118]]);
  const CAT_Y1 = O(252, 225, 22), CAT_Y2 = O(348, 225, 22);
  const KEY_B = O(165, 210, 88), KEY_H = O(165, 210, 36), KEY_S = R(235, 191, 300, 38), KEY_T1 = R(440, 220, 26, 62), KEY_T2 = R(492, 220, 26, 46);
  const LOCK_BODY = R(185, 205, 230, 180), LOCK_O = O(300, 205, 100), LOCK_I = O(300, 205, 62), LOCK_K = O(300, 310, 22);
  const SBP = [
    { id: 'b1', title: 'Місяць', kind: 'видалити',
      steps: ['Видали все, крім жовтого місяця: <b>Alt + клік</b> по кожній блакитній ділянці (їх дві).'],
      start: [sbo(MOON_A, YELLOW), sbo(MOON_B, SKY)],
      T: lazy(() => vec(C.opMinus(F(MOON_A), [F(MOON_B)]))) },
    { id: 'b2', title: 'Бублик', kind: 'видалити',
      steps: ['Зроби дірку: <b>Alt + клік</b> по внутрішньому колу.'],
      start: [sbo(DON_O, ORANGE), sbo(DON_I, YELLOW)],
      T: lazy(() => vec(C.opMinus(F(DON_O), [F(DON_I)]))), holes: [[300, 210]] },
    { id: 'b3', title: 'Сердечко', kind: 'об’єднати',
      steps: ['Два кола і ромб → одне сердечко: натисни й <b>протягни</b> мишею через <b>усі</b> ділянки за один рух.'],
      start: [sbo(HEART_D, RED), sbo(HEART_L, PINK), sbo(HEART_R, PINK)],
      T: lazy(() => vec(C.opUnion([F(HEART_L), F(HEART_R), F(HEART_D)]))) },
    { id: 'b4', title: 'Лінза', kind: 'видалити',
      steps: ['Залиш лише <b>спільну</b> частину двох кіл: <b>Alt + клік</b> по лівій і правій ділянках.', 'Так само працює Pathfinder › Intersect.'],
      start: [sbo(LENS_L, SKY), sbo(LENS_R, BLUE)],
      T: lazy(() => vec(C.opIntersect([F(LENS_L), F(LENS_R)]))) },
    { id: 'b5', title: 'Надкушений пончик', kind: 'видалити',
      steps: ['Видали дірку посередині й «укус» збоку.', '«Укус» — це <b>дві</b> ділянки: та, що на пончику, і та, що назовні. <b>Alt + клік</b> по кожній.'],
      start: [sbo(BITE_O, ORANGE), sbo(BITE_H, YELLOW), sbo(BITE_B, SKY)],
      T: lazy(() => vec(C.opMinus(F(BITE_O), [F(BITE_H), F(BITE_B)]))), holes: [[285, 228], [400, 110]] },
    { id: 'b6', title: 'Кіт', kind: 'об’єднати + видалити',
      steps: [
        '<b>Протягни</b> мишею від лівого вуха через голову до правого вуха — голова й вуха стануть однією фігурою.',
        'Потім <b>Alt + клік</b> по кожному оку — з’являться дірки.',
        'Порядок не важливий. Помилка — <b>Ctrl+Z</b>.'
      ],
      start: [sbo(CAT_E1, BROWN), sbo(CAT_E2, BROWN), sbo(CAT_H, ORANGE), sbo(CAT_Y1, WHITE), sbo(CAT_Y2, WHITE)],
      T: lazy(() => vec(C.opMinus(C.opUnion([F(CAT_H), F(CAT_E1), F(CAT_E2)]), [F(CAT_Y1), F(CAT_Y2)]))), holes: [[252, 225], [348, 225]] },
    { id: 'b7', title: 'Ключ', kind: 'об’єднати + видалити',
      steps: [
        '<b>Протягни</b> через кільце, стрижень і обидва зубці — одна фігура.',
        'Отвір у кільці: <b>Alt + клік</b> по білому колу.',
        'Не пропусти маленькі ділянки там, де фігури перекриваються.'
      ],
      start: [sbo(KEY_S, YELLOW), sbo(KEY_T1, ORANGE), sbo(KEY_T2, ORANGE), sbo(KEY_B, YELLOW), sbo(KEY_H, WHITE)],
      T: lazy(() => vec(C.opMinus(C.opUnion([F(KEY_B), F(KEY_S), F(KEY_T1), F(KEY_T2)]), [F(KEY_H)]))), holes: [[165, 210]] },
    { id: 'b8', title: 'Навісний замок', kind: 'об’єднати + видалити',
      steps: [
        '<b>Протягни</b> через сіру дужку і <b>всі</b> частини корпусу — одна фігура.',
        '<b>Alt + клік</b> по білому півколу під дужкою (над корпусом) і по чорній замковій щілині.',
        'Корпус розрізаний колами на кілька ділянок — протягни через кожну.'
      ],
      start: [sbo(LOCK_O, GREY), sbo(LOCK_I, WHITE), sbo(LOCK_BODY, ORANGE), sbo(LOCK_K, INK)],
      T: lazy(() => vec(C.opMinus(C.opUnion([C.opMinus(F(LOCK_O), [F(LOCK_I)]), F(LOCK_BODY)]), [F(LOCK_K)]))), holes: [[300, 175], [300, 310]] }
  ].map(L => Object.assign(L, {
    tool: 'Shape Builder (Shift+M) · ' + L.kind, tool0: 'V',
    steps: ['<b>Чорна стрілка (V)</b>: виділи всі фігури рамкою. Потім <b>Shape Builder</b> (Shift+M).'].concat(L.steps),
    sampleLive: () => [ob(L.T(), ORANGE)],
    checks(H) {
      const sh = H.objs.length ? C.compare(H.objs.map(o => Object.assign({}, o, { s: null })), [ob(L.T(), '#000')], { shapeOnly: true }).iou : 0;
      const list = [
        chk('Залишилась одна фігура', H.objs.length === 1, 'Об’єднай потрібні ділянки одним протягуванням, зайві видали Alt + кліком.'),
        chk('Форма збігається зі зразком', sh >= 0.95, 'Порівняй зі зразком: якої ділянки бракує чи яка зайва? Ctrl+Z — крок назад.')
      ];
      (L.holes || []).forEach(([x, y], i) => list.push(chk(L.holes.length > 1 ? `Дірка ${i + 1} — справжня (видно фон)` : 'Дірка справжня (видно фон)', H.hole(x, y), 'Alt + клік по ділянці в Shape Builder видаляє її — тоді крізь дірку видно фон.')));
      list.push(chk('Використано Shape Builder', H.doc.ops.sb > 0, 'Виділи фігури (V), увімкни Shift+M.'));
      return list;
    }
  }));

  /* ======================= 3. Перо, частина 1: кліки й криві (без Alt) ======================= */
  const PEN1 = [
    { id: 'p1', title: 'Трикутник', tool: 'клік · замкнути', ideal: 3, closed: true, straight: true,
      T: P('M300,60 L480,340 L120,340 Z'),
      pts: [{ n: 1, x: 300, y: 60 }, { n: 2, x: 480, y: 340 }, { n: 3, x: 120, y: 340 }],
      steps: ['Точки 1 → 2 → 3 — <b>клік</b> у кожну. Не тягни!', 'Замкни: <b>клік у точку 1</b> (біля пера з’явиться ○).'] },
    { id: 'p2', title: 'Блискавка', tool: 'клік · Ctrl+Z', ideal: 7, closed: true, straight: true,
      T: P('M380,40 L330,40 L200,220 L290,220 L240,390 L410,170 L315,170 Z'),
      pts: [[380, 40], [330, 40], [200, 220], [290, 220], [240, 390], [410, 170], [315, 170]].map(([x, y], i) => ({ n: i + 1, x, y })),
      steps: ['Точки 1 → 7 — <b>клік</b> у кожну по черзі.', 'Помилка — <b>Ctrl+Z</b> прибирає останню точку.', 'Замкни: <b>клік у точку 1</b>.'] },
    { id: 'p3', title: 'Арка — перша крива', tool: 'натисни й тягни · Enter', ideal: 3, closed: false,
      T: P('M120,300 C120,200 190,110 300,110 C410,110 480,200 480,300'),
      pts: [{ n: 1, x: 120, y: 300, drag: [120, 200], dt: 'вгору', dtx: 10 }, { n: 2, x: 300, y: 110, drag: [410, 110], dt: 'вправо', dtx: -10, dty: -14 }, { n: 3, x: 480, y: 300, drag: [480, 400], dt: 'вниз', dtx: 12, dty: 0 }],
      steps: ['Точка 1 — <b>натисни й тягни вгору</b> до кружечка.', 'Точка 2 — <b>натисни й тягни вправо</b> до кружечка.', 'Точка 3 — <b>натисни й тягни вниз</b> до кружечка.', 'Відкрита лінія: <b>Enter</b>.'] },
    { id: 'p4', title: 'Хвиля', tool: 'натисни й тягни · S-крива', ideal: 3, closed: false,
      T: P('M100,210 C160,90 240,90 300,210 C360,330 440,330 500,210'),
      pts: [{ n: 1, x: 100, y: 210, drag: [160, 90], dt: 'вгору-вправо', dtx: -40, dty: -12 }, { n: 2, x: 300, y: 210, drag: [360, 330], dt: 'вниз-вправо', dtx: 10, dty: 6 }, { n: 3, x: 500, y: 210, drag: [560, 90], dt: 'вгору-вправо', dtx: -110, dty: -12 }],
      steps: ['Точка 1 — <b>натисни й тягни вгору-вправо</b>.', 'Точка 2 — <b>натисни й тягни вниз-вправо</b>: вийде S-крива.', 'Точка 3 — <b>натисни й тягни вгору-вправо</b>.', 'Відкрита лінія: <b>Enter</b>.'] },
    { id: 'p5', title: 'Купол', tool: 'клік + натисни й тягни', ideal: 3, closed: true,
      T: P('M120,320 C120,320 200,110 300,110 C400,110 480,320 480,320 Z'),
      pts: [{ n: 1, x: 120, y: 320 }, { n: 2, x: 300, y: 110, drag: [400, 110], dt: 'вправо', dtx: -10, dty: -14 }, { n: 3, x: 480, y: 320 }],
      steps: ['Точка 1 — <b>клік</b>.', 'Точка 2 — <b>натисни й тягни вправо</b> до кружечка.', 'Точка 3 — <b>клік</b>.', 'Замкни: <b>клік у точку 1</b> — низ купола буде прямим.'] },
    { id: 'p6', title: 'Крапля', tool: 'гострий верх · 3 криві', ideal: 4, closed: true,
      T: P('M300,40 C300,40 180,190 180,260 C180,330 235,370 300,370 C365,370 420,330 420,260 C420,190 300,40 300,40 Z'),
      pts: [{ n: 1, x: 300, y: 40 }, { n: 2, x: 180, y: 260, drag: [180, 330], dt: 'вниз', dtx: -50, dty: 4 }, { n: 3, x: 300, y: 370, drag: [365, 370], dt: 'вправо', dtx: 6, dty: -12 }, { n: 4, x: 420, y: 260, drag: [420, 190], dt: 'вгору', dtx: 10 }],
      steps: ['Точка 1 (гострий верх) — <b>клік</b>.', 'Точки 2, 3, 4 — <b>натисни й тягни</b> вздовж контуру: вниз → вправо → вгору.', 'Замкни: <b>клік у точку 1</b> — верх залишиться гострим.'] },
    { id: 'p7', title: 'Серпик місяця', tool: 'гострі кінці кліком', ideal: 4, closed: true,
      T: P('M330,50 C330,50 160,110 160,210 C160,310 330,370 330,370 C330,370 250,290 250,210 C250,130 330,50 330,50 Z'),
      pts: [{ n: 1, x: 330, y: 50 }, { n: 2, x: 160, y: 210, drag: [160, 310], dt: 'вниз', dtx: -50, dty: 20 }, { n: 3, x: 330, y: 370 }, { n: 4, x: 250, y: 210, drag: [250, 130], dt: 'вгору', dtx: 8 }],
      steps: ['Точка 1 — <b>клік</b>. Точка 2 — <b>натисни й тягни вниз</b>.', 'Точка 3 — <b>клік</b> (гострий кінчик).', 'Точка 4 — <b>натисни й тягни вгору</b>.', 'Замкни: <b>клік у точку 1</b>. Гострі кінці дають кліки — Alt не потрібен!'] }
  ];

  /* ======================= 4. Перо, частина 2: Alt — ламаємо ручку ======================= */
  const PEN2 = [
    { id: 'a1', title: 'Трамплін', tool: 'Alt + клік · 1 раз', ideal: 3, closed: false,
      T: P('M110,340 C110,340 290,110 380,110 L380,340'),
      pts: [{ n: 1, x: 110, y: 340 }, { n: 2, x: 380, y: 110, drag: [470, 110], dt: 'вправо', dtx: -20, dty: -16, alt: true, ax: -42, ay: 10 }, { n: 3, x: 380, y: 340 }],
      bad: { paths: [{ d: 'M380,110 C470,110 380,340 380,340', bad: true }], labels: [{ x: 440, y: 250, t: '✗ так вийде без Alt', c: '#B42318' }] },
      cusps: [[380, 110, 2]],
      steps: [
        'Точка 1 — <b>клік</b>. Точка 2 — <b>натисни й тягни вправо</b> до кружечка: вийде крива.',
        'Ручка точки 2 стирчить <b>вправо</b> і потягне наступну лінію туди ж (червоний пунктир ✗).',
        '<b>Alt + клік по точці 2</b> — ручку прибрано.',
        'Точка 3 — <b>клік</b>: лінія піде прямо вниз. Відкрита лінія: <b>Enter</b>.'
      ] },
    { id: 'a2', title: 'Плавник акули', tool: 'Alt + клік · замкнений', ideal: 3, closed: true,
      T: P('M130,350 C130,350 260,70 400,70 L440,350 Z'),
      pts: [{ n: 1, x: 130, y: 350 }, { n: 2, x: 400, y: 70, drag: [540, 70], dt: 'вправо', dtx: -30, dty: -16, alt: true, ax: -44, ay: 10 }, { n: 3, x: 440, y: 350 }],
      bad: { paths: [{ d: 'M400,70 C540,70 440,350 440,350', bad: true }], labels: [{ x: 500, y: 250, t: '✗ без Alt', c: '#B42318' }] },
      cusps: [[400, 70, 2]],
      steps: [
        'Точка 1 — <b>клік</b>. Точка 2 — <b>натисни й тягни вправо</b> до кружечка.',
        '<b>Alt + клік по точці 2</b> — ручку прибрано, гострий кінчик.',
        'Точка 3 — <b>клік</b>. Замкни: <b>клік у точку 1</b>.'
      ] },
    { id: 'a3', title: 'Гребені хвиль', tool: 'Alt + клік · 2 рази', ideal: 5, closed: false,
      T: P('M60,330 C60,330 150,120 240,120 L240,330 C240,330 380,120 470,120 L470,330'),
      pts: [{ n: 1, x: 60, y: 330 }, { n: 2, x: 240, y: 120, drag: [330, 120], dt: 'вправо', dtx: -10, dty: -14, alt: true, ax: -42, ay: 10 }, { n: 3, x: 240, y: 330 },
        { n: 4, x: 470, y: 120, drag: [560, 120], dt: 'вправо', dtx: -20, dty: -14, alt: true, ax: -42, ay: 10 }, { n: 5, x: 470, y: 330 }],
      cusps: [[240, 120, 2], [470, 120, 4]],
      steps: [
        'Точка 1 — <b>клік</b>. Точка 2 — <b>натисни й тягни вправо</b>, потім <b>Alt + клік по точці 2</b>.',
        'Точка 3 — <b>клік</b>. Точка 4 — <b>натисни й тягни вправо</b>, потім <b>Alt + клік по точці 4</b>.',
        'Точка 5 — <b>клік</b>. Відкрита лінія: <b>Enter</b>.',
        'Ритм той самий двічі: <i>тягни → Alt + клік → клік</i>.'
      ] },
    { id: 'a4', title: 'Листок', tool: 'Alt + тягни · нова ручка', ideal: 2, closed: true,
      T: P('M100,330 C100,330 360,96 470,100 C430,250 100,330 100,330 Z'),
      pts: [{ n: 1, x: 100, y: 330 }, { n: 2, x: 470, y: 100, drag: [580, 104], dt: 'тягни', dtx: -30, dty: -14, altDrag: [430, 250], at: 'Alt + тягни', atx: -128, aty: 22, ax: 10, ay: -30 }],
      cusps: [[470, 100, 2]],
      steps: [
        'Точка 1 — <b>клік</b>. Точка 2 (кінчик) — <b>натисни й тягни вправо</b> до кружечка.',
        'Тепер наступна лінія має піти <b>вниз-ліворуч</b> і теж бути кривою. Тому не клік, а <b>Alt + тягни з точки 2</b> по пунктирній стрілці.',
        'Замкни: <b>клік у точку 1</b>.'
      ] },
    { id: 'a5', title: 'Сердечко — фінал', tool: 'криві + Alt + тягни', ideal: 6, closed: true,
      T: P('M300,370 C300,370 130,230 130,170 C130,110 175,80 215,80 C255,80 300,85 300,130 C300,85 345,80 385,80 C425,80 470,110 470,170 C470,240 300,370 300,370 Z'),
      pts: [{ n: 1, x: 300, y: 370 }, { n: 2, x: 130, y: 170, drag: [130, 110], dt: 'вгору', dtx: -50, dty: -8 }, { n: 3, x: 215, y: 80, drag: [255, 80], dt: 'вправо', dtx: -20, dty: -16 },
        { n: 4, x: 300, y: 130, drag: [300, 175], dt: 'вниз', dtx: 12, dty: 6, altDrag: [300, 85], at: '', ax: -46, ay: -9 },
        { n: 5, x: 385, y: 80, drag: [425, 80], dt: 'вправо', dtx: -20, dty: -16 }, { n: 6, x: 470, y: 170, drag: [470, 240], dt: 'вниз', dtx: 10 }],
      cusps: [[300, 130, 4]],
      steps: [
        'Точка 1 (низ) — <b>клік</b>. Точки 2, 3 — <b>натисни й тягни</b>: вгору, вправо.',
        'Точка 4 (ямка) — <b>натисни й тягни вниз</b>, потім <b>Alt + тягни з точки 4 вгору</b>.',
        'Точки 5, 6 — <b>натисни й тягни</b>: вправо, вниз.',
        'Замкни: <b>клік у точку 1</b>.'
      ] }
  ];
  const penLevel = L => Object.assign(L, {
    tool0: 'P', legend: true, sample: [ob(L.T, L.closed ? ORANGE : null, L.closed ? null : INK, L.closed ? 0 : 4)],
    guide: penGuide(L.T, L.pts, L.bad),
    checks: H => penChecks(H, L)
  });
  PEN1.forEach(penLevel); PEN2.forEach(penLevel);

  /* ======================= 5. Полагодь контур (біла стрілка) ======================= */
  const FIX = [
    { id: 'f1', title: 'Зигзаг', tip: 'Дві точки стоять не на своїх місцях. <b>Біла стрілка (A)</b>: наведи на лінію, візьми точку й перетягни до вершини пунктиру.',
      T: P('M80,320 L200,120 L320,320 L440,120 L540,320'), S: P('M80,320 L200,120 L320,230 L400,210 L540,320') },
    { id: 'f2', title: 'Арка', tip: 'Ручки закороткі — арка «сплющена». Клікни білою стрілкою на точку — з’являться її ручки. Тягни <b>круглі кінчики ручок</b>, щоб витягнути криву.',
      T: P('M120,320 C120,200 190,110 300,110 C410,110 480,200 480,320'), S: P('M120,320 C120,290 270,110 300,110 C330,110 480,290 480,320') },
    { id: 'f3', title: 'Хвиля навпаки', tip: 'Хвиля вигнута в інший бік. Переверни ручки кожної точки: клікни точку → тягни її ручку в протилежний бік.',
      T: P('M100,230 C160,90 240,90 300,230 C360,370 440,370 500,230'), S: P('M100,230 C160,370 240,370 300,230 C360,90 440,90 500,230') },
    { id: 'f4', title: 'Крапля', tip: 'Нижня точка зміщена, а ручки бокових точок повернуті неправильно. Спершу перетягни точку, потім поправ ручки.',
      T: P('M300,60 C300,60 180,200 180,270 C180,340 235,380 300,380 C365,380 420,340 420,270 C420,200 300,60 300,60 Z'),
      S: P('M300,60 C300,60 180,230 200,250 C220,270 255,330 320,330 C385,330 400,290 420,270 C440,250 300,60 300,60 Z') }
  ].map(L => Object.assign(L, {
    tool: 'Direct Selection (A)', tool0: 'A',
    steps: [L.tip, 'Тягни <b>квадратики</b> — точки, <b>кружечки</b> на кінцях ліній — ручки. Помилка — <b>Ctrl+Z</b>.'],
    start: [ob(L.S, null, INK, 4)],
    guide: { paths: [{ d: D(L.T) }] },
    checks(H) {
      const o = H.objs.length === 1 ? H.objs[0] : null;
      const n0 = C.anchorsOf({ sp: L.S });
      const d = o ? C.pathDist(o.sp, L.T) : { avg: Infinity, max: Infinity };
      return [
        chk('Контур збігається з пунктиром', !!o && d.avg <= 4.5 && d.max <= 16, o ? `Відхилення зараз у середньому ${Math.round(d.avg)} px. Рухай точки й ручки ближче до пунктиру.` : 'Має залишитися один контур.', 4),
        chk(`Точок стільки ж, скільки було (${n0})`, !!o && C.anchorsOf(o) === n0, 'Не додавай і не видаляй точки — лише перетягуй. Ctrl+Z допоможе.'),
        chk('Контур один, без копій', H.objs.length === 1, 'Видали зайві копії (Alt + тягни створює копію).')
      ];
    }
  }));

  /* ======================= 6. Усі інструменти по черзі: 8 вправ ======================= */
  const SQ = R(80, 110, 200, 200), CIR = O(440, 210, 100);
  const HOUSE_T = P('M360,300 L360,200 L430,80 L500,200 L500,300 Z');
  const ARROW_T = P('M80,180 L330,180 L330,110 L520,210 L330,310 L330,240 L80,240 Z');
  const SAIL_T = P('M200,350 L440,350 C440,350 350,60 200,60 Z');
  const PIN_T = [ob(O(300, 170, 100).concat(O(300, 170, 40)), RED), ob(P('M230,215 L370,215 L300,385 Z'), RED)];
  const BAT_T = [ob(R(140, 130, 280, 160).concat(R(160, 150, 240, 120)), GREEN), ob(R(410, 175, 40, 70), GREEN)];
  /* garland: a wire and five bulbs hanging crooked */
  const WIRE = R(60, 197, 480, 6);
  const BULB_C = [RED, YELLOW, GREEN, BLUE, ORANGE];
  const BULB_START = [[105, 168], [222, 246], [286, 178], [402, 236], [495, 186]];
  const GARLAND_T = [ob(WIRE, INK)].concat(BULB_C.map((c, i) => ob(O(105 + i * 97.5, 200, 24), c, INK, 2)));

  const DRILLS = [
    { id: 'd1', title: 'Квадрат і коло', tool: 'Rectangle (M) · Ellipse (L)', tool0: 'M',
      steps: [
        '<b>Прямокутник (M)</b>: затисни <b>Shift</b> і тягни від точки <b>1</b> до точки <b>2</b>. Вийде квадрат.',
        '<b>Еліпс (L)</b>: постав курсор у центр «+», затисни <b>Shift + Alt</b> і тягни до пунктирного кола.',
        'Shift і Alt відпускай <b>після</b> кнопки миші. Колір — будь-який.'
      ],
      start: [],
      guide: { paths: [{ d: D(SQ) }, { d: D(CIR) }], points: [{ n: 1, x: 80, y: 110 }, { n: 2, x: 280, y: 310 }], marks: [{ x: 440, y: 210, t: 'центр' }] },
      checks(H) {
        const a = H.best(SQ), b = H.best(CIR);
        const ba = a.o && H.bb(a.o), bc = b.o && H.bb(b.o);
        return [
          chk('Квадрат лежить у пунктирній рамці', a.iou >= 0.9, 'Інструментом M тягни від точки 1 до точки 2.'),
          chk('Квадрат рівний: ширина = висота', a.iou >= 0.8 && Math.abs(ba.w - ba.h) <= 1.5, 'Тримай Shift, поки тягнеш, і відпусти його після миші.'),
          chk('Коло в пунктирній рамці', b.iou >= 0.9, 'Інструментом L почни в центрі «+» і тягни з Alt.'),
          chk('Коло рівне, а не овал', b.iou >= 0.8 && Math.abs(bc.w - bc.h) <= 1.5, 'Shift — пропорційно (коло), Alt — від центру.')
        ];
      } },
    { id: 'd2', title: 'Будиночок переїжджає', tool: 'Selection (V) · Direct Selection (A)', tool0: 'V',
      steps: [
        '<b>Чорна стрілка (V)</b>: перетягни <b>весь</b> будиночок, щоб стіни лягли на пунктир.',
        '<b>Біла стрілка (A)</b>: наведи на будиночок, візьми <b>лише верхню точку</b> даху й підніми її до позначки «+».',
        'Промахнувся(-лась)? <b>Ctrl+Z</b> скасує останню дію.'
      ],
      start: [ob(P('M60,330 L60,230 L130,170 L200,230 L200,330 Z'), YELLOW, INK, 3)],
      guide: { paths: [{ d: D(HOUSE_T) }], marks: [{ x: 430, y: 80, t: 'дах сюди' }] },
      checks(H) {
        const b = H.best(HOUSE_T), o = b.o;
        const walls = [[360, 300], [360, 200], [500, 200], [500, 300]].every(([x, y]) => H.near(o, x, y, 8));
        return [
          chk('Стіни будиночка стоять на пунктирі', walls, 'Чорною стрілкою (V) тягни будиночок за заливку, а не за точку.'),
          chk('Верхівку даху піднято до позначки', H.near(o, 430, 80, 8), 'Біла стрілка (A): візьми саме верхню точку даху.'),
          chk('Форма збігається з пунктиром', b.iou >= 0.92, 'Перевір, чи не зрушилась інша точка. Ctrl+Z допоможе.'),
          chk('Будиночок один, без зайвих копій', H.closed.length === 1, 'Видали зайві копії (Alt + тягни створює копію).')
        ];
      } },
    { id: 'd3', title: 'Стрілка-вказівник', tool: 'Pen Tool (P) — прямі', tool0: 'P', legend: true,
      steps: [
        'Точки 1 → 2 → … → 7 — <b>клік</b> у кожну. Не тягни!',
        'Замкни: <b>клік у точку 1</b> (біля пера з’явиться ○).',
        '<b>Shift</b> допомагає вести рівні лінії під кутом 0°, 45°, 90°.'
      ],
      start: [],
      guide: { paths: [{ d: D(ARROW_T) }], points: [[80, 180], [330, 180], [330, 110], [520, 210], [330, 310], [330, 240], [80, 240]].map(([x, y], i) => ({ n: i + 1, x, y })) },
      checks(H) {
        const b = H.best(ARROW_T, H.pens.filter(C.isClosed)), o = b.o;
        return [
          chk('Контур намальовано пером і замкнено', !!o, 'Клікни в точку 1, коли біля пера з’явиться ○.'),
          chk('Форма збігається зі стрілкою', b.iou >= 0.9, 'Клікай точно в помаранчеві кружечки.'),
          chk('Лише прямі лінії, без ручок', !!o && !C.hasCurve(o), 'Не тягни мишу після кліку — інакше з’являються ручки й криві.'),
          chk('Точок рівно стільки, скільки потрібно (7)', !!o && C.anchorsOf(o) <= 7, 'Зайві точки — це зайва робота. Скасуй Ctrl+Z.')
        ];
      } },
    { id: 'd4', title: 'Вітрило', tool: 'Pen Tool (P) — крива й Alt', tool0: 'P', legend: true,
      steps: [
        'Точка 1 — <b>клік</b>. Точка 2 — <b>клік</b> (пряма лінія).',
        'Точка 3 — <b>натисни й тягни вліво</b> до кружечка: вийде крива.',
        '<b>Alt + клік по точці 3</b> — ручку прибрано, далі буде пряма (щогла).',
        'Замкни: <b>клік у точку 1</b>.'
      ],
      start: [ob(P('M140,365 L500,365 L460,405 L180,405 Z'), BROWN)],
      guide: { paths: [{ d: D(SAIL_T) }], points: [{ n: 1, x: 200, y: 350 }, { n: 2, x: 440, y: 350 }, { n: 3, x: 200, y: 60, alt: true, ax: 12, ay: 8 }],
        arrows: [{ x: 200, y: 60, x2: 60, y2: 60, t: 'тягни', tx: -10, ty: -14 }] },
      checks(H) {
        const b = H.best(SAIL_T, H.pens.filter(C.isClosed)), o = b.o, bb = o && H.bb(o);
        return [
          chk('Вітрило — замкнений контур пером', !!o, 'Заверши кліком у точку 1.'),
          chk('Є крива (натисни й тягни)', !!o && C.hasCurve(o), 'У точці 3 не просто клікни, а натисни й тягни вліво.'),
          chk('Щогла пряма — ручку зламано Alt', !!o && bb.x >= 194, 'Після кривої — Alt + клік по точці 3, тоді клік у точку 1.'),
          chk('Форма збігається з пунктиром', b.iou >= 0.88, 'Довжина ручки = сила вигину. Тягни до кружечка на кінці стрілки.')
        ];
      } },
    { id: 'd5', title: 'Мішень', tool: 'Fill & Stroke', tool0: 'V',
      steps: [
        '<b>Велике</b> коло: заливка <b>біла</b>, обведення <b>чорне 8 pt</b>.',
        '<b>Середнє</b>: заливка <b>червона</b>, обведення — <b>без кольору</b> (перекреслений квадратик).',
        '<b>Мале</b>: заливка — <b>без кольору</b>, обведення <b>біле 6 pt</b>.',
        'Як: виділи коло чорною стрілкою → вибери «Заливка» чи «Обведення» → клікни колір. Клавіша <b>X</b> перемикає.'
      ],
      start: [ob(O(300, 210, 150), GREY), ob(O(300, 210, 100), GREY), ob(O(300, 210, 50), GREY)],
      sample: [ob(O(300, 210, 150), WHITE, INK, 8), ob(O(300, 210, 100), RED), ob(O(300, 210, 50), null, WHITE, 6)],
      checks(H) {
        const by = w => H.closed.find(o => { const b = H.bb(o); return Math.abs(b.w - w) < 25 && Math.abs(b.h - w) < 25; });
        const big = by(300), mid = by(200), sm = by(100);
        return [
          chk('Велике коло: біла заливка', big && big.f === WHITE, 'Виділи велике коло (клікни на його край), «Заливка» → білий.'),
          chk('Велике коло: чорне обведення 8 pt', big && big.s === INK && big.w === 8, '«Обведення» → чорний, «Товщина» → 8 pt.'),
          chk('Середнє коло: червоне, без обведення', mid && mid.f === RED && !mid.s, 'Для обведення обери перекреслений квадратик «без кольору».'),
          chk('Мале коло: без заливки', sm && !sm.f, '«Заливка» → без кольору: крізь коло стане видно червоне.'),
          chk('Мале коло: біле обведення 6 pt', sm && sm.s === WHITE && sm.w === 6, '«Обведення» → білий, товщина 6 pt.')
        ];
      } },
    { id: 'd6', title: 'Пін на карті', tool: 'Shape Builder (Shift+M)', tool0: 'V',
      steps: [
        '<b>Чорна стрілка (V)</b>: виділи всі три фігури рамкою.',
        'Увімкни <b>Shape Builder</b> (Shift+M).',
        'Натисни й <b>протягни</b> через усі червоні ділянки кола й трикутника — вони стануть однією фігурою.',
        '<b>Alt + клік</b> по жовтому колу — воно зникне, залишиться дірка.'
      ],
      start: [ob(O(300, 170, 100), RED), ob(P('M230,215 L370,215 L300,385 Z'), RED), ob(O(300, 170, 40), YELLOW)],
      sample: PIN_T,
      checks(H) {
        const sh = H.sim(PIN_T, { shapeOnly: true });
        return [
          chk('Залишилась одна фігура', H.objs.length === 1, 'Протягни через УСІ червоні ділянки за один рух. Ctrl+Z — спробувати ще раз.'),
          chk('Форма піна з круглою діркою', sh.iou >= 0.93, 'Жовте коло треба видалити: Alt + клік по ньому в Shape Builder.'),
          chk('Пін червоний', H.objs.length > 0 && H.objs.every(o => o.f === RED), 'Почни протягування з червоної ділянки — колір береться звідти.')
        ];
      } },
    { id: 'd7', title: 'Батарейка', tool: 'Pathfinder', tool0: 'V',
      steps: [
        'Чорною стрілкою виділи <b>зелений корпус</b> і <b>білий прямокутник</b> (Shift + клік).',
        'Pathfinder › <b>Minus Front</b> — білий прямокутник виріже «вікно».',
        'Тепер виділи рамку і «носик» праворуч → <b>Unite</b>.',
        'Порядок важливий: Minus Front віднімає <b>верхню</b> фігуру від нижньої.'
      ],
      start: [ob(R(140, 130, 280, 160), GREEN), ob(R(410, 175, 40, 70), GREEN), ob(R(160, 150, 240, 120), WHITE)],
      sample: BAT_T,
      checks(H) {
        const sh = H.sim(BAT_T, { shapeOnly: true });
        return [
          chk('Батарейка — одна фігура', H.objs.length === 1, 'Після Minus Front виділи рамку і носик разом → Unite.'),
          chk('Усередині дірка — видно фон', H.hole(280, 210), 'Minus Front вирізає верхню фігуру. Не замальовуй її білим!'),
          chk('Форма батарейки збігається', sh.iou >= 0.93, 'Не виділяй носик для Minus Front, інакше він теж виріжеться.'),
          chk('Батарейка зелена', H.objs.length > 0 && H.objs.every(o => o.f === GREEN), 'Minus Front бере колір нижньої фігури — зеленого корпусу.')
        ];
      } },
    { id: 'd8', title: 'Гірлянда', tool: 'Align · Distribute · Group', tool0: 'V',
      steps: [
        'Ліхтарики висять криво й нерівно. «На око» до пікселя не вирівняти — для цього є <b>Align</b>.',
        '<b>Чорна стрілка (V)</b>: виділи все рамкою → <b>По центру (вертикально)</b>. Усі ліхтарики сядуть на дріт.',
        'Усе ще виділено все. <b>Shift + клік по дроту</b> (між ліхтариками) — дріт вийде з виділення, лишаться 5 ліхтариків → <b>Розподілити по горизонталі</b>. Проміжки стануть однаковими.',
        'Виділи все → <b>Згрупувати</b> (Ctrl+G).'
      ],
      start: [ob(WIRE, INK)].concat(BULB_START.map(([x, y], i) => ob(O(x, y, 24), BULB_C[i], INK, 2))),
      sample: GARLAND_T,
      checks(H) {
        const wire = H.closed.find(o => { const b = H.bb(o); return b.w > 400 && b.h < 10; });
        const wb = wire && H.bb(wire);
        const bulbs = H.closed.filter(o => o !== wire && (() => { const b = H.bb(o); return Math.abs(b.w - 48) < 3 && Math.abs(b.h - 48) < 3; })()).map(o => H.bb(o)).sort((a, b) => a.cx - b.cx);
        const five = bulbs.length === 5 && !!wb;
        const onWire = five && bulbs.every(b => Math.abs(b.cy - wb.cy) <= 1.5);
        const inside = five && bulbs.every(b => b.cx >= wb.x && b.cx <= wb.x2);
        const gaps = five ? bulbs.slice(1).map((b, i) => b.cx - bulbs[i].cx) : [];
        const even = five && gaps.every(g => g > 50) && Math.max(...gaps) - Math.min(...gaps) <= 1.5;
        return [
          chk('Усі ліхтарики точно на дроті', onWire, 'Виділи все рамкою → «По центру (вертикально)».'),
          chk('Ліхтарики не з’їхали з дроту вбік', inside, 'Не перетягуй ліхтарики далеко — краще Ctrl+Z.'),
          chk('Однакові проміжки між ліхтариками', even, 'Виділи все, потім Shift + клік по дроту — у виділенні лишаться 5 ліхтариків → «Розподілити по горизонталі».'),
          chk('Гірлянду згруповано', H.objs.length === 6 && H.grouped(), 'Виділи все → «Згрупувати».')
        ];
      } }
  ];

  /* ======================= 7. За інструкцією ======================= */
  const CONE = P('M230,215 L370,215 L300,395 Z');
  const SCOOPS = [ob(O(255, 170, 62), PINK), ob(O(345, 170, 62), PINK), ob(O(300, 115, 62), PINK)];
  const CHERRY = O(300, 48, 20);
  const ICE_T = [ob(CONE, YELLOW, BROWN, 4)].concat(SCOOPS, [ob(CHERRY, RED)]);
  const CAP = P('M130,230 C130,230 190,70 300,70 C410,70 470,230 470,230 Z');
  const STEM = R(245, 200, 110, 170);
  const SPOTS = [O(215, 180, 20), O(300, 120, 24), O(385, 175, 18)];
  const MUSH_T = [ob(STEM, WHITE, INK, 3), ob(CAP, RED)].concat(SPOTS.map(s => ob(s, WHITE)));
  const WHALE = P('M70,270 C70,200 150,140 250,140 C350,140 430,190 450,250 L540,170 L520,300 L430,300 C430,300 70,340 70,270 Z');
  const SPOUT = [P('M245,128 C245,95 225,75 200,62'), P('M255,128 C255,95 275,75 300,62')];
  const WHALE_T = [ob(WHALE, BLUE), ob(O(150, 225, 9), INK)].concat(SPOUT.map(s => ob(s, null, SKY, 6)));

  const GUIDED = [
    { id: 'g1', title: 'Морозиво', tool: 'Pen · Ellipse · Shape Builder · Fill/Stroke · Group', legend: true,
      steps: [
        '<b>Ріжок — перо (P)</b>: точки 1 → 2 → 3 — <b>клік</b>, замкни кліком у точку 1. Заливка <b>жовта</b>, обведення <b>коричневе 4 pt</b>.',
        '<b>Кульки — еліпс (L)</b>: із <b>Shift + Alt</b> тягни від кожного «+» до пунктирного кола. Заливка <b>рожева</b>, обведення — без кольору.',
        'Виділи три кульки → <b>Shape Builder</b> (протягни через усі ділянки) або <b>Pathfinder › Unite</b>: крем стане однією фігурою.',
        '<b>Вишенька</b> — маленьке червоне коло згори.',
        'Ріжок має бути <b>позаду</b> крему (⬇ Назад). Наприкінці виділи все й <b>згрупуй</b>.'
      ],
      start: [], sample: ICE_T,
      guide: { paths: [{ d: D(CONE) }].concat(SCOOPS.map(s => ({ d: D(s.sp), c: '#C2185B' })), [{ d: D(CHERRY), c: '#C2185B' }]),
        points: [{ n: 1, x: 230, y: 215 }, { n: 2, x: 370, y: 215 }, { n: 3, x: 300, y: 395 }],
        marks: [{ x: 255, y: 170 }, { x: 345, y: 170 }, { x: 300, y: 115 }, { x: 300, y: 48 }] },
      checks(H) {
        const cone = H.best(CONE, H.pens.filter(C.isClosed));
        const cream = H.bestOf(SCOOPS, H.closed.filter(o => o.f === PINK));
        const cherry = H.best(CHERRY, H.closed.filter(o => o.f === RED));
        const co = cone.iou >= 0.85 ? cone.o : null, cr = cream.iou >= 0.9 ? cream.o : null;
        const s = H.sim(ICE_T).sim;
        return [
          chk('Ріжок — замкнений контур пером', !!co, 'Перо: клік 1 → 2 → 3 і замкни кліком у точку 1.'),
          chk('Ріжок: жовта заливка й коричневе обведення 4 pt', !!co && co.f === YELLOW && co.s === BROWN && co.w === 4, 'Виділи ріжок: «Заливка» → жовтий, «Обведення» → коричневий, товщина 4 pt.'),
          chk('Крем — одна рожева фігура з трьох кульок', !!cr, 'Три рожеві кулі виділи разом → Unite або Shape Builder.'),
          chk('Вишенька — червоне коло згори', cherry.iou >= 0.75, 'Еліпс із Shift по маленькому пунктирному колу, заливка червона.'),
          chk('Ріжок позаду крему', !!co && !!cr && H.idx(co) < H.idx(cr), 'Виділи ріжок → «⬇ Назад».'),
          chk('Усе згруповано', H.grouped(), 'Виділи все рамкою → «Згрупувати» (Ctrl+G).'),
          chk('Малюнок схожий на зразок', H.ramp(s, 0.6, 0.85), 'Порівняй кольори й розміри зі зразком.')
        ];
      } },
    { id: 'g2', title: 'Мухомор', tool: 'Pen · Rectangle · Arrange · Align · Group', legend: true,
      steps: [
        '<b>Шапка — перо (P)</b>: точка 1 — <b>клік</b>; точка 2 — <b>натисни й тягни вправо</b> до кружечка; точка 3 — <b>клік</b>; замкни кліком у точку 1. Заливка <b>червона</b>, без обведення.',
        '<b>Ніжка — прямокутник (M)</b> по пунктиру. Біла заливка, <b>чорне обведення 3 pt</b>.',
        'Ніжка закрила шапку? Виділи ніжку → <b>⬇ Назад</b>.',
        'Виділи шапку й ніжку → Align › <b>По центру (горизонтально)</b>.',
        '<b>Плями</b> — три білі кола без обведення. Потім <b>згрупуй</b> усе.'
      ],
      start: [], sample: MUSH_T,
      guide: { paths: [{ d: D(CAP) }, { d: D(STEM), c: '#6E675F' }].concat(SPOTS.map(s => ({ d: D(s), c: '#C2185B' }))),
        points: [{ n: 1, x: 130, y: 230 }, { n: 2, x: 300, y: 70 }, { n: 3, x: 470, y: 230 }],
        arrows: [{ x: 300, y: 70, x2: 410, y2: 70, t: 'вправо', tx: -30, ty: -14 }] },
      checks(H) {
        const cap = H.best(CAP, H.pens.filter(C.isClosed));
        const co = cap.iou >= 0.85 ? cap.o : null;
        const stem = H.best(STEM, H.closed.filter(o => o !== co));
        const so = stem.iou >= 0.8 ? stem.o : null;
        const cb = co && H.bb(co), sbx = so && H.bb(so);
        const spots = co ? H.closed.filter(o => o !== so && o !== co && o.f === WHITE && !o.s && (() => { const b = H.bb(o); return b.w < 80 && b.cx > cb.x && b.cx < cb.x2 && b.cy > cb.y && b.cy < cb.y2; })()) : [];
        const s = H.sim(MUSH_T).sim;
        return [
          chk('Шапка — пером, з кривою', !!co && C.hasCurve(co), 'Точка 2: не клік, а натисни й тягни вправо.'),
          chk('Шапка червона', !!co && co.f === RED, 'Виділи шапку → «Заливка» → червоний.'),
          chk('Ніжка позаду шапки', !!co && !!so && H.idx(so) < H.idx(co), 'Виділи ніжку → «⬇ Назад».'),
          chk('Ніжка по центру шапки', !!cb && !!sbx && Math.abs(cb.cx - sbx.cx) <= 1.5, 'Виділи шапку й ніжку → «По центру (горизонтально)».'),
          chk('Щонайменше три білі плями на шапці', spots.length >= 3, 'Білі кола без обведення, усередині шапки.'),
          chk('Усе згруповано', H.grouped(), 'Виділи все → «Згрупувати».'),
          chk('Малюнок схожий на зразок', H.ramp(s, 0.6, 0.85), 'Порівняй кольори й розміри зі зразком.')
        ];
      } },
    { id: 'g3', title: 'Кит', tool: 'Pen (криві + Alt) · відкриті лінії · Group', legend: true,
      steps: [
        '<b>Тіло — перо (P).</b> Точка 1 — <b>натисни й тягни вгору</b>. Точка 2 — <b>натисни й тягни вправо</b>. Точка 3 — <b>натисни й тягни вниз-вправо</b>, потім <b>Alt + клік по точці 3</b>.',
        'Точки 4, 5, 6 — <b>клік</b> (гострий хвіст). Замкни: <b>клік у точку 1</b>. Заливка <b>синя</b>, без обведення.',
        '<b>Око</b> — маленьке чорне коло.',
        '<b>Фонтан</b> — дві відкриті лінії пером (кожну завершуй <b>Enter</b>). Заливка — <b>без кольору</b>, обведення <b>блакитне 6 pt</b>.',
        'Виділи все й <b>згрупуй</b>.'
      ],
      start: [], sample: WHALE_T,
      guide: { paths: [{ d: D(WHALE) }].concat(SPOUT.map(s => ({ d: D(s), c: '#2F7DF6' })), [{ d: D(O(150, 225, 9)), c: '#6E675F' }]),
        points: [{ n: 1, x: 70, y: 270 }, { n: 2, x: 250, y: 140 }, { n: 3, x: 450, y: 250, alt: true, ax: -44, ay: 6 }, { n: 4, x: 540, y: 170 }, { n: 5, x: 520, y: 300 }, { n: 6, x: 430, y: 300 }],
        arrows: [{ x: 70, y: 270, x2: 70, y2: 200, t: 'вгору', tx: 10 }, { x: 250, y: 140, x2: 350, y2: 140, t: 'вправо', tx: -20, ty: -14 }, { x: 450, y: 250, x2: 470, y2: 310, t: 'вниз-вправо', tx: -20, ty: 28 }] },
      checks(H) {
        const body = H.best(WHALE, H.pens.filter(C.isClosed));
        const bo = body.iou >= 0.82 ? body.o : null, bb = bo && H.bb(bo);
        const eye = bo ? H.closed.find(o => o !== bo && o.f === INK && (() => { const b = H.bb(o); return b.w < 30 && b.cx > bb.x && b.cx < bb.x2 && b.cy > bb.y && b.cy < bb.y2; })()) : null;
        const spouts = H.open.filter(o => !o.f && o.s && o.w >= 2);
        const s = H.sim(WHALE_T).sim;
        return [
          chk('Тіло — замкнений контур пером', !!bo, 'Іди точками 1 → 6 і замкни кліком у точку 1.'),
          chk('У тіла плавні криві', !!bo && C.hasCurve(bo), 'Точки 1, 2 і 3: не клік, а натисни й тягни.'),
          chk('Хвіст гострий: у точці 3 ручку зламано (Alt)', !!bo && cuspAt(bo, 450, 250), 'Після «натисни й тягни» в точці 3 — Alt + клік по ній. Тоді лінія до точки 4 піде прямо.'),
          chk('Тіло синє', !!bo && bo.f === BLUE, 'Виділи тіло → «Заливка» → синій.'),
          chk('Є око — маленьке чорне коло', !!eye, 'Еліпс із Shift, заливка чорна.'),
          chk('Фонтан: дві лінії без заливки, з обведенням', spouts.length >= 2, 'Відкриту лінію завершуй Enter. Заливку прибери, інакше вийде «трикутник».'),
          chk('Усе згруповано', H.grouped(), 'Виділи все → «Згрупувати».'),
          chk('Малюнок схожий на зразок', H.ramp(s, 0.55, 0.82), 'Порівняй кольори й розміри зі зразком.')
        ];
      } }
  ];

  /* ======================= 8. Без підказок: напівпрозорий зразок під полотном ======================= */
  const CLOUD_SP = lazy(() => C.pathfinder('unite', [ob(O(200, 180, 60)), ob(O(290, 140, 80)), ob(O(380, 180, 60)), ob(R(200, 180, 180, 60))]).sp);
  const CLOUD_T = lazy(() => [ob(CLOUD_SP(), WHITE, INK, 4)].concat([230, 290, 350].map(x => ob(drop(x), BLUE))));
  const CUP = P('M190,160 L410,160 L392,290 C386,322 350,335 300,335 C250,335 214,322 208,290 Z');
  const STEAM = [P('M260,140 C240,115 280,95 260,70'), P('M330,140 C310,115 350,95 330,70')];
  const CUP_T = [ob(O(300, 345, 150, 20), YELLOW, INK, 4), ob(O(410, 230, 40).concat(O(410, 230, 22)), INK), ob(CUP, ORANGE, INK, 4)].concat(STEAM.map(s => ob(s, null, GREY, 6)));
  const GLASS_SP = lazy(() => C.pathfinder('unite', [ob(O(300, 150, 95)), ob(R(255, 200, 90, 90))]).sp);
  const BASE = [R(262, 296, 76, 14), R(262, 316, 76, 14), R(262, 336, 76, 14)];
  const FILAMENT = P('M272,245 L284,185 L300,215 L316,185 L328,245');
  const RAYS = [P('M172,150 L132,150'), P('M428,150 L468,150'), P('M212,60 L184,32'), P('M388,60 L416,32'), P('M300,42 L300,8')];
  const BULB_T = lazy(() => [ob(GLASS_SP(), YELLOW, INK, 4)].concat(BASE.map(s => ob(s, GREY)), [ob(FILAMENT, null, ORANGE, 4)], RAYS.map(s => ob(s, null, ORANGE, 6))));

  const traceSteps = 'Під полотном лежить <b>напівпрозорий зразок</b> — малюй прямо поверх нього. Інструменти й спосіб обираєш сам(-а).';
  const OPEN = [
    { id: 'o1', title: 'Хмарка з дощем', tool: 'будь-які інструменти',
      steps: [traceSteps,
        'Хмарка має бути <b>однією фігурою</b> з чорним обведенням — без ліній усередині.',
        'Три однакові сині краплі — на одній лінії й з <b>однаковими проміжками</b>.',
        'Наприкінці — <b>згрупуй</b>.'],
      start: [], sampleLive: CLOUD_T, open: true, guideLive: () => ({ ghostObjs: ghostOf(CLOUD_T()) }),
      checks(H) {
        const s = H.sim(CLOUD_T()).sim;
        const whites = H.closed.filter(o => o.f === WHITE && o.s && o.w >= 2);
        const biggest = H.closed.slice().sort((a, b) => { const A = H.bb(a), B = H.bb(b); return B.w * B.h - A.w * A.h; })[0];
        const blues = H.closed.filter(o => o.f === BLUE).map(o => H.bb(o)).sort((a, b) => a.cx - b.cx);
        let row = false;
        if (blues.length >= 3) {
          const b3 = blues.slice(0, 3), d1 = b3[1].cx - b3[0].cx, d2 = b3[2].cx - b3[1].cx;
          row = b3.every(b => Math.abs(b.cy - b3[0].cy) <= 2) && Math.abs(d1 - d2) <= 2 && d1 > 5;
        }
        return [
          chk('Малюнок збігається зі зразком', H.ramp(s, 0.5, 0.8), 'Малюй поверх напівпрозорого зразка: ті самі місця, розміри й кольори.', 3),
          chk('Хмарка — одна фігура з обведенням', whites.length === 1 && biggest === whites[0], 'Виділи всі частини хмарки → Unite (або Shape Builder). Обведення — чорне.'),
          chk('Три сині краплі', blues.length >= 3, 'Крапля: перо (гострий верх кліком, далі натисни й тягни) або еліпс + біла стрілка.'),
          chk('Краплі на одній лінії з однаковими проміжками', row, 'Align: «По центру (вертикально)» і «Розподілити по горизонталі».'),
          chk('Усе згруповано', H.grouped(), 'Виділи все → «Згрупувати».')
        ];
      } },
    { id: 'o2', title: 'Чашка кави', tool: 'будь-які інструменти',
      steps: [traceSteps,
        '<b>Ручка-кільце</b>: можна Pathfinder (коло мінус коло) або коло лише з товстим обведенням — обидва способи правильні.',
        '<b>Пара</b> — відкриті лінії пером без заливки.',
        'Не забудь порядок (блюдце й ручка — позаду чашки) і <b>групування</b>.'],
      start: [], sampleLive: () => CUP_T, open: true, guideLive: () => ({ ghostObjs: ghostOf(CUP_T) }),
      checks(H) {
        const s = H.sim(CUP_T).sim;
        const ring = H.closed.some(o => o.sp.length >= 2 || (!o.f && o.s && o.w >= 8));
        const steam = H.open.some(o => !o.f && o.s);
        const cup = H.closed.some(o => o.f === ORANGE && o.s);
        return [
          chk('Малюнок збігається зі зразком', H.ramp(s, 0.5, 0.8), 'Малюй поверх напівпрозорого зразка: форма, кольори й порядок об’єктів.', 3),
          chk('Ручка — кільце з діркою', ring, 'Коло мінус коло (Minus Front) або коло без заливки з товстим обведенням.'),
          chk('Пара — відкриті лінії без заливки', steam, 'Перо: кілька точок, Enter, потім «Заливка» → без кольору.'),
          chk('Чашка з обведенням', cup, 'Помаранчева заливка + чорне обведення.'),
          chk('Усе згруповано', H.grouped(), 'Виділи все → «Згрупувати».')
        ];
      } },
    { id: 'o3', title: 'Лампочка', tool: 'будь-які інструменти',
      steps: [traceSteps,
        '<b>Колба</b> — коло й прямокутник, об’єднані в <b>одну</b> фігуру (Unite або Shape Builder). Жовта, з чорним обведенням.',
        '<b>Цоколь</b> — три сірі смужки рівно під колбою з <b>однаковими проміжками</b> (Align).',
        '<b>Нитка й промені</b> — відкриті лінії пером, без заливки, помаранчеве обведення. Наприкінці — <b>згрупуй</b>.'],
      start: [], sampleLive: BULB_T, open: true, guideLive: () => ({ ghostObjs: ghostOf(BULB_T()) }),
      checks(H) {
        const s = H.sim(BULB_T()).sim;
        const glass = H.closed.filter(o => o.f === YELLOW && o.s && o.w >= 2 && (() => { const b = H.bb(o); return b.w > 120 && b.h > 150; })());
        const greys = H.closed.filter(o => o.f === GREY).map(o => H.bb(o)).sort((a, b) => a.cy - b.cy);
        let base = false;
        if (greys.length >= 3) {
          const g = greys.slice(0, 3), d1 = g[1].cy - g[0].cy, d2 = g[2].cy - g[1].cy;
          base = Math.max(...g.map(b => b.cx)) - Math.min(...g.map(b => b.cx)) <= 2 && Math.abs(d1 - d2) <= 2 && d1 > 3;
        }
        const lines = H.open.filter(o => !o.f && o.s && o.w >= 2);
        return [
          chk('Малюнок збігається зі зразком', H.ramp(s, 0.5, 0.8), 'Малюй поверх напівпрозорого зразка: ті самі місця, розміри й кольори.', 3),
          chk('Колба — одна жовта фігура з обведенням', glass.length === 1, 'Коло + прямокутник → Unite. Заливка жовта, обведення чорне.'),
          chk('Цоколь: три смужки по центру, проміжки однакові', base, 'Виділи три сірі смужки → «По центру (горизонтально)» і «Розподілити по вертикалі».'),
          chk('Нитка й промені — відкриті лінії без заливки (щонайменше 4)', lines.length >= 4, 'Перо: точки → Enter. Потім «Заливка» → без кольору.'),
          chk('Усе згруповано', H.grouped(), 'Виділи все → «Згрупувати».')
        ];
      } }
  ];

  /* ======================= 9. Моя іконка ======================= */
  const FREE = [
    { id: 'm1', title: 'Моя іконка', tool: 'усі інструменти · вільна тема', free: true,
      steps: [
        'Намалюй <b>власну іконку</b>: тварину, предмет, емблему гуртка — що завгодно.',
        'Мінімальні правила: щонайменше <b>4 об’єкти</b>, хоча б <b>одна крива пером</b>, щонайменше <b>2 кольори</b>, наприкінці <b>згрупуй</b> усе.',
        'Усе інше — на твій смак: Shape Builder, Pathfinder, вирівнювання, обведення. «Перевірити» показує, які правила вже виконано.'
      ],
      start: [],
      checks(H) {
        const cols = new Set();
        H.objs.forEach(o => { if (o.f) cols.add(o.f); if (o.s) cols.add(o.s); });
        return [
          chk('Щонайменше 4 об’єкти', H.objs.length >= 4, 'Додай деталі: очі, промені, тінь, візерунок.'),
          chk('Є крива, намальована пером', H.pens.some(C.hasCurve), 'Перо: натисни й тягни, щоб вийшла крива.'),
          chk('Щонайменше 2 кольори', cols.size >= 2, 'Заливка й обведення різних кольорів теж рахуються.'),
          chk('Усе згруповано', H.grouped(), 'Виділи все → «Згрупувати» (Ctrl+G).')
        ];
      } }
  ];

  const SETS = {
    shapes: { levels: SHAPES, mode: 'mean', rubric: 'Оцінка — середнє за 3 малюнки. Кожен: частка виконаних пунктів перевірки.' },
    sb: { levels: SBP, mode: 'mean', rubric: 'Оцінка — середнє за 8 пазлів. Кожен: частка виконаних пунктів перевірки.' },
    pen1: { levels: PEN1, mode: 'mean', rubric: 'Оцінка — середнє за 7 рівнів. Кожен: частка виконаних пунктів перевірки (форма, замикання, криві, кількість точок).' },
    pen2: { levels: PEN2, mode: 'mean', rubric: 'Оцінка — середнє за 5 рівнів. Кожен: частка виконаних пунктів перевірки (форма, зламана ручка, кількість точок).' },
    penfix: { levels: FIX, mode: 'mean', rubric: 'Оцінка — середнє за 4 контури. Кожен: частка виконаних пунктів перевірки.' },
    drills: { levels: DRILLS, mode: 'mean', rubric: 'Оцінка — середнє за 8 вправ. Кожна вправа: частка виконаних пунктів перевірки.' },
    guided: { levels: GUIDED, mode: 'mean', rubric: 'Оцінка — середнє за 3 малюнки. Кожен: частка виконаних пунктів перевірки.' },
    open: { levels: OPEN, mode: 'best', rubric: 'Обери один малюнок. Зараховується найкращий результат серед трьох.' },
    free: { levels: FREE, mode: 'mean', rubric: 'Оцінка — частка виконаних правил.' }
  };

  function runChecks(L, doc) {
    try { return L.checks(helpers(doc)); }
    catch (e) { return [chk('Перевірка не вдалася — спробуй ще раз', false, String(e && e.message || e))]; }
  }
  function scoreOf(list) {
    const tw = list.reduce((s, c) => s + c.w, 0) || 1;
    return Math.round(100 * list.reduce((s, c) => s + c.w * c.ok, 0) / tw);
  }
  function startDoc(L) {
    const objs = (L.start || []).map((o, i) => ({ id: 's' + i, sp: C.clone(o.sp), f: o.f, s: o.s, w: o.w, g: null, k: 'start' }));
    return { n: 1, ops: {}, objs };
  }
  function thumb(objs, crop) {
    const NS = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(NS, 'svg');
    let vb = `0 0 ${C.W} ${C.H}`;
    if (crop) { const b = C.bbox(objs); if (b) { const m = 18; vb = `${b.x - m} ${b.y - m} ${b.w + 2 * m} ${b.h + 2 * m}`; } }
    svg.setAttribute('viewBox', vb); svg.setAttribute('class', 'ail-thumb'); svg.setAttribute('role', 'img'); svg.setAttribute('aria-label', 'Зразок');
    for (const o of objs) {
      const p = document.createElementNS(NS, 'path');
      p.setAttribute('d', C.toD(o)); p.setAttribute('fill', o.f || 'none'); p.setAttribute('fill-rule', 'evenodd');
      p.setAttribute('stroke', o.s || 'none'); p.setAttribute('stroke-width', o.s ? o.w : 0); p.setAttribute('stroke-miterlimit', 10);
      svg.appendChild(p);
    }
    return svg;
  }

  const guideOf = L => L.guide || (L.guideLive ? L.guideLive() : null);
  /* the same legend everywhere a level has pen points; the slides use the same symbols */
  const LEGEND_HTML = '<span class="ail-lg"><svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><circle cx="12" cy="12" r="10" fill="#FF7A00" stroke="#fff" stroke-width="2"/><text x="12" y="16.5" text-anchor="middle" font-size="12" font-weight="800" fill="#fff">1</text></svg><b>клік</b> у точку</span>' +
    '<span class="ail-lg"><svg viewBox="0 0 54 24" width="50" height="22" aria-hidden="true"><path d="M4 12 H36" stroke="#7A3FD1" stroke-width="3" stroke-linecap="round"/><path d="M38 12 l-9 -5 v10z" fill="#7A3FD1"/><circle cx="45" cy="12" r="7" fill="#fff" stroke="#7A3FD1" stroke-width="2.5"/></svg><b>натисни й тягни</b> до кружечка</span>' +
    '<span class="ail-lg"><svg viewBox="0 0 34 22" width="34" height="22" aria-hidden="true"><rect x="1" y="2" width="32" height="18" rx="9" fill="#7A3FD1"/><text x="17" y="15.5" text-anchor="middle" font-size="12" font-weight="800" fill="#fff">Alt</text></svg><b>Alt + клік</b> по цій точці</span>' +
    '<span class="ail-lg"><svg viewBox="0 0 54 24" width="50" height="22" aria-hidden="true"><path d="M4 12 H36" stroke="#7A3FD1" stroke-width="3" stroke-dasharray="6 4" stroke-linecap="round"/><path d="M38 12 l-9 -5 v10z" fill="#7A3FD1"/><circle cx="45" cy="12" r="7" fill="#fff" stroke="#7A3FD1" stroke-width="2.5"/></svg><b>Alt + тягни</b></span>' +
    '<span class="ail-lg"><b class="ail-lg-o">○</b> біля пера — <b>клік</b> замкне контур · <b>Enter</b> — завершити лінію</span>';

  window.Games = window.Games || {};
  window.AiLevelsDebug = { SETS, runChecks, scoreOf, helpers };   // used by the lesson's local tests only
  window.Games['ai-levels'] = {
    readonlyView: true,
    mount(host, ctx) {
      const life = K.lifecycle();
      const h = K.h;
      const data = ctx.task.data || {};
      const SET = SETS[data.set] || SETS.drills;
      const LV = SET.levels;
      const d0 = (ctx.saved && ctx.saved.details) || {};
      const ret = K.returnInfo(ctx);
      let locked = K.isLocked(ctx), busy = false;
      const lv = {};
      LV.forEach(L => {
        const s = d0.lv && d0.lv[L.id];
        lv[L.id] = s && s.doc ? { doc: s.doc, sc: s.sc == null ? null : s.sc, t: !!s.t, dirty: !!s.dirty } : { doc: C.packDoc(startDoc(L)), sc: null, t: false, dirty: false };
      });
      let cur = Math.max(0, Math.min(LV.length - 1, d0.cur | 0));
      let showGuide = true;

      const status = h('p', { class: 'ail-status', role: 'status', 'aria-live': 'polite' });
      const save = K.saver(ctx, {
        life,
        getDetails: () => ({ v: 1, set: data.set || 'drills', cur, lv, ack: ret.ack }),
        onError: (e, final) => { if (!life.disposed && !final) status.textContent = e && e.code === 'details_too_large' ? e.message : 'Чернетку не збережено. Робота залишається на екрані — спробуй ще раз пізніше.'; }
      });

      const root = h('div', { class: 'ail', tabindex: '0', 'aria-label': 'Міні-Illustrator' });
      const tabs = h('div', { class: 'ail-tabs', role: 'tablist', 'aria-label': 'Рівні' });
      const total = h('div', { class: 'ail-total' });
      const kicker = h('div', { class: 'ail-kicker' });
      const title = h('h3', { class: 'ail-title' });
      const steps = h('ol', { class: 'ail-steps' });
      const sampleBox = h('div', { class: 'ail-sample' });
      const guideToggle = h('input', { type: 'checkbox', checked: true, 'data-readonly-ok': '' });
      const guideLbl = h('label', { class: 'ail-guidelbl' }, guideToggle, ' Підказки на полотні');
      const legend = h('div', { class: 'ail-legend', html: LEGEND_HTML });
      const checkBtn = h('button', { type: 'button', class: 'btn primary' }, '✓ Перевірити');
      const resetBtn = h('button', { type: 'button', class: 'btn ghost small' }, '⟲ Почати рівень заново');
      const checks = h('ul', { class: 'ail-checks', 'aria-live': 'polite' });
      const lvScore = h('div', { class: 'ail-lvscore' });
      const submit = h('button', { type: 'button', class: 'btn primary big' }, 'Завершити завдання');
      const rubric = h('p', { class: 'ail-rubric', html: SET.rubric + ' «Перевірити» можна скільки завгодно разів — підсумок з’явиться після «Завершити завдання».' });

      const editor = E.create({
        life, doc: C.unpackDoc(lv[LV[cur].id].doc), guide: guideOf(LV[cur]), locked, keyTarget: root, focusTarget: root,
        onChange(doc) {
          if (locked) return;
          const s = lv[LV[cur].id];
          s.doc = C.packDoc(doc); s.t = true; s.dirty = true;
          renderChecks(null); renderTabs();
          save.draft();
        }
      });

      const card = h('div', { class: 'ail-card' }, h('div', { class: 'ail-cardtext' }, kicker, title, steps, legend, guideLbl), sampleBox);
      const side = h('div', { class: 'ail-side' }, h('div', { class: 'ail-actions' }, checkBtn, resetBtn), lvScore, checks, editor.panelsEl);
      root.append(...K.banners(ctx),
        h('div', { class: 'ail-top' }, tabs, total),
        card,
        h('div', { class: 'ail-body' }, editor.editorEl, side),
        h('div', { class: 'ail-foot' }, rubric, h('div', { class: 'ail-submitrow' }, submit, status)));
      host.append(root);

      function levelScore(L) { const s = lv[L.id]; return s.t ? scoreOf(runChecks(L, C.unpackDoc(s.doc))) : 0; }
      function taskScore(scores) {
        if (!scores.length) return 0;
        return SET.mode === 'best' ? Math.max(...scores) : Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
      }
      function shownTotal() { return taskScore(LV.map(L => lv[L.id].sc || 0)); }
      function renderTabs() {
        tabs.textContent = '';
        LV.forEach((L, i) => {
          const s = lv[L.id];
          const mark = s.sc == null ? (s.t ? '…' : '·') : (s.sc === 100 ? '✓ 100%' : s.sc + '%');
          const b = h('button', { type: 'button', role: 'tab', class: 'ail-tab' + (i === cur ? ' cur' : '') + (s.sc === 100 ? ' done' : ''), 'aria-selected': String(i === cur), 'data-readonly-ok': '', title: L.title },
            h('b', { text: String(i + 1) }), h('span', { class: 'ail-tabname', text: L.title }), h('small', { text: mark }));
          life.listen(b, 'click', () => go(i));
          tabs.append(b);
        });
        total.innerHTML = '';
        total.append('Результат: ', h('b', { text: shownTotal() + '%' }));
        if (SET.mode === 'best') total.append(h('small', { text: ' (найкращий рівень)' }));
      }
      function renderCard() {
        const L = LV[cur];
        kicker.textContent = `Рівень ${cur + 1} з ${LV.length} · ${L.tool}`;
        title.textContent = L.title;
        steps.innerHTML = L.steps.map(s => `<li>${s}</li>`).join('');
        sampleBox.textContent = '';
        sampleBox.classList.toggle('hidden', !(L.sample || L.sampleLive));
        const smp = L.sample || (L.sampleLive && L.sampleLive());
        if (smp) sampleBox.append(h('div', { class: 'ail-samplelbl', text: 'Зразок' }), thumb(smp, !!L.open));
        guideLbl.classList.toggle('hidden', !guideOf(L));
        legend.classList.toggle('hidden', !L.legend);
        guideLbl.lastChild.textContent = L.open ? ' Напівпрозорий зразок під полотном' : ' Підказки на полотні';
      }
      function renderChecks(list) {
        checks.textContent = '';
        const s = lv[LV[cur].id];
        if (!list) {
          if (s.sc != null && s.dirty) lvScore.textContent = `Остання перевірка: ${s.sc}%. Є зміни — натисни «Перевірити» ще раз.`;
          else if (s.sc != null) lvScore.textContent = `Результат рівня: ${s.sc}%`;
          else lvScore.textContent = 'Натисни «Перевірити», щоб побачити, що вже вийшло.';
          return;
        }
        list.forEach(c => {
          const full = c.ok >= 0.999, part = !full && c.ok > 0;
          const li = h('li', { class: full ? 'ok' : part ? 'part' : 'bad' },
            h('span', { class: 'ail-ico', 'aria-hidden': 'true', text: full ? '✓' : part ? '◐' : '✗' }),
            h('span', null, h('b', { text: c.t + (part ? ` — ${Math.round(c.ok * 100)}%` : '') }), (!full && c.hint) ? h('small', { text: c.hint }) : null),
            h('span', { class: 'sr-only', text: full ? ' виконано' : part ? ' частково' : ' не виконано' }));
          checks.append(li);
        });
        lvScore.textContent = `Результат рівня: ${s.sc}%`;
      }
      function render() {
        renderTabs(); renderCard();
        submit.classList.toggle('hidden', locked);
        submit.disabled = busy;
        checkBtn.classList.toggle('hidden', locked);
        resetBtn.classList.toggle('hidden', locked);
        checkBtn.disabled = busy; resetBtn.disabled = busy;
      }
      function go(i) {
        if (i === cur) return;
        editor.finishPen();
        cur = i;
        const L = LV[cur];
        editor.setDoc(C.unpackDoc(lv[L.id].doc), guideOf(L));
        editor.setGuideVisible(showGuide);
        if (!locked && L.tool0) editor.setTool(L.tool0);
        render();
        const s = lv[L.id];
        if (s.sc != null && !s.dirty) renderChecks(runChecks(L, C.unpackDoc(s.doc)));
        else renderChecks(null);
        if (!locked) save.draft();
      }
      life.listen(guideToggle, 'change', () => { showGuide = guideToggle.checked; editor.setGuideVisible(showGuide); });
      life.listen(checkBtn, 'click', () => {
        if (locked || busy) return;
        editor.finishPen();
        const L = LV[cur], s = lv[L.id];
        const list = runChecks(L, C.unpackDoc(s.doc));
        s.sc = s.t ? scoreOf(list) : 0; s.dirty = false;
        if (!s.t) list.forEach(c => { c.ok = 0; });
        renderChecks(list); renderTabs();
        status.textContent = s.sc === 100 ? 'Рівень виконано повністю! Переходь до наступного.' : `Рівень: ${s.sc}%. Виправ пункти з ✗ і перевір ще раз.`;
        save.draft();
      });
      life.listen(resetBtn, 'click', async () => {
        if (locked || busy) return;
        const ok = await K.confirm({ title: 'Почати рівень заново?', html: '<p>Малюнок на цьому рівні повернеться до початкового стану. Інші рівні не зміняться.</p>', ok: 'Почати заново', cancel: 'Скасувати', danger: true });
        if (!ok || life.disposed || locked) return;
        const L = LV[cur];
        lv[L.id] = { doc: C.packDoc(startDoc(L)), sc: null, t: false, dirty: false };
        editor.setDoc(startDoc(L), guideOf(L));
        if (L.tool0) editor.setTool(L.tool0);
        render(); renderChecks(null);
        save.draft();
      });
      life.listen(submit, 'click', async () => {
        if (locked || busy) return;
        editor.finishPen();
        // fresh scores for every level
        const scores = LV.map(L => { const sc = levelScore(L); const s = lv[L.id]; if (s.t) { s.sc = sc; s.dirty = false; } return sc; });
        renderTabs();
        const final = taskScore(scores);
        const missing = LV.map((L, i) => ({ L, sc: scores[i], t: lv[L.id].t })).filter(x => x.sc < 100);
        const needConfirm = SET.mode === 'best' ? final < 100 : missing.length > 0;
        if (needConfirm) {
          const items = SET.mode === 'best'
            ? `<p>Найкращий рівень зараз: <b>${final}%</b>.</p>`
            : '<ul>' + missing.map(x => `<li>${K.esc(x.L.title)} — ${x.t ? x.sc + '%' : 'не почато'}</li>`).join('') + '</ul>';
          const ok = await K.confirm({ title: 'Не всі рівні виконано', html: `${items}<p>Після завершення змінювати малюнки вже не можна. Результат: <b>${final}%</b>.</p>`, ok: 'Завершити так', cancel: 'Ще попрацюю' });
          if (!ok || life.disposed || locked) return;
        }
        busy = true; render(); status.textContent = 'Підбиваю підсумок…';
        try {
          await save.final(final);
          if (life.disposed) return;
          locked = true; editor.setLocked(true);
          status.textContent = `Завершено. Результат: ${final}%.`;
        } catch (e) {
          if (!life.disposed) status.textContent = 'Не вдалося завершити. Натисни «Завершити завдання» ще раз.';
        } finally { busy = false; if (!life.disposed) render(); }
      });

      render();
      if (!locked && LV[cur].tool0) editor.setTool(LV[cur].tool0);
      const s0 = lv[LV[cur].id];
      if (s0.sc != null && !s0.dirty) renderChecks(runChecks(LV[cur], C.unpackDoc(s0.doc))); else renderChecks(null);
      if (locked && ctx.saved && ctx.saved.final) status.textContent = `Завершено. Результат: ${ctx.saved.score}%.`;
      if (ret.isNew && !locked) save.draft();
      return () => life.dispose();
    }
  };
})();
