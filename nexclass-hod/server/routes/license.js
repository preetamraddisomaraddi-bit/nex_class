const express = require('express')
const { requireAuth, requireRole } = require('../middleware/auth')
const { db, dbGet, writeAudit } = require('../db/database')
const { verifyLicense } = require('../license/verify')
const licensing = require('../license/service')

const router = express.Router()
router.get('/', requireAuth, (_req, res) => res.json(licensing.publicStatus()))
router.post('/activate', requireAuth, requireRole('hod'), (req, res) => {
  const raw = req.body?.license
  if (typeof raw !== 'string' || !raw.trim() || Buffer.byteLength(raw) > 64 * 1024) return res.status(400).json({ error: 'Provide license JSON text (maximum 64 KB).' })
  const checked = verifyLicense(raw)
  if (!checked.ok) {
    const messages = { malformed: 'License file is malformed.', bad_signature: 'License signature is invalid.', unknown_key: 'License key is not recognized by this server.' }
    return res.status(400).json({ error: messages[checked.reason] || 'License is invalid.' })
  }
  const payload = checked.payload
  const now = licensing.getStatus().effectiveNow
  if (Date.parse(payload.expiresAt) < now) return res.status(400).json({ error: 'This license has expired. Ask your vendor for a current license.' })
  const currentRaw = dbGet('SELECT raw_json FROM license WHERE id=1')?.raw_json
  if (currentRaw) {
    const old = verifyLicense(currentRaw)
    if (old.ok && Date.parse(payload.issuedAt) < Date.parse(old.payload.issuedAt)) return res.status(409).json({ error: 'This license is older than the license already activated.' })
  }
  db.prepare('UPDATE license SET raw_json=?, activated_at=?, last_seen_at=? WHERE id=1').run(JSON.stringify({ payload, signature: JSON.parse(raw).signature }), new Date(now).toISOString(), new Date(now).toISOString())
  writeAudit({ role: 'hod', actorId: req.user.id, action: 'license_activate', target: `${payload.licenseId}:${payload.college}`, ip: req.ip })
  return res.json(licensing.publicStatus())
})
module.exports = router
