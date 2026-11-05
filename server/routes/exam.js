const express = require('express');
const router = express.Router();
const { dbGet, dbAll, dbRun } = require('../db/database');
const { verifyTeacher, verifyStudent } = require('../middleware/auth');

const manualTypes = new Set(['short_answer', 'long_answer', 'code']);
const cleanQuestions = questions => questions.map(({ correct_index, answer, rubric, ...question }) => question);
const parseQuestions = exam => {
  try { return JSON.parse(exam.questions || '[]'); }
  catch { return []; }
};
const studentRoomAccess = async (studentId, roomId) => {
  const row = await dbGet(
    `SELECT r.status as room_status, r.university_id as room_university, r.department_id as room_department, r.semester_id as room_semester,
      s.university_id as student_university, s.department_id as student_department, s.semester_id as student_semester
     FROM rooms r JOIN students s ON s.id = ? WHERE r.id = ?`, [studentId, roomId]);
  if (!row) return null;
  if (row.room_university && row.student_university && row.room_university !== row.student_university) return null;
  if (row.room_department && row.student_department && row.room_department !== row.student_department) return null;
  if (row.room_semester && row.student_semester && row.room_semester !== row.student_semester) return null;
  return row;
};
const normalizeQuestions = questions => {
  if (!Array.isArray(questions) || !questions.length || questions.length > 100) {
    throw new Error('Add between 1 and 100 questions');
  }
  return questions.map((q, index) => {
    const type = q.type || 'mcq';
    if (!['mcq', 'short_answer', 'long_answer', 'code'].includes(type)) {
      throw new Error(`Question ${index + 1} has an unsupported type`);
    }
    if (!String(q.text || '').trim()) throw new Error(`Question ${index + 1} needs text`);
    const points = Number(q.points ?? 1);
    if (!Number.isFinite(points) || points <= 0 || points > 100) throw new Error(`Question ${index + 1} has invalid points`);
    if (type === 'mcq') {
      if (!Array.isArray(q.options) || q.options.length < 2 || q.options.some(option => !String(option).trim())) {
        throw new Error(`Question ${index + 1} needs at least two complete options`);
      }
      if (!Number.isInteger(Number(q.correct_index)) || Number(q.correct_index) < 0 || Number(q.correct_index) >= q.options.length) {
        throw new Error(`Question ${index + 1} needs a valid correct option`);
      }
    }
    return {
      type, text: String(q.text).trim(), points,
      ...(type === 'mcq' ? { options: q.options.map(String), correct_index: Number(q.correct_index) } : {}),
      ...(manualTypes.has(type) ? { rubric: String(q.rubric || '').trim() } : {}),
      ...(type === 'code' ? { language: String(q.language || 'javascript') } : {})
    };
  });
};

router.post('/create', verifyTeacher, async (req, res) => {
  try {
    const { room_id, title, duration_mins } = req.body;
    const inputQuestions = req.body.questions || req.body.questions_json;
    if (!room_id || !String(title || '').trim() || !inputQuestions) {
      return res.status(400).json({ error: 'room_id, title, questions required' });
    }
    const room = await dbGet('SELECT id FROM rooms WHERE id = ? AND teacher_id = ?', [room_id, req.user.id]);
    if (!room) return res.status(404).json({ error: 'Room not found for this teacher' });
    const questions = normalizeQuestions(inputQuestions);
    const result = await dbRun(
      'INSERT INTO exams (room_id, title, duration_mins, questions) VALUES (?, ?, ?, ?)',
      [room_id, String(title).trim(), Math.max(1, Math.min(300, Number(duration_mins) || 30)), JSON.stringify(questions)]
    );
    const exam = await dbGet('SELECT * FROM exams WHERE id = ?', [result.lastID]);
    res.json({ exam: { ...exam, questions } });
  } catch (err) {
    res.status(err.message.startsWith('Question') || err.message.startsWith('Add between') ? 400 : 500).json({ error: err.message });
  }
});

router.get('/room/:room_id', verifyTeacher, async (req, res) => {
  try {
    const room = await dbGet('SELECT id FROM rooms WHERE id = ? AND teacher_id = ?', [req.params.room_id, req.user.id]);
    if (!room) return res.status(404).json({ error: 'Room not found for this teacher' });
    const exams = await dbAll('SELECT * FROM exams WHERE room_id = ? ORDER BY id DESC', [room.id]);
    res.json({ exams: exams.map(exam => ({ ...exam, questions: parseQuestions(exam) })) });
  } catch (err) { (console.error('[API] Request failed:', err), res.status(500).json({ error: 'Something went wrong' })); }
});

router.get('/active/:room_code', verifyStudent, async (req, res) => {
  try {
    const exam = await dbGet(
      `SELECT e.* FROM exams e JOIN rooms r ON r.id = e.room_id
       WHERE r.code = ? AND r.status = 'active' AND e.status = 'active'
       ORDER BY e.launched_at DESC LIMIT 1`, [String(req.params.room_code).toUpperCase()]);
    if (!exam) return res.json({ exam: null });
    if (!await studentRoomAccess(req.user.id, exam.room_id)) return res.status(403).json({ error: 'This exam is not assigned to your enrollment.' });
    const questions = parseQuestions(exam);
    res.json({ exam: { ...exam, questions: cleanQuestions(questions) } });
  } catch (err) { (console.error('[API] Request failed:', err), res.status(500).json({ error: 'Something went wrong' })); }
});

