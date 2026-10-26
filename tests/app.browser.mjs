// Run against Vite on :5173; PLAYWRIGHT_MODULE may point at an external runtime.
import assert from 'node:assert/strict'
import { weatherFixture } from './weather-fixture.js'
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright')
const browser = await chromium.launch({ headless: true })
const base = process.env.APP_URL || 'http://127.0.0.1:5173'

async function check(name, options, verify) {
  const context = await browser.newContext({
    viewport: options.mobile ? { width: 390, height: 844 } : { width: 1440, height: 1000 },
    timezoneId: options.browserZone || 'Europe/Berlin', reducedMotion: 'reduce'
  })
  const page = await context.newPage()
  page.setDefaultTimeout(8000)
  const errors = []
  page.on('pageerror', error => errors.push(error.message))
  const mode = { data: options.data || weatherFixture(), failWeather: false, air: options.air, requests: 0 }
  await page.route('https://**/*', async route => {
    const url = new URL(route.request().url())
    if (url.hostname === 'api.open-meteo.com') {
      mode.requests += 1
      if (mode.failWeather) return route.fulfill({ status: 503, body: 'offline' })
      return route.fulfill({ json: mode.data })
    }
    if (url.hostname === 'air-quality-api.open-meteo.com') {
      if (mode.air === 'network') return route.abort('failed')
      return route.fulfill({ json: mode.data.air })
    }
    if (url.hostname === 'geocoding-api.open-meteo.com') {
      if (options.search) return options.search(route, url)
      return route.fulfill({ json: { results: [{ id: 1, name: 'Berlin', country: 'Deutschland', latitude: 52.52, longitude: 13.4 }] } })
    }
    return route.abort()
  })
  await page.clock.install({ time: new Date(options.time || '2026-10-27T11:30:00Z') })
  if (options.place) await context.addInitScript(place => localStorage.setItem('himmel-place', JSON.stringify(place)), options.place)
  try {
    await page.goto(`${base}${options.path || '/'}`)
    await page.locator(options.path ? '.widget-body' : options.mobile ? '.mobile-app' : '.desktop-shell').waitFor()
    await verify(page, mode)
    assert.deepEqual(errors, [])
    console.log(`PASS: ${name}`)
  } catch (error) {
    console.error(`FAIL: ${name}`)
    await page.screenshot({ path: '/tmp/himmel-app-test-failed.png', fullPage: true }).catch(() => {})
    throw error
  } finally {
    await context.close()
  }
}

const openSearch = async page => {
  await page.keyboard.press('Control+k')
  await page.getByRole('combobox', { name: 'Ortsname' }).waitFor()
}
const nowIsVisible = async page => page.locator('.weather-matrix-scroll').evaluate(scroller => {
  const cell = scroller.querySelector('.matrix-weather.is-now')?.getBoundingClientRect()
  const box = scroller.getBoundingClientRect()
  const label = scroller.querySelector('.matrix-label').getBoundingClientRect()
  return cell && cell.left >= label.right - 1 && cell.right <= box.right + 1
})

