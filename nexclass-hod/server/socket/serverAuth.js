const jwt = require('jsonwebtoken')
const { JWT_SECRET } = require('../config')
const { dbGet } = require('../db/database')

module.exports = io => io.use((socket, next) => {
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
  } catch { return next(new Error('Authentication failed')) }
})
