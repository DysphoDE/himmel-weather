# himmel°

> Schaut für dich nach oben.

Eine Wetteranwendung für den Browser: Zehn-Tage-Vorhersage, Stunde-für-Stunde-Tagesansicht und ein Regenradar, das für Deutschland auf das hochaufgelöste Komposit des Deutschen Wetterdienstes zurückgreift. Dazu ein schmaler Widget-Modus, der sich als Kachel in ein fremdes Portal einbetten lässt.

Gebaut mit React und Vite, ohne Backend — alle Daten kommen zur Laufzeit aus offenen APIs. Es gibt nichts anzumelden und keinen API-Schlüssel einzutragen.

---

## Was drin ist

**Übersicht und Heute.** Aktuelle Lage vor einer Landschaft, die sich aus den Daten selbst zeichnet: Himmelsfarbe und Sonnenstand aus Uhrzeit, Sonnenauf- und -untergang, die Wolken aus der Bedeckung, der Niederschlag aus dem Wettercode. Das Gelände richtet sich nach dem Ort — Skyline für Großstädte, Gebirge für Höhenlagen — und wird deterministisch aus den Koordinaten abgeleitet, bleibt über Neuladen hinweg also gleich.

**Tagesansicht.** 24 Stunden eines Tages als Verlauf: Temperatur, gefühlte Temperatur, Regenwahrscheinlichkeit und Niederschlagsmenge, Wind und Böen, UV-Index, Sicht.

**Radar.** Vergangenheit und Kurzfristvorhersage als abspielbare Zeitreihe auf einer Leaflet-Karte. Innerhalb der DWD-Abdeckung (Deutschland und Nachbarländer) das Radarkomposit in 1 × 1 km und Fünf-Minuten-Schritten, außerhalb das globale Mosaik von RainViewer. Beide Quellen werden zu einer gemeinsamen Zeitachse verschmolzen.

**Zehn Tage.** Tagesübersicht mit Höchst- und Tiefstwerten, abgeleitetem Tagessymbol und einem Wert dafür, wie gut sich der Tag für draußen eignet.

**Nebenwerte.** Luftqualität (europäischer Index), Pollen für Erle, Birke und Gräser, Luftfeuchte, Luftdruck auf Meeresniveau, Sicht.

**Erklärungen.** Hinter jedem „?“ steht, was der Wert bedeutet, wie er entsteht und wie er einzuordnen ist. Die Einordnung kommt aus denselben Schwellen, mit denen die Anwendung ihre Wortmarken bildet — ein Text kann nicht behaupten, ab 60 sei die Luft schlecht, während die Kachel daneben noch „mäßig“ zeigt.

**Zwei Oberflächen.** Ab 1180 px das Dashboard, darunter eine eigene, für den Daumen gebaute mobile Ansicht — nicht dasselbe Layout in schmal.

**Widget.** Eine kompakte weiße Kachel mit eigenem Einstiegspunkt und eigener, schmalerer API-Abfrage. Siehe [WIDGET.md](WIDGET.md).

---

## Loslegen

```bash
npm install
npm run dev
```

Die Anwendung läuft dann auf `http://localhost:5173`.

| Befehl | Wirkung |
| --- | --- |
| `npm run dev` | Entwicklungsserver mit Hot Reload |
| `npm run build` | Produktionsbündel nach `dist/` (zwei Einstiegspunkte) |
| `npm run preview` | Gebautes Bündel lokal ausliefern |
| `npm test` | Radar-Tests im Node-Testrunner |
| `npm run test:radar:browser` | Browser-Tests für das Radar (braucht Playwright) |

### Ausliefern

`npm run build` erzeugt `dist/` mit `index.html` (Anwendung) und `widget.html` (Kachel). Die Basis ist relativ gesetzt — das Bündel läuft daher auch aus einem Unterordner wie `/wetter/` und nicht nur von der Domainwurzel. `dist/` ist statisch; jeder Webserver genügt, ein Node-Prozess wird nicht gebraucht.

---

## Datenquellen

| Quelle | Wofür |
| --- | --- |
| [Open-Meteo](https://open-meteo.com/) | Vorhersage, Stunden- und Tageswerte |
| [Open-Meteo Air Quality](https://open-meteo.com/en/docs/air-quality-api) | Luftqualität und Pollen (Copernicus-Modelldaten) |
| [Open-Meteo Geocoding](https://open-meteo.com/en/docs/geocoding-api) | Ortssuche |
| [DWD Geoserver](https://maps.dwd.de/geoserver/) | Radarkomposit für Deutschland (WMS) |
| [RainViewer](https://www.rainviewer.com/) | Globales Radarmosaik außerhalb der DWD-Abdeckung |
| [OpenStreetMap](https://www.openstreetmap.org/) | Kartenhintergrund |

Alle Abfragen laufen direkt aus dem Browser. Kein Schlüssel, keine Registrierung, kein eigener Server dazwischen.

---

## Aufbau

```
src/
  App.jsx            Dashboard ab 1180 px, Ortssuche, Abschnittsnavigation
  MobileShell.jsx    Eigene Ansicht für schmale Bildschirme
  DayDetail.jsx      24-Stunden-Verlauf eines Tages
  DayList.jsx        Zehn-Tage-Liste
  Radar.jsx          Karte, Zeitachse, Wiedergabe
  SkyScene.jsx       Aus den Daten gezeichnete Landschaft
  WeatherIcon.jsx    Symbole zu den WMO-Codes
  Explain.jsx        „?“-Schaltflächen
  Widget.jsx         Portal-Kachel (eigener Einstiegspunkt)

  weather.js         API-Abfragen, Skalen, Ableitungen, Formatierung
  explanations.js    Erklärtexte, an die Skalen aus weather.js gebunden
  dwdRadar.js        WMS-Anfragen und Abdeckung des DWD-Komposits
  rainviewer.js      Globales Radarmosaik
  radarTimeline.js   Verschmelzen beider Quellen zu einer Zeitachse
  radarRequest.js    Zwischenspeicher und Wiederholung für Radaranfragen
```

Die Skalen (UV, Luftqualität, Pollen, Wind, Niederschlag, Druck, Sicht) stehen einmal zentral in `weather.js`. Wortmarken in den Kacheln und die Einordnung in den Erklärtexten greifen auf dieselben Schwellen zu und können deshalb nicht auseinanderlaufen.

Niederschlag wird in L/m² angegeben statt in Millimetern — dieselbe Zahl, aber sie beantwortet „wie viel Wasser kommt da runter“ ohne Umrechnung im Kopf.

## Tests

`npm test` prüft die Radarlogik im Node-Testrunner: Paarung der Zeitachsen, Bereitschaft der Quellen, veröffentlichte DWD-Zeiten, Zwischenspeicher und Erholung nach Fehlern.

Der Browser-Testlauf (`npm run test:radar:browser`, braucht einen laufenden Entwicklungsserver und Playwright) fährt `tests/radar-harness.html` mit nachgebildeten Antworten: Mounten unter StrictMode, verzögerte Kacheln, Fehler und Wiederholungen, Springen in der Zeit, Erholung nach Zoom und Verschieben, Wiedergabe. Einzelheiten in [tests/README.md](tests/README.md).

## Sprache

Oberfläche, Kommentare und Dokumentation sind auf Deutsch. Die Anwendung ist für den deutschsprachigen Raum gebaut — das Radar deckt Deutschland und die Nachbarländer ab, Formate und Einheiten folgen `de-DE`.
