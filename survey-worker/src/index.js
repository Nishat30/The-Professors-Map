// Floor-7 survey API. Static pages are served from ./public; everything under /api hits D1.
//   GET    /api/points            list recordings (no raw samples)
//   POST   /api/points            add a recording (idempotent on id)
//   PATCH  /api/points/:id        { is_real?, note? }
//   DELETE /api/points/:id        soft delete
//   GET    /api/export            everything, raw samples included, as a JSON download

const json = (data, status = 200, headers = {}) =>
  new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json', ...headers } });

const str = (v, max) => String(v ?? '').replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, max);
const num = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : null);

const LIST_COLS = 'id, label, type, floor, note, lat, lng, acc, spread, alt, n_samples, is_real, device, recorded_at';

export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    const [, , resource, id] = url.pathname.split('/'); // "", "api", "points", ":id"

    try {
      if (resource === 'points' && !id) {
        if (req.method === 'GET') {
          const { results } = await env.DB.prepare(`SELECT ${LIST_COLS} FROM points WHERE deleted = 0 ORDER BY recorded_at`).all();
          return json({ points: results });
        }
        if (req.method === 'POST') return addPoint(req, env);
      }

      if (resource === 'points' && id) {
        if (req.method === 'PATCH') {
          const body = await req.json().catch(() => ({}));
          const sets = [], args = [];
          if (typeof body.is_real === 'boolean') { sets.push('is_real = ?'); args.push(body.is_real ? 1 : 0); }
          if (typeof body.note === 'string') { sets.push('note = ?'); args.push(str(body.note, 200)); }
          if (!sets.length) return json({ error: 'nothing to update' }, 400);
          await env.DB.prepare(`UPDATE points SET ${sets.join(', ')} WHERE id = ?`).bind(...args, id).run();
          return json({ ok: true });
        }
        if (req.method === 'DELETE') {
          await env.DB.prepare('UPDATE points SET deleted = 1 WHERE id = ?').bind(id).run();
          return json({ ok: true });
        }
      }

      if (resource === 'export' && req.method === 'GET') {
        const { results } = await env.DB.prepare('SELECT * FROM points ORDER BY recorded_at').all();
        const points = results.map((r) => ({ ...r, samples: JSON.parse(r.samples || '[]') }));
        return json({ exportedAt: new Date().toISOString(), points }, 200, {
          'Content-Disposition': `attachment; filename="floor7-survey-${new Date().toISOString().slice(0, 10)}.json"`,
        });
      }

      return json({ error: 'not found' }, 404);
    } catch (err) {
      return json({ error: String(err?.message || err) }, 500);
    }
  },
};

async function addPoint(req, env) {
  const text = await req.text();
  if (text.length > 1_000_000) return json({ error: 'too large' }, 413);
  let p;
  try { p = JSON.parse(text); } catch { return json({ error: 'bad json' }, 400); }

  const id = str(p.id, 40), label = str(p.label, 80), type = str(p.type, 40);
  const lat = num(p.lat), lng = num(p.lng);
  if (!id || !label || !type || lat == null || lng == null || Math.abs(lat) > 90 || Math.abs(lng) > 180) {
    return json({ error: 'id, label, type, lat and lng are required' }, 400);
  }
  const samples = Array.isArray(p.samples) ? p.samples.slice(0, 500) : [];

  await env.DB.prepare(
    `INSERT OR IGNORE INTO points (id, label, type, floor, note, lat, lng, acc, spread, alt, n_samples, samples, is_real, device, recorded_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).bind(
    id, label, type, str(p.floor, 8) || '7', str(p.note, 200), lat, lng,
    num(p.acc), num(p.spread), num(p.alt), samples.length, JSON.stringify(samples),
    p.is_real ? 1 : 0, str(p.device, 60), str(p.recorded_at, 40) || new Date().toISOString(),
  ).run();

  return json({ ok: true, id });
}
