import { useCallback, useEffect, useMemo, useLayoutEffect, useRef, useState } from 'react'
import { MapContainer, Marker, TileLayer, useMap } from 'react-leaflet'
import L from 'leaflet'
import { Pause, Play, SkipBack, SkipForward } from 'lucide-react'
import { frameLabel, frameTileUrl, loadRadar } from './rainviewer'
import { DWD_ATTRIBUTION, DWD_BOUNDS, DWD_LEGEND, loadDwdRadar, dwdImageUrl, insideDwd } from './dwdRadar'

import { combineRadarFrames, pairStatus } from './radarTimeline.js'

const OSM_URL = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png'
const OSM_ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
const RV_ATTRIBUTION = '<a href="https://www.rainviewer.com/">RainViewer</a>'

/* Wiedergabe. Fünf Minuten Wetter pro Bild darf man ruhig lesen können: eine
   knappe Sekunde Standzeit wirkt wie ein Film, am Ende der Schleife ein Moment
   Ruhe, damit klar wird, dass sie von vorn beginnt. */
const STEP_MS = 1150
const LOOP_HOLD_MS = 2600

/* So viele Zeitbilder dürfen gleichzeitig laden. Der DWD-Geoserver rendert
   jede Anfrage einzeln und braucht dafür mehrere Sekunden – mehr Anfragen
   parallel machen das Ganze nur langsamer. */
const MAX_INFLIGHT = 3

/* Ohne Wiedergabe reichen ein paar Bilder Vorrat; wer abspielt, bekommt alle. */
const IDLE_LOOKAHEAD = 4

/* RainViewer liefert seit 2026 nur noch Zoomstufen bis 7. Durch die 512er
   Kacheln und zoomOffset -1 entspricht das Leaflet-Zoomstufe 8; darüber wird
   die letzte verfügbare Stufe skaliert, statt leere Kacheln anzufragen. */
const RV_MAX_NATIVE_ZOOM = 8

/* Zeitraster altern lassen: alle fünf Minuten gibt es ein neueres Messbild. */
const REFRESH_MS = 5 * 60_000

const frameId = (source, frame) =>
  !frame ? null : source === 'dwd' ? frame.iso : frame.path

/* RainViewer zählt in Sekunden, der DWD in Millisekunden. */
const frameTime = (source, frame) =>
  !frame ? NaN : source === 'dwd' ? frame.time : frame.time * 1000

const frameClock = (source, frame) => !frame ? '––:––'
  : source === 'dwd'
    ? new Date(frame.time).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })
    : frameLabel(frame)

/** Abstand zum aktuellen Messbild, in Worten: das beantwortet „welche Uhrzeit ist jetzt“. */
function frameOffset(minutes) {
  if (!Number.isFinite(minutes)) return ''
  if (minutes === 0) return 'JETZT'
  const value = Math.abs(minutes)
  const label = value >= 60 && value % 60 === 0 ? `${value / 60} STD` : `${value} MIN`
  return minutes < 0 ? `VOR ${label}` : `IN ${label}`
}

/* Ortsnamen kommen aus einer fremden API und landen hier in einer HTML-Zeichenkette. */
const escapeHtml = s => String(s ?? '').replace(/[&<>"']/g, c =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))

const placePin = name => L.divIcon({
  className: 'radar-pin',
  html: `<i></i><b>${escapeHtml(name)}</b>`,
  iconSize: [16, 16],
  iconAnchor: [8, 8]
})

/* Kacheloptionen der RainViewer-Zeitschichten. 512er Kacheln vierteln die Zahl
   der Anfragen, nachgeladen wird erst nach dem Ziehen, und ein kleiner Puffer
   überbrückt das Verschieben. */
const TILE_BASE = {
  opacity: 0,
  className: 'radar-frame',
  tileSize: 512,
  keepBuffer: 2,
  updateWhenIdle: true,
  updateWhenZooming: false
}

/* ------------------------------------------------------------------------- */
/* DWD: ein georeferenziertes Einzelbild je Zeitpunkt.                        */
/*                                                                            */
/* Der DWD-Geoserver hat keinen Kachel-Cache – jede Kachel wird live in       */
/* mehreren Sekunden gerendert, gelegentlich bricht eine Anfrage ganz ab.     */
/* Mit Kacheln stauten sich über hundert langsame Anfragen und die Zeitreihe  */
/* wurde nie fertig. Ein Bild je Zeitpunkt ist eine einzige Anfrage, bleibt   */
/* beim Zoomen und Verschieben geografisch korrekt liegen und lässt sich bei  */
/* Fehlern billig wiederholen.                                                */
/* ------------------------------------------------------------------------- */

const DWD_RETRY_DELAYS = [1500, 4000]

/* Beim fünfminütigen Vorhersagelauf räumt der DWD kurz seine Dateien um und
   meldet dann „no radar data available“ für einzelne Zukunftszeitpunkte.
   Solche Bilder erst nach einer Weile wieder anfragen. */
const DWD_RETRY_AFTER_MS = 30_000

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms))

