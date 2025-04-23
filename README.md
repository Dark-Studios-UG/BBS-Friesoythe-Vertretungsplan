# Vertretungsplan BBS Friesoythe

Ein moderner und benutzerfreundlicher Vertretungsplan für die BBS Friesoythe. Die Anwendung zeigt Vertretungen für heute und morgen an und ermöglicht das Filtern nach Kursen.

🌐 **Website:** [bbsvertretung.darkstudios.de](https://bbsvertretung.darkstudios.de)

## Features

- 🔄 Automatische Aktualisierung der Vertretungsdaten
- 📱 Responsive Design für alle Geräte
- 🎯 Kursfilter mit Speicherung der letzten Auswahl
- 📅 Anzeige für heute und morgen
- 🔍 Übersichtliche Tabellenansicht
- 🌙 Klares, augenschonendes Design

## Technologien

- Frontend: HTML5, CSS3, Vanilla JavaScript
- Backend: Node.js, Express
- Web Scraping: Puppeteer
- Datenverarbeitung: Cheerio

## Installation

1. Repository klonen:
```bash
git clone https://github.com/Dark-Studios-UG/BBS-Friesoythe-Vertretungsplan.git
cd BBS-Friesoythe-Vertretungsplan
```

2. Dependencies installieren:
```bash
npm install
```

3. Server starten:
```bash
node scrape.js
```

4. Im Browser öffnen:
```
http://localhost:3000
```

## Projektstruktur

```
vertretungsplan/
├── public/               # Statische Dateien
│   ├── index.html       # Frontend-Interface
│   ├── styles.css       # Styling
│   └── das.webp         # Favicon
├── data/                # Gespeicherte Vertretungsdaten
├── scrape.js           # Backend-Server & Scraping-Logik
├── package.json        # Projekt-Konfiguration
└── README.md          # Projektdokumentation
```

## API-Endpunkte

- `GET /api/data` - Vertretungsdaten für heute
- `GET /api/morgen` - Vertretungsdaten für morgen

## Automatische Updates

- Daten werden alle 10 Minuten aktualisiert
- Tägliches Backup um 3 Uhr morgens
- Automatische Umschaltung auf den nächsten Tag ab 17 Uhr

## Beitragen

1. Fork erstellen
2. Feature Branch erstellen (`git checkout -b feature/AmazingFeature`)
3. Änderungen committen (`git commit -m 'Add some AmazingFeature'`)
4. Branch pushen (`git push origin feature/AmazingFeature`)
5. Pull Request erstellen

## Lizenz

Dieses Projekt ist unter der ISC-Lizenz lizenziert - siehe unten für Details:

```
ISC License (ISC)

Copyright (c) 2024 Dark Studios UG

Permission to use, copy, modify, and/or distribute this software for any
purpose with or without fee is hereby granted, provided that the above
copyright notice and this permission notice appear in all copies.

THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES WITH
REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF MERCHANTABILITY
AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR ANY SPECIAL, DIRECT,
INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES WHATSOEVER RESULTING FROM
LOSS OF USE, DATA OR PROFITS, WHETHER IN AN ACTION OF CONTRACT, NEGLIGENCE OR
OTHER TORTIOUS ACTION, ARISING OUT OF OR IN CONNECTION WITH THE USE OR
PERFORMANCE OF THIS SOFTWARE.
```

### Was die Lizenz erlaubt:
- ✅ Kommerzielle Nutzung
- ✅ Modifikation
- ✅ Distribution
- ✅ Private Nutzung

### Bedingungen:
- ℹ️ Lizenz und Copyright müssen in allen Kopien enthalten sein
- ℹ️ Änderungen müssen dokumentiert werden

### Einschränkungen:
- ❌ Keine Haftung durch die Autoren
- ❌ Keine Garantien durch die Autoren

## Kontakt

Projekt Link: [https://github.com/Dark-Studios-UG/BBS-Friesoythe-Vertretungsplan](https://github.com/Dark-Studios-UG/BBS-Friesoythe-Vertretungsplan)  

Projekt Website: [bbsvertretung.darkstudios.de](https://bbsvertretung.darkstudios.de)  

Website: [darkstudios.de](https://darkstudios.de) 