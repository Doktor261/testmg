# Plan: Interaktives 3D-Modell des menschlichen Auges

Dieser Plan ist so geschrieben, dass ein Agent (Sonnet) ihn ohne weitere Rückfragen Schritt für Schritt umsetzen kann.

## 1. Ziel und Rahmenbedingungen

| Punkt | Festlegung |
|---|---|
| Zielgruppe | Medizin- und Biologiestudium: hohe Detailtiefe, lateinische Nomenklatur (Terminologia Anatomica) im Vordergrund, deutscher Name daneben |
| Umfang | Bulbus oculi mit allen Schichten, 6 äußere Augenmuskeln mit Trochlea und Anulus tendineus communis, N. opticus mit Hüllen und Gefäßen |
| Hauptinteraktion | **Explosionsansicht** über einen Schieberegler (0–100 %) |
| Ergänzend (minimal) | Teil antippen → Name + Infotext; Teil isolieren; Teile-Liste zum Ansteuern |
| Nicht im Umfang | Schnittebene, Quiz, Lider, Tränenapparat, knöcherne Orbita |
| Zielgerät | **Smartphone** (Touch, Hochformat zuerst), funktioniert auch am Desktop |
| Auslieferung | Statische Web-Seite im Repo (`auge3d/`) **und** als claude.ai-Artifact veröffentlicht (Link öffnet direkt im Handy-Browser) |
| Sprache | UI deutsch |
| Modell | Rechtes Auge (Oculus dexter) |

## 2. Technik

- **Three.js r147** als klassisches UMD-Script (kein Build-Schritt, kein ES-Modul-Import):
  - `https://cdn.jsdelivr.net/npm/three@0.147.0/build/three.min.js`
  - `https://cdn.jsdelivr.net/npm/three@0.147.0/examples/js/controls/OrbitControls.js` (setzt `THREE.OrbitControls`)
  - r147 ist die letzte Version mit `examples/js` (UMD). Nicht auf neuere Versionen wechseln.
- **Artifact-Vorgaben** (gelten für die veröffentlichte Seite, siehe Artifact-Tool):
  - Die HTML-Datei enthält **kein** `<!doctype>`, `<html>`, `<head>`, `<body>`; sie beginnt mit `<title>Auge 3D</title>`, `<meta name="claude:viewport-fit-sides" content="cover">`, `<style>`.
  - Scripts nur von cdnjs / jsDelivr / unpkg mit exakter Version; alles andere inline.
  - Keine externen Bilder: Texturen werden zur Laufzeit per `<canvas>` prozedural erzeugt.
  - Farben als CSS-Tokens auf `:root`, Dunkel-Variante über `@media (prefers-color-scheme: dark)` mit `:root:not([data-theme="light"])` **und** `:root[data-theme="dark"]`; `body` mit expliziter Hintergrundfarbe.
  - `html, body { height: 100% }` statt `100vh`; Safe-Area-Insets (`env(safe-area-inset-*)`) für fest positionierte Leisten.
  - `localStorage` nur in `try/catch` (z. B. für „Beschriftung an/aus“), Seite muss ohne funktionieren.
- **Dateistruktur** (klassische Scripts, globale Namespace `EYE`):
  ```
  auge3d/
    index.html        # Markup, CSS, lädt three + Scripts in dieser Reihenfolge
    js/data.js        # EYE.PARTS: alle Teile, Gruppen, Texte, Explosionsvektoren
    js/textures.js    # EYE.textures: Iris, Retina/Fundus, Sklera (Canvas)
    js/geometry.js    # EYE.build(scene): erzeugt alle Meshes aus Maßen
    js/app.js         # Renderer, Kamera, Steuerung, Picking, UI, Explosion
  README.md           # kurze Beschreibung + Link
  ```
  Beim Veröffentlichen als Artifact werden die `js/*.js` über den `files`-Parameter mitgeschickt (relative Pfade wie im Repo).

## 3. Koordinatensystem und Referenzmaße

Einheit: **1 = 1 mm**. Ursprung = Mittelpunkt der Sklera-Kugel.
**+Z = anterior** (optische Achse), **+Y = superior**, **+X = lateral/temporal**, **−X = medial/nasal** (rechtes Auge).

Alle rotationssymmetrischen Teile entstehen als `THREE.LatheGeometry` aus einem 2D-Profil (r, z). Die Lathe-Achse ist Y; danach `geometry.rotateX(Math.PI/2)` (bzw. passend), damit die Achse auf Z liegt. Vorzeichen nach dem Drehen prüfen.

