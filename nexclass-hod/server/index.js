const express = require('express')
const http = require('http')
const os = require('os')
const cors = require('cors')
const jwt = require('jsonwebtoken')
const { Server } = require('socket.io')

const PORT = Number(process.env.NEXCLASS_PORT || 3000)
const localIP = () => {
  try {
    for (const entries of Object.values(os.networkInterfaces())) {
      for (const entry of entries || []) {
        if (entry.family === 'IPv4' && !entry.internal) return entry.address
      }
    }
  } catch (error) {
    console.warn('Could not read network interfaces:', error.message)
  }
  return 'localhost'
}

function startServer() {
  const { jwtSecret } = require('./db/database')
  const app = express()
  const httpServer = http.createServer(app)
  const io = new Server(httpServer, { cors: { origin: '*', methods: ['GET', 'POST', 'PATCH', 'DELETE'] } })
  app.use(cors({ origin: '*', methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'], allowedHeaders: ['Content-Type', 'Authorization'] }))
  app.use(express.json({ limit: '2mb' }))
  app.use(express.urlencoded({ extended: true, limit: '2mb' }))
  app.get('/health', (_req, res) => res.json({ status: 'ok', server: 'NexClass HOD Server', version: '1.0.0', timestamp: new Date().toISOString() }))
  app.get('/discover', (_req, res) => res.json({ type: 'nexclass-hod-server', version: '1.0.0', ip: localIP(), port: PORT }))
  app.use('/api/auth', require('./routes/auth'))
  app.use('/api/teachers', require('./routes/teachers'))
  app.use('/api/students', require('./routes/students'))
  app.use('/api/rooms', require('./routes/rooms'))
  app.use('/api/attendance', require('./routes/attendance'))
  app.use('/api/exams', require('./routes/exams'))
  app.use('/api/scores', require('./routes/scores'))
  app.use('/api/alerts', require('./routes/alerts'))
  app.use((err, _req, res, _next) => {
    console.error('API request failed:', err.message)
    res.status(500).json({ error: 'Server error' })
  })
  io.use((socket, next) => {
    const token = socket.handshake.auth?.token || (socket.handshake.headers.authorization || '').replace(/^Bearer\s+/i, '')
    if (!token) return next(new Error('Authentication required'))
    try { socket.user = jwt.verify(token, jwtSecret); next() } catch { next(new Error('Invalid or expired token')) }
  })
  require('./socket/events')(io)

  return new Promise((resolve, reject) => {
    const onError = (error) => { httpServer.removeListener('listening', onListening); reject(error) }
    const onListening = () => {
      httpServer.removeListener('error', onError)
      const info = { ip: localIP(), port: PORT, close: () => new Promise((done) => io.close(() => done())) }
      console.log(`\nNexClass HOD Server started\n  Local:   http://localhost:${PORT}\n  Network: http://${info.ip}:${PORT}\n`)
      resolve(info)
    }
    httpServer.once('error', onError)
    httpServer.once('listening', onListening)
    httpServer.listen(PORT, '0.0.0.0')
  })
}

module.exports = { startServer }
