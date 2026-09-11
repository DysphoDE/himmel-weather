import { cachedRadarRequest } from './radarRequest.js'

/**
 * Hochauflösendes Radar des Deutschen Wetterdienstes.
 *
 * RainViewer liefert ein globales Mosaik mit grober Auflösung, das schon bei
 * mittlerem Zoom ausgereizt ist. Der DWD-Geoserver stellt dagegen das deutsche
 * Radarkomposit in 1×1 km und 5-Minuten-Schritten bereit – inklusive
 * Kurzfristvorhersage – und reprojiziert selbst nach EPSG:3857.
 */

export const DWD_WMS = 'https://maps.dwd.de/geoserver/dwd/ows'
export const DWD_LAYER = 'dwd:Radar_rv_product_1x1km_ger'
export const DWD_ATTRIBUTION = '&copy; <a href="https://www.dwd.de/" target="_blank" rel="noopener noreferrer">Deutscher Wetterdienst</a>'

export const DWD_LEGEND = `${DWD_WMS}?service=WMS&version=1.3.0&request=GetLegendGraphic`
  + `&format=image%2Fpng&layer=${encodeURIComponent(DWD_LAYER)}`

/* Abdeckung des Komposits laut GetCapabilities (EPSG:4326).
   Deckt Deutschland, Österreich, Schweiz, Norditalien und Nachbarländer ab. */
export const DWD_BOUNDS = { south: 45.69, north: 56.21, west: 1.47, east: 18.71 }

/**
 * GetMap-Anfrage für ein Einzelbild in Web-Mercator, dem Koordinatensystem der
 * Leaflet-Karte. Ein Bild je Zeitpunkt statt vieler Kacheln: Der Geoserver
 * rendert jede Anfrage live und braucht dafür mehrere Sekunden – je weniger
 * Anfragen, desto eher wird die Zeitreihe fertig.
 */
export const dwdImageUrl = ({ west, south, east, north, width, height, iso, referenceTime }) =>
  `${DWD_WMS}?service=WMS&version=1.3.0&request=GetMap`
  + `&layers=${encodeURIComponent(DWD_LAYER)}&format=image%2Fpng&transparent=true`
  + `&crs=EPSG%3A3857&bbox=${west},${south},${east},${north}`
  + `&width=${width}&height=${height}&time=${encodeURIComponent(iso)}`
  + (referenceTime ? `&DIM_REFERENCE_TIME=${encodeURIComponent(referenceTime)}` : '')

/** Etwas Rand lassen: am Rand des Komposits fehlen Daten. */
export const insideDwd = (lat, lon) =>
  Number.isFinite(lat) && Number.isFinite(lon) &&
  lat > DWD_BOUNDS.south + 0.6 && lat < DWD_BOUNDS.north - 0.6 &&
  lon > DWD_BOUNDS.west + 0.6 && lon < DWD_BOUNDS.east - 0.6

/** Parse the advertised time dimension (intervals and individual timestamps). */
export function dimensionTimes(value) {
  const times = new Set()
  for (const part of value.split(',')) {
    const [start, end, duration] = part.trim().split('/')
    const from = Date.parse(start)
    if (!Number.isFinite(from)) continue
    if (!end) { times.add(from); continue }
    const match = /^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/.exec(duration || '')
    const step = match && ((+match[1] || 0) * 3600 + (+match[2] || 0) * 60 + (+match[3] || 0)) * 1000
    const to = Date.parse(end)
    if (!step || !Number.isFinite(to) || (to - from) / step > 10000) continue
    for (let time = from; time <= to; time += step) times.add(time)
  }
  return [...times].sort((a, b) => a - b)
}

export function advertisedDwdFrames(timeDimension, referenceTime) {
  const anchor = Date.parse(referenceTime)
  if (!Number.isFinite(anchor)) throw new Error('DWD-Messzeit fehlt')
  const frames = dimensionTimes(timeDimension)
    .filter(time => time >= anchor - 60 * 60_000 && time <= anchor + 60 * 60_000)
    .map(time => ({ time, iso: new Date(time).toISOString(), forecast: time > anchor,
      ...(time > anchor ? { referenceTime } : {}) }))
  if (!frames.length || !frames.some(frame => !frame.forecast)) throw new Error('Keine DWD-Radarzeiten verfügbar')
  return { frames, nowIndex: frames.findLastIndex(frame => !frame.forecast) }
}

export const loadDwdRadar = cachedRadarRequest(
  `https://maps.dwd.de/geoserver/dwd/${DWD_LAYER.split(':').at(-1)}/wms?service=WMS&version=1.3.0&request=GetCapabilities`,
  async response => {
    const xml = new DOMParser().parseFromString(await response.text(), 'text/xml')
    const layer = [...xml.getElementsByTagName('Layer')].find(layer =>
      [...layer.children].some(node => node.localName === 'Name' && node.textContent.split(':').at(-1) === DWD_LAYER.split(':').at(-1)))
    const dimensions = [...(layer?.getElementsByTagName('Dimension') || [])]
    const time = dimensions.find(node => node.getAttribute('name')?.toLowerCase() === 'time')
    const reference = dimensions.find(node => node.getAttribute('name')?.toLowerCase() === 'reference_time')
    return advertisedDwdFrames(time?.textContent || '', reference?.getAttribute('default'))
  }
)
