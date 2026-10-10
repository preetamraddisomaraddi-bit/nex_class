const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const path = require('path');
const os = require('os');

const { registerSocketEvents } = require('./socket/events');
const authRoutes = require('./routes/auth');
const roomRoutes = require('./routes/rooms');
const attendanceRoutes = require('./routes/attendance');
const notesRoutes = require('./routes/notes');
const examRoutes = require('./routes/exam');
const codeRoutes = require('./routes/code');
const aiRoutes = require('./routes/ai');
const badgesRoutes = require('./routes/badges');
const pdfsRoutes = require('./routes/pdfs');
const universitiesRouter = require('./routes/universities');
const departmentsRouter = require('./routes/departments');
const semestersRouter = require('./routes/semesters');
const { verifyAdmin } = require('./middleware/auth');

const app = express();
const server = http.createServer(app);

// ── Socket.IO ────────────────────────────────────────────
const io = new Server(server, {
  cors: { origin: '*', methods: ['GET', 'POST', 'PATCH'] }
});

// ── Middleware ───────────────────────────────────────────
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// ── Static Registration Site ─────────────────────────────
app.use('/register', express.static(path.join(__dirname, '../registration-site/dist')));

// ── Routes ───────────────────────────────────────────────
app.use('/api/auth', authRoutes);
app.use('/api/rooms', roomRoutes);
app.use('/api/attendance', attendanceRoutes);
app.use('/api/notes', notesRoutes);
app.use('/api/exam', examRoutes);
app.use('/api/code', codeRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/badges', badgesRoutes);
app.use('/api/pdfs', pdfsRoutes);
app.use('/api/universities', universitiesRouter);
app.use('/api/departments', departmentsRouter);
app.use('/api/semesters', semestersRouter);

app.delete('/api/teachers/:id', verifyAdmin, async (req, res) => {
  try {
    const { dbRun } = require('./db/database');
    await dbRun("DELETE FROM teachers WHERE id = ?", [req.params.id]);
    res.json({ success: true, message: 'Teacher removed successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Fallback path for client-side routing on the registration site
app.get('/register/*', (req, res) => {
  res.sendFile(path.join(__dirname, '../registration-site/dist/index.html'));
});

// ── Health check ─────────────────────────────────────────
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'NexClass server is running', timestamp: new Date().toISOString() });
});

// ── Socket events ────────────────────────────────────────
registerSocketEvents(io);

// ── Start ────────────────────────────────────────────────
const PORT = process.env.PORT || 4000;

server.listen(PORT, '0.0.0.0', () => {
  // Show LAN IP so students know where to connect
  const interfaces = os.networkInterfaces();
  let lanIP = 'localhost';
  Object.values(interfaces).forEach(iface => {
    iface.forEach(addr => {
      if (addr.family === 'IPv4' && !addr.internal) lanIP = addr.address;
    });
  });

  console.log('\n╔═══════════════════════════════════════╗');
  console.log('║       NexClass Server Started         ║');
  console.log('╠═══════════════════════════════════════╣');
  console.log(`║  Local:   http://localhost:${PORT}        ║`);
  console.log(`║  Network: http://${lanIP}:${PORT}   ║`);
  console.log('║                                       ║');
  console.log('║  Students connect using LAN IP above  ║');
  console.log('╚═══════════════════════════════════════╝\n');
});

module.exports = { app, server };
