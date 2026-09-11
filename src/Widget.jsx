import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ArrowUpRight, Droplets, MapPin, Sunset, Wind } from 'lucide-react'
import WeatherIcon from './WeatherIcon'
import {
  DEFAULT_PLACE, dayCode, fetchWidgetWeather, fmtDay, fmtTime, hourNumber,
  searchPlaces, weatherLabel
} from './weather'

const round = n => Math.round(n ?? 0)

/* Ein Portal-Widget bleibt geöffnet, solange die Seite offen ist – ohne eigenen
   Takt zeigte es abends noch die Zahlen vom Morgen. */
const REFRESH_MS = 10 * 60 * 1000
const HOURS = 5
const DAYS = 3

/**
 * Einbettung wird über die Adresse eingestellt, nicht über die Oberfläche:
 * Im Widget gibt es bewusst keine Ortssuche, und der gespeicherte Ort aus der
 * Hauptansicht (localStorage) gilt hier nicht – das Portal soll für alle
 * Besucher dasselbe zeigen.
 *
 *   ?lat=47.78&lon=10.62&ort=Marktoberdorf
 *   ?ort=Kaufbeuren            (wird über die Geocoding-API aufgelöst)
 *   ?link=https://…            (Ziel des „himmel°“-Verweises)
 */
function readParams() {
  const query = new URLSearchParams(window.location.search)
  // Deutsche Eingaben schreiben Koordinaten gern mit Komma.
  const number = key => {
    const raw = query.get(key)
    if (raw == null) return null
    const value = Number(raw.replace(',', '.'))
    return Number.isFinite(value) ? value : null
  }
  return {
    latitude: number('lat') ?? number('latitude'),
    longitude: number('lon') ?? number('lng') ?? number('longitude'),
    name: (query.get('ort') || query.get('name') || '').trim(),
    link: (query.get('link') || '').trim()
  }
}

async function resolvePlace({ latitude, longitude, name }) {
  if (latitude != null && longitude != null) {
    // Ohne Namen steht die Position selbst da – lieber die Koordinate als ein
    // fremder Ortsname, der zufällig der Standard ist.
    return {
      name: name || `${latitude.toFixed(2)}° / ${longitude.toFixed(2)}°`,
      latitude,
      longitude
    }
  }
  if (name) {
    const [hit] = await searchPlaces(name)
    if (!hit) throw new Error(`Ort „${name}“ nicht gefunden`)
    return hit
  }
  return DEFAULT_PLACE
}

/* Ziel des Verweises: Die Vollansicht liegt neben widget.html, also im selben
   Ordner – das trägt auch, wenn alles unter /wetter/ ausgeliefert wird. */
const siteUrl = link => {
  if (link) return link
  try { return new URL('.', window.location.href).href } catch { return './' }
}

function Frame({ children, place, stamp, link }) {
  return (
    <div className="widget">
      <div className="widget-head">
        {/* Überschrift, nicht Absatz: Das Widget ist im iframe ein eigenes
            Dokument und hätte sonst keine. */}
        <h1 className="widget-place">
          <MapPin aria-hidden="true" />
          <b>{place}</b>
          {stamp && <small>Stand {stamp}</small>}
        </h1>
        <a
          className="widget-brand"
          href={link}
          target="_blank"
          rel="noopener noreferrer"
          title="Alle Details bei himmel° ansehen"
        >
          himmel<i aria-hidden="true">°</i>
          <ArrowUpRight aria-hidden="true" />
          <span className="visually-hidden">– vollständige Vorhersage in neuem Tab öffnen</span>
        </a>
      </div>
      {children}
    </div>
  )
}

