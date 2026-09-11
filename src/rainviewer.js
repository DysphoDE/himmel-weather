import { cachedRadarRequest } from './radarRequest.js'

const FALLBACK_HOST = 'https://tilecache.rainviewer.com'
const INDEX_URL = 'https://api.rainviewer.com/public/weather-maps.json'

export function normalizeRadar(data) {
  const normalize = frames => [...new Map((Array.isArray(frames) ? frames : [])
    .filter(frame => Number.isFinite(frame?.time) && typeof frame.path === 'string' && frame.path.startsWith('/'))
    .map(frame => [frame.time, frame])).values()].sort((a, b) => a.time - b.time)
  const past = normalize(data.radar?.past)
  if (!past.length) throw new Error('Keine globalen Radardaten verfügbar')
  const nowcast = normalize(data.radar?.nowcast).filter(frame => frame.time > past.at(-1).time)
  return { host: data.host || FALLBACK_HOST, frames: [...past, ...nowcast], pastCount: past.length }
}

export const loadRadar = cachedRadarRequest(INDEX_URL, async response => normalizeRadar(await response.json()))

/* Die Kachelgröße steht im Pfad; 512 bedeutet ein Viertel der Anfragen. */
export const frameTileUrl = (host, frame, size = 512) => `${host}${frame.path}/${size}/{z}/{x}/{y}/6/1_1.png`

export const frameLabel = frame => frame
  ? new Date(frame.time * 1000).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })
  : '––:––'
