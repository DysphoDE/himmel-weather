import { useEffect, useMemo, useState } from 'react'
import {
  AirVent, CalendarDays, ChevronDown, ChevronLeft, ChevronRight, Clock3,
  CloudSun, Droplets, Eye, Gauge, MapPin, Search, Sparkles, Sunrise,
  Sunset, Umbrella, Wind
} from 'lucide-react'
import ErrorBoundary from './ErrorBoundary'
import InfoButton from './Explain'
import Radar, { MiniRadar } from './Radar'
import SkyScene from './SkyScene'
import WeatherIcon from './WeatherIcon'
import {
  aqiTier, cardinal, dayCode, fmtDay, fmtPrecip, fmtTime, hoursOfDay, humidityTier,
  pollenPhrase, pressureTier, uvAdvice, uvTier, visibilityTier, weatherLabel
} from './weather'

const round = value => Math.round(value ?? 0)

const NAV_ITEMS = [
  { id: 'today', label: 'Heute', icon: CloudSun },
  { id: 'hours', label: 'Stunden', icon: Clock3 },
  { id: 'radar', label: 'Radar', icon: MapPin },
  { id: 'forecast', label: '10 Tage', icon: CalendarDays }
]

const dayDate = value => new Date(value).toLocaleDateString('de-DE', {
  weekday: 'long', day: '2-digit', month: 'long'
})

function MobileBrand({ place, onSearch, solid = false }) {
  return (
    <header className={`mobile-topbar${solid ? ' is-solid' : ''}`}>
      <p className="mobile-brand" aria-label="himmel">
        <span aria-hidden="true">h</span>
        <b>himmel<i>°</i></b>
      </p>
      <button type="button" className="mobile-location" onClick={onSearch} aria-label={`Wetterort ändern. Aktuell ${place.name}`}>
        <MapPin aria-hidden="true" />
        <span>{place.name}</span>
        <Search aria-hidden="true" />
      </button>
    </header>
  )
}

function MobileSectionHead({ kicker, title, aside, action, onAction }) {
  return (
    <div className="mobile-section-head">
      <div>
        <span>{kicker}</span>
        <h2>{title}</h2>
      </div>
      {action ? (
        <button type="button" onClick={onAction}>{action}<ChevronRight aria-hidden="true" /></button>
      ) : aside ? <p>{aside}</p> : null}
    </div>
  )
}

function findBestWindow(hours, fallback) {
  const currentHour = new Date().getHours()
  const daytime = hours.filter(hour => {
    const value = new Date(hour.time).getHours()
    return value >= 7 && value <= 20
  })
  const remaining = daytime.filter(hour => new Date(hour.time).getHours() >= currentHour)
  const candidates = remaining.length ? remaining : daytime
  const windows = candidates.map((hour, index) => {
    const block = candidates.slice(index, index + 3)
    const score = block.reduce((sum, item) => sum
      + 100
      - item.rainChance * .75
      - Math.max(0, item.gusts - 25) * 1.1
      - Math.max(0, item.uv - 6) * 5
      - Math.max(0, 8 - item.temperature) * 3
      - Math.max(0, item.temperature - 28) * 3, 0) / Math.max(1, block.length)
    return { block, score }
  }).filter(window => window.block.length)
  const best = windows.sort((a, b) => b.score - a.score)[0]
  if (!best) return { label: 'Heute flexibel bleiben', rain: fallback.rainMax, gusts: fallback.gusts, past: false }
  const first = best.block[0]
  const last = best.block.at(-1)
  const end = new Date(new Date(last.time).getTime() + 3600000)
  return {
    label: `${fmtTime(first.time)}–${fmtTime(end)}`,
    rain: Math.max(...best.block.map(hour => hour.rainChance)),
    gusts: Math.max(...best.block.map(hour => hour.gusts)),
    past: remaining.length === 0
  }
}

