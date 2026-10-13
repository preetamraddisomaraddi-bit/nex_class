const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');
const path = require('path');

const DB_PATH = process.env.DB_PATH || path.join(__dirname, 'edusync.db');
const SCHEMA_PATH = path.join(__dirname, 'schema.sql');

let db;

function getDB() {
  if (!db) {
    db = new sqlite3.Database(DB_PATH, (err) => {
      if (err) console.error('[DB] Error opening database:', err);
      else console.log('[DB] SQLite connected ->', DB_PATH);
    });
    db.serialize(() => {
      db.run('PRAGMA journal_mode = WAL');
      db.run('PRAGMA foreign_keys = ON');
      const schema = fs.readFileSync(SCHEMA_PATH, 'utf8');
      schema.split(';').forEach(stmt => {
        const s = stmt.trim();
        if (s) db.run(s + ';');
      });
      runMigrations(db);
    });
  }
  return db;
}

function runMigrations(dbInstance) {
  const newTables = [
    `CREATE TABLE IF NOT EXISTS universities (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      code TEXT UNIQUE NOT NULL,
      type TEXT,
      address TEXT,
      phone TEXT,
      website TEXT,
      logo_url TEXT,
      admin_name TEXT NOT NULL,
      admin_email TEXT UNIQUE NOT NULL,
      admin_password_hash TEXT NOT NULL,
      admin_staff_id TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS departments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      university_id INTEGER REFERENCES universities(id),
      name TEXT NOT NULL,
      code TEXT NOT NULL,
      hod_name TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS semesters (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      department_id INTEGER REFERENCES departments(id),
      university_id INTEGER REFERENCES universities(id),
      number INTEGER NOT NULL,
      academic_year TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS semester_teachers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      semester_id INTEGER REFERENCES semesters(id),
      teacher_id INTEGER REFERENCES teachers(id)
    )`
  ];

  newTables.forEach(query => {
    dbInstance.run(query, (err) => {
      if (err) console.error('[Migration] Error creating table:', err.message);
    });
  });

  const alterStatements = [
    "ALTER TABLE teachers ADD COLUMN university_id INTEGER REFERENCES universities(id)",
    "ALTER TABLE teachers ADD COLUMN department_id INTEGER REFERENCES departments(id)",
    "ALTER TABLE teachers ADD COLUMN employee_id TEXT",
    "ALTER TABLE teachers ADD COLUMN status TEXT DEFAULT 'pending'",

    "ALTER TABLE students ADD COLUMN university_id INTEGER REFERENCES universities(id)",
    "ALTER TABLE students ADD COLUMN department_id INTEGER REFERENCES departments(id)",
    "ALTER TABLE students ADD COLUMN semester_id INTEGER REFERENCES semesters(id)",
    "ALTER TABLE students ADD COLUMN usn TEXT",

    "ALTER TABLE rooms ADD COLUMN university_id INTEGER REFERENCES universities(id)",
    "ALTER TABLE rooms ADD COLUMN department_id INTEGER REFERENCES departments(id)",
    "ALTER TABLE rooms ADD COLUMN semester_id INTEGER REFERENCES semesters(id)"
  ];

  alterStatements.forEach(stmt => {
    dbInstance.run(stmt, (err) => {
      if (err) {
        if (err.message.includes('duplicate column name') || err.message.includes('already exists')) {
          // Column already exists, ignore
        } else {
          console.error(`[Migration] Error running: ${stmt}`, err.message);
        }
      }
    });
  });
  // SQLite cannot ADD COLUMN with a UNIQUE constraint. A separate index
  // preserves uniqueness and allows migration of existing installations.
  dbInstance.run('CREATE UNIQUE INDEX IF NOT EXISTS students_usn_unique ON students(usn)', (err) => {
    if (err) console.error('[Migration] USN index error:', err.message);
  });
}

function dbGet(sql, params) {
  if (!params) params = [];
  return new Promise(function(resolve, reject) {
    getDB().get(sql, params, function(err, row) {
      if (err) reject(err);
      else resolve(row);
    });
  });
}

function dbAll(sql, params) {
  if (!params) params = [];
  return new Promise(function(resolve, reject) {
    getDB().all(sql, params, function(err, rows) {
      if (err) reject(err);
      else resolve(rows);
    });
  });
}

function dbRun(sql, params) {
  if (!params) params = [];
  return new Promise(function(resolve, reject) {
    getDB().run(sql, params, function(err) {
      if (err) reject(err);
      else resolve({ lastID: this.lastID, changes: this.changes });
    });
  });
}

module.exports = { getDB, dbGet, dbAll, dbRun };