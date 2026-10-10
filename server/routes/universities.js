const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { dbGet, dbAll, dbRun } = require('../db/database');
const { verifyAdmin } = require('../middleware/auth');

const JWT_SECRET_ADMIN = process.env.JWT_SECRET_ADMIN || 'edusync_admin_secret_key_change_in_production';

// POST /api/universities/register
router.post('/register', async (req, res) => {
  try {
    const {
      name, code, type, established_year, address, phone, website, logo_url,
      admin_name, admin_email, admin_password, admin_staff_id
    } = req.body;

    if (!name || !code || !admin_name || !admin_email || !admin_password) {
      return res.status(400).json({ error: 'Required fields missing: name, code, admin_name, admin_email, admin_password' });
    }

    const uppercaseCode = code.toUpperCase().trim();

    // Check unique code
    const existingCode = await dbGet('SELECT id FROM universities WHERE code = ?', [uppercaseCode]);
    if (existingCode) return res.status(409).json({ error: 'University code already registered' });

    // Check unique admin email
    const existingEmail = await dbGet('SELECT id FROM universities WHERE admin_email = ?', [admin_email]);
    if (existingEmail) return res.status(409).json({ error: 'Admin email already registered' });

    const passwordHash = bcrypt.hashSync(admin_password, 12);

    const result = await dbRun(
      `INSERT INTO universities (
        name, code, type, address, phone, website, logo_url,
        admin_name, admin_email, admin_password_hash, admin_staff_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        name, uppercaseCode, type || 'Other', address || '', phone || '', website || '', logo_url || '',
        admin_name, admin_email, passwordHash, admin_staff_id || ''
      ]
    );

    res.status(201).json({
      success: true,
      university_id: result.lastID,
      university_code: uppercaseCode,
      message: 'University registered successfully'
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/universities/code/:code
router.get('/code/:code', async (req, res) => {
  try {
    const uni = await dbGet('SELECT id, name, code, logo_url FROM universities WHERE code = ?', [req.params.code.toUpperCase().trim()]);
    if (!uni) return res.status(404).json({ error: 'University not found' });
    res.json({ university: uni });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/universities/login
router.post('/login', async (req, res) => {
  try {
    const { code, admin_email, password } = req.body;
    if (!code || !admin_email || !password) {
      return res.status(400).json({ error: 'University code, admin email and password required' });
    }

    const uppercaseCode = code.toUpperCase().trim();
    const uni = await dbGet('SELECT * FROM universities WHERE code = ? AND admin_email = ?', [uppercaseCode, admin_email]);
    if (!uni || !bcrypt.compareSync(password, uni.admin_password_hash)) {
      return res.status(401).json({ error: 'Invalid university code, email, or password' });
    }

    const token = jwt.sign(
      { university_id: uni.id, admin_email: uni.admin_email, role: 'admin' },
      JWT_SECRET_ADMIN,
      { expiresIn: '7d' }
    );

    res.json({
      success: true,
      token,
      university: {
        id: uni.id,
        name: uni.name,
        code: uni.code,
        logo_url: uni.logo_url,
        admin_name: uni.admin_name
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/universities/:id/stats
router.get('/:id/stats', verifyAdmin, async (req, res) => {
  try {
    const uniId = req.params.id;

    const totalDepts = await dbGet('SELECT COUNT(*) as count FROM departments WHERE university_id = ?', [uniId]);
    const totalTeachers = await dbGet("SELECT COUNT(*) as count FROM teachers WHERE university_id = ? AND status = 'approved'", [uniId]);
    const totalStudents = await dbGet('SELECT COUNT(*) as count FROM students WHERE university_id = ?', [uniId]);
    const sessionsToday = await dbGet("SELECT COUNT(*) as count FROM rooms WHERE university_id = ? AND date(started_at) = date('now')", [uniId]);

    // Attendance computation
    const attendanceRow = await dbGet(
      `SELECT COUNT(CASE WHEN a.status IN ('present', 'late') THEN 1 END) as present_count,
              COUNT(*) as total_count
       FROM attendance a
       JOIN students s ON a.student_id = s.id
       WHERE s.university_id = ?`,
      [uniId]
    );

    const overall_attendance_pct = attendanceRow.total_count 
      ? Math.round((attendanceRow.present_count / attendanceRow.total_count) * 100)
      : 0;

    // Academic performance average
    const scoreRow = await dbGet(
      `SELECT AVG(es.percentage) as avg_score
       FROM exam_submissions es
       JOIN students s ON es.student_id = s.id
       WHERE s.university_id = ?`,
      [uniId]
    );

    const university_avg_score = scoreRow.avg_score ? Math.round(scoreRow.avg_score) : 0;

    res.json({
      total_departments: totalDepts.count,
      total_teachers: totalTeachers.count,
      total_students: totalStudents.count,
      sessions_today: sessionsToday.count,
      overall_attendance_pct,
      university_avg_score
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/universities/:id/teachers
router.get('/:id/teachers', verifyAdmin, async (req, res) => {
  try {
    const uniId = req.params.id;
    const status = req.query.status;

    let sql = `
      SELECT t.id, t.name, t.email, t.employee_id, t.status, t.created_at, d.name as department_name,
             MAX(r.started_at) as last_session_date,
             COUNT(r.id) as total_sessions
      FROM teachers t
      LEFT JOIN departments d ON t.department_id = d.id
      LEFT JOIN rooms r ON t.id = r.teacher_id
      WHERE t.university_id = ?
    `;
    const params = [uniId];

    if (status && status !== 'all') {
      sql += ' AND t.status = ?';
      params.push(status);
    }

    sql += ' GROUP BY t.id ORDER BY t.created_at DESC';

    const teachers = await dbAll(sql, params);
    res.json({ teachers });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/universities/:id/students
router.get('/:id/students', verifyAdmin, async (req, res) => {
  try {
    const uniId = req.params.id;
    const { dept_id, sem_id, attendance, search } = req.query;

    let sql = `
      SELECT s.id, s.name, s.usn, s.email, s.created_at, d.name as department_name, sem.number as semester_number,
             (SELECT MAX(joined_at) FROM attendance WHERE student_id = s.id) as last_active,
             (SELECT AVG(percentage) FROM exam_submissions WHERE student_id = s.id) as avg_score,
             (SELECT COUNT(CASE WHEN status IN ('present', 'late') THEN 1 END) * 100.0 / MAX(1, COUNT(*)) FROM attendance WHERE student_id = s.id) as attendance_pct
      FROM students s
      LEFT JOIN departments d ON s.department_id = d.id
      LEFT JOIN semesters sem ON s.semester_id = sem.id
      WHERE s.university_id = ?
    `;
    const params = [uniId];

    if (dept_id) {
      sql += ' AND s.department_id = ?';
      params.push(dept_id);
    }
    if (sem_id) {
      sql += ' AND s.semester_id = ?';
      params.push(sem_id);
    }
    if (search) {
      sql += ' AND (s.name LIKE ? OR s.usn LIKE ?)';
      params.push(`%${search}%`, `%${search}%`);
    }

    let outerSql = `SELECT * FROM (${sql}) `;
    if (attendance === 'below75') {
      outerSql += ' WHERE attendance_pct < 75 OR attendance_pct IS NULL';
    } else if (attendance === 'above75') {
      outerSql += ' WHERE attendance_pct >= 75';
    }
    outerSql += ' ORDER BY name ASC';

    const students = await dbAll(outerSql, params);
    res.json({ students });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/universities/:id/sessions
router.get('/:id/sessions', verifyAdmin, async (req, res) => {
  try {
    const uniId = req.params.id;
    const { dept_id, sem_id, teacher_id, from, to, status } = req.query;

    let sql = `
      SELECT r.id, r.code, r.subject, r.class_name, r.topic, r.started_at as created_at, r.ended_at, r.status,
             t.name as teacher_name, d.name as dept_name, sem.number as semester_number,
             (SELECT COUNT(*) FROM attendance WHERE room_id = r.id) as student_count,
             (SELECT COUNT(*) FROM notes WHERE room_id = r.id) as notes_count,
             (SELECT COUNT(*) FROM exams WHERE room_id = r.id) as exams_count
      FROM rooms r
      LEFT JOIN teachers t ON r.teacher_id = t.id
      LEFT JOIN departments d ON r.department_id = d.id
      LEFT JOIN semesters sem ON r.semester_id = sem.id
      WHERE r.university_id = ?
    `;
    const params = [uniId];

    if (dept_id) {
      sql += ' AND r.department_id = ?';
      params.push(dept_id);
    }
    if (sem_id) {
      sql += ' AND r.semester_id = ?';
      params.push(sem_id);
    }
    if (teacher_id) {
      sql += ' AND r.teacher_id = ?';
      params.push(teacher_id);
    }
    if (from) {
      sql += ' AND r.started_at >= ?';
      params.push(from);
    }
    if (to) {
      sql += ' AND r.started_at <= ?';
      params.push(to);
    }
    if (status && status !== 'all') {
      sql += ' AND r.status = ?';
      params.push(status);
    }

    sql += ' ORDER BY r.started_at DESC';

    const sessions = await dbAll(sql, params);
    res.json({ sessions });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/universities/:id/recent-sessions
router.get('/:id/recent-sessions', verifyAdmin, async (req, res) => {
  try {
    const sessions = await dbAll(
      `SELECT r.code, r.subject, r.class_name, r.started_at as created_at, t.name as teacher_name,
              d.name as dept_name, sem.number as semester_number,
              (SELECT COUNT(*) FROM attendance WHERE room_id = r.id) as student_count
       FROM rooms r
       LEFT JOIN teachers t ON r.teacher_id = t.id
       LEFT JOIN departments d ON r.department_id = d.id
       LEFT JOIN semesters sem ON r.semester_id = sem.id
       WHERE r.university_id = ?
       ORDER BY r.started_at DESC LIMIT 10`,
      [req.params.id]
    );
    res.json({ sessions });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/universities/:id/alerts
router.get('/:id/alerts', verifyAdmin, async (req, res) => {
  try {
    const uniId = req.params.id;
    const pending_teachers = await dbAll(
      "SELECT t.id, t.name, t.email, t.employee_id, d.name as department_name FROM teachers t LEFT JOIN departments d ON t.department_id = d.id WHERE t.university_id = ? AND t.status = 'pending'",
      [uniId]
    );

    const studentSql = `
      SELECT s.id, s.name, s.usn, d.name as department_name, sem.number as semester_number,
             (SELECT COUNT(CASE WHEN status IN ('present', 'late') THEN 1 END) * 100.0 / MAX(1, COUNT(*)) FROM attendance WHERE student_id = s.id) as attendance_pct
      FROM students s
      LEFT JOIN departments d ON s.department_id = d.id
      LEFT JOIN semesters sem ON s.semester_id = sem.id
      WHERE s.university_id = ?
    `;
    const allStudents = await dbAll(studentSql, [uniId]);
    const low_attendance_students = allStudents.filter(s => s.attendance_pct < 75);

    res.json({
      pending_teachers,
      low_attendance_students
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/universities/:id/reports/attendance
router.get('/:id/reports/attendance', verifyAdmin, async (req, res) => {
  try {
    const uniId = req.params.id;

    // Dept attendance list
    const dept_attendance = await dbAll(
      `SELECT d.id, d.name,
              ROUND(COUNT(CASE WHEN a.status IN ('present', 'late') THEN 1 END) * 100.0 / MAX(1, COUNT(a.id))) as attendance_pct
       FROM departments d
       JOIN students s ON s.department_id = d.id
       JOIN attendance a ON a.student_id = s.id
       WHERE d.university_id = ?
       GROUP BY d.id`,
      [uniId]
    );

    // Semester attendance list
    const sem_attendance = await dbAll(
      `SELECT sem.id, sem.number,
              ROUND(COUNT(CASE WHEN a.status IN ('present', 'late') THEN 1 END) * 100.0 / MAX(1, COUNT(a.id))) as attendance_pct
       FROM semesters sem
       JOIN students s ON s.semester_id = sem.id
       JOIN attendance a ON a.student_id = s.id
       WHERE sem.university_id = ?
       GROUP BY sem.id`,
      [uniId]
    );

    // Monthly Trend
    const monthly_trend = await dbAll(
      `SELECT strftime('%Y-%m', a.joined_at) as month,
              ROUND(COUNT(CASE WHEN a.status IN ('present', 'late') THEN 1 END) * 100.0 / MAX(1, COUNT(a.id))) as attendance_pct
       FROM attendance a
       JOIN students s ON a.student_id = s.id
       WHERE s.university_id = ? AND a.joined_at >= date('now', '-6 month')
       GROUP BY month
       ORDER BY month ASC`,
      [uniId]
    );

    // Low Attendance Students list
    const studentSql = `
      SELECT s.id, s.name, s.usn, d.name as department_name, sem.number as semester_number,
             ROUND(SELECT COUNT(CASE WHEN status IN ('present', 'late') THEN 1 END) * 100.0 / MAX(1, COUNT(*)) FROM attendance WHERE student_id = s.id) as attendance_pct
      FROM students s
      LEFT JOIN departments d ON s.department_id = d.id
      LEFT JOIN semesters sem ON s.semester_id = sem.id
      WHERE s.university_id = ?
    `;
    const allStudents = await dbAll(studentSql, [uniId]);
    const low_attendance_students = allStudents.filter(s => s.attendance_pct < 75);

    res.json({
      dept_attendance,
      sem_attendance,
      monthly_trend,
      low_attendance_students
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/universities/:id/reports/performance
router.get('/:id/reports/performance', verifyAdmin, async (req, res) => {
  try {
    const uniId = req.params.id;

    const avgRow = await dbGet(
      `SELECT ROUND(AVG(es.percentage)) as avg_score
       FROM exam_submissions es
       JOIN students s ON es.student_id = s.id
       WHERE s.university_id = ?`,
      [uniId]
    );

    const dept_scores = await dbAll(
      `SELECT d.id, d.name, ROUND(AVG(es.percentage)) as avg_score
       FROM departments d
       JOIN students s ON s.department_id = d.id
       JOIN exam_submissions es ON es.student_id = s.id
       WHERE d.university_id = ?
       GROUP BY d.id`,
      [uniId]
    );

    const top_students = await dbAll(
      `SELECT s.id, s.name, s.usn, d.name as department_name, sem.number as semester_number,
              ROUND(AVG(es.percentage)) as avg_score, COUNT(es.id) as exams_taken
       FROM students s
       JOIN exam_submissions es ON es.student_id = s.id
       LEFT JOIN departments d ON s.department_id = d.id
       LEFT JOIN semesters sem ON s.semester_id = sem.id
       WHERE s.university_id = ?
       GROUP BY s.id
       ORDER BY avg_score DESC
       LIMIT 10`,
      [uniId]
    );

    const sem_scores = await dbAll(
      `SELECT sem.id, sem.number, ROUND(AVG(es.percentage)) as avg_score
       FROM semesters sem
       JOIN students s ON s.semester_id = sem.id
       JOIN exam_submissions es ON es.student_id = s.id
       WHERE sem.university_id = ?
       GROUP BY sem.id`,
      [uniId]
    );

    res.json({
      university_avg: avgRow.avg_score || 0,
      dept_scores,
      top_students,
      sem_scores
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/universities/:id/reports/teachers
router.get('/:id/reports/teachers', verifyAdmin, async (req, res) => {
  try {
    const uniId = req.params.id;
    const teachers = await dbAll(
      `SELECT t.id, t.name, t.email, t.employee_id, d.name as department_name,
             COUNT(r.id) as total_sessions,
             SUM((SELECT COUNT(*) FROM attendance WHERE room_id = r.id)) as total_students_taught
      FROM teachers t
      LEFT JOIN departments d ON t.department_id = d.id
      LEFT JOIN rooms r ON t.id = r.teacher_id
      WHERE t.university_id = ? AND t.status = 'approved'
      GROUP BY t.id`,
      [uniId]
    );
    res.json({ teachers });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/universities/:id/reports/sessions
router.get('/:id/reports/sessions', verifyAdmin, async (req, res) => {
  try {
    const uniId = req.params.id;

    const monthly_sessions = await dbAll(
      `SELECT strftime('%Y-%m', r.started_at) as month, COUNT(r.id) as count
       FROM rooms r
       WHERE r.university_id = ? AND r.started_at >= date('now', '-6 month')
       GROUP BY month
       ORDER BY month ASC`,
      [uniId]
    );

    const durationRow = await dbGet(
      `SELECT ROUND(AVG((julianday(ended_at) - julianday(started_at)) * 24 * 60)) as avg_duration
       FROM rooms
       WHERE university_id = ? AND ended_at IS NOT NULL`,
      [uniId]
    );

    res.json({
      monthly_sessions,
      avg_duration_mins: durationRow.avg_duration || 0
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/universities/:id/export/students
router.get('/:id/export/students', verifyAdmin, async (req, res) => {
  try {
    const uniId = req.params.id;
    const { dept_id, sem_id } = req.query;

    let sql = `
      SELECT s.name, s.usn, d.name as department_name, sem.number as semester_number,
             (SELECT COUNT(CASE WHEN status IN ('present', 'late') THEN 1 END) * 100.0 / MAX(1, COUNT(*)) FROM attendance WHERE student_id = s.id) as attendance_pct,
             (SELECT AVG(percentage) FROM exam_submissions WHERE student_id = s.id) as avg_score
      FROM students s
      LEFT JOIN departments d ON s.department_id = d.id
      LEFT JOIN semesters sem ON s.semester_id = sem.id
      WHERE s.university_id = ?
    `;
    const params = [uniId];

    if (dept_id) {
      sql += ' AND s.department_id = ?';
      params.push(dept_id);
    }
    if (sem_id) {
      sql += ' AND s.semester_id = ?';
      params.push(sem_id);
    }

    const students = await dbAll(sql, params);

    let csv = 'USN,Name,Department,Semester,Attendance %,Avg Exam Score\n';
    students.forEach(s => {
      csv += `"${s.usn || ''}","${s.name || ''}","${s.department_name || ''}",${s.semester_number || ''},${s.attendance_pct !== null ? Math.round(s.attendance_pct) : 0},${s.avg_score !== null ? Math.round(s.avg_score) : 0}\n`;
    });

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=students_export.csv');
    res.send(csv);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/universities/:id/export/attendance
router.get('/:id/export/attendance', verifyAdmin, async (req, res) => {
  try {
    const uniId = req.params.id;
    const { from, to, dept_id } = req.query;

    let sql = `
      SELECT r.code as room_code, r.subject, t.name as teacher_name, s.name as student_name, s.usn, a.status, a.joined_at
      FROM attendance a
      JOIN students s ON a.student_id = s.id
      JOIN rooms r ON a.room_id = r.id
      JOIN teachers t ON r.teacher_id = t.id
      WHERE s.university_id = ?
    `;
    const params = [uniId];

    if (dept_id) {
      sql += ' AND s.department_id = ?';
      params.push(dept_id);
    }
    if (from) {
      sql += ' AND r.started_at >= ?';
      params.push(from);
    }
    if (to) {
      sql += ' AND r.started_at <= ?';
      params.push(to);
    }

    const records = await dbAll(sql, params);

    let csv = 'Room Code,Subject,Teacher,Student Name,USN,Status,Joined At\n';
    records.forEach(r => {
      csv += `"${r.room_code}","${r.subject}","${r.teacher_name}","${r.student_name}","${r.usn || ''}","${r.status}","${new Date(r.joined_at).toLocaleString()}"\n`;
    });

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=attendance_export.csv');
    res.send(csv);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/universities/:id/export/exams
router.get('/:id/export/exams', verifyAdmin, async (req, res) => {
  try {
    const uniId = req.params.id;

    const records = await dbAll(
      `SELECT s.name as student_name, s.usn, e.title as exam_title, r.subject, es.score, es.total, es.percentage
       FROM exam_submissions es
       JOIN students s ON es.student_id = s.id
       JOIN exams e ON es.exam_id = e.id
       JOIN rooms r ON e.room_id = r.id
       WHERE s.university_id = ?`,
      [uniId]
    );

    let csv = 'Student Name,USN,Exam Title,Subject,Score,Total,Percentage\n';
    records.forEach(r => {
      csv += `"${r.student_name}","${r.usn || ''}","${r.exam_title}","${r.subject}",${r.score},${r.total},${r.percentage || 0}\n`;
    });

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=exams_export.csv');
    res.send(csv);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
