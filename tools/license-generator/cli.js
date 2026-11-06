#!/usr/bin/env node
const fs = require('fs')
const path = require('path')
const crypto = require('crypto')

const root = __dirname
const keysDir = path.join(root, 'keys')
const outDir = path.join(root, 'out')
const canonicalize = value => Array.isArray(value) ? `[${value.map(canonicalize).join(',')}]` : value && typeof value === 'object' ? `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${canonicalize(value[key])}`).join(',')}}` : JSON.stringify(value)
function args(argv) {
  const result = { _: [] }
  for (let index = 0; index < argv.length; index++) {
    const item = argv[index]
    if (!item.startsWith('--')) result._.push(item)
    else result[item.slice(2)] = argv[++index]
  }
  return result
}
function csv(value) { const text = String(value ?? ''); return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text }
function validPayload(payload) {
  return payload && typeof payload.licenseId === 'string' && typeof payload.college === 'string' && typeof payload.plan === 'string' &&
    Number.isSafeInteger(payload.maxStudents) && payload.maxStudents >= 0 && Number.isSafeInteger(payload.maxTeachers) && payload.maxTeachers >= 0 &&
    Array.isArray(payload.features) && payload.features.every(feature => ['exams', 'codeRunner', 'ai'].includes(feature)) &&
    Number.isFinite(Date.parse(payload.issuedAt)) && Number.isFinite(Date.parse(payload.expiresAt)) && Date.parse(payload.expiresAt) >= Date.parse(payload.issuedAt) &&
    typeof payload.keyId === 'string'
}
function keygen(options) {
  const id = options.id
  if (!id || !/^[A-Za-z0-9_-]{1,40}$/.test(id)) throw new Error('Provide a valid key id with --id (letters, numbers, underscore, hyphen).')
  fs.mkdirSync(keysDir, { recursive: true })
  const privatePath = path.join(keysDir, `${id}.private.pem`)
  const publicPath = path.join(keysDir, `${id}.public.pem`)
  if (fs.existsSync(privatePath) || fs.existsSync(publicPath)) throw new Error(`Key files already exist for ${id}; refusing to overwrite.`)
  const pair = crypto.generateKeyPairSync('ed25519')
  fs.writeFileSync(privatePath, pair.privateKey.export({ type: 'pkcs8', format: 'pem' }), { mode: 0o600, flag: 'wx' })
  fs.writeFileSync(publicPath, pair.publicKey.export({ type: 'spki', format: 'pem' }), { flag: 'wx' })
  console.log(`Created ${privatePath}\nCreated ${publicPath}\n\nPaste this public key into the server license publicKeys.js under key id ${id}:\n${fs.readFileSync(publicPath, 'utf8')}`)
}
function issue(options) {
  const college = String(options.college || '').trim()
  const students = Number(options.students)
  const teachers = Number(options.teachers)
  const expires = String(options.expires || '')
  const plan = String(options.plan || 'standard')
  const features = String(options.features || '').split(',').map(item => item.trim()).filter(Boolean)
  const keyId = String(options.key || options['key-id'] || 'k1')
  const expiry = /^\d{4}-\d{2}-\d{2}$/.test(expires) ? new Date(`${expires}T23:59:59.000Z`) : new Date(NaN)
  if (!college || !Number.isSafeInteger(students) || students < 1 || !Number.isSafeInteger(teachers) || teachers < 1 || !Number.isFinite(expiry.getTime()) || expiry.toISOString().slice(0, 10) !== expires || !features.every(feature => ['exams', 'codeRunner', 'ai'].includes(feature))) throw new Error('Usage: issue --college "..." --students 500 --teachers 40 --expires YYYY-MM-DD --features exams,codeRunner,ai [--plan standard] [--key k1]')
  const privatePath = path.join(keysDir, `${keyId}.private.pem`)
  if (!fs.existsSync(privatePath)) throw new Error(`Signing key not found: ${privatePath}`)
  fs.mkdirSync(outDir, { recursive: true })
  const csvPath = path.join(outDir, 'issued.csv')
  let sequence = 1
  if (fs.existsSync(csvPath)) {
    const matches = fs.readFileSync(csvPath, 'utf8').matchAll(/NX-(\d{4})-(\d+)/g)
    for (const match of matches) if (Number(match[1]) === new Date().getUTCFullYear()) sequence = Math.max(sequence, Number(match[2]) + 1)
  }
  const year = new Date().getUTCFullYear()
  const licenseId = `NX-${year}-${String(sequence).padStart(4, '0')}`
  const payload = { licenseId, college, plan, maxStudents: students, maxTeachers: teachers, features, issuedAt: new Date().toISOString(), expiresAt: expiry.toISOString(), keyId }
  const signature = crypto.sign(null, Buffer.from(canonicalize(payload)), fs.readFileSync(privatePath)).toString('base64')
  const content = `${JSON.stringify({ payload, signature }, null, 2)}\n`
  fs.writeFileSync(path.join(outDir, `${licenseId}.nexlicense`), content, { flag: 'wx' })
  if (!fs.existsSync(csvPath)) fs.writeFileSync(csvPath, 'id,college,seats,expiry,issued date\n')
  fs.appendFileSync(csvPath, [licenseId, college, `${students} students / ${teachers} teachers`, expires, payload.issuedAt.slice(0, 10)].map(csv).join(',') + '\n')
  console.log(`Issued ${licenseId}: ${path.join(outDir, `${licenseId}.nexlicense`)}`)
}
function verify(file) {
  const document = JSON.parse(fs.readFileSync(path.resolve(file), 'utf8'))
  const publicPath = path.join(keysDir, `${document.payload?.keyId}.public.pem`)
  if (!validPayload(document.payload) || typeof document.signature !== 'string' || !fs.existsSync(publicPath)) throw new Error('Malformed license or matching public key not found.')
  const valid = crypto.verify(null, Buffer.from(canonicalize(document.payload)), fs.readFileSync(publicPath), Buffer.from(document.signature, 'base64'))
  const active = Date.now() <= Date.parse(document.payload.expiresAt)
  console.log(valid ? `VALID SIGNATURE · ${active ? 'not expired' : 'expired'}` : 'INVALID SIGNATURE')
  console.log(JSON.stringify(document.payload, null, 2))
  if (!valid) process.exitCode = 1
}
try {
  const [command, ...rest] = process.argv.slice(2)
  const options = args(rest)
  if (command === 'keygen') keygen(options)
  else if (command === 'issue') issue(options)
  else if (command === 'verify' && options._[0]) verify(options._[0])
  else throw new Error('Commands: keygen --id k1 | issue --college ... | verify <file>')
} catch (error) { console.error(error.message); process.exitCode = 1 }