/* Der Geoserver braucht je nach Last 2 bis über 20 Sekunden. Irgendwann ist
   Abbrechen und neu Anfragen besser, als einen der wenigen Lade-Plätze
   minutenlang mit einer hängenden Anfrage zu belegen. */
const DWD_LOAD_TIMEOUT_MS = 45_000

const loadImage = (url, signal) => new Promise((resolve, reject) => {
  const image = new Image()
  const settle = result => {
    clearTimeout(timer)
    signal?.removeEventListener('abort', abort)
    image.onload = null
    image.onerror = null
    if (result) resolve(result)
    // Auch der Fall „Server schickt seine XML-Fehlermeldung mit Status 200“
    // landet hier: sie lässt sich nicht als Bild dekodieren.
    else reject(new Error('DWD-Radarbild konnte nicht geladen werden'))
  }
  const timer = setTimeout(() => {
    settle(null)
    image.src = ''
  }, DWD_LOAD_TIMEOUT_MS)
  const abort = () => { settle(null); image.src = '' }
  if (signal?.aborted) { abort(); return }
  signal?.addEventListener('abort', abort, { once: true })
  image.crossOrigin = 'anonymous'
  image.decoding = 'async'
  image.onload = () => settle(image)
  image.onerror = () => settle(null)
  image.src = url
})

/**
 * Der DWD-Stil malt fehlende Messwerte als graue Fläche und deren Rand in
 * Magenta. Beides ist Karten-Metadaten, kein Niederschlag – diese bekannten
 * No-Data-Pixel werden transparent gesetzt. Der DWD erlaubt den dafür
 * nötigen CORS-Zugriff.
 */
function stripNoData(image) {
  const canvas = document.createElement('canvas')
  canvas.width = image.naturalWidth
  canvas.height = image.naturalHeight
  const context = canvas.getContext('2d', { willReadFrequently: true })
  context.drawImage(image, 0, 0)
  const pixels = context.getImageData(0, 0, canvas.width, canvas.height)

  for (let i = 0; i < pixels.data.length; i += 4) {
    const r = pixels.data[i]
    const g = pixels.data[i + 1]
    const b = pixels.data[i + 2]
    const a = pixels.data[i + 3]
    const greyVeil = a >= 50 && a <= 115 && r >= 105 && r <= 150 &&
      Math.max(r, g, b) - Math.min(r, g, b) <= 8
    const noDataEdge = r >= 130 && b >= 130 && Math.abs(r - b) <= 22 && r - g >= 28

    if (greyVeil || noDataEdge) pixels.data[i + 3] = 0
  }

  context.putImageData(pixels, 0, 0)
  return canvas
}

const canvasToObjectUrl = canvas => new Promise((resolve, reject) => {
  canvas.toBlob(blob => blob
    ? resolve(URL.createObjectURL(blob))
    : reject(new Error('Canvas lieferte kein Bild')), 'image/png')
})

/**
 * Bildausschnitt für die DWD-Anfragen: die aktuelle Ansicht mit großzügigem
 * Rand, damit kleines Verschieben kein Neuladen auslöst, begrenzt auf das
 * Komposit. Die Daten lösen 1×1 km auf – zwei Pixel je Kilometer genügen.
 * Kleine Ausschnitte bekommen mindestens 320 Pixel, damit der Server die
 * Zellen glättet statt der Browser; das Limit schützt vor Riesenanfragen
 * beim Herauszoomen.
 */
function dwdViewBox(map) {
  const padded = map.getBounds().pad(0.35)
  const south = Math.max(padded.getSouth(), DWD_BOUNDS.south)
  const north = Math.min(padded.getNorth(), DWD_BOUNDS.north)
  const west = Math.max(padded.getWest(), DWD_BOUNDS.west)
  const east = Math.min(padded.getEast(), DWD_BOUNDS.east)
  if (south >= north || west >= east) return null

  const min = L.CRS.EPSG3857.project(L.latLng(south, west))
  const max = L.CRS.EPSG3857.project(L.latLng(north, east))
  const spanX = max.x - min.x
  const spanY = max.y - min.y
  const largest = Math.max(spanX, spanY)
  const pxPerMeter = Math.min(1536 / largest, Math.max(2 / 1000, 320 / largest))

  return {
    west: min.x, south: min.y, east: max.x, north: max.y,
    width: Math.max(32, Math.round(spanX * pxPerMeter)),
    height: Math.max(32, Math.round(spanY * pxPerMeter)),
    latLngBounds: L.latLngBounds([south, west], [north, east])
  }
}

