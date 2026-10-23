# Auge 3D

Interaktives 3D-Modell des menschlichen Auges für das Medizin- und Biologiestudium. Gezeigt wird der rechte Augapfel (Oculus dexter) mit allen Schichten, den sechs äußeren Augenmuskeln und dem N. opticus mit Hüllen und Gefäßen. Nomenklatur nach Terminologia Anatomica, deutsche Namen daneben.

Link zur veröffentlichten Version: https://claude.ai/artifact/H52vPTnsYzu7cChpH4gwd7

## Was das Modell zeigt

- **Bulbus**: Sklera, Kornea, Limbus, Schlemm-Kanal, Trabekelwerk, Iris, Ziliarkörper, Choroidea, Retina mit Makula, Fovea und Papille, Linse, Zonulafasern, Glaskörper, Vorder- und Hinterkammer
- **Muskeln**: M. rectus superior, inferior, medialis und lateralis, M. obliquus superior und inferior, Trochlea und Anulus tendineus communis
- **N. opticus**: Dura-, Arachnoidea- und Piascheide, A. und V. centralis retinae, Aa. ciliares posteriores breves und longae, Vv. vorticosae

Schichtdicken von Retina und Choroidea sind zur Darstellung überhöht. Alle anderen Maße sind maßstabsgetreu (1 Einheit = 1 mm).

## Bedienung am Handy

- **Drehen**: mit einem Finger auf dem Modell ziehen
- **Zoomen**: zwei Finger zusammenziehen oder auseinanderziehen
- **Verschieben**: mit zwei Fingern ziehen
- **Explosionsansicht**: Regler unten auf 0–100 % stellen; „Zusammen“ und „Explodiert“ animieren auf die Endstellungen
- **Infos**: ein Teil antippen, es erscheinen Name, Text, Fakten und klinischer Bezug
- **Teile-Liste**: Teile einzeln ein- und ausblenden oder gezielt auswählen

## Dateistruktur

```
auge3d/
  index.html          Markup, Styles, lädt three.js und die Scripts
  js/data.js          Teile, Gruppen, Explosionsvektoren
  js/content.js       Texte, Fakten und klinische Bezüge
  js/textures.js      prozedurale Texturen (Iris, Retina, Sklera, Muskel, Sehne)
  js/geometry.js      erzeugt alle Meshes aus den Maßen
  js/app.js           Renderer, Kamera, Steuerung, Auswahl, Oberfläche
  dev/smoke.mjs       Smoke-Test mit Playwright
  dev/textures-preview.html  Vorschau der Texturen
  PLAN.md             Planung (im Repo-Root)
```

## Lokal starten

Die Seite braucht keinen Build-Schritt. Im Repo-Root:

```sh
npx http-server auge3d
```

und dann `http://127.0.0.1:8080` öffnen (Port je nach Ausgabe von `http-server`).

## Smoke-Test

Einmalig die Abhängigkeiten installieren, dann den Test starten:

```sh
cd auge3d/dev && npm i
cd ../..
node auge3d/dev/smoke.mjs
```

Das Skript öffnet die Seite mobil (390 × 844) und am Desktop (1280 × 800), setzt den Explosionsregler auf 0, 50 und 100 % und speichert Screenshots unter `auge3d/dev/shots/`. Es meldet Konsolenfehler, Seitenfehler und fehlgeschlagene Requests und endet mit Exit-Code 1, wenn welche auftreten.

Chromium liegt unter `/opt/pw-browsers`. Bitte kein `playwright install` ausführen.

## Abweichungen vom Plan

- Die Szene ist an der YZ-Ebene gespiegelt (Modellraum wie im Plan: +X lateral), damit es von vorn gesehen ein echtes rechtes Auge ist (nasal = Betrachter-rechts).
- Der Sehnerv gleitet in Phase 1 entlang seiner Achse (≈ −Z) statt exakt −Z, damit er durch den Anulus läuft.
- Der Anulus verschiebt sich in Phase 2 um +Z 5 mm (Mittel der Rectus-Vektoren). Trennebene der Schalen y = +1,4 mm, damit Papille und Fovea nicht zerschnitten werden.
- Achsenlänge: Hornhautscheitel bis Aderhaut-Außenseite ≈ 23,6 mm (bis Sklera-Innenseite 24,1 mm), da Retina/Aderhaut überhöht sind.
- Gerade Muskeln heben sich hinter der Sehne leicht von der Sklera ab, damit die Obliqui darunter durchlaufen.

## Hinweis

Das Modell dient dem Lernen und ersetzt keine Anatomie-Lehrbücher. Maße sind gerundete Literaturwerte; Verläufe der Muskeln sind Näherungen.
