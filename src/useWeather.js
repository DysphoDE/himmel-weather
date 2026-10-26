import { useCallback, useEffect, useRef, useState } from 'react'
import { fetchWeather, localDate } from './weather.js'

export const WEATHER_REFRESH_MS = 10 * 60_000

/** Ort und Antwort gehören zusammen, auch während eines fehlgeschlagenen
 * Ortswechsels. Hintergrundabfragen überlappen nicht und werden beim Wechsel
 * abgebrochen. Nach einem Fehler versucht der Takt es erneut. */
export default function useWeather(place) {
  const [snapshot, setSnapshot] = useState(null)
  const [now, setNow] = useState(Date.now)
  const loadRef = useRef(null)
  const refresh = useCallback(() => loadRef.current?.(), [])

  useEffect(() => {
    const controller = new AbortController()
    let pending = false
    let lastAttempt = 0
    let latest = null
    const load = async () => {
      if (pending || controller.signal.aborted) return
      pending = true
      lastAttempt = Date.now()
      setSnapshot(previous => previous?.place === place ? { ...previous, refreshing: true } : previous)
      try {
        const data = await fetchWeather(place.latitude, place.longitude, { signal: controller.signal })
        if (controller.signal.aborted) return
        latest = data
        setSnapshot({ place, data, error: '', refreshing: false })
      } catch (error) {
        if (!controller.signal.aborted) setSnapshot({ place, data: latest, refreshing: false, error: error.message || 'Wetterdaten derzeit nicht erreichbar' })
      } finally {
        pending = false
      }
    }
    const check = () => {
      setNow(Date.now())
      if (Date.now() - lastAttempt >= WEATHER_REFRESH_MS ||
        (latest && localDate(latest.timezone) !== latest.daily.time[0])) load()
    }
    const onVisible = () => { if (!document.hidden) check() }
    loadRef.current = load
    load()
    // Minutengenau auch den Tageswechsel am Wetterort erkennen, unabhängig
    // vom Zehn-Minuten-Takt und von gedrosselten Timern im Hintergrundtab.
    const timer = setInterval(check, 60_000)
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('focus', check)
    return () => {
      controller.abort()
      if (loadRef.current === load) loadRef.current = null
      clearInterval(timer)
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('focus', check)
    }
  }, [place])

  const current = snapshot?.place === place ? snapshot : null
  return { data: current?.data ?? null, error: current?.error ?? '', loading: !current, now,
    refreshing: current?.refreshing ?? false, refresh }
}
