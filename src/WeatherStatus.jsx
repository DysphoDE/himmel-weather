import { fmtTime, formatWeatherDate } from './weather'

export default function WeatherStatus({ place, data, refreshing, onRetry }) {
  return (
    <aside className="weather-status" aria-label="Aktualisierung der Wetterdaten">
      <p role="status">
        <b>Aktualisierung fehlgeschlagen · {place.name}</b>
        <span>Letzte Vorhersage · Stand {formatWeatherDate(data.current.time, { day: '2-digit', month: '2-digit' })}, {fmtTime(data.current.time)} Uhr</span>
      </p>
      <button type="button" onClick={onRetry} disabled={refreshing}>
        {refreshing ? 'Wird aktualisiert …' : 'Erneut aktualisieren'}
      </button>
    </aside>
  )
}