/** Reicht der geladene Ausschnitt noch für die aktuelle Ansicht? */
function dwdBoxCovers(box, map) {
  const fresh = dwdViewBox(map)
  if (!fresh) return true // Ansicht liegt ganz außerhalb des Komposits.
  if (!box) return false
  const view = map.getBounds()
  const needed = L.latLngBounds(
    [Math.max(view.getSouth(), DWD_BOUNDS.south), Math.max(view.getWest(), DWD_BOUNDS.west)],
    [Math.min(view.getNorth(), DWD_BOUNDS.north), Math.min(view.getEast(), DWD_BOUNDS.east)]
  )
  if (!box.latLngBounds.contains(needed)) return false
  // Beim Hineinzoomen braucht es mehr Pixel je Meter; etwas Toleranz, damit
  // eine einzelne Zoomstufe nicht gleich alles neu lädt.
  return box.width / (box.east - box.west) >= 0.8 * (fresh.width / (fresh.east - fresh.west))
}

/** Load a bounded buffer and report success only after the display image decoded. */
function DwdFrames({ frames, index, opacity = 0.72, lookahead = 0, show = true, onFrameStatus = ignore }) {
  const map = useMap()
  const entries = useRef(new Map())
  const box = useRef(null)
  const alive = useRef(false)
  const [tick, setTick] = useState(0)
  const bump = useCallback(() => { if (alive.current) setTick(t => t + 1) }, [])

  useEffect(() => {
    alive.current = true
    const reset = () => {
      if (box.current && dwdBoxCovers(box.current, map) && dwdViewBox(map)) return
      entries.current.forEach(entry => {
        entry.controller.abort()
        entry.overlay?.remove()
        if (entry.url) URL.revokeObjectURL(entry.url)
      })
      entries.current.clear()
      box.current = dwdViewBox(map)
      frames.forEach(frame => onFrameStatus(frame.iso, box.current ? 'loading' : 'outside'))
      bump()
    }
    reset()
    map.on('moveend zoomend resize', reset)
    // Failed frames recover even when playback is paused.
    const retry = setInterval(bump, 5000)
    return () => {
      alive.current = false
      clearInterval(retry)
      map.off('moveend zoomend resize', reset)
      entries.current.forEach(entry => {
        entry.controller.abort()
        entry.overlay?.remove()
        if (entry.url) URL.revokeObjectURL(entry.url)
      })
      entries.current.clear()
      box.current = null
    }
  }, [map, frames, onFrameStatus, bump])

  useEffect(() => {
    const target = box.current
    if (!target || !frames[index]) return
    const run = async (entry, frame) => {
      const stale = () => !alive.current || entries.current.get(frame.iso) !== entry
      let url = null
      try {
        const base = dwdImageUrl({ ...target, ...frame })
        let image
        for (let attempt = 0; ; attempt += 1) {
          try {
            image = await loadImage(attempt || entry.retry ? `${base}&retry=${Date.now()}` : base, entry.controller.signal)
            break
          } catch (error) {
            if (stale() || attempt >= DWD_RETRY_DELAYS.length) throw error
            await sleep(DWD_RETRY_DELAYS[attempt])
            if (stale()) return
          }
        }
        if (stale()) return
        try {
          url = await canvasToObjectUrl(stripNoData(image))
          image = await loadImage(url, entry.controller.signal)
        } catch (error) {
          if (url) { URL.revokeObjectURL(url); url = null }
          if (entry.controller.signal.aborted) throw error
          // The already decoded original is a safe fallback if Canvas is unavailable.
        }
        if (stale()) { if (url) URL.revokeObjectURL(url); return }
        entry.url = url
        entry.overlay = L.imageOverlay(image, target.latLngBounds, {
          opacity: 0, className: 'radar-frame radar-frame-dwd',
          interactive: false, zIndex: 100, attribution: DWD_ATTRIBUTION
        }).addTo(map)
        entry.status = 'ready'
        onFrameStatus(frame.iso, 'ready')
      } catch {
        if (stale()) return
        entry.status = 'error'
        entry.failedAt = Date.now()
        onFrameStatus(frame.iso, 'error')
      } finally {
        if (!stale()) bump()
      }
    }
    const ensure = frame => {
      const known = entries.current.get(frame.iso)
      if (known && (known.status !== 'error' || Date.now() - known.failedAt < DWD_RETRY_AFTER_MS)) return
      if ([...entries.current.values()].filter(entry => entry.status === 'loading').length >= MAX_INFLIGHT) return
      const entry = { status: 'loading', controller: new AbortController(), retry: !!known }
      entries.current.set(frame.iso, entry)
      onFrameStatus(frame.iso, 'loading')
      run(entry, frame)
    }
    for (let step = 0; step <= lookahead && step < frames.length; step += 1) ensure(frames[(index + step) % frames.length])
  }, [map, frames, index, lookahead, tick, onFrameStatus, bump])

  useLayoutEffect(() => {
    entries.current.forEach((entry, id) => entry.overlay?.setOpacity(
      show && id === frames[index]?.iso && entry.status === 'ready' ? opacity : 0))
  }, [frames, index, show, opacity, tick])
  return null
}

