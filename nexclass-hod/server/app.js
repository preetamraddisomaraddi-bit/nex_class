const express = require('express')
const cors = require('cors')
const os = require('os')
const { PORT } = require('./config')

function localIP() {
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

function createApp() {
  const app = express()
  app.use(cors({ origin: '*', methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'], allowedHeaders: ['Content-Type', 'Authorization'] }))
  app.use(express.json({ limit: '2mb' }))
  app.use(express.urlencoded({ extended: true, limit: '2mb' }))

  app.get('/health', (_req, res) => res.json({ status: 'ok', server: 'NexClass HOD Server', version: '1.0.0', timestamp: new Date().toISOString() }))
  app.get('/discover', (_req, res) => res.json({ type: 'nexclass-hod-server', version: '1.0.0', ip: localIP(), port: PORT }))
  app.use('/api/setup', require('./routes/setup'))
  app.use('/api/auth', require('./routes/auth'))
  app.use('/api/teachers', require('./routes/teachers'))
  app.use('/api/students', require('./routes/students'))
  app.use('/api/rooms', require('./routes/rooms'))
  app.use('/api/attendance', require('./routes/attendance'))
  app.use('/api/exams', require('./routes/exams'))
  app.use('/api/scores', require('./routes/scores'))
  app.use('/api/alerts', require('./routes/alerts'))

  app.use((err, _req, res, _next) => {
    console.error('API request failed:', err)
    res.status(500).json({ error: 'Something went wrong' })
  })
  app.use((_req, res) => res.status(404).json({ error: 'Not found' }))
  return app
}

module.exports = { createApp }
