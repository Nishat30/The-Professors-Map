// The Professors' Map — viewer. Draws the 7th floor as inked parchment and walks footprints around it.
(() => {
  const NS = 'http://www.w3.org/2000/svg';
  const { width: W, height: H } = CAMPUS.map;
  const INK = '#4a2e14', SOFT = '#7a5530', RED = '#7d1d1d', PAPER = '#f3e6c6';
  const svg = document.getElementById('map');
  svg.setAttribute('viewBox', `0 0 ${W} ${H}`);

  const STALE_MS = 5 * 60e3;        // banner fades after this
  const LIVE_MS = 30e3;             // "live" badge window
  const FOOT_LIFE_MS = 16e3;        // how long a footprint stays on the parchment
  const STEP_PX = 9;                // stride length on the map
  const PX_PER_M = 10;              // rough map scale, for the accuracy ring

  const el = (tag, attrs = {}, parent) => {
    const n = document.createElementNS(NS, tag);
    for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v);
    if (parent) parent.appendChild(n);
    return n;
  };
  const txt = (parent, x, y, s, attrs = {}) => { const t = el('text', { x, y, 'text-anchor': 'middle', ...attrs }, parent); t.textContent = s; return t; };
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const room = (id) => GEO.roomById(CAMPUS, id);

  // ---- static parchment ---------------------------------------------------------------------
  let footLayer, peopleLayer;

  function drawMap() {
    svg.innerHTML = '';
    const defs = el('defs', {}, svg);
    defs.innerHTML = `
      <filter id="ink" x="-2%" y="-2%" width="104%" height="104%">
        <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="3" result="n"/>
        <feDisplacementMap in="SourceGraphic" in2="n" scale="1.5"/>
      </filter>
      <pattern id="hatch" width="7" height="7" patternUnits="userSpaceOnUse" patternTransform="rotate(-35)">
        <line x1="0" y1="0" x2="0" y2="7" stroke="${SOFT}" stroke-width="0.6" opacity="0.35"/>
      </pattern>
      <pattern id="cross" width="8" height="8" patternUnits="userSpaceOnUse">
        <path d="M0 0 L8 8 M8 0 L0 8" stroke="${SOFT}" stroke-width="0.5" opacity="0.3"/>
      </pattern>
      <pattern id="stipple" width="10" height="10" patternUnits="userSpaceOnUse">
        <circle cx="2" cy="3" r="0.7" fill="${SOFT}" opacity="0.4"/><circle cx="7" cy="8" r="0.6" fill="${SOFT}" opacity="0.35"/>
      </pattern>
      <pattern id="planks" width="16" height="16" patternUnits="userSpaceOnUse">
        <line x1="0" y1="0" x2="0" y2="16" stroke="${SOFT}" stroke-width="0.8" opacity="0.28"/>
      </pattern>
      <pattern id="scribble" width="560" height="260" patternUnits="userSpaceOnUse" patternTransform="rotate(-8)">
        <text font-family="IM Fell English" font-style="italic" font-size="15" fill="${INK}" opacity="0.065">
          <tspan x="0" y="24">mischief managed nox lumos solemnly swear up to no good aparecium</tspan>
          <tspan x="30" y="64">omnibus maraudentibus bonum audere est magistri ubique sunt</tspan>
          <tspan x="0" y="104">quis ubi est professor nunc lectio in aula septima scalae moventes</tspan>
          <tspan x="50" y="144">officium decani expectate paulisper aqua pura in fonte</tspan>
          <tspan x="10" y="184">vestigia pedum nomina ambulant per atrium et turres</tspan>
          <tspan x="40" y="224">non omnes qui errant perditi sunt sed quidam in refectorio</tspan>
        </text>
      </pattern>
      <radialGradient id="stain">
        <stop offset="0%" stop-color="#a8773a" stop-opacity="0.05"/>
        <stop offset="78%" stop-color="#a8773a" stop-opacity="0.07"/>
        <stop offset="93%" stop-color="#8a5a24" stop-opacity="0.12"/>
        <stop offset="100%" stop-color="#8a5a24" stop-opacity="0"/>
      </radialGradient>
      <marker id="arrow" viewBox="0 0 8 8" refX="6" refY="4" markerWidth="6" markerHeight="6" orient="auto">
        <path d="M0,0 L8,4 L0,8 Z" fill="${RED}"/>
      </marker>
      <path id="foot" d="M0,-6.2 C3,-6.2 3.4,-2.2 3,0.8 C2.6,2.8 -2.6,2.8 -3,0.8 C-3.4,-2.2 -3,-6.2 0,-6.2 Z M0,3.8 C2.1,3.8 2.2,7.4 0,7.4 C-2.2,7.4 -2.1,3.8 0,3.8 Z"/>
    `;
    Ink.reseed(11);
    el('rect', { x: 0, y: 0, width: W, height: H, fill: 'url(#scribble)' }, svg);
    Ink.wear(el('g', {}, svg), W, H);
    Ink.foxing(el('g', {}, svg), W, H);
    drawBorder(defs);
    drawTitle();

    const g = el('g', { filter: 'url(#ink)' }, svg);
    drawCorridors(g);
    el('rect', { x: 1286, y: 160, width: 156, height: 234, fill: 'none', stroke: SOFT, 'stroke-width': 1, 'stroke-dasharray': '4 4', rx: 4 }, g);
    const labels = [];
    for (const r of CAMPUS.rooms) drawRoom(r, g, labels);
    drawGround(g);
    drawOutside(g);

    const lg = el('g', {}, svg);
    for (const l of labels) ribbon(lg, l.x, l.y, l.text, l.cls || 'room-label', true);
    for (const r of CAMPUS.rooms.filter((x) => x.key)) drawKey(lg, r);
    ribbon(svg, 745, 146, 'RIGHT BLOCK \u00b7 RB', 'zone-label');
    ribbon(svg, 1364, 140, 'CENTRE BLOCK', 'zone-label');
    drawLegend();
    drawCompass(960, 830);
    drawCredits(defs);
    const oath = el('text', { x: 110, y: 868, 'font-family': 'IM Fell English', 'font-style': 'italic', 'font-size': 30, fill: INK, opacity: 0.85, 'letter-spacing': 3 }, svg);
    oath.textContent = 'I solemnly swear that I am up to no good';

    footLayer = el('g', { fill: '#3a220d' }, svg);
    peopleLayer = el('g', {}, svg);
  }

  function drawBorder(defs) {
    const b = el('g', { stroke: INK, fill: 'none' }, svg);
    el('rect', { x: 18, y: 18, width: W - 36, height: H - 36, 'stroke-width': 2.2 }, b);
    el('rect', { x: 42, y: 42, width: W - 84, height: H - 84, 'stroke-width': 0.8 }, b);
    for (let x = 30; x < W - 30; x += 24) {
      el('line', { x1: x, y1: 18, x2: x + 12, y2: 18, 'stroke-width': 5 }, b);
      el('line', { x1: x, y1: H - 18, x2: x + 12, y2: H - 18, 'stroke-width': 5 }, b);
    }
    el('path', { id: 'borderTop', d: `M 44 34 H ${W - 44}` }, defs);
    el('path', { id: 'borderBottom', d: `M ${W - 44} ${H - 26} H 44` }, defs);
    const motto = ' I SOLEMNLY SWEAR THAT I AM UP TO NO GOOD · MAGISTRI UBIQUE SUNT · '.repeat(10);
    for (const id of ['borderTop', 'borderBottom']) {
      const t = el('text', { 'font-family': 'IM Fell English SC', 'font-size': 11, fill: INK, 'letter-spacing': 2, opacity: 0.8 }, svg);
      el('textPath', { href: `#${id}` }, t).textContent = motto;
    }
  }

  function drawTitle() {
    const tg = el('g', { transform: 'translate(90 70)' }, svg);
    Ink.titleBlot(tg, 262, 42, 285, 36);
    const title = el('text', { x: 262, y: 56, 'text-anchor': 'middle', 'font-family': 'Cinzel Decorative', 'font-weight': 700, 'font-size': 40, fill: '#f0e2bf', 'letter-spacing': 1 }, tg);
    title.textContent = CAMPUS.name;
    txt(tg, 262, 98, CAMPUS.subtitle, { 'font-family': 'IM Fell English SC', 'font-size': 17, fill: RED, 'letter-spacing': 2 });
  }

  // "Messrs Moony, Wormtail, Padfoot & Prongs are proud to present", our way.
  function drawCredits(defs) {
    const g = el('g', {}, svg);
    Ink.scroll(g, 1700, 92, 340, 'ITINERARIUM MAGISTRORUM', defs, 'creditScroll');
    const sc = { 'text-anchor': 'middle', fill: RED };
    txt(g, 1700, 146, 'Messrs', { ...sc, 'font-family': 'IM Fell English', 'font-style': 'italic', 'font-size': 16 });
    txt(g, 1700, 172, 'FACULTY, STAFF, THE HOD', { ...sc, 'font-family': 'IM Fell English SC', 'font-size': 21, 'letter-spacing': 1 });
    txt(g, 1700, 196, '& COMPUTER SCIENCE', { ...sc, 'font-family': 'IM Fell English SC', 'font-size': 21, 'letter-spacing': 1 });
    txt(g, 1700, 219, 'are proud to present', { ...sc, 'font-family': 'IM Fell English', 'font-style': 'italic', 'font-size': 16 });
  }

  function drawCorridors(g) {
    const { top, bottom } = CAMPUS.rb;
    const y = (line, x) => GEO.lineY(line, x);
    const x0 = 190, x1 = 1415;
    const poly = [[x0, y(top, x0)], [x1, y(top, x1)], [x1, y(bottom, x1)], [x0, y(bottom, x0)]];
    el('polygon', { points: poly.map((p) => p.join(',')).join(' '), fill: '#efe0bb' }, g);
    el('polygon', { points: poly.map((p) => p.join(',')).join(' '), fill: 'url(#planks)' }, g);
    el('line', { x1: x0, y1: y(top, x0), x2: x1, y2: y(top, x1), stroke: INK, 'stroke-width': 2 }, g);
    el('line', { x1: x0, y1: y(bottom, x0), x2: x1, y2: y(bottom, x1), stroke: INK, 'stroke-width': 2 }, g);

    // Left block: drawn, but not surveyed yet.
    const lb = CAMPUS.lb;
    const lp = [lb.top[0], lb.top[1], lb.bottom[1], lb.bottom[0]];
    el('polygon', { points: lp.map((p) => p.join(',')).join(' '), fill: 'url(#stipple)' }, g);
    for (const line of [lb.top, lb.bottom]) el('line', { x1: line[0][0], y1: line[0][1], x2: line[1][0], y2: line[1][1], stroke: INK, 'stroke-width': 1.6, 'stroke-dasharray': '10 6' }, g);
    el('path', { id: 'lbPath', d: `M 1440 ${(287 + 328) / 2 + 6} L 1860 ${(365 + 411) / 2 + 4}`, fill: 'none' }, svg.querySelector('defs'));
    const t = el('text', { 'font-family': 'IM Fell English SC', 'font-size': 15, fill: SOFT, 'letter-spacing': 1.5 }, svg);
    el('textPath', { href: '#lbPath', startOffset: '6%' }, t).textContent = 'Left Block · LB — not yet charted';
  }

  function drawRoom(r, g, labels) {
    if (r.layer === 'ground') return;
    const small = { 'font-family': 'IM Fell English', 'font-style': 'italic', 'font-size': 11, fill: SOFT };
    const [x1, y1, x2, y2] = r.rect, cx = (x1 + x2) / 2, cy = (y1 + y2) / 2;
    const rg = el('g', {}, g);
    switch (r.kind) {
      case 'classroom': labels.push({ ...Ink.castle(rg, r.rect), text: r.name }); break;
      case 'staff': labels.push({ ...Ink.hauntedHall(rg, r.rect), text: r.name }); break;
      case 'hod': labels.push({ ...Ink.headquarters(rg, r.rect), text: 'HOD Headquarters', cls: 'room-label hod-label' }); break;
      case 'lab': Ink.crystalLab(rg, r.rect); break;
      case 'lifts':
        Ink.clockLifts(rg, r.rect);
        txt(rg, 1336, 397, 'even', { ...small, 'font-size': 10 });
        txt(rg, cx, 397, 'LIFTS', { 'font-family': 'IM Fell English SC', 'font-size': 12, fill: INK });
        txt(rg, 1410, 397, 'odd', { ...small, 'font-size': 10 });
        break;
      case 'stairs': Ink.stairs(rg, r.rect); break;
      case 'purifier': Ink.fountain(rg, r.rect); break;
      case 'toilet': {
        const h = Ink.hut(rg, r.rect);
        txt(rg, h.x, h.y + 3, 'WC', { 'font-family': 'IM Fell English SC', 'font-size': 10, fill: INK });
        break;
      }
      case 'empty':
        Ink.courtyard(rg, r.rect, { avoidX: r.id === 'empty1' ? 597 : r.id === 'empty2' ? 1003 : Infinity });
        txt(rg, (x1 + Math.min(x2, r.id === 'empty1' ? 597 : r.id === 'empty2' ? 1003 : x2)) / 2, y1 + 16, 'courtyard', small);
        break;
      case 'end':
        Ink.greatWall(rg, r.rect);
        txt(rg, cx - 6, cy, 'End of the Floor', { 'font-family': 'IM Fell English SC', 'font-size': 20, fill: INK, transform: `rotate(90 ${cx - 6} ${cy})`, dy: 6 });
        break;
    }
  }

  // Key letters: on the wall of castles and halls, beside the tower for labs, on top for small rooms.
  function drawKey(parent, r) {
    const [x1, y1, x2, y2] = r.rect, w = x2 - x1;
    let kx = x1 + 11, ky = y2 - 12;
    if (r.kind === 'lab') { kx = x1 + 13; ky = (y1 + y2) / 2; }
    else if (r.kind === 'lifts') { kx = (x1 + x2) / 2; ky = y2 - 10; }
    else if (r.kind === 'gate') { kx = x1 + 44; ky = y2 - 10; }
    else if (w < 45) { kx = (x1 + x2) / 2; ky = y1 + 9; }
    else if (r.kind === 'classroom') { kx = x1 + Math.max(13, Math.min(22, w * 0.17)) + 9; ky = y2 - 12; }
    el('polygon', { points: `${kx},${ky - 8} ${kx + 10},${ky} ${kx},${ky + 8} ${kx - 10},${ky}`, fill: PAPER, stroke: INK, 'stroke-width': 1 }, parent);
    txt(parent, kx, ky + 3.5, r.key, { class: 'room-key' });
  }

  function drawGround(g) {
    const gate = room('gate');
    const [x1, , x2, y2] = gate.rect;
    txt(svg, 1392, 424, '\u2014 ground floor, far below \u2014', { 'font-family': 'IM Fell English', 'font-style': 'italic', 'font-size': 13, fill: SOFT });
    el('line', { x1: 1373, y1: 402, x2: 1373, y2: 412, stroke: SOFT, 'stroke-width': 1, 'stroke-dasharray': '2 3' }, g);
    Ink.gatehouse(g, gate.rect);
    Ink.streamer(svg, x2 - 15, gate.rect[1] - 24, 'COMP. SCI.', { flip: true });
    ribbon(svg, (x1 + x2) / 2, y2 + 24, 'COLLEGE ENTRY GATE', 'zone-label');
    // a winding path from the gate down to the pond
    el('path', { d: 'M1350,560 C1320,590 1300,605 1318,640', stroke: SOFT, 'stroke-width': 1.2, fill: 'none', 'stroke-dasharray': '1 5', 'stroke-linecap': 'round' }, g);
    Ink.pond(g, 1415, 742, 122, 88);
    ribbon(svg, 1415, 752, 'THE POND', 'zone-label');
    // a small grove between the compass and the pond
    for (const [x, y, s, p] of [[1060, 640, 1.3], [1100, 668, 1.2, 1], [1040, 700, 1.3, 1], [1150, 820, 1.4], [1190, 862, 1.2, 1], [1110, 880, 1.3], [1215, 612, 1.1, 1], [880, 890, 1.1, 1]]) (p ? Ink.pine : Ink.tree)(g, x, y, s);
    for (let i = 0; i < 14; i++) Ink.grassTuft(g, 1000 + (i * 53) % 260, 600 + (i * 71) % 290);
  }

  // Off the 7th floor: a little chart of the college and its surroundings. The centre is the
  // college; the inner ring is the university grounds, and past it, people are off campus.
  const OUT = { x: 1745, y: 700, grounds: 52, walls: 82, edge: 170 };
  const northVec = () => {
    const { u } = GEO.axis(CAMPUS);
    const b = Math.atan2(u.x, u.y);
    return { x: -Math.cos(b), y: Math.sin(b) };
  };
  function drawOutside(g) {
    const o = el('g', {}, g);
    el('circle', { cx: OUT.x, cy: OUT.y, r: OUT.edge + 6, fill: 'url(#stipple)', stroke: SOFT, 'stroke-width': 1, 'stroke-dasharray': '2 6' }, o);
    el('circle', { cx: OUT.x, cy: OUT.y, r: OUT.grounds, fill: '#efe0bb', stroke: INK, 'stroke-width': 2.2 }, o);
    el('circle', { cx: OUT.x, cy: OUT.y, r: OUT.grounds - 5, fill: 'none', stroke: INK, 'stroke-width': 0.8, 'stroke-dasharray': '6 4' }, o);
    Ink.gatehouse(o, [OUT.x - 30, OUT.y - 26, OUT.x + 30, OUT.y + 14]);
    const n = northVec();
    el('line', { x1: OUT.x + n.x * (OUT.grounds + 6), y1: OUT.y + n.y * (OUT.grounds + 6), x2: OUT.x + n.x * (OUT.grounds + 26), y2: OUT.y + n.y * (OUT.grounds + 26), stroke: RED, 'stroke-width': 1.2, 'marker-end': 'url(#arrow)' }, o);
    txt(o, OUT.x + n.x * (OUT.grounds + 38), OUT.y + n.y * (OUT.grounds + 38) + 5, 'N', { 'font-family': 'Cinzel Decorative', 'font-size': 13, fill: RED });
    txt(o, OUT.x, OUT.y + 32, 'the grounds', { 'font-family': 'IM Fell English', 'font-style': 'italic', 'font-size': 11, fill: SOFT });
    ribbon(svg, OUT.x, OUT.y - OUT.edge - 24, 'BEYOND THE CASTLE WALLS', 'zone-label');
    txt(svg, OUT.x, OUT.y + OUT.edge + 26, 'off campus \u00b7 distance not to scale', { 'font-family': 'IM Fell English', 'font-style': 'italic', 'font-size': 12, fill: SOFT });
  }
  // Direction is true to the compass; distance is squeezed so the next street and the next city both fit.
  function outsideSpot(m) {
    const d = Math.hypot(m.x, m.y) || 1, R = CAMPUS.campusRadius;
    const r = d <= R
      ? Math.min(OUT.grounds - 14, 8 + (d / R) * (OUT.grounds - 22))
      : OUT.walls + (OUT.edge - OUT.walls) * Math.min(1, Math.log(1 + (d - R) / 100) / Math.log(1 + 5000 / 100));
    const n = northVec(), e = { x: -n.y, y: n.x };
    return { x: OUT.x + ((e.x * m.x + n.x * m.y) / d) * r, y: OUT.y + ((e.y * m.x + n.y * m.y) / d) * r };
  }

  function ribbon(parent, x, y, text, cls, small = false) {
    const g = el('g', { transform: `translate(${x} ${y})` }, parent);
    const tails = el('g', { fill: '#d9c08a', stroke: INK, 'stroke-width': 1 }, g);
    const body = el('path', { fill: '#f6ebcf', stroke: INK, 'stroke-width': 1.2 }, g);
    const t = el('text', { x: 0, y: 4.5, 'text-anchor': 'middle', class: cls }, g);
    t.textContent = text;
    const w = Math.max(small ? 30 : 40, (t.getComputedTextLength?.() || text.length * 8) + (small ? 14 : 28));
    const h = w / 2, tl = small ? 9 : 16, tp = small ? 5 : 9;
    body.setAttribute('d', small ? `M${-h},-9 Q0,-12 ${h},-9 L${h},7 Q0,4 ${-h},7 Z` : `M${-h},-10 Q0,-15 ${h},-10 L${h},9 Q0,4 ${-h},9 Z`);
    tails.innerHTML = `<path d="M${-h + 5},-3 L${-h - tl},-3 L${-h - tl + tp - 2},4 L${-h - tl},${small ? 10 : 13} L${-h + 5},${small ? 10 : 13} Z"/><path d="M${h - 5},-3 L${h + tl},-3 L${h + tl - tp + 2},4 L${h + tl},${small ? 10 : 13} L${h - 5},${small ? 10 : 13} Z"/>`;
    return { g, t, body, tails, w: w + tl * 2 };
  }

  function drawLegend() {
    const keyed = CAMPUS.rooms.filter((r) => r.key).sort((a, b) => a.key.localeCompare(b.key));
    const rows = Math.ceil(keyed.length / 3), x0 = 90, y0 = 540, colW = 250;
    const g = el('g', { class: 'legend', transform: `translate(${x0} ${y0})` }, svg);
    el('rect', { x: 0, y: 0, width: colW * 3 + 20, height: 78 + rows * 23, fill: 'rgba(246,235,207,0.75)', stroke: INK, 'stroke-width': 1.2 }, g);
    el('rect', { x: 4, y: 4, width: colW * 3 + 12, height: 70 + rows * 23, fill: 'none', stroke: INK, 'stroke-width': 0.6 }, g);
    txt(g, (colW * 3 + 20) / 2, 30, 'MAP KEY', { 'font-size': 19, fill: RED });
    txt(g, (colW * 3 + 20) / 2, 64 + rows * 23, '\u2727 crystal balls mark the computer labs \u00b7 enter the staff rooms at your own peril \u2727', { 'font-family': 'IM Fell English', 'font-style': 'italic', 'font-size': 13, fill: SOFT });
    keyed.forEach((r, i) => {
      const t = el('text', { x: 20 + Math.floor(i / rows) * colW, y: 62 + (i % rows) * 23, 'font-size': 12.5 }, g);
      t.innerHTML = `<tspan font-size="14" fill="${RED}">${r.key}</tspan> … ${esc(r.name.toUpperCase())}`;
    });
  }

  // North as surveyed: the corridor towards RB 708 runs ~24° east of north, and it points left on the map.
  function drawCompass(cx, cy) {
    const { u } = GEO.axis(CAMPUS);
    const bearing = Math.atan2(u.x, u.y);                  // corridor bearing, clockwise from north
    const nx = -Math.cos(bearing), ny = Math.sin(bearing);  // north = map-left turned back by that bearing
    const g = el('g', { transform: `translate(${cx} ${cy})`, opacity: 0.85 }, svg);
    el('circle', { r: 52, fill: 'none', stroke: INK, 'stroke-width': 1 }, g);
    el('circle', { r: 46, fill: 'none', stroke: INK, 'stroke-width': 0.5, 'stroke-dasharray': '2 3' }, g);
    const deg = (Math.atan2(ny, nx) * 180) / Math.PI + 90;
    const needle = el('g', { transform: `rotate(${deg.toFixed(1)})` }, g);
    el('path', { d: 'M0,-44 L7,0 L0,6 L-7,0 Z', fill: RED, stroke: INK, 'stroke-width': 0.8 }, needle);
    el('path', { d: 'M0,44 L7,0 L0,-6 L-7,0 Z', fill: PAPER, stroke: INK, 'stroke-width': 0.8 }, needle);
    txt(needle, 0, -50, 'N', { 'font-family': 'Cinzel Decorative', 'font-size': 16, fill: RED });
  }

  drawMap();

  // ---- live people ---------------------------------------------------------------------------
  /** id -> person { data, x, y, tx, ty, hasPos, heading, dist, side, lastStepAt, g, parts, labOff } */
  const people = new Map();
  const footprints = [];
  let clockOffset = 0;
  const serverNow = () => Date.now() + clockOffset;
  let activeId = null;

  function locate(d) {
    const loc = GEO.place(CAMPUS, d);
    if (loc && !loc.pinned && (loc.where === 'off' || loc.where === 'campus')) return { ...loc, ...outsideSpot(loc.meters), outside: true };
    return loc;
  }
  const whereText = (d) => GEO.placeText(CAMPUS, d);

  function ago(ms) {
    const s = Math.max(0, Math.round(ms / 1000));
    if (s < 60) return `${s}s ago`;
    const m = Math.round(s / 60);
    return m < 60 ? `${m} min ago` : `${Math.round(m / 60)} h ago`;
  }

  function upsert(d) {
    let p = people.get(d.id);
    if (!p) {
      p = { data: d, x: 0, y: 0, tx: 0, ty: 0, hasPos: false, heading: Math.PI, dist: 0, side: 1, lastStepAt: 0 };
      people.set(d.id, p);
    }
    p.data = d;
    const loc = locate(d);
    if (!loc || loc.x == null) {
      p.hasPos = false;
      removeLabel(p);
    } else {
      p.tx = loc.x; p.ty = loc.y;
      p.outside = !!loc.outside;
      if (!p.hasPos || Math.hypot(p.tx - p.x, p.ty - p.y) > 700) { p.x = p.tx; p.y = p.ty; }
      p.hasPos = true;
      renderLabel(p);
    }
    scheduleList();
  }

  function removeLabel(p) {
    if (p.g) { p.g.remove(); p.g = null; }
  }

  function renderLabel(p) {
    const d = p.data;
    if (!p.g) {
      p.g = el('g', { class: 'person' }, peopleLayer);
      p.g.addEventListener('click', () => focus(d.id, false));
      const acc = el('circle', { r: 0, fill: 'rgba(125,29,29,0.05)', stroke: RED, 'stroke-width': 0.8, 'stroke-dasharray': '3 3' }, p.g);
      const pulse = el('circle', { class: 'pulse', r: 6 }, p.g);
      const leader = el('line', { x1: 0, y1: 8, x2: 0, y2: 8, stroke: INK, 'stroke-width': 0.8, 'stroke-dasharray': '2 2' }, p.g);
      const lab = el('g', {}, p.g);
      p.parts = { acc, pulse, leader, lab, rib: ribbon(lab, 0, 24, d.name, 'person-name'), sub: el('text', { x: 0, y: 46, 'text-anchor': 'middle', class: 'person-sub' }, lab) };
      p.labOff = 0;
    }
    const { rib, sub, acc } = p.parts;
    if (rib.t.textContent !== d.name) {
      rib.g.remove();
      p.parts.rib = ribbon(p.parts.lab, 0, 24, d.name, 'person-name');
    }
    sub.textContent = d.status;
    acc.setAttribute('r', !d.room && !p.outside && d.acc > 15 ? Math.min(d.acc * PX_PER_M, 70) : 0);
    p.g.classList.toggle('active', activeId === d.id);
  }

  function dropFoot(x, y, heading, side) {
    const off = 3.2 * side;
    const fx = x + Math.cos(heading + Math.PI / 2) * off;
    const fy = y + Math.sin(heading + Math.PI / 2) * off;
    const deg = (heading * 180) / Math.PI + 90;
    const u = el('use', { href: '#foot', transform: `translate(${fx.toFixed(1)} ${fy.toFixed(1)}) rotate(${deg.toFixed(0)}) scale(0.95)` }, footLayer);
    footprints.push({ u, born: performance.now() });
  }

  // Professors standing together would stack their banners: push overlapping banners down
  // and draw a dotted leader line back to the feet.
  function declutter() {
    const placed = [];
    const ordered = [...people.values()].filter((p) => p.hasPos && p.g).sort((a, b) => a.y - b.y || a.x - b.x);
    for (const p of ordered) {
      const half = p.parts.rib.w / 2;
      let off = 0, box;
      for (let tries = 0; tries < 8; tries++, off += 42) {
        box = { x1: p.x - half, x2: p.x + half, y1: p.y + 9 + off, y2: p.y + 50 + off };
        if (!placed.some((b) => b.x1 < box.x2 && box.x1 < b.x2 && b.y1 < box.y2 && box.y1 < b.y2)) break;
      }
      placed.push(box);
      p.labOff += (off - p.labOff) * 0.15;
      p.parts.lab.setAttribute('transform', `translate(0 ${p.labOff.toFixed(1)})`);
      p.parts.leader.setAttribute('y2', p.labOff > 3 ? (12 + p.labOff).toFixed(1) : 8);
    }
  }

  let last = performance.now();
  function frame(now) {
    const dt = Math.min(0.1, (now - last) / 1000);
    last = now;
    const sNow = serverNow();

    for (const p of people.values()) {
      if (!p.hasPos || !p.g) continue;
      const stale = sNow - p.data.lastSeen > STALE_MS;
      const dx = p.tx - p.x, dy = p.ty - p.y, d = Math.hypot(dx, dy);
      if (d > 0.4) {
        const mv = Math.min(d, Math.max(18, d / 1.4) * dt);
        p.x += (dx / d) * mv; p.y += (dy / d) * mv;
        p.heading = Math.atan2(dy, dx);
        p.dist += mv;
        if (p.dist >= STEP_PX) {
          p.dist = 0; p.side *= -1; p.lastStepAt = now;
          dropFoot(p.x, p.y, p.heading, p.side);
        }
      } else if (!stale && now - p.lastStepAt > 2200) {
        // Standing still: the footprints shuffle in place, like the film.
        p.lastStepAt = now;
        p.heading += (Math.random() - 0.5) * 0.9;
        dropFoot(p.x, p.y, p.heading, 1);
        dropFoot(p.x, p.y, p.heading, -1);
      }
      p.g.setAttribute('transform', `translate(${p.x.toFixed(1)} ${p.y.toFixed(1)})`);
      p.g.classList.toggle('stale', stale);
    }
    declutter();

    for (let i = footprints.length - 1; i >= 0; i--) {
      const f = footprints[i];
      const age = (now - f.born) / FOOT_LIFE_MS;
      if (age >= 1) { f.u.remove(); footprints.splice(i, 1); continue; }
      f.u.setAttribute('opacity', (1 - age * age).toFixed(2));
    }
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  // ---- side list -----------------------------------------------------------------------------
  const listEl = document.getElementById('list');
  const countEl = document.getElementById('count');
  const searchEl = document.getElementById('search');
  let listQueued = false;
  function scheduleList() {
    if (listQueued) return;
    listQueued = true;
    requestAnimationFrame(() => { listQueued = false; renderList(); });
  }
  searchEl.addEventListener('input', scheduleList);

  function renderList() {
    const q = searchEl.value.trim().toLowerCase();
    const all = [...people.values()];
    const onMap = all.filter((p) => p.hasPos).length;
    countEl.textContent = all.length
      ? `${onMap} of ${all.length} professor${all.length === 1 ? '' : 's'} on the map`
      : 'The parchment is blank.';

    const rows = all
      .filter((p) => !q || p.data.name.toLowerCase().includes(q))
      .sort((a, b) => (b.hasPos - a.hasPos) || (b.data.sharing - a.data.sharing) || a.data.name.localeCompare(b.data.name));

    if (!rows.length) {
      listEl.innerHTML = all.length
        ? `<li class="empty">No professor by that name walks these halls.</li>`
        : `<li class="empty">No professors are sharing their location yet.<br/>Share the <a href="/join">join link</a>: open it on a phone, sign in with a name and allow location.</li>`;
      return;
    }
    const sNow = serverNow();
    listEl.innerHTML = rows.map(({ data: d, hasPos }) => {
      const age = sNow - d.lastSeen;
      const when = !d.sharing ? '' : age < LIVE_MS ? '<span class="live">● live</span>' : ago(age);
      const cls = ['item', d.sharing ? '' : 'hidden', hasPos ? '' : 'nomap', d.sharing && age > STALE_MS ? 'stale' : '', activeId === d.id ? 'active' : ''].join(' ');
      return `<li class="${cls}" data-id="${esc(d.id)}">
        <span class="name">${esc(d.name)}</span><span class="when">${when}</span>
        <span class="where">${esc(whereText(d))}</span>
        <span class="status"><span class="chip s-${esc(d.status.split(' ')[0])}">${esc(d.status)}</span></span>
      </li>`;
    }).join('');
  }
  listEl.addEventListener('click', (e) => {
    const li = e.target.closest('.item');
    if (li && people.get(li.dataset.id)?.hasPos) focus(li.dataset.id, true);
  });
  setInterval(scheduleList, 5000);

  function focus(id, scroll) {
    activeId = id;
    const p = people.get(id);
    for (const q of people.values()) if (q.g) q.g.classList.remove('active');
    if (p?.g) {
      void p.g.getBoundingClientRect();
      p.g.classList.add('active');
      if (scroll) {
        const wrap = document.getElementById('mapWrap');
        const r = p.g.getBoundingClientRect(), w = wrap.getBoundingClientRect();
        wrap.scrollBy({ left: r.left - w.left - w.width / 2, top: r.top - w.top - w.height / 2, behavior: 'smooth' });
      }
    }
    scheduleList();
  }

  // Coming from the join page (?me=<id>): fly to your own footprints the first time they appear.
  const meId = new URLSearchParams(location.search).get('me') || PM.identity.get()?.id;
  let meFocused = !new URLSearchParams(location.search).has('me');
  function focusMe() {
    if (meFocused || !people.get(meId)?.hasPos) return;
    meFocused = true;
    setTimeout(() => focus(meId, true), 600);
  }

  // ---- you, if you joined on this phone ------------------------------------------------------
  const share = Share.start(renderMe);
  function renderMe({ sharing, gps, acc, server }) {
    const bar = document.getElementById('meBar');
    bar.classList.remove('hide');
    document.getElementById('meName').textContent = `You · ${PM.identity.get().name}`;
    const dot = document.getElementById('meDot'), where = document.getElementById('meWhere'), btn = document.getElementById('meToggle');
    btn.textContent = sharing ? 'Hide me' : 'Show me';
    if (!sharing) { dot.className = 'me-dot off'; where.innerHTML = 'Hidden. Others see only your name.'; return; }
    const fix = {
      insecure: 'Location needs the https:// link.',
      denied: 'Location is blocked. Allow it for this site in your browser settings, then reload.',
      unavailable: 'Your phone can’t find its position. Turn on Location and Wi-Fi.',
      vague: `GPS is rough right now (±${Math.round(acc)} m). Wi-Fi on helps; hold on a moment.`,
    }[gps];
    const placed = server && GEO.place(CAMPUS, server);
    dot.className = 'me-dot' + (fix && !placed ? ' bad' : placed ? '' : ' wait');
    const text = placed ? esc(GEO.placeText(CAMPUS, server)) : fix ? 'Not on the map yet' : 'Finding you… (a few seconds; near a window helps)';
    where.innerHTML = text + (fix ? `<small>${esc(fix)}</small>` : placed ? '<small>Keep this page open to stay live.</small>' : '');
  }
  document.getElementById('meToggle').addEventListener('click', () => {
    if (!share) return;
    const on = !Share.prefs().sharing;
    share.setSharing(on);
    if (on) { meFocused = false; focusMe(); }
  });

  // ---- socket --------------------------------------------------------------------------------
  const connEl = document.getElementById('conn');
  let retry = 500;
  function connect() {
    const ws = new WebSocket(`${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}`);
    ws.onopen = () => { retry = 500; connEl.classList.add('on'); connEl.lastElementChild.textContent = 'Live'; };
    ws.onclose = () => {
      connEl.classList.remove('on');
      connEl.lastElementChild.textContent = 'Reconnecting…';
      setTimeout(connect, (retry = Math.min(retry * 2, 8000)));
    };
    ws.onmessage = (ev) => {
      const msg = JSON.parse(ev.data);
      if (msg.now) clockOffset = msg.now - Date.now();
      if (msg.type === 'state') {
        for (const p of people.values()) removeLabel(p);
        people.clear();
        msg.teachers.forEach(upsert);
        scheduleList();
        focusMe();
      } else if (msg.type === 'update') {
        upsert(msg.teacher);
        if (msg.teacher.id === meId) focusMe();
      } else if (msg.type === 'gone') {
        const p = people.get(msg.id);
        if (p) { removeLabel(p); people.delete(msg.id); scheduleList(); }
      }
    };
  }
  connect();

  document.getElementById('copyJoin').addEventListener('click', async (e) => {
    e.preventDefault();
    const link = `${location.origin}/join`;
    try { await navigator.clipboard.writeText(link); e.target.textContent = 'copied!'; }
    catch { prompt('Share this link:', link); }
    setTimeout(() => (e.target.textContent = 'copy link'), 2000);
  });

  // Ribbons are sized by measuring text, so re-measure once the fonts arrive.
  document.fonts?.ready.then(() => {
    drawMap();
    for (const p of people.values()) { p.g = null; if (p.hasPos) renderLabel(p); }
  });
})();
