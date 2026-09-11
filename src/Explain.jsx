import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import { EXPLAIN } from './explanations'

/**
 * Ein „?“ neben einem Wert, das erklärt, was dort eigentlich steht.
 *
 * Umgesetzt als <dialog> mit showModal() statt als aufklappendes Kästchen:
 * Die Werte stehen in Karten und Scroll-Bereichen, die ihren Inhalt
 * abschneiden – ein Popover wäre dort halb unsichtbar. Der Dialog liegt in der
 * obersten Ebene des Browsers und bringt Escape-Taste, Fokusfalle und
 * Abdunkelung von Haus aus mit.
 */
export default function InfoButton({ topic, tone = '' }) {
  const entry = EXPLAIN[topic]
  const [open, setOpen] = useState(false)
  const dialogRef = useRef(null)
  const triggerRef = useRef(null)

  /* Geschlossen wird ausschließlich über diesen Zustand, nicht über das
     'close'-Ereignis des Dialogs: Das feuert nicht in jeder Umgebung, und über
     ein Portal reicht React es auch nicht als onClose durch. Der Dialog blieb
     dadurch nach Escape unsichtbar im DOM stehen und ließ sich nicht wieder
     öffnen. */
  useEffect(() => {
    if (!open) return
    const dialog = dialogRef.current
    if (!dialog) return
    // showModal() auf einem schon offenen Dialog wirft – und React ruft diesen
    // Effekt im Entwicklungsmodus absichtlich zweimal auf.
    if (!dialog.open) dialog.showModal()

    /* Escape selbst behandeln, damit Anzeige und Zustand zusammenbleiben.
       In der Erfassungsphase, also noch vor dem Standardverhalten des
       Browsers. */
    const onKeyDown = event => {
      if (event.key !== 'Escape') return
      event.preventDefault()
      setOpen(false)
    }
    document.addEventListener('keydown', onKeyDown, true)
    return () => document.removeEventListener('keydown', onKeyDown, true)
  }, [open])

  /* Fokus zurück auf das „?“, sobald der Dialog wieder weg ist – aber nur
     dann. Ohne das Merkzeichen würde jede der Schaltflächen beim Seitenaufbau
     nach dem Fokus greifen. */
  const wasOpen = useRef(false)
  useEffect(() => {
    if (open) {
      wasOpen.current = true
    } else if (wasOpen.current) {
      wasOpen.current = false
      triggerRef.current?.focus({ preventScroll: true })
    }
  }, [open])

  if (!entry) return null

  const requestClose = () => setOpen(false)

  return (
    <>
      <button
        type="button"
        ref={triggerRef}
        className={`explain-button${tone ? ` ${tone}` : ''}`}
        onClick={() => setOpen(true)}
        aria-label={`${entry.title}: Was bedeutet dieser Wert?`}
      >
        <span aria-hidden="true">?</span>
      </button>

      {/* Der Dialog hängt am <body>, nicht an der Kachel: Sonst greifen deren
          Regeln – etwa ".metric-cluster b { font-size: 38px }" – mitten in den
          Erklärtext hinein. */}
      {open && createPortal(
        <dialog
          ref={dialogRef}
          className="explain-dialog"
          aria-labelledby={`explain-${topic}`}
          onClick={event => { if (event.target === dialogRef.current) requestClose() }}
        >
          <div className="explain-panel">
            <header>
              <div>
                <span>{entry.subtitle}</span>
                <h2 id={`explain-${topic}`}>{entry.title}</h2>
              </div>
              <button type="button" onClick={requestClose} aria-label="Erklärung schließen">
                <X aria-hidden="true" />
              </button>
            </header>

            <p className="explain-lead">{entry.meaning}</p>

            <dl className="explain-detail">
              <div>
                <dt>Wie der Wert entsteht</dt>
                <dd>{entry.method}</dd>
              </div>
              {entry.normal && (
                <div>
                  <dt>Was normal ist</dt>
                  <dd>{entry.normal}</dd>
                </div>
              )}
            </dl>

            {/* Ein Eintrag bringt entweder eine Skala oder mehrere benannte –
                die Karte „Luft & Pollen“ etwa erklärt zwei Messgrößen. */}
            {(entry.scales ?? (entry.scale ? [{ head: 'Einordnung', scale: entry.scale }] : [])).map(({ head, scale }) => (
              <div className="explain-scale" key={head}>
                <p className="explain-scale-head">{head}</p>
                <ol>
                  {scale.map(step => (
                    <li key={step.label}>
                      <b>{step.range}</b>
                      <span>{step.label}</span>
                      {step.hint && <small>{step.hint}</small>}
                    </li>
                  ))}
                </ol>
              </div>
            ))}

            {entry.note && <p className="explain-note">{entry.note}</p>}
            {entry.source && <p className="explain-source">{entry.source}</p>}
          </div>
        </dialog>,
        document.body
      )}
    </>
  )
}
