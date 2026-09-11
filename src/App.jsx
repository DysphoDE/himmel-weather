import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  AirVent, Bike, CalendarDays, ChevronRight, Clock3, CloudSun, Droplets, Eye, Flower2,
  Gauge, LayoutDashboard, LocateFixed, MapPin, Search, Sparkles, Sunrise,
  Sunset, Umbrella, Wind, X, Zap
} from 'lucide-react'
import Radar, { MiniRadar } from './Radar'
import ChartDot from './ChartDot'
import InfoButton from './Explain'
import WeatherIcon from './WeatherIcon'
import DayDetail from './DayDetail'
import DayList from './DayList'
import SkyScene from './SkyScene'
import MobileShell from './MobileShell'
import ErrorBoundary from './ErrorBoundary'
import useMediaQuery from './useMediaQuery'
import {
  aqiTier, cardinal, dayCode, deriveDay, fmtDay, fmtPrecip, fmtTime, hourNumber, humidityTier,
  pollenPhrase, pressureTier, hoursOfDay, searchPlaces, uvAdvice, uvTier, visibilityTier,
  weatherLabel, fetchWeather, DEFAULT_PLACE
} from './weather'

const DESKTOP = '(min-width: 1180px)'
const round = n => Math.round(n ?? 0)

const SECTIONS = [
  { id: 'overview', label: 'Übersicht', short: 'Übersicht', icon: LayoutDashboard },
  { id: 'today', label: 'Heute', short: 'Heute', icon: CloudSun },
  { id: 'day-detail', label: 'Tagesansicht', short: '24 h', icon: Clock3 },
  { id: 'radar', label: 'Radar', short: 'Radar', icon: MapPin },
  { id: 'ten-days', label: '10 Tage', short: '10 Tage', icon: CalendarDays }
]

const isApple = () => typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.userAgent)

/**
 * Springt zu einem Abschnitt. Jeder ist einen Bildschirm hoch, landet also
 * bündig oben; bleibt einer darunter, wird er mittig gesetzt. Die feste Leiste
 * am unteren Rand zählt dabei nicht als Sichtfeld.
 */
function scrollToSection(id) {
  const section = document.getElementById(id)
  if (!section) return
  const inset = parseFloat(getComputedStyle(document.body).paddingBottom) || 0
  const view = window.innerHeight - inset
  const box = section.getBoundingClientRect()
  const top = box.top + window.scrollY
  const target = box.height <= view ? top - (view - box.height) / 2 : top
  const limit = document.documentElement.scrollHeight - window.innerHeight
  // behavior explizit gesetzt übersteuert das CSS – also hier selbst auf die
  // Systemeinstellung achten.
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  window.scrollTo({
    top: Math.max(0, Math.min(target, limit)),
    behavior: reduce ? 'auto' : 'smooth'
  })
}

/* ── Ortssuche ─────────────────────────────────────────────────────────────── */

