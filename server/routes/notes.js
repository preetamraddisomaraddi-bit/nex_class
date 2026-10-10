const express = require('express');
const router = express.Router();
const { dbAll, dbRun, dbGet } = require('../db/database');

router.post('/push', async (req, res) => {
  try {
    const { room_id, title, content } = req.body;
    if (!room_id || !content) return res.status(400).json({ error: 'room_id and content required' });
    const result = await dbRun('INSERT INTO notes (room_id, title, content) VALUES (?, ?, ?)', [room_id, title || 'Class Note', content]);
    const note = await dbGet('SELECT * FROM notes WHERE id = ?', [result.lastID]);
    res.json({ note });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/room/:room_id', async (req, res) => {
  try {
    const notes = await dbAll('SELECT * FROM notes WHERE room_id = ? ORDER BY pushed_at ASC', [req.params.room_id]);
    res.json({ notes });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/student/:student_id', async (req, res) => {
  try {
    const notes = await dbAll(
      `SELECT n.*, r.subject, r.class_name, r.topic, r.started_at, t.name as teacher_name
       FROM notes n JOIN rooms r ON n.room_id = r.id JOIN teachers t ON r.teacher_id = t.id
       JOIN attendance a ON a.room_id = r.id AND a.student_id = ?
       ORDER BY n.pushed_at DESC`,
      [req.params.student_id]
    );
    res.json({ notes });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
