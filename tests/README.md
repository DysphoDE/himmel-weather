# Tests

Einmalig nach `npm install` den Testbrowser installieren:

```sh
npx playwright install chromium
```

Danach genügt für alle Prüfungen:

```sh
npm run check
```

Dieser Befehl führt Unit-Tests, Produktionsbuild und beide Browser-Testläufe aus. Der Browser-Runner startet einen eigenen Vite-Server auf einem freien lokalen Port und beendet ihn anschließend auch bei Fehlern. Ein bereits laufender Entwicklungsserver bleibt unberührt. Playwright ist als feste Entwicklungsabhängigkeit im Lockfile enthalten. Die GitHub-Actions-Workflowdatei führt denselben Befehl bei Pushes und Pull Requests aus.

Einzelne Läufe:

- `npm test`: Wetterzeiten und Kalenderdaten über Zeitzonen und Zeitumstellungen hinweg, Messwertverfügbarkeit, Pollen, Zeitfensterbewertungen, optionale Datenquellen, Zeitlimits, Abbruch von Requests, Radarlogik und Aufräumen des Testservers bei Fehlern.
- `npm run test:app:browser`: Ortswechsel und Wiederherstellung nach Fehlern, Hintergrundaktualisierung mit letzter Vorhersage und Zeitstempel, Tageswechsel, Widget, Suche mit Fokusführung und Tastaturbedienung, fehlende und teilweise verfügbare Messwerte, Bewertung desselben Zeitfensters auf Desktop und Mobil sowie Scrollpositionen der Tagesansicht.
- `npm run test:radar:browser`: StrictMode, verzögerte und fehlgeschlagene Kacheln, Wiederholungen, Zeitwechsel, Zoom/Pan, Wiedergabe und globale Abdeckung.
- `npm run test:browser`: beide Browser-Testläufe.

Alle Wetter- und Radarantworten der Browser-Tests werden lokal nachgebildet; Live-APIs werden nicht benötigt. Für eine externe Playwright-Installation kann `PLAYWRIGHT_MODULE` auf deren absoluten `index.mjs`-Pfad gesetzt werden. Wer die Testskripte direkt (`node tests/app.browser.mjs`) ausführt, kann mit `APP_URL` einen eigenen Server angeben. Die Radar-Harness-Seite lässt sich mit einem Entwicklungsserver auch zum manuellen Prüfen von Live-Daten öffnen.
