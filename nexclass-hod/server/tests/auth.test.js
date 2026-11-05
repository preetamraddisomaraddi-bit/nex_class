const fs = require('fs')
const os = require('os')
const path = require('path')
const request = require('supertest')
const { io: socketClient } = require('socket.io-client')
const Database = require('better-sqlite3')

const mockUserDataPath = fs.mkdtempSync(path.join(os.tmpdir(), 'nexclass-auth-test-'))
process.env.DATA_DIR = mockUserDataPath
process.env.JWT_SECRET = 'test-only-secret-with-enough-entropy'
process.env.PORT = '0'

const { createApp } = require('../app')
const { db } = require('../db/database')
const { runMigrations } = require('../db/migrations')
const { authLimiter } = require('../rateLimits')
const { toCSV } = require('../../shared/csv')
let app

let hodToken
let teacherOne
let teacherTwo
let studentOne
let studentTwo
let roomCode
let runningServer

beforeAll(async () => {
  await runMigrations(db, { dataDir: mockUserDataPath })
  const service = createApp()
  app = service.app
  app.set('trust proxy', 1)
  runningServer = service.httpServer
})

const registerTeacher = async (employeeId, semester = 3) => {
  await request(app).post('/api/auth/teacher/register').send({
    name: `Teacher ${employeeId}`, employee_id: employeeId,
    email: `${employeeId.toLowerCase()}@example.test`, password: 'Teacher123', subject: 'Testing', semester,
  }).expect(201)
  const row = db.prepare('SELECT id FROM teachers WHERE employee_id=?').get(employeeId)
  await request(app).patch(`/api/teachers/${row.id}/approve`).set('Authorization', `Bearer ${hodToken}`).expect(200)
  const login = await request(app).post('/api/auth/teacher/login').send({ employee_id: employeeId, password: 'Teacher123' }).expect(200)
  return { id: row.id, token: login.body.token }
}

const registerStudent = async (usn, semester = 3) => {
  await request(app).post('/api/auth/student/register').send({
    name: `Student ${usn}`, usn, email: `${usn.toLowerCase()}@example.test`, password: 'Student123', semester,
  }).expect(201)
  const row = db.prepare('SELECT id FROM students WHERE usn=?').get(usn)
  const login = await request(app).post('/api/auth/student/login').send({ usn, password: 'Student123' }).expect(200)
  return { id: row.id, token: login.body.token }
}

afterAll(() => {
  if (runningServer?.listening) return new Promise(resolve => runningServer.close(resolve)).then(() => {
    db.close()
    fs.rmSync(mockUserDataPath, { recursive: true, force: true })
  })
  db.close()
  fs.rmSync(mockUserDataPath, { recursive: true, force: true })
})

test('protected HOD route rejects a missing token with 401', async () => {
  await request(app).get('/api/teachers').expect(401)
})

test('createApp can be started without the desktop shell and health reports version and schema version', async () => {
  expect(runningServer.listening).toBe(false)
  const response = await request(app).get('/api/health').expect(200)
  expect(response.body).toMatchObject({ status: 'ok', dbOk: true, schemaVersion: 2, connectedSockets: 0 })
  expect(response.body.version).toBe(require('../package.json').version)
  expect(typeof response.body.uptime).toBe('number')
})

test('fresh data directory runs migrations once', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'nexclass-migrations-fresh-'))
  const freshDb = new Database(path.join(dir, 'fresh.db'))
  try {
    expect(await runMigrations(freshDb, { dataDir: dir })).toBe(2)
    expect(await runMigrations(freshDb, { dataDir: dir })).toBe(2)
    expect(freshDb.prepare('SELECT COUNT(*) AS n FROM schema_migrations').get().n).toBe(2)
  } finally { freshDb.close(); fs.rmSync(dir, { recursive: true, force: true }) }
})

test('old database without migration table upgrades and preserves records', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'nexclass-migrations-old-'))
  const oldDbPath = path.join(dir, 'old.db')
  const oldDb = new Database(oldDbPath)
  try {
    require('../db/migrations/001_initial').up(oldDb)
    oldDb.prepare("INSERT INTO students(name,usn,password_hash) VALUES(?,?,?)").run('Legacy student', 'LEGACY-1', 'hash')
    for (const table of ['hod', 'teachers', 'students']) {
      oldDb.exec(`ALTER TABLE ${table} DROP COLUMN failed_attempts`)
      oldDb.exec(`ALTER TABLE ${table} DROP COLUMN locked_until`)
    }
    oldDb.exec('DROP TABLE audit_log')
    expect(await runMigrations(oldDb, { dataDir: dir })).toBe(2)
    expect(oldDb.prepare('SELECT name FROM students WHERE usn=?').get('LEGACY-1').name).toBe('Legacy student')
    expect(oldDb.prepare('SELECT COUNT(*) AS n FROM audit_log').get().n).toBe(0)
    expect(fs.readdirSync(path.join(dir, 'backups')).some(name => name.startsWith('pre-migration-2-'))).toBe(true)
  } finally { oldDb.close(); fs.rmSync(dir, { recursive: true, force: true }) }
})

test('first HOD setup succeeds once and then returns 409', async () => {
  const setup = {
    name: 'Test HOD', employee_id: 'HOD-TEST-1', email: 'hod@example.test',
    department: 'Computer Science', password: 'Secure1234', confirm_password: 'Secure1234',
  }
  const created = await request(app).post('/api/setup/hod').send(setup).expect(201)
  hodToken = created.body.token
  expect(created.body.hod.password_hash).toBeUndefined()
  await request(app).post('/api/setup/hod').send(setup).expect(409)
})