function MobileHero({ model, data, place, day, onSearch, onOpenHours }) {
  const upcoming = model.h.time.slice(model.hour, model.hour + 5)
  return (
    <section className={`mobile-hero${model.isDay ? '' : ' is-night'}`}>
      <SkyScene
        variant="tall"
        className="mobile-hero-scene"
        weatherCode={model.c.weather_code}
        cloudCover={model.c.cloud_cover}
        sunrise={model.d.sunrise[0]}
        sunset={model.d.sunset[0]}
        latitude={place.latitude}
        longitude={place.longitude}
        now={model.c.time}
        population={place.population}
        elevation={data.elevation}
      />
      <div className="mobile-hero-shade" aria-hidden="true" />
      <MobileBrand place={place} onSearch={onSearch} />

      <div className="mobile-hero-copy">
        <span className="mobile-hero-date">{dayDate(model.d.time[0])}</span>
        <p className="mobile-hero-weather">
          <WeatherIcon code={model.c.weather_code} size={30} isDay={model.isDay} />
          {weatherLabel(model.c.weather_code)}
        </p>
        <p className="mobile-current-temp">
          <b>{round(model.c.temperature_2m)}</b><sup>°</sup>
          <span>Gefühlt {round(model.c.apparent_temperature)}°</span>
        </p>
        <h1>{day.headline}</h1>
      </div>

      <button type="button" className="mobile-forecast-ribbon" onClick={onOpenHours} aria-label="24-Stunden-Vorhersage öffnen">
        {upcoming.map((time, offset) => {
          const index = model.hour + offset
          return (
            <span key={time} className={offset === 0 ? 'is-now' : ''}>
              <small>{offset === 0 ? 'Jetzt' : new Date(time).toLocaleTimeString('de-DE', { hour: '2-digit' })}</small>
              <WeatherIcon code={model.h.weather_code[index]} size={23} isDay={model.h.is_day?.[index] !== 0} />
              <b>{round(model.h.temperature_2m[index])}°</b>
            </span>
          )
        })}
        <i><ChevronRight aria-hidden="true" /></i>
      </button>
    </section>
  )
}

function MetricTeaser({ model, data }) {
  const air = data.air?.current || {}
  const items = [
    { label: 'Wind', value: `${round(model.c.wind_speed_10m)}`, unit: 'km/h' },
    { label: 'UV', value: round(model.h.uv_index[model.hour]), unit: uvTier(model.h.uv_index[model.hour]) },
    { label: 'Feuchte', value: `${round(model.c.relative_humidity_2m)}`, unit: '%' },
    { label: 'Luft', value: round(air.european_aqi), unit: 'AQI' }
  ]
  return (
    <div className="mobile-metric-teaser">
      {items.map(item => (
        <div key={item.label}>
          <span>{item.label}</span>
          <b>{item.value}</b>
          <small>{item.unit}</small>
        </div>
      ))}
    </div>
  )
}

