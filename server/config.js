const fs = require('fs')
const os = require('os')
const path = require('path')
const crypto = require('crypto')

let userDataPath
try {
  const { app } = require('electron')
  userDataPath = app?.getPath?.('userData')
} catch { /* This legacy standalone server may run without Electron. */ }
userDataPath ||= path.join(os.homedir(), '.nexclass')
fs.mkdirSync(userDataPath, { recursive: true })

function readOrCreateSecret() {
  if (process.env.JWT_SECRET) return process.env.JWT_SECRET
  const secretPath = path.join(userDataPath, 'secret.key')
  try {
    const secret = fs.readFileSync(secretPath, 'utf8').trim()
    if (secret) return secret
  } catch (error) {
    if (error.code !== 'ENOENT') throw error
  }
  const secret = crypto.randomBytes(64).toString('hex')
  try {
    fs.writeFileSync(secretPath, secret, { mode: 0o600, flag: 'wx' })
    try { fs.chmodSync(secretPath, 0o600) } catch { /* Windows does not expose POSIX modes. */ }
    return secret
  } catch (error) {
    if (error.code !== 'EEXIST') throw error
    return fs.readFileSync(secretPath, 'utf8').trim()
  }
}

const JWT_SECRET = readOrCreateSecret()
module.exports = {
  PORT: Number(process.env.PORT || 3000),
  JWT_EXPIRES: process.env.JWT_EXPIRES || '7d',
  JWT_SECRET,
  // Keep compatibility with older university-admin sessions configured by deployments.
  JWT_SECRET_ADMIN: process.env.JWT_SECRET_ADMIN || JWT_SECRET,
  DB_PATH: process.env.DB_PATH || path.join(__dirname, 'db', 'edusync.db'),
}
