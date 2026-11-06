module.exports.up = db => {
  db.exec(`CREATE TABLE IF NOT EXISTS license (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    raw_json TEXT,
    activated_at TEXT,
    first_run_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    last_seen_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`)
  db.prepare(`INSERT OR IGNORE INTO license(id, raw_json, activated_at, first_run_at, last_seen_at)
    VALUES(1, NULL, NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`).run()
}
