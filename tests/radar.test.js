import test from 'node:test'
import assert from 'node:assert/strict'
import { combineRadarFrames, pairStatus } from '../src/radarTimeline.js'
import { advertisedDwdFrames, dimensionTimes, dwdImageUrl } from '../src/dwdRadar.js'
import { normalizeRadar } from '../src/rainviewer.js'
import { cachedRadarRequest } from '../src/radarRequest.js'

const anchor = Date.parse('2026-09-11T12:00:00Z')
const dwd = [-20, -15, -10, -5, 0, 5, 10].map(minutes => ({ time: anchor + minutes * 60000, forecast: minutes > 0 }))
const world = [-20, -10, 0].map(minutes => ({ time: (anchor + minutes * 60000) / 1000, path: `/radar/${minutes}` }))

test('common history advances both sources at exactly the same time; future has no frozen world image', () => {
  const result = combineRadarFrames(dwd, world)
  assert.deepEqual(result.frames.map(frame => (frame.time - anchor) / 60000), [-20, -10, 0, 5, 10])
  result.underlay.forEach((frame, index) => { if (frame) assert.equal(frame.time * 1000, result.frames[index].time) })
  assert.deepEqual(result.underlay.slice(-2), [null, null])
})
test('missing world frames are omitted within the overlap, not replaced by old observations', () => {
  const result = combineRadarFrames(dwd, [world[0], world[2]])
  assert.deepEqual(result.frames.map(frame => (frame.time - anchor) / 60000), [-20, 0, 5, 10])
  assert.equal(combineRadarFrames(dwd, []).frames.length, dwd.length)
})
test('playback waits for both sources, including viewport invalidation, and tolerates exhausted errors', () => {
  assert.equal(pairStatus('ready', 'loading', true).settled, false)
  assert.equal(pairStatus('loading', 'ready', true).settled, false)
  assert.equal(pairStatus('ready', 'ready', true).settled, true)
  assert.deepEqual(pairStatus('ready', 'error', true), { settled: true, primaryFailed: false, secondaryFailed: true })
  assert.equal(pairStatus('ready', undefined, false).settled, true)
  assert.equal(pairStatus('outside', 'ready', true).settled, true)
})
test('DWD frames use the published reference run and available horizon', () => {
  const result = advertisedDwdFrames('2026-09-11T11:00:00Z/2026-09-11T12:15:00Z/PT5M', '2026-09-11T12:00:00Z')
  assert.equal(result.nowIndex, 12)
  assert.equal(result.frames.length, 16)
  assert.equal(result.frames[12].forecast, false)
  assert.equal(result.frames[13].referenceTime, '2026-09-11T12:00:00Z')
  assert.match(dwdImageUrl({ ...result.frames[13], west: 1, south: 2, east: 3, north: 4, width: 32, height: 32 }), /DIM_REFERENCE_TIME=/)
  assert.equal(dimensionTimes('bad,2026-09-11T12:00:00Z,2026-09-11T12:00:00Z').length, 1)
  assert.throws(() => advertisedDwdFrames('', null))
})
test('global metadata is sorted, deduplicated and rejects an empty index', () => {
  const result = normalizeRadar({ radar: { past: [world[2], {}, world[0], world[2]], nowcast: [world[0]] } })
  assert.deepEqual(result.frames, [world[0], world[2]])
  assert.equal(result.pastCount, 2)
  assert.throws(() => normalizeRadar({ radar: { past: [] } }))
})
test('metadata consumers share an in-flight request and a successful cache', async () => {
  const original = globalThis.fetch
  let calls = 0
  globalThis.fetch = async () => { calls += 1; return { ok: true, json: async () => ({ frames: [1] }) } }
  try {
    const load = cachedRadarRequest('https://example.test/radar', response => response.json())
    const first = load()
    assert.equal(load(), first)
    assert.deepEqual(await first, { frames: [1] })
    await load()
    assert.equal(calls, 1)
  } finally { globalThis.fetch = original }
})
test('a failed metadata request is retried and never poisons the shared cache', async () => {
  const original = globalThis.fetch
  let calls = 0
  globalThis.fetch = async () => { calls += 1; return { ok: calls > 3 } }
  try {
    const load = cachedRadarRequest('https://example.test/radar', async () => 'recovered')
    await assert.rejects(load(), /nicht erreichbar/)
    assert.equal(calls, 3)
    assert.equal(await load(), 'recovered')
    assert.equal(calls, 4)
  } finally { globalThis.fetch = original }
})