/** Each viewport has its own readiness. Tile errors are never successful frames. */
function RainviewerFrames({ host, frames, index, opacity = 0.68, lookahead = 0, show = true, onFrameStatus = ignore }) {
  const map = useMap()
  const entries = useRef(new Map())
  const alive = useRef(false)
  const moving = useRef(false)
  const [tick, setTick] = useState(0)
  const bump = useCallback(() => { if (alive.current) setTick(t => t + 1) }, [])
  const dispose = useCallback(entry => {
    clearTimeout(entry.timer)
    entry.layer.off(entry.events)
    entry.layer.remove()
  }, [])

  useEffect(() => {
    alive.current = true
    const start = () => {
      moving.current = true
      entries.current.forEach(dispose)
      entries.current.clear()
      frames.forEach(frame => { if (frame) onFrameStatus(frame.path, 'loading') })
      bump()
    }
    const end = () => { moving.current = false; bump() }
    map.on('movestart zoomstart', start)
    map.on('moveend zoomend resize', end)
    const retry = setInterval(bump, 5000)
    return () => {
      alive.current = false
      moving.current = false
      clearInterval(retry)
      map.off('movestart zoomstart', start)
      map.off('moveend zoomend resize', end)
      entries.current.forEach(dispose)
      entries.current.clear()
    }
  }, [map, frames, onFrameStatus, dispose, bump])

  useEffect(() => {
    if (!host || moving.current) return
    const ensure = frame => {
      if (!frame) return
      const known = entries.current.get(frame.path)
      if (known && (known.status !== 'error' || Date.now() < known.retryAt)) return
      if ([...entries.current.values()].filter(entry => entry.status === 'loading').length >= MAX_INFLIGHT) return
      if (known) dispose(known)
      const attempt = known ? known.attempt + 1 : 0
      const layer = L.tileLayer(frameTileUrl(host, frame, 512) + (attempt ? `?retry=${Date.now()}` : ''), {
        ...TILE_BASE, zoomOffset: -1, maxNativeZoom: RV_MAX_NATIVE_ZOOM, attribution: RV_ATTRIBUTION
      })
      const entry = { layer, status: 'loading', attempt, errors: false }
      const valid = () => alive.current && entries.current.get(frame.path) === entry
      const finish = failed => {
        if (!valid() || entry.status !== 'loading') return
        clearTimeout(entry.timer)
        entry.status = failed ? 'error' : 'ready'
        entry.retryAt = Date.now() + (attempt < 2 ? 1500 * (attempt + 1) : DWD_RETRY_AFTER_MS)
        // Brief retries are still loading to the coordinator; exhausted retries may be skipped.
        onFrameStatus(frame.path, failed && attempt < 2 ? 'loading' : entry.status)
        if (failed) {
          layer.setOpacity(0)
          entry.timer = setTimeout(bump, entry.retryAt - Date.now())
        }
        bump()
      }
      entry.events = {
        loading: () => {
          if (!valid()) return
          entry.status = 'loading'
          entry.errors = false
          clearTimeout(entry.timer)
          entry.timer = setTimeout(() => finish(true), 20_000)
          onFrameStatus(frame.path, 'loading')
        },
        tileerror: () => { entry.errors = true },
        load: () => finish(entry.errors)
      }
      entries.current.set(frame.path, entry)
      onFrameStatus(frame.path, 'loading')
      layer.on(entry.events)
      entry.timer = setTimeout(() => finish(true), 20_000)
      layer.addTo(map)
      // A tiny/empty viewport can have no tiles and therefore no load event.
      if (!layer.isLoading()) finish(false)
    }
    for (let step = 0; step <= lookahead && step < frames.length; step += 1) ensure(frames[(index + step) % frames.length])
  }, [map, host, frames, index, lookahead, onFrameStatus, tick, dispose, bump])

  useLayoutEffect(() => {
    entries.current.forEach((entry, id) => entry.layer.setOpacity(
      show && id === frames[index]?.path && entry.status === 'ready' ? opacity : 0))
  }, [frames, index, show, opacity, tick])
  return null
}

