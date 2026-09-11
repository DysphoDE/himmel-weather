import { useEffect, useMemo, useRef } from 'react'
import {
  ChevronLeft, ChevronRight, Droplets, Eye, Sparkles, Sunrise, Sunset, Thermometer, Wind
} from 'lucide-react'
import WeatherIcon from './WeatherIcon'
import InfoButton from './Explain'
import {
  cardinal, dayCode, fmtDate, fmtDayLong, fmtPrecip, fmtTime, hoursOfDay, outdoorScore,
  uvAdvice, uvTier, weatherLabel
} from './weather'

const round = value => Math.round(value ?? 0)

function WeatherMatrix({ timeline, isToday, nowIndex }) {
  const scrollRef = useRef(null)

  useEffect(() => {
    const scroller = scrollRef.current
    if (!scroller || !isToday) return
    const current = scroller.querySelector('.matrix-weather.is-now')
    if (!current) return
    scroller.scrollLeft = Math.max(0, current.offsetLeft - scroller.clientWidth * .45)
  }, [isToday, nowIndex, timeline])

  return (
    <div className="weather-matrix-scroll" ref={scrollRef}>
      <div className="weather-matrix">
        <div className="matrix-label is-weather"><b>Wetter</b><small>Temperatur &amp; gefühlt</small></div>
        {timeline.map(hour => {
          const isNow = isToday && hour.index === nowIndex
          const isPast = isToday && hour.index < nowIndex
          return (
            <div key={`weather-${hour.time}`} className={`matrix-weather${hour.isDay ? ' is-day' : ' is-night'}${isNow ? ' is-now' : ''}${isPast ? ' is-past' : ''}`}>
              <span>{isNow ? 'Jetzt' : fmtTime(hour.time)}</span>
              <WeatherIcon code={hour.code} size={27} isDay={hour.isDay} />
              <b>{round(hour.temperature)}°</b>
              <small>gefühlt {round(hour.apparent)}°</small>
            </div>
          )
        })}

        <div className="matrix-label"><Droplets aria-hidden="true" /><b>Regen</b><small>Chance &amp; Menge</small></div>
        {timeline.map(hour => (
          <div key={`rain-${hour.time}`} className="matrix-value is-rain">
            <b>{hour.rainChance} %</b>
            <span aria-hidden="true"><i style={{ width: `${hour.rainChance}%` }} /></span>
            <small>{hour.rainAmount ? fmtPrecip(hour.rainAmount) : 'trocken'}</small>
          </div>
        ))}

        <div className="matrix-label"><Wind aria-hidden="true" /><b>Wind</b><small>Mittel &amp; Böen</small></div>
        {timeline.map(hour => (
          <div key={`wind-${hour.time}`} className="matrix-value">
            <b>{round(hour.wind)} <small>km/h</small></b>
            <span className="matrix-gust">Böen bis {round(hour.gusts)}</span>
          </div>
        ))}

        <div className="matrix-label"><Eye aria-hidden="true" /><b>Luft</b><small>Feuchte &amp; Sicht</small></div>
        {timeline.map(hour => (
          <div key={`air-${hour.time}`} className="matrix-value">
            <b>{round(hour.humidity)} %</b>
            <small>{round(hour.visibility / 1000)} km Sicht</small>
          </div>
        ))}
      </div>
    </div>
  )
}

