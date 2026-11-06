const fs = require('fs')
const os = require('os')
const path = require('path')
const crypto = require('crypto')
const request = require('supertest')

const pair = crypto.generateKeyPairSync('ed25519')
const publicKey = pair.publicKey.export({ type: 'spki', format: 'pem' })
const privateKey = pair.privateKey.export({ type: 'pkcs8', format: 'pem' })
jest.doMock('../license/publicKeys', () => ({ k1: publicKey }))

const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'nexclass-license-test-'))
process.env.DATA_DIR = dataDir
process.env.JWT_SECRET = 'license-test-secret-with-entropy'
process.env.PORT = '0'
process.env.CODE_RUNNER = 'disabled'

const { db } = require('../db/database')
const { runMigrations } = require('../db/migrations')
const { createApp } = require('../app')
const licensing = require('../license/service')
const { canonicalize, verifyLicense } = require('../license/verify')
const { requireSeat } = require('../middleware/license')
const app = createApp().app
let hodToken

function signedLicense({ licenseId = 'NX-2026-0001', issuedAt = '2026-11-01T00:00:00.000Z', expiresAt = '2027-11-30T23:59:59.000Z', maxStudents = 500, maxTeachers = 40 } = {}) {
  const payload = { licenseId, college: 'Example College', plan: 'standard', maxStudents, maxTeachers, features: ['exams', 'codeRunner', 'ai'], issuedAt, expiresAt, keyId: 'k1' }
  const signature = crypto.sign(null, Buffer.from(canonicalize(payload)), privateKey).toString('base64')
  return { payload, signature }
}
function storeLicense(document) {
  db.prepare('UPDATE license SET raw_json=?, last_seen_at=? WHERE id=1').run(JSON.stringify(document), '2026-11-06T00:00:00.000Z')
}

beforeAll(async () => {
  await runMigrations(db, { dataDir })
  const setup = await request(app).post('/api/setup/hod').send({ name: 'Test HOD', employee_id: 'HOD-LICENSE', email: 'hod-license@example.test', department: 'Computer Science', password: 'Secure1234', confirm_password: 'Secure1234' }).expect(201)
  hodToken = setup.body.token
})
afterAll(() => { db.close(); fs.rmSync(dataDir, { recursive: true, force: true }) })

test('Ed25519 license verifies, edited payload fails, and a different public key fails', () => {
  const valid = signedLicense()
  expect(verifyLicense(valid, { k1: publicKey }).ok).toBe(true)
  expect(verifyLicense({ ...valid, payload: { ...valid.payload, college: 'Tampered College' } }, { k1: publicKey })).toMatchObject({ ok: false, reason: 'bad_signature' })
  const other = crypto.generateKeyPairSync('ed25519').publicKey.export({ type: 'spki', format: 'pem' })
  expect(verifyLicense(valid, { k1: other })).toMatchObject({ ok: false, reason: 'bad_signature' })
  expect(verifyLicense(valid, {})).toMatchObject({ ok: false, reason: 'unknown_key' })
})

test('license state machine returns trial, licensed, grace, and expired', () => {
  const now = Date.parse('2026-11-06T00:00:00.000Z')
  db.prepare('UPDATE license SET raw_json=NULL, first_run_at=?, last_seen_at=? WHERE id=1').run(new Date(now).toISOString(), new Date(now).toISOString())
  expect(licensing.getStatus({ now, persist: false }).state).toBe('trial')
  storeLicense(signedLicense({ expiresAt: '2026-11-06T00:00:00.000Z' }))
  expect(licensing.getStatus({ now, persist: false }).state).toBe('licensed')
  expect(licensing.getStatus({ now: Date.parse('2026-11-10T00:00:00.000Z'), persist: false }).state).toBe('grace')
  expect(licensing.getStatus({ now: Date.parse('2026-11-22T00:00:00.000Z'), persist: false }).state).toBe('expired')
})

test('trial defaults to 30 student and 3 approved teacher seats', () => {
  db.prepare('UPDATE license SET raw_json=NULL, first_run_at=?, last_seen_at=? WHERE id=1').run(new Date().toISOString(), new Date().toISOString())
  const status = licensing.publicStatus()
  expect(status.seats.students.max).toBe(30)
  expect(status.seats.teachers.max).toBe(3)
  expect(status.features).toEqual(expect.arrayContaining(['exams', 'codeRunner', 'ai']))
})

