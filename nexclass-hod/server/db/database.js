const Database = require('better-sqlite3')
const { DB_PATH, JWT_SECRET } = require('../config')

const db = new Database(DB_PATH)
db.pragma('journal_mode = WAL')
db.pragma('foreign_keys = ON')

const dbGet = (sql, params = []) => db.prepare(sql).get(...params)
const dbAll = (sql, params = []) => db.prepare(sql).all(...params)
const dbRun = (sql, params = []) => db.prepare(sql).run(...params)
function writeAudit({ role, actorId = null, action, target = '', ip = '' }) {
  return dbRun('INSERT INTO audit_log (actor_role,actor_id,action,target,ip) VALUES (?,?,?,?,?)', [
    String(role || 'system').slice(0, 20), actorId == null ? null : Number(actorId),
    String(action).slice(0, 80), String(target).slice(0, 200), String(ip).slice(0, 64),
  ])
}

module.exports = { db, dbGet, dbAll, dbRun, writeAudit, jwtSecret: JWT_SECRET, DB_PATH }
