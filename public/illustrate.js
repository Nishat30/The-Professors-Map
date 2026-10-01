// Ink illustrations for the map: castles, towers, the gatehouse, the pond and its trees.
// Every function draws into an SVG group; positions come from the room rectangles in config.js.
(function (root) {
  const NS = 'http://www.w3.org/2000/svg';
  const C = {
    ink: '#4a2e14', soft: '#7a5530', red: '#7d1d1d', paper: '#f3e6c6',
    stone: '#ead7aa', roof: '#d6ba82', dark: '#4f321a', water: 'rgba(150,108,58,0.10)', leaf: '#e4d09f',
  };

  const el = (tag, attrs = {}, parent) => {
    const n = document.createElementNS(NS, tag);
    for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v);
    if (parent) parent.appendChild(n);
    return n;
  };
  const pts = (arr) => arr.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
  const line = (g, x1, y1, x2, y2, stroke = C.ink, w = 1, extra = {}) =>
    el('line', { x1, y1, x2, y2, stroke, 'stroke-width': w, ...extra }, g);

  // Seeded randomness, so the drawing is identical on every redraw.
  let seed = 1;
  const reseed = (n) => { seed = n; };
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const between = (a, b) => a + rnd() * (b - a);

  // ---- building blocks -------------------------------------------------------------------------
  function battlements(g, x1, x2, y, ink = C.ink, size = 5) {
    const n = Math.max(2, Math.round((x2 - x1) / (size * 2)));
    const step = (x2 - x1) / n;
    let d = `M${x1},${y}`;
    for (let i = 0; i < n; i++) {
      const a = x1 + i * step;
      d += ` L${a},${y - size} L${a + step * 0.55},${y - size} L${a + step * 0.55},${y} L${a + step},${y}`;
    }
    el('path', { d: d + ` L${x2},${y + 2} L${x1},${y + 2} Z`, fill: C.stone, stroke: ink, 'stroke-width': 1.1, 'stroke-linejoin': 'round' }, g);
  }

  function stoneCourses(g, x1, y1, x2, y2) {
    for (let y = y1 + 7, row = 0; y < y2 - 2; y += 7, row++) {
      line(g, x1 + 1, y, x2 - 1, y, C.soft, 0.4, { opacity: 0.55 });
      for (let x = x1 + (row % 2 ? 6 : 12); x < x2 - 3; x += 12) line(g, x, y - 7, x, y, C.soft, 0.4, { opacity: 0.45 });
    }
  }

  function archDoor(g, cx, bottom, w, h, ink = C.ink) {
    const r = w / 2;
    el('path', { d: `M${cx - r},${bottom} V${bottom - h + r} A${r},${r} 0 0 1 ${cx + r},${bottom - h + r} V${bottom} Z`, fill: C.dark, stroke: ink, 'stroke-width': 1 }, g);
    line(g, cx, bottom - h + 2, cx, bottom, C.soft, 0.6);
  }

  function slit(g, cx, cy, w = 3, h = 7) {
    el('path', { d: `M${cx - w / 2},${cy + h / 2} V${cy - h / 2 + w / 2} A${w / 2},${w / 2} 0 0 1 ${cx + w / 2},${cy - h / 2 + w / 2} V${cy + h / 2} Z`, fill: C.dark }, g);
  }

  function pennant(g, x, y, ink = C.red, flip = false) {
    line(g, x, y, x, y - 12, C.ink, 0.9);
    const s = flip ? -1 : 1;
    el('path', { d: `M${x},${y - 12} Q${x + 7 * s},${y - 13} ${x + 13 * s},${y - 9} Q${x + 7 * s},${y - 8} ${x},${y - 6.5} Z`, fill: ink, stroke: C.ink, 'stroke-width': 0.6 }, g);
  }

  // A round tower seen from the front: body, shading, a conical roof and an optional flag.
  function tower(g, x, w, top, bottom, { roofH = 18, flag = false, ink = C.ink, flipFlag = false } = {}) {
    el('rect', { x, y: top, width: w, height: bottom - top, fill: C.stone, stroke: ink, 'stroke-width': 1.2 }, g);
    for (let i = 1; i <= 3; i++) line(g, x + w - i * 2.2, top + 3, x + w - i * 2.2, bottom - 1, C.soft, 0.5, { opacity: 0.6 });
    line(g, x - 1.5, top + 3, x + w + 1.5, top + 3, ink, 0.8);
    slit(g, x + w / 2, top + (bottom - top) * 0.45);
    const apex = [x + w / 2, top - roofH];
    el('polygon', { points: pts([[x - 2.5, top + 1], apex, [x + w + 2.5, top + 1]]), fill: C.roof, stroke: ink, 'stroke-width': 1.2, 'stroke-linejoin': 'round' }, g);
    for (let i = 1; i <= 3; i++) line(g, apex[0], apex[1], x + w + 2.5 - i * (w / 4), top + 1, C.soft, 0.5, { opacity: 0.7 });
    if (flag) pennant(g, apex[0], apex[1], C.red, flipFlag);
  }

  // ---- rooms -------------------------------------------------------------------------------------
  // Classroom: a small castle. Returns where its name ribbon should sit.
  function castle(g, [x1, y1, x2, y2], { flag = true } = {}) {
    const w = x2 - x1, h = y2 - y1, cx = (x1 + x2) / 2;
    const tw = Math.max(13, Math.min(22, w * 0.17));
    const wallTop = y1 + h * 0.5, base = y2 - 3, towerTop = y1 + h * 0.3;
    // the keep, peeking over the curtain wall
    const kw = Math.min(40, w * 0.34);
    el('rect', { x: cx - kw / 2, y: y1 + h * 0.2, width: kw, height: wallTop - y1 - h * 0.2, fill: C.stone, stroke: C.ink, 'stroke-width': 1.1 }, g);
    battlements(g, cx - kw / 2, cx + kw / 2, y1 + h * 0.2, C.ink, 4);
    // curtain wall
    el('rect', { x: x1 + tw - 3, y: wallTop, width: w - 2 * tw + 6, height: base - wallTop, fill: C.stone, stroke: C.ink, 'stroke-width': 1.3 }, g);
    stoneCourses(g, x1 + tw - 3, wallTop, x2 - tw + 3, base);
    battlements(g, x1 + tw - 3, x2 - tw + 3, wallTop);
    archDoor(g, cx, base, 11, 15);
    slit(g, cx - w * 0.2, wallTop + 11, 4, 7);
    slit(g, cx + w * 0.2, wallTop + 11, 4, 7);
    tower(g, x1 + 1, tw, towerTop, base, { roofH: h * 0.24 });
    tower(g, x2 - 1 - tw, tw, towerTop, base, { roofH: h * 0.24, flag });
    el('line', { x1: x1 - 2, y1: base + 1.5, x2: x2 + 2, y2: base + 1.5, stroke: C.ink, 'stroke-width': 1.4 }, g);
    return { x: cx, y: y1 + h * 0.2 };
  }

  // Staff rooms and the HOD office: a long hall with a tiled roof. The HOD gets a flag tower.
  function hall(g, [x1, y1, x2, y2], { hod = false } = {}) {
    const w = x2 - x1, h = y2 - y1, cx = (x1 + x2) / 2;
    const ink = hod ? C.red : C.ink;
    const roofBase = y1 + h * 0.46, base = y2 - 3;
    el('rect', { x: x1 + 6, y: roofBase, width: w - 12, height: base - roofBase, fill: C.stone, stroke: ink, 'stroke-width': 1.3 }, g);
    stoneCourses(g, x1 + 6, roofBase, x2 - 6, base);
    el('polygon', { points: pts([[x1 + 1, roofBase + 1], [x1 + 15, y1 + 5], [x2 - 15, y1 + 5], [x2 - 1, roofBase + 1]]), fill: C.roof, stroke: ink, 'stroke-width': 1.3, 'stroke-linejoin': 'round' }, g);
    for (let x = x1 + 20; x < x2 - 12; x += 7) line(g, x, y1 + 6, x - 8, roofBase, C.soft, 0.5, { opacity: 0.6 });
    el('rect', { x: x2 - 30, y: y1 - 2, width: 7, height: 10, fill: C.stone, stroke: ink, 'stroke-width': 1 }, g); // chimney
    const n = Math.max(2, Math.floor((w - 40) / 16));
    for (let i = 0; i < n; i++) {
      const wx = x1 + 16 + (i + 0.5) * ((w - 32) / n);
      if (Math.abs(wx - cx) > 9) slit(g, wx, roofBase + (base - roofBase) * 0.45, 5, 9);
    }
    archDoor(g, cx, base, 12, 17, ink);
    if (hod) tower(g, x2 - 26, 18, y1 + 4, base, { roofH: 22, flag: true, ink: C.red });
    return { x: hod ? cx - 10 : cx, y: y1 + h * 0.26 };
  }

  // ---- the spooky wing --------------------------------------------------------------------------
  function bat(g, x, y, s = 1) {
    el('path', { d: `M${x},${y} Q${x - 3 * s},${y - 5 * s} ${x - 11 * s},${y - 4 * s} Q${x - 8 * s},${y - 1 * s} ${x - 8 * s},${y + 2 * s} Q${x - 6 * s},${y} ${x - 4 * s},${y + 2 * s} Q${x - 2 * s},${y} ${x},${y + 2.5 * s} Q${x + 2 * s},${y} ${x + 4 * s},${y + 2 * s} Q${x + 6 * s},${y} ${x + 8 * s},${y + 2 * s} Q${x + 8 * s},${y - 1 * s} ${x + 11 * s},${y - 4 * s} Q${x + 3 * s},${y - 5 * s} ${x},${y} Z`, fill: C.ink }, g);
    el('path', { d: `M${x - 1.5 * s},${y - 0.5 * s} l${-0.5 * s},${-2 * s} l${1 * s},${1 * s} M${x + 1.5 * s},${y - 0.5 * s} l${0.5 * s},${-2 * s} l${-1 * s},${1 * s}`, stroke: C.ink, 'stroke-width': 0.8, fill: 'none' }, g);
  }

  function gothicArch(g, cx, bottom, w, h, fill, ink = C.ink) {
    el('path', { d: `M${cx - w / 2},${bottom} V${bottom - h * 0.55} Q${cx - w / 2},${bottom - h * 0.92} ${cx},${bottom - h} Q${cx + w / 2},${bottom - h * 0.92} ${cx + w / 2},${bottom - h * 0.55} V${bottom} Z`, fill, stroke: ink, 'stroke-width': 1 }, g);
  }

  function cobweb(g, x, y, r, dir = 1) {
    for (let i = 0; i <= 4; i++) {
      const a = (i / 4) * (Math.PI / 2);
      line(g, x, y, x + Math.cos(a) * r * dir, y + Math.sin(a) * r, C.ink, 0.45, { opacity: 0.7 });
    }
    for (const k of [0.35, 0.65, 0.95]) {
      let d = '';
      for (let i = 0; i <= 4; i++) {
        const a = (i / 4) * (Math.PI / 2);
        const px = x + Math.cos(a) * r * k * dir, py = y + Math.sin(a) * r * k;
        d += i ? ` Q${x + Math.cos(a - 0.2) * r * k * 0.8 * dir},${y + Math.sin(a - 0.2) * r * k * 0.8} ${px},${py}` : `M${px},${py}`;
      }
      el('path', { d, stroke: C.ink, 'stroke-width': 0.45, fill: 'none', opacity: 0.7 }, g);
    }
  }

  function crack(g, x, y, len, s = 1) {
    el('path', { d: `M${x},${y} l${2 * s},${len * 0.3} l${-3 * s},${len * 0.25} l${2.5 * s},${len * 0.25} l${-1.5 * s},${len * 0.2}`, stroke: C.ink, 'stroke-width': 0.7, fill: 'none' }, g);
  }

  // Staff rooms: a crooked haunted hall with a broken roof, glowing windows and bats.
  function hauntedHall(g, [x1, y1, x2, y2]) {
    const w = x2 - x1, h = y2 - y1, cx = (x1 + x2) / 2;
    const eaveL = y1 + h * 0.46, eaveR = y1 + h * 0.4, base = y2 - 3;
    // leaning walls
    el('polygon', { points: pts([[x1 + 6, base], [x1 + 10, eaveL], [x2 - 3, eaveR], [x2 - 7, base]]), fill: '#e0c898', stroke: C.ink, 'stroke-width': 1.4, 'stroke-linejoin': 'round' }, g);
    stoneCourses(g, x1 + 10, eaveL + 2, x2 - 8, base);
    for (let i = 0; i < 7; i++) line(g, x2 - 8 - i * 3, eaveR + 3, x2 - 12 - i * 3, base - 1, C.ink, 0.45, { opacity: 0.55 }); // shade
    // jagged, broken roof
    el('polygon', { points: pts([[x1 + 2, eaveL + 1], [x1 + w * 0.36, y1 + 2], [x1 + w * 0.47, y1 + h * 0.16], [x1 + w * 0.55, y1 + h * 0.1], [x1 + w * 0.7, y1 + h * 0.02], [x2 + 1, eaveR + 1]]), fill: '#6a4a2c', stroke: C.ink, 'stroke-width': 1.3, 'stroke-linejoin': 'round' }, g);
    for (let i = 0; i < 9; i++) {
      const x = between(x1 + 14, x2 - 10), y = between(y1 + h * 0.18, eaveR - 2);
      line(g, x, y, x + 5, y + 1, '#c9a874', 0.8, { opacity: 0.8 }); // loose shingles
    }
    // crooked chimney with smoke
    el('polygon', { points: pts([[x1 + w * 0.2, y1 + h * 0.3], [x1 + w * 0.19, y1 + h * 0.08], [x1 + w * 0.27, y1 + h * 0.06], [x1 + w * 0.28, y1 + h * 0.22]]), fill: '#e0c898', stroke: C.ink, 'stroke-width': 1 }, g);
    el('path', { d: `M${x1 + w * 0.23},${y1 + h * 0.04} c-4,-5 4,-7 0,-12 c-3,-4 3,-6 1,-10`, stroke: C.soft, 'stroke-width': 0.9, fill: 'none' }, g);
    // gothic windows glowing maroon, one boarded up
    const wy = base - (base - eaveL) * 0.35;
    gothicArch(g, x1 + w * 0.24, wy + 7, 8, 14, '#9a2a24');
    gothicArch(g, x1 + w * 0.76, wy + 7, 8, 14, C.dark);
    line(g, x1 + w * 0.76 - 6, wy - 5, x1 + w * 0.76 + 6, wy + 5, '#c9a874', 1.6);
    line(g, x1 + w * 0.76 - 6, wy + 4, x1 + w * 0.76 + 6, wy - 4, '#c9a874', 1.6);
    gothicArch(g, cx, base, 12, 19, C.dark);
    crack(g, x1 + w * 0.36, eaveL + 4, base - eaveL - 8);
    cobweb(g, x1 + 11, eaveL + 1, 10);
    bat(g, x1 + w * 0.5, y1 - 6, 0.8);
    bat(g, x1 + w * 0.8, y1 - 12, 0.6);
    return { x: cx, y: y1 + h * 0.27 };
  }

  // The HOD's office: the dark Headquarters. Black stone, spiked towers, a spire with a long banner,
  // glowing windows, a rose window, a toothed gate and bats circling the top.
  function headquarters(g, [x1, y1, x2, y2]) {
    const w = x2 - x1, h = y2 - y1, cx = (x1 + x2) / 2, base = y2 - 3;
    const DS = '#4a3120', LINE = '#8f6d4a', GLOW = '#b8322a', wallTop = y1 + h * 0.46, tw = 24;
    const spikes = (xa, xb, y, n, hgt) => {
      const step = (xb - xa) / n; let d = `M${xa},${y}`;
      for (let i = 0; i < n; i++) d += ` L${xa + step * (i + 0.5)},${y - hgt} L${xa + step * (i + 1)},${y}`;
      el('path', { d: d + ` L${xb},${y + 2} L${xa},${y + 2} Z`, fill: DS, stroke: C.ink, 'stroke-width': 1 }, g);
    };
    const darkCourses = (xa, ya, xb, yb) => {
      for (let y = ya + 7, row = 0; y < yb - 2; y += 7, row++) {
        line(g, xa + 1, y, xb - 1, y, LINE, 0.5, { opacity: 0.8 });
        for (let x = xa + (row % 2 ? 5 : 11); x < xb - 3; x += 12) line(g, x, y - 7, x, y, LINE, 0.5, { opacity: 0.7 });
      }
    };
    // curtain wall
    el('rect', { x: x1 + tw - 4, y: wallTop, width: w - 2 * tw + 8, height: base - wallTop, fill: DS, stroke: C.ink, 'stroke-width': 1.6 }, g);
    darkCourses(x1 + tw - 4, wallTop, x2 - tw + 4, base);
    spikes(x1 + tw - 4, x2 - tw + 4, wallTop, 9, 6);
    // central keep with a spiked crown and the great spire
    const kw = 46, kTop = y1 + h * 0.2;
    el('rect', { x: cx - kw / 2, y: kTop, width: kw, height: base - kTop, fill: DS, stroke: C.ink, 'stroke-width': 1.6 }, g);
    darkCourses(cx - kw / 2, kTop, cx + kw / 2, base);
    spikes(cx - kw / 2 - 3, cx + kw / 2 + 3, kTop, 5, 9);
    el('polygon', { points: pts([[cx - 10, kTop - 4], [cx, y1 - 30], [cx + 10, kTop - 4]]), fill: DS, stroke: C.ink, 'stroke-width': 1.3 }, g);
    line(g, cx, y1 - 30, cx, y1 - 46, C.ink, 1.2);
    el('path', { d: `M${cx},${y1 - 46} C${cx + 16},${y1 - 50} ${cx + 26},${y1 - 40} ${cx + 44},${y1 - 46} C${cx + 36},${y1 - 38} ${cx + 44},${y1 - 32} ${cx + 52},${y1 - 30} C${cx + 32},${y1 - 28} ${cx + 18},${y1 - 38} ${cx},${y1 - 36} Z`, fill: C.red, stroke: C.ink, 'stroke-width': 0.8 }, g);
    // rose window
    const rw = { x: cx, y: kTop + 17 };
    el('circle', { cx: rw.x, cy: rw.y, r: 10, fill: GLOW, stroke: C.ink, 'stroke-width': 1.2 }, g);
    for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2; line(g, rw.x, rw.y, rw.x + Math.cos(a) * 10, rw.y + Math.sin(a) * 10, C.ink, 0.8); }
    el('circle', { cx: rw.x, cy: rw.y, r: 3, fill: C.ink }, g);
    // side towers with needle roofs
    for (const [tx, flip] of [[x1, true], [x2 - tw, false]]) {
      el('rect', { x: tx, y: y1 + h * 0.3, width: tw, height: base - y1 - h * 0.3, fill: DS, stroke: C.ink, 'stroke-width': 1.4 }, g);
      darkCourses(tx, y1 + h * 0.3, tx + tw, base);
      el('polygon', { points: pts([[tx - 3, y1 + h * 0.3 + 1], [tx + tw / 2, y1 - 6], [tx + tw + 3, y1 + h * 0.3 + 1]]), fill: DS, stroke: C.ink, 'stroke-width': 1.3 }, g);
      pennant(g, tx + tw / 2, y1 - 6, C.red, flip);
      gothicArch(g, tx + tw / 2, y1 + h * 0.3 + 22, 7, 13, GLOW);
    }
    // glowing windows along the wall
    for (const wx of [x1 + tw + 8, x2 - tw - 8]) gothicArch(g, wx, wallTop + 20, 7, 12, GLOW);
    // the toothed gate
    const gw = 22, gh = 30;
    gothicArch(g, cx, base, gw, gh, '#1f130a');
    let teeth = `M${cx - gw / 2 + 1},${base - gh * 0.55}`;
    for (let x = cx - gw / 2 + 1; x < cx + gw / 2 - 2; x += 4) teeth += ` L${x + 2},${base - gh * 0.55 + 6} L${x + 4},${base - gh * 0.55}`;
    el('path', { d: teeth, fill: 'none', stroke: '#c9a874', 'stroke-width': 1 }, g);
    for (const s of [-1, 1]) el('circle', { cx: cx + s * 16, cy: base - 26, r: 2, fill: GLOW }, g); // torches
    el('line', { x1: x1 - 4, y1: base + 1.5, x2: x2 + 4, y2: base + 1.5, stroke: C.ink, 'stroke-width': 1.8 }, g);
    for (const [bx, by, bs] of [[cx - 30, y1 - 22, 0.9], [cx + 62, y1 - 12, 0.7], [cx - 52, y1 - 2, 0.6], [cx + 26, y1 - 58, 0.55]]) bat(g, bx, by, bs);
    return { x: cx, y: y2 + 14 };
  }

  // Labs: the wizarding world has no computers, so each lab is a crystal ball with glowing 0s and 1s.
  function crystalLab(g, [x1, y1, x2, y2]) {
    el('rect', { x: x1, y: y1, width: x2 - x1, height: y2 - y1, rx: 3, fill: 'rgba(233,214,168,0.45)', stroke: C.soft, 'stroke-width': 0.8, 'stroke-dasharray': '3 2' }, g);
    const bx = x2 - 14, by = y2 - 15;
    el('circle', { cx: bx, cy: by, r: 11, fill: C.red, opacity: 0.12 }, g);
    el('path', { d: `M${bx - 6},${y2 - 2} L${bx - 4},${by + 6} L${bx + 4},${by + 6} L${bx + 6},${y2 - 2} Z`, fill: C.roof, stroke: C.ink, 'stroke-width': 1 }, g);
    el('circle', { cx: bx, cy: by, r: 8, fill: '#f4ead2', stroke: C.ink, 'stroke-width': 1.2 }, g);
    el('path', { d: `M${bx - 5},${by + 2} q3,-7 8,-3 q3,3 -2,5`, stroke: C.red, 'stroke-width': 0.7, fill: 'none', opacity: 0.8 }, g);
    const t = el('text', { x: bx, y: by + 2.5, 'text-anchor': 'middle', 'font-family': 'IM Fell English SC', 'font-size': 6.5, fill: C.red }, g);
    t.textContent = '1 0 1';
    el('path', { d: `M${bx - 5},${by - 3} a6,6 0 0 1 4,-4`, stroke: '#fff', 'stroke-width': 1.2, fill: 'none', opacity: 0.9 }, g);
  }

  // Labs: a small round tower beside the key letter.
  function labTower(g, [x1, y1, x2, y2]) {
    el('rect', { x: x1, y: y1, width: x2 - x1, height: y2 - y1, rx: 3, fill: 'rgba(233,214,168,0.45)', stroke: C.soft, 'stroke-width': 0.8, 'stroke-dasharray': '3 2' }, g);
    tower(g, x2 - 19, 13, y1 + 11, y2 - 3, { roofH: 12 });
    return { keyX: x1 + 13, keyY: (y1 + y2) / 2 };
  }

  // Lifts: a clock tower with four arched lift doors.
  function clockLifts(g, [x1, y1, x2, y2]) {
    const cx = (x1 + x2) / 2;
    el('polygon', { points: pts([[cx - 11, y1 + 1], [cx, y1 - 16], [cx + 11, y1 + 1]]), fill: C.roof, stroke: C.ink, 'stroke-width': 1.1 }, g);
    pennant(g, cx, y1 - 16);
    el('rect', { x: x1, y: y1, width: x2 - x1, height: y2 - y1, fill: C.stone, stroke: C.ink, 'stroke-width': 1.6 }, g);
    stoneCourses(g, x1, y1, x2, y2);
    battlements(g, x1, x2, y1, C.ink, 4);
    for (const lx of [x1 + 14, x1 + 25, x2 - 25, x2 - 14]) archDoor(g, lx, y2 - 2, 9, 20);
    el('circle', { cx, cy: y1 + 17, r: 11, fill: C.paper, stroke: C.ink, 'stroke-width': 1.3 }, g);
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      line(g, cx + Math.cos(a) * 8.5, y1 + 17 + Math.sin(a) * 8.5, cx + Math.cos(a) * 10, y1 + 17 + Math.sin(a) * 10, C.ink, 0.8);
    }
    line(g, cx, y1 + 17, cx, y1 + 10, C.ink, 1.2);
    line(g, cx, y1 + 17, cx + 5, y1 + 19, C.ink, 1.2);
  }

  // The moving staircase.
  function stairs(g, [x1, y1, x2, y2]) {
    el('rect', { x: x1, y: y1, width: x2 - x1, height: y2 - y1, rx: 2, fill: C.stone, stroke: C.ink, 'stroke-width': 1.3 }, g);
    const n = 6, sw = (x2 - x1 - 8) / n, sh = (y2 - y1 - 22) / n;
    let d = `M${x1 + 4},${y2 - 3}`;
    for (let i = 0; i < n; i++) d += ` v${-sh} h${sw}`;
    el('path', { d: d + ` V${y2 - 3} Z`, fill: C.roof, stroke: C.ink, 'stroke-width': 1, 'stroke-linejoin': 'round' }, g);
    el('path', { d: `M${x1 + 7},${y1 + 16} q${(x2 - x1) / 2 - 3},-9 ${x2 - x1 - 14},0`, fill: 'none', stroke: C.red, 'stroke-width': 1, 'marker-end': 'url(#arrow)' }, g);
  }

  // Water purifier: a little fountain.
  function fountain(g, [x1, y1, x2, y2]) {
    const cx = (x1 + x2) / 2, w = x2 - x1;
    el('rect', { x: x1, y: y1, width: w, height: y2 - y1, rx: 3, fill: 'rgba(233,214,168,0.45)', stroke: C.soft, 'stroke-width': 0.8, 'stroke-dasharray': '3 2' }, g);
    el('ellipse', { cx, cy: y2 - 9, rx: w * 0.42, ry: 5, fill: C.water, stroke: C.ink, 'stroke-width': 1.1 }, g);
    el('path', { d: `M${cx - w * 0.42},${y2 - 9} v4 a${w * 0.42},5 0 0 0 ${w * 0.84},0 v-4`, fill: C.stone, stroke: C.ink, 'stroke-width': 1.1 }, g);
    el('rect', { x: cx - 2.5, y: y1 + 30, width: 5, height: y2 - y1 - 39, fill: C.stone, stroke: C.ink, 'stroke-width': 1 }, g);
    el('ellipse', { cx, cy: y1 + 30, rx: 9, ry: 3, fill: C.stone, stroke: C.ink, 'stroke-width': 1 }, g);
    for (const s of [-1, 1]) el('path', { d: `M${cx},${y1 + 26} q${7 * s},-8 ${13 * s},${y2 - y1 - 38}`, fill: 'none', stroke: '#5b6f78', 'stroke-width': 0.9, 'stroke-dasharray': '2 2' }, g);
    line(g, cx, y1 + 27, cx, y1 + 20, '#5b6f78', 0.9);
  }

  // Toilets: a small hut.
  function hut(g, [x1, y1, x2, y2], text) {
    const w = x2 - x1, cx = (x1 + x2) / 2, eave = y1 + (y2 - y1) * 0.42, base = y2 - 2;
    el('rect', { x: x1 + 3, y: eave, width: w - 6, height: base - eave, fill: C.stone, stroke: C.ink, 'stroke-width': 1.2 }, g);
    stoneCourses(g, x1 + 3, eave, x2 - 3, base);
    el('polygon', { points: pts([[x1, eave + 1], [cx, y1 + 20], [x2, eave + 1]]), fill: C.roof, stroke: C.ink, 'stroke-width': 1.1 }, g);
    archDoor(g, cx, base, Math.min(10, w * 0.3), 13);
    return { x: cx, y: eave + 11, text };
  }

  // Empty spaces: open courtyards with grass and a couple of trees.
  function courtyard(g, [x1, y1, x2, y2], { avoidX = Infinity } = {}) {
    el('rect', { x: x1, y: y1, width: x2 - x1, height: y2 - y1, rx: 4, fill: 'url(#stipple)', stroke: C.soft, 'stroke-width': 1.1, 'stroke-dasharray': '6 4' }, g);
    const right = Math.min(x2, avoidX) - 8;
    for (let i = 0; i < 9; i++) grassTuft(g, between(x1 + 8, right), between(y1 + 12, y2 - 6));
    const nTrees = right - x1 > 120 ? 3 : 2;
    for (let i = 0; i < nTrees; i++) tree(g, x1 + 18 + (i + 0.5) * ((right - x1 - 30) / nTrees) + between(-6, 6), y2 - between(10, 22), between(0.8, 1.05));
  }

  function grassTuft(g, x, y) {
    el('path', { d: `M${x - 3},${y} q1,-4 0,-6 M${x},${y} q0,-5 1,-8 M${x + 3},${y} q-1,-4 1,-6`, stroke: C.soft, 'stroke-width': 0.7, fill: 'none', opacity: 0.7 }, g);
  }

  // The end of the floor: a thick castle wall with turrets.
  function greatWall(g, [x1, y1, x2, y2]) {
    el('rect', { x: x1, y: y1, width: x2 - x1, height: y2 - y1, rx: 2, fill: C.stone, stroke: C.ink, 'stroke-width': 2 }, g);
    stoneCourses(g, x1, y1, x2, y2);
    // merlons along the corridor-facing side
    for (let y = y1 + 22; y < y2 - 22; y += 14) el('rect', { x: x2, y, width: 5, height: 8, fill: C.stone, stroke: C.ink, 'stroke-width': 1 }, g);
    for (const ty of [y1 + 4, y2 - 4]) {
      el('circle', { cx: x2 - 4, cy: ty, r: 15, fill: C.stone, stroke: C.ink, 'stroke-width': 1.6 }, g);
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2;
        line(g, x2 - 4, ty, x2 - 4 + Math.cos(a) * 15, ty + Math.sin(a) * 15, C.soft, 0.6);
      }
      el('circle', { cx: x2 - 4, cy: ty, r: 2, fill: C.ink }, g);
    }
  }

  // The college entry: a gatehouse with two towers and a portcullis.
  function gatehouse(g, [x1, y1, x2, y2]) {
    const w = x2 - x1, cx = (x1 + x2) / 2, tw = 30, base = y2;
    const wallTop = y1 + 20;
    el('rect', { x: x1 + tw - 4, y: wallTop, width: w - 2 * tw + 8, height: base - wallTop, fill: C.stone, stroke: C.ink, 'stroke-width': 1.5 }, g);
    stoneCourses(g, x1 + tw - 4, wallTop, x2 - tw + 4, base);
    battlements(g, x1 + tw - 4, x2 - tw + 4, wallTop, C.ink, 5);
    // archway + portcullis
    const aw = 38, ah = 36, r = aw / 2;
    el('path', { d: `M${cx - r},${base} V${base - ah + r} A${r},${r} 0 0 1 ${cx + r},${base - ah + r} V${base} Z`, fill: C.dark, stroke: C.ink, 'stroke-width': 1.4 }, g);
    for (let x = cx - r + 6; x < cx + r - 2; x += 6.5) line(g, x, base - ah + 4, x, base, C.stone, 0.9);
    for (let y = base - ah + 10; y < base; y += 7) line(g, cx - r + 2, y, cx + r - 2, y, C.stone, 0.9);
    // voussoirs over the arch
    el('path', { d: `M${cx - r - 4},${base - ah + r} A${r + 4},${r + 4} 0 0 1 ${cx + r + 4},${base - ah + r}`, fill: 'none', stroke: C.ink, 'stroke-width': 1.1 }, g);
    tower(g, x1, tw, y1 + 4, base, { roofH: 30, flag: true, flipFlag: true });
    tower(g, x2 - tw, tw, y1 + 4, base, { roofH: 30 }); // this one carries the department streamer
    // banners hanging on the wall
    for (const bx of [cx - r - 12, cx + r + 5]) el('path', { d: `M${bx},${wallTop + 4} h7 v16 l-3.5,-4 l-3.5,4 Z`, fill: C.red, stroke: C.ink, 'stroke-width': 0.6 }, g);
    el('line', { x1: x1 - 8, y1: base + 1.5, x2: x2 + 8, y2: base + 1.5, stroke: C.ink, 'stroke-width': 1.6 }, g);
  }

  // ---- nature --------------------------------------------------------------------------------------
  // A tree: canopy drawn as a union of circles (outlines first, then fills on top).
  function tree(g, x, y, s = 1) {
    const t = el('g', {}, g);
    el('ellipse', { cx: x + 3 * s, cy: y + 1, rx: 9 * s, ry: 2.5 * s, fill: C.soft, opacity: 0.18 }, t);
    el('path', { d: `M${x - 1.5 * s},${y} L${x - 1 * s},${y - 12 * s} M${x + 1.5 * s},${y} L${x + 1 * s},${y - 12 * s} M${x},${y - 8 * s} l${4 * s},${-5 * s}`, stroke: C.ink, 'stroke-width': 1.1, fill: 'none' }, t);
    const blobs = [];
    const n = 6 + Math.floor(rnd() * 3);
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + between(-0.3, 0.3);
      blobs.push([x + Math.cos(a) * 6 * s, y - 19 * s + Math.sin(a) * 5 * s, between(4.5, 6.5) * s]);
    }
    blobs.push([x, y - 19 * s, 7 * s]);
    for (const [bx, by, r] of blobs) el('circle', { cx: bx, cy: by, r, fill: 'none', stroke: C.ink, 'stroke-width': 2.2 }, t);
    for (const [bx, by, r] of blobs) el('circle', { cx: bx, cy: by, r, fill: C.leaf }, t);
    for (let i = 0; i < 4; i++) {
      const bx = x + between(-7, 7) * s, by = y - 19 * s + between(-5, 5) * s;
      el('path', { d: `M${bx - 2 * s},${by} q${2 * s},${-2 * s} ${4 * s},0`, stroke: C.soft, 'stroke-width': 0.7, fill: 'none' }, t);
    }
    // shade on the right
    el('path', { d: `M${x + 7 * s},${y - 25 * s} q${6 * s},${6 * s} 0,${12 * s}`, stroke: C.soft, 'stroke-width': 0.8, fill: 'none' }, t);
  }

  // A pine: stacked, slightly ragged triangles with hatching on the shaded side.
  function pine(g, x, y, s = 1) {
    const t = el('g', {}, g);
    el('ellipse', { cx: x + 3 * s, cy: y + 1, rx: 8 * s, ry: 2.2 * s, fill: C.soft, opacity: 0.18 }, t);
    line(t, x, y, x, y - 6 * s, C.ink, 1.3);
    for (let i = 0; i < 3; i++) {
      const b = y - 4 * s - i * 8 * s, hw = (11 - i * 2.6) * s, top = b - 14 * s;
      el('path', { d: `M${x - hw},${b} Q${x - hw * 0.4},${b - 3 * s} ${x},${top} Q${x + hw * 0.4},${b - 3 * s} ${x + hw},${b} Q${x},${b + 2 * s} ${x - hw},${b} Z`, fill: C.leaf, stroke: C.ink, 'stroke-width': 1.1, 'stroke-linejoin': 'round' }, t);
      for (let k = 1; k <= 3; k++) line(t, x + hw * (0.25 * k), b - 1, x + 1, top + 4 * s, C.soft, 0.5, { opacity: 0.7 });
    }
  }

  // A smooth closed blob through points (Catmull-Rom -> cubic Bezier).
  function blobPath(points) {
    const n = points.length;
    let d = `M${points[0][0].toFixed(1)},${points[0][1].toFixed(1)}`;
    for (let i = 0; i < n; i++) {
      const p0 = points[(i - 1 + n) % n], p1 = points[i], p2 = points[(i + 1) % n], p3 = points[(i + 2) % n];
      const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
      const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
      d += ` C${c1[0].toFixed(1)},${c1[1].toFixed(1)} ${c2[0].toFixed(1)},${c2[1].toFixed(1)} ${p2[0].toFixed(1)},${p2[1].toFixed(1)}`;
    }
    return d + ' Z';
  }

  const pondShape = (cx, cy, rx, ry, k = 1) => Array.from({ length: 16 }, (_, i) => {
    const a = (i / 16) * Math.PI * 2;
    const wob = 1 + 0.1 * Math.sin(3 * a + 0.7) + 0.06 * Math.sin(5 * a + 2) - 0.05 * Math.cos(2 * a);
    return [cx + Math.cos(a) * rx * wob * k, cy + Math.sin(a) * ry * wob * k];
  });

  function pond(g, cx, cy, rx, ry) {
    // shore, water, ripples
    el('path', { d: blobPath(pondShape(cx, cy, rx, ry, 1.1)), fill: 'rgba(214,186,130,0.25)', stroke: C.soft, 'stroke-width': 1, 'stroke-dasharray': '3 4' }, g);
    el('path', { d: blobPath(pondShape(cx, cy, rx, ry)), fill: C.water, stroke: C.ink, 'stroke-width': 2.2 }, g);
    for (const k of [0.78, 0.55, 0.3]) el('path', { d: blobPath(pondShape(cx + 4, cy + 3, rx, ry, k)), fill: 'none', stroke: C.soft, 'stroke-width': 0.8, 'stroke-dasharray': '10 7', opacity: 0.8 }, g);
    for (let i = 0; i < 7; i++) {
      const x = cx + between(-rx * 0.6, rx * 0.6), y = cy + between(-ry * 0.5, ry * 0.5);
      el('path', { d: `M${x},${y} q6,-3 12,0 M${x + 4},${y + 4} q5,-2 9,0`, stroke: C.soft, 'stroke-width': 0.7, fill: 'none' }, g);
    }
    // lily pads
    for (const [a, k] of [[0.6, 0.62], [0.9, 0.5], [3.6, 0.6], [4.2, 0.72], [2.2, 0.4]]) {
      const x = cx + Math.cos(a) * rx * k, y = cy + Math.sin(a) * ry * k;
      el('path', { d: `M${x},${y} L${x + 6},${y - 2} A6,4 0 1 1 ${x + 5},${y + 2.5} Z`, fill: C.leaf, stroke: C.ink, 'stroke-width': 0.8 }, g);
    }
    // reeds at the water's edge
    for (const a of [0.3, 1.2, 2.6, 3.3, 5.0, 5.7]) {
      const [x, y] = [cx + Math.cos(a) * rx * 0.97, cy + Math.sin(a) * ry * 0.97];
      for (let i = -2; i <= 2; i++) el('path', { d: `M${x + i * 2},${y + 3} q${i},-8 ${i * 2.5},-14`, stroke: C.ink, 'stroke-width': 0.8, fill: 'none' }, g);
      el('ellipse', { cx: x + 1, cy: y - 10, rx: 1.3, ry: 3, fill: C.soft }, g);
    }
    // a small jetty
    const jx = cx - rx * 0.92, jy = cy + ry * 0.35;
    el('rect', { x: jx - 14, y: jy - 5, width: 34, height: 10, fill: C.roof, stroke: C.ink, 'stroke-width': 1 }, g);
    for (let x = jx - 10; x < jx + 20; x += 5) line(g, x, jy - 5, x, jy + 5, C.ink, 0.5);
    // trees around the shore, leaving a gap where the path arrives (top-left)
    const ring = [];
    for (let i = 0; i < 17; i++) {
      const a = (i / 17) * Math.PI * 2 + 0.2;
      if (a > 3.75 && a < 4.55) continue;
      const k = between(1.3, 1.5);
      ring.push([cx + Math.cos(a) * rx * k, cy + Math.sin(a) * ry * k + 14, between(1.05, 1.5)]);
    }
    ring.sort((p, q) => p[1] - q[1]).forEach(([x, y, s], i) => (i % 3 === 1 ? pine : tree)(g, x, y, s));
  }

  // Parchment wear: tea stains and fold creases.
  function wear(g, W, H) {
    for (const [x, y, r, k] of [[1560, 250, 110, 0.8], [140, 860, 100, 1.15], [990, 110, 60, 0.9], [1890, 830, 80, 1.2]]) {
      el('ellipse', { cx: x, cy: y, rx: r, ry: r * k, fill: 'url(#stain)', opacity: 0.7, transform: `rotate(${between(-30, 30).toFixed(0)} ${x} ${y})` }, g);
    }
    for (const x of [W / 3, (2 * W) / 3]) {
      line(g, x, 20, x, H - 20, '#fff8e6', 3, { opacity: 0.35 });
      line(g, x + 2, 20, x + 2, H - 20, C.soft, 0.8, { opacity: 0.18 });
    }
    line(g, 20, H / 2, W - 20, H / 2, '#fff8e6', 3, { opacity: 0.3 });
    line(g, 20, H / 2 + 2, W - 20, H / 2 + 2, C.soft, 0.8, { opacity: 0.15 });
  }

  // Foxing: the little brown age spots of old paper, heavier near the edges.
  function foxing(g, W, H) {
    for (let i = 0; i < 170; i++) {
      const edge = rnd() < 0.6;
      const x = edge ? (rnd() < 0.5 ? between(25, 260) : between(W - 260, W - 25)) : between(25, W - 25);
      const y = between(25, H - 25);
      el('circle', { cx: x, cy: y, r: between(0.6, rnd() < 0.1 ? 4.5 : 2.2), fill: '#9a6428', opacity: between(0.1, 0.35) }, g);
    }
  }

  // A curly scroll banner (like "Itinerarium Maraudentium"): arched ribbon with spiral ends.
  function scroll(g, cx, cy, width, text, defs, id) {
    const x1 = cx - width / 2, x2 = cx + width / 2, lift = width * 0.12;
    const arc = (dy) => `M${x1},${cy + dy} Q${cx},${cy - lift * 2 + dy} ${x2},${cy + dy}`;
    el('path', { d: `${arc(-11)} L${x2},${cy + 11} Q${cx},${cy - lift * 2 + 11} ${x1},${cy + 11} Z`, fill: '#f6ebcf', stroke: C.ink, 'stroke-width': 1.2 }, g);
    el('path', { id, d: arc(4.5), fill: 'none' }, defs);
    const t = el('text', { 'font-family': 'IM Fell English SC', 'font-size': 15, fill: C.ink, 'letter-spacing': 2.5, 'text-anchor': 'middle' }, g);
    el('textPath', { href: `#${id}`, startOffset: '50%' }, t).textContent = text;
    for (const s of [-1, 1]) {
      const x = s < 0 ? x1 : x2;
      el('path', { d: `M${x},${cy - 11} c${s * 16},-6 ${s * 34},4 ${s * 30},20 c${-s * 3},12 ${-s * 20},12 ${-s * 20},2 c0,-8 ${s * 12},-9 ${s * 12},-1 M${x},${cy + 11} c${s * 10},4 ${s * 16},14 ${s * 8},26 c${-s * 6},9 ${-s * 20},4 ${-s * 15},-6`, fill: 'none', stroke: C.ink, 'stroke-width': 1.3, 'stroke-linecap': 'round' }, g);
      el('path', { d: `M${x + s * 34},${cy + 2} c${s * 18},-10 ${s * 30},6 ${s * 22},18 c${-s * 5},7 ${-s * 14},3 ${-s * 12},-3`, fill: 'none', stroke: C.red, 'stroke-width': 1, 'stroke-linecap': 'round', opacity: 0.8 }, g);
    }
  }

  // A flag on a pole with a long curling streamer (the "Hogwarts" banner on the cover).
  function streamer(parent, x, y, text, { flip = false } = {}) {
    // Drawn flying left; `flip` mirrors the cloth (not the lettering) to fly right.
    const g = el('g', flip ? { transform: `translate(${2 * x} 0) scale(-1 1)` } : {}, parent);
    line(g, x, y, x, y - 34, C.ink, 1.3);
    el('circle', { cx: x, cy: y - 36, r: 2, fill: C.ink }, g);
    const top = y - 32;
    el('path', { d: `M${x},${top} C${x - 30},${top - 8} ${x - 60},${top + 8} ${x - 92},${top} L${x - 92},${top + 16} C${x - 60},${top + 24} ${x - 30},${top + 8} ${x},${top + 16} Z`, fill: '#f6ebcf', stroke: C.ink, 'stroke-width': 1.1 }, g);
    el('path', { d: `M${x - 92},${top} c-10,4 -14,14 -6,24 c8,10 -2,22 -12,26 c-9,4 -14,14 -6,20 M${x - 92},${top + 16} c-6,4 -6,10 -2,14`, fill: 'none', stroke: C.ink, 'stroke-width': 1.1, 'stroke-linecap': 'round' }, g);
    const tx = flip ? x + 46 : x - 46;
    const t = el('text', { x: tx, y: top + 12, 'text-anchor': 'middle', 'font-family': 'IM Fell English SC', 'font-size': 11, fill: C.ink, 'letter-spacing': 1.5, transform: `rotate(${flip ? 2 : -2} ${tx} ${top + 8})` }, parent);
    t.textContent = text;
  }

  // An ink blot behind the title, like the cover of the real map.
  function titleBlot(g, cx, cy, rx, ry) {
    const p = Array.from({ length: 22 }, (_, i) => {
      const a = (i / 22) * Math.PI * 2;
      const wob = 1 + 0.07 * Math.sin(4 * a + 1) + 0.05 * Math.sin(7 * a) + between(-0.03, 0.03);
      return [cx + Math.cos(a) * rx * wob, cy + Math.sin(a) * ry * wob];
    });
    el('path', { d: blobPath(p), fill: '#6b1a1a', opacity: 0.92, filter: 'url(#ink)' }, g);
    for (let i = 0; i < 6; i++) {
      const a = between(0, Math.PI * 2);
      el('circle', { cx: cx + Math.cos(a) * rx * between(1.02, 1.12), cy: cy + Math.sin(a) * ry * between(1.05, 1.3), r: between(1.5, 4), fill: '#6b1a1a', opacity: 0.85 }, g);
    }
  }

  root.Ink = { C, reseed, bat, hauntedHall, headquarters, crystalLab, pine, foxing, scroll, streamer, castle, hall, labTower, clockLifts, stairs, fountain, hut, courtyard, greatWall, gatehouse, pond, tree, grassTuft, wear, titleBlot };
})(globalThis);
