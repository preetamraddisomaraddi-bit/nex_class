const service = require('../license/service')

const expiredMessage = 'The NexClass license has expired. Activate a valid license to continue.'
function requireWritable(_req, res, next) {
  const status = service.getStatus()
  if (service.isReadOnlyState(status.state)) return res.status(403).json({ code: 'LICENSE_EXPIRED', error: expiredMessage })
  next()
}
function requireFeature(feature) {
  return (_req, res, next) => {
    const status = service.getStatus()
    if (service.isReadOnlyState(status.state)) return res.status(403).json({ code: 'LICENSE_EXPIRED', error: expiredMessage })
    if (!status.features.includes(feature)) return res.status(403).json({ code: 'LICENSE_LIMIT', error: `The current license does not include the ${feature} feature.` })
    next()
  }
}
function requireSeat(role) {
  return (_req, res, next) => {
    const status = service.getStatus()
    if (service.isReadOnlyState(status.state)) return res.status(403).json({ code: 'LICENSE_EXPIRED', error: expiredMessage })
    const used = service.counts()[role === 'student' ? 'students' : 'teachers']
    const max = role === 'student' ? status.maxStudents : status.maxTeachers
    if (used >= max) return res.status(403).json({ code: 'LICENSE_LIMIT', error: `The license seat limit for ${role}s has been reached (${used}/${max}).` })
    next()
  }
}

module.exports = { requireWritable, requireFeature, requireSeat }
