const fs = require('fs')
const os = require('os')
const path = require('path')
const request = require('supertest')
const { io: socketClient } = require('socket.io-client')

const mockUserDataPath = fs.mkdtempSync(path.join(os.tmpdir(), 'nexclass-auth-test-'))
global.__NEXCLASS_TEST_USER_DATA__ = mockUserDataPath
process.env.DB_PATH = path.join(mockUserDataPath, 'test.db')
process.env.JWT_SECRET = 'test-only-secret-with-enough-entropy'
process.env.PORT = '0'

jest.mock('electron', () => ({ app: { getPath: () => global.__NEXCLASS_TEST_USER_DATA__ } }))

const { createApp } = require('../app')
const { db } = require('../db/database')
const { startServer } = require('../index')
const app = createApp()

let hodToken
let teacherOne
let teacherTwo
let studentOne
let studentTwo
let roomCode
let runningServer

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
  if (runningServer) return runningServer.close().then(() => {
    db.close()
    fs.rmSync(mockUserDataPath, { recursive: true, force: true })
  })
  db.close()
  fs.rmSync(mockUserDataPath, { recursive: true, force: true })
})

test('protected HOD route rejects a missing token with 401', async () => {
  await request(app).get('/api/teachers').expect(401)
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
  runningServer = await startServer()
  const client = socketClient(`http://127.0.0.1:${runningServer.port}`, {
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