test('Socket.IO rejects connections without an authenticated token', async () => {
  await new Promise(resolve => runningServer.listen(0, '127.0.0.1', resolve))
  const client = socketClient(`http://127.0.0.1:${runningServer.address().port}`, {
    transports: ['websocket'],
    reconnection: false,
    timeout: 3000,
  })
  const error = await new Promise(resolve => client.once('connect_error', resolve))
  client.disconnect()
  expect(error.message).toBe('Authentication failed')
})

test('student token cannot access the HOD teacher list', async () => {
  studentOne = await registerStudent('USN-TEST-1')
  await request(app).get('/api/teachers').set('Authorization', `Bearer ${studentOne.token}`).expect(403)
})

test('teacher cannot end a room owned by another teacher', async () => {
  teacherOne = await registerTeacher('T-TEST-1')
  teacherTwo = await registerTeacher('T-TEST-2')
  const room = await request(app).post('/api/rooms').set('Authorization', `Bearer ${teacherOne.token}`).send({ subject: 'Testing', semester: 3, teacher_id: teacherTwo.id }).expect(201)
  roomCode = room.body.code
  await request(app).patch(`/api/rooms/${roomCode}/end`).set('Authorization', `Bearer ${teacherTwo.token}`).send({ teacher_id: teacherOne.id }).expect(403)
  expect(db.prepare('SELECT status FROM rooms WHERE code=?').get(roomCode).status).toBe('active')
})

test('student cannot mark attendance for another student', async () => {
  studentTwo = await registerStudent('USN-TEST-2')
  const room = db.prepare('SELECT id FROM rooms WHERE code=?').get(roomCode)
  await request(app).post('/api/attendance').set('Authorization', `Bearer ${studentOne.token}`).send({ room_id: room.id, student_id: studentTwo.id, status: 'present' }).expect(403)
  expect(db.prepare('SELECT id FROM attendance WHERE student_id=? AND room_id=?').get(studentTwo.id, room.id)).toBeUndefined()
})

test('invalid registration payload returns field-level validation details', async () => {
  const response = await request(app).post('/api/auth/teacher/register').set('X-Forwarded-For', '10.10.10.10').send({
    name: 'x', employee_id: 'bad id', email: 'not-an-email', password: 'short', subject: 'S'.repeat(81), semester: 9, ignored: 'drop me',
  }).expect(400)
  expect(response.body.error).toBe('Validation failed')
  expect(response.body.details.length).toBeGreaterThanOrEqual(5)
  expect(response.body.details.map(item => item.field)).toEqual(expect.arrayContaining(['name', 'employee_id', 'email', 'password', 'subject', 'semester']))
})

test('the eleventh authentication request from an IP is rate limited', async () => {
  const clientIp = '10.10.10.11'
  authLimiter.resetKey(clientIp)
  for (let attempt = 1; attempt <= 10; attempt++) {
    await request(app).post('/api/auth/hod/login').set('X-Forwarded-For', clientIp).send({ employee_id: `NO-HOD-${attempt}`, password: 'Wrong123' }).expect(401)
  }
  await request(app).post('/api/auth/hod/login').set('X-Forwarded-For', clientIp).send({ employee_id: 'NO-HOD-LAST', password: 'Wrong123' }).expect(429)
})

test('five wrong passwords lock an existing account for fifteen minutes', async () => {
  const hod = db.prepare('SELECT employee_id FROM hod WHERE id=1').get()
  expect(hod).toBeTruthy()
  const clientIp = '10.10.10.12'
  authLimiter.resetKey(clientIp)
  for (let attempt = 1; attempt < 5; attempt++) {
    await request(app).post('/api/auth/hod/login').set('X-Forwarded-For', clientIp).send({ employee_id: hod.employee_id, password: 'Wrong123' }).expect(401)
  }
  await request(app).post('/api/auth/hod/login').set('X-Forwarded-For', clientIp).send({ employee_id: hod.employee_id, password: 'Wrong123' }).expect(429)
  const locked = db.prepare('SELECT failed_attempts,locked_until FROM hod WHERE id=1').get()
  expect(locked.failed_attempts).toBe(0)
  expect(Date.parse(`${locked.locked_until.replace(' ', 'T')}Z`)).toBeGreaterThan(Date.now())
})

test('default JSON body limit returns 413 for oversized payloads', async () => {
  const response = await request(app).post('/api/rooms').set('Authorization', `Bearer ${teacherOne.token}`).send({ subject: 'S'.repeat(110 * 1024), semester: 3 }).expect(413)
  expect(response.body.error).toBe('Payload too large')
})

test('teacher approval writes an audit entry', async () => {
  const teacher = db.prepare('SELECT id FROM teachers WHERE employee_id=?').get('T-TEST-1')
  await request(app).patch(`/api/teachers/${teacher.id}/approve`).set('Authorization', `Bearer ${hodToken}`).expect(200)
  const entry = db.prepare("SELECT actor_role,action,target FROM audit_log WHERE action='teacher_approve' ORDER BY id DESC LIMIT 1").get()
  expect(entry).toMatchObject({ actor_role: 'hod', action: 'teacher_approve', target: `teacher:${teacher.id}` })
})

test('CSV export neutralizes formula cells', () => {
  expect(toCSV(['value'], [{ value: '=1+1' }])).toBe("value\r\n'=1+1")
})
