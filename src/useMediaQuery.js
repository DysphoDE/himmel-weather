import { useCallback, useSyncExternalStore } from 'react'

/**
 * Liest einen Media Query in React-State. Wird gebraucht, damit Dashboard und
 * Hero sich gegenseitig ersetzen statt per display:none beide im DOM zu liegen –
 * eine versteckte Leaflet-Karte hat Größe 0 und reißt beim flyTo die App mit.
 *
 * useSyncExternalStore liest den Wert bei jedem Rendern frisch, kann also nicht
 * veralten. Zusätzlich zu 'change' hängt der Hook an 'resize', weil eingebettete
 * Ansichten und Geräte-Emulation das change-Event nicht zuverlässig feuern.
 */
export default function useMediaQuery(query) {
  const subscribe = useCallback(notify => {
    const mql = window.matchMedia(query)
    mql.addEventListener('change', notify)
    window.addEventListener('resize', notify)
    return () => {
      mql.removeEventListener('change', notify)
      window.removeEventListener('resize', notify)
    }
  }, [query])

  const getSnapshot = useCallback(() => window.matchMedia(query).matches, [query])

  return useSyncExternalStore(subscribe, getSnapshot, () => false)
}
