const fs = require('fs')
const http = require('http')
const https = require('https')
const os = require('os')
const path = require('path')
const express = require('express')
const cors = require('cors')
const helmet = require('helmet')
const { Server } = require('socket.io')
const { PORT, TLS_CERT, TLS_KEY, ALLOWED_ORIGINS = '' } = require('./config')
const { globalLimiter, authLimiter } = require('./rateLimits')
const { requestLogger, logger } = require('./logging')
const { db } = require('./db/database')
const packageInfo = require('./package.json')

function localIP() {
  try {
    for (const entries of Object.values(os.networkInterfaces())) {
      for (const entry of entries || []) if (entry.family === 'IPv4' && !entry.internal) return entry.address
    }
  } catch (error) { logger.warn({ message: error.message }, 'LAN address unavailable') }
  return 'localhost'
}

function createApp() {
  const app = express()
  app.disable('x-powered-by')
  app.use(helmet({ contentSecurityPolicy: false }))
  const allowedOrigins = new Set([
    'http://localhost:5173', 'http://localhost:5174', 'http://localhost:5175', 'http://localhost:5176',
    ...ALLOWED_ORIGINS.split(',').map(origin => origin.trim()).filter(Boolean),
  ])
  const originAllowed = (origin, callback) => callback(null, !origin || origin === 'null' || allowedOrigins.has(origin))
  app.use(cors({ origin: originAllowed, methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'], allowedHeaders: ['Content-Type', 'Authorization'] }))
  app.use(requestLogger)
  app.use(globalLimiter)
  app.use((req, res, next) => {
    const largeJson = req.method === 'POST' && (req.path === '/api/scores' || req.path === '/api/code/submit')
    express.json({ limit: largeJson ? '1mb' : '100kb' })(req, res, next)
  })
  app.use(express.urlencoded({ extended: false, limit: '100kb' }))

  for (const route of ['/api/auth/hod/login', '/api/auth/hod/register', '/api/auth/teacher/login', '/api/auth/teacher/register', '/api/auth/student/login', '/api/auth/student/register', '/api/setup/hod']) app.use(route, authLimiter)

  const httpServer = TLS_CERT && TLS_KEY && fs.existsSync(TLS_CERT) && fs.existsSync(TLS_KEY)
    ? https.createServer({ cert: fs.readFileSync(TLS_CERT), key: fs.readFileSync(TLS_KEY) }, app)
    : http.createServer(app)
  const io = new Server(httpServer, { maxHttpBufferSize: 10 * 1024 * 1024, cors: { origin: originAllowed, methods: ['GET', 'POST', 'PATCH', 'DELETE'] } })
  app.set('io', io)

  app.get('/api/health', (_req, res) => {
    let dbOk = false
    let schemaVersion = 0
    try {
      db.prepare('SELECT 1').get()
      dbOk = true
      schemaVersion = db.prepare('SELECT COALESCE(MAX(version),0) AS version FROM schema_migrations').get().version
    } catch { /* Return health details without leaking database errors. */ }
    const status = dbOk ? 'ok' : 'degraded'
    res.status(dbOk ? 200 : 503).json({ status, version: packageInfo.version, uptime: Math.floor(process.uptime()), dbOk, schemaVersion, connectedSockets: io.engine.clientsCount })
  })
  app.get('/health', (_req, res) => res.json({ status: 'ok', server: 'NexClass HOD Server', version: packageInfo.version, timestamp: new Date().toISOString() }))
  app.get('/discover', (_req, res) => res.json({ type: 'nexclass-hod-server', version: packageInfo.version, ip: localIP(), port: httpServer.address()?.port || PORT }))

  app.use('/api/setup', require('./routes/setup'))
  app.use('/api/auth', require('./routes/auth'))
  app.use('/api/teachers', require('./routes/teachers'))
  app.use('/api/students', require('./routes/students'))
  app.use('/api/rooms', require('./routes/rooms'))
  app.use('/api/attendance', require('./routes/attendance'))
  app.use('/api/exams', require('./routes/exams'))
  app.use('/api/scores', require('./routes/scores'))
  app.use('/api/alerts', require('./routes/alerts'))
  app.use('/api/audit', require('./routes/audit'))

  app.use((err, _req, res, _next) => {
    logger.error({ message: err?.message, stack: err?.stack, code: err?.code, status: err?.status }, 'API request failed')
    if (err?.status === 413 || err?.type === 'entity.too.large') return res.status(413).json({ error: 'Payload too large' })
    res.status(500).json({ error: 'Something went wrong' })
  })
  app.use((_req, res) => res.status(404).json({ error: 'Not found' }))

  require('./socket/serverAuth')(io)
  require('./socket/events')(io)
  return { app, httpServer, io }
}

module.exports = { createApp, localIP }