function MobileMeasurements({ model, data }) {
  const air = data.air?.current || {}
  const tiles = [
    { icon: Gauge, label: 'Gefühlt', topic: 'apparent', value: `${round(model.c.apparent_temperature)}°`, note: `Gemessen ${round(model.c.temperature_2m)}°` },
    { icon: Wind, label: 'Wind', topic: 'wind', value: `${round(model.c.wind_speed_10m)} km/h`, note: `Böen bis ${round(model.c.wind_gusts_10m)} km/h · aus ${cardinal(model.c.wind_direction_10m)}` },
    { icon: Droplets, label: 'Luftfeuchte', topic: 'humidity', value: `${round(model.c.relative_humidity_2m)} %`, note: humidityTier(model.c.relative_humidity_2m) },
    { icon: AirVent, label: 'Luftdruck', topic: 'pressure', value: `${round(model.c.pressure_msl)} hPa`, note: pressureTier(model.c.pressure_msl) },
    { icon: Eye, label: 'Sichtweite', topic: 'visibility', value: `${round(model.h.visibility[model.hour] / 1000)} km`, note: visibilityTier(model.h.visibility[model.hour]) },
    { icon: Sparkles, label: 'UV-Index', topic: 'uv', value: round(model.h.uv_index[model.hour]), note: uvAdvice(model.h.uv_index[model.hour]) },
    { icon: AirVent, label: 'Luftqualität', topic: 'aqi', value: `${round(air.european_aqi)} AQI`, note: `${aqiTier(air.european_aqi)} · PM2,5 ${round(air.pm2_5)}` },
    { icon: Sunrise, label: 'Sonnenlicht', value: fmtTime(model.d.sunrise[0]), note: `Untergang ${fmtTime(model.d.sunset[0])}` }
  ]
  return (
    <details className="mobile-measurements">
      <summary>
        <span><b>Alle Messwerte</b><small>Wind, Luft, Sonne und Sicht</small></span>
        <ChevronDown aria-hidden="true" />
      </summary>
      <div className="mobile-measurement-grid">
        {tiles.map(({ icon: Icon, label, topic, value, note }) => (
          <article key={label}>
            <Icon aria-hidden="true" />
            <span>{label}{topic && <InfoButton topic={topic} />}</span>
            <b>{value}</b>
            <small>{note}</small>
          </article>
        ))}
      </div>
    </details>
  )
}

