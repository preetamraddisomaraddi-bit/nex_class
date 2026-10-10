const express = require('express');
const router = express.Router();
const { dbGet, dbAll, dbRun } = require('../db/database');

router.get('/student/:student_id', async (req, res) => {
  const studentId = req.params.student_id;
  try {
    // 1. Gather student stats
    // Attendance count
    const attRecord = await dbGet('SELECT COUNT(*) as count FROM attendance WHERE student_id = ? AND status = "present"', [studentId]);
    const attendanceCount = attRecord ? attRecord.count : 0;

    // Code submissions count
    const codeRecord = await dbGet('SELECT COUNT(*) as count FROM code_submissions WHERE student_id = ?', [studentId]);
    const codeCount = codeRecord ? codeRecord.count : 0;

    // Exam submissions
    const examSubmissions = await dbAll('SELECT score, total, percentage FROM exam_submissions WHERE student_id = ?', [studentId]);

    // 2. Define badge eligibility
    const eligibleBadges = [];

    if (attendanceCount >= 3) {
      eligibleBadges.push({ key: 'attendance_star', name: 'Attendance Star' });
    }
    if (codeCount >= 1) {
      eligibleBadges.push({ key: 'coding_champ', name: 'Coding Champ' });
    }
    if (codeCount >= 3) {
      eligibleBadges.push({ key: 'fast_learner', name: 'Fast Learner' });
    }
    
    const hasAce = examSubmissions.some(es => es.percentage >= 80);
    if (hasAce) {
      eligibleBadges.push({ key: 'exam_ace', name: 'Exam Ace' });
    }

    const hasPerfect = examSubmissions.some(es => es.percentage === 100);
    if (hasPerfect) {
      eligibleBadges.push({ key: 'perfect_score', name: 'Perfect Score' });
    }

    // 3. Check and award missing badges
    for (const badge of eligibleBadges) {
      const existing = await dbGet('SELECT id FROM badges WHERE student_id = ? AND badge_key = ?', [studentId, badge.key]);
      if (!existing) {
        await dbRun('INSERT INTO badges (student_id, badge_key, badge_name) VALUES (?, ?, ?)', [studentId, badge.key, badge.name]);
      }
    }

    // 4. Retrieve and return all badges
    const badges = await dbAll('SELECT * FROM badges WHERE student_id = ? ORDER BY awarded_at DESC', [studentId]);
    res.json({ badges });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
