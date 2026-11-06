const judge0 = require('../code/runners/judge0')
const runner = require('../code/runnerService')

test.each([[3, 'ok'], [5, 'timeout'], [6, 'compile_error'], [15, 'memory_limit'], [11, 'runtime_error']])('Judge0 status %s maps to %s', (id, status) => expect(judge0.mapStatus(id)).toBe(status))

test('Judge0 request uses base64 source and maps the response', async () => {
  const oldUrl = process.env.JUDGE0_URL, oldToken = process.env.JUDGE0_AUTH_TOKEN, oldFetch = global.fetch
  process.env.JUDGE0_URL = 'http://127.0.0.1:2358'; process.env.JUDGE0_AUTH_TOKEN = 'test-token'
  global.fetch = jest.fn(async (_url, options) => {
    expect(options.headers['X-Auth-Token']).toBe('test-token')
    expect(JSON.parse(options.body).source_code).toBe(Buffer.from('print("hi")').toString('base64'))
    return { ok: true, json: async () => ({ status: { id: 3 }, stdout: Buffer.from('hi\n').toString('base64'), time: '0.012', memory: 1234 }) }
  })
  try {
    const result = await judge0.run({ language: 'python', source: 'print("hi")', stdin: '', limits: { cpuTimeMs: 5000, wallTimeMs: 10000, memoryKb: 131072 } })
    expect(result).toMatchObject({ stdout: 'hi\n', status: 'ok', time_ms: 12, memory_kb: 1234 })
  } finally {
    global.fetch = oldFetch
    if (oldUrl === undefined) delete process.env.JUDGE0_URL; else process.env.JUDGE0_URL = oldUrl
    if (oldToken === undefined) delete process.env.JUDGE0_AUTH_TOKEN; else process.env.JUDGE0_AUTH_TOKEN = oldToken
  }
})

test('default runner is disabled', () => {
  delete process.env.CODE_RUNNER; delete process.env.JUDGE0_URL
  expect(runner.status()).toMatchObject({ enabled: false, runner: 'disabled' })
})

test('queue returns 429 when all 20 waiting slots are full', async () => {
  const oldRun = judge0.run, oldMode = process.env.CODE_RUNNER, oldMax = process.env.CODE_MAX_CONCURRENT
  process.env.CODE_RUNNER = 'judge0'; process.env.CODE_MAX_CONCURRENT = '1'
  let finish
  let count = 0
  judge0.run = () => ++count === 1 ? new Promise(resolve => { finish = resolve }) : Promise.resolve({ stdout: '', stderr: '', compile_output: '', status: 'ok' })
  try {
    const input = { language: 'python', source: 'print(1)', stdin: '' }
    const active = runner.run(input)
    await new Promise(resolve => setImmediate(resolve))
    const waiting = Array.from({ length: 20 }, () => runner.run(input))
    await expect(runner.run(input)).rejects.toMatchObject({ statusCode: 429, message: 'Code runner is busy, try again' })
    finish({ stdout: '', stderr: '', compile_output: '', status: 'ok' })
    await Promise.all([active, ...waiting])
  } finally {
    judge0.run = oldRun
    if (oldMode === undefined) delete process.env.CODE_RUNNER; else process.env.CODE_RUNNER = oldMode
    if (oldMax === undefined) delete process.env.CODE_MAX_CONCURRENT; else process.env.CODE_MAX_CONCURRENT = oldMax
  }
}, 15000)
