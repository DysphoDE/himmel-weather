/* Werte aus der Open-Meteo-Geocoding-API, damit der Standardort dieselbe
   Kennung trägt wie ein per Suche gewählter. Liegt hier und nicht in App.jsx,
   weil der Widget-Modus denselben Rückfallort braucht. */
export const DEFAULT_PLACE = {
  id: 2873291,
  name: 'Marktoberdorf',
  admin1: 'Bayern',
  country: 'Deutschland',
  latitude: 47.77964,
  longitude: 10.61713,
  population: 18505
}

export const WMO = {
  0: ['Klar', 'clear'], 1: ['Überwiegend klar', 'clear'], 2: ['Leicht bewölkt', 'partly'], 3: ['Bedeckt', 'cloud'],
  45: ['Neblig', 'fog'], 48: ['Reifnebel', 'fog'], 51: ['Leichter Niesel', 'rain'], 53: ['Nieselregen', 'rain'],
  55: ['Starker Niesel', 'rain'], 56: ['Gefrierender Niesel', 'snow'], 57: ['Starker Eisniesel', 'snow'],
  61: ['Leichter Regen', 'rain'], 63: ['Regen', 'rain'], 65: ['Starker Regen', 'rain'], 66: ['Gefrierender Regen', 'snow'],
  67: ['Starker Eisregen', 'snow'], 71: ['Leichter Schneefall', 'snow'], 73: ['Schneefall', 'snow'], 75: ['Starker Schneefall', 'snow'],
  77: ['Schneekörner', 'snow'], 80: ['Regenschauer', 'rain'], 81: ['Starke Schauer', 'rain'], 82: ['Heftige Schauer', 'storm'],
  85: ['Schneeschauer', 'snow'], 86: ['Starke Schneeschauer', 'snow'], 95: ['Gewitter', 'storm'], 96: ['Gewitter mit Hagel', 'storm'], 99: ['Schweres Gewitter', 'storm']
}

export const weatherLabel = code => WMO[code]?.[0] || 'Wechselhaft'
export const weatherKind = code => WMO[code]?.[1] || 'cloud'
export const cardinal = deg => ['N', 'NO', 'O', 'SO', 'S', 'SW', 'W', 'NW'][Math.round((deg || 0) / 45) % 8]
export const fmtTime = iso => new Date(iso).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })
export const fmtDay = iso => new Date(iso).toLocaleDateString('de-DE', { weekday: 'short' }).replace('.', '')
export const fmtDayLong = iso => new Date(iso).toLocaleDateString('de-DE', { weekday: 'long' })
export const fmtDate = iso => new Date(iso).toLocaleDateString('de-DE', { day: '2-digit', month: 'long' })
export const fmtHour = iso => new Date(iso).toLocaleTimeString('de-DE', { hour: '2-digit' })
/* Nur die Stundenzahl: Das deutsche "19 Uhr" ist in einer Achse mit acht
   Spalten breiter als die Spalte und stößt an den Nachbarn. */
export const hourNumber = iso => String(new Date(iso).getHours()).padStart(2, '0')

/**
 * Niederschlag in Litern pro Quadratmeter. Das ist dieselbe Zahl, die
 * Meteorologen in Millimetern angeben – ein Liter auf einem Quadratmeter steht
 * genau einen Millimeter hoch –, aber "8 L/m²" beantwortet die Frage "wie viel
 * Wasser kommt da runter" ohne Umrechnung im Kopf.
 */
export const PRECIP_UNIT = 'L/m²'
export const precipValue = mm => {
  const value = Number(mm) || 0
  // Unter zehn Litern trägt die Nachkommastelle noch Information, darüber nicht.
  return value.toLocaleString('de-DE', { maximumFractionDigits: value < 10 ? 1 : 0 })
}
export const fmtPrecip = mm => `${precipValue(mm)} ${PRECIP_UNIT}`

/* Skalen einmal zentral, damit dieselbe Zahl überall dieselbe Wortmarke bekommt.
   Die Stufen sind zugleich die Einordnung in den Erklärtexten (siehe
   explanations.js): Wortmarke im Wert und Erklärung dahinter können so nicht
   auseinanderlaufen. `range` beschreibt die Spanne für Menschen, `up to` ist
   die Obergrenze für die Zuordnung. */
const tierOf = (scale, value) => (scale.find(step => value < step.upTo) ?? scale.at(-1)).label

