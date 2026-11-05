const jwt = require('jsonwebtoken')
const { JWT_SECRET } = require('../config')

function requireAuth(req, res, next) {
  const header = req.get('authorization') || ''
  const match = /^Bearer\s+(.+)$/i.exec(header)
  if (!match) return res.status(401).json({ error: 'Authentication required' })
  try {
    const decoded = jwt.verify(match[1], JWT_SECRET)
    if (!decoded || !Number.isInteger(Number(decoded.id)) || !decoded.role) {
      return res.status(401).json({ error: 'Invalid or expired token' })
    }
    if (decoded.role === 'hod') {
      const { dbGet } = require('../db/database')
      const hod = dbGet('SELECT auth_version FROM hod WHERE id=?', [Number(decoded.id)])
      if (!hod || Number(decoded.auth_version) !== Number(hod.auth_version)) {
        return res.status(401).json({ error: 'Invalid or expired token' })
      }
    }
    req.user = { ...decoded, id: Number(decoded.id) }
    return next()
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token' })
  }
}

function requireRole(...roles) {
  const allowed = roles.flat()
  return (req, res, next) => {
    if (!req.user || !allowed.includes(req.user.role)) {
      return res.status(403).json({ error: 'You do not have permission to perform this action' })
    }
    return next()
  }
}

module.exports = {
  requireAuth,
  requireRole,
  authenticate: requireAuth,
  allowRoles: requireRole,
}
