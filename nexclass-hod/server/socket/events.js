const { dbGet, dbRun } = require('../db/database')

module.exports = function registerEvents(io) {
  const onlineTeachers = new Map()
  const onlineStudents = new Map()
  const activeRooms = new Map()

  io.on('connection', (socket) => {
    const identity = socket.user
    if (identity.role === 'hod') {
      socket.join('hod')
      socket.emit('hod:active-rooms', Array.from(activeRooms.values()).map((room) => ({ ...room, students: [...room.students] })))
      socket.emit('hod:online-teachers', Array.from(onlineTeachers.values()))
    }

    socket.on('teacher:connect', (data = {}) => {
      if (identity.role !== 'teacher') return
      const teacher = dbGet("SELECT id,name,subject,semester,status FROM teachers WHERE id=?", [identity.id])
      if (!teacher || teacher.status !== 'approved') return socket.emit('server:error', { error: 'Approved teacher account required' })
      onlineTeachers.set(socket.id, { ...teacher, socket_id: socket.id })
      socket.join('teachers')
      io.to('hod').emit('teacher:online', teacher)
    })

    socket.on('session:created', (data = {}) => {
      if (identity.role !== 'teacher') return
      const code = String(data.room_code || '').toUpperCase()
      const room = dbGet("SELECT * FROM rooms WHERE code=? AND teacher_id=? AND status='active'", [code, identity.id])
      if (!room) return socket.emit('server:error', { error: 'Active room not found' })
      const payload = { room_code: code, subject: room.subject, teacher_id: identity.id, semester: room.semester, started_at: room.created_at }
      activeRooms.set(code, { ...payload, students: new Set() })
      socket.join(`room:${code}`)
      io.to('hod').emit('session:started', payload)
    })

    socket.on('session:ended', (data = {}) => {
      if (identity.role !== 'teacher' && identity.role !== 'hod') return
      const code = String(data.room_code || '').toUpperCase()
      const room = dbGet('SELECT * FROM rooms WHERE code=?', [code])
      if (!room || (identity.role === 'teacher' && room.teacher_id !== identity.id)) return
      dbRun("UPDATE rooms SET status='completed',ended_at=CURRENT_TIMESTAMP WHERE id=?", [room.id])
      activeRooms.delete(code)
      io.to(`room:${code}`).emit('session:ended', { room_code: code })
      io.to('hod').emit('session:ended', { room_code: code })
    })

    socket.on('student:join', (data = {}) => {
      if (identity.role !== 'student') return
      const code = String(data.room_code || '').toUpperCase()
      const room = dbGet("SELECT * FROM rooms WHERE code=? AND status='active'", [code])
      const student = dbGet('SELECT id,name,usn,semester FROM students WHERE id=?', [identity.id])
      if (!room || !student || student.semester !== room.semester) return socket.emit('server:error', { error: 'Room not found or student is not in this semester' })
      socket.join(`room:${code}`)
      socket.join('students')
      onlineStudents.set(socket.id, { ...student, room_code: code, socket_id: socket.id })
      const live = activeRooms.get(code)
      if (live) live.students.add(student.id)
      dbRun(`INSERT INTO attendance(student_id,room_id,status) VALUES(?,?,'present')
        ON CONFLICT(student_id,room_id) DO UPDATE SET status='present'`, [student.id, room.id])
      const payload = { student_id: student.id, name: student.name, usn: student.usn, room_code: code, semester: student.semester }
      io.to(`room:${code}`).emit('student:joined', payload)
      io.to('hod').emit('student:joined', payload)
    })

    socket.on('note:pushed', (data = {}) => {
      if (identity.role !== 'teacher') return
      const code = String(data.room_code || '').toUpperCase()
      const room = dbGet("SELECT * FROM rooms WHERE code=? AND teacher_id=? AND status='active'", [code, identity.id])
      if (!room || typeof data.content !== 'string' || !data.content.trim()) return
      const result = dbRun('INSERT INTO notes(room_id,content) VALUES(?,?)', [room.id, data.content.trim().slice(0, 20000)])
      const payload = { id: result.lastInsertRowid, room_code: code, content: data.content.trim().slice(0, 20000), teacher_id: identity.id, pushed_at: new Date().toISOString() }
      io.to(`room:${code}`).emit('note:received', payload)
      io.to('hod').emit('note:pushed', payload)
    })

    socket.on('code:broadcast', (data = {}) => {
      if (identity.role !== 'teacher') return
      const code = String(data.room_code || '').toUpperCase()
      if (!dbGet("SELECT id FROM rooms WHERE code=? AND teacher_id=? AND status='active'", [code, identity.id])) return
      io.to(`room:${code}`).emit('code:received', { ...data, room_code: code, teacher_id: identity.id })
    })

    socket.on('exam:launched', (data = {}) => {
      if (identity.role !== 'teacher') return
      const code = String(data.room_code || '').toUpperCase()
      const room = dbGet("SELECT id FROM rooms WHERE code=? AND teacher_id=? AND status='active'", [code, identity.id])
      if (!room) return
      const examId = Number(data.exam_id)
      if (!Number.isInteger(examId) || !dbGet('SELECT id FROM exams WHERE id=? AND room_id=?', [examId, room.id])) return
      const payload = { ...data, room_code: code, exam_id: examId, teacher_id: identity.id }
      io.to(`room:${code}`).emit('exam:started', payload)
      io.to('hod').emit('exam:launched', payload)
    })

    socket.on('board:draw', (data = {}) => {
      if (identity.role !== 'teacher') return
      const code = String(data.room_code || '').toUpperCase()
      if (dbGet("SELECT id FROM rooms WHERE code=? AND teacher_id=? AND status='active'", [code, identity.id])) socket.to(`room:${code}`).emit('board:draw', data)
    })
    socket.on('board:clear', (data = {}) => {
      if (identity.role !== 'teacher') return
      const code = String(data.room_code || '').toUpperCase()
      if (dbGet("SELECT id FROM rooms WHERE code=? AND teacher_id=? AND status='active'", [code, identity.id])) io.to(`room:${code}`).emit('board:clear')
    })

    socket.on('exam:submitted', (data = {}) => {
      if (identity.role !== 'student') return
      const code = String(data.room_code || '').toUpperCase()
      const exam = dbGet('SELECT e.id FROM exams e JOIN rooms r ON r.id=e.room_id WHERE e.id=? AND r.code=? AND r.status=\'active\'', [Number(data.exam_id), code])
      if (!exam) return
      const payload = { ...data, student_id: identity.id, room_code: code, exam_id: exam.id }
      io.to(`room:${code}`).emit('exam:submission', payload)
      io.to('hod').emit('exam:submitted', payload)
    })
    socket.on('code:submitted', (data = {}) => {
      if (identity.role !== 'student') return
      const code = String(data.room_code || '').toUpperCase()
      const room = dbGet("SELECT id FROM rooms WHERE code=? AND status='active' AND semester=(SELECT semester FROM students WHERE id=?)", [code, identity.id])
      if (!room) return
      const payload = { ...data, student_id: identity.id, room_code: code }
      dbRun('INSERT INTO code_submissions(student_id,room_id,code,language,output) VALUES(?,?,?,?,?)', [identity.id, room.id, String(data.code || '').slice(0, 50000), String(data.language || '').slice(0, 50), String(data.output || '').slice(0, 50000)])
      io.to(`room:${code}`).emit('code:submission', payload)
      io.to('hod').emit('code:submitted', payload)
    })
    socket.on('student:heartbeat', (data = {}) => {
      if (identity.role !== 'student') return
      io.to('hod').emit('student:status', { ...data, student_id: identity.id, socket_id: socket.id })
    })
    socket.on('student:force-close', () => {
      if (identity.role !== 'student') return
      const student = dbGet('SELECT id,name,usn FROM students WHERE id=?', [identity.id])
      io.to('hod').emit('student:force-close', { student_id: identity.id, name: student?.name, usn: student?.usn })
    })

    socket.on('hod:alert', (data = {}) => {
      if (identity.role !== 'hod') return
      const teacherId = Number(data.teacher_id)
      const message = String(data.message || '').trim().slice(0, 2000)
      if (!teacherId || !message) return
      const type = ['reminder', 'warning', 'urgent'].includes(data.type) ? data.type : 'reminder'
      // Alert rows are persisted by the authenticated REST endpoint. The
      // socket event only delivers the already-saved alert in real time.
      for (const [sid, teacher] of onlineTeachers) if (teacher.id === teacherId) io.to(sid).emit('hod:alert', { message, type, from: 'HOD', sent_at: new Date().toISOString() })
    })
    socket.on('hod:teacher-approved', (data = {}) => {
      if (identity.role !== 'hod') return
      const teacherId = Number(data.teacher_id)
      if (!dbGet("SELECT id FROM teachers WHERE id=? AND status='approved'", [teacherId])) return
      for (const [sid, teacher] of onlineTeachers) if (teacher.id === teacherId) io.to(sid).emit('account:approved', { message: 'Your account has been approved by the HOD.' })
    })

    socket.on('disconnect', () => {
      const teacher = onlineTeachers.get(socket.id)
      if (teacher) { onlineTeachers.delete(socket.id); io.to('hod').emit('teacher:offline', { teacher_id: teacher.id, name: teacher.name }) }
      const student = onlineStudents.get(socket.id)
      if (student) {
        onlineStudents.delete(socket.id)
        const room = activeRooms.get(student.room_code)
        if (room) room.students.delete(student.id)
        io.to('hod').emit('student:offline', { student_id: student.id, name: student.name, room_code: student.room_code })
      }
    })
  })
}