function SearchPanel({ open, onClose, onPick, onLocate }) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (query.trim().length < 2) { setResults([]); return }
    const timer = setTimeout(async () => {
      setBusy(true)
      try { setResults(await searchPlaces(query)) } catch { setResults([]) }
      setBusy(false)
    }, 300)
    return () => clearTimeout(timer)
  }, [query])

  useEffect(() => {
    if (!open) return
    const onKey = e => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  return (
    <div className="search-overlay" onMouseDown={e => e.target === e.currentTarget && onClose()}>
      <div className="search-panel" role="dialog" aria-modal="true" aria-label="Ort suchen">
        <div className="search-input">
          <Search aria-hidden="true" />
          <input autoFocus value={query} onChange={e => setQuery(e.target.value)} placeholder="Stadt oder Ort suchen …" aria-label="Ortsname" />
          <button type="button" onClick={onClose} aria-label="Suche schließen"><X /></button>
        </div>

        <button type="button" className="locate-row" onClick={onLocate}>
          <LocateFixed aria-hidden="true" />
          <span><b>Meinen Standort verwenden</b><small>Präzise Vorhersage für deine Position</small></span>
          <ChevronRight aria-hidden="true" />
        </button>

        <div className="search-results">
          {busy && <p className="search-state">Suche läuft …</p>}
          {!busy && query.trim().length >= 2 && !results.length && <p className="search-state">Kein Ort gefunden</p>}
          {results.map(place => (
            <button type="button" key={place.id} onClick={() => onPick(place)}>
              <MapPin aria-hidden="true" />
              <span><b>{place.name}</b><small>{[place.admin1, place.country].filter(Boolean).join(', ')}</small></span>
              <span className="search-coords">{round(place.latitude)}° / {round(place.longitude)}°</span>
            </button>
          ))}
        </div>

        <p className="search-credit">Ortssuche · Open-Meteo Geocoding</p>
      </div>
    </div>
  )
}

/* ── Diagramme im Dashboard ────────────────────────────────────────────────── */

/**
 * Ruhige Verlaufslinie für die Luftqualität.
 *
 * Die Skala läuft fest von 0 bis 100 – dieselbe Spanne, die der Ring links
 * abbildet. Vorher endete sie am höchsten Wert der Reihe: Die Linie klebte
 * dadurch immer knapp unter dem Kartenrand, bei AQI 15 wie bei 95, und eine
 * Schwankung um eine Einheit füllte die ganze Höhe. Jetzt heißt „tief“ auch
 * hier „gute Luft“.
 */
function AqiTrend({ values, labels }) {
  const top = Math.max(100, Math.ceil(Math.max(...values, 0) / 20) * 20)
  const x = i => 4 + i * (92 / Math.max(1, values.length - 1))
  const y = v => 82 - Math.min(1, Math.max(0, v) / top) * 62
  const points = values.map((v, i) => `${x(i)},${y(v)}`).join(' ')
  return (
    <div className="area-chart">
      <svg viewBox="0 0 100 92" preserveAspectRatio="none" aria-hidden="true">
        <defs>
          <linearGradient id="aqFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="var(--rain)" stopOpacity=".16" />
            <stop offset="1" stopColor="var(--rain)" stopOpacity="0" />
          </linearGradient>
        </defs>
        <polygon points={`${x(0)},86 ${points} ${x(values.length - 1)},86`} fill="url(#aqFill)" />
        <polyline points={points} fill="none" stroke="var(--rain)" strokeWidth="1.8" vectorEffect="non-scaling-stroke" />
        {/* Nur die aktuelle Stunde bekommt eine Marke – acht Punkte auf einer
            flachen Linie sind Rauschen, keine Information. */}
        <ChartDot x={x(0)} y={y(values[0])} size={6} />
      </svg>
      <div>{labels.map((l, i) => <span key={i}>{l}</span>)}</div>
    </div>
  )
}

function AqiInstrument({ value, values, labels, pm25, pm10 }) {
  const fill = `${Math.min(75, Math.max(0, value) / 100 * 75)}%`
  const low = Math.min(...values)
  const high = Math.max(...values)
  return (
    <div className="aqi-instrument">
      <div className="aqi-gauge" style={{ '--aqi-fill': fill }}>
        <span><b>{round(value)}</b><small>AQI</small></span>
      </div>
      <div className="aqi-trend">
        {/* Die Wortmarke steht schon in der Kartenüberschrift; hier ist die
            Spanne der nächsten Stunden die neue Information. */}
        <p>
          <span>NÄCHSTE 8 STUNDEN</span>
          <b>{low === high ? `gleichbleibend ${round(low)}` : `${round(low)}–${round(high)}`} AQI</b>
        </p>
        <AqiTrend values={values} labels={labels} />
      </div>
      <dl className="aqi-particles">
        <div><dt>PM2,5</dt><dd>{round(pm25)} <small>µg/m³</small></dd></div>
        <div><dt>PM10</dt><dd>{round(pm10)} <small>µg/m³</small></dd></div>
      </dl>
    </div>
  )
}

/**
 * Regenchance als Säulen statt als Kurve.
 *
 * Die Kachel ist die Skala: eine gefüllte Säule sind 100 %. Damit steht die
 * Obergrenze im Bild, statt sie – wie zuvor – irgendwo auf drei Vierteln der
 * Höhe zu vermuten. Säulen sind hier auch ehrlicher als eine Linie: die Werte
 * gelten je Stunde und werden zwischen zwei Stunden nicht interpoliert.
 */
function RainInstrument({ values, labels }) {
  const dry = values.every(value => Number(value) === 0)
  const level = value => Math.min(100, Math.max(0, Number(value) || 0))
  return (
    <div className={`rain-instrument${dry ? ' is-dry' : ''}`}>
      <div className="rain-bars">
        {values.map((value, i) => (
          <div key={i} className="rain-bar" style={{ '--level': `${level(value)}%` }}>
            <span className="rain-track" aria-hidden="true"><i /></span>
            <b>{round(value)}%</b>
            <small>{labels[i]}</small>
          </div>
        ))}
      </div>
      {dry && <p className="rain-dry"><CloudSun aria-hidden="true" /><span><b>Trocken</b><small>Kein Niederschlag erwartet</small></span></p>}
    </div>
  )
}

function UvInstrument({ values, labels }) {
  return (
    <div className="uv-instrument">
      {values.map((value, i) => (
        <div key={i} className={i === 0 ? 'is-current' : ''}>
          <i style={{ '--uv-fill': `${Math.min(100, Math.max(0, value) / 11 * 100)}%` }}><b>{round(value)}</b></i>
          <span>{labels[i]}</span>
        </div>
      ))}
    </div>
  )
}

/* ── Dashboard (≥1180px) ───────────────────────────────────────────────────── */

function DesktopShell({ model, data, place, day, dayIndex, active, onSearch, onSelectDay, goTo }) {
  const air = data.air?.current || {}
  const aqiHours = data.air?.hourly?.european_aqi || []
  const aqiStart = Math.max(0, (data.air?.hourly?.time || []).findIndex(t => new Date(t) >= new Date()))
  const aqiValues = aqiHours.slice(aqiStart, aqiStart + 8)
  const hourLabels = model.h.time.slice(model.hour, model.hour + 8).map((t, i) => i === 0 ? 'Jetzt' : hourNumber(t))
  const rain = model.h.precipitation_probability.slice(model.hour, model.hour + 8)

  return (
    <div className="desktop-shell" id="overview">
      <aside className="app-rail">
        <p className="rail-logo" aria-hidden="true">h<i>°</i></p>
        <nav aria-label="Bereiche">
          {SECTIONS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              className={active === id ? 'is-active' : ''}
              aria-current={active === id ? 'true' : undefined}
              onClick={() => goTo(id)}
            >
              <Icon aria-hidden="true" />
              <span className="visually-hidden">{label}</span>
              <span className="rail-tip" aria-hidden="true">{label}</span>
            </button>
          ))}
        </nav>
      </aside>

      <div className="app-workspace">
        <div className="app-topbar">
          <p className="dashboard-brand">himmel<i>°</i><small>schaut für dich nach oben</small></p>

          <button type="button" className="dashboard-search" onClick={onSearch}>
            <Search aria-hidden="true" />
            <span>{place.name} ändern</span>
            <kbd>{isApple() ? '⌘' : 'Strg'} K</kbd>
          </button>

          <p className="dashboard-date">
            <b>Heute, {new Date().toLocaleDateString('de-DE', { weekday: 'long' })}</b>
            <span>{new Date().toLocaleDateString('de-DE', { day: '2-digit', month: 'long', year: 'numeric' })} · Stand {fmtTime(model.c.time)}</span>
          </p>
        </div>

        <div className="dashboard-layout">
          <article className="dash-card scene-card">
            <SkyScene
              variant="wide" className="scene-sky"
              weatherCode={model.c.weather_code} cloudCover={model.c.cloud_cover}
              sunrise={model.d.sunrise[0]} sunset={model.d.sunset[0]}
              latitude={place.latitude} longitude={place.longitude} now={model.c.time}
              population={place.population} elevation={data.elevation}
            />
            <div className="scene-veil" aria-hidden="true" />
            <button type="button" className="scene-location" onClick={onSearch}>
              <MapPin aria-hidden="true" />{place.name}<ChevronRight aria-hidden="true" />
            </button>
            <div className={`scene-greeting${model.isDay ? '' : ' is-night'}`}>
              <span>HALLO {place.name.toUpperCase()}.</span>
              <h1>So wird<br /><em>dein Tag.</em></h1>
            </div>
            <div className="scene-copy">
              <div>
                <WeatherIcon code={model.c.weather_code} size={35} isDay={model.isDay} />
                <span>{weatherLabel(model.c.weather_code)}</span>
              </div>
              <b>{round(model.c.temperature_2m)}<sup>°</sup></b>
              <p>Höchst {round(model.d.temperature_2m_max[0])}° · Tiefst {round(model.d.temperature_2m_min[0])}°</p>
            </div>
          </article>

          <article className="dash-card week-card">
            <div className="dash-card-head">
              <div><span>VORHERSAGE</span><h2>Die nächsten Tage</h2></div>
              <button type="button" onClick={() => goTo('ten-days')}>Alle 10 Tage <ChevronRight aria-hidden="true" /></button>
            </div>
            <div className="week-strip">
              {model.d.time.slice(0, 7).map((date, i) => (
                <button
                  type="button"
                  key={date}
                  className={i === dayIndex ? 'is-active' : ''}
                  aria-current={i === dayIndex ? 'true' : undefined}
                  onClick={() => onSelectDay(i)}
                >
                  <span>{i === 0 ? 'Heute' : fmtDay(date)}</span>
                  <small>{new Date(date).toLocaleDateString('de-DE', { day: '2-digit' })}</small>
                  <WeatherIcon code={dayCode(model.h, date, model.d.weather_code[i])} size={28} />
                  <b>{round(model.d.temperature_2m_max[i])}°</b>
                  <em>{round(model.d.temperature_2m_min[i])}°</em>
                  <i><Droplets aria-hidden="true" />{model.d.precipitation_probability_max[i]}%</i>
                  <span className="visually-hidden">24-Stunden-Ansicht öffnen</span>
                </button>
              ))}
            </div>
          </article>

          <div className="metric-cluster">
            <article><Sunrise aria-hidden="true" /><span>SONNENAUFGANG</span><b>{fmtTime(model.d.sunrise[0])}</b><small>Untergang {fmtTime(model.d.sunset[0])}</small></article>
            <article><Gauge aria-hidden="true" /><span>GEFÜHLT<InfoButton topic="apparent" /></span><b>{round(model.c.apparent_temperature)}°</b><small>Gemessen {round(model.c.temperature_2m)}°</small></article>
            <article><Wind aria-hidden="true" /><span>WIND</span><b>{round(model.c.wind_speed_10m)} <em>km/h</em></b><small>Böen bis {round(model.c.wind_gusts_10m)} km/h</small></article>
            <article><Eye aria-hidden="true" /><span>SICHT<InfoButton topic="visibility" /></span><b>{round(model.h.visibility[model.hour] / 1000)} <em>km</em></b><small>{visibilityTier(model.h.visibility[model.hour])}</small></article>
            <article><Droplets aria-hidden="true" /><span>FEUCHTE<InfoButton topic="humidity" /></span><b>{round(model.c.relative_humidity_2m)}%</b><small>{humidityTier(model.c.relative_humidity_2m)}</small></article>
            <article><AirVent aria-hidden="true" /><span>LUFTDRUCK<InfoButton topic="pressure" /></span><b>{round(model.c.pressure_msl)}</b><small>hPa · {pressureTier(model.c.pressure_msl)}</small></article>
          </div>

          <article className="dash-card wind-card">
            <div className="wind-copy">
              <div className="dash-card-head">
                <div><span>WINDSTATUS<InfoButton topic="wind" /></span><h2>{round(model.c.wind_speed_10m)} <em>km/h</em></h2></div>
              </div>
              <dl>
                <div>
                  <dt>Böen bis</dt>
                  <dd>{round(model.c.wind_gusts_10m)} <em>km/h</em></dd>
                </div>
                <div>
                  <dt>Richtung</dt>
                  <dd>{cardinal(model.c.wind_direction_10m)} <em>{model.c.wind_direction_10m}°</em></dd>
                </div>
              </dl>
            </div>
            <div className="wind-dial" aria-hidden="true">
              <span>N</span><span>O</span><span>S</span><span>W</span>
              <i className="wind-needle" style={{ transform: `rotate(${model.c.wind_direction_10m}deg)` }} />
              <b>{cardinal(model.c.wind_direction_10m)}<small>{model.c.wind_direction_10m}°</small></b>
            </div>
          </article>

          <article className="dash-card radar-preview">
            <ErrorBoundary fallback={<p className="card-fallback">Radar derzeit nicht verfügbar.</p>}>
              <MiniRadar latitude={place.latitude} longitude={place.longitude} placeName={place.name} onOpen={() => goTo('radar')} />
            </ErrorBoundary>
          </article>

          <article className="dash-card chart-card air-chart">
            <div className="dash-card-head">
              <div><span>LUFTQUALITÄT<InfoButton topic="aqi" /></span><h2>{aqiTier(air.european_aqi)}</h2></div>
              <AirVent aria-hidden="true" />
            </div>
            <AqiInstrument
              value={air.european_aqi || 0}
              values={aqiValues.length ? aqiValues : Array(8).fill(air.european_aqi || 0)}
              labels={hourLabels}
              pm25={air.pm2_5}
              pm10={air.pm10}
            />
          </article>

          <article className="dash-card chart-card rain-chart">
            <div className="dash-card-head">
              <div><span>REGENCHANCE<InfoButton topic="rainChance" /></span><h2>{Math.max(...rain) === 0 ? 'Trocken' : `Bis zu ${Math.max(...rain)} %`}</h2></div>
              <Droplets aria-hidden="true" />
            </div>
            <RainInstrument values={rain} labels={hourLabels} />
          </article>

          <article className="dash-card chart-card uv-chart">
            <div className="dash-card-head">
              <div><span>UV-INDEX<InfoButton topic="uv" /></span><h2>{round(day.uv)} · {uvTier(day.uv)}</h2></div>
              <Sparkles aria-hidden="true" />
            </div>
            <UvInstrument values={model.d.uv_index_max.slice(0, 8)} labels={model.d.time.slice(0, 8).map(fmtDay)} />
          </article>
        </div>
      </div>
    </div>
  )
}

