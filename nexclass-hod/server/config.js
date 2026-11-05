const fs = require('fs')
const path = require('path')
const crypto = require('crypto')
const { app } = require('electron')

const envFile = path.join(__dirname, '.env')
if (fs.existsSync(envFile)) {
  for (const line of fs.readFileSync(envFile, 'utf8').split(/\r?\n/)) {
    const match = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/.exec(line)
    if (!match || process.env[match[1]] !== undefined) continue
    const value = match[2].replace(/^(['"])(.*)\1$/, '$2')
    process.env[match[1]] = value
  }
}

const userDataPath = app.getPath('userData')
const PORT = Number(process.env.PORT || 3000)
const JWT_EXPIRES = process.env.JWT_EXPIRES || '7d'
const DB_PATH = process.env.DB_PATH || process.env.NEXCLASS_DB_PATH || path.join(userDataPath, 'nexclass-hod.db')
const SECRET_PATH = path.join(userDataPath, 'secret.key')

function loadJwtSecret() {
  if (process.env.JWT_SECRET) return process.env.JWT_SECRET

  fs.mkdirSync(userDataPath, { recursive: true })
  try {
    const existing = fs.readFileSync(SECRET_PATH, 'utf8').trim()
    if (existing) {
      try { fs.chmodSync(SECRET_PATH, 0o600) } catch { /* Windows does not expose POSIX modes. */ }
      return existing
    }
  } catch (error) {
    if (error.code !== 'ENOENT') throw error
  }

  // Preserve JWT validity for existing installations being upgraded.
  const legacySecretPath = path.join(userDataPath, 'nexclass-jwt-secret')
  try {
    const legacySecret = fs.readFileSync(legacySecretPath, 'utf8').trim()
    if (legacySecret) {
      fs.writeFileSync(SECRET_PATH, legacySecret, { mode: 0o600, flag: 'wx' })
      try { fs.chmodSync(SECRET_PATH, 0o600) } catch { /* Windows does not expose POSIX modes. */ }
      return legacySecret
    }
  } catch (error) {
    if (error.code !== 'ENOENT') throw error
  }

  const generated = crypto.randomBytes(64).toString('hex')
  try {
    fs.writeFileSync(SECRET_PATH, generated, { mode: 0o600, flag: 'wx' })
    try { fs.chmodSync(SECRET_PATH, 0o600) } catch { /* Windows does not expose POSIX modes. */ }
    return generated
  } catch (error) {
    if (error.code !== 'EEXIST') throw error
    return fs.readFileSync(SECRET_PATH, 'utf8').trim()
  }
}

const JWT_SECRET = loadJwtSecret()

module.exports = { PORT, JWT_EXPIRES, DB_PATH, JWT_SECRET, userDataPath }
