// Run with a Vite server on :5173. Set PLAYWRIGHT_MODULE if Playwright is provided externally.
import assert from 'node:assert/strict'
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright')
const browser = await chromium.launch({ headless: true })
const page = await browser.newPage({ viewport: { width: 1200, height: 850 } })
const errors = []
page.on('pageerror', error => { errors.push(error.message); console.error(error.message) })
const anchor = Date.parse('2026-09-11T12:00:00Z')
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg==', 'base64')
let delayWorld = 0
let failWorld = false
let failures = 0
let worldRequests = 0
const capabilities = `<WMS_Capabilities><Capability><Layer><Layer><Name>Radar_rv_product_1x1km_ger</Name><Dimension name="time">2026-09-11T11:00:00Z/2026-09-11T13:00:00Z/PT5M</Dimension><Dimension name="REFERENCE_TIME" default="2026-09-11T12:00:00Z" /></Layer></Layer></Capability></WMS_Capabilities>`
await page.route('https://api.rainviewer.com/**', route => route.fulfill({ json: { host: 'https://tilecache.rainviewer.com', radar: { past: Array.from({length:7}, (_,i) => ({time:(anchor - (6-i)*600000)/1000,path:`/v2/radar/frame-${i}`})), nowcast: [] } } }))
await page.route('https://maps.dwd.de/**', route => new URL(route.request().url()).searchParams.get('request') === 'GetCapabilities'
  ? route.fulfill({ contentType: 'text/xml', body: capabilities })
  : route.fulfill({ contentType: 'image/png', body: png, headers: { 'access-control-allow-origin': '*' } }))
await page.route('https://tile.openstreetmap.org/**', route => route.fulfill({contentType:'image/png',body:png}))
await page.route('https://tilecache.rainviewer.com/**', async route => {
  worldRequests += 1
  if (delayWorld) await new Promise(resolve => setTimeout(resolve, delayWorld))
  if (failWorld) { failures += 1; await route.fulfill({status:503,body:'unavailable'}) }
  else await route.fulfill({contentType:'image/png',body:png})
})
const state = () => page.evaluate(() => {
  const map = [...window.__radarMaps][0]
  const layers = []
  map.eachLayer(layer => {
    if (layer.options.className?.includes('radar-frame')) layers.push({type:layer.options.className.includes('dwd')?'dwd':'world',opacity:layer.options.opacity,url:typeof layer._url==='string'?layer._url:'image'})
  })
  return { clock:document.querySelector('.radar-clock').textContent, coverage:document.querySelector('.radar-source').textContent, index:+document.querySelector('input[type=range]').value, layers }
})
const seek = async index => {
  await page.locator('input[type=range]').evaluate((element, index) => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(element,String(index))
    element.dispatchEvent(new Event('input',{bubbles:true}))
    element.dispatchEvent(new Event('change',{bubbles:true}))
  }, index)
}
try {
  await page.goto('http://127.0.0.1:5173/tests/radar-harness.html')
  await page.waitForFunction(() => document.querySelector('.radar-clock')?.textContent.includes('MESSUNG'), null, {timeout:20000})
  let initial = await state()
  assert.equal(initial.index,6)
  assert.equal(initial.layers.filter(layer => layer.opacity > 0).length,2)
  console.log('PASS: StrictMode initial frame has synchronized layers')
  await seek(7)
  await page.waitForFunction(() => document.querySelector('.radar-clock').textContent.includes('VORHERSAGE'))
  const future = await state()
  assert.equal(future.layers.filter(layer=>layer.type==='world'&&layer.opacity>0).length,0)
  assert.match(future.coverage,/NUR DWD/)
  console.log('PASS: future hides world instead of freezing it')
  delayWorld = 2500
  await seek(0)
  await page.waitForTimeout(200)
  const loading = await state()
  assert.match(loading.clock,/LÄDT/)
  assert.equal(loading.layers.filter(layer=>layer.opacity>0).length,0)
  await page.waitForFunction(() => document.querySelector('.radar-clock').textContent.includes('MESSUNG'))
  assert.equal((await state()).layers.filter(layer=>layer.opacity>0).length,2)
  console.log('PASS: seek waits for delayed world tiles before displaying either layer')
  delayWorld = 0
  failWorld = true
  await page.evaluate(() => [...window.__radarMaps][0].setZoom(7,{animate:false}))
  await page.waitForTimeout(300)
  assert.match((await state()).clock,/LÄDT/)
  await page.waitForFunction(() => document.querySelector('.radar-source').textContent.includes('GLOBAL NICHT VERFÜGBAR'), null, {timeout:20000})
  assert.ok(failures>2)
  assert.equal((await state()).layers.filter(layer=>layer.type==='world'&&layer.opacity>0).length,0)
  console.log('PASS: zoom invalidates readiness; failed tiles retry and never count as success')
  failWorld=false
  await page.evaluate(() => [...window.__radarMaps][0].panBy([300,0],{animate:false}))
  await page.waitForFunction(() => document.querySelector('.radar-source').textContent.includes('SYNCHRON') && !document.querySelector('.radar-clock').textContent.includes('LÄDT'))
  await page.getByRole('button',{name:'Wiedergabe starten'}).click()
  await page.waitForFunction(() => +document.querySelector('input[type=range]').value > 0)
  console.log('PASS: map movement recovers and playback advances')
  await page.getByRole('button',{name:'Wiedergabe pausieren'}).click()
  await seek(0)
  await page.evaluate(() => [...window.__radarMaps][0].setView([40.71,-74],7,{animate:false}))
  await page.waitForFunction(() => document.querySelector('.radar-source').textContent.includes('AUSSERHALB'))
  assert.equal((await state()).layers.filter(layer=>layer.type==='dwd'&&layer.opacity>0).length,0)
  console.log('PASS: leaving DWD coverage releases pending frames')
  await page.goto('http://127.0.0.1:5173/tests/radar-harness.html?mode=mini')
  await page.waitForFunction(() => document.querySelector('.mini-radar-badge')?.textContent==='DWD + GLOBAL')
  console.log('PASS: mini radar uses the same synchronized measurement pair')
  await page.goto('http://127.0.0.1:5173/tests/radar-harness.html?mode=global')
  await page.waitForFunction(() => document.querySelector('.radar-clock')?.textContent.includes('MESSUNG'))
  const global = await state()
  assert.equal(global.layers.filter(layer=>layer.opacity>0).length,1)
  assert.equal(global.layers.some(layer=>layer.type==='dwd'),false)
  console.log('PASS: global-only locations work without DWD')
  assert.deepEqual(errors,[])
  await page.screenshot({path:'/tmp/himmel-radar-tested.png'})
  console.log(JSON.stringify({worldRequests,failures,errors}))
} finally { await browser.close() }
