const express = require('express');
const router = express.Router();
const { dbAll, dbRun } = require('../db/database');

router.post('/submit', async (req, res) => {
  try {
    const { student_id, room_id, code, language, output } = req.body;
    if (!student_id || !room_id || !code || !language) return res.status(400).json({ error: 'All fields required' });
    const result = await dbRun(
      'INSERT INTO code_submissions (student_id, room_id, code, language, output) VALUES (?, ?, ?, ?, ?)',
      [student_id, room_id, code, language, output || '']
    );
    res.json({ id: result.lastID, success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/room/:room_id', async (req, res) => {
  try {
    const submissions = await dbAll(
      `SELECT cs.*, s.name, s.roll_no, s.avatar_color FROM code_submissions cs JOIN students s ON cs.student_id = s.id WHERE cs.room_id = ? ORDER BY cs.submitted_at DESC`,
      [req.params.room_id]
    );
    res.json({ submissions });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/student/:student_id', async (req, res) => {
  try {
    const submissions = await dbAll(
      `SELECT cs.*, r.subject, r.class_name FROM code_submissions cs JOIN rooms r ON cs.room_id = r.id WHERE cs.student_id = ? ORDER BY cs.submitted_at DESC`,
      [req.params.student_id]
    );
    res.json({ submissions });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