router.patch('/:exam_id/launch', verifyTeacher, async (req, res) => {
  try {
    const exam = await dbGet('SELECT e.*, r.code FROM exams e JOIN rooms r ON r.id = e.room_id WHERE e.id = ? AND r.teacher_id = ?', [req.params.exam_id, req.user.id]);
    if (!exam) return res.status(404).json({ error: 'Exam not found for this teacher' });
    await dbRun("UPDATE exams SET status = 'active', launched_at = CURRENT_TIMESTAMP WHERE id = ?", [exam.id]);
    const saved = await dbGet('SELECT * FROM exams WHERE id = ?', [exam.id]);
    const questions = parseQuestions(saved);
    const io = req.app.get('io');
    io?.to(exam.code.toUpperCase()).emit('exam:launched', {
      exam: { ...saved, questions: cleanQuestions(questions) }
    });
    res.json({ exam: { ...saved, questions } });
  } catch (err) { (console.error('[API] Request failed:', err), res.status(500).json({ error: 'Something went wrong' })); }
});

router.get('/student/:student_id', verifyStudent, async (req, res) => {
  try {
    if (Number(req.params.student_id) !== Number(req.user.id)) return res.status(403).json({ error: 'Student access required' });
    const history = await dbAll(
      `SELECT es.id, es.student_id, es.exam_id, es.score, es.total, es.percentage, es.status, es.feedback, es.submitted_at,
        e.title, e.duration_mins, r.subject, r.class_name, t.name as teacher_name
       FROM exam_submissions es JOIN exams e ON es.exam_id = e.id JOIN rooms r ON e.room_id = r.id JOIN teachers t ON r.teacher_id = t.id
       WHERE es.student_id = ? ORDER BY es.submitted_at DESC`, [req.user.id]);
    res.json({ history });
  } catch (err) { (console.error('[API] Request failed:', err), res.status(500).json({ error: 'Something went wrong' })); }
});

router.get('/:exam_id/results', verifyTeacher, async (req, res) => {
  try {
    const exam = await dbGet('SELECT e.* FROM exams e JOIN rooms r ON r.id = e.room_id WHERE e.id = ? AND r.teacher_id = ?', [req.params.exam_id, req.user.id]);
    if (!exam) return res.status(404).json({ error: 'Exam not found for this teacher' });
    const results = await dbAll(
      `SELECT es.*, s.name, s.roll_no, s.usn, s.avatar_color FROM exam_submissions es JOIN students s ON es.student_id = s.id
       WHERE es.exam_id = ? ORDER BY CASE WHEN es.status = 'pending_review' THEN 0 ELSE 1 END, es.submitted_at DESC`, [exam.id]);
    res.json({ results: results.map(r => ({ ...r, answers: JSON.parse(r.answers || '{}'), question_scores: JSON.parse(r.question_scores || '{}') })) });
  } catch (err) { (console.error('[API] Request failed:', err), res.status(500).json({ error: 'Something went wrong' })); }
});

router.post('/submit', verifyStudent, async (req, res) => {
  try {
    const { exam_id, answers } = req.body;
    if (!exam_id || !answers || typeof answers !== 'object') return res.status(400).json({ error: 'exam_id and answers required' });
    const exam = await dbGet('SELECT * FROM exams WHERE id = ?', [exam_id]);
    if (!exam) return res.status(404).json({ error: 'Exam not found' });
    const access = await studentRoomAccess(req.user.id, exam.room_id);
    if (!access) return res.status(403).json({ error: 'This exam is not assigned to your enrollment.' });
    if (exam.status !== 'active' || !exam.launched_at) return res.status(409).json({ error: 'This exam is not accepting submissions' });
    const launchedAt = new Date(/[Zz]|[+-]\d{2}:?\d{2}$/.test(exam.launched_at) ? exam.launched_at : exam.launched_at.replace(' ', 'T') + 'Z').getTime();
    if (Number.isFinite(launchedAt) && Date.now() > launchedAt + Number(exam.duration_mins || 30) * 60000 + 30000) {
      return res.status(409).json({ error: 'The exam submission time has ended.' });
    }
    const existing = await dbGet('SELECT id FROM exam_submissions WHERE student_id = ? AND exam_id = ?', [req.user.id, exam_id]);
    if (existing) return res.status(409).json({ error: 'You have already submitted this exam' });
    const questions = parseQuestions(exam);
    const safeAnswers = {};
    let score = 0;
    let total = 0;
    let hasManual = false;
    const questionScores = {};
    questions.forEach((q, index) => {
      const points = Number(q.points || 1);
      total += points;
      const answer = answers[index] ?? answers[String(index)];
      if (q.type === 'mcq') {
        if (answer !== undefined && String(answer) === String(q.correct_index)) {
          score += points;
          questionScores[index] = { score: points, feedback: '' };
        } else questionScores[index] = { score: 0, feedback: '' };
      } else {
        hasManual = true;
        safeAnswers[index] = String(answer ?? '').slice(0, q.type === 'code' ? 50000 : 10000);
      }
    });
    questions.forEach((q, index) => { if (q.type === 'mcq') safeAnswers[index] = answers[index] ?? answers[String(index)] ?? ''; });
    const status = hasManual ? 'pending_review' : 'graded';
    const percentage = !hasManual && total ? Math.round(score / total * 100) : null;
    const result = await dbRun(
      'INSERT INTO exam_submissions (student_id, exam_id, answers, score, total, percentage, status, question_scores) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [req.user.id, exam_id, JSON.stringify(safeAnswers), score, total, percentage, status, JSON.stringify(questionScores)]
    );
    res.status(201).json({ id: result.lastID, score, total, percentage, status, message: hasManual ? 'Submitted. Written responses are awaiting teacher review.' : 'Submitted and graded.' });
  } catch (err) { (console.error('[API] Request failed:', err), res.status(500).json({ error: 'Something went wrong' })); }
});

