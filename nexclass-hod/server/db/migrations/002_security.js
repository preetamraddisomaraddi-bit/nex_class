function ensureColumn(db, table, column, definition) {
  const columns = db.prepare(`PRAGMA table_info(${table})`).all()
  if (!columns.some(item => item.name === column)) db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`)
}

module.exports.up = db => {
  ensureColumn(db, 'hod', 'auth_version', 'INTEGER NOT NULL DEFAULT 1')
  for (const table of ['hod', 'teachers', 'students']) {
    ensureColumn(db, table, 'failed_attempts', 'INTEGER NOT NULL DEFAULT 0')
    ensureColumn(db, table, 'locked_until', 'DATETIME')
  }
  db.exec(`CREATE TABLE IF NOT EXISTS audit_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    actor_role TEXT NOT NULL,
    actor_id INTEGER,
    action TEXT NOT NULL,
    target TEXT NOT NULL DEFAULT '',
    ip TEXT NOT NULL DEFAULT '',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`)
}
