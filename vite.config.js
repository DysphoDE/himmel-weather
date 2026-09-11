import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

/* /widget statt /widget.html: So sieht die Adresse aus, die im Portal in einem
   iframe steht. Entwicklungs- und Vorschauserver lösen sie hier selbst auf; auf
   dem Zielserver macht das der Webserver (siehe WIDGET.md) – oder das Portal
   bindet gleich /widget.html ein, das immer funktioniert. */
const widgetUrl = () => {
  const rewrite = (req, res, next) => {
    const [path, query] = req.url.split('?')
    const search = query ? `?${query}` : ''

    /* Der abschließende Schrägstrich ist kein Schönheitsfehler, sondern bricht
       die Seite: Die Bündel stehen mit relativer Basis in der Datei, unter
       /widget/ sucht der Browser sie in /widget/assets/. Deshalb umleiten statt
       ausliefern – hier wie später auf dem Zielserver. */
    if (/\/widget\/$/.test(path)) {
      res.writeHead(301, { location: path.slice(0, -1) + search })
      res.end()
      return
    }

    // Auf das letzte Segment gemünzt, damit die Regel auch trägt, wenn die
    // Anwendung unter einem Unterordner liegt (/wetter/widget).
    if (/(^|\/)widget$/.test(path)) {
      req.url = `${path}.html${search}`
    }
    next()
  }
  /* Beide Haken mit Block: Gibt der Haken etwas zurück, hält Vite das für eine
     Middleware, die nach den eigenen laufen soll – und ruft sie ohne Argumente
     auf. `server.middlewares.use()` liefert die connect-App zurück, der
     Vorschauserver startete damit nicht mehr. */
  return {
    name: 'himmel-widget-url',
    configureServer(server) { server.middlewares.use(rewrite) },
    configurePreviewServer(server) { server.middlewares.use(rewrite) }
  }
}

export default defineConfig({
  // Relative Basis: der Build läuft damit auch aus einem Unterordner
  // (z. B. /wetter/) und nicht nur von der Domainwurzel.
  base: './',
  plugins: [react(), widgetUrl()],
  build: {
    // Bilder immer als Datei ausgeben, nicht als data:-URI einbetten –
    // sonst landet das Hero-Bild im CSS und blockiert dessen Auslieferung.
    assetsInlineLimit: 4096,
    rollupOptions: {
      // Zwei Einstiegspunkte: die Anwendung und die Portal-Kachel. Gemeinsame
      // Teile (React, Wetterlogik) landen automatisch in einem geteilten Bündel.
      input: {
        main: fileURLToPath(new URL('./index.html', import.meta.url)),
        widget: fileURLToPath(new URL('./widget.html', import.meta.url))
      }
    }
  }
})
