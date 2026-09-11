/**
 * Erklärtexte hinter den „?“-Schaltflächen.
 *
 * Jeder Eintrag beantwortet dieselben drei Fragen in derselben Reihenfolge:
 * was der Wert bedeutet, wie er entsteht und wie man ihn einordnet. Die
 * Einordnung kommt als Skala aus weather.js – also aus genau denselben
 * Schwellen, mit denen die App ihre Wortmarken bildet. Ein Text kann damit
 * nicht behaupten, ab 60 sei die Luft schlecht, während die Kachel daneben
 * noch „mäßig“ anzeigt.
 */
import {
  AQI_SCALE, HUMIDITY_SCALE, POLLEN_SCALE, PRECIP_SCALE, PRESSURE_SCALE,
  SCORE_SCALE, UV_SCALE, VISIBILITY_SCALE, WIND_SCALE
} from './weather'

export const EXPLAIN = {
  aqi: {
    title: 'Luftqualität',
    subtitle: 'European Air Quality Index',
    meaning: 'Ein Sammelwert für die Schadstoffbelastung der Luft. Je höher, desto stärker – ab etwa 60 merken empfindliche Menschen das bei Anstrengung im Freien.',
    method: 'Der europäische Index fasst Feinstaub (PM2,5 und PM10), Stickstoffdioxid, Ozon und Schwefeldioxid zusammen. Es zählt immer der schlechteste Einzelstoff, nicht der Durchschnitt – ein hoher Ozonwert allein hebt den Index.',
    normal: 'In Deutschland liegt der Wert meist zwischen 15 und 40.',
    scale: AQI_SCALE,
    source: 'Modelldaten des europäischen Copernicus-Dienstes über Open-Meteo'
  },

  uv: {
    title: 'UV-Index',
    subtitle: 'Sonnenbelastung für die Haut',
    meaning: 'Wie stark die Sonne die Haut belastet. Angezeigt ist das Tagesmaximum, das fast immer zwischen 12 und 14 Uhr liegt – morgens und abends ist der Wert deutlich niedriger.',
    method: 'Berechnet aus Sonnenstand, Ozonschicht, Bewölkung und Höhe über dem Meer. Pro 1000 Höhenmeter steigt er um etwa zehn Prozent, Wasser und Schnee verstärken ihn zusätzlich durch Reflexion.',
    normal: 'In Deutschland: im Winter 0 bis 2, im Hochsommer 6 bis 8. Höhere Werte gibt es hier fast nur im Hochgebirge.',
    scale: UV_SCALE
  },

  pollen: {
    title: 'Pollenbelastung',
    subtitle: 'Erle, Birke und Gräser',
    meaning: 'Wie viele Pollenkörner in einem Kubikmeter Luft schweben. Angezeigt wird die stärkste der drei Sorten – Erle und Birke fliegen im Frühjahr, Gräser von Mai bis August.',
    method: 'Werte aus dem europäischen Pollenmodell, das Blühphasen, Wind und Regen berücksichtigt. Regen wäscht Pollen aus der Luft, Wind und Wärme treiben sie hoch.',
    normal: 'Außerhalb der Blühzeit liegt der Wert bei null. Zur Hauptblüte sind 50 bis 150 Pollen/m³ üblich.',
    scale: POLLEN_SCALE
  },

  /* Die Karte „Luft & Pollen“ zeigt zwei voneinander unabhängige Messgrößen.
     Ein gemeinsamer Dialog mit zwei Skalen erklärt beide – vorher hing ein
     zweites „?“ hinter dem Pollensatz und sah wie ein Versehen aus. */
  airPollen: {
    title: 'Luft und Pollen',
    subtitle: 'Zwei getrennte Messgrößen',
    meaning: 'Die Wortmarke oben bewertet die Schadstoffbelastung der Luft. Die Pollenwerte darunter sind davon unabhängig: Saubere Luft und starker Pollenflug kommen im Frühjahr regelmäßig zusammen.',
    method: 'Die Luftqualität fasst als europäischer Index Feinstaub, Stickstoffdioxid, Ozon und Schwefeldioxid zusammen, wobei immer der schlechteste Einzelstoff zählt. Die Pollenwerte kommen aus einem eigenen Modell und zählen Körner pro Kubikmeter Luft.',
    normal: 'In Deutschland liegt die Luftqualität meist zwischen 15 und 40. Pollen liegen außerhalb der Blühzeit bei null, zur Hauptblüte bei 50 bis 150 Pollen/m³.',
    scales: [
      { head: 'Einordnung Luftqualität', scale: AQI_SCALE },
      { head: 'Einordnung Pollen', scale: POLLEN_SCALE }
    ],
    source: 'Modelldaten des europäischen Copernicus-Dienstes über Open-Meteo'
  },

  rainChance: {
    title: 'Regenwahrscheinlichkeit',
    subtitle: 'Die häufigste Verwechslung im Wetterbericht',
    meaning: 'Die Chance, dass es an deinem Ort in dieser Stunde überhaupt messbar regnet – mindestens 0,1 L/m². Sie sagt nichts darüber, wie viel oder wie lange: 80 % können fünf Minuten Nieseln bedeuten.',
    method: 'Das Vorhersagemodell rechnet den Tagesverlauf mehrfach mit leicht verschobenen Startwerten durch. Regnet es in 8 von 10 Durchläufen, sind das 80 %.',
    normal: 'Unter 30 % bleibt es meistens trocken, ab 70 % lohnt der Schirm. Wie viel Wasser fällt, steht als Menge daneben.',
    note: 'Volle Säule in der Kachel heißt 100 %.'
  },

  precip: {
    title: 'Niederschlagsmenge',
    subtitle: 'Liter pro Quadratmeter',
    meaning: 'Wie viel Wasser auf einen Quadratmeter Boden fällt. 1 L/m² bleibt genau einen Millimeter hoch stehen, wenn nichts versickert – die in Wetterberichten üblichen Millimeter sind also dieselbe Zahl.',
    method: 'Summe aus dem Vorhersagemodell für den jeweiligen Zeitraum. Schnee und Hagel zählen als geschmolzene Wassermenge mit.',
    normal: 'Ein Landregentag in Deutschland bringt 5 bis 15 L/m². Ein kräftiges Sommergewitter schafft 20 L/m² in einer einzigen Stunde.',
    scale: PRECIP_SCALE
  },

  wind: {
    title: 'Wind und Böen',
    subtitle: 'Mittelwert und Spitze',
    meaning: 'Der Windwert ist das Mittel über zehn Minuten, die Böe der höchste kurze Ausschlag darin. Böen sind meist anderthalb- bis zweimal so stark wie das Mittel – sie entscheiden, ob der Sonnenschirm umfällt.',
    method: 'Bezogen auf zehn Meter Höhe über freiem Gelände, so wie Wetterstationen messen. In der Stadt, zwischen Häusern und in Bodennähe ist es schwächer, auf Bergkämmen und an der Küste stärker.',
    normal: 'Alles bis etwa 20 km/h fällt im Alltag nicht auf. Ab 50 km/h Böen warnt der DWD vor markantem Wetter, ab 90 km/h vor Unwetter.',
    scale: WIND_SCALE
  },

  pressure: {
    title: 'Luftdruck',
    subtitle: 'Auf Meeresniveau gerechnet',
    meaning: 'Das Gewicht der Luftsäule über dir. Aussagekräftiger als der Wert selbst ist seine Richtung: fallender Druck kündigt Tiefs mit Wind und Regen an, steigender ruhiges Wetter.',
    method: 'Angegeben auf Meeresniveau zurückgerechnet, damit Orte in verschiedenen Höhen vergleichbar sind. Der tatsächliche Druck am Boden ist niedriger – auf 700 Metern etwa 80 hPa weniger.',
    normal: 'Der Normwert ist 1013 hPa. Fast das ganze Jahr liegt zwischen 990 und 1030 hPa.',
    scale: PRESSURE_SCALE
  },

  visibility: {
    title: 'Sichtweite',
    subtitle: 'Wie weit der Blick reicht',
    meaning: 'Die Entfernung, bis zu der sich Umrisse noch klar vom Hintergrund abheben, waagerecht gemessen.',
    method: 'Modellwert aus Luftfeuchte, Nebel, Staub und Niederschlag. Bei sehr klarer Luft deckelt das Modell die Ausgabe – mehr als etwa 24 km wird nicht ausgewiesen, auch wenn die Alpenkette weiter zu sehen ist.',
    normal: 'Über 10 km gilt im Alltag als gute Sicht. Unter 1 km spricht man von Nebel.',
    scale: VISIBILITY_SCALE
  },

  humidity: {
    title: 'Luftfeuchte',
    subtitle: 'Relative Feuchte in Prozent',
    meaning: 'Wie voll die Luft mit Wasserdampf ist – gemessen an dem, was sie bei dieser Temperatur höchstens halten kann. Deshalb steigt der Wert nachts fast immer, ohne dass mehr Wasser in der Luft wäre: kalte Luft kann weniger halten.',
    method: 'Relative Feuchte in zwei Metern Höhe. Bei 100 % ist die Luft gesättigt, dann bilden sich Nebel oder Tau.',
    normal: 'Draußen sind 60 bis 80 % in Deutschland der Normalfall. Unangenehm schwül wird es erst zusammen mit Wärme über 25°.',
    scale: HUMIDITY_SCALE
  },

  apparent: {
    title: 'Gefühlte Temperatur',
    subtitle: 'Was die Haut meldet',
    meaning: 'Wie warm oder kalt sich die Luft anfühlt – nicht, was das Thermometer im Schatten zeigt. Wind kühlt, Sonne und hohe Luftfeuchte wärmen.',
    method: 'Berechnet aus Lufttemperatur, Wind, Luftfeuchte und Sonnenstrahlung. Bei Kälte dominiert der Windchill, bei Hitze die Schwüle: feuchte Luft bremst das Verdunsten von Schweiß.',
    normal: 'Zwei bis vier Grad Abweichung sind normal. Bei kräftigem Wind im Winter werden es auch acht Grad weniger.'
  },

  score: {
    title: 'Draußen-Eignung',
    subtitle: 'Eine Einschätzung von himmel°',
    meaning: 'Kein amtlicher Wert, sondern unsere Zusammenfassung in einer Zahl: Wie angenehm ist dieser Tag im Freien?',
    method: 'Start bei 100 Punkten. Abgezogen wird für Regenrisiko, für Böen über 25 km/h, für UV über 6 sowie für Hitze über 28° und Kälte unter 8°.',
    normal: 'Der Wert taugt zum Vergleich von Tagen untereinander. Ein durchschnittlicher deutscher Tag landet zwischen 50 und 80.',
    scale: SCORE_SCALE,
    note: 'Eine Warnung ist das nicht – amtliche Warnungen gibt der Deutsche Wetterdienst heraus.'
  }
}
