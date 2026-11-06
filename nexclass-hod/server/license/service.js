const { db, dbGet } = require('../db/database')
const { logger } = require('../logging')
const { verifyLicense } = require('./verify')

const DAY = 24 * 60 * 60 * 1000
const TRIAL_DAYS = 30
const GRACE_DAYS = 14
const TRIAL_FEATURES = ['exams', 'codeRunner', 'ai']
let lastPersistAt = 0

function licenseRow() { return dbGet('SELECT * FROM license WHERE id=1') }
function getStatus({ now = Date.now(), persist = true } = {}) {
  const row = licenseRow()
  if (!row) throw new Error('License migration has not run')
  let effectiveNow = now
  const lastSeen = Date.parse(row.last_seen_at)
  if (Number.isFinite(lastSeen) && now < lastSeen - DAY) {
    effectiveNow = lastSeen
    logger.warn({ last_seen_at: row.last_seen_at }, 'System clock rollback detected; using last seen time for license checks')
  }
  if (persist && effectiveNow > (Number.isFinite(lastSeen) ? lastSeen : 0) && Date.now() - lastPersistAt >= 60 * 60 * 1000) {
    const stamp = new Date(effectiveNow).toISOString()
    db.prepare('UPDATE license SET last_seen_at=? WHERE id=1 AND last_seen_at<=?').run(stamp, stamp)
    lastPersistAt = Date.now()
  }
  let payload = null
  let verification = null
  if (row.raw_json) {
    verification = verifyLicense(row.raw_json)
    if (verification.ok) payload = verification.payload
    else logger.error({ reason: verification.reason }, 'Stored license failed verification')
  }
  const firstRunAt = Date.parse(row.first_run_at)
  const trialEndsAt = firstRunAt + TRIAL_DAYS * DAY
  const trialLeft = Math.ceil((trialEndsAt - effectiveNow) / DAY)
  let state = 'unlicensed'
  if (!row.raw_json && effectiveNow < trialEndsAt) state = 'trial'
  else if (row.raw_json && !payload) state = 'invalid'
  else if (payload) {
    const expiresAt = Date.parse(payload.expiresAt)
    if (effectiveNow <= expiresAt) state = 'licensed'
    else if (effectiveNow <= expiresAt + GRACE_DAYS * DAY) state = 'grace'
    else state = 'expired'
  }
  const expiresAt = payload?.expiresAt || null
  const daysLeft = payload ? Math.ceil((Date.parse(expiresAt) - effectiveNow) / DAY) : state === 'trial' ? trialLeft : 0
  const graceEndsAt = payload ? new Date(Date.parse(expiresAt) + GRACE_DAYS * DAY).toISOString() : null
  return {
    state, payload, reason: verification?.reason || null, effectiveNow,
    college: payload?.college || null, plan: payload?.plan || (state === 'trial' ? 'trial' : null),
    maxStudents: payload?.maxStudents ?? (state === 'trial' ? 30 : 0),
    maxTeachers: payload?.maxTeachers ?? (state === 'trial' ? 3 : 0),
    expiresAt, daysLeft: Math.max(0, daysLeft), graceEndsAt,
    features: payload?.features || (state === 'trial' ? [...TRIAL_FEATURES] : []),
    trialEndsAt: new Date(trialEndsAt).toISOString(), lastSeenAt: row.last_seen_at,
  }
}

function updateLastSeenOnStartup(now = Date.now()) {
  const row = licenseRow()
  if (!row) return
  const last = Date.parse(row.last_seen_at)
  if (Number.isFinite(last) && now < last - DAY) {
    logger.warn({ last_seen_at: row.last_seen_at }, 'System clock rollback detected at startup')
    return
  }
  if (!Number.isFinite(last) || now > last) db.prepare('UPDATE license SET last_seen_at=? WHERE id=1').run(new Date(now).toISOString())
  lastPersistAt = Date.now()
}

function isReadOnlyState(state) { return ['expired', 'unlicensed', 'invalid'].includes(state) }
function counts() {
  return {
    students: Number(dbGet('SELECT COUNT(*) AS n FROM students').n),
    teachers: Number(dbGet("SELECT COUNT(*) AS n FROM teachers WHERE status='approved'").n),
  }
}
function publicStatus() {
  const status = getStatus()
  const used = counts()
  return {
    state: status.state, college: status.college, plan: status.plan,
    seats: { students: { used: used.students, max: status.maxStudents }, teachers: { used: used.teachers, max: status.maxTeachers } },
    expiresAt: status.expiresAt, daysLeft: status.daysLeft, graceEndsAt: status.graceEndsAt,
    features: status.features, trialEndsAt: status.trialEndsAt,
  }
}

module.exports = { DAY, TRIAL_DAYS, GRACE_DAYS, TRIAL_FEATURES, getStatus, publicStatus, updateLastSeenOnStartup, isReadOnlyState, counts }