export const UV_SCALE = [
  { upTo: 3, label: 'Niedrig', range: '0–2', hint: 'Kein Schutz nötig' },
  { upTo: 6, label: 'Mittel', range: '3–5', hint: 'Nach einer Stunde wird Sonnencreme sinnvoll' },
  { upTo: 8, label: 'Hoch', range: '6–7', hint: 'Mittags Schatten und Creme' },
  { upTo: 11, label: 'Sehr hoch', range: '8–10', hint: 'Haut rötet in rund 20 Minuten' },
  { upTo: Infinity, label: 'Extrem', range: 'ab 11', hint: 'In Deutschland praktisch nie' }
]
export const uvTier = v => tierOf(UV_SCALE, v)
export const uvAdvice = v => v < 3 ? 'Kein Schutz nötig' : v < 6 ? 'Schutz empfohlen' : v < 8 ? 'Schutz nötig' : 'Mittags Schatten suchen'

export const AQI_SCALE = [
  { upTo: 20, label: 'Sehr gut', range: '0–19' },
  { upTo: 40, label: 'Gut', range: '20–39', hint: 'In Deutschland der Normalfall' },
  { upTo: 60, label: 'Mäßig', range: '40–59' },
  { upTo: 80, label: 'Schlecht', range: '60–79', hint: 'Empfindliche meiden lange Anstrengung draußen' },
  { upTo: 100, label: 'Sehr schlecht', range: '80–99' },
  { upTo: Infinity, label: 'Extrem belastet', range: 'ab 100' }
]
export const aqiTier = v => v == null ? 'Keine Daten' : tierOf(AQI_SCALE, v)

export const POLLEN_SCALE = [
  { upTo: 10, label: 'Gering', range: '0–9 Pollen/m³' },
  { upTo: 50, label: 'Mäßig', range: '10–49 Pollen/m³' },
  { upTo: 150, label: 'Hoch', range: '50–149 Pollen/m³', hint: 'Zur Hauptblüte üblich' },
  { upTo: Infinity, label: 'Sehr hoch', range: 'ab 150 Pollen/m³' }
]
export const pollenTier = v => tierOf(POLLEN_SCALE, v)
/* Eigene Form für den Satzbau: "Gering Belastung" wäre falsch. */
export const pollenPhrase = v => `${{ Gering: 'Geringe', Mäßig: 'Mäßige', Hoch: 'Hohe', 'Sehr hoch': 'Sehr hohe' }[pollenTier(v)]} Belastung`

/* Absteigend, weil die Wortmarken an Untergrenzen hängen. */
export const VISIBILITY_SCALE = [
  { above: 20000, label: 'Sehr klare Fernsicht', range: 'über 20 km' },
  { above: 10000, label: 'Gute Fernsicht', range: '10–20 km' },
  { above: 4000, label: 'Mäßige Sicht', range: '4–10 km' },
  { above: -Infinity, label: 'Eingeschränkte Sicht', range: 'unter 4 km', hint: 'Unter 1 km spricht man von Nebel' }
]
export const visibilityTier = m => VISIBILITY_SCALE.find(step => m > step.above).label

export const HUMIDITY_SCALE = [
  { upTo: 35, label: 'Trocken', range: 'unter 35 %', hint: 'Haut und Schleimhäute trocknen aus' },
  { upTo: 65, label: 'Angenehm', range: '35–64 %' },
  { upTo: 80, label: 'Eher feucht', range: '65–79 %', hint: 'Draußen der Normalfall' },
  { upTo: Infinity, label: 'Sehr feucht', range: 'ab 80 %', hint: 'Mit Wärme zusammen schwül' }
]
export const humidityTier = v => tierOf(HUMIDITY_SCALE, v)

export const PRESSURE_SCALE = [
  { upTo: 1000, label: 'Tiefdruck', range: 'unter 1000 hPa', hint: 'Wechselhaft, oft Wind und Regen' },
  { upTo: 1021, label: 'Normalbereich', range: '1000–1020 hPa' },
  { upTo: Infinity, label: 'Hochdruck', range: 'ab 1021 hPa', hint: 'Ruhig und meist trocken' }
]
/* Auf die angezeigte, gerundete Zahl beziehen – sonst steht "1021 hPa" neben
   der Wortmarke des Normalbereichs. */
export const pressureTier = v => tierOf(PRESSURE_SCALE, Math.round(v ?? 0))