router.patch('/:exam_id/submissions/:submission_id/grade', verifyTeacher, async (req, res) => {
  try {
    const exam = await dbGet('SELECT e.* FROM exams e JOIN rooms r ON r.id = e.room_id WHERE e.id = ? AND r.teacher_id = ?', [req.params.exam_id, req.user.id]);
    if (!exam) return res.status(404).json({ error: 'Exam not found for this teacher' });
    const submission = await dbGet('SELECT * FROM exam_submissions WHERE id = ? AND exam_id = ?', [req.params.submission_id, exam.id]);
    if (!submission) return res.status(404).json({ error: 'Submission not found' });
    const questions = parseQuestions(exam);
    const answers = JSON.parse(submission.answers || '{}');
    const scores = JSON.parse(submission.question_scores || '{}');
    const grades = req.body.grades || {};
    for (const [indexText, grade] of Object.entries(grades)) {
      const index = Number(indexText);
      const question = questions[index];
      if (!question || !manualTypes.has(question.type)) return res.status(400).json({ error: `Question ${index + 1} cannot be manually graded` });
      const points = Number(grade.score);
      if (!Number.isFinite(points) || points < 0 || points > Number(question.points || 1)) return res.status(400).json({ error: `Question ${index + 1} score is out of range` });
      scores[index] = { score: points, feedback: String(grade.feedback || '').slice(0, 2000) };
    }
    const allManualGraded = questions.every((q, index) => !manualTypes.has(q.type) || scores[index]);
    const score = Object.values(scores).reduce((sum, item) => sum + Number(item.score || 0), 0);
    const status = allManualGraded ? 'graded' : 'pending_review';
    const percentage = allManualGraded && submission.total ? Math.round(score / submission.total * 100) : null;
    const feedback = String(req.body.feedback || '').slice(0, 4000);
    await dbRun('UPDATE exam_submissions SET score = ?, percentage = ?, status = ?, question_scores = ?, feedback = ?, graded_by = ?, graded_at = CASE WHEN ? = \'graded\' THEN CURRENT_TIMESTAMP ELSE NULL END WHERE id = ?',
      [score, percentage, status, JSON.stringify(scores), feedback, req.user.id, status, submission.id]);
    res.json({ success: true, score, total: submission.total, percentage, status, question_scores: scores, feedback });
  } catch (err) { (console.error('[API] Request failed:', err), res.status(500).json({ error: 'Something went wrong' })); }
});

// Student-safe exam detail: never expose answer keys or grading rubrics.
router.get('/:exam_id', async (req, res) => {
  try {
    const exam = await dbGet('SELECT * FROM exams WHERE id = ?', [req.params.exam_id]);
    if (!exam) return res.status(404).json({ error: 'Exam not found' });
    const jwt = require('jsonwebtoken');
const { JWT_SECRET } = require('../config');
    let user;
    try {
      const token = req.headers.authorization?.split(' ')[1];
      if (!token) throw new Error('missing token');
      user = jwt.verify(token, JWT_SECRET);
    } catch { return res.status(401).json({ error: 'Authorization token required' }); }
    const room = await dbGet('SELECT * FROM rooms WHERE id = ?', [exam.room_id]);
    if (user.role === 'teacher') {
      if (Number(user.id) !== Number(room.teacher_id)) return res.status(403).json({ error: 'Teacher access required' });
    } else if (user.role === 'student') {
      if (exam.status !== 'active' || room.status !== 'active') return res.status(404).json({ error: 'Active exam not found' });
      if (!await studentRoomAccess(user.id, exam.room_id)) return res.status(403).json({ error: 'This exam is not assigned to your enrollment.' });
    } else return res.status(403).json({ error: 'Account access required' });
    const questions = parseQuestions(exam);
    res.json({ ...exam, questions: user.role === 'teacher' ? questions : cleanQuestions(questions) });
  } catch (err) { (console.error('[API] Request failed:', err), res.status(500).json({ error: 'Something went wrong' })); }
});

module.exports = router;
