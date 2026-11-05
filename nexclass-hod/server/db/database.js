const Database = require('better-sqlite3')
const { DB_PATH, JWT_SECRET } = require('../config')
const db = new Database(DB_PATH)

db.pragma('journal_mode = WAL')
db.pragma('foreign_keys = ON')

db.exec(`
  CREATE TABLE IF NOT EXISTS hod (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    employee_id TEXT UNIQUE NOT NULL,
    department TEXT NOT NULL,
    department_code TEXT NOT NULL,
    university TEXT NOT NULL,
    email TEXT NOT NULL,
    password_hash TEXT NOT NULL,
    auth_version INTEGER NOT NULL DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS teachers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    employee_id TEXT UNIQUE NOT NULL,
    email TEXT NOT NULL DEFAULT '',
    password_hash TEXT NOT NULL,
    subject TEXT DEFAULT '', semester INTEGER,
    status TEXT NOT NULL DEFAULT 'pending',
    total_classes INTEGER NOT NULL DEFAULT 0,
    last_active DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS students (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL, usn TEXT UNIQUE NOT NULL,
    email TEXT DEFAULT '', password_hash TEXT NOT NULL,
    semester INTEGER, created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS rooms (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    code TEXT UNIQUE NOT NULL, subject TEXT NOT NULL,
    teacher_id INTEGER REFERENCES teachers(id) ON DELETE SET NULL,
    semester INTEGER, status TEXT NOT NULL DEFAULT 'active',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP, ended_at DATETIME
  );
  CREATE TABLE IF NOT EXISTS attendance (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    student_id INTEGER REFERENCES students(id) ON DELETE CASCADE,
    room_id INTEGER REFERENCES rooms(id) ON DELETE CASCADE,
    status TEXT NOT NULL DEFAULT 'present',
    joined_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(student_id, room_id)
  );
  CREATE TABLE IF NOT EXISTS notes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    room_id INTEGER REFERENCES rooms(id) ON DELETE CASCADE,
    content TEXT NOT NULL, pushed_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS exams (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    room_id INTEGER REFERENCES rooms(id) ON DELETE CASCADE,
    title TEXT NOT NULL, duration_mins INTEGER NOT NULL DEFAULT 30,
    questions_json TEXT DEFAULT '[]', launched_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS exam_scores (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    student_id INTEGER REFERENCES students(id) ON DELETE CASCADE,
    exam_id INTEGER REFERENCES exams(id) ON DELETE CASCADE,
    score INTEGER NOT NULL DEFAULT 0, total INTEGER NOT NULL DEFAULT 100,
    answers_json TEXT DEFAULT '[]', submitted_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(student_id, exam_id)
  );
  CREATE TABLE IF NOT EXISTS code_submissions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    student_id INTEGER REFERENCES students(id) ON DELETE CASCADE,
    room_id INTEGER REFERENCES rooms(id) ON DELETE CASCADE,
    code TEXT DEFAULT '', language TEXT DEFAULT '', output TEXT DEFAULT '',
    submitted_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS alerts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    teacher_id INTEGER REFERENCES teachers(id) ON DELETE CASCADE,
    message TEXT NOT NULL, type TEXT NOT NULL DEFAULT 'reminder',
    sent_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`)

try { db.exec('ALTER TABLE hod ADD COLUMN auth_version INTEGER NOT NULL DEFAULT 1') }
catch (error) {
  if (!String(error.message).includes('duplicate column')) throw error
}

// Remove the exact original demo identity so upgrades also require first-run
// setup instead of keeping the old seeded login active.
const legacyDefaultHod = db.prepare('SELECT id,employee_id,email FROM hod WHERE id=1').get()
if (legacyDefaultHod && legacyDefaultHod.employee_id === 'BIT-HOD-001' &&
    legacyDefaultHod.email === 'hod.cse@nexclass.demo') {
  db.prepare('DELETE FROM hod WHERE id=1').run()
  console.log('Removed the legacy default HOD account; department setup is required.')
}

const dbGet = (sql, params = []) => db.prepare(sql).get(...params)
const dbAll = (sql, params = []) => db.prepare(sql).all(...params)
const dbRun = (sql, params = []) => db.prepare(sql).run(...params)

module.exports = { db, dbGet, dbAll, dbRun, jwtSecret: JWT_SECRET, DB_PATH }
