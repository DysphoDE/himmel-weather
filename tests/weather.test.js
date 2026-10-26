import test from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import {
  currentHourIndex, fetchWeather, fetchWidgetWeather, searchPlaces, getRisk,
  localDate, pollenPeak, pollenPhrase, pollenTier, pollenValue, measurement, kilometers,
  aqiTier, uvTier, uvAdvice, pressureTier, humidityTier, visibilityTier, bestWeatherWindow, outdoorScore
} from '../src/weather.js'
import { weatherFixture } from './weather-fixture.js'

test('weather hours use the API local clock, including midnight and the end of the forecast', () => {
  const data = weatherFixture({ hour: 19, timezone: 'America/New_York' })
  assert.equal(currentHourIndex(data.hourly.time, data.current.time), 19)
  assert.equal(currentHourIndex(data.hourly.time, '2026-10-28T00:00'), 24)
  assert.equal(currentHourIndex(data.hourly.time, '2026-10-20T00:00'), 0)
  assert.equal(currentHourIndex(data.hourly.time, '2026-11-20T00:00'), 239)
  assert.equal(currentHourIndex([], data.current.time), 0)
})

test('dates, hours and window boundaries do not change with the browser timezone or DST', () => {
  const script = `import { fmtTime, fmtDay, fmtDate, hourOf, addWeatherHour, weatherDate } from ${JSON.stringify(new URL('../src/weather.js', import.meta.url).href)};
    console.log(JSON.stringify([fmtTime('2026-03-29T02:00'), hourOf('2026-03-29T02:00'), fmtDay('2026-10-27'), fmtDate('2026-10-27'), fmtTime(addWeatherHour('2026-10-27T23:00')), (weatherDate('2026-03-29T18:00') - weatherDate('2026-03-29T07:00')) / 3600000]));`
  for (const TZ of ['Europe/Berlin', 'America/Los_Angeles', 'Asia/Tokyo']) {
    const actual = JSON.parse(execFileSync(process.execPath, ['--input-type=module', '-e', script], { env: { ...process.env, TZ }, encoding: 'utf8' }))
    assert.deepEqual(actual, ['02:00', 2, 'Di', '27. Oktober', '00:00', 11], TZ)
  }
  assert.equal(localDate('America/New_York', Date.parse('2026-10-27T00:30Z')), '2026-10-26')
  assert.equal(localDate('Asia/Tokyo', Date.parse('2026-10-27T16:30Z')), '2026-10-28')
})

test('risk evaluates the next hours at the weather location', () => {
  const data = weatherFixture({ hour: 19, timezone: 'America/New_York' })
  data.hourly.precipitation_probability[19] = 90
  assert.equal(getRisk(data).level, 'erhöht')
  data.hourly.precipitation_probability[19] = 0
  data.hourly.precipitation_probability[5] = 100
  assert.equal(getRisk(data).level, 'niedrig')
})

test('missing and partially missing pollen are unknown, while actual zero remains low', () => {
  assert.equal(pollenPeak(null), null)
  assert.equal(pollenPeak({ alder_pollen: 5, birch_pollen: null, grass_pollen: 0 }), null)
  for (const value of [null, undefined, NaN]) {
    assert.equal(pollenTier(value), 'Keine Daten')
    assert.equal(pollenPhrase(value), 'Keine Pollendaten')
    assert.equal(pollenValue(value), '–')
  }
  assert.equal(pollenPeak({ alder_pollen: 0, birch_pollen: 0, grass_pollen: 0 }), 0)
  assert.equal(pollenPhrase(0), 'Geringe Belastung')
  assert.equal(pollenValue(0), 0)
  assert.equal(pollenPeak({ alder_pollen: 5, birch_pollen: 80, grass_pollen: 0 }), 80)
})

for (const failure of ['network', 'http', 'json']) {
  test(`optional air ${failure} failure preserves successful weather`, async t => {
    t.mock.method(globalThis, 'fetch', async url => {
      if (!url.includes('air-quality')) return { ok: true, json: async () => ({ current: { temperature_2m: 18 } }) }
      if (failure === 'network') throw new TypeError('offline')
      return { ok: failure !== 'http', json: async () => { throw new SyntaxError('bad JSON') } }
    })
    const data = await fetchWeather(47, 10)
    assert.equal(data.current.temperature_2m, 18)
    assert.equal(data.air, null)
  })
}

