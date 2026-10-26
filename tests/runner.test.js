import test from 'node:test'
import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'

// Der Fehlerpfad muss den Vite-Server ebenfalls schließen; sonst bleibt CI hängen.
test('managed browser server exits cleanly when a suite cannot run', async () => {
  const result = await new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ['scripts/browser-tests.mjs', 'unknown-suite'], { stdio: ['ignore', 'pipe', 'pipe'] })
    let output = ''
    child.stdout.on('data', chunk => { output += chunk })
    child.stderr.on('data', chunk => { output += chunk })
    const timer = setTimeout(() => { child.kill('SIGKILL'); reject(new Error('Test server remained running after failure')) }, 8000)
    child.once('error', error => { clearTimeout(timer); reject(error) })
    child.once('exit', code => { clearTimeout(timer); resolve({ code, output }) })
  })
  assert.equal(result.code, 1)
  assert.match(result.output, /Unknown browser suite: unknown-suite/)
})