| Struktur | Maße (Literaturwerte, gerundet) | Umsetzung |
|---|---|---|
| Sklera | Außenradius 12,0; Dicke 0,3 (hinter Rectus-Ansätzen) bis 1,0 (hinterer Pol) | Kugelschale, endet am Limbus; Öffnung hinten für N. opticus (Lamina cribrosa) |
| Limbus | Durchmesser ≈ 11,7 (horizontal), liegt bei z ≈ 10,5 | Übergang Sklera/Kornea |
| Kornea | Vorderer Krümmungsradius 7,8; hinterer 6,5; Dicke zentral 0,55, peripher 0,7; Apex bei z ≈ 13,1 | Lathe aus zwei Kreisbögen |
| Vorderkammer | Tiefe ≈ 3,0 (Hinterfläche Kornea → Linsenvorderfläche) | unsichtbares Volumen, nur pickbar über Liste (Kammerwasser) |
| Iris | Durchmesser ≈ 12; Pupille 3,5; Dicke 0,3–0,6 (Krause bei r ≈ 3); Ebene z ≈ 9,6–10 | Lathe, leicht konisch nach vorn; Textur mit radialen Trabekeln, Krypten, Krause |
| M. sphincter / M. dilatator pupillae | Sphincter: Ring r 1,75–2,5 am Pupillenrand; Dilatator: dünne radiale Schicht an der Hinterfläche | eigene dünne Ringe, standardmäßig sichtbar, separat pickbar |
| Linse | Durchmesser 9,5; Dicke 4,0; vorderer Radius 10, hinterer 6; Vorderpol z ≈ 9,5 | Lathe mit abgerundetem Äquator; innen Kern (Nucleus lentis, ~60 %) als eigenes Mesh; Kapsel als dünne Hülle |
| Corpus ciliare | Länge ≈ 6 (Pars plicata 2, Pars plana 4); vom Skleralsporn bis Ora serrata | Lathe-Ring; dazu **72 Processus ciliares** als `InstancedMesh` (schmale Leisten) |
| M. ciliaris | im Corpus ciliare, außen anliegend | dünnes Lathe-Ring-Mesh |
| Fibrae zonulares (Zinn) | von Processus ciliares zum Linsenäquator, vordere + hintere Faserzüge | `LineSegments`, ca. 2 × 144 Linien |
| Schlemm-Kanal / Trabekelwerk | im Kammerwinkel, Kanal-Querschnitt ≈ 0,3 | `TorusGeometry` (Kanal) + dünner Ring (Trabekelwerk) |
| Choroidea | Dicke ≈ 0,25 | Kugelschale innen an Sklera, von Ora serrata bis Papille |
| Retina (Pars optica) | Dicke 0,1–0,5; endet an der Ora serrata (≈ 6–7 mm hinter dem Limbus entlang der Oberfläche, z ≈ 5,3) | Kugelschale mit Fundus-Textur (Gefäßbögen, Makula) |
| Macula lutea | Durchmesser ≈ 5,5 | Farbe in der Retina-Textur + eigenes dünnes Scheiben-Mesh zum Antippen |
| Fovea centralis | Durchmesser ≈ 1,5 (Foveola 0,35); ≈ 1,2 temporal, 0,4 inferior des hinteren Pols | kleine Senke / eigenes Mesh |
| Discus n. optici (Papille) | 1,7 × 1,9 (hochoval); Mitte ≈ 3,0 nasal, 0,3 superior des hinteren Pols (≈ 4 mm von der Fovea) | eigenes Mesh mit Excavatio |
| Corpus vitreum | füllt Raum hinter der Linse | fast transparentes Mesh; Canalis hyaloideus (Cloquet) als dünner Schlauch Papille → Linsenrückfläche |
| N. opticus | Ø 3 intraorbital, mit Scheiden Ø 4–4,5; intraorbitale Länge ≈ 25 (S-förmig, Bewegungsreserve) | `TubeGeometry` entlang Catmull-Rom-Kurve von der Papille zum Canalis opticus |
| Optikusscheiden | Dura, Arachnoidea, Pia; Subarachnoidalraum dazwischen | drei konzentrische Tubes (nur bei Explosion getrennt sichtbar) |
| A./V. centralis retinae | treten ≈ 10–12 hinter dem Bulbus in den Nerv ein | dünne Tubes, rot/blau |
| Aa. ciliares posteriores breves / longae | breves: 6–12 Stämme, ≈ 15–20 Äste um den Nerv; longae: 2, horizontal (nasal/temporal) bis Corpus ciliare | dünne Tubes |
| Vv. vorticosae | 4 (je Quadrant), treten ≈ 3–4 hinter dem Äquator aus | dünne Tubes |

