// Tiny static + WebSocket server. All state is in memory.
//   npm start                 -> the map, on PORT (default 3000)
//   SURVEY=1 npm start        -> also accepts floor-survey uploads at /api/survey
const http = require('http');
const fs = require('fs');
const path = require('path');
const { WebSocketServer } = require('ws');
const CAMPUS = require('./public/config.js');
const GEO = require('./public/geo.js');

const PORT = Number(process.env.PORT) || 3000;
const SURVEY = process.env.SURVEY === '1';
const MAX_TEACHERS = 500;             // in-memory cap, so nobody can fill the server with fake names
const FORGET_AFTER_MS = 12 * 3600e3;  // drop people not heard from in this long
const PUBLIC = path.join(__dirname, 'public');

const ROUTES = { '/': 'index.html', '/join': 'teacher.html', '/teacher': 'teacher.html', '/checkin': 'checkin.html', '/rooms': 'rooms.html', '/survey': 'survey.html' };
const SURVEY_DIR = path.join(__dirname, 'data');
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon' };

const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://x');
  if (url.pathname === '/healthz') return res.writeHead(200, { 'Content-Type': 'text/plain' }).end('ok');
  if (req.method === 'POST' && url.pathname === '/api/survey') return SURVEY ? saveSurvey(req, res) : res.writeHead(404).end();
  const rel = ROUTES[url.pathname] || url.pathname.slice(1);
  const file = path.normalize(path.join(PUBLIC, rel));
  if (!file.startsWith(PUBLIC)) return res.writeHead(403).end();
  fs.readFile(file, (err, data) => {
    if (err) return res.writeHead(404).end('Not found');
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
    res.end(data);
  });
});

// Survey uploads from /survey land in data/survey-<time>.json (and data/survey-latest.json).
function saveSurvey(req, res) {
  let body = '';
  req.on('data', (c) => {
    body += c;
    if (body.length > 5e6) { res.writeHead(413).end(); req.destroy(); }
  });
  req.on('end', () => {
    let data;
    try { data = JSON.parse(body); } catch { return res.writeHead(400).end('Bad JSON'); }
    if (!Array.isArray(data?.points)) return res.writeHead(400).end('No points');
    fs.mkdirSync(SURVEY_DIR, { recursive: true });
    const text = JSON.stringify(data, null, 2);
    fs.writeFileSync(path.join(SURVEY_DIR, `survey-${Date.now()}.json`), text);
    fs.writeFileSync(path.join(SURVEY_DIR, 'survey-latest.json'), text);
    console.log(`Survey saved: ${data.points.length} spots`);
    res.writeHead(200, { 'Content-Type': 'application/json' }).end('{"ok":true}');
  });
}

// ---- state -------------------------------------------------------------------------------
/** id -> { id, name, status, sharing, lat, lng, acc, onFloor, floorAt, room, roomAt, lastSeen } */
const teachers = new Map();
const wss = new WebSocketServer({ server, maxPayload: 4096 });

const floorLive = (t) => t.onFloor && Date.now() - t.floorAt < CAMPUS.floorHoldHours * 3600e3;
const roomLive = (t) => t.room && Date.now() - t.roomAt < CAMPUS.roomPinMinutes * 60e3;

function view(t) {
  const base = { id: t.id, name: t.name, status: t.status, sharing: t.sharing, lastSeen: t.lastSeen };
  if (!t.sharing) return base;
  return { ...base, lat: t.lat, lng: t.lng, acc: t.acc, onFloor: floorLive(t), room: roomLive(t) ? t.room : null };
}

function send(ws, msg) {
  if (ws.readyState === 1) ws.send(JSON.stringify({ ...msg, now: Date.now() }));
}
function broadcast(msg) {
  for (const ws of wss.clients) send(ws, msg);
}
const pushTeacher = (t) => broadcast({ type: 'update', teacher: view(t) });

const cleanStr = (s, max) => String(s ?? '').replace(/[\u0000-\u001f]/g, '').trim().slice(0, max);
const isNum = (n) => typeof n === 'number' && Number.isFinite(n);

function upsert(id, name) {
  let t = teachers.get(id);
  if (!t) {
    if (teachers.size >= MAX_TEACHERS) return null;
    t = { id, name, status: 'Available', sharing: false, lat: null, lng: null, acc: null, onFloor: false, floorAt: 0, room: null, roomAt: 0, lastSeen: Date.now() };
    teachers.set(id, t);
  }
  if (name) t.name = name;
  return t;
}

