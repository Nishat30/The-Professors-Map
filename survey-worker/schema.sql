-- One row per recording. Record the same spot several times; the page groups by label.
CREATE TABLE IF NOT EXISTS points (
  id          TEXT PRIMARY KEY,          -- generated on the phone, so offline retries don't duplicate
  label       TEXT NOT NULL,             -- "HOD Room door", "Lift 1", ...
  type        TEXT NOT NULL,             -- Lift, Classroom, Water purifier, ...
  floor       TEXT NOT NULL DEFAULT '7',
  note        TEXT NOT NULL DEFAULT '',
  lat         REAL NOT NULL,
  lng         REAL NOT NULL,
  acc         REAL,                      -- median phone-reported accuracy (m)
  spread      REAL,                      -- RMS wobble of the readings (m)
  alt         REAL,                      -- mean altitude, if the phone gave one
  n_samples   INTEGER NOT NULL DEFAULT 0,
  samples     TEXT NOT NULL DEFAULT '[]', -- raw readings as JSON
  is_real     INTEGER NOT NULL DEFAULT 0, -- "this is the real one"
  deleted     INTEGER NOT NULL DEFAULT 0, -- soft delete, nothing is ever lost
  device      TEXT NOT NULL DEFAULT '',
  recorded_at TEXT NOT NULL,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS points_label ON points (label);