Canalis opticus / Anulus tendineus communis (Orbitaspitze): Zentrum etwa bei **(−11, 1, −33)**. Der Ring hat Radius ≈ 5.

### Äußere Augenmuskeln

Muskeln als `TubeGeometry` mit abgeflachtem Querschnitt (eigene Shape oder skaliertes Tube): Bauch ≈ 10 × 3, Sehne flacher und heller (eigenes Material). Der Verlauf liegt auf einer Kurve vom Ursprung zum Ansatz; das letzte Stück liegt **tangential auf der Sklera an** (Kontaktbogen), damit der Muskel nicht durch den Bulbus läuft. Kollisionen mit der Sklera-Kugel (r = 12) prüfen: alle Kurvenpunkte im Kontaktbogen auf r ≥ 12,3 projizieren.

| Muskel | Ursprung | Ansatz (Abstand vom Limbus, Breite) | Sehnenlänge | Innervation | Aktion (primär / sekundär / tertiär) |
|---|---|---|---|---|---|
| M. rectus medialis | Anulus, medial | 5,5 mm, 10,3 mm breit | 3,7 | N. III (R. inf.) | Adduktion |
| M. rectus inferior | Anulus, inferior | 6,5 mm, 9,8 mm | 5,5 | N. III (R. inf.) | Senkung / Exzyklorotation / Adduktion |
| M. rectus lateralis | Anulus, lateral (zwei Köpfe) | 6,9 mm, 9,2 mm | 8,8 | N. VI | Abduktion |
| M. rectus superior | Anulus, superior | 7,7 mm, 10,6 mm | 5,8 | N. III (R. sup.) | Hebung / Inzyklorotation / Adduktion |
| M. obliquus superior | Corpus ossis sphenoidalis, superomedial des Anulus → läuft vorn durch die **Trochlea** ≈ (−15, 15, 5) → Sehne zieht posterolateral **unter** dem M. rectus superior | hinter dem Äquator, oberer temporaler Quadrant, fächerförmig ≈ 10 mm | lang (≈ 26) | N. IV | Inzyklorotation / Senkung / Abduktion |
| M. obliquus inferior | Orbitaboden anteromedial (nahe Fossa sacci lacrimalis) ≈ (−13, −16, 6) → läuft posterolateral **unter** dem M. rectus inferior | posterolateral, unterer temporaler Quadrant, ≈ 2 mm von der Makula | sehr kurz (≈ 1) | N. III (R. inf.) | Exzyklorotation / Hebung / Abduktion |

