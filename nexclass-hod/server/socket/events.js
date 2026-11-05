const { dbGet, dbAll, dbRun } = require('../db/database')
const { logger } = require('../logging')

function byteLength(value) {
  try { return Buffer.byteLength(typeof value === 'string' ? value : JSON.stringify(value ?? null), 'utf8') }
  catch { return Infinity }
}

module.exports = function registerEvents(io) {
  const onlineTeachers = new Map()
  const onlineStudents = new Map()
  const activeRooms = new Map()
  const roomMembers = new Map()
  const joinedRooms = new Map()
  const screenShares = new Map()
  const presentations = new Map()

  const roomForTeacher = (code, teacherId) => dbGet("SELECT * FROM rooms WHERE code=? AND teacher_id=? AND status='active'", [code, teacherId])
  const emitError = (socket, message) => socket.emit('server:error', { error: message })

  io.on('connection', socket => {
    const identity = socket.data.user
    console.log(`[Socket] Connected: ${socket.id} (${identity.role})`)
    const buckets = { board: { tokens: 60, updatedAt: Date.now() }, other: { tokens: 10, updatedAt: Date.now() } }
    const originalOn = socket.on.bind(socket)
    socket.on = (event, listener) => originalOn(event, (...args) => {
      if (event === 'disconnect' || event === 'error') return listener(...args)
      const bucket = event === 'board:draw' ? buckets.board : buckets.other
      const limit = event === 'board:draw' ? 60 : 10
      const now = Date.now()
      bucket.tokens = Math.min(limit, bucket.tokens + ((now - bucket.updatedAt) * limit / 1000))
      bucket.updatedAt = now
      if (bucket.tokens < 1) {
        logger.warn({ socket_id: socket.id, event }, 'Socket rate limit exceeded; event dropped')
        return
      }
      bucket.tokens -= 1
      listener(...args)
    })

    socket.on('hod:connect', () => {
      if (identity.role !== 'hod') return
      socket.join('hod')
      socket.emit('hod:active-rooms', Array.from(activeRooms.values()).map(room => ({ ...room, students: [...room.students] })))
      socket.emit('hod:online-teachers', Array.from(onlineTeachers.values()))
    })

    socket.on('teacher:connect', () => {
      if (identity.role !== 'teacher') return
      const teacher = dbGet("SELECT id,name,subject,semester,status FROM teachers WHERE id=?", [identity.id])
      if (!teacher || teacher.status !== 'approved') return emitError(socket, 'Approved teacher account required')
      onlineTeachers.set(socket.id, { ...teacher, socket_id: socket.id })
      socket.join('teachers')
      io.to('hod').emit('teacher:online', teacher)
    })

    const joinRoom = async ({ room_code } = {}) => {
      const code = String(room_code || '').trim().toUpperCase()
      if (!code) return emitError(socket, 'Room code is required')
      const room = dbGet("SELECT * FROM rooms WHERE code=? AND status='active'", [code])
      if (!room) return emitError(socket, 'Room not found or session ended')

      let user
      if (identity.role === 'teacher') {
        if (Number(room.teacher_id) !== identity.id) return emitError(socket, 'Only the classroom teacher can join as teacher')
        user = dbGet("SELECT id,name,subject,semester,status FROM teachers WHERE id=?", [identity.id])
        if (!user || user.status !== 'approved') return emitError(socket, 'Approved teacher account required')
      } else if (identity.role === 'student') {
        const student = dbGet('SELECT id,name,usn,semester FROM students WHERE id=?', [identity.id])
        if (!student || Number(student.semester) !== Number(room.semester)) return emitError(socket, 'This classroom is not assigned to your enrollment')
        user = student
        dbRun(`INSERT INTO attendance(student_id,room_id,status) VALUES(?,?,'present')
          ON CONFLICT(student_id,room_id) DO UPDATE SET status='present'`, [identity.id, room.id])
      } else {
        return emitError(socket, 'Your account cannot join this classroom')
      }

      socket.join(`room:${code}`)
      joinedRooms.set(socket.id, { code, role: identity.role, id: identity.id })
      if (!roomMembers.has(code)) roomMembers.set(code, new Set())
      roomMembers.get(code).add(socket.id)
      if (identity.role === 'student') {
        onlineStudents.set(socket.id, { ...user, room_code: code, socket_id: socket.id })
        const active = activeRooms.get(code)
        if (active) active.students.add(identity.id)
      }
      const payload = { ...user, id: identity.id, role: identity.role, room_code: code, socket_id: socket.id }
      const memberCount = roomMembers.get(code).size
      io.to(`room:${code}`).emit('room:user_joined', { user: payload, socketId: socket.id, members: memberCount })
      io.to(`room:${code}`).emit('student:joined', identity.role === 'student'
        ? { student_id: identity.id, name: user.name, usn: user.usn, room_code: code, semester: user.semester }
        : { teacher_id: identity.id, name: user.name, room_code: code })
      if (identity.role === 'student') io.to('hod').emit('student:joined', { student_id: identity.id, name: user.name, usn: user.usn, room_code: code, semester: user.semester })
      socket.emit('room:joined', { room_code: code, user: payload })
    }

    // Keep both event names during migration; identity always comes from the JWT.
    socket.on('room:join', joinRoom)
    socket.on('student:join', joinRoom)

    socket.on('room:leave', ({ room_code } = {}) => {
      const joined = joinedRooms.get(socket.id)
      const code = String(room_code || joined?.code || '').toUpperCase()
      if (!joined || joined.code !== code) return
      socket.leave(`room:${code}`)
      joinedRooms.delete(socket.id)
      roomMembers.get(code)?.delete(socket.id)
      const student = onlineStudents.get(socket.id)
      if (student) {
        onlineStudents.delete(socket.id)
        activeRooms.get(code)?.students.delete(identity.id)
      }
      const user = identity.role === 'teacher'
        ? dbGet('SELECT id,name FROM teachers WHERE id=?', [identity.id])
        : dbGet('SELECT id,name,usn FROM students WHERE id=?', [identity.id])
      if (user) io.to(`room:${code}`).emit('room:user_left', { user: { ...user, role: identity.role }, socketId: socket.id, members: roomMembers.get(code)?.size || 0 })
      io.to('hod').emit('student:offline', { student_id: identity.id, name: student?.name, room_code: code })
    })

    socket.on('session:created', ({ room_code } = {}) => {
      if (identity.role !== 'teacher') return
      const code = String(room_code || '').toUpperCase()
      const room = roomForTeacher(code, identity.id)
      if (!room) return emitError(socket, 'Active room not found for this teacher')
      const payload = { room_code: code, subject: room.subject, teacher_id: identity.id, semester: room.semester, started_at: room.created_at }
      activeRooms.set(code, { ...payload, students: new Set() })
      joinedRooms.set(socket.id, { code, role: 'teacher', id: identity.id })
      socket.join(`room:${code}`)
      io.to('hod').emit('session:started', payload)
    })

    socket.on('session:ended', ({ room_code } = {}) => {
      if (identity.role !== 'teacher') return
      const code = String(room_code || '').toUpperCase()
      const room = dbGet('SELECT * FROM rooms WHERE code=? AND teacher_id=?', [code, identity.id])
      if (!room) return
      if (room.status === 'active') dbRun("UPDATE rooms SET status='completed',ended_at=CURRENT_TIMESTAMP WHERE id=?", [room.id])
      activeRooms.delete(code)
      io.to(`room:${code}`).emit('session:ended', { room_code: code })
      io.to('hod').emit('session:ended', { room_code: code })
    })

    socket.on('note:pushed', ({ room_code, content } = {}) => {
      if (identity.role !== 'teacher') return
      const code = String(room_code || '').toUpperCase()
      const room = roomForTeacher(code, identity.id)
      if (!room || typeof content !== 'string' || !content.trim()) return
      if (byteLength(content) > 5 * 1024) { logger.warn({ socket_id: socket.id, event: 'note:pushed' }, 'Oversized socket payload dropped'); return }
      const text = content.trim()
      const result = dbRun('INSERT INTO notes(room_id,content) VALUES(?,?)', [room.id, text])
      const payload = { id: result.lastInsertRowid, room_code: code, content: text, teacher_id: identity.id, pushed_at: new Date().toISOString() }
      io.to(`room:${code}`).emit('note:received', payload)
      io.to('hod').emit('note:pushed', payload)
    })

    socket.on('code:broadcast', (data = {}) => {
      if (identity.role !== 'teacher') return
      const code = String(data.room_code || '').toUpperCase()
      if (!roomForTeacher(code, identity.id)) return
      const codeText = String(data.code || '')
      if (byteLength(codeText) > 100 * 1024) { logger.warn({ socket_id: socket.id, event: 'code:broadcast' }, 'Oversized socket payload dropped'); return }
      socket.to(`room:${code}`).emit('code:received', { code: codeText, language: String(data.language || '').slice(0, 50), room_code: code, teacher_id: identity.id })
    })

    socket.on('exam:launched', (data = {}) => {
      if (identity.role !== 'teacher') return
      const code = String(data.room_code || '').toUpperCase()
      const room = roomForTeacher(code, identity.id)
      const examId = Number(data.exam_id)
      const exam = room && Number.isInteger(examId) ? dbGet('SELECT id,title FROM exams WHERE id=? AND room_id=?', [examId, room.id]) : null
      if (!exam) return
      const payload = { room_code: code, exam_id: exam.id, title: exam.title, teacher_id: identity.id }
      io.to(`room:${code}`).emit('exam:launched', payload)
      io.to('hod').emit('exam:launched', payload)
    })

    socket.on('exam:submitted', (data = {}) => {
      if (identity.role !== 'student') return
      const code = String(data.room_code || '').toUpperCase()
      const exam = dbGet(`SELECT e.id FROM exams e JOIN rooms r ON r.id=e.room_id
        WHERE e.id=? AND r.code=? AND r.status='active' AND r.semester=(SELECT semester FROM students WHERE id=?)`,
      [Number(data.exam_id), code, identity.id])
      if (!exam) return
      const payload = { room_code: code, exam_id: exam.id, student_id: identity.id }
      io.to(`room:${code}`).emit('exam:submission', payload)
      io.to('hod').emit('exam:submitted', payload)
    })

    socket.on('code:submitted', (data = {}) => {
      if (identity.role !== 'student') return
      const code = String(data.room_code || '').toUpperCase()
      const room = dbGet("SELECT * FROM rooms WHERE code=? AND status='active' AND semester=(SELECT semester FROM students WHERE id=?)", [code, identity.id])
      if (!room || typeof data.code !== 'string') return
      if (byteLength(data.code) > 100 * 1024 || byteLength(data.output || '') > 100 * 1024) { logger.warn({ socket_id: socket.id, event: 'code:submitted' }, 'Oversized socket payload dropped'); return }
      const codeText = data.code
      const language = String(data.language || '').slice(0, 50)
      const output = String(data.output || '').slice(0, 50000)
      const result = dbRun('INSERT INTO code_submissions(student_id,room_id,code,language,output) VALUES(?,?,?,?,?)', [identity.id, room.id, codeText, language, output])
      const payload = { id: result.lastInsertRowid, student_id: identity.id, room_code: code, code: codeText, language, output }
      io.to(`room:${code}`).emit('code:submission', payload)
      io.to('hod').emit('code:submitted', payload)
    })

    socket.on('student:heartbeat', (data = {}) => {
      if (identity.role !== 'student') return
      const joined = joinedRooms.get(socket.id)
      const code = String(data.room_code || joined?.code || '').toUpperCase()
      const room = dbGet("SELECT id FROM rooms WHERE code=? AND status='active' AND semester=(SELECT semester FROM students WHERE id=?)", [code, identity.id])
      const student = dbGet('SELECT name,usn FROM students WHERE id=?', [identity.id])
      if (!room || !student || !joined || joined.code !== code) return
      io.to('hod').emit('student:status', { student_id: identity.id, name: student.name, usn: student.usn, room_code: code, status: documentStatus(data.status), socket_id: socket.id, timestamp: Date.now() })
    })

    socket.on('student:force-close', ({ room_code } = {}) => {
      if (identity.role !== 'student') return
      const student = dbGet('SELECT name,usn FROM students WHERE id=?', [identity.id])
      if (student) io.to('hod').emit('student:force-close', { student_id: identity.id, name: student.name, usn: student.usn, room_code: String(room_code || '').toUpperCase() })
    })

    socket.on('hod:alert', (data = {}) => {
      if (identity.role !== 'hod') return
      const teacherId = Number(data.teacher_id)
      const message = String(data.message || '').trim().slice(0, 2000)
      if (!Number.isInteger(teacherId) || teacherId < 1 || !message) return
      const type = ['reminder', 'warning', 'urgent'].includes(data.type) ? data.type : 'reminder'
      for (const [sid, teacher] of onlineTeachers) if (teacher.id === teacherId) io.to(sid).emit('hod:alert', { message, type, from: 'HOD', sent_at: new Date().toISOString() })
    })

    socket.on('hod:teacher-approved', ({ teacher_id } = {}) => {
      if (identity.role !== 'hod') return
      const teacherId = Number(teacher_id)
      if (!dbGet("SELECT id FROM teachers WHERE id=? AND status='approved'", [teacherId])) return
      for (const [sid, teacher] of onlineTeachers) if (teacher.id === teacherId) io.to(sid).emit('account:approved', { message: 'Your account has been approved by the HOD.' })
    })

    // Only the owning teacher can start teacher tools for an active room.
    const withOwnedRoom = (data, callback) => {
      if (identity.role !== 'teacher') return
      const code = String(data?.room_code || '').toUpperCase()
      if (!roomForTeacher(code, identity.id)) return
      callback(code)
    }
    socket.on('board:draw', data => {
      if (byteLength(data?.drawData) > 100 * 1024) { logger.warn({ socket_id: socket.id, event: 'board:draw' }, 'Oversized socket payload dropped'); return }
      withOwnedRoom(data, code => socket.to(`room:${code}`).emit('board:draw', { drawData: data.drawData }))
    })
    socket.on('board:clear', data => withOwnedRoom(data, code => io.to(`room:${code}`).emit('board:clear')))
    socket.on('screen:start', data => withOwnedRoom(data, code => {
      screenShares.set(code, socket.id)
      socket.to(`room:${code}`).emit('screen:started', { from: socket.id })
    }))
    socket.on('screen:stop', data => withOwnedRoom(data, code => {
      screenShares.delete(code)
      socket.to(`room:${code}`).emit('screen:stopped')
    }))
    socket.on('slides:start', data => withOwnedRoom(data, code => {
      presentations.set(code, { currentSlide: 0, totalSlides: Number(data.total_slides) || 0 })
      socket.to(`room:${code}`).emit('slides:started', { total_slides: Number(data.total_slides) || 0, current_slide: 0 })
    }))
    socket.on('slides:page', data => withOwnedRoom(data, code => {
      const presentation = presentations.get(code)
      if (!presentation) return
      presentation.currentSlide = Number(data.page_index) || 0
      socket.to(`room:${code}`).emit('slides:page', { page_index: presentation.currentSlide, image: data.image })
    }))
    socket.on('slides:end', data => withOwnedRoom(data, code => {
      presentations.delete(code)
      socket.to(`room:${code}`).emit('slides:ended')
    }))

    socket.on('screen:request', ({ to } = {}) => {
      const joined = joinedRooms.get(socket.id)
      if (!joined || joined.role !== 'student') return
      const owner = screenShares.get(joined.code)
      if (owner) io.to(owner).emit('screen:request', { from: socket.id, to })
    })
    for (const event of ['screen:offer', 'screen:answer', 'screen:ice-candidate']) {
      socket.on(event, ({ to, offer, answer, candidate } = {}) => {
        const joined = joinedRooms.get(socket.id)
        if (!joined) return
        const owner = screenShares.get(joined.code)
        if (socket.id !== owner && to !== owner) return
        io.to(to || owner).emit(event, { ...(offer ? { offer } : {}), ...(answer ? { answer } : {}), ...(candidate ? { candidate } : {}), from: socket.id })
      })
    }

    socket.on('pdf:push', async ({ room_code, filename, filedata } = {}) => {
      if (identity.role !== 'teacher') return
      const code = String(room_code || '').toUpperCase()
      const room = roomForTeacher(code, identity.id)
      if (!room || typeof filedata !== 'string') return
      try {
        const fileBuffer = Buffer.from(filedata, 'base64')
        if (fileBuffer.length > 10 * 1024 * 1024) return emitError(socket, 'PDF exceeds the 10 MB limit')
        const result = dbRun('INSERT INTO pdfs(room_id,filename,filedata,filesize) VALUES(?,?,?,?)', [room.id, String(filename || 'document.pdf').slice(0, 240), fileBuffer, fileBuffer.length])
        const payload = { id: result.lastInsertRowid, filename: String(filename || 'document.pdf').slice(0, 240), room_id: room.id, pushed_at: new Date().toISOString() }
        io.to(`room:${code}`).emit('pdf:receive', payload)
      } catch (error) { console.error('[Socket] PDF push error:', error) }
    })

    socket.on('chat:message', ({ room_code, message } = {}) => {
      const joined = joinedRooms.get(socket.id)
      const code = String(room_code || '').toUpperCase()
      if (!joined || joined.code !== code || typeof message !== 'string' || !message.trim()) return
      const user = identity.role === 'teacher'
        ? dbGet('SELECT id,name FROM teachers WHERE id=?', [identity.id])
        : dbGet('SELECT id,name,usn FROM students WHERE id=?', [identity.id])
      if (user) io.to(`room:${code}`).emit('chat:message', { user: { ...user, role: identity.role }, message: message.trim().slice(0, 2000), timestamp: new Date().toISOString() })
    })

    socket.on('hand:raise', () => {
      if (identity.role !== 'student') return
      const joined = joinedRooms.get(socket.id)
      const student = dbGet('SELECT id,name,usn FROM students WHERE id=?', [identity.id])
      if (joined && student) socket.to(`room:${joined.code}`).emit('hand:raised', { student })
    })
    socket.on('hand:lower', () => {
      if (identity.role !== 'student') return
      const joined = joinedRooms.get(socket.id)
      const student = dbGet('SELECT id,name,usn FROM students WHERE id=?', [identity.id])
      if (joined && student) socket.to(`room:${joined.code}`).emit('hand:lowered', { student })
    })

    socket.on('disconnect', () => {
      const teacher = onlineTeachers.get(socket.id)
      if (teacher) {
        onlineTeachers.delete(socket.id)
        io.to('hod').emit('teacher:offline', { teacher_id: teacher.id, name: teacher.name })
      }
      const student = onlineStudents.get(socket.id)
      const joined = joinedRooms.get(socket.id)
      if (joined) {
        roomMembers.get(joined.code)?.delete(socket.id)
        const user = identity.role === 'teacher'
          ? dbGet('SELECT id,name FROM teachers WHERE id=?', [identity.id])
          : dbGet('SELECT id,name,usn FROM students WHERE id=?', [identity.id])
        if (user) io.to(`room:${joined.code}`).emit('room:user_left', { user: { ...user, role: identity.role }, socketId: socket.id, members: roomMembers.get(joined.code)?.size || 0 })
      }
      if (student) {
        onlineStudents.delete(socket.id)
        activeRooms.get(student.room_code)?.students.delete(identity.id)
        io.to('hod').emit('student:offline', { student_id: identity.id, name: student.name, room_code: student.room_code })
      }
      if (joined && screenShares.get(joined.code) === socket.id) {
        screenShares.delete(joined.code)
        socket.to(`room:${joined.code}`).emit('screen:stopped')
      }
      joinedRooms.delete(socket.id)
    })
  })
}

function documentStatus(value) {
  return value === 'focused' || value === 'unfocused' ? value : 'active'
}
