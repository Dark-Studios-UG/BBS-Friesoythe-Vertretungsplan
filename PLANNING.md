# PLANNING

## Projektüberblick
- Node.js/Express-Server in `scrape.js` liefert die API und übernimmt das Scraping.
- Puppeteer ruft die beiden WebUntis-Monitor-Seiten parallel ab und speichert Rohdaten unter `data/`.
- Das statische Frontend unter `public/` lädt die zuletzt erzeugten JSON-Dateien via REST-Endpunkte.
- Zeitsteuerung: `setInterval(saveTemporaryData, UPDATE_INTERVAL)` (10 Minuten) sowie tägliches Backup um 03:00 Uhr MEZ.

## Wichtige Module
1. `scrape.js`
   - Express-Konfiguration & CORS
   - Scheduler (`saveTemporaryData`, `createDailyBackup`, `scheduleBackup`)
   - Scraping-Utilities (`retry`, `validateUrl`, `extractTableData`)
   - API-Routen: `/api/data`, `/api/morgen`, `/api/both`
2. `public/`
   - `index.html`, `script.js`, `styles.css` bilden den Client
   - Client cached Kursfilter im LocalStorage und ruft die REST-Endpunkte ab
3. `data/`
   - Temporäre Dateien: `temp_<YYYY-MM-DD>.json`
   - Backups: `data_<YYYY-MM-DD>.json`

## Namens- & Strukturkonventionen
- Konstanten in `SCREAMING_SNAKE_CASE`, lokale Variablen und Funktionen in `camelCase`.
- Hilfsfunktionen (z. B. Datumshandling) direkt in `scrape.js`, bei wachsendem Umfang Auslagerung in eigene Module unter `/lib` oder `/utils`.
- Dateien sollten < 500 Zeilen bleiben; bei Überschreitung Module aufteilen.

## Architekturprinzipien
- Asynchrone Abläufe strikt via `async/await` handeln; keine gemischten `.then()`-Ketten.
- Netzwerkzugriffe kapseln (z. B. `retry`, `validateUrl`) und mit klaren Fehlermeldungen versehen.
- I/O-Zugriffe (fs) immer synchronisiert über das zentrale `data`-Verzeichnis; neue Dateitypen klar benennen.
- Logging über `console` belassen, aber präzise Kontexttexte verwenden (z. B. `console.log("Scraping today's data...")`).

## Tests & Qualität
- Derzeit keine automatisierten Tests vorhanden. Für künftige Arbeiten Unit-Tests (preferiert Jest für JS bzw. Pytest falls Python-Komponenten ergänzt werden) mit Mocking der Puppeteer-Seiten einplanen.
- Nach inhaltlichen Änderungen die REST-Endpunkte manuell gegen lokale HTML-Snapshots prüfen.

## Offene Architekturfragen
- Langfristig prüfen, ob das Scraping in einen isolierten Worker/Queue-Prozess ausgelagert werden sollte.
- Monitoring/Alerting für fehlgeschlagene Scrapes (Timeouts, HTTP-Fehler) ergänzen.
