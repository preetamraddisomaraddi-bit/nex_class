// Load optional server-local settings before importing config and routes.
const fs = require('fs')
const path = require('path')
const envPath = path.join(__dirname, '.env')
if (fs.existsSync(envPath)) for (const line of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
  const match = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/.exec(line)
  if (match && !(match[1] in process.env)) process.env[match[1]] = match[2].replace(/^(['\"])(.*)\1$/, '$2')
}

const os = require('os')
const { PORT, HOST, DATA_DIR, ensureDataDirectories } = require('./config')
const { runMigrations } = require('./db/migrations')
const { logger } = require('./logging')

let httpServer
let io
let db
let localIP = () => 'localhost'
let shuttingDown = false
let shutdownTimer

function lanAddresses() {
  const addresses = []
  try {
    for (const list of Object.values(os.networkInterfaces() || {})) {
      for (const entry of list || []) if (entry.family === 'IPv4' && !entry.internal) addresses.push(entry.address)
    }
  } catch (error) { logger.warn({ message: error.message }, 'Could not enumerate LAN addresses') }
  return addresses.length ? addresses : [localIP()]
}

async function start() {
  ensureDataDirectories()
  const database = require('./db/database')
  db = database.db
  const schemaVersion = await runMigrations(db, { dataDir: DATA_DIR })
  const licensing = require('./license/service')
  licensing.updateLastSeenOnStartup()
  // Remove only the exact obsolete seeded account from old installations.
  const legacy = db.prepare('SELECT id, employee_id, email FROM hod WHERE id=1').get()
  if (legacy?.employee_id === 'BIT-HOD-001' && legacy?.email === 'hod.cse@nexclass.demo') db.prepare('DELETE FROM hod WHERE id=1').run()

  const { createApp, localIP: getLocalIP } = require('./app')
  localIP = getLocalIP
  const service = createApp()
  httpServer = service.httpServer
  io = service.io
  await new Promise((resolve, reject) => {
    const onError = error => {
      httpServer.removeListener('listening', onListening)
      if (error.code === 'EADDRINUSE') reject(new Error(`Port ${PORT} is already in use on ${HOST}. Stop the other server or set PORT to a free port.`))
      else reject(error)
    }
    const onListening = () => {
      httpServer.removeListener('error', onError)
      resolve()
    }
    httpServer.once('error', onError)
    httpServer.once('listening', onListening)
    httpServer.listen(PORT, HOST)
  })
  const address = httpServer.address()
  const protocol = httpServer instanceof require('https').Server ? 'https' : 'http'
  const info = { ip: lanAddresses()[0], ips: lanAddresses(), port: address.port, schemaVersion, protocol }
  console.log(`\nNexClass Server v${require('./package.json').version}\n  Host:    ${HOST}\n  Port:    ${info.port}\n  LAN:     ${info.ips.map(ip => `http://${ip}:${info.port}`).join(', ')}\n  Data:    ${DATA_DIR}\n`)
  if (typeof process.send === 'function') process.send({ type: 'ready', ip: info.ip, ips: info.ips, port: info.port, schemaVersion, protocol })
  const licenseClock = setInterval(() => licensing.getStatus(), 60 * 60 * 1000)
  licenseClock.unref()
  process.once('exit', () => clearInterval(licenseClock))
  return info
}

async function shutdown(signal = 'shutdown') {
  if (shuttingDown) return
  shuttingDown = true
  console.log(`NexClass server shutting down (${signal})`)
  shutdownTimer = setTimeout(() => process.exit(1), 9000)
  shutdownTimer.unref()
  try {
    if (httpServer?.listening) httpServer.close()
    if (io) {
      io.emit('server:shutdown', { message: 'Server is shutting down' })
      await new Promise(resolve => io.close(resolve))
    }
  } catch (error) { logger.error({ message: error.message }, 'Graceful shutdown error') }
  try { db.close() } catch (error) { logger.error({ message: error.message }, 'Database close failed') }
  clearTimeout(shutdownTimer)
  process.exit(0)
}

if (require.main === module) {
  start().catch(error => {
    logger.fatal({ message: error.message, code: error.code }, 'Server startup failed')
    if (typeof process.send === 'function') process.send({ type: 'error', code: error.code || '', message: error.message })
    try { io?.close() } catch { /* no active socket server */ }
    try { httpServer?.close() } catch { /* server was not listening */ }
    try { db.close() } catch { /* no database connection to close */ }
    process.exitCode = 1
  })
  process.on('SIGINT', () => shutdown('SIGINT'))
  process.on('SIGTERM', () => shutdown('SIGTERM'))
}

module.exports = { start, shutdown }
