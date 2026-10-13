const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const { once } = require('node:events');
const { io: connect } = require('socket.io-client');
const jwt = require('jsonwebtoken');
process.env.DB_PATH = ':memory:';
process.env.PORT = '0';
process.env.JWT_SECRET = 'integration-test-secret';
process.env.JWT_SECRET_ADMIN = 'integration-admin-secret';
const { server } = require('../index');
const { getDB, dbGet, dbAll } = require('../db/database');
const clients = [];
let base;
after(async () => {
  for (const client of clients) client.disconnect();
  await new Promise(resolve => server.close(resolve));
  await new Promise((resolve, reject) => getDB().close(err => err ? reject(err) : resolve()));
});
async function request(path, method = 'GET', body, token) {
  const response = await fetch(`${base}/api${path}`, {
    method, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined
  });
  const data = await response.json();
  assert.equal(response.status, method === 'POST' && path === '/universities/register' ? 201 : 200, JSON.stringify(data));
  return data;
}
function event(socket, name) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error(`Timed out: ${name}`)), 5000);
    socket.once(name, data => { clearTimeout(timeout); resolve(data); });
  });
}
test('registration, classroom, reports, exams and socket materials remain functional', async t => {
  if (!server.listening) await once(server, 'listening');
  base = `http://127.0.0.1:${server.address().port}`;
  await t.test('health and fresh schema USN migration', async () => {
    assert.equal((await request('/health')).status, 'ok');
    const columns = await dbAll('PRAGMA table_info(students)');
    assert.ok(columns.some(column => column.name === 'usn'));
    const indexes = await dbAll('PRAGMA index_list(students)');
    assert.ok(indexes.some(index => index.name === 'students_usn_unique' && index.unique));
  });
  const uni = await request('/universities/register', 'POST', {
    name: 'Test University', code: 'TEST', admin_name: 'Admin', admin_email: 'admin@test.local', admin_password: 'test-password'
  });
  const admin = await request('/universities/login', 'POST', { code: 'TEST', admin_email: 'admin@test.local', password: 'test-password' });
  const teacher = await request('/auth/teacher/register', 'POST', { name: 'Teacher', email: 'teacher@test.local', password: 'test-password' });
  const student = await request('/auth/student/register', 'POST', {
    name: 'Student', email: 'student@test.local', password: 'test-password', roll_no: '1', class_section: 'A', university_code: 'TEST', usn: 'test001'
  });
  await t.test('USN login, duplicate rejection, configured signing secret', async () => {
    const login = await request('/auth/student/login', 'POST', { usn: 'test001', password: 'test-password' });
    assert.equal(login.user.id, student.user.id);
    assert.equal(jwt.verify(login.token, process.env.JWT_SECRET).role, 'student');
    const duplicate = await fetch(`${base}/api/auth/student/register`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: 'Duplicate', email: 'duplicate@test.local', password: 'test-password', roll_no: '2', class_section: 'A', university_code: 'TEST', usn: 'TEST001' }) });
    assert.equal(duplicate.status, 409);
  });
  const { room } = await request('/rooms/create', 'POST', { teacher_id: teacher.user.id, subject: 'JavaScript', class_name: 'A' });
  await request('/attendance/mark', 'POST', { student_id: student.user.id, room_id: room.id });
  await t.test('admin attendance report SQL and authentication', async () => {
    const report = await request(`/universities/${uni.university_id}/reports/attendance`, 'GET', undefined, admin.token);
    assert.ok(Array.isArray(report.monthly_trend));
    const response = await fetch(`${base}/api/universities/${uni.university_id}/stats`);
    assert.equal(response.status, 401);
    const wrongRole = jwt.sign({ role: 'student' }, process.env.JWT_SECRET_ADMIN);
    const denied = await fetch(`${base}/api/universities/${uni.university_id}/stats`, { headers: { Authorization: `Bearer ${wrongRole}` } });
    assert.equal(denied.status, 403);
  });
  await t.test('notes, MCQ grading and student profile history', async () => {
    await request('/notes/push', 'POST', { room_id: room.id, content: 'Test note' });
    const notes = await request(`/notes/student/${student.user.id}`);
    assert.equal(notes.notes.length, 1);
    const { exam } = await request('/exam/create', 'POST', { room_id: room.id, title: 'Quiz', questions: [{ type: 'mcq', text: '2 + 2?', options: ['3', '4'], correct_index: 1 }] });
    const grade = await request('/exam/submit', 'POST', { student_id: student.user.id, exam_id: exam.id, answers: { 0: 1 } });
    assert.equal(grade.percentage, 100);
    const badges = await request(`/badges/student/${student.user.id}`);
    assert.ok(badges.badges.some(badge => badge.badge_key === 'perfect_score'));
    assert.equal((await request(`/exam/student/${student.user.id}`)).history.length, 1);
  });
  const teacherSocket = connect(base, { transports: ['websocket'] });
  const studentSocket = connect(base, { transports: ['websocket'] });
  clients.push(teacherSocket, studentSocket);
  await Promise.all([event(teacherSocket, 'connect'), event(studentSocket, 'connect')]);
  for (const [socket, user] of [[teacherSocket, teacher.user], [studentSocket, student.user]]) {
    const joined = event(socket, 'room:joined');
    socket.emit('room:join', { room_code: room.code, user });
    await joined;
  }
  await t.test('exam launch broadcasts the persisted timestamp', async () => {
    const { exam } = await request('/exam/create', 'POST', { room_id: room.id, title: 'Live quiz', questions: [{ type: 'mcq', text: 'One?', correct_index: 0 }] });
    const launched = event(studentSocket, 'exam:launched');
    teacherSocket.emit('exam:launch', { room_code: room.code, exam });
    const received = await launched;
    assert.equal(received.exam.status, 'active');
    assert.ok(received.exam.launched_at);
    assert.equal(received.exam.launched_at, (await dbGet('SELECT launched_at FROM exams WHERE id = ?', [exam.id])).launched_at);
    assert.ok(Array.isArray(received.exam.questions));
  });
  await t.test('socket PDF delivery maps to student and downloads identical bytes', async () => {
    // Exceeds Socket.IO's old 1MB default limit.
    const bytes = Buffer.concat([Buffer.from('%PDF-1.4\n'), Buffer.alloc(1100000, 32)]);
    const received = event(studentSocket, 'pdf:receive');
    teacherSocket.emit('pdf:push', { room_code: room.code, room_id: room.id, filename: 'test.pdf', filedata: bytes.toString('base64') });
    const pdf = await received;
    const materials = await request(`/pdfs/student/${student.user.id}`);
    assert.ok(materials.pdfs.some(item => item.id === pdf.id));
    const response = await fetch(`${base}/api/pdfs/${pdf.id}/download`);
    assert.equal(response.status, 200);
    assert.deepEqual(Buffer.from(await response.arrayBuffer()), bytes);
  });
  await t.test('HTTP code submission plus socket notification saves once', async () => {
    const submission = { student_id: student.user.id, room_id: room.id, code: 'console.log(1)', language: 'javascript' };
    await request('/code/submit', 'POST', submission);
    const notification = event(teacherSocket, 'code:submitted');
    studentSocket.emit('code:submit', { room_code: room.code, student: student.user, ...submission });
    await notification;
    assert.equal((await dbGet('SELECT COUNT(*) AS count FROM code_submissions WHERE student_id = ?', [student.user.id])).count, 1);
  });
  await t.test('end session preserves attendance', async () => {
    await request(`/rooms/${room.code}/end`, 'PATCH');
    assert.equal((await dbGet('SELECT status FROM rooms WHERE id = ?', [room.id])).status, 'ended');
    assert.equal((await request(`/attendance/student/${student.user.id}`)).present, 1);
  });
});
