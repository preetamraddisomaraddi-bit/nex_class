const fs = require('fs')
const path = require('path')
const { Writable } = require('stream')
const pino = require('pino')
const pinoHttp = require('pino-http')
const { DATA_DIR, LOG_LEVEL } = require('./config')

const logDirectory = path.join(DATA_DIR, 'logs')

function dayStamp(date = new Date()) { return date.toISOString().slice(0, 10) }
function pruneOldLogs() {
  const cutoff = Date.now() - 14 * 24 * 60 * 60 * 1000
  for (const file of fs.readdirSync(logDirectory)) {
    const match = /^nexclass-(\d{4}-\d{2}-\d{2})\.log$/.exec(file)
    if (match && new Date(`${match[1]}T00:00:00Z`).getTime() < cutoff) {
      try { fs.unlinkSync(path.join(logDirectory, file)) } catch { /* best effort cleanup */ }
    }
  }
}

class DailyFileStream extends Writable {
  constructor() { super(); this.stamp = ''; this.file = null }
  _write(chunk, encoding, callback) {
    const stamp = dayStamp()
    if (stamp !== this.stamp) {
      fs.mkdirSync(logDirectory, { recursive: true })
      this.file?.end()
      this.stamp = stamp
      this.file = fs.createWriteStream(path.join(logDirectory, `nexclass-${stamp}.log`), { flags: 'a', mode: 0o600 })
      try { fs.chmodSync(path.join(logDirectory, `nexclass-${stamp}.log`), 0o600) } catch { /* Windows permissions differ */ }
      pruneOldLogs()
    }
    this.file.write(chunk, callback)
  }
  _final(callback) { this.file?.end(callback) || callback() }
}

const destination = new DailyFileStream()
const logger = pino({ level: LOG_LEVEL, redact: ['req.headers.authorization', 'req.body', 'res.body'] }, destination)
const requestLogger = pinoHttp({
  logger,
  serializers: {
    req: req => ({ method: req.method, path: String(req.url || '').split('?')[0], remoteAddress: req.socket?.remoteAddress }),
    res: res => ({ statusCode: res.statusCode }),
  },
  customProps: req => ({ user_id: req.user?.id ?? null, user_role: req.user?.role ?? null }),
  customSuccessMessage: req => `${req.method} ${String(req.url || '').split('?')[0]}`,
  customErrorMessage: req => `${req.method} ${String(req.url || '').split('?')[0]} failed`,
})

module.exports = { logger, requestLogger, logDirectory }