test('seat checks block registration when the 501st student or 41st teacher would be added', () => {
  const status = jest.spyOn(licensing, 'getStatus').mockReturnValue({ state: 'licensed', maxStudents: 500, maxTeachers: 40, features: [] })
  const count = jest.spyOn(licensing, 'counts').mockReturnValue({ students: 500, teachers: 40 })
  for (const role of ['student', 'teacher']) {
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn() }
    const next = jest.fn()
    requireSeat(role)({}, res, next)
    expect(res.status).toHaveBeenCalledWith(403)
    expect(res.json.mock.calls[0][0].code).toBe('LICENSE_LIMIT')
    expect(next).not.toHaveBeenCalled()
  }
  status.mockRestore(); count.mockRestore()
})

test('expired license blocks room creation but still allows login and viewing data', async () => {
  await request(app).post('/api/auth/teacher/register').send({ name: 'Teacher License', employee_id: 'T-LICENSE', email: 't-license@example.test', password: 'Teacher123', subject: 'Testing', semester: 3 }).expect(201)
  const teacherId = db.prepare('SELECT id FROM teachers WHERE employee_id=?').get('T-LICENSE').id
  await request(app).patch(`/api/teachers/${teacherId}/approve`).set('Authorization', `Bearer ${hodToken}`).send({}).expect(200)
  const login = await request(app).post('/api/auth/teacher/login').send({ employee_id: 'T-LICENSE', password: 'Teacher123' }).expect(200)
  db.prepare('UPDATE license SET raw_json=?, last_seen_at=? WHERE id=1').run('{"payload":{},"signature":"bad"}', new Date().toISOString())
  const roomAttempt = await request(app).post('/api/rooms').set('Authorization', `Bearer ${login.body.token}`).send({ subject: 'New room', semester: 3 }).expect(403)
  expect(roomAttempt.body.code).toBe('LICENSE_EXPIRED')
  await request(app).post('/api/auth/hod/login').send({ employee_id: 'HOD-LICENSE', password: 'Secure1234' }).expect(200)
  await request(app).get('/api/students').set('Authorization', `Bearer ${hodToken}`).expect(200)
})

test('activation rejects a license older than the stored license', async () => {
  db.prepare('UPDATE license SET raw_json=NULL, last_seen_at=? WHERE id=1').run(new Date().toISOString())
  const current = signedLicense({ issuedAt: '2026-11-05T00:00:00.000Z' })
  await request(app).post('/api/license/activate').set('Authorization', `Bearer ${hodToken}`).send({ license: JSON.stringify(current) }).expect(200)
  const older = signedLicense({ licenseId: 'NX-2026-0002', issuedAt: '2026-10-05T00:00:00.000Z' })
  const result = await request(app).post('/api/license/activate').set('Authorization', `Bearer ${hodToken}`).send({ license: JSON.stringify(older) }).expect(409)
  expect(result.body.error).toMatch(/older than the license/)
})

test('clock rollback over 24 hours uses last_seen_at to keep the license from reverting', () => {
  const payload = signedLicense({ expiresAt: '2026-11-01T00:00:00.000Z' })
  db.prepare('UPDATE license SET raw_json=?, last_seen_at=? WHERE id=1').run(JSON.stringify(payload), '2026-11-10T00:00:00.000Z')
  const status = licensing.getStatus({ now: Date.parse('2026-10-30T00:00:00.000Z'), persist: false })
  expect(status.state).toBe('grace')
  expect(status.effectiveNow).toBe(Date.parse('2026-11-10T00:00:00.000Z'))
})

test('license response never contains the stored signature', async () => {
  const response = await request(app).get('/api/license').set('Authorization', `Bearer ${hodToken}`).expect(200)
  expect(response.body).not.toHaveProperty('signature')
  expect(response.body).not.toHaveProperty('raw_json')
})

test('server sources do not reference a private key path', () => {
  const serverDir = path.resolve(__dirname, '..')
  const files = []
  const walk = dir => fs.readdirSync(dir, { withFileTypes: true }).forEach(entry => {
    if (entry.name === 'node_modules') return
    const filename = path.join(dir, entry.name)
    if (entry.isDirectory()) walk(filename)
    else if (filename.endsWith('.js')) files.push(filename)
  })
  walk(serverDir)
  const references = files.filter(file => file !== __filename && /\.private\.pem|private key file/i.test(fs.readFileSync(file, 'utf8')))
  expect(references).toEqual([])
})
