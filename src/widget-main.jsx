import React from 'react'
import ReactDOM from 'react-dom/client'
import './tokens.css'
import './widget.css'
import Widget from './Widget'
import ErrorBoundary from './ErrorBoundary'

/* Eigener Einstiegspunkt, damit das Widget nicht die Bündel der Hauptansicht
   mitzieht: Leaflet, Radar und Himmelsszene sind hier nicht im Bild.
   Heißt „widget-main“ und nicht „widget“, weil Windows Widget.jsx und
   widget.jsx für dieselbe Datei hält. */
ReactDOM.createRoot(document.getElementById('widget')).render(
  <React.StrictMode>
    <ErrorBoundary fallback={
      <div className="widget">
        <p className="widget-state is-error">Wetterdaten derzeit nicht verfügbar.</p>
      </div>
    }>
      <Widget />
    </ErrorBoundary>
  </React.StrictMode>
)