/**
 * Zentriert die Karte. flyTo auf einem Container der Größe 0 erzeugt in Leaflet
 * NaN-Koordinaten und wirft – das riss vorher die komplette App mit.
 */
function Recenter({ center }) {
  const map = useMap()
  useEffect(() => {
    const [lat, lon] = center
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) return
    const size = map.getSize()
    if (!size.x || !size.y) {
      map.invalidateSize()
      map.setView(center, map.getZoom(), { animate: false })
      return
    }
    map.flyTo(center, map.getZoom(), { duration: 1.2 })
  }, [center, map])
  return null
}

/** Nach dem Mounten einmal nachmessen, falls das Layout noch nicht stand. */
function FixSize() {
  const map = useMap()
  useEffect(() => {
    // Nur im Dev-Server: Karten für die Konsole greifbar machen.
    if (import.meta.env.DEV) {
      window.__radarMaps = window.__radarMaps || new Set()
      window.__radarMaps.add(map)
      map.once('unload', () => window.__radarMaps.delete(map))
    }
    const id = requestAnimationFrame(() => map.invalidateSize())
    return () => cancelAnimationFrame(id)
  }, [map])
  return null
}

/**
 * Karten erst aufbauen, wenn sie in die Nähe des Sichtfelds kommen. Zwei
 * Leaflet-Karten, die beim Seitenaufbau gleichzeitig Kacheln ziehen, blockieren
 * einander – und die Radarkarte steht ganz unten auf der Seite.
 */
function useInView(rootMargin, fallbackMs = 4000) {
  const ref = useRef(null)
  const [state, setState] = useState({ near: false, visible: false })

  useEffect(() => {
    const el = ref.current
    if (!el) return
    if (typeof IntersectionObserver === 'undefined') {
      setState({ near: true, visible: true })
      return
    }
    // Sicherheitsnetz: Wer die Seite lange offen hat, soll die Karte fertig
    // vorfinden, auch wenn sie nie in die Nähe des Sichtfelds geraten ist.
    const late = setTimeout(() => setState(prev => (prev.near ? prev : { ...prev, near: true })), fallbackMs)
    const observer = new IntersectionObserver(([entry]) => {
      setState(prev => ({ near: prev.near || entry.isIntersecting, visible: entry.isIntersecting }))
    }, { rootMargin })
    observer.observe(el)
    return () => { clearTimeout(late); observer.disconnect() }
  }, [rootMargin, fallbackMs])

  return [ref, state.near, state.visible]
}

/** Im Hintergrundtab läuft die Schleife nicht weiter. */
function usePageAwake() {
  const [awake, setAwake] = useState(true)
  useEffect(() => {
    const sync = () => setAwake(!document.hidden)
    sync()
    document.addEventListener('visibilitychange', sync)
    return () => document.removeEventListener('visibilitychange', sync)
  }, [])
  return awake
}

function useRadarIndex(loader, active, epoch) {
  const [state, setState] = useState({ host: null, frames: [], pastCount: 0, nowIndex: 0, error: null })
  useEffect(() => {
    if (!active) return
    let alive = true
    let retry
    const load = () => loader()
      .then(data => { if (alive) setState({ ...data, error: null }) })
      .catch(error => {
        if (!alive) return
        setState(previous => ({ ...previous, error: error.message }))
        retry = setTimeout(load, 30_000)
      })
    load()
    return () => { alive = false; clearTimeout(retry) }
  }, [loader, active, epoch])
  return state
}

const Placeholder = () => (
  <p className="radar-placeholder"><span>RADAR WIRD GELADEN …</span></p>
)