/* ── Hero (<1180px) ────────────────────────────────────────────────────────── */

function MobileHero({ model, place, elevation, onSearch, onSelectDay, goTo }) {
  return (
    <>
      <header className="site-header">
        <p className="brand"><span aria-hidden="true">h</span>himmel<i aria-hidden="true">°</i></p>
        <button type="button" className="location-button" onClick={onSearch}>
          <MapPin size={16} aria-hidden="true" />
          <span>{place.name}</span>
          <Search size={15} aria-hidden="true" />
        </button>
      </header>

      <section className="hero" id="overview">
        <SkyScene
          variant="tall" className="hero-scene"
          weatherCode={model.c.weather_code} cloudCover={model.c.cloud_cover}
          sunrise={model.d.sunrise[0]} sunset={model.d.sunset[0]}
          latitude={place.latitude} longitude={place.longitude} now={model.c.time}
          population={place.population} elevation={elevation}
        />
        <div className="hero-copy">
          <span className="eyebrow"><i />{new Date().toLocaleDateString('de-DE', { weekday: 'long', day: '2-digit', month: 'long' }).toUpperCase()}</span>
          <h1>Hallo {place.name}.<br /><em>So wird dein Tag.</em></h1>
          <p className="hero-summary">
            <WeatherIcon code={model.c.weather_code} size={21} isDay={model.isDay} />
            {weatherLabel(model.c.weather_code)} · Gefühlt {round(model.c.apparent_temperature)}° · Wind {round(model.c.wind_speed_10m)} km/h
          </p>
          <p className="hero-temp"><b>{round(model.c.temperature_2m)}</b><sup>°</sup><span>JETZT</span></p>
        </div>

        <div className="hero-sheet">
          <div className="sheet-intro">
            <span>WETTER HEUTE</span>
            <b>{weatherLabel(model.c.weather_code)}</b>
            <small><Sunrise aria-hidden="true" /> {fmtTime(model.d.sunrise[0])} <i /> <Sunset aria-hidden="true" /> {fmtTime(model.d.sunset[0])}</small>
          </div>
          <div className="sheet-hours">
            {model.h.time.slice(model.hour, model.hour + 5).map((t, i) => {
              const idx = model.hour + i
              return (
                <button type="button" key={t} onClick={() => onSelectDay(0)}>
                  <span>{i === 0 ? 'Jetzt' : new Date(t).toLocaleTimeString('de-DE', { hour: '2-digit' })}</span>
                  <WeatherIcon code={model.h.weather_code[idx]} size={25} isDay={model.h.is_day?.[idx] !== 0} />
                  <b>{round(model.h.temperature_2m[idx])}°</b>
                  <small><Droplets aria-hidden="true" /> {model.h.precipitation_probability[idx]}%</small>
                </button>
              )
            })}
          </div>
          <button type="button" className="sheet-more" onClick={() => goTo('day-detail')}>
            Alle 24 Stunden <ChevronRight aria-hidden="true" />
          </button>
        </div>
      </section>
    </>
  )
}

