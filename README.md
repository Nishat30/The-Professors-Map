# The Professors' Map

A Marauder's-Map style, real-time map that shows where professors are on the Computer Science department's 7th floor.
Plain HTML/CSS/JS plus a ~200-line Node WebSocket server. No database and no login.

## Run it

```bash
npm install
npm start                                        # http://localhost:3000
npx cloudflared tunnel --url http://localhost:3000   # public https link to share
```

| Page | What it's for |
|---|---|
| `http://localhost:3000/` | The map (students) |
| `/join` | **The link you share.** Enter a name → allow location → you land on the map, live. Where you show up comes only from GPS: in the building → 7th-floor map; elsewhere → the "Beyond the castle walls" circle |
| `/checkin?room=rb704` | What a door QR code opens: pins the professor to that room and floor |
| `/rooms` | Printable QR codes for every room |
| `/healthz` | Returns `ok` (for uptime checks) |

## How a location reaches the map

Everything about the floor lives in `public/config.js`: the rooms drawn from the sketch, and the
GPS landmarks from the survey (`survey-worker/`, data in the `floor7-survey-db` D1 database).

```
phone GPS (lat, lng, ±accuracy)
  → fixes worse than ±35 m are ignored (cell-tower guesses)       (teacher.js / server.js)
  → farther than 160 m from the 7th-floor lifts  → "Off campus"  (a vague fix is used here if even its
                                                    worst case is off campus)
  → off campus / in the university but not on floor 7 → footprints in the "Beyond the castle walls"
                                                    circle (true direction, squeezed distance)
  → more than 35 m beside the corridor, or 25 m past either end → not this building
  → teacher not on floor 7   → entry gate / ground-floor lifts, else "In the university"
  → within a landmark's radius (lift 5 m, HOD & staff rooms 2 m…) → snapped onto it
  → within 16 m of the lifts → nearest surveyed centre-block spot
  → otherwise: metres ALONG the right-block corridor → a point on the drawn corridor
```

GPS can't tell floors apart, so anyone whose GPS puts them inside the building is shown on the 7th
floor. Nobody is asked about floors when joining. Scanning a room's door QR (`/rooms`) pins you to
that room for a while, which is more exact than indoor GPS.

## Testing on a real phone

Phone browsers only allow GPS over **HTTPS**, so run a tunnel:

```bash
npx cloudflared tunnel --url http://localhost:3000
```

Open the `https://….trycloudflare.com/join` URL on your phone, enter a name, allow location, and walk.
The map page itself keeps sending your position, so keep it open.

## Known limits (on purpose, for now)

- The Left Block (LB) isn't surveyed yet, so it's drawn but nobody is placed there.
- The browser stops sending location when the phone is locked, so the page asks for a
  screen wake lock. True background tracking needs a native app.
- All state is in memory; restarting the server clears it. People not heard from in 12 hours are
  forgotten, and the server holds at most 500 names.
- There's no auth: anyone can join with any name.
- The survey upload (`/survey` → `/api/survey`) is off unless you start with `SURVEY=1`.