export default function Radar({ latitude, longitude, placeName, compact = false }) {
  const [shellRef, near, visible] = useInView('300px')
  const awake = usePageAwake()

  /* Innerhalb des DWD-Komposits führt das feine deutsche Radar die Zeitleiste
     und liegt über der globalen RainViewer-Unterlage; außerhalb übernimmt
     RainViewer allein. */
  const inGermany = insideDwd(latitude, longitude)
  const [epoch, setEpoch] = useState(() => Date.now())
  const rv = useRadarIndex(loadRadar, near, epoch)
  const dwd = useRadarIndex(loadDwdRadar, near && inGermany, epoch)
  const source = inGermany && !(dwd.error && !dwd.frames.length) ? 'dwd' : 'rainviewer'
  const combined = useMemo(() => combineRadarFrames(dwd.frames, rv.frames), [dwd.frames, rv.frames])

  const frames = source === 'dwd' ? combined.frames : rv.frames
  const startIndex = source === 'dwd' ? Math.max(0, frames.findLastIndex(frame => !frame.forecast)) : Math.max(0, rv.pastCount - 1)
  const underlayFrames = combined.underlay
  const series = `${source}|${rv.host || ''}|${frames.map(frame => frameId(source, frame)).join(',')}|${underlayFrames.map(frame => frame?.path || '-').join(',')}`

  const [index, setIndex] = useState(startIndex)
  // Die Schleife startet nicht von selbst: Wer herscrollt, will erst einmal
  // sehen, wie es gerade aussieht.
  const [playing, setPlaying] = useState(false)
  const [statuses, setStatuses] = useState(() => new Map())
  const [knownSeries, setKnownSeries] = useState(series)
  const center = useMemo(() => [latitude, longitude], [latitude, longitude])

  const markStatus = useCallback((id, status) => {
    setStatuses(previous => {
      if (previous.get(id) === status) return previous
      return new Map(previous).set(id, status)
    })
  }, [])

  /* Neue Bilderreihe: Der Merkzettel der geladenen Bilder gilt nicht mehr, und
     losgehen soll es beim jüngsten Messbild – nicht bei der Vorhersage. Das
     gehört in den Render und nicht in einen Effekt: sonst lädt die Karte für
     einen Wimpernschlag noch das Bild, auf das der alte Zähler zeigt. */
  if (knownSeries !== series) {
    setKnownSeries(series)
    setStatuses(new Map())
    setIndex(startIndex)
  }

  const total = frames.length
  const at = total ? Math.min(index, total - 1) : 0
  const nextAt = total ? (at + 1) % total : 0
  const current = frames[at]
  const pairAt = position => pairStatus(
    statuses.get(frameId(source, frames[position])),
    statuses.get(underlayFrames[position]?.path),
    source === 'dwd' && !!underlayFrames[position])
  const currentPair = pairAt(at)
  const currentReady = currentPair.settled
  const currentFailed = currentPair.primaryFailed
  const nextReady = pairAt(nextAt).settled
  const live = playing && near && visible && awake

  /* Weitergeschaltet wird nur von einem stehenden auf ein fertig geladenes Bild.
     Fehlt das nächste noch, wartet die Schleife – der Effekt läuft von selbst
     wieder an, sobald es gemeldet wird. */
  useEffect(() => {
    if (!live || total < 2 || !currentReady || !nextReady) return
    const timer = setTimeout(() => setIndex(nextAt), at === total - 1 ? LOOP_HOLD_MS : STEP_MS)
    return () => clearTimeout(timer)
  }, [live, total, at, nextAt, currentReady, nextReady])

  const isForecast = source === 'dwd' ? !!current?.forecast : at >= rv.pastCount
  const clock = frameClock(source, current)

  /* Der Bezugspunkt der ganzen Leiste: das jüngste gemessene Bild. */
  const nowAt = Math.min(startIndex, Math.max(0, total - 1))
  const offset = frameOffset(
    Math.round((frameTime(source, current) - frameTime(source, frames[nowAt])) / 60000)
  )
  const nowMark = total > 1 ? (nowAt / (total - 1)) * 100 : 100

  /* Aufgefrischt wird nur in Ruhe: nicht mitten in der Wiedergabe und nicht,
     während jemand in der Vergangenheit stöbert – der Sprung zurück zu JETZT
     wäre sonst ein Teppichzieher. */
  useEffect(() => {
    if (playing || at !== nowAt) return
    const timer = setInterval(() => setEpoch(Date.now()), REFRESH_MS)
    return () => clearInterval(timer)
  }, [playing, at, nowAt])

  const status = rv.error && source === 'rainviewer' ? 'NICHT ERREICHBAR'
    : !total || !currentReady ? 'LÄDT …'
    : currentFailed && (source !== 'dwd' || !underlayFrames[at] || currentPair.secondaryFailed) ? `KEINE DATEN · ${offset}`
    : `${isForecast ? 'VORHERSAGE' : 'MESSUNG'} · ${offset}`
  const coverage = !currentReady ? 'RADAR WIRD GELADEN …'
    : statuses.get(frameId(source, current)) === 'outside' ? (underlayFrames[at] ? 'GLOBAL · AUSSERHALB DER DWD-ABDECKUNG' : 'KEINE RADARDATEN IN DIESEM AUSSCHNITT')
    : source !== 'dwd' ? (inGermany ? 'DWD NICHT VERFÜGBAR · GLOBAL' : 'RainViewer · global')
    : currentFailed ? (underlayFrames[at] && !currentPair.secondaryFailed ? 'DWD NICHT VERFÜGBAR · NUR GLOBAL' : 'RADARDATEN NICHT VERFÜGBAR')
    : currentPair.secondaryFailed ? 'GLOBAL NICHT VERFÜGBAR · NUR DWD'
    : !underlayFrames[at] ? (rv.error ? 'GLOBAL NICHT ERREICHBAR · NUR DWD' : 'NUR DWD · GLOBAL FÜR DIESE ZEIT NICHT VERFÜGBAR')
    : 'DWD + GLOBAL · SYNCHRON'

  const move = step => {
    if (total < 2) return
    setPlaying(false)
    setIndex((at + step + total) % total)
  }

  const lookahead = !visible || !awake ? 0 : playing ? total : IDLE_LOOKAHEAD

  return (
    <section className={`radar-section${compact ? ' is-compact' : ''}`} id="radar" aria-label="Regenradar">
      <div className="section-head">
        <div>
          <span className="eyebrow"><i className="is-live" />LIVE RADAR</span>
          <h2>Niederschlag<em>in Bewegung.</em></h2>
        </div>
        <p>
          Deutschland mit 1 km Auflösung und Kurzfristvorhersage vom DWD. Globale Messbilder von RainViewer laufen zu gemeinsamen Zeitpunkten synchron mit.
        </p>
      </div>

      <div className="radar-shell" ref={shellRef}>
        {near ? (
          <MapContainer
            center={center}
            zoom={source === 'dwd' ? 9 : 7}
            minZoom={4}
            maxZoom={source === 'dwd' ? 13 : 9}
            zoomControl
            attributionControl={!compact}
          >
            <TileLayer url={OSM_URL} attribution={OSM_ATTRIBUTION} maxZoom={19} />
            {source === 'dwd' ? (
              <>
                {underlayFrames.length > 0 && (
                  <RainviewerFrames
                    key={`underlay|${series}`}
                    host={rv.host} frames={underlayFrames} index={at}
                    opacity={0.68}
                    lookahead={lookahead}
                    show={currentReady}
                    onFrameStatus={markStatus}
                  />
                )}
                <DwdFrames
                  key={series}
                  frames={frames} index={at} show={currentReady}
                  opacity={0.72}
                  lookahead={lookahead}
                  onFrameStatus={markStatus}
                />
              </>
            ) : (
              <RainviewerFrames
                key={series}
                host={rv.host} frames={frames} index={at}
                opacity={0.68}
                lookahead={lookahead}
                show={currentReady}
                onFrameStatus={markStatus}
              />
            )}
            {Number.isFinite(latitude) && (
              <Marker position={center} icon={placePin(placeName)} interactive={false} keyboard={false} />
            )}
            <Recenter center={center} />
            <FixSize />
          </MapContainer>
        ) : <Placeholder />}

        <p className="radar-clock">
          <span>{clock}</span>
          <small>{status}</small>
        </p>

        {source === 'dwd' ? (
          <figure className="radar-legend-dwd">
            <img src={DWD_LEGEND} alt="Legende der Niederschlagsintensität in mm/h" width="100" height="390" loading="lazy" />
          </figure>
        ) : (
          <p className="radar-legend" aria-hidden="true">
            <span>leicht</span><i /><i /><i /><i /><i /><span>stark</span>
          </p>
        )}

        <p className="radar-source">
          {coverage}
        </p>

        <div className="radar-controls">
          <button type="button" onClick={() => move(-1)} aria-label="Vorheriges Radarbild"><SkipBack size={17} /></button>
          <button
            type="button"
            className="is-play"
            onClick={() => setPlaying(p => !p)}
            aria-label={playing ? 'Wiedergabe pausieren' : 'Wiedergabe starten'}
          >
            {playing ? <Pause size={18} /> : <Play size={18} />}
          </button>
          <button type="button" onClick={() => move(1)} aria-label="Nächstes Radarbild"><SkipForward size={17} /></button>

          {/* Zeitleiste: durchgezogen ist gemessen, schraffiert ist Vorhersage,
              die Marke sitzt auf dem jüngsten Messbild. Ein Slider statt eines
              Buttons pro Bild – vorher waren das ~30 Tabstopps. */}
          <div
            className={`radar-timeline${nowMark >= 80 ? ' is-late' : nowMark <= 20 ? ' is-early' : ''}`}
            style={{ '--now': `${nowMark}%` }}
          >
            <span className="timeline-track" aria-hidden="true"><i /></span>
            <input
              className="radar-slider"
              type="range"
              min="0"
              max={Math.max(0, total - 1)}
              value={at}
              onChange={e => { setPlaying(false); setIndex(Number(e.target.value)) }}
              aria-label="Zeitpunkt des Radarbildes"
              aria-valuetext={`${clock} – ${isForecast ? 'Vorhersage' : 'Messung'}, ${offset.toLowerCase()}`}
              disabled={total < 2}
            />
            <p className="timeline-scale" aria-hidden="true">
              {nowMark > 20 && <span className="is-start">{frameClock(source, frames[0])}</span>}
              <b>JETZT {frameClock(source, frames[nowAt])}</b>
              {nowMark < 80 && <span className="is-end">{frameClock(source, frames[total - 1])}</span>}
            </p>
          </div>
        </div>
      </div>
    </section>
  )
}

