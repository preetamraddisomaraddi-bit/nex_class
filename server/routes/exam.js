const express = require('express');
const router = express.Router();
const { dbGet, dbAll, dbRun } = require('../db/database');

router.post('/create', async (req, res) => {
  try {
    const { room_id, title, duration_mins, questions } = req.body;
    if (!room_id || !title || !questions) return res.status(400).json({ error: 'room_id, title, questions required' });
    const result = await dbRun(
      'INSERT INTO exams (room_id, title, duration_mins, questions) VALUES (?, ?, ?, ?)',
      [room_id, title, duration_mins || 30, JSON.stringify(questions)]
    );
    const exam = await dbGet('SELECT * FROM exams WHERE id = ?', [result.lastID]);
    res.json({ exam: { ...exam, questions: JSON.parse(exam.questions) } });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/room/:room_id', async (req, res) => {
  try {
    const exams = await dbAll('SELECT * FROM exams WHERE room_id = ? ORDER BY launched_at DESC', [req.params.room_id]);
    res.json({ exams: exams.map(e => ({ ...e, questions: JSON.parse(e.questions) })) });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/submit', async (req, res) => {
  try {
    const { student_id, exam_id, answers } = req.body;
    if (!student_id || !exam_id || !answers) return res.status(400).json({ error: 'All fields required' });
    const exam = await dbGet('SELECT * FROM exams WHERE id = ?', [exam_id]);
    if (!exam) return res.status(404).json({ error: 'Exam not found' });
    const questions = JSON.parse(exam.questions);
    let score = 0, total = 0;
    questions.forEach((q, i) => {
      if (q.type === 'mcq') {
        total++;
        if (answers[i] !== undefined && answers[i].toString() === q.correct_index.toString()) score++;
      }
    });
    const percentage = total > 0 ? Math.round((score / total) * 100) : null;
    await dbRun(
      'INSERT OR REPLACE INTO exam_submissions (student_id, exam_id, answers, score, total, percentage) VALUES (?, ?, ?, ?, ?, ?)',
      [student_id, exam_id, JSON.stringify(answers), score, total, percentage]
    );
    res.json({ score, total, percentage });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/:exam_id/results', async (req, res) => {
  try {
    const results = await dbAll(
      `SELECT es.*, s.name, s.roll_no, s.avatar_color FROM exam_submissions es JOIN students s ON es.student_id = s.id WHERE es.exam_id = ? ORDER BY es.percentage DESC`,
      [req.params.exam_id]
    );
    res.json({ results: results.map(r => ({ ...r, answers: JSON.parse(r.answers) })) });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/student/:student_id', async (req, res) => {
  try {
    const history = await dbAll(
      `SELECT es.*, e.title, e.duration_mins, r.subject, r.class_name, t.name as teacher_name
       FROM exam_submissions es JOIN exams e ON es.exam_id = e.id JOIN rooms r ON e.room_id = r.id JOIN teachers t ON r.teacher_id = t.id
       WHERE es.student_id = ? ORDER BY es.submitted_at DESC`,
      [req.params.student_id]
    );
    res.json({ history });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
