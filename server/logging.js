const fs = require('fs')
const path = require('path')
const { Writable } = require('stream')
const pino = require('pino')
const pinoHttp = require('pino-http')
const { userDataPath } = require('./config')

const logDirectory = path.join(userDataPath, 'logs')
fs.mkdirSync(logDirectory, { recursive: true })
const stamp = () => new Date().toISOString().slice(0, 10)
function prune() {
  const cutoff = Date.now() - 14 * 86400000
  for (const name of fs.readdirSync(logDirectory)) {
    const match = /^nexclass-(\d{4}-\d{2}-\d{2})\.log$/.exec(name)
    if (match && Date.parse(`${match[1]}T00:00:00Z`) < cutoff) {
      try { fs.unlinkSync(path.join(logDirectory, name)) } catch { /* best effort */ }
    }
  }
}
class DailyStream extends Writable {
  constructor() { super(); this.current = ''; this.file = null; prune() }
  _write(chunk, encoding, callback) {
    const today = stamp()
    if (today !== this.current) {
      this.file?.end()
      this.current = today
      const filePath = path.join(logDirectory, `nexclass-${today}.log`)
      this.file = fs.createWriteStream(filePath, { flags: 'a', mode: 0o600 })
      try { fs.chmodSync(filePath, 0o600) } catch { /* platform may not support POSIX modes */ }
      prune()
    }
    this.file.write(chunk, callback)
  }
  _final(callback) { this.file?.end(callback) || callback() }
}
const logger = pino({ level: process.env.LOG_LEVEL || 'info' }, new DailyStream())
const requestLogger = pinoHttp({
  logger,
  serializers: {
    req: req => ({ method: req.method, path: String(req.url || '').split('?')[0], remoteAddress: req.socket?.remoteAddress }),
    res: res => ({ statusCode: res.statusCode })
  },
  customProps: req => ({ user_id: req.user?.id ?? null, user_role: req.user?.role ?? null })
})
module.exports = { logger, requestLogger }