const ignore = () => {}

export function MiniRadar({ latitude, longitude, placeName, onOpen }) {
  const [shellRef, near] = useInView('200px')
  const inGermany = insideDwd(latitude, longitude)
  const [epoch, setEpoch] = useState(() => Date.now())
  useEffect(() => {
    const timer = setInterval(() => setEpoch(Date.now()), REFRESH_MS)
    return () => clearInterval(timer)
  }, [])
  const rv = useRadarIndex(loadRadar, near, epoch)
  const dwd = useRadarIndex(loadDwdRadar, near && inGermany, epoch)
  const source = inGermany && !(dwd.error && !dwd.frames.length) ? 'dwd' : 'rainviewer'
  const center = useMemo(() => [latitude, longitude], [latitude, longitude])
  const combined = useMemo(() => combineRadarFrames(dwd.frames, rv.frames), [dwd.frames, rv.frames])
  const pairIndex = combined.frames.findLastIndex((frame, index) => !frame.forecast && combined.underlay[index])
  const selected = pairIndex >= 0 ? pairIndex : combined.frames.findLastIndex(frame => !frame.forecast)
  const frames = useMemo(() => source === 'dwd'
    ? combined.frames.slice(Math.max(0, selected), Math.max(0, selected) + 1)
    : rv.frames.slice(Math.max(0, rv.pastCount - 1), rv.pastCount), [source, combined, selected, rv.frames, rv.pastCount])
  const rainviewerFrames = useMemo(() => source === 'dwd' ? [combined.underlay[selected] || null] : frames, [source, combined, selected, frames])
  const series = `${source}|${rv.host || ''}|${frameId(source, frames[0]) || ''}|${rainviewerFrames[0]?.path || ''}`
  const [statuses, setStatuses] = useState(() => new Map())
  const [knownSeries, setKnownSeries] = useState(series)
  if (knownSeries !== series) { setKnownSeries(series); setStatuses(new Map()) }
  const markStatus = useCallback((id, status) => setStatuses(previous => previous.get(id) === status ? previous : new Map(previous).set(id, status)), [])
  const primaryStatus = statuses.get(frameId(source, frames[0]))
  const worldStatus = statuses.get(rainviewerFrames[0]?.path)
  const settled = pairStatus(primaryStatus, worldStatus, source === 'dwd' && !!rainviewerFrames[0]).settled
  const badge = !settled ? 'RADAR LÄDT …'
    : primaryStatus !== 'ready' ? (worldStatus === 'ready' ? 'NUR GLOBAL' : 'KEINE RADARDATEN')
    : source !== 'dwd' ? 'LIVE RADAR' : worldStatus === 'ready' ? 'DWD + GLOBAL' : 'NUR DWD'

  return (
    <div className="mini-radar" ref={shellRef}>
      {near ? (
        <MapContainer
          center={center}
          zoom={source === 'dwd' ? 8 : 6}
          minZoom={4}
          maxZoom={source === 'dwd' ? 12 : 9}
          zoomControl
          attributionControl={false}
        >
          <TileLayer url={OSM_URL} maxZoom={19} />
          {source === 'dwd' ? (
            <>
              {rainviewerFrames[0] && (
                <RainviewerFrames
                  key={`underlay|${series}`}
                  host={rv.host} frames={rainviewerFrames} index={0} show={settled} onFrameStatus={markStatus}
                />
              )}
              <DwdFrames key={series} frames={frames} index={0} opacity={0.75} show={settled} onFrameStatus={markStatus} />
            </>
          ) : (
            <RainviewerFrames key={series} host={rv.host} frames={frames} index={0} show={settled} onFrameStatus={markStatus} />
          )}
          {Number.isFinite(latitude) && (
            <Marker position={center} icon={placePin(placeName)} interactive={false} keyboard={false} />
          )}
          <Recenter center={center} />
          <FixSize />
        </MapContainer>
      ) : <Placeholder />}
      <span className="mini-radar-badge"><i />{badge}</span>
      <button type="button" className="mini-radar-open" onClick={onOpen}>Vollbild öffnen</button>
    </div>
  )
}