/* Nur Beschriftung, keine Wortmarke im Wert: Wind steht überall als Zahl. */
export const WIND_SCALE = [
  { upTo: 20, label: 'Schwach', range: 'unter 20 km/h', hint: 'Fällt im Alltag nicht auf' },
  { upTo: 39, label: 'Mäßig', range: '20–38 km/h', hint: 'Zweige bewegen sich, Haare fliegen' },
  { upTo: 62, label: 'Frisch bis stark', range: '39–61 km/h', hint: 'Regenschirme werden schwierig' },
  { upTo: 89, label: 'Sturmböen', range: '62–88 km/h', hint: 'Äste brechen, Loses fliegt umher' },
  { upTo: Infinity, label: 'Orkanartig', range: 'ab 89 km/h', hint: 'Schäden möglich – drinnen bleiben' }
]

export const PRECIP_SCALE = [
  { upTo: 1, label: 'Kaum messbar', range: 'unter 1 L/m²', hint: 'Straße wird feucht, Schirm unnötig' },
  { upTo: 5, label: 'Leichter Regen', range: '1–5 L/m²' },
  { upTo: 15, label: 'Deutlicher Regen', range: '5–15 L/m²', hint: 'Ein normaler Landregentag' },
  { upTo: 30, label: 'Kräftiger Regen', range: '15–30 L/m²', hint: 'Feste Schuhe, Pfützen bleiben stehen' },
  { upTo: Infinity, label: 'Sehr viel Wasser', range: 'ab 30 L/m²', hint: 'Überflutete Straßen möglich' }
]

export const SCORE_SCALE = [
  { upTo: 20, label: 'Lieber drinnen', range: '0–19' },
  { upTo: 40, label: 'Mäßig', range: '20–39' },
  { upTo: 60, label: 'Brauchbar', range: '40–59' },
  { upTo: 80, label: 'Gut', range: '60–79' },
  { upTo: Infinity, label: 'Ideal', range: 'ab 80' }
]

/**
 * Draußen-Eignung, 0–100. Kein amtlicher Wert, sondern die Hausmarke von
 * himmel°: Start bei 100, abgezogen wird für Regenrisiko, Böen über 25 km/h,
 * UV über 6 sowie Hitze über 28° und Kälte unter 8°.
 *
 * Steht bewusst hier und nicht in den Ansichten: Tagesansicht und Heute-Seite
 * rechneten vorher mit eigenen Gewichten und zeigten für denselben Tag
 * verschiedene Punktzahlen.
 */
export const outdoorScore = ({ rainMax, gusts, uv, high }) => {
  /* Die API liefert für einzelne Tage null; das würde sich durch die ganze
     Rechnung als NaN ziehen. */
  const rain = Number(rainMax) || 0
  const gust = Number(gusts) || 0
  const uvi = Number(uv) || 0
  const peak = Number.isFinite(high) ? high : 18
  return Math.max(0, Math.min(100, Math.round(
    100 - rain * 0.7 - Math.max(0, gust - 25) * 1.1
    - Math.max(0, uvi - 6) * 4 - Math.max(0, peak - 28) * 2.5 - Math.max(0, 8 - peak) * 2
  )))
}

export const getRisk = data => {
  const c = data?.current || {}
  const i = Math.max(0, data?.hourly?.time?.findIndex(t => new Date(t) >= new Date()) || 0)
  const precip = Math.max(...(data?.hourly?.precipitation_probability?.slice(i, i + 8) || [0]))
  if (c.weather_code >= 95 || c.wind_gusts_10m >= 75) return { level: 'hoch', text: 'Unwetterpotenzial', detail: 'Gewitter oder schwere Böen möglich', color: '#d64550', steps: 4 }
  if (c.wind_gusts_10m >= 50 || precip >= 75) return { level: 'erhöht', text: 'Aufmerksam bleiben', detail: 'Kräftiger Niederschlag oder Böen möglich', color: '#d18a26', steps: 3 }
  if (c.wind_gusts_10m >= 35 || precip >= 45) return { level: 'gering', text: 'Leicht wechselhaft', detail: 'Vereinzelt Schauer oder frischer Wind', color: '#4f9bb5', steps: 2 }
  return { level: 'niedrig', text: 'Ruhige Wetterlage', detail: 'Aktuell keine markanten Signale', color: '#3f9e78', steps: 1 }
}