const setFloor = (t, on) => { t.onFloor = on; t.floorAt = Date.now(); };

function setLocation(t, lat, lng, acc) {
  t.lastSeen = Date.now();
  // A vague fix (often a cell-tower guess) shouldn't move anyone, unless even its worst case is off campus.
  if (acc > CAMPUS.maxAcc && !GEO.surelyOff(CAMPUS, lat, lng, acc)) return;
  t.lat = lat; t.lng = lng; t.acc = acc;
  const loc = GEO.locate(CAMPUS, lat, lng, floorLive(t));
  if (loc.where === 'off') { setFloor(t, false); t.room = null; return; }
  // A confident fix far from the checked-in room overrides the QR pin.
  if (roomLive(t) && acc <= 20 && loc.x != null) {
    const spot = GEO.roomSpot(CAMPUS, GEO.roomById(CAMPUS, t.room));
    if (Math.hypot(spot.x - loc.x, spot.y - loc.y) > 160) t.room = null;
  }
}

function checkIn(t, room) {
  t.sharing = true;
  setFloor(t, room.layer !== 'ground');
  t.room = room.id; t.roomAt = Date.now(); t.lastSeen = Date.now();
  // Put the raw position at the room too, so there is no GPS "jump" on the map.
  const ll = GEO.gpsForRoom(CAMPUS, room.id);
  t.lat = ll.lat; t.lng = ll.lng; t.acc = 3;
}

wss.on('connection', (ws) => {
  send(ws, { type: 'state', teachers: [...teachers.values()].map(view) });

  ws.on('message', (raw) => {
    let msg;
    try { msg = JSON.parse(raw); } catch { return; }
    if (!msg || typeof msg.type !== 'string') return;

    if (msg.type === 'join') {
      const id = cleanStr(msg.id, 40);
      const name = cleanStr(msg.name, 40);
      if (!id || !name) return;
      const t = upsert(id, name);
      if (!t) return;
      ws.teacherId = id;
      ws.teacherName = name;
      pushTeacher(t);
      return;
    }

    // Someone forgotten while their page stayed open comes back on their next message.
    const t = ws.teacherId && (teachers.get(ws.teacherId) || upsert(ws.teacherId, ws.teacherName));
    if (!t) return;

    switch (msg.type) {
      case 'share':
        t.sharing = !!msg.on;
        t.lastSeen = Date.now();
        if (!t.sharing) t.room = null;
        break;
      case 'status':
        if (CAMPUS.statuses.includes(msg.status)) t.status = msg.status;
        break;
      case 'floor':
        setFloor(t, !!msg.on);
        if (!msg.on) t.room = null;
        break;
      case 'loc':
        if (!t.sharing || !isNum(msg.lat) || !isNum(msg.lng)) return;
        setLocation(t, msg.lat, msg.lng, isNum(msg.acc) ? Math.max(0, msg.acc) : 50);
        break;
      case 'ping':
        t.lastSeen = Date.now();
        break;
      case 'checkin': {
        const room = GEO.roomById(CAMPUS, msg.room);
        if (!room || !room.key) return;
        checkIn(t, room);
        break;
      }
      case 'checkout':
        t.room = null;
        break;
      default:
        return;
    }
    pushTeacher(t);
  });
});

// Forget people who closed the page long ago.
setInterval(() => {
  const cutoff = Date.now() - FORGET_AFTER_MS;
  for (const [id, t] of teachers) {
    if (t.lastSeen >= cutoff) continue;
    teachers.delete(id);
    broadcast({ type: 'gone', id });
  }
}, 10 * 60e3);

server.listen(PORT, () => {
  console.log(`\n  The Professors' Map is open:   http://localhost:${PORT}`);
  console.log(`  Join link (share this):        http://localhost:${PORT}/join`);
  console.log(`  Printable room QR codes:       http://localhost:${PORT}/rooms`);
  if (SURVEY) console.log(`  Floor survey tool:             http://localhost:${PORT}/survey`);
  console.log('\n  Phones need HTTPS for GPS:  npx cloudflared tunnel --url http://localhost:' + PORT + '\n');
});