Hinweise:
- Die Abstände der Rectus-Ansätze bilden die **Tillaux-Spirale** (5,5 → 6,5 → 6,9 → 7,7). Als Lernfakt im Infotext erwähnen.
- Ansätze von M. rectus superior/inferior sind leicht schräg (nasaler Rand weiter vorn), da die Muskeln ≈ 23° zur Sehachse verlaufen.
- Die Obliqui-Sehnen ziehen in ≈ 51–54° zur Sehachse.
- Ansätze als Bogen auf der Kugel berechnen: Winkel vom Limbus aus = Abstand / 12 (Bogenmaß), auf dem jeweiligen Meridian.
- Die Koordinaten der Ursprünge sind Näherungen. Vor dem Abschluss mit einer Referenz (Sobotta, Prometheus, Gray's Anatomy) die Proportionen und Verläufe von vorn, oben und lateral vergleichen.

### Überhöhung

Retina, Choroidea und Optikusscheiden sind real zu dünn, um sie zu sehen oder anzutippen. Diese Schichten werden **um den Faktor 2–3 verdickt** dargestellt. In der Info-Leiste einen festen Hinweis zeigen: „Schichtdicken von Retina und Choroidea zur Darstellung überhöht.“ Alle anderen Maße bleiben maßstabsgetreu.

## 4. Teile-Katalog (`js/data.js`)

Jedes Teil ist ein Eintrag:

```js
{
  id: 'cornea',
  la: 'Cornea',
  de: 'Hornhaut',
  group: 'tunica_fibrosa',
  color: 0xd9eef5, opacity: 0.25,        // Material-Hinweise
  explode: { vec: [0, 0, 18], phase: 1 }, // Verschiebung in mm, siehe Abschnitt 5
  facts: ['Ø 11,7 mm horizontal', 'Brechkraft ≈ 43 dpt (≈ 2/3 der Gesamtbrechkraft)'],
  text: 'Gefäßfreier, transparenter vorderer Teil der äußeren Augenhaut …',
  clinic: 'Keratokonus, Hornhauttransplantation (Keratoplastik) …'
}
```

Gruppen und Teile (≈ 40):

1. **Tunica fibrosa bulbi**: Cornea, Sclera (obere/untere Hälfte als zwei Meshes, ein Eintrag), Limbus corneae, Sinus venosus sclerae (Schlemm-Kanal), Reticulum trabeculare, Lamina cribrosa sclerae
2. **Tunica vasculosa bulbi (Uvea)**: Iris, M. sphincter pupillae, M. dilatator pupillae, Corpus ciliare, Processus ciliares, M. ciliaris, Choroidea
3. **Tunica interna bulbi**: Retina pars optica, Ora serrata, Pars caeca retinae, Macula lutea, Fovea centralis, Discus nervi optici
4. **Inhalt des Bulbus**: Lens (Capsula, Cortex, Nucleus), Fibrae zonulares, Corpus vitreum, Canalis hyaloideus, Camera anterior, Camera posterior (Kammerwasser)
5. **Mm. bulbi**: die 6 Muskeln, Trochlea, Anulus tendineus communis
6. **N. opticus und Gefäße**: N. opticus, Vagina externa (Dura), Arachnoidea, Vagina interna (Pia), A. centralis retinae, V. centralis retinae, Aa. ciliares posteriores breves, Aa. ciliares posteriores longae, Vv. vorticosae

Textinhalt je Teil: 2–4 Sätze Funktion/Aufbau, 2–4 Fakten mit Maßen, 1–2 Sätze klinischer Bezug (z. B. Glaukom → Trabekelwerk/Schlemm, Katarakt → Linse, Presbyopie → M. ciliaris/Linse, Ablatio retinae → Retina, Papillenödem → Papille, AMD → Makula, Abducensparese → M. rectus lateralis, Trochlearisparese → M. obliquus superior). Bei Muskeln zusätzlich Innervation und Aktionen (Tabelle oben). Texte fachlich korrekt und knapp, keine Füllsätze.

## 5. Explosionsansicht (Kernfunktion)

Ein Schieberegler `t ∈ [0, 1]`. Jedes Teil hat einen Verschiebungsvektor (mm) und eine Phase. Endposition = Grundposition + `ease(local_t) · vec`.

- **Phase 1 (t 0 → 0,5), entlang der optischen Achse**:
  Cornea +Z 18 · Iris (+ Sphincter/Dilatator) +Z 12 · Linse + Zonulafasern +Z 7 · Corpus ciliare + Processus + M. ciliaris +Z 3 · Schlemm/Trabekelwerk +Z 15 · N. opticus mit Gefäßen −Z 12.
- **Phase 2 (t 0,5 → 1), Schalen öffnen („Zwiebelschalen“)**:
  Sklera, Choroidea und Retina bestehen je aus **oberer und unterer Hälfte** (Lathe mit `phiStart/phiLength`, Trennebene y = 0). Obere Hälften +Y, untere −Y: Sklera ±16 · Choroidea ±10 · Retina ±5. Glaskörper bleibt im Zentrum. Makula, Fovea, Papille bewegen sich mit der unteren bzw. oberen Retina-Hälfte (je nach Lage) – Papille/Fovea liegen nahe y = 0: beide der unteren Retina-Hälfte zuordnen und die Trennebene so legen, dass sie nicht zerschnitten werden.
  Muskeln: radial vom Bulbus weg (Richtung Ansatz-Normale) um 10, Trochlea und Anulus bewegen sich mit ihren Muskeln mit. Optikusscheiden: Dura, Arachnoidea, Pia in der Länge gestaffelt zurückziehen (Pia 0, Arachnoidea −4, Dura −8 entlang der Nervenachse), damit die Schichten sichtbar werden.
- Phasen überlappen weich (`smoothstep` je Teil, leicht gestaffelt nach Gruppe), damit die Bewegung als Sequenz lesbar ist.
- Zusatz-Buttons neben dem Regler: „Zusammen“ (animiert auf 0) und „Explodiert“ (animiert auf 1), Dauer ≈ 1,2 s, `prefers-reduced-motion` → ohne Animation springen.
- Kamera-Ziel (OrbitControls `target`) folgt bei Explosion dem Gesamtschwerpunkt nicht automatisch; stattdessen passt „Ansicht zurücksetzen“ den Abstand an den aktuellen Explosionsgrad an.

## 6. Interaktion und UI (Smartphone zuerst)

Layout (Hochformat, 390 × 844 als Referenz):

- **Vollflächiges 3D-Canvas** hinter allem.
- **Obere Leiste** (fest, Safe-Area oben): Titel „Auge 3D“ · Button „Teile“ (öffnet Liste) · Button „Beschriftung“ (an/aus) · Button „Ansicht zurücksetzen“.
- **Untere Leiste** (fest, Safe-Area unten): Explosions-Regler (große Touch-Fläche, mind. 44 px hoch) mit Beschriftung „Explosion 0 %“ … „100 %“, Buttons „Zusammen“ / „Explodiert“.
- **Ansichts-Chips** (klein, über der unteren Leiste): Frontal · Lateral · Superior · Posterior (Kamera animiert dorthin).
- **Info-Sheet** (Bottom-Sheet, ≈ 45 % Höhe, schließbar, nach unten wischbar): erscheint beim Antippen eines Teils. Inhalt: lateinischer Name groß, deutscher Name, Gruppe, Text, Fakten-Liste, „Klinik“-Absatz, Buttons **„Isolieren“** (alle anderen Teile auf 8 % Deckkraft, nicht pickbar) und **„Ausblenden“**. „Alle zeigen“ hebt Isolieren/Ausblenden auf.
- **Teile-Liste** (Sheet von unten bzw. Seitenleiste ab 900 px Breite): nach Gruppen, jedes Teil mit Sichtbarkeits-Schalter; Tippen auf den Namen wählt das Teil aus (Hervorhebung + Kamera fährt hin + Info-Sheet).
- **Beschriftungen**: HTML-Labels mit Führungslinie, per Projektion der Teil-Ankerpunkte positioniert. Auf dem Handy nur Labels der Hauptstrukturen (≈ 12) bzw. bei Auswahl nur das ausgewählte Teil, damit nichts überlappt; verdeckte Anker (Raycast) ausblenden.
- Querformat und Desktop: Info-Sheet als Seitenpanel rechts.

Picking:
- `Raycaster` auf `pointerup`, nur wenn der Finger sich < 6 px bewegt hat (sonst war es Drehen/Zoomen).
- Unsichtbare/stark transparente Teile (Kammerwasser, Glaskörper) haben niedrige Pick-Priorität: Glaskörper nur auswählbar, wenn nichts anderes getroffen wurde; Kammern nur über die Liste.
- Hervorhebung: `emissive` des Materials aufhellen (Material pro Teil klonen), kein Outline-Postprocessing.

Steuerung: OrbitControls mit `enableDamping`, Pinch-Zoom, Zwei-Finger-Pan; Zoom-Grenzen 25–180 mm Abstand. `touch-action: none` auf dem Canvas.

## 7. Darstellung

- Hintergrund: ruhiger, leicht getönter Ton aus den Theme-Tokens (Renderer `setClearColor` aus der CSS-Variable lesen; bei Theme-Wechsel aktualisieren).
- Licht: `HemisphereLight` + zwei `DirectionalLight` (Key/Rim). Keine Schatten (Performance).
- Materialien: `MeshStandardMaterial`. Kornea/Linse/Glaskörper transparent (`transparent: true`, `depthWrite: false`, gezielte `renderOrder`), Kornea mit leichter Spiegelung (`roughness` 0,05). Muskeln rot-braun mit Faserstruktur (Canvas-Streifentextur), Sehnen weißlich-glänzend, Sklera weiß mit feinen Gefäßen, Choroidea dunkel rotbraun, Retina hell-orange mit Fundus-Textur auf der Innenseite (`side: THREE.DoubleSide` oder eigenes Innen-Mesh), Nerv gelblich-weiß.
- Prozedurale Texturen (`js/textures.js`): Iris (radiale Trabekel, Krypten, Krause, Pupillarsaum, Farbe braun-grün), Fundus (Papille, vier Gefäßbögen arteriell/venös, Makula dunkler, Foveareflex), Sklera (feine Episkleralgefäße).
- Performance: `renderer.setPixelRatio(Math.min(devicePixelRatio, 2))`, Segmentzahlen moderat (Lathe 96 Segmente, Tubes 64 × 12), Rendern nur bei Änderung (Render-on-demand: bei Controls-`change`, Animation, Resize). Ziel: flüssig auf einem Mittelklasse-Handy.

## 8. Umsetzung in Phasen

Nach jeder Phase committen (aussagekräftige Commit-Nachricht) und auf den Branch `claude/awesome-mendel-wx1nwy` pushen.

1. **Gerüst**: `auge3d/index.html` mit CSS-Tokens, Leisten, leerem Canvas; three.js + OrbitControls laden; rotierender Testwürfel auf dem Handy-Viewport (390 × 844) per Playwright-Screenshot prüfen.
2. **Bulbus-Geometrie**: Sklera (zwei Hälften), Kornea, Limbus, Choroidea, Retina, Iris + Muskeln der Iris, Corpus ciliare + 72 Processus, Linse (Kapsel, Cortex, Nucleus), Zonulafasern, Glaskörper + Cloquet, Schlemm/Trabekelwerk, Papille, Makula, Fovea. Maße aus Abschnitt 3. Screenshot lateral mit halber Transparenz der Sklera zur Kontrolle der Proportionen.
3. **Muskeln, Nerv, Gefäße**: 6 Muskeln mit Sehnen, Trochlea, Anulus; N. opticus mit drei Scheiden; Zentralgefäße, Ziliararterien, Vortexvenen. Kollisionsprüfung Muskeln/Sklera. Screenshots frontal, superior, lateral gegen Referenzabbildungen prüfen (Tillaux-Spirale, Obliqui-Verlauf unter den Recti, Papille nasal).
4. **Texturen und Materialien**: Canvas-Texturen, Licht, Transparenz-Reihenfolge.
5. **Explosionsansicht**: Vektoren und Phasen aus `data.js`, Regler, Buttons, Easing, reduzierte Bewegung.
6. **Interaktion**: Picking, Hervorhebung, Info-Sheet, Isolieren/Ausblenden, Teile-Liste, Ansichts-Chips, Beschriftungen.
7. **Inhalte**: alle Texte, Fakten, Klinik-Absätze in `data.js` vollständig ausfüllen; Nomenklatur gegen Terminologia Anatomica prüfen.
8. **Abschluss**: Tests (Abschnitt 9), `README.md` mit Beschreibung, Bedienung und Link; als Artifact veröffentlichen (Datei `auge3d/index.html`, `files` mit den vier JS-Dateien, `icon: "eye"`, `description`: ein Satz) und den Link ausgeben.

## 9. Abnahmekriterien

- [ ] Seite lädt ohne Konsolenfehler (Playwright, Chromium aus `/opt/pw-browsers`, Viewports 390 × 844 und 1280 × 800).
- [ ] Alle ≈ 40 Teile vorhanden, in der Liste auffindbar, antippbar, mit vollständigem Infotext.
- [ ] Explosionsregler trennt die Teile in beiden Phasen sichtbar und kollisionsfrei; bei 0 % sitzt alles exakt wie im Grundmodell.
- [ ] Proportionen geprüft: Achsenlänge ≈ 24 mm, Kornea-Ø 11,7, Vorderkammertiefe ≈ 3, Linse 9,5 × 4, Papille nasal und ≈ 4 mm von der Fovea, Rectus-Ansätze nach Tillaux, Obliqui hinter dem Äquator unter den Recti.
- [ ] Touch: Drehen, Pinch-Zoom, Tippen unterscheidbar; keine horizontale Seitenverschiebung; Bedienelemente ≥ 44 px.
- [ ] Hell- und Dunkelmodus lesbar.
- [ ] Hinweis zur überhöhten Schichtdicke sichtbar.
- [ ] Code im Repo gepusht, Artifact-Link funktioniert auf dem Smartphone.

## 10. Hinweise für die Umsetzung

- Maße zentral als Konstanten am Anfang von `geometry.js` (`const DIM = { scleraR: 12, corneaR1: 7.8, … }`), nicht als Zahlen im Code verstreut.
- Jedes Mesh bekommt `mesh.userData.partId`; ein Teil kann aus mehreren Meshes bestehen (z. B. Sklera-Hälften). `EYE.meshesByPart[partId]` als Map.
- Bei Unsicherheit über einen anatomischen Verlauf: lieber einfach und korrekt als detailliert und falsch. Keine erfundenen Maße; wo Literaturwerte schwanken, den gerundeten Mittelwert nehmen.
- Nicht über den Umfang hinausgehen (kein Quiz, keine Schnittebene, keine Lider), solange es nicht verlangt wird.
