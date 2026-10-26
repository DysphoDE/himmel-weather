import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import { ChevronRight, LocateFixed, MapPin, Search, X } from 'lucide-react'
import { measurement, searchPlaces } from './weather'

export default function SearchPanel({ open, onClose, onPick, onLocate }) {
  const [query, setQuery] = useState('')
  const [response, setResponse] = useState({ query: '', places: [] })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [active, setActive] = useState(-1)
  const results = response.query === query ? response.places : []
  const dialogRef = useRef(null)
  const inputRef = useRef(null)
  const listId = useId()

  useEffect(() => {
    const controller = new AbortController()
    let alive = true
    setResponse({ query, places: [] })
    setActive(-1)
    setError('')
    setBusy(open && query.trim().length >= 2)
    if (!open || query.trim().length < 2) return
    const timer = setTimeout(async () => {
      try {
        const places = await searchPlaces(query, { signal: controller.signal })
        if (alive) setResponse({ query, places })
      } catch {
        if (alive) setError('Ortssuche derzeit nicht erreichbar. Bitte erneut versuchen.')
      } finally { if (alive) setBusy(false) }
    }, 300)
    return () => { alive = false; controller.abort(); clearTimeout(timer) }
  }, [query, open])

  useLayoutEffect(() => {
    if (!open) return
    const opener = document.activeElement
    const dialog = dialogRef.current
    dialog.showModal()
    inputRef.current.focus()
    return () => {
      dialog.close()
      if (opener?.isConnected) opener.focus({ preventScroll: true })
    }
  }, [open])

  useEffect(() => {
    if (active >= 0) document.getElementById(`${listId}-${active}`)?.scrollIntoView({ block: 'nearest' })
  }, [active, listId])

  if (!open) return null
  const onKeyDown = event => {
    if (!results.length) return
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault()
      setActive(index => event.key === 'ArrowDown'
        ? (index + 1) % results.length : (index <= 0 ? results.length - 1 : index - 1))
    } else if (event.key === 'Enter' && (active >= 0 || results.length === 1)) {
      event.preventDefault()
      onPick(results[active >= 0 ? active : 0])
    }
  }
  const keepFocus = event => {
    if (event.key !== 'Tab') return
    const controls = [...dialogRef.current.querySelectorAll('input, button:not([tabindex="-1"]):not(:disabled)')]
    const first = controls[0]
    const last = controls.at(-1)
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus() }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus() }
  }

  return (
    <dialog ref={dialogRef} className="search-overlay" aria-label="Ort suchen"
      onKeyDown={keepFocus}
      onCancel={event => { event.preventDefault(); onClose() }}
      onMouseDown={event => { if (event.target === event.currentTarget) onClose() }}>
      <div className="search-panel">
        <div className="search-input">
          <Search aria-hidden="true" />
          <input ref={inputRef} value={query} onChange={event => { setQuery(event.target.value); setActive(-1) }}
            onKeyDown={onKeyDown} placeholder="Stadt oder Ort suchen …" aria-label="Ortsname"
            role="combobox" aria-autocomplete="list" aria-controls={listId} aria-expanded={results.length > 0}
            aria-activedescendant={active >= 0 && results[active] ? `${listId}-${active}` : undefined} />
          <button type="button" onClick={onClose} aria-label="Suche schließen"><X aria-hidden="true" /></button>
        </div>
        <button type="button" className="locate-row" onClick={onLocate}>
          <LocateFixed aria-hidden="true" />
          <span><b>Meinen Standort verwenden</b><small>Präzise Vorhersage für deine Position</small></span>
          <ChevronRight aria-hidden="true" />
        </button>
        <p className="search-state" role="status">
          {busy && query.trim().length >= 2 ? 'Suche läuft …' : error || (results.length
            ? `${results.length} Orte gefunden. Mit den Pfeiltasten auswählen und mit Enter öffnen.`
            : query.trim().length >= 2 ? 'Kein Ort gefunden' : 'Mindestens zwei Zeichen eingeben.')}
        </p>
        <div className="search-results" id={listId} role="listbox" aria-label="Gefundene Orte" aria-busy={busy}>
          {results.map((place, index) => (
            <button type="button" role="option" id={`${listId}-${index}`} key={place.id}
              tabIndex={-1} aria-selected={active === index} onClick={() => onPick(place)}>
              <MapPin aria-hidden="true" />
              <span><b>{place.name}</b><small>{[place.admin1, place.country].filter(Boolean).join(', ')}</small></span>
              <span className="search-coords">{measurement(place.latitude)}° / {measurement(place.longitude)}°</span>
            </button>
          ))}
        </div>
        <p className="search-credit">Ortssuche · Open-Meteo Geocoding</p>
      </div>
    </dialog>
  )
}
