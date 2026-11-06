const express = require('express');
const router = express.Router();
const { dbGet, dbAll, dbRun } = require('../db/database');
const { verifyTeacher, verifyStudent, verifyTeacherOrStudent } = require('../middleware/auth');
const runner = require('../code/runnerService');
const { z } = require('zod');
const { logger } = require('../logging');
const runSchema = z.object({ language: z.enum(['python', 'javascript', 'java', 'c', 'cpp']), source: z.string().min(1).refine(s => Buffer.byteLength(s) <= 50 * 1024, 'Must be 50 KB or less'), stdin: z.string().optional().default('').refine(s => Buffer.byteLength(s) <= 10 * 1024, 'Must be 10 KB or less') }).strict();

router.get('/status', verifyTeacherOrStudent, (_req, res) => res.json(runner.status()));
router.post('/run', verifyTeacherOrStudent, async (req, res) => {
  const parsed = runSchema.safeParse(req.body || {})
  if (!parsed.success) return res.status(400).json({ error: 'Validation failed', details: parsed.error.issues.map(issue => ({ field: issue.path.join('.'), message: issue.message })) })
  const userKey = `${req.user.role}:${req.user.id}`
  if (!runner.takeUserRun(userKey)) return res.status(429).json({ error: runner.USER_LIMIT_MESSAGE })
  const started = Date.now()
  try {
    const result = await runner.run(parsed.data)
    logger.info({ event: 'code_run', user_id: req.user.id, language: parsed.data.language, status: result.status, duration_ms: Date.now() - started }, 'Code execution completed')
    res.json(result)
  } catch (error) {
    const status = error.statusCode || 502
    logger.info({ event: 'code_run', user_id: req.user.id, language: parsed.data.language, status: status === 503 ? 'disabled' : 'runner_error', duration_ms: Date.now() - started }, 'Code execution completed')
    res.status(status).json({ error: error.message || 'Code execution failed' })
  }
})

router.post('/submit', verifyStudent, async (req, res) => {
  try {
    const { room_id, code, language, output } = req.body;
    if (!room_id || !code || !language) return res.status(400).json({ error: 'room_id, code, and language required' });
    if (String(code).length > 50000) return res.status(413).json({ error: 'Code submission is too large' });
    const room = await dbGet("SELECT id, code as room_code FROM rooms WHERE id = ? AND status = 'active'", [room_id]);
    if (!room) return res.status(404).json({ error: 'Active room not found' });
    const result = await dbRun(
      'INSERT INTO code_submissions (student_id, room_id, code, language, output) VALUES (?, ?, ?, ?, ?)',
      [req.user.id, room_id, String(code), String(language), String(output || '').slice(0, 20000)]
    );
    const submission = await dbGet('SELECT cs.*, s.name, s.roll_no, s.usn, s.avatar_color FROM code_submissions cs JOIN students s ON s.id = cs.student_id WHERE cs.id = ?', [result.lastID]);
    req.app.get('io')?.to(room.room_code.toUpperCase()).emit('code:submission', { ...submission, room_code: room.room_code });
    res.status(201).json({ id: result.lastID, success: true });
  } catch (err) { (console.error('[API] Request failed:', err), res.status(500).json({ error: 'Something went wrong' })); }
});

router.get('/room/:room_id', verifyTeacher, async (req, res) => {
  try {
    const room = await dbGet('SELECT id FROM rooms WHERE id = ? AND teacher_id = ?', [req.params.room_id, req.user.id]);
    if (!room) return res.status(404).json({ error: 'Room not found for this teacher' });
    const submissions = await dbAll(
      `SELECT cs.*, s.name, s.roll_no, s.usn, s.avatar_color FROM code_submissions cs JOIN students s ON cs.student_id = s.id
       WHERE cs.room_id = ? ORDER BY cs.submitted_at DESC`, [room.id]);
    res.json({ submissions });
  } catch (err) { (console.error('[API] Request failed:', err), res.status(500).json({ error: 'Something went wrong' })); }
});

router.patch('/:submission_id/review', verifyTeacher, async (req, res) => {
  try {
    const submission = await dbGet('SELECT cs.* FROM code_submissions cs JOIN rooms r ON r.id = cs.room_id WHERE cs.id = ? AND r.teacher_id = ?', [req.params.submission_id, req.user.id]);
    if (!submission) return res.status(404).json({ error: 'Code submission not found for this teacher' });
    const grade = req.body.grade === '' || req.body.grade === undefined || req.body.grade === null ? null : Number(req.body.grade);
    if (grade !== null && (!Number.isFinite(grade) || grade < 0 || grade > 100)) return res.status(400).json({ error: 'Grade must be between 0 and 100' });
    const feedback = String(req.body.feedback || '').slice(0, 4000);
    const status = grade === null ? 'reviewed' : 'graded';
    await dbRun('UPDATE code_submissions SET grade = ?, feedback = ?, status = ?, graded_by = ?, graded_at = CURRENT_TIMESTAMP WHERE id = ?', [grade, feedback, status, req.user.id, submission.id]);
    res.json({ success: true, grade, feedback, status });
  } catch (err) { (console.error('[API] Request failed:', err), res.status(500).json({ error: 'Something went wrong' })); }
});

router.get('/student/:student_id', verifyStudent, async (req, res) => {
  try {
    if (Number(req.params.student_id) !== Number(req.user.id)) return res.status(403).json({ error: 'Student access required' });
    const submissions = await dbAll(
      `SELECT cs.id, cs.student_id, cs.room_id, cs.language, cs.grade, cs.feedback, cs.status, cs.submitted_at, r.subject, r.class_name
       FROM code_submissions cs JOIN rooms r ON cs.room_id = r.id WHERE cs.student_id = ? ORDER BY cs.submitted_at DESC`, [req.user.id]);
    res.json({ submissions });
  } catch (err) { (console.error('[API] Request failed:', err), res.status(500).json({ error: 'Something went wrong' })); }
});

module.exports = router;
