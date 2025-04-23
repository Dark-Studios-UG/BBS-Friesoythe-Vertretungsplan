# Vertretungsplan

Ein moderner und benutzerfreundlicher Vertretungsplan für die BBS Friesoythe. Die Anwendung zeigt Vertretungen für heute und morgen an und ermöglicht das Filtern nach Kursen.

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
git clone https://github.com/Dark-Animations-Studio/vertretungsplan.git
cd vertretungsplan
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

ISC Lizenz - siehe [LICENSE](LICENSE) für Details.

## Kontakt

Projekt Link: [https://github.com/Dark-Animations-Studio/vertretungsplan](https://github.com/Dark-Animations-Studio/vertretungsplan) 