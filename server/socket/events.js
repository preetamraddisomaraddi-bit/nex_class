const { dbGet, dbAll, dbRun } = require('../db/database');
const jwt = require('jsonwebtoken');
const { JWT_SECRET } = require('../config');

const roomMembers = {};
const socketUsers = {};
const activeRoomsScreenShares = {}; // maps roomCode -> teacherSocketId
const activeRoomPresentations = {}; // maps roomCode -> { currentSlide: X, totalSlides: Y }

function registerSocketEvents(io) {
  io.on('connection', (socket) => {
    console.log(`[Socket] Connected: ${socket.id}`);

    // Join Room
    socket.on('room:join', async ({ room_code, user }) => {
      let identity;
      try {
        const token = socket.handshake.auth?.token;
        if (!token) throw new Error('missing token');
        identity = jwt.verify(token, JWT_SECRET);
      } catch {
        socket.emit('room:error', { error: 'Sign in is required to join a classroom.' });
        return;
      }
      if (!room_code || !user || Number(identity.id) !== Number(user.id) || identity.role !== user.role || !['teacher', 'student'].includes(identity.role)) {
        socket.emit('room:error', { error: 'Your account cannot join this classroom.' });
        return;
      }
      user = { ...user, id: identity.id, role: identity.role };
      const code = room_code.toUpperCase();
      try {
        const room = await dbGet('SELECT * FROM rooms WHERE code = ? AND status = \'active\'', [code]);
        if (!room) { socket.emit('room:error', { error: 'Classroom is unavailable.' }); return; }
        if (identity.role === 'teacher' && Number(room.teacher_id) !== Number(identity.id)) {
          socket.emit('room:error', { error: 'Only the classroom teacher can join as teacher.' }); return;
        }
        if (identity.role === 'student') {
          const student = await dbGet('SELECT university_id, department_id, semester_id FROM students WHERE id = ?', [identity.id]);
          if (!student || (room.university_id && student.university_id && room.university_id !== student.university_id) ||
              (room.department_id && student.department_id && room.department_id !== student.department_id) ||
              (room.semester_id && student.semester_id && room.semester_id !== student.semester_id)) {
            socket.emit('room:error', { error: 'This classroom is not assigned to your enrollment.' }); return;
          }
        }
      } catch {
        socket.emit('room:error', { error: 'Could not verify classroom access.' }); return;
      }
      socket.join(code);
      if (!roomMembers[code]) roomMembers[code] = new Set();
      roomMembers[code].add(socket.id);
      socketUsers[socket.id] = { ...user, room_code: code };

      if (user.role === 'student') {
        dbGet('SELECT id FROM rooms WHERE code = ?', [code]).then(room => {
          if (room) dbRun('INSERT OR IGNORE INTO attendance (student_id, room_id, status) VALUES (?, ?, ?)', [user.id, room.id, 'present']);
        }).catch(() => {});

        // If screen share is active, notify student
        if (activeRoomsScreenShares[code]) {
          socket.emit('screen:started', { from: activeRoomsScreenShares[code] });
        }

        // If slide sharing is active, notify student
        if (activeRoomPresentations[code]) {
          socket.emit('slides:started', {
            total_slides: activeRoomPresentations[code].totalSlides,
            current_slide: activeRoomPresentations[code].currentSlide
          });
        }
      }

      io.to(code).emit('room:user_joined', { user, socketId: socket.id, members: roomMembers[code].size });
      socket.emit('room:joined', { room_code: code, member_count: roomMembers[code].size });
    });

    // Leave Room
    socket.on('room:leave', ({ room_code }) => {
      const code = room_code.toUpperCase();
      socket.leave(code);
      if (roomMembers[code]) roomMembers[code].delete(socket.id);
      const user = socketUsers[socket.id];
      if (user) io.to(code).emit('room:user_left', { user, socketId: socket.id, members: roomMembers[code]?.size || 0 });
      delete socketUsers[socket.id];
    });

    // Board
    socket.on('board:draw', ({ room_code, drawData }) => {
      socket.to(room_code.toUpperCase()).emit('board:draw', { drawData });
    });
    socket.on('board:clear', ({ room_code }) => {
      socket.to(room_code.toUpperCase()).emit('board:clear');
    });

    // Notes
    socket.on('note:push', ({ room_code, note }) => {
      dbGet('SELECT id FROM rooms WHERE code = ?', [room_code.toUpperCase()]).then(room => {
        if (room) {
          dbRun('INSERT INTO notes (room_id, title, content) VALUES (?, ?, ?)', [room.id, note.title || 'Class Note', note.content])
            .then(result => dbGet('SELECT * FROM notes WHERE id = ?', [result.lastID]))
            .then(saved => io.to(room_code.toUpperCase()).emit('note:received', { note: saved }))
            .catch(() => {});
        }
      }).catch(() => {});
    });

    // Code
    socket.on('code:broadcast', ({ room_code, code, language }) => {
      socket.to(room_code.toUpperCase()).emit('code:broadcast', { code, language });
    });
    // Exam launch and grading now go through authenticated HTTP routes.
    // Screen share (WebRTC signaling)
    socket.on('screen:start', ({ room_code }) => {
      const code = room_code.toUpperCase();
      activeRoomsScreenShares[code] = socket.id;
      socket.to(code).emit('screen:started', { from: socket.id });
    });
    socket.on('screen:request', ({ room_code, to }) => {
      io.to(to).emit('screen:request', { from: socket.id });
    });
    socket.on('screen:offer', ({ room_code, offer, to }) => {
      io.to(to).emit('screen:offer', { offer, from: socket.id });
    });
    socket.on('screen:answer', ({ room_code, answer, to }) => {
      io.to(to).emit('screen:answer', { answer, from: socket.id });
    });
    socket.on('screen:ice-candidate', ({ room_code, candidate, to }) => {
      io.to(to).emit('screen:ice-candidate', { candidate, from: socket.id });
    });
    socket.on('screen:stop', ({ room_code }) => {
      const code = room_code.toUpperCase();
      delete activeRoomsScreenShares[code];
      socket.to(code).emit('screen:stopped');
    });

    // PDF Push
    socket.on('pdf:push', async ({ room_code, room_id, filename, filedata }) => {
      try {
        const code = room_code.toUpperCase();
        const fileBuffer = Buffer.isBuffer(filedata) ? filedata : Buffer.from(filedata, 'base64');
        const filesize = fileBuffer.length;

        // Save PDF to database
        const result = await dbRun(
          'INSERT INTO pdfs (room_id, filename, filedata, filesize) VALUES (?, ?, ?, ?)',
          [room_id, filename, fileBuffer, filesize]
        );
        const pdfId = result.lastID;

        // Fetch present student IDs
        const presentStudents = await dbAll(
          'SELECT student_id FROM attendance WHERE room_id = ? AND status = "present"',
          [room_id]
        );
        for (const student of presentStudents) {
          await dbRun(
            'INSERT OR IGNORE INTO student_pdfs (student_id, pdf_id) VALUES (?, ?)',
            [student.student_id, pdfId]
          );
        }

        // Broadcast to all students in room
        io.to(code).emit('pdf:receive', {
          id: pdfId,
          filename,
          room_id,
          pushed_at: new Date().toISOString()
        });
      } catch (err) {
        console.error('[Socket] PDF push error:', err);
      }
    });

    // Slide Presentation
    socket.on('slides:start', ({ room_code, total_slides }) => {
      const code = room_code.toUpperCase();
      activeRoomPresentations[code] = { currentSlide: 0, totalSlides: total_slides };
      socket.to(code).emit('slides:started', { total_slides, current_slide: 0 });
    });

    socket.on('slides:page', ({ room_code, page_index, image }) => {
      const code = room_code.toUpperCase();
      if (activeRoomPresentations[code]) {
        activeRoomPresentations[code].currentSlide = page_index;
      }
      socket.to(code).emit('slides:page', { page_index, image });
    });

    socket.on('slides:end', ({ room_code }) => {
      const code = room_code.toUpperCase();
      delete activeRoomPresentations[code];
      socket.to(code).emit('slides:ended');
    });

    // Distraction Filter & Focus Status
    socket.on('student:force-close', ({ room_code, student_name }) => {
      const code = room_code.toUpperCase();
      console.log(`[Socket] Force-close alert: ${student_name} in ${code}`);
      socket.to(code).emit('student:force-close-alert', {
        student_name,
        timestamp: new Date().toISOString()
      });
    });

    socket.on('student:status', ({ room_code, student_id, is_focused }) => {
      const code = room_code.toUpperCase();
      socket.to(code).emit('student:status-update', {
        student_id,
        socket_id: socket.id,
        is_focused,
        last_seen: Date.now()
      });
    });

    socket.on('session:end', ({ room_code }) => {
      const code = room_code.toUpperCase();
      io.to(code).emit('session:ended');
    });

    // Chat
    socket.on('chat:message', ({ room_code, user, message }) => {
      io.to(room_code.toUpperCase()).emit('chat:message', { user, message, timestamp: new Date().toISOString() });
    });

    // Raise Hand
    socket.on('hand:raise', ({ room_code, student }) => {
      socket.to(room_code.toUpperCase()).emit('hand:raised', { student });
    });
    socket.on('hand:lower', ({ room_code, student }) => {
      socket.to(room_code.toUpperCase()).emit('hand:lowered', { student });
    });

    socket.on('disconnect', () => {
      const user = socketUsers[socket.id];
      if (user) {
        const code = user.room_code;
        if (activeRoomsScreenShares[code] === socket.id) {
          delete activeRoomsScreenShares[code];
          socket.to(code).emit('screen:stopped');
        }
        if (roomMembers[code]) {
          roomMembers[code].delete(socket.id);
          io.to(code).emit('room:user_left', { user, socketId: socket.id, members: roomMembers[code].size });
        }
        delete socketUsers[socket.id];
      }
    });
  });
}

module.exports = { registerSocketEvents };