/**
 * Eine einzige Ableitung für alle Tagesaussagen. Vorher hatten Überschrift (<35 %),
 * Outdoor-Karte (<40 %) und Schirm-Karte (<25 %) je eigene Schwellen – dadurch stand
 * "Gute Bedingungen" neben "Schirm einpacken".
 */
export const deriveDay = model => {
  const d = model.d
  const rainMax = d.precipitation_probability_max[0] ?? 0
  const rainSum = d.precipitation_sum[0] ?? 0
  const gusts = d.wind_gusts_10m_max[0] ?? 0
  const uv = d.uv_index_max[0] ?? 0
  const high = d.temperature_2m_max[0] ?? 0

  const tier = rainMax >= 60 || rainSum >= 2 ? 'wet' : rainMax >= 30 || rainSum >= 0.5 ? 'mixed' : 'dry'
  const windy = gusts >= 50

  const score = outdoorScore({ rainMax, gusts, uv, high })

  const headline = windy && tier !== 'dry' ? 'Windig und nass – zieh dich warm an.'
    : tier === 'wet' ? 'Heute besser mit Regenschutz.'
    : tier === 'mixed' ? 'Wechselhaft – plane etwas flexibel.'
    : windy ? 'Trocken, aber kräftiger Wind.'
    : 'Ein guter Tag, um rauszugehen.'

  return {
    tier, windy, score, headline,
    rainMax, rainSum, gusts, uv, high,
    risk: getRisk({ current: model.c, hourly: model.h }),
    summary: `${weatherLabel(model.c.weather_code)}, Höchstwert ${Math.round(high)} °. ${rainMax} % Regenrisiko, Böen bis ${Math.round(gusts)} km/h, UV-Maximum ${Math.round(uv)}.`,
    outdoor: {
      dry: ['Gute Bedingungen', 'Der Tag eignet sich gut für Bewegung draußen.'],
      mixed: ['Plan B mitdenken', `Mit ${rainMax} % Regenrisiko lohnt eine flexible Route.`],
      wet: ['Lieber nach drinnen verlegen', `${rainMax} % Regenrisiko und ${fmtPrecip(rainSum)} erwartete Menge.`]
    }[tier],
    umbrella: {
      dry: ['Schirm kann zuhause bleiben', `Nur ${rainMax} % Regenrisiko, keine nennenswerte Menge.`],
      mixed: ['Schirm vorsichtshalber', `${rainMax} % Spitzenrisiko, insgesamt ${fmtPrecip(rainSum)}.`],
      wet: ['Schirm einpacken', `${rainMax} % Spitzenrisiko, insgesamt ${fmtPrecip(rainSum)}.`]
    }[tier]
  }
}

/** Stundenwerte genau eines Vorhersagetages, unabhängig von der aktuellen Uhrzeit. */
export const hoursOfDay = (hourly, date) => {
  const rows = []
  for (let i = 0; i < hourly.time.length; i++) {
    if (!hourly.time[i].startsWith(date)) continue
    rows.push({
      index: i,
      time: hourly.time[i],
      temperature: hourly.temperature_2m[i],
      apparent: hourly.apparent_temperature?.[i],
      code: hourly.weather_code[i],
      cloudCover: hourly.cloud_cover?.[i],
      rainChance: hourly.precipitation_probability?.[i] ?? 0,
      rainAmount: hourly.precipitation?.[i] ?? 0,
      /* Optional gelesen: Der Widget-Modus fragt nur die Felder ab, die er
         zeigt, ruft über dayCode() aber dieselbe Ableitung auf. */
      wind: hourly.wind_speed_10m?.[i],
      gusts: hourly.wind_gusts_10m?.[i],
      uv: hourly.uv_index?.[i],
      humidity: hourly.relative_humidity_2m?.[i],
      visibility: hourly.visibility?.[i],
      isDay: hourly.is_day ? hourly.is_day[i] === 1 : true
    })
  }
  return rows
}

/* Open-Meteo setzt daily.weather_code auf den schwersten Stundencode des
   ganzen Tages – eine Nieselstunde um 01 Uhr nachts stempelt so einen sonst
   trockenen Sommertag als Regentag. Hier beschreibt stattdessen der Zeitraum
   8–20 Uhr den Tag: Gewitter zählt immer, Regen und Schnee erst ab spürbarer
   Dauer oder Menge, ansonsten gilt der häufigste Code. */
