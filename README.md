# Wolframwürfel-Beschuss

Interaktive, physikalisch fundierte 3D-Simulation eines Projektils, das auf einen Wolframwürfel geschossen wird. Alles steckt in einer Datei: `index.html` im Browser öffnen (Internetzugang für three.js und Rapier vom CDN nötig).

## Einstellbare Parameter

- **Projektil:** Werkstoff (Wolfram-Schwermetall, Uranlegierung, gehärteter Stahl, Kupfer, Blei, Aluminium, Titan, reines Wolfram), Form (Langstab flach oder ogival, Kugel), Durchmesser, Länge, Dichte, dynamische Fließgrenze, E-Modul, Querkontraktionszahl, Hugoniot-Parameter c₀ und s
- **Schuss:** Geschwindigkeit (5 bis 6000 m/s), Auftreffwinkel, Treffpunkt vertikal und seitlich
- **Wolframwürfel:** Kantenlänge, Dichte, Fließgrenze, E-Modul, Querkontraktionszahl, Hugoniot-Parameter, optional manueller Eindringwiderstand Rₜ
- **Lagerung:** frei liegend (mit Reibwert) oder fest eingespannt, Erdbeschleunigung

## Physikalisches Modell

| Vorgang | Modell |
|---|---|
| Erosive Eindringung | Tate–Alekseevskii: `½ρp(v−u)² + Yp = ½ρt·u² + Rt`, `ρp·L·dv/dt = −Yp`, `dL/dt = −(v−u)`, `dP/dt = u` (numerisch integriert) |
| Starre Eindringung | `m·dv/dt = −A(Rt + k·ρt·v²)` mit Nasenfaktor k |
| Zielwiderstand | Sphärische Hohlraumaufweitung nach Hill: `Rt = ⅔Yt[1 + ln(Et/(3(1−νt)Yt))]` |
| Stoßdruck | Impedanzabgleich linearer Hugoniot-Kurven `Us = c₀ + s·up` |
| Elastischer Stoß | 1D-Wellenimpedanz, Kontaktzeit 2L/c bzw. Hertz, Restitution nach Hunter |
| Krater | `Dc = D·√(1 + ρt·u²/(2Rt))` |
| Durchschlag | Pfropfenscherung der Restwand (`τ = Yt/√3`), inelastischer Stoß Projektil/Pfropfen |
| Abpraller | Kriterium nach Tate (1979) |
| Würfelbewegung | Impuls- und Drehimpulserhaltung, danach Starrkörperdynamik mit Reibung (Rapier) |

## Grenzen

Wolfram ist bei Raumtemperatur spröde. Risse, Kantenausbrüche und Abplatzungen werden nicht modelliert. Das Tate-Modell ist für Langstäbe zwischen etwa 0,5 und 3,5 km/s kalibriert; kurze Projektile, Kugeln und Hypervelocity-Einschläge sind nur genähert. Splitter und Ejekta in der 3D-Ansicht dienen der Veranschaulichung.
