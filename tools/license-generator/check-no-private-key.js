const fs = require('fs')
const path = require('path')
const root = path.resolve(__dirname, '../..')
const scanRoots = ['server', 'nexclass-hod', 'teacher-app', 'student-app', 'dist-electron', 'release', 'build'].map(item => path.join(root, item))
const found = []
function walk(directory) {
  if (!fs.existsSync(directory)) return
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name === '.git') continue
    const filename = path.join(directory, entry.name)
    if (entry.isDirectory()) walk(filename)
    else if (entry.isFile() && entry.name.endsWith('.private.pem')) found.push(path.relative(root, filename))
  }
}
scanRoots.forEach(walk)
if (found.length) {
  console.error(`Private signing key files found in application or package paths:\n${found.join('\n')}`)
  process.exit(1)
}
console.log('No private signing keys found in server, app, or packaged output paths.')