/* ── Messwerte, die es unter 1180px sonst nirgends gibt ────────────────────── */

function MetricsSection({ model, data }) {
  const air = data.air?.current || {}
  const tiles = [
    { icon: Gauge, label: 'Gefühlt', topic: 'apparent', value: `${round(model.c.apparent_temperature)}°`, note: `Gemessen ${round(model.c.temperature_2m)}°` },
    { icon: Wind, label: 'Wind', topic: 'wind', value: `${round(model.c.wind_speed_10m)} km/h`, note: `Böen bis ${round(model.c.wind_gusts_10m)} km/h · aus ${cardinal(model.c.wind_direction_10m)}` },
    { icon: Droplets, label: 'Luftfeuchte', topic: 'humidity', value: `${round(model.c.relative_humidity_2m)} %`, note: humidityTier(model.c.relative_humidity_2m) },
    { icon: Gauge, label: 'Luftdruck', topic: 'pressure', value: `${round(model.c.pressure_msl)} hPa`, note: pressureTier(model.c.pressure_msl) },
    { icon: Eye, label: 'Sichtweite', topic: 'visibility', value: `${round(model.h.visibility[model.hour] / 1000)} km`, note: visibilityTier(model.h.visibility[model.hour]) },
    { icon: Sparkles, label: 'UV-Index', topic: 'uv', value: `${round(model.h.uv_index[model.hour])}`, note: uvAdvice(model.h.uv_index[model.hour]) },
    { icon: AirVent, label: 'Luftqualität', topic: 'aqi', value: `${round(air.european_aqi)} AQI`, note: `${aqiTier(air.european_aqi)} · PM2,5 ${round(air.pm2_5)}` },
    { icon: Sunrise, label: 'Sonnenlicht', value: fmtTime(model.d.sunrise[0]), note: `Untergang ${fmtTime(model.d.sunset[0])}` }
  ]
  return (
    <section className="metrics-section" aria-label="Aktuelle Messwerte">
      <div className="metrics-grid">
        {tiles.map(({ icon: Icon, label, topic, value, note }) => (
          <article key={label}>
            <Icon aria-hidden="true" />
            <span>{label}{topic && <InfoButton topic={topic} />}</span>
            <b>{value}</b>
            <small>{note}</small>
          </article>
        ))}
      </div>
    </section>
  )
}

