const http = require('http')
const os = require('os')
const jwt = require('jsonwebtoken')
const { Server } = require('socket.io')
const { PORT, JWT_SECRET } = require('./config')
const { dbGet } = require('./db/database')
const { createApp } = require('./app')

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
  const app = createApp()
  const httpServer = http.createServer(app)
  const io = new Server(httpServer, { cors: { origin: '*', methods: ['GET', 'POST', 'PATCH', 'DELETE'] } })
  io.use((socket, next) => {
    const token = socket.handshake.auth?.token
    if (!token) return next(new Error('Authentication failed'))
    try {
      const user = jwt.verify(token, JWT_SECRET)
      if (!user || !Number.isInteger(Number(user.id)) || !user.role) return next(new Error('Authentication failed'))
      if (user.role === 'hod') {
        const hod = dbGet('SELECT auth_version FROM hod WHERE id=?', [Number(user.id)])
        if (!hod || Number(user.auth_version) !== Number(hod.auth_version)) return next(new Error('Authentication failed'))
      }
      socket.data.user = { ...user, id: Number(user.id) }
      return next()
    } catch {
      return next(new Error('Authentication failed'))
    }
  })
  require('./socket/events')(io)

  return new Promise((resolve, reject) => {
    const onError = (error) => { httpServer.removeListener('listening', onListening); reject(error) }
    const onListening = () => {
      httpServer.removeListener('error', onError)
      const port = httpServer.address().port
      const info = { ip: localIP(), port, close: () => new Promise((done) => io.close(() => done())) }
      console.log(`\nNexClass HOD Server started\n  Local:   http://localhost:${port}\n  Network: http://${info.ip}:${port}\n`)
      resolve(info)
    }
    httpServer.once('error', onError)
    httpServer.once('listening', onListening)
    httpServer.listen(PORT, '0.0.0.0')
  })
}

module.exports = { startServer, PORT }
