# himmel° — Widget-Modus

Eine kompakte, weiße Kachel für die Einbettung in ein Portal. Sie zeigt nur, was
in wenig Platz eine Entscheidung trägt: aktuelle Temperatur und Wetterlage,
Gefühlt / Höchst / Tiefst, Regenrisiko und Wind, die nächsten fünf Stunden und
die nächsten drei Tage. Keine Ortssuche, keine Navigation, kein Radar — dafür
verweist die Wortmarke oben rechts auf die vollständige Ansicht.

## Adresse

```
/widget.html            bzw. /wetter/widget.html im Unterordner
/widget                 (nur wenn der Server die Endung ausblendet, siehe unten)
```

`/widget.html` funktioniert immer, in jedem Unterordner und ohne
Serverkonfiguration — im Zweifel ist das die Adresse für das Portal. Die kurze
Form `/widget` braucht eine Regel in der Auslieferung, die zum tatsächlichen
Pfad passt.

### Einstellungen über die Adresse

| Parameter | Bedeutung | Beispiel |
| --- | --- | --- |
| `lat`, `lon` | Koordinaten des Orts (Komma oder Punkt) | `?lat=47.78&lon=10.62` |
| `ort` | Angezeigter Name; ohne `lat`/`lon` wird darüber gesucht | `?ort=Marktoberdorf` |
| `link` | Ziel des „himmel°“-Verweises | `?link=https://wetter.example.de/` |

* Ohne Parameter zeigt das Widget Marktoberdorf.
* `?ort=` allein spart die Koordinatensuche im Portal, kostet aber eine zusätzliche
  Abfrage bei der Geocoding-API. Wer die Koordinaten kennt, gibt beides an:
  `?lat=47.78&lon=10.62&ort=Marktoberdorf`.
* Der in der Hauptansicht gespeicherte Ort gilt hier bewusst **nicht** — das
  Portal zeigt allen Besuchern dasselbe.

## Einbinden

```html
<iframe
  src="https://wetter.example.de/widget.html?lat=47.78&lon=10.62&ort=Marktoberdorf"
  title="Wetter in Marktoberdorf"
  loading="lazy"
  style="display:block; width:100%; height:250px; border:0"
></iframe>
```

Rahmen, Radius und Schatten stellt die Portalseite: Das Widget bringt nur
Innenabstand mit und hat einen weißen Hintergrund.

### Höhe

Das Layout richtet sich nach der Breite des iframes:

| Breite | Form | Höhe |
| --- | --- | --- |
| bis 519 px | alles untereinander | ~240 px |
| ab 520 px | Jetzt-Block neben Stunden und Tagen | ~175 px |
| ab 780 px | drei Spalten | ~140 px |

Wer eine feste Höhe setzt, nimmt den Wert aus der Tabelle. Wer es genau haben
will: Das Widget meldet seine Höhe per `postMessage`.

```html
<script>
  window.addEventListener('message', event => {
    // Nur Nachrichten der eigenen Wetter-Domain auswerten.
    if (event.origin !== 'https://wetter.example.de') return
    if (event.data?.type !== 'himmel:height') return
    for (const frame of document.querySelectorAll('iframe')) {
      if (frame.contentWindow === event.source) {
        frame.style.height = `${event.data.height}px`
      }
    }
  })
</script>
```

## `/widget` ohne `.html`

Entwicklungs- und Vorschauserver lösen die Adresse selbst auf (Plugin
`himmel-widget-url` in `vite.config.js`). Auf dem Zielserver macht das die
Auslieferung — und zwar für **den Pfad, unter dem die Anwendung wirklich liegt**.
Eine Regel für `/widget` greift nicht, wenn alles unter `/wetter/` ausgeliefert
wird; dort heißt die Adresse `/wetter/widget`.

**nginx** (Beispiel für den Unterordner `/wetter/`)

```nginx
location = /wetter/widget  { try_files /wetter/widget.html =404; }
location = /wetter/widget/ { return 301 /wetter/widget$is_args$args; }
```

**Apache** (als `.htaccess` im Ordner `/wetter/`; die Muster gelten dann relativ
zu diesem Ordner)

```apache
RewriteEngine On
RewriteRule ^widget/$ widget [R=301,L]
RewriteRule ^widget$ widget.html [L]
```

Zwei Dinge, die dabei leicht schiefgehen:

* **Abschließender Schrägstrich.** `/wetter/widget/` darf nicht direkt
  ausgeliefert werden, sondern muss auf `/wetter/widget` umleiten. Die Seite
  verweist mit relativen Pfaden auf ihre Bündel (`./assets/…`, damit der Build
  in jedem Unterordner läuft); unter `/wetter/widget/` sucht der Browser sie in
  `/wetter/widget/assets/` und bekommt eine leere Kachel. Auch der Verweis auf
  die Vollansicht zeigt dann ins Leere.
* **Keine Rewrite-Regel möglich?** Dann `/wetter/widget.html` einbinden. Diese
  Adresse funktioniert in jedem Unterordner ohne jede Serverkonfiguration —
  geprüft mit dem Build unter `/wetter/`: Bündel und Verweis lösen korrekt auf.

## Prüfstand

`npm run dev`, dann `http://localhost:5173/widget-demo.html`: dieselbe Kachel in
drei Breiten, mit ausgewerteter Höhennachricht. Die Seite ist absichtlich kein
Build-Einstiegspunkt — sie existiert nur in der Entwicklung.

## Technisch

* Eigener Einstiegspunkt (`widget.html` → `src/widget-main.jsx` → `src/Widget.jsx`,
  Gestaltung in `src/widget.css`). Leaflet, Radar und Himmelsszene der
  Hauptansicht werden nicht geladen.
* Eigene, schmale API-Abfrage (`fetchWidgetWeather`): vier Tage statt zehn, keine
  Luftqualität.
* Aktualisiert sich alle zehn Minuten selbst — ein Portal-Tab bleibt lange offen.
* Die Tagessymbole entstehen über dieselbe Ableitung wie in der Hauptansicht
  (`dayCode`), damit Widget und Vollansicht nicht verschiedene Symbole für
  denselben Tag zeigen.