/* ── Heute: Briefing und Empfehlungen ──────────────────────────────────────── */

function TodaySection({ model, data, day, goTo }) {
  const hours = hoursOfDay(model.h, model.d.time[0])
  const pollen = data.air?.current || {}
  const pollenPeak = Math.max(pollen.alder_pollen || 0, pollen.birch_pollen || 0, pollen.grass_pollen || 0)
  const aqi = pollen.european_aqi
  const currentHour = new Date(model.c.time).getHours()
  const stages = hours.filter((_, index) => index % 3 === 0)
  const daytime = hours.filter(hour => {
    const value = new Date(hour.time).getHours()
    return value >= 7 && value <= 20
  })
  const remainingDaytime = daytime.filter(hour => new Date(hour.time).getHours() >= currentHour)
  const outdoorHours = remainingDaytime.length ? remainingDaytime : daytime
  const bestIsPast = remainingDaytime.length === 0

  const windows = outdoorHours.map((hour, index) => {
    const block = outdoorHours.slice(index, index + 3)
    const score = block.reduce((sum, item) => sum
      + 100
      - item.rainChance * .75
      - Math.max(0, item.gusts - 25) * 1.1
      - Math.max(0, item.uv - 6) * 5
      - Math.max(0, 8 - item.temperature) * 3
      - Math.max(0, item.temperature - 28) * 3, 0) / block.length
    return { block, score }
  })
  const best = windows.sort((a, b) => b.score - a.score)[0]
  const bestStart = best?.block[0]
  const bestEnd = best?.block.at(-1)
  const bestLabel = bestStart && bestEnd
    ? `${fmtTime(bestStart.time)}–${fmtTime(new Date(new Date(bestEnd.time).getTime() + 3600000))}`
    : 'Heute flexibel bleiben'
  const bestRain = best ? Math.max(...best.block.map(hour => hour.rainChance)) : day.rainMax
  const bestGust = best ? Math.max(...best.block.map(hour => hour.gusts)) : day.gusts

  const wetHours = hours.filter(hour => hour.rainChance >= 35 || hour.rainAmount >= .2)
  const rainPeak = Math.max(...hours.map(hour => hour.rainChance), 0)
  const rainLabel = wetHours.length
    ? `${fmtTime(wetHours[0].time)}–${fmtTime(new Date(new Date(wetHours.at(-1).time).getTime() + 3600000))}`
    : 'Kein Regenfenster'
  const uvPeak = hours.reduce((peak, hour) => hour.uv > (peak?.uv ?? -1) ? hour : peak, null)
  const nowStage = Math.floor(currentHour / 3) * 3

  return (
    <section className="today-section" id="today" aria-label="Heute">
      <header className="today-intro" style={{ '--risk': day.risk.color }}>
        <div className="today-intro-copy">
          <span className="eyebrow"><i />HEUTE · DEIN WETTERFAHRPLAN</span>
          <h2>{day.headline}</h2>
          <p>{day.summary} <b>{day.risk.text}:</b> {day.risk.detail}.</p>
          <span className="today-risk"><i />Risiko {day.risk.level}</span>
        </div>

        <div className="today-now">
          <span>JETZT · {fmtTime(model.c.time)}</span>
          <div>
            <WeatherIcon code={model.c.weather_code} size={44} isDay={model.isDay} strokeWidth={1.5} />
            <b>{round(model.c.temperature_2m)}<sup>°</sup></b>
          </div>
          <p>{weatherLabel(model.c.weather_code)} · gefühlt {round(model.c.apparent_temperature)}°</p>
        </div>
      </header>

      <article className="today-course">
        <div className="today-course-head">
          <div><span>TAGESLINIE</span><h3>So verändert sich dein Tag.</h3></div>
          <button type="button" onClick={() => goTo('day-detail')}>Alle 24 Stunden <ChevronRight aria-hidden="true" /></button>
        </div>
        <div className="today-stages">
          {stages.map(hour => {
            const stageHour = new Date(hour.time).getHours()
            const isNow = stageHour === nowStage
            return (
              <div
                key={hour.time}
                className={`today-stage${hour.isDay ? ' is-day' : ' is-night'}${isNow ? ' is-now' : ''}${stageHour < nowStage ? ' is-past' : ''}`}
                style={{ '--rain-level': `${hour.rainChance}%` }}
              >
                <span>{isNow ? 'Jetzt' : fmtTime(hour.time)}</span>
                <WeatherIcon code={hour.code} size={27} isDay={hour.isDay} />
                <b>{round(hour.temperature)}°</b>
                <small><Droplets aria-hidden="true" />{hour.rainChance}%</small>
                <small><Wind aria-hidden="true" />{round(hour.wind)} km/h</small>
                <i aria-hidden="true" />
              </div>
            )
          })}
        </div>
      </article>

      <div className="today-decisions">
        <article className="today-decision is-best" style={{ '--score': `${day.score}%` }}>
          <Bike aria-hidden="true" />
          <span>{bestIsPast ? 'BESTES FENSTER HEUTE' : 'BESTES RESTFENSTER'}<InfoButton topic="score" /></span>
          <h3>{bestLabel}</h3>
          <p>{bestIsPast ? 'Dieses Zeitfenster ist bereits vorbei. ' : ''}{bestRain}% Regenrisiko · Böen bis {round(bestGust)} km/h. {day.outdoor[0]}.</p>
          <div><i /><small>{day.score}/100 Eignung</small></div>
        </article>

        <article className="today-decision">
          <Umbrella aria-hidden="true" />
          <span>REGEN<InfoButton topic="rainChance" /></span>
          <h3>{rainLabel}</h3>
          <p>{wetHours.length ? `Spitzenrisiko ${rainPeak} %, insgesamt ${fmtPrecip(day.rainSum)}.` : `Maximal ${rainPeak} % Risiko – der Schirm kann zuhause bleiben.`}</p>
          <button type="button" onClick={() => goTo('radar')}>Radar ansehen <ChevronRight aria-hidden="true" /></button>
        </article>

        <article className="today-decision">
          <Sparkles aria-hidden="true" />
          <span>SONNE & UV<InfoButton topic="uv" /></span>
          <h3>{round(uvPeak?.uv)} · {uvTier(uvPeak?.uv)}</h3>
          <p>Maximum gegen {uvPeak ? fmtTime(uvPeak.time) : '–'}. {uvAdvice(uvPeak?.uv)}. Sonne bis {fmtTime(model.d.sunset[0])}.</p>
        </article>

        <article className="today-decision">
          <Flower2 aria-hidden="true" />
          <span>LUFT & POLLEN<InfoButton topic="airPollen" /></span>
          <h3>{aqiTier(aqi)}</h3>
          <p>{round(aqi)} AQI · {pollenPhrase(pollenPeak)}. Erle {round(pollen.alder_pollen)}, Birke {round(pollen.birch_pollen)}, Gräser {round(pollen.grass_pollen)} Pollen/m³.</p>
        </article>
      </div>
    </section>
  )
}

