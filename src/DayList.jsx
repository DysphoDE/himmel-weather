import { ChevronRight, Droplets, Wind } from 'lucide-react'
import WeatherIcon from './WeatherIcon'
import { dayCode, fmtDay, fmtPrecip, weatherLabel } from './weather'

const round = n => Math.round(n ?? 0)

/**
 * 10-Tage-Liste. Jede Zeile ist ein Schalter auf die Tagesansicht – der Chevron
 * verspricht damit nicht mehr eine Interaktion, die es nicht gibt.
 * Der Balken zeigt die Spanne des Tages im Verhältnis zu allen zehn Tagen.
 */
export default function DayList({ model, dayIndex, onSelectDay }) {
  const d = model.d
  const lowest = Math.min(...d.temperature_2m_min)
  const highest = Math.max(...d.temperature_2m_max)
  const span = Math.max(1, highest - lowest)
  const pct = v => (v - lowest) / span * 100

  return (
    <ol className="day-list">
      {d.time.map((date, i) => {
        const lo = d.temperature_2m_min[i], hi = d.temperature_2m_max[i]
        const code = dayCode(model.h, date, d.weather_code[i])
        return (
          <li key={date}>
            <button
              type="button"
              className={`day-row${i === dayIndex ? ' is-active' : ''}`}
              aria-current={i === dayIndex ? 'true' : undefined}
              onClick={() => onSelectDay(i)}
            >
              <span className="day-when">
                <b>{i === 0 ? 'Heute' : fmtDay(date)}</b>
                <small>{new Date(date).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' })}</small>
              </span>

              <span className="day-what">
                <WeatherIcon code={code} size={26} />
                <em>{weatherLabel(code)}</em>
              </span>

              <span className="day-wet">
                <Droplets aria-hidden="true" />
                {d.precipitation_probability_max[i] ?? 0} %
                <small>{fmtPrecip(d.precipitation_sum[i])}</small>
              </span>

              {/* Nur auf breiten Schirmen: Dort liegt neben der Temperaturspanne
                  ohnehin Platz brach. */}
              <span className="day-wind">
                <Wind aria-hidden="true" />
                {round(d.wind_gusts_10m_max[i])} km/h
                <small>Böen</small>
              </span>

              <span className="day-scale" aria-hidden="true">
                <i style={{ left: `${pct(lo)}%`, right: `${100 - pct(hi)}%` }} />
              </span>

              <span className="day-temps">
                <b>{round(hi)}°</b>
                <small>{round(lo)}°</small>
              </span>

              <ChevronRight className="day-go" aria-hidden="true" />
              <span className="visually-hidden">Tagesansicht öffnen</span>
            </button>
          </li>
        )
      })}
    </ol>
  )
}