export default function DayDetail({ model, dayIndex, onSelectDay, nowIndex }) {
  const daily = model.d
  const date = daily.time[dayIndex]
  const hours = useMemo(() => hoursOfDay(model.h, date), [model.h, date])
  const isToday = dayIndex === 0

  if (!hours.length) return null

  const code = dayCode(model.h, date, daily.weather_code[dayIndex])
  const dayLength = (new Date(daily.sunset[dayIndex]) - new Date(daily.sunrise[dayIndex])) / 3600000
  const warmest = hours.reduce((peak, hour) => hour.temperature > peak.temperature ? hour : peak, hours[0])
  const rainiest = hours.reduce((peak, hour) => hour.rainChance > peak.rainChance ? hour : peak, hours[0])
  const windiest = hours.reduce((peak, hour) => hour.gusts > peak.gusts ? hour : peak, hours[0])
  const humidityAverage = hours.reduce((sum, hour) => sum + (hour.humidity || 0), 0) / hours.length
  const visibilityMinimum = Math.min(...hours.map(hour => hour.visibility || Infinity))
  const timeline = hours
  /* Dieselbe Rechnung wie auf der Heute-Seite: Vorher hatte diese Ansicht
     eigene Gewichte und zeigte für denselben Tag eine andere Punktzahl. */
  const dayScore = outdoorScore({
    rainMax: daily.precipitation_probability_max[dayIndex],
    gusts: daily.wind_gusts_10m_max[dayIndex],
    uv: daily.uv_index_max[dayIndex],
    high: daily.temperature_2m_max[dayIndex]
  })
  const rainCopy = (daily.precipitation_sum[dayIndex] || 0) < .2
    ? 'Der Tag bleibt voraussichtlich trocken.'
    : `Die höchste Regenchance liegt gegen ${fmtTime(rainiest.time)} bei ${rainiest.rainChance} %.`
  const story = `Am wärmsten wird es gegen ${fmtTime(warmest.time)} mit ${round(warmest.temperature)}°. ${rainCopy} Stärkste Böen gegen ${fmtTime(windiest.time)}.`

  const facts = [
    {
      icon: Sunrise,
      label: 'Tageslicht',
      value: `${Math.floor(dayLength)} h ${Math.round(dayLength % 1 * 60)} min`,
      note: `${fmtTime(daily.sunrise[dayIndex])}–${fmtTime(daily.sunset[dayIndex])}`
    },
    {
      icon: Droplets,
      label: 'Niederschlag',
      topic: 'precip',
      value: fmtPrecip(daily.precipitation_sum[dayIndex]),
      note: `${daily.precipitation_probability_max[dayIndex] ?? 0} % maximal`
    },
    {
      icon: Wind,
      /* Die Böe vorn, das Mittel in der Zeile darunter: "15 / 41 km/h" war
         nicht nur unklar, es zwang die Kachel auch zu einer Schriftgröße, in
         der sonst nichts mehr lesbar war. */
      label: 'Böen bis',
      topic: 'wind',
      value: `${round(daily.wind_gusts_10m_max[dayIndex])} km/h`,
      note: `Mittel ${round(daily.wind_speed_10m_max[dayIndex])} km/h · aus ${cardinal(daily.wind_direction_10m_dominant[dayIndex])}`
    },
    {
      icon: Sparkles,
      label: 'UV-Maximum',
      topic: 'uv',
      value: `${round(daily.uv_index_max[dayIndex])} · ${uvTier(daily.uv_index_max[dayIndex])}`,
      note: uvAdvice(daily.uv_index_max[dayIndex])
    },
    {
      icon: Droplets,
      label: 'Luftfeuchte',
      topic: 'humidity',
      value: `${round(humidityAverage)} %`,
      note: 'Tagesmittel'
    },
    {
      icon: Eye,
      label: 'Sichtweite',
      topic: 'visibility',
      value: Number.isFinite(visibilityMinimum) ? `${round(visibilityMinimum / 1000)} km` : '–',
      note: 'schwächster Wert'
    }
  ]
  const moments = [
    { icon: Sunrise, label: 'Sonnenaufgang', time: fmtTime(daily.sunrise[dayIndex]), value: 'Der Tag beginnt' },
    { icon: Thermometer, label: 'Wärmster Moment', time: fmtTime(warmest.time), value: `${round(warmest.temperature)}° erwartet` },
    { icon: Wind, label: 'Stärkste Böe', time: fmtTime(windiest.time), value: `${round(windiest.gusts)} km/h` },
    { icon: Sunset, label: 'Sonnenuntergang', time: fmtTime(daily.sunset[dayIndex]), value: 'Der Abend beginnt' }
  ]

  return (
    <section className="day-detail" id="day-detail" aria-label="Tagesansicht">
      <header className="detail-command">
        <div>
          <span className="eyebrow"><i />TAGESANSICHT · 24 STUNDEN</span>
          <h2>{isToday ? 'Heute' : fmtDayLong(date)} <em>{fmtDate(date)}</em></h2>
        </div>

        <nav className="detail-nav" aria-label="Tag wechseln">
          <button type="button" onClick={() => onSelectDay(dayIndex - 1)} disabled={dayIndex === 0} aria-label="Vorheriger Tag">
            <ChevronLeft />
          </button>
          <span><b>{isToday ? 'Heute' : fmtDayLong(date)}</b><small>Tag {dayIndex + 1} von {daily.time.length}</small></span>
          <button type="button" onClick={() => onSelectDay(dayIndex + 1)} disabled={dayIndex >= daily.time.length - 1} aria-label="Nächster Tag">
            <ChevronRight />
          </button>
        </nav>
      </header>

      <div className="detail-anatomy">
        <article className="detail-overview" style={{ '--day-score': `${dayScore}%` }}>
          <div className="detail-overview-weather">
            <WeatherIcon code={code} size={62} strokeWidth={1.35} />
            <span>{weatherLabel(code)}</span>
          </div>
          <div className="detail-temperature">
            <b>{round(daily.temperature_2m_max[dayIndex])}<sup>°</sup></b>
            <span>{round(daily.temperature_2m_min[dayIndex])}°</span>
          </div>
          <p>{story}</p>
          <div className="detail-score">
            <span><i /></span>
            <p><b>{dayScore}/100</b><small>Draußen-Eignung<InfoButton topic="score" /></small></p>
          </div>
          <p className="detail-feels"><Thermometer aria-hidden="true" />Gefühlt {round(daily.apparent_temperature_max[dayIndex])}° bis {round(daily.apparent_temperature_min[dayIndex])}°</p>
        </article>

        <div className="detail-analysis">
          <dl className="detail-facts">
            {facts.map(({ icon: Icon, label, topic, value, note }) => (
              <div key={label}>
                {/* Symbol in der Beschriftungszeile, nicht in einer eigenen
                    Spalte: So bleibt die volle Kachelbreite für den Wert. */}
                <dt><Icon aria-hidden="true" /><span>{label}</span>{topic && <InfoButton topic={topic} />}</dt>
                <dd><b>{value}</b><small>{note}</small></dd>
              </div>
            ))}
          </dl>

          <article className="weather-matrix-card">
            <div className="weather-matrix-head">
              <div><span>STUNDENPLAN</span><h3>Was dich wann erwartet.</h3></div>
              <p>Alle 24 Stunden · horizontal ziehen</p>
            </div>
            <WeatherMatrix timeline={timeline} isToday={isToday} nowIndex={nowIndex} />
          </article>
        </div>
      </div>

      <div className="day-moments">
        <div className="day-moments-head"><span>SCHLÜSSELMOMENTE</span><small>Die vier Zeiten, die den Tag prägen.</small></div>
        <div className="day-moments-grid">
          {moments.map(({ icon: Icon, label, time, value }) => (
            <article key={label}>
              <Icon aria-hidden="true" />
              <span>{label}</span>
              <b>{time}</b>
              <small>{value}</small>
            </article>
          ))}
        </div>
      </div>
    </section>
  )
}