test('a stalled optional air request has a deadline and cannot hold weather indefinitely', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] })
  t.mock.method(globalThis, 'fetch', async (url, { signal }) => {
    if (!url.includes('air-quality')) return { ok: true, json: async () => ({ current: {} }) }
    return new Promise((_, reject) => signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError'))))
  })
  const pending = fetchWeather(47, 10)
  t.mock.timers.tick(5000)
  assert.equal((await pending).air, null)
})

test('weather HTTP failures are still reported', async t => {
  t.mock.method(globalThis, 'fetch', async () => ({ ok: false }))
  await assert.rejects(fetchWeather(47, 10), /Wetterdaten derzeit nicht erreichbar/)
})

test('search, app and widget requests honor cancellation', async t => {
  t.mock.method(globalThis, 'fetch', async (_, { signal }) => new Promise((_, reject) => {
    const abort = () => reject(new DOMException('Aborted', 'AbortError'))
    if (signal.aborted) abort()
    else signal.addEventListener('abort', abort, { once: true })
  }))
  for (const load of [
    signal => searchPlaces('Berlin', { signal }),
    signal => fetchWeather(47, 10, { signal }),
    signal => fetchWidgetWeather(47, 10, 4, { signal })
  ]) {
    const controller = new AbortController()
    const pending = load(controller.signal)
    controller.abort()
    await assert.rejects(pending, { name: 'AbortError' })
  }
})

test('missing measurements have neither a numerical zero nor a favorable classification', () => {
  for (const value of [null, undefined, NaN, Infinity]) {
    assert.equal(measurement(value), '–')
    assert.equal(kilometers(value), '–')
    for (const tier of [aqiTier, uvTier, pressureTier, humidityTier, visibilityTier]) assert.equal(tier(value), 'Keine Daten')
    assert.equal(uvAdvice(value), 'Keine UV-Daten')
  }
  assert.equal(measurement(0), 0)
  assert.equal(aqiTier(0), 'Sehr gut')
  assert.equal(kilometers(0), 0)
})

const windowHours = Array.from({ length: 14 }, (_, i) => ({
  time: `2026-10-27T${String(i + 7).padStart(2, '0')}:00`,
  rainChance: i < 5 ? 90 : 0, gusts: 20, uv: 2, temperature: 18
}))

test('best window evaluates its own hours and explains the score independently of the day maximum', () => {
  const best = bestWeatherWindow(windowHours, '2026-10-27T07:30')
  assert.equal(best.label, '12:00–15:00')
  assert.equal(best.score, 100)
  assert.equal(best.rain, 0)
  assert.equal(best.gusts, 20)
  assert.equal(best.detail, 'Trocken, wenig Wind, angenehme Temperatur.')
  assert.ok(best.score > outdoorScore({ rainMax: 90, gusts: 20, uv: 2, high: 18 }))
  assert.equal(best.past, false)
})

test('window candidates have equal length and never bridge missing values or missing hours', () => {
  const late = windowHours.map(hour => ({ ...hour, rainChance: hour.time.includes('T20:') ? 0 : 50 }))
  assert.equal(bestWeatherWindow(late, '2026-10-27T17:30').label, '18:00–21:00')
  assert.equal(bestWeatherWindow(windowHours, '2026-10-27T20:30').label, '20:00–21:00')
  assert.equal(bestWeatherWindow(windowHours, '2026-10-27T22:00').past, true)
  const missing = windowHours.map(hour => ({ ...hour, rainChance: null }))
  assert.equal(bestWeatherWindow(missing, '2026-10-27T12:30').score, null)
  assert.equal(bestWeatherWindow([], '2026-10-27T12:30').score, null)
  const gaps = [windowHours[0], windowHours[2], windowHours[4]]
  assert.equal(bestWeatherWindow(gaps, '2026-10-27T07:00').score, null)
})
