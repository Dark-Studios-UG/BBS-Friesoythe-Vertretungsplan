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
npm install express puppeteer cors path fs
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
│   ├── script.js        # JavaScript Code
│   └── styles.css       # Styling
├── data/                # Gespeicherte Vertretungsdaten
├── scrape.js           # Backend-Server & Scraping-Logik
├── package.json        # Projekt-Konfiguration
└── README.md          # Projektdokumentation
```

## API-Endpunkte

- `GET /api/data` - Vertretungsdaten für heute
- `GET /api/morgen` - Vertretungsdaten für morgen
- `GET /api/both` - Vertretungsdaten für beide Tage zsm

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

Dieses Projekt ist unter einer eingeschränkten Lizenz nur für persönliche Nutzung lizenziert:

```
Custom Personal Use License

Copyright (c) 2025 Dark Studios UG (haftungsbeschränkt)

Die Erlaubnis zur Nutzung, Kopierung, Modifizierung und/oder Verteilung dieser Software
wird hiermit ausschließlich für persönliche, nicht-kommerzielle Zwecke erteilt,
vorausgesetzt, dass der obige Copyright-Hinweis und dieser Erlaubnishinweis in allen
Kopien oder wesentlichen Teilen der Software enthalten sind.

DIE SOFTWARE WIRD OHNE JEDE AUSDRÜCKLICHE ODER IMPLIZIERTE GARANTIE BEREITGESTELLT,
EINSCHLIESSLICH DER GARANTIE ZUR BENUTZUNG FÜR DEN VORGESEHENEN ODER EINEM BESTIMMTEN
ZWECK SOWIE JEGLICHER RECHTSVERLETZUNG, JEDOCH NICHT DARAUF BESCHRÄNKT. IN KEINEM
FALL SIND DIE AUTOREN ODER COPYRIGHTINHABER FÜR JEGLICHEN SCHADEN ODER SONSTIGE
ANSPRÜCHE HAFTBAR ZU MACHEN, OB INFOLGE DER ERFÜLLUNG EINES VERTRAGES, EINES DELIKTES
ODER ANDERS IM ZUSAMMENHANG MIT DER SOFTWARE ODER SONSTIGER VERWENDUNG DER SOFTWARE
ENTSTANDEN.
```

### Was die Lizenz erlaubt:
- ✅ Private, nicht-kommerzielle Nutzung
- ✅ Modifikation für persönliche Zwecke
- ✅ Private Verteilung

### Bedingungen:
- ℹ️ Lizenz und Copyright müssen in allen Kopien enthalten sein
- ℹ️ Änderungen müssen dokumentiert werden
- ℹ️ Nur für persönliche, nicht-kommerzielle Projekte

### Einschränkungen:
- ❌ Keine kommerzielle Nutzung
- ❌ Keine Haftung durch die Autoren
- ❌ Keine Garantien durch die Autoren

## Kontakt

Verbesserungsvorschläge oder Bewertungen: [https://forms.gle/e3auU1w4AGazuSZJ9](https://forms.gle/e3auU1w4AGazuSZJ9)

Projekt Link: [https://github.com/Dark-Studios-UG/BBS-Friesoythe-Vertretungsplan](https://github.com/Dark-Studios-UG/BBS-Friesoythe-Vertretungsplan)  

Projekt Website: [bbsvertretung.darkstudios.de](https://bbsvertretung.darkstudios.de)  

Website: [darkstudios.de](https://darkstudios.de) 
