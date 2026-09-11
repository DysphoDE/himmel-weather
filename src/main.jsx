import React from 'react'
import ReactDOM from 'react-dom/client'
import 'leaflet/dist/leaflet.css'
import './tokens.css'
import './base.css'
import './dashboard.css'
import './content.css'
import './mobile.css'
import App from './App'
import ErrorBoundary from './ErrorBoundary'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ErrorBoundary fallback={
      <div className="app-state is-error">
        <h1>Wetterpause.</h1>
        <p>Die Anwendung konnte nicht aufgebaut werden. Seite neu laden hilft meistens.</p>
      </div>
    }>
      <App />
    </ErrorBoundary>
  </React.StrictMode>
)