/* ── App ───────────────────────────────────────────────────────────────────── */

function Loading() {
  return (
    <div className="app-state" role="status">
      <span className="orbit" aria-hidden="true"><i /><i /><i /></span>
      <p>Atmosphäre wird gelesen …</p>
    </div>
  )
}

export default function App() {
  const [place, setPlace] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem('himmel-place'))
      return Number.isFinite(saved?.latitude) && Number.isFinite(saved?.longitude) ? saved : DEFAULT_PLACE
    } catch { return DEFAULT_PLACE }
  })
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [searchOpen, setSearchOpen] = useState(false)
  const [dayIndex, setDayIndex] = useState(0)
  const [active, setActive] = useState('overview')

  const isDesktop = useMediaQuery(DESKTOP)
  const [scrollRequest, setScrollRequest] = useState(null)

  useEffect(() => {
    let alive = true
    setLoading(true); setError('')
    fetchWeather(place.latitude, place.longitude)
      .then(d => { if (alive) { setData(d); setDayIndex(0); setLoading(false) } })
      .catch(e => { if (alive) { setError(e.message); setLoading(false) } })
    return () => { alive = false }
  }, [place])

  /* Ein Sprungwunsch wird als State vermerkt und erst nach dem Commit ausgeführt.
     Sonst scrollt der Klick auf einen Tag noch im alten Layout – die Tagesansicht
     hat für den neuen Tag eine andere Höhe. */
  // Jeder Aufruf erzeugt ein neues Objekt, der Effekt läuft also auch beim
  // gleichen Ziel erneut.
  const goTo = useCallback(id => setScrollRequest({ id }), [])

  const selectDay = useCallback(index => {
    if (!Number.isFinite(index)) return
    setDayIndex(prev => (data ? Math.max(0, Math.min(data.daily.time.length - 1, index)) : prev))
    goTo('day-detail')
  }, [data, goTo])

  const selectMobileDay = useCallback(index => {
    if (!Number.isFinite(index)) return
    setDayIndex(prev => (data ? Math.max(0, Math.min(data.daily.time.length - 1, index)) : prev))
  }, [data])

  useEffect(() => {
    if (!scrollRequest) return
    scrollToSection(scrollRequest.id)
  }, [scrollRequest])

  /* Nur eine bewusste Wahl wird gespeichert. Vorher schrieb der Ladeeffekt auch
     den Standardort weg – eine Änderung des Standards wäre damit für alle
     wirkungslos geblieben, die die Seite schon einmal geöffnet hatten. */
  const pickPlace = next => {
    setPlace(next)
    setSearchOpen(false)
    try { localStorage.setItem('himmel-place', JSON.stringify(next)) } catch { /* privater Modus */ }
  }

  const locate = () => {
    if (!navigator.geolocation) { setError('Standortfreigabe wird von diesem Browser nicht unterstützt.'); return }
    navigator.geolocation.getCurrentPosition(
      pos => pickPlace({ name: 'Mein Standort', country: 'Aktuelle Position', latitude: pos.coords.latitude, longitude: pos.coords.longitude }),
      () => setError('Standort konnte nicht ermittelt werden.')
    )
  }

  // Strg/⌘ K – das Tastenkürzel stand vorher nur als Zierde in der Oberfläche.
  useEffect(() => {
    const onKey = e => {
      if (e.key.toLowerCase() === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        setSearchOpen(open => !open)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const model = useMemo(() => {
    if (!data) return null
    const h = data.hourly
    const next = h.time.findIndex(t => new Date(t) > new Date())
    const hour = next <= 0 ? 0 : next - 1
    return { c: data.current, h, d: data.daily, hour, isDay: data.current.is_day !== 0 }
  }, [data])

  const day = useMemo(() => (model ? deriveDay(model) : null), [model])

  // Aktiven Bereich für die Navigation bestimmen.
  useEffect(() => {
    if (!model) return
    const targets = SECTIONS.map(s => document.getElementById(s.id)).filter(Boolean)
    if (!targets.length) return
    const observer = new IntersectionObserver(entries => {
      const visible = entries.filter(e => e.isIntersecting)
        .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0]
      if (visible) setActive(visible.target.id)
    }, { rootMargin: '-45% 0px -45% 0px', threshold: [0, 0.2, 0.5, 1] })
    targets.forEach(t => observer.observe(t))
    return () => observer.disconnect()
  }, [model, isDesktop])

  return (
    <>
      {loading && <Loading />}

      {!loading && error && (
        <div className="app-state is-error" role="alert">
          <Zap aria-hidden="true" />
          <h1>Wetterpause.</h1>
          <p>{error}</p>
          <button type="button" onClick={() => setPlace({ ...place })}>Noch einmal versuchen</button>
        </div>
      )}

      {!loading && model && (isDesktop ? (
        <>
          <DesktopShell
            model={model} data={data} place={place} day={day} dayIndex={dayIndex}
            active={active} onSearch={() => setSearchOpen(true)} onSelectDay={selectDay} goTo={goTo}
          />

          <main className="content has-rail">
            <TodaySection model={model} data={data} day={day} goTo={goTo} />

            <ErrorBoundary fallback={<p className="card-fallback">Tagesansicht konnte nicht aufgebaut werden.</p>}>
              <DayDetail model={model} dayIndex={dayIndex} onSelectDay={selectDay} nowIndex={model.hour} />
            </ErrorBoundary>

            <ErrorBoundary fallback={
              <section className="radar-section" id="radar">
                <p className="card-fallback">Radar derzeit nicht verfügbar.</p>
              </section>
            }>
              <Radar latitude={place.latitude} longitude={place.longitude} placeName={place.name} />
            </ErrorBoundary>

            <section className="days-section" id="ten-days" aria-label="10-Tage-Trend">
              <div className="section-head">
                <div>
                  <span className="eyebrow"><i />10-TAGE-TREND</span>
                  <h2>Was kommt,<em>bleibt sichtbar.</em></h2>
                </div>
                <p>Tippe einen Tag an, um seine 24 Stunden im Detail zu sehen.</p>
              </div>
              <DayList model={model} dayIndex={dayIndex} onSelectDay={selectDay} />
            </section>
          </main>

          <footer className="site-footer">
            <p className="brand"><span aria-hidden="true">h</span>himmel<i aria-hidden="true">°</i></p>
            <p className="footer-claim">Schaut für dich nach oben.</p>
            <p className="footer-links">
              <a href="https://open-meteo.com/" target="_blank" rel="noopener noreferrer">Daten: Open-Meteo</a>
              <a href="https://www.dwd.de/" target="_blank" rel="noopener noreferrer">Radar: Deutscher Wetterdienst</a>
              <a href="https://www.rainviewer.com/" target="_blank" rel="noopener noreferrer">Radar weltweit: RainViewer</a>
              <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">Karte: OpenStreetMap</a>
            </p>
          </footer>
        </>
      ) : (
        <MobileShell
          model={model} data={data} place={place} day={day} dayIndex={dayIndex}
          onSearch={() => setSearchOpen(true)} onSelectDay={selectMobileDay}
        />
      ))}

      <SearchPanel open={searchOpen} onClose={() => setSearchOpen(false)} onPick={pickPlace} onLocate={locate} />
    </>
  )
}
