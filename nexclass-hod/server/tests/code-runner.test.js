const { buildDockerArgs, SUPPORTED_LANGUAGES } = require('../code-runner')

test('code runner supports only the classroom languages', () => {
  expect([...SUPPORTED_LANGUAGES]).toEqual(['python', 'javascript', 'java', 'c', 'cpp'])
  expect(() => buildDockerArgs('bash', 'nexclass-test', 'runner:1')).toThrow('Unsupported language')
})

test.each(['python', 'javascript', 'java', 'c', 'cpp'])('runner isolates %s in a restricted offline container', language => {
  const args = buildDockerArgs(language, 'nexclass-test-run', 'runner:1')
  expect(args).toContain('--network=none')
  expect(args).toContain('--read-only')
  expect(args).toContain('--cap-drop=ALL')
  expect(args).toContain('--memory=128m')
  expect(args).toContain('--cpus=0.5')
  expect(args).toContain('--pids-limit=64')
  expect(args).toContain('--pull=never')
  expect(args).toContain('nexclass-test-run')
})
