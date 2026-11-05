const { spawnSync } = require('child_process')
const path = require('path')
const electronExecutable = require('electron')

const result = spawnSync(electronExecutable, [
  require.resolve('jest/bin/jest'),
  '--runInBand',
  path.join(__dirname, 'auth.test.js'),
], {
  stdio: 'inherit',
  env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' },
})

if (result.error) throw result.error
process.exit(result.status ?? 1)