export const dayCode = (hourly, date, fallback) => {
  const hours = hoursOfDay(hourly, date).filter(h => {
    const hour = Number(h.time.slice(11, 13))
    return hour >= 8 && hour <= 20
  })
  if (!hours.length) return fallback

  const storm = hours.filter(h => h.code >= 95)
  if (storm.length) return Math.max(...storm.map(h => h.code))

  const wet = hours.filter(h => h.code >= 51)
  if (wet.length >= 3 || wet.reduce((sum, h) => sum + h.rainAmount, 0) >= 1) {
    return Math.max(...wet.map(h => h.code))
  }

  const counts = new Map()
  hours.forEach(h => counts.set(h.code, (counts.get(h.code) || 0) + 1))
  return [...counts.entries()].sort((a, b) => b[1] - a[1] || b[0] - a[0])[0][0]
}

export async function searchPlaces(query) {
  const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(query)}&count=7&language=de&format=json`
  const res = await fetch(url)
  if (!res.ok) throw new Error('Ortssuche derzeit nicht erreichbar')
  return (await res.json()).results || []
}

export async function fetchWeather(latitude, longitude) {
  /* pressure_msl statt surface_pressure: Der Bodendruck fällt mit der Höhe
     (in 729 m sind 933 hPa völlig normal) und wurde von den Schwellen unten
     jedes Mal als "Tiefdruck" gelesen. Auf Meeresniveau zurückgerechnet ist
     der Wert zwischen Orten vergleichbar – so meint es auch der Wetterbericht. */
  const current = [
    'temperature_2m', 'relative_humidity_2m', 'apparent_temperature', 'is_day', 'precipitation', 'weather_code',
    'cloud_cover', 'pressure_msl', 'wind_speed_10m', 'wind_direction_10m', 'wind_gusts_10m'
  ].join(',')
  const hourly = [
    'temperature_2m', 'apparent_temperature', 'relative_humidity_2m', 'precipitation_probability', 'precipitation',
    'weather_code', 'cloud_cover', 'visibility', 'wind_speed_10m', 'wind_gusts_10m', 'uv_index', 'is_day'
  ].join(',')
  const daily = [
    'weather_code', 'temperature_2m_max', 'temperature_2m_min', 'apparent_temperature_max', 'apparent_temperature_min',
    'sunrise', 'sunset', 'uv_index_max', 'precipitation_sum', 'precipitation_hours', 'precipitation_probability_max',
    'wind_speed_10m_max', 'wind_gusts_10m_max', 'wind_direction_10m_dominant'
  ].join(',')

  const weatherUrl = `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=${current}&hourly=${hourly}&daily=${daily}&timezone=auto&forecast_days=10`
  const airUrl = `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${latitude}&longitude=${longitude}&current=european_aqi,pm10,pm2_5,alder_pollen,birch_pollen,grass_pollen&hourly=european_aqi&timezone=auto`

  const [weather, air] = await Promise.all([fetch(weatherUrl), fetch(airUrl)])
  if (!weather.ok) throw new Error('Wetterdaten derzeit nicht erreichbar')
  return { ...(await weather.json()), air: air.ok ? await air.json() : null }
}

/**
 * Schmale Abfrage für den Widget-Modus: keine Luftqualität, keine zehn Tage,
 * keine Felder für Kacheln, die es dort nicht gibt. Das Widget hängt in einer
 * fremden Seite – es soll so wenig laden wie möglich.
 *
 * `precipitation` und `wind_speed_10m` stehen mit in den Stundenwerten, obwohl
 * das Widget sie nicht anzeigt: dayCode() braucht sie, um die Tagessymbole
 * genauso zu bestimmen wie die Hauptansicht.
 */
export async function fetchWidgetWeather(latitude, longitude, days = 4) {
  const current = ['temperature_2m', 'apparent_temperature', 'is_day', 'weather_code', 'wind_speed_10m', 'wind_gusts_10m'].join(',')
  const hourly = ['temperature_2m', 'weather_code', 'precipitation_probability', 'precipitation', 'wind_speed_10m', 'is_day'].join(',')
  const daily = ['weather_code', 'temperature_2m_max', 'temperature_2m_min', 'precipitation_probability_max', 'sunrise', 'sunset'].join(',')

  const url = `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=${current}&hourly=${hourly}&daily=${daily}&timezone=auto&forecast_days=${days}`
  const res = await fetch(url)
  if (!res.ok) throw new Error('Wetterdaten derzeit nicht erreichbar')
  return res.json()
}
