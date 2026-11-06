const disabled = require('./runners/disabled')
const judge0 = require('./runners/judge0')
const LANGUAGES = Object.keys(judge0.LANGUAGE_IDS)
const LIMITS = Object.freeze({ cpuTimeMs: 5000, wallTimeMs: 10000, memoryKb: 128 * 1024, outputBytes: 64 * 1024 })
const BUSY_MESSAGE = 'Code runner is busy, try again'
const USER_LIMIT_MESSAGE = 'Code execution limit reached. Try again in a minute.'
const userRuns = new Map()
let active = 0
const queue = []
const runnerName = () => process.env.CODE_RUNNER === 'judge0' ? 'judge0' : 'disabled'
const getRunner = () => runnerName() === 'judge0' ? judge0 : disabled
function status() { const runner = runnerName(); return { enabled: runner === 'judge0' && Boolean(process.env.JUDGE0_URL), runner, languages: LANGUAGES } }
function takeUserRun(key, now = Date.now()) {
  const recent = (userRuns.get(String(key)) || []).filter(ts => now - ts < 60000)
  if (recent.length >= 10) return false
  recent.push(now); userRuns.set(String(key), recent)
  if (userRuns.size > 10000) for (const [id, values] of userRuns) if (!values.some(ts => now - ts < 60000)) userRuns.delete(id)
  return true
}
function acquire() {
  const max = Math.max(1, Number.parseInt(process.env.CODE_MAX_CONCURRENT || '4', 10) || 4)
  if (active < max) { active++; return Promise.resolve() }
  if (queue.length >= 20) return Promise.reject(Object.assign(new Error(BUSY_MESSAGE), { statusCode: 429 }))
  return new Promise(resolve => queue.push(resolve))
}
function release() { const next = queue.shift(); if (next) next(); else active = Math.max(0, active - 1) }
function capOutput(result) {
  let remaining = LIMITS.outputBytes
  const out = {}
  for (const key of ['stdout', 'stderr', 'compile_output']) {
    const bytes = Buffer.from(String(result?.[key] || '')); let end = Math.min(bytes.length, remaining)
    let text = bytes.subarray(0, end).toString('utf8')
    while (Buffer.byteLength(text) > remaining && end > 0) text = bytes.subarray(0, --end).toString('utf8')
    out[key] = text; remaining -= Buffer.byteLength(text)
  }
  return { ...result, ...out }
}
async function run(input) {
  await acquire()
  const controller = new AbortController()
  let timer
  const execution = Promise.resolve().then(() => getRunner().run({ ...input, limits: { ...LIMITS, signal: controller.signal } }))
  try {
    const limit = new Promise(resolve => { timer = setTimeout(() => { controller.abort(); resolve({ stdout: '', stderr: '', compile_output: '', status: 'timeout', time_ms: LIMITS.wallTimeMs, memory_kb: null }) }, LIMITS.wallTimeMs) })
    return capOutput(await Promise.race([execution, limit]))
  } finally { clearTimeout(timer); execution.then(release, release) }
}
module.exports = { LANGUAGES, LIMITS, BUSY_MESSAGE, USER_LIMIT_MESSAGE, status, run, takeUserRun, capOutput, mapJudge0Status: judge0.mapStatus }
