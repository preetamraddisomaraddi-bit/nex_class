// Load local configuration before importing routes (Node.js 22+).
const fs = require('fs');
if (fs.existsSync(require('path').join(__dirname, '.env'))) {
  process.loadEnvFile(require('path').join(__dirname, '.env'));
}

const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { requestLogger, logger } = require('./logging');
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
app.disable('x-powered-by');
app.use(helmet({ contentSecurityPolicy: false }));

const allowedOrigins = new Set([
  'http://localhost:5173', 'http://localhost:5174',
  'http://localhost:5175', 'http://localhost:5176',
  ...(process.env.ALLOWED_ORIGINS || '').split(',').map(value => value.trim()).filter(Boolean)
]);
const originAllowed = (origin, callback) => callback(null, !origin || origin === 'null' || allowedOrigins.has(origin));

// ── Socket.IO ────────────────────────────────────────────
const io = new Server(server, {
  maxHttpBufferSize: 10 * 1024 * 1024,
  cors: { origin: originAllowed, methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE'] }
});
app.set('io', io);

// ── Middleware ───────────────────────────────────────────
app.use(cors({ origin: originAllowed, methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'], allowedHeaders: ['Content-Type', 'Authorization'] }));
app.use(requestLogger);
app.use(rateLimit({ windowMs: 5 * 60 * 1000, limit: 300, standardHeaders: true, legacyHeaders: false }));
const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 10, standardHeaders: true, legacyHeaders: false });
for (const route of ['/api/auth/teacher/register', '/api/auth/teacher/login', '/api/auth/student/register', '/api/auth/student/login', '/api/universities/register', '/api/universities/login']) {
  app.use(route, authLimiter);
}
app.use((req, res, next) => {
  const route = req.path;
  const limit = req.method === 'POST' && route === '/api/pdfs/push'
    ? '20mb'
    : req.method === 'POST' && (route === '/api/exam/submit' || route === '/api/code/submit')
      ? '1mb'
      : '100kb';
  express.json({ limit })(req, res, next);
});
app.use(express.urlencoded({ extended: true, limit: '100kb' }));

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
    (console.error('[API] Request failed:', err), res.status(500).json({ error: 'Something went wrong' }));
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

app.use((err, req, res, next) => {
  logger.error({ message: err?.message, stack: err?.stack, code: err?.code }, 'Request failed');
  if (res.headersSent) return next(err);
  if (err?.type === 'entity.too.large') return res.status(413).json({ error: 'Payload too large' });
  return res.status(500).json({ error: 'Something went wrong' });
});

// ── Socket events ────────────────────────────────────────
registerSocketEvents(io);

// ── Start ────────────────────────────────────────────────
const { PORT } = require('./config');

server.listen(PORT, '0.0.0.0', () => {
  // Show LAN IP so students know where to connect
  let interfaces = {};
  try { interfaces = os.networkInterfaces(); }
  catch (err) { console.warn('[Server] LAN address unavailable:', err.message); }
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
