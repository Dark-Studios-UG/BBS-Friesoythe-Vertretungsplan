# BBS Friesoythe Vertretungsplan

Ein moderner und benutzerfreundlicher Vertretungsplan für die BBS Friesoythe. Die Anwendung zeigt Vertretungen für heute und morgen an und ermöglicht das Filtern nach Kursen.

🌐 **Projektseite:** [bbs.deeken.digital](https://bbs.deeken.digital)

## Über das Projekt

Dieses Projekt wurde von **DeekenDigital by Konstantin Deeken** entwickelt und wird kontinuierlich gepflegt. Es bietet eine moderne, responsive Lösung zur Anzeige von Vertretungsplänen der BBS Friesoythe.

## Features

- 🔄 **Automatische Aktualisierung** der Vertretungsdaten alle 10 Minuten
- 📱 **Responsive Design** für alle Geräte (Desktop, Tablet, Mobile)
- 🎯 **Kursfilter** mit Speicherung der letzten Auswahl im LocalStorage
- 📅 **Flexible Ansichten**: Heute, Morgen oder beide Tage kombiniert
- 🔍 **Sortierbare Tabellenansicht** nach verschiedenen Spalten
- 🌙 **Klares, augenschonendes Design** mit modernen UI-Elementen
- ⚡ **Schnelle Performance** durch optimiertes Scraping und Caching
- 🔗 **URL-basierte Filterung** für einfaches Teilen von Kursfiltern

## Technologien

### Frontend
- **HTML5** - Semantische Struktur
- **CSS3** - Modernes Styling mit CSS Grid, Flexbox und Custom Properties
- **Vanilla JavaScript** - Keine Frameworks, optimale Performance

### Backend
- **Node.js** - Serverumgebung
- **Express** - Web-Framework für API-Endpunkte
- **Puppeteer** - Headless Browser für Web Scraping
- **CORS** - Cross-Origin Resource Sharing

## Installation

### Voraussetzungen

- Node.js (Version 14.0.0 oder höher)
- npm (Node Package Manager)

### Setup

1. **Repository klonen:**
```bash
git clone https://github.com/Dark-Studios-UG/BBS-Friesoythe-Vertretungsplan.git
cd BBS-Friesoythe-Vertretungsplan
```

2. **Dependencies installieren:**
```bash
npm install
```

3. **Server starten:**
```bash
npm start
```

Oder für Entwicklung mit automatischem Neustart:
```bash
npm run dev
```

4. **Im Browser öffnen:**
```
http://localhost:3000
```

## Projektstruktur

```
BBS-Friesoythe-Vertretungsplan/
├── public/                 # Statische Frontend-Dateien
│   ├── index.html         # Haupt-HTML-Datei
│   ├── script.js          # Frontend-JavaScript (Vanilla JS)
│   ├── styles.css         # Styling und Responsive Design
│   └── favicon.png        # Favicon
├── data/                  # Gespeicherte Vertretungsdaten
│   ├── temp_*.json        # Temporäre Dateien (aktueller Tag)
│   └── data_*.json        # Tägliche Backups
├── scrape.js             # Backend-Server & Scraping-Logik
├── package.json          # Projekt-Konfiguration und Dependencies
├── PLANNING.md           # Architektur-Dokumentation
├── TASK.md               # Aufgaben- und Änderungsprotokoll
└── README.md             # Projektdokumentation
```

## API-Endpunkte

Die Anwendung stellt folgende REST-API-Endpunkte zur Verfügung:

- **`GET /api/data`** - Vertretungsdaten für heute
- **`GET /api/morgen`** - Vertretungsdaten für morgen
- **`GET /api/both`** - Vertretungsdaten für beide Tage kombiniert

### Antwortformat

```json
{
  "data": [
    {
      "kurs": "Kursname",
      "stunde": "1",
      "raum": "Raum",
      "lehrer": "Lehrer",
      "typ": "Vertretung",
      "notizen": "Notizen",
      "datum": "2025-01-27" // Nur bei /api/both
    }
  ],
  "courses": ["Kurs1", "Kurs2", ...]
}
```

## Automatische Updates

- **Intervall-Updates**: Daten werden alle 10 Minuten automatisch aktualisiert
- **Tägliches Backup**: Um 03:00 Uhr MEZ wird ein tägliches Backup erstellt
- **Intelligente Zeiterkennung**: Automatische Umschaltung auf den nächsten Tag ab 17:00 Uhr
- **Wochenende-Erkennung**: Automatisches Überspringen von Wochenenden

## Konfiguration

### Umgebungsvariablen

- **`PORT`** - Server-Port (Standard: 3000)

### Konstanten in `scrape.js`

- **`UPDATE_INTERVAL`** - Update-Intervall in Millisekunden (Standard: 600000 = 10 Minuten)
- **`BACKUP_HOUR`** - Stunde für tägliches Backup (Standard: 3)
- **`SWITCH_HOUR`** - Stunde für Tagesumschaltung (Standard: 17)

## Entwicklung

### Code-Stil

- Konstanten in `SCREAMING_SNAKE_CASE`
- Variablen und Funktionen in `camelCase`
- Asynchrone Abläufe mit `async/await`
- Dateien sollten < 500 Zeilen bleiben

### Architektur

- **Modularer Aufbau**: Klare Trennung zwischen Frontend und Backend
- **Error Handling**: Umfassende Fehlerbehandlung mit Retry-Logik
- **Performance**: Optimiertes Scraping mit Request-Interception
- **Caching**: Lokale Speicherung von Daten zur Reduzierung von API-Aufrufen

## Beitragen

Beiträge sind willkommen! Bitte folgen Sie diesen Schritten:

1. Fork erstellen
2. Feature Branch erstellen (`git checkout -b feature/AmazingFeature`)
3. Änderungen committen (`git commit -m 'Add some AmazingFeature'`)
4. Branch pushen (`git push origin feature/AmazingFeature`)
5. Pull Request erstellen

## Lizenz

Dieses Projekt ist unter einer eingeschränkten Lizenz nur für persönliche Nutzung lizenziert:

```
Custom Personal Use License

Copyright (c) 2025 DeekenDigital by Konstantin Deeken

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

## Kontakt & Support

### Projekt-Informationen

- **Projektseite**: [bbs.deeken.digital](https://bbs.deeken.digital)
- **GitHub Repository**: [BBS-Friesoythe-Vertretungsplan](https://github.com/Dark-Studios-UG/BBS-Friesoythe-Vertretungsplan)
- **Verbesserungsvorschläge**: [Feedback-Formular](https://forms.gle/SdA2HfNGgqiHhsoa9)

### DeekenDigital

- **Website**: [deeken.digital](https://deeken.digital)
- **Impressum**: [deeken.digital/impressum](https://deeken.digital/impressum)
- **Datenschutz**: [deeken.digital/datenschutz](https://deeken.digital/datenschutz)

---

**Entwickelt mit ❤️ von [DeekenDigital by Konstantin Deeken](https://deeken.digital)**
