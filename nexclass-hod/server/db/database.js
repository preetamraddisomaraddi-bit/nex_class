const path = require('path')
const crypto = require('crypto')
const Database = require('better-sqlite3')
const bcrypt = require('bcryptjs')
const { app } = require('electron')

const userDataPath = app.getPath('userData')
const DB_PATH = process.env.NEXCLASS_DB_PATH || path.join(userDataPath, 'nexclass-hod.db')
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

const existingHOD = db.prepare('SELECT id FROM hod WHERE id = 1').get()
if (!existingHOD) {
  const passwordHash = bcrypt.hashSync('hod123', 12)
  db.prepare(`INSERT INTO hod
    (id, name, employee_id, department, department_code, university, email, password_hash)
    VALUES (1, ?, ?, ?, ?, ?, ?, ?)`)
    .run('Dr. Rajesh Kumar', 'BIT-HOD-001', 'Computer Science & Engineering', 'CSE',
      'Bangalore Institute of Technology', 'hod.cse@nexclass.demo', passwordHash)
  console.log('Default NexClass HOD account seeded (BIT-HOD-001)')
}

let jwtSecret = process.env.NEXCLASS_JWT_SECRET
if (!jwtSecret) {
  const secretPath = path.join(userDataPath, 'nexclass-jwt-secret')
  try {
    jwtSecret = require('fs').readFileSync(secretPath, 'utf8')
  } catch {
    jwtSecret = crypto.randomBytes(48).toString('hex')
    require('fs').writeFileSync(secretPath, jwtSecret, { mode: 0o600, flag: 'wx' })
  }
}

const dbGet = (sql, params = []) => db.prepare(sql).get(...params)
const dbAll = (sql, params = []) => db.prepare(sql).all(...params)
const dbRun = (sql, params = []) => db.prepare(sql).run(...params)

module.exports = { db, dbGet, dbAll, dbRun, jwtSecret, DB_PATH }
