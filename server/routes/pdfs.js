const express = require('express');
const router = express.Router();
const { dbGet, dbAll, dbRun } = require('../db/database');

// Push a PDF to a room and link it to present students
router.post('/push', async (req, res) => {
  try {
    const { room_id, filename, filedata } = req.body;
    if (!room_id || !filename || !filedata) {
      return res.status(400).json({ error: 'room_id, filename, and filedata (base64) are required' });
    }

    const fileBuffer = Buffer.from(filedata, 'base64');
    const filesize = fileBuffer.length;

    // 1. Insert the PDF metadata and data into pdfs table
    const result = await dbRun(
      'INSERT INTO pdfs (room_id, filename, filedata, filesize) VALUES (?, ?, ?, ?)',
      [room_id, filename, fileBuffer, filesize]
    );
    const pdfId = result.lastID;

    // 2. Fetch all students marked present in the room attendance logs
    const presentStudents = await dbAll(
      'SELECT student_id FROM attendance WHERE room_id = ? AND status = "present"',
      [room_id]
    );

    // 3. Link this PDF to all present students so they can access it on their profile
    for (const student of presentStudents) {
      await dbRun(
        'INSERT OR IGNORE INTO student_pdfs (student_id, pdf_id) VALUES (?, ?)',
        [student.student_id, pdfId]
      );
    }

    res.json({
      success: true,
      pdf: {
        id: pdfId,
        room_id,
        filename,
        filesize,
        pushed_at: new Date().toISOString()
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Fetch all PDFs pushed in a specific room
router.get('/room/:room_id', async (req, res) => {
  try {
    const pdfs = await dbAll(
      'SELECT id, room_id, filename, filesize, pushed_at FROM pdfs WHERE room_id = ? ORDER BY pushed_at DESC',
      [req.params.room_id]
    );
    res.json({ pdfs });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Fetch all PDFs received by a specific student across all rooms
router.get('/student/:student_id', async (req, res) => {
  try {
    const pdfs = await dbAll(
      `SELECT p.id, p.filename, p.filesize, p.pushed_at, r.subject, r.class_name, t.name as teacher_name
       FROM pdfs p
       JOIN student_pdfs sp ON p.id = sp.pdf_id
       JOIN rooms r ON p.room_id = r.id
       JOIN teachers t ON r.teacher_id = t.id
       WHERE sp.student_id = ?
       ORDER BY p.pushed_at DESC`,
      [req.params.student_id]
    );
    res.json({ pdfs });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Stream PDF binary contents to the client for viewing or downloading
router.get('/:id/download', async (req, res) => {
  try {
    const row = await dbGet('SELECT filename, filedata FROM pdfs WHERE id = ?', [req.params.id]);
    if (!row) {
      return res.status(404).json({ error: 'PDF not found' });
    }
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${row.filename}"`);
    res.send(row.filedata);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
