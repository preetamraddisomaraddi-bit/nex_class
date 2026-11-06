const fs = require('fs')
const path = require('path')
const crypto = require('crypto')

const DATA_DIR = path.resolve(process.env.DATA_DIR || path.join(__dirname, 'data'))
const PORT = Number(process.env.PORT || 3000)
const HOST = process.env.HOST || '0.0.0.0'
const LOG_LEVEL = process.env.LOG_LEVEL || 'info'
const ALLOWED_ORIGINS = process.env.ALLOWED_ORIGINS || ''
const CODE_RUNNER_IMAGE = process.env.CODE_RUNNER_IMAGE || 'nexclass-code-runner:1.0'
const JWT_EXPIRES = process.env.JWT_EXPIRES || '7d'
const TLS_CERT = process.env.TLS_CERT ? path.resolve(process.env.TLS_CERT) : ''
const TLS_KEY = process.env.TLS_KEY ? path.resolve(process.env.TLS_KEY) : ''
const DB_PATH = path.join(DATA_DIR, 'nexclass-hod.db')
const SECRET_PATH = path.join(DATA_DIR, 'secret.key')

function ensureDataDirectories() {
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true })
    for (const directory of ['logs', 'backups', 'uploads']) {
      fs.mkdirSync(path.join(DATA_DIR, directory), { recursive: true })
    }
    fs.accessSync(DATA_DIR, fs.constants.R_OK | fs.constants.W_OK)
  } catch (error) {
    throw new Error(`DATA_DIR is not writable (${DATA_DIR}): ${error.message}`, { cause: error })
  }
}

function loadJwtSecret() {
  ensureDataDirectories()
  if (process.env.JWT_SECRET) return process.env.JWT_SECRET
  try {
    const existing = fs.readFileSync(SECRET_PATH, 'utf8').trim()
    if (existing) {
      try { fs.chmodSync(SECRET_PATH, 0o600) } catch { /* Windows permissions differ. */ }
      return existing
    }
  } catch (error) {
    if (error.code !== 'ENOENT') throw error
  }
  const secret = crypto.randomBytes(64).toString('hex')
  try {
    fs.writeFileSync(SECRET_PATH, secret, { mode: 0o600, flag: 'wx' })
    try { fs.chmodSync(SECRET_PATH, 0o600) } catch { /* Windows permissions differ. */ }
    return secret
  } catch (error) {
    if (error.code !== 'EEXIST') throw error
    return fs.readFileSync(SECRET_PATH, 'utf8').trim()
  }
}

const config = { DATA_DIR, DB_PATH, HOST, JWT_EXPIRES, LOG_LEVEL, PORT, ALLOWED_ORIGINS, TLS_CERT, TLS_KEY, CODE_RUNNER_IMAGE, ensureDataDirectories }
Object.defineProperty(config, 'JWT_SECRET', { enumerable: true, get: loadJwtSecret })
module.exports = config
