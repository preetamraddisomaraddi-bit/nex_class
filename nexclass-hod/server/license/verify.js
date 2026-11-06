const crypto = require('crypto')
const publicKeys = require('./publicKeys')

function canonicalize(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalize).join(',')}]`
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${canonicalize(value[key])}`).join(',')}}`
  }
  return JSON.stringify(value)
}

function validatePayload(payload) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return false
  const { licenseId, college, plan, maxStudents, maxTeachers, features, issuedAt, expiresAt, keyId } = payload
  return typeof licenseId === 'string' && licenseId.length > 0 && licenseId.length <= 80 &&
    typeof college === 'string' && college.trim().length > 0 && college.length <= 200 &&
    typeof plan === 'string' && plan.trim().length > 0 && plan.length <= 40 &&
    Number.isSafeInteger(maxStudents) && maxStudents >= 0 && Number.isSafeInteger(maxTeachers) && maxTeachers >= 0 &&
    Array.isArray(features) && features.every(feature => typeof feature === 'string' && ['exams', 'codeRunner', 'ai'].includes(feature)) &&
    typeof issuedAt === 'string' && Number.isFinite(Date.parse(issuedAt)) &&
    typeof expiresAt === 'string' && Number.isFinite(Date.parse(expiresAt)) && Date.parse(expiresAt) >= Date.parse(issuedAt) &&
    typeof keyId === 'string' && /^[A-Za-z0-9_-]{1,40}$/.test(keyId)
}

function verifyLicense(input, keys = publicKeys) {
  let document
  try {
    document = typeof input === 'string' ? JSON.parse(input) : input
    if (!document || typeof document !== 'object' || !validatePayload(document.payload) || typeof document.signature !== 'string' || !/^[A-Za-z0-9+/]+=*$/.test(document.signature)) return { ok: false, reason: 'malformed' }
  } catch { return { ok: false, reason: 'malformed' } }
  const key = keys[document.payload.keyId]
  if (!key) return { ok: false, reason: 'unknown_key' }
  try {
    const valid = crypto.verify(null, Buffer.from(canonicalize(document.payload)), key, Buffer.from(document.signature, 'base64'))
    return valid ? { ok: true, payload: document.payload } : { ok: false, reason: 'bad_signature' }
  } catch { return { ok: false, reason: 'bad_signature' } }
}

module.exports = { canonicalize, verifyLicense, validatePayload }
