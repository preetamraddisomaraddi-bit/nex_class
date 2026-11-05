const fs = require('fs')
const path = require('path')
const { DATA_DIR } = require('../../config')

const migrationDir = __dirname
const migrationFiles = fs.readdirSync(migrationDir)
  .filter(file => /^\d+_.+\.js$/.test(file))
  .sort((a, b) => Number(a.slice(0, 3)) - Number(b.slice(0, 3)))
  .map(file => ({ file, version: Number(file.slice(0, 3)), name: file.replace(/^\d+_/, '').replace(/\.js$/, ''), up: require(path.join(migrationDir, file)).up }))

function tableExists(db, name) {
  return Boolean(db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name=?").get(name))
}
function columnExists(db, table, column) {
  return tableExists(db, table) && db.prepare(`PRAGMA table_info(${table})`).all().some(item => item.name === column)
}
function markLegacyMigrations(db) {
  const coreTables = ['hod', 'teachers', 'students', 'rooms', 'attendance', 'notes', 'exams', 'exam_scores', 'code_submissions', 'alerts']
  if (coreTables.every(table => tableExists(db, table))) {
    db.prepare('INSERT OR IGNORE INTO schema_migrations(version,name) VALUES(?,?)').run(1, 'initial')
    const securityExists = ['hod', 'teachers', 'students'].every(table => columnExists(db, table, 'failed_attempts') && columnExists(db, table, 'locked_until')) && tableExists(db, 'audit_log')
    if (securityExists) db.prepare('INSERT OR IGNORE INTO schema_migrations(version,name) VALUES(?,?)').run(2, 'security')
  }
}

async function runMigrations(db, { dataDir = DATA_DIR } = {}) {
  db.exec('CREATE TABLE IF NOT EXISTS schema_migrations (version INTEGER PRIMARY KEY, name TEXT NOT NULL, applied_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP)')
  markLegacyMigrations(db)
  const backupsDir = path.join(dataDir, 'backups')
  fs.mkdirSync(backupsDir, { recursive: true })
  for (const migration of migrationFiles) {
    if (db.prepare('SELECT 1 FROM schema_migrations WHERE version=?').get(migration.version)) continue
    const existingTables = db.prepare("SELECT COUNT(*) AS n FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name != 'schema_migrations'").get().n
    if (existingTables > 0 && fs.existsSync(db.name) && db.name !== ':memory:') {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
      const backupPath = path.join(backupsDir, `pre-migration-${migration.version}-${timestamp}.db`)
      await db.backup(backupPath)
    }

    const apply = db.transaction(() => {
      migration.up(db)
      db.prepare('INSERT INTO schema_migrations(version,name) VALUES(?,?)').run(migration.version, migration.name)
    })
    try { apply() } catch (error) {
      throw new Error(`Migration ${String(migration.version).padStart(3, '0')} (${migration.name}) failed: ${error.message}`, { cause: error })
    }
  }
  return db.prepare('SELECT COALESCE(MAX(version),0) AS version FROM schema_migrations').get().version
}

module.exports = { runMigrations, migrationFiles }
