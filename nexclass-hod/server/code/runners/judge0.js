const LANGUAGE_IDS = Object.freeze({ python: 71, javascript: 63, java: 62, c: 50, cpp: 54 })
function decode(value) { try { return value ? Buffer.from(value, 'base64').toString('utf8') : '' } catch { return '' } }
function mapStatus(id) { return id === 3 ? 'ok' : id === 5 ? 'timeout' : id === 6 ? 'compile_error' : id === 15 ? 'memory_limit' : 'runtime_error' }
async function run({ language, source, stdin = '', limits }) {
  if (!process.env.JUDGE0_URL) throw Object.assign(new Error('Judge0 runner is selected but JUDGE0_URL is not configured.'), { statusCode: 503 })
  const controller = new AbortController()
  const relayAbort = () => controller.abort()
  if (limits.signal?.aborted) controller.abort()
  else limits.signal?.addEventListener('abort', relayAbort, { once: true })
  const timeout = setTimeout(relayAbort, limits.wallTimeMs + 2000)
  try {
    const headers = { 'Content-Type': 'application/json' }
    if (process.env.JUDGE0_AUTH_TOKEN) headers['X-Auth-Token'] = process.env.JUDGE0_AUTH_TOKEN
    const response = await fetch(`${process.env.JUDGE0_URL.replace(/\/$/, '')}/submissions?base64_encoded=true&wait=true`, {
      method: 'POST', headers, signal: controller.signal,
      body: JSON.stringify({ language_id: LANGUAGE_IDS[language], source_code: Buffer.from(source).toString('base64'), stdin: Buffer.from(stdin).toString('base64'), cpu_time_limit: limits.cpuTimeMs / 1000, wall_time_limit: limits.wallTimeMs / 1000, memory_limit: limits.memoryKb, max_file_size: 1024 }),
    })
    if (!response.ok) throw new Error(`Judge0 returned HTTP ${response.status}`)
    const data = await response.json()
    return { stdout: decode(data.stdout), stderr: decode(data.stderr), compile_output: decode(data.compile_output), status: mapStatus(data.status?.id), time_ms: data.time == null ? null : Math.round(Number(data.time) * 1000), memory_kb: Number.isFinite(Number(data.memory)) ? Number(data.memory) : null }
  } catch (error) {
    if (error.name === 'AbortError') return { stdout: '', stderr: '', compile_output: '', status: 'timeout', time_ms: limits.wallTimeMs, memory_kb: null }
    throw error
  } finally { clearTimeout(timeout); limits.signal?.removeEventListener('abort', relayAbort) }
}
module.exports = { run, LANGUAGE_IDS, mapStatus, decode }
