const { spawn } = require('child_process')
const crypto = require('crypto')

const SUPPORTED_LANGUAGES = new Set(['python', 'javascript', 'java', 'c', 'cpp'])
const OUTPUT_LIMIT = 32 * 1024
const DEFAULT_TIMEOUT_MS = 10_000

const PROGRAMS = {
  python: 'cat > /work/main.py && python3 /work/main.py',
  javascript: 'cat > /work/main.js && node /work/main.js',
  java: 'cat > /work/Main.java && cd /work && javac Main.java && java Main',
  c: 'cat > /work/main.c && gcc -O0 -std=c11 -o /work/main /work/main.c && /work/main',
  cpp: 'cat > /work/main.cpp && g++ -O0 -std=c++17 -o /work/main /work/main.cpp && /work/main',
}

function buildDockerArgs(language, containerName, image) {
  if (!SUPPORTED_LANGUAGES.has(language)) throw new TypeError('Unsupported language')
  return [
    'run', '--rm', '--pull=never', '--name', containerName, '--interactive',
    '--network=none', '--memory=128m', '--memory-swap=128m', '--cpus=0.5',
    '--pids-limit=64', '--ulimit=nofile=64:64', '--ulimit=fsize=1048576:1048576',
    '--read-only', '--tmpfs', '/work:rw,exec,nosuid,nodev,size=32m,uid=10001,gid=10001,mode=0700',
    '--security-opt=no-new-privileges:true', '--cap-drop=ALL', '--user=10001:10001',
    '--workdir=/work', '--entrypoint=/bin/sh', image, '-c', PROGRAMS[language],
  ]
}

function runInSandbox({ code, language, image, dockerPath = process.env.DOCKER_BIN || 'docker', timeoutMs = DEFAULT_TIMEOUT_MS }) {
  if (!SUPPORTED_LANGUAGES.has(language)) return Promise.reject(new TypeError('Unsupported language'))
  const containerName = `nexclass-run-${crypto.randomUUID()}`
  const args = buildDockerArgs(language, containerName, image)

  return new Promise(resolve => {
    let child
    let timer
    let finished = false
    let forcedStatus = null
    let stdout = ''
    let stderr = ''
    const finish = result => {
      if (finished) return
      finished = true
      clearTimeout(timer)
      resolve({ ...result, stdout: stdout.slice(0, OUTPUT_LIMIT), stderr: stderr.slice(0, OUTPUT_LIMIT) })
    }
    const stopContainer = () => {
      const killer = spawn(dockerPath, ['kill', containerName], { windowsHide: true, stdio: 'ignore' })
      killer.on('error', () => {})
    }
    const terminate = status => {
      if (finished || forcedStatus) return
      forcedStatus = status
      stopContainer()
      child?.kill()
    }

    try {
      child = spawn(dockerPath, args, {
        windowsHide: true,
        stdio: ['pipe', 'pipe', 'pipe'],
        env: process.platform === 'win32'
          ? { PATH: process.env.PATH, SystemRoot: process.env.SystemRoot, SYSTEMROOT: process.env.SYSTEMROOT }
          : { PATH: process.env.PATH || '/usr/bin:/bin' },
      })
    } catch (error) {
      return finish({ status: 'runner_unavailable', output: 'The local code runner could not be started.' })
    }

    timer = setTimeout(() => terminate('time_limit_exceeded'), timeoutMs)
    child.stdout.on('data', chunk => {
      stdout += chunk.toString('utf8')
      if (Buffer.byteLength(stdout, 'utf8') + Buffer.byteLength(stderr, 'utf8') > OUTPUT_LIMIT) terminate('output_limit_exceeded')
    })
    child.stderr.on('data', chunk => {
      stderr += chunk.toString('utf8')
      if (Buffer.byteLength(stdout, 'utf8') + Buffer.byteLength(stderr, 'utf8') > OUTPUT_LIMIT) terminate('output_limit_exceeded')
    })
    child.on('error', error => {
      finish({ status: 'runner_unavailable', output: error.code === 'ENOENT'
        ? 'Docker is not installed or is not available on the server.'
        : 'The local code runner could not be started.' })
    })
    child.on('close', codeExit => {
      if (forcedStatus) return finish({ status: forcedStatus, output: forcedStatus === 'time_limit_exceeded'
        ? 'Execution stopped after reaching the time limit.'
        : 'Execution stopped after producing too much output.' })
      const missingImage = /unable to find image|no such image|pull access denied/i.test(stderr)
      if (missingImage) return finish({ status: 'runner_unavailable', output: 'The local code runner image is not installed on the server.' })
      const status = codeExit === 0 ? 'completed' : 'runtime_error'
      const output = [stdout.trimEnd(), stderr.trimEnd()].filter(Boolean).join('\n') || (status === 'completed' ? 'Execution completed. (No output returned)' : 'Program exited with an error.')
      finish({ status, output, exitCode: codeExit })
    })
    child.stdin.on('error', () => {})
    child.stdin.end(code, 'utf8')
  })
}

module.exports = { DEFAULT_TIMEOUT_MS, OUTPUT_LIMIT, SUPPORTED_LANGUAGES, buildDockerArgs, runInSandbox }
