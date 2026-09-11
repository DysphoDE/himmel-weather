import React from 'react'
import { createRoot } from 'react-dom/client'
import Radar, { MiniRadar } from '../src/Radar.jsx'
import 'leaflet/dist/leaflet.css'
import '../src/tokens.css'
import '../src/base.css'
import '../src/content.css'
import '../src/dashboard.css'
const mode = new URLSearchParams(location.search).get('mode')
const component = mode === 'mini' ? <div style={{ width: 500, height: 400 }}><MiniRadar latitude={52.52} longitude={13.405} placeName="Berlin" /></div>
  : <main className="content"><Radar latitude={mode === 'global' ? 40.71 : 52.52} longitude={mode === 'global' ? -74 : 13.405} placeName="Testort" /></main>
createRoot(document.getElementById('root')).render(
  <React.StrictMode>{component}</React.StrictMode>
)