export default function Widget() {
  const params = useMemo(readParams, [])
  const link = useMemo(() => siteUrl(params.link), [params.link])

  const [place, setPlace] = useState(null)
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  const root = useRef(null)
  /* Der aufgelöste Ort steht in einer Ref, nicht nur im State: Sonst suchte der
     Zehn-Minuten-Takt bei „?ort=…“ jedes Mal erneut in der Geocoding-API. */
  const found = useRef(null)

  const load = useCallback(async signal => {
    try {
      const target = found.current || await resolvePlace(params)
      const fresh = await fetchWidgetWeather(target.latitude, target.longitude, DAYS + 1)
      if (signal.aborted) return
      found.current = target
      setPlace(target)
      setData(fresh)
      setError('')
    } catch (e) {
      if (!signal.aborted) setError(e.message || 'Wetterdaten derzeit nicht erreichbar')
    }
  }, [params])

  useEffect(() => {
    const control = new AbortController()
    load(control.signal)
    const timer = setInterval(() => load(control.signal), REFRESH_MS)
    return () => { control.abort(); clearInterval(timer) }
  }, [load])

  /* Die einbettende Seite kann die nötige Höhe nicht kennen – sie erfährt sie.
     Verschickt wird nur eine Zahl, deshalb genügt „*“ als Ziel. Wer die Nachricht
     nicht auswertet, gibt dem iframe einfach eine feste Höhe. */
  useEffect(() => {
    const node = root.current
    if (!node || window.parent === window) return
    const send = () => window.parent.postMessage(
      { type: 'himmel:height', height: Math.ceil(node.getBoundingClientRect().height) },
      '*'
    )
    send()

    /* Drei Auslöser, weil einer allein nicht reicht: Der Beobachter meldet jede
       Änderung, die Breite entscheidet über das Layout (und damit die Höhe), und
       nachgeladene Schriften verschieben die Zeilen ein letztes Mal – der
       Beobachter ist zu diesem Zeitpunkt in manchen Browsern noch nicht dran. */
    const observer = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(send) : null
    observer?.observe(node)
    window.addEventListener('resize', send)
    document.fonts?.ready.then(send).catch(() => {})

    return () => {
      observer?.disconnect()
      window.removeEventListener('resize', send)
    }
  }, [data, error])

  const model = useMemo(() => {
    if (!data) return null
    const h = data.hourly
    const next = h.time.findIndex(t => new Date(t) > new Date())
    const hour = next <= 0 ? 0 : next - 1
    /* Regenrisiko der nächsten acht Stunden, nicht das Tagesmaximum aus daily:
       Dort stand am Abend „100 %“, während der Schauer längst vorbei war. */
    const rainNext = Math.max(
      0,
      ...(h.precipitation_probability?.slice(hour, hour + 8) || []).map(value => Number(value) || 0)
    )
    return { c: data.current, h, d: data.daily, hour, rainNext, isDay: data.current.is_day !== 0 }
  }, [data])

  return (
    <div className="widget-root" ref={root}>
      {!model && !error && (
        <Frame place={place?.name || 'Vorhersage'} link={link}>
          <p className="widget-state" role="status">Atmosphäre wird gelesen …</p>
        </Frame>
      )}

      {!model && error && (
        <Frame place={place?.name || 'Vorhersage'} link={link}>
          <p className="widget-state is-error" role="alert">{error}</p>
        </Frame>
      )}

      {model && (
        <Frame place={place.name} stamp={fmtTime(model.c.time)} link={link}>
          <div className="widget-body">
            <div className="widget-now">
              <WeatherIcon code={model.c.weather_code} size={40} strokeWidth={1.5} isDay={model.isDay} />
              <p className="widget-temp"><b>{round(model.c.temperature_2m)}</b><sup>°</sup></p>
              <div className="widget-now-copy">
                <b>{weatherLabel(model.c.weather_code)}</b>
                <small>
                  Gefühlt {round(model.c.apparent_temperature)}° ·
                  {' '}Höchst {round(model.d.temperature_2m_max[0])}° ·
                  {' '}Tiefst {round(model.d.temperature_2m_min[0])}°
                </small>
                <small className="widget-facts">
                  <span title="Höchstes Regenrisiko der nächsten acht Stunden">
                    <Droplets aria-hidden="true" />bis {model.rainNext} % Regen
                  </span>
                  <span><Wind aria-hidden="true" />{round(model.c.wind_speed_10m)} km/h</span>
                  {/* Nur wenn die Kachel breit genug ist – sonst bricht die Zeile. */}
                  <span className="widget-fact-wide"><Sunset aria-hidden="true" />{fmtTime(model.d.sunset[0])}</span>
                </small>
              </div>
            </div>

            <div className="widget-hours">
              {model.h.time.slice(model.hour, model.hour + HOURS).map((time, i) => {
                const index = model.hour + i
                return (
                  <div key={time} className={i === 0 ? 'is-now' : ''}>
                    <span>{i === 0 ? 'Jetzt' : hourNumber(time)}</span>
                    <WeatherIcon code={model.h.weather_code[index]} size={19} isDay={model.h.is_day?.[index] !== 0} />
                    <b>{round(model.h.temperature_2m[index])}°</b>
                    <small><Droplets aria-hidden="true" />{model.h.precipitation_probability?.[index] ?? 0} %</small>
                  </div>
                )
              })}
            </div>

            <div className="widget-days">
              {model.d.time.slice(1, DAYS + 1).map((date, i) => {
                const index = i + 1
                return (
                  <div key={date}>
                    <span>{fmtDay(date)}</span>
                    <WeatherIcon code={dayCode(model.h, date, model.d.weather_code[index])} size={19} />
                    <b>{round(model.d.temperature_2m_max[index])}°</b>
                    <small>{round(model.d.temperature_2m_min[index])}°</small>
                  </div>
                )
              })}
            </div>
          </div>
        </Frame>
      )}
    </div>
  )
}