try {
  await check('a failed place change never displays old weather under the new name and can recover', {}, async (page, mode) => {
    mode.failWeather = true
    await openSearch(page)
    await page.getByRole('combobox', { name: 'Ortsname' }).fill('Berlin')
    await page.clock.runFor(350)
    await page.locator('.search-results button').click()
    await page.getByRole('heading', { name: 'Wetterpause.' }).waitFor()
    assert.equal(await page.locator('.desktop-shell').count(), 0)
    assert.equal(await page.locator('.scene-copy').count(), 0)
    mode.failWeather = false
    mode.data = weatherFixture({ temperature: 30 })
    await page.getByRole('button', { name: 'Noch einmal versuchen' }).click()
    await page.waitForFunction(() => document.querySelector('.scene-copy > b')?.textContent === '30°')
    assert.match(await page.locator('.scene-location').innerText(), /Berlin/)
    assert.equal(await page.locator('[role=alert]').count(), 0)
  })

  await check('weather refreshes after ten minutes without resetting the selected day', {}, async (page, mode) => {
    await page.locator('.week-strip button').nth(2).click()
    const before = mode.requests
    mode.data = weatherFixture({ temperature: 31 })
    await page.clock.fastForward(10 * 60_000)
    await page.waitForFunction(() => document.querySelector('.scene-copy > b')?.textContent === '31°')
    assert.ok(mode.requests > before)
    assert.match(await page.locator('.detail-nav').innerText(), /Tag 3 von 10/)
  })

  await check('the local day rolls over and returns the day detail to today', {
    data: weatherFixture({ hour: 23 }), time: '2026-10-27T22:59:30Z'
  }, async (page, mode) => {
    await page.locator('.week-strip button').nth(2).click()
    mode.data = weatherFixture({ date: '2026-10-28', hour: 0, temperature: 32 })
    await page.clock.fastForward(60_000)
    await page.waitForFunction(() => document.querySelector('.scene-copy > b')?.textContent === '32°')
    assert.match(await page.locator('.dashboard-date').innerText(), /28\. Oktober/)
    assert.match(await page.locator('.detail-nav').innerText(), /Tag 1 von 10/)
  })

  await check('returning to a tab refreshes data even when background timers were throttled', {}, async (page, mode) => {
    mode.data = weatherFixture({ temperature: 33 })
    await page.clock.setFixedTime(new Date('2026-10-27T12:30:00Z'))
    await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')))
    await page.waitForFunction(() => document.querySelector('.scene-copy > b')?.textContent === '33°')
  })

  for (const mobile of [false, true]) {
    await check(`air network failure preserves ${mobile ? 'mobile' : 'desktop'} weather`, { air: 'network', mobile }, async page => {
      assert.equal(await page.getByRole('heading', { name: 'Wetterpause.' }).count(), 0)
      assert.match(await page.locator(mobile ? '.mobile-current-temp' : '.scene-copy').innerText(), /18/)
      assert.match(await page.locator(mobile ? '.mobile-decision-grid' : '.today-decisions').innerText(), /Keine Pollendaten/)
    })
  }

  for (const browserZone of ['Europe/Berlin', 'America/Los_Angeles']) {
    await check(`New York hours and dates remain local in a ${browserZone} browser`, {
      browserZone, time: '2026-10-26T23:30:00Z',
      data: weatherFixture({ date: '2026-10-26', hour: 19, timezone: 'America/New_York', pollen: null }),
      place: { name: 'New York', latitude: 40.71, longitude: -74 }
    }, async page => {
      assert.equal(await page.locator('.matrix-weather.is-now > b').innerText(), '19°')
      assert.match(await page.locator('.dashboard-date').innerText(), /26\. Oktober/)
      assert.match(await page.locator('.today-decision').last().innerText(), /Keine Pollendaten\. Erle –, Birke –, Gräser –/)
    })
  }

  await check('the widget also selects the local hour across date boundaries', {
    path: '/widget.html?lat=40.71&lon=-74&ort=New%20York', browserZone: 'Asia/Tokyo', time: '2026-10-26T23:30:00Z',
    data: weatherFixture({ date: '2026-10-26', hour: 19, timezone: 'America/New_York' })
  }, async page => {
    assert.equal(await page.locator('.widget-hours .is-now > b').innerText(), '19°')
    assert.equal(await page.locator('.widget-hours > div').nth(1).locator('span').innerText(), '20')
  })

  let releaseOld
  const oldResponse = new Promise(resolve => { releaseOld = resolve })
  let oldStarted = false
  await check('late search responses cannot replace newer results or restore a cleared query', {
    search: async (route, url) => {
      const older = url.searchParams.get('name') === 'Ber'
      if (older) { oldStarted = true; await oldResponse }
      await route.fulfill({ json: { results: [{ id: older ? 2 : 3, name: older ? 'Bern' : 'Berlin', latitude: 52, longitude: 13 }] } }).catch(() => {})
    }
  }, async page => {
    await openSearch(page)
    const input = page.getByRole('combobox', { name: 'Ortsname' })
    await input.fill('Ber')
    await page.clock.runFor(350)
    assert.ok(oldStarted)
    await input.fill('Berlin')
    await page.clock.runFor(350)
    await page.locator('.search-results button').filter({ hasText: 'Berlin' }).waitFor()
    releaseOld()
    await page.clock.runFor(100)
    assert.match(await page.locator('.search-results').innerText(), /Berlin/)
    assert.doesNotMatch(await page.locator('.search-results').innerText(), /Bern/)
    await input.fill('')
    assert.equal(await page.locator('.search-results button').count(), 0)
    assert.doesNotMatch(await page.locator('.search-state').innerText(), /Suche läuft/)
  })

  for (const entry of ['hero', 'all-hours', 'hour-cell']) {
    await check(`mobile ${entry} preview opens today after previously selecting tomorrow`, { mobile: true }, async page => {
      await page.locator('.mobile-week-list button').nth(1).click()
      assert.match(await page.locator('.mobile-day-picker .is-active').innerText(), /28/)
      await page.getByRole('button', { name: 'Heute', exact: true }).click()
      if (entry === 'hero') await page.getByRole('button', { name: '24-Stunden-Vorhersage öffnen' }).click()
      else if (entry === 'all-hours') await page.locator('.mobile-hour-preview .mobile-section-head button').click()
      else await page.locator('.mobile-hour-scroll button').first().click()
      assert.match(await page.locator('.mobile-day-picker .is-active').innerText(), /Heute/)
      assert.equal(await page.locator('.mobile-hour-rows .is-now .mobile-hour-weather > b').innerText(), '12°')
    })
  }

  await check('desktop day detail centers now on every opening and preserves manual scrolling during refresh', {}, async (page, mode) => {
    assert.ok(await nowIsVisible(page))
    const scroller = page.locator('.weather-matrix-scroll')
    await scroller.evaluate(el => el.scrollTo({ left: 0, behavior: 'instant' }))
    await page.getByRole('button', { name: 'Tagesansicht', exact: true }).click()
    assert.ok(await nowIsVisible(page))
    await scroller.evaluate(el => el.scrollTo({ left: 0, behavior: 'instant' }))
    mode.data = weatherFixture({ temperature: 34, hour: 13 })
    await page.clock.fastForward(10 * 60_000)
    await page.waitForFunction(() => document.querySelector('.scene-copy > b')?.textContent === '34°')
    assert.equal(await scroller.evaluate(el => el.scrollLeft), 0)
    await page.locator('.detail-nav button').last().click()
    await page.locator('.detail-nav button').first().click()
    assert.ok(await nowIsVisible(page))
  })

  await check('the current hour advances between forecast refreshes and opening uses the real local clock', {
    time: '2026-10-27T11:59:30Z'
  }, async (page, mode) => {
    const before = mode.requests
    await page.clock.fastForward(60_000)
    await page.waitForFunction(() => document.querySelector('.matrix-weather.is-now > b')?.textContent === '13°')
    assert.equal(mode.requests, before)
    await page.getByRole('button', { name: 'Tagesansicht', exact: true }).click()
    assert.ok(await nowIsVisible(page))
  })

  await check('mobile day detail jumps to now on opening and returning from tomorrow, without jumping on refresh', { mobile: true }, async (page, mode) => {
    await page.getByRole('button', { name: '24-Stunden-Vorhersage öffnen' }).click()
    const visible = () => page.locator('.mobile-hour-rows .is-now').evaluate(el => {
      const box = el.getBoundingClientRect()
      const bar = document.querySelector('.mobile-topbar').getBoundingClientRect()
      return box.top >= bar.bottom && box.bottom < innerHeight - 90
    })
    assert.ok(await visible())
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }))
    await page.getByRole('button', { name: 'Stunden', exact: true }).click()
    assert.ok(await visible())
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }))
    mode.data = weatherFixture({ temperature: 35, hour: 13 })
    const before = mode.requests
    await page.clock.fastForward(30 * 60_000)
    await page.waitForFunction(() => document.querySelector('.mobile-hour-rows .is-now .mobile-hour-weather > b')?.textContent === '13°')
    assert.ok(mode.requests > before)
    assert.equal(await page.evaluate(() => window.scrollY), 0)
    await page.locator('.mobile-day-picker button').nth(1).click()
    await page.locator('.mobile-day-picker button').first().click()
    assert.ok(await visible())
  })
  for (const mobile of [false, true]) {
    await check(`failed background refresh preserves ${mobile ? 'mobile' : 'desktop'} data, place and retry`, { mobile }, async (page, mode) => {
      if (!mobile) {
        await page.locator('.week-strip button').nth(2).click()
        await page.locator('.weather-matrix-scroll').evaluate(el => el.scrollTo({ left: 0, behavior: 'instant' }))
      }
      mode.failWeather = true
      await page.clock.fastForward(10 * 60_000)
      await page.locator('.weather-status').waitFor()
      assert.match(await page.locator('.weather-status').innerText(), /Marktoberdorf/)
      assert.match(await page.locator('.weather-status').innerText(), /Stand 27\.10\., 12:30 Uhr/)
      assert.match(await page.locator(mobile ? '.mobile-current-temp' : '.scene-copy').innerText(), /18/)
      assert.equal(await page.getByRole('heading', { name: 'Wetterpause.' }).count(), 0)
      if (!mobile) {
        assert.match(await page.locator('.detail-nav').innerText(), /Tag 3 von 10/)
        assert.equal(await page.locator('.weather-matrix-scroll').evaluate(el => el.scrollLeft), 0)
      }
      mode.failWeather = false
      mode.data = weatherFixture({ temperature: 36 })
      await page.getByRole('button', { name: 'Erneut aktualisieren' }).click()
      await page.waitForFunction(() => !document.querySelector('.weather-status'))
      assert.match(await page.locator(mobile ? '.mobile-current-temp' : '.scene-copy').innerText(), /36/)
      if (!mobile) assert.match(await page.locator('.detail-nav').innerText(), /Tag 3 von 10/)
    })
  }

  for (const mobile of [false, true]) {
    const data = weatherFixture({ pollen: null })
    data.air.current = { european_aqi: null, pm2_5: null, pm10: null }
    data.air.hourly.european_aqi.fill(null)
    await check(`missing ${mobile ? 'mobile' : 'desktop'} air measurements are unknown, not zero`, { mobile, data }, async page => {
      if (mobile) {
        const teaser = page.locator('.mobile-metric-teaser > div').last()
        assert.match(await teaser.innerText(), /–\nKeine Daten/)
        await page.locator('.mobile-measurements summary').click()
        const tile = page.locator('.mobile-measurement-grid article').filter({ hasText: 'Luftqualität' })
        assert.match(await tile.innerText(), /– AQI/)
        assert.doesNotMatch(await tile.innerText(), /0 AQI|PM2,5 0/)
      } else {
        assert.equal(await page.locator('.aqi-gauge b').innerText(), '–')
        assert.match(await page.locator('.aqi-gauge').innerText(), /Keine Daten/)
        assert.equal(await page.locator('.air-chart .area-chart svg').count(), 0)
        assert.doesNotMatch(await page.locator('.aqi-instrument').innerText(), /0 AQI|Infinity|NaN|gleichbleibend 0/)
        assert.match(await page.locator('.aqi-particles').innerText(), /–/)
      }
    })
  }

  {
    const data = weatherFixture()
    data.air.current.european_aqi = 0
    data.air.current.pm2_5 = 0
    data.air.hourly.european_aqi.fill(0)
    await check('actual zero air measurements remain valid readings', { data }, async page => {
      assert.equal(await page.locator('.aqi-gauge b').innerText(), '0')
      assert.equal(await page.locator('.air-chart h2').innerText(), 'Sehr gut')
      assert.match(await page.locator('.aqi-trend').innerText(), /gleichbleibend 0 AQI/)
    })
  }

  {
    const data = weatherFixture()
    data.air.hourly.european_aqi.fill(null)
    for (const [index, value] of [[12, 20], [14, 40], [15, 50], [17, 30]]) data.air.hourly.european_aqi[index] = value
    await check('partial air forecasts show availability and do not connect across gaps', { data }, async page => {
      assert.match(await page.locator('.aqi-trend').innerText(), /4 von 8 Stunden verfügbar/)
      const lines = await page.locator('.air-chart polyline').evaluateAll(elements => elements.map(el => el.getAttribute('points')))
      assert.equal(lines.length, 1)
      assert.equal(lines[0].split(' ').length, 2)
      assert.doesNotMatch(lines[0], /NaN|null|undefined/)
    })
  }

  await check('search traps focus, announces options, supports arrow selection and restores the opener', {
    search: route => route.fulfill({ json: { results: [
      { id: 1, name: 'Berlin', latitude: 52, longitude: 13 },
      { id: 2, name: 'Berlin Mitte', latitude: 52.5, longitude: 13.4 }
    ] } })
  }, async page => {
    const opener = page.getByRole('button', { name: 'Marktoberdorf ändern' })
    await opener.click()
    const input = page.getByRole('combobox', { name: 'Ortsname' })
    assert.ok(await input.evaluate(el => document.activeElement === el))
    await page.keyboard.press('Shift+Tab')
    assert.ok(await page.getByRole('button', { name: 'Meinen Standort verwenden' }).evaluate(el => document.activeElement === el))
    await page.keyboard.press('Tab')
    assert.ok(await input.evaluate(el => document.activeElement === el))
    await input.fill('Berlin')
    await page.clock.runFor(350)
    await page.getByRole('option', { name: /Berlin Mitte/ }).waitFor()
    assert.equal(await input.getAttribute('aria-expanded'), 'true')
    await page.keyboard.press('ArrowDown')
    assert.equal(await page.getByRole('option').first().getAttribute('aria-selected'), 'true')
    assert.equal(await input.getAttribute('aria-activedescendant'), await page.getByRole('option').first().getAttribute('id'))
    await page.keyboard.press('Escape')
    assert.equal(await page.getByRole('dialog', { name: 'Ort suchen' }).count(), 0)
    assert.ok(await opener.evaluate(el => document.activeElement === el))
    await opener.click()
    await page.clock.runFor(350)
    await page.getByRole('option').first().waitFor()
    await page.keyboard.press('ArrowUp')
    await page.keyboard.press('Enter')
    await page.waitForFunction(() => document.querySelector('.scene-location')?.textContent.includes('Berlin Mitte'))
    assert.equal(await page.getByRole('dialog', { name: 'Ort suchen' }).count(), 0)
  })

  {
    const data = weatherFixture()
    data.hourly.temperature_2m.fill(18)
    data.hourly.uv_index.fill(2)
    data.hourly.wind_gusts_10m.fill(20)
    data.daily.precipitation_probability_max.fill(95)
    data.daily.wind_gusts_10m_max.fill(80)
    data.daily.uv_index_max.fill(10)
    data.hourly.precipitation_probability = data.hourly.time.map(time => +time.slice(11, 13) < 12 ? 95 : 0)
    await check('desktop and mobile explain the same window score instead of the day score', { data }, async page => {
      const best = page.locator('.today-decision.is-best')
      assert.match(await best.innerText(), /100\/100 Eignung für dieses Fenster/)
      assert.match(await best.innerText(), /Trocken, wenig Wind, angenehme Temperatur/)
      const label = await best.locator('h3').innerText()
      await page.setViewportSize({ width: 390, height: 844 })
      await page.locator('.mobile-app').waitFor()
      assert.equal(await page.locator('.mobile-best-window h2').innerText(), label)
      assert.equal(await page.locator('.mobile-score b').innerText(), '100')
      assert.match(await page.locator('.mobile-best-advice').innerText(), /Trocken, wenig Wind, angenehme Temperatur/)
      await page.locator('.mobile-best-window .explain-button').click()
      assert.match(await page.locator('.explain-dialog').innerText(), /ausschließlich das angezeigte Zeitfenster/)
    })
  }

  {
    const data = weatherFixture()
    data.hourly.precipitation_probability.fill(null)
    await check('missing hourly inputs produce no invented window rating', { data }, async page => {
      assert.match(await page.locator('.today-decision.is-best').innerText(), /Kein verlässliches Zeitfenster/)
      assert.match(await page.locator('.today-decision.is-best').innerText(), /–\/100/)
      await page.setViewportSize({ width: 390, height: 844 })
      await page.locator('.mobile-app').waitFor()
      assert.equal(await page.locator('.mobile-score b').innerText(), '–')
      assert.match(await page.locator('.mobile-best-advice').innerText(), /Keine Bewertung/)
    })
  }
} finally {
  await browser.close()
}