function TodayView({ model, data, place, day, onSearch, onNavigate, onOpenDay }) {
  const hours = useMemo(() => hoursOfDay(model.h, model.d.time[0]), [model])
  const best = useMemo(() => findBestWindow(hours, day), [hours, day])
  const air = data.air?.current || {}
  const pollenPeak = Math.max(air.alder_pollen || 0, air.birch_pollen || 0, air.grass_pollen || 0)
  const wetHours = hours.filter(hour => hour.rainChance >= 35 || hour.rainAmount >= .2)
  const rainPeak = Math.max(...hours.map(hour => hour.rainChance), 0)
  const uvPeak = hours.reduce((peak, hour) => hour.uv > (peak?.uv ?? -1) ? hour : peak, null)
  const upcoming = model.h.time.slice(model.hour, model.hour + 12)

  return (
    <main className="mobile-today-view">
      <MobileHero model={model} data={data} place={place} day={day} onSearch={onSearch} onOpenHours={() => onNavigate('hours')} />

      <div className="mobile-today-flow">
        <section className="mobile-briefing">
          <span className="mobile-kicker">HEUTE IN EINEM SATZ</span>
          <h2>{day.summary}</h2>
          <p style={{ '--risk-color': day.risk.color }}><i />{day.risk.text} · {day.risk.detail}</p>
        </section>

        <MetricTeaser model={model} data={data} />

        <section className="mobile-best-window" style={{ '--score': `${day.score}%` }}>
          <div className="mobile-best-copy">
            <span>{best.past ? 'BESTES FENSTER HEUTE' : 'BESTES RESTFENSTER'}<InfoButton topic="score" /></span>
            <h2>{best.label}</h2>
            <p>{best.past ? 'Bereits vorbei · ' : ''}{best.rain}% Regen · Böen bis {round(best.gusts)} km/h</p>
          </div>
          <div className="mobile-score" aria-label={`${day.score} von 100 Punkten`}>
            <b>{day.score}</b><small>/100</small>
          </div>
          <p className="mobile-best-advice">{day.outdoor[0]}<small>{day.outdoor[1]}</small></p>
        </section>

        <section className="mobile-hour-preview">
          <MobileSectionHead kicker="DIE NÄCHSTEN STUNDEN" title="Der Himmel zieht weiter." action="Alle 24" onAction={() => onNavigate('hours')} />
          <div className="mobile-hour-scroll">
            {upcoming.map((time, offset) => {
              const index = model.hour + offset
              return (
                <button type="button" key={time} className={offset === 0 ? 'is-now' : ''} onClick={() => onNavigate('hours')}>
                  <span>{offset === 0 ? 'Jetzt' : new Date(time).toLocaleTimeString('de-DE', { hour: '2-digit' })}</span>
                  <WeatherIcon code={model.h.weather_code[index]} size={29} isDay={model.h.is_day?.[index] !== 0} />
                  <b>{round(model.h.temperature_2m[index])}°</b>
                  <small><Droplets aria-hidden="true" />{model.h.precipitation_probability[index]}%</small>
                </button>
              )
            })}
          </div>
        </section>

        <section className="mobile-decision-section">
          <MobileSectionHead kicker="WAS HEUTE ZÄHLT" title="Mitnehmen. Weglassen. Losgehen." />
          <div className="mobile-decision-grid">
            <button type="button" className="is-rain" onClick={() => onNavigate('radar')}>
              <Umbrella aria-hidden="true" />
              <span>Regen</span>
              <b>{wetHours.length ? `Bis ${rainPeak} %` : 'Schirm bleibt da'}</b>
              {/* Kein "?" in diesem Feld: Die ganze Kachel ist bereits ein
                  Schalter aufs Radar, ein Knopf darin wäre nicht bedienbar. */}
              <small>{wetHours.length ? `${fmtTime(wetHours[0].time)} erstmals relevant` : 'Kein Regenfenster erwartet'}</small>
              <ChevronRight aria-hidden="true" />
            </button>
            <article>
              <Sparkles aria-hidden="true" />
              <span>Sonne & UV<InfoButton topic="uv" /></span>
              <b>{round(uvPeak?.uv)} · {uvTier(uvPeak?.uv)}</b>
              <small>{uvPeak ? `Maximum um ${fmtTime(uvPeak.time)}` : uvAdvice(day.uv)}</small>
            </article>
            <article>
              <AirVent aria-hidden="true" />
              <span>Luft & Pollen<InfoButton topic="airPollen" /></span>
              <b>{aqiTier(air.european_aqi)}</b>
              <small>{round(air.european_aqi)} AQI · {pollenPhrase(pollenPeak)}</small>
            </article>
          </div>
        </section>

        <section className="mobile-radar-preview">
          <MobileSectionHead kicker="LIVE ÜBER DIR" title="Kommt da etwas?" action="Radar öffnen" onAction={() => onNavigate('radar')} />
          <div className="mobile-mini-radar">
            <ErrorBoundary fallback={<p className="card-fallback">Radar derzeit nicht verfügbar.</p>}>
              <MiniRadar latitude={place.latitude} longitude={place.longitude} placeName={place.name} onOpen={() => onNavigate('radar')} />
            </ErrorBoundary>
          </div>
        </section>

        <section className="mobile-week-preview">
          <MobileSectionHead kicker="BLICK NACH VORN" title="Die nächsten Tage." action="Alle 10" onAction={() => onNavigate('forecast')} />
          <div className="mobile-week-list">
            {model.d.time.slice(0, 5).map((date, index) => {
              const code = dayCode(model.h, date, model.d.weather_code[index])
              return (
                <button type="button" key={date} onClick={() => onOpenDay(index)}>
                  <span><b>{index === 0 ? 'Heute' : new Date(date).toLocaleDateString('de-DE', { weekday: 'long' })}</b><small>{new Date(date).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' })}</small></span>
                  <WeatherIcon code={code} size={27} />
                  <em><Droplets aria-hidden="true" />{model.d.precipitation_probability_max[index] ?? 0}%</em>
                  <strong>{round(model.d.temperature_2m_max[index])}°<small>{round(model.d.temperature_2m_min[index])}°</small></strong>
                  <ChevronRight aria-hidden="true" />
                </button>
              )
            })}
          </div>
        </section>

        <MobileMeasurements model={model} data={data} />
        <MobileSources />
      </div>
    </main>
  )
}

function DayPicker({ model, dayIndex, onSelectDay }) {
  return (
    <div className="mobile-day-picker" aria-label="Vorhersagetag auswählen">
      {model.d.time.map((date, index) => (
        <button
          type="button"
          key={date}
          className={index === dayIndex ? 'is-active' : ''}
          aria-current={index === dayIndex ? 'date' : undefined}
          onClick={() => onSelectDay(index)}
        >
          <span>{index === 0 ? 'Heute' : fmtDay(date)}</span>
          <b>{new Date(date).toLocaleDateString('de-DE', { day: '2-digit' })}</b>
        </button>
      ))}
    </div>
  )
}

function HoursView({ model, place, dayIndex, onSearch, onSelectDay }) {
  const date = model.d.time[dayIndex]
  const hours = useMemo(() => hoursOfDay(model.h, date), [model, date])
  const code = dayCode(model.h, date, model.d.weather_code[dayIndex])
  const nowHour = new Date(model.c.time).getHours()
  const isToday = dayIndex === 0
  const dailyFacts = [
    { icon: Sunrise, label: 'Aufgang', value: fmtTime(model.d.sunrise[dayIndex]) },
    { icon: Sunset, label: 'Untergang', value: fmtTime(model.d.sunset[dayIndex]) },
    { icon: Droplets, label: 'Regenmenge', topic: 'precip', value: fmtPrecip(model.d.precipitation_sum[dayIndex]) },
    { icon: Wind, label: 'Böen bis', topic: 'wind', value: `${round(model.d.wind_gusts_10m_max[dayIndex])} km/h` },
    { icon: Sparkles, label: 'UV-Maximum', topic: 'uv', value: `${round(model.d.uv_index_max[dayIndex])} · ${uvTier(model.d.uv_index_max[dayIndex])}` },
    { icon: Gauge, label: 'Gefühlt', topic: 'apparent', value: `${round(model.d.apparent_temperature_min[dayIndex])}–${round(model.d.apparent_temperature_max[dayIndex])}°` }
  ]

  return (
    <main className="mobile-screen mobile-hours-screen">
      <MobileBrand place={place} onSearch={onSearch} solid />
      <div className="mobile-screen-content">
        <header className="mobile-page-title">
          <span>24-STUNDEN-BLICK</span>
          <h1>Jede Stunde.<em>Nichts übersehen.</em></h1>
        </header>

        <DayPicker model={model} dayIndex={dayIndex} onSelectDay={onSelectDay} />

        <section className="mobile-day-summary">
          <div>
            <span>{dayDate(date)}</span>
            <h2>{weatherLabel(code)}</h2>
            <p>{model.d.precipitation_probability_max[dayIndex] ?? 0}% Regenrisiko · Wind bis {round(model.d.wind_speed_10m_max[dayIndex])} km/h</p>
          </div>
          <WeatherIcon code={code} size={57} />
          <p><b>{round(model.d.temperature_2m_max[dayIndex])}°</b><small>{round(model.d.temperature_2m_min[dayIndex])}°</small></p>
        </section>

        <section className="mobile-hour-river">
          <MobileSectionHead kicker="STUNDENFLUSS" title="Vom ersten Licht bis tief in die Nacht." aside="Temperatur · Regen · Wind" />
          <div className="mobile-hour-river-head" aria-hidden="true">
            <span>Zeit</span><span>Wetter</span><span>Regen</span><span>Wind</span>
          </div>
          <div className="mobile-hour-rows">
            {hours.map(hour => {
              const hourValue = new Date(hour.time).getHours()
              const isNow = isToday && hourValue === nowHour
              const isPast = isToday && hourValue < nowHour
              return (
                <article key={hour.time} className={`${hour.isDay ? 'is-day' : 'is-night'}${isNow ? ' is-now' : ''}${isPast ? ' is-past' : ''}`}>
                  <span className="mobile-hour-time">{isNow ? 'Jetzt' : fmtTime(hour.time)}<small>{hour.isDay ? 'Tag' : 'Nacht'}</small></span>
                  <span className="mobile-hour-weather">
                    <WeatherIcon code={hour.code} size={27} isDay={hour.isDay} />
                    <b>{round(hour.temperature)}°</b>
                    <small>gefühlt {round(hour.apparent)}°</small>
                  </span>
                  <span className="mobile-hour-rain" style={{ '--rain': `${hour.rainChance}%` }}>
                    <b>{hour.rainChance}%</b>
                    <i><em /></i>
                    <small>{fmtPrecip(hour.rainAmount)}</small>
                  </span>
                  <span className="mobile-hour-wind">
                    <Wind aria-hidden="true" />
                    <b>{round(hour.wind)}</b>
                    <small>Böen bis {round(hour.gusts)}</small>
                  </span>
                </article>
              )
            })}
          </div>
        </section>

        <section className="mobile-day-facts">
          <MobileSectionHead kicker="DER TAG KOMPLETT" title="Licht, Luft und Spitzenwerte." />
          <div>
            {dailyFacts.map(({ icon: Icon, label, topic, value }) => (
              <article key={label}>
                <Icon aria-hidden="true" />
                <span>{label}{topic && <InfoButton topic={topic} />}</span>
                <b>{value}</b>
              </article>
            ))}
          </div>
        </section>

        <div className="mobile-day-stepper">
          <button type="button" disabled={dayIndex === 0} onClick={() => onSelectDay(dayIndex - 1)}><ChevronLeft aria-hidden="true" />Vorheriger Tag</button>
          <button type="button" disabled={dayIndex === model.d.time.length - 1} onClick={() => onSelectDay(dayIndex + 1)}>Nächster Tag<ChevronRight aria-hidden="true" /></button>
        </div>
      </div>
    </main>
  )
}

function RadarView({ place, onSearch }) {
  return (
    <main className="mobile-screen mobile-radar-screen">
      <MobileBrand place={place} onSearch={onSearch} solid />
      <div className="mobile-screen-content">
        <header className="mobile-page-title">
          <span><i />LIVE RADAR</span>
          <h1>Regen sehen.<em>Bevor er da ist.</em></h1>
          <p>Ziehen, zoomen und die Entwicklung Bild für Bild verfolgen.</p>
        </header>
        <ErrorBoundary fallback={<p className="card-fallback">Radar derzeit nicht verfügbar.</p>}>
          <Radar latitude={place.latitude} longitude={place.longitude} placeName={place.name} compact />
        </ErrorBoundary>
        <p className="mobile-radar-credit">
          <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">Karte · OpenStreetMap</a>
          <span>Radar · DWD / RainViewer</span>
        </p>
      </div>
    </main>
  )
}

function ForecastView({ model, place, dayIndex, onSearch, onOpenDay }) {
  const lowest = Math.min(...model.d.temperature_2m_min)
  const highest = Math.max(...model.d.temperature_2m_max)
  const span = Math.max(1, highest - lowest)

  return (
    <main className="mobile-screen mobile-forecast-screen">
      <MobileBrand place={place} onSearch={onSearch} solid />
      <div className="mobile-screen-content">
        <header className="mobile-page-title">
          <span>10-TAGE-AUSBLICK</span>
          <h1>Was kommt,<em>bleibt sichtbar.</em></h1>
          <p>Jeder Tag führt direkt zu seinen 24 Stunden.</p>
        </header>

        <div className="mobile-forecast-list">
          {model.d.time.map((date, index) => {
            const low = model.d.temperature_2m_min[index]
            const high = model.d.temperature_2m_max[index]
            const code = dayCode(model.h, date, model.d.weather_code[index])
            return (
              <button
                type="button"
                key={date}
                className={index === dayIndex ? 'is-active' : ''}
                onClick={() => onOpenDay(index)}
                style={{ '--range-start': `${(low - lowest) / span * 100}%`, '--range-end': `${100 - (high - lowest) / span * 100}%` }}
              >
                <span className="mobile-forecast-date">
                  <b>{index === 0 ? 'Heute' : new Date(date).toLocaleDateString('de-DE', { weekday: 'long' })}</b>
                  <small>{new Date(date).toLocaleDateString('de-DE', { day: '2-digit', month: 'long' })}</small>
                </span>
                <span className="mobile-forecast-weather">
                  <WeatherIcon code={code} size={31} />
                  <small>{weatherLabel(code)}</small>
                </span>
                <span className="mobile-forecast-rain"><Droplets aria-hidden="true" />{model.d.precipitation_probability_max[index] ?? 0}%</span>
                <span className="mobile-forecast-range" aria-hidden="true"><i /></span>
                <span className="mobile-forecast-temps"><small>{round(low)}°</small><b>{round(high)}°</b></span>
                <ChevronRight aria-hidden="true" />
              </button>
            )
          })}
        </div>
        <MobileSources />
      </div>
    </main>
  )
}

function MobileSources() {
  return (
    <footer className="mobile-sources">
      <p><b>himmel°</b> schaut für dich nach oben.</p>
      <p>
        <a href="https://open-meteo.com/" target="_blank" rel="noopener noreferrer">Open-Meteo</a>
        <a href="https://www.dwd.de/" target="_blank" rel="noopener noreferrer">DWD</a>
        <a href="https://www.rainviewer.com/" target="_blank" rel="noopener noreferrer">RainViewer</a>
        <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a>
      </p>
    </footer>
  )
}

export default function MobileShell({ model, data, place, day, dayIndex, onSearch, onSelectDay }) {
  const [view, setView] = useState('today')
  const [navHidden, setNavHidden] = useState(false)

  const navigate = next => {
    setNavHidden(false)
    setView(next)
    window.scrollTo({ top: 0, behavior: 'auto' })
  }

  const openDay = index => {
    setNavHidden(false)
    onSelectDay(index)
    setView('hours')
    window.scrollTo({ top: 0, behavior: 'auto' })
  }

  useEffect(() => {
    document.body.dataset.mobileView = view
    return () => { delete document.body.dataset.mobileView }
  }, [view])

  useEffect(() => {
    let lastY = window.scrollY
    let frame = 0

    const update = () => {
      const nextY = Math.max(0, window.scrollY)
      const delta = nextY - lastY

      if (nextY < 28 || delta < -8) setNavHidden(false)
      else if (delta > 8) setNavHidden(true)

      lastY = nextY
      frame = 0
    }

    const onScroll = () => {
      if (!frame) frame = window.requestAnimationFrame(update)
    }

    window.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      window.removeEventListener('scroll', onScroll)
      if (frame) window.cancelAnimationFrame(frame)
    }
  }, [view])

  return (
    <div className="mobile-app">
      <div key={view} className="mobile-view-stage">
        {view === 'today' && (
          <TodayView
            model={model} data={data} place={place} day={day} onSearch={onSearch}
            onNavigate={navigate} onOpenDay={openDay}
          />
        )}
        {view === 'hours' && (
          <HoursView model={model} place={place} dayIndex={dayIndex} onSearch={onSearch} onSelectDay={onSelectDay} />
        )}
        {view === 'radar' && <RadarView place={place} onSearch={onSearch} />}
        {view === 'forecast' && (
          <ForecastView model={model} place={place} dayIndex={dayIndex} onSearch={onSearch} onOpenDay={openDay} />
        )}
      </div>

      <nav className={`mobile-tabbar${navHidden ? ' is-hidden' : ''}`} aria-label="Hauptbereiche" aria-hidden={navHidden || undefined}>
        {NAV_ITEMS.map(({ id, label, icon: Icon }) => (
          <button
            type="button"
            key={id}
            className={view === id ? 'is-active' : ''}
            aria-current={view === id ? 'page' : undefined}
            tabIndex={navHidden ? -1 : undefined}
            onClick={() => navigate(id)}
          >
            <Icon aria-hidden="true" />
            <span>{label}</span>
          </button>
        ))}
      </nav>
    </div>
  )
}
