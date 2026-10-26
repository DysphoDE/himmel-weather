import { spawn } from 'node:child_process'
import { createServer } from 'vite'

// Eigener freier Port: laufende Entwicklungsserver werden weder gebraucht noch
// beendet. Auch bei einem fehlgeschlagenen Test wird der Server geschlossen.
const server = await createServer({ logLevel: 'error', server: { host: '127.0.0.1', port: 0, open: false } })
let child
let interrupted = false
const stop = () => { interrupted = true; child?.kill('SIGTERM') }
process.on('SIGINT', stop)
process.on('SIGTERM', stop)
try {
  await server.listen()
  const base = server.resolvedUrls.local[0].replace(/\/$/, '')
  const selected = process.argv[2]
  const suites = selected ? [selected] : ['app', 'radar']
  for (const suite of suites) {
    if (interrupted) break
    if (!['app', 'radar'].includes(suite)) throw new Error(`Unknown browser suite: ${suite}`)
    const code = await new Promise((resolve, reject) => {
      child = spawn(process.execPath, [`tests/${suite}.browser.mjs`], {
        stdio: 'inherit', env: { ...process.env, APP_URL: base }
      })
      child.once('error', reject)
      child.once('exit', code => resolve(code ?? 1))
    })
    child = null
    if (code !== 0) { process.exitCode = code; break }
  }
  if (interrupted) process.exitCode = 130
} finally {
  process.off('SIGINT', stop)
  process.off('SIGTERM', stop)
  await server.close()
}
