const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const sqlite3 = require('sqlite3');

test('migrate an existing database twice without losing students', async () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'nexclass-migration-'));
  const filename = path.join(directory, 'existing.db');
  const db = new sqlite3.Database(filename);
  try {
    await new Promise((resolve, reject) => db.exec(fs.readFileSync(path.join(__dirname, '../db/schema.sql'), 'utf8'), error => error ? reject(error) : resolve()));
    await new Promise((resolve, reject) => db.run("INSERT INTO students(name, roll_no, class_section, email, password_hash) VALUES ('Existing', '1', 'A', 'existing@test.local', 'hash')", error => error ? reject(error) : resolve()));
    await new Promise((resolve, reject) => db.close(error => error ? reject(error) : resolve()));
    const script = `
      const assert = require('node:assert/strict');
      const { dbGet, dbRun, getDB } = require('./db/database');
      (async () => {
        assert.equal((await dbGet('SELECT COUNT(*) AS count FROM students')).count, 1);
        await dbRun("UPDATE students SET usn = 'EXIST001' WHERE email = 'existing@test.local'");
        assert.equal((await dbGet("SELECT usn FROM students WHERE email = 'existing@test.local'")).usn, 'EXIST001');
        await new Promise((resolve, reject) => getDB().close(err => err ? reject(err) : resolve()));
      })().catch(err => { console.error(err); process.exit(1); });
    `;
    for (let i = 0; i < 2; i++) {
      const result = spawnSync(process.execPath, ['-e', script], { cwd: path.join(__dirname, '..'), env: { ...process.env, DB_PATH: filename }, encoding: 'utf8', timeout: 10000 });
      assert.equal(result.status, 0, result.stderr);
      assert.equal(result.stderr, '');
    }
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});
