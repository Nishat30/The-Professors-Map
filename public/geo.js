// GPS -> 7th-floor map. Shared by the browser pages and the Node server. See config.js for the rules.
(function (root) {
  const M_PER_DEG_LAT = 110574;
  const mPerDegLng = (lat) => 111320 * Math.cos((lat * Math.PI) / 180);

  function toMeters(cfg, lat, lng) {
    return { x: (lng - cfg.origin.lng) * mPerDegLng(cfg.origin.lat), y: (lat - cfg.origin.lat) * M_PER_DEG_LAT };
  }
  function toLatLng(cfg, x, y) {
    return { lat: cfg.origin.lat + y / M_PER_DEG_LAT, lng: cfg.origin.lng + x / mPerDegLng(cfg.origin.lat) };
  }

  // The right-block corridor as a unit vector (metres) from the lift lobby towards RB 708.
  function axis(cfg) {
    const e = toMeters(cfg, cfg.rb.end.lat, cfg.rb.end.lng);
    const len = Math.hypot(e.x, e.y);
    return { u: { x: e.x / len, y: e.y / len }, len };
  }

  // Piecewise-linear lookup through [[a, b], ...] pairs; extrapolates past the ends.
  function piece(pairs, v, from, to) {
    const p = [...pairs].sort((a, b) => a[from] - b[from]);
    let i = 0;
    while (i < p.length - 2 && v > p[i + 1][from]) i++;
    const [a, b] = [p[i], p[i + 1]];
    return a[to] + ((v - a[from]) / (b[from] - a[from])) * (b[to] - a[to]);
  }
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const alongToX = (cfg, along) => clamp(piece(cfg.rb.stops, along, 0, 1), cfg.rb.minX, cfg.rb.maxX);
  const xToAlong = (cfg, x) => piece(cfg.rb.stops, x, 1, 0);

  const lineY = ([[x1, y1], [x2, y2]], x) => y1 + ((x - x1) / (x2 - x1)) * (y2 - y1);
  const corridorY = (cfg, x) => (lineY(cfg.rb.top, x) + lineY(cfg.rb.bottom, x)) / 2;

  const roomById = (cfg, id) => cfg.rooms.find((r) => r.id === id) || null;

  // Where footprints stand for a room: just inside the door, or the middle of small rooms.
  function roomSpot(cfg, room) {
    if (room.spot) return { x: room.spot[0], y: room.spot[1] };
    const [x1, y1, x2, y2] = room.rect;
    const cx = (x1 + x2) / 2, cy = (y1 + y2) / 2;
    if (['lab', 'gate', 'purifier', 'stairs', 'toilet'].includes(room.kind) || y2 - y1 < 50) return { x: cx, y: cy };
    return cy < corridorY(cfg, cx) ? { x: cx, y: y2 - 18 } : { x: cx, y: y1 + 18 };
  }

  function landmarkSpot(cfg, lm) {
    if (lm.spot) return { x: lm.spot[0], y: lm.spot[1] };
    return roomSpot(cfg, roomById(cfg, lm.room));
  }
  const landmarkLabel = (cfg, lm) => lm.label || roomById(cfg, lm.room)?.name || lm.id;

  // Nearest room door along the corridor, for "Corridor, near RB 704".
  const NEARBY = ['classroom', 'staff', 'hod', 'toilet', 'purifier', 'stairs'];
  function nearestRoomByX(cfg, x) {
    let best = null, bd = Infinity;
    for (const r of cfg.rooms) {
      if (!NEARBY.includes(r.kind) || r.layer === 'ground') continue;
      const d = Math.abs((r.rect[0] + r.rect[2]) / 2 - x);
      if (d < bd) { bd = d; best = r; }
    }
    return best;
  }

  /**
   * @returns {{ where: 'off'|'campus'|'ground'|'floor', x?: number, y?: number, label: string, landmark?: string, meters: {x, y} }}
   *   off     – outside the university
   *   campus  – inside, but not on the 7th floor and not at a ground-floor landmark (no footprints)
   *   ground  – at the entry gate / ground-floor lifts (shown in the ground-floor corner)
   *   floor   – on the 7th-floor map
   */
  function locate(cfg, lat, lng, onFloor) {
    const m = toMeters(cfg, lat, lng);
    const dist = Math.hypot(m.x, m.y);
    if (dist > cfg.campusRadius) return { where: 'off', label: `Off campus, ${distanceText(dist)} away`, meters: m };

    const layer = onFloor ? 'floor' : 'ground';
    const candidates = cfg.landmarks.map((lm) => {
      const p = toMeters(cfg, lm.lat, lm.lng);
      return { lm, d: Math.hypot(m.x - p.x, m.y - p.y) };
    }).filter(({ lm }) => (lm.layer || 'floor') === layer);

    const snap = candidates.filter((c) => c.d <= c.lm.radius).sort((a, b) => a.d - b.d)[0];
    const at = (lm, where, prefix = '') => ({ where, ...landmarkSpot(cfg, lm), label: prefix + landmarkLabel(cfg, lm), landmark: lm.id, meters: m });

    if (!onFloor) return snap ? at(snap.lm, 'ground') : { where: 'campus', label: 'In the university', meters: m };
    if (snap) return at(snap.lm, 'floor');

    if (dist <= cfg.centre.radius) {
      const near = candidates.filter((c) => c.lm.centre).sort((a, b) => a.d - b.d)[0];
      if (near) {
        const l = landmarkLabel(cfg, near.lm);
        return { ...at(near.lm, 'floor'), label: `Centre block, ${/^By /.test(l) ? 'b' + l.slice(1) : 'near ' + l}` };
      }
    }

    // Too far from the corridor to be in this building, whatever the floor switch says.
    const { u, len } = axis(cfg);
    const along = m.x * u.x + m.y * u.y, side = Math.abs(m.x * u.y - m.y * u.x);
    if (side > cfg.building.side || along < -cfg.building.ends || along > len + cfg.building.ends) {
      return { where: 'campus', label: 'In the university', meters: m };
    }
    const x = alongToX(cfg, along);
    const room = nearestRoomByX(cfg, x);
    return { where: 'floor', x, y: corridorY(cfg, x), label: room ? `Corridor, near ${room.name}` : 'In the corridor', meters: m };
  }

  // Where a person (as the server sends them) shows up: a QR/room pin wins, then GPS.
  function place(cfg, d) {
    if (!d.sharing) return null;
    const r = d.room && roomById(cfg, d.room);
    if (r) return { where: r.layer === 'ground' ? 'ground' : 'floor', ...roomSpot(cfg, r), label: `${r.name} (${r.key})`, pinned: true };
    if (d.lat == null) return null;
    return locate(cfg, d.lat, d.lng, d.onFloor);
  }
  function placeText(cfg, d) {
    if (!d.sharing) return 'Location hidden — mischief managed';
    const loc = place(cfg, d);
    if (!loc) return 'Waiting for a location…';
    if (loc.where === 'off') return `Beyond the castle walls · ${distanceText(Math.hypot(loc.meters.x, loc.meters.y))} from the college`;
    if (loc.where === 'campus') return 'In the university · not on the 7th floor';
    if (loc.where === 'ground') return `${loc.label} · ground floor`;
    return loc.pinned ? `${loc.label} · checked in` : loc.label;
  }

  // Even the far edge of the accuracy circle is off campus: safe to use a vague fix.
  function surelyOff(cfg, lat, lng, acc) {
    const m = toMeters(cfg, lat, lng);
    return Math.hypot(m.x, m.y) - acc > cfg.campusRadius;
  }
  const distanceText = (d) => (d < 950 ? `~${Math.round(d / 10) * 10} m` : `~${(d / 1000).toFixed(d < 9500 ? 1 : 0)} km`);

  // GPS for a spot on the floor: surveyed if we have it, otherwise estimated along the corridor.
  function gpsAlong(cfg, along, side = 0) {
    const { u } = axis(cfg);
    return toLatLng(cfg, u.x * along + u.y * side, u.y * along - u.x * side);
  }
  function gpsForRoom(cfg, id) {
    const lm = cfg.landmarks.find((l) => l.room === id);
    if (lm) return { lat: lm.lat, lng: lm.lng };
    const r = roomById(cfg, id);
    return gpsAlong(cfg, xToAlong(cfg, (r.rect[0] + r.rect[2]) / 2));
  }

  const GEO = { toMeters, toLatLng, axis, surelyOff, distanceText, place, placeText, alongToX, xToAlong, corridorY, lineY, roomById, roomSpot, landmarkSpot, locate, gpsAlong, gpsForRoom };
  if (typeof module !== 'undefined' && module.exports) module.exports = GEO;
  else root.GEO = GEO;
})(typeof globalThis !== 'undefined' ? globalThis : this);
